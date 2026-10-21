import { sql } from "drizzle-orm";
import {
  customType,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { PlaceKind, PlaceSource, TileStatus, enumValues } from "./enums";

/** A PostGIS point on the sphere, written and read as WKT. */
const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point, 4326)";
  },
  toDriver(value) {
    return value;
  },
});

// ─── Tiles ───────────────────────────────────────────────────────────────────
// The world cut into geohash cells. A row exists only once someone has been there.

export const tile = pgTable("tile", {
  geohash: text("geohash").primaryKey(),
  status: text("status", { enum: enumValues(TileStatus) })
    .notNull()
    .default(TileStatus.Pending),
  // When the fill finished; a tile older than TILE_TTL_DAYS is refilled on the next visit
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  placeCount: integer("place_count").default(0).notNull(),
  error: text("error"),
});

// ─── Places ──────────────────────────────────────────────────────────────────
// What the app shows. One row per Wikipedia page for now; `wikidata_id` is there for the day
// Wikidata becomes the source.

export const place = pgTable(
  "place",
  {
    // English Wikipedia page id: stable across title changes
    id: integer("id").primaryKey(),
    source: text("source", { enum: enumValues(PlaceSource) })
      .notNull()
      .default(PlaceSource.Wikipedia),
    wikidataId: text("wikidata_id"),
    language: text("language").notNull().default("en"),
    title: text("title").notNull(),
    // Title without Wikipedia's disambiguation suffix: "Jewish Town Hall (Prague)" → "Jewish Town Hall"
    name: text("name").notNull(),
    // Wikidata's one-liner ("Gothic bridge in Prague")
    description: text("description"),
    kind: text("kind", { enum: enumValues(PlaceKind) })
      .notNull()
      .default(PlaceKind.Place),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    geom: geographyPoint("geom").notNull(),
    // The tile the point falls in, so a refill can replace a tile's places
    geohash: text("geohash").notNull(),
    // Page views over the last few days: the fame signal
    views: integer("views").default(0).notNull(),
    viewsUpdatedAt: timestamp("views_updated_at", { withTimezone: true }),
    articleLength: integer("article_length").default(0).notNull(),
    imageUrl: text("image_url"),
    imageAuthor: text("image_author"),
    imageLicense: text("image_license"),
    // A generated illustration, once there is a pipeline for it
    artUrl: text("art_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("place_geom_idx").using("gist", t.geom),
    index("place_geohash_idx").on(t.geohash),
    index("place_views_idx").on(sql`${t.views} DESC`),
  ],
);
