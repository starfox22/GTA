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
  chaseSees, chaseAimPoint), drawn by chase-view3d.js; docs/areas/chase-view.md and chase-view-input.md.
- Console: `viewMode`, `chaseCamera`, `chaseLook`, `chaseProject`; `settings({ cameraView, lookSensitivity,
  invertLook })`. Tests: chase-input, chase-walk, chase-view-mode.
