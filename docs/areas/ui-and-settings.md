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
- Two actions may share a key only when their contexts do not overlap (Space: handbrake in a
  car, fire on foot). `overrides` lets an air action take a key from movement in the `air`
  context (`ascend` / `descend` on the arrows); `controlConflicts()` knows that pair.
  `overrideCtx` limits where it takes over: `ascend` is also a `drive` action (climb + throttle
  = a wheelie, `wheelieHeld()`), but on the road ↑ stays forward too; the pad's stick-up in a
  vehicle is `ascend`. The HUD strip has a `moto` context and a `wheelie` pseudo-key
  (`keyName('forward') + '+' + keyName('ascend')`, left out on touch).
- Menu keys (Escape, Enter, the map's arrows / + / − / 0 / C) are fixed.
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
- Graphics · Ring under your character (`settings.playerRing`, `playerRingOn()`): off by
  default, also for saves that predate it; drives the 3D `playerRing` and the 2D fallback's
  circle under the player. Objectives have no ring at all (markers.js): the floating arrow only.
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

## HUD (hud.js, src/ui/hud.html, src/ui/hud-top.css + hud-bottom.css)

- Layout: location top left; cash, stars and clock top right; waypoint pill top centre;
  minimap with health and armour, mission card and equipment column along the bottom (moved
  to the top in touch mode). Radio and weapon boxes are `.hud-pop` chips opened by
  `hudPop(id)` or hover; in touch mode only by `hudPop` (a tap), since a tapped box keeps
  `:hover` / `:focus-within` long after its pop ends (touch-hud.css).
- Story line (`#storyLine`, the film subtitle) vs the mission card: on a short desktop window
  (max-height 620px, wider than 700px) there is no room for both above the bottom row, so
  while a line is up the card stays a strip (`missionCardYields`, game-ui.js; O still opens it)
  and the line sits just above the strip, between the minimap and the equipment column
  (radio.css). In touch mode the line goes over the Blue Hour stealth meter
  (`body.roof-stealth`, touch-hud.css). Console `missionCard()` (`open`, `line`).
- Minimap: zoom by wheel or pinch (`minimapZoom()` scales the cached base layer), foldable,
  saved in `dead-end-city-hud`. GPS route on the minimap (`hudState.gps`). map-view.js:
  it pulls back with speed (`minimapSpeedZoom`, eased), an arrow on its rim points at an
  off-map job or waypoint, and both map canvases keep a fixed logical frame (minimap 240
  wide, city map 800 x 660) with a backing store at the screen's pixel ratio: always draw
  through `drawMinimap()` / the logical sizes, never the canvas's `width`.
- City map (map-view.js): the MAP LAYERS chips filter both maps (`mapLayerOn(id)` in
  drawMap; saved in `dead-end-city-map`; the job, waypoint, route and player always show);
  GO TO lists the nearest hospital, respray, armory, shops, rail, sports... and a tap sets
  the waypoint. Place names skip any that would overlap one already drawn (region and water
  names first), so the district names appear as you zoom in. Console `mapView()`.
- **Interaction prompt contract** (hud.js INTERACTION PROMPT): systems never write
  `#interaction`. During an `updateUI()` pass they call
  `offerPrompt(text, { key, hold, id })`; the last offer wins; `commitPrompt()` applies the
  timing rules (pop-in, swap, grace, dock into a chip after 3 s). `id` keeps identity while
  text changes (one id per vehicle kind, so TAKE OFF → RISE is not a new pop-in).
  Visibility is a class (`.show`), never `display` (toggling display restarted the fade-in
  every pass: the old flickering prompt).
- **HUD writes** (game-state.js HUD WRITE GUARD): `textContent` / `innerHTML` of elements from `getElement()` skip
  a same-value write; attributes the HUD sets every pass go through `hudAttr(el, name, value)` (setAttribute,
  `dataset` and `title` rewrite the attribute, a DOM mutation and an attribute-selector invalidation, even when
  unchanged); `classList.add` / `remove` rewrite the class attribute too, so a per-pass one is guarded by
  `contains` (`toggle(name, force)` is safe). A layout read in the pass (getBoundingClientRect, offsetWidth) forces a
  whole-page layout after its writes: queue it for the frame start instead, as the dock line does
  (`placeDockLine` -> `measureDockLine`, run first in `runFrame` and `updateUI`). `hitchRun().domTargets` lists what
  still mutates; tools/tests/hud-dom-writes.mjs holds the steady HUD at zero rewrites.
- Range tests behind a prompt have hysteresis asked the same way by the prompt and by the
  action key: `withinRange(key, distance, enter, exit)`; `nearestPlace()` for doors.
- Centre cards: `announce()` headline card. PANEL COVER: `body.panel-open` hides HUD text
  under full-screen panels (`hudCovered()`); a toast raised meanwhile is tagged `.over-panel`.
- **Notifications** (hud-notify.js): `tell(text, seconds, { id, tone })` adds a `.note` to
  the `#toast` feed, newest first, at most 3 (2 on a phone); nothing overwrites. A line with
  the same `id` (default: the text with its numbers masked) refreshes in place, so a counter
  or a per-frame tell never piles up. Life is at least ~0.24 s a word (1.5-7 s) on the HUD
  clock. Tone (edge colour) from the words unless given: police, warn, good, info. Console
  `notices()`.
- Car radio on a phone (`phoneHud()`): `hudPop('carRadio')` only flashes the chip; it opens
  on a tap (the old 4 s mid-screen pop on getting in covered the road and the toasts).
- Speed box (`#vehicleStats`): one readout for every way of moving; on foot the movement
  state and measured pace (`trackPlayerPace`). **Every printed speed goes through
  `speedReading` / `speedText` / `kmhReading`** (km/h or mph setting); boats keep knots,
  distances stay metric. Console `speedBox()`.
- Flight HUD (`#flightHud`, `updateFlightHud` from `flightData()`): instruments hug the
  screen edges; warnings (STALL, PULL UP, GEAR) always show even with the instruments off.
- World-edge card (`#worldEdgeCue`, world-edge.js, src/ui/world-edge.css; same pattern as
  `#freefallCue`): RETURN TO THE CITY, the seconds left as a big number (10..0), metres past the
  edge, the compass word and an arrow turned toward the middle of the map (`--we-turn`, north
  up the screen), a time bar. Top centre under the flight heading strip (178 px; 140 on a phone),
  clear of the player in the middle; `body.panel-open` hides it, `data-state` approach (calm blue, before the line: APPROACHING THE WORLD EDGE,
  the distance to it in the big slot, no bar) / count / warn / danger / clear (the 2.4 s all-clear). `updateWorldEdgeCue()` runs from `updateHud()`; the countdown itself runs in
  `update()` (play mode only). Console `worldEdge()` (its `rect` gives the card's pixel box).
- Reduced motion cuts slides and pop-ins (src/ui/reduced-motion.css).
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
