# World and map

geography.js (land, `BRIDGES`, `districtAt`), game-worldgen.js (`buildWorld`, `zoneHeight`,
`makeBuilding`), streets.js, county.js, terrain.js, transit.js, airfields.js, drawbridge.js,
navigation.js, sealife.js, water.js. The places themselves: places-and-venues.md.

## Layout

West to east: **Palm Keys** (tropical island, public beach) · Palm Sound · **Northbank**
(main island, Manhattan-style grid) · Marlow Bay · the **county** (Ridgeline forest and
mountains; Oceanview, Coral Coast and Fort Sentinel to the south-east). **Sunset Pier**
lies north of Northbank across North Sound; **Monarch Isle** north of the Ridgeline Range.

```
 y       x: -3100 .. -1144        40 .. 3420            ~5880 .. 11000
 -7050        .                 [SUNSET PIER isle]       [MONARCH ISLE 5460..10150,
 -4200        .                 NORTHBANK (reclamation)    y -5272..-468]
    50   PALM KEYS  <-Palm Sound->  NORTHBANK  <-Marlow Bay->  RIDGELINE (forest, peaks)
  5300   PALM KEYS BEACH            Battery Park               .
  6200+       .                     OCEANVIEW / CORAL COAST / FORT SENTINEL
```

## Frames

- World box `WORLD_LEFT..WORLD_SIZE` × `WORLD_TOP..WORLD_SIZE` (-5120..11264 × -8192..11264).
- City frame `CITY_LEFT..CITY_RIGHT` × `CITY_TOP..CITY_SIZE` (-3584..3712 × -4224..5632) is
  what the baked ground textures, the night light map and the street grid cover. Anything
  past `CITY_SIZE` in x or y is county. Ground outside the frame comes in tiles
  (`countyGroundTiles`: county tiles, Sunset Pier's `PARK_TILE`, Monarch's, runway piers).
- `onPalmKeys(x)` (x < `PALM_SOUND_X`) is how code asks "is this the Keys".
  `offCityStreets(x, y)` keeps city-grid logic (police routing) off Monarch Isle.

## Northbank grid

- Avenue columns at `128 + i*512` (`ROAD_CENTERS`), street rows at `128 + j*512`
  (`ROAD_ROWS`; the northern reclamation has negative y). Streets 88 wide; the 112-wide
  avenues are `WIDE_COLUMNS` / `WIDE_ROWS`: ask `wideColumn(x)` / `wideRow(y)` (one list
  could not tell column -1408 from row -1408). Blocks are 334 units square.
- `BLOCK_COLUMNS` builds Northbank first so its seeded buildings never change, then Palm
  Keys: **adding blocks must not reorder the seeded random stream.**
- Streets are clipped to land, the airport, park closures, the stadium, the beach and
  reserved plots (`cityStreets()`); a bridge deck counts as ground. The x = 128 column is
  the Shore Line rail corridor (`RAIL_CORRIDOR_X`), not a street.
- Districts come from `districtAt()`; zoning in `zoneHeight()`; the renderer picks facades
  from the same district names (`archetypeFor`). Street names: `STREET_NAMES`.
- Reserved plots (`inReservedPlot`) keep streets and blocks off e.g. `BEACH_CLUB_PLOT`.

## Water, shores and bridges

- Shoreline rule (water.js `shoreStepBlocked`, called by `moveBody`): on foot the sea is
  entered **only from a beach**; quays, docks, the pier and bridges are walls. Swimmers
  climb out at beaches, rocks or ladders (`ladderList()`, each marked by a lifebuoy).
- `BRIDGES` lists every road bridge as a straight deck `a → b` at road level with a `style`.
  `bridgeStructure(bridge)` lays out the design in the bridge's frame from `BRIDGE_DESIGNS`:
  navigation `channels`, `footings` in the water, `solids` on the deck (anything over the
  carriageway starts at `BRIDGE_CLEARANCE`, 46). One structure feeds everything: boats steer
  round `bridgeFootings()`, aircraft collide with `bridgePylons()`, bridges3d.js draws it,
  roadblocks cut the city end, the route graph joins it to the streets.
