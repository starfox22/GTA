# Audit report: world layout, railway, county, parks, harbor, sports, streets

## Ridgeline mountain villages pass

Stonecreek, Northridge and Eastgate rebuilt as mountain villages (mountain-village.js); the 4x4
club moved into Northridge's north-west block (lot x 8464..8888, y 2654..3062); the lone helipad
by the Ridgeline Highway (8130, 2740) and its helicopter removed, the Last Witness pad moved to
the Northridge ranger station (8570, 3462). Streets, avenues and the terrain's flat pads are
unchanged; NORTHRIDGE MARKET STREET (a service lane through the old block (0, 0)) is gone.

Verified (headless):
- Every building is checked against every county and service road when the plan is built
  (`mountainRectClear`, 4 units); `DeadEndCity.mountainTowns().skipped` is empty. The island
  holds 57 buildings: 46 mountain buildings and the 11 thin walls of the clubhouse and workshop
  (no city-kit building is left on Ridgeline).
- `tools/layout-audit.mjs`: nothing new, only the 39 known oblique junction notes (the club,
  the squares, 82 lantern props, fences, woodpiles and the rescue pad add no overlap).
- Hill climb: at the club gate in a truck the prompt reads HILL CLIMB · BEAT 2:30; E arms it
  (`armed: 0`) and sets the GPS to the start gate (7552, 1907); from the gate `trailDrive`
  started the challenge clock and passed checkpoint 1 in 25 s.
- The club block: 7 club trucks and 2 members' rigs parked, 14 members (bar, pool, couches,
  veranda, fire pit, BBQ, workshop); inside the clubhouse the roof and upper storey hide
  (`mountainTowns().render.club.upperShown: false`).
- No console errors. Draw calls (graphics high, whole frame, camera / shadow, same views by day)
  before -> after: Northridge 436 / 431 -> 386 / 390 (now with the whole club block in view),
  Stonecreek 459 / 501 -> 360 / 385, Eastgate 290 / 277 -> 230 / 236. Each village is 23-25
  meshes (Stonecreek 45.9k triangles, Northridge 28.9k, Eastgate 44.7k) plus the club's 50
  (18.8k).

## Monarch Isle pass

A new island north of the Ridgeline Range (x 5460..10150, y -5272..-468; SOURCE_GUIDE section
4, "Monarch Isle"), joined by the Sovereign Bridge (3150, -2944 -> 5600, -2944) and the
Regency Bridge (6400, 600 -> 6400, -1276), with Regency Road along the range's west coast to
Eagle Pass (6500, 1800). Nothing existing was moved; the Sunset Pier Bridge, North Point and
the range keep their places (the Sovereign Bridge is 2,450 units long, the Regency Bridge
1,876).

Verified (headless):
- Block size: `DeadEndCity.monarch().grid` gives columns 5600, 6400, 7200, 8000, 8800, 9600 and
  rows -4544, -3744, -2944, -2144, -1344: every street centreline spacing is 800 units (100 m).
- `tools/layout-audit.mjs`: nothing new but the expected oblique notes where the island's
  streets meet the two roundabouts and where Harbour Circle meets the Regency Bridge (both
  junctions) and Eagle Pass x Regency Road (a junction). Interior palms of the Palm House are
  plain geometry, not street props; no lantern stands on a bridge deck.
- GPS: `route()` from Northbank (2000, -2900) to the island uses the Sovereign Bridge; from
  Eagle Pass (6500, 1800) the Regency Bridge; from Palm Keys the Keys Bridge and Sovereign.
- Driving: North Point -> Sovereign Bridge -> Crown Avenue -> Regency Road -> Harbour Circle ->
  Regency Bridge -> Regency Road on the mainland (terrain flat along the road).
- Traffic: 30 island cars, after 200 s 27 moving and none still for over 30 s
  (`trafficStuck: 0`); after a further 240 s, 29 moving. `walkOnRoad` is empty.
