# Campaign saves, replay and public demo gates

## Campaign and saves (campaign.js)

- Save schema in localStorage `dead-end-city-v1`: campaign indices, cash, clock, weapons,
  ammunition, `stats` (`campaignStats`: play time, cash earned, wanted peak), sportsbook bets.
  Schema 12 also stores `retryJobIndex`: the running job's index, or the last failed/abandoned
  job. Load accepts only an integer within the mission list that the story/demo picker allows.
  Old saves without the field load normally with no pending retry.
  Progression frontier decides what the picker offers; a job played ahead of the story does
  not advance the campaign.
- `save()` runs on events (a job's end, WASTED, BUSTED, a purchase, a garage, a skipped
  ride) and whenever play pauses, which leaving the tab does: nothing earned in free roam
  waits for the next event. Check a save with `node tools/dev.mjs reload --keep`.
- WASTED and BUSTED reset the world (`resetWorld`, missions-and-demo-world-reset.md); taking a job (payphone, picker, RESTART
  CURRENT JOB) never does, it removes only the jobs' own vehicles and actors (`resetMissionState`).
- WASTED wakes the player at `nearestHospital()` (game-player-actions.js; THE HALCYON CLINIC
  only on and round Monarch Isle), BUSTED at the Police HQ (`policeRespawnPoint`). The first
  hospital in `PLACES` (Saint Marlow) keeps the rooftop helipad.

## Public demo (`DEMO_BUILD`, game-state.js; campaign.js PUBLIC DEMO)

- `DEMO_BUILD = true` today. A normal player gets missions 1 to 4 (`DEMO_MISSIONS` = 4); later
  jobs show locked and nameless (`???`, `missionPickerTitle`) with a FULL GAME badge and a buy note
  (a story job not reached yet is `???` too). The payphone stops ringing after
  mission 4 (`storyCallWaiting`), and winning it with the story at its end (`completed` reaches 4, god mode
  too) shows the DEMO COMPLETE card (`showDemoComplete`, game mode `'demo'`, thanks, the buy note, a recap from
  `campaignStats`; Escape or CONTINUE FREE ROAM dismisses it) once per save: `demoCardSeen` is saved with the
  story, and a loaded save that finished the demo without it gets the card soon after play resumes
  (`demoCardOwed`); after that a replay of mission 4 is just a payday. Completion is also kept
  in `dead-end-city-demo` (the title badge). `demoLocked()` is the gate. Console `storyProgress(n, cardSeen, owed)`
  (tests); tools/tests/demo-complete-card.mjs.
- `missionIndex` is the frontier **and** the job a replay picked (`chooseMission`), so a
  declined or failed replay calls `settleDemoStoryIndex()` (also on load and when god mode is
  switched off): without god mode the index goes back to `completed`, so the payphone offers the
  story's next job (none past the demo; otherwise `storyCallWaiting()` kept the payphone arrow,
  pager and HUD pill up). God mode keeps its pick. Every pointer reads `objective()`; console
  `pointers()` reports them all.
- RESTART CURRENT JOB (`retryMission`) restarts `restartableJob()` (story.js): the job running,
  else the last one failed (WASTED and BUSTED fail it), or an unfinished job restored from a
  save, remembered in `retryJobIndex` while the picker offers it. After a win or at a new game there is none: the
  pause menu shows it disabled, NO JOB TO RESTART; a waiting call is taken at the payphone.
  After reopening the browser, an unfinished job can be restarted from its beginning. This is
  **not a mid-stage checkpoint**: its vehicles, actors, timer and stage are rebuilt normally;
  reload preserves saved ammunition, while restarting retains `resetMissionState()`'s existing
  restock (owned weapons get a full magazine and at least five spare magazines). Cash and
  rewards keep their existing rules. `tools/tests/mission-retry-save.mjs`
  covers demo jobs 1–4, replays, invalid/locked/old saves and clearing on completion/new game.
- CHOOSE MISSION while a job runs asks ABANDON <JOB>? (`showAbandonConfirm`, campaign.js; the
  `#abandonConfirm` dialog over the picker): ABANDON JOB (Enter, A, E) ends it through
  `abandonMission` (no JOB FAILED card; RESTART CURRENT JOB can bring it back) and the pick's
  call comes up; KEEP PLAYING (Escape, B) goes back to the job.
- Never gated (not missions): the hill climb, volleyball, the stadium ball, the pier rides,
  bike share, cabs, rail, the liner, casino, garages, gun shop, Fort Sentinel, the Apache,
  MONARCH MOTORS.
- God mode lifts every gate; the console's `startMission` reaches a gated job only with god
  mode or `?dev`. `DEMO_BUILD = false` is the full game with no trace of the demo.
