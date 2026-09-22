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
     * Riding has legs: holding Shift stands you on the pedals for a faster, harder
     * gear that drains stamina, and easing off gets it back. Stamina only applies
     * to the player's own bicycle; nothing else in traffic is affected.
     */
    /**
     * PEDALLING
     * A bicycle is not a throttle. Holding the key does nothing; each fresh press
     * is one turn of the cranks, and how fast you can keep pressing is how fast
     * you go. A stroke hands the bike a slug of speed and refreshes the cadence;
     * the cadence decays if you stop, and what it settles at sets the gear you are
     * effectively in, so the top speed rises and falls with your hands.
     *
     * The rising edge is read off the shared key map rather than the keyboard
     * handler, so a touch button works exactly the same way and auto-repeat cannot
     * pedal for you.
     */
    const CYCLE_STAMINA_MAX = 7.5,
      CYCLE_SPRINT_TOP = 1.42,
      CYCLE_SPRINT_ACC = 1.85,
      CYCLE_STROKE = 13,
      CYCLE_CADENCE_TOP = 4.1,
      CYCLE_CADENCE_DECAY = 1.15;
    let cycleStamina = CYCLE_STAMINA_MAX,
      cycleStandCache = null;
    const pedal = { cadence: 0, kick: 0, held: false, last: -10, phase: 0 };
    function ridingBicycle() {
      return !!player.car && vehicleSpec(player.car).bicycle;
    }
    function cycleSprinting() {
      return ridingBicycle() && keys.ShiftLeft && cycleStamina > 0.05;
    }
    function pedalCadence() {
      return pedal.cadence;
    }
    // Speed the current cadence is worth, as a fraction of the bike's top gear.
    function pedalGear() {
      return clamp(pedal.cadence / CYCLE_CADENCE_TOP, 0, 1);
    }
    function pedalQueue() {
      return pedal.kick;
    }
    function pedalStroke() {
      const gap = clamp(gameTime - pedal.last, 0.09, 1.4);
      pedal.last = gameTime;
      // A stroke's own rate is blended in, so cadence follows your hands quickly
      // without jumping around on one fast tap.
      pedal.cadence += (1 / gap - pedal.cadence) * 0.55;
      pedal.cadence = clamp(pedal.cadence, 0, CYCLE_CADENCE_TOP * 1.15);
      pedal.kick += CYCLE_STROKE * (cycleSprinting() ? CYCLE_SPRINT_ACC * 0.7 : 1);
      pedal.phase = 0;
      playSample('tires', 0.05, 2.4);
    }
    // Velocity the accumulated strokes are ready to hand over this step.
    function pedalImpulse(stepSeconds) {
      if (pedal.kick <= 0) return 0;
      const give = Math.min(pedal.kick, 62 * stepSeconds);
      pedal.kick -= give;
      return give;
    }
    /* Strokes are taken from the key event, not from the frame: a quick tap can
       begin and end between two frames, and sampling the key map would lose it --
       which would make fast pedalling slower than slow pedalling. The frame check
       below is the fallback that catches the touch button, which sets the key map
       directly and fires no event. */
    function cyclePedalKey() {
      if (!ridingBicycle() || pedal.held) return;
      pedalStroke();
      pedal.held = true;
    }
    function updateCycling(deltaSeconds) {
      const pressed = !!(keys.KeyW || keys.ArrowUp);
      if (ridingBicycle() && pressed && !pedal.held) pedalStroke();
      pedal.held = pressed;
      if (!ridingBicycle()) {
        pedal.cadence = 0;
        pedal.kick = 0;
      } else {
        pedal.cadence = Math.max(0, pedal.cadence - CYCLE_CADENCE_DECAY * deltaSeconds);
        pedal.phase += deltaSeconds * (2 + pedal.cadence * 2);
      }
      if (cycleSprinting()) cycleStamina = Math.max(0, cycleStamina - deltaSeconds);
      else cycleStamina = Math.min(CYCLE_STAMINA_MAX, cycleStamina + deltaSeconds * (ridingBicycle() ? 0.55 : 3));
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
        { x: 3812, y: 4980, a: 0 },
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
