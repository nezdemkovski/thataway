import { getConfig } from "@/config";
import { HttpHeader, LogNamespace } from "@/utils/enums";
import { TooManyRequestsError } from "@/utils/errors";
import { type BoundingBox, quadrants } from "@/utils/geohash";
import { createLogger } from "@/utils/logger";

import { ALL_ROOT_IDS } from "./roots";
import { commonsFileName, entityId, parsePoint, wikipediaTitle } from "./parse";

const logger = createLogger(LogNamespace.Wikidata);

/** An item with coordinates inside a box, as the SPARQL endpoint describes it. */
export interface WikidataItem {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  sitelinks: number;
  /** `instance of` class ids */
  classes: string[];
  heritage: boolean;
  imageFile: string | null;
  enwikiTitle: string | null;
}

interface SparqlBinding {
  [variable: string]: { type: string; value: string; "xml:lang"?: string } | undefined;
}

interface SparqlResponse {
  results: { bindings: SparqlBinding[] };
}

const ENDPOINT = "https://query.wikidata.org/sparql";
const PAUSE_MS = 400;
/** Classes per roots query, and how many such queries run at once (the service allows five). */
const ROOTS_BATCH = 50;
const ROOTS_PARALLEL = 3;
/** How many times a box is cut in four when the query service cannot answer it in 60 s. */
const MAX_SPLITS = 2;

/** The query service gave up on the query, not on us: a smaller box will do. */
class QueryTimeout extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class WikidataClient {
  private readonly userAgent: string;

  constructor() {
    const { wikimediaContact } = getConfig();
    this.userAgent = `Thataway/0.1 (places backend; ${wikimediaContact ?? "no contact set"})`;
  }

  /**
   * Every item with coordinates inside the box that at least `minSitelinks` language editions
   * write about. One query per tile; grouping by item folds multiple classes, images and
   * coordinates into one row. A box too dense for the service's 60 s (a capital's centre) is
   * cut in four and asked for piece by piece.
   */
  async itemsInBox(box: BoundingBox, minSitelinks = 2, splits = 0): Promise<WikidataItem[]> {
    try {
      return await this.itemsInOneBox(box, minSitelinks);
    } catch (error) {
      if (!(error instanceof QueryTimeout) || splits >= MAX_SPLITS) throw error;
      logger.warn("box too dense for one query, splitting", { box, splits: splits + 1 });
      const seen = new Map<string, WikidataItem>();
      for (const part of quadrants(box)) {
        for (const item of await this.itemsInBox(part, minSitelinks, splits + 1)) {
          seen.set(item.id, item);
        }
        await sleep(PAUSE_MS);
      }
      return [...seen.values()];
    }
  }

  private async itemsInOneBox(box: BoundingBox, minSitelinks: number): Promise<WikidataItem[]> {
    const query = `
      SELECT ?item ?sitelinks
        (SAMPLE(?coord) AS ?point)
        (SAMPLE(?enLabel) AS ?label)
        (SAMPLE(?enDescription) AS ?description)
        (SAMPLE(?image) AS ?picture)
        (SAMPLE(?heritage) AS ?listed)
        (SAMPLE(?article) AS ?enwiki)
        (GROUP_CONCAT(DISTINCT STR(?class); separator=" ") AS ?classes)
      WHERE {
        SERVICE wikibase:box {
          ?item wdt:P625 ?coord .
          bd:serviceParam wikibase:cornerSouthWest "Point(${box.west} ${box.south})"^^geo:wktLiteral .
          bd:serviceParam wikibase:cornerNorthEast "Point(${box.east} ${box.north})"^^geo:wktLiteral .
        }
        ?item wikibase:sitelinks ?sitelinks .
        FILTER(?sitelinks >= ${minSitelinks})
        OPTIONAL { ?item wdt:P31 ?class . }
        OPTIONAL { ?item rdfs:label ?enLabel . FILTER(LANG(?enLabel) = "en") }
        OPTIONAL { ?item schema:description ?enDescription . FILTER(LANG(?enDescription) = "en") }
        OPTIONAL { ?item wdt:P18 ?image . }
        OPTIONAL { ?item wdt:P1435 ?heritage . }
        OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
      }
      GROUP BY ?item ?sitelinks`;
    const bindings = await this.sparql(query);
    const items: WikidataItem[] = [];
    for (const row of bindings) {
      const point = row.point?.value ? parsePoint(row.point.value) : null;
      if (!row.item || !point) continue;
      const id = entityId(row.item.value);
      items.push({
        id,
        name: row.label?.value ?? id,
        description: row.description?.value ?? null,
        latitude: point.latitude,
        longitude: point.longitude,
        sitelinks: Number(row.sitelinks?.value ?? 0),
        classes: (row.classes?.value ?? "").split(" ").filter(Boolean).map(entityId),
        heritage: Boolean(row.listed?.value),
        imageFile: row.picture?.value ? commonsFileName(row.picture.value) : null,
        enwikiTitle: row.enwiki?.value ? wikipediaTitle(row.enwiki.value) : null,
      });
    }
    return items;
  }

