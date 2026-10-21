import { sql } from "drizzle-orm";

import { PlaceKind } from "@thataway/db/enums";
import { db } from "@/db/postgres";
import { TileService } from "@/modules/tiles/service";

export interface PlaceDTO {
  id: number;
  title: string;
  name: string;
  description: string | null;
  kind: PlaceKind;
  latitude: number;
  longitude: number;
  /** Metres from the query point */
  distance: number;
  views: number;
  articleLength: number;
  imageUrl: string | null;
  artUrl: string | null;
  language: string;
}

type PlaceRow = Record<string, unknown> & PlaceDTO;

export interface PlacesResult {
  /** Tiles around the point are still being filled: ask again in a few seconds */
  warming: boolean;
  places: PlaceDTO[];
}

export const PlacesService = {
  async around(
    latitude: number,
    longitude: number,
    radius: number,
    limit: number,
  ): Promise<PlacesResult> {
    const { ready } = await TileService.ensureAround(latitude, longitude);
    const point = sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
    // Fame wins, distance taxes it: 1 km away costs about 4x the page views. Article length
    // breaks ties and stands in when views are missing. Same formula as the app had.
    const rows = await db.execute<PlaceRow>(sql`
      SELECT
        id, title, name, description, kind, latitude, longitude,
        ST_Distance(geom, ${point}) AS distance,
        views, article_length AS "articleLength", image_url AS "imageUrl", art_url AS "artUrl", language
      FROM place
      WHERE ST_DWithin(geom, ${point}, ${radius})
      ORDER BY
        log(views + 1) + 0.3 * log(greatest(article_length, 1)) - ST_Distance(geom, ${point}) / 1000 * 0.6 DESC
      LIMIT ${limit}
    `);
    return {
      warming: !ready,
      places: rows.rows.map((row): PlaceDTO => ({
        id: row.id,
        title: row.title,
        name: row.name,
        description: row.description,
        kind: row.kind,
        latitude: row.latitude,
        longitude: row.longitude,
        distance: Math.round(Number(row.distance)),
        views: row.views,
        articleLength: row.articleLength,
        imageUrl: row.imageUrl,
        artUrl: row.artUrl,
        language: row.language,
      })),
    };
  },
};
