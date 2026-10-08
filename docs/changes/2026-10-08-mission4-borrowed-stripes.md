# Mission 4: Borrowed Stripes

- New mission 4 (replaces Paper Trail), playable in the demo, which now ends after it: Vinny gives you a lockpick
  and a name. Watch Fort Sentinel's gate from the end of the causeway; PFC Dale Kessler drives out in a red muscle
  car on his day off. Tail him across the city to the Marea Beach Club (a meter shows when he is checking his
  mirrors; sit on his bumper and he makes you, fall too far behind and he is gone).
- The quiet way: let him park and walk into the club, then pick his trunk with the lockpick while nobody close is
  looking. The messy way: run him off the road or kill him for his keys, with the witnesses and police that brings.
- His duffel bag holds a field uniform and his ID. Change in a parked car (or anywhere out of sight), walk up to the
  fort's gate and show the papers, walk to HEADQUARTERS' records office without raising the soldiers' suspicion
  (fort-cover), take the confidential weapons papers and walk out the front gate calmly. Blown cover turns the
  whole base on you; any military vehicle you get into sounds the alarm.
- Deliver the papers to Consul Anton Varga at the door of the EVOLUTION tower: the lift up together, his reserved
  table at CIRRUS, a cocktail each and the handover (skyline-meeting). Mission complete, and you keep the uniform.
- Internals: fortjob.js (`FORT_JOB`, `FORT_STAGE`, `fortRoute`, `updateMissionWalker`), `missionDriver` on vehicles and
  drivers on foot, `lockpickWatcher` (vehicle-trunk.js); the demo gate at four missions. Console `fortJob()`,
  `fortSkip(where)`; tests mission4-tail, mission4-paths, demo-free-roam-markers through all four.
