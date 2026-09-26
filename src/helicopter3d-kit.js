      // Helicopter kit: every shared geometry of one look (heliKit, heliKits).
      // ---- The kit: every shared geometry of one look ------------------------------------------
      // Geometry depends only on the kind (paint and scheme are the livery's), so the
      // civil schemes, executive paints and resprays share one kit.
      const heliKits = new Map();
      function heliKit(look) {
        if (heliKits.has(look.kind)) return heliKits.get(look.kind);
        const plan = heliPlans()[look.airframe],
          S = policeShapeKit(),
          col = (hex) => heliColor.set(hex).clone(),
          paint = policeSet(),
          glass = policeSet(),
          interior = policeSet(),
          trim = policeSet(),
          metal = policeSet(),
          lights = policeSet(),
          anchors = [],
          xs = heliSamples(plan),
          stationAt = (x) => heliStation(plan, x),
          grid = heliLoftGrid(stationAt, xs, plan.segments),
          liner = col(look.liner);
        // ---- Fuselage: painted skin and flush glazing from one loft ----
        const { P, N, rows, cols } = grid,
          span = plan.x1 - plan.x0,
          vertexOf = (set, i, j, uvOn) => {
            const k = (i * cols + j) * 3;
            return heliPushVertex(set, P[k], P[k + 1], P[k + 2], N[k], N[k + 1], N[k + 2], uvOn ? (P[k] - plan.x0) / span : 0, uvOn ? HELI_BAND + ((1 - HELI_BAND) * j) / (cols - 1) : 0, liner);
          };
        const skinBase = paint.count;
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) vertexOf(paint, i, j, true);
        const cabin = plan.cabin,
          probe = { y: 0, z: 0 };
        for (let i = 0; i < rows - 1; i++)
          for (let j = 0; j < cols - 1; j++) {
            const a = i * cols + j,
              b = (i + 1) * cols + j,
              c = (i + 1) * cols + j + 1,
              d = i * cols + j + 1,
              cx = (P[a * 3] + P[c * 3]) / 2,
              cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1] + P[d * 3 + 1]) / 4,
              cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2] + P[d * 3 + 2]) / 4,
              st = stationAt(cx);
            if (plan.windows(cx, cy, cz, st, look.roofGlass) < 0) {
              const g0 = vertexOf(glass, i, j),
                g1 = vertexOf(glass, i + 1, j),
                g2 = vertexOf(glass, i + 1, j + 1),
                g3 = vertexOf(glass, i, j + 1);
              glass.index.push(g0, g1, g2, g0, g2, g3);
              continue;
            }
            paint.index.push(skinBase + a, skinBase + b, skinBase + c, skinBase + a, skinBase + c, skinBase + d);
            // The cabin's liner: the skin seen from inside, a little in and facing in.
            if (cx > cabin.back && cy > cabin.floor - 0.4) {
              const base = interior.count;
              for (const q of [a, d, c, b]) {
                const k = q * 3;
                heliPushVertex(interior, P[k] - N[k] * 0.3, P[k + 1] - N[k + 1] * 0.3, P[k + 2] - N[k + 2] * 0.3, -N[k], -N[k + 1], -N[k + 2], 0, 0, liner);
              }
              interior.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
        // End caps (tiny: the loft closes almost to a point at both ends).
        for (const [i, dir] of [
          [0, -1],
          [rows - 1, 1],
        ]) {
          const k0 = i * cols * 3,
            centre = heliPushVertex(paint, P[k0] + dir * 0.12, stationAt(P[k0]).yw, 0, dir, 0, 0, (P[k0] - plan.x0) / span, HELI_BAND + (1 - HELI_BAND) / 2, liner);
          for (let j = 0; j < cols - 1; j++) {
            const p0 = skinBase + i * cols + j,
              p1 = p0 + 1;
            if (dir > 0) paint.index.push(p1, p0, centre);
            else paint.index.push(p0, p1, centre);
          }
        }
        // ---- Floor and the bulkhead behind the cabin ----
        {
          const floorColor = col('#1c1e21'),
            y = cabin.floor,
            fx = xs.filter((x) => x >= cabin.back && x <= cabin.front);
          let prev = null;
          for (const x of fx) {
            const st = stationAt(x);
            if (y <= st.yb + 0.2) continue;
            const half = Math.max(0, heliSurfaceZ(st, y, 1) - 0.35),
              left = heliPushVertex(interior, x, y, -half, 0, 1, 0, 0, 0, floorColor),
              right = heliPushVertex(interior, x, y, half, 0, 1, 0, 0, 0, floorColor);
            if (prev) interior.index.push(prev[0], right, left, prev[0], prev[1], right);
            prev = [left, right];
          }
          const st = stationAt(cabin.back),
            centre = heliPushVertex(interior, cabin.back, st.yw, 0, 1, 0, 0, 0, 0, liner),
            ring = [];
          for (let j = 0; j <= 32; j++) {
            heliSection(st, (j / 32) * TAU - Math.PI / 2, probe);
            ring.push(heliPushVertex(interior, cabin.back, probe.y * 0.97 + st.yw * 0.03, probe.z * 0.95, 1, 0, 0, 0, 0, liner));
          }
          for (let j = 0; j < 32; j++) interior.index.push(centre, ring[j + 1], ring[j]);
        }
        // ---- Cowlings / fairings / nacelles on top ----
        // The first `art` top is lofted into the livery (its own columns of the bottom
        // band, painted by the scheme like the fuselage); the rest take a swatch.
        let cowl = null;
        for (const top of plan.tops) {
          const txs = [];
          for (let k = 0; k <= 26; k++) txs.push(top.x0 + ((top.x1 - top.x0) * k) / 26);
          const topStation = (x) => {
              const crown = top.yt(x),
                w = Math.max(0.03, top.w(x));
              if (top.round) {
                const r = Math.max(0.03, crown - (23.8 - 2.7));
                return { x, yb: crown - 2 * Math.min(w, r), yt: crown, yw: crown - Math.min(w, r), w, nu: 2, nl: 2 };
              }
              const floor = stationAt(x).yt - top.sink;
              return { x, yb: floor - 0.6, yt: Math.max(crown, floor + 0.2), yw: floor + 0.35 * Math.max(0.2, crown - floor), w, nu: 2.6, nl: 2 };
            },
            tg = heliLoftGrid(topStation, txs, 28),
            art = top.art && !cowl,
            swatch = heliSwatchUv(top.swatch || 'cowl'),
            base = paint.count,
            white = col('#ffffff');
          if (art) cowl = { stationAt: topStation, x0: top.x0, x1: top.x1 };
          for (let i = 0; i < tg.rows; i++)
            for (let j = 0; j < tg.cols; j++) {
              const k = (i * tg.cols + j) * 3,
                u = art ? HELI_ART.cowl + ((HELI_ART.cowlEnd - HELI_ART.cowl) * (tg.P[k] - top.x0)) / (top.x1 - top.x0) : swatch[0],
                v = art ? (HELI_BAND * j) / (tg.cols - 1) : swatch[1];
              heliPushVertex(paint, tg.P[k], tg.P[k + 1], tg.P[k + 2] + top.z, tg.N[k], tg.N[k + 1], tg.N[k + 2], u, v, white);
            }
          for (let i = 0; i < tg.rows - 1; i++)
            for (let j = 0; j < tg.cols - 1; j++) {
              const a = base + i * tg.cols + j,
                b = a + tg.cols;
              paint.index.push(a, b, b + 1, a, b + 1, a + 1);
            }
        }
        // ---- Fins (and the fenestron's shroud), stabiliser and endplates ----
        const fenestron = look.tail === 'fenestron' && plan.fenestron;
        {
          const t = plan.fin.thick,
            bevel = Math.min(0.3, t * 0.35);
          for (const outline of fenestron ? plan.fin.fenestron : plan.fin.rotor) {
            const shape = new Three.Shape(outline.map(([x, y]) => new Three.Vector2(x, y))),
              fin = new Three.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 20 });
            fin.translate(0, 0, -t / 2);
            heliFinUv(fin, plan.fin.art);
            policeAddMatrix(paint, fin, heliMatrix.identity(), '#ffffff');
            fin.dispose();
          }
          if (fenestron) {
            // The shroud: a thick ring round the fan, its duct lined, stators and hub inside.
            const f = fenestron,
              ring = new Three.Shape(),
              hole = new Three.Path();
            ring.absarc(f.x, f.y, f.shroud - 0.45, 0, TAU, false);
            hole.absarc(f.x, f.y, f.radius + 0.6, 0, TAU, true);
            ring.holes.push(hole);
            const shroud = new Three.ExtrudeGeometry(ring, { depth: f.thick - 0.9, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.45, bevelSegments: 3, curveSegments: 36 });
            shroud.translate(0, 0, -(f.thick - 0.9) / 2);
            heliFinUv(shroud, plan.fin.art);
            policeAddMatrix(paint, shroud, heliMatrix.identity(), '#ffffff');
            shroud.dispose();
            const duct = new Three.CylinderGeometry(f.radius + 0.18, f.radius + 0.18, f.thick + 0.2, 36, 1, true);
            duct.rotateX(Math.PI / 2);
            duct.translate(f.x, f.y, 0);
            policeAddMatrix(trim, duct, heliMatrix.identity(), '#1c1f23');
            duct.dispose();
            for (let s = 0; s < 3; s++) {
              const a = 0.5 + (s * TAU) / 3;
              heliRod(trim, [f.x, f.y, 0.55], [f.x + Math.cos(a) * (f.radius + 0.2), f.y + Math.sin(a) * (f.radius + 0.2), 0.55], 0.2, '#34373c', boxGeo, 0.5);
            }
            policeAdd(trim, S.cylinder, f.x, f.y, 0.45, 1.05, 1.1, 1.05, '#34373c', null, Math.PI / 2);
          }
        }
        {
          const s = plan.stab,
            stab = roundedBar(s.span * 2, s.thick, s.chord, s.thick * 0.48);
          policeAdd(paint, stab, s.x, s.y, 0, 1, 1, 1, '#ffffff', { uv: heliSwatchUv('stab') }, 0, 0, 0);
          if (s.plate)
            for (const side of [-1, 1]) {
              const plate = roundedBar(0.42, s.plate[1], s.plate[0], 0.2);
              // Swept back a little, like the real endplates.
              policeAdd(paint, plate, s.x - 0.4, s.y + 0.4, side * (s.span + 0.14), 1, 1, 1, '#ffffff', { uv: heliSwatchUv('plate') }, 0, 0, 0.22);
            }
        }
        // ---- Airframe equipment, interior, crew ----
        const crew = { pilot: policeSet(), observer: policeSet() },
          kitParts = { plan, look, S, col, paint, glass, interior, trim, metal, lights, anchors, crew, stationAt };
        if (plan.name === 'colibri') heliColibriEquipment(kitParts);
        else if (plan.name === 'robin') heliRobinEquipment(kitParts);
        else heliHawkEquipment(kitParts);
        heliCabin(kitParts);
        // ---- Decals (glyph quads: only the Black Hawk's stencils) ----
        const scheme = heliScheme(look),
          decals = policeSet();
        scheme.decals?.((text, o) => heliText(decals, plan, text, o));
        // ---- Rotors ----
        const rotor = heliRotorParts(plan.rotor, look, look.kind === 'military'),
          tail = fenestron ? heliFenestronParts(fenestron, look) : heliTailRotorParts(plan.tailRotor, look);
        const kit = {
          plan,
          cowl,
          fenestron,
          paint: policeGeometry(paint, { colors: false }),
          glass: policeGeometry(glass, { colors: false }),
          interior: policeGeometry(interior),
          pilot: policeGeometry(crew.pilot),
          observer: policeGeometry(crew.observer),
          trim: policeGeometry(trim),
          metal: metal.count ? policeGeometry(metal) : null,
          lights: policeGeometry(lights, { channels: true }),
          decals: decals.count ? policeGeometry(decals) : null,
          anchors,
          rotor,
          tail,
          nightsun: kitParts.nightsun || null,
        };
        heliKits.set(look.kind, kit);
        return kit;
      }
