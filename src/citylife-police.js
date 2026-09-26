    function renderService() {
      const p = servicePlace;
      if (!p) return;
      getElement('serviceName').textContent = p.name;
      getElement('serviceClock').textContent =
        'DAY ' +
        (Math.floor(worldMinutes / 1440) + 1) +
        ' · ' +
        clockText() +
        ' · $' +
        Math.floor(visibleCash()).toLocaleString();
      let text = '',
        options = [];
      getElement('casinoTable').classList.add('hidden');
      if (p.kind === 'casino') {
        text =
          'Single-zero roulette · Red or black returns 2× your bet; a winning number returns 36×. Zero wins only a number bet.';
        renderCasino();
      }
      if (p.kind === 'guns') {
        text =
          'Every weapon you buy is equipped immediately. Click the weapon box to open your arsenal.';
        options = weapons.map((w, i) => ({
          text:
            i +
            1 +
            '. ' +
            w.name +
            ' · ' +
            (w.owned ? 'REFILL $' + AMMO_PRICES[i] : 'BUY $' + PRICES[i]),
          action: 'weapon',
          slot: i,
        }));
        options.push({
          text: '7. BODY ARMOR · $350',
          action: 'armor',
        });
      }
      if (p.kind === 'hospital') {
        text = 'Emergency care · open 24 hours. Treatment restores your health.';
        options = [
          {
            text: '1. GET TREATMENT · $150',
            action: 'heal',
          },
        ];
      }
      if (p.kind === 'sleep') {
        text =
          'A room, a locked door, and a few hours off the streets. Sleep restores all health. Timed jobs must be finished first.';
        options = [
          {
            text: '1. SLEEP 6 HOURS · FREE',
            action: 'sleep',
          },
          {
            text: '2. SLEEP UNTIL 08:00 · FREE',
            action: 'morning',
          },
        ];
      }
      if (p.kind === 'bar') {
        text = 'Hot food and a quiet corner. A meal restores 30 health.';
        options = [
          {
            text: '1. ORDER A MEAL · $35',
            action: 'meal',
          },
        ];
      }
      if (p.kind === 'club') {
        text = clubOpen()
          ? 'Music downstairs. Open 20:00–05:00. Take a 30-minute break and restore 20 health.'
          : 'Doors open at 20:00. Come back tonight.';
        if (clubOpen())
          options = [
            {
              text: '1. ENTER THE CLUB · $80',
              action: 'club',
            },
          ];
      }
      if (p.kind === 'diner') {
        text =
          'Counter service, booths at the back, open around the clock. A plate of food and a coffee put you back together.';
        options = [
          {
            text: '1. BLUE PLATE SPECIAL · $28',
            action: 'plate',
          },
          {
            text: '2. COFFEE AND A BOOTH · $9',
            action: 'coffee',
          },
        ];
      }
      if (p.kind === 'clothes') {
        // A change of clothes is only worth anything while the search is running
        // on a description rather than on eyes actually on you.
        const useful = wantedStars > 0 && searchActive;
        text = useful
          ? 'Racks of workwear and a changing room with a back door. While the police are working from a description, new clothes end the search.'
          : 'Racks of workwear, a changing room and a back door. Worth remembering when a patrol has lost sight of you.';
        options = [
          {
            text: '1. CHANGE OF CLOTHES · $200',
            action: 'change',
          },
        ];
      }
      if (p.kind === 'school')
        text =
          'Classes 08:00–18:00. The campus includes teaching buildings, a courtyard and sports courts.';
      getElement('serviceDescription').textContent = text;
      const list = getElement('serviceActions');
      list.replaceChildren();
      options.forEach((o) => {
        const b = document.createElement('button');
        b.className = 'secondary service-option';
        b.textContent = o.text;
        b.onclick = () => serviceAction(o.action, o.slot);
        list.appendChild(b);
      });
    }
    function serviceAction(action, slot = 0) {
      if (gameMode !== 'service' || !servicePlace) return false;
      if (wantedStars > 0 && action !== 'change') return needToLosePolice();
      let cost = 0,
        advance = 0,
        health = 0;
      if (action === 'weapon') {
        if (servicePlace.kind !== 'guns' || !weapons[slot]) return false;
        const w = weapons[slot],
          reserveTarget = w.clip * (w.rocket ? 5 : 7);
        if (w.owned && w.ammo >= w.clip && w.reserve >= reserveTarget) {
          tell('Ammunition is already full.', 3);
          return false;
        }
        cost = w.owned ? AMMO_PRICES[slot] : PRICES[slot];
        if (cash < cost) {
          tell('Not enough cash. Complete a payphone job.', 3);
          return false;
        }
        cash -= cost;
        w.owned = true;
        w.ammo = Math.max(w.ammo, w.clip);
        w.reserve = Math.max(w.reserve, reserveTarget);
        selectWeapon(slot);
        tell(w.name + ' equipped and ready.', 4);
        save();
        renderService();
        drawWeapon();
        return true;
      }
      if (action === 'armor') {
        if (servicePlace.kind !== 'guns') return false;
        cost = 350;
      } else if (action === 'heal') {
        if (servicePlace.kind !== 'hospital') return false;
        cost = 150;
        health = 100;
      } else if (action === 'meal') {
        if (servicePlace.kind !== 'bar') return false;
        cost = 35;
        health = 30;
      } else if (action === 'plate') {
        if (servicePlace.kind !== 'diner') return false;
        cost = 28;
        health = 45;
        advance = 25;
      } else if (action === 'coffee') {
        if (servicePlace.kind !== 'diner') return false;
        cost = 9;
        health = 12;
        advance = 10;
      } else if (action === 'change') {
        if (servicePlace.kind !== 'clothes') return false;
        cost = 200;
        if (cash < cost) {
          tell('Not enough cash.', 2);
          return false;
        }
        cash -= cost;
        advance = 12;
        worldMinutes += advance;
        if (wantedStars > 0 && searchActive) {
          clearPolice(true);
          announce('NEW CLOTHES', 'DESCRIPTION USELESS', 3);
        } else {
          announce('BACK ON THE STREETS', 'CHANGED', 2.2);
          if (wantedStars > 0) tell('They can still see you. Clothes will not help while they can.', 4);
        }
        save();
        closeService();
        return true;
      } else if (action === 'club') {
        if (servicePlace.kind !== 'club' || !clubOpen()) return false;
        cost = 80;
        health = 20;
        advance = 30;
      } else if (action === 'sleep' || action === 'morning') {
        if (servicePlace.kind !== 'sleep') return false;
        advance = action === 'sleep' ? 360 : (480 - (worldMinutes % 1440) + 1440) % 1440 || 1440;
        health = 100;
      } else return false;
      if (advance && mission?.timeLimit) {
        tell('Finish the timed job before taking a break.', 3);
        return false;
      }
      if (cash < cost) {
        tell('Not enough cash.', 2);
        return false;
      }
      cash -= cost;
      worldMinutes += advance;
      player.hp = Math.min(100, player.hp + health);
      if (action === 'armor') player.armor = 100;
      save();
      closeService();
      announce(
        advance
          ? 'DAY ' + (Math.floor(worldMinutes / 1440) + 1) + ' · ' + clockText()
          : 'BACK ON THE STREETS',
        advance ? 'RESTED & READY' : action === 'armor' ? 'ARMORED UP' : 'FEELING BETTER',
        2.5,
      );
      return true;
    }
    function serviceKey(code) {
      if (code === 'Escape' || code === 'KeyE') {
        closeService();
        return;
      }
      if (servicePlace?.kind === 'casino') {
        if (code === 'Enter') spinCasino();
        return;
      }
      const n = Number(code.replace('Digit', '')) - 1,
        p = servicePlace;
      if (n < 0 || n > 6) return;
      if (p.kind === 'guns') serviceAction(n === 6 ? 'armor' : 'weapon', n);
      else {
        const action =
          p.kind === 'sleep'
            ? n === 0
              ? 'sleep'
              : n === 1
                ? 'morning'
                : null
            : p.kind === 'diner'
              ? n === 0
                ? 'plate'
                : n === 1
                  ? 'coffee'
                  : null
              : n === 0
                ? {
                    hospital: 'heal',
                    bar: 'meal',
                    club: 'club',
                    clothes: 'change',
                  }[p.kind]
                : null;
        if (action) serviceAction(action);
      }
    }
    /**
     * DAILY RHYTHM
     * The pavement at eight in the morning is not the pavement at two. The tempo
     * shifts the mix between walking, loitering, window shopping and sitting, how
     * quickly people move, and how many of them are out at all (`out` scales the
     * crowd streamer's target in src/crowd.js). Thinning the crowd removes
     * pedestrians rather than hiding them, so nothing invisible is left in the
     * world for bullets, traffic or the police to find.
     */
    function cityTempo() {
      const hour = (worldMinutes / 60) % 24;
      // Walking pace, 4-6 km/h: brisk in the rush hours, an amble at lunch.
      if (hour < 2) return { name: 'AFTER MIDNIGHT', speed: 4.7 * KMH, idle: 0.1, shop: 0.05, bench: 0.1, out: 0.36 };
      if (hour < 5.5) return { name: 'NIGHT', speed: 4.9 * KMH, idle: 0.06, shop: 0.03, bench: 0.08, out: 0.17 };
      if (hour < 9.5) return { name: 'MORNING RUSH', speed: 5.6 * KMH, idle: 0.04, shop: 0.07, bench: 0.1, out: 1 };
      if (hour < 11.5) return { name: 'MORNING', speed: 4.4 * KMH, idle: 0.12, shop: 0.26, bench: 0.34, out: 0.86 };
      if (hour < 14.5) return { name: 'LUNCH', speed: 4.2 * KMH, idle: 0.15, shop: 0.34, bench: 0.5, out: 1 };
      if (hour < 17.5) return { name: 'AFTERNOON', speed: 4.4 * KMH, idle: 0.11, shop: 0.27, bench: 0.38, out: 0.88 };
      if (hour < 19.5) return { name: 'EVENING RUSH', speed: 5.4 * KMH, idle: 0.05, shop: 0.1, bench: 0.14, out: 1 };
      if (hour < 23) return { name: 'EVENING', speed: 4.5 * KMH, idle: 0.17, shop: 0.24, bench: 0.4, out: 0.82 };
      return { name: 'LATE', speed: 5.1 * KMH, idle: 0.08, shop: 0.07, bench: 0.12, out: 0.42 };
    }
    function ordinaryWalker(p) {
      return (
        !p.gymStation &&
        !p.vendor &&
        !p.queueing &&
        !p.parkGuest &&
        !p.club &&
        !p.parkRoute &&
        !p.leader &&
        !p.ejected &&
        !p.angryUntil &&
        !p.witnessUntil &&
        p.hp > 0
      );
    }
    /* Crowd size and placement are handled by the streamer in src/crowd.js. */
    function updateCrowdDensity(deltaSeconds) {
      streamCrowd(deltaSeconds);
    }
    /**
     * ESCAPE WINDOW
     * How long you have to stay out of sight before the search is called off:
     * six seconds at one star up to twenty-four at five (pursuit.js). Any unit
     * that sees you, on the ground or in the air, starts it again.
     */
    /* Sight was worked out this frame by updateOfficers (and the air units):
       does anyone on the police side have eyes on the player? (The search
       below, and the garages' rule that a respray only works unseen.) */
    function policeHaveEyesOnPlayer() {
      return (
        officers.some((o) => o.state !== 'return' && o.hp > 0 && o.seesPlayer) ||
        vehicles.some((c) => c.cop && !c.crewDeployed && c.hp > 0 && c.seesPlayer)
      );
    }
    function policeSearchSeconds(stars = wantedStars) {
      return pursuitSearchSeconds(stars);
    }
    function clearPolice(notifyEscape = false) {
      clearRoadblocks();
      const wasWanted = wantedStars > 0;
      if (notifyEscape && wasWanted) policeClearedNotice();
      // Losing the police means losing all of them. A respray used to leave the
      // helicopter overhead, which is the one unit a change of paint fools best.
      let announced = false;
      for (const air of vehicles)
        if (air.airUnit && air.hp > 0 && !air.airRetreat && air !== player.car) {
          retireAirSupport(air, notifyEscape && wasWanted && !announced);
          announced = true;
        }
      wantedStars = 0;
      resetHeat();
      searchRemaining = 0;
      searchActive = false;
      copSpawn = 5;
      dispatchTimer = 3;
      arrestProgress = 0;
      for (const o of officers) if (o.hp > 0 && !o.gangTarget) o.state = 'return';
      for (const c of vehicles)
        if (c.cop) {
          c.cop = false;
          // Patrol cars go back to patrolling; SWAT vans, agents and the tank wait
          // where they are until they are out of sight and sent home (pursuit.js).
          c.ai = !c.crewDeployed && !c.crewLost && !c.lawUnit;
          c.route = null;
          c.junction = null;
          c.navAngle = undefined;
        }
    }
    function resetOfficerCrews() {
      for (const c of vehicles) {
        if (c.crewDeployed) {
          c.crewDeployed = false;
          c.ai = c.hp > 0 && !c.stolen && !c.crewLost;
        }
        c.crew = [];
        c.gangTarget = null;
      }
      officers.length = 0;
    }
    function lawVehicle(vehicle) {
      return (
        (vehicle.type === 'police' || !!vehicle.lawUnit) &&
        vehicle.hp > 0 &&
        !vehicle.crewLost &&
        !vehicle.stolen &&
        vehicle !== player.car
      );
    }
    function recentGangThreat(e) {
      return (
        e.hp > 0 && (gameTime - (e.lastShotAt ?? -100) < 8 || (e.policeThreatUntil || 0) > gameTime)
      );
    }
    function policeGangTarget(o) {
      let target = null,
        best = 420;
      for (const e of [...gangMembers, ...enemies]) {
        if (e.military || !recentGangThreat(e) || harborPoliceProtected(e.x, e.y, 30)) continue;
        const d = distanceBetween(o, e);
        if (d < best && clearSight(o, e)) {
          target = e;
          best = d;
        }
      }
      if (target) {
        target.policeThreatUntil = gameTime + 12;
        o.gangLastSeen = {
          x: target.x,
          y: target.y,
        };
        o.gangSeenAt = gameTime;
        return target;
      }
      const old = o.gangTarget;
      return old?.hp > 0 &&
        !old.military &&
        !harborPoliceProtected(old.x, old.y, 30) &&
        gameTime - (o.gangSeenAt ?? -100) < 12 &&
        distanceBetween(o, old) < 650
        ? old
        : null;
    }
    /* Does the segment a->b (heights start->start+dz) pass through a block? A slab
       test in x, y and height, with a 2-unit skin so rays do not graze corners. */
    function sightBlockedBy(block, ax, ay, start, dx, dy, dz) {
      let lo = 0,
        hi = 1;
      for (let axis = 0; axis < 3; axis++) {
        const pos = axis === 0 ? ax : axis === 1 ? ay : start,
          delta = axis === 0 ? dx : axis === 1 ? dy : dz,
          min = axis === 0 ? block.x - 2 : axis === 1 ? block.y - 2 : -10,
          max = axis === 0 ? block.x + block.w + 2 : axis === 1 ? block.y + block.h + 2 : block.height + 2;
        if (Math.abs(delta) < 1e-8) {
          if (pos < min || pos > max) return false;
        } else {
          let t1 = (min - pos) / delta,
            t2 = (max - pos) / delta;
          if (t1 > t2) [t1, t2] = [t2, t1];
          if (t1 > lo) lo = t1;
          if (t2 < hi) hi = t2;
          if (lo > hi) return false;
        }
      }
      return hi > 0.0001 && lo < 0.9999;
    }
    let sightStamp = 0;
    /* Line of sight between two entities. Every officer, cruiser and helicopter
       asks this every frame at five stars, so buildings come from the building
       grid cells the segment's bounding box covers (each tested once) rather
       than from the whole city. */
    function clearSight(a, b) {
      if (airCoverRay(a, b)) return false;
      const start = entityElevation(a) + 14,
        end = entityElevation(b) + 14,
        dx = b.x - a.x,
        dy = b.y - a.y,
        dz = end - start;
      if (a.x > CITY_SIZE || b.x > CITY_SIZE || a.y > CITY_SIZE || b.y > CITY_SIZE) {
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 24));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          if (terrainHeight(a.x + dx * t, a.y + dy * t) > start + dz * t) return false;
        }
      }
      if (buildingGrid.size) {
        const stamp = ++sightStamp,
          x0 = Math.floor((Math.min(a.x, b.x) - 8) / BUILDING_CELL),
          x1 = Math.floor((Math.max(a.x, b.x) + 8) / BUILDING_CELL),
          y0 = Math.floor((Math.min(a.y, b.y) - 8) / BUILDING_CELL),
          y1 = Math.floor((Math.max(a.y, b.y) + 8) / BUILDING_CELL);
        for (let i = x0; i <= x1; i++)
          for (let j = y0; j <= y1; j++) {
            const cell = buildingGrid.get(i * 4096 + j);
            if (!cell) continue;
            for (const block of cell) {
              if (block.sightStamp === stamp) continue;
              block.sightStamp = stamp;
              if (sightBlockedBy(block, a.x, a.y, start, dx, dy, dz)) return false;
            }
          }
      } else
        for (const block of buildings)
          if (sightBlockedBy(block, a.x, a.y, start, dx, dy, dz)) return false;
      // The other solids: a bounding-box reject first (the county lists are long).
      const minX = Math.min(a.x, b.x) - 4,
        maxX = Math.max(a.x, b.x) + 4,
        minY = Math.min(a.y, b.y) - 4,
        maxY = Math.max(a.y, b.y) + 4;
      const lists = [
        garageWalls(),
        // A garage door while it is down (garages.js).
        garageDoorSolids(),
        militarySolids(),
        countyStaticSolids,
        AIRPORT_SCENERY_SOLIDS,
        depotSolids(),
        harborSolids(),
      ];
      for (let i = 0; i < lists.length; i++)
        for (const block of lists[i])
          if (
            block.x <= maxX &&
            block.x + block.w >= minX &&
            block.y <= maxY &&
            block.y + block.h >= minY &&
            // Low harbor clutter (bollards, crates) does not block a line of sight.
            (i < 6 || block.height > 14) &&
            sightBlockedBy(block, a.x, a.y, start, dx, dy, dz)
          )
            return false;
      return true;
    }
    function policeSees(o) {
      if (o.airUnit) return !harborPoliceProtected(player.x, player.y, 30) && airCanSee(o, player);
      return (
        !harborPoliceProtected(player.x, player.y, 30) &&
        !playerOnRoof() &&
        o.hp > 0 &&
        !personIncapacitated(o) &&
        !o.crewLost &&
        Math.hypot(o.x - player.x, o.y - player.y, entityElevation(o) - entityElevation(player)) <
          440 &&
        clearSight(o, player)
      );
    }
    function deployOfficers(c) {
      // The tank and the army jeeps keep their crews aboard (pursuit.js).
      if (c.crewDeployed || c.crewLost || c.hp <= 0 || c.lawUnit === 'army' || c.lawUnit === 'armyJeep') return;
      c.crewDeployed = true;
      c.ai = false;
      c.vx = c.vy = c.speed = c.av = 0;
      c.crew = [];
      // A patrol car carries two, an agents' SUV three (they climb out on both
      // sides), a SWAT van four or five who file out of the rear doors behind a
      // shield (swat.js), an army APC four soldiers and a truck five (pursuit.js).
      const swat = c.lawUnit === 'swat',
        army = c.lawUnit === 'armyApc' || c.lawUnit === 'armyTruck',
        unit = swat ? 'swat' : c.lawUnit === 'fed' ? 'fed' : army ? 'soldier' : 'patrol',
        size = c.crewSize || 2,
        doors = [
          [-1, 0],
          [1, 0],
          [-1, -0.3],
          [1, -0.3],
          [-1, -0.55],
          [1, -0.55],
        ].slice(0, size),
        rear = swat || army ? swatDeploySpots(c, size) : null,
        team = {};
      if (swat) c.doorsOpenAt = gameTime;
      for (const [index, [side, back]] of doors.entries()) {
        let spawnPoint = rear ? rear[index] || null : null;
        // Patrol and agents' crews: the nearest free spot beside their door.
        for (const radius of rear ? [] : [25, 35, 47]) {
          const a = c.a + (side * Math.PI) / 2,
            p = {
              x: c.x + Math.cos(a) * radius + Math.cos(c.a) * back * 60,
              y: c.y + Math.sin(a) * radius + Math.sin(c.a) * back * 60,
            };
          if (
            !harborPoliceProtected(p.x, p.y, 12) &&
            !solid(p.x, p.y, 8) &&
            !vehicles.some(
              (o) =>
                o !== c &&
                Math.abs(entityElevation(o) - terrainHeight(p.x, p.y)) < 20 &&
                pointInCar(p.x, p.y, o, 8),
            )
          ) {
            spawnPoint = p;
            break;
          }
        }
        if (!spawnPoint) continue;
        const o = makeOfficer(spawnPoint.x, spawnPoint.y, c.a, unit, {
          car: c,
          timer: 0.8 + c.crew.length * 0.2,
          gangTarget: c.gangTarget || null,
          gangSeenAt: gameTime,
          gangLastSeen: c.gangLastSeen,
        });
        // Patrol officers wear a light vest; at four stars and up a heavier one.
        if (unit === 'patrol' && wantedStars >= 4) o.vest = 60;
        if (swat) equipSwatOperator(o, c.crew.length, team);
        officers.push(o);
        c.crew.push(o);
      }
      if (!c.crew.length) {
        c.crewDeployed = false;
        return;
      }
      radio(policeChallengeLine(), c);
    }
    function footStepTowards(o, target, deltaSeconds, speed) {
      if (personIncapacitated(o)) return;
      if (o.limping) speed *= 0.6;
      let a = headingBetween(o, target),
        dx = Math.cos(a) * speed * deltaSeconds,
        dy = Math.sin(a) * speed * deltaSeconds;
      if (moveBody(o, dx, dy, 8)) {
        for (const turn of [1, -1]) {
          const aa = a + (turn * Math.PI) / 2;
          if (!solid(o.x + Math.cos(aa) * 22, o.y + Math.sin(aa) * 22, 8)) {
            moveBody(o, Math.cos(aa) * speed * deltaSeconds, Math.sin(aa) * speed * deltaSeconds, 8);
            break;
          }
        }
      }
      o.a = a;
      o.walk += deltaSeconds * strideRate(speed);
    }
