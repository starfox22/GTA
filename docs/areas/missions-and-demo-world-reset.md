# World reset (world-reset.js)

The owner's rule: when the player dies or picks a new mission, everything in the world returns to normal.

## When

- **WASTED**: in the respawn (game-player-actions.js `die`), after the hospital teleport and `failMission`.
- **A pick in the mission picker** (campaign.js `chooseMission`, after the teleport to the spawn).
- **RESTART CURRENT JOB** (story.js `retryMission`: the job's leftovers first, `resetMissionState`, then the reset,
  then `startMission`).
- **A job call taken** (story.js `offerMission`'s accept), skipped when no game time has passed since the last reset
  (`resetWorld(reason, true)`: a pick and its call are one reset).
- **New game** (game-menus.js `newGame`).
- Not on BUSTED, not on the console's `startMission(i)` shortcuts (tests start jobs mid-world on purpose).

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
- A new system that keeps world damage or holds vehicles or people outside these lists adds its own reset helper
  and calls it from `resetWorld`; renderer-held damage watches `worldResetSerial`.

## What is kept (progress)

Cash, weapons and ammunition, armour, the story and contract pointers, campaign stats, sportsbook bets, settings, the
dealership's owned cars (brought back repaired to their bays: `keepOwnedCars`), the clock and weather, drawbridge
timetables. Nothing about the world is in the save.

## Cover

Callers move the player first (`teleportPlayer`), so the view cuts; `#worldResetFade` (base.css, z-index 6, under the
HUD) then fades the new scene in from black over ~1 s. The reset itself costs ~50 ms on the no-render page.

Console `worldResetReport()` (docs/console/missions.md); tools/tests/world-reset.mjs.
