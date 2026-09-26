    // Blue Hour HUD and 2D view: the stealth meter and prompts (roofMissionUI), speech bubbles, guard cones on the 2D map.
    function rooftopShot() {
      const m = rooftopJob();
      if (!m || !player.roof) return false;
      drawWeapon();
      m.weaponDrawn = true;
      roofAlarm(m);
      return true;
    }
    function roofMissionUI() {
      const missionState = rooftopJob(),
        box = getElement('stealthStatus');
      box.style.display = missionState && player.roof ? 'block' : 'none';
      if (missionState && player.roof) {
        getElement('stealthLabel').textContent = missionState.alarm
          ? 'COVER BLOWN'
          : missionState.partyPanic
            ? 'MEDICAL EMERGENCY · KEEP WALKING'
            : missionState.killRegistered
              ? 'VESCARI IS DOWN · REACH THE ELEVATOR'
              : missionState.suspicion > 10
                ? 'SUSPICION RISING'
                : 'GUEST DISGUISE · WATCH THE PATROLS';
        getElement('stealthFill').style.width = missionState.suspicion + '%';
        if (!missionState.alarm && missionState.boss.hp > 0) {
          if (missionState.poisoned)
            offerPrompt(
              ({
                approach: 'VESCARI IS GOING TO HIS DRINK',
                sip: 'THE TOAST',
                sick: 'SOMETHING IS WRONG…',
                collapse: 'KEEP YOUR COVER',
              }[missionState.poisonPhase] || 'GLASS PREPARED') +
                ' · ' +
                keyName('interact') +
                ' AT THE ELEVATOR TO LEAVE',
              { key: null, id: 'roof-poisoned' },
            );
          else if (distanceBetween(player, ROOF_HIT.drink) < 36 && !poisonWitness(missionState))
            offerPrompt('PREPARE THE RESERVED GLASS', { key: 'poison', id: 'roof-glass' });
          else
            offerPrompt(
              distanceBetween(player, ROOF_HIT.drink) < 36
                ? 'BODYGUARD WATCHING · WAIT FOR AN OPENING'
                : 'VIP LOUNGE · FIND VESCARI’S RESERVED GLASS',
              { key: null },
            );
        }
        if (canSilentHit(missionState)) {
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
    function drawRoofStealth2D() {
      const m = rooftopJob();
      if (!m) return;
      if (!m.alarm)
        for (const e of enemies.filter((e) => e.guard && e.hp > 0 && e.missionTag === 'rooftop-hit')) {
          worldContext.fillStyle = '#e6c38618';
          worldContext.beginPath();
          worldContext.moveTo(e.x, e.y);
          for (let a = e.a - 0.82; a <= e.a + 0.83; a += 0.04) {
            const d = roofRayLength(e, a);
            worldContext.lineTo(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d);
          }
          worldContext.closePath();
          worldContext.fill();
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
          m.poisonUsed ? 'DRINK PREPARED' : 'P · RESERVED DRINK',
          ROOF_HIT.drink.x,
          ROOF_HIT.drink.y - 20,
        );
        worldContext.restore();
      }
    }
    function drawRoofDialogue2D() {
      if (!player.roof) return;
      for (const p of [rooftopJob()?.boss, ...storyActors])
        if (p && !p.hidden) roofSpeechBubble(p, p.x, p.y - 27, 0.8);
    }
