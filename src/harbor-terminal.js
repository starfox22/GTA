    // Ironworks terminal geometry: HARBOR, the gate, solids, police hold, cargo slots and gang alerts (alertGang, notifyViolence).
    /* Ironworks cargo terminal: the same footprints drive missions, rendering and collisions. */
    const HARBOR = {
      x: 2780,
      y: 1230,
      w: 634,
      h: 550,
      gate: {
        x: 2780,
        y: 1664,
        half: 68,
      },
      bay: {
        x: 3210,
        y: 1520,
      },
      truck: {
        x: 1830,
        y: 704,
        a: 0,
      },
      delivery: {
        x: -1664,
        y: 4450,
      },
      ship: {
        x: 3525,
        y: 1455,
        w: 128,
        l: 374,
      },
      crates: [
        {
          x: 3290,
          y: 1468,
        },
        {
          x: 3290,
          y: 1520,
        },
        {
          x: 3290,
          y: 1572,
        },
      ],
      warehouses: [
        {
          x: 2820,
          y: 1270,
          w: 230,
          h: 165,
          height: 54,
        },
        {
          x: 2830,
          y: 1720,
          w: 255,
          h: 48,
          height: 28,
        },
      ],
      containers: [
        {
          x: 3075,
          y: 1265,
          w: 95,
          h: 36,
        },
        {
          x: 3075,
          y: 1310,
          w: 95,
          h: 36,
        },
        {
          x: 3140,
          y: 1716,
          w: 115,
          h: 34,
        },
      ],
    };
    let harborGate = 0,
      harborGateUntil = 0;
    const harborWalls = [
      {
        x: HARBOR.x,
        y: HARBOR.y,
        w: HARBOR.w,
        h: 5,
        height: 13,
      },
      {
        x: HARBOR.x,
        y: HARBOR.y + HARBOR.h - 5,
        w: HARBOR.w,
        h: 5,
        height: 13,
      },
      {
        x: HARBOR.x,
        y: HARBOR.y,
        w: 5,
        h: HARBOR.gate.y - HARBOR.gate.half - HARBOR.y,
        height: 13,
      },
      {
        x: HARBOR.x,
        y: HARBOR.gate.y + HARBOR.gate.half,
        w: 5,
        h: HARBOR.y + HARBOR.h - HARBOR.gate.y - HARBOR.gate.half,
        height: 13,
      },
    ];
    function inHarbor(x, y, margin = 0) {
      return (
        x > HARBOR.x - margin &&
        x < HARBOR.x + HARBOR.w + margin &&
        y > HARBOR.y - margin &&
        y < HARBOR.y + HARBOR.h + margin
      );
    }
    function harborOverlap(x, y, w, h) {
      return (
        x + w > HARBOR.x - 12 &&
        x < HARBOR.x + HARBOR.w + 12 &&
        y + h > HARBOR.y - 12 &&
        y < HARBOR.y + HARBOR.h + 12
      );
    }
    const harborPermanentSolids = [
      ...harborWalls,
      ...HARBOR.containers.map((c) => ({
        ...c,
        height: c.y < 1400 ? 48 : 24,
      })),
      ...[1320, 1675].flatMap((z) =>
        [3322, 3390].flatMap((x) =>
          [-23, 23].map((d) => ({
            x: x - 3,
            y: z + d - 3,
            w: 6,
            h: 6,
            height: 96,
          })),
        ),
      ),
    ];
    // With the barrier down the gate is one more solid; that list is made once
    // (solid() asks for it on every call) rather than copied every time.
    let harborClosedSolids = null;
    function harborSolids() {
      if (harborGate >= 0.82) return harborPermanentSolids;
      return (harborClosedSolids ||= [
        ...harborPermanentSolids,
        {
          x: HARBOR.gate.x - 2,
          y: HARBOR.gate.y - HARBOR.gate.half,
          w: 4,
          h: HARBOR.gate.half * 2,
          height: 13,
          barrier: true,
        },
      ]);
    }
    function harborBlocked(x, y, r = 0) {
      return rectListBlocked(harborSolids(), x, y, r);
    }
    function harborVehicleBlocked(vehicle) {
      return harborSolids().some((b) =>
        boxContact(vehicleShape(vehicle), {
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          hx: b.w / 2,
          hy: b.h / 2,
          a: 0,
        }),
      );
    }
    function harborCargoJob() {
      return mission?.index === 0 && Array.isArray(mission.packages) ? mission : null;
    }
    function harborPoliceHold() {
      return mission?.index === 0 && !mission.policeArrived && !mission.cargoDisguised;
    }
    function harborPoliceProtected(x, y, margin = 0) {
      return harborPoliceHold() && inHarbor(x, y, margin);
    }
    function clearHarborPolice() {
      const removed = new Set(
        vehicles.filter(
          (c) => c.type === 'police' && c !== player.car && !c.stolen && inHarbor(c.x, c.y, 90),
        ),
      );
      for (let i = vehicles.length - 1; i >= 0; i--)
        if (removed.has(vehicles[i])) vehicles.splice(i, 1);
      for (let i = officers.length - 1; i >= 0; i--)
        if (removed.has(officers[i].car) || inHarbor(officers[i].x, officers[i].y, 90)) {
          removed.add(officers[i]);
          officers.splice(i, 1);
        }
      for (let i = bullets.length - 1; i >= 0; i--)
        if (removed.has(bullets[i].owner)) bullets.splice(i, 1);
      for (const c of vehicles) {
        if (c.gangTarget && inHarbor(c.gangTarget.x, c.gangTarget.y)) {
          c.gangTarget = null;
          c.gangLastSeen = null;
        }
        if (c.route?.some((p) => inHarbor(p.x, p.y, 40))) c.route = null;
      }
    }
    function truckClearedHarborExit(m) {
      const c = m.car,
        previous = m.exitPrevious || c;
      if (previous.x >= HARBOR.gate.x && c.x < HARBOR.gate.x) {
        const t = (HARBOR.gate.x - previous.x) / (c.x - previous.x),
          y = previous.y + (c.y - previous.y) * t;
        if (Math.abs(y - HARBOR.gate.y) < HARBOR.gate.half) m.crossedHarborGate = true;
      }
      m.exitPrevious = {
        x: c.x,
        y: c.y,
      };
      return !!m.crossedHarborGate && corners(vehicleShape(c)).every((p) => p.x < HARBOR.gate.x);
    }
    function cargoPosition(c, i) {
      const x = -34 + i * 19;
      return {
        x: c.x + Math.cos(c.a) * x,
        y: c.y + Math.sin(c.a) * x,
        altitude: 19,
      };
    }
    function alertGang(faction, source = player) {
      for (const e of [...gangMembers, ...enemies])
        if (e.faction === faction && distanceBetween(e, source) < 580) {
          e.playerThreatUntil = gameTime + 45;
          e.lastPlayerSeen = {
            x: source.x,
            y: source.y,
          };
        }
    }
    function notifyViolence(source, kind = 'gunfire', attacker = null) {
      // Palm Keys Beach scatters too (beach.js).
      beachHearsViolence(source, kind);
      // So does the beach club next to it (beachclub.js).
      beachClubHearsViolence(source, kind, attacker);
      // An attack on MONARCH MOTORS sounds its alarm (dealership.js).
      dealershipHearsViolence(source, kind, attacker);
      // Pedestrians hear and see it through the crowd's perception (src/crowd.js).
      crowdAlarm(kind === 'explosion' ? 'explosion' : 'gunfire', source, attacker);
      for (const c of vehicles)
        if (
          c.ai &&
          c.type !== 'police' &&
          c.hp > 0 &&
          distanceBetween(c, source) < (kind === 'explosion' ? 380 : 150) &&
          clearSight(c, source)
        ) {
          c.panicUntil = gameTime + 7;
          c.threat = {
            x: source.x,
            y: source.y,
          };
        }
      if (attacker === player)
        for (const gang of GANGS)
          if (
            [...gangMembers, ...enemies].some(
              (e) =>
                e.hp > 0 &&
                e.faction === gang.id &&
                distanceBetween(e, source) < 280 &&
                clearSight(e, source),
            )
          )
            alertGang(gang.id);
    }
