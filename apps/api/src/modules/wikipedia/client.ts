import { getConfig } from "@/config";
import { HttpHeader, LogNamespace } from "@/utils/enums";
import { TooManyRequestsError } from "@/utils/errors";
import { createLogger } from "@/utils/logger";

const logger = createLogger(LogNamespace.Wikipedia);

interface ViewsResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    pages?: { title: string; pageviews?: Record<string, number | null> }[];
  };
  continue?: Record<string, string>;
}

const PAUSE_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What is left of Wikipedia's role: page views, the fame signal that moves with the news. */
export class WikipediaClient {
  private readonly endpoint: string;
  private readonly userAgent: string;

  constructor(readonly language = "en") {
    const { wikimediaContact } = getConfig();
    this.endpoint = `https://${language}.wikipedia.org/w/api.php`;
    this.userAgent = `Thataway/0.1 (places backend; ${wikimediaContact ?? "no contact set"})`;
  }

  /**
   * Views over the last `days` days by article title. Fifty titles per call; under load the
   * API sometimes answers for only some of them without saying so, so whatever is still
   * missing is asked for once more in small batches.
   */
  async pageviews(titles: string[], days = 5): Promise<Map<string, number>> {
    const views = await this.pageviewsBatched(titles, 50, days);
    const missing = titles.filter((title) => !views.has(title));
    if (missing.length > 0) {
      logger.info("retrying page views", { missing: missing.length, of: titles.length });
      await sleep(PAUSE_MS * 4);
      for (const [title, total] of await this.pageviewsBatched(missing, 10, days)) {
        views.set(title, total);
      }
    }
    return views;
  }

  private async pageviewsBatched(
    titles: string[],
    size: number,
    days: number,
  ): Promise<Map<string, number>> {
    const views = new Map<string, number>();
    for (let start = 0; start < titles.length; start += size) {
      const batch = titles.slice(start, start + size);
      let parameters: Record<string, string> = {
        titles: batch.join("|"),
        prop: "pageviews",
        pvipdays: String(days),
      };
      const asked = new Map(batch.map((title) => [title, title]));
      // A reply carries about 500 day-values; fifty titles at five days fit in one, but follow
      // the continuation just in case.
      for (let round = 0; round < 3; round += 1) {
        const response = await this.query<ViewsResponse>(parameters);
        for (const { from, to } of response.query?.normalized ?? []) {
          const original = asked.get(from);
          if (original) asked.set(to, original);
        }
        for (const page of response.query?.pages ?? []) {
          const title = asked.get(page.title);
          if (title && page.pageviews) {
            const total = Object.values(page.pageviews).reduce<number>(
              (sum, v) => sum + (v ?? 0),
              0,
            );
            views.set(title, total);
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
    if (!response.ok) throw new Error(`Wikipedia answered ${response.status}`);
    return (await response.json()) as T;
  }
}
