      // Boat kit materials and textures: finishes, tints, glass, pool water, lamps, teak and mahogany (KIT_FINISHES).
      const KIT_FINISHES = {
        gloss: { roughness: 0.3, metalness: 0.08 },
        pearl: { roughness: 0.22, metalness: 0.4 },
        satin: { roughness: 0.55, metalness: 0.04 },
        matte: { roughness: 0.9, metalness: 0 },
        metal: { roughness: 0.24, metalness: 0.88 },
      };
      // Corrugated steel for shipping containers: vertical ribs and a darker frame.
      const kitRibTexture = (() => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        const g = cv.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 64, 64);
        for (let x = 0; x < 64; x += 4) {
          g.fillStyle = '#c9c9c9';
          g.fillRect(x, 0, 1.5, 64);
        }
        g.strokeStyle = '#8a8a8a';
        g.lineWidth = 4;
        g.strokeRect(0, 0, 64, 64);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        return tx;
      })();
      KIT_FINISHES.ribbed = { roughness: 0.7, metalness: 0.2, map: kitRibTexture };
      const kitFinishMaterials = {};
      for (const [finish, settings] of Object.entries(KIT_FINISHES)) {
        const m = new Three.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: Three.DoubleSide, ...settings });
        m.userData.finish = finish;
        kitFinishMaterials[finish] = m;
      }
      const kitTints = new Map();
      function tint(color, finish = 'gloss') {
        const key = color + '|' + finish;
        let m = kitTints.get(key);
        if (!m) {
          m = new Three.MeshStandardMaterial({ color, side: Three.DoubleSide, ...KIT_FINISHES[finish] });
          m.userData.finish = finish;
          kitTints.set(key, m);
        }
        return m;
      }
      // Tinted glass: dark by day, warm lit cabins by night (updateBoatKitVisuals).
      const kitGlass = new Three.MeshStandardMaterial({
        color: '#131e27',
        roughness: 0.05,
        metalness: 0.8,
        emissive: '#ffc98c',
        emissiveIntensity: 0,
      });
      // Balcony glass on the liners: bluer and paler, lit cabins behind at night.
      const kitBalconyGlass = new Three.MeshStandardMaterial({
        color: '#34566b',
        roughness: 0.08,
        metalness: 0.6,
        emissive: '#ffd6a0',
        emissiveIntensity: 0,
      });
      // Bridge and wheelhouse glass stays cool and dim at night.
      const kitBridgeGlass = new Three.MeshStandardMaterial({
        color: '#0e1a22',
        roughness: 0.04,
        metalness: 0.85,
        emissive: '#6fa6c8',
        emissiveIntensity: 0,
      });
      const kitPoolWater = new Three.MeshStandardMaterial({
        color: '#48c3d6',
        roughness: 0.08,
        metalness: 0.1,
        emissive: '#1aa6c8',
        emissiveIntensity: 0.15,
      });
      const kitLamp = new Three.MeshBasicMaterial({ color: '#fff1cf' }),
        kitPortLamp = new Three.MeshBasicMaterial({ color: '#ff4a3c' }),
        kitStarboardLamp = new Three.MeshBasicMaterial({ color: '#3dff7a' });
      // Teak planking with black caulking, planks running fore and aft.
      function makeTeakTexture(base, seam) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const g = cv.getContext('2d');
        g.fillStyle = base;
        g.fillRect(0, 0, 256, 256);
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let row = 0; row < 16; row++) {
          // Each plank a slightly different honey tone, with butt joints staggered.
          for (let x = -((row * 37) % 128); x < 256; x += 128) {
            g.fillStyle = `rgba(${rnd() > 0.5 ? '255,236,200' : '70,40,20'},${0.05 + rnd() * 0.09})`;
            g.fillRect(x, row * 16, 128, 16);
            g.fillStyle = seam;
            g.fillRect(x, row * 16, 2, 16);
          }
          for (let k = 0; k < 6; k++) {
            g.fillStyle = `rgba(90,55,30,${0.05 + rnd() * 0.06})`;
            g.fillRect(rnd() * 256, row * 16 + 3 + rnd() * 10, 20 + rnd() * 60, 1);
          }
          g.fillStyle = seam;
          g.fillRect(0, row * 16 + 14.5, 256, 1.5);
        }
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.anisotropy = 4;
        return tx;
      }
      const kitTeak = new Three.MeshStandardMaterial({ map: makeTeakTexture('#b28a5a', '#5b4631'), roughness: 0.78 });
      // Pale, sun-bleached teak for working boats and older yachts.
      const kitTeakPale = new Three.MeshStandardMaterial({ map: makeTeakTexture('#cdb792', '#6b5a45'), roughness: 0.85 });
      // Varnished mahogany with pale seams, for classic launches (a Riva's deck).
      const kitMahogany = new Three.MeshStandardMaterial({ map: makeTeakTexture('#6a2e19', '#e6d8b8'), roughness: 0.22, metalness: 0.05 });
      // Non-slip moulded deck on sports boats and the drivable speedboats.
      const kitNonSlip = new Three.MeshStandardMaterial({ color: '#e9e6dc', roughness: 0.92 });
      const KIT_TEAK_SCALE = 1 / 44;

      /* ---- Geometry assembly ---------------------------------------------------- */
      // A small builder for indexed triangle soups with optional colours and UVs.
      function kitMeshData() {
        return { positions: [], colors: [], uvs: [], indices: [] };
      }
      function kitVertex(data, x, y, z, color, u = 0, v = 0) {
        data.positions.push(x, y, z);
        if (color) data.colors.push(color.r, color.g, color.b);
        data.uvs.push(u, v);
        return data.positions.length / 3 - 1;
      }
      function kitGeometry(data) {
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(data.positions, 3));
        if (data.colors.length) geo.setAttribute('color', new Three.Float32BufferAttribute(data.colors, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(data.uvs, 2));
        geo.setIndex(data.indices);
        geo.computeVertexNormals();
        return geo;
      }
      const kitColorCache = new Map();
      function kitColor(hex) {
        let c = kitColorCache.get(hex);
        if (!c) kitColorCache.set(hex, (c = new Three.Color(hex)));
        return c;
      }

      /* ---- Hull lofting --------------------------------------------------------- */
      /**
       * Hull spec (all lengths in world units):
       *   length, beam, draft      overall length, maximum beam, keel depth
       *   form                     plan shape for hullPlanFraction() (marina.js)
       *   sheer                    height of the deck edge: a number, a table of
       *                            [t, z] points (t = -0.5 stern .. 0.5 stem) or a
       *                            function of t
       *   rake, forefoot           stem overhang and the run of the forefoot, as
       *                            fractions of the length
       *   stemCurve                <1 bows the stem out (spoon), >1 hollows it (clipper)
       *   keelRise                 fraction of the draft the keel rises at the transom
       *   bilge                    section shape below the waterline: 1 V, 2 round, 4 box
       *   flare                    how much narrower the bow is at the waterline than at deck
       *   tuck                     same for the quarters
       *   colors                   { bottom, boot, top, bands: [[f0, f1, color], ...] }
       *                            bands are fractions of the topside height, 0 at the
       *                            boot top and 1 at the sheer, so a cove stripe follows
       *                            the sheer
       *   boot                     [lo, hi] heights of the boot-top stripe
       *   transomColor             optional colour for the transom face
       */
      function hullSheer(spec, t) {
        const s = spec.sheer;
        if (typeof s === 'number') return s;
        if (typeof s === 'function') return s(t);
        if (t <= s[0][0]) return s[0][1];
        for (let i = 1; i < s.length; i++)
          if (t <= s[i][0]) {
            const [t0, z0] = s[i - 1],
              [t1, z1] = s[i];
            return z0 + ((z1 - z0) * (t - t0)) / Math.max(1e-6, t1 - t0);
          }
        return s[s.length - 1][1];
      }
      function hullKeel(spec, t) {
        const d = spec.draft,
          rake = spec.rake ?? 0.04,
          ff = spec.forefoot ?? 0.14,
          tw = 0.5 - rake,
          ta = tw - ff;
        if (t >= tw - 1e-6) {
          const top = hullSheer(spec, 0.5);
          return rake > 0 ? top * Math.pow(clamp((t - tw) / rake, 0, 1), spec.stemCurve ?? 1) : top;
        }
        if (t > ta) {
          const q = (t - ta) / ff;
          return -d * (1 - q * q);
        }
        const flatAft = spec.flatAft ?? -0.15;
        if (t < flatAft) {
          const q = (flatAft - t) / (flatAft + 0.5);
          return -d * (1 - (spec.keelRise ?? 0.4) * q * q);
        }
        return -d;
      }
      function hullHalfWidth(spec, t, z, zBot, zTop) {
        const hbD = (spec.beam / 2) * (spec.plan ? spec.plan(t) : hullPlanFraction(spec.form || {}, t));
        if (zBot >= -0.01) return hbD * Math.pow(clamp((z - zBot) / Math.max(0.01, zTop - zBot), 0, 1), 0.55);
        const fwd = t > 0 ? Math.pow(t / 0.5, 1.5) : 0,
          aft = t < 0 ? Math.pow(-t / 0.5, 2) : 0;
        let hbW = hbD * (1 - (spec.flare ?? 0.22) * fwd - (spec.tuck ?? 0.05) * aft);
        // As the forefoot climbs to the surface the waterline closes to the stem.
        if (t > 0) hbW *= Math.min(1, Math.sqrt(-zBot / (spec.draft * 0.35)));
        if (z <= 0) {
          const q = clamp(z / zBot, 0, 1),
            k = spec.bilge ?? 2.2;
          return hbW * Math.pow(Math.max(0, 1 - Math.pow(q, k)), 1 / k);
        }
        return hbW + (hbD - hbW) * Math.pow(clamp(z / Math.max(0.01, zTop), 0, 1), spec.flareCurve ?? 0.85);
      }
      // Half-beam of a hull at a height, at ship-local u: for placing fittings on it.
      function hullBeamAt(spec, u, z) {
        const t = clamp(u / spec.length, -0.5, 0.5),
          zBot = hullKeel(spec, t),
          zTop = hullSheer(spec, t);
        return hullHalfWidth(spec, t, clamp(z, zBot, zTop), zBot, zTop);
      }
      function hullStations(spec) {
        const n = spec.stations ?? 30,
          ts = new Set();
        // Cosine spacing puts more stations where the bow and stern curve.
        for (let i = 0; i <= n; i++) ts.add(+(-0.5 + (1 - Math.cos((i / n) * Math.PI)) / 2).toFixed(5));
        if (Array.isArray(spec.sheer))
          for (const [t] of spec.sheer) if (t > -0.5 && t < 0.5) ts.add(+t.toFixed(5));
        const tw = 0.5 - (spec.rake ?? 0.04);
        if (tw < 0.5) ts.add(+tw.toFixed(5));
        return [...ts].sort((a, b) => a - b);
      }
      function loftHull(spec) {
        const colors = spec.colors,
          boot = spec.boot || [-2.6, 0.6],
          stations = hullStations(spec),
          data = kitMeshData();
        // Section rows, keel to sheer. Duplicated rows make colour edges crisp.
        const rows = [];
        for (const f of [1, 0.72, 0.46, 0.26, 0.1, 0]) rows.push({ kind: 'below', f, color: colors.bottom });
        rows.push({ kind: 'z', z: boot[0], color: colors.boot || colors.bottom });
        rows.push({ kind: 'z', z: boot[1], color: colors.boot || colors.bottom });
        const bands = colors.bands || [],
          bandAt = (f) => {
            let c = colors.top;
            for (const [f0, f1, color] of bands) if (f > f0 && f < f1) c = color;
            return c;
          },
          edges = new Set([0, 0.16, 0.34, 0.52, 0.7, 0.86, 1]);
        for (const [f0, f1] of bands) edges.add(f0).add(f1);
        for (const f of [...edges].sort((a, b) => a - b)) {
          const below = bandAt(f - 1e-4),
            above = bandAt(f + 1e-4);
          if (f > 0 && below !== above) rows.push({ kind: 'above', f, color: below });
          rows.push({ kind: 'above', f, color: f >= 1 ? below : above });
        }
        const nr = rows.length,
          ns = stations.length,
          rowZ = new Array(nr);
        const ring = (t) => {
          const zBot = hullKeel(spec, t),
            zTop = Math.max(hullSheer(spec, t), zBot + 0.01),
            zb = clamp(boot[1], zBot, zTop);
          let last = -Infinity;
          for (let j = 0; j < nr; j++) {
            const r = rows[j];
            let z = r.kind === 'z' ? r.z : r.kind === 'below' ? boot[0] + (zBot - boot[0]) * r.f : zb + (zTop - zb) * r.f;
            z = Math.max(clamp(z, zBot, zTop), last);
            rowZ[j] = last = z;
          }
          return { zBot, zTop };
        };
        for (const side of [1, -1]) {
          const base = data.positions.length / 3;
          for (const t of stations) {
            const { zBot, zTop } = ring(t),
              u = t * spec.length;
            for (let j = 0; j < nr; j++) {
              const v = hullHalfWidth(spec, t, rowZ[j], zBot, zTop);
              kitVertex(data, u, rowZ[j], side * v, kitColor(rows[j].color), u / 40, rowZ[j] / 40);
            }
          }
          for (let i = 0; i < ns - 1; i++)
            for (let j = 0; j < nr - 1; j++) {
              const a = base + i * nr + j,
                b = base + (i + 1) * nr + j,
                c = b + 1,
                d = a + 1;
              if (side > 0) data.indices.push(a, b, c, a, c, d);
              else data.indices.push(a, c, b, a, d, c);
            }
        }
        // Transom: a fan across the aftmost section.
        if ((spec.form?.transom ?? 0.85) > 0.02 || spec.plan) {
          const t = stations[0],
            { zBot, zTop } = ring(t),
            u = t * spec.length,
            transomColor = spec.transomColor ? kitColor(spec.transomColor) : null,
            outline = [];
          for (let j = 0; j < nr; j++) outline.push([rowZ[j], hullHalfWidth(spec, t, rowZ[j], zBot, zTop), rows[j].color]);
          const centre = kitVertex(data, u, (zBot + zTop) / 2, 0, transomColor || kitColor(colors.top), 0, 0),
            loop = [...outline.map(([z, v, c]) => [z, v, c]), ...outline.reverse().map(([z, v, c]) => [z, -v, c])],
            first = data.positions.length / 3;
          for (const [z, v, c] of loop) kitVertex(data, u, z, v, transomColor || kitColor(c), v / 40, z / 40);
          for (let k = 0; k < loop.length - 1; k++) data.indices.push(centre, first + k, first + k + 1);
        }
        const geo = kitGeometry(data);
        geo.userData.spec = spec;
        return geo;
      }
      // The hull as a mesh: gloss vertex-colour paint unless the spec asks otherwise.
      function hullMesh(parent, spec) {
        const m = mesh(loftHull(spec), kitFinishMaterials[spec.finish || 'gloss'], parent, 0, 0, 0);
        m.userData.hullSpec = spec;
        return m;
      }
      /* A painted stripe hugging a hull between two heights, standing `outset`
         proud of the skin: boot tops and cove lines on single-colour hulls. */
      function hullBand(parent, spec, z0, z1, material, outset = 0.15, t0 = -0.5, t1 = 0.5) {
        const data = kitMeshData(),
          ts = [t0, ...hullStations(spec).filter((t) => t > t0 && t < t1), t1];
        for (const side of [1, -1]) {
          const base = data.positions.length / 3;
          for (const t of ts) {
            const zBot = hullKeel(spec, t),
              zTop = Math.max(hullSheer(spec, t), zBot + 0.01),
              a = clamp(z0, zBot, zTop),
              b = clamp(z1, zBot, zTop),
              u = t * spec.length;
            kitVertex(data, u, a, side * (hullHalfWidth(spec, t, a, zBot, zTop) + outset));
            kitVertex(data, u, b, side * (hullHalfWidth(spec, t, b, zBot, zTop) + outset));
          }
          for (let i = 0; i < ts.length - 1; i++) {
            const a = base + i * 2,
              b = a + 2;
            if (side > 0) data.indices.push(a, b, b + 1, a, b + 1, a + 1);
            else data.indices.push(a, b + 1, b, a, a + 1, b + 1);
          }
        }
        return mesh(kitGeometry(data), material, parent, 0, 0, 0);
      }
      /**
       * A flat deck inside a hull at height z between u0 and u1, inset from the
       * hull side. Teak planks run fore and aft. `raise(t)` optionally lifts parts
       * of the deck (a raised foredeck) and `widthAt(t)` overrides the edge.
       */
      function hullDeck(parent, spec, z, u0, u1, inset = 0, material = kitTeak) {
        const data = kitMeshData(),
          L = spec.length,
          ts = [u0 / L, ...hullStations(spec).filter((t) => t > u0 / L && t < u1 / L), u1 / L];
        for (const t of ts) {
          const u = t * L,
            hw = Math.max(0, hullBeamAt(spec, u, z) - inset);
          kitVertex(data, u, z, -hw, null, u * KIT_TEAK_SCALE, -hw * KIT_TEAK_SCALE);
          kitVertex(data, u, z, hw, null, u * KIT_TEAK_SCALE, hw * KIT_TEAK_SCALE);
        }
        for (let i = 0; i < ts.length - 1; i++) {
          const p = i * 2,
            s = p + 1,
            p2 = p + 2,
            s2 = p + 3;
          data.indices.push(p, s, s2, p, s2, p2);
        }
        return mesh(kitGeometry(data), material, parent, 0, 0, 0);
      }
      // Points along the deck edge of a hull, for rails, fenders and lights.
      function hullEdge(spec, z, u0, u1, inset, step = 8) {
        const pts = [];
        const n = Math.max(1, Math.round((u1 - u0) / step));
        for (let i = 0; i <= n; i++) {
          const u = u0 + ((u1 - u0) * i) / n;
          pts.push([u, Math.max(0, hullBeamAt(spec, u, z) - inset)]);
        }
        return pts;
      }

      /* ---- Deckhouses, slabs and glazing -------------------------------------- */
      function outlineArea(pts) {
        let a = 0;
        for (let i = 0; i < pts.length; i++) {
          const [x0, y0] = pts[i],
            [x1, y1] = pts[(i + 1) % pts.length];
          a += x0 * y1 - x1 * y0;
        }
        return a / 2;
      }
      // Push an outline out (positive d) or in along its vertex normals.
      function offsetOutline(pts, d) {
        const sign = outlineArea(pts) > 0 ? 1 : -1,
          n = pts.length;
        return pts.map((p, i) => {
          const a = pts[(i - 1 + n) % n],
            b = pts[(i + 1) % n];
          let e1x = p[0] - a[0],
            e1y = p[1] - a[1],
            e2x = b[0] - p[0],
            e2y = b[1] - p[1];
          const l1 = Math.hypot(e1x, e1y) || 1,
            l2 = Math.hypot(e2x, e2y) || 1;
          // Outward normal of an edge (dx, dy) for an anticlockwise outline is (dy, -dx).
          let nx = (e1y / l1 + e2y / l2) * sign,
            ny = (-e1x / l1 - e2x / l2) * sign;
          const ln = Math.hypot(nx, ny) || 1;
          nx /= ln;
          ny /= ln;
          const cosHalf = Math.max(0.45, (nx * e1y * sign - ny * e1x * sign) / l1 || 1);
          return [p[0] + (nx * d) / cosHalf, p[1] + (ny * d) / cosHalf];
        });
      }
      function lerpOutline(a, b, f) {
        return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * f, p[1] + (b[i][1] - p[1]) * f]);
      }
      /**
       * Walls between two outlines with the same number of points (the top one may
       * be raked back or tucked in), optionally capped top and bottom. Faceted:
       * each wall panel gets its own normal. Returns a BufferGeometry.
       */
      function prismGeometry(bottom, top, z0, z1, capTop = true, capBottom = false, uvScale = 0, holes = []) {
        const positions = [],
          uvs = [],
          n = bottom.length,
          cu = bottom.reduce((s, p) => s + p[0], 0) / n,
          cv = bottom.reduce((s, p) => s + p[1], 0) / n;
        const tri = (a, b, c, outward) => {
          // Orient each triangle so its normal faces `outward` (a direction vector).
          const ux = b[0] - a[0],
            uy = b[1] - a[1],
            uz = b[2] - a[2],
            vx = c[0] - a[0],
            vy = c[1] - a[1],
            vz = c[2] - a[2],
            nx = uy * vz - uz * vy,
            ny = uz * vx - ux * vz,
            nz = ux * vy - uy * vx;
          const flip = nx * outward[0] + ny * outward[1] + nz * outward[2] < 0;
          for (const p of flip ? [a, c, b] : [a, b, c]) {
            positions.push(p[0], p[1], p[2]);
            uvs.push(uvScale ? p[0] * uvScale : 0, uvScale ? p[2] * uvScale : 0);
          }
        };
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n,
            b0 = [bottom[i][0], z0, bottom[i][1]],
            b1 = [bottom[j][0], z0, bottom[j][1]],
            t0 = [top[i][0], z1, top[i][1]],
            t1 = [top[j][0], z1, top[j][1]],
            mid = [(bottom[i][0] + bottom[j][0]) / 2 - cu, 0, (bottom[i][1] + bottom[j][1]) / 2 - cv];
          if (Math.hypot(b1[0] - b0[0], b1[2] - b0[2]) < 1e-4) continue;
          tri(b0, b1, t1, mid);
          tri(b0, t1, t0, mid);
        }
        const cap = (outline, z, up) => {
          const all = [outline, ...holes].flat(),
            faces = Three.ShapeUtils.triangulateShape(
              outline.map((p) => new Three.Vector2(p[0], p[1])),
              holes.map((h) => h.map((p) => new Three.Vector2(p[0], p[1]))),
            );
          for (const [a, b, c] of faces)
            tri([all[a][0], z, all[a][1]], [all[b][0], z, all[b][1]], [all[c][0], z, all[c][1]], [0, up, 0]);
        };
        if (capTop) cap(top, z1, 1);
        if (capBottom) cap(bottom, z0, -1);
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.computeVertexNormals();
        return geo;
      }
      /**
       * A deckhouse: walls from z0 to z1 on `outline`, the top pulled back by
       * `rake` at the front and tucked in by `tumble`, then a glazing band wrapped
       * round it and a roof. Returns { bottom, top } outlines for further trim.
       */
      function deckhouse(parent, outline, z0, z1, opts = {}) {
        const { rake = 0, rakeAft = 0, tumble = 0, paint = tint('#f4f4f0'), glassFrom = 0.3, glassTo = 0.76, glazing = kitGlass, roof = true, mullions = 0 } = opts;
        const umax = Math.max(...outline.map((p) => p[0])),
          umin = Math.min(...outline.map((p) => p[0])),
          halfWidth = Math.max(1, ...outline.map((p) => Math.abs(p[1]))),
          top = outline.map(([u, v]) => {
            // Pull the front back by `rake` and the aft end forward by `rakeAft`,
            // blending so the sides stay straight.
            const f = (u - umin) / Math.max(1, umax - umin);
            return [u - rake * Math.pow(f, 3) + rakeAft * Math.pow(1 - f, 3), v * (1 - tumble / halfWidth)];
          });
        mesh(prismGeometry(outline, top, z0, z1, roof), paint, parent, 0, 0, 0);
        if (glazing && glassTo > glassFrom) {
          const za = z0 + (z1 - z0) * glassFrom,
            zb = z0 + (z1 - z0) * glassTo,
            ringA = offsetOutline(lerpOutline(outline, top, glassFrom), 0.35),
            ringB = offsetOutline(lerpOutline(outline, top, glassTo), 0.35);
          mesh(prismGeometry(ringA, ringB, za, zb, false), glazing, parent, 0, 0, 0);
          // Window mullions: slim white fins standing proud of the glass.
          if (mullions > 0) {
            const ring = offsetOutline(lerpOutline(outline, top, (glassFrom + glassTo) / 2), 0.5);
            let carry = mullions / 2;
            for (let i = 0; i < ring.length; i++) {
              const a = ring[i],
                b = ring[(i + 1) % ring.length],
                len = Math.hypot(b[0] - a[0], b[1] - a[1]);
              for (let d = carry; d < len; d += mullions) {
                const f = d / len;
                box(parent, a[0] + (b[0] - a[0]) * f, (za + zb) / 2, a[1] + (b[1] - a[1]) * f, 0.9, zb - za, 0.9, paint);
              }
              carry = (((carry - len) % mullions) + mullions) % mullions;
            }
          }
        }
        return { bottom: outline, top };
      }
