import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { ArtStatus, PlaceKind } from "@thataway/db/enums";
import { db, place, placeArt } from "@/db/postgres";
import { ArtContentType, ArtModel, LogNamespace } from "@/utils/enums";
import { BadRequestError, NotFoundError } from "@/utils/errors";
import { createLogger } from "@/utils/logger";

import { buildArtPrompt } from "./prompt";
import { ArtStorage } from "./storage";

const logger = createLogger(LogNamespace.Art);

/** A job the worker gave up on this often stays failed until someone requeues it by hand. */
const MAX_ATTEMPTS = 3;
/** A claim older than this is a worker that died mid-picture: the job goes back to the queue. */
const CLAIM_TIMEOUT_MS = 30 * 60 * 1000;

export interface ArtJob {
  placeId: string;
  name: string;
  description: string | null;
  kind: PlaceKind;
  prompt: string;
  referenceImageUrl: string | null;
  referenceImageLicense: string | null;
}

export interface ArtUpload {
  bytes: Uint8Array;
  model: ArtModel;
  seed?: number;
  anchorX: number;
  width: number;
  height: number;
}

/** Width and height from a PNG's IHDR chunk: the first chunk, right after the signature. */
const pngSize = (bytes: Uint8Array): { width: number; height: number } => {
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 24 || Buffer.from(bytes.subarray(0, 8)).toString("hex") !== signature) {
    throw new BadRequestError("Not a PNG file");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

export const ArtService = {
  /**
   * Asks for pictures of these places, most notable first. A place already queued, drawn or
   * given up on is left alone; the worker takes the queue down in priority order.
   */
  async enqueue(candidates: { id: string; priority: number }[]): Promise<number> {
    if (!ArtStorage.enabled() || candidates.length === 0) return 0;
    const rows = await db
      .insert(placeArt)
      .values(candidates.map(({ id, priority }) => ({ placeId: id, priority })))
      .onConflictDoNothing()
      .returning({ placeId: placeArt.placeId });
    if (rows.length > 0) logger.info("queued", { places: rows.length });
    return rows.length;
  },

  /** Puts a failed or finished place back in the queue (a redraw, by hand). */
  async requeue(placeId: string, priority = 0): Promise<void> {
    await db
      .insert(placeArt)
      .values({ placeId, priority, status: ArtStatus.Queued })
      .onConflictDoUpdate({
        target: placeArt.placeId,
        set: { status: ArtStatus.Queued, priority, attempts: 0, error: null, claimedAt: null },
      });
  },

  /** The next place to draw, marked as taken; null when the queue is empty. */
  async claim(): Promise<ArtJob | null> {
    // A worker that died takes its job with it: give those back first
    await db
      .update(placeArt)
      .set({ status: ArtStatus.Queued, claimedAt: null })
      .where(
        and(
          eq(placeArt.status, ArtStatus.Generating),
          lt(placeArt.claimedAt, new Date(Date.now() - CLAIM_TIMEOUT_MS)),
        ),
      );
    return db.transaction(async (tx) => {
      const [next] = await tx
        .select({
          placeId: placeArt.placeId,
          name: place.name,
          description: place.description,
          kind: place.kind,
          imageUrl: place.imageUrl,
          imageLicense: place.imageLicense,
        })
        .from(placeArt)
        .innerJoin(place, eq(place.id, placeArt.placeId))
        .where(eq(placeArt.status, ArtStatus.Queued))
        .orderBy(desc(placeArt.priority), placeArt.createdAt)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!next) return null;
      const prompt = buildArtPrompt({
        name: next.name,
        description: next.description,
        kind: next.kind,
      });
      await tx
        .update(placeArt)
        .set({
          status: ArtStatus.Generating,
          claimedAt: new Date(),
          attempts: sql`${placeArt.attempts} + 1`,
          prompt,
          sourceImageUrl: next.imageUrl,
          sourceImageLicense: next.imageLicense,
        })
        .where(eq(placeArt.placeId, next.placeId));
      logger.info("claimed", { placeId: next.placeId, name: next.name });
      return {
        placeId: next.placeId,
        name: next.name,
        description: next.description,
        kind: next.kind,
        prompt,
        referenceImageUrl: next.imageUrl,
        referenceImageLicense: next.imageLicense,
      };
    });
  },

  /** Stores the finished picture in the bucket and points the place at it. */
  async complete(placeId: string, upload: ArtUpload): Promise<string> {
    const [row] = await db
      .select({ status: placeArt.status })
      .from(placeArt)
      .where(eq(placeArt.placeId, placeId));
    if (!row) throw new NotFoundError(`No art job for ${placeId}`);
    const { width, height } = pngSize(upload.bytes);
    const version = createHash("sha256").update(upload.bytes).digest("hex").slice(0, 10);
    const key = `${placeId}/${version}.png`;
    await ArtStorage.put(key, upload.bytes, ArtContentType.Png);
    const url = ArtStorage.publicUrl(key);
    await db.transaction(async (tx) => {
      await tx
        .update(placeArt)
        .set({
          status: ArtStatus.Ready,
          error: null,
          claimedAt: null,
          objectKey: key,
          model: upload.model,
          seed: upload.seed ?? null,
          anchorX: upload.anchorX,
          width,
          height,
        })
        .where(eq(placeArt.placeId, placeId));
      await tx.update(place).set({ artUrl: url }).where(eq(place.id, placeId));
    });
    logger.info("art stored", {
      placeId,
      model: upload.model,
      width,
      height,
      kilobytes: Math.round(upload.bytes.length / 1024),
    });
    return url;
  },

  /** The worker could not draw this one; after a few tries it stays failed. */
  async fail(placeId: string, error: string): Promise<void> {
    const [row] = await db
      .select({ attempts: placeArt.attempts })
      .from(placeArt)
      .where(eq(placeArt.placeId, placeId));
    if (!row) throw new NotFoundError(`No art job for ${placeId}`);
    const status = row.attempts >= MAX_ATTEMPTS ? ArtStatus.Failed : ArtStatus.Queued;
    await db
      .update(placeArt)
      .set({ status, error: error.slice(0, 2000), claimedAt: null })
      .where(eq(placeArt.placeId, placeId));
    logger.warn("art failed", { placeId, attempts: row.attempts, status, error });
  },

  /** Among these places, the ones with no picture and no job yet, for `enqueue`. */
  async withoutArt(placeIds: string[]): Promise<Set<string>> {
    if (placeIds.length === 0) return new Set();
    const rows = await db
      .select({ id: place.id })
      .from(place)
      .leftJoin(placeArt, eq(placeArt.placeId, place.id))
      .where(
        and(
          inArray(place.id, placeIds),
          isNull(place.artUrl),
          or(isNull(placeArt.placeId), eq(placeArt.status, ArtStatus.Queued)),
        ),
      );
    return new Set(rows.map((row) => row.id));
  },

  /** A picture made elsewhere (by hand, in a chat), stored as if the worker had drawn it. */
  async putManual(placeId: string, bytes: Uint8Array): Promise<string> {
    await this.requeue(placeId);
    const { width, height } = pngSize(bytes);
    return this.complete(placeId, { bytes, model: ArtModel.Manual, anchorX: 0.5, width, height });
  },
};
