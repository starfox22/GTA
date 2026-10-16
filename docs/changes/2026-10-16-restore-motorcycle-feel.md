# Restore the previous motorcycle turning and wheelie feel

- Restore the published controller's direct turn response, immediate yaw-based bank,
  earlier fork angle, 0.45 rad/s continuing wheelie lift and centre-of-mass coefficients.
  Holding rider-back can pass balance and loop out; feather throttle or rider weight to balance manually.
- Keep W/S acceleration/braking and separately remappable ↑/↓ rider weight, the stopped/
  reverse speed gate, airborne contact rules, distance meter/milestones, improved rider
  and fall animation, and published motorcycle models/audio.
- `motorcycle-previous-feel` compares 18 frozen full-controller traces from `3bae7a00`
  (turn, lift, release, coast, S and Space at 30/60/120 Hz). Updated wheelie checks cover
  continuing lift/loopout, manual 200 m feathering and the meter's real crash completion.
