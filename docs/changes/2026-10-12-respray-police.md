# Respray loses the police when they did not watch you go in

- A respray clears the stars unless a police unit watched the car go in for half a second; a passing glimpse
  no longer spoils it (it used to count any unit with eyes on you at the moment you ordered).
- While units are watching, the garage prompt says COPS WATCHING; seen going in, THE COPS SAW YOU GO IN is told
  at once instead of after the bill.
- Cleared, every unit drops the chase and goes back to patrol, the paint changes, and nobody picks the car up
  again on the way out.
- The respray arrow's line now says to drive in out of their sight.
- Internals: `garageWatchStep` / `GARAGE_SEEN_CONFIRM` (garages.js); `garage().job.watched`;
  tools/tests/respray-lose-police.mjs.
