CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE "place" (
	"id" integer PRIMARY KEY,
	"source" text DEFAULT 'wikipedia' NOT NULL,
	"wikidata_id" text,
	"language" text DEFAULT 'en' NOT NULL,
	"title" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'place' NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"geom" geography(Point,4326) NOT NULL,
	"geohash" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"views_updated_at" timestamp with time zone,
	"article_length" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"image_author" text,
	"image_license" text,
	"art_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tile" (
	"geohash" text PRIMARY KEY,
	"status" text DEFAULT 'pending' NOT NULL,
	"fetched_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"place_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "place_geom_idx" ON "place" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "place_geohash_idx" ON "place" ("geohash");--> statement-breakpoint
CREATE INDEX "place_views_idx" ON "place" ("views" DESC);