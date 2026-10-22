import {
  ART_SPEC_VERSION,
  ART_STYLE,
  type ArtSpec,
  KIND_SHOW,
  REFERENCE_USE,
  renderArtPrompt,
} from "@thataway/db/art";
import { PlaceKind } from "@thataway/db/enums";
import { ArtModel } from "@/utils/enums";

export interface ArtSpecInput {
  name: string;
  description: string | null;
  kind: PlaceKind;
  imageUrl: string | null;
  imageLicense: string | null;
}

/** Wikidata descriptions end in "in Prague, Czech Republic": the city is the first name after "in". */
const cityOf = (description: string | null): string | null => {
  const match = description?.match(/\bin ([A-Z][^,]*?)(?:,|$)/);
  return match?.[1]?.trim() ?? null;
};

/** The spec for one place: the house style, the subject from the place, the render settings. */
export const buildArtSpec = (input: ArtSpecInput): ArtSpec => ({
  version: ART_SPEC_VERSION,
  style: ART_STYLE,
  subject: {
    name: input.name,
    city: cityOf(input.description),
    what: input.description,
    kind: input.kind,
    ...KIND_SHOW[input.kind],
    reference: input.imageUrl
      ? { url: input.imageUrl, license: input.imageLicense, use: REFERENCE_USE }
      : null,
  },
  render: {
    model: ArtModel.QwenImage21Turbo,
    size: 1024,
    steps: null,
    guidance: null,
    seed: null,
  },
});

export { renderArtPrompt };
