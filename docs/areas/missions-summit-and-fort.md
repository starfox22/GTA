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
  (game-update.js `summitDigging()`). Jumping, falling, tumbling, swimming and a vehicle knockdown
  interrupt the dig and its kneeling pose immediately, retaining earlier progress; cache/load/handover prompts
  require stable footing too. An airborne or overturned road vehicle does not count as arriving on the summit.
- `m.carrier`: 'hand' (just dug, a vehicle near), 'backpack' (no vehicle near, or walked away from it), 'car'
  (`m.carryCar`, flagged `mission` so it burns down slowly instead of exploding and is never retired). Inside the
  warehouse getting out of the carrier takes the package along. Outside, the action key at the rear of a
  stopped, grounded, living carrier retrieves it into the backpack (20-unit reach, same elevation). This lets
  a player leave a stranded or damaged ride for another vehicle. Retrieval restores the borrowed protection
  immediately and clears `carryCar`, so that vehicle burning later cannot destroy the recovered package.
  Cargo still in a destroyed vehicle keeps the existing failure; a moving or airborne carrier cannot be unloaded.
- The carrier is borrowed from free roam. `m.carryCarWasMission` records its previous mission protection;
  `summitCleanup()` restores it before generic failure/retry/abandon cleanup. An ordinary player's truck survives
  a job retry with its world damage intact; a vehicle already owned by a job keeps its original ownership.
- Vinny refuses the package with police on the player. The Vinny who stands at `LOC.vinny` is hidden while his
  warehouse copy (`missionTag` 'summit-job') is out; `summitCleanup()` (cleanupMissionExtras) restores him.
- The renderer reads only `summitCacheView()`: stones lifted onto a pile over the first third of the dig, a dark
  hole and spoil heap that grow, the case once the dig passes 62 %. Shared standard materials only (no new
  program, nothing to prewarm).
- Console: `summitJob()` (report), `summitSkip('summit' | 'deliver')`. Tests: tools/tests/mission3-summit.mjs,
  mission34-lifecycle.mjs (borrowed carrier, production functions plus actual retry cleanup),
  mission34-footing.mjs (production interruption cases plus real jump/interact input), mission3-recovery.mjs
  (rear retrieval, ownership, alternate ride and destruction before/after cargo recovery).

## Mission 4: Borrowed Stripes (fortjob.js with vehicle-trunk.js, fort-cover*.js, skyline-meeting.js)

The job, Kessler and the tail: missions-summit-and-fort-kessler.md. The trunk, the change, the gate, the records
office and the meeting at CIRRUS: missions-summit-and-fort-fort.md.

## Mission briefs (mission-brief.js, ui/mission-brief.css)

- `missionBrief(text, { kicker, tone, seconds })` puts one sentence in the upper middle (22% from the top, above the
  player, under the waypoint pill) for its reading time (`missionBriefSeconds`: 3-6.5 game seconds), then folds it
  down into the pager strip, which glows once (`#pager.brief-land`). A brief waits while a headline card
  (`#announcement`) is centred and folds when one comes up; a newer brief replaces the one showing; O folds it early
  (`toggleMissionCard`), and so does Escape (`dismissMissionCentre`, game-input.js; the gamepad's MENU taps
  Escape): it folds a brief, or clears a job's centred headline card and lands a brief waiting behind it straight in
  the strip, without pausing; with nothing to clear Escape pauses as before. With no job it folds. Missions 3 and 4
  use it; the strip keeps setStage's instruction.
- Mission 3's opening says what, never how (the owner's words, `SUMMIT_OPENING`): the brief, the call
  (`phoneMessage`) and the strip name the package at the top of the mountain only; the 4x4 trail and the parachute
  are the player's to find (Vinny's radio beats at the trailhead or in a jump still react).
- Jobs that open with their own line from the contact set `m.ownOpening` (story.js then skips the brief line).
- Console `missionBrief()`; test tools/tests/mission-brief.mjs.
