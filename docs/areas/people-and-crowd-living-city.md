# The living city (free roam)

livingcity.js and livingcity-*.js: the traffic streamed round the player, drivers making way
for sirens, ambulances answering bodies, street events, North Point Key visitors. Game logic only; updated once a
frame from `updateCivic` (`timed('citylife')`). Console group `livingCity`
(docs/console/crowd.md). Tests: living-traffic, living-sirens, living-medics, living-snatch, living-key.

## Traffic round the player (livingcity-traffic.js)

- The city's AI traffic is a **pool**, not a population: `populate()` lays ~30 cars over the
  whole grid (its spawn tests reject most of 150 tries) and marks them `streamed`; the
  streamer (`streamTraffic`, every 0.5 s) keeps `trafficTarget()` cars inside a square ring
  round the player (`TRAFFIC_RING` 1,050 units, or the view + 450 when zoomed out) by taking
  far, unseen cars off the street and putting a car of a fitting type on a lane just beyond
  the view edge (mid-block, `trafficSpawnValid`, rolling at 30 km/h). While the player drives
  fast the spots lean ahead of them. A teleport (2,600+ units) resettles at once.
- **Only `streamed` cars are ever moved or sent home**, and only untouched ones
  (`streamableTraffic`): no fare, bus route, delivery, crash, damage, mission, theft, siren
  or player contact. Buses, beach club cabs, drawbridge queues keep their own life.
- How busy: `TRAFFIC_BASE` (34) × the hour (`trafficHourFactor`: 0.25 at 3 am, 1.2 in the
  morning rush) × the district (`0.6 + 0.4 × districtBustle`). The pool is bounded: beyond
  target + `TRAFFIC_SPARE` (14) far cars go home, 4 a tick; `TRAFFIC_POOL_CAP` 150. Measured
  on Broadway at 08:00: 45 wanted, ~40 in the ring, ~270 vehicles in all (was 251 with 2
  moving near the player). Physics per 60 fps frame (headless, contended): 2.2-2.7 ms before,
  2.3-3.3 ms after (`trafficBenchmark`).
- Which cars: `TRAFFIC_TYPES` (everyday cars dominate) × `TRAFFIC_DISTRICT_MIX` (taxis on
  Broadway and Midtown, luxury and limousines at North Point and the Exchange, trucks and
  pickups at the Ironworks and the Reclamation, roadsters and bikes on Ocean Drive, hot rods
  in Little Havana) × `TRAFFIC_HOUR_MIX` (taxis at night, vans in the rush). Flagships one in
  forty (one in twenty where the money is).
- **Gotcha**: a car standing still `TRAFFIC_JAM_SECONDS` (45) is cleared when out of view,
  so a deadlock nobody watches heals; one in view is left alone.
- `trafficControl` (physics-traffic.js) now scans the junction box and the exit only for a
  car short of the line on a green (the scans were 60% of its cost) and queries people
  ahead of the car, not round it. Stopped 4 s for the same person (not the player), a car
  eases round them at 7 km/h (`c.easePerson`), never past a red, a car or a stop, nor while
  pulling over for a siren. Close behind a parked car it passes, it aims beside its far
  corner and turns out on the spot short of the bumper (it used to shove it); lane offsets
  are taken across the lane (`navAngle`), not the car. Console `parkedPass`.

## Wrecks and abandoned cars (livingcity-wrecks.js)

- Only AI traffic streams out, so wrecks and cars the player left used to stay for good and every one cost physics time
  (the 30-minute soak: 283 -> 353 vehicles, 5.5 -> 8.2 ms a frame). `retireWrecks` (from `updateLivingCity`, once a
  second) is the one rule; its numbers are `WRECK_LIMITS`: wrecks (`hp` 0) go after **50 s** unseen, abandoned cars (the
  player drove it, `drivenAt` is stamped each pass while `player.car`; nobody in it, no AI, no `driverOut`; never an
  aircraft or boat) after **180 s**, and the world holds at most **16 wrecks** and **24 abandoned cars**: over a cap
  the longest-lived unseen ones go first whatever their timeout (`retireBorn`, started when it became a candidate).
  The cap answers the owner's "whole world or on screen": the whole world.
