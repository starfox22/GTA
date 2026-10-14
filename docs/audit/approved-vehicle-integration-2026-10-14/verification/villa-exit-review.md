# Villa exit follow-up

The [original failure](garage-original-failure-candidate7.json) reproduces the
full-suite MIRAMAR result: the straight-line console pilot tries a three-point
turn beside the frontage wall and stops 28 world units from its approach point.
The selected car is S1 SUV228, 3.638m long and 1.86m wide; all approved envelopes
are smaller than the original SUV. This is a route-fixture correction, with no
change to vehicle physics, collision shapes, the map, or `steerTo`.

The named MIRAMAR fixture adds a short open-forecourt alignment at
`(sideGate.x, originalCar.y−12)`, using 15s and radius7, before its original
approach and street-exit goals. The initial north-facing car has room for this
short leg. Its 48-unit opening requires centering before the pilot turns near
the wall. Every other villa keeps its original route. The original approach
15s/radius14, exit 15s/radius22, beyond-gate distance, boarding and door-close
assertions remain unchanged. Simulation holds only after the first real-E input
and its existing 2s real wait, preserving that physical-key coverage.

The [complete candidate7 proof](villa-exit-final-candidate7.json) and
[log](villa-exit-final-candidate7.log) record **161 passing assertions** across
all 14 normal garage exits and all six forecourt side gates, with 41 driven
pilot legs, zero page errors/frame faults and a closed private browser.
The tracked test is byte-identical to the [proven source](garage-proven-test-source.mjs),
SHA-256 `611da15a8d484e7c434d4f1b87a8464394cd364109fcb1e21a23bbba52887d02`.
The receipt records the actual candidate7 HTML hash and original test hash.
Candidate8's subsequent trunk-render correction does not change this gameplay.

The focused Toscana/MIRAMAR proof is retained separately. Unsuccessful trial
waypoints remain under `garage-route-attempts/`: a near lateral turn, a forward
point on the house boundary, and applying the extra leg to other villas. These
are failed diagnostic routes, not waived assertions or passing results.
