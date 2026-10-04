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

## Second pass: the simulation side (1 October 2026)

Goal: fewer CPU milliseconds and fewer hitches from the game logic (physics, people, traffic,
HUD), identical behaviour at every graphics setting. "Before" is the lead branch as this pass
merged it (`f828cdb`; `7045d9b` for the first runs), "after" this branch; both numbers come from the
same console report on the same scenarios.

### How it was measured

- `DeadEndCity.simProfile(seconds, keys)` steps `update()` at 1/60 s with no drawing and
  reports the per-section milliseconds (average and worst), p50 / p95 / p99 / max frame and the
  slowest frames. Scenarios, each staged with console calls (`teleport(748, 584)`, `drive`,
  `wanted`, `arm`, `hostileGunman`): STREET (on foot at the start, 17:24), DRIVE (sedan, W held,
  noon), CHASE (sedan, five stars), FIREFIGHT (pistol, four stars, three Harbor Kings gunmen).
- The shared test machine ran at a load of 8-20 on 4 cores, so wall-clock milliseconds swing
  by 2x and any single frame can be a descheduling. What held up:
  - `node tools/dev.mjs call simProfile ... --cpu`: the page's main-thread CPU time (CDP
    `ThreadTime`), reported per frame;
  - `--profile N --who bursts`: the longest single call of each `update()` section from a V8
    sampling profile, counting only CPU time (gaps where the thread was descheduled are
    dropped). This is what found the hitches: a call that stays slow here is real;
  - A/B runs in blocks (A B B A) against a clean build of the base commit, medians and minima.

### What was found, and what was done

| Finding | Evidence | Change |
| --- | --- | --- |
| Minimap text stalls | `updateUI` single calls of 50-180 ms while driving (`drawTransitMap > fillText`, `drawGarageMap > fillText`): the minimap's scale eases with speed and text was set at `10 / scale` px, a new font string (a font lookup and glyph build) every refresh | overlay painters skip markers outside the drawn window (`mapWindowHas`), set fixed-size text through `mapLabel` (one font string, counter-scaled), and the fonts are set once at boot (`warmMapFonts`) |
| `vehicleSpec` was 12% of a driving frame | ~10,000 calls a frame at 83 ns (micro-benchmark): reading `airframe`, which a car does not have, off objects of many layouts costs about 60 ns | `type` first, `airframe` only for aircraft: 22 ns; `makeCar` declares the optional fields the step reads on every vehicle |
| Boat hull test allocated about 20% of everything | `hullTouchesLand` + `segmentCross` + its closure: 100-240 MB per 600 frames in the street scene (a list of every region, two objects per polygon vertex, a closure per edge) | plain numbers, far edges rejected first: no allocation, same answers (240,000 random hulls against the old code) |
| Broadphase and traffic AI garbage | `length = 0` frees an array's backing store, so every step regrew ~250 bucket lists and the pair lists; `trafficControl` made four closures and two objects per call | counted lists (`list.n`, `broadphasePairCount`), scan functions of their own, scratch records |
| Writes of unchanged doubles | a double stored into an object field allocates a boxed number: three per parked vehicle per step in `controlVehicle`, five per `contactShape` call | `if (a !== b) a = b` |
| Crowd grid | its cells were emptied with `length = 0` every frame | counted cells (`cell.n`): the people part 12% cheaper |
| Forced layout per hit | `playerHitFeedback` read `el.offsetWidth` on every bullet that hit the player | the arc's animation restarts by switching between two identical keyframes |
| Car radio | `audio.volume` written every frame while the level eased | written when it moves by 0.0005 |
| Parked vehicles in `settleVehicle` | ~1 us a vehicle a step for ~230 parked vehicles that return at every check | a guarded early exit (`settleVehicleFull` is the old body) |

### What did not work

