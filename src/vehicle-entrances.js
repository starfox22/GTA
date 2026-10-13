    // Vehicle entrances: the gate lanes and drives that parked things keep clear (the 4x4 club's gate and track, the
    // Monarch villas' drives from garage to gate); vehicleEntranceAt() for placers and the vehicleEntrances() audit.
    /**
     * VEHICLE ENTRANCES
     * A lane a car must be able to use to get in or out: nothing parked stands in it. Placers ask
     * `vehicleEntranceAt(x, y, margin)` (the bike-share stations, cycles.js bikePavementAt). Sources:
     *   - the 4x4 club (offroad-trails.js OFFROAD_CLUB.entrances, lot-local rectangles): the timber gate's lane
     *     from the avenue up to the track and the track east along the front row;
     *   - every Monarch villa's drive (monarch-garages.js villaGarageDrive): from the garage door to the gate and
     *     out across the pavement.
     * The list is built on first use once the island is planned. Console `vehicleEntrances()` lists each lane and
     * whatever parked stands in it (tools/tests/club-entrance.mjs holds the club's at none).
     */
    let vehicleEntranceCache = null;
    function vehicleEntrances() {
      if (vehicleEntranceCache) return vehicleEntranceCache;
      const list = [];
      for (const [u0, v0, u1, v1, name] of OFFROAD_CLUB.entrances) list.push({ name, ...clubRect(u0, v0, u1, v1) });
      for (const plan of monarchPlan.villas) {
        if (plan.garageDrive) list.push({ name: plan.villa.name + ' DRIVE', ...plan.garageDrive });
        if (plan.sideDrive) list.push({ name: plan.villa.name + ' SIDE GATE', ...plan.sideDrive });
      }
      // Cached once the island exists (bike stations are planned after the world is built).
      if (monarchPlan.built) vehicleEntranceCache = list;
      return list;
    }
    function vehicleEntranceAt(x, y, margin = 0) {
      const list = vehicleEntrances();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (x > e.x - margin && x < e.x + e.w + margin && y > e.y - margin && y < e.y + e.h + margin) return e;
      }
      return null;
    }
    // Console vehicleEntrances(): each lane and the parked vehicles and bike-share docks standing in it.
    function vehicleEntranceReport() {
      const inside = (e, x, y, m = 0) => x > e.x - m && x < e.x + e.w + m && y > e.y - m && y < e.y + e.h + m;
      return vehicleEntrances().map((e) => {
        const parked = [];
        for (let i = 0; i < vehicles.length; i++) {
          const c = vehicles[i];
          if (c.ai || c === player.car || c.hp <= 0 || isAircraft(c) || isBoat(c)) continue;
          if (corners(vehicleShape(c)).some((p) => inside(e, p.x, p.y)) || inside(e, c.x, c.y)) parked.push({ id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y) });
        }
        const docks = [];
        for (const st of bikeStationPlan())
          for (const slot of st.slots || []) if (inside(e, slot.x, slot.y, 4)) docks.push({ station: st.label, x: Math.round(slot.x), y: Math.round(slot.y) });
        return { name: e.name, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w), h: Math.round(e.h), parked, docks };
      });
    }
