# World: Ridgeline terrain, 4x4 trails, the ride on the terrain, scenic roads

Split from world-county-and-sea.md (the county, rail, airfields, falls and sea life stay
there). The hill climb course, the 4x4 club and its trucks: places-monarch-and-county.md.

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
- **Trail dressing** (offroad3d-trail.js, renderer only): a faceted rock sheet over each rock
  section at `terrainHeight + rideRelief` (what the tyres climb is what is drawn), edge
  boulders, marker posts, cairns, logs, the ford's wet stones; all plain static materials in
  the course group, merged per material and cell (`offroad().effects.dressing`). The fords
  (`offroadFords`/`offroadFordWater`, offroad-trails.js) are drawn by the streams' ribbon
  mesh (county3d-forest.js); wading drags and washes the truck and `tyreEmission` gives
  `'ford'`. A keyhole's `berm` sits just outside the carriageway (inside it, the pilot and
  players were thrown wide at the muddy hairpin).
- The trailhead SUV (`spawnTrailVehicles`, terrain-scenery.js) parks in the Mount Ascent car
  park: on the trail it stood in front of the start gate and every run hit it.
- **Trees and the trails** (trail-trees.js): `trailTreeClear(x, y, canopy, height, ground)` is the one rule for a
  tree near a 4x4 trail. The street camera is orthographic at `STREET_PITCH` (slant 560/680), so a tree covers the
  ground north of it out to the slant of its top; trees and the carriageway (half-width + `TRAIL_VIEW_MARGIN`, a
  `TRAIL_VIEW_VEHICLE`-tall truck, pads, summit) are compared in the camera's ground plane, only the part of a crown
  above the trail's ground counting (lower is behind). Negative: the tree could hide a vehicle and is not placed;
  within `TRAIL_TREE_FADE` the forest thins (`trailTreeKeep`). On the map no trunk within `TRAIL_TREE_SHOULDER` of
  the carriageway or `TRAIL_TREE_RUNOFF` outside a hairpin (the hill-climb pilot runs ~6 m wide out of the keyholes). Forest sizes are bounds over the species the renderer
  may pick (`forestTreeBounds`; keep it in step with `forestSpecies` and `TREE_SPECIES` R/H). A new tree placer
  near the trails must ask it; `trailTreeAudit()` checks every path sample independently (`covering` 0).
- **Forest trunks** (forest-trunks.js): every forest tree (`terrainFieldScenery`, the same lists county3d-forest.js
  draws) is a rooted post (`forestTrunkHalf`) in a per-field cell index, resolved after `streetPropContacts` for
  moving vehicles within 1400 units of the player; unbreakable (the tank skips them). Boulders stay scenery.
  Console `forestTrunks()` (no trunk on a carriageway or a trail), tools/tests/trail-trees.mjs.
