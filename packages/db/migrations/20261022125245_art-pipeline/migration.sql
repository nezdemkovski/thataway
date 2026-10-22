ALTER TABLE "place_art" ADD COLUMN "status" text DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "priority" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "object_key" text;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "anchor_x" double precision;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "source_image_url" text;--> statement-breakpoint
ALTER TABLE "place_art" ADD COLUMN "source_image_license" text;--> statement-breakpoint
ALTER TABLE "place_art" DROP COLUMN "content_type";--> statement-breakpoint
ALTER TABLE "place_art" DROP COLUMN "bytes";--> statement-breakpoint
ALTER TABLE "place_art" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "place_art" ALTER COLUMN "width" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "place_art" ALTER COLUMN "height" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "place_art_status_idx" ON "place_art" ("status","priority" DESC);--> statement-breakpoint
-- Pictures stored in the database so far are redrawn by the worker into the bucket
UPDATE "place" SET "art_url" = NULL WHERE "art_url" IS NOT NULL;--> statement-breakpoint
UPDATE "place_art" SET "status" = 'queued', "priority" = 100;
