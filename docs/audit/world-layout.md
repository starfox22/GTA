# Audit report: county, military, terrain, navigation, transit, parks, ecology, harbor, sports, streets

## Fixed
- harbor.js: the 2D fallback drew the southern gantry crane 35 units north of its collision solids
  and 3D model. Coordinates now match.

## Noted, not changed
- The y=4736 bridge's west landing overlaps the stadium's east stand; the street is cut so AI
  never drives there, but a player walking west along the deck hits the stand.
- The x=3200 street is severed by the harbor's north wall by design.
- navigation.js `closestNavNode` could return undefined on an all-isolated graph (unrealistic).
- transit.js: while a stop is blocked, scenic trains also pause (cosmetic).

## Verified
- County bridges connect to the city grid through shared navigation nodes.
- All 14 rail stations sit on track segments and are connected.
- Wildlife habitats are on land; sports state machines cannot stall.
- Gate thresholds match between navigation, physics and collision.
- No millisecond/second mixing; arrays are bounded.

## World layout as coded (reference)
- Units: 512 = 100 m. WORLD_SIZE 11264, CITY_SIZE 5632, BLOCK_SIZE 512.
- City grid: road centres at 128 + i*512 (i = 0..10) on both axes. Streets 88 wide; 112 wide on
  1152, 2688, 3200 and 4736. Streets are clipped to land, the airport, park closures and the stadium.
- Marlow Bay river x 3420..3960 separates Northbank Island (west) from Palm Keys (east); bridges
  at y = 1152, 3200, 4736.
- Districts: see `districtAt` in geography.js. County regions: Ridgeline (NE), Oceanview (S),
  Coral Coast (SE), Fort Sentinel island (far SE). Towns: Stonecreek, Northridge, Eastgate,
  Oceanview, Palmshore. Two airports (Southport in the city, Oceanview International in the county).
- Rail: City, Coast, Ridge and Airport Branch lines with 14 stations (transit.js).
