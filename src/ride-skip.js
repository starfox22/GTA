    // BEGIN SUBSYSTEM: src/ride-skip.js — Skip the ride
    /**
     * Skip the ride
     * Source: src/ride-skip.js
     * Scope: shared game closure.
     * Passenger rides at real speeds take minutes; this is the GTA-style way past
     * them: fade to black, move the clock and the world on, arrive, fade back.
     */
    /**
     * SKIP THE RIDE
     * Offered (hud.js prompt, `skipRide` action, Y by default) while the player
     * rides as a passenger:
     *   TAXI   with a drop-off set: SKIP RIDE · $fare. The cab is put at the
     *          drop-off kerb facing along the road and the full fare is paid
     *          under the fade (no surcharge). Not with any wanted level, not in a
     *          cab that is badly damaged or burning, not without the fare in
     *          cash, not while a timed job's clock runs.
     *   TRAIN  SKIP TO <station>: the destination bought at the platform, or,
     *          with `skipStop` (U), any call on the way. The train is stood at
     *          that platform (its path and index set as if it had run there) and
     *          the passenger gets off as on any arrival. City rail is free.
     *   LINER  aboard the Meridian Star while she is under way: SKIP THE VOYAGE,
     *          back at her anchorage off the cruise terminal, the player where
     *          they stood on deck. Free, like boarding her.
     * The Sunset Pier rides (the Falcon, the Eye) are the point in themselves and
     * are never skipped; there are no passenger flights or cable cars.
     *
     * The time a skip takes is the time the ride would have taken: the cab's
     * route length over its measured average pace (TAXI_SKIP_PACE), the train's
     * hops over its speed profile (100 km/h, 1.3 m/s² each way, the call at each
     * station), the liner's remaining circuit over her speed caps. The clock
     * moves by that many seconds of ride, at the game's own rate (one game
     * minute a second, citylife.js), so skipping and riding land at the same
     * hour. The world is caught up across the gap: the weather machine runs in
     * one-second steps (weather.js stepWeatherMachine: no sudden sky after the
     * fade), the scenic trains and the sailing liner run their timetables, and
     * the crowd streamer is told to settle round the new spot while the screen
     * is still black (crowd.js `settledAt`), so the street is full on fade-in.
     *
     * The fade runs on simulation time inside update(): pausing freezes it where
     * it is, the pause menu draws over it, and resuming carries on. Death or a
     * return to the title cancels it. Nothing that is saved is touched except
     * cash (the fare) and the clock, and save() runs once after the jump. The
     * wanted state is never read-modified. The effects bus is ducked for the
     * black (audio.js setMixDuck: engines, rain, the street); the radio is its
     * own element and plays straight through.
     */
    const RIDE_SKIP_FADE = 0.6,
      // Black long enough for the new spot to be drawn a few times (batches,
      // shadows, the crowd settling) before it is shown.
      RIDE_SKIP_HOLD = 0.8,
      RIDE_SKIP_MIN_FRAMES = 6,
      // After the picture is back the passenger stays put a moment before
      // stepping out (the cab at the kerb, the train at the platform).
      RIDE_SKIP_LINGER = 0.9,
      // The mix under the black: engines, rain and the street at a fifth.
      RIDE_SKIP_DUCK = 0.2,
      // A hired cab's average pace over a whole route: TAXI_SPEED on the
      // straights, less the corners, holding for traffic and people and the
      // kerb stop. Measured with DeadEndCity.simulate over four rides of 1.4 to
      // 9 km: 34 to 85 units a second, typically 60-85; half the cruise, about
      // 32 km/h, which is also a fair city cab average.
      TAXI_SKIP_PACE = 0.5 * TAXI_SPEED,
      // Shorter than this left to go and the prompt is not worth offering.
      RIDE_SKIP_MIN_DISTANCE = 480;
    let rideSkip = null,
      // The station the train skip is set to, for the ride it was set on
      // ({ ride, station }; none: the ride's destination).
      trainSkipPick = null,
      lastRideSkip = null;
    function rideSkipActive() {
      return !!rideSkip;
    }
    /* A game-clock time `seconds` of ride from now, as HH:MM. */
    function clockAfter(seconds) {
      const m = Math.floor(worldMinutes + seconds) % 1440;
      return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    }
    /* A drop-off point in words: the nearest named door if there is one close,
       else the street, with the district under it. */
    function dropOffLabel(point) {
      let best = null,
        bestDistance = 240;
      for (const place of PLACES) {
        if (!place.door || !place.name) continue;
        const d = distanceBetween(point, place.door);
        if (d < bestDistance) {
          best = place;
          bestDistance = d;
        }
      }
      const street = streetNameAt(point.x, point.y),
        area = districtAt(point.x, point.y);
      if (best) return { title: best.name, detail: street || area };
      return street ? { title: street, detail: area } : { title: area, detail: '' };
    }
    /* Seconds a train takes over one hop between calls of `units`: up to
       100 km/h at 1.3 m/s² and down again, or a triangle when it is too short to
       reach full speed. */
    function railHopSeconds(units) {
      const v = RAIL_TOP_SPEED,
        a = RAIL_ACCELERATION;
      return units >= (v * v) / a ? units / v + v / a : 2 * Math.sqrt(units / a);
    }
    /* The calls ahead of the player's train: each station, the path index it
       stands at, and the seconds from now until the train would stand there. */
    function trainSkipStops() {
      const ride = transitRide,
        t = ride?.train;
      if (!t || ride.alight || ride.blockedStop) return [];
      const stops = [];
      let seconds = Math.max(0, ride.boarding) + Math.max(0, t.wait || 0),
        hop = 0,
        from = { x: t.x, y: t.y };
      for (let i = t.index; i < t.path.length; i++) {
        const p = t.path[i],
          last = i === t.path.length - 1;
        hop += distanceBetween(from, p);
        from = p;
        if (!p.stop && !last) continue;
        const station = last ? ride.target : RAIL_STATIONS.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < 6);
        if (!station || station === ride.from) continue;
        seconds += railHopSeconds(hop);
        hop = 0;
        stops.push({ station, index: i, seconds });
        seconds += RAIL_PASSENGER_CALL;
      }
      return stops;
    }
    /* The order the skip key offers them in: the destination first, then the
       calls on the way, nearest first. */
    function trainSkipChoices() {
      const stops = trainSkipStops();
      return stops.length ? [stops[stops.length - 1], ...stops.slice(0, -1)] : [];
    }
    function trainSkipChoice() {
      const choices = trainSkipChoices();
      const picked = trainSkipPick?.ride === transitRide ? trainSkipPick.station : null;
      return choices.find((c) => c.station === picked) || choices[0] || null;
    }
    function cycleTrainSkip() {
      const choices = trainSkipChoices();
      if (choices.length < 2) return trainSkipChoice();
      const current = trainSkipChoice().station,
        at = Math.max(0, choices.findIndex((c) => c.station === current));
      trainSkipPick = { ride: transitRide, station: choices[(at + 1) % choices.length].station };
      tone(620, 0.05, 0.05, 'triangle');
      return trainSkipChoice();
    }
    /* The rest of the cab's route and its length. */
    function taxiRemaining(ride) {
      let length = 0,
        from = ride.car;
      for (let i = ride.index; i < ride.route.length; i++) {
        length += distanceBetween(from, ride.route[i]);
        from = ride.route[i];
      }
      return length;
    }
    /* The liner's way back to her anchorage: seconds from here over each leg's
       speed caps (they already allow for braking into the stop), accelerating as
       she does, and the pose she comes to rest in. */
    function linerSkipPlan() {
      const v = linerVoyage,
        legs = LINER_VOYAGE.length;
      if (LINER_VOYAGE[v.leg].kind === 'call') return null;
      let seconds = 0,
        speed = Math.abs(v.speed),
        end = null,
        callLeg = v.leg;
      for (let k = 0; k < legs; k++) {
        const index = (v.leg + k) % legs,
          leg = LINER_VOYAGE[index];
        if (leg.kind === 'call') {
          callLeg = index;
          break;
        }
        const path = linerLegPath(leg),
          start = k === 0 ? v.s : 0;
        if (k > 0) speed = 0;
        for (let i = 1; i < path.length; i++) {
          if (path[i].s <= start) continue;
          const ds = path[i].s - Math.max(start, path[i - 1].s),
            reach = Math.sqrt(speed * speed + 2 * LINER_ACCELERATION * ds),
            next = Math.min(Math.max(path[i].top, 1.2), reach);
          seconds += ds / Math.max(1.2, (speed + next) / 2);
          speed = next;
        }
        end = { path, astern: leg.kind === 'astern' };
      }
      if (!end) return null;
      const rest = end.path[end.path.length - 1];
      return { seconds, callLeg, x: rest.x, y: rest.y, a: normalizeAngle(rest.a + (end.astern ? Math.PI : 0)) };
    }
    /**
     * What the skip key would do now: null when the player is not on a ride that
     * can be skipped at all (the key then does nothing and falls through), else
     * the plan with `reason` set when it is refused for the moment.
     */
    function rideSkipOffer() {
      if (gameMode !== 'play' || rideSkip) return null;
      let offer = null;
      if (taxiRide && taxiRide.route[taxiRide.index]) {
        const ride = taxiRide,
          car = ride.car,
          remaining = taxiRemaining(ride),
          place = dropOffLabel(ride.destination),
          seconds = remaining / TAXI_SKIP_PACE;
        offer = {
          kind: 'taxi',
          ride,
          fare: ride.fare,
          seconds,
          kicker: 'YELLOW CAB · ARRIVING',
          title: place.title,
          detail: [place.detail, '$' + ride.fare].filter(Boolean).join(' · '),
          prompt: 'SKIP RIDE · $' + ride.fare + ' · ' + keyName('interact') + ' STOP HERE',
          id: 'skip-taxi',
        };
        if (remaining < RIDE_SKIP_MIN_DISTANCE) return null;
        if (car.hp < car.maxhp * 0.6 || car.damage?.burning) offer.reason = 'The cab is in no state for the long way round.';
        else if (cash < ride.fare) offer.reason = 'Not enough cash for the fare. You ride it out.';
      } else if (transitRide) {
        const choice = trainSkipChoice();
        if (!choice) return null;
        const count = trainSkipChoices().length,
          calls = trainSkipStops().findIndex((c) => c.station === choice.station) + 1,
          street = streetNameAt(choice.station.entry.x, choice.station.entry.y),
          area = districtAt(choice.station.entry.x, choice.station.entry.y);
        offer = {
          kind: 'train',
          ride: transitRide,
          stop: choice,
          fare: 0,
          seconds: choice.seconds,
          kicker: 'CITY RAIL · ' + (calls === 1 ? 'NEXT STOP' : calls + ' STOPS'),
          title: choice.station.name,
          detail: [street, area].filter((w) => w && w !== choice.station.name).join(' · '),
          prompt: 'SKIP TO ' + choice.station.name + (count > 1 ? ' · ' + keyName('skipStop') + ' OTHER STOP' : ''),
          id: 'skip-train',
        };
      } else if (player.deck && player.deck === sailingLiner()) {
        const plan = linerSkipPlan();
        if (!plan) return null;
        offer = {
          kind: 'liner',
          ship: player.deck,
          plan,
          fare: 0,
          seconds: plan.seconds,
          kicker: player.deck.name + ' · ARRIVING',
          title: 'NORTH SOUND ANCHORAGE',
          detail: 'OFF THE CRUISE TERMINAL',
          // Her walkable deck is the aft deck, all of it by the stern ladder, so
          // the prompt keeps the way off too.
          prompt: 'SKIP THE VOYAGE' + (deckExitNear() ? ' · ' + keyName('interact') + ' GO ASHORE' : ' · BACK AT ANCHOR'),
          id: 'skip-liner',
        };
      }
      if (!offer) return null;
      if (!offer.reason) {
        if (wantedStars > 0) offer.reason = 'No skipping with the police on you.';
        else if (mission?.timeLimit) offer.reason = 'Not while the clock is running on a job.';
      }
      offer.detail = [offer.detail, 'ARRIVE ' + clockAfter(offer.seconds)].filter(Boolean).join(' · ');
      return offer;
    }
    /* The prompt for this pass (game.js updateUI), or null. */
    function rideSkipPrompt() {
      const offer = rideSkipOffer();
      return offer && !offer.reason ? offer : null;
    }
    /* The skip keys: `skip` starts it, `cycle` changes the train's stop. Returns
       true when the key was the ride's (so it does nothing else). */
    function rideSkipKey(which) {
      if (rideSkip) return true;
      const offer = rideSkipOffer();
      if (!offer) return false;
      if (which === 'cycle') {
        if (offer.kind === 'train') cycleTrainSkip();
        return true;
      }
      if (offer.reason) {
        tell(offer.reason, 2.6);
        return true;
      }
      beginRideSkip(offer);
      return true;
    }
    function beginRideSkip(offer) {
      rideSkip = { ...offer, phase: 'out', t: 0, frames: 0, opacity: 0 };
      keys = {};
      mouse.down = false;
      // Nobody gets hurt in the dark.
      player.inv = Math.max(player.inv, RIDE_SKIP_FADE * 2 + RIDE_SKIP_HOLD + RIDE_SKIP_LINGER + 1);
      getElement('rideSkipKicker').textContent = offer.kicker;
      getElement('rideSkipTitle').textContent = offer.title;
      getElement('rideSkipDetail').textContent = offer.detail;
      getElement('rideSkipBar').style.transform = 'scaleX(0)';
      getElement('rideSkip').classList.remove('hidden');
      setMixDuck(RIDE_SKIP_DUCK, RIDE_SKIP_FADE);
      showRideSkip(0, 0);
    }
    function showRideSkip(opacity, card) {
      const el = getElement('rideSkip');
      el.style.opacity = opacity.toFixed(3);
      el.style.setProperty('--card', card.toFixed(3));
    }
    function endRideSkipView() {
      getElement('rideSkip').classList.add('hidden');
      showRideSkip(0, 0);
      setMixDuck(1, RIDE_SKIP_FADE);
    }
    /* Called from update() every simulation step (and while dead or on the title,
       where it only cancels). */
    function updateRideSkip(deltaSeconds) {
      const s = rideSkip;
      if (!s) return;
      if (gameMode !== 'play') {
        if (gameMode === 'dead' || gameMode === 'menu') cancelRideSkip();
        return;
      }
      s.t += deltaSeconds;
      s.frames++;
      const ease = (x) => x * x * (3 - 2 * x);
      if (s.phase === 'out') {
        const k = clamp(s.t / RIDE_SKIP_FADE, 0, 1);
        showRideSkip(ease(k), clamp(k * 1.6 - 0.35, 0, 1));
        if (k >= 1) {
          s.result = performRideSkip(s);
          s.phase = s.result ? 'hold' : 'in';
          s.t = 0;
          s.frames = 0;
          if (!s.result) tell('The ride goes on.', 2);
        }
      } else if (s.phase === 'hold') {
        showRideSkip(1, 1);
        getElement('rideSkipBar').style.transform = 'scaleX(' + clamp(s.t / RIDE_SKIP_HOLD, 0, 1).toFixed(3) + ')';
        if (s.t >= RIDE_SKIP_HOLD && s.frames >= RIDE_SKIP_MIN_FRAMES) {
          s.phase = 'in';
          s.t = 0;
          setMixDuck(1, RIDE_SKIP_FADE * 1.5);
        }
      } else {
        const k = clamp(s.t / RIDE_SKIP_FADE, 0, 1);
        showRideSkip(1 - ease(k), clamp(1 - k * 2.2, 0, 1));
        if (k >= 1) {
          rideSkip = null;
          endRideSkipView();
          if (s.result?.message) tell(s.result.message, 3.5);
        }
      }
    }
    function cancelRideSkip() {
      if (!rideSkip) return;
      rideSkip = null;
      endRideSkipView();
    }
    /**
     * The jump, at full black. Checks the ride is still the one the skip was
     * for, moves it to its end, catches the world up and settles the street.
     * Returns what happened (for the console and the toast), or null if the
     * ride changed under the fade and nothing was done.
     */
    function performRideSkip(s) {
      const before = { minutes: worldMinutes, cash, x: player.x, y: player.y };
      let arrived = null,
        seconds = s.seconds;
      if (s.kind === 'taxi') {
        const ride = taxiRide;
        if (ride !== s.ride || !ride.route[ride.index] || ride.car.hp <= 0 || wantedStars > 0) return null;
        seconds = taxiRemaining(ride) / TAXI_SKIP_PACE;
        catchUpWorld(seconds);
        placeCabAtKerb(ride);
        cash -= ride.fare;
        ride.prepaid = true;
        ride.arrival = RIDE_SKIP_HOLD + RIDE_SKIP_FADE + RIDE_SKIP_LINGER;
        arrived = { name: s.title, message: 'ARRIVED · ' + s.title + ' · FARE $' + ride.fare + ' PAID' };
      } else if (s.kind === 'train') {
        const ride = transitRide;
        if (ride !== s.ride || ride.alight || ride.blockedStop) return null;
        const stop = trainSkipStops().find((c) => c.station === s.stop.station);
        if (!stop) return null;
        seconds = stop.seconds;
        catchUpWorld(seconds);
        placeTrainAtPlatform(ride, stop);
        // leaveTransit() says ARRIVED as the passenger steps off.
        arrived = { name: stop.station.name, message: null };
      } else {
        const ship = s.ship;
        if (player.deck !== ship || LINER_VOYAGE[linerVoyage.leg].kind === 'call') return null;
        const plan = linerSkipPlan();
        if (!plan) return null;
        seconds = plan.seconds;
        catchUpWorld(seconds, true);
        placeLinerAtAnchor(ship, plan);
        arrived = { name: 'NORTH SOUND ANCHORAGE', message: ship.name + ' · AT ANCHOR OFF THE CRUISE TERMINAL' };
      }
      trainSkipPick = null;
      // The camera is where the player is, not sweeping across the map to it.
      cameraTarget.x = player.x;
      cameraTarget.y = player.y;
      // Fill the street round the new spot while the screen is black: the crowd
      // settles (in view too) on its next pass.
      crowd.settledAt = null;
      crowd.timers.stream = 0;
      save();
      lastRideSkip = {
        kind: s.kind,
        destination: arrived.name,
        seconds: Math.round(seconds),
        clockBefore: Math.round(before.minutes * 10) / 10,
        clockAfter: Math.round(worldMinutes * 10) / 10,
        gameMinutes: Math.round((worldMinutes - before.minutes) * 10) / 10,
        fare: s.fare,
        cashBefore: before.cash,
        cashAfter: cash,
        from: { x: Math.round(before.x), y: Math.round(before.y) },
        to: { x: Math.round(player.x), y: Math.round(player.y) },
      };
      return arrived;
    }
    /**
     * Move the world on by `seconds` of ride: the clock (a game minute a second)
     * with the weather machine stepped across it, the scenic trains along their
     * timetable and, unless the player is aboard her, the sailing liner.
     */
    function catchUpWorld(seconds, aboardLiner = false) {
      for (let done = 0; done < seconds; ) {
        const step = Math.min(1, seconds - done);
        worldMinutes += step;
        stepWeatherMachine(step);
        done += step;
      }
      // The scenic trains, not the player's (which is placed on its own).
      const own = transitRide?.train,
        at = own ? railTrains.indexOf(own) : -1;
      if (at >= 0) railTrains.splice(at, 1);
      for (let done = 0; done < seconds; done += 0.1) updateTransit(Math.min(0.1, seconds - done));
      if (at >= 0) railTrains.splice(at, 0, own);
      if (!aboardLiner) {
        for (let done = 0; done < seconds; done += 0.25) sailLiner(Math.min(0.25, seconds - done));
        // Her sound signals belong to the passage nobody saw.
        linerVoyage.hornQueue.length = 0;
      }
    }
    /* The cab at the drop-off: on the last stretch of road of its route, level
       with the drop-off but short of the junction, facing along the road and
       pulled in to the kerb on its own (right-hand) side; stepped back along the
       road when something is standing there. The player's own pin (pushed onto
       the route after the last road node when the road reaches it) may be on a
       pavement or a forecourt, so the cab stops on the road beside it. */
    function placeCabAtKerb(ride) {
      const car = ride.car,
        route = ride.route,
        n = route.length,
        pushed = n > 2 && distanceBetween(route[n - 1], ride.destination) < 1,
        j = pushed ? n - 2 : n - 1;
      let i = j - 1;
      while (i > 0 && distanceBetween(route[i], route[j]) < 12) i--;
      const a = route[Math.max(0, i)],
        b = route[j],
        length = distanceBetween(a, b),
        along = length > 1 ? headingBetween(a, b) : car.a,
        ux = Math.cos(along),
        uy = Math.sin(along),
        // Kerb side: (-sin, +cos), as the ride's lane offset (taxi.js).
        kx = -uy,
        ky = ux,
        level = (ride.destination.x - a.x) * ux + (ride.destination.y - a.y) * uy,
        t = clamp(level, Math.min(length * 0.5, 30), Math.max(length * 0.5, length - 50)),
        base = { x: a.x + ux * t, y: a.y + uy * t },
        home = { x: car.x, y: car.y };
      // Pull in as far as the carriageway goes (wider on the avenues), keeping
      // the cab's half-width on the asphalt.
      let kerb = 26;
      if (cityStreetAt(base.x + kx * kerb, base.y + ky * kerb))
        while (kerb < 90 && cityStreetAt(base.x + kx * (kerb + 16), base.y + ky * (kerb + 16))) kerb += 4;
      // Out of the way while the spot is tested, so it does not block itself.
      car.x = car.y = -1e6;
      let spot = null;
      for (let back = 0; back <= 240 && !spot; back += 20) {
        const x = base.x - ux * back + kx * kerb,
          y = base.y - uy * back + ky * kerb;
        if (canSpawnCar(car.type, x, y, along, 4)) spot = { x, y };
      }
      if (!spot) spot = { x: base.x + kx * kerb, y: base.y + ky * kerb };
      if (!groundAt(spot.x, spot.y, 8)) spot = home;
      car.x = spot.x;
      car.y = spot.y;
      car.a = along;
      car.vx = car.vy = car.av = 0;
      car.speed = ride.speed = 0;
      car.groundHeight = terrainHeight(car.x, car.y);
      ride.index = route.length;
      ride.stuck = 0;
      player.x = car.x;
      player.y = car.y;
      player.a = car.a;
      player.altitude = car.groundHeight + 4;
    }
    /* The player's train standing at `stop`'s platform, as if it had run there:
       head on the station point, next path point ahead, stopped. */
    function placeTrainAtPlatform(ride, stop) {
      const t = ride.train,
        p = t.path[stop.index],
        next = t.path[stop.index + 1],
        prev = t.path[stop.index - 1];
      t.x = p.x;
      t.y = p.y;
      t.a = next ? headingBetween(p, next) : prev ? headingBetween(prev, p) : t.a;
      t.index = stop.index + 1;
      t.speed = 0;
      t.wait = 0;
      ride.boarding = 0;
      ride.exitRequested = false;
      ride.alight = { station: stop.station, timer: RIDE_SKIP_HOLD + RIDE_SKIP_FADE + RIDE_SKIP_LINGER };
      player.x = t.x;
      player.y = t.y;
      player.a = t.a;
      player.altitude = 62;
    }
    /* The Meridian Star riding at her anchorage, the player carried to the same
       spot on her deck. */
    function placeLinerAtAnchor(ship, plan) {
      const carried = deckLocal(ship, player.x, player.y),
        v = linerVoyage;
      ship.x = plan.x;
      ship.y = plan.y;
      ship.a = plan.a;
      ship.speed = 0;
      Object.assign(v, { leg: plan.callLeg, s: 0, timer: 0, speed: 0, drift: 0, heel: 0, warned: false, horn: 0 });
      v.hornQueue.length = 0;
      carryLinerDeck(ship, carried);
      clearLinerWay(ship);
    }
    /* Developer console: the offer as the prompt would show it, the fade in
       progress, and the last skip's numbers. */
    function rideSkipReport() {
      const offer = rideSkipOffer();
      return {
        offer: offer
          ? {
              kind: offer.kind,
              prompt: offer.prompt,
              allowed: !offer.reason,
              reason: offer.reason || null,
              destination: offer.title,
              detail: offer.detail,
              fare: offer.fare,
              seconds: Math.round(offer.seconds),
              choices: offer.kind === 'train' ? trainSkipChoices().map((c) => c.station.name) : undefined,
            }
          : null,
        fading: rideSkip
          ? { kind: rideSkip.kind, phase: rideSkip.phase, t: +rideSkip.t.toFixed(2), opacity: +getElement('rideSkip').style.opacity }
          : null,
        last: lastRideSkip,
      };
    }
    // END SUBSYSTEM: src/ride-skip.js
