# Mission 4: Borrowed Stripes, the trunk, the fort and the meeting

Split out of missions-summit-and-fort.md. vehicle-trunk.js, fort-cover*.js, skyline-meeting.js; the job and
Kessler's tail: missions-summit-and-fort-kessler.md.

- Quiet way: once he is inside, pick the trunk (vehicle-trunk.js; only someone within ~15 m looking at the player,
  `lockpickWatcher`, phones it in; an officer in sight is a crime seen). Kessler seeing the pick while he is still
  outside shouts and reports a theft. Messy way: his car taken (keys in it) or Kessler down (take his keys from the
  body); `fortKeysOpenTrunk` runs before `lockpickInteract`, so keys win over a pick in hand. Once the bag is out the
  action key at the open trunk shuts it (vehicle-trunk.js `trunkCloseTarget`, CLOSE THE TRUNK; a mission car's trunk
  is never offered while its loot is in it); any car moving off past walking pace slams its lid (`slamMovingTrunks`).
  Slammed during TAKE (the bag still in), the stage goes back to opening it.
- The change: in a car standing still it happens by itself (3 s); on foot, a held interact where no pedestrian
  within 260 units has a clear line and not inside the base. Then `wearUniform(true)` and `fortCoverBegin()`.
- Gate (fort-cover.js): driven up in uniform the cover still owns the gate (`fortCoverOwnsGate` true short of the
  arm in a non-military car): the sergeant sends the car back to park outside, no challenge, no FORCE THE GATE
  prompt (`militaryInteract`/`militaryUI` skip it). On foot he halts the player within 160 units; past the arm without
  papers he calls him back until `FORT_COVER_GATE.grace` (56 units), then the challenge. Showing the ID runs
  `FORT_GATE_TALK` (about 16 s, `FORT_GATE_CLEARED_AT`) with the feet held (`fortGateTalking`, game-update.js);
  lines go through `fortGateLine` (bubble when short, subtitle via `missionLine` always). A weapon drawn cancels it.
  The gate arm is solid on foot (military-base.js): it lifts for him only through `fortCoverGatePass()` (waved
  through at `FORT_GATE_OPEN_AT`, or cleared and believed, on foot, no stars), in and out, and drops behind him.
- The records door (`FORT_RECORDS`) is at the HQ's far east end, about 83 m from the papers window: the walk along
  Sentinel Avenue passes the HQ pad's helicopter, the QRF jeeps and the ready line (M35, LAV-8). Boarding any of
  them (any military vehicle inside the fence or under cover) is `fortCoverBoarded`: cover blown, five stars.
  Tests: fort-gate-barrier.mjs, fort-records-route.mjs, fort-vehicle-theft.mjs.
- Base: fort-cover.js does the gate's papers (`FORT_COVER_GATE.check`), the soldiers' suspicion, the military-vehicle
  alarm and the records office (`FORT_RECORDS.door`, `fortCover.papers`). Blown before the papers: the job fails;
  this includes the gate stage before clearance (an alarmed identity can never be presented again).
  after: get out with them however. Out (calm crossing, or off the base 260 units from the gate): `skyMeetingBegin`.
- Meeting: the stage text follows `skyMeeting.stage` (skyline-meeting.js, places-sky-meeting.md); 'failed' (the
  consul killed) fails the job, 'done' wins it. A won job keeps the uniform on (`fortJobKeepsUniform`,
  cleanupMissionExtras); the next job, a death or a new game takes it off.
- Console: `fortJob()`, `fortSkip('arrive' | 'parked' | 'inside' | 'changed' | 'meet')` (always a fresh run).
  Tests: mission4-tail.mjs, mission4-paths.mjs, mission4-alert.mjs, fort-gate-talk.mjs (and fort-cover, lockpick,
  sky-meeting for the systems).
