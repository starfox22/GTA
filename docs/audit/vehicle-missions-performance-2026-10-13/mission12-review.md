# Missions 1–2 review: evidence and scope

Reviewed main `bde9ee4` and the candidate branch. Mission fixes are described in
[the change fragment](../../changes/2026-10-13-mission-world-continuity.md).

## Confirmed fixes

- Cargo job starts/retries preserve ambient Harbor Kings' injuries, deaths and positions.
- Live payphone acceptance preserves existing harbor police and rounds. The inherited
  pursuit keeps ordinary harbor rules and its higher heat through the cargo-camera alert.
- Depot cleanup removes only job-owned or explicitly delivered vehicles. Ordinary and
  owned cars, their retained crews, aircraft and the player's current car remain.
- Closed-depot crew deployment keeps outside cruisers' officers outside and inside
  cruisers' officers inside; normal open-shutter entry remains possible.
- The rooftop job replenishes limousines into free bays instead of removing ordinary
  or owned cars left there.
- Blocked mission ambulances recover to the hotel only when both endpoints are out of view.
- A watched-glass refusal never lowers an already high suspicion meter.
- Tito's patrol waypoint clears the DJ booth; every guard's waypoint and cyclic route
  leg passes the actual rooftop navigation geometry.

[Host baseline](mission12-host-before.json) has 27 failed assertions out of 69.
[Candidate host result](mission12-host-after.json) passes all 69. The test executes the
production functions and geometry in isolated fixtures. It does not simulate a complete
mission or measure rendering speed.

## Actual gameplay attempts

The [raw gameplay trace](mission12-playthrough.jsonl) records named console calls and
ordinary update/input stepping on the isolated no-render QA page. Each normal attempt
began with the QA console selecting the mission and placing the player beside its first
objective. God mode was off. There were no later player/vehicle placements, stage skips,
guard pins, health/ammo refills or wanted edits in those normal attempts.

| Attempt | What was exercised | Outcome |
| --- | --- | --- |
| Mission 1, first | Actual truck interaction and driving from its kerb | The automated GPS pilot drove into a block; recovery ended in BUSTED. |
| Mission 1, second | Pickup, street route, harbor barrier, loading all three crates under gang fire, complete truck exit, cargo dispatch, both bridges, road trip to the depot | Player remained at 100 hp. The truck reached about 49% health at the harbor exit and 228 hp near the depot. The automated pilot cut the final turn into the east corner; real pursuit cars then boxed it. No continuous win was recorded. |
| Mission 1, third | Fresh-world pickup, street route, all cargo loading and dispatch, second attempted bridge route | Player remained at 100 hp; truck reached 311 hp at the exit. Another automated turn cut near (1072, 3384) ended the attempt with a valid running job and 271 hp truck. No continuous win was recorded. |
| Mission 2, normal | Outfit action, connected streets and bridge on foot, actual hotel lift, normal walking on the terrace with unpinned guards | The chosen path crossed a guard's cone, raised the alarm, and ended in WASTED. The trace exposed Tito's unreachable patrol waypoint. No normal poison/escape completion was recorded. |

The mission 1 route failures were QA pilot/traffic outcomes. They did not justify changing
vehicle handling, police strength or mission balance. The mission 2 alarm was an ordinary
stealth failure; the stationary patrol waypoint was separately confirmed by production
geometry and fixed. No updated-Tito partial rooftop replay occurred in this session.

## Focused browser regression

The existing `mission1-depot` regression passed: front shutter, sealed drop, truck exit,
back door, completed-objective pill, payday and clean integrity report. It explicitly used
`skipToDepotDelivery`, god mode, officer-neutralisation and placement shortcuts, so it is
component coverage, not an end-to-end gameplay win. During that staged run, the depot
reported zero officers inside at stage 6 and one at stage 7; that observation led to the
closed-shutter deployment fix. The final fix is covered by the production host cases and
the final suite, not a claim that the earlier browser run already contained it.

The root review's full-suite logs are the authoritative final regression results. A
human pass through both full jobs in both camera modes remains useful, especially for
normal chase driving, stealth route readability and mission difficulty. These recorded
attempts do not establish that every mission is bug-free or that the game is production ready.
