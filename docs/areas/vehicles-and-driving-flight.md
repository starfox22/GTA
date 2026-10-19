# Fixed-wing flight

`aviation-flight.js` owns `AIRFRAME_SPECS`, `FLIGHT`, setup, gear/flaps and `planeControl`.
Aircraft use the game's physical scale (8 units/m). Their existing mass, dimensions, thrust,
spool, airframe profile and collision contracts are retained. This is assisted game flight,
with pitch/roll springs and released-stick trim, not a full six-degree simulator.

## Energy, turns and stalls

Lift acts perpendicular to the flight path; drag removes energy and thrust adds it. A
released stick at low power eases toward a safe angle of attack as speed falls, allowing a
steady descending glide instead of repeatedly pitching into stalls. Deliberate back
pressure still overrides the assistance and can stall. Powered takeoff/climb trim remains.

Turn rate comes from the actual banked lift and airspeed; there is no extra 32–60% yaw
multiplier. The model follows its velocity/slip rather than instantly rotating the velocity.
The normal load required by bank and flight-path angle adjusts the indicated stall-speed
caution, using total airspeed. Actual stall entry depends on critical angle of attack;
recovery uses a small hysteresis band. A fast steep dive is not called stalled merely
because horizontal speed is small. `planeControl` ignores nonpositive/NaN elapsed steps.

`flightData()` feeds the HUD and `flight()` console: airspeed, altitude/AGL, vertical speed,
heading, pitch/bank, throttle/spooled power, flaps/gear, load and stall warnings. Existing
bindings and aircraft sounds remain tied to those real states.

## Runway and verification contracts

Runways/taxiways/stands share the [airport plan](world-county-and-sea-airports.md). The
existing 60/120 Hz host takeoff checks remain: roughly 325 m Skylark, 286 m courier,
619 m jet and 1,056 m airliner ground rolls at 60 Hz. Normal full-world taxi/takeoff tests
include spin-up and climb clearance; their distances differ from this isolated ground roll.
All seven host taxi routes retain their bounds, with no stationary nosewheel pivot.

`aircraft-flight-model.mjs` checks existing ground/flight envelopes and routes.
`aircraft-flight-dynamics.mjs` checks all four airframes at 30/60/120 Hz: a 120 s idle glide
settles without repeated stalls and loses energy, steady turns follow bank/lift, loading
warnings are distinct from separated flow, fast dives are not false stalls, and deliberate
stall/recovery remains controllable. The browser/native flight review is separate from
these numeric host fixtures; software-GL wall times are not hardware FPS measurements.
