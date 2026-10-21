import { getConfig } from "@/config";
import { HttpHeader, LogNamespace } from "@/utils/enums";
import { createLogger } from "@/utils/logger";
import { TooManyRequestsError } from "@/utils/errors";
import type { BoundingBox } from "@/utils/geohash";

const logger = createLogger(LogNamespace.Wikipedia);

/** A page as geosearch returns it, before any judgement. */
export interface WikipediaPage {
  pageid: number;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  length: number;
}

interface GeoResponse {
  query?: {
    pages?: {
      pageid: number;
      title: string;
      description?: string;
      coordinates?: { lat: number; lon: number }[];
      length?: number;
    }[];
  };
  error?: { code: string; info: string };
}

interface ViewsResponse {
  query?: { pages?: { pageid: number; pageviews?: Record<string, number | null> }[] };
  continue?: Record<string, string>;
}

/** Geosearch gives at most this many pages per box; a box that hits it gets split. */
export const BOX_LIMIT = 500;
/** How many times a dense box may be split into quarters before we accept missing pages. */
const MAX_SPLIT_DEPTH = 4;
/** Breathing room between calls, so one tile never looks like a scraper. */
const PAUSE_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class WikipediaClient {
  private readonly endpoint: string;
  private readonly userAgent: string;

  constructor(readonly language = "en") {
    const { wikimediaContact } = getConfig();
    this.endpoint = `https://${language}.wikipedia.org/w/api.php`;
    this.userAgent = `Thataway/0.1 (places backend; ${wikimediaContact ?? "no contact set"})`;
  }

  /**
   * Every page with coordinates inside the box. Geosearch answers with the nearest 500, so a
   * box that fills up is cut into quarters and asked again, down to a few hundred metres.
   */
  async pagesInBox(box: BoundingBox, depth = 0): Promise<WikipediaPage[]> {
    const response = await this.query<GeoResponse>({
      generator: "geosearch",
      ggsbbox: `${box.north}|${box.west}|${box.south}|${box.east}`,
      ggslimit: String(BOX_LIMIT),
      prop: "coordinates|description|info",
      colimit: "max",
    });
    const pages = (response.query?.pages ?? []).flatMap((page) => {
      const point = page.coordinates?.[0];
      if (!point) return [];
      return [
        {
          pageid: page.pageid,
          title: page.title,
          description: page.description,
          latitude: point.lat,
          longitude: point.lon,
          length: page.length ?? 0,
        },
      ];
    });
    if (pages.length < BOX_LIMIT || depth >= MAX_SPLIT_DEPTH) {
      return pages;
    }
    logger.info("box is dense, splitting", { depth, pages: pages.length });
    const midLat = (box.south + box.north) / 2;
    const midLon = (box.west + box.east) / 2;
    const quarters: BoundingBox[] = [
      { south: box.south, west: box.west, north: midLat, east: midLon },
      { south: box.south, west: midLon, north: midLat, east: box.east },
      { south: midLat, west: box.west, north: box.north, east: midLon },
      { south: midLat, west: midLon, north: box.north, east: box.east },
    ];
    const seen = new Map<number, WikipediaPage>();
    for (const quarter of quarters) {
      await sleep(PAUSE_MS);
      for (const page of await this.pagesInBox(quarter, depth + 1)) {
        seen.set(page.pageid, page);
      }
    }
    return [...seen.values()];
  }

  /** Views over the last `days` days by page id, fifty pages per call. */
  async pageviews(ids: number[], days = 5): Promise<Map<number, number>> {
    const views = new Map<number, number>();
    for (let start = 0; start < ids.length; start += 50) {
      const batch = ids.slice(start, start + 50);
      let parameters: Record<string, string> = {
        pageids: batch.join("|"),
        prop: "pageviews",
        pvipdays: String(days),
      };
      // A reply carries about 500 day-values; fifty pages at five days fit in one, but follow
      // the continuation just in case.
      for (let round = 0; round < 3; round += 1) {
        const response = await this.query<ViewsResponse>(parameters);
        for (const page of response.query?.pages ?? []) {
          if (page.pageviews) {
            const total = Object.values(page.pageviews).reduce<number>(
              (sum, v) => sum + (v ?? 0),
              0,
            );
            views.set(page.pageid, total);
          }
        }
        if (!response.continue) break;
        parameters = { ...parameters, ...response.continue };
      }
      await sleep(PAUSE_MS);
    }
    return views;
  }

  private async query<T>(parameters: Record<string, string>): Promise<T> {
    const url = new URL(this.endpoint);
    for (const [key, value] of Object.entries({
      ...parameters,
      action: "query",
      format: "json",
      formatversion: "2",
    })) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, { headers: { [HttpHeader.UserAgent]: this.userAgent } });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get(HttpHeader.RetryAfter)) || 60;
      throw new TooManyRequestsError("Wikipedia asked us to slow down", retryAfter);
    }
    if (!response.ok) {
      throw new Error(`Wikipedia answered ${response.status}`);
    }
    const body = (await response.json()) as T & { error?: { code: string; info: string } };
    if (body.error) {
      throw new Error(`Wikipedia error ${body.error.code}: ${body.error.info}`);
    }
    return body;
  }
}
