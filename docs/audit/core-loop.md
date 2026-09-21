# Audit report: core loop, input, UI, mobile, radio, garages, audio

## Fixed
- game.js `exitCar()`: soft-lock inside a destroyed vehicle. When the player's car died and no clear
  exit spot existed nearby, the player stayed seated in an uncontrollable wreck forever. Now an outward
  search (rings up to 1200 units) always finds a free spot for a dead vehicle.
- game.js `exitCar()`: `speed *= 0.45` was a no-op because physics recomputes speed from vx/vy.
  Velocity components are now scaled too.
- game.js `die()`: `player.car.speed = 0` likewise did nothing; vx/vy/av are zeroed.
- game.js canvas mousemove: browsers dispatch compatibility mouse events after touch taps, which
  switched aiming to a stale mouse position. Guarded like mousedown already was.
- mobile.js `syncTouchInput()`: the touch overlay never refreshed when the mode changed outside play,
  so it stayed visible on the death screen. Refreshes on every mode change.
- mobile.js touch buttons: reload/weapon/etc. fired outside play mode. Added a mode guard.

## Noted, not changed
- keydown prevents default for Space/Arrows/Tab in every mode (Tab is the map key by design).
- `die()` respawn lets the camera fly from the death site to the hospital (cosmetic).
- `resize()` truncates fractional device pixel sizes by up to 1 px.
- A player's own crash killing their own car counts as a crime (design question).
- `reloadSound()` uses setTimeout so late clicks can play after a pause.
