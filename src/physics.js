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
    /**
     * CONTACT SHAPES
     * The contact passes test each vehicle's box many times a step (every pair
     * and every nearby wall, in up to seven passes). contactShape() hands back
     * the vehicle's own box record, refreshed from where it is now, instead of a
     * new object per test. Only for tests that are done with it at once: two
     * calls for the same vehicle return the same record.
     */
    function contactShape(c) {
      const vehicleDefinition = vehicleSpec(c);
      let shape = c.contactBox;
      if (!shape) shape = c.contactBox = { x: 0, y: 0, a: 0, hx: 0, hy: 0 };
      shape.x = c.x;
      shape.y = c.y;
      shape.a = c.a;
      shape.hx = vehicleDefinition.l / 2;
      shape.hy = vehicleDefinition.w / 2;
      return shape;
    }
    // Bounding radius of a vehicle type's box (the broadphase asks for every car every step).
    const specRadii = new Map();
    function vehicleRadius(c) {
      const spec = vehicleSpec(c);
      let radius = specRadii.get(spec);
      if (radius === undefined) specRadii.set(spec, (radius = Math.hypot(spec.l, spec.w) / 2));
      return radius;
    }
    // Whether any corner of the vehicle's box stands off the ground (no allocation).
    function footprintOffGround(c) {
      const spec = vehicleSpec(c),
        hx = spec.l / 2,
        hy = spec.w / 2,
        ux = Math.cos(c.a || 0),
        uy = Math.sin(c.a || 0);
      for (let i = -1; i <= 1; i += 2)
        for (let j = -1; j <= 1; j += 2)
          if (!groundAt(c.x + ux * hx * i - uy * hy * j, c.y + uy * hx * i + ux * hy * j)) return true;
      return false;
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
    // Corner scratch for boxContact(): x, y of the four corners, in corners() order.
    const contactCornersA = new Float64Array(8),
      contactCornersB = new Float64Array(8);
    function boxCorners(b, cos, sin, out) {
      let k = 0;
      for (let i = -1; i <= 1; i += 2)
        for (let j = -1; j <= 1; j += 2) {
          out[k++] = b.x + cos * b.hx * i - sin * b.hy * j;
          out[k++] = b.y + sin * b.hx * i + cos * b.hy * j;
        }
    }
    // Separating-axis contact between two oriented boxes: the contact normal (from
    // a towards b), depth and point, or null. Works in plain numbers; only the
    // result is allocated (this runs for every touching pair in every pass).
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
      // Axes: a's (u, v) then b's; u = (cos, sin), v = (-sin, cos).
      const deltaX = b.x - a.x,
        deltaY = b.y - a.y;
      let depth = Infinity,
        nx = 0,
        ny = 0;
      for (let k = 0; k < 4; k++) {
        const axisX = k === 0 ? headingCosine : k === 1 ? -headingSine : k === 2 ? headingCosine2 : -headingSine2,
          axisY = k === 0 ? headingSine : k === 1 ? headingCosine : k === 2 ? headingSine2 : headingCosine2,
          ra =
            a.hx * Math.abs(axisX * headingCosine + axisY * headingSine) +
            a.hy * Math.abs(axisX * -headingSine + axisY * headingCosine),
          rb =
            b.hx * Math.abs(axisX * headingCosine2 + axisY * headingSine2) +
            b.hy * Math.abs(axisX * -headingSine2 + axisY * headingCosine2),
          d = deltaX * axisX + deltaY * axisY,
          overlap = ra + rb - Math.abs(d);
        if (overlap <= 0) return null;
        if (overlap < depth) {
          depth = overlap;
          nx = axisX * (d < 0 ? -1 : 1);
          ny = axisY * (d < 0 ? -1 : 1);
        }
      }
      const ac = contactCornersA,
        bc = contactCornersB,
        tx = -ny,
        ty = nx;
      boxCorners(a, headingCosine, headingSine, ac);
      boxCorners(b, headingCosine2, headingSine2, bc);
      let maxA = -Infinity,
        minB = Infinity;
      for (let k = 0; k < 8; k += 2) {
        maxA = Math.max(maxA, ac[k] * nx + ac[k + 1] * ny);
        minB = Math.min(minB, bc[k] * nx + bc[k + 1] * ny);
      }
      // The corners on each box's contact face, projected along the face.
      let aCount = 0,
        aFirst = 0,
        aMin = Infinity,
        aMax = -Infinity,
        bCount = 0,
        bFirst = 0,
        bMin = Infinity,
        bMax = -Infinity;
      for (let k = 0; k < 8; k += 2) {
        if (maxA - (ac[k] * nx + ac[k + 1] * ny) < 0.05) {
          const along = ac[k] * tx + ac[k + 1] * ty;
          if (!aCount) aFirst = along;
          aCount++;
          aMin = Math.min(aMin, along);
          aMax = Math.max(aMax, along);
        }
        if (bc[k] * nx + bc[k + 1] * ny - minB < 0.05) {
          const along = bc[k] * tx + bc[k + 1] * ty;
          if (!bCount) bFirst = along;
          bCount++;
          bMin = Math.min(bMin, along);
          bMax = Math.max(bMax, along);
        }
      }
      const side =
          aCount === 1 ? aFirst : bCount === 1 ? bFirst : (Math.max(aMin, bMin) + Math.min(aMax, bMax)) / 2,
        along = (maxA + minB) / 2;
      return {
        n: { x: nx, y: ny },
        depth,
        x: nx * along + tx * side,
        y: ny * along + ty * side,
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
      // and cruise terminal, and the Sunset Pier rides, buildings and supports
      // (themepark.js parkSolids; parkAirSolids are only in an aircraft's way).
      for (const b of marinaSolids()) addStatic(b.x, b.y, b.w, b.h, b.height, 'marina');
      for (const b of parkSolids()) addStatic(b.x, b.y, b.w, b.h, b.height, 'pier');
      for (const b of parkAirSolids()) addStatic(b.x, b.y, b.w, b.h, b.height, 'pier').minHeight = b.minHeight;
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
      // Guardrails, gate piers and railings at the street ends (streets.js).
      for (const b of streetEndSolids()) addStatic(b.x, b.y, b.w, b.h, b.height, b.kind);
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
    // Closing speed (about 55 km/h) above which the player ramming an occupied
    // car is a reported crime (collisionImpact here, crowdCrash in crowd.js).
    const RECKLESS_CRASH_SPEED = 55 * KMH;
    function collisionImpact(a, b, hit, closing, key, staticBody = null) {
      // Below about 19 km/h nothing bends.
      if (closing < 19 * KMH) {
        // Too soft to damage anything, but a parking knock is still heard (quietly).
        const heavier = Math.max(vehicleSpec(a).mass || 1.25, b ? vehicleSpec(b).mass || 1.25 : 0);
        if (closing >= 12)
          crashSound({
            x: hit.x,
            y: hit.y,
            closing,
            mass: heavier,
            other: b ? (heavier < 0.6 ? 'prop' : 'car') : 'wall',
            glass: 0,
            sliding: 0,
            key,
          });
        return;
      }
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
      // Panes already broken, so the crash sound knows whether this hit broke glass.
      const brokenGlass = () =>
        [a, b].reduce(
          (n, v) => n + (v?.damage?.glass ? Object.values(v.damage.glass).filter((g) => g === 2).length : 0),
          0,
        ),
        glassBefore = brokenGlass();
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
      }
      const massA = vehicleSpec(a).mass || 1.25,
        massB = b ? vehicleSpec(b).mass || 1.25 : 0;
      crashSound({
        x: hit.x,
        y: hit.y,
        closing,
        mass: Math.max(massA, massB),
        // Two bicycles or motorbikes knocking together are not a car crash.
        other: b ? (Math.max(massA, massB) < 0.6 ? 'prop' : 'car') : staticBody?.building || staticBody?.kind === 'building' ? 'building' : 'wall',
        glass: brokenGlass() - glassBefore,
        sliding: Math.abs(((b?.vx || 0) - a.vx) * -hit.n.y + ((b?.vy || 0) - a.vy) * hit.n.x),
        key,
      });
      if (a === player.car || b === player.car) {
        shake = Math.min(10, closing * 0.022);
        hurt(severity * (VEHICLE_DEFINITIONS[player.car?.type]?.bike ? 0.4 : 0.075), 'impact');
        if (closing > 130) radio('look-out');
        // Whoever was going faster did the ramming: the wreck is theirs, and
        // ramming a police car is assault on an officer (heat.js).
        const other = a === player.car ? b : a,
          playerFaster =
            !!other && (player.car?.impactSpeed || 0) > (other.impactSpeed || 0);
        // Only a reckless crash is a crime: the player rammed an occupied car hard.
        // Scrapes, parking knocks and being hit by someone else are not
        // (a light bump never brings the police, heat.js).
        if (other && playerFaster && closing > RECKLESS_CRASH_SPEED && (other.occupied || other.ai) && !other.cop)
          crime(0.06);
        // Contact from a chasing unit (PIT, box, ram): counted for policeReport().
        if (other?.cop && other.pursuitPlan && !other.blockade) {
          pursuitStats.contacts++;
          if (other.pursuitPlan.mode === 'pit') pursuitStats.pits++;
        }
        // A nudge in traffic does not make the other car the player's to answer
        // for (its later fire, a soldier's truck, a cruiser).
        if (other && playerFaster && closing > 90) {
          other.lastAttacker = player;
          other.lastDamagedAt = gameTime;
          if (
            (other.type === 'police' || other.lawUnit) &&
            !other.stolen &&
            closing > 110 &&
            gameTime - (other.rammedByPlayerAt ?? -100) > 4
          ) {
            other.rammedByPlayerAt = gameTime;
            crime(wantedStars > 0 ? 0.35 : 0.6);
          }
        }
      }
    }
    // Which contact pass last touched a body: passes after the first only revisit
    // bodies a contact moved in the pass before (physicsStep).
    let contactPass = 0;
    function resolveContact(a, b, hit, staticBody = null, record = true) {
      const n = hit.n;
      a.contactPass = contactPass;
      if (b) b.contactPass = contactPass;
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
        // Speeds going in, so collisionImpact can tell who rammed whom.
        if (record) {
          a.impactSpeed = Math.hypot(a.vx, a.vy);
          if (b) b.impactSpeed = Math.hypot(b.vx, b.vy);
        }
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
        // A chasing cruiser that spun the player's car out: a PIT (policeReport()).
        if (b && player.car && (a === player.car ? b : b === player.car ? a : null)?.pursuitPlan) {
          const runner = a === player.car ? a : b,
            kick = a === player.car ? kickA : kickB;
          if (kick > 0.55 && physicsClock - (runner.pitCountedAt ?? -100) > 2) {
            runner.pitCountedAt = physicsClock;
            pursuitStats.spinouts++;
            contactHoldUntil = gameTime + 3.5;
          }
        }
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
    // The next road line ahead (more than 2 units on in the direction `sign`), or
    // undefined: the nearest such entry of `lines`, found without sorting a copy.
    function nextRoadLine(lines, value, sign) {
      let best;
      for (let i = 0; i < lines.length; i++) {
        const v = lines[i];
        if ((v - value) * sign > 2 && (best === undefined || (v - best) * sign < 0)) best = v;
      }
      return best;
    }
    function trafficSpawnValid(x, y, a) {
      const headingCosine = Math.cos(a),
        headingSine = Math.sin(a),
        vertical = Math.abs(headingSine) > 0.5,
        sign = vertical ? Math.sign(headingSine) : Math.sign(headingCosine),
        value = vertical ? y : x,
        next = nextRoadLine(vertical ? ROAD_ROWS : ROAD_CENTERS, value, sign);
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
      const next = nextRoadLine(vertical ? ROAD_ROWS : ROAD_CENTERS, value, sign);
      // City traffic keeps to about 40-55 km/h (a few drivers quicker than
      // others), 70-85 out on the long bridges; a panicking driver floors it.
      let desired =
          (c.panicUntil > gameTime ? 75 : onBridgeDeck(c.x, c.y) ? 70 + (c.id % 4) * 5 : 40 + (c.id % 4) * 5) * KMH,
        target;
      if (c.panicUntil > gameTime) c.hazard = true;
      else c.hazard = false;
      if (
        !c.junction &&
        next !== undefined &&
        // Planned early enough to stop for a red from town speed.
        Math.abs(next - value) < 330 &&
        Math.abs(next - value) > 90
      ) {
        const x = vertical ? roadNear(c.x) : next,
          y = vertical ? next : rowNear(c.y);
        // Grid lines run on over the water (columns -896 and -384 cross Palm
        // Sound): no junction, and no signal to wait at, out on a bridge.
        if (landAt(x, y)) c.junction = planJunction(c, x, y, nav);
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
        // A green light with the box and the exit clear is driven through at
        // speed, committing about half a second out; anything else is a stop
        // at the line, braked for at about half a g.
        const proceed = signal === 'green' && !occupied && !exitBlocked;
        if (!j.committed && gap < 25 + Math.max(0, c.speed || 0) * 0.5 && proceed) j.committed = true;
        if (!j.committed) {
          if (!proceed) {
            desired = Math.min(
              desired,
              Math.sqrt(2 * 0.45 * GRAVITY * Math.max(0, gap - 3)) * 0.9,
              Math.max(0, gap - 6) * 1.25,
            );
            if (gap < 3) desired = 0;
          }
          // Slowing for the corner ahead before the turn itself.
          if (j.turn) desired = Math.min(desired, Math.sqrt((20 * KMH) ** 2 + 2 * 0.4 * GRAVITY * Math.max(0, gap)));
          target = {
            x: c.x + headingCosine * 75 + (vertical ? roadNear(c.x) - sign * 25 - c.x : 0),
            y: c.y + headingSine * 75 + (!vertical ? rowNear(c.y) + sign * 25 - c.y : 0),
          };
        } else {
          while (j.index < j.points.length - 1 && distanceBetween(c, j.points[j.index]) < 24) j.index++;
          target = j.points[j.index];
          if (j.turn) desired = Math.min(desired, (vehicleDefinition.truck ? 15 : 20) * KMH);
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
        if (
          o === c ||
          Math.abs(o.x - c.x) > 350 ||
          Math.abs(o.y - c.y) > 350 ||
          (o.altitude || 0) > 20 ||
          isBoat(o) ||
          distanceBetween(c, o) > 350
        )
          continue;
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
        // Follow at about 0.8 s behind the car ahead (plus a car's length of
        // slack), never faster than lets us stop behind it if it brakes.
        const gap = along - half - ol - 12 - standoff,
          lead = Math.max(0, (o.vx || 0) * headingCosine2 + (o.vy || 0) * headingSine2);
        desired = Math.min(
          desired,
          Math.sqrt(lead * lead + 2 * 0.8 * GRAVITY * Math.max(0, gap)) * 0.8,
          lead + Math.max(0, gap - 8 - lead * 0.8) * 1.25,
        );
      }
      // Give crossing pedestrians and an innocent player time to clear the lane.
      // Runs 120 times a second per car, so it scans in place without building arrays
      // and skips anyone farther than the look-ahead box before doing any trigonometry.
      const yieldTo = (p) => {
        if (p.hp <= 0 || p.roof) return;
        const dx = p.x - c.x,
          dy = p.y - c.y;
        if (dx > 210 || dx < -210 || dy > 210 || dy < -210) return;
        const along = dx * headingCosine2 + dy * headingSine2,
          lateral = Math.abs(dx * rx + dy * ry);
        // Only people out on the carriageway: mid-turn the look-ahead box sweeps
        // across the pavement, and a bus used to wait for ever on walkers who
        // were themselves waiting at the kerb for it to clear.
        if (along > 0 && along < 200 && lateral < side + 11 && cityStreetAt(p.x, p.y))
          desired = Math.min(desired, Math.sqrt(2 * 0.7 * GRAVITY * Math.max(0, along - half - 22)) * 0.8);
      };
      forEachPedestrianNear(c.x, c.y, 220, yieldTo);
      if (!player.car) yieldTo(player);
      // Pulling in for a fare or a bus stop, or stopped after a crash (src/crowd.js).
      desired = Math.min(desired, curbsideStop(c));
      // Held at the drawbridge's stop line while it opens (src/drawbridge.js).
      desired = drawbridgeTrafficLimit(c, desired);
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
        // Climb and descend have their own keys (T / G by default, controls.js),
        // clear of Space (handbrake) and Shift (sprint).
        lift = (actionHeld('ascend') ? 1 : 0) - (actionHeld('descend') ? 1 : 0);
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
      // Nose-down acceleration of about half a g; flat out it settles near 240 km/h.
      const acceleration = clamp((desired - along) * 1.8, -0.6 * GRAVITY, VEHICLE_DEFINITIONS.helicopter.acc);
      c.vx += Math.cos(c.a) * acceleration * stepSeconds;
      c.vy += Math.sin(c.a) * acceleration * stepSeconds;
      c.vx *= Math.exp(-stepSeconds * 0.04);
      c.vy *= Math.exp(-stepSeconds * 0.04);
      // The rotor disc tilts into a turn: sideways drift dies away in a second or two.
      const drift = (-c.vx * Math.sin(c.a) + c.vy * Math.cos(c.a)) * (1 - Math.exp(-stepSeconds * 1.2));
      c.vx += Math.sin(c.a) * drift;
      c.vy -= Math.cos(c.a) * drift;
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
        headingCosine = Math.cos(c.a),
        headingSine = Math.sin(c.a),
        along = c.vx * headingCosine + c.vy * headingSine,
        // A police launch in a water pursuit steers itself (pursuit.js).
        helm = !controlled && active && c.marineUnit && c.cop && c.hp > 0 && wantedStars > 0 ? marineBoatInput(c, along) : null,
        up = controlled ? keys.KeyW || keys.ArrowUp : !!helm?.up,
        down = controlled ? keys.KeyS || keys.ArrowDown : !!helm?.down,
        turn = controlled
          ? (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
          : helm?.turn || 0,
        brake = controlled && keys.Space;
      // Thrust fades as the hull nears its top speed (water resistance grows with
      // the square of the speed, balancing it 15% past the cap below); astern is
      // reverse thrust, not brakes.
      const topSpeed = vehicleDefinition.max * (0.65 + (0.35 * c.hp) / c.maxhp) * (c.marineUnit ? 1.15 : 1);
      let force = up
        ? vehicleDefinition.acc * (1 - Math.min(1, (Math.max(0, along) / (topSpeed * 1.15)) ** 2))
        : down
          ? along > 8
            ? -0.35 * GRAVITY
            : -vehicleDefinition.acc * 0.55
          : 0;
      if (
        // Police launches are tuned a little quicker than anything they chase.
        (along > topSpeed && up) ||
        (along < -8 * KNOTS && down)
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
      // Off the throttle a planing hull settles and slows quickly.
      const drag = Math.exp(-(brake ? 2.5 * road : up ? 0 : 0.3) * stepSeconds);
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
    // Broadphase containers reused from step to step (see physicsStep).
    const broadphaseCells = Array.from({ length: 4096 }, () => Object.assign([], { stamp: 0 })),
      broadphasePairA = [],
      broadphasePairB = [],
      broadphaseBarrierCars = [],
      broadphaseBarrierBodies = [];
    let broadphaseStamp = 0;
    // One vehicle's controls and integration for a physics step (player input,
    // pursuit, traffic, boats and aircraft).
    // Reverse gear tops out at about 25 km/h; steering reaches full lock by 30 km/h.
    const REVERSE_TOP = 25 * KMH,
      STEER_FULL_SPEED = 30 * KMH;
    /* The yaw rate (radians a second) the tyres' sideways grip allows at `along`:
       lateral acceleration is speed times yaw rate, capped at cornerG. */
    function corneringLimit(spec, along) {
      return ((spec.cornerG || 1.2) * GRAVITY) / Math.max(Math.abs(along), 20 * KMH);
    }
    function controlVehicle(c, pc, stepSeconds, active) {
      const vehicleDefinition = vehicleSpec(c);
      c.stepStartX = c.x;
      c.stepStartY = c.y;
      c.stepStartA = c.a;
      // A parked car a long way off with nothing driving it has nothing to
      // integrate: skipping its control and integration is what keeps a city
      // with hundreds of kerbside vehicles and bicycles affordable.
      // Parked roadblock and deployed cruisers and burnt-out wrecks sleep the same way.
      if (
        c.resting &&
        c !== pc &&
        !c.ai &&
        !c.taxiHire &&
        (!c.cop || c.crewDeployed || c.hp <= 0) &&
        (c.hp > 0 || !c.damage?.burning)
      )
        return;
      // Not moved by the physics yet (makeCar starts vx/vy as NaN): take the
      // velocity from the heading and whatever speed the vehicle was given.
      if (c.vx !== c.vx) {
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
      } else if (c.deckAir) {
        // Off the tip of a drawbridge leaf: ballistic until drawbridgeSettle lands it.
        drawbridgeFlight(c, stepSeconds);
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
          drag = 0.72,
          // Brake lights (render3d.js): the player's brake pedal, or a driver
          // slowing hard or holding the car at a stop.
          braking = false;
        if (c.hp > 0 && c === pc && active) {
          const up = keys.KeyW || keys.ArrowUp,
            down = keys.KeyS || keys.ArrowDown,
            brake = keys.Space,
            turn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
          braking = !!down && along > 10;
          // A bicycle has no engine: holding W pedals, and the push the rider's
          // legs give tapers off toward the top speed (pedalDrive, cycles.js).
          const pedalled = !!vehicleDefinition.bicycle,
            sprint = pedalled && cycleSprinting(),
            topSpeed = vehicleDefinition.max * (sprint ? CYCLE_SPRINT_TOP : 1),
            // A hurt engine pulls weaker, flat tyres and a bent front end cap the
            // speed and drag the car to one side (damage.js vehicleHandling).
            handling = vehicleHandling(c);
          // The engine's pull at this speed (game.js ROAD PERFORMANCE); a bicycle's
          // push comes from the rider's legs instead.
          acceleration =
            up && !pedalled
              ? (engineAcceleration(vehicleDefinition, along) * handling.power) / (1 + (c.cargoCount || 0) * 0.1)
              : down
                ? along > 10
                  ? -(vehicleDefinition.brake || GRAVITY)
                  : -vehicleDefinition.acc * 0.5
                : pedalled
                  ? pedalDrive(along, topSpeed)
                  : 0;
          if (
            (along > vehicleDefinition.max * (0.65 + (0.35 * c.hp) / c.maxhp) * handling.top &&
              up &&
              !pedalled) ||
            (along < -(pedalled ? CYCLE_REVERSE_MAX : REVERSE_TOP) && down)
          )
            acceleration = 0;
          // Rolling with nothing pressed (or pedalling): air, tyres and engine braking.
          if (!up && !down) acceleration -= Math.sign(along) * Math.min(Math.abs(along) / stepSeconds, coastDeceleration(vehicleDefinition, along));
          // The handbrake locks the rear wheels: a sliding stop at about half a g.
          if (brake) acceleration -= Math.sign(along) * Math.min(Math.abs(along) / stepSeconds, 0.45 * GRAVITY);
          // Off the tarmac (verges, lawns, dirt): more rolling resistance.
          if ((up || down) && !pedalled && !onRoad(c.x, c.y))
            acceleration -= Math.sign(along) * Math.min(Math.abs(along) / stepSeconds, (vehicleDefinition.offroad ? 0.05 : 0.14) * GRAVITY);
          grip = brake ? 1.9 : (vehicleDefinition.grip || 7) * handling.grip;
          // Resistance is in engineAcceleration / coastDeceleration; drag here only
          // scrubs a handbrake slide (and a bicycle's brake).
          drag = pedalled ? (brake ? 0.6 : 0.03) : brake ? 0.25 : 0;
          // Full lock at walking pace; above that the tyres' sideways grip is the
          // limit (cornerG): the yaw rate a speed allows is grip / speed, so a car
          // takes a city corner at 30-40 km/h and sweeps a wide bend at 150. The
          // handbrake swings the tail past that limit.
          steer =
            turn *
            vehicleDefinition.turn *
            clamp(Math.abs(along) / STEER_FULL_SPEED, vehicleDefinition.tank ? 0.72 : 0, 1) *
            Math.sign(along || 1) *
            (brake ? 1.35 : 1);
          const cornerLimit = (corneringLimit(vehicleDefinition, along) * handling.grip * (brake ? 1.6 : 1));
          steer = clamp(steer, -cornerLimit, cornerLimit);
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
          const desired = clamp((d - 150) * 1.5, 0, 80 * KMH),
            corner = corneringLimit(vehicleDefinition, along);
          steer = clamp(da * 2.5, -Math.min(1.8, corner), Math.min(1.8, corner));
          acceleration = clamp((desired - along) * 4, -vehicleDefinition.brake * 1.1, engineAcceleration(vehicleDefinition, along));
          drag = 0.05;
        } else if (
          c.hp > 0 &&
          c.cop &&
          !c.crewDeployed &&
          active &&
          wantedStars > 0 &&
          !harborPoliceProtected(player.x, player.y, 30)
        ) {
          // Intercepts, PIT and boxing, search sweeps and stuck recovery (pursuit.js).
          const control = pursuitControl(c, stepSeconds, along, vehicleDefinition),
            corner = corneringLimit(vehicleDefinition, along) * 1.1;
          steer = clamp(control.steer, -corner, corner);
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
          const handling = vehicleHandling(c),
            corner = corneringLimit(vehicleDefinition, along);
          steer = clamp(ai.steer, -corner, corner);
          acceleration = clamp(
            (ai.desired * handling.top - along) * 5,
            -vehicleDefinition.brake,
            engineAcceleration(vehicleDefinition, along) * handling.power,
          );
          drag = 0;
        } else if (c.blockade && !c.braced) {
          // A roadblock cruiser shoved loose by a rammer slides and slews on
          // locked wheels before it scrubs to a halt.
          drag = 1.5;
          grip = 2.2;
        } else {
          drag = c.crewDeployed ? 9 : 1.8;
          grip = 4;
        }
        if (c !== pc && c.hp > 0 && (c.ai || c.cop) && !c.crewDeployed)
          braking = along > 2 * KMH ? acceleration < -0.12 * GRAVITY : along > -2 * KMH && acceleration <= 0;
        c.braking = braking;
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
          c.vx -= terrain.slope.x * GRAVITY * (1 + slide * 2.3) * stepSeconds;
          c.vy -= terrain.slope.y * GRAVITY * (1 + slide * 2.3) * stepSeconds;
        }
        // On a raised drawbridge leaf: gravity down the slope, grip up to ~40 degrees.
        if (c.deckLeaf) acceleration = drawbridgeSlopeDrive(c, acceleration, stepSeconds);
        c.vx += headingCosine * acceleration * stepSeconds;
        c.vy += headingSine * acceleration * stepSeconds;
        // Tyres cancel sideways slip, but only up to what they can grip: a little
        // past the cornering grip (cornerG) at full grip. Normal cornering never
        // reaches the limit; a car punted sideways by a T-bone or a blast skates
        // across the lane and scrubs off instead of stopping dead as if glued to the road.
        const lateralLimit =
            (((vehicleDefinition.cornerG || 1.2) * 1.25 * GRAVITY * Math.max(grip, 5)) / Math.max(vehicleDefinition.grip || 7, 5)) *
            stepSeconds,
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
            sink = Math.max(2.9 * UNITS_PER_METRE, slope.x * c.vx + slope.y * c.vy - (c.vz || 0));
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
      // Drawbridge leaves as ramps, take-off, landing and the gap (drawbridge.js).
      drawbridgeSettle(c, stepSeconds);
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
    function personIncapacitated(p) {
      return p.hp > 0 && ((p.knockedFor || 0) > 0 || (p.dazedFor || 0) > 0);
    }
    function personFallAmount(p) {
      // The dead go down over half a second (wounds.js); the knocked-down at once.
      return p.hp <= 0 ? deathFallAmount(p) : clamp((p.knockedFor || 0) / 0.55, 0, 1);
    }
    function updateKnockdowns(deltaSeconds) {
      // Walk the four lists in place rather than copying ~700 people every frame.
      for (const list of [pedestrians, enemies, gangMembers, officers])
        for (const p of list) updateKnockdown(p, deltaSeconds);
    }
    function updateKnockdown(p, deltaSeconds) {
      if (p.impactCooldown > 0) p.impactCooldown = Math.max(0, p.impactCooldown - deltaSeconds);
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
      } else if (person.faction && !person.military && source === player) alertGang(person.faction);
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
      // Nudging someone at walking pace is an accident, not a crime: only a hit
      // that hurts (20 km/h and up) makes the player the culprit.
      const culpable = c === player.car && damage > 0;
      crowdAlarm('knock', person, culpable ? player : null, person.hp <= 0 ? 2 : 1.3);
      if (culpable) {
        crime(person.hp <= 0 ? 0.35 : 0.08);
        if (person.hp <= 0) cash += 25;
      }
      return true;
    }
    // The car at a point along its sweep: pointInCar only reads the type (for the
    // spec), position and heading, so one scratch record stands in for a copy of
    // the whole vehicle at every sub-step.
    const sweepProbe = { type: null, airframe: null, x: 0, y: 0, a: 0 };
    function sweptPersonContact(person, c, from) {
      const distance = Math.hypot(c.x - from.x, c.y - from.y),
        steps = Math.min(24, Math.max(1, Math.ceil(distance / 7)));
      if (distance > 170) return pointInCar(person.x, person.y, c, 3);
      sweepProbe.type = c.type;
      sweepProbe.airframe = c.airframe;
      const turn = normalizeAngle(c.a - from.a);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        sweepProbe.x = from.x + (c.x - from.x) * f;
        sweepProbe.y = from.y + (c.y - from.y) * f;
        sweepProbe.a = from.a + turn * f;
        if (pointInCar(person.x, person.y, sweepProbe, 3)) return true;
      }
      return false;
    }
    // Pools a tyre can pick blood up from (not tracks themselves, under three
    // minutes old): gathered once a frame in updateCars(), not per car.
    const bloodTrackPrevious = { x: 0, y: 0, a: 0 },
      bloodTrackSources = [],
      bloodTrackCandidates = [];
    function updateBloodTracks(c, active) {
      // Where the car was last frame; the record is updated in place.
      const last = c.bloodTrackPoint || c.personSweepStart,
        prev = bloodTrackPrevious;
      prev.x = last ? last.x : c.x;
      prev.y = last ? last.y : c.y;
      prev.a = last ? last.a : c.a;
      if (!c.bloodTrackPoint) c.bloodTrackPoint = { x: 0, y: 0, a: 0 };
      c.bloodTrackPoint.x = c.x;
      c.bloodTrackPoint.y = c.y;
      c.bloodTrackPoint.a = c.a;
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
      if (!bloodTrackCandidates.length && !(c.bloodTrackRemaining > 0)) return;
      // Cheap distance test first: the surface check samples the terrain, and
      // every moving car ran it for every pool in the city each frame.
      const near = distance + vehicleSpec(c).l + 30,
        sources = bloodTrackSources,
        pools = bloodTrackCandidates;
      sources.length = 0;
      for (let i = 0; i < pools.length; i++) {
        const b = pools[i];
        if (
          Math.abs(b.x - c.x) < near &&
          Math.abs(b.y - c.y) < near &&
          Math.abs((b.surface || 0) - bloodSurface(b.x, b.y)) < 3
        )
          sources.push(b);
      }
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
      bloodTrackCandidates.length = 0;
      for (let i = 0; i < bloodPools.length; i++) {
        const b = bloodPools[i];
        if (!b.track && gameTime - b.created < 180) bloodTrackCandidates.push(b);
      }
      // Where each vehicle starts the frame (swept contacts with people), kept in place.
      for (const vehicle of vehicles) {
        const start = vehicle.personSweepStart || (vehicle.personSweepStart = { x: 0, y: 0, a: 0 });
        start.x = vehicle.x;
        start.y = vehicle.y;
        start.a = vehicle.a;
      }
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
          // Only a wreck the player caused recently is theirs: a car they scraped
          // a minute ago that burns out later is not a crime.
          const byPlayer = vehicle.lastAttacker === player && gameTime - (vehicle.lastDamagedAt ?? -100) < 30;
          if (byPlayer && vehicle !== player.car) recordVehicleKill(vehicle);
          if (!vehicleSpec(vehicle).bicycle)
            explode(
              vehicle.x,
              vehicle.y,
              0.65,
              vehicle.lastAttacker === player && !byPlayer ? 'world' : vehicle.lastAttacker || 'world',
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
        // Two contact sets per vehicle, swapped each frame: last frame's is read
        // while this frame's is filled.
        const speed = Math.hypot(vehicle.vx || 0, vehicle.vy || 0),
          contacts = vehicle.spareContacts || new Set(),
          reach = vehicleSpec(vehicle).l + 100;
        contacts.clear();
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
        for (const list of [enemies, gangMembers, officers, sportsTargets()]) for (const p of list) touch(p);
        vehicle.spareContacts = vehicle.pedestrianContacts || null;
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
