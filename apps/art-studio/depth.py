"""Turns Depth Pro's map of the raw picture into a depth map aligned with the final sprite.

    python depth.py raw_depth.png cut.png final.png depth.png

Depth Pro paints nearer brighter, with the whole landmark in a narrow band because the
imagined floor in front of it is so much nearer. The map is cut to the same box as the
final sprite (the worker's postprocess.py rules), the values inside the landmark are
stretched to the full range (1st to 99th percentile, so stray pixels do not set the scale),
and everything outside the landmark is 0. 255 is nearest.
"""
import sys

import numpy as np
from PIL import Image

MARGIN = 0.03
SOLID = 40

raw_depth, cut_path, final_path, out = sys.argv[1:5]
cut = Image.open(cut_path).convert("RGBA")
alpha = np.array(cut)[:, :, 3]
depth = np.array(Image.open(raw_depth).convert("L")).astype(np.float32)
if depth.shape != alpha.shape:
    depth = np.array(Image.fromarray(depth).resize(cut.size, Image.BILINEAR)).astype(np.float32)

mask = alpha > SOLID
rows = np.where(mask.any(axis=1))[0]
cols = np.where(mask.any(axis=0))[0]
top, bottom, left, right = rows[0], rows[-1], cols[0], cols[-1]
pad = int(max(right - left + 1, bottom - top + 1) * MARGIN)
box = (max(0, left - pad), max(0, top - pad), min(cut.width, right + pad + 1), min(cut.height, bottom + pad + 1))

inside = depth[mask]
low, high = np.percentile(inside, 1), np.percentile(inside, 99)
scaled = np.clip((depth - low) / max(high - low, 1e-3), 0, 1)
scaled[~mask] = 0
cropped = Image.fromarray((scaled * 255).astype(np.uint8)).crop(box)
final = Image.open(final_path)
cropped = cropped.resize(final.size, Image.BILINEAR)
cropped.save(out, "PNG", optimize=True)
print(f"depth {cropped.width}x{cropped.height} range {low:.0f}..{high:.0f}")
