import type { ArtSpec, ArtStyle } from "@thataway/db/art";
import type { PlaceKind } from "@thataway/db/enums";

import type { PlacePick, RenderedPrompt, RunMeta } from "../shared/types";

export interface Defaults {
  version: number;
  style: ArtStyle;
  styles: Record<string, ArtStyle>;
  kinds: Record<PlaceKind, { show: string; tallest: string }>;
  referenceUse: string;
}

const get = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  return body as T;
};

const post = async <T>(path: string, data: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  return body as T;
};

export const api = {
  defaults: () => get<Defaults>("/api/defaults"),
  places: (lat: number, lon: number) => get<PlacePick[]>(`/api/places?lat=${lat}&lon=${lon}`),
  render: (spec: ArtSpec) => post<RenderedPrompt>("/api/render", { spec }),
  generate: (spec: ArtSpec) => post<RunMeta>("/api/generate", { spec }),
  runs: () => get<RunMeta[]>("/api/runs"),
  depth: (id: string) => post<RunMeta>("/api/depth", { id }),
};