- Making every pedestrian a fast-mode object (replacing `Object.assign` in `resetWalkerState`):
  V8 had left a third of the crowd in dictionary mode, which looked like a defect, but fast mode
  with a dozen shapes was *slower* (people part +30%, `knockdowns` 0.08 -> 0.2 ms in A/B), so it was
  reverted.
  Do not give people "one declared layout" expecting a win without measuring it.
- Per-line profiles of optimised code only name the function's first line (callees are inlined);
  `DEC_JS_FLAGS=--no-turbo-inlining` shows the callees but inflates allocation by boxing.

### Results

Per 60 fps frame of `update()` at the lead branch before this pass (A) and after (B); medians of
4 runs of 8 s per build, in blocks A B B A on two dev servers. CPU is the page's main-thread CPU time per
frame (`--cpu`); the sections are wall-clock ms from `simProfile` (inflated by the machine's load, the
comparison between A and B is what holds).

| Scenario | CPU ms A -> B (median; min) | cars section | phys control / settle / broadphase | people | note |
| --- | --- | --- | --- | --- | --- |
| STREET (on foot, ~280 vehicles, ~610 people) | 5.88 -> 4.87 (-17%); 5.34 -> 4.66 | 4.15 -> 3.13 | 1.65 -> 1.33 / 0.83 -> 0.53 / 0.74 -> 0.52 | 1.10 -> 1.04 | p99 frame 15.3 -> 11.3 ms |
| DRIVE (sedan, W held) | 7.04 -> 5.84 (-17%); 6.53 -> 5.60 | 7.65 -> 6.68 | 3.26 -> 2.79 / 1.63 -> 1.32 / 1.47 -> 1.20 | 2.42 -> 1.90 | `ui` 1.37 -> 0.48 ms |
| CHASE (five stars, 300 vehicles) | 10.2 -> 10.3 (no change; mins 7.8 / 9.1) | 13.1 -> 9.9 | 5.0 -> 4.1 / 2.4 -> 1.55 / 2.4 -> 1.6 | 2.1 -> 2.2 | the police and civic parts differ run to run (B's world had 9 more vehicles and more officers) and swamp the physics gain |
| FIREFIGHT (320 vehicles) | 10.7 -> 10.2 (-5%); 10.0 -> 9.6 | 7.0 -> 7.0 | 2.85 -> 2.66 / 1.5 -> 1.5 / 1.3 -> 1.1 | 1.15 -> 1.4 | physics here is the awake cars, which this pass leaves alone |

- The gain is where cars are parked: the parked ~230 vehicles cost about a third less per physics
  step, and a drive no longer pays for the minimap's font churn. Heavy scenes with many awake
  police and gangs move little.
- The minimap refresh while its scale eases (accelerating), raster flush included: median 2.7 -> 1.0 ms,
  p90 6.7 -> 2.8 ms, worst 29-35 -> 6-17 ms at three places in the city (a console-called loop).
- Allocation per 600 STREET frames (V8 sampling heap profile, includes every object): 1.25 GB ->
  1.10 GB; the largest left are `trafficControl`, `controlVehicle`, `vehicleBroadphase` and
  `rectListBlocked` (boxed doubles: most hot functions run in V8's mid-tier compiler, Maglev, which
  boxes more than TurboFan would).
- Micro-benchmarks: `vehicleSpec` 83 -> 22 ns per call (~10,000 calls a frame); an unchanged `count`
  list against `length = 0` + push 43 against 105 ns and no garbage.


### Left for later

- Every parked vehicle is still visited by the broadphase, contact and settle loops 120 times a
  second (about 1 us each). An explicit list of the awake vehicles, with resting ones tracked
  by the cells they occupy, would remove most of the physics cost but must keep contact
  results exact.
- `updateCars` makes a closure and a four-array per vehicle per frame for the pedestrian
  contact test (physics-update.js); `touch` is called for every person near a car.
- What remains of the garbage (~1.2 MB a frame) is mostly boxed doubles passed to helpers
  that are not inlined (`solid()` and its twenty `*Blocked` helpers, `rectListBlocked`).
- GC pauses of 50-100 ms seen in headless runs coincide with a loaded machine (the scavenger's
  helper threads wait for a core); they shrink with the allocation volume but cannot be
  measured here without an idle machine.

## Third pass: solid(), exact hypot and the long-session soak (2 October 2026)

Measured on the lead head `66b4a0b` plus only the console probes (A) against this branch (B), one dev server, the page
file swapped and reloaded in A B B A order (`tools/ab.mjs`), CPU ms per 60 fps frame of `update()` from the page's
thread time (the machine ran at a load of 11-16 on 4 cores, so only A against B means anything). Medians of two runs of
8 s each:

| Scenario | A | B | change | cars section | people |
| --- | --- | --- | --- | --- | --- |
| STREET (on foot, 17:24) | 5.53 | 4.99 | -9.8% | 3.54 -> 2.96 | 1.34 -> 0.99 |
| DRIVE (sedan, W held) | 5.42 | 5.12 | -5.5% | 3.48 -> 3.46 | 1.15 -> 1.06 |
| CHASE (five stars, god mode) | 7.35 | 6.78 | -7.8% | 4.13 -> 3.80 | 1.10 -> 0.94 |
| FIREFIGHT (four stars, 3 gunmen) | 8.39 | 7.65 | -8.8% | 4.48 -> 4.04 | 1.20 -> 1.12 |

What was found, with the tool that found it:

- `solidPart <helper>` times each of the twenty `solid()` helpers alone: nineteen cost 60-260 ns, `garageBlocked` **3,188 ns and
  1.1 KB of garbage a call**. The nine garages sit one per island, so their walls' overall bounds cover the world and
  `rectListBlocked`'s bounds early-out never fired: every call walked 72 rectangles. Rectangle lists are now indexed in
  256-unit cells (exact: a rectangle overlapping the box shares a cell with it). `solidBench` (200,000 calls over the map):
  5,362 -> 1,590 ns a call and 277 -> 59 MB; near the player (span 300) 1,523 -> 678 ns.
- `Math.hypot` makes an argument array and boxes its result: `hypot2` (the builtin's own operations: bit-identical over
  600,000 random and special pairs) is 15.9 against 34.6 ms per million. `distanceBetween` and the hottest vehicle and crowd
  loops use it.
- The promenade rail test did nine Map lookups a call (an exact cell mask makes it one byte read); `railBlocked`,
  `underpassBlocked`, `countyBlocked` made a closure per call and the Commons pond ellipse a sine and cosine for every point
  (a point beyond the longer radius is outside); the vehicle grid for foot steps is a plain array of counted cells.
- `updateCars` made a closure and a four-element array per vehicle per frame and tested every person near a parked car:
  a vehicle under 0.1 km/h with nobody in contact is skipped (`knockPerson` turns anything slower away at once).
- Parked vehicles: not restructured. They cost about 0.2-0.3 ms of a 5-8 ms frame; an exact active list would have to
  reproduce the broadphase's pair order and still poll every vehicle for a wake-up (BACKLOG).
- `drawPoliceMap`'s stalls in headless runs were not reproducible as drawPoliceMap's own cost (see BACKLOG).
- Exactness checks: `solidAudit` compares every rewrite with the code it replaced (1.2 million points, 0 differences),
  `cellMaskAudit` and `hypotAudit`; 22 regression tests pass (tools/tests/sim-audits.mjs among them).

### The soak (tools/soak.mjs)

A seeded bot plays 30 game minutes through the console (26 kinds of episode: see testing-and-console.md) and records every
30 game seconds. First run (seed 1, 15 minutes of wall time), 0 console errors, 0 non-finite positions:

| Series | start | 30 min | note |
| --- | --- | --- | --- |
| JS heap after a full collection (MB) | 38.1 | 47.9 | +7.5 in the first 15 min, +2.3 in the last 15: caches and menus fill, then it levels |
| DOM nodes | 2,428 | 3,029 | menus built on first open (help, arsenal, settings, map), then flat |
| event listeners | 249 | 293 | same; 241-381 while the settings screen is open |
| live Web Audio nodes | 100 | 89 | 40-206, no trend |
| vehicles / wrecks | 283 / 2 | 353 / 36 | wrecks and abandoned cars were never removed: fixed below (the wreck limit) |
| every log, queue and cache | | | capped (seaEvents 64, shotLog 40, runOvers 12, bloodPools 240, skids under 1,100) |
| probe: CPU ms a frame, same Midtown scene | 5.49 | 8.22 | follows the vehicle count (271 -> 354) and the AI pool (89 -> 122) |

### The wreck limit (3 October 2026)

The finding above (vehicles 283 -> 353, frame 5.5 -> 8.2 ms, because only AI traffic streams out) is closed by
`retireWrecks` (livingcity-wrecks.js; rule and numbers in docs/areas/people-and-crowd-living-city.md). The owner asked
whether the limit meant the whole game or what is on screen: it is the whole world (every vehicle that stays after the
player leaves is stepped for ever), and what is on screen or near is never touched. Wrecks unseen for 50 s and cars the
player left unseen for 180 s go; the world holds at most 16 wrecks and 24 abandoned cars (longest-lived unseen first);
mission cars, the player's car, intact owned cars, police crews' cars are protected. Measured on the no-render page:

| Run | created | vehicles | wrecks / abandoned at the end | retired |
| --- | --- | --- | --- | --- |
| stress (every 20 game s a new street: 3 wrecks and 2 abandoned cars, 10 game min) | 84 wrecks, 56 cars | 280 -> 300 -> 279 (140 more without the limit) | 8 / 24 (never over 13 / 24) | 114 (85 by timeout, 29 by cap) |
| soak bot, seed 1, 14 game min | its own episodes | 0 console errors, 0 non-finite | at most 13 wrecks | 33 |

The pass costs under 0.3 ms once a second (`wreckReport().lastPass.ms`). tools/tests/wreck-limit.mjs checks the timeouts,
the cap order, the protected and in-view cases, `integrity()` and `settleAudit()` after retirements.

The only defect it found was the cab's FARE notice (a `routeLength` declared twice, fixed with a test and the
`tools/dup-functions.mjs` guard). The page is no-render: renderer-side leaks are not covered.

