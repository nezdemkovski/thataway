import { Elysia } from "elysia";

import { placesQuery } from "@/modules/places/model";
import { PlacesService } from "@/modules/places/service";
import { HttpHeader } from "@/utils/enums";

export const getPlaces = new Elysia().get(
  "/places",
  { query: placesQuery },
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
