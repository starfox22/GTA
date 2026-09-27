# Dead End City: working notes for Claude

A browser top-down crime game (GTA 1/2 style, 1997 South Coast; Three.js r160 3D with a 2D
fallback). ~260 source files in `src/*.js` are spliced by `// @include src/x.js` lines
(recursive, from `src/main.js` → `src/game.js`) into one closure inside one HTML page by
`tools/build.py`. No bundler, no npm, no minification. Ships as a claude.ai artifact (split
build: `index.html` + `media/` holding the music and the media packs) and as a downloadable
zip folder.

## Commands

```sh
sh tools/quick-check.sh [tag]            # BEFORE EVERY COMMIT: syntax + build + FILEMAP + conflict markers (seconds, no browser)
sh tools/check.sh [tag]                  # syntax gate only (dist/check/<tag>.{html,js})
python3 tools/build.py                   # dead-end-city.html (local, git-ignored: never commit it)
python3 tools/build.py --out dist/game.html            # scratch build
python3 tools/build.py --split-media dist/publish      # dist/publish/index.html + media/ (*.mp3 + pack-*.js): the artifact
python3 tools/build.py --zip dist/DeadEndCity.zip      # DeadEndCity/{index.html,media/,README.txt}; CI (.github/workflows/release-zip.yml) attaches it to the "latest" GitHub Release on every push, and to a versioned release for tags v*
python3 tools/filemap.py                 # regenerate docs/FILEMAP.md after adding/removing/renaming files
node tools/smoke.mjs dist/game.html dist/smoke         # headless boot, walk, drive, map: errors + 5 screenshots
node tools/tour.mjs steps.json dist/tour dist/game.html   # scripted screenshots (?dev console)
node tools/layout-audit.mjs dist/game.html             # city-plan overlaps (~59 oblique-junction notes, county and Monarch, are expected)
node tools/media-check.mjs dist/publish/index.html     # streamed tracks load over file://
python3 tools/changelog.py --new <topic> "<Title>"     # start a changelog fragment
```

Run smoke too when a change touches boot, rendering, input, HUD or anything a console call
cannot prove. Smoke passes with 0 errors (the three.js "build/three.js deprecated" warning is
normal). Headless = Playwright + SwiftShader via tools/browser.mjs (cloud: Chromium in
`/opt/pw-browsers`, never `playwright install`; elsewhere `CHROME_PATH`/`PLAYWRIGHT_MODULE`,
and `DEC_GPU=1` renders on a real GPU); it runs a few fps and boots in a minute or more.
**Browser slots**: every browser tool takes one of `DEC_BROWSER_SLOTS` machine-wide slots
(default half the cores: 2 in the cloud) and queues when none is free; the dev server
freezes its page and gives its slot back after `DEC_IDLE_FREEZE` s idle (default 20; the
next command thaws it, state kept).

**Verifying cheaply** (use these instead of writing Playwright scripts):

```sh
node tools/test.mjs [filter] [--verbose]      # regression suite (~40 s, no-render page): after logic changes
node tools/dev.mjs start [--render]           # ONE persistent headless page (~7 s no-render, ~35 s rendered)
node tools/dev.mjs call <method> [json...]    # a NAMED DeadEndCity method → compact JSON (--max N / --full)
node tools/dev.mjs keys KeyW,KeyD 3 | wait 5  # simulate() game seconds (--real: real key presses)
node tools/dev.mjs shot <name> [--crop x,y,w,h] [--width 480]   # small JPEG in dist/dev/shots/
node tools/dev.mjs reload | errors | stop     # rebuild+reload after edits (fresh profile) / console errors / quit
node tools/dev.mjs reload --keep             # reload with the same browser profile (check a save survives)
node tools/dev.mjs start|reload --shadercheck # report three.js shader compile errors: after any GLSL edit
```

The default dev page is `?dev&norender` (`NO_RENDER` in render3d.js: no WebGL, ~55 fps). Use
`--render` (or `reload --render`) only for images, after `call graphics high` (bare words pass as strings). `--nodev`
boots `?test` (demo gate live). New test: one file `tools/tests/<name>.mjs` exporting
`default async (t)` (`t.call/keys/wait/assert/near/finite`); set up the state it needs,
`fresh = true` for a clean page. The live frame loop runs between console calls: a test
that depends on exact timing (keys, goals, calls) should `holdSimulation(true)` and step
with `t.wait`/`t.keys`, then release it. The dev server holds a browser slot while awake: `stop` it
when you are done with it (and before smoke/tour if slots are short).

