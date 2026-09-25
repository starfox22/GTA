    // BEGIN SUBSYSTEM: src/armor.js — The player's tank: turret traverse, ammunition, reticle
    /**
     * The player's tank: turret traverse, ammunition, reticle
     * Source: src/armor.js
     * Scope: shared game closure.
     *
     * TURRET: the turret is aimed independently of the hull. It turns toward the
     * mouse (or the touch aim stick, or the auto-aim) at a real traverse rate,
     * TURRET_MAX_RATE (30°/s), accelerating out of rest and easing into the
     * target so it never snaps. It is stabilised: steering the hull does not drag
     * it off target. The cannon fires where the barrel points, not where the
     * mouse is; the reticle shows both (a ring at the mouse, a pip where the
     * barrel is laid, green when a round is loaded).
     *
     * AMMUNITION: a main battle tank carries about forty rounds for the main gun
     * (TANK_MAIN_ROUNDS) and loads one every five seconds. Most also carry a
     * coaxial machine gun fed from 250-round belts (1500 rounds in all); some of
     * Fort Sentinel's tanks have none (`noCoax`). F / click fires the selected
     * weapon, the weapon switch (Q, or a tap on the weapon chip) swaps between
     * MAIN GUN and COAX MG, and the right mouse button always fires the MG.
     * The weapon chip shows the rounds, the reload and the belt while in a tank.
     */
    const TANK_MAIN_ROUNDS = 40,
      TANK_RELOAD_SECONDS = 5,
      TANK_MG_TOTAL = 1500,
      TANK_MG_BELT = 250,
      TANK_MG_BELT_SECONDS = 4,
      TANK_MG_INTERVAL = 0.075,
      TURRET_MAX_RATE = (30 * Math.PI) / 180,
      TURRET_ACCEL = 1.1;
    function tankArms(c) {
      if (!c.arms)
        c.arms = {
          shells: TANK_MAIN_ROUNDS,
          belt: c.noCoax ? 0 : TANK_MG_BELT,
          mg: c.noCoax ? 0 : TANK_MG_TOTAL - TANK_MG_BELT,
          beltReadyAt: 0,
          mgReadyAt: 0,
          weapon: 'cannon',
        };
      return c.arms;
    }
    /* Turn a turret toward `want` (world radians): accelerate at `accel` up to
       `maxRate`, and slow early enough to stop on target (v² = 2·a·error). */
    function traverseTurret(c, want, deltaSeconds, maxRate = TURRET_MAX_RATE, accel = TURRET_ACCEL) {
      const current = c.turretA ?? c.a,
        error = normalizeAngle(want - current),
        brake = Math.sign(error) * Math.sqrt(2 * accel * Math.abs(error)),
        desired = clamp(brake, -maxRate, maxRate);
      let rate = c.turretRate || 0;
      rate += clamp(desired - rate, -accel * deltaSeconds * 2, accel * deltaSeconds);
      const step = rate * deltaSeconds;
      if (Math.abs(error) < 0.003 || (Math.sign(step) === Math.sign(error) && Math.abs(step) >= Math.abs(error))) {
        c.turretA = normalizeAngle(want);
        c.turretRate = Math.abs(error) < 0.003 ? 0 : rate;
        return;
      }
      c.turretRate = rate;
      c.turretA = normalizeAngle(current + step);
    }
    /* Per frame while the player commands a tank. */
    function updatePlayerArmor(deltaSeconds) {
      const c = player.car;
      if (!c || c.type !== 'tank' || c.hp <= 0) return;
      tankArms(c);
      c.turretAim = aim();
      traverseTurret(c, c.turretAim, deltaSeconds);
      if (mouse.alt && gameMode === 'play') tankMachineGun(c);
      const arms = c.arms;
      if (!arms.belt && arms.mg > 0 && !arms.beltReadyAt) {
        arms.beltReadyAt = gameTime + TANK_MG_BELT_SECONDS;
        reloadSound();
      }
      if (arms.beltReadyAt && gameTime >= arms.beltReadyAt) {
        const load = Math.min(TANK_MG_BELT, arms.mg);
        arms.belt += load;
        arms.mg -= load;
        arms.beltReadyAt = 0;
      }
      // The loader calls the round up: a click when the main gun is ready again.
      if (arms.loading && gameTime >= (c.cannonReadyAt || 0)) {
        arms.loading = false;
        if (arms.shells > 0) tone(420, 0.05, 0.1, 'square', 300);
      }
    }
    /* Fire the selected weapon (shoot(), game.js). */
    function tankPlayerFire(c) {
      if (tankArms(c).weapon === 'mg') tankMachineGun(c);
      else tankCannon(c);
    }
    function tankCannon(c) {
      const arms = tankArms(c);
      if (gameTime < (c.cannonReadyAt || 0)) return false;
      if (arms.shells <= 0) {
        if (gameTime - (arms.emptySaidAt ?? -100) > 3) {
          arms.emptySaidAt = gameTime;
          tell('MAIN GUN · OUT OF AMMUNITION' + (arms.belt + arms.mg > 0 ? ' · ' + keyName('cycleWeapon') + ' FOR THE MG' : ''), 2.5);
          tone(100, 0.03, 0.06);
        }
        return false;
      }
      if (!tankFire(c)) return false;
      arms.shells--;
      arms.loading = true;
      c.cannonReadyAt = gameTime + TANK_RELOAD_SECONDS;
      return true;
    }
    function tankMachineGun(c) {
      const arms = tankArms(c);
      if (c.noCoax) {
        if (gameTime - (arms.emptySaidAt ?? -100) > 3) {
          arms.emptySaidAt = gameTime;
          tell('THIS TANK HAS NO MACHINE GUN', 2);
        }
        return false;
      }
      if (gameTime < arms.mgReadyAt || arms.belt <= 0) return false;
      arms.mgReadyAt = gameTime + TANK_MG_INTERVAL;
      arms.belt--;
      // The coaxial gun sits beside the main gun: it points where the barrel does.
      const a = (c.turretA ?? c.a) + randomBetween(-0.018, 0.018),
        side = a + Math.PI / 2,
        origin = {
          x: c.x + Math.cos(a) * 40 + Math.cos(side) * 5,
          y: c.y + Math.sin(a) * 40 + Math.sin(side) * 5,
          altitude: entityElevation(c) + 16,
        };
      bullets.push({
        ...origin,
        ...shotVelocity(origin, null, 900, a),
        life: 0.75,
        dmg: 20,
        enemy: false,
        owner: player,
      });
      playSample('automatic', 0.28, 0.9, c);
      if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude);
      player.lastShotAt = gameTime;
      if (arms.belt % 4 === 0) {
        notifyViolence(player, 'gunfire', player);
        crime(0.075);
      }
      return true;
    }
    function toggleTankWeapon() {
      const c = player.car;
      if (!c || c.type !== 'tank') return false;
      const arms = tankArms(c);
      if (c.noCoax) {
        tell('THIS TANK HAS NO MACHINE GUN · MAIN GUN ONLY', 2);
        return true;
      }
      arms.weapon = arms.weapon === 'mg' ? 'cannon' : 'mg';
      tone(arms.weapon === 'mg' ? 900 : 520, 0.04, 0.08, 'square');
      updateUI();
      return true;
    }
    /* The weapon chip while in a tank (after updateHud, game.js). */
    function tankHud(c) {
      const arms = tankArms(c),
        mg = arms.weapon === 'mg',
        loading = gameTime < (c.cannonReadyAt || 0),
        beltLoading = !!arms.beltReadyAt;
      getElement('weaponSlot').textContent = c.noCoax
        ? 'TANK · MAIN GUN ONLY'
        : 'TANK · ' + keyName('cycleWeapon') + ' SWITCH · RIGHT CLICK MG';
      getElement('weaponName').textContent = mg ? 'COAX MG 7.62' : 'MAIN GUN 120MM';
      getElement('ammo').textContent = mg ? (beltLoading ? '··' : String(arms.belt)) : String(arms.shells).padStart(2, '0');
      getElement('reserve').textContent = mg
        ? '/ ' + arms.mg
        : loading
          ? 'LOADING ' + Math.max(0, c.cannonReadyAt - gameTime).toFixed(1) + ' s'
          : arms.shells
            ? 'READY · MG ' + (c.noCoax ? '—' : arms.belt + arms.mg)
            : 'NO ROUNDS';
      getElement('reloadHint').textContent = (mg ? beltLoading : loading) ? 'LOADING' : keyName('fire');
      getElement('weaponButton').classList.toggle('reloading', mg ? beltLoading : loading);
      const art = getElement('weaponArt');
      if (art.dataset.tankIcon !== (mg ? 'mg' : 'cannon')) {
        art.dataset.tankIcon = mg ? 'mg' : 'cannon';
        if (mg) drawWeaponIcon(art, 4);
        else drawShellIcon(art);
      }
    }
    /* A main-gun round, point forward, for the weapon chip. */
    function drawShellIcon(targetCanvas) {
      const g = targetCanvas.getContext('2d');
      g.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      g.save();
      const scale = Math.min(targetCanvas.width / 140, targetCanvas.height / 50);
      g.translate(targetCanvas.width / 2, targetCanvas.height / 2);
      g.scale(scale, scale);
      g.strokeStyle = '#1b1712';
      g.lineWidth = 1.6;
      // Brass case, then the projectile with its ogive nose.
      g.fillStyle = '#c8a24e';
      g.fillRect(-62, -13, 58, 26);
      g.strokeRect(-62, -13, 58, 26);
      g.fillStyle = '#9c7a33';
      g.fillRect(-66, -15, 5, 30);
      g.fillStyle = '#56604b';
      g.beginPath();
      g.moveTo(-4, -11);
      g.lineTo(34, -11);
      g.quadraticCurveTo(62, -8, 66, 0);
      g.quadraticCurveTo(62, 8, 34, 11);
      g.lineTo(-4, 11);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#b33c2e';
      g.fillRect(8, -11, 5, 22);
      g.fillStyle = '#e8d9a8';
      g.fillRect(-56, -9, 44, 3);
      g.restore();
    }
    /**
     * RETICLE: a ring where the gunner wants the gun (the mouse or the aim) and a
     * pip where the barrel actually points at the same range, projected by the
     * 3D camera every frame. The pip is green once a round is loaded.
     */
    function updateTankReticle() {
      const el = getElement('tankReticle'),
        c = player.car;
      if (!el) return;
      // The Apache's chin gun uses the same ring and pip (apache.js).
      if (isApache(c)) return updateApacheReticle(el, c);
      const show = gameMode === 'play' && !!city3D && c?.type === 'tank' && c.hp > 0;
      el.classList.toggle('hidden', !show);
      if (!show) return;
      const base = entityElevation(c) + 14,
        here = city3D.project(c.x, c.y, base),
        want = c.turretAim ?? aim();
      // Range: to the mouse when aiming with it, otherwise a fixed 320 units.
      let range = 320;
      if (mouse.active && touchAim === null) {
        const ahead = city3D.project(c.x + Math.cos(want) * 100, c.y + Math.sin(want) * 100, base),
          perHundred = Math.hypot(ahead.x - here.x, ahead.y - here.y);
        if (perHundred > 1) range = clamp((100 * Math.hypot(mouse.x - here.x, mouse.y - here.y)) / perHundred, 60, 900);
      }
      const ring = mouse.active && touchAim === null ? { x: mouse.x, y: mouse.y } : city3D.project(c.x + Math.cos(want) * range, c.y + Math.sin(want) * range, base),
        barrel = c.turretA ?? c.a,
        pip = city3D.project(c.x + Math.cos(barrel) * range, c.y + Math.sin(barrel) * range, base),
        ringEl = getElement('tankAimRing'),
        pipEl = getElement('tankBarrelPip');
      ringEl.style.transform = 'translate(' + ring.x.toFixed(0) + 'px,' + ring.y.toFixed(0) + 'px)';
      pipEl.style.transform = 'translate(' + pip.x.toFixed(0) + 'px,' + pip.y.toFixed(0) + 'px)';
      const arms = tankArms(c);
      pipEl.classList.toggle('ready', arms.weapon === 'mg' ? arms.belt > 0 : gameTime >= (c.cannonReadyAt || 0) && arms.shells > 0);
      pipEl.classList.toggle('mg', arms.weapon === 'mg');
    }
    // END SUBSYSTEM: src/armor.js
