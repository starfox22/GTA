# Missions 3-4: step briefs, Kessler's alarm, the fort gate talked through

- Every step of High Ground and Borrowed Stripes opens with a big centred sentence saying what to do and why;
  after a few seconds it drops into the mission strip at the bottom (O folds it early).
- Borrowed Stripes: Kessler is now a lieutenant in logistics, and the story is spelled out (the HAWTHORN file,
  Consul Varga). You can tail him from the fort or wait for him at the Marea Beach Club; losing him sends you to the
  club instead of failing the job.
- Shoot at Kessler while he is driving and he radios the fort: KESSLER ALERTED THE MILITARY and five stars at once.
- Fort Sentinel's gate: driving up in uniform gets you sent to park outside (no shooting, no FORCE THE GATE prompt);
  on foot the sergeant reads your ID in a subtitled conversation (the roster, your cover story, the photo).
  Walking past the booth calls you back before the guards challenge you. The soldiers address you as an officer.
- New dialogue for Vinny, the gate sergeant, Kessler and Varga; Tommy Russo's buried package now sets up mission 4.
- Internals: mission-brief.js (`missionBrief`, `foldMissionBrief`), `FORT_GATE_TALK`, `fortGateLine`,
  `fortGateTalking`, `fortAlerted`, `fortClubWait`, `m.ownOpening`. Console `missionBrief()`; `fortJob()` reports
  `alerted`, `waitClub`, `jumped`, `blocker`. Tests mission-brief, mission4-alert, fort-gate-talk.
