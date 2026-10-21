import { Elysia } from "elysia";
import { sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { HealthStatus } from "@/utils/enums";

export const getHealth = new Elysia().get("/health", async ({ set }) => {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: HealthStatus.Ok };
  } catch {
    set.status = 503;
    return { status: HealthStatus.Degraded };
  }
});
