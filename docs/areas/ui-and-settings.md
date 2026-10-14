# Input, settings and HUD

controls.js (bindings), game-input.js (keyboard, mouse, cheats), mobile.js (touch),
world-view.js (zoom), settings.js, hud.js, game-ui.js, game-menus.js, game-minimap.js,
navigation.js (big map, GPS), cycles.js (bike share), src/shell.html + src/ui/* (DOM and CSS).

## Actions, not keys (controls.js)

- `CONTROL_ACTIONS` lists every action with its default keys and contexts (`foot`, `drive`,
  `air`, `chute`). The first default key is the action's *virtual code*: the key listeners
  translate physical keys through the bindings and set `keys[virtualCode]`, so simulation
  code and tests keep reading `keys.KeyW` whatever the player bound.
- New code reads `actionHeld('ascend')` and names keys in prompts with
  `keyName('interact')`, **never a literal "E"**.
- Two actions may share a key only when their contexts do not overlap (Space: `jump` on foot,
  `handbrake` in a vehicle, `rockets` in the air; each has its own virtual code, `Jump`, `Space`,
  `RocketSalvo`, so readers check the context themselves and a jump is taken on the press's edge,
  player-jump.js). Space no longer fires on foot (there was no other use for it).
  `overrides` lets an air action take a key from movement in the `air`
  context (`ascend` / `descend` on the arrows); `controlConflicts()` knows that pair.
  `overrideCtx` limits where it takes over: `ascend` is also a `drive` action (climb + throttle
  = a wheelie, `wheelieHeld()`), but on the road ↑ stays forward too; the pad's stick-up in a
  vehicle is `ascend`. The HUD strip has a `moto` context and a `wheelie` pseudo-key
  (`keyName('forward') + '+' + keyName('ascend')`, left out on touch).
- Menu keys (Escape, Enter, the map's arrows / + / − / 0 / C) are fixed.
- Left fire and right aim/secondary fire release independently. Blur and hidden tabs clear
  physical and virtual keys and both buttons; pause, help and the map clear both firing
  buttons. A missing mouseup outside the game must not leave firing or aiming held.
  Every elevator entry releases `mouse.down` and `mouse.alt`, the actual right-button
  aim/secondary-fire state, including Fort Sentinel's records search and skyline lifts
  (`mission-modal-input` checks their actual entry functions, including rejected duplicate entry).
- **Hints follow the device** (input-hints.js): `keyName(id)` returns the touch button's
  label (`touchButtonLabel`, mobile.js: the same text the button shows, so ACTION / EXIT /
  GAS follow the context) or the gamepad button (`gamepadKeyName`) while that device was
  the last one used (`hintDevice()`; `body[data-input]`). Write `pressKey(id, style)`
  ('PRESS E' / 'TAP ACTION' / 'PRESS A') instead of `'Press ' + keyName(id)`, and
  `keyPrefix(id)` for a chip's 'E · '. `keyNames()` and the settings screen stay keys.
  Console `inputHints('touch' | 'gamepad' | 'keyboard' | 'auto')`.
- Gamepad (gamepad.js, standard mapping): each button sends the key bound to an action
  (`PAD_PLAY` per context) through the keyboard handler, so bindings and modes apply; the
  events are untrusted, so they never flip the hint device back to keyboard. Menus: D-pad /
  stick move the focus (arrow keys where a menu has them), A presses, B backs out; the city
  map pans / zooms and A drops the waypoint under the centre cross. Console `gamepadFeed`.

## Settings (settings.js)

- One screen, tabs built from `SETTING_ROWS` (GRAPHICS, AUDIO, GAMEPLAY, CONTROLS, and GOD
  MODE while god mode is on); each row has `get()` / `set()` and applies at once. A row with
  `render(body)` draws itself.
- While open, `gameMode` is `'settings'` and every key goes to `settingsKeyDown()`.
- Renderer-owned switches go through the renderer (`city3D.setCharacterCutaway(on)`); values
  the renderer polls (player outline, player ring) are read every frame from `settings`.
- Gameplay · Motion comfort (`settings.motionComfort`, `motionComfortOn()`): the steady camera (settings.js
  MOTION COMFORT); Driving · Vehicle camera distance (`drivingSettings.cameraDistance`, 80-160 %,
  default 120 %, `vehicleCameraFactor()`): a factor on every vehicle's framing at 31 km/h and over; Driving ·
  Walking camera distance (`drivingSettings.walkDistance`, 60-160 %, default 100 % = the on-foot framing exactly,
  `walkCameraFactor()`): on foot, in a carjack and in a road vehicle or boat below 30 km/h; Driving · Camera
  look-ahead (`drivingSettings.lookAhead`, 0-300 %, default 200 %; the driving settings record carries `version`
  2, and an older record still at 150 % loads as 200 %). All are read live by the street camera (the chase view
  ignores them); camera tests calibrate at 100 % and restore the defaults with `drivingReset`.
- Graphics · Ring under your character (`settings.playerRing`, `playerRingOn()`): off by
  default, also for saves that predate it; drives the 3D `playerRing` and the 2D fallback's
  circle under the player. Objectives have no ring at all (markers.js): the floating arrow only.
- Graphics · FPS counter is on for a fresh profile, including when browser storage is blocked.
  An explicit `dead-end-city-fps: off` preference is preserved. The half-second sample counts
  live rendered-frame intervals only; loading, hidden-tab time and console-stepped frames do
  not enter it. Returning to the tab starts a fresh sample (`game-loop.js`, `resetFpsSample`).
  The readout sits above the desktop waypoint, and below the touch buttons to avoid the
  touch waypoint's top row. `hud-layout` checks the enabled counter in both layouts.
- Storage keys: see core-and-contracts.md. `DeadEndCity.settings({...})` sets rows from the
  console (e.g. `{ units: 'mph', footSpeed: true }`).

## Page markup and CSS (src/shell.html, src/ui/)

- `src/shell.html` is a ~70-line skeleton: `<head>`, a `<style>` of
  `/* @include src/ui/x.css */` lines, a `<body>` of `<!-- @include src/ui/x.html -->` lines,
  then the build placeholders (`<!-- @include-game-source -->` etc.). build.py splices each
  fragment in verbatim (nested includes allowed, missing file = build error), so order in
  the skeleton is cascade order: a later file wins ties.
- CSS: base (tokens, dialogs, calls), touch-controls, casino-transit, police-arsenal,
  wanted-effects, hud-top, hud-bottom, radio, title, dialogs, god-panel, sportsbook,
  sportsbook-bets, demo, settings, touch-hud, title-radio, flight-hud, reduced-motion.
  Markup: hud (every HUD element, radio, flight HUD, touch buttons), menus (title menu,
  mission select, demo card, call/elevator/arsenal/taxi/service overlays), panels
  (sportsbook, pause, settings, help, map), credits, transit. build-header.html is the
  comment at the top of the built page.
- Find an id or class with `grep -rn 'id="x"' src/ui/`. Add a panel: markup in a new or
  matching `src/ui/*.html`, its CSS in a `src/ui/*.css` (new file = new include line in
  `src/shell.html`, before `reduced-motion.css`), then `python3 tools/filemap.py`.

## HUD

Layout, map layers, prompt arbitration, guarded DOM writes, notifications, mission-card clearance and speed/flight/world-edge readouts: [HUD contracts](ui-and-settings-hud.md).

## Touch (mobile.js)

- Independent movement and aim fingers, context action buttons; the HUD's bottom row moves
  to the top so thumbs own the lower corners; phones show only flight warnings.

## Bike share (cycles.js, cycles3d.js)

- South Coast Cycle stations stand by the original story payphone (`phone`; the other story payphones only keep
  stations 88 units off their reach, `payphoneKeepOuts`), at each job's first destination
  (`missions[i].start` or `MISSION_STARTS`), at rail stations and at the old rack sites;
  other systems can call `addBikeShareAnchor({ x, y, label })` before the city is populated.
- Placement tries kerb-side pavement then open ground and takes the first dry, clear
  footprint; the renderer then settles stations against the furniture it placed
  (`settleBikeStations`). Sizes follow the bicycle's `VEHICLE_DEFINITIONS` length.
- RENT BIKE · $5 / DOCK BIKE · $2 BACK through `offerPrompt` (id `bikeshare`); racks, totems
  and bikes are breakable props. Console `bikeShare()`, `bikeStation(id)`.
