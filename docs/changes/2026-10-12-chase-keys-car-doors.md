# Chase view keys after a switch; car doors that look like doors

- Chase view: a movement key held while V switches from the street view goes the new view's way at once, with the
  camera behind the run (it used to take the last chase view's old heading for a step and the camera followed it).
- Chase view: A, D or a diagonal held with the mouse still no longer runs in circles (the camera used to swing round
  after the sideways run, turning the run with it); the camera still eases behind a run along its own heading.
- Chase view: the cursor left by the screen's edge from the street view's aim no longer turns the camera before a click
  captures the pointer (edge look stays for pages that refuse the capture, and stops while the cursor is off the page).
- Car doors: an opened driver's door (carjack, getting in and out, a sprung door) is cut from the body's own side with
  its paint and livery, a door card inside and its window; the opening shows painted jambs and the cabin in its
  upholstery instead of a black bar. The carjack's door cracks open, swings out and bounces on its check strap, and is
  pulled shut behind the player; the player's own way in and out swings the door too.
- Internals: `chaseMoveYaw`/`chaseStartYaw` and `chaseCam.primed`, `CHASE_FOLLOW_ARC`, `chaseCam.cursorOut`
  (chase-camera.js); `vehicleDoor` / `doorTrimMaterial` (damage3d-bodies.js DOORS), `doorGlassGeometries`
  (damage3d-crumple.js); carjack3d.js DOOR SWING (`doorSidePane` leaves the side pane out while the door is open);
  `carTransition.door`. New test tools/tests/chase-move-keys.mjs.
