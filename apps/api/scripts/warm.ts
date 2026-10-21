// Queues a fill for every tile in a bounding box, so the first visitors to a city never wait.
//   bun run warm --bbox 50.03,14.35,50.12,14.50      (south,west,north,east)
import { parseArgs } from "node:util";

import { TILE_PRECISION } from "@thataway/db/jobs";
import { TileService } from "@/modules/tiles/service";
import { geohashesCovering } from "@/utils/geohash";
import { closeDb } from "@/db/postgres";
import { stopBoss } from "@/utils/pgBoss";

const { values } = parseArgs({ options: { bbox: { type: "string" }, force: { type: "boolean" } } });
const parts = values.bbox?.split(",").map(Number) ?? [];
if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
  console.error("usage: bun run warm --bbox south,west,north,east [--force]");
  process.exit(1);
}
const [south, west, north, east] = parts as [number, number, number, number];
const tiles = geohashesCovering({ south, west, north, east }, TILE_PRECISION);
await TileService.requestFill(tiles, values.force ?? false);
console.log(`Queued ${tiles.length} tiles`);
await stopBoss();
await closeDb();
