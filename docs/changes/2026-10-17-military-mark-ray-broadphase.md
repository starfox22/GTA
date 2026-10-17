# Fort Sentinel gunfire: exact military-body ray broadphase

Boarding the motor-pool M4 raises the base alarm and five stars. Garrison rounds
then create holes on the downloaded body. Each hole's anchoring and 16-point
support checks previously asked Three to test the entire body repeatedly; later
damage versions retried missing anchors and checked existing holes again.

The immutable military bodies now share a cached triangle BVH with conservative
per-triangle bounds. A private CPU-only index submits only ray-segment candidates
to the original Three r160 intersection routine, then restores original source
face indices and hit order. The drawn geometry, normals, UVs, materials, holes,
support checks, alarm, combat and simulation timing are unchanged. Mutable or
unsupported geometry falls back to the complete routine. Model/title prewarm
builds the cache; repeated vehicles reuse it, and source disposal releases it.

The actual packed M4 production-host probe reduces a repeated 12-hole support pass
from millions of triangle tests to roughly one thousand; cached frames still cast
no rays. `tools/m4-marks-bench.mjs` retains reproducible CPU/work/build/memory
receipts with source hashes, including vanilla `--baseline` and alternate
`--source` checkouts. The `military-mark-rays` regression compares exact full-mesh
intersections and actual mark anchors, transforms and ring results on the M4/M35,
with near/far boundaries, material sidedness, missing marks and lifecycle fallbacks.
See vehicles-and-driving-models-military.md for the immutable-source contract.
