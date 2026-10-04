# Vehicles and driving

Game side: game-vehicles.js (`VEHICLE_DEFINITIONS`, `vehicleSpec()`), physics-*.js,
driving.js (brakes and assists), riders.js, aviation.js, offroad.js, hypercars.js.
Models: render3d-vehicle-models.js (`makeVehicle`), cars3d-*.js, motorbikes3d.js,
police3d.js, helicopter3d-*.js, apache3d.js, plane3d.js, vehicles3d.js, boats3d.js.

## Specs are real

- `VEHICLE_DEFINITIONS` sizes are metres × `UNITS_PER_METRE` (`w` is the collider: body plus
  mirrors; car bodies are drawn at 0.87 of it, trucks 0.91).
- Performance is written as road tests print it: `topKmh`, `zeroTo` ([km/h, s]), `brakeG`,
  `cornerG`, `tractionG`, `mass` (tonnes), `balance` (-1..1: push wide vs tail out).
  `roadPerformance()` turns them into `max`, `acc`, `brake`, `power` (bisected so the car
  really makes its 0-100). `engineAcceleration(spec, v)` is the pull at a speed;
  `coastDeceleration` the roll-down. **The AI uses the same numbers** (traffic and police
  clamp throttle to `engineAcceleration` and braking to `spec.brake`).
- `modelScale`: a model is built at its design size, (l, w) / modelScale, so parts its builder
  sizes in fixed units come out real while the footprint matches the collider. A model built
  at real size (every civilian car, motorbike, helicopter, hypercar, club truck) sets
  `modelScale` 1 and reports `realSize`. Code that places things into a model by hand (dents,
  loose panels, wheel spin, impostors) works in design units (`m.modelScale`).
- Rough targets (measure with `DeadEndCity.accelTest`, `simulate`): everyday cars 150-205
  km/h; sports and supercars 230-330; the patrol car 230 (catches anything but a sports car);
  trucks 115-120, bus 100, tank 55; traffic 40-55 in town. Boats in knots (speedboat 55).

## Handling

- Steering, grip, brakes and assists, drifts and the handbrake: vehicles-and-driving-handling.md.

## Crashes, riders, aircraft strikes (physics-collisions.js, riders.js, physics-aircraft.js)

- Damage follows each body's delta-v with real masses: share of hp =
  ((Δv − 10 km/h) / 190 km/h)^1.5; walls have infinite mass. Driver injury (`crashInjury`)
  follows the same Δv. A vehicle nobody drives slides on Coulomb friction (`parkedFriction`).
- Riders: a crash Δv over `RIDER_THROW` (20 km/h motorbike, 18 bicycle) throws the rider on a
  ballistic arc (`throwRider`; causes crash, landing, lowside, loopout); the player becomes
  `player.thrown` (a carrier). It costs falls-body.js's `riderInjury` (strike into a wall or
  car, fatal from 75 km/h; tumble on first touching the ground; road rash) plus `fallInjury`
  for the drop: a few points under 20 km/h, ~12 at 40, ~30 at 70, KO from 45 hp in one fall.
  Survived falls hurt with kind `'fall'` (no blood: `hurt()` skips it); a fatal one bleeds and
  pools (blood.js). Traffic riders lose hp directly, no wound. Console: `rideInto`,
  `rideIntoWall`, `riderReport()` (`bloodNear`, `poolsNear`).
