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
  terrain and aircraft. Aircraft `altitude` is absolute; `aircraftClearance()` subtracts terrain.
- Timers are seconds. Physics runs in fixed 1/120 s steps. `worldMinutes` advances one game
  minute per real second; `daylight()` returns 0..1 (sun up 05:40, down 19:50).
- Save data (`localStorage`) holds campaign indices, cash, clock, weapons and audio settings
  only. Adding missions needs no schema change.

## 3. Subsystem map

Game closure (in include order):

| File | Role |
| --- | --- |
| game.js | Constants, vehicle definitions, world build (`buildWorld`, `zoneHeight`, `makeBuilding`), `populate`, combat, `update`, 2D fallback drawing, map, HUD, input, startup, `window.DeadEndCity` developer console |
| audio.js | Web Audio effects, voices, procedural sounds; `earFilter` (a low-pass over the whole mix, dulled while swimming) |
| physics.js | Vehicle and pedestrian physics, traffic AI, signals, knockdowns |
| geography.js | Land polygons, river, bridges, `districtAt`, coast segments, 2D water, `BEACH` (strand, boardwalk, pier) |
| water.js | Swimming, wading and sinking. `shoreStepBlocked` (called by `moveBody`) is the shoreline rule: on foot you enter the sea only from a beach; quays, docks, the pier and bridges are walls; out again at beaches, rocks or the `ladderList()` ladders. Also `exitIntoWater` (out of a flooding car), `diveOverboard` (J in a boat), `parachuteSplashdown`, harbor-patrol rescue |
| water-audio.js | Procedural water sound: splashes, strokes, gasps, wading, ladder rungs, flooding cars and bubbles; the surf, lapping and crowd loops; gulls and the lifeguard whistle (`updateWaterAudio`, called from `soundUpdate`) |
| beach.js | Southport Beach: the furniture plan (`BEACH_LAYOUT`, placed along the waterline by `shoreAt(s, d)`), the cast of `beachgoers` with time-of-day density, volleyball and frisbee games, panic (`beachHearsViolence` from `notifyViolence`), kiosk colliders |
| harbor.js / chase.js | Ironworks terminal, first mission, cargo pursuit, Vinny's depot (front shutter, back door and the drop: `beginDepotDrop`, `depotShutterDown`, `updateDepotDrop`) |
| police-feedback.js | Wanted-level status chips (NEED TO LOSE POLICE, POLICE CLEARED) and delivery blocking |
| roadblocks.js | Police containment: bridge and avenue cuts of braced cruisers plus loose cones. `roadblockHolds()` (called from `resolveContact`) lets a heavy vehicle with enough momentum shove a cruiser loose; lighter cars just stop |
| arsenal.js | Weapon ownership, arsenal UI, knife |
| citylife.js | Clock, `PLACES` (businesses), officers, police routing, `daylight()` |
| story.js | Characters, `STORY` missions, dialogue, `setStage`, `startMission`, `winMission`, `failMission`, `missionUpdate` |
| campaign.js | Saves, mission select menu |
| roofmission.js | Blue Hour rooftop hit, `entityElevation` |
| air-cover.js / combat-rules.js | Underpass volumes, elevation-aware shooting, air support |
| county.js / military.js / terrain.js | Outlying regions, towns, Fort Sentinel, mountains |
| aviation.js / parachute.js | Fixed-wing flight model, flight missions 9 and 10, bail-out |
| challenges.js | Missions 2 to 8 and the interact/UI routing for all missions |
| sidejobs.js | Contracts 11 to 15 (`SIDE_JOB_FIRST` onward) and `sideJobPower` (blackout) |
| streets.js | Street grid, painting, `STREET_NAMES`, `streetNameAt`, `benchSpots` |
| casino.js, renewal.js, sports.js, sports-world.js, transit.js, ecology.js | Casino, parks, sports venues, railway, wildlife |
| navigation.js, mobile.js, world-view.js, car-radio.js, garages.js | Route planning, touch, zoom, radio, garages |
| render3d.js | Renderer entry: lights, ground texture painting, vehicle/person models, effects, `render()` |

