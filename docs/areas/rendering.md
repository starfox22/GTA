# Rendering

Everything in `createCityRenderer()` (render3d.js and its include list, render3d-*.js and the
`*3d.js` files). It reads game state and never changes game rules. Quality tiers: quality.js.
The image pipeline, light, searchlights and the cutaway: rendering-lighting.md.

## Cameras and view

- Street: orthographic, looking north and down at ~50°, so roofs and south facades carry the
  look (and anything tall hides what stands north of it). The camera stands clear of the
  tallest roof (`streetCeiling()`); no distance haze on the street.
- Framing (world-view.js): the player's zoom (`STREET_ZOOM` 2 on foot, one `STREET_ZOOM_STEP`
  (x1.25) out from the old 2.5: a person ~26 px tall at 1280x800, ~34 m of street on screen;
  not saved) times a CAMERA CONTEXT share for what they are in (the old shares x1.25, so
  vehicles frame as before: car 0.875 = 1.75, motorbike 0.95, bicycle 1.025, bus/truck/boat
  0.75, aircraft 0.8 = the flight view's old 1.6) times the speed pull-back (from 45 km/h to 0.82 by ~205 km/h), eased as
  `speedZoom` (~1.3 s, drawn frames only), so boarding and stepping out glide. The frame is
  `clamp(viewportHeight * 0.68, 430, 630) / worldZoom` units tall. `cameraView()` reports it.
  Game rules read the same footprint (`crowdViewHalf`: off-screen spawning, with a margin;
  `screenViewHalf`, exact, for `shooterInView`: enemies fire only from on screen).
- Follow (camera-feel.js, game side): `cameraTarget` eases (frame-rate independent) to the
  player plus a smoothed lead along the vehicle's **velocity** (not its nose), on foot the
  run and, in a fight, toward the aim; shorter with police on the tail (chase framing);
  Settings · Driving · Camera look-ahead scales it.
  `kickCamera(heading, units)` drives a spring (`cameraKick`), `shake` a smooth tremor
  (`cameraShakeOffset`); the renderers add both, nothing reads them back. `cameraFeel()`.
- Air / parachute: a perspective camera (flight-view3d.js) framed like the street view (a
  dolly zoom from a 3° lens on the ground to 40° by ~90 m). `camera` is whichever is active.
  **Cull and pick LOD with `viewCenter`, `viewReach`, `viewZoom`**, not
  `cameraTarget`/`worldZoom`.
- The street camera is **pixel-locked** (`lockStreetCameraToPixels`, postfx3d.js, in `render()`
  after the shake): snapped to the scene buffer's pixel grid, so static surfaces never crawl
  while the view scrolls. Move `camera` before that call, not after.
- Haze is `scene.fog` with an aerial-perspective chunk: adjust `fog.density` and `fog.color`;
  `fog.near` belongs to `updateFlightView`. Nothing may lay a uniform wash over the frame.
- From the air: small props drop by `viewZoom`, traffic becomes impostors, and below
  `viewZoom` 0.2 a merged far copy of the scenery (FAR SCENERY) replaces the batches.
- Clouds (clouds3d*.js): a ray-marched layer whose height is the game's (`cloudBaseAt` /
  `cloudTopAt`, clouds.js: ~250-420 m by weather and area), drawn when the flight camera is
  above the lowest cloud, a veil and wisps near the camera in cloud; the same density field
  casts cloud shadows. Contracts and gotchas: rendering-clouds.md.

## Draw-call rules (the performance model)

- Static scenery pushed to `batchGroups` is merged per material and 1024-unit cell by
  `batchStaticGroups()`. Flag animated meshes (or their group) `userData.dynamic = true` and
  per-sign textures `userData.sign = true` so they are left alone. **Share materials** between
  repeated objects or they cannot merge. Merged scenery hangs from per-cell groups hidden out
  of reach (STATIC BATCH CELLS).
- Facades are a handful of shared materials (cityscape3d.js SHARED FACADES): texture repeat
  baked into UVs, tint as a vertex colour, window light as the `cityLit` attribute. A new
  building part uses those or `staticMat()`, **never a per-building `mat()`** (a draw call per
  building).
- Small repeated props: add an InstancedMesh pool in cityscape3d.js `pools`.
- Boat-kit groups are merged by `kitMerge` and must not go into `batchGroups`.
- Matrices: world matrices are updated once a frame just before drawing, and only for what
  is shown; code reading a hidden object's `matrixWorld` calls `updateWorldMatrix()` first.
- Baked ground canvases are released after upload (`releaseBakedCanvases`): nothing may
  repaint them after start-up. Shaders, off-screen passes, one stand-in per vehicle model and the far
  copy's buffers are warmed behind the title (`prewarmShaders`): **rendering-hiccups.md** (what is
  warmed, the first-use log, the rules a new effect follows).
- Lit materials run the BRDF of a point or spot light only where it adds light (DORMANT LIGHTS,
  lighting3d-cutaway.js): the muzzle, fire and searchlight lights stay in the scene at intensity 0 so
  the programs never change, and cost nothing where they do not reach.
