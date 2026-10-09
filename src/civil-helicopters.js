    // Civil helicopters from downloaded models: the SKYRANGER 429 (a Bell 429 class light twin, aircraft-assets3d.js)
    // as a helicopter airframe, parked on office-roof helipads and at Southport; flown like any helicopter.
    /**
     * CIVIL HELICOPTERS
     * The SKYRANGER 429 is an ordinary `helicopter` with `airframe: 'bell429'` (HELICOPTER_AIRFRAMES: its real size,
     * name and the rotor the strikes use; vehicleSpec merges it), so it flies with helicopterControl, lands on roofs,
     * is stolen, wrecked and retired like the others. Its look is the downloaded model (aircraft-assets3d.js) in the
     * civil schemes (`bell:<scheme>`); without the model in the build it draws as the procedural civil machine.
     * Parked (`populateCivilHelicopters`, from populateWorld once the roof helipads exist, and at boot after
     * chooseRoofHelipads): on the first CIVIL_HELI_ROOFS office-roof helipads (never the Police HQ, the hospital or a
     * tower's deck) and on Southport's apron. Nothing random is drawn, so the populate seed's stream is unchanged.
     */
    HELICOPTER_AIRFRAMES.bell429 = {
      name: 'SKYRANGER 429',
      // 12.2 m nose to tail fin, 3.2 m over the stabiliser, 4.25 m to the fin top; the main rotor 11 m across
      // (radius 44 units), its mast 1.2 m ahead of the footprint's centre (aircraft_models.py measures both).
      l: 98,
      w: 26,
      height: 34,
      rotorRadius: 44,
      rotorX: 10,
      hp: 240,
      mass: 2.6,
      color: '#eef0f1',
    };
    const CIVIL_HELI_ROOFS = 2,
      // Southport's apron, north of the parked couriers (the first one clear is used).
      CIVIL_HELI_GROUND = [
        { x: 960, y: 4660, a: Math.PI / 2 },
        { x: 960, y: 4560, a: Math.PI / 2 },
      ];
    function parkCivilHelicopter(x, y, a, roof) {
      const c = makeCar('helicopter', x, y, a, false, HELICOPTER_AIRFRAMES.bell429.color);
      c.airframe = 'bell429';
      c.hp = c.maxhp = vehicleSpec(c).hp;
      if (roof) {
        c.altitude = roof.height;
        c.roofSite = roof;
      }
      return c;
    }
    function populateCivilHelicopters() {
      if (!roofHelipads.length) return 0;
      let parked = 0,
        roofs = 0;
      for (let i = 0; i < roofHelipads.length && roofs < CIVIL_HELI_ROOFS; i++) {
        const pad = roofHelipads[i],
          b = pad.building;
        if (!b || b.policeHQ || b.place || b.skyline || b.keyPad || b.noLanding || b.monarch) continue;
        if (pad.r * 2 < HELICOPTER_AIRFRAMES.bell429.w) continue;
        parkCivilHelicopter(pad.x, pad.y, -Math.PI / 2, b);
        roofs++;
        parked++;
      }
      for (const spot of CIVIL_HELI_GROUND)
        if (canSpawnCar('helicopter', spot.x, spot.y, spot.a, 8, 'bell429')) {
          parkCivilHelicopter(spot.x, spot.y, spot.a, null);
          parked++;
          break;
        }
      return parked;
    }
    // Console: where the civil helicopters are (civilHelicopters()).
    function civilHelicopterReport() {
      const list = [];
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (c.type === 'helicopter' && c.airframe === 'bell429')
          list.push({ id: c.id, x: Math.round(c.x), y: Math.round(c.y), altitude: Math.round(c.altitude || 0), roof: !!c.roofSite, hp: Math.round(c.hp), player: c === player.car });
      }
      return { spec: { name: HELICOPTER_AIRFRAMES.bell429.name, l: HELICOPTER_AIRFRAMES.bell429.l, rotorRadius: HELICOPTER_AIRFRAMES.bell429.rotorRadius }, list };
    }
