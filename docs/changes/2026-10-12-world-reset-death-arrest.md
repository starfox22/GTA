# The world resets only on death and arrest
- Taking a job at the payphone no longer resets the world: traffic, wrecks, damaged cars, blood, bodies and the police
  pursuit with its wanted level all carry on as they are; only earlier jobs' own vehicles and actors are removed.
- A pick in the mission picker and RESTART CURRENT JOB no longer reset the world either (they still start the job
  clean at the spawn: its vehicles and actors fresh, the police cleared as before).
- BUSTED now resets the world like WASTED: wrecks, damage, blood and bodies gone after the release from Police HQ.
- Internals: `resetWorld(reason)` callers are `die` ('wasted'), `bust` ('busted') and `newGame`; the `onlyIfStale`
  argument is gone. `startMission(livePursuit)` / `resetMissionState(livePursuit)` keep the police for the payphone
  call. New console method `arrest()` (police group); tools/tests/world-reset.mjs covers all four paths.
