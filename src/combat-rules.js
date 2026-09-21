    // BEGIN SUBSYSTEM: src/combat-rules.js — Aerial combat and pursuit rules
    /**
     * Aerial combat and pursuit rules
     * Source: src/combat-rules.js
     * Scope: shared game closure.
     * Elevation-aware shots, vehicle handgun rules, tank armor and single-helicopter pursuit.
     */
    /* All gunfire travels through the same three-dimensional world. */

    /**
     * LETHALITY
     * Firearms are lethal. An unprotected torso hit takes a person out of the fight
     * in one or two rounds; a ballistic vest spreads the same energy across several
     * and wears out as it does. Vehicle impacts and blasts keep their own scales so
     * a fender bump does not read as a rifle round.
     * `vest` is the NPC counterpart of `player.armor` and uses the same units.
     */
    const BALLISTIC_LETHALITY = 2.05,
      MELEE_LETHALITY = 1.45,
      VEST_SHARE = {
        ballistic: 0.74,
        melee: 0.55,
        blast: 0.45,
        impact: 0,
      };
    function vestOf(person) {
      return Math.max(0, person === player ? player.armor : person.vest || 0);
    }
    function reduceVest(person, absorbed) {
      if (person === player) player.armor = Math.max(0, player.armor - absorbed);
      else person.vest = Math.max(0, (person.vest || 0) - absorbed);
    }
    function ballisticDamage(person, damage, kind = 'ballistic') {
      let d =
        damage *
        (kind === 'ballistic' ? BALLISTIC_LETHALITY : kind === 'melee' ? MELEE_LETHALITY : 1);
      const share = VEST_SHARE[kind] || 0,
        vest = vestOf(person);
      if (vest > 0 && share > 0) {
        const absorbed = Math.min(vest, d * share);
        reduceVest(person, absorbed);
        d -= absorbed;
      }
      return Math.max(0, d);
    }
    function wearingVest(person) {
      return vestOf(person) > 0;
    }
    function combatDistance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y, entityElevation(a) - entityElevation(b));
    }
    function shotVelocity(origin, target, speed, a) {
      const horizontal = target ? distanceBetween(origin, target) : 1,
        dz = target ? entityElevation(target) - entityElevation(origin) : 0,
        length = Math.hypot(horizontal, dz) || 1,
        horizontalSpeed = (speed * horizontal) / length;
      if (target && horizontal < 40) a = headingBetween(origin, target);
      return {
        vx: Math.cos(a) * horizontalSpeed,
        vy: Math.sin(a) * horizontalSpeed,
        vz: (speed * dz) / length,
      };
    }
    function playerShotTarget(a) {
      const candidates = [
        ...wildlife.filter((a) => a.species === 'bear' || mouse.active),
        ...enemies,
        ...gangMembers,
        ...officers,
        ...vehicles.filter((c) => c.cop || c.airUnit),
        ...(mouse.active ? pedestrians : []),
      ];
      let target = null,
        best = Infinity;
      for (const p of candidates) {
        if (p.hp <= 0 || p === player.car || combatDistance(player, p) > 440 || !clearSight(player, p))
          continue;
        let score;
        if (mouse.active) {
          const q = city3D
            ? city3D.project(p.x, p.y, entityElevation(p) + 10)
            : {
                x: (p.x - cameraTarget.x) * canvasScale + viewportWidth / 2,
                y:
                  (p.y - cameraTarget.y - (isAircraft(p) ? (p.altitude || 0) * 0.3 : 0)) * canvasScale +
                  viewportHeight / 2,
              };
          score = Math.hypot(q.x - mouse.x, q.y - mouse.y);
          if (score > 38) continue;
        } else {
          score = Math.abs(normalizeAngle(headingBetween(player, p) - a));
          if (score > (mouse.active ? 0.12 : touchAim !== null ? 0.32 : 0.8)) continue;
          score += distanceBetween(player, p) * 0.00008;
        }
        if (score < best) {
          best = score;
          target = p;
        }
      }
      return target;
    }
    function bulletDamagesVehicle(b, vehicle) {
      return vehicle.type !== 'tank' || !!(b.rocket || b.antiTank);
    }
    function enforceVehicleHandgun() {
      if (
        player.car &&
        player.car.type !== 'tank' &&
        selectedWeaponIndex !== 0 &&
        weaponIsEquipped(0)
      ) {
        selectedWeaponIndex = 0;
        reloadSecondsRemaining = 0;
        drawWeapon();
      }
    }
    const AIR_SEARCH_SECONDS = 18,
      AIR_REDISPATCH_SECONDS = 45;
    let airDispatchTimer = 0;
    function airTargetSnapshot(t) {
      return {
        x: t.x,
        y: t.y,
        altitude: entityElevation(t),
        hp: 100,
      };
    }
    function airSupportUnit() {
      return vehicles.find((c) => c.airUnit && c.hp > 0 && c !== player.car);
    }
    function airCanSee(c, t) {
      return (
        c.hp > 0 &&
        !!t &&
        t.hp > 0 &&
        !c.airRetreat &&
        c.airOnScene !== false &&
        combatDistance(c, t) < 620 &&
        clearSight(c, t)
      );
    }
    function requestAirSupport(target, missionScoped = false) {
      for (const lost of vehicles)
        if (lost.airUnit && lost.hp <= 0 && !lost.airDown) markAirSupportDown(lost);
      let c = airSupportUnit();
      if (airDispatchTimer > 0 && (!c || c.airRetreat)) return null;
      if (c && !missionScoped) return c;
      if (!c) {
        const a = player.a + Math.PI * 0.7,
          x = target.x + Math.cos(a) * 900,
          y = target.y + Math.sin(a) * 900;
        c = makeCar(
          'helicopter',
          x,
          y,
          headingBetween(
            {
              x,
              y,
            },
            target,
          ),
          false,
          '#d9e1df',
        );
      }
      const known = airTargetSnapshot(target);
      Object.assign(c, {
        airUnit: true,
        generalAirUnit: !missionScoped,
        missionPursuit: missionScoped,
        cop: true,
        airTarget: target,
        airLastSeen: known,
        pursuitTarget: {
          ...known,
        },
        airState: c.airOnScene ? 'searching' : 'arriving',
        airOnScene: !!c.airOnScene,
        airArrival: c.airOnScene ? 0 : (c.airArrival ?? 8),
        airLostFor: 0,
        airRetreat: false,
        airDown: false,
        altitude: Math.max(c.altitude, terrainHeight(c.x, c.y) + 280, entityElevation(target) + 120),
        airShotTimer: 2,
        rotorSpeed: 1,
      });
      radio('call-backup');
      tell('AIR SUPPORT CALLED · Head for a railway underpass, towers, or a bridge by boat.', 7);
      return c;
    }
    function retireAirSupport(c, escaped = false) {
      if (c.airRetreat) return;
      c.cop = false;
      c.seesPlayer = false;
      c.airRetreat = true;
      c.airState = 'retreating';
      c.pursuitTarget = {
        x: c.x + 1800,
        y: c.y - 1800,
        altitude: c.altitude,
        hp: 100,
      };
      airDispatchTimer = Math.max(airDispatchTimer, AIR_REDISPATCH_SECONDS);
      if (mission?.airUnit === c) mission.airUnit = null;
      if (escaped)
        tell('HELICOPTER LOST · Air support is leaving. Ground patrols may still be searching.', 5);
    }
    function markAirSupportDown(c) {
      if (c.airDown) return;
      c.airDown = true;
      c.airState = 'down';
      c.cop = false;
      c.seesPlayer = false;
      airDispatchTimer = Math.max(airDispatchTimer, AIR_REDISPATCH_SECONDS);
      if (mission?.airUnit === c) mission.airUnit = null;
      tell('AIR SUPPORT DOWN · No replacement for 45 seconds. Use the opening to escape.', 5);
    }
    function updateAirPolice(deltaSeconds) {
      if (gameMode !== 'play') return;
      airDispatchTimer = Math.max(0, airDispatchTimer - deltaSeconds);
      // Destruction is processed before dispatch, so a kill cannot immediately spawn its replacement.
      for (const c of vehicles) if (c.airUnit && c.hp <= 0 && !c.airDown) markAirSupportDown(c);
      const wanted = Math.ceil(wantedStars) >= 4 && !harborPoliceProtected(player.x, player.y, 100);
      if (wanted && !airSupportUnit() && airDispatchTimer <= 0) requestAirSupport(player);
      const live = vehicles
        .filter((c) => c.airUnit && c.hp > 0 && c !== player.car && !c.airRetreat)
        .sort((a, b) => Number(!!b.missionPursuit) - Number(!!a.missionPursuit) || a.id - b.id);
      for (const c of live.slice(1)) retireAirSupport(c);
      for (let i = vehicles.length - 1; i >= 0; i--) {
        const c = vehicles[i];
        if (!c.airUnit || c === player.car) continue;
        if (c.airRetreat) {
          if (distanceBetween(c, player) > 1650) vehicles.splice(i, 1);
          continue;
        }
        if (c.hp <= 0) continue;
        const t = c.airTarget || c.pursuitTarget || player,
          cargo = cargoChase();
        c.airTarget = t;
        if (
          t.hp <= 0 ||
          (c.generalAirUnit && !wanted) ||
          (c.missionPursuit && (!cargo || cargo.car !== t))
        ) {
          retireAirSupport(c);
          continue;
        }
        if (!c.airOnScene) {
          c.airArrival = Math.max(0, (c.airArrival || 0) - deltaSeconds);
          c.airState = 'arriving';
          c.seesPlayer = false;
          if (c.airArrival > 0 || distanceBetween(c, c.airLastSeen) > 360) continue;
          c.airOnScene = true;
          c.airState = 'searching';
        }
        const seen = airCanSee(c, t);
        c.seesPlayer = seen;
        c.airShotTimer = Math.max(0, (c.airShotTimer || 0) - deltaSeconds);
        if (seen) {
          c.airLostFor = 0;
          c.airState = 'tracking';
          c.airLastSeen = airTargetSnapshot(t);
          c.pursuitTarget = {
            ...c.airLastSeen,
          };
        } else {
          c.airState = 'searching';
          c.airLostFor = (c.airLostFor || 0) + deltaSeconds;
          if (!c.airLastSeen) c.airLastSeen = airTargetSnapshot(c.pursuitTarget || t);
          c.pursuitTarget = {
            ...c.airLastSeen,
          };
          if (c.airLostFor >= AIR_SEARCH_SECONDS) {
            retireAirSupport(c, true);
            continue;
          }
        }
        if (seen && c.airShotTimer <= 0 && combatDistance(c, t) < 540) {
          c.airShotTimer = 1.5;
          const a = headingBetween(c, t) + randomBetween(-0.035, 0.035),
            origin = {
              x: c.x + Math.cos(a) * 27,
              y: c.y + Math.sin(a) * 27,
              altitude: entityElevation(c),
            };
          bullets.push({
            ...origin,
            ...shotVelocity(origin, t, 650, a),
            life: 1,
            dmg: 12,
            enemy: true,
            faction: 'police',
            owner: c,
            target: t === player || t === player.car ? player : t,
          });
          playSample('pistol', 0.22, 1, c);
          if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude);
        }
      }
    }
    function airPursuitStatus() {
      const c = vehicles.find((c) => c.airUnit && c.hp > 0 && !c.airRetreat && c !== player.car);
      if (c)
        return c.airState === 'arriving'
          ? 'AIR SUPPORT ' +
              (c.airArrival > 0 ? 'EN ROUTE · ' + Math.ceil(c.airArrival) + 's' : 'APPROACHING')
          : c.airState === 'searching'
            ? 'AIR SEARCH · ' +
              Math.ceil(Math.max(0, AIR_SEARCH_SECONDS - (c.airLostFor || 0))) +
              's · STAY HIDDEN'
            : 'HELICOPTER · ' + Math.ceil((c.hp / c.maxhp) * 100) + '% · FIND COVER';
      return wantedStars >= 4 && airDispatchTimer > 0
        ? 'NO AIR SUPPORT · ' + Math.ceil(airDispatchTimer) + 's'
        : '';
    }
    function airSearchPoint(c) {
      if (!c || c.hp <= 0 || c.airRetreat || c.airOnScene === false || c.airState === 'arriving')
        return null;
      const t = c.airLastSeen || c.pursuitTarget;
      if (!t || combatDistance(c, t) > 520) return null;
      const p =
        c.airState === 'searching'
          ? {
              x: t.x + Math.cos(gameTime * 0.8) * 80,
              y: t.y + Math.sin(gameTime * 0.8) * 80,
              altitude: t.altitude,
            }
          : t;
      return clearSight(c, p) ? p : null;
    }
    // END SUBSYSTEM: src/combat-rules.js
