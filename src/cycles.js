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
    const CYCLE_STAMINA_MAX = 7.5,
      CYCLE_SPRINT_TOP = 1.42,
      CYCLE_SPRINT_ACC = 1.85;
    let cycleStamina = CYCLE_STAMINA_MAX,
      cycleStandCache = null;
    function ridingBicycle() {
      return !!player.car && vehicleSpec(player.car).bicycle;
    }
    function cycleSprinting() {
      return ridingBicycle() && keys.ShiftLeft && cycleStamina > 0.05;
    }
    function updateCycling(deltaSeconds) {
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
