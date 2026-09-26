# Console: core

`addConsoleMethods('core', …)` in `src/game-console-core.js`. Basics: version and scale, status, teleport/look, clock and zoom, stepping the simulation, the action key, health, god mode, cash, walking. It also registers the feature consoles below.

| Method | Purpose |
| --- | --- |
| `setClock(hours)` | Time of day (hours, 0-24) |
| `god(on)` | Invulnerability |
| `version` | The build version (30.0.0) |
| `unitsPerMetre` | The world scale, map units to the metre (8) |
| `status()` | Mode, position, district, health, cash, wanted level, mission, vehicle, weapon in hand, renderer (`3d` or `2d`) |
| `teleport(x, y)`, `look(x, y, zoom)` | Move the player (and camera), optionally zoom (applied at once); lets go of any carrier |
| `setZoom(value)` | Street zoom, eased like the mouse wheel (`look` and `closeUp` apply it at once) |
| `simulate(seconds, heldKeys)` | Run the simulation forward without drawing while holding keys (e.g. `['KeyW']`, `['KeyE']` for hold-E objectives, `['KeyT']` to climb in an aircraft, `['KeyW', 'Walk']` to walk instead of run); also steps a Blue Hour elevator ride; returns `ride()`. Physics tests use it because headless frames are slow. The codes are the actions' virtual codes (their default keys, controls.js), so they mean the same whatever the player has rebound |
| `promptState()` | The interaction prompt as shown: visible, text (with its key), identity, docked, seconds since it popped in, and this pass's offer |
| `interact()` | Press the action key once, as E would |
| `setCash(dollars)` | Set the player's cash (fares, shops) |
| `heal(armor)` | Restore the player's health (and optionally armour) without god mode, for long tests under fire |
| `holdSimulation(on)` | Stop the frame loop's simulation while it keeps drawing, so a screenshot sequence can be stepped with `simulate()` |
| `closeUp(zoom)` | Inspection only: zoom past the player's limit (up to 24) to look at people |
| `walk(heading, distance)` | Walk on foot through the real collision code (headless frames are too slow for keys) |

## godPanel (`godPanelConsole() in src/god-panel.js`)

| Method | Purpose |
| --- | --- |
| `godPanel()` | The GOD MODE settings tab (god-panel.js): god mode, whether the tab is shown, the tab list, freeze, clock, weather and lock, pick mode, and the last teleport, refill and lose-police reports |
| `godTeleport(x, y)` | The god-mode teleport as a map click does it (safe ground, a boat on open water, the vehicle to the nearest road, aircraft airborne); returns where the player ended up: `asked`, `to`, `kind` (`foot`, `boat`, `road`, `aircraft`), `snapped`, district, elevation, vehicle (type, heading, on a road), swimming, `solidHere` |
| `godRefill()`, `godLosePolice()`, `godFreeze(on)` | The tab's REFILL ALL AMMO (returns weapons, health, armour and vehicle before / after), LOSE POLICE (stars and pursuing units before / after) and Freeze time |
| `mapScreenPoint(x, y)` | While the city map is open, the client pixel of map point (x, y) (null off the map): tests click the map with it |
