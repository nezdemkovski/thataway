import { Elysia, ElysiaStatus, NotFound, ParseError, ValidationError, status } from "elysia";
import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";

import { getConfig } from "@/config";
import { closeDb } from "@/db/postgres";
import { routes } from "@/routes";
import { HttpHeader, RoutePath } from "@/utils/enums";
import { AppError, TooManyRequestsError } from "@/utils/errors";
import logger from "@/utils/logger";
import { getBoss, stopBoss } from "@/utils/pgBoss";
import { registerFillTile } from "@/workers/fillTile";
import pkg from "../package.json" with { type: "json" };

const { port, postgresUrl, wikimediaContact } = getConfig();

if (!postgresUrl) {
  logger.error("POSTGRES_URL is not set");
  process.exit(1);
}
if (!wikimediaContact) {
  logger.warn("WIKIMEDIA_CONTACT is not set: Wikipedia requests carry no contact");
}

const boss = await getBoss();
await registerFillTile(boss);
logger.info("pg-boss started");

const app = new Elysia({ name: "thataway-api" })
  .use(
    openapi({
      // The served document is for browsing; the contract the clients are generated from is
      // packages/api-client/spec.yaml
      documentation: {
        info: {
          title: "Thataway API",
          description: "Places worth walking to around a point, most notable first.",
          version: pkg.version,
        },
      },
    }),
  )
  .use(cors())
  .error(({ error, path, request, set }) => {
    if (error instanceof ElysiaStatus) return error;
    if (error instanceof NotFound && path === RoutePath.Favicon) return status(204, null);

    if (error instanceof AppError) {
      if (error.statusCode >= 500) logger.exception(error, { path, method: request.method });
      if (error instanceof TooManyRequestsError && error.retryAfterSeconds) {
        set.headers[HttpHeader.RetryAfter] = String(error.retryAfterSeconds);
      }
      return status(error.statusCode, { error: error.errorType, message: error.message });
    }
    if (error instanceof NotFound) {
      return status(404, { error: "Not Found", message: "Resource not found" });
    }
    // Elysia 2 answers validation errors with 422; the app expects 400 with { error, message }
    if (error instanceof ValidationError || error instanceof ParseError) {
      return status(400, { error: "Validation Error", message: error.message });
    }
    logger.exception(error, { path, method: request.method });
    return status(500, { error: "Internal Server Error", message: "Something went wrong" });
  })
  .use(routes)
  .listen(port);

logger.info(`Thataway API listening on http://localhost:${port}`);

const shutdown = async () => {
  logger.info("shutting down");
  await app.stop();
  await stopBoss();
  await closeDb();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
