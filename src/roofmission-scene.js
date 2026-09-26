    // Blue Hour scene: guests and guards (startRooftopHit), the alarm, the takedown, stage flow and the party's frame update.
    function roofSay(p, text, seconds = 2.5) {
      p.speech = text;
      p.speechFor = seconds;
    }
    function roofVoice(p) {
      if (
        soundOn &&
        voicesOn &&
        player.roof &&
        sameFloor(player, p) &&
        distanceBetween(player, p) < 650
      )
        playSample('civilian-scream-male-2', 0.8, 0.86, p);
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
        partyPanic: false,
      });
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
      const colors = [
        '#c9ae8c',
        '#718ca7',
        '#a86274',
        '#70a59a',
        '#dfd7b8',
        '#5e628b',
        '#b47c57',
        '#ada2bb',
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
      setStage(0, ROOF_HIT.outfit, 'COLLECT GUEST CLOTHES AT SUNSET MOTEL · E');
    }
    function roofAlarm(m) {
      if (m.alarm) return;
      m.alarm = true;
      m.suspicion = 100;
      m.weaponDrawn = true;
      m.partyPanic = true;
      crime(2);
      announce('THE BLUE HOUR · COVER BLOWN', 'GET OUT ALIVE', 2.5);
      tell('Bodyguards alerted. Break their line of sight and reach the elevator.', 4);
      for (const e of enemies)
        if (e.missionTag === 'rooftop-hit') {
          e.aiming = true;
          // Close protection details do not hesitate: weapons come up now.
          e.timer = 0.15 + seededRandom() * 0.15;
          e.roofRoute = null;
        }
      // Security downstairs is called the moment the party breaks.
      wantedStars = Math.max(2, wantedStars);
      // The car brings the lift back up; the way out is not simply standing open.
      m.liftRecalled = gameTime + 9;
    }
    function canSilentHit(m) {
      return (
        !!m &&
        player.roof &&
        m.disguise &&
        m.boss.hp > 0 &&
        !m.alarm &&
        !m.weaponDrawn &&
        !['sip', 'sick', 'collapse'].includes(m.poisonPhase) &&
        distanceBetween(player, m.boss) <= 36 &&
        roofSight(player, m.boss)
      );
    }
    function poisonWitness(m) {
      return enemies.find(
        (e) => e.guard && e.hp > 0 && e.missionTag === 'rooftop-hit' && roofSees(e, player, 90),
      );
    }
    function poisonDrink() {
      const m = rooftopJob();
      if (gameMode !== 'play' || !m || !player.roof) return false;
      if (m.boss.hp <= 0) {
        tell('Vescari is down. Reach the elevator.', 3);
        return true;
      }
      if (m.poisonUsed) {
        tell('The glass is prepared. Watch Vescari or slip away.', 3);
        return true;
      }
      if (distanceBetween(player, ROOF_HIT.drink) > 36 || !roofSight(player, ROOF_HIT.drink)) {
        tell(
          'Find Vescari’s reserved glass in the VIP lounge, northeast of the dance floor. Press P beside it.',
          4,
        );
        return true;
      }
      if (m.alarm || m.weaponDrawn || !m.disguise) {
        tell('Your cover is blown. Vescari will not touch the drink.', 3);
        return true;
      }
      if (poisonWitness(m)) {
        m.suspicion = Math.min(90, m.suspicion + 24);
        tell('A bodyguard is watching. Wait for him to turn away before touching the glass.', 3);
        return true;
      }
      m.poisonUsed = m.poisoned = true;
      m.poisonPhase = 'approach';
      m.poisonTimer = 0;
      m.phaseTime = 0;
      m.boss.roofRoute = null;
      roofSay(m.boss, "I'll get a drink", 3);
      setStage(2, m.boss, 'GLASS PREPARED · KEEP YOUR COVER OR SLIP AWAY');
      tell('Vescari is heading to his glass. Stay calm; the elevator remains open.', 5);
      return true;
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
          'Vescari is meeting the dock buyers in the VIP lounge. Walk calmly, watch the patrols, and prepare his reserved glass with P when no guard is looking. E nearby is a quiet takedown.',
          9,
        );
        return true;
      }
      if (canSilentHit(missionState)) {
        missionState.boss.hp = 0;
        missionState.boss.deadTime = gameTime;
        missionState.bodyDelay = 12;
        missionState.boss.speech = '';
        missionState.boss.drinking = false;
        bleed(missionState.boss, 1.5, player.a);
        updateRooftopHit(missionState, 0);
        tell('Vescari is down. Leave before the bodyguards find him.', 4);
        return true;
      }
      return false;
    }
    function updateRooftopHit(m, deltaSeconds) {
      const b = m.boss;
      if (m.poisoned && b.hp > 0) {
        m.phaseTime += deltaSeconds;
        m.poisonTimer += deltaSeconds;
        if (m.poisonPhase === 'approach') {
          if (m.alarm) {
            m.poisoned = false;
            m.poisonPhase = 'aborted';
            b.speech = '';
            tell('Vescari abandoned his drink. Stop him and reach the elevator.', 4);
          } else {
            roofStep(b, ROOF_HIT.seat, deltaSeconds, 4.5 * KMH);
            if (distanceBetween(b, ROOF_HIT.seat) < 3 && m.phaseTime >= 2.4) {
              m.poisonPhase = 'sip';
              m.phaseTime = 0;
              b.a = Math.PI;
              b.drinking = true;
              b.walking = false;
            }
          }
        } else if (m.poisonPhase === 'sip' && m.phaseTime >= 1.6) {
          m.poisonPhase = 'sick';
          m.phaseTime = 0;
          b.drinking = false;
          b.illness = 0;
          roofSay(b, 'This tastes strange...', 2.8);
        } else if (m.poisonPhase === 'sick') {
          b.illness = Math.min(1, m.phaseTime / 2.8);
          if (m.phaseTime >= 2.8) {
            m.poisonPhase = 'collapse';
            m.phaseTime = 0;
            b.speech = '';
            b.poisonCollapse = 0;
            if (!m.deathVoicePlayed) {
              m.deathVoicePlayed = true;
              roofVoice(b);
            }
          }
        } else if (m.poisonPhase === 'collapse') {
          b.poisonCollapse = Math.min(1, m.phaseTime / 1.25);
          if (m.phaseTime >= 1.25) {
            b.hp = 0;
            b.deadTime = gameTime;
            b.poisoned = true;
            b.poisonCollapse = 1;
            m.poisonPhase = 'dead';
            m.bodyDelay = 1.4;
            tell('Vescari is down. Blend into the crowd and leave through the elevator.', 5);
          }
        }
      }
      if (m.stage === 1 && player.roof)
        setStage(2, b, 'VIP LOUNGE · P AT THE RESERVED GLASS WHEN GUARDS LOOK AWAY');
      if (b.hp <= 0 && !m.killRegistered) {
        m.killRegistered = true;
        b.drinking = false;
        b.speech = '';
        m.bodyDelay = Math.max(m.bodyDelay, 1);
        setStage(
          3,
          {
            ...ROOFTOP.lift,
            altitude: ROOFTOP.height + 3,
          },
          'VESCARI IS DOWN · ESCAPE VIA THE ELEVATOR',
        );
      }
      if (
        m.stage === 3 &&
        !player.roof &&
        !player.parachute &&
        gameMode === 'play' &&
        Math.abs(entityElevation(player) - terrainHeight(player.x, player.y)) < 3
      )
        setStage(4, ROOF_HIT.escape, 'LOSE THE POLICE · REACH CORAL PALMS MOTEL ON FOOT');
      if (
        m.stage === 4 &&
        !player.roof &&
        !player.parachute &&
        !player.car &&
        Math.abs(entityElevation(player) - terrainHeight(player.x, player.y)) < 3 &&
        distanceBetween(player, ROOF_HIT.escape) < 55 &&
        wantedStars === 0
      )
        winMission();
    }
    function updateRoofEncounter(deltaSeconds) {
      const m = rooftopJob();
      if (!m) return;
      const guards = enemies.filter((e) => e.missionTag === 'rooftop-hit' && e.hp > 0),
        guests = storyActors.filter((p) => p.missionTag === 'rooftop-hit' && p.hp > 0 && !p.hidden);
      for (const p of [m.boss, ...guests])
        if (p.speechFor > 0) {
          p.speechFor -= deltaSeconds;
          if (p.speechFor <= 0) p.speech = '';
        }
      let suspicious = false;
      for (const e of guards) {
        e.walking = false;
        if (e.guard && !m.alarm) {
          if (m.partyPanic) {
            const goal = roofAt(
              ROOF_HIT.seat.x - ROOFTOP.x + (e.patrol - 1) * 23,
              ROOF_HIT.seat.y - ROOFTOP.y + 31,
            );
            if (distanceBetween(e, goal) > 4) roofStep(e, goal, deltaSeconds, 5 * KMH);
            else e.a = headingBetween(e, m.boss);
          } else if (e.patrolWait > 0) {
            e.patrolWait -= deltaSeconds;
            e.a += Math.sin(gameTime * 0.65 + e.patrol) * deltaSeconds * 0.45;
          } else {
            const goal = e.patrolRoute[e.patrolIndex];
            roofStep(e, goal, deltaSeconds, 4 * KMH);
            if (distanceBetween(e, goal) < 3) {
              e.patrolIndex = (e.patrolIndex + 1) % e.patrolRoute.length;
              e.patrolWait = 3 + e.patrol;
              e.roofRoute = null;
            }
          }
          if (player.roof && roofSees(e, player, 132)) {
            // Crowding the detail or lingering inside the cordon reads wrong (the
            // terrace is always walked, game.js footPace, so nobody runs here).
            const d = distanceBetween(e, player);
            if (d < 34 || m.partyPanic) suspicious = true;
            else if (d < 96) e.lingering = (e.lingering || 0) + deltaSeconds;
            if ((e.lingering || 0) > 1.6) suspicious = true;
          } else e.lingering = Math.max(0, (e.lingering || 0) - deltaSeconds * 1.6);
        }
        if (e.boss && !m.alarm && !m.poisoned) e.a = -Math.PI / 2 + Math.sin(gameTime * 0.22) * 0.45;
      }
      if (!m.alarm) {
        m.suspicion = clamp(m.suspicion + (suspicious ? 64 : -11) * deltaSeconds, 0, 100);
        if (player.roof && (m.weaponDrawn || m.suspicion >= 100)) roofAlarm(m);
        if (m.killRegistered && !m.partyPanic) {
          m.bodyDelay -= deltaSeconds;
          if (
            m.bodyDelay <= 0 &&
            guards.some((e) => roofSight(e, m.boss) && distanceBetween(e, m.boss) < 180)
          ) {
            m.partyPanic = true;
            const witness = guests.find((p) => distanceBetween(p, m.boss) < 100);
            if (witness) roofSay(witness, 'Call a doctor!', 3);
            if (!m.boss.poisoned && player.roof) roofAlarm(m);
          }
        }
      }
      for (const e of guards) {
        if (!m.alarm || !player.roof || (e.boss && m.poisonPhase && m.poisonPhase !== 'aborted')) {
          e.aiming = false;
          continue;
        }
        const seen = roofSight(e, player);
        e.a = headingBetween(e, player);
        e.aiming = seen;
        e.timer -= deltaSeconds;
        if (!seen || distanceBetween(e, player) > 120) roofStep(e, player, deltaSeconds, 9 * KMH);
        if (seen && e.timer <= 0) {
          e.timer = 0.72 + seededRandom() * 0.34;
          const a = e.a + randomBetween(-0.038, 0.038);
          bullets.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            altitude: e.altitude,
            vx: Math.cos(a) * 520,
            vy: Math.sin(a) * 520,
            life: 0.6,
            dmg: 17,
            enemy: true,
            faction: 'vescari',
            owner: e,
            target: player,
          });
          playSample('pistol', 0.3, 1, e);
          if (city3D) city3D.fire(e.x, e.y, a, false, e.altitude);
        }
      }
      for (const p of guests) {
        p.walking = false;
        p.dancing = false;
        if (m.partyPanic) {
          p.reactionTime = (p.reactionTime || 0) + deltaSeconds;
          if (!p.panicSaid) {
            if (player.roof && distanceBetween(p, player) < 220 && p.phase % 9 === 0) scream(p);
            p.panicSaid = true;
          }
          if (p.reactionTime < 1.4 + (p.phase % 3) * 0.3) {
            p.a = headingBetween(p, m.boss);
            p.recoiling = true;
          } else {
            p.recoiling = false;
            roofStep(p, roofAt(71, 303), deltaSeconds, (m.alarm ? 12 : 6) * KMH);
            if (distanceBetween(p, roofAt(71, 303)) < 9) p.hidden = true;
          }
        } else if (p.role === 'dance') {
          p.dancing = true;
          p.a = Math.sin(gameTime * 0.35 + p.phase);
        } else {
          p.idleWait -= deltaSeconds;
          if (p.idleWait <= 0) {
            if (!p.idleTarget) {
              const a = p.phase * 2.4 + gameTime * 0.1,
                c = {
                  x: p.home.x + Math.cos(a) * 12,
                  y: p.home.y + Math.sin(a) * 12,
                };
              p.idleTarget = roofPointFree(c.x, c.y, 8) ? c : p.home;
            }
            roofStep(p, p.idleTarget, deltaSeconds, (p.staff ? 4 : 3) * KMH);
            if (distanceBetween(p, p.idleTarget) < 3) {
              p.idleWait = 3 + (p.phase % 5);
              p.idleTarget = null;
              p.roofRoute = null;
            }
          } else p.a = Math.sin(gameTime * 0.17 + p.phase) * 2;
        }
      }
    }
