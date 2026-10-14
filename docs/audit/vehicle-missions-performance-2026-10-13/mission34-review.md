# Mission 3–4 review evidence, 2026-10-13

## Production-function regressions

The exact mission 3–4 production host check executes 30 assertions. Frozen main `bde9ee4` fails 14 of them; the candidate passes all 30. See `mission34-host-before.json` and `mission34-host-after.json` for exact receipts.

`mission34-staged-regressions.log` records 12/13 browser regressions passing. The lifecycle failure came from a fixture trying to retry mission 4 with public story progress still zero. The corrected fixture explicitly sets the three prior-job frontier; `mission34-lifecycle-rerun.log` passes all original lifecycle assertions. The suite checks staged mission routes; stage shortcuts and teleports are not full playthroughs. The unchanged `mission4-paths` originally passed in 49.1 seconds in this isolated run.

## Mission 3 normal attempt 1

`mission3-normal-attempt1.jsonl` records god mode off, an initial trailhead placement and spawned crawler, and ordinary steering/physics through the mountain climb. There were no stage skips. The climb reached the summit at 99.4% route progress, with player health 100 and crawler health 240. The automated pilot did not stop and exit cleanly: the attempted foot route found the player still in the crawler, near the cairn, and stopped. Recovery driving took the crawler off the summit; the player died and the normal hospital/retry flow returned to free roam. See the recovery log. This attempt did **not** complete the dig, delivery, or job; its failure is not evidence of a mission softlock or successful end-to-end completion.

## Final normal attempts on the shipping QA snapshot (2026-10-14 UTC)

Both new attempts used `dist/review-2026-10-13-shipping.html`, SHA-256 `2399af32b917bf9f05be600257742cdea4c64e6454ab45cea57c1efd08b89c11`, in one no-render browser acquired through the two-slot semaphore. This snapshot predates the final held-aim entry correction for the fort records office and skyline lift; neither attempt reached those entries. The final publication smoke and held-aim regressions are separate checks.

God mode was off. Initial fixtures set the appropriate prior-job frontier, placed the player at the trailhead or Marea waiting area, and supplied an authorized travel vehicle. M4's sedan was prepared at the beginning, rather than spawned after taking the bag. After setup, the scripts used real E admission where required, normal held-input simulation updates, and named steering methods that use ordinary collision/vehicle physics. The scripts invoked no later player teleports, mission stage shortcuts, health refills, or forced wins. The scripts are archived alongside the traces; running them requires an isolated copy of the developer runner and the sourced cloud setup environment.

### Mission 3 gentle retry

`mission3-normal-attempt2.jsonl` records a clean climb, with all checkpoints, to 99.4% route progress. The gentle 20 km/h pilot took 99 game seconds (98.7 on the climb clock); the player remained at health 100 and the crawler at 240, with no cliff flights. Ordinary steering and braking then parked it on the summit platform, and the real E key exited the vehicle. Stage 1 correctly became “DIG UP THE PACKAGE AT THE CAIRN”.

The simple direct foot-path pilot stopped beside the parked crawler at **7758,1076**, heading for **7791,1082**, after repeated blocked movement. The player remained alive and the job remained active. No detour was attempted, so this is evidence of a blocked automated route, not a confirmed mission softlock. The attempt did **not** dig, load, descend, deliver, or win the job. Its exact script and console result are in `mission3-normal-attempt2-script.mjs` and the corresponding `.log`.

### Mission 4 attempt

`mission4-normal-attempt1.jsonl` records the intended wait-at-Marea alternative progressing normally until Kessler parked and entered the club. The job reached stage 3, with the muscle car intact, the trunk closed, and Vinny's supplied lockpick owned. God mode remained off.

The simple direct foot-path pilot reached its 100-step limit while trying to approach the trunk. It ended at **−2818,5268**, with the trunk target at **−2796,5215**; the player remained at health 100, wanted level zero, and the job active at stage 3. No alternate walking route was attempted. The attempt did **not** pick the trunk, take the bag, change uniform, enter the fort, collect papers, or complete the meeting. This does not establish a continuous normal-input win or a confirmed mission softlock. Its exact script and console result are in `mission4-normal-attempt1-script.mjs` and the corresponding `.log`.

`mission34-normal-shipping-driver.log` records both interrupted attempts and the server stop at **00:29:45 UTC**. The browser slot was released immediately for the remaining rendered checks. Mission 3–4 validation therefore remains the production-function regressions, the staged browser routes (including the full strict M4 path/win fixture), and these partial normal-input attempts; full continuous normal-input wins have not been established.
