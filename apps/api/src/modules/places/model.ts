import { t } from "elysia";

/** Query of GET /places: where you stand, and how far you are willing to walk. */
export const placesQuery = t.Object({
  lat: t.Number({ minimum: -90, maximum: 90 }),
  lon: t.Number({ minimum: -180, maximum: 180 }),
  radius: t.Optional(t.Integer({ minimum: 100, maximum: 10_000, default: 2_500 })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 200, default: 60 })),
});
