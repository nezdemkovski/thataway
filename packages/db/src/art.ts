// The illustration prompt as data: one style shared by every place, a subject per place, and
// the render settings. The API builds a spec for each job and keeps it in `place_art.prompt`,
// so any picture can be drawn again from its record; the worker only turns it into text.
// Keep it dependency-free.

import { PlaceKind } from "./enums";

/** Bump when the style or the rendering changes in a way that makes old pictures look off. */
export const ART_SPEC_VERSION = 3;

export interface ArtStyle {
  /** What kind of picture this is, in one line */
  medium: string;
  camera: string;
  framing: string;
  base: string;
  background: string;
  form: string;
  materials: string;
  light: string;
  palette: string;
  /** Things that must not appear; models with a negative prompt get these there as well */
  avoid: string[];
}

export interface ArtSubject {
  name: string;
  /** "Prague", when known */
  city: string | null;
  /** Wikidata's one-liner, "medieval stone arch bridge across the Vltava" */
  what: string | null;
  kind: PlaceKind;
  /** What to draw and what to leave out: the one sentence that decides the composition */
  show: string;
  /** Which element is the tallest, so it lands on the centre line */
  tallest: string;
  reference: {
    url: string;
    license: string | null;
    use: string;
  } | null;
}

export interface ArtRender {
  model: string;
  /** Square side in pixels */
  size: number;
  steps: number | null;
  guidance: number | null;
  seed: number | null;
}

export interface ArtSpec {
  version: number;
  style: ArtStyle;
  subject: ArtSubject;
  render: ArtRender;
}

/**
 * The house style: a dark architectural miniature with an amber rim, drawn as an isolated
 * asset that stands upright on the dark, tilted map.
 */
export const ART_STYLE: ArtStyle = {
  medium:
    "A high-detail, semi-realistic 3D architectural miniature of a single landmark, rendered as an isolated game asset for a dark game map UI: convincing stone, slate and aged metal, deliberately composed lighting, clean miniature presentation.",
  camera:
    "A straight-on frontal elevation of the landmark's most recognizable side, near-orthographic (a very long focal length, minimal perspective convergence), the camera at the middle of the landmark's height, tilted down by 0 to 10 degrees. Only a sliver of right-side thickness and subtle depth in roof planes and recesses. No isometric, three-quarter, aerial, end-on or dramatic low-angle view, no wide-angle distortion.",
  framing:
    "Square canvas. The main architectural mass centred horizontally; the tallest single element on the vertical centre line, or twin highest elements balanced around it. The complete silhouette fills about 90% of the larger dimension with about 5% clear margin and no clipped finials; the composition is as tall or as wide as the landmark's own silhouette, never squeezed. A sprawling complex is compressed into a compact, recognizable ensemble; a long object is reduced to its most recognizable part.",
  base: "One continuous straight horizontal bottom edge across the full width of the landmark. No pedestal, no ground plane, no cast shadow outside the object; at most an extremely faint contact darkening directly beneath the baseline.",
  background:
    "A perfectly flat, uniform, very dark background, hex #0A0B0D, with nothing else in it: no gradient, no vignette, no glow, no floor, no scenery.",
  form: "Architecturally precise major forms, crisp silhouettes, subtly softened edges, convincing depth without exaggerated perspective. High architectural detail subordinate to the overall silhouette: window recesses, mouldings, buttresses, roof seams, restrained stone courses, characteristic tracery and ornament, with fine low-contrast surface variation and restrained weathering. Broad tonal groups and a clear roof-versus-stone separation so the silhouette survives reduction to 48 pixels. Preserve the real landmark's silhouette, major proportions, characteristic roofs, towers and facade; do not invent spires, domes or wings it does not have.",
  materials:
    "Stone: warm grey-beige limestone or sandstone, matte, subtly aged, fine low-contrast grain. Roofs: near-black charcoal slate with restrained seams and soft tonal variation. Muted burnt-brown tile only where the subject has it, dark and subordinate to the rim. Desaturated dark grey-green patinated copper where the subject has it. Small, aged, muted warm metal details; no broad polished gold. Windows: very dark recessed openings with minimal reflection. Predominantly matte with restrained rough highlights on metal; no plastic or wet gloss.",
  light:
    "Key light: broad, soft and directional, neutral to subtly cool, from the upper right and slightly in front, moderate, keeping the stone detail readable in the lit facade. Rim light: a narrow, controlled amber edge highlight, hex #FFB224, on the right and upper-right silhouette edges, clearly visible and strongest on the right, without broad glow or bloom. A weak cool-neutral fill keeps the shadowed facades readable. Deep, soft ambient occlusion in windows, portals, cornices and between overlapping masses. Dark midtones, luminous warm edges, deep recesses.",
  palette:
    "Muted earthy neutrals and charcoal: stone around #A18C70 in the light, #786A58 in the midtones and #443D34 in shadow, slate #292D30, recesses #17191A, patinated copper #52605A, muted terracotta #774B35. Low overall saturation; the amber rim #FFB224 is the strongest chromatic accent.",
  avoid: [
    "cartoon",
    "chunky toy geometry",
    "low-poly faceting",
    "plastic",
    "flat vector illustration",
    "heavy outlines",
    "photographic scene or environment",
    "isometric camera",
    "three-quarter camera",
    "dramatic perspective",
    "sky",
    "clouds",
    "landscape",
    "ground plane",
    "pedestal",
    "cast shadow",
    "vignette",
    "frame",
    "people",
    "vehicles",
    "birds",
    "text",
    "labels",
    "logos",
    "watermarks",
    "saturated blue or green surfaces",
    "bright polished gold",
    "neon glow",
    "bloom",
    "overexposed highlights",
    "clipped spires",
    "blurry",
  ],
};

