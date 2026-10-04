# Testing and the developer console

Checks, the headless browser, the dev server, tests and tours. The `DeadEndCity` console's
rules and method index: docs/console/README.md.

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
- Run smoke (it takes a browser slot) when a change touches boot, rendering, input, the HUD or
  anything you cannot prove from `sh tools/quick-check.sh` and console calls. Its expected
  output: 0 errors (the three.js "build/three.js is deprecated" warning is normal).
- `tools/dead-code.mjs` hits need reading: a name used only from the console or built from a
  string does not count as used.

## Headless browser

- Every tool launches Chromium through tools/browser.mjs: Playwright + SwiftShader by
  default. In the cloud image it finds Chromium at `/opt/pw-browsers` (never `playwright
  install` there) and Playwright at `/opt/node22/lib/node_modules/playwright`; elsewhere set
  `CHROME_PATH` / `PLAYWRIGHT_MODULE` or install Playwright. `DEC_GPU=1` uses a real GPU
  instead of SwiftShader (a desktop run: much faster, GPU-true screenshots).
- SwiftShader renders a few frames a second, so game time is clamped per frame: toasts
  look "stuck" and waits must be longer. A rendered boot takes 30-40 s (960x600) and runs
  about 1 fps (0.25 fps at 1280x800); each software-rendered page wants a whole CPU core.
- **Browser slots**: a machine-wide limit on game browsers (lock files in the OS temp dir,
  shared by every worktree; `DEC_BROWSER_SLOTS`, default half the cores = 2 on the 4-core
  cloud machine). smoke, tour, layout-audit, media-check and the dev server take a slot
  and wait (printing who holds them) when none is free; a dead holder's slot is reclaimed.
  Use the dev server rather than writing a Playwright script.

## Dev server (tools/dev.mjs) and tests (tools/test.mjs)

```
node tools/dev.mjs start [html] [--render] [--nodev] [--shadercheck] [--size WxH]  # boot once (reuses a running one); --shadercheck: shader compile errors as console errors
node tools/dev.mjs call brakeTest sedan 100 '{"wet":1}'   # a NAMED console method, JSON args
node tools/dev.mjs keys KeyW,KeyD 3    # simulate(3, keys): game seconds, no drawing (--real: key presses)
node tools/dev.mjs wait 5              # simulate(5) (--real: wall-clock wait)
node tools/dev.mjs mouse 480 300 2 --down --keys KeyW   # the real pointer at a pixel, button/keys held 2 s (tests: t.mouse)
node tools/dev.mjs shot name [--crop x,y,w,h] [--width 480] [--full]  # dist/dev/shots/name.jpg
node tools/dev.mjs errors | status | reload [--render|--norender] [--keep] [--shadercheck] | stop
```

- With no html, `start` builds `dist/dev/game.html` and `reload` rebuilds it (browser reused;
  each boot gets a fresh browser context: no saved game or settings carried over; `reload
  --keep` reopens the page in the same context, to check what a save restores). State in
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
- **Measuring the simulation** (docs/audit/performance.md, "Simulation side"): `node tools/dev.mjs call
  <method> ... --cpu` adds the page's main-thread CPU time of the call (a busy machine inflates
  wall-clock ms, not this); `--profile N` lists the N heaviest functions of a V8 sampling profile (self
  and total ms, hot lines), `--profile N --who <function>` the callers of one hot helper, `--who bursts`
  the longest single calls of each `update()` section in CPU ms (GC pauses and stalls show up there:
  that is how a 100 ms minimap stall was found); `--alloc N` the biggest allocators by bytes.
  `DEC_JS_FLAGS="--no-turbo-inlining"` (env, at `start`) makes a profile name the real function.
  `DeadEndCity.simProfile(seconds, keys)` is the scenario report to call under them.
  A/B two builds by alternating the same call on two dev servers and comparing medians and minima:
  one run is noise on a shared machine.
