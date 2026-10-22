import { DEFAULT_CONTROLS, type ParallaxControls } from "./ParallaxView";

/** What moves on its own in the view: the map turning, the phone tilting, both, or the light. */
export enum SwayMode {
  None = "none",
  Yaw = "yaw",
  Pitch = "pitch",
  Both = "both",
  Light = "light",
}

export interface Preset {
  name: string;
  /** What it is for, in one line */
  note: string;
  controls: Omit<ParallaxControls, "yaw" | "pitch" | "showDepth">;
  sway: SwayMode;
}

/** From nothing to too much, so the right amount is found by comparing neighbours. */
export const PRESETS: Preset[] = [
  {
    name: "Flat",
    note: "The picture as it is: the reference everything else is judged against",
    controls: { amplitude: 0, lightAngle: 30, rim: 0, squash: 0.7 },
    sway: SwayMode.None,
  },
  {
    name: "Breath",
    note: "Barely there: a hint of depth as the map turns, no relighting",
    controls: { amplitude: 0.015, lightAngle: 30, rim: 0, squash: 0.7 },
    sway: SwayMode.Yaw,
  },
  {
    name: "Map turn",
    note: "The candidate for the app: a few degrees of turn with the heading, rim follows",
    controls: { amplitude: 0.03, lightAngle: 30, rim: 0.45, squash: 0.7 },
    sway: SwayMode.Yaw,
  },
  {
    name: "Phone tilt",
    note: "Only the tilt moves it: what you see when you lower or raise the phone",
    controls: { amplitude: 0.03, lightAngle: 30, rim: 0.45, squash: 0.7 },
    sway: SwayMode.Pitch,
  },
  {
    name: "Walking by",
    note: "Turn and tilt together, as on a walk",
    controls: { amplitude: 0.035, lightAngle: 30, rim: 0.6, squash: 0.7 },
    sway: SwayMode.Both,
  },
  {
    name: "Light only",
    note: "No displacement at all; the amber rim walks around the volume",
    controls: { amplitude: 0, lightAngle: 30, rim: 0.9, squash: 0.7 },
    sway: SwayMode.Light,
  },
  {
    name: "Held flat",
    note: "The phone almost flat: the plane squashes, the shadow with it",
    controls: { amplitude: 0.03, lightAngle: 30, rim: 0.45, squash: 0.95 },
    sway: SwayMode.Both,
  },
  {
    name: "Too much",
    note: "Twice the honest amplitude, to see where the gaps and smearing start",
    controls: { amplitude: 0.08, lightAngle: 30, rim: 1.0, squash: 0.7 },
    sway: SwayMode.Both,
  },
];

export const applyPreset = (preset: Preset): ParallaxControls => ({
  ...DEFAULT_CONTROLS,
  ...preset.controls,
  yaw: 0,
  pitch: 0,
});

/** The preset whose settings the controls match, if any. */
export const matchingPreset = (controls: ParallaxControls, sway: SwayMode): Preset | undefined =>
  PRESETS.find(
    (p) =>
      p.sway === sway &&
      (Object.keys(p.controls) as (keyof Preset["controls"])[]).every(
        (k) => Math.abs(Number(p.controls[k]) - Number(controls[k])) < 1e-6,
      ),
  );
