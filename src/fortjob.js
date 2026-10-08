    // BEGIN SUBSYSTEM: src/fortjob.js — Mission 4, Borrowed Stripes: an off-duty soldier's uniform, Fort Sentinel and the consul at CIRRUS
    /**
     * Mission 4: Borrowed Stripes (Vinny)
     * Source: src/fortjob.js
     * Scope: shared game closure.
     * Vinny hands over a lockpick (vehicle-trunk.js) and a name: Lieutenant Dale
     * Kessler, logistics, off duty, driving out of Fort Sentinel to the Marea Beach
     * Club in his red muscle car. The player catches him at the gate and tails him
     * (too close for too long and he makes the tail; lost, he is still going to the
     * club) or waits for him at the club (fortClubWait). Shot at in his car he
     * radios the fort: five stars at once (fortAlerted). Then either the quiet way
     * (wait until he is inside the club and pick his trunk) or the messy way (take
     * the car or kill him for the keys, with all the witnesses that brings). The trunk holds his
     * uniform and his ID; changed into them somewhere nobody watches, the player
     * walks up to the fort's gate and shows the papers (fort-cover.js does the
     * gate, the soldiers' suspicion, the military-vehicle alarm and the records
     * office), walks out calmly with the weapons papers and meets the consul at
     * EVOLUTION's door for the lift to CIRRUS, a drink and the handover
     * (skyline-meeting.js). The driving and the walk into the club are here.
     */
    const FORT_JOB = {
      // The coast road where the Sentinel causeway reaches the mainland: every car
      // leaving the fort passes it (the route turns north at x 7796).
      stakeout: { x: 7740, y: 8060 },
      // Kessler's car in the fort's lot by the gate, nose to the outbound lane.
      depart: { x: 9440, y: 8098, a: Math.PI },
      // Out through the gate's outbound lane (SENTINEL.gate lanes, military-base.js).
      gateOut: [
        { x: 9330, y: 8098 },
        { x: 9100, y: 8112 },
      ],
      // Marina Rd's north kerb opposite the Marea's door (he arrives westbound).
      park: { x: -2822, y: 5220, a: Math.PI },
      // Across the road to the door, then in (MAREA_NODES street, out, in: beachclub-plan.js).
      walkIn: [
        { x: -2800, y: 5236 },
        { x: -2776, y: 5300 },
        { x: -2768, y: 5322 },
        { x: -2768, y: 5342 },
        { x: -2768, y: 5368 },
      ],
      car: 'muscle',
      carColor: '#7a1c1a',
      // Tailing: noticed when this close behind him for a while, lost past `lost`.
      close: 150,
      tooClose: 70,
      lost: 1800,
      lostSeconds: 15,
    };
    const FORT_STAGE = {
      stakeout: 0,
      tail: 1,
      parked: 2,
      trunk: 3,
      take: 4,
      change: 5,
      gate: 6,
      inside: 7,
      out: 8,
      meet: 9,
    };
    function fortJob() {
      return mission?.index === 3 ? mission : null;
    }
    // The consul's lines at EVOLUTION and CIRRUS for this job (skyline-meeting.js opts.lines).
    const FORT_MEETING_LINES = {
      door: [
        ['them', 'Lieutenant Kessler, I presume.'],
        ['you', 'Only until I change my shirt.'],
        ['them', 'Then keep it on a little longer. I have a table upstairs.'],
      ],
      talk: [
        ['them', 'To Vinny, and to the army’s filing system.'],
        ['you', 'Vinny said you pay on delivery.'],
        ['them', 'I pay for what I can read. Did you make copies?'],
        ['you', 'No copies. That’s the only one.'],
        ['them', 'Good. Then the army is missing one folder, not a photocopier.'],
        ['you', 'They’ll notice by Monday.'],
        ['them', 'By Monday it will be in a diplomatic pouch, and I will be at a reception complaining about the weather.'],
      ],
      read: [['them', 'HAWTHORN. Vinny was not exaggerating.']],
    };
    // What each beat of the CIRRUS meeting asks of the player: the strip and the brief.
    const FORT_MEETING_STEPS = {
      waiting: ['MEET CONSUL VARGA AT EVOLUTION’S DOOR · NORTH POINT KEY', null],
      greeted: ['TAKE THE ELEVATOR TO CIRRUS WITH VARGA', 'Ride the elevator up to CIRRUS, the rooftop bar, with Varga.'],
      lift: ['TAKE THE ELEVATOR TO CIRRUS WITH VARGA', null],
      terrace: ['SIT WITH VARGA AT HIS TABLE', 'Join Varga at his table by the glass.'],
      seated: ['HAVE A DRINK WITH VARGA', 'Have a drink with Varga and let him talk.'],
      drinks: ['HAVE A DRINK WITH VARGA', null],
      handover: ['HAND OVER THE PAPERS', 'Hand Varga the HAWTHORN file.'],
    };
    /* A step of the job: the strip's short objective (setStage) and the big brief that explains it (mission-brief.js). */
    function fortStage(m, stage, target, instruction, brief, speaker, line, briefOptions) {
      setStage(stage, target, instruction, speaker, line);
      if (brief) missionBrief(brief, briefOptions);
    }
    // A line said a moment later (after the one on screen has been read).
    function fortLater(m, seconds, speaker, text) {
      m.later = { at: gameTime + seconds, speaker, text };
    }
    function startFortJob(m) {
      m.kcar = null;
      m.kessler = null;
      m.tailHeat = 0;
      m.lostFor = 0;
      m.stuckFor = 0;
      m.beats = {};
      m.keys = false;
      m.uniform = false;
      m.changeProgress = 0;
      m.parkedAt = 0;
      m.clubWait = 0;
      m.waitClub = false;
      m.jumped = false;
      m.alerted = false;
      m.kInCarAt = -9;
      m.shotSeen = player.lastShotAt ?? -100;
      m.later = null;
      m.meetStep = null;
      // He signs out at the gate shortly whether or not anyone is watching (the player may be on the way to the club).
      m.departAt = gameTime + 40;
      // Vinny's own opening line (story.js startMission leaves it on screen).
      m.ownOpening = true;
      if (!lockpickOwned()) giveLockpick(true);
      fortStage(
        m,
        FORT_STAGE.stakeout,
        FORT_JOB.stakeout,
        'CATCH KESSLER LEAVING FORT SENTINEL · OR WAIT FOR HIM AT THE MAREA',
        'You need to steal a military uniform to infiltrate the fort. An officer, Lieutenant Kessler, is spending his day off at the Marea Beach Club. Steal the uniform from the trunk of his car: wait for him at the beach club, or intercept him before he gets there.',
        'vinny',
        'Fort Sentinel keeps a file called HAWTHORN in its records office, and a consul named Varga will pay a fortune for it. You’re walking in the front gate, in Lieutenant Kessler’s uniform.',
        { kicker: 'THE JOB' },
      );
      tell(
        'Vinny’s lockpick is in your arsenal: ' +
          pressKey('lockpick', true) +
          ' to take it in hand. It opens a trunk quietly, as long as nobody is looking.',
        8,
      );
    }
    function fortBeat(m, id, text, speaker = 'vinny') {
      if (m.beats[id]) return;
      m.beats[id] = true;
      missionLine(speaker, text);
    }
    /* Kessler's road route from the fort's gate to the Marea's kerb: the city's
       navigation graph (navigation.js), held to the right-hand lane as the cabs
       drive it (taxi.js), the gate's outbound lane first and the kerb last. */
    function fortRoute() {
      const nodes = navigationGraph(),
        from = FORT_JOB.gateOut[1],
        path = navShortestPath(nodes, closestNavNode(from, nodes), closestNavNode(FORT_JOB.park, nodes)),
        route = FORT_JOB.gateOut.map((p) => ({ x: p.x, y: p.y }));
      for (let i = 0; i < path.length; i++) {
        const prev = i ? path[i - 1] : from,
          along = headingBetween(prev, path[i]),
          lane = 24;
        route.push({ x: path[i].x - Math.sin(along) * lane, y: path[i].y + Math.cos(along) * lane });
      }
      route.push({ x: FORT_JOB.park.x + 60, y: FORT_JOB.park.y }, { x: FORT_JOB.park.x, y: FORT_JOB.park.y });
      return route;
    }
    function fortDepart(m) {
      const d = FORT_JOB.depart,
        c = makeCar(FORT_JOB.car, d.x, d.y, d.a, true, FORT_JOB.carColor);
      assignDriver(c);
      c.locked = true;
      c.driverFemale = false;
      c.driverRole = 'casual';
      c.driverColor = '#c9b48a';
      c.passengers = 0;
      c.mission = true;
      c.missionDriver = 'kessler';
      c.trunkLoot = { label: 'UNIFORM AND ID' };
      c.countyRoute = fortRoute();
      c.countyIndex = 0;
      m.kcar = c;
      m.departedAt = gameTime;
      m.kInCarAt = gameTime;
      m.shotSeen = player.lastShotAt ?? -100;
      const watching = distanceBetween(player, FORT_JOB.stakeout) < 900;
      fortStage(
        m,
        FORT_STAGE.tail,
        c,
        'TAIL KESSLER’S RED MUSCLE CAR · OR WAIT FOR HIM AT THE MAREA',
        watching
          ? 'That’s Kessler’s red muscle car coming out of the gate. Follow him at a distance, or go ahead and wait for him at the Marea Beach Club.'
          : 'Kessler has just left Fort Sentinel in his red muscle car. Catch up with him, or wait for him at the Marea Beach Club.',
        'vinny',
        watching
          ? 'There he is, the red one through the gate. Give him room. He’s army, he checks his mirrors.'
          : 'He just signed out at the gate. Red muscle car, heading for the Marea. Your call where you take him.',
      );
    }
    /* Kessler on foot (out at the club, carjacked, or thrown out of a crash): a
       pedestrian made by makeCarDriver carrying the car's `missionDriver`. */
    function fortKessler(m) {
      if (m.kessler && pedestrians.includes(m.kessler)) return m.kessler;
      m.kessler = null;
      for (let i = 0; i < pedestrians.length; i++)
        if (pedestrians[i].missionDriver === 'kessler') return (m.kessler = pedestrians[i]);
      return null;
    }
    /* The scripted walk of a mission's pedestrian (Kessler across Marina Rd to the
       Marea's door): his own routine until something frightens him (game-people.js
       steps aside for a reaction first; this one does too). */
    function updateMissionWalker(p, deltaSeconds) {
      const w = p.missionWalk;
      if (!w || w.done || p.flee > 0 || p.react || p.knockedFor || p.ejected || p.dazedFor > 0) return false;
      const target = w.route[w.i];
      if (!target) {
        w.done = true;
        p.walking = false;
        return true;
      }
      const speed = cityTempo().speed * 0.9,
        a = headingBetween(p, target),
        step = Math.min(distanceBetween(p, target), speed * deltaSeconds);
      p.a = a;
      p.walking = true;
      p.x += Math.cos(a) * step;
      p.y += Math.sin(a) * step;
      p.walk += deltaSeconds * strideRate(speed);
      if (distanceBetween(p, target) < 4) w.i++;
      return true;
    }
    /* Whether Kessler, on foot, can see the player at his car (a forward look, ~100 m). */
    function fortKesslerSees(p) {
      if (!p || p.hp <= 0 || personIncapacitated(p)) return false;
      const d = distanceBetween(p, player);
      if (d > 320) return false;
      const off = Math.abs(normalizeAngle(headingBetween(p, player) - p.a));
      return (off < 1.2 || d < 60) && clearSight(p, player);
    }
    function fortParkCar(m) {
      const c = m.kcar;
      c.ai = false;
      c.countyRoute = null;
      c.vx = c.vy = c.speed = c.av = 0;
      c.occupied = false;
      m.parkedAt = gameTime;
      const door = driverDoor(c),
        p = makeCarDriver(c, door.x, door.y, door.a);
      p.missionDriver = 'kessler';
      p.missionWalk = { route: FORT_JOB.walkIn.map((q) => ({ x: q.x, y: q.y })), i: 0, done: false };
      m.kessler = p;
      fortStage(
        m,
        FORT_STAGE.parked,
        trunkPoint(c, { x: 0, y: 0 }),
        'LET KESSLER WALK INTO THE CLUB · THEN PICK HIS TRUNK',
        'Kessler has parked across from the Marea. Let him walk into the club before you go near his car.',
        'vinny',
        'He’s parked. Let him get through the door first. The bouncers have eyes, and so does he.',
      );
    }
    /* Shot at in his car: he gets on the radio to the fort before he does anything else. Five stars at once,
       the army among them; he stops and runs, the engine left running (the keys stay with the car). */
    function fortAlerted(m) {
      const c = m.kcar;
      m.alerted = true;
      if (c.occupied) {
        const k = ejectDriver(c, 'shot');
        if (k) {
          k.flee = 14;
          k.mood = 'flee';
        }
        c.ai = false;
        c.countyRoute = null;
        c.vx = c.vy = c.speed = 0;
      }
      c.locked = false;
      m.keys = true;
      // On foot already (a round through the glass ejects him first, carjack.js): the radio, not a surrender.
      const runner = fortKessler(m);
      if (runner) {
        runner.speech = 'SENTINEL! I’M TAKING FIRE!';
        runner.speechUntil = gameTime + 3;
        runner.speechKind = null;
        runner.flee = Math.max(runner.flee || 0, 14);
      }
      crime(32, 'seen');
      setWantedLevel(5);
      searchActive = false;
      searchRemaining = policeSearchSeconds(5);
      lastSeen = { x: player.x, y: player.y };
      announce('FORT SENTINEL · RADIO CALL', 'KESSLER ALERTED THE MILITARY', 4);
      tone(196, 0.5, 0.09, 'sawtooth', 150);
      missionLine('KESSLER', 'Sentinel, Sentinel, this is Lieutenant Kessler! I’m taking fire on ' + titleCaseStreet(streetNameAt(c.x, c.y)) + '! Get the MPs out here!');
      fortLater(m, 4.5, 'vinny', 'He got on the radio. That’s the army on you now, not just the cops. Lose them. His ID still opens the gate: the army takes days to cancel anything.');
      fortStage(
        m,
        FORT_STAGE.trunk,
        trunkPoint(c, { x: 0, y: 0 }),
        'OPEN KESSLER’S TRUNK · ' + keyName('interact') + ' · THEN LOSE THE ARMY',
        'Kessler radioed the fort and the army is coming for you. Grab the uniform from his trunk, the keys are still in his car, then lose all five stars.',
        null,
        null,
        { tone: 'alert', kicker: 'THE ARMY IS COMING' },
      );
    }
    function titleCaseStreet(name) {
      return (name || 'the coast road').toLowerCase().replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
    }
    /* Waiting at the Marea instead of tailing him: once the player has waited a while near the club, his car
       is put on its last approach (out of the player's sight), as if he had driven the city in the meantime. */
    function fortClubWait(m, deltaSeconds) {
      const c = m.kcar,
        route = c.countyRoute,
        atClub = distanceBetween(player, FORT_JOB.park) < 1100,
        far = distanceBetween(c, player) > 1700;
      if (!atClub || !far || !route) {
        if (!atClub) m.clubWait = 0;
        return;
      }
      if (!m.waitClub) {
        m.waitClub = true;
        fortStage(
          m,
          FORT_STAGE.tail,
          FORT_JOB.park,
          'WAIT FOR KESSLER AT THE MAREA BEACH CLUB',
          'Wait for Kessler near the Marea Beach Club. He always parks on the kerb across from the door.',
          'vinny',
          'Smart. Park where you can see the kerb across from the door. He takes the same spot every time.',
        );
      }
      m.clubWait += deltaSeconds;
      if (m.jumped || m.clubWait < 14) return;
      const last = Math.max(3, route.length - 7);
      for (let i = last; i > Math.max(2, last - 14); i--) {
        const p = route[i],
          q = route[i + 1];
        if (i <= c.countyIndex || !spotUnseen(p.x, p.y, 70, SPOT_CAR) || !canSpawnCar(c.type, p.x, p.y, headingBetween(p, q))) continue;
        c.x = p.x;
        c.y = p.y;
        c.a = headingBetween(p, q);
        c.vx = c.vy = 0;
        c.countyIndex = i + 1;
        m.jumped = true;
        m.passed = true;
        fortBeat(m, 'coming', 'Heads up. Red muscle car, coming along Marina Road now.');
        tell('Kessler’s red muscle car is turning onto Marina Road.', 3.5);
        return;
      }
    }
    function updateFortTail(m, deltaSeconds) {
      const c = m.kcar;
      if (!c.occupied) return;
      const route = c.countyRoute;
      // Arrived: the kerb opposite the club.
      if (route && c.countyIndex === route.length - 1 && distanceBetween(c, route[route.length - 1]) < 60) {
        fortParkCar(m);
        return;
      }
      // countyRouteControl wraps to the start after the last point: never let it.
      if (route && c.countyIndex === 0 && gameTime - m.departedAt > 20) c.countyIndex = route.length - 1;
      // Wedged in traffic: a horn, then out of sight he finds his way round.
      if (Math.abs(c.speed || 0) < 6 && c.ai) {
        m.stuckFor += deltaSeconds;
        if (m.stuckFor > 4 && m.stuckFor - deltaSeconds <= 4) carHorn(c, 0.6, true);
        if (m.stuckFor > 9 && route) {
          const next = route[Math.min(route.length - 1, c.countyIndex + 1)];
          const blocker = fortBlockingCar(c);
          if (spotUnseen(next.x, next.y, 60, SPOT_CAR) && spotUnseen(c.x, c.y, 60, SPOT_CAR) && canSpawnCar(c.type, next.x, next.y, headingBetween(c, next))) {
            c.a = headingBetween(c, next);
            c.x = next.x;
            c.y = next.y;
            c.vx = c.vy = 0;
            c.countyIndex = Math.min(route.length - 1, c.countyIndex + 1);
          } else if (blocker && fortBlockAlong < 160 && Math.abs(blocker.speed || 0) < 6 * KMH) {
            // In sight behind a car that is not moving: he pulls out into the other lane and round it, as anyone would.
            const fx = Math.cos(c.a),
              fy = Math.sin(c.a),
              sx = Math.sin(c.a) * 44,
              sy = -Math.cos(c.a) * 44,
              ahead = vehicleSpec(blocker).l / 2 + 50;
            route.splice(
              c.countyIndex,
              0,
              { x: blocker.x + sx - fx * 10, y: blocker.y + sy - fy * 10 },
              { x: blocker.x + sx + fx * ahead, y: blocker.y + sy + fy * ahead },
            );
            m.overtakes = (m.overtakes || 0) + 1;
          }
          m.stuckFor = 0;
        }
      } else m.stuckFor = 0;
      if (m.stage !== FORT_STAGE.tail) return;
      fortClubWait(m, deltaSeconds);
      // The club: the arrow back on his car once it is near.
      if (m.waitClub && m.target !== c && distanceBetween(c, player) < 1200) {
        m.target = c;
        m.instruction = 'KESSLER IS HERE · LET HIM PARK';
        updateUI();
      }
      // The tail: close behind him (in his mirrors) builds his suspicion; out of range he is simply
      // somewhere ahead on his way to the Marea (he is a creature of habit).
      const d = distanceBetween(player, c),
        behind = Math.cos(normalizeAngle(headingBetween(c, player) - c.a)) < -0.3,
        driving = !!player.car;
      // Held up behind him at lights or a raised drawbridge is what any driver does: only
      // sitting on his bumper then counts, and slowly.
      const moving = Math.abs(c.speed || 0) > 12 * KMH;
      // Waiting at the club he drives up to the player: only following him counts there.
      if (d < FORT_JOB.tooClose && (!m.waitClub || (behind && driving))) m.tailHeat += deltaSeconds / (moving ? 4 : 12);
      else if (d < FORT_JOB.close && behind && driving && moving) m.tailHeat += deltaSeconds / 12;
      else m.tailHeat = Math.max(0, m.tailHeat - deltaSeconds / 15);
      if (m.tailHeat > 0.45) fortBeat(m, 'close', 'Too close! Let a car or two in between you, he’s looking in his mirror.');
      if (m.tailHeat >= 1) {
        failMission('Kessler made the tail and turned back to the fort. He’ll report it, so the job is dead.');
        return;
      }
      // The clock for losing him starts once he has come past the stakeout.
      if (!m.passed && (distanceBetween(c, FORT_JOB.stakeout) < 400 || gameTime - m.departedAt > 45)) m.passed = true;
      if (d > FORT_JOB.lost && m.passed && !m.waitClub) {
        m.lostFor += deltaSeconds;
        if (m.lostFor > FORT_JOB.lostSeconds) {
          m.lostFor = 0;
          m.waitClub = true;
          fortStage(
            m,
            FORT_STAGE.tail,
            FORT_JOB.park,
            'GET TO THE MAREA BEACH CLUB · WAIT FOR KESSLER',
            'You lost Kessler, but you know where he is going. Get to the Marea Beach Club and wait for his car.',
            'vinny',
            'Lost him? Doesn’t matter. He’s going to the Marea, same as every leave. Get there first.',
          );
        }
      } else m.lostFor = 0;
      if (gameTime - m.departedAt > 25 && !m.waitClub)
        fortBeat(m, 'radio', 'Kessler’s been going to the Marea every leave for a year. Rum, a table by the window, the same waitress. Creature of habit.');
    }
    function fortTrunkOpenOffer(m) {
      const c = m.kcar;
      return !player.car && c && !c.trunkOpen && distanceBetween(player, trunkPoint(c, fortScratch)) < 30;
    }
    const fortScratch = { x: 0, y: 0 };
    function fortTrunkText(m) {
      return m.keys ? 'OPEN KESSLER’S TRUNK · ' + keyName('interact') : 'PICK KESSLER’S TRUNK · LOCKPICK ' + keyName('lockpick');
    }
    function updateFortJob(m, deltaSeconds) {
      if (m.later && gameTime >= m.later.at) {
        missionLine(m.later.speaker, m.later.text);
        m.later = null;
      }
      if (m.stage === FORT_STAGE.stakeout) {
        if (distanceBetween(player, FORT_JOB.stakeout) < 450 && wantedStars === 0) {
          m.watchFor = (m.watchFor || 0) + deltaSeconds;
          fortBeat(m, 'watch', 'Good spot. Officers sign out at the gate like everybody else. Red muscle car: Lieutenant Dale Kessler.');
          if (m.watchFor > 6) fortDepart(m);
        } else if (gameTime >= m.departAt) fortDepart(m);
        return;
      }
      const c = m.kcar;
      if (!c) return;
      if (c.occupied) m.kInCarAt = gameTime;
      // Shot at while he is at the wheel (a hit, or rounds fired close by): he radios the fort.
      if (!m.alerted && m.stage <= FORT_STAGE.tail && gameTime - m.kInCarAt < 0.6 && (player.lastShotAt ?? -100) > m.shotSeen && gameTime - player.lastShotAt < 0.6) {
        m.shotSeen = player.lastShotAt;
        const hit = c.lastAttacker === player && gameTime - (c.lastDamagedAt ?? -100) < 0.6;
        if (hit || distanceBetween(player, c) < 320) {
          fortAlerted(m);
          return;
        }
      }
      if (c.occupied) updateFortTail(m, deltaSeconds);
      if (!mission) return;
      const k = fortKessler(m);
      // The messy way: out of the car before the club (carjacked, crashed), or down.
      if (k && k.hp <= 0 && !m.killed) {
        m.killed = true;
        if (!m.keys)
          fortStage(
            m,
            FORT_STAGE.trunk,
            k,
            'TAKE KESSLER’S KEYS · ' + keyName('interact'),
            'Kessler is dead. Take the car keys from his body and open the trunk before the police arrive.',
            'vinny',
            'Christ. Well, he won’t need the uniform. His keys are on him. Be quick.',
          );
        else fortBeat(m, 'killed', 'Christ. Well, he won’t need the uniform. Get that trunk open and get gone.');
      }
      if (!c.occupied && m.stage === FORT_STAGE.tail) {
        // Taken from him on the road: the keys are in it.
        if (player.car === c) m.keys = true;
        fortStage(
          m,
          FORT_STAGE.trunk,
          trunkPoint(c, { x: 0, y: 0 }),
          fortTrunkText(m),
          'You took Kessler’s car. Get the uniform out of the trunk before the police show up.',
          'vinny',
          'That’s loud. Get the uniform out of that trunk and get gone before the cops come.',
        );
      }
      if (player.car === c && !m.keys) {
        m.keys = true;
        tell('The keys are in the ignition.', 2.5);
      }
      if (m.stage === FORT_STAGE.parked) {
        if (k && k.missionWalk?.done) {
          // Inside the club: out of the world until the job ends.
          pedestrians.splice(pedestrians.indexOf(k), 1);
          m.kessler = null;
          m.inside = true;
          fortStage(
            m,
            FORT_STAGE.trunk,
            trunkPoint(c, { x: 0, y: 0 }),
            fortTrunkText(m),
            'Kessler is inside. Pick his trunk with Vinny’s lockpick (' + keyName('lockpick') + '), and wait until nobody is looking.',
            'vinny',
            'He’s in. Lockpick, trunk, and walk away like it’s your car. If somebody’s watching, wait. Nobody watches forever.',
          );
        } else if (!k || k.hp <= 0) setStage(FORT_STAGE.trunk, trunkPoint(c, { x: 0, y: 0 }), fortTrunkText(m));
      }
      // Seen at his car while he can see it: he shouts, and someone calls it in.
      if ((m.stage === FORT_STAGE.parked || m.stage === FORT_STAGE.trunk) && k && !m.spotted && trunkPicking(c) && fortKesslerSees(k)) {
        m.spotted = true;
        k.speech = 'HEY! THAT’S MY CAR!';
        k.speechUntil = gameTime + 2.5;
        k.missionWalk = null;
        witnessReport(k, 'theft', c.x, c.y);
      }
      if (m.stage === FORT_STAGE.trunk || m.stage === FORT_STAGE.parked) {
        if (c.trunkOpen) {
          fortStage(
            m,
            FORT_STAGE.take,
            trunkPoint(c, { x: 0, y: 0 }),
            'TAKE THE UNIFORM AND THE ID · ' + keyName('interact'),
            'The trunk is open. Take the duffel bag with Kessler’s uniform and his ID.',
          );
          tell('A duffel bag: a pressed uniform with lieutenant’s bars, boots, a cap and a laminated ID. KESSLER, D. · 1LT · LOGISTICS.', 5);
          return;
        }
        if (m.killed && !m.keys && k) {
          // His keys are on him.
          if (m.instruction.indexOf('TAKE') !== 0) setStage(FORT_STAGE.trunk, k, 'TAKE KESSLER’S KEYS · ' + keyName('interact'));
          return;
        }
        if (m.keys && m.instruction.indexOf('OPEN') !== 0) setStage(FORT_STAGE.trunk, trunkPoint(c, { x: 0, y: 0 }), fortTrunkText(m) + (m.alerted ? ' · THEN LOSE THE ARMY' : ''));
        if (m.stage === FORT_STAGE.trunk) trunkPoint(c, m.target);
        return;
      }
      if (m.stage === FORT_STAGE.change) {
        // In a car standing still he changes on the back seat by himself; out of sight on foot, a held interact.
        const hidden = fortChangeSpot();
        if (hidden && (player.car || actionHeld('interact'))) {
          m.changeProgress += deltaSeconds;
          if (m.changeProgress >= 3) fortChanged(m);
        } else m.changeProgress = Math.max(0, m.changeProgress - deltaSeconds * 0.5);
        return;
      }
      if (m.stage === FORT_STAGE.gate) {
        if (fortCover.cleared) {
          fortStage(
            m,
            FORT_STAGE.inside,
            FORT_RECORDS.door,
            'WALK TO THE RECORDS OFFICE · LEFT SIDE OF HEADQUARTERS',
            'You’re in. Walk, don’t run, to the Records Office: the side door on the left of Headquarters. Stay out of restricted areas.',
            'vinny',
            'You’re in. Walk like you’ve been there two years. Side door, left of the main entrance. Not past the sentries.',
          );
        } else if (wantedStars > 0 && m.instruction.indexOf('LOSE') !== 0) {
          m.instruction = 'LOSE THE POLICE · THEN WALK UP TO THE GATE';
          missionBrief('The gate won’t open for a wanted man. Lose the police first, then walk up to Fort Sentinel’s gate.', { tone: 'alert' });
        } else if (wantedStars === 0 && m.instruction.indexOf('LOSE') === 0) m.instruction = FORT_GATE_TEXT;
        return;
      }
      if (m.stage === FORT_STAGE.inside) {
        if (fortCover.alarmed && !fortCover.papers) {
          failMission('Your cover is blown. The records office is locked down.');
          return;
        }
        if (fortCover.papers)
          fortStage(
            m,
            FORT_STAGE.out,
            FORT_COVER_GATE.check,
            'WALK OUT THROUGH THE MAIN GATE · CALMLY',
            'You have the HAWTHORN file. Walk calmly back out through the main gate. Don’t run.',
            'vinny',
            'Got it? Don’t run. Nobody runs out of a base unless they’ve got something to hide.',
          );
        return;
      }
      if (m.stage === FORT_STAGE.out) {
        const out = fortCover.leftWithPapers || (!inMilitary(player.x, player.y) && distanceBetween(player, FORT_COVER_GATE.check) > 260);
        if (fortCover.alarmed && m.instruction.indexOf('COVER') !== 0) {
          m.instruction = 'COVER BLOWN · GET OUT WITH THE PAPERS';
          missionBrief('Your cover is blown! Get out of Fort Sentinel alive, with the papers.', { tone: 'alert' });
          missionLine('vinny', 'They made you! Get out of there. Any way you can, just keep that folder!');
          updateUI();
        }
        if (out) {
          skyMeetingBegin({ name: 'ANTON VARGA', title: 'the consul', lines: FORT_MEETING_LINES });
          m.meetStep = 'waiting';
          fortStage(
            m,
            FORT_STAGE.meet,
            skyMeetingTarget(),
            'MEET CONSUL VARGA AT EVOLUTION’S DOOR · NORTH POINT KEY',
            'Take the papers to Consul Anton Varga. He is waiting at the door of the EVOLUTION tower on North Point Key.',
            'vinny',
            'Out? Beautiful. Varga’s waiting at the door of the EVOLUTION tower on the Key. He’ll buy you a drink upstairs. Be polite, he’s a diplomat.',
          );
        }
        return;
      }
      if (m.stage === FORT_STAGE.meet) {
        const s = skyMeeting.stage,
          step = FORT_MEETING_STEPS[s] || FORT_MEETING_STEPS.handover,
          text = wantedStars > 0 ? 'LOSE THE POLICE · VARGA WON’T MEET WITH HEAT ON YOU' : step[0];
        const target = skyMeetingTarget() || m.target;
        if (text !== m.instruction || target !== m.target) {
          m.instruction = text;
          m.target = target;
          updateUI();
        }
        if (s !== m.meetStep && FORT_MEETING_STEPS[s]) {
          m.meetStep = s;
          if (step[1]) missionBrief(step[1]);
        }
        if (s === 'failed') {
          failMission('The consul is dead. Nobody will buy those papers now.');
          return;
        }
        if (s === 'done') winMission();
      }
    }
    const FORT_GATE_TEXT = 'WALK UP TO FORT SENTINEL’S GATE · SHOW YOUR ID';
    /* Somewhere to change: inside a car that is standing still, or out of everyone's sight. */
    function fortChangeSpot() {
      if (player.car) return Math.abs(player.car.speed || 0) < 4 && !isAircraft(player.car) && !vehicleSpec(player.car).bike;
      for (let i = 0; i < pedestrians.length; i++) {
        const p = pedestrians[i];
        if (p.hp > 0 && Math.abs(p.x - player.x) < 260 && Math.abs(p.y - player.y) < 260 && distanceBetween(p, player) < 260 && clearSight(p, player)) return false;
      }
      return !inMilitary(player.x, player.y);
    }
    function fortChanged(m) {
      m.changeProgress = 0;
      m.uniform = true;
      wearUniform(true);
      fortCoverBegin();
      drawWeapon();
      announce('BORROWED STRIPES', 'LT. D. KESSLER', 2.6);
      fortStage(
        m,
        FORT_STAGE.gate,
        FORT_COVER_GATE.check,
        wantedStars > 0 ? 'LOSE THE POLICE · THEN WALK UP TO THE GATE' : FORT_GATE_TEXT,
        wantedStars > 0
          ? 'You’re wearing Kessler’s uniform, but the gate won’t open for a wanted man. Lose the police, then walk up to Fort Sentinel’s gate.'
          : 'You’re Lieutenant Kessler now. Leave your car outside the wire, walk up to Fort Sentinel’s gate and show your ID to the sergeant.',
        'vinny',
        'Fits? Good. You’re Kessler, logistics, called back early for an audit. Leave the car outside the wire, hands empty, and walk up like you’re tired of this place.',
      );
    }
    /* Kessler's keys open his trunk outright: asked before the lockpick (game-player-actions.js),
       so with the pick in hand a key still wins. */
    function fortKeysOpenTrunk() {
      const m = fortJob(),
        c = m?.kcar;
      if (!c || c.trunkOpen || !m.keys || !fortTrunkOpenOffer(m) || (m.stage !== FORT_STAGE.trunk && m.stage !== FORT_STAGE.parked)) return false;
      openTrunk(c);
      return true;
    }
    function fortJobInteract() {
      const m = fortJob();
      if (!m) return false;
      const c = m.kcar;
      // The messy way: his keys from the body, or the keys in a car taken from him.
      const k = fortKessler(m);
      if (k && k.hp <= 0 && !m.keys && !player.car && distanceBetween(player, k) < 34) {
        m.keys = true;
        player.lootUntil = gameTime + LOOT_CROUCH;
        player.lootFacing = headingBetween(player, k);
        tell('KESSLER’S KEYS', 2);
        return true;
      }
      if (fortKeysOpenTrunk()) return true;
      if (m.stage === FORT_STAGE.take && c && !player.car && distanceBetween(player, trunkPoint(c, fortScratch)) < 34) {
        player.lootUntil = gameTime + LOOT_CROUCH;
        player.lootFacing = headingBetween(player, c);
        m.bag = true;
        c.trunkLoot = null;
        fortStage(
          m,
          FORT_STAGE.change,
          null,
          'CHANGE INTO THE UNIFORM · SIT IN A PARKED CAR, OR HOLD ' + keyName('interact') + ' OUT OF SIGHT',
          'Now change into the uniform where nobody can see you. Sitting in a parked car works, or hold ' + keyName('interact') + ' somewhere out of sight.',
          'vinny',
          'Not on the street, genius. In a car, or somewhere nobody’s looking.',
        );
        return true;
      }
      if (m.stage === FORT_STAGE.change && !player.car && fortChangeSpot()) return true;
      return false;
    }
    function fortJobUI() {
      const m = fortJob();
      if (!m) return;
      if (m.stage === FORT_STAGE.tail && m.kcar?.occupied && !m.waitClub) {
        const box = getElement('stealthStatus');
        box.style.display = 'block';
        getElement('stealthLabel').textContent = m.lostFor > 0 ? 'TAIL · YOU’RE LOSING HIM' : m.tailHeat > 0.45 ? 'TAIL · HE’S CHECKING HIS MIRRORS' : 'TAIL · KESSLER';
        getElement('stealthFill').style.width = Math.round(Math.min(1, m.tailHeat) * 100) + '%';
        getElement('stealthHint').textContent = m.lostFor > 0 ? 'CLOSE THE GAP, OR WAIT AT THE MAREA' : 'STAY BACK · NOT RIGHT BEHIND HIM';
        box.classList.toggle('hot', m.tailHeat > 0.45 || m.lostFor > 0);
        box.classList.toggle('seen', m.tailHeat > 0.45);
      }
      const k = fortKessler(m);
      if (k && k.hp <= 0 && !m.keys && !player.car && distanceBetween(player, k) < 34) offerPrompt('TAKE HIS KEYS', { id: 'fort-keys' });
      if (m.keys && fortTrunkOpenOffer(m)) offerPrompt('OPEN THE TRUNK', { id: 'fort-trunk' });
      if (m.stage === FORT_STAGE.take && m.kcar && !player.car && distanceBetween(player, trunkPoint(m.kcar, fortScratch)) < 34)
        offerPrompt('TAKE THE UNIFORM AND ID', { id: 'fort-take' });
      if (m.stage === FORT_STAGE.change) {
        if (fortChangeSpot())
          offerPrompt(
            m.changeProgress > 0 ? 'CHANGING · ' + Math.round((m.changeProgress / 3) * 100) + ' %' : 'CHANGE INTO THE UNIFORM',
            player.car ? { key: null, id: 'fort-change-car' } : { hold: true, id: 'fort-change' },
          );
        else if (player.car) offerPrompt('STOP THE CAR TO CHANGE', { key: null, id: 'fort-change-moving' });
        else offerPrompt('PEOPLE ARE WATCHING · CHANGE IN A PARKED CAR OR OUT OF SIGHT', { key: null, id: 'fort-change-seen' });
      }
    }
    function fortJobCleanup() {
      const m = fortJob();
      for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].missionDriver === 'kessler') pedestrians.splice(i, 1);
      if (m?.kcar) {
        m.kcar.missionDriver = undefined;
        m.kcar.trunkLoot = undefined;
      }
      // The uniform and the cover go in fortCoverReset, the meeting in skyMeetingWrapUp (cleanupMissionExtras).
    }
    /* A won job leaves the player in Kessler's uniform (at CIRRUS, mid-drink): it is his
       until he changes (a car or out of sight), dies or takes the next job. */
    function fortJobKeepsUniform() {
      const m = fortJob();
      return !!m && m.stage === FORT_STAGE.meet && skyMeeting.stage === 'done' && player.uniform === 'army';
    }
    /* Console test shortcuts (game-console-missions.js fortSkip): restart the job and jump to a beat. 'arrive': Kessler's car on its last approach to the Marea, the player's
       car behind it; 'parked': he has parked and is crossing to the door; 'inside': he is in,
       the player on foot at his trunk; 'changed': in uniform and cover on, on foot short of the
       gate; 'meet': out of the base with the papers, the consul waiting at EVOLUTION. */
    function fortJobSkip(where) {
      // Always a fresh run of the job (a parked car has no route left).
      missionIndex = 3;
      startMission();
      const m = mission;
      fortDepart(m);
      const c = m.kcar,
        route = c.countyRoute;
      if (where === 'arrive' || where === 'parked' || where === 'inside') {
        const i = Math.max(3, route.length - 7),
          p = route[i],
          q = route[i + 1];
        c.x = p.x;
        c.y = p.y;
        c.a = headingBetween(p, q);
        c.vx = c.vy = 0;
        c.countyIndex = i + 1;
        m.departedAt = gameTime - 60;
        m.passed = true;
        m.tailHeat = 0;
        if (where === 'arrive') {
          const b = route[i - 3];
          if (player.car) exitCar(true);
          teleportPlayer(b.x, b.y);
        }
      }
      if (where === 'parked' || where === 'inside') {
        const k = route[route.length - 1];
        c.x = k.x;
        c.y = k.y;
        c.a = FORT_JOB.park.a;
        fortParkCar(m);
        if (where === 'inside') {
          m.kessler.x = FORT_JOB.walkIn[FORT_JOB.walkIn.length - 1].x;
          m.kessler.y = FORT_JOB.walkIn[FORT_JOB.walkIn.length - 1].y;
          m.kessler.missionWalk.i = FORT_JOB.walkIn.length;
          updateMissionWalker(m.kessler, 0);
          if (player.car) exitCar(true);
          const t = trunkPoint(c, { x: 0, y: 0 });
          teleportPlayer(t.x - Math.cos(c.a) * 6, t.y - Math.sin(c.a) * 6);
          missionUpdate(0);
        } else if (player.car) exitCar(true);
      }
      if (where === 'changed' || where === 'meet') {
        c.occupied = false;
        c.ai = false;
        m.bag = true;
        if (player.car) exitCar(true);
        teleportPlayer(FORT_COVER_GATE.check.x - 260, FORT_COVER_GATE.check.y);
        fortChanged(m);
        if (where === 'meet') {
          fortCover.cleared = fortCover.papers = fortCover.leftWithPapers = true;
          m.stage = FORT_STAGE.out;
          missionUpdate(0);
        }
      }
      return fortJobReport();
    }
    /* What holds Kessler's car up (countyRouteControl's look-ahead): the nearest vehicle in his lane ahead, or someone in front. */
    let fortBlockAlong = 0;
    // The nearest vehicle in his lane ahead within the look-ahead (fortBlockAlong: how far along).
    function fortBlockingCar(c) {
      const cos = Math.cos(c.a),
        sin = Math.sin(c.a);
      let best = null;
      fortBlockAlong = 241;
      for (let i = 0; i < vehicles.length; i++) {
        const o = vehicles[i];
        if (o === c || (o.altitude || 0) > 15) continue;
        const dx = o.x - c.x,
          dy = o.y - c.y,
          along = dx * cos + dy * sin,
          side = Math.abs(-dx * sin + dy * cos);
        if (along > 0 && along < fortBlockAlong && side < (vehicleSpec(c).w + vehicleSpec(o).w) / 2 + 7) {
          fortBlockAlong = along;
          best = o;
        }
      }
      return best;
    }
    function fortBlocker(c) {
      const o = fortBlockingCar(c),
        best = o
          ? { kind: 'vehicle', type: o.type, along: Math.round(fortBlockAlong), occupied: !!o.occupied, ai: !!o.ai, kmh: Math.round(Math.abs(o.speed || 0) / KMH) }
          : null;
      if (best) return best;
      let person = null;
      forEachPedestrianNear(c.x, c.y, 160, (p) => {
        if (!person && p.hp > 0 && distanceBetween(c, p) < 160 && Math.abs(normalizeAngle(headingBetween(c, p) - c.a)) < 0.45)
          person = { kind: 'person', along: Math.round(distanceBetween(c, p)), walking: !!p.walking };
      });
      return person;
    }
    function fortJobReport() {
      const m = fortJob();
      if (!m) return null;
      const pt = (p) => (p ? { x: Math.round(p.x), y: Math.round(p.y) } : null),
        k = fortKessler(m),
        c = m.kcar;
      return {
        stage: m.stage,
        instruction: m.instruction,
        target: pt(m.target),
        car: c
          ? { x: Math.round(c.x), y: Math.round(c.y), a: Math.round(c.a * 100) / 100, kmh: Math.round(Math.abs(c.speed || 0) / KMH), occupied: !!c.occupied, routeIndex: c.countyIndex, behind: c.countyRoute ? pt(c.countyRoute[Math.max(0, c.countyIndex - 4)]) : null, route: c.countyRoute?.length || 0, trunkOpen: !!c.trunkOpen, trunkPick: c.trunkPick || 0 }
          : null,
        kessler: k ? { x: Math.round(k.x), y: Math.round(k.y), hp: Math.round(k.hp), walking: !!k.missionWalk && !k.missionWalk.done } : null,
        inside: !!m.inside,
        tailHeat: Math.round(m.tailHeat * 100) / 100,
        lostFor: Math.round(m.lostFor * 10) / 10,
        keys: m.keys,
        killed: !!m.killed,
        spotted: !!m.spotted,
        alerted: !!m.alerted,
        blocker: c && c.occupied ? fortBlocker(c) : null,
        waitClub: !!m.waitClub,
        jumped: !!m.jumped,
        overtakes: m.overtakes || 0,
        clubWait: Math.round((m.clubWait || 0) * 10) / 10,
        uniform: !!player.uniform,
        changeProgress: Math.round(m.changeProgress * 10) / 10,
        lockpick: lockpickOwned(),
      };
    }
    // END SUBSYSTEM: src/fortjob.js
