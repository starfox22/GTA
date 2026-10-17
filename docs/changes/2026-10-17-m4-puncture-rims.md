# M4 punctures keep metal rims round

Gunfire punctured the HMMWV tyre by squashing its entire combined tyre/rim mesh
18%, turning the metal rim oval. M4 pressure now deforms only rubber outside the
wheel's spin. The metal and tyre bead retain exact source positions/normals, with
a smooth radial transition and analytic transformed rubber normals.

Each punctured wheel owns one complete geometry clone and reuses its buffers.
Repair, burn and retirement dispose the clone while preserving shared source
geometry. The wheel pivot, suspension, UVs, triangle ownership and other vehicle
puncture paths retain their existing contracts.

Validation: actual production world-space metal rings through forward/reverse
spin, steering, body bank/pitch and near/far LOD; finite-difference normal proof;
private attribute/index and disposal tests; 1,000 warm frames with all four tyres
flat, no new geometries or buffers. Detailed receipt:
[puncture rim proof](../audit/m4-wheel-shape-2026-10-17/puncture-rim-proof.json).
