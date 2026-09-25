# Source guide

This document is for anyone (human or AI) continuing work on Dead End City. It explains how
the code is organized, the data contracts every subsystem relies on, how to build and test,
and how to extend the most common things: missions, buildings, districts.

## 1. One closure, many files

The game is a single large JavaScript closure. `src/main.js` wraps everything in
`function startDeadEndCity(ASSETS) { ... }`, and `src/game.js` holds the shared state.
Every other `src/*.js` file is a *fragment* of that closure, spliced in where a
`// @include src/<file>.js` directive appears. Fragments therefore share variables freely and
must not use `import`/`export` or wrap themselves in functions.

Two closures matter:

- **Game closure** (`src/game.js` and the files it includes): simulation, missions, UI, input.
- **Renderer closure** (`createCityRenderer()` in `src/render3d.js` and the `*3d.js` files it
  includes): Three.js meshes and effects. It reads game state but never changes game rules.

`tools/build.py` resolves the directives recursively and produces `dead-end-city.html` from
`src/shell.html`. The shell contains the CSS/DOM and five directives:
`@include-game-source`, `@include-three-source`, `@include-media`, `@include-asset-loader`,
`@include-credits`.

## 2. Data contracts (read before touching physics or rendering)

- Map coordinates are `(x, y)` in world units. **`UNITS_PER_METRE` = 8: 512 units (a block) =
  64 m** (section 2a). `WORLD_SIZE` is 11264,
  the city proper (`CITY_SIZE`) is 5632; the county lies beyond.
- Heading `a` is radians. Velocity `vx/vy` is units per second, `av` radians per second.
- In Three.js a map point becomes `(x, elevation, y)`; model yaw is `-a`.
- Compact entity keys are contracts: `hp`, `maxhp`, `a`, `w/l`, `hx/hy` (collider half
  extents), `vz`, `inv` (invulnerability seconds).
- `entityElevation(e)` is the only correct way to compare heights of actors on roofs,
  decks, terrain, boats, sinking cars and aircraft. Aircraft `altitude` is absolute;
  `aircraftClearance()` subtracts the terrain, or the flat roof under a helicopter
  (`c.roofSite`, section 4c).
- The player is held by one carrier at a time: `player.car`, `player.roof` (the Blue Hour
  terrace), `player.buildingRoof` (a roof reached by helicopter), `player.deck` (the
  superyacht or a liner), `player.parachute`, `player.coaster`, `transitRide`, `taxiRide`,
  or the water (`player.swimming`, `player.wading`, `player.climbing`). `teleportPlayer()`
  lets go of all of them; anything that moves the player must go through it.
- `solid(x, y, r, overWater)` is the one collision test for people; vehicles collide with
  `staticBodies` (`addStatic`, looked up through the numeric-keyed `staticGrid`). Barriers
  come from one plan each that both the renderer and the colliders read: the quay railing
  (`promenadeSpots()` rail runs, `promenadeRailBlocked`) and the street ends
  (`streetEndPlan()` / `streetEndSolids()`). The player on foot is also stopped by
  `footObstacleBlocked` (streets.js): furniture the renderer registers with
  `registerFootObstacle`, tree trunks and the standing knockable props. See
  docs/audit/streets-collision-qa.md.
- Renderer matrices (render3d.js, SCENE MATRICES): the scene's world matrices are brought up
  to date once a frame, just before drawing, and only for what is shown. A hidden object's
  `matrixWorld` may be stale; code that reads one (instancing fed from hidden meshes, ray
  tests) calls `updateWorldMatrix()` first. An object with `matrixAutoUpdate = false` is
  re-multiplied every frame from its hand-set `matrix`, as before. Merged scenery hangs from
  per-cell groups (STATIC BATCH CELLS) that are hidden out of the view's reach.
- Hot simulation paths do not allocate per call (docs/audit/performance.md): grids are reused
  with lazy per-stamp resets, `contactShape()` returns a vehicle's own box record, vehicles
  are created with every physics field declared in `makeCar()` (add new per-step fields
  there, with the value readers treat as "not set").
- Timers are seconds. Physics runs in fixed 1/120 s steps. `worldMinutes` advances one game
  minute per real second; `daylight()` returns 0..1 (sun up 05:40, down 19:50).
- Save data (`localStorage`, key `dead-end-city-v1`) holds campaign indices, cash, clock and
  weapons. Settings have their own keys: `dead-end-city-settings` (volumes, sound, radio
  voices, NPC chatter), `-controls` (key bindings), `-hud` (minimap fold and zoom),
  `-graphics`, `-frame-limit` (30, 60, 120 or unlimited: the frame loop's cap,
  game.js FRAME LIMITER), `-fps`, `-touch`, `-cutaway` and `-radio-v2`. Adding missions needs no schema
  change.
- Input goes through named actions (section 4d): `keys.KeyW` means "the forward action is
  held", whatever key the player bound to it.

## 2a. World scale, speeds and handling

