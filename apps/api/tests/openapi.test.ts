import { describe, expect, test } from "bun:test";

import { PlaceKind, enumValues } from "@thataway/db/enums";
import type { PlaceDTO } from "@/modules/places/service";
import { HealthStatus } from "@/utils/enums";

// The contract the clients are generated from must say what the routes say.
const specPath = new URL("../../../packages/api-client/spec.yaml", import.meta.url);
const spec = Bun.YAML.parse(await Bun.file(specPath).text()) as {
  info: { version: string };
  paths: Record<string, Record<string, { operationId: string }>>;
  components: {
    schemas: Record<string, { enum?: string[]; properties?: Record<string, unknown> }>;
  };
};
const { schemas } = spec.components;

// Every field of the DTO, checked by the compiler: add one there and this stops compiling
const placeFields: Record<keyof PlaceDTO, true> = {
  id: true,
  name: true,
  description: true,
  kind: true,
  latitude: true,
  longitude: true,
  distance: true,
  sitelinks: true,
  heritage: true,
  views: true,
  enwikiTitle: true,
  imageUrl: true,
  imageAuthor: true,
  imageLicense: true,
  artUrl: true,
};

describe("packages/api-client/spec.yaml", () => {
  test("names every place kind", () => {
    expect(schemas.PlaceKind?.enum).toEqual(enumValues(PlaceKind));
  });

  test("names every health status", () => {
    expect(schemas.HealthStatus?.enum).toEqual(enumValues(HealthStatus));
  });

  test("describes every field of a place", () => {
    expect(Object.keys(schemas.Place?.properties ?? {}).toSorted()).toEqual(
      Object.keys(placeFields).toSorted(),
    );
  });

  test("has an operation per route", () => {
    const operations = Object.values(spec.paths).flatMap((methods) =>
      Object.values(methods).map((operation) => operation.operationId),
    );
    expect(operations.toSorted()).toEqual(["getHealth", "getPlaces"]);
  });

  test("carries the API version", async () => {
    const { version } = (await import("../package.json")) as { version: string };
    expect(spec.info.version).toBe(version);
  });
});
