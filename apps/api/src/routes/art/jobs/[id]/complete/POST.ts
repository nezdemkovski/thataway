import { Elysia } from "elysia";

import { workerAuth } from "@/lib/workerAuth";
import { artComplete, artJobParams, artResult } from "@/modules/art/model";
import { ArtService } from "@/modules/art/service";

/** The worker hands in the finished picture. */
export const postArtComplete = new Elysia().use(workerAuth).post(
  "/art/jobs/:id/complete",
  {
    worker: true,
    detail: {
      operationId: "completeArtJob",
      tags: ["art-worker"],
      summary: "Hand in the finished illustration",
    },
    params: artJobParams,
    body: artComplete,
    response: { 200: artResult },
  },
  async ({ params, body }) => {
    const bytes = new Uint8Array(await body.file.arrayBuffer());
    const artUrl = await ArtService.complete(params.id, {
      bytes,
      model: body.model,
      seed: body.seed,
      anchorX: body.anchorX,
      width: body.width,
      height: body.height,
    });
    return { placeId: params.id, artUrl };
  },
);
