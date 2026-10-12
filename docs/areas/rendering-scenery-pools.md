# Rendering: immutable rooftop pools

`scenery-pools3d.js` partitions the city-wide rooftop equipment pools after all scenery
builders and `cellStatics()` finish. Previously their `frustumCulled = false` caused every
instance to be submitted even when the camera saw only one neighbourhood. Only the solar-panel pool currently opts in: the
measured LOW street case removes 169 of 199 panels without adding a draw. Other immutable
equipment can opt in after demonstrating a gain.
Pools below 128 instances or occupying one cell keep their existing draw.

## Contract

- Only immutable scenery: no breakable furniture, linked street props, animated objects,
  instance colours or morph targets. Source instance indices remain authoritative.
  The selected pools use ordinary Object3D transforms; layers, caster/receiver flags
  and custom depth/distance materials must also stay fixed after construction.
- Geometry and materials are shared. Each populated 2048-unit map cell receives exact
  Float32 copies of its source matrices and its own computed bounding box/sphere.
- The intact source pool is retained. Close street/chase views with shadows off use chunks only when the
  main frustum sees at most one chunk and fewer than half the source instances.
  Presets with shadows enabled, wide street views (`viewZoom < 0.6`), flight views and
  unprofitable views use the original
  single draw. The selection scans the small chunk lists without per-frame allocations.
- Three performs the actual frustum test independently for the main camera and each
  shadow camera. **Never set a chunk's visibility from the main frustum**: an off-camera
  rooftop can still cast a visible shadow. Shadowed presets currently use the intact
  original, since budgeting both sun and searchlight frusta would need a separate policy.
- Only the chunks sit under a `cellContainer` parent, bypassing the chase prop size
  budget. The intact source retains the original chase/shadow rules. These are exact
  spatial bounds, with no new distance or visual-detail threshold.
- Source matrix/version/count, geometry, material or transform changes permanently
  disable that family's chunks and restore the current original. Add a dedicated update
  path before making any of these pools dynamic; do not silently update stale copies.
- Chunk and intact fallback buffers join the existing incremental title upload prewarm. Geometry,
  material and shader variants are shared; matrix storage grows by 64 bytes per copied
  instance. The console report exposes that memory cost.

## Checks and measurement

`tools/tests/scenery-pools.mjs` uses the shipped Three implementation. Its 1,024-instance,
64-cell fixture checks exact matrix preservation, conservative camera bounds over 24
view orientations, an off-camera shadow caster, a 1,024-to-16-instance close view at the
same single draw, shadowed/wide/flight fallbacks, A/B switching and authoritative-source mutation.
This fixture is an operation-count regression, not a game or GPU FPS benchmark.

`DeadEndCity.sceneryPools(false)` restores the original pools and `true` enables automatic
partitioning again. The report's `view*Bound` fields are geometric camera-pass bounds,
before layers/visibility; use `stats()` and `drawProfile()` for actual calls/triangles.
Compare both passes and rendered images in the same held scene, then use the repeatable
[laptop procedure](../audit/laptop-profiling.md) for timing on real hardware. The initial four-chunk trial added
32 calls for a 5.7% triangle reduction in one HIGH close view; it was rejected. The final
policy permits no extra draws and optimizes only with shadows off. Chunk traversal still
has a CPU cost; real-device timing remains necessary.

Seeded, held 960×600 Royal Avenue A/B (software GL; measured work, not hardware FPS):

| Case | Camera calls off → on | Shadow calls off → on | Triangles off → on |
| --- | --- | --- | --- |
| LOW street | 131 → 131 | 0 → 0 | 811,126 → 809,098 |
| LOW chase (yaw 0°, pitch 9°) | 389 → 389 | 0 → 0 | 884,833 → 884,833 |
| HIGH street | 131 → 131 | 149 → 149 | 1,463,640 → 1,463,640 |
| ULTRA chase (yaw 0°, pitch 9°) | 787 → 787 | 364 → 364 | 2,728,088 → 2,728,088 |

Only solar split in these cases (199 → 30 instances in LOW street), so the live opt-in was
narrowed from six eligible families to solar: **8 chunks, 12,736 extra matrix bytes**.
The 2,028-triangle saving is 0.25% of the measured full frame, not a broad FPS improvement.
Street pairs were pixel-identical outside the FPS text. Chase pairs retained identical
scenery below y=200; their sky's temporal history continued converging above it. All pairs
retained the same simulation hash. See [the measured report](../audit/chase-polish-2026-10-12/rooftop-review.json).
