import { t } from "elysia";

import { HealthStatus } from "@/utils/enums";

/** Body of GET /health: whether the database behind the service answers. */
export const healthResponse = t.Object({
  status: t.Enum(HealthStatus),
});
