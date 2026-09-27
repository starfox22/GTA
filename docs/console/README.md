# The developer console (`window.DeadEndCity`)

How tests and tools reach the game. Test tools and the dev server that call it:
docs/areas/testing-and-console.md.

## Rules

- `window.DeadEndCity` is the only way tests reach the game. `src/game-console.js` holds the
  registry: each `src/game-console-<group>.js` (or a feature file) calls
  `addConsoleMethods('<group>', { ... })` with its methods, and the end of game-console.js
  copies every group into one frozen object. A name registered twice logs a console error
  (smoke fails) and the first one is kept.
- It has **explicit named methods only**. Never add a generic code-evaluation hook (eval,
  `Function`, "run this string", arbitrary property get/set): a security rule. When a test
  needs something, add a named method that does exactly that and document it.
- Adding a method: put it in the area's `game-console-<group>.js` (or register a
  `<feature>Console()` from there, as damage.js and sports-frame.js do), add a row to that
  group's `docs/console/<group>.md`, and add a changelog fragment line.
- Methods may call each other as `this.status()`: `this` is `window.DeadEndCity` when called
  as `DeadEndCity.name()` (use shorthand methods, not arrows, when you need `this`).
- Players can use it too from the browser console, so keep methods safe and deterministic.
- Methods that change the world (teleport, drive, setClock…) are fine; they must go through
  the same paths as play (`teleportPlayer`, `godTeleport`, `simulate`).

## Groups

One table per console group in this folder. Find a method with
`grep -rn 'brakeTest' docs/console/` rather than reading them all.

| Group | Source | Methods for |
| --- | --- | --- |
| [core](core.md) | `src/game-console-core.js` | Basics: version and scale, status, teleport/look, clock and zoom, stepping the simulation, the action key, health, god mode, cash, walking (+ `godPanelConsole()`) |
| [missions](missions.md) | `src/game-console-missions.js` | Missions and the public demo: start a job, its state and targets, stage-skipping shortcuts |
| [police](police.md) | `src/game-console-police.js` | Police and combat: wanted level, police report, shot log, overhead cover, the Apache, weapons, roadblocks, Fort Sentinel |
| [vehicles](vehicles.md) | `src/game-console-vehicles.js` | Vehicles and driving: spawn, board, place, steer, telemetry, repair and respray, off-road trails (+ `damageConsole()`, `handlingConsole()`, `dealershipConsole()`) |
| [world](world.md) | `src/game-console-world.js` | World and places: map probes, the plan as data, terrain and towns, weather, airfields, rooftops, the drawbridge, GPS, Monarch Isle |
| [rides](rides.md) | `src/game-console-rides.js` | Passenger rides: bike share, cabs, trains, the liner, the ride skip, the superyacht |
| [leisure](leisure.md) | `src/game-console-leisure.js` | Beach, sea and leisure: swimming, beach, sea life, the Marea club and pool, volleyball, Sunset Pier (+ `sportsConsole()`, `sportsbookConsole()`) |
| [crowd](crowd.md) | `src/game-console-crowd.js` | People: crowd report, shots and alarms, street scenes, lineups, speech bubbles, crowd render cost; the living city (`livingCity`: traffic streaming, sirens, ambulances, street events) |
| [graphics](graphics.md) | `src/game-console-graphics.js` | Graphics and render probes: quality, render scale, frame stats, post views, shadow and draw-call probes, scale audit, model lineups |
| [settings](settings.md) | `src/game-console-settings.js` | Settings, key bindings and the car radio (+ `audioConsole()`) |
