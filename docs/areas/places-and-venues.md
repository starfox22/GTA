# Places: the city waterfront and islands

Islands and set pieces, each planned by a game file and drawn by its `*3d.js` twin. The
coordinates are in the code (grep the constant); this doc keeps the rules. Monarch Isle,
MONARCH MOTORS, Ridgeline, Fort Sentinel and the stadium: places-monarch-and-county.md.

## Palm Keys, the beach and Marea (beach.js, beachclub*.js, clubpool.js, clubtalk.js, beachvolley.js)

- Palm Keys was mirrored east-west when it moved west; each block kept its contents (the
  Blue Hour, the Golden Tide casino, Vinny's depot…). Shores: sand on the public beach and
  the west strand, quay on the bay side.
- Palm Keys Beach (`BEACH`, geography.js) is the south strand with a boardwalk and a fishing
  pier; beach-plan.js places furniture along the waterline with `shoreAt(s, d)`.
- **Marea Beach Club** stands on the reserved `BEACH_CLUB_PLOT`; its plan is in plot-local
  u/v (`mareaPoint`). Schedule (`mareaPhase`): beach club by day, sunset sessions, nightclub
  with queue, bouncers, $40 cover and a $250 VIP band. The camera looks north, so anything
  tall hides what stands north of it: keep the street side low.
- The pool (`player.pool` carrier), 41 scripted conversations (`CLUB_TALKS`, auto-start next
  to someone), beach volleyball (`volleyCourtPlan`, a physics ball solved per touch so the AI
  can read it). leisure.js owns the action key and prompt for all three.

## Sunset Pier (themepark*.js, themepark3d.js, unicorn3d.js)

- `PIER` holds every position. The Falcon coaster is authored as eased track elements
  (`COASTER_ELEMENTS`) walked into a banked closed curve (`coasterCircuit()`,
  `coasterFrame(s)`); the train runs on gravity. The Sunset Eye wheel (`wheelCapsule(k)`),
  fountain and fireworks schedules, the log flume, the Aurora unicorn statue (sculpted from
  the three.js example horse by `tools/unicorn_model.py` → `assets/unicorn-horse.json`).
- Riding either ride makes `player.coaster` the carrier; the ride camera
  (`updateParkCamera`) is called from render3d.js after `updateFlightView`.
- Riders' voices are cued from the circuit each frame (fall speed, g, inversions);
  `coasterVoices()` logs them. Collision: `parkSolids()` (people and vehicles) and
  `parkAirSolids()` (aircraft). Guests exist only within ~1.9 km. Console `themePark()`.

## Harbor Point, the superyacht and liners (marina.js, marina3d.js, harbor*.js)

- Marina berths: `MARINA_BERTHS` [finger, side, distance, design]; each design's `type` picks
  a builder in `MARINA_BUILDERS`. To add a boat add a berth (and a builder if needed).
- **M/Y AURELIA** (`SUPERYACHT`): `deckLocal()`/`deckWorld()` convert frames; `levels[i]`
  are walkable decks with height `z`, `stairs` join them (level -1 is the quay, so the
  passerelle is a stair). Aboard, `player.deck`, `deckLevel`, `deckStair`; `player.altitude`
  is the deck height so `entityElevation()` just works. Decks above the player are hidden
  (`superyachtCoverHeight`).
- **MS MERIDIAN STAR** sails `LINER_VOYAGE` (~13 min a lap; speed zones, turning radii);
  `carryLinerDeck` keeps passengers in place; she never passes under a bridge. Console
  `liners()`, `advanceLiner(s)`, `linerVoyageCheck()`.
- Ironworks cargo terminal and mission 1's loading bay: harbor.js (the bay and the depot
  drop: harbor-cargo-job.js).

## North Point Key (skyline*.js, geography-key.js, skyline3d-islet/crowns/bar.js)

- The only towers left of the old North Point cluster, in a row on the islet's north sea
  wall (nothing walkable behind them; the camera looks north): MERCURY, FEDERATION EAST
  (helideck, parked helicopter), EVOLUTION (CIRRUS sky bar). The other 15 keep
  `reserve: true` in `SKYLINE_TOWERS`. East of `CITY_RIGHT`: own ground tile, own lights.
- Reached by the -3456 street over its `key` bridge; the grid street stops at the circle
  (`northPointKeyStreetClip`): GPS ends there, traffic never turns in.
- Lifts (skyline-lift.js): E at a lobby door (on foot, not wanted) or a roof door; gameMode
  `'elevator'` during the fade, `teleportPlayer()` in the dark, then the roof carrier.
- CIRRUS people are pedestrians with `keyPerson` (state `'key'`: never recruited or
  streamed), spawned within ~900 units; one table talks at a time, only while the player
  is up there. Console `skyline()`, `skylineVisit(spot)`.

## Roofs and helipads (rooftops.js)

- A helicopter lands on any flat roof its airframe fits inside the parapet, clear of roof
  plant: `b.roofKeepOuts` are recorded by the **renderer** as it draws plant, so without
  WebGL every flat roof is clear. Towers and warehouses never take one.
- A roof deck (`b.roofDeck`: discs, boxes, a polygon) replaces the lot as the walkable and
  landable roof, round the game's own `b.deckKeepOuts`; `b.noLanding` keeps aircraft off.
- `c.roofSite` is the roof under a landed helicopter (the contact pass skips its collider);
  the player on it is carried by `player.buildingRoof`; `playerOnRoof()` answers "not at
  street level" for police sight, shops, stations, taxis.
- Rooftop helipads (`chooseRoofHelipads`, `b.helipad`). Console `rooftops(x, y)`.

## Garages, casino, bike share

- Respray garages (garages*.js, garage3d-*.js): price list `garageOffer`; a respray clears
  the stars only if no unit saw you drive in. One on every island (`GARAGE_ISLANDS`, test
  garages-islands.mjs): a new landmass needs one. Doors face south onto an east-west street
  (`roadY`); `slab`/`forecourt` for shops off the city canvas, `style` in
  garage3d-styles.js; planting keeps off via `garageKeepOut`. Console `garage()`.
- Casino roulette: casino.js. Bike share: ui-and-settings.md.
