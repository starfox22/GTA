    // BEGIN SUBSYSTEM: src/challenges.js — Mission-specific encounters
    /**
     * Mission-specific encounters
     * Source: src/challenges.js
     * Scope: shared game closure.
     * Story objectives, guards and special actions for campaign challenges.
     */
    /* Each chapter owns a different action, and a reason to take the next job. */
    const CHALLENGE_COPY = {
      2: ['Steal the tracked coupe, remove its transmitter, and deliver it unseen.', 'Vinny’s Favor'],
      3: ['Recover three receipt bundles before the customs office destroys them.', 'Paper Trail'],
      4: ['Switch cars with Elena to shake her tail before reaching the motel.', 'No Last Ferry'],
      5: [
        'Recover rival account books, defend the loading bay, and escape in the armored van.',
        'Both Sides of the Bay',
      ],
      6: [
        'Survey two harbor sightlines from Blue Hour and identify the ledger’s escape route.',
        'Above the Noise',
      ],
      7: [
        'Salvage the master ledger, outrun its beacon, and hand it to Rafe on foot.',
        'Saltwater Accounting',
      ],
      8: ['Clear the hangar and recover the flight papers for Daniel’s extraction.', 'One Clean Exit'],
    };
    for (const [i, [brief, title]] of Object.entries(CHALLENGE_COPY)) {
      missions[i].brief = brief;
      missions[i].phoneMessage =
        CHARACTERS[missions[i].contact].name.split(' ')[0] + ' gave you a mission: ' + brief;
      missions[i].title = title;
    }
    function challengeGuards(faction, count, point, tag) {
      spawnGuards(faction, count, point, tag);
      for (const e of enemies) if (e.missionTag === tag) e.missionAggressive = true;
    }
    function cleared(tag) {
      const guards = enemies.filter((e) => e.missionTag === tag);
      return guards.length > 0 && guards.every((e) => e.hp <= 0);
    }
    function holdMissionAction(missionState, deltaSeconds, valid, seconds) {
      missionState.actionProgress =
        valid && keys.KeyE ? (missionState.actionProgress || 0) + deltaSeconds : 0;
      return missionState.actionProgress >= seconds;
    }
    function startChallengeMission(missionState) {
      if (missionState.index === 2) {
        missionState.car = spawnClearCar('coupe', 1000, 666, Math.PI, false, '#89c7ab');
        missionState.car.mission = true;
        missionState.workshop = {
          x: 1320,
          y: 2130,
        };
        setStage(0, missionState.car, 'STEAL VINNY’S SEA-GREEN COUPE');
      }
      if (missionState.index === 3) {
        missionState.receipts = [
          [2715, 1570],
          [2930, 1570],
          [3130, 1710],
        ].map((p) => findStreetPoint(...p));
        missionState.receipt = 0;
        setStage(0, missionState.receipts[0], 'RECEIPTS 1 / 3 · ON FOOT, HOLD E TO COLLECT');
      }
      if (missionState.index === 4) {
        setStage(0, LOC.cinema, 'PICK UP ELENA AT THE CINEMA · USE A CAR');
        storyActors.push(actor('ELENA CRUZ', LOC.cinema.x, LOC.cinema.y, '#7ac9c7'));
        missionState.swap = {
          x: 2688,
          y: 2180,
        };
      }
      if (missionState.index === 5) {
        missionState.car = spawnClearCar('van', 1420, 1664, 0, false, '#6c9296');
        missionState.car.hp = missionState.car.maxhp = 420;
        missionState.car.mission = true;
        setStage(0, missionState.car, 'TAKE VINNY’S ARMORED VAN');
      }
      if (missionState.index === 6) {
        missionState.patrol = makeCar('workboat', 3740, 2520, -Math.PI / 2, false, '#d4d8cc');
        missionState.patrol.mission = true;
        missionState.patrol.reconPatrol = true;
        missionState.patrolDirection = -1;
        missionState.scans = [
          {
            x: ROOFTOP.x + 28,
            y: ROOFTOP.y + 30,
            altitude: ROOFTOP.height,
          },
          {
            x: ROOFTOP.x + 331,
            y: ROOFTOP.y + 171,
            altitude: ROOFTOP.height,
          },
        ];
        setStage(0, ROOFTOP.door, 'TAKE THE BLUE HOUR ELEVATOR · E');
      }
      if (missionState.index === 7) {
        const d = DOCKS.find((d) => d.type === 'jetski');
        missionState.car =
          vehicles.find(
            (c) =>
              c.type === 'jetski' &&
              distanceBetween(c, {
                x: d.boatX,
                y: d.boatY,
              }) < 15,
          ) || makeCar('jetski', d.boatX, d.boatY, Math.PI / 2);
        repairVehicle(missionState.car);
        missionState.car.mission = true;
        setStage(0, missionState.car, 'TAKE THE MARKED JET SKI AT BAY LAUNCH');
      }
      if (missionState.index === 8) {
        setStage(0, LOC.terminal, 'PICK UP ELENA OUTSIDE SOUTHPORT TERMINAL');
        storyActors.push(actor('ELENA CRUZ', LOC.terminal.x + 28, LOC.terminal.y, '#7ac9c7'));
        missionState.supportCar = spawnClearCar('sedan', 1180, 5005, Math.PI / 2, false, '#b5bfbc');
        missionState.supportCar.mission = true;
        challengeGuards('glass', 6, LOC.hangar, 'airport');
      }
    }
    function updateChallengeMission(missionState, deltaSeconds) {
      const near = !!missionState.target && distanceBetween(player, missionState.target) < 55,
        ground = !playerOnRoof() && !player.parachute && (player.car?.altitude || 0) < 2,
        stopped = !player.car || Math.abs(player.car.speed) < 12,
        foot = !player.car && ground;
      if (missionState.index === 2) {
        if (missionState.stage === 0 && player.car === missionState.car) {
          crime(2);
          setStage(
            1,
            missionState.workshop,
            'TRACKER ACTIVE · PARK AT EASTSIDE CUSTOMS',
            'vinny',
            'The ledger is under the seat. Their transmitter is under the rear bumper. Remove it before coming to me.',
          );
        } else if (missionState.stage === 1) {
          wantedStars = Math.max(1, wantedStars);
          if (
            (distanceBetween(missionState.car, missionState.workshop) < 75 ||
              garageForCar(missionState.car)?.id === 'eastside') &&
            Math.abs(missionState.car.speed) < 8
          )
            setStage(2, missionState.car, 'GET OUT · HOLD E BESIDE THE COUPE TO REMOVE TRACKER');
        } else if (missionState.stage === 2) {
          wantedStars = Math.max(1, wantedStars);
          if (
            holdMissionAction(
              missionState,
              deltaSeconds,
              foot &&
                distanceBetween(player, missionState.car) < 90 &&
                Math.abs(missionState.car.speed) < 8,
              4,
            )
          ) {
            missionState.actionProgress = 0;
            setStage(
              3,
              LOC.vinny,
              'TRACKER REMOVED · LOSE POLICE · DELIVER THE COUPE',
              'vinny',
              'Clean signal. Now lose the patrols and bring the ledger.',
            );
          }
        } else if (
          missionState.stage === 3 &&
          ground &&
          near &&
          stopped &&
          player.car === missionState.car &&
          wantedStars === 0
        )
          winMission();
      }
      if (missionState.index === 3) {
        if (missionState.stage < 3 && holdMissionAction(missionState, deltaSeconds, foot && near, 2)) {
          missionState.actionProgress = 0;
          if (missionState.stage === 0) {
            missionState.timer = missionState.timeLimit = 95;
            crime(2);
          }
          missionState.receipt++;
          if (missionState.receipt < 3)
            setStage(
              missionState.receipt,
              missionState.receipts[missionState.receipt],
              'RECEIPTS ' + (missionState.receipt + 1) + ' / 3 · HOLD E · BEFORE THE SHREDDER',
            );
          else {
            missionState.timeLimit = 0;
            setStage(
              3,
              safehouse,
              'ALL RECEIPTS SAVED · LOSE THE POLICE · GO HOME',
              'elena',
              'The signatures match both gangs. Daniel can authenticate them, if we find him alive.',
            );
          }
        } else if (missionState.stage === 3 && ground && near && stopped && wantedStars === 0)
          winMission();
      }
      if (missionState.index === 4) {
        if (missionState.cleanCar?.hp <= 0 && missionState.stage < 3) {
          failMission('The clean getaway sedan was destroyed.');
          return;
        }
        if (missionState.stage === 0 && ground && near && stopped && passengerCar(player.car)) {
          boardElena(missionState);
          missionState.oldCar = missionState.car;
          missionState.timer = missionState.timeLimit = 210;
          crime(2);
          missionState.cleanCar = spawnClearCar(
            'sedan',
            missionState.swap.x + 26,
            missionState.swap.y,
            Math.PI / 2,
            false,
            '#c2b19d',
          );
          missionState.cleanCar.mission = true;
          setStage(
            1,
            missionState.swap,
            'TAIL ON OUR CAR · REACH THE TRANSFER POINT',
            'elena',
            'They know this car. Vinny left another at the junction. Stop beside it and let me switch.',
          );
        } else if (missionState.stage === 1 && near && stopped && player.car === missionState.oldCar) {
          missionState.elena = storyActors.find((p) => p.name === 'ELENA CRUZ');
          missionState.elena.hidden = false;
          Object.assign(
            missionState.elena,
            findStreetPoint(missionState.cleanCar.x - 55, missionState.cleanCar.y, 8),
          );
          setStage(
            2,
            missionState.cleanCar,
            'EXIT · BOARD THE CLEAN SEDAN · PRESS E TO TRANSFER ELENA',
          );
        } else if (
          missionState.stage === 3 &&
          near &&
          stopped &&
          player.car === missionState.passengerCar &&
          wantedStars === 0
        )
          winMission();
      }
      if (missionState.index === 5) {
        if (missionState.stage === 0 && player.car === missionState.car)
          setStage(
            1,
            {
              x: 2176,
              y: 990,
            },
            'HOLD E AT THE DOCK OFFICE TO LOAD RUSK’S BOOK',
          );
        else if (
          missionState.stage === 1 &&
          holdMissionAction(
            missionState,
            deltaSeconds,
            near && stopped && player.car === missionState.car,
            3,
          )
        ) {
          missionState.actionProgress = 0;
          challengeGuards('glass', 6, LOC.warehouse, 'books');
          crime(2);
          setStage(2, LOC.warehouse, 'CLEAR THE WAREHOUSE GUARDS · SECOND ACCOUNT BOOK');
        } else if (missionState.stage === 2 && cleared('books'))
          setStage(3, LOC.warehouse, 'PARK THE VAN · HOLD E TO LOAD VALE’S BOOK');
        else if (
          missionState.stage === 3 &&
          holdMissionAction(
            missionState,
            deltaSeconds,
            near && stopped && player.car === missionState.car,
            5,
          )
        ) {
          missionState.actionProgress = 0;
          setStage(
            4,
            ROOFTOP.door,
            'LOSE THE POLICE · BRING BOTH BOOKS TO BLUE HOUR',
            'mara',
            'Two copies, different totals. The missing money is in the master ledger. Meet me upstairs.',
          );
        } else if (
          missionState.stage === 4 &&
          near &&
          ground &&
          stopped &&
          player.car === missionState.car &&
          wantedStars === 0
        )
          winMission();
      }
      if (missionState.index === 6) {
        if (missionState.patrol.hp <= 0) {
          missionState.patrol.vx = missionState.patrol.vy = missionState.patrol.speed = 0;
          if (missionState.stage < 4) {
            failMission('The surveillance launch was destroyed before both sightlines were logged.');
            return;
          }
        } else {
          if (missionState.patrol.y < 1930) missionState.patrolDirection = 1;
          if (missionState.patrol.y > 2570) missionState.patrolDirection = -1;
          missionState.patrol.a = (missionState.patrolDirection * Math.PI) / 2;
          missionState.patrol.vx = 0;
          missionState.patrol.vy = missionState.patrolDirection * 95;
          missionState.patrol.speed = 95;
        }
        if (missionState.stage === 0 && player.roof)
          setStage(
            1,
            {
              ...ROOFTOP.contact,
              altitude: ROOFTOP.height,
            },
            'SPEAK TO MARA ON THE TERRACE · E',
          );
        else if (
          (missionState.stage === 2 || missionState.stage === 3) &&
          holdMissionAction(
            missionState,
            deltaSeconds,
            player.roof && near && reconWindow(missionState),
            2.5,
          )
        ) {
          missionState.actionProgress = 0;
          if (missionState.stage === 2)
            setStage(
              3,
              missionState.scans[1],
              'EAST SIGHTLINE · HOLD E WHILE THE PATROL IS NORTH',
              'mara',
              'That launch carries Vale’s courier. Watch the east channel: the patrol loops leave one gap.',
            );
          else
            setStage(
              4,
              {
                ...ROOFTOP.contact,
                altitude: ROOFTOP.height,
              },
              'BOTH SIGHTLINES LOGGED · REPORT TO MARA · E',
            );
        } else if (missionState.stage === 5 && !player.roof && gameMode === 'play') winMission();
      }
      if (missionState.index === 7) {
        if (missionState.stage === 0 && player.car === missionState.car)
          setStage(
            1,
            LOC.waterCase,
            'STOP BESIDE THE BUOY · HOLD E TO SALVAGE THE CASE',
            'mara',
            'You found the patrol gap. The master ledger is chained below that buoy.',
          );
        else if (
          missionState.stage === 1 &&
          holdMissionAction(
            missionState,
            deltaSeconds,
            near && player.car === missionState.car && Math.abs(missionState.car.speed) < 15,
            4,
          )
        ) {
          missionState.actionProgress = 0;
          missionState.timer = missionState.timeLimit = 150;
          crime(2);
          // Down Marlow Bay, through the narrows between Battery Point and Sunset
          // Pier, round the outside of Southport Beach (south of the fishing pier
          // head and its swimmers) and up to the Southport speedboat dock. The old
          // gates at (3720, 5410) and (2250, 5750) now sit on Sunset Pier and on
          // the beach sand.
          missionState.waterRoute = [
            { x: 3470, y: 4700 },
            { x: 3420, y: 5000 },
            { x: 3380, y: 5320 },
            { x: 3150, y: 5750 },
            { x: 2700, y: 6100 },
            { x: 1640, y: 5780 },
            { x: 1550, y: 5540 },
            // The Southport dock's boat berth (DOCKS, citylife.js).
            { x: 1462, y: 5247 },
          ];
          missionState.waterGate = 0;
          setStage(
            2,
            missionState.waterRoute[0],
            'BEACON ACTIVE · FOLLOW THE SOUTH CHANNEL BEFORE INTERCEPTION',
            'elena',
            'Opening the case woke a transmitter. Get it to Rafe: he can cut the beacon.',
          );
        } else if (
          missionState.stage === 2 &&
          player.car === missionState.car &&
          // Channel gates are passed at speed, so they are wider than a stop marker;
          // the last one is the dock itself.
          distanceBetween(player, missionState.target) <
            (missionState.waterGate < missionState.waterRoute.length - 1 ? 110 : 55)
        ) {
          missionState.waterGate++;
          if (missionState.waterGate < missionState.waterRoute.length)
            setStage(
              2,
              missionState.waterRoute[missionState.waterGate],
              'BEACON ACTIVE · REACH SOUTHPORT MARINA',
            );
          else
            setStage(
              3,
              {
                x: 1462,
                y: 5247,
              },
              'STOP AT THE DOCK · E TO DISEMBARK',
            );
        } else if (missionState.stage === 3 && foot) {
          missionState.timeLimit = 0;
          setStage(
            4,
            {
              x: LOC.hangar.x + 25,
              y: LOC.hangar.y - 26,
            },
            'TAKE THE CASE TO RAFE ON FOOT · E',
          );
        }
      }
      if (missionState.index === 8) {
        if (missionState.stage === 0 && ground && near && stopped && passengerCar(player.car)) {
          boardElena(missionState);
          crime(2);
          setStage(
            1,
            LOC.hangar,
            'CLEAR VALE’S CREW FROM HANGAR THREE',
            'elena',
            'The ledger needs Daniel’s testimony. Vale’s men stole our flight clearance. Take it back.',
          );
        } else if (missionState.stage === 1 && cleared('airport'))
          setStage(
            2,
            findStreetPoint(LOC.hangar.x + 60, LOC.hangar.y, 8),
            'LEAVE THE CAR · HOLD E TO RECOVER FLIGHT PAPERS',
          );
        else if (
          missionState.stage === 2 &&
          holdMissionAction(missionState, deltaSeconds, foot && near, 3)
        ) {
          missionState.actionProgress = 0;
          setStage(
            3,
            LOC.hangar,
            'RETURN TO ELENA’S CAR · LOSE POLICE · MEET RAFE',
            'rafe',
            'Clearance recovered. Daniel is held in Northridge. My helicopter is at Oceanview; bring him back alive.',
          );
        } else if (
          missionState.stage === 3 &&
          near &&
          stopped &&
          player.car === missionState.passengerCar &&
          wantedStars === 0
        )
          winMission();
      }
    }
    function challengeMissionInteract() {
      const missionState = mission;
      if (!missionState || player.parachute) return false;
      if (missionState.index >= SIDE_JOB_FIRST) return sideJobInteract();
      const near = missionState.target && distanceBetween(player, missionState.target) < 60;
      if (
        missionState.index === 4 &&
        missionState.stage === 2 &&
        player.car === missionState.cleanCar &&
        Math.abs(missionState.cleanCar.speed) < 8 &&
        distanceBetween(player, missionState.elena) < 100
      ) {
        missionState.oldCar.mission = false;
        boardElena(missionState);
        setStage(3, LOC.motel, 'ELENA TRANSFERRED · LOSE THE TAIL · REACH CORAL PALMS');
        return true;
      }
      if (
        missionState.index === 6 &&
        player.roof &&
        distanceBetween(player, ROOFTOP.contact) < 42 &&
        (missionState.stage === 1 || missionState.stage === 4)
      ) {
        const briefing = missionState.stage === 1;
        showDialogue(
          'mara',
          briefing ? 'Eyes on the channel' : 'The missing account',
          briefing
            ? 'The two books disagree. Use the marked viewpoints. Hold E when the launch reaches the south buoy, then when it clears the north channel; I need a safe path to the hidden master ledger.'
            : 'The courier hid the master ledger at the channel buoy. Use the patrol gap you found. Rafe can disable its beacon at Southport. Return downstairs for the job.',
          () =>
            setStage(
              briefing ? 2 : 5,
              briefing
                ? missionState.scans[0]
                : {
                    ...ROOFTOP.lift,
                    altitude: ROOFTOP.height,
                  },
              briefing
                ? 'WEST SIGHTLINE · HOLD E WHEN THE LAUNCH REACHES SOUTH'
                : 'RETURN DOWNSTAIRS · E AT THE ELEVATOR',
            ),
          false,
          'CONTINUE',
        );
        return true;
      }
      if (
        missionState.index === 7 &&
        missionState.stage === 3 &&
        player.car === missionState.car &&
        Math.abs(missionState.car.speed) < 15
      ) {
        // Step off onto the Southport dock itself (DOCKS, citylife.js: the inlet's
        // east shore). The generic boat exit takes the first clear side, which can
        // be the quay across the inlet; from the dock's shore end it is a short
        // walk round the head of the inlet to Rafe at the hangars.
        const c = missionState.car,
          dock = DOCKS.reduce((a, b) =>
            distanceBetween(c, { x: b.boatX, y: b.boatY }) < distanceBetween(c, { x: a.boatX, y: a.boatY }) ? b : a,
          ),
          step = {
            x: clamp(c.x, dock.x + 10, dock.x + dock.w - 10),
            y: clamp(c.y, dock.y + 8, dock.y + dock.h - 8),
          };
        if (distanceBetween(c, step) < 110 && !solid(step.x, step.y, 6)) {
          // Straight onto the deck: the generic exitCar() refuses when neither side
          // of the jet ski is clear, which is most of the berth.
          c.ai = false;
          c.vx = c.vy = c.speed = c.av = 0;
          player.car = null;
          player.x = step.x;
          player.y = step.y;
          player.altitude = terrainHeight(step.x, step.y);
          player.inv = 0.5;
          tone(160, 0.06, 0.15, 'triangle');
          return true;
        }
      }
      if (missionState.index === 7 && missionState.stage === 4 && !player.car && near) {
        winMission();
        return true;
      }
      if (
        near &&
        ((missionState.index === 2 && missionState.stage === 2 && !player.car) ||
          (missionState.index === 3 && missionState.stage < 3 && !player.car) ||
          (missionState.index === 5 &&
            [1, 3].includes(missionState.stage) &&
            player.car === missionState.car) ||
          (missionState.index === 6 && [2, 3].includes(missionState.stage) && player.roof) ||
          (missionState.index === 7 && missionState.stage === 1 && player.car === missionState.car) ||
          (missionState.index === 8 && missionState.stage === 2 && !player.car))
      )
        return true;
      return flightMissionInteract();
    }
    function reconWindow(m) {
      return m.stage === 2 ? m.patrol.y > 2320 : m.patrol.y < 2170;
    }
    function challengeMissionUI() {
      const missionState = mission;
      if (!missionState) return;
      if (missionState.index >= SIDE_JOB_FIRST) sideJobUI();
      if (missionState.index === 6 && [2, 3].includes(missionState.stage) && player.roof) {
        getElement('interaction').style.display = 'block';
        getElement('interaction').textContent = reconWindow(missionState)
          ? 'IN VIEW · AT THE MARKER, HOLD E FOR 2.5 s'
          : 'WATCH THE BAY · WAIT FOR THE LAUNCH TO PASS';
      }
      if (missionState.actionProgress > 0) {
        getElement('interaction').style.display = 'block';
        getElement('interaction').textContent =
          'HOLD E · ' + missionState.actionProgress.toFixed(1) + ' s';
      }
      if (
        missionState.index === 10 &&
        [1, 2, 3].includes(missionState.stage) &&
        missionState.compromised
      ) {
        getElement('interaction').style.display = 'block';
        getElement('interaction').textContent =
          'V · SWITCH LANDING: ' +
          (missionState.divert ? 'OCEANVIEW · LONGER GROUND ESCAPE' : 'SOUTHPORT · ARMED AMBUSH');
      }
    }
    // END SUBSYSTEM: src/challenges.js
