# No world-edge warning on land
- APPROACHING THE WORLD EDGE no longer shows while walking or driving on land: driving east on the Ridgeline (the
  hill climb, the Stonecreek Connector) raised it 400 m inland, because the county's east coast ends only 42 units
  short of the line. Only a player who can reach the line is warned: in an aircraft, under a parachute or falling,
  in a boat or swimming (and never aboard a ship, which keeps her own course).
- Internals: world-edge.js `worldEdgeCanReach()`. Test: tools/tests/world-edge-land.mjs.
