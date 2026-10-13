# Mission 4: Borrowed Stripes, Kessler and the tail

Split out of missions-summit-and-fort.md (mission 3, the mission briefs). fortjob.js: the job, Kessler, his drive
and the tail. The trunk, the uniform, Fort Sentinel and the meeting: missions-summit-and-fort-fort.md.

- `FORT_JOB`: Kessler's house (`home`: Broadway, the building on the x 640 avenue just south of the Palm Sound
  Causeway boulevard; his car on the avenue's east kerb at (674, 3420), nose north; not on the boulevard itself, which
  the elevated Shore Line covers; the entry's `start` is the pavement outside), his kerb on Marina Rd opposite the Marea (north side: he
  arrives westbound) and his walk to the door. Stages are `FORT_STAGE` (tail 1, parked, trunk, take, change, gate,
  inside, out, meet; 0 was the old stakeout at the fort and is unused, the numbers are kept).
- Story: Lieutenant Dale Kessler (logistics) is off duty at the Marea; his uniform and ID open Fort Sentinel's gate,
  the records office holds the HAWTHORN weapons file, Consul Anton Varga buys it at CIRRUS. Every step opens with a
  mission brief (`fortStage` = setStage + `missionBrief`, mission-brief.js) and a line from Vinny.
- Vinny's call gives the lockpick (`giveLockpick`, arsenal slot 8) and `startFortJob` puts Kessler at once in his car
  at his kerb (`fortHomeSpot`: the first spot back along the kerb `canSpawnCar` allows), already pulling away (about
  50 s to the Marea over the causeway): a red `muscle` car, `mission` (never retired, burns slowly), `missionDriver:
  'kessler'`, `trunkLoot` UNIFORM AND ID, driving `countyRoute` = `fortRoute(home)` (the pull-out into the westbound
  lane, then the navigation graph held to the right lane, as the cabs drive it). Taking the job never resets the world
  (only WASTED / BUSTED do, and those fail the job), so a reset never takes him; a wreck at his kerb is skipped. The opening brief (kicker THE JOB) names his house; the objective is his
  car from the first frame. Wedged for 9 s he skips a node only where `spotUnseen` both ends. The wrap guard sends
  `countyIndex` back to the end only when it drops to 0 from further along (`m.routeIndex`).
- His car stays pristine on the way (`fortKeepPristine`): while he drives, not alerted and never touched by the player
  (a hit with `lastAttacker` the player, or the player's car within 90 units), any damage or stain is mended the same
  frame (`repairVehicle`), so nothing is ever drawn bent. The old start drove him through the fort's gate arm
  (military-base.js), which sprang his door. The report's `car.condition` (hp share, dents, sprung parts, stains, door,
  trunk) is what mission4-tail.mjs checks.
- Parking (`FORT_JOB.park`, y 5214): flush with Marina Rd's north kerb (kerb gap ~1 unit, inner side 25 off the
  centre line: clear of the lane's line), never in his lane. `fortRoute` trims lane points within the run-in and
  ends with the pull-in (`parkRun` back along his lane, `parkLane` 10 over to the kerb, then the spot); his car
  carries `countyRouteStop` (county-build.js countyRouteControl: holds the last point and eases to rest at a quarter
  g), and he parks once at rest within 8 units (or, held short by something in his spot, at rest within 70 after 3 s).
  His house spot is the avenue's east kerb (gap ~1). Console `kerbFit()` measures it; tools/tests/mission4-kessler.mjs.
  On his way a knock from traffic only makes him honk (crowd-traffic.js `crowdCrash`: a `missionDriver` never gets out
  to argue, which read as his car taken), and on the city grid he slows only for people on the road, not the
  pavement's crowd (countyRouteControl).
- The tail: `tailHeat` rises on his bumper (within `tooClose`) or close behind him while he moves; held up behind him
  in traffic or at a drawbridge does not count. At 1 he made the tail (fail). Far behind him is never announced (no
  "lost him": the map shows his car all the time); the objective stays on the car. The meter shares `#stealthStatus`
  (fortJobUI after roofMissionUI).
- Waiting at the club (`fortClubWait`): the player within `clubNear` (1100) of his kerb, his car over `clubFar` (1700)
  away, for `clubWaitSeconds` (10):
  the car is put on the nearest route point at least `clubJumpMin` (1150) from his kerb, or a few before it, that
  `spotUnseen` and `canSpawnCar` allow (`m.jumped`): never round the corner from the club.
  City traffic at the Marina Rd junction can still hold him a while (`fortJob().blocker` says what is in his lane).
- Shot at at the wheel (`fortAlerted`): a hit on his car within 0.6 s of him driving, or a round fired within 320
  units: KESSLER ALERTED THE MILITARY (announce), `crime(32, 'seen')` + `setWantedLevel(5)`, a red brief; he bails
  and runs (`ejectDriver`), the car unlocked with the keys in it (`m.keys`). His ID still works at the gate once
  the stars are gone (Vinny: the army takes days to cancel anything). Carjacking him is not an alert.
- `missionDriver` is declared in makeCar and copied to the driver on foot by `makeCarDriver` (carjack.js), so a
  carjacked, crashed or parked Kessler is still `fortKessler(m)`; the crowd streamer never moves him
  (`streamableWalker`). His walk to the door is `p.missionWalk`, run by `updateMissionWalker` (game-people.js) until
  a reaction takes over; at the door he leaves the world.