- **Hiccups** (docs/areas/rendering-hiccups.md): `node tools/hitches.mjs` runs a fixed tour through
  `hitchRun` (every frame's sections and what happened in it, src/frame-trace.js) and prints long frames
  and their causes per stage; `--ab A.html B.html` runs both builds ABBA on one server; `--live` records
  real frames with the browser's style and layout time (`node tools/dev.mjs metrics`).
- Call `DeadEndCity.graphics('high')` before judging an image (SwiftShader auto-detects LOW).
- Open the page with `?dev` for dev-only console paths (e.g. `startMission` on demo-gated
  jobs), `?shadercheck` to have three.js report shader compile errors.
- Take screenshots only to prove a visual point; prefer console reports (numbers) otherwise.

## Long-session soak (tools/soak.mjs)

```
node tools/dev.mjs reload                        # a fresh no-render page (the soak runs on the running dev server)
node tools/soak.mjs --minutes 30 --every 30 --seed 1 --tag base     # dist/soak/base.json + the growth table
node tools/soak.mjs --table dist/soak/base.json                     # print a saved run's table again
node tools/dev.mjs heap                          # JS heap after a full collection, DOM nodes, event listeners, live Web Audio nodes
node tools/dev.mjs call simProfile 8 --retain 30 # what a call left ALIVE after a collection, by allocation site (a leak's source)
```

A seeded bot plays the page through the console with the frame loop held (`holdSimulation`, stepped by
`simulate()`): walks, drives every kind of vehicle, shoots, runs people over, blows things up and sets cars
alight, gets chased, busted and killed (the real-time WASTED and BUSTED waits included), shops, rides trains and
cabs, flies and parachutes, changes weather and time, opens the menus and the map, saves (the pause menu), and
starts the first two jobs. Every `--every` game seconds it records `soakReport()` (the size of every list, log and
cache the game appends to, DOM nodes per container, NaN/Infinity in positions), the heap, DOM nodes, listeners
and Web Audio nodes (`dev.mjs heap`) and the console errors; every `--probe` seconds it profiles one fixed scene
(`simProfile`, CPU ms per frame) to show a session slowing down. The table lists what grew (rising slope, at
least 60% of the steps not falling), then the rest. `seedRandom` seeds the game's own randomness, so the same
`--seed` replays the same world and the state hashes of two builds can be compared. A console method that
throws, a console error or a non-finite position is a finding: fix it with a test. The page has no renderer
here, so renderer-side leaks (meshes, textures) are not covered. `tools/dup-functions.mjs` (run by
quick-check.sh) fails when two fragments declare the same function name: one closure, so the later one
silently replaces the earlier (`routeLength` did).

## Random-walk bot (tools/bot.mjs)

```
node tools/bot.mjs --seed 1 --minutes 30 [--wall 900] [--render] [--only teleport,drive,...] [--verbose]
```

Plays seeded random free-roam actions on the dev page (starts one with `?test&norender`, the demo gate live, or
reboots a running one for a clean page; `--render` boots the rendered page): teleports to every island and door,
every vehicle class, shooting, run-overs, police and arrests, deaths, menus and random real keys, settings, graphics
tiers, weather and time, rides, swimming and falls, a gamepad and the mouse, rebinding the action key, garage jobs, save
and reload. After each action it checks console errors, `DeadEndCity.integrity()` (docs/console/integrity.md), a mode
that never returns to play, a carrier held too long, a trapped player or road vehicle, the respawn rules, the saved
state, and every eighth action `settleAudit()`. Same seed, same choices (the game's own randomness is not seeded).
Findings print as `FINDING` lines and land in `dist/bot/seed-<n>.json` with the last eight actions before each;
exit status 1 when there are any. About 2 game minutes per wall minute on a loaded machine (idle stretches are the
cheap way to add game time). A finding is a lead, not a verdict: reproduce it with `dev.mjs call` before fixing.
Runs in this repo's history: seeds 2-4, 30 game minutes each, in the October 2026 free-roam pass (docs/audit/freeroam-sweep.md).

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

## The console

Rules (named methods only, how to add one) and the per-group method tables:
`docs/console/README.md`.
