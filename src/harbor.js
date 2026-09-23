    // BEGIN SUBSYSTEM: src/harbor.js — Ironworks cargo terminal
    /**
     * Ironworks cargo terminal
     * Source: src/harbor.js
     * Scope: shared game closure.
     * Shared terminal geometry, crane loading, gates, guards and first-mission delivery rules.
     */
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
        x: 4480,
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
      harborGateUntil = 0,
      harborAlarmUntil = 0;
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
    function harborSolids() {
      return harborGate < 0.82
        ? [
            ...harborPermanentSolids,
            {
              x: HARBOR.gate.x - 2,
              y: HARBOR.gate.y - HARBOR.gate.half,
              w: 4,
              h: HARBOR.gate.half * 2,
              height: 13,
              barrier: true,
            },
          ]
        : harborPermanentSolids;
    }
    function harborBlocked(x, y, r = 0) {
      return harborSolids().some(
        (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h,
      );
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
      if (faction === 'harbor') harborAlarmUntil = gameTime + 25;
    }
    function notifyViolence(source, kind = 'gunfire', attacker = null) {
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
    function loadHarborCargo() {
      const m = harborCargoJob();
      if (
        !m ||
        m.stage !== 2 ||
        m.loading ||
        player.car !== m.car ||
        Math.abs(m.car.speed) > 5 ||
        distanceBetween(m.car, HARBOR.bay) > 43
      )
        return false;
      m.loading = {
        index: m.collected,
        time: 0,
      };
      m.car.vx = m.car.vy = m.car.speed = 0;
      alertGang('harbor');
      tell('LOADING CRATE ' + (m.collected + 1) + ' / 3 · Stay stopped', 3);
      return true;
    }
    function harborInteract() {
      const m = harborCargoJob();
      if (m?.loading) {
        tell('Loading cargo. Accelerate to cancel.', 2);
        return true;
      }
      if (m?.stage === 2 && player.car === m.car && distanceBetween(player, HARBOR.bay) < 85) {
        if (Math.abs(m.car.speed) > 5) tell('Stop the truck inside the marked loading bay.', 3);
        else if (!loadHarborCargo()) tell('Park in the yellow loading bay.', 3);
        return true;
      }
      if (harborGate < 0.82 && distanceBetween(player, HARBOR.gate) < 110) {
        harborGateUntil = gameTime + 10;
        tell('Barrier opening · Restricted cargo terminal', 3);
        return true;
      }
      return false;
    }
    function startHarborJob(m) {
      clearHarborPolice();
      harborGateUntil = 0;
      harborAlarmUntil = 0;
      resetDepotDoors();
      for (const e of gangMembers)
        if (e.faction === 'harbor' && inHarbor(e.home.x, e.home.y)) {
          Object.assign(e, e.home, {
            hp: 80,
            knockedFor: 0,
            dazedFor: 0,
            impactCooldown: 0,
            playerThreatUntil: 0,
            policeThreatUntil: 0,
            lastShotAt: -100,
            aiming: false,
            timer: 1.5,
          });
        }
      m.packages = HARBOR.crates.map((p, i) => ({
        ...p,
        id: i,
        got: false,
      }));
      m.collected = 0;
      m.loading = null;
      m.car = spawnClearCar(
        'flatbed',
        HARBOR.truck.x,
        HARBOR.truck.y,
        HARBOR.truck.a,
        false,
        '#b69b68',
      );
      m.car.mission = true;
      m.car.cargoCount = 0;
      m.car.hp = m.car.maxhp = 460;
      setStage(0, m.car, 'PICK UP VINNY’S MARKED CARGO TRUCK');
    }
    /* THE DROP
       Driving the loaded truck into Vinny's warehouse is not the end of the job:
         stage 4  the truck is inside; the front roller shutter comes down behind
                  it (and backs off if anything is in the doorway);
         stage 5  the shutter is down, so the units outside lose the truck and
                  the back door swings open; the player leaves the truck and
                  walks out through the back door;
         win      standing on the pavement outside the back door, on foot,
                  having come through the building.
       Backing out before the shutter is down returns to the delivery stage. */
    function beginDepotDrop(m) {
      setDepotDoors(1, 1);
      noise(0.45, 0.2, 300);
      setStage(
        4,
        VINNY_DEPOT.inside,
        'STOP THE TRUCK · SHUTTER COMING DOWN',
        'vinny',
        'Brakes on. I am dropping the shutter behind you — they are right on your tail.',
      );
    }
    /* The shutter is down: nobody outside saw where the truck went. */
    function depotShutterDown(m) {
      m.cargoDelivered = true;
      m.truck = m.car;
      m.truck.cargoCount = 0;
      m.truck.mission = false;
      // The truck stays parked in the warehouse; losing it now cannot fail the job.
      m.car = null;
      m.throughBuilding = false;
      for (const c of vehicles) {
        if (!c.missionPursuit || c === player.car) continue;
        // Units that were chasing the truck go back to patrolling the streets.
        c.missionPursuit = false;
        c.pursuitTarget = null;
      }
      clearPolice(true);
      setDepotDoors(1, 0);
      noise(0.25, 0.25, 180);
      setStage(
        5,
        VINNY_DEPOT.exit,
        'GET OUT AND SLIP OUT THE BACK DOOR',
        'vinny',
        'Shutter is down and they have lost you. Leave the truck, out the back door, on foot.',
      );
      tell('Shutter down · the police lost the truck. Out the back door on foot.', 5);
    }
    function updateDepotDrop(missionState) {
      if (missionState.stage === 4) {
        missionState.target = VINNY_DEPOT.inside;
        if (!truckInsideDepot(missionState.car)) {
          // Reversed out under a closing shutter: open up and try again.
          setDepotDoors(0, 1);
          setStage(3, HARBOR.delivery, 'DRIVE THE TRUCK INTO VINNY’S WAREHOUSE');
          return;
        }
        missionState.instruction =
          Math.abs(missionState.car.speed) > 12
            ? 'STOP THE TRUCK · SHUTTER COMING DOWN'
            : 'HOLD ON · SHUTTER COMING DOWN';
        if (depotFrontShutter >= 1) depotShutterDown(missionState);
        return;
      }
      // Stage 5: out of the truck, through the building and out the back door.
      missionState.target = VINNY_DEPOT.exit;
      if (player.car) {
        missionState.instruction = 'GET OUT OF THE TRUCK · E';
        return;
      }
      missionState.instruction = 'SLIP OUT THE BACK DOOR';
      if (insideDepot(player.x, player.y)) missionState.throughBuilding = true;
      const exit = VINNY_DEPOT.exit;
      if (
        missionState.throughBuilding &&
        !player.roof &&
        player.y > VINNY_DEPOT.backDoor.y + 16 &&
        Math.abs(player.x - exit.x) < 70 &&
        Math.abs(player.y - exit.y) < 60
      ) {
        winMission();
        // Shut the back door behind the runner and roll the front back up.
        settleDepotDoors();
      }
    }
    function updateHarborMission(missionState, deltaSeconds) {
      if (missionState.stage >= 4) {
        updateDepotDrop(missionState);
        return;
      }
      if (missionState.stage === 0) {
        if (player.car === missionState.car)
          setStage(1, HARBOR.gate, 'DRIVE THE TRUCK TO THE HARBOR BARRIER');
        return;
      }
      if (player.car !== missionState.car) {
        missionState.target = missionState.car;
        missionState.instruction = 'RETURN TO VINNY’S CARGO TRUCK';
        missionState.loading = null;
        return;
      }
      if (missionState.stage === 1) {
        missionState.target = HARBOR.gate;
        missionState.instruction = 'DRIVE THE TRUCK TO THE HARBOR BARRIER';
        if (distanceBetween(missionState.car, HARBOR.gate) < 280) {
          harborGateUntil = gameTime + 10;
          if (harborGate > 0.82 && distanceBetween(missionState.car, HARBOR.gate) < 110)
            setStage(2, HARBOR.bay, 'PARK IN THE LOADING BAY · E TO LOAD');
        }
        return;
      }
      if (missionState.stage === 2) {
        missionState.target = HARBOR.bay;
        missionState.instruction = 'PARK IN THE LOADING BAY · E TO LOAD';
        if (missionState.loading) {
          if (
            Math.abs(missionState.car.speed) > 7 ||
            distanceBetween(missionState.car, HARBOR.bay) > 48
          ) {
            missionState.loading = null;
            tell('Loading cancelled. Stop in the bay and press E.', 3);
            return;
          }
          missionState.loading.time += deltaSeconds;
          if (missionState.loading.time >= 2.1) {
            missionState.packages[missionState.loading.index].got = true;
            missionState.collected++;
            missionState.car.cargoCount = missionState.collected;
            noise(0.13, 0.17, 500);
            if (missionState.collected === 3) {
              missionState.loading = null;
              missionState.exitPrevious = {
                x: missionState.car.x,
                y: missionState.car.y,
              };
              missionState.crossedHarborGate = false;
              setStage(3, HARBOR.gate, 'LEAVE THE HARBOR WITH ALL THREE CRATES');
              tell('Cargo secure. Leave through the harbor barrier.', 4);
            } else
              missionState.loading = {
                index: missionState.collected,
                time: 0,
              };
          }
        }
        return;
      }
      if (
        !missionState.policeNotified &&
        missionState.collected === 3 &&
        truckClearedHarborExit(missionState)
      )
        notifyCargoPolice(missionState);
      missionState.target = missionState.policeNotified ? HARBOR.delivery : HARBOR.gate;
      // A truck that stops with its tail still under the shutter is told so.
      const tailInDoorway =
        missionState.policeNotified &&
        insideDepot(missionState.car.x, missionState.car.y) &&
        !truckInsideDepot(missionState.car);
      missionState.instruction = tailInDoorway
        ? 'PULL ALL THE WAY IN · CLEAR THE SHUTTER'
        : missionState.policeNotified
          ? missionState.cargoDisguised
            ? 'TRUCK RESPRAYED · DRIVE IT INTO VINNY’S WAREHOUSE'
            : 'RESPRAY THE TRUCK OR DRIVE INTO VINNY’S WAREHOUSE'
          : 'LEAVE THE HARBOR WITH ALL THREE CRATES';
      if (
        missionState.policeNotified &&
        truckInsideDepot(missionState.car) &&
        Math.abs(missionState.car.speed) < 32 &&
        missionState.collected === 3
      )
        beginDepotDrop(missionState);
    }
    function updateHarbor(deltaSeconds) {
      const near = distanceBetween(player, HARBOR.gate);
      if (player.car && near < 280 && Math.abs(player.y - HARBOR.gate.y) < 95)
        harborGateUntil = Math.max(harborGateUntil, gameTime + 5);
      const occupied =
        vehicles.some(
          (c) =>
            Math.abs(c.x - HARBOR.gate.x) < vehicleSpec(c).l / 2 + 18 &&
            Math.abs(c.y - HARBOR.gate.y) < HARBOR.gate.half + 12,
        ) ||
        (Math.abs(player.x - HARBOR.gate.x) < 24 &&
          Math.abs(player.y - HARBOR.gate.y) < HARBOR.gate.half);
      if (occupied && harborGate > 0.7) harborGateUntil = Math.max(harborGateUntil, gameTime + 2);
      harborGate = clamp(
        harborGate + (gameTime < harborGateUntil ? 1 : -1) * deltaSeconds * 0.85,
        0,
        1,
      );
      const m = harborCargoJob();
      if (
        m &&
        m.stage === 2 &&
        !player.roof &&
        HARBOR.crates.some((p) => distanceBetween(player, p) < 115)
      ) {
        const witness = [...gangMembers, ...enemies].some(
          (e) =>
            e.faction === 'harbor' &&
            e.hp > 0 &&
            distanceBetween(e, player) < 300 &&
            clearSight(e, player),
        );
        if (witness) alertGang('harbor');
      }
    }
    function paintHarborGround(drawingContext) {
      drawingContext.save();
      drawingContext.fillStyle = '#778184';
      drawingContext.fillRect(HARBOR.x, HARBOR.y, HARBOR.w, HARBOR.h);
      drawingContext.strokeStyle = '#5e686d';
      drawingContext.lineWidth = 1;
      for (let x = HARBOR.x; x < 3415; x += 50) {
        drawingContext.beginPath();
        drawingContext.moveTo(x, HARBOR.y);
        drawingContext.lineTo(x, 1780);
        drawingContext.stroke();
      }
      for (let y = HARBOR.y; y < 1780; y += 50) {
        drawingContext.beginPath();
        drawingContext.moveTo(HARBOR.x, y);
        drawingContext.lineTo(3415, y);
        drawingContext.stroke();
      }
      for (let i = 0; i < 120; i++) {
        const x = 2790 + ((i * 173) % 605),
          y = 1240 + ((i * 107) % 520);
        drawingContext.fillStyle = i % 3 ? '#92979316' : '#25313712';
        drawingContext.fillRect(x, y, 8 + (i % 9) * 3, 2 + (i % 5) * 2);
      }
      drawingContext.strokeStyle = '#29363b30';
      drawingContext.lineWidth = 0.8;
      for (let i = 0; i < 14; i++) {
        const x = 2800 + ((i * 131) % 590),
          y = 1240 + ((i * 89) % 520);
        drawingContext.beginPath();
        drawingContext.moveTo(x, y);
        drawingContext.lineTo(x + 12, y + 5);
        drawingContext.lineTo(x + 18, y + 3);
        drawingContext.lineTo(x + 26, y + 10);
        drawingContext.stroke();
      }
      drawingContext.fillStyle = '#4d585f';
      drawingContext.fillRect(2780, 1608, 555, 112);
      drawingContext.fillRect(3160, 1350, 105, 375);
      drawingContext.strokeStyle = '#d6b76c';
      drawingContext.lineWidth = 3;
      drawingContext.setLineDash([12, 8]);
      drawingContext.strokeRect(HARBOR.bay.x - 48, HARBOR.bay.y - 62, 96, 124);
      drawingContext.setLineDash([]);
      drawingContext.fillStyle = '#d3b55f';
      for (let y = 1240; y < 1770; y += 22) drawingContext.fillRect(3394, y, 16, 9);
      drawingContext.font = 'bold 14px monospace';
      drawingContext.textAlign = 'center';
      drawingContext.fillText('CARGO 03', 3210, 1440);
      drawingContext.fillText('IRONWORKS TERMINAL', 3000, 1655);
      drawingContext.restore();
    }
    function buildHarbor() {
      paintHarborGround(groundContext);
      for (const b of HARBOR.warehouses) {
        makeBuilding(b.x, b.y, b.w, b.h, 2, true);
        Object.assign(buildings[buildings.length - 1], {
          height: b.height,
          harbor: true,
        });
      }
      for (let i = trees.length - 1; i >= 0; i--)
        if (inHarbor(trees[i].x, trees[i].y, 15)) trees.splice(i, 1);
      for (let i = lamps.length - 1; i >= 0; i--)
        if (inHarbor(lamps[i].x, lamps[i].y, 15)) lamps.splice(i, 1);
    }
    function drawHarbor2D() {
      const s = HARBOR.ship;
      if (
        visible(
          {
            x: s.x,
            y: s.y,
          },
          450,
        )
      ) {
        worldContext.save();
        worldContext.translate(s.x, s.y);
        worldContext.fillStyle = '#151f26';
        worldContext.beginPath();
        worldContext.moveTo(-s.w / 2, s.l / 2);
        worldContext.lineTo(-s.w / 2, -s.l * 0.35);
        worldContext.quadraticCurveTo(-s.w * 0.45, -s.l * 0.46, 0, -s.l / 2);
        worldContext.quadraticCurveTo(s.w * 0.45, -s.l * 0.46, s.w / 2, -s.l * 0.35);
        worldContext.lineTo(s.w / 2, s.l / 2);
        worldContext.closePath();
        worldContext.fill();
        worldContext.fillStyle = '#a07758';
        worldContext.fillRect(-s.w * 0.4, -s.l * 0.32, s.w * 0.8, s.l * 0.69);
        for (let y = -105; y < 60; y += 42)
          for (let x = -42; x < 35; x += 32) {
            worldContext.fillStyle = y % 3 ? '#506f79' : '#a36f42';
            worldContext.fillRect(x, y, 27, 35);
            worldContext.strokeStyle = '#182c32';
            worldContext.strokeRect(x, y, 27, 35);
          }
        worldContext.fillStyle = '#d8d7c9';
        worldContext.fillRect(-51, 94, 102, 57);
        worldContext.fillStyle = '#3c6d80';
        worldContext.fillRect(-46, 99, 92, 12);
        worldContext.fillStyle = '#263a43';
        worldContext.fillRect(-15, 125, 30, 25);
        worldContext.restore();
      }
      if (!visible(HARBOR.bay, 650)) return;
      worldContext.fillStyle = '#354447';
      for (const b of harborWalls) worldContext.fillRect(b.x, b.y, b.w, b.h);
      worldContext.strokeStyle = harborGate > 0.82 ? '#8dbd87' : '#e4ba58';
      worldContext.lineWidth = 4;
      worldContext.beginPath();
      worldContext.moveTo(HARBOR.gate.x, HARBOR.gate.y - 68);
      worldContext.lineTo(HARBOR.gate.x, HARBOR.gate.y - 68 + 136 * (1 - harborGate));
      worldContext.stroke();
      for (const c of HARBOR.containers) {
        worldContext.fillStyle = '#547887';
        worldContext.fillRect(c.x, c.y, c.w, c.h);
        worldContext.strokeStyle = '#344f5c';
        worldContext.lineWidth = 2;
        for (let x = c.x + 4; x < c.x + c.w; x += 6) {
          worldContext.beginPath();
          worldContext.moveTo(x, c.y);
          worldContext.lineTo(x, c.y + c.h);
          worldContext.stroke();
        }
      }
      for (const y of [1320, 1675]) {
        const x = 3360,
          reach = 125 + Math.sin(gameTime * 0.23 + y) * 24;
        worldContext.strokeStyle = '#e3b95e';
        worldContext.lineWidth = 9;
        worldContext.beginPath();
        worldContext.moveTo(x - 42, y);
        worldContext.lineTo(x + reach, y);
        worldContext.stroke();
        worldContext.fillStyle = '#c99943';
        worldContext.fillRect(x - 20, y - 23, 40, 46);
        worldContext.strokeStyle = '#252e32';
        worldContext.lineWidth = 2;
        worldContext.beginPath();
        worldContext.moveTo(x + reach, y);
        worldContext.lineTo(x + reach, y + 25);
        worldContext.stroke();
        worldContext.fillStyle = '#6d8590';
        worldContext.fillRect(x + reach - 12, y + 19, 24, 21);
      }
      const m = harborCargoJob();
      for (let i = 0; i < 3; i++) {
        if (m?.packages?.[i]?.got || (!m && missionIndex > 0)) continue;
        const p = HARBOR.crates[i];
        worldContext.fillStyle = '#402e20';
        worldContext.fillRect(p.x - 17, p.y - 15, 36, 34);
        worldContext.fillStyle = '#be8e4c';
        worldContext.fillRect(p.x - 16, p.y - 16, 32, 30);
        worldContext.strokeStyle = '#5c4229';
        worldContext.lineWidth = 2;
        for (let z = -10; z < 14; z += 6) {
          worldContext.beginPath();
          worldContext.moveTo(p.x - 14, p.y + z);
          worldContext.lineTo(p.x + 14, p.y + z);
          worldContext.stroke();
        }
        worldContext.fillStyle = '#efce74';
        worldContext.fillRect(p.x - 10, p.y - 16, 4, 30);
        worldContext.fillRect(p.x + 6, p.y - 16, 4, 30);
        marker(p, '#ffdc86', String(i + 1), 15);
      }
      if (m?.stage === 2) {
        worldContext.strokeStyle = '#f2d68d';
        worldContext.lineWidth = 3;
        worldContext.strokeRect(HARBOR.bay.x - 48, HARBOR.bay.y - 62, 96, 124);
      }
    }
    function drawHarborMap(drawingContext, big) {
      drawingContext.fillStyle = '#ad996b55';
      drawingContext.fillRect(HARBOR.x, HARBOR.y, HARBOR.w, HARBOR.h);
      drawingContext.strokeStyle = '#b69965';
      drawingContext.lineWidth = big ? 8 : 5;
      drawingContext.strokeRect(HARBOR.x, HARBOR.y, HARBOR.w, HARBOR.h);
      drawingContext.fillStyle = '#b7bab1';
      drawingContext.fillRect(HARBOR.ship.x - 64, HARBOR.ship.y - 187, 128, 374);
      const m = harborCargoJob();
      for (let i = 0; i < 3; i++) {
        if (m?.packages?.[i]?.got || (!m && missionIndex > 0)) continue;
        const p = HARBOR.crates[i];
        drawingContext.fillStyle = '#f4cf72';
        drawingContext.fillRect(p.x - 18, p.y - 18, 36, 36);
        drawingContext.strokeStyle = '#302b21';
        drawingContext.lineWidth = 4;
        drawingContext.strokeRect(p.x - 18, p.y - 18, 36, 36);
      }
      if (big) {
        drawingContext.font = 'bold 69px monospace';
        drawingContext.fillStyle = '#f7e3b4';
        drawingContext.textAlign = 'center';
        drawingContext.fillText('HARBOR', 3080, 1200);
      }
    }
    function drawHarborLabels3D(api) {
      const m = harborCargoJob();
      if (!m || distanceBetween(player, HARBOR.bay) > 1100) return;
      for (let i = 0; i < 3; i++) {
        if (m.packages[i].got) continue;
        const c = HARBOR.crates[i],
          q = api.project(c.x, c.y, 58);
        if (q.x < 24 || q.x > viewportWidth - 24 || q.y < 100 || q.y > viewportHeight - 150) continue;
        worldContext.fillStyle = '#17222bea';
        worldContext.fillRect(q.x - 34, q.y - 15, 68, 24);
        worldContext.strokeStyle = '#efd38b';
        worldContext.lineWidth = 1;
        worldContext.strokeRect(q.x - 34, q.y - 15, 68, 24);
        worldContext.fillStyle = '#ffe5a1';
        worldContext.font = 'bold 11px Arial';
        worldContext.textAlign = 'center';
        worldContext.fillText('CRATE ' + (i + 1), q.x, q.y + 1);
        worldContext.beginPath();
        worldContext.moveTo(q.x - 4, q.y + 12);
        worldContext.lineTo(q.x + 4, q.y + 12);
        worldContext.lineTo(q.x, q.y + 19);
        worldContext.fill();
      }
    }
    function drawTrafficLights2D() {
      for (const x of ROAD_CENTERS)
        for (const y of ROAD_ROWS) {
          if (
            !visible(
              {
                x,
                y,
              },
              100,
            ) ||
            !cityIntersectionAt(x, y) ||
            !groundAt(x, y, 92) ||
            inHarbor(x, y, 100)
          )
            continue;
          const state = trafficSignal(x, y);
          for (const [axis, dx, dy] of [
            ['vertical', 61, -65],
            ['horizontal', -65, 61],
          ]) {
            worldContext.fillStyle = '#263338';
            worldContext.fillRect(x + dx - 4, y + dy - 9, 8, 18);
            for (let i = 0; i < 3; i++) {
              worldContext.fillStyle =
                i ===
                {
                  red: 0,
                  amber: 1,
                  green: 2,
                }[state[axis]]
                  ? ['#ef6650', '#edc766', '#8ac99a'][i]
                  : '#475355';
              worldContext.beginPath();
              worldContext.arc(x + dx, y + dy - 5 + i * 5, 1.8, 0, TAU);
              worldContext.fill();
            }
          }
        }
    }
    // END SUBSYSTEM: src/harbor.js
