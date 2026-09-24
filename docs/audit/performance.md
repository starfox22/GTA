# Audit report: performance pass (simulation, render CPU, frame pacing)

Goal from the owner: a stable 60 fps on most browsers, at least on a desktop computer and at
least on LOW. Budget used for this pass: simulation <= 5 ms and render submission <= 5 ms of
CPU per frame on a desktop CPU, LOW light enough for integrated graphics.

Run on the version 30.0.0 build (`f22ac56`); "before" is that build, "after" is this branch.

## How it was measured

- One headless Chromium page per build kept open and driven with console calls (a small
  Playwright server with `page.evaluate`, CDP `Profiler` for CPU profiles and
  `HeapProfiler.startSampling` with collected objects included for allocation), 1280 x 800,
  SwiftShader. Before and after pages ran **side by side at the same time**, so both saw the
  same machine load (the shared test machine sat at a load of 15-25 from other sessions).
- Headless SwiftShader draws a LOW frame in 3-8 seconds, so wall-clock frame times mean
  nothing and CPU milliseconds are inflated 5-10x and noisy. The tables compare what is
  robust: draw calls, programs, allocation per simulated update (independent of load),
  profile self time of named functions summed over all scenes, and CPU ms of before and
  after measured in the same minutes.
- Scenes (each a fresh `look`/`teleport` in one session): busy Midtown on foot at noon,
  driving fast through downtown (`drive('sport')`, `launch`, W held), North Point towers at
  zoom 0.5, Marea Beach Club at 23:30, the stadium with a match in play (`matchDay(1, 20)`),
  Sunset Pier at 20:00, a 5-star chase (`wanted(5)` then drive), the helicopter at 400 m over
  North Point, Midtown in rain at 22:00.
- Frame scenes: stats over 8 frames after 4 settling frames with a CPU profile of those
  frames. Simulation scenes: `simulate(4)` (120 updates of 1/30 s, four physics steps each)
  under the profiler, then `simulate(2)` under the sampling heap profiler.

## Hot spots found (before)

Simulation, top self time per scene (CPU profile of `simulate()`):

| Scene | Top self time |
| --- | --- |
| Midtown on foot | garbage collector 21.7%, physicsStep 8.6%, updateCrowd 4.3%, updateCars 4.0%, setTargetAtTime 3.5%, bloodSurface 3.3%, moveBody's `blocked` 2.9% |
| Downtown drive | garbage collector 20.4%, physicsStep 10.7%, updateCars 6.5%, solid 5.0%, blocked 2.3%, forEachPedestrianNear 2.2%, trafficControl 2.1% |
| North Point | garbage collector 23.7%, physicsStep 7.5%, (anon) 5.9%, updateCars 4.0%, blocked 3.6%, crowdStep 3.5% |
| Beach club night | physicsStep 13.7%, garbage collector 7.4%, updateCars 7.0%, blocked 5.4%, updateClubGoer 3.5%, roadVehicleTerrain 3.5% |
| Stadium match | garbage collector 18.4%, physicsStep 8.9%, updateCars 5.7%, blocked 4.1%, crowdStep 4.1%, regionContains 2.9% |
| Sunset Pier | physicsStep 12.9%, updateCars 7.3%, updateParkGuest 6.2%, blocked 4.7%, yieldTo 4.6%, setTargetAtTime 2.9% |
| 5-star chase | garbage collector 16.4%, physicsStep 11.7%, updateCars 6.2%, blocked 3.5%, updateSceneMember 3.2%, propsNear 2.9% |
| Helicopter 400 m | physicsStep 14.5%, updateCars 7.7%, blocked 7.2%, crowdStep 5.4%, garbage collector 5.4% |

The simulation allocated **3.6-6.6 MB per update**; a fifth of its time was garbage
collection. The largest sources, from the allocation profile:

- the vehicle physics step: a new `Map` of cells, `Set` of pair keys and `[a, b]` pair
  arrays every 1/120 s step, a new box object for every contact test in all seven passes,
  corner arrays (`flatMap`) for every moving car's kerb test, a closure per pass;
