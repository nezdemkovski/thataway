import { Elysia } from "elysia";

import { getConfig } from "@/config";
import { HttpHeader } from "@/utils/enums";
import { UnauthorizedError } from "@/utils/errors";

/**
 * `worker: true` on a route lets only the art worker in: a bearer token shared through
 * 1Password. No token configured means no worker, whatever it sends.
 */
export const workerAuth = new Elysia({ name: "worker-auth" }).macro({
  worker: {
    beforeHandle({ request }) {
      const { artWorkerToken } = getConfig();
      const header = request.headers.get(HttpHeader.Authorization) ?? "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!artWorkerToken || token !== artWorkerToken) {
        throw new UnauthorizedError("Art worker token required");
      }
    },
  },
});
