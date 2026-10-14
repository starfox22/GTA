// Previous broadphase gate selection, retained as an independent ordered-contact reference.
    function vehicleBroadphase(pc) {
      // Vehicles that are far from the player, barely moving and untouched for a while
      // "rest": they skip static-contact passes (they cannot have moved into a wall).
      // A pilotless helicopter coming down (abandonedFlight) has no way on but is
      // falling: it must not rest, or it hung in the air two seconds after the
      // pilot died or restarted the job.
      for (const c of vehicles) {
        const still =
            Math.abs(c.vx || 0) + Math.abs(c.vy || 0) < 0.6 && Math.abs(c.av || 0) < 0.02 && !c.abandonedFlight,
          far = Math.abs(c.x - player.x) > 1700 || Math.abs(c.y - player.y) > 1700;
        c.restSteps = still && c !== pc ? (c.restSteps || 0) + 1 : 0;
        c.farFromPlayer = far;
        c.resting = c.restSteps > 24 && (far || c.restSteps > 240);
      }
      // Broadphase: vehicles bucketed by 96-unit cell into a fixed 64 x 64 table
      // (cells 6,144 units apart share a bucket; such a pair is dropped by the
      // distance check before any contact test). The buckets are kept between
      // steps (this runs 120 times a second) and emptied lazily: one is reset
      // when first used in a step, its stamp being stale. Each holds `n` entries and the
      // pair lists `broadphasePairCount`: they are never emptied with `length = 0`, which
      // frees the backing store, so every step then grew every list again from nothing
      // (some 80 KB of garbage a step with the traffic round the player).
      const cells = broadphaseCells,
        pairA = broadphasePairA,
        pairB = broadphasePairB;
      const stamp = ++broadphaseStamp;
      let pairs = 0;
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
              list.n = 0;
            }
            for (let k = 0; k < list.n; k++) {
              const o = list[k];
              if (c.resting && o.resting) continue;
              if (x !== Math.max(x0, o.broadCellX) || y !== Math.max(y0, o.broadCellY)) continue;
              if (boat === !!isBoat(o) && Math.abs(level - (o.altitude || 0) - (o.groundHeight || 0)) < 19) {
                pairA[pairs] = c;
                pairB[pairs] = o;
                pairs++;
              }
            }
            list[list.n++] = c;
          }
      }
      broadphasePairCount = pairs;
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
