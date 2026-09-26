# Testing and the developer console

## Checks, fastest first

```
sh tools/quick-check.sh [tag]                  # syntax + build + FILEMAP + conflict markers, no browser
sh tools/check.sh [tag]                        # syntax gate only (assemble + node --check)
node tools/test.mjs [filter]                   # regression tests (tools/tests/*.mjs), no-render page, ~40 s
node tools/dev.mjs start | call <method> [args] | stop   # persistent headless page (below)
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
- A rendered boot takes 30-40 s (960x600) and runs about 1 fps (0.25 fps at 1280x800).
  Run **one browser at a time**; use the dev server below rather than writing a script.

## Dev server (tools/dev.mjs) and tests (tools/test.mjs)

```
node tools/dev.mjs start [html] [--render] [--nodev] [--size WxH]  # boot once (reuses a running one)
node tools/dev.mjs call brakeTest sedan 100 '{"wet":1}'   # a NAMED console method, JSON args
node tools/dev.mjs keys KeyW,KeyD 3    # simulate(3, keys): game seconds, no drawing (--real: key presses)
node tools/dev.mjs wait 5              # simulate(5) (--real: wall-clock wait)
node tools/dev.mjs shot name [--crop x,y,w,h] [--width 480] [--full]  # dist/dev/shots/name.jpg
node tools/dev.mjs errors | status | reload [--render|--norender] | stop
```

- With no html, `start` builds `dist/dev/game.html` and `reload` rebuilds it (browser reused;
  each boot gets a fresh browser context: no saved game or settings carried over). State in
  `dist/dev.json`, log in `dist/dev.log`; the port is per worktree.
- Default page: `?dev&norender`. **No-render mode** (`NO_RENDER`, render3d.js; honoured only
  with `?dev` or `?test`): no WebGL renderer, `drawWorld()` skipped (game-loop.js); the HUD
  and all logic run. Boot about 7-10 s instead of 30-40 s, real-time frames about 55 fps
  instead of 1 fps; `status().renderer` is `'2d'` and renderer-backed reports (draw calls,
  `scaleReport` models, crowd stats) are null. `--render` for images; `graphics('high')`
  before judging one. `--nodev` opens `?test&norender`: no dev bypasses (demo gate live).
- `call` prints one compact JSON line cut at 1500 chars (`--max N`, `--full`); NaN and
  Infinity come back as strings. It only calls named methods: there is no JS-string path.
- Every command notes new console errors; `errors` prints and clears them.
- `node tools/test.mjs [filter...] [--verbose] [--keep]`: rebuilds, (re)boots the dev server
  in no-render mode, runs `tools/tests/*.mjs` (one test per file; a line per test, a summary,
  exit 1 on failure; a console error fails the test). A test exports `default async (t)`
  using `t.call`, `t.keys`, `t.wait`, `t.assert`, `t.near(v, lo, hi, label)`, `t.finite(obj)`,
  `t.note`; optional `export const flags = 'test'` (no `?dev`) and `fresh = true` (page
  reloaded first; fresh tests run last). Set the state a test needs (cash, wanted level,
  god mode) instead of relying on the test before it. Frame-driven effects (e.g. sportsbook
  settlement) need a `t.wait()` after the call that causes them.
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