## Fourth pass: hiccups, frame by frame (3-4 October 2026)

Goal from the owner: no random hiccups on any tier. A hiccup is a frame much longer than its neighbours, so this pass
measured every frame instead of averages, with a cause per long frame.

### The tool

`src/frame-trace.js` records each frame's sections (update parts, renderer laps, `f:pre`) and what happened in it:
heap drops (collections; `--enable-precise-memory-info` in tools/dev.mjs makes `performance.memory` exact), DOM
mutations by element and attribute, WebGL texture and buffer uploads (bytes, update ranges counted exactly) and program
links, canvas 2D draws and text, Web Audio nodes, localStorage writes, vehicle models built, spawns, first-use programs,
textures and geometries. The counters are prototype wrappers installed only while a trace runs. `runFrame()` is the
frame body shared by the requestAnimationFrame loop and the console's stepped runner, so a stepped frame is a real
frame minus the browser's own style, layout and paint. Console: `hitchRun` (stepped), `frameTrace` (live),
`uploadChurn` (what three.js re-uploads), `cityMap` (staging). `node tools/hitches.mjs` runs a fixed tour: walk,
eight district teleports, a downtown drive, the Keys Bridge, the county, a three-star chase, a crash, a blast, out of
the car and back in, rain at 21:30, the map, the pause menu; `--ab A.html B.html` compares two builds in ABBA order.

