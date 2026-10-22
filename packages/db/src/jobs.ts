// Contract between the API and its workers: pg-boss queues and their payloads.
// Keep it dependency-free.

export const QUEUES = {
  // Fill one geohash tile with places from Wikidata: the map can draw after this
  FILL_TILE: "fill-tile",
  // Add page views and photo credits to a filled tile: the ranking and the sheet get better
  ENRICH_TILE: "enrich-tile",
} as const;

export const ALL_QUEUES = Object.values(QUEUES);

/** pg-boss queue policies we use (its `QueuePolicy` is a string union). */
export enum QueuePolicy {
  /** One job per singletonKey, queued or active: a tile is filled once however many ask */
  Exclusive = "exclusive",
}

export const QUEUE_POLICIES: Record<(typeof ALL_QUEUES)[number], QueuePolicy> = {
  [QUEUES.FILL_TILE]: QueuePolicy.Exclusive,
  [QUEUES.ENRICH_TILE]: QueuePolicy.Exclusive,
};

export interface FillTileJob {
  /** Geohash of the tile, at TILE_PRECISION characters */
  geohash: string;
  /** Fill again even if the tile is ready (warm-ups and nightly refreshes) */
  force?: boolean;
}

export interface EnrichTileJob {
  geohash: string;
}

/** Geohash length of a tile: 5 characters is a cell of about 4.9 × 4.9 km. */
export const TILE_PRECISION = 5;

/** A ready tile is trusted for this long before someone passing by refills it. */
export const TILE_TTL_DAYS = 30;
