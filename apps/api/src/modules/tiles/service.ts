import { eq, inArray, sql } from "drizzle-orm";

import { TileStatus } from "@thataway/db/enums";
import { FillTileJob, QUEUES, TILE_PRECISION, TILE_TTL_DAYS } from "@thataway/db/jobs";
import { db, place, tile } from "@/db/postgres";
import { WikipediaClient } from "@/modules/wikipedia/client";
import { displayName, isPlace } from "@/modules/wikipedia/filter";
import { guessKind } from "@/modules/wikipedia/kind";
import { LogNamespace } from "@/utils/enums";
import { encodeGeohash, geohashBounds, geohashNeighbourhood } from "@/utils/geohash";
import { createLogger } from "@/utils/logger";
import { getBoss } from "@/utils/pgBoss";

const logger = createLogger(LogNamespace.Tiles);

/** How long GET /places waits for a first fill before answering with what it has. */
const FIRST_FILL_BUDGET_MS = 4_000;
const POLL_MS = 300;

export const TileService = {
  /** The tile a point falls in. */
  tileOf(latitude: number, longitude: number): string {
    return encodeGeohash(latitude, longitude, TILE_PRECISION);
  },

  /**
   * Makes sure the tile under a point and its neighbours are filled or being filled. Returns
   * whether everything around is ready; when it isn't, the first fill is given a few seconds.
   */
  async ensureAround(latitude: number, longitude: number): Promise<{ ready: boolean }> {
    const here = this.tileOf(latitude, longitude);
    const wanted = geohashNeighbourhood(here);
    const stale = await this.staleTiles(wanted);
    if (stale.length === 0) return { ready: true };

    // The tile under the walker first; the neighbours can follow
    await this.requestFill(stale, false, here);

    const deadline = Date.now() + FIRST_FILL_BUDGET_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      if ((await this.staleTiles(wanted)).length === 0) return { ready: true };
    }
    return { ready: false };
  },

  /** Tiles among `geohashes` that have no fresh fill. */
  async staleTiles(geohashes: string[]): Promise<string[]> {
    const rows = await db
      .select({ geohash: tile.geohash, status: tile.status, fetchedAt: tile.fetchedAt })
      .from(tile)
      .where(inArray(tile.geohash, geohashes));
    const fresh = new Set(
      rows
        .filter(
          (row) =>
            row.status === TileStatus.Ready &&
            row.fetchedAt &&
            Date.now() - row.fetchedAt.getTime() < TILE_TTL_DAYS * 24 * 3600 * 1000,
        )
        .map((row) => row.geohash),
    );
    return geohashes.filter((hash) => !fresh.has(hash));
  },

  /** Records the tiles as wanted and queues a fill for each, once; `first` jumps the queue. */
  async requestFill(geohashes: string[], force = false, first?: string): Promise<void> {
    if (geohashes.length === 0) return;
    await db
      .insert(tile)
      .values(geohashes.map((geohash) => ({ geohash })))
      .onConflictDoNothing();
    const boss = await getBoss();
    for (const geohash of geohashes) {
      const job: FillTileJob = { geohash, force };
      // One job per tile at a time, however many people ask for it
      await boss.send(QUEUES.FILL_TILE, job, {
        singletonKey: geohash,
        priority: geohash === first ? 10 : 0,
        retryLimit: 3,
        retryDelay: 60,
        retryBackoff: true,
        expireInSeconds: 600,
      });
    }
  },

  /** Replaces the tile's places with what Wikipedia has inside it. */
  async fill(geohash: string, force = false): Promise<void> {
    const [current] = await db.select().from(tile).where(eq(tile.geohash, geohash));
    if (
      !force &&
      current?.status === TileStatus.Ready &&
      current.fetchedAt &&
      Date.now() - current.fetchedAt.getTime() < TILE_TTL_DAYS * 24 * 3600 * 1000
    ) {
      return;
    }
    await db
      .insert(tile)
      .values({ geohash, status: TileStatus.Filling })
      .onConflictDoUpdate({
        target: tile.geohash,
        set: { status: TileStatus.Filling, error: null },
      });

    const client = new WikipediaClient();
    try {
      const pages = await client.pagesInBox(geohashBounds(geohash));
      const candidates = pages.filter((page) => isPlace(page.description));
      const views = await client.pageviews(candidates.map((page) => page.pageid));
      logger.info("tile fetched", { geohash, pages: pages.length, places: candidates.length });

      await db.transaction(async (tx) => {
        if (candidates.length > 0) {
          await tx
            .insert(place)
            .values(
              candidates.map((page) => ({
                id: page.pageid,
                language: client.language,
                title: page.title,
                name: displayName(page.title),
                description: page.description ?? null,
                kind: guessKind(page.title, page.description),
                latitude: page.latitude,
                longitude: page.longitude,
                geom: `SRID=4326;POINT(${page.longitude} ${page.latitude})`,
                geohash: encodeGeohash(page.latitude, page.longitude, TILE_PRECISION),
                views: views.get(page.pageid) ?? 0,
                viewsUpdatedAt: new Date(),
                articleLength: page.length,
              })),
            )
            .onConflictDoUpdate({
              target: place.id,
              set: {
                title: sql`excluded.title`,
                name: sql`excluded.name`,
                description: sql`excluded.description`,
                kind: sql`excluded.kind`,
                latitude: sql`excluded.latitude`,
                longitude: sql`excluded.longitude`,
                geom: sql`excluded.geom`,
                geohash: sql`excluded.geohash`,
                views: sql`excluded.views`,
                viewsUpdatedAt: sql`excluded.views_updated_at`,
                articleLength: sql`excluded.article_length`,
              },
            });
        }
        await tx
          .update(tile)
          .set({
            status: TileStatus.Ready,
            fetchedAt: new Date(),
            placeCount: candidates.filter(
              (page) => this.tileOf(page.latitude, page.longitude) === geohash,
            ).length,
            error: null,
          })
          .where(eq(tile.geohash, geohash));
      });
    } catch (error) {
      logger.exception(error, { geohash });
      await db
        .update(tile)
        .set({
          status: TileStatus.Failed,
          error: error instanceof Error ? error.message : String(error),
        })
        .where(eq(tile.geohash, geohash));
      throw error;
    }
  },
};
