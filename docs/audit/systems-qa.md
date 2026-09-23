# Open-world systems QA

Play-test of the open-world systems after the railway, beach, superyacht, damage, flight
camera, crowd, roadblock and bicycle overhauls. Each entry: symptom, cause, fix,
verification. Tests were driven headlessly through `window.DeadEndCity` and `simulate()`
(see docs/DEVELOPMENT.md); timings come from `DeadEndCity.stats()` parts and Chrome CPU
profiles of `simulate(4)` with the frame loop stopped, on a shared, heavily loaded
4-core machine, so absolute numbers are noisy: compare the ratios.

## Performance

Baseline, per simulation update (1/30 s, four physics steps), 649 pedestrians and 189
vehicles, standing in the Old Quarter / driving a sedan on Harbor Ave:

| Part | Before | After |
| --- | --- | --- |
| whole update (standing) | 71 ms | ~16 ms |
| whole update (driving) | 72 ms | ~10 ms |
| `cars` (updateCars + physics) | 32-33 ms | 6-10 ms |
| `people` | 14-16 ms | 2.3-2.7 ms |
| `ui` (HUD refresh, averaged per update) | 13.6-14.2 ms | 0.5 ms |

### P1. `landAt()` was over half of all simulation time
- Symptom: CPU profile of `simulate(4)`: `landAt`/`pointInPolygon` 59% of samples.
- Cause: every moving car tests its four hull corners with `groundAt()` every 1/120 s
  physics step, every footstep goes through `solid()` → `groundAt()`, the sinking check
  and the minimap promenade painter call it too, and each call ran point-in-polygon
  against all nine land/lake polygons (up to 165 vertices).
- Fix: `landAt()` (geography.js) now reads a lazily filled 16-unit cell cache. At first
  use every coast/lake edge flags the cells it touches (segment vs. box test); cells with
  no edge are uniformly land or water, computed once at their centre and remembered; only
  flagged cells (~1.3% of the grid) run the exact test (`landAtExact`). The grid rebuilds
  itself if the region count changes (county.js appends regions after geography.js).
- Verified: 1,000,000 random points over the whole county, cached vs exact: 0
  mismatches.

### P2. The minimap repainted the whole county on every HUD refresh
- Symptom: `ui` part ~40 ms per HUD refresh (the HUD refreshes every 0.09 s); profile
  shows `drawMap` → `paintDistrictGround` → `paintPromenades` (shoreline tests).
- Cause: `drawMap()` redrew the land, every street, parks, promenades, the county ground
  and every building footprint as vectors eleven times a second, though none of it
  changes after startup.
- Fix: the static layers moved into `paintMapBase()`; the minimap paints them once into an
  offscreen canvas at its fixed scale (`minimapBaseLayer()`) and copies the window around
  the player, snapped to whole pixels. The zoomable city map still paints vectors.
- Verified: screenshot of the minimap matches the previous look; `ui` 13.6 → 0.5 ms.

### P3. Car/pedestrian contact scanned every pedestrian per car
- Cause: `updateCars` tested all ~650 pedestrians (plus enemies, gangs, officers) for each
  car within 800 units of the player, every frame.
- Fix: pedestrians come from the crowd's neighbour grid (`forEachPedestrianNear`) with the
  query grown by the distance the car covered this frame (the contact test is swept);
  the short enemy, gang and officer lists are still walked directly.
- Verified: a sedan launched at 25 m/s into a pedestrian 45 units ahead knocks them down
  (and one 90 units ahead sidesteps, as before).

### P4. Parked cars paid for land and terrain checks every physics step
- Cause: the post-step "stay on land" test (`corners(...).some(!groundAt)`) and
  `terrainVehiclePose()` ran for all ~190 vehicles 120 times a second, although most are
  parked and cannot have moved.
- Fix: the land test runs only for a car whose position or heading changed this step;
  `terrainVehiclePose()` remembers the position it last sampled and returns early while
  the car stands still (a teleported car is re-sampled). `updateKnockdowns` walks the four
  people lists in place instead of copying ~700 entries every frame. A `phys:post` timing
  part now covers the end of the physics step.

## Vehicles and collision

Vehicle matrix: every road type in `VEHICLE_DEFINITIONS` (bicycle, tank, flatbed, roadster,
rally, limousine, hotrod, bike, cruiser, supercar, luxury, suv, pickup, truck, bus,
ambulance, coupe, muscle, taxi, van, sport, sedan, police) spawned on Harbor Ave, driven
2.5 s at full throttle, handbrake-turned (Space + D), reversed 4 s and exited: all drive,
turn, reverse and let the driver out on clear ground.

### V1. Cars drove through the marina and Sunset Pier buildings
- Symptom: a sedan driven at the Harbor Point marina club, the cruise terminal, the
  Sunset Pier arcade, games row or food court passes straight through them.
