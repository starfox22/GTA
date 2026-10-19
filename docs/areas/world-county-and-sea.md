# World: county, terrain, rail, airfields and sea life

The land beyond the Northbank grid and what lives in the water. Coordinates, frames, the
grid, navigation and layout data: world-and-map.md; shores and bridges: world-and-map-shores.md.

## County, terrain, scenic roads, rail, airfields

- County (county.js): its own roads (`COUNTY_ROADS`, also GPS and police routing), towns and
  scenery. Ridgeline's three towns are planned by mountain-village.js.
- **Ridgeline terrain** (the height field, the 4x4 trails and their grading, the ride on the
  terrain, the scenic roads): world-county-and-sea-terrain.md.
- `prunePlanTrees` (end of `buildCounty`) drops plan trees on carriageways, in buildings, under
  rail decks, on runways, in doorways or where they could hide a vehicle on a 4x4 trail
  (`trailTreeClear`, world-county-and-sea-terrain.md) (`treeAudit()`).
- Falls (falls.js): on foot, ground dropping away steeper than 1.35 (54°) under a step starts
  a ballistic fall (`player.fall`, a carrier; `settleFootOnGround` replaced the plain terrain
  snap); faces over 45° cannot be landed on (the body slides down, scraping) and where it
  stops the whole height counts. One impact scale (`fallInjury`, falls-body.js): under 6 m a
  stumble, 6-17 m 8-100 hp, beyond dead (a splat: face down, blood pool); water safe to
  20 m/s, fatal from 30. Slopes up to the tumble (terrain-field.js) are unchanged. Console
  group `falls` (`cliffSpot`, `fallTest`, `fallState`, `bailOut`, `parachuteState`,
  `parachuteFallTo`).
- Jump on foot (player-jump.js, the `jump` action, Space): crouch 0.1 s, a 0.5 m hop of
  0.64 s carrying the run, landing 0.2 s through `playerImpact(..., 'jump')`; `player.jump` is
  a carrier and sets `player.jumpUntil` for the air time (the on-the-ground rules read that).
  What it clears is data, not geometry: a solid's `height` (foot furniture `jumpH`, props
  `JUMP_PROP_HEIGHT`) below the soles (`playerJumpClearance()`, up to 1.05 m) is skipped through
  `solidSkipBelow`, only in the jumping player's own step (`footSolid`); a heighted solid under
  `SOLID_LOW_MIN` (3 units) marks water and never clears. A new low wall or bench joins by
  carrying its height there; a new restricted area keeps its blocker out of it (Fort
  Sentinel, the theme park and the Marea club are). Landing lower than the take-off is a fall.
  A running jump (>= 15 km/h) whose first blocker ahead is 1.05-1.5 m is a vault
  (`jumpVaultAhead`): clearance held at `JUMP_VAULT_MAX` over the flight, so timing does not
  decide it (villa walls 1.35 m and railings 1.41 m, `villaWallHeight` mirrors what
  monarch-villas3d.js draws; the quays' sea railing `PROMENADE_RAIL_HEIGHT` 1.49 m; hedges,
  1.5 m square railings, court and street-end fences stay solid). In the air the shoreline
  rule lets him off land or a dock into the sea (never a bridge or the pier); the fall carries
  `fall.jumped`, which `updateSwimming` waits for, and ends swimming (`fallIntoWater`).
  Console `jumpReport()`, `jumpObstacles()`; tools/tests/player-jump.mjs.
- Parachutes, staged main deployment, cutaway/reserve controls, rig animation and forecasts:
  [vehicles-and-driving-parachute.md](vehicles-and-driving-parachute.md).
- Ships' decks (deck-landing.js): `deckSurfaceAt()` (topmost deck: a liner's promenade deck or
  deckhouse roof, the yacht's highest level) is part of `parachuteFloor`, and
  `deckLandingStep()` runs in updateParachute before the ground: an open canopy on a free spot
  stands the player there (`player.deck`, carried); the impact is the descent plus the speed
  across the deck, relative to the moving ship, past `DECK_RUNOUT` (riderInjury 'tumble'); a
  blocked spot settles within 30 units or glides to a lower deck (else off her side);
  freefall is an impact on the deck. A boat has no deck: down beside her, swimming (E boards);
  fixed hulls set the jumper clear. Console group `decks`: `deckLanding`, `deckJump`, `canopyOver`.
- Railway (transit.js, transit3d.js): SHORE LINE (Cruise Terminal → west sea wall → Southport
  Airport), COAST LINE (→ Oceanview → Palmshore), RIDGE LINE (→ Eastgate, Northridge,
  Stonecreek). Each `route` is a control polygon filleted by `railTrackGeometry`; everything
  else reads `line.points`.
- Airfields, nose-out parking, terminal architecture, apron paint and elevated airport
  structure contracts: [world-county-and-sea-airports.md](world-county-and-sea-airports.md).
- Parks (renewal.js `CENTRAL_PARK`, `COMMONS`; streets inside closed by `parkStreetClosed`).
  South Coast Stadium is enclosed: see places-monarch-and-county.md.

## Sea life (sealife.js, sealife-audio.js, sealife3d.js)

- `seaDistance(x, y)` (64-unit chamfer field, built a slice a frame) drives everything;
  `seaNoGo` keeps animals out of marinas and berths; `seaSteer` turns toward open water.
- Dolphin pods, gull flocks (`GULL_FLOCKS`, perches) and one great white. The shark
  encounter (`sharkEncounter`) only builds while the player swims > 30 m out, outside the buoy
  line, not in a mission, with an 8-minute cooldown; beach swimmers are never taken.
- Drawing: one InstancedMesh per species animated in the vertex shader; what is under the
  surface goes into a life map the water shader samples. Console: `sealife()`,
  `sharkAttack(stage)`, `spawnDolphins(...)`.

## Roadside boards (county-guide-signs.js, county3d-signs.js)

- No board stands on or across a carriageway. `COUNTY_GUIDE_SIGNS` (EAGLE PASS, OCEANVIEW /
  AIRPORT, CORAL COAST), the SCENIC VIEW lay-by signs, the town name boards and the
  trailhead boards are drawn by `roadsideSign()`: a 4-9 m board on two posts, bottom edge 2 m
  up, at the spot `signSpot()` finds clear of every road by `SIGN_VERGE` (12 units; the
  nearest clear ground within 60, else the board is left out: NEEDLE RIDGE's trailhead
  is on a junction). A `sign()` alone floats at 5 m with no posts and faces south: never
  call it for scenery in open country. Console `guideSigns()` lists every board with
  `onAsphalt` and `clearance`; test road-signs.mjs keeps them off the road.
