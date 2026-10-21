import { Elysia } from "elysia";

import { getHealth } from "./health/GET";
import { getPlaces } from "./places/GET";

export const routes = new Elysia().use(getHealth).use(getPlaces);
