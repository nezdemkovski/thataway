import { useCallback, useEffect, useState } from "react";

import type { RunMeta } from "../shared/types";
import { DEFAULT_MAP, MapEmulation, type MapSettings, TurnMode } from "./MapEmulation";
import { type ParallaxControls, ParallaxView } from "./ParallaxView";
import { PRESETS, SwayMode, applyPreset, matchingPreset } from "./presets";

enum Tab {
  Studio = "studio",
  Map = "map",
}

const SLIDERS: [keyof ParallaxControls, number, number, number][] = [
  ["amplitude", 0, 0.12, 0.001],
  ["rim", 0, 1.5, 0.01],
  ["lightAngle", -180, 180, 1],
  ["squash", 0.55, 0.95, 0.01],
  ["yaw", -1, 1, 0.01],
  ["pitch", -1, 1, 0.01],
];

/** The sprite with depth, big or on the app's map, and the controls underneath, out of its way. */
export function ParallaxPanel({
  run,
  depthBusy,
  onComputeDepth,
}: {
  run: RunMeta;
  depthBusy: boolean;
  onComputeDepth: (run: RunMeta) => void;
}) {
  const [tab, setTab] = useState<Tab>(Tab.Map);
  const [controls, setControls] = useState<ParallaxControls>(applyPreset(PRESETS[2]));
  const [sway, setSway] = useState<SwayMode>(PRESETS[2].sway);
  const [map, setMap] = useState<MapSettings>(DEFAULT_MAP);
  const [showSliders, setShowSliders] = useState(false);
  const activePreset = matchingPreset(controls, sway);

  // In the studio tab something moves on its own; on the map the turn and the tilt do it
  useEffect(() => {
    if (tab !== Tab.Studio || sway === SwayMode.None) return;
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      setControls((c) => ({
        ...c,
        yaw: sway === SwayMode.Yaw || sway === SwayMode.Both ? Math.sin(t * 0.7) : 0,
        pitch:
          sway === SwayMode.Pitch
            ? Math.sin(t * 0.5)
            : sway === SwayMode.Both
              ? Math.sin(t * 0.31) * 0.4
              : 0,
        lightAngle: sway === SwayMode.Light ? 30 + Math.sin(t * 0.6) * 80 : c.lightAngle,
      }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [sway, tab]);

  const fromMap = useCallback(
    (yaw: number, pitch: number) =>
      setControls((c) => (c.yaw === yaw && c.pitch === pitch ? c : { ...c, yaw, pitch })),
    [],
  );

  const locked = (key: keyof ParallaxControls) =>
    tab === Tab.Map
      ? key === "yaw" || key === "pitch"
      : ((sway === SwayMode.Yaw || sway === SwayMode.Both) && key === "yaw") ||
        ((sway === SwayMode.Pitch || sway === SwayMode.Both) && key === "pitch") ||
        (sway === SwayMode.Light && key === "lightAngle");

  if (!run.depth) {
    return (
      <section className="flex items-center gap-3 rounded-xl border border-white/8 p-4 text-sm text-tertiary">
        No depth map for this run yet.
        <button
          onClick={() => onComputeDepth(run)}
          disabled={depthBusy}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-secondary hover:text-label disabled:opacity-50"
        >
          {depthBusy ? "Computing…" : "Compute depth (Depth Pro, ~15 s)"}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs">
        {Object.values(Tab).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 ${tab === t ? "bg-raised text-label" : "text-tertiary hover:text-label"}`}
          >
            {t === Tab.Map ? "On the map" : "Studio"}
          </button>
        ))}
        {tab === Tab.Map ? (
          <>
            <span className="ml-auto text-tertiary">turn:</span>
            {Object.values(TurnMode).map((mode) => (
              <button
                key={mode}
                onClick={() => setMap((m) => ({ ...m, turnMode: mode }))}
                className={`rounded-full px-2.5 py-1 ${
                  map.turnMode === mode ? "bg-raised text-label" : "text-tertiary hover:text-label"
                }`}
              >
                {mode === TurnMode.Manual ? "manual (drag)" : `auto (${map.turnSpeed}°/s)`}
              </button>
            ))}
          </>
        ) : (
          <>
            <span className="ml-auto text-tertiary">something moves on its own:</span>
            <select
              className="w-auto"
              value={sway}
              onChange={(e) => setSway(e.target.value as SwayMode)}
            >
              {Object.values(SwayMode).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {tab === Tab.Map ? (
        <MapEmulation
          color={run.final}
          depth={run.depth}
          name={run.name}
          controls={controls}
          settings={map}
          onYaw={fromMap}
        />
      ) : (
        <div className="flex items-end justify-center gap-10 rounded-xl border border-white/8 bg-[radial-gradient(rgba(255,255,255,0.13)_1.5px,transparent_1.5px)] [background-size:48px_48px] p-6">
          <ParallaxView color={run.final} depth={run.depth} controls={controls} size={420} />
          <div className="flex items-end gap-5 pb-1">
            <ParallaxView color={run.final} depth={run.depth} controls={controls} size={132} />
            <ParallaxView color={run.final} depth={run.depth} controls={controls} size={56} />
          </div>
        </div>
      )}

      {/* Presets, then the knobs, under the picture and never over it */}
      <div className="flex flex-wrap items-center gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            title={preset.note}
            onClick={() => {
              setControls((c) => ({ ...applyPreset(preset), yaw: c.yaw, pitch: c.pitch }));
              setSway(preset.sway);
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              activePreset?.name === preset.name
                ? "border-accent text-accent"
                : "border-white/10 text-secondary hover:text-label"
            }`}
          >
            {preset.name}
          </button>
        ))}
        <span className="ml-2 text-[11px] text-tertiary">
          {activePreset?.note ?? "Custom settings"}
        </span>
        <button
          onClick={() => setShowSliders((s) => !s)}
          className="ml-auto text-[11px] text-tertiary hover:text-label"
        >
          {showSliders ? "hide knobs" : "knobs"}
        </button>
      </div>

      {showSliders && (
        <div className="grid grid-cols-3 gap-x-6 gap-y-2 rounded-xl border border-white/8 p-3 text-xs">
          {SLIDERS.map(([key, min, max, step]) => (
            <div key={key}>
              <label className="flex justify-between">
                <span>{key}</span>
                <span className="text-secondary">
                  {Number(controls[key]).toFixed(key === "amplitude" ? 3 : 2)}
                </span>
              </label>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={Number(controls[key])}
                disabled={locked(key)}
                onChange={(e) => setControls((c) => ({ ...c, [key]: Number(e.target.value) }))}
              />
            </div>
          ))}
          {tab === Tab.Map && (
            <>
              <div>
                <label className="flex justify-between">
                  <span>bearing</span>
                  <span className="text-secondary">{map.bearing}°</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={map.bearing}
                  onChange={(e) => setMap((m) => ({ ...m, bearing: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="flex justify-between">
                  <span>distance</span>
                  <span className="text-secondary">{map.distance} m</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={2500}
                  step={10}
                  value={map.distance}
                  onChange={(e) => setMap((m) => ({ ...m, distance: Number(e.target.value) }))}
                />
              </div>
              <div className={map.turnMode === TurnMode.Auto ? "" : "opacity-40"}>
                <label className="flex justify-between">
                  <span>turn speed (auto)</span>
                  <span className="text-secondary">{map.turnSpeed}°/s</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={map.turnSpeed}
                  onChange={(e) => setMap((m) => ({ ...m, turnSpeed: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="flex justify-between">
                  <span>turn for full yaw</span>
                  <span className="text-secondary">{map.turnForFullYaw}°</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={40}
                  value={map.turnForFullYaw}
                  onChange={(e) =>
                    setMap((m) => ({ ...m, turnForFullYaw: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label>role on the map</label>
                <select
                  value={map.role}
                  onChange={(e) =>
                    setMap((m) => ({ ...m, role: e.target.value as MapSettings["role"] }))
                  }
                >
                  <option value="plain">plain (56 pt)</option>
                  <option value="named">named (76 pt)</option>
                  <option value="locked">locked (96 pt)</option>
                </select>
              </div>
            </>
          )}
          <label className="flex items-center gap-2 self-end normal-case tracking-normal">
            <input
              type="checkbox"
              className="w-auto"
              checked={controls.showDepth}
              onChange={(e) => setControls((c) => ({ ...c, showDepth: e.target.checked }))}
            />
            show the depth map
          </label>
        </div>
      )}
    </section>
  );
}
