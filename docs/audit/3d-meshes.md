# Audit report: 3D mesh fragments

Automated review pass over garage3d, landmarks3d, civic3d, air-cover3d, renewal3d,
sports3d, transit3d, ecology3d, county3d, harbor3d, helicopter3d, vehicles3d, plane3d.

## Fixed
- plane3d.js: plane wheels were pre-rotated meshes pushed directly into `wheels`, so the
  per-frame axle spin (`rotation.z`) wobbled them like coins. Each tyre now sits in a pivot
  group, matching the car wheel convention.
- civic3d.js: per-frame `new Three.Color` allocation hoisted; constant neon tint moved to build time.
- harbor3d.js: per-frame object/array allocations in `updateTrafficVisuals` and four `Vector3`
  allocations per frame in the helicopter searchlight code replaced by closure scratch objects.

## Noted, not changed
- air-cover3d.js / transit3d.js: faded tunnel roofs and rail decks keep `transparent = true`
  and still cast full shadows while nearly invisible.
- civic3d.js: `renderBadge` DOM text written every frame.
- ecology3d.js: per-frame filter/sort/Set allocation in wildlife culling.
- county3d.js: unused `fenceMat`; tank road wheels never spin (hidden by skirts).
- vehicles3d.js: unused `fairing`; bicycle spokes attached to body, not wheel.
- Any material used only by dynamically pruned models is disposed on prune and re-uploaded.
