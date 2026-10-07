    // Crumple field: how far a point of a vehicle's body moves for its dents (crumpleField, crumpleLimits), the one rule
    // the renderer bends every part of a car body with (damage3d-crumple.js); dentVehicle and the crumpleAudit check.
    /*
     * CRUMPLE FIELD
     * A dent {x, y, z, nx, ny, depth, r} (vehicle space, damage-vehicles.js addDent) pushes body points along its
     * inward direction (nx, ny) by depth x (1 - q)^2, q being the point's squared distance from the dent's centre
     * over r^2 (height counts 0.6). On that smooth dish:
     *  - the crush front waves by up to 16 % across the panel (metal never folds evenly),
     *  - the metal buckles out of the panel in folds across the push (accordion creases about 0.9 m apart),
     *  - crushed metal bulges out to either side of the push (smoothly: no tear on the push's centre line);
     *  - inward travel stops softly at the crush limits (crumpleLimits): a nose folds back at most to the foot of the
     *    screen (the firewall, and no more than 30 % of the length), a tail to just behind the rear glass's foot (no
     *    further than 40 % of the length from the middle, nor 30 % in), a side to 20 % of the width from the centre
     *    line (about 0.4 m of intrusion on a saloon): nothing reaches the centre plane or the cabin's middle, and a
     *    point already past a limit is not pushed further in. The limits are per axis, so overlapping dents cannot
     *    add up past them.
     * Nothing in it is random or per vertex: every part of a body (shell, glass, paint panels, trim and cabin, lamps,
     * hood, bumpers, hinges, wheels, halos) follows the same field at its rest place, so parts that touch at rest
     * still touch after the crash. Pure: no state, no allocation. Lengths are the caller's units (the renderer passes
     * design units, render3d.js DESIGN SIZE: dents and limits divided by the model's scale).
     */
    const CRUMPLE_NOSE_TRAVEL = 0.3,
      CRUMPLE_SIDE_PLANE = 0.2;
    // The planes inward travel stops at, in vehicle space (world units) times `k`: `front` and `rear` along x, `side`
    // across (|y|). Written into `out` (made when not given).
    function crumpleLimits(vehicle, k = 1, out = {}) {
      const spec = vehicleSpec(vehicle),
        l = spec.l,
        band = vehicleGlassBand(vehicle),
        front = Math.max(band ? band.front : 0.2 * l, (0.5 - CRUMPLE_NOSE_TRAVEL) * l),
        rear = Math.min(-(0.5 - CRUMPLE_NOSE_TRAVEL) * l, Math.max(band ? band.back + 0.05 * l : -0.32 * l, -0.4 * l));
      out.front = front * k;
      out.rear = rear * k;
      out.side = CRUMPLE_SIDE_PLANE * spec.w * k;
      return out;
    }
    // Inward travel `t` against the room left before the crush limit: unchanged for the first 60 % of the room, then
    // eased so it never reaches the limit (same slope where the two meet). No room: no inward travel.
    function crumpleSoftStop(t, room) {
      if (!(room > 0)) return 0;
      const knee = room * 0.6;
      if (t <= knee) return t;
      const rest = room - knee;
      return knee + rest * (1 - Math.exp(-(t - knee) / rest));
    }
    // Writes into `out` {x, y, z} the move of the body point (x forward, y right, z up) for `dents` within `limits`
    // (crumpleLimits); `seed` (the vehicle's id) sets where the waves and folds fall.
    function crumpleField(dents, limits, x, y, z, seed, out) {
      let ix = 0,
        iy = 0,
        bx = 0,
        by = 0,
        dz = 0;
      const phase = (seed % 97) * 0.618;
      for (let k = 0; k < dents.length; k++) {
        const d = dents[k],
          depth = d.depth;
        if (!(depth > 0)) continue;
        const ex = x - d.x,
          ey = y - d.y,
          ez = (z - d.z) * 0.6,
          q = (ex * ex + ey * ey + ez * ez) / (d.r * d.r);
        if (q >= 1) continue;
        const fall = (1 - q) * (1 - q),
          along = ex * d.nx + ey * d.ny,
          across = ey * d.nx - ex * d.ny,
          wave = 1 + 0.16 * Math.sin(across * 0.75 + phase + k * 1.7) * Math.cos(z * 0.6 + phase * 0.7),
          t = depth * fall * wave,
          bulge = t * 0.12 * Math.tanh(across * 0.25);
        ix += d.nx * t;
        iy += d.ny * t;
        bx -= d.ny * bulge;
        by += d.nx * bulge;
        dz += t * (0.1 * Math.sin(along * 0.9 + phase * 1.3 + k) - 0.05);
      }
      if (ix < 0) ix = -crumpleSoftStop(-ix, x - limits.front);
      else if (ix > 0) ix = crumpleSoftStop(ix, limits.rear - x);
      if (iy < 0) iy = -crumpleSoftStop(-iy, y - limits.side);
      else if (iy > 0) iy = crumpleSoftStop(iy, -limits.side - y);
      out.x = ix + bx;
      out.y = iy + by;
      out.z = dz;
      return out;
    }
    /*
     * crumpleAudit(vehicle): the field on a box hull of the vehicle's size (sides, ends and rows across and along,
     * sampled every 1/20 of the length or width at three heights up to the belt line): the deepest inward travel at the
     * front, the rear and the sides against the room the limits leave (metres), points that crossed the centre plane
     * (`crossed`) or moved into the occupant cell (`intoCabin`: between the limit planes, the middle 40 % of the width,
     * from the floor to the belt), sample rows whose order along the push folded over (`folds`), the steepest change of
     * travel between neighbouring samples (`steepest`, per unit of spacing) and the largest move (`maxMoveM`); `marks`
     * and `holesOverBonnet` (holes off the glasshouse drawn above the belt line: none).
     */
    function crumpleAudit(vehicle) {
      const spec = vehicleSpec(vehicle),
        dents = vehicle.dents || [],
        l = spec.l,
        w = spec.w,
        band = vehicleGlassBand(vehicle),
        belt = band ? band.belt : 9,
        limits = crumpleLimits(vehicle),
        out = { x: 0, y: 0, z: 0 },
        n = 21,
        heights = [belt * 0.3, belt * 0.6, belt * 0.95],
        cabin = { x0: limits.rear + 0.02 * l, x1: limits.front - 0.02 * l, y: Math.min((w / 2) * 0.4, limits.side * 0.9), z0: 2, z1: belt - 0.5 },
        r3 = (v) => Math.round(v * 1000) / 1000;
      let crossed = 0,
        intoCabin = 0,
        folds = 0,
        steepest = 0,
        maxMove = 0,
        frontIn = 0,
        rearIn = 0,
        sideIn = 0,
        samples = 0;
      const inCabin = (x, y, z) => x > cabin.x0 && x < cabin.x1 && Math.abs(y) < cabin.y && z > cabin.z0 && z < cabin.z1;
      // One row of samples from (x0, y0) to (x1, y1) at height z: moved, checked in order along the row.
      const row = (x0, y0, x1, y1, z, axis) => {
        let last = null,
          lx = 0,
          ly = 0,
          lz = 0;
        for (let i = 0; i < n; i++) {
          const f = i / (n - 1),
            x = x0 + (x1 - x0) * f,
            y = y0 + (y1 - y0) * f;
          crumpleField(dents, limits, x, y, z, vehicle.id, out);
          const mx = x + out.x,
            my = y + out.y,
            mz = z + out.z;
          samples++;
          maxMove = Math.max(maxMove, Math.hypot(out.x, out.y, out.z));
          if (x > l * 0.45) frontIn = Math.max(frontIn, -out.x);
          if (x < -l * 0.45) rearIn = Math.max(rearIn, out.x);
          if (Math.abs(y) > w * 0.45) sideIn = Math.max(sideIn, y > 0 ? -out.y : out.y);
          if ((Math.abs(x) > l * 0.02 && Math.sign(mx) !== Math.sign(x)) || (Math.abs(y) > w * 0.02 && Math.sign(my) !== Math.sign(y))) crossed++;
          if (!inCabin(x, y, z) && inCabin(mx, my, mz)) intoCabin++;
          const along = axis === 'x' ? mx : my;
          if (last !== null && along < last - 0.05) folds++;
          if (i) steepest = Math.max(steepest, Math.hypot(out.x - lx, out.y - ly, out.z - lz) / (Math.hypot(x1 - x0, y1 - y0) / (n - 1) || 1));
          last = along;
          lx = out.x;
          ly = out.y;
          lz = out.z;
        }
      };
      for (const z of heights) {
        for (const side of [-1, 1]) row(-l / 2, (side * w) / 2, l / 2, (side * w) / 2, z, 'x');
        for (const end of [-1, 1]) row((end * l) / 2, -w / 2, (end * l) / 2, w / 2, z, 'y');
        // Rows across the body (the push of a side hit runs along them) and along its middle.
        for (const f of [-0.35, 0, 0.35]) row(f * l, -w / 2, f * l, w / 2, z, 'y');
        for (const f of [-0.3, 0, 0.3]) row(-l / 2, (f * w) / 2, l / 2, (f * w) / 2, z, 'x');
      }
      // Holes off the glasshouse drawn above the belt line (a chest-high line over a bonnet: bulletHitVehicle keeps them under it).
      let holesOverBonnet = 0;
      for (const mark of vehicle.damage?.marks || [])
        if (band && mark.kind === 'hole' && (mark.x <= band.back || mark.x >= band.front) && mark.z > band.belt - 0.5) holesOverBonnet++;
      const M = UNITS_PER_METRE;
      return {
        id: vehicle.id,
        type: vehicle.type,
        dents: dents.length,
        samples,
        frontInM: r3(frontIn / M),
        rearInM: r3(rearIn / M),
        sideInM: r3(sideIn / M),
        frontRoomM: r3((l / 2 - limits.front) / M),
        rearRoomM: r3((limits.rear + l / 2) / M),
        sideRoomM: r3((w / 2 - limits.side) / M),
        maxMoveM: r3(maxMove / M),
        steepest: r3(steepest),
        crossed,
        intoCabin,
        folds,
        marks: vehicle.damage?.marks?.length || 0,
        holesOverBonnet,
      };
    }
    function crumpleConsole() {
      const byId = (id) => (id === undefined ? player.car || null : vehicles.find((c) => c.id === id) || null);
      return {
        // A crash on one side of vehicle `id` at `kmh` closing speed against something immovable, `offset` (m) along
        // that side: the dent, zones and parts as a real crash records them (no hit points taken). Returns damageReport.
        dentVehicle(id, side = 'front', kmh = 50, offset = 0) {
          const c = byId(id);
          if (!c) return null;
          const spec = vehicleSpec(c),
            u = offset * UNITS_PER_METRE,
            face = { front: [spec.l / 2, u, -1, 0], rear: [-spec.l / 2, u, 1, 0], left: [u, -spec.w / 2, 0, 1], right: [u, spec.w / 2, 0, -1] }[side];
          if (!face) throw Error('side is front, rear, left or right');
          const at = vehicleWorldPoint(c, face[0], face[1]),
            cos = Math.cos(c.a),
            sin = Math.sin(c.a);
          recordVehicleDamage(c, 0, at.x, at.y, { kind: 'crash', nx: face[2] * cos - face[3] * sin, ny: face[2] * sin + face[3] * cos, closing: kmh * KMH, otherMass: 0 });
          c.damageVersion = (c.damageVersion || 0) + 1;
          return damageReport(c);
        },
        // `rounds` pistol rounds into one side of vehicle `id`, spread along it, through bulletHitVehicle as a real hit
        // records them (holes, stars, lamps, tyres; no hit points taken, so a test can shoot a car from every side).
        shootVehicle(id, side = 'left', rounds = 3) {
          const c = byId(id);
          if (!c) return null;
          const spec = vehicleSpec(c),
            out = { front: [1, 0], rear: [-1, 0], left: [0, -1], right: [0, 1] }[side];
          if (!out) throw Error('side is front, rear, left or right');
          const kinds = [];
          for (let k = 0; k < rounds; k++) {
            const along = rounds > 1 ? (k / (rounds - 1) - 0.5) * 0.7 : 0,
              lx = out[0] ? (out[0] * spec.l) / 2 : along * spec.l,
              ly = out[1] ? (out[1] * spec.w) / 2 : along * spec.w,
              from = vehicleWorldPoint(c, lx + out[0] * 6, ly + out[1] * 6),
              to = vehicleWorldPoint(c, lx - out[0] * 1.5, ly - out[1] * 1.5);
            kinds.push(bulletHitVehicle(c, { x: to.x, y: to.y, px: from.x, py: from.y, vx: (to.x - from.x) * 100, vy: (to.y - from.y) * 100, dmg: 28, altitude: entityElevation(c) }));
          }
          return { kinds, marks: damageReport(c).marks };
        },
        // The crumple field on a box hull of the vehicle (crumpleField, crumpleAudit above).
        crumpleAudit: (id) => {
          const c = byId(id);
          return c ? crumpleAudit(c) : null;
        },
        // The vehicle as drawn (damage3d-crumple.js, damage3d-marks.js): its crumpled parts and its marks on the body;
        // null without the 3D renderer.
        vehicleDamageShape: (id) => {
          const c = byId(id);
          return c && city3D ? city3D.vehicleDamageShape(c) : null;
        },
      };
    }
