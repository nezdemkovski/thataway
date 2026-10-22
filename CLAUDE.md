# CLAUDE.md

Guidance for Claude Code in this repository. The conventions are playdamnit's; when in doubt,
do what `~/Sites/playdamnit` does.

## Monorepo

Bun workspaces + Turborepo. Use **Bun** only (never npm, node, pnpm or yarn).

| Path                  | Package                | What                                                               |
| --------------------- | ---------------------- | ------------------------------------------------------------------ |
| `apps/api`            | `@thataway/api`        | Elysia 2 HTTP API (Bun) with the in-process tile worker            |
| `packages/db`         | `@thataway/db`         | Drizzle schema, enums, migrations, migrator, job contract          |
| `packages/api-client` | `@thataway/api-client` | `spec.yaml`: the OpenAPI contract the iOS client is generated from |
| `packages/tsconfig`   | `@thataway/tsconfig`   | Shared tsconfig for Bun services                                   |

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
- **Filling** (`src/modules/tiles/service.ts`): one SPARQL box query to Wikidata
  (`src/modules/wikidata/client.ts`) for every item with coordinates that at least two language
  editions write about, with its classes, image, heritage status and English article. Classes
  are walked up the subclass tree to our root classes (`src/modules/wikidata/roots.ts`) and the
  verdicts cached in `wikidata_class`. A kind root (bridge, square, castle, place of worship, ...)
  names the glyph and wins outright: Wikidata files bridges and squares under "thoroughfare" and
  castles under "administrative entity". Only an item matching no kind is dropped when it sits
  under an excluded root (person, event, settlement, organisation, street, river, station, ...).
  The cache only knows the roots that existed when a class was resolved: after editing
  `roots.ts`, `TRUNCATE wikidata_class` and refill (`bun run warm -- --bbox ... --force`). Wikipedia only adds
  Rows are upserted into `place` with a PostGIS point and the tile is served from then on; the
  fill runs as a pg-boss job (`fill-tile`, one at a time, exclusive per tile, the walker's own
  tile first). A centre too dense for one SPARQL query (Paris) is cut in four and asked for
  piece by piece. A second job (`enrich-tile`) then adds Wikipedia's five-day page views by
  title and the Commons thumbnail with author and licence, and stamps `tile.enriched_at`;
  `warming` in the answer stays true until that has landed.
- **Serving** (`src/modules/places/service.ts`): `ST_DWithin` around the point, ordered in SQL by
  `0.8·ln(sitelinks+1) + 0.4·ln(views+1) + 0.5·heritage − km·0.6`.
- **Illustrations**: `place_art` holds a generated PNG per place (alpha, landmark facing the
  viewer; the prompt is in `docs/art-prompt.md`), served by `GET /art/:id.png?v=<hash>` with a
  forever cache; `place.art_url` points at it. `bun run art -- --place Q204871 --file x.png`
  stores one; `PUBLIC_URL` says which host the URL carries.
- Routes are file-based in `src/routes/` (one file per method, options before the handler),
  logic in `src/modules/*/service.ts`, request schemas in `src/modules/*/model.ts`. Services
  throw `AppError` subclasses (`src/utils/errors.ts`); the global `.error()` in `src/index.ts`
  maps them to `{ error, message }`.
- Migrations: `packages/db/migrations/<timestamp>_<name>/{migration.sql,snapshot.json}`
  (drizzle-kit v1). The first one creates the PostGIS extension by hand. The Docker entrypoint
  applies migrations on start.
