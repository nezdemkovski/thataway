import { PlaceKind } from "@thataway/db/enums";

// The handful of Wikidata classes everything is judged against. An item's `instance of`
// classes are walked up the subclass tree once (and cached); landing under an excluded root
// drops the item, landing under a kind root names its glyph. The first kind in this list wins.
//
// The cache in `wikidata_class` only knows the roots that existed when a class was resolved:
// after adding a root here, `TRUNCATE wikidata_class` so the next fills resolve again.

export interface RootClass {
  id: string;
  label: string;
}

/** Things with coordinates that nobody walks to: people, events, cities, companies, streets. */
export const EXCLUDED_ROOTS: RootClass[] = [
  { id: "Q5", label: "human" },
  { id: "Q1190554", label: "occurrence" },
  { id: "Q43229", label: "organization" },
  { id: "Q56061", label: "administrative territorial entity" },
  { id: "Q486972", label: "human settlement" },
  { id: "Q123705", label: "neighbourhood" },
  { id: "Q2983893", label: "quarter" },
  { id: "Q83620", label: "thoroughfare" },
  { id: "Q4022", label: "river" },
  { id: "Q11446", label: "ship" },
  { id: "Q1248784", label: "airport" },
  { id: "Q719456", label: "station" },
  { id: "Q55488", label: "railway station" },
  { id: "Q928830", label: "metro station" },
];

/** What a place looks like on the map, by the root its classes fall under. Order is priority. */
export const KIND_ROOTS: { kind: PlaceKind; roots: RootClass[] }[] = [
  { kind: PlaceKind.Bridge, roots: [{ id: "Q12280", label: "bridge" }] },
  {
    kind: PlaceKind.Castle,
    roots: [
      { id: "Q23413", label: "castle" },
      { id: "Q57821", label: "fortification" },
    ],
  },
  {
    kind: PlaceKind.Church,
    roots: [
      { id: "Q1370598", label: "place of worship" },
      { id: "Q44613", label: "monastery" },
    ],
  },
  {
    kind: PlaceKind.Tower,
    roots: [
      { id: "Q12518", label: "tower" },
      { id: "Q53060", label: "gate" },
    ],
  },
  {
    kind: PlaceKind.Museum,
    roots: [
      { id: "Q33506", label: "museum" },
      { id: "Q24354", label: "theatre" },
      { id: "Q7075", label: "library" },
      { id: "Q16560", label: "palace" },
    ],
  },
  {
    kind: PlaceKind.Park,
    roots: [
      { id: "Q22698", label: "park" },
      { id: "Q1107656", label: "garden" },
      { id: "Q39614", label: "cemetery" },
      { id: "Q4421", label: "forest" },
      { id: "Q23397", label: "lake" },
      { id: "Q54050", label: "hill" },
      { id: "Q8502", label: "mountain" },
      { id: "Q23442", label: "island" },
    ],
  },
  {
    kind: PlaceKind.Monument,
    roots: [
      { id: "Q4989906", label: "monument" },
      { id: "Q179700", label: "statue" },
      { id: "Q860861", label: "sculpture" },
      { id: "Q5003624", label: "memorial" },
      { id: "Q483453", label: "fountain" },
    ],
  },
  { kind: PlaceKind.Square, roots: [{ id: "Q174782", label: "square" }] },
];

export const ALL_ROOT_IDS = [
  ...EXCLUDED_ROOTS.map((root) => root.id),
  ...KIND_ROOTS.flatMap((entry) => entry.roots.map((root) => root.id)),
];

const EXCLUDED_IDS = new Set(EXCLUDED_ROOTS.map((root) => root.id));

/** An item is out when any of its classes sits under an excluded root. */
export const isExcluded = (roots: Iterable<string>): boolean => {
  for (const root of roots) if (EXCLUDED_IDS.has(root)) return true;
  return false;
};

/** The glyph for an item, from the roots its classes sit under; the first kind root wins. */
export const kindFor = (roots: Iterable<string>): PlaceKind | null => {
  const found = new Set(roots);
  for (const entry of KIND_ROOTS) {
    if (entry.roots.some((root) => found.has(root.id))) return entry.kind;
  }
  return null;
};

/**
 * Keep or drop, and what it looks like. A kind root wins over an exclusion: in Wikidata a
 * bridge is also a thoroughfare, a square a thoroughfare and a region, a castle an
 * administrative entity. Only an item that matches no kind is judged by the exclusions.
 */
export const decide = (roots: Iterable<string>): PlaceKind | null => {
  const collected = [...roots];
  const kind = kindFor(collected);
  if (kind) return kind;
  return isExcluded(collected) ? null : PlaceKind.Place;
};
