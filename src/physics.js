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
          const key = i + ',' + j;
          if (!staticGrid.has(key)) staticGrid.set(key, []);
          staticGrid.get(key).push(b);
        }
    }
    function nearbyStatics(c) {
      const found = new Set(),
        radius = Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) / 2 + 20;
      for (let i = Math.floor((c.x - radius) / 256); i <= Math.floor((c.x + radius) / 256); i++)
        for (let j = Math.floor((c.y - radius) / 256); j <= Math.floor((c.y + radius) / 256); j++)
          for (const b of staticGrid.get(i + ',' + j) || []) found.add(b);
      return found;
    }
    function buildColliders() {
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
      for (const b of buildings) addStatic(b.x, b.y, b.w, b.h, b.height + 22);
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
            const key = i + ',' + j;
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
      for (const bridge of BRIDGES) {
        for (const x of [RIVER.left + 115, RIVER.right - 115])
          for (const side of [-1, 1]) addStatic(x - 5, bridge + side * 69 - 5.5, 10, 11, 102, 'tower');
        for (const [a, b] of bridgeRailSpans(bridge))
          for (const side of [-1, 1]) addStatic(a, bridge + side * 55 - 2, b - a, 4, 7, 'rail');
      }
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
    function damageVehicle(vehicle, amount, x = vehicle.x, y = vehicle.y, source = null) {
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
      vehicle.hp = Math.max(0, vehicle.hp - amount);
      vehicle.damageVersion = (vehicle.damageVersion || 0) + 1;
      vehicle.sprite = null;
      const headingCosine = Math.cos(vehicle.a),
        headingSine = Math.sin(vehicle.a),
        dx = x - vehicle.x,
        dy = y - vehicle.y,
        vehicleDefinition = vehicleSpec(vehicle),
        lx = dx * headingCosine + dy * headingSine,
        ly = -dx * headingSine + dy * headingCosine,
        side =
          Math.abs(lx / vehicleDefinition.l) > Math.abs(ly / vehicleDefinition.w)
            ? lx > 0
              ? 'front'
              : 'rear'
            : ly > 0
              ? 'right'
              : 'left';
      vehicle.damage[side] = clamp(vehicle.damage[side] + (amount / vehicle.maxhp) * 2.5, 0, 1);
      vehicle.dents.push({
        x: clamp(lx, -vehicleDefinition.l / 2, vehicleDefinition.l / 2),
        y: clamp(ly, -vehicleDefinition.w / 2, vehicleDefinition.w / 2),
        force: clamp((amount / vehicle.maxhp) * 10, 0.25, 3.5),
      });
      if (vehicle.dents.length > 12) vehicle.dents.shift();
    }
    function repairVehicle(vehicle) {
      vehicle.hp = vehicle.maxhp;
      vehicle.damage = {
        front: 0,
        rear: 0,
        left: 0,
        right: 0,
      };
      vehicle.dents = [];
      vehicle.damageVersion = (vehicle.damageVersion || 0) + 1;
      vehicle.deadTime = 0;
      vehicle.sprite = null;
    }
    function collisionImpact(a, b, hit, closing, key) {
      if (closing < 42) return;
      const last = impactContacts.get(key);
      if (last && physicsClock - last.time < 0.24) return;
      impactContacts.set(key, {
        time: physicsClock,
      });
      const severity = Math.pow(Math.max(0, closing - 38), 1.12) * 0.062;
      damageVehicle(
        a,
        a.type === 'plane' && a.altitude > 2 ? Math.max(severity, closing * 0.9) : severity,
        hit.x,
        hit.y,
      );
      if (b)
        damageVehicle(
          b,
          b.type === 'plane' && b.altitude > 2 ? Math.max(severity, closing * 0.9) : severity,
          hit.x,
          hit.y,
        );
      if (distanceBetween(a, player) < 650) {
        particle(hit.x, hit.y, '#ddd1b4', clamp(closing / 18, 3, 16), 85, 3);
        if (city3D) city3D.impact(hit.x, hit.y, 'metal');
        noise(0.09 + closing * 0.0002, clamp(closing * 0.0008, 0.08, 0.32), 950);
      }
      if (a === player.car || b === player.car) {
        shake = Math.min(10, closing * 0.022);
        hurt(severity * (VEHICLE_DEFINITIONS[player.car?.type]?.bike ? 0.4 : 0.075));
        if (closing > 130) radio('look-out');
        if (b && !a.cop && !b.cop) crime(0.06);
      }
    }
    function resolveContact(a, b, hit, staticBody = null, record = true) {
      const inverseMassA = 1 / (vehicleSpec(a).mass || 1.25),
        inverseMassB = b ? 1 / (vehicleSpec(b).mass || 1.25) : 0,
        inverseInertiaA = (inverseMassA * 12) / (vehicleSpec(a).l ** 2 + vehicleSpec(a).w ** 2),
        inverseInertiaB = b ? (inverseMassB * 12) / (vehicleSpec(b).l ** 2 + vehicleSpec(b).w ** 2) : 0,
        n = hit.n;
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
        const tx = -n.y,
          ty = n.x,
          ta = contactOffsetA.x * ty - contactOffsetA.y * tx,
          tb = contactOffsetB.x * ty - contactOffsetB.y * tx,
          tangentImpulse = clamp(
            -(rvx * tx + rvy * ty) /
              (inverseMassA + inverseMassB + ta * ta * inverseInertiaA + tb * tb * inverseInertiaB),
            -impulse * 0.23,
            impulse * 0.23,
          );
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
        next = ROAD_CENTERS.filter((v) => (v - value) * sign > 2).sort((a, b) => (a - b) * sign)[0];
      if (next === undefined) return false;
      const nx = vertical ? roadNear(x) : next,
        ny = vertical ? next : roadNear(y);
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
      if (c.navAngle === undefined) c.navAngle = (Math.round(c.a / (Math.PI / 2)) * Math.PI) / 2;
      const vehicleDefinition = vehicleSpec(c),
        nav = c.navAngle,
        headingCosine = Math.cos(nav),
        headingSine = Math.sin(nav),
        vertical = Math.abs(headingSine) > 0.5,
        sign = vertical ? Math.sign(headingSine) : Math.sign(headingCosine),
        value = vertical ? c.y : c.x;
      const next = ROAD_CENTERS.filter((v) => (v - value) * sign > 2).sort((a, b) => (a - b) * sign)[0];
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
          y = vertical ? next : roadNear(c.y);
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
            y: c.y + headingSine * 75 + (!vertical ? roadNear(c.y) + sign * 25 - c.y : 0),
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
              y: roadNear(c.y) + sign * 25,
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
        side = vehicleDefinition.w / 2;
      for (const o of vehicles) {
        if (o === c || (o.altitude || 0) > 20 || isBoat(o) || distanceBetween(c, o) > 350) continue;
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
        const gap = along - half - ol - 12,
          lead = Math.max(0, (o.vx || 0) * headingCosine2 + (o.vy || 0) * headingSine2);
        desired = Math.min(
          desired,
          Math.sqrt(2 * 250 * Math.max(0, gap)) * 0.72,
          lead + Math.max(0, gap - 8) * 1.25,
        );
      }
      // Give crossing pedestrians and an innocent player time to clear the lane.
      for (const p of [...pedestrians, ...(!player.car ? [player] : [])]) {
        if (p.hp <= 0 || p.roof) continue;
        const dx = p.x - c.x,
          dy = p.y - c.y,
          along = dx * headingCosine2 + dy * headingSine2,
          lateral = Math.abs(dx * rx + dy * ry);
        if (along > 0 && along < 140 && lateral < side + 11)
          desired = Math.min(desired, Math.sqrt(2 * 260 * Math.max(0, along - half - 22)) * 0.7);
      }
      return {
        steer: clamp(da * 3, -1.7, 1.7),
        desired: Math.max(0, desired),
      };
    }
    function helicopterControl(c, stepSeconds, active) {
      if (c.abandonedFlight && c !== player.car) {
        const floor = terrainHeight(c.x, c.y);
        let surface = floor,
          blocked = false;
        for (const b of nearbyStatics(c))
          if (b.height > surface && boxContact(vehicleShape(c), b)) {
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
            !groundAt(c.x, c.y, 8) ||
            Math.hypot(slope.x, slope.y) > 0.35 ||
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
      const floor = terrainHeight(c.x, c.y),
        ceiling = 2400,
        clearance = c.altitude - floor;
      const flying = clearance > 1 || lift > 0,
        desired = flying ? forward * VEHICLE_DEFINITIONS.helicopter.max : 0,
        along = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
      const acceleration = clamp((desired - along) * 1.8, -140, 140);
      c.vx += Math.cos(c.a) * acceleration * stepSeconds;
      c.vy += Math.sin(c.a) * acceleration * stepSeconds;
      c.vx *= Math.exp(-stepSeconds * 0.45);
      c.vy *= Math.exp(-stepSeconds * 0.45);
      c.vz += (lift * 75 - c.vz) * Math.min(1, stepSeconds * 3);
      let next = clamp(c.altitude + c.vz * stepSeconds, floor, ceiling);
      if (c.hp > 0 && next < floor + 20 && clearance >= 20 && !safeLanding(c)) {
        next = floor + 20;
        c.vz = 0;
        if (controlled && physicsClock - (c.landingWarning || -100) > 3) {
          c.landingWarning = physicsClock;
          tell('Landing blocked. Slow down and find clear, open ground.', 2.5);
        }
      }
      if (c.hp > 0 && clearance < 20 && lift < 0 && !safeLanding(c)) {
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
      const lateral = -c.vx * headingSine + c.vy * headingCosine,
        grip = 1 - Math.exp(-stepSeconds * 2.4);
      c.vx += headingSine * lateral * grip;
      c.vy -= headingCosine * lateral * grip;
      c.vx *= Math.exp(-(brake ? 2.5 : 0.3) * stepSeconds);
      c.vy *= Math.exp(-(brake ? 2.5 : 0.3) * stepSeconds);
      c.av +=
        (turn * vehicleDefinition.turn * clamp(Math.abs(along) / 70, 0.15, 1) * Math.sign(along || 1) -
          c.av) *
        Math.min(1, stepSeconds * 2);
      const nextA = c.a + c.av * stepSeconds;
      if (boatFits(c, c.x, c.y, nextA)) c.a = nextA;
      else c.av = 0;
    }
    function physicsStep(stepSeconds, active) {
      physicsClock += stepSeconds;
      const pc = player.car;
      for (const c of vehicles) {
        const vehicleDefinition = vehicleSpec(c);
        c.stepStartX = c.x;
        c.stepStartY = c.y;
        c.stepStartA = c.a;
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
            acceleration = up
              ? vehicleDefinition.acc / (1 + (c.cargoCount || 0) * 0.1)
              : down
                ? along > 10
                  ? -(vehicleDefinition.brake || 285)
                  : -vehicleDefinition.acc * 0.6
                : 0;
            if (
              (along > vehicleDefinition.max * (0.65 + (0.35 * c.hp) / c.maxhp) && up) ||
              (along < -95 && down)
            )
              acceleration = 0;
            grip = brake ? 1.9 : vehicleDefinition.grip || 7;
            drag = brake ? 2.1 : up || down ? (onRoad(c.x, c.y) ? 0.1 : 0.65) : 0.72;
            steer =
              (turn *
                vehicleDefinition.turn *
                clamp(Math.abs(along) / 65, vehicleDefinition.tank ? 0.72 : 0, 1) *
                Math.sign(along || 1) *
                (brake ? 1.35 : 1)) /
              (1 + Math.pow(Math.abs(along) / 240, 1.5));
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
            c.routeTime = (c.routeTime || 0) - stepSeconds;
            let target;
            if (
              c.pursuitTarget &&
              distanceBetween(c, c.pursuitTarget) < 330 &&
              clearSight(c, c.pursuitTarget)
            )
              target = c.pursuitTarget;
            else if (!c.pursuitTarget && c.seesPlayer && distanceBetween(c, player) < 370)
              target = player;
            else if (searchActive) target = lastSeen;
            else {
              if (c.routeTime <= 0 || !c.route?.length) {
                c.route = copRoute(c);
                c.routeTime = 2;
              }
              if (c.route.length && distanceBetween(c, c.route[0]) < 45) c.route.shift();
              target = c.route[0] || {
                x: roadNear(player.x),
                y: roadNear(player.y),
              };
            }
            const da = normalizeAngle(headingBetween(c, target) - c.a);
            steer = clamp(da * 3, -2.1, 2.1);
            let desired = Math.abs(da) > 1 ? 60 : Math.min(305, 185 + wantedStars * 22);
            if (
              !c.pursuitTarget &&
              (!player.car || isAircraft(player.car)) &&
              distanceBetween(c, player) < 310
            ) {
              desired = clamp((distanceBetween(c, player) - 160) * 1.5, 0, 150);
              if (distanceBetween(c, player) < 150) steer = 0;
            }
            acceleration = clamp(
              (desired - along) * 3,
              -(!player.car ? 620 : 300),
              vehicleDefinition.acc,
            );
            drag = 0.2;
          } else if (c.hp > 0 && c.ai && !c.crewDeployed) {
            const ai =
              c.aiControl &&
              physicsClock < (c.aiControlAt || 0) &&
              physicsClock > (c.aiControlAt || 0) - 0.08
                ? c.aiControl
                : ((c.aiControl = c.countyRoute
                    ? countyRouteControl(c)
                    : trafficControl(c, stepSeconds)),
                  (c.aiControlAt = physicsClock + 0.05),
                  c.aiControl);
            steer = ai.steer;
            acceleration = clamp((ai.desired - along) * 5, -400, vehicleDefinition.acc);
            drag = 0.15;
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
          const traction = lateral * (1 - Math.exp(-grip * stepSeconds));
          c.vx += headingSine * traction;
          c.vy -= headingCosine * traction;
          c.vx *= Math.exp(-drag * stepSeconds);
          c.vy *= Math.exp(-drag * stepSeconds);
          c.av += (steer - c.av) * (1 - Math.exp(-5 * stepSeconds));
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
      const cells = new Map(),
        pairs = [],
        seen = new Set();
      for (const c of vehicles) {
        const radius = Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) / 2 + 2;
        for (let x = Math.floor((c.x - radius) / 96); x <= Math.floor((c.x + radius) / 96); x++)
          for (let y = Math.floor((c.y - radius) / 96); y <= Math.floor((c.y + radius) / 96); y++) {
            const key = x + ',' + y,
              list = cells.get(key) || [];
            for (const o of list) {
              const pk = Math.min(c.id, o.id) + ':' + Math.max(c.id, o.id);
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
            cells.set(key, list);
          }
      }
      const staticCandidates = new Map(
        vehicles.map((c) => [
          c,
          Array.from(nearbyStatics(c)).filter((b) => {
            const radius = Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) / 2 + 12;
            const ca = Math.abs(Math.cos(b.a || 0)),
              sa = Math.abs(Math.sin(b.a || 0));
            return (
              Math.abs(c.x - b.x) < ca * b.hx + sa * b.hy + radius &&
              Math.abs(c.y - b.y) < sa * b.hx + ca * b.hy + radius
            );
          }),
        ]),
      );
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
        for (const c of vehicles)
          for (const b of staticCandidates.get(c)) {
            if (
              isBoat(c) ||
              (b.minHeight !== undefined &&
                entityElevation(c) + vehicleCollisionHeight(c) < b.minHeight) ||
              (isAircraft(c) && c.altitude > b.height + 8)
            )
              continue;
            const hit = boxContact(vehicleShape(c), b);
            if (hit) resolveContact(c, null, hit, b, pass === 0);
          }
      }
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
        if (
          c.type !== 'plane' &&
          !(isAircraft(c) && c.altitude > 8) &&
          !isBoat(c) &&
          corners(vehicleShape(c)).some((p) => !groundAt(p.x, p.y))
        ) {
          c.x = c.stepStartX;
          c.y = c.stepStartY;
          c.a = c.stepStartA;
          c.av = 0;
          c.vx *= -0.15;
          c.vy *= -0.15;
        }
        if (isBoat(c) && !boatFits(c)) {
          if (c.lastWater) {
            c.x = c.lastWater.x;
            c.y = c.lastWater.y;
            c.a = c.lastWater.a;
          }
          c.vx = c.vy = 0;
        } else if (isBoat(c))
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
    }
    function personIncapacitated(p) {
      return p.hp > 0 && ((p.knockedFor || 0) > 0 || (p.dazedFor || 0) > 0);
    }
    function personFallAmount(p) {
      return p.hp <= 0 ? 1 : clamp((p.knockedFor || 0) / 0.55, 0, 1);
    }
    function updateKnockdowns(deltaSeconds) {
      for (const p of [...pedestrians, ...enemies, ...gangMembers, ...officers]) {
        p.impactCooldown = Math.max(0, (p.impactCooldown || 0) - deltaSeconds);
        if (p.hp <= 0) continue;
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
        strikePerson(person, damage, a, source, fatal);
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
      if (c === player.car) {
        crime(person.hp <= 0 ? 0.35 : 0.08);
        if (person.hp <= 0) {
          cash += 25;
          sessionKills++;
        }
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
      const sources = bloodPools.filter(
        (b) =>
          !b.track &&
          Math.abs((b.surface || 0) - bloodSurface(b.x, b.y)) < 3 &&
          gameTime - b.created < 180 &&
          Math.abs(b.x - c.x) < distance + vehicleSpec(c).l + 30 &&
          Math.abs(b.y - c.y) < distance + vehicleSpec(c).l + 30,
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
          if (!vehicleSpec(vehicle).bicycle)
            explode(
              vehicle.x,
              vehicle.y,
              0.65,
              vehicle.lastAttacker || 'world',
              entityElevation(vehicle),
            );
          if (vehicle === player.car) {
            if (isAircraft(vehicle) && aircraftClearance(vehicle) > 2) {
              player.car = null;
              // A mid-air destruction is always fatal; a lingering exit/landing invulnerability
              // must not leave the player standing in the sky without an aircraft.
              player.inv = 0;
              hurt(1000);
            } else {
              exitCar();
              hurt(22);
              player.inv = 1;
            }
          }
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
          contacts = new Set();
        for (const p of [...pedestrians, ...enemies, ...gangMembers, ...officers])
          if (
            p.hp > 0 &&
            !p.hidden &&
            sameFloor(vehicle, p) &&
            distanceBetween(vehicle, p) < vehicleSpec(vehicle).l + 100 &&
            sweptPersonContact(p, vehicle, vehicle.personSweepStart)
          ) {
            if (vehicle.pedestrianContacts?.has(p) || knockPerson(p, vehicle, speed)) contacts.add(p);
          }
        vehicle.pedestrianContacts = contacts;
        if (
          speed >= 40 &&
          !player.parachute &&
          !player.car &&
          !player.roof &&
          sameFloor(vehicle, player) &&
          pointInCar(player.x, player.y, vehicle, 6)
        ) {
          const a = Math.atan2(vehicle.vy, vehicle.vx);
          hurt(speed * 0.15);
          player.inv = 1;
          moveBody(player, Math.cos(a) * 25, Math.sin(a) * 25, 8);
        }
      }
      if (impactContacts.size > 300)
        for (const [k, v] of impactContacts) if (physicsClock - v.time > 2) impactContacts.delete(k);
    }
    // END SUBSYSTEM: src/physics.js
