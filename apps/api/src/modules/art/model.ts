import { t } from "elysia";

import { PlaceKind } from "@thataway/db/enums";
import { ArtModel } from "@/utils/enums";

/** Path of the worker's job routes. */
export const artJobParams = t.Object({
  id: t.String({ pattern: "^Q\\d+$", description: "Wikidata id of the place" }),
});

/** What the worker gets to draw: the place, the full prompt, and the photo to draw from. */
export const artJob = t.Object({
  placeId: t.String(),
  name: t.String(),
  description: t.Nullable(t.String()),
  kind: t.Enum(PlaceKind),
  prompt: t.String(),
  referenceImageUrl: t.Nullable(t.String()),
  referenceImageLicense: t.Nullable(t.String()),
});

/** The finished picture: a PNG with alpha, cut to the landmark, plus what made it. */
export const artComplete = t.Object({
  // A PNG: the service checks the signature itself
  file: t.File({ maxSize: "8m" }),
  model: t.Enum(ArtModel),
  seed: t.Optional(t.Numeric()),
  anchorX: t.Numeric({ minimum: 0, maximum: 1 }),
  width: t.Numeric({ minimum: 1 }),
  height: t.Numeric({ minimum: 1 }),
});

export const artFail = t.Object({
  error: t.String({ maxLength: 2000 }),
});

export const artResult = t.Object({
  placeId: t.String(),
  artUrl: t.String(),
});