  /**
   * For each class, which of our root classes it sits under in the subclass tree, plus its
   * English label. Fifty classes per query, a few queries in flight: walking P279* is the
   * slow part of a first visit to a big city (Paris brings 550 classes nobody has resolved).
   */
  async rootsOf(
    classIds: string[],
  ): Promise<Map<string, { label: string | null; roots: string[] }>> {
    const result = new Map<string, { label: string | null; roots: string[] }>();
    for (const id of classIds) result.set(id, { label: null, roots: [] });
    const batches: string[][] = [];
    for (let start = 0; start < classIds.length; start += ROOTS_BATCH) {
      batches.push(classIds.slice(start, start + ROOTS_BATCH));
    }
    for (let start = 0; start < batches.length; start += ROOTS_PARALLEL) {
      const wave = batches.slice(start, start + ROOTS_PARALLEL);
      const answers = await Promise.all(wave.map((batch) => this.rootsBatch(batch)));
      for (const rows of answers) {
        for (const row of rows) {
          if (!row.class) continue;
          const entry = result.get(entityId(row.class.value));
          if (!entry) continue;
          if (row.label?.value) entry.label = row.label.value;
          if (row.root?.value) entry.roots.push(entityId(row.root.value));
        }
      }
      await sleep(PAUSE_MS);
    }
    return result;
  }

  private rootsBatch(batch: string[]): Promise<SparqlBinding[]> {
    return this.sparql(`
      SELECT ?class ?root (SAMPLE(?enLabel) AS ?label) WHERE {
        VALUES ?class { ${batch.map((id) => `wd:${id}`).join(" ")} }
        OPTIONAL { ?class rdfs:label ?enLabel . FILTER(LANG(?enLabel) = "en") }
        OPTIONAL {
          VALUES ?root { ${ALL_ROOT_IDS.map((id) => `wd:${id}`).join(" ")} }
          ?class wdt:P279* ?root .
        }
      }
      GROUP BY ?class ?root`);
  }

  private async sparql(query: string, attempt = 0): Promise<SparqlBinding[]> {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        [HttpHeader.UserAgent]: this.userAgent,
        [HttpHeader.Accept]: "application/sparql-results+json",
        [HttpHeader.ContentType]: "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query }),
    });
    if (response.status === 429 || response.status === 503) {
      const retryAfter = Number(response.headers.get(HttpHeader.RetryAfter)) || 15;
      if (attempt < 2) {
        logger.warn("query service busy, waiting", { status: response.status, retryAfter });
        await sleep(retryAfter * 1000);
        return this.sparql(query, attempt + 1);
      }
      throw new TooManyRequestsError("Wikidata asked us to slow down", retryAfter);
    }
    if (!response.ok) {
      const text = await response.text();
      if (response.status === 500 && text.includes("TimeoutException")) {
        throw new QueryTimeout("Wikidata query timed out");
      }
      throw new Error(`Wikidata answered ${response.status}: ${text.slice(0, 200)}`);
    }
    const body = (await response.json()) as SparqlResponse;
    return body.results.bindings;
  }
}
