# The living city (free roam)

livingcity.js and livingcity-*.js: the traffic streamed round the player, drivers making way
for sirens, ambulances answering bodies, street events. Game logic only; updated once a
frame from `updateCivic` (`timed('citylife')`). Console group `livingCity`
(docs/console/crowd.md). Tests: living-traffic, living-sirens, living-medics.

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
  ahead of the car, not round it.

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
  lights crosses it; one behind going our way is let through by pulling over instead.
- The ambulance on a run (`emergencyRunControl`, reached through countyRouteControl when
  `c.emergency` is set) straddles the centre line (a car in either lane leaves it about a
  metre each side), runs red lights, slows for its turns, creeps round a car poking into its
  way (`run.dodge`), and never loops its route (`countyIndex` does not wrap).

## Ambulances (livingcity-medics.js)

- A dead street pedestrian 9-150 s old, within 1,100 units of the player, on the grid near
  a street, with no mission, at most one star and no shooting within 500 units for 8 s:
  one job at a time (`MEDIC_COOLDOWN` 25 s between). The ambulance starts off screen
  650-1,400 units away on a street pointing at a junction and follows `copRoute` to the
  body's junction, then the stop on the body's street (`medicStopFor`), on the body's side.
- Stuck 8 s (or 70 s on the way) with neither it nor the stop in view: it is simply there.
  On scene: two paramedics (whites over navy, `cityRole.kind 'medic'`) get out on the
  victim's side; one kneels (`help` pose), one radios (`phone`); a walker who makes no
  progress for 3 s works from where they stand (within 30 units). After 9 s the victim comes
  round (`reviveBody`: knocked down 2.4 s, then up and away, injured) if found within 120 s
  and 3 in 4 times; otherwise they are lost. The crew climbs back in; the ambulance joins the
  traffic (`streamed`, lamps off).
- **Contracts kept**: medics are ordinary pedestrians with `cityRole`; perception runs first
  and they step aside for any reaction (`updateCityRolePerson` returns false on
  `p.react`/`p.flee`); they never take in bodies (refreshBodies skips them); the streamer
  never moves anyone with a `cityRole`. The kill already counted stays counted.
- Off: the player takes the ambulance, wrecks it (under 50%), leaves (2,200 units), a
  mission starts, or 150 s pass.

## Street events (livingcity-events.js)

- Bag snatch: every ~2-3 minutes on foot in a busy district (8:00-23:00, no mission, no
  stars) a walker near a victim with a bag in view walks up behind them and grabs it; the
  victim shouts, the thief runs (the crowd's own `flee`, its threat point kept on the
  player) and shows as a pulsing red dot on the radar. Catching him on foot (11 units) or
  flooring him any way returns the bag: $120-280 and a thank-you. He gets away after 45 s or
  720 units. The tackle is not a crime; punching or shooting him still is.
