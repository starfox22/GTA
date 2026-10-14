# HUD: layout, maps, prompts and notifications

## HUD (hud.js, src/ui/hud.html, src/ui/hud-top.css + hud-bottom.css)

- Layout: location top left; cash, stars and clock top right; waypoint pill top centre;
  minimap with health and armour, mission card and equipment column along the bottom (moved
  to the top in touch mode). Radio and weapon boxes are `.hud-pop` chips opened by
  `hudPop(id)` or hover; in touch mode only by `hudPop` (a tap), since a tapped box keeps
  `:hover` / `:focus-within` long after its pop ends (touch-hud.css).
- Touch dispatch captions sit below the measured mission card and waypoint (`--touch-dispatch-top`,
  `measureMissionCard`). Switching touch mode invalidates the old clearance boxes immediately.
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
- Car radio in touch mode (phones and tablets) and in the chase view: `hudPop('carRadio')` only
  flashes the chip; it opens on a tap, hover or click (the old 4 s pop on getting in covered the
  road and the toasts on a phone, the GAS / BRAKE buttons on a tablet, the road ahead in the chase
  view). On short windows (<= 720 px tall, not touch) it stands on the
  equipment column and opens upward (radio.css).
- **Mission card clearance** (hud-clearance.js): the card never covers the player. `hudPlayerBox`
  projects the vehicle (footprint and roof) or person through the street camera; while the open card
  would come within 18 px, `missionCardFolded` shows the strip and holds `missionCardUntil` (and
  `incomingCallRemaining`) until the spot is clear for 0.6 s; opened on purpose (`missionCardAsked`: O,
  a tap) it stays open. `.yield-fade` (folded strip, dialogue line, waypoint pill) only when one of them
  would still cover the player. Boxes are read in `measureMissionCard` (runFrame start, beside the dock
  line). Console `hudClearance()`, `hudOverlaps()` (HUD boxes that overlap each other or the player);
  tools/tests/hud-clearance.mjs, hud-layout.mjs (960x600 at zero overlaps, keyboard and touch).
  **In the chase view** `hudPlayerBox` is the eight corners of the player's box (0.8 m wide on foot,
  the vehicle's footprint and height, aircraft and parachute included) through the chase camera
  (chase-rules.js `chasePlayerBox`; a corner behind the near plane counts as on it); tools/tests/
  chase-hud-box.mjs. The chase camera stands the player bottom centre (on foot about x 316-477, y
  263-598 at 960x600), right where the bottom-centre card and strip sit: there the card always folds
  and the strip fades, so the chase view wants the card elsewhere (open item).
- Narrow windows (<= 980 px): the notices start under the waypoint pill (116 px) and stop short of
  the centre (`calc(50vw - 150px)`). The dispatch / radio caption (`#radioCaption`, top centre) is never
  wider than the space between the notices' column and the right edge's mirror: a long line wraps.
- Speed box (`#vehicleStats`): one readout for every way of moving; on foot the movement
  state and measured pace (`trackPlayerPace`). **Every printed speed goes through
  `speedReading` / `speedText` / `kmhReading`** (km/h or mph setting); boats keep knots,
  distances stay metric. Console `speedBox()`.
- Flight HUD (`#flightHud`, `updateFlightHud` from `flightData()`): instruments hug the
  screen edges; warnings (STALL, PULL UP, GEAR) always show even with the instruments off.
- Open-sea card (`#worldEdgeCue`, world-edge.js, src/ui/world-edge.css; same pattern as
  `#freefallCue`): RETURN TO THE CITY, the seconds left as a big number (10..0), the distance to the
  nearest land, the compass word and an arrow turned toward that land (`--we-turn`, north up the
  screen), a time bar. Top centre under the flight heading strip (178 px; 140 on a phone), clear of
  the player in the middle; `body.panel-open` hides it. `data-state` count / warn / danger / back
  (calm blue: HEADING BACK, the seconds winding up) / missile (MISSILE INBOUND, a red "!", no bar or
  arrow) / clear (the 2.4 s all-clear). The card never names the map's edge. `updateWorldEdgeCue()` runs
  from `updateHud()`; the clock runs in `update()` (play mode only). Console `worldEdge()` (its `rect`
  gives the card's pixel box).
- Reduced motion cuts slides and pop-ins (src/ui/reduced-motion.css).
- Console `promptState()` reports the prompt.