- **One scale.** `UNITS_PER_METRE` (game.js WORLD SCALE) is 8, measured from the models: a sedan
  is 43 units (4.5 m), a person 17.4 units to the crown (1.75 m), a lane with its gutter 44
  (6 m), the courier plane 112 (14.4 m), a shop door 12 (2.1 m) and a storey 14-16 (3.2 m).
  People and cars are drawn a little large and buildings a little squat; 8 sits between them.
  Derived: `METERS_PER_UNIT`, `KMH` (map units a second in one km/h), `KNOTS`, `GRAVITY`
  (9.81 m/s² in map units), `worldMeters()`, `distanceLabel()`, `speedKmh()`. Write speeds as
  `50 * KMH`, accelerations as `0.8 * GRAVITY`. Every readout (speedometer, knots on boats, the
  flight HUD, metres in prompts, the map's scale bar, the Falcon's and the Eye's figures) comes
  from it.
- **On foot** (game.js `FOOT_WALK` 5.4, `FOOT_RUN` 20 km/h, `footPace()`): the player runs by
  default and walks while Shift (`walk`, controls.js, "Walk (hold)") is held; there is no separate
  sprint. The Blue Hour terrace is always walked (a stealth party). `footPace()` is read by the
  movement, mountain footing (terrain.js), footsteps (audio.js) and the police's aim (pursuit.js);
  the player's legs swing wider and lean in at the run (render3d.js `playerRunAmount`, from the
  model's measured travel). Swimming crawls hard by default (5 km/h, breath drains 1.7/s) and
  eases into breaststroke (3.5 km/h, 1/s) with Shift or once breath is under 30%
  (water.js `swimHard`). Pedestrians walk 4-6 km/h (`cityTempo`), flee at 17-21, officers run
  16-19 (`OFFICER_KINDS.run`), so the default run outpaces them. Legs keep pace with the ground through `strideCycle(speed)` / `strideRate(speed)`
  (one stride = 10 units + 0.3 s of travel), used by crowd3d.js and every `walk` phase.
- **Road vehicles** are specified in real units in `VEHICLE_DEFINITIONS`: `topKmh`, `zeroTo`
  ([km/h, s], usually 0-100), `brakeG`, `cornerG` (sideways grip the steering may use) and
  `tractionG` (what the driven wheels push off the line). `roadPerformance()` turns them into
  `max`, `acc`, `brake` and `power` (bisected so the car really makes its 0-100 time).
  `engineAcceleration(spec, v)` is the pull at a speed: the tyres' limit, then power / speed,
  less air and rolling resistance that would balance it 15% past `max` (the physics caps the
  car at `max`). `coastDeceleration` is the roll-down with nothing pressed; the handbrake adds
  a sliding half-g and drops the grip. Steering reaches full lock by 30 km/h
  (`STEER_FULL_SPEED`); above that `corneringLimit(spec, v)` caps the yaw rate at
  `cornerG * GRAVITY / v`, for the player, traffic and pursuit cars alike, so a city corner is
  taken at 30-40 km/h (or on the handbrake) and a wide bend at 150. The same numbers feed the
  AI: traffic and police clamp their throttle to `engineAcceleration` and their braking to
  `spec.brake`.
- **Targets** (measured with `simulate`, see CHANGELOG): everyday cars 150-205 km/h and 0-100
  in 6.5-13 s, sports and supercars 230-330 km/h in 2.9-5 s, trucks 115-120, the bus 100, the
  tank 55; motorbikes 180-225; the patrol car 230 km/h (0-100 in 6.3 s) so it catches anything
  but a sports car on an open road; the police helicopter 260 km/h. Bicycles cruise at 22 and
  sprint at 38. Traffic keeps to 40-55 km/h in town and 70-85 on the long bridges, follows at
  about 0.8 s and stops for reds at about half a g; county traffic 60. Boats: speedboat 55
  knots, jet ski 50, harbor launch 14, police launches 15% quicker; the liner 19 knots at sea.
  Trains 100 km/h at 1.3 m/s²; the cab 65 km/h. The helicopter cruises at about 240 km/h.
- **Aircraft** (aviation.js AIRFRAME_SPECS): take-off thrust is a real share of the weight
  (courier 0.28, jet 0.30, airliner 0.26 g) with the parasitic drag scaled to it, so top
  speeds stay near 400 / 740 / 830 km/h while the take-off roll, climb (6-11 m/s initially)
  and deceleration are real. Rolling resistance 0.025 g, wheel brakes 0.42-0.45 g. Measured
  rolls, flaps 1, rotating at the airframe's speed: courier 236 m (lift-off ~116 km/h), jet
  504 m (~180), airliner 794 m (~207); landing rolls from touchdown at that speed with full
  brakes 103 / 253 / 368 m. The runways (section 4, "Airfields") are sized from these.
- **Camera**: from about 60 km/h the street camera eases back (`speedZoomTarget`, world-view.js,
  to 0.68 of the player's zoom by 220 km/h) and the look-ahead is about 0.45 s of travel.

## 3. Subsystem map

Every file below starts with `// BEGIN SUBSYSTEM: src/<file> — <title>` and a doc comment;
the same list, with one-line summaries, is the SUBSYSTEM INDEX at the top of
`src/shell.html`. Order matters only for top-level `const`/`let` used while the closure
is being set up (function declarations are hoisted).

Game closure (in include order; `src/main.js` wraps it, `src/game.js` includes the rest):

| File | Role |
| --- | --- |
| game.js | Constants, `VEHICLE_DEFINITIONS`, world build (`buildWorld`, `zoneHeight`, `makeBuilding`), `populate`, combat, `update`, `moveBody`, `exitCar`/`enterVehicle`, `teleportPlayer`, 2D fallback drawing, map (`paintMapBase`), HUD, input, startup, `window.DeadEndCity` |
| audio.js | Web Audio effects, voices, procedural sounds; `earFilter` (a low-pass over the whole mix, dulled while swimming); `LOOP_SECONDS` and `loopingSource()` (recorded loops play to their exact length: each file carries 0.2 s of its own start past the seam); the tyre, siren and rotor loops; `audioConsole()` (DeadEndCity.audioMix(), engineSound(), rainSound()) |
| physics.js | Vehicle physics in 1/120 s steps, `addStatic`/`staticGrid`, `resolveContact`, traffic AI (`trafficControl`), `helicopterControl`, `boatControl`, `safeLanding`, `damageVehicle`, knockdowns |
| controls.js | Key bindings: `CONTROL_ACTIONS` (every action, its default keys and contexts), the virtual key table behind `keys`, `actionHeld(id)`, `keyName(id)` for prompts, rebinding with conflict checks (`bindControl`, `controlConflicts`) |
| geography.js | Land polygons and the cached `landAt`, `BRIDGES` and their architecture (`bridgeStructure`, `bridgeFootings`, `bridgePylons`), reserved plots, `districtAt`, coast segments and `shoreStyle`, 2D water, `BEACH` (strand, boardwalk, pier) |
| drawbridge.js | The Palm Sound drawbridge: `DRAWBRIDGE_OPENINGS`, the opening phases (`updateDrawbridge`), barrier arms and ramming, traffic held at the stop lines (`drawbridgeTrafficLimit`), `drawbridgeKeepsOff`, `drawbridgeFootBlocked`, leaves as ramps and vehicle jumps (`drawbridgeSurface`, `drawbridgeSlopeDrive`, `drawbridgeFlight`, `drawbridgeSettle`), the ketch ALBATROSS, GPS pricing (`drawbridgeRouteDelay`), `drawDrawbridgeMap`, bells, motors and horns, the console report |
| harbor.js | Ironworks terminal, mission 1 loading, gates and guards, the harbor exit |
| heat.js | Heat and wanted stars: `crime(amount)` (heat by severity; the only way heat rises, nothing adds it passively), `recordKill` / `recordVehicleKill` (by victim, with a spree bonus), `HEAT_STARS`, the escalation delay, `heatUI()` (stars, pending star, heat meter, body count), `crimeLog` (the last crimes, for `policeReport().crimes`) |
| police-feedback.js | Wanted-level chips (NEED TO LOSE POLICE, POLICE CLEARED: only on a real drop, timed on the wall clock) and `policeBlocksMissionDelivery` |
| arsenal.js | Ownership-driven equipment, mystery weapon cards, icon inventory, knife combat and FISTS (index 7, no weapon: `meleeAttack` throws a left-right combination with a haymaker, `punchReaction`; `playerUnarmed()` tells the crowd the player is harmless) |
| citylife.js | Clock, `PLACES` (businesses), `DOCKS` (boat jetties and their boats), officers, police routing and sight (`policeSees`), wanted search, `clearPolice`, `daylight()` |
| pursuit.js | Police response: `POLICE_TIERS` (what each star sends), `OFFICER_KINDS` (patrol, road, swat, fed), `dispatchPolice` / `spawnPursuitUnit` (off-camera road spawns, bursts on a new star), `pursuitControl` (lead pursuit, PIT, flank, block, route-following search, off-road shortcuts across open ground, whiskers, stuck recovery), `policeNavRoute` (county pursuits on the GPS road graph), marine units (`spawnMarineUnit`, `marineBoatInput` for boatControl), downed-officer drags, officer fire and positioning, arrest, surrender (`trackSurrender`, `policeHoldFire`: standing still at one to four stars ends in BUSTED) and `bust()`, `policeChallengeLine` (arrest lines only when an arrest can happen), the pursuit tank, the five-star army (`armyJeep`, `armyApc`, `armyTruck` before the tank after `TANK_AFTER_SECONDS`; `updateArmyGunners`), dispatch captions, the radar search area, `policeReportData` |
| swat.js | SWAT teams and rooftop snipers: the rear-door deployment of a SWAT van (`swatDeploySpots`, `equipSwatOperator`), the shield man and the stack behind him (`swatLeadSpot`, `swatStackSpot`, `shieldBlocks`), rooftop marksmen now and then at five stars (`roofSniperSite`, `updateRoofSnipers`: one at a time, a second only after 150 s at five stars, first roll 25-45 s in and then every 60-90 s on a 65% chance; laser telegraph, two led rounds, then it packs up), `swatStats` |
| wounds.js | Wounds: `woundPerson` (hit zone, flinch, limp, blood trail, downed officers and bystanders), `chooseDeathFall` (backwards, face down, spun, slumped against a wall), `deathFallAmount` (the half-second fall), `hitFlinch`, `woundReport` |
| story.js | Characters, `STORY` missions, dialogue, `setStage`, `startMission`, `winMission`, `failMission`, `missionUpdate`, `updateMissionCard` |
| campaign.js | Save schema, progression frontier, ammunition persistence and mission selection |
| chase.js | Mission 1 cargo pursuit (`notifyCargoPolice`, `evadeCargoPolice` for the respray), Vinny's depot (front shutter, back door, `beginDepotDrop`, `clearDepotFloor`) |
| roadblocks.js | Police containment: bridge and avenue cuts of braced cruisers plus loose cones. `roadblockHolds()` (called from `resolveContact`) lets a heavy vehicle with enough momentum shove a cruiser loose; lighter cars just stop |
| carjack.js | Occupied traffic, locked doors, the ejection throw and what drivers do next |
| themepark.js | Sunset Pier resort island: layout (`PIER`), the Falcon coaster (circuit builder, banking, gravity ride), the Sunset Eye, ride and show schedules (fountain, fireworks), colliders, ground tile, park crowd and queues, procedural park sound |
| marina.js | Harbor Point marina, hull-form math, the boardable superyacht's deck plan (`SUPERYACHT`, `deckLocal`/`deckWorld`), liners, deck walking (`moveOnDeck`), the Meridian Star's voyage (`LINER_VOYAGE`, `sailLiner`) |
| taxi.js | Hailing, destination picking on the map, the ride itself and the hijack |
| cycles.js | Bike-share stands, racked bicycles, hold-W pedalling and the rider's legs |
| weather.js | Weather state machine (`weather.next` is chosen as a state begins), the build-up before a shower (`weather.approach`: thicker cloud, rising wind, far thunder), `weather.shower` counter, road wetness, wind and gusts, lightning strikes with a place and distance (`lightningStrike`, the flash's return strokes in `lightningFlash`) and thunder queued at distance / speed of sound |
| weather-audio.js | Rain and thunder sound: three recorded rain beds (`RAIN_BEDS`: light patter on a tile roof, a steady wash, a heavy downpour) cross-faded by intensity (`rainBedLevels`, `RAIN_LEVEL`), muffled under cover (`rainShelter()`: the underpass, beneath rail decks and station canopies, aboard a train or cab, the elevator) and through the glass inside a closed vehicle, where a resonant low band of the same recordings drums on the roof; tyre spray on wet roads (a band of the heavy bed), puddle splashes underfoot; `rainReport()` (DeadEndCity.rainSound()); `thunderSound(distance)` builds each clap (crack only when near; rumble rolls, lower and longer with distance) |
| water.js | Swimming, wading and sinking. `shoreStepBlocked` (called by `moveBody`) is the shoreline rule: on foot you enter the sea only from a beach; quays, docks, the pier and bridges are walls; out again at beaches, rocks or the `ladderList()` ladders. Also `exitIntoWater` (out of a flooding car), `diveOverboard` (J), `parachuteSplashdown`, harbor-patrol rescue |
| water-audio.js | Procedural splashes, strokes, wading, ladders, flooding cars, surf, lapping, gulls, lifeguard whistle |
| beach.js | Palm Keys Beach: the furniture plan (`BEACH_LAYOUT`, placed along the waterline by `shoreAt(s, d)`), `beachgoers` with time-of-day density, volleyball and frisbee, panic (`beachHearsViolence` from `notifyViolence`), kiosk colliders |
| roofmission.js | The Blue Hour terrace (`ROOFTOP`, `player.roof`, `moveOnRoof`), mission 2's hit (index 1); `entityElevation`, `sameFloor` |
| rooftops.js | Helicopter landings on flat roofs (`helicopterRoofSite`, `roofLandingClear`), rooftop helipads (`chooseRoofHelipads`, `b.helipad`), the `player.buildingRoof` carrier (`exitOntoRoof`, `moveOnBuildingRoof`), `playerOnRoof()` |
| air-cover.js | Railway, platform and underpass volumes for sight, bullets, vehicles and aircraft |
| combat-rules.js | Elevation-aware shots, vehicle handgun rules, tank armor and helicopter pursuit (`AIR_UNITS_MAX`: one hostile helicopter at a time from stars, a chase at sea or a mission; its marksman sharpens with the stars); SNIPER FIRE, shared by the rooftop snipers and the marksman: a lock of 2 s or more with a laser (rooftop), a rising beep and a red screen-edge glow toward the shooter (`noteSniperLock`, `sniperThreat`, hud.js SNIPER WARNING), then one visible tracer round (`fireSniperRound`) aimed at where the player is guessed to be (measured velocity, `trackPlayerMotion`, led by a random 0.3..skill of the flight time), so standing still is a hit and running or turning usually a miss; a hit is `'sniper'` damage, 50 before armour, never lethal from full health |
| damage.js | Vehicle damage model (crumple dents, panels, glass, lamps, tyres, engine fire, handling loss), bullet holes and wall/glass/ground strikes, blast shove, breakable street furniture (`registerStreetProp`, `streetPropContacts`), the damage console helpers |
| crash-audio.js | `crashSound`: one positioned, recorded crash per vehicle impact (from `collisionImpact`, including soft knocks below its damage threshold, and street props), picked by closing speed: a quiet bump or metal scrape, a medium crash or a heavy crash (small pitch and gain spread); glass only when a pane broke, a recorded tyre skid when sliding, a debris settle after very hard hits; trucks, buses and tanks use the heavy set a little lower; the whole bus plays at `CRASH_LEVEL` (-3.5 dB, under gunfire and engines); one event per pair per 0.7 s; `crashLog` (DeadEndCity.crashSounds()) records the choices |
| engine-audio.js | Engine sound: `ENGINE_SETS` (recorded loops per class with the revs each was recorded at: compact, sport, V8, diesel, bike, cruiser, tank, outboard, marine diesel, jet ski) and `ENGINE_OF_TYPE` (vehicle type to set, pitch, level); the player's engine simulation (`engineSimulate`: idle, clutch slip pulling away, automatic gearbox with a throttle cut on upshifts and a blip on downshifts, throttle load), layers pitched by rpm / recorded rpm and cross-faded in the middle of each gap (`engineLayerWeights`), a recorded starter on getting in, overrun burble (V8, sport), misfires when badly hurt; tyre roar, gravel off-road and tank tracks (tank-tracks.ogg), wind on open vehicles; synthesised turboprop and turbofan (`updateJetVoice`: whine, roar, hiss, blade buzz); the nearest four driven traffic vehicles get one voice each with distance, pan and Doppler (`updateTrafficEngines`); `engineReport()` (DeadEndCity.engineSound(): revs, gear, load, layer rates and gains, traffic, a trace) |
| county.js | County roads, towns, buildings, scenery, traffic, regional police and bridges |
| airfields.js | The runway plan (section 4, "Airfields"): `RUNWAYS`, `TAXIWAYS`, `RUNWAY_PIERS` (reclaimed land, pushed onto `LAND_REGIONS`), `runwayRect` / `runwayPoint` / `runwayUnder` / `runwayPierAt`, PAPI units and `papiShowsWhite`, `paintAirfieldGround` (the flat runways for the 2D view, the maps and the ground sheets), `airfieldReport()` (DeadEndCity.airfields()) |
| military.js | Fort Sentinel: the base plan (`SENTINEL`: fences, gate, buildings, depots, airfield), colliders (`militaryWalls`, `militarySolids()`), the gate (drop arms, anti-ram bollards, sliding gates, ramming), the challenge (halt, final warning, fire), alarm, lockdown and siren, garrison (posts, towers, patrols, drill, range, QRF and patrol jeeps, crewed armour, supply runs), the jeep/APC/army truck types, `militaryReport()` |
| armor.js | The player's tank: `traverseTurret` (30°/s, eased, stabilised; also used by the pursuit tank and army gunners), `updatePlayerArmor`, ammunition (`tankArms`: 40 main-gun rounds, 5 s reload, coaxial MG belts; `noCoax` tanks), `tankPlayerFire`, `toggleTankWeapon`, the weapon chip in a tank (`tankHud`, `drawShellIcon`) and the reticle (`updateTankReticle`) |
| aviation.js | Fixed-wing flight model (`planeControl`) and its controls (FLIGHT CONTROLS: engine spool, pitch and roll springs with inertia and auto-coordination, flaps, retracting gear and belly landings, stall and gear warnings with buffet, nosewheel steering and brakes), `flightData()` for the HUD and the console, flight missions 10 and 11 (indices 9 and 10), Daniel the witness (`followWitness`, `witnessStep`) |
| challenges.js | Missions 3 to 9 (indices 2 to 8) and the interact/UI routing for all missions (`challengeMissionInteract`) |
| sidejobs.js | The five contracts (indices 11 to 15, from `SIDE_JOB_FIRST`) and `sideJobPower` (blackout) |
| streets.js | Street grid (`cityStreets`, `cityStreetAt`), painting, `STREET_NAMES`, `streetNameAt`, `benchSpots`, the esplanade |
| terrain.js | The Ridgeline Range: generated, eroded height fields (one shared triangulated surface for rendering, collision and elevation), switchback 4x4 trails, baked AO / flow / forest data, forest, boulder and stream placement, the 2D relief paint, slope handling and off-road contact, `terrainReport` |
| casino.js | Roulette layout, stakes, settlement, UI and saved cash |
| skyline.js | North Point financial cluster plan: `SKYLINE_TOWERS` (named tower lots per block, heights, designs), `buildSkylineBlock`, `paintSkylinePlaza` |
| renewal.js | Parks (`CENTRAL_PARK`, `COMMONS`), ponds (`parkPondBlocked`, `parkPondNear`), boardwalks, walkers, joggers, the outdoor gym |
| sports-fixtures.js | Club pools (`SPORTS_TEAMS`: names, kits, crests), `SPORTS_CALENDAR`, daily fixtures (`sportsFixtureFor`, `sportsCurrentFixture`), the match timeline (`sportsTimeline`), `drawSportsCrest` |
| sports.js | Live basketball and soccer: match day stages, possession, shots, scoring, restarts, officials, harm and panic (`sportsTargets`, `sportsAbandon`), the player on the ball (`sportsKick`, stewards), `sportsConsole` |
| sports-world.js | South Coast Stadium reservation, enclosure (`PITCH_FENCE` with its openings), big screens (`STADIUM_SCREENS`), turnstiles, vehicle barriers, markings |
| sports-audio.js | Stadium goal reactions only (no crowd bed): the recorded cheer from the scoring end and groan from the other, attenuated by the player's distance to the stadium (`stadiumAudibility`); panic screams, the referee's whistle, kicks |
| transit.js | Railway: `RAIL_LINES` routes filleted by `railTrackGeometry`, `RAIL_STATIONS`, `railDecks`, boarding (`openTransit`, `boardTransit`), `leaveTransit`, scenic trains |
| ride-skip.js | Skip the ride: the offer and prompt (`rideSkipOffer`, `rideSkipPrompt`) for a cab, a train or the sailing liner, the `skipRide` / `skipStop` keys (`rideSkipKey`), the fade on simulation time (`updateRideSkip`), the jump (`performRideSkip`: `catchUpWorld`, `placeCabAtKerb`, `placeTrainAtPlatform`, `placeLinerAtAnchor`), `rideSkipReport` |
| ecology.js | Habitats, harmless animals, bear warning/attack and 2D drawing |
| navigation.js | Road graph, shortest paths, waypoints, map gestures and route guidance; the minimap GPS (road routes to the objective and the waypoint with direction chevrons, `updateGpsRoute`, `drawGpsRoutes`) |
| parachute.js | `aircraftClearance`, bail-out (`bailOut`), freefall, canopy (opens over one second), the Blue Hour terrace landing, water rescue; freefall wind and canopy flutter (`updateParachuteWind`) and the opening sound |
| mobile.js | Independent movement/aim fingers, context actions and overlay cleanup |
| world-view.js | World zoom, pinch gestures, mouse wheel and camera limits |
| car-radio.js | Six stations (`MUSIC_STATIONS`, one or more streamed tracks each; a change of station cuts straight to the new music with a silent DJ caption), selection, playback and saved settings; plays in vehicles and on the Sunset Pier rides (`radioAboard()`: the Falcon and the Eye use the same player, chip and N / B keys, and stop when the ride ends); RADIO VOLUME, the radio box's speaker and slider (section 4d); `radioReport()` |
| garages.js | Repair bays, vehicle fit, paint, repairs and pursuit clearance |
| crowd.js | Pedestrian life: rain reactions (`rainReaction`: remarks ahead of a shower, umbrellas, sheltering in doorways, running), `dressPerson`, the crowd streamer (`streamCrowd`), sidewalk walking, perception and reactions (`crowdAlarm`, `decideReaction`, `updateReaction`), bodies, near misses, hands up, witness calls (`crowdReport`), crash drivers and horns (`crowdCrash`, `updateTrafficLife`), speech bubbles (`crowdSay`; `speechBubbles` picks at most two on screen: soldiers, police and mission characters first, then lines at the player, then the nearest; each stays up long enough to read, others wait 2.5 s or lapse), taxi fares and bus stops (`curbsideStop`), street scenes, the neighbour grid (`forEachPedestrianNear`) |
| beachclub.js | Marea Beach Club on `BEACH_CLUB_PLOT`: the plan (`MAREA`, plot-local u/v, `mareaPoint`), colliders (`beachClubBlocked` from `solid()`, `addBeachClubColliders`), the schedule (`mareaPhase`, `mareaLevels`), the cast of slots filled by hour (club people are pedestrians with a `club` record, updated by `updateClubGoer` before the crowd), the door queue and bouncer dialogues (through `crowdSay`), evacuation (`beachClubHearsViolence` from `notifyViolence`), closing-time taxis, the player's cover and VIP band (`beachClubInteract`) |
| beachclub-audio.js | The club's procedural music on a look-ahead scheduler (day, sunset and night sets), the wall low-pass by where the listener stands, and `mareaGroove`, the beat clock the dancers and lights follow |
| ambience.js | Procedural traffic hum, crowd murmur, wind, birds, crickets, horns, sirens, club beat, busker |
| quality.js | Graphics quality tiers (LOW/MEDIUM/HIGH/ULTRA), GPU capability check and the saved setting (`graphicsTier()`) |
| settings.js | The SETTINGS screen (title and pause menus): GRAPHICS, AUDIO, GAMEPLAY and CONTROLS tabs, `SETTING_ROWS`, the volume sliders (`AUDIO_VOLUMES`, `channelVolume`, `volumeScale`, `setRadioVolume`, `resetAudioVolumes`), NPC chatter (`npcChatterOn`), the character see-through switch, the key remapping table and its keyboard handling (`settingsKeyDown`) |
| hud.js | HUD behaviour: pop-open radio and weapon boxes (`hudPop`), minimap fold and zoom (`hudState`), wanted stars, context key hints, the HOW TO PLAY key grid; the title menu (`updateTitleMenu`) |
| render3d.js | Renderer entry: street camera, lights, ground texture, lamps, static batching (`batchStaticGroups`), person/vehicle models, effects, `render()` |

Renderer closure (inside `createCityRenderer()` in render3d.js, in include order;
flight-view3d, postfx3d and lighting3d come first, right after the cameras and lights,
and helicopter3d, vehicles3d and plane3d last, before `makeVehicle`):

| File | Role |
| --- | --- |
| flight-view3d.js | Perspective flight camera, ground footprint, distance haze, shadow fit, LOD, impostors, far city |
| postfx3d.js | Half-float scene target, MSAA, SAO ambient occlusion, bloom (NaN/overflow-safe, Karis-weighted bright pass), ACES tone curve, grade, FXAA |
| lighting3d.js | Sun path (`sunDirection`), sky dome and environment map, night light map, `cityMaterialPatch`, the dithered cutaway (`updateCutaway`), the drive light map (head and tail lamps), contact shadows, time-of-day look (`NIGHT_LOOK`) |
| searchlight3d.js | Searchlights: volumetric light shafts (`createSearchBeam`), the cookie texture and ground pool decals (`createSearchPool`), rain lit in the beam, the police helicopter's spot light, lens flare and crew aim (`updateHelicopterSearchlight`) |
| damage3d.js | Deformable car shells, per-pane glass, pooled decal atlas, rubble and panels, props, smoke and fire, `shellImpact` (a tank round's breach in a facade: hole, cracks, soot, thrown and falling masonry, rubble heap, dust, broken glass) |
| cityscape3d.js | Buildings: facade archetypes (`archetypeFor`), roof textures and plant (recorded as `b.roofKeepOuts`), rooftop helipads, shopfronts, fire escapes, balconies, lit windows, instanced street furniture (`pools`) |
| signkit3d.js | (included by render3d.js before `sign()`) `SignKit`: the hand-built stroke font (`strokeText`), letter treatments (`tubes`, `doubleTubes`, `bulbLetters`, `blockLetters`, `stencilCut`, `decoLetters`, `pixelLetters`), canvas type effects (`fxText` with font stacks, gold and chrome fills), board shapes and materials (`boardPath`, `fillBoard`), emblems (`icon`, `tubeIcon`) |
| signdesigns3d.js | (included by render3d.js before `sign()`) `SignArt`: sign families, the business style table (`SIGN_DESIGNS`, fallback `designFor`), `paint`, rooftop hotel names (`paintHotel`), tower names (`paintTowerName`), billboard artwork (`ADS`) |
| signage3d.js | (included by cityscape3d.js) The glow field (`addGlow`: one instanced draw for every neon halo, bulb and beacon), wet-road streaks, sign light spill (`signSpill`), the neon/lightbox sign atlas (`signCell`, `atlasSign`), lit sign materials (`litSignMaterial`), LED ad screens, stock ticker, marquee bulbs |
| skyline3d.js | (included by cityscape3d.js) The financial cluster's towers: plans, lofting (`skyLoft`), glazing per design, LED crowns, beacons, podiums, plazas (`buildSkylineTower`) |
| sidejobs3d.js | Sky rings, bomb and substation devices |
| roadblocks3d.js | Loose traffic cones and burning flares |
| themepark3d.js | Falcon track, supports, station and train; the Sunset Eye (LED shows, level capsules); lagoon fountain; hotel, beach club, gate; family rides, flume, dark ride, dodgems, souk; palms, lamps, night light sheet, fireworks; ride cameras (the station roof and its sign are their own batch, cut away while the train or the ride camera is under them, `setStationRoofCut`) |
| garage3d.js | Garage buildings, shutters, lights and service details |
| landmarks3d.js | Waterfront gardens, civic precinct and ground helipads |
| civic3d.js | Businesses, the casino, hospital and school fronts, time-of-day palette |
| air-cover3d.js | Road underpass walls, roof, portals and lamps |
| renewal3d.js | Benches, fountains, courts, pergolas, pond bridge, boathouse and bicycle racks |
| landscape3d.js | Renderer-only planting on open lawns: Battery Park trees and flower beds, Great Lawn picnic blankets |
| sports3d.js | Tiered stands, crowd in team colours (fills, cheers, panics), floodlights (`stadiumFloodPools`), live screens (`paintSportsBoard`), kits, animated matches |
| transit3d.js | Swept viaduct, sleepers, masts, piers and bents, stations and moving trains |
| ecology3d.js | Species geometry, gait animation, culling and material cleanup |
| world3d.js | Shore-aware water shader, palms, airports, rooftop bar, waterfront scenery |
| wakes3d.js | Boat wakes (Kelvin V, propeller wash, hull collar) drawn into a wake map the water shader samples; bow spray and rooster tails |
| beach3d.js | Sand, swash ribbon, pier, props, ladders and instanced beachgoers |
| county3d.js | County ground tiles; the range's chunked terrain meshes (half-resolution far LOD with skirts) and their layered material (forest floor, meadow, alpine turf, dirt, scree, strata rock, snow, streams, AO, bump, snow glints); instanced forests and boulders (near / far LOD per 2048-unit cell), stream ribbons and waterfalls, dawn valley mist; rural scenery and the airport |
| airfields3d.js | Runways and taxiways over the ground sheets: one quad each with a patched standard material that paints the markings from metre uv (threshold, centre line, aiming point, touchdown zone, side stripes, blast pad chevrons, holding positions, rubber, rain), designation decals, holding-position signs; edge, threshold / end, approach (sequenced flashers), taxiway and obstruction lights as glow-field instances on batched fixtures; PAPI lenses and windsocks updated per frame (`updateAirfieldVisuals`, called from `updateCountyVisuals`) |
| base3d.js | Fort Sentinel meshes: its own ground sheet, double fence and razor wire, watch towers and searchlights, the animated gate, buildings, airfield, depots, night light pools, merged military vehicle models (`makeMilitaryVehicle`, `compactTank`) and soldier kit (`dressSoldier`, `poseSoldier`) |
| boats3d.js | Hull lofting, deckhouses, railings, deck furniture, name boards, night lights, mesh merging |
| drawbridge3d.js | The Palm Sound drawbridge in 3D (`buildDrawbridge`, the bascule builder): hinged leaves with grid decking, girders and counterweights, piers and tender houses, fenders, barrier gates, signals and lamps (switched lenses and halos), the ketch; `updateDrawbridgeVisuals` each frame |
| bridges3d.js | Every bridge in its own style from `bridgeStructure()`: truss, bascule, cable-stayed, suspension, arch, county designs; the shaded carriageway (`bridgeRoadMaterial`: asphalt wear and antialiased markings in the shader), expansion joints, each deck's lamp light map (`bridgeDeckLight`), lamps, LEDs, aviation beacons, foam cut round the deck, far copies |
| harbor3d.js | Cranes, the container ship, containers, depot, signals and helicopter searchlight |
| marina3d.js | Pontoons, sixteen unique yachts, the superyacht deck by deck, terminal, liners, the sailing liner and her wake |
| beachclub3d.js | The club's meshes (batched), sails that fade while the player is inside, and the show: LED floor, moving heads, lasers, strobe, LED wall, flames, string lights (`updateBeachClubVisuals`, called from `updateBeachVisuals`) |
| cycles3d.js | Bike-share racks (the bicycles are ordinary vehicles) |
| weather3d.js | GPU rain streaks (world-anchored, three depth layers, wind slant, lit by the night light map), splashes, roof and awning drips, spray behind cars, wet roads, lightning bolts and flashes, `vehicleLampAmount()` (headlights in heavy rain), the storm grade (`weatherGrade`) |
| crowd3d.js | One InstancedMesh per body part, layered poses, stride, dogs and scene props |
| clouds3d.js | Ray-marched cumulus at 385-610 m over a 3D noise volume, and their shadows on the city |
| surfaces3d.js | Ground shader detail (asphalt, paving, grass), rain puddles and rain rings / shiver on them, county ground, foliage sway |
| helicopter3d.js | Airframe, rotor, lights and cockpit |
| vehicles3d.js | Road vehicles, bicycles, boats (speedboat, launch, jet ski), riders and moving parts; windscreen wipers (`addWipers`, `updateWipers`) |
| plane3d.js | The three airframes, modelled on real types: the Serrano C200 courier (mission 11's plane; a low-wing single turboprop with a T-tail after the Pilatus PC-12), the Aurelia J8 business jet and the Meridian 220 airliner. A lofted fuselage (monotone-cubic stations, superellipse sections) wears a livery texture computed per pixel from the surface (windscreen and cockpit glass with frames, cabin windows, doors, cheatline, registration; glossy glass through a roughness / metalness map); NACA-section wings, winglets, fin and stabiliser; flaps, ailerons, elevators and rudder in hinge pivots; four-blade propeller with blur disc or lathed turbofans with spinning fans; retracting gear; navigation, strobe, beacon and landing lights. Static parts are merged per material. `animateAircraft` poses it all from the flight model each frame |
| parachute3d.js | The ram-air parachute: nine-cell canopy rebuilt per frame (inflation, pillows, brakes, trailing-edge flutter), lines, risers, slider, pilot chute and bridle, the pack; `poseParachutist` (freefall box position, hanging pendulum, toggles), collapse and pack-up after landing |

`src/asset-loader.js` sits outside the closure: it decodes the media blocks and calls
`startDeadEndCity(ASSETS)`.

## 4. The city layout

The world, west to east: **Palm Keys** (the tropical island, with the public beach), **Palm
Sound**, **Northbank** (the main island, a Manhattan of a street grid), **Marlow Bay**, and the
**county** (Ridgeline's forest and mountains; Oceanview, Coral Coast and Fort Sentinel to the
south-east). The **Sunset Pier** amusement island lies north of Northbank across North Sound.

```
 y       x: -3100 .. -1144        40 .. 3420            ~5880 .. 11000
 -7050        .                 [SUNSET PIER isle]            .
 -4200        .                 NORTHBANK (reclamation)       .
    50   PALM KEYS  <-Palm Sound->  NORTHBANK  <-Marlow Bay->  RIDGELINE (forest, peaks)
  5300   PALM KEYS BEACH            Battery Park               .
  6200+       .                     OCEANVIEW / CORAL COAST / FORT SENTINEL
```

### Frames and coordinates

- `WORLD_LEFT..WORLD_SIZE` x `WORLD_TOP..WORLD_SIZE` (-5120..11264 x -8192..11264) is the world
  box: the sea, the city map, the water shader's shore field (`SHORE_RES` 768 texels across).
- The city frame `CITY_LEFT..CITY_RIGHT` x `CITY_TOP..CITY_SIZE` (-3584..3712 x -4224..5632) is
  what the baked ground textures (game.js `groundCanvas`, render3d.js terrain and roughness
  sheets), the night light map (lighting3d.js) and the street grid cover: Palm Keys, Palm Sound
  and Northbank. Anything past `CITY_SIZE` in x or y is county (`x > CITY_SIZE || y > CITY_SIZE`
  tests stay valid; the county starts east of x 5632). Ground outside the city frame comes in
  tiles (`countyGroundTiles`, each `{x, y, w, h, canvas}`): three county tiles and the Sunset
  Pier island's own tile (`PARK_TILE`, themepark.js). Open water between them is just water; the
  bridge decks there are meshes (county3d.js) and, in the 2D view, drawn by `drawBridgeGround`.
- Palm Keys has negative x. `onPalmKeys(x)` (x < `PALM_SOUND_X`, -500) is how code asks "is this
  the Keys" (tropical buildings and palms, zoning, blackout power, water tint).

### Northbank (main island, x 40..3420, y -4200..5476)

- The street grid: avenue columns at `128 + i*512` (`ROAD_CENTERS`, i = -5..10) and street rows
  at `128 + j*512` from y -3968 to 5248 (`ROAD_ROWS`; the northern reclamation has negative y).
  Streets are 88 wide; the 112-wide avenues with double yellow centre lines are
  `WIDE_COLUMNS` (x -1920, 1152, 2688, 3200) and `WIDE_ROWS` (y 1152, 2688, 3200, 4736, -1408,
  -2944); ask `wideColumn(x)` / `wideRow(y)` (a single list could not tell column -1408 from
  row -1408). Blocks are 334 units square; `BLOCK_COLUMNS` builds Northbank (bx 0..9) first so its
  seeded buildings never change, then Palm Keys. Streets are clipped to land, the airport, park
  closures, the stadium, the beach and the reserved plots (`cityStreets()` in streets.js); a
  bridge deck counts as ground, so a row carries straight across a bridge on its line.
- The west shore is one straight reclaimed sea wall (x 40..52). The strip between it and the
  first blocks (x 217) carries the esplanade on the sea side and the Shore Line viaduct above
  the old West Quay alignment (`RAIL_CORRIDOR_X`, no longer a street). Rows run under the
  viaduct to the esplanade; Union St and Harbor Ave run on across Palm Sound.
- The south shore is a straight sea wall at y ~5460..5476 between the airport inlet and Riverbank
  Dr: Battery Park (`SOUTH_PROMENADE`, a lawn between the Marina Rd pavement and the esplanade,
  x 1770..3120, y 5306..5376). There is no beach on Northbank.
- Districts, from `districtAt()`: Harbor Point Marina, Cruise Terminal, the Reclamation and North
  Point Financial (north), Old Quarter and Ironworks Docks, Midtown, Broadway and the Exchange
  District, South Bank, Battery Point, Battery Park and Southport Airport (south). Zoning lives
  in `zoneHeight()` (heights) and the block patterns in `buildWorld()`; the renderer picks
  facade/roof archetypes from the same district names in `archetypeFor()`. The stadium, the
  marina, the Ironworks harbor and the financial district are all on Northbank.

### Palm Keys (the tropical island, x -3135..-1144, y 50..5806)

- Reflected east-west when it moved west (it was the eastern island at x 3960..5630): Ocean Dr
  (x -2432) and its palm strand face the open sea on the west, Flamingo Ave (x -1920, wide) runs
  down the middle, Collins Ave (x -1408) along the bay side. Blocks bx -5 and -4. The bay side
  faces the city across Palm Sound: quay, esplanade, the jetties (`DOCKS`) and both bridge
  landings. Each block kept its contents when it moved (old block 8 -> -4, x - 6144; old block
  9 -> -5, x - 7168; points on the streets and the strands are reflected, x' = 2816 - x): the
  Blue Hour (-4, 4), Riverside Medical, Riverside High, Bayview Tavern, Neon Palace, Coral Palms
  Motel, Palm Grill, Ocean Drive Menswear, the Golden Tide casino (-5, 5), Palm Keys Armory,
  Palm Auto Paint and Vinny's depot (block -4, 8, at x -1804..-1524, y 4340..4580).
- Districts by y: Palm Keys Art Deco (< 1500), Ocean Drive (< 3100), Little Havana (< 4400),
  Coral Marina.
- Shores (`shoreStyle`): sand on the public beach and down the west strand (x < -1700), quay on
  the bay side. On foot the sea can be entered only from sand.
- **Palm Keys Beach** (`BEACH` in geography.js) is the public strand on the island's south shore,
  x -2668..-1285, from the Marina Rd kerb (y 5306) down to a smooth curved waterline
  (`smoothShoreline`, y 5430..5806), facing the open sea. Its top edge is a 40-wide boardwalk
  (`BEACH.boardwalk`) and a timber fishing pier (`BEACH.pier`, part of `groundAt`) runs out from
  the lower sand at x -1710. It is Southport Beach moved here whole (every x - 4410). No streets
  or blocks are laid on it and the esplanade stops at either end. beach.js places the kiosks,
  bar, lifeguard towers, umbrellas, towels, court, buoys and people; beach3d.js draws them.
- **Reserved: the beach-club plot** `BEACH_CLUB_PLOT` = x -3070..-2670, y 5306..5606 (400 x 300)
  at the west end of the beach: the sand on its east side, the sea on its south and west, road
  access from Marina Rd (y 5248) along its north edge and Ocean Dr (x -2432) at its north-east
  corner. It is painted as a levelled paved lot; `inReservedPlot` keeps streets, blocks and the
  esplanade off it. **Marea Beach Club** stands on it (beachclub.js, beachclub3d.js): a social
  beach club 09:30-18:30, sunset sessions to 21:45, a nightclub 21:45-04:15 (queue, bouncers,
  $40 cover and a $250 VIP band on E at the door and the VIP rope), closing and taxis to 05:15.
  The plan is in plot-local units (u east from x -3070, v south from y 5306): the street
  forecourt with the snaking queue (v < 44), a low wall with the door at u 292..312, then the
  stage and dance floor, the bars, the VIP terrace, daybeds, the pool and the deck with a gate
  to the club's sand. The camera looks north, so anything tall hides what stands just north of
  it: keep the street side low.

### Sunset Pier island (x 1830..4260, y -7090..-5680)

- A Gulf-style resort and theme park (themepark.js lays it out and simulates it,
  themepark3d.js draws it; `PIER` holds every position). The Sunset Pier Bridge lands at the
  main gate (3200, -6030); `PIER ISLAND DRIVE` runs east past the bus bay (3266, -5838), the car
  park and the Sunset Eye to the east gate.
- **The Falcon** fills the west half (the old `THEME_PARK_RESERVE`) and runs out over the west
  and north shores: `COASTER_ELEMENTS` is the circuit authored as eased track elements (lift to
  41 m, a 72-degree first drop, loop, camelback, overbanked turn, heartline roll, corkscrew,
  helix, bunny hop, brakes) walked into a closed, banked curve (`coasterCircuit()`, 2-unit
  samples; `coasterFrame(s)` gives position, tangent and up). The train (`coasterTrain`, `t` =
  front car's arc length) runs all day on gravity with lift, trim and station sections; the
  station is at (2575, -6430), queue hall to its south. Supports come from
  `coasterFootings()`, which keeps them off paths, the lagoon and buildings.
- **The Sunset Eye** (hub 3600, -6050, 300 up, rim radius 240, 48 capsules, one turn in 240 s;
  `wheelCapsule(k)`) with its terminal underneath. **Fountain Lagoon** (3170, -6370) with the
  show schedule (`fountainShowAt`) and fireworks (`fireworksTonight`), the **Sunset Palace**
  crescent hotel (3530, -6770), the beach club on the north shore, and in the east the
  carousel, swing ride, teacups, drop tower, dodgems, the Arabian Nights dark ride, the souk
  food court, kiosks and the Wadi Splash log flume (`FLUME_PATH`).
- Riding: `player.coaster` is the carrier for both rides (`{ kind: 'train' | 'wheel' }`), so the
  existing teleport, death and mission-reset hooks let go of either. The ride camera
  (`updateParkCamera`, called from render3d.js right after `updateFlightView`) puts the
  perspective camera on the ride.
- Collision: `parkSolids()` (rectangles, used by `parkBlocked` for people through a 128-unit grid
  and by physics.js for vehicles) and `parkAirSolids()` (minHeight bodies: the Eye's disc and
  the high track, for aircraft). Paths are `PARK_PATHS`, joined into the graph the park crowd
  walks (`parkPathGraph`, queues in `PARK_QUEUES`); guests exist only while the player is within
  ~1.9 km. `DeadEndCity.themePark()` reports rides, shows, guests and an overlap self-check.

### Water and bridges

- Channels: Palm Sound (Palm Keys - Northbank, x -1144..40, ~1200 wide), Marlow Bay (Northbank -
  Ridgeline, x 3420..~5900, 2400..2700 wide; `RIVER`), North Sound (Northbank - Sunset Pier,
  y -4190..-5690, ~1500), the south channel to Oceanview (~800..1000).
- `BRIDGES` (geography.js) lists every road bridge as a straight deck `a` -> `b`, `width` wide,
  deck at road level (`deck: 0`), and its architecture (`style`). Guard rails line the deck over
  water (`countyBridgeRails`, county.js). `bridgeStructure(bridge)` lays the design out in the
  bridge's frame (`along` from the middle toward `b`, `across` to the right; `bridgePoint()` maps
  it) from the style's rule in `BRIDGE_DESIGNS` and the deck's run over water: the navigation
  `channels`, the `footings` standing in the water (piers under the deck, tower caissons, arch
  feet, anchorages, fenders) and the `solids` rising from or spanning the deck (tower legs,
  portals, cable fans, arches, trusses; anything over the carriageway starts at
  `BRIDGE_CLEARANCE`, 46, above the tallest road vehicle). On the map, `bridgeFootings()` are what
  boats steer round (`boatObstacles`, citylife.js: they pass under the deck between footings, and
  no footing stands in a channel) and `bridgePylons()` are aircraft colliders (county.js,
  oriented static bodies with `minHeight`). bridges3d.js draws every bridge from the same
  structure; roadblocks.js cuts the city end of each axis-aligned bridge; air-cover.js treats
  decks as cover; the route graph joins them to the streets (collinear roads share nodes at each
  other's ends). `layout().bridges` carries the styles, towers, footings and channels.

| id | name | style | link | from | to | width |
| --- | --- | --- | --- | --- | --- | --- |
| keys-union | KEYS BRIDGE | green steel camel-back through-truss on four river piers | Palm Keys - Northbank (Union St) | -1460, 1152 | 130, 1152 | 112 |
| keys-harbor | PALM SOUND CAUSEWAY | low causeway, globe lamps, a working double-leaf trunnion bascule (drawbridge.js): tender's houses, fenders, barrier gates | Palm Keys - Northbank (Harbor Ave) | -1460, 3200 | 130, 3200 | 112 |
| east-bay | EAST BAY CROSSING | white cable-stayed, one A-pylon (380) and two fans of stays, a channel each side | Northbank - Ridgeline (Harbor Ave -> Ridgeline Hwy) | 3150, 3200 | 6580, 3200 | 122 |
| south-bay | SOUTH BAY BRIDGE | red suspension bridge, two towers (316), main cables, hangers, anchorages | Northbank - Ridgeline (Stadium Way -> Foothill Rd) | 3150, 4736 | 6420, 4736 | 112 |
| pier-bridge | SUNSET PIER BRIDGE | leaning white network arch (rise 244) with colour-cycling LEDs | Northbank - Sunset Pier (Riverbank Dr) | 3200, -3900 | 3200, -5800 | 104 |
| oceanview | OCEANVIEW CAUSEWAY | low precast viaduct, fishing balconies, striped channel beacons | Northbank - Oceanview | 3200, 5000 | 3200, 7010 | 128 |
| coral-sound | CORAL SOUND BRIDGE | extradosed: four coral sail pylons, harps of stays | Oceanview - Coral Coast | 5700, 8000 | 6750, 8000 | 116 |
| ridgeline | RIDGELINE VIADUCT | cable-stayed on two concrete H-pylons, weathering-steel girder | Ridgeline - Coral Coast | 7800, 5620 | 7433, 7262 | 116 |
| sentinel | SENTINEL CAUSEWAY | olive plate-girder causeway, swing span on a pivot pier, floodlights | Coral Coast - Fort Sentinel | 7800, 8150 | 9440, 8150 | 126 |

  bridges3d.js (after boats3d.js) builds each bridge in its own frame with the boat kit and
  merges it into a few vertex-coloured meshes (`kitMerge`); its lamps, navigation lights and
  cable necklaces are one points cloud; lamp heads, floodlit paint (`bridgeGlowPaint`), LED
  strips (`bridgeLed`) and the pulsing red aviation beacons come up with `nightAmount`
  (`updateBridgeVisuals`, called from `updateCountyVisuals`). Foam lies round every footing just
  above the highest swell crest. A plain copy of every bridge sits in the far scenery
  (flight-view3d.js `farScenery`/`farHidden`), shown instead when the whole city is in view.

  Rail bridges are part of the viaducts (transit.js): the Coast Line's sea viaduct over the south
  channel and the Ridge Line's bridge across Coral Sound. No rail line crosses Palm Sound, Marlow
  Bay or North Sound.
- **The Palm Sound drawbridge** (drawbridge.js, drawn by drawbridge3d.js). The Palm Sound
  Causeway (`keys-harbor`, `movable: true`) is a working double-leaf trunnion bascule. Its
  layout is `bridgeStructure(bridge).bascule`: `leaf` 100 (trunnion to the joint mid-channel),
  `drop` 8 (the trunnion axis below the road), `trunnions`, `piers` (64 long, the counterweight
  pits; four tender's houses, the south-east one the control house), `fenders`, and the `gates`
  and `stops` (barrier and stop lines on the approach spans). The phase clock is game seconds
  (an in-game minute each), so an opening lasts about ninety seconds of play:
  `warning` (bells, signals amber then red) → `gates` (entry arms, then exit arms; an arm waits
  while a vehicle is under it) → `clearing` (the tender waits until the span is empty; horn and
  a HUD line if the player is on it; a stalled car nobody is watching is towed after 20 s) →
  `unlock` → `raising` (eased, ≤ 4.2°/s, to 78°) → `open` (until the ketch is through, 8-45 s)
  → `lowering` → `seating` → `lifting` → `idle`. Openings start at `DRAWBRIDGE_OPENINGS`
  (00:50, 05:30, 10:15, 15:00, 20:40) for the ketch ALBATROSS, whose masts clear 19 m: she lies
  at anchor 720 units off the deck on one side, sounds for the bridge, waits at the hold point
  (330) and crosses in the `open` phase to the other anchorage (her hull is in `boatFits`).
  - Traffic: `trafficControl` brakes to the stop line (`drawbridgeTrafficLimit`; a car too close
    at the first amber carries on) and, past it, to the trunnion while the span is not seated.
    `drawbridgeKeepsOff` (settleVehicle) keeps every vehicle but the player's off an unseated
    span, so cops that ram through the arms stop at the gap. Arms are barrier bodies for the
    contact passes (`drawbridgeBarrierBodies`) and snap above 50 km/h (`updateDrawbridgeRamming`,
    replaced once the bridge is down and the player is 800 away). People: `drawbridgeFootBlocked`
    (footStepBlocked) refuses inward steps past a lowered sidewalk arm or onto an unseated span.
  - Leaves as ramps: `drawbridgeSurface(u)` is the road height and slope at a point (null over
    the gap); the open gap is not deck (`onBridgeDeck`), so it is water to water.js. A road
    vehicle on a leaf carries `deckLift` (added by `entityElevation`), `deckLeaf`, `deckSlope`
    and `slopePitch`; `drawbridgeSlopeDrive` (controlVehicle) adds gravity along the slope
    (`DRAWBRIDGE_GRAVITY`, real gravity) and caps the tyres at `DRAWBRIDGE_GRIP` 0.84 (no climbing
    past ~40°). Off a tip the vehicle is airborne (`deckAir`, `deckVz`; controlVehicle runs
    `drawbridgeFlight`: no grip or steering, the nose drops); `drawbridgeSettle` lands it on the
    far leaf or the deck beyond (damage from the speed into the surface above 5 m/s, a BRIDGE
    JUMP headline), bounces it off the far tip if it comes in low, or drops it into the Sound
    where `updateSinking` floods it. Above `DRAWBRIDGE_WALL_ANGLE` (40°) each leaf is a wall.
    An airborne car clears rails lower than it (vehicleContactPasses).
  - GPS: route links across the span carry `drawbridge`; `navShortestPath` adds
    `drawbridgeRouteDelay()` (seconds until traffic moves × 230) to them, so short trips wait
    and long ones go round by the Keys Bridge. The graph itself is built as if the bridge were
    down (`drawbridge.routing`).
  - Map: the baked ground layers leave the moving span out (`drawBridgeGround`; the 2D view
    passes `live`); `drawDrawbridgeMap` draws it (deck, or leaves foreshortened over water),
    red bars at the gates and a state icon (white down, amber closing, red up; BRIDGE UP on
    the city map), and the ketch on the city map.
  - 3D (drawbridge3d.js): each leaf is a group hinged at its trunnion (`drop` below the road):
    carriageway and footways in the deck's own materials (`bridgeDeck` takes `look.gap` and
    keeps its materials in `g.userData.deckMaterials`; `bridgeRoadGeometry` takes a `start`
    so markings run on), open steel grid decking over the joint (alpha-tested), a finger lock,
    ornamental railings, tapered fascia and main girders, floor beams, stringers, bracing, the
    trunnion shaft and counterweight, red / green tip lanterns. Granite piers with house
    platforms and balustrades, four limestone tender's houses with lit lookouts and copper
    roofs, the control house's vessel signal mast (red / green each way up the channel) and
    horn, timber fenders with red-lit dolphins, per approach two kerb cabinets with striped
    arms (lamps along them), sidewalk arms, wig-wag lamps, a mast-arm signal with a STOP HERE
    ON RED sign, a stop line and an advance DRAWBRIDGE AHEAD sign with amber flashers. Lenses
    are shared materials switched each frame; lit ones get halos. A snapped arm keeps its stub
    and leaves its boom on the road. The ketch is built with the boat kit the first frame she
    is needed. Sounds (short procedural voices through the effects bus): bells, motor hum,
    lock clanks, horns.
  - Console: `DeadEndCity.drawbridge('status' | 'open' | 'close' | 'hold', degrees |
    'snap', degrees)`, `drawbridgeLook(spot, zoom)` ('channel', 'west', 'east', 'north',
    'south', 'tower'), `drawbridgeTraffic(count)`.
- Water access (water.js): on foot the sea can be entered only across a beach shore; everywhere
  else the edge is a wall. Swimmers climb out at beaches, rocky shores and ladders (86: every
  ~420 units of quay, dock ends and the pier head, each only where a swimmer can reach the
  foot head-on), each marked by a lifebuoy post. The superyacht's passerelle counts as dry
  ground for the shoreline rule.

### Streets, county, railway, parks

- Street names are in `STREET_NAMES` (streets.js; Palm Keys columns keyed '-2432', '-1920',
  '-1408') and shown in the HUD under the district; off the grid, a bridge or county road gives
  its own name.
- The county (Ridgeline, Oceanview, Coral Coast, Fort Sentinel) is defined in county.js with its
  own roads, towns and an airport.
- **Airfields** (airfields.js, drawn by airfields3d.js). Two runways, sized from the measured
  take-off rolls (section 2a) at 1.4-1.8x plus blast pads:
  - SOUTHPORT 18/36, 460 m x 29.5 m (x 300..536, y 4280..7960; blast pads 15 m north, 30 m
    south), a GA strip for the courier. Most of it lies on a reclaimed pier running south
    into the sea (`southport-pier`, x 196..760, y 5300..8240) with a parallel taxiway at
    x 700 and connectors at y 4340, 5330 (to the hangars), 6120 and 7900.
  - OCEANVIEW 09/27, 1,280 m x 30 m (y 9764..10004, x -4040..6200; blast pads 30 m), the
    jet and airliner runway. The island only had room for 550 m: the runway runs west out
    to sea on `oceanview-pier` (x -4320..2250, turn pad at the west end) with a small
    `oceanview-pier-east`. Taxiway stubs at x 3750, 4500, 5260 and 5910 lead to the apron.
  A full-length (1,800-2,500 m) airliner runway fits nowhere in a world about 2 km across; the
  airliner's figures are a regional jet's at a light weight. The piers are land regions with
  a rock revetment (world3d.js), their own ground (`paintAirfieldGround`; the west pier has
  its own county tile) and district names (`districtAt`). Southport's 36 approach passes
  low over Oceanview's west pier: the two runways' extended centre lines cross. Both jets and
  the airliner park at Oceanview; Southport has three couriers. Fort Sentinel's 120 m strip
  (military.js) is a landing area for helicopters; `AIRFIELDS` (aviation.js) lists it so a
  landing there counts as on a runway. `DeadEndCity.airfields()` reports the plan, what each
  PAPI shows the player's aircraft and where every plane is.
- **The Ridgeline Range** (terrain.js, drawn by county3d.js) fills the north of Ridgeline between
  the north coast and Eagle Pass / the Ridgeline Highway: one height field over x 5880..10980,
  y 60..2620 on a 10-unit grid (`TERRAIN_FIELDS[0]`), plus a small field for each of the two lone
  hills further south (6800, 5300 and 4330, 6740). A main crest (`RANGE_CREST`) runs west to east
  through **MOUNT ASCENT** (7760, 1090; a rugged summit horn, ~93 m) and **NEEDLE RIDGE** (9760,
  1230; an overlook in a notch between a row of rock needles), with a low saddle above Clearwater
  Reservoir; spurs run short and steep to sea cliffs on the north, long down to the valleys on the
  south; low foothill ridges fill the Eagle Pass loop and the country east of the reservoir. The
  field is generated once, on first use (deterministic, typed arrays): ridge network + domain-warped
  ridged multifractal and derivative-damped ("erosion") fBm, three passes of stream-power incision
  over depression-filled D8 flow, terraced strata on steep faces, thermal settling, then caps from
  distance fields (exact distance transforms): flat on and beside every county road, service road,
  rail line, town block and the Northridge helipad, rising no faster than a noisy embankment;
  gentle shores on the reservoir; sea cliffs on the coast; nothing at the field's edge. The two
  4x4 trails are switchbacks up the south faces (`switchbackTrail`), graded to at most
  `TRAIL_MAX_GRADE` (0.28) between street level at the trailhead and a level summit platform, cut
  and filled into the surface with shoulders that widen with the cut. `terrainHeight` samples the
  field's exact Float32 vertices with the mesh's own diagonal (`sampleTerrainField`); the renderer
  draws those same vertices (near LOD), so contact and picture agree. `DeadEndCity.terrain()`
  reports the fields (grid, top, build timings), peak and trail figures, scenery counts and the
  outcrops' footing.
- **Fort Sentinel** (military.js `MILITARY`, `SENTINEL`; drawn by base3d.js) fills x 9300..10560,
  y 7750..9950 of its island inside a double razor-wire fence with eight watch towers. The
  Sentinel Causeway lands at the main gate (y 8150): jersey-barrier funnel, guard booth on a
  centre island, per lane a drop arm (x 9272), anti-ram bollards (9290) and a sliding gate
  (9310). Arms and bollards stop vehicles only; the sliding gate stops everyone. Military
  traffic lifts the arms; an arm snaps for anything faster than 80, bollards only for heavy
  armour, the sliding gate for a heavy vehicle at speed. Guards challenge anyone in the gate
  area (halt, final warning, then fire); trespass, attacks or ramming raise the alarm: siren,
  PA, lockdown (bollards up, gates shut), tower sentries and posts engage, the QRF jeeps drive
  at the intruder, and the wanted level is kept up while the player stays in or near the base.
  E at the gate forces the controls open for a few seconds (the way out without a tank).
  Inside: HQ and flagpoles, comms mast, radome, radar and water tower (north); obstacle
  course, parade ground (a platoon drills by day), three barracks, mess hall and clinic;
  motor pool, containers, fuel depot, ammunition bunkers and the rifle range; two hangars,
  control tower, helipads, apron and a 960-unit runway (south). `DeadEndCity.military()`
  reports the security state. Foothill Road climbs from the South Bay Bridge landing (6420,
  4736) to Stonecreek's south-west corner (6720, 4224).
- The railway (transit.js, drawn by transit3d.js) runs on its own elevated right of way:
  - SHORE LINE: Cruise Terminal (2480, -3968, on the apron street in front of the terminal) ->
    an el down Garden St (x 2176) and west along the avenue at y -2944, with Harbor Point station
    (1408, -2944) south of the marina; it never crosses the basin's mouth -> the west sea wall at
    x 150 with Reclamation, Old Quarter and West Quay stations (past the Keys Bridge and Palm
    Sound Causeway landings) -> a curve across Viaduct Green onto Harbor Ave (Broadway station,
    860, 3200) -> Royal Ave -> Southport Airport (1220, 4890), over the terminal forecourt on
    Airport Way. The avenue legs are an el on straddle bents planted on the pavements.
  - COAST LINE: Southport Airport -> sea viaduct across the channel -> Oceanview (1990, 7300) ->
    Oceanview Airport, behind the terminal (4215, 8330) -> Coral Sound narrows -> Palmshore
    (6600, 8150).
  - RIDGE LINE: Palmshore -> its own bridge across the sound -> Eastgate (8790, 5000) ->
    Northridge (8300, 3740) -> Stonecreek (7850, 4050).
  Each line's `route` is a control polygon; `railTrackGeometry` fillets every corner with a
  circular arc (per-point radius, minimum `RAIL_MIN_RADIUS`), eases it with a smoothing pass,
  and thins it to `line.points`. Stations are inserted into their routes and kept on straight
  track. Everything else (decks, piers, cover volumes, the map, trains) reads `line.points`.
- Central Garden (renewal.js `CENTRAL_PARK`, `COMMONS`) is two blocks wide and two deep; the
  streets inside it are closed by `parkStreetClosed`. Eastside Customs garage sits on Cannery St
  at (1320, 2022).
- South Coast Stadium (sports-world.js) is enclosed: `STADIUM_ENCLOSURE` blocks people and
  vehicles, `STADIUM_VEHICLE_BARRIERS` (bollards, turnstile span) block vehicles only, and the
  two turnstile gates at x 2665..2686 and 2692..2713 (y 4845) are the only way onto the concourse.
  The pitch boards have two 26-unit openings (x 2676..2702): the players' tunnel on the north
  side and, straight ahead of the turnstiles, the south side. See section 4d.
- `DeadEndCity.layout()` returns the whole plan as data (coast, streets, rail, buildings,
  helipads, docks, ships, props, static colliders, the bridges with their pylons and the reserved
  plots); `docs/audit/world-layout.md` describes the overlap audit run on it.
  `DeadEndCity.route(x, y)` reports the GPS route from the player (and which bridges it uses).

## 4d. Input, settings and the HUD

- **Actions, not keys** (controls.js). `CONTROL_ACTIONS` lists every keyboard action with
  its default keys and the contexts it is used in (`foot`, `drive`, `air`, `chute`). Each
  action's first default key is its *virtual code*: the keydown/keyup listeners (game.js,
  KEYBOARD) translate physical keys through the bindings and set `keys[virtualCode]`, so
  the simulation keeps reading `keys.KeyW`, `keys.ShiftLeft`, `keys.Space`, and tests that
  hold `['KeyW']` or `['KeyT']` hold the action. New code should read `actionHeld('ascend')`
  and name keys in prompts with `keyName('interact')` (never a literal "E"). Two actions may
  share a key only when their contexts do not overlap (Space: handbrake in a car, fire on
  foot); the settings screen offers to swap on a clash. Menu keys (Escape, Enter, the map's
  arrows / + / − / 0 / C) are fixed.
- **Aircraft** climb and descend on their own actions, `ascend` / `descend` (↑ / ↓, with
  T / G as second keys; the virtual codes stay `KeyT` / `KeyG` through the action's `code`):
  the helicopter's lift and the plane's pitch (physics.js `helicopterControl`, aviation.js
  `planeControl`), clear of Space (handbrake) and Shift (walk on foot, pedal hard on a bicycle). The arrows are also
  forward / back's second keys: `ascend` / `descend` declare `overrides: 'forward'` /
  `'back'`, so `actionsForKey()` gives the key to them in the `air` context
  (`controlContext()`) and to movement everywhere else, and `controlConflicts()` does not
  count that pair as a clash. W / S stay throttle and fly forward / back in the air.
  Bindings saved with the old T / G defaults move to the new ones on load. Planes also
  have `flapsDown` / `flapsUp` (X / Z) and `gear` (L), handled on keydown in game.js
  (`setPlaneFlaps`, `togglePlaneGear`, aviation.js). In a plane the camera leads the
  aircraft along its smoothed velocity (`planeCameraLead`, game.js), pulls back a little
  with airspeed and shakes with the stall buffet (flight-view3d.js).
- **Settings** (settings.js) is one screen with four tabs built from `SETTING_ROWS`; each row
  has `get()` / `set()` and applies at once. While it is open `gameMode` is `'settings'` and
  the keydown listener hands every key to `settingsKeyDown()`. The character see-through
  switch writes `dead-end-city-cutaway` and calls `city3D.setCharacterCutaway(on)` (owned by
  the renderer). NPC chatter off hides the street speech bubbles (render3d.js); mission
  dialogue (`#storyLine`, the Blue Hour bubbles) is unaffected.
- **Audio buses** (audio.js THE MIX): one gain per category, each set by its Settings · Audio
  slider (settings.js `AUDIO_VOLUMES`; `busLevel(channel)` = 0.62 x the slider): `master`
  (effects: weapons, impacts, crashes, UI; the historical name, so anything connected to
  `master` is an effect), `engineBus` (engine-audio.js, the tyre and rotor loops), `ambienceBus`
  (ambience.js and everything on `ambience.bus`, weather, water, the pier rides, the drawbridge,
  parachute wind), `sirenBus` (the police siren loop, Fort Sentinel's siren), `musicBus` (the
  beach club, at the radio level) and `voiceBus` (callouts). All but the voices pass the
  ride-skip `duckBus`, then the ear filter, then `mixBus` (master volume x the Sound switch) and
  the limiter. Engines default to 65 (about 3.7 dB under their old level on the shared effects
  slider); a save from before the split starts ambience at its old effects value and engines at
  65% of it. The car radio is an `<audio>` element scaled by `volumeScale('radio')` (master x
  radio). `applyVolumes()` pushes every change into the live mix and the radio box's slider;
  RESET AUDIO TO DEFAULTS (an `action` row) restores the default mix.
- **Radio volume** (car-radio.js RADIO VOLUME): the radio box's open rows carry a speaker (mute
  / unmute to `settings.radioUnmute`), a slider and the level: the same value as Settings ·
  Audio · Radio & music, set through `setRadioVolume()` (settings.js) and redrawn by
  `renderRadioVolume()` whoever changes it. Drag, click, the wheel anywhere over the box (open or
  resting), a tap on touch (the box opens first), the focused slider's own keys, and
  `radioQuieter` / `radioLouder` (`,` / `.`, remappable) in a vehicle. The row stops pointer,
  click and key events so nothing reaches the canvas (fire, aim, zoom) or the window's keydown
  (arrows, Space); the box stays open while a drag lasts and gives focus back to the canvas
  after a mouse drag or click. Muted, the resting chip's bars lie flat with a crossed speaker.
  `DeadEndCity.radio()` reports it.
- **HUD** (shell.html DOM and the INTERFACE 30 stylesheet section; hud.js): top-left
  location, top-right cash / stars / clock, a waypoint pill top centre, bottom row minimap
  with health and armour bars, the mission card and the equipment column. The radio and
  weapon boxes are `.hud-pop` elements: compact until `hudPop(id)` (station change, weapon
  change, firing, reloading) or hover opens their `.hud-more` rows. The minimap zooms with
  the wheel or a pinch over it (`minimapZoom()` scales the cached base layer in
  `drawMap`), folds with its button, and both are saved. With **GPS route on minimap**
  (Settings · Gameplay, `hudState.gps`, on by default) the minimap draws the A* road route
  to the mission objective (gold) and to the map waypoint (cyan) with chevrons pointing the
  way (navigation.js, GPS ON THE MINIMAP), refreshed every couple of seconds once the
  player or the target moves; in the air, on the water or on a ride it keeps the straight
  line. The big map is unchanged. In touch mode the bottom row
  moves to the top so the thumbs have the lower corners.
- **Interaction prompt** (hud.js INTERACTION PROMPT, `#interaction`): one owner. Systems never
  write the element; during an `updateUI()` pass they call `offerPrompt(text, { key, hold, id })`
  (`key` is a control action named with `keyName()`, `null` for none; `hold` reads "HOLD E";
  `id` keeps the prompt's identity while its text changes, e.g. `'vehicle'` for passing cars,
  `'harbor-load'`). The last offer of the pass wins (mission prompts come after the generic
  vehicle / payphone one), and `commitPrompt()` at the end of the pass applies the rules: a
  new prompt pops in at once under the player; the same id only refreshes its text; a different
  id replaces it after `PROMPT_SWAP_AFTER`; with no offer it stays `PROMPT_HIDE_GRACE` (and
  `PROMPT_MIN_SHOW` in all) and fades. After `PROMPT_DOCK_AFTER` (3 s) it slides into a compact
  chip under the navigation pill (`--hud-dock-top`, measured when it docks; touch: above the
  action buttons on the right) and pops back to full size for a new action or on coming back
  into range. Visibility is a class (`.show`), never `display`, so a style flush cannot restart
  the pop-in (the old writers toggled `display` none → block every pass, which restarted the
  fade-in 11 times a second: the "flickering" LOAD CARGO prompt). The HUD clock is wall time
  plus the time `DeadEndCity.simulate()` steps; `DeadEndCity.promptState()` reports it.
  Range tests behind a prompt have hysteresis, asked the same way by the prompt and by E:
  `withinRange(key, distance, enter, exit)` (hud.js) for the payphone (68 / 84), rail stations
  (48 / 60) and the harbor barrier (110 / 130); `nearestPlace()` keeps the door already in reach
  until 66 (enters at 52: shops, the hospital after a respawn, casino, garages' offices); the
  loading bay has its own (harbor.js LOADING BAY RANGE: in at 85, out at 110; ready to load when
  stopped inside 43, until moving or past 48). A vehicle's prompts share one identity
  (`'helicopter'`, `'plane'`, `'garage'`), so TAKE OFF → RISE or DRIVE IN → RESPRAY change text
  without a new pop-in.
- **Centre cards** (hud.js CENTRE CARDS): the headline card (`announce()`) slides up under the
  docked prompt and shrinks after 3 s (not WASTED / BUSTED); in touch mode a toast dims after
  3 s. Reduced motion cuts the slides and pop-ins (the shell's reduced-motion block).
- **Flight HUD** (hud.js FLIGHT HUD, `#flightHud` in shell.html): in an aircraft the
  instruments hug the screen edges so the view stays clear: a column on the left edge
  (attitude indicator with pitch ladder and bank scale, the airspeed tape with its stall band,
  the power block with engine fill, throttle tick, flaps and gear chips), a column on the
  right edge standing on the vehicle card (the altitude tape with the ground band and a
  vertical-speed scale, then AGL, vertical speed and g), a thin heading strip with the
  objective's bearing at the top under the navigation pill, and one warning at a time under
  it (STALL, PULL UP, GEAR, STALL WARNING, ENGINE DAMAGE). The canvases are drawn at full
  size and scaled as groups by `--fh-scale` (0.78, 0.68 and 0.56 on smaller screens); they
  are redrawn every frame (`updateFlightHud`) from `flightData()` (aviation.js), and
  `#flightHud.on` fades and slides them in from the edges. The helicopter shows the slim
  version (no attitude, flaps or gear; ROTOR for power). Phones keep the tapes and heading;
  touch phones show only the warnings (the thumbs own both sides and the vehicle card reads
  speed and altitude). **Settings · Gameplay · Flight HUD** (`hudState.flightHud`, saved,
  on by default) turns the instruments off (`.instruments-off`); the warnings still flash
  when they apply, because STALL and PULL UP decide whether a landing ends in a crash. The
  docked interaction prompt sits under the heading strip in flight (`placeDockLine`).
- **Skip the ride** (ride-skip.js). A passenger can skip a ride the GTA way with `skipRide`
  (Y; remappable, listed under VEHICLES): the taxi (with a drop-off set: SKIP RIDE · $fare),
  the train (SKIP TO <station>: the destination first, `skipStop` (U) cycles through the calls
  on the way) and the Meridian Star under way (SKIP THE VOYAGE, back at her anchorage). The
  prompt is the ordinary interaction prompt (`offerPrompt` with `key: 'skipRide'`), offered
  first in `updateUI()`; the cab's also names E for STOP HERE. Refused (with a toast on the
  key) at any wanted level, during a timed job (`mission.timeLimit`), in a cab below 60%
  health or burning, and without the cab fare in cash; not offered with under 60 m to go.
  The Falcon and the Eye are never skipped. Pressing it fades `#rideSkip` (shell.html, z 15:
  over the HUD, under the menus) to black over 0.6 s with an arrival card (where, what it
  costs, the arrival clock), then at full black: the clock moves by the ride's own seconds
  at the game's rate (a game minute per second, so skipping lands at the hour riding would):
  the cab's remaining route over `TAXI_SKIP_PACE` (half of `TAXI_SPEED`, about 32 km/h,
  measured), the train's hops over its speed profile (`railHopSeconds` plus
  `RAIL_PASSENGER_CALL` at each call; within 3% of a ridden trip), the liner's remaining
  circuit over her speed caps. `catchUpWorld` steps the weather machine across the gap in
  one-second steps (weather.js `stepWeatherMachine`, the easing without lightning or sound),
  runs the scenic trains and the liner along their timetables, then the ride is put at its
  end: the cab at the drop-off kerb facing along the road (stepped back if the spot is
  taken; the full fare paid, `ride.prepaid`), the train standing at the platform
  (`transitRide.alight`: head on the station point, stopped), the liner at anchor with the
  player where they stood on deck. The camera snaps, the crowd streamer is told to settle
  (`crowd.settledAt = null`) and at least 0.8 s and six frames are drawn under the black
  before a 0.6 s fade back in; the passenger then stays aboard 0.9 s and steps off as on any
  arrival. The fade runs on `update()` time, so a pause freezes it (the pause menu draws
  over it) and death or the title menu cancels it; input other than Escape and mute is
  ignored under it and the player is invulnerable. The effects bus is ducked to 0.2
  (audio.js `setMixDuck`, a gain between `master` and the ear filter): engines, rain and
  the street dip, the radio (which now plays in a hired cab, car-radio.js `radioAboard`) and
  the callouts do not. Wanted state is never touched; `save()` runs once after the jump.
  City rail and the liner are free, so only the cab charges. Console: `skipRide()`,
  `skipStop()`, `rideSkip()`, `boardTrain(from, to)`, `setCash(dollars)`.
- **God mode** (the `godmode` cheat) unlocks every job in the mission picker
  (`missionUnlocked`, campaign.js) and opens it; a job played ahead of the story does not
  advance the campaign. The picker then also shows a time-of-day panel (`renderGodWorld`,
  campaign.js): presets (dawn 06:00, morning 09:00, noon, golden hour 19:00, dusk 20:30,
  night 23:00, 03:00), a slider over the day in five-minute steps, and the weather (AUTO
  hands the sky back to the weather machine); each applies at once through `worldMinutes`
  and `setWeather`.

## 4b. Harbor Point, the superyacht and the boats

Harbor Point marina is the basin cut into the north-west reclamation (`MARINA` in marina.js,
x 672..1528, y -4128..-3300). Four finger pontoons off the south quay carry sixteen moored
boats; `MARINA_BERTHS` lists `[finger, side, distance along, design]` and each design's `type`
picks its builder in `MARINA_BUILDERS` (marina3d.js): sloop, trawler, flybridge, launch,
explorer, dayCruiser, catamaran, sportfisher, ketch, centerConsole, megayacht, sportYacht, gulet,
racer, commuter, runabout. To add a boat, add a berth with a new design and, if needed, a
builder; names are painted on the transom automatically.

**M/Y AURELIA** (`SUPERYACHT`, marina.js) is a 67 m superyacht moored stern-to the west quay at
(970, -3950), bow east. Walk east along the quay at y -3950 onto the passerelle (or press E by
it) to board; walking back off the passerelle, or E on the swim platform, goes ashore.

- Frame: `deckLocal()`/`deckWorld()` convert between the map and the ship frame (u forward,
  v to starboard). The hull plan is `hullPlanFraction(SUPERYACHT.form, t)`, shared by the
  walkable main deck and the lofted hull.
- `levels[i]` are the walkable decks with their surface height `z`: 0 swim platform, 1 main
  deck (follows the hull inside the bulwark), 2 upper, 3 bridge, 4 sun deck, 5 helipad.
- `stairs` climb along +u from level `lo` at u0 to level `hi` at u1. Level -1 is the quay,
  so the passerelle is just another stair. You can only step onto a stair from its ends.
- `houses` are deckhouses (the main saloon is `open`: only its walls block, the aft doors
  stand open). `furniture` rows (`[level, type, u, v, length, width]`) are drawn by
  marina3d.js, block walking, and are where guests sit.
- While aboard, `player.deck = SUPERYACHT`, `player.deckLevel` and `player.deckStair` track
  the deck; `player.altitude` is the deck height, so `entityElevation()` just works.
- Cutaway: `superyachtCoverHeight()` returns the lowest deck above the player whose outline
  covers them; `updateMarinaVisuals()` hides that deck group and everything above it, and
  guests on hidden decks are flagged `hidden`.
- The liners (`LINERS`) keep their single promenade deck (`deckPointFree`, `linerDeckFree` in
  the ship's frame); their hull plan is `LINER_FORM`. Passengers keep ship-frame positions
  (`du`, `dv`, heading `da`); a few lie on the lido deck's loungers.
- **MS MERIDIAN STAR sails** (`voyage: true`). `LINER_VOYAGE` is her circuit, sailed by
  `sailLiner()` from `update()`: a `call` riding at anchor off the cruise terminal in North Sound
  (x 2150, y -5000; boarded from the water at her stern platform only while she is almost
  stopped), `astern` out of the sound, then `ahead` round the west end of Sunset Pier island,
  south down the open sea west of Palm Keys, back north inshore past Ocean Drive's strand, along
  Northbank's sea wall and into the sound again (about 35,000 units, ~13 minutes a lap). Each
  leg's control polygon is filleted with per-corner turning radii (500-900) and resampled with
  a speed cap from `LINER_SPEED_ZONES` (about 8 knots in the sound, 12-13 inshore, 19 at sea),
  the curve (`LINER_TURN_GRIP`) and a braking pass, so she accelerates and stops slowly and
  slows for turns, with a little drift and heel. She never passes under a bridge (decks are at
  road level). `carryLinerDeck` keeps passengers and the player (`player.deck`) where they stand
  on deck; `clearLinerWay` shoves boats aside (`movingLinerHulls()` is also in `boatFits`) and
  swimmers off her hull; `linerHorn` sounds the signals (one prolonged blast before weighing
  anchor, three short going astern, one short under way ahead). The renderer moves her model,
  her own lights cloud, bow waves, stern wash and a Kelvin wake ribbon laid along her track
  (`updateLinerVisuals`, marina3d.js). Console: `liners()`, `advanceLiner(seconds)`,
  `linerVoyageCheck()` (sweeps the hull down the circuit against land, bridges, jetties, ships).

**Boat kit** (boats3d.js, renderer). `loftHull(spec)` lofts a hull from a sheer line, keel line
and plan shape with bands baked into vertex colours; `hullDeck`, `hullBand`, `hullBeamAt` and
`hullEdge` fit decks, stripes and fittings to it. `deckhouse`, `deckSlab`, `prismGeometry` and
`deckOutline` build superstructure; `railing`, `lounger`, `sofa`, `pool`, `hotTub`, `stairFlight`,
`ribTender`, `radarScanner` and friends furnish it. Paint with `tint(color, finish)`: every
tinted mesh merges into one vertex-coloured material per finish in `kitMerge(group)`, so a
whole marina is a handful of draw calls (do not push kit-built groups into `batchGroups`: the
static batcher drops vertex colours). Names go through one shared atlas (`kitNameBoard`);
night lights through one `THREE.Points` cloud (`kitLight` / `kitLightCloud`).

The Ironworks freighter (`buildCargoShip`, harbor3d.js) and the drivable speedboat, launch
and jet ski (vehicles3d.js) use the same kit. Boats steer round everything in
`marinaObstacles()` (liners, moored boats, the superyacht, her tender and the pontoons).

## 4c. Roofs and rooftop helipads

rooftops.js. A helicopter can land on any flat roof that its whole airframe fits on inside
the parapet (4 units), clear of roof plant; warehouses (sawtooth skylights), the Blue Hour
terrace and Vinny's depot walls are not landable.

- `helicopterRoofSite(c)` finds that roof while the helicopter is above it;
  `helicopterControl` (physics.js) then uses the roof as its floor and keeps it in
  `c.roofSite`. Building colliders reach 22 units above the roof (so a helicopter skimming
  an edge is pushed off, as before); the contact pass skips the collider of `c.roofSite`.
- `b.roofKeepOuts` are boxes the renderer records as it draws roof plant (cityscape3d.js:
  bulkheads, water towers, AC, dishes, chimneys, skylights, pergolas, billboards, a tower's
  first setback; civic3d.js: the casino roof). `roofLandingClear` refuses to set down on
  them ("Landing blocked"). Without WebGL there are none, so every flat roof is clear.
  Towers never take a helicopter: their setback leaves a terrace too narrow for it.
- Rooftop helipads (`chooseRoofHelipads`, called at startup after the county is built): the
  Police HQ and the six largest mid-rise flat roofs at least ~1100 units apart. Each carries
  `b.helipad = {x, y, r}`; cityscape3d.js draws the pad instead of the usual clutter, the
  ground canvas (2D view, minimap) and the city map show an H.
- On the roof the player is carried by `player.buildingRoof` (the building); exitCar() steps
  out beside the helicopter, `moveBody` keeps them inside the parapet and off the plant,
  and E re-boards. `playerOnRoof()` (either roof carrier) is what "not at street level"
  checks use: police sight, shops, stations, taxis, pickups, swimming.
- `DeadEndCity.rooftops(x, y)` reports the pads, the player's roof and the helicopter's
  floor, and any roof's height, landability and plant.

## 4d. Match day: South Coast Stadium and Riverside courts

sports-fixtures.js, sports.js, sports-world.js, sports-audio.js, sports3d.js.

- **Fixtures.** `SPORTS_TEAMS` holds eleven fictional football clubs and six basketball teams
  (name, three-letter code, crest shape, kit: primary, secondary, pattern `plain` / `stripes` /
  `hoops` / `halves` / `sash` / `chevron`, shorts, socks, keeper). `sportsFixtureFor(sport, day,
  slot)` is a pure hash of the day and slot, so saves and clock jumps agree on who plays; the
  away side changes strip when the shirts clash. `SPORTS_CALENDAR`: football at 12:30 and
  20:00 (the evening match is floodlit), two 45-minute halves of 150 world seconds each (one
  world minute passes per second), 45 s half time; basketball at 10:00, 15:00 and 20:00 in
  four 45 s quarters.
- **Timeline.** Once a frame `sportsFollowSchedule` asks `sportsCurrentFixture` which fixture
  the venue shows (the one on from its warm-up until the result comes down, else the next)
  and `sportsTimeline` where the clock is: `upcoming`, `warmup`, `live` (period n), `break`,
  `fulltime`, `over`. `match.stage` is that; `match.phase` is play / restart / celebrate
  inside a live period. Teams walk out of the tunnel (`SPORTS_EXITS`) to warm up and at each
  half, and back in at the break. Joining mid-match starts with a plausible score.
- **People.** `match.people` = players + officials (referee, two assistants at the stadium) +
  stewards. They carry the pedestrian fields strikePerson()/bleed() read (`hp` 30, `threat`,
  `killedBy`, `knockedFor`...). `sportsTargets()` (the people at venues near the player,
  rebuilt each frame) is added to the bullet, knife (arsenal.js), blast (`explode`) and
  vehicle contact (physics.js) target lists. `sportsCheckHarm` notices a drop in `hp` or a
  knock-down (or gunfire, a blast or a stabbing in the venue via `crowd.incidents`) and
  `sportsAbandon`s the match: survivors run for the exits and vanish, the dead stay down, the
  stands empty, fans stream out of the turnstiles as real pedestrians fleeing through
  crowd.js (`sportsFansStampede`), and a player-caused casualty is a crime (`crime(0.35)` per
  kill, a security call after 2.5 s). `sportsAbandoned` calls off the rest of that day; the
  next day's first fixture brings a fresh match.
- **The player on the pitch.** `sportsHumanOnField` (inside `PITCH_FENCE`, on foot). Walking
  into the ball takes it (`ball.ownerId === SPORTS_HUMAN`, carried in front of the feet),
  walking into a dribbler may win it; E (`sportsInteract` from `interact()`, prompt from
  `sportsKickPrompt`) kicks along the facing: a full, lofted strike, or with Shift (walking) a softer pass along the ground. Loose-ball
  physics: friction, bounces, posts and crossbar (`sportsGoalFrame`), the net
  (`sportsHoldInNet`), boards outside play (`sportsBallBoards`), out of play during it. A goal
  is the whole ball over the line between the posts and under the bar; it counts for the side
  attacking that end. During a match the nearest three players press, tackle
  (`sportsContestHuman`), the keeper gets one save attempt (`sportsKeeperReach`), and after
  28 s on the pitch (or 5 s after a goal) two stewards come; if they reach you they walk you
  out to the plaza (`sportsEscortOff`). A goal: whistle, the whole ground's cheer, GOAL! on
  every screen, $250 for each of the first three per match.
- **Screens.** `STADIUM_SCREENS` (sports-world.js): only where a real ground has them and the
  top-down camera can read them: over the north stand facing the pitch, the display board on
  the entrance beam and a screen on each half of the south facade facing the plaza and the
  street, each leaning back a modest 0.12-0.3 rad. There are no end-stand screens (they faced
  the pitch sideways and were tilted up at the sky). Each venue paints one 1024x512 canvas
  (`paintSportsBoard`) shared by its screens, repainted only when its key changes: next match
  with crests and kickoff, warm-up, live score with clock and status, half time, result,
  MATCH ABANDONED, and an 8 fps GOAL! animation. They glow at night.
- **Stands.** One instance per seat and body part (`createStadiumCrowd`); seats have a random
  rank so the crowd fills to the fixture's attendance evenly; fans wear the colours of the
  club whose end they sit in; they stand and bounce for their club's goals and back away and
  vanish in a panic (`updateStadiumCrowd`, matrices rewritten only when the picture changes).
  Plaza flags take the clubs' colours. While a fixture is on the floodlights are painted into
  the night light map (`stadiumFloodPools`, repainted by `updateStadiumFloodlights`).
- **Sound** (sports-audio.js): the stands are silent between goals (no crowd bed, chants,
  clapping or "ooh": the old filtered-noise bed read as white noise). A goal plays the
  recorded cheer of a real football crowd (`stadium-goal-cheer`, 8 s: swell, roar, decay;
  Sandermotions, CC0) from the scoring club's end and the other end's groan
  (`stadium-goal-groan`) under it, the home crowd louder (`sportsCrowdRoar(match, strength,
  team)`); the player's goal, or a kickabout goal in front of a crowd, has the whole ground
  cheering. The level is the attendance times `stadiumAudibility()`: 1 inside the lot and on
  the forecourt, half at 280 units (about half a block) from the lot's edge, fading to
  silence between 1100 and 1700 units. Each voice follows the player while it plays (gain,
  pan, a low-pass that dulls with distance) through the ambience bus, so it is on the
  effects volume and silent while paused. Also panic screams (recorded), the referee's pea
  whistle and the kick.
- Developer console: `stadiumGoal(team, byPlayer)` scores for team 0 (home) or 1 (away) now;
  `stadiumSound()` reports the goal reactions playing, the last goal's voices with their
  distance-based gains, the player's distance and audibility, and `bed: null`.
- Developer console: `match(sport)`, `ballState()`, `matchDay(day, minutesFromKickoff, slot,
  sport)`, `fixtures(sport, days)`, `ballToPlayer(distance)`.

## 5. Missions

`missions[]` is the ordered list. Indices 0..10 are the story (story.js, harbor.js,
roofmission.js, challenges.js, aviation.js); `SIDE_JOB_FIRST` (11) onward are contracts in
sidejobs.js. In-game numbers (and the audit logs) are the index plus one:

| # | Index | Mission | Code |
| --- | --- | --- | --- |
| 1 | 0 | Dockside Favor | harbor.js, chase.js (ends in Vinny's warehouse) |
| 2 | 1 | A Seat at the Table | roofmission.js (the Blue Hour hit) |
| 3-9 | 2-8 | Vinny's Favor, Paper Trail, No Last Ferry, Both Sides of the Bay, Above the Noise, Saltwater Accounting, One Clean Exit | challenges.js |
| 10-11 | 9-10 | The Last Witness, The Manifest | aviation.js |
| C1-C5 | 11-15 | Rush Hour, Fireworks Night, Blackout, Ring Run, Repo Man | sidejobs.js |
 A mission is started by the payphone (`offerMission` -> `startMission`), which
resets state and dispatches by index. Each mission then:

1. spawns what it needs (vehicles get `mission = true`, guards get a `missionTag`),
2. advances with `setStage(stage, target, instruction, speaker?, line?)` (the target feeds the
   map marker and navigation arrow via `objective()`; a new instruction reopens the HUD
   mission card for six seconds before it folds back to one line, see `updateMissionCard`),
3. updates every frame from `missionUpdate` -> its own update function,
4. ends with `winMission()` or `failMission(reason)`.

To add a mission: push an entry onto `missions` (title, contact, reward, brief,
phoneMessage), add start/update/interact/UI branches (follow sidejobs.js), and make sure
anything you spawn is tagged so `resetMissionState`/`cleanupMissionExtras` remove it. If a
delivery must happen with zero wanted stars, add the stage to `policeBlocksMissionDelivery`.
Mission vehicles (`mission = true`) burn down to 8% and go out instead of exploding, and
take 40% of gang small-arms damage. Test a mission from the console with `startMission`,
`missionTargets`, `steerTo`, `walk`, `interact` and `simulate` (docs/DEVELOPMENT.md;
docs/audit/missions-qa.md shows the method).

## 6. Rendering notes

- On the street the camera is orthographic, looking north-down at roughly 50 degrees, so roofs
  and south-facing facades carry the look. In an aircraft or on a parachute a perspective
  camera takes over (flight-view3d.js): it keeps the aircraft framed like the street view (a
  dolly zoom from a 3 degree lens on the ground to 40 degrees by ~90 m, pitching down to 74
  degrees by ~320 m), so the ground falls away, towers show parallax and the aircraft's shadow
  drops away from it. `camera` is whichever camera is active; use `viewCenter`, `viewReach`
  and `viewZoom` (the ground footprint and its scale, `viewZoom` meaning what `worldZoom`
  means on the street) for culling and level of detail rather than `cameraTarget`/`worldZoom`.
- Distance haze is `scene.fog`, a linear Fog whose shader chunk is replaced with an
  aerial-perspective curve: clear out to `fog.near`, exponential-squared beyond it with
  `fog.far = 1 / fog.density`. Keep adjusting `fog.density` and `fog.color`; `fog.near`
  belongs to `updateFlightView` (beyond the frame on the street, where there is no haze).
  Nothing may lay a uniform wash over the frame, or over part of it.
- Clouds (clouds3d.js) are a ray-marched cumulus layer at 385-610 m over a GPU-generated
  3D noise volume, drawn at half resolution only when the flight camera is above the cloud
  base and composited behind the player's aircraft. Coverage follows `weather.cloud`, drift
  follows the wind, light follows the scene's sun, sky and ground colours. Cloud shadows on
  the city come from the same density field. Aircraft ceilings are ~900 m so the layer can
  be climbed through.
- From the air: small props move to detail layers the flight camera drops as `viewZoom`
  falls, traffic becomes instanced impostors, and below `viewZoom` 0.2 a merged far
  copy of the static scenery (flight-view3d.js, FAR SCENERY) replaces the per-building
  batches. Building blocks are compacted from six draw calls to two.
- `cityscape3d.js` builds every building: archetype (tower, office, brick, stucco,
  warehouse, deco, decoTower, hotel, skyline; stored as `b.archetype`), procedural roof texture,
  parapet, roof props (instanced, recorded as `b.roofKeepOuts`), rooftop helipads,
  shopfront with awnings and a neon, lightbox or channel-letter sign, fire escapes,
  balconies, billboards (lamp-lit boards or LED screens cycling ads), beacons and neon
  hotel scripts.
- The North Point financial cluster (`b.skyline`, planned in skyline.js) is built by
  skyline3d.js instead: each tower is a floor plan lofted through sections (height,
  scale, twist, offset), UV-mapped in world units so one glazing texture per design
  serves any size, on a podium that fills its lot (the lot is the collision rectangle;
  shafts stay inside it, crowns and spires rise above `b.height`). North Point Trust's
  roof is a landing pad. Designs: twin sail towers (Federation), stepped copper tower
  with a spire (Mercury), stacked rotated blocks (Capitals), a twisting tower
  (Evolution), a curved-facade pair (Embankment), a sail roof (Imperial), chevron twins
  with LED edges (Neva), a banded tower with a sloped crown (OKO), a tapering needle, a
  crown of gilded fins, a finned rotunda, a penthouse tower (Meridian), stepped terraces
  and a diagrid.
- Signs and night light (signage3d.js): small lights are instances of one glow quad
  (modes steady, flicker, beacon, chase, pulse, colour cycle); street-level signs add a
  pool to the night light map (`signSpill`) and a streak on the wet road. Shop, window,
  hotel and tower-name signs share one atlas pair (a day face and a glow mask) and a few
  materials, so they batch; `sign()` boards (render3d.js) glow the same way. Sign
  emissive is multiplied by `cityPower()` (lighting3d.js) in the shader, so the blackout
  contract darkens them per district.
- Sign design system (signkit3d.js, signdesigns3d.js). Every business's sign is designed
  for its trade: a FAMILY (how the sign is built) plus parameters (colours, emblem,
  lettering, board shape), listed by name in `SIGN_DESIGNS`. `sign(text, x, z, width,
  color, vertical, options)` (render3d.js), the shopfront atlas (`shopSignCell`), the
  rooftop hotel names, the tower names and the billboards all paint from it. Web fonts
  are never loaded: character comes from a hand-built monoline stroke font (capitals,
  lower case, digits) drawn as neon tubes, bulbs, block, stencil, Deco contrast or LED
  pixels, and from system font stacks with sign-painter effects (condensing, skew,
  spacing, gold/chrome fills, outlines, extrusion). Each family paints a day face and a
  glow mask and returns how the board is built: `cutout` (shaped boards, free letters),
  `backing` (`panel`, `raceway` for cut-out letters, `inset` behind shaped boards),
  `lamps` (floodlit: goose-neck lamp glows over the board and a top-lit mask),
  `marquee` (chasing bulbs), `flicker`, `light` (pavement spill colour). Masks are
  painted for one night strength (`SIGN_NIGHT`): neon cores full, lightboxes about half,
  floodlit boards a fifth, road signs barely (retroreflective).

  | Family | Night | Used for |
  | --- | --- | --- |
  | `neonScript` slanted lower-case tubes, swash, tube emblem, optional block line | neon | AFTERHOURS (cut-out script, moon), COCKTAILS (martini), SUNSET MOTEL / CORAL PALMS MOTEL (Googie boards, sunset / palm), CAFÉ MARLOW, VINYL VAULT, CUTS BARBER, FLOWERS, hotel scripts |
  | `neonBlock` capital tubes, single or double-line, zigzag or rect tube border | neon | NEON PALACE (stepped Deco board, crown), LIQUOR, PAWN SHOP, FREE FALL |
  | `bulbs` marquee-bulb letters on painted channels, bulb frame, rays | bulbs + marquee | GOLDEN TIDE (arched, dice), SUNSET PIER / DODGEMS (scalloped, bouncing letters), SUNSET EYE |
  | `cinema` bulb name on red, white changeable-letter strip, film reels | bulbs + marquee | ROYAL CINEMA |
  | `diner` chrome-ribbed pill, enamel panel, script tubes, block pill | neon | THE BLUE PLATE DINER, ROSIE’S DINER |
  | `lightbox` backlit panel in an aluminium frame, vinyl letters, bands, tabs | lightbox | hospitals (cross in a box), EMERGENCY, PALM GRILL (24 HRS tab), airports, HELIPAD, 24 HOUR, BANDSHELL, pharmacy, bail bonds, laundromat, noodle, pizza, photo |
  | `enamel` gloss porcelain enamel, two-tone rim, serif/slab, inset pill | floodlit or `backlit` | BAYVIEW TAVERN (oval, gilt), SOUTH COAST POLICE (badge), BATTERY MOTOR WORKS (piston, pill), MARINA, OUTFITTERS, CAUSEWAY INN, transit roundel, town welcome signs, bakery, deli |
  | `wood` weathered planks, routed or painted letters, rope border | floodlit | THE RUSTY ANCHOR (anchors, rope), county LODGEs, park and trail signs, SEAFOOD MARKET |
  | `stencil` bridged stencil capitals on sheet or corrugated steel, rivets, hazard stripes, rust | floodlit (warning signs reflective) | SOUTH COAST ARMORY (target, crossed pistols), PALM KEYS ARMORY, SENTINEL SURPLUS, WEAPONS · AMMO · ARMOR, IRONWORKS CARGO, MORETTI FREIGHT, RESTRICTED |
  | `deco` contrast capitals, wide tracking, rules, sunburst fan; neon or halo | neon / halo | THE BLUE HOUR, BLUE HOUR HOTEL, OCEAN DRIVE MENSWEAR (halo-lit gold), SUNSET PALACE, Deco hotel and tower names |
  | `carved` gold leaf serif on lacquer, stone or wood | floodlit | SOUTH COAST COLLEGE (crests), PAWN & LOAN, TAILOR, BOOKS, CIGARS, banks |
  | `customs` flames, pinstripes, chrome 3D italic, red neon rim | neon + lit flames | EASTSIDE CUSTOMS |
  | `airbrush` Miami sunset gradient, fat italic letters | lightbox | PALM AUTO PAINT (spray gun), VIDEO WORLD (chrome, grid) |
  | `varsity` athletic block letters, outline and drop, optional arch | floodlit or backlit | RIVERSIDE HIGH SCHOOL, SOUTH COAST STADIUM, THE FALCON, GYM |
  | `painted` wall-painted slab letters, drop shade, sun-faded | floodlit | STONECREEK GARAGE, FREIGHT CO., HARDWARE, SHOE REPAIR |
  | `hand` hand-lettered plywood | floodlit | safehouse ROOMS, THRIFT, beach kiosks, food trucks |
  | `highway` retroreflective green or brown, condensed letters, arrows | reflective | underpasses, OCEANVIEW / AIRPORT, EAGLE PASS scenic route |
  | `pixel` LED dot matrix | LEDs | ARCADE, stadium TICKETS |
  | `tattoo` flash banner, heart, red neon rim | neon | INK & IRON TATTOO |
  | `arabian` onion arch, gilt, crescent neon | floodlit + neon | ARABIAN NIGHTS, WADI SPLASH |
  | `plaque` engraved brass | floodlit | Blue Hour ELEVATOR, PRIVATE LOUNGE, RESERVED |

  To sign a new business add one line to `SIGN_DESIGNS` copying the nearest entry
  (names it does not list fall back on trade keywords in `designFor`: LODGE, OUTFITTERS,
  ARMORY, MOTEL, INN, DINER, GARAGE, HOSPITAL, BANK, CLUB, FREIGHT..., then the
  caller's `options.style` hint: `transit`, `kiosk`, `truck`, `town`, `resort`, `trail`).
  Billboards: each advertiser in `SignArt.ADS` has its own painter (layout,
  illustration, lettering); the ad atlas grows by rows as ads are added. The shop atlas
  holds one 384 x 96 cell per shop name (a chain wears one brand), about half the
  2048 x 2048 atlas.
- Night: facade materials carry an `emissiveMap` window mask; `updateCityscapeVisuals()`
  scales emissive intensity by night amount, hour and `sideJobPower()`. Lamps, shop glass,
  neon halos and vehicle head/tail halos follow the same night amount.
- Time of day: `updateCivicVisuals()` in civic3d.js blends sky, fog, sun and ambient colours
  between night, dusk and day keyframes.
- Beach (beach3d.js): the sand is its own finer canvas mesh (ripples, footprints, wrack line, damp
  and wet bands); a shader ribbon along the waterline draws the swash running up and draining off
  the sand. Beachgoers are one rig of seven InstancedMeshes posed per frame, props are instanced,
  fixed buildings are batched, and nothing animates unless the camera is near the beach.
- Water: one `ShaderMaterial` (world3d.js). The shore texture's green channel marks water near an
  open-sea beach, where the shader adds sandy turquoise shallows and rolling, broken breaker
  lines. A 512 by 512 distance-to-shore texture built from
  the land polygons drives shallow colour, foam bands and swell damping. Four Gerstner waves
  displace the mesh; noise ripples add fine normals; sun glitter and moon sparkle are
  view-dependent.
- Facades (cityscape3d.js, SHARED FACADES) are a handful of shared materials: a building's
  texture repeat is baked into its wall UVs, its tint is a vertex colour and its window
  light (strength, phase) the `cityLit` attribute, which the facade shader multiplies into
  the emissive with `cityPower()`. Building blocks are walls plus a roof cap in a shared
  roof finish; trims and other building parts use `staticMat()` (one material per finish).
  A new building part should use those, never a per-building `mat()`, or it costs a draw
  call per building.
- Glass (lighting3d.js, GLASS REFLECTIONS): `useCityGlass(material)` folds the reflection up
  into the sky and darkens it towards the street; use it for facade glass.
- Repeated props use `InstancedMesh` pools (`pools` in cityscape3d.js). Add a pool there
  rather than creating per-building meshes for small repeated objects.

## 6c. Image pipeline and lighting

- **HDR and post-processing** (postfx3d.js): the scene renders into a half-float target
  (4x MSAA on HIGH/ULTRA, with a depth texture), then SAO ambient occlusion (half resolution,
  depth-aware blur), a soft-knee bloom mip chain, and one composite pass: AO, bloom, exposure,
  the ACES filmic curve, a time-of-day grade (saturation, contrast, lift/gain), vignette and
  dither, then FXAA when there is no MSAA. `renderFrame()` replaces `renderer.render()`.
  Built-in materials output scene-linear light into the target. Custom `ShaderMaterial`s that
  compute final screen colours (the water) end with `#include <city_hdr_output>` (and include
  `<city_hdr_pars>`), which inverts the tone curve so they look as designed; unlit
  `MeshBasicMaterial`s with `toneMapped: false` (signs) get the same automatically.
- **Adaptive quality** (quality.js, ADAPTIVE QUALITY): on AUTO the frame loop feeds each
  frame's interval and CPU time to `adaptGraphics()`; GPU-bound and slow, the scene is drawn
  at a lower share of the canvas (`setRenderScale`, postfx3d.js; the composite upsamples),
  CPU-bound or still slow at 60%, one tier down. Scene shaders that need the scene buffer's
  pixel size (point sprites, screen-space lookups) must use `sceneBufferSize()`, not the
  canvas's drawing buffer.
- **Shadows** (quality.js SHADOWS): the sun (moon) shadow map is redrawn every frame whenever
  it is on; a map kept for two to four frames on the lower tiers left the shadows of the player
  and the traffic trailing behind them. Settings · Graphics · Shadows is AUTO (LOW off, MEDIUM
  low, HIGH/ULTRA high), OFF, LOW (a map of at most 2048) or HIGH (the tier's map), saved as
  `dead-end-city-shadows` and applied live (switching on/off relinks the lit shaders once).
  With shadows off, cars and people stand on soft contact blobs (lighting3d.js CONTACT
  SHADOWS, one instanced draw). The shadow box stays texel-snapped (`placeSun`).
- **Quality tiers** (quality.js) set pixel ratio, default shadows and shadow-map size, MSAA,
  AO samples, bloom levels, grading, LOD bias and rain density. `graphicsTier()` is the active
  record; the renderer's `setQuality(tier)` applies one at runtime. `DeadEndCity.graphics('high')`
  switches from the console (tests use it, since SwiftShader auto-detects as LOW).
- **Sun and sky** (lighting3d.js): `sunDirection` follows the clock (east, north-west at
  noon so shadows fall towards the camera, west at dusk; the moon at night). The shadow box is
  fitted to the camera's view each frame and texel-snapped (`placeSun`, flight-view3d.js). A
  procedural sky shader is drawn as a dome in the flight view (stars and moon at night) and
  filtered by PMREM into `scene.environment`, so glass, clear-coat car paint (MeshPhysical),
  chrome, window gloss maps and wet tarmac reflect the current sky.
- **Night light** (lighting3d.js): lamp, shop-window and neon pools are painted once into a
  city-wide light map; `cityMaterialPatch` (installed as MeshStandardMaterial's default
  `onBeforeCompile`) adds it to every lit surface near the ground, scaled by night, the
  blackout job's district power and height. A material with its own `onBeforeCompile` should
  call `cityMaterialPatch(shader)` first. A street lamp's pool is ~100 units across with a
  bright core and a long soft tail, so neighbouring lamps overlap into lit streets; it climbs
  the facades beside it (ground-facing surfaces stop catching it by ~40 units, walls ~78) and is
  tinted by district (`lampTint`: sodium in the docks and Old Quarter, cool LED in the
  financial core and Midtown, warm white elsewhere).
- **Vehicle lights** (lighting3d.js DRIVE LIGHT MAP): every lit car's low beams (~22 m, wide)
  and tail-lamp wash are drawn each night frame as instanced quads into a 1024-texel HDR map
  over the view (texel-snapped; alpha keeps the road level), and the same material patch adds
  it as light, so the road, kerbs, cars, people and walls ahead are lit through their own
  colour. The player's car keeps its real spotlight on top.
- **Night look** (lighting3d.js `NIGHT_LOOK`, civic3d.js night keyframes): a readable
  blue-hour night: stronger moonlight and cool sky fill, a brighter night sky, opened exposure,
  slightly lifted blue blacks and less contrast and saturation loss than before; lamps, neon and
  headlights stay far above that ambient. No light follows the player (the foot pool is gone;
  only a faint moonlit rim on their model's silhouette edges remains).
- **Searchlights** (searchlight3d.js): a shaft is a cone whose front faces march the view
  ray through the cone (exit solved analytically): soft radial profile with a hot core,
  denser towards the lamp, forward scattering, drifting haze noise (MEDIUM and up), a soft
  fade into the ground plane and a soft shoulder so a beam seen end-on never blows out. The
  police helicopter's pool is one real SpotLight (always in the scene, intensity 0 when idle,
  so no program changes) with a cookie map; it casts shadows on HIGH/ULTRA while sun shadows are
  HIGH (switched only on a tier or shadow setting change). Rain streaks inside its cone are lit (one GPU-animated LineSegments). The
  aim is a critically damped spring fed with the target's velocity: it lags and wobbles while
  tracking, sweeps a widening figure round the last sighting while searching, and snaps on
  with a flare when the player is found again. The Fort Sentinel watch towers use the same
  shaft with a cookie decal on the ground. Faint by day, strong at night and in rain.
- **Cutaway** (lighting3d.js, `updateCutaway`): when a building or a deck stands between the
  camera and the player (rays from their middle and head towards the camera hit its box,
  `findOccluders`), a player-sized hole is dithered through that structure alone. Also when the
  player stands strictly under a
  roof (`airCoverVolumes()`: the underpass, rail decks, station canopies; a building they are
  inside; roofs registered with `registerCutawayRoof`: Vinny's depot, bus shelters) does the
  same patch dither a small hole, about the player's size, through that roof. Only fragments
  inside the covering structure's own volume and in front of the player are cut, so vehicles,
  people, trees and props never are; with the player in plain view there is no cutaway.
  Settings · Graphics · Character see-through (`city3D.setCharacterCutaway(on)`) switches it
  live; localStorage `dead-end-city-cutaway` = `'off'` is read at start-up.
- **Street camera clearance** (flight-view3d.js): the orthographic street camera stands far
  enough back along its view line that its near plane clears the tallest roof and the
  cloud-shadow plane (`streetCeiling()`); the image is unchanged. The street view has no
  distance haze (from a camera looking down at 50 degrees it was only a pale gradient over
  the top of the frame); the flight camera's haze gathers over the first ~40 m of a climb.
- **Wakes** (wakes3d.js): boats call `wakeEmit()` each frame; trails and hull collars are
  drawn into a wake map (foam, wave crest, trough) round the view that the water shader
  samples for foam and for its normal. Spray is one `Points` object.
- **Ground detail** (surfaces3d.js): the ground shader classifies the painted colour
  (asphalt, paving, grass) and adds world-space grain, patches, cracks, slab joints, mottling,
  a bump, dielectric roughness and rain puddles (`weather.wet`). Tree leaves and palm fronds sway gently in the wind; planted greenery (hedges, planters, roof gardens such as the Blue Hour terrace) uses `stillLeafMat` and stays still.

- **Weather** (weather.js, weather3d.js, weather-audio.js): the next state is picked when a
  state starts, so an overcast spell that will turn to rain announces it over its last
  34 s (`weather.approach`): the deck thickens, the wind rises and gusts, far lightning
  rumbles and pedestrians remark on it (crowd.js). Rain, splashes, drips and road spray
  are GPU-animated from uniforms (weather3d.js); the drops, drips and splashes sample the
  city night light map so they glitter under lamps and neon. Puddles shiver in the rain
  (rings close up, a slow wobble where rings would alias); the sea gets rain rings and a
  dulled glitter. Street lamps and bridge lamps smear down wet roads (signage3d.js
  streaks). A lightning strike has a place: the flash (two to four return strokes) is
  scaled by its distance, a bolt is drawn when it is near the view, and its thunder is
  queued for distance / 1756 units per second. The rain is heard from recordings (light,
  steady and heavy beds cross-faded by `weather.rain`; weather-audio.js). Cars run wipers and headlights in the rain
  (`vehicleLampAmount`); on LOW only the player's car wipes and there is no spray or drips.
- **Night light hygiene**: the bloom bright pass sanitises NaN and half-float overflow
  before the mip chain (they used to blow up into 32-64 px black or white squares) and
  weights its taps by 1 / (1 + brightness) against fireflies; the composite does the same
  per pixel. Traffic signals are placed after the statics cull (they popped in a frame
  late). A lamp knocked flat takes its pool out of the night light map
  (`lampLightSwitch`, a region repaint), so no pool lies under a missing lamp.
- **Bridge decks** (bridges3d.js): the carriageway is one shaded surface
  (`bridgeRoadMaterial`): aggregate grain, polished tyre paths, lane seams, repair
  patches, oil drips, gutters with grates, worn paint, and in the rain darker tarmac,
  puddles in the ruts and gutters and glossy paint. Markings are drawn in the shader,
  antialiased by the pixel footprint. Footing foam is cut away where the deck covers it
  (it lies above the road, so whole rings showed through as white smears on every
  deck). Each deck has a lamp light map its road, footways and kerbs add like the city
  light map.

## 6a. Damage and destruction

Damage is data on the entity; `damage3d.js` only draws it (see the header of `damage.js`).

- `damageVehicle(vehicle, amount, x, y, source, detail)` (physics.js) takes the hit points and
  hands the rest to `recordVehicleDamage()`. `detail.kind` shapes it: `crash` (contact normal,
  closing speed, the other mass) crumples along the normal; `blast` dishes the face toward the
  explosion; `bullet` only marks the skin (`bulletHitVehicle` records the hole). No detail
  dents toward the centre as before.
- `vehicle.dents[]` are `{x, y, z, nx, ny, depth, r}` in vehicle space (x forward, y right,
  z up). Nearby dents merge, so repeated hits fold one crumple deeper. `damage.front/rear/
  left/right` stay 0..1 and drive the panels: hood (buckle, sprung, gone), bumpers (hang by one
  bracket, torn off), doors (sprung, torn off), trunk, per-pane glass (windscreen cracks, side and
  rear glass bursts), lamps, flat tyres and `damage.pull`.
- `vehicleHandling(c)` turns that into engine power, top speed, grip and steering pull for the
  player and traffic. Below 25% health the engine burns (`damage.burning`) down to the explosion;
  wrecks are gutted once (`wreckVehicle`). `repairVehicle` and `freshDamage` reset everything.
- Physics: tyre side-force is capped so hit cars slide; off-centre impulses set `spinUntil`
  (the car spins out); explosions shove, spin and bounce vehicles (`blastEffects`, `c.hop`);
  `resolveContact` records scrapes for sparks and paint scores.
- Street furniture registers itself as it is placed (`registerStreetProp(kind, x, y, yaw)` from
  cityscape3d, the lamp loop in render3d and the signals in harbor3d). Standing props are solid
  boxes for vehicles; mass times closing speed above the kind's `toughness` knocks one down
  (it stops being solid) and takes momentum off the car. They stand up again after four
  minutes out of view. Hydrants spray, benches turn their sitter out.
- Decals: one 4×4 procedural atlas; `worldDecals` (a 2400-slot ring buffer: wall chips,
  shop-glass stars and shattered panes, scorch, soot, craters, rubble, scuffs, oil, puddles)
  and `vehicleDecals` (rebuilt each frame from `damage.marks`, anchored by a ray along the
  bullet path). Shop panes are recorded on their building as `b.shopPanes`.

## 6b. Performance model

- `DeadEndCity.stats()` returns rolling CPU milliseconds for simulation and drawing, a
  per-subsystem breakdown (`parts`), renderer draw calls, triangles and a scene-object
  histogram. Use it before and after any change that touches hot loops.
- Static scenery is merged by `batchStaticGroups()` (render3d.js): every group pushed to
  `batchGroups` has its plain single-material meshes merged per material and 1024-unit
  cell after construction. Flag animated meshes (or a group holding them: a crane trolley, a
  gate arm) with `userData.dynamic = true` and per-sign textures with `userData.sign = true`
  so they are left alone. Share materials between repeated objects (palms do) or they cannot
  merge.
- Theme park rides (themepark3d.js, INSTANCED RIDE PARTS): copies of a ride model are drawn
  as instances fed from the animated groups' world matrices.
- The baked ground canvases are released once uploaded (`releaseBakedCanvases`, render3d.js);
  nothing may repaint them after start-up. Programs are compiled behind the title screen
  (`prewarmShaders`).
- `DeadEndCity.drawProfile()` lists the draw calls in view by object and by map cell;
  `stats()` reports `viewCalls` (camera) and `shadowCalls` (last shadow refresh) separately.
- Level of detail, both cameras: intact cars become instanced per-type body shells below
  `viewZoom` 0.62 and boxes below 0.4; standing pedestrians become three instanced parts
  below 0.52; the merged far city replaces the batches below 0.2 (and casts their shadows
  below 0.55).
  The tier's `lodBias` scales these. Traffic signals are merged posts plus one instanced bulb
  pool. New car and person models only cast shadows from their larger parts.
- Buildings are bucketed in `buildingGrid` (game.js) for `solid()`/`shotBlocked()`; rail
  piers in `railPierCells()`; physics statics in `staticGrid` with a per-vehicle cache.
- `landAt()` (geography.js) reads a lazily filled 16-unit cell cache: only cells a coastline
  or lake edge crosses run the polygon test (`landAtExact`). It is called for every hull
  corner of every moving car each physics step, so keep it cheap.
- The minimap's static layers (land, streets, parks, ground, building footprints) are
  painted once into an offscreen canvas (`minimapBaseLayer`); only the overlays are drawn
  each HUD refresh. Anything added to `paintMapBase()` must be static.
- Parked cars skip the post-step land check and `terrainVehiclePose()`; moored boats skip
  `boatFits()`.
- Vehicles far from the player and at rest skip contact passes; distant traffic re-plans
  at 4 Hz instead of 20 Hz; off-screen pedestrians think every fourth frame (every sixth
  beyond ~900 units); distant wildlife validates its position twice a second.
- Pedestrians are drawn by crowd3d.js from one InstancedMesh per body part (about 30 draw
  calls for the whole crowd plus shadows), not per-person models. crowd.js rebuilds a 64-unit
  neighbour grid once a frame; perception, panic spread, traffic yielding, car/pedestrian
  contacts in `updateCars`, bullet targets (`bulletTargets`), the hired cab's look-ahead
  (`forEachPedestrianNear`) and near misses query it instead of scanning every pedestrian.

## 7. Build, check, test

```
sh tools/check.sh [tag]                          # assemble + node --check (fast, run after every edit)
python3 tools/build.py --out dist/game.html      # scratch build (the release writes dead-end-city.html)
node tools/smoke.mjs dist/game.html dist/smoke   # boot, walk, drive, map; console errors + screenshots
node tools/layout-audit.mjs dist/game.html       # overlaps in the city plan
node tools/tour.mjs steps.json dist/tour dist/game.html   # scripted screenshots
node tools/dead-code.mjs dist/check/<tag>.js     # functions and bindings nothing uses
```

Headless Chromium uses SwiftShader, so the game renders at a few frames per second there;
game time is clamped per frame, which is why toasts and banners look "stuck" in screenshots.

The **developer console** `window.DeadEndCity` (game.js, after the frame loop) exposes
`status()`, `teleport(x, y)`, `setClock(hours)`, `setZoom(v)`, `startMission(index)`,
`missions()` and `god(on)`, plus test helpers such as `simulate(seconds, keys)`,
`missionTargets()`, `steerTo()`, `walk()`, `probe()`, `rooftops()` and `graphics(tier)`; the
full list is in `docs/DEVELOPMENT.md`. Test scripts use it; players can too from the
browser console. Screenshot tests call `graphics('high')` first (SwiftShader auto-detects
as LOW).

## 8. Known limitations and ideas

- The 2D fallback renderer (used when WebGL is unavailable) draws the city flat from the
  ground canvas: no roof plant, shopfronts, contract devices, beach life or superyacht
  decks. It remains playable, and with no roof plant recorded every flat roof is landable.
- Traffic AI follows the grid randomly and only pulls out round stationary vehicles; it
  never overtakes a slow one. Scripted convoys would need a waypoint follower.
- Pursuit cars follow the street grid; in the county they use the county road graph and
  have none of the city's intercept or search routing.
- The north approach to Southport clips the Broadway blocks at a flat 3 degree glide; use
  the southern approach over the water.
- The player cannot jump or climb between roofs; a building roof is left only by helicopter.
- Mission 8 ends at the Southport dock on the inlet's east shore: Rafe is a short walk
  round the head of the inlet.
- Unresolved observations from each pass are listed at the end of the logs in `docs/audit/`
  (missions-qa, systems-qa, visual-qa, world-layout).
- Ideas: radio DJ chatter between tracks, a photo mode, rooftop stunt jumps, more boarding
  points (liners from a tender).
