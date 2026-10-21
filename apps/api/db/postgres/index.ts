import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { getConfig } from "@/config";

const { postgresUrl } = getConfig();

if (!postgresUrl) {
  throw new Error("POSTGRES_URL is not set");
}

// One pool per process: Drizzle and pg-boss share it. Connections open lazily on first use.
export const pool = new Pool({ connectionString: postgresUrl, max: 10 });

export const db = drizzle({ client: pool });

export const closeDb = () => pool.end();

export * from "@thataway/db/schema";
