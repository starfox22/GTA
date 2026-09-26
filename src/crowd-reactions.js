    // Crowd reactions per frame (updateReaction), pose galleries and lineups, updateCrowdPerson(), dogs and witness reports.
    function updateReaction(p, deltaSeconds) {
      const r = p.react;
      r.t += deltaSeconds;
      p.flee = Math.max(0.5, r.dur - r.t + 0.5);
      p.sitting = false;
      p.walking = false;
      const from = r.from || p.threat || player;
      switch (r.kind) {
        case 'startle':
          p.pose = 'startle';
          faceToward(p, from, deltaSeconds, 9);
          break;
        case 'cower':
          p.pose = 'cower';
          if (seededRandom() < deltaSeconds * 0.3) crowdSay(p, 'cower', 0.4);
          break;
        case 'freeze':
          p.pose = 'freeze';
          faceToward(p, from, deltaSeconds, 5);
          break;
        case 'flee':
          fleeStep(p, deltaSeconds, r);
          break;
        case 'shelter': {
          const door = r.door;
          if (!door) {
            r.kind = 'flee';
            break;
          }
          p.pose = 'run';
          if (!r.atFront && distanceBetween(p, door.out) < 6) r.atFront = true;
          const target = r.atFront ? door : door.out;
          const blocked = crowdStep(p, headingBetween(p, target), 70, deltaSeconds);
          if ((r.atFront && (distanceBetween(p, door) < 5 || blocked)) || r.t > 12) {
            if (r.t > 12 && !r.atFront) {
              r.kind = 'flee';
              break;
            }
            goIndoors(p, door, randomBetween(25, 60), 'shelter');
            return true;
          }
          break;
        }
        case 'film': {
          p.pose = 'film';
          faceToward(p, from, deltaSeconds, 4);
          const threat = r.inc?.attacker;
          if (threat && threat.hp > 0 && distanceBetween(p, threat) < 110) {
            startReaction(p, 'flee', randomBetween(6, 9), threat, r.inc, { scream: true });
            return true;
          }
          if (seededRandom() < deltaSeconds * 0.12) crowdSay(p, 'film', 1);
          break;
        }
        case 'call': {
          p.pose = 'phone';
          p.onPhone = true;
          const threat = r.inc?.attacker;
          if (threat && threat.hp > 0 && distanceBetween(p, threat) < 100) {
            startReaction(p, 'flee', randomBetween(6, 9), threat, r.inc, { scream: true });
            return true;
          }
          // Turned half away, the way people talk on the phone about something.
          faceToward(p, from, deltaSeconds, 2);
          if (!r.opened && r.t > 0.8) {
            r.opened = true;
            const street = streetNameAt(p.x, p.y);
            p.speech =
              (r.inc?.kind === 'gunfire'
                ? 'Police? Shots fired'
                : r.inc?.kind === 'body'
                  ? 'Police? Someone’s dead'
                  : r.inc?.kind === 'crash' || r.inc?.kind === 'knock'
                    ? '911? There’s been an accident'
                    : 'Police? Send someone') + (street ? ' on ' + street.split(' & ')[0] : '') + '!';
            p.speechUntil = gameTime + 3.2;
          }
          if (!r.reported && r.t > 5.5) {
            r.reported = true;
            crowdReport(p, r.inc);
          }
          break;
        }
        case 'lookBack': {
          p.pose = r.filming ? 'film' : r.t % 5 < 1.1 ? 'despair' : 'watch';
          faceToward(p, from, deltaSeconds, 5);
          const threat = r.inc?.attacker;
          if (threat && threat.hp > 0 && distanceBetween(p, threat) < 170) {
            startReaction(p, 'flee', randomBetween(4, 6), threat, r.inc, { scream: true });
            return true;
          }
          if (seededRandom() < deltaSeconds * 0.1) crowdSay(p, r.inc?.kind === 'explosion' ? 'boom' : 'recover', 1);
          break;
        }
        case 'shout':
          p.pose = 'shout';
          faceToward(p, from, deltaSeconds, 8);
          break;
        case 'point':
          p.pose = 'point';
          faceToward(p, player, deltaSeconds, 8);
          break;
        case 'handsUp':
        case 'kneel': {
          p.pose = r.kind;
          faceToward(p, player, deltaSeconds, 6);
          const aimed = gameTime - (p.aimedAt || -10) < 0.5;
          if (aimed) r.aimTime = (r.aimTime || 0) + deltaSeconds;
          if (r.kind === 'handsUp' && !r.escalated && (r.aimTime || 0) > 3.5) {
            r.escalated = true;
            const roll = seededRandom();
            if (roll < 0.35) {
              r.kind = 'kneel';
              crowdSay(p, 'plead', 1);
            } else if (roll < 0.6 - (p.nerve || 0) * 0.2) {
              startReaction(p, 'flee', randomBetween(6, 10), player, null, { scream: true });
              return true;
            }
          }
          if (seededRandom() < deltaSeconds * 0.2) crowdSay(p, r.kind === 'kneel' ? 'plead' : 'handsUp', 0.8);
          // Once the gun is off them for a moment, they go. If the player put it
          // away altogether, they back off relieved rather than run.
          if (gameTime - (p.aimedAt || -10) > (r.kind === 'kneel' ? 2 : 1.3)) {
            if (playerUnarmed()) {
              releaseReactionRole(p);
              p.react = null;
              crowdSay(p, 'relief', 0.9);
              startReaction(p, 'startle', randomBetween(0.6, 1), player, null, { then: 'hurry' });
              return true;
            }
            endReaction(p);
            return true;
          }
          break;
        }
        case 'dodge': {
          p.pose = 'dodge';
          if (r.t < 0.42) {
            const speed = 55 * (1 - r.t / 0.42) + 10;
            moveBody(p, Math.cos(r.leap) * speed * deltaSeconds, Math.sin(r.leap) * speed * deltaSeconds, 5);
          }
          break;
        }
        case 'fist': {
          p.pose = r.t % 1.6 < 1.1 ? 'fist' : 'shout';
          const car = r.car;
          faceToward(p, car && car.hp > 0 ? car : from, deltaSeconds, 8);
          if (seededRandom() < deltaSeconds * 0.4) crowdSay(p, 'fist', 1);
          break;
        }
        case 'gasp': {
          p.pose = 'gasp';
          faceToward(p, from, deltaSeconds, 6);
          // Backing away from it, a step or two.
          const away = headingBetween(from, p);
          moveBody(p, Math.cos(away) * 9 * deltaSeconds, Math.sin(away) * 9 * deltaSeconds, 5);
          break;
        }
        case 'watch': {
          const focus = r.focusCar || (r.inc?.focus && r.inc.focus.hp !== undefined ? r.inc.focus : r.inc || from),
            body = r.inc?.kind === 'body' || (focus && focus.hp <= 0 && !r.focusCar),
            ring = r.focusCar ? [18, 30] : body ? [45, 85] : [65, 120];
          if (watchFrom(p, r, focus, ring[0], ring[1], deltaSeconds)) {
            r.gesture = (r.gesture ?? randomBetween(2, 6)) - deltaSeconds;
            if (r.gesture < 0) r.gesture = randomBetween(4, 9);
            p.pose = r.gesture < 1.2 ? (body ? 'gasp' : 'despair') : r.filming ? 'film' : 'watch';
            if (r.filming === undefined) r.filming = seededRandom() < 0.18;
            if (seededRandom() < deltaSeconds * 0.1) crowdSay(p, body ? 'bodyWatch' : 'crashWatch', 1);
          }
          break;
        }
        case 'help': {
          const victim = r.inc?.focus;
          if (!victim || !pedestrians.includes(victim) || (victim.hp > 0 && !victim.react && !personIncapacitated(victim))) {
            endReaction(p);
            return true;
          }
          const side = { x: victim.x + Math.cos(victim.a + Math.PI / 2) * 9, y: victim.y + Math.sin(victim.a + Math.PI / 2) * 9 };
          if (distanceBetween(p, side) > 4) {
            p.pose = 'run';
            crowdStep(p, headingBetween(p, side), 55, deltaSeconds);
          } else {
            p.pose = 'help';
            faceToward(p, victim, deltaSeconds, 6);
            if (seededRandom() < deltaSeconds * 0.2) crowdSay(p, victim.hp > 0 ? 'helper' : 'gasp', 1);
          }
          break;
        }
        case 'groan': {
          // Close to the danger and able to: crawl away, leaving a trail
          // (wounds.js); otherwise lie there and writhe.
          const from = r.from || p.threat;
          if (from && p.hp > 5 && r.t < 7 && distanceBetween(p, from) < 260) {
            p.pose = 'crawl';
            crowdStep(p, headingBetween(from, p), 8, deltaSeconds);
          } else p.pose = 'lie';
          if (seededRandom() < deltaSeconds * 0.25) crowdSay(p, 'injured', 1);
          break;
        }
        case 'argue':
          updateArgument(p, r, deltaSeconds);
          break;
        case 'returnCar':
          if (updateReturnToCar(p, r, deltaSeconds)) return true;
          break;
        default:
          p.pose = 'idle';
      }
      if (p.react === r && r.t >= r.dur) endReaction(p);
      return true;
    }
    /**
     * PICKING UP THE PIECES
     * Anybody the older systems marked as fleeing (hit by a car, shot, pulled
     * out of their car) is given a reaction that fits their state: badly hurt
     * people go down and groan, the lightly hurt limp away, the rest run.
     */
    function adoptLegacyFlee(p) {
      const from = p.threat || player;
      if (p.hp < 13) {
        p.injured = true;
        startReaction(p, 'groan', randomBetween(9, 20), from, null, { then: 'hurry' });
        crowdSay(p, 'injured', 1);
        return;
      }
      if (p.hp < 26) p.injured = true;
      startReaction(p, 'flee', Math.max(4, p.flee), from, null);
    }
    /**
     * POSE GALLERY (developer console)
     * Lines up one person per pose in front of the player so every pose can be
     * inspected in a screenshot. Movers walk small circles round their spot.
     */
    const GALLERY_POSES = [
      'idle', 'walk', 'run', 'limp', 'text', 'phone', 'film', 'leash',
      'cower', 'freeze', 'handsUp', 'kneel', 'startle', 'gasp', 'despair', 'watch',
      'shout', 'fist', 'point', 'dodge', 'sit', 'lie', 'help', 'carry',
      'serve', 'strum', 'clap', 'smoke', 'sway', 'wave', 'chat', 'arms',
    ];
    const GALLERY_MOVERS = { walk: 26, run: 70, limp: 14, text: 20, leash: 24, carry: 22 };
    function poseGallery(dressAs) {
      for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].posed) pedestrians.splice(i, 1);
      GALLERY_POSES.forEach((pose, i) => {
        const x = player.x - 175 + (i % 8) * 50,
          y = player.y - 80 + Math.floor(i / 8) * 50;
        const p = { x, y, a: Math.PI / 2, hp: 30, flee: 0, timer: 5, walk: 0, state: 'walk', posed: pose, anchor: { x, y } };
        dressPerson(p, dressAs || (pose === 'leash' ? 'dogWalker' : pickWeighted(crowdRoleWeights(12))));
        if (pose === 'carry') p.carry = 'box';
        if (pose === 'lie') p.injured = true;
        pedestrians.push(p);
      });
      return GALLERY_POSES;
    }
    /**
     * CHARACTER LINEUP (DeadEndCity.characterLineup, for screenshots): a row in
     * front of the player of a man and a woman from the street, a commuter in a
     * suit, a jogger, a beachgoer, a patrol officer, a traffic officer, SWAT, an
     * agent and a soldier, all facing the camera. `stance` 'aim' raises the
     * officers' weapons; 'walk' walks the civilians on the spot.
     */
    function characterLineup(stance = 'stand', spacing = 2.4 * UNITS_PER_METRE) {
      for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].posed) pedestrians.splice(i, 1);
      for (let i = officers.length - 1; i >= 0; i--) if (officers[i].lineup) officers.splice(i, 1);
      const cast = [
        ['casual', { female: false }],
        ['casual', { female: true }],
        ['commuter', {}],
        ['jogger', {}],
        ['beach', {}],
        ['patrol'],
        ['road'],
        ['swat'],
        ['fed'],
        ['soldier'],
      ];
      // Civilians to the player's left, officers to the right, the player between.
      const y = player.y;
      player.a = Math.PI / 2;
      cast.forEach(([kind, extra], i) => {
        const x = player.x + (i < 5 ? i - 5 : i - 4) * spacing;
        if (extra) {
          const p = { x, y, a: Math.PI / 2, hp: 30, flee: 0, timer: 5, walk: 0, state: 'walk', posed: stance === 'walk' ? 'walk' : kind, anchor: { x, y } };
          dressPerson(p, kind === 'beach' ? 'casual' : kind);
          if (extra.female !== undefined) {
            p.look.hairStyle = extra.female ? 2 : 1;
            p.look.skirt = false;
          }
          if (kind === 'beach') Object.assign(p.look, { top: p.look.skin, shoes: p.look.skin, shorts: true, pants: '#2a67b5', sleeves: false, hairStyle: 1 });
          pedestrians.push(p);
        } else {
          const o = makeOfficer(x, y, Math.PI / 2, kind, { lineup: true, state: stance === 'aim' ? 'aim' : 'idle', shield: false });
          officers.push(o);
        }
      });
      return cast.map((c) => c[0]);
    }
    function updatePosed(p, deltaSeconds) {
      const speed = GALLERY_MOVERS[p.posed] || 0;
      p.pose = p.posed === 'walk' ? null : p.posed;
      p.injured = p.posed === 'limp' || p.posed === 'lie';
      p.sitting = p.posed === 'sit';
      if (speed) {
        const w = speed / 16,
          t = gameTime * w;
        p.x = p.anchor.x + Math.cos(t) * 16;
        p.y = p.anchor.y + Math.sin(t) * 16;
        p.a = t + Math.PI / 2;
        p.walking = true;
        if (p.dog) updateDog(p, deltaSeconds);
      } else {
        p.walking = false;
        p.a = Math.PI / 2;
      }
      // Label each one with its pose.
      p.speech = p.posed;
      p.speechUntil = gameTime + 1;
      return true;
    }
    /* Per person: pending perception, then the reaction if any. True when handled. */
    function updateCrowdPerson(p, deltaSeconds) {
      if (p.posed) return updatePosed(p, deltaSeconds);
      if (p.pending && gameTime >= p.pending.at) {
        const pending = p.pending;
        p.pending = null;
        decideReaction(p, pending);
      }
      if (!p.react && p.flee > 0) adoptLegacyFlee(p);
      if (p.react) return updateReaction(p, deltaSeconds);
      if (p.scene) return updateSceneMember(p, deltaSeconds);
      if (p.dog) updateDog(p, deltaSeconds);
      return false;
    }
    /**
     * DOGS
     * A dog walks at heel on a leash, stops to sniff, trots to catch up, and
     * when its owner runs, it runs. If its owner goes down, it stays.
     */
    function updateDog(p, deltaSeconds) {
      const dog = p.dog;
      if (!dog) return;
      if (p.hp <= 0) {
        dog.moving = 0;
        dog.sit = true;
        return;
      }
      const behind = { x: p.x - Math.cos(p.a) * 11 + Math.cos(p.a + Math.PI / 2) * 6, y: p.y - Math.sin(p.a) * 11 + Math.sin(p.a + Math.PI / 2) * 6 };
      dog.sniff -= deltaSeconds;
      if (dog.sniff < -8) dog.sniff = randomBetween(1, 2.5);
      const d = distanceBetween(dog, behind),
        leash = 20;
      let speed = 0;
      if (dog.sniff > 0 && d < leash && p.react?.kind !== 'flee') speed = 0;
      else if (d > 2) speed = Math.min(110, d * 5);
      if (speed > 0) {
        const a = headingBetween(dog, behind);
        dog.a += normalizeAngle(a - dog.a) * Math.min(1, deltaSeconds * 8);
        dog.x += Math.cos(a) * speed * deltaSeconds;
        dog.y += Math.sin(a) * speed * deltaSeconds;
      }
      if (distanceBetween(dog, p) > leash + 6) {
        const a = headingBetween(p, dog);
        dog.x = p.x + Math.cos(a) * (leash + 6);
        dog.y = p.y + Math.sin(a) * (leash + 6);
      }
      dog.moving = speed;
      dog.sit = false;
    }

    /**
     * WITNESS CALLS
     * A completed call is the only way a bystander changes the wanted level, and
     * only for what the player did: with no stars, a call brings the police;
     * while they are already searching, a caller who can see you tells them
     * where you are. Stop the caller (or scare them off) and the call never ends.
     */
    const WITNESS_REPORT_WINDOW = 30;
    function crowdReport(caller, inc) {
      if (!inc || inc.reported) return;
      inc.reported = true;
      crowd.reports++;
      crowd.lastReportAt = gameTime;
      if (inc.attacker !== player || gameMode !== 'play' || distanceBetween(inc, player) > 1800) return;
      // A call is prompt or it is nothing: a witness who rings in half a minute
      // after the last shot (or the killing, for a body) no longer brings the
      // police, so stars never rise long after the player stopped.
      // A body keeps drawing onlookers for minutes; what counts is when it fell.
      const crimeAt = inc.kind === 'body' ? (inc.focus?.deadTime ?? inc.start) : inc.time;
      if (gameTime - crimeAt > WITNESS_REPORT_WINDOW) return;
      if (wantedStars <= 0) {
        const amount = { gunfire: 0.5, explosion: 0.6, knock: 0.45, crash: 0.25, body: 0.45, melee: 0.4 }[inc.kind] || 0.3;
        crime(amount);
        tell('A WITNESS CALLED THE POLICE', 2.6);
      } else if (searchActive && distanceBetween(caller, player) < 450 && crowdSight(caller, player)) {
        lastSeen = { x: player.x, y: player.y };
        searchRemaining = Math.min(policeSearchSeconds(), searchRemaining + 2);
        tell('A WITNESS IS GIVING THE POLICE YOUR POSITION', 2.6);
      }
    }
    /**
     * BODIES
     * A body on the pavement stops people. Whoever walks into sight of one
     * gasps and backs off; some stay and stare from a distance, one calls it in.
     */
    const bodyIncidents = new WeakMap();
    function refreshBodies(deltaSeconds) {
      crowd.timers.bodies -= deltaSeconds;
      if (crowd.timers.bodies > 0) return;
      crowd.timers.bodies = 0.4;
      crowd.bodies.length = 0;
      for (const list of [pedestrians, enemies, gangMembers, officers])
        for (const e of list)
          if (
            e.hp <= 0 &&
            gameTime - (e.deadTime || 0) < 240 &&
            Math.abs(e.x - player.x) < 1200 &&
            Math.abs(e.y - player.y) < 1200 &&
            crowd.bodies.length < 16
          )
            crowd.bodies.push(e);
      for (const body of crowd.bodies) {
        let inc = bodyIncidents.get(body);
        forPeopleNear(body.x, body.y, ALARM_REACH.body, (p, d) => {
          if (p.hp <= 0 || p.react || p.pending || p.leader || p.onDeck || personIncapacitated(p)) return;
          if (d > 55 && !crowdSight(p, body)) return;
          if (!inc) {
            inc = crowdIncident('body', body, body.killedBy === player ? player : null, 1);
            inc.focus = body;
            bodyIncidents.set(body, inc);
          }
          inc.time = gameTime;
          p.pending = { inc, at: gameTime + randomBetween(0.15, 0.6), sees: true, d };
        });
      }
    }
    /**
     * A GUN POINTED AT YOU
     * With a firearm out and aimed (mouse or touch aim, or after a recent shot),
     * whoever the barrel is on puts their hands up and pleads; held there long
     * enough some drop to their knees, some bolt.
     */
    function aimReactions(deltaSeconds) {
      crowd.timers.aim -= deltaSeconds;
      if (crowd.timers.aim > 0) return;
      crowd.timers.aim = 0.12;
      if (player.car || gameMode !== 'play' || transitRide || taxiRide || player.swimming) return;
      // Empty-handed, the player is just another person on the street: nobody
      // puts their hands up, and now and then someone passing says hello.
      if (playerUnarmed()) {
        friendlyNods();
        return;
      }
      if (selectedWeaponIndex === KNIFE_INDEX || !weapons[selectedWeaponIndex]?.owned) return;
      if (!(mouse.active || touchAim !== null || gameTime - crowd.playerShotAt < 8)) return;
      const aimA = aim();
      forPeopleNear(player.x, player.y, 240, (p, d) => {
        if (p.hp <= 0 || d < 6 || personIncapacitated(p) || p.onDeck) return;
        if (Math.abs(normalizeAngle(headingBetween(player, p) - aimA)) > Math.max(0.1, 13 / d)) return;
        if (!crowdSight(player, p)) return;
        p.aimedAt = gameTime;
        p.sawPlayerAt = gameTime;
        const cur = p.react?.kind;
        if (cur === 'handsUp' || cur === 'kneel' || cur === 'groan') return;
        if (cur === 'flee' && (d > 110 || seededRandom() < 0.5)) return;
        startReaction(p, 'handsUp', 60, player, null);
        crowdSay(p, 'handsUp', 0.9);
      });
    }
    /* An unarmed player walking by calm people gets the odd nod or hello. */
    function friendlyNods() {
      if (gameTime - (crowd.lastNodAt ?? -100) < 7 || wantedStars > 0) return;
      let best = null,
        bestD = 46;
      forPeopleNear(player.x, player.y, 46, (p, d) => {
        if (p.hp <= 0 || p.react || p.pending || p.onDeck || personIncapacitated(p) || p.speechUntil > gameTime) return;
        if (gameTime - (p.aimedAt ?? -100) < 60 || d >= bestD) return;
        best = p;
        bestD = d;
      });
      if (best && crowdSay(best, 'greet', 0.6)) crowd.lastNodAt = gameTime;
    }
    /**
     * TIPPING OFF THE POLICE
     * While the police are searching, an officer on foot near someone who saw
     * the player gets pointed the right way, and the search moves with them.
     */
    function policeTips(deltaSeconds) {
      crowd.timers.tips -= deltaSeconds;
      if (crowd.timers.tips > 0) return;
      crowd.timers.tips = 1;
      if (wantedStars <= 0 || !searchActive || gameTime - crowd.lastTipAt < 8) return;
      for (const o of officers) {
        if (o.hp <= 0 || o.returned || o.state === 'return') continue;
        let witness = null;
        forPeopleNear(o.x, o.y, 130, (p) => {
          if (witness || p.hp <= 0 || gameTime - (p.sawPlayerAt ?? -100) > 45) return;
          if (p.react && !['watch', 'startle'].includes(p.react.kind)) return;
          witness = p;
        });
        if (!witness) continue;
        startReaction(witness, 'point', 2.8, player, null);
        crowdSay(witness, 'point', 1);
        lastSeen = { x: player.x + randomBetween(-50, 50), y: player.y + randomBetween(-50, 50) };
        searchRemaining = Math.min(policeSearchSeconds(), searchRemaining + 1.5);
        crowd.lastTipAt = gameTime;
        tell('A WITNESS IS POINTING THE POLICE YOUR WAY', 2.4);
        return;
      }
    }
    /**
     * NEAR MISSES
     * A car coming fast along a line that would clip someone makes them leap
     * clear; once safe, most turn round and let the driver have it.
     */
    function nearMisses(deltaSeconds) {
      crowd.timers.near -= deltaSeconds;
      if (crowd.timers.near > 0) return;
      crowd.timers.near = 0.08;
      for (const c of vehicles) {
        if (c.hp <= 0 || isBoat(c) || (isAircraft(c) && aircraftClearance(c) > 3)) continue;
        if (Math.abs(c.x - player.x) > 1000 || Math.abs(c.y - player.y) > 1000) continue;
        const speed = Math.hypot(c.vx || 0, c.vy || 0);
        if (speed < 70) continue;
        const ux = c.vx / speed,
          uy = c.vy / speed,
          look = 18 + speed * 0.42,
          half = vehicleSpec(c).w / 2 + vehicleSpec(c).l * 0.1;
        forPeopleNear(c.x + (ux * look) / 2, c.y + (uy * look) / 2, look / 2 + 34, (p) => {
          if (p.hp <= 0 || personIncapacitated(p) || p.onDeck || ['dodge', 'groan'].includes(p.react?.kind)) return;
          const dx = p.x - c.x,
            dy = p.y - c.y,
            along = dx * ux + dy * uy,
            side = -dx * uy + dy * ux;
          if (along < 0 || along > look || Math.abs(side) > half + 18) return;
          const s = Math.sign(side) || (seededRandom() < 0.5 ? -1 : 1),
            leap = Math.atan2(ux * s, -uy * s);
          const angry = (c === player.car || speed > 110) && (p.nerve ?? 0.5) > 0.2;
          startReaction(p, 'dodge', 0.5, c, null, { leap, car: c, then: angry ? 'fist' : 'hurry', thenExtra: { car: c } });
          crowdSay(p, 'dodge', 0.7);
          if (c === player.car) p.sawPlayerAt = gameTime;
        });
      }
    }
