    // Vehicle trunks and the lockpick at work: a trunk with something in it (`c.trunkLoot`, set by a mission), picked
    // pin by pin by holding interact with the lockpick in hand, crouched at the bumper; a locked driver's door the same way.
    /**
     * TRUNKS AND LOCKS
     * Vehicle fields (declared in makeCar, game-car-spawn.js):
     *   trunkLoot    what is in the trunk ({ label: 'UNIFORM AND ID' }); set by a mission, null/undefined: nothing to pick
     *   trunkOpen    true once picked (or `openTrunk`); the renderer swings the lid up (damage3d-bodies.js)
     *   trunkOpenAt  the gameTime it opened (the lid's swing)
     *   trunkPick    seconds of work done on the trunk lock (0..TRUNK_PICK_SECONDS)
     *   lockPick     the same for a locked driver's door (0..DOOR_PICK_SECONDS)
     *   pickAt       the gameTime of the last work on either lock: progress is kept LOCK_PICK_KEEP s, then lost
     * The work: on foot with the lockpick in hand (arsenal.js lockpickEquipped), at `trunkPoint` of a stopped vehicle
     * whose trunk holds something and is shut, or at the driver's door of a locked one (carjack.js vehicleIsLocked),
     * the interact action held (actionHeld) steps the player to the lock, kneels him there (the loot crouch,
     * ammo-supply.js `player.lootUntil`) and works the pins: a soft click per pin set, the latch at the last.
     * Releasing or moving off pauses it. Each pin set is a small theft through `crime(amount, 'theft')`: with no
     * stars it only counts when the police see it or somebody watching phones it in (witnesses.js, the crowd's own
     * sight), never by distance alone. Missions poll `trunkOpen`, `trunkPickProgress(c)` and `trunkPicking(c)`.
     */
    const TRUNK_PICK_SECONDS = 5,
      TRUNK_PINS = 5,
      DOOR_PICK_SECONDS = 3.5,
      DOOR_PINS = 3,
      // From the lock's kneeling spot (trunkPoint, driverDoor), with a margin before the prompt goes again (withinRange).
      TRUNK_REACH = 16,
      DOOR_REACH = 14,
      // The kneeling spot behind the rear bumper; how close the step in brings the player.
      TRUNK_STAND = 4.5,
      PICK_SETTLED = 1.2,
      PICK_STEP_SPEED = 36,
      // Work left off is kept this long.
      LOCK_PICK_KEEP = 10,
      // A vehicle rolling faster than this cannot be worked on.
      PICK_STOPPED = 3 * KMH,
      // The heat of each pin set (a whole trunk 0.35, a door 0.24: under a punch on a police officer).
      TRUNK_PIN_HEAT = 0.07,
      DOOR_PIN_HEAT = 0.08;
    const lockpickWork = { car: null, kind: null, active: false, at: -10, rakeAt: 0, stats: { pins: 0, trunks: 0, doors: 0 } };
    const pickSpot = { x: 0, y: 0 };
    /* The kneeling spot at a vehicle's trunk: on the centre line just behind the rear bumper. */
    function trunkPoint(c, out = { x: 0, y: 0 }) {
      const back = vehicleSpec(c).l / 2 + TRUNK_STAND;
      out.x = c.x - Math.cos(c.a) * back;
      out.y = c.y - Math.sin(c.a) * back;
      return out;
    }
    /* At the driver's door (carjack.js driverDoor), without the object it makes. */
    function doorPickPoint(c, out) {
      const a = c.a - Math.PI / 2,
        out2 = vehicleSpec(c).w / 2 + 6;
      out.x = c.x + Math.cos(a) * out2;
      out.y = c.y + Math.sin(a) * out2;
      return out;
    }
    function lockpickFooting() {
      return (
        gameMode === 'play' &&
        !player.car &&
        player.hp > 0 &&
        !player.parachute &&
        !player.swimming &&
        !player.thrown &&
        !player.fall &&
        !player.climbing &&
        !player.carjack &&
        !player.coaster &&
        !player.roof &&
        !player.buildingRoof &&
        !transitRide &&
        !taxiRide
      );
    }
    function vehicleStopped(c) {
      return Math.abs(c.vx || 0) + Math.abs(c.vy || 0) < PICK_STOPPED && Math.abs(c.speed || 0) < PICK_STOPPED;
    }
    /* Progress on one of a vehicle's locks (seconds), forgotten LOCK_PICK_KEEP s after the last touch. */
    function lockWorkDone(c, kind) {
      if (!(c.pickAt <= gameTime) || gameTime - c.pickAt > LOCK_PICK_KEEP) {
        if (c.trunkPick) c.trunkPick = 0;
        if (c.lockPick) c.lockPick = 0;
        return 0;
      }
      return (kind === 'trunk' ? c.trunkPick : c.lockPick) || 0;
    }
    /* The shut trunk with something in it that the player stands at (any vehicle, nearest first), or null. */
    function trunkPickTarget() {
      if (!lockpickFooting()) return null;
      let best = null,
        bestDistance = Infinity;
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (!c.trunkLoot || c.trunkOpen || c.hp <= 0 || isAircraft(c) || isBoat(c)) continue;
        if (Math.abs(c.x - player.x) > 120 || Math.abs(c.y - player.y) > 120) continue;
        trunkPoint(c, pickSpot);
        const d = hypot2(pickSpot.x - player.x, pickSpot.y - player.y);
        if (d < bestDistance && vehicleStopped(c) && Math.abs(entityElevation(c) - entityElevation(player)) < 10) {
          best = c;
          bestDistance = d;
        }
      }
      return best && withinRange('lockpick-trunk', bestDistance, TRUNK_REACH) ? best : null;
    }
    /* A locked, stopped vehicle whose driver's door the player stands at with the lockpick in hand, or null. */
    function doorPickTarget() {
      if (!lockpickFooting() || !lockpickEquipped()) return null;
      const c = nearestCar();
      if (!c || !vehicleIsLocked(c) || !vehicleStopped(c) || isAircraft(c) || isBoat(c)) return null;
      doorPickPoint(c, pickSpot);
      return withinRange('lockpick-door', hypot2(pickSpot.x - player.x, pickSpot.y - player.y), DOOR_REACH) ? c : null;
    }
    /* The action key pressed (interact): with the lockpick in hand at a trunk or a locked door the hold does the work,
       so the press is taken here (never the carjack or the driver's seat). Without it in hand the press goes on down
       the chain (a mission's keys may open the trunk; the prompt already says EQUIP THE LOCKPICK). */
    function lockpickInteract() {
      if (!lockpickEquipped()) return false;
      return !!(trunkPickTarget() || doorPickTarget());
    }
    /* Every frame (game-update.js): the hold at a lock steps in, kneels and works the pins. */
    function updateLockpick(deltaSeconds) {
      const w = lockpickWork;
      let target = null,
        kind = null;
      if (lockpickEquipped() && actionHeld('interact')) {
        target = trunkPickTarget();
        if (target) kind = 'trunk';
        else if ((target = doorPickTarget())) kind = 'door';
      }
      if (!target) {
        w.active = false;
        // The crouch runs out on its own (lootCrouching); the hold pose goes with it.
        if (w.kind && !lootCrouching()) w.kind = w.car = null;
        return;
      }
      const trunk = kind === 'trunk';
      if (trunk) trunkPoint(target, pickSpot);
      else doorPickPoint(target, pickSpot);
      // Facing the lock: along the car at its tail, across it at the door.
      const facing = trunk ? target.a : normalizeAngle(target.a + Math.PI / 2),
        dx = pickSpot.x - player.x,
        dy = pickSpot.y - player.y,
        distance = hypot2(dx, dy);
      w.car = target;
      w.kind = kind;
      w.at = gameTime;
      if (distance > PICK_SETTLED) {
        // A step to the lock first (as the carjack walks to the door), never into a wall or the car.
        const step = Math.min(distance, PICK_STEP_SPEED * deltaSeconds),
          nx = player.x + (dx / distance) * step,
          ny = player.y + (dy / distance) * step;
        if (!solid(nx, ny, 6) && !pointInCar(nx, ny, target, 1)) {
          player.x = nx;
          player.y = ny;
          player.a = Math.atan2(dy, dx);
          w.active = false;
          return;
        }
      }
      w.active = true;
      player.a = facing;
      player.lootFacing = facing;
      // Kneeling at the lock: the loot crouch, renewed while the hold lasts (the feet stay put, game-update.js).
      player.lootUntil = gameTime + LOOT_CROUCH;
      const total = trunk ? TRUNK_PICK_SECONDS : DOOR_PICK_SECONDS,
        pins = trunk ? TRUNK_PINS : DOOR_PINS,
        before = lockWorkDone(target, kind),
        done = Math.min(total, before + deltaSeconds);
      if (trunk) target.trunkPick = done;
      else target.lockPick = done;
      target.pickAt = gameTime;
      // The pick raking the pins: a faint scratch now and then.
      if (gameTime >= w.rakeAt) {
        w.rakeAt = gameTime + sfxRandom(0.22, 0.42);
        lockpickRakeSound();
      }
      const pinBefore = Math.floor((before / total) * pins + 1e-6),
        pinNow = Math.floor((done / total) * pins + 1e-6);
      if (pinNow > pinBefore) {
        w.stats.pins++;
        if (pinNow < pins) lockpickPinSound(pinNow);
        // A theft in progress: counted only if the police or someone watching sees it (witnesses.js).
        crime(trunk ? TRUNK_PIN_HEAT : DOOR_PIN_HEAT, 'theft');
      }
      if (done >= total) {
        if (trunk) {
          openTrunk(target);
          w.stats.trunks++;
          tell('TRUNK OPEN · ' + (target.trunkLoot?.label || 'EMPTY'), 3.5, { id: 'lockpick' });
        } else {
          target.locked = false;
          target.lockPick = 0;
          w.stats.doors++;
          tell('UNLOCKED', 2, { id: 'lockpick' });
        }
        lockpickLatchSound(kind);
        w.active = false;
      }
    }
    /* Opens a vehicle's trunk (the pick's last pin, or a mission): the lid swings up. */
    function openTrunk(c) {
      if (!c || c.trunkOpen) return;
      c.trunkOpen = true;
      c.trunkOpenAt = gameTime;
      c.trunkPick = 0;
      // The renderer re-reads the body (damage3d-bodies.js swings the lid).
      c.damageVersion = (c.damageVersion || 0) + 1;
    }
    /* Shuts it again (a mission's reset): what was picked stays picked only while it is open. */
    function closeTrunk(c) {
      if (!c || !c.trunkOpen) return;
      c.trunkOpen = false;
      c.trunkOpenAt = undefined;
      c.damageVersion = (c.damageVersion || 0) + 1;
    }
    /* 0..1 of the trunk's pins set (0 once the work has been left too long). */
    function trunkPickProgress(c) {
      if (!c) return 0;
      if (c.trunkOpen) return 1;
      return lockWorkDone(c, 'trunk') / TRUNK_PICK_SECONDS;
    }
    /* True while the player is at work on this vehicle's trunk (this frame). */
    function trunkPicking(c) {
      return lockpickWork.active && lockpickWork.kind === 'trunk' && (!c || lockpickWork.car === c);
    }
    /* What the player's hands are doing at a lock, for the renderer: 'trunk', 'door' or null. */
    function lockpickWorking() {
      return lockpickWork.kind && lockpickEquipped() && lootCrouching() ? lockpickWork.kind : null;
    }
    /* The prompt at a trunk with something in it, or at a locked driver's door with the lockpick in hand (updateUI,
       after the vehicle prompts, which it replaces). */
    function offerLockpickPrompt() {
      const trunk = trunkPickTarget();
      if (trunk) {
        if (!lockpickOwned()) offerPrompt('TRUNK LOCKED', { key: null, id: 'trunk-locked' });
        else if (!lockpickEquipped()) offerPrompt('EQUIP THE LOCKPICK', { key: 'lockpick', id: 'trunk-equip' });
        else {
          const pins = Math.floor(trunkPickProgress(trunk) * TRUNK_PINS + 1e-6);
          if (trunkPicking(trunk)) offerPrompt('PICKING · ' + pins + ' / ' + TRUNK_PINS + ' PINS', { hold: true, id: 'trunk-picking' });
          else offerPrompt('PICK THE TRUNK LOCK' + (pins ? ' · ' + pins + ' / ' + TRUNK_PINS + ' PINS' : ''), { hold: true, id: 'trunk-pick' });
        }
        return;
      }
      const door = doorPickTarget();
      if (!door) return;
      const pins = Math.floor((lockWorkDone(door, 'door') / DOOR_PICK_SECONDS) * DOOR_PINS + 1e-6),
        working = lockpickWork.active && lockpickWork.car === door;
      offerPrompt(working ? 'PICKING · ' + pins + ' / ' + DOOR_PINS + ' PINS' : 'PICK THE DOOR LOCK', {
        hold: true,
        id: working ? 'door-picking' : 'door-pick',
      });
    }
    /* Console (DeadEndCity.trunkReport): the nearest vehicle with something in its trunk. */
    function trunkReport() {
      let best = null,
        bestDistance = Infinity;
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (!c.trunkLoot) continue;
        const p = trunkPoint(c),
          d = hypot2(p.x - player.x, p.y - player.y);
        if (d < bestDistance) {
          best = c;
          bestDistance = d;
        }
      }
      const w = lockpickWork,
        lock = (c) => ({ x: Math.round(trunkPoint(c).x), y: Math.round(trunkPoint(c).y) });
      return {
        lockpick: { owned: lockpickOwned(), equipped: lockpickEquipped(), working: lockpickWorking(), active: w.active },
        stats: { ...w.stats },
        car: best
          ? {
              id: best.id,
              type: best.type,
              loot: best.trunkLoot?.label ?? null,
              distance: Math.round(bestDistance * 10) / 10,
              trunkPoint: lock(best),
              open: !!best.trunkOpen,
              progress: Math.round(trunkPickProgress(best) * 100) / 100,
              pins: Math.floor(trunkPickProgress(best) * TRUNK_PINS + 1e-6),
              inReach: trunkPickTarget() === best,
              stopped: vehicleStopped(best),
            }
          : null,
      };
    }
    /* Console methods (registered by game-console-vehicles.js). */
    function vehicleTrunkConsole() {
      return {
        // Give (true, the default) or take (false) the lockpick, with no toast; `equip` takes it in hand.
        // Returns { owned, equipped }.
        lockpick(on = true, equip = false) {
          if (on) {
            giveLockpick(true);
            if (equip) selectWeapon(LOCKPICK_INDEX);
          } else takeLockpick();
          drawWeapon();
          return { owned: lockpickOwned(), equipped: lockpickEquipped() };
        },
        // The nearest vehicle with something in its trunk: distance to its trunkPoint, open, pick progress and pins.
        trunkReport: () => trunkReport(),
        // Park an empty sedan at (x, y) facing `heading` with `label` in its trunk (a mission's target for tests);
        // returns its id and trunkPoint.
        trunkTarget(x = player.x + 90, y = player.y, heading = 0, label = 'UNIFORM AND ID', type = 'sedan') {
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          const c = spawnClearCar(type, x, y, heading, false);
          c.occupied = false;
          c.trunkLoot = { label: String(label) };
          const p = trunkPoint(c);
          return { id: c.id, x: Math.round(c.x), y: Math.round(c.y), trunkPoint: { x: Math.round(p.x), y: Math.round(p.y) } };
        },
        // A stopped sedan at (x, y) with its driver waiting at the wheel and the doors locked (traffic's one in three):
        // the door pick's target for tests. Returns its id and the kneeling spot at the driver's door.
        lockedDoorTarget(x = player.x + 90, y = player.y, heading = 0) {
          const c = spawnClearCar('sedan', x, y, heading, false);
          Object.assign(c, { carjackTest: true, occupied: true, locked: true, driverMood: 'flee', passengers: 0, vx: 0, vy: 0, speed: 0 });
          const p = doorPickPoint(c, { x: 0, y: 0 });
          return { id: c.id, x: Math.round(c.x), y: Math.round(c.y), door: { x: Math.round(p.x), y: Math.round(p.y) }, locked: vehicleIsLocked(c) };
        },
      };
    }
