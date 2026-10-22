import { Elysia, t } from "elysia";

import { workerAuth } from "@/lib/workerAuth";
import { artJob } from "@/modules/art/model";
import { ArtService } from "@/modules/art/service";

/** The art worker asks for the next place to draw; `job` is null when there is nothing to do. */
export const postArtClaim = new Elysia().use(workerAuth).post(
  "/art/jobs/claim",
  {
    worker: true,
    detail: {
      operationId: "claimArtJob",
      tags: ["art-worker"],
      summary: "Take the next place to illustrate",
    },
    response: { 200: t.Object({ job: t.Nullable(artJob) }) },
  },
  async () => ({ job: await ArtService.claim() }),
);
