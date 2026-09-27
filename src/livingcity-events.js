    // Street events in free roam: a bag snatch the player can stop by catching the thief on foot
    // (updateStreetEvents, stageSnatch), his marker on the radar (drawLivingCityMap).
    /* Now and then (every two or three minutes on foot in the city by day and
       evening, no mission, no stars) someone walking near the player turns out
       to be a thief: he closes on a pedestrian with a bag in view, grabs it and
       runs. The victim shouts; the thief shows red on the radar. Catching him on
       foot (within ~1.4 m, or knocking him down any way) makes him drop it: the
       bag goes back to its owner and the player gets a reward. He gets away
       after 45 s or 90 m ahead. Nothing here is a crime: tackling him is not an
       attack (punching or shooting him still is, through the usual rules). */
    const streetEvents = { timer: 60, active: null, staged: 0, caught: 0, escaped: 0, last: null };
    const SNATCH_LINES = {
      victim: ['Hey! My bag!', 'Stop! Thief!', 'He took my bag! Somebody stop him!', 'Thief! THIEF!'],
      thanks: ['My bag! Thank you!', 'Oh, thank you, thank you!', 'You got him! Bless you.', 'That was brave. Thank you.'],
      caught: ['Alright, alright! Take it!', 'Get off me! Here!', 'Okay! Okay! It is yours!'],
    };
    function eventSay(p, kind, seconds = 2.8) {
      if (!p || p.hp <= 0) return;
      p.speech = pickLine(SNATCH_LINES[kind], p);
      p.speechUntil = gameTime + seconds;
      p.speechKind = 'event';
      p.speechKindText = p.speech;
    }
    function streetEventsAllowed() {
      const hour = crowdHour();
      return (
        gameMode === 'play' &&
        !mission &&
        wantedStars <= 0 &&
        !player.car &&
        !player.swimming &&
        !playerOnRoof() &&
        hour > 8 &&
        hour < 23 &&
        inCityGrid(player.x, player.y) &&
        districtBustle(player.x, player.y) >= 0.75
      );
    }
    /* A snatch round the player: the victim a lone adult with a bag in view
       90-330 units off, the thief an ordinary walker 50-260 units from them. */
    function stageSnatch() {
      let victim = null,
        best = Infinity;
      forPeopleNear(player.x, player.y, 330, (p, d) => {
        if (d < 90 || p.hp <= 0 || !streamableWalker(p) || p.role === 'kid' || !crowdInView(p.x, p.y, -30)) return;
        if (!['handbag', 'shopping', 'briefcase', 'camera'].includes(p.carry) || crowdOnRoad(p.x, p.y)) return;
        if (pedestrians.some((q) => q.leader === p)) return;
        if (d < best) {
          best = d;
          victim = p;
        }
      });
      if (!victim) return null;
      let thief = null;
      best = Infinity;
      forPeopleNear(victim.x, victim.y, 260, (p, d) => {
        if (p === victim || d < 50 || p.hp <= 0 || !streamableWalker(p) || p.leader || p.dog) return;
        if (['kid', 'elder', 'jogger'].includes(p.role) || pedestrians.some((q) => q.leader === p)) return;
        if (distanceBetween(p, player) < 70 || !crowdSight(p, victim)) return;
        if (d < best) {
          best = d;
          thief = p;
        }
      });
      if (!thief) return null;
      const event = { kind: 'snatch', victim, thief, bag: victim.carry, phase: 'approach', at: gameTime, startHp: thief.hp, reward: 0 };
      thief.cityRole = { kind: 'thief', event };
      thief.carry = null;
      victim.cityRole = { kind: 'victim', event };
      streetEvents.active = event;
      streetEvents.staged++;
      return event;
    }
    /* The thief's own step before the grab (updateCityRolePerson): a brisk walk
       up behind the victim. */
    function updateThief(p, deltaSeconds) {
      const event = p.cityRole.event;
      if (event.phase !== 'approach') return false;
      const v = event.victim;
      const d = distanceBetween(p, v);
      if (d > 8) crowdStep(p, headingBetween(p, v), Math.min(d / deltaSeconds, 8.5 * KMH), deltaSeconds);
      return true;
    }
    function endStreetEvent(event, why) {
      for (const p of [event.thief, event.victim]) if (p?.cityRole?.event === event) p.cityRole = null;
      streetEvents.last = { kind: event.kind, why, seconds: Math.round(gameTime - event.at), reward: event.reward };
      streetEvents.active = null;
      streetEvents.timer = randomBetween(110, 190);
    }
    function updateStreetEvents(deltaSeconds) {
      const event = streetEvents.active;
      if (!event) {
        streetEvents.timer -= deltaSeconds;
        if (streetEvents.timer > 0) return;
        streetEvents.timer = 8;
        if (streetEventsAllowed() && seededRandom() < 0.5) stageSnatch();
        return;
      }
      const thief = event.thief,
        victim = event.victim;
      if (thief.hp <= 0 || !pedestrians.includes(thief)) return endStreetEvent(event, thief.hp <= 0 ? 'thief down' : 'gone');
      if (event.phase === 'approach') {
        // Called off: the player drew a gun on the street, took a car, a mission began.
        if (!streetEventsAllowed() || victim.hp <= 0 || victim.react || thief.react || gameTime - event.at > 25)
          return endStreetEvent(event, 'called off');
        if (distanceBetween(thief, victim) <= 9) {
          event.phase = 'run';
          event.runAt = gameTime;
          victim.carry = null;
          thief.carry = event.bag === 'briefcase' ? 'briefcase' : 'handbag';
          startReaction(victim, 'startle', 1.2, thief, null, { then: 'lookBack' });
          eventSay(victim, 'victim', 3);
          scream(victim);
          startReaction(thief, 'flee', 60, player, null);
          tell('BAG SNATCHER · CATCH HIM ON FOOT', 3);
        }
        return;
      }
      // The chase: he runs from the player, wherever they are.
      if (thief.react?.kind === 'flee') thief.react.from = { x: player.x, y: player.y };
      else if (!thief.knockedFor) startReaction(thief, 'flee', 60, player, null);
      const d = distanceBetween(thief, player),
        knocked = (thief.knockedFor || 0) > 0 || thief.hp < event.startHp;
      if ((!player.car && d < 11 && sameFloor(player, thief)) || knocked) {
        // Caught (or floored): down he goes, the bag back to its owner.
        if (!knocked) {
          thief.knockedFor = 1.8;
          thief.threat = { x: player.x, y: player.y };
          noise(0.05, 0.18, 160);
        }
        thief.react = null;
        thief.carry = null;
        eventSay(thief, 'caught', 2.4);
        event.reward = 120 + Math.round(seededRandom() * 8) * 20;
        cash = clamp(cash + event.reward, 0, 99999999);
        if (victim.hp > 0) {
          victim.carry = event.bag;
          eventSay(victim, 'thanks', 3);
        }
        tell('THIEF STOPPED · BAG RETURNED · +$' + event.reward, 3);
        streetEvents.caught++;
        return endStreetEvent(event, 'caught');
      }
      if (d > 720 || gameTime - event.runAt > 45 || mission) {
        if (gameMode === 'play' && !mission) tell('THE THIEF GOT AWAY', 2);
        streetEvents.escaped++;
        thief.carry = null;
        return endStreetEvent(event, 'escaped');
      }
    }
    /* Radar: the running thief, a pulsing red dot. */
    function drawLivingCityMap(drawingContext, scale) {
      const event = streetEvents.active;
      if (!event || event.phase !== 'run') return;
      const t = event.thief,
        r = (5 + Math.sin(gameTime * 9) * 1.5) / scale;
      drawingContext.fillStyle = '#ff4a3d';
      drawingContext.strokeStyle = '#1a0806';
      drawingContext.lineWidth = 2 / scale;
      drawingContext.beginPath();
      drawingContext.arc(t.x, t.y, r, 0, TAU);
      drawingContext.fill();
      drawingContext.stroke();
    }
    function streetEventReport() {
      const e = streetEvents.active,
        round = (v) => Math.round(v);
      return {
        staged: streetEvents.staged,
        caught: streetEvents.caught,
        escaped: streetEvents.escaped,
        next: +Math.max(0, streetEvents.timer).toFixed(1),
        allowed: streetEventsAllowed(),
        last: streetEvents.last,
        active: e
          ? {
              kind: e.kind,
              phase: e.phase,
              seconds: +(gameTime - e.at).toFixed(1),
              thief: { x: round(e.thief.x), y: round(e.thief.y), d: round(distanceBetween(e.thief, player)), react: e.thief.react?.kind || null, carry: e.thief.carry },
              victim: { x: round(e.victim.x), y: round(e.victim.y), d: round(distanceBetween(e.victim, player)), carry: e.victim.carry, react: e.victim.react?.kind || null },
              gap: round(distanceBetween(e.thief, e.victim)),
            }
          : null,
      };
    }
