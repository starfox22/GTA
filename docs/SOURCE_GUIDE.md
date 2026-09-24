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

- Map coordinates are `(x, y)` in world units. **512 units = 100 m.** `WORLD_SIZE` is 11264,
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
  `staticBodies` (`addStatic`, looked up through the numeric-keyed `staticGrid`).
- Timers are seconds. Physics runs in fixed 1/120 s steps. `worldMinutes` advances one game
  minute per real second; `daylight()` returns 0..1 (sun up 05:40, down 19:50).
- Save data (`localStorage`, key `dead-end-city-v1`) holds campaign indices, cash, clock and
  weapons; the radio, touch mode, FPS counter and graphics tier have their own keys. Adding
  missions needs no schema change.

## 3. Subsystem map

Every file below starts with `// BEGIN SUBSYSTEM: src/<file> — <title>` and a doc comment;
the same list, with one-line summaries, is the SUBSYSTEM INDEX at the top of
`src/shell.html`. Order matters only for top-level `const`/`let` used while the closure
is being set up (function declarations are hoisted).

Game closure (in include order; `src/main.js` wraps it, `src/game.js` includes the rest):

| File | Role |
| --- | --- |
| game.js | Constants, `VEHICLE_DEFINITIONS`, world build (`buildWorld`, `zoneHeight`, `makeBuilding`), `populate`, combat, `update`, `moveBody`, `exitCar`/`enterVehicle`, `teleportPlayer`, 2D fallback drawing, map (`paintMapBase`), HUD, input, startup, `window.DeadEndCity` |
| audio.js | Web Audio effects, voices, procedural sounds; `earFilter` (a low-pass over the whole mix, dulled while swimming) |
| physics.js | Vehicle physics in 1/120 s steps, `addStatic`/`staticGrid`, `resolveContact`, traffic AI (`trafficControl`), `helicopterControl`, `boatControl`, `safeLanding`, `damageVehicle`, knockdowns |
| geography.js | Land polygons and the cached `landAt`, river, bridges, `districtAt`, coast segments and `shoreStyle`, 2D water, `BEACH` (strand, boardwalk, pier) |
| harbor.js | Ironworks terminal, mission 1 loading, gates and guards, the harbor exit |
| police-feedback.js | Wanted-level chips (NEED TO LOSE POLICE, POLICE CLEARED: only on a real drop, timed on the wall clock) and `policeBlocksMissionDelivery` |
| arsenal.js | Ownership-driven equipment, mystery weapon cards, icon inventory and knife combat |
| citylife.js | Clock, `PLACES` (businesses), `DOCKS` (boat jetties and their boats), officers, police routing and sight (`policeSees`), wanted search, `clearPolice`, `daylight()` |
| story.js | Characters, `STORY` missions, dialogue, `setStage`, `startMission`, `winMission`, `failMission`, `missionUpdate`, `updateMissionCard` |
| campaign.js | Save schema, progression frontier, ammunition persistence and mission selection |
| chase.js | Mission 1 cargo pursuit (`notifyCargoPolice`, `evadeCargoPolice` for the respray), Vinny's depot (front shutter, back door, `beginDepotDrop`, `clearDepotFloor`) |
| roadblocks.js | Police containment: bridge and avenue cuts of braced cruisers plus loose cones. `roadblockHolds()` (called from `resolveContact`) lets a heavy vehicle with enough momentum shove a cruiser loose; lighter cars just stop |
| carjack.js | Occupied traffic, locked doors, the ejection throw and what drivers do next |
| themepark.js | Sunset Pier island layout, ride footprints, the rideable coaster and the park crowd |
| marina.js | Harbor Point marina, hull-form math, the boardable superyacht's deck plan (`SUPERYACHT`, `deckLocal`/`deckWorld`), liners, deck walking (`moveOnDeck`) |
| taxi.js | Hailing, destination picking on the map, the ride itself and the hijack |
| cycles.js | Bike-share stands, racked bicycles, hold-W pedalling and the rider's legs |
| weather.js | Weather state machine, road wetness, wind and rain on the audio bus |
| water.js | Swimming, wading and sinking. `shoreStepBlocked` (called by `moveBody`) is the shoreline rule: on foot you enter the sea only from a beach; quays, docks, the pier and bridges are walls; out again at beaches, rocks or the `ladderList()` ladders. Also `exitIntoWater` (out of a flooding car), `diveOverboard` (J), `parachuteSplashdown`, harbor-patrol rescue |
| water-audio.js | Procedural splashes, strokes, wading, ladders, flooding cars, surf, lapping, gulls, lifeguard whistle |
| beach.js | Southport Beach: the furniture plan (`BEACH_LAYOUT`, placed along the waterline by `shoreAt(s, d)`), `beachgoers` with time-of-day density, volleyball and frisbee, panic (`beachHearsViolence` from `notifyViolence`), kiosk colliders |
| roofmission.js | The Blue Hour terrace (`ROOFTOP`, `player.roof`, `moveOnRoof`), mission 2's hit (index 1); `entityElevation`, `sameFloor` |
| rooftops.js | Helicopter landings on flat roofs (`helicopterRoofSite`, `roofLandingClear`), rooftop helipads (`chooseRoofHelipads`, `b.helipad`), the `player.buildingRoof` carrier (`exitOntoRoof`, `moveOnBuildingRoof`), `playerOnRoof()` |
| air-cover.js | Railway, platform and underpass volumes for sight, bullets, vehicles and aircraft |
| combat-rules.js | Elevation-aware shots, vehicle handgun rules, tank armor and single-helicopter pursuit |
| damage.js | Vehicle damage model (crumple dents, panels, glass, lamps, tyres, engine fire, handling loss), bullet holes and wall/glass/ground strikes, blast shove, breakable street furniture (`registerStreetProp`, `streetPropContacts`), the damage console helpers |
| county.js | County roads, towns, buildings, scenery, traffic, regional police and bridges |
| military.js | Fort Sentinel security, military vehicles, barriers and combat |
| aviation.js | Fixed-wing flight model (`planeControl`), flight missions 10 and 11 (indices 9 and 10), Daniel the witness (`followWitness`, `witnessStep`) |
| challenges.js | Missions 3 to 9 (indices 2 to 8) and the interact/UI routing for all missions (`challengeMissionInteract`) |
| sidejobs.js | The five contracts (indices 11 to 15, from `SIDE_JOB_FIRST`) and `sideJobPower` (blackout) |
| streets.js | Street grid (`cityStreets`, `cityStreetAt`), painting, `STREET_NAMES`, `streetNameAt`, `benchSpots`, the esplanade |
| terrain.js | Triangulated mountains, snow caps, trails, slope handling and off-road contact |
| casino.js | Roulette layout, stakes, settlement, UI and saved cash |
| renewal.js | Parks (`CENTRAL_PARK`, `COMMONS`), ponds (`parkPondBlocked`, `parkPondNear`), boardwalks, walkers, joggers, the outdoor gym |
| sports.js | Live basketball and soccer: teams, possession, shots, scoring, restarts |
| sports-world.js | South Coast Stadium reservation, enclosure, turnstiles, vehicle barriers, markings |
| transit.js | Railway: `RAIL_LINES` routes filleted by `railTrackGeometry`, `RAIL_STATIONS`, `railDecks`, boarding (`openTransit`, `boardTransit`), `leaveTransit`, scenic trains |
| ecology.js | Habitats, harmless animals, bear warning/attack and 2D drawing |
| navigation.js | Road graph, shortest paths, waypoints, map gestures and route guidance |
| parachute.js | `aircraftClearance`, bail-out (`bailOut`), freefall, canopy, the Blue Hour terrace landing, water rescue |
| mobile.js | Independent movement/aim fingers, context actions and overlay cleanup |
| world-view.js | World zoom, pinch gestures, mouse wheel and camera limits |
| car-radio.js | Three embedded tracks, station selection, playback and saved settings |
| garages.js | Repair bays, vehicle fit, paint, repairs and pursuit clearance |
| crowd.js | Pedestrian life: `dressPerson`, the crowd streamer (`streamCrowd`), sidewalk walking, perception and reactions (`crowdAlarm`, `decideReaction`, `updateReaction`), bodies, near misses, hands up, witness calls (`crowdReport`), crash drivers and horns (`crowdCrash`, `updateTrafficLife`), taxi fares and bus stops (`curbsideStop`), street scenes, the neighbour grid (`forEachPedestrianNear`) |
| ambience.js | Procedural traffic hum, crowd murmur, wind, birds, crickets, horns, sirens, club beat, busker |
| quality.js | Graphics quality tiers (LOW/MEDIUM/HIGH/ULTRA), GPU capability check, the saved setting and its pause-menu button (`graphicsTier()`) |
| render3d.js | Renderer entry: street camera, lights, ground texture, lamps, static batching (`batchStaticGroups`), person/vehicle models, effects, `render()` |

