# Input, settings and HUD

controls.js (bindings), game-input.js (keyboard, mouse, cheats), mobile.js (touch),
world-view.js (zoom), settings.js, hud.js, game-ui.js, game-menus.js, game-minimap.js,
navigation.js (big map, GPS), cycles.js (bike share), src/shell.html (DOM and CSS).

## Actions, not keys (controls.js)

- `CONTROL_ACTIONS` lists every action with its default keys and contexts (`foot`, `drive`,
  `air`, `chute`). The first default key is the action's *virtual code*: the key listeners
  translate physical keys through the bindings and set `keys[virtualCode]`, so simulation
  code and tests keep reading `keys.KeyW` whatever the player bound.
- New code reads `actionHeld('ascend')` and names keys in prompts with
  `keyName('interact')`, **never a literal "E"**.
- Two actions may share a key only when their contexts do not overlap (Space: handbrake in a
  car, fire on foot). `overrides` lets an air action take a key from movement in the `air`
  context (`ascend` / `descend` on the arrows); `controlConflicts()` knows that pair.
- Menu keys (Escape, Enter, the map's arrows / + / − / 0 / C) are fixed.

## Settings (settings.js)

- One screen, tabs built from `SETTING_ROWS` (GRAPHICS, AUDIO, GAMEPLAY, CONTROLS, and GOD
  MODE while god mode is on); each row has `get()` / `set()` and applies at once. A row with
  `render(body)` draws itself.
- While open, `gameMode` is `'settings'` and every key goes to `settingsKeyDown()`.
- Renderer-owned switches go through the renderer (`city3D.setCharacterCutaway(on)`); values
  the renderer polls (player outline) are read every frame from `settings`.
- Storage keys: see core-and-contracts.md. `DeadEndCity.settings({...})` sets rows from the
  console (e.g. `{ units: 'mph', footSpeed: true }`).

## HUD (hud.js, shell.html INTERFACE 30 section)

- Layout: location top left; cash, stars and clock top right; waypoint pill top centre;
  minimap with health and armour, mission card and equipment column along the bottom (moved
  to the top in touch mode). Radio and weapon boxes are `.hud-pop` chips opened by
  `hudPop(id)` or hover.
- Minimap: zoom by wheel or pinch (`minimapZoom()` scales the cached base layer), foldable,
  saved in `dead-end-city-hud`. GPS route on the minimap (`hudState.gps`).
- **Interaction prompt contract** (hud.js INTERACTION PROMPT): systems never write
  `#interaction`. During an `updateUI()` pass they call
  `offerPrompt(text, { key, hold, id })`; the last offer wins; `commitPrompt()` applies the
  timing rules (pop-in, swap, grace, dock into a chip after 3 s). `id` keeps identity while
  text changes (one id per vehicle kind, so TAKE OFF → RISE is not a new pop-in).
  Visibility is a class (`.show`), never `display` (toggling display restarted the fade-in
  every pass: the old flickering prompt).
- Range tests behind a prompt have hysteresis asked the same way by the prompt and by the
  action key: `withinRange(key, distance, enter, exit)`; `nearestPlace()` for doors.
- Centre cards: `announce()` headline card; `tell()` toasts. PANEL COVER: `body.panel-open`
  hides HUD text under full-screen panels (`hudCovered()`); a toast raised meanwhile is
  tagged `.over-panel`.
- Speed box (`#vehicleStats`): one readout for every way of moving; on foot the movement
  state and measured pace (`trackPlayerPace`). **Every printed speed goes through
  `speedReading` / `speedText` / `kmhReading`** (km/h or mph setting); boats keep knots,
  distances stay metric. Console `speedBox()`.
- Flight HUD (`#flightHud`, `updateFlightHud` from `flightData()`): instruments hug the
  screen edges; warnings (STALL, PULL UP, GEAR) always show even with the instruments off.
- Reduced motion cuts slides and pop-ins (the shell's reduced-motion block).
- Console `promptState()` reports the prompt.

## Touch (mobile.js)

- Independent movement and aim fingers, context action buttons; the HUD's bottom row moves
  to the top so thumbs own the lower corners; phones show only flight warnings.

## Bike share (cycles.js, cycles3d.js)

- South Coast Cycle stations stand by every payphone, at each job's first destination
  (`missions[i].start` or `MISSION_STARTS`), at rail stations and at the old rack sites;
  other systems can call `addBikeShareAnchor({ x, y, label })` before the city is populated.
- Placement tries kerb-side pavement then open ground and takes the first dry, clear
  footprint; the renderer then settles stations against the furniture it placed
  (`settleBikeStations`). Sizes follow the bicycle's `VEHICLE_DEFINITIONS` length.
- RENT BIKE · $5 / DOCK BIKE · $2 BACK through `offerPrompt` (id `bikeshare`); racks, totems
  and bikes are breakable props. Console `bikeShare()`, `bikeStation(id)`.
