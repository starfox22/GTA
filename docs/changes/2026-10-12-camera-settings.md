# Street camera: walking view in slow vehicles, longer look-ahead, walking distance

- Below 30 km/h a car, bike or boat keeps the walking camera; it eases out to the vehicle camera only from 31 km/h
  and comes back in after a second under 30 km/h (no pumping at a junction). Boarding at rest no longer zooms out.
  A carjack no longer zooms in on the struggle (and so no longer zooms back out once seated). With Motion comfort
  on, a vehicle keeps its one fixed zoom as before.
- Look-ahead 0 % keeps the vehicle in the middle of the screen whichever way it turns (the follow's feed-forward axis
  stayed on the boarding heading, so after a turn the car slid toward the edge it was driving at); higher settings move
  it back from the middle against the way it drives.
- Settings · Driving · Camera look-ahead now reaches 300 % and defaults to 200 %; the higher settings really lead
  further (at 100 km/h: 100 % 10.8 m, 150 % 16.2 m, 200 % 21.6 m, 300 % 27.9 m; the old 150 % stopped at ~13 m),
  stopping where the vehicle's far end would reach the HUD. A saved 150 % (the old default) loads as 200 %.
- New Settings · Driving · Walking camera distance (60-160 %, default 100 % = the view as before): on foot and in a
  vehicle below 30 km/h.
- Internals: world-view.js SLOW FRAMING (`slowFramingOn`, `vehicleContextZoom`), driving.js `walkCameraFactor`,
  `applySavedDrivingSettings` (record `version` 2), camera-drive.js `leadShareTop`; the on-foot and helicopter leads
  read the look-ahead only up to 150 %. Console `settings({ walkDistance })`; `cameraView()` adds `slowFraming`,
  `vehicleContext`, `walkDistance`. Tests: camera-slow-framing, camera-lead-setting, driving-settings-migrate.
- The chase view keeps the walking camera distance in a vehicle under 31 km/h too (getting in no longer pulls the camera back from 3.5 to 6.8 m); it eases out at speed and back after a second under 30. Motion comfort keeps the walking zoom at rest as well.
