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
