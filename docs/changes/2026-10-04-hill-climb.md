# Mount Ascent hill climb: real suspension, a new trail

- 4x4s (and every road vehicle) on the mountain now ride four tyres on springs and dampers:
  the body pitches, rolls and squats with the ground under each wheel, the load shifts to the
  downhill wheels, the club trucks' axles articulate over rocks and hang in the air, and a truck
  only leaves the ground where the ground really falls away (a crest taken fast), landing on its
  springs. No more random bounces into the air, no launches off the top of a bank, no flips on
  the trail.
- A new Mount Ascent trail (512 m): a forest two-track past THE BOG, a CREEK CROSSING ford, an
  off-camber TRAVERSE, keyhole switchbacks (one muddy), the ROCK GARDEN, a steep SLICKROCK pitch
  and a run along the SUMMIT RIDGE. Every crest and dip is a rounded vertical curve. Four
  checkpoints; the club challenge is now 1:15 (records keep their key).
- Root cause of the launches: the body followed the ground under its middle exactly, so a crest
  graded in one 12-unit step (or a steep cut bank) became a vertical speed it kept in the air;
  rough ground also started random hops.
- Internals: terrain-suspension.js (`rideStep`, `rideModel`, `rideTyreGround`, `rideRelief`);
  offroadDrive/offroadPaved take grip and the slope's push from the ride; trail grading gains
  `ford`, `camber`, `steep`, `summitLift` and vertical-curve smoothing; `settleIsTrivial` checks
  `rideActive`. Console `ride3d()`, `trailDrive(seconds, maxKmh, trail, frame, direction)` with
  ride telemetry, `hillClimb('top')`; test tools/tests/hillclimb-physics.mjs.
