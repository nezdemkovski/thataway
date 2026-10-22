import { describe, expect, test } from "bun:test";

import { ART_STYLE, renderArtPrompt } from "@thataway/db/art";
import { PlaceKind } from "@thataway/db/enums";
import { buildArtSpec } from "@/modules/art/prompt";

const bridge = buildArtSpec({
  name: "Charles Bridge",
  description: "bridge in Prague, Czech Republic",
  kind: PlaceKind.Bridge,
  imageUrl: "https://example.org/bridge.jpg",
  imageLicense: "FAL",
});

describe("art spec", () => {
  test("reads the city off the description", () => {
    expect(bridge.subject.city).toBe("Prague");
    expect(
      buildArtSpec({ ...bridge.subject, description: null, imageUrl: null, imageLicense: null })
        .subject.city,
    ).toBeNull();
  });

  test("renders the subject before the style and every style field once", () => {
    const { prompt, negativePrompt } = renderArtPrompt(bridge);
    expect(prompt.startsWith(ART_STYLE.medium)).toBe(true);
    expect(prompt.indexOf("Subject: Charles Bridge, Prague")).toBeLessThan(
      prompt.indexOf("Camera:"),
    );
    for (const field of [
      "Camera",
      "Framing",
      "Base",
      "Background",
      "Form",
      "Materials",
      "Light",
      "Palette",
    ]) {
      expect(prompt.split(`${field}: `)).toHaveLength(2);
    }
    expect(prompt).toContain("Reference photo attached.");
    expect(negativePrompt).toBe(ART_STYLE.avoid.join(", "));
  });

  test("the same spec renders the same text", () => {
    expect(renderArtPrompt(bridge)).toEqual(renderArtPrompt(JSON.parse(JSON.stringify(bridge))));
  });
});
