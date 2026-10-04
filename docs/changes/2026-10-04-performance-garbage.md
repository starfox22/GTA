# Less garbage, fewer collections
- The simulation makes 60% less garbage a frame (1.56 MB -> 0.64 MB on the tour), so the collector runs 2.5-4 times less
  often and long frames are about halved while driving, in a chase and after a blast; the simulation is unchanged
  (equal state hashes on a seeded replay).
- Every vehicle now shares one object layout (`makeCar` declares every field), traffic scans no longer allocate per car.
- Crossing into a new district, a notice, a new prompt and other HUD animations no longer force a page layout.
- The overlay canvas is left alone when nothing is drawn on it; skid marks no longer look up the ground every frame.
- Console: `allocBench`, `shapeReport`, `drawProfile().byLayer`; `dev.mjs start --seed N` (deterministic page),
  `hitches.mjs --hash` and `--counts`.