### What it found (no-render page, base build plus the tool, load 8-19 on 4 cores)

| Stage | CPU ms / frame | KB allocated / frame | long frames (of) | long frames' section (count) | tags |
| --- | --- | --- | --- | --- | --- |
| walk | 5.5 | 1,700 | 44 (360) | cars 20, people 11, sound 5 | gc 4, spawn 1 |
| districts | 4.4 | 1,400 | 50 (720) | cars 20, people 5, civic 5 | gc 9, spawn 3 |
| drive | 4.7 | 1,600 | 11 (480) | cars 8 | |
| chase (3 stars) | 5.7 | 1,600 | 19 (600) | cars 8, civic 4, people 3 | gc 3, spawn 3 |
| blast | 6.6 | 1,500 | 10 (180) | cars 5, damage 2 | gc 2 |
| rain at night | 6.3 | 1,600 | 17 (480) | cars 10, people 2 | gc 5 |

- **Collections**: the simulation allocates 1.4-1.7 MB a frame (mostly boxed doubles: `trafficControl` 18%,
  `controlVehicle` 12%, `vehicleBroadphase` 9%, `knockSceneProps` 3.5%, `settleVehicle` 2.7%, `updateBloodTracks` 2.6%),
  so a ~30 MB young-generation scavenge runs about every 18 frames, three a second. On this loaded machine those frames
  were among the longest (helper threads wait for a core); on a laptop a scavenge is a few ms. Not changed here (the
  physics files belong to another change in flight): the largest lever left.
