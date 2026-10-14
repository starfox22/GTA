# Vehicle, mission and performance review

Review of approved main **`bde9ee4` (Claude artifact version 65)**. All work continues
on the permanent GitHub branch **`codex/chase-clouds-polish-2026-10-12`**, as the owner
requested. Main is not changed. This report distinguishes production-function tests,
staged browser regressions, normal mission attempts and rendered screenshots.

## Changes

### Vehicles

- **M4 wheel orbit:** the downloaded wheel parts contained fixed running gear as well
  as the tyres. That polluted their bounding-box centres: rear rolling pivots were
  about 35.5 cm ahead of the actual tyre centres. Recover the dominant circular tyre
  component, retain coaxial hub nuts, move fixed parts into the body, and roll around
  the measured centres/radii. Preserve every original triangle and the rest pose.
- **M4 appearance and lamps:** reuse its existing licensed HMMWV mesh/atlas, retain
  the intact unclustered near body, use matte coated-body/canvas and tyre finishes,
  and reassign 156 original glass/lens triangles to working head/tail lights. No
  replacement model or new texture pack is claimed. Four small damageable lamp
  draws are added; each tyre/hub still draws once.
  Lamp bounds follow only their submitted indices while retaining shared buffers,
  so small lights can be culled at their actual size in distant chase views.
  A rendered prototype exposed always-lit parked lenses; final lenses follow the
  game's day/night, driving, brake, damage and repair states with a shared palette.
- **M4/M35 animation:** fronts follow physics steering; tyre roll follows radius,
  lock, reverse and rear wheelspin. The far M4 body uses hysteresis and is never
  substituted for the player's own vehicle.
- **Motorcycle rolling axes:** correct the cruiser/KR 500's measured source axles
  while preserving the source wheel meshes at rest. Remove double animation, follow
  smoothed steering and signed tyre speed, and keep front flat-tyre squash/lowering
  in an upright axle frame instead of the raked fork frame.
- **Motorcycle rider fit:** measured paired rubber-grip contacts replace the CB750
  mirror hints and cruiser rear-grab-bar hints. Detailed and cached coarse hands use
  the actual asymmetric grips; detailed hands follow steering. Chassis terrain tilt
  is applied before riders/occupants are attached. KR retains its authored grip;
  [rider proof and remaining source/arm limits](motorcycle-rider-review.md).
- **Motorcycle contacts and damage:** mud/spray uses measured body-space tyre
  positions/widths; low side bullets can puncture their tyres (previously unreachable
  behind the car glass-band guard). Either side flag affects the same physical tyre,
  with two-tyre handling rather than duplicate counts or contradictory side pull.
  Repairing a burnt special vehicle restores its hidden tyres.

### Missions and input

- Job setup/retry preserves wounded/dead ambient Harbor Kings and their positions.
  Depot cleanup removes delivered/job vehicles while preserving ordinary/owned
  vehicles and their crews. Harbor, Rush Hour, Repo and Manifest deliveries carry an
  explicit cleanup tag. Rooftop-job limo replenishment respects occupied/owned bays.
- A Harbor call answered during an existing pursuit retains its police, bullets,
  wanted heat and ordinary harbor pursuit rules. Cargo dispatch adds to that chase.
- Police cannot deploy through the sealed depot wall, including SWAT rear exits;
  genuine inside crews and normal open-shutter entry retain their behavior.
- A stuck rooftop ambulance may recover only with both endpoints offscreen. Trying
  the watched glass cannot reduce an already higher suspicion meter. Tito's patrol
  goal moves clear of the DJ cover's walking margin so his route can run.
- Mission 3 restores borrowed free-roam carrier flags before generic job cleanup.
- Mission 4 clearly fails/retries a destroyed unopened Kessler trunk or blown cover
  before papers; later Kessler death cannot regress a job after the bag was taken.
- The CIRRUS meeting refreshes its HUD for changed coordinates/height/instructions,
  avoiding a refresh every frame for a newly allocated but unchanged target snapshot.
- Records-office and skyline elevator entry release held aiming as well as firing
  and movement. FPS remains **on by default**, preserving an explicit saved opt-out.

### Efficiency and developer handoff

