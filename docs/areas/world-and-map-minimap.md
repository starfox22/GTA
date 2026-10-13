# Minimap marks and the park rides on the maps

The minimap is a driving aid; the city map (M) is the guide. Both are drawn by `drawMap` (game-minimap.js), the
minimap over its once-painted base layer (`minimapBaseLayer`: land, streets, parks, ground, building footprints and,
since this change, the basketball court and stadium ground from `paintSportsGround`). The 2D fallback renderer uses
the same HUD canvas and the same `drawMap`, so the rules below hold there too.

## What the minimap draws (minimap-rules.js MINIMAP MARKS)

- Always: the objective (a gold blip of a fixed size on the glass, over its GPS road route), the map waypoint and
  its cyan route, the player, mission entities (Kessler's car via `mapHighlightVehicle`, the harbour crates, a street
  thief) and a drawbridge's sign only while it is not simply down (the deck itself always).
- While wanted (`wantedStars > 0`): every police unit, the search circle and the nearest respray (`minimapRespray`),
  with a rim arrow when the respray is off the card (`drawMinimapEdgeBlips`). Not wanted, police show only when on a
  job of their own (`minimapPoliceShown(alerted)`: mission pursuit, gang fight).
- A waiting call: only the payphone it guides to (`minimapPayphone`, the same as `objective()`).
- Places (shops and services, rail stations, bike docks): only on foot within `MINIMAP_NEAR` (480 units, 60 m), as
  small chips with no names (`minimapPlaceNear`); a share-bike rider sees every dock in view.
- Never on the minimap: helipads, planes, sports badges, rail lines, garage and station names, the harbour yard
  outline, the district name (the top bar carries it). The city map keeps all of them, and its filters (MAP LAYERS,
  map-view.js) still hide a whole kind on both maps.
- Painters gate on `mapWindowHas` and draw fixed-size text with `mapLabel`. Each counts what it puts on the minimap
  with `mapMarkCount(blips, labels)`; the GPS line sets `mapMarks.route`, the waypoint line `mapMarks.waypoint`.
  Console `minimapReport(reset)`: the last refresh's marks, the peak since a reset, route flags and which rules
  applied. tools/tests/minimap-clutter.mjs caps the marks in busy spots (16 blips, 4 labels; 30 blips in a five-star
  chase) and checks the GPS route for missions 1-4 and a waypoint.
- A new marker kind decides its minimap rule here: a mission entity or a wanted-only aid may go on the minimap,
  anything else stays on the city map or follows `minimapPlaceNear`.

## Sunset Pier's rides (park-map.js)

- The Falcon's track is `coasterCircuit()` seen from above (every ~8 units, one Path2D built once, closed): a dark
  casing and a violet line of a fixed width on the glass (never gold: that is the GPS). Loops and the corkscrew fold
  onto themselves as they would from the air. Moving the circuit moves the map with it.
- The Sunset Eye stands edge-on to the sky (its rim is in the plane y = `PIER.wheel.y`), so the map shows a Ferris
  wheel sign of a fixed size (rim, spokes, hub, A-frame legs) at the hub, `PIER.wheel`.
- Both are drawn on both maps, gated by the map window.