- **CPU bursts** (`--profile --who bursts`, CPU time with descheduling gaps dropped): single `updateCars` calls of 4-7 ms
  (physics step, `hullTouchesLand`, `controlVehicle`) at ~280 vehicles; `updateUI` 6.6 ms (the minimap:
  `drawCivicMap`, `entityElevation`); `updateMilitary` 5.6 ms (`updateGatePieces`); `updateUI` 5.3 ms in
  `placeDockLine > getBoundingClientRect` (fixed below). The first trace after a boot had two frames of 45 and 89 ms in
  the physics (JIT warm-up and a collection); later runs did not repeat them.
- **DOM**: 25 mutations a second standing still, 60 in a chase: attributes rewritten with the value they had
  (`data-context`, the speed box's `data-mode`, the radio's `aria-pressed`, the portrait's `title`) and the toast's
  `classList.remove('show')` on every frame of a notice's leave (`add`/`remove` rewrite the attribute even when nothing
  changes).
- **Rendered, LOW** (480 x 300, software GL, prewarm on): 0-1 programs created per stage (the prewarm holds); a drive
  into new streets uploads 2.4 geometries and ~240 KB of buffers a frame (the cell pre-upload and new car models) and
  ~0.1 car model a frame; standing still ~160 KB of buffer uploads a frame in ~90 calls, almost all the crowd's
  instance ranges. `uploadChurn` named two buffers re-sent whole every frame: the skid marks (184 KB while any mark is
  drawn) and the contact shadows (57.6 KB at LOW). Wall-clock frames there took 0.5-14 s (software GL under load), so
  MEDIUM, HIGH, ULTRA and AUTO were not toured: their GPU cost is not measurable here.

### What changed

| Fix | Files | Measured |
| --- | --- | --- |
| HUD attributes written only on change (`hudAttr`), toast class guarded | game-state.js, hud-state.js, hud-panels.js, hud-notify.js, car-radio.js, story.js | DOM mutations a second (A/B, medians of 2+2): standing 25 -> 8.3, driving 27.6 -> 14.5, car out/in 24.5 -> 15.3, chase 60 -> 46 |
| The dock line's layout read moved to the start of the next frame or HUD pass (`measureDockLine`) | hud-state.js, game-loop.js, game-ui.js | the 5.3 ms forced whole-page layout each time a prompt or a card docked is gone (the read finds a clean layout) |
| Skid marks and contact shadows send only what is drawn (`addUpdateRange`) | render3d-frame.js, lighting3d-look.js | skid marks 184 KB a frame -> the marks drawn; contact shadows 57.6 KB -> 64 bytes a shadow (~6.4 KB in a street) |
| New car models: still at most 6 a frame, and none after 3 ms of building | render3d-resources.js, render3d-frame.js | bounds a burst of new traffic to ~3 ms of model building a frame (plus one model) |

