# Console: vehicles

`addConsoleMethods('vehicles', …)` in `src/game-console-vehicles.js`. Vehicles and driving: spawn, board, place, steer, telemetry, repair and respray, off-road trails. It also registers the feature consoles below.

| Method | Purpose |
| --- | --- |
| `placeVehicle(x, y, heading, altitudeMeters)` | Move the player's vehicle (stopped, aircraft at an altitude) |
| `bike(heading)` | Rack a bicycle beside the player |
| `ride()` | Current vehicle telemetry (speed, pedal cadence and effort; in a tank the hull, turret and aim headings in degrees, the traverse rate and the ammunition) |
| `repair()` | Mend the player's vehicle as a repair bay would (repeatable physics tests); returns `damageReport()` |
| `vehicleHealth(percent)` | Bring the player's vehicle down to `percent` of its health through `damageVehicle` (never up); returns `hp`, `maxhp`, `percent`, `burning`, `mission` |
| `drive(type, altitudeMeters, heading, airframe)` | Spawn any vehicle type beside the player and board it; aircraft can start airborne (a plane then cruises gear up at 75% power); boats go on the nearest open water; optional heading in radians (0 = east); a plane takes an airframe (`'courier'` default, `'jet'`, `'airliner'`) |
| `offroad()` | The 4x4 club and the trails: the lot, its pad height and clearances from the roads and trails, each club truck (dimensions, mass, performance, tyres, drive, parked), the members and what they say, the player's traction state (speed, wheel speed, wheelspin, low range, mud, rock, grade, body mud), the running climb, the challenge, the last result, best times, the courses, `effects` (mud clumps, mist, splats and tracks in use) |
| `clubLineup(x, y)` | Park one of every club truck side by side facing the camera |
| `hillClimb(action, trail)` | `'arm'` the challenge, `'reset'`, `'clear'` the best times, `'gate'` or `'cp0'`..`'cp3'` puts the player's vehicle there facing up the trail, `'top'` just below the summit facing down, `'at0.42'` at that fraction of the trail; returns `offroad()` |
| `trailDrive(seconds, maxKmh, trail, frame, direction)` | Drive the player's vehicle up a trail (`direction` `'down'`: down it) through the real physics with frames of `frame` s (1/30 default; a line-following pilot, crawling rock, three-point turns at hairpins); reports how far it got, the time, mean wheelspin, slide-back, why it stopped, `cliffFlights` and `ride` (time with every wheel off the ground, the highest wheel gap and where, body lift and vertical speeds, bump-stop blows, flights) |
| `rideBenchmark(n)` | What the terrain ride costs: µs per `rideStep` of the player's vehicle where it stands (`n` steps), how many vehicles are on the terrain and how many rides are still working (the rest are settled and skipped) |
| `ride3d()` | The player's vehicle on its springs (terrain-suspension.js): lift, pitch, roll, load (g), each wheel's travel and load, the model (frequency, sag, travel, tyre, wheelbase, track) |
| `trailProfile(trail, step)` | A trail's graded path: `[sample, x, y, height, grade, mud, rock]` every `step` samples |
| `mud(amount, wet)` | Set the mud on the player's vehicle (0..1) and how fresh (wet) it is |
| `steerTo(x, y, seconds, radius, passThrough)` | Drive the current road vehicle or boat toward a point through the real physics (straight-line pilot, backs off walls); `passThrough` counts the point at speed |
| `followRoute(x, y, seconds, maxKmh)` | Drive the player's road vehicle along the GPS road route to `(x, y)` through the real physics (steering keys, slower into turns and the end, backs off when wedged, re-plans when shoved off); returns `reason` ('arrived', 'time', 'left vehicle', 'no route'), position, speed, hp, distance left, `replans`, `backoffs`, `wanted` |
| `garage()` | The respray garages (garages.js): each shop (name, tagline, island, style, door and how open, bay in metres, lift spot, apron point, mechanics on duty), `islands` (every island's shops, GARAGE_ISLANDS), the plan, the price list, cash, the offer and prompt for the player's vehicle (class, damage share, respray / repair / bundle), the drive-in job (phase, whether the police saw it go in) and the last service or refusal (charged, cash before / after, colours, stars before / after) |
| `showcase()` | The flagships and KR 500s in the world: id, type, position, district, the SHOWCASE PARKING place they stand at, and whether traffic is driving them |
| `flight()` | The player's aircraft instruments as the flight HUD shows them: airspeed km/h, altitude and AGL m, vertical speed m/s, heading, pitch, bank, throttle lever and spooled power, flaps, gear, g, angle of attack, stall speed, stall / gear warnings, buffet, whether the HUD is up and whether its instruments are on (`instruments`, the Flight HUD setting), and on the ground on a runway `runway` (name, designation this way, metres left) (`null` outside an aircraft). Flaps and gear are keydown actions: press X / Z / L through the page keyboard |
| `launch(metersPerSecond)` | Set the current vehicle moving along its heading, e.g. to ram a roadblock |
| `drivingState()` | The player's road vehicle through the tyre model (driving.js): the assists fitted and switched on, the HUD lamps (`na`, `off`, `ready`, `active`), the character (front weight, CG height over wheelbase, brake bias, drive, lift-off), the pedal and steering ramps, each axle's slip, lock, ABS pressure and sideways share, the wheelspin, the stability yaw and the tyre noise level |
| `tyreEffects(reset)` | The player's tyres (tyre-effects.js): `burnout` (active, heat 0..1, seconds, driven axle), `emitting` now (kind `smoke`/`sand`/`lawn`/`dust`/`offroad`/`spray`, puffs a second per wheel, axle), `ground`, `wheelSpin`, and `totals` since the last `reset` (true zeroes them first): smoke, dust and spray puffs (before the graphics tier's share), skid marks laid, metres driven, burnout seconds and its top km/h |
| `speedBox()` | The speed box as shown: mode, label, figure and unit line (hud.js SPEED BOX) |

