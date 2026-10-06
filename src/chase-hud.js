    // Chase HUD: the reticle in the middle of the screen in the chase view (chase-view.css) and the hidden
    // cursor while the pointer is captured; drawn every frame after the world (game-loop.js runFrame).
    /**
     * CHASE RETICLE
     * On foot with a gun in the chase view the reticle marks the aim (chase-camera.js
     * chaseAimPoint): a dot, a ring round it while aiming over the shoulder, both red
     * over a person or a vehicle a shot would hit, and a short flash of the ring when a
     * shot is fired at one. Without a captured pointer (CURSOR LOOK) it follows the
     * cursor, which is the aim then. Class and style writes happen only on a change.
     */
    const chaseReticle = { shown: false, aiming: false, target: false, hit: false, x: NaN, y: NaN, locked: false, shotAt: -1, hitUntil: 0 },
      chaseReticleAim = { x: 0, y: 0, z: 0, hit: null, t: 0 };
    function chaseReticleWanted() {
      if (gameMode !== 'play' || !chaseCameraLive() || !chaseCam.ready) return false;
      if (player.car || player.parachute || player.swimming || player.coaster || transitRide || taxiRide) return false;
      if (player.carjack || player.fall || player.thrown || player.hidden) return false;
      const w = currentWeapon();
      return !!w && !w.melee && weaponIsEquipped(selectedWeaponIndex);
    }
    function setChaseReticleClass(el, name, on) {
      if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
    }
    function updateChaseReticle() {
      const el = getElement('chaseReticle');
      if (!el) return;
      // Menus and overlays (pause, map, settings, shops) get the cursor back.
      if (chaseCam.locked && gameMode !== 'play') releaseChasePointer();
      const locked = !!chaseCam.locked;
      if (locked !== chaseReticle.locked) {
        chaseReticle.locked = locked;
        document.body.classList.toggle('chase-locked', locked);
      }
      const shown = chaseReticleWanted();
      if (shown !== chaseReticle.shown) {
        chaseReticle.shown = shown;
        setChaseReticleClass(el, 'hidden', !shown);
      }
      if (!shown) return;
      // Where it stands: the middle of the screen, or the cursor when the pointer is free.
      const cursor = !locked && mouse.active && !touchModeOn(),
        x = cursor ? mouse.x : viewportWidth * CHASE_RETICLE.x,
        y = cursor ? mouse.y : viewportHeight * CHASE_RETICLE.y;
      if (x !== chaseReticle.x || y !== chaseReticle.y) {
        chaseReticle.x = x;
        chaseReticle.y = y;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      }
      const aiming = chaseCam.aimBlend > 0.4;
      if (aiming !== chaseReticle.aiming) {
        chaseReticle.aiming = aiming;
        setChaseReticleClass(el, 'aiming', aiming);
      }
      const p = chaseAimPoint(chaseReticleAim, x, y),
        target = !!p.hit && p.hit.hp > 0;
      if (target !== chaseReticle.target) {
        chaseReticle.target = target;
        setChaseReticleClass(el, 'on-target', target);
      }
      // A shot fired at a target flashes the ring.
      const shotAt = player.lastShotAt ?? -1;
      if (shotAt !== chaseReticle.shotAt) {
        chaseReticle.shotAt = shotAt;
        if (target) chaseReticle.hitUntil = gameTime + 0.09;
      }
      const hit = gameTime < chaseReticle.hitUntil;
      if (hit !== chaseReticle.hit) {
        chaseReticle.hit = hit;
        setChaseReticleClass(el, 'hit', hit);
      }
    }
