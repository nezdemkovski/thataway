// Pure helpers for what Wikidata's SPARQL endpoint hands back.

/** "http://www.wikidata.org/entity/Q12345" → "Q12345" */
export const entityId = (uri: string): string => uri.slice(uri.lastIndexOf("/") + 1);

/** "Point(14.42 50.08)" → { latitude: 50.08, longitude: 14.42 } */
export const parsePoint = (wkt: string): { latitude: number; longitude: number } | null => {
  const match = /Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(wkt);
  if (!match) return null;
  return { latitude: Number(match[2]), longitude: Number(match[1]) };
};

/** "http://commons.wikimedia.org/wiki/Special:FilePath/Karl%C5%AFv%20most.jpg" → "Karlův most.jpg" */
export const commonsFileName = (uri: string): string =>
  decodeURIComponent(uri.slice(uri.lastIndexOf("/") + 1)).replace(/_/g, " ");

/** "https://en.wikipedia.org/wiki/Charles_Bridge" → "Charles Bridge" */
export const wikipediaTitle = (uri: string): string =>
  decodeURIComponent(uri.slice(uri.indexOf("/wiki/") + 6)).replace(/_/g, " ");

/** Commons gives the author as HTML; the credit line wants plain text. */
export const stripTags = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
