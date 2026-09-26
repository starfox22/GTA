    // physicsStep(): the fixed step, broadphase, contact passes, settling.
    // Rest flags, vehicle pairs, nearby walls and barriers for this step's contacts.
    function vehicleBroadphase(pc) {
      // Vehicles that are far from the player, barely moving and untouched for a while
      // "rest": they skip static-contact passes (they cannot have moved into a wall).
      for (const c of vehicles) {
        const still =
            Math.abs(c.vx || 0) + Math.abs(c.vy || 0) < 0.6 && Math.abs(c.av || 0) < 0.02,
          far = Math.abs(c.x - player.x) > 1700 || Math.abs(c.y - player.y) > 1700;
        c.restSteps = still && c !== pc ? (c.restSteps || 0) + 1 : 0;
        c.farFromPlayer = far;
        c.resting = c.restSteps > 24 && (far || c.restSteps > 240);
      }
      // Broadphase: vehicles bucketed by 96-unit cell into a fixed 64 x 64 table
      // (cells 6,144 units apart share a bucket; such a pair is dropped by the
      // distance check before any contact test). The buckets are kept between
      // steps (this runs 120 times a second) and emptied lazily: one is reset
      // when first used in a step, its stamp being stale.
      const cells = broadphaseCells,
        pairA = broadphasePairA,
        pairB = broadphasePairB;
      const stamp = ++broadphaseStamp;
      pairA.length = pairB.length = 0;
      for (let v = 0; v < vehicles.length; v++) {
        const c = vehicles[v],
          radius = vehicleRadius(c) + 2,
          boat = !!isBoat(c),
          level = (c.altitude || 0) + (c.groundHeight || 0),
          x0 = Math.floor((c.x - radius) / 96),
          y0 = Math.floor((c.y - radius) / 96);
        // A pair sharing several cells is taken once, in the first cell they share
        // (lowest column, then row), rather than de-duplicated through a set.
        c.broadCellX = x0;
        c.broadCellY = y0;
        for (let x = x0; x <= Math.floor((c.x + radius) / 96); x++)
          for (let y = y0; y <= Math.floor((c.y + radius) / 96); y++) {
            const list = cells[((x & 63) << 6) | (y & 63)];
            if (list.stamp !== stamp) {
              list.stamp = stamp;
              list.length = 0;
            }
            for (let k = 0; k < list.length; k++) {
              const o = list[k];
              if (c.resting && o.resting) continue;
              if (x !== Math.max(x0, o.broadCellX) || y !== Math.max(y0, o.broadCellY)) continue;
              if (boat === !!isBoat(o) && Math.abs(level - (o.altitude || 0) - (o.groundHeight || 0)) < 19) {
                pairA.push(c);
                pairB.push(o);
              }
            }
            list.push(c);
          }
      }
      for (let v = 0; v < vehicles.length; v++) {
        const c = vehicles[v];
        if (c.resting) continue;
        // The list is gathered with 28 units to spare and reused until the car has
        // moved 8 (nearbyStatics covers 20 beyond the body; the grid is versioned).
        const cache = c.contactStatics,
          throughShore = c === player.car && !isBoat(c) && !isAircraft(c);
        if (
          cache &&
          cache.throughShore === throughShore &&
          cache.version === staticGridVersion &&
          Math.abs(c.x - cache.x) < 8 &&
          Math.abs(c.y - cache.y) < 8
        ) {
          c.stepStatics = cache.list;
          continue;
        }
        // The cache record and its list are reused when the car re-gathers.
        const radius = vehicleRadius(c) + 40,
          list = cache ? cache.list : [];
        list.length = 0;
        // The quay edge stops everything with a driver who ought to know better.
        // The player's own car is not stopped by it: putting one in the bay is a
        // thing you are allowed to do, and then it floods.
        for (const b of nearbyStatics(c)) {
          if (throughShore && b.kind === 'coast') continue;
          const ca = Math.abs(Math.cos(b.a || 0)),
            sa = Math.abs(Math.sin(b.a || 0));
          if (
            Math.abs(c.x - b.x) < ca * b.hx + sa * b.hy + radius &&
            Math.abs(c.y - b.y) < sa * b.hx + ca * b.hy + radius
          )
            list.push(b);
        }
        c.stepStatics = list;
        if (cache) {
          cache.x = c.x;
          cache.y = c.y;
          cache.throughShore = throughShore;
          cache.version = staticGridVersion;
        } else c.contactStatics = { x: c.x, y: c.y, list, throughShore, version: staticGridVersion };
      }
      // Vinny's depot shutters open and close mid-mission, so they live outside
      // the baked static grid and are resolved from this short list.
      const depot = depotBarriers(),
        blockBodies = depot.length
          ? depot.map((r, i) => ({
              x: r.x + r.w / 2,
              y: r.y + r.h / 2,
              hx: r.w / 2,
              hy: r.h / 2,
              a: 0,
              height: r.height,
              kind: 'roadblock',
              id: 'block' + i,
            }))
          : noStatics;
      // The base gate and harbor barriers, for the few vehicles near them.
      const barrierCars = broadphaseBarrierCars,
        barrierBodies = broadphaseBarrierBodies;
      barrierCars.length = barrierBodies.length = 0;
      for (let v = 0; v < vehicles.length; v++) {
        const c = vehicles[v];
        if (isBoat(c) || (c.altitude || 0) >= 20) continue;
        if (inMilitary(c.x, c.y, 130))
          for (const r of militarySolids())
            if (r.barrier) {
              barrierCars.push(c);
              barrierBodies.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, hx: r.w / 2, hy: r.h / 2, a: 0, height: r.height, kind: 'military', id: 'basegate' });
            }
        if (inHarbor(c.x, c.y, 100))
          for (const r of harborSolids())
            if (r.barrier) {
              barrierCars.push(c);
              barrierBodies.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, hx: r.w / 2, hy: r.h / 2, a: 0, height: r.height, kind: 'harbor', id: 'port' + r.x + ',' + r.y });
            }
        for (let k = 0; k < blockBodies.length; k++) {
          const b = blockBodies[k];
          if (Math.abs(c.x - b.x) <= 90 && Math.abs(c.y - b.y) <= 90) {
            barrierCars.push(c);
            barrierBodies.push(b);
          }
        }
      }
      // The drawbridge's barrier arms and any leaf raised steeper than a ramp.
      drawbridgeBarrierBodies(barrierCars, barrierBodies);
    }
    // Up to seven relaxation passes over the pairs, barriers and walls found by
    // vehicleBroadphase().
    function vehicleContactPasses() {
      const pairA = broadphasePairA,
        pairB = broadphasePairB,
        barrierCars = broadphaseBarrierCars,
        barrierBodies = broadphaseBarrierBodies;
      // Seven relaxation passes. The first tests everything; later passes only
      // revisit bodies a contact moved in the pass before: a body nothing pushed
      // cannot have been pushed into anything new. At five stars this is most of
      // the saving with a street full of cruisers, wrecks and parked cars.
      for (let pass = 0; pass < 7; pass++) {
        contactPass = pass + 1;
        // A body is revisited in this pass if the pass before moved it.
        for (let k = 0; k < pairA.length; k++) {
          const a = pairA[k],
            b = pairB[k];
          if (pass !== 0 && a.contactPass !== pass && b.contactPass !== pass) continue;
          const radius = vehicleRadius(a) + vehicleRadius(b);
          if (Math.abs(a.x - b.x) > radius || Math.abs(a.y - b.y) > radius) continue;
          const hit = boxContact(contactShape(a), contactShape(b));
          if (hit) resolveContact(a, b, hit, null, pass === 0);
        }
        for (let k = 0; k < barrierCars.length; k++) {
          const c = barrierCars[k];
          if (pass !== 0 && c.contactPass !== pass) continue;
          const b = barrierBodies[k],
            hit = boxContact(contactShape(c), b);
          if (hit) resolveContact(c, null, hit, b, pass === 0);
        }
        for (let v = 0; v < vehicles.length; v++) {
          const c = vehicles[v];
          if (c.resting || (pass !== 0 && c.contactPass !== pass) || isBoat(c)) continue;
          const statics = c.stepStatics || noStatics;
          for (let k = 0; k < statics.length; k++) {
            const b = statics[k];
            if (
              (b.minHeight !== undefined &&
                entityElevation(c) + vehicleCollisionHeight(c) < b.minHeight) ||
              (isAircraft(c) && c.altitude > b.height + 8) ||
              (c.deckAir && c.deckLift > b.height + 1) ||
              (c.roofSite && b.building === c.roofSite)
            )
              continue;
            const hit = boxContact(contactShape(c), b);
            if (hit) resolveContact(c, null, hit, b, pass === 0);
          }
        }
      }
    }
    // After the contacts: harbor hold, kerbs and the shore, boats kept on water,
    // the terrain pose, and the player carried along.
    function settleVehicle(c, pc, stepSeconds) {
      if (
        lawVehicle(c) &&
        harborPoliceHold() &&
        boxContact(vehicleShape(c), {
          x: HARBOR.x + HARBOR.w / 2,
          y: HARBOR.y + HARBOR.h / 2,
          hx: HARBOR.w / 2,
          hy: HARBOR.h / 2,
          a: 0,
        })
      ) {
        c.x = c.stepStartX;
        c.y = c.stepStartY;
        c.a = c.stepStartA;
        c.vx = c.vy = c.av = 0;
        c.route = null;
        c.junction = null;
        c.navAngle = undefined;
      }
      // Only the player's own car may leave the land: into the surf off a
      // beach or over a quay into the bay, where it floods (water.js). A car that
      // has not moved this step (most are parked) needs no footprint re-check.
      // Park ponds (and the Central Garden boathouse) have a stone kerb that
      // stops every wheeled vehicle, the player's included: a car used to drive
      // into the Commons lake and leave its driver no dry ground to step out on.
      const moved = c.x !== c.stepStartX || c.y !== c.stepStartY || c.a !== c.stepStartA,
        wheeled = moved && c.type !== 'plane' && !(isAircraft(c) && c.altitude > 8) && !isBoat(c),
        nearPond = wheeled && parkPondNear(c.x, c.y, vehicleSpec(c).l);
      let intoPond = false;
      if (nearPond) {
        // More of the car over the water than at the start of the step: a car that
        // somehow starts with a wheel over the kerb can still back off it.
        const cornersInPond = (shape) => corners(shape).filter((p) => parkPondBlocked(p.x, p.y)).length,
          now = cornersInPond(vehicleShape(c));
        intoPond =
          now > 0 && now > cornersInPond({ ...vehicleShape(c), x: c.stepStartX, y: c.stepStartY, a: c.stepStartA });
      }
      if (intoPond || (wheeled && c !== player.car && (footprintOffGround(c) || drawbridgeKeepsOff(c)))) {
        // Hitting the pond's stone kerb at speed is a crash, not a soft stop.
        const hitSpeed = Math.hypot(c.vx || 0, c.vy || 0);
        // (Same severity as a wall in collisionImpact; the kerb is immovable.)
        if (intoPond && hitSpeed > 42 && physicsClock - (c.kerbHitAt || -9) > 0.5) {
          c.kerbHitAt = physicsClock;
          const nx = c.vx / hitSpeed,
            ny = c.vy / hitSpeed,
            reach = vehicleSpec(c).l / 2;
          damageVehicle(c, crashSeverity(c, hitSpeed), c.x + nx * reach, c.y + ny * reach, null, {
            kind: 'crash',
            nx: -nx,
            ny: -ny,
            closing: hitSpeed,
            otherMass: 0,
          });
          if (c === pc) shake = Math.max(shake, Math.min(10, hitSpeed / 40));
        }
        c.x = c.stepStartX;
        c.y = c.stepStartY;
        c.a = c.stepStartA;
        c.av = 0;
        c.vx *= -0.15;
        c.vy *= -0.15;
      }
      // A moored boat that has not moved still fits where it lies.
      if (isBoat(c) && moved && !boatFits(c)) {
        if (c.lastWater) {
          c.x = c.lastWater.x;
          c.y = c.lastWater.y;
          c.a = c.lastWater.a;
        }
        c.vx = c.vy = 0;
      } else if (isBoat(c) && (moved || !c.lastWater))
        c.lastWater = {
          x: c.x,
          y: c.y,
          a: c.a,
        };
      terrainVehiclePose(c, stepSeconds);
      // Drawbridge leaves as ramps, take-off, landing and the gap (drawbridge.js).
      drawbridgeSettle(c, stepSeconds);
      rotorStrikes(c, stepSeconds);
      c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
      if (c === player.car) {
        player.x = c.x;
        player.y = c.y;
        player.a = c.a;
        player.altitude = (c.altitude || 0) + (c.groundHeight || 0);
      }
    }
    function physicsStep(stepSeconds, active) {
      physicsClock += stepSeconds;
      const pc = player.car;
      let sectionStart = performance.now();
      const mark = (name) => {
        const now = performance.now();
        profile.parts[name] = (profile.parts[name] || 0) + now - sectionStart;
        sectionStart = now;
      };
      for (let v = 0; v < vehicles.length; v++) controlVehicle(vehicles[v], pc, stepSeconds, active);
      mark('phys:control');
      vehicleBroadphase(pc);
      mark('phys:broadphase');
      vehicleContactPasses();
      // Lamp posts, hydrants, bins and benches: solid until something heavy and fast
      // enough knocks them flat (damage.js).
      streetPropContacts();
      mark('phys:contacts');
      for (let v = 0; v < vehicles.length; v++) settleVehicle(vehicles[v], pc, stepSeconds);
      mark('phys:post');
    }
