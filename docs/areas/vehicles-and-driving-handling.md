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
  `drivingState`. Settings · Driving is saved as `dead-end-city-driving`. `brakeG` figures are the 1990s fleet's
  (sedan 0.9: 46 m from 100 km/h, 12 m from 50; trucks 0.6, the bus 0.52); the Prestige Collection and flagships keep
  their modern figures. The AI reads the same `spec.brake`.
- **Reverse** (physics-driving.js REVERSE GEAR): the brake key brakes to a standstill (`REVERSE_STOP` 1 km/h), reverse
  goes in after `REVERSE_ENGAGE` 0.25 s stopped (the brakes hold the car meanwhile, `tyres.reverseWait`), pulls
  `REVERSE_PULL` 0.5 of the traction (a sedan 0.3 g) and eases off toward `REVERSE_TOP` 25 km/h; the throttle while
  rolling backwards brakes first. Steering follows the travel (`sign(along)`). Measure with `reverseTest(type, kmh)`.
- **Tyre fall-off**: past the peak slip angle the sideways grip eases to `SIDE_SLIDE` 0.72 by 50 degrees
  (`tyreSideShare`, driving.js), and the rear's slide (`stability.hold`) never takes it under `STABILITY_HOLD_FLOOR`.
- **Drifts** (driving.js `yawStability`): wheelspin at the back swings the tail only up to
  `DRIFT_ANGLE` (+ `DRIFT_ANGLE_BALANCE` x balance, halved counter-steering), then holds it:
  floored through a bend a tail-happy car drifts instead of spinning, a counter-steer or a
  lift catches it. Lift-off with the lock held and a locked rear still spin. The handbrake
  swings the tail (`HANDBRAKE_SWING`; `HANDBRAKE_CORNER`, `HANDBRAKE_YAW_RESPONSE` in
  physics-driving.js): a 0.5 s flick at 55 km/h turns a sedan ~40 degrees, held ~1.5 s it
  makes a 180. The slide itself is friction (HANDBRAKE SLIDE, a car only): the locked rear's `HANDBRAKE_DECEL` 0.5 g
  against the travel in every direction plus the rolling fronts' sideways grip (`handbrakeSide`, Coulomb, so it stops
  dead: no creeping glide); straight on, a sedan slows at ~0.6 g with a slight wander (`HANDBRAKE_WANDER`); a 50 km/h
  handbrake turn stops in ~13 m. Motorbikes, bicycles and the tank keep the old 0.45 g drag. Slide maths reads the speed along the path (`hypot(along, lateral)`), and the yaw
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

## Two-wheeler pitch and wheelie controls

`wheelieStep` keeps the engine's available force and the bike/rider centre-of-mass torque
authoritative. Settings · Controls exposes separate **Wheelie / lean back** and
**Wheelie / lean forward** actions: ↑ / ↓ by default, independent of W / S throttle/brake.
The body shift fades in between 3 and 8 km/h, so stationary or reversing arrow presses
cannot move the rider or accelerate the bike. Forward weight shift keeps the throttle
available; S or Space uses the real rear brake while the front is up.

Holding rider-back with drive asks the rider to feather the available engine force toward
a sustainable 29° sport-bike wheelie. This balance assistance cannot add power, lift on a
coast or start a clutch/body pop while airborne or sharply banked. It permits long distance
wheelies without an inevitable timed loopout. Passing the actual balance/tail limit still
throws the rider. Releasing the shift settles gently; leaning forward lowers more quickly.

Ridden motorcycles have a substepped, critically damped roll response (`motorcycleBalanceStep`).
Requested lateral acceleration produces the gravity-balanced bank; at speed that bank
controls yaw, with direct steering blended back below 18 km/h. The body and steering follow
the same roll state (`bikeRoll`, `bikeRollRate`), including a small transient fork countersteer.
Traffic handling is unchanged. The rider adds bounded torso/pelvis hangoff and looks through
the corner while the source grips and pegs remain fixed IK targets.

With the front up, rear braking is capped at 0.55 g, multiplied by the tyre surface and
rain grip and the longitudinal share left by cornering. It cannot add positive drive
torque. `wheelieFrontContact` smoothly unloads the front over the first ~5 cm of lift.
Brake load/bias, ABS/slip/lock and remaining lateral grip use that contact; a fully raised
front has no road force or locked-front lowside. Stability and tyre squeal follow the
contacting tyres. Skid marks, spray, ford water, dust/mud and tracks also fade out at
the front, with emission debt and track anchors cleared before the wheel touches down.
Pitch and the fork spring substep at 240 Hz; mass shift uses an exponential response.
The fork bump stop dissipates excess landing speed rather than injecting a bounce from
an angle that was clipped while keeping its inward velocity. The per-type geometry,
power limit, bank restriction on a clutch pop, reduced steering and real loopout remain.

The renderer pitches the chassis about the actual rear axle's body-space centre, using
the downloaded model's fixed carrier transform (including a puncture's local offset).
This keeps the round rear tyre at its authored floor height; the previous ground-level
pivot dropped its centre by `radius * (1 - cos(pitch))`. Riders use the same resulting
body matrix for the seat, bars and pegs. The correction uses the actual bank, base pitch
and pending terrain angles; the bicycle and scaled bike-share frame use the same rule.

`wheelie-dynamics` tests the actual control/torque kernels, independent rider input, stationary gating, sustained balance, grip budgets,
30/60/120 Hz agreement and landing recovery. `wheelie` presses real W + ↑, W + ↓ and
W + Space, plus stopped/coasting Up alone. `wheelie-tyre-contact` checks airborne and partial front effects.
`motorcycle-wheel-rig` and `approved-motorcycle-rigs` hold the actual rear axle still
through 0.2/0.6/1.1 rad pitches, while the rider-fit tests retain seat/hand/foot contacts.

`wheelie-score.js` measures each player's actual fixed-step displacement after integration,
in world units / 8. A clear front lift must last 80 ms; 120 ms of touchdown ends the
run, with no ground distance counted during that grace period. Stops, damage, throws,
exits and position discontinuities end it. A single bounded vehicle reference is released
on completion/reset; no history grows. The HUD celebrates `GREAT!` beyond 100 m and
`Amazing!` beyond 200 m, then holds the final result for four gameplay seconds. Pause
holds its clocks. Its measured box participates in player clearance and HUD overlap
reports. `wheelieScore()` exposes read-only evidence; `wheelie-score` tests the shipped
scorer/HUD at 0/99/101/201 m, touchdown, stationary balance, pause, crashes and relocation.