- Measure: `DeadEndCity.stats()` (`viewCalls`, `shadowCalls`, parts), `drawProfile()` (calls and
  triangles by name), `renderHiccups()` (first uses, slowest frames), `node tools/dev.mjs profile`.

## Buildings and signs

- cityscape3d.js builds every building from an archetype (`archetypeFor` → `b.archetype`)
  with roofs, plant (recorded as `b.roofKeepOuts`, which the helicopter landing rules read),
  shopfronts, fire escapes, billboards. North Point towers are skyline3d.js (lofted plans).
- Signs: `sign(text, x, z, width, color, vertical, options)` (render3d-streetprops.js), the
  shop atlas and the billboards all paint from the sign design system (signkit3d.js stroke
  font and treatments, signdesigns3d.js families). **No web fonts.** To sign a new business,
  add one line to `SIGN_DESIGNS` copying the nearest entry (unlisted names fall back on
  trade keywords in `designFor`, then the caller's `options.style` hint). Each family paints
  a day face and a glow mask (masks are painted for one night strength, `SIGN_NIGHT`) and
  says how the board is built (`cutout`, `backing`, `lamps`, `marquee`, `flicker`, `light`).
  Families (the business → family table is THE STYLE TABLE in signdesigns3d.js):
  `neonScript` / `neonBlock` (neon tubes), `bulbs` / `cinema` (marquee bulbs), `diner`,
  `lightbox` (backlit panels: hospitals, airports, pharmacies), `enamel` (porcelain: tavern,
  police, transit), `wood`, `stencil` (armories, freight), `deco` (Blue Hour, Deco hotels),
  `carved` (gold leaf: banks, college), `customs`, `airbrush`, `varsity` (stadium, school),
  `painted`, `hand`, `highway` (reflective road signs), `pixel` (LED), `tattoo`, `arabian`,
  `plaque`. Billboards: each advertiser in `SignArt.ADS` has its own painter.
- Small lights are instances of one glow quad (`addGlow`).

## Ground, water, weather

- Ground (ground-shader3d.js, ground-data3d.js, surfaces3d.js): the painted sheets only say
  what lies where; the shader draws asphalt, paving, lawn, loose ground and kerbs in world
  space at screen resolution from a signed distance-to-kerb field (`buildGroundField`) and
  mark records (`buildGroundMarks`, shared with the maps' `cityMarkingShapes`). Everything
  fades what it cannot resolve (no shimmer). The screen-space bump's per-pixel tilt is capped
  (2x2-quad derivatives flipped fringes along marks and kerbs); the excess goes to roughness.
  Fields: city, Monarch, county (6 units a texel), Sunset Pier (`PARK_TILE`, county roads and
  the car park) and Fort Sentinel's own sheet (its tile is registered in `countyTileTextures`
  as `ground: 'fort'`; built in surfaces3d.js). A county material with no tile gets a 1 x 1
  sheet size, which breaks the slab and kerb look-ups. Console `groundDetail()`.
- Scenic roads (county3d-roads.js): a ribbon at `terrainHeight` + 0.12, markings in its
  shader, not in the county kerb field. Scenery-only plants: vegetation3d-landscape.js.
- Wet roads: one shared GLSL pattern (`cityWetLow`, `cityWetFilm`, `cityPuddle`) from
  `weather.wet`; LOW darkens, MEDIUM adds gloss and neon streaks, HIGH/ULTRA add puddles and
  a screen-space reflection pass (skipped when dry). The film levels most of the ground's
  bump (a glossy film on the full aggregate bump glinted pixel by pixel: rain read as snow);
  a wet night road mirrors less sky than by day (`WET_SKY_SHARE_NIGHT`).
- Trees (vegetation3d-material.js): on MSAA tiers the leaf cut-outs use alpha to coverage
  (`setFoliageCoverage`; r160 forces an opaque material's alpha to 1, so the tree material
  writes the coverage back after `<opaque_fragment>`). A/B `lookSwitches({ foliageCoverage })`.
- Water (world3d-water.js): one ShaderMaterial with a distance-to-shore texture, Gerstner waves;
  boat wakes are drawn into a wake map it samples (`wakeEmit`, wakes3d.js).
- Weather visuals (weather3d.js): GPU rain streaks, splashes, drips and spray from uniforms,
  lit by the night light map and the CAR LAMPS (`RAIN_LAMP_GLSL`, the same body frame and
  terrain horizon as lit materials); lightning bolts at a place; `vehicleLampAmount()`. No
  drop falls below the rain box's floor: the street in the city, on the range the lowest
  ground 32 m round the view's subject (≤ 12 m lower, `rainFloor`), so a beam down a descent
  has rain to light; splashes stay on the street; in the air the box rides below the cloud base.
- Tiers (quality.js): pixel ratio, shadows, MSAA, AO, SSR steps, bloom, LOD bias, rain
  density. `DeadEndCity.graphics('high')` in tests: SwiftShader auto-detects as LOW.
  `?shadercheck` in the URL makes three.js report shader compile errors.
