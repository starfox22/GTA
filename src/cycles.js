    // BEGIN SUBSYSTEM: src/cycles.js — City bicycles
    /**
     * City bicycles
     * Source: src/cycles.js
     * Scope: shared game closure.
     * Bike-share stands, the bicycles racked at them and the rider's legs.
     */
    /**
     * BIKE SHARE
     * Stands are derived from places people actually arrive at -- station
     * entrances, park gates, the esplanade, the marina and the cruise terminal --
     * rather than hand-placed, so the network grows with the city. Each stand
     * racks a few bicycles; take one and it is yours.
     *
     * Riding has legs: holding Shift while pedalling stands you on the pedals for
     * a faster, harder gear that drains stamina, and easing off gets it back.
     * Stamina only applies to the player's own bicycle; nothing else in traffic
     * is affected.
     */
    /**
     * PEDALLING
     * Hold W (or the PEDAL touch button) and the rider pedals; let go and the
     * bike freewheels. The legs are not a throttle, though: effort spins up over
     * a fraction of a second, and the push they give fades as the bike nears
     * its top speed (a square-root taper), so a bicycle leaps off the line,
     * builds briskly through the middle and settles gently at the top instead of
     * hitting a wall. Cadence is derived from speed and effort for the HUD and
     * the crank sound. S brakes, then creeps backwards slowly.
     */
    const CYCLE_STAMINA_MAX = 7.5,
      CYCLE_SPRINT_TOP = 1.42,
      CYCLE_SPRINT_PUSH = 1.3,
      // Forward push at a standstill, world units per second squared.
      CYCLE_PUSH = 68,
      // How quickly the legs come up to full effort, and let go of it, per second.
      CYCLE_SPIN_UP = 3.2,
      CYCLE_SPIN_DOWN = 6,
      // Crank revolutions per second at top speed in the normal gear (~95 rpm).
      CYCLE_CADENCE_TOP = 1.6,
      // Reverse is a walk-it-backwards shuffle, not a gear.
      CYCLE_REVERSE_MAX = 34;
    let cycleStamina = CYCLE_STAMINA_MAX,
      cycleStandCache = null;
    const pedal = { effort: 0, cadence: 0, crank: 0 };
    function ridingBicycle() {
      return !!player.car && vehicleSpec(player.car).bicycle;
    }
    function cycleSprinting() {
      // Standing on the pedals only counts while actually pedalling.
      return (
        ridingBicycle() &&
        !!(keys.KeyW || keys.ArrowUp) &&
        !!(keys.ShiftLeft || keys.ShiftRight) &&
        cycleStamina > 0.05
      );
    }
    function pedalCadence() {
      return pedal.cadence;
    }
    function pedalEffort() {
      return pedal.effort;
    }
    /* Forward acceleration the rider's legs give at speed `along` against a top
       speed of `topSpeed` (physics.js adds it to the bike's own drag and brakes). */
    function pedalDrive(along, topSpeed) {
      if (pedal.effort <= 0 || along >= topSpeed) return 0;
      const room = 1 - Math.max(0, along) / topSpeed;
      return CYCLE_PUSH * pedal.effort * (cycleSprinting() ? CYCLE_SPRINT_PUSH : 1) * Math.sqrt(room);
    }
    function updateCycling(deltaSeconds) {
      const riding = ridingBicycle(),
        pressed = riding && !!(keys.KeyW || keys.ArrowUp);
      if (!riding) {
        pedal.effort = pedal.cadence = 0;
      } else {
        pedal.effort = pressed
          ? Math.min(1, pedal.effort + CYCLE_SPIN_UP * deltaSeconds)
          : Math.max(0, pedal.effort - CYCLE_SPIN_DOWN * deltaSeconds);
        // Cadence follows road speed while pedalling and drops away when coasting.
        const speedShare = clamp((player.car.speed || 0) / vehicleSpec(player.car).max, 0, 1.5),
          target = pressed ? CYCLE_CADENCE_TOP * (0.35 + 0.65 * speedShare) : 0;
        pedal.cadence += (target - pedal.cadence) * Math.min(1, deltaSeconds * (pressed ? 4 : 2.5));
        // One soft crank tick per revolution while the legs are working.
        pedal.crank += pedal.cadence * deltaSeconds;
        if (pedal.crank >= 1) {
          pedal.crank -= 1;
          if (pressed) playSample('tires', 0.035, 2.4);
        }
      }
      if (cycleSprinting()) cycleStamina = Math.max(0, cycleStamina - deltaSeconds);
      else cycleStamina = Math.min(CYCLE_STAMINA_MAX, cycleStamina + deltaSeconds * (riding ? 0.55 : 3));
    }
    function cycleStands() {
      if (cycleStandCache) return cycleStandCache;
      const spots = [];
      for (const s of RAIL_STATIONS)
        spots.push({ x: s.entry.x, y: s.entry.y, a: railStationAngle(s) + Math.PI / 2 });
      for (const p of CITY_PARKS) {
        const gate = parkLoop(p, 4)[0];
        if (gate) spots.push({ x: gate[0] + 26, y: gate[1] + 18, a: 0 });
      }
      spots.push(
        { x: 1596, y: -3320, a: Math.PI / 2 },
        { x: 2700, y: -3980, a: 0 },
        { x: 1240, y: -3290, a: 0 },
        { x: 3960, y: -5960, a: 0 },
        { x: 786, y: 640, a: 0 },
        { x: 2300, y: 2686, a: 0 },
      );
      // Every eighth esplanade bay gets a stand, so the waterfront is ridable end to end.
      const walk = promenadeSpots();
      for (let i = 5; i < walk.length; i += 44)
        spots.push({ x: walk[i].x - walk[i].nx * -6, y: walk[i].y - walk[i].ny * -6, a: walk[i].a });
      cycleStandCache = spots.filter(
        (s) => groundAt(s.x, s.y, 14) && !solid(s.x, s.y, 12) && !onRoad(s.x, s.y) && !inHarbor(s.x, s.y, 20),
      );
      return cycleStandCache;
    }
    function populateCycles() {
      for (const stand of cycleStands()) {
        // Two bikes at a stand is enough to read as one; more just fills the
        // vehicle list with parked geometry.
        const racked = 1 + (seededRandom() < 0.45 ? 1 : 0);
        for (let i = 0; i < racked; i++) {
          const x = stand.x + Math.cos(stand.a) * (i * 15 - 15),
            y = stand.y + Math.sin(stand.a) * (i * 15 - 15);
          if (!canSpawnCar('bicycle', x, y, stand.a + Math.PI / 2, 2)) continue;
          makeCar(
            'bicycle',
            x,
            y,
            stand.a + Math.PI / 2,
            false,
            randomChoice(['#68b6aa', '#d8b25e', '#c2705f', '#7f96c4', '#8cb26a']),
          );
        }
      }
    }
    // END SUBSYSTEM: src/cycles.js
