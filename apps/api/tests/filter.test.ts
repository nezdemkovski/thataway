import { describe, expect, test } from "bun:test";

import { displayName, isPlace } from "@/modules/wikipedia/filter";

describe("isPlace", () => {
  test("keeps places you can walk to", () => {
    expect(isPlace("Historic square in Prague, Czech Republic")).toBe(true);
    expect(isPlace("Church in Prague, Czech Republic")).toBe(true);
    expect(isPlace("Medieval stone arch bridge across the Vltava river")).toBe(true);
    expect(isPlace(undefined)).toBe(true);
  });

  test("drops things you cannot walk to", () => {
    expect(isPlace("Capital and largest city of the Czech Republic")).toBe(false);
    expect(isPlace("Monarchy in Central Europe (1198–1918)")).toBe(false);
    expect(isPlace("Incorporated states in Central Europe")).toBe(false);
    expect(isPlace("Street in Prague Old Town")).toBe(false);
    expect(isPlace("Mass murder in the Czech Republic")).toBe(false);
    expect(isPlace("Oldest and largest university in the Czech Republic")).toBe(false);
  });

  test("judges only the kind before 'in', in the singular", () => {
    expect(isPlace("Square in Prague, Czech Republic")).toBe(true);
    expect(isPlace("Companies of Prague")).toBe(false);
  });
});

describe("displayName", () => {
  test("drops the disambiguation suffix", () => {
    expect(displayName("Jewish Town Hall (Prague)")).toBe("Jewish Town Hall");
    expect(displayName("Charles Bridge")).toBe("Charles Bridge");
  });
});
