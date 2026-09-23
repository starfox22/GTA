# Open-world systems QA

Play-test of the open-world systems after the railway, beach, superyacht, damage, flight
camera, crowd, roadblock and bicycle overhauls. Each entry: symptom, cause, fix,
verification. Tests were driven headlessly through `window.DeadEndCity` and `simulate()`
(see docs/DEVELOPMENT.md); timings come from `DeadEndCity.stats()` parts and Chrome CPU
profiles of `simulate(4)` with the frame loop stopped, on a shared, heavily loaded
4-core machine, so absolute numbers are noisy: compare the ratios.

## Performance

Per simulation update (1/30 s of game time, four physics steps), with the frame loop
stopped, ~650 pedestrians and ~190 vehicles, standing in the Old Quarter and then driving a
sedan along Harbor Ave. Both builds measured back to back in the same headless browser
(`bench.js` run three times, warm runs shown):

| Part | Before (0d4b74c) | After |
| --- | --- | --- |
| whole update, standing | 56-57 ms | 10-11 ms |
| whole update, driving | 57-58 ms | 8-9.5 ms |
| `cars` (updateCars + physics) | 27.6-28.3 ms | 4.7-7.1 ms |
| `people` | 10.1-11.0 ms | 1.9-2.1 ms |
| `ui` (HUD refresh, averaged per update) | 10.7-11.3 ms | 0.4-0.7 ms |

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

### P5. Blood-track, pond and boat checks for cars that were not near anything
- Cause: `updateBloodTracks` sampled the terrain under every blood pool in the city for
  every moving car each frame before checking whether the pool was anywhere near it; the
  new pond kerb (V2) ran its ellipse tests for every moving car's corners; `boatFits`
  (a hull-against-coast test) ran every physics step for every moored boat.
- Fix: the pool filter tests distance first; `parkPondNear()` (renewal.js) gates the pond
  test with boxes round the ponds; a boat that has not moved this step is not re-fitted.

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
  Hitting the kerb at speed is a crash (same severity as a wall in `collisionImpact`,
  crumpling the front), not a soft stop; and the kerb only refuses a step that puts more of
  the car over the water, so a car that somehow starts with a wheel over it can drive off.
- Verified: a police car driven at the lake from all four sides stops at the kerb and the
  driver steps out every time; a roadster driven into it at 320 units/s stops with a
  crumpled front (hp 120 → 85).

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

## Traffic flow

Test: stand at a point, simulate 40 s, then 30 s more, and list traffic cars within 1400
units that moved less than 25 units in the last 30 s, with a per-car diagnosis (junction
state and signal, cars that hold the junction or block its exit, what is in the look-ahead
box, road validity probes, pedestrians ahead). Swept Broadway, Royal Ave under the
viaduct, the -2944 avenue under the viaduct, Garden St, the marina, the beach, the
Stadium Way bridge, Palm Keys, the Old Quarter and Midtown. Before the fixes most sweeps
found a gridlock; after them the same sweeps find none that persist (one-off stalls did
not reproduce).

### T1. Gridlock at T-junctions: the turning car and the waiting car waited for each other
- Symptom: junctions (3200, -2944), (1664, -3456), (1664, 4736), (2688, -3456): a truck
  committed to a turn stopped mid-junction; the car waiting on the cross street never got
  the junction because it was occupied; queues grew behind both.
- Cause: the following check in `trafficControl` projects a box along the car's current
  heading. Halfway through a turn that heading points across the cross street, straight
  at the cars held at the stop line (or at a car parked at the kerb beside the exit).
- Fix: while committed to a turn, another car only holds us back if it stands on the rest
  of our turn path (the path points plus 120 units down the exit lane), tested against its
  oriented footprint.

### T2. A bus waited for ever on people standing on the pavement
- Symptom: a bus turning off Marina Rd stopped with two walkers "ahead" of it, both on the
  pavement, both waiting at the kerb.
- Cause: pedestrian yielding used the same heading box, which sweeps the pavement while
  turning.
- Fix: traffic yields only to people who are on the carriageway (`cityStreetAt`).

### T3. Invisible walls on Stadium Way bridge and in the Marina Rd junction
- Symptom: police cars eastbound on the Stadium Way crossing stopped dead with nothing in
  front of them; buses turning from Marina Rd onto the Oceanview causeway stuck on the
  corner with Riverbank Dr queued behind.
