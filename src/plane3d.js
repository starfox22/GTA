      // BEGIN SUBSYSTEM: src/plane3d.js — Airplane meshes
      /**
       * Airplane meshes
       * Source: src/plane3d.js
       * Scope: createCityRenderer() closure.
       * Three procedurally built airframes that read as real aircraft from above:
       * a high-wing single-engine courier (Cessna-class), a T-tail executive jet
       * with rear-mounted engines, and a twin-turbofan narrow-body airliner.
       *
       * CONSTRUCTION
       * buildAircraft(kind, parent, options) assembles: an elliptical fuselage
       * loft from cross-section profiles, tapered swept wings with a NACA-style
       * airfoil thickness, stabilisers, engines, gear in spin pivots, cockpit and
       * cabin glazing, livery stripes, tail logos and navigation lights. Local +X
       * is forward, the fuselage rests on its gear at y = 0, and footprints match
       * AIRFRAME_SPECS (length along X, span along Z) because collision uses them.
       * makePlane() wraps it for flying vehicles; parkedJet() (world3d.js) uses it
       * for static apron aircraft.
       */
      // A function rather than a const: world3d.js builds parked aircraft before this
      // fragment's constants would be initialised, and function declarations hoist.
      function aircraftPlans() {
        return {
        courier: {
          cy: 13,
          fuselage: [
            [56, 0.4, 0.4, 0],
            [52, 3.2, 3.4, -0.6],
            [44, 6.4, 6.6, -0.5],
            [34, 7.6, 7.4, 0],
            [22, 9.2, 7.6, 1.2],
            [6, 9.4, 7.6, 1.4],
            [-10, 8.2, 6.8, 1.6],
            [-24, 5.4, 4.6, 2.6],
            [-38, 3.4, 2.8, 3.6],
            [-50, 2.2, 1.8, 4.6],
            [-56, 0.5, 0.5, 5.4],
          ],
          wing: { y: 9.6, span: 100, rootChord: 22, tipChord: 16, leX: 12, sweep: 2, dihedral: 0.02, thickness: 0.11, high: true },
          stab: { x: -46, y: 3.8, span: 40, rootChord: 12, tipChord: 8, sweep: 3 },
          fin: { x: -42, base: 12, height: 17, rootChord: 16, tipChord: 7, sweep: 9 },
          prop: { x: 57, blades: 3, radius: 13 },
          gear: { nose: { x: 34, r: 2.8 }, main: { x: 6, z: 11, r: 3.2 } },
          windows: null,
          cockpit: { x: 16, len: 16, y: 6.4 },
          logo: 'SERRANO AIR',
        },
        jet: {
          cy: 17,
          fuselage: [
            [75, 0.4, 0.4, 0],
            [70, 3, 3, -1],
            [60, 6.6, 6.4, -0.6],
            [48, 9, 8.6, 0],
            [30, 9.6, 8.8, 0],
            [-20, 9.6, 8.8, 0],
            [-40, 8.6, 7.6, 0.8],
            [-56, 6, 5, 2.6],
            [-68, 3.6, 2.8, 4.6],
            [-75, 0.6, 0.6, 5.6],
          ],
          wing: { y: -5.5, span: 118, rootChord: 32, tipChord: 11, leX: 16, sweep: 24, dihedral: 0.07, thickness: 0.1, winglet: 7 },
          stab: { x: -73, y: 26, span: 46, rootChord: 13, tipChord: 7, sweep: 8 },
          fin: { x: -60, base: 9, height: 24, rootChord: 24, tipChord: 12, sweep: 12 },
          engines: [{ x: -38, y: 8, z: 14, r: 5, len: 24, pylon: 'side' }, { x: -38, y: 8, z: -14, r: 5, len: 24, pylon: 'side' }],
          gear: { nose: { x: 52, r: 3 }, main: { x: -4, z: 9, r: 3.4 } },
          windows: { from: 42, to: -30, step: 7, y: 3.2 },
          cockpit: { x: 56, len: 12, y: 4.5 },
          logo: 'AURELIA',
        },
        airliner: {
          cy: 23,
          fuselage: [
            [107, 0.5, 0.5, 0],
            [102, 4, 4.2, -1.6],
            [92, 8.6, 9, -0.8],
            [78, 11.4, 11.6, 0],
            [60, 12, 12, 0],
            [-56, 12, 12, 0],
            [-74, 10.6, 9.8, 1.8],
            [-90, 7, 5.8, 5.2],
            [-102, 3.4, 2.6, 8.4],
            [-107, 0.6, 0.6, 9.6],
          ],
          wing: { y: -6, span: 148, rootChord: 46, tipChord: 13, leX: 20, sweep: 34, dihedral: 0.09, thickness: 0.1, winglet: 10 },
          stab: { x: -92, y: 6, span: 62, rootChord: 20, tipChord: 9, sweep: 14 },
          fin: { x: -84, base: 11, height: 32, rootChord: 34, tipChord: 14, sweep: 20 },
          engines: [{ x: 10, y: -13, z: 30, r: 8, len: 32, pylon: 'wing' }, { x: 10, y: -13, z: -30, r: 8, len: 32, pylon: 'wing' }],
          gear: { nose: { x: 76, r: 3.4, twin: true }, main: { x: -4, z: 12, r: 4.4, twin: true } },
          windows: { from: 58, to: -58, step: 6.5, y: 4 },
          doors: [66, -66],
          cockpit: { x: 84, len: 14, y: 5 },
          logo: 'SOUTHPORT AIR',
        },
        };
      }
      function airfoilHalfThickness(t) {
        // NACA four-digit thickness distribution, normalised to a unit chord.
        return 0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1015 * t ** 4;
      }
      function fuselageGeometry(profiles) {
        const radial = 22,
          positions = [],
          uvs = [],
          indices = [];
        profiles.forEach(([x, ry, rz, yOffset], i) => {
          for (let j = 0; j <= radial; j++) {
            const a = (j / radial) * TAU;
            positions.push(x, yOffset + Math.cos(a) * ry, Math.sin(a) * rz);
            uvs.push(i / (profiles.length - 1), j / radial);
          }
        });
        const ring = radial + 1;
        for (let i = 0; i < profiles.length - 1; i++)
          for (let j = 0; j < radial; j++) {
            const a = i * ring + j,
              b = a + 1,
              d = a + ring,
              e = d + 1;
            indices.push(a, d, b, b, d, e);
          }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
      }
      // A tapered, swept half-wing (or stabiliser) from root section to tip section.
      function liftingSurfaceGeometry(rootLE, rootChord, tipLE, tipChord, span, thickness, dihedral, side, mirrorZ = false) {
        const steps = 18,
          spanSteps = 3,
          positions = [],
          indices = [];
        for (let s = 0; s <= spanSteps; s++) {
          const f = s / spanSteps,
            z = side * span * f,
            le = rootLE + (tipLE - rootLE) * f,
            chord = rootChord + (tipChord - rootChord) * f,
            rise = Math.abs(z) * dihedral;
          for (let k = 0; k <= steps; k++) {
            const theta = (k / steps) * TAU,
              t = (1 - Math.cos(theta)) / 2,
              upper = theta < Math.PI,
              h = airfoilHalfThickness(t) * thickness * chord * (upper ? 1 : -0.75);
            positions.push(le - t * chord, rise + h, mirrorZ ? -z : z);
          }
        }
        const ring = steps + 1;
        for (let s = 0; s < spanSteps; s++)
          for (let k = 0; k < steps; k++) {
            const a = s * ring + k,
              b = a + 1,
              d = a + ring,
              e = d + 1;
            if (side * (mirrorZ ? -1 : 1) > 0) indices.push(a, b, d, b, e, d);
            else indices.push(a, d, b, b, d, e);
          }
        // Tip cap fan.
        const tipStart = spanSteps * ring,
          center = positions.length / 3;
        positions.push(tipLE - tipChord / 2, span * dihedral, (mirrorZ ? -1 : 1) * side * span);
        for (let k = 0; k < steps; k++)
          if (side * (mirrorZ ? -1 : 1) > 0) indices.push(center, tipStart + k + 1, tipStart + k);
          else indices.push(center, tipStart + k, tipStart + k + 1);
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
      }
      function aircraftLabel(parent, text, x, y, z, width, color, yaw = 0, tilt = 0) {
        const cv = document.createElement('canvas');
        cv.width = 256;
        cv.height = 64;
        const g = cv.getContext('2d');
        g.fillStyle = color;
        g.font = '800 40px Arial';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 128, 34, 240);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        const plane = new Three.Mesh(
          new Three.PlaneGeometry(width, width / 4),
          new Three.MeshBasicMaterial({ map: tx, transparent: true, toneMapped: false, side: Three.DoubleSide }),
        );
        plane.position.set(x, y, z);
        plane.rotation.set(tilt, yaw, 0);
        parent.add(plane);
        return plane;
      }
      function buildAircraft(kind, parent, options = {}) {
        const plan = aircraftPlans()[kind],
          body = new Three.Group();
        parent.add(body);
        const color = options.color || '#e6ebe8',
          paint = mat(color, 0.32, 0.42),
          accent = mat(options.accent || (kind === 'courier' ? '#b8503c' : kind === 'jet' ? '#2f4a63' : '#1f6f8f'), 0.4, 0.4),
          belly = mat('#b9c0c2', 0.5, 0.5),
          dark = mat('#1c262e', 0.35, 0.5),
          intake = mat('#0f161b', 0.8, 0.2),
          canopy = new Three.MeshStandardMaterial({ color: '#152836', roughness: 0.1, metalness: 0.7 }),
          cy = plan.cy,
          wheels = [],
          nightLights = [];
        // Fuselage loft and belly tone.
        const fuselage = mesh(fuselageGeometry(plan.fuselage), paint, body, 0, cy, 0);
        fuselage.name = 'fuselage';
        const halfLength = plan.fuselage[0][0];
        // Cheatline stripe and belly band follow the loft as thin shells.
        mesh(fuselageGeometry(plan.fuselage.map(([x, ry, rz, yo]) => [x * 0.98, ry * 1.02, rz * 1.02, yo])), accent, body, 0, cy, 0).scale.set(1, 0.16, 1.0);
        const bellyShell = mesh(fuselageGeometry(plan.fuselage.map(([x, ry, rz, yo]) => [x * 0.97, ry * 1.015, rz * 1.015, yo])), belly, body, 0, cy - 0.4, 0);
        bellyShell.scale.set(1, 0.45, 1);
        bellyShell.position.y = cy - plan.fuselage[4][1] * 0.6;
        // Wings.
        const w = plan.wing,
          wingY = cy + w.y,
          rootLE = w.leX,
          tipLE = w.leX - w.sweep;
        for (const side of [-1, 1]) {
          const wing = mesh(
            liftingSurfaceGeometry(rootLE, w.rootChord, tipLE, w.tipChord, w.span / 2, w.thickness, w.dihedral, side),
            paint,
            body,
            0,
            wingY,
            0,
          );
          wing.name = 'wing';
          // Flap and aileron seams as thin dark strips on the trailing edge.
          for (const [f0, f1] of [
            [0.12, 0.5],
            [0.58, 0.92],
          ]) {
            const zMid = side * (w.span / 2) * ((f0 + f1) / 2),
              chord = w.rootChord + (w.tipChord - w.rootChord) * ((f0 + f1) / 2),
              le = rootLE + (tipLE - rootLE) * ((f0 + f1) / 2);
            box(body, le - chord * 0.78, wingY + Math.abs(zMid) * w.dihedral + 0.35, zMid, 0.5, 0.25, (w.span / 2) * (f1 - f0) - 1, dark);
          }
          if (w.winglet) {
            const zTip = side * (w.span / 2),
              winglet = box(body, tipLE - w.tipChord * 0.5, wingY + (w.span / 2) * w.dihedral + w.winglet / 2, zTip, w.tipChord * 0.7, w.winglet, 0.6, accent);
            winglet.rotation.x = side * 0.25;
          }
          if (w.high) {
            // Wing struts and the tapered gear legs of the high-wing courier.
            rod(body, new Three.Vector3(w.leX - 4, cy - 4, side * 6), new Three.Vector3(w.leX - 6, wingY - 0.5, side * 30), 0.5, dark);
            rod(body, new Three.Vector3(w.leX - 12, cy - 4, side * 6), new Three.Vector3(w.leX - 14, wingY - 0.5, side * 30), 0.5, dark);
          }
          // Navigation lights at the wing tips (red left, green right).
          const navX = tipLE - w.tipChord * 0.15,
            navZ = side * (w.span / 2 - 0.5),
            navColor = side < 0 ? '#ff4a3a' : '#4dff7a';
          box(body, navX, wingY + (w.span / 2) * w.dihedral, navZ, 1.2, 0.8, 1, new Three.MeshBasicMaterial({ color: navColor }));
          nightLights.push(halo(body, navX, wingY + (w.span / 2) * w.dihedral, navZ, 9, navColor));
        }
        // Horizontal stabiliser and vertical fin (T-tail when the stabiliser sits on the fin).
        const st = plan.stab;
        for (const side of [-1, 1])
          mesh(liftingSurfaceGeometry(st.x, st.rootChord, st.x - st.sweep, st.tipChord, st.span / 2, 0.08, 0.03, side), paint, body, 0, cy + st.y, 0);
        const fn = plan.fin,
          fin = mesh(liftingSurfaceGeometry(fn.x, fn.rootChord, fn.x - fn.sweep, fn.tipChord, fn.height, 0.08, 0, 1), accent, body, 0, 0, 0);
        fin.rotation.x = -Math.PI / 2;
        fin.position.set(0, cy + fn.base, 0);
        // Tail logo on both sides of the fin.
        for (const side of [-1, 1])
          aircraftLabel(body, plan.logo, fn.x - fn.rootChord * 0.45, cy + fn.base + fn.height * 0.5, side * 1.1, fn.rootChord * 0.9, '#f4efe4', side > 0 ? 0 : Math.PI);
        box(body, fn.x - fn.sweep - fn.tipChord * 0.5, cy + fn.base + fn.height + 0.6, 0, 1.2, 0.8, 1.2, new Three.MeshBasicMaterial({ color: '#ffffff' }));
        nightLights.push(halo(body, fn.x - fn.sweep - fn.tipChord * 0.5, cy + fn.base + fn.height + 1, 0, 8, '#ffffff'));
        // Anti-collision beacons above and below the fuselage.
        const beaconMat = new Three.MeshBasicMaterial({ color: '#ff3b2f' }),
          topY = cy + plan.fuselage[4][1] + plan.fuselage[4][3];
        mesh(sphereGeo, beaconMat, body, -10, topY + 0.6, 0, 1, 0.8, 1);
        nightLights.push(halo(body, -10, topY + 1, 0, 8, '#ff5a44'));
        mesh(sphereGeo, beaconMat, body, 20, cy - plan.fuselage[4][1] + plan.fuselage[4][3] - 0.4, 0, 1, 0.8, 1);
        // Cockpit glazing: a dark wraparound band near the nose.
        const ck = plan.cockpit;
        box(body, ck.x, cy + ck.y, 0, ck.len, 3.2, plan.fuselage[3][2] * 2 + 0.6, canopy);
        box(body, ck.x + ck.len * 0.45, cy + ck.y, 0, ck.len * 0.4, 3, plan.fuselage[3][2] * 1.7, canopy);
        // Cabin windows and doors.
        if (plan.windows) {
          const wn = plan.windows;
          for (const side of [-1, 1])
            for (let x = wn.from; x > wn.to; x -= wn.step)
              box(body, x, cy + wn.y, side * (plan.fuselage[4][2] + 0.15), 2.4, 3, 0.4, canopy);
          for (const dx of plan.doors || [])
            for (const side of [-1, 1]) box(body, dx, cy - 1, side * (plan.fuselage[4][2] + 0.2), 7, 13, 0.3, dark);
        }
        // Engines.
        let prop = null;
        if (plan.prop) {
          const p = plan.prop;
          box(body, p.x - 4, cy - 0.4, 0, 6, 12, 12, dark);
          prop = new Three.Group();
          prop.position.set(p.x, cy - 0.4, 0);
          body.add(prop);
          mesh(new Three.ConeGeometry(2.4, 5, 12), chrome, prop, 2, 0, 0).rotation.z = -Math.PI / 2;
          for (let k = 0; k < p.blades; k++) {
            const blade = box(prop, 0.4, 0, 0, 0.4, p.radius, 2.2, dark);
            blade.position.set(0.4, Math.cos((k * TAU) / p.blades) * p.radius * 0.5, Math.sin((k * TAU) / p.blades) * p.radius * 0.5);
            blade.rotation.x = (k * TAU) / p.blades;
          }
          box(body, p.x - 10, cy - 6, 3, 6, 1.4, 1.4, dark);
        }
        for (const en of plan.engines || []) {
          const nacelle = mesh(new Three.CylinderGeometry(en.r, en.r * 0.82, en.len, 20), paint, body, en.x, cy + en.y, en.z);
          nacelle.rotation.z = Math.PI / 2;
          const lip = mesh(new Three.CylinderGeometry(en.r * 1.02, en.r * 0.98, en.len * 0.18, 20), accent, body, en.x + en.len * 0.42, cy + en.y, en.z);
          lip.rotation.z = Math.PI / 2;
          const fan = mesh(new Three.CylinderGeometry(en.r * 0.86, en.r * 0.86, 0.6, 20), intake, body, en.x + en.len / 2 + 0.2, cy + en.y, en.z);
          fan.rotation.z = Math.PI / 2;
          mesh(new Three.ConeGeometry(en.r * 0.22, en.r * 0.5, 10), chrome, body, en.x + en.len / 2 + 0.5, cy + en.y, en.z).rotation.z = -Math.PI / 2;
          const cone = mesh(new Three.ConeGeometry(en.r * 0.55, en.r * 0.9, 14), dark, body, en.x - en.len / 2 - en.r * 0.2, cy + en.y, en.z);
          cone.rotation.z = Math.PI / 2;
          if (en.pylon === 'wing') box(body, en.x - 4, cy + en.y + en.r * 0.9, en.z, en.len * 0.55, en.r * 1.1, 2.2, paint);
          else box(body, en.x, cy + en.y - 2, en.z * 0.55, en.len * 0.5, 3, Math.abs(en.z) * 0.6, paint);
        }
        // Landing gear in spin pivots (rotation.z rolls the tyres).
        function gearLeg(x, z, r, twin) {
          const legTop = cy - plan.fuselage[4][1] * 0.6 + plan.fuselage[4][3];
          rod(body, new Three.Vector3(x, legTop, z), new Three.Vector3(x, r + 0.5, z), 0.7, chrome);
          box(body, x - 1.6, legTop - 3, z + (z >= 0 ? 1.6 : -1.6), 3, 6, 0.4, paint);
          for (const dz of twin ? [-r * 0.55, r * 0.55] : [0]) {
            const pivot = new Three.Group();
            pivot.position.set(x, r, z + dz);
            body.add(pivot);
            const tire = mesh(wheelGeo, rubber, pivot, 0, 0, 0, r, r * 0.55, r);
            tire.rotation.x = Math.PI / 2;
            const hub = mesh(wheelGeo, chrome, pivot, 0, 0, 0, r * 0.45, r * 0.6, r * 0.45);
            hub.rotation.x = Math.PI / 2;
            wheels.push({ wheel: pivot });
          }
        }
        gearLeg(plan.gear.nose.x, 0, plan.gear.nose.r, plan.gear.nose.twin);
        for (const side of [-1, 1]) gearLeg(plan.gear.main.x, side * plan.gear.main.z, plan.gear.main.r, plan.gear.main.twin);
        // Antennas and registration.
        box(body, -halfLength * 0.3, topY + 1.5, 0, 0.4, 3, 0.4, dark);
        box(body, halfLength * 0.35, topY + 1, 0, 3, 1.4, 0.4, dark);
        aircraftLabel(body, options.registration || 'N' + (kind === 'courier' ? '200SC' : kind === 'jet' ? '8AJ' : '220MD'), -halfLength * 0.55, cy + 1, plan.fuselage[4][2] + 0.3, 14, '#2a2f34');
        return { body, paint, canopy, prop, wheels, nightLights, length: halfLength * 2 };
      }
      function makePlane(vehicle) {
        const group = new Three.Group();
        scene.add(group);
        const kind = vehicle.airframe === 'jet' || vehicle.airframe === 'airliner' ? vehicle.airframe : 'courier',
          parts = buildAircraft(kind, group, { color: vehicle.color });
        group.name =
          kind === 'airliner' ? 'Oceanview airliner' : kind === 'jet' ? 'South Coast executive jet' : 'Serrano courier';
        return {
          group,
          body: parts.body,
          paint: parts.paint,
          canopy: parts.canopy,
          prop: parts.prop,
          wheels: parts.wheels,
          nightLights: parts.nightLights,
          strobes: [],
          special: true,
          plane: true,
        };
      }
      // END SUBSYSTEM: src/plane3d.js
