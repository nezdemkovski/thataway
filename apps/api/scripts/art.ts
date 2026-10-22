// Stores a picture made elsewhere (by hand, in a chat) for a place, or queues places for the
// worker to draw.
//   bun run art -- --place Q204871 --file charles.png     a finished PNG with alpha
//   bun run art -- --place Q204871 --queue                 let the worker draw it (again)
import { parseArgs } from "node:util";

import { ArtService } from "@/modules/art/service";
import { closeDb } from "@/db/postgres";

const { values } = parseArgs({
  options: { place: { type: "string" }, file: { type: "string" }, queue: { type: "boolean" } },
});
if (!values.place || (!values.file && !values.queue)) {
  console.error("usage: bun run art -- --place Q12345 (--file picture.png | --queue)");
  process.exit(1);
}
if (values.file) {
  const bytes = new Uint8Array(await Bun.file(values.file).arrayBuffer());
  console.log(`${values.place} -> ${await ArtService.putManual(values.place, bytes)}`);
} else {
  await ArtService.requeue(values.place, 100);
  console.log(`${values.place} queued`);
}
await closeDb();