/** The one sentence per kind that decides the composition when nobody has written a better one. */
export const KIND_SHOW: Record<PlaceKind, { show: string; tallest: string }> = {
  [PlaceKind.Church]: {
    show: "The main facade with its towers or dome, front-on; the nave cut short behind it.",
    tallest: "the tallest spire or the dome",
  },
  [PlaceKind.Tower]: {
    show: "The tower whole, front-on, with the feature it is known for on its lower front.",
    tallest: "the tower's top",
  },
  [PlaceKind.Bridge]: {
    show: "Only one end of the bridge, seen from the side, from the river bank: its tower or gate and the two or three spans next to it, filling the frame; the frame ends after the third span and the bridge continues out of it. Never the whole length, never looking along the bridge. A thin dark strip of water under the spans.",
    tallest: "the bridge tower or gate",
  },
  [PlaceKind.Museum]: {
    show: "The main entrance facade, front-on, with its roofline; the wings cut short on both sides.",
    tallest: "the central part of the facade",
  },
  [PlaceKind.Park]: {
    show: "The one built or natural feature the park is known for (a gate, a pavilion, a fountain, a famous tree); no lawns, paths or benches.",
    tallest: "that feature",
  },
  [PlaceKind.Monument]: {
    show: "The monument whole with its pedestal, front-on, large in the frame.",
    tallest: "the monument's top",
  },
  [PlaceKind.Square]: {
    show: "The single most recognizable building on the square, front-on; not the open space.",
    tallest: "that building's highest point",
  },
  [PlaceKind.Castle]: {
    show: "The keep or the main gate with the walls cut short on both sides.",
    tallest: "the tallest tower",
  },
  [PlaceKind.Place]: {
    show: "The building or structure front-on, cut to its most recognizable part.",
    tallest: "its highest point",
  },
};

export const REFERENCE_USE =
  "Shape and proportions only: not its colours, lighting, sky, weather, season or crowds. If the photo shows only a part or a detail of the landmark, draw the whole landmark anyway, with that detail in its place.";

/** The text a model gets, and the negative prompt for models that take one. */
export interface ArtPromptText {
  prompt: string;
  negativePrompt: string;
}

export const renderArtPrompt = (spec: ArtSpec): ArtPromptText => {
  const { style, subject } = spec;
  const where = subject.city ? `, ${subject.city}` : "";
  const what = subject.what ? ` — ${subject.what}` : "";
  const lines = [
    style.medium,
    "",
    `Subject: ${subject.name}${where}${what}.`,
    `Show: ${subject.show}`,
    `The tallest element is ${subject.tallest}; it stands on the vertical centre line.`,
    subject.reference ? `Reference photo attached. ${subject.reference.use}` : "",
    "",
    `Camera: ${style.camera}`,
    `Framing: ${style.framing}`,
    `Base: ${style.base}`,
    `Background: ${style.background}`,
    `Form: ${style.form}`,
    `Materials: ${style.materials}`,
    `Light: ${style.light}`,
    `Palette: ${style.palette}`,
    `Must not contain: ${style.avoid.join(", ")}.`,
  ];
  return {
    prompt: lines.filter((line, i) => line !== "" || lines[i - 1] !== "").join("\n"),
    negativePrompt: style.avoid.join(", "),
  };
};
