# Military combat, Apache and bazooka review — October 20, 2026

Work and publication are confined to `codex-reviews`. Baseline is the previously
published `f350b4beed341d15c26aedd6976489346bac5bf9`; this review preserves its
airport, flight, parachute, mission, road vehicle and rider changes.

[Play](https://starfox22.github.io/GTA/?review=c06dcb00f91c27a15) ·
[Native screenshot gallery](https://starfox22.github.io/GTA/review/?review=c06dcb00f91c27a15).

## Result

- A downloaded Andrew Swihart AH-64 replaces the procedural Apache. Its near
  geometry retains 220,711 original aircraft triangles, exact split normals, UVs
  and source PBR factors. Rotor, tail rotor, gun, recoil and expendable stores
  are articulated at measured source pivots. Separate far/shadow meshes, shared
  resources and exact-triangle BVH ray queries bound rendering and damage cost.
- Q selects 30 mm cannon, 70 mm rocket pods, Hellfire anti-armour or Stinger air
  missiles. Each has finite stock, cooldown, actual HUD state and pad rearming.
  Guided stores require acquisition and line of sight; finite-rate guidance
  retains the common swept collision, armour, explosion and crime paths.
  Settings exposes the remappable aircraft action independently of personal
  weapon cycling; touch and gamepad equivalents are present.
- Polyte’s downloaded RPG-7 replaces the held bazooka. All 3,500 authored near
  faces and six source PBR materials remain. Both closed fists fit the measured
  wooden grips, with the existing shoulder, recoil and reload rig. Two shared
  instanced LOD batches serve all holders. Damage/ammo/projectile spawn rules
  remain in their existing gameplay paths.
- Vehicle stain fitting/painting shares one fixed 3 ms cooperative allowance
  per rendered frame. A long frame previously reopened that budget repeatedly.
  Large probes, grids and coverage searches now yield within the job rather
  than monopolizing a slice. Private fit scratch makes interleaving safe.
- Ordinary combat HUD refreshes reuse unchanged weapon artwork. Smoke/fire
  billboard geometry skips proven transparent borders and empty atlas samples
  skip depth/lighting work, retaining counts, lifetime and full resolution.

## Asset provenance and limitations

Both models were downloaded from pinned, licence-preserving GitHub mirrors
allowed by the environment. The original Sketchfab URLs and authors remain
credited; direct Sketchfab access was unavailable. Both exports explicitly use
CC BY 4.0, and neither authors texture images. Their original materials are
retained; screenshots are the actual game output, not asset renders.

[Apache source/download/conversion](../../sources/apache/README.md),
[Apache armament](../../areas/police-and-combat-apache.md),
[RPG source/fit](../../areas/people-and-crowd-launcher.md),
[combat budgets](../../areas/rendering-combat-budget.md),
[effect footprint proof](../../areas/rendering-effects-footprint.md) and
[third-party credits](../../THIRD_PARTY_CREDITS.txt) describe the contracts.
The Apache source has an opaque canopy and no cockpit interior or authored
skeletal animations. Added wingtip air-defense stores are disclosed adaptations.
The RPG source is intentionally named “Low Poly RPG-7”; no claim of scanned or
photoreal texture detail is made.

## Frozen source and host verification

`verification/source-freeze.json` pins the final 658 source/asset inputs. Monolith
SHA-256 is `c14ca0aed95ef2dce45519f5c4e354fa6e17d001f230db2f1861a270a79f5f21`;
expanded JavaScript `1a83a936cab3cf0786f282a5308181e439b22ec465c65a599924ab00abdd701a`;
split entry `c06dcb00f91c27a15c2d82d904cc7e22c80139bfcd3a5e1d44393304e16b319b`.

`integration-source-freeze.json` retains the first integration artifact:
monolith `e73c7022c2659d1690b3de2a884d575f2e228d78437c1930c41e9b305051f968`,
split entry `fab0170d1ca670a39fa348649870f904d66e5cbb99b1f59632898d6d088c3189`.
Its performance replay and original native action images remain labelled with
that identity. Final screenshot review exposed clipped missile-status text:
the final artifact adds an Apache-only chip class and wrapping CSS for its name,
ammunition and readiness. `final-source-equivalence.json` confirms all other
656 inputs, including gameplay, controls, model packs and performance modules,
are byte-identical. Final rendered smoke and split/HUD checks use the final
artifact; initial source/model/action captures retain their exact provenance.

`verification/regressions.log` records 14/14 focused modules passing, zero
skips/failures, against the immutable integration monolith. It covers Apache assets/weapons,
RPG, shared bullet armour, mounted guns, existing military marks/rig, chase input,
rider bindings, combat continuity, HUD cache and blood/particle performance.
This is a selected regression set, not a claim that every historical suite passed.

Host receipts separately record Apache weapons 524, Apache assets 149, RPG 18,616,
HUD 51, frame budget 14, fitting 56, particle footprint 808 and rider bindings 61
assertions. The fitting proof compares exact position/normal/UV/blood bytes,
layouts and range order for four baseline fixtures including the actual Hum-4,
plus 6,097 interleaved suspensions. The particle proof enumerates 2,132,340 complete
filtered alpha-support boxes including mip/filter and neighboring glass cases.
The HUD fixture retains exact icon command traces while avoiding redraws.

An independent review found and fixed one migration bug: a legacy Fire=Q save
would also cycle the newly added aircraft action. Only the new conflicting slot
now starts unbound; saved keys and explicit aircraft bindings remain intact.
Unsafe multi-context key swaps are rejected atomically. Receipts retain the
original failing dispatch and the final actual-key host checks.

## Performance evidence

The baseline visibly stages three burning vehicles and active APC/soldier
gunfire at Fort Sentinel. The initial visible vehicle pass averaged 26.07 ms
over three sampled frames; the next six averaged 20.75 ms. Its stain scheduler
recorded a 27.1 ms slice. Profiles identify coverage fitting and canvas setup.
The frame-budget regression fails on the original scheduler’s replenishment
behavior and passes on the corrected production scheduler.

`verification/performance-replay-inputs.json` retains all 81 named baseline
requests, including the first staging attempt whose wrecks were above the
viewport. That partial view is not used as visible multi-wreck evidence.
The final replay uses the same requests and seed. Live held frames still draw,
so wall-time paint progress and render schedules need not match exactly.

Measurements come from Chromium/SwiftShader in a shared cloud environment.
Blocked GL calls and concurrent software rendering affect wall times; these
are CPU-work/geometry/render-correctness observations, not hardware FPS or
a guaranteed percentage gain. The particle area report is projected rectangle
area before clipping/depth/alpha tests. Vertex smoke-light interpolation may
change slightly at trimmed corners; filtered artwork coverage is retained.
The 3 ms allowance is cooperative, not a bound on allocation/upload/GC or total
vehicle rendering. First-use dev shader links are retained separately because
this seeded dev boot skips normal title prewarming.

## Native captures and publication

The final visible vehicle pass measured 20.17 ms/frame on first visibility
(three frames) and 11.32 ms/frame on the next six, versus baseline 26.07/20.75.
This is a small, noisy staged sample; no hardware FPS percentage is inferred.
The warm effect rectangles cover 1,707,890 projected pixels instead of 2,808,310
(about 39% omitted), still in one draw. Source counts/recipes are unchanged,
but live render sampling produces different instantaneous effect counts.
The full-history cooperative work probe still recorded a 24.8 ms slice;
allocation, GC and driver/upload stalls remain possible.

Final status, military, current-vehicle damage and hostile shot reports exactly
match the baseline replay. The aggregate hash differs:
`7f602c65683b2ad5` before, `24c1e06f13c8e960` after. It includes unrounded world
state and game-effect coordinates; the baseline lacks full component snapshots
to localize that difference. It is not claimed as a bit-identical whole-world
optimization replay. Apache collision/rotor dimensions also intentionally change
to fit the new source model. The exact host geometry/behavior contracts remain
separate evidence.

Required rendered smoke passed on both frozen artifacts, including the final
monolith: real 16-unit walk,
24-unit sedan drive, map and both camera switches, six screenshots and no errors.
The sole warning is Three’s existing deprecated bundle notice. Initial local
launch failures came from missing browser configuration/file URL policy; the
working loopback wrapper was reused and those failures retained.

All gallery PNGs are unedited game screenshots with normal HUD; inspection
staging, cameras, source pins and failed attempts are retained. The FPS chip in
profiling images includes batched stepped/CDP timing and software-driver waits
(for example 0 FPS / 43,498 ms); it does not represent an ordinary hardware run.
Native Apache checks exercised actual bound keys: held/repeated Q switches once,
fresh Q cycles all four stores, U remapping works and restoring defaults makes
U inert. Cannon consumed 320→319 and damaged a parked sedan 150→125; a four-round
rocket ripple destroyed it. Hellfire locked a fresh tank, consumed 8→7, created
a guided projectile and reduced target health 1600→1101. Stinger locked the
staged airborne utility, consumed 4→3 and destroyed it after ordinary updates.
Initial Stinger fixtures failed because the 40 m bailout is below the existing
60 m minimum and a later teleport retained on-foot altitude; those setup failures
are retained separately from the successful ground-reset fixture.

The actual Fort pad has zero hull/rotor/building/neighbor clearance contacts.
Takeoff climbed 43.8 m in five seconds under garrison fire: health 640→617 is
recorded with bullet holes and hostile shot logs, rather than called damage-free.
The RPG native rig contains one full 3,500-triangle hero launcher; physical F
consumed its round, reload returned one round and reduced reserve 8→7.

Split streamed media also passed: nine tracks reached canplay, no failures.
Final split-runtime/source/gallery checks and publication complete the release.

## Final package and HUD acceptance

Final candidate 2’s split package booted in 3D with the downloaded Apache
visible (201,272 reported triangles, one proxy shadow caster), no missing
requests, browser errors, GPU loss or frame faults. Four physical Q modes,
actual target lock, F launch/ammo/cooldown and ordinary class removal on exit
passed. Desktop 960×600 compact/expanded SEEK TARGET, LOCKING and WAIT text
and long names fit measured scroll, button and viewport bounds.

The optional portrait probe is **not a complete pass**: one compact sample
immediately after resizing extended beyond the viewport; a later Apache sample
fit, while the existing expanded on-foot pistol also overflowed. The receipt
retains `requiredScopePassed: true` for desktop and
`globalAllLayoutsPassed: false`, plus the raw measurements. No full portrait
acceptance is claimed. The optional portrait PNG remains in the audit and is
not used as an accepted gallery comparison.

The final smoke on candidate 2 passed again. The source-equivalence receipt,
final native DOM measurements and native PNG checks precede the branch-only
publication. The deployment workflow rebuilds this source, builds all historical
galleries and verifies every publicly served file against its local SHA-256.
