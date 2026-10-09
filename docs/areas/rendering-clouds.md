# Rendering: clouds

The cloud layer (game side, clouds.js) and how it is drawn (clouds3d*.js inside
`createCityRenderer()`). The rest of the renderer: rendering.md; light and post: rendering-lighting.md.

## Where the cloud is (contract)

- **`cloudBaseAt(x, y)` / `cloudTopAt(x, y)` (world units) are the only source of the cloud
  altitude.** `cloudLayerAt(x, y, out)` gives both plus the cover there. Game code, HUD and
  sound read these; the renderer draws the same numbers from the same maps (never a constant).
- By weather (`weather.cloud`, `weather.rain`, over neutral ground): clear ~400 m, fair ~370,
  cloudy ~330, overcast ~300, rain ~270, storm ~250 m. Fair and cloudy are cumulus 250-500 m
  deep with domed tops; overcast is a flatter stratocumulus deck (~260 m, `cloudLayer.deck`);
  rain and storm a deep deck (430-550 m) with scud hanging up to ~65 m under the base.
- By area (clouds.js `cloudAreaMap()`, 128x128 over the world, RGBA bytes): open sea lowers the
  base 20-35 m (more at dawn: marine layer), the city raises it 5-20 m, the Ridgeline lowers it
  by up to 180 m as it gets wet (overcast: just above MOUNT ASCENT, rain and storm: into the
  summits) and adds cover over the peaks. Measured (city / sea / Mount Ascent): fair 384 / 347 /
  330 m, overcast 306 / 267 / ~135 m, storm 254 / 215 / ~70 m (`DeadEndCity.cloudLayer(x, y)`).
