// Geosearch returns streets, firms and schools too; nobody strolls toward a tax office.
// It also pins whole cities, kingdoms and events to a square: you can't walk to those either.
//
// Wikidata descriptions read "<what> in <where>", so only the "<what>" part is judged, by
// whole words in the singular: "Czech Republic" must not sink every square in Prague.
// Mirrors `Landmark.isPlace` in the iOS app; keep the two lists the same until the app reads
// kinds from here.

const NOT_PLACES = new Set([
  "street",
  "avenue",
  "road",
  "company",
  "business",
  "corporation",
  "firm",
  "bank",
  "brand",
  "school",
  "hotel",
  "restaurant",
  "shop",
  "mall",
  "office",
  "embassy",
  "organization",
  "organisation",
  "institution",
  "newspaper",
  "magazine",
  "band",
  "club",
  "agency",
  "ministry",
  "city",
  "capital",
  "town",
  "village",
  "settlement",
  "municipality",
  "district",
  "borough",
  "quarter",
  "neighbourhood",
  "neighborhood",
  "region",
  "area",
  "province",
  "county",
  "country",
  "kingdom",
  "state",
  "empire",
  "republic",
  "duchy",
  "monarchy",
  "dynasty",
  "protectorate",
  "land",
  "crown",
  "territory",
  "realm",
  "principality",
  "margraviate",
  "electorate",
  "confederation",
  "union",
  "diocese",
  "archdiocese",
  "polity",
  "government",
  "parliament",
  "station",
  "execution",
  "revolt",
  "uprising",
  "battle",
  "siege",
  "war",
  "election",
  "murder",
  "shooting",
  "attack",
  "massacre",
  "accident",
  "disaster",
  "fire",
  "flood",
  "rebellion",
  "revolution",
  "coup",
  "championship",
  "tournament",
  "association",
  "federation",
  "festival",
  "event",
  "person",
  "university",
  "college",
  "academy",
  "faculty",
  "institute",
]);

const singular = (word: string) => {
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
};

export const isPlace = (description: string | null | undefined): boolean => {
  if (!description) return true;
  const kind = description.toLowerCase().split(" in ")[0] ?? "";
  const words = kind
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map(singular);
  return !words.some((word) => NOT_PLACES.has(word));
};

/** Title without Wikipedia's disambiguation suffix: "Jewish Town Hall (Prague)" → "Jewish Town Hall". */
export const displayName = (title: string): string => {
  if (!title.endsWith(")")) return title;
  const open = title.lastIndexOf("(");
  return open > 0 ? title.slice(0, open).trim() : title;
};
