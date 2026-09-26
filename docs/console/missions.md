# Console: missions

`addConsoleMethods('missions', …)` in `src/game-console-missions.js`. Missions and the public demo: start a job, its state and targets, stage-skipping shortcuts.

| Method | Purpose |
| --- | --- |
| `boardMissionVehicle()` | Take the mission's vehicle (the player at its controls); returns `missionState()` |
| `startMission(i)`, `missions()` | Jump into a mission (in a demo build a gated job needs god mode or `?dev` in the URL, else the status comes back with `demoLocked: true`) |
| `demo()` | The public demo (campaign.js): the build flag, `DEMO_MISSIONS`, god mode, the open job indices, whether the demo's story is over and a call is waiting, whether it was ever completed, the DEMO COMPLETE card (shown, seconds until it opens) and the stats recap |
| `skipToRooftopEscape()` | Mission 2: Vescari down, the player on the street for the last stage (reach the motel with no stars); used to fast-complete mission 2 |
| `missionState()` | Current mission stage, instruction, objective target and Vinny's depot door state (`depotSealed`, and in mission 1 `policeInside`); with no mission, how the last one ended |
| `skipToDepotDelivery()` | Mission 1: crates loaded, player in the truck outside Vinny's warehouse with the police alerted |
| `depotOfficers(n)`, `neutraliseDepotPolice()` | Mission 1's drop: put `n` patrol officers on foot just inside the warehouse doorway (as if they ran in after the truck; call it while the shutter comes down); every officer still fighting inside takes a fatal shot from the player through the ordinary hit path (returns how many) |
| `missionTargets()` | The current mission in full: target with altitude, timer, mission vehicles (health, fire), guards, armed hostiles aiming nearby, actors, and each job's point lists (gates, checkpoints, rings, repos...) |
| `defeatMissionGuards(tag)` | Put down the current mission's guards (to skip a fight already verified) |
