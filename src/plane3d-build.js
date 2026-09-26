      /**
       * STATIC MERGE
       * Parts that never move are collected per material and merged into one mesh
       * each at the end of the build.
       */
      function aircraftBatch() {
        const byMaterial = new Map(),
          matrix = new Three.Matrix4(),
          normalMatrix = new Three.Matrix3(),
          v = new Three.Vector3();
        return {
          add(geometry, material, transform = null) {
            if (!byMaterial.has(material)) byMaterial.set(material, []);
            byMaterial.get(material).push({ geometry, transform: transform ? transform.clone() : null });
          },
          // A unit box / cylinder / sphere placed by position, scale and rotation.
          place(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
            matrix.compose(
              new Three.Vector3(x, y, z),
              new Three.Quaternion().setFromEuler(new Three.Euler(rx, ry, rz)),
              new Three.Vector3(sx, sy, sz),
            );
            this.add(geometry, material, matrix);
          },
          // A cylinder between two points.
          rod(a, b, r, material, geometry = cylinderGeo) {
            const dir = new Three.Vector3().subVectors(b, a),
              q = new Three.Quaternion().setFromUnitVectors(new Three.Vector3(0, 1, 0), dir.clone().normalize());
            matrix.compose(a.clone().add(b).multiplyScalar(0.5), q, new Three.Vector3(r, dir.length(), r));
            this.add(geometry, material, matrix);
          },
          flush(parent, name) {
            for (const [material, parts] of byMaterial) {
              let vertices = 0,
                count = 0;
              for (const { geometry } of parts) {
                vertices += geometry.attributes.position.count;
                count += geometry.index ? geometry.index.count : geometry.attributes.position.count;
              }
              const positions = new Float32Array(vertices * 3),
                normals = new Float32Array(vertices * 3),
                uvs = new Float32Array(vertices * 2),
                index = new Uint32Array(count);
              let vo = 0,
                io = 0;
              for (const { geometry, transform } of parts) {
                const p = geometry.attributes.position,
                  n = geometry.attributes.normal,
                  uv = geometry.attributes.uv;
                if (transform) normalMatrix.getNormalMatrix(transform);
                for (let i = 0; i < p.count; i++) {
                  v.fromBufferAttribute(p, i);
                  if (transform) v.applyMatrix4(transform);
                  positions.set([v.x, v.y, v.z], (vo + i) * 3);
                  if (n) {
                    v.fromBufferAttribute(n, i);
                    if (transform) v.applyMatrix3(normalMatrix).normalize();
                  } else v.set(0, 1, 0);
                  normals.set([v.x, v.y, v.z], (vo + i) * 3);
                  if (uv) uvs.set([uv.getX(i), uv.getY(i)], (vo + i) * 2);
                }
                if (geometry.index) for (let i = 0; i < geometry.index.count; i++) index[io++] = geometry.index.getX(i) + vo;
                else for (let i = 0; i < p.count; i++) index[io++] = vo + i;
                vo += p.count;
              }
              const merged = new Three.BufferGeometry();
              merged.setAttribute('position', new Three.BufferAttribute(positions, 3));
              merged.setAttribute('normal', new Three.BufferAttribute(normals, 3));
              merged.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
              merged.setIndex(new Three.BufferAttribute(index, 1));
              merged.computeBoundingSphere();
              const m = new Three.Mesh(merged, material);
              m.castShadow = true;
              m.receiveShadow = true;
              m.name = name;
              parent.add(m);
            }
            byMaterial.clear();
          },
        };
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
      /* A hinged control surface: a pivot on the hinge line, the part inside it. */
      function hingedSurface(body, surface, f0, f1, c0, material, name) {
        const a = surface.point(f0, c0),
          b = surface.point(f1, c0),
          axis = b.clone().sub(a).normalize();
        // Positive deflection is trailing edge down (or right, for the rudder).
        if (axis.z < -0.5 || (Math.abs(axis.z) <= 0.5 && axis.y < 0)) axis.negate();
        const pivot = new Three.Group();
        pivot.position.copy(a);
        pivot.name = name;
        body.add(pivot);
        const geometry = surface.part(f0, f1, c0 + 0.005, 1);
        geometry.translate(-a.x, -a.y, -a.z);
        const m = new Three.Mesh(geometry, material);
        m.castShadow = true;
        m.receiveShadow = true;
        pivot.add(m);
        return { pivot, axis, angle: 0 };
      }
      function setSurfaceAngle(surface, angle) {
        if (!surface || Math.abs(angle - surface.angle) < 1e-4) return;
        surface.angle = angle;
        surface.pivot.quaternion.setFromAxisAngle(surface.axis, angle);
      }
      /* A turbofan nacelle along +X: lathed cowl, lip, fan, spinner, exhaust cone. */
      function turbofan(batch, body, en, paint, lip, dark, metal, fans) {
        const R = en.r,
          Lh = en.len / 2,
          profile = [
            [0.9, Lh],
            [1, Lh * 0.72],
            [1.02, Lh * 0.2],
            [0.96, -Lh * 0.4],
            [0.78, -Lh * 0.92],
            [0.74, -Lh],
          ].map(([r, y]) => new Three.Vector2(r * R, y)),
          cowl = new Three.LatheGeometry(profile, 28);
        cowl.rotateZ(-Math.PI / 2);
        cowl.translate(en.x, en.y, en.z);
        batch.add(cowl, paint);
        const lipGeo = new Three.TorusGeometry(R * 0.92, R * 0.1, 8, 28);
        lipGeo.rotateY(Math.PI / 2);
        lipGeo.translate(en.x + Lh, en.y, en.z);
        batch.add(lipGeo, lip);
        // The intake throat and the fan behind it.
        const throat = new Three.CylinderGeometry(R * 0.86, R * 0.86, en.len * 0.16, 24, 1, true);
        throat.rotateZ(Math.PI / 2);
        throat.translate(en.x + Lh - en.len * 0.08, en.y, en.z);
        batch.add(throat, dark);
        const fan = new Three.Group();
        fan.position.set(en.x + Lh - en.len * 0.15, en.y, en.z);
        body.add(fan);
        const hub = new Three.Mesh(new Three.ConeGeometry(R * 0.28, R * 0.55, 16), metal);
        hub.rotation.z = -Math.PI / 2;
        hub.position.x = R * 0.2;
        fan.add(hub);
        const bladeGeo = new Three.BoxGeometry(0.25, R * 0.62, R * 0.2);
        for (let k = 0; k < 18; k++) {
          const blade = new Three.Mesh(bladeGeo, metal),
            a = (k * TAU) / 18;
          blade.position.set(0, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5);
          blade.rotation.set(a + 0.5, 0, 0);
          fan.add(blade);
        }
        fans.push(fan);
        // Exhaust cone out of the back.
        const cone = new Three.ConeGeometry(R * 0.5, R * 1.1, 18);
        cone.rotateZ(Math.PI / 2);
        cone.translate(en.x - Lh - R * 0.45, en.y, en.z);
        batch.add(cone, dark);
      }
      /* The four-blade propeller: spinner, twisted blades with painted tips, and a
         blur disc shown when it turns fast. */
      function propeller(body, pr, metal, bladeMat, tipMat) {
        const prop = new Three.Group();
        prop.position.set(pr.x, pr.y, 0);
        body.add(prop);
        const spinner = new Three.LatheGeometry(
          Array.from({ length: 9 }, (_, i) => {
            const t = i / 8;
            return new Three.Vector2(pr.spinnerRadius * Math.sqrt(1 - t * t * 0.98), t * pr.spinner);
          }),
          24,
        );
        spinner.rotateZ(-Math.PI / 2);
        spinner.translate(-1.2, 0, 0);
        const spin = new Three.Mesh(spinner, metal);
        spin.castShadow = true;
        prop.add(spin);
        // One blade along +Y: sections from root to tip, twisted and tapered.
        const sections = 8,
          positions = [],
          indices = [];
        for (let i = 0; i <= sections; i++) {
          const t = i / sections,
            r = pr.spinnerRadius * 0.7 + (pr.radius - pr.spinnerRadius * 0.7) * t,
            chord = 2.3 - 1.1 * t + (t < 0.25 ? 0.4 * t : 0.1),
            thick = 0.42 - 0.28 * t,
            twist = 0.95 - 0.7 * t;
          for (const [cx, cz] of [
            [thick / 2, chord / 2],
            [-thick / 2, chord / 2],
            [-thick / 2, -chord / 2],
            [thick / 2, -chord / 2],
          ])
            positions.push(cx * Math.cos(twist) - cz * Math.sin(twist), r, cx * Math.sin(twist) + cz * Math.cos(twist));
        }
        for (let i = 0; i < sections; i++)
          for (let k = 0; k < 4; k++) {
            const a = i * 4 + k,
              b = i * 4 + ((k + 1) % 4),
              d = a + 4,
              e = b + 4;
            indices.push(a, d, b, b, d, e);
          }
        indices.push(sections * 4, sections * 4 + 1, sections * 4 + 2, sections * 4, sections * 4 + 2, sections * 4 + 3);
        const blade = new Three.BufferGeometry();
        blade.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        blade.setIndex(indices);
        blade.computeVertexNormals();
        const tip = new Three.BoxGeometry(0.3, pr.radius * 0.08, 1.2);
        tip.translate(0, pr.radius * 0.95, 0);
        for (let k = 0; k < pr.blades; k++) {
          const holder = new Three.Group();
          holder.rotation.x = (k * TAU) / pr.blades;
          prop.add(holder);
          const b = new Three.Mesh(blade, bladeMat);
          b.castShadow = true;
          holder.add(b);
          holder.add(new Three.Mesh(tip, tipMat));
        }
        const disc = new Three.Mesh(
          new Three.CircleGeometry(pr.radius, 40),
          new Three.MeshBasicMaterial({ color: '#2a2e31', transparent: true, opacity: 0, depthWrite: false, side: Three.DoubleSide }),
        );
        disc.rotation.y = Math.PI / 2;
        disc.position.x = 0.1;
        disc.visible = false;
        prop.add(disc);
        return { prop, disc, blades: prop.children.filter((c) => c.isGroup) };
      }
      /* One gear leg in its retraction pivot: strut, torque link, doors, wheels. */
      function landingGear(body, spec, z, side, metal, rubberMat, hubMat, doorMat, wheels) {
        const pivot = new Three.Group();
        pivot.position.set(spec.x, spec.top, z);
        body.add(pivot);
        const length = spec.top - spec.r,
          strut = new Three.Mesh(cylinderGeo, metal);
        strut.scale.set(0.55, length, 0.55);
        strut.position.y = -length / 2;
        strut.castShadow = true;
        pivot.add(strut);
        // Oleo: a thicker upper cylinder.
        const oleo = new Three.Mesh(cylinderGeo, metal);
        oleo.scale.set(0.85, length * 0.45, 0.85);
        oleo.position.y = -length * 0.25;
        pivot.add(oleo);
        const door = new Three.Mesh(boxGeo, doorMat);
        door.scale.set(spec.retract === 'in' ? spec.r * 1.6 : 0.25, length * 0.8, spec.retract === 'in' ? 0.25 : spec.r * 1.2);
        door.position.set(0, -length * 0.45, spec.retract === 'in' ? side * (spec.width / 2 + 0.6) : 0);
        if (spec.retract !== 'in') door.position.x = spec.retract === 'aft' ? 1.2 : -1.2;
        door.castShadow = true;
        pivot.add(door);
        const offsets = spec.twin ? [-1, 1] : [0];
        for (const o of offsets) {
          const wheel = new Three.Group(),
            dz = o * (spec.width / 2 + 0.35);
          wheel.position.set(spec.trailing ? -1.4 : 0, -length, dz);
          pivot.add(wheel);
          const tire = new Three.Mesh(wheelGeo, rubberMat);
          tire.scale.set(spec.r, spec.width, spec.r);
          tire.rotation.x = Math.PI / 2;
          tire.castShadow = true;
          wheel.add(tire);
          const hub = new Three.Mesh(wheelGeo, hubMat);
          hub.scale.set(spec.r * 0.55, spec.width + 0.1, spec.r * 0.55);
          hub.rotation.x = Math.PI / 2;
          wheel.add(hub);
          wheels.push({ wheel, side });
        }
        if (spec.twin || spec.trailing) {
          // Axle / trailing link.
          const axle = new Three.Mesh(cylinderGeo, metal);
          axle.scale.set(0.35, spec.twin ? spec.width * 2 + 1 : 1.8, 0.35);
          axle.rotation.x = spec.twin ? Math.PI / 2 : 0;
          axle.rotation.z = spec.trailing ? Math.PI / 2 : 0;
          axle.position.set(spec.trailing ? -0.7 : 0, -length, 0);
          pivot.add(axle);
        }
        return { pivot, retract: spec.retract, side };
      }
      function buildAircraft(kind, parent, options = {}) {
        const plan = aircraftPlans()[kind],
          body = new Three.Group();
        body.name = 'airframe';
        parent.add(body);
        const shape = fuselageShape(plan),
          accentColour = options.accent || plan.accent,
          livery = aircraftLivery(kind, plan, shape, accentColour),
          // The fuselage wears the livery; paintVehicle (damage3d.js) tints and
          // weathers it, and the wing / tail paint copies it (animateAircraft).
          paint = new Three.MeshStandardMaterial({
            color: options.color || '#e6ebe8',
            map: livery.map,
            roughnessMap: livery.finishMap,
            metalnessMap: livery.finishMap,
            roughness: 0.34,
            metalness: 0.5,
          }),
          wingPaint = mat(options.color || '#e6ebe8', 0.34, 0.18),
          accent = mat(accentColour, 0.38, 0.25),
          dark = mat('#1d252b', 0.45, 0.35),
          intake = mat('#0c1216', 0.85, 0.1),
          metal = mat('#aeb6ba', 0.28, 0.85),
          gearMetal = mat('#c9ced0', 0.3, 0.8),
          lipMetal = mat('#d7dcde', 0.2, 0.9),
          bladeMat = mat('#1c1f22', 0.55, 0.3),
          tipMat = mat('#e8c23a', 0.5, 0.1),
          canopy = new Three.MeshStandardMaterial({ color: '#152836', roughness: 0.1, metalness: 0.7 }),
          batch = aircraftBatch(),
          wheels = [],
          fans = [],
          gears = [],
          surfaces = { aileron: [], elevator: [], rudder: [], flap: [] };
        // Fuselage.
        const fuselage = new Three.Mesh(fuselageMesh(shape), paint);
        fuselage.name = 'fuselage';
        fuselage.castShadow = true;
        fuselage.receiveShadow = true;
        body.add(fuselage);
        const sec = shape.section(0);
        // Wings: fixed box, flaps and ailerons in their hinges, winglets.
        const w = plan.wing,
          wings = {},
          navLights = [];
        for (const side of [1, -1]) {
          const wing = liftingSurface({
            rootLE: w.x,
            tipLE: w.x - w.sweep,
            rootChord: w.rootChord,
            tipChord: w.tipChord,
            thickness: w.thickness,
            mirror: side < 0,
            place: (x, t, f) => [x, w.y + f * w.span * w.dihedral + t, side * f * w.span],
          });
          wings[side] = wing;
          const cuts = [
            [0, w.flap[0], 1],
            [w.flap[0], w.flap[1], w.hinge],
            [w.flap[1], w.aileron[0], 1],
            [w.aileron[0], w.aileron[1], w.hinge],
            [w.aileron[1], 1, 1],
          ];
          for (const [f0, f1, c1] of cuts) batch.add(wing.part(f0, f1, 0, c1), wingPaint);
          surfaces.flap.push(hingedSurface(body, wing, w.flap[0] + 0.004, w.flap[1] - 0.004, w.hinge, wingPaint, 'flap'));
          const aileron = hingedSurface(body, wing, w.aileron[0] + 0.004, w.aileron[1] - 0.004, w.hinge, wingPaint, 'aileron');
          aileron.side = side;
          surfaces.aileron.push(aileron);
          // Flap track fairings under the trailing edge.
          for (const f of [w.flap[0] + 0.02, (w.flap[0] + w.flap[1]) / 2, w.flap[1] - 0.02]) {
            const p = wing.point(f, w.hinge);
            batch.place(sphereGeo, wingPaint, p.x - 0.6, p.y - 0.7, p.z, 3.2, 0.55, 0.4);
          }
          if (w.winglet) {
            const tip = wing.point(1, 0),
              wl = w.winglet,
              winglet = liftingSurface({
                rootLE: tip.x,
                tipLE: tip.x - wl.sweep,
                rootChord: wl.chord,
                tipChord: wl.tipChord,
                thickness: 0.08,
                mirror: side > 0,
                place: (x, t, f) => [x, tip.y + f * wl.height, tip.z + side * (f * wl.height * wl.cant + t)],
              });
            batch.add(winglet.part(0, 1), accent);
          }
          // Navigation light and strobe in the tip.
          const tip = wing.point(1, 0.12);
          navLights.push([tip.x, tip.y + 0.3, tip.z + side * 0.6, side]);
        }
        // Tail: fin with rudder, dorsal fillet, stabiliser with elevators, strakes.
        const fn = plan.fin,
          fin = liftingSurface({
            rootLE: fn.x,
            tipLE: fn.x - fn.sweep,
            rootChord: fn.rootChord,
            tipChord: fn.tipChord,
            thickness: fn.thickness,
            mirror: true,
            place: (x, t, f) => [x, fn.y + f * fn.height, t],
          });
        batch.add(fin.part(0, 1, 0, fn.hinge), accent);
        batch.add(fin.part(0, 0.06, fn.hinge, 1), accent);
        batch.add(fin.part(0.95, 1, fn.hinge, 1), accent);
        const rudder = hingedSurface(body, fin, 0.06, 0.95, fn.hinge, accent, 'rudder');
        surfaces.rudder.push(rudder);
        if (plan.dorsal) {
          const d = plan.dorsal;
          batch.add(
            liftingSurface({
              rootLE: d.x,
              tipLE: d.x - d.sweep,
              rootChord: d.rootChord,
              tipChord: d.tipChord,
              thickness: 0.12,
              mirror: true,
              place: (x, t, f) => [x, d.y + f * d.height, t],
            }).part(0, 1),
            accent,
          );
        }
        const s = plan.stab;
        for (const side of [1, -1]) {
          const stab = liftingSurface({
            rootLE: s.x,
            tipLE: s.x - s.sweep,
            rootChord: s.rootChord,
            tipChord: s.tipChord,
            thickness: s.thickness,
            mirror: side < 0,
            place: (x, t, f) => [x, s.y + f * s.span * (s.dihedral || 0) + t, side * f * s.span],
          });
          batch.add(stab.part(0, 1, 0, s.hinge), wingPaint);
          batch.add(stab.part(0.94, 1, s.hinge, 1), wingPaint);
          surfaces.elevator.push(hingedSurface(body, stab, 0.02, 0.94, s.hinge, wingPaint, 'elevator'));
        }
        // T-tail bullet fairing where the stabiliser meets the fin.
        if (s.y > fn.y + fn.height * 0.8) batch.place(sphereGeo, accent, s.x - s.rootChord * 0.45, s.y + 0.2, 0, s.rootChord * 0.62, 1.4, 1.4);
        if (plan.strakes) {
          const k = plan.strakes;
          for (const side of [1, -1]) batch.place(boxGeo, wingPaint, k.x, k.y - 1.2, side * 1.6, k.length, k.depth, 0.35, side * 0.6, 0, 0.12);
        }
        // Engines.
        let prop = null,
          disc = null;
        if (plan.prop) {
          const made = propeller(body, plan.prop, lipMetal, bladeMat, tipMat);
          prop = made.prop;
          disc = made.disc;
          // Exhaust stacks either side of the cowl, chin intake below it.
          const ex = plan.exhausts;
          for (const side of [1, -1])
            batch.rod(
              new Three.Vector3(ex.x + 1, ex.y, side * (ex.z - 0.9)),
              new Three.Vector3(ex.x - 1.6, ex.y - 0.6, side * (ex.z + 0.5)),
              0.62,
              dark,
            );
          batch.place(sphereGeo, wingPaint, plan.intake.x - 2.4, plan.intake.y, 0, 5.4, 1.7, 2.6);
          batch.place(boxGeo, intake, plan.intake.x + 2.6, plan.intake.y + 0.1, 0, 0.3, 1.5, 3.4);
        }
        for (const en of plan.engines || []) {
          turbofan(batch, body, en, wingPaint, lipMetal, intake, metal, fans);
          if (en.pylon === 'wing') {
            batch.place(boxGeo, wingPaint, en.x - en.len * 0.18, en.y + en.r * 0.95, en.z, en.len * 0.72, en.r * 0.9, 1.6);
          } else {
            // Stub pylon from the rear fuselage.
            batch.place(boxGeo, wingPaint, en.x + 1, en.y, en.z * 0.62, en.len * 0.45, 1.4, Math.abs(en.z) * 0.62, 0, 0, 0);
          }
        }
        // Landing gear.
        const g = plan.gear;
        gears.push(landingGear(body, g.nose, 0, 0, gearMetal, rubber, chrome, wingPaint, wheels));
        for (const side of [1, -1]) gears.push(landingGear(body, g.main, side * g.main.z, side, gearMetal, rubber, chrome, wingPaint, wheels));
        // Antennas on the spine and the belly, pitot tube under the left wing.
        const spine = shape.front * 0.1 - 14;
        batch.place(boxGeo, dark, spine, shape.section(spine).top + 1, 0, 3.2, 2.2, 0.35, 0, 0, 0.35);
        batch.place(boxGeo, dark, shape.front * 0.2, shape.section(shape.front * 0.2).bottom - 0.7, 0, 2.2, 1.6, 0.3, 0, 0, -0.35);
        const pitot = wings[-1].point(0.55, 0.1);
        batch.rod(new Three.Vector3(pitot.x - 1, pitot.y - 1, pitot.z), new Three.Vector3(pitot.x + 3.2, pitot.y - 1, pitot.z), 0.18, metal);
        // Fin logo on both sides, inside the fin's outline at mid height.
        const logoChord = (fn.rootChord + fn.tipChord) / 2;
        for (const side of [-1, 1])
          aircraftLabel(
            body,
            plan.logo,
            fn.x - fn.sweep * 0.45 - logoChord * 0.42,
            fn.y + fn.height * 0.45,
            side * (logoChord * fn.thickness * 0.5 + 0.15),
            logoChord * 0.78,
            '#f4efe4',
            side > 0 ? 0 : Math.PI,
          );
        batch.flush(body, kind + ' airframe');
        // Lights (halos): parked aircraft keep them dark; animateAircraft runs them.
        const lights = { nav: [], strobes: [], beacons: [], landing: [] },
          lens = (colour) => new Three.MeshBasicMaterial({ color: colour, toneMapped: false });
        for (const [x, y, z, side] of navLights) {
          const colour = side < 0 ? '#ff4a3a' : '#4dff7a';
          mesh(sphereGeo, lens(colour), body, x, y, z, 0.7, 0.5, 0.7);
          lights.nav.push(halo(body, x, y, z, 10, colour));
          lights.strobes.push(halo(body, x - 0.8, y, z, 16, '#ffffff'));
        }
        const [tx, ty] = plan.nav.tail;
        mesh(sphereGeo, lens('#ffffff'), body, tx, ty, 0, 0.6, 0.6, 0.6);
        lights.nav.push(halo(body, tx - 0.4, ty, 0, 9, '#ffffff'));
        lights.strobes.push(halo(body, tx - 0.8, ty, 0, 13, '#ffffff'));
        for (const [x, y, z] of plan.beacons) {
          mesh(sphereGeo, lens('#ff3b2f'), body, x, y, z, 0.8, 0.6, 0.8);
          lights.beacons.push(halo(body, x, y + (y > 12 ? 0.8 : -0.8), z, 11, '#ff4a36'));
        }
        for (const f of plan.landingLights)
          for (const side of [1, -1]) {
            const p = wings[side].point(f, 0.015);
            mesh(sphereGeo, lens('#fff6dc'), body, p.x, p.y, p.z, 0.9, 0.6, 1.2);
            lights.landing.push(halo(body, p.x + 1, p.y, p.z, 22, '#fff3d0'));
          }
        // Taxi light on the nose gear strut.
        const noseGear = gears[0];
        lights.landing.push(halo(noseGear.pivot, 1.2, -(g.nose.top - g.nose.r) * 0.35, 0, 22, '#fff3d0'));
        for (const group of Object.values(lights)) for (const sprite of group) sprite.visible = false;
        return {
          body,
          paint,
          wingPaint,
          canopy,
          prop,
          disc,
          fans,
          wheels,
          gears,
          surfaces,
          lights,
          livery: livery.map,
          // How far the belly sinks to the runway with the gear up.
          bellyDrop: Math.max(0, shape.lowest - 0.4),
          nightLights: [],
          length: shape.front - shape.tail,
        };
      }
      function makePlane(vehicle) {
        const group = new Three.Group();
        scene.add(group);
        const kind = vehicle.airframe === 'jet' || vehicle.airframe === 'airliner' ? vehicle.airframe : 'courier',
          parts = buildAircraft(kind, group, { color: vehicle.color });
        group.name =
          kind === 'airliner' ? 'Oceanview airliner' : kind === 'jet' ? 'South Coast executive jet' : 'Serrano courier';
        return {
          ...parts,
          group,
          strobes: [],
          special: true,
          plane: true,
          propSpeed: 0,
        };
      }
      /**
       * Per frame, for a plane model in view (render3d.js): pose the controls,
       * gear, engines and lights from the simulation, and shake with the buffet.
       */
      function animateAircraft(c, m, deltaSeconds) {
        const alive = c.hp > 0,
          airborne = (c.altitude || 0) > terrainHeight(c.x, c.y) + 1,
          running = alive && (c === player.car || (c.abandonedFlight && airborne)),
          power = c.power ?? c.throttle ?? 0,
          gearPos = c.gearPos ?? 1;
        // The wing and tail paint follow the fuselage's weathering (paintVehicle).
        m.wingPaint.color.copy(m.paint.color);
        m.wingPaint.roughness = m.paint.roughness;
        m.wingPaint.metalness = m.paint.metalness * 0.3;
        m.wingPaint.emissive.copy(m.paint.emissive);
        // A repaired wreck gets its livery back (paintVehicle clears the map).
        if (!m.charred && m.paint.map !== m.livery) {
          m.paint.map = m.livery;
          m.paint.needsUpdate = true;
        }
        // Control surfaces: ailerons opposite, elevators together, rudder, flaps.
        const roll = c.ctrlRoll || 0,
          pitch = c.ctrlPitch || 0,
          yaw = c.ctrlYaw || 0;
        for (const s of m.surfaces.aileron) setSurfaceAngle(s, -s.side * roll * 0.36);
        for (const s of m.surfaces.elevator) setSurfaceAngle(s, -pitch * 0.4);
        for (const s of m.surfaces.rudder) setSurfaceAngle(s, yaw * 0.4);
        for (const s of m.surfaces.flap) setSurfaceAngle(s, (c.flapPos || 0) * 0.7);
        // Gear: mains fold inward, the nose aft (courier) or forward (jets).
        for (const leg of m.gears) {
          const stow = (1 - gearPos) * Math.PI * 0.5;
          if (leg.retract === 'in') leg.pivot.rotation.x = leg.side * stow;
          else leg.pivot.rotation.z = leg.retract === 'aft' ? -stow : stow;
          leg.pivot.visible = gearPos > 0.02;
        }
        // Gear up on the ground: the belly sits on the runway.
        m.body.position.y = airborne ? 0 : -(1 - gearPos) * m.bellyDrop;
        // Propeller / fans: spool with power, coast down when stopped.
        const target = running ? 14 + power * 70 : 0;
        m.propSpeed += (target - m.propSpeed) * (1 - Math.exp(-deltaSeconds * (running ? 1.6 : 0.5)));
        if (m.prop) {
          m.prop.rotation.x += deltaSeconds * m.propSpeed;
          const blur = clamp((m.propSpeed - 20) / 50, 0, 1);
          m.disc.visible = blur > 0.02;
          m.disc.material.opacity = blur * 0.22;
        }
        for (const fan of m.fans) fan.rotation.x += deltaSeconds * m.propSpeed * 1.4;
        // Lights: navigation steady, strobes double-flash, beacons pulse, landing
        // lights with the gear down; all while the engine runs (nav also at night).
        const t = gameTime + (c.id || 0) * 0.37,
          night = nightAmount > 0.25,
          strobe = (t % 1.3 < 0.05 || (t % 1.3 > 0.16 && t % 1.3 < 0.21)) && running,
          beacon = running ? 0.5 + 0.5 * Math.sin(t * 7.5) : 0;
        for (const s of m.lights.nav) {
          s.visible = running || (night && alive && c.ai);
          s.material.opacity = night ? 0.9 : 0.3;
        }
        for (const s of m.lights.strobes) s.visible = strobe;
        for (const s of m.lights.beacons) {
          s.visible = beacon > 0.35;
          s.material.opacity = beacon;
        }
        // By day the landing lights read as a small glint, at night as a beam.
        for (const s of m.lights.landing) {
          s.visible = running && gearPos > 0.9;
          s.material.opacity = night ? 0.9 : 0.14;
        }
        // Buffet: a fast, small shake of the airframe near and in the stall.
        const buffet = c.buffet || 0;
        m.body.rotation.set(
          (c.bank || 0) + (buffet ? Math.sin(gameTime * 43 + 1.7) * buffet * 0.02 : 0),
          0,
          (c.pitch || 0) + (buffet ? Math.sin(gameTime * 37) * buffet * 0.014 : 0),
          'ZYX',
        );
      }