- Never touched: anything on screen (camera footprint `screenViewHalf` plus 450) or within 1,200 units of the player
  (2,640 in an aircraft or parachute), which also restarts its clock (`retireSeen`); the player's car; mission cars
  (`mission`, `failedMission`, `missionTag`, `mission.car`); an intact owned car; a garage job, taxi ride, dealer test
  drive or carjack in progress; police crews' cars (`crewDeployed`, `blockade`, officers out of it); a live police or air
  unit. Not wrecks: Apaches (apache.js replaces its own) and roof-site aircraft.
- Retiring is the streamer's path (`splice` from `vehicles`: the renderer prunes `carModels`, stains and the broadphase
  follow) plus `clearCarStains`, the officers that stood by it and `pursuitTarget`/`airTarget`/`rammedBy` pointers.
  A burning wreck goes with its fire. An owned car's wreck is replaced by `keepOwnedCars` as before.
- A new vehicle role that must outlive its wreck for a reason adds a flag to `wreckProtected`; a new field that holds a
  vehicle for long adds its clean-up to `retireVehicle`. Console: `wreckReport()` (counts, every candidate's age, unseen
  seconds and why it stays, the last twelve retirements); `soakReport().counts` has `abandoned`, `wreckRetired`,
  `wreckRetiredByCap`. Test: tools/tests/wreck-limit.mjs (about one minute: it runs 3 game minutes).

## Sirens (livingcity-sirens.js)

- `emergencyBeacons(c)` is the one rule for flashing lamps (the renderer's strobes read it):
  a cruiser with stars up or after a gang, the air unit, an ambulance on a job (a parked
  hospital ambulance stays dark). `sirenUnit(c)` is a vehicle traffic makes way for (on the
  road, crewed, running); `sirenUnits` is gathered once a frame.
- `sirenPullOver` (called by trafficControl): a siren closing from behind in our lane or
  head-on down our side → crawl (9 km/h) over to the kerb (`kerbRoom`: 8 units on a narrow
  street, more on the wide avenues), then stop until it is by. Not mid-turn, not while
  easing past a parked car. `c.sirenYield` holds the last time a car gave way.
- `sirenCrossing`: a car short of a junction on a green holds at the line while a unit under
  lights crosses it (moving at the junction, or standing in the box); one behind going our
  way is let through by pulling over instead. **Gotcha**: a unit standing short of the box
  (an ambulance at its stop) must not hold anyone, or they wait for it while it waits for them.
  Likewise a car an ambulance is held up by (crawling, braking for it) gets `c.sirenClear`
  and stops pulling over for that unit for 3 s: it drives on out of the way.
- The ambulance on a run (`emergencyRunControl`, reached through countyRouteControl when
  `c.emergency` is set) straddles the centre line (a car in either lane leaves it about a
  metre each side), runs red lights, slows for its turns, creeps round a car stopped in its way
  on whichever side clears it with the least swing within 26 units of the centre line
  (`run.dodge`; a car pulled over and stopped for it used to deadlock it), and never loops
  its route (`countyIndex` does not wrap).

## Ambulances (livingcity-medics.js)

- A dead street pedestrian 9-150 s old, within 1,100 units of the player, on the grid near
  a street, with no mission, at most one star and no shooting within 500 units for 8 s:
  one job at a time (`MEDIC_COOLDOWN` 25 s between). The ambulance starts off screen
  650-1,400 units away on a street pointing at a junction and follows `copRoute` to the
  nearer end of the body's block (both ends tried, so it never passes the victim and turns
  round), then the stop on the body's street (`medicStopFor`), on the body's side. Held up
  within 170 units of the stop for 2.5 s, it stops there and the crew walks.
