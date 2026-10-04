# Console: core

`addConsoleMethods('core', …)` in `src/game-console-core.js`. Basics: version and scale, status, teleport/look, clock and zoom, stepping the simulation, the action key, health, god mode, cash, walking. It also registers the feature consoles below.

| Method | Purpose |
| --- | --- |
| `setClock(hours)` | Time of day (hours, 0-24) |
| `god(on)` | Invulnerability |
| `version` | The build version (0.9.0) |
| `unitsPerMetre` | The world scale, map units to the metre (8) |
| `status()` | Mode, position, district, health, cash, wanted level, mission, vehicle, weapon in hand, renderer (`3d` or `2d`) |
| `teleport(x, y)`, `look(x, y, zoom)` | Move the player (and camera), optionally zoom (applied at once); lets go of any carrier |
| `setZoom(value)` | Street zoom, eased like the mouse wheel (`look` and `closeUp` apply it at once) |
| `cameraFeel()` | The camera's feel (camera-feel.js, camera-drive.js): the eased `lead` (units, `leadMetres`, `leadHeading` degrees), the lead it wants now (`want`), where the view stands from the player (`offset`), the spring `kick` and its speed, `shake` and the tremor drawn (`shakeDrawn`, less in a road vehicle), `heightLag` (the camera's smoothed height less the vehicle's), the look-ahead setting's share, `chase`, and the driving follow: `drive` (on in a road vehicle or boat), `driveHeading` (the lead's heading, degrees), `driveKmh` (the eased speed the framing reads), `viewSpeed` (units/s) |
| `cameraView()` | The street camera's framing (world-view.js CAMERA CONTEXT, SPEED PULL-BACK): `zoom` in force (drawn frames), the player's `target` zoom, the `context` share for what the player is in (1 on foot, 0.7 car, 0.76 motorbike, 0.82 bicycle, 0.6 long vehicles and boats, 0.8 aircraft), the `speed` pull-back and the eased `kmh` it reads, the eased `framing` (the simulation advances it, `simulate` included), `framed` (the zoom it holds: target times framing) and `aim` (the zoom it eases to), `defaultZoom`, `limits`, `viewport`, `viewMetres` (street on screen, top to bottom), `personPx` (a 1.75 m person's height on screen) and `comfort` (as `cameraComfort()` over 4 s) |
| `cameraComfort(seconds)` | How the street camera moved over the last 0.5-4 s (camera-comfort.js), in screen heights at 30 Hz smoothed over ~0.1 s: `accel` and `jerk` (rms, peak; per s² and s³) of the view's path (its height included), `zoomRate` (% a second, rms, peak), `jolt` (largest kick and tremor offset) and `drift` (`peak` distance of the player from the middle of the screen, `swing` how far that wandered); null with under half a second of samples |
| `simulate(seconds, heldKeys)` | Run the simulation forward without drawing while holding keys (e.g. `['KeyW']`, `['KeyE']` for hold-E objectives, `['KeyT']` to climb in an aircraft, `['KeyW', 'Walk']` to walk instead of run); also steps a Blue Hour elevator ride; returns `ride()`. Physics tests use it because headless frames are slow. The codes are the actions' virtual codes (their default keys, controls.js), so they mean the same whatever the player has rebound |
| `promptState()` | The interaction prompt as shown: visible, text (with its key), identity, docked, seconds since it popped in, and this pass's offer |
| `hudClearance(action)` | The mission card's clearance of the player (hud-clearance.js): the player's box on screen (`player`, CSS px; null in aircraft, under a canopy, on rides), the card's last measured `open` and `strip` boxes, the dialogue line's box (`story`) and the waypoint pill's (`nav`), `folded`, `hidden`, `yielding` (folded for the player), `asked` (opened on purpose with O), the fades (`fadeCard`, `fadeStory`, `fadeNav`) and `readLeft` (seconds of reading time left). `'read'` first opens the card for a fresh read, as a new call or objective does |
| `hudOverlaps(slack)` | Every HUD box drawn (id and rect, CSS px), the pairs that overlap by more than `slack` px (default 2; nested boxes are not pairs) and `overPlayer`, the boxes over the player's box (null when it is not known) |
| `interact()` | Press the action key once, as E would |
| `setCash(dollars)` | Set the player's cash (fares, shops) |
| `heal(armor)` | Restore the player's health (and optionally armour) without god mode, for long tests under fire |
| `holdSimulation(on)` | Stop the frame loop's simulation while it keeps drawing, so a screenshot sequence can be stepped with `simulate()` |
| `closeUp(zoom)` | Inspection only: zoom past the player's limit (4.5; up to 24) to look at people and car models (in a vehicle the context share still applies) |
| `footwork(aimDegrees, moveDegrees, fire)` | Facing and footwork (footwork.js): with a number (0 east, 90 south) hold the aim there as the touch aim stick does, `null` lets it go (and releases any keys it held); `moveDegrees` holds the movement keys toward that bearing (nearest of eight) and `fire` the fire key while the page runs, for gait screenshots; returns where the body faces (`aim` or `travel`), the movement keys' heading, `inFight`, the pace share (1 forwards, 0.8 side-step, 0.6 backpedal) and km/h. Move with `simulate(s, ['KeyS'])` |
| `walk(heading, distance)` | Walk on foot through the real collision code (headless frames are too slow for keys) |

## godPanel (`godPanelConsole() in src/god-panel.js`)

| Method | Purpose |
| --- | --- |
| `godPanel()` | The GOD MODE settings tab (god-panel.js): god mode, whether the tab is shown, the tab list, freeze, clock, weather and lock, pick mode, and the last teleport, refill and lose-police reports |
| `godTeleportPick()` | Open the TELEPORT map from play as Settings · GOD MODE · PICK ON MAP does (god mode on); returns `godPanel()`. With `mapScreenPoint(x, y)` a test clicks a map point with the real pointer |
| `godTeleport(x, y)` | The god-mode teleport as a map click does it (safe ground, a boat on open water, the vehicle to the nearest road, aircraft airborne); returns where the player ended up: `asked`, `to`, `kind` (`foot`, `boat`, `road`, `aircraft`), `snapped`, district, elevation, vehicle (type, heading, on a road), swimming, `solidHere` |
| `godRefill()`, `godLosePolice()`, `godFreeze(on)` | The tab's REFILL ALL AMMO (returns weapons, health, armour and vehicle before / after), LOSE POLICE (stars and pursuing units before / after) and Freeze time |
| `mapScreenPoint(x, y)` | While the city map is open, the client pixel of map point (x, y) (null off the map): tests click the map with it |
