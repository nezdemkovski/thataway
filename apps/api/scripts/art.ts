// Stores a generated illustration for a place and points its art_url at it.
//   PUBLIC_URL=https://thataway.example bun run art --place Q204871 --file charles.png
// The file is a PNG with alpha, the landmark facing the viewer (see docs/art-prompt.md).
import { parseArgs } from "node:util";

import { ArtService } from "@/modules/art/service";
import { closeDb } from "@/db/postgres";

const { values } = parseArgs({ options: { place: { type: "string" }, file: { type: "string" } } });
if (!values.place || !values.file) {
  console.error("usage: bun run art --place Q12345 --file picture.png");
  process.exit(1);
}
const bytes = Buffer.from(await Bun.file(values.file).arrayBuffer());
const url = await ArtService.put(values.place, bytes);
console.log(`${values.place} -> ${url}`);
await closeDb();
