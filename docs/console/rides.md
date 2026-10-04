# Console: rides

`addConsoleMethods('rides', …)` in `src/game-console-rides.js`. Passenger rides: bike share, cabs, trains, the liner, the ride skip, the superyacht.

| Method | Purpose |
| --- | --- |
| `cab(x, y)` | Put a cab at the kerb and, given a point, ride it there (returns riding, fare, stops) |
| `boardTrain(from, to)` | Board a City Rail train at station `from` for `to` (names as in `RAIL_STATIONS`, or indices), as the platform menu would |
| `skipRide()`, `skipStop()`, `rideSkip()` | Skip the ride as the skip key (Y) would: cab, train or the liner under way (the jump happens at full black; `simulate(2.5)` runs the fade through); on a train move the skip to the next stop choice (U); the report: the offer (prompt, allowed or why not, destination, fare, ride seconds, the train's choices), the fade in progress and the last skip (ride seconds, game clock before / after in minutes, cash before / after, from / to) |
| `trains()`, `advanceTrains(seconds)` | Train positions; run the railway forward (rides take minutes at headless frame rates) |
| `yacht()`, `boardYacht()` | Where the player stands aboard the superyacht; put them on her swim platform |
| `bikeShare()` | South Coast Cycle (cycles.js BIKE SHARE): every station, its docks and bikes, the prompt in reach, what renting and docking have cost |
| `bikeStation(id)` | Stand at bike-share station `id` (from `bikeShare().list`), facing its bikes |
| `liners()` | The sailing liner: where she is (`area`: the named waters, `LINER_PASSAGES`), her leg of the voyage (`call`: the anchorage's name at a call), speed (units/s and knots), heading, who is aboard |
| `advanceLiner(seconds)` | Run only the liner's voyage forward by `seconds` (1/30 s steps); returns `liners()` |
| `linerVoyageCheck(step)` | Sweep the liner's hull down the whole voyage (and round her swing at anchor) against land, bridges, jetties, ships, Monarch Harbour and the world edge (`problems` must be empty); each leg's length, seconds and top knots, `lapSeconds`/`lapMinutes`, the named waters in order (`passages`), `edgeMargin` (closest to the world-edge line) and `tight` (within 60 units of land) |
| `linerChart(cell, x0, y0, x1, y1)` | A sea chart for planning her route, one character a `cell` (default 256, the world box): `#` land, `=` bridge deck, `o` footing, `:` past the world-edge line, `.` sea, the legs by index, `@` the ship |

Group `decks` (deck-landing.js `deckLandingConsole`, registered by game-console-rides.js): parachute landings on the ships.

| Method | Purpose |
| --- | --- |
| `deckLanding(x, y)` | What deck is under the point (default the player: ship, level, deck name, height, ship-frame u/v, free to stand on), where the player stands aboard, swimming, the parachute stage, and the last deck landing (ship, deck, stage, descent and across-deck m/s, ship knots, outcome; `boat` for a splashdown beside one) |
| `deckJump(id, metres, u, v, open, heading, fall)` | Put the player `metres` above ship `id`'s deck (`'meridian'`, `'coraldawn'`, `'aurelia'`) at ship-frame (u, v): under a canopy already flying along `heading` (default hers), or with `open` false in freefall at `fall` m/s moving with her |
| `canopyOver(x, y, metres, heading)` | The same over any map point (a boat, the sea): a flying canopy `metres` above what is there |