CPU per frame and allocation are unchanged by design (A/B 4.2-6.9 ms either way). tools/tests/hud-dom-writes.mjs keeps
the steady HUD at zero rewritten attributes; tools/tests/frame-trace.mjs covers the tool.

### Left for later (measured cost)

- Allocation 1.4-1.7 MB a frame, three scavenges a second (above); `knockSceneProps` also tests every vehicle against
  every prop near the player (O(props x vehicles)): the vehicle grid would do.
- Minimap passes of up to 6.6 ms CPU every 0.09 s (map-view.js): spread its layers over passes.
- The 2D overlay canvas (`worldContext`) is cleared every frame even when nothing was drawn on it, so the browser
  composites a full-screen layer every frame: clear only after a frame that drew.
- Forced layouts left: `restartNoticeTimer` (`void bar.offsetWidth` per new or refreshed notice) and the prompt pop
  (`void el.offsetWidth` per new prompt).
- Whole-buffer re-uploads left: the mud clumps (40 KB a frame, offroad3d-mud.js) and an unnamed instanced sphere pool
  (42 KB a frame); the skid marks still compute two terrain heights per mark per frame (up to 2,200) for marks that
  never move.
- The tour at MEDIUM-ULTRA and AUTO on a real GPU (`node tools/hitches.mjs --tiers medium,high,ultra,auto --scale 0.2`
  with `DEC_GPU=1`).

### Second round: garbage, layouts and the rest of the list (4 October 2026)

**Exactness first.** `dev.mjs start --seed 1` opens a deterministic page (seeded Math.random from the first line, the
simulation held from the first frame, no sound, frame-clock systems stepped only by the console), and hitchRun steps
from a clock starting at 0, so two boots of a build replay the tour to the same `stateHash()`; `hitches.mjs --ab --hash`
compares builds. Every change below that touches the simulation was proved with equal hashes in all four runs (A B B A)
at the end of walk, districts, drive, chase, crash, blast and car out/in.

**The garbage was megamorphic reads.** `allocBench` (bytes per call) and `shapeReport` (object layouts) found it: a street
held 25-41 vehicle layouts (fields added after creation by assignDriver, vehicleHandling, the army, police and air units,
aircraft, horns, blood...), so every read in the loops over all vehicles was megamorphic, and V8 allocates a boxed copy
for each megamorphic read of a number field. Declaring every field in `makeCar` left 2 layouts. Then a closure
(`pathAhead.some(...)`) inside trafficControl's scan of every vehicle made V8 allocate a context per vehicle, and small
helpers V8 did not inline (`clamp`, `normalizeAngle`, `wetGrip`, `corneringLimit`) boxed their arguments in every moving
vehicle's step.

| allocBench (bytes per call) | before | after |
| --- | --- | --- |
| trafficControl (every city AI car, 20 Hz near) | 24,181 | 3,492 |
| vehicleBroadphase (every physics step) | 80,115 | 15,254 |
| controlVehicle (every vehicle, every step) | 443 | 114 |
| settleVehicle | 284 | 21 |
| knockSceneProps (every frame) | 26,501-50,732 | 69 |
| physicsStep (all of the above, 2 a frame) | 571,637 | 146,899 |

