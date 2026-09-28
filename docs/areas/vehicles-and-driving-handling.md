# Vehicles and driving: handling

Steering, the tyres, brakes and assists, drifts and the handbrake (physics-driving.js,
driving.js). Specs, crashes, aircraft and models: vehicles-and-driving.md.

## Handling (physics-driving.js, driving.js)

- Steering reaches full lock by 30 km/h (`STEER_FULL_SPEED`); above that
  `corneringLimit(spec, v)` caps yaw rate at `cornerG * GRAVITY / v` for player, traffic and
  pursuit alike (a city corner is 30-40 km/h). Tyre side force peaks at `TYRE_PEAK_SLIP`
  (7°); `PLAYER_YAW_RESPONSE` 8.5/s; UNDERSTEER SKID above 28 km/h. Measure with
  `turnTest(type, kmh)`.
- Loose ground (`tyreSurfaceGrip`, the player's vehicle): road tyres keep 0.7 of their grip
  on the beach's sand and 0.82 on park lawns (off-roaders 0.88 / 0.94); the county's dirt is
  offroad.js's.
- One grip budget (friction circle): braking hard in a bend ploughs wide. Rain (`wetGrip()`,
  down to 0.72 soaked) scales traction, brakes and cornering. `kerbStrike` jolts on kerbs.
- **Brakes and assists** (driving.js, player's road vehicle only): a pedal ramp, front/rear
  bias by class (`DRIVING_CHARACTER`), per-axle slip with a peak at 12% then a sliding value;
  ABS cycles at 10-15 Hz and keeps the car steerable; TCS trims throttle; ESC (`yawStability`)
  damps `yawSlide`. `spec.brakeG` stays the mean ABS stop (what road tests print; the tyres'
  peak is brakeG / 0.93, `ABS_EFFICIENCY`). Fitment: cars all three, motorbikes ABS (some
  TCS), classics none; `spec.abs` / `esc` / `tcs` override. `c.braking` and
  `drivingAssistStates` feed the HUD lamps. Tests: `brakeTest`, `liftOffTest`, `accelTest`,
  `drivingState`. Settings · Driving is saved as `dead-end-city-driving`.
- **Drifts** (driving.js `yawStability`): wheelspin at the back swings the tail only up to
  `DRIFT_ANGLE` (+ `DRIFT_ANGLE_BALANCE` x balance, halved counter-steering), then holds it:
  floored through a bend a tail-happy car drifts instead of spinning, a counter-steer or a
  lift catches it. Lift-off with the lock held and a locked rear still spin. The handbrake
  swings the tail (`HANDBRAKE_SWING`; `HANDBRAKE_CORNER`, `HANDBRAKE_YAW_RESPONSE` in
  physics-driving.js): a 0.5 s flick at 55 km/h turns a sedan ~40 degrees, held ~1.5 s it
  makes a 180. Slide maths reads the speed along the path (`hypot(along, lateral)`), and the yaw
  cap takes it past ~37 degrees of slip (a nose-on speed there let a slide spin itself up;
  below that the trail pilot's crabbing needs the nose-on one: falls.mjs drive-trail). Measure with `driftTest`
  (tools/tests/drift-handling.mjs).
- **Tyre effects** (tyre-effects.js, game logic; tyresmoke3d.js, offroad3d-mud.js and the
  skid strips in render3d-frame.js only draw it): `tyreEmission(c)` is the one rule for what
  tyres throw up. Smoke comes only from a BURNOUT (forward + handbrake below 10 km/h in a car:
  `burnoutStep` holds the car at 0.9 g while the driven axle spins, `c.burnout.heat` builds
  over 2.5 s and thickens the smoke, cools over 1.4 s after; letting go launches on spinning
  tyres). Tarmac slides past ~15 degrees, the handbrake's rears, wheels locked without ABS, a
  long understeer scrub (faint fronts) and wheelspin lay marks (`layTyreMarks`: `dark` 0..1,
  `w`, 40 s, fading) on hard ground only, never smoke. Sand, lawns and dry dirt give dust
  (`tyreDustRate`: speed and spin, x1.6 for a 4x4, none when wet); soaked tarmac gives spray.
  Measure with `tyreEffects(reset)` (tools/tests/tyre-effects.mjs).
- Traffic in the rain drives inside `wetGrip()`, slower; one driver in eleven keeps dry habits
  (the odd rear-ender). `aiDriving()` counts crashes and slides.
