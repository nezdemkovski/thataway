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

Every run lands in `runs/<time>-<place>/` with `spec.json`, `prompt.txt`, `negative.txt`,
`reference.jpg`, `raw.png`, `cut.png`, `final.png` and `meta.json`; the folder is not
committed. The model needs the Mac to itself: pause the art worker's launchd agent while
tuning (`launchctl bootout gui/$(id -u)/cloud.nezdemkovski.thataway.art-worker`), or two
pictures will fight for memory.

When a wording works, move it into `packages/db/src/art.ts` (`ART_STYLE`, `KIND_SHOW`,
`REFERENCE_USE`) and bump `ART_SPEC_VERSION`; the studio reads its defaults from there.
