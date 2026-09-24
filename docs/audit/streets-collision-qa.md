# Audit report: streets, barriers and collision

Owner's complaints: the player walks through barriers on the waterfront walkway and at the
marina; barriers and ground circles that make no sense; a NORTHBANK sign in the middle of the
street; objects you can walk through or that stand in the wrong place. Scope: Northbank
(marina, promenades, Battery Park, harbour and stadium surroundings, financial plazas) and
the Palm Keys streets.

## How it was checked

- One headless page on the build, driven with console calls (`look`, `walk`, `probe`,
  `layout`, and two new named test methods, below), canvas grabs for screenshots.
- A systematic probe (`barriers()` + `solidAt()` + `walk()`): every sea railing run sampled
  every 3 units must be `solid()` for a 0.5-unit probe; every street-end guardrail, gate pier
  and railing solid through its footprint; then, from 24 units inland of every third railing
  run, the player walks 60 units seaward at -60, -30, 0, 30 and 60 degrees, and into every
  closed street end at five offsets and three angles. Result on the final build: 710 railing
  runs, 22 street-end pieces, 0 gaps, 0 walk-throughs (the 7 end points past a rail line were
  all at openings: the superyacht passerelle, jetties, a bridge landing, and walks along a
  bent sea wall past the end of the sample's line).
- Furniture and corners (second probe): 741 walks straight through the centre of lamps,
  benches, bins, hydrants, mailboxes, signals, dumpsters and registered fixtures from four
  sides (0 got through), and 363 diagonal and skewed walks into the corners of every tenth
  building (0 ended inside).
- Every vehicle static collider probed with `solid()` at its centre: all block people except
  the intended ones (rail-deck cover volumes overhead, walkable docks, bridge guard rails at
  the deck edge where the deck edge already stops you, the stadium's vehicle-only bollards).
- `node tools/layout-audit.mjs` with the new checks (below): 710 railing runs, 22 street-end
  pieces, 2437 props, 2148 foot obstacles; no findings apart from the 28 oblique road contacts
  that were already listed (all county and airport junctions). No console errors.

## Found and fixed

| Where | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| Every Northbank and Palm Keys quay, the marina | Sea railing stood on the landward edge of the esplanade, beside the road and across every street mouth; you walked straight through it, and between it and the water lay 68 units of walk with no rail | The esplanade furniture and paint took their frame from the coast heading, whose sea side depends on the polygon's winding: on both islands local +z pointed inland. The railing had no collider at all | streets.js `promenadeYaw` (local +z out to sea) for the furniture (world3d.js) and the paint; the railing stands on the quay coping; `promenadeRailBlocked` in `solid()` |
| Quay railing | Would have walled off the ladders, the marina fingers and the superyacht passerelle | - | `addPromenadeRailRuns`: runs break at every quay ladder, each finger pontoon and the passerelle |
| Street ends at the airport fence (Royal Ave, Sunset Blvd, Stadium Way), the marina apron and yacht club (x 640 / 1728) | A painted disc with a white ring (read as a helipad) plus a torus kerb and a tree island; the guardrail had no collider | Turning-head design | Closed ends stop square at a kerb, the footway wraps the end; guardrail and NO THROUGH ROAD post get colliders (`streetEndPlan` / `streetEndSolids`, people and vehicles) |
| Park and stadium gate ends | Gate piers and railings drawn, no collider | - | Same plan: piers and railings solid |
| Union St at the Keys Bridge, Ocean Dr | NORTHBANK, PALM KEYS and OCEAN DRIVE boards hanging over the kerb/carriageway | world3d.js `sign()` calls | Removed; district names are in the HUD and the map |
| Harbor Ave, Sunset Blvd | HARBOR AVENUE / SUNSET BOULEVARD painted along the carriageway | game.js ground labels | Removed |
| Every park in 3D | Park names painted across the lawns | `paintParks(detail)` in the 3D ground sheet | 3D sheet paints without labels (the 2D map keeps them) |
| Avenues | Double yellow line ran through every junction box and crosswalk | One stroke end to end | Stops at the stop lines; stop lines added at every signalled junction |
| Crosswalks | 72 units wide on 112-unit avenues; painted across streets that do not exist (south of Marina Rd); none at T-junctions; some ending at a bridge deck's edge over water | Fixed ±30 pattern at 4-way junctions only | Every junction leg whose street carries on, full carriageway width, only where both ends land on pavement |
| Battery Park | Garden Ave and Garden St ran on under the lawn to the sea wall: road stubs between lawn and esplanade | `cityStreets` did not clip the park | Avenues end at Marina Rd |
| Gully grates | Stamped every 230 units down every column line, across plazas, quays and in the middle of wide carriageways | Loop over `ROAD_CENTERS` | Only in the east gutter of real streets, clear of junctions |
| Financial plazas | Two teal discs (empty pools) | Ground sheet | Planted beds under the tree lines |
| Bus shelters | No marking at the kerb | - | Yellow bus stop box on the carriageway in front of each shelter |
| Ocean Dr (Palm Keys) | South of y 3200 one palm row stood in the carriageway and the other inside the hotels; both rows ran across every side street | Row x shifted to -2354 | `oceanDrivePalms` (3D and 2D share it): both pavements, clear of carriageways and buildings |
| South-west sea wall (270, 4057) | A street tree in the sea | Kerb planting pattern not clipped to land | Trees pruned where there is no ground |
| Southport shops forecourt | A litter bin in the service road | `clearSidewalk` ignored service roads | Checks them |
| Streets, promenades, parks, plazas | Walked through lamp posts, benches, bins, hydrants, dumpsters, tree trunks, planters, fountains, the statue, kiosks, food trucks, bus shelter backs, the bandshell and its seating | Street props only collided with vehicles; renderer furniture had no collider | `footObstacleBlocked` (streets.js) in `moveBody` for the player on foot: registered fixtures, tree trunks, standing knockable props (cones excepted). A player placed on one (car exit, teleport) can step off |
| Sprinting on slow frames, car knock-back | A step longer than a railing is thick could hop it (the knock-back is 25 units in one move) | `moveBody` tested only the end point | Steps over 5 units are sub-stepped |

## Audit tool additions (`tools/layout-audit.mjs`)

The audit now starts a game (the 3D renderer registers the furniture) and checks, besides the
old overlap tests: visible barriers without a collider (sea railing runs and street-end pieces
against `solid()`); knockable props and registered fixtures in a carriageway, inside a building,
in the water or in a doorway; props on props; street-end guardrails in a building or a
carriageway; crosswalks leading into a building, a park or the water; trees in the water or
inside a building. New named console methods for it: `barriers()` (the barrier lines and
street-end pieces as data) and `solidAt(points, r, foot)`; `layout()` now also carries
`props`, `footObstacles`, `streetEnds` and `doors`.

## Screenshots

Scratch paths (`scratchpad/streets/shots/`): `before-northbank-sign` / `after-northbank-sign`,
`before-marina-quay` / `after-marina-quay`, `before-deadend-airport` / `after-deadend-airport`,
`before-gate-garden` could not be taken (the machine was overloaded); after only:
`after-west-esplanade`, `after-marina-east`, `after-gate-garden`, `after-battery-park`,
`after-ocean-drive`, `after-palmkeys-quay`.

## Known, not changed

- Pedestrians (not the player) still walk through street furniture: their paths are laid
  out along the pavement lanes; making them collide would need steering round props.
- Bridge decks have no footway: crossings are not painted onto them.
- Park gate forecourts: the Central Garden north gate's food truck stands beside the path on
  the forecourt paving (it does not block the path).

## Issues in other agents' areas (reported, not fixed)

- South Coast Stadium: the entrance arch/bollard row and three fixtures are vehicle-only by
  design (people pass); fine, but the sports fixture at (2689, 4863) also lets people through
  and looks solid.
- Bridges (bridge architecture agent): deck guard rails are vehicle colliders; people are
  stopped by the deck edge (8 units in), so the rail itself is not what stops them.
