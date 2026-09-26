    // BEGIN SUBSYSTEM: src/chase.js — Cargo pursuit
    /**
     * Cargo pursuit
     * Source: src/chase.js
     * Scope: shared game closure.
     * Harbor police alert, air support and cargo encounter updates.
     */
    /* Harbor dispatch gives a head start; repainting the cargo truck breaks its identification. */
    const VINNY_DEPOT = {
      x: -1804,
      y: 4340,
      w: 280,
      h: 240,
      door: {
        x: -1664,
        y: 4340,
      },
      inside: {
        x: -1664,
        y: 4450,
      },
      // A personnel door in the back wall: too narrow for any vehicle, locked
      // while the truck is brought in, opened once the front shutter is down.
      // After the drop it is the only way out, and it has to be walked.
      backDoor: {
        x: -1666,
        y: 4576,
        half: 14,
      },
      // Just outside the back door, on the Stadium Way pavement: reaching this on
      // foot from inside the building completes the first mission.
      exit: {
        x: -1666,
        y: 4624,
      },
      height: 64,
    };
    // Side walls run the full depth; the front and back pieces butt against them
    // rather than overlapping, so the coplanar roofs do not flicker at the corners.
    const depotWalls = [
      {
        x: -1804,
        y: 4340,
        w: 8,
        h: 240,
      },
      {
        x: -1532,
        y: 4340,
        w: 8,
        h: 240,
      },
      // Back wall, either side of the 28-unit personnel door at x -1680..-1652.
      {
        x: -1796,
        y: 4572,
        w: 116,
        h: 8,
      },
      {
        x: -1652,
        y: 4572,
        w: 120,
        h: 8,
      },
      {
        x: -1796,
        y: 4340,
        w: 74,
        h: 8,
      },
      {
        x: -1606,
        y: 4340,
        w: 74,
        h: 8,
      },
    ];
    /* The front roller shutter and the hinged back door. 0 is fully open and
       1 fully closed. The shutter rolls at the same rate as the harbor barrier;
       the door swings a little quicker. */
    let depotFrontShutter = 0,
      depotBackDoor = 1,
      depotFrontTarget = 0,
      depotBackTarget = 1,
      // Mission 1 after the shutter is down (harbor.js THE DROP): no officer
      // crosses the warehouse's walls, in or out, by either door
      // (depotPoliceBlocked), and none reaches through them to cuff the player.
      depotSealed = false;
    // The front doorway, where a closing shutter must not come down on anything.
    // It stops short of where truckInsideDepot() counts a truck as inside.
    const DEPOT_DOORWAY = { x: -1722, y: 4318, w: 116, h: 32 };
    function depotSolids() {
      const list = [];
      if (depotFrontShutter > 0.2)
        list.push({
          x: -1722,
          y: 4338,
          w: 116,
          h: 7,
          height: 58,
          barrier: true,
        });
      if (depotBackDoor > 0.2)
        list.push({
          x: VINNY_DEPOT.backDoor.x - VINNY_DEPOT.backDoor.half,
          y: 4572,
          w: VINNY_DEPOT.backDoor.half * 2,
          h: 8,
          height: 46,
          barrier: true,
        });
      return list;
    }
    /* A vehicle in the doorway, or about to be: where it will be in 0.6 s counts
       too, so a truck reversing out lifts the shutter before it reaches it. */
    function inDepotDoorway(c) {
      const d = DEPOT_DOORWAY,
        inDoorway = (p) => p.x + 2 > d.x && p.x - 2 < d.x + d.w && p.y + 2 > d.y && p.y - 2 < d.y + d.h;
      if (isAircraft(c) || Math.abs(c.x - (d.x + d.w / 2)) > 180 || Math.abs(c.y - (d.y + d.h / 2)) > 180)
        return false;
      const ahead = { x: c.x + (c.vx || 0) * 0.6, y: c.y + (c.vy || 0) * 0.6, a: c.a, type: c.type };
      return corners(vehicleShape(c)).some(inDoorway) || corners(vehicleShape(ahead)).some(inDoorway);
    }
    /* The player or an ordinary vehicle in the front doorway. Pursuing police
       cars do not hold the shutter up: they are shoved back out by it instead
       (updateDepotDoors), or a tailing cruiser could stall the drop forever. */
    function depotDoorwayOccupied() {
      const d = DEPOT_DOORWAY;
      if (
        !player.car &&
        player.x + 8 > d.x &&
        player.x - 8 < d.x + d.w &&
        player.y + 8 > d.y &&
        player.y - 8 < d.y + d.h
      )
        return true;
      return vehicles.some((c) => !c.missionPursuit && inDepotDoorway(c));
    }
    /* Whether a point is inside the depot's four walls. */
    function insideDepot(x, y, margin = 0) {
      return (
        x > VINNY_DEPOT.x + 8 + margin &&
        x < VINNY_DEPOT.x + VINNY_DEPOT.w - 8 - margin &&
        y > VINNY_DEPOT.y + 8 + margin &&
        y < VINNY_DEPOT.y + VINNY_DEPOT.h - 8 - margin
      );
    }
    function depotBlocked(x, y, r = 0) {
      if (x < -1744 || x > -1584 || y < 4320 || y > 4590) return false;
      return depotSolids().some(
        (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h,
      );
    }
    function depotBarriers() {
      return Math.abs(player.x + 1664) < 900 && Math.abs(player.y - 4460) < 900 ? depotSolids() : [];
    }
    // Snap both doors to their idle state: shutter up, back door shut. Used when
    // a mission starts, fails or is restarted, so no run inherits a closed depot.
    function resetDepotDoors() {
      depotFrontShutter = depotFrontTarget = 0;
      depotBackDoor = depotBackTarget = 1;
      depotSealed = false;
    }
    /* A police officer's step that would cross the sealed warehouse's walls
       (game.js footStepBlocked): the units outside cannot follow the truck in,
       even once the back door stands open, and those shut in cannot leave. */
    function depotPoliceBlocked(body, x, y) {
      return depotSealed && insideDepot(body.x, body.y, -10) !== insideDepot(x, y, -10);
    }
    /* Whether the sealed warehouse's walls stand between two people. */
    function depotSeparates(a, b) {
      return depotSealed && insideDepot(a.x, a.y, -10) !== insideDepot(b.x, b.y, -10);
    }
    // After a completed drop, animate back to idle instead of snapping: the back
    // door swings shut behind the runner and the shutter rolls up on the truck.
    function settleDepotDoors() {
      depotFrontShutter = 1;
      depotBackDoor = 0;
      setDepotDoors(0, 1);
    }
    function setDepotDoors(front, back) {
      depotFrontTarget = front;
      depotBackTarget = back;
    }
    function updateDepotDoors(deltaSeconds) {
      // Like a real shutter's safety edge: anything in the doorway sends a closing
      // shutter back up, and it comes down again once the way is clear.
      const closing = depotFrontTarget > depotFrontShutter;
      if (closing)
        for (const c of vehicles)
          if (c.missionPursuit && c !== player.car && inDepotDoorway(c)) {
            // The descending shutter pushes a tailing cruiser back onto the street.
            c.vy = Math.min(c.vy, -40);
            c.vx *= 0.5;
          }
      // Officers on foot do not hold the shutter up either: one caught under it
      // as it comes down steps through to whichever side they were nearer.
      if (closing && depotFrontShutter > 0.12)
        for (const o of officers) {
          const d = DEPOT_DOORWAY;
          if (o.hp <= 0 || o.x < d.x - 6 || o.x > d.x + d.w + 6 || o.y < 4326 || o.y > 4356) continue;
          o.y = o.y >= 4341 ? 4356 : 4326;
        }
      if (closing && depotFrontShutter < 0.95 && depotDoorwayOccupied())
        depotFrontShutter = Math.max(0, depotFrontShutter - deltaSeconds * 0.8);
      else if (Math.abs(depotFrontTarget - depotFrontShutter) > 1e-4)
        depotFrontShutter = clamp(
          depotFrontShutter + Math.sign(depotFrontTarget - depotFrontShutter) * deltaSeconds * 0.55,
          0,
          1,
        );
      if (Math.abs(depotBackTarget - depotBackDoor) > 1e-4)
        depotBackDoor = clamp(depotBackDoor + Math.sign(depotBackTarget - depotBackDoor) * deltaSeconds * 0.9, 0, 1);
    }
    // Vinny's crew clears the warehouse floor: parked vehicles left inside (the
    // mission 1 truck, a delivered hot car or repo) are taken away, so the next
    // job that ends by driving in (The Manifest, Rush Hour, Repo Man) finds
    // room. The player's own vehicle is never touched.
    function clearDepotFloor() {
      for (let i = vehicles.length - 1; i >= 0; i--) {
        const c = vehicles[i];
        if (c === player.car || isAircraft(c) || !insideDepot(c.x, c.y)) continue;
        for (let j = officers.length - 1; j >= 0; j--) if (officers[j].car === c) officers.splice(j, 1);
        vehicles.splice(i, 1);
      }
    }
    function depotOverlap(x, y, w, h) {
      return x + w > -1829 && x < -1499 && y + h > 4250 && y < 4605;
    }
    function paintDepotGround(drawingContext) {
      drawingContext.save();
      drawingContext.fillStyle = '#626d72';
      drawingContext.fillRect(-1824, 4280, 320, 320);
      drawingContext.fillStyle = '#4b545c';
      drawingContext.fillRect(-1722, 4224, 116, 360);
      drawingContext.fillStyle = '#8b8980';
      drawingContext.fillRect(-1796, 4348, 264, 224);
      drawingContext.strokeStyle = '#d4bc70';
      drawingContext.lineWidth = 3;
      drawingContext.strokeRect(-1714, 4364, 100, 180);
      drawingContext.setLineDash([12, 9]);
      for (const x of [-1709, -1619]) {
        drawingContext.beginPath();
        drawingContext.moveTo(x, 4240);
        drawingContext.lineTo(x, 4330);
        drawingContext.stroke();
      }
      drawingContext.setLineDash([]);
      drawingContext.font = 'bold 17px monospace';
      drawingContext.textAlign = 'center';
      drawingContext.fillStyle = '#e9d294';
      drawingContext.fillText('MORETTI FREIGHT', -1664, 4310);
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
        !mission.cargoDelivered &&
        mission.car?.hp > 0
        ? mission
        : null;
    }
    function spawnCargoPatrol(m) {
      const target = m.car,
        options = [];
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_ROWS) {
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
      // The gate camera reads the plate on the way out: units roll straight away,
      // and the force helicopter is five seconds behind them.
      m.policeArrivalIn = 0;
      m.airDelay = 5;
      clearPolice();
      announce('HARBOR SECURITY · STOLEN CARGO', 'UNITS ROLLING', 3);
      tell('Gate camera got the plate. Units are already moving — air support in 5.', 6);
      radio('call-backup');
    }
    function dispatchCargoPolice(m) {
      if (m.policeArrived || m.cargoDisguised) return;
      m.policeArrived = true;
      m.policeArrivalIn = 0;
      m.dispatchTimer = 6;
      crime(3);
      wantedStars = Math.max(3, wantedStars);
      for (let i = 0; i < 3; i++) {
        const patrol = spawnCargoPatrol(m);
        if (patrol) patrol.interceptor = i % 2 === 1;
      }
      tell('Respray the truck at an R garage, or drive it into Vinny’s warehouse. Bridges will be cut.', 6);
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
      // "Police cleared" only when stars actually drop: a respray in the moment
      // between the gate camera and the first units rolling had nothing to clear.
      const wasWanted = wantedStars > 0;
      clearPolice();
      if (wasWanted) policeClearedNotice();
      m.target = HARBOR.delivery;
      m.instruction = 'TRUCK RESPRAYED · DRIVE IT INTO VINNY’S WAREHOUSE';
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
      if (m.airDelay > 0) {
        m.airDelay -= deltaSeconds;
        if (m.airDelay <= 0) {
          m.airDelay = 0;
          m.airUnit = requestAirSupport(m.car, true);
          announce('AIR UNIT ONE · OVERHEAD', 'HELICOPTER INBOUND', 3);
        }
      }
      wantedStars = Math.max(3, wantedStars);
      searchActive = false;
      searchRemaining = policeSearchSeconds();
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
        // A police helicopter tops out at about 260 km/h: only a sports car on
        // an open road outruns it.
        speed = Math.min(260 * KMH, d * 1.1);
      vehicle.vx += ((dx / Math.max(d, 1)) * speed - vehicle.vx) * Math.min(1, stepSeconds * 1.8);
      vehicle.vy += ((dy / Math.max(d, 1)) * speed - vehicle.vy) * Math.min(1, stepSeconds * 1.8);
      const desired = headingBetween(vehicle, t),
        delta = normalizeAngle(desired - vehicle.a);
      vehicle.av = clamp(delta * 2, -1.2, 1.2);
      vehicle.a = normalizeAngle(vehicle.a + vehicle.av * stepSeconds);
      const desiredAltitude =
        // 35 m up, or 8 m over the nearest rooftops (towers reach 130 m and more).
        Math.max(terrainHeight(vehicle.x, vehicle.y) + 280, entityElevation(t) + 120, roofHeightNear(vehicle.x, vehicle.y, 140) + 64) +
        (vehicle.airOrbit ? 65 : 0) +
        Math.sin(gameTime * 0.6) * 4;
      vehicle.altitude += (desiredAltitude - vehicle.altitude) * Math.min(1, stepSeconds * 0.7);
      vehicle.vz = 0;
      vehicle.speed = Math.hypot(vehicle.vx, vehicle.vy);
      vehicle.rotorSpeed = 1;
    }
    function cleanupMissionExtras() {
      player.disguised = false;
      resetDepotDoors();
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
      if (depotFrontShutter > 0.2) worldContext.fillRect(-1722, 4340, 116, 7);
      if (depotBackDoor > 0.2) worldContext.fillRect(-1680, 4572, 28, 8);
      worldContext.fillStyle = '#ebd68e';
      worldContext.font = 'bold 16px monospace';
      worldContext.textAlign = 'center';
      worldContext.fillText('VINNY’S WAREHOUSE', -1664, 4326);
      worldContext.fillStyle = '#bc9364';
      for (const x of [-1774, -1564])
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
