    const MAX_VEHICLE_MARKS = 32,
      MAX_VEHICLE_DENTS = 14,
      // Below this share of its health an engine catches fire and burns down to the tank.
      BURN_THRESHOLD = 0.25,
      // A mission vehicle's engine fire goes out on its own at this share of health.
      MISSION_FIRE_FLOOR = 0.08,
      NEUTRAL_HANDLING = Object.freeze({ power: 1, top: 1, grip: 1, pull: 0, steer: 1, brake: 1 });
    function freshDamage() {
      return {
        front: 0,
        rear: 0,
        left: 0,
        right: 0,
        parts: { hood: 0, bumperFront: 0, bumperRear: 0, doorLeft: 0, doorRight: 0, trunk: 0 },
        // Which end of a hanging bumper has dropped (-1 left, 1 right).
        bumperFrontSide: 0,
        bumperRearSide: 0,
        glass: { front: 0, rear: 0, left: 0, right: 0 },
        glassHits: { front: 0, rear: 0, left: 0, right: 0 },
        lights: { headLeft: false, headRight: false, tailLeft: false, tailRight: false },
        tires: { frontLeft: false, frontRight: false, rearLeft: false, rearRight: false },
        marks: [],
        markSerial: 0,
        pull: 0,
        burning: 0,
        // A mission vehicle's fire that has already burnt out (it does not relight).
        fireSpent: false,
        burnt: false,
        wreckedAt: 0,
        leaks: 0,
      };
    }
    function ensureDamage(vehicle) {
      if (!vehicle.damage?.parts) vehicle.damage = { ...freshDamage(), ...(vehicle.damage || {}) };
      if (!vehicle.dents) vehicle.dents = [];
      return vehicle.damage;
    }
    // Which damage the model can show: only car bodies crumple and shed panels.
    function damageClass(vehicle) {
      const spec = vehicleSpec(vehicle);
      if (!spec) return 'none';
      if (isAircraft(vehicle)) return 'aircraft';
      if (isBoat(vehicle)) return 'boat';
      if (spec.bicycle) return 'bicycle';
      if (spec.bike) return 'bike';
      if (spec.tank) return 'tank';
      if (spec.truck) return 'truck';
      return 'car';
    }
    function vehicleLocalPoint(vehicle, x, y) {
      const cos = Math.cos(vehicle.a),
        sin = Math.sin(vehicle.a),
        dx = x - vehicle.x,
        dy = y - vehicle.y;
      return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
    }
    function vehicleLocalDirection(vehicle, x, y) {
      const cos = Math.cos(vehicle.a),
        sin = Math.sin(vehicle.a);
      return { x: x * cos + y * sin, y: -x * sin + y * cos };
    }
    function vehicleWorldPoint(vehicle, x, y) {
      const cos = Math.cos(vehicle.a),
        sin = Math.sin(vehicle.a);
      return { x: vehicle.x + x * cos - y * sin, y: vehicle.y + x * sin + y * cos };
    }
    function damageZone(spec, x, y) {
      return Math.abs(x / spec.l) > Math.abs(y / spec.w) ? (x > 0 ? 'front' : 'rear') : y > 0 ? 'right' : 'left';
    }
    /* The glasshouses of the real-size cars (cars3d.js CAR_BODIES `glass`): the
       belt and roof heights in metres, the rear and front glass feet as shares
       of the length, and whether the car is open. Keep in step with the bodies. */
    const CAR_GLASS_BANDS = {
      sedan: [0.95, 1.44, -0.37, 0.2],
      taxi: [0.98, 1.46, -0.28, 0.21],
      coupe: [0.93, 1.43, -0.4, 0.24],
      muscle: [1.0, 1.42, -0.29, 0.13],
      sport: [0.86, 1.29, -0.36, 0.21],
      roadster: [0.82, 1.2, 0.02, 0.19, true],
      rally: [0.95, 1.46, -0.47, 0.21],
      hotrod: [1.02, 1.33, -0.25, 0.13],
      supercar: [0.83, 1.27, -0.42, 0.07],
      luxury: [1.07, 1.62, -0.33, 0.19],
      limousine: [0.98, 1.47, -0.4, 0.3],
      suv: [1.15, 1.87, -0.48, 0.22],
      van: [1.1, 2.5, -0.498, 0.3],
      pickup: [1.27, 1.95, -0.103, 0.25],
      chevette: [0.88, 1.22, -0.42, 0.13],
      brutini: [0.82, 1.13, -0.44, 0.2],
      cavalino: [0.86, 1.2, -0.4, 0.16],
    };
    // Where the glass is on each body, in the same numbers the renderer builds it with.
    function vehicleGlassBand(vehicle) {
      const spec = vehicleSpec(vehicle),
        l = spec.l,
        t = vehicle.type,
        real = !vehicle.policeLook && !vehicle.lawUnit && CAR_GLASS_BANDS[t];
      if (real) return { belt: real[0] * UNITS_PER_METRE, roof: real[1] * UNITS_PER_METRE, back: real[2] * l, front: real[3] * l, open: !!real[4] };
      if (spec.truck)
        return t === 'bus'
          ? { belt: 17, roof: 29, back: -0.46 * l, front: 0.47 * l, open: false }
          : { belt: 15.5, roof: 22.5, back: 0.14 * l, front: 0.46 * l, open: false };
      const low = ['sport', 'supercar', 'roadster'].includes(t),
        van = ['van', 'suv'].includes(t),
        long = van || t === 'rally' || t === 'limousine';
      return {
        belt: low ? 7 : 9,
        roof: van ? 19 : t === 'rally' || t === 'hotrod' ? 17 : low ? 11.7 : 14.5,
        back: (long ? -0.41 : -0.32) * l,
        front: 0.27 * l,
        open: t === 'roadster',
      };
    }

    // ---- Crumple -------------------------------------------------------------------
    // Dents close together merge into one deeper crumple, so a car hit over and over
    // in the nose keeps folding up instead of collecting a list of shallow dimples.
    function addDent(vehicle, dent) {
      const dents = vehicle.dents,
        spec = vehicleSpec(vehicle),
        cap = 0.3 * spec.l;
      let nearest = null,
        nearestDistance = Infinity;
      for (const d of dents) {
        const gap = Math.hypot(d.x - dent.x, d.y - dent.y, (d.z - dent.z) * 0.5);
        if (gap < nearestDistance) {
          nearestDistance = gap;
          nearest = d;
        }
      }
      if (nearest && (nearestDistance < Math.max(nearest.r, dent.r) * 0.45 || dents.length >= MAX_VEHICLE_DENTS)) {
        const share = dent.depth / Math.max(0.01, nearest.depth + dent.depth),
          nx = nearest.nx + (dent.nx - nearest.nx) * share,
          ny = nearest.ny + (dent.ny - nearest.ny) * share,
          length = Math.hypot(nx, ny) || 1;
        nearest.x += (dent.x - nearest.x) * share;
        nearest.y += (dent.y - nearest.y) * share;
        nearest.z += (dent.z - nearest.z) * share;
        nearest.nx = nx / length;
        nearest.ny = ny / length;
        nearest.depth = Math.min(cap, nearest.depth + dent.depth * 0.85);
        nearest.r = Math.min(spec.l * 0.5, Math.max(nearest.r, dent.r) + dent.depth * 0.3);
        nearest.force = clamp(nearest.depth / 1.4, 0.25, 3.5);
      } else
        dents.push({
          ...dent,
          depth: Math.min(cap, dent.depth),
          // The 2D fallback renderer still reads `force`.
          force: clamp(dent.depth / 1.4, 0.25, 3.5),
        });
    }
    function breakLamps(damage, end, y, width, depth) {
      const left = end === 'head' ? 'headLeft' : 'tailLeft',
        right = end === 'head' ? 'headRight' : 'tailRight';
      if (Math.abs(y) < width * 0.14 && depth > 2.4) damage.lights[left] = damage.lights[right] = true;
      else damage.lights[y < 0 ? left : right] = true;
    }
    function shatterPane(damage, pane) {
      damage.glass[pane] = 2;
    }
    function crackPane(damage, pane) {
      damage.glass[pane] = Math.max(damage.glass[pane], 1);
    }
    /**
     * Records what a hit did to the body. Called by damageVehicle() after the hit
     * points are taken, with the world point of contact and the detail of the cause.
     */
    function recordVehicleDamage(vehicle, amount, x, y, detail) {
      const damage = ensureDamage(vehicle),
        spec = vehicleSpec(vehicle),
        type = damageClass(vehicle),
        local = vehicleLocalPoint(vehicle, x, y),
        lx = clamp(local.x, -spec.l / 2, spec.l / 2),
        ly = clamp(local.y, -spec.w / 2, spec.w / 2),
        central = Math.abs(local.x) < 0.5 && Math.abs(local.y) < 0.5,
        kind = detail?.kind || (central ? 'wear' : 'impact'),
        share = amount / vehicle.maxhp;
      if (kind === 'bullet') {
        // Holes and glass are handled by bulletHitVehicle; the panel barely moves.
        const zone = damageZone(spec, lx, ly);
        damage[zone] = clamp(damage[zone] + share * 0.25, 0, 1);
        return;
      }
      if (kind === 'wear') {
        // No point of contact (a hard landing, a charging animal): it is spread around.
        for (const zone of ['front', 'rear', 'left', 'right'])
          damage[zone] = clamp(damage[zone] + share * 0.4, 0, 1);
        return;
      }
      let depth,
        nx,
        ny,
        px = lx,
        py = ly,
        z = 6;
      if (kind === 'crash') {
        // The crumple a closing speed buys: 150 units/s (about 68 km/h) into a wall
        // folds the nose in by about 5.7 units (a tenth of the car), capped at 30%.
        const inward = vehicleLocalDirection(vehicle, detail.nx, detail.ny),
          mass = spec.mass || 1.25,
          heavier = detail.otherMass ? clamp((2 * detail.otherMass) / (detail.otherMass + mass), 0.3, 1.7) : 1.25;
        depth = clamp((detail.closing - 36) * 0.04 * heavier, 0, 0.3 * spec.l);
        nx = inward.x;
        ny = inward.y;
      } else if (kind === 'blast') {
        // The face toward the blast is dished in; the harder the closer.
        const from = vehicleLocalPoint(vehicle, detail.x, detail.y),
          distance = Math.hypot(from.x, from.y) || 1;
        nx = -from.x / distance;
        ny = -from.y / distance;
        px = clamp(from.x, -spec.l / 2, spec.l / 2);
        py = clamp(from.y, -spec.w / 2, spec.w / 2);
        depth = clamp(detail.power * 7.5 * detail.falloff, 0, 0.22 * spec.l);
        z = 7;
      } else {
        const distance = Math.hypot(lx, ly) || 1;
        nx = -lx / distance;
        ny = -ly / distance;
        depth = clamp(share * 10, 0.25, 3.5) * 1.1;
      }
      const zone = damageZone(spec, px, py),
        span = zone === 'front' || zone === 'rear' ? 0.25 * spec.l : 0.5 * spec.w;
      if (depth > 0.05) addDent(vehicle, { x: px, y: py, z, nx, ny, depth, r: clamp(8 + depth * 1.7, 8, spec.l * 0.45) });
      damage[zone] = clamp(damage[zone] + depth / span + share * 0.5, 0, 1);
      if (type === 'car' || type === 'truck') breakParts(vehicle, damage, spec, zone, px, py, depth);
    }
    // Panels, lamps, glass and wheels give way as a zone crumples.
    function breakParts(vehicle, damage, spec, zone, x, y, depth) {
      const parts = damage.parts,
        big = depth > 4.5,
        crumple = damage[zone];
      if (zone === 'front') {
        if (crumple > 0.55 || (big && crumple > 0.35)) parts.hood = Math.max(parts.hood, 1);
        if (crumple > 0.8 && depth > 5.5 && Math.random() < 0.6) parts.hood = 2;
        if (crumple > 0.3 && !parts.bumperFront) {
          parts.bumperFront = 1;
          damage.bumperFrontSide = y < 0 ? -1 : 1;
        }
        if (crumple > 0.65 && depth > 4 && Math.random() < 0.55) parts.bumperFront = 2;
        if (depth > 1.2) breakLamps(damage, 'head', y, spec.w, depth);
        if (crumple > 0.4) crackPane(damage, 'front');
        if (crumple > 0.82) shatterPane(damage, 'front');
        // A corner hit bends that front wheel back: the car pulls toward it.
        if (Math.abs(y) > spec.w * 0.15) damage.pull = clamp(damage.pull + Math.sign(y) * depth * 0.018, -0.6, 0.6);
      } else if (zone === 'rear') {
        if (crumple > 0.5) parts.trunk = Math.max(parts.trunk, 1);
        if (crumple > 0.3 && !parts.bumperRear) {
          parts.bumperRear = 1;
          damage.bumperRearSide = y < 0 ? -1 : 1;
        }
        if (crumple > 0.65 && depth > 4 && Math.random() < 0.55) parts.bumperRear = 2;
        if (depth > 1.2) breakLamps(damage, 'tail', y, spec.w, depth);
        if (crumple > 0.5) shatterPane(damage, 'rear');
      } else {
        const door = zone === 'left' ? 'doorLeft' : 'doorRight';
        if (crumple > 0.45 || (big && crumple > 0.3)) parts[door] = Math.max(parts[door], 1);
        if (crumple > 0.8 && depth > 5 && Math.random() < 0.5) parts[door] = 2;
        if (crumple > 0.3 || depth > 3) shatterPane(damage, zone);
        const front = x > 0,
          wheelX = front ? spec.l * 0.3 : -spec.l * 0.31;
        if (depth > 4 && Math.abs(x - wheelX) < 8)
          damage.tires[(front ? 'front' : 'rear') + (zone === 'left' ? 'Left' : 'Right')] = true;
        if (front && depth > 3) damage.pull = clamp(damage.pull + (zone === 'left' ? -1 : 1) * 0.08, -0.6, 0.6);
      }
    }
    // A wreck has no hit points left to lose, but it still folds when rammed.
    function crumpleWreck(vehicle, x, y, detail) {
      recordVehicleDamage(vehicle, 0, x, y, detail);
      vehicle.damageVersion = (vehicle.damageVersion || 0) + 1;
    }
    function addVehicleMark(vehicle, mark) {
      const damage = ensureDamage(vehicle);
      mark.id = ++damage.markSerial;
      damage.marks.push(mark);
      if (damage.marks.length > MAX_VEHICLE_MARKS) damage.marks.shift();
    }

    // ---- Bullets -------------------------------------------------------------------
    function bulletHoleSize(b) {
      return clamp(0.9 + (b.dmg || 20) * 0.016, 1.15, 2.8);
    }
    // Where the bullet's last sub-step crossed into the vehicle's box, and through which face.
    function bulletEntry(vehicle, b) {
      const spec = vehicleSpec(vehicle),
        from = vehicleLocalPoint(vehicle, b.px ?? b.x - b.vx * 0.004, b.py ?? b.y - b.vy * 0.004),
        to = vehicleLocalPoint(vehicle, b.x, b.y),
        hx = spec.l / 2,
        hy = spec.w / 2,
        dx = to.x - from.x,
        dy = to.y - from.y,
        travel = Math.hypot(dx, dy) || 1;
      let enter = 0,
        face = null;
      for (const [start, delta, half, negative, positive] of [
        [from.x, dx, hx, 'rear', 'front'],
        [from.y, dy, hy, 'left', 'right'],
      ]) {
        if (Math.abs(delta) < 1e-6) continue;
        const t = ((delta > 0 ? -half : half) - start) / delta;
        if (t > enter && t <= 1.05) {
          enter = t;
          face = delta > 0 ? negative : positive;
        }
      }
      const x = clamp(from.x + dx * enter, -hx, hx),
        y = clamp(from.y + dy * enter, -hy, hy);
      // Already inside at the start of the step (a point-blank shot): nearest face.
      if (!face) face = damageZone(spec, to.x, to.y);
      return { x, y, face, dx: dx / travel, dy: dy / travel };
    }
    /**
     * A round has struck a vehicle: record the hole (or the star in the glass) where
     * it went in, and break whatever it went through. Returns the impact kind for the
     * spark effect: 'metal' or 'glass'.
     */
    function bulletHitVehicle(vehicle, b) {
      const damage = ensureDamage(vehicle),
        spec = vehicleSpec(vehicle),
        type = damageClass(vehicle),
        entry = bulletEntry(vehicle, b),
        band = type === 'car' || type === 'truck' ? vehicleGlassBand(vehicle) : null,
        roof = band ? band.roof : type === 'bike' || type === 'bicycle' ? 14 : 30,
        // Shots are fired from chest height; the scatter keeps holes from lining up.
        z = clamp(9 + (b.altitude || 0) - entityElevation(vehicle) + randomBetween(-4, 4), 2.5, roof - 0.4),
        size = bulletHoleSize(b),
        heavy = (b.dmg || 0) >= 90;
      let kind = 'metal';
      if (band && z > band.belt + 0.4 && entry.x > band.back && entry.x < band.front && (!band.open || entry.face === 'front')) {
        const pane = entry.face;
        damage.glassHits[pane]++;
        if (damage.glass[pane] < 2) {
          kind = 'glass';
          // Toughened side and rear glass bursts into crumbs; the laminated windscreen
          // stars and cobwebs, and only caves in after several hits.
          if (pane !== 'front' ? Math.random() < 0.85 || heavy : damage.glassHits[pane] >= 4 || heavy)
            shatterPane(damage, pane);
          else {
            crackPane(damage, pane);
            addVehicleMark(vehicle, { kind: 'star', pane, x: entry.x, y: entry.y, z, dx: entry.dx, dy: entry.dy, size: size * 2.6 });
          }
        }
        vehicle.damageVersion++;
        return kind;
      }
      addVehicleMark(vehicle, { kind: 'hole', x: entry.x, y: entry.y, z, dx: entry.dx, dy: entry.dy, size });
      if (band) {
        // Lamps sit in the corners of each end, below the belt line.
        const lampY = Math.abs(entry.y) > spec.w * 0.1 && Math.abs(entry.y) < spec.w * 0.48 && z < band.belt + 1;
        if (entry.face === 'front' && lampY && Math.random() < 0.8) damage.lights[entry.y < 0 ? 'headLeft' : 'headRight'] = true;
        if (entry.face === 'rear' && lampY && Math.random() < 0.8) damage.lights[entry.y < 0 ? 'tailLeft' : 'tailRight'] = true;
        // A round into a tyre lets it down; the corner sags and the car pulls.
        if (z < 8.5)
          for (const [end, wheelX] of [
            ['front', spec.l * 0.3],
            ['rear', -spec.l * 0.31],
          ])
            if (Math.abs(entry.x - wheelX) < 5.5 && (entry.face === 'left' || entry.face === 'right') && Math.random() < 0.75)
              damage.tires[end + (entry.face === 'left' ? 'Left' : 'Right')] = true;
      }
      vehicle.damageVersion++;
      return kind;
    }
    // The face of a wall rectangle a bullet came through, from where its sub-step began.
    function wallFace(r, b) {
      const x0 = b.px ?? b.x - b.vx * 0.004,
        y0 = b.py ?? b.y - b.vy * 0.004,
        west = r.x - x0,
        east = x0 - (r.x + r.w),
        north = r.y - y0,
        south = y0 - (r.y + r.h),
        out = Math.max(west, east, north, south);
      if (out === south) return { x: clamp(b.x, r.x, r.x + r.w), y: r.y + r.h, nx: 0, ny: 1 };
      if (out === north) return { x: clamp(b.x, r.x, r.x + r.w), y: r.y, nx: 0, ny: -1 };
      if (out === west) return { x: r.x, y: clamp(b.y, r.y, r.y + r.h), nx: -1, ny: 0 };
      return { x: r.x + r.w, y: clamp(b.y, r.y, r.y + r.h), nx: 1, ny: 0 };
    }
    /**
     * A rocket or a main-gun round that struck a building face: where on the face
     * it hit (so the blast goes off outside the wall, not inside it), and for a
     * tank shell a breach in the facade (damage3d.js shellImpact). Returns the
     * point to detonate at, or null when it did not hit a building.
     */
    function heavyRoundHitsBuilding(b) {
      const altitude = b.altitude || 0;
      for (const building of buildingsNear(b.x, b.y)) {
        if (altitude + 4 > building.height || building.depotWall) continue;
        if (b.x < building.x - 2 || b.x > building.x + building.w + 2 || b.y < building.y - 2 || b.y > building.y + building.h + 2)
          continue;
        const face = wallFace(building, b),
          z = clamp(altitude + 10, 6, building.height - 3);
        if (b.shell && city3D && distanceBetween(face, cameraTarget) < 1400)
          city3D.shellImpact(face.x, face.y, z, face.nx, face.ny, building, b.blastPower || 1);
        return { x: face.x + face.nx * 4, y: face.y + face.ny * 4 };
      }
      return null;
    }
    /**
     * A round stopped by scenery (shotBlocked said so): leave a chip in the wall it hit,
     * a star or a hole in a shop window, or a scuff in the ground. Returns the impact
     * kind for the effect: 'wall', 'glass' or 'dust'.
     */
    function bulletHitSurface(b) {
      const altitude = b.altitude || 0,
        z = 9 + altitude + randomBetween(-3.5, 4.5),
        size = bulletHoleSize(b),
        inside = (r, margin = 0) =>
          altitude + 10 < r.height &&
          b.x > r.x - margin &&
          b.x < r.x + r.w + margin &&
          b.y > r.y - margin &&
          b.y < r.y + r.h + margin;
      for (const building of buildingsNear(b.x, b.y))
        if (inside(building, 1.5)) {
          const face = wallFace(building, b);
          return city3D ? city3D.bulletHole(face.x, face.y, z, face.nx, face.ny, size, 'wall', building) : 'wall';
        }
      for (const r of [...garageWalls(), ...harborSolids(), ...depotSolids(), ...militarySolids(), ...countySolids()])
        if (inside(r)) {
          const face = wallFace(r, b);
          return city3D ? city3D.bulletHole(face.x, face.y, z, face.nx, face.ny, size, 'wall', null) : 'wall';
        }
      if (landAt(b.x, b.y) && altitude + 10 < terrainHeight(b.x, b.y)) {
        if (city3D) city3D.bulletHole(b.x, b.y, terrainHeight(b.x, b.y), 0, 0, size, 'ground', null);
        return 'dust';
      }
      return 'wall';
    }
    // A round that ran out of flight comes down: a scuff on land, a splash on water.
    function bulletSpent(b) {
      if (b.rocket || !city3D || distanceBetween(b, cameraTarget) > 1100) return;
      const ground = terrainHeight(b.x, b.y);
      if ((b.altitude || 0) - ground > 40) return;
      if (landAt(b.x, b.y)) {
        city3D.bulletHole(b.x, b.y, ground, 0, 0, bulletHoleSize(b), 'ground', null);
        city3D.impact(b.x, b.y, 'dust', ground - 4);
      } else city3D.impact(b.x, b.y, 'water', -4);
    }

    // ---- Blasts --------------------------------------------------------------------
    /**
     * The shock wave of explode(): every vehicle in reach is shoved away and spun
     * about the side that took it, bounced on its springs, and has its glass blown
     * in. Wrecks move too. Street furniture goes over and the renderer scorches and
     * breaks the nearest facades.
     */
    function blastEffects(x, y, altitude, power) {
      const radius = 110 * power;
      for (const c of vehicles) {
        if (isBoat(c) || (isAircraft(c) && aircraftClearance(c) > 6)) continue;
        const dx = c.x - x,
          dy = c.y - y,
          distance = Math.hypot(dx, dy);
        if (distance > radius || Math.abs(entityElevation(c) - altitude) > 45) continue;
        if (distance > 14 && !clearSight({ x, y, altitude }, c)) continue;
        const spec = vehicleSpec(c),
          mass = spec.mass || 1.25,
          falloff = 1 - distance / radius,
          push = (270 * power * falloff * falloff) / Math.max(0.7, mass),
          ux = distance > 1 ? dx / distance : 0,
          uy = distance > 1 ? dy / distance : 0,
          // The blast acts on the face toward it, not the middle: that lever arm spins the car.
          near = vehicleLocalPoint(c, x, y),
          contact = vehicleWorldPoint(c, clamp(near.x, -spec.l / 2, spec.l / 2), clamp(near.y, -spec.w / 2, spec.w / 2)),
          armX = contact.x - c.x,
          armY = contact.y - c.y,
          torque = armX * uy - armY * ux;
        c.vx = (c.vx || 0) + ux * push;
        c.vy = (c.vy || 0) + uy * push;
        c.av = clamp((c.av || 0) + ((torque * push * 12) / (spec.l ** 2 + spec.w ** 2)) * 0.6 + randomBetween(-0.3, 0.3) * falloff, -3, 3);
        c.spinUntil = physicsClock + 0.6 + falloff * 0.8;
        c.restSteps = 0;
        c.resting = false;
        // The springs: the car is thrown up and tips away from the flash.
        const hop = c.hop || (c.hop = { z: 0, vz: 0, pitch: 0, roll: 0, vp: 0, vr: 0 }),
          lift = (120 * power * falloff) / Math.sqrt(mass);
        hop.vz += distance < 6 ? lift * 1.3 : lift;
        hop.vp += (near.x > 0 ? 1 : -1) * 2.6 * power * falloff;
        hop.vr += (near.y > 0 ? -1 : 1) * 2.6 * power * falloff;
        const type = damageClass(c);
        if (type !== 'car' && type !== 'truck') continue;
        const damage = ensureDamage(c),
          facing = damageZone(spec, near.x, near.y);
        // Glass nearest the flash goes first; close in, all of it.
        for (const pane of ['front', 'rear', 'left', 'right'])
          if (falloff > 0.65 || (pane === facing && falloff > 0.3)) shatterPane(damage, pane);
          else if (falloff > 0.2) crackPane(damage, pane);
        if (falloff > 0.55) {
          for (const lamp of Object.keys(damage.lights)) if (Math.random() < falloff) damage.lights[lamp] = true;
          for (const tire of Object.keys(damage.tires)) if (Math.random() < falloff * 0.5) damage.tires[tire] = true;
          if (type === 'car') {
            const parts = damage.parts;
            if (Math.random() < falloff * 0.8) parts.hood = Math.max(parts.hood, falloff > 0.8 ? 2 : 1);
            for (const door of ['doorLeft', 'doorRight'])
              if (Math.random() < falloff * 0.6) parts[door] = Math.max(parts[door], falloff > 0.85 && Math.random() < 0.5 ? 2 : 1);
            if (Math.random() < falloff * 0.5) parts.trunk = Math.max(parts.trunk, 1);
          }
        }
        c.damageVersion = (c.damageVersion || 0) + 1;
      }
      blastStreetProps(x, y, power);
      if (city3D) city3D.structureBlast(x, y, altitude, power);
    }
    // A vehicle driven into a building face hard enough cracks it and knocks chunks off.
    function structureImpact(vehicle, hit, closing, staticBody) {
      if (closing < 110 || !city3D || staticBody.kind !== 'building') return;
      if (distanceBetween(vehicle, cameraTarget) > 1200) return;
      const building = buildingsNear(staticBody.x, staticBody.y).find(
        (b) => Math.abs(b.x + b.w / 2 - staticBody.x) < 1 && Math.abs(b.y + b.h / 2 - staticBody.y) < 1,
      );
      city3D.structureImpact(hit.x, hit.y, -hit.n.x, -hit.n.y, closing, building || null, entityElevation(vehicle));
    }

    // ---- Handling ------------------------------------------------------------------
    /**
     * How the damage drives: `power` scales the engine's pull, `top` the top speed,
     * `grip` the tyres' sideways hold, `pull` (-1..1) the drift to one side,
     * `steer` the steering's reach and `brake` the brakes' bite.
     * Recomputed only when the damage or hit points change.
     */
    function vehicleHandling(vehicle) {
      const damage = vehicle.damage;
      if (!damage?.parts) return NEUTRAL_HANDLING;
      const type = damageClass(vehicle);
      if (type !== 'car' && type !== 'truck' && type !== 'bike') return NEUTRAL_HANDLING;
      if (vehicle.handling && vehicle.handlingVersion === vehicle.damageVersion && vehicle.handlingHp === vehicle.hp)
        return vehicle.handling;
      const tires = damage.tires,
        flatLeft = (tires.frontLeft ? 1 : 0) + (tires.rearLeft ? 1 : 0),
        flatRight = (tires.frontRight ? 1 : 0) + (tires.rearRight ? 1 : 0),
        flats = flatLeft + flatRight,
        engine = clamp(vehicle.hp / vehicle.maxhp / 0.55, 0, 1);
      vehicle.handling = {
        power: (0.5 + 0.5 * engine) * (1 - damage.front * 0.25),
        top: clamp(1 - flats * 0.11 - damage.front * 0.2, 0.45, 1),
        grip: 1 - flats * 0.12,
        pull: clamp(damage.pull + (flatRight - flatLeft) * 0.22, -0.8, 0.8),
        // A bent front end (track rods, a wheel knocked back) steers less; flat
        // tyres brake worse.
        steer: clamp(1 - damage.front * 0.25 - flats * 0.04, 0.6, 1),
        brake: clamp(1 - flats * 0.12, 0.5, 1),
      };
      vehicle.handlingVersion = vehicle.damageVersion;
      vehicle.handlingHp = vehicle.hp;
      return vehicle.handling;
    }
