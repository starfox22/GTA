# Look around from the Sunset Eye and the Falcon
- On the Sunset Eye and the Falcon, moving the mouse turns your head: the pointer at the centre of the screen
  looks ahead, towards the sides the head turns up to 120 degrees, up 50 and down 60, eased and smoothed like a
  head. No click needed. Touch: drag to look (it stays where you leave it). Gamepad: the right stick, back to
  forward when let go. A hint says so a couple of seconds into each ride.
- The seat views (the Eye's capsule, the Falcon's front seat) turn as a head about the seat's own up, so on the
  coaster the head turns with the car through the loops; the Eye's capsule no longer pans by itself. The chase,
  trackside and outside views turn half as far. Boarding, leaving and E (change view) face forward again.
- Internals: src/ride-look.js (`updateRideLook`, `rideLookAngles` read by `updateParkCamera`); the pointer is read
  on the window so the HUD never freezes the look; `gamepad.lookX/lookY` carry the right stick; the ride camera no
  longer allocates vectors per frame.
- Console: `DeadEndCity.rideLook()`; test tools/tests/ride-look.mjs.
