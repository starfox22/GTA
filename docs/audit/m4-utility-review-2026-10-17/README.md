# Military M4 Utility: damage performance and round wheels

This review continues `codex-reviews` and addresses the slowdown when stealing
the military M4 Utility at Fort Sentinel and the oval appearance of its wheels.

## Diagnosis

The previous published game is `db8bbd90`. Its immutable monolithic HTML has
SHA-256 `c3200fc63508a789867d7ff8617c7f5c2a79c4dc703529f8ac69002372cd579d`.
The simulation-only comparison stages ordinary driving, calm undercover base
entry, boarding the actual parked military M4, and the resulting alarm. Boarding
raises five stars and retains the garrison response. CPU cost stays near the
calm-base simulation cost; it does not explain the severe rendered slowdown.
The [triage receipt](verification/simulation-triage-before.json) retains stage
states and per-section profiles. The adjacent `simulation-triage.mjs` is the
exact recorder run from `work/m4-utility/`; its relative import and output path
refer to that original working location.

The production renderer's bullet-mark placement does explain a severe CPU
stall. A hole must find its actual body triangle and check the surface beneath
its complete ring. The old path repeatedly raycasts every triangle of the
near M4 body. Twelve side holes required 706 mesh rays and 7,353,709 triangle
checks, costing 645.343 ms of host CPU in the initial probe. Rechecking those
holes after another damage version cost 242.764 ms per draw in an eight-draw
fixture. These are isolated CPU measurements, not hardware frame-rate claims.

The fix caches a triangle hierarchy and conservative triangle bounds for the
immutable military body meshes. It selects possible original faces, restores
their original order, and lets the shipped Three.js perform the same triangle
intersection, normal/UV interpolation and distance filtering. It retains source
face IDs and the exact damage anchors/ring decisions. The original body buffers
are still drawn. Trees are shared across vehicle instances and built alongside
their model kits; changed geometry and unsupported paths use vanilla raycasts.
Body detail, damage effects, population and graphics settings are preserved.

## Wheel geometry

The recovered M4 axle centres were already stable, but the source tread itself
was slightly elliptical: roughly 857.7 mm wide by 868.2 mm tall, with about
5.3 mm of radial variation. A bounded, measured correction circularizes the
rolling tyre and rim when the shared kit is built. Authored split normals
follow the inverse-transpose transform. Source triangle ownership, UVs and
stationary running gear remain intact.

The final review found the stronger oval under puncture: the old damage path
compressed the whole wheel by 18%, including the metal rim. The M4 now keeps its
rim and bead rigid while rubber pressure deformation is evaluated outside wheel
spin. A shared radial profile fades deformation between 0.56 and 0.98 of the
source radius; authored normals follow its analytic inverse-transpose Jacobian.
A punctured wheel owns one private geometry, reused as it rolls and disposed on
repair or burn restoration. Cached source geometry remains immutable. This adds
no draw call or shader variant. Tyre damage and handling still use the existing
gameplay state.

The [wheel audit](../m4-wheel-shape-2026-10-17/README.md) records the source
measurement and fitted transform. Its initial flat test removed the whole-wheel
squash before checking bands; that check alone did not prove a round punctured
metal rim. The later puncture regression checks the metal directly in world
space, without cancelling a squash transform.

## Verification and native evidence

The opt-in `fortM4` stage in `tools/hitches.mjs` boards the actual parked base
vehicle and runs through the alarm, incoming fire and driving. It provides a
reproducible scenario for seeded before/after state hashes and frame counters.
The [baseline](verification/base-boarding-before.json) retains 492 simulation
frames and state hash `ee6a0099e4ffdff9`.

Frozen release source is `2e157d76cc16a060d530a9d00534618f6b803844`.
The monolithic HTML SHA-256 is
`c1f293d6e0f7e0eb2a81f3ebd09e268d7a038b4830de5f660b9e5cff66efe764`;
the split entry SHA-256 is
`a81ed60dc1a5154c1224fa92fde45481882c0a4b87e7b16f2c3f8f9df559db70`.
[Frozen build inputs](verification/frozen-build.json) retain byte counts and
recorder hashes.

Five production-host modules pass **54,660 assertions**: source ownership and
wheel fit, actual world-space rolling bands, the packed military rig,
rubber-only puncture/lifecycle checks, and exact military ray/mark parity.
See [integrated host results](verification/integrated-host.json). A separate
replay of the independent 2,400-ray test also matches vanilla Three exactly,
including short rays, oblique directions, shear and negative/nonuniform scale:
[independent result](verification/independent-ray-review.json).

