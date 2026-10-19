# Airport, aircraft, flight horizon and reserve review — October 19

This review covers Southport and Oceanview airport scenery, visibly enclosed aircraft, assisted
fixed-wing handling, the distant city seen while flying, and the main-cutaway/reserve sequence.
Work remains on `codex-reviews`; the earlier vehicle, Fort and first-four-mission reviews keep
their original evidence and limitations.

Final game source is `90ca3adf6e4bbdc07a6fffdbea1bb41236cbfb03` on `codex-reviews`. The frozen monolith is
`a0777806af596daf716c1f8eaed4a3cbc1aa2192506b2ff0f449dce1ee7969c0`;
the split entry is `2eada5957fbf646a719dc21e27c5801aa1429eb812a19ea905b3484a3fef4df4`.
[Play](https://starfox22.github.io/GTA/?review=2eada5957fbf646a) ·
[Native screenshot gallery](https://starfox22.github.io/GTA/review/?review=2eada5957fbf646a).
[All 652 source hashes](verification/final-source.json) identify the airport-clearance and
whole-rig camera corrections. Intermediate evidence below keeps its original artifact identity.

## Resulting behavior

- Airport terminals gain broad glazed facades, structural frames, layered roofs, entrance canopies,
  enclosed jetbridges, control towers, hangar treatment and apron guidance/stand markings. The
  architecture follows shared collision and overhead-cover plans and enters the existing static
  batching/far-city system. The runways, parked aircraft and authored taxi routes remain usable.
- The courier, business jet and airliner fuselages use outward-facing closed surfaces. Engine
  nacelles receive correctly facing cowls, visible fan hubs/blades and opaque internal depth instead
  of see-through openings. The existing downloaded Skylark controls use fitted hinge axes; rebasing
  preserves the decoded source mesh at neutral rather than displacing its surfaces.
- Released-stick idle glides settle with a stall margin; banked turns follow the coordinated-turn
  relationship. Stall warnings, actual stalled flow and fast descents are distinguished. Takeoff,
  braking, flaps, gear, full-wing clearance and all seven parked-plane taxi departures stay covered.
  This remains an assisted game flight model, not a full six-degree-of-freedom simulator.
- In chase flight, HIGH opens smoothly from the street's 600 m range at 20 m AGL to **3 km at 150 m**;
  LOW reaches 800 m, MEDIUM 1.5 km and ULTRA 4 km. Far objects use the existing merged city copy.
  HIGH's **225 m near-detail radius** and street prop/shadow budgets are retained. Real far-plane
  corners and ground-to-roof cell bounds prevent premature clipping at the edges or beneath a plane.
  Both perspective flight views use the sky's directional color and height-aware haze; the final
  atmosphere closes before the actual far clip. The overhead street view keeps its existing fog.
- After the main is fully open, a fresh **J** press cuts it away without resetting position or
  momentum. Release and press **J** again to deploy the separate reserve. Held/repeated keys cannot
  chain the steps, opening-phase presses are ignored, remapping is respected, and one rig has one
  reserve. A reserve cannot be cut again or replenished in midair. Landing and a new trip/reset keep
  their normal lifecycle. The released main remains a bounded visual object, while the reserve has
  distinct canopy colors and its own staged deployment/height forecast.

No new online model, texture or sound was downloaded for this pass. The aircraft work repairs
procedural geometry and the already licensed downloaded Skylark source/controls; it is not a claim
that every aircraft was replaced with a newly downloaded asset. Existing source identities and credits
remain applicable.

## Airport and camera candidate verification

Candidate 4 (`3aecf8a9`, entry `ddc04a6eef69d893`) differs from candidate 2 only in airport bridge/support
geometry and the chase camera; the aircraft, flight solver, horizon shaders and reserve/input logic
keep their already verified bytes. [All candidate 4 source hashes](verification/candidate4-source.json). [Independent airport/camera checks](verification/final-qa/) pin those source/test identities.

- **209 production-host assertions pass**: airport architecture 85, road clearance 31 and actual-mesh
  parachute framing 93. [Exact results and hashes](verification/final-qa/host-final.json).
- **Seven standard modules pass, no skips or failures**, in 333.53 s against the candidate 4 frozen monolith:
  airport architecture, airport road clearance, parachute camera, chase view mode, chase movement,
  parked-aircraft taxi/takeoff and the existing parachute safety/lifecycle module.
  [Selection and stable-byte checks](verification/final-qa/standard-candidate4.json),
  [raw log](verification/final-qa/standard-candidate4.log). All 652 game-source files and selected test
  bytes remained unchanged. Actual entry and departure of all four runway classes still work after
  the bridge corrections; takeoff reaches 3 m AGL within each available runway.
- [Read-only hygiene](verification/final-qa/source-hygiene.json) passes whitespace and six changed
  JavaScript syntax checks. The final quick-check also verifies full assembled syntax, include map,
  build and duplicate functions. Targeted verification is not an all-missions/full-suite claim.

## Release palette correction and native evidence

The final `90ca3adf` source adds only a four-line color-buffer upload in `parachute3d-cutaway.js`:
**651 of 652 game-source files remain byte-identical** to candidate 4. Geometry, cameras, input,
flight and parachute physics are unchanged. [Exact source boundary](verification/palette-source-boundary.json).

Candidate 4's [twelve native captures](verification/final-native/review.json) pass the actual J sequence
and graphics guards, but visual inspection caught the reserve retaining main colors when all of its
shaded opening frames were skipped. Changing the base palette alone did not dirty/copy the live skin
buffer. The release updates that buffer immediately; normal cell-fill shading can still update it later.
[Paired production-mesh test](verification/chute-palette-host.json): 37/37 pass after the fix, with six
failed acceptance assertions before it. Checks include every skin/rib color, actual upload versions,
no redundant same-palette upload, unchanged geometry/materials and independent detached-main colors.
The [standard runner](verification/palette-standard.json) also passes its one focused module against
the final frozen monolith; [raw log](verification/palette-standard.log).

The [release native sequence](verification/release-native/review.json) records fresh physical J edges,
fully framed main, released main and white/teal reserve on the final split entry. These three gallery
images use the exact release. Airport/aircraft/city images use candidate 4's identical relevant source;
the [image manifest](verification/gallery-image-manifest.json) pins each image's actual commit/artifact.
All captures are full unedited 1000×700 HIGH viewports. Named staging, god mode and held stepping are
explicit, and do not prove ordinary mission completion. Main/reserve receive 0.8 simulated seconds
of actual Low rendering to settle their cosmetic springs before returning to High; no pose is injected.
This also avoids the cold cosmetic pose left by candidate 2's skipped rendering frames.

The [front-quarter/city addendum](verification/final-native-addendum/review.json) has **three accepted
native images and an aborted fourth setup**, not an all-green four-shot run. The two solid aircraft and
north-facing 300 m city approach pass their individual High/3D, actual-heading, frame/GPU/error guards.
A subsequent dusk fixture tried to summon a new plane at the previous over-water inspection position
and correctly received `No clear vehicle spawn for plane`. Its original failed receipt/script/log
remain unchanged. The gallery uses the existing east-facing coastal dusk capture instead; the root
recorder's filenames 07/09 contain “downtown” but their actual lens headings are east, so they are not
presented as north-facing downtown evidence. The north-facing city image comes from the guarded addendum.

## Frozen intermediate candidate and verification

[Candidate 2 source manifest](verification/candidate2-source.json) pins source commit
`df75780a0a35bbb2d0751dd13d37c0a8b3838aae`, monolith
`224b5de6a411c0badd759aff7b8eec25fb0291bff1216ea8adac426025c9be81` and split entry
`31e92cd0e18e3dd44e99eea3d9ff10862cc0bceb69d2b6fc7a5ce7e8d3b44a6d`.
The earlier published baseline entry is `80e81b6c3f24fe5a28abd558e68f5dfeb329b8ec557e0fcbcc2f9c84d2d71426`.
These identities must not be relabeled as the later corrected airport/camera artifact.

| Check | Accepted coverage | Receipt and scope |
| --- | --- | --- |
| Flight dynamics | 196 assertions | [Matched host A/B](verification/airport-flight/dynamics-host-ab.json): only production `aviation-flight.js` is substituted for the baseline; same other sources and assertions. Baseline fails 82 acceptance assertions, candidate passes all 196. These are assertions, not 82 distinct bugs. |
| Existing aircraft flight/ground model | 4,149 assertions | [Host receipt](verification/airport-flight/model-host.json): full-wing collision, entry reach, braking/configuration, 60/120 Hz rotation and all seven authored taxi/takeoff paths. |
| Aircraft geometry | 478 assertions | [Geometry A/B](verification/aircraft-geometry-ab.json): real Three.js winding/raycast checks, cowl sightlines and exact neutral source-control positions. Baseline fails 418 assertions; candidate passes all 478. |
| Aerial horizon | 610 assertions | [Actual-harness host receipt](verification/aerial-horizon/host.json): all tier transitions, real camera/frustum corners, ground heights, distant merged-cell selection and retained near-detail radius. |
| Main and reserve lifecycle | 56 assertions | [Independent host review](verification/qa/host-review.json): staged solver, canopy transitions, momentum and lifecycle checks. |
| Production keydown handling | 66 assertions | [Keyboard-edge host](verification/qa/keyboard-edge-host.json): verbatim production handler plus controls/physics at 30/60/120 Hz for J and remapped K. |
| Actual DOM keyboard lifecycle | 17 assertions, 14 states | [Physical probe](verification/qa/physical-reserve.json): actual J edges on immutable candidate 2, safe reserve landing at 3.5 m/s with zero injury, 100 HP and zero stars, then actual pause-menu NEW GAME resetting the active rig/world serial. |
| Targeted standard runner | 12/12 modules pass, no skips/failures | [Exact selection and hashes](verification/qa/standard-candidate2.json), [raw log](verification/qa/standard-candidate2.log): 389.09 s against immutable candidate 2. Includes the host modules plus normal parked-aircraft taxi/takeoff, civil aircraft, falls and existing chute/deployment/liner checks. |

The five aircraft/flight/horizon/reserve host modules total **5,489 assertions**; the keyboard handler
and physical probe are separate coverage. Host math is not native-rendering evidence, and the targeted
12-module selection is not a claim that every mission or the entire regression suite was replayed.
The [independent QA summary](verification/qa/summary.json), [source equivalence](verification/qa/source-equivalence.json)
and [QA notes](verification/qa/README.md) retain exact inputs, source hashes and fixture boundaries.

## Native inspection and follow-up findings

The [baseline native receipt](verification/baseline-native/review.json) contains six full unedited
1000×700 HIGH captures. [Candidate 2 native inspection](verification/candidate2-native/review.json)
contains thirteen: matched airport/aircraft/city views, closer terminals, overhead-flight atmosphere,
dusk, main canopy, cutaway and reserve. Both use explicit named staging and held game-time simulation,
not an ordinary unassisted mission journey. The candidate's three parachute captures use actual J
press/release events. The receipts preserve their scene state, recorder SHA and image SHA.

All nineteen intermediate images were captured with zero reported game/shader errors, frame faults
or context losses. The recorder's technical pass does not mean visual acceptance: inspecting those
images exposed two real issues introduced or left visible by this work, and both require follow-up.

The new Oceanview jetbridges initially crossed the parkway too low and supports intruded into a
traffic lane. The initial [41-assertion architecture receipt](verification/airport-scene/geometry.json)
did not cover those existing road corridors. The [road-clearance inspection](verification/airport-scene/road-clearance-inspection.json)
records sedan, bus, truck and ambulance conflicts in both lanes and the parked bus. The corrected plan
provides **5 m clearance over the road**, ramps down toward the aircraft-side docking height and moves
bridge/canopy supports out of the carriageway. Final architecture coverage expands to **85 assertions**,
with **31 additional road-clearance assertions** using production vehicle envelopes, SAT contact and
overhead/support plans. All 2,776 samples across eight vehicle/direction routes clear the road,
while tall-body and actual support-contact negative fixtures still collide.
[Final host checks](verification/final-qa/host-final.json),
[paired obstruction/correction](verification/airport-final/road-clearance-ab.json). Initial geometry success is retained; it is not used as proof of road clearance.

The main/reserve logic and rendered rig worked, but the intermediate chase camera cropped the inflated
canopy. The subsequent camera follow-up raises the pivot with line stretch, fits the full wing in
landscape/portrait and lets the deployment boom keep up with the reserve. **93 production physics,
actual Three.js mesh and projection assertions pass**, including growing main/reserve deployments
at 30/60 Hz, steering, obstruction and unchanged foot/aircraft/freefall shapes.
[Final camera receipt](verification/chute-framing-host.json). Candidate 2 images remain raw evidence of the cropped view; they are not
substituted for the final camera result.

The additional horizon has an explicit drawing cost. These are the intermediate matched city captures'
**view-pass** counters, excluding shadow/post passes; they are not FPS measurements:

| HIGH chase scene | Baseline view calls / triangles | Candidate 2 view calls / triangles | Candidate far meshes |
| --- | --- | --- | --- |
| 180 m AGL, clear day | 425 / 1,264,880 | 859 / 2,179,389 | 98 |
| 600 m AGL, clear day | 62 / 226,580 | 378 / 1,616,015 | 95 |
| 600 m AGL, dusk | No matched baseline | 393 / 1,608,470 | 95 |

The increase restores city that the old 600 m cutoff discarded; it does not extend detailed street
models to 3 km. The overhead-flight capture is a different camera, and its chase telemetry is stale;
it must not be counted as a chase-view measurement. All native checks use Chromium/SwiftShader software
rendering. They establish appearance, shader correctness and bounded draw work, not hardware frame rate.

## Preserved fixture and recorder failures

- The first native baseline recorder detached API methods from `DeadEndCity`, losing the `this` context
  of `wanted()`. It failed before capturing any image, with no game error. The exact
  [failed recorder, receipt and log](verification/baseline-recorder-failure/) are retained; the corrected
  recorder invokes methods through their owner. This is not a game fix or a baseline pass.
- The first aerial host wrapper accepted expected/tolerance arguments, while the repository's
  `t.near(value, lo, hi, label)` expects inclusive bounds. Six assertions were corrected to equivalent
  bounds without changing production rendering or tolerance. The [corrected host receipt](verification/aerial-horizon/host.json)
  uses the actual standard `makeApi`, and the corrected test also passes the standard frozen runner.
  The [independent summary](verification/qa/summary.json) retains this harness finding.
- The first physical reserve probe completed safe landing and actual NEW GAME, but its last assertion
  compared a missing prior reset counter against `undefined`. The
  [original attempt](verification/qa/physical-reserve-attempt1.json), script and log remain beside the
  corrected rerun. Defaulting the absent previous counter to zero fixed the QA script; the unchanged game
  then passed all 17 assertions.

Final source pins, gallery image manifest, targeted follow-up receipts and public-deployment verification
are supplied with the publication identity above. Keep their exact artifact boundaries when reusing these
images or describing the results.
