    // Blue Hour HUD and 2D view: the stealth meter and prompts (roofMissionUI), speech bubbles, guard cones on the 2D map.
    function rooftopShot() {
      const m = rooftopJob();
      if (!m || !player.roof) return false;
      drawWeapon();
      m.weaponDrawn = true;
      roofAlarm(m);
      return true;
    }
    const ROOF_DRINK_PROMPTS = {
      approach: 'VESCARI IS GOING FOR HIS GLASS · STEP AWAY FROM THE TABLE',
      reach: 'THE TOAST · KEEP YOUR DISTANCE',
      toast: 'THE TOAST · KEEP YOUR DISTANCE',
      sip: 'THE TOAST · KEEP YOUR DISTANCE',
      lower: 'THE TOAST · KEEP YOUR DISTANCE',
      beat: 'WAIT FOR IT…',
      cough: 'SOMETHING IS WRONG…',
      clutch: 'KEEP YOUR COVER',
      stagger: 'KEEP YOUR COVER',
      buckle: 'KEEP YOUR COVER',
      faint: 'KEEP YOUR COVER',
    };
    /* The stealth meter (#stealthStatus): what the party thinks of the player,
       whether a bodyguard sees them now, and the walk / run reminder. */
    function roofMissionUI() {
      const missionState = rooftopJob(),
        box = getElement('stealthStatus'),
        on = !!missionState && !!player.roof;
      box.style.display = on ? 'block' : 'none';
      if (on) {
        const m = missionState,
          seen = !m.alarm && enemies.some((e) => e.guard && e.sees && e.hp > 0 && e.missionTag === 'rooftop-hit'),
          running = roofPlayerRunning(m),
          hot = m.alarm || m.suspicion >= 70;
        getElement('stealthLabel').textContent = m.alarm
          ? m.boss.hp > 0 && !poisonCommitted(m)
            ? 'COVER BLOWN · FINISH IT OR GET OUT'
            : 'COVER BLOWN · GET TO THE ELEVATOR'
          : hot
            ? seen
              ? 'ALMOST MADE · GET OUT OF SIGHT'
              : 'ALMOST MADE · STAY OUT OF SIGHT'
            : seen
              ? running
                ? 'SEEN RUNNING · SLOW DOWN'
                : 'IN A BODYGUARD’S SIGHT'
              : m.medical
                ? 'MEDICAL EMERGENCY · WALK TO THE ELEVATOR'
                : m.killRegistered
                  ? 'VESCARI IS DOWN · REACH THE ELEVATOR'
                  : m.suspicion > 8
                    ? 'SUSPICION FADING'
                    : 'GUEST DISGUISE · STAY OUT OF THE CONES';
        getElement('stealthFill').style.width = m.suspicion + '%';
        getElement('stealthHint').textContent = m.alarm
          ? ''
          : running
            ? 'RUNNING · LET GO OF ' + keyName('walk') + ' TO WALK'
            : 'WALK TO BLEND IN · ' + keyName('walk') + ' TO RUN';
        box.classList.toggle('seen', seen);
        box.classList.toggle('hot', hot);
        if (!m.alarm && m.boss.hp > 0) {
          if (m.poisoned)
            offerPrompt(ROOF_DRINK_PROMPTS[m.poisonPhase] || 'GLASS PREPARED', { key: null, id: 'roof-poisoned' });
          else if (distanceBetween(player, ROOF_HIT.drink) < 36 && !poisonWitness(m))
            offerPrompt('SPIKE THE RESERVED GLASS', { key: 'poison', id: 'roof-glass' });
          else
            offerPrompt(
              distanceBetween(player, ROOF_HIT.drink) < 36
                ? 'BODYGUARD WATCHING · WAIT FOR AN OPENING'
                : 'VIP LOUNGE · FIND VESCARI’S RESERVED GLASS',
              { key: null },
            );
        }
        if (canSilentHit(m)) {
          offerPrompt('SILENT TAKEDOWN', { hold: true, id: 'takedown' });
        }
      }
      if (missionState && player.roof && distanceBetween(player, ROOFTOP.lift) < 48) {
        offerPrompt('ELEVATOR TO STREET', { id: 'roof-lift' });
      }
      if (missionState?.stage === 0 && !player.car && distanceBetween(player, ROOF_HIT.outfit) < 58) {
        offerPrompt('CHANGE INTO GUEST CLOTHES', { id: 'roof-outfit' });
      }
    }
    function roofSpeechBubble(p, x, y, scale = 1) {
      if (!p.speech || p.speechFor <= 0) return;
      // Like the street bubbles, unreadable from high above (crowd.js speechHeightFade).
      const fade = speechHeightFade(p);
      if (fade <= 0.01) return;
      worldContext.save();
      worldContext.globalAlpha = fade;
      worldContext.font = '600 ' + 14 * scale + 'px Arial';
      const w = worldContext.measureText(p.speech).width + 24 * scale,
        h = 30 * scale;
      worldContext.fillStyle = '#101c2cf5';
      worldContext.strokeStyle = p.boss ? '#e5c487' : '#b6d5d9';
      worldContext.lineWidth = scale;
      worldContext.beginPath();
      worldContext.roundRect(x - w / 2, y - h, w, h, 5 * scale);
      worldContext.fill();
      worldContext.stroke();
      worldContext.beginPath();
      worldContext.moveTo(x - 5 * scale, y);
      worldContext.lineTo(x, y + 6 * scale);
      worldContext.lineTo(x + 5 * scale, y);
      worldContext.fill();
      worldContext.fillStyle = '#fff4dc';
      worldContext.textAlign = 'center';
      worldContext.fillText(p.speech, x, y - 10 * scale);
      worldContext.restore();
    }
    /* The 2D view's sight cones: the same angle, range and occlusion as the
       logic (roofGuardView, roofViewLength), gold when calm, amber watching the
       player, red when the cover is nearly blown. */
    function drawRoofStealth2D() {
      const m = rooftopJob();
      if (!m) return;
      if (!m.alarm && player.roof)
        for (const e of enemies.filter((e) => e.guard && e.hp > 0 && e.missionTag === 'rooftop-hit')) {
          const view = roofGuardView(e),
            hot = e.sees && m.suspicion >= 60,
            color = hot ? '232, 70, 52' : e.sees ? '240, 160, 64' : '230, 195, 134';
          worldContext.fillStyle = 'rgba(' + color + ',' + (e.sees ? 0.2 : 0.1) + ')';
          worldContext.strokeStyle = 'rgba(' + color + ',' + (e.sees ? 0.75 : 0.4) + ')';
          worldContext.lineWidth = 1.5;
          worldContext.beginPath();
          worldContext.moveTo(e.x, e.y);
          for (let i = 0; i <= 40; i++) {
            const a = view - ROOF_VIEW.half + (i / 40) * ROOF_VIEW.half * 2,
              d = roofViewLength(e, a);
            worldContext.lineTo(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d);
          }
          worldContext.closePath();
          worldContext.fill();
          worldContext.stroke();
        }
      if (m.boss.hp > 0) {
        worldContext.save();
        worldContext.strokeStyle = m.poisonUsed ? '#90bd98' : '#edc77f';
        worldContext.lineWidth = 2;
        worldContext.beginPath();
        worldContext.arc(ROOF_HIT.drink.x, ROOF_HIT.drink.y, 16, 0, TAU);
        worldContext.stroke();
        worldContext.fillStyle = '#f4d696';
        worldContext.font = 'bold 9px Arial';
        worldContext.textAlign = 'center';
        worldContext.fillText(
          m.poisonUsed ? 'DRINK PREPARED' : keyName('poison') + ' · RESERVED GLASS',
          ROOF_HIT.drink.x,
          ROOF_HIT.drink.y - 20,
        );
        worldContext.restore();
      }
    }
    function drawRoofDialogue2D() {
      if (!player.roof) return;
      const m = rooftopJob();
      for (const p of [m?.boss, ...(m ? enemies.filter((e) => e.guard && e.missionTag === 'rooftop-hit') : []), ...storyActors])
        if (p && !p.hidden && rooftopFloor(p)) roofSpeechBubble(p, p.x, p.y - 27, 0.8);
    }
