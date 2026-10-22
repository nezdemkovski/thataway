import { describe, expect, test } from "bun:test";

import { PlaceKind } from "@thataway/db/enums";
import {
  commonsFileName,
  entityId,
  parsePoint,
  stripTags,
  wikipediaTitle,
} from "@/modules/wikidata/parse";
import { decide, isExcluded, kindFor } from "@/modules/wikidata/roots";

describe("parse", () => {
  test("entity ids, points, file names and titles", () => {
    expect(entityId("http://www.wikidata.org/entity/Q193369")).toBe("Q193369");
    expect(parsePoint("Point(14.4213 50.0875)")).toEqual({ latitude: 50.0875, longitude: 14.4213 });
    expect(parsePoint("nope")).toBeNull();
    expect(
      commonsFileName("http://commons.wikimedia.org/wiki/Special:FilePath/Karl%C5%AFv_most.jpg"),
    ).toBe("Karlův most.jpg");
    expect(wikipediaTitle("https://en.wikipedia.org/wiki/Charles_Bridge")).toBe("Charles Bridge");
    expect(wikipediaTitle("https://en.wikipedia.org/wiki/Church_of_Our_Lady_before_T%C3%BDn")).toBe(
      "Church of Our Lady before Týn",
    );
  });

  test("strips the HTML Commons puts around an author", () => {
    expect(stripTags('<a href="//commons.wikimedia.org/wiki/User:X">Jorge Royan</a>')).toBe(
      "Jorge Royan",
    );
    expect(stripTags("  plain  ")).toBe("plain");
  });
});

describe("roots", () => {
  test("drops people, events, settlements and organisations", () => {
    expect(isExcluded(["Q5"])).toBe(true);
    expect(isExcluded(["Q1190554"])).toBe(true);
    expect(isExcluded(["Q486972"])).toBe(true);
    expect(isExcluded(["Q43229"])).toBe(true);
    expect(isExcluded(["Q1370598"])).toBe(false);
    expect(isExcluded([])).toBe(false);
  });

  test("names the kind by the first matching root", () => {
    expect(kindFor(["Q1370598"])).toBe(PlaceKind.Church);
    expect(kindFor(["Q12280", "Q1370598"])).toBe(PlaceKind.Bridge);
    expect(kindFor(["Q33506"])).toBe(PlaceKind.Museum);
    expect(kindFor(["Q174782"])).toBe(PlaceKind.Square);
    expect(kindFor(["Q999999"])).toBeNull();
  });

  test("a kind root beats an exclusion, as Wikidata files bridges under thoroughfares", () => {
    expect(decide(["Q83620", "Q12280"])).toBe(PlaceKind.Bridge);
    expect(decide(["Q56061", "Q23413"])).toBe(PlaceKind.Castle);
    expect(decide(["Q83620"])).toBeNull();
    expect(decide(["Q56061"])).toBeNull();
    expect(decide([])).toBe(PlaceKind.Place);
  });
});
