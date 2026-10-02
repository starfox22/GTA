# Boot time and renderer memory

Second render pass (2 October 2026). The first pass (rendering-hiccups.md) removed first-use shader and
upload hitches; this one measured the start-up, soaked the renderer's memory and closed the last known gaps.

## The boot timeline

`DeadEndCity.bootTimings()` (read-only) lists a User Timing mark per stage, ms since navigation start and the step
before it: `loader` (the media blocks are in; the 8 MB game script and three.js are parsed), `game-start`
(`startDeadEndCity` runs), `world` (`buildWorld`: city plan, county, terrain), `colliders`, `populated`
(people, vehicles, story, county), `title-menu` (the HTML title is up), `visuals-queued`, `loop-ready`,
`console-ready`, `first-frame`, `images`, `scene-built` / `batched` / `far-scenery` / `cells-lamps` (the
renderer's scene build, `createCityRenderer`), `renderer` (it exists), `prewarm-done`, and after ENTER `begin`,
`audio-init`, `first-play-frame`. Add a mark with `bootMark('name')` (game-state.js). The title is clickable only
once `renderer` is marked: the scene build is one synchronous task.

Profile a boot: a Playwright page with a CDP `Profiler` running from navigation to the title (what this pass used),
`positionTicks` mapped back to source files through the include order. Headless numbers on this shared machine
(load 4-10, SwiftShader: `getContext`, canvas rasterisation and every shader link are software) are 3-5x a
desktop; what holds is the split.

| Stage (profiled, loaded machine) | ms | What is in it |
| --- | --- | --- |
| page load to `loader` | ~700 | download, parse and run of the media packs, three.js, the game script (V8 pre-parses 8 MB) |
| `loader` to `game-start` | ~450 | `startDeadEndCity`'s own parse and its top-level tables |
| `buildWorld` | ~3700 | the Ridgeline terrain field 1.7 s (masks 0.1, distances 0.1, relief 0.24, erosion 0.22, roads 0.35, carve 0.26, trails 0.5), `buildCounty` 2.9 s of it, the 2D ground canvas (`rect`, `drawTree`) 0.5 s |
| `buildColliders` + `populate*` | ~1300 | the bike-share plan (`bikeStationFits`) 0.7 s, rides' footings 0.15 s, vehicle performance 0.2 s |
| renderer scene build (`createCityRenderer`) | ~16000 | sign boards and the neon atlas 2.9 s (canvas text, shadows, `backlight` copies), ground distance fields 1.2 s, airport aircraft liveries 1.6 s (a per-pixel loop), vegetation atlas 0.6 s, `batchStaticGroups` 0.7 s, the GL context 1.3 s (software) |

Not done, in order of value: lazy sign canvases (paint a shop face when its cell comes within the pre-upload
ring, `render3d-resources.js` CELL PRE-UPLOAD); building the aircraft at Southport when the camera nears them (they
must stay in the `statics` group so the batcher treats them as before); the terrain field in a worker (it reads
the land regions, roads and rails, so that is a rewrite) or cached per build in IndexedDB; yielding between the
renderer's includes so the title answers while it builds (the START button would wait for `renderer`).

The title card paints at ~0.45 s (first contentful paint) while the script runs: the browser paints the static
HTML before the 8 MB game script, so deferring the start-up to let it paint would gain nothing. The gap between
`console-ready` and `first-frame` (~1.2 s headless) is the browser's own first style and layout.

## What this pass changed at boot

- `initAudio` (ENTER) turned 65 base64 samples into bytes with `Uint8Array.from(string, fn)`, a call per byte:
  `audio-init` took ~0.5 s of the first click. `dataUrlBytes` is a plain loop with the same bytes.
- `roadPerformance` (vehicle 0-100 bisection) integrates only until the car is slower than the target time and
  stops when the bracket cannot narrow: the same `power` for 400 random specs, ~45% less CPU. `onBoulevard` rejects
  a segment by its box before the exact distance (same answers for 300,000 random queries, ~6x faster).
- Measured on the idle machine (A B B A, 4 boots each, medians, headless `dev&norender`): ENTER to `audio-init`
  330 -> 203 ms (51-228 after, 314-351 before), ENTER to the first play frame 603 -> 396 ms, `populate` +
  `buildColliders` 1266 -> 1160 ms, main-thread CPU to the title 6258 -> 6224 ms (the terrain, county and renderer
  costs above are untouched). Rendered boot (`dev`, one each): `createCityRenderer` 16.1 -> 12.9 s, thread CPU
  21.8 -> 19.5 s (noisy: one run each).

## Renderer memory soak

A rendered page (480x300, LOW) teleported (`look`) through ten districts (Midtown, Palm Keys, South Bank,
Stonecreek, Northridge, Eastgate, Oceanview, Sentinel, Monarch Isle, North Point), 4 s simulated and ~12 s of real
frames at each, three rounds; counters from `renderHiccups().now`, `.gpu` and the heap after a collection.

| | start | round 1 end | round 3 end |
| --- | --- | --- | --- |
| programs | 51 | 93 | 94 |
| textures | 53 | 153 | 156 |
| geometries on the GPU | 210 | 734 | 753 (flat over the last five stops) |
| scene geometry / texture pixels | 202 MB / 265 M | 206 MB / 242 M | 207 MB / 244 M |
| JS heap | 94.5 MB | 106.7 MB | 108.8 MB (+10 in the first round, +2 in the last two) |

Everything plateaus after a district is first seen. A second soak fired a blast, a crash test, a gunman and three
stars at every stop, alternating noon-dry and night-wet: geometries 761 -> 1143, textures 165 -> 216, heap 108 ->
126 MB over 22 stops, and back at the start spot 6711 scene geometries (6461 before), 1059 textures (1028), heap
126 MB. The growth follows the sim's own entities (vehicles 266 -> 319: the crash-test cars and police stay), not
the renderer: every runtime texture is cached by key (liveries, trim atlas, glyphs), models retire through
`pruneModels` / `disposeRetiredModels`, wake emitters dispose their geometry and materials, effects are fixed pools
and decal layers are ring buffers. No disposal bug found. Left: a creep of ~0.1-0.2 MB of JS heap per stop in
quiet play that this soak could not attribute (a heap-snapshot diff on a quiet machine would).

## Tier changes, cells and AUTO

- **Staged tier change** (lighting3d-look.js LIT STATE, render3d-resources.js `prewarmShaders(stage)`). The sun's and
  the helicopter spot's shadow flags and the trees' alpha to coverage are in every lit program's key, so a change that
  flips one relinked ~45 programs in the next frame. Where the shader prewarm runs (a driver with
  `KHR_parallel_shader_compile`, or `?prewarm`) `applyRendererQuality` applies the post chain and the other tier
  numbers at once and stages the lit flags: the scene's objects, the new post chain's passes (AO, bloom, composite,
  FXAA, SSR on their targets) and, when shadows come on, the shadow-depth samples are compiled in slices with the new
  flags flipped for the length of each slice only; the flags change for good when every program is ready (~1-3 s later;
  a later change replaces a pending one). `litStageInfo` / `renderHiccups().litStage` report it. New code that adds
  to what a program is keyed by in a tier change goes through `litStateFor` / `setLitFlags` / `applyLitState`. Software GL
  without `?prewarm` switches at once, as before. Models not in the scene at the switch (a car type not yet seen) still
  compile on first sight.
  Measured (software GL, forced prewarm, 480 x 300): LOW -> HIGH created **45 programs** in the first frame
  with the immediate flip (base build; HIGH -> LOW 0, -> ULTRA 1) against **1** staged (LOW -> HIGH 1, -> LOW 0,
  -> ULTRA 0; the stage took 44 s, 7 s and 15 s of slow frames here, seconds on a GPU).
- **Lazy post targets** (postfx3d.js): `sizePostTargets()` only marks them stale; the next frame, or whoever needs the
  scene target first (`postSceneTarget()`), allocates once. A tier change reallocated every post target up to four times
  in a row (scale reset, post quality, resize, LOW's resolution cap).
- **AUTO hold** (quality.js): a slow-down within 30 s of creeping the scale up sets a ceiling at the scale it falls to
  and holds it for 60 s, doubling each time to 10 min, so a machine on the edge stops hunting (a synthetic run of 12
  fast/slow rounds made 77 scale changes, each a reallocation; with the hold, 18). `adaptiveSim()` runs the controller.
- **Cell pre-upload** (render3d-resources.js CELL PRE-UPLOAD): every 120 ms while played, shown and past the prewarm,
  the nearest static or batch cell within the view's reach + 1700 units that is not on the GPU gets ~1.5 MB of its
  meshes drawn into the 1 x 1 upload target (no shadow pass), so the camera's first draw finds them there; a slice over
  10 ms backs the timer off to 500 ms. "On the GPU" is three.js's dispose listener on the geometry. Only where the
  prewarm runs (the first-visit uploads of 0.2-13 MB per cell are what it removes). `renderHiccups().cells.preUpload`.
- **Sign canvases**: each `sign()` face and glow mask (2 MB) is in `bakedCanvases` and freed after its upload; the
  pre-upload sends the two nearest undrawn signs with each slice. Without it ~330 sign canvases (~85 M pixels,
  ~340 MB of bitmaps) stayed alive beside their GPU copies; `renderHiccups().gpu.canvasesToRelease` counts those
  waiting (334 -> 314 after a minute of software-GL slices, whose slowest took 3 s; a GPU takes ms).

## First uses per scenario (LOW, software GL, forced prewarm, after this pass)

Programs created in play: street 1 (the first frame), drive, night, rain, explosion, police chase, mission 1
harbour, mission 2 hotel, helicopter, plane, parachute 0 each; textures 0-28 and geometries 0-88 (new vehicle
models and sea/air kits). The first night frame has a `sky` lap of 1.7 s that is native time (the profile shows
`(program)` 835 ms: software GL drawing the sky environment), not JS. Not measured at MEDIUM-ULTRA (software
frames of 20 s+). Steady state at LOW: street 256 calls / 0.88 M triangles, hotel 209 / 0.79 M, harbour 211 /
0.69 M, 185 programs, no shadow calls, geometry 169 MB, textures 270 M pixels.
