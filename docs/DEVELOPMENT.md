# Development workflow

How to change, build and test Dead End City. Written for whoever (human or AI) picks the
project up next; read `docs/SOURCE_GUIDE.md` first for how the code is organized.

## Build

```
python3 tools/build.py                       # writes dead-end-city.html (the deliverable)
python3 tools/build.py --out dist/game.html  # scratch build; dist/ is git-ignored
sh tools/check.sh [tag]                      # assemble + `node --check` syntax gate
```

The build only concatenates: `src/main.js` expands `// @include src/<file>.js` directives
recursively, `src/shell.html` receives the game script, Three.js, the Base64 media listed
in `assets/manifest.json`, the media loader and the credits. Nothing is minified.

### Adding a source file

1. Create `src/<name>.js` starting with `// BEGIN SUBSYSTEM: src/<name>.js — <title>` and a
   doc comment, ending with `// END SUBSYSTEM: src/<name>.js`.
2. Add `// @include src/<name>.js` where it belongs: game logic inside `src/game.js`,
   Three.js meshes inside `createCityRenderer()` in `src/render3d.js`.
3. Add it to the SUBSYSTEM INDEX comment at the top of `src/shell.html` and to the table in
   `docs/SOURCE_GUIDE.md`.

### Adding media

Put the file under `assets/`, add an entry to `assets/manifest.json` (`id`, `file`,
`mime`, `original`), reference the id from `src/asset-loader.js`, and credit it in
`docs/THIRD_PARTY_CREDITS.txt`. Large media that is only ever played by URL (the radio
music) is marked `"stream": true` in the manifest: `dead-end-city.html` still embeds it, but
`python3 tools/build.py --split-media dist/publish` writes `dist/publish/index.html` with
those files beside it in `dist/publish/media/`. That split build is what gets published as
the claude.ai artifact, whose page is capped at 16 MB (each extra file at 15 MB). Keep the
split page under ~15.5 MB; prefer procedural textures and small media (WebP, MP3/OGG).
A recorded loop (engines, rain) ends with 0.2 s of its own start and is listed with its
exact loop length in `LOOP_SECONDS` (audio.js); play it with `loopingSource(name)`, because
Vorbis decoders disagree by up to a few hundred samples about where a file ends.

## Test

Headless Chromium with a software GPU is available (see `tools/smoke.mjs`). It renders
at a few frames per second, so in-game time runs slower than wall time; wait longer
rather than assuming something is broken.

```
node tools/smoke.mjs dist/game.html dist/smoke        # boot, walk, drive, map
node tools/tour.mjs steps.json dist/tour dist/game.html
node tools/layout-audit.mjs dist/game.html            # overlaps in the city plan
sh tools/check.sh dead && node tools/dead-code.mjs    # functions and bindings nothing uses
```

Shader compile errors are not read back by default (it stalls the driver); open the page
with `?shadercheck` in the URL to have three.js report them.

Tours and tests that look at the image should call `DeadEndCity.graphics('high')` first:
headless SwiftShader auto-detects as LOW. Booting takes a minute or more headless, so for
long investigations keep one page open and send it console calls (a small Playwright
script with an HTTP endpoint that runs `page.evaluate` works well) instead of re-running
a tour per question.

`tools/dead-code.mjs` lists functions never called outside their own body (repeatedly,
so a function only called by dead ones shows up too), bindings mentioned only once and
bindings that are only ever assigned. Read each hit before deleting it: something used
only from the browser console or built from a string does not count as a use.

`tools/tour.mjs` starts a game, declines the opening call and runs a list of steps, each
optionally running JavaScript in the page, holding keys, waiting and taking a screenshot:

```json
[
  { "name": "harbor", "js": "DeadEndCity.look(3000, 4000, 0.6)", "wait": 2500 },
  { "name": "fly", "js": "DeadEndCity.drive('helicopter', 150)", "keys": [["KeyW", 1500]] },
  { "name": "stats", "js": "DeadEndCity.stats()", "shot": false }
]
```

### Developer console

`window.DeadEndCity` (defined at the end of `src/game.js`) is the only way tests reach the
game. It is a frozen object of explicit methods; add a new named method when a test needs
something, never a generic code-evaluation hook.