- Cause: `countyBridgeRails` placed guard-rail colliders wherever a causeway's centre line
  was over water. The Sunset Pier causeway leaves the Stadium Way deck, so its first rail
  pieces stood across the eastbound lane; the Oceanview causeway's centre line is over the
  sea while its west edge is still on the quay, so a rail stood in the junction. The same
  pieces are drawn by county3d.js.
- Fix: rail pieces are skipped where any part of them is on land or on a city bridge deck.

### T4. Pedestrians walking along the traffic lane blocked traffic, and it blocked them
- Symptom: a hot rod stopped on Sunset Blvd with two walkers 26 units ahead of it, walking
  down the middle of the northbound lane, "blocked" by the car.
- Cause: `walkSidewalk` only steers a walker toward the pavement lane when they are
  already on the pavement (40..100 units from the road's centre line). Someone knocked,
  shoved or dodging into the road carried on down the lane.
- Fix: a walker on the carriageway of the road they walk alongside, away from a crossing,
  steers back onto the pavement.

### T5. Parked cars poking into the lane stopped traffic for good
- Symptom: queues behind a starter roadster parked at the corner of Royal Ave (its nose in
  the southbound lane), behind the starter bus nudged 10 units off the kerb on Armory St,
  and behind a parked hot rod at the -2944 kerb.
- Cause: traffic never steers around anything; a stationary car overlapping the lane by a
  few units was treated as a queue that never moves.
- Fix: the roadster starts clear of Royal Ave; and a parked, stationary vehicle that only
  pokes a little into the lane (less than 12 units) makes the driver ease across the lane
  past it instead of stopping.

### T6. Double-parked delivery vans and abandoned cars blocked a lane for good
- Symptom: a hot rod queued behind a van parked dead in the middle of the westbound lane
  of the -2944 avenue for the whole soak.
- Cause: the street-life delivery scene double-parks its van in the lane by design, and
  when the scene ended without its worker (scared off or hurt) near the player,
  `removeScene` left the empty van there; crash-abandoned cars and wrecks do the same.
  Traffic had no way round a stationary car that filled the lane.
- Fix: a delivery van left behind by its scene near the player gets a driver and rejoins
  traffic. Traffic pulls out round a stationary, non-traffic vehicle that fills its lane
  when the oncoming lane is clear from just behind to 260 units past it and no junction is
  near; while waiting for the oncoming lane it holds 40 units back so it has room to pull
  out, and the lateral shift is measured from the lane's centre line so it holds while
  the car moves across. Close behind and still in line it creeps rather than stopping.
- Verified: a sedan meets a van dead in its lane on Union St: with the oncoming lane clear
  it pulls out 31 units, passes without touching the van and drops back into its lane
  before the next junction; with a taxi coming the other way it waits 40 units back,
  lets the taxi pass, then goes round. Four 140 s soaks (55-59 traffic cars each):
  no traffic car damaged, none stuck.

## Superyacht, police, trains, garages

Passed without changes: the wanted cycle (a shot raises a star, the search runs out, one
POLICE CLEARED banner, none when clearing at zero stars); a dispatch cut at 4 stars; a
truck rams a bridge roadblock and breaches it while a sedan is stopped by it; drowning with
3 stars respawns at the hospital door (on dry, clear ground) with the swim state, wanted
level, parachute and deck cleared; every one of the 13 stations can be reached on foot from
a street, opens its menu, and a ride to the next station ends on clear ground by the
destination's entry; a sedan crumpled on three sides with burst glass, dead lamps, sprung
doors and a burning engine comes out of the Eastside Customs bay with every damage field
reset and a new colour.

### Y1. You could not walk onto the superyacht's passerelle
- Symptom: walking east along the quay at y -3950 stops at x 662, in front of the
  passerelle; boarding only worked with E.
- Cause: the beach-only swimming rule (`shoreStepBlocked`) sees the step from the quay onto
  the passerelle as a step off a sea wall into the water.
- Fix: the passerelle counts as dry ground for that rule.
- Verified: walking east boards the yacht on the swim platform (`player.deck`, level 0);
  walking back west takes the player down the passerelle and ashore; E still boards and
  leaves.

## Taxis and weapons

### X1. A hired cab crawled at walking pace
- Symptom: `DeadEndCity.cab(2600, 1400)` from Broadway was still 1,370 units short after
  200 simulated seconds; the cab's speed read 6 units/s the whole way (it should cruise at
  up to 260).
