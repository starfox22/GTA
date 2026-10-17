# M4 wheel geometry and rolling proof

`host-shape-proof.json` records the unchanged source-pack hash, measured source
ellipse, four fitted transforms and independent actual world-space ring checks.
The source outer tread was about 1.2% narrower than tall; the largest correction
is only 1.229%. This is a mild geometric defect, distinct from camera projection
or legitimate puncture squash.

The production helper changes only moving tyre/rim/hub geometry once per shared
kit. It retains every source triangle and UV, transforms authored split normals
with the affine inverse transpose, and leaves the stationary body/running gear
at its exact source rest position. No new draw calls or per-frame geometry work.

Three host regressions passed 46,194 assertions:

- `m4-wheel-partition`: actual source ownership, fixed positions/normals, unchanged
  UVs, measured affine wheel fit, inverse-transpose normals and old axle-orbit fix.
- `m4-wheel-shape`: all six complete actual tyre/rim/hub bands per wheel through
  48 forward/reverse spin phases, three steering angles, both body LODs, body
  bank/pitch, production 0.65 design/group scale and real clean/flat/repair matrices.
- `military-model-rig`: actual packed builder, shared resources, lamps, brakes,
  forward/reverse/spin animation, body LOD and char/repair material contracts.

The worst corrected world-space ring radius spread is 0.153 mm. Deliberate 0.82
vertical puncture squash stays stationary while the wheel rolls; repair restores
scale 1 and the ordinary wheel matrix. Native final integrated game captures are
separate evidence owned by the parent review.

Run each exported default test on the host with an assertion harness, or use the
existing `tools/test.mjs` selectors. Runtime contracts and detailed adaptation:
[downloaded military vehicles](../../areas/vehicles-and-driving-models-military.md).
