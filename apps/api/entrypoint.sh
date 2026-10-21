#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running migrations..."
  bun run ../../packages/db/src/migrate.ts
else
  echo "Skipping migrations"
fi

echo "Starting application..."
exec bun run src/index.ts
