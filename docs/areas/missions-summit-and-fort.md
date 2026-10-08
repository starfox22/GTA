# Missions 3 and 4: High Ground and Borrowed Stripes

Both are Vinny's jobs and both are in the public demo (`DEMO_MISSIONS` = 4). Lifecycle rules (start, stages,
cleanup, the demo gate) are in missions-and-demo.md; this page is what each job does and the rules other code keeps.

## Mission 3: High Ground (summitjob.js, summitjob3d.js)

- `SUMMIT_JOB`: the cache at the foot of the summit cairn (offroad3d-trail.js draws the cairn at the trail's top +
  (12, -10)), the peak (`COUNTY_PEAKS[0]`), the trailhead, the 4x4 club's gate (the entry's `start`, so the bike
  share puts a station there) and Vinny's spot inside the warehouse (chase.js `VINNY_DEPOT`).
- Stages: 0 reach the summit (`summitArrived()`: on foot and not tumbling, or a vehicle standing on the rock, an
  aircraft within 3 m of it), 1 dig, 2 load into the vehicle parked near the cairn (`m.lastCar`, interact at its
  back or just get in), 3 deliver, 4 the handover (6.5 s of Vinny talking, then `winMission`).
- The summit is the trail's level platform: ~40 units of flat rock round the peak. Nothing new keeps the player on
  it: the scree and tumble rules are terrain-field.js's FOOT TRAVEL ON THE MOUNTAIN, the parachute is unchanged, and
  a vehicle parked just off the platform rolls down the face.
- The dig is a held interact (`actionHeld('interact')`), `SUMMIT_JOB.digSeconds` in all; progress is kept on a
  release. `player.digUntil` / `player.digFacing` hold the `kneelDig` pose (crowd3d-special.js) and the feet still
  (game-update.js `summitDigging()`).
- `m.carrier`: 'hand' (just dug, a vehicle near), 'backpack' (no vehicle near, or walked away from it), 'car'
  (`m.carryCar`, flagged `mission` so it burns down slowly instead of exploding and is never retired). Inside the
  warehouse getting out of the carrier takes the package along.
- Vinny refuses the package with police on the player. The Vinny who stands at `LOC.vinny` is hidden while his
  warehouse copy (`missionTag` 'summit-job') is out; `summitCleanup()` (cleanupMissionExtras) restores him.
- The renderer reads only `summitCacheView()`: stones lifted onto a pile over the first third of the dig, a dark
  hole and spoil heap that grow, the case once the dig passes 62 %. Shared standard materials only (no new
  program, nothing to prewarm).
- Console: `summitJob()` (report), `summitSkip('summit' | 'deliver')`. Test: tools/tests/mission3-summit.mjs.

## Mission 4: Borrowed Stripes (fortjob.js with vehicle-trunk.js, fort-cover*.js, skyline-meeting.js)

