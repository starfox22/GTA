      // ---- THE KIT: a body's merged parts for one size -----------------------------------
      /*
       * civKit(body, l, w) builds everything a body shares between cars: shell,
       * glasshouse, hood, bumpers, the paint / trim / drl sets, the four lamps,
       * the rims and tyres, halo anchors, wheel places. Bodies describe their own
       * details through `details(k)` with the surface-conforming helpers below
       * (k.surf, k.patch, k.strip, k.grille, k.round...), so a grille, an intake
       * or a light bar follows the nose it sits on.
       */
      const civKits = new Map();
      function civKit(body, l, w) {
        const key = body.name + ':' + l.toFixed(2) + ':' + w.toFixed(2);
        if (civKits.has(key)) return civKits.get(key);
        const M = CAR_M,
          S = civShapeKit(),
          g = body.glass,
          sets = { paint: civSet(), trim: civSet(), drl: civSet(), headLeft: civSet(), headRight: civSet(), tailLeft: civSet(), tailRight: civSet() },
          at = (x, y) => civShellAt(body, l, w, x, y),
          top = (x) => civProfileAt(body, x / l)[1],
          ringV = policeRingV(body, w),
          ringTotal = (() => {
            const ring = civRing(body.section),
              topRef = body.uvTop || body.h;
            let total = 0;
            for (let j = 1; j < ring.length; j++)
              total += Math.hypot((ring[j][0] - ring[j - 1][0]) * (topRef - body.yb), ((ring[j][1] - ring[j - 1][1]) * w) / 2);
            return total;
          })(),
          vMid = ringV[(ringV.length - 1) / 2];
        // The frontmost / rearmost x of the surface at lateral z and height y.
        function frontX(z, y) {
          const target = Math.abs(z);
          let previous = 0.5;
          for (let t = 0.5; t > -0.05; t -= 0.002) {
            if (at(t * l, y).half >= target) {
              if (t === 0.5) return t * l;
              const a = at(previous * l, y).half,
                b = at(t * l, y).half;
              return lerpNumber(previous, t, clamp((target - a) / Math.max(1e-6, b - a), 0, 1)) * l;
            }
            previous = t;
          }
          return 0;
        }
        function rearX(z, y) {
          const target = Math.abs(z);
          let previous = -0.5;
          for (let t = -0.5; t < 0.05; t += 0.002) {
            if (at(t * l, y).half >= target) {
              if (t === -0.5) return t * l;
              const a = at(previous * l, y).half,
                b = at(t * l, y).half;
              return lerpNumber(previous, t, clamp((target - a) / Math.max(1e-6, b - a), 0, 1)) * l;
            }
            previous = t;
          }
          return 0;
        }
        // The surface's height at (x, z) seen from above.
        // The upper surface's height at (x, z) from the section itself, so a wing
        // standing above the bonnet's centre and the dip between them both count.
        function topY(x, z) {
          const [wf, tp, bt] = civProfileAt(body, x / l),
            sec = civSectionAt(body, x / l),
            zf = Math.abs(z) / Math.max(1e-6, (wf * w) / 2);
          let pk = 0;
          for (let i = 0; i < sec.length; i++) if (sec[i][0] > sec[pk][0] + 1e-6) pk = i;
          const at2 = (n) => bt + n * (tp - bt);
          if (zf <= sec[pk][1]) {
            for (let i = pk; i < sec.length - 1; i++) {
              const [n0, z0] = sec[i],
                [n1, z1] = sec[i + 1];
              if (zf <= z0 && zf >= z1) return at2(lerpNumber(n0, n1, (z0 - zf) / Math.max(1e-6, z0 - z1)));
            }
            return tp;
          }
          for (let i = pk; i > 0; i--) {
            const [n0, z0] = sec[i],
              [n1, z1] = sec[i - 1];
            if (zf >= z0 && zf <= z1) return at2(lerpNumber(n0, n1, (zf - z0) / Math.max(1e-6, z1 - z0)));
          }
          return bt;
        }
        // A point on the surface, `lift` out along the frame's outward direction.
        function surf(frame, u, v, lift = 0, side = 1) {
          if (frame === 'front') return [frontX(u, v) + lift, v, u];
          if (frame === 'rear') return [rearX(u, v) - lift, v, u];
          if (frame === 'top') return [u, topY(u, v) + lift, v];
          return [u, v, side * (at(u, v).half + lift)];
        }
        const insideOf = (frame, side) => (p, out) =>
          frame === 'front' ? out.set(p.x - 6, p.y, p.z) : frame === 'rear' ? out.set(p.x + 6, p.y, p.z) : frame === 'top' ? out.set(p.x, p.y - 6, p.z) : out.set(p.x, p.y, p.z - side * 6);
        // The livery's top projection: hood, roof panel and deck stripes line up.
        const topUv = (x, y, z) => [clamp(x / l + 0.5, 0.001, 0.999), clamp(vMid + (z / ringTotal) * (1 - POLICE_SWATCH_BAND), POLICE_SWATCH_BAND + 0.001, 0.999)];
        /*
         * A patch of the surface: u0..u1, v0..v1 in the frame's coordinates (front,
         * rear: z and y; top: x and z; side: x and y). With an atlas `cell` it is
         * cut into tiles about `tile` across, each showing the whole cell.
         */
        function patch(set, frame, u0, u1, v0, v1, options = {}) {
          const lift = options.lift ?? 0.012 * M,
            side = options.side || 1;
          if (options.cell && options.cell !== 'solid') {
            const tile = options.tile || 0.22 * M,
              cols = Math.max(1, Math.round(Math.abs(u1 - u0) / tile)),
              rows = Math.max(1, Math.round(Math.abs(v1 - v0) / tile)),
              position = [],
              uv = [],
              index = [];
            for (let j = 0; j < rows; j++)
              for (let i = 0; i < cols; i++) {
                const base = position.length / 3;
                for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
                  position.push(...surf(frame, lerpNumber(u0, u1, (i + a) / cols), lerpNumber(v0, v1, (j + b) / rows), lift, side));
                  uv.push(a, b);
                }
                index.push(base, base + 1, base + 2, base, base + 2, base + 3);
              }
            orientOutward(position, index, insideOf(frame, side));
            const geo = new Three.BufferGeometry();
            geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
            geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
            geo.setIndex(index);
            geo.computeVertexNormals();
            civAddMatrix(set, geo, civIdentity, options);
            geo.dispose();
            return;
          }
          // `span(u)` -> [v0, v1] shapes the patch (a swept lamp, a tapering intake).
          const span = options.span,
            geo = gridGeometry(options.cols || 6, options.rows || 3, (u, v) => {
              const uu = lerpNumber(u0, u1, u),
                [a, b] = span ? span(uu) : [v0, v1];
              return surf(frame, uu, lerpNumber(a, b, v), lift, side);
            }, insideOf(frame, side));
          civAddMatrix(set, geo, civIdentity, options);
          geo.dispose();
        }
        // A rounded bar following points on a frame (DRL strips, light bars, trim lines).
        function strip(set, frame, points, height, depth, options = {}, side = 1) {
          const lift = options.lift ?? depth * 0.35,
            p = points.map(([u, v]) => surf(frame, u, v, lift, side));
          for (let i = 0; i < p.length - 1; i++) civBar(set, p[i], p[i + 1], height, depth, Math.min(height, depth) * 0.45, options, options.up || [0, 1, 0]);
        }
        // Normal of the surface at a frame point (finite differences).
        function normalAt(frame, u, v, side = 1) {
          const e = 0.05 * M,
            p = new Three.Vector3(...surf(frame, u, v, 0, side)),
            du = new Three.Vector3(...surf(frame, u + e, v, 0, side)).sub(p),
            dv = new Three.Vector3(...surf(frame, u, v + e, 0, side)).sub(p),
            n = du.cross(dv).normalize(),
            out = frame === 'front' ? [1, 0, 0] : frame === 'rear' ? [-1, 0, 0] : frame === 'top' ? [0, 1, 0] : [0, 0, side];
          if (n.x * out[0] + n.y * out[1] + n.z * out[2] < 0) n.negate();
          return [n.x, n.y, n.z];
        }
        // A round element (lamp, ring, badge) sitting on the surface, facing out.
        function round(set, geo, frame, u, v, r, thickness, options = {}, side = 1) {
          const n = normalAt(frame, u, v, side),
            lift = options.lift ?? thickness / 2,
            p = surf(frame, u, v, 0, side);
          civDisc(set, geo, p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift, r, thickness, n, options, options.spin || 0);
          return [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift];
        }
        // A grille: a patch in an atlas pattern with an optional bright or dark surround.
        function grille(frame, z0, z1, y0, y1, options = {}) {
          patch(sets.trim, frame, z0, z1, y0, y1, { cell: options.cell || 'honeycomb', color: options.color || '#2a2c30', finish: options.finish || 'gloss', tile: options.tile, lift: options.lift ?? 0.008 * M });
          if (options.frame) {
            const t = options.frameWidth || 0.025 * M,
              opts = { color: options.frame, finish: options.frameFinish || 'chrome', lift: options.lift ?? 0.012 * M };
            const edge = (a, b, fixed, along) => {
              const pts = [];
              for (let i = 0; i <= 6; i++) pts.push(along ? [lerpNumber(a, b, i / 6), fixed] : [fixed, lerpNumber(a, b, i / 6)]);
              strip(sets.trim, frame, pts, t, t * 1.2, opts);
            };
            edge(z0, z1, y1, true);
            edge(z0, z1, y0, true);
            edge(y0, y1, z0, false);
            edge(y0, y1, z1, false);
          }
        }
        // The highest point of the section at x (a wing can stand above the bonnet's centre).
        function peak(x) {
          const [, t, b] = civProfileAt(body, x / l);
          let most = 1;
          for (const [nh] of civSectionAt(body, x / l)) most = Math.max(most, nh);
          return b + most * (t - b);
        }
        const k = {
          body,
          l,
          w,
          peak,
          M,
          S,
          g,
          sets,
          at,
          top,
          frontX,
          rearX,
          topY,
          surf,
          patch,
          strip,
          normalAt,
          round,
          grille,
          topUv,
          add: civAdd,
          beam: civBeam,
          bar: civBar,
          disc: civDisc,
          sw: (name) => ({ uv: swatchUv(CAR_SWATCH[name]) }),
          head: (side) => (side < 0 ? sets.headLeft : sets.headRight),
          tail: (side) => (side < 0 ? sets.tailLeft : sets.tailRight),
          halos: { headLeft: null, headRight: null, tailLeft: null, tailRight: null },
          halo(kind, side, p, size) {
            this.halos[kind + (side < 0 ? 'Left' : 'Right')] = { x: p[0], y: p[1], z: p[2], size };
          },
          wheels: [],
        };
        // ---- Wheels: places, arches, rims, calipers ----
        const wd = body.wheel;
        for (const [fx, r, width, track] of [[wd.xf, wd.r, wd.width, wd.zf], [wd.xr, wd.rr || wd.r, wd.wr || wd.width, wd.zr]]) {
          const x = fx * l,
            half = at(x, r).half,
            // `zf` / `zr`: an axle's own half track in metres (the rod's front wheels stand clear of its nose).
            z = track !== undefined ? track * M : half + (wd.proud ?? 0.03 * M) - width / 2;
          k.wheels.push({ x, r, width, z, front: fx > 0 });
          if (fx > 0 && wd.exposedFront) continue;
          // The arch never rises through a low bonnet: its radius stops under the top.
          const archR = Math.min(r * 1.12, peak(x) - r * 0.96 - 0.035 * M, peak(x - r) - r * 0.96 - 0.02 * M, peak(x + r) - r * 0.96 - 0.02 * M) / 1.14;
          const archRadius = Math.max(r * 0.93, archR);
          for (const side of [-1, 1]) {
            // A dark wheel well behind the tyre, a lip over it.
            civAdd(sets.trim, S.halfDisc, x, r * 0.96, side * (half + 0.004 * M), archRadius * 1.14, archRadius * 1.14, 1, { color: '#050506', finish: 'matte' }, 0, side < 0 ? Math.PI : 0, 0);
            const lip = gridGeometry(16, 1, (u, v) => {
              const a = lerpNumber(0.04, Math.PI - 0.04, u),
                R = archRadius * (1.13 + 0.03 * v),
                px = x + Math.cos(a) * R,
                py = r * 0.96 + Math.sin(a) * R,
                h = at(px, py).half;
              return [px, py - v * 0.012 * M, side * (h + lerpNumber(-0.01, wd.lip ?? 0.035, v) * M)];
            }, (p, out) => out.set(x, r, p.z - side * 3));
            civAddMatrix(body.flares ? sets.trim : sets.paint, lip, civIdentity, body.flares ? { color: body.flares, finish: 'plastic' } : k.sw('paint'));
            lip.dispose();
            if (body.flares) {
              // Black wheel-arch mouldings (SUVs, rally, pickups).
              const flare = gridGeometry(16, 1, (u, v) => {
                const a = lerpNumber(-0.05, Math.PI + 0.05, u),
                  R = archRadius * lerpNumber(1.14, 1.3, v),
                  px = x + Math.cos(a) * R,
                  py = Math.max(r * 0.7, r * 0.96 + Math.sin(a) * R),
                  h = at(px, py).half;
                return [px, py, side * (h + 0.02 * M * (1 - v) + 0.005 * M)];
              }, (p, out) => out.set(x, r, p.z - side * 3));
              civAddMatrix(sets.trim, flare, civIdentity, { color: body.flares, finish: 'plastic' });
              flare.dispose();
            }
            // Brake caliper at the top rear of the disc (fixed to the body).
            if (wd.caliper) {
              const cz = side * (z + width * 0.5 - width * 0.34);
              civBar(sets.trim, [x - r * 0.42, r * 1.34, cz], [x - r * 0.18, r * 1.5, cz], r * 0.22, width * 0.16, 0.03 * M, { color: wd.caliper, finish: 'gloss' }, [0, 0, 1]);
            }
          }
        }
        // ---- Glasshouse furniture: roof panel, pillars, waist line, frames, mirrors ----
        if (g && !g.open) {
          if (!g.glassRoof) {
            const roofPoint = (s, t, lift = 0.018 * M) => [lerpNumber(g.rb * l - 0.03 * M, g.rf * l + 0.03 * M, t), g.roof + lift + g.arch * (1 - s * s), s * g.wt * w * 1.035];
            const roofGeo = gridGeometry(8, 6, (u, v) => roofPoint(u * 2 - 1, v), (p, out) => out.set(p.x, p.y - 5, 0));
            civAddMatrix(sets.paint, roofGeo, civIdentity, body.roofSwatch ? k.sw(body.roofSwatch) : { uvOf: topUv });
            roofGeo.dispose();
            for (const side of [-1, 1]) {
              const skirt = gridGeometry(8, 1, (u, v) => {
                const p = roofPoint(side, u, 0.018 * M - (1 - v) * 0.05 * M);
                return [p[0], p[1], p[2] + side * 0.003 * M];
              }, (p, out) => out.set(p.x, p.y, 0));
              civAddMatrix(sets.paint, skirt, civIdentity, k.sw(body.roofSwatch || 'paint'));
              skirt.dispose();
            }
          } else
            for (const side of [-1, 1])
              civBeam(sets.trim, S.box, glassPoint(g, l, w, 'roof', side * 0.99, 0), glassPoint(g, l, w, 'roof', side * 0.99, 1), 0.02 * M, 0.06 * M, { color: '#0e0f11', finish: 'gloss' });
          const pillarPoint = (s, t, side, out) => {
            const p = glassPoint(g, l, w, 'side', s, t, side);
            return [p[0], p[1], p[2] + side * out];
          };
          for (const side of [-1, 1]) {
            const up = [0, 0, side],
              from = g.sideFrom || 0;
            for (const [s, width, kind] of [[1, g.aWidth ?? 0.075 * M, g.aPillar || 'paint'], ...(g.pillars || [])]) {
              const paintKind = kind === 'paint' || kind === 'roof',
                options = paintKind ? k.sw(kind === 'roof' ? body.roofSwatch || 'paint' : 'paint') : { color: kind === 'chrome' ? '#dfe3e6' : '#0c0d0f', finish: kind === 'chrome' ? 'chrome' : 'gloss' },
                shift = s === 1 ? -width * 0.35 : s <= from ? width * 0.45 : 0,
                points = [0, 0.5, 1].map((t) => {
                  const p = pillarPoint(Math.max(s, from), t, side, s === 1 ? 0.022 * M : 0.014 * M);
                  return [p[0] + shift, p[1], p[2]];
                });
              for (let q = 0; q < 2; q++) civBeam(paintKind ? sets.paint : sets.trim, S.box, points[q], points[q + 1], 0.035 * M, width, options, up);
            }
            // Behind a short side glass: the buttress or intake panel in paint.
            if (from > 0.02) {
              const panel = gridGeometry(4, 2, (u, v) => {
                const p = glassPoint(g, l, w, 'side', lerpNumber(0, from, u), v, side);
                return [p[0], p[1], p[2] + side * 0.01 * M];
              }, (p, out) => out.set(p.x, p.y, 0));
              civAddMatrix(sets.paint, panel, civIdentity, k.sw(g.buttress || 'paint'));
              panel.dispose();
            }
            // Waist line along the foot of the glass, and the window frame over it.
            const frame = g.frame === 'chrome' ? { color: '#e2e6e9', finish: 'chrome' } : { color: '#0d0e10', finish: 'gloss' };
            civBeam(sets.trim, S.box, pillarPoint(from, 0.02, side, 0.016 * M), pillarPoint(1, 0.02, side, 0.016 * M), 0.035 * M, 0.03 * M, frame, [0, 1, 0]);
            if (g.frame)
              for (let q = 0; q < 6; q++)
                civBeam(sets.trim, S.box, pillarPoint(lerpNumber(from, 1, q / 6), 0.985, side, 0.014 * M), pillarPoint(lerpNumber(from, 1, (q + 1) / 6), 0.985, side, 0.014 * M), 0.025 * M, 0.02 * M, frame, [0, 0, side]);
            // Mirrors: a body-colour cap on a black arm at the door top.
            if (body.mirrors !== false) {
              const base = glassPoint(g, l, w, 'side', 0.97, 0.12, side),
                mx = base[0] - 0.14 * M,
                my = base[1] + 0.04 * M,
                mz = side * (Math.abs(base[2]) + 0.17 * M);
              civBar(sets.paint, [mx + 0.08 * M, my, mz], [mx - 0.06 * M, my, mz], 0.13 * M, 0.2 * M, 0.05 * M, k.sw(body.mirrorSwatch || 'paint'), [0, 1, 0]);
              civBeam(sets.trim, S.box, [mx + 0.06 * M, my - 0.03 * M, base[2]], [mx + 0.04 * M, my - 0.02 * M, mz - side * 0.06 * M], 0.04 * M, 0.06 * M, { color: '#0c0d0f', finish: 'satin' });
              civAdd(sets.trim, S.box, mx - 0.075 * M, my, mz, 0.01 * M, 0.1 * M, 0.17 * M, { color: '#3d4852', finish: 'lens' });
              if (body.mirrorRepeater !== false) civAdd(sets.drl, S.box, mx + 0.02 * M, my - 0.05 * M, mz + side * 0.07 * M, 0.08 * M, 0.012 * M, 0.02 * M, { color: '#ffae3a' });
            }
          }
          // Cowl under the windscreen.
          civBeam(sets.trim, S.box, glassPoint(g, l, w, 'front', -0.98, 0), glassPoint(g, l, w, 'front', 0.98, 0), 0.03 * M, 0.1 * M, { color: '#0e0f11', finish: 'plastic' }, [1, 1, 0]);
        }
        // ---- Doors: handles; the shut lines are in the livery ----
        for (const hx of body.handles || []) {
          const y = (body.handleY ?? body.h / M - 0.12) * M;
          for (const side of [-1, 1]) {
            const p = surf('side', hx * l, y, 0.006 * M, side),
              flush = body.handleStyle === 'flush';
            civBar(flush ? sets.trim : body.handleStyle === 'chrome' ? sets.trim : sets.paint, [p[0] - 0.1 * M, p[1], p[2]], [p[0] + 0.1 * M, p[1], p[2]], 0.035 * M, flush ? 0.012 * M : 0.03 * M, 0.012 * M, body.handleStyle === 'chrome' ? { color: '#e2e6e9', finish: 'chrome' } : flush ? { color: '#0d0e10', finish: 'gloss' } : k.sw('paint'));
          }
        }
        // Sills between the arches.
        if (body.sill) {
          const [front, rear] = k.wheels,
            y = body.yb + (body.sillHeight ?? 0.07) * M;
          for (const side of [-1, 1]) patch(sets.trim, 'side', rear.x + rear.r * 1.25, front.x - front.r * 1.25, body.yb + 0.01 * M, y, { side, color: body.sill, finish: 'plastic', lift: 0.006 * M, cols: 6, rows: 1 });
        }
        // Licence plates.
        if (body.plates !== false) {
          const rearY = (body.plateRear ?? 0.5) * M,
            frontY = (body.plateFront ?? 0.34) * M;
          patch(sets.trim, 'rear', -0.26 * M, 0.26 * M, rearY - 0.06 * M, rearY + 0.06 * M, { cell: 'plate', tile: 0.52 * M, color: '#ffffff', finish: 'satin', lift: 0.014 * M });
          if (body.frontPlate !== false) patch(sets.trim, 'front', -0.26 * M, 0.26 * M, frontY - 0.06 * M, frontY + 0.06 * M, { cell: 'plate', tile: 0.52 * M, color: '#ffffff', finish: 'satin', lift: 0.014 * M });
        }
        // ---- The body's own details ----
        body.details(k);
        // ---- Hood: a panel on the shell top from the hinge to the nose ----
        const hoodFrom = Math.max(0.215 * l, (g ? g.xf * l : 0) + (body.hoodGap ?? 0.12) * M),
          hoodTo = (0.5 - (body.hoodNose ?? 0.05)) * l,
          hoodBaseY = top(0.215 * l),
          hoodSet = civSet(),
          hoodHalf = (x) => at(x, top(x) - 0.004 * M).half * (body.hoodWidth ?? 0.93),
          hoodPoint = (u, v, lift) => {
            const x = lerpNumber(hoodFrom, hoodTo, u),
              z = v * hoodHalf(x);
            return [x, topY(x, z) + lift, z];
          };
        const hoodTop = gridGeometry(10, 8, (u, v) => hoodPoint(u, v * 2 - 1, 0.014 * M), (p, out) => out.set(p.x, p.y - 4, 0)),
          hoodUnder = gridGeometry(6, 4, (u, v) => hoodPoint(u, v * 2 - 1, -0.008 * M), (p, out) => out.set(p.x, p.y + 4, 0));
        civAddMatrix(hoodSet, hoodTop, civIdentity, { uvOf: topUv });
        civAddMatrix(hoodSet, hoodUnder, civIdentity, k.sw('dark'));
        for (const side of [-1, 1]) {
          const edge = gridGeometry(10, 1, (u, v) => hoodPoint(u, side, lerpNumber(-0.008, 0.014, v) * M), (p, out) => out.set(p.x, p.y, 0));
          civAddMatrix(hoodSet, edge, civIdentity, k.sw('paint'));
          edge.dispose();
        }
        hoodTop.dispose();
        hoodUnder.dispose();
        // Into the damage model's frame: unit length along x about 0.34 l, y from the hinge.
        for (let i = 0; i < hoodSet.position.length; i += 3) {
          hoodSet.position[i] = (hoodSet.position[i] - 0.34 * l) / (0.25 * l);
          hoodSet.position[i + 1] -= hoodBaseY;
        }
        for (let i = 0; i < hoodSet.normal.length; i += 3) {
          // Undo the x stretch in the normals (the mesh is scaled by 0.25 l again).
          hoodSet.normal[i] *= 0.25 * l;
          const n = Math.hypot(hoodSet.normal[i], hoodSet.normal[i + 1], hoodSet.normal[i + 2]) || 1;
          hoodSet.normal[i] /= n;
          hoodSet.normal[i + 1] /= n;
          hoodSet.normal[i + 2] /= n;
        }
        // ---- Bumpers (the damage model's two loose parts), normalised to a unit box ----
        const bumperGeometry = (front) => {
          const spec = body.bumpers?.[front ? 0 : 1] || {},
            y = (spec.y ?? (front ? 0.3 : 0.34)) * M,
            height = (spec.h ?? 0.14) * M,
            span = (spec.span ?? 0.86) * at(front ? 0.44 * l : -0.44 * l, y).half,
            set = civSet(),
            pts = [];
          for (let i = 0; i <= 6; i++) {
            const z = lerpNumber(-span, span, i / 6);
            pts.push([z, y]);
          }
          strip(set, front ? 'front' : 'rear', pts, height, (spec.d ?? 0.08) * M, { lift: (spec.lift ?? 0.02) * M, box: true, uv: swatchUv(CAR_SWATCH.paint) });
          const geo = civGeometry(set, { colors: false, finish: false });
          geo.computeBoundingBox();
          const box3 = geo.boundingBox,
            centre = new Three.Vector3(),
            size = new Three.Vector3();
          box3.getCenter(centre);
          box3.getSize(size);
          geo.translate(-centre.x, -centre.y, -centre.z);
          geo.scale(1 / size.x, 1 / size.y, 1 / size.z);
          geo.computeVertexNormals();
          geo.computeBoundingSphere();
          return { geo, centre: centre.clone(), size: size.clone(), material: spec.material || 'paint' };
        };
        const kit = {
          shell: civShellGeometry(body, l, w),
          cabin: g ? civCabinGeometry(body, l, w) : null,
          hood: civGeometry(hoodSet, { colors: false, finish: false }),
          hoodBaseY,
          paint: civGeometry(sets.paint, { colors: false, finish: false }),
          trim: civGeometry(sets.trim),
          drl: sets.drl.count ? civGeometry(sets.drl, { finish: false }) : null,
          lamps: {},
          halos: k.halos,
          bumpers: [bumperGeometry(true), bumperGeometry(false)],
          wheels: k.wheels,
          rims: k.wheels.map((wh) => [-1, 1].map((side) => civRimGeometry(body.rim, side, wh.r, wh.width))),
          tyre: civTyreGeometry(body.tyre || 'road', body.rim.frac ? body.rim.frac * 0.98 : 0.68),
          door: policeSwatchBox(CAR_SWATCH.paint),
          trunk: policeSwatchBox(CAR_SWATCH.paint),
        };
        for (const name of ['headLeft', 'headRight', 'tailLeft', 'tailRight'])
          kit.lamps[name] = sets[name].count ? civGeometry(sets[name], { finish: false }) : null;
        civKits.set(key, kit);
        return kit;
      }
