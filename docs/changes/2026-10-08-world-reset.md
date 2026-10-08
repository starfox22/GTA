# The world resets on death and a new mission
- WASTED, a pick in the mission picker, RESTART CURRENT JOB, a taken job call and a new game put the city back as it
  was at boot: wrecks, burnt and dented cars, bonnet blood, bodies, blood pools, severed parts, fires, scorch, skid
  marks, knocked lamps, hydrants and trees, shattered shop windows, blown upper windows, wall chips and rubble are gone;
  parked cars, boats and the motor pool stand on their spots again; police, witnesses and panicked crowds are cleared.
- The new scene fades in from black (under the HUD), so nothing pops on screen.
- Kept: cash, weapons and ammo, armour, the story and contracts, stats, bets, settings, the clock and weather, the
  dealership's owned cars (back repaired in their bays).
- Internals: world-reset.js `resetWorld(reason)` and `populateWorld()` (the boot seed replayed); helpers next to their
  state (`resetWreckPass`, `restoreAllStreetProps`, `resetCrowdLife`, `clearBleeders`, `dealershipWorldReset`); the
  renderer clears its decals, panes and debris when `worldResetSerial` changes (damage3d-world.js `clearWorldDamage`).
- Console `worldResetReport()`; tools/tests/world-reset.mjs.
