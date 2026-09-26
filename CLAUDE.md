# Dead End City: working notes for Claude

A browser top-down crime game (GTA 1/2 style, 1997 South Coast; Three.js r160 3D with a 2D
fallback). ~260 source files in `src/*.js` are spliced by `// @include src/x.js` lines
(recursive, from `src/main.js` → `src/game.js`) into one closure inside one HTML page by
`tools/build.py`. No bundler, no npm, no minification. Ships as a claude.ai artifact (split
build: `index.html` + `media/*.mp3`) and as a downloadable zip folder.

## Commands

```sh
sh tools/quick-check.sh [tag]            # BEFORE EVERY COMMIT: syntax + build + FILEMAP + conflict markers (seconds, no browser)
sh tools/check.sh [tag]                  # syntax gate only (dist/check/<tag>.{html,js})
python3 tools/build.py                   # dead-end-city.html (local, git-ignored: never commit it)
python3 tools/build.py --out dist/game.html            # scratch build
python3 tools/build.py --split-media dist/publish      # dist/publish/index.html + media/*.mp3 (the artifact)
python3 tools/build.py --zip dist/DeadEndCity.zip      # DeadEndCity/{index.html,media/,README.txt}
python3 tools/filemap.py                 # regenerate docs/FILEMAP.md after adding/removing/renaming files
node tools/smoke.mjs dist/game.html dist/smoke         # headless boot, walk, drive, map: errors + 5 screenshots
node tools/tour.mjs steps.json dist/tour dist/game.html   # scripted screenshots (?dev console)
node tools/layout-audit.mjs dist/game.html             # city-plan overlaps (28-39 oblique-junction notes are expected)
node tools/media-check.mjs dist/publish/index.html     # streamed tracks load over file://
python3 tools/changelog.py --new <topic> "<Title>"     # start a changelog fragment
```

Run smoke too when a change touches boot, rendering, input, HUD or anything a console call
cannot prove. Smoke passes with 0 errors (the three.js "build/three.js deprecated" warning is
normal). Headless = Playwright + SwiftShader, Chromium in `/opt/pw-browsers` (never
`playwright install`); it runs a few fps and boots in a minute or more: **one browser at a
time**, and call `DeadEndCity.graphics('high')` before judging an image.

**Publish** (only when asked): `python3 tools/build.py --split-media dist/publish`, then the
Artifact tool with `file_path` dist/publish/index.html, `url`
https://claude.ai/artifact/NtDPAmpmNsgU8LPW4hH13B and a `files` map of the nine
`media/<name>.mp3` → `dist/publish/media/<name>.mp3` (island-colada, island-dub,
lofi-freeway, lofi-hooptie, lounge-heists, lounge-martini, oddball, rock, synth). Publish
from the session that last read/published it (the tool otherwise asks for a re-read). The
page must stay under 16 MB (aim ≤ 15.5 MB); each media file ≤ 15 MB.

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
- **Renderer never changes game rules**: `*3d.js` files (inside `createCityRenderer()`) only
  read state.
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
  whose file is now just an ordered include list (game-*, physics-*, crowd-*, crowd3d-*,
  render3d-*, cars3d-*, helicopter3d-*, themepark-*, sports-*, base3d-*, monarch-*).
- `game-console.js` + `-world.js` + `-graphics.js` are ONE object literal split in three:
  only valid together, in that order.
- Area docs (why, contracts, gotchas): `docs/README.md` indexes them; open one, not all.

## Token-saving working rules (you and every subagent)

- Grep before reading; read line ranges (`Read` with offset/limit, `sed -n 'a,bp'`), never
  whole 1,000+ line files or the built HTML (38 MB).
- Pipe long command output through `tail`/`head`/`grep`; don't cat logs or tables.
- One headless browser at a time; screenshots only to prove a visual point: prefer console
  reports (`DeadEndCity.stats()`, `status()`, subsystem reports).
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

- Source file: create `src/<name>.js` (open it with a comment saying what it is: FILEMAP
  reads it), add `// @include src/<name>.js` to the right include list (game logic in
  `src/game.js` or its area parent; meshes in `render3d.js`'s list). Top-level `const`/`let`
  read during setup must come before their readers. Run `python3 tools/filemap.py`.
- Console method: add a named method in the right `game-console*.js` part and a row to the
  table in `docs/areas/testing-and-console.md`.
- Media: `assets/` file + manifest entry (+ `"stream": true` for large music played by URL)
  + credit. Mission: docs/areas/missions-and-demo.md.

## Agent workflow (parallel sessions)

- Work in your own git worktree/branch. Before finishing: merge the lead branch
  (`claude/compassionate-wright-cu2e1q`), resolve conflicts, `grep -rn '^<<<<<<<' .`
  (excluding node_modules), run `sh tools/quick-check.sh <tag>`, commit.
- Commit in logical steps. Commit footer:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01X7STL4NobWQRYwzSWdyi6G
  ```
- Never use bare `git stash` (the stash is shared between worktrees); use a WIP commit.
- `docs/FILEMAP.md` conflict: take either side, rerun `python3 tools/filemap.py`.
- Shared docs are small and per-area, so agents rarely touch the same file; edit the
  section you changed, don't rewrap others.

## Docs and changelog

- `docs/README.md` (index) · `docs/FILEMAP.md` (generated) · `docs/areas/*.md` (≤ ~8 KB each;
  update the one your change affects: contracts and gotchas, not what code says) ·
  `docs/audit/` (QA logs) · `docs/CHANGELOG.md` (latest release only) ·
  `docs/archive/CHANGELOG-archive.md` (older).
- **Never edit docs/CHANGELOG.md for a change.** Add `docs/changes/<yyyy-mm-dd>-<topic>.md`:
  a `# Title` line and a few bullets (player-visible first, then internals and new console
  methods; under ~15 lines). At release, `python3 tools/changelog.py --release <ver> "<Title>"`
  folds fragments into a new section and archives the previous one; `python3
  tools/changelog.py` previews it.
