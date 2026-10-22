import { inArray } from "drizzle-orm";

import { db, wikidataClass } from "@/db/postgres";
import { LogNamespace } from "@/utils/enums";
import { createLogger } from "@/utils/logger";

import type { WikidataClient } from "./client";

const logger = createLogger(LogNamespace.Wikidata);

/** Which roots each class sits under, from the cache first and the query service for the rest. */
export const ClassService = {
  async rootsOf(client: WikidataClient, classIds: string[]): Promise<Map<string, string[]>> {
    const unique = [...new Set(classIds)];
    const roots = new Map<string, string[]>();
    if (unique.length === 0) return roots;

    const known = await db
      .select({ id: wikidataClass.id, roots: wikidataClass.roots })
      .from(wikidataClass)
      .where(inArray(wikidataClass.id, unique));
    for (const row of known) roots.set(row.id, row.roots);

    const missing = unique.filter((id) => !roots.has(id));
    if (missing.length > 0) {
      logger.info("resolving classes", { count: missing.length });
      const resolved = await client.rootsOf(missing);
      await db
        .insert(wikidataClass)
        .values(
          [...resolved.entries()].map(([id, entry]) => ({
            id,
            label: entry.label,
            roots: entry.roots,
          })),
        )
        .onConflictDoNothing();
      for (const [id, entry] of resolved) roots.set(id, entry.roots);
    }
    return roots;
  },
};
