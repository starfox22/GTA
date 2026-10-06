# Motion comfort: a farther, calmer driving camera

- The vehicle camera stands one zoom step further back (1.12 at rest, was 1.4), so the street slides past the
  screen more slowly; motorbikes, bicycles, buses and boats moved with it.
- The speed zoom swings through a smaller range (x1.4, was x1.75: the same width at top speed) and the boarding
  zoom-out is slower (at most ~30 % a second): a moving zoom is a strong motion-sickness cue.
- The look-ahead is shorter (a quarter of the half frame) and turns more slowly (~52°/s) at corners, so the view
  sways less: turn sway -20 %, braking -13 % in `cameraComfort()`.
- New Settings · Gameplay · Motion comfort: one fixed zoom in a vehicle at any speed, half the look-ahead turning
  slower, no camera shake or jolts, no lean toward the aim on foot, no flight-camera bank.
- New Settings · Driving · Vehicle camera distance (80-160 %).
- Console: `cameraView()` adds `motionComfort` and `vehicleDistance`; `settings()` takes `motionComfort` and
  `cameraDistance`.