- `cloudAmountAt(x, y, z)`: how deep in cloud a point is (0..1) from the coverage map and the
  layer's profile, without the GPU's noise: a likelihood, fine for sound, reports and tests,
  not for pixel-exact decisions. `cloudLayer.immersion` / `playerCloudImmersion()` is that at the
  airborne player, eased: the hook for sound (clouds-audio.js reads it; the parachute's wind can).
- The field drifts: `cloudLayer.windX/windY` (game time); the GPU samples `xz + wind`, so a cloud
  moves the other way to the offset. `cloudSpot(kind, x, y, lead)` aims ahead of the drift.

## How it is drawn

- field: the game's coverage and area maps become textures; `CLOUD_FIELD_GLSL`
  (`cloudDensityAt(p, area, detailed)`, `cloudSlab(area)`) is the one density function the
  march, the veil, the wisps and the shadows share; `syncCloudField(u)` copies the layer in.
- march: half resolution, when `camera === flightCamera` and the camera is above the lowest
  cloud (`cloudLayerBounds`), or from below in the chase view (see below). The flight camera never looks above ~30 degrees below the horizon,
  so a layer entirely above the camera cannot be in view: an aircraft under the base sees only
  the shadows and the dimmer light, never the underside. Rays stop at the hills (the area map's
  ground channel, highest ground per texel) and at the six tallest towers' boxes
  (`cloudTowerBoxes`, >160 m), so a crown or a summit in the cloud fades in with depth and cloud
  behind it never draws over it. Composited behind the subject (a quad at its depth + 70).
- near: the stretch from the camera to the subject is the veil, marched the same way and drawn
  over everything (renderOrder 1100), with a soft cap (`NEAR_CAP`: freefall 0.62, canopy 0.55,
  aircraft 0.45 x its own immersion) so the subject stays readable. The far march starts where
  the veil hands over (`uNearFade`). LOW: no march, a flat veil from `cloudAmountAt`.
- from below (clouds3d-sky.js, the chase view): the sky dome composites the layer behind all geometry.
  HIGH/ULTRA: the march with `uBelow` 1 runs its own loop (`cloudMarchBelow`, clouds3d-march.js): coarse
  steps through clear air growing with the distance (4 % of it, 25-300 m), a step back and quarter steps
  while in cloud, out to 20 km (`SKY_CLOUD_REACH`); no pocket or veil; lit from `skyLightDirection`, the
  base also lit by the sky round about and the sunlit ground. Each frame takes a new step jitter and a
  sub-texel ray offset; SKY CLOUD HISTORY (clouds3d-sky-history.js) averages the frames (reprojected
  through the layer's base, clamped to this frame's neighbours, kept 88 %; restarts on a resize, a camera
  jump of 50 m or a frame without the march) and the dome reads that. LOW/MEDIUM: the dome reads the
  field at two heights where the ray crosses the slab (no detail octave): a soft opacity and a shaded
  underside. Both haze the layer with the air's own visibility (`skyCloudHaze()`: ~30 km fair, ~15 under
  a grey deck, a few km in rain; the chase haze's height fall-off and colour), never the street's haze,
  which closes within the draw distance (with it, everything under ~20 degrees was a milky smear and the
  horizon empty). Same coverage map and noise as the shadows; WebGL1 has none. A camera inside the layer
  (a summit in a wet deck) sees the march round it on HIGH/ULTRA, nothing on LOW/MEDIUM. The flight
  view's march (`uBelow` 0) is untouched: its pixels are identical. Console `skyCloudBench(rounds)`.
- shadows from the street (clouds3d-sky.js): the plane only works for a camera above it, so the chase
  view hides it and finds the shadow per pixel: a quarter-size pass rebuilds each pixel's world point
  from the depth and reads `cloudShadeAt` (CLOUD_SHADE_GLSL, the plane's own field, rings and strength),
  fading under the haze; the composite blends it towards the plane's slate (`uCloudShade`).
- An aircraft keeps its pocket of clear air (walls of cloud, the ground below); freefall has
  none (the white-out is the point), a canopy a thin one. A jumper passes from the freefall
  values to the canopy's (veil cap, pocket, wisps, lens) by `p.opening`, and the streaks and
  lens flow follow the fall rate, so pulling in cloud never pops.
- A jumper in cloud: the sun dims (up to 60 %) and the parachute rig is lit by the cloud's own
  light at its height in the slab (`cloudRigLight`/`cloudRigAmount`, read by
  parachute3d-canopy.js `chuteCloudLit`), about as bright as the veil so white cloth greys
  into it.
- wisps: instanced rags between the near plane and just past the subject, fixed in the air
  (drifting with the cloud) so the camera's motion streams them past, streaked along the
  subject's own velocity (not frame deltas: slow frames would smear them); the vertex shader
  reads the density, so they only show in cloud, and thins those in front of the subject.
  Count by tier (8/14/22/32). The veil's light is also combed into streaks radiating from
  where the camera is heading (`setCloudStreaks`), strongest in freefall.
- lens: water beads in the post composite (clouds3d-lens.js, `cloudLensUniforms`), a jumper's
  camera only (not LOW): gather in cloud, dry after, swept up the frame by the freefall air.
- frame: in cloud the frame greys out (saturation, contrast down, bloom up) through `postLook`.
- Light: `SUN_DIRECTION`, which lighting3d-look.js sets to the real sun (the moon at night);
  Beer's law plus two multiple-scattering orders (clouds glow through; only the heart and base
  of a deep deck go grey); the city's glow on the underside at night. The day sun is whitened
  by half for cloud and most of the day grade's warm gain is taken back out (`uCloudTint`), or
  sunlit cloud turns sand-coloured. Shafts under broken cloud (HIGH/ULTRA): the haze in each
  cloud's shadow column is drawn darker in the far march.

## Gotchas

- Template-literal shaders: no backticks inside GLSL comments (quick-check fails).
- `half` is reserved in GLSL; avoid `near`/`far`/`distance` as names too.
- Headless (SwiftShader) fps is not a real GPU's: compare before/after on the same page only.
- `DeadEndCity.cloudLayer()` reports `view` (the renderer's camera state) only when rendering;
  under `holdSimulation` the view is from the last drawn frame.
- `cloudLayer` follows the weather in `updateCloudLayer` (from updateWeather): while a test holds
  the simulation, call `setCloudLayer()` before reading it (the report and cloudSpot do).
- Night cloud: the moon's share of the cloud light and the city glow are kept small on purpose;
  with the multiple scattering a brighter moon lit night cloud like a sunset.
