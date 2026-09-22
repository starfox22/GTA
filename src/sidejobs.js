    // BEGIN SUBSYSTEM: src/sidejobs.js — Contract missions after the main story
    /**
     * Contract missions after the main story
     * Source: src/sidejobs.js
     * Scope: shared game closure.
     * Five contracts that unlock once the ledger is delivered: a hot-car checkpoint
     * run, a bomb-defusal race across the Keys, a blackout that darkens Northbank
     * until three substations are restored, an aerial ring time-trial, and a
     * repo job that collects four marked vehicles.
     *
     * CONTRACT
     * Indices start at SIDE_JOB_FIRST (the first index after the flight missions).
     * startSideJob / sideJobUpdate / sideJobInteract / sideJobUI mirror the
     * challenge mission hooks and are dispatched from story.js and challenges.js.
     * sideJobPower(x, y) is read by the renderer to darken districts during the
     * blackout contract. Everything spawned here carries `mission = true` or a
     * `missionTag`, so the generic reset/cleanup paths remove it.
     */
    const SIDE_JOB_FIRST = missions.length;
    const SIDE_JOBS = [
      {
        title: 'Rush Hour',
        contact: 'vinny',
        reward: 8000,
        brief: 'Drive the hot muscle car through eight checkpoints and reach the depot before the heat closes in.',
      },
      {
        title: 'Fireworks Night',
        contact: 'mara',
        reward: 9000,
        brief: 'Find and defuse three Glasshouse bombs on the Keys before the fireworks start.',
      },
      {
        title: 'Blackout',
        contact: 'elena',
        reward: 9500,
        brief: 'Northbank has gone dark. Fight through the crew holding three substations and bring the power back.',
      },
      {
        title: 'Ring Run',
        contact: 'rafe',
        reward: 12000,
        brief: 'Take the courier plane through eight sky rings over the bay and land it back at Southport.',
      },
      {
        title: 'Repo Man',
        contact: 'vinny',
        reward: 8500,
        brief: 'Collect four marked vehicles from across the city and deliver each to the depot.',
      },
    ];
    for (const job of SIDE_JOBS)
      missions.push({
        ...job,
        phoneMessage:
          CHARACTERS[job.contact].name.split(' ')[0] + ' gave you a contract: ' + job.brief,
      });
    const RUSH_CHECKPOINTS = [
      [1152, 640],
      [2688, 1152],
      [2176, 2176],
      [1152, 3200],
      [2688, 3712],
      [4224, 3200],
      [4736, 1664],
      [4224, 4224],
    ];
    const BOMB_SITES = [
      { name: 'GOLDEN TIDE CASINO', x: 4985, y: 3120 },
      { name: 'NEON PALACE', x: 4470, y: 4080 },
      { name: 'BLUE HOUR HOTEL', x: 4480, y: 2690 },
    ];
    const SUBSTATIONS = [
      { name: 'OLD QUARTER SUBSTATION', x: 1560, y: 1090, zone: 0 },
      { name: 'MIDTOWN SUBSTATION', x: 1760, y: 2262, zone: 1 },
      { name: 'EXCHANGE SUBSTATION', x: 2600, y: 3290, zone: 2 },
    ];
    const SKY_RINGS = [
      [418, 3900, 140],
      [1150, 3200, 210],
      [2176, 2400, 270],
      [3690, 1700, 230],
      [4700, 900, 190],
      [5500, 2600, 170],
      [4300, 4300, 210],
      [2700, 4900, 160],
    ];
    const REPO_TARGETS = [
      ['limousine', 4736, 1900, Math.PI / 2, '#2c2f36', 'THE BLACK LIMOUSINE · OCEAN DRIVE'],
      ['taxi', 1152, 3000, -Math.PI / 2, VEHICLE_DEFINITIONS.taxi.color, 'THE UNPAID TAXI · BROADWAY'],
      ['supercar', 2688, 2900, Math.PI / 2, '#d8b23a', 'THE GOLD SUPERCAR · EXCHANGE'],
      ['bus', 2176, 4224, 0, '#6a8fa6', 'THE TRANSIT BUS · SOUTH BANK'],
    ];
    function sideJobIndex(missionState) {
      return missionState.index - SIDE_JOB_FIRST;
    }
    function sideJobPoint(x, y) {
      return findStreetPoint(x, y, 12);
    }
    // spawnClearCar throws when a spot is crowded; try nearby road positions, then a smaller car.
    function sideJobSpawn(type, x, y, a, color) {
      for (const [dx, dy] of [[0, 0], [220, 0], [-220, 0], [0, 220], [0, -220]])
        try {
          return spawnClearCar(type, x + dx, y + dy, a, false, color);
        } catch {}
      return spawnClearCar('sedan', x, y, a, false, color);
    }
    function jobLabel(index) {
      return index >= SIDE_JOB_FIRST
        ? 'Contract ' + (index + 1 - SIDE_JOB_FIRST)
        : 'Mission ' + (index + 1);
    }
    // Renderer hook: 1 = powered, low values = dark. Only the blackout contract changes it.
    function sideJobPower(x, y) {
      const m = mission;
      if (!m || sideJobIndex(m) !== 2 || x > RIVER.left) return 1;
      const zone = y < 1450 ? 0 : y < 2650 ? 1 : 2;
      return m.restored[zone] ? 1 : 0.07;
    }
    function sideJobRings() {
      const m = mission;
      return m && sideJobIndex(m) === 3 ? m.rings : null;
    }
    function sideJobDevices() {
      const m = mission;
      if (!m) return null;
      const job = sideJobIndex(m);
      if (job === 1) return m.bombs;
      if (job === 2) return m.substations;
      return null;
    }
    function startSideJob(missionState) {
      const job = sideJobIndex(missionState);
      if (job === 0) {
        missionState.car = sideJobSpawn('muscle', phone.x + 90, phone.y + 120, 0, '#c9412c');
        missionState.car.mission = true;
        missionState.car.hp = missionState.car.maxhp = 260;
        missionState.checkpoints = RUSH_CHECKPOINTS.map(([x, y]) => sideJobPoint(x, y));
        missionState.checkpoint = 0;
        missionState.timeLimit = 330;
        missionState.timer = 330;
        missionState.awayTimer = 0;
        setStage(0, missionState.car, 'GET IN THE RED MUSCLE CAR', 'vinny', 'The car is hot and the buyer is waiting. Eight checkpoints, then my depot. Don’t stop for anyone.');
      }
      if (job === 1) {
        missionState.bombs = BOMB_SITES.map((site, i) => ({
          ...sideJobPoint(site.x, site.y),
          name: site.name,
          defused: false,
          tag: 'bomb-' + i,
        }));
        missionState.bombs.forEach((b) => challengeGuards('glass', 3, b, b.tag));
        missionState.timeLimit = 360;
        missionState.timer = 360;
        missionState.defused = 0;
        setStage(0, missionState.bombs[0], 'BOMB 1 / 3 · CASINO · ON FOOT, HOLD E TO DEFUSE', 'mara', 'Kit’s crew wired three of my neighbours. The fireworks start in six minutes, and I want them to be the only bang tonight.');
      }
      if (job === 2) {
        const hour = (worldMinutes % 1440) / 60;
        if (hour > 6 && hour < 20.5) {
          worldMinutes = Math.floor(worldMinutes / 1440) * 1440 + 21.5 * 60;
          tell('Night falls over Northbank as the grid goes down.', 4);
        }
        missionState.substations = SUBSTATIONS.map((s, i) => ({
          ...sideJobPoint(s.x, s.y),
          name: s.name,
          zone: s.zone,
          defused: false,
          tag: 'substation-' + i,
        }));
        missionState.restored = [false, false, false];
        missionState.substations.forEach((s) => challengeGuards('glass', 4, s, s.tag));
        setStage(0, missionState.substations[0], 'RESTORE THE OLD QUARTER SUBSTATION · HOLD E', 'elena', 'The Glasshouse Crew cut Northbank’s power to move product in the dark. Three substations. Bring the lights back and they lose their cover.');
      }
      if (job === 3) {
        for (let i = vehicles.length - 1; i >= 0; i--)
          if (
            vehicles[i].type === 'plane' &&
            vehicles[i] !== player.car &&
            Math.abs(vehicles[i].x - 418) < 200 &&
            vehicles[i].y > 4900
          )
            vehicles.splice(i, 1);
        missionState.car = makeCar('plane', 418, 5150, -Math.PI / 2, false, '#e8d6a8');
        missionState.car.mission = true;
        missionState.car.authorized = true;
        missionState.rings = SKY_RINGS.map(([x, y, altitude]) => ({ x, y, altitude, passed: false }));
        missionState.ring = 0;
        missionState.timeLimit = 300;
        missionState.timer = 300;
        setStage(0, missionState.car, 'BOARD THE COURIER PLANE AT SOUTHPORT', 'rafe', 'Eight rings, one lap, wheels back on my runway. The clock starts when you take the seat. Fly low, fly clean.');
      }
      if (job === 4) {
        missionState.repos = REPO_TARGETS.map(([type, x, y, a, color, label]) => {
          const car = sideJobSpawn(type, x, y, a, color);
          car.mission = true;
          car.repo = true;
          return { car, label, delivered: false };
        });
        missionState.repo = 0;
        missionState.timeLimit = 540;
        missionState.timer = 540;
        setStage(0, missionState.repos[0].car, 'COLLECT ' + missionState.repos[0].label, 'vinny', 'Four rides, four deadbeats. Bring each one to my depot. Scratches come out of your cut.');
      }
    }
    function fireworks(x, y) {
      if (!city3D) return;
      for (let i = 0; i < 3; i++)
        setTimeout(() => {
          if (gameMode !== 'play') return;
          city3D.explosion(x + randomBetween(-60, 60), y + randomBetween(-60, 60), 0.55, 230 + i * 30);
          noise(0.25, 0.2, 700);
        }, i * 350);
    }
    function sideJobUpdate(missionState, deltaSeconds) {
      const job = sideJobIndex(missionState);
      if (job === 0) {
        if (missionState.stage === 0) {
          if (player.car === missionState.car) {
            setStage(1, missionState.checkpoints[0], 'CHECKPOINT 1 / 8');
          }
          return;
        }
        if (player.car !== missionState.car) {
          missionState.awayTimer += deltaSeconds;
          if (missionState.awayTimer > 25) {
            failMission('You left the hot car too long. The buyer walked.');
            return;
          }
        } else missionState.awayTimer = 0;
        if (missionState.stage <= 8) {
          const target = missionState.checkpoints[missionState.checkpoint];
          if (player.car === missionState.car && distanceBetween(player, target) < 70) {
            missionState.checkpoint++;
            crime(0.9);
            noise(0.08, 0.2, 1800);
            if (missionState.checkpoint >= 8) {
              setStage(9, VINNY_DEPOT.inside, 'DELIVER THE CAR TO VINNY’S DEPOT', 'vinny', 'That’s the route. Now lose them and bring it home.');
            } else
              setStage(
                missionState.checkpoint + 1,
                missionState.checkpoints[missionState.checkpoint],
                'CHECKPOINT ' + (missionState.checkpoint + 1) + ' / 8',
                missionState.checkpoint === 4 ? 'vinny' : undefined,
                missionState.checkpoint === 4 ? 'Halfway. Every cop on the coast has your plate now.' : undefined,
              );
          }
        } else if (
          player.car === missionState.car &&
          distanceBetween(player, VINNY_DEPOT.inside) < 70 &&
          Math.abs(missionState.car.speed) < 12
        ) {
          clearPolice();
          winMission();
        }
        return;
      }
      if (job === 1 || job === 2) {
        const devices = job === 1 ? missionState.bombs : missionState.substations,
          current = devices[missionState.stage];
        if (!current) return;
        const valid = !player.car && !player.roof && distanceBetween(player, current) < 34,
          seconds = job === 1 ? 3 : 4;
        if (holdMissionAction(missionState, deltaSeconds, valid, seconds)) {
          current.defused = true;
          missionState.actionProgress = 0;
          if (job === 1) {
            missionState.defused++;
            fireworks(current.x, current.y);
          } else {
            missionState.restored[current.zone] = true;
            noise(0.4, 0.25, 220);
            tell(current.name.replace(' SUBSTATION', '') + ' is back online.', 3);
          }
          const next = devices[missionState.stage + 1];
          if (!next) {
            winMission();
            return;
          }
          const n = missionState.stage + 2;
          setStage(
            missionState.stage + 1,
            next,
            job === 1
              ? 'BOMB ' + n + ' / 3 · ' + next.name.split(' ')[0] + ' · HOLD E TO DEFUSE'
              : 'RESTORE THE ' + next.name + ' · HOLD E',
            job === 1 ? 'mara' : 'elena',
            job === 1
              ? n === 2
                ? 'One down. Neon Palace next, and they know you’re coming.'
                : 'Last one is under my own hotel. Make it quick.'
              : n === 2
                ? 'Old Quarter has lights. Midtown is next; they will be waiting.'
                : 'One more. The Exchange substation runs the whole Financial District.',
          );
        }
        return;
      }
      if (job === 3) {
        const plane = missionState.car;
        if (missionState.stage === 0) {
          if (player.car === plane) {
            missionState.timer = missionState.timeLimit;
            setStage(1, missionState.rings[0], 'RING 1 / 8 · CLIMB TO THE MARKER');
          } else missionState.timer = missionState.timeLimit;
          return;
        }
        if (player.car !== plane && aircraftClearance(plane) < 3 && missionState.stage <= 8) {
          failMission('You left the plane before finishing the run.');
          return;
        }
        if (missionState.stage <= 8) {
          const ring = missionState.rings[missionState.ring];
          if (
            Math.hypot(plane.x - ring.x, plane.y - ring.y) < 75 &&
            Math.abs((plane.altitude || 0) - ring.altitude) < 55
          ) {
            ring.passed = true;
            missionState.ring++;
            tone(880 + missionState.ring * 60, 0.12, 0.2);
            if (missionState.ring >= 8)
              setStage(9, { x: 418, y: 4790, altitude: 0 }, 'LAND ON THE SOUTHPORT RUNWAY AND STOP', 'rafe', 'Clean lap. Now the hard part: put it down gently.');
            else
              setStage(
                missionState.ring + 1,
                missionState.rings[missionState.ring],
                'RING ' + (missionState.ring + 1) + ' / 8 · ALTITUDE ' + Math.round(missionState.rings[missionState.ring].altitude / 5.12) + ' M',
              );
          }
        } else if (
          player.car === plane &&
          runwayAt(plane)?.name === 'SOUTHPORT' &&
          aircraftClearance(plane) < 2 &&
          Math.abs(plane.speed || 0) < 15
        ) {
          winMission();
        }
        return;
      }
      if (job === 4) {
        const repo = missionState.repos[missionState.repo];
        if (!repo) return;
        if (repo.car.hp <= 0) {
          failMission('You wrecked the ' + repo.label.split(' · ')[0].toLowerCase() + '.');
          return;
        }
        if (missionState.stage % 2 === 0) {
          if (player.car === repo.car)
            setStage(missionState.stage + 1, VINNY_DEPOT.inside, 'DELIVER ' + repo.label.split(' · ')[0] + ' TO THE DEPOT');
        } else if (
          player.car === repo.car &&
          distanceBetween(player, VINNY_DEPOT.inside) < 70 &&
          Math.abs(repo.car.speed) < 12
        ) {
          repo.delivered = true;
          repo.car.mission = false;
          repo.car.repo = false;
          exitCar();
          missionState.repo++;
          const next = missionState.repos[missionState.repo];
          if (!next) {
            winMission();
            return;
          }
          setStage(
            missionState.stage + 1,
            next.car,
            'COLLECT ' + next.label,
            'vinny',
            missionState.repo === 2 ? 'Two more. The gold one bites; it belongs to a Glasshouse accountant.' : undefined,
          );
        }
      }
    }
    function sideJobInteract() {
      const missionState = mission;
      if (!missionState) return false;
      const job = sideJobIndex(missionState);
      if ((job === 1 || job === 2) && !player.car && missionState.target && distanceBetween(player, missionState.target) < 34)
        return true;
      return false;
    }
    function sideJobUI() {
      const missionState = mission;
      if (!missionState) return;
      const job = sideJobIndex(missionState);
      if (job === 0 && missionState.stage > 0 && player.car !== missionState.car) {
        getElement('interaction').style.display = 'block';
        getElement('interaction').textContent =
          'GET BACK IN THE CAR · ' + Math.max(0, 25 - missionState.awayTimer).toFixed(0) + ' s';
      }
      if (job === 3 && missionState.stage >= 1 && missionState.stage <= 8 && player.car === missionState.car) {
        const ring = missionState.rings[missionState.ring],
          diff = ring.altitude - (missionState.car.altitude || 0);
        getElement('interaction').style.display = 'block';
        getElement('interaction').textContent =
          Math.abs(diff) < 40 ? 'ON ALTITUDE · HOLD IT' : diff > 0 ? 'CLIMB ' + Math.round(diff / 5.12) + ' M' : 'DESCEND ' + Math.round(-diff / 5.12) + ' M';
      }
    }
    // END SUBSYSTEM: src/sidejobs.js
