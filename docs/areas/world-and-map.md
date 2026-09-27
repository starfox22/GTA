# World and map

geography.js (land, `BRIDGES`, `districtAt`), game-worldgen.js (`buildWorld`, `zoneHeight`,
`makeBuilding`), streets.js, county.js, terrain.js, transit.js, airfields.js, drawbridge.js,
navigation.js, sealife.js, water.js. The county, terrain, scenic roads, falls, rail,
airfields, parks and sea life: world-county-and-sea.md. The places themselves:
places-and-venues.md and places-monarch-and-county.md.

## Layout

West to east: **Palm Keys** (tropical island, public beach) · Palm Sound · **Northbank**
(main island, Manhattan-style grid) · Marlow Bay · the **county** (Ridgeline forest and
mountains; Oceanview, Coral Coast and Fort Sentinel to the south-east). **Sunset Pier**
lies north of Northbank across North Sound; **Monarch Isle** north of the Ridgeline Range.

```
 y       x: -3100 .. -1144        40 .. 3420            ~5880 .. 11000
 -7050        .                 [SUNSET PIER isle]       [MONARCH ISLE 5460..10150,
 -4200        .                 NORTHBANK (reclamation)    y -5272..-468]
 -3500        .                   + NORTH POINT KEY (x 3740..4460, the towers)
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
  Keys: **adding blocks must not reorder the seeded random stream.** The retired North
  Point cluster blocks replay the old plan's draws unseen before building their offices
  (`buildNorthPointBlock`), one building per old tower, so every later building keeps its
  index (zoned height, facade). New land must not make a grid block valid:
  `validCityBlock` refuses North Point Key; places off the grid build last on their own
  stream (`buildNorthPointKey`).
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
  Strength (`SWIM_BREATH`, 30 s of treading) runs out on a long swim; spent, the swimmer
  loses `EXHAUSTED_HP_PER_SECOND` (5) until the harbor patrol fishes them out after
  `RESCUE_AFTER` (14 s, $100): an unhurt swimmer survives the wait, a wounded one may not
  (tools/tests/swim-rescue.mjs).
- `BRIDGES` lists every road bridge as a straight deck `a → b` at road level with a `style`.
  `bridgeStructure(bridge)` lays out the design in the bridge's frame from `BRIDGE_DESIGNS`:
  navigation `channels`, `footings` in the water, `solids` on the deck (anything over the
  carriageway starts at `BRIDGE_CLEARANCE`, 46). One structure feeds everything: boats steer
  round `bridgeFootings()`, aircraft collide with `bridgePylons()`, bridges3d.js draws it,
  roadblocks cut the city end, the route graph joins it to the streets.
- Twelve bridges (Keys, Palm Sound Causeway, East Bay, South Bay, Sunset Pier, Oceanview,
  Coral Sound, Ridgeline Viaduct, Sentinel, Sovereign, Regency, North Point Key):
  `DeadEndCity.layout().bridges` has ids, styles, towers and footings. A region or bridge
  added later is appended at the end (Monarch's, North Point Key's) so earlier coast walks
  and promenade rhythms keep their order. Rail bridges belong to the viaducts (transit.js).
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

## Navigation and layout data

- navigation.js: road graph, A* routes, waypoints, map gestures, the minimap GPS
  (`updateGpsRoute`). `DeadEndCity.route(x, y)` reports a route and the bridges it uses.
- `DeadEndCity.layout()` returns the whole plan as data (coast, streets, rail, buildings,
  helipads, docks, ships, props, static colliders, bridges, reserved plots).
  `node tools/layout-audit.mjs <html>` checks it for overlaps (28-39 oblique-junction notes
  are expected); `docs/audit/world-layout.md` explains the audit.
- The minimap base layer is painted once (`minimapBaseLayer`); anything added to
  `paintMapBase()` must be static.
