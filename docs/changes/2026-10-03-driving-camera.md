# A comfortable driving camera
- Getting into a car frames the street one zoom step wider (1.4 instead of 1.75; motorbikes, bicycles, buses,
  trucks and boats moved out by the same step), and the view keeps widening with speed: 1.31 at 50 km/h, 1.08
  at 100, 0.92 at 150, 0.80 at 200. It reads a smoothed speed, eases out in about two seconds and back in more
  slowly, and never overshoots, so braking, bumps and wheelspin no longer pump the zoom.
- The view no longer sways with the steering: the look-ahead follows the smoothed way the car goes and turns
  gently, a reversal shrinks it before it turns, and the follow is a critically damped spring, firm along the
  road and soft across it, so in a slalom the car weaves on screen instead of the whole street. The car sits
  centre-low with more road ahead.
- Rough ground, trails and crests no longer bob the whole view (the camera's height is smoothed); crash and
  blast jolts at the wheel are shorter and gentler (kicks 0.7 as far with no bounce, the tremor 0.45).
- Measured on the same drives (screen heights): slalom view acceleration rms 0.26 -> 0.07, jerk rms 1.5 -> 0.16;
  hard braking jerk rms 0.49 -> 0.28, zoom rate peak 12.4 -> 7.9 %/s; rough county ground acceleration rms
  1.5 -> 0.17, jerk peak 145 -> 1.5; a blast's jolt in a car 0.0125 -> 0.0045.
- Internals: camera-drive.js (DRIVING FOLLOW, `cameraSpring`, smoothed height `streetCameraAltitude`, eased
  speed), camera-comfort.js (the comfort log); the framing eases in the simulation (`updateCameraFraming`).
- Console: `cameraComfort(seconds)`; `cameraView()` adds `comfort`, `framed`, `kmh`; `cameraFeel()` adds the
  driving follow's state. Test: tools/tests/camera-comfort.mjs.
