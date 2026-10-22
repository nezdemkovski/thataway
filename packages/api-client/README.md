# @thataway/api-client

`spec.yaml` is the API contract: OpenAPI 3.0, maintained by hand with every route change. The
routes in `apps/api` carry the same typebox schemas, and `apps/api/tests/openapi.test.ts` keeps
the enums and the place fields from drifting apart.

The iOS app generates its Swift client from it with
[swift-openapi-generator](https://github.com/apple/swift-openapi-generator):
`scripts/sync-openapi.sh` in `~/Apps/Thataway` copies the file and regenerates. Run it after
every change here.