- `railLift()`: never cached, so every `solid()` call (every footstep of every walker)
  recomputed all 13 station lifts by reducing over every rail deck with an object per deck;
- `airCoverRay()` / `airCoverStopsShot()`: every sight line and every bullet sub-step walked
  all overhead cover blocks (hundreds of rail piers) building four arrays and two objects each;
- `sweptPersonContact()` copied the whole vehicle object (`{...c}`) for every sub-step;
- `countyRouteControl()` copied all ~650 pedestrians into a new array per call;
- `harborSolids()` / `marinaSolids()` rebuilt their arrays on every `solid()` call;
- per-frame objects per vehicle (`personSweepStart`, `bloodTrackPoint`, contact sets,
  `bloodPools.filter`), plane specs merged afresh on every `vehicleSpec()` call.

Other simulation costs that did not scale: every walker's step tested every vehicle in the
city (`moveBody` → `blocked`, ~200 per step); pedestrian queries away from the player fell
back to scanning all ~650 people (distant traffic yielding, county cars).

Render CPU (LOW, frame profiles): three.js `updateMatrixWorld` was the largest single
function in every scene. The scene's `matrixAutoUpdate` makes three.js recompose and
multiply the matrix of every one of ~15,300 objects every frame, hidden or not. Next came
`projectObject` / `intersectsObject`: ~3,400 merged scenery batches across the whole map
were frustum-tested one by one in both the camera and the shadow pass. At night each lit
vehicle drew four halo sprites, each a draw call with its own material (four calls per lit
car or plane in view). Occasional long frames: every retired car or person model made the renderer walk
the whole scene to find unused GPU resources, and a teleport or a fast drive into new
traffic built all the new car models in one frame.

## What changed

Simulation (`081fb43`, `acc1255`, `f8a123e`, `47337fb`):

- Physics step split into `controlVehicle`, `vehicleBroadphase`, `vehicleContactPasses` and
  `settleVehicle` (each optimised and profiled on its own). Broadphase containers are kept
  between steps and reset lazily by stamp; each pair is taken in the first cell both
  vehicles share (no key set); contact tests use the vehicle's own box record
  (`contactShape`); `boxContact` works in plain numbers with scratch corner arrays; the
  kerb/shore test checks corners without arrays; contact-statics caches are reused.
- Vehicles are created with every field the physics writes, in one order, so they share one
  object layout (`vx`/`vy` start as NaN until the first step derives them from the speed).
- A per-frame vehicle grid for foot collision (walkers ask the cells around their step, not
  every vehicle); a lazily built grid of everyone for pedestrian queries far from the
  player; county cars use it instead of copying the crowd.
- `solid()`: bounded rectangle lists (harbor, marina, garages, airport scenery), a grid for
  the street-end guardrails, the pond list cached with bounds, railway lifts cached,
  `groundAt` asks the land cache before the bridge/dock/pier lists, the polygon and lake
  tests without destructuring or closures. Rounds in flight skip rectangle lists they are
  outside.
- Overhead cover blocks carry their turn and map bounds; rays, shots and boats skip blocks
  whose bounds miss them.
- In place instead of per call: sweep starts, blood-track points, contact sets (double
  buffered), plane specs, crowd view footprint, bullet target lists, traffic lane lookups
  (no filter/sort), terrain and mountain bounds early-out, street props skip still vehicles.
- Audio: per-frame `setTargetAtTime` calls whose target has not changed are skipped
  (`glideParam`, re-sent twice a second).
- HUD: a write of the same text or HTML to an element fetched through `getElement()` is
  skipped (the HUD refreshes ~11 times a second and rewrote ~40 texts each time).

Render (`52fa07c`, `acc1255`, `c21a47f`, `f8a123e`):

- **Scene matrices**: the scene's own matrix update is off; one pass per frame skips hidden
  subtrees and recomposes only matrices whose position, rotation or scale changed.
