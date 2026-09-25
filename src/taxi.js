    // BEGIN SUBSYSTEM: src/taxi.js — Yellow cabs
    /**
     * Yellow cabs
     * Source: src/taxi.js
     * Scope: shared game closure.
     * Hailing a cab, choosing a destination on the map, the ride itself, and the
     * hijack that is always the other option.
     */
    /**
     * CABS
     * A taxi with a driver in it is the one vehicle you can use without stealing:
     * the action key offers the ride or the hijack. Take the ride and the city map
     * opens to pick a drop-off, the cab routes there on the shared road graph, and
     * the player rides as a passenger -- pinned to the cab rather than driving it,
     * the same way a train ride works. Press E at any point to get out.
     */
    let taxiRide = null,
      taxiOffer = null,
      taxiPicking = null;
    const TAXI_BASE_FARE = 14,
      TAXI_PER_BLOCK = 4,
      // A brisk cab through town: about 65 km/h.
      TAXI_SPEED = 65 * KMH;
    const TAXI_SMALLTALK = [
      'Traffic was murder on the causeway today.',
      'You see the liner come in this morning?',
      'Twenty-two years driving. Never once gone north of the point.',
      'Neon 88.7 alright with you?',
      'Hang on, taking the quay. It is quicker.',
      'Rain later, they say. They always say.',
      'Everybody wants the tower district now.',
    ];
    function isTaxi(vehicle) {
      return !!vehicle && vehicle.type === 'taxi';
    }
    function hailableTaxi() {
      if (player.car || playerOnRoof() || player.deck || player.parachute || transitRide) return null;
      if (taxiRide) return null;
      const c = nearestCar();
      return isTaxi(c) && c.occupied && c.hp > 0 && !vehicleIsLocked(c) ? c : null;
    }
    function taxiFare(from, to) {
      return Math.round(TAXI_BASE_FARE + (distanceBetween(from, to) / BLOCK_SIZE) * TAXI_PER_BLOCK);
    }
    function openTaxiOffer(car) {
      taxiOffer = car;
      gameMode = 'taxi';
      keys = {};
      mouse.down = false;
      getElement('taxiText').textContent =
        wantedStars > 0
          ? 'The driver has the radio on and both hands on the wheel. She is not taking you anywhere.'
          : 'The driver leans across and winds the window down. Where to?';
      const list = getElement('taxiActions');
      list.replaceChildren();
      const option = (text, fn) => {
        const b = document.createElement('button');
        b.className = 'secondary service-option';
        b.textContent = text;
        b.onclick = fn;
        list.appendChild(b);
      };
      if (wantedStars === 0) option('RIDE · CHOOSE A DESTINATION ON THE MAP', beginTaxiPick);
      option('HIJACK · PULL THE DRIVER OUT', () => {
        const car = taxiOffer;
        closeTaxiOffer();
        if (!car) return;
        ejectDriver(car, 'hijack');
        crime(0.8);
        enterVehicle(car);
      });
      getElement('taxiOverlay').classList.remove('hidden');
      getElement('closeTaxi').focus();
    }
    function closeTaxiOffer() {
      taxiOffer = null;
      getElement('taxiOverlay').classList.add('hidden');
      if (gameMode === 'taxi') gameMode = 'play';
      keys = {};
      canvas.focus();
    }
    function beginTaxiPick() {
      const car = taxiOffer;
      closeTaxiOffer();
      if (!car) return;
      taxiPicking = car;
      if (!mapOpen) toggleMap();
      tell('Pick your drop-off on the map.', 4);
    }
    function taxiMapPick(x, y) {
      const car = taxiPicking;
      if (!car) return false;
      if (!groundAt(x, y, 8) || !navigationGraph().length) {
        tell('The driver shakes her head. Pick somewhere on the road.', 3);
        return true;
      }
      taxiPicking = null;
      if (mapOpen) toggleMap();
      startTaxiRide(car, { x, y });
      return true;
    }
    function cancelTaxiPick() {
      taxiPicking = null;
    }
    function startTaxiRide(car, destination) {
      if (!car || car.hp <= 0) return;
      const nodes = navigationGraph(),
        route = navShortestPath(nodes, closestNavNode(car, nodes), closestNavNode(destination, nodes));
      if (route.length < 2) {
        tell('No road runs there. The driver pulls away.', 3.5);
        return;
      }
      if (navSegmentClear(route[route.length - 1], destination)) route.push({ ...destination });
      const fare = taxiFare(car, destination);
      taxiRide = {
        car,
        route,
        index: 1,
        fare,
        destination,
        chat: randomBetween(4, 9),
      };
      car.ai = false;
      car.cop = false;
      car.junction = null;
      car.navAngle = undefined;
      car.taxiHire = true;
      car.speed = 0;
      player.inv = Math.max(player.inv, 0.5);
      tell('FARE $' + fare + ' · ' + Math.round(worldMeters(routeLength(route))) + ' m · E to get out', 5);
    }
    function routeLength(route) {
      let total = 0;
      for (let i = 1; i < route.length; i++) total += distanceBetween(route[i - 1], route[i]);
      return total;
    }
    function endTaxiRide(paid) {
      const ride = taxiRide;
      if (!ride) return;
      taxiRide = null;
      const car = ride.car;
      car.taxiHire = false;
      car.speed = 0;
      if (car.hp > 0) {
        assignDriver(car);
        car.ai = true;
      }
      // Step out on the kerb side rather than into the traffic lane.
      for (const side of [1, -1, 0]) {
        const x = car.x - Math.sin(car.a) * side * 40,
          y = car.y + Math.cos(car.a) * side * 40;
        if (!solid(x, y, 8)) {
          player.x = x;
          player.y = y;
          break;
        }
      }
      player.altitude = terrainHeight(player.x, player.y);
      player.inv = Math.max(player.inv, 0.6);
      // A skipped ride (ride-skip.js) was paid for under the fade.
      if (paid && !ride.prepaid) {
        const due = Math.min(cash, ride.fare);
        cash -= due;
        tell(
          due < ride.fare
            ? 'You hand over everything you have. "Next time, bring the fare."'
            : 'FARE PAID · $' + ride.fare,
          3.5,
        );
      }
    }
    function updateTaxiRide(deltaSeconds) {
      const ride = taxiRide;
      if (!ride) return;
      const car = ride.car;
      if (car.hp <= 0) {
        taxiRide = null;
        player.altitude = terrainHeight(player.x, player.y);
        tell('The cab is wrecked. You climb out.', 3);
        return;
      }
      const node = ride.route[ride.index];
      if (!node) {
        // After a skip the cab waits at the kerb until the picture is back.
        if (ride.arrival > 0) {
          ride.arrival -= deltaSeconds;
          car.speed = ride.speed = 0;
          player.x = car.x;
          player.y = car.y;
          player.a = car.a;
          player.altitude = (car.groundHeight || 0) + 4;
          return;
        }
        endTaxiRide(true);
        // A skipped ride's arrival card already said where and what it cost.
        if (!ride.prepaid) tell('"That is you. Mind how you go."', 3);
        return;
      }
      // Aim for the right-hand lane rather than the centre line the graph uses.
      // (-sin, +cos) is the kerb side for a heading, the same convention the
      // traffic controller in physics.js drives by.
      const along = headingBetween(ride.route[ride.index - 1] || car, node),
        lane = ride.index + 1 < ride.route.length ? 24 : 0,
        target = {
          x: node.x - Math.sin(along) * lane,
          y: node.y + Math.cos(along) * lane,
        };
      const distance = distanceBetween(car, target),
        remaining = ride.route.length - ride.index,
        // Ease off into the final stop and through tight corners.
        cruise = Math.min(TAXI_SPEED, remaining < 2 ? Math.sqrt(distance * 2 * 2.5 * UNITS_PER_METRE) + 8 : TAXI_SPEED),
        blocked = taxiPathBlocked(ride, deltaSeconds),
        desired = blocked ? 0 : Math.min(cruise, Math.sqrt(Math.max(0, distance) * 220) + 26);
      // The cab's pace lives on the ride: the physics step recomputes car.speed
      // from vx/vy (zero for a car driven along its route like this) before this
      // runs, so accumulating on car.speed left the cab crawling at ~6 units/s.
      ride.speed = Math.max(0, (ride.speed || 0) + clamp(desired - (ride.speed || 0), -0.5 * GRAVITY * deltaSeconds, 0.28 * GRAVITY * deltaSeconds));
      car.speed = ride.speed;
      const heading = headingBetween(car, target),
        turn = normalizeAngle(heading - car.a);
      car.a += clamp(turn, -3.2 * deltaSeconds, 3.2 * deltaSeconds);
      const step = Math.min(distance, car.speed * deltaSeconds);
      car.x += Math.cos(car.a) * step;
      car.y += Math.sin(car.a) * step;
      if (distance < Math.max(6, step + 1)) ride.index++;
      player.x = car.x;
      player.y = car.y;
      player.a = car.a;
      player.altitude = (car.groundHeight || 0) + 4;
      cameraTarget.x = car.x;
      cameraTarget.y = car.y;
      ride.chat -= deltaSeconds;
      if (ride.chat <= 0) {
        ride.chat = randomBetween(9, 20);
        tell(randomChoice(TAXI_SMALLTALK), 3.4);
      }
      if (wantedStars >= 2) {
        endTaxiRide(false);
        tell('"Out. Out! I am not doing this."', 4);
      }
    }
    /**
     * The hired cab is driven along its route rather than through the physics
     * solver, so it checks its own road ahead: it holds for traffic and for
     * anyone in the carriageway, scatters pedestrians with the horn, and if it
     * has been stuck long enough to be properly wedged it gives up on the
     * current node and aims at the next one.
     */
    function taxiPathBlocked(ride, deltaSeconds) {
      const car = ride.car,
        ahead = {
          x: car.x + Math.cos(car.a) * 62,
          y: car.y + Math.sin(car.a) * 62,
        };
      let blocked = solid(ahead.x, ahead.y, 14);
      if (!blocked)
        blocked = vehicles.some(
          (o) => o !== car && o.hp > 0 && !isAircraft(o) && distanceBetween(o, ahead) < 46,
        );
      // The crowd's neighbour grid, not all ~650 pedestrians every frame.
      forEachPedestrianNear(ahead.x, ahead.y, 40, (p) => {
        if (p.hp > 0 && distanceBetween(p, ahead) < 40) {
          blocked = true;
          p.flee = Math.max(p.flee, 1.4);
          p.a = headingBetween(car, p);
        }
      });
      ride.stuck = blocked ? (ride.stuck || 0) + deltaSeconds : 0;
      if (ride.stuck > 5) {
        ride.stuck = 0;
        ride.index = Math.min(ride.index + 1, ride.route.length);
        return false;
      }
      return blocked;
    }
    function taxiInteract() {
      if (taxiRide) {
        endTaxiRide(true);
        return true;
      }
      const car = hailableTaxi();
      if (!car) return false;
      openTaxiOffer(car);
      return true;
    }
    // END SUBSYSTEM: src/taxi.js
