# Realistic parachute opening

- The canopy now opens like a sport ram-air main from 54 m/s: pilot chute 0.8 s, bag and lines to line stretch at 1.8 s (~95 m), a 1-2 s snivel, then the slider runs down; it flies 4.7 s and ~200 m after the pull, the opening shock building to a ~3.8 g peak instead of a bang. The freefall cue's forecast matches the height really lost.
- Once open it flies on its deployment brakes for a moment, then surges forward to trim and the jumper swings under it (the pendulum follows the rig's own speed changes; a flare now swings the jumper forward, not back).
- The opening is drawn stage by stage: lines whipping out of the bag, the canopy streaming out as a flogging, crumpled bundle held by a billowing slider, cells pressurising from the centre out, nose first, the end cells last, the lines drawing tight through the slider's grommets.
- Fixed: the canopy, lines and pack were invisible from the flight camera above ~450 m (the scenery detail pass filed them as small props).
- In cloud: the jump eases from the freefall look to the canopy's over the opening (no pop), the mist streams past at the fall's speed, the sun dims and the rig is lit by the cloud's own dull light, fading into the fog; it comes out of the base as the veil thins.
- Internals: parachute3d.js split into -canopy/-pose/-rigging; `p.brakesSet`, `p.flown`, `p.safeLost`/`safeTime`; console `parachuteView()`, and `parachuteState()` adds `altitudeM`, `safeLostM`, `safeTimeS`, `brakesSet`, `flownS`. New test tools/tests/parachute-cloud.mjs.