**Publish** (only when asked): `python3 tools/build.py --split-media dist/publish`, then the
Artifact tool with `file_path` dist/publish/index.html, `url`
https://claude.ai/artifact/NtDPAmpmNsgU8LPW4hH13B and a `files` map with one
`media/<file>` → `dist/publish/media/<file>` entry for **every** file in dist/publish/media/
(the nine radio `.mp3`s and the `pack-*.js` media packs: `ls dist/publish/media`). If the
tool refuses because this session hasn't read the live page, republish at once with
`force: true` (the owner's standing permission for this link only; never read the page).
Limits: the page ≤ 16 MB (it is ~9 MB of code: media never goes in the split page), each
file ≤ 15 MB (packs split themselves at 12 MB), 511 files / 256 MB per version. New media:
add it to assets/ + manifest and it lands in a pack automatically; the split page loads
packs with plain `<script src>` so the zip still plays from file://.

## Rules

- **Scale**: `UNITS_PER_METRE` = 8; 512-unit city block = 64 m; Monarch Isle blocks 800
  units = 100 m. Speeds `50 * KMH`, accelerations `0.8 * GRAVITY` (9.81 × 8).
  `PERSON_HEIGHT` 1.75 m (`PERSON_SCALE` only converts old offsets); `STOREY` 3.2 m,
  `SHOP_FLOOR` 4.5 m, `DOOR_HEIGHT` 2.3 m, `realBuildingHeight()` for plan heights;
  vehicle `modelScale` 1 = real-size model. Map (x, y) → Three.js (x, elevation, y), yaw −a.
- **Contracts other code relies on** (keep signatures and meaning):
  `helicopterSearchlightMount(c, out)`, `overheadCover` / `overheadCoverHeight`
  (air-cover.js), `vehicleSpec()`, `c.braking`, `spec.abs/esc/tcs`, `DEMO_BUILD`
  (game-state.js), `entityElevation()` (only height comparison), `teleportPlayer()` (only way
  to move the player; releases every carrier), `solid()` (people collision), `crime()` (only
  heat source), `offerPrompt()` (only prompt writer), `actionHeld()`/`keyName()` (never
  literal keys). Details: docs/areas/core-and-contracts.md.
- `tell(text, s, {id, tone})` (hud-notify.js) is the only notification writer; hints use
  `pressKey()`/`keyPrefix()` (input-hints.js), never `'Press ' + keyName()`.
- `shooterInView()` (combat-rules.js) is the only rule for whether an NPC may fire at the
  player (on screen, from the camera footprint `screenViewHalf`): every new shooter checks it.
- No ammo, armor or weapon pickups: rounds come from gun shops, `lootInteract` (bodies, once)
  and `takeVehicleArms` (police vehicles, once) in ammo-supply.js.
- **Police need a report**: `crime(amount, how)` with no stars counts only if police see or
  hear it or a witness call completes (witnesses.js); scripted crimes that must raise stars
  pass `'seen'`; `witnessReport(person, kind, x, y)` makes someone phone 911. Crowd
  perception (`p.pending`) is resolved in updatePeople before any special routine: a new
  routine that owns people must step aside when `p.react`/`p.flee` is set.
- `personFemale()` (voices.js) is the only man/woman rule (looks and voices both use it);
  `player.carjack` is a carrier (`cancelCarjack()`).
- New land or bridges: append to `LAND_REGIONS`/`BRIDGES` last and keep coast-walk rhythms
  and grid blocks unchanged (compare `layout()` with the base build). Tall towers only where
  nothing stands north of them (the camera looks north): North Point Key, Monarch One.
- North Point Key visitors (livingcity-key.js) are the only traffic on the Key; its inbound
  lane runs 17 units off the centre line, not 24 (the sea-wall rail reaches onto the deck).
- The Blue Hour: `BLUE_HOUR_ENTRANCE` (roofmission-entrance.js) is the only plan for the hotel's
  forecourt (canopy, limousines, staff); street furniture stays off it via `blueHourForecourt()`.
  Terrace furniture stays inside `roofCover` footprints or the 14-unit strip along the railings.
- Every drivable island has a respray garage (`GARAGE_ISLANDS`, garages-shops.js; checked by
  tools/tests/garages-islands.mjs).
- `playerImpact()` / `fallInjury()` (falls-body.js) are the only fall-damage scale;
  `player.fall` is a carrier. The parachute opens only on a second `bail` press; its
  opening stages live in one model that `parachuteForecast()` (parachute.js) also steps
  for the freefall cue: change them there only.
- `kickCamera(heading, units)` / `shake` (camera-feel.js) are the only camera jolts; renderers
  only read `cameraKick` and `cameraShakeOffset`.
- Roomy one-shots (shots, blasts, crashes, near thunder) connect to `reverbSend`
  (acoustics-audio.js), never `reverb`; audio randomness uses `sfxRandom`, not `randomBetween`.
- **Renderer never changes game rules**: `*3d.js` files (inside `createCityRenderer()`) only
  read state.
- `cloudBaseAt(x, y)` / `cloudTopAt(x, y)` (clouds.js) are the only source of the cloud
  altitude (by weather and area); the renderer draws from the same maps
  (docs/areas/rendering-clouds.md). Console `cloudJump(metres, kind)` drops the player over
  a cloud.
- Vehicle beams run in `headlightFrame()` (terrain-headlights.js: body pitch/roll, lamp
  height); the CAR LAMPS uniform and the horizon strip in `cityBeamShadow` must stay in step
  with `headlightHorizonLit`, and every reader of the lamp slots (lit materials, beam haze,
  the rain's `rainCarLight`) takes the frame and mode.
- **Dev console** `window.DeadEndCity` has explicit named methods only. **Never** add an
  eval-style hook (eval, `Function`, run-a-string, generic get/set): a security rule.
- **Third-party assets** must be credited in `docs/THIRD_PARTY_CREDITS.txt` (the build embeds
  it; never delete it). Media goes in `assets/` + `assets/manifest.json`.
- Never hand-edit or commit `dead-end-city.html`; `dist/` is scratch.
- No gameplay change without being asked; docs/tooling tasks leave `src/` alone.

## Finding code (don't read to search)

- `grep -i <word> docs/FILEMAP.md` first: every file with line count and purpose, grouped by
  include tree. Then `grep -n` the symbol in `src/`.
- Naming: `<area>.js` = game logic, `<area>3d.js` = its meshes (renderer closure),
  `<area>-audio.js` = its sound, `<parent>-<part>.js` = a piece split out of `<parent>.js`,
  whose file is then just its banner and an ordered include list. No src file is over
  1,000 lines; keep it that way (split by pure moves when one grows past ~800).
- Pieces only valid together, in order: `signkit3d-emblems-a/b` (case blocks of one
  `switch`), `signdesigns3d-families-a/b` (one object literal), `cars3d-bodies-a/b` (one
  `CAR_BODIES` literal), `render3d-api.js`/`render3d-frame.js` (one `api` literal).
- Page markup and CSS: `src/shell.html` is a ~70-line skeleton; CSS lives in `src/ui/*.css`
  (included inside `<style>` as `/* @include src/ui/x.css */`, include order = cascade order)
  and markup in `src/ui/*.html` (`<!-- @include src/ui/x.html -->`). Find an id:
  `grep -rn 'id="x"' src/ui/`.
- Area docs (why, contracts, gotchas): `docs/README.md` indexes them; open one, not all.

## Token-saving working rules (you and every subagent)

- Grep before reading; read line ranges (`Read` with offset/limit, `sed -n 'a,bp'`), never
  whole 1,000+ line files or the built HTML (38 MB).
- Pipe long command output through `tail`/`head`/`grep`; don't cat logs or tables.
- Browsers are the scarce resource (slots, above); prefer `node tools/dev.mjs call <report>`
  and tests over screenshots; take small `dev.mjs shot`s only to prove a visual point.
- Give subagents a precise brief: files/symbols to touch, the check to run, the output wanted.
- **Pure-move refactors must keep the build byte-identical**:
  ```sh
  python3 tools/build.py --out dist/before.html          # before editing (or from a clean
                                                         # worktree of the base commit)
  # ... move code, replace it with `// @include src/<new>.js` ...
  python3 tools/build.py --out dist/after.html && cmp dist/before.html dist/after.html && echo identical
  python3 tools/filemap.py                               # new files need FILEMAP lines
  ```
  The include line's own indentation is ignored; the moved lines keep theirs. A non-empty
  `cmp` means it was not a pure move.

## Adding things

- Source file: create `src/<name>.js` opening with a 1–3 line header saying what it holds
  (FILEMAP reads it), add `// @include src/<name>.js` to the right include list (game logic
  in `src/game.js` or its area parent; meshes in `render3d.js`'s list). Top-level
  `const`/`let` read during setup must come before their readers. Run `python3 tools/filemap.py`.
- UI panel: markup in the matching `src/ui/*.html` (or a new file + include line), CSS in a
  `src/ui/*.css` (a new file goes before `reduced-motion.css`). Details: docs/areas/ui-and-settings.md.
- Console method: add a named method to the area's `src/game-console-<group>.js` (core,
  missions, police, vehicles, world, rides, leisure, crowd, graphics, settings); each is one
  `addConsoleMethods('<group>', {...})` call and game-console.js freezes them all into
  `window.DeadEndCity`. A feature can return methods from `<feature>Console()` and register
  them from its group. Duplicate names log a console error. Document it in `docs/console/<group>.md`.
- Media: `assets/` file + manifest entry (+ `"stream": true` for large music played by URL)
  + credit. Mission: docs/areas/missions-and-demo.md.

## Agent workflow (parallel sessions)

- **Branches and `main`**: develop on the session's working branch. `main` holds the owner's
  approved game. When the owner says they are satisfied with a version **and** approves
  moving it to main in the current conversation, merge the working branch into `main`
  directly (no pull request needed) and push `main`; never push to `main` without that
  explicit approval. CI builds the downloadable zip for whatever branch is pushed.
- **How many at once**: the cloud machine has 4 cores and 16 GB; run at most 3-4 agents in
  parallel (in waves), since every one of them needs browsers and slots only queue the
  work. On a bigger machine (or `DEC_GPU=1`) raise `DEC_BROWSER_SLOTS` and the agent count.
- Work in your own git worktree/branch. Before finishing: merge the lead session's working
  branch (the lead names it in your brief), resolve conflicts, `grep -rn '^<<<<<<<' .`
  (excluding node_modules), run `sh tools/quick-check.sh <tag>`, commit.
- Commit in logical steps, ending each message with the attribution lines your session's
  instructions give (the lead passes them on in agent briefs).
- Never use bare `git stash` (the stash is shared between worktrees); use a WIP commit.
- `docs/FILEMAP.md` conflict: take either side, rerun `python3 tools/filemap.py`.
- Shared docs are small and per-area, so agents rarely touch the same file; edit the
  section you changed, don't rewrap others.

## Docs and changelog

- `docs/BACKLOG.md`: known issues and loose ends per feature; check it before polishing an area,
  delete a line when you fix it.
- `docs/console/README.md`: console rules and the per-group table index. An area doc that outgrows
  ~8 KB splits as `<area>-<topic>.md` and gets a row in docs/README.md.
- `docs/README.md` (index) · `docs/FILEMAP.md` (generated) · `docs/areas/*.md` (≤ ~8 KB each;
  update the one your change affects: contracts and gotchas, not what code says) ·
  `docs/audit/` (QA logs) · `docs/CHANGELOG.md` (latest release only) ·
  `docs/archive/CHANGELOG-archive.md` (older).
- **Never edit docs/CHANGELOG.md for a change.** Add `docs/changes/<yyyy-mm-dd>-<topic>.md`:
  a `# Title` line and a few bullets (player-visible first, then internals and new console
  methods; under ~15 lines). At release, `python3 tools/changelog.py --release <ver> "<Title>"`
  folds fragments into a new section and archives the previous one; `python3
  tools/changelog.py` previews it.
- **Version numbers**: 0.9.0 is the public demo (the old 1.0-30.0.0 numbers were pre-alpha
  build counts). Each release adds 0.0.1 (0.9.1, 0.9.2 ...), only when the owner asks for a
  release: `GAME_VERSION` (src/game-state.js), `src/ui/build-header.html`, README.md, then
  `--release`.
