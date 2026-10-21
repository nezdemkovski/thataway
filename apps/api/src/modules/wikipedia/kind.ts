import { PlaceKind } from "@thataway/db/enums";

// What a place looks like on the map, guessed from its title and one-line description.
// Mirrors `LandmarkKind.guess` in the iOS app. Order matters: the first match wins.
const RULES: [PlaceKind, string[]][] = [
  [PlaceKind.Bridge, ["bridge", "viaduct"]],
  [PlaceKind.Castle, ["castle", "fortress", "fort ", "citadel", "walls"]],
  [
    PlaceKind.Church,
    [
      "church",
      "cathedral",
      "basilica",
      "chapel",
      "synagogue",
      "mosque",
      "temple",
      "abbey",
      "monastery",
      "minster",
    ],
  ],
  [
    PlaceKind.Tower,
    ["tower", "clock", "gate", "observatory", "lighthouse", "skyscraper", "belfry"],
  ],
  [
    PlaceKind.Museum,
    [
      "museum",
      "gallery",
      "library",
      "theatre",
      "theater",
      "opera",
      "palace",
      "university",
      "hall",
      "parliament",
      "court",
      "academy",
      "station",
    ],
  ],
  [
    PlaceKind.Park,
    ["park", "garden", "hill", "island", "zoo", "cemetery", "forest", "river", "lake"],
  ],
  [
    PlaceKind.Monument,
    ["statue", "sculpture", "memorial", "monument", "column", "obelisk", "fountain"],
  ],
  [PlaceKind.Square, ["square", "plaza", "market", "street", "embankment", "promenade"]],
];

export const guessKind = (title: string, description: string | null | undefined): PlaceKind => {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  for (const [kind, words] of RULES) {
    if (words.some((word) => text.includes(word))) return kind;
  }
  return PlaceKind.Place;
};
