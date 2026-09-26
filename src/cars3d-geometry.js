      // ---- MERGING KIT ----------------------------------------------------------------
      /* Parts are accumulated into one vertex set per material, with a colour, a
         finish and an atlas UV per vertex (see police3d.js for the police kit). */
      const civMatrix = new Three.Matrix4(),
        civNormalMatrix = new Three.Matrix3(),
        civVector = new Three.Vector3(),
        civQuaternion = new Three.Quaternion(),
        civEuler = new Three.Euler(),
        civScale = new Three.Vector3(),
        civPosition = new Three.Vector3(),
        civColor = new Three.Color(),
        civAxisA = new Three.Vector3(),
        civAxisB = new Three.Vector3(),
        civAxisC = new Three.Vector3(),
        civUpVector = new Three.Vector3(),
        civIdentity = new Three.Matrix4();
      function civSet() {
        return { position: [], normal: [], uv: [], color: [], finish: [], index: [], count: 0 };
      }
      /* options: color, finish ([roughness, metalness] or a CV_FINISH name), cell (an
         atlas cell: the geometry's own UVs map into it), uv (one fixed UV: a
         livery swatch), uvOf (x, y, z) -> [u, v] (a projection into the livery). */
      function civAddMatrix(set, geo, matrix, options = {}) {
        civNormalMatrix.getNormalMatrix(matrix);
        civColor.set(options.color || '#ffffff');
        const pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv,
          base = set.count,
          finish = typeof options.finish === 'string' ? CV_FINISH[options.finish] : options.finish || CV_FINISH.satin,
          rect = options.uv || options.uvOf ? null : trimCellRect(options.cell || 'solid'),
          solid = !options.cell;
        for (let i = 0; i < pos.count; i++) {
          civVector.fromBufferAttribute(pos, i).applyMatrix4(matrix);
          set.position.push(civVector.x, civVector.y, civVector.z);
          if (options.uvOf) set.uv.push(...options.uvOf(civVector.x, civVector.y, civVector.z));
          else if (options.uv) set.uv.push(options.uv[0], options.uv[1]);
          else if (solid) set.uv.push((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);
          else {
            const u = uv ? uv.getX(i) : 0,
              v = uv ? uv.getY(i) : 0;
            set.uv.push(rect[0] + (rect[2] - rect[0]) * (u - Math.floor(u === 1 ? 0 : u)), rect[1] + (rect[3] - rect[1]) * (v - Math.floor(v === 1 ? 0 : v)));
          }
          if (nor) {
            civVector.fromBufferAttribute(nor, i).applyMatrix3(civNormalMatrix).normalize();
            set.normal.push(civVector.x, civVector.y, civVector.z);
          } else set.normal.push(0, 1, 0);
          set.color.push(civColor.r, civColor.g, civColor.b);
          set.finish.push(finish[0], finish[1]);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) set.index.push(base + geo.index.getX(i));
        else for (let i = 0; i < pos.count; i++) set.index.push(base + i);
        set.count += pos.count;
      }
      function civAdd(set, geo, x, y, z, sx, sy, sz, options, rx = 0, ry = 0, rz = 0) {
        civMatrix.compose(civPosition.set(x, y, z), civQuaternion.setFromEuler(civEuler.set(rx, ry, rz)), civScale.set(sx, sy, sz));
        civAddMatrix(set, geo, civMatrix, options);
      }
      // A unit shape stretched from a to b: `height` along `up`, `depth` across both.
      function civBeam(set, geo, a, b, height, depth, options, up = [0, 1, 0]) {
        civAxisA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = civAxisA.length();
        if (length < 1e-4) return;
        civAxisA.divideScalar(length);
        civUpVector.set(up[0], up[1], up[2]);
        civAxisC.crossVectors(civAxisA, civUpVector);
        if (civAxisC.lengthSq() < 1e-8) civAxisC.set(0, 0, 1);
        civAxisC.normalize();
        civAxisB.crossVectors(civAxisC, civAxisA).normalize();
        civMatrix.makeBasis(civAxisA.multiplyScalar(length), civAxisB.multiplyScalar(height), civAxisC.multiplyScalar(depth));
        civMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        civAddMatrix(set, geo, civMatrix, options);
      }
      // A bar with rounded edges from a to b (police3d.js roundedBar, which runs along z).
      function civBar(set, a, b, height, depth, radius, options, up = [0, 1, 0]) {
        civAxisA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = civAxisA.length();
        if (length < 1e-3) return;
        civAxisA.divideScalar(length);
        civUpVector.set(up[0], up[1], up[2]);
        civAxisC.crossVectors(civUpVector, civAxisA);
        if (civAxisC.lengthSq() < 1e-8) civAxisC.set(1, 0, 0);
        civAxisC.normalize();
        civAxisB.crossVectors(civAxisA, civAxisC).normalize();
        // Thin strips (LED lines, frames, rails) are plain boxes: at that size a
        // rounded edge is sub-pixel and costs a hundred triangles.
        const thin = options.box || Math.min(height, depth) < 0.07 * CAR_M,
          geo = thin ? boxGeo : roundedBar(+length.toFixed(2), +height.toFixed(2), +depth.toFixed(2), +Math.min(radius, height / 2, depth / 2).toFixed(2));
        if (thin) civMatrix.makeBasis(civAxisC.multiplyScalar(depth), civAxisB.multiplyScalar(height), civAxisA.multiplyScalar(length));
        else civMatrix.makeBasis(civAxisC, civAxisB, civAxisA);
        civMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        civAddMatrix(set, geo, civMatrix, options);
      }
      // A disc-like unit cylinder at (x, y, z) facing `normal`: radius r, thickness t.
      const civFacing = new Three.Vector3(),
        civYAxis = new Three.Vector3(0, 1, 0);
      function civDisc(set, geo, x, y, z, r, t, normal, options, ry = 0) {
        civFacing.set(normal[0], normal[1], normal[2]).normalize();
        civQuaternion.setFromUnitVectors(civYAxis, civFacing);
        if (ry) civQuaternion.multiply(new Three.Quaternion().setFromAxisAngle(civYAxis, ry));
        civMatrix.compose(civPosition.set(x, y, z), civQuaternion, civScale.set(r, t, r));
        civAddMatrix(set, geo, civMatrix, options);
      }
      function civGeometry(set, { colors = true, finish = true } = {}) {
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(set.position, 3));
        g.setAttribute('normal', new Three.Float32BufferAttribute(set.normal, 3));
        g.setAttribute('uv', new Three.Float32BufferAttribute(set.uv, 2));
        if (colors) g.setAttribute('color', new Three.Float32BufferAttribute(set.color, 3));
        if (finish) g.setAttribute('finish', new Three.Float32BufferAttribute(set.finish, 2));
        g.setIndex(set.count > 65535 ? new Three.Uint32BufferAttribute(set.index, 1) : set.index);
        g.computeBoundingSphere();
        sharedGeometries.add(g);
        return g;
      }
      // Shapes the kits share (unit sizes).
      let civShapes = null;
      function civShapeKit() {
        if (civShapes) return civShapes;
        const hexPrism = new Three.CylinderGeometry(1, 1, 1, 6);
        civShapes = {
          ...policeShapeKit(),
          // (Named for the old count: 16 sides reads round at any street zoom.)
          cylinder24: new Three.CylinderGeometry(1, 1, 1, 16),
          hex: hexPrism,
          tube: new Three.CylinderGeometry(1, 1, 1, 12, 1, true),
          cone: new Three.CylinderGeometry(0.62, 1, 1, 12),
          torus: new Three.TorusGeometry(1, 0.12, 3, 14),
          ring: new Three.TorusGeometry(1, 0.06, 3, 18),
          halfTorus: new Three.TorusGeometry(1, 0.1, 4, 10, Math.PI),
          box: boxGeo,
          plane: new Three.PlaneGeometry(1, 1),
          // A low dome for lamp lenses and projectors (48 triangles).
          lowDome: new Three.SphereGeometry(1, 8, 3, 0, TAU, 0, Math.PI / 2),
        };
        return civShapes;
      }
      // ---- LOFTED BODY ----------------------------------------------------------------------
      // Profile at t: [width factor, top, bottom] (bottom defaults to the body's underside).
      function civProfileAt(body, t) {
        const profile = body.profile;
        let a = profile[0],
          b = profile[profile.length - 1];
        if (t <= a[0]) b = a;
        else if (t >= b[0]) a = b;
        else
          for (let k = 0; k < profile.length - 1; k++)
            if (t <= profile[k + 1][0]) {
              a = profile[k];
              b = profile[k + 1];
              break;
            }
        const f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0,
          bottomA = a[3] ?? body.yb,
          bottomB = b[3] ?? body.yb;
        // Wheel-arch bulges: the body swells over each axle (`arches`, a share of
        // the width; `archSpan`, their half length as a share of the car's).
        let wf = lerpNumber(a[1], b[1], f);
        if (body.arches) {
          const span = body.archSpan || 0.09;
          for (const axle of [body.wheel.xf, body.wheel.xr]) {
            const d = Math.abs(t - axle) / span;
            if (d < 1) wf *= 1 + body.arches * (0.5 + 0.5 * Math.cos(d * Math.PI));
          }
        }
        return [wf, lerpNumber(a[2], b[2], f), lerpNumber(bottomA, bottomB, f)];
      }
      // The cross-section at t: `sections` ([t, section] keyframes) blended, or the one section.
      const civSectionScratch = [];
      function civSectionAt(body, t) {
        const keys = body.sections;
        if (!keys) return body.section;
        let a = keys[0],
          b = keys[keys.length - 1];
        if (t <= a[0]) b = a;
        else if (t >= b[0]) a = b;
        else
          for (let k = 0; k < keys.length - 1; k++)
            if (t <= keys[k + 1][0]) {
              a = keys[k];
              b = keys[k + 1];
              break;
            }
        const f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
        civSectionScratch.length = a[1].length;
        for (let i = 0; i < a[1].length; i++) civSectionScratch[i] = [lerpNumber(a[1][i][0], b[1][i][0], f), lerpNumber(a[1][i][1], b[1][i][1], f)];
        return civSectionScratch;
      }
      function civRing(section) {
        const side = section.slice(0, -1);
        return [...side.map(([n, z]) => [n, -z]), [1, 0], ...side.slice().reverse().map(([n, z]) => [n, z])];
      }
      const civShells = new Map();
      /*
       * The shell: sections lofted along the profile (slices closer together at the
       * ends and at every profile break), capped, smooth-shaded, with the police
       * livery UVs (u along the car, v round the reference section).
       */
      function civShellGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (civShells.has(key)) return civShells.get(key);
        const vs = policeRingV(body, w),
          ts = [];
        for (let i = 0; i <= 30; i++) ts.push(-0.5 * Math.cos((i / 30) * Math.PI));
        for (const p of body.profile) ts.push(p[0]);
        for (const [t] of body.sections || []) ts.push(t);
        ts.sort((a, b) => a - b);
        const slices = ts.filter((t, i) => i === 0 || t - ts[i - 1] > 0.003),
          n = civRing(body.section).length,
          position = [],
          uv = [],
          index = [];
        for (const t of slices) {
          const [wf, top, bottom] = civProfileAt(body, t),
            ring = civRing(civSectionAt(body, t));
          for (let j = 0; j < n; j++) {
            const [nh, zf] = ring[j];
            position.push(t * l, bottom + nh * (top - bottom), (zf * wf * w) / 2);
            uv.push(t + 0.5, vs[j]);
          }
        }
        const count = slices.length;
        for (let k = 0; k < count - 1; k++)
          for (let j = 0; j < n; j++) {
            const a = k * n + j,
              b = k * n + ((j + 1) % n),
              c = (k + 1) * n + ((j + 1) % n),
              d = (k + 1) * n + j;
            index.push(a, b, d, b, c, d);
          }
        for (const [k, u] of [[0, 0], [count - 1, 1]]) {
          const centre = position.length / 3;
          let y = 0;
          for (let j = 0; j < n; j++) y += position[(k * n + j) * 3 + 1];
          position.push(slices[k] * l, y / n, 0);
          uv.push(u, (POLICE_SWATCH_BAND + 1) / 2);
          for (let j = 0; j < n; j++) index.push(centre, k * n + ((j + 1) % n), k * n + j);
        }
        const middle = (body.yb + body.h) / 2;
        orientOutward(position, index, (p, out) => out.set(clamp(p.x, -0.46 * l, 0.46 * l), middle, 0));
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uv, 2));
        geo.setIndex(index);
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        sharedGeometries.add(geo);
        civShells.set(key, geo);
        return geo;
      }
      // The shell's half width, top and bottom at (x, y).
      function civShellAt(body, l, w, x, y) {
        const t = x / l,
          [wf, top, bottom] = civProfileAt(body, t),
          section = civSectionAt(body, t),
          nh = clamp((y - bottom) / Math.max(1e-6, top - bottom), 0, section.reduce((m, [n]) => Math.max(m, n), 1));
        let zf = section[section.length - 1][1];
        for (let k = 0; k < section.length - 1; k++) {
          const [n0, z0] = section[k],
            [n1, z1] = section[k + 1];
          if (nh <= n1) {
            zf = n1 > n0 ? lerpNumber(z0, z1, (nh - n0) / (n1 - n0)) : z1;
            break;
          }
        }
        return { half: (zf * wf * w) / 2, top, bottom, wf };
      }
      // ---- Glasshouse ----------------------------------------------------------------------
      const civCabins = new Map();
      /*
       * Five panes in PANE_ORDER (left, front, right, rear, roof), like the police
       * glasshouse, but the side glass may start part-way along (`sideFrom`, where a
       * buttress or an intake takes over) and an open car's rear and roof panes are
       * empty (a roadster's screen and door glass only).
       */
      function civCabinGeometry(body, l, w) {
        const key = body.name + ':' + l + ':' + w;
        if (civCabins.has(key)) return civCabins.get(key);
        const g = body.glass,
          from = g.sideFrom || 0,
          centreX = ((g.xf + g.xb + g.rf + g.rb) / 4) * l,
          inside = (p, out) => out.set(centreX, g.base - 2, 0),
          empty = () => gridGeometry(1, 1, () => [centreX, g.base, 0], inside),
          panes = [
            gridGeometry(5, 2, (u, v) => glassPoint(g, l, w, 'side', lerpNumber(from, 1, u), v, -1), inside),
            gridGeometry(8, 4, (u, v) => glassPoint(g, l, w, 'front', u * 2 - 1, v), inside),
            gridGeometry(5, 2, (u, v) => glassPoint(g, l, w, 'side', lerpNumber(from, 1, u), v, 1), inside),
            g.open ? empty() : gridGeometry(8, 3, (u, v) => glassPoint(g, l, w, 'rear', u * 2 - 1, v), inside),
            g.open ? empty() : gridGeometry(5, 4, (u, v) => glassPoint(g, l, w, 'roof', u * 2 - 1, v), inside),
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
        civCabins.set(key, geo);
        return geo;
      }