Renderer closure (inside `createCityRenderer()` in render3d.js, in include order;
flight-view3d, postfx3d and lighting3d come first, right after the cameras and lights,
and helicopter3d, vehicles3d and plane3d last, before `makeVehicle`):

| File | Role |
| --- | --- |
| flight-view3d.js | Perspective flight camera, ground footprint, distance haze, shadow fit, LOD, impostors, far city |
| postfx3d.js | Half-float scene target, MSAA, SAO ambient occlusion, bloom, ACES tone curve, grade, FXAA |
| lighting3d.js | Sun path (`sunDirection`), sky dome and environment map, night light map, `cityMaterialPatch`, the dithered cutaway (`updateCutaway`), headlight cones, time-of-day look |
| damage3d.js | Deformable car shells, per-pane glass, pooled decal atlas, rubble and panels, props, smoke and fire |
| cityscape3d.js | Buildings: facade archetypes (`archetypeFor`), roof textures and plant (recorded as `b.roofKeepOuts`), rooftop helipads, shopfronts and sign atlas, fire escapes, balconies, lit windows, instanced street furniture (`pools`) |
| sidejobs3d.js | Sky rings, bomb and substation devices |
| roadblocks3d.js | Loose traffic cones and burning flares |
| themepark3d.js | Coaster track and train, big wheel, carousel, teacups, drop tower and midway |
| garage3d.js | Garage buildings, shutters, lights and service details |
| landmarks3d.js | Bridges, waterfront gardens, civic precinct and ground helipads |
| civic3d.js | Businesses, the casino, hospital and school fronts, time-of-day palette |
| air-cover3d.js | Road underpass walls, roof, portals and lamps |
| renewal3d.js | Benches, fountains, courts, pergolas, pond bridge, boathouse and bicycle racks |
| sports3d.js | Tiered stands, crowd, floodlights, scoreboards and animated matches |
| transit3d.js | Swept viaduct, sleepers, masts, piers and bents, stations and moving trains |
| ecology3d.js | Species geometry, gait animation, culling and material cleanup |
| world3d.js | Shore-aware water shader, palms, airports, rooftop bar, waterfront scenery |
| wakes3d.js | Boat wakes (Kelvin V, propeller wash, hull collar) drawn into a wake map the water shader samples; bow spray and rooster tails |
| beach3d.js | Sand, swash ribbon, pier, props, ladders and instanced beachgoers |
| county3d.js | County ground tiles and hills, snow, rural scenery, bridges and region visibility |
| boats3d.js | Hull lofting, deckhouses, railings, deck furniture, name boards, night lights, mesh merging |
| harbor3d.js | Cranes, the container ship, containers, depot, signals and helicopter searchlight |
| marina3d.js | Pontoons, sixteen unique yachts, the superyacht deck by deck, terminal and liners |
| cycles3d.js | Bike-share racks (the bicycles are ordinary vehicles) |
| weather3d.js | Rain, wet roads, lightning and the overcast light |
| crowd3d.js | One InstancedMesh per body part, layered poses, stride, dogs and scene props |
| clouds3d.js | Ray-marched cumulus at 600-950 m over a 3D noise volume, and their shadows on the city |
| surfaces3d.js | Ground shader detail (asphalt, paving, grass), rain puddles, county ground, foliage sway |
| helicopter3d.js | Airframe, rotor, lights and cockpit |
| vehicles3d.js | Road vehicles, bicycles, boats (speedboat, launch, jet ski), riders and moving parts |
| plane3d.js | Courier prop plane, business jet and airliner |

