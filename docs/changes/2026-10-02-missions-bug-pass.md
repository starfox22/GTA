# Missions 1 and 2: bug pass
- The mission card's sentence keeps a key's own name as it reads: "park in the loading bay · E to load" (it said "· e to load"), "collect guest clothes at Sunset Motel · E", "spike Vescari’s glass unseen · P". A gamepad's "A" is kept only behind the "·" or "HOLD", never in "as a guest".
- Touch controls on the Blue Hour terrace (mission 2): the walk action runs there, but the touch button, the hints and the stealth reminder still said WALK ("WALK TO BLEND IN · WALK TO RUN"). The button now reads RUN on the terrace (and "Hold to run" for screen readers), and the reminder says "HOLD RUN TO RUN".
- A 911 caller describing the player's vehicle says "an orange car", "an SUV", "an ambulance" (it said "A orange car, going northeast!" in the harbor shoot-out).
- Console: `missionCard()` also returns `text` and `distance`; `roofStealth()` returns `label` and `hint` (the stealth box as shown); `inputHints()` samples the `walk` name; `witnessCarLines(type, color, dir)`.
- Tests: mission-card-keys, mission2-touch-run, witness-car-lines.
