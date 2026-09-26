      // Skyline 3D kit: seeded random, panels, glazing and LED materials, plan helpers.
      const SKY_PANEL = 8,
        SKY_FLOOR = STOREY,
        SKY_TILE_U = SKY_PANEL * 4,
        SKY_TILE_V = SKY_FLOOR * 4;
      // A private seeded random so the cluster does not shift the rest of the city's dressing.
      let skySeed = 1;
      const skyRandom = () => {
        skySeed = (skySeed * 1664525 + 1013904223) >>> 0;
        return skySeed / 4294967296;
      };
      function skyCanvasTexture(width, height, paint) {
        const cv = document.createElement('canvas');
        cv.width = width;
        cv.height = height;
        paint(cv.getContext('2d'), width, height);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      /**
       * GLAZING
       * `glass`: vision-glass gradient (top, bottom); `mullion`: frame colour and
       * width in pixels; `spandrel`: the opaque band at each floor slab (colour and
       * fraction of the floor); `pattern`: 'grid', 'fins' (deep vertical frames),
       * 'bands' (bold horizontal spandrels), 'checker' (alternating panel tints),
       * 'stripe' (every other column darker); `lit`: share of floors lit at night;
       * `warm`: share of warm (vs cool white) office light.
       */
      const SKY_GLAZING = {
        federation: { glass: ['#a9c3d6', '#56728c'], mullion: ['#e4eaee', 2], spandrel: ['#7d93a6', 0.16], pattern: 'grid', lit: 0.62, warm: 0.4 },
        mercury: { glass: ['#e0a466', '#7a4522'], mullion: ['#4a2e1a', 4], spandrel: ['#9a6536', 0.2], pattern: 'fins', lit: 0.55, warm: 0.85 },
        capitalsDark: { glass: ['#8098ae', '#344658'], mullion: ['#c2ccd4', 2], spandrel: ['#56687a', 0.2], pattern: 'grid', lit: 0.6, warm: 0.5 },
        capitalsLight: { glass: ['#d4dadf', '#8a969f'], mullion: ['#f2f4f5', 3], spandrel: ['#b3bcc3', 0.24], pattern: 'grid', lit: 0.55, warm: 0.5 },
        evolution: { glass: ['#8eb1c9', '#3f5c75'], mullion: ['#dfe7ec', 2], spandrel: ['#eef2f4', 0.26], pattern: 'bands', lit: 0.6, warm: 0.35 },
        embankment: { glass: ['#79bccb', '#2b6474'], mullion: ['#d6e6ea', 2], spandrel: ['#4e8a98', 0.14], pattern: 'grid', lit: 0.6, warm: 0.45 },
        embankmentLow: { glass: ['#8cc6c9', '#3d7479'], mullion: ['#d6e6ea', 2], spandrel: ['#e8eeee', 0.22], pattern: 'bands', lit: 0.55, warm: 0.6 },
        sail: { glass: ['#b6d0e2', '#62839e'], mullion: ['#f0f4f6', 3], spandrel: ['#90a8ba', 0.12], pattern: 'stripe', lit: 0.58, warm: 0.4 },
        neva: { glass: ['#6d7985', '#252c33'], mullion: ['#b9c2ca', 3], spandrel: ['#3a434c', 0.14], pattern: 'fins', lit: 0.66, warm: 0.3 },
        oko: { glass: ['#46586a', '#1b242d'], mullion: ['#9aa6b0', 2], spandrel: ['#eceff0', 0.32], pattern: 'bands', lit: 0.6, warm: 0.45 },
        needle: { glass: ['#c4d4df', '#7890a4'], mullion: ['#eef2f4', 2], spandrel: ['#a6b6c2', 0.1], pattern: 'checker', lit: 0.5, warm: 0.5 },
        crown: { glass: ['#d2dcd6', '#7a948d'], mullion: ['#eadfc4', 2], spandrel: ['#a59a80', 0.18], pattern: 'grid', lit: 0.58, warm: 0.75 },
        rotunda: { glass: ['#cfc0a0', '#7f6e50'], mullion: ['#f3ead6', 3], spandrel: ['#a8977a', 0.2], pattern: 'fins', lit: 0.5, warm: 0.9 },
        meridian: { glass: ['#9dbbd2', '#4b6b88'], mullion: ['#eef2f5', 2], spandrel: ['#dfe6ea', 0.2], pattern: 'bands', lit: 0.55, warm: 0.4 },
        terraces: { glass: ['#a9bcc4', '#5f727a'], mullion: ['#e7e2d6', 3], spandrel: ['#cfc6b3', 0.3], pattern: 'grid', lit: 0.5, warm: 0.8 },
        diagrid: { glass: ['#6f90aa', '#2c465c'], mullion: ['#cfd8de', 2], spandrel: ['#3e5467', 0.16], pattern: 'checker', lit: 0.6, warm: 0.4 },
      };
      function glazingMap(spec) {
        return skyCanvasTexture(256, 256, (g, s) => {
          const cell = s / 4,
            spandrel = Math.round(cell * spec.spandrel[1]);
          for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++) {
              const x = c * cell,
                y = r * cell,
                grad = g.createLinearGradient(0, y + spandrel, 0, y + cell),
                shade = 0.9 + skyRandom() * 0.2 - (spec.pattern === 'stripe' && c % 2 ? 0.14 : 0) - (spec.pattern === 'checker' && (r + c) % 2 ? 0.12 : 0);
              grad.addColorStop(0, spec.glass[0]);
              grad.addColorStop(1, spec.glass[1]);
              g.fillStyle = grad;
              g.globalAlpha = 1;
              g.fillRect(x, y + spandrel, cell, cell - spandrel);
              // Panel-to-panel variation: glass never reflects quite evenly.
              g.fillStyle = shade > 1 ? '#ffffff' : '#000000';
              g.globalAlpha = Math.abs(shade - 1);
              g.fillRect(x, y + spandrel, cell, cell - spandrel);
              g.globalAlpha = 1;
              g.fillStyle = spec.spandrel[0];
              g.fillRect(x, y, cell, spandrel);
              // A sky highlight across the top of each pane.
              g.fillStyle = 'rgba(255,255,255,0.10)';
              g.fillRect(x, y + spandrel, cell, 3);
            }
          const [mc, mw] = spec.mullion;
          g.fillStyle = mc;
          for (let c = 0; c <= 4; c++) g.fillRect(c * cell - mw / 2, 0, mw, s);
          if (spec.pattern === 'fins') {
            // Deep frames: a lit edge and a shadowed edge on every mullion.
            g.fillStyle = 'rgba(0,0,0,0.35)';
            for (let c = 0; c <= 4; c++) g.fillRect(c * cell + mw / 2, 0, 3, s);
            g.fillStyle = 'rgba(255,255,255,0.25)';
            for (let c = 0; c <= 4; c++) g.fillRect(c * cell - mw / 2 - 1, 0, 1, s);
          }
          g.fillStyle = mc;
          for (let r = 0; r <= 4; r++) {
            g.fillRect(0, r * cell - 1, s, 2);
            g.fillRect(0, r * cell + spandrel - 1, s, 2);
          }
          if (spec.pattern === 'bands') {
            g.fillStyle = 'rgba(0,0,0,0.25)';
            for (let r = 0; r < 4; r++) g.fillRect(0, r * cell + spandrel, s, 2);
          }
        });
      }
      // Lit offices at night: eight panels by sixteen floors, so the pattern repeats rarely.
      function glazingLit(spec) {
        return skyCanvasTexture(256, 512, (g, w, h) => {
          g.fillStyle = '#000';
          g.fillRect(0, 0, w, h);
          const cw = w / 8,
            ch = h / 16,
            spandrel = Math.round(ch * spec.spandrel[1]);
          for (let r = 0; r < 16; r++) {
            const floor = skyRandom(),
              // Offices at night: some floors on, most dark, a few with one desk lit.
              lit = floor < spec.lit * 0.55,
              warm = skyRandom() < spec.warm,
              share = lit ? 0.45 + skyRandom() * 0.5 : skyRandom() * 0.08;
            for (let c = 0; c < 8; c++) {
              if (skyRandom() > share) continue;
              const x = c * cw,
                y = r * ch + spandrel,
                grad = g.createLinearGradient(0, y, 0, y + ch - spandrel);
              grad.addColorStop(0, warm ? '#fff3d8' : '#e4efff');
              grad.addColorStop(1, warm ? '#e9b877' : '#9fb9de');
              g.fillStyle = grad;
              g.globalAlpha = 0.3 + skyRandom() * 0.5;
              g.fillRect(x + 1, y, cw - 2, ch - spandrel);
            }
            g.globalAlpha = 1;
          }
        });
      }
      const skyGlassMaterials = new Map();
      function skyGlass(key, b) {
        if (skyGlassMaterials.has(key)) return skyGlassMaterials.get(key);
        const spec = SKY_GLAZING[key],
          lit = glazingLit(spec);
        lit.repeat.set(0.5, 0.25);
        const material = useCityGlass(
          new Three.MeshStandardMaterial({
            map: glazingMap(spec),
            color: '#ffffff',
            roughness: 0.1,
            metalness: 0.72,
            emissive: '#ffe8c4',
            emissiveMap: lit,
            emissiveIntensity: 0,
          }),
        );
        litWindowMaterials.push({ material, strength: 0.45 + skyRandom() * 0.15, phase: skyRandom() * 9, x: b.x, y: b.y });
        skyGlassMaterials.set(key, material);
        return material;
      }
      // Shared finishes.
      const skyWhite = new Three.CanvasTexture(
          (() => {
            const c = document.createElement('canvas');
            c.width = c.height = 4;
            const g = c.getContext('2d');
            g.fillStyle = '#fff';
            g.fillRect(0, 0, 4, 4);
            return c;
          })(),
        ),
        skySteel = mat('#c7ced3', 0.35, 0.75),
        skyDarkSteel = mat('#3c4349', 0.45, 0.7),
        skyBronze = mat('#8a6440', 0.4, 0.75),
        skyStone = mat('#cfc9bc', 0.72, 0.02),
        skyDarkStone = mat('#5b5a57', 0.6, 0.05),
        skyCore = mat('#23292f', 0.5, 0.3),
        skyWater = new Three.MeshStandardMaterial({ color: '#27505c', roughness: 0.06, metalness: 0.35 }),
        // Tower roofs are dark: seen from above a white membrane read as a hole in the skyline.
        skyRoof = new Three.MeshStandardMaterial({ map: ROOF_TEXTURES.gravel, color: '#6f7479', roughness: 0.92, metalness: 0.02 }),
        skyLouver = new Three.MeshStandardMaterial({ map: ROOF_TEXTURES.metal, color: '#5d666c', roughness: 0.55, metalness: 0.5 }),
        skyGreenRoof = new Three.MeshStandardMaterial({ map: ROOF_TEXTURES.green, roughness: 0.95 }),
        skyLobby = useCityGlass(
          new Three.MeshStandardMaterial({
            color: '#26343c',
            roughness: 0.08,
            metalness: 0.7,
            emissive: '#ffdcaa',
            emissiveMap: skyWhite,
            emissiveIntensity: 0,
          }),
        );
      /**
       * LED lighting that blooms at night (crowns, outlines, strips). By day it is
       * pale metal. `base` is its night intensity as HDR light; `cycle` walks the
       * hue round (the twisting tower's crown).
       */
      const skyLeds = [];
      function skyLed(color, base = 3, cycle = false) {
        const key = color + '|' + base + '|' + cycle,
          found = skyLeds.find((l) => l.key === key);
        if (found) return found.material;
        const material = new Three.MeshStandardMaterial({
          color: '#aab2b8',
          roughness: 0.35,
          metalness: 0.4,
          emissive: color,
          emissiveMap: skyWhite,
          emissiveIntensity: 0,
        });
        skyLeds.push({ key, material, base, cycle, color: new Three.Color(color) });
        return material;
      }
      // ---- Plans ---------------------------------------------------------------------
      // A plan is a closed outline [{x, z, c}] about (0, 0); c marks a hard corner.
      function orientPlan(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
          const p = points[i],
            q = points[(i + 1) % points.length];
          area += p.x * q.z - q.x * p.z;
        }
        if (area < 0) points.reverse();
        return points;
      }
      function planRect(w, d, chamfer = 0) {
        const x = w / 2,
          z = d / 2,
          k = chamfer;
        return orientPlan(
          k > 0
            ? [
                [-x + k, -z], [x - k, -z], [x, -z + k], [x, z - k], [x - k, z], [-x + k, z], [-x, z - k], [-x, -z + k],
              ].map(([px, pz]) => ({ x: px, z: pz, c: true }))
            : [[-x, -z], [x, -z], [x, z], [-x, z]].map(([px, pz]) => ({ x: px, z: pz, c: true })),
        );
      }
      // Rounded rectangle; `radii` per corner (NW, NE, SE, SW) as a fraction of the short side.
      function planRounded(w, d, radii, segments = 6) {
        const points = [],
          short = Math.min(w, d),
          corners = [
            [-w / 2, -d / 2, Math.PI, 1.5 * Math.PI],
            [w / 2, -d / 2, 1.5 * Math.PI, 2 * Math.PI],
            [w / 2, d / 2, 0, 0.5 * Math.PI],
            [-w / 2, d / 2, 0.5 * Math.PI, Math.PI],
          ];
        corners.forEach(([cx, cz, a0, a1], i) => {
          const r = (Array.isArray(radii) ? radii[i] : radii) * short;
          if (r < 0.5) {
            points.push({ x: cx, z: cz, c: true });
            return;
          }
          const ox = cx - Math.sign(cx) * r,
            oz = cz - Math.sign(cz) * r;
          for (let k = 0; k <= segments; k++) {
            const a = a0 + ((a1 - a0) * k) / segments;
            points.push({ x: ox + Math.cos(a) * r, z: oz + Math.sin(a) * r, c: false });
          }
        });
        return orientPlan(points);
      }
      function planSuper(w, d, n, segments = 44) {
        const points = [];
        for (let k = 0; k < segments; k++) {
          const a = (k / segments) * TAU,
            c = Math.cos(a),
            s = Math.sin(a);
          points.push({
            x: (w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
            z: (d / 2) * Math.sign(s) * Math.pow(Math.abs(s), 2 / n),
            c: false,
          });
        }
        return orientPlan(points);
      }
      function planCircle(r, segments = 32) {
        return planSuper(r * 2, r * 2, 2, segments);
      }
      // Triangle with convex sides and sharp prows (the sail towers).
      function planSailTriangle(w, d, bulge = 0.09, perEdge = 7) {
        const v = [
            [-0.5, -0.46],
            [0.5, -0.46],
            [0.04, 0.54],
          ],
          points = [];
        for (let i = 0; i < 3; i++) {
          const a = v[i],
            b = v[(i + 1) % 3],
            mx = (a[0] + b[0]) / 2,
            mz = (a[1] + b[1]) / 2,
            // Push the edge's control point away from the centroid.
            len = Math.hypot(mx - 0.013, mz + 0.127) || 1,
            cx = mx + ((mx - 0.013) / len) * bulge,
            cz = mz + ((mz + 0.127) / len) * bulge;
          for (let k = 0; k < perEdge; k++) {
            const t = k / perEdge,
              x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0],
              z = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cz + t * t * b[1];
            points.push({ x: x * w, z: z * d, c: k === 0 });
          }
        }
        return orientPlan(points);
      }
      // Straight back (north), curved front (south): the embankment towers.
      function planD(w, d, segments = 20) {
        const points = [
          { x: -w / 2, z: -d / 2, c: true },
          { x: w / 2, z: -d / 2, c: true },
        ];
        for (let k = 1; k < segments; k++) {
          const a = (k / segments) * Math.PI;
          points.push({ x: (w / 2) * Math.cos(a), z: -d / 2 + d * Math.sin(a), c: false });
        }
        return orientPlan(points);
      }
      // Two arcs meeting in sharp ends east and west (the sail-roofed tower).
      function planLens(w, d, segments = 14) {
        const points = [];
        for (let k = 0; k < segments; k++) {
          const t = k / segments;
          points.push({ x: w / 2 - w * t, z: -(d / 2) * Math.sin(t * Math.PI), c: k === 0 });
        }
        for (let k = 0; k < segments; k++) {
          const t = k / segments;
          points.push({ x: -w / 2 + w * t, z: (d / 2) * Math.sin(t * Math.PI), c: k === 0 });
        }
        return orientPlan(points);
      }
      // A chevron pointing south with a notch in its back (the twin chevron towers).
      function planChevron(w, d) {
        return orientPlan(
          [
            [-w / 2, -d / 2],
            [0, -d / 2 + d * 0.22],
            [w / 2, -d / 2],
            [w / 2, d * 0.18],
            [0, d / 2],
            [-w / 2, d * 0.18],
          ].map(([x, z]) => ({ x, z, c: true })),
        );
      }
      // Pushes a plan outward by `d` (mitred), for trims, bands and crowns.
      function offsetPlan(plan, d) {
        const n = plan.length;
        return plan.map((p, i) => {
          const a = plan[(i + n - 1) % n],
            b = plan[(i + 1) % n];
          let n1x = p.z - a.z,
            n1z = -(p.x - a.x),
            n2x = b.z - p.z,
            n2z = -(b.x - p.x);
          const l1 = Math.hypot(n1x, n1z) || 1,
            l2 = Math.hypot(n2x, n2z) || 1;
          n1x /= l1;
          n1z /= l1;
          n2x /= l2;
          n2z /= l2;
          let mx = n1x + n2x,
            mz = n1z + n2z;
          const ml = Math.hypot(mx, mz) || 1;
          mx /= ml;
          mz /= ml;
          const miter = d / Math.max(0.35, mx * n1x + mz * n1z);
          return { x: p.x + mx * miter, z: p.z + mz * miter, c: p.c };
        });
      }
      const scalePlan = (plan, f) => plan.map((p) => ({ x: p.x * f, z: p.z * (f.z ?? f), c: p.c }));
      // ---- Lofting -------------------------------------------------------------------
      // A section: {y, s, sx, sz, r (radians), ox, oz}. Returns the local point (x, z).
      function sectionPoint(p, sec, out) {
        const sx = sec.sx ?? sec.s ?? 1,
          sz = sec.sz ?? sec.s ?? 1,
          r = sec.r || 0,
          x = p.x * sx,
          z = p.z * sz,
          c = Math.cos(r),
          s = Math.sin(r);
        out.x = (sec.ox || 0) + x * c - z * s;
        out.z = (sec.oz || 0) + x * s + z * c;
        return out;
      }
      // Largest uniform scale of `plan` that keeps every section inside +-(hw, hd).
      function fitScale(plan, sections, hw, hd) {
        let f = Infinity;
        const q = { x: 0, z: 0 };
        for (const sec of sections)
          for (const p of plan) {
            const ox = sec.ox || 0,
              oz = sec.oz || 0;
            sectionPoint(p, { ...sec, ox: 0, oz: 0 }, q);
            if (q.x > 1e-6) f = Math.min(f, (hw - ox) / q.x);
            if (q.x < -1e-6) f = Math.min(f, (hw + ox) / -q.x);
            if (q.z > 1e-6) f = Math.min(f, (hd - oz) / q.z);
            if (q.z < -1e-6) f = Math.min(f, (hd + oz) / -q.z);
          }
        return f;
      }
      /**
       * Lofts a plan through sections into a wall mesh (and a roof cap unless
       * `cap: null`). `top(x, z)` bends the last section into a sloped or curved
       * roof line. Returns the top outline in tower-local coordinates.
       */
      function skyLoft(T, plan, sections, material, options = {}) {
        const n = plan.length,
          cols = [];
        for (let i = 0; i < n; i++) {
          cols.push(i);
          if (plan[i].c) cols.push(i);
        }
        cols.push(0);
        const J = cols.length,
          K = sections.length,
          positions = new Float32Array(J * K * 3),
          uvs = new Float32Array(J * K * 2),
          indices = [],
          q = { x: 0, z: 0 },
          prev = { x: 0, z: 0 },
          tileU = options.tileU || SKY_TILE_U,
          tileV = options.tileV || SKY_TILE_V,
          topRing = [];
        for (let k = 0; k < K; k++) {
          const sec = sections[k];
          let u = 0;
          for (let j = 0; j < J; j++) {
            sectionPoint(plan[cols[j]], sec, q);
            if (j > 0) u += Math.hypot(q.x - prev.x, q.z - prev.z);
            prev.x = q.x;
            prev.z = q.z;
            const x = T.cx + q.x,
              z = T.cz + q.z,
              y = k === K - 1 && options.top ? options.top(x, z) : sec.y,
              o = (k * J + j) * 3;
            positions[o] = x;
            positions[o + 1] = y;
            positions[o + 2] = z;
            uvs[(k * J + j) * 2] = u / tileU;
            uvs[(k * J + j) * 2 + 1] = y / tileV;
            if (k === K - 1 && j < J - 1 && (j === 0 || cols[j] !== cols[j - 1])) topRing.push({ x, y, z, c: plan[cols[j]].c });
          }
        }
        for (let k = 0; k < K - 1; k++)
          for (let j = 0; j < J - 1; j++) {
            if (cols[j] === cols[j + 1]) continue;
            const a = k * J + j,
              b = a + 1,
              d = a + J,
              c = d + 1;
            indices.push(a, d, b, b, d, c);
          }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        // The seam column is two vertices; where the outline is smooth, share their normal.
        if (!plan[0].c) {
          const nor = geometry.attributes.normal;
          for (let k = 0; k < K; k++) {
            const a = k * J,
              b = k * J + J - 1;
            const x = nor.getX(a) + nor.getX(b),
              y = nor.getY(a) + nor.getY(b),
              z = nor.getZ(a) + nor.getZ(b),
              l = Math.hypot(x, y, z) || 1;
            nor.setXYZ(a, x / l, y / l, z / l);
            nor.setXYZ(b, x / l, y / l, z / l);
          }
        }
        skyPart(T, geometry, material, options);
        const top = topRing;
        if (options.cap !== null) skyCap(T, top, options.cap || skyRoof);
        return top;
      }
      // Roof over an outline of points {x, y, z} (flat or sloped).
      function skyCap(T, ring, material, lift = 0) {
        const contour = ring.map((p) => new Three.Vector2(p.x, p.z)),
          triangles = Three.ShapeUtils.triangulateShape(contour, []),
          positions = new Float32Array(ring.length * 3),
          uvs = new Float32Array(ring.length * 2),
          indices = [];
        ring.forEach((p, i) => {
          positions.set([p.x, p.y + lift, p.z], i * 3);
          uvs.set([p.x / 96, p.z / 96], i * 2);
        });
        for (const [a, b, c] of triangles) {
          const p = ring[a],
            q = ring[b],
            r = ring[c],
            up = (q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z);
          if (up >= 0) indices.push(a, b, c);
          else indices.push(a, c, b);
        }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        skyPart(T, geometry, material);
      }
      function skyPart(T, geometry, material, options = {}) {
        const m = new Three.Mesh(geometry, material);
        m.castShadow = options.shadow !== false;
        m.receiveShadow = true;
        T.group.add(m);
        return m;
      }
      // A protruding ring (slab edge, crown band, LED line) round a plan at one section.
      function skyBand(T, plan, sec, y0, y1, grow, material) {
        const outer = offsetPlan(plan, grow);
        skyLoft(T, outer, [{ ...sec, y: y0 }, { ...sec, y: y1 }], material, { tileU: 64, tileV: 64, cap: null, shadow: false });
        // Its top and bottom faces: a ring between the outline and the grown outline.
        for (const [y, up] of [
          [y1, true],
          [y0, false],
        ]) {
          const positions = [],
            q = { x: 0, z: 0 },
            n = plan.length;
          for (let i = 0; i < n; i++) {
            for (const pl of [plan, outer]) {
              sectionPoint(pl[i], sec, q);
              positions.push(T.cx + q.x, y, T.cz + q.z);
            }
          }
          const indices = [];
          for (let i = 0; i < n; i++) {
            const a = i * 2,
              b = a + 1,
              c = ((i + 1) % n) * 2 + 1,
              d = ((i + 1) % n) * 2;
            // Outline runs counter-clockwise seen from above, so this faces up.
            if (up) indices.push(a, c, b, a, d, c);
            else indices.push(a, b, c, a, c, d);
          }
          const geometry = new Three.BufferGeometry();
          geometry.setAttribute('position', new Three.BufferAttribute(new Float32Array(positions), 3));
          geometry.setAttribute('uv', new Three.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          skyPart(T, geometry, material, { shadow: false });
        }
      }
      // Vertical fins standing off each straight edge every `spacing` units.
      function skyFins(T, plan, sec, y0, y1, spacing, depth, width, material, perVertex = false) {
        const q = { x: 0, z: 0 },
          r = { x: 0, z: 0 },
          n = plan.length;
        for (let i = 0; i < n; i++) {
          sectionPoint(plan[i], sec, q);
          sectionPoint(plan[(i + 1) % n], sec, r);
          const ex = r.x - q.x,
            ez = r.z - q.z,
            len = Math.hypot(ex, ez);
          if (len < 1) continue;
          const nx = ez / len,
            nz = -ex / len,
            yaw = -Math.atan2(ez, ex),
            count = perVertex ? 1 : Math.max(1, Math.floor(len / spacing));
          for (let k = 0; k < count; k++) {
            const t = perVertex ? 0 : (k + 0.5) / count,
              x = T.cx + q.x + ex * t + (nx * depth) / 2,
              z = T.cz + q.z + ez * t + (nz * depth) / 2,
              fin = box(T.group, x, (y0 + y1) / 2, z, width, y1 - y0, depth, material);
            fin.rotation.y = yaw;
          }
        }
      }
      // A strip standing just off the facade that follows plan vertex `index` up
      // through every section (a seam that twists with a twisting tower).
      function skyRibbon(T, plan, sections, index, width, material) {
        const n = plan.length,
          q = { x: 0, z: 0 },
          a = { x: 0, z: 0 },
          b = { x: 0, z: 0 },
          positions = [],
          indices = [];
        sections.forEach((sec, k) => {
          sectionPoint(plan[index], sec, q);
          sectionPoint(plan[(index + n - 1) % n], sec, a);
          sectionPoint(plan[(index + 1) % n], sec, b);
          let tx = b.x - a.x,
            tz = b.z - a.z;
          const tl = Math.hypot(tx, tz) || 1;
          tx /= tl;
          tz /= tl;
          // Outward normal of a counter-clockwise outline is (tz, -tx).
          const ox = T.cx + q.x + tz * 0.9,
            oz = T.cz + q.z - tx * 0.9;
          positions.push(ox - (tx * width) / 2, sec.y, oz - (tz * width) / 2, ox + (tx * width) / 2, sec.y, oz + (tz * width) / 2);
          if (k > 0) {
            const i = k * 2;
            indices.push(i - 2, i, i - 1, i - 1, i, i + 1);
          }
        });
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.BufferAttribute(new Float32Array(positions), 3));
        geometry.setAttribute('uv', new Three.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        skyPart(T, geometry, material, { shadow: false });
      }
      function skyBeacon(T, x, y, z, phase = 0) {
        mesh(sphereGeo, beaconLens, T.group, x, y, z, 1.4, 1.4, 1.4);
        addGroupGlow(T.group, x, y, z, 26, '#ff3020', 5, { mode: 'beacon', day: 0.35, phase });
        T.top = Math.max(T.top, y);
      }
      // A plant penthouse (louvred box) with a row of condensers, centred on the roof.
      function skyRoofPlant(T, y, w, d, ox = 0, oz = 0) {
        const x = T.cx + ox,
          z = T.cz + oz;
        box(T.group, x, y + 9, z, w, 18, d, skyLouver);
        box(T.group, x, y + 18.6, z, w + 2, 1.2, d + 2, skyDarkSteel);
        acCluster(T.b.x + x - w / 2 + 10, y + 18, T.b.y + z + d / 2 - 9, Math.max(1, Math.floor(w / 24)));
      }
      const beaconLens = new Three.MeshStandardMaterial({ color: '#7a1a14', roughness: 0.3, emissive: '#ff2a1a', emissiveIntensity: 0.6 });
