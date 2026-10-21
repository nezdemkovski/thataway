// Closed sets of string values shared by the API and its workers. Never write these as
// string literals; `enumValues(E)` feeds Drizzle's `text(..., { enum })`.

export const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [T[keyof T], ...T[keyof T][]];

/** Where a tile is in its life: asked for, being filled, filled, or given up on. */
export enum TileStatus {
  Pending = "pending",
  Filling = "filling",
  Ready = "ready",
  Failed = "failed",
}

/** What a place looks like on the map; the app draws a glyph per kind. */
export enum PlaceKind {
  Church = "church",
  Tower = "tower",
  Bridge = "bridge",
  Museum = "museum",
  Park = "park",
  Monument = "monument",
  Square = "square",
  Castle = "castle",
  Place = "place",
}

/** Where a place row came from. */
export enum PlaceSource {
  Wikipedia = "wikipedia",
}
