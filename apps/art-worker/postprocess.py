"""Cuts a background-free PNG down to the landmark and says where its tallest point is.

    python postprocess.py in.png out.png

Crops to the alpha bounding box with a small margin, scales the longer side to 768 px and
prints JSON: width, height, anchorX (0..1, the column of the highest opaque pixel, so the map
can put the place's point under the tallest element rather than under the picture's middle).
"""
import json
import sys

import numpy as np
from PIL import Image

MAX_SIDE = 768
MARGIN = 0.03
# A pixel counts as part of the landmark above this alpha
SOLID = 40

src = Image.open(sys.argv[1]).convert("RGBA")
alpha = np.array(src)[:, :, 3]
rows = np.where((alpha > SOLID).any(axis=1))[0]
cols = np.where((alpha > SOLID).any(axis=0))[0]
if rows.size == 0 or cols.size == 0:
    print(json.dumps({"error": "empty picture"}))
    sys.exit(2)
top, bottom, left, right = rows[0], rows[-1], cols[0], cols[-1]
height, width = bottom - top + 1, right - left + 1
pad = int(max(width, height) * MARGIN)
box = (
    max(0, left - pad),
    max(0, top - pad),
    min(src.width, right + pad + 1),
    min(src.height, bottom + pad + 1),
)
# The highest opaque row: where in it the mass sits is the tallest element's column
peak = alpha[top : top + max(1, height // 20)]
columns = np.where((peak > SOLID).any(axis=0))[0]
anchor = (columns.mean() - box[0]) / (box[2] - box[0])

cut = src.crop(box)
scale = MAX_SIDE / max(cut.width, cut.height)
if scale < 1:
    cut = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.LANCZOS)
cut.save(sys.argv[2], "PNG", optimize=True)
print(json.dumps({"width": cut.width, "height": cut.height, "anchorX": round(float(anchor), 4)}))
