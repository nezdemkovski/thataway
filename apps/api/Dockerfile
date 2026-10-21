# Build context: repository root
#   docker build -f apps/api/Dockerfile .
FROM oven/bun:1.4 AS pruner
WORKDIR /repo
COPY . .
# Keep only the API and the workspace packages it depends on
RUN bunx turbo@2.11.7 prune @thataway/api --docker

FROM oven/bun:1.4 AS runner
WORKDIR /repo

COPY --from=pruner /repo/out/json/ .
RUN bun install --frozen-lockfile --production
COPY --from=pruner /repo/out/full/ .

WORKDIR /repo/apps/api

ENV PORT=3040
ENV NODE_ENV=production
ENV RUN_MIGRATIONS=true

EXPOSE 3040

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3040) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

RUN chmod +x entrypoint.sh
ENTRYPOINT ["/repo/apps/api/entrypoint.sh"]
