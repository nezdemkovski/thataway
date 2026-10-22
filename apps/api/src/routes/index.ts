import { Elysia } from "elysia";

import { getArt } from "./art/GET";
import { getHealth } from "./health/GET";
import { getPlaces } from "./places/GET";

export const routes = new Elysia().use(getHealth).use(getPlaces).use(getArt);
