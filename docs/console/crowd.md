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
| `carjack()` | The struggle in progress (`phase` approach / door / tug / throw, seconds, the temper, `approachFor`, `waypoints` round the car, driver and player positions) or, when none runs, whether the player is in the car and `instant` (why the last one was a yank without a struggle: `rolling`, `no room`, `kind`); the last `victim` (sex, role, mood, pose, `down`, what they are saying, `reported`, seconds to the report, distance) and how many `passengers` ran |
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
| `medicReport()` | The ambulance service: jobs, revived, lost, aborted, `last`, cooldown, and the job under way (phase driving / scene / treat / outcome / leave, the ambulance, its siren, leg, `desiredKmh`, `heldBy` (car / person / player), what stands `ahead`, the medics with distance to the victim, pose, reaction, boarded) |
| `medicTest(x, y, revive)` | A body at (x, y) (default 60 units along the pavement from the player), dead 12 s, and an ambulance sent at once; `revive` forces the outcome |
| `streetEvents()` | Street events: staged, caught, escaped, seconds to the next try, whether one is `allowed` here now, `last`, the one under way (thief and victim, the gap) |
| `snatchTest()` | Stage a bag snatch round the player now (null `active` when no victim with a bag is in view or no thief close by) |
