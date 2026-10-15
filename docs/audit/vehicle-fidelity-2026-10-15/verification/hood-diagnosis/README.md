# Native hood repair diagnosis

The FINAL4 lifecycle images contain an independent airborne hood debris panel.
They are damage/recovery evidence, not clean beauty captures. The fixture burns
the C8, detaching its hood (`parts.hood=2`), then repairs it and advances several
stages with `hitchRun(..., draw=false)`. Those stages advance the game clock but
skip `updateDamageVisuals` and its debris physics. The thrown red cuboid and glass
particles therefore remain airborne across the staged repaired captures.

The actual native hood repairs correctly: both sprung (1) and detached (2)
states return to visible, zero hinge rotation and exactly their pristine source
geometry/world transform. Only state 2 creates a separate panel. Advancing time
alone leaves that panel stationary; calling the real `stepDebris` moves and spins
it. No production fix or canonical test change was made.

`receipt.json` preserves the executed host result: **870 assertions passed**,
including all 856 assertions in the then-current canonical SUV rig test and 14
diagnostic assertions. The fixture calls the production C8 builder,
`carBodyDamage`, `freshDamage`, `repairVehicle`, `spawnPanel` and `stepDebris`.
Unrelated rendering dependencies and flat terrain are host fixtures. This is
not a replacement for the separately recorded actual WebGL lifecycle review.

`initial-fixture-missing-material.json` retains the first unsuccessful attempt:
the host fixture lacked `darkMetal` for the newly exercised engine branch. The
diagnostic adds a material and cylinder geometry; no assertions were weakened.

From the repository root, with Python 3, Node and the standard `patch` utility:

```sh
python3 docs/audit/vehicle-fidelity-2026-10-15/verification/hood-diagnosis/replay.py --verify-only
python3 docs/audit/vehicle-fidelity-2026-10-15/verification/hood-diagnosis/replay.py
```

The script validates archived evidence and production source hashes, applies
`diagnostic.patch` to a temporary copy under `dist/`, reconstructs the exact
executed fixture, runs it and removes the copy. It writes the replay result to
`dist/hood-diagnosis-replay.json`; archived receipts remain unchanged. No browser
is launched. If source hashes change, review the differences before updating
this historical diagnostic.

`hashes.json` identifies the canonical test, diagnostic, production functions,
FINAL4 HTML/recorder/runtime receipt and five original lifecycle PNGs. The
original captures were recorded under `dist/review15-final4-runtime-corrected/`;
their hashes distinguish these qualified damage captures from clean comparisons.
