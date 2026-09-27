# Rendering

Everything in `createCityRenderer()` (render3d.js and its include list, render3d-*.js and the
`*3d.js` files). It reads game state and never changes game rules. Quality tiers: quality.js.

## Cameras and view

- Street: orthographic, looking north and down at ~50°, so roofs and south facades carry the
  look (and anything tall hides what stands north of it). The camera stands clear of the
  tallest roof (`streetCeiling()`); no distance haze on the street.
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
- Clouds (clouds3d.js): ray-marched cumulus at 385-610 m, drawn only when the flight camera
  is above the base; the same density field casts cloud shadows.

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
  repaint them after start-up. Shaders are compiled behind the title (`prewarmShaders`).
- Measure: `DeadEndCity.stats()` (`viewCalls`, `shadowCalls`, parts), `drawProfile()`.

## Image pipeline (postfx3d.js, lighting3d.js)

- The scene renders into a half-float HDR target (MSAA on HIGH/ULTRA), then SAO, wet
  reflections, bloom, one composite (exposure, ACES, grade + vibrance, vignette, dither) and
  FXAA on **every** tier (MSAA resolves light before the tone curve: bright edges, leaf
  cut-outs and glints stayed stepped and flickering on HIGH/ULTRA without it). The half-res AO
  is upsampled depth-aware (`compositeAo`), not bilinearly (shade fringes at silhouettes).
  `renderFrame()` replaces `renderer.render()`.
- Custom `ShaderMaterial`s that compute final screen colours (the water) end with
  `#include <city_hdr_output>` (and include `<city_hdr_pars>`) to invert the tone curve;
  unlit `MeshBasicMaterial`s with `toneMapped: false` (signs) get this automatically.
- Half-resolution passes that read full-resolution depth fetch at texel centres from
  `gl_FragCoord` (a nearest fetch at the corner of four texels flipped with rounding and
  printed horizontal stripes through the frame).
- Shaders needing the scene buffer's pixel size use `sceneBufferSize()`, not the canvas
  (adaptive quality renders at a share of the canvas, `setRenderScale`).
- Bloom sanitises NaN and half-float overflow before the mip chain (they became black or
  white squares) and weights taps by 1 / (1 + brightness).

## Light

- Sun and sky (lighting3d.js): `sunDirection` follows the clock; the shadow box is fitted to
  the view and texel-snapped (`placeSun`); the sky is PMREM-filtered into
  `scene.environment`. Shadows are redrawn every frame when on (kept maps trailed moving
  objects); with shadows off, contact blobs (CONTACT SHADOWS).
- Night light: lamp, window and neon pools painted once into a city-wide light map;
  `cityMaterialPatch` (MeshStandardMaterial's default `onBeforeCompile`) adds it to lit
  surfaces. **A material with its own `onBeforeCompile` must call
  `cityMaterialPatch(shader)` first.** A knocked-down lamp removes its pool
  (`lampLightSwitch`). Monarch Isle has its own map.
- Vehicle lights (lighting3d-vehicle-lights.js): the player's car, then the cars nearest the
  view (`carLamps` 1/4/8/12 by tier) are CAR LAMPS, real lights in `CITY_LIGHT_APPLY` from
  fixed-size uniform arrays (`cityCarLampA/B` + count: no recompiles), with the LOW BEAM pattern
  (`cityLowBeam` GLSL = `lowBeamIntensity` JS, keep in step) through `RE_Direct` with the
  **unbumped** normal (grazing light on the ground bump turned to salt and pepper) and a soft
  cap. Other cars: the same beam in the DRIVE LIGHT MAP, with tail/brake/reversing washes. The
  player's beams are shadowed by people and cars (BEAM SHADOWS mask). Halos glow HDR-bright
  facing the camera (`queueVehicleHalo(sprite, opacity, facing, gain, tint, size)`). Console
  `headlights()`, A/B `lookSwitches()`.
- Sign emissive is multiplied by `cityPower()` so the blackout job darkens districts.
- `NIGHT_LOOK`: a readable blue-hour night; no light follows the player (only an optional
  rim, Settings · Graphics · Player outline).
- Glass: `useCityGlass(material)` for facade glass reflections.

## Searchlights and cutaway

- Searchlight shafts (searchlight3d.js) march the view ray through a cone analytically.
- The police helicopter's light is a real SpotLight (always in the scene, intensity 0 when
  idle, so no program switches) with a cookie; its brightness is set as exposed light so
  pale paving does not clip. The shaft is a HIGH/ULTRA garnish cleared round the target.
  Under overhead cover the light lands on the roof (`searchlightLanding`, via
  `overheadCoverHeight` / `overheadCover`), with a shadow-only stand-in box on the roof. The
  beam starts at `helicopterSearchlightMount(h, out)`. Console `searchlight()`.
- Cutaway (`updateCutaway`): a player-sized dithered hole through the structure between
  camera and player, or through a roof directly over them (`airCoverVolumes()`, buildings,
  roofs registered with `registerCutawayRoof`). Vehicles, people, trees and props are never
  cut. Settings switch: `city3D.setCharacterCutaway(on)`, saved as `dead-end-city-cutaway`.

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
  Console `groundDetail()`.
- Wet roads: one shared GLSL pattern (`cityWetLow`, `cityWetFilm`, `cityPuddle`) from
  `weather.wet`; LOW darkens, MEDIUM adds gloss and neon streaks, HIGH/ULTRA add puddles and
  a screen-space reflection pass (skipped when dry).
- Water (world3d.js): one ShaderMaterial with a distance-to-shore texture, Gerstner waves;
  boat wakes are drawn into a wake map it samples (`wakeEmit`, wakes3d.js).
- Weather visuals (weather3d.js): GPU rain streaks, splashes, drips and spray from uniforms,
  lit by the night light map; lightning bolts at a place; `vehicleLampAmount()`.
- Tiers (quality.js): pixel ratio, shadows, MSAA, AO, SSR steps, bloom, LOD bias, rain
  density. `DeadEndCity.graphics('high')` in tests: SwiftShader auto-detects as LOW.
  `?shadercheck` in the URL makes three.js report shader compile errors.
