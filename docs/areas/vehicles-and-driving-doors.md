# Vehicle doors and visible cabins

`vehicle-doors3d.js` builds the actual opening in a car body. `damage3d-bodies.js`
owns the shared door builder and damage states; `carjack3d.js` poses the same door
for player entry/exit, carjacking and the named review action. Door animation reads
game state and does not change boarding rules, colliders or occupant size.

## Source ownership and openings

- Opening a downloaded or procedural front door removes its closed skin, trim and
  front window from the fixed body. The opening contains no flush upholstery panel
  or engine-bay slab. Existing authored cabin geometry, or the model's existing
  seats/dashboard fallback, is visible through the opening.
- For models without separated source doors, `vehicleDoorPartition` subtracts a
  bounded front-door volume from the immutable close geometry and returns the
  extracted surface as the moving door. The volume follows the front shut-line
  span, sill, roof and exterior side band; inboard seats and dashboard remain.
  Original vertex IDs form an unchanged prefix. New edge intersections interpolate
  every attribute, including source/repeated UVs, atlas rectangles, vertex finish,
  colour and police livery UVs. Material groups also survive.
- Partitions are cached by source geometry and cut. Transformed moving geometry
  is cached by partition, body matrix and hinge; vehicles share pristine geometry
  while keeping separate transform nodes. Deformed geometry is never shared.
- A car with `kit.nativeDoors` uses exact `vehiclePartRanges`, not an approximate
  cut. The C8's authored left/right paint, trim, card, glass, mirror optics and
  indicator layers belong to their source doors exactly once. The closed role
  aliases and opening/body variants retain the same source ownership.
- C8 hinges use the original author-parent positions and normalized source axis.
  Other bodies measure the hinge's exterior depth from their actual side surface.
  Native door cards remain source geometry; other models use a thin inner trim
  card attached to the moving door, never a wall across the opening.
- C8 driver and passenger poses use separately measured authored cushions. A
  downward source-geometry probe checks their contact, while the ordinary headroom
  solver fits real character heads above that physical lower bound. The passenger
  cushion is higher and slightly further back; mirroring the driver's hip would
  put the passenger inside it. Actors and source chairs keep their original size.

## Glass, detail and animation

- Only the front window surface travels with a generic door. Its body's remaining
  rear-quarter pane stays drawn. Native panes and mirror optical covers travel by
  exact source-part membership. Lowered or shattered windows remain absent.
- Moving glass retains source maps and shader patches. A cached DoubleSide,
  `forceSinglePass` material permits inspection from inside without a second
  transparent pass. There is no whole-body culling workaround.
- `vehicleDoorShown` and `vehicleDoorPose` control every moving layer together.
  Entry, exit, a forced swing and sprung/torn damage share the same builder. Both
  front doors can open independently. A torn door leaves a real opening; closing
  restores the original fixed source variant, and repair restores its shape.
- The first opening splits an existing pristine merge and restores approved close
  parts before making the cut. `doorBodyMask` pins approved models to close LOD
  while an opening is active, including an NPC's first opening from far LOD.
- The player's exit crouch plants both shoes through the existing leg-target IK;
  source-mesh tests and its floor allowance are in `vehicles-and-driving-door-transitions.md`.

## Damage, marks and repair

`crumpleCollect` treats existing door pivots as moving points and adopts their
layers as hinged parts, so opening before the first crash does not bend a door in
the body's frame. Body variants keep original vertex prefixes; switching a bent
car between open and closed copies those positions immediately and reconstructs
new cut-edge positions barycentrically. The normal time-sliced crumple pass then
updates the new boundary without a pristine-body flash.

`vehicleSourceFaces` and `vehicleDoorOrigins` retain source-triangle and edge
provenance. `markOntoDoor` moves a real body bullet anchor to the extracted door
and back on closure, including clipped-edge anchors. Native doors use exact source
vertex membership. Exterior mark rays continue to reject interior seats and
cards. Closing restores the original source variant. Repair restores source
positions, materials, glass and ordinary LOD eligibility; the existing crumple
system may retain an owned geometry clone with all positions reset to that source.
The report's direct geometry-reference flags truthfully distinguish that clone
from the shared kit geometry.

When a first door is created after its body has already burnt, its source layers
inherit the body's live char material. `assetCharAdopt` records the original
material behind that shared char reference immediately. Repair can then restore
the door's source maps/flags even if the door did not exist when the body was first
swapped. It does not add a shader variant, change geometry or flash clean paint.

## Review and regression tools

`DeadEndCity.doorSwing(id, open = true, side = -1)` exercises the existing swing
state; side `1` selects the passenger door. `DeadEndCity.vehicleDoors(id)` is a
read-only renderer report: active mask, native hinge/axis/pose, source-part names,
moving-layer visibility/triangle counts, window state and cabin availability. Its
material/map UUID snapshots and closed-source geometry flags allow a repair review
to compare actual references without accessing Three.js objects. The separate
`sourceGeometryRestored` flags compare every source attribute, index and material
group, accepting an equivalent owned clone. It
does not expose mutable models. Real player entry and exit still use `interact()`.

`tools/tests/approved-suv-rigs.mjs` loads the actual packed geometry and production
builders. It tests Jimny, both Comrade SUVs, Sheriff, legacy sedan/coupe/Crown Vic
and native C8. Closed-body rays must hit; open-aperture rays must miss exterior
geometry and reach genuine source/fitted interior. It also exercises production
entry/exit, both doors, windows, source attributes, shared caches, marks, actual
time-sliced dents, torn doors and repair. C8 uses the original hinge and card
layers rather than a procedural substitute. The C8 cushion probes also check both
source seats and the actual production occupant function's hip/foot/lean dispatch.
Report snapshot arrays must not permit mutation of source hinge/part metadata.
Counts and exact input hashes belong
in the dated audit receipt because asset/provider changes can alter the count.

`tools/vehicle-door-render-review.mjs FROZEN_HTML OUT_DIR LABEL [--after]` records
native WebGL crops with a seeded Southport mid-runway fixture at [418,6000] and
named review actions. Parked review cars move down the runway outside the portrait.
Each photograph verifies its actual vehicle ID/type/coordinates/heading. The
receipt records the actual HTML hash, camera and model/door reports for each shot.
It captures closed front/chase, open driver/passenger doors, actual entry/exit,
Jimny and legacy sedan openings. The original build lacks a passenger-side action;
the before receipt says so instead of inventing an image. After captures also
record all ten street/chase graphics presets, 2048/4096 atlas changes, source asset
identity and occupant headroom, plus renderer faults/context losses. These
software-GPU checks do not establish laptop frame rate.
