import { PlaceKind } from "@thataway/db/enums";

import styleText from "./style.txt" with { type: "text" };

/** What the worker tells the model: the shared style, then this place. */
export interface ArtPromptInput {
  name: string;
  description: string | null;
  kind: PlaceKind;
}

/** The style part, the same for every place; the source of truth is docs/art-prompt.md. */
export const ART_STYLE_PROMPT = styleText.trim();

const KIND_HINTS: Record<PlaceKind, string> = {
  [PlaceKind.Church]:
    "Show the main facade with its towers or dome; the tallest spire or dome is on the centre line.",
  [PlaceKind.Tower]:
    "Show the tower whole, front-on, with the feature it is known for on its lower front.",
  [PlaceKind.Bridge]:
    "Show the most recognizable end of the bridge: its tower or gate and two or three spans next to it, not the full length.",
  [PlaceKind.Museum]:
    "Show the main entrance facade, front-on, with its roofline; cut the wings short on both sides.",
  [PlaceKind.Park]:
    "Show the one built or natural feature the park is known for (a gate, a pavilion, a fountain, a famous tree); no lawns or paths.",
  [PlaceKind.Monument]: "Show the monument whole with its pedestal, front-on, large in the frame.",
  [PlaceKind.Square]:
    "Show the single most recognizable building on the square, front-on, not the open space.",
  [PlaceKind.Castle]:
    "Show the keep or the main gate with the walls cut short on both sides; the tallest tower is on the centre line.",
  [PlaceKind.Place]: "Show the building or structure front-on, cut to its most recognizable part.",
};

/** Builds the full prompt for one place: the style, then what to draw. */
export const buildArtPrompt = (input: ArtPromptInput): string => {
  const what = input.description ? ` — ${input.description}` : "";
  return [
    ART_STYLE_PROMPT,
    "",
    `Landmark: ${input.name}${what}.`,
    `Category: ${input.kind}. ${KIND_HINTS[input.kind]}`,
    "Use the attached photo for the shape and proportions only, not for its colours, sky, weather or crowds.",
  ].join("\n");
};
