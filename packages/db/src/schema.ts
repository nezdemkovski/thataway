import { sql } from "drizzle-orm";
import {
  boolean,
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
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

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
  // When page views and photo credits last landed; null while the enrich job is still due
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  // When the tile was last asked for or taken by a worker
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  placeCount: integer("place_count").default(0).notNull(),
  error: text("error"),
});

// ─── Places ──────────────────────────────────────────────────────────────────
// What the app shows. One row per Wikidata item with coordinates that passed the class filter.

export const place = pgTable(
  "place",
  {
    // Wikidata item id, "Q12345": stable, language-free
    id: text("id").primaryKey(),
    source: text("source", { enum: enumValues(PlaceSource) })
      .notNull()
      .default(PlaceSource.Wikidata),
    name: text("name").notNull(),
    // Wikidata's one-liner ("Gothic bridge in Prague")
    description: text("description"),
    kind: text("kind", { enum: enumValues(PlaceKind) })
      .notNull()
      .default(PlaceKind.Place),
    // The item's `instance of` classes, "Q16970" and friends: what the kind and the filter were decided on
    classes: text("classes").array().notNull().default([]),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    geom: geographyPoint("geom").notNull(),
    // The tile the point falls in, so a refill can replace a tile's places
    geohash: text("geohash").notNull(),
    // How many language editions have an article: the fame signal that needs no traffic
    sitelinks: integer("sitelinks").default(0).notNull(),
    // Listed as cultural heritage (P1435)
    heritage: boolean("heritage").default(false).notNull(),
    // English Wikipedia article, when there is one
    enwikiTitle: text("enwiki_title"),
    // English page views over the last few days
    views: integer("views").default(0).notNull(),
    viewsUpdatedAt: timestamp("views_updated_at", { withTimezone: true }),
    // Commons image (P18): a thumbnail and the credit its licence asks for
    imageFile: text("image_file"),
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
    index("place_sitelinks_idx").on(sql`${t.sitelinks} DESC`),
  ],
);

// ─── Wikidata classes ────────────────────────────────────────────────────────
// Which of our root classes a Wikidata class sits under ("Catholic cathedral" → place of
// worship → kind church). Resolved once per class through the subclass tree and kept, so a
// new tile only asks about classes nobody has seen before.

export const wikidataClass = pgTable("wikidata_class", {
  id: text("id").primaryKey(),
  label: text("label"),
  roots: text("roots").array().notNull().default([]),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Illustrations ───────────────────────────────────────────────────────────

/**
 * The generated illustration of a place, served by GET /art/:id. Kept in the database for
 * now: a few hundred kilobytes per place, and nothing else to run or back up.
 */
export const placeArt = pgTable("place_art", {
  placeId: text("place_id")
    .primaryKey()
    .references(() => place.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  bytes: bytea("bytes").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  // Short hash of the bytes, part of art_url so a replaced picture gets a new URL
  version: text("version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
