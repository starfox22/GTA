      // ---- Glasshouse ------------------------------------------------------------------
      // A point on a pane: 'side' (s 0 rear..1 front, t 0 base..1 roof, `side` ±1),
      // 'front' / 'rear' (s -1..1 across), 'roof' (s across, t rear..front).
      function glassPoint(g, l, w, pane, s, t, side = 1) {
        const half = (tt) => lerpNumber(g.wb, g.wt, tt) * w + g.bow * w * Math.sin(Math.PI * tt);
        if (pane === 'side') {
          const xb = lerpNumber(g.xb, g.xf, s) * l,
            xt = lerpNumber(g.rb, g.rf, s) * l;
          return [lerpNumber(xb, xt, t), lerpNumber(g.base, g.roof, t), side * half(t)];
        }
        if (pane === 'front' || pane === 'rear') {
          const front = pane === 'front',
            x = lerpNumber(front ? g.xf : g.xb, front ? g.rf : g.rb, t) * l + (front ? 1 : -0.5) * g.bulge * (1 - s * s) * (1 - t);
          return [x, lerpNumber(g.base, g.roof, t) + g.arch * (1 - s * s) * t * t, s * half(t)];
        }
        return [lerpNumber(g.rb, g.rf, t) * l, g.roof + g.arch * (1 - s * s), s * g.wt * w];
      }
      const policeCabins = new Map();
      // Five panes in PANE_ORDER (left, front, right, rear, roof), each its own
      // grid and material group, so damage3d.js cracks and bursts them one by one.
      function policeCabinGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (policeCabins.has(key)) return policeCabins.get(key);
        const g = body.glass,
          centreX = ((g.xf + g.xb + g.rf + g.rb) / 4) * l,
          inside = (p, out) => out.set(centreX, g.base, 0),
          panes =
            body.kind === 'bearcat'
              ? policeBearcatGlass(body, l, w)
              : [
                  gridGeometry(4, 2, (u, v) => glassPoint(g, l, w, 'side', u, v, -1), inside),
                  gridGeometry(6, 3, (u, v) => glassPoint(g, l, w, 'front', u * 2 - 1, v), inside),
                  gridGeometry(4, 2, (u, v) => glassPoint(g, l, w, 'side', u, v, 1), inside),
                  gridGeometry(6, 2, (u, v) => glassPoint(g, l, w, 'rear', u * 2 - 1, v), inside),
                  gridGeometry(4, 4, (u, v) => glassPoint(g, l, w, 'roof', u * 2 - 1, v), inside),
                ];
        const position = [],
          normal = [],
          uv = [],
          index = [],
          geo = new Three.BufferGeometry();
        panes.forEach((pane, i) => {
          const base = position.length / 3,
            start = index.length;
          position.push(...pane.attributes.position.array);
          normal.push(...pane.attributes.normal.array);
          uv.push(...pane.attributes.uv.array);
          for (const k of pane.index.array) index.push(base + k);
          geo.addGroup(start, index.length - start, i);
          pane.dispose();
        });
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('normal', new Three.Float32BufferAttribute(normal, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        geo.computeBoundingSphere();
        sharedGeometries.add(geo);
        policeCabins.set(key, geo);
        return geo;
      }
      /*
       * The BearCat's armoured glass on its slab body: two cab windows a side, the
       * split windscreen on the raked front, a vision slot over the rear doors and
       * the hatch's vision block, a hair outside the armour.
       */
      function policeBearcatGlass(body, l, w) {
        const slab = (w / 2) * 1.0 + 0.07,
          outwardX = (p, out) => out.set(p.x - 3, p.y, 0),
          sideWindows = (side) => {
            const parts = [];
            for (const [x0, x1] of [[0.02, 0.118], [-0.085, -0.005]]) parts.push([x0 * l, x1 * l]);
            // One grid spanning both windows would glaze the pillar: two thin grids joined in one pane.
            const grids = parts.map(([a, b]) => gridGeometry(1, 1, (u, v) => [lerpNumber(a, b, u), lerpNumber(15.2, 20.4, v), side * slab], (p, out) => out.set(p.x, p.y, 0)));
            return mergePaneGrids(grids);
          },
          [, topFront] = profileAt(body.profile, 0.135),
          [, footFront] = profileAt(body.profile, 0.205),
          front = [0.135 * l, topFront],
          foot = [0.205 * l, footFront],
          // Outward (forward and up) normal of the raked front.
          nx = front[1] - foot[1],
          ny = foot[0] - front[0],
          nl = Math.hypot(nx, ny),
          off = 0.07,
          windscreen = mergePaneGrids(
            [-1, 1].map((side) =>
              gridGeometry(
                1,
                1,
                (u, v) => {
                  const t = lerpNumber(0.12, 0.85, v),
                    x = lerpNumber(foot[0], front[0], t) + (nx / nl) * off,
                    y = lerpNumber(foot[1], front[1], t) + (ny / nl) * off;
                  return [x, y, side * lerpNumber(0.6, (w / 2) * 0.93 * 0.86, u)];
                },
                outwardX,
              ),
            ),
          ),
          rear = gridGeometry(1, 1, (u, v) => [-0.5 * l - 0.06, lerpNumber(20.3, 21.5, v), lerpNumber(-w * 0.34, w * 0.34, u)], (p, out) => out.set(p.x + 3, p.y, 0)),
          roof = gridGeometry(1, 1, (u, v) => [-0.13 * l + lerpNumber(-1.1, 1.1, u), 24.22, lerpNumber(-0.8, 0.8, v)], (p, out) => out.set(p.x, p.y - 3, 0));
        return [sideWindows(-1), windscreen, sideWindows(1), rear, roof];
      }
      function mergePaneGrids(grids) {
        const position = [],
          normal = [],
          uv = [],
          index = [];
        for (const g of grids) {
          const base = position.length / 3;
          position.push(...g.attributes.position.array);
          normal.push(...g.attributes.normal.array);
          uv.push(...g.attributes.uv.array);
          for (const k of g.index.array) index.push(base + k);
          g.dispose();
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('normal', new Three.Float32BufferAttribute(normal, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        return geo;
      }
      // ---- Swatch geometry -----------------------------------------------------------
      // A unit box sampling one solid swatch of the livery (hood, door, trunk lids).
      const policeSwatchBoxes = new Map();
      function swatchUv(index) {
        return [(index + 0.5) / 8, POLICE_SWATCH_BAND / 2];
      }
      function policeSwatchBox(index) {
        let geo = policeSwatchBoxes.get(index);
        if (geo) return geo;
        geo = boxGeo.clone();
        const uv = geo.attributes.uv,
          [u, v] = swatchUv(index);
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
        sharedGeometries.add(geo);
        policeSwatchBoxes.set(index, geo);
        return geo;
      }
      // ---- Livery textures ---------------------------------------------------------------
      const policeLiveryTextures = new Map(),
        LIVERY_W = 1024,
        LIVERY_H = 512;
      function policeCanvasTexture(canvas) {
        const tx = new Three.CanvasTexture(canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      /*
       * The livery painter's frame: canvas x along the car, canvas y for a height on
       * either side (the reference section's ring, so painted lines follow the body
       * as it tapers to the bumpers).
       */
      function liveryFrame(body, l, w) {
        const ring = policeRing(body),
          v = policeRingV(body, w),
          top = body.uvTop || body.h,
          heights = ring.map(([nh]) => body.yb + nh * (top - body.yb)),
          centre = (ring.length - 1) / 2,
          vSide = (y, side) => {
            const at = (j) => v[side < 0 ? j : ring.length - 1 - j];
            if (y <= heights[0]) return at(0);
            for (let j = 0; j < centre - 1; j++)
              if (y <= heights[j + 1]) return lerpNumber(at(j), at(j + 1), (y - heights[j]) / Math.max(1e-6, heights[j + 1] - heights[j]));
            return at(centre - 1);
          };
        const frame = {
          l,
          X: (x) => (x / l + 0.5) * LIVERY_W,
          Y: (y, side) => (1 - vSide(y, side)) * LIVERY_H,
          sides: [-1, 1],
        };
        // Canvas pixels per world unit along the car and up the side.
        frame.pxU = LIVERY_W / l;
        frame.pxV = Math.abs(frame.Y(7, 1) - frame.Y(6, 1));
        return frame;
      }
      function liveryBand(g, f, x0, x1, y0, y1, color) {
        g.fillStyle = color;
        for (const side of f.sides) {
          const ya = f.Y(y0, side),
            yb = f.Y(y1, side);
          g.fillRect(f.X(x0), Math.min(ya, yb), f.X(x1) - f.X(x0), Math.abs(yb - ya));
        }
      }
      // The top of the body between the shoulders at height y (hood, deck, trunk).
      function liveryTop(g, f, x0, x1, y, color) {
        const ya = f.Y(y, 1),
          yb = f.Y(y, -1);
        g.fillStyle = color;
        g.fillRect(f.X(x0), Math.min(ya, yb), f.X(x1) - f.X(x0), Math.abs(yb - ya));
      }
      function liveryPolygon(g, f, points, color) {
        g.fillStyle = color;
        for (const side of f.sides) {
          g.beginPath();
          points.forEach(([x, y], i) => (i ? g.lineTo(f.X(x), f.Y(y, side)) : g.moveTo(f.X(x), f.Y(y, side))));
          g.closePath();
          g.fill();
        }
      }
      // Draws `paint(g, pxPerUnit)` at (x, y) on both sides, upright and reading
      // front to back on the right and back to front on the left, as a sign writer would.
      function liveryDraw(g, f, x, y, paint) {
        for (const side of f.sides) {
          g.save();
          g.translate(f.X(x), f.Y(y, side));
          g.scale((side < 0 ? -1 : 1) * (f.pxU / f.pxV), side < 0 ? 1 : -1);
          paint(g, f.pxV);
          g.restore();
        }
      }
      function liveryText(g, f, text, x, y, height, color, { weight = 'bold', stretch = 1, spacing = 0, stroke = null } = {}) {
        liveryDraw(g, f, x, y, (c, px) => {
          c.scale(stretch, 1);
          c.font = `${weight} ${Math.round(height * px * 1.36)}px ${POLICE_FONT}`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          if (spacing && 'letterSpacing' in c) c.letterSpacing = `${Math.round(spacing * px)}px`;
          if (stroke) {
            c.lineWidth = stroke[1] * px;
            c.strokeStyle = stroke[0];
            c.lineJoin = 'round';
            c.strokeText(text, 0, 0);
          }
          c.fillStyle = color;
          c.fillText(text, 0, 0);
        });
      }
      function starPath(c, radius, points, inner) {
        c.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / points,
            r = i % 2 ? radius * inner : radius;
          if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath();
      }
      // A police star: gold points with a ball on each, a dark ring with the city seal.
      function liveryBadge(g, f, x, y, size, points, ring) {
        liveryDraw(g, f, x, y, (c, px) => {
          const r = (size / 2) * px;
          starPath(c, r, points, 0.52);
          c.fillStyle = '#b98f2f';
          c.fill();
          c.lineWidth = r * 0.06;
          c.strokeStyle = '#6d5418';
          c.stroke();
          starPath(c, r * 0.86, points, 0.52);
          c.fillStyle = '#e1bf5c';
          c.fill();
          for (let i = 0; i < points; i++) {
            const a = -Math.PI / 2 + (i * TAU) / points;
            c.beginPath();
            c.arc(Math.cos(a) * r, Math.sin(a) * r, r * 0.09, 0, TAU);
            c.fillStyle = '#e1bf5c';
            c.fill();
          }
          c.beginPath();
          c.arc(0, 0, r * 0.4, 0, TAU);
          c.fillStyle = ring;
          c.fill();
          c.beginPath();
          c.arc(0, 0, r * 0.26, 0, TAU);
          c.fillStyle = '#e1bf5c';
          c.fill();
          c.beginPath();
          c.arc(0, 0, r * 0.16, 0, TAU);
          c.fillStyle = ring;
          c.fill();
        });
      }
      // Door shut lines: thin dark seams from the sill to the waist.
      function liverySeams(g, f, xs, y0, y1, color = 'rgba(0,0,0,0.55)') {
        for (const x of xs) liveryBand(g, f, x - 0.045, x + 0.045, y0, y1, color);
      }
      function policeLiveryTexture(livery, body, l, w) {
        const key = livery + ':' + body.name + ':' + l + ':' + w;
        let tx = policeLiveryTextures.get(key);
        if (tx) return tx;
        const canvas = document.createElement('canvas');
        canvas.width = LIVERY_W;
        canvas.height = LIVERY_H;
        const g = canvas.getContext('2d'),
          spec = POLICE_LIVERIES[livery],
          f = liveryFrame(body, l, w),
          top = body.h + 2,
          sill = body.yb + 0.9,
          waist = body.yb + (body.h - body.yb) * 0.66;
        g.fillStyle = spec.base;
        g.fillRect(0, 0, LIVERY_W, LIVERY_H);
        if (livery === 'bw') {
          // White doors from the sill to the glass, cut by the wheel arches.
          liveryBand(g, f, -0.19 * l, 0.19 * l, 0, top, '#f1f2ef');
          liverySeams(g, f, [-0.19 * l, -0.005 * l, 0.19 * l], sill, body.h - 0.4);
          liveryText(g, f, 'POLICE', -0.035 * l, body.yb + 3.05, 1.8, '#0b0c0f', { stretch: 1.12, spacing: 0.12 });
          liveryText(g, f, 'SOUTH COAST', -0.035 * l, body.yb + 4.55, 0.62, '#0b0c0f', { stretch: 1.1, spacing: 0.1 });
          liveryBadge(g, f, 0.125 * l, body.yb + 3.35, 2.7, 7, '#1c2a55');
          liveryText(g, f, 'DIAL 911', -0.335 * l, waist, 0.55, '#e8e8e4', { stretch: 1.1 });
          liveryText(g, f, 'TO PROTECT AND TO SERVE', 0.31 * l, waist + 0.2, 0.42, '#e8e8e4', { weight: 'italic bold' });
        } else if (livery === 'modern') {
          const lo = body.yb + 0.9,
            hi = body.yb + 1.7;
          // A navy swoosh rising towards the tail, a sky-blue band and a reflective line.
          liveryPolygon(g, f, [[0.52 * l, lo], [-0.52 * l, lo + 0.6], [-0.52 * l, hi + 2.3], [0.52 * l, hi]], '#13295c');
          liveryPolygon(g, f, [[0.52 * l, hi], [-0.52 * l, hi + 2.3], [-0.52 * l, hi + 2.75], [0.52 * l, hi + 0.35]], '#3f8fd9');
          liveryPolygon(g, f, [[0.52 * l, hi + 0.35], [-0.52 * l, hi + 2.75], [-0.52 * l, hi + 2.98], [0.52 * l, hi + 0.52]], '#dfe6ec');
          liverySeams(g, f, [-0.19 * l, -0.005 * l, 0.19 * l], sill, body.h - 0.4, 'rgba(20,30,50,0.45)');
          liveryText(g, f, 'POLICE', -0.05 * l, body.yb + 4.05, 1.75, '#13295c', { stretch: 1.14, spacing: 0.14 });
          liveryText(g, f, 'SOUTH COAST', -0.03 * l, body.yb + 1.95, 0.6, '#f2f4f6', { stretch: 1.1, spacing: 0.1 });
          liveryBadge(g, f, 0.14 * l, body.yb + 4.0, 2.1, 7, '#13295c');
          liveryText(g, f, '911', -0.36 * l, body.yb + 4.1, 0.9, '#13295c', { stretch: 1.1 });
        } else if (livery === 'sheriff') {
          const band = body.yb + 2.75;
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, band, '#1d4a33');
          liveryTop(g, f, -0.6 * l, -0.29 * l, body.h - 0.6, '#1d4a33');
          liveryTop(g, f, 0.23 * l, 0.6 * l, body.h - 0.6, '#1d4a33');
          liveryBand(g, f, -0.6 * l, 0.6 * l, band, band + 0.24, '#c9a44a');
          liverySeams(g, f, [-0.19 * l, -0.005 * l, 0.19 * l], sill, body.h - 0.4, 'rgba(10,30,20,0.5)');
          liveryText(g, f, 'SHERIFF', -0.05 * l, body.yb + 4.0, 1.7, '#1d4a33', { stretch: 1.1, spacing: 0.14 });
          liveryText(g, f, 'SOUTH COAST COUNTY', -0.03 * l, body.yb + 1.55, 0.58, '#eef0ea', { stretch: 1.08, spacing: 0.08 });
          liveryBadge(g, f, 0.14 * l, body.yb + 4.0, 2.3, 6, '#1d4a33');
        } else if (livery === 'swat') {
          // Blacked armour low down, a grey reflective band, POLICE and SWAT on the box.
          liveryBand(g, f, -0.6 * l, 0.6 * l, 0, body.yb + 1.3, '#0f1319');
          liveryBand(g, f, -0.6 * l, 0.6 * l, 9.2, 10.0, '#98a2ae');
          liveryBand(g, f, -0.6 * l, 0.6 * l, 10.0, 10.12, '#5d6773');
          liveryText(g, f, 'POLICE', -0.19 * l, 17.0, 2.5, '#eef0ec', { stretch: 1.08, spacing: 0.2 });
          liveryText(g, f, 'S.W.A.T.', -0.2 * l, 13.2, 1.7, '#eef0ec', { stretch: 1.1, spacing: 0.2 });
          liveryText(g, f, 'SPECIAL WEAPONS AND TACTICS', -0.2 * l, 11.3, 0.62, '#b9c2cc', { stretch: 1.05 });
          liverySeams(g, f, [0.125 * l, 0.012 * l, -0.095 * l], 9.2, 21.5, 'rgba(0,0,0,0.6)');
          liveryBadge(g, f, 0.07 * l, 12.4, 2.4, 7, '#18202c');
        }
        // Panel swatches along the bottom band.
        spec.swatches.forEach((color, i) => {
          g.fillStyle = color;
          g.fillRect((i * LIVERY_W) / 8, LIVERY_H * (1 - POLICE_SWATCH_BAND), LIVERY_W / 8, LIVERY_H * POLICE_SWATCH_BAND);
        });
        tx = policeCanvasTexture(canvas);
        policeLiveryTextures.set(key, tx);
        return tx;
      }
      // Clear-coated livery paint shared by a body impostor pool (flight-view3d.js).
      const policeImpostorPaints = new Map();
      function policeImpostorPaint(texture) {
        let m = policeImpostorPaints.get(texture);
        if (!m) {
          m = new Three.MeshPhysicalMaterial({ map: texture, color: '#ffffff', roughness: 0.34, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08 });
          sharedMaterials.add(m);
          policeImpostorPaints.set(texture, m);
        }
        return m;
      }
      // ---- POLICE DECALS: unit numbers and words from one glyph atlas ---------------------
      // Letters in atlas order: the police set first, then the rest of the alphabet the
      // aircraft liveries use (helicopter3d.js: CH 7 NEWS, U.S. ARMY, registrations).
      const POLICE_GLYPHS = '0123456789ABCEFHIKLNOPRSTUW-.DGJMQVXYZ',
        GLYPH_CELL_W = 72,
        GLYPH_CELL_H = 128,
        GLYPHS_PER_ROW = 14;
      let policeGlyphAtlas = null;
      function policeGlyphs() {
        if (policeGlyphAtlas) return policeGlyphAtlas;
        const rows = Math.ceil(POLICE_GLYPHS.length / GLYPHS_PER_ROW),
          canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 128 * Math.pow(2, Math.ceil(Math.log2(rows)));
        const g = canvas.getContext('2d'),
          advance = {};
        g.fillStyle = '#ffffff';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = `bold 118px ${POLICE_FONT}`;
        [...POLICE_GLYPHS].forEach((ch, i) => {
          const cx = (i % GLYPHS_PER_ROW) * GLYPH_CELL_W + GLYPH_CELL_W / 2,
            cy = Math.floor(i / GLYPHS_PER_ROW) * GLYPH_CELL_H + GLYPH_CELL_H / 2 + 4;
          g.save();
          g.translate(cx, cy);
          g.scale(0.74, 1);
          g.fillText(ch, 0, 0);
          g.restore();
          advance[ch] = (g.measureText(ch).width * 0.74) / GLYPH_CELL_H;
        });
        const texture = policeCanvasTexture(canvas),
          material = new Three.MeshStandardMaterial({
            map: texture,
            vertexColors: true,
            alphaTest: 0.5,
            roughness: 0.42,
            metalness: 0.05,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -4,
          });
        sharedMaterials.add(material);
        policeGlyphAtlas = { advance, material, height: canvas.height };
        return policeGlyphAtlas;
      }
      // Writes `text` into a decal set: centred on `origin`, running along `right`,
      // glyphs standing along `up` (cell height `height`); `lift(x, z)` follows a curve.
      function decalText(set, text, origin, right, up, height, color, lift) {
        const atlas = policeGlyphs(),
          spacing = height * 0.06,
          chars = [...text].filter((ch) => POLICE_GLYPHS.includes(ch)),
          advance = (ch) => atlas.advance[ch] * height;
        let total = -spacing;
        for (const ch of chars) total += advance(ch) + spacing;
        let cursor = -total / 2;
        const quad = (GLYPH_CELL_W / GLYPH_CELL_H) * height,
          nx = right[1] * up[2] - right[2] * up[1],
          ny = right[2] * up[0] - right[0] * up[2],
          nz = right[0] * up[1] - right[1] * up[0];
        policeColor.set(color);
        for (const ch of chars) {
          const i = POLICE_GLYPHS.indexOf(ch),
            u0 = ((i % GLYPHS_PER_ROW) * GLYPH_CELL_W) / 1024,
            u1 = u0 + GLYPH_CELL_W / 1024,
            v1 = 1 - (Math.floor(i / GLYPHS_PER_ROW) * GLYPH_CELL_H) / atlas.height,
            v0 = v1 - GLYPH_CELL_H / atlas.height,
            centre = cursor + advance(ch) / 2,
            base = set.count;
          for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
            const along = centre + a * quad,
              x = origin[0] + right[0] * along + up[0] * b * height,
              z = origin[2] + right[2] * along + up[2] * b * height;
            let y = origin[1] + right[1] * along + up[1] * b * height;
            if (lift) y += lift(x, z);
            set.position.push(x, y, z);
            set.normal.push(nx, ny, nz);
            set.uv.push(a < 0 ? u0 : u1, b < 0 ? v0 : v1);
            set.color.push(policeColor.r, policeColor.g, policeColor.b);
            set.channel.push(0);
          }
          set.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
          set.count += 4;
          cursor += advance(ch) + spacing;
        }
      }
      // A text's run per unit of glyph cell height (decalText's layout).
      function decalLength(text) {
        const atlas = policeGlyphs(),
          chars = [...text].filter((ch) => POLICE_GLYPHS.includes(ch));
        return chars.reduce((sum, ch) => sum + atlas.advance[ch] + 0.06, -0.06);
      }
      const policeDecalGeometries = new Map();
      // Roof number (aerial ID), trunk and rear-fender numbers for one unit.
      function policeDecalGeometry(look, body, l, w, kit) {
        const key = look.key + ':' + look.unit + ':' + l + ':' + w;
        if (policeDecalGeometries.has(key)) return policeDecalGeometries.get(key);
        const set = policeSet(),
          spec = POLICE_LIVERIES[look.livery],
          roof = kit.roofDecal;
        if (roof) {
          // Read along the car, glyphs standing towards its left: a car heading east
          // reads upright. As tall as the roof allows for the text's length.
          const text = body.kind === 'bearcat' ? 'SWAT' : look.unit,
            ratio = decalLength(text);
          decalText(set, text, [roof.x, roof.y, 0], [1, 0, 0], [0, 0, -1], Math.min(roof.width, roof.length / ratio), spec.roofDigits, roof.lift);
        }
        if (body.trunk) {
          const x = body.trunk * l,
            top = profileAt(body.profile, body.trunk)[1];
          decalText(set, look.unit, [x, top + 0.04, 0], [0, 0, 1], [1, 0, 0], 3.1, spec.roofDigits);
        }
        if (body.kind !== 'bearcat')
          for (const side of [-1, 1]) {
            const x = -0.365 * l,
              y = body.yb + (body.h - body.yb) * 0.6,
              { half } = policeShellAt(body, l, w, x, y);
            decalText(set, look.unit, [x, y, side * (half + 0.06)], [side, 0, 0], [0, 1, 0], 1.7, spec.sideDigits);
          }
        const geo = policeGeometry(set);
        policeDecalGeometries.set(key, geo);
        return geo;
      }
      // ---- POLICE LIGHTS ------------------------------------------------------------------
      const POLICE_LIGHT_VERTEX = `
        #include <common>
        #include <fog_pars_vertex>
        attribute float lightChannel;
        uniform float levels[ 8 ];
        varying vec3 vLens;
        varying float vLevel;
        void main() {
          #ifdef USE_COLOR
            vLens = color;
          #else
            vLens = vec3( 1.0 );
          #endif
          float level = 0.0;
          for ( int i = 0; i < 8; i++ ) if ( float( i ) == lightChannel ) level = levels[ i ];
          vLevel = level;
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
        POLICE_LIGHT_FRAGMENT = `
        #include <common>
        #include <fog_pars_fragment>
        uniform float gain;
        varying vec3 vLens;
        varying float vLevel;
        void main() {
          // Unlit: the tinted lens under clear plastic. Lit: the LED at scene
          // brightness well past the bloom threshold.
          vec3 off = vLens * 0.32 + vec3( 0.05 );
          gl_FragColor = vec4( mix( off, vLens * gain, vLevel ), 1.0 );
          #include <fog_fragment>
        }`;
      // One per model: its own channel levels; the gain is shared by all.
      function policeLightMaterial() {
        return new Three.ShaderMaterial({
          uniforms: { ...Three.UniformsUtils.clone(Three.UniformsLib.fog), levels: { value: new Float32Array(8) }, gain: policeLightGain },
          vertexShader: POLICE_LIGHT_VERTEX,
          fragmentShader: POLICE_LIGHT_FRAGMENT,
          vertexColors: true,
          fog: true,
        });
      }
      /*
       * Light channels: 0 left outer (red), 1 left inner (red), 2 right inner
       * (blue), 3 right outer (blue), 4 white takedowns and alley lights, 5 left
       * push-bar / grille / rear LEDs (red), 6 the right ones (blue), 7 running
       * lights. Returns 0 (off), 1 (pursuit) or 2 (parked at a scene).
       */
      function policeLightMode(c) {
        if (c.hp <= 0) return 0;
        const responding = (c.cop && wantedStars > 0) || c.airUnit || c.gangTarget || c.showLights;
        if (!responding) return 0;
        if (c.showLights === 'pursuit') return 1;
        return c.blockade || c.crewDeployed || c.showLights || Math.abs(c.speed || 0) < 12 ? 2 : 1;
      }
      function pulses(p, count, on, gap) {
        if (p < 0) return 0;
        const period = on + gap,
          k = Math.floor(p / period);
        return k < count && p - k * period < on ? 1 : 0;
      }
      const POLICE_SWEEP = [0, 1, 2, 3, 2, 1];
      function policeLightLevels(c, out, time) {
        out.fill(0);
        out[7] = c.hp > 0 ? 1 : 0;
        const mode = policeLightMode(c);
        if (!mode) return 0;
        const t = time + (c.id % 17) * 0.37;
        if (mode === 2) {
          // Parked: slow side-to-side double flashes, takedowns lighting the scene.
          const p = t % 1.2,
            left = pulses(p, 2, 0.14, 0.1),
            right = pulses(p - 0.6, 2, 0.14, 0.1);
          out[0] = out[1] = out[6] = left;
          out[2] = out[3] = out[5] = right;
          out[4] = 0.55;
          return 2;
        }
        const pattern = Math.floor(t / 4.2) % 3;
        if (pattern === 0) {
          // Quad flashes, side to side.
          const p = t % 0.56,
            left = pulses(p, 3, 0.05, 0.043),
            right = pulses(p - 0.28, 3, 0.05, 0.043);
          out[0] = out[1] = out[6] = left;
          out[2] = out[3] = out[5] = right;
        } else if (pattern === 1) {
          // Double flashes, criss-cross: outer pair, then inner pair.
          const p = t % 0.72,
            outer = pulses(p, 2, 0.07, 0.05),
            inner = pulses(p - 0.36, 2, 0.07, 0.05);
          out[0] = out[3] = out[5] = outer;
          out[1] = out[2] = out[6] = inner;
        } else {
          // A sweep out and back across the bar, the LEDs below alternating.
          const step = Math.floor((t % 0.9) / 0.15),
            lit = POLICE_SWEEP[step];
          out[lit] = 1;
          if (lit > 0) out[lit - 1] = Math.max(out[lit - 1], 0.3);
          if (lit < 3) out[lit + 1] = Math.max(out[lit + 1], 0.3);
          out[5] = step < 3 ? 1 : 0;
          out[6] = 1 - out[5];
        }
        // White takedowns pop in on the beat.
        out[4] = pulses(t % 1.1, 2, 0.04, 0.05) * 0.85;
        return 1;
      }
