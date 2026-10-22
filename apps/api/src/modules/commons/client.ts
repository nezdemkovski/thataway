import { getConfig } from "@/config";
import { stripTags } from "@/modules/wikidata/parse";
import { HttpHeader } from "@/utils/enums";

/** A thumbnail and the credit its licence asks for. */
export interface ImageCredit {
  url: string;
  author: string | null;
  license: string | null;
}

interface ImageInfoResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    pages?: {
      title: string;
      imageinfo?: {
        thumburl?: string;
        extmetadata?: Record<string, { value: string }>;
      }[];
    }[];
  };
}

const ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const THUMB_WIDTH = 640;
const PAUSE_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class CommonsClient {
  private readonly userAgent: string;

  constructor() {
    const { wikimediaContact } = getConfig();
    this.userAgent = `Thataway/0.1 (places backend; ${wikimediaContact ?? "no contact set"})`;
  }

  /** Credits by file name, fifty files per call. Files Commons no longer has are left out. */
  async credits(files: string[]): Promise<Map<string, ImageCredit>> {
    const credits = new Map<string, ImageCredit>();
    for (let start = 0; start < files.length; start += 50) {
      const batch = files.slice(start, start + 50);
      const url = new URL(ENDPOINT);
      for (const [key, value] of Object.entries({
        action: "query",
        format: "json",
        formatversion: "2",
        titles: batch.map((file) => `File:${file}`).join("|"),
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: String(THUMB_WIDTH),
        iiextmetadatafilter: "Artist|LicenseShortName",
      })) {
        url.searchParams.set(key, value);
      }
      const response = await fetch(url, { headers: { [HttpHeader.UserAgent]: this.userAgent } });
      if (!response.ok) throw new Error(`Commons answered ${response.status}`);
      const body = (await response.json()) as ImageInfoResponse;
      // The API may normalise a title; map the answer back to what was asked
      const asked = new Map<string, string>();
      for (const file of batch) asked.set(`File:${file}`, file);
      for (const { from, to } of body.query?.normalized ?? []) {
        const original = asked.get(from);
        if (original) asked.set(to, original);
      }
      for (const page of body.query?.pages ?? []) {
        const info = page.imageinfo?.[0];
        const file = asked.get(page.title);
        if (!info?.thumburl || !file) continue;
        const artist = info.extmetadata?.Artist?.value;
        credits.set(file, {
          url: info.thumburl,
          author: artist ? stripTags(artist) || null : null,
          license: info.extmetadata?.LicenseShortName?.value ?? null,
        });
      }
      await sleep(PAUSE_MS);
    }
    return credits;
  }
}
