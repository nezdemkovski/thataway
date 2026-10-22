import { useEffect, useRef, useState } from "react";

import { type ParallaxControls, ParallaxView } from "./ParallaxView";

/**
 * The app's map, enough of it to judge a sprite: the squashed plane with its north-up dot
 * grid turning under you, the distance rings, the vision cone and your chevron, and the
 * sprite standing on its bearing and distance at the size the app gives it. The map turns
 * on its own or by dragging sideways, as in the simulator; the parallax follows the turn
 * (a transient, capped, decaying) and the tilt, which is how the app would drive it.
 */
export interface MapSettings {
  /** Degrees clockwise from north, where the place is */
  bearing: number;
  /** Metres away */
  distance: number;
  /** The sprite's role on the map: plain, named, or the locked one */
  role: "plain" | "named" | "locked";
  /** Degrees per second the map turns on its own; 0 to drag it yourself */
  turnSpeed: number;
  /** Degrees of turn that give full parallax */
  turnForFullYaw: number;
}

export const DEFAULT_MAP: MapSettings = {
  bearing: 20,
  distance: 180,
  role: "named",
  turnSpeed: 12,
  turnForFullYaw: 10,
};

const RINGS: [number, string][] = [
  [100, "100 m"],
  [500, "500 m"],
  [2000, "2 km"],
];
const SPRITE_HEIGHT = { plain: 56, named: 76, locked: 96 };
/** iPhone points of the map area and the pixel scale the emulation is drawn at */
const PT_W = 402;
const PT_H = 560;
const SCALE = 1.5;

/** CompassMath.radialDistance: 20 m sits at a tenth of the radius, 2.5 km at the edge. */
const radial = (distance: number, maxRadius: number) => {
  const min = maxRadius * 0.1;
  const clamped = Math.min(Math.max(distance, 20), 2500);
  return min + (Math.log(clamped / 20) / Math.log(2500 / 20)) * (maxRadius - min);
};

