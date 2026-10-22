import { Elysia } from "elysia";

import { workerAuth } from "@/lib/workerAuth";
import { artFail, artJobParams } from "@/modules/art/model";
import { ArtService } from "@/modules/art/service";

/** The worker could not draw the place. */
export const postArtFail = new Elysia().use(workerAuth).post(
  "/art/jobs/:id/fail",
  {
    worker: true,
    detail: {
      operationId: "failArtJob",
      tags: ["art-worker"],
      summary: "Give a job back after a failure",
    },
    params: artJobParams,
    body: artFail,
  },
  async ({ params, body, set }) => {
    await ArtService.fail(params.id, body.error);
    set.status = 204;
  },
);
