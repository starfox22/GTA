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
| `liners()` | The sailing liner: where she is, her leg of the voyage, speed (units/s and knots), heading, who is aboard |
| `advanceLiner(seconds)` | Run only the liner's voyage forward by `seconds` (1/30 s steps); returns `liners()` |
| `linerVoyageCheck(step)` | Sweep the liner's hull down the whole voyage against land, bridges, jetties and ships |
