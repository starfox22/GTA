# World and map: water, shores and bridges

Split out of world-and-map.md (layout, frames, the Northbank grid, navigation). water.js (`shoreStepBlocked`,
swimming), geography.js `BRIDGES`, bridges3d.js; the drawbridges in detail: world-and-map-drawbridges.md.


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
- Thirteen bridges (Keys, Palm Sound Causeway, East Bay, South Bay, Sunset Pier, Oceanview,
  Coral Sound, Ridgeline Viaduct, Sentinel, Sovereign, Regency, North Point Key, Coronation):
  `DeadEndCity.layout().bridges` has ids, styles, towers and footings. A region or bridge
  added later is appended at the end (Monarch's, North Point Key's, the Coronation Bridge) so earlier coast walks
  and promenade rhythms keep their order. Rail bridges belong to the viaducts (transit.js).
- **The drawbridges** (world-and-map-drawbridges.md): four working double-leaf bascules
  (Palm Sound Causeway, Coronation Bridge, and spans let into the Oceanview Causeway and the
  Ridgeline Viaduct), one on every island with more than one bridge. Phases warning → gates →
  clearing → unlock → raising → open → lowering → seating → lifting → idle, on game seconds.
  The pits reach below the sea: a depth-only mask keeps the water plane out (renderOrder -2).
