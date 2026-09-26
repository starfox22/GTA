    // Vehicle fire, wrecks and per-frame damage upkeep (igniteVehicle, wreckVehicle, updateDamage) and knockable street props.
    // ---- Fire, wrecks and per-frame upkeep ------------------------------------------
    function canBurn(vehicle) {
      const type = damageClass(vehicle);
      // A flooding car cannot catch fire, and the bay puts out one that already has.
      return (
        (type === 'car' || type === 'truck' || type === 'bike' || type === 'tank') &&
        repairJob?.car !== vehicle &&
        !(vehicle.sinkFor > 0)
      );
    }
    // An engine fire gives the driver a few seconds; the player and mission cars a few more.
    function burnSeconds(vehicle) {
      return vehicle === player.car || vehicle.mission ? 11 : 7;
    }
    function igniteVehicle(vehicle) {
      vehicle.damage.burning = 0.001;
      vehicle.damageVersion++;
      if (distanceBetween(vehicle, player) < 500) noise(0.45, 0.12, 380);
    }
    // A burnt-out shell: glass gone, lamps dead, tyres burnt off, panels sprung.
    function wreckVehicle(vehicle) {
      const damage = ensureDamage(vehicle);
      damage.burnt = true;
      damage.burning = 0;
      damage.wreckedAt = gameTime;
      if (damageClass(vehicle) === 'car' || damageClass(vehicle) === 'truck') {
        for (const pane of Object.keys(damage.glass)) damage.glass[pane] = 2;
        for (const lamp of Object.keys(damage.lights)) damage.lights[lamp] = true;
        for (const tire of Object.keys(damage.tires)) damage.tires[tire] = true;
        const parts = damage.parts;
        parts.hood = Math.max(parts.hood, Math.random() < 0.45 ? 2 : 1);
        for (const door of ['doorLeft', 'doorRight']) if (Math.random() < 0.45) parts[door] = Math.max(parts[door], 1);
        if (Math.random() < 0.5) parts.trunk = Math.max(parts.trunk, 1);
        for (const [bumper, side] of [
          ['bumperFront', 'bumperFrontSide'],
          ['bumperRear', 'bumperRearSide'],
        ])
          if (!parts[bumper] && Math.random() < 0.6) {
            parts[bumper] = 1;
            damage[side] = Math.random() < 0.5 ? -1 : 1;
          }
      }
      vehicle.damageVersion = (vehicle.damageVersion || 0) + 1;
    }
    // Springs after a blast: the body is thrown up and rocks back to rest.
    function updateVehicleHop(vehicle, deltaSeconds) {
      const hop = vehicle.hop;
      if (!hop) return;
      hop.vz -= 520 * deltaSeconds;
      hop.z += hop.vz * deltaSeconds;
      if (hop.z <= 0) {
        hop.z = 0;
        hop.vz = hop.vz < -40 ? -hop.vz * 0.28 : 0;
      }
      hop.vp += (-hop.pitch * 95 - hop.vp * 6) * deltaSeconds;
      hop.vr += (-hop.roll * 95 - hop.vr * 6) * deltaSeconds;
      hop.pitch = clamp(hop.pitch + hop.vp * deltaSeconds, -0.5, 0.5);
      hop.roll = clamp(hop.roll + hop.vr * deltaSeconds, -0.5, 0.5);
      if (!hop.z && !hop.vz && Math.abs(hop.pitch) + Math.abs(hop.roll) + Math.abs(hop.vp) + Math.abs(hop.vr) < 0.01)
        vehicle.hop = null;
    }
    // Weight transfer for the renderer: the nose dives under braking, squats under
    // power, and the body rolls out of a turn. Smoothed like a damped suspension.
    function updateVehicleLoad(vehicle, deltaSeconds) {
      const along = vehicle.speed || 0,
        longitudinal = (along - (vehicle.loadSpeed ?? along)) / deltaSeconds,
        lateral = along * (vehicle.av || 0),
        k = 1 - Math.exp(-7 * deltaSeconds);
      vehicle.loadSpeed = along;
      vehicle.loadPitch = (vehicle.loadPitch || 0) + (clamp(longitudinal * 0.00011, -0.05, 0.05) - (vehicle.loadPitch || 0)) * k;
      vehicle.loadRoll = (vehicle.loadRoll || 0) + (clamp(-lateral * 0.0001, -0.055, 0.055) - (vehicle.loadRoll || 0)) * k;
    }
    // Paint scored along whatever the car is grinding against, with a spray of sparks.
    function updateScrape(vehicle) {
      const scrape = vehicle.scrape;
      if (!scrape || physicsClock - scrape.t > 0.08) return;
      if (gameTime - (vehicle.scrapeFxAt || -1) > 0.07) {
        vehicle.scrapeFxAt = gameTime;
        city3D?.sparks(scrape.x, scrape.y, entityElevation(vehicle) + 4.5, -scrape.ny, scrape.nx, clamp(scrape.speed / 40, 2, 8));
      }
      if (gameTime - (vehicle.scrapeMarkAt || -1) < 0.4) return;
      vehicle.scrapeMarkAt = gameTime;
      const type = damageClass(vehicle);
      if (type !== 'car' && type !== 'truck') return;
      const spec = vehicleSpec(vehicle),
        local = vehicleLocalPoint(vehicle, scrape.x, scrape.y),
        inward = vehicleLocalDirection(vehicle, -scrape.nx, -scrape.ny),
        damage = ensureDamage(vehicle),
        zone = damageZone(spec, local.x, local.y);
      addVehicleMark(vehicle, {
        kind: 'scrape',
        x: clamp(local.x, -spec.l / 2, spec.l / 2),
        y: clamp(local.y, -spec.w / 2, spec.w / 2),
        z: randomBetween(4.8, 7),
        dx: inward.x,
        dy: inward.y,
        size: clamp(scrape.speed / 25, 4, 9),
      });
      damage[zone] = clamp(damage[zone] + 0.01, 0, 1);
    }
    let damageClock = 0;
    function updateDamage(deltaSeconds) {
      if (deltaSeconds <= 0) return;
      damageClock += deltaSeconds;
      for (const c of vehicles) {
        const damage = c.damage;
        if (!damage?.parts) continue;
        const near = Math.abs(c.x - cameraTarget.x) < 1100 && Math.abs(c.y - cameraTarget.y) < 1100;
        if (c.hop) updateVehicleHop(c, deltaSeconds);
        if (near && !isAircraft(c) && !isBoat(c)) updateVehicleLoad(c, deltaSeconds);
        if (near && c.scrape) updateScrape(c);
        if (c.hp <= 0) {
          if (!damage.burnt) wreckVehicle(c);
          continue;
        }
        if (damage.burning && !canBurn(c)) damage.burning = 0;
        if (!damage.burning && !damage.fireSpent && c.hp < c.maxhp * BURN_THRESHOLD && canBurn(c))
          igniteVehicle(c);
        if (damage.burning) {
          damage.burning += deltaSeconds;
          c.hp = Math.max(0, c.hp - ((c.maxhp * BURN_THRESHOLD) / burnSeconds(c)) * deltaSeconds);
          // A vehicle a mission depends on (the job's truck, Elena's car, a repo)
          // does not burn itself out and fail the job on its own: the fire eats
          // the engine down to a smouldering wreck that still drives, then dies
          // out. Gunfire or a crash can still finish it off.
          if (c.mission && c.hp <= c.maxhp * MISSION_FIRE_FLOOR) {
            c.hp = Math.max(c.hp, 1);
            damage.burning = 0;
            damage.fireSpent = true;
            c.damageVersion++;
            if (c === player.car) tell('The engine fire burnt itself out · the car is barely holding together', 4);
          }
        }
        // A holed sump or radiator leaves a trail of drips to the kerb.
        const type = damageClass(c);
        if (
          near &&
          city3D &&
          (type === 'car' || type === 'truck') &&
          (c.hp < c.maxhp * 0.4 || damage.front > 0.6) &&
          damage.leaks < 40 &&
          c.altitude < 2 &&
          gameTime - (c.leakAt || -10) > (Math.abs(c.speed || 0) < 20 ? 3.5 : 0.9)
        ) {
          c.leakAt = gameTime;
          damage.leaks++;
          const spec = vehicleSpec(c),
            engine = vehicleWorldPoint(c, spec.l * 0.28, randomBetween(-3, 3));
          if (landAt(engine.x, engine.y))
            city3D.groundStain(engine.x, engine.y, entityElevation(c), 'oil', randomBetween(4, 7) + (Math.abs(c.speed || 0) < 20 ? 4 : 0));
        }
      }
      if (damageClock > 2) {
        damageClock = 0;
        restoreStreetProps();
      }
    }

    // ---- Street furniture ----------------------------------------------------------
    /**
     * BREAKABLE FURNITURE AND TREES
     * Every knockable piece is a standing prop: a small oriented box that stops a
     * vehicle like a wall until the vehicle brings enough energy to break it. The
     * energy is the vehicle's kinetic energy along the contact normal, 0.5 m v^2
     * (tonnes and m/s give kJ). Per kind:
     *   breakKJ   energy that snaps, bends, uproots or smashes it
     *   massKg    what it weighs; `carry` is the share the car pushes along once it
     *             has broken (a tree's crown falls on its own, a bin goes with you)
     *   material  metal, wood, plastic, glass, stone or fabric: sound and debris
     *   harm      extra hit points for the vehicle going through (a trunk, a post)
     * Going through, the car loses the energy it took to break the piece and then
     * shares its momentum with what it carries (knockStreetProp). A hit below
     * breakKJ is a crash into something solid (resolveContact, collisionImpact) and
     * strains the piece: half the energy is remembered, so a second or third ram
     * brings down what the first could not. A tank crushes anything it leans on.
     *
     * What that means at the wheel (sedan 1.45 t, box truck 6.8 t, tank 55 t):
     *   bins, cones, crates, news boxes, loungers, umbrellas: nothing stops you
     *   benches (8-10 kJ): anything above ~12 km/h; a truck at walking pace
     *   railings (25 kJ): a sedan from ~21 km/h, so the quay rail does not keep a
     *     car out of the harbour (the water then does what it does, water.js)
     *   hydrants, lamps, signals (25-90 kJ): a sedan from 21 / 33 / 40 km/h
     *   young street trees and palms (120-150 kJ): a sedan from ~47 km/h, a truck
     *     from ~22; mature trees (400 kJ) a sedan from ~85, a truck from ~39
     *   big old trees (1200 kJ): a sedan needs ~150 km/h (and is wrecked), a
     *     truck ~68, a bus ~52; the tank simply pushes them over
     *   steel bollards (600 kJ): stop a sedan below ~100 km/h, a truck below ~48
     */
    const STREET_PROP_KINDS = {
      cone: { half: [1.5, 1.5], breakKJ: 0.05, massKg: 3, carry: 1, material: 'plastic', harm: 0 },
      trash: { half: [2.6, 2.6], breakKJ: 1, massKg: 40, carry: 1, material: 'plastic', harm: 0 },
      crate: { half: [3, 3], breakKJ: 0.8, massKg: 25, carry: 1, material: 'wood', harm: 0 },
      news: { half: [1.8, 1.6], breakKJ: 2, massKg: 60, carry: 1, material: 'metal', harm: 0 },
      meter: { half: [0.8, 0.8], breakKJ: 5, massKg: 40, carry: 0.5, material: 'metal', harm: 1 },
      mailbox: { half: [2, 2], breakKJ: 6, massKg: 110, carry: 1, material: 'metal', harm: 2 },
      umbrella: { half: [1.2, 1.2], breakKJ: 0.3, massKg: 15, carry: 1, material: 'fabric', harm: 0 },
      lounger: { half: [10, 4], breakKJ: 0.6, massKg: 18, carry: 1, material: 'plastic', harm: 0 },
      bench: { half: [8.5, 2.6], breakKJ: 8, massKg: 80, carry: 1, material: 'wood', harm: 3 },
      // South Coast Cycle bike share (cycles.js): a docked bike goes over at a
      // walking pace; the dock rack (a bolted steel spine) bends from ~25 km/h in
      // a sedan and the payment totem from ~33.
      sharebike: { half: [12.5, 3.6], breakKJ: 1.2, massKg: 23, carry: 1, material: 'metal', harm: 0 },
      bikerack: { half: [24, 1.6], breakKJ: 35, massKg: 260, carry: 0.3, material: 'metal', harm: 5 },
      biketotem: { half: [3.6, 2.4], breakKJ: 60, massKg: 280, carry: 0.4, material: 'glass', harm: 8 },
      // The esplanade's timber benches on cast-iron ends.
      seat: { half: [10, 3], breakKJ: 10, massKg: 90, carry: 1, material: 'wood', harm: 3 },
      railing: { half: [10, 1.5], breakKJ: 25, massKg: 90, carry: 0.6, material: 'metal', harm: 4 },
      hydrant: { half: [1.7, 1.7], breakKJ: 25, massKg: 150, carry: 0.4, material: 'metal', harm: 8 },
      dumpster: { half: [8, 4], breakKJ: 45, massKg: 900, carry: 1, material: 'metal', harm: 6 },
      // The esplanade's lamp standards: a cast post and a glass globe.
      lantern: { half: [2.2, 2.2], breakKJ: 45, massKg: 200, carry: 0.4, material: 'glass', harm: 8 },
      lamp: { half: [1.3, 1.3], breakKJ: 60, massKg: 250, carry: 0.4, material: 'metal', harm: 10 },
      signal: { half: [1.4, 1.4], breakKJ: 90, massKg: 350, carry: 0.4, material: 'metal', harm: 14 },
      palm: { half: [2, 2], breakKJ: 150, massKg: 700, carry: 0.2, material: 'wood', harm: 16, tree: true },
      // A concrete tub with a young tree in it (the esplanade planters).
      planter: { half: [9, 9], breakKJ: 200, massKg: 1400, carry: 0.5, material: 'stone', harm: 25 },
      // Street and park trees: sized per tree by treeProp().
      tree: { half: [2.2, 2.2], breakKJ: 120, massKg: 900, carry: 0.2, material: 'wood', harm: 18, tree: true },
      bollard: { half: [0.9, 0.9], breakKJ: 600, massKg: 250, carry: 0.3, material: 'metal', harm: 12 },
    };
    const streetProps = [],
      streetPropGrid = new Map(),
      knockedProps = [],
      // Marks a bench nobody can sit on: it is lying on its back.
      BROKEN_BENCH = { hp: 1, broken: true };
    const PROP_CELL = 128;
    // Called by the renderer as it places each knockable piece; returns the record it
    // animates. `yaw` turns the collision box with the model; `options` may size the
    // piece (half extents, breakKJ, massKg, harm, size).
    function registerStreetProp(kind, x, y, yaw = 0, options = null) {
      const spec = STREET_PROP_KINDS[kind],
        prop = {
          id: 'p' + streetProps.length,
          kind,
          x,
          y,
          a: -yaw,
          hx: options?.half ? options.half[0] : spec.half[0],
          hy: options?.half ? options.half[1] : spec.half[1],
          breakKJ: options?.breakKJ ?? spec.breakKJ,
          massKg: options?.massKg ?? spec.massKg,
          harm: options?.harm ?? spec.harm,
          // A tree's crown radius (map units): how tall it falls, how big the stump.
          size: options?.size ?? 0,
          down: false,
          knockedAt: 0,
          fallA: 0,
          fallSpeed: 0,
          sprayUntil: 0,
          // Energy (kJ) of earlier hits that did not break it, and when the last came.
          strain: 0,
          strainAt: -9,
          body: null,
          // The last contact pass that looked at it (streetPropContacts), and the
          // last propsNear() query.
          visited: 0,
          nearStamp: 0,
        };
      streetProps.push(prop);
      // Filed in every cell the box reaches (a railing run can be longer than a cell).
      const reach = Math.hypot(prop.hx, prop.hy);
      for (let i = Math.floor((x - reach) / PROP_CELL); i <= Math.floor((x + reach) / PROP_CELL); i++)
        for (let j = Math.floor((y - reach) / PROP_CELL); j <= Math.floor((y + reach) / PROP_CELL); j++) {
          const key = i * 4096 + j;
          if (!streetPropGrid.has(key)) streetPropGrid.set(key, []);
          streetPropGrid.get(key).push(prop);
        }
      return prop;
    }
    // A tree as a breakable prop, by its crown radius `r` (the plan's `t.r`): a young
    // street tree snaps, a mature one needs a heavy or fast vehicle, a big old one
    // stops a car dead and falls only to a truck, a bus or the tank at speed.
    function treeProp(t) {
      const r = t.r || 12,
        conifer = t.pine ? 1.3 : 1,
        grade = r >= 22 ? 2 : r >= 16 ? 1 : 0;
      return registerStreetProp('tree', t.x, t.y, 0, {
        half: [[2.2, 2.6, 3.2][grade], [2.2, 2.6, 3.2][grade]],
        breakKJ: [120, 400, 1200][grade] * conifer,
        massKg: [900, 2000, 4500][grade] * conifer,
        harm: [18, 30, 45][grade],
        size: r,
      });
    }
    // Each prop once, though a long one is filed in several cells.
    let propNearStamp = 0;
    function propsNear(x, y, reach, visit) {
      const stamp = ++propNearStamp;
      for (let i = Math.floor((x - reach) / PROP_CELL); i <= Math.floor((x + reach) / PROP_CELL); i++)
        for (let j = Math.floor((y - reach) / PROP_CELL); j <= Math.floor((y + reach) / PROP_CELL); j++) {
          const list = streetPropGrid.get(i * 4096 + j);
          if (list)
            for (const prop of list)
              if (prop.nearStamp !== stamp) {
                prop.nearStamp = stamp;
                visit(prop);
              }
        }
    }
    // Once per physics step, after the contact passes: vehicles near the player against
    // standing furniture. Far away nothing is watching and traffic keeps to the road.
    // Each pair is met once per step even where a long prop sits in two cells.
    let propContactStamp = 0;
    function streetPropContacts() {
      if (!streetProps.length) return;
      for (let v = 0; v < vehicles.length; v++) {
        const c = vehicles[v];
        if (c.resting || isBoat(c) || (isAircraft(c) && aircraftClearance(c) > 4)) continue;
        if (Math.abs(c.x - player.x) > 1400 || Math.abs(c.y - player.y) > 1400) continue;
        // A car standing still (queued at a light, parked) cannot have run into
        // anything since the last step; most of the traffic near the player is.
        if (Math.abs(c.vx || 0) + Math.abs(c.vy || 0) < 0.6 && Math.abs(c.av || 0) < 0.02) continue;
        const spec = vehicleSpec(c),
          reach = (spec.l + spec.w) / 2 + 10,
          stamp = ++propContactStamp;
        const i0 = Math.floor((c.x - reach) / PROP_CELL),
          i1 = Math.floor((c.x + reach) / PROP_CELL),
          j0 = Math.floor((c.y - reach) / PROP_CELL),
          j1 = Math.floor((c.y + reach) / PROP_CELL);
        for (let i = i0; i <= i1; i++)
          for (let j = j0; j <= j1; j++) {
            const list = streetPropGrid.get(i * 4096 + j);
            if (!list) continue;
            for (let k = 0; k < list.length; k++) {
              const prop = list[k],
                far = reach + prop.hx + prop.hy;
              if (prop.down || prop.visited === stamp || Math.abs(prop.x - c.x) > far || Math.abs(prop.y - c.y) > far) continue;
              prop.visited = stamp;
              // The prop's collision box, made once (props never move while standing).
              const body =
                  prop.body ||
                  (prop.body = {
                    x: prop.x,
                    y: prop.y,
                    hx: prop.hx,
                    hy: prop.hy,
                    a: prop.a,
                    id: prop.id,
                    kind: 'prop',
                    material: STREET_PROP_KINDS[prop.kind].material,
                  }),
                hit = boxContact(contactShape(c), body);
              if (!hit) continue;
              const closing = (c.vx || 0) * hit.n.x + (c.vy || 0) * hit.n.y,
                metres = closing / UNITS_PER_METRE,
                // Kinetic energy along the normal, kJ (tonnes x (m/s)^2 / 2).
                energy = closing > 0 ? 0.5 * (spec.mass || 1.25) * metres * metres : 0;
              if (closing > 0 && (energy + prop.strain >= prop.breakKJ || (spec.tank && closing > UNITS_PER_METRE)))
                knockStreetProp(prop, c, closing, hit, energy);
              else {
                // Solid: a crash into it. A real hit (over ~11 km/h) strains it.
                if (metres > 3 && physicsClock - prop.strainAt > 0.3) {
                  prop.strain += energy * 0.5;
                  prop.strainAt = physicsClock;
                }
                resolveContact(c, null, hit, body, true);
              }
            }
          }
      }
    }
    function knockStreetProp(prop, vehicle, closing, hit, energy) {
      const kind = STREET_PROP_KINDS[prop.kind],
        spec = vehicleSpec(vehicle),
        mass = spec.mass || 1.25,
        speed = closing / UNITS_PER_METRE,
        // The energy the break takes out of the car, then the momentum it shares
        // with what it carries on (tonnes).
        absorbed = Math.min(energy, Math.max(0, prop.breakKJ - prop.strain)),
        carried = (kind.carry * prop.massKg) / 1000,
        after = (Math.sqrt(Math.max(0, speed * speed - (2 * absorbed) / mass)) * mass) / (mass + carried),
        taken = Math.max(0, speed - after) * UNITS_PER_METRE;
      vehicle.vx -= hit.n.x * taken;
      vehicle.vy -= hit.n.y * taken;
      const moving = Math.hypot(vehicle.vx || 0, vehicle.vy || 0) > 5;
      topple(prop, moving ? Math.atan2(vehicle.vy, vehicle.vx) : Math.atan2(hit.n.y, hit.n.x), closing);
      // The crumple the speed change buys (physics.js CRASH SEVERITY) or the piece's
      // own bite (a trunk, a post), whichever is worse.
      const amount = Math.max(prop.harm * clamp(closing / 150, 0.5, 2) * (spec.tank ? 0.1 : 1), crashSeverity(vehicle, taken));
      if (amount > 0.2)
        damageVehicle(vehicle, amount, hit.x, hit.y, null, {
          kind: 'crash',
          nx: -hit.n.x,
          ny: -hit.n.y,
          closing: 36 + Math.max(0, closing - 36) * clamp(prop.massKg / 1500, 0.15, 0.8),
          otherMass: prop.massKg / 1000,
        });
      if (vehicle === player.car) {
        shake = Math.max(shake, clamp(taken / 25, prop.massKg > 300 ? 1.5 : 0.3, 8));
        hurt(crashInjury(vehicle, taken), 'impact');
      }
      if (distanceBetween(prop, player) < 900) {
        crashSound({
          x: hit.x,
          y: hit.y,
          closing,
          mass,
          other: 'prop',
          material: kind.material,
          propKg: prop.massKg,
          tree: !!kind.tree,
          glass: kind.material === 'glass' || prop.kind === 'lamp' || prop.kind === 'signal' ? 1 : 0,
          sliding: 0,
          key: 'prop' + vehicle.id,
        });
        if (city3D) city3D.propDebris(prop, hit.x, hit.y, kind.material, entityElevation(vehicle), closing);
      }
    }
    function topple(prop, heading, speed) {
      prop.down = true;
      prop.knockedAt = gameTime;
      prop.fallA = heading;
      prop.fallSpeed = speed;
      if (prop.kind === 'hydrant') prop.sprayUntil = gameTime + 45;
      if (prop.bench) {
        // Whoever was sitting on it is up and running; nobody sits on it again until it is fixed.
        const sitter = prop.bench.taken;
        if (sitter && sitter !== BROKEN_BENCH && sitter.hp > 0) {
          sitter.sitting = false;
          sitter.walking = true;
          sitter.bench = null;
          sitter.state = 'walk';
          sitter.flee = 5;
        }
        prop.bench.taken = BROKEN_BENCH;
      }
      // A tree coming down: everyone near looks up and gets out from under it.
      if (STREET_PROP_KINDS[prop.kind].tree && gameMode === 'play')
        crowdAlarm('crash', { x: prop.x + Math.cos(heading) * prop.size, y: prop.y + Math.sin(heading) * prop.size }, null, 1.2);
      if (!knockedProps.includes(prop)) knockedProps.push(prop);
    }
    function blastStreetProps(x, y, power) {
      const reach = 75 * power;
      propsNear(x, y, reach, (prop) => {
        const distance = Math.hypot(prop.x - x, prop.y - y);
        if (prop.down || distance > reach) return;
        // A blast that would not have broken it only strains it.
        const push = 900 * power * (1 - distance / reach);
        if (push + prop.strain < prop.breakKJ) {
          prop.strain += push * 0.5;
          return;
        }
        topple(prop, Math.atan2(prop.y - y, prop.x - x), 260 * power * (1 - distance / reach));
      });
    }
    // The city puts its furniture back (and replants its trees) once nobody is looking.
    function restoreStreetProps() {
      for (let i = knockedProps.length - 1; i >= 0; i--) {
        const prop = knockedProps[i];
        if (gameTime - prop.knockedAt < 240 || distanceBetween(prop, cameraTarget) < 1100) continue;
        prop.down = false;
        prop.sprayUntil = 0;
        prop.strain = 0;
        if (prop.bench && prop.bench.taken === BROKEN_BENCH) prop.bench.taken = null;
        knockedProps.splice(i, 1);
      }
    }

    // ---- Developer console -------------------------------------------------------------
    function damageReport(vehicle) {
      if (!vehicle) return null;
      const damage = ensureDamage(vehicle),
        round = (v) => Math.round(v * 100) / 100;
      return {
        id: vehicle.id,
        type: vehicle.type,
        hp: Math.round(vehicle.hp),
        maxhp: vehicle.maxhp,
        zones: { front: round(damage.front), rear: round(damage.rear), left: round(damage.left), right: round(damage.right) },
        dents: vehicle.dents.map((d) => ({ x: round(d.x), y: round(d.y), depth: round(d.depth ?? d.force) })),
        parts: { ...damage.parts },
        glass: { ...damage.glass },
        lights: Object.keys(damage.lights).filter((k) => damage.lights[k]),
        flatTires: Object.keys(damage.tires).filter((k) => damage.tires[k]),
        marks: damage.marks.reduce((n, m) => ((n[m.kind] = (n[m.kind] || 0) + 1), n), {}),
        pull: round(vehicleHandling(vehicle).pull),
        handling: { ...vehicleHandling(vehicle) },
        burning: round(damage.burning),
        fireSpent: !!damage.fireSpent,
        burnt: damage.burnt,
        speed: Math.round(Math.hypot(vehicle.vx || 0, vehicle.vy || 0)),
        spin: round(vehicle.av || 0),
        x: Math.round(vehicle.x),
        y: Math.round(vehicle.y),
        a: round(vehicle.a),
      };
    }
    function damageConsole() {
      const find = (id) =>
        id === undefined ? player.car || null : vehicles.find((c) => c.id === id) || null;
      return {
        // Park an empty vehicle at an offset (map units) from the player; returns its id.
        park(type = 'sedan', dx = 90, dy = 0, heading = 0) {
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          return spawnClearCar(type, player.x + dx, player.y + dy, heading, false).id;
        },
        // Fire one round (or one shotgun load) of weapon `weaponIndex` (0 pistol, 1 machine
        // pistol, 2 shotgun, 4 rifle, 5 precision rifle) from the player at a map point.
        shootAt(x, y, weaponIndex = 0) {
          const w = weapons[weaponIndex];
          if (!w || w.melee) return 0;
          const a = Math.atan2(y - player.y, x - player.x),
            origin = player.car ? 30 : 14,
            ox = player.x + Math.cos(a) * origin,
            oy = player.y + Math.sin(a) * origin,
            altitude = entityElevation(player);
          for (let j = 0; j < (w.pellets || 1); j++) {
            const spread = a + randomBetween(-w.spread, w.spread);
            bullets.push({
              x: ox,
              y: oy,
              altitude,
              vx: Math.cos(spread) * w.speed,
              vy: Math.sin(spread) * w.speed,
              vz: 0,
              life: w.rocket ? 1.8 : weaponIndex === 5 ? 1 : 0.6,
              dmg: w.dmg,
              rocket: w.rocket,
              enemy: false,
            });
          }
          if (city3D) city3D.fire(ox, oy, a, w.rocket, altitude);
          return w.pellets || 1;
        },
        // Detonate at a map point; power 1 is a rocket, 0.65 a car's fuel tank.
        blast(x, y, power = 1) {
          explode(x, y, power, 'world', terrainHeight(x, y));
          return power;
        },
        /**
         * Crash test on open ground: the player takes a fresh `type` pointing east and
         * a parked `targetType` waits `gap` units ahead, turned so that its `side`
         * ('front', 'rear', 'left', 'right') faces the oncoming car; the player's car
         * is launched at `metersPerSecond` and the world runs for `seconds`. `offset`
         * shifts the target sideways for an off-centre hit. `throttle` false lets the
         * car coast instead of flooring it; with a short `gap` (150 by default) that
         * gives a true low-speed bump. Returns both damage reports. Pass targetType
         * null to drive at whatever is ahead.
         */
        crashTest(type = 'sedan', targetType = 'sedan', side = 'left', metersPerSecond = 30, seconds = 1.5, offset = 0, throttle = true, gap = 150) {
          if (player.car) exitCar();
          const car = spawnClearCar(type, player.x, player.y, 0, false);
          car.authorized = true;
          let target = null;
          if (targetType) {
            const heading = { front: Math.PI, rear: 0, left: -Math.PI / 2, right: Math.PI / 2 }[side] ?? 0;
            target = makeCar(targetType, car.x + gap, car.y + offset, heading, false);
          }
          enterVehicle(car);
          const speed = metersPerSecond * UNITS_PER_METRE;
          car.vx = speed;
          car.vy = 0;
          car.speed = speed;
          // Foot down all the way in, as a driver ramming something would.
          const steps = Math.round(clamp(seconds, 0, 20) * 30);
          keys.KeyW = !!throttle;
          for (let i = 0; i < steps && gameMode === 'play'; i++) update(1 / 30);
          keys.KeyW = false;
          return { car: damageReport(car), target: damageReport(target) };
        },
        // The damage state of a vehicle by id, or of the player's current vehicle.
        damageReport: (id) => damageReport(find(id)),
        // Nearest vehicle to a map point (for tests that shoot at a parked car).
        vehicleAt(x, y) {
          let best = null;
          for (const c of vehicles) if (!best || distanceBetween(c, { x, y }) < distanceBetween(best, { x, y })) best = c;
          return best ? { id: best.id, type: best.type, x: Math.round(best.x), y: Math.round(best.y), a: best.a } : null;
        },
        // Street furniture within `radius` of a point and whether it is still standing.
        streetProps(x = player.x, y = player.y, radius = 200) {
          const out = [];
          propsNear(x, y, radius, (p) => {
            if (Math.hypot(p.x - x, p.y - y) <= radius)
              out.push({
                id: p.id,
                kind: p.kind,
                x: Math.round(p.x),
                y: Math.round(p.y),
                a: Math.round(p.a * 100) / 100,
                half: [p.hx, p.hy],
                breakKJ: p.breakKJ,
                strain: Math.round(p.strain),
                size: p.size,
                down: p.down,
              });
          });
          out.sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y));
          const kinds = {};
          for (const p of streetProps) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
          return { total: streetProps.length, knocked: knockedProps.length, kinds, near: out };
        },
        // Shop windows (ground-floor panes) within `radius` of a point and their state.
        shopWindows(x = player.x, y = player.y, radius = 400) {
          const out = [];
          for (const b of buildings)
            for (const pane of b.shopPanes || [])
              if (Math.hypot(pane.cx - x, pane.face - y) <= radius)
                out.push({ x: Math.round(pane.cx), y: Math.round(pane.face), width: Math.round(pane.width), state: pane.state, building: { x: b.x, w: b.w, height: b.height, style: b.archetype } });
          return out.sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y)).slice(0, 12);
        },
        // Decal, debris and GPU memory counters from the renderer (damage3d.js).
        damageStats: () => (city3D ? city3D.damageInfo() : null),
        // The last crash sounds chosen (crash-audio.js): sample, set, gain, rate, layers.
        crashSounds: () => crashLog.slice(),
      };
    }
