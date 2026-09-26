# Missions, campaign, demo and god mode

story.js (characters, `STORY`, `setStage`, `startMission`, `winMission`, `failMission`,
`missionUpdate`), harbor.js + chase.js (mission 1), roofmission.js (mission 2),
challenges.js (3-9), aviation.js (10-11), sidejobs.js (contracts), campaign.js (saves,
progression, PUBLIC DEMO), god-panel.js, game-cops.js (`resetMissionState`).

## The list

`missions[]` (game-weapons.js) is ordered. In-game numbers (and docs/audit logs) are the
index plus one.

| # | Index | Mission | Code |
| --- | --- | --- | --- |
| 1 | 0 | Dockside Favor | harbor.js, chase.js (ends in Vinny's warehouse: harbor.js THE DROP) |
| 2 | 1 | A Seat at the Table | roofmission.js (the Blue Hour hit) |
| 3-9 | 2-8 | Vinny's Favor … One Clean Exit | challenges.js |
| 10-11 | 9-10 | The Last Witness, The Manifest | aviation.js |
| C1-C5 | 11-15 | Rush Hour, Fireworks Night, Blackout, Ring Run, Repo Man | sidejobs.js (`SIDE_JOB_FIRST`) |

## How a mission runs

1. The payphone (`offerMission` → `startMission`) resets state and dispatches by index.
2. It spawns what it needs: vehicles get `mission = true`, people a `missionTag`.
3. It advances with `setStage(stage, target, instruction, speaker?, line?)`; the target feeds
   the map marker and arrow via `objective()`, and a new instruction reopens the HUD
   mission card for six seconds (`updateMissionCard`).
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
- Mission vehicles burn down to 8% and go out instead of exploding and take 40% of gang
  small-arms damage.
- Test from the console: `startMission(i)`, `missionTargets()`, `steerTo()`, `walk()`,
  `interact()`, `simulate(seconds, keys)`; docs/audit/missions-qa.md shows the method.

## Campaign and saves (campaign.js)

- Save schema in localStorage `dead-end-city-v1`: campaign indices, cash, clock, weapons,
  ammunition, `stats` (`campaignStats`: play time, cash earned, wanted peak), sportsbook bets.
  Progression frontier decides what the picker offers; a job played ahead of the story does
  not advance the campaign.

## Public demo (`DEMO_BUILD`, game-state.js; campaign.js PUBLIC DEMO)

- `DEMO_BUILD = true` today. A normal player gets missions 1 and 2 (`DEMO_MISSIONS`); later
  jobs show locked with a FULL GAME badge and a buy note. The payphone stops ringing after
  mission 2 (`storyCallWaiting`), and completing it shows the DEMO COMPLETE card
  (`showDemoComplete`, game mode `'demo'`, a recap from `campaignStats`). Completion is kept
  in `dead-end-city-demo`. `demoLocked()` is the gate.
- Never gated (not missions): the hill climb, volleyball, the stadium ball, the pier rides,
  bike share, cabs, rail, the liner, casino, garages, gun shop, Fort Sentinel, the Apache,
  MONARCH MOTORS.
- God mode lifts every gate; the console's `startMission` reaches a gated job only with god
  mode or `?dev`. `DEMO_BUILD = false` is the full game with no trace of the demo.

## God mode (the `godmode` cheat; god-panel.js)

- Typed in play, on the city map or on the title (game-input.js cheat ring). It unlocks every
  job (`missionUnlocked`) and opens Settings on the GOD MODE tab (`syncGodSettingsTab` adds
  `'god'` to `SETTINGS_TABS` only while `player.godMode`).
- Rows: mission select, time presets and 24 h slider (`setGodTime`), freeze
  (`godTimeFrozen()`, asked by citylife.js before advancing `worldMinutes`), weather
  (`setGodWeather`), refill (`godRefill`), lose police (`godLosePolice`: also marks the
  player's crowd incidents reported so a call in progress does not re-raise a star, and ends
  the Fort Sentinel alarm), teleport (map pick mode).
- `godTeleport(x, y)` is the safe move: nearest walkable spot, a boat spawned on open water,
  the current road vehicle placed on the nearest lane where `canSpawnCar` passes, aircraft
  kept airborne; then `teleportPlayer`, camera snap, crowd resettle, a second's grace.
- Console: `god(on)`, `godPanel()`, `godTeleport(x, y)`, `godRefill()`, `godLosePolice()`,
  `godFreeze(on)`.

## Skip the ride (ride-skip.js)

- A passenger skips a cab, train or the liner with `skipRide` (Y): refused when wanted, in a
  timed job, in a hurt cab or without the fare. The screen fades, `catchUpWorld` steps the
  clock by the ride's own seconds (weather, trains, liner), the ride is placed at its end
  (`placeCabAtKerb`, `placeTrainAtPlatform`, `placeLinerAtAnchor`). Wanted state is never
  touched; the effects bus ducks. Console `skipRide()`, `skipStop()`, `rideSkip()`.
