# Kessler parks at the kerb, trunks close, GPS to the fort

- Borrowed Stripes: Kessler eases over and parks flush with the kerb opposite the Marea instead of stopping in his
  lane; waiting at the club now brings him on from well over a couple of blocks away, never round the corner.
- Trunks close again: the action key at an open trunk shuts it (CLOSE THE TRUNK; Kessler's only once the bag is
  out), and a car moving off past walking pace slams its lid shut.
- The GPS reaches every objective: the road route now shows to Fort Sentinel's gate, the records office (a dashed leg
  in past the gate), CIRRUS and Kessler's car, on the minimap and now on the city map (M) too.
- Kessler's car is marked on both maps with a red ring and KESSLER (pulsing) until the uniform is out of the trunk.
- Internals: map-objective.js (`navRouteEnds`: route ends on one connected road network; a dashed last leg; the map
  highlight); `countyRouteStop` (a county route that ends in a stop); console `gpsReport()` and `kerbFit()`;
  tests mission4-kessler and trunk-close.