`src/asset-loader.js` sits outside the closure: it decodes the media blocks and calls
`startDeadEndCity(ASSETS)`.

## 4. The city layout

- Northbank Island (west) is the street grid: avenue columns at `128 + i*512` (`ROAD_CENTERS`)
  and street rows at `128 + j*512` from y -3968 to 5248 (`ROAD_ROWS`; the northern reclamation
  has negative y). Streets are 88 wide; 1152, 2688, 3200, 4736 and the reclamation rows -1408
  and -2944 are 112-wide avenues with double yellow centre lines. Blocks are 334 units square.
  Streets are clipped to land, the airport, park closures, the stadium and the beach
  (`cityStreets()` in streets.js).
- The west shore is one straight reclaimed sea wall (x 40..52). The strip between it and the
  first blocks (x 217) carries the esplanade on the sea side and the Shore Line viaduct above
  the old West Quay alignment (`RAIL_CORRIDOR_X`, no longer a street). Rows run under the
  viaduct to the esplanade.
- Marlow Bay (the river, x 3420..3960) separates Northbank from Palm Keys (east). Bridges at
  y = 1152 (Union St), 3200 (Harbor Ave) and 4736 (Stadium Way), all starting on Riverbank Dr
  (`bridgeSpan`).
- Districts, from `districtAt()`: Harbor Point Marina, the Reclamation and North Point Financial
  (north), Old Quarter and Ironworks Docks, Midtown, Broadway and the Exchange District, South
  Bank, Battery Point, Southport Airport and Southport Beach (south); Palm Keys Art Deco, Ocean
  Drive, Little Havana and Coral Marina (east). Zoning lives in `zoneHeight()` (heights) and the
  block patterns in `buildWorld()`; the renderer picks facade/roof archetypes from the same
  district names in `archetypeFor()`.
