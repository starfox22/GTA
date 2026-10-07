# Places: Monarch Isle, the county and the big venues

Same rules as places-and-venues.md (Palm Keys, Sunset Pier, Harbor Point, North Point Key,
roofs, garages): the plan is a game file, the meshes its `*3d.js` twin, coordinates in code.

## Monarch Isle (monarch-*.js, monarch-life.js, monarch*3d.js)

- The rich island on a 100 m grid (`ISLE_COLS`, `ISLE_ROWS`, 800-unit blocks); two
  roundabouts (anticlockwise), the Sovereign (harp cable-stayed) and Regency (bowstring)
  bridges pushed onto `BRIDGES`, roads into `COUNTY_ROADS`. Built by `buildMonarchIsle`
  from buildWorld **after** the real-height pass.
- Villas (`planVilla`, nine styles), 27 businesses (`MONARCH_BUSINESSES`, each with a sign
  design), Monarch Harbour, the Royal Botanic Garden.
- **One tower**, MONARCH ONE (monarch-one.js, monarch-one3d.js), on the north-east point:
  the camera looks north, so keep nothing of interest north of its x-span. THE SOVEREIGN
  is a `reserve` entry of `MONARCH_TOWER_DESIGNS` (not built). Old sites: Sovereign Square
  and Regent Court (`planIsleSquare`).
- `MONARCH_ONE` grounds: the west wall runs out along the groyne (the public beach cannot
  reach the cove); the gate arm is vehicle-only (extra entry of `monarchSolids()`, body
  `minHeight` while up; it lifts for the player's car at a crawl, traffic has no lane in);
  jetty `MONARCH_ONE_JETTY` is in `onIslePontoon`; staff posts carry `lines`.
- Life runs on its own lane graph (`isleRoadGraph`, `isleTrafficControl` called from the
  physics for cars with `c.isle`) and pavement walk graph that crosses only at zebras.
  The REGENCY BRIDGE link runs on up the mainland's Regency Road; its cars turn round
  `ISLE_END_TRIM` short of the road's end (which lies on Eagle Pass's centreline, in a
  bend), yielding to anything ahead or across. Console `regencyTraffic()`. The CORONATION
  BRIDGE link (a drawbridge, world-and-map-drawbridges.md) runs from the Westgate / Ocean
  Crescent corner over to Sunset Pier and turns round on Pier Island Drive by the car park;
  island cars stop at its stop lines (`drawbridgeTrafficLimit` in `isleTrafficControl`).
- Night: its own lamp light map over `MONARCH_BOUNDS`. Console `monarch()`.

## Ridgeline: villages, 4x4 club, hill climb (mountain-village*.js, offroad*.js, mountain-club3d.js)

- Towns are planned per block from a mountain kit (`MOUNTAIN_KINDS`,
  `MOUNTAIN_TOWN_PLANS`), with snow only well up the mountain. Console `mountainTowns()`.
- RIDGELINE 4X4 CLUB: seven club trucks (`OFFROAD_TYPES`, real size), trail mud baked per
  vertex (`offroadTrailBake`), traction on the range in `offroadDrive` (called by the
  physics: surface μ × load × driven share), the hill climb (`trailCourse`, best times in
  `dead-end-city-hillclimb`).
- MOUNT ASCENT course (512 m, 93 → 762): forest two-track, THE BOG, the CREEK CROSSING ford
  (real water: drag, wash, spray), the east-bank hairpin, THE TRAVERSE (off-camber), the MUDDY
  HAIRPIN, bermed keyhole switchbacks, the ROCK GARDEN (0.3 m rock relief the tyres climb,
  drawn exactly), SLICKROCK (0.36, sandstone), the SUMMIT RIDGE onto a rounded summit. Marker
  posts, cairns, logs, edge grass (world-county-and-sea-terrain.md, Trail dressing). Four
  checkpoints; target 1:15 (the trail pilot's clean run is about 69 s at 1/30 and 1/60).

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
