# Regression shard 1 and console pilot evidence

The exact 104-module shard ran on immutable `dist/review-2026-10-13-final.html`, SHA256 `b5c774e071fe74415e3715c0522dffea17ef21c5b5bf9fe2794905d7067cf26e`: **91 passed, 7 skipped, 6 failed in 3,722 seconds**. The original manifest/log remain `suite1-manifest.json` / `suite1-full-original.log`. Focused corrections below account for all six failures; this is a cumulative ledger, not a claim that the full shard was repeated. Final ledger: **97 passed, 7 expected no-render skips, no unresolved failures**. Root owns separate final rendering checks.

| Original failure | Evidence and correction | Actual focused receipt |
| --- | --- | --- |
| Material lifecycle | New `finish` char pool was never populated by the old three-kind fixture. Exercise every actual kind; require all four, exactly 12 retained in every pool, and actual overflow count 32. | `suite1-focused-intermediate.log`: PASS; real Three.js material/disposal code |
| Soundscape | Dirty shared scene gave 3 steps; an independent healthy sidewalk world gives 9 in exactly 2 stepped seconds. Old failure did not retain the exact preceding pose/obstacle, so no particular obstruction is claimed. No footstep/audio source changed. | `suite1-focused-intermediate.log`: PASS; `soundscape-fresh-live-audio.jsonl` confirms running audio and all assertions |
| Lockpick | Original ten 1.2-wall-second holds ended at .93 progress; attempt 11 opened the trunk after 5.94 actual game seconds. Keep real keys and all pin/crouch/not-boarding/ownership assertions, bounded by result, game clock and wall deadline. | `suite1-focused-intermediate.log`: PASS; `lockpick-game-clock.jsonl` |
| Real mouse drive-by | Fixed wall holds advanced too little capped game time under load. Continuous real holds use the observed game clock; all rear/front glass, refused truck aim and side window assertions remain. Unsuccessful intermediate runs are retained. | `suite1-input-hud-final.log`: PASS, 24.2 s; raw successful replay `driveby-game-clock.jsonl` |
| Touch dispatch | The no-job card expires after 8 seconds and dispatch after 4.2 wall seconds. Use an actual persistent mission card, settle first, and observe the FIRST visible card/caption pair before checking geometry once. No gap-based retry, retrigger or timer extension. | `suite1-input-hud-final.log`: PASS both modes, 22.6 s, original card-height/gap bounds |
| Hill-climb physics | Main and review reproduce identical damaging off-line uphill console pilot trajectory. Narrow the uphill pilot's existing close-look trigger; real terrain, handling, suspension, speeds and test bounds stay intact. | `hillclimb-pilot-final-rechecks.log`: PASS all climbs/descent/rest, 151.2 s; additional foliage PASS 2.8 s |

The baseline comparison booted both frozen HTMLs with `seed=1&hold`, stepped 1/30 and 1/60 climbs plus 1/30 descent, and captured stopped suspension and frame faults. All three complete results, rest and faults matched strictly; zero console errors. `trail-baseline-parity.json` records both immutable input hashes and common stage hash `3f2f2cea0a7fb35000c67506b2135879222e3f19d43be9dccf698019c7cbddd5`.

The old uphill pilot's six-sample detector required a 1.1-radian turn, while the actual rounded hairpin turns .479–.533 radians over those dense samples. Its long look ran onto a bank; the 1/60 blow at (7344, 1445) lies about 41.6 map units from the nearest path sample, outside the 42-wide carriageway. Changing the trigger globally caused a downhill wreck and was rejected; `trail-pilot-global-rejected-raw.*` preserves that attempt. The final trigger is `.45` uphill and the previous `1.1` downhill. `trailPilot` has exactly one caller, named console `trailDrive`; no ordinary player, AI or update loop invokes it. `trail-mud` and `foliage-cutaway` use unchanged hill-climb placement, not this pilot.

| Final raw run | Clean time | Maximum bump-stop blow | All-wheels air | Flights | Vehicle hp |
| --- | --- | --- | --- | --- | --- |
| Climb 1/30 | 72.57 s | 2.20 m/s | .03 s | 0 | 240 |
| Climb 1/60 | 74.92 s | 1.97 m/s | .03 s | 0 | 240 |
| Descent 1/30 | 72.6 s traversal | .71 m/s | 0 s | 0 | 240 |

Actual fresh normal-runner results match the corrected raw results and keep the existing 4.5 m/s and 75-second limits. The stopped truck holds its pose and correct downhill load. This improves the developer verification pilot; it adds no player driving assist and establishes no GPU/FPS or laptop performance claim.

The final full-tree shipping HTML/JS includes root's separately verified military lamp update plus the console-only pilot correction; their hashes and successful JS syntax check are recorded in `suite1-regression-summary.json`. The full-shard HTML, render-final HTML and performance-only A/B snapshots were never overwritten. The isolated shard-1 browser was stopped after the build, releasing its allocation.
