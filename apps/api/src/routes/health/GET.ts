import { Elysia } from "elysia";
import { sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { healthResponse } from "@/modules/health/model";
import { HealthStatus } from "@/utils/enums";

export const getHealth = new Elysia().get(
  "/health",
  {
    detail: {
      operationId: "getHealth",
      tags: ["health"],
      summary: "The service and the database behind it",
    },
    response: { 200: healthResponse, 503: healthResponse },
  },
  async ({ set }) => {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: HealthStatus.Ok };
    } catch {
      set.status = 503;
      return { status: HealthStatus.Degraded };
    }
  },
);
