# Aircraft audio

aircraft-audio.js is included by engine-audio.js. These fixed-wing voices share the
existing engine bus and do not change helicopter or road-engine synthesis.

- Fixed-wing engines (`aircraft-audio.js`, included by engine-audio.js) use explicit
  airframe profiles: `skyhawk` has four-stroke piston exhaust pulses and its two-blade
  propeller, `courier` has one turbine/four-blade propeller, `jet` and `airliner` have
  twin turbofan voices (the larger airliner's fan/whine is lower). The C172 is never a
  turbofan. Frequency and load follow `c.power` (actual spooled output), with `throttle`
  only as a fallback. Piston RPM is 700–2700; firing frequency is RPM × cylinders / 120,
  blade-passing frequency is RPM × blades / 60. There is no turbine hiss on the piston.
  Runway tyre rumble stops when airborne or with the gear retracted. Engine destruction,
  leaving a parked plane, pause and mute fade its output. No aircraft sound files ship.
- The fixed-wing pool reuses at most four voices (one aboard, three nearest running
  exterior aircraft within 2400 units); uncrewed parked planes remain silent. Each voice
  has four sources/15 nodes, sharing one noise buffer and cached pulse waves. Exterior
  distance includes elevation; relative velocity gives Doppler, `soundRight` supplies
  camera-relative pan, and `soundShade` supplies occlusion. All output uses `engineBus`,
  preserving the engine/master sliders and saved mute. `engineSound().aircraft` reports
  each airframe, family, engine count, actual power, RPM, firing/blade Hz, gain, hiss,
  distance, pan and Doppler. Reproduction/listening fixtures and limits are in
  [the October 15 audio audit](../audit/police-aviation-review-2026-10-15/audio.md).

`aircraftPropellerRpm(car)` is the pure, allocation-free RPM rule shared by the sound
plan and visual propeller animation; do not reintroduce a separate speed formula.
`animateAircraft` converts RPM to radians/second with π/30, retaining smooth spin-up
and coast-down. Blur uses actual blade passages (20–75 Hz), accounting for the C172's
two blades and courier's four. The separate turbofan animation keeps its prior scale.
`node tools/tests/aircraft-propeller-sync.mjs` executes the actual renderer function
on the host and checks audio/visual agreement plus running/stopped states.
