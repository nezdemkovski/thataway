import { Elysia } from "elysia";

import { errorResponse, placesQuery, placesResponse } from "@/modules/places/model";
import { PlacesService } from "@/modules/places/service";
import { HttpHeader } from "@/utils/enums";

export const getPlaces = new Elysia().get(
  "/places",
  {
    detail: {
      operationId: "getPlaces",
      tags: ["places"],
      summary: "Places around a point, most notable first",
    },
    query: placesQuery,
    response: { 200: placesResponse, 400: errorResponse, 429: errorResponse, 500: errorResponse },
  },
  async ({ query, set }) => {
    const result = await PlacesService.around(
      query.lat,
      query.lon,
      query.radius ?? 2_500,
      query.limit ?? 60,
    );
    // A warming answer is partial: nobody should cache it
    set.headers[HttpHeader.CacheControl] = result.warming ? "no-store" : "public, max-age=300";
    return result;
  },
);
