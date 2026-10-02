# Missions 1 and 2: bug pass
- The mission card's sentence keeps a key's own name as it reads: "park in the loading bay · E to load" (it said "· e to load"), "collect guest clothes at Sunset Motel · E", "spike Vescari’s glass unseen · P".
- Touch controls on the Blue Hour terrace (mission 2): the walk action runs there, but the touch button, the hints and the stealth reminder still said WALK ("WALK TO BLEND IN · WALK TO RUN"). The button now reads RUN on the terrace (and "Hold to run" for screen readers), and the reminder says "HOLD RUN TO RUN".
- Console: `missionCard()` also returns `text` and `distance`; `roofStealth()` returns `label` and `hint` (the stealth box as shown); `inputHints()` samples the `walk` name.
- Tests: mission-card-keys, mission2-touch-run.
