# Missions, campaign, demo and god mode

story.js (characters, `STORY`, `setStage`, `startMission`, `winMission`, `failMission`,
`missionUpdate`), harbor.js + chase.js (mission 1), roofmission.js (mission 2),
summitjob.js (3), fortjob.js (4), challenges.js (5-9), aviation.js (10-11), sidejobs.js (contracts), campaign.js (saves,
progression, PUBLIC DEMO), god-panel.js, game-cops.js (`resetMissionState`).

## The list

`missions[]` (game-weapons.js) is ordered. In-game numbers (and docs/audit logs) are the
index plus one.

| # | Index | Mission | Code |
| --- | --- | --- | --- |
| 1 | 0 | Dockside Favor | harbor.js, chase.js (ends in Vinny's warehouse: harbor.js THE DROP) |
| 2 | 1 | A Seat at the Table | roofmission.js (the Blue Hour hit) |
| 3 | 2 | High Ground | summitjob.js (the package on Mount Ascent; missions-summit-and-fort.md) |
| 4 | 3 | Borrowed Stripes | fortjob.js + vehicle-trunk.js, fort-cover.js, skyline-meeting.js (missions-summit-and-fort-kessler.md, -fort.md) |
| 5-9 | 4-8 | No Last Ferry … One Clean Exit | challenges.js |
| 10-11 | 9-10 | The Last Witness, The Manifest | aviation.js |
| C1-C5 | 11-15 | Rush Hour, Fireworks Night, Blackout, Ring Run, Repo Man | sidejobs.js (`SIDE_JOB_FIRST`) |

## How a mission runs

1. The payphone (`offerMission` → `startMission`) resets state and dispatches by index.
2. It spawns what it needs: vehicles get `mission = true`, people a `missionTag`.
3. It advances with `setStage(stage, target, instruction, speaker?, line?)`; the target feeds
   the map marker and arrow via `objective()`, and a new instruction reopens the HUD
   mission card for six seconds (`updateMissionCard`). The card's sentence
   (`missionSummary`) lower-cases the instruction but keeps a key's own name ("· E to load");
   build instructions with `keyName()` and the four actions it knows (interact, poison, fire, walk).
4. `missionUpdate` calls its update function each frame.
5. It ends with `winMission()` or `failMission(reason)`.

## Adding a mission

- Push an entry onto `missions` (title, contact, reward, brief, phoneMessage) and add
  start / update / interact / UI branches (follow sidejobs.js; challenges.js has the
  interact and UI routing, `challengeMissionInteract`).
- Tag everything you spawn so `resetMissionState` / `cleanupMissionExtras` remove it.
- Any new player carrier must be released on reset and death (core-and-contracts.md).
- A delivery that needs zero stars: add the stage to `policeBlocksMissionDelivery`.
- If the job's opening moves, keep `MISSION_STARTS` (cycles.js, bike-share placement) in
  step, or give the entry a `start`.
- Mission vehicles burn slowly (30 s, `burnSeconds`) down to 8% and go out instead of
  exploding, and take 40% of gang small-arms damage above half health, falling to 6% at 30%
  (`MISSION_CAGE`, combat-rules.js); a critical one the player drives gets a CRITICAL DAMAGE
  headline and a bail-out warning every 3 s. Mission 1's bay: a prompt run leaves the truck
  at ~38-52 %, a hesitant one at ~30 % (tools/tests/mission1-bay.mjs).
- Test from the console: `startMission(i)`, `missionTargets()`, `steerTo()`, `walk()`,
  `interact()`, `simulate(seconds, keys)`; docs/audit/missions-qa.md shows the method.

## Mission 1: Dockside Favor (harbor-*.js, chase.js)

- Vinny's truck (`HARBOR.truck`) waits on the carriageway at the north kerb of the street
  at y 640, westbound lane, nose west: on the south side the tall block south of it hid it
  from the north-looking camera. `spawnVinnyTruck` slides it along that kerb when traffic
  or a double-parked delivery van (crowd-scenes.js) holds the spot; `MISSION_STARTS`
  (bike share) reads the same point.
- The truck's model and the payphone's dressing: missions-and-demo-mission1.md.
- The terminal's Harbor Kings are ambient `gangMembers`, not mission actors. Taking or
  retrying the job preserves their damage, deaths, positions and awareness; only a real
  world reset repopulates them. Clearing the gang before taking the call remains valid.
- A live payphone acceptance also keeps police and their rounds already in the terminal.
  `harborLivePursuit` remembers an incoming wanted chase, so the usual pre-cargo harbor
  hold does not erase police sight, movement or heat for that pursuit. A clean introductory
  call keeps the normal cargo-dispatch hold; dispatch still spawns outside the terminal.
- A successful depot delivery sets `car.depotDelivered` (Dockside Favor, Rush Hour,
  Repo Man and The Manifest). `clearDepotFloor()` removes only job-owned/delivered cars,
  preserving ordinary parked cars, owned cars, aircraft and the player's current car.
  It removes officers only when their own vehicle is removed. The tag survives the
  payday's `mission = false` so the next delivery can clear the previous one.
- A sealed warehouse also constrains `deployOfficers()` door/rear spawn positions,
  not just officers' later walking steps. Outside cruisers cannot deploy past the closed
  shutter; a cruiser genuinely sealed inside may deploy only onto its own side.
- The front shutter's safety strip tests each vehicle's complete oriented footprint,
  including its 0.6-second predicted position. Corner-only checks miss a long truck or
  bus spanning the strip. Ordinary vehicles and the player hold it open; pursuing
  police retain their push-back rule. `mission1-shutter-safety` checks the actual door
  controller and an independent polygon overlap oracle.

## Mission 2: the Blue Hour (roofmission-*.js)

- Two ways to kill Vescari: spike his glass unseen, or draw and shoot it out with the
  detail. No silent takedown (owner: nobody kills quietly in front of a party); tests
  mission2-poison and mission2-paths. The hotel's look (terrace, VIP table, street
  entrance, limousines): missions-bluehour.md.
