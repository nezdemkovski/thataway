import { useEffect, useRef } from "react";

/**
 * The picture as a map token: cut to a square around its tallest point, contrast lifted,
 * a dark edge and an amber rim so it separates from the plane, at the sizes the map uses.
 */
export interface TokenLook {
  contrast: number;
  brightness: number;
  /** Dark edge width in picture pixels at 64 px */
  edge: number;
  /** Amber rim strength */
  rim: number;
  /** Square crop around the anchor column, or the whole picture */
  square: boolean;
}

export const DEFAULT_LOOK: TokenLook = {
  contrast: 1.25,
  brightness: 1.1,
  edge: 1,
  rim: 0.5,
  square: true,
};

const SIZES = [96, 76, 56, 44, 36];

export function TokenPreview({
  src,
  anchorX,
  look,
}: {
  src: string;
  anchorX: number;
  look: TokenLook;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    const W = el.width;
    const H = el.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0A0B0D";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    for (let y = 0; y < H; y += 28) {
      for (let x = 0; x < W; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const img = new Image();
    img.addEventListener("load", () => {
      // The source square: the full height, centred on the tallest column, clamped to the picture
      let sx = 0;
      let sw = img.width;
      if (look.square && img.width > img.height) {
        sw = img.height;
        sx = Math.round(Math.min(Math.max(anchorX * img.width - sw / 2, 0), img.width - sw));
      }
      // Pre-render once at a generous size with the look applied, then scale down
      const base = document.createElement("canvas");
      base.width = 256;
      base.height = Math.round((256 * img.height) / sw);
      const bctx = base.getContext("2d")!;
      bctx.filter = `contrast(${look.contrast}) brightness(${look.brightness})`;
      bctx.drawImage(img, sx, 0, sw, img.height, 0, 0, base.width, base.height);
      let x = 24;
      for (const size of SIZES) {
        const s = Math.min(size / base.width, size / base.height);
        const w = base.width * s;
        const h = base.height * s;
        const baseY = 150;
        ctx.save();
        // A dark edge: the silhouette drawn offset in four directions
        if (look.edge > 0) {
          ctx.filter = "brightness(0) opacity(0.9)";
          const e = (look.edge * size) / 64;
          for (const [dx, dy] of [
            [e, 0],
            [-e, 0],
            [0, e],
            [0, -e],
          ]) {
            ctx.drawImage(base, x + dx, baseY - h + dy, w, h);
          }
        }
        // The amber rim: the silhouette offset up-right, tinted
        if (look.rim > 0) {
          ctx.filter = `brightness(2) sepia(1) saturate(4) hue-rotate(-10deg) opacity(${look.rim})`;
          const r = (1.2 * size) / 64;
          ctx.drawImage(base, x + r, baseY - h - r, w, h);
        }
        ctx.filter = "none";
        ctx.drawImage(base, x, baseY - h, w, h);
        ctx.restore();
        ctx.fillStyle = "#8A8F98";
        ctx.font = "10px -apple-system, system-ui, sans-serif";
        ctx.fillText(`${size} pt`, x, baseY + 14);
        x += size + 28;
      }
    });
    img.src = src;
  }, [src, anchorX, look]);

  return (
    <canvas ref={canvas} width={520} height={170} className="rounded-xl border border-white/8" />
  );
}
