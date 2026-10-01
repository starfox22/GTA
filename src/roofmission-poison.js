    // Blue Hour poison: the reserved glass (P), Vescari's toast, cough and faint, the party's reaction, the call and the ambulance.
    /* THE POISONED GLASS
       P at the reserved glass while no bodyguard sees the player prepares it.
       Vescari walks over (`approach`, abandoned if the alarm goes up first), then
       plays out a sequence read from the camera, one beat at a time
       (POISON_BEATS; the pose for each is crowd3d-roofparty.js): he reaches for
       the glass, raises it in a toast, sips, lowers it, a beat later coughs,
       clutches his throat as the glass slips and shatters, staggers back, his
       knees buckle and he faints to the floor. It is poison: no blood anywhere
       (`poisoned` bodies skip every blood path, wounds.js). The guests gasp and
       back off, one kneels beside him, another shouts for an ambulance and
       phones it in, a bodyguard radios the lobby. Some twenty seconds later an
       ambulance comes up the avenue with its siren and stops below the hotel;
       two paramedics go in, and later come up on the lift to him. The player
       only has to walk out: the lift, then away from the hotel. */
    const POISON_BEATS = {
        reach: 0.9,
        toast: 1.2,
        sip: 1.5,
        lower: 0.8,
        beat: 1.9,
        cough: 2.2,
        clutch: 1.9,
        stagger: 1.7,
        buckle: 1.0,
        faint: 1.3,
      },
      POISON_ORDER = ['reach', 'toast', 'sip', 'lower', 'beat', 'cough', 'clutch', 'stagger', 'buckle', 'faint'],
      // The ambulance: up the avenue from Little Havana, left onto the boulevard,
      // stopping in the kerb lane below the hotel doors (ROOFTOP.door).
      ROOF_AMBULANCE = {
        start: { x: -1392, y: 3140, a: -Math.PI / 2 },
        // countyRouteControl moves on 65 units short of each point, so the corner
        // is laid out in short steps round the junction's south-east quarter.
        route: [
          { x: -1392, y: 2900 },
          { x: -1392, y: 2790 },
          { x: -1400, y: 2718 },
          { x: -1430, y: 2672 },
          { x: -1500, y: 2662 },
          { x: -1600, y: 2661 },
          // Past the stop, so the heading holds while it brakes (updateRoofAmbulance).
          { x: -2100, y: 2661 },
        ],
        stop: { x: -1618, y: 2661 },
      };
    /* Glass prepared and past the point of no return: he has it in his hand. */
    function poisonCommitted(m) {
      return !!m?.poisoned && POISON_ORDER.includes(m.poisonPhase);
    }
    function poisonDrink() {
      const m = rooftopJob();
      if (gameMode !== 'play' || !m || !player.roof) return false;
      if (m.boss.hp <= 0) {
        tell('Vescari is down. Reach the elevator.', 3);
        return true;
      }
      if (m.poisonUsed) {
        tell('The glass is prepared. Watch Vescari, or slip away.', 3);
        return true;
      }
      if (distanceBetween(player, ROOF_HIT.drink) > 36 || !roofSight(player, ROOF_HIT.drink)) {
        tell(
          'Vescari’s reserved glass is on the VIP table, northeast of the dance floor. ' +
            pressKey('poison', true) +
            ' beside it.',
          4,
        );
        return true;
      }
      if (m.alarm || m.weaponDrawn || !m.disguise) {
        tell('Your cover is blown. Vescari will not touch the drink.', 3);
        return true;
      }
      const witness = poisonWitness(m);
      if (witness) {
        m.suspicion = Math.min(90, m.suspicion + 24);
        guardLine(witness, 'glass', 'Hey. That’s Mr. Vescari’s glass.', 6);
        tell('A bodyguard is watching. Wait until he looks away before you touch the glass.', 3);
        return true;
      }
      m.poisonUsed = m.poisoned = true;
      m.poisonPhase = 'approach';
      m.phaseTime = 0;
      m.boss.roofRoute = null;
      roofSay(m.boss, 'Excuse me, gentlemen. My drink.', 3);
      setStage(2, m.boss, 'GLASS PREPARED · KEEP YOUR COVER');
      tell('Vescari is heading for his glass. Walk away from the table and watch.', 5);
      return true;
    }
    function nextPoisonBeat(m, phase) {
      m.poisonPhase = phase;
      m.phaseTime = 0;
      m.beatEvents = 0;
    }
    /* Once per beat: `n` is a bit for each event so each fires one time. */
    function poisonEvent(m, n) {
      if (m.beatEvents & (1 << n)) return false;
      m.beatEvents |= 1 << n;
      return true;
    }
    /* The drink, beat by beat (called from updateRooftopHit). */
    function updatePoisonDrink(m, deltaSeconds) {
      const b = m.boss;
      if (!m.poisoned || b.hp <= 0) return;
      m.phaseTime += deltaSeconds;
      if (m.poisonPhase === 'approach') {
        if (m.alarm) {
          m.poisoned = false;
          m.poisonPhase = 'aborted';
          b.speech = '';
          tell('Vescari left his drink. Stop him and reach the elevator.', 4);
          return;
        }
        if (distanceBetween(b, ROOF_HIT.seat) > 3 && !b.atTable) roofStep(b, ROOF_HIT.seat, deltaSeconds, 4.5 * KMH);
        else {
          // The last step up to the table edge, inside the walking margin round it.
          b.atTable = true;
          const d = distanceBetween(b, ROOF_HIT.sip),
            step = Math.min(d, 4.5 * KMH * deltaSeconds);
          if (d > 0.5) {
            const a = headingBetween(b, ROOF_HIT.sip);
            b.x += Math.cos(a) * step;
            b.y += Math.sin(a) * step;
            b.walking = true;
          }
          b.a = turnToward(b.a, headingBetween(b, ROOF_HIT.drink), deltaSeconds * 4);
          if (d <= 0.5 && m.phaseTime >= 2) nextPoisonBeat(m, 'reach');
        }
        return;
      }
      const phase = m.poisonPhase,
        length = POISON_BEATS[phase];
      if (!length) return;
      const k = clamp(m.phaseTime / length, 0, 1);
      b.poisonPose = phase;
      b.poisonT = k;
      b.walking = false;
      if (phase === 'reach') {
        b.a = turnToward(b.a, headingBetween(b, ROOF_HIT.drink), deltaSeconds * 4);
        // The hand closes on it past halfway: the table's glass is gone, his is in hand.
        if (k > 0.55 && poisonEvent(m, 0)) {
          m.glassTaken = true;
          b.drinking = true;
        }
      } else if (phase === 'toast') {
        if (poisonEvent(m, 0)) roofSay(b, 'To the new harbor. Salute!', 2.4);
      } else if (phase === 'beat') {
        // Turning back to the buyers, the glass at his chest.
        b.a = turnToward(b.a, 0.4, deltaSeconds * 1.2);
        if (k > 0.35 && poisonEvent(m, 0)) roofSay(b, 'Smooth. Very smooth.', 1.6);
      } else if (phase === 'cough') {
        if (poisonEvent(m, 0)) roofSay(b, '*cough* ...Excuse me.', 2);
        for (const [i, at] of [0.05, 0.38, 0.62, 0.85].entries())
          if (k >= at && poisonEvent(m, i + 1)) roofCough(b, i);
      } else if (phase === 'clutch') {
        if (poisonEvent(m, 0)) {
          roofSay(b, 'I can’t... breathe...', 2.2);
          roofCough(b, 4);
          // The nearest guests notice first.
          for (const p of roofGuests())
            if (!p.staff && distanceBetween(p, b) < 90 && !p.roofReact) {
              p.roofReact = 'notice';
              p.reactAt = gameTime + distanceBetween(p, b) / 120;
            }
          const near = roofGuests().find((p) => distanceBetween(p, b) < 70);
          if (near) roofSay(near, 'Luciano? Are you all right?', 2.2);
        }
        if (k > 0.3 && poisonEvent(m, 1)) {
          b.drinking = false;
          roofGlassShatter(b);
        }
      } else if (phase === 'stagger') {
        // Two unsteady steps back from the table, weaving.
        const back = headingBetween(ROOF_HIT.drink, b) + Math.sin(m.phaseTime * 5) * 0.5,
          step = 5.5 * KMH * deltaSeconds * (1 - k * 0.6),
          x = b.x + Math.cos(back) * step,
          y = b.y + Math.sin(back) * step;
        if (roofPointFree(x, y, 5)) {
          b.x = x;
          b.y = y;
          b.walking = true;
        }
      } else if (phase === 'buckle') {
        if (poisonEvent(m, 0)) startMedicalScene(m);
      } else if (phase === 'faint') {
        // Crumpling: slow to start, then all at once.
        b.poisonCollapse = k * k * (3 - 2 * k);
      }
      if (k < 1) return;
      const next = POISON_ORDER[POISON_ORDER.indexOf(phase) + 1];
      if (next) {
        nextPoisonBeat(m, next);
        return;
      }
      // Down. Poison: no blood, no death fall of his own (wounds.js `poisoned`).
      b.hp = 0;
      b.poisoned = true;
      b.poisonCollapse = 1;
      b.deadTime = gameTime;
      b.deathStyle = { sign: 1, turn: 0, slump: false, poison: true };
      b.speech = '';
      m.poisonPhase = 'dead';
      m.bodyDelay = 0;
    }
    function roofGuests() {
      return storyActors.filter((p) => p.missionTag === 'rooftop-hit' && p.guest && p.hp > 0 && !p.hidden);
    }
    /* A small glass breaking on the terrace floor: shards and a light tinkle. */
    function roofGlassShatter(b) {
      const x = b.x + Math.cos(b.a) * 5,
        y = b.y + Math.sin(b.a) * 5;
      if (city3D) city3D.impact(x, y, 'glass', entityElevation(b) - 3);
      if (player.roof && distanceBetween(player, b) < 500)
        playSample('crash-glass-2', 0.2, 1.9, { x, y, elevation: entityElevation(b) });
    }
    /* A dry cough, synthesised: two or three bursts of throaty noise. */
    function roofCough(p, n) {
      if (!audio || !soundOn || !voicesOn || !voiceBus || !player.roof) return;
      const d = distanceBetween(player, p);
      if (d > 520) return;
      const level = 0.16 / (1 + d / 120),
        now = audio.currentTime,
        bursts = n % 2 ? 2 : 3,
        length = Math.floor(audio.sampleRate * 0.5),
        buffer = audio.createBuffer(1, length, audio.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      for (let i = 0; i < bursts; i++) {
        const s = audio.createBufferSource(),
          f = audio.createBiquadFilter(),
          g = audio.createGain(),
          pan = audio.createStereoPanner(),
          at = now + i * (0.19 + (n % 3) * 0.02),
          dur = 0.13 + (i === 0 ? 0.04 : 0);
        s.buffer = buffer;
        f.type = 'bandpass';
        f.frequency.value = 520 + i * 90 + (n % 2) * 60;
        f.Q.value = 1.4;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(level * (i ? 0.7 : 1), at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        pan.pan.value = clamp((p.x - player.x) / 450, -0.9, 0.9);
        s.connect(f).connect(g).connect(pan).connect(voiceBus);
        s.start(at, Math.random() * 0.3, dur + 0.05);
        s.onended = () => {
          s.disconnect();
          f.disconnect();
          g.disconnect();
          pan.disconnect();
        };
      }
    }
    /* Vescari's knees give way in front of everyone: who does what. */
    function startMedicalScene(m) {
      if (m.medical) return;
      const b = m.boss,
        guests = roofGuests()
          .filter((p) => !p.staff)
          .sort((p, q) => distanceBetween(p, b) - distanceBetween(q, b)),
        guards = enemies.filter((e) => e.guard && e.hp > 0 && e.missionTag === 'rooftop-hit');
      m.medical = {
        at: gameTime,
        helper: guests[0] || null,
        caller: guests[1] || null,
        radio: guards.sort((e, f) => distanceBetween(e, b) - distanceBetween(f, b))[0] || null,
        called: 0,
        ambulance: null,
        medics: [],
      };
      m.partyPanic = true;
      for (const p of roofGuests()) {
        const d = distanceBetween(p, b);
        p.roofReact =
          p === m.medical.helper ? 'help' : p === m.medical.caller ? 'call' : d < 150 && !p.staff ? 'look' : 'turn';
        p.reactAt = gameTime + Math.min(1.4, d / 160) + (p.phase % 3) * 0.15;
        p.idleTarget = null;
        p.roofRoute = null;
      }
      if (m.medical.helper) scream(m.medical.helper);
      for (const e of guards) {
        e.investigate = null;
        e.roofRoute = null;
      }
    }
    /* The party, frame by frame: dancing and chatting, the evacuation when the
       shooting starts, or the medical emergency round Vescari. */
    function updateRoofGuests(m, guests, deltaSeconds) {
      for (const p of guests) {
        p.walking = false;
        p.dancing = false;
        if (m.alarm || (m.partyPanic && !m.medical)) {
          p.pose = null;
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
        } else if (m.medical || p.roofReact) updateGuestReaction(m, p, deltaSeconds);
        else if (p.role === 'dance') {
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
    /* One guest's part in the emergency (roles from startMedicalScene). */
    function updateGuestReaction(m, p, deltaSeconds) {
      const b = m.boss,
        t = gameTime - (p.reactAt ?? gameTime),
        toward = headingBetween(p, b),
        medicsHere = m.medical?.medics.some((q) => q.onRoof && distanceBetween(q, b) < 30);
      if (t < 0) return;
      let role = p.roofReact;
      if (role === 'help' && medicsHere) role = p.roofReact = 'look';
      if (role === 'notice') {
        // He is choking: they turn and stare.
        p.a = turnToward(p.a, toward, deltaSeconds * 5);
        p.pose = t < 1.2 ? 'startle' : 'gasp';
        return;
      }
      if (role === 'help') {
        // Kneeling at his side, on the side she came from if the cover allows.
        if (!p.helpSpot) p.helpSpot = roofSpotNear(b, 9, toward + Math.PI, 3) || { x: p.x, y: p.y };
        if (distanceBetween(p, p.helpSpot) > 2 && t < 12) {
          p.pose = null;
          // The last steps are inside the cover margin round him: straight in.
          const d = distanceBetween(p, p.helpSpot);
          if (d < 20) {
            const a = headingBetween(p, p.helpSpot),
              step = Math.min(d, 7 * KMH * deltaSeconds);
            p.x += Math.cos(a) * step;
            p.y += Math.sin(a) * step;
            p.a = a;
            p.walking = true;
          } else roofStep(p, p.helpSpot, deltaSeconds, 7 * KMH);
          return;
        }
        p.a = turnToward(p.a, headingBetween(p, b), deltaSeconds * 4);
        p.pose = 'help';
        if (!p.helpSaid) {
          p.helpSaid = gameTime;
          roofSay(p, 'Sir? Sir! Can you hear me?', 3);
        } else if (gameTime - p.helpSaid > 7 && !p.helpSaid2) {
          p.helpSaid2 = true;
          roofSay(p, 'Stay with me! Help is coming!', 3);
        }
        return;
      }
      if (role === 'call') {
        p.a = turnToward(p.a, toward, deltaSeconds * 5);
        if (t < 0.6) p.pose = 'startle';
        else if (t < 3.2) {
          p.pose = 'shout';
          if (!p.callSaid) {
            p.callSaid = true;
            roofSay(p, 'Somebody call an ambulance!', 2.6);
          }
        } else if (t < 16) {
          p.pose = 'phone';
          if (m.medical && !m.medical.called) {
            m.medical.called = gameTime;
            roofSay(p, 'Ambulance, please! The Blue Hour, the roof. A man collapsed!', 3.8);
          }
        } else p.pose = 'watch';
        return;
      }
      // Onlookers: a start, a gasp, then back away and watch.
      if (role === 'look') {
        if (t < 0.5) {
          p.pose = 'startle';
          p.a = turnToward(p.a, toward, deltaSeconds * 6);
          return;
        }
        if (t < 2.4) {
          p.pose = 'gasp';
          return;
        }
        const d = distanceBetween(p, b);
        if (d < 40 && !p.backedOff) {
          if (p.ringSpot === undefined) p.ringSpot = roofSpotNear(b, 44, headingBetween(b, p), 6);
          if (p.ringSpot && distanceBetween(p, p.ringSpot) > 3 && t < 10) {
            p.pose = null;
            roofStep(p, p.ringSpot, deltaSeconds, 3.5 * KMH);
            return;
          }
          p.backedOff = true;
        }
        p.a = turnToward(p.a, toward, deltaSeconds * 3);
        p.pose = p.phase % 3 ? 'watch' : 'despair';
        return;
      }
      // Further off: the music stops mattering; they turn and look.
      p.a = turnToward(p.a, toward, deltaSeconds * 2);
      p.pose = t < 1.5 ? 'startle' : p.staff ? null : 'watch';
    }
    /* The call, the ambulance and the paramedics. */
    function updateRoofMedical(m, deltaSeconds) {
      const med = m.medical;
      if (!med) return;
      const radio = med.radio;
      if (radio && radio.hp > 0 && !m.alarm) {
        const at = !!radio.atScene;
        radio.pose = at && gameTime - med.at < 9 ? 'phone' : null;
        if (at && !med.radioed) {
          med.radioed = true;
          roofSay(radio, 'Lobby! Mr. Vescari is down. Get a medic up here, now!', 3.4);
        }
      } else if (radio) radio.pose = null;
      if (med.called && !med.ambulance && gameTime - med.called > 7) spawnRoofAmbulance(m);
      updateRoofAmbulance(m);
      updateRoofMedics(m, deltaSeconds);
    }
    // How the last run's ambulance was settled when the job ended (settleRoofAmbulance).
    let roofAmbulanceSettled = null;
    function spawnRoofAmbulance(m) {
      const s = ROOF_AMBULANCE.start,
        c = makeCar('ambulance', s.x, s.y, s.a, true);
      c.mission = true;
      c.missionAmbulance = true;
      c.occupied = true;
      c.locked = true;
      c.countyRoute = ROOF_AMBULANCE.route.map((p) => ({ ...p }));
      c.countyIndex = 0;
      // makeCar has put it in `vehicles` (a second push stepped it twice a frame).
      m.medical.ambulance = c;
      m.medical.ambulanceAt = gameTime;
      roofAmbulanceSettled = null;
    }
    /* The job ended (won, failed or restarted: cleanupMissionExtras) with the
       ambulance still on its way. Nothing brakes it to the stop any more and its
       county route loops, so it circled back through Little Havana for good, or
       sat with its engine running behind whatever held it up. It pulls up at the
       stop now when nobody is looking and the stop is free, else where it is,
       and stays parked like one that arrived. */
    function settleRoofAmbulance(m) {
      const med = m?.medical,
        c = med?.ambulance;
      if (!c || med.parked || c.hp <= 0 || c === player.car || !vehicles.includes(c)) return;
      const stop = ROOF_AMBULANCE.stop,
        seen = crowdInView(c.x, c.y, 80) || crowdInView(stop.x, stop.y, 80),
        free = !seen && canSpawnCar('ambulance', stop.x, stop.y, Math.PI);
      if (free) Object.assign(c, { x: stop.x, y: stop.y, a: Math.PI });
      // Why it stands where it does (roofPoison().medical.settled; the stop's
      // holder is gone again by the time anyone can look).
      let by = null;
      if (!seen && !free)
        for (const o of vehicles)
          if (o !== c && distanceBetween(o, stop) < 80 && (!by || distanceBetween(o, stop) < distanceBetween(by, stop))) by = o;
      med.settled = roofAmbulanceSettled = free
        ? { at: 'stop' }
        : { at: 'where it was', why: seen ? 'in view' : 'stop taken', by: by && { id: by.id, type: by.type, x: Math.round(by.x), y: Math.round(by.y) } };
      c.ai = false;
      c.countyRoute = null;
      c.vx = c.vy = c.av = c.speed = 0;
      c.braking = true;
      med.parked = gameTime;
    }
    /* Siren on the way, then a firm stop in the kerb lane below the doors. */
    function updateRoofAmbulance(m) {
      const med = m.medical,
        c = med.ambulance;
      if (!c || med.parked || c.hp <= 0 || !vehicles.includes(c)) return;
      if (gameTime >= (med.sirenAt || 0)) {
        med.sirenAt = gameTime + 5.8;
        playSample('siren', 0.5, 1, { x: c.x, y: c.y, elevation: entityElevation(c) }, sirenBus);
      }
      const stop = ROOF_AMBULANCE.stop,
        onBoulevard = c.y < 2700 && c.x < -1440;
      // Westbound: what is left to the stop, measured along the lane.
      let left = onBoulevard ? c.x - stop.x : Infinity;
      if (onBoulevard) {
        const limit = Math.sqrt(2 * 34 * Math.max(0, left - 2)),
          v = Math.hypot(c.vx || 0, c.vy || 0);
        if (v > limit && v > 0.01) {
          c.vx *= limit / v;
          c.vy *= limit / v;
          c.speed = Math.sign(c.speed || 1) * Math.min(Math.abs(c.speed || 0), limit);
        }
      }
      // Held up (traffic, a car across the lane) for long: it is simply there.
      const speed = Math.hypot(c.vx || 0, c.vy || 0);
      med.stuckFor = speed < 3 && left > 30 ? (med.stuckFor || 0) + (gameTime - (med.checkedAt ?? gameTime)) : 0;
      med.checkedAt = gameTime;
      if ((med.stuckFor > 6 || gameTime - med.ambulanceAt > 45) && canSpawnCar('ambulance', stop.x, stop.y, Math.PI)) {
        Object.assign(c, { x: stop.x, y: stop.y, a: Math.PI });
        left = 0;
      }
      if (left < 3 || (left < 30 && speed < 4) || gameTime - med.ambulanceAt > 50) {
        c.ai = false;
        c.countyRoute = null;
        c.vx = c.vy = c.av = c.speed = 0;
        c.braking = true;
        med.parked = gameTime;
        // Two paramedics out of the back, into the lobby (the kerb is on its right).
        const kerb = c.a + Math.PI / 2;
        med.medics = [0, 1].map((i) => {
          const p = {
            ...actor(
              'PARAMEDIC',
              c.x + Math.cos(c.a) * (-14 - i * 9) + Math.cos(kerb) * 16,
              c.y + Math.sin(c.a) * (-14 - i * 9) + Math.sin(kerb) * 16,
              i ? '#eef1ed' : '#e9ecef',
            ),
            missionTag: 'rooftop-hit',
            medic: true,
            carry: i ? null : 'briefcase',
            walk: 0,
          };
          p.altitude = undefined;
          storyActors.push(p);
          return p;
        });
      }
    }
    /* The paramedics walk into the lobby; a little later they step out of the
       lift on the terrace and go to him (one kneels, one talks to the guests). */
    function updateRoofMedics(m, deltaSeconds) {
      const med = m.medical;
      for (const [i, p] of med.medics.entries()) {
        if (p.hp <= 0) continue;
        p.walking = false;
        if (!p.onRoof) {
          if (p.hidden) continue;
          const door = ROOFTOP.door;
          if (distanceBetween(p, door) > 7) {
            p.a = headingBetween(p, door);
            // Kerb to doors: open pavement all the way.
            const step = Math.min(distanceBetween(p, door), 6.5 * KMH * deltaSeconds);
            p.x += Math.cos(p.a) * step;
            p.y += Math.sin(p.a) * step;
            p.walking = true;
          } else {
            p.hidden = true;
            med.inside = med.inside || gameTime;
          }
          continue;
        }
        const b = m.boss;
        if (!p.sceneSpot) p.sceneSpot = roofSpotNear(b, i ? 16 : 8, i ? 1.2 : 2.6, 3) || { x: p.x, y: p.y };
        const spot = p.sceneSpot;
        if (distanceBetween(p, spot) > 3) {
          p.pose = null;
          if (distanceBetween(p, spot) < 22) {
            const a = headingBetween(p, spot),
              step = Math.min(distanceBetween(p, spot), 6 * KMH * deltaSeconds);
            p.x += Math.cos(a) * step;
            p.y += Math.sin(a) * step;
            p.a = a;
            p.walking = true;
          } else roofStep(p, spot, deltaSeconds, 6 * KMH);
        } else {
          p.a = headingBetween(p, b);
          p.pose = i ? 'phone' : 'help';
          if (!p.said) {
            p.said = true;
            roofSay(p, i ? 'Everybody back, please. Give us room.' : 'Sir, can you hear me? No pulse... starting CPR.', 3.2);
          }
        }
      }
      // Up the lift a few seconds after going in.
      if (med.inside && !med.medicsUp && gameTime - med.inside > 7) {
        med.medicsUp = true;
        const z = ROOFTOP.height + 3;
        for (const [i, p] of med.medics.entries()) {
          Object.assign(p, roofAt(71 + i * 10, 303 - i * 4), {
            altitude: z,
            hidden: false,
            onRoof: true,
            roofRoute: null,
            a: -Math.PI / 2,
          });
        }
      }
    }
    /* True while the job is only watching: the glass is spiked, the alarm is quiet and
       Vescari is still on his feet. Nothing points at him then (render3d-frame.js hides
       the floating arrow); the HUD's distance pill and the map are unchanged. */
    function roofWatchQuiet() {
      const m = rooftopJob();
      return !!m && m.poisonUsed && !m.alarm && !m.killRegistered && m.boss.hp > 0;
    }
    /* Console (game-console-missions.js): how the drink and its aftermath stand. */
    function roofPoisonReport() {
      const m = rooftopJob(),
        b = m?.boss,
        med = m?.medical;
      // After the job: only how its ambulance was left.
      if (!m) return roofAmbulanceSettled && { ended: true, medical: { settled: roofAmbulanceSettled } };
      return {
        phase: m.poisonPhase,
        beatT: Math.round((b.poisonT || 0) * 100) / 100,
        glassTaken: !!m.glassTaken,
        inHand: !!b.drinking,
        bossHp: Math.round(b.hp),
        poisoned: !!b.poisoned,
        collapse: Math.round((b.poisonCollapse || 0) * 100) / 100,
        deathStyle: b.deathStyle || null,
        bloodNearBoss: bloodPools.filter((p) => Math.hypot(p.x - b.x, p.y - b.y) < 60).length,
        bloodDropsNearBoss: particles.filter((p) => p.blood && Math.hypot(p.x - b.x, p.y - b.y) < 80).length,
        medical: med
          ? {
              since: Math.round((gameTime - med.at) * 10) / 10,
              helper: med.helper ? { pose: med.helper.pose || null, near: Math.round(distanceBetween(med.helper, b)) } : null,
              caller: med.caller ? { pose: med.caller.pose || null } : null,
              called: !!med.called,
              radioed: !!med.radioed,
              ambulance: med.ambulance
                ? {
                    id: med.ambulance.id,
                    x: Math.round(med.ambulance.x),
                    y: Math.round(med.ambulance.y),
                    speed: Math.round(speedKmh(Math.hypot(med.ambulance.vx || 0, med.ambulance.vy || 0))),
                    parked: !!med.parked,
                    toDoor: Math.round(distanceBetween(med.ambulance, ROOFTOP.door)),
                  }
                : null,
              settled: med.settled || null,
              medics: med.medics.map((p) => ({ onRoof: !!p.onRoof, hidden: !!p.hidden, pose: p.pose || null })),
            }
          : null,
        reactions: roofGuests().reduce((acc, p) => {
          const k = p.pose || (p.dancing ? 'dance' : 'idle');
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      };
    }
