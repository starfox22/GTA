# Parachutes and reserves

`parachute.js` owns flight and impact behavior; `parachute3d*.js` reads it for the rig and body.
An aircraft bailout with 60 m clearance starts a rig containing one main and one reserve.
Normal cliff jumps remain physical falls; no parachute is invented on every jump.

## Fresh presses and rig supply

The remappable `bail` action defaults to J. In freefall a fresh press opens the main. Once
its phase is `open`, release and press again to cut it away. The next released/fresh press
pulls the reserve. Holding the action, OS repeat, or presses during opening cannot chain
these steps. The reserve cannot be cut or replenished while airborne. Touch and gamepad
use the same action and latch; key hints/settings explain CUT AWAY / OPEN RESERVE.

A cutaway preserves position, heading and every velocity component; normal gravity/body
drag resume. The rig records `mainUsed`, `reserveUsed`, `canopy` and a `cutaway` event.
The next aircraft bailout supplies a fresh rig; touchdown removes the airborne state.
Existing roof, ship, water, injury and reset paths remain shared.

## Deployment and forecast

The existing main deployment model is retained. A pull is not an open canopy: the
DEPLOYMENT stages of a sport ram-air main from 54 m/s belly freefall: pilot 0.8 s (throw,
pin, bag lift), lines 1 s (line stretch 1.8 s / ~95 m after the pull, ~50 m of it paying
out), snivel 1.1-2 s by pull speed (the slider holds it, cells fill centre out), snap 0.9 s
(slider down, end cells last). Pulled at terminal it flies 4.7 s / ~200 m later at ~7 m/s,
the load easing to a 3.8 g peak (`PARACHUTE_OPEN_SHOCK` is a soft tanh cap, not a clip);
pulled at 30 m/s 4.3 s / 138 m, from a hover 3.8 s / ~57 m (a 75 m hop with an instant pull
just makes it). `parachuteForecast()` steps the same model at 30 Hz and is the cue's
"need" (to 7 m/s); `p.safeLost` records the same point in flight and the test holds them
equal: change the model there and the cue follows. Flying, the canopy is on its
deployment brakes (`p.brakesSet`, 15 km/h) for `PARACHUTE_BRAKES_SET` 1.4 s (or until the
first steer or flare), then surges to trim. Cue: OPEN SOON at need + 4 s of fall, OPEN NOW
at need + 1.5 s (a pull then still lands safe), TOO LOW under need + 2 m; after the pull it
shows the stage and the height the rest needs. Until `phase` is 'open' the jumper steers
as in freefall and a roof is an impact. The renderer (parachute3d*.js) reads
`phase`/`phaseK`/`opening`/`load`/`brakesSet`/`flown` and the velocity (its pendulum is
driven by the rig's forward acceleration); the camera jolt is `shake`, set by parachute.js.
Every rig object is `userData.dynamic`: without it the detail pass hid the canopy from
the flight camera high up. Console `parachuteView()` reports the rig as drawn.

The spring-pilot reserve uses pilot 0.32 s, lines 0.48 s, snivel 0.55–0.85 s and snap
0.7 s. It still loses height through staged extraction/inflation and can be pulled too
low. `parachuteForecast(..., reserve)` uses the same physical model as descent; the cue
switches to the reserve's remaining requirement after cutaway. At roughly 22.2 m/s it
opens in 2.17 s, needing about 54 m to slow safely in the host fixture (30/60/120 Hz).

## Appearance and verification

The main is the existing colored sport wing. The reserve has white/teal panels, a left
chest-handle pull and a spring pilot from the container. Cutaway unloads the hanging body
through a sprung return to the freefall arch. One frozen main-mesh copy drifts, deflates
and fades over at most ten game seconds; its geometry/materials are independent of the
live reserve and disposed on expiry/world reset/new rig.

`parachuteState()` reports supply and stage; `parachuteView()` reports the drawn rig and
`cutawayVisible`. `parachute-reserve.mjs` tests fresh presses, exact cutaway conservation,
remapping, reserve staging/forecast, exhausted reserve, late fatal pull and landing/reset.
The independent physical-key and native evidence lives in the airport/flight review.
