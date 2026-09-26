# Core structure and data contracts

Read this before touching physics, rendering or anything that moves the player.
Where a file lives: `grep -i <word> docs/FILEMAP.md`.

## One closure, many files

- `src/main.js` wraps everything in `function startDeadEndCity(ASSETS) { … }`;
  `src/game.js` is the ordered include list of the game. Every other `src/*.js` is a
  *fragment* of that closure, pasted verbatim where `// @include src/<file>.js` appears
  (recursive). Fragments share variables freely: no `import`/`export`, no wrapping IIFE.
- Two scopes matter:
  - **Game closure** (game.js and what it includes): simulation, missions, UI, input.
  - **Renderer closure**: `createCityRenderer()` in `src/render3d.js` and the `*3d.js`
    files it includes. It reads game state but **never changes game rules**.
- Order matters only for top-level `const`/`let` read while the closure is being set up
  (function declarations are hoisted). A new game file goes into `src/game.js` (or the
  parent include list of its area); meshes go into render3d.js's list.
- Parent files named `<parent>.js` with siblings `<parent>-<area>.js` are include lists
  after pure-move splits. `game-console.js` is the console registry: each
  `game-console-<group>.js` is a self-contained `addConsoleMethods(group, {...})` call
  (see testing-and-console.md).
- `src/asset-loader.js` sits outside the closure: it decodes the embedded media blocks
  (or, in a split build, returns the `data-src` URL of a streamed file) and calls
  `startDeadEndCity(ASSETS)`. `src/shell.html` holds the DOM and CSS.
- The top of `src/shell.html` has a SUBSYSTEM INDEX and AUDIT CONTRACTS comment from the
  original upload. It is informative but not maintained (FILEMAP replaces the index), and
  one line is stale: it says 512 units = 100 m; the scale is **512 units = 64 m**.

## Units and scale (game-state.js WORLD SCALE)

- Map coordinates are `(x, y)` in world units, `UNITS_PER_METRE` = 8: a 512-unit city
  block is 64 m (Monarch Isle's grid is 800 units = 100 m). `WORLD_SIZE` 11264,
  `CITY_SIZE` 5632; the county lies beyond.
- Write speeds and accelerations in real units: `50 * KMH`, `0.8 * GRAVITY`
  (`GRAVITY` = 9.81 × 8). Derived: `METERS_PER_UNIT`, `KNOTS`, `worldMeters()`,
  `distanceLabel()`, `speedKmh()`. Every readout goes through these.
- Heading `a` is radians; `vx/vy` units per second; `av` radians per second. In Three.js
  a map point is `(x, elevation, y)` and model yaw is `-a`.
- People: `PERSON_HEIGHT` 1.75 m to the crown at look height 1; `PERSON_SCALE` (14/17.4)
  only converts offsets measured on the old 17.4-unit figures.
- Buildings: `STOREY` 3.2 m over a `SHOP_FLOOR` 4.5 m ground floor, `DOOR_HEIGHT` 2.3 m.
  The city plan still writes heights in old plan numbers; `realBuildingHeight(plan)` turns
  them into real storeys (thresholds on heights must use it too).
- Vehicles: `VEHICLE_DEFINITIONS` `l`/`w` in metres × `UNITS_PER_METRE`; `modelScale` is
  the scale a model is drawn at (1 = built at real size). See vehicles-and-driving.md.
- Check the whole world with `DeadEndCity.scaleReport(radius)`.

## Entity contracts

- Compact keys are contracts: `hp`, `maxhp`, `a`, `w/l`, `hx/hy` (collider half extents),
  `vz`, `inv` (invulnerability seconds), `sinkDepth`.
- `entityElevation(e)` is the **only** correct height comparison (roofs, decks, terrain,
  boats, sinking cars, aircraft). Aircraft `altitude` is absolute; `aircraftClearance()`
  subtracts the terrain or the flat roof under a helicopter (`c.roofSite`).
- **Carriers**: the player is held by one at a time: `player.car`, `player.roof` (Blue
  Hour terrace), `player.buildingRoof`, `player.deck` (superyacht, liner),
  `player.parachute`, `player.coaster` (Falcon and Sunset Eye), `player.pool`,
  `player.thrown`, `transitRide`, `taxiRide`, or the water (`swimming`, `wading`,
  `climbing`). `teleportPlayer()` lets go of all of them; anything that moves the player
  must go through it, and death and mission resets must release any new carrier.
- `solid(x, y, r, overWater)` is the one collision test for people; vehicles collide with
  `staticBodies` (`addStatic`, looked up through `staticGrid`). Barriers come from one plan
  read by both renderer and colliders (quay railing `promenadeSpots()`, street ends
  `streetEndPlan()`). On foot the player is also stopped by `footObstacleBlocked`
  (furniture registered with `registerFootObstacle`, trunks, standing props).
- Vehicle fields the physics step writes are all declared up front in `makeCar()`
  (game-car-spawn.js) so every vehicle shares one object layout; add new per-step fields
  there with the value readers treat as "not set".
- Contracts other code relies on: `vehicleSpec()`, `c.braking`, `spec.abs/esc/tcs`,
  `helicopterSearchlightMount(c, out)`, `overheadCover()` / `overheadCoverHeight()`
  (air-cover.js), `DEMO_BUILD` (game-state.js).

## Time, input, saves

- Timers are seconds, frame timestamps ms. Physics runs in fixed 1/120 s steps.
  `worldMinutes` advances one game minute per real second; `daylight()` returns 0..1.
- Input goes through named actions (controls.js): `keys.KeyW` means "the forward action is
  held" whatever key is bound. See ui-and-settings.md.
- Save data: localStorage `dead-end-city-v1` (campaign, cash, clock, weapons). Settings keys
  share the prefix: `dead-end-city-settings`, `-controls`, `-hud`, `-graphics`,
  `-frame-limit`, `-fps`, `-touch`, `-cutaway`, `-shadows`, `-radio-v2`, `-driving`,
  `-garage` (owned cars), `-hillclimb`, `-demo`. Adding a mission needs no schema change.

## Performance rules (docs/audit/performance.md)

- Hot simulation paths do not allocate per call: grids are reused with lazy per-stamp
  resets, `contactShape()` returns the vehicle's own box record.
- `landAt()` (geography.js) is called for every hull corner of every moving car each step:
  it reads a 16-unit cell cache; keep it cheap.
- Buildings are bucketed in `buildingGrid` for `solid()`/`shotBlocked()`; people in a
  64-unit neighbour grid rebuilt once a frame (`forEachPedestrianNear`); use those instead
  of scanning lists.
- Distant things think less: far traffic re-plans at 4 Hz, off-screen pedestrians every
  4th-6th frame, parked cars skip land checks.
- Measure with `DeadEndCity.stats()` (CPU ms per subsystem, draw calls, triangles) before
  and after any hot-loop change; `drawProfile()` lists draw calls by object and cell.

## Known limitations

- The 2D fallback (no WebGL) draws the city flat from the ground canvas: no roof plant,
  shopfronts or decks; every flat roof counts as landable there.
- Traffic never overtakes; pursuit in the county uses only the county road graph.
- The player cannot jump between roofs; a building roof is left only by helicopter.
- Open observations from QA passes are at the end of the logs in `docs/audit/`.
