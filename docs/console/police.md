# Console: police

`addConsoleMethods('police', …)` in `src/game-console-police.js`. Police and combat: wanted level, police report, shot log, overhead cover, the Apache, weapons, roadblocks, Fort Sentinel.

| Method | Purpose |
| --- | --- |
| `wanted(stars)` | Set the police level (0 clears it as an escape would) |
| `shotLog(reset)` | Every hostile round aimed at the player since the last reset, by source (`police-patrol`, `police-swat`, `army-jeep-gunner`, `police-helicopter`, `police-rooftop-sniper`...): shots, hits, damage, nearest / farthest shooter, how many were fired from off screen, and the last 40 rounds |
| `cover(x, y)` | Overhead cover at a point (default the player): the cover (kind, underside, top) or null, `roofHeight` (`overheadCoverHeight`: where the searchlight lands), whether the player is hidden from the police helicopter, the air unit's status line, the registered covers by kind with an example point each |
| `apache()`, `apacheAim(x, y)`, `apacheReset()` | Fort Sentinel's Apache: position, pad, altitude, hp, aboard / taken, ammunition (rounds, rockets, rearming), turret and gun pitch, aim point and a parked-clearance check; fix the gun's aim point on the ground as the mouse would (no arguments hands it back); put a fresh one on its pad. Fire with `simulate(s, ['KeyF'])` (gun) and `simulate(s, ['RocketSalvo'])` (rockets: the action's virtual code) |
| `policeReport()` | The police response: stars, heat and the next star's threshold, the incident's body count, search (active, seconds left, last sighting), arrest progress, the tier's allowances, counts by unit (patrol, swat, fed, army, air, officers, roadblocks), every unit and officer, pursuit counters (contacts, PITs, shortcuts, marine units and shots, tank and marksman rounds, arrests), marine units, and `wounds` (how the dead fell, downed and dragged officers, limping, crawling, bleeding); `crimes` (the last twelve crimes: time, heat, reporting function), `swat` (teams, shield blocks, snipers, sniper shots), `sniperFire` (sniper rounds at the player from roofs and the helicopter, hits on foot and through a car), counts of army units (`armyJeep`, `armyApc`, `armyTruck`), `soldiers`, `snipers` and `shields`, and unit positions |
| `arm(index)` | Own weapon `index` (0 pistol to 5 precision rifle) with full ammunition and select it; 6 selects the knife, 7 no weapon (fists) |
| `roadblocks()`, `containment()` | Police cordon state (cruisers still braced, cones knocked, breached) |
| `roadblock(siteIndex)`, `clearRoadblocks()` | Build a police cut at a chokepoint (nearest to the player if omitted); take every cut down (repeatable ram tests) |
| `military()` | Fort Sentinel: alert, lockdown, gate challenge level, each lane's arm, bollards and sliding gate (and what is broken), soldiers on duty by role, military vehicles and their roles, the supply run and the drill |
