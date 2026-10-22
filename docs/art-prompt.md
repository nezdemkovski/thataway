# Illustration prompt

Every place may carry one generated picture (`place_art`, `GET /art/:id.png`), drawn as a
sprite that stands upright on the app's dark, tilted map. The style part below is the same for
every place; the place part is filled from `place` (`name`, `description`, `kind`, `imageUrl`)
plus one line saying what to show.

## Style

```
A single landmark rendered as a softly shaded 3D-looking sprite for a dark game-style map UI.

Camera and framing: straight-on front elevation, camera at the height of the landmark's middle, tilted down by at most 10°. No isometric or three-quarter angle: the landmark faces the viewer like a card standing upright. The tallest element sits on the vertical centre line of the image. The silhouette fills about 80% of the square along its larger side, with the rest as margin; prefer a tall composition over a wide one. A long object (a bridge, a square, a park) is reduced to its most recognizable part, never the full span. The bottom edge of the landmark is one straight horizontal line across its whole width, so it can stand on a surface; below it only a faint soft darkening, no ground plane, no cast shadow. Square 1024×1024, fully transparent background (PNG with alpha).

Form: simplified chunky geometry with rounded edges, like a well-made game sprite. Volume comes from shading only: soft gradients on the facades, a few degrees of visible thickness on the right side, ambient occlusion in recesses. Keep only the features that make the landmark recognizable at 48 px; drop fine ornament, people, vehicles, birds, sky, water beyond a thin dark strip.

Materials and light: matte, no gloss, no outlines, no photorealism. Key light from the upper right, cool and soft; a warm amber rim light (#FFB224) along the right and top edges. Overall darker and more muted than a toy: stone in warm grey-beige, roofs near-black slate, metal and domes desaturated by about 40%, no bright gold, no saturated blues or greens. The amber rim is the only vivid colour.

Must not contain: text, labels, logos, watermarks, frames, vignettes, sky, clouds, ground, people, vehicles.

Consistency: every landmark in the set shares the same frontal camera, the same light direction, the same simplification and the same rim strength.
```

## Place

```
Landmark: <name>, <city> — <description>.
Category: <kind>. <what to show: the most recognizable part, which element is the tallest>.
Reference for shape only: <imageUrl>
```

In the pipeline the style lives in `apps/api/src/modules/art/style.txt` (keep the two in step)
and the place part is built by `apps/api/src/modules/art/prompt.ts` from the place's name,
description and kind. The worker swaps the transparent-background sentence for a flat
`#0A0B0D` ground and cuts it away afterwards with BiRefNet, because no local model paints alpha.
A picture made by hand goes in with `bun run art -- --place Q204871 --file Q204871.png`.
