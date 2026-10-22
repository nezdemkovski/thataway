import { eq, inArray, sql } from "drizzle-orm";

import { TileStatus } from "@thataway/db/enums";
import { FillTileJob, QUEUES, TILE_PRECISION, TILE_TTL_DAYS } from "@thataway/db/jobs";
import { db, place, tile } from "@/db/postgres";
import { CommonsClient } from "@/modules/commons/client";
import { ClassService } from "@/modules/wikidata/classes";
import { WikidataClient } from "@/modules/wikidata/client";
import { decide } from "@/modules/wikidata/roots";
import { WikipediaClient } from "@/modules/wikipedia/client";
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

  /**
   * Replaces the tile's places with what Wikidata has inside it: items with coordinates that
   * at least two language editions write about, minus people, events, cities, companies and
   * streets by class. Wikipedia adds page views, Commons the image credit.
   */
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

    const wikidata = new WikidataClient();
    try {
      const items = await wikidata.itemsInBox(geohashBounds(geohash));
      const roots = await ClassService.rootsOf(
        wikidata,
        items.flatMap((item) => item.classes),
      );
      const rootsOf = (classes: string[]) => classes.flatMap((id) => roots.get(id) ?? []);
      const kept = items.flatMap((item) => {
        const kind = decide(rootsOf(item.classes));
        return kind ? [{ item, kind }] : [];
      });

      const wikipedia = new WikipediaClient();
      const views = await wikipedia.pageviews(
        kept.flatMap(({ item }) => (item.enwikiTitle ? [item.enwikiTitle] : [])),
      );
      const credits = await new CommonsClient().credits(
        kept.flatMap(({ item }) => (item.imageFile ? [item.imageFile] : [])),
      );
      logger.info("tile fetched", { geohash, items: items.length, places: kept.length });

      await db.transaction(async (tx) => {
        if (kept.length > 0) {
          await tx
            .insert(place)
            .values(
              kept.map(({ item, kind }) => {
                const credit = item.imageFile ? credits.get(item.imageFile) : undefined;
                return {
                  id: item.id,
                  name: item.name,
                  description: item.description,
                  kind,
                  classes: item.classes,
                  latitude: item.latitude,
                  longitude: item.longitude,
                  geom: `SRID=4326;POINT(${item.longitude} ${item.latitude})`,
                  geohash: encodeGeohash(item.latitude, item.longitude, TILE_PRECISION),
                  sitelinks: item.sitelinks,
                  heritage: item.heritage,
                  enwikiTitle: item.enwikiTitle,
                  views: item.enwikiTitle ? (views.get(item.enwikiTitle) ?? 0) : 0,
                  viewsUpdatedAt: new Date(),
                  imageFile: item.imageFile,
                  imageUrl: credit?.url ?? null,
                  imageAuthor: credit?.author ?? null,
                  imageLicense: credit?.license ?? null,
                };
              }),
            )
            .onConflictDoUpdate({
              target: place.id,
              set: {
                name: sql`excluded.name`,
                description: sql`excluded.description`,
                kind: sql`excluded.kind`,
                classes: sql`excluded.classes`,
                latitude: sql`excluded.latitude`,
                longitude: sql`excluded.longitude`,
                geom: sql`excluded.geom`,
                geohash: sql`excluded.geohash`,
                sitelinks: sql`excluded.sitelinks`,
                heritage: sql`excluded.heritage`,
                enwikiTitle: sql`excluded.enwiki_title`,
                views: sql`excluded.views`,
                viewsUpdatedAt: sql`excluded.views_updated_at`,
                imageFile: sql`excluded.image_file`,
                imageUrl: sql`excluded.image_url`,
                imageAuthor: sql`excluded.image_author`,
                imageLicense: sql`excluded.image_license`,
              },
            });
        }
        await tx
          .update(tile)
          .set({
            status: TileStatus.Ready,
            fetchedAt: new Date(),
            placeCount: kept.filter(
              ({ item }) => this.tileOf(item.latitude, item.longitude) === geohash,
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
