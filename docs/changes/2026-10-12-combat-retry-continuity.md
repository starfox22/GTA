# Aiming poses, reload continuity and persistent job restart

- Holding right-button or controller shoulder aim in chase view raises the pistol, SMG
  or long gun before the first shot. The existing carried/aiming poses and rig blending
  are reused; street-view behavior is unchanged. Previously the camera aimed while the
  weapon remained lowered until the player fired or reloaded.
- Selecting a weapon already in hand keeps its ongoing reload. Switching to another
  weapon still cancels the reload, and ownership/vehicle restrictions still apply.
  A same-weapon selection also avoids a redundant inventory save and weapon redraw.
- An empty gun now directs the player to a gun shop or another weapon instead of the
  removed purple street ammunition crates.
- A world reset clears the renderer's old vehicle transition. A mission retry, new game
  or hospital respawn no longer plays a door-exit pose at the new spawn location.
- Save schema 12 remembers the unfinished/failed job's index. After reopening the browser,
  pause's RESTART CURRENT JOB can restart it from its beginning. This is **not a mid-stage
  checkpoint**: no actors, vehicles, timers or stage state are serialized. Reload preserves
  saved ammunition; restarting retains the existing job-start restock (owned weapons get
  a full magazine and at least five spare magazines). Cash and reward rules are unchanged.
  Completed/replayed jobs remain subject to normal
  unlock/demo gates; winning or starting a new game clears the pending retry. Legacy saves
  without the field load normally.
- `tools/tests/combat-continuity.mjs` executes actual pose/transition/selection functions
  in a host fixture. `tools/tests/mission-retry-save.mjs` covers demo jobs 1–4, completed
  replays, malformed/locked/legacy saves, clearing on win/new game and an in-browser
  pause-save → reload with saved ammunition → restart from stage zero with the existing restock.
