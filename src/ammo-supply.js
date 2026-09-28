    // Ammunition supply: no pickups on the street (not even health). Guns come from the gun shops, from the bodies of armed
    // people (one search per body: the weapon and a realistic count of rounds) and from police, SWAT and FBI vehicles (once each).
    /**
     * AMMUNITION SUPPLY
     * Nothing lies on the street to be picked up (health is bought indoors:
     * hospitals, diners, bars, motels). Rounds and weapons are bought or taken:
     *   - the gun shops (SOUTH COAST ARMORY in Northbank, the county OUTFITTERS):
     *     weapons, refills and body armour at the counter (citylife-police.js);
     *   - a body: anyone who carried a gun (police, SWAT, federal agents, soldiers,
     *     gang members and mission gunmen) can be searched once with the action
     *     key while standing over them. Nothing is drawn on the ground: the gun
     *     stays on the body until it is taken. The player takes their weapon with
     *     what is left in it and the spare magazines they carried (BODY_ARMS), in a
     *     short crouch (`player.lootUntil`: the kneel pose, feet still);
     *   - a police vehicle: the first time the player gets into a patrol car, a
     *     SWAT van or an FBI SUV they take what it carries (VEHICLE_ARMS), once per
     *     vehicle (`c.armsTaken`), and are told what they got.
     * Rounds taken on top of an owned weapon go to its reserve, up to ten
     * magazines (RESERVE_MAGS).
     */
    const LOOT_REACH = 22,
      LOOT_CROUCH = 0.6,
      RESERVE_MAGS = 10;
    // What a body carried: weapon index (0 pistol, 1 machine pistol, 4 assault rifle,
    // 5 precision rifle) and spare magazines [min, max]. `loose`: the magazine in the
    // gun is anything from a few rounds to full (a gangster's SMG with what is left).
    const BODY_ARMS = {
      // A patrol officer's duty pistol and the one or two magazines on the belt.
      patrol: { index: 0, mags: [1, 2] },
      road: { index: 0, mags: [1, 2] },
      shield: { index: 0, mags: [1, 2] },
      fed: { index: 1, mags: [1, 2] },
      swat: { index: 4, mags: [2, 3] },
      sniper: { index: 5, mags: [1, 2] },
      soldier: { index: 4, mags: [2, 4] },
      gang: { index: 1, mags: [0, 1], loose: true },
      // Private security and the Vescari men: handguns.
      guard: { index: 0, mags: [0, 1] },
    };
    // What a vehicle carries: [weapon index, reserve it tops up to, given when not owned].
    const VEHICLE_ARMS = {
      // A box of 9 mm in the trunk: four magazines.
      patrol: { name: 'PATROL CAR', stock: [[0, 48]] },
      // Carbine magazines, the entry team's shotgun shells, spare SMG and pistol rounds.
      swat: { name: 'SWAT VAN', stock: [[4, 150, true], [2, 24], [1, 90], [0, 48]] },
      fed: { name: 'FBI SUV', stock: [[1, 90, true], [4, 90], [2, 24], [0, 48]] },
    };
    const ammoSupplyStats = { bodies: 0, vehicles: 0, last: null };
    function bodyArmsKind(p) {
      if (p.police) return p.shield ? 'shield' : BODY_ARMS[p.unit] ? p.unit : 'patrol';
      if (p.military) return 'soldier';
      // The party's host is a guest, not a gunman.
      if (p.boss) return null;
      if (p.faction === 'vescari' || p.faction === 'prestige') return 'guard';
      if (p.faction) return 'gang';
      return null;
    }
    /* What is on a dead body that carried a gun (null when nothing, or searched).
       Worked out once, so the prompt and the take agree. */
    function bodyLoot(p) {
      if (!p || p.hp > 0 || p.looted) return null;
      if (p.loot !== undefined) return p.loot;
      const kind = bodyArmsKind(p),
        arms = kind && BODY_ARMS[kind],
        w = arms && weapons[arms.index];
      if (!w) return (p.loot = null);
      const fired = (p.muzzleAt ?? p.lastShotAt) !== undefined,
        ammo = arms.loose
          ? Math.max(3, Math.round(randomBetween(0.2, 1) * w.clip))
          : fired
            ? Math.max(1, Math.round(randomBetween(0.3, 1) * w.clip))
            : w.clip,
        mags = arms.mags[0] + Math.floor(seededRandom() * (arms.mags[1] - arms.mags[0] + 1));
      return (p.loot = { kind, index: arms.index, ammo, reserve: mags * w.clip });
    }
    /* The searchable body the player stands over, nearest first. */
    function lootableBody() {
      if (gameMode !== 'play' || player.car || player.parachute || player.swimming || player.thrown || player.fall || transitRide)
        return null;
      let best = null,
        bestDistance = LOOT_REACH;
      for (const list of [officers, gangMembers, enemies])
        for (const p of list) {
          if (p.hp > 0 || p.looted || p.hidden) continue;
          const d = distanceBetween(p, player);
          if (d < bestDistance && sameFloor(p, player) && bodyLoot(p)) {
            best = p;
            bestDistance = d;
          }
        }
      return best;
    }
    function lootPrompt() {
      const p = lootableBody(),
        loot = p && bodyLoot(p);
      return loot ? { text: 'TAKE ' + weapons[loot.index].name + ' · ' + (loot.ammo + loot.reserve) + ' RDS', id: 'loot-body' } : null;
    }
    /* Rounds into a weapon: a new one comes loaded as found, an owned one takes them
       in reserve. Returns the rounds that went in. */
    function stockWeapon(index, ammo, reserve) {
      const w = weapons[index];
      if (!w.owned) {
        w.owned = true;
        w.ammo = Math.min(w.clip, ammo);
        w.reserve = Math.min(reserve + Math.max(0, ammo - w.clip), w.clip * RESERVE_MAGS);
        return w.ammo + w.reserve;
      }
      const before = w.reserve;
      w.reserve = Math.min(w.reserve + ammo + reserve, Math.max(before, w.clip * RESERVE_MAGS));
      return w.reserve - before;
    }
    /* The action key over a body (interact): take the gun and the spare magazines. */
    function lootInteract() {
      const p = lootableBody(),
        loot = p && bodyLoot(p);
      if (!loot) return false;
      const w = weapons[loot.index],
        isNew = !w.owned,
        rounds = stockWeapon(loot.index, loot.ammo, loot.reserve);
      p.looted = true;
      player.lootUntil = gameTime + LOOT_CROUCH;
      player.lootFacing = headingBetween(player, p);
      ammoSupplyStats.bodies++;
      ammoSupplyStats.last = { from: loot.kind, weapon: w.name, rounds, isNew };
      if (isNew) selectWeapon(loot.index);
      tell(isNew ? w.name + ' taken · ' + rounds + ' rounds' : w.name + ' · +' + rounds + ' rounds', 3, { id: 'ammo-supply' });
      reloadSound();
      drawWeapon();
      save();
      return true;
    }
    /* The short crouch over a body: the feet stay put (game-update.js). A clock
       that went back (a new game, a load) never leaves the player stuck. */
    function lootCrouching() {
      const left = (player.lootUntil || 0) - gameTime;
      // (gameTime + 0.6) - gameTime can round a hair past 0.6: allow for it.
      return left > 0 && left <= LOOT_CROUCH + 1e-6;
    }
    function vehicleArmsKind(c) {
      if (c.lawUnit === 'swat' || c.lawUnit === 'fed') return c.lawUnit;
      return c.type === 'police' && !c.lawUnit ? 'patrol' : null;
    }
    /* Getting into a police vehicle (enterVehicle): what it carries, once. */
    function takeVehicleArms(c) {
      const kind = vehicleArmsKind(c),
        arms = kind && VEHICLE_ARMS[kind];
      if (!arms || c.armsTaken) return null;
      const got = [];
      for (const [index, target, give] of arms.stock) {
        const w = weapons[index];
        if (!w.owned && !give) continue;
        const rounds = w.owned ? stockWeapon(index, 0, Math.max(0, target - w.reserve)) : stockWeapon(index, w.clip, target - w.clip);
        if (rounds > 0) got.push(w.name + ' +' + rounds);
      }
      if (!got.length) return null;
      c.armsTaken = true;
      ammoSupplyStats.vehicles++;
      ammoSupplyStats.last = { from: kind, got };
      tell(arms.name + ' · ' + got.join(' · '), 4, { id: 'ammo-supply' });
      drawWeapon();
      save();
      return got;
    }
    function ammoSupplyReport() {
      const body = lootableBody(),
        loot = body && bodyLoot(body);
      return {
        weapons: weapons.map((w, i) => ({ i, name: w.name, owned: !!w.owned, ammo: w.ammo, reserve: w.reserve })),
        body: loot ? { kind: loot.kind, weapon: weapons[loot.index].name, ammo: loot.ammo, reserve: loot.reserve, d: Math.round(distanceBetween(body, player)) } : null,
        crouching: lootCrouching(),
        taken: { ...ammoSupplyStats },
        shops: PLACES.filter((p) => p.kind === 'guns').map((p) => ({ name: p.name, x: Math.round(p.door.x), y: Math.round(p.door.y) })),
      };
    }
    function ammoSupplyConsole() {
      return {
        // The arsenal's rounds, the body in reach and what was taken.
        ammoSupply: () => ammoSupplyReport(),
        // Set one weapon's ownership and rounds (tests): index 0 pistol ... 5 precision rifle.
        setAmmo(index = 0, ammo = 0, reserve = 0, owned = true) {
          const w = weapons[index];
          if (!w) return null;
          w.owned = index === 0 || !!owned;
          w.ammo = clamp(Math.round(ammo), 0, w.clip);
          w.reserve = Math.max(0, Math.round(reserve));
          if (!w.owned && selectedWeaponIndex === index) selectedWeaponIndex = FISTS_INDEX;
          drawWeapon();
          return { name: w.name, owned: w.owned, ammo: w.ammo, reserve: w.reserve };
        },
        // A dead armed person `dx`, `dy` from the player: 'patrol', 'swat', 'fed',
        // 'soldier' (officers) or 'gang', 'guard' (gang members). Returns their loot.
        armedBody(kind = 'gang', dx = 12, dy = 0) {
          const x = player.x + dx,
            y = player.y + dy;
          let p;
          if (kind === 'gang' || kind === 'guard') {
            p = { x, y, a: 0, hp: 0, color: '#b66951', faction: kind === 'gang' ? 'harbor' : 'prestige', name: 'HARBOR KINGS', timer: 1, walk: 0 };
            gangMembers.push(p);
          } else {
            if (!BODY_ARMS[kind]) throw Error('Unknown body kind ' + kind);
            p = makeOfficer(x, y, 0, kind);
            p.hp = 0;
            officers.push(p);
          }
          p.deadTime = gameTime;
          const loot = bodyLoot(p);
          return loot && { ...loot, weapon: weapons[loot.index].name };
        },
        // A live Harbor Kings gunman `dx`, `dy` from the player, out for them for
        // `seconds` (the ON-SCREEN RULE test, combat-rules.js; shotLog source
        // 'harbor-gunman'). Returns their index in the gang list.
        hostileGunman(dx = 0, dy = -120, seconds = 30) {
          gangMembers.push({
            x: player.x + dx,
            y: player.y + dy,
            a: 0,
            hp: 80,
            color: '#b66951',
            faction: 'harbor',
            name: 'HARBOR KINGS',
            missionTag: 'gunman',
            home: { x: player.x + dx, y: player.y + dy },
            timer: 0.5,
            walk: 0,
            playerThreatUntil: gameTime + seconds,
          });
          return gangMembers.length - 1;
        },
        // An empty, unlocked police vehicle 70 units east: 'patrol', 'swat' or 'fed';
        // `board` takes the wheel at once (enterVehicle, as the action key does).
        parkLawVehicle(kind = 'swat', board = false) {
          const build = { patrol: ['police'], swat: ['van', '#1b2433'], fed: ['suv', '#121417'] }[kind];
          if (!build) throw Error('Unknown law vehicle ' + kind);
          if (player.car) exitCar();
          const c = spawnClearCar(build[0], player.x + 70, player.y, 0, false, build[1]);
          Object.assign(c, { lawUnit: kind === 'patrol' ? null : kind, crewLost: true, locked: false, occupied: false });
          if (board) enterVehicle(c);
          return { id: c.id, type: c.type, lawUnit: c.lawUnit, aboard: player.car === c, armsTaken: !!c.armsTaken };
        },
      };
    }
