# The drawbridges

drawbridge.js (`-span`, `-motion`, `-opening`, `-report`), drawbridge3d.js (`-kit`, `-houses`,
`-build`), coronation-bridge.js / coronation3d.js, god-drawbridges.js. Bridges in general:
world-and-map.md "Water, shores and bridges".

## Which bridges

Every island reached by more than one road bridge has a drawbridge among them
(`bridgeIslands()`: regions that touch are one island; rail viaducts do not count):

| Island | Road bridges | Drawbridge |
| --- | --- | --- |
| Palm Keys | keys-union, keys-harbor | keys-harbor (Palm Sound Causeway) |
| Northbank | keys-union, keys-harbor, east-bay, south-bay, pier-bridge, oceanview, sovereign, north-point-key | keys-harbor, oceanview |
| Sunset Pier | pier-bridge, coronation | coronation |
| Monarch Isle | sovereign, regency, coronation | coronation |
| Ridgeline | east-bay, south-bay, ridgeline, regency | ridgeline |
| Coral Coast | coral-sound, ridgeline, sentinel | ridgeline |
| Oceanview | oceanview, coral-sound | oceanview |
| Fort Sentinel, North Point Key | one each | - |

- **Palm Sound Causeway** (`style: 'bascule'`, 44 m leaves, Beaux-Arts tender's houses, the
  brigantine ALBATROSS): unchanged, opens 06:40, 14:20, 21:30.
- **Coronation Bridge** (`style: 'deco'`, new, the last entry of `BRIDGES`): Pier Island Drive's
  east bend (3898, -5900) to the Westgate / Ocean Crescent corner (5600, -4544) over Sovereign
  Sound; Art Deco causeway on column bents, pierced parapets, fluted lamps, entrance pylons with
  the name, 36 m leaves, stepped stucco towers. Both deck ends lie inside the junction they meet.
  It joins `COUNTY_ROADS` (GPS, county police graph, ground tiles, map) and Monarch's lane graph
  (`isleRoadGraph`: link 'CORONATION BRIDGE' to an 'end' turn-round on the drive by the car park,
  `CORONATION_BRIDGE.pierTurn`).
- **Oceanview Causeway** and **Ridgeline Viaduct** keep their style; `movable` makes
  `bridgeStructure` call `basculeRetrofit`: a bascule at the channel's middle (26 m / 30 m
  leaves) and whatever the design stood in its zone (main piers, the H-pylons and their stays,
  bents, old channels) gives way. Their builders pass the deck gap and call
  `buildDrawbridgeSpan`. Looks 'modern' (1960s concrete booths) and 'steel' (clad cabins).

## State and contracts

- `drawbridgeList()`: one state per `movable` bridge in `BRIDGES` order, its plan in
  `bridge.drawbridge` (openings, leafM, title, water, ends, look, tender plaque, vessel).
  `s.bascule.middle` is the channel (not `s.middle` for a retrofit).
- Functions taking `d` act on one drawbridge (`drawbridgeGeometry(d)`, `drawbridgeLocal(d, x, y)`,
  `drawbridgeSurface(d, u)` ...). The old entry points ask every one: `drawbridgeTrafficLimit`
  (traffic, county routes, Monarch traffic), `drawbridgeSpanLimit` (police in pursuit: the
  trunnion only, they may run the gates), `drawbridgeKeepsOff`, `drawbridgeFootBlocked`,
  `drawbridgeBarrierBodies`, `drawbridgeSettle`, `drawbridgeOpenGap`, `drawbridgeOnSpan`,
  `drawbridgeCameraZoom`, `drawbridgeVesselHulls`, `updateDrawbridge`, `drawDrawbridgeMap`.
- A car on a leaf or in the air off one carries `c.deckBridge` (declared in `makeCar`).
- Hot-path gates: `drawbridgesQuiet` (all idle and seated) and `drawbridgesShut` (no leaf off
  its seat; `settleIsTrivial` reads it), refreshed every update and by every command
  (`noteDrawbridgeStates`). `drawbridgeRouting` is set while the route graph is built.
- GPS links over a span carry their drawbridge (`link.drawbridge`); `navShortestPath` adds that
  bridge's `drawbridgeRouteDelay(d)`.
- Raising and lowering from anywhere go through `drawbridgeOpenNow(d)` (the full sequence:
  warning, gates, clearing the span, unlock, swing) and `drawbridgeCloseNow(d)`; never set
  `d.angle` outside the console's `'snap'`.

## Timetables and the open share

- Staggered so at least one span is unseated at least half the day: `drawbridgeOpenShare()`
  steps one nominal opening per bridge (`drawbridgeNominal`: the real swing and the ship's
  speeds; ~17 min lead, ~155 min not seated) over the timetables: share 0.715, longest
  all-shut stretch 125 min (tools/tests/drawbridge-islands.mjs holds >= 0.5 and <= 180 min).
  `drawbridges()` reports it with the live measure (`measured`) and the islands.
- Coronation 00:40, 10:20 · Ridgeline 01:00, 18:20 · Oceanview 02:00, 18:00 · Palm Sound
  06:40, 14:20, 21:30. Some openings overlap on purpose (two or three spans up at once).

## 3D

- One view per drawbridge (`drawbridgeViews`; `drawbridgeView` is the one being built or
  updated, the kit's builders add to it). `DRAWBRIDGE_LOOKS`: leaf paint, underside, pier
  stone, houses (`drawbridgeHouseStyled`, footprints and heights inside the solids), leaf lamps.
- Ships are built lazily per bridge (`buildDrawbridgeShip(plan)`); only ALBATROSS has a name
  board (the boat-name atlas is full). The bridge plaque atlas holds 32 cells.
- Console: `drawbridges()`, `drawbridge(action, degrees, id)`, `drawbridgeLook(spot, zoom, id)`,
  `drawbridgeTraffic(count, id)`, `bridgeJump(..., id)`, `godDrawbridges(action, pick)`,
  `godDrawbridgePanel(close)`. Tests: drawbridge-islands, drawbridge-traffic, coronation-bridge,
  god-drawbridges.
