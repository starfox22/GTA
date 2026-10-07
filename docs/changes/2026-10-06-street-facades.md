# Shopfronts and facades on every street
- Every side of a city building that faces a street now has a ground floor, not just the south one:
  rows of shops (display windows with the goods inside, glazed doors, fascia signs, some shutters
  down, awnings on north sides, hanging signs on side streets), office and tower lobbies, house doors
  up their steps, warehouse loading bays. The door in the middle of a street side is the one people
  walk into. Narrow streets' south sides, bare before, get shopfronts in the street view too.
- Backs on alleys and yards get plinths, service doors, downpipes and fire escapes; string courses and
  office cornices run round all four sides.
- Shop windows light up shop by shop at night (out with the district's power in the blackout job);
  their light and their signs' fall on the pavement.
- Internals: cityscape3d-frontage.js (STREET FRONTAGE), cityscape3d-shopwindows.js (SHOP WINDOWS);
  every plain-painted shopfront part is one vertex-coloured material (FRONT PAINT): chase-view scenery
  calls -5% to +4%, street view +4-5% (audit/performance.md, seventh pass). cityRandom's stream (roof
  plant, bus stops) is unchanged. Doc: docs/areas/rendering-buildings.md.
