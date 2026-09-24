    // BEGIN SUBSYSTEM: src/physics.js — Vehicle and pedestrian physics
    /**
     * Vehicle and pedestrian physics
     * Source: src/physics.js
     * Scope: shared game closure.
     * Fixed time steps, oriented collision boxes, contact impulses, traffic, damage and impact injuries.
     */
    /* Fixed-step rigid vehicle simulation. Collision correction never depends on damage timers. */
    let physicsAccumulator = 0,
      physicsClock = 0;
    const staticGrid = new Map(),
      staticBodies = [],
      impactContacts = new Map();
    function vehicleShape(c, margin = 0) {
      const vehicleDefinition = vehicleSpec(c);
      return {
        x: c.x,
        y: c.y,
        a: c.a,
        hx: vehicleDefinition.l / 2 + margin,
        hy: vehicleDefinition.w / 2 + margin,
        owner: c,
      };
    }
    function axes(b) {
      const headingCosine = Math.cos(b.a || 0),
        headingSine = Math.sin(b.a || 0);
      return [
        {
          x: headingCosine,
          y: headingSine,
        },
        {
          x: -headingSine,
          y: headingCosine,
        },
      ];
    }
    function corners(b) {
      const [u, v] = axes(b);
      return [-1, 1].flatMap((i) =>
        [-1, 1].map((j) => ({
          x: b.x + u.x * b.hx * i + v.x * b.hy * j,
          y: b.y + u.y * b.hx * i + v.y * b.hy * j,
        })),
      );
    }
    function boxContact(a, b) {
      if (
        Math.abs(a.x - b.x) > a.hx + a.hy + b.hx + b.hy ||
        Math.abs(a.y - b.y) > a.hx + a.hy + b.hx + b.hy
      )
        return null;
      const headingCosine = Math.cos(a.a || 0),
        headingSine = Math.sin(a.a || 0),
        headingCosine2 = Math.cos(b.a || 0),
        headingSine2 = Math.sin(b.a || 0);
      if (
        Math.abs(a.x - b.x) >
          Math.abs(headingCosine) * a.hx +
            Math.abs(headingSine) * a.hy +
            Math.abs(headingCosine2) * b.hx +
            Math.abs(headingSine2) * b.hy ||
        Math.abs(a.y - b.y) >
          Math.abs(headingSine) * a.hx +
            Math.abs(headingCosine) * a.hy +
            Math.abs(headingSine2) * b.hx +
            Math.abs(headingCosine2) * b.hy
      )
        return null;
      const aa = axes(a),
        bb = axes(b),
        delta = {
          x: b.x - a.x,
          y: b.y - a.y,
        };
      let depth = Infinity,
        n;
      for (const axis of [...aa, ...bb]) {
        const ra =
            a.hx * Math.abs(axis.x * aa[0].x + axis.y * aa[0].y) +
            a.hy * Math.abs(axis.x * aa[1].x + axis.y * aa[1].y),
          rb =
            b.hx * Math.abs(axis.x * bb[0].x + axis.y * bb[0].y) +
            b.hy * Math.abs(axis.x * bb[1].x + axis.y * bb[1].y),
          d = delta.x * axis.x + delta.y * axis.y,
          overlap = ra + rb - Math.abs(d);
        if (overlap <= 0) return null;
        if (overlap < depth) {
          depth = overlap;
          n = {
            x: axis.x * (d < 0 ? -1 : 1),
            y: axis.y * (d < 0 ? -1 : 1),
          };
        }
      }
      const ac = corners(a),
        bc = corners(b),
        project = (p, v) => p.x * v.x + p.y * v.y,
        t = {
          x: -n.y,
          y: n.x,
        },
        maxA = Math.max(...ac.map((p) => project(p, n))),
        minB = Math.min(...bc.map((p) => project(p, n)));
      const af = ac.filter((p) => maxA - project(p, n) < 0.05),
        bf = bc.filter((p) => project(p, n) - minB < 0.05);
      const av = af.map((p) => project(p, t)),
        bv = bf.map((p) => project(p, t));
      let side;
      if (af.length === 1) side = av[0];
      else if (bf.length === 1) side = bv[0];
      else
        side =
          (Math.max(Math.min(...av), Math.min(...bv)) + Math.min(Math.max(...av), Math.max(...bv))) / 2;
      const along = (maxA + minB) / 2;
      return {
        n,
        depth,
        x: n.x * along + t.x * side,
        y: n.y * along + t.y * side,
      };
    }
    function addStatic(x, y, w, h, height = 180, kind = 'building') {
      const b = {
        x: x + w / 2,
        y: y + h / 2,
        hx: w / 2,
        hy: h / 2,
        a: 0,
        height,
        kind,
        id: 's' + staticBodies.length,
      };
      staticBodies.push(b);
      for (let i = Math.floor(x / 256); i <= Math.floor((x + w) / 256); i++)
        for (let j = Math.floor(y / 256); j <= Math.floor((y + h) / 256); j++) {
          const key = i * 4096 + j;
          if (!staticGrid.has(key)) staticGrid.set(key, []);
          staticGrid.get(key).push(b);
        }
      return b;
    }
    // Numeric cell keys and a per-vehicle cache: a parked car asks for the same cells
    // 120 times a second, so the lookup is only repeated when it changes cell.
    function nearbyStatics(c) {
      const radius = Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) / 2 + 20,
        i0 = Math.floor((c.x - radius) / 256),
        i1 = Math.floor((c.x + radius) / 256),
        j0 = Math.floor((c.y - radius) / 256),
        j1 = Math.floor((c.y + radius) / 256),
        cacheKey = i0 * 1e9 + i1 * 1e6 + j0 * 1e3 + j1;
      if (c.staticCacheKey === cacheKey && c.staticCache && c.staticCacheVersion === staticGridVersion)
        return c.staticCache;
      const found = new Set();
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) {
          const list = staticGrid.get(i * 4096 + j);
          if (list) for (let k = 0; k < list.length; k++) found.add(list[k]);
        }
      c.staticCacheKey = cacheKey;
      c.staticCache = found;
      c.staticCacheVersion = staticGridVersion;
      return found;
    }
    let staticGridVersion = 0;
    function buildColliders() {
      staticGridVersion++;
      staticGrid.clear();
      staticBodies.length = 0;
      impactContacts.clear();
      physicsAccumulator = 0;
      addUnderpassColliders();
      addCountyColliders();
      for (const b of garageWalls()) addStatic(b.x, b.y, b.w, b.h, b.height, 'garage');
      for (const stand of STADIUM_STANDS)
        addStatic(stand.x, stand.y, stand.w, stand.h, stand.height, 'stadium');
      for (const fixture of SPORTS_FIXTURES) {
        addStatic(fixture.x, fixture.y, fixture.w, fixture.h, fixture.height, 'sports fixture');
        if (fixture.minHeight !== undefined) staticBodies.at(-1).minHeight = fixture.minHeight;
      }
      // Pitch fence, turnstiles, booths, bollards: vehicles stop here, people use the gates.
      for (const barrier of SPORTS_VEHICLE_BARRIERS)
        addStatic(barrier.x, barrier.y, barrier.w, barrier.h, barrier.height, barrier.id || 'stadium barrier');
      // The collider reaches 22 units above the roof; `building` lets a helicopter
      // parked on that roof be exempt from it (rooftops.js).
      for (const b of buildings) addStatic(b.x, b.y, b.w, b.h, b.height + 22).building = b;
      // Buildings kept outside `buildings` stop people through their own solid()
      // tests, but cars drove straight through them: the marina club, fuel dock
      // and cruise terminal, and the Sunset Pier arcade, games row, food court,
      // big wheel and carousel.
      for (const b of marinaSolids()) addStatic(b.x, b.y, b.w, b.h, b.height, 'marina');
      for (const b of parkSolids()) addStatic(b.x, b.y, b.w, b.h, b.height, 'pier');
      for (const [ride, radius, height] of [
        [PIER.wheel, 16, 90],
        [PIER.carousel, 12, 18],
      ])
        addStatic(ride.x - radius, ride.y - radius, radius * 2, radius * 2, height, 'pier');
      // Water contact follows the same irregular shores as the visible terrain.
      for (const e of buildCoastSegments()) {
        if (e.opening) continue;
        const b = {
          x: e.x,
          y: e.y,
          hx: e.length / 2,
          hy: 2.5,
          a: e.a,
          height: shoreStyle(e) === 'quay' ? 7 : 0,
          kind: 'coast',
          id: 's' + staticBodies.length,
        };
        staticBodies.push(b);
        const cs = corners(b),
          minx = Math.min(...cs.map((p) => p.x)),
          maxx = Math.max(...cs.map((p) => p.x)),
          miny = Math.min(...cs.map((p) => p.y)),
          maxy = Math.max(...cs.map((p) => p.y));
        for (let i = Math.floor(minx / 256); i <= Math.floor(maxx / 256); i++)
          for (let j = Math.floor(miny / 256); j <= Math.floor(maxy / 256); j++) {
            // The lookup grid is keyed numerically; a string key here meant shore
            // colliders were stored and never found, so coastlines stopped nothing.
            const key = i * 4096 + j;
            if (!staticGrid.has(key)) staticGrid.set(key, []);
            staticGrid.get(key).push(b);
          }
      }
      addStatic(
        HARBOR.ship.x - HARBOR.ship.w / 2,
        HARBOR.ship.y - HARBOR.ship.l / 2,
        HARBOR.ship.w,
        HARBOR.ship.l,
        75,
        'ship',
      );
      for (const b of harborSolids()) if (!b.barrier) addStatic(b.x, b.y, b.w, b.h, b.height, 'harbor');
      for (const d of DOCKS) addStatic(d.x, d.y, d.w, d.h, 2, 'dock');
      // Bridge rails and pylons are added with the county colliders (county.js).
    }
    function pointInCar(x, y, vehicle, margin = 0) {
      const dx = x - vehicle.x,
        dy = y - vehicle.y,
        vehicleDefinition = vehicleSpec(vehicle),
        reach = (vehicleDefinition.l + vehicleDefinition.w) / 2 + margin * 2;
      if (Math.abs(dx) > reach || Math.abs(dy) > reach) return false;
      const headingCosine = Math.cos(vehicle.a),
        headingSine = Math.sin(vehicle.a);
      return (
        Math.abs(dx * headingCosine + dy * headingSine) < vehicleDefinition.l / 2 + margin &&
        Math.abs(-dx * headingSine + dy * headingCosine) < vehicleDefinition.w / 2 + margin
      );
    }
    function safeLanding(c) {
      const slope = terrainSlope(c.x, c.y);
      if (Math.hypot(slope.x, slope.y) > 0.35) return false;
      if (harborVehicleBlocked(c) || militaryVehicleBlocked(c)) return false;
      const shape = vehicleShape(c, 5);
      if (corners(shape).some((p) => !groundAt(p.x, p.y, 2))) return false;
      if (Math.hypot(c.vx || 0, c.vy || 0) > 36) return false;
      for (const b of nearbyStatics(c))
        if (
          (b.minHeight === undefined ||
            terrainHeight(c.x, c.y) + vehicleCollisionHeight(c) >= b.minHeight) &&
          boxContact(shape, b)
        )
          return false;
      for (const o of vehicles)
        if (
          o !== c &&
          Math.abs((o.altitude || 0) + (o.groundHeight || 0) - terrainHeight(c.x, c.y)) < 20 &&
          boxContact(shape, vehicleShape(o, 3))
        )
          return false;
      return true;
    }
    // `detail` says what did the damage so damage.js can shape it: a crash crumples
    // along the contact normal, a blast dishes in the face toward it, a bullet only
    // holes the skin. Without a detail the hit dents toward the centre as before.
    function damageVehicle(vehicle, amount, x = vehicle.x, y = vehicle.y, source = null, detail = null) {
      if (vehicle.hp <= 0 || amount <= 0) return;
      if (source) {
        vehicle.lastDamagedAt = gameTime;
        vehicle.lastAttacker = source;
        if (vehicle.ai && vehicle.type !== 'police') {
          vehicle.panicUntil = gameTime + 9;
          vehicle.threat = {
            x: source.x,
            y: source.y,
          };
        }
      }
      if (vehicle.locked && !vehicle.lockBroken && source) breakVehicleLock(vehicle, source);
      vehicle.hp = Math.max(0, vehicle.hp - amount);
      vehicle.damageVersion = (vehicle.damageVersion || 0) + 1;
      vehicle.sprite = null;
      recordVehicleDamage(vehicle, amount, x, y, detail);
    }
    function repairVehicle(vehicle) {
      vehicle.hp = vehicle.maxhp;
      vehicle.damage = freshDamage();
      vehicle.dents = [];
      vehicle.hop = null;
      vehicle.damageVersion = (vehicle.damageVersion || 0) + 1;
      vehicle.deadTime = 0;
      vehicle.sprite = null;
    }
    function collisionImpact(a, b, hit, closing, key, staticBody = null) {
      if (closing < 42) return;
      const last = impactContacts.get(key);
      if (last && physicsClock - last.time < 0.24) return;
      impactContacts.set(key, {
        time: physicsClock,
      });
      crowdCrash(a, b, hit, closing);
      const severity = Math.pow(Math.max(0, closing - 38), 1.12) * 0.062;
      // The contact normal points from a to b, so each body is crushed back along it
      // toward its own middle; how far depends on the closing speed and on how heavy
      // the other side is (a wall or a braced cruiser counts as immovable).
      const crash = (self, other, sign) => ({
        kind: 'crash',
        nx: -hit.n.x * sign,
        ny: -hit.n.y * sign,
        closing,
        otherMass: other ? vehicleSpec(other).mass || 1.25 : 0,
      });
      for (const [self, other, sign] of b ? [[a, b, 1], [b, a, -1]] : [[a, null, 1]]) {
        const amount =
          self.type === 'plane' && self.altitude > 2 ? Math.max(severity, closing * 0.9) : severity;
        if (self.hp > 0) damageVehicle(self, amount, hit.x, hit.y, null, crash(self, other, sign));
        else crumpleWreck(self, hit.x, hit.y, crash(self, other, sign));
      }
      if (!b && staticBody) structureImpact(a, hit, closing, staticBody);
      if (distanceBetween(a, player) < 650) {
        particle(hit.x, hit.y, '#ddd1b4', clamp(closing / 18, 3, 16), 85, 3);
        if (city3D) city3D.impact(hit.x, hit.y, 'metal');
        noise(0.09 + closing * 0.0002, clamp(closing * 0.0008, 0.08, 0.32), 950);
      }
      if (a === player.car || b === player.car) {
        shake = Math.min(10, closing * 0.022);
        hurt(severity * (VEHICLE_DEFINITIONS[player.car?.type]?.bike ? 0.4 : 0.075), 'impact');
        if (closing > 130) radio('look-out');
        if (b && !a.cop && !b.cop) crime(0.06);
        // Whoever was going faster did the ramming: the wreck is theirs, and
        // ramming a police car is assault on an officer (heat.js).
        const other = a === player.car ? b : a;
        // Contact from a chasing unit (PIT, box, ram): counted for policeReport().
        if (other?.cop && other.pursuitPlan && !other.blockade) {
          pursuitStats.contacts++;
          if (other.pursuitPlan.mode === 'pit') pursuitStats.pits++;
        }
        if (
          other &&
          Math.hypot(player.car?.vx || 0, player.car?.vy || 0) > Math.hypot(other.vx || 0, other.vy || 0)
        ) {
          other.lastAttacker = player;
          other.lastDamagedAt = gameTime;
          if (
            (other.type === 'police' || other.lawUnit) &&
            !other.stolen &&
            closing > 70 &&
            gameTime - (other.rammedByPlayerAt ?? -100) > 1.5
          ) {
            other.rammedByPlayerAt = gameTime;
            crime(wantedStars > 0 ? 0.35 : 0.6);
          }
        }
      }
    }
    function resolveContact(a, b, hit, staticBody = null, record = true) {
      const n = hit.n;
      let inverseMassA = 1 / (vehicleSpec(a).mass || 1.25),
        inverseMassB = b ? 1 / (vehicleSpec(b).mass || 1.25) : 0;
      // A braced roadblock cruiser is an anchor for this contact unless the other
      // vehicle hits it hard and heavy enough to knock it loose (roadblocks.js).
      if (b && !!a.braced !== !!b.braced) {
        const anchor = a.braced ? a : b,
          closing = -(((b.vx || 0) - (a.vx || 0)) * n.x + ((b.vy || 0) - (a.vy || 0)) * n.y);
        if (roadblockHolds(anchor, anchor === a ? b : a, closing)) {
          if (anchor === a) inverseMassA = 0;
          else inverseMassB = 0;
        }
      }
      const inverseInertiaA = (inverseMassA * 12) / (vehicleSpec(a).l ** 2 + vehicleSpec(a).w ** 2),
        inverseInertiaB = b ? (inverseMassB * 12) / (vehicleSpec(b).l ** 2 + vehicleSpec(b).w ** 2) : 0;
      const contactOffsetA = {
          x: hit.x - a.x,
          y: hit.y - a.y,
        },
        contactOffsetB = b
          ? {
              x: hit.x - b.x,
              y: hit.y - b.y,
            }
          : {
              x: 0,
              y: 0,
            };
      const ax = (a.vx || 0) - (a.av || 0) * contactOffsetA.y,
        ay = (a.vy || 0) + (a.av || 0) * contactOffsetA.x,
        bx = b ? (b.vx || 0) - (b.av || 0) * contactOffsetB.y : 0,
        by = b ? (b.vy || 0) + (b.av || 0) * contactOffsetB.x : 0,
        rvx = bx - ax,
        rvy = by - ay,
        normal = rvx * n.x + rvy * n.y;
      if (normal < 0) {
        const normalTorqueArmA = contactOffsetA.x * n.y - contactOffsetA.y * n.x,
          normalTorqueArmB = contactOffsetB.x * n.y - contactOffsetB.y * n.x,
          denom =
            inverseMassA +
            inverseMassB +
            normalTorqueArmA * normalTorqueArmA * inverseInertiaA +
            normalTorqueArmB * normalTorqueArmB * inverseInertiaB,
          restitution = normal < -60 ? 0.12 : 0,
          impulse = (-(1 + restitution) * normal) / denom;
        a.vx -= n.x * impulse * inverseMassA;
        a.vy -= n.y * impulse * inverseMassA;
        a.av -= normalTorqueArmA * impulse * inverseInertiaA;
        if (b) {
          b.vx += n.x * impulse * inverseMassB;
          b.vy += n.y * impulse * inverseMassB;
          b.av += normalTorqueArmB * impulse * inverseInertiaB;
        }
        // An off-centre hit leaves the car yawing. Nobody's steering input can
        // cancel that at once, so the driver loses authority for a moment and the
        // car spins out instead of snapping back to its heading (physicsStep).
        const kickA = Math.abs(normalTorqueArmA * impulse * inverseInertiaA),
          kickB = Math.abs(normalTorqueArmB * impulse * inverseInertiaB);
        if (kickA > 0.55) a.spinUntil = physicsClock + clamp(kickA * 0.32, 0.25, 1.1);
        if (b && kickB > 0.55) b.spinUntil = physicsClock + clamp(kickB * 0.32, 0.25, 1.1);
        // Sheet metal on sheet metal grips harder than a tyre-scuffed wall face.
        const friction = b ? 0.3 : 0.23,
          tx = -n.y,
          ty = n.x,
          ta = contactOffsetA.x * ty - contactOffsetA.y * tx,
          tb = contactOffsetB.x * ty - contactOffsetB.y * tx,
          sliding = rvx * tx + rvy * ty,
          tangentImpulse = clamp(
            -sliding /
              (inverseMassA + inverseMassB + ta * ta * inverseInertiaA + tb * tb * inverseInertiaB),
            -impulse * friction,
            impulse * friction,
          );
        // Grinding along a wall or another car: damage.js throws sparks and scores the paint.
        if (record && Math.abs(sliding) > 70) {
          const scrape = { x: hit.x, y: hit.y, t: physicsClock, speed: Math.abs(sliding), nx: n.x, ny: n.y };
          a.scrape = scrape;
          if (b) b.scrape = { ...scrape, nx: -n.x, ny: -n.y };
        }
        a.vx -= tx * tangentImpulse * inverseMassA;
        a.vy -= ty * tangentImpulse * inverseMassA;
        a.av -= ta * tangentImpulse * inverseInertiaA;
        if (b) {
          b.vx += tx * tangentImpulse * inverseMassB;
          b.vy += ty * tangentImpulse * inverseMassB;
          b.av += tb * tangentImpulse * inverseInertiaB;
        }
        if (record)
          collisionImpact(
            a,
            b,
            hit,
            -normal,
            b ? 'c' + Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id) : a.id + ':' + staticBody.id,
            staticBody,
          );
      }
      const correction = (Math.max(0, hit.depth - 0.015) * 0.9) / (inverseMassA + inverseMassB);
      a.x -= n.x * correction * inverseMassA;
      a.y -= n.y * correction * inverseMassA;
      if (b) {
        b.x += n.x * correction * inverseMassB;
        b.y += n.y * correction * inverseMassB;
      }
      a.av = clamp(a.av, -3, 3);
      if (b) b.av = clamp(b.av, -3, 3);
    }
    function trafficSignal(x, y) {
      const phase =
        (((physicsClock + Math.round(x / BLOCK_SIZE) * 3 + Math.round(y / BLOCK_SIZE) * 5) % 24) + 24) %
        24;
      return {
        horizontal: phase < 9 ? 'green' : phase < 11 ? 'amber' : 'red',
        vertical: phase >= 12 && phase < 21 ? 'green' : phase >= 21 && phase < 23 ? 'amber' : 'red',
      };
    }
    function trafficRoadValid(x, y, a, reach = 260) {
      const u = {
          x: Math.cos(a),
          y: Math.sin(a),
        },
        r = {
          x: -u.y,
          y: u.x,
        };
      for (let d = 80; d <= reach + 79; d += 80) {
        const step = Math.min(d, reach),
          px = x + u.x * step + r.x * 25,
          py = y + u.y * step + r.y * 25;
        if (!cityStreetAt(px, py) || !groundAt(px, py, 20) || solid(px, py, 16) || inHarbor(px, py, 50))
          return false;
      }
      return true;
    }
    function trafficExitValid(x, y, a) {
      if (!trafficRoadValid(x, y, a, BLOCK_SIZE)) return false;
      const nx = x + Math.cos(a) * BLOCK_SIZE,
        ny = y + Math.sin(a) * BLOCK_SIZE;
      return [a, a + Math.PI / 2, a - Math.PI / 2].some((q) => trafficRoadValid(nx, ny, q, BLOCK_SIZE));
    }
    function trafficSpawnValid(x, y, a) {
      const headingCosine = Math.cos(a),
        headingSine = Math.sin(a),
        vertical = Math.abs(headingSine) > 0.5,
        sign = vertical ? Math.sign(headingSine) : Math.sign(headingCosine),
        value = vertical ? y : x,
        next = (vertical ? ROAD_ROWS : ROAD_CENTERS)
          .filter((v) => (v - value) * sign > 2)
          .sort((a, b) => (a - b) * sign)[0];
      if (next === undefined) return false;
      const nx = vertical ? roadNear(x) : next,
        ny = vertical ? next : rowNear(y);
      if (![a, a + Math.PI / 2, a - Math.PI / 2].some((q) => trafficExitValid(nx, ny, q))) return false;
      for (let d = 0; d < Math.abs(next - value); d += 32) {
        const px = x + headingCosine * d,
          py = y + headingSine * d;
        if (!cityStreetAt(px, py) || !groundAt(px, py, 20) || solid(px, py, 16) || inHarbor(px, py, 50))
          return false;
      }
      return true;
    }
    function planJunction(c, x, y, a) {
      const options = [a, a + Math.PI / 2, a - Math.PI / 2].filter((q) => trafficExitValid(x, y, q));
      if (!options.length) return null;
      let exit = options[0];
      if (options.length > 1 && seededRandom() < 0.24) exit = randomChoice(options.slice(1));
      const u = {
          x: Math.cos(a),
          y: Math.sin(a),
        },
        r = {
          x: -u.y,
          y: u.x,
        },
        v = {
          x: Math.cos(exit),
          y: Math.sin(exit),
        },
        rr = {
          x: -v.y,
          y: v.x,
        };
      const start = {
          x: x - u.x * 125 + r.x * 25,
          y: y - u.y * 125 + r.y * 25,
        },
        end = {
          x: x + v.x * 125 + rr.x * 25,
          y: y + v.y * 125 + rr.y * 25,
        },
        points = [];
      const turn = Math.abs(normalizeAngle(exit - a)) > 0.5;
      if (turn) {
        const delta = {
            x: end.x - start.x,
            y: end.y - start.y,
          },
          cross = u.x * v.y - u.y * v.x,
          k = (delta.x * v.y - delta.y * v.x) / cross,
          control = {
            x: start.x + u.x * k,
            y: start.y + u.y * k,
          };
        for (let i = 1; i <= 12; i++) {
          const t = i / 12;
          points.push({
            x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
            y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
          });
        }
      } else points.push(end);
      return {
        x,
        y,
        a,
        exit,
        points,
        index: 0,
        turn,
        committed: false,
      };
    }
    function trafficControl(c, stepSeconds) {
      // A driver who decided to answer a gunshot with the accelerator.
      if (c.ramUntil > gameTime && gameMode === 'play') {
        c.hazard = true;
        c.junction = null;
        return ramControl(c);
      }
      if (c.ramUntil) {
        c.ramUntil = 0;
        c.navAngle = undefined;
      }
      if (c.navAngle === undefined) c.navAngle = (Math.round(c.a / (Math.PI / 2)) * Math.PI) / 2;
      const vehicleDefinition = vehicleSpec(c),
        nav = c.navAngle,
        headingCosine = Math.cos(nav),
        headingSine = Math.sin(nav),
        vertical = Math.abs(headingSine) > 0.5,
        sign = vertical ? Math.sign(headingSine) : Math.sign(headingCosine),
        value = vertical ? c.y : c.x;
      const next = (vertical ? ROAD_ROWS : ROAD_CENTERS)
        .filter((v) => (v - value) * sign > 2)
        .sort((a, b) => (a - b) * sign)[0];
      let desired = c.panicUntil > gameTime ? 120 : 65 + (c.id % 4) * 7,
        target;
      if (c.panicUntil > gameTime) c.hazard = true;
      else c.hazard = false;
      if (
        !c.junction &&
        next !== undefined &&
        Math.abs(next - value) < 190 &&
        Math.abs(next - value) > 90
      ) {
        const x = vertical ? roadNear(c.x) : next,
          y = vertical ? next : rowNear(c.y);
        c.junction = planJunction(c, x, y, nav);
      }
      const j = c.junction;
      if (j) {
        const progress = (j.x - c.x) * headingCosine + (j.y - c.y) * headingSine,
          signal = trafficSignal(j.x, j.y)[vertical ? 'vertical' : 'horizontal'],
          gap = progress - 88 - vehicleDefinition.l / 2;
        const occupied = vehicles.some(
          (o) =>
            o !== c &&
            o.hp > 0 &&
            o.junction?.committed &&
            Math.abs(o.junction.x - j.x) < 5 &&
            Math.abs(o.junction.y - j.y) < 5 &&
            Math.abs(o.x - j.x) < 110 + vehicleSpec(o).l / 2 &&
            Math.abs(o.y - j.y) < 110 + vehicleSpec(o).l / 2 &&
            (Math.abs(normalizeAngle(o.junction.a - j.a)) > 0.2 || o.junction.turn || j.turn),
        );
        const headingCosine3 = Math.cos(j.exit),
          headingSine3 = Math.sin(j.exit),
          end = j.points[j.points.length - 1];
        const exitBlocked = vehicles.some((o) => {
          if (o === c || isBoat(o) || (o.altitude || 0) > 20 || Math.abs(o.speed) > 18) return false;
          const dx = o.x - end.x,
            dy = o.y - end.y;
          return (
            Math.abs(-dx * headingSine3 + dy * headingCosine3) <
              (vehicleDefinition.w + vehicleSpec(o).w) / 2 + 7 &&
            Math.abs(dx * headingCosine3 + dy * headingSine3) <
              (vehicleDefinition.l + vehicleSpec(o).l) / 2 + 22
          );
        });
        if (!j.committed && gap < 25 && signal === 'green' && !occupied && !exitBlocked)
          j.committed = true;
        if (!j.committed) {
          desired = Math.min(
            desired,
            Math.sqrt(2 * 230 * Math.max(0, gap - 3)) * 0.82,
            Math.max(0, gap - 6) * 1.25,
          );
          if (gap < 3) desired = 0;
          target = {
            x: c.x + headingCosine * 75 + (vertical ? roadNear(c.x) - sign * 25 - c.x : 0),
            y: c.y + headingSine * 75 + (!vertical ? rowNear(c.y) + sign * 25 - c.y : 0),
          };
        } else {
          while (j.index < j.points.length - 1 && distanceBetween(c, j.points[j.index]) < 24) j.index++;
          target = j.points[j.index];
          if (j.turn) desired = Math.min(desired, vehicleDefinition.truck ? 34 : 46);
          if (distanceBetween(c, j.points[j.points.length - 1]) < 26) {
            c.navAngle = normalizeAngle(j.exit);
            c.junction = null;
          }
        }
      } else {
        target = vertical
          ? {
              x: roadNear(c.x) - sign * 25,
              y: c.y + sign * 85,
            }
          : {
              x: c.x + sign * 85,
              y: rowNear(c.y) + sign * 25,
            };
        if (
          !trafficRoadValid(
            c.x - headingCosine * 80 + headingSine * 25,
            c.y - headingSine * 80 - headingCosine * 25,
            nav,
          )
        )
          desired = 0;
      }
      const da = normalizeAngle(headingBetween(c, target) - c.a);
      desired *= clamp(1 - Math.abs(da) * 0.45, 0.25, 1);
      const headingCosine2 = Math.cos(c.a),
        headingSine2 = Math.sin(c.a),
        rx = -headingSine2,
        ry = headingCosine2,
        half = vehicleDefinition.l / 2,
        side = vehicleDefinition.w / 2,
        through = c.junction?.committed && c.junction.turn ? c.junction : null,
        // The rest of a committed turn, carried on 120 units down the exit lane so
        // a car stopped just past the corner still holds us back.
        pathAhead = through && [
          ...through.points.slice(through.index),
          ...[40, 80, 120].map((d) => ({
            x: through.points.at(-1).x + Math.cos(through.exit) * d,
            y: through.points.at(-1).y + Math.sin(through.exit) * d,
          })),
        ],
        ease = { amount: 0, side: 1 },
        // How far right of its lane's centre line the car is (the target sits on it).
        laneOffset = -((target.x - c.x) * rx + (target.y - c.y) * ry),
        // Nothing in the oncoming lane (left of us) from just behind to well past
        // the obstacle, moving or not: room to pull out round it.
        oncomingClear = (obstacle, reach) =>
          !vehicles.some((v) => {
            if (v === c || v === obstacle || isBoat(v) || (v.altitude || 0) > 20) return false;
            const vx = v.x - c.x,
              vy = v.y - c.y,
              ahead = vx * headingCosine2 + vy * headingSine2,
              left = -(vx * rx + vy * ry);
            return ahead > -60 && ahead < reach + 260 && left > 6 && left < 80;
          });
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 20 || isBoat(o) || distanceBetween(c, o) > 350) continue;
        let standoff = 0;
        const dx = o.x - c.x,
          dy = o.y - c.y,
          along = dx * headingCosine2 + dy * headingSine2,
          lateral = Math.abs(dx * rx + dy * ry),
          vehicleDefinition2 = vehicleSpec(o),
          headingCosine3 = Math.cos(o.a),
          headingSine3 = Math.sin(o.a),
          ol =
            (Math.abs(headingCosine3 * headingCosine2 + headingSine3 * headingSine2) *
              vehicleDefinition2.l) /
              2 +
            (Math.abs(-headingSine3 * headingCosine2 + headingCosine3 * headingSine2) *
              vehicleDefinition2.w) /
              2,
          ow =
            (Math.abs(headingCosine3 * rx + headingSine3 * ry) * vehicleDefinition2.l) / 2 +
            (Math.abs(-headingSine3 * rx + headingCosine3 * ry) * vehicleDefinition2.w) / 2;
        if (along <= 0 || lateral > side + ow + 4) continue;
        // Mid-turn the look-ahead box swings across the cross street and the kerb,
        // and found cars waiting there for us to clear the junction (each then
        // waited for the other for ever) or parked at the kerb beside our exit.
        // While committed, a car only counts if it stands on the rest of our path.
        if (
          pathAhead &&
          !pathAhead.some((p) => {
            const px = p.x - o.x,
              py = p.y - o.y;
            return (
              Math.abs(px * headingCosine3 + py * headingSine3) < vehicleDefinition2.l / 2 + side + 4 &&
              Math.abs(-px * headingSine3 + py * headingCosine3) < vehicleDefinition2.w / 2 + side + 4
            );
          })
        )
          continue;
        // A parked car, a wreck, a double-parked delivery van or a car its driver
        // walked away from: nobody is coming back to move it. Ease across the lane
        // past one poking a little way in from the kerb; pull out round one that
        // fills the lane when the oncoming lane is clear and no junction is near.
        // Traffic used to queue behind any of them for ever.
        if (!through && !o.ai && !o.cop && o !== player.car && Math.abs(o.speed || 0) < 5) {
          // Measured from our lane's centre line, not from where we are now: the
          // shift must hold while we pull across, or it shrinks as we move.
          const laneLateral = laneOffset + dx * rx + dy * ry,
            intrusion = side + ow + 4 - Math.abs(laneLateral),
            overtake =
              intrusion >= 12 && intrusion < 38 && laneLateral > -12 && !c.junction && oncomingClear(o, along);
          if (intrusion < 12 || overtake) {
            // Pass on the left of anything in the middle of the lane.
            const passLeft = overtake || laneLateral >= 0,
              shift = side + ow + 4 + (passLeft ? -laneLateral : laneLateral);
            if (shift > ease.amount) {
              ease.amount = shift;
              ease.side = passLeft ? 1 : -1;
            }
            if (intrusion < 12 || lateral > side + ow || along - half - ol > 45) continue;
            // Caught close behind it still in line: creep out round it rather than
            // stopping, which would leave the car unable to turn out at all.
            desired = Math.min(desired, 20);
            continue;
          }
          // Waiting for the oncoming lane to clear: hold back far enough to pull out.
          if (intrusion < 38 && laneLateral > -12) standoff = 40;
        }
        const gap = along - half - ol - 12 - standoff,
          lead = Math.max(0, (o.vx || 0) * headingCosine2 + (o.vy || 0) * headingSine2);
        desired = Math.min(
          desired,
          Math.sqrt(2 * 250 * Math.max(0, gap)) * 0.72,
          lead + Math.max(0, gap - 8) * 1.25,
        );
      }
      // Give crossing pedestrians and an innocent player time to clear the lane.
      // Runs 120 times a second per car, so it scans in place without building arrays
      // and skips anyone farther than the look-ahead box before doing any trigonometry.
      const yieldTo = (p) => {
        if (p.hp <= 0 || p.roof) return;
        const dx = p.x - c.x,
          dy = p.y - c.y;
        if (dx > 150 || dx < -150 || dy > 150 || dy < -150) return;
        const along = dx * headingCosine2 + dy * headingSine2,
          lateral = Math.abs(dx * rx + dy * ry);
        // Only people out on the carriageway: mid-turn the look-ahead box sweeps
        // across the pavement, and a bus used to wait for ever on walkers who
        // were themselves waiting at the kerb for it to clear.
        if (along > 0 && along < 140 && lateral < side + 11 && cityStreetAt(p.x, p.y))
          desired = Math.min(desired, Math.sqrt(2 * 260 * Math.max(0, along - half - 22)) * 0.7);
      };
      forEachPedestrianNear(c.x, c.y, 160, yieldTo);
      if (!player.car) yieldTo(player);
      // Pulling in for a fare or a bus stop, or stopped after a crash (src/crowd.js).
      desired = Math.min(desired, curbsideStop(c));
      // Steer for a point shifted away from whatever was easing us across the lane.
      const steerA = ease.amount
        ? normalizeAngle(
            headingBetween(c, {
              x: target.x - rx * ease.side * (ease.amount + 1),
              y: target.y - ry * ease.side * (ease.amount + 1),
            }) - c.a,
          )
        : da;
      return {
        steer: clamp(steerA * 3, -1.7, 1.7),
        desired: Math.max(0, desired),
      };
    }
    function helicopterControl(c, stepSeconds, active) {
      if (c.abandonedFlight && c !== player.car) {
        // A pilotless helicopter settling onto a flat roof it fits on lands there.
        const site = (c.roofSite = helicopterRoofSite(c)),
          floor = site ? Math.max(site.height, terrainHeight(c.x, c.y)) : terrainHeight(c.x, c.y);
        let surface = floor,
          blocked = false;
        for (const b of nearbyStatics(c))
          if (b.height > surface && (!site || b.building !== site) && boxContact(vehicleShape(c), b)) {
            surface = b.height;
            blocked = true;
          }
        c.vx *= Math.exp(-stepSeconds * 0.3);
        c.vy *= Math.exp(-stepSeconds * 0.3);
        c.av *= Math.exp(-stepSeconds);
        c.a += c.av * stepSeconds;
        c.vz = Math.max(-110, (c.vz || 0) - 32 * stepSeconds);
        const next = c.altitude + c.vz * stepSeconds;
        if (next <= surface) {
          const sink = -c.vz,
            speed = Math.hypot(c.vx, c.vy),
            slope = terrainSlope(c.x, c.y);
          c.altitude = surface;
          if (
            blocked ||
            (!site && !groundAt(c.x, c.y, 8)) ||
            (!site && Math.hypot(slope.x, slope.y) > 0.35) ||
            sink > 36 ||
            speed > 45
          )
            damageVehicle(c, c.maxhp, c.x, c.y, 'world');
          else damageVehicle(c, Math.max(0, sink - 14) * 3, c.x, c.y, 'world');
          c.vx = c.vy = c.vz = c.av = 0;
          c.abandonedFlight = false;
        } else c.altitude = next;
        c.rotorSpeed = Math.max(0, (c.rotorSpeed || 0) - stepSeconds * 0.3);
        c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
        return;
      }
      if (c.airUnit && c.hp > 0) {
        policeHelicopterControl(c, stepSeconds);
        return;
      }
      // A wreck continues its emergency descent, but cannot receive powered flight
      // or yaw commands while the player is still aboard waiting to bail out.
      const controlled = c === player.car && active && c.hp > 0;
      let forward = 0,
        turn = 0,
        lift = 0;
      if (controlled) {
        forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
        turn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        lift = (keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0);
      }
      if (c.hp <= 0) lift = -1;
      c.av += (turn * 1.6 - c.av) * Math.min(1, stepSeconds * 4);
      c.a += c.av * stepSeconds;
      // Over a flat roof that the whole airframe fits on, the roof is the floor.
      const site = helicopterRoofSite(c),
        floor = site ? Math.max(site.height, terrainHeight(c.x, c.y)) : terrainHeight(c.x, c.y),
        landingClear = () => (site ? roofLandingClear(c, site) : safeLanding(c)),
        // About 1400 m, above the cloud tops (clouds3d.js).
        ceiling = 7200,
        clearance = c.altitude - floor;
      const flying = clearance > 1 || lift > 0,
        desired = flying ? forward * VEHICLE_DEFINITIONS.helicopter.max : 0,
        along = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
      const acceleration = clamp((desired - along) * 1.8, -140, 140);
      c.vx += Math.cos(c.a) * acceleration * stepSeconds;
      c.vy += Math.sin(c.a) * acceleration * stepSeconds;
      c.vx *= Math.exp(-stepSeconds * 0.45);
      c.vy *= Math.exp(-stepSeconds * 0.45);
      // Climb and descent quicken once well clear of the rooftops, so the cloud
      // layer is a half-minute climb rather than a minute; low flying is unchanged.
      const climbRate = 75 + clamp(clearance - 400, 0, 3000) * 0.035;
      c.vz += (lift * climbRate - c.vz) * Math.min(1, stepSeconds * 3);
      let next = clamp(c.altitude + c.vz * stepSeconds, floor, ceiling);
      c.roofSite = site;
      if (c.hp > 0 && next < floor + 20 && clearance >= 20 && !landingClear()) {
        next = floor + 20;
        c.vz = 0;
        if (controlled && physicsClock - (c.landingWarning || -100) > 3) {
          c.landingWarning = physicsClock;
          tell('Landing blocked. Slow down and find clear, open ground.', 2.5);
        }
      }
      if (c.hp > 0 && clearance < 20 && lift < 0 && !landingClear()) {
        next = c.altitude;
        c.vz = 0;
      }
      c.altitude = next;
      if (next === floor) {
        c.vz = 0;
        c.vx *= Math.exp(-stepSeconds * 6);
        c.vy *= Math.exp(-stepSeconds * 6);
      }
      if (next === ceiling) c.vz = Math.min(0, c.vz);
      c.rotorSpeed = clamp((c.rotorSpeed || 0) + (controlled && c.hp > 0 ? 1 : -1) * stepSeconds, 0, 1);
      c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
    }
    function boatControl(c, stepSeconds, active) {
      const vehicleDefinition = vehicleSpec(c),
        controlled = c === player.car && active,
        up = controlled && (keys.KeyW || keys.ArrowUp),
        down = controlled && (keys.KeyS || keys.ArrowDown),
        turn = controlled
          ? (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
          : 0,
        brake = controlled && keys.Space,
        headingCosine = Math.cos(c.a),
        headingSine = Math.sin(c.a),
        along = c.vx * headingCosine + c.vy * headingSine;
      let force = up
        ? vehicleDefinition.acc
        : down
          ? along > 8
            ? -120
            : -vehicleDefinition.acc * 0.55
          : 0;
      if (
        (along > vehicleDefinition.max * (0.65 + (0.35 * c.hp) / c.maxhp) && up) ||
        (along < -65 && down)
      )
        force = 0;
      if (c.hp <= 0) force = 0;
      c.vx += headingCosine * force * stepSeconds;
      c.vy += headingSine * force * stepSeconds;
      // Wet tarmac lets the back end go earlier and stretches the stopping distance.
      const road = isBoat(c) || isAircraft(c) ? 1 : wetGrip(),
        lateral = -c.vx * headingSine + c.vy * headingCosine,
        grip = 1 - Math.exp(-stepSeconds * 2.4 * road);
      c.vx += headingSine * lateral * grip;
      c.vy -= headingCosine * lateral * grip;
      const drag = Math.exp(-(brake ? 2.5 * road : 0.3) * stepSeconds);
      c.vx *= drag;
      c.vy *= drag;
      c.av +=
        (turn * vehicleDefinition.turn * clamp(Math.abs(along) / 70, 0.15, 1) * Math.sign(along || 1) -
          c.av) *
        Math.min(1, stepSeconds * 2);
      const nextA = c.a + c.av * stepSeconds;
      if (boatFits(c, c.x, c.y, nextA)) c.a = nextA;
      else c.av = 0;
    }
    const noStatics = [];
    function physicsStep(stepSeconds, active) {
      physicsClock += stepSeconds;
      const pc = player.car;
      let sectionStart = performance.now();
      const mark = (name) => {
        const now = performance.now();
        profile.parts[name] = (profile.parts[name] || 0) + now - sectionStart;
        sectionStart = now;
      };
      for (const c of vehicles) {
        const vehicleDefinition = vehicleSpec(c);
        c.stepStartX = c.x;
        c.stepStartY = c.y;
        c.stepStartA = c.a;
        // A parked car a long way off with nothing driving it has nothing to
        // integrate: skipping its control and integration is what keeps a city
        // with hundreds of kerbside vehicles and bicycles affordable.
        if (c.resting && c !== pc && !c.ai && !c.cop && !c.taxiHire && c.hp > 0) continue;
        if (c.vx === undefined) {
          c.vx = Math.cos(c.a) * c.speed;
          c.vy = Math.sin(c.a) * c.speed;
        }
        c.av = c.av || 0;
        if (repairJob?.car === c) {
          c.vx = c.vy = c.av = c.speed = 0;
        } else if (c.type === 'plane') {
          planeControl(c, stepSeconds, active);
        } else if (isBoat(c)) {
          boatControl(c, stepSeconds, active);
        } else if (c.type === 'helicopter') {
          helicopterControl(c, stepSeconds, active);
        } else {
          if (
            c.cop &&
            !c.crewDeployed &&
            !c.blockade &&
            active &&
            (!player.car || isAircraft(player.car)) &&
            wantedStars > 0
          ) {
            const d = distanceBetween(c, player),
              toward = (player.x - c.x) * c.vx + (player.y - c.y) * c.vy;
            if (d < 140 && toward > 0) {
              const speed = Math.hypot(c.vx, c.vy),
                limit = clamp((d - 48) * 1.2, 0, 80);
              if (speed > limit) {
                const f = limit / Math.max(1, speed);
                c.vx *= f;
                c.vy *= f;
                c.speed = limit;
              }
            }
          }
          const headingCosine = Math.cos(c.a),
            headingSine = Math.sin(c.a),
            along = c.vx * headingCosine + c.vy * headingSine,
            lateral = -c.vx * headingSine + c.vy * headingCosine;
          let acceleration = 0,
            steer = 0,
            grip = 7,
            drag = 0.72;
          if (c.hp > 0 && c === pc && active) {
            const up = keys.KeyW || keys.ArrowUp,
              down = keys.KeyS || keys.ArrowDown,
              brake = keys.Space,
              turn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
            // A bicycle has no engine: holding W pedals, and the push the rider's
            // legs give tapers off toward the top speed (pedalDrive, cycles.js).
            const pedalled = !!vehicleDefinition.bicycle,
              sprint = pedalled && cycleSprinting(),
              topSpeed = vehicleDefinition.max * (sprint ? CYCLE_SPRINT_TOP : 1),
              // A hurt engine pulls weaker, flat tyres and a bent front end cap the
              // speed and drag the car to one side (damage.js vehicleHandling).
              handling = vehicleHandling(c);
            acceleration =
              up && !pedalled
                ? (vehicleDefinition.acc * handling.power) / (1 + (c.cargoCount || 0) * 0.1)
                : down
                  ? along > 10
                    ? -(vehicleDefinition.brake || 285)
                    : -vehicleDefinition.acc * 0.6
                  : pedalled
                    ? pedalDrive(along, topSpeed)
                    : 0;
            if (
              (along > vehicleDefinition.max * (0.65 + (0.35 * c.hp) / c.maxhp) * handling.top &&
                up &&
                !pedalled) ||
              (along < -(pedalled ? CYCLE_REVERSE_MAX : 95) && down)
            )
              acceleration = 0;
            grip = brake ? 1.9 : (vehicleDefinition.grip || 7) * handling.grip;
            drag = pedalled
              ? brake
                ? 2.4
                : 0.22
              : brake
                ? 2.1
                : up || down
                  ? onRoad(c.x, c.y)
                    ? 0.1
                    : 0.65
                  : 0.72;
            steer =
              (turn *
                vehicleDefinition.turn *
                clamp(Math.abs(along) / 65, vehicleDefinition.tank ? 0.72 : 0, 1) *
                Math.sign(along || 1) *
                (brake ? 1.35 : 1)) /
              (1 + Math.pow(Math.abs(along) / 240, 1.5));
            steer += handling.pull * clamp(Math.abs(along) / 160, 0, 1) * Math.sign(along || 1) * 0.45;
            if (brake && Math.abs(along) > 80 && Math.floor(physicsClock * 40) !== c.lastSkid) {
              c.lastSkid = Math.floor(physicsClock * 40);
              for (const side of [-1, 1])
                skids.push({
                  x: c.x - headingSine * side * 9,
                  y: c.y + headingCosine * side * 9,
                  a: Math.atan2(c.vy, c.vx),
                  len: Math.abs(along) / 40 + 2,
                  life: 35,
                });
            }
          } else if (
            c.hp > 0 &&
            !c.pursuitTarget &&
            c.gangTarget?.hp > 0 &&
            lawVehicle(c) &&
            !c.crewLost &&
            !c.crewDeployed &&
            active
          ) {
            const target = c.gangTarget,
              d = distanceBetween(c, target),
              da = normalizeAngle(headingBetween(c, target) - c.a);
            steer = clamp(da * 2.5, -1.8, 1.8);
            const desired = clamp((d - 150) * 1.5, 0, 180);
            acceleration = clamp((desired - along) * 4, -650, vehicleDefinition.acc);
            drag = 0.3;
          } else if (
            c.hp > 0 &&
            c.cop &&
            !c.crewDeployed &&
            active &&
            wantedStars > 0 &&
            !harborPoliceProtected(player.x, player.y, 30)
          ) {
            // Intercepts, PIT and boxing, search sweeps and stuck recovery (pursuit.js).
            const control = pursuitControl(c, stepSeconds, along, vehicleDefinition);
            steer = control.steer;
            acceleration = control.acceleration;
            drag = control.drag;
          } else if (c.hp > 0 && c.ai && !c.crewDeployed) {
            // Traffic decisions are cached: 20 Hz near the player, 4 Hz for distant cars.
            const ai =
              c.aiControl && physicsClock < (c.aiControlAt || 0)
                ? c.aiControl
                : ((c.aiControl = c.countyRoute
                    ? countyRouteControl(c)
                    : trafficControl(c, stepSeconds)),
                  (c.aiControlAt = physicsClock + (c.farFromPlayer ? 0.25 : 0.05)),
                  c.aiControl);
            const handling = vehicleHandling(c);
            steer = ai.steer;
            acceleration = clamp(
              (ai.desired * handling.top - along) * 5,
              -400,
              vehicleDefinition.acc * handling.power,
            );
            drag = 0.15;
          } else if (c.blockade && !c.braced) {
            // A roadblock cruiser shoved loose by a rammer slides and slews on
            // locked wheels before it scrubs to a halt.
            drag = 1.5;
            grip = 2.2;
          } else {
            drag = c.crewDeployed ? 9 : 1.8;
            grip = 4;
          }
          const terrain = roadVehicleTerrain(c);
          if (terrain) {
            const slope = Math.hypot(terrain.slope.x, terrain.slope.y),
              power = terrain.traction;
            acceleration *= power;
            if (Math.abs(along) > terrain.limit && acceleration * along > 0) acceleration = 0;
            grip *= terrain.four ? 0.82 : 0.48;
            drag = Math.max(drag, terrain.trail ? 0.7 : 1.3);
            const tractionLimit = terrain.four ? (terrain.trail ? 0.62 : 0.72) : 0.15,
              slide = Math.max(0, slope - tractionLimit);
            c.vx -= terrain.slope.x * (64 + slide * 150) * stepSeconds;
            c.vy -= terrain.slope.y * (64 + slide * 150) * stepSeconds;
          }
          c.vx += headingCosine * acceleration * stepSeconds;
          c.vy += headingSine * acceleration * stepSeconds;
          // Tyres cancel sideways slip, but only up to what they can grip: about 60
          // units/s² per point of grip. Normal cornering never reaches the limit; a car
          // punted sideways by a T-bone or a blast skates across the lane and scrubs
          // off instead of stopping dead as if glued to the road.
          const lateralLimit = Math.max(grip, 5) * 62 * stepSeconds,
            traction = clamp(lateral * (1 - Math.exp(-grip * stepSeconds)), -lateralLimit, lateralLimit);
          c.vx += headingSine * traction;
          c.vy -= headingCosine * traction;
          c.vx *= Math.exp(-drag * stepSeconds);
          c.vy *= Math.exp(-drag * stepSeconds);
          // Rammed roadblock cruisers keep their spin a little longer: nobody is steering.
          // So does any car just spun by an off-centre hit (resolveContact sets spinUntil).
          const yawAuthority =
            c.blockade && !c.braced ? 1.4 : physicsClock < (c.spinUntil || 0) ? 1.1 : 5;
          c.av += (steer - c.av) * (1 - Math.exp(-yawAuthority * stepSeconds));
          c.a = normalizeAngle(c.a + c.av * stepSeconds);
          c.moveA = Math.atan2(c.vy, c.vx);
          c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
        }
        if (isBoat(c)) {
          const nx = c.x + c.vx * stepSeconds,
            ny = c.y + c.vy * stepSeconds;
          if (boatFits(c, nx, ny)) {
            c.x = nx;
            c.y = ny;
          } else {
            const speed = Math.hypot(c.vx, c.vy);
            if (speed > 45 && physicsClock - (c.bankHit || -100) > 0.4) {
              damageVehicle(c, (speed - 40) * 0.035, nx, ny);
              c.bankHit = physicsClock;
            }
            if (boatFits(c, nx, c.y)) {
              c.x = nx;
              c.vy = 0;
            } else if (boatFits(c, c.x, ny)) {
              c.y = ny;
              c.vx = 0;
            } else {
              c.vx *= -0.12;
              c.vy *= -0.12;
            }
          }
        } else {
          c.x += c.vx * stepSeconds;
          c.y += c.vy * stepSeconds;
        }
        if (isAircraft(c) && c.altitude < terrainHeight(c.x, c.y)) {
          if (c.type === 'plane') {
            const slope = terrainSlope(c.x, c.y),
              sink = Math.max(15, slope.x * c.vx + slope.y * c.vy - (c.vz || 0));
            planeTouchdown(c, sink);
          } else {
            const slope = terrainSlope(c.x, c.y),
              m = Math.hypot(slope.x, slope.y);
            c.x = c.stepStartX;
            c.y = c.stepStartY;
            if (m > 0.001) {
              const nx = slope.x / m,
                ny = slope.y / m,
                inward = Math.max(0, c.vx * nx + c.vy * ny);
              c.vx -= nx * inward;
              c.vy -= ny * inward;
            }
            c.altitude = Math.max(c.altitude, terrainHeight(c.x, c.y));
          }
        }
      }
      // A spatial hash provides solid contacts for every car, including stationary wrecks.
      mark('phys:control');
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
      const cells = new Map(),
        pairs = [],
        seen = new Set();
      for (const c of vehicles) {
        const radius = Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) / 2 + 2;
        for (let x = Math.floor((c.x - radius) / 96); x <= Math.floor((c.x + radius) / 96); x++)
          for (let y = Math.floor((c.y - radius) / 96); y <= Math.floor((c.y + radius) / 96); y++) {
            const key = x * 65536 + y;
            let list = cells.get(key);
            if (!list) cells.set(key, (list = []));
            for (const o of list) {
              if (c.resting && o.resting) continue;
              const pk = Math.min(c.id, o.id) * 1e6 + Math.max(c.id, o.id);
              if (
                !seen.has(pk) &&
                !!isBoat(c) === !!isBoat(o) &&
                Math.abs(
                  (c.altitude || 0) + (c.groundHeight || 0) - (o.altitude || 0) - (o.groundHeight || 0),
                ) < 19
              ) {
                seen.add(pk);
                pairs.push([c, o]);
              }
            }
            list.push(c);
          }
      }
      const staticCandidates = new Map();
      for (const c of vehicles) {
        if (c.resting) continue;
        const radius = Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) / 2 + 12,
          list = [];
        // The quay edge stops everything with a driver who ought to know better.
        // The player's own car is not stopped by it: putting one in the bay is a
        // thing you are allowed to do, and then it floods.
        const throughShore = c === player.car && !isBoat(c) && !isAircraft(c);
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
        staticCandidates.set(c, list);
      }
      // Vinny's depot shutters open and close mid-mission, so they live outside
      // the baked static grid and are resolved from this short list.
      const blockBodies = depotBarriers().map((r, i) => ({
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        hx: r.w / 2,
        hy: r.h / 2,
        a: 0,
        height: r.height,
        kind: 'roadblock',
        id: 'block' + i,
      }));
      mark('phys:broadphase');
      for (let pass = 0; pass < 7; pass++) {
        for (const [a, b] of pairs) {
          const radius =
            Math.hypot(vehicleSpec(a).l, vehicleSpec(a).w) / 2 +
            Math.hypot(vehicleSpec(b).l, vehicleSpec(b).w) / 2;
          if (Math.abs(a.x - b.x) > radius || Math.abs(a.y - b.y) > radius) continue;
          const hit = boxContact(vehicleShape(a), vehicleShape(b));
          if (hit) resolveContact(a, b, hit, null, pass === 0);
        }
        for (const c of vehicles) {
          if (!isBoat(c) && (c.altitude || 0) < 20 && inMilitary(c.x, c.y, 130))
            for (const r of militarySolids().filter((r) => r.barrier)) {
              const b = {
                x: r.x + r.w / 2,
                y: r.y + r.h / 2,
                hx: r.w / 2,
                hy: r.h / 2,
                a: 0,
                height: r.height,
                kind: 'military',
                id: 'basegate',
              };
              const hit = boxContact(vehicleShape(c), b);
              if (hit) resolveContact(c, null, hit, b, pass === 0);
            }
        }
        for (const c of vehicles) {
          if (!isBoat(c) && (c.altitude || 0) < 20 && inHarbor(c.x, c.y, 100))
            for (const r of harborSolids().filter((r) => r.barrier)) {
              const b = {
                x: r.x + r.w / 2,
                y: r.y + r.h / 2,
                hx: r.w / 2,
                hy: r.h / 2,
                a: 0,
                height: r.height,
                kind: 'harbor',
                id: 'port' + r.x + ',' + r.y,
              };
              const hit = boxContact(vehicleShape(c), b);
              if (hit) resolveContact(c, null, hit, b, pass === 0);
            }
        }
        if (blockBodies.length)
          for (const c of vehicles) {
            if (isBoat(c) || (c.altitude || 0) >= 20) continue;
            for (const b of blockBodies) {
              if (Math.abs(c.x - b.x) > 90 || Math.abs(c.y - b.y) > 90) continue;
              const hit = boxContact(vehicleShape(c), b);
              if (hit) resolveContact(c, null, hit, b, pass === 0);
            }
          }
        for (const c of vehicles)
          for (const b of staticCandidates.get(c) || noStatics) {
            if (
              isBoat(c) ||
              (b.minHeight !== undefined &&
                entityElevation(c) + vehicleCollisionHeight(c) < b.minHeight) ||
              (isAircraft(c) && c.altitude > b.height + 8) ||
              (c.roofSite && b.building === c.roofSite)
            )
              continue;
            const hit = boxContact(vehicleShape(c), b);
            if (hit) resolveContact(c, null, hit, b, pass === 0);
          }
      }
      // Lamp posts, hydrants, bins and benches: solid until something heavy and fast
      // enough knocks them flat (damage.js).
      streetPropContacts();
      mark('phys:contacts');
      for (const c of vehicles) {
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
          nearPond = wheeled && parkPondNear(c.x, c.y, vehicleSpec(c).l),
          footprint = wheeled && corners(vehicleShape(c)),
          // More of the car over the water than at the start of the step: a car that
          // somehow starts with a wheel over the kerb can still back off it.
          cornersInPond = (shape) => corners(shape).filter((p) => parkPondBlocked(p.x, p.y)).length,
          intoPond =
            nearPond &&
            footprint.some((p) => parkPondBlocked(p.x, p.y)) &&
            cornersInPond(vehicleShape(c)) >
              cornersInPond({ ...vehicleShape(c), x: c.stepStartX, y: c.stepStartY, a: c.stepStartA });
        if (intoPond || (wheeled && c !== player.car && footprint.some((p) => !groundAt(p.x, p.y)))) {
          // Hitting the pond's stone kerb at speed is a crash, not a soft stop.
          const hitSpeed = Math.hypot(c.vx || 0, c.vy || 0);
          // (Same severity as a wall in collisionImpact; the kerb is immovable.)
          if (intoPond && hitSpeed > 42 && physicsClock - (c.kerbHitAt || -9) > 0.5) {
            c.kerbHitAt = physicsClock;
            const nx = c.vx / hitSpeed,
              ny = c.vy / hitSpeed,
              reach = vehicleSpec(c).l / 2;
            damageVehicle(c, Math.pow(hitSpeed - 38, 1.12) * 0.062, c.x + nx * reach, c.y + ny * reach, null, {
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
        c.speed = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
        if (c === player.car) {
          player.x = c.x;
          player.y = c.y;
          player.a = c.a;
          player.altitude = (c.altitude || 0) + (c.groundHeight || 0);
        }
      }
      mark('phys:post');
    }
    function personIncapacitated(p) {
      return p.hp > 0 && ((p.knockedFor || 0) > 0 || (p.dazedFor || 0) > 0);
    }
    function personFallAmount(p) {
      return p.hp <= 0 ? 1 : clamp((p.knockedFor || 0) / 0.55, 0, 1);
    }
    function updateKnockdowns(deltaSeconds) {
      // Walk the four lists in place rather than copying ~700 people every frame.
      for (const list of [pedestrians, enemies, gangMembers, officers])
        for (const p of list) updateKnockdown(p, deltaSeconds);
    }
    function updateKnockdown(p, deltaSeconds) {
      p.impactCooldown = Math.max(0, (p.impactCooldown || 0) - deltaSeconds);
      if (p.hp <= 0) return;
      if (p.ejected) stepEjection(p, deltaSeconds);
      if (p.knockedFor > 0) {
        p.aiming = false;
        p.knockedFor = Math.max(0, p.knockedFor - deltaSeconds);
        if (
          p.knockedFor < 0.55 &&
          vehicles.some((c) => sameFloor(c, p) && pointInCar(p.x, p.y, c, 6))
        )
          p.knockedFor = 0.6;
        if (p.knockedFor === 0) {
          p.dazedFor = 1.4;
          p.flee = 8;
        }
      } else if (p.dazedFor > 0) {
        p.aiming = false;
        p.dazedFor = Math.max(0, p.dazedFor - deltaSeconds);
      }
    }
    function knockPerson(person, c, speed) {
      const kph = worldMeters(speed) * 3.6;
      if (kph < 0.1 || (person.impactCooldown || 0) > 0 || (kph < 20 && personIncapacitated(person)))
        return;
      const a = Math.atan2(c.vy, c.vx),
        source = c === player.car ? player : c;
      // These are gameplay thresholds, not a prediction of real-world injury.
      const damage = kph < 20 ? 0 : Math.min(250, 36 * ((kph - 20) / 27) ** 2);
      person.impactCooldown = 0.9;
      person.threat = {
        x: c.x,
        y: c.y,
      };
      person.flee = 8;
      person.aiming = false;
      scream(person);
      if (damage > 0) {
        const fatal = damage >= person.hp;
        strikePerson(person, damage, a, source, fatal, 'impact');
        if (bloodOn && fatal) {
          c.bloodyUntil = gameTime + 14;
          c.bloodTrackRemaining = BLOOD_TRACK_DISTANCE;
          c.bloodTrackSides = [-1, 1];
        }
      } else if (person.faction && source === player) alertGang(person.faction);
      if (person.hp > 0) {
        person.knockedFor = 3.5 + Math.min(1.5, kph / 30);
        person.dazedFor = 0;
      }
      const vehicleDefinition = vehicleSpec(c),
        headingCosine = Math.cos(c.a),
        headingSine = Math.sin(c.a),
        side = Math.sign(-(person.x - c.x) * headingSine + (person.y - c.y) * headingCosine) || 1;
      const candidates = [
        {
          x: person.x + Math.cos(a) * clamp(speed * 0.15, 12, 45),
          y: person.y + Math.sin(a) * clamp(speed * 0.15, 12, 45),
        },
        ...[side, -side].map((s) => ({
          x: person.x - headingSine * s * (vehicleDefinition.w / 2 + 14),
          y: person.y + headingCosine * s * (vehicleDefinition.w / 2 + 14),
        })),
      ];
      for (const q of candidates)
        if (
          !solid(q.x, q.y, 6) &&
          !vehicles.some((o) => sameFloor(o, q) && pointInCar(q.x, q.y, o, 6))
        ) {
          person.x = q.x;
          person.y = q.y;
          break;
        }
      // Everyone who saw it reacts: gasps, onlookers, someone to help, a call.
      crowdAlarm('knock', person, c === player.car ? player : null, person.hp <= 0 ? 2 : 1.3);
      if (c === player.car) {
        crime(person.hp <= 0 ? 0.35 : 0.08);
        if (person.hp <= 0) cash += 25;
      }
      return true;
    }
    function sweptPersonContact(person, c, from) {
      const distance = Math.hypot(c.x - from.x, c.y - from.y),
        steps = Math.min(24, Math.max(1, Math.ceil(distance / 7)));
      if (distance > 170) return pointInCar(person.x, person.y, c, 3);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        if (
          pointInCar(
            person.x,
            person.y,
            {
              ...c,
              x: from.x + (c.x - from.x) * f,
              y: from.y + (c.y - from.y) * f,
              a: from.a + normalizeAngle(c.a - from.a) * f,
            },
            3,
          )
        )
          return true;
      }
      return false;
    }
    function updateBloodTracks(c, active) {
      const prev = c.bloodTrackPoint ||
        c.personSweepStart || {
          x: c.x,
          y: c.y,
          a: c.a,
        };
      c.bloodTrackPoint = {
        x: c.x,
        y: c.y,
        a: c.a,
      };
      if (!active || !bloodOn || isBoat(c) || isAircraft(c) || (c.altitude || 0) > 3) {
        if (!bloodOn) c.bloodTrackRemaining = 0;
        return;
      }
      const distance = Math.hypot(c.x - prev.x, c.y - prev.y);
      if (distance > 100) {
        c.bloodTrackRemaining = 0;
        return;
      }
      if (distance < 0.001) return;
      if (!bloodPools.length && !(c.bloodTrackRemaining > 0)) return;
      // Cheap distance test first: the surface check samples the terrain, and
      // every moving car ran it for every pool in the city each frame.
      const near = distance + vehicleSpec(c).l + 30,
        sources = bloodPools.filter(
          (b) =>
            !b.track &&
            Math.abs(b.x - c.x) < near &&
            Math.abs(b.y - c.y) < near &&
            gameTime - b.created < 180 &&
            Math.abs((b.surface || 0) - bloodSurface(b.x, b.y)) < 3,
        );
      if (!sources.length && !(c.bloodTrackRemaining > 0)) return;
      const steps = Math.ceil(distance / 2),
        ds = distance / steps,
        vehicleDefinition = vehicleSpec(c);
      for (let i = 1; i <= steps; i++) {
        const f = i / steps,
          x = prev.x + (c.x - prev.x) * f,
          y = prev.y + (c.y - prev.y) * f,
          a = (prev.a ?? c.a) + normalizeAngle(c.a - (prev.a ?? c.a)) * f,
          headingCosine = Math.cos(a),
          headingSine = Math.sin(a);
        const picked = [];
        for (const side of [-1, 1])
          if (
            [-1, 1].some((axle) => {
              const wx =
                  x +
                  headingCosine * axle * vehicleDefinition.l * 0.32 -
                  headingSine * side * vehicleDefinition.w * 0.4,
                wy =
                  y +
                  headingSine * axle * vehicleDefinition.l * 0.32 +
                  headingCosine * side * vehicleDefinition.w * 0.4;
              return sources.some(
                (b) => (wx - b.x) ** 2 + (wy - b.y) ** 2 < (b.r * (b.grow ? 1.28 : 1) + 1.8) ** 2,
              );
            })
          )
            picked.push(side);
        if (picked.length) {
          c.bloodTrackSides = [
            ...new Set([...(c.bloodTrackRemaining > 0 ? c.bloodTrackSides || [-1, 1] : []), ...picked]),
          ];
          c.bloodTrackRemaining = BLOOD_TRACK_DISTANCE;
        }
        const used = Math.min(ds, c.bloodTrackRemaining || 0);
        c.bloodTrackRemaining = Math.max(0, (c.bloodTrackRemaining || 0) - ds);
        c.bloodTrackSpacing = (c.bloodTrackSpacing || 0) + used;
        if (c.bloodTrackSpacing >= 3) {
          c.bloodTrackSpacing %= 3;
          const fade = c.bloodTrackRemaining / BLOOD_TRACK_DISTANCE;
          for (const side of c.bloodTrackSides || [-1, 1])
            addBloodPool(
              x -
                headingCosine * vehicleDefinition.l * 0.32 -
                headingSine * side * vehicleDefinition.w * 0.4,
              y -
                headingSine * vehicleDefinition.l * 0.32 +
                headingCosine * side * vehicleDefinition.w * 0.4,
              1.1 + fade * 1.6,
              a,
              {
                track: true,
                opacity: 0.25 + fade * 0.45,
              },
            );
        }
      }
    }
    function updateCars(deltaSeconds, active) {
      for (const vehicle of vehicles)
        vehicle.personSweepStart = {
          x: vehicle.x,
          y: vehicle.y,
          a: vehicle.a,
        };
      physicsAccumulator = Math.min(physicsAccumulator + deltaSeconds, 0.1);
      while (physicsAccumulator >= 1 / 120) {
        physicsStep(1 / 120, active);
        physicsAccumulator -= 1 / 120;
      }
      for (const vehicle of vehicles) {
        if (vehicle.hp <= 0 && !vehicle.deadTime) {
          vehicle.deadTime = gameTime || 0.001;
          vehicle.ai = false;
          vehicle.cop = false;
          vehicle.sprite = null;
          if (vehicle.lastAttacker === player && vehicle !== player.car) recordVehicleKill(vehicle);
          if (!vehicleSpec(vehicle).bicycle)
            explode(
              vehicle.x,
              vehicle.y,
              0.65,
              vehicle.lastAttacker || 'world',
              entityElevation(vehicle),
            );
          if (vehicle === player.car) {
            // Riding a vehicle when it detonates is fatal: the blast happens in the cabin.
            // Any lingering exit/landing invulnerability is cleared first so the hit lands,
            // and the clear happens after exitCar(), which grants its own half second.
            if (isAircraft(vehicle) && aircraftClearance(vehicle) > 2) {
              player.car = null;
            } else {
              exitCar();
              player.car = null;
            }
            player.inv = 0;
            shake = Math.max(shake, 16);
            flash = Math.max(flash, 0.5);
            hurt(1000, 'blast');
          }
        }
        if (
          vehicle === player.car &&
          vehicle.hp > 0 &&
          vehicle.hp < vehicle.maxhp * 0.26 &&
          !vehicleSpec(vehicle).bicycle &&
          gameTime - (vehicle.bailWarnedAt || -100) > 6
        ) {
          vehicle.bailWarnedAt = gameTime;
          tell('ENGINE ON FIRE · BAIL OUT (E) BEFORE IT GOES UP', 3.5);
          tone(520, 0.14, 0.2, 'square', 240);
        }
        updateBloodTracks(vehicle, active);
        if (
          !active ||
          isBoat(vehicle) ||
          vehicle.hp <= 0 ||
          (isAircraft(vehicle) && aircraftClearance(vehicle) > 3) ||
          distanceBetween(vehicle, player) > 800
        )
          continue;
        const speed = Math.hypot(vehicle.vx || 0, vehicle.vy || 0),
          contacts = new Set(),
          reach = vehicleSpec(vehicle).l + 100;
        const touch = (p) => {
          if (
            p.hp > 0 &&
            !p.hidden &&
            Math.abs(p.x - vehicle.x) < reach &&
            Math.abs(p.y - vehicle.y) < reach &&
            sameFloor(vehicle, p) &&
            distanceBetween(vehicle, p) < reach &&
            sweptPersonContact(p, vehicle, vehicle.personSweepStart)
          ) {
            if (vehicle.pedestrianContacts?.has(p) || knockPerson(p, vehicle, speed)) contacts.add(p);
          }
        };
        // Some 650 pedestrians: ask the crowd's neighbour grid for the ones near
        // this car instead of testing all of them for every car near the player.
        // The swept test reaches back to where the car was a frame ago, so the
        // query grows by the distance it covered.
        const swept = Math.hypot(vehicle.x - vehicle.personSweepStart.x, vehicle.y - vehicle.personSweepStart.y);
        forEachPedestrianNear(vehicle.x, vehicle.y, reach + swept, touch);
        for (const list of [enemies, gangMembers, officers]) for (const p of list) touch(p);
        vehicle.pedestrianContacts = contacts;
        if (
          speed >= 40 &&
          !player.parachute &&
          !player.car &&
          !playerOnRoof() &&
          sameFloor(vehicle, player) &&
          pointInCar(player.x, player.y, vehicle, 6)
        ) {
          const a = Math.atan2(vehicle.vy, vehicle.vx);
          hurt(speed * 0.15, 'impact');
          player.inv = 1;
          moveBody(player, Math.cos(a) * 25, Math.sin(a) * 25, 8);
        }
      }
      if (impactContacts.size > 300)
        for (const [k, v] of impactContacts) if (physicsClock - v.time > 2) impactContacts.delete(k);
    }
    // END SUBSYSTEM: src/physics.js
