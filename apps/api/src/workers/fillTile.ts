import type { PgBoss } from "pg-boss";

import { EnrichTileJob, FillTileJob, QUEUES } from "@thataway/db/jobs";
import { TileService } from "@/modules/tiles/service";

/**
 * Fills tiles one at a time (Wikidata is a shared resource, not a race) and, beside that,
 * enriches filled tiles with page views and photo credits one at a time (Wikipedia and
 * Commons are other services, so the two lines move independently).
 */
export const registerFillTile = async (boss: PgBoss) => {
  await boss.work<FillTileJob>(QUEUES.FILL_TILE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await TileService.fill(job.data.geohash, job.data.force);
    }
  });
  await boss.work<EnrichTileJob>(QUEUES.ENRICH_TILE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await TileService.enrich(job.data.geohash);
    }
  });
};
