# Street camera defaults: further back and further ahead

- Settings · Driving: Vehicle camera distance now defaults to 120 % and Camera look-ahead to 150 % (the overhead
  view sees more road ahead of a moving car); players who saved their own values keep them, and RESET DRIVING TO
  DEFAULTS restores the new defaults.
- Tests: camera-framing, camera-feel and camera-comfort calibrate at 100 % and restore the defaults
  (`settings({ drivingReset: true })`); camera-framing checks the new defaults.
- The lead's share of the frame grows with the look-ahead only up to 0.3 of the half height (`leadShareMax`,
  camera-drive.js), so at 150 % a fast bus heading up the screen never reaches the folded card strip and the prompt
  along the bottom (tools/tests/hud-clearance.mjs failed about one run in two at the new default); the extra lead shows
  at lower speeds.
