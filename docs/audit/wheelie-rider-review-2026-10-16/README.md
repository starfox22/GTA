# Wheelie controls, rider motion and distance achievements

This pass continues `codex-reviews` with independent rider weight controls, more coherent motorcycle posture and spills, sustained wheelie balance, and an actual distance counter with animated 100 m and 200 m achievements.

Release source commit: **TO_BE_FILLED_RELEASE_SOURCE_SHA**. Packaged entry SHA-256: **TO_BE_FILLED_PACKAGED_ENTRY_SHA256**. Playable link and deployment receipt: **TO_BE_FILLED_VERIFIED_PUBLICATION**. These fields must be completed against the final frozen release; this audit draft does not establish publication success.

## Player changes

- W accelerates and S brakes/reverses. Up shifts rider weight back; Down shifts it forward, independently of the throttle. Settings exposes both rider actions for remapping. Arrow presses while stopped or reversing cannot animate a weight shift or propel the motorcycle; the shift fades in between 3 and 8 km/h. Pad RT/LT and touch GAS/BRAKE keep separate drive controls.
- Only exact old default movement binding pairs migrate to W/S. Custom bindings remain intact. Aircraft and parachute arrow actions retain their own contexts. Settings, boarding notices, help and device hints identify the separate rider actions.
- Available engine force, the rider/bike centre of mass, rear contact and surface grip still constrain a wheelie. Holding drive and rider-back uses balance assistance toward approximately 29° on a sport bike, allowing a sustained run. The assistance cannot add power; a genuine loopout past the balance/tail limit remains possible. Rider-forward lowers the front while W can remain held. S or Space applies the actual rear brake.
- Motorcycle bank follows a damped physical roll state and controls yaw at speed. The rider adds weight shift, speed tuck and bounded corner posture while source grips and pegs remain fixed IK targets. The bike's rear axle remains the wheelie pivot, including bank and terrain angles.
- Ordinary motorcycle spills retain their release orientation. Lowsides fall onto the bike's side; loopouts release backwards from the raised chassis; over-the-bars impacts retain forward rotation. Riders brace, gather their limbs, slide and rise through a supported crouch within the existing injury/knockout wait. Player and traffic riders use the same motion system.
- The HUD measures the actual path travelled while the front wheel is clearly airborne and the rear remains in contact, in world units divided by eight. It confirms a lift for 80 ms and debounces touchdown for 120 ms, adding no ground distance during that grace period. Whole-bike jumps, stationary balance, relocation, crashes and exits cannot extend a run.
- Crossing beyond 100 m triggers **GREAT!**; beyond 200 m triggers **Amazing!**. A compact meter, distinct glow/shine/text effects and muted/settings-safe chimes mark each threshold once per run. The final landing distance remains for four gameplay seconds. Pause holds the timers; reduced-motion settings suppress animation.

## Native screenshot evidence

The recorder is [tools/wheelie-rider-render-review.mjs](../../../tools/wheelie-rider-render-review.mjs). It captures the actual 3D renderer at a 1000 × 700 viewport, High graphics, clear weather and 13:00, with seed 1 and the simulation held between explicit steps. Native PNGs retain the game viewport pixels. The recorder asserts that the renderer is 3D and checks recorded errors, GPU loss and frame faults at each capture.

The milestone run advances the real simulation with `KeyW` and the production `WheelieUp` action until measured travel crosses each threshold. It never sets the score. Its input/state receipt records distance, tier, wheelie state, renderer/model state and capture hashes. Separate browser checks exercise actual physical key bindings. The corner frame uses throttle and steering inputs. Lowside and recovery frames use the named `riderFallScene` / `riderFallAdvance` gameplay fixtures and the same shipped body solver, pose targets and root support as ordinary falls.

For legible achievement evidence, the recorder pauses the game's existing wheelie HUD CSS animations at their own **350 ms** frame using the Web Animations API. This selects a native animation instant; it does not change the physics score or replace the rendered artwork. The capture receipt marks these two images with `animationFrameMs: 350`. Runtime animation still plays normally in the game, subject to pause and reduced-motion preferences.

| Evidence | Native screenshot |
| --- | --- |
| Actual wheelie beyond 100 m; GREAT! animation | [wheelie-review-great-100m.png](screenshots/native/wheelie-review-great-100m.png) |
| Same run beyond 200 m; Amazing! animation | [wheelie-review-amazing-200m.png](screenshots/native/wheelie-review-amazing-200m.png) |
| Confirmed touchdown and final distance | [wheelie-review-landed-result.png](screenshots/native/wheelie-review-landed-result.png) |
| Physical motorcycle bank and rider corner posture | [wheelie-review-corner-lean.png](screenshots/native/wheelie-review-corner-lean.png) |
| Staged lowside release through production motion | [wheelie-review-lowside-release.png](screenshots/native/wheelie-review-lowside-release.png) |
| Same fall during supported recovery | [wheelie-review-supported-recovery.png](screenshots/native/wheelie-review-supported-recovery.png) |
| W/S default movement controls | [wheelie-review-movement-controls.png](screenshots/native/wheelie-review-movement-controls.png) |
| Independent Up/Down rider bindings | [wheelie-review-wheelie-bindings.png](screenshots/native/wheelie-review-wheelie-bindings.png) |

Evidence files to be copied by the release integrator:

- `verification/capture.json`: recorder receipt with exact game/recorder SHA-256, declared input calls, captured state, PNG hashes, errors and warnings.
- `verification/gallery-image-manifest.json`: checked-in screenshot paths and SHA-256 values, covering exactly the eight files listed in [gallery.json](gallery.json). The gallery builder verifies these bytes before copying them.
- Final verification and publication receipts: **TO_BE_FILLED_FINAL_EVIDENCE_FILENAMES**.

## Validation

Final frozen-release test summary: **TO_BE_FILLED_VERIFIED_TEST_SUMMARY**.

At draft preparation, the integrator reported development checkpoints of 15 passing host modules with approximately 17,000 assertions and three passing browser modules, including a physically simulated wheelie of 316.923 m. These checkpoints preceded final captures and incoming fatal-fall continuity changes; they are not a final release-suite result. Replace this paragraph with exact final module counts, source hashes, receipt paths, skips and any remaining failures when release verification completes.

The production scorer/HUD host regression exercises 0/99/101/201 m, strict threshold crossings, one-time milestones, touchdown grace without ground distance, actual curved/return paths, stationary balance, stop/rearm, pause, crash/exit, each whole-bike flight flag, relocation and world-reset cleanup. Other focused checks cover control migration and remapping, genuine device inputs, contact/grip limits, sustained balance, frame-rate agreement, rider pose/IK contacts and supported recovery. The final validation summary must identify which checks ran on the frozen release.

## Limits

This is assisted motorcycle balance and procedural rider animation within the existing browser game's vehicle/body simulation. The rider is not a fully articulated joint-constraint ragdoll. Named fall fixtures stage initial conditions; their screenshots show actual production simulation and rendering after that setup. Software WebGL checks and fixed viewport captures do not establish hardware performance or AAA production readiness. Distances shown are simulation path measurements, and the achievement animation freeze is a screenshot technique rather than a gameplay timing change.