- Wheelies (wheelie.js): `c.wheelie` (rad, pitch about the rear patch, slightly negative on the
  fork's bounce) and `c.wheelieRate`; stepped in controlVehicle after the offroad and drawbridge
  terms, it returns the acceleration (feathered throttle, rear brake only) and scales steer by
  `wheelieSteerShare`. Input is `wheelieHeld()` (controls.js): climb + forward held by a key
  that is not one of climb's, so ↑ alone on the road is still only the throttle. Per-type
  geometry in `WHEELIE_GEOMETRY` (sport, enduro, cruiser barely lifts, bicycle). The renderers
  only read it (motorbikes3d `animateMotorbike`, cycles3d `bicycleWheelie`). Console `wheelieState()`.
- An airborne helicopter or plane faster than `AIRCRAFT_CRASH_SPEED` (40 km/h) into a
  building, hillside or big vehicle is destroyed (`destroyAircraft`); rotor discs strike walls
  (`rotorStrikes`). Console `heliInto`.
- The damage model and breakable props: police-and-combat.md.
- Off a drop (falls-vehicles.js): on a terrain field a road vehicle rides its springs
  (terrain-suspension.js, world-county-and-sea-terrain.md); with every wheel 0.6 m clear it is
  airborne (`startCliffFlight`, `c.cliffAir`: ballistic, nose tipping at about g / 2v, roll if
  it went over at an angle; `cliffFlight` replaces the driving step). Landing speed decides: under
  5 m/s nothing, then ((v − 5) / 20)^1.3 of the hp (×1.35 on the roof or a side), the player
  takes the body scale at 0.72 of it, a rider is thrown (`riderLanding`). On faces over 40°
  it bounces and slides down; where it stops the whole height counts (×0.85 speed). It may
  rest `c.overturned` (roof or side: not drivable, not enterable; `repairVehicle` rights it).
  While flying or overturned the lift lives in `deckLift` (so `entityElevation` is right) and
  `drawbridgeSettle` skips the car (`c.cliffLift`).

## Aircraft and camera

- Planes (aviation.js `AIRFRAME_SPECS`): thrust is a real share of weight; take-off rolls are
  measured (courier ~236 m, jet ~504, airliner ~794) and the runways are sized from them
  (world-county-and-sea.md, Airfields). Flight controls: spool, pitch/roll springs, flaps,
  gear, stall warnings; `flightData()` feeds the HUD and console.
- Helicopters: `helicopterControl` (physics); rooftop landings in rooftops.js. The police
  helicopter is unarmed (police-and-combat.md). The Apache (apache.js) is player-only.
- Camera: a vehicle frames at its CAMERA CONTEXT share of `STREET_ZOOM` (a car 0.7) and eases
  back from ~45 km/h (`speedZoomTarget`); in the air a perspective camera (rendering.md).

## Vehicle models

- `makeVehicle` dispatches by type to the builders above. All civilian/police/helicopter
  models follow the **damage contract** damage3d.js reads: a lofted shell and a five-pane
  glasshouse (`PANE_ORDER`) shared until dented; hooks `liveryMap` / `liveryColor` /
  `finish`, `bumperMaterial`, `panelGeometry` / `trunkGeometry`, `glass`; lamps keep their
  keys and `lit` materials; `nightLights` are [head, tail] per side.
- Liveries are one canvas per body/livery painted in the shell's UV space, with a band of
  solid swatches that panels and damage parts sample: the whole paint is one material.
- Civilian glasshouses may curve (`glass.crown`, `screenCurve`, `backCurve`, metres;
  `glassPoint` / `glassCrown` in police3d-cabins.js): place anything on the roof with
  `glassPoint(g, l, w, 'roof', s, t)` or add `glassCrown(g, x, l)`, never `g.roof + g.arch`
  alone. The MULE VAN's shell runs up to its roof (its glasshouse is only the cab's screen and
  door glass; `hoodHinge`, `doorTop`); shell sections must keep ten points to blend.
- Draw-call budget: a civilian car 22 draws and 3 shadow casters (13 while pristine), a motorbike 11, a
  patrol car ~22 (fewer while pristine), helicopters 9-14. Zoomed out, cars pool into instanced impostors per type
  (BODY IMPOSTORS). **PRISTINE MERGE** (vehicle-merge3d.js): an untouched civilian or police car draws its
  non-casting static parts merged per material (hood + panels + paint bumpers, other bumpers, lamp pairs, a front
  wheel's tyre and rim, a rear axle's wheels; police: all wheels, never turned), the originals hidden underneath;
  `vehicleMergeEligible` (damage, stains, mud, burnt, carjack door, the player's car) sends it back to its parts for
  good, bumping `m.shapeVersion`. A new part that animates, changes material per side or is read by damage, blood
  or lights must stay out of the kit's plan (`vmCivilianPlan` / `vmPolicePlan`); `vehicleMergeAudit()` compares
  every merged mesh with its parts vertex by vertex, `vehicleMerges()` counts them. Report with `carModels()`, `helicopterModels()`; line-ups with
  `carLineup`, `policeLineup`, `helicopterLineup`.
- Looks are cached per vehicle in a WeakMap (`pickPoliceLook`, `helicopterLookFor`), not on it.
- Police lights run when `(c.cop && wantedStars > 0) || c.airUnit || c.gangTarget ||
  c.showLights`; `policeLightLevels` writes the flash pattern.
- `helicopterSearchlightMount(c, out)` returns the Nightsun lens in world space: the only
  thing searchlight3d.js takes from the helicopter model. Keep it when changing models.
- Helicopter liveries are generator jobs (`heliLiveryJob`) prewarmed behind the title, so the
  air unit's first call does not hitch.
- Motorbikes: the body's `rider` pose gives `riderSeat`; the character rig draws whoever
  rides (crowd3d RIDERS).
- Boat kit (boats3d.js): `loftHull`, deckhouses, railings; `tint(color, finish)` meshes are
  merged per finish by `kitMerge(group)`. Do **not** push kit-built groups into
  `batchGroups`: the static batcher drops vertex colours.
- Flagships: one traffic car in forty (`FLAGSHIP_TYPES`); SHOWCASE PARKING in
  game-populate.js (`showcase()`). The Prestige Collection and MONARCH MOTORS:
  places-monarch-and-county.md.
