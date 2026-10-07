# Crash damage and bullet holes that stay on the car
- Bullet holes, glass stars and scrapes sit on the panel they hit and stay on it: they move with the car, with a
  crumple, a sprung hood or door, and go with a part torn off; a hole is never left in the air, never on the glass,
  and a star is always on its own pane. In the chase view holes are drawn at a real size (a few centimetres).
- Crashed cars bend as one piece: the shell, glass, roof panel and pillars, lamps, grille and trim, the cabin inside,
  the hood, bumpers and wheels all follow the same crumple, so lamps no longer float, the glass stays in its frame and
  wheels move with their arches. The crush is smooth with creases and a wavy front (no more spiky metal), stops at the
  firewall, behind the rear glass and ~0.4 m into a side, and never reaches the cabin's middle.
- A rollover that lands on the roof or a side crushes that face (the roof comes down, within limits).
- Hoods buckle into a ridge and lift off the latch instead of swinging wide open; sprung doors are cut from the car's
  own side (curve, paint and livery); a bumper hanging by one bracket turns about it and stops at the road.
- Internals: `crumpleField` / `crumpleLimits` (damage-crumple.js) is the one crumple rule; damage3d-crumple.js bends
  every body part with it in ~3 ms slices a frame; damage3d-marks.js pins marks to triangles. New console methods
  `dentVehicle`, `shootVehicle`, `crumpleAudit`, `vehicleDamageShape`; tools/tests/vehicle-damage-shape.mjs.
