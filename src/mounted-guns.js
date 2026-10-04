    // Mounted guns the player fires from Fort Sentinel's vehicles: the LAV-8's 25 mm cannon and coax MG,
    // the gun jeep's ring-mounted .50 cal and the Black Hawk's two M240H door guns (mountedGunKind,
    // updatePlayerMountedGun, mountedGunFire, mountedGunHud, the reticle and the console).
    /**
     * MOUNTED GUNS (player only; the tank keeps armor.js, the Apache apache.js)
     *   apc   the LAV-8 carrier (every one has the turret): an M242-class 25 mm
     *         chain gun, 200 rounds a minute, 210 rounds in the ready boxes and 420
     *         stowed, high-explosive rounds that burst where they strike
     *         (`heavyRound`, apacheRoundImpact); a coaxial 7.62 mm MG beside it,
     *         about 700 a minute from 400-round belts (1,600 in all). The turret
     *         traverses at 60 deg/s. The weapon switch swaps them; the right mouse
     *         button always fires the coax, as in the tank.
     *   jeep  a gun jeep (`c.gunner`: the ring mount on the roof): an M2 .50 cal,
     *         about 550 a minute from 100-round boxes (600 in all), the ring swung
     *         by hand at up to 90 deg/s.
     *   heli  a Black Hawk (a military helicopter that is not the Apache or a
     *         police unit): two M240H door guns, one each side, about 750 a minute,
     *         200-round belts and 600 more per gun. Each swings only through its
     *         own window (DOOR_GUN_ARC off the nose, never ahead or astern); the gun
     *         on the side of the aim fires down to the ground point under the
     *         mouse, the other one rests.
     * The driver fires the gun (a top-down simplification, as in the tank): the
     * mouse (or the touch aim, the pad's aim, or the drive-by auto-aim) lays it,
     * F / click / the touch FIRE button fires where the barrel points, not where
     * the mouse is; the reticle shows both. An empty belt is changed by itself
     * after `reload` seconds (the reload key changes a part-used one). Rounds are
     * ordinary player bullets (updateBullets: people, vehicles, walls; a tank
     * shrugs them off); every few rounds count as gunfire (notifyViolence, crime).
     * Ammunition rides on the vehicle (`c.arms`), so a second visit finds what was
     * left.
     */
    const MOUNTED_DEG = Math.PI / 180,
      DOOR_GUN_ARC = [20 * MOUNTED_DEG, 160 * MOUNTED_DEG],
      DOOR_GUN_REST = 25 * MOUNTED_DEG,
      // The door guns' mounts on the Black Hawk (helicopter3d-equipment.js, real size):
      // ahead of the centre, out from the centre line, over the skids.
      DOOR_GUN_MOUNT = { x: 21, z: 9.6, y: 15.4 },
      MOUNTED_GUNS = {
        apc: {
          title: 'LAV-8',
          traverse: 60 * MOUNTED_DEG,
          accel: 2.4,
          // The turret ring: units ahead of the hull's centre (base3d-vehicles.js, at model scale).
          pivot: 1,
          weapons: [
            {
              id: 'cannon', name: '25 MM CANNON', icon: 'shell', interval: 0.3, belt: 210, stowed: 420, reload: 14,
              speed: 1000, life: 1, dmg: 40, heavy: true, muzzle: 26, side: 0, height: 19, spread: 0.006,
              recoil: 0.16, kick: 0.9, shake: 1.2, heatEvery: 2, tracerEvery: 1, sound: 'rifle', volume: 0.42, pitch: [0.47, 0.52], boom: true,
            },
            {
              id: 'coax', name: 'COAX MG 7.62', icon: 'mg', interval: 0.085, belt: 400, stowed: 1200, reload: 6,
              speed: 900, life: 0.75, dmg: 20, heavy: false, muzzle: 19, side: 2.6, height: 19, spread: 0.016,
              recoil: 0, kick: 0.12, shake: 0.4, heatEvery: 4, tracerEvery: 5, sound: 'automatic', volume: 0.28, pitch: [0.88, 0.94], boom: false,
            },
          ],
        },
        jeep: {
          title: 'GUN JEEP',
          traverse: 90 * MOUNTED_DEG,
          accel: 4,
          pivot: -2.9,
          weapons: [
            {
              id: 'hmg', name: 'M2 .50 CAL', icon: 'mg', interval: 0.109, belt: 100, stowed: 500, reload: 6,
              speed: 950, life: 0.8, dmg: 34, heavy: false, muzzle: 10.5, side: 0, height: 17.5, spread: 0.012,
              recoil: 0.07, kick: 0.35, shake: 0.7, heatEvery: 3, tracerEvery: 5, sound: 'rifle', volume: 0.34, pitch: [0.64, 0.7], boom: false,
            },
          ],
        },
        heli: {
          title: 'BLACK HAWK',
          traverse: 150 * MOUNTED_DEG,
          door: true,
          weapons: [
            {
              id: 'door', name: 'M240H DOOR GUN', icon: 'mg', interval: 0.08, belt: 200, stowed: 600, reload: 5,
              speed: 900, life: 0, dmg: 20, heavy: false, muzzle: 5, side: 0, height: 0, spread: 0.02,
              recoil: 0, kick: 0.12, shake: 0.5, heatEvery: 4, tracerEvery: 5, sound: 'automatic', volume: 0.3, pitch: [0.9, 0.97], boom: false,
            },
          ],
        },
      };
    // Tests and the console: a fixed aim point (map x, y) instead of the mouse, or null.
    let mountedAimOverride = null;
    const mountedGunTest = { car: null, person: null };
    /* Which mounted gun a vehicle carries, or null. */
    function mountedGunKind(c) {
      if (!c || c.hp <= 0) return null;
      if (c.type === 'apc') return 'apc';
      if (c.type === 'jeep' && c.gunner) return 'jeep';
      if (c.type === 'helicopter' && c.military && !c.airUnit && !isApache(c)) return 'heli';
      return null;
    }
    function mountedArms(c, kind = mountedGunKind(c)) {
      if (!c.arms || c.arms.mounted !== kind) {
        const spec = MOUNTED_GUNS[kind],
          // The door guns are one gun type on two mounts (left, right), each with its own belt.
          slots = spec.door ? [spec.weapons[0], spec.weapons[0]] : spec.weapons;
        c.arms = {
          mounted: kind,
          weapon: 0,
          guns: slots.map((w) => ({ belt: w.belt, stowed: w.stowed, nextAt: 0, loadAt: 0, fired: 0 })),
          // The door guns' angles off the nose, left (negative) and right.
          rel: spec.door ? [-DOOR_GUN_REST, DOOR_GUN_REST] : null,
          side: 1,
          emptySaidAt: -100,
          shots: 0,
        };
      }
      return c.arms;
    }
    /* The slot that fires now: the selected weapon, or the door gun on the aim's side. */
    function mountedSlot(c, arms) {
      return MOUNTED_GUNS[arms.mounted].door ? (arms.side > 0 ? 1 : 0) : arms.weapon;
    }
    function mountedWeapon(arms, slot) {
      const spec = MOUNTED_GUNS[arms.mounted];
      return spec.door ? spec.weapons[0] : spec.weapons[slot];
    }
    /* Ground vehicles: the heading the gunner wants, and the range for the reticle. */
    function mountedGroundAim(c) {
      if (mountedAimOverride) return { a: Math.atan2(mountedAimOverride.y - c.y, mountedAimOverride.x - c.x), range: Math.hypot(mountedAimOverride.x - c.x, mountedAimOverride.y - c.y) };
      return { a: aim(), range: 0 };
    }
    /* The Black Hawk: a ground point under the mouse (or along the aim), like the Apache's. */
    function mountedHeliAim(c) {
      let p = null;
      if (mountedAimOverride) p = mountedAimOverride;
      else if (mouse.active && touchAim === null && city3D) p = city3D.groundPoint(mouse.x, mouse.y, terrainHeight(c.x, c.y) + 4);
      let a;
      if (p) a = Math.atan2(p.y - c.y, p.x - c.x);
      else a = aim();
      const range = clamp(p ? Math.hypot(p.x - c.x, p.y - c.y) : 340, 40, 1000),
        x = c.x + Math.cos(a) * range,
        y = c.y + Math.sin(a) * range;
      return { x, y, altitude: terrainHeight(x, y) + 4, range, a };
    }
    /* Per frame while the player commands an armed vehicle (after updatePlayerArmor). */
    function updatePlayerMountedGun(deltaSeconds) {
      const c = player.car,
        kind = mountedGunKind(c);
      if (!kind) return;
      const spec = MOUNTED_GUNS[kind],
        arms = mountedArms(c, kind);
      if (spec.door) {
        const want = mountedHeliAim(c),
          rel = normalizeAngle(want.a - c.a);
        c.gunAim = want;
        c.turretAim = want.a;
        arms.side = rel >= 0 ? 1 : -1;
        // The gun on the aim's side swings to it (held at its stops); the other rests.
        for (let i = 0; i < 2; i++) {
          const s = i ? 1 : -1,
            target = s === arms.side ? s * clamp(Math.abs(rel), DOOR_GUN_ARC[0], DOOR_GUN_ARC[1]) : s * DOOR_GUN_REST,
            step = spec.traverse * deltaSeconds;
          arms.rel[i] += clamp(target - arms.rel[i], -step, step);
        }
        c.turretA = normalizeAngle(c.a + arms.rel[arms.side > 0 ? 1 : 0]);
      } else {
        const want = mountedGroundAim(c);
        c.turretAim = want.a;
        c.gunAim = want.range ? want : null;
        traverseTurret(c, want.a, deltaSeconds, spec.traverse, spec.accel);
        // The right mouse button always fires the coax (as in the tank).
        if (kind === 'apc' && mouse.alt && gameMode === 'play') mountedGunFire(c, 1);
      }
      // Belts: an empty one is changed by itself while rounds are stowed.
      for (let i = 0; i < arms.guns.length; i++) {
        const g = arms.guns[i],
          w = mountedWeapon(arms, i);
        if (!g.belt && g.stowed > 0 && !g.loadAt) mountedStartLoad(g, w);
        if (g.loadAt && gameTime >= g.loadAt) {
          const load = Math.min(w.belt - g.belt, g.stowed);
          g.belt += load;
          g.stowed -= load;
          g.loadAt = 0;
          tone(420, 0.05, 0.1, 'square', 300);
        }
      }
    }
    function mountedStartLoad(g, w) {
      g.loadAt = gameTime + w.reload;
      reloadSound();
    }
    /* The reload key: change a part-used belt (startReload, game.js). True when it was ours. */
    function mountedGunReload() {
      const c = player.car,
        kind = mountedGunKind(c);
      if (!kind) return false;
      const arms = mountedArms(c, kind),
        slot = mountedSlot(c, arms),
        g = arms.guns[slot],
        w = mountedWeapon(arms, slot);
      if (!g.loadAt && g.stowed > 0 && g.belt < w.belt) mountedStartLoad(g, w);
      return true;
    }
    /* Fire (shoot(), game.js, every frame the trigger is held). `slot` overrides the selection. */
    function mountedGunFire(c, slot) {
      const kind = mountedGunKind(c);
      if (!kind) return false;
      const spec = MOUNTED_GUNS[kind],
        arms = mountedArms(c, kind);
      if (slot === undefined) slot = mountedSlot(c, arms);
      const g = arms.guns[slot],
        w = mountedWeapon(arms, slot);
      if (gameTime < g.nextAt || g.loadAt) return false;
      if (g.belt <= 0) {
        if (gameTime - arms.emptySaidAt > 3) {
          arms.emptySaidAt = gameTime;
          tell(w.name + ' · OUT OF AMMUNITION', 2.5);
          tone(100, 0.03, 0.06);
        }
        return false;
      }
      g.nextAt = gameTime + w.interval;
      g.belt--;
      g.fired++;
      arms.shots++;
      const a = (c.turretA ?? c.a) + randomBetween(-w.spread, w.spread),
        elevation = entityElevation(c),
        tracer = g.fired % w.tracerEvery === 0 ? 0.024 : undefined;
      let origin, velocity, life, flashBase, flashHeight;
      if (spec.door) {
        // From the mount on that side, down to the ground point at the aim's range.
        const s = slot ? 1 : -1,
          side = c.a + Math.PI / 2,
          mx = c.x + Math.cos(c.a) * DOOR_GUN_MOUNT.x + Math.cos(side) * DOOR_GUN_MOUNT.z * s,
          my = c.y + Math.sin(c.a) * DOOR_GUN_MOUNT.x + Math.sin(side) * DOOR_GUN_MOUNT.z * s,
          gun = elevation + DOOR_GUN_MOUNT.y,
          aimAt = c.gunAim || mountedHeliAim(c),
          reach = Math.max(40, Math.hypot(aimAt.x - mx, aimAt.y - my)) + randomBetween(-8, 8),
          target = { x: mx + Math.cos(a) * reach, y: my + Math.sin(a) * reach, altitude: aimAt.altitude };
        // Bullets are drawn 9 units over their altitude (render3d-frame.js tracers).
        origin = { x: mx + Math.cos(a) * w.muzzle, y: my + Math.sin(a) * w.muzzle, altitude: gun - 9 };
        velocity = shotVelocity(origin, target, w.speed, a);
        life = combatDistance(origin, target) / w.speed + 0.25;
        // The flash at the gun, the brass falling to the ground below.
        flashBase = terrainHeight(origin.x, origin.y);
        flashHeight = gun - flashBase;
      } else {
        const px = c.x + Math.cos(c.a) * spec.pivot,
          py = c.y + Math.sin(c.a) * spec.pivot,
          side = a + Math.PI / 2;
        origin = {
          x: px + Math.cos(a) * w.muzzle + Math.cos(side) * w.side,
          y: py + Math.sin(a) * w.muzzle + Math.sin(side) * w.side,
          altitude: elevation + w.height - 9,
        };
        velocity = shotVelocity(origin, null, w.speed, a);
        life = w.life;
        // The brass lands on the hull's roof, nine units under the muzzle.
        flashBase = origin.altitude;
        flashHeight = 9;
      }
      bullets.push({ ...origin, ...velocity, life, dmg: w.dmg, enemy: false, owner: player, tracer, heavyRound: w.heavy || undefined });
      playSample(w.sound, w.volume, sfxRandom(w.pitch[0], w.pitch[1]), c);
      if (w.boom) playSample('explosion', 0.07, sfxRandom(2.3, 2.6), c);
      if (city3D) city3D.fire(origin.x, origin.y, a, false, flashBase, flashHeight);
      if (w.recoil) c.cannonRecoilUntil = gameTime + w.recoil;
      kickCamera(a + Math.PI, w.kick);
      shake = Math.max(shake, w.shake);
      player.lastShotAt = gameTime;
      if (g.fired % w.heatEvery === 0) {
        notifyViolence(player, 'gunfire', player);
        crime(0.075);
      }
      return true;
    }
    /* The weapon switch (cycleWeapon, the weapon chip): the LAV's cannon and coax. True when it was ours. */
    function toggleMountedWeapon() {
      const c = player.car,
        kind = mountedGunKind(c);
      if (!kind) return false;
      const spec = MOUNTED_GUNS[kind],
        arms = mountedArms(c, kind);
      if (spec.weapons.length < 2) {
        tell(spec.title + ' · ' + spec.weapons[0].name + (spec.door ? ' · THE GUN ON THE SIDE YOU AIM' : ' ONLY'), 2);
        return true;
      }
      arms.weapon = (arms.weapon + 1) % spec.weapons.length;
      tone(arms.weapon ? 900 : 520, 0.04, 0.08, 'square');
      updateUI();
      return true;
    }
    /* Boarding: the controls (enterVehicle, game.js). */
    function mountedGunBoarded(c) {
      const kind = mountedGunKind(c),
        spec = MOUNTED_GUNS[kind];
      mountedArms(c, kind);
      const move =
        kind === 'heli'
          ? keyName('ascend') + ' rise · ' + keyName('descend') + ' descend · ' + moveKeysName() + ' fly'
          : keyName('forward') + '/' + keyName('back') + ' drive · ' + keyName('left') + '/' + keyName('right') + ' steer';
      const guns =
        kind === 'apc'
          ? 'the mouse lays the turret · ' + keyName('fire') + ' fire · ' + keyName('cycleWeapon') + ' 25 MM / COAX · right click COAX'
          : kind === 'jeep'
            ? 'the mouse swings the .50 cal · ' + keyName('fire') + ' fire'
            : 'aim to a side · ' + keyName('fire') + ' DOOR GUN';
      tell(spec.title + ' · ' + move + ' · ' + guns, 7);
    }
    /* God mode's refill (god-panel.js): full belts and stowage. */
    function mountedGunRearm(c) {
      const kind = mountedGunKind(c);
      if (!kind) return;
      const arms = mountedArms(c, kind);
      for (let i = 0; i < arms.guns.length; i++) {
        const w = mountedWeapon(arms, i),
          g = arms.guns[i];
        g.belt = w.belt;
        g.stowed = w.stowed;
        g.loadAt = g.nextAt = 0;
      }
    }
    /* The weapon chip (after updateHud, game.js). */
    function mountedGunHud(c) {
      const kind = mountedGunKind(c),
        spec = MOUNTED_GUNS[kind],
        arms = mountedArms(c, kind),
        slot = mountedSlot(c, arms),
        g = arms.guns[slot],
        w = mountedWeapon(arms, slot),
        loading = !!g.loadAt;
      getElement('weaponSlot').textContent =
        spec.title + (kind === 'apc' ? ' · ' + keyName('cycleWeapon') + ' SWITCH · RIGHT CLICK COAX' : spec.door ? ' · ' + (slot ? 'RIGHT' : 'LEFT') + ' DOOR' : ' · RING MOUNT');
      getElement('weaponName').textContent = w.name;
      getElement('ammo').textContent = loading ? '··' : String(g.belt).padStart(w.belt >= 100 ? 3 : 2, '0');
      getElement('reserve').textContent = loading ? 'LOADING ' + Math.max(0, g.loadAt - gameTime).toFixed(1) + ' s' : '/ ' + g.stowed;
      getElement('reloadHint').textContent = loading ? 'LOADING' : keyName('fire');
      getElement('weaponButton').classList.toggle('reloading', loading);
      const art = getElement('weaponArt'),
        icon = 'mounted-' + w.icon;
      if (art.dataset.tankIcon !== icon) {
        art.dataset.tankIcon = icon;
        if (w.icon === 'shell') drawShellIcon(art);
        else drawWeaponIcon(art, 4);
      }
    }
    /* The tank's ring and pip (armor.js updateTankReticle): where the gunner wants the gun, where it points. */
    function updateMountedReticle(el, c) {
      const show = gameMode === 'play' && !!city3D;
      el.classList.toggle('hidden', !show);
      if (!show) return;
      const arms = mountedArms(c),
        slot = mountedSlot(c, arms),
        w = mountedWeapon(arms, slot),
        barrel = c.turretA ?? c.a,
        ringEl = getElement('tankAimRing'),
        pipEl = getElement('tankBarrelPip');
      let ring, pip;
      if (MOUNTED_GUNS[arms.mounted].door) {
        const at = c.gunAim || mountedHeliAim(c);
        ring = city3D.project(at.x, at.y, at.altitude);
        pip = city3D.project(c.x + Math.cos(barrel) * at.range, c.y + Math.sin(barrel) * at.range, at.altitude);
      } else {
        const base = entityElevation(c) + w.height - 4,
          here = city3D.project(c.x, c.y, base),
          want = c.turretAim ?? c.a,
          mouseAim = mouse.active && touchAim === null && !mountedAimOverride;
        let range = c.gunAim?.range || 320;
        if (mouseAim) {
          const ahead = city3D.project(c.x + Math.cos(want) * 100, c.y + Math.sin(want) * 100, base),
            perHundred = Math.hypot(ahead.x - here.x, ahead.y - here.y);
          if (perHundred > 1) range = clamp((100 * Math.hypot(mouse.x - here.x, mouse.y - here.y)) / perHundred, 60, 900);
        }
        ring = mouseAim ? { x: mouse.x, y: mouse.y } : city3D.project(c.x + Math.cos(want) * range, c.y + Math.sin(want) * range, base);
        pip = city3D.project(c.x + Math.cos(barrel) * range, c.y + Math.sin(barrel) * range, base);
      }
      ringEl.style.transform = 'translate(' + ring.x.toFixed(0) + 'px,' + ring.y.toFixed(0) + 'px)';
      pipEl.style.transform = 'translate(' + pip.x.toFixed(0) + 'px,' + pip.y.toFixed(0) + 'px)';
      const g = arms.guns[slot];
      pipEl.classList.toggle('ready', g.belt > 0 && !g.loadAt);
      pipEl.classList.toggle('mg', w.icon === 'mg');
    }
    /* DeadEndCity.mountedGuns(): the gun of the vehicle the player commands, and the test targets. */
    function mountedGunReport() {
      const c = player.car,
        kind = mountedGunKind(c),
        deg = (r) => Math.round((r * 180) / Math.PI),
        target = (t) => (t ? { hp: Math.round(t.hp), x: Math.round(t.x), y: Math.round(t.y), d: Math.round(distanceBetween(t, player)) } : null),
        out = { kind, targets: { car: target(mountedGunTest.car), person: target(mountedGunTest.person) } };
      if (!kind) return out;
      const arms = mountedArms(c, kind),
        slot = mountedSlot(c, arms),
        w = mountedWeapon(arms, slot);
      return {
        ...out,
        title: MOUNTED_GUNS[kind].title,
        weapon: w.id,
        name: w.name,
        slot,
        x: Math.round(c.x),
        y: Math.round(c.y),
        hull: deg(c.a),
        // The barrel off the nose, and the aim off the nose (degrees).
        turret: deg(normalizeAngle((c.turretA ?? c.a) - c.a)),
        aim: deg(normalizeAngle((c.turretAim ?? c.a) - c.a)),
        laidError: deg(Math.abs(normalizeAngle((c.turretA ?? c.a) - (c.turretAim ?? c.a)))),
        doors: arms.rel ? arms.rel.map(deg) : null,
        shots: arms.shots,
        guns: arms.guns.map((g, i) => ({ id: mountedWeapon(arms, i).id, belt: g.belt, stowed: g.stowed, loading: g.loadAt ? +(g.loadAt - gameTime).toFixed(1) : 0 })),
        override: mountedAimOverride,
        // The ring and pip as drawn (armor.js updateTankReticle).
        reticle: {
          shown: !getElement('tankReticle').classList.contains('hidden'),
          ring: getElement('tankAimRing').style.transform,
          pip: getElement('tankBarrelPip').style.transform,
          ready: getElement('tankBarrelPip').classList.contains('ready'),
        },
      };
    }
    function mountedGunConsole() {
      return {
        mountedGuns: () => mountedGunReport(),
        // Spawn an armed military vehicle beside the player and take the controls:
        // 'apc' (LAV-8), 'jeep' (gun jeep) or 'heli' (Black Hawk). Returns mountedGuns().
        driveArmed(kind = 'apc', headingRadians = player.a) {
          if (!MOUNTED_GUNS[kind]) throw Error('Unknown armed vehicle ' + kind);
          if (player.car) exitCar();
          const type = kind === 'heli' ? 'helicopter' : kind,
            c = spawnClearCar(type, player.x + 60, player.y, headingRadians, false, VEHICLE_DEFINITIONS[type].color);
          if (!c) throw Error('No room for the ' + type);
          c.military = true;
          c.turretA = c.a;
          if (kind === 'jeep') c.gunner = true;
          if (kind === 'heli') c.color = '#4d5641';
          c.authorized = true;
          enterVehicle(c);
          return mountedGunReport();
        },
        // Fix the aim at a map point as the mouse would; no arguments hands it back.
        mountedGunAim(x, y) {
          mountedAimOverride = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
          return mountedGunReport();
        },
        // Test targets `distance` units from the player's vehicle at `deg` off its nose:
        // an empty sedan there, and a bystander 30 units nearer. Returns mountedGuns().targets.
        mountedGunTargets(distance = 220, deg = 0) {
          const c = player.car || player,
            a = (c.a || 0) + deg * MOUNTED_DEG,
            x = c.x + Math.cos(a) * distance,
            y = c.y + Math.sin(a) * distance;
          mountedGunTest.car = spawnClearCar('sedan', x, y, a + Math.PI / 2, false);
          const p = { x: c.x + Math.cos(a) * (distance - 30), y: c.y + Math.sin(a) * (distance - 30), a: a + Math.PI, dir: a + Math.PI, hp: 100, flee: 0, timer: 999, walk: 0, state: 'idle', stateTime: 900 };
          dressPerson(p, 'casual');
          pedestrians.push(p);
          mountedGunTest.person = p;
          return mountedGunReport().targets;
        },
      };
    }