| Method | Purpose |
| --- | --- |
| `version` | The build version (30.0.0) |
| `unitsPerMetre` | The world scale, map units to the metre (8) |
| `scaleReport(radius)` | World-scale audit in metres: every vehicle type's spec (`l`, `w`), the built models within `radius` of the player measured from their meshes (length, width, height), the player's model, the crowd's statures (rig, shortest, average, tallest) and the building heights (lowest, median, 90th percentile, tallest) |
| `repair()` | Mend the player's vehicle as a repair bay would (repeatable physics tests); returns `damageReport()` |
| `status()` | Mode, position, district, health, cash, wanted level, mission, vehicle, weapon in hand, renderer (`3d` or `2d`) |
| `teleport(x, y)`, `look(x, y, zoom)` | Move the player (and camera), optionally zoom (applied at once); lets go of any carrier |
| `setZoom(value)` | Street zoom, eased like the mouse wheel (`look` and `closeUp` apply it at once) |
| `drive(type, altitudeMeters, heading, airframe)` | Spawn any vehicle type beside the player and board it; aircraft can start airborne (a plane then cruises gear up at 75% power); boats go on the nearest open water; optional heading in radians (0 = east); a plane takes an airframe (`'courier'` default, `'jet'`, `'airliner'`) |
| `simulate(seconds, heldKeys)` | Run the simulation forward without drawing while holding keys (e.g. `['KeyW']`, `['KeyE']` for hold-E objectives, `['KeyT']` to climb in an aircraft, `['KeyW', 'Walk']` to walk instead of run); also steps a Blue Hour elevator ride; returns `ride()`. Physics tests use it because headless frames are slow. The codes are the actions' virtual codes (their default keys, controls.js), so they mean the same whatever the player has rebound |
| `places()` | Named businesses and landmarks with coordinates |
| `setClock(hours)`, `sky(id)` | Time of day; weather (`clear`, `fair`, `cloudy`, `overcast`, `rain`, `storm`) |
| `weather()`, `weatherFront(seconds)`, `lightning(distance)` | The weather machine's state (sky, next step, rain, wet, wind, `approach`, showers, strikes, thunder pending); bring a shower in after `seconds` (overcast now, the build-up, then rain; unlocks the sky); a lightning strike `distance` map units from the player (returns where, and when its thunder arrives) |
| `startMission(i)`, `missions()` | Jump into a mission |
| `promptState()` | The interaction prompt as shown: visible, text (with its key), identity, docked, seconds since it popped in, and this pass's offer |
| `missionState()` | Current mission stage, instruction, objective target and Vinny's depot door state; with no mission, how the last one ended |
| `skipToDepotDelivery()` | Mission 1: crates loaded, player in the truck outside Vinny's warehouse with the police alerted |
| `missionTargets()` | The current mission in full: target with altitude, timer, mission vehicles (health, fire), guards, armed hostiles aiming nearby, actors, and each job's point lists (gates, checkpoints, rings, repos...) |
| `probe(x, y, r)` | What occupies a map point: land/water, solid, road, rail, beach, whether a car or a jet ski fits |
| `terrain()` | The Ridgeline Range: each height field's grid, highest point and build time per stage (ms), the two summits' heights, each 4x4 trail's length, summit, steepest graded pitch and trailhead height, forest / boulder / stream counts, and each rock outcrop's ground height and clearance from the trails |
| `steerTo(x, y, seconds, radius, passThrough)` | Drive the current road vehicle or boat toward a point through the real physics (straight-line pilot, backs off walls); `passThrough` counts the point at speed |
| `interact()` | Press the action key once, as E would |
| `boardMissionVehicle()`, `placeVehicle(x, y, heading, altitudeMeters)` | Take the mission's vehicle; move the player's vehicle (stopped, aircraft at an altitude) |
| `defeatMissionGuards(tag)` | Put down the current mission's guards (to skip a fight already verified) |
| `wanted(stars)`, `god(on)` | Police level; invulnerability |
| `godPanel()` | The GOD MODE settings tab (god-panel.js): god mode, whether the tab is shown, the tab list, freeze, clock, weather and lock, pick mode, and the last teleport, refill and lose-police reports |
| `godTeleport(x, y)` | The god-mode teleport as a map click does it (safe ground, a boat on open water, the vehicle to the nearest road, aircraft airborne); returns where the player ended up: `asked`, `to`, `kind` (`foot`, `boat`, `road`, `aircraft`), `snapped`, district, elevation, vehicle (type, heading, on a road), swimming, `solidHere` |
| `godRefill()`, `godLosePolice()`, `godFreeze(on)` | The tab's REFILL ALL AMMO (returns weapons, health, armour and vehicle before / after), LOSE POLICE (stars and pursuing units before / after) and Freeze time |
| `mapScreenPoint(x, y)` | While the city map is open, the client pixel of map point (x, y) (null off the map): tests click the map with it |
| `bike()`, `cab(x, y)`, `ride()` | Bicycle, taxi ride, current vehicle telemetry (speed, pedal cadence and effort; in a tank the hull, turret and aim headings in degrees, the traverse rate and the ammunition) |
| `boardTrain(from, to)` | Board a City Rail train at station `from` for `to` (names as in `RAIL_STATIONS`, or indices), as the platform menu would |
| `skipRide()`, `skipStop()`, `rideSkip()` | Skip the ride as the skip key (Y) would: cab, train or the liner under way (the jump happens at full black; `simulate(2.5)` runs the fade through); on a train move the skip to the next stop choice (U); the report: the offer (prompt, allowed or why not, destination, fare, ride seconds, the train's choices), the fade in progress and the last skip (ride seconds, game clock before / after in minutes, cash before / after, from / to) |
| `setCash(dollars)` | Set the player's cash (fares, shops) |
| `shotLog(reset)` | Every hostile round aimed at the player since the last reset, by source (`police-patrol`, `police-swat`, `army-jeep-gunner`, `police-helicopter`, `police-rooftop-sniper`...): shots, hits, damage, nearest / farthest shooter, how many were fired from off screen, and the last 40 rounds |
| `heal(armor)` | Restore the player's health (and optionally armour) without god mode, for long tests under fire |
| `cover(x, y)` | Overhead cover at a point (default the player): the cover (kind, underside, top) or null, whether the player is hidden from the police helicopter, the registered covers by kind with an example point each |
| `apache()`, `apacheAim(x, y)`, `apacheReset()` | Fort Sentinel's Apache: position, pad, altitude, hp, aboard / taken, ammunition (rounds, rockets, rearming), turret and gun pitch, aim point and a parked-clearance check; fix the gun's aim point on the ground as the mouse would (no arguments hands it back); put a fresh one on its pad. Fire with `simulate(s, ['KeyF'])` (gun) and `simulate(s, ['RocketSalvo'])` (rockets: the action's virtual code) |
| `policeReport()` | The police response: stars, heat and the next star's threshold, the incident's body count, search (active, seconds left, last sighting), arrest progress, the tier's allowances, counts by unit (patrol, swat, fed, army, air, officers, roadblocks), every unit and officer, pursuit counters (contacts, PITs, shortcuts, marine units and shots, tank and marksman rounds, arrests), marine units, and `wounds` (how the dead fell, downed and dragged officers, limping, crawling, bleeding); `crimes` (the last twelve crimes: time, heat, reporting function), `swat` (teams, shield blocks, snipers, sniper shots), `sniperFire` (sniper rounds at the player from roofs and the helicopter, hits on foot and through a car), counts of army units (`armyJeep`, `armyApc`, `armyTruck`), `soldiers`, `snipers` and `shields`, and unit positions |
| `policeLineup(x, y, heading, lights, spacing)` | Park every police model and livery (pursuit sedan, utility and Crown Vic in black and white / modern / sheriff / unmarked, the agents' Tahoe, the SWAT BearCat) in a column, lights on (`true` parked at a scene, `'pursuit'`, `false`); returns ids and looks (police3d.js) |
| `nearbyPeople(radius, kind)` | Living people near the player, nearest first (`civilian`, `police`, `gang` or `all`), with line of sight: play-tests pick victims with it; police also carry `shield`, `roof` (a rooftop sniper), `aim` (a sniper's lock, 0..1), heading and state |
| `arm(index)` | Own weapon `index` (0 pistol to 5 precision rifle) with full ammunition and select it; 6 selects the knife, 7 no weapon (fists) |
| `flight()` | The player's aircraft instruments as the flight HUD shows them: airspeed km/h, altitude and AGL m, vertical speed m/s, heading, pitch, bank, throttle lever and spooled power, flaps, gear, g, angle of attack, stall speed, stall / gear warnings, buffet, whether the HUD is up and whether its instruments are on (`instruments`, the Flight HUD setting), and on the ground on a runway `runway` (name, designation this way, metres left) (`null` outside an aircraft). Flaps and gear are keydown actions: press X / Z / L through the page keyboard |
| `airfields()` | The runways (airfields.js): designations, length, width and blast pads in metres, thresholds, aiming point and touchdown zone, approach lights, what each PAPI shows the player's aircraft (`'RRWW'`, nearest the runway first; on-slope with nobody flying), the runway piers, the taxiway count and every plane (airframe, position, district, hp) |
| `route(x, y)` | Set a map waypoint and report the GPS route from the player: status, road length, the bridges it crosses |
| `roadblocks()`, `containment()` | Police cordon state (cruisers still braced, cones knocked, breached) |
| `roadblock(siteIndex)`, `clearRoadblocks()` | Build a police cut at a chokepoint (nearest to the player if omitted); take every cut down (repeatable ram tests) |
| `launch(metersPerSecond)` | Set the current vehicle moving along its heading, e.g. to ram a roadblock |
| `crashTest(type, targetType, side, metersPerSecond, seconds)` | Drive a fresh car east into a parked one turned to show `side` (`front`, `rear`, `left`, `right`), throttle held; returns both damage reports |
| `park(type, dx, dy, heading)`, `vehicleAt(x, y)` | Park an empty vehicle beside the player (returns its id); find the nearest vehicle |
| `shootAt(x, y, weaponIndex)` | Fire one round (or one shotgun load) from the player at a map point |
| `blast(x, y, power)` | Detonate at a map point (1 = a rocket) |
| `damageReport(id)` | Dents, zones, panels, glass, lamps, tyres, marks, handling and fire of a vehicle (default: the player's) |
| `streetProps(x, y, radius)`, `shopWindows(x, y, radius)` | Knockable furniture and trees near a point, nearest first (id, kind, box, `breakKJ`, strain, size, down) plus counts by kind; shop panes and their state |
| `damageStats()` | Decal and debris pool use and GPU geometry/texture counts (for leak checks) |
| `pedestrianReport()` | Crowd summary: counts by reaction, pose, role and state, street scenes, incidents, witness reports, horns, the speech `bubbles` on screen (at most two, with rank, seconds left, `viewHeight` m, height `fade`, `rider`) and `unshownLines` |
| `fireShot(x, y)` | Fire the equipped weapon toward a map point as the player would (the crowd hears and reacts) |
| `alarm(kind, x, y)` | Raise a `gunfire`, `explosion` or `crash` incident at a point without firing |
| `stageCrash(metersPerSecond)` | Drive the player's car into an occupied car across the road ahead |
| `lifeScene(kind)` | Stage a street scene by the player: `vendor`, `busker`, `cafe`, `smokers`, `delivery`, `hail`, `nightlife`, `busStop` |
| `poseGallery(role)` | Line up one labelled pedestrian per pose in front of the player |
| `closeUp(zoom)` | Inspection only: zoom past the player's limit (up to 8) to look at people |
| `radio()` | The car radio and its volume row as shown: shown / open, station, on (`enabled`: on the Falcon the ride's own switch; `saved`: the saved setting), playing, `volume` (= Settings radio), muted, `unmuteTo`, `volumeSet` (the player chose the level), `elementVolume` (the `<audio>` element's live volume), `scale` (`volumeScale('radio')`), and `knob`: value, angle in degrees, lit LEDs, LCD readout, aria value text, whether it is being dragged and in which mode (`linear` / `circular`), the last drag (mode, from, to, pixels, degrees swept), pixels per step and sweep |
| `audioMix()`, `engineSound()` | The audio context, every bus's live gain (`buses`: mix, effects, engines, ambience, sirens, music, voices), the fixed loops (tyres, siren, rotor) with their gains; the player's engine: set, revs, gear, throttle, load, output gain and tone, each layer's rate and gain, road / wind / track levels, the jet voice, the traffic voices (`nearbyDriven`, the nearest four with loop, distance, revs, rate, level) and `trace` (the last 12 s at 0.1 s: speed, revs, gear, load, gain and the audible layers). `simulate()` drives it, so a test can hold `KeyW` from a standstill and read the gear shifts |
| `rainSound()` | The rain beds: `rain` and `wet`, each bed's target weight (`targets`) and live gain (`light`, `steady`, `heavy`), the roof drumming and tyre spray gains, the `cabin` low-pass (16 kHz in the open, 2.5 kHz under cover, 620 Hz in a closed vehicle) and `shelter` (0 open, 1 under cover) |
| `stats()` | Per-frame CPU timings (`parts`, the renderer's split as `r:` parts), draw calls (`viewCalls` camera, `shadowCalls` shadow map, redrawn every frame while shadows are on), triangles, linked shader `programs`, the dynamic `renderScale` |
| `postView(mode)` | Show the ambient-occlusion (`'ao'`) or bloom (`'bloom'`) buffer instead of the image; no argument restores it |
| `drawProfile(top)` | Draw calls in view by object name and by 512-unit map cell (for finding unbatched scenery; unnamed parts of anonymous groups are listed with geometry, material and colour), and linked shader programs by kind |
| `graphics(tier)` | Graphics quality: `auto`, `low`, `medium`, `high`, `ultra` (saved like the Settings choice); returns the active tier, GPU, shadow-map size (0 with shadows off), `shadows` in force and `shadowSetting`, render scale and AUTO's adaptive state (`averageFrameMs`, `tierDrops`). Headless SwiftShader auto-detects as LOW, so screenshot tours should call `graphics('high')` (a chosen tier is never adapted) |
| `renderScale(scale)` | Draw the scene at `scale` (0.5..1) of the canvas, as AUTO's dynamic resolution does; returns the scale applied |
| `settings(changes)` | Every setting (graphics, shadows (`'auto'`, `'off'`, `'low'`, `'high'`), frameLimit (30, 60, 120 or `'unlimited'`), fps, cutaway, sound, the seven volumes (`masterVolume`, `radioVolume`, `engineVolume`, `soundVolume` = effects, `voiceVolume`, `ambienceVolume`, `sirenVolume`; `audioReset: true` restores the defaults), voices, NPC chatter, minimap fold and zoom, `flightHud` (the flight instruments), `gps` and the points in the minimap's objective route `gpsRoute`, touch mode); pass an object such as `{ chatter: false, minimapZoom: 2, gps: false }` to change some |
| `openSettings(tab)` | Open the settings screen on `graphics`, `audio`, `gameplay`, `controls` or (with god mode on) `god` (over the pause menu during play) |
| `bindings(changes)` | Key bindings as `{ action: [primary, secondary] }`; `{ ascend: 'KeyY' }` binds a primary key (a clash swaps), `'reset'` restores the defaults |
| `military()` | Fort Sentinel: alert, lockdown, gate challenge level, each lane's arm, bollards and sliding gate (and what is broken), soldiers on duty by role, military vehicles and their roles, the supply run and the drill |
| `layout()` | The plan as data (coast, streets, rail, buildings, helipads, ships, props, foot obstacles, street ends, crosswalks, doors, colliders) for overlap audits |
| `swim()`, `ladders()` | The player and the water (swimming, wading, stamina, shore type, nearest way out); every ladder out of the sea |
| `beach()` | Palm Keys Beach: crowd density for the hour, who is there and what they are doing, prop counts |
| `beachClub(action)` | Marea Beach Club: phase, levels, people by slot kind, mode and pose, the queue and the conversation at the door, admitted/rejected/evacuated counts, the music (set, bar, section, gain, wall cutoff); `'trouble'` raises gunfire on its dance floor |
| `clubPool()`, `clubPoolEdge()` | The Marea pool: water rect, the player's phase (dive / swim / out), SWIM / GET OUT offered, breath, club swimmers; stand on its south deck |
| `clubTalk()`, `clubTalkApproach()` | Club conversations: script count by personality, the running one (lines, pose), the bubbles; stand beside the nearest talkable club-goer |
| `volley()`, `volleyJoin(team)`, `volleyLob()`, `volleyCourtCheck()` | Beach volleyball: court, phase, score, ball, players, the player, log; join on a side (0 west, 1 east); lob the ball to the player; the court against the beach plan |
| `trains()`, `advanceTrains(seconds)` | Train positions; run the railway forward (rides take minutes at headless frame rates) |
| `yacht()`, `boardYacht()` | Where the player stands aboard the superyacht; put them on her swim platform |
| `rooftops(x, y)` | Rooftop helipads, the roof the player stands on, the roof under the player's helicopter (floor, clearance); with a map point, that building's roof: height, whether it is landable, archetype and roof plant (`roofKeepOuts`) |
| `themePark()`, `boardRide(kind)` | Sunset Pier: the Falcon's numbers and train, the Eye, fountain and fireworks state, guests, an overlap self-check; board `'coaster'` or `'wheel'` (then `interact()` cycles the ride camera) |
| `coasterVoices(reset)` | The Falcon riders' voices: running, track position (m), whether the first drop has passed, who is speaking, and the log of every scream cue (`first drop`, `drop`, `dip`, `airtime`, `inversion`: game time, car, track m, height m, vertical speed m/s, seat g, drop depth, voices played, lines said) and rider line (`say lift`, `say end`); `reset` clears the log |
| `speechView()` | The speech bubble height rule for someone on the ground at the view's centre: the view's height over them (m), the fade (1 below 40 m, 0 from 50 m), the zoom counted, riding / flying, and the bubbles on screen with their fades |
| `barriers()`, `solidAt(points, r, foot)` | Barrier audit: every sea railing run, street-end guardrail, gate pier and railing as data (what the renderer draws and `solid()` blocks); `solid()` at many `[x, y]` points at once (`foot` adds the player's foot obstacles: furniture, trunks, fixtures) |
| `walk(heading, distance)` | Walk on foot through the real collision code (headless frames are too slow for keys) |
| `match(sport)` | A venue's fixture (`'soccer'` default, `'basketball'`): stage, clock, score, status, crowd, who is on the field, fleeing or dead, abandoned, pitch invader, the player's goals |
| `matchDay(day, minutesFromKickoff, slot, sport)` | Set the world clock relative to a fixture's kickoff (day 1 is the first day; negative minutes are the warm-up) and start that fixture afresh |
| `fixtures(sport, days)` | The coming fixtures |
| `ballState()`, `ballToPlayer(distance)` | The stadium ball (position, height, mode, owner, speed, whether the player is on the pitch); put it in front of the player |
| `stadiumGoal(team, byPlayer)`, `stadiumSound()` | Score a goal for team 0 (home) or 1 (away) at the stadium now, optionally as the pitch invader (whistle, cheer, boards); the stadium's sound: goal reactions playing (target gain, pan and cutoff for where the player is now, and `gainNow`, the live gain gliding to it), the last goal's voices with their distance-based gains, the player's distance and audibility, `bed` (always `null`: there is no crowd bed) |

## Conventions

- Keep code readable: descriptive names, a short comment on anything non-obvious, the
  same idiom as the surrounding file. No minification, packing or `eval`.
- Map coordinates are `(x, y)`; `UNITS_PER_METRE` = 8 (512 units = 64 m). Write speeds and
  accelerations in real units (`50 * KMH`, `0.8 * GRAVITY`, game.js WORLD SCALE). Three.js
  position is `(x, elevation, y)`.
- `solid()` is the one collision test; `entityElevation()` the one height comparison;
  `teleportPlayer()` the one way to move the player.
- `dead-end-city.html` is only ever rebuilt from source, never hand-edited; feature
  branches leave it alone and the release rebuilds it.
- Every player carrier (car, Blue Hour `roof`, `buildingRoof`, `deck`, parachute,
  coaster, train, taxi, the water) must be let go of by `teleportPlayer()`, death and
  mission resets; see AUDIT CONTRACTS at the top of `src/shell.html`.
