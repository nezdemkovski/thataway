# Thataway API

The places service behind the Thataway iOS app: what is worth walking to around a point, ranked.
Wikidata fills a database lazily, one geohash tile at a time (Wikipedia adds page views, Commons
the image credits); everyone after the first visitor reads from the database.

```bash
bun install
cp apps/api/.env.example apps/api/.env   # set WIKIMEDIA_CONTACT
bun run db:up && bun run db:migrate
bun run dev
curl 'localhost:3040/places?lat=50.0875&lon=14.4213'
```

`GET /places?lat&lon&radius=2500&limit=60` answers `{ warming, places: [...] }`; while tiles
around the point are still being filled, `warming` is true and the list may be short. The contract is
`packages/api-client/spec.yaml` (the iOS client is generated from it); the served document
lives at `/openapi`. Warm a city ahead of time with
`bun run warm -- --bbox 50.03,14.35,50.12,14.50`.

Runs anywhere Postgres has PostGIS: `docker compose up` for the production-like stack. See
`CLAUDE.md` for the layout and the conventions.
