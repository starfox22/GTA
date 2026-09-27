# Console: missions

`addConsoleMethods('missions', …)` in `src/game-console-missions.js`. Missions and the public demo: start a job, its state and targets, stage-skipping shortcuts.

| Method | Purpose |
| --- | --- |
| `boardMissionVehicle()` | Take the mission's vehicle (the player at its controls); returns `missionState()` |
| `startMission(i)`, `missions()` | Jump into a mission (in a demo build a gated job needs god mode or `?dev` in the URL, else the status comes back with `demoLocked: true`) |
| `retryMission()`, `chooseMission(i)` | The pause menu's RESTART CURRENT JOB; a pick in the mission picker, gated as the picker is (`chosen: false` for a locked job), which brings up the job's call (accept with `keys Enter --real`); both return the mode and `missionState()` |
| `demo()` | The public demo (campaign.js): the build flag, `DEMO_MISSIONS`, god mode, the open job indices, whether the demo's story is over and a call is waiting, whether it was ever completed, the DEMO COMPLETE card (shown, seconds until it opens) and the stats recap |
| `skipToRooftopEscape()` | Mission 2: Vescari down, the player on the street for the last stage (reach the motel with no stars); used to fast-complete mission 2 |
| `roofPlace(x, y)` | Mission 2: the player on the Blue Hour terrace at roof-local `(x, y)` (0..360, 0..350; default out of the lift), starting the job dressed as a guest if needed; returns `roofStealth()` |
| `roofGuard(i, x, y, heading)`, `roofGuard(-1)` | Mission 2 tests: hold bodyguard `i` still at roof-local `(x, y)` facing `heading` (map radians), head straight; `-1` sends them all back to their beats |
| `roofStealth()` | Mission 2: suspicion (0-100) and its rate, the player's pace (km/h) and whether it counts as running, alarm, and each guard's roof-local spot, heading, view (heading + head turn), `sees` and cone `alert` |
| `roofSuspicion(v)` | Mission 2 tests: set the suspicion meter |
| `spikeGlass()`, `roofPoison()` | Mission 2: the spike-the-glass action where the player stands; the drink's beat (`phase`, `beatT`), the glass, Vescari's hp, `poisoned`, `deathStyle`, blood pools / drops within reach of him (0 for a poisoning), and the emergency: helper and caller poses, `called`, `radioed`, the ambulance (spot, speed, `parked`, distance to the doors) and the paramedics |
| `missionState()` | Current mission stage, instruction, objective target and Vinny's depot door state (`depotSealed`, and in mission 1 `policeInside`); with no mission, how the last one ended |
| `skipToDepotDelivery()` | Mission 1: crates loaded, player in the truck outside Vinny's warehouse with the police alerted |
| `depotOfficers(n)`, `neutraliseDepotPolice()` | Mission 1's drop: put `n` patrol officers on foot just inside the warehouse doorway (as if they ran in after the truck; call it while the shutter comes down); every officer still fighting inside takes a fatal shot from the player through the ordinary hit path (returns how many) |
| `missionTargets()` | The current mission in full: target with altitude, timer, mission vehicles (health, fire), guards, armed hostiles aiming nearby, actors, and each job's point lists (gates, checkpoints, rings, repos...) |
| `defeatMissionGuards(tag)` | Put down the current mission's guards (to skip a fight already verified) |