- **Static batch cells**: merged scenery hangs from one group per 1024-unit cell, hidden
  beyond the view's reach plus a 700-unit margin for long shadows. Objects visited per
  frame in a Midtown view: ~4,700 -> ~2,000; meshes frustum-tested ~4,150 -> ~1,430.
- **Vehicle halos**: one instanced camera-facing quad set for every lit vehicle lamp
  (same texture, colour, opacity, additive blend and fog; screenshots match).
- New car/person models are built at most 6/10 per frame; retired models are disposed in
  batches every few seconds; effect sprites and strobes reuse parsed colours.
- **LOW**: the scene is drawn at no more than about 1080p worth of pixels (a 1440p or 4K
  canvas is upsampled by the composite pass, the HUD stays sharp); AUTO's adaptive scale
  respects it and follows window resizes. The cloud layer is marched at a third of the
  screen resolution on LOW (no shader recompile).

- **Static cells**: once the city is built, every scenery group registered once in `statics`
  hangs from a 1024-unit cell group; a cell out of reach is hidden in one test and its
  groups are skipped by the visibility loop, the matrix pass and both render passes (the
  scene's top level drops from ~9,650 children to ~1,750).

Frame pacing (`0d4ce01` adds the limiter): the loop is `requestAnimationFrame` with the
simulation step capped at 33 ms (the game slows rather than spiralling) and physics in fixed
1/120 s steps with the accumulator capped (at most four steps a frame). Nothing new compiles a
shader mid-play; the halo material is compiled with the scene by `prewarmShaders`.

- **Frame limiter** (Settings · Graphics, `settings({ frameLimit })`, saved as
  `dead-end-city-frame-limit`): 30, 60, 120 FPS or UNLIMITED (default). A refresh is only
  simulated and drawn once the cap's interval has come round; the due time advances by one
  interval per drawn frame, a frame up to a fifth of an interval early still counts (so 60 on
  a 60 Hz display stays 60), and after a stall the schedule restarts from now. AUTO's adaptive
  quality measures against the capped budget and never chases more than 60 FPS. Checked with
  simulated 60/75/120/144/240 Hz refresh timestamps with jitter (every cap lands exactly on
  its rate, or the refresh rate below it) and headless with the 2D renderer (28.5 FPS drawn at
  a 30 cap, uncapped at 60 and 120 where headless Chromium reaches ~50).

## Before / after

Before = version 30.0.0 (`f22ac56`); after = this branch before the lead's combat merge
(`0d4ce01`), both pages side by side on the same machine. Each scene is 8 frames after 4
settling ones (HIGH: 5 after 3); "draw" is the renderer's CPU time including the three.js
submit; "view calls" are camera-pass draw calls, "shadow calls" the shadow map's on its last
refresh.

LOW tier, frame scenes (before -> after; CPU ms per frame, headless):

| Scene | update ms | draw ms | view calls | shadow calls | programs |
| --- | --- | --- | --- | --- | --- |
| Midtown on foot | 35.6 -> 14.5 | 57.7 -> 31.2 | 211 -> 211 | 277 -> 277 | 42 -> 42 |
| Downtown drive | 26.2 -> 17.6 | 37.2 -> 30.5 | 227 -> 227 | 281 -> 261 | 43 -> 43 |
| North Point | 66.0 -> 23.1 | 61.0 -> 35.0 | 269 -> 269 | 201 -> 201 | 49 -> 49 |
| Beach club 23:30 | 36.7 -> 17.4 | 40.2 -> 36.5 | 219 -> 220 | 174 -> 175 | 70 -> 70 |
| Stadium match | 26.6 -> 22.2 | 44.7 -> 36.7 | 857 -> 864 | 298 -> 301 | 75 -> 74 |
| Sunset Pier 20:00 | 21.1 -> 14.8 | 45.0 -> 31.7 | 253 -> 255 | 186 -> 187 | 78 -> 77 |
| 5-star chase | 48.5 -> 21.4 | 41.0 -> 50.6 | 465 -> 466 | 425 -> 425 | 79 -> 78 |
| Helicopter 400 m | 26.8 -> 17.6 | 37.0 -> 38.0 | 342 -> 339 | 464 -> 461 | 90 -> 89 |
| Rain at 22:00 | 23.8 -> 16.8 | 68.5 -> 46.6 | 583 -> 583 | 649 -> 639 | 94 -> 93 |

HIGH tier, frame scenes (before -> after; CPU ms per frame, headless):

| Scene | update ms | draw ms | view calls | shadow calls | programs |
| --- | --- | --- | --- | --- | --- |
| Midtown on foot | 30.1 -> 26.3 | 74.8 -> 44.0 | 861 -> 860 | 614 -> 609 | 100 -> 99 |
| Beach club 23:30 | 19.5 -> 19.9 | 46.6 -> 135.9 | 595 -> 596 | 794 -> 794 | 100 -> 99 |
| Stadium match | 42.4 -> 14.8 | 54.2 -> 48.5 | 1147 -> 1126 | 733 -> 731 | 100 -> 99 |
| Helicopter 400 m | 38.2 -> 20.1 | 43.6 -> 43.8 | 795 -> 800 | 475 -> 476 | 100 -> 99 |
| Rain at 22:00 | 27.8 -> 12.8 | 52.9 -> 41.9 | 981 -> 978 | 650 -> 639 | 100 -> 99 |

Simulation only (`simulate()`, 1/30 s updates of four physics steps; allocation from the sampling heap profiler, collected objects included):

| Scene | ms / update | allocated KB / update | cars (physics) ms | people ms |
| --- | --- | --- | --- | --- |
| Midtown on foot | 22.8 -> 21.1 | 5192 -> 1737 | 11.7 -> 8.7 | 6.7 -> 4.1 |
| Downtown drive | 22.8 -> 14.5 | 4513 -> 1637 | 13.6 -> 8.2 | 5.1 -> 2.3 |
| North Point | 14.9 -> 11.8 | 4195 -> 1642 | 7.1 -> 4.9 | 4.5 -> 3.0 |
| Beach club 23:30 | 16.1 -> 10.6 | 3612 -> 1573 | 8.4 -> 4.8 | 3.5 -> 1.8 |
| Stadium match | 29.5 -> 11.1 | 4073 -> 1582 | 11.8 -> 5.1 | 7.5 -> 2.6 |
| Sunset Pier 20:00 | 11.6 -> 5.9 | 3803 -> 1520 | 5.6 -> 3.0 | 2.9 -> 1.2 |
| 5-star chase | 35.5 -> 20.4 | 6295 -> 2195 | 18.2 -> 8.9 | 11.6 -> 6.7 |
| Helicopter 400 m | 13.9 -> 11.8 | 4697 -> 1673 | 6.5 -> 6.0 | 4.3 -> 2.5 |

Summed profile self time over all nine LOW scenes (same minutes, same load): main-thread
non-idle time **7,091 -> 5,527 ms**; three.js matrix updates (`updateMatrixWorld` +
`multiplyMatrices`) **837 -> 294 ms** (the replacement pass included). Over the eight
simulation scenes: non-idle **20,066 -> 12,689 ms (-37%)**, garbage collection
**3,254 -> 939 ms (-71%)**, allocation **3.6-6.3 MB -> 1.5-2.2 MB per update**, the foot
collision test (`moveBody`'s `blocked` + `crowdStep`) **1,254 -> 33 ms**, `airCoverRay`
**240 -> 10 ms**.

Reading the tables: headless SwiftShader's main thread spends most of each 3-10 s frame
blocked on the software GPU, so single frame parts swing by 2x between runs. The update and
draw columns agree with the profile sums above on every scene except a few captures (the
beach club at HIGH, 46.6 -> 135.9 ms draw; the chase at LOW) where one page's GPU process
stalled the command buffer during that capture (the beach club measured 94.5 -> 42.2 ms at
HIGH in the previous run). Draw calls and programs are unchanged by design; the per-frame GC
of an 8-frame window is dominated by whichever page happened to run a major collection, so
allocation per update is the figure to compare. At 60 FPS the simulation runs two physics
steps a frame, not four, and a desktop CPU is 5-10x faster than this machine under load:
the after figures correspond to roughly 1.5-3 ms of simulation and 3-5 ms of render CPU per
frame on a desktop, inside the 5 + 5 ms budget.

### Five stars after the lead's combat merge

The combat batch roughly doubled the police at five stars (SWAT vans and teams, rooftop
snipers, army jeeps, APCs and trucks). The lead branch (`b582a9f`) against the merged branch,
side by side, after 24 simulated seconds at five stars (`wanted(5)` held; merged = `cc4ec30`,
measured before the bucket table of `47337fb`):

| Scene | officers (lead / merged) | ms / update | allocated KB / update | cars ms | police:officers ms | civic ms |
| --- | --- | --- | --- | --- | --- | --- |
| 5 stars, on foot | 31 / 40 | 25.1 -> 24.4 | 7252 -> 2378 | 12.0 -> 10.9 | 4.0 -> 1.9 | 5.0 -> 2.6 |
| 5 stars, driving | 56 / 49 | 26.5 -> 22.6 | 10565 -> 2503 | 14.0 -> 11.7 | 2.9 -> 2.2 | 4.0 -> 2.9 |

Officer sight and gang checks were already staggered by the combat work (about seven looks a
second per unit); what the merge adds is the allocation-free physics and pedestrian paths
(3-4x less garbage with 40-80 units), and the broadphase now buckets vehicles into a fixed
table instead of a Map lookup per vehicle cell per step. Car physics remains the largest
simulation cost at five stars: every police and army vehicle is awake and in the contact
passes.


## Checks

- Screenshots at HIGH before and after (Midtown at noon, North Point, the beach club at
  23:30, Sunset Pier at 20:00 with the rides, the stadium match, rain at 22:00, the
  helicopter at 400 m, a car's lamps at night close up): the only pixel differences are
  moving people, traffic, the LED screen and searchlights, radio chips and the opening card;
  no scenery missing, shadows and halos unchanged. Rechecked after the static cells, and
  after the merge (Midtown, Sunset Pier, the night car).
- No console errors or warnings in any run (other than three.js's deprecation notice).
- Missions: mission 1 starts (PICK UP VINNY'S MARKED CARGO TRUCK), the depot delivery stage
  runs with the police alerted, a 3-star chase builds (patrols, air unit, a roadblock,
  contacts and spin-outs), walking on foot collides and moves; repeated on the merged build.
- `sh tools/check.sh` passes; `tools/dead-code.mjs` reports nothing new (its "only assigned"
  `broadphaseStamp` is read through `++`).

## Remaining hot spots

- Vehicles are still ~30 meshes each (~50-270 draw calls in street views); instanced body
  shells take over only when zoomed out. Merging each car's static trim into one mesh per
  material needs care with the per-part damage.
- Match-day players are individual person models (~22 draws each): the stadium is the
  heaviest view in draw calls (~865 at LOW).
- Five stars: 40-80 awake police and army vehicles make car physics (control, contact
  passes) about half of the simulation; officers themselves are cheap now. Sleeping far,
  still units harder, or a coarser step for vehicles far from the player, would be the next
  lever.
- Small helpers called for every person several times a frame (`personIncapacitated`) read
  properties of many object shapes (pedestrians, officers, soldiers, athletes); giving people
  one declared layout, as vehicles now have, would make those reads monomorphic.
- The physics step is now the largest simulation cost (at 60 fps it runs twice a frame);
  what remains is mostly arithmetic in the control and contact passes and V8 boxing doubles
  in small helpers (the allocation that is left, ~1.5 MB per 1/30 s update headless, is
  short-lived numbers the young-generation scavenger clears cheaply).
- Night scenes still use a sprite per lamp halo on props and stations (the street lamps'
  halos are already in the glow field).
- Every standard material evaluates seven point lights and two spot lights per pixel (fire,
  muzzle, target, headlight pools kept at zero intensity so the programs never change);
  turning them into a light pool per tier would change the programs and is left for a
  change that can recompile at start-up only.
