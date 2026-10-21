import { describe, expect, test } from "bun:test";

import { PlaceKind } from "@thataway/db/enums";
import { guessKind } from "@/modules/wikipedia/kind";

describe("guessKind", () => {
  test("reads the kind from title and description", () => {
    expect(guessKind("Charles Bridge", "Bridge in Prague")).toBe(PlaceKind.Bridge);
    expect(guessKind("Church of Our Lady before Týn", undefined)).toBe(PlaceKind.Church);
    expect(guessKind("Jan Hus Memorial", "Sculpture")).toBe(PlaceKind.Monument);
    expect(guessKind("Letná Park", "Park in Prague")).toBe(PlaceKind.Park);
    expect(guessKind("Something", "Thing")).toBe(PlaceKind.Place);
  });
});