The punctured metal rings' worst radial spread is **0.149 mm**, measured without
dividing away a squash transform. Finite differences independently verify the
smooth transition's normals. Across 1,000 warmed updates with all four tyres
flat, private geometry and buffers stay stable with zero new geometries; host
elapsed update time has a 0.134 ms median and 0.174 ms p95 in this run. Those
elapsed samples are isolated updater measurements, not game frame rates.

The reproducible CPU benchmark uses the release geometry with vanilla and
accelerated raycasts. Each row retains the same 12 actual bullet-hit anchors.
The repeated row advances damage version on every draw, as further hits do.

| Case | Vanilla CPU ms/draw | Cached lookup CPU ms/draw | Triangle tests before → after |
| --- | ---: | ---: | ---: |
| First 12 production holes | 676.786 | 110.652 | 7,680,615 → 9,858 |
| Existing 12 holes after further damage | 244.058 | 22.414 | 2,871,936 → 1,044 |

The latter is **99.964% fewer triangle tests**. Cached unchanged frames cast no
rays in both paths. Full [baseline](verification/marks-baseline.json) and
[accelerated](verification/marks-accelerated.json) receipts include source
hashes, build costs and memory. The M4 near-body tree holds 1,131,196 bytes of
typed data plus nodes, shared by all instances of that kit. Building it adds
one-time model setup work; it does not rebuild per shot or per vehicle.

The final LOW rendered recorder also confirms the cost reduction:

| Rendered case | Previous maximum damage pass | Final maximum damage pass |
| --- | ---: | ---: |
| Twelve new side holes | 874.8 ms | 45.5 ms |
| Actual five-star M4 under base return fire | 205.8 ms | 8.0 ms |

These are **two explicitly stepped frames per stage** on software GL, useful for
attribution rather than overall FPS or target-hardware promises. Every named
input, fixture and all seven status snapshots match the original. The
controlled-hole stage retains 136 draws / 859,530 triangles. Under return fire,
both builds draw 155 calls; totals are 682,969 versus 682,968 triangles. Other
world totals vary slightly in this short live-rendered sample; their cause is
not claimed. Source-body and wheel face conservation are verified separately.
Before profiles are dominated by full-mesh triangle intersections; the final
profile replaces those with bounded broadphase tests. Exact observations:
[rendered comparison](verification/rendered-comparison.json), raw capture
receipts and `native-before/` / `native-after/` CPU profiles.

The software renderer also incurred a long first-use shader/validation stall in
the baseline return-fire submission. This patch does not change shader warming
and does not claim to eliminate GPU compilation latency.

Matched HIGH inspection captures verify intact wheels, an actual collision-induced
front-right puncture while rolling, and subsequent repair, with no frame faults,
context loss or browser errors. All named inputs, fixtures, camera and status
snapshots match. The punctured damage object differs only in the right-door
part's existing random break-off roll; this comparison does not claim complete
damage-state equality. The unchanged collision code uses `Math.random() < 0.5`
for that part, and renderer geometry UUID allocation also consumes that global
random stream. Puncture, motion and handling match; both repairs clear damage.
[HIGH comparison](verification/high-comparison.json) records the difference.
The [image manifest](verification/gallery-image-manifest.json) verifies every
selected PNG against its native recorder receipt, with no image editing.

The final split build passes [packaged smoke](verification/packaged-smoke.json):
real-key walking and driving, map, chase/street camera switching, default FPS,
and expanded readable asset Credits. Seven native screenshots and the
[console log](verification/packaged-console.log) are retained; there are zero
errors and only Three.js's existing deprecation warning. Focused vehicle-layout
and base-theft browser tests also pass, and all four seeded before/after ABBA
runs preserve each stage's state hash across 5,568 total simulation frames.

## Playable release

[Play the game](https://starfox22.github.io/GTA/?review=a81ed60dc1a5154c) ·
[Native before/after gallery](https://starfox22.github.io/GTA/review/?review=a81ed60dc1a5154c).
The gallery retains all earlier SVJ, wheelie, impact and aviation reviews.
The exact public artifact file hashes and byte counts are retained in
[the artifact manifest](verification/public-artifact-manifest.json).
[Run 39048668942](https://github.com/starfox22/GTA/actions/runs/39048668942)
successfully built and deployed publication commit `7c1da99a`, then verified all
**172 public files / 225,120,142 bytes** against the artifact. The
[successful deployment receipt](verification/successful-deployment.json) retains
actual build, gallery, deployment and public verification step results. This
receipt-only follow-up leaves game and gallery bytes unchanged.

