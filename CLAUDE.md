# Working on Dead End City

Start here, then read `docs/SOURCE_GUIDE.md` for the full map of the code. This file is the
short version: how to build it, the handful of rules that will bite you if you don't know
them, and how to check that a change actually works.

## What it is

An original top-down crime game set on the South Coast in 1997. It ships as **one HTML file**
you can open with no server, no CDN and no build step: `dead-end-city.html`. That file is
generated — never edit it by hand. Edit `src/` and rebuild.

Everything is plain, readable source, including the embedded Three.js r160. Do not minify,
obfuscate or pack it; readability is a deliberate property of this build, and the policy note
at the top of the generated file says so.

## Build and check

```sh
sh tools/check.sh          # assemble + node --check. Run after EVERY edit. ~2 seconds.
python3 tools/build.py     # write dead-end-city.html
node tools/smoke.mjs       # boot in headless Chromium, walk, drive, open the map, report errors
```

`check.sh` is the fast feedback loop. It catches the failure mode that matters most here:
because every file is spliced into one closure, a duplicate `const` in two different fragments
is a syntax error in the assembled file and invisible in the fragment you edited.

## The one architectural rule

The whole game is a single JavaScript closure. `src/main.js` wraps it in
`function startDeadEndCity(ASSETS) { ... }`; every other `src/*.js` is a **fragment** spliced
in where a `// @include src/<file>.js` directive appears.

Consequences:

- Fragments share every variable. **Never** use `import`/`export`, and never wrap a fragment in
  an IIFE or a function.
- Names are global to the closure. Before adding a `const`, check the name is free:
  `grep -rn "\bmyName\b" src/`. (`railSteel` collided this way once and cost a build.)
- Function declarations hoist across fragments, so call order between files is free. `const`
  and `let` do not — anything evaluated at include time must come after what it reads.
- There are **two** closures: the game closure, and the renderer closure
  (`createCityRenderer()` in `src/render3d.js`, with the `*3d.js` fragments inside it). The
  renderer reads game state and never changes game rules.

## Invariants that cause silent breakage

These are the ones that don't throw — they just quietly produce a wrong world.

**Axes are not interchangeable.** `ROAD_CENTERS` is the *column* list (x, 128..5248).
`ROAD_ROWS` is the *row* list (y, -3968..5248, because the city extends north into negative y).
Use `roadNear` for an x and `rowNear` for a y. Code that walks the grid on both axes must pick
the list that matches the axis it is on. Block indices keep their pre-reclamation meaning, so
`by` 0 is still y 128 and the northern blocks carry negative indices; `blockX`/`blockY` convert.

**The player is in exactly one carrier.** `player.car`, `player.roof`, `player.deck`,
`player.parachute`, `player.coaster`, `transitRide`, `taxiRide` and `player.swimming` are
mutually exclusive, and several of them pin the player's position every frame. Anything that
moves the player elsewhere must let go first — call `teleportPlayer(x, y)`, which does.

**Damage goes through one funnel.** `ballisticDamage()` in `combat-rules.js`. Call
`hurt(damage, kind)` and `strikePerson(person, damage, a, source, showBlood, kind)` with the
right `kind` rather than scaling numbers at the call site, or body armour stops working.

**Heights go through one function.** `entityElevation(e)` is the only correct way to compare
an actor on a roof, on terrain, on a ship's deck, in a sinking car or in an aircraft.

**`solid(x, y, r, overWater)`** is the collision test. The fourth argument is what lets the
player swim; only `moveBody` passes it, and only for the player on foot.

**Units.** 512 world units = 100 m. Headings are radians; Three.js model yaw is `-a`. Map
`(x, y)` becomes `(x, elevation, y)`. Timers are seconds; physics steps at a fixed 1/120 s;
`worldMinutes` advances one game minute per real second.

## Verifying a change

`check.sh` proves it parses. It does not prove it works. The game exposes a debug surface for
exactly this — `window.DeadEndCity` — and the way to test anything is to drive it headlessly:

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 580 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('file:///home/user/GTA/dead-end-city.html', { waitUntil: 'commit' });
// Poll for the API. Do NOT use waitForFunction: it is frame-driven and this page is slow.
for (let i = 0; i < 120; i++) {
  if (await page.evaluate(() => !!window.DeadEndCity).catch(() => false)) break;
  await page.waitForTimeout(3000);
}
await page.evaluate(() => document.getElementById('startBtn').click());
await page.evaluate(() => window.DeadEndCity.teleport(2820, -2500));
```

`status()`, `teleport`, `setClock`, `setZoom`, `startMission`, `missions`, `god`, `wanted`,
`containment`, `roadblocks`, `sky`, `cab`, `bike`, `ride`, `stats`. Add to it when you add a
system — a thing you cannot reach from a script is a thing you cannot test.

Two facts about the headless harness that will otherwise waste your time:

- It renders through SwiftShader at **one to two frames per second**, so game time advances
  perhaps 0.03 s per wall second. A ten-second wall wait is a fraction of a game second.
  Anything you time must be read from state, not inferred from waiting.
- Screenshots need a long timeout (120 s+) for the same reason, and a page-load wait must poll
  with `page.evaluate` rather than `waitForFunction`.

Screenshots are worth taking. Several problems in this codebase were only ever visible in one
— cloud billboards smeared over the sea, a financial district built as warehouses, a swimmer
walking upright through the bay.

## Conventions

- **Comments explain why, not what.** The code says what it does. A comment earns its place by
  recording the reason, the constraint, or the bug that shaped it. Several blocks here name the
  bug they exist to prevent; keep that.
- Every fragment opens with a `BEGIN SUBSYSTEM` marker and a header naming its source file,
  its scope (`shared game closure` or `createCityRenderer() closure`) and what it covers. Keep
  the header true — a stale one is worse than none.
- When you change behaviour, change the prose that described the old behaviour in the same
  commit. Grep for the thing you removed.
- `docs/CHANGELOG.md` is a record, not a description of the present: old entries stay as they
  were written even when the world has moved on.
- Bump the version in **both** `src/shell.html` (the banner) and `src/game.js`
  (`DeadEndCity.version`), and add the subsystem to the index in `src/shell.html` when you add
  a file.

## Performance

`DeadEndCity.stats()` gives rolling CPU milliseconds, a per-subsystem breakdown, draw calls,
triangles and a scene-object histogram. Measure before and after anything that touches a hot
loop, and be honest when the measurement doesn't separate from noise.

The vehicle loop dominates (`parts.cars`). Static scenery is merged by `batchStaticGroups()`;
anything that moves needs `userData.dynamic = true` or it will be baked in place. Repeated
props belong in an `InstancedMesh` pool, not one mesh each.

## Where things are

`docs/SOURCE_GUIDE.md` has the subsystem table, the city layout with coordinates, the mission
structure, the rendering notes and the known limitations. `README.md` is the player-facing
description and the controls. `docs/audit/` holds older review notes.
