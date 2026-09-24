      // BEGIN SUBSYSTEM: src/skyline3d.js — North Point financial cluster towers
      /**
       * North Point financial cluster towers
       * Source: src/skyline3d.js
       * Scope: createCityRenderer() closure (included by src/cityscape3d.js, which calls
       * buildSkylineTower() for every building that src/skyline.js planned).
       *
       * Each tower is lofted from a floor plan (a closed outline with hard corners
       * where it has them) through a list of sections (height, scale, twist,
       * offset), so a twisting tower, a tapering needle, a curved facade or a stack
       * of rotated blocks are all the same few lines of data. Walls are UV-mapped in
       * world units (one curtain-wall tile is four 8-unit panels by four 18-unit
       * floors), so one glazing texture per design serves any size without
       * per-mesh texture repeats, and each design has its own glass colour, mullion
       * rhythm and spandrel pattern. Night lighting comes from a lit-window
       * emissive map (the city's litWindowMaterials drive it), LED crown and
       * outline materials that bloom, and red aircraft warning lights in the glow
       * field (signage3d.js).
       *
       * Everything is ordinary static meshes in the building's group, so the static
       * batcher merges each tower per material and the far-scenery copy picks the
       * large pieces up on its own (thin fins and masts stay out of it).
       *
       * Collision is the lot rectangle (src/skyline.js): the podium fills the lot
       * and every shaft stays inside it.
       */
      const SKY_PANEL = 8,
        SKY_FLOOR = 18,
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
        const material = new Three.MeshStandardMaterial({
          map: glazingMap(spec),
          color: '#ffffff',
          roughness: 0.1,
          metalness: 0.72,
          emissive: '#ffe8c4',
          emissiveMap: lit,
          emissiveIntensity: 0,
        });
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
        skyLobby = new Three.MeshStandardMaterial({
          color: '#26343c',
          roughness: 0.08,
          metalness: 0.7,
          emissive: '#ffdcaa',
          emissiveMap: skyWhite,
          emissiveIntensity: 0,
        });
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
      // ---- Podium and plaza -----------------------------------------------------------
      function skyPodium(T, height) {
        const { group, W, D } = T,
          lobby = height * 0.56;
        box(group, W / 2, lobby / 2, D / 2, W - 10, lobby, D - 10, skyLobby);
        box(group, W / 2, lobby + (height - lobby) / 2, D / 2, W, height - lobby, D, skyStone);
        for (const x of [4, W - 4]) for (const z of [4, D - 4]) box(group, x, lobby / 2, z, 8, lobby, 8, skyStone);
        // Mullions across the lobby glass on the street faces.
        for (let x = 20; x < W - 12; x += 16) box(group, x, lobby / 2, D - 4.6, 1, lobby, 1.2, skyDarkSteel);
        box(group, W / 2, height + 0.4, D / 2, W - 6, 0.8, D - 6, skyGreenRoof);
        for (const [x, z, w, d] of [
          [W / 2, 1.5, W, 3],
          [W / 2, D - 1.5, W, 3],
          [1.5, D / 2, 3, D],
          [W - 1.5, D / 2, 3, D],
        ])
          box(group, x, height + 1.6, z, w, 3.2, d, skySteel);
        // Entrance canopy on the plaza side.
        box(group, W / 2, lobby - 1, D + 7, Math.min(90, W * 0.45), 1.4, 16, skySteel);
        for (const dx of [-1, 1]) box(group, W / 2 + dx * Math.min(40, W * 0.2), (lobby - 1) / 2, D + 13, 1.2, lobby - 1, 1.2, skyDarkSteel);
        signSpill(T.b.x + W / 2, T.b.y + D + 14, 60, '#ffd9a8', 0.35);
        // The tower's name in lit capitals on the fascia, a stock ticker under it.
        const fascia = height - lobby,
          nameWidth = Math.min(W * 0.7, fascia * 5.6);
        atlasSign(group, towerNameCell(T.b.skyline.name), W / 2, lobby + fascia * 0.6, D + 0.7, nameWidth, nameWidth / 8, neonCutout);
        tickerBand(group, W / 2, lobby + 2.2, D + 0.6, W - 16, 2.8);
        T.podium = height;
      }
      // Fountain, benches and bollard lights on the block's south plaza (once per block).
      function skyPlaza(t) {
        const x0 = blockX(t.bx) + 89,
          y0 = blockY(t.by) + 89,
          fx = x0 + 167,
          fz = y0 + 296,
          g = new Three.Group();
        g.position.set(fx, 0, fz);
        scene.add(g);
        batchGroups.push(g);
        mesh(new Three.CylinderGeometry(24, 25, 2.6, 32), skyStone, g, 0, 1.3, 0);
        mesh(new Three.CylinderGeometry(21.5, 21.5, 0.6, 32), skyWater, g, 0, 2.3, 0);
        mesh(new Three.CylinderGeometry(4, 5, 5, 16), skyStone, g, 0, 2.5, 0);
        mesh(sphereGeo, chrome, g, 0, 10, 0, 5.2, 5.2, 5.2);
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6;
          addGlow(fx + Math.cos(a) * 17, 3.6, fz + Math.sin(a) * 17, 10, '#9fe8ff', 1.2, { mode: 'pulse', phase: k / 6 });
        }
        signSpill(fx, fz, 46, '#a8e6ff', 0.3);
        for (const dx of [-44, 44]) {
          place(pools.benchSeat, fx + dx, 4.2, fz, 16, 1, 5);
          place(pools.benchLeg, fx + dx - 6.5, 2, fz, 1, 4, 4.6);
          place(pools.benchLeg, fx + dx + 6.5, 2, fz, 1, 4, 4.6);
        }
        // Bollard lights along the plaza's south edge.
        for (let x = x0 + 24; x < x0 + 334; x += 48) {
          if (Math.abs(x - fx) < 36) continue;
          place(pools.bollard, x, 2.6, y0 + 324, 1.4, 5.2, 1.4);
          addGlow(x, 5.6, y0 + 324, 7, '#ffe3b8', 1.4, {});
        }
        statics.push({ x: fx, y: fz, group: g, radius: 60 });
      }
      // ---- The designs ------------------------------------------------------------------
      // Each receives T: {b, group, W, D, cx, cz, top} and builds in tower-local units.
      const SKY_DESIGNS = {
        federation(T) {
          const H = T.b.height,
            glass = skyGlass('federation', T.b);
          skyPodium(T, 44);
          const plan0 = planSailTriangle(1, 1),
            sections = [{ y: 40 }, { y: H * 0.72 }, { y: H, s: 0.9 }, { y: H + 46, s: 0.82 }],
            f = fitScale(plan0, sections, T.W / 2 - 6, T.D / 2 - 6),
            plan = scalePlan(plan0, f);
          const top = skyLoft(T, plan, sections, glass, { cap: skyRoof });
          // The glass runs past the roof as a screen; an LED line traces its edge.
          skyBand(T, plan, sections[3], H + 44, H + 47, 0.8, skyLed('#bfe4ff', 3.4));
          for (const y of [H * 0.25, H * 0.5, H * 0.72]) skyBand(T, plan, { y }, y - 2, y + 2, 1.4, skySteel);
          // A slender spire from the roof, over the sharp south prow's axis.
          const px = T.cx,
            pz = T.cz + 4;
          mesh(new Three.CylinderGeometry(1.2, 5, 190, 10), skySteel, T.group, px, H + 95, pz);
          skyBeacon(T, px, H + 192, pz, 0);
          skyBeacon(T, top[0].x, H + 48, top[0].z, 0.3);
          // Vertical LED on the prow (the point nearest the plaza).
          const prow = top.reduce((a, p) => (p.z > a.z ? p : a), top[0]);
          box(T.group, prow.x, (44 + H) / 2, prow.z + 1, 1.6, H - 44, 1.6, skyLed('#bfe4ff', 2.6));
          // Skybridge atrium to the west tower across the passage.
          box(T.group, T.W + 9, 34, 150, 20, 14, 120, skyLobby);
          box(T.group, T.W + 9, 41.5, 150, 22, 1.2, 122, skySteel);
          T.top = Math.max(T.top, H + 192);
        },
        federationWest(T) {
          const H = T.b.height,
            glass = skyGlass('federation', T.b);
          skyPodium(T, 44);
          const plan0 = planSailTriangle(1, 1),
            sections = [{ y: 40, r: Math.PI }, { y: H, r: Math.PI, s: 0.94 }, { y: H + 36, r: Math.PI, s: 0.88 }],
            f = fitScale(plan0, sections, T.W / 2 - 5, T.D / 2 - 5),
            plan = scalePlan(plan0, f);
          const top = skyLoft(T, plan, sections, glass);
          skyBand(T, plan, sections[2], H + 34, H + 37, 0.8, skyLed('#bfe4ff', 3.4));
          for (const y of [H * 0.33, H * 0.66]) skyBand(T, plan, { y, r: Math.PI }, y - 2, y + 2, 1.4, skySteel);
          skyBeacon(T, top[0].x, H + 38, top[0].z, 0.5);
          T.top = Math.max(T.top, H + 38);
        },
        mercury(T) {
          const H = T.b.height,
            glass = skyGlass('mercury', T.b),
            w = T.W - 14,
            d = T.D - 14,
            plan = planRect(w, d, 16),
            amber = skyLed('#ffb35c', 3.6);
          skyPodium(T, 46);
          // Stepped setbacks, each shifting west and north like the real thing.
          const steps = [
            { y0: 42, y1: H * 0.6, sx: 1, sz: 1, ox: 0, oz: 0 },
            { y0: H * 0.6, y1: H * 0.78, sx: 0.8, sz: 1, ox: -w * 0.1, oz: 0 },
            { y0: H * 0.78, y1: H * 0.91, sx: 0.6, sz: 0.84, ox: -w * 0.16, oz: -d * 0.04 },
            { y0: H * 0.91, y1: H, sx: 0.42, sz: 0.62, ox: -w * 0.2, oz: -d * 0.06 },
          ];
          for (const s of steps) {
            const sec = { sx: s.sx, sz: s.sz, ox: s.ox, oz: s.oz };
            skyLoft(T, plan, [{ ...sec, y: s.y0 }, { ...sec, y: s.y1 }], glass);
            skyBand(T, plan, sec, s.y1 - 3, s.y1 + 1, 1.2, amber);
            skyFins(T, plan, { ...sec, y: s.y0 }, s.y0 + 2, s.y1 - 3, 22, 3.2, 1.4, skyBronze);
          }
          // Copper pyramid and spire on the last step.
          const last = steps[3],
            sx = T.cx + last.ox,
            sz = T.cz + last.oz,
            r = Math.min(w * last.sx, d * last.sz) * 0.5;
          const pyramid = mesh(new Three.ConeGeometry(r, 80, 4), skyBronze, T.group, sx, H + 40, sz);
          pyramid.rotation.y = Math.PI / 4;
          mesh(new Three.CylinderGeometry(0.8, 2.4, 110, 8), skySteel, T.group, sx, H + 135, sz);
          box(T.group, sx, H + 30, sz + r * 0.5, r * 0.7, 3, 1, amber);
          skyBeacon(T, sx, H + 192, sz, 0.1);
          T.top = Math.max(T.top, H + 192);
        },
        capitals(T) {
          const H = T.b.height,
            dark = skyGlass('capitalsDark', T.b),
            light = skyGlass('capitalsLight', T.b),
            blockH = 96,
            count = Math.round((H - 44) / blockH),
            span = (H - 44) / count,
            plan0 = planRect(1, 1.3),
            sections = [];
          skyPodium(T, 44);
          for (let k = 0; k < count; k++) sections.push({ y: 44 + k * span, r: (k % 2 ? 1 : -1) * 0.1, ox: (k % 2 ? 4 : -4), oz: ((k % 3) - 1) * 3 });
          const f = fitScale(plan0, sections, T.W / 2 - 5, T.D / 2 - 5),
            plan = scalePlan(plan0, f);
          // The core shows in the reveal between the stacked blocks.
          skyLoft(T, scalePlan(plan0, f * 0.86), [{ y: 42 }, { y: H - 2 }], skyCore, { cap: null });
          sections.forEach((sec, k) => {
            const y0 = sec.y + 2.5,
              y1 = sec.y + span - 2.5;
            skyLoft(T, plan, [{ ...sec, y: y0 }, { ...sec, y: y1 }], k % 2 ? light : dark, { cap: k === count - 1 ? skyRoof : skyDarkStone });
            if (k === count - 1) {
              skyBand(T, plan, sec, y1 - 1, y1 + 3, 1, skyLed('#e8f2ff', 3));
              skyRoofPlant(T, y1, 50, 60, sec.ox, sec.oz);
            }
          });
          skyBeacon(T, T.cx, H + 8, T.cz, 0.2);
          T.top = Math.max(T.top, H + 8);
        },
        capitalsBay(T) {
          const H = T.b.height,
            dark = skyGlass('capitalsDark', T.b),
            light = skyGlass('capitalsLight', T.b),
            count = 6,
            span = (H - 40) / count,
            shifts = [-7, 6, -3, 7, -6, 3];
          skyPodium(T, 40);
          const plan = planRect(T.W - 30, T.D - 26);
          skyLoft(T, planRect(T.W - 40, T.D - 36), [{ y: 38 }, { y: H - 2 }], skyCore, { cap: null });
          for (let k = 0; k < count; k++) {
            const sec = { ox: shifts[k], oz: -shifts[(k + 2) % count] * 0.8 };
            skyLoft(T, plan, [{ ...sec, y: 40 + k * span + 2 }, { ...sec, y: 40 + (k + 1) * span - 2 }], k % 2 ? dark : light, { cap: k === count - 1 ? skyRoof : skyDarkStone });
          }
          skyBand(T, plan, { ox: shifts[count - 1], oz: -shifts[1] * 0.8 }, H - 3, H + 1, 1, skyLed('#e8f2ff', 3));
          skyRoofPlant(T, H - 2, 44, 50, shifts[count - 1], -shifts[1] * 0.8);
          skyBeacon(T, T.cx, H + 4, T.cz, 0.7);
        },
        evolution(T) {
          const H = T.b.height,
            glass = skyGlass('evolution', T.b),
            plan0 = planSuper(1, 0.64, 2.6, 48),
            sections = [];
          skyPodium(T, 42);
          const steps = 34;
          for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            sections.push({ y: 40 + (H - 40) * t, r: t * 2.6, s: 1 + 0.05 * Math.sin(t * Math.PI) });
          }
          const f = fitScale(plan0, sections, T.W / 2 - 6, T.D / 2 - 6),
            plan = scalePlan(plan0, f);
          skyLoft(T, plan, sections, glass);
          // Two seams run up the narrow ends and twist with the tower (lit at night).
          for (const index of [0, plan.length / 2]) skyRibbon(T, plan, sections, index, 7, skyLed('#8fd8ff', 1.6));
          // Colour-walking LED crown.
          const last = sections[steps];
          skyBand(T, plan, last, H - 5, H + 2, 1.2, skyLed('#8fd8ff', 3.6, true));
          skyBand(T, plan, sections[Math.round(steps / 2)], H / 2 + 18, H / 2 + 22, 1.1, skyLed('#8fd8ff', 2.4, true));
          skyBeacon(T, T.cx, H + 12, T.cz, 0.4);
          mesh(cylinderGeo, skyDarkSteel, T.group, T.cx, H + 5, T.cz, 1, 10, 1);
        },
        embankment(T) {
          const H = T.b.height,
            glass = skyGlass('embankment', T.b),
            plan = planD(T.W - 12, T.D - 12);
          skyPodium(T, 46);
          skyLoft(T, plan, [{ y: 42 }, { y: H }], glass);
          for (let y = 150; y < H - 20; y += 108) skyBand(T, plan, { y }, y - 2.5, y + 2.5, 1.6, skySteel);
          // Open crown frame over the roof, lit along its ring.
          const crown = offsetPlan(plan, -8);
          for (let i = 0; i < crown.length; i += 3) {
            const p = crown[i];
            box(T.group, T.cx + p.x, H + 22, T.cz + p.z, 1.6, 44, 1.6, skySteel);
          }
          skyBand(T, crown, { y: H + 44 }, H + 42, H + 46, 1.4, skyLed('#dff4ff', 3.2));
          skyRoofPlant(T, H, 60, 50, 0, -20);
          skyBeacon(T, T.cx, H + 60, T.cz - T.D * 0.2, 0.6);
          mesh(cylinderGeo, skySteel, T.group, T.cx, H + 30, T.cz - T.D * 0.2, 1, 60, 1);
        },
        embankmentLow(T) {
          const H = T.b.height,
            glass = skyGlass('embankmentLow', T.b),
            sections = [{ y: 38, r: -Math.PI / 2 }, { y: H, r: -Math.PI / 2 }];
          skyPodium(T, 40);
          // planD is w by d; turned a quarter it has to fit d by w.
          const turned = planD(T.D - 12, T.W - 12);
          skyLoft(T, turned, sections, glass);
          for (let y = 120; y < H - 20; y += 90) skyBand(T, turned, sections[0], y - 2, y + 2, 1.4, skySteel);
          skyBand(T, turned, sections[1], H - 3, H + 1, 1, skyLed('#dff4ff', 3));
          skyRoofPlant(T, H, 40, 60);
          skyBeacon(T, T.cx, H + 4, T.cz, 0.8);
        },
        sail(T) {
          const H = T.b.height,
            glass = skyGlass('sail', T.b),
            w = T.W - 12,
            plan = planLens(w, T.D - 12),
            rise = 110,
            left = T.cx - w / 2;
          skyPodium(T, 46);
          // The roof sweeps up to the west like a sail.
          const roofLine = (x) => H + rise * Math.pow(1 - (x - left) / w, 1.6);
          const top = skyLoft(T, plan, [{ y: 42 }, { y: H }], glass, { top: (x) => roofLine(x), cap: glass });
          for (let y = 140; y < H - 20; y += 126) skyBand(T, plan, { y }, y - 2, y + 2, 1.2, skySteel);
          // LED lights along the sail's edge.
          for (const p of top) addGroupGlow(T.group, p.x, p.y + 1.5, p.z, 9, '#cfe9ff', 1.8, { day: 0 });
          const west = top.reduce((a, p) => (p.x < a.x ? p : a), top[0]);
          skyBeacon(T, west.x + 6, west.y + 3, west.z, 0.9);
          T.top = Math.max(T.top, H + rise + 4);
        },
        neva(T, mirror = false) {
          const H = T.b.height,
            glass = skyGlass('neva', T.b),
            plan = planChevron(T.W - 12, T.D - 12),
            led = skyLed('#ffffff', 2.8);
          skyPodium(T, 44);
          const top = skyLoft(T, plan, [{ y: 40 }, { y: H }], glass);
          skyBand(T, plan, { y: H }, H - 3, H + 2, 1, skySteel);
          skyRoofPlant(T, H, T.W * 0.36, T.D * 0.3, 0, -T.D * 0.12);
          // Vertical light lines on every outside corner.
          for (const p of top) {
            if (p.z < T.cz - T.D * 0.3 && Math.abs(p.x - T.cx) < 4) continue;
            box(T.group, p.x, (44 + H) / 2, p.z, 1.5, H - 44, 1.5, led);
          }
          skyBeacon(T, T.cx, H + 16, T.cz, mirror ? 0.5 : 0);
          mesh(cylinderGeo, skySteel, T.group, T.cx, H + 8, T.cz, 0.9, 16, 0.9);
        },
        nevaTwo(T) {
          SKY_DESIGNS.neva(T, true);
        },
        oko(T) {
          const H = T.b.height,
            glass = skyGlass('oko', T.b),
            plan = planRounded(T.W - 12, T.D - 12, 0.22),
            rise = 70,
            back = T.cz - (T.D - 12) / 2;
          skyPodium(T, 44);
          // The crown is cut on a slope that rises to the north, facing the plaza.
          skyLoft(T, plan, [{ y: 40 }, { y: H }], glass, { top: (x, z) => H + rise * (1 - (z - back) / (T.D - 12)), cap: glass });
          for (let y = 112; y < H - 10; y += 72) skyBand(T, plan, { y }, y - 2.5, y + 2.5, 1.4, skySteel);
          skyBand(T, plan, { y: H }, H - 3, H + 1, 1.4, skyLed('#fff1d6', 2.8));
          skyBeacon(T, T.cx, H + rise + 4, back + 8, 0.25);
          T.top = Math.max(T.top, H + rise + 4);
        },
        needle(T) {
          const H = T.b.height,
            glass = skyGlass('needle', T.b),
            plan = planRect(T.W - 12, T.D - 12, 18);
          skyPodium(T, 40);
          skyLoft(T, plan, [{ y: 38 }, { y: H, s: 0.62 }], glass, { cap: null });
          skyLoft(T, plan, [{ y: H, s: 0.62 }, { y: H + 90, s: 0.05 }], glass, { cap: null });
          skyBand(T, plan, { y: H, s: 0.62 }, H - 2, H + 2, 1.2, skyLed('#dcefff', 3));
          mesh(new Three.CylinderGeometry(0.7, 2.2, 130, 8), skySteel, T.group, T.cx, H + 90 + 65, T.cz);
          skyBeacon(T, T.cx, H + 88, T.cz, 0.15);
          skyBeacon(T, T.cx, H + 222, T.cz, 0.15);
        },
        crown(T) {
          const H = T.b.height,
            glass = skyGlass('crown', T.b),
            plan = planRect(T.W - 12, T.D - 12, 26),
            gold = skyLed('#ffcf7a', 2.2);
          skyPodium(T, 44);
          skyLoft(T, plan, [{ y: 40 }, { y: H }], glass);
          skyFins(T, plan, { y: 40 }, 46, H - 4, 26, 2.6, 1.2, skyBronze);
          // A crown of gilded fins round a lit lantern.
          skyFins(T, plan, { y: H }, H, H + 86, 13, 4, 1.6, gold);
          skyLoft(T, planRect(T.W * 0.45, T.D * 0.45, 12), [{ y: H }, { y: H + 62 }], skyLed('#ffe2a8', 1.3));
          skyBand(T, plan, { y: H }, H - 1, H + 3, 1.6, skyBronze);
          mesh(cylinderGeo, skySteel, T.group, T.cx, H + 90, T.cz, 1.2, 56, 1.2);
          skyBeacon(T, T.cx, H + 120, T.cz, 0.35);
        },
        rotunda(T) {
          const H = T.b.height,
            glass = skyGlass('rotunda', T.b),
            r = Math.min(T.W, T.D) / 2 - 6,
            plan = planCircle(r, 36);
          skyPodium(T, 38);
          skyLoft(T, plan, [{ y: 34 }, { y: H }], glass);
          skyFins(T, plan, { y: 34 }, 40, H - 2, 0, 4, 1.4, skySteel, true);
          skyBand(T, plan, { y: H }, H - 4, H + 2, 1.6, skyLed('#ffd9a0', 3));
          const dome = mesh(new Three.SphereGeometry(r * 0.55, 24, 10, 0, TAU, 0, Math.PI / 2), chrome, T.group, T.cx, H, T.cz);
          dome.scale.y = 0.55;
          mesh(cylinderGeo, skySteel, T.group, T.cx, H + r * 0.3 + 18, T.cz, 1, 36, 1);
          skyBeacon(T, T.cx, H + r * 0.3 + 37, T.cz, 0.65);
        },
        meridian(T) {
          const H = T.b.height,
            glass = skyGlass('meridian', T.b),
            plan = planRounded(T.W - 12, T.D - 12, [0, 0, 0.36, 0.36]);
          skyPodium(T, 42);
          skyLoft(T, plan, [{ y: 38 }, { y: H }], glass);
          for (let y = 128; y < H - 10; y += 90) skyBand(T, plan, { y }, y - 2, y + 2, 1.3, skySteel);
          // Penthouse lantern and a glass fin.
          const pent = planRounded((T.W - 12) * 0.6, (T.D - 12) * 0.55, [0, 0, 0.36, 0.36]);
          skyLoft(T, pent, [{ y: H, oz: -10 }, { y: H + 44, oz: -10 }], glass);
          skyBand(T, pent, { y: H + 44, oz: -10 }, H + 41, H + 45, 1, skyLed('#d8ecff', 3));
          box(T.group, T.cx - T.W * 0.2, H + 50, T.cz - 10, 2, 100, T.D * 0.4, skySteel);
          skyBeacon(T, T.cx - T.W * 0.2, H + 102, T.cz - 10, 0.45);
        },
        terraces(T) {
          const H = T.b.height,
            glass = skyGlass('terraces', T.b),
            w = T.W - 8,
            d = T.D - 8;
          skyPodium(T, 36);
          // Terraces step back from the plaza; each carries a roof garden.
          const tiers = [
            [34, H * 0.46, d, 0],
            [H * 0.46, H * 0.7, d * 0.74, -d * 0.13],
            [H * 0.7, H * 0.88, d * 0.5, -d * 0.25],
            [H * 0.88, H, d * 0.3, -d * 0.35],
          ];
          for (const [y0, y1, depth, oz] of tiers) {
            const plan = planRect(w, depth);
            skyLoft(T, plan, [{ y: y0, oz }, { y: y1, oz }], glass, { cap: skyGreenRoof });
            skyBand(T, plan, { oz }, y1 - 2, y1 + 3, 1, skyStone);
            const front = T.b.y + T.cz + oz + depth / 2 - 8;
            for (let x = T.b.x + 20; x < T.b.x + T.W - 20; x += 22) {
              place(pools.planter, x, y1 + 1.5, front, 12, 3, 5);
              place(pools.shrub, x, y1 + 5, front, 5, 4, 4);
            }
          }
          skyBeacon(T, T.cx, H + 12, T.cz - d * 0.35, 0.9);
        },
        diagrid(T) {
          const H = T.b.height,
            glass = skyGlass('diagrid', T.b),
            // The shaft fills the lot: its roof is a landing pad (rooftops.js).
            w = T.W - 3,
            d = T.D - 3,
            plan = planRect(w, d);
          skyPodium(T, 42);
          skyLoft(T, plan, [{ y: 38 }, { y: H }], glass);
          skyBand(T, plan, { y: H }, H - 3, H + 2, 1.5, skySteel);
          for (const [x, z, pw, pd] of [
            [T.W / 2, 2, T.W, 4],
            [T.W / 2, T.D - 2, T.W, 4],
            [2, T.D / 2, 4, T.D],
            [T.W - 2, T.D / 2, 4, T.D],
          ])
            box(T.group, x, H + 1.6, z, pw, 3.2, pd, skySteel);
          // Exoskeleton: diagonal braces on all four faces.
          const bay = 60,
            rise = 76,
            V = (x, y, z) => new Three.Vector3(x, y, z);
          for (const [ax, az, bx, bz, nx, nz] of [
            [T.cx - w / 2, T.cz + d / 2, T.cx + w / 2, T.cz + d / 2, 0, 1],
            [T.cx - w / 2, T.cz - d / 2, T.cx + w / 2, T.cz - d / 2, 0, -1],
            [T.cx - w / 2, T.cz - d / 2, T.cx - w / 2, T.cz + d / 2, -1, 0],
            [T.cx + w / 2, T.cz - d / 2, T.cx + w / 2, T.cz + d / 2, 1, 0],
          ]) {
            const len = Math.hypot(bx - ax, bz - az),
              bays = Math.max(1, Math.round(len / bay));
            for (let y = 44; y + rise <= H; y += rise)
              for (let k = 0; k < bays; k++) {
                const t0 = k / bays,
                  t1 = (k + 1) / bays,
                  p0 = [ax + (bx - ax) * t0 + nx * 1.2, az + (bz - az) * t0 + nz * 1.2],
                  p1 = [ax + (bx - ax) * t1 + nx * 1.2, az + (bz - az) * t1 + nz * 1.2];
                rod(T.group, V(p0[0], y, p0[1]), V(p1[0], y + rise, p1[1]), 1.3, skySteel);
                rod(T.group, V(p1[0], y, p1[1]), V(p0[0], y + rise, p0[1]), 1.3, skySteel);
              }
          }
          if (T.b.helipad) roofHelipad(T.group, T.b, H);
          else skyRoofPlant(T, H, w * 0.4, d * 0.34);
          // Warning-light mast in a corner, clear of the pad.
          box(T.group, T.W - 16, H + 20, T.D - 16, 1.2, 40, 1.2, skySteel);
          roofKeepOut(T.b.x + T.W - 16, T.b.y + T.D - 16, 8, 8);
          skyBeacon(T, T.W - 16, H + 41, T.D - 16, 0.05);
        },
      };
      // Builds a planned tower into `group` (placed at the lot's corner).
      function buildSkylineTower(b, group) {
        const t = b.skyline;
        skySeed = 7919 + SKYLINE_TOWERS.indexOf(t) * 104729;
        const T = { b, group, W: b.w, D: b.h, cx: b.w / 2, cz: b.h / 2, top: b.height, podium: 0 };
        SKY_DESIGNS[t.design](T);
        // Nothing lands on a tower but the one with a pad.
        if (!b.helipad) roofKeepOut(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);
        if (skylineBlockTowers(t.bx, t.by)[0] === t) skyPlaza(t);
        b.crownHeight = Math.max(0, T.top - b.height);
        return skyGlassMaterials.get(SKY_GLAZING_KEYS[t.design]);
      }
      const SKY_GLAZING_KEYS = {
        federationWest: 'federation',
        capitals: 'capitalsDark',
        capitalsBay: 'capitalsLight',
        nevaTwo: 'neva',
      };
      for (const key of Object.keys(SKY_DESIGNS)) if (!SKY_GLAZING_KEYS[key]) SKY_GLAZING_KEYS[key] = key;
      // Night: LED crowns follow the dark (and the district's power), one walks its hue.
      function updateSkyline(night) {
        const power = sideJobPower(2700, -2600);
        for (const led of skyLeds) {
          led.material.emissiveIntensity = night * led.base * power;
          if (led.cycle) led.material.emissive.setHSL((gameTime * 0.03) % 1, 0.75, 0.62);
        }
        skyLobby.emissiveIntensity = 0.1 + night * 0.8 * power;
      }
      // END SUBSYSTEM: src/skyline3d.js