## damage (`damageConsole() in src/damage.js`)

| Method | Purpose |
| --- | --- |
| `crashSounds()` | The last crash sounds chosen (crash-audio.js): sample, set, gain, rate, layers |
| `crashTest(type, targetType, side, metersPerSecond, seconds)` | Drive a fresh car east into a parked one turned to show `side` (`front`, `rear`, `left`, `right`), throttle held; returns both damage reports |
| `park(type, dx, dy, heading)`, `vehicleAt(x, y)` | Park an empty vehicle beside the player (returns its id); find the nearest vehicle (id, type, x, y, heading `a`, altitude) |
| `vehicleById(id)` | One vehicle by id, or null once it is gone: type, x, y, heading `a`, `kmh`, `ai`, `occupied`, altitude |
| `shootAt(x, y, weaponIndex)` | Fire one round (or one shotgun load) from the player at a map point |
| `blast(x, y, power)` | Detonate at a map point (1 = a rocket) |
| `damageReport(id)` | Dents, zones, panels, glass, lamps, tyres, marks, handling and fire of a vehicle (default: the player's) |
| `streetProps(x, y, radius)`, `shopWindows(x, y, radius)` | Knockable furniture and trees near a point, nearest first (id, kind, box, `breakKJ`, strain, size, down) plus counts by kind; shop panes and their state |
| `damageStats()` | Decal and debris pool use and GPU geometry/texture counts (for leak checks) |

## handling (`handlingConsole() in src/physics-console.js`)

| Method | Purpose |
| --- | --- |
| `accelTest(type)` | Flat out in a fresh `type` on the strip by the Oceanview runway, dry: the measured 0-100 and 0-200 km/h times from a standstill and the top speed from a rolling start at 90% of the spec's, against the spec (`topKmh`, `zeroTo`, mass, length) |
| `turnTest(type, kmh, options)` | Steer a fresh vehicle on the strip by the Oceanview runway through the real step and measure: radius (m, fitted over 20-110 degrees of the turn) and kerb-to-kerb circle, lateral g, the run to 90 degrees from a straight entry (forward / sideways m, seconds), heading turned, end speed, slip, whether anything was touched. Options: `dir` (1 right, -1 left), `seconds`, `mode` (`cruise` holds the speed on and off the throttle, `coast`, `throttle`, `brake`, `handbrake`), `wet` (0..1), `entry` (seconds straight first), `trace` (samples) |
| `brakeTest(type, kmh, options)` | Brake a fresh `type` from `kmh` to a stop on the strip by the Oceanview runway, S held (through the pedal ramp, the tyre model and the assists as Settings · Driving has them): distance (m), seconds, mean g, how far it went forward and sideways and turned while stopping, the peak body slip, how long ABS worked and its cycle rate (`absHz`), how long the wheels were locked. Options: `wet` (0..1), `steer` (1 right / -1 left, the key held with the brake: braking in a turn), `entry` (seconds of steering first), `seconds`, `trace` |
| `liftOffTest(type, kmh, options)` | Lift-off oversteer: a fresh `type` at `kmh` steered hard on full throttle for `hold` s (1.5), then the throttle lifted with the wheel held for `after` s (2.5): body slip at the lift and its peak, the peak stability yaw (`peakYawSlide`), `spun`, heading turned after the lift, seconds of ESC work, end speed. Options: `dir`, `hold`, `after`, `wet` |
| `driftTest(type, kmh, phases, options)` | A scripted drive of a fresh vehicle on the same strip: `phases` is `[[keys, seconds], ...]` (`'KeyW,KeyD'`, `'Space,KeyD'`, `''`), run in turn; returns each phase's end (`slip` and `turned` degrees, `kmh`), `peakSlip` and `spun` (slip past 100 degrees). Options: `wet`, `trace` (a sample every 0.1 s: seconds, slip, turned, km/h) |
| `pose()` | The player's vehicle as the physics sees it: position, heading, yaw rate, km/h, slip angle, hp, drawbridge lift / air |
| `aiDriving(reset)` | Traffic and police since the last reset: crashes and slides (counts, per minute), wetness and grip, moving traffic near the player and its mean speed, the last closing speeds |
| `rideInto(type, kmh, target, gapMetres, seconds)` | Ride a fresh motorbike or bicycle east on the runway strip at `kmh` (held there), into a parked `target` (`'none'` for open road) turned across the way; the player starts healed; returns `riderReport()` |
| `rideIntoWall(type, kmh, seconds, runMetres, x, y)` | Ride a fresh motorbike or bicycle east at `kmh` into the nearest building wall with a clear run (default 20 m) found round (x, y) (default the player); healed first; returns `riderReport()` plus `wallM` and `spot` |
| `riderReport()` | The player's throw off a bike now (phase, height, peak, speed, somersault, hurt, hits, `strikeKmh`, bounces, `rolling`, `knockedOut`, `downFor`, slide), `hp`, `dead`, `bloodNear` / `poolsNear` (wound blood within 30 m), the last six throws (player and traffic riders: cause crash / landing / lowside / loopout, `strikeKmh`, `knockedOut`, `personHp`) and `aircraft`, the last aircraft broken up by a strike (type, cause, km/h, height) |
| `wheelieState()` | The player's two-wheeler: pitch `deg`, `rate`, rider `lean`, `asked` (wheelieHeld), km/h, geometry, balance and loop angles, `steerShare`, and the log (lifts, pops, loops, best degrees and seconds, last loop) |
| `bridgeJump(degrees, kmh, type, seconds, trace, id)` | The drawbridge jump (`id` picks the drawbridge, Palm Sound by default): leaves held at `degrees`, a fresh vehicle at `kmh` 25 m short of the west trunnion, the speed held (the throttle floored up the leaf if the slope pulls it below); `trace` adds samples; returns the outcome (`clears`, `falls short`, `strikes the far leaf`, `can't climb`), gap and tip height (m), speed at the tip, flight length, landing speed, hit points lost |
| `heliInto(kmh, heightM, metres, offsetM, seconds)` | Fly a fresh helicopter level at `kmh` (held there) from `metres` short of the west face of the tallest tower, `heightM` up; `offsetM` puts the mast that far north of the tower's corner so only the rotor can reach it. Returns destroyed, hit points lost, the player's hp and mode, whether thrown clear, and the last aircraft crashes (type, cause, km/h, height) |

## dealership (`dealershipConsole() in src/dealership.js`)

| Method | Purpose |
| --- | --- |
| `dealership()` | MONARCH MOTORS (dealership.js): the hall, doors, stage, handover bay, panes (and how many are broken), every display slot and its car, owned cars (live, where), the alarm (reason, seconds left, shutter), the open card, the delivery and test drive in progress, the people (staff, guards, enthusiasts with their state and current line), sales and thefts, recent events |
| `prestigeCatalog()` | The Prestige Collection's cards: name, price, hp, torque, 0-100, top speed, mass, engine, drivetrain |
| `dealershipVisit(where, zoom)` | Stand at the dealership: `'door'`, `'hall'`, `'hero'`, `'forecourt'`, `'stage'`, `'bays'`, `'lounge'`, `'street'`; returns `dealership()` |
| `dealerMenu(type)`, `dealerMenuPaint(i)`, `closeDealer()` | Open the purchase card on a car on display (a type, or the nearest; `'garage'` for MY GARAGE), pick a paint swatch, close it |
| `dealerBuy(type, paint)` | Buy a car as the BUY button does (the cash must be there) and play the delivery; returns the result or why not (`funds` with `short`, `wanted`, `alarm`) |
| `dealerAlarm(reason)`, `dealerShatter(index)`, `dealerCalm()`, `dealerResetGarage()` | Sound the dealership's alarm (4 stars), break a frontage pane (index or nearest), end the alarm and calm the staff, forget every owned car |

**Drive-bys** (`driveByConsole()`, src/driveby.js):

| Method | Purpose |
| --- | --- |
| `driveBy()` | The current vehicle's drive-by: body (`cabin`, `engine`, `bulkhead`, `box`, `cabWall`, `partition`, `open`, `rider`, `deck`, `cockpit`), front (`glass`, null) and rear (`glass`, `open`, null), the arcs in degrees off the nose (negative left) with their window, how far the arm is out, the window it is out of, the aim (`clear` / `blocked`), a shot waiting for the arm, the blocked-aim cross (showing, degrees off the nose), the windscreen and rear glass states, the windows wound down and counts (shots, refused, rear screens and windscreens burst, windows lowered) |
| `driveByArcs(type)` | A vehicle type's drive-by profile and arcs (no vehicle needed) |
| `driveByCheck(relDegrees)` | Where an aim `relDegrees` off the nose would fire from the current vehicle: ok and the window, or blocked with the nearest edge and the reason, no shot |
| `driveByScreenPoint(relDegrees, metres)` | The viewport pixel of the point `metres` (default 20) from the current vehicle, `relDegrees` off its nose, at gun height: where a test puts the real pointer (`t.mouse`) |
| `driveByAim(relDegrees, fire)` | Hold the aim `relDegrees` off the nose as the aim stick does (`null` lets go); `fire` true holds the trigger, `'raise'` holds the arm out without firing (pictures); step with `wait` |
