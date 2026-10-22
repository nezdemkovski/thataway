import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

import { getConfig } from "@/config";
import { db, place, placeArt } from "@/db/postgres";
import { ArtContentType, LogNamespace } from "@/utils/enums";
import { BadRequestError, NotFoundError } from "@/utils/errors";
import { createLogger } from "@/utils/logger";

const logger = createLogger(LogNamespace.Art);

export interface ArtFile {
  contentType: ArtContentType;
  bytes: Buffer;
  width: number;
  height: number;
}

/** Width and height from a PNG's IHDR chunk: the first chunk, right after the signature. */
const pngSize = (bytes: Buffer): { width: number; height: number } => {
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== signature) {
    throw new BadRequestError("Not a PNG file");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

export const ArtService = {
  /** The URL a place's illustration is served at; the version keeps caches honest. */
  urlFor(placeId: string, version: string): string {
    return `${getConfig().publicUrl}/art/${placeId}.png?v=${version}`;
  },

  /** Stores (or replaces) the illustration of a place and points `place.art_url` at it. */
  async put(placeId: string, bytes: Buffer): Promise<string> {
    const [row] = await db.select({ id: place.id }).from(place).where(eq(place.id, placeId));
    if (!row) throw new NotFoundError(`No place ${placeId}`);
    const { width, height } = pngSize(bytes);
    const version = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
    const url = this.urlFor(placeId, version);
    await db.transaction(async (tx) => {
      await tx
        .insert(placeArt)
        .values({ placeId, contentType: ArtContentType.Png, bytes, width, height, version })
        .onConflictDoUpdate({
          target: placeArt.placeId,
          set: { contentType: ArtContentType.Png, bytes, width, height, version },
        });
      await tx.update(place).set({ artUrl: url }).where(eq(place.id, placeId));
    });
    logger.info("art stored", {
      placeId,
      width,
      height,
      kilobytes: Math.round(bytes.length / 1024),
    });
    return url;
  },

  async get(placeId: string): Promise<ArtFile> {
    const [row] = await db
      .select({
        contentType: placeArt.contentType,
        bytes: placeArt.bytes,
        width: placeArt.width,
        height: placeArt.height,
      })
      .from(placeArt)
      .where(eq(placeArt.placeId, placeId));
    if (!row) throw new NotFoundError(`No art for ${placeId}`);
    return { ...row, contentType: row.contentType as ArtContentType };
  },
};
