    // ---- The Sunset Eye ------------------------------------------------------------
    /**
     * A 48-capsule observation wheel on twin A-frame legs, turning once every
     * four minutes; the capsules hang level on the outside of the rim. Ridden
     * from the terminal under the wheel: the player boards whichever capsule is
     * passing the platform and rides one revolution.
     */
    const WHEEL_CAPSULES = 48,
      WHEEL_PERIOD = 240,
      WHEEL_CAPSULE_RADIUS = 262;
    function wheelAngle() {
      return (gameTime / WHEEL_PERIOD) * TAU;
    }
    /* Capsule k: angle round the hub (0 = east, pi/2 = top) and its centre. */
    function wheelCapsule(k, out = {}) {
      const a = wheelAngle() + (k * TAU) / WHEEL_CAPSULES;
      out.a = a;
      out.x = PIER.wheel.x + Math.cos(a) * WHEEL_CAPSULE_RADIUS;
      out.y = PIER.wheel.y;
      out.z = PIER.wheel.hub + Math.sin(a) * WHEEL_CAPSULE_RADIUS;
      return out;
    }
    function boardWheel() {
      if (player.car || playerOnRoof() || player.parachute || transitRide || player.coaster) return false;
      const t = PIER.terminal;
      if (player.x < t.x - 40 || player.x > t.x + t.w + 40 || player.y < t.y - 40 || player.y > t.y + t.h + 40) return false;
      if (wantedStars > 0) {
        needToLosePolice();
        return true;
      }
      // The capsule nearest the bottom of the wheel.
      let best = 0,
        bestGap = Infinity;
      for (let k = 0; k < WHEEL_CAPSULES; k++) {
        const a = wheelCapsule(k, parkScratch).a,
          gap = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
        if (gap < bestGap) {
          bestGap = gap;
          best = k;
        }
      }
      player.coaster = { kind: 'wheel', capsule: best, time: 0, view: 0 };
      announce('SUNSET PIER', 'THE SUNSET EYE', 2.4);
      tell('One turn, four minutes, ' + Math.round(worldMeters(PIER.wheel.hub + WHEEL_CAPSULE_RADIUS + 12)) + ' metres up. ' + keyName('radioPower') + ' / ' + keyName('radioNext') + ' the radio, ' + keyName('interact') + ' at the bottom to step off.', 4);
      return true;
    }
    function updateWheelRide(deltaSeconds) {
      const ride = player.coaster,
        c = wheelCapsule(ride.capsule, parkScratch);
      ride.time += deltaSeconds;
      player.x = c.x;
      player.y = c.y;
      player.altitude = c.z - 6;
      if (ride.time > WHEEL_PERIOD) leaveCoaster();
    }
    // ---- Update, status, interaction -----------------------------------------------
    function updateCoaster(deltaSeconds) {
      player.hidden = !!player.coaster;
      if (gameMode !== 'play') return;
      // Fixed steps: at 180 u/s a long frame would otherwise skip a crest.
      let left = Math.min(0.25, deltaSeconds);
      while (left > 1e-6) {
        const dt = Math.min(1 / 90, left);
        stepCoasterTrain(dt);
        left -= dt;
      }
      const ride = player.coaster;
      if (ride?.kind === 'wheel') updateWheelRide(deltaSeconds);
      else if (ride) {
        const seat = coasterSeat(ride.car, parkScratch);
        ride.time += deltaSeconds;
        player.x = seat.x;
        player.y = seat.y;
        player.altitude = seat.z + 4;
        player.a = Math.atan2(seat.ty, seat.tx);
      }
      updateFalconVoices();
      updateParkShows(deltaSeconds);
      updateParkCrowd(deltaSeconds);
      updateParkAudio(deltaSeconds);
    }
    function coasterStatusText() {
      const ride = player.coaster;
      if (!ride) return '';
      if (ride.kind === 'wheel')
        return 'THE SUNSET EYE · ' + Math.round(worldMeters(player.altitude)) + ' m · ' + Math.max(0, Math.ceil(WHEEL_PERIOD - ride.time)) + ' s';
      return (
        'THE FALCON · ' +
        speedText(coasterTrain.speed) +
        ' · ' +
        Math.round(worldMeters(player.altitude)) +
        ' m'
      );
    }
    function parkInteract() {
      if (player.coaster) {
        const ride = player.coaster;
        if (ride.kind === 'wheel') {
          const a = wheelCapsule(ride.capsule, parkScratch).a,
            gap = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
          if (ride.time > 20 && gap < 0.2) leaveCoaster();
          else ride.view = (ride.view + 1) % 2;
          return true;
        }
        if (!coasterTrain.running) {
          leaveCoaster();
          return true;
        }
        ride.view = (ride.view + 1) % 3;
        return true;
      }
      return boardCoaster() || boardWheel();
    }
    // ---- Shows: the fountain and the fireworks -------------------------------------
    /**
     * The Fountain Lagoon plays a show every game hour after dark (every other
     * hour by day): 42 minutes of music and water on the hour (42 real seconds),
     * one of three choreographies in turn. Fireworks go up from the lagoon and
     * the north shore at nine on two nights in three.
     */
    const parkShow = {
      fountain: null,
      fireworks: false,
      rockets: [],
      launchClock: 0,
    };
    function fountainShowAt(minutes) {
      const hour = Math.floor(minutes / 60) % 24,
        t = minutes % 60,
        night = hour >= 19 || hour < 2;
      if (hour >= 2 && hour < 9) return null;
      if (!night && hour % 2) return null;
      if (t > 42) return null;
      return { t, index: Math.floor(minutes / 60) % 3, bpm: [96, 84, 112][Math.floor(minutes / 60) % 3], night };
    }
    function fireworksTonight(minutes) {
      const day = Math.floor(minutes / 1440),
        hour = (minutes % 1440) / 60;
      return day % 3 !== 1 && hour >= 21 && hour < 21.75;
    }
    function updateParkShows(deltaSeconds) {
      parkShow.fountain = fountainShowAt(worldMinutes);
      parkShow.fireworks = fireworksTonight(worldMinutes);
      // Rockets: launched in salvos while the display lasts, burst at the top.
      if (parkShow.fireworks) {
        parkShow.launchClock -= deltaSeconds;
        if (parkShow.launchClock <= 0) {
          parkShow.launchClock = 0.35 + seededRandom() * 0.9;
          const pads = [
            [PIER.lagoon.x - 120, PIER.lagoon.y],
            [PIER.lagoon.x + 120, PIER.lagoon.y],
            [2600, -7040],
            [3200, -7060],
            [3800, -7030],
          ];
          const salvo = seededRandom() < 0.2 ? 4 : 1;
          for (let i = 0; i < salvo; i++) {
            const [x, y] = randomChoice(pads);
            parkShow.rockets.push({
              x: x + randomBetween(-20, 20),
              y: y + randomBetween(-20, 20),
              z: 4,
              vz: randomBetween(230, 300),
              vx: randomBetween(-18, 18),
              vy: randomBetween(-18, 18),
              burstAt: randomBetween(210, 400),
              hue: seededRandom(),
              style: Math.floor(seededRandom() * 4),
              born: gameTime,
              burst: 0,
            });
            parkFireworkSound('launch', x, y);
          }
        }
      }
      for (let i = parkShow.rockets.length - 1; i >= 0; i--) {
        const r = parkShow.rockets[i];
        if (!r.burst) {
          r.vz -= 40 * deltaSeconds;
          r.x += r.vx * deltaSeconds;
          r.y += r.vy * deltaSeconds;
          r.z += r.vz * deltaSeconds;
          if (r.z >= r.burstAt || r.vz < 40) {
            r.burst = gameTime;
            parkFireworkSound('burst', r.x, r.y, r.z);
          }
        } else if (gameTime - r.burst > 3.2) parkShow.rockets.splice(i, 1);
      }
      if (parkShow.rockets.length > 60) parkShow.rockets.splice(0, parkShow.rockets.length - 60);
    }
