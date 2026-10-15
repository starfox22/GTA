# Input and timed travel across menus and focus changes

`mouse.down` is left fire; `mouse.alt` is right aim/secondary fire. Releasing one
physical button must not release the other. Focus loss clears both physical and
virtual controls. A successful transition that clears gameplay input must clear
both buttons: arsenal open/close, demo/mission cards, dialogue, Blue Hour lift,
settings, services, transit, taxi offer, sportsbook and dealer menu, as well as
the existing pause/help/map, skyline lift and Fort records transitions.
Otherwise a missed mouseup during the transition can leave aiming or an aircraft
secondary weapon held after returning. Rejected entries leave active input alone.
Keep `mouse.alt` as the field; adding a second aim flag would split the readers.

`runFrame` runs roof/skyline lifts and the Fort records search outside the ordinary
play update because they own `gameMode === 'elevator'`. They must not complete
into `play` while the document is hidden or the window lacks focus. Only their
**live** frame-clock updates wait for visibility/focus and a usable graphics context; camera/casino phases keep
their existing behavior, and explicit developer-stepped frames still advance
travel. This avoids resuming danger in another tab without adding another clock
or changing the travel durations. The ordinary play-mode blur/visibility pause
remains in `game-input.js`.

WASTED/BUSTED completion uses a 4.2-second timeout, so focus can be lost while
`gameMode` is `dead` and there is no play mode to pause yet. After the normal
respawn/reset/save, each callback opens the existing pause menu if still hidden
or unfocused. Costs, ammo confiscation, mission failure, reset timing and the
stale-callback guard stay intact. A focused respawn returns directly to play.

Graphics-context loss and the subsequent recovery/reload delay also block live
simulation and travel. `togglePause` cannot resume during either state. Recovery
keeps an existing pause, and catches a deferred respawn that has reached play;
its normal save/reload policy remains in `gpu-context.js`. Explicit developer
steps remain available, while the next live frame pauses any stepped play state.
This policy prevents an invisible death or mission failure during recovery.

Production-function host checks:

- `modal-pointer-lifecycle`: all 13 affected successful transitions, rejected-entry
  guards, key release and unchanged mission/health/cash.
- `travel-focus-pause`: actual roof/sky/records completion functions, hidden and
  unfocused live timers, focus return, held live frames and explicit steps.
- `respawn-focus-pause`: actual death/arrest entry, deferred callbacks and pause
  function, with/without a mission, focused/hidden/blurred return and stale timeout.
- `gpu-context-lifecycle`: actual loss/restore, pause and frame dispatch, travel
  and deferred death/arrest completions, healthy frames and explicit stepping.
  `gpu-context` checks actual WebGL loss/recovery and rejected resume attempts.
- Existing `mouse-buttons` and `mission-modal-input` retain the independent
  mouseup and lift/records contracts. Run browser input/smoke checks too;
  these host fixtures do not claim a rendered or real-window focus test.