- `FORT_JOB`: the stakeout where the Sentinel causeway meets the coast road (also the entry's `start`), Kessler's
  car in the fort's lot, the gate's outbound lane, his kerb on Marina Rd opposite the Marea (north side: he arrives
  westbound) and his walk to the door. Stages are `FORT_STAGE` (stakeout, tail, parked, trunk, take, change, gate,
  inside, out, meet).
- Story: Lieutenant Dale Kessler (logistics) is off duty at the Marea; his uniform and ID open Fort Sentinel's gate,
  the records office holds the HAWTHORN weapons file, Consul Anton Varga buys it at CIRRUS. Every step opens with a
  mission brief (`fortStage` = setStage + `missionBrief`, mission-brief.js) and a line from Vinny.
- Vinny's call gives the lockpick (`giveLockpick`, arsenal slot 8). Watching from the stakeout for 6 s with no stars,
  or 40 s after the start wherever the player is (`m.departAt`), sends Kessler out: a red `muscle` car, `mission` (never retired, burns slowly), `missionDriver: 'kessler'`,
  `trunkLoot` UNIFORM AND ID, driving `countyRoute` = `fortRoute()` (the navigation graph held to the right lane,
  as the cabs drive it). Wedged for 9 s he skips a node only where `spotUnseen` both ends.
- The tail: `tailHeat` rises on his bumper (within `tooClose`) or close behind him while he moves; held up behind him
  in traffic or at a drawbridge does not count. At 1 he made the tail (fail). Farther than `lost` for `lostSeconds`
  after he passed the stakeout is not a fail: the job sends the player to wait at the Marea (`m.waitClub`). The
  meter shares `#stealthStatus` (fortJobUI after roofMissionUI).
- Waiting at the club (`fortClubWait`): the player within 1100 units of his kerb, his car over 1700 away, for 14 s:
  the car is put on a node 7-20 from the end of his route that `spotUnseen` and `canSpawnCar` allow (`m.jumped`).
  City traffic at the Marina Rd junction can still hold him a while (`fortJob().blocker` says what is in his lane).
- Shot at at the wheel (`fortAlerted`): a hit on his car within 0.6 s of him driving, or a round fired within 320
  units: KESSLER ALERTED THE MILITARY (announce), `crime(32, 'seen')` + `setWantedLevel(5)`, a red brief; he bails
  and runs (`ejectDriver`), the car unlocked with the keys in it (`m.keys`). His ID still works at the gate once
  the stars are gone (Vinny: the army takes days to cancel anything). Carjacking him is not an alert.
- `missionDriver` is declared in makeCar and copied to the driver on foot by `makeCarDriver` (carjack.js), so a
  carjacked, crashed or parked Kessler is still `fortKessler(m)`; the crowd streamer never moves him
  (`streamableWalker`). His walk to the door is `p.missionWalk`, run by `updateMissionWalker` (game-people.js) until
  a reaction takes over; at the door he leaves the world.
- Quiet way: once he is inside, pick the trunk (vehicle-trunk.js; only someone within ~15 m looking at the player,
  `lockpickWatcher`, phones it in; an officer in sight is a crime seen). Kessler seeing the pick while he is still
  outside shouts and reports a theft. Messy way: his car taken (keys in it) or Kessler down (take his keys from the
  body); `fortKeysOpenTrunk` runs before `lockpickInteract`, so keys win over a pick in hand.
- The change: in a car standing still it happens by itself (3 s); on foot, a held interact where no pedestrian
  within 260 units has a clear line and not inside the base. Then `wearUniform(true)` and `fortCoverBegin()`.
- Gate (fort-cover.js): driven up in uniform the cover still owns the gate (`fortCoverOwnsGate` true short of the
  arm in a non-military car): the sergeant sends the car back to park outside, no challenge, no FORCE THE GATE
  prompt (`militaryInteract`/`militaryUI` skip it). On foot he halts the player within 160 units; past the arm without
  papers he calls him back until `FORT_COVER_GATE.grace` (56 units), then the challenge. Showing the ID runs
  `FORT_GATE_TALK` (about 16 s, `FORT_GATE_CLEARED_AT`) with the feet held (`fortGateTalking`, game-update.js);
  lines go through `fortGateLine` (bubble when short, subtitle via `missionLine` always). A weapon drawn cancels it.
- Base: fort-cover.js does the gate's papers (`FORT_COVER_GATE.check`), the soldiers' suspicion, the military-vehicle
  alarm and the records office (`FORT_RECORDS.door`, `fortCover.papers`). Blown before the papers: the job fails;
  after: get out with them however. Out (calm crossing, or off the base 260 units from the gate): `skyMeetingBegin`.
- Meeting: the stage text follows `skyMeeting.stage` (skyline-meeting.js, places-sky-meeting.md); 'failed' (the
  consul killed) fails the job, 'done' wins it. A won job keeps the uniform on (`fortJobKeepsUniform`,
  cleanupMissionExtras); the next job, a death or a new game takes it off.
- Console: `fortJob()`, `fortSkip('arrive' | 'parked' | 'inside' | 'changed' | 'meet')` (always a fresh run).
  Tests: mission4-tail.mjs, mission4-paths.mjs, mission4-alert.mjs, fort-gate-talk.mjs (and fort-cover, lockpick,
  sky-meeting for the systems).

## Mission briefs (mission-brief.js, ui/mission-brief.css)

- `missionBrief(text, { kicker, tone, seconds })` puts one sentence in the upper middle (22% from the top, above the
  player, under the waypoint pill) for its reading time (`missionBriefSeconds`: 4.5-10 game seconds), then folds it
  down into the pager strip, which glows once (`#pager.brief-land`). A brief waits while a headline card
  (`#announcement`) is centred and folds when one comes up; a newer brief replaces the one showing; O folds it early
  (`toggleMissionCard`); with no job it folds. Missions 3 and 4 use it; the strip keeps setStage's instruction.
- Jobs that open with their own line from the contact set `m.ownOpening` (story.js then skips the brief line).
- Console `missionBrief()`; test tools/tests/mission-brief.mjs.
