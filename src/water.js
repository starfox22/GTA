    // BEGIN SUBSYSTEM: src/water.js — Swimming and sinking
    /**
     * Swimming and sinking
     * Source: src/water.js
     * Scope: shared game closure.
     * Going into the water on foot, and what happens when a car follows you in.
     */
    /**
     * WATER
     * The bay is a place you can be, not a wall. On foot the shoreline stops
     * blocking you: step off the quay and you are swimming -- slower, unable to
     * shoot, and on a clock. Breath comes back on land.
     *
     * A road vehicle is stopped by the quay edge only while something sensible is
     * driving it; the player's own car is not, so you can put one in the bay. Once
     * it is over deep water it floods, settles under the surface and takes anyone
     * still inside with it. `SINK_SECONDS` is the window to get out.
     */
    const SWIM_SPEED = 52,
      SWIM_SPRINT = 74,
      SWIM_BREATH = 26,
      SINK_SECONDS = 3.2,
      SINK_DEPTH = 42;
    let swimBreath = SWIM_BREATH;
    function deepWater(x, y, r = 4) {
      return !groundAt(x, y, r) && !onBridge(x, y, r) && !onDock(x, y, r);
    }
    function swimSpeed() {
      return (keys.ShiftLeft || keys.ShiftRight ? SWIM_SPRINT : SWIM_SPEED) * (swimBreath > 0 ? 1 : 0.55);
    }
    function breathFraction() {
      return clamp(swimBreath / SWIM_BREATH, 0, 1);
    }
    function updateSwimming(deltaSeconds) {
      if (
        player.car ||
        player.roof ||
        player.deck ||
        player.parachute ||
        transitRide ||
        taxiRide ||
        player.coaster
      ) {
        player.swimming = false;
        swimBreath = Math.min(SWIM_BREATH, swimBreath + deltaSeconds * 6);
        return;
      }
      const inWater = deepWater(player.x, player.y, 3);
      if (inWater && !player.swimming) {
        splashAt(player.x, player.y, 1);
        tell('IN THE WATER · Shift to swim harder · your weapons are no use here', 3.5);
      }
      if (!inWater && player.swimming) tell('Back on dry land.', 2);
      player.swimming = inWater;
      if (!inWater) {
        swimBreath = Math.min(SWIM_BREATH, swimBreath + deltaSeconds * 5);
        return;
      }
      // Floating: the head and shoulders ride just under the parapet line.
      player.altitude = -5 + Math.sin(gameTime * 1.9) * 1.1;
      swimBreath -= deltaSeconds * ((keys.ShiftLeft || keys.ShiftRight) && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD) ? 1.7 : 1);
      if (swimBreath <= 0) {
        swimBreath = 0;
        hurt(13 * deltaSeconds, 'blast');
        if (Math.floor(gameTime * 2) % 4 === 0) splashAt(player.x, player.y, 0.5);
      }
    }
    function splashAt(x, y, force = 1) {
      particle(x, y, '#cfe6ea', Math.round(6 * force) + 4, 70 * force, 4);
      playSample('tires', 0.16 * force, 1.8);
    }
    /* A car in the bay floods, slows to a stop and settles under the surface. */
    function updateSinking(deltaSeconds) {
      for (const c of vehicles) {
        if (isBoat(c) || isAircraft(c)) {
          c.sinkFor = 0;
          c.sinkDepth = 0;
          continue;
        }
        if (!deepWater(c.x, c.y, 6)) {
          if (c.sinkFor) {
            c.sinkFor = 0;
            c.sinkDepth = 0;
          }
          continue;
        }
        const first = !c.sinkFor;
        c.sinkFor = (c.sinkFor || 0) + deltaSeconds;
        if (first) {
          splashAt(c.x, c.y, 2.2);
          if (c === player.car) tell('THE CAR IS GOING UNDER · E to get out', 3);
        }
        const drag = Math.exp(-2.6 * deltaSeconds);
        c.vx = (c.vx || 0) * drag;
        c.vy = (c.vy || 0) * drag;
        c.speed = (c.speed || 0) * drag;
        c.av = (c.av || 0) * drag;
        c.sinkDepth = Math.min(SINK_DEPTH, (c.sinkFor / SINK_SECONDS) * SINK_DEPTH);
        if (seededRandom() < deltaSeconds * 3) splashAt(c.x + randomBetween(-16, 16), c.y + randomBetween(-16, 16), 0.5);
        if (c === player.car) {
          if (c.sinkFor > SINK_SECONDS) {
            exitCar();
            player.car = null;
            player.inv = 0;
            player.swimming = true;
            swimBreath = 0;
            tell('You went down with the car.', 4);
            hurt(1000, 'blast');
          }
        } else if (c.sinkFor > SINK_SECONDS + 1.5 && c.hp > 0) {
          // Anything else that ends up in the bay is simply written off there.
          c.hp = 0;
          c.ai = false;
          c.cop = false;
        }
      }
    }
    // END SUBSYSTEM: src/water.js
