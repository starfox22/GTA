# Lose-the-police timer: shorter, honest, never stuck
- The time to lose the police is shorter: 5 / 7 / 10 / 14 / 19 s out of sight by stars (was 6 / 9 / 13 / 18 / 24).
- The TO LOSE POLICE countdown is on screen only while it is really counting down at full speed: out of sight
  and outside the search area. Inside the search circle (where the clock only creeps, now at a quarter speed)
  the panel says LEAVE THE SEARCH AREA instead, and while units are still on their way to a 911 call (the clock
  waits) it says UNITS RESPONDING. The old frozen "6s" / "5s" was the clock held for a 911 response, or crawling
  inside the circle, or a unit at the edge of its view restarting it many times a second.
- Police sight is debounced for the clock: a sighting restarts it only after 0.3 s, a search begins after 0.6 s out
  of sight; a glimpse just re-centres the search circle on the player.
- Internals: `searchClock` / `searchClockShown()` (citylife-civic.js SEARCH CLOCK); the police panel writes the DOM
  only on change; `policeReport().search` adds `clock` and `shown`. Test: tools/tests/police-search-clock.mjs.
