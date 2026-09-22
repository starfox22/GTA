# Development workflow

How to change, build and test Dead End City. Written for whoever (human or AI) picks the
project up next; read `docs/SOURCE_GUIDE.md` first for how the code is organized.

## Build

```
python3 tools/build.py                       # writes dead-end-city.html (the deliverable)
python3 tools/build.py --out dist/game.html  # scratch build; dist/ is git-ignored
sh tools/check.sh [tag]                      # assemble + `node --check` syntax gate
```

The build only concatenates: `src/main.js` expands `// @include src/<file>.js` directives
recursively, `src/shell.html` receives the game script, Three.js, the Base64 media listed
in `assets/manifest.json`, the media loader and the credits. Nothing is minified.

### Adding a source file

1. Create `src/<name>.js` starting with `// BEGIN SUBSYSTEM: src/<name>.js — <title>` and a
   doc comment, ending with `// END SUBSYSTEM: src/<name>.js`.
2. Add `// @include src/<name>.js` where it belongs: game logic inside `src/game.js`,
   Three.js meshes inside `createCityRenderer()` in `src/render3d.js`.
3. Add it to the SUBSYSTEM INDEX comment at the top of `src/shell.html` and to the table in
   `docs/SOURCE_GUIDE.md`.

### Adding media

Put the file under `assets/`, add an entry to `assets/manifest.json` (`id`, `file`,
`mime`, `original`), reference the id from `src/asset-loader.js`, and credit it in
`docs/THIRD_PARTY_CREDITS.txt`. The published artifact must stay under 16 MB, so prefer
procedural textures and keep media small (WebP images, MP3/OGG audio).

## Test

Headless Chromium with a software GPU is available (see `tools/smoke.mjs`). It renders
at a few frames per second, so in-game time runs slower than wall time; wait longer
rather than assuming something is broken.

```
node tools/smoke.mjs dist/game.html dist/smoke        # boot, walk, drive, map
node tools/tour.mjs steps.json dist/tour dist/game.html
```

`tools/tour.mjs` starts a game, declines the opening call and runs a list of steps, each
optionally running JavaScript in the page, holding keys, waiting and taking a screenshot:

```json
[
  { "name": "harbor", "js": "DeadEndCity.look(3000, 4000, 0.6)", "wait": 2500 },
  { "name": "fly", "js": "DeadEndCity.drive('helicopter', 150)", "keys": [["KeyW", 1500]] },
  { "name": "stats", "js": "DeadEndCity.stats()", "shot": false }
]
```

### Developer console

`window.DeadEndCity` (defined at the end of `src/game.js`) is the only way tests reach the
game. It is a frozen object of explicit methods; add a new named method when a test needs
something, never a generic code-evaluation hook.

| Method | Purpose |
| --- | --- |
| `status()` | Mode, position, district, health, cash, wanted level, mission, vehicle |
| `teleport(x, y)`, `look(x, y, zoom)` | Move the player (and camera), optionally zoom |
| `drive(type, altitudeMeters, heading)` | Spawn any vehicle type beside the player and board it; aircraft can start airborne; optional heading in radians (0 = east) |
| `simulate(seconds, heldKeys)` | Run the simulation forward without drawing while holding keys (e.g. `['KeyW']`); returns `ride()`. Physics tests use it because headless frames are slow |
| `places()` | Named businesses and landmarks with coordinates |
| `setClock(hours)`, `sky(id)` | Time of day; weather (`clear`, `fair`, `cloudy`, `overcast`, `rain`, `storm`) |
| `startMission(i)`, `missions()` | Jump into a mission |
| `wanted(stars)`, `god(on)` | Police level; invulnerability |
| `bike()`, `cab(x, y)`, `ride()` | Bicycle, taxi ride, current vehicle telemetry (speed, pedal cadence and effort) |
| `roadblocks()`, `containment()` | Police cordon state |
| `stats()` | Per-frame CPU timings, draw calls, triangles |

## Conventions

- Keep code readable: descriptive names, a short comment on anything non-obvious, the
  same idiom as the surrounding file. No minification, packing or `eval`.
- Map coordinates are `(x, y)`; 512 units = 100 m. Three.js position is `(x, elevation, y)`.
- `solid()` is the one collision test; `entityElevation()` the one height comparison;
  `teleportPlayer()` the one way to move the player.
- Commit `dead-end-city.html` rebuilt from source, never hand-edited.
