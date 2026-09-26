    function updateCombat(deltaSeconds) {
      for (let i = fires.length - 1; i >= 0; i--) {
        const fire = fires[i];
        fire.life -= deltaSeconds;
        if (fire.life <= 0) {
          fires.splice(i, 1);
          continue;
        }
        fire.emit -= deltaSeconds;
        if (fire.emit <= 0 && distanceBetween(fire, player) < 950) {
          fire.emit = 0.13;
          const life = randomBetween(0.5, 1.2);
          particles.push({
            x: fire.x + randomBetween(-15, 15) * fire.power,
            y: fire.y + randomBetween(-12, 12) * fire.power,
            vx: randomBetween(-8, 8),
            vy: randomBetween(-8, 8),
            z: (fire.altitude ?? terrainHeight(fire.x, fire.y)) + 4,
            vz: randomBetween(18, 40),
            life,
            max: life,
            color: randomChoice(['#ffae3d', '#ec6124', '#d13c1b']),
            size: randomBetween(5, 11) * fire.power,
            flame: true,
          });
        }
      }
    }
    function drawFire2D() {
      for (const fire of fires)
        if (visible(fire, 120)) {
          const fade = Math.min(1, fire.life / 3),
            r = (24 + Math.sin(gameTime * 19 + fire.x) * 3) * fire.power;
          worldContext.save();
          worldContext.globalAlpha = fade;
          const glow = worldContext.createRadialGradient(fire.x, fire.y, 1, fire.x, fire.y, r * 2);
          glow.addColorStop(0, '#ffbf5f7f');
          glow.addColorStop(1, '#ff692000');
          worldContext.fillStyle = glow;
          worldContext.fillRect(fire.x - r * 2, fire.y - r * 2, r * 4, r * 4);
          for (let i = 0; i < 6; i++) {
            const a = i * 2.4 + gameTime * 2,
              x = fire.x + Math.cos(a) * r * 0.45,
              y = fire.y + Math.sin(a) * r * 0.35;
            worldContext.fillStyle = i % 2 ? '#ffc569bb' : '#e97032bb';
            worldContext.beginPath();
            worldContext.ellipse(
              x,
              y - r * 0.45,
              r * 0.25,
              r * (0.65 + 0.2 * Math.sin(gameTime * 12 + i)),
              Math.sin(a) * 0.2,
              0,
              TAU,
            );
            worldContext.fill();
          }
          worldContext.restore();
        }
    }
    const shotSolidLists = [null, null, null, null, null, null, null, null];
    function shotBlocked(x, y, altitude = 0) {
      if (airCoverStopsShot(x, y, altitude) || (landAt(x, y) && altitude + 10 < terrainHeight(x, y)))
        return true;
      if (
        altitude > 100 &&
        roofCover.some(
          (b) =>
            altitude + 10 < ROOFTOP.height + b.height &&
            x > b.x &&
            x < b.x + b.w &&
            y > b.y &&
            y < b.y + b.h,
        )
      )
        return true;
      if (
        inStadiumLot(x, y, 4) &&
        STADIUM_STANDS.some(
          (b) => altitude + 10 < b.height && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h,
        )
      )
        return true;
      // Called for every 7-unit sub-step of every round in flight: the lists are
      // walked in place (they used to be spread into one new array per call).
      const lists = shotSolidLists;
      lists[0] = garageWalls();
      lists[1] = harborSolids();
      lists[2] = depotSolids();
      lists[3] = militarySolids();
      lists[4] = countyStaticSolids;
      lists[5] = AIRPORT_SCENERY_SOLIDS;
      lists[6] = garageDoorSolids();
      // GOALLINE, the betting shop by the stadium (sportsbook.js).
      lists[7] = sportsbookWalls();
      for (let i = 0; i < lists.length; i++) {
        const list = lists[i];
        // Most rounds are nowhere near a given list's rectangles (rectListBounds).
        if (!rectListNear(list, x, y)) continue;
        for (let k = 0; k < list.length; k++) {
          const b = list[k];
          if (altitude + 10 < b.height && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
        }
      }
      const near = buildingsNear(x, y);
      for (let i = 0; i < near.length; i++) {
        const b = near[i];
        if (altitude + 10 < b.height && x > b.x - 1 && x < b.x + b.w + 1 && y > b.y - 1 && y < b.y + b.h + 1)
          return true;
      }
      return false;
    }
    // Who a bullet can hit where it is now, in the order hits are tested. The
    // short lists go in whole; pedestrians come from the crowd's neighbour grid
    // around the bullet. Every sub-step of every bullet used to copy all ~650
    // pedestrians (plus everyone else) into a fresh array.
    const bulletTargetList = [],
      bulletVehicleList = [];
    function addBulletTargets(list, people) {
      for (let k = 0; k < people.length; k++) list.push(people[k]);
    }
    function pushBulletTarget(p) {
      bulletTargetList.push(p);
    }
    function bulletTargets(b, escorts, rooftop) {
      const list = bulletTargetList;
      list.length = 0;
      if (b.enemy) {
        if (b.faction === 'police') {
          addBulletTargets(list, enemies);
          addBulletTargets(list, gangMembers);
        } else if (b.faction) {
          addBulletTargets(list, enemies);
          addBulletTargets(list, gangMembers);
          addBulletTargets(list, officers);
          forEachPedestrianNear(b.x, b.y, 16, pushBulletTarget);
          addBulletTargets(list, sportsTargets());
        }
        addBulletTargets(list, escorts);
      } else {
        addBulletTargets(list, enemies);
        addBulletTargets(list, gangMembers);
        forEachPedestrianNear(b.x, b.y, 16, pushBulletTarget);
        addBulletTargets(list, officers);
        addBulletTargets(list, escorts);
        addBulletTargets(list, rooftop);
        // Athletes, officials and stewards at the sports venues (sports.js).
        addBulletTargets(list, sportsTargets());
      }
      return list;
    }
    function updateBullets(deltaSeconds) {
      if (!bullets.length) return;
      const escorts = storyActors.filter(
          (p) => p.missionTag === 'flight-witness' && !p.hidden && mission?.stage >= 4,
        ),
        rooftopTargets = storyActors.filter((p) => p.missionTag === 'rooftop-hit' && !p.hidden);
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        // Who is shooting at the player (combat-rules.js SHOT LOG).
        if (b.enemy && !b.logged) logHostileShot(b);
        let impact = false,
          hitKind = 'wall';
        const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy, b.vz || 0) * deltaSeconds) / 7));
        // Only vehicles near this frame's flight segment can be hit by it.
        const reach = 70,
          minX = Math.min(b.x, b.x + b.vx * deltaSeconds) - reach,
          maxX = Math.max(b.x, b.x + b.vx * deltaSeconds) + reach,
          minY = Math.min(b.y, b.y + b.vy * deltaSeconds) - reach,
          maxY = Math.max(b.y, b.y + b.vy * deltaSeconds) + reach,
          nearVehicles = bulletVehicleList;
        nearVehicles.length = 0;
        for (const c of vehicles) if (c.x > minX && c.x < maxX && c.y > minY && c.y < maxY) nearVehicles.push(c);
        for (let j = 0; j < steps && !impact; j++) {
          // Where this sub-step started: damage.js traces the entry face from it.
          b.px = b.x;
          b.py = b.y;
          b.x += (b.vx * deltaSeconds) / steps;
          b.y += (b.vy * deltaSeconds) / steps;
          b.altitude = (b.altitude ?? 0) + ((b.vz || 0) * deltaSeconds) / steps;
          if (shotBlocked(b.x, b.y, b.altitude || 0)) {
            impact = true;
            break;
          }
          for (const c of nearVehicles) {
            if (
              c === b.owner ||
              (b.faction === 'military' && c.military && !c.stolen) ||
              !sameFloor(c, b) ||
              (c === b.owner?.car && !c.stolen && c !== player.car) ||
              (!b.enemy && c === player.car)
            )
              continue;
            if (!pointInCar(b.x, b.y, c, 1)) continue;
            if (
              bulletDamagesVehicle(b, c) &&
              !(
                b.faction === 'police' &&
                (lawVehicle(c) || c.airUnit || (c === player.car && b.target !== player))
              )
            )
              damageVehicle(
                c,
                // The vehicles missions hand you are built for the job (the cargo
                // truck's steel cage, Vinny's armored van): gang small-arms fire
                // does 40% damage to them, or a crew opening up on the loading
                // truck wrecks it before the third crate is aboard. An armoured
                // airframe (the Apache) shrugs off most small-arms fire
                // (combat-rules.js vehicleArmorShare).
                vehicleArmorShare(c, b) *
                  (b.enemy && c.mission && b.faction !== 'police' && !b.rocket
                    ? b.dmg * 0.4
                    : // Police rounds are meant for the driver: they chew a car up
                      // slowly rather than wrecking it in a dozen hits.
                      b.faction === 'police' && c === player.car && !b.rocket
                      ? b.dmg * 0.45
                      : b.dmg),
                b.x,
                b.y,
                b.owner || (!b.enemy ? player : null),
                {
                  kind: 'bullet',
                },
              );
            impact = true;
            // Rounds aimed at the driver come through the glass and the doors: a
            // car is cover, not armour. Heavy vehicles and aircraft keep it out.
            if (
              c === player.car &&
              b.enemy &&
              b.target === player &&
              !b.rocket &&
              !['tank', 'bus', 'truck', 'flatbed'].includes(c.type) &&
              !isAircraft(c) &&
              seededRandom() < 0.55
            ) {
              if (b.damageKind === 'sniper') sniperFireStats.carHits++;
              hurt((b.playerDmg ?? b.dmg) * 0.6, b.damageKind);
              shotLogHit(b);
            }
            // A hole in the skin, a star in the glass, a dead lamp or a flat tyre.
            hitKind = bulletHitVehicle(c, b);
            break;
          }
          if (impact) break;
          if (!b.enemy) {
            for (const a of wildlife) {
              if (
                a.hp > 0 &&
                sameFloor(a, b) &&
                distanceBetween(a, b) < WILDLIFE_SPECIES[a.species].collisionRadius
              ) {
                strikeWildlife(a, b.dmg);
                impact = true;
                hitKind = 'flesh';
                break;
              }
            }
          }
          if (impact) break;
          const targets = bulletTargets(b, escorts, rooftopTargets);
          for (const p of targets) {
            if (
              !sameFloor(p, b) ||
              p === b.owner ||
              p.hp <= 0 ||
              (b.enemy && b.faction === p.faction)
            )
              continue;
            if (Math.hypot(b.x - p.x, b.y - p.y) >= PERSON_HIT_RADIUS) continue;
            // A precision-rifle round on the target it was aimed at is a headshot:
            // one shot, whatever the vest.
            // A riot shield stops a round from the front: sparks, no wound (swat.js).
            if (shieldBlocks(p, b)) {
              impact = true;
              hitKind = 'metal';
              break;
            }
            const headshot = !b.enemy && b.headshotTarget === p;
            strikePerson(
              p,
              headshot ? 400 : b.dmg,
              Math.atan2(b.vy, b.vx),
              b.owner || (!b.enemy ? player : null),
              true,
              headshot ? 'headshot' : 'ballistic',
            );
            if (!b.enemy) {
              if (p.police) crime(0.3);
              if (p.hp <= 0) cash += enemies.includes(p) ? 100 : 10;
              playerHitConfirm(p, p.hp <= 0);
            }
            impact = true;
            hitKind = 'flesh';
            break;
          }
          if (
            !impact &&
            b.enemy &&
            sameFloor(b, player) &&
            !player.car &&
            (b.faction !== 'police' || b.target === player) &&
            Math.hypot(b.x - player.x, b.y - player.y) < PERSON_HIT_RADIUS
          ) {
            if (b.damageKind === 'sniper') sniperFireStats.hits++;
            hurt(b.playerDmg ?? b.dmg, b.damageKind);
            shotLogHit(b);
            playerHitFeedback(b);
            impact = true;
            hitKind = 'flesh';
          }
        }
        b.life -= deltaSeconds;
        if (b.rocket && seededRandom() < 0.8) particle(b.x, b.y, '#cbc4a0', 1, 15, 5);
        if (impact || b.life <= 0) {
          // A rocket or shell into a facade goes off against the wall, outside it.
          const face = b.rocket && impact && hitKind === 'wall' ? heavyRoundHitsBuilding(b) : null;
          if (face) {
            b.x = face.x;
            b.y = face.y;
          }
          if (b.rocket)
            explode(
              b.x,
              b.y,
              b.blastPower || 1,
              b.owner || (!b.enemy ? player : 'world'),
              b.altitude ?? 0,
            );
          else if (impact && hitKind !== 'flesh') {
            // Walls keep a chip or a hole, shop windows crack and then give way.
            if (hitKind === 'wall') hitKind = bulletHitSurface(b);
            particle(b.x, b.y, hitKind === 'metal' ? '#dbd8a7' : '#aaa89e', 3, 40);
            if (city3D) city3D.impact(b.x, b.y, hitKind, b.altitude || 0);
          } else if (!impact) bulletSpent(b);
          // The Apache's 30 mm rounds burst where they strike (apache.js).
          if (b.heavyRound && impact) apacheRoundImpact(b);
          bullets.splice(i, 1);
        }
      }
    }
