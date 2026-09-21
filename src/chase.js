    // BEGIN SUBSYSTEM: src/chase.js — Cargo pursuit
    /**
     * Cargo pursuit
     * Source: src/chase.js
     * Scope: shared game closure.
     * Harbor police alert, air support and cargo encounter updates.
     */
    /* Harbor dispatch gives a head start; repainting the cargo truck breaks its identification. */
    const VINNY_DEPOT = {
      x: 4340,
      y: 4340,
      w: 280,
      h: 240,
      door: {
        x: 4480,
        y: 4340,
      },
      inside: {
        x: 4480,
        y: 4450,
      },
      height: 64,
    };
    const depotWalls = [
      {
        x: 4340,
        y: 4340,
        w: 8,
        h: 240,
      },
      {
        x: 4612,
        y: 4340,
        w: 8,
        h: 240,
      },
      {
        x: 4340,
        y: 4572,
        w: 280,
        h: 8,
      },
      {
        x: 4340,
        y: 4340,
        w: 82,
        h: 8,
      },
      {
        x: 4538,
        y: 4340,
        w: 82,
        h: 8,
      },
    ];
    function depotOverlap(x, y, w, h) {
      return x + w > 4315 && x < 4645 && y + h > 4250 && y < 4605;
    }
    function paintDepotGround(drawingContext) {
      drawingContext.save();
      drawingContext.fillStyle = '#626d72';
      drawingContext.fillRect(4320, 4280, 320, 320);
      drawingContext.fillStyle = '#4b545c';
      drawingContext.fillRect(4422, 4224, 116, 360);
      drawingContext.fillStyle = '#8b8980';
      drawingContext.fillRect(4348, 4348, 264, 224);
      drawingContext.strokeStyle = '#d4bc70';
      drawingContext.lineWidth = 3;
      drawingContext.strokeRect(4430, 4364, 100, 180);
      drawingContext.setLineDash([12, 9]);
      for (const x of [4435, 4525]) {
        drawingContext.beginPath();
        drawingContext.moveTo(x, 4240);
        drawingContext.lineTo(x, 4330);
        drawingContext.stroke();
      }
      drawingContext.setLineDash([]);
      drawingContext.font = 'bold 17px monospace';
      drawingContext.textAlign = 'center';
      drawingContext.fillStyle = '#e9d294';
      drawingContext.fillText('MORETTI FREIGHT', 4480, 4310);
      drawingContext.restore();
    }
    function buildVinnyDepot() {
      paintDepotGround(groundContext);
      for (const w of depotWalls) {
        makeBuilding(w.x, w.y, w.w, w.h, 2, true);
        Object.assign(buildings[buildings.length - 1], {
          height: 64,
          depotWall: true,
        });
      }
      for (let i = trees.length - 1; i >= 0; i--)
        if (depotOverlap(trees[i].x, trees[i].y, 20, 20)) trees.splice(i, 1);
      for (let i = lamps.length - 1; i >= 0; i--)
        if (depotOverlap(lamps[i].x, lamps[i].y, 10, 10)) lamps.splice(i, 1);
    }
    function truckInsideDepot(c) {
      return (
        !!c &&
        corners(vehicleShape(c, 2)).every(
          (p) =>
            p.x > VINNY_DEPOT.x + 10 &&
            p.x < VINNY_DEPOT.x + VINNY_DEPOT.w - 10 &&
            p.y > VINNY_DEPOT.y + 14 &&
            p.y < VINNY_DEPOT.y + VINNY_DEPOT.h - 10,
        )
      );
    }
    function cargoChase() {
      return mission?.index === 0 &&
        mission.policeNotified &&
        !mission.cargoDisguised &&
        mission.car?.hp > 0
        ? mission
        : null;
    }
    function spawnCargoPatrol(m) {
      const target = m.car,
        options = [];
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_CENTERS) {
          const d = distanceBetween(
            {
              x,
              y,
            },
            target,
          );
          if (
            d > 410 &&
            d < 850 &&
            !inHarbor(x, y, 150) &&
            !depotOverlap(x, y, 60, 60) &&
            canSpawnCar(
              'police',
              x,
              y,
              headingBetween(
                {
                  x,
                  y,
                },
                target,
              ),
              14,
            )
          )
            options.push({
              x,
              y,
              d,
            });
        }
      if (!options.length && (target.x > CITY_SIZE || target.y > CITY_SIZE)) {
        for (const p of countyPoliceNodes()) {
          const d = distanceBetween(p, target);
          if (d > 410 && d < 1400 && canSpawnCar('police', p.x, p.y, headingBetween(p, target), 14))
            options.push({
              x: p.x,
              y: p.y,
              d,
            });
        }
      }
      if (!options.length) return null;
      options.sort((a, b) => a.d - b.d);
      const p =
          options[
            Math.min(options.length - 1, Math.floor(seededRandom() * Math.min(5, options.length)))
          ],
        vehicle = makeCar('police', p.x, p.y, headingBetween(p, target), true);
      Object.assign(vehicle, {
        cop: true,
        missionPursuit: true,
        pursuitTarget: target,
        routeTime: 0,
        speed: 70,
        vx: Math.cos(vehicle.a) * 70,
        vy: Math.sin(vehicle.a) * 70,
      });
      return vehicle;
    }
    function notifyCargoPolice(m) {
      if (m.policeNotified) return;
      m.policeNotified = true;
      m.policeArrived = false;
      m.policeArrivalIn = 10;
      clearPolice();
      announce('HARBOR SECURITY · STOLEN CARGO', 'COPS ALERTED', 3);
      tell(
        'Cops arrive in 10 seconds. Respray the truck at an R garage to lose them — Vinny covers this paint job.',
        7,
      );
      radio('call-backup');
    }
    function dispatchCargoPolice(m) {
      if (m.policeArrived || m.cargoDisguised) return;
      m.policeArrived = true;
      m.policeArrivalIn = 0;
      m.dispatchTimer = 7;
      crime(3);
      wantedStars = Math.max(3, wantedStars);
      for (let i = 0; i < 2; i++) spawnCargoPatrol(m);
      m.airUnit = requestAirSupport(m.car, true);
      tell(
        'Police have arrived. Respray the cargo truck at an R garage or reach Vinny’s warehouse.',
        5,
      );
    }
    function evadeCargoPolice(vehicle) {
      const m = cargoChase();
      if (!m || m.car !== vehicle) return false;
      m.cargoDisguised = true;
      m.policeArrivalIn = 0;
      m.dispatchTimer = 0;
      m.airUnit = null;
      const removed = new Set(vehicles.filter((o) => o.missionPursuit && o !== player.car));
      for (const o of officers) if (removed.has(o.car)) removed.add(o);
      for (let i = vehicles.length - 1; i >= 0; i--)
        if (removed.has(vehicles[i])) vehicles.splice(i, 1);
      for (let i = officers.length - 1; i >= 0; i--)
        if (removed.has(officers[i])) officers.splice(i, 1);
      for (let i = bullets.length - 1; i >= 0; i--)
        if (removed.has(bullets[i].owner)) bullets.splice(i, 1);
      clearPolice();
      policeClearedNotice();
      m.target = HARBOR.delivery;
      m.instruction = 'TRUCK RESPRAYED · DELIVER THE CRATES TO VINNY';
      return true;
    }
    function updateCargoPursuit(deltaSeconds) {
      const m = cargoChase();
      if (!m || gameMode !== 'play') return;
      if (!m.policeArrived) {
        m.policeArrivalIn = Math.max(0, m.policeArrivalIn - deltaSeconds);
        if (m.policeArrivalIn > 1e-7) return;
        dispatchCargoPolice(m);
        return;
      }
      wantedStars = Math.max(3, wantedStars);
      searchActive = false;
      searchRemaining = 21;
      lastSeen = {
        x: m.car.x,
        y: m.car.y,
      };
      for (const vehicle of vehicles)
        if (vehicle.missionPursuit && vehicle.type === 'police' && vehicle !== player.car) {
          vehicle.gangTarget = null;
          vehicle.pursuitTarget = m.car;
          vehicle.cop = vehicle.hp > 0;
        }
      m.dispatchTimer -= deltaSeconds;
      if (m.dispatchTimer <= 0) {
        m.dispatchTimer = 7;
        if (vehicles.filter((c) => c.missionPursuit && c.type === 'police' && c.hp > 0).length < 4)
          spawnCargoPatrol(m);
      }
      for (let i = vehicles.length - 1; i >= 0; i--) {
        const vehicle = vehicles[i];
        if (
          vehicle.missionPursuit &&
          !vehicle.airUnit &&
          vehicle !== player.car &&
          distanceBetween(vehicle, m.car) > 1700
        ) {
          vehicles.splice(i, 1);
        }
      }
    }
    function policeHelicopterControl(vehicle, stepSeconds) {
      const t = vehicle.pursuitTarget;
      if (!t || t.hp <= 0) return;
      const orbit = gameTime * 0.15,
        radius = vehicle.airState === 'searching' ? 210 : 140,
        target = {
          x: t.x + Math.cos(orbit) * radius,
          y: t.y + Math.sin(orbit) * radius,
        },
        dx = target.x - vehicle.x,
        dy = target.y - vehicle.y,
        d = Math.hypot(dx, dy),
        speed = Math.min(300, d * 1.1);
      vehicle.vx += ((dx / Math.max(d, 1)) * speed - vehicle.vx) * Math.min(1, stepSeconds * 1.8);
      vehicle.vy += ((dy / Math.max(d, 1)) * speed - vehicle.vy) * Math.min(1, stepSeconds * 1.8);
      const desired = headingBetween(vehicle, t),
        delta = normalizeAngle(desired - vehicle.a);
      vehicle.av = clamp(delta * 2, -1.2, 1.2);
      vehicle.a = normalizeAngle(vehicle.a + vehicle.av * stepSeconds);
      const desiredAltitude =
        Math.max(terrainHeight(vehicle.x, vehicle.y) + 280, entityElevation(t) + 120) +
        (vehicle.airOrbit ? 65 : 0) +
        Math.sin(gameTime * 0.6) * 4;
      vehicle.altitude += (desiredAltitude - vehicle.altitude) * Math.min(1, stepSeconds * 0.7);
      vehicle.vz = 0;
      vehicle.speed = Math.hypot(vehicle.vx, vehicle.vy);
      vehicle.rotorSpeed = 1;
    }
    function cleanupMissionExtras() {
      player.disguised = false;
      for (let i = vehicles.length - 1; i >= 0; i--)
        if (vehicles[i].missionPursuit || vehicles[i].reconPatrol) {
          const c = vehicles[i];
          if (c === player.car) {
            // A stolen pursuit car or boarded launch stays in the world with the player.
            c.missionPursuit = c.reconPatrol = c.cop = false;
            c.pursuitTarget = null;
            continue;
          }
          for (let j = officers.length - 1; j >= 0; j--)
            if (officers[j].car === c) officers.splice(j, 1);
          vehicles.splice(i, 1);
        }
      for (let i = storyActors.length - 1; i >= 0; i--)
        if (['rooftop-hit', 'flight-witness'].includes(storyActors[i].missionTag))
          storyActors.splice(i, 1);
      getElement('stealthStatus').style.display = 'none';
    }
    function drawDepot2D() {
      if (!visible(VINNY_DEPOT.inside, 420)) return;
      const v = VINNY_DEPOT;
      worldContext.fillStyle = '#283943';
      for (const w of depotWalls) worldContext.fillRect(w.x, w.y, w.w, w.h);
      worldContext.strokeStyle = '#c5bfaa';
      worldContext.lineWidth = 2;
      worldContext.strokeRect(v.x, v.y, v.w, v.h);
      worldContext.fillStyle = '#172631';
      worldContext.fillRect(4422, 4340, 116, 7);
      worldContext.fillStyle = '#ebd68e';
      worldContext.font = 'bold 16px monospace';
      worldContext.textAlign = 'center';
      worldContext.fillText('VINNY’S WAREHOUSE', 4480, 4326);
      worldContext.fillStyle = '#bc9364';
      for (const x of [4370, 4580])
        for (let y = 4380; y < 4550; y += 34) worldContext.fillRect(x - 10, y - 10, 20, 20);
      if (cargoChase()) marker(VINNY_DEPOT.inside, '#d7ef97', '↓');
    }
    function drawAirSearch2D() {
      const h = vehicles.find((c) => c.airUnit && c.hp > 0 && !c.airRetreat),
        t = airSearchPoint(h);
      if (!t || !visible(t, 300)) return;
      worldContext.fillStyle = '#dcecff17';
      worldContext.beginPath();
      worldContext.moveTo(h.x, h.y - 84);
      worldContext.lineTo(t.x - 55, t.y);
      worldContext.lineTo(t.x + 55, t.y);
      worldContext.closePath();
      worldContext.fill();
      worldContext.strokeStyle = '#e1efff6f';
      worldContext.lineWidth = 2;
      worldContext.beginPath();
      worldContext.ellipse(t.x, t.y, 50, 35, 0, 0, TAU);
      worldContext.stroke();
    }
    // END SUBSYSTEM: src/chase.js
