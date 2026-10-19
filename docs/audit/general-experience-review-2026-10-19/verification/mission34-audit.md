# Missions 3–4 ordinary-input audit

Both missions won on the same preserved public demo session. Mission 3 finished at **100 HP / 0 stars / completed 3**; the successful Mission 4 retry finished at **98 HP / 0 stars / completed 4**, with the real **DEMO COMPLETE** card shown. Frame faults: **0**; browser game errors: **[]**.

Build: `integrated2.html`, source `dfb5ec96`, SHA-256 `f70727f921d8ea6945b7eae69fdfa78c00e8f50c242389c6e24d8e501ecccc35`. URL flags: `?test&norender&seed=1&hold`. This was a live-world 2D/no-render progression and physics run; rendered graphics evidence is separate.

## Setup boundary and scope

The first nine combined-trace events are setup: `holdSimulation(true)`, `god(false)`, `storyProgress(2,false)`, `setCash(5500)`, read-only `trailProfile(0,1)`, `teleport(7517,1942)`, `drive('crawler',0,-1.1071487177940904)`, `placeVehicle(7517,1942,-1.1071487177940904)`, `startMission(2)`. Event 9 begins ordinary physics driving. M1/M2 completion is seeded here and requires its separate evidence; this audit does not claim one fresh M1–M4 uninterrupted playthrough.

After that boundary there was **no debug teleport, enabled god mode, debug heal/repair, fixture-spawned transport, mission/stage skip, injected win or frozen guard**. Held simulation suppresses real frames between calls; each simulated key/pilot step advances the full game, clock, traffic and actors. `trailDrive`/`followRoute` set W/S/A/D and tick the production update; on-foot A* reads collision through `solidAt` and sends ordinary movement keys.

## High Ground

Ascent took 85.6 simulated seconds, reached 99.4% of the trail, and kept the player at 100 HP and crawler at 237/240 HP. There were zero cliff flights, overturns or NaNs; a small 0.28-second terrain hop is recorded. Actual E exits, a full held-E dig, real E loading, rear retrieval into the backpack and reboarding were all exercised. Short ordinary forward/reverse/steering inputs turned the crawler to face the descent. The 22km/h descent took 94.4 seconds, reached 99.7% and caused no cliff flight, overturn, NaN or further crawler damage.

The road pilot later wedged the crawler at (2260, 2854), with 229 HP. Repeated failed automatic backoffs and an ordinary S reverse attempt are retained. With the package already retrieved, real E left the vehicle and normal walking crossed the fixed Keys Bridge, Palm Keys and warehouse approach. Real E at Vinny completed the handover: 100 HP, 0 stars, $8,725, completed 3. This validates recoverability; it does not demonstrate a clean automated road drive.

Foot movement is separately retained in [m34-foot/experience.jsonl](m34-foot/experience.jsonl), linked from the [combined trace](mission34-normal.json).

## Borrowed Stripes

The real Palm Keys South payphone E/Enter flow accepted mission 4 from the M3 win. The first attempt picked while the visible prompt warned of a watcher, triggered a theft report and ended BUSTED at 100 HP with a $250 fine. The real pause menu—Escape, five ArrowDown presses, Enter on RESTART CURRENT JOB—restarted M4, preserving completed 3 and the fine.

The successful retry walked to Marea, waited for Kessler's actual arrival, parking and club entry, then equipped Digit9 and worked the trunk only when the visible watcher prompt allowed a gap. It took the uniform bag and closed the trunk. An existing occupied traffic taxi was hailed with E; keyboard focus selected RIDE, a real map click selected the fort, and **physical Y used the normal paid $104 taxi ride skip**. No `cab()` fixture was called.

A held-E private uniform change, empty-hand checkpoint approach and full 16.4-second ID inspection earned clearance. Default-paced walking followed the inbound lane and HQ corridor, real E initiated the records search, an 8-second wait secured the papers, and the player walked calmly out. All observed fort suspicion values were 0; alarm stayed false. The same existing taxi was rehired and **physical Y paid $113 for the normal return skip** to North Point Key.

Ordinary walking reached Varga. Actual E advanced the public NEXT LINE, GO UP WITH VARGA, SIT WITH VARGA, SKIP AHEAD and HAND OVER THE PAPERS prompts through the full shared lift, waiter/drinks and envelope sequence. These are normal scene controls, not console scene/stage shortcuts. The game naturally won M4 and showed DEMO COMPLETE, godMode false, storyOver true, completed 4, 98 HP, 0 stars, $14,758. The successful retry lost 2 HP to minor street traffic contact before the fort; no debug healing followed.

Full M4 trace: [m4-ordinary/experience.jsonl](m4-ordinary/experience.jsonl), 5,922 rows and 1,795 input/wait operations. Its one harness-only error is a nonexistent read-only `pauseState` query; it produced no game error. A local walk helper initially misestimated uniform default speed and made detours before correction. Interrupted client scripts preserved the same held game page; the trace keeps those detours and failed cab approaches.

## Evidence integrity

[Normalized summary](mission34-summary.json) contains setup calls, phase outcomes, taxi offers, stage evidence, input method counts and limits. [M4 outcome](m4-ordinary/outcome.json), [input audit](m4-ordinary/input-audit.json), and [M3 outcome](m34-foot/outcome.json) provide compact records.

| Trace | SHA-256 |
|---|---|
| [mission34-normal.json](mission34-normal.json) | `3d7bc54d826a7bb432a19a7312af72b29eedf32888f23ca49700a31e5f09e913` |
| [m34-foot/experience.jsonl](m34-foot/experience.jsonl) | `05dbd42b6448067fffae3476a263a0a7563c3213916e9628b5883ed06788993a` |
| [m4-ordinary/experience.jsonl](m4-ordinary/experience.jsonl) | `e79116fa391bdc0be012ba2cb3bd58d6ddde8c2d5bd3f4b9eba44cdc930fae51` |

Browser server was stopped after the completion proof. No later fixture or reset can overwrite this session's evidence.
