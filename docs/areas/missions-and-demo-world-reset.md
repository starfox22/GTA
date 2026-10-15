# World reset (world-reset.js)

The owner's rule: when the player dies or is arrested, everything in the world returns to normal. Taking a job never
resets it: the world carries on exactly as it is.

## When

- **WASTED**: in the respawn (game-player-actions.js `die`), after the hospital teleport and `failMission`.
- **BUSTED**: in the release (pursuit-officers.js `bust`), after the Police HQ teleport, the fine and `failMission`.
  The car he was pulled from goes with the old world (owned dealership cars come back to their bays).
- **New game** (game-menus.js `newGame`).
- **Never on a job**: the payphone call taken (story.js `offerMission` → `startMission(true)`), a pick in the mission
  picker (campaign.js `chooseMission`) and RESTART CURRENT JOB (story.js `retryMission`) leave traffic, wrecks, damage,
  blood and bodies alone. `resetMissionState` (game-cops.js) still removes the jobs' own entities: `mission` /
  `failedMission` vehicles, `missionPursuit` / `reconPatrol` cars and their officers, tagged story actors, Elena,
  enemies, set pieces (`cleanupMissionExtras`). The payphone call (`livePursuit`) also keeps the police pursuit and
  wanted level; the picker and RESTART still clear the police, as a fresh start of the job (they teleport to the
  spawn). The console's `startMission(i)` shortcuts behave like the picker.

## What resets

- Entities are rebuilt by `populateWorld()` (populate, populateStoryWorld, populateCounty) from the boot seed
  (`worldPopulateSeed`), so parked cars, boats, the motor pool, ships and crews stand where they stood at boot; the
  running random stream is handed back afterwards. Every wreck, abandoned or damaged car, stain, body, panicked
  walker, fire, scorch and skid goes with the old lists.
- Each subsystem clears its own leftovers through its own helper, called from `resetWorld`: `clearPolice` /
  `resetOfficerCrews` (stars, units, witnesses, roadblocks), `clearCarStains` per old vehicle, `resetWreckPass`,
  `clearBleeders`, `resetCrowdLife` (incidents, bodies, people indoors, street scenes), `restoreAllStreetProps`
  (knocked furniture and trees, strain), `dealershipWorldReset` (test drive, alarm, display restocked).
- The renderer reads `worldResetSerial`: damage3d-world.js `clearWorldDamage` empties the world decal ring (chips,
  cracks, scorch, craters, oil, shards, blown windows), rubble and torn panels, and stands the shop panes whole.
  fx3d-particles.js empties the effect pool (the old world's smoke and flames) on the same serial.
- The crowd renderer's vehicle transition tracker also reads the serial. A respawn/retry cut does not
  animate a door exit from the previous world's car, or an entry into a car supplied by the new world.
- A new system that keeps world damage or holds vehicles or people outside these lists adds its own reset helper
  and calls it from `resetWorld`; renderer-held damage watches `worldResetSerial`.

## What is kept (progress)

Cash, weapons and ammunition, armour, the story and contract pointers, campaign stats, sportsbook bets, settings, the
dealership's owned cars (brought back repaired to their bays: `keepOwnedCars`), the clock and weather, drawbridge
timetables. Nothing about the world is in the save.

`resetWorld` snapshots `sportsbookSaveData` before repopulating on WASTED/BUSTED
and restores it with `loadSportsbook`. Population rebuilds sports match objects:
the existing book update rebinds a bet on the same upcoming fixture, or voids and
refunds an interrupted live match once. History, statistics and the next bet id
survive. NEW GAME still clears the book. `world-reset-sportsbook` exercises the
actual reset, placement, save-restore and settlement functions together.

## Cover

Callers move the player first (`teleportPlayer`), so the view cuts; `#worldResetFade` (base.css, z-index 6, under the
HUD) then fades the new scene in from black over ~1 s. The reset itself costs ~50 ms on the no-render page.

Console `worldResetReport()` (docs/console/missions.md); tools/tests/world-reset.mjs.
