# Witnesses call 911 and the chase starts
- Anyone who saw a shooting, a stabbing, a hit-and-run or a body (or heard the shots) now
  reliably phones it in: a second or two after the last shot one witness runs a short way,
  stops and makes a 5-8 s call; the police come only when it ends, as before.
- Monarch Isle's walkers (and promenade strollers, park guests) react to shots and crimes
  again: their own routines used to swallow what they saw, so nobody there ever called.
- The call is visible: phone at the ear and a 911 bubble for the whole call (what happened
  and where, a detail, "They're on their way."), ranked with police lines, with a red edge;
  a caller outside the bubble band is shown inside the frame with a tail pointing to them.
- The chase starts right after the call: the first unit is sent within 1-2 s (a second
  behind it), from the nearest junctions off screen, to the player if the caller can see
  them. Police searches on Monarch Isle and in the county no longer drive off to the city.
- Walking up to a caller cuts the call (they run and try again); only 2.5 s at gunpoint
  scares a witness silent, not a stray aim.
- Console: `witnesses()` lists each incident's witnesses and why they cannot call (`who`),
  and each call's bubble `line`; `witnessStage(..., isle)` stages Monarch Isle walkers.
  Test: tools/tests/witnesses-monarch.mjs.
- A carjacked driver always phones it in: no longer taken over by the car-theft incident,
  never recycled by the crowd streamer while the call is owed, and finishing the call off
  stage if the player is far away (the carjack test failed about 1 run in 3).
- Police answering a call on Monarch Isle no longer stall on the way: they go round Crown
  Circus (not across it into the fountain, whose collider no longer sticks into the ring),
  slow for sharp corners, steer past oncoming cars instead of shoving them, and a call's
  length shows from its first moment. Console: `reportCall`, `respondingUnit`; test police-circus.