Renderer fragments (inside `createCityRenderer()`): cityscape3d (buildings, roofs, shopfronts,
street furniture, night windows), sidejobs3d (rings/devices), garage3d, landmarks3d, civic3d
(time-of-day palette, businesses), air-cover3d, renewal3d, sports3d, transit3d, ecology3d,
world3d (water shader, palms, airport, rooftop bar), beach3d (Southport Beach sand, swash, pier, props, ladders, instanced beachgoers; `updateBeachVisuals` from `updateWorldVisuals`), county3d, harbor3d (signals, depot,
helicopter searchlight), helicopter3d, vehicles3d, plane3d.

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
  else the edge is a wall. Swimmers climb out at beaches, rocky shores and 58 ladders (every
  ~420 units of quay, the end of each dock, the pier head), each marked by a lifebuoy post; no
  city water is more than ~670 units from a way out.
- Street names are in `STREET_NAMES` (streets.js) and shown in the HUD under the district.
- The county (Ridgeline, Oceanview, Coral Coast, Fort Sentinel) is defined in county.js with its
  own roads, towns, bridges and an airport.
- The railway (transit.js, drawn by transit3d.js) runs on its own elevated right of way:
  - SHORE LINE: Cruise Terminal (1580, -4170) -> sea viaduct round Harbor Point -> the west sea
    wall at x 150 with Reclamation, Old Quarter and West Quay stations -> a curve across Viaduct
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

## 5. Missions

`missions[]` is the ordered list. Indices 0..10 are the story (story.js, harbor.js,
roofmission.js, challenges.js, aviation.js); `SIDE_JOB_FIRST` (11) onward are contracts in
sidejobs.js. A mission is started by the payphone (`offerMission` -> `startMission`), which
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

## 6. Rendering notes

- The camera is orthographic, looking north-down at roughly 40 degrees, so roofs and
  south-facing facades carry the look. `cityscape3d.js` builds every building: archetype
  (tower, office, brick, stucco, warehouse, deco, decoTower, hotel), procedural roof texture,
  parapet, roof props (instanced), shopfront with awnings and a sign atlas, fire escapes,
  balconies, billboards, helipads, beacons and neon hotel signs.
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

## 6b. Performance model

- `DeadEndCity.stats()` returns rolling CPU milliseconds for simulation and drawing, a
  per-subsystem breakdown (`parts`), renderer draw calls, triangles and a scene-object
  histogram. Use it before and after any change that touches hot loops.
- Static scenery is merged by `batchStaticGroups()` (render3d.js): every group pushed to
  `batchGroups` has its plain single-material meshes merged per material and 1024-unit
  cell after construction. Flag animated meshes with `userData.dynamic = true` and per-sign
  textures with `userData.sign = true` so they are left alone.
- Buildings are bucketed in `buildingGrid` (game.js) for `solid()`/`shotBlocked()`; rail
  piers in `railPierCells()`; physics statics in `staticGrid` with a per-vehicle cache.
- Vehicles far from the player and at rest skip contact passes; distant traffic re-plans
  at 4 Hz instead of 20 Hz; off-screen pedestrians think every third frame; distant wildlife
  validates its position twice a second.

## 7. Build, check, test

```
sh tools/check.sh [tag]                 # assemble + node --check (fast, run after every edit)
python3 tools/build.py                  # write dead-end-city.html
node tools/smoke.mjs dead-end-city.html dist/smoke   # boot, walk, drive, map; console errors + screenshots
```

Headless Chromium uses SwiftShader, so the game renders at a few frames per second there;
game time is clamped per frame, which is why toasts and banners look "stuck" in screenshots.

The **developer console** `window.DeadEndCity` (game.js, after the frame loop) exposes
`status()`, `teleport(x, y)`, `setClock(hours)`, `setZoom(v)`, `startMission(index)`,
`missions()` and `god(on)`, plus test helpers such as `simulate(seconds, keys)`,
`missionState()` and `skipToDepotDelivery()`; the full list is in `docs/DEVELOPMENT.md`.
Test scripts use it; players can too from the browser console.

## 8. Known limitations and ideas

- The 2D fallback renderer (used when WebGL is unavailable) does not draw the new roof props,
  shopfronts or contract devices; it remains playable.
- Traffic AI follows the grid randomly; scripted convoys would need a waypoint follower.
- Audit notes with unresolved observations are in `docs/audit/`.
- Ideas: weather (rain with wet-road reflections in the shader), radio DJ chatter between
  tracks, pedestrian taxi hailing, a photo mode using the orthographic camera.
