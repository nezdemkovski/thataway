# Illustration prompt

Every place may carry one generated picture (`place_art`, the `thataway-art` bucket), drawn as
a sprite that stands upright on the app's dark, tilted map. The prompt is data, not prose:
an **art spec** (`packages/db/src/art.ts`) with three parts, rendered to text by
`renderArtPrompt` right before the model sees it. The API builds one spec per job
(`apps/api/src/modules/art/prompt.ts`) and keeps it in `place_art.prompt`, so any picture can
be drawn again from its record, and the worker writes it next to the picture as `spec.json`.

```json
{
  "version": 2,
  "style": {
    "medium": "A single landmark as a softly shaded, slightly chunky 3D miniature rendered as a sprite ...",
    "camera": "Straight-on front elevation ...",
    "framing": "The tallest element sits exactly on the vertical centre line ...",
    "base": "... one straight horizontal bottom edge ... no ground plane, no cast shadow ...",
    "background": "A perfectly flat, uniform, very dark background, hex #0A0B0D ...",
    "form": "Simplified, chunky geometry with gently rounded edges. Real volume ...",
    "materials": "Matte surfaces: no gloss ... no photorealism, no texture noise.",
    "light": "Key light from the upper right ... amber rim light, hex #FFB224 ...",
    "palette": "Darker and more muted than a toy ... the amber rim is the only vivid colour.",
    "avoid": [
      "text",
      "labels",
      "vignette",
      "sky",
      "people",
      "photorealistic",
      "isometric view",
      "..."
    ]
  },
  "subject": {
    "name": "Charles Bridge",
    "city": "Prague",
    "what": "bridge in Prague, Czech Republic",
    "kind": "bridge",
    "show": "The most recognizable end of the bridge: its tower or gate and two or three spans ...",
    "tallest": "the bridge tower or gate",
    "reference": {
      "url": "https://...jpg",
      "license": "FAL",
      "use": "Shape and proportions only ..."
    }
  },
  "render": {
    "model": "qwen-image-2.1-turbo",
    "size": 1024,
    "steps": null,
    "guidance": null,
    "seed": null
  }
}
```

- **style** is the house style, the same for every place (`ART_STYLE`). Change it there and bump
  `ART_SPEC_VERSION`, so pictures drawn under an older style can be found and redrawn.
- **subject** comes from the place: `name`, `what` (Wikidata's description), `city` read off it,
  `kind`, and the two lines that decide the composition, `show` and `tallest`. Today they are
  the per-kind defaults in `KIND_SHOW`; a line written for the place (by hand or by an LLM from
  its article) goes in the same fields. `reference` is the Commons photo and how to use it.
- **render** is what the worker passes to mflux; `seed: null` means a fresh random seed, a
  fixed seed repeats a picture exactly.

`renderArtPrompt` lays the spec out as: medium, subject (name, show, tallest, reference), then
each style field on its own labelled line, then "Must not contain". `style.avoid` also becomes
the negative prompt for models that take one (Qwen does; the worker passes it).

The background is painted flat dark rather than transparent because no local model paints
alpha; the worker cuts it away with BiRefNet afterwards, crops to the landmark and measures
`anchorX`, the column of its tallest point.

## Trying a prompt by hand

Take the spec from a `place_art` row (or build one) and render it:

```bash
cd apps/api && bun -e 'import {renderArtPrompt} from "@thataway/db/art"; import {buildArtSpec} from "@/modules/art/prompt"; const s = buildArtSpec({name:"Charles Bridge", description:"bridge in Prague, Czech Republic", kind:"bridge", imageUrl:null, imageLicense:null}); console.log(renderArtPrompt(s).prompt)'
```

then `mflux-generate-qwen-2.1-edit --model qwen-image-2.1-turbo -q 8 --image-paths photo.jpg --prompt-file prompt.txt --negative-prompt "..." --output out.png`, `rembg i -m birefnet-general out.png cut.png`. A picture made this way (or anywhere else) goes in with `bun run art -- --place Q204871 --file cut.png`; `--queue` instead lets the worker redraw a place under the current spec.
