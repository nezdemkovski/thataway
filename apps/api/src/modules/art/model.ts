import { t } from "elysia";

/** Path of GET /art/:id: the place's Wikidata id with the file extension clients expect. */
export const artParams = t.Object({
  file: t.String({ pattern: "^Q\\d+\\.png$", description: "Wikidata id plus .png" }),
});