- Stuck (stopped, or under 5 km/h over 2 s: grinding past cars pulled over in a jam) 8 s
  (or 70 s on the way) out of view: at the stop if that is out of view too, else at the
  point of its route nearest the stop that is out of view, on the street and clear
  (`hopMedicPastJam`, `hops` in medicReport); boxed in 35 s (or 90 s on the way): job off.
- A person knocked down against a stopped car crawls out from under it (`stepClearOfCar`,
  physics-knockdowns.js; a medic caught in a car's outline steps out the same way): before, one lying at an ambulance's bumper held it for good.
  On scene: two paramedics (whites over navy, `cityRole.kind 'medic'`) get out on the
  victim's side; one kneels (`help` pose), one radios (`phone`); a walker who makes no
  progress for 3 s works from where they stand (the kneeler within 30 units, the radio
  anywhere). After 9 s the victim comes
  round (`reviveBody`: knocked down 2.4 s, then up and away, injured) if found within 120 s
  and 3 in 4 times; otherwise they are lost. The crew climbs back in; the ambulance joins the
  traffic (`streamed`, lamps off).
- **Contracts kept**: medics are ordinary pedestrians with `cityRole`; perception runs first
  and they step aside for any reaction (`updateCityRolePerson` returns false on
  `p.react`/`p.flee`); they never take in bodies (refreshBodies skips them) and on a job
  react only to danger (gunfire, explosion, melee, or panic from one: `decideReaction`),
  never go off to watch, help or flee at a crash, knock-down, body or crime; the streamer
  never moves anyone with a `cityRole`. The kill already counted stays counted.
- Off: the player takes the ambulance, wrecks it (under 50%), leaves (2,200 units), a
  mission starts, or 150 s pass.

## North Point Key visitors (livingcity-key.js)

- City traffic cannot plan onto the Key (the street stops at the circle, so the bridge is no
  exit for `planJunction`). With the player within 1,500 units of the circle and no mission,
  up to 1-3 visitors by the hour (evenings most; one every 14 s at most) spawn out of view on
  the avenue's city end (x 3290, south lane), cross the bridge, go round the circle
  anticlockwise (right-hand traffic), about two in three pull up 4-8 s by the valet, and leave
  on the north lane. At x 3340 they are handed to `trafficControl` as streamed traffic
  (`navAngle` west, like Monarch Isle's hand-off at Crown Avenue).
- Driven by `keyRunControl` through `countyRouteControl` (`c.countyRoute` is the run's
  points, which also keeps the streamer off them): pure pursuit, 38-44 km/h on the avenue,
  20 on the ring, the car ahead (a wider look on the ring), people in its own swath (half
  its width + 5 units of the run): one who stays toots at 2 s, is crept round at 7 km/h
  from 3.5 s (`keyVisitors()` `heldBy`, `waited`; `handed` is the last car handed back). A visitor
  the player takes, wrecks or empties becomes an ordinary car; far, unseen, untouched ones
  are removed when the player is 2,400 units away. Console `keyVisitors`, `keyVisitorSpawn`.
- **Gotcha**: the sea-wall rail at the bridge's west end (x ≈ 3362) stops 12 units inside the
  deck's south edge (its gap is centred on y -3467, not the row), so the lane in keeps 17
  off the centre line: at 24 a limousine's flank caught the rail end and the crash put its
  driver out. `keyVisitors().lastDropped` says why a visitor stopped being one.

## Street events (livingcity-events.js)

- Bag snatch: every ~2-3 minutes on foot in a busy district (8:00-23:00, no mission, no
  stars) a walker near a victim with a bag in view walks up behind them and grabs it; the
  victim shouts, the thief runs (the crowd's own `flee`, its threat point kept on the
  player) and shows as a pulsing red dot on the radar. Catching him on foot (11 units) or
  flooring him any way returns the bag: $120-280 and a thank-you. He gets away after 45 s or
  720 units. The tackle is not a crime; punching or shooting him still is.
