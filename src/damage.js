    // BEGIN SUBSYSTEM: src/damage.js — Vehicle damage, bullet impacts and breakable street furniture
    /**
     * Vehicle damage, bullet impacts and breakable street furniture
     * Source: src/damage.js
     * Scope: shared game closure.
     *
     * DAMAGE MODEL
     * Everything the renderer shows about a hurt vehicle is data on the vehicle, so
     * physics, handling and visuals always agree, and a repaired or newly spawned
     * vehicle starts clean (freshDamage):
     *   damage.front/rear/left/right  0..1 crumple of each zone (the original contract)
     *   vehicle.dents[]   {x, y, z, nx, ny, depth, r}: crumple centres in vehicle space. The
     *                     renderer pushes body vertices along (nx, ny) by up to `depth`
     *                     with a smooth falloff over radius `r` (damage3d.js).
     *   damage.parts      hood, bumpers, doors, trunk: 0 on, 1 sprung or hanging, 2 torn off
     *   damage.glass      per pane: 0 intact, 1 cracked, 2 shattered. Windscreens are
     *                     laminated and crack first; side and rear glass is tempered and
     *                     bursts at once.
     *   damage.lights     broken head and tail lamps (they stay dark at night)
     *   damage.tires      flat tyres: that corner sits down and the car pulls
     *   damage.marks[]    bullet holes, glass stars and scrapes, in vehicle space
     *   damage.pull       steering pull from bent suspension, -1 (left) .. 1 (right)
     *   damage.burning    seconds the engine has been on fire; it burns down to the explosion
     * Vehicle space: x forward along the heading, y to the right (map +y when facing east),
     * z up from the vehicle's floor. It matches the model's local x, z and y axes.
     *
     * Street furniture (lamp posts, signals, hydrants, bins, benches...) is registered
     * here by the renderer as it places each piece. A standing prop is a small solid box
     * for vehicles; enough momentum knocks it flat and it stops being solid.
     */
    const MAX_VEHICLE_MARKS = 32,
      MAX_VEHICLE_DENTS = 14,
      // Below this share of its health an engine catches fire and burns down to the tank.
      BURN_THRESHOLD = 0.25,
      // A mission vehicle's engine fire goes out on its own at this share of health.
      MISSION_FIRE_FLOOR = 0.08,
      NEUTRAL_HANDLING = Object.freeze({ power: 1, top: 1, grip: 1, pull: 0 });
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
    // Where the glass is on each body, in the same numbers render3d.js builds it with.
    function vehicleGlassBand(vehicle) {
      const spec = vehicleSpec(vehicle),
        l = spec.l,
        t = vehicle.type;
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
        // The crumple a closing speed buys: 150 units/s (about 100 km/h) into a wall
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
     * `grip` the tyres' sideways hold and `pull` (-1..1) the drift to one side.
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
      };
      vehicle.handlingVersion = vehicle.damageVersion;
      vehicle.handlingHp = vehicle.hp;
      return vehicle.handling;
    }

    // ---- Fire, wrecks and per-frame upkeep ------------------------------------------
    function canBurn(vehicle) {
      const type = damageClass(vehicle);
      return (type === 'car' || type === 'truck' || type === 'bike' || type === 'tank') && repairJob?.car !== vehicle;
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
     * `toughness` is the momentum (vehicle mass × closing speed in units/s) needed to
     * knock a piece over; below it the prop is solid. `give` is its mass in the same
     * units as vehicle masses: a lamp post takes about a third of a saloon's speed with
     * it, a bin nothing. `harm` is the damage the vehicle takes going through it.
     */
    const STREET_PROP_KINDS = {
      lamp: { half: [1.3, 1.3], toughness: 120, give: 0.55, harm: 10 },
      signal: { half: [1.4, 1.4], toughness: 150, give: 0.6, harm: 14 },
      hydrant: { half: [1.7, 1.7], toughness: 100, give: 0.45, harm: 8 },
      trash: { half: [2.6, 2.6], toughness: 12, give: 0.06, harm: 0 },
      news: { half: [1.8, 1.6], toughness: 22, give: 0.1, harm: 0 },
      mailbox: { half: [2, 2], toughness: 45, give: 0.18, harm: 2 },
      meter: { half: [0.8, 0.8], toughness: 35, give: 0.12, harm: 1 },
      bollard: { half: [0.9, 0.9], toughness: 230, give: 0.7, harm: 12 },
      cone: { half: [1.5, 1.5], toughness: 3, give: 0.01, harm: 0 },
      bench: { half: [8.5, 2.6], toughness: 55, give: 0.25, harm: 3 },
      crate: { half: [3, 3], toughness: 10, give: 0.05, harm: 0 },
      dumpster: { half: [8, 4], toughness: 150, give: 0.8, harm: 6 },
    };
    const streetProps = [],
      streetPropGrid = new Map(),
      knockedProps = [],
      // Marks a bench nobody can sit on: it is lying on its back.
      BROKEN_BENCH = { hp: 1, broken: true };
    const PROP_CELL = 128;
    // Called by the renderer as it places each knockable piece; returns the record it
    // animates. `yaw` turns the collision box with the model.
    function registerStreetProp(kind, x, y, yaw = 0) {
      const spec = STREET_PROP_KINDS[kind],
        prop = {
          id: 'p' + streetProps.length,
          kind,
          x,
          y,
          a: -yaw,
          hx: spec.half[0],
          hy: spec.half[1],
          down: false,
          knockedAt: 0,
          fallA: 0,
          fallSpeed: 0,
          sprayUntil: 0,
        };
      streetProps.push(prop);
      const key = Math.floor(x / PROP_CELL) * 4096 + Math.floor(y / PROP_CELL);
      if (!streetPropGrid.has(key)) streetPropGrid.set(key, []);
      streetPropGrid.get(key).push(prop);
      return prop;
    }
    function propsNear(x, y, reach, visit) {
      for (let i = Math.floor((x - reach) / PROP_CELL); i <= Math.floor((x + reach) / PROP_CELL); i++)
        for (let j = Math.floor((y - reach) / PROP_CELL); j <= Math.floor((y + reach) / PROP_CELL); j++) {
          const list = streetPropGrid.get(i * 4096 + j);
          if (list) for (const prop of list) visit(prop);
        }
    }
    // Once per physics step, after the contact passes: vehicles near the player against
    // standing furniture. Far away nothing is watching and traffic keeps to the road.
    function streetPropContacts() {
      if (!streetProps.length) return;
      for (const c of vehicles) {
        if (c.resting || isBoat(c) || (isAircraft(c) && aircraftClearance(c) > 4)) continue;
        if (Math.abs(c.x - player.x) > 1400 || Math.abs(c.y - player.y) > 1400) continue;
        const spec = vehicleSpec(c),
          reach = (spec.l + spec.w) / 2 + 10;
        let shape = null;
        propsNear(c.x, c.y, reach, (prop) => {
          if (prop.down || Math.abs(prop.x - c.x) > reach || Math.abs(prop.y - c.y) > reach) return;
          shape = shape || vehicleShape(c);
          const body = { x: prop.x, y: prop.y, hx: prop.hx, hy: prop.hy, a: prop.a, id: prop.id, kind: 'prop' },
            hit = boxContact(shape, body);
          if (!hit) return;
          const closing = (c.vx || 0) * hit.n.x + (c.vy || 0) * hit.n.y,
            kind = STREET_PROP_KINDS[prop.kind];
          if (closing * (spec.mass || 1.25) >= kind.toughness) knockStreetProp(prop, c, closing, hit);
          else {
            resolveContact(c, null, hit, body, true);
            shape = null;
          }
        });
      }
    }
    function knockStreetProp(prop, vehicle, closing, hit) {
      const kind = STREET_PROP_KINDS[prop.kind],
        spec = vehicleSpec(vehicle),
        mass = spec.mass || 1.25,
        // Momentum shared with the prop along the contact normal.
        taken = (closing * kind.give) / (kind.give + mass);
      vehicle.vx -= hit.n.x * taken;
      vehicle.vy -= hit.n.y * taken;
      const moving = Math.hypot(vehicle.vx || 0, vehicle.vy || 0) > 5;
      topple(prop, moving ? Math.atan2(vehicle.vy, vehicle.vx) : Math.atan2(hit.n.y, hit.n.x), closing);
      if (kind.harm)
        damageVehicle(vehicle, kind.harm * clamp(closing / 150, 0.5, 2), hit.x, hit.y, null, {
          kind: 'crash',
          nx: -hit.n.x,
          ny: -hit.n.y,
          closing: 36 + (closing - 36) * 0.55,
          otherMass: kind.give,
        });
      if (distanceBetween(prop, player) < 600) {
        noise(0.12 + kind.give * 0.2, clamp(0.06 + kind.give * 0.25, 0.06, 0.3), kind.give > 0.3 ? 520 : 1400);
        if (vehicle === player.car) shake = Math.max(shake, kind.give * 5);
      }
      if (city3D) city3D.impact(hit.x, hit.y, kind.give > 0.3 ? 'metal' : 'dust', entityElevation(vehicle));
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
      if (!knockedProps.includes(prop)) knockedProps.push(prop);
    }
    function blastStreetProps(x, y, power) {
      const reach = 75 * power;
      propsNear(x, y, reach, (prop) => {
        const distance = Math.hypot(prop.x - x, prop.y - y);
        if (prop.down || distance > reach) return;
        topple(prop, Math.atan2(prop.y - y, prop.x - x), 260 * power * (1 - distance / reach));
      });
    }
    // The city puts its furniture back once nobody is looking.
    function restoreStreetProps() {
      for (let i = knockedProps.length - 1; i >= 0; i--) {
        const prop = knockedProps[i];
        if (gameTime - prop.knockedAt < 240 || distanceBetween(prop, cameraTarget) < 1100) continue;
        prop.down = false;
        prop.sprayUntil = 0;
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
         * a parked `targetType` waits 150 units ahead, turned so that its `side`
         * ('front', 'rear', 'left', 'right') faces the oncoming car; the player's car
         * is launched at `metersPerSecond` and the world runs for `seconds`. `offset`
         * shifts the target sideways for an off-centre hit. Returns both damage
         * reports. Pass targetType null to drive at whatever is ahead.
         */
        crashTest(type = 'sedan', targetType = 'sedan', side = 'left', metersPerSecond = 30, seconds = 1.5, offset = 0) {
          if (player.car) exitCar();
          const car = spawnClearCar(type, player.x, player.y, 0, false);
          car.authorized = true;
          let target = null;
          if (targetType) {
            const heading = { front: Math.PI, rear: 0, left: -Math.PI / 2, right: Math.PI / 2 }[side] ?? 0;
            target = makeCar(targetType, car.x + 150, car.y + offset, heading, false);
          }
          enterVehicle(car);
          const speed = (metersPerSecond * BLOCK_SIZE) / 100;
          car.vx = speed;
          car.vy = 0;
          car.speed = speed;
          // Foot down all the way in, as a driver ramming something would.
          const steps = Math.round(clamp(seconds, 0, 20) * 30);
          keys.KeyW = true;
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
              out.push({ kind: p.kind, x: Math.round(p.x), y: Math.round(p.y), down: p.down });
          });
          return { total: streetProps.length, knocked: knockedProps.length, near: out };
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
      };
    }
    // END SUBSYSTEM: src/damage.js
