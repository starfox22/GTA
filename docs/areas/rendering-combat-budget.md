# Combat render work

October 20 military-base combat review: the renderer retains gameplay, AI counts,
near model detail, effect counts and lifetimes. Read the associated audit for
native profiles and their software-renderer limitations.

## Vehicle stain scheduler

`render3d-frame.js` calls `cbBeginFrame` once per rendered frame. All stained cars
share a fixed 3 ms cooperative fit/paint allowance in `carblood3d-skin.js`.
Previously, a wall-clock gap over 5 ms reopened the allowance, even when another
car was still being processed in the same frame. A slow render could therefore
refill its own budget repeatedly. Wall-clock gaps now only feed diagnostics.
An indivisible generator operation may still overrun; it prevents further slices
in that frame. Skin allocation, uploads and final geometry commit are separate
operations, so this allowance is not a total renderer frame-time guarantee.

`tools/tests/car-blood-budget.mjs` executes the production scheduler against a
deterministic clock: multiple vehicles, long stalls, distinct fast frames,
overshooting steps and eventual exact generator completion.

## Cooperative stain fitting

`carblood3d-fit.js` also checks that deadline inside work previously hidden within
a single generator step: the full-body top-surface probe, both cover-grid passes,
and dense per-polygon cover-ray searches. Gathering checks every 256 vertices;
top/candidate scans every 64 triangles; cover rays every 64 candidates; grid fill
every 128 cell writes. Large candidate/output buffer copies progress in chunks of
4,096 elements. Attribute growth publishes all new arrays together after copying,
so a suspended build cannot expose a partially replaced output.

Matrices and clipping buffers belong to the individual fit generator. The model's
body-relative transforms are captured before gathering; another car's fit or a
subsequent render cannot overwrite its scratch while an inner scan is suspended.
Clipping, cover decisions, output vertex order, normals, UVs, event ranges and
material inputs retain their original arithmetic. Typed-array allocation and
Three.js matrix propagation remain atomic operations; deadline checks bound the
JavaScript scan chunks, not allocation or garbage-collection latency.

`tools/tests/carblood-fit-slices.mjs` checks exact original attribute/layout/range
hashes for indexed, dense and transformed synthetic models and the production
packed M4. It also interleaves two fits through 6,097 expired-deadline suspensions
and measures bounded typed-element work for dense probes, grid fills, cover rays
and copies. The standalone `tools/carblood-fit-host-check.mjs` records source
hashes and 56 assertions. These host checks establish geometry and cooperative
work behaviour; native profiles establish practical frame-time effects.

## Weapon HUD artwork

`game-ui.js` caches the equipped weapon bitmap by canvas identity, dimensions,
selected weapon and source atlas identity/decode dimensions. Health/ammo refreshes
leave the bitmap intact. Armed vehicle HUDs retain their own `tankIcon` cache key;
the ordinary weapon art is restored exactly once on exit. Previously each refresh
deleted that key, forcing repeated cannon/Apache/mounted-gun drawing.

`tools/tests/weapon-art-cache.mjs` exercises all nine real icon writers, three
armed modes and invalidations with a recording Canvas2D context. Exact baseline
and candidate draw-command traces match; repeated refreshes do not rasterize.