- Southport Beach (`BEACH` in geography.js) is the public strand on the south shore, x 1740..3125,
  from the Marina Rd kerb (y 5306) down to a smooth curved waterline (`smoothShoreline`, y
  5430..5806); its top edge is a 40-wide boardwalk (`BEACH.boardwalk`) and a timber fishing pier
  (`BEACH.pier`, part of `groundAt`) runs out from the lower sand at x 2700. No streets or blocks
  are laid on it, the esplanade stops at either end, and its shore reads as 'beach'. Nothing
  crosses the sand: the Oceanview Causeway leaves from the south end of Riverbank Dr (x 3200)
  past the beach's east end and lands on Oceanview's east avenue at Beach Road (3200, 7010).
  beach.js places the kiosks, bar, lifeguard towers, umbrellas, towels, court, buoys and people
  on it; beach3d.js draws them.
- Water access (water.js): on foot the sea can be entered only across a beach shore; everywhere
  else the edge is a wall. Swimmers climb out at beaches, rocky shores and 54 ladders (every
  ~420 units of quay, dock ends and the pier head, each only where a swimmer can reach the
  foot head-on), each marked by a lifebuoy post; no coastal water is more than ~650 units
  from a way out. The superyacht's passerelle counts as dry ground for the shoreline rule.
- Street names are in `STREET_NAMES` (streets.js) and shown in the HUD under the district.
- The county (Ridgeline, Oceanview, Coral Coast, Fort Sentinel) is defined in county.js with its
  own roads, towns, bridges and an airport.
- The railway (transit.js, drawn by transit3d.js) runs on its own elevated right of way:
  - SHORE LINE: Cruise Terminal (2480, -3968, on the apron street in front of the terminal) ->
    an el down Garden St (x 2176) and west along the avenue at y -2944, with Harbor Point station
    (1408, -2944) south of the marina; it never crosses the basin's mouth -> the west sea wall at
    x 150 with Reclamation, Old Quarter and West Quay stations -> a curve across Viaduct
    Green onto Harbor Ave (Broadway station, 860, 3200) -> Royal Ave -> Southport Airport
    (1220, 4890), over the terminal forecourt on Airport Way. The avenue legs are an el on
    straddle bents planted on the pavements.
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
- `DeadEndCity.layout()` returns the whole plan as data (coast, streets, rail, buildings,
  helipads, docks, ships, props, static colliders); `docs/audit/world-layout.md` describes the
  overlap audit run on it.

## 4b. Harbor Point, the superyacht and the boats

Harbor Point marina is the basin cut into the north-west reclamation (`MARINA` in marina.js,
x 672..1528, y -4128..-3300). Four finger pontoons off the south quay carry sixteen moored
boats; `MARINA_BERTHS` lists `[finger, side, distance along, design]` and each design's `type`
picks its builder in `MARINA_BUILDERS` (marina3d.js): sloop, trawler, flybridge, launch,
explorer, dayCruiser, catamaran, sportfisher, ketch, centerConsole, megayacht, sportYacht, gulet,
racer, commuter, runabout. To add a boat, add a berth with a new design and, if needed, a
builder; names are painted on the transom automatically.

**M/Y AURELIA** (`SUPERYACHT`, marina.js) is a 105 m superyacht moored stern-to the west quay at
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
- The liners (`LINERS`) keep their single promenade deck (`deckPointFree`); their hull plan is
  `LINER_FORM`.

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
  dolly zoom from a 3 degree lens on the ground to 40 degrees by ~140 m, pitching down to 74
  degrees by ~500 m), so the ground falls away, towers show parallax and the aircraft's shadow
  drops away from it. `camera` is whichever camera is active; use `viewCenter`, `viewReach`
  and `viewZoom` (the ground footprint and its scale, `viewZoom` meaning what `worldZoom`
  means on the street) for culling and level of detail rather than `cameraTarget`/`worldZoom`.
