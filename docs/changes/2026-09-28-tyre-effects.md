# Tyre smoke only from burnouts; realistic skid marks and dust
- No more tyre smoke from cornering, drifting, handbrake turns or hard braking on tarmac (nor
  from traffic and police slides): they leave skid marks and tyre noise only.
- Burnouts: hold forward and the handbrake at a standstill. The driven wheels spin in place
  (rear-, front- or all-wheel drive), the brakes hold the car, smoke builds the longer they
  spin, drifts off on the wind and thins out, and a black patch is left under the tyres; let
  go of the handbrake to launch.
- Skid marks appear only when the tyres really slide (past ~15 degrees, locked wheels without
  ABS, the handbrake, a long understeer scrub, wheelspin), as tyre-wide strips as dark as the
  slide was, fading out; none on grass, sand or dirt.
- Dust from dry dirt, sand and lawns by speed and wheelspin, more from a 4x4, none when wet;
  road spray in the rain as before. Spinning driven wheels are drawn turning.
- Internals: tyre-effects.js (`burnoutStep`, `layTyreMarks`, `tyreEmission`, `tyreDustRate`)
  is the rule the renderers draw. Console `tyreEffects(reset)`; test tyre-effects.
