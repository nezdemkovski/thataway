import { useEffect, useRef } from "react";

/** Draws the picture standing on its point: the point under the tallest element, not the middle. */
const stand = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  anchorX: number,
  size: number,
  cx: number,
  baseY: number,
) => {
  const s = Math.min(size / img.width, size / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, cx - w * anchorX, baseY - h, w, h);
  ctx.fillStyle = "rgba(255,178,36,0.9)";
  ctx.beginPath();
  ctx.arc(cx, baseY, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** The picture as the app shows it: on the dark dotted plane, at the sheet size and as tokens. */
export function MapPlane({ src, anchorX }: { src: string; anchorX: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    const W = el.width;
    const H = el.height;
    ctx.fillStyle = "#0A0B0D";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    for (let y = 0; y < H; y += 48) {
      for (let x = 0; x < W; x += 48) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const img = new Image();
    img.addEventListener("load", () => {
      stand(ctx, img, anchorX, 520, W / 2, 560);
      stand(ctx, img, anchorX, 56, 120, 760);
      stand(ctx, img, anchorX, 88, 260, 760);
      stand(ctx, img, anchorX, 132, 430, 760);
      stand(ctx, img, anchorX, 168, 640, 760);
    });
    img.src = src;
  }, [src, anchorX]);

  return (
    <canvas
      ref={canvas}
      width={800}
      height={800}
      className="w-full rounded-xl border border-white/8"
    />
  );
}
