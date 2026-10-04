# World: county, terrain, rail, airfields and sea life

The land beyond the Northbank grid and what lives in the water. Coordinates, frames, the
grid, shores and bridges, navigation and layout data: world-and-map.md.

## County, terrain, scenic roads, rail, airfields

- County (county.js): its own roads (`COUNTY_ROADS`, also GPS and police routing), towns and
  scenery. Ridgeline's three towns are planned by mountain-village.js.
- **Ridgeline Range** (terrain.js, drawn by county3d.js): one generated, eroded height field
  (deterministic, typed arrays, built on first use), flattened under rail, towns, helipads and
  the other roads, with two 4x4 trails (`TRAIL_MAX_GRADE` 0.28; bare rock `TRAIL_ROCK_GRADE`
  0.36 on a trail's `steep` stretch). `terrainHeight` samples the exact Float32 vertices the
  renderer draws, so contact and picture agree. Console `terrain()`.
- **Trails** (terrain-noise.js, graded in terrain-field.js): Mount Ascent is laid by hand
  (`laidTrail`: control points and keyhole hairpins round their pad centres), Needle Ridge is a
  `switchbackTrail`. Grading clamps the relief to the grade band, then a trail's set pieces
  (`ford` dip, `camber` cross-fall, `steep`, `summitLift`), then averages the grades over nine
  samples twice: every crest and dip is a vertical curve (a grade clamped to the limit used to
  turn a 0.4 corner in one sample, which threw trucks into the air). Moving a trail shifts its
  fractions: re-derive OFFROAD_SECTIONS, `ford`/`camber`/`steep` and check `trailProfile`.
- **Ride on the terrain** (terrain-suspension.js, `rideStep` from `terrainVehiclePose`): four
  tyres on spring-dampers (`rideModel` from the spec's `travel`), each on the tyre-rounded
  ground (`rideTyreGround`, plus `rideRelief` rock on rock sections); the body heaves, pitches
  and rolls (load shifts downhill). Through the bump stops the corner's speed into the ground
  is taken out along the normal (a bank stops a truck instead of launching it); tyre load acts
  along the ground's normal: offroadDrive/offroadPaved read `rideLoad` (grip) and `rideAx/Ay`
  (the push down a slope) through `rideLoadShare`/`rideGroundPush`. While it holds a vehicle
  the falls state is pinned to the ground; every wheel 0.6 m clear hands it to
  `startCliffFlight`. `rideLift` is drawn only (`entityElevation` stays on the ground);
  `rideActive` false = settled (`settleIsTrivial` checks it). Console `ride3d()`, `trailDrive`
  telemetry; tools/tests/hillclimb-physics.mjs.
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
  DEPLOYMENT stages of a sport ram-air main from 54 m/s belly freefall: pilot 0.8 s (throw,
  pin, bag lift), lines 1 s (line stretch 1.8 s / ~95 m after the pull, ~50 m of it paying
  out), snivel 1.1-2 s by pull speed (the slider holds it, cells fill centre out), snap 0.9 s
  (slider down, end cells last). Pulled at terminal it flies 4.7 s / ~200 m later at ~7 m/s,
  the load easing to a 3.8 g peak (`PARACHUTE_OPEN_SHOCK` is a soft tanh cap, not a clip);
  pulled at 30 m/s 4.3 s / 138 m, from a hover 3.8 s / ~57 m (a 75 m hop with an instant pull
  just makes it). `parachuteForecast()` steps the same model at 30 Hz and is the cue's
  "need" (to 7 m/s); `p.safeLost` records the same point in flight and the test holds them
  equal: change the model there and the cue follows. Flying, the canopy is on its
  deployment brakes (`p.brakesSet`, 15 km/h) for `PARACHUTE_BRAKES_SET` 1.4 s (or until the
  first steer or flare), then surges to trim. Cue: OPEN SOON at need + 4 s of fall, OPEN NOW
  at need + 1.5 s (a pull then still lands safe), TOO LOW under need + 2 m; after the pull it
  shows the stage and the height the rest needs. Until `phase` is 'open' the jumper steers
  as in freefall and a roof is an impact. The renderer (parachute3d*.js) reads
  `phase`/`phaseK`/`opening`/`load`/`brakesSet`/`flown` and the velocity (its pendulum is
  driven by the rig's forward acceleration); the camera jolt is `shake`, set by parachute.js.
  Every rig object is `userData.dynamic`: without it the detail pass hid the canopy from
  the flight camera high up. Console `parachuteView()` reports the rig as drawn.
- Ships' decks (deck-landing.js): `deckSurfaceAt()` (topmost deck: a liner's promenade deck or
  deckhouse roof, the yacht's highest level) is part of `parachuteFloor`, and
  `deckLandingStep()` runs in updateParachute before the ground: an open canopy on a free spot
  stands the player there (`player.deck`, carried); the impact is the descent plus the speed
  across the deck, relative to the moving ship, past `DECK_RUNOUT` (riderInjury 'tumble'); a
  blocked spot settles within 30 units or glides to a lower deck (else off her side);
  freefall is an impact on the deck. A boat has no deck: down beside her, swimming (E boards);
  fixed hulls set the jumper clear. Console group `decks`: `deckLanding`, `deckJump`, `canopyOver`.
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

## Roadside boards (county-guide-signs.js, county3d-signs.js)

- No board stands on or across a carriageway. `COUNTY_GUIDE_SIGNS` (EAGLE PASS, OCEANVIEW /
  AIRPORT, CORAL COAST), the SCENIC VIEW lay-by signs, the town name boards and the
  trailhead boards are drawn by `roadsideSign()`: a 4-9 m board on two posts, bottom edge 2 m
  up, at the spot `signSpot()` finds clear of every road by `SIGN_VERGE` (12 units; the
  nearest clear ground within 60, else the board is left out: NEEDLE RIDGE's trailhead
  is on a junction). A `sign()` alone floats at 5 m with no posts and faces south: never
  call it for scenery in open country. Console `guideSigns()` lists every board with
  `onAsphalt` and `clearance`; test road-signs.mjs keeps them off the road.
