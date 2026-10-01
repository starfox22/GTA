# Simulation efficiency: no more minimap stalls
- Driving no longer stalls for 50-180 ms when a station, garage or helipad slides into the minimap: map overlays draw only what is in the window, with fixed-size labels (a font string per frame was a font lookup per frame) and the fonts warmed at boot.
- Gunfire at the player no longer forces a full HUD layout on every hit (the red arc restarts by switching animation names).
- The simulation spends less CPU and makes less garbage: parked cars cost less per physics step, the boat hull test, traffic AI, contact shapes, the vehicle broadphase and the crowd grid no longer allocate per call, `vehicleSpec` is four times quicker; the car radio's volume is written only when it audibly moves.
- Same game: every change keeps the answers identical (checked on 240,000 random boat hulls against the old code).
- Internals: `mapWindowHas()` / `mapLabel()` (game-minimap.js), counted lists (`list.n`, `broadphasePairCount`) instead of `length = 0`, optional vehicle fields declared in `makeCar`, `f:pre` frame part in `stats()`.
- Console and tools: `simProfile(seconds, keys, top)` (per-section ms, worst frames, heap); `node tools/dev.mjs call <method> --cpu | --profile N [--who bursts|<function>] | --alloc N` and `DEC_JS_FLAGS` for CPU time, function profiles, the longest single calls and allocators (docs/areas/testing-and-console.md).
- New test `sim-efficiency`.
