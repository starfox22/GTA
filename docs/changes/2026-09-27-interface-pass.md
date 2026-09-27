# Interface pass: notifications, device-aware hints, gamepad, city map
- Notifications stack instead of overwriting each other: newest on top, older ones dimmed
  below, at most three (two on a phone), each up long enough to read, with a colour edge
  for police, warnings and rewards and a thin timer bar; a repeated line refreshes itself.
- Hints name the control you are using: on a touch screen the on-screen button (TAP
  ACTION, GAS, EXIT), with a gamepad its button (PRESS A, RT); radio chips drop key caps.
- Gamepad support (standard layout): drive, walk, aim with the right stick, fire with RT,
  menus by D-pad / A / B, the city map by stick and triggers with A to set a route.
- City map: filter chips for every kind of marker, a GO TO list of the nearest hospital,
  respray, armory, shops, rail and pastimes (a tap sets the route), sharp on HiDPI and
  phones, larger on big screens; Midtown, South Bank, Ironworks Docks, Old Quarter and Art
  Deco are named, and names no longer print over each other.
- Minimap pulls back at speed and points an arrow at an off-map job or waypoint.
- Phones: the car radio no longer unfolds mid-screen on getting in (the chip flashes; a tap
  opens it). Speech and 911 bubbles are a size larger (the call bold).
- New console methods: `inputHints`, `gamepadFeed`, `notices`, `mapView` (settings group).
