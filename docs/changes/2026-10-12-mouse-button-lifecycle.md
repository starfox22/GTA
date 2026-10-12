# Independent mouse buttons and focus cleanup

- Releasing the left mouse button no longer cancels a held right-button aim or vehicle
  secondary weapon; releasing the right button no longer stops held left-button fire.
  Releasing the middle button affects neither.
- Window blur and a hidden tab release both mouse buttons and keyboard state. Previously
  right-button aim, tank/APC machine guns or Apache rockets could remain held after switching
  away and returning without a mouse release reaching the game.
- Pause, help and map transitions clear both mouse buttons, matching the existing reset of
  primary fire when opening the pause/map overlays.
- `tools/tests/mouse-buttons.mjs` executes the actual mouse/focus listeners and menu functions
  with a small DOM fixture, covering simultaneous buttons, lost releases, play/help focus
  loss and the three menu transitions. It also runs in the normal regression suite.
- The rendered smoke now asserts fresh-profile FPS visibility, game start, actual keyboard
  movement on foot and in a known sedan, map open/close, and switching to chase view and back.
  It saves six screenshots and a `smoke.json` report, including failures. The vehicle is
  boarded by the documented console fixture; this check does not claim to test car theft.
