# Audit report: world layout, railway, county, parks, harbor, sports, streets

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
- Street ends at the airport fence (Sunset Blvd, Royal Ave, Stadium Way) keep their round
  turning heads; from above the painted ring can read like a helipad. The Shore Line passes over
  Royal Ave's.
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
- Units: 512 = 100 m. WORLD_SIZE 11264, CITY_SIZE 5632, BLOCK_SIZE 512. Map x runs 0..11264; the
  west coast of Northbank is at the world's western edge, so nothing may be built at x < 0.
- City grid: avenue columns at 128 + i*512 (i = 0..10), rows at 128 + j*512 (j = -8..10). Streets
  88 wide; 112 wide on 1152, 2688, 3200, 4736, -1408 and -2944. Streets are clipped to land, the
  airport, park closures, the stadium and the beach; x = 128 is the rail corridor.
- Marlow Bay river x 3420..3960 separates Northbank Island (west) from Palm Keys (east); bridges
  at y = 1152, 3200, 4736.
- Districts: see `districtAt` in geography.js. County regions: Ridgeline (NE), Oceanview (S),
  Coral Coast (SE), Fort Sentinel island (far SE). Towns: Stonecreek, Northridge, Eastgate,
  Oceanview, Palmshore. Two airports (Southport in the city, Oceanview International in the county).
- Rail: Shore, Coast and Ridge lines with 13 stations (transit.js); scenic trains shuttle each line.