- Guards see only inside their cone: `roofGuardSees` = `ROOF_VIEW` half-angle and range
  round `roofGuardView(e)` (heading + head `look`) with `roofViewLength` clear (all cover
  but the pool, and the balustrade). No all-round awareness; a bump is +10. The drawn
  cones (roofmission3d.js, `drawRoofStealth2D`) call the same functions: change the
  numbers in `ROOF_VIEW` only. Shots use `roofSight` (low cover passes).
- `m.suspicion` fills from `updateRoofSuspicion` (distance, running, beside Vescari, how
  long watched) and drains unseen; 100 is `roofAlarm`. After the collapse, walking seen
  tops out at `ROOF_WARY`; running still blows it.
- `footPace`: during the job the terrace is walked and the walk action runs
  (`roofPartyPace`); off the job the terrace is always walked.
- The poison is `POISON_BEATS` (roofmission-poison.js); poses per beat in
  crowd3d-roofparty.js. Past `approach` it is committed (`poisonCommitted`). The body is
  `poisoned` with a `deathStyle.poison`: wounds.js skips the fall, wounds and blood for it.
- Clean poisoning (no alarm, no stars at the lift): stage 4 is WALK AWAY FROM THE HOTEL
  (`ROOF_AWAY` from the doors); the alarm (a gunfight) keeps the run to Coral Palms.
- Cover blown with Vescari standing (not `poisonCommitted`): leaving the terrace (street
  level, or `ROOF_AWAY` off) fails the job, "Vescari got away". Walking out before any alarm
  leaves the job waiting upstairs.
- The ambulance is a real `ambulance` vehicle on `countyRouteControl` (route
  `ROOF_AMBULANCE`), braked to its stop by the mission and parked there; a stuck one is
  placed at the stop only when neither its current position nor the destination is in
  camera view. It is `mission` (removed on retry) and stays parked after a win.

## Campaign and public demo

Save timing, world reset, story frontier, demo completion, replay, retry and abandon rules: [campaign contracts](missions-and-demo-campaign.md).

God mode (the cheat and its panel) and skipping a ride: missions-and-demo-godmode.md.
