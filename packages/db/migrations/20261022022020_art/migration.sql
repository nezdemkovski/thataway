CREATE TABLE "place_art" (
	"place_id" text PRIMARY KEY,
	"content_type" text NOT NULL,
	"bytes" bytea NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_art" ADD CONSTRAINT "place_art_place_id_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "place"("id") ON DELETE CASCADE;