    // BEGIN SUBSYSTEM: src/game-console-rides.js — DeadEndCity console, rides: bike share, cab, trains, liner, ride skip, superyacht
    // Passenger rides: bike share, cabs, City Rail trains, the sailing liner, the ride skip
    // and the superyacht.
    addConsoleMethods('rides', {
      // South Coast Cycle (cycles.js BIKE SHARE): every station, its docks and
      // bikes, the prompt in reach, what renting and docking have cost.
      bikeShare: () => bikeShareReport(),
      // Stand at bike-share station `id` (from bikeShare().list), facing its bikes.
      bikeStation(id = 0) {
        return goToBikeStation(id);
      },
      // Every train on the network: where it is, how fast, and whether it carries the player.
      trains: () =>
        railTrains.map((t) => ({
          x: Math.round(t.x),
          y: Math.round(t.y),
          speed: Math.round(t.speed),
          passenger: !!t.passenger,
          target: t.passenger ? transitRide?.target.name : null,
        })),
      // Run the railway forward by `seconds` in 1/30 s steps: a ride takes minutes
      // of game time, which headless test browsers render at a few frames a second.
      advanceTrains(seconds = 10) {
        for (let t = 0; t < seconds; t += 1 / 30) updateTransit(1 / 30);
        return this.trains();
      },
      // The sailing liner: where she is, her leg of the voyage, speed (units/s
      // and knots) and heading, and who is aboard.
      liners: () => {
        const ship = sailingLiner(),
          leg = LINER_VOYAGE[linerVoyage.leg];
        return {
          name: ship.name,
          x: Math.round(ship.x),
          y: Math.round(ship.y),
          heading: Math.round((((ship.a * 180) / Math.PI) % 360 + 360) % 360),
          leg: linerVoyage.leg,
          kind: leg.kind,
          along: Math.round(linerVoyage.s),
          legLength: leg.kind === 'call' ? leg.seconds : Math.round(leg.length || 0),
          speed: Math.round(ship.speed * 10) / 10,
          knots: Math.round((Math.abs(ship.speed) / KNOTS) * 10) / 10,
          playerAboard: player.deck === ship,
          passengers: (ship.passengers || []).length,
        };
      },
      // Run only the liner's voyage forward by `seconds` (1/30 s steps).
      advanceLiner(seconds = 10) {
        for (let t = 0; t < seconds; t += 1 / 30) sailLiner(1 / 30);
        return this.liners();
      },
      // Sweep the liner's hull down the whole voyage: land, bridges, jetties, ships.
      linerVoyageCheck: (step = 24) => linerVoyageCheck(step),
      // Board a City Rail train at station `from` bound for `to` (names, as
      // RAIL_STATIONS spells them, or indices), as the platform menu would.
      boardTrain(from = 'CRUISE TERMINAL', to = 'SOUTHPORT AIRPORT') {
        const find = (k) => (typeof k === 'number' ? RAIL_STATIONS[k] : RAIL_STATIONS.find((s) => s.name === String(k).toUpperCase()));
        const a = find(from),
          b = find(to);
        if (!a || !b || a === b) throw Error('Unknown or identical stations');
        teleportPlayer(a.entry.x, a.entry.y);
        openTransit(a);
        return { boarded: boardTransit(b), from: a.name, to: b.name, trains: this.trains() };
      },
      // Skip the current passenger ride (cab, train, the sailing liner) as the
      // skip key would: the fade starts, and the jump happens at full black
      // (simulate(2.5) runs it through). Returns rideSkip().
      skipRide() {
        rideSkipKey('skip');
        return rideSkipReport();
      },
      // On a train: move the skip to the next choice of stop (the skipStop key).
      skipStop() {
        rideSkipKey('cycle');
        return rideSkipReport();
      },
      // The skip on offer (prompt, allowed or why not, destination, fare, ride
      // seconds, the train's choices), the fade in progress, and the last skip:
      // ride seconds, game clock before / after, cash before / after, from / to.
      rideSkip: () => rideSkipReport(),
      // Put a cab at the kerb and ride it somewhere, without hunting for one.
      cab(x, y) {
        const car = spawnClearCar('taxi', player.x + 44, player.y, 0, true);
        assignDriver(car);
        if (x === undefined) return this.status();
        startTaxiRide(car, { x, y });
        return { riding: !!taxiRide, fare: taxiRide?.fare ?? null, stops: taxiRide?.route.length ?? 0 };
      },
      // Where the player stands aboard the superyacht (null when not aboard), and a
      // shortcut onto her swim platform so tests can go straight to the decks.
      yacht: () => superyachtDeckState(),
      boardYacht() {
        teleportPlayer(SUPERYACHT.board.x, SUPERYACHT.board.y);
        boardLiner(SUPERYACHT);
        return superyachtDeckState();
      },
    });
    // END SUBSYSTEM: src/game-console-rides.js
