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
  extents), `vz`, `inv` (invulnerability seconds), `vest` (an NPC's body armor, in the
  same units as `player.armor`).
- All bullet, blast, melee and impact damage goes through `ballisticDamage()` in
  combat-rules.js. Call `strikePerson(person, damage, a, source, showBlood, kind)` and
  `hurt(damage, kind)` with the right `kind` rather than scaling damage at the call site.
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
| audio.js | Web Audio effects, voices, procedural sounds |
| physics.js | Vehicle and pedestrian physics, traffic AI, signals, knockdowns |
| geography.js | Land polygons, river, bridges, `districtAt`, coast segments, 2D water |
| harbor.js / chase.js | Ironworks terminal, first mission, cargo pursuit, Vinny's depot and its shutters |
| roadblocks.js | Chokepoints, blockade planning, spike strips, `clearRoadblocks` |
| carjack.js | Occupied traffic, locked doors, driver ejection and reactions |
| themepark.js | Sunset Pier layout, ride solids, the rideable looping coaster, park crowd |
| marina.js | Harbor Point basin, cruise terminal, the two liners and their walkable decks |
| taxi.js | Hailing a cab, picking a drop-off on the map, the ride, the hijack |
| cycles.js | Bike-share stands and the rider's stamina |
| weather.js | Weather state machine, road wetness, wind, rain audio |
| water.js | Swimming, breath, and vehicles that flood and sink |
| police-feedback.js | Wanted-level banners and delivery blocking |
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
street furniture, night windows), sidejobs3d (rings/devices), roadblocks3d (barriers, spikes,
flares), themepark3d (coaster, wheel, carousel), garage3d, landmarks3d, civic3d
(time-of-day palette, businesses), air-cover3d, renewal3d, sports3d, transit3d, ecology3d,
world3d (water shader, palms, airport, rooftop bar), county3d, harbor3d (signals, depot,
helicopter searchlight), helicopter3d, vehicles3d, plane3d.

## 4. The city layout

- Northbank Island (west) is an 11 by 11 grid: road centres at `128 + i*512` on both axes.
  Streets are 88 wide; the avenues at 1152, 2688, 3200 and 4736 are 112 wide with double
  yellow centre lines. Blocks are 334 units square with a parking court or courtyard inside.
- Marlow Bay (the river, x 3420..3960) separates Northbank from Palm Keys (east). Bridges at
  y = 1152 (Union St), 3200 (Harbor Ave) and 4736 (Stadium Way).
- Districts, from `districtAt()`: Old Quarter and Ironworks Docks (north), Central Garden and
  Midtown, Broadway and Financial District (centre), South Bank, Battery Point and Southport
  Airport (south); Palm Keys Art Deco, Ocean Drive, Little Havana and Coral Marina (east);
  Sunset Pier on its own island in the lower bay.
  Zoning lives in `zoneHeight()` (heights) and the block patterns in `buildWorld()`; the
  renderer picks facade/roof archetypes from the same district names in `archetypeFor()`.
  The coastline in `LAND_REGIONS` runs outside every block of the grid, so all eighty land
  blocks build.
- Street names are in `STREET_NAMES` (streets.js) and shown in the HUD under the district.
- The county (Ridgeline, Oceanview, Coral Coast, Fort Sentinel) is defined in county.js with its
  own roads, towns, bridges, an airport and a railway (transit.js).
- The northern reclamation is the land at negative y. `ROAD_CENTERS` is the column list
  (unchanged, 128..5248) and `ROAD_ROWS` the row list (-3968..5248); `blockX`/`blockY` turn a
  block index into a coordinate and block indices keep their pre-reclamation meaning, so
  `by` 0 is still y 128 and the new blocks carry negative indices. Anything that walks the
  grid must pick the list that matches its axis -- `roadNear` for columns, `rowNear` for
  rows. `CITY_TOP` and `WORLD_TOP` are the northern bounds of the built city and the world.
- Harbor Point (marina.js) is the basin cut into the north-west shore; `marinaBlocked` keeps
  the water and the hulls solid while leaving the pontoons walkable. `LINERS` are oriented
  boxes whose usable half-beam tapers fore and aft: `deckLocal`/`deckWorld` move between the
  ship's frame and the map, and while `player.deck` is set `moveOnDeck` constrains the player
  inside `deckPointFree`.
- Central Garden (renewal.js `CENTRAL_PARK`, `COMMONS`) is two blocks square at
  x 2265..3111, y 1800..2600. Garden Ave (x 2688) and Linden St (y 2176) run inside it and are
  closed by `parkStreetClosed`. No rail crosses it -- the network is a perimeter system that
  runs the shoreline and the bay. The outdoor gym stations come from `gymStations()`;
  `updateGymGoer` runs the regulars and the food-truck staff.
- Sunset Pier (themepark.js `PIER`, `COASTER_TRACK`) is a land region of its own reached by
  the `SUNSET PIER CAUSEWAY` county bridge off the Stadium Way crossing. `updateCoaster`
  carries the player along the track; `parkBlocked` keeps the rides solid.
- Police containment lives in roadblocks.js: `roadblockSites()` is the chokepoint catalogue,
  `planPoliceContainment` picks one ahead of and out of sight of the runner, and
  `updateRoadblocks` runs the spike strips. `clearPolice()` tears them all down.
- South Coast Stadium (sports-world.js) is enclosed: `STADIUM_ENCLOSURE` blocks people and
  vehicles, `STADIUM_VEHICLE_BARRIERS` (bollards, turnstile span) block vehicles only, and the
  two turnstile gates at x 2665..2686 and 2692..2713 (y 4845) are the only way onto the concourse.

## 5. Missions

`missions[]` is the ordered list. Indices 0..10 are the story (story.js, harbor.js,
roofmission.js, challenges.js, aviation.js); `SIDE_JOB_FIRST` (11) onward are contracts in
sidejobs.js. A mission is started by the payphone (`offerMission` -> `startMission`), which
resets state and dispatches by index. Each mission then:

1. spawns what it needs (vehicles get `mission = true`, guards get a `missionTag`),
2. advances with `setStage(stage, target, instruction, speaker?, line?)` (the target feeds the
   map marker and navigation arrow via `objective()`),
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
- Water: one `ShaderMaterial` (world3d.js). A 512 by 512 distance-to-shore texture built from
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
`missions()`, `god(on)`, `wanted(stars)` and `roadblocks()`. Test scripts use it; players
can too from the browser console.

## 8. Known limitations and ideas

- The 2D fallback renderer (used when WebGL is unavailable) does not draw the new roof props,
  shopfronts or contract devices; it remains playable.
- Traffic AI follows the grid randomly; scripted convoys would need a waypoint follower.
- Audit notes with unresolved observations are in `docs/audit/`.
- Ideas: weather (rain with wet-road reflections in the shader), radio DJ chatter between
  tracks, pedestrian taxi hailing, a photo mode using the orthographic camera.
