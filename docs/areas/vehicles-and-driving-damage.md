# Vehicles and driving: crash damage and marks on the body

How a hurt car looks: the crumple every body part follows and the bullet holes, stars and scrapes pinned to it. The
damage data (dents, zones, parts, glass, marks) is damage-vehicles.js (police-and-combat.md, Damage and destruction);
the models' damage contract is vehicles-and-driving-models.md.

## Rules (damage-crumple.js, damage3d-crumple.js, damage3d-marks.js)

- `crumpleField(dents, limits, x, y, z, seed, out)` is the one rule for how a body point moves for `vehicle.dents`
  (game side, pure): a smooth dish along each dent's inward direction, a wavy crush front, folds across the push and a
  smooth outward bulge; inward travel stops softly at `crumpleLimits(vehicle)` (the screen's foot or 30 % of the length
  for a nose, just behind the rear glass's foot for a tail, 20 % of the width from the centre line for a side). Nothing
  in it is random per vertex, so parts that touch at rest still touch after a crash.
- BODY CRUMPLE (damage3d-crumple.js): `crumpleCollect` lists every mesh under the body in its rest pose on the first
  damage (parts) and what only moves (wheel groups, the hood's hinge, door and boot hinges, wipers, lamp and beacon
  halos); `crumpleAdopt` adds a door opening, the engine bay or a boot lid made later. A new body part that sits on the
  shell needs nothing: it is bent with it. A part that animates its own matrix, or a hinge, must be a `point` (skip its
  subtree) or it is bent in the wrong frame. Bends are time-sliced (`crumpleSlices`, ~3 ms a frame, shell first, trim
  last); `m.shapeVersion` is bumped when a body is done. The hood bends relative to its hinge and buckles into a
  ridge rather than shrinking (`buckle`, half the shortening kept once sprung, then lifted 17-25 degrees off the latch);
  bumpers keep only the hanging droop as a pose (turned about the attached bracket, never below the road); wheels move
  with the arches in x and across, never up. A sprung door is cut from the pristine shell's side by rays
  (`doorPanelGeometries`: curve and UVs, so paint and liveries carry on; skin, dark trim and edges, 2 draw calls) and its
  opening is a dark panel flush with the side; both bend with the crumple (the door in its closed place, relative to its
  hinge). A rollover landing on its roof or a side (falls-vehicles.js `cliffFaceDown`) records a dent on that face (`nz`
  -1 for the roof).
- VEHICLE MARKS (damage3d-marks.js): a hole, star or scrape is pinned to the triangle a ray along the round's line met
  (barycentric anchor), so it rides crumples, hinges and pristine-merge splits; holes never on glass or the cabin seen
  through it, stars only on their pane, and a hole only where the panel holds its whole ring (`markCovered`: else the ray
  goes on to the panel behind a mirror or a trim edge); a mark with no surface is not drawn. The decal is posed on
  the part's own smooth normal there (re-made where a crumple moved it), facing out the way it faced the round. A hole in the side's metal where a door
  later springs moves onto the door's skin (`markOntoDoor`, by the door's grid `DOOR_GRID`). Chase view sizes are real (a hole ~12 cm
  decal), the street view keeps the large readable ones. `bulletHitVehicle` draws holes off the glasshouse under the
  belt line (`z` for the hit rules is unchanged).
- Console: `dentVehicle(id, side, kmh, offset)`, `shootVehicle(id, side, rounds)`, `crumpleAudit(id)` (field limits
  on a box hull, works without WebGL) and `vehicleDamageShape(id)` (parts bent or missed, shell crossed / into cabin /
  flipped faces, each mark's part and gap to the surface in cm); tools/tests/vehicle-damage-shape.mjs.
