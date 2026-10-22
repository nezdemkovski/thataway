import { describe, expect, test } from "bun:test";

import {
  encodeGeohash,
  geohashBounds,
  geohashNeighbourhood,
  geohashesCovering,
  quadrants,
} from "@/utils/geohash";

describe("geohash", () => {
  test("encodes known points", () => {
    // Old Town Square, Prague
    expect(encodeGeohash(50.0875, 14.4213, 5)).toBe("u2fkb");
    // The textbook vector from geohash.org
    expect(encodeGeohash(42.605, -5.603, 5)).toBe("ezs42");
  });

  test("bounds contain the point and are about 5 km at precision 5", () => {
    const b = geohashBounds("u2fkb");
    expect(b.south).toBeLessThanOrEqual(50.0875);
    expect(b.north).toBeGreaterThanOrEqual(50.0875);
    expect(b.west).toBeLessThanOrEqual(14.4213);
    expect(b.east).toBeGreaterThanOrEqual(14.4213);
    expect((b.north - b.south) * 111).toBeCloseTo(4.9, 0);
  });

  test("a neighbourhood is the cell and its eight neighbours", () => {
    const cells = geohashNeighbourhood("u2fkb");
    expect(cells).toHaveLength(9);
    expect(cells).toContain("u2fkb");
  });

  test("covering a box lists every touched cell", () => {
    const cells = geohashesCovering({ south: 50.03, west: 14.35, north: 50.12, east: 14.5 }, 5);
    expect(cells.length).toBeGreaterThan(4);
    expect(cells).toContain("u2fkb");
  });

  test("quadrants tile the box without gaps or overlap", () => {
    const box = { south: 50, west: 14, north: 50.1, east: 14.2 };
    const parts = quadrants(box);
    expect(parts).toHaveLength(4);
    expect(Math.min(...parts.map((b) => b.south))).toBe(box.south);
    expect(Math.max(...parts.map((b) => b.north))).toBe(box.north);
    expect(Math.min(...parts.map((b) => b.west))).toBe(box.west);
    expect(Math.max(...parts.map((b) => b.east))).toBe(box.east);
    const area = (b: typeof box) => (b.north - b.south) * (b.east - b.west);
    expect(parts.reduce((sum, b) => sum + area(b), 0)).toBeCloseTo(area(box));
  });
});
