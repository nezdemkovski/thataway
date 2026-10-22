import { Elysia } from "elysia";

import { artParams } from "@/modules/art/model";
import { ArtService } from "@/modules/art/service";
import { HttpHeader } from "@/utils/enums";

export const getArt = new Elysia().get(
  "/art/:file",
  {
    detail: {
      operationId: "getArt",
      tags: ["places"],
      summary: "The generated illustration of a place",
    },
    params: artParams,
  },
  async ({ params }) => {
    const art = await ArtService.get(params.file.replace(/\.png$/, ""));
    // The URL carries the version, so the file behind it never changes
    return new Response(new Uint8Array(art.bytes), {
      headers: {
        [HttpHeader.ContentType]: art.contentType,
        [HttpHeader.CacheControl]: "public, max-age=31536000, immutable",
      },
    });
  },
);
