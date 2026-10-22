# Art studio

A local page for tuning the illustration prompt on the same engine the art worker uses, so
what looks right here looks the same in the app. Vite + React + Tailwind in front, a Bun
server behind that runs mflux (Qwen Image 2.1 Turbo), rembg (BiRefNet) and the worker's
`postprocess.py`, exactly as `apps/art-worker` does.

```bash
bun run --cwd apps/art-studio dev     # http://localhost:3050 (the server is on 3051)
```

Left: a place to try (the live API's answer for the centre of Prague; pick one and its name,
description, kind and Commons photo fill the subject), the subject fields (`show` and
`tallest` decide the composition), the render settings (seed empty means random) and, folded,
every field of the style, highlighted when it differs from the code's default. Middle: the last
run on the app's dark plane at the sheet size and as tokens, the point under the tallest
element as `anchorX` puts it; below it the raw model output and the cut-out. Right: the prompt
and the negative prompt exactly as the model gets them, and the history of runs; a run can be
shown again, its spec loaded back into the form, or copied as JSON.

Above the plane, the sprite with depth, in two tabs. "On the map" is the app's map, enough of
it to judge: the squashed plane with its north-up dot grid turning under you, the distance
rings, the vision cone and your chevron, and the sprite standing on its bearing and distance
at the size the app gives it (plain, named or locked), with its name tag; the map turns on
its own or by dragging sideways, and the parallax is driven the way the app would drive it:
the yaw from how fast you are turning (capped at `turn for full yaw` degrees, fading as the
turn settles), the pitch from the tilt (`squash`). "Studio" shows the sprite big and at the
two token sizes, with something moving on its own: the turn, the tilt, both, or the light.
The presets sit under the picture, the knobs fold out below them. In detail: after every run Depth Pro (`mflux-save-depth`, about
ten seconds) measures the raw picture, `depth.py` cuts the map to the sprite and stretches it
to the landmark's own range, and a WebGL view displaces each pixel by its depth toward a
small turn (`yaw`) or tilt (`pitch`), moving the amber rim with it, so the flat picture reads
as a miniature that turns a few degrees with the map. `amplitude` is how far the nearest
point moves at full turn (a few percent is the honest range; beyond it the gaps show),
`lightAngle` and `rim` drive the relighting, `squash` the shadow under its feet, "moves on
its own" animates the turn, the tilt, both or the light, and the depth map can be shown
instead of the picture. The presets (`src/web/presets.ts`) go from Flat to Too much, so the
right amount is found by comparing neighbours; the sprite is shown at the sheet size and at
the two token sizes, because the small one is the one that matters. Runs
made before this have a "Compute depth" button.

Every run lands in `runs/<time>-<place>/` with `spec.json`, `prompt.txt`, `negative.txt`,
`reference.jpg`, `raw.png`, `cut.png`, `final.png`, `raw_depth.png`, `depth.png` and `meta.json`; the folder is not
committed. The model needs the Mac to itself: pause the art worker's launchd agent while
tuning (`launchctl bootout gui/$(id -u)/cloud.nezdemkovski.thataway.art-worker`), or two
pictures will fight for memory.

When a wording works, move it into `packages/db/src/art.ts` (`ART_STYLE`, `KIND_SHOW`,
`REFERENCE_USE`) and bump `ART_SPEC_VERSION`; the studio reads its defaults from there.
