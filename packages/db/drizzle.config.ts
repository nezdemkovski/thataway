import { defineConfig } from "drizzle-kit";

// `generate`/`check` only diff the schema against migrations; a real URL is needed for
// studio/push. Studio gets it from apps/api/.env (see package.json scripts).
const dbUrl = process.env.POSTGRES_URL ?? "postgresql://localhost:5432/unused";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
  // PostGIS keeps its own tables; drizzle-kit must not try to manage them
  tablesFilter: ["!spatial_ref_sys"],
  extensionsFilters: ["postgis"],
});
