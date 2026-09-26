    // Oriented collision boxes, vehicle shapes, the static-collider grid (addStatic, nearbyStatics).
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
      addGarageDoorBodies();
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
      // Monarch Isle's garden walls, fences, pools, fountains, pumps and parapets (monarch.js).
      for (const b of monarchSolids()) addStatic(b.x, b.y, b.w, b.h, b.height, 'isle ' + b.kind);
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
