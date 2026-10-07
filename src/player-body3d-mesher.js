      // Player body: signed distance primitives, a field of ordered operations culled per cell, and the
      // surface-nets mesher that turns a field into a smooth closed mesh (vertices projected onto the surface).
      /**
       * FIELDS
       * A field is a list of operations on a running distance d, in order:
       *   { op: 'add', f, b, k }   d = smooth union of d and f (blend radius k)
       *   { op: 'sub', f, b, k }   d = smooth difference (f carved out)
       *   { op: 'mod', g, b }      d = g(x, y, z, d) (a local displacement: hair, folds)
       * f(x, y, z) is a distance (metres, Lipschitz about 1); b [cx, cy, cz, r] bounds where it matters.
       * The mesher evaluates every operation at each coarse cell's centre and keeps, for the points of that
       * cell, only the operations that can change d there, so a body of ~80 parts costs a handful per point.
       */
      const pbLen3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z),
        pbLen2 = (x, y) => Math.sqrt(x * x + y * y);
      const pbSmin = (a, b, k) => {
        if (k <= 0) return a < b ? a : b;
        const h = Math.max(k - Math.abs(a - b), 0) / k;
        return Math.min(a, b) - h * h * k * 0.25;
      };
      const pbSmax = (a, b, k) => -pbSmin(-a, -b, k);
      // Primitives (each returns a function of a point): local frames are given by the caller's transforms.
      function pbSphere(cx, cy, cz, r) {
        return { f: (x, y, z) => pbLen3(x - cx, y - cy, z - cz) - r, b: [cx, cy, cz, r] };
      }
      /* An ellipsoid (radii rx, ry, rz) about its centre; the usual bound-corrected estimate. */
      function pbEllipsoid(cx, cy, cz, rx, ry, rz, frame = null) {
        const irx = 1 / rx,
          iry = 1 / ry,
          irz = 1 / rz;
        const f = (x, y, z) => {
          let px = x - cx,
            py = y - cy,
            pz = z - cz;
          if (frame) {
            const qx = frame[0] * px + frame[1] * py + frame[2] * pz,
              qy = frame[3] * px + frame[4] * py + frame[5] * pz,
              qz = frame[6] * px + frame[7] * py + frame[8] * pz;
            px = qx;
            py = qy;
            pz = qz;
          }
          const k0 = pbLen3(px * irx, py * iry, pz * irz),
            k1 = pbLen3(px * irx * irx, py * iry * iry, pz * irz * irz);
          return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
        };
        return { f, b: [cx, cy, cz, Math.max(rx, ry, rz)] };
      }
      /* A rotation (rows) taking world offsets into a frame whose y runs along `axis` (unit), x towards `fwd`. */
      function pbFrameAlong(ax, ay, az, fx = 1, fy = 0, fz = 0) {
        const l = Math.hypot(ax, ay, az);
        ax /= l;
        ay /= l;
        az /= l;
        const d = fx * ax + fy * ay + fz * az;
        let xx = fx - d * ax,
          xy = fy - d * ay,
          xz = fz - d * az;
        let xl = Math.hypot(xx, xy, xz);
        if (xl < 1e-6) {
          xx = 0;
          xy = 0;
          xz = 1;
          xl = 1;
        }
        xx /= xl;
        xy /= xl;
        xz /= xl;
        const zx = xy * az - xz * ay,
          zy = xz * ax - xx * az,
          zz = xx * ay - xy * ax;
        return [xx, xy, xz, ax, ay, az, zx, zy, zz];
      }
      /**
       * A round cone between two points: radius ra at a, rb at b, with an elliptical section (`flat` < 1
       * squeezes it along the frame's z, which is `side` x the axis) and an optional bulge along its length
       * (`bulge(t)` adds to the radius, t 0 at a, 1 at b). Inigo Quilez's round-cone distance, section scaled.
       */
      function pbLimb(a, b, ra, rb, { flat = 1, fwd = [1, 0, 0], bulge = null, depth = 1 } = {}) {
        const ax = a[0],
          ay = a[1],
          az = a[2],
          vx = b[0] - ax,
          vy = b[1] - ay,
          vz = b[2] - az,
          len = Math.hypot(vx, vy, vz),
          frame = pbFrameAlong(vx, vy, vz, fwd[0], fwd[1], fwd[2]),
          cosA = (ra - rb) / len,
          sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
        const f = (x, y, z) => {
          const px = x - ax,
            py = y - ay,
            pz = z - az;
          // Into the limb's frame: u along, (s, w) across (s forward, w sideways).
          const u = frame[3] * px + frame[4] * py + frame[5] * pz;
          let s = (frame[0] * px + frame[1] * py + frame[2] * pz) / depth,
            w = (frame[6] * px + frame[7] * py + frame[8] * pz) / flat;
          const extra = bulge ? bulge(Math.min(1, Math.max(0, u / len)), s, w) : 0,
            r0 = ra + extra,
            r1 = rb + extra,
            q = pbLen2(s, w),
            // Round cone in 2D (q across, u along).
            ll = len,
            k = -q * cosA + u * sinA;
          let d;
          if (k < 0) d = pbLen2(q, u) - r0;
          else if (k > ll * sinA) d = pbLen2(q, u - ll) - r1;
          else d = q * sinA + u * cosA - r0;
          return d * Math.min(flat, depth, 1);
        };
        return { f, b: [(ax + b[0]) / 2, (ay + b[1]) / 2, (az + b[2]) / 2, len / 2 + Math.max(ra, rb) * Math.max(1, 1 / Math.min(flat, depth)) + 0.06] };
      }
      /* A capped box with rounded edges (half sizes hx, hy, hz, radius r) in a frame. */
      function pbRoundBox(cx, cy, cz, hx, hy, hz, r, frame = null) {
        const f = (x, y, z) => {
          let px = x - cx,
            py = y - cy,
            pz = z - cz;
          if (frame) {
            const qx = frame[0] * px + frame[1] * py + frame[2] * pz,
              qy = frame[3] * px + frame[4] * py + frame[5] * pz,
              qz = frame[6] * px + frame[7] * py + frame[8] * pz;
            px = qx;
            py = qy;
            pz = qz;
          }
          const qx = Math.abs(px) - hx + r,
            qy = Math.abs(py) - hy + r,
            qz = Math.abs(pz) - hz + r;
          return pbLen3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
        };
        return { f, b: [cx, cy, cz, Math.hypot(hx, hy, hz)] };
      }
      /* A plane's half space (inside below the plane through p with normal n). */
      function pbHalf(px, py, pz, nx, ny, nz, bound) {
        const l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nz /= l;
        return { f: (x, y, z) => (x - px) * nx + (y - py) * ny + (z - pz) * nz, b: bound };
      }
      /* A field's operations, and a single evaluation of all of them (for checks and tests). */
      function pbFieldAt(ops, x, y, z) {
        let d = 1e9;
        for (let i = 0; i < ops.length; i++) d = pbApply(ops[i], d, x, y, z);
        return d;
      }
      function pbApply(o, d, x, y, z) {
        const op = o.op;
        if (op === 'add') return pbSmin(d, o.f(x, y, z), o.k);
        if (op === 'group') return pbSmin(d, pbFieldAt(o.ops, x, y, z), o.k);
        if (op === 'sub') return pbSmax(d, -o.f(x, y, z), o.k);
        if (op === 'cut') return pbSmax(d, o.f(x, y, z), o.k);
        return o.g(x, y, z, d);
      }
      /* A group of operations combined into the running distance as one shape (its cuts cut only it). */
      const pbGroup = (ops, k = 0, b = null, layer = undefined) => ({ op: 'group', ops, k, b, layer });
      /**
       * The operations that can change the distance within `margin` of a point (a cell's centre), into `out`;
       * returns the distance there. A distance is taken to change by at most the margin across the cell.
       */
      function pbCompile(ops, px, py, pz, margin, out) {
        let d = 1e9;
        for (let o = 0; o < ops.length; o++) {
          const op = ops[o],
            b = op.b,
            k = op.k || 0;
          if (op.k === undefined) op.k = 0;
          if (b && op.op !== 'cut') {
            const far = Math.sqrt((px - b[0]) * (px - b[0]) + (py - b[1]) * (py - b[1]) + (pz - b[2]) * (pz - b[2])) - b[3];
            if (far > 2 * margin + k + Math.abs(d) + 0.01) continue;
          }
          if (op.op === 'mod') {
            out.push(op);
            d = op.g(px, py, pz, d);
          } else if (op.op === 'group') {
            const children = [],
              g = pbCompile(op.ops, px, py, pz, margin, children);
            if (g - margin < d + margin + k && children.length) out.push(children.length === op.ops.length ? op : { op: 'group', ops: children, k, b, layer: op.layer });
            d = pbSmin(d, g, k);
          } else {
            const v = op.f(px, py, pz);
            if (op.op === 'add') {
              if (v - margin < d + margin + k) out.push(op);
              d = pbSmin(d, v, k);
            } else if (op.op === 'sub') {
              if (v + d < k + 2 * margin) out.push(op);
              d = pbSmax(d, -v, k);
            } else {
              if (v + 2 * margin + k > d) out.push(op);
              d = pbSmax(d, v, k);
            }
          }
        }
        return d;
      }
      /**
       * SURFACE NETS
       * Sample the field on a grid of spacing h over `box` [x0, y0, z0, x1, y1, z1] (coarse cells of 4 x 4 x 4
       * fine cells decide which operations each point needs, and points far from the surface take the coarse
       * value), put one vertex in every cell the surface crosses (at the mean of its edge crossings), join the
       * vertices of the four cells round every crossed edge into a quad (split along its shorter diagonal),
       * then move each vertex onto the surface by Newton steps along the field's gradient, which is also its
       * normal. Returns { position, normal, index } (metres) and the per-vertex evaluator for later bakes.
       */
      /* Run a generator to its end at once (tests, tools). */
      function pbRun(steps) {
        let r = steps.next();
        while (!r.done) r = steps.next();
        return r.value;
      }
      // The build's slice deadline (performance.now()); the generators yield when it passes.
      const pbClock = { until: Infinity };
      const pbMesh = (ops, box, h) => pbRun(pbMeshSteps(ops, box, h));
      function* pbMeshSteps(ops, box, h) {
        const C = 4,
          nx = Math.ceil((box[3] - box[0]) / h) + 1,
          ny = Math.ceil((box[4] - box[1]) / h) + 1,
          nz = Math.ceil((box[5] - box[2]) / h) + 1,
          cx = Math.ceil((nx - 1) / C),
          cy = Math.ceil((ny - 1) / C),
          cz = Math.ceil((nz - 1) / C),
          cellR = (C * h * Math.sqrt(3)) / 2,
          lists = new Array(cx * cy * cz).fill(null),
          centreD = new Float32Array(cx * cy * cz),
          band = [],
          clock = [performance.now()];
        // Coarse cells: the operations that matter there (groups keep only their relevant children).
        for (let k = 0; k < cz; k++)
          for (let j = 0; j < cy; j++) {
            if (performance.now() > pbClock.until) yield;
            for (let i = 0; i < cx; i++) {
              const relevant = [],
                d = pbCompile(ops, box[0] + (i + 0.5) * C * h, box[1] + (j + 0.5) * C * h, box[2] + (k + 0.5) * C * h, cellR * 1.3, relevant),
                c = i + cx * (j + cy * k);
              centreD[c] = d;
              if (Math.abs(d) < cellR * 1.3 + 2 * h) {
                lists[c] = relevant;
                band.push(c);
              }
            }
          }
        clock.push(performance.now());
        // Points of the band's cells (each cell's corners included). A point further from the surface than
        // the centre's distance allows needs no evaluation (the distance changes by at most the step): it
        // keeps a bound with the right sign. Points of cells off the band read their cell's centre value.
        const values = new Float32Array(nx * ny * nz),
          done = new Uint8Array(nx * ny * nz),
          ownerD = (i, j, k) => centreD[Math.min(cx - 1, (i / C) | 0) + cx * (Math.min(cy - 1, (j / C) | 0) + cy * Math.min(cz - 1, (k / C) | 0))],
          value = (i, j, k) => {
            const o = i + nx * (j + ny * k);
            return done[o] ? values[o] : ownerD(i, j, k);
          };
        let evaluations = 0;
        for (let b = 0; b < band.length; b++) {
          if ((b & 15) === 0 && performance.now() > pbClock.until) yield;
          const c = band[b],
            ci = c % cx,
            cj = ((c / cx) | 0) % cy,
            ck = (c / (cx * cy)) | 0,
            list = lists[c],
            dc = centreD[c];
          for (let k = ck * C; k <= Math.min(nz - 1, ck * C + C); k++)
            for (let j = cj * C; j <= Math.min(ny - 1, cj * C + C); j++)
              for (let i = ci * C; i <= Math.min(nx - 1, ci * C + C); i++) {
                const o = i + nx * (j + ny * k);
                if (done[o]) continue;
                done[o] = 1;
                const ox = i - (ci + 0.5) * C,
                  oy = j - (cj + 0.5) * C,
                  oz = k - (ck + 0.5) * C,
                  reach = Math.sqrt(ox * ox + oy * oy + oz * oz) * h * 1.1 + 1.5 * h;
                if (Math.abs(dc) > reach) values[o] = dc > 0 ? dc - reach + 1.5 * h : dc + reach - 1.5 * h;
                else {
                  values[o] = pbFieldAt(list, box[0] + i * h, box[1] + j * h, box[2] + k * h);
                  evaluations++;
                }
              }
        }
        clock.push(performance.now());
        // One vertex per crossed cell (cells of the band only: the surface is nowhere else).
        const cellVertex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1),
          pos = [],
          vertexCoarse = [],
          corner = new Float32Array(8);
        for (let b = 0; b < band.length; b++) {
          if ((b & 31) === 0 && performance.now() > pbClock.until) yield;
          const c = band[b],
            ci = c % cx,
            cj = ((c / cx) | 0) % cy,
            ck = (c / (cx * cy)) | 0;
          for (let k = ck * C; k < Math.min(nz - 1, ck * C + C); k++)
            for (let j = cj * C; j < Math.min(ny - 1, cj * C + C); j++)
              for (let i = ci * C; i < Math.min(nx - 1, ci * C + C); i++) {
                let inside = 0;
                for (let q = 0; q < 8; q++) {
                  const v = value(i + (q & 1), j + ((q >> 1) & 1), k + ((q >> 2) & 1));
                  corner[q] = v;
                  if (v < 0) inside++;
                }
                if (inside === 0 || inside === 8) continue;
                let sx = 0,
                  sy = 0,
                  sz = 0,
                  n = 0;
                // The 12 edges: pairs of corners differing in one bit.
                for (let q = 0; q < 8; q++)
                  for (let bit = 1; bit < 8; bit <<= 1) {
                    if (q & bit) continue;
                    const a = corner[q],
                      e = corner[q | bit];
                    if (a < 0 === e < 0) continue;
                    const t = a / (a - e),
                      qb = q | bit;
                    sx += (q & 1) + ((qb & 1) - (q & 1)) * t;
                    sy += ((q >> 1) & 1) + (((qb >> 1) & 1) - ((q >> 1) & 1)) * t;
                    sz += ((q >> 2) & 1) + (((qb >> 2) & 1) - ((q >> 2) & 1)) * t;
                    n++;
                  }
                cellVertex[i + (nx - 1) * (j + (ny - 1) * k)] = pos.length / 3;
                pos.push(box[0] + (i + sx / n) * h, box[1] + (j + sy / n) * h, box[2] + (k + sz / n) * h);
                vertexCoarse.push(c);
              }
        }
        // Quads round every crossed edge (each edge in the cell its first point belongs to).
        const index = [],
          cv = (i, j, k) => (i < 0 || j < 0 || k < 0 ? -1 : cellVertex[i + (nx - 1) * (j + (ny - 1) * k)]),
          quad = (a, b, c, d, flip) => {
            if (a < 0 || b < 0 || c < 0 || d < 0) return;
            if (flip) {
              const t = b;
              b = d;
              d = t;
            }
            const p = pos,
              ax = p[a * 3] - p[c * 3],
              ay = p[a * 3 + 1] - p[c * 3 + 1],
              az = p[a * 3 + 2] - p[c * 3 + 2],
              bx = p[b * 3] - p[d * 3],
              by = p[b * 3 + 1] - p[d * 3 + 1],
              bz = p[b * 3 + 2] - p[d * 3 + 2];
            if (ax * ax + ay * ay + az * az <= bx * bx + by * by + bz * bz) index.push(a, b, c, a, c, d);
            else index.push(a, b, d, b, c, d);
          };
        for (let b = 0; b < band.length; b++) {
          if ((b & 31) === 0 && performance.now() > pbClock.until) yield;
          const c = band[b],
            ci = c % cx,
            cj = ((c / cx) | 0) % cy,
            ck = (c / (cx * cy)) | 0;
          for (let k = ck * C; k < Math.min(nz - 1, ck * C + C); k++)
            for (let j = cj * C; j < Math.min(ny - 1, cj * C + C); j++)
              for (let i = ci * C; i < Math.min(nx - 1, ci * C + C); i++) {
                const v0 = value(i, j, k),
                  inside = v0 < 0;
                if (inside !== value(i + 1, j, k) < 0) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !inside);
                if (inside !== value(i, j + 1, k) < 0) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !inside);
                if (inside !== value(i, j, k + 1) < 0) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !inside);
              }
        }
        clock.push(performance.now());
        // Onto the surface by one Newton step, the normal from the field's gradient (tetrahedral differences:
        // four evaluations give the value and the gradient).
        const count = pos.length / 3,
          position = new Float32Array(pos),
          normal = new Float32Array(count * 3),
          e = h * 0.2,
          vertexList = new Array(count);
        for (let v = 0; v < count; v++) {
          if ((v & 255) === 0 && performance.now() > pbClock.until) yield;
          const list = lists[vertexCoarse[v]] || ops;
          vertexList[v] = list;
          const x = position[v * 3],
            y = position[v * 3 + 1],
            z = position[v * 3 + 2],
            a = pbFieldAt(list, x + e, y - e, z - e),
            b = pbFieldAt(list, x - e, y - e, z + e),
            c = pbFieldAt(list, x - e, y + e, z - e),
            f = pbFieldAt(list, x + e, y + e, z + e),
            d = (a + b + c + f) * 0.25,
            gx = a - b - c + f,
            gy = -a - b + c + f,
            gz = -a + b - c + f,
            gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1,
            g = gl / (4 * e);
          // Never further than most of a cell: a surface net vertex belongs in its cell's neighbourhood.
          let step = g > 1e-4 ? d / g : 0;
          if (step > h * 0.75) step = h * 0.75;
          else if (step < -h * 0.75) step = -h * 0.75;
          position[v * 3] = x - (step * gx) / gl;
          position[v * 3 + 1] = y - (step * gy) / gl;
          position[v * 3 + 2] = z - (step * gz) / gl;
          normal[v * 3] = gx / gl;
          normal[v * 3 + 1] = gy / gl;
          normal[v * 3 + 2] = gz / gl;
        }
        clock.push(performance.now());
        const ms = clock.slice(1).map((t, i) => Math.round(t - clock[i]));
        return { position, normal, index: new Uint32Array(index), lists: vertexList, evalList: pbFieldAt, evaluations, ms };
      }
      /**
       * AMBIENT OCCLUSION baked from the field: how far the surface nearby closes in over a few steps along
       * the normal (1 open, towards 0 in creases: under the jaw, the armpits, between the fingers).
       */
      const pbBakeOcclusion = (mesh, reach) => pbRun(pbOcclusionSteps(mesh, reach));
      function* pbOcclusionSteps(mesh, reach) {
        const { position: p, normal: n, lists, evalList } = mesh,
          count = p.length / 3,
          ao = new Float32Array(count);
        for (let v = 0; v < count; v++) {
          if ((v & 255) === 0 && performance.now() > pbClock.until) yield;
          let occ = 0,
            wsum = 0;
          for (let s = 1; s <= 4; s++) {
            const d = (reach * s) / 4,
              f = evalList(lists[v], p[v * 3] + n[v * 3] * d, p[v * 3 + 1] + n[v * 3 + 1] * d, p[v * 3 + 2] + n[v * 3 + 2] * d),
              w = 1 / s;
            occ += w * Math.max(0, Math.min(1, (d - f) / d));
            wsum += w;
          }
          ao[v] = 1 - Math.min(1, (occ / wsum) * 1.6);
        }
        return ao;
      }
