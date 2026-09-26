# Testing and the developer console

## Checks, fastest first

```
sh tools/quick-check.sh [tag]                  # syntax + build + FILEMAP + conflict markers, no browser
sh tools/check.sh [tag]                        # syntax gate only (assemble + node --check)
python3 tools/build.py --out dist/game.html    # scratch build (dist/ is ignored)
node tools/smoke.mjs dist/game.html dist/smoke # boot, walk, drive, map: console errors + 5 screenshots
node tools/tour.mjs steps.json dist/tour dist/game.html   # scripted screenshot tour
node tools/layout-audit.mjs dist/game.html     # overlaps in the city plan (28-39 oblique-junction notes are normal)
node tools/media-check.mjs dist/publish/index.html        # streamed radio tracks load (split build)
sh tools/check.sh dead && node tools/dead-code.mjs dist/check/dead.js   # unused functions and bindings
```

- The `tag` keeps parallel worktrees from overwriting each other's `dist/check/<tag>.*`.
- Run smoke (one browser at a time) when a change touches boot, rendering, input, the HUD or
  anything you cannot prove from `sh tools/quick-check.sh` and console calls. Its expected
  output: 0 errors (the three.js "build/three.js is deprecated" warning is normal).
- `tools/dead-code.mjs` hits need reading: a name used only from the console or built from a
  string does not count as used.

## Headless browser

- Playwright + SwiftShader; Chromium at `/opt/pw-browsers` (never `playwright install`), the
  Playwright module at `/opt/node22/lib/node_modules/playwright`. It renders a few frames a
  second, so game time is clamped per frame: toasts look "stuck" and waits must be longer.
- Booting takes a minute or more. Run **one browser at a time**. For a long investigation
  keep one page open and send it console calls (a small Playwright script with an HTTP
  endpoint that runs `page.evaluate`) instead of re-running a tour per question.
- Call `DeadEndCity.graphics('high')` before judging an image (SwiftShader auto-detects LOW).
- Open the page with `?dev` for dev-only console paths (e.g. `startMission` on demo-gated
  jobs), `?shadercheck` to have three.js report shader compile errors.
- Take screenshots only to prove a visual point; prefer console reports (numbers) otherwise.

## Tours (tools/tour.mjs)

Starts a game, declines the opening call, runs steps in order. Each step may run page JS
(`js`, which sees only window globals such as `DeadEndCity`), press keys (`keys`: [code, ms]
pairs), hold keys through the shot (`hold`), wait, and screenshot unless `"shot": false`:

```json
[
  { "name": "harbor", "js": "DeadEndCity.look(3000, 4000, 0.6)", "wait": 2500 },
  { "name": "fly", "js": "DeadEndCity.drive('helicopter', 150)", "keys": [["KeyW", 1500]] },
  { "name": "stats", "js": "DeadEndCity.stats()", "shot": false }
]
```

## The console: rules

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

## Console reference

One table per console group in `docs/console/`. Find a method with
`grep -rn 'brakeTest' docs/console/` rather than reading them all.

| Group | Source | Methods for |
| --- | --- | --- |
| [core](../console/core.md) | `src/game-console-core.js` | Basics: version and scale, status, teleport/look, clock and zoom, stepping the simulation, the action key, health, god mode, cash, walking (+ `godPanelConsole()`) |
| [missions](../console/missions.md) | `src/game-console-missions.js` | Missions and the public demo: start a job, its state and targets, stage-skipping shortcuts |
| [police](../console/police.md) | `src/game-console-police.js` | Police and combat: wanted level, police report, shot log, overhead cover, the Apache, weapons, roadblocks, Fort Sentinel |
| [vehicles](../console/vehicles.md) | `src/game-console-vehicles.js` | Vehicles and driving: spawn, board, place, steer, telemetry, repair and respray, off-road trails (+ `damageConsole()`, `handlingConsole()`, `dealershipConsole()`) |
| [world](../console/world.md) | `src/game-console-world.js` | World and places: map probes, the plan as data, terrain and towns, weather, airfields, rooftops, the drawbridge, GPS, Monarch Isle |
| [rides](../console/rides.md) | `src/game-console-rides.js` | Passenger rides: bike share, cabs, trains, the liner, the ride skip, the superyacht |
| [leisure](../console/leisure.md) | `src/game-console-leisure.js` | Beach, sea and leisure: swimming, beach, sea life, the Marea club and pool, volleyball, Sunset Pier (+ `sportsConsole()`, `sportsbookConsole()`) |
| [crowd](../console/crowd.md) | `src/game-console-crowd.js` | People: crowd report, shots and alarms, street scenes, lineups, speech bubbles, crowd render cost |
| [graphics](../console/graphics.md) | `src/game-console-graphics.js` | Graphics and render probes: quality, render scale, frame stats, post views, shadow and draw-call probes, scale audit, model lineups |
| [settings](../console/settings.md) | `src/game-console-settings.js` | Settings, key bindings and the car radio (+ `audioConsole()`) |
