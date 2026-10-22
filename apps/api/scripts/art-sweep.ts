// Queues pictures for the most notable places that have none, across every filled tile.
//   bun run art:sweep -- --limit 200
import { parseArgs } from "node:util";
import { isNull, sql } from "drizzle-orm";

import { ArtService } from "@/modules/art/service";
import { closeDb, db, place } from "@/db/postgres";

const { values } = parseArgs({ options: { limit: { type: "string" } } });
const limit = Number(values.limit) || 200;
const rows = await db
  .select({
    id: place.id,
    priority: sql<number>`0.8 * ln(${place.sitelinks} + 1) + 0.4 * ln(${place.views} + 1) + (CASE WHEN ${place.heritage} THEN 0.5 ELSE 0 END)`,
  })
  .from(place)
  .where(isNull(place.artUrl))
  .orderBy(sql`2 DESC`)
  .limit(limit);
const open = await ArtService.withoutArt(rows.map((row) => row.id));
const queued = await ArtService.enqueue(
  rows
    .filter((row) => open.has(row.id))
    .map((row) => ({ id: row.id, priority: Number(row.priority) })),
);
console.log(`Queued ${queued} of ${rows.length} places`);
await closeDb();
