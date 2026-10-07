# The chase view: input

How the player looks round and moves in the CHASE view (chase-view.md has the camera itself, drawing it
and its game rules).

## Look and move (chase-camera.js, game-input.js, gamepad.js, mobile.js, world-view.js)

- Mouse: a click on the game captures the pointer (pointer lock; that click fires nothing); the mouse
  then turns the camera (`chaseLook`, Settings · Gameplay · Look sensitivity and Invert look) and
  `mouse.x/y` sit on the reticle for every reader. Escape, any menu or the map lets it go; resuming
  from the pause menu asks again (`captureChasePointer(true)`, a soft request that may be refused).
  CURSOR LOOK: a page that cannot capture the pointer (an embedding frame without the permission:
  `pointerlockerror` after a click) keeps the cursor: the aim is the cursor and the camera turns while
  it stands in a band along the screen's edges.
- LOOK BEHIND (C held in a vehicle, `lookBehind`): the view cuts round to the back of the vehicle and back
  on release (a cut, not a swing: a fast pan is the harder motion on the eye).
- Pad: the right stick turns the camera (`chaseStick`, `updateStickLook`) instead of aiming, LT aims
  over the shoulder on foot (`gamepad.aimHeld`; a gentle stick push still walks), R3 switches the
  view. Touch: the aim stick turns the camera and fires past two thirds of its throw (CHASE TOUCH); a
  one-finger drag on the game looks round. The wheel and the zoom keys move the boom (`chaseZoom`).
- The movement keys walk along the camera's heading (`chaseMoveHeading`, used by game-update.js and
  footwork.js `playerMoveHeading`); the street view keeps its screen-up keys, bit for bit.
