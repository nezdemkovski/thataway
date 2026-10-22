import type { PgBoss } from "pg-boss";

import { FillTileJob, QUEUES } from "@thataway/db/jobs";
import { TileService } from "@/modules/tiles/service";

/** Fills tiles one at a time: Wikipedia is a shared resource, not a race. */
export const registerFillTile = async (boss: PgBoss) => {
  await boss.work<FillTileJob>(QUEUES.FILL_TILE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await TileService.fill(job.data.geohash, job.data.force);
    }
  });
};