- Cause: these buildings live outside `buildings` (marina.js `marinaSolids`, themepark.js
  `parkSolids`, the wheel and carousel circles). `solid()` stops people with them, but
  `buildColliders()` never added them to the vehicle statics.
- Fix: `buildColliders()` adds them (kinds `marina` and `pier`).
- Verified: the same drives now stop at the walls (sedan stops ~50 units short of where
  it passed through before).

### V2. A car could drive into the Central Garden lake and trap its driver
- Symptom: in the vehicle matrix the police car ended up in the Commons lake; `exitCar()`
  found no dry ground and kept the player in the car ("No room to get out").
- Cause: park ponds (`parkPondBlocked`) only stop people; vehicles ignored them.
- Fix: the post-step footprint check in `physicsStep` treats a pond (and the boathouse)
  as a kerb for every wheeled vehicle, the player's included: the car is put back where
  it was at the start of the step and bounces off. (A flooding-car pond would need
  swimming in ponds, which water.js does not model.)
- Verified: a police car driven at the lake from all four sides stops at the kerb and the
  driver steps out every time.

### V3. The Southport dock and its speedboat were on dry land
- Symptom: the speedboat by the airport inlet could not move (`boatFits` false, two hull
  corners on land); screenshot shows it parked on the esplanade.
- Cause: the dock at (1320, 5130) and its boat at (1490, 5147) sat at the narrow head of
  the inlet; after the airport shore was reshaped that spot is land.
- Fix: the dock moved south to the inlet's east shore (1500..1630, 5230), boat at
  (1462, 5247). The contraband mission's water route (challenges.js) ended at the old boat
  spot and now ends at the new berth.
- Verified: boat fits at spawn, board from the dock, step back off onto the dock, drive
  out into the bay.

### V4. The Harbor Point jetties stood on the quay, and their boats could not be reached
- Symptom: the two jetties at x 1566 were drawn on the concrete east of the basin; the
  jet ski and speedboat floated 66 units off their ends.
- Cause: the basin's east quay is at x 1528; the docks were placed wholly on land, and
  `marinaBlocked()` treated every point inside the basin rectangle that was not a finger
  pontoon as water, so a dock moved over the basin would have been unwalkable.
- Fix: both jetties moved to x 1476 (52 units out over the water, boats at x ~1447), and
  `marinaBlocked()` lets people stand on `DOCKS`.
- Verified: from each jetty the boat boards, the player steps back off onto the jetty, the
  boat drives out, and diving over the side works.

## Water

Tested: boarding every dock boat and stepping back off, diving over the side (J), boats
held off land, parachute bail-outs over the Old Quarter, Marlow Bay, the west sea, the
marina basin, the viaduct and past the superyacht (land: safe landing; sea within reach of
an exit: splashdown and swim; far offshore: rescue), driving a sedan off the Riverbank
quay, bailing out, swimming to the nearest ladder and climbing out, and a sweep of all
coastal water (within 500 units of land) for the distance to the nearest way out
(worst: 646 units, north of the superyacht, well inside the 30 s of breath).

### W1. Four ladders could not be climbed
- Symptom: a swimmer placed 40 units off each ladder and swimming at it climbs out at 53
  of 57. Failures: the marina south quay ladder (1378, -3315) sat in a 5-unit slot between
  a finger pontoon and a moored yacht; the quay ladder next to the Southport dock had the
  dock across its approach; the two dock-end ladders had the dock's own boat moored
  across their foot.
- Cause: `ladderList()` checked only that the foot was water and the top dry, not that a
  swimmer (radius 8) could get to the foot.
- Fix: a ladder is only placed where three points on its approach (0, 18 and 36 units out)
  are open water clear of solids, docks and dock berths; the quay walk then puts it on the
  next clear stretch.
- Verified: 54 ladders, 54 climbed out onto dry, clear ground; worst coastal distance to an
  exit unchanged (646).

### W2. A car written off in the bay exploded under water
- Symptom: a sedan driven off the quay, abandoned while flooding: 1.5 s after it settled
  it blew up (a fire and a blast at the water surface, hurting anyone swimming nearby).
- Cause: `updateSinking()` wrote the car off by setting `hp = 0`; `updateCars()` treats a
  vehicle reaching 0 hp without a `deadTime` as a wreck going up and calls `explode()`.
- Fix: the write-off sets `deadTime` (dated past the 12 s a fresh wreck burns for, so the
  renderer draws no flames over it), `sunk`, and clears any engine fire.
- Verified: the same drive: no explosion, no fire, `fires` unchanged.

### W3. A burning car kept burning in the sea
- Cause: nothing put out `damage.burning` when a car flooded, so a car on fire driven into
  the bay burned down to an explosion under water.
- Fix: `canBurn()` (damage.js) is false for a flooding car and `updateDamage()` puts out
  a fire that can no longer burn (this also covers a car in the repair bay).
