# Rendering: ground, water and weather

The ground, wet roads, water, rain and lightning inside `createCityRenderer()` (the rest of the
renderer: rendering.md; light and the post passes: rendering-lighting.md; the sky and the haze:
rendering-sky.md). The weather machine itself is game state (weather.js); these files only draw it.

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
- Asphalt wear (ground-shader3d-albedo.js ASPHALT, all in the road's own frame `rp`): RESURFACING
  stretches 236 units long (each its tone, freshness and age; a sealed joint across the road), thermal
  cracks across older stretches (most sealed with tar), sealed lane joints in runs, trench
  reinstatements and concrete-capped cuts among the utility patches, darker rubbered wheel paths and oil
  strips, and junction boxes (lane-free info cells, read bilinearly: `jb`) polished and oil-dripped. Zebras and stop lines (marks across the traffic) get tyre
  grime and wear in streaks along the traffic (GROUND_MARKS `tyre`). City slabs: relaid slabs, utility
  covers. Wall grime is baked into the city sheet (render3d-terrain.js `paintWallGrime`): translucent
  dark strokes round each footprint, which keep each class's hue (the shader reads classes from it).
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
  The same material carries the foliage cutaway round the player (rendering-lighting.md, Searchlights and cutaway).
- Water (world3d-water.js): one ShaderMaterial with a distance-to-shore texture, Gerstner waves;
  boat wakes are drawn into a wake map it samples (`wakeEmit`, wakes3d.js).
- Weather visuals (weather3d.js): GPU rain streaks, splashes, drips and spray from uniforms,
  lit by the night light map and the CAR LAMPS (`RAIN_LAMP_GLSL`, the same body frame and
  terrain horizon as lit materials); lightning bolts at a place; `vehicleLampAmount()`. No
  drop falls below the rain box's floor: the street in the city, on the range the lowest
  ground 32 m round the view's subject (≤ 12 m lower, `rainFloor`), so a beam down a descent
  has rain to light; splashes stay on the street; in the air the box rides below the cloud base.
- Tiers (quality.js): pixel ratio, shadows, MSAA, AO, SSR steps, bloom, LOD bias, rain
  density. A change that flips shadows or the trees' alpha to coverage is staged (compiled behind the frames, then
  flipped: boot-and-memory.md); post targets are sized lazily (`postSceneTarget()`). `DeadEndCity.graphics('high')` in tests: SwiftShader auto-detects as LOW.
  `?shadercheck` in the URL makes three.js report shader compile errors.

## At street level (the chase view)

Everything above was tuned for the street camera looking down from the south. While the chase view
draws, the same systems switch to numbers for an eye-level perspective camera; the street view and the
air keep theirs exactly (each switch is a uniform, not a new program).

- STREET RAIN (weather3d-chase.js): a near box of short streaks round the camera (`RAIN_NEAR_*`:
  30 m across, 21 m tall, centred 12 m ahead; 700/1300/2000/2600 drops by tier times the rain) runs
  the rain material's own shader (`rainNearMaterial`, one program), lit by the lamps and the CAR LAMPS
  like every drop. Both boxes fall at the side view's speed (`RAIN_SIDE_FALL`, ~26-40 m/s) with
  streaks one film frame long (`RAIN_SIDE_EXPOSURE`), the wind's slant kept. `uNear` keeps drops
  `RAIN_LENS_CLEAR` off the lens (else a line the height of the frame), the nearest brightest.
- Splashes gather within `RAIN_SPLASH_REACH` ahead of the camera at a third of their size, and half
  stand up as crowns facing the camera (`uUpright`; a flat ring is a sliver from the side).
- CHASE RAIN AIR: the haze closes sooner in rain (`CHASE_RAIN_HAZE` in the chase view's Haze lines,
  1.9x at full rain against the street view's 3.6x, `weather3d.js` skips its own multiplier there),
  never over the clear near street (`CHASE_HAZE_CLEAR`, 96 m on HIGH). `chaseRainAir()` (from
  `weatherGrade`, after the environment's refresh) darkens the haze and the dome over it (they share
  `cityHazeColor`), 32 % by day and 50 % at night at full rain: the distance goes dark, not lilac.
- Wet reflections (postfx3d.js STREET LEVEL, `uStreet`): reach `SSR_STREET_REACH` of the draw distance
  (2,640 units on HIGH, was ~600), the first step a share of the point's distance, Schlick's Fresnel
  as a gain at grazing angles, a ray that meets nothing mirrors the sky's own colour that way
  (`cityHazeColor` at the ground's sky share, `postLook.reflectShare`, rising to all of it at grazing),
  40 % of the glossy jitter, its noise running down the frame (along the blur, which then averages
  it) and a longer blur. The street view passes (0, 1, 0, 0): unchanged output.
- The wet film at grazing views (`wetGraze`, ground-shader3d-albedo.js): it levels up to 97 % of the
  aggregate's bump and evens the grain in its roughness, as the view flattens (an eye-level view
  along a wet street sparkled pixel by pixel, a snow of specks); 0 from the street camera.
- The ground's lamp streaks (surfaces3d.js `GROUND_WET_LIGHT`; `citySheenDir` 0 is the street-level
  flag) run away from the camera through each point and sample the light map 1.2-4.7 times the
  point's distance beyond it; without the reflections pass the film's flat sky rises with Fresnel.
- Wet neon streaks (signage3d.js `uStreakView`) turn towards the camera, up to 1.8 times their
  length and 72 % of the distance (never under the camera), at 55 % while the reflections pass runs.
- Roof drips stand round a point `DRIP_STREET_AHEAD` ahead of the camera on the faces it sees (the
  view's centre lies far down the street there). Every view: the mist behind a car carries its tail
  lamps' red at night (`aTint`, brighter braking) and uploads only the particles written that frame.
- Console `rainView()`: both boxes, the near box, splashes, haze, the reflections' street terms.

Gotchas: `cityHaze*` are rewritten every frame by `updateHaze`; darken them only after
`refreshEnvironment` (weatherGrade), or the environment's light changes with the rain. The splash
crowns' side vector and the streak turn read `cameraPosition`: correct for any perspective camera.
