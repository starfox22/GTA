# Wheelie controls, rider motion and distance achievements

This pass continues `codex-reviews` with independent rider weight controls, more coherent motorcycle posture and spills, sustained wheelie balance, and an actual distance counter with animated 100 m and 200 m achievements.

Published gameplay/physics source: **`e3693e76`**, followed by the CSS-only caption-clearance change **`577c7107`**. Published entry SHA-256: **`e07df7a93ae2ba0f39a2956579140ecbd2a648a9657abb2b63a96cb220cb1898`**. Playable link and deployment receipt: verification pending for the target [playable build](https://starfox22.github.io/GTA/?review=e07df7a93ae2ba0f3) and [gallery](https://starfox22.github.io/GTA/review/).

The six 3D game frames, keyboard checks and packaged smoke use the frozen `e3693e76` build (monolithic SHA-256 `798146e2731d19b1310ffd073427c74129c765899c79e7b00f5101cd008f650c`). The published build adds only dispatch-aware compact styling to the meter (monolithic SHA-256 `aa9ca8c1d6a9279894308e0b2f5a9d7e99ebc67b3d1328825b64cb0c5b8632cb`). Its game JavaScript is byte-identical, and its split HTML is identical outside CSS. A separate layout fixture verifies the added CSS in three viewports and with reduced motion. Settings UI captures use this published build, with world drawing disabled and the entrance animation complete. Exact hashes and these distinctions are retained in the receipts.

## Player changes

- W accelerates and S brakes/reverses. Up shifts rider weight back; Down shifts it forward, independently of the throttle. Settings exposes both rider actions for remapping. Arrow presses while stopped or reversing cannot animate a weight shift or propel the motorcycle; the shift fades in between 3 and 8 km/h. Pad RT/LT and touch GAS/BRAKE keep separate drive controls.
- Only exact old default movement binding pairs migrate to W/S. Custom bindings remain intact. Aircraft and parachute arrow actions retain their own contexts. Settings, boarding notices, help and device hints identify the separate rider actions.
- Available engine force, the rider/bike centre of mass, rear contact and surface grip still constrain a wheelie. Holding drive and rider-back uses balance assistance toward approximately 29° on a sport bike, allowing a sustained run. The assistance cannot add power; a genuine loopout past the balance/tail limit remains possible. Rider-forward lowers the front while W can remain held. S or Space applies the actual rear brake.
- Motorcycle bank follows a damped physical roll state and controls yaw at speed. The rider adds weight shift, speed tuck and bounded corner posture while source grips and pegs remain fixed IK targets. The bike's rear axle remains the wheelie pivot, including bank and terrain angles.
- Ordinary motorcycle spills retain their release orientation. Lowsides fall onto the bike's side; loopouts release backwards from the raised chassis; over-the-bars impacts retain forward rotation. Riders brace, gather their limbs, slide and rise through a supported crouch within the existing injury/knockout wait. Player and traffic riders use the same motion system.
- Fatal rider falls also retain flight and slide momentum through WASTED; dead riders remain down and pool only after settling. The existing bounded hospital handoff is shared with vehicle strikes.
- The HUD measures the actual path travelled while the front wheel is clearly airborne and the rear remains in contact, in world units divided by eight. It confirms a lift for 80 ms and debounces touchdown for 120 ms, adding no ground distance during that grace period. Whole-bike jumps, stationary balance, relocation, crashes and exits cannot extend a run.
- Crossing beyond 100 m triggers **GREAT!**; beyond 200 m triggers **Amazing!**. A compact meter, distinct glow/shine/text effects and muted/settings-safe chimes mark each threshold once per run. The final landing distance remains for four gameplay seconds. Pause holds the timers; reduced-motion settings suppress animation.

## Native screenshot evidence

The game-frame recorder is [tools/wheelie-rider-render-review.mjs](../../../tools/wheelie-rider-render-review.mjs). It captures the actual 3D renderer at a 1000 × 700 viewport, High graphics, clear weather and 13:00, with seed 1 and the simulation held between explicit steps. Native PNGs retain the game viewport pixels. The six accepted game frames come from this recorder. Two early Settings frames caught its entrance before it painted and were rejected; the separate [UI recorder](../../../tools/wheelie-bindings-ui-review.mjs) captures the actual settings DOM after the entrance finishes, with world drawing disabled. It also uses the real remapping UI and verifies persistence across reload. The game recorder asserts that the renderer is 3D and checks recorded errors, GPU loss and frame faults at each capture; the UI recorder explicitly records its drawing-disabled mode.

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

Evidence receipts:

- `verification/capture.json`: accepted six-game/two-settings capture index; `capture-game-raw.json` retains the original complete game recorder receipt, and `capture-ui.json` the accepted UI recorder receipt. Each manifest row links its exact source receipt and hashes.
- `verification/gallery-image-manifest.json`: checked-in screenshot paths and SHA-256 values, covering exactly the eight files listed in [gallery.json](gallery.json). The gallery builder verifies these bytes before copying them.
- Final verification and publication receipts: **`verification/validation.json`, `release-host.json`, `final-runtime.log`, `candidate-regression.log`, `packaged-smoke.json`, `caption-layout.json` and `successful-deployment.json`**.

## Validation

The frozen gameplay build passes **16 host modules / 17,445 assertions** and **5 focused runtime modules** (input hints, rider falls, vehicle-body impacts, wheelie hints and real-key wheelies). The runtime wheelie covers **316.923 m**. A preceding gameplay candidate (`535851b7`) passes **11 broader regression modules** covering braking, drifts, finite driving, HUD, vehicle layouts, falls, parachutes and world reset. Final-build blood wounds, car blood and free-roam respawn also passed before an accidental second client reloaded the shared test browser; that overlap was stopped, and affected checks were rerun sequentially in the complete five-module final run. The interrupted log is retained explicitly.

The packaged split build passes real-key walking/driving, map, both cameras, default FPS and six captures, with **zero errors** (only the existing Three.js legacy-build warning). The CSS-only publication change has matching JavaScript and unchanged HTML outside styles; its desktop/phone/landscape caption layout and reduced-motion checks pass. The complete 240+ module suite was not repeated for this pass. See `verification/validation.json` for exact source/build qualification and receipts.

The production scorer/HUD host regression exercises 0/99/101/201 m, strict threshold crossings, one-time milestones, touchdown grace without ground distance, actual curved/return paths, stationary balance, stop/rearm, pause, crash/exit, each whole-bike flight flag, relocation and world-reset cleanup. Other focused checks cover control migration and remapping, genuine device inputs, contact/grip limits, sustained balance, frame-rate agreement, rider pose/IK contacts and supported recovery. The final validation summary must identify which checks ran on the frozen release.

## Limits

This is assisted motorcycle balance and procedural rider animation within the existing browser game's vehicle/body simulation. The rider is not a fully articulated joint-constraint ragdoll. Named fall fixtures stage initial conditions; their screenshots show actual production simulation and rendering after that setup. Software WebGL checks and fixed viewport captures do not establish hardware performance or AAA production readiness. Distances shown are simulation path measurements, and the achievement animation freeze is a screenshot technique rather than a gameplay timing change.
