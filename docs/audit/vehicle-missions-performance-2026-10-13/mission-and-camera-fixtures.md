# Mission and camera fixture review, 2026-10-13

All receipts below use the immutable no-render candidate `dist/review-2026-10-13-final.html`, SHA-256 `b5c774e071fe74415e3715c0522dffea17ef21c5b5bf9fe2794905d7067cf26e`.

## Original full-suite shard

`suite2-full-original.log` records **91 passed, 11 skipped, 2 failed** out of 104 tests. The manifest lists exactly those tests. Both failures were reproduced or explained as test fixtures below. No production game code changed during this follow-up.

## Real-key lockpick clock

The original `mission4-paths` quiet trunk fixture held real E for four chunks of 5.8 wall seconds, but recorded only 4.4295 seconds of actual lock work. `runFrame()` caps each simulation delta at 0.033 seconds (0.04 at a 30 FPS cap), so a busy headless page can advance less game time than wall time. The same shard's `frame-guard` receipt measured only 1.20 and 1.48 game seconds in three wall seconds. `lockpickWatcher()` reports crime; it does not pause the work. The trunk requires five game seconds.

The corrected fixture continues using actual DOM E holds, polls the trunk, and allows at most fifty 1.2-second holds or eight elapsed game seconds, measured from the start of this pick using the named `frameFaults().gameTime` report. It keeps the original stage/open, bag, gate, records, quiet cover, actual mission-win and retained-uniform assertions. It does not accelerate the lock, bypass watcher logic, or alter production timers.

`mission-and-chase-focused-after-fixtures.log` passes the corrected mission 4 route test in 67.9 wall seconds. The trunk opens after **5.47 game seconds**, within the unchanged five-second mechanic plus approach/command intervals. This remains a staged route regression: `fortSkip` and `skyMeetingSkip` fixtures are explicitly present; it is not a continuous mission playthrough.

## Chase foot-path isolation

`chase-move-alone.log` passes every original assertion with the existing test in isolation (15.3 seconds). `chase-move-paired-before-fixture.log` runs `chase-aim` immediately before it and fails D displacement at **0.88 metres** (the full shard recorded 0.75 m). The former test spawns and leaves a sedan at approximately **1560,1500**, heading east. Teleporting the player preserves that vehicle, as intended by the game's world-persistence contract.

The sedan's 38.8 × 17.04-unit body plus the player's 8-unit collision radius blocks approximately x=1532.6–1587.4, y=1483.48–1516.52. The later test reaches that north edge. The named status/nearby-vehicle receipt shows the blocked player at **1544,1483**, with a single authorized parked sedan **2.9 m** away. This is a legitimate collision with another test's car.

The test now exports `fresh = true` for its unobstructed foot paths. The paired focused rerun passes `chase-aim`, then all movement-distance, heading, yaw stability, diagonal movement, exit-camera and cursor assertions in `chase-move-keys` (42.2 seconds including its fresh reload). All three focused tests pass, with zero console errors, in 136 seconds. The QA server was stopped immediately afterward for rendered model verification.
