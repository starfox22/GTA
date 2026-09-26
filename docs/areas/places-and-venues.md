# Places and venues

Islands and set pieces, each planned by a game file and drawn by its `*3d.js` twin. The
coordinates are in the code (grep the constant); this doc keeps the rules.

## Palm Keys, the beach and Marea (beach.js, beachclub*.js, clubpool.js, clubtalk.js, beachvolley.js)

- Palm Keys was mirrored east-west when it moved west; each block kept its contents (the
  Blue Hour, the Golden Tide casino, Vinny's depot…). Shores: sand on the public beach and
  the west strand, quay on the bay side.
- Palm Keys Beach (`BEACH`, geography.js) is the south strand with a boardwalk and a fishing
  pier; beach.js places furniture along the waterline with `shoreAt(s, d)`.
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

## Monarch Isle (monarch-*.js, monarch-life.js, monarch*3d.js)

- The rich island on a 100 m grid (`ISLE_COLS`, `ISLE_ROWS`, 800-unit blocks); two
  roundabouts (anticlockwise), the Sovereign (harp cable-stayed) and Regency (bowstring)
  bridges pushed onto `BRIDGES`, roads into `COUNTY_ROADS`. Built by `buildMonarchIsle`
  from buildWorld **after** the real-height pass.
- Villas (`planVilla`, nine styles), two towers, 27 businesses (`MONARCH_BUSINESSES`, each
  with a sign design), Monarch Harbour, the Royal Botanic Garden.
- Life runs on its own lane graph (`isleRoadGraph`, `isleTrafficControl` called from the
  physics for cars with `c.isle`) and pavement walk graph that crosses only at zebras.
- Night: its own lamp light map over `MONARCH_BOUNDS`. Console `monarch()`.

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
- Ironworks cargo terminal and mission 1's loading bay: harbor.js.

## Roofs and helipads (rooftops.js)

- A helicopter lands on any flat roof its airframe fits inside the parapet, clear of roof
  plant: `b.roofKeepOuts` are recorded by the **renderer** as it draws plant, so without
  WebGL every flat roof is clear. Towers and warehouses never take one.
- `c.roofSite` is the roof under a landed helicopter (the contact pass skips its collider);
  the player on it is carried by `player.buildingRoof`; `playerOnRoof()` answers "not at
  street level" for police sight, shops, stations, taxis.
- Rooftop helipads (`chooseRoofHelipads`, `b.helipad`). Console `rooftops(x, y)`.

## Ridgeline: villages, 4x4 club, hill climb (mountain-village*.js, offroad*.js, mountain-club3d.js)

- Towns are planned per block from a mountain kit (`MOUNTAIN_KINDS`,
  `MOUNTAIN_TOWN_PLANS`), with snow only well up the mountain. Console `mountainTowns()`.
- RIDGELINE 4X4 CLUB: seven club trucks (`OFFROAD_TYPES`, real size), trail mud baked per
  vertex (`offroadTrailBake`), traction on the range in `offroadDrive` (called by the
  physics: surface μ × load × driven share), the hill climb (`trailCourse`, best times in
  `dead-end-city-hillclimb`).

## Fort Sentinel, the Apache, the tank (military.js, apache.js, armor.js, base3d-*.js)

- The base plan `SENTINEL`: gate with drop arms, anti-ram bollards and a sliding gate (arms
  and bollards stop vehicles only). Trespass or attack raises the alarm: lockdown, sentries,
  QRF jeeps, and the wanted level held while near. E at the gate forces it for a moment.
- The AH-64 (`airframe: 'apache'`, `HELICOPTER_AIRFRAMES`) is only ever flown by the
  player; stealing it is like taking a tank plus maximum heat. Console `military()`,
  `apache()`.

## South Coast Stadium and GOALLINE (sports-*.js, sports3d.js, sportsbook*.js)

- Fixtures are a pure hash of day and slot (`sportsFixtureFor`), so saves and clock jumps
  agree. `sportsTimeline` gives the stage (upcoming, warmup, live, break, fulltime, over).
- Enclosure: `STADIUM_ENCLOSURE` blocks everyone, `STADIUM_VEHICLE_BARRIERS` vehicles only;
  the turnstiles are the only way in. Match people carry pedestrian fields and are added to
  every target list via `sportsTargets()`; any harm abandons the match (`sportsAbandon`).
- The player can take the ball and score (E kicks); stewards walk you off.
- Club `rating`s (0.78 to 1.3) drive `sportsFinishChance(fixture, team)` = 0.16 × ((rating ×
  1.1 at home) / other's rating)^1.6; a shot on target that fails it is saved
  (`sportsKeeperSave`). Measured over 350 matches in a headless harness (sports files stepped
  at 30 Hz): goals per side are Poisson at 7.4 shots on target × the finishing chance, about
  2.8 goals a match. The sportsbook prices from the same numbers.
- GOALLINE betting shop: Poisson pricing from the same model (`sportsbookFairMarkets`,
  margin by the power method, odds ladder), bets tied to the match object, settled
  automatically, void on abandon or reload past kick-off. `gameMode` stays `play` while the
  menu is open. Console `sportsbook()`, `stadiumGoal(team)`, `match()`, `matchDay(...)`.

## MONARCH MOTORS and the Prestige Collection (dealership*.js, hypercars*.js)

- In every build, the demo included. `DEALER` is the plan (hall, panes, slots, stage);
  `PRESTIGE_TYPES` are eleven hypercars at real size (`modelScale` 1, `prestige`).
- Buying opens gameMode `'dealer'`, then a delivery reveal. Owned cars are saved in
  `dead-end-city-garage`, flagged `owned` (never a crime to enter) and brought back to the
  owners' bays. The alarm (`dealershipAlarm`) sets four stars at once, shutters and guards
  (faction `prestige`). Console `dealership()`, `dealerBuy`, `dealerAlarm`, `dealerCalm`.

## Garages, casino, bike share

- Respray garages (garages.js, garage3d.js): `GARAGE_PLAN`, price list `garageOffer`; a
  respray clears the stars only if no unit saw you drive in. Console `garage()`.
- Casino roulette: casino.js. Bike share: ui-and-settings.md.
