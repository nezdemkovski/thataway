import { Elysia } from "elysia";

import { postArtClaim } from "./art/jobs/claim/POST";
import { postArtComplete } from "./art/jobs/[id]/complete/POST";
import { postArtFail } from "./art/jobs/[id]/fail/POST";
import { getHealth } from "./health/GET";
import { getPlaces } from "./places/GET";

export const routes = new Elysia()
  .use(getHealth)
  .use(getPlaces)
  .use(postArtClaim)
  .use(postArtComplete)
  .use(postArtFail);
