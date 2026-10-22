import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { TileStatus } from "@thataway/db/enums";
import {
  EnrichTileJob,
  FillTileJob,
  QUEUES,
  TILE_PRECISION,
  TILE_TTL_DAYS,
} from "@thataway/db/jobs";
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
/** A tile a worker took this recently is being filled; asking again would only queue a twin. */
const FILLING_GRACE_MS = 10 * 60 * 1000;

export const TileService = {
  /** The tile a point falls in. */
  tileOf(latitude: number, longitude: number): string {
    return encodeGeohash(latitude, longitude, TILE_PRECISION);
  },

  /**
   * Makes sure the tile under a point and its neighbours are filled or being filled. The first
   * fill is given a few seconds; `warming` stays true while places are still missing or their
   * page views and photos have not landed yet, so the walker asks again in a moment.
   */
  async ensureAround(latitude: number, longitude: number): Promise<{ warming: boolean }> {
    const here = this.tileOf(latitude, longitude);
    const wanted = geohashNeighbourhood(here);
    let stale = await this.staleTiles(wanted);
    if (stale.length > 0) {
      // The tile under the walker first; the neighbours can follow
      await this.requestFill(stale, false, here);
      const deadline = Date.now() + FIRST_FILL_BUDGET_MS;
      while (stale.length > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        stale = await this.staleTiles(wanted);
      }
    }
    if (stale.length > 0) return { warming: true };
    return { warming: (await this.enrichingTiles(wanted)).length > 0 };
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

  /**
   * Records the tiles as wanted and queues a fill for each, once; `first` jumps the queue.
   * A tile a worker is already on is left alone: pg-boss only folds duplicates while the
   * first job still waits, and the walker asks again every few seconds while it warms.
   */
  async requestFill(geohashes: string[], force = false, first?: string): Promise<void> {
    if (geohashes.length === 0) return;
    await db
      .insert(tile)
      .values(geohashes.map((geohash) => ({ geohash })))
      .onConflictDoNothing();
    const filling = force ? [] : await this.fillingTiles(geohashes);
    const boss = await getBoss();
    for (const geohash of geohashes) {
      if (filling.includes(geohash)) continue;
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

  /** Filled tiles among `geohashes` whose page views and photos are still on their way. */
  async enrichingTiles(geohashes: string[]): Promise<string[]> {
    const rows = await db
      .select({ geohash: tile.geohash })
      .from(tile)
      .where(
        and(
          inArray(tile.geohash, geohashes),
          eq(tile.status, TileStatus.Ready),
          isNull(tile.enrichedAt),
          gt(tile.requestedAt, new Date(Date.now() - FILLING_GRACE_MS)),
        ),
      );
    return rows.map((row) => row.geohash);
  },

  /** Tiles among `geohashes` a worker took within the grace period. */
  async fillingTiles(geohashes: string[]): Promise<string[]> {
    const rows = await db
      .select({ geohash: tile.geohash })
      .from(tile)
      .where(
        and(
          inArray(tile.geohash, geohashes),
          eq(tile.status, TileStatus.Filling),
          gt(tile.requestedAt, new Date(Date.now() - FILLING_GRACE_MS)),
        ),
      );
    return rows.map((row) => row.geohash);
  },

  /**
   * Replaces the tile's places with what Wikidata has inside it: items with coordinates that
   * at least two language editions write about, minus people, events, cities, companies and
   * streets by class. The map can draw from this; page views and photo credits follow in
   * `enrich`, queued at the end, so a first visit waits for one query, not three services.
   */
  async fill(geohash: string, force = false): Promise<void> {
    const [current] = await db.select().from(tile).where(eq(tile.geohash, geohash));
    if (
      !force &&
      current?.status === TileStatus.Ready &&
      current.fetchedAt &&
      Date.now() - current.fetchedAt.getTime() < TILE_TTL_DAYS * 24 * 3600 * 1000
    ) {
      logger.debug("tile still fresh", { geohash });
      return;
    }
    logger.info("filling tile", { geohash });
    // requested_at marks when this fill was taken, so a twin request can tell it is under way
    await db
      .insert(tile)
      .values({ geohash, status: TileStatus.Filling })
      .onConflictDoUpdate({
        target: tile.geohash,
        set: { status: TileStatus.Filling, error: null, requestedAt: new Date() },
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

      logger.info("tile fetched", { geohash, items: items.length, places: kept.length });

      await db.transaction(async (tx) => {
        if (kept.length > 0) {
          await tx
            .insert(place)
            .values(
              kept.map(({ item, kind }) => {
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
                  imageFile: item.imageFile,
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
                imageFile: sql`excluded.image_file`,
                // Views and credits stay from last time; a changed photo loses its credit
                // until `enrich` fetches the new one
                imageUrl: sql`CASE WHEN excluded.image_file IS DISTINCT FROM ${place.imageFile} THEN NULL ELSE ${place.imageUrl} END`,
                imageAuthor: sql`CASE WHEN excluded.image_file IS DISTINCT FROM ${place.imageFile} THEN NULL ELSE ${place.imageAuthor} END`,
                imageLicense: sql`CASE WHEN excluded.image_file IS DISTINCT FROM ${place.imageFile} THEN NULL ELSE ${place.imageLicense} END`,
              },
            });
        }
        await tx
          .update(tile)
          .set({
            status: TileStatus.Ready,
            fetchedAt: new Date(),
            enrichedAt: null,
            placeCount: kept.filter(
              ({ item }) => this.tileOf(item.latitude, item.longitude) === geohash,
            ).length,
            error: null,
          })
          .where(eq(tile.geohash, geohash));
      });
      const job: EnrichTileJob = { geohash };
      await (
        await getBoss()
      ).send(QUEUES.ENRICH_TILE, job, {
        singletonKey: geohash,
        retryLimit: 3,
        retryDelay: 60,
        retryBackoff: true,
        expireInSeconds: 600,
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

  /**
   * The second half of a fill: English page views for the ranking and the Commons credit for
   * every photo that has none yet. The tile is served meanwhile; `warming` tells the walker
   * to ask again once this has landed.
   */
  async enrich(geohash: string): Promise<void> {
    const rows = await db
      .select({
        id: place.id,
        enwikiTitle: place.enwikiTitle,
        imageFile: place.imageFile,
        imageUrl: place.imageUrl,
      })
      .from(place)
      .where(eq(place.geohash, geohash));
    const titles = rows.flatMap((row) => (row.enwikiTitle ? [row.enwikiTitle] : []));
    const files = rows.flatMap((row) => (row.imageFile && !row.imageUrl ? [row.imageFile] : []));
    try {
      const views = await new WikipediaClient().pageviews(titles);
      const credits = await new CommonsClient().credits(files);
      logger.info("tile enriched", { geohash, places: rows.length, photos: files.length });
      await db.transaction(async (tx) => {
        for (const row of rows) {
          const credit = row.imageFile ? credits.get(row.imageFile) : undefined;
          await tx
            .update(place)
            .set({
              views: row.enwikiTitle ? (views.get(row.enwikiTitle) ?? 0) : 0,
              viewsUpdatedAt: new Date(),
              ...(credit
                ? { imageUrl: credit.url, imageAuthor: credit.author, imageLicense: credit.license }
                : {}),
            })
            .where(eq(place.id, row.id));
        }
        await tx.update(tile).set({ enrichedAt: new Date() }).where(eq(tile.geohash, geohash));
      });
    } catch (error) {
      logger.exception(error, { geohash });
      throw error;
    }
  },
};