- Police: two stars on the island bring patrols onto the island's streets.
- `tools/smoke.mjs`: clean. Draw calls (graphics high): island views 133-207 view calls and
  167-253 shadow calls, against 181 / 264 in the city centre; the island's per-frame update is
  about 0.1 ms steady.

## Runway piers pass

Southport's runway was extended south over the sea to 460 m on a reclaimed pier
(`southport-pier`) and Oceanview's west over the sea to 1,280 m (`oceanview-pier`,
`oceanview-pier-east`); see SOURCE_GUIDE section 4, "Airfields".

Verified (headless):
- `tools/layout-audit.mjs`: the same 28 oblique county junction notes as before and nothing
  else; 10 fewer foot obstacles (the tropical trees that stood on the new runway strip).
- A runway check over `DeadEndCity.layout()` (runway and blast pads, the runway strip 30 m
  either side, Southport's taxiway) against buildings, trees, lamps, static colliders, roads,
  rail, rail piers, bridges and helipads: no overlap; every paved point is land.
- Nothing else was moved: no bridge, rail pier, road, the drawbridge or the mountains are
  touched. The Saltwater Accounting boat run now goes round the end of Southport's pier.

Noted, not changed:
- Southport 36's approach and Oceanview's west pier cross (the pier passes 170 m south of
  Southport's pier end): a plane on a 3 degree path to 36 crosses it at about 11 m.

## Palm Sound drawbridge pass

The Palm Sound Causeway (`keys-harbor`) was turned into a working bascule without moving
anything else: the deck, its ends, the approach piers and the channel are where they were.
The bascule layout changed inside the bridge's own frame (bridgeStructure 's.bascule'):
the piers are 64 long (the counterweight pits), the tender's houses stand 16 off the deck
edge, a timber fender (its own footing, so boats steer round it) runs 110..190 out from each
pier face, and the gates and stop lines stand on the approach spans 26 and 44 behind the
piers. The Keys Bridge, East Bay Crossing and every other bridge keep their designs.

Verified (headless, `DeadEndCity` console):
- `tools/layout-audit.mjs`: only the 28 oblique county junction notes it reported before; no
  overlap at the drawbridge (houses, fenders, gates or signals).
- A scheduled opening runs every phase; the ketch waits at her hold point, crosses at the
  `open` phase and anchors on the far side; the leaves come down and the arms lift.
- Traffic spawned on both approaches (`drawbridgeTraffic`) queues at the stop lines while
  the bridge is up (9 of 9 held) and moves off afterwards.
- On foot: stopped at a lowered sidewalk arm and at the span's edge; someone caught on the
  span can always walk off it. The tender waits (and sounds the horn) while the player stands
  on the span.
- Jumps: at 15-16° a car at ~330 u/s clears the gap (53 m, hard landing, damage); at 32° a
  car coasting at 47-52 u/s leaves the tip and falls into the gap, floods and sinks; below
  that it rolls back down the leaf.
- GPS: with the bridge up, a trip across the Sound goes round by the Keys Bridge; with it
  down, straight over.

Noted, not changed:
- Boats still pass "under" every other deck (the decks are at road level); only the ketch
  uses the drawbridge's channel as a real opening.
- The 2D fallback view draws the span only while the leaves are down.

## Island rearrangement pass (Palm Keys west, Sunset Pier north, wider bays)

### The new geography
Left to right: Palm Keys (x -3135..-1144, the tropical island), Palm Sound (~1200 of water),
Northbank (x 40..3420), Marlow Bay (2400..2700 of water), Ridgeline and the county. The
Sunset Pier island (x 1830..4260, y -7090..-5680) is north of the reclamation across North
Sound. See SOURCE_GUIDE section 4 for the full plan, the bridge table and the reserved plots.

### How it was moved
- **Frames.** The world box gained `WORLD_LEFT` (-5120) and a deeper `WORLD_TOP` (-8192); the
  city frame gained `CITY_LEFT` (-3584) and `CITY_RIGHT` (3712). Every consumer of the old
  0..CITY_SIZE assumption was converted: the 2D ground sheet and its blit, the 3D terrain and
  roughness sheets and the ground mesh, the night light map, the shore distance field and the
  water shader's world rectangle (`SHORE_RES` 512 -> 768 so texels stay ~21 units), the city
  map (scale, centre, pan limits) and the navigation clamps, the street loop, the crowd's grid
  test, traffic and pedestrian spawn ranges, the manhole/stain scatter, the cloud city glow.
- **Palm Keys** was reflected east-west as it moved, so Ocean Drive faces the open sea: blocks
  kept their contents (block 8 -> -4 by x - 6144, block 9 -> -5 by x - 7168); street and strand
  points were reflected (x' = 2816 - x). Moved with it: PLACES and the casino, the Blue Hour
  (`ROOFTOP`, its terrace is ROOFTOP-relative), Vinny's depot (chase.js, harbor3d.js, the
  mission 1 delivery), the armory, Palm Auto Paint, the parks on those blocks, the Golden Tide
  approach, the two Keys jetties (now on the bay shore), the palms, the strand umbrellas, the
  signs, the gangs, the rival patrol, mission and contract points (LOC.motel, LOC.warehouse,
  the buoy, the recon launch, rush checkpoints, bomb sites, the repo limousine).
- **Southport Beach** moved whole onto the Keys' south shore (x - 4410) as Palm Keys Beach: the
  land polygon's smooth strand, `BEACH`, the boardwalk, the pier, every beach.js/beach3d.js
  x literal; the beach waterline is found in the Keys polygon. Northbank's south shore is a
  straight sea wall with Battery Park (a lawn) and the esplanade.
- **Sunset Pier** moved to its own island and turned 180 degrees (p' = (7610, -1185) - p) so
  the gate faces the bridge: `PIER`, `COASTER_TRACK`, the paint, the trees, the crowd spots,
  the midway lamps and the stall fronts (now facing north, onto the midway). The island has
  its own ground tile and Pier Island Drive.
- **Bridges** are one list, `BRIDGES` (geography.js), replacing the three fixed Marlow Bay spans
  (`bridgeSpan`) and `COUNTY_BRIDGES`. One set of consumers draws and collides them all:
  county3d.js (deck, rails, pylons), countyBridgeRails and the pylon colliders (county.js),
  air-cover.js, boatFits (pylons only), roadblocks.js (a cut at the city end of each bridge),
  the 2D view and maps (`drawBridgeGround`), `districtAt` (a deck reads as its bridge's name).
  The Marlow Bay suspension towers (landmarks3d.js) and railings (world3d.js) went with the
  old spans.

### Found and fixed on the way
- **`inAirport` caught all of Palm Keys.** It only bounded x from above (x < 1400), so every
  block, street and district south of y 4120 at negative x read as the airport. Bounded below.
- **Palm Grill was never built.** Its footprint reached 2 units into Palm Auto Paint's lot and
  `prepareGarages` deleted it (on the old site too). The diner is 6 units shallower.
- **Navigation: collinear roads never joined.** A street carried over a bridge and the bridge
  deck itself ran side by side without a shared node unless a crossing street happened to cut
  both. Overlapping collinear segments now cut each other at their end points.
- **`WIDE_ROADS` could not tell a column from a row** once columns went negative (-1408 is a
  wide row and a narrow column). Split into `WIDE_COLUMNS` / `WIDE_ROWS`; `sidewalkOffset`
  takes the axis.
- **2D view: long bridges over open water were invisible** (no ground sheet covers them); the
  2D renderer draws every deck.
- **Foothill Road** (new) first ran past Stonecreek's south avenue at a shallow angle; it now
  meets the town at its south-west corner.
- **Meridian Star** rode at anchor where the Sunset Pier Bridge runs; she anchors 240 west.

### Verified
- `layout()` + the overlap audit: no overlaps; 28 oblique road contacts, all county and airport
  junctions (one new: Foothill Road leaving the South Bay Bridge landing).
- Every bridge: both ends on land, the middle over water, a car fits the deck;
  `route(x, y)` from Midtown reaches Palm Keys (keys-harbor), Stonecreek (east-bay), the park
  gate (pier-bridge), the beach and Oceanview (south-bay + oceanview). A sedan drives the
  Keys Bridge, the Palm Sound Causeway, the East Bay Crossing and the Sunset Pier Bridge end to
  end. Roadblocks build at the Keys Bridge, Palm Sound Causeway and East
  Bay Crossing approaches.
- All 16 missions start; every moved objective probes as land (or water for the buoy, the
  launch and the jet-ski route). Mission 1: skip to the depot, drive in, shutter down, out the
  back door: won. Mission 8: jet ski from the Keys jetty, salvage at the buoy, the new Palm
  Sound route (7 gates, 128 s of the 150 left), the Southport dock, disembark. Rush Hour
  (18,146 of road, clock 330 -> 390 s) and Repo Man (clock 540 -> 660 s) grew their clocks
  with the longer crossings.
- Mission 7: the Blue Hour lift, Mara, both sightlines logged against the launch now patrolling
  Palm Sound (x -924).
- 3D (LOW tier, headless): the Keys Bridge, the Sunset Pier island tile and bridge, the beach
  (umbrellas, pier, club plot), Battery Park and the South Bay Bridge render; no console errors.
- Palm Keys Beach: 171 beachgoers at 17:20, 65 umbrellas, 5 kiosks, 38 buoys; walking off the
  sand into the sea starts a swim ('beach' shore); 86 ladders.


## City layout pass (railway to the west, overlaps, beach)

### How the audit is run
`DeadEndCity.layout()` returns the plan as data: land and lake polygons, the beach, every
street/boulevard/service/county road with its width, bridge spans, rail track, deck boxes, piers
and stations (with their lift towers), building footprints, helipads, docks and their boats,
parks, places, ship hulls, the marina, trees, lamps, benches and every non-building static
collider. `node tools/layout-audit.mjs dist/game.html` (oriented-box SAT tests plus
point-in-polygon for water) checks: rail decks against buildings, helipads, ships, docks and marina berths; piers
against roads and buildings; station platforms against buildings and helipads; building/building,
building/road, building/park, building/water and building/beach; helipads against roads; roads
overlapping other roads at an oblique angle; trees, lamps and benches standing in a carriageway.
After this pass it reports no overlaps; the 27 oblique road contacts it lists are all county and
airport junctions. Rendering the same data as an SVG plan is the quickest way to eyeball a
change (pass a second argument to save the layout JSON).

### Found and fixed
- **Train over the harbour ship.** The old Bay Line ran down Marlow Bay straight over the
  Ironworks freighter (3525, 1455) and past the docks. The railway now runs on the west side.
- **Railway moved west.** Three lines on their own right of way (see transit.js RAILWAY and
  SOURCE_GUIDE section 4): Shore Line (Cruise Terminal -> Garden St and y -2944 el -> west sea
  wall at x 150 -> Viaduct Green -> Harbor Ave and Royal Ave el -> Southport Airport over the
  Airport Way forecourt), Coast Line (airport -> channel viaduct -> Oceanview -> behind Oceanview
  International -> Coral Sound narrows -> Palmshore), Ridge Line (Palmshore -> own bridge ->
  Eastgate -> Northridge -> Stonecreek). 13 stations. The old county lines rode on top of the
  Oceanview Parkway, Ridgeline Highway, Stonecreek Connector, the Coral Sound Bridge, the Sentinel
  Causeway and town streets, with stations over carriageways; none of the new track shares a
  road alignment in the county, and every road it meets is crossed as a flyover. The Palm Keys
  (Ocean Drive) and Sentinel Causeway stations were dropped with that route; Fort Sentinel is a
  restricted base and has no public station.
- **Patchy curves.** Corners were rounded by a 7-step quadratic per corner and the viaduct was
  one box per segment, so every bend showed wedge-shaped gaps outside and overlaps inside. Track
  is now circular fillets (per-corner radius, minimum 180) eased by a smoothing pass, resampled
  and thinned to 0.6-unit chord error; the viaduct is a swept extrusion (deck, parapets, ballast
  bed, two rails, steel coping) with mitred joints; sleepers (every 6 units), masts and piers are
  placed by arc length. Train cars take their heading from the track either side of each car.
- **Trains crawling on low frame rates.** A train advanced at most one track point per frame; it
  now runs through as many points as the frame's travel covers. Scenic trains dwell at stations.
- **Piers.** Marine piles over water, portal columns under the deck edges on open ground, and
  straddle bents with a cross-head over the avenues the el follows; bents are left out where
  the deck crosses a road, a bridge or a dock. The old ±70 land piers stood in block kerbs.
- **Rail collision.** Rail decks and platform canopies (and county bridge guard rails) were put
  in the physics grid under string keys, but the grid is read with numeric keys, so aircraft
  flew through the viaduct and traffic through county bridge rails. Fixed in air-cover.js and
  county.js.
- **Building in the sea.** The ragged west coast bit into block (0, 3) at y ~2010, leaving a
  building's corner in the water. The west coast is now one straight reclaimed sea wall.
- **West Quay.** The x = 128 column only existed as two stub streets between the coast and the
  blocks; it is now the rail corridor (`RAIL_CORRIDOR_X`) and the rows run to the esplanade.
- **Riverside helipad.** The esplanade was painted across half of the helipad at (3345, 1920);
  it now gives way at the pad (`esplanadeGivesWay`), as it does at Southport Beach.
- **Airport Way over Battery St.** Airport Way started at Commons St (1664, 4160) and ran
  diagonally across the last 260 units of Battery St. It now starts at Battery St's west end
  (1440, 4224) and shares a point with it, so the route graph joins them.
- **Ocean Drive slip curve.** A boulevard from (5248, 4384) to (4980, 4736) was painted
  diagonally across Ocean Dr, Stadium Way and the corner block. Removed; the grid junction
  serves the corner.
- **Northbank Quay lane.** A 44-wide lane at y 190 (x 640..2176) ran 18 units from North Shore
  Rd's kerb, through the kerb trees: a leftover from before the reclamation. Removed.
- **Stadium Way bridge.** Its deck and guard rails started at x 3050, inside the stadium's east
  and south-east stands. All three crossings now start on Riverbank Dr (x 3150).
- **Reclamation blocks.** The perimeter-block pattern fell through to the generic back-lot
  building and car park, which were stacked over both wings and the planted court of every
  reclamation block. The pattern now closes the court with a south range.
- **South Coast Outfitters** was assigned block (3, 6), inside Central Garden: the shop stood
  on the rose garden with its front on Linden St. Moved to block (2, 6) across Commons St.
- **Vinny's depot** wall pieces overlapped at the corners (coplanar roofs flicker); they butt.
- **Trees in carriageways.** Kerb trees landed on Airport Way, the Sunset Pier causeway and the
  county market streets (21 trees); trees on roads or under rail piers are now removed.

- **Viaduct across the marina mouth.** The first west route ran on piers across the Harbor
  Point basin's entrance at y ~-4100: no superyacht or masted yacht could have entered, and the
  piles stood in the channel. The Shore Line now leaves the Cruise Terminal station on the apron
  street (y -3968), runs as an el down Garden St and west along the y -2944 avenue (new Harbor
  Point station at 1408, -2944) to the sea wall; the basin mouth is open water.
- **Commons St through the yacht club.** Commons St ran from y -4112 straight through the club
  house, the jetties and the fuel berth on the marina's east quay, and the fuel berth and the
  south jetty stood in the y -3456 street. The east quay (`MARINA.eastQuay`) is now pedestrian:
  Commons St ends in a T-junction at y -3456 and the apron street at x 1728; the fuel berth and
  that jetty moved north of the club. Streets that end on a crossing street's carriageway get no
  turning head or NO THROUGH ROAD barrier (`streetEndInJunction`).

### Southport Beach (reserved)
`BEACH` in geography.js: the south shore of Northbank between the airport fence (x 1740) and the
Battery Point sea wall (x 3150), from the Marina Rd kerb (y 5306) to the water. The coast was
pushed out (to y ~5810 at x 2420) so the strand is 250..500 units deep and ~1400 long. Sand,
wet sand and a 40-wide boardwalk (`BEACH.boardwalk`, y 5306..5346) are painted; streets and
blocks are kept off it (`cityStreets`, `validCityBlock`), the shore style is 'beach' (sand lip,
no quay wall), the esplanade stops at either end, and `districtAt` names it. The Oceanview
Causeway crosses it at x 2176; the Coast Line passes ~400 units to the west on its channel
viaduct, never over the sand. Props and beach life are left for the beach pass.

### Noted, not changed
- (Changed since: street ends stop square at a kerb and guardrail, see
  streets-collision-qa.md.) Street ends at the airport fence (Sunset Blvd, Royal Ave, Stadium
  Way) kept round turning heads that read like helipads.
- County junctions meet at shallow angles in places, and the Ridgeline Highway runs on the same
  alignment as Northridge's y = 2600 avenue for one block (coincident, not crossing).
- The Oceanview Causeway road crosses Southport Beach at ground level, splitting the strand.
- The render3d roughness map still treats the x = 128 column as road.
- The x = 3200 street is severed by the harbor's north wall by design.
- navigation.js `closestNavNode` could return undefined on an all-isolated graph (unrealistic).
- transit.js: while a stop is blocked, scenic trains also pause (cosmetic).

## Earlier pass
- harbor.js: the 2D fallback drew the southern gantry crane 35 units north of its collision solids
  and 3D model. Coordinates now match.
- Verified then: county bridges connect to the city grid through shared navigation nodes;
  wildlife habitats are on land; sports state machines cannot stall; gate thresholds match
  between navigation, physics and collision; no millisecond/second mixing; arrays are bounded.

## World layout as coded (reference)
- Units: 512 = 100 m. World box x -5120..11264, y -8192..11264 (`WORLD_LEFT`, `WORLD_TOP`,
  `WORLD_SIZE`); city frame x -3584..3712, y -4224..5632 (`CITY_LEFT`, `CITY_RIGHT`,
  `CITY_TOP`, `CITY_SIZE`); the county lies past x or y 5632. Nothing may be built outside
  the world box.
- City grid: avenue columns at 128 + i*512 (i = -5..10), rows at 128 + j*512 (j = -8..10).
  Streets 88 wide; 112 wide on the `WIDE_COLUMNS` (-1920, 1152, 2688, 3200) and `WIDE_ROWS`
  (1152, 2688, 3200, 4736, -1408, -2944). Streets are clipped to land, the airport, park
  closures, the stadium, the beach and the reserved plots; x = 128 is the rail corridor.
- Palm Keys (west) and Northbank are joined by the Keys Bridge (y 1152) and the Palm Sound
  Causeway (y 3200); Northbank and Ridgeline by the East Bay Crossing (y 3200) and the South Bay
  Bridge (y 4736); the Sunset Pier island by the Sunset Pier Bridge (x 3200). `BRIDGES` in
  geography.js.
- Districts: see `districtAt` in geography.js. County regions: Ridgeline (NE), Oceanview (S),
  Coral Coast (SE), Fort Sentinel island (far SE). Towns: Stonecreek, Northridge, Eastgate,
  Oceanview, Palmshore. Two airports (Southport in the city, Oceanview International in the county).
- Rail: Shore, Coast and Ridge lines with 13 stations (transit.js); scenic trains shuttle each line.