- Eleven bridges (Keys, Palm Sound Causeway, East Bay, South Bay, Sunset Pier, Oceanview,
  Coral Sound, Ridgeline Viaduct, Sentinel, Sovereign, Regency): `DeadEndCity.layout().bridges`
  has ids, styles, towers and footings. Rail bridges belong to the viaducts (transit.js).
- **The Palm Sound drawbridge** (drawbridge.js, drawbridge3d.js): a working double-leaf
  bascule with 44 m leaves on `bridgeStructure(bridge).bascule`. Openings at
  `DRAWBRIDGE_OPENINGS` for the brigantine ALBATROSS; phases warning → gates → clearing →
  unlock → raising → open → lowering → seating → idle, on game seconds. Contracts:
  `drawbridgeTrafficLimit` (traffic stops at the line), `drawbridgeKeepsOff` (only the
  player's vehicle may be on an unseated span), `drawbridgeFootBlocked`, `drawbridgeSurface(u)`
  (road height and slope; null over the gap, which is water), leaves as ramps
  (`drawbridgeSlopeDrive`, `drawbridgeFlight`, `drawbridgeSettle`), GPS delay
  (`drawbridgeRouteDelay`; the graph is built as if the bridge were down). The pits reach below
  the sea: a depth-only mask keeps the water plane out (renderOrder -2). Console:
  `drawbridge(...)`, `drawbridgeLook(spot)`, `drawbridgeTraffic(n)`.

## Streets, county, terrain, rail, airfields

- County (county.js): its own roads (`COUNTY_ROADS`, also GPS and police routing), towns and
  scenery. Ridgeline's three towns are planned by mountain-village.js.
- **Ridgeline Range** (terrain.js, drawn by county3d.js): one generated, eroded height field
  (deterministic, typed arrays, built on first use), flattened under roads, rail, towns and
  helipads, with two switchback 4x4 trails (`TRAIL_MAX_GRADE` 0.28). `terrainHeight` samples
  the exact Float32 vertices the renderer draws, so contact and picture agree. Console
  `terrain()`.
- Railway (transit.js, transit3d.js): SHORE LINE (Cruise Terminal → west sea wall → Southport
  Airport), COAST LINE (→ Oceanview → Palmshore), RIDGE LINE (→ Eastgate, Northridge,
  Stonecreek). Each `route` is a control polygon filleted by `railTrackGeometry`; everything
  else reads `line.points`.
- Airfields (airfields.js, airfields3d.js): SOUTHPORT 18/36 (460 m, courier strip on a
  reclaimed pier) and OCEANVIEW 09/27 (1,280 m, jets and the airliner, running out to sea on
  `oceanview-pier`); Fort Sentinel's strip is for helicopters. Runway piers are
  `LAND_REGIONS`. Console `airfields()`.
- Parks (renewal.js `CENTRAL_PARK`, `COMMONS`; streets inside closed by `parkStreetClosed`).
  South Coast Stadium is enclosed: see places-and-venues.md.

## Sea life (sealife.js, sealife-audio.js, sealife3d.js)

- `seaDistance(x, y)` (64-unit chamfer field, built a slice a frame) drives everything;
  `seaNoGo` keeps animals out of marinas and berths; `seaSteer` turns toward open water.
- Dolphin pods, gull flocks (`GULL_FLOCKS`, perches) and one great white. The shark
  encounter (`sharkEncounter`) only builds while the player swims > 30 m out, outside the buoy
  line, not in a mission, with an 8-minute cooldown; beach swimmers are never taken.
- Drawing: one InstancedMesh per species animated in the vertex shader; what is under the
  surface goes into a life map the water shader samples. Console: `sealife()`,
  `sharkAttack(stage)`, `spawnDolphins(...)`.

## Navigation and layout data

- navigation.js: road graph, A* routes, waypoints, map gestures, the minimap GPS
  (`updateGpsRoute`). `DeadEndCity.route(x, y)` reports a route and the bridges it uses.
- `DeadEndCity.layout()` returns the whole plan as data (coast, streets, rail, buildings,
  helipads, docks, ships, props, static colliders, bridges, reserved plots).
  `node tools/layout-audit.mjs <html>` checks it for overlaps (28-39 oblique-junction notes
  are expected); `docs/audit/world-layout.md` explains the audit.
- The minimap base layer is painted once (`minimapBaseLayer`); anything added to
  `paintMapBase()` must be static.
