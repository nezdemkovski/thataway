import { t } from "elysia";

import { PlaceKind } from "@thataway/db/enums";

/** Query of GET /places: where you stand, and how far you are willing to walk. */
export const placesQuery = t.Object({
  lat: t.Number({ minimum: -90, maximum: 90 }),
  lon: t.Number({ minimum: -180, maximum: 180 }),
  radius: t.Optional(t.Integer({ minimum: 100, maximum: 10_000, default: 2_500 })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 200, default: 60 })),
});

/** One place as the app sees it. Mirrors `PlaceDTO` and `Place` in packages/api-client/spec.yaml. */
export const place = t.Object({
  id: t.String({ description: "Wikidata item id" }),
  name: t.String(),
  description: t.Nullable(t.String()),
  kind: t.Enum(PlaceKind),
  latitude: t.Number(),
  longitude: t.Number(),
  distance: t.Integer({ description: "Metres from the query point" }),
  sitelinks: t.Integer(),
  heritage: t.Boolean(),
  views: t.Integer(),
  enwikiTitle: t.Nullable(t.String()),
  imageUrl: t.Nullable(t.String()),
  imageAuthor: t.Nullable(t.String()),
  imageLicense: t.Nullable(t.String()),
  artUrl: t.Nullable(t.String()),
});

/** Body of GET /places. */
export const placesResponse = t.Object({
  warming: t.Boolean({
    description:
      "Places, page views or photos around the point are still on their way; ask again in a few seconds",
  }),
  places: t.Array(place),
});

/** What every failed request answers with. */
export const errorResponse = t.Object({
  error: t.String(),
  message: t.String(),
});
