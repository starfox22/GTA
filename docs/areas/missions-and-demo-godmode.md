# God mode and skipping a ride

Split out of missions-and-demo.md (mission list, campaign, the public demo). God mode lifts the
demo's gates (`demoLocked`); a god-mode pick of a job is a free choice that the story index
keeps until god mode is switched off (`settleDemoStoryIndex`).

## God mode (the `godmode` cheat; god-panel.js)

- Typed in play, on the city map or on the title (game-input.js cheat ring): `GODMODE` or
  `AAAAXBBBBYXXXXAYYYYB`, either case (modifier keys are ignored, not a break). A code eats its
  keys from its second letter on (`CHEAT_SWALLOW_FROM`), the long one only from its X so the A
  taps still steer (tools/tests/god-mode-codes.mjs presses real keys). It unlocks every
  job (`missionUnlocked`) and opens Settings on the GOD MODE tab (`syncGodSettingsTab` adds
  `'god'` to `SETTINGS_TABS` only while `player.godMode`).
- Rows: mission select, time presets and 24 h slider (`setGodTime`), freeze
  (`godTimeFrozen()`, asked by citylife.js before advancing `worldMinutes`), weather
  (`setGodWeather`), refill (`godRefill`), lose police (`godLosePolice`: also marks the
  player's crowd incidents reported so a call in progress does not re-raise a star, and ends
  the Fort Sentinel alarm), teleport (map pick mode: `#mapOverlay.god-pick` gives the canvas the
  whole panel, the hint banner floats over its top edge and the side list, filters, legend and route
  tools step aside; `godMapToggled` refits the canvas pixels after the class change; the wheel zooms
  about the cursor, `zoomMap(factor, at)`), drawbridges (god-drawbridges.js: chips ALL and one per
  drawbridge, RAISE NOW through `drawbridgeOpenNow` (bells, gates, the span cleared, then the
  swing: never a jump), LOWER through `drawbridgeCloseNow`; the label lists what each is doing).
- `godTeleport(x, y)` is the safe move: nearest walkable spot (not a loose mountain face
  steeper than `SLIP_GRADE`, where the body would slide off), a boat spawned on open water,
  the current road vehicle placed on the nearest lane where `canSpawnCar` passes, aircraft
  kept airborne; then `teleportPlayer`, camera snap, crowd resettle, a second's grace.
- Console: `god(on)`, `godPanel()`, `godTeleport(x, y)`, `godRefill()`, `godLosePolice()`,
  `godFreeze(on)`, `godDrawbridges(action, pick)`, `godDrawbridgePanel(close)` (opens the tab on
  the drawbridge row and returns its chips' and buttons' screen centres; tools/tests/god-drawbridges.mjs).

## Skip the ride (ride-skip.js)

- A passenger skips a cab, train or the liner with `skipRide` (Y): refused when wanted, in a
  timed job, in a hurt cab or without the fare. The screen fades, `catchUpWorld` steps the
  clock by the ride's own seconds (weather, trains, liner), the ride is placed at its end
  (`placeCabAtKerb`, `placeTrainAtPlatform`, `placeLinerAtAnchor`). Wanted state is never
  touched; the effects bus ducks. Console `skipRide()`, `skipStop()`, `rideSkip()`.
