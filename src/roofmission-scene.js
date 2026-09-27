    // Blue Hour scene: guests and guards (startRooftopHit), the alarm, stage flow and the party's frame update.
    function roofSay(p, text, seconds = 2.5) {
      p.speech = text;
      p.speechFor = seconds;
    }
    function startRooftopHit(m) {
      Object.assign(m, {
        disguise: false,
        suspicion: 0,
        alarm: false,
        weaponDrawn: false,
        killRegistered: false,
        bodyDelay: 0,
        poisoned: false,
        poisonTimer: 0,
        poisonUsed: false,
        poisonPhase: null,
        phaseTime: 0,
        glassTaken: false,
        partyPanic: false,
        medical: null,
        quietExit: false,
        suspicionRate: 0,
        playerSpeed: 0,
        lastPlayerSpot: null,
      });
      // The last run's ambulance stays parked below the doors after a win: it
      // goes now, or this run's would queue behind it (and they piled up).
      for (let i = vehicles.length - 1; i >= 0; i--)
        if (vehicles[i].missionAmbulance && vehicles[i] !== player.car) vehicles.splice(i, 1);
      const z = ROOFTOP.height + 3,
        boss = {
          ...ROOF_HIT.home,
          a: -Math.PI / 2,
          hp: 84,
          color: '#e5d7b2',
          name: ROOF_HIT.bossName,
          faction: 'vescari',
          missionTag: 'rooftop-hit',
          boss: true,
          // Vescari is the only one at the party with a plate under the jacket.
          vest: 60,
          timer: 1.4,
          walk: 0,
        };
      m.boss = boss;
      // A limousine taken from the hotel's door is back at the kerb (out of view).
      parkBlueHourLimousines(true);
      enemies.push(boss);
      const routes = [
        [
          [222, 85],
          [244, 166],
          [326, 177],
        ],
        [
          [75, 185],
          [166, 177],
          [165, 113],
        ],
        [
          [266, 232],
          [327, 231],
          [327, 310],
        ],
        [
          [128, 300],
          [212, 296],
          [212, 214],
        ],
      ];
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i].map((p) => roofAt(...p));
        enemies.push({
          ...route[0],
          a: i === 0 ? Math.PI : 0,
          hp: 70,
          color: '#293441',
          name: ['NICO FALCO', 'BRUNO RIZZO', 'CARLO SERRA', 'TITO MARCHETTI'][i],
          faction: 'vescari',
          missionTag: 'rooftop-hit',
          guard: true,
          timer: 1.7 + i * 0.6,
          walk: 0,
          patrol: i,
          patrolRoute: route,
          patrolIndex: 1,
          patrolWait: 2 + i * 1.5,
          // Head turn from the body's heading, and the sweep's clock (roofmission-stealth.js).
          look: 0,
          scan: i * 1.7,
          alert: 0,
          sees: false,
          seenFor: 0,
          postA: headingBetween(route[0], roofAt(180, 180)),
        });
      }
      const spots = [
        [35, 117],
        [62, 121],
        [89, 119],
        [118, 122],
        [155, 51],
        [157, 78],
        [53, 184],
        [80, 176],
        [114, 180],
        [31, 201],
        [71, 246],
        [97, 238],
        [125, 256],
        [94, 278],
        [119, 308],
        [162, 230],
        [181, 236],
        [204, 232],
        [224, 247],
        [164, 262],
        [185, 271],
        [209, 269],
        [232, 276],
        [266, 290],
        [272, 317],
        [293, 294],
        [328, 282],
        [324, 249],
        [323, 211],
        [320, 153],
        [323, 104],
        [281, 94],
        [248, 105],
        [225, 124],
        [221, 174],
        [159, 135],
      ];
      // Evening wear: midnight, champagne, burgundy, emerald, ivory, black, plum, old gold.
      const colors = [
        '#1d2940',
        '#d9c49a',
        '#6e1f2e',
        '#1f5a4a',
        '#ece4d2',
        '#1a1a1d',
        '#4f2a4f',
        '#b08a4a',
      ];
      spots.forEach(([x, y], i) => {
        const home = roofAt(x, y);
        storyActors.push({
          ...actor('PARTY GUEST', home.x, home.y, colors[i % colors.length], z),
          missionTag: 'rooftop-hit',
          guest: true,
          phase: i,
          home,
          role: i >= 15 && i <= 22 ? 'dance' : 'chat',
          idleWait: 1 + (i % 5),
          walk: 0,
        });
      });
      for (const [i, p] of [
        [214, 65],
        [81, 225],
        [130, 288],
      ].entries()) {
        const home = roofAt(...p);
        storyActors.push({
          ...actor(i === 0 ? 'BARTENDER' : 'WAITER', home.x, home.y, '#eee5cf', z),
          missionTag: 'rooftop-hit',
          guest: true,
          staff: true,
          home,
          phase: 40 + i,
          role: 'serve',
          idleWait: 2 + i,
        });
      }
      setStage(0, ROOF_HIT.outfit, 'COLLECT GUEST CLOTHES AT SUNSET MOTEL · ' + keyName('interact'));
    }
    function roofAlarm(m) {
      if (m.alarm) return;
      m.alarm = true;
      m.suspicion = 100;
      m.weaponDrawn = true;
      m.partyPanic = true;
      crime(2, 'seen');
      // Vescari still standing is still the job: leaving the terrace now lets him
      // go (updateRooftopHit fails it). Dying already, only the way out is left.
      const bossLive = m.boss.hp > 0 && !poisonCommitted(m);
      announce('THE BLUE HOUR · COVER BLOWN', bossLive ? 'TAKE HIM DOWN' : 'GET OUT ALIVE', 2.5);
      tell(
        bossLive
          ? 'Bodyguards alerted. Take Vescari down before you leave the terrace, or he gets away.'
          : 'Bodyguards alerted. Break their line of sight and reach the elevator.',
        4,
      );
      for (const e of enemies)
        if (e.missionTag === 'rooftop-hit') {
          e.aiming = true;
          // Weapons come up fast, but a guest's shoulders and the party's panic
          // give the player a beat to break for cover (drawn and fired in ~1 s).
          e.timer = 0.7 + seededRandom() * 0.5;
          e.roofRoute = null;
          e.look = 0;
          e.sees = false;
          e.pose = null;
        }
      // Security downstairs is called the moment the party breaks.
      wantedStars = Math.max(2, wantedStars);
      // The car brings the lift back up; the way out is not simply standing open.
      m.liftRecalled = gameTime + 9;
      // The objective follows: Vescari is still the job, if he is not already dying.
      if (bossLive) setStage(2, m.boss, 'COVER BLOWN · TAKE DOWN VESCARI');
    }
    function rooftopMissionInteract() {
      const missionState = rooftopJob();
      if (!missionState) return false;
      if (missionState.stage === 0 && !player.car && distanceBetween(player, ROOF_HIT.outfit) < 58) {
        if (wantedStars > 0) {
          needToLosePolice();
          return true;
        }
        missionState.disguise = true;
        player.disguised = true;
        // The disguise holsters the actual carried weapon without changing the loadout.
        drawWeapon();
        setStage(1, ROOFTOP.door, 'ENTER THE BLUE HOUR AS A GUEST');
        announce('MISSION 2 · A SEAT AT THE TABLE', 'GUEST ATTIRE', 2.5);
        tell(
          'Vescari is meeting the dock buyers in the VIP lounge. Walk, keep out of the bodyguards’ sight cones, and spike his reserved glass with ' +
            keyName('poison') +
            ' when nobody is looking, or draw a gun and fight the whole detail.',
          9,
        );
        return true;
      }
      return false;
    }
    /* Stage flow: the lounge, Vescari down, the lift, and the way out. A clean
       poisoning (no alarm, no stars) only asks the player to walk away from the
       hotel; a loud job (the alarm, or a body found) is the run to Coral Palms. */
    function updateRooftopHit(m, deltaSeconds) {
      const b = m.boss;
      updatePoisonDrink(m, deltaSeconds);
      if (m.stage === 1 && player.roof)
        setStage(
          2,
          ROOF_HIT.drink,
          'SPIKE VESCARI’S GLASS UNSEEN · ' + keyName('poison'),
        );
      if (b.hp <= 0 && !m.killRegistered) {
        m.killRegistered = true;
        b.drinking = false;
        b.speech = '';
        m.bodyDelay = Math.max(m.bodyDelay, 1);
        const quiet = b.poisoned && !m.alarm;
        setStage(
          3,
          {
            ...ROOFTOP.lift,
            altitude: ROOFTOP.height + 3,
          },
          quiet ? 'LEAVE CALMLY · TAKE THE ELEVATOR DOWN' : 'VESCARI IS DOWN · ESCAPE VIA THE ELEVATOR',
          quiet ? 'vinny' : undefined,
          quiet ? 'That’s it. Don’t run. Let them look at him, not at you.' : undefined,
        );
        if (quiet) tell('Vescari collapsed. Walk to the elevator: running draws the bodyguards’ eyes.', 5);
      }
      const grounded =
        !player.roof &&
        !player.parachute &&
        gameMode === 'play' &&
        Math.abs(entityElevation(player) - terrainHeight(player.x, player.y)) < 3;
      // Cover blown and off the terrace with Vescari standing (and not already
      // poisoned past saving): his detail has him out of the building, and the
      // job is lost. Walking out before any alarm leaves the job waiting upstairs.
      if (
        m.alarm &&
        b.hp > 0 &&
        !poisonCommitted(m) &&
        !player.roof &&
        (grounded || distanceBetween(player, ROOFTOP.door) > ROOF_AWAY)
      ) {
        failMission('Vescari got away: his detail had him out of the Blue Hour while you ran.');
        return;
      }
      if (m.stage === 3 && grounded) {
        m.quietExit = !!b.poisoned && !m.alarm && wantedStars === 0;
        if (m.quietExit)
          setStage(4, ROOF_HIT.away, 'WALK AWAY FROM THE HOTEL', 'vinny', 'Clean work. Walk away. Nobody saw a thing.');
        else setStage(4, ROOF_HIT.escape, 'LOSE THE POLICE · REACH CORAL PALMS MOTEL ON FOOT');
      }
      if (m.stage !== 4 || !grounded) return;
      if (m.quietExit) {
        m.instruction = wantedStars > 0 ? 'LOSE THE POLICE · THEN WALK AWAY' : 'WALK AWAY FROM THE HOTEL';
        if (wantedStars === 0 && distanceBetween(player, ROOFTOP.door) > ROOF_AWAY) winMission();
        return;
      }
      m.instruction =
        wantedStars > 0 ? 'LOSE THE POLICE · REACH CORAL PALMS MOTEL ON FOOT' : 'REACH CORAL PALMS MOTEL ON FOOT';
      if (
        !player.car &&
        distanceBetween(player, ROOF_HIT.escape) < 55 &&
        wantedStars === 0
      )
        winMission();
    }
    function updateRoofEncounter(deltaSeconds) {
      const m = rooftopJob();
      if (!m) return;
      const guards = enemies.filter((e) => e.missionTag === 'rooftop-hit' && e.hp > 0),
        // Everyone at the party (and the paramedics): guests are the party only.
        people = storyActors.filter((p) => p.missionTag === 'rooftop-hit' && p.hp > 0 && !p.hidden),
        guests = people.filter((p) => p.guest);
      for (const p of [m.boss, ...guards, ...people])
        if (p.speechFor > 0) {
          p.speechFor -= deltaSeconds;
          if (p.speechFor <= 0) p.speech = '';
        }
      trackRoofPace(m, deltaSeconds);
      for (const e of guards) {
        if (e.guard && !m.alarm) updateRoofGuard(m, e, deltaSeconds);
        else if (e.guard) e.sees = false;
        if (e.boss && !m.alarm && !m.poisoned) e.a = -Math.PI / 2 + Math.sin(gameTime * 0.22) * 0.45;
      }
      updateRoofSuspicion(m, deltaSeconds, guards);
      // A body with no alarm raised: a bodyguard who sees it, or a guest who stumbles on it.
      if (!m.alarm && m.killRegistered && !m.partyPanic) {
        m.bodyDelay -= deltaSeconds;
        if (
          m.bodyDelay <= 0 &&
          (guards.some((e) => e.guard && roofGuardSees(e, m.boss, 180)) ||
            (m.bodyDelay < -4 && guests.some((p) => distanceBetween(p, m.boss) < 45)))
        ) {
          m.partyPanic = true;
          const witness = guests.find((p) => distanceBetween(p, m.boss) < 100);
          if (witness) roofSay(witness, 'Call a doctor!', 3);
          if (!m.boss.poisoned && player.roof) roofAlarm(m);
        }
      }
      for (const e of guards) {
        if (!m.alarm || !player.roof || (e.boss && poisonCommitted(m))) {
          e.aiming = false;
          continue;
        }
        const seen = roofSight(e, player);
        e.a = headingBetween(e, player);
        e.look = 0;
        e.aiming = seen;
        e.timer -= deltaSeconds;
        if (!seen || distanceBetween(e, player) > 120) roofStep(e, player, deltaSeconds, 9 * KMH);
        // Only from on screen (combat-rules.js ON-SCREEN RULE).
        if (seen && e.timer <= 0 && shooterInView(e)) {
          // Handguns across a crowded terrace: steady, not a firing squad (five
          // of them at 17 hp every 0.8 s killed the player before the first step).
          e.timer = 0.95 + seededRandom() * 0.45;
          const a = e.a + randomBetween(-0.07, 0.07);
          bullets.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            altitude: e.altitude,
            vx: Math.cos(a) * 520,
            vy: Math.sin(a) * 520,
            life: 0.6,
            dmg: 14,
            enemy: true,
            faction: 'vescari',
            owner: e,
            target: player,
          });
          playSample('pistol', 0.3, 1, e);
          if (city3D) city3D.fire(e.x, e.y, a, false, e.altitude);
        }
      }
      updateRoofGuests(m, guests, deltaSeconds);
      updateRoofMedical(m, deltaSeconds);
    }
