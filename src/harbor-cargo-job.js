    // The cargo job: loading bay range, crane loading, the depot drop and stakeout, updateHarborMission and updateHarbor (gate, witnesses).
    /**
     * LOADING BAY RANGE
     * The prompt, E and the crane share one test with hysteresis so the truck
     * idling or creeping at the edge of a threshold cannot flip them frame to
     * frame: the truck is at the bay inside BAY_NEAR_ENTER and stays so until
     * BAY_NEAR_EXIT; it is ready to load once stopped (BAY_STOP_ENTER) inside
     * BAY_LOAD_ENTER and stays ready until it moves or drifts past the limits
     * that cancel a load in progress (BAY_STOP_EXIT, BAY_LOAD_EXIT).
     */
    const BAY_NEAR_ENTER = 85,
      BAY_NEAR_EXIT = 110,
      BAY_LOAD_ENTER = 43,
      BAY_LOAD_EXIT = 48,
      BAY_STOP_ENTER = 5,
      BAY_STOP_EXIT = 7;
    function updateBayState(m) {
      const truck = m?.stage === 2 && player.car === m.car ? m.car : null;
      if (!truck) {
        if (m) m.atBay = m.bayReady = false;
        return;
      }
      const distance = distanceBetween(truck, HARBOR.bay),
        speed = Math.abs(truck.speed);
      m.atBay = distance < (m.atBay ? BAY_NEAR_EXIT : BAY_NEAR_ENTER);
      m.bayReady =
        m.atBay &&
        (m.bayReady
          ? speed <= BAY_STOP_EXIT && distance <= BAY_LOAD_EXIT
          : speed <= BAY_STOP_ENTER && distance <= BAY_LOAD_ENTER);
    }
    /* The one owner of the loading-bay prompt (offered from civicUI). */
    function harborBayPrompt(m) {
      if (m?.stage !== 2 || !m.atBay) return;
      if (m.loading)
        offerPrompt('LOADING CRATE ' + (m.collected + 1) + ' / 3 · HOLD STILL', {
          key: null,
          id: 'harbor-loading',
        });
      else
        offerPrompt(m.bayReady ? 'LOAD CARGO' : 'LOAD CARGO · STOP IN THE YELLOW BAY', {
          id: 'harbor-load',
        });
    }
    function loadHarborCargo() {
      const m = harborCargoJob();
      updateBayState(m);
      if (!m || m.stage !== 2 || m.loading || !m.bayReady) return false;
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
      updateBayState(m);
      if (m?.atBay) {
        if (Math.abs(m.car.speed) > BAY_STOP_EXIT) tell('Stop the truck inside the marked loading bay.', 3);
        else if (!loadHarborCargo()) tell('Park in the yellow loading bay.', 3);
        return true;
      }
      if (harborGate < 0.82 && withinRange('harbor-gate', distanceBetween(player, HARBOR.gate), 110, 130)) {
        harborGateUntil = gameTime + 10;
        tell('Barrier opening · Restricted cargo terminal', 3);
        return true;
      }
      return false;
    }
    /* Vinny's truck waits at the north kerb (HARBOR.truck), in the westbound
       lane. Traffic can be passing that spot as the job starts: the truck then
       parks further along the same kerb, facing the same way, rather than being
       ring-searched (spawnClearCar) into the middle of the road or across it. */
    function spawnVinnyTruck() {
      const t = HARBOR.truck;
      for (const dx of [0, 24, -24, 48, 72, 96, 120, 144, 168, 192])
        if (canSpawnCar('flatbed', t.x + dx, t.y, t.a))
          return makeCar('flatbed', t.x + dx, t.y, t.a, false, '#b69b68');
      return spawnClearCar('flatbed', t.x, t.y, t.a, false, '#b69b68');
    }
    function startHarborJob(m) {
      clearHarborPolice();
      harborGateUntil = 0;
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
      m.car = spawnVinnyTruck();
      m.car.mission = true;
      m.car.cargoCount = 0;
      // Vinny's truck has a steel cage over the cab: the Harbor Kings open up on it
      // in the bay (alertGang, ~20 hp/s even at the 40% mission share), and a
      // careful three-point turn out of the bay must not lose the job.
      m.car.hp = m.car.maxhp = 620;
      setStage(0, m.car, 'PICK UP VINNY’S MARKED CARGO TRUCK');
    }
    /* THE DROP
       Driving the loaded truck into Vinny's warehouse is not the end of the job:
         stage 4  the truck is inside; the front roller shutter comes down behind
                  it (and backs off if anything is in the doorway);
         stage 5  the shutter is down and the warehouse is sealed (depotSealed,
                  chase.js): no officer crosses its walls either way. Any
                  officer who got in with the truck (on foot through the doorway,
                  or the crew of a cruiser that made it inside) has to be put
                  down: ELIMINATE POLICE · N LEFT. Skipped when nobody got in;
         stage 6  the truck stays inside on its own: EXIT THE TRUCK;
         stage 7  the back door swings open: ESCAPE ON FOOT THROUGH THE BACK DOOR
                  (the marker is on the door);
         win      out through the back door onto the pavement, on foot, having
                  come through the building. The units staking out the front
                  lose the trail at that moment (POLICE LOST), and a beat later
                  the job completes.
       While the player is inside during stages 5-7 the wanted level is held
       (depotStakeout, citylife.js updateWanted): the police know the truck went
       in, they just cannot get in after it. There is no "police lost" before the
       back door. Backing out before the shutter is down returns to the delivery
       stage; the truck destroyed before stage 7 fails the job as ever. */
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
    /* Officers still alive inside the sealed warehouse. A downed officer (hit
       hard, crawling, no longer shooting) still counts: he is a witness on the
       floor, and the marker stays on him until he is dealt with. (Inside the
       sealed warehouse a fatal body hit kills outright, wounds.js, so this is
       only the officer left under 26 hp.) */
    function depotPoliceInside() {
      return officers.filter(
        (o) => o.hp > 0 && !o.returned && o.state !== 'return' && insideDepot(o.x, o.y),
      );
    }
    function eliminateText(n) {
      return 'ELIMINATE POLICE · ' + n + ' LEFT';
    }
    /* The shutter is down: the warehouse is sealed with whoever is inside. */
    function depotShutterDown(m) {
      m.cargoDelivered = true;
      m.truck = m.car;
      m.truck.cargoCount = 0;
      // The cargo is in: the truck wrecked in the firefight round it (the
      // officers' rounds, the player's own) no longer fails the job.
      m.car = null;
      m.throughBuilding = false;
      m.escapedAt = 0;
      // The police saw the truck go in: the heat they had is held until the back
      // door (depotStakeout). Nothing is cleared here.
      m.depotHeat = Math.ceil(wantedStars);
      depotSealed = true;
      for (const c of vehicles) {
        if (c === player.car) continue;
        if (c.missionPursuit) {
          // Units that were chasing the truck now hunt the driver by the normal
          // rules; they stake out the building from the street.
          c.missionPursuit = false;
          c.pursuitTarget = null;
        }
        // A cruiser that made it in with the truck: its crew gets out to fight.
        if (lawVehicle(c) && c.hp > 0 && c.cop && insideDepot(c.x, c.y)) deployOfficers(c);
      }
      noise(0.25, 0.25, 180);
      const inside = depotPoliceInside();
      if (inside.length > 0) {
        const n = inside.length;
        setStage(
          5,
          inside[0],
          eliminateText(n),
          'vinny',
          n === 1 ? 'You brought a cop in with you. Deal with it.' : 'You brought company in with you. Deal with them.',
        );
        announce('SHUTTER DOWN · ' + n + (n === 1 ? ' OFFICER INSIDE' : ' OFFICERS INSIDE'), 'ELIMINATE POLICE', 3);
      } else depotInteriorClear(m, true);
    }
    /* Nobody left inside who can stop the drop. */
    function depotInteriorClear(m, straightAway = false) {
      if (straightAway)
        missionLine('vinny', 'Shutter is down. Leave the truck and go out the back door, on foot.');
      else {
        missionLine('vinny', 'That is the last of them. Leave the truck, out the back door, on foot.');
        announce('WAREHOUSE CLEAR', 'LEAVE THE TRUCK', 2.5);
      }
      m.stage = 6;
      updateDepotDrop(m);
      updateUI();
    }
    function depotEscapeStage(m) {
      // The truck is parked for good: losing it now cannot fail the job.
      if (m.truck) m.truck.mission = false;
      m.car = null;
      setDepotDoors(1, 0);
      noise(0.2, 0.2, 220);
      setStage(7, VINNY_DEPOT.backDoor, 'ESCAPE ON FOOT THROUGH THE BACK DOOR');
      announce('BACK DOOR OPEN', 'ESCAPE ON FOOT', 2.5);
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
      if (missionState.escapedAt) {
        // Out and gone: the police have lost the trail; the job closes a beat later.
        if (gameTime - missionState.escapedAt >= 1.4) {
          winMission();
          // Shut the back door behind the runner and roll the front back up.
          settleDepotDoors();
        }
        return;
      }
      if (missionState.stage === 5) {
        const inside = depotPoliceInside();
        if (inside.length) {
          // The marker rides on the nearest officer still fighting.
          missionState.target = inside.reduce((a, b) =>
            distanceBetween(player, a) <= distanceBetween(player, b) ? a : b,
          );
          missionState.instruction = eliminateText(inside.length);
          return;
        }
        depotInteriorClear(missionState);
        return;
      }
      if (missionState.stage === 6) {
        if (player.car) {
          missionState.target = missionState.truck;
          missionState.instruction = 'EXIT THE TRUCK';
          return;
        }
        depotEscapeStage(missionState);
        return;
      }
      // Stage 7: out of the truck, through the building and out the back door.
      missionState.target = VINNY_DEPOT.backDoor;
      missionState.instruction = player.car ? 'EXIT THE TRUCK' : 'ESCAPE ON FOOT THROUGH THE BACK DOOR';
      if (player.car) return;
      if (insideDepot(player.x, player.y)) missionState.throughBuilding = true;
      const exit = VINNY_DEPOT.exit;
      if (
        missionState.throughBuilding &&
        !playerOnRoof() &&
        player.y > VINNY_DEPOT.backDoor.y + 16 &&
        Math.abs(player.x - exit.x) < 70 &&
        Math.abs(player.y - exit.y) < 60
      ) {
        missionState.escapedAt = gameTime;
        missionState.instruction = 'POLICE LOST';
        missionState.target = null;
        depotSealed = false;
        const wasWanted = wantedStars > 0;
        clearPolice();
        if (wasWanted) showPoliceNotice('POLICE LOST!', true);
      }
    }
    /* The drop's prompts (offered from civicUI): the count while officers are
       inside, the way out of the cab, and the back door. */
    function depotDropPrompt(m) {
      if (!m || m.stage < 5 || m.escapedAt || gameMode !== 'play') return;
      if (m.stage === 5) offerPrompt(m.instruction, { key: null, id: 'depot-eliminate' });
      else if (player.car) offerPrompt('EXIT THE TRUCK', { id: 'depot-exit-truck' });
      else if (m.stage === 7) offerPrompt('ESCAPE ON FOOT THROUGH THE BACK DOOR', { key: null, id: 'depot-escape' });
    }
    /* Held while the player is inside the sealed warehouse (citylife.js
       updateWanted): the police know where the truck went. */
    function depotStakeout() {
      const m = mission;
      return (
        m?.index === 0 &&
        m.stage >= 5 &&
        m.stage <= 7 &&
        !m.escapedAt &&
        depotSealed &&
        m.depotHeat > 0 &&
        insideDepot(player.x, player.y, -8)
      );
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
        updateBayState(missionState);
        return;
      }
      if (missionState.stage === 1) {
        missionState.target = HARBOR.gate;
        missionState.instruction = 'DRIVE THE TRUCK TO THE HARBOR BARRIER';
        if (distanceBetween(missionState.car, HARBOR.gate) < 280) {
          harborGateUntil = gameTime + 10;
          if (harborGate > 0.82 && distanceBetween(missionState.car, HARBOR.gate) < 110)
            setStage(2, HARBOR.bay, 'PARK IN THE LOADING BAY · ' + keyName('interact') + ' TO LOAD');
        }
        return;
      }
      if (missionState.stage === 2) {
        updateBayState(missionState);
        missionState.target = HARBOR.bay;
        missionState.instruction = 'PARK IN THE LOADING BAY · ' + keyName('interact') + ' TO LOAD';
        if (missionState.loading) {
          if (
            Math.abs(missionState.car.speed) > 7 ||
            distanceBetween(missionState.car, HARBOR.bay) > 48
          ) {
            missionState.loading = null;
            tell('Loading cancelled. Stop in the bay and press ' + keyName('interact') + '.', 3);
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
              updateBayState(missionState);
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
        !playerOnRoof() &&
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
