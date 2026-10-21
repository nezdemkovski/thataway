import { fileURLToPath } from "node:url";

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Runtime migrator (drizzle-kit is a dev tool and not needed in images)
export const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export const runMigrations = async (url: string) => {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
};

if (import.meta.main) {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL is not set");
    process.exit(1);
  }
  await runMigrations(url);
  console.log("Migrations applied");
}
