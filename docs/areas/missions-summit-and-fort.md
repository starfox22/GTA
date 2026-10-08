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
- Vinny's call gives the lockpick (`giveLockpick`, arsenal slot 8). Watching from the stakeout for 4 s with no stars
  sends Kessler out: a red `muscle` car, `mission` (never retired, burns slowly), `missionDriver: 'kessler'`,
  `trunkLoot` UNIFORM AND ID, driving `countyRoute` = `fortRoute()` (the navigation graph held to the right lane,
  as the cabs drive it). Wedged for 9 s he skips a node only where `spotUnseen` both ends.
- The tail: `tailHeat` rises on his bumper (within `tooClose`) or close behind him while he moves; held up behind him
  in traffic or at a drawbridge does not count. At 1 he made the tail (fail); farther than `lost` for `lostSeconds`
  after he passed the stakeout, he is lost (fail). The meter shares `#stealthStatus` (fortJobUI after roofMissionUI).
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
- Base: fort-cover.js does the gate's papers (`FORT_COVER_GATE.check`), the soldiers' suspicion, the military-vehicle
  alarm and the records office (`FORT_RECORDS.door`, `fortCover.papers`). Blown before the papers: the job fails;
  after: get out with them however. Out (calm crossing, or off the base 260 units from the gate): `skyMeetingBegin`.
- Meeting: the stage text follows `skyMeeting.stage` (skyline-meeting.js, places-sky-meeting.md); 'failed' (the
  consul killed) fails the job, 'done' wins it. A won job keeps the uniform on (`fortJobKeepsUniform`,
  cleanupMissionExtras); the next job, a death or a new game takes it off.
- Console: `fortJob()`, `fortSkip('arrive' | 'parked' | 'inside' | 'changed' | 'meet')` (always a fresh run).
  Tests: mission4-tail.mjs, mission4-paths.mjs (and fort-cover, lockpick, sky-meeting for the systems).
