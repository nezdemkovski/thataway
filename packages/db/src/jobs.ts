// Contract between the API and its workers: pg-boss queues and their payloads.
// Keep it dependency-free.

export const QUEUES = {
  // Fill one geohash tile with places from Wikipedia
  FILL_TILE: "fill-tile",
} as const;

export const ALL_QUEUES = Object.values(QUEUES);

export interface FillTileJob {
  /** Geohash of the tile, at TILE_PRECISION characters */
  geohash: string;
  /** Fill again even if the tile is ready (warm-ups and nightly refreshes) */
  force?: boolean;
}

/** Geohash length of a tile: 5 characters is a cell of about 4.9 × 4.9 km. */
export const TILE_PRECISION = 5;

/** A ready tile is trusted for this long before someone passing by refills it. */
export const TILE_TTL_DAYS = 30;
