# CLAUDE.md

Guidance for Claude Code in this repository. The conventions are playdamnit's; when in doubt,
do what `~/Sites/playdamnit` does.

## Monorepo

Bun workspaces + Turborepo. Use **Bun** only (never npm, node, pnpm or yarn).

| Path                | Package              | What                                                      |
| ------------------- | -------------------- | --------------------------------------------------------- |
| `apps/api`          | `@thataway/api`      | Elysia 2 HTTP API (Bun) with the in-process tile worker   |
| `packages/db`       | `@thataway/db`       | Drizzle schema, enums, migrations, migrator, job contract |
| `packages/tsconfig` | `@thataway/tsconfig` | Shared tsconfig for Bun services                          |

Workspace packages are imported by name (`@thataway/db/schema`, `@thataway/db/jobs`, ...), never
with relative paths across packages.

### No string literals for closed sets

Never write a value from a closed set (status, kind, header name, log namespace, queue name,
...) as a string literal. Use a TypeScript string `enum`: shared ones in
`packages/db/src/enums.ts` (`enumValues(E)` feeds Drizzle's `text(..., { enum })`), API-local
ones in `apps/api/src/utils/enums.ts`, queue names in `packages/db/src/jobs.ts`.

### Commands (repo root)

```bash
bun install          # one lockfile for everything
bun run db:up        # local PostGIS (docker-compose.dev.yml, port 5433)
bun run db:migrate   # apply migrations (POSTGRES_URL from apps/api/.env)
bun run dev          # API with hot reload
bun run typecheck
bun run test
bun run lint         # oxlint (lint:fix to autofix)
bun run format       # oxfmt (format:check in CI)
bun run db:generate  # new migration after changing packages/db/src/schema.ts
bun run warm -- --bbox south,west,north,east   # queue fills for every tile in a box
```

## Architecture

The database is the source of truth; Wikipedia only fills it.

- **Tiles**: the world cut into geohash-5 cells (about 4.9 × 4.9 km). A `tile` row exists only
  once someone has been there. `GET /places` asks for the tile under the point and its eight
  neighbours; missing or stale ones (30 days) are queued, and the first caller gets up to four
  seconds for the fill before an answer with `warming: true`.
- **Filling** (`src/modules/tiles/service.ts`): geosearch by the tile's bounding box, 500 pages
  per call; a box that fills up is split into quarters (`src/modules/wikipedia/client.ts`).
  Pages pass `isPlace` (kind word in the Wikidata description, mirrored from the iOS app), get
  a kind from `guessKind`, and five-day page views in batches of fifty. Rows are upserted into
  `place` with a PostGIS point; the fill runs as a pg-boss job (`fill-tile`, one at a time,
  singleton per tile).
- **Serving** (`src/modules/places/service.ts`): `ST_DWithin` around the point, ordered in SQL by
  `log(views+1) + 0.3·log(length) − km·0.6`.
- Routes are file-based in `src/routes/` (one file per method, options before the handler),
  logic in `src/modules/*/service.ts`, request schemas in `src/modules/*/model.ts`. Services
  throw `AppError` subclasses (`src/utils/errors.ts`); the global `.error()` in `src/index.ts`
  maps them to `{ error, message }`.
- Migrations: `packages/db/migrations/<timestamp>_<name>/{migration.sql,snapshot.json}`
  (drizzle-kit v1). The first one creates the PostGIS extension by hand. The Docker entrypoint
  applies migrations on start.
