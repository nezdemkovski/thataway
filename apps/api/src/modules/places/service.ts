import { sql } from "drizzle-orm";

import { PlaceKind } from "@thataway/db/enums";
import { db } from "@/db/postgres";
import { TileService } from "@/modules/tiles/service";

export interface PlaceDTO {
  /** Wikidata item id, "Q12345" */
  id: string;
  name: string;
  description: string | null;
  kind: PlaceKind;
  latitude: number;
  longitude: number;
  /** Metres from the query point */
  distance: number;
  /** Language editions with an article: fame that needs no traffic */
  sitelinks: number;
  heritage: boolean;
  /** English page views over the last few days */
  views: number;
  enwikiTitle: string | null;
  imageUrl: string | null;
  imageAuthor: string | null;
  imageLicense: string | null;
  artUrl: string | null;
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
    // Fame first: how many languages write about it, lifted by English page views and by a
    // heritage listing; then distance taxes it, about 4x the fame per kilometre.
    const rows = await db.execute<PlaceRow>(sql`
      SELECT
        id, name, description, kind, latitude, longitude,
        ST_Distance(geom, ${point}) AS distance,
        sitelinks, heritage, views,
        enwiki_title AS "enwikiTitle", image_url AS "imageUrl", image_author AS "imageAuthor",
        image_license AS "imageLicense", art_url AS "artUrl"
      FROM place
      WHERE ST_DWithin(geom, ${point}, ${radius})
      ORDER BY
        0.8 * ln(sitelinks + 1) + 0.4 * ln(views + 1) + (CASE WHEN heritage THEN 0.5 ELSE 0 END)
          - ST_Distance(geom, ${point}) / 1000 * 0.6 DESC
      LIMIT ${limit}
    `);
    return {
      warming: !ready,
      places: rows.rows.map((row): PlaceDTO => ({
        id: row.id,
        name: row.name,
        description: row.description,
        kind: row.kind,
        latitude: row.latitude,
        longitude: row.longitude,
        distance: Math.round(Number(row.distance)),
        sitelinks: row.sitelinks,
        heritage: row.heritage,
        views: row.views,
        enwikiTitle: row.enwikiTitle,
        imageUrl: row.imageUrl,
        imageAuthor: row.imageAuthor,
        imageLicense: row.imageLicense,
        artUrl: row.artUrl,
      })),
    };
  },
};
