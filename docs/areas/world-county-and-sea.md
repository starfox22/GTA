# World: county, terrain, rail, airfields and sea life

The land beyond the Northbank grid and what lives in the water. Coordinates, frames, the
grid, shores and bridges, navigation and layout data: world-and-map.md.

## County, terrain, scenic roads, rail, airfields

- County (county.js): its own roads (`COUNTY_ROADS`, also GPS and police routing), towns and
  scenery. Ridgeline's three towns are planned by mountain-village.js.
- **Ridgeline Range** (terrain.js, drawn by county3d.js): one generated, eroded height field
  (deterministic, typed arrays, built on first use), flattened under rail, towns, helipads and
  the other roads, with two switchback 4x4 trails (`TRAIL_MAX_GRADE` 0.28). `terrainHeight`
  samples the exact Float32 vertices the renderer draws, so contact and picture agree. Console
  `terrain()`.
- **Scenic roads** (terrain-roads/-grading/-roadside.js, `SCENIC_ROAD_NAMES`): corners are
  filleted arcs (kept out of towns; the layout audit notes a crossing per arc segment);
  `road.points` is what everything reads, `road.dense` (4-unit samples) what grading and
  the ribbon read. Graded over the range (8%, spline profile, crown and bank, cut
  and fill), at street level by towns, bridges and other roads; trails start at road level. A
  road or trail that began on a rounded corner is moved onto the curve (don't assume the old
  vertex). County carriageways are tarmac to `offroadDrive` (`offroadState.paved`); rails are
  oriented statics. `scenicRoadNear`'s `t` is positive right of the road's direction (map y
  points south): traffic keeps right. Check `mountainRoad()` and
  tools/tests/mountain-road.mjs after edits.
- `prunePlanTrees` (end of `buildCounty`) drops plan trees on carriageways, in buildings, under
  rail decks, on runways or in doorways (`treeAudit()`).
- Falls (falls.js): on foot, ground dropping away steeper than 1.35 (54°) under a step starts
  a ballistic fall (`player.fall`, a carrier; `settleFootOnGround` replaced the plain terrain
  snap); faces over 45° cannot be landed on (the body slides down, scraping) and where it
  stops the whole height counts. One impact scale (`fallInjury`, falls-body.js): under 6 m a
  stumble, 6-17 m 8-100 hp, beyond dead (a splat: face down, blood pool); water safe to
  20 m/s, fatal from 30. Slopes up to the tumble (terrain-field.js) are unchanged. Console
  group `falls` (`cliffSpot`, `fallTest`, `fallState`, `bailOut`, `parachuteState`,
  `parachuteFallTo`).
- Parachute (parachute.js; parachute3d.js draws it): only an aircraft bail-out (60 m clear)
  starts one; the ripcord is a second `bail` press once the first is let go, and
  `deployParachute()` runs once (`stage` stays 'canopy'). The pull is not an open canopy: the
  DEPLOYMENT stages (pilot 0.7 s, lines 1 s, snivel 1-2 s by pull speed, snap 0.8 s) bring
  in drag gradually, the shock capped at 4 g; from terminal speed it is open 4.5 s / ~175 m
  later, pulled at rest 3.6 s / 54 m, so a 60 m helicopter hop only just makes it.
  `parachuteForecast()` steps that same model at 30 Hz and is the cue's "need" (to 7 m/s):
  change the model there and the cue follows. Cue: OPEN SOON at need + 4 s of fall, OPEN NOW
  at need + 1.5 s (a pull then still lands safe), TOO LOW under need + 2 m; after the pull it
  shows the stage and the height the rest needs. Until `phase` is 'open' the jumper steers
  as in freefall and a roof is an impact; the late-pull hurt band is only ~4 m of pull
  height at terminal speed (the snap takes 28 → 7 m/s in ~12 m). The renderer reads
  `phase`/`phaseK`/`opening`/`load`; the camera jolt is `shake`, set by parachute.js.
- Railway (transit.js, transit3d.js): SHORE LINE (Cruise Terminal → west sea wall → Southport
  Airport), COAST LINE (→ Oceanview → Palmshore), RIDGE LINE (→ Eastgate, Northridge,
  Stonecreek). Each `route` is a control polygon filleted by `railTrackGeometry`; everything
  else reads `line.points`.
- Airfields (airfields.js, airfields3d.js): SOUTHPORT 18/36 (460 m, courier strip on a
  reclaimed pier) and OCEANVIEW 09/27 (1,280 m, jets and the airliner, running out to sea on
  `oceanview-pier`); Fort Sentinel's strip is for helicopters. Runway piers are
  `LAND_REGIONS`. Console `airfields()`.
- Parks (renewal.js `CENTRAL_PARK`, `COMMONS`; streets inside closed by `parkStreetClosed`).
  South Coast Stadium is enclosed: see places-monarch-and-county.md.

## Sea life (sealife.js, sealife-audio.js, sealife3d.js)

- `seaDistance(x, y)` (64-unit chamfer field, built a slice a frame) drives everything;
  `seaNoGo` keeps animals out of marinas and berths; `seaSteer` turns toward open water.
- Dolphin pods, gull flocks (`GULL_FLOCKS`, perches) and one great white. The shark
  encounter (`sharkEncounter`) only builds while the player swims > 30 m out, outside the buoy
  line, not in a mission, with an 8-minute cooldown; beach swimmers are never taken.
- Drawing: one InstancedMesh per species animated in the vertex shader; what is under the
  surface goes into a life map the water shader samples. Console: `sealife()`,
  `sharkAttack(stage)`, `spawnDolphins(...)`.