- Distance haze is `scene.fog`, a linear Fog whose shader chunk is replaced with an
  aerial-perspective curve: clear out to `fog.near`, exponential-squared beyond it with
  `fog.far = 1 / fog.density`. Keep adjusting `fog.density` and `fog.color`; `fog.near`
  belongs to `updateFlightView` (beyond the frame on the street, where there is no haze).
  Nothing may lay a uniform wash over the frame, or over part of it.
- Clouds (clouds3d.js) are a ray-marched cumulus layer at 600-950 m over a GPU-generated
  3D noise volume, drawn at half resolution only when the flight camera is above the cloud
  base and composited behind the player's aircraft. Coverage follows `weather.cloud`, drift
  follows the wind, light follows the scene's sun, sky and ground colours. Cloud shadows on
  the city come from the same density field. Aircraft ceilings are ~1400 m so the layer can
  be climbed through.
- From the air: small props move to detail layers the flight camera drops as `viewZoom`
  falls, traffic becomes instanced impostors, and below `viewZoom` 0.2 a merged far
  copy of the static scenery (flight-view3d.js, FAR SCENERY) replaces the per-building
  batches. Building blocks are compacted from six draw calls to two.
- `cityscape3d.js` builds every building: archetype (tower, office, brick, stucco,
  warehouse, deco, decoTower, hotel; stored as `b.archetype`), procedural roof texture,
  parapet, roof props (instanced, recorded as `b.roofKeepOuts`), rooftop helipads,
  shopfront with awnings and a sign atlas, fire escapes, balconies, billboards, beacons and
  neon hotel signs.
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
- **Quality tiers** (quality.js) set pixel ratio, shadow-map size and refresh cadence, MSAA,
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
  call `cityMaterialPatch(shader)` first. Traffic headlights are instanced ground cones.
- **Cutaway** (lighting3d.js, `updateCutaway`): only when the player stands strictly under a
  roof (`airCoverVolumes()`: the underpass, rail decks, station canopies; a building they are
  inside; roofs registered with `registerCutawayRoof`: Vinny's depot, bus shelters) does the
  same patch dither a small hole, about the player's size, through that roof. Only fragments
  inside the covering structure's own volume and in front of the player are cut, so vehicles,
  people, trees and props never are; in the open there is no cutaway. `city3D.
  setCharacterCutaway(on)` switches it; localStorage `dead-end-city-cutaway` = `'off'` is
  read at start-up.
- **Street camera clearance** (flight-view3d.js): the orthographic street camera stands far
  enough back along its view line that its near plane clears the tallest roof and the
  cloud-shadow plane (`streetCeiling()`); the image is unchanged. The street view has no
  distance haze (from a camera looking down at 50 degrees it was only a pale gradient over
  the top of the frame); the flight camera's haze gathers over the first ~60 m of a climb.
- **Wakes** (wakes3d.js): boats call `wakeEmit()` each frame; trails and hull collars are
  drawn into a wake map (foam, wave crest, trough) round the view that the water shader
  samples for foam and for its normal. Spray is one `Points` object.
- **Ground detail** (surfaces3d.js): the ground shader classifies the painted colour
  (asphalt, paving, grass) and adds world-space grain, patches, cracks, slab joints, mottling,
  a bump, dielectric roughness and rain puddles (`weather.wet`). Tree leaves and palm fronds sway gently in the wind; planted greenery (hedges, planters, roof gardens such as the Blue Hour terrace) uses `stillLeafMat` and stays still.

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
- There is no arrest: the police shoot at any wanted level; death respawns at the hospital.
- The north approach to Southport clips the Broadway blocks at a flat 3 degree glide; use
  the southern approach over the water.
- The player cannot jump or climb between roofs; a building roof is left only by helicopter.
- Mission 8 ends at the Southport dock on the inlet's east shore: Rafe is a short walk
  round the head of the inlet.
- Unresolved observations from each pass are listed at the end of the logs in `docs/audit/`
  (missions-qa, systems-qa, visual-qa, world-layout).
- Ideas: radio DJ chatter between tracks, a photo mode, rooftop stunt jumps, more boarding
  points (liners from a tender), an arrest mechanic.
