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
| `speechView()` | The speech bubble height rule for someone on the ground at the view's centre: the view's height over them (m), the fade (1 below 40 m, 0 from 50 m), the zoom counted, riding / flying, and the bubbles on screen with their fades |