Tour A/B, seeded (A = the merged lead branch with this pass's tools, without the garbage work; medians of A B B A):

| Stage | KB allocated a frame | collections | long frames | CPU ms a frame |
| --- | --- | --- | --- | --- |
| walk | 1,771 -> 844 | 11.5 -> 3.5 | 38 -> 41 | 6.5 -> 6.1 |
| districts | 1,294 -> 554 | 12.5 -> 5.5 | 65.5 -> 60.5 | 4.0 -> 4.3 |
| drive | 1,454 -> 577 | 5.5 -> 2.5 | 60 -> 26.5 | 4.5 -> 4.8 |
| chase | 1,680 -> 704 | 7 -> 3 | 68 -> 29 | 5.7 -> 5.7 |
| crash | 1,673 -> 604 | 2 -> 0.5 | 10.5 -> 5.5 | 5.8 -> 5.9 |
| blast | 1,849 -> 651 | 3.5 -> 0.5 | 19 -> 10 | 6.5 -> 6.1 |
| car out/in | 1,646 -> 536 | 2 -> 0.5 | 19.5 -> 9 | 5.8 -> 5.3 |
| whole tour | **1,558 -> 638** | | | |

The target was 300 KB a frame: not reached. What allocates now (street, 5 s, KB a frame): controlVehicle ~51 (helper
calls with number arguments: engineAcceleration, vehicleHandling...), boxContact 21, footprintOffGround 20, solid 19,
updateBloodTracks 18, vehicleBroadphase 18, militarySolids 16, updateKnockdowns 14, people 11 (83 pedestrian layouts:
`shapeReport('people')`), touchPerson 11, iterator steps (`> next`) in updateBeach, updateAmbience, soundUpdate,
updateMilitary ~5 each. CPU per frame moved within the noise (the machine ran at a load of 15-22).

**Also in this round**: no forced layouts for animation restarts (the district name on every district crossed, the
notice timer, the prompt pop, the radio chip, the world-edge beat, the demo card, the sportsbook stamp: a computed-style
read instead of offsetWidth); the overlay canvas cleared only after a frame drew on it; skid marks carry the ground
height of both ends from when they are laid (up to 2,200 terrain lookups a frame before); drawCivicMap skips hidden places
(five canvas states per place for every place in the city before); updateGangFights builds no arrays and skips rivals
whose longer leg already exceeds the best distance; the gate pieces, traffic hum and siren loops are indexed;
strokeRoad no longer destructures every point.

**Tiers** (480 x 300 rendered, software GL, prewarm on, after a tier switch; walk then drive, ~20 stepped frames each):

| Tier | view calls (walk / drive) | shadow calls | triangles (walk) | programs | programs created in the stage | buffer KB a frame |
| --- | --- | --- | --- | --- | --- | --- |
| LOW | 235 / 199 | 0 | 0.87 M | 171-172 | 1 / 0 | 100 / 135 |
| MEDIUM | 272 / 233 | 330 / 169 | 2.08 M | 235-240 | 4 / 0 | 138 / 95 |
| HIGH | 307 / 251 | 339 / 190 | 2.13 M | 250-252 | 4 / 0 | 115 / 100 |
| ULTRA | 318 / 271 | 251 / 192 | 1.58 M | 258 | 2 / 0 | 110 / 100 |
| AUTO (picked LOW here) | 316 / 307 | 0 | 0.91 M | 259 | 1 / 0 | 110 / 105 |

The programs created in the walk stage come right after each tier switch (the staged change covers the scene, not models
first seen after it); ULTRA's switch reallocates its post targets (4.6 MB of texture storage a frame over the stage, once).
GPU time is not measurable here.

**The new driving camera** (1280 x 800, HIGH, pulled back at speed, zoom 1.06-1.16): 347-413 calls a frame, of which
vehicle models 150-188, sprites 27-51, static batches ~49 and the scenery detail layers only 13. Culling the detail layers
by zoom would save about 3%: the lever is per-vehicle calls (each car is ~25 meshes; merging a car's static trim per
material, or the instanced body shell for traffic beyond a distance at the pulled-back zoom). Not changed.

**Left**: knockSceneProps still tests every vehicle against every prop near the player (69 bytes but ~45 us a frame);
the minimap's layers are all redrawn every 0.09 s (drawBikeShareMap up to 7 ms CPU here when zoomed out at speed); the
pedestrians' 83 layouts; the active-vehicle list for parked cars (BACKLOG).
