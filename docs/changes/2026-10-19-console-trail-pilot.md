# Console trail route following

- Reworked only the console `trailDrive` ascent pilot: segment projection, interpolated physical
  look-ahead, smoothed curvature and early braking keep its target on the graded hairpins.
- Preserved terrain, vehicle handling, suspension, geometry, the 75 s challenge, every existing
  safety assertion, and the original descent controller. Ordinary player and traffic driving
  never calls this helper.
- Added production-host coverage for fresh/reused 30/60 Hz ascent routes, descent-35 and unchanged
  cliff/road controls. Complete-game acceptance is tracked in the general review's trail audit.