- Cause: the cab is driven along its route by `updateTaxiRide`, which accelerated
  `car.speed` by up to 180 units/s² a frame; but the physics step runs first each frame
  and recomputes `car.speed` from `vx/vy`, which are zero for a car moved like this, so
  the cab never got past one frame's worth of acceleration.
- Fix: the commanded speed lives on the ride (`ride.speed`) and is copied to `car.speed`
  for the renderer. The cab's look-ahead for pedestrians uses the crowd grid instead of
  scanning every pedestrian each frame.
- Verified: the same ride arrives in 45 s, the $29 fare is paid and the passenger steps out
  40 units from the destination on clear ground.

### X2. Every bullet sub-step copied the whole crowd
- Cause: `updateBullets` built `[...enemies, ...gangMembers, ...pedestrians, ...officers,
  ...]` (about 700 people) for every 7-unit sub-step of every bullet in flight, plus two
  `storyActors.filter` calls.
- Fix: `bulletTargets()` fills one reused list in the same order, taking pedestrians from
  the crowd grid within 16 units of the bullet; the story-actor filters run once a frame.
- Verified: a pistol shot at the nearest pedestrian still kills them and raises a star.

## HUD

### H1. Every stretch of water was called MARLOW BAY
- Symptom: swimming in the Harbor Point basin or off the west sea wall, the HUD district
  line read MARLOW BAY.
- Cause: `districtAt()` returned MARLOW BAY for any point off land.
- Fix: water inside the marina basin reads HARBOR POINT MARINA, the channel between the
  islands MARLOW BAY, everything else OPEN SEA (bridges still read MARLOW BAY CAUSEWAY).
  Crowd density uses the same default for all three names, so nothing else changes.

## Other checks that passed

- Aircraft: a courier plane takes off from both ends of the Southport runway (pull with
  Space from ~2.5 s) and lands on it from a southern approach; the runway centre line and
  both Oceanview runway approaches are clear of statics. The Shore Line reaches the airport
  along Royal Ave (x ~1150-1270), east of the terminal, far from the runway (x 300-536).
  The helicopter lifts off the police HQ pad, flies to the Riverside pad and refuses to set
  down on it while the pad's own helicopter is parked there ("Landing blocked").
- Parachute: bail-outs land safely on land, splash down within reach of an exit (and swim),
  or are rescued far offshore.
- Rail statics: no station lift or viaduct pier stands in a carriageway; every deck volume
  has a `minHeight` above traffic; pedestrians walking the Royal Ave pavements under the
  viaduct for 30 s never stayed blocked. No street prop stands within 3 units of a
  carriageway and none was knocked by traffic in a simulated minute.
- Water pockets: a flood fill of swimmable water from every exit reaches all of it (the
  only unreached cells are the marina's finger pontoons and the passerelle, which are
  walkways).
- Shore rules: walking into the sea from Southport Beach wades then swims and walks back
  out; the Riverbank quay, the west sea wall, a dock end and the fishing pier deck all stop
  a walker.
- Casino roulette, arsenal and knife, save/load of cash, weapons, ammo, armour, clock and
  the FPS setting across a reload, and the pause menu toggles (touch, sound, voices, FPS).
- `tools/smoke.mjs` and `tools/layout-audit.mjs` (only the usual oblique junction notes).

## Known remaining issues

- (Resolved in 29.0.0, src/rooftops.js.) Helicopters could not land on building roofs:
  they now set down on flat roofs and rooftop helipads, and the player can step out,
  walk the roof and take off again.
- The north approach to Southport crosses the Broadway blocks (roofs 61-79 units) before
  the Shore Line curve (deck 52-60 units) 1,090 units short of the threshold: a flat
  3-degree approach from the north clips the buildings first. Approach steeply from the
  north or use the southern approach over the water.
- There is no arrest: at any wanted level the police shoot, and "busted" does not exist;
  death respawns at the hospital door with a $250 bill and a clean wanted level.
- Traffic only pulls out round stationary vehicles; it never overtakes a slow one.
- (Resolved: `evadeCargoPolice` only shows POLICE CLEARED when stars were showing;
  re-verified in the 29.0.0 release pass.)
