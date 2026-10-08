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
