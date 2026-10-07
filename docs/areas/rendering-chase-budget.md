# Rendering: the chase view's draw budget (CHASE PROPS, PARTS, HAZE SIZES)

The chase view sees down the street to the tier's draw distance (rendering-chase.md), and without a budget
every small thing a static group holds drew out to the far clip, 90% hazed: at MEDIUM on Royal Ave
(looking west) 316 calls of static groups' parts, 189 of them 400-600 m out. Everything here is the
renderer's (chase-view3d-props.js, chase-view3d-casters.js); the game never reads it, and outside the chase
view every mesh is back as it was.

## The size rule (CHASE PROPS)

- A prop is drawn while its largest side (height included) would be ~4 px at 720 lines in clear air:
  `size * CHASE_PROP_PIXELS / lodBias > distance` (horizontal, from the box's centre); it casts while
  `size * CHASE_PROP_SHADOW / lodBias > distance` (about 12 px).
- CHASE HAZE SIZES: where the haze has taken most of a prop's contrast it must be bigger to stay, enough to
  keep its contrast over its area that of the clear-air prop: `size / sqrt(1 - haze)` against the clear-air
  size (the threshold of a faint spot goes with contrast times area). `1 - haze` is `exp(-reach^2)` on the
  fog chunk's own curve (aerial-haze3d.js, at the camera's height; rain thickens it; a prop whose top
  stands above the lens is judged through the thinner air of `cityHazeReach`'s column), floored at
  `CHASE_HAZE_SEEN_LEAST` (0.04: at most 5x the clear size); one table per frame (`chaseSizeTable`, 64
  steps of the far clip, interpolated). At MEDIUM, clear air against haze: 1.8 against 2.8 m at 300 m, 2.4
  against 6 m at 400 m, 2.7 against 10 m at 450 m.
- Lights (`lit`: sprites, points, unlit materials, an emissive colour or map, a material without fog) count
  the haze by day only (`nightAmount`), and at night are drawn down to about a pixel (`CHASE_LIGHT_GAIN`, 4):
  a lamp or a lit sign shows through the haze and far beyond its size.
- Past the closed haze nothing is drawn: a fogged prop whose nearest view depth is beyond
  `CHASE_HAZE_CLOSED` (0.97) of the far clip, where the fog chunk's floor makes everything the haze colour
  (`chaseDepthHidden`, `chaseBoxDepth`; also tree pools and effect sprites).
- A drawn prop stays until it is `CHASE_PROP_KEEP` (0.94) of the size asked: nothing flickers on the line.

## What it covers

- Detail-layer meshes of the static cells (sized at boot by `cellStatics`), as before.
- CHASE PARTS: every other mesh, line, points and sprite of a celled static group on the default layer that
  is under `CHASE_PART_LARGEST` (320 units) and in no `userData.dynamic` branch: what the batcher left as it
  was (signs, glass, lamps, unlit and multi-material parts, the glows). Listed in `cellStatics`.
- Signs hung on the scene (`sign()`, `signMeshes`) and their backing boards.
- Small merged batches (one material of one small thing in a cell), by their bounding sphere.
- Breakable furniture pools by the nearest point of their bounds; tree pools only past the closed haze
  (they keep vegetation3d-species.js's near / mid switch).
- CHASE VEHICLE PARTS: a full vehicle model's unlit parts under 5 m (wheel nuts, hubs, mirrors, trim; never a
  lamp, which shows as a bright point by day too) by
  the vehicle's distance (`chaseVehicleParts`, render3d-frame.js); the list is made again, everything put
  back first, when the model is merged, split or reshaped (`m.merged`, `m.shapeVersion`).
- Effect sprites (sparks, puffs, dust, blood drops) down to about a pixel in clear air (`CHASE_LIGHT_GAIN`:
  an impact is feedback), bigger in the haze, never past the closed haze (`chaseSpriteHidden`, from the effect
  pool's draw, fx3d-particles.js): a shoot-out 400 m away drew 45 sprites into the haze.

## Shadows

- Inside a static batch or breakable cell that can cast (CHASE SHADOW CASTERS), each batch and pool is
  tested on its own box (a cell's batch of one material is often one building); inside a static cell, each
  prop and part. A small batch casts only within its size times `CHASE_PROP_SHADOW` / lodBias.
- Those tests hide for the pass only (`visible`). castShadow is written only on meshes the far copy does
  not own: a mesh in `farHidden` has its castShadow set by updateFarScenery on every change of view, so it
  is `farOwned` and only ever tested per pass.

## Gotchas

- Hiding is by layer mask 0 (nothing else writes those layers; it also keeps a mesh out of the shadow pass,
  which tests the view camera's layers) and castShadow, never `visible` (the game's own switch) and never a
  light. A new part that moves must sit in a `userData.dynamic` branch or it would be judged where it was
  at boot.
- `lookSwitches({ chaseBudget: false })` restores every part, sign, batch and vehicle part and runs the old
  rules (clear-air props, per-cell shadow tests): an A/B of the picture in one page.
- `chaseCamera().view.props`: `detail` (all entries, parts included), `parts`, `partsHidden`, `signs`,
  `signsHidden`, `pools` (breakable and tree pools); `draws` adds a `px<N` band (size on screen).

## Numbers

Seeded page (`dev.mjs start --render --seed 1`), 15:00, Royal Ave at (1152, 1160) looking west down the avenue
to the water (`chaseLook 0 0 180 2`) and Midtown at (2100, 2000) looking north (`chaseLook 0 0 -90 2`), read
after three drawn frames at the tier (`chaseCamera().view.draws`: camera and shadow calls). The vehicle row
moves by +-20 between runs (models built per frame, impostor pools); the rest holds to a few calls.

| spot / tier | total | view | shadow | triangles (k, both passes) |
| --- | --- | --- | --- | --- |
| avenue LOW | 543 -> 474 | 543 -> 474 | 0 -> 0 | 885 -> 904 |
| avenue MEDIUM | 1304 -> 913 | 841 -> 636 | 463 -> 277 | 1614 -> 1646 |
| avenue HIGH | 1461 -> 989 | 889 -> 682 | 572 -> 307 | 1803 -> 1739 |
| avenue ULTRA | 1553 -> 1117 | 920 -> 777 | 633 -> 340 | 1955 -> 1863 |
| midtown LOW | 420 -> 381 | 420 -> 381 | 0 -> 0 | 990 -> 943 |
| midtown MEDIUM | 818 -> 704 | 479 -> 453 | 339 -> 251 | 1859 -> 1766 |
| midtown HIGH | 1039 -> 878 | 628 -> 562 | 411 -> 316 | 2157 -> 2052 |
| midtown ULTRA | 1488 -> 1243 | 1024 -> 918 | 464 -> 325 | 2775 -> 2678 |

CPU per drawn frame, MEDIUM on Royal Ave, the budget off and on in turn in one page (`dev.mjs cpucost 30`, a
loaded machine): the page's renderer process 55.7 and 45.7 off, 42.9 and 40.0 ms on (about 18% less); the GPU
process (software GL, the pixels) unchanged at ~7.6 s.

Same page, budget off and on (`lookSwitches`), 960 x 600 PNGs: MEDIUM and HIGH at both spots and MEDIUM at
22:00 differ by a couple of 2-4 px specks (parts under the size rule) and nothing else.

LOW stays near 470 on the avenue: what is left is near the camera and drawn whole (the crowd's part pools,
the breakable pools of the camera's own 2048-unit cell, one body-impostor pool per car type, the near cells'
batches); a pool by instance or a merged crowd would be the next step.
