# Repeatable laptop graphics checks

The provisional target is a steady 60 FPS at a **1920×1080 scene buffer**. M4 Max is the
target device for Ultra; other laptops should be checked on all presets to identify
their comfortable setting. These are acceptance goals, not measured claims. Cloud
SwiftShader runs validate behavior and work counts, not laptop GPU speed.

## Keep the comparison controlled

1. Use the same build URL/commit in a fresh browser profile, with `?dev&seed=1` appended.
   Start a new game. This developer run changes settings and game state; use a scratch
   profile instead of an existing save. Reload between independent runs.
2. Record laptop model, CPU/GPU, RAM, OS, browser/version, display refresh rate, power
   mode and whether plugged in. Enable browser hardware acceleration. Keep the game
   foreground and use one game tab; close competing GPU-heavy applications.
3. Use an undocked developer console. The game viewport must remain the same for every
   sample. Record `innerWidth`, `innerHeight`, `devicePixelRatio` and
   `DeadEndCity.graphics()` before and after. Approximate scene dimensions are CSS
   dimensions × `graphics().pixelRatio` × `graphics().renderScale`. At DPR 2, a 1920×1080
   CSS viewport on Ultra is a 3840×2160 scene: do not label that a 1080p result. A browser
   responsive viewport with DPR 1 can hold 1920×1080 for preset comparisons; also test
   the laptop's normal full-window resolution as a separate case.
4. Set `DeadEndCity.settings({frameLimit:'unlimited'})` to assess headroom, then repeat
   with `'60'` for the target experience. Keep VSync/display rate recorded: 60 FPS on a
   60 Hz display does not reveal how much headroom remains. Do not disable normal
   presentation throttling for the acceptance run.
5. Choose a fixed preset with `DeadEndCity.graphics('ultra')` (or `low`, `medium`, `high`).
   After each tier change, warm the scene for at least 30 seconds; check
   `DeadEndCity.renderHiccups().prewarm` / `.litStage` for pending work or errors. Measure
   cold-start hitches separately. Also run `graphics('auto')`, recording its final tier
   and render scale; AUTO intentionally changes those, so it is a separate case.

## Fixed scenes

Use these positions and repeat each with `viewMode('street')` and `viewMode('chase')`.
For chase view, call `chaseLook(0, 0, heading, 2)` after positioning. Begin on foot;
return to a fresh game before changing to the driving route.

| Case | Position | Chase heading (degrees) | Clock / weather |
| --- | --- | --- | --- |
| Royal Avenue, toward water | `teleport(1152, 1160)` | 180 | `setClock(15, false)`; `sky('fair')` |
| Midtown street and rooftops | `teleport(2100, 2000)` | -90 | 15:00, fair |
| Midtown lights and wet surfaces | `teleport(2100, 2000)` | -90 | `setClock(22, false)`; `sky('rain')` |

The names above are `DeadEndCity` methods. Let camera and weather transitions settle
before timing. Keep simulation live for the gameplay sample. To isolate rendering and
compare the same picture, settle the scene, then use `holdSimulation(true)`; mark the
sample **held simulation** and restore `holdSimulation(false)` afterward. Held samples
exclude normal simulation cost and cannot establish the full-game FPS target.

For a motion/hitch route, start a fresh seeded page at `teleport(420, 4400)`, board
`drive('sedan', 0, 0)` and use chase view. Record a 10-second acceleration sample with
`frameTrace('start', ['KeyW'])`, then `frameTrace('stop')`. Record start/end `status()`;
the car spawns at the nearest clear position, so reject or separately label runs with
different spawn locations, collisions or interruptions. Repeat on the same build and
seed for both camera modes. This is a reproducible input route, not a collision-free
cinematic or a guarantee that every run has an identical live traffic history.

## Capture live frame intervals

First sample the always-visible FPS counter without instrumentation. For diagnosis,
paste this in the console after staging a scene; return focus to the game within five
seconds. Keep the game foreground for the sample. The result is stored without per-frame
console logging; inspect or copy `JSON.stringify(window.decLaptopSample, null, 2)` afterward.

```js
setTimeout(() => {
  DeadEndCity.pauseMenu(false);
  const before = {
    status: DeadEndCity.status(), graphics: DeadEndCity.graphics(),
    viewport: [innerWidth, innerHeight, devicePixelRatio]
  };
  DeadEndCity.stats();
  DeadEndCity.frameTrace('start');
  setTimeout(() => {
    window.decLaptopSample = {
      before, trace: DeadEndCity.frameTrace('stop'),
      stats: DeadEndCity.stats(), graphics: DeadEndCity.graphics(),
      scenery: DeadEndCity.sceneryPools(), hiccups: DeadEndCity.renderHiccups()
    };
  }, 30000);
}, 5000);
```

Run three samples per scene/preset; report all three and their median, not just the best.
Confirm `trace.mode === 'live'`, `trace.wrappersLeft === 0`, expected duration/frame count
and uninterrupted play. Traces cap at 7,200 frames; shorten the sample on displays faster
than 240 Hz. `trace.gaps.p50`, `gaps.p95`, `gaps.max` and `gaps.over33` describe drawn-frame
intervals. For a 60 FPS goal, look for typical intervals near 16.7 ms or below and explain
repeated 33.3 ms stalls. Record the FPS HUD together with these intervals; browser
presentation/refresh limits and trace overhead are part of the interpretation.

`trace.p50Ms` / `p95Ms` and `stats().updateMs` / `drawMs` measure CPU work, not GPU frame
time. `hitchRun()` and `simProfile()` use stepped frames and must not be reported as
presented FPS. `stats()` averages CPU timings since its last call, while its draw/triangle
counters describe the last rendered frame. Use a browser performance trace/GPU tool
on the target laptop when attributing time to GPU versus CPU.

## Rooftop optimization A/B

In a held, settled scene, measure `sceneryPools(false)` and `sceneryPools(true)` in
alternating order (off/on, on/off, off/on). Wait a few rendered frames after each toggle;
save `stats()`, `drawProfile(30)` and matching screenshots alongside timing samples.
Check camera **and** shadow calls, triangle counts, memory growth and unchanged rooftop
shadows. `sceneryPools()` reports camera-frustum bounds, not actual submitted GPU work.
Shadowed presets and wide/flight views deliberately use the original single-draw pools.
Use LOW or turn shadows off for the optimized A/B. Restore `true` when
done. A vertex reduction is evidence of less geometry work; only real-device timing can
show whether that outweighs chunk traversal on a particular laptop; the final policy allows
no additional draws.

Save results with build/commit, device details, resolution, preset, camera/scene, live or
held status, all three traces and screenshots. This makes the next developer's comparison
repeatable and keeps the M4 Max Ultra target separate from software-rendered checks.
