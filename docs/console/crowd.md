# Console: crowd

`addConsoleMethods('crowd', …)` in `src/game-console-crowd.js`. People: crowd report, shots and alarms, street scenes, lineups, speech bubbles, crowd render cost.

| Method | Purpose |
| --- | --- |
| `nearbyPeople(radius, kind)` | Living people near the player, nearest first (`civilian`, `police`, `gang` or `all`), with line of sight: play-tests pick victims with it; police also carry `shield`, `roof` (a rooftop sniper), `aim` (a sniper's lock, 0..1), heading and state |
| `pedestrianReport()` | Crowd summary: counts by reaction, pose, role and state, street scenes, incidents, witness reports, horns, the speech `bubbles` on screen (at most two, with rank, seconds left, `viewHeight` m, height `fade`, `rider`) and `unshownLines` |
| `fireShot(x, y)` | Fire the equipped weapon toward a map point as the player would (the crowd hears and reacts) |
| `alarm(kind, x, y)` | Raise a `gunfire`, `explosion` or `crash` incident at a point without firing |
| `stageCrash(metersPerSecond)` | Drive the player's car into an occupied car across the road ahead |
| `lifeScene(kind)` | Stage a street scene by the player: `vendor`, `busker`, `cafe`, `smokers`, `delivery`, `hail`, `nightlife`, `busStop` |
| `poseGallery(role)` | Line up one labelled pedestrian per pose in front of the player |
| `characterLineup(stance, spacing)` | One of each character in a row facing the camera, the player in the middle: a man and a woman from the street, a commuter, a jogger, a beachgoer, then a patrol officer, a traffic officer, SWAT, an agent and a soldier; `stance` `'stand'`, `'walk'` (civilians walk small circles) or `'aim'` (officers raise their weapons) |
| `crowdStats(byPart)` | What the people cost in the last frame (crowd3d.js): instanced parts drawn, camera and shadow draw calls, instances, triangles, the body set in use (`close` / `street`), pack time (`packMs`, `packMsAverage`), how many still figures were copied rather than rebuilt (`still`); `byPart` lists each part with its instances and triangles |
| `crowdBenchmark(frames)` | Pack all the people `frames` times back to back and return the average milliseconds: the rig's CPU cost without the rest of the frame in the timing |
| `voiceReport(radius)` | Voices (voices.js): people near the player with the sex their screams use (`female`, `kid`, the recorded `sample`), with the 3D renderer the sex the rig drew them as (`drawn`), and for officers who voices their male police recordings (`radio`: `self`, `colleague` or `caption`); `mismatches` (voice vs rig), `wrongTake`, `womenOnRadio` should be 0; `screams` are the last dozen played (who, sex, take) |
| `screamTest(count)` | The `count` nearest living people (street, police, gangs) scream once in their own voices: who, `female`, the take, the rig's `drawn` sex |
| `carjackTest(mood, side, female, passengers)` | The carjack struggle (carjack-struggle.js): a stopped sedan beside the player with a driver of `mood` (`flee`, `plead`, `angry`, `witness`, `defiant`), a woman or a man (`female` true / false, null at random), `passengers` 0 / 1, the player on its `side` (`'driver'` or `'passenger'`, the kerb side: the walk goes round the car), and E pressed at it; returns `carjack()`. The previous test car is removed first |
| `carjack()` | The struggle in progress (`phase` approach / door / reach / tug / pull / enter, seconds, the temper, `approachFor`, `waypoints` round the car, the car's `kmh`, driver and player positions) or, when none runs, whether the player is in the car; always `phases` (the last struggle's run, e.g. `approach > door > reach > tug > pull > enter`), `quick` (why it was the short version: `rolling`, `no room`), `instant` (`kind`: a bike, boat or aircraft pushed off at once), `cancelled` (why it was called off: `walked off`, `late`, `reset`, ...); the last `victim` (sex, role, mood, pose, `down`, what they are saying, `reported`, seconds to the report, distance) and how many `passengers` ran |
| `carjackScan(radius, count, from)` | Occupied traffic near the player, nearest first, and what the action key would do at each (`planCarjack`): `kmh`, `ai`, `locked`, `light` (the signal ahead when at a junction), `why` (`kind`: pushed off at once), `quick` (`rolling` / `no room`: the short version), `waypoints`, `tight` (squeezed in beside the next lane), `driverSide` / `passengerSide` map points 14 units off each side; `from` `'here'` (the player), `'kerb'` or `'driver'` plans as if E were pressed from that side |
| `carjackStage(hem, mood, side, kmh)` | A stopped (or `kmh` rolling, east) sedan with a driver of `mood` staged for the real action key, nothing started: `hem` `'open'`, `'kerb'` (parked cars a short gap ahead and behind), `'lane'` (a car in the next lane beside the driver's door) or `'boxed'` (both, bumper to bumper), the player on its `side`; returns its `carjackScan` plan. Earlier test cars are removed |
| `speechView()` | The speech bubble height rule for someone on the ground at the view's centre: the view's height over them (m), the fade (1 below 40 m, 0 from 50 m), the zoom counted, riding / flying, and the bubbles on screen with their fades |

## livingCity (livingcity-console.js, registered from game-console-crowd.js)

The living city in free roam (docs/areas/people-and-crowd-living-city.md).

| Method | Purpose |
| --- | --- |
| `trafficReport()` | Traffic round the player: `target` for the hour and district, `ring`, the streamed `pool`, cars `near` (in the ring), `inView`, `moving` / `stopped` and why they stand (`held`: signal, queue, blocked, kerb, siren, junction, other), `yielding` to a siren now, `idle30` (standing 30 s+), streamer totals (`recycled`, `added`, `retired`, `streamMs`), `types` near |
| `trafficMix(n)` | `n` picks of what the streamer would put on the street here and now, by type |
| `trafficBenchmark(steps)` | Step the vehicle physics `steps` × 1/120 s back to back (the world moves on) and time it: `msPerStep`, `msPerFrame60`, vehicles, near, moving |
| `trafficStreaming(on)` | Switch the streamer on or off (A/B measurements); returns trafficReport() |
| `sirenPass(behind, gap)` | On the street the player stands on: an ambulance on a run `behind` units back and a traffic sedan `gap` units ahead of it in its lane, both heading along the street |
| `sirenPassState()` | Both vehicles of the siren pass (km/h, `lane` offset right of the centre line, along), how long since the sedan last gave way, `passed` |
| `parkedPass(x, y, heading, gap, offset, type, kmh)` | A parked `type` (default van) in the traffic lane at (x, y) facing `heading` (a quarter turn), its centre `offset` units kerbward of the lane line, and a traffic sedan `gap` units behind it at `kmh` |
| `parkedPassState()` | The parked pass: the sedan (`id`, km/h, `left` of the lane line, `along` from the parked car's spot), the parked car (`moved`: how far it was shoved), `passed` |
| `medicReport()` | The ambulance service: jobs, revived, lost, aborted, `last` (with the `cause` of an abort), cooldown, and the job under way (phase driving / scene / treat / outcome / leave, the ambulance, its siren, leg, `desiredKmh`, `heldBy` (car / person / player), what stands `ahead`, `stuckFor` and `hops` (times it went on past a jam out of sight), the medics with distance to the victim, pose, reaction, boarded) |
| `medicTest(x, y, revive)` | A body at (x, y) (default 60 units along the pavement from the player), dead 12 s, and an ambulance sent at once; `revive` forces the outcome |
| `streetEvents()` | Street events: staged, caught, escaped, seconds to the next try, whether one is `allowed` here now, `last`, the one under way (thief and victim, the gap) |
| `snatchTest()` | Stage a bag snatch round the player now (null `active` when no victim with a bag is in view or no thief close by) |
| `keyVisitors()` | North Point Key visitors (livingcity-key.js): the hour's `target`, `spawned`, `handedBack` (to city traffic), `dropOffs` (pauses by the valet), `lastFail` (why the last spawn could not go), `lastDropped` (the last visitor that became an ordinary car: ai, hp, driverOut, crashStop, taken), the run's point counts, and each visitor's id, type, place, km/h, `leg` (avenue / ring / stop / exit), hp and what stands `ahead` |
| `keyVisitorSpawn(dropOff)` | Send one visitor onto the Key avenue now, in view or not (tests; `dropOff` true/false forces the pause by the valet or none): `keyVisitors()` with `sent` and the car's `id` (`lastFail` says why not) |

## blood (blood.js, registered from game-console-crowd.js)

Wounds on the ground (docs/areas/police-and-combat.md, BLOOD).

| Method | Purpose |
| --- | --- |
| `bloodReport(x, y, radius)` | Blood decals within `radius` (default 120) of (x, y) (default the player): `total` in the world, `near` counts by kind (`pool` spreading under a body, `spatter`, `drop`, `track`, `stain`), the `largest` radius, each pool's `r` / `rMax` / `tau` / `age`, drops still `flying` |
| `bloodVictim(hits, damage, kind, distance)` | A bystander `distance` (50) ahead of the player, struck `hits` times for `damage` of `kind` (`ballistic`, `headshot`, `blast`, `impact`) as the player's shots would; returns position, hp, `dead`, `downed` |
| `carBloodReport()` | Blood on the player's car (car-stains.js): each stain's `face`, `x`/`z`, `sev`, `kph`, `age`, `dry` (0 wet .. 1 dry), `wash`; `skin` is what the 3D view fitted (`triangles`, `events`, `panels`, `paintMs`, `buildMs`, `skins` alive of `maxSkins`), null without the renderer |
| `carBloodVictim(along, lateral, hp)` | Stand a bystander on the player's car: `along` units ahead of its centre, `lateral` to its right (nose: half the length + 30; flank: 0 and half the width - 3); a moving car then runs into them (`launch`) |
| `carBloodMark(face, kph, fatal, across, age)` | Stain the player's car as a person hit on `face` (`front`, `rear`, `left`, `right`) would, aged `age` s; returns the record |
| `bloodEnabled(on)` | The blood setting for tests: false stops all blood and stains; no argument reports it |
