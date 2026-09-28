# Rider falls by speed, wheelies

- Coming off a motorbike or bicycle now hurts by the speed: a spill under 20 km/h is a
  stumble and a roll for a few points, 40 km/h about a tenth of your health, 70 km/h about a
  third, and a very bad one knocks you out for several seconds; hitting a wall or a van's side
  at 75 km/h or more is fatal. The rider tumbles over and over along the road before sliding
  to a stop, then gets up.
- A fall you survive leaves no blood on the road; only a rider it kills bleeds (and pools).
- Wheelies: hold the throttle and the climb key (W + ↑; the pad's stick up with the trigger)
  on a motorbike or bicycle. The front lifts at the pace the engine allows, the bike steers
  only by leaning while it is up, the throttle alone lets it settle, off the throttle it drops
  onto the fork with a small bounce, the brake brings it down at once. Held past the balance
  point it loops and you fall off the back. The cruiser barely lifts; ↑ alone is still only
  the throttle for riders on the arrows. The HUD strip shows W+↑ WHEELIE on a bike.
- Internals: falls-body.js `riderInjury()` beside `fallInjury()`; wheelie.js (`c.wheelie`,
  read by motorbikes3d / cycles3d); controls.js `wheelieHeld()`, `ascend` in `drive` with
  `overrideCtx`. Console: `wheelieState()`, `rideIntoWall()`; `riderReport()` gains blood,
  strike and knock-out fields. Tests: rider-falls, wheelie.
