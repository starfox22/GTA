      // Cabin headroom: the seated rig's head (head, hair and caps of the tallest man and woman, and the player) against
      // the glasshouse's inner surface; the seat search carSeatPlan runs (cabinSeatFit) and the audit
      // DeadEndCity.cabinHeadroom() reports (cabinHeadroomReport).
      /**
       * CABIN HEADROOM
       * A seated person is the rig in the 'riding' pose with its hip joint on the seat's hip point (crowd3d-driveby.js
       * SEATED OCCUPANTS): the torso lies back with the seat (`seatTorsoLean`, a little more upright than its back), the
       * head comes nearly level to watch the road (`seatHeadPitch`). The head's points (BODY_CLOSE and BODY_NEAR heads,
       * the hair styles and caps people wear in cars, at the tallest height a man or a woman is drawn at) follow the
       * same joint chain as drawCrowdPerson, so the seat plan and the audit see the head that is drawn.
       *
       * The inside of a glasshouse in profile (`cabinProfile`) is the rear glass, the roof lowered by CABIN_ROOF_LINER
       * (the roof skin and headliner) and the windscreen, at the head's outer edge (the roof's arch is lowest there);
       * the side glass closes it across (cabinGlassHalf). `cabinSeatFit` keeps CABIN_HEAD_GAP of it round the head: a
       * low roof first lowers the seat a little and lies it back, then lowers it to the floor; a seat that still does
       * not fit moves along the cabin. A body whose roof is too low for any of that is a body to fix (the audit says so).
       */
      const CABIN_ROOF_LINER = 0.03,
        CABIN_HEAD_GAP = 0.02,
        CABIN_SIDE_GAP = 0.02,
        CABIN_RECLINE_MIN = 0.3,
        // A saloon's seat back lies back at most 32 degrees; a mid-engined two-seater's (CAR_TWO_SEATERS) up to 39.
        CABIN_RECLINE_MAX = 0.56,
        CABIN_RECLINE_TWO = 0.68,
        // The tallest people drawn in cars (crowd3d-looks.js: heights 0.95-1.07 of PERSON_HEIGHT, a man's x 1.015
        // capped at 1.086, a woman's x 0.965), with the hair and caps their outfits give them (motorist, police, fed).
        CABIN_HEAD_TYPES = [
          { name: 'man', height: Math.min(1.086, 1.07 * 1.015), headScale: 1, parts: ['hairShort', 'hairCurly', 'hairBuzz', 'hairCrop', 'patrolCap'] },
          { name: 'woman', height: 1.07 * 0.965, headScale: 0.95, parts: ['hairLong', 'hairBun', 'hairCurly', 'hairPony', 'patrolCap'] },
        ];
      // The torso's lie for a seat back reclined `recline` radians, and the head's pitch that brings the face level.
      function seatTorsoLean(recline) {
        return recline - 0.05;
      }
      function seatHeadPitch(lean) {
        return 0.04 + 0.6 * lean;
      }
      /*
       * A head's points in the head joint's frame (rig units, scaled by the head scale) with the person's height:
       * { pts: Float32Array [x, y, z, ...], H }. `full` keeps every distinct point (the audit); otherwise only the
       * outline in profile (its convex hull) and the widest point of each height band (the seat search).
       */
      const cabinHeadClouds = new Map();
      function cabinHeadCloud(parts, headScale, height, full = false) {
        const key = parts.join(',') + ':' + headScale + ':' + height + (full ? ':full' : '');
        let cloud = cabinHeadClouds.get(key);
        if (cloud) return cloud;
        const seen = new Set(),
          pts = [],
          add = (geometry) => {
            const p = geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
              const x = p.getX(i) * headScale,
                y = p.getY(i) * headScale,
                z = p.getZ(i) * headScale,
                k = Math.round(x * 20) + ':' + Math.round(y * 20) + ':' + Math.round(z * 20);
              if (seen.has(k)) continue;
              seen.add(k);
              pts.push(x, y, z);
            }
          };
        add(BODY_CLOSE.head.mesh.geometry);
        add(BODY_NEAR.head.mesh.geometry);
        for (const name of parts) if (BODY_CLOSE[name]) add(BODY_CLOSE[name].mesh.geometry);
        let kept = pts;
        if (!full) {
          // The convex hull in profile (x, y), then the widest point of each 0.2-unit band (either side).
          const n = pts.length / 3,
            order = [...Array(n).keys()].sort((a, b) => pts[a * 3] - pts[b * 3] || pts[a * 3 + 1] - pts[b * 3 + 1]),
            cross = (o, a, b) => (pts[a * 3] - pts[o * 3]) * (pts[b * 3 + 1] - pts[o * 3 + 1]) - (pts[a * 3 + 1] - pts[o * 3 + 1]) * (pts[b * 3] - pts[o * 3]),
            hull = [];
          for (const pass of [order, order.slice().reverse()]) {
            const start = hull.length;
            for (const i of pass) {
              while (hull.length >= start + 2 && cross(hull[hull.length - 2], hull[hull.length - 1], i) <= 0) hull.pop();
              hull.push(i);
            }
            hull.pop();
          }
          const bands = new Map();
          for (let i = 0; i < n; i++) {
            const band = Math.round(pts[i * 3 + 1] * 5) * 2 + (pts[i * 3 + 2] < 0 ? 1 : 0),
              at = bands.get(band);
            if (at === undefined || Math.abs(pts[i * 3 + 2]) > Math.abs(pts[at * 3 + 2])) bands.set(band, i);
          }
          kept = [];
          for (const i of new Set([...hull, ...bands.values()])) kept.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
        }
        cloud = { pts: new Float32Array(kept), H: height * RIG_UNIT };
        cabinHeadClouds.set(key, cloud);
        return cloud;
      }
      // The clouds the seat search keeps clear: the tallest man's and woman's heads.
      function cabinSeatClouds() {
        return CABIN_HEAD_TYPES.map((t) => cabinHeadCloud(['head', ...t.parts], t.headScale, t.height));
      }
      /*
       * `cloud`'s points relative to the hip for a torso `lean` (drawCrowdPerson's chain: the torso joint RIG.waist over
       * the hip, the head joint (0.04, RIG.neck) up the torso, the head pitched by -headPitch - 0.3 lean), in model
       * units (`M` to the metre): into `out` as [x, y, z, ...] (x ahead, y up, z right of the hip).
       */
      function cabinHeadPose(cloud, lean, M, out, headPitch = seatHeadPitch(lean)) {
        const hr = -headPitch - lean * 0.3,
          ch = Math.cos(hr),
          sh = Math.sin(hr),
          cl = Math.cos(lean),
          sl = Math.sin(lean),
          k = (cloud.H / UNITS_PER_METRE) * M,
          p = cloud.pts;
        for (let i = 0; i < p.length; i += 3) {
          const tx = p[i] * ch - p[i + 1] * sh + 0.04,
            ty = p[i] * sh + p[i + 1] * ch + RIG.neck;
          out[i] = (tx * cl - ty * sl) * k;
          out[i + 1] = (tx * sl + ty * cl + RIG.waist) * k;
          out[i + 2] = p[i + 2] * k;
        }
        return out;
      }
      /*
       * The glasshouse's inside in profile at lateral offset `z` (model units), from the rear glass's foot over the roof
       * (lowered by the liner) to the windscreen's foot, as glassPoint lays the panes: [x0, y0, x1, y1, ...].
       */
      function cabinProfile(g, l, w, M, z, out = []) {
        let n = 0;
        const arch = g.arch || 0,
          bulge = g.bulge || 0,
          pane = (front, t) => {
            const half = lerpNumber(g.wb, g.wt, t) * w + (g.bow || 0) * w * Math.sin(Math.PI * t),
              s = clamp(Math.abs(z) / Math.max(1e-6, half), 0, 1),
              e = glassEdge(g, l, front, t);
            out[n++] = e[0] + (front ? 1 : -0.5) * bulge * (1 - s * s) * (1 - t);
            out[n++] = e[1] + arch * (1 - s * s) * t * t;
          };
        for (let i = 0; i <= 10; i++) pane(false, i / 10);
        const s = clamp(Math.abs(z) / Math.max(1e-6, g.wt * w), 0, 1);
        for (let i = 1; i < 12; i++) {
          const x = lerpNumber(g.rb, g.rf, i / 12) * l;
          out[n++] = x;
          out[n++] = g.roof + arch * (1 - s * s) + glassCrown(g, x, l) - CABIN_ROOF_LINER * M;
        }
        for (let i = 10; i >= 0; i--) pane(true, i / 10);
        out.length = n;
        // The roof's ends lowered by the liner too: the panes meet it at the liner's height.
        out[21] -= CABIN_ROOF_LINER * M;
        out[n - 21] -= CABIN_ROOF_LINER * M;
        return out;
      }
      // Signed distance of (x, y) inside the profile (positive inside), model units.
      function cabinProfileClear(prof, x, y) {
        let best = Infinity,
          under = false;
        for (let i = 0; i + 3 < prof.length; i += 2) {
          const ax = prof[i],
            ay = prof[i + 1],
            bx = prof[i + 2],
            by = prof[i + 3],
            dx = bx - ax,
            dy = by - ay,
            len = dx * dx + dy * dy,
            t = len > 0 ? clamp(((x - ax) * dx + (y - ay) * dy) / len, 0, 1) : 0,
            ex = ax + dx * t - x,
            ey = ay + dy * t - y,
            d = ex * ex + ey * ey;
          if (d < best) best = d;
          // Under this segment (the outline runs rear to front, so x rises along it).
          if (dx > 0 && x >= ax && x < bx && y < ay + (dy * (x - ax)) / dx) under = true;
        }
        return (under ? 1 : -1) * Math.sqrt(best);
      }
      /*
       * How much room a seated head has (model units; negative: through the glass or the roof) with the hip at
       * (x, y, -side) and the torso at `lean`, over the clouds' points; `scratch` an array to pose them into.
       * Also the widest seat spacing the side glass allows (`out.sideMax`).
       */
      const cabinScratch = { pts: new Float32Array(0), prof: [], sideMax: 0, roof: 0, glass: 0, side: 0 };
      function cabinClearance(g, l, w, M, clouds, x, y, side, lean, out = cabinScratch, headPitch = seatHeadPitch(lean)) {
        let clear = Infinity,
          sideMax = Infinity,
          roofClear = Infinity,
          sideClear = Infinity;
        cabinProfile(g, l, w, M, side + 0.09 * M, out.prof);
        for (const cloud of clouds) {
          if (out.pts.length < cloud.pts.length) out.pts = new Float32Array(cloud.pts.length);
          const p = cabinHeadPose(cloud, lean, M, out.pts, headPitch);
          for (let i = 0; i < cloud.pts.length; i += 3) {
            const px = x + p[i],
              py = y + p[i + 1];
            const c = cabinProfileClear(out.prof, px, py);
            if (c < roofClear) roofClear = c;
            if (py > g.base) {
              // The driver sits left of the centre line: the point's outward reach is -(z - side).
              const half = cabinGlassHalf(g, w, py),
                room = half - (side - p[i + 2]);
              if (room < sideClear) sideClear = room;
              if (half + p[i + 2] < sideMax) sideMax = half + p[i + 2];
            }
          }
        }
        clear = Math.min(roofClear, sideClear);
        out.sideMax = sideMax;
        out.roof = roofClear;
        out.side = sideClear;
        return clear;
      }
      /*
       * The seat for a closed glasshouse: { x, y, recline, side } in model units, from the default hip (x0, y0). The seat
       * back's top (and headrest) stays inside the rear glass (`fitX`); the head keeps CABIN_HEAD_GAP to the glass and
       * roof: first a little lower (up to 10 cm) and lying back a little, then down to the floor and further back,
       * then moving along the cabin. `two`: a two-seater's seat may lie further back; a body's own `seats.recline`
       * (radians) is its own limit (the Valkyrie's racing seats lie back as an F1 car's do).
       */
      function cabinSeatFit(g, l, w, M, x0, y0, floor, width, own, two = false) {
        const clouds = cabinSeatClouds(),
          gap = CABIN_HEAD_GAP * M,
          fitX = (recline, y) => {
            let x = x0;
            if (own?.x !== undefined) return x;
            const tx = x - 0.06 * M - Math.sin(recline) * 0.86 * M,
              ty = y + 0.02 * M + Math.cos(recline) * 0.86 * M,
              limit = cabinGlassX(g, l, ty, false) + 0.08 * M;
            if (tx < limit) x += limit - tx;
            // Behind a cab (the van's bulkhead): the seat under the cab's glass.
            if (x < g.xb * l + 0.3 * M) x = g.xb * l + 0.3 * M;
            return x;
          },
          sideFor = (recline, y) => {
            if (own?.z !== undefined) return own.z * M;
            const headY = y + 0.7 * M * Math.cos(recline);
            return Math.max(0.16 * M, Math.min(0.2 * width, cabinGlassHalf(g, w, headY) - 0.19 * M));
          };
        let best = null;
        const tryAt = (recline, y, dx = 0) => {
          const x = fitX(recline, y) + dx,
            lean = seatTorsoLean(recline);
          let side = sideFor(recline, y),
            clear = cabinClearance(g, l, w, M, clouds, x, y, side, lean);
          // Closer to the middle when the side glass leans in over the head.
          if (cabinScratch.side < gap && own?.z === undefined) {
            side = Math.max(0.16 * M, Math.min(side, cabinScratch.sideMax - gap));
            clear = cabinClearance(g, l, w, M, clouds, x, y, side, lean);
          }
          const seat = { x, y, recline, side, clear };
          if (!best || clear > best.clear) best = seat;
          return clear >= gap ? seat : null;
        };
        // The highest seat in [lo, y0] whose head clears (a lower seat never has less room), or null.
        const lowest = (recline, lo, dx = 0) => {
          let seat = tryAt(recline, y0, dx);
          if (seat || y0 <= lo) return seat;
          if (!tryAt(recline, lo, dx)) return null;
          let hi = y0,
            down = lo;
          for (let i = 0; i < 10; i++) {
            const mid = (hi + down) / 2;
            if (tryAt(recline, mid, dx)) down = mid;
            else hi = mid;
          }
          return tryAt(recline, down, dx);
        };
        const reclines = [],
          most = own?.recline ?? (two ? CABIN_RECLINE_TWO : CABIN_RECLINE_MAX);
        for (let r = CABIN_RECLINE_MIN; r <= most + 1e-6; r += 0.02) reclines.push(r);
        // Up to 10 cm lower and 23 degrees back first (a seat's own travel), then anything down to the floor.
        for (const [lo, upright] of [[Math.max(floor, y0 - 0.1 * M), 0.4], [floor, most]])
          for (const recline of reclines) {
            if (recline > upright + 1e-6) break;
            const seat = lowest(recline, lo);
            if (seat) return seat;
          }
        for (const step of [0.05, -0.05, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.3, -0.3])
          for (const recline of reclines) {
            const seat = lowest(recline, floor, step * M);
            if (seat) return seat;
          }
        return best;
      }
      /*
       * DeadEndCity.cabinHeadroom(): every car model built with a closed cabin (civilian, Prestige, police), once per
       * kit: the room (metres) round the head of the tallest man and woman and the player as they look now under the
       * roof and inside the glass (`clear`; `roof` the room under the roof and the panes alone), the drive-by pose's
       * `reach` to its grip; `through` lists who pokes out where, and the top-level `through` counts the cars with
       * anyone out.
       */
      function cabinHeadroomReport() {
        const r3 = (v) => +v.toFixed(3),
          cars = [],
          seen = new Set(),
          playerLook = compiledLook(specialLook(player), driveByGhost),
          people = [
            ...CABIN_HEAD_TYPES.map((t) => ({ name: t.name, cloud: cabinHeadCloud(['head', ...t.parts], t.headScale, t.height, true) })),
            { name: 'player', cloud: cabinHeadCloud(['head', playerLook.hairPart, playerLook.hatPart].filter(Boolean), playerLook.headScale, playerLook.height, true) },
          ];
        let through = 0;
        for (const [c, m] of carModels) {
          const plan = m.seats;
          if (!plan?.glass || plan.glass.g.open || !m.kit || seen.has(m.kit)) continue;
          seen.add(m.kit);
          const { g, l, w } = plan.glass,
            M = plan.M,
            side = Math.abs(plan.z),
            entry = { type: c.type, body: c.policeLook?.body || null, hip: [r3(plan.x / M), r3(plan.y / M)], recline: r3(plan.recline), fitMs: r3(plan.fitMs || 0), clear: {}, roof: {}, through: [] };
          for (const who of people) {
            const clear = cabinClearance(g, l, w, M, [who.cloud], plan.x, plan.y, side, plan.lean) / M;
            entry.clear[who.name] = r3(clear);
            entry.roof[who.name] = r3(cabinScratch.roof / M);
            if (clear < 0) entry.through.push(who.name + (cabinScratch.roof < cabinScratch.side ? ' roof' : ' side'));
          }
          // The drive-by pose sits in the same seat (crowd3d-driveby.js drawDriveByDriver) and reaches the grip the
          // bullet leaves from (driveby.js driveByGrip): how far, as a share of the arm, from the shoulder on its side.
          const profile = driveByProfile(c);
          if (profile && profile.body !== 'rider' && profile.body !== 'open') {
            entry.reach = r3(cabinDriveByReach(c, m, playerLook));
            // The same from driveBySeat at the old upright lean (what the pose reached before it took the model's seat).
            entry.reachGameSeat = r3(cabinDriveByReach(c, m, playerLook, true));
          }
          if (entry.through.length) through++;
          cars.push(entry);
        }
        return { through, cars, driveByArm: { ...driveByArm, gap: r3(driveByArm.gap) } };
      }
      /*
       * The drive-by arm's longest reach from the model's seat (x 1: the arm straight): the shoulder on the gun's side
       * (the torso at the seat's lean, untwisted) to driveByGrip for the left and right windows across the aims.
       */
      function cabinDriveByReach(c, m, look, game = false) {
        const plan = m.seats,
          k = m.group.scale.x || 1,
          s = driveBySeat(c),
          H = look.height * RIG_UNIT,
          lean = game ? 0.16 : plan.lean,
          hip = game ? [s.x, s.z, s.y] : [plan.x * k, plan.y * k, plan.z * k],
          arm = (RIG.upperArm + RIG.forearm) * H;
        let most = 0;
        for (const window of ['left', 'right'])
          for (const rel of window === 'left' ? [-1.2, -0.6, 0, 0.6, 1.2] : [-0.6, 0, 0.6]) {
            const grip = driveByGrip(c, window, rel),
              sign = grip.hand ? 1 : -1,
              up = (RIG.waist + RIG.shoulderY * Math.cos(lean)) * H,
              back = RIG.shoulderY * Math.sin(lean) * H,
              sx = hip[0] - back,
              sy = hip[1] + up,
              sz = hip[2] + sign * look.shoulderZ * look.width * H;
            most = Math.max(most, Math.hypot(grip.x - sx, grip.z - sy, grip.y - sz) / arm);
          }
        return most;
      }
