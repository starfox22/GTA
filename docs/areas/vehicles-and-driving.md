# Vehicles and driving

Game side: game-vehicles.js (`VEHICLE_DEFINITIONS`, `vehicleSpec()`), physics-*.js,
driving.js (brakes and assists), riders.js, aviation.js, offroad.js, hypercars.js.
Models: render3d-vehicle-models.js (`makeVehicle`), cars3d-*.js, motorbikes3d.js,
police3d.js, helicopter3d-*.js, apache3d.js, plane3d.js, vehicles3d.js, boats3d.js.

## Specs are real

- `VEHICLE_DEFINITIONS` sizes are metres × `UNITS_PER_METRE` (`w` is the collider: body plus
  mirrors; car bodies are drawn at 0.87 of it, trucks 0.91). Sedan 4.85 m, bus 12 m, etc.
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

## Handling (physics-driving.js, driving.js)

- Steering reaches full lock by 30 km/h (`STEER_FULL_SPEED`); above that
  `corneringLimit(spec, v)` caps yaw rate at `cornerG * GRAVITY / v` for player, traffic and
  pursuit alike (a city corner is 30-40 km/h). Tyre side force peaks at `TYRE_PEAK_SLIP`
  (7°); `PLAYER_YAW_RESPONSE` 8.5/s; UNDERSTEER SKID above 28 km/h. Measure with
  `turnTest(type, kmh)`.
- One grip budget (friction circle): braking hard in a bend ploughs wide. Rain (`wetGrip()`,
  down to 0.72 soaked) scales traction, brakes and cornering. `kerbStrike` jolts on kerbs.
- **Brakes and assists** (driving.js, player's road vehicle only): a pedal ramp, front/rear
  bias by class (`DRIVING_CHARACTER`), per-axle slip with a peak at 12% then a sliding value;
  ABS cycles at 10-15 Hz and keeps the car steerable; TCS trims throttle; ESC (`yawStability`)
  damps `yawSlide`. `spec.brakeG` stays the mean ABS stop (what road tests print; the tyres'
  peak is brakeG / 0.93, `ABS_EFFICIENCY`). Fitment: cars all three, motorbikes ABS (some
  TCS), classics none; `spec.abs` / `esc` / `tcs` override. `c.braking` and
  `drivingAssistStates` feed the HUD lamps. Tests: `brakeTest`, `liftOffTest`, `accelTest`,
  `drivingState`. Settings · Driving is saved as `dead-end-city-driving`.
- Traffic in the rain drives inside `wetGrip()` and slower; one driver in eleven keeps dry
  habits (the occasional rear-ender). `aiDriving()` counts crashes and slides.

## Crashes, riders, aircraft strikes (physics-collisions.js, riders.js, physics-aircraft.js)

- Damage follows each body's delta-v with real masses: share of hp =
  ((Δv − 10 km/h) / 190 km/h)^1.5; walls have infinite mass. Driver injury (`crashInjury`)
  follows the same Δv. A vehicle nobody drives slides on Coulomb friction (`parkedFriction`).
- Riders: a crash Δv over `RIDER_THROW` (24 km/h motorbike, 18 bicycle) throws the rider on a
  ballistic arc (`throwRider`); the player becomes `player.thrown` (a carrier). Console:
  `rideInto`, `riderReport()`.
- An airborne helicopter or plane faster than `AIRCRAFT_CRASH_SPEED` (40 km/h) into a
  building, hillside or big vehicle is destroyed (`destroyAircraft`); rotor discs strike walls
  (`rotorStrikes`). Console `heliInto`.
- Damage is data on the entity (damage.js; see police-and-combat.md for the damage model and
  breakable props).

## Aircraft and camera

- Planes (aviation.js `AIRFRAME_SPECS`): thrust is a real share of weight; take-off rolls are
  measured (courier ~236 m, jet ~504, airliner ~794) and the runways are sized from them
  (world-and-map.md, Airfields). Flight controls: spool, pitch/roll springs, flaps, gear,
  stall warnings; `flightData()` feeds the HUD and console.
- Helicopters: `helicopterControl` (physics); rooftop landings in rooftops.js. The police
  helicopter is unarmed (police-and-combat.md). The Apache (apache.js) is player-only.
- Street camera: `STREET_ZOOM` 1.6 default (world-view.js); from ~60 km/h it eases back
  (`speedZoomTarget`). In the air a perspective camera takes over (rendering.md).

## Vehicle models

- `makeVehicle` dispatches by type to the builders above. All civilian/police/helicopter
  models follow the **damage contract** damage3d.js reads: a lofted shell and a five-pane
  glasshouse (`PANE_ORDER`) shared until dented; hooks `liveryMap` / `liveryColor` /
  `finish`, `bumperMaterial`, `panelGeometry` / `trunkGeometry`, `glass`; lamps keep their
  keys and `lit` materials; `nightLights` are [head, tail] per side.
- Liveries are one canvas per body/livery painted in the shell's UV space, with a band of
  solid swatches that panels and damage parts sample: the whole paint is one material.
- Draw-call budget: a civilian car ~20 draws and 3 shadow casters, a motorbike 11, a patrol
  car ~22, helicopters 9-14. Zoomed out, cars pool into instanced impostors per type
  (BODY IMPOSTORS). Report with `carModels()`, `helicopterModels()`; line-ups with
  `carLineup`, `policeLineup`, `helicopterLineup`.
- Looks are cached per vehicle in a WeakMap (`pickPoliceLook`, `helicopterLookFor`), never
  stored on the vehicle.
- Police lights run when `(c.cop && wantedStars > 0) || c.airUnit || c.gangTarget ||
  c.showLights`; `policeLightLevels` writes the flash pattern.
- `helicopterSearchlightMount(c, out)` returns the Nightsun lens in world space: the only
  thing searchlight3d.js takes from the helicopter model. Keep it when changing models.
- Helicopter liveries are generator jobs (`heliLiveryJob`), prewarmed on the title screen
  so the air unit's first call does not hitch.
- Motorbikes: the body's `rider` pose gives `riderSeat`; the character rig draws whoever
  rides (crowd3d RIDERS).
- Boat kit (boats3d.js): `loftHull`, deckhouses, railings; `tint(color, finish)` meshes are
  merged per finish by `kitMerge(group)`. Do **not** push kit-built groups into
  `batchGroups`: the static batcher drops vertex colours.
- Flagships: one traffic car in forty (`FLAGSHIP_TYPES`); SHOWCASE PARKING in
  game-populate.js (`showcase()`). The Prestige Collection and MONARCH MOTORS:
  places-and-venues.md.
