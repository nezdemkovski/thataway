// What the page and the server say to each other.
import type { ArtRender, ArtSpec } from "@thataway/db/art";
import type { PlaceKind } from "@thataway/db/enums";

export interface PlacePick {
  id: string;
  name: string;
  description: string | null;
  kind: PlaceKind;
  imageUrl: string | null;
  imageLicense: string | null;
  artUrl: string | null;
}

export interface RenderedPrompt {
  prompt: string;
  negativePrompt: string;
}

export interface RunRequest {
  spec: ArtSpec;
}

export interface RunMeta {
  id: string;
  startedAt: string;
  seconds: number;
  name: string;
  seed: number;
  render: ArtRender;
  width: number;
  height: number;
  anchorX: number;
  /** URLs under /runs/<id>/ */
  raw: string;
  cut: string;
  final: string;
  /** The depth map aligned with `final`, 255 nearest, once computed */
  depth?: string;
  spec: ArtSpec;
  prompt: string;
  negativePrompt: string;
  error?: string;
}