export function MapEmulation({
  color,
  depth,
  name,
  controls,
  settings,
  onYaw,
}: {
  color: string;
  depth: string;
  name: string;
  controls: ParallaxControls;
  settings: MapSettings;
  /** Reports the yaw and pitch the map derives, so the sliders show them */
  onYaw: (yaw: number, pitch: number) => void;
}) {
  const plane = useRef<HTMLCanvasElement>(null);
  const [heading, setHeading] = useState(0);
  const drag = useRef<{ x: number; heading: number } | null>(null);
  const smoothed = useRef(0);
  const [yaw, setYaw] = useState(0);

  // The map turns on its own; the sprite's yaw is the turn's recent change, capped, fading
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setHeading((h) => {
        const next = settings.turnSpeed ? (h + settings.turnSpeed * dt) % 360 : h;
        // A low-pass copy of the heading: the difference is how fast you are turning
        let diff = next - smoothed.current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        smoothed.current += diff * Math.min(1, dt * 4);
        const y = Math.max(-1, Math.min(1, diff / settings.turnForFullYaw));
        setYaw(y);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [settings.turnSpeed, settings.turnForFullYaw]);

  // Tilt: the squash says how flat the phone is held
  const pitch = Math.max(-1, Math.min(1, (controls.squash - 0.75) / 0.2));
  useEffect(() => onYaw(yaw, pitch), [yaw, pitch, onYaw]);

  const W = PT_W * SCALE;
  const H = PT_H * SCALE;
  const center = { x: W / 2, y: H * 0.56 };
  const radius = (center.y - 28 * SCALE) / controls.squash;
  const angle = ((settings.bearing - heading) * Math.PI) / 180;
  const r = radial(settings.distance, radius);
  const point = {
    x: center.x + r * Math.sin(angle),
    y: center.y - r * Math.cos(angle) * controls.squash,
  };
  const depthFactor = (1 - Math.cos(angle)) / 2;
  const spriteScale = 0.88 + 0.2 * depthFactor;
  const spriteHeight = SPRITE_HEIGHT[settings.role] * SCALE * spriteScale;

  // The plane: dots, rings, cone, chevron
  useEffect(() => {
    const el = plane.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0A0B0D";
    ctx.fillRect(0, 0, W, H);
    const squash = controls.squash;
    const h = (heading * Math.PI) / 180;
    // North-up dot grid, turned by the heading and squashed
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    const step = 28 * SCALE;
    const extent = Math.max(W, H) * 1.2;
    for (let gx = -extent; gx <= extent; gx += step) {
      for (let gy = -extent; gy <= extent; gy += step) {
        const x = gx * Math.cos(h) + gy * Math.sin(h);
        const y = (-gx * Math.sin(h) + gy * Math.cos(h)) * squash;
        ctx.beginPath();
        ctx.arc(center.x + x, center.y + y, 1.6 * SCALE, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Vision cone: 60 degrees ahead
    const cone = ctx.createLinearGradient(center.x, center.y, center.x, 0);
    cone.addColorStop(0, "rgba(255,178,36,0.12)");
    cone.addColorStop(1, "rgba(255,178,36,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(
      center.x - radius * Math.sin(Math.PI / 6),
      center.y - radius * Math.cos(Math.PI / 6) * squash,
    );
    ctx.lineTo(
      center.x + radius * Math.sin(Math.PI / 6),
      center.y - radius * Math.cos(Math.PI / 6) * squash,
    );
    ctx.closePath();
    ctx.fill();
    // Rings and their labels, upright on the same side whichever way you face
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#8A8F98";
    ctx.font = `${11 * SCALE}px -apple-system, system-ui, sans-serif`;
    for (const [metres, label] of RINGS) {
      const rr = radial(metres, radius);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, rr, rr * squash, 0, 0, Math.PI * 2);
      ctx.stroke();
      const la = (-34 * Math.PI) / 180;
      ctx.fillText(
        label,
        center.x + rr * Math.sin(la) - 14 * SCALE,
        center.y - rr * Math.cos(la) * squash,
      );
    }
    // You: an amber chevron, squashed with the plane
    ctx.fillStyle = "#FFB224";
    ctx.beginPath();
    const s = 11 * SCALE;
    ctx.moveTo(center.x, center.y - s * squash);
    ctx.lineTo(center.x + s * 0.8, center.y + s * squash);
    ctx.lineTo(center.x, center.y + s * 0.45 * squash);
    ctx.lineTo(center.x - s * 0.8, center.y + s * squash);
    ctx.closePath();
    ctx.fill();
  }, [heading, controls.squash, W, H, center.x, center.y, radius]);

  const sprite: ParallaxControls = { ...controls, yaw, pitch };

  return (
    <div
      className="relative mx-auto cursor-ew-resize select-none overflow-hidden rounded-xl border border-white/8"
      style={{ width: W, height: H }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, heading };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setHeading((drag.current.heading - (e.clientX - drag.current.x) * 0.4 + 360) % 360);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <canvas ref={plane} width={W} height={H} className="absolute inset-0" />
      <div
        className="absolute"
        style={{
          left: point.x,
          top: point.y,
          transform: "translate(-50%, -100%)",
          width: spriteHeight * 1.6,
          height: spriteHeight,
          opacity: settings.role === "plain" ? 0.75 : 1,
        }}
      >
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <ParallaxView color={color} depth={depth} controls={sprite} size={spriteHeight} />
        </div>
      </div>
      {settings.role !== "plain" && (
        <div
          className="absolute text-center"
          style={{
            left: point.x,
            top: point.y + 6 * SCALE,
            transform: "translateX(-50%)",
            width: 160 * SCALE,
          }}
        >
          <div
            className="truncate text-[#F7F8F8]"
            style={{
              fontSize: 13 * SCALE,
              fontWeight: settings.role === "locked" ? 600 : 500,
              textShadow: "0 0 6px #0A0B0D, 0 0 12px #0A0B0D",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 11 * SCALE,
              color: settings.role === "locked" ? "#FFB224" : "#8A8F98",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {settings.distance < 950
              ? `${Math.round(settings.distance)} m`
              : `${(settings.distance / 1000).toFixed(1)} km`}
          </div>
        </div>
      )}
      <div className="absolute left-3 top-2 text-[11px] text-[#8A8F98]">
        heading {Math.round(heading)}° · yaw {yaw.toFixed(2)} · pitch {pitch.toFixed(2)} · drag to
        turn
      </div>
    </div>
  );
}