- Nearby crowd queries use a dense mirror without changing Map ownership, visitor
  order, range or caps. A 120-query host batch uses 182 rather than 4,581 Map lookups.
- The 120 Hz collision pass reads current moving gate pieces instead of copying the
  fort's fixed sight solids for each nearby vehicle; gate contact records are reused.
- Military body/lens/wheel geometry is cached per model/design length. Repeat patrol
  spawns reuse buffers with independent pivots and per-car damage materials. Material
  finish/soot programs prewarm; wheels retain one draw each.
- Added production-function regressions and repeatable audit tools. The converter
  writes measured motorcycle axle and paired-grip hints on future full-pack rebuilds;
  `vehicle_wheel_metadata.py` can apply them without the absent original downloads.
  The packed **5,177,624-byte geometry payload and atlas are unchanged**; the header
  grows 392 bytes after axle and paired-grip metadata updates. Credits and area contracts
  are updated, oversized campaign/HUD documentation is split, and `tools/test.mjs --exact` supports disjoint test shards.

## Performance evidence

The controlled comparison changes **only** `crowd-space.js` and `physics-step.js` in
the frozen baseline HTML. It excludes gameplay/vehicle changes, so their intentional
behavior differences cannot contaminate the optimization comparison.

- Seed 1, order ABBA, two samples per build per tier, six scenes (walk, drive, county,
  pursuit, fort, fort chase), LOW and ULTRA: **48 equal recorded state hashes across
  21,600 stepped frames**; zero console errors.
- Production-function reference checks compare 31,684 ordered visitor lists, 240
  encounter-order frames and 4,360 ordered current gate contacts.
- Six alternating host query/build samples: median 724 → 522 ms for those kernels.
- Sampled positive heap growth per stepped frame: LOW 576.6 → 536.8 KB; ULTRA 581.2 →
  538.1 KB. These are sampled heap deltas, not a complete allocation profiler.
- Full-frame CPU medians were mixed: LOW drive 10.0 → 10.3 ms; ULTRA fort chase 6.9 →
  8.4 ms. Cold setup, JIT, GC and another QA browser affect the shared machine.
  The count reductions establish less work; this does **not** establish a blanket
  full-game speedup, presented FPS or M4 Max GPU performance.

Human-readable performance tables have trailing padding stripped; all values and raw
JSON results are unchanged. Runs and all stage/sample values: [LOW](performance-low-ab.json),
[ULTRA](performance-ultra-ab.json), [summary and limitations](performance-ab-summary.json),
[host reference audit](performance-kernels-host.json).

## Validation record

The complete 208-test regression set ran in two disjoint 104-test shards against the
frozen full candidate. The original runs recorded **182 passed, 18 expected no-WebGL
skips and eight failures**. All eight have passing focused rechecks after isolating
shared-world fixtures, respecting actual game time, covering the new material pool,
and correcting the console-only uphill pilot. Cumulative coverage is **190 passed,
18 skipped, no unresolved regression failure**; the entire suite was not rerun.
One later rider regression adds **102 passing host assertions**, giving 209 modules
with cumulative coverage of **191 passed and 18 skipped**. Its exact baseline-source
and frame-order failures are retained separately.
The original and unsuccessful intermediate receipts are retained, rather than replaced.

- [Shard 1 explanation](suite1-review.md), [machine-readable totals](suite1-regression-summary.json),
  [shard 2 explanations](mission-and-camera-fixtures.md) and exact shard manifests.
- New host regressions execute actual production functions: M4 partition 31,289,
  military rig/lamp states 468, modal input 8, motorcycles 70 plus 121 damage/handling,
  mission world continuity 69, mission 3/4 lifecycle 30 and rider/terrain attachment
  102 assertions.
- [Frozen source/asset hashes](candidate-inputs.json) distinguish baseline, original
  suite candidate, intermediate render prototype, controlled performance candidate,
  final vehicle/render candidate and final publication build. Publication adds the
  corrected actual held-aim entry field, measured rider contacts/steering and chassis
  attachment order; [baseline/current modal receipt](modal-input-host.json)
  records its two reproduced failures and eight passing current assertions. Packed
  geometry and atlas hashes remain intact.
