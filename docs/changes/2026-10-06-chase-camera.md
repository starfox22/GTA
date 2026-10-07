# Chase camera: a third-person view behind the player
- V switches between the overhead street view and a new CHASE view at street level behind the player,
  the way GTA IV frames it (R3 on a pad; Settings · Gameplay · Camera view; the choice is saved).
- On foot the mouse looks round (click the game to capture it; Escape lets it go), the movement keys walk
  where the camera looks, and the right button (LT) aims over the shoulder at the reticle, which turns red
  over a target. In a vehicle the camera swings in behind and follows through corners, widening a little
  with speed; looking round eases back behind after a moment. Getting in or out slides smoothly.
- The camera never passes through buildings or below the ground; Motion comfort keeps its lens and boom
  steady. Pads turn it with the right stick, touch screens with the aim stick or a drag.
- Settings · Gameplay: Look sensitivity and Invert look. Mission 11's divert moved from V to C.
- Internals: the camera is game state with its own projection (chase-camera.js: chaseProject, chaseRay,
  chaseSees, chaseAimPoint), drawn by chase-view3d.js (draw distance by tier, frustum-culled cells,
  shadows fitted to the near view with a depth fade); docs/areas/chase-view.md.
- Console: `viewMode`, `chaseCamera`, `chaseLook`, `chaseProject`; `settings({ cameraView, lookSensitivity,
  invertLook })`. Tests: chase-input.
- Lock-on (Settings · Gameplay · Aim assist, on by default): aiming with a gunman near the reticle turns the
  camera onto him and holds it; a move of the mouse or the stick breaks it. Console `gunmanAt(x, y)`; test
  chase-lock.
- C held in a vehicle looks behind it in the chase camera (Settings · Controls · Look behind).
- Camera motion blur in the chase view on HIGH and ULTRA (Settings · Graphics · Motion blur; off with Motion
  comfort): the street smears with the camera's own motion while the player and their car stay sharp.
  Test chase-motion-blur.
- Backed against a wall, the chase camera cranes up over the player's head instead of filling the screen with it
  (test chase-crane).
- In the chase view the car radio only flashes its station chip on getting in or a new station (as on touch
  screens), instead of opening over the road ahead; hover or a click still opens it (test chase-radio-chip).
