# Drawbridges on every island, the Coronation Bridge

- New road bridge: the CORONATION BRIDGE (1937) from Sunset Pier to Monarch Isle over Sovereign Sound, an Art Deco
  causeway with entrance pylons, fluted lamps and a working double-leaf bascule; Monarch Isle's traffic crosses it.
- Every island with more than one bridge now has a drawbridge: besides Palm Sound (unchanged), the Coronation Bridge
  and bascule spans let into the Oceanview Causeway (1960s concrete tender's booths) and the Ridgeline Viaduct (steel
  control cabins; its H-pylons gave way). Each opens on its own timetable for its own tall ship; the timetables are
  staggered so one span or more is up or moving about 70% of the day (two or three at once now and then).
- Traffic, county and Monarch traffic stop at the gates; police in a chase brake at the trunnion; the GPS and police
  dispatch price each raised span. Jumps, leaves as ramps and the bridge-jump banner work on all four.
- GOD MODE tab: DRAWBRIDGES row, ALL or one bridge, RAISE NOW (bells, gates, the span cleared, then the leaves) and LOWER.
- Internals: `drawbridgeList()` (one state per movable bridge, plan in `bridge.drawbridge`), `c.deckBridge`,
  `basculeSpan` / `basculeRetrofit` (geography-land.js), per-bridge 3D views and looks (`DRAWBRIDGE_LOOKS`,
  drawbridge3d-houses.js), `drawbridgeSpanLimit` for police, bridge plaque atlas 32 cells.
- Console: `drawbridges()`, an `id` on `drawbridge`, `drawbridgeLook`, `drawbridgeTraffic` and `bridgeJump`,
  `godDrawbridges(action, pick)`, `godDrawbridgePanel(close)`. Tests: drawbridge-islands, drawbridge-traffic,
  coronation-bridge, god-drawbridges.