- Normal attempts, fixtures and failures are documented separately in
  [missions 1–2](mission12-review.md) and [missions 3–4](mission34-review.md).
  They do not establish four continuous normal-input wins. Staged route regressions
  passed, but human completion and difficulty acceptance are still required.
- The final source package passes ZIP CRC validation; [entry sizes and hash](package-check.json).

### Rendered and package checks

- M4 original-main and updated vehicle candidate were captured with identical camera,
  clock and movement/burn/repair fixtures. The updated military candidate passed
  LOW, MEDIUM, HIGH, ULTRA and AUTO in both street/chase cameras, actual worn-wheel
  finish/soot shaders and driven night lamps: **zero console errors, frame faults or
  GPU context losses**. [Before](m4-render-before.json), [after](m4-render-after.json).
- The publication runtime package passed actual rendered smoke: default FPS visible,
  real-key walking **16 units**, real-key driving **24 units**, map open/close and
  both camera switches. **Zero errors**, one inherited Three.js deprecation warning.
  [Summary](smoke-final-summary.json), [full receipt](smoke-final.json).
  The final ZIP adds a 311-byte plain-text asset-credit annotation. Its game JS and
  every media/README byte are identical to that smoke-tested package;
  [exact isolated delta](publication-credit-delta.json).
- All **nine streamed music tracks** reached `canplay`. Final-package track bytes
  match the verified media check exactly. [Receipt](media-check.json).
- Every original model and geometry byte is retained: **23 models**, original
  5,177,624-byte payload, unchanged atlas; only documented grip/axle fields differ.
  [Independent full-pack/header comparison](vehicle-pack-preservation.json).
- The final runtime build passed **18 motorcycle render stages across three models**,
  including actual rolling/steering, burning and repair: zero console errors, frame faults
  or GPU context losses. Both tyre draws return after repair; the KR 500 real side-shot
  stage records an actual front puncture. CB750/cruiser two-shot stages are body hits.
  [Before](motorcycle-render-before.json), [after](motorcycle-render-after.json).
- A matching forty-shot chase-view CB750 check leaves baseline tyres intact and
  actually punctures both updated tyres: zero errors/faults/context losses.
  [Before](motorcycle-puncture-render-before.json), [after](motorcycle-puncture-render-after.json).
- [Real before/after gallery](SCREENSHOTS.md) and [all image hashes/inputs](screenshot-inputs.json).
  Images are native browser captures/crops, never generated or retouched.

[Exact cumulative regression coverage](verification-summary.json) separates the full
original run, focused fixes, late rider host and rendered checks. The final vehicle
candidate precedes the narrow modal/rider/chassis-order fixes. The final runtime is
separately hashed and smoke-tested; the publication credits-only delta is independently
verified. No continuous normal-input mission win
or real-device GPU frame rate is inferred from these checks.

## Next work toward AAA quality

1. Real-device acceptance on M4 Max and representative integrated-GPU laptops, every
   preset and camera, live traffic/combat/rain; include Safari/WebKit and device DPR.
   Follow [the hardware profiling recipe](../laptop-profiling.md).
2. Author-approved licensed period vehicle assets with coherent PBR textures,
   interiors, damage panels and several LODs, reviewed in both cameras before import.
   Validate seats/drive-by, tyre contacts, doors and destruction together.
3. Human playtesting of all four complete missions, quiet/combat paths, saves/retries
   and difficulty; improve checkpoints/readability where evidence warrants it.
4. Stronger animation/IK and consistent environmental art, lighting, material density,
   sound mixing and crowd reactions; maintain preset budgets while improving them.

AAA/GTA parity and production readiness require this broader art, content, hardware
and human acceptance work. This review reports the fixes and tested coverage, without
certifying the whole game or predicting unmeasured laptop frame rates.

## Continuing with Claude

Fetch and merge **`origin/codex/chase-clouds-polish-2026-10-12`** into Claude's current
working branch; preserve newer Claude work when resolving overlaps. Read `CLAUDE.md`,
`docs/HANDOFF.md` and the affected area docs, regenerate `docs/FILEMAP.md`, rerun the suite and rendered
checks, then review the combined build. Only the owner can authorize moving main.
Future Codex requests keep updating this same permanent branch.
