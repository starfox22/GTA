      // ---- Surface maths ------------------------------------------------------------------
      // Monotone cubic interpolation (Fritsch-Carlson): smooth, never overshoots.
      function heliMonotone(xs, ys) {
        let lastX = NaN,
          lastY = 0;
        const n = xs.length,
          d = [],
          m = new Array(n);
        for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
        m[0] = d[0];
        m[n - 1] = d[n - 2];
        for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
        for (let i = 0; i < n - 1; i++) {
          if (d[i] === 0) {
            m[i] = m[i + 1] = 0;
            continue;
          }
          const a = m[i] / d[i],
            b = m[i + 1] / d[i],
            s = a * a + b * b;
          if (s > 9) {
            const t = 3 / Math.sqrt(s);
            m[i] = t * a * d[i];
            m[i + 1] = t * b * d[i];
          }
        }
        // Remembers the last answer: the livery painter asks for one x a column at a time.
        return (x) => {
          if (x === lastX) return lastY;
          lastX = x;
          if (x <= xs[0]) return (lastY = ys[0]);
          if (x >= xs[n - 1]) return (lastY = ys[n - 1]);
          let i = 0;
          while (x > xs[i + 1]) i++;
          const h = xs[i + 1] - xs[i],
            t = (x - xs[i]) / h,
            t2 = t * t,
            t3 = t2 * t;
          return (lastY = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]);
        };
      }
      function heliStation(plan, x) {
        const s = plan.spline;
        return { x, yb: s[0](x), yt: s[1](x), yw: s[2](x), w: Math.max(0.02, s[3](x) * plan.widen), nu: s[4](x), nl: s[5](x) };
      }
      // A section point at `theta` (-PI/2 the keel, 0 starboard, PI/2 the crown).
      function heliSection(st, theta, out) {
        const c = Math.cos(theta),
          s = Math.sin(theta),
          upper = s >= 0,
          e = 2 / (upper ? st.nu : st.nl);
        out.z = st.w * Math.sign(c) * Math.pow(Math.abs(c), e);
        out.y = st.yw + (upper ? st.yt - st.yw : st.yw - st.yb) * Math.sign(s) * Math.pow(Math.abs(s), e);
        return out;
      }
      // The section angle at height y on one side (inverse of heliSection).
      function heliSideTheta(st, y, side) {
        const upper = y >= st.yw,
          h = Math.max(1e-4, upper ? st.yt - st.yw : st.yw - st.yb),
          s = Math.sign(y - st.yw) * Math.pow(Math.min(1, Math.abs(y - st.yw) / h), (upper ? st.nu : st.nl) / 2),
          t = Math.asin(s);
        return side >= 0 ? t : Math.PI - t;
      }
      const heliScratch = { y: 0, z: 0 };
      function heliSurfaceZ(st, y, side) {
        return heliSection(st, heliSideTheta(st, y, side), heliScratch).z;
      }
      function heliSurfaceTop(st, z) {
        const c = Math.pow(Math.min(1, Math.abs(z) / st.w), st.nu / 2),
          s = Math.sqrt(Math.max(0, 1 - c * c));
        return st.yw + (st.yt - st.yw) * Math.pow(s, 2 / st.nu);
      }
      // Sample planes along x: every key and mark, then no further apart than `step`.
      function heliSamples(plan) {
        const marks = [...new Set([...plan.keys.map((k) => k[0]), ...plan.marks])].sort((a, b) => a - b),
          xs = [];
        for (let i = 0; i < marks.length - 1; i++) {
          const a = marks[i],
            b = marks[i + 1],
            n = Math.max(1, Math.ceil((b - a) / plan.step((a + b) / 2)));
          for (let k = 0; k < n; k++) xs.push(a + ((b - a) * k) / n);
        }
        xs.push(marks[marks.length - 1]);
        return xs;
      }
      /*
       * A lofted grid: rows at `xs`, `segments` + 1 columns round each ring (the last
       * repeats the first for the texture seam). Normals come from the surface's
       * partial derivatives, so the seam and the tips shade smoothly.
       */
      function heliLoftGrid(stationAt, xs, segments) {
        const rows = xs.length,
          cols = segments + 1,
          P = new Float32Array(rows * cols * 3),
          N = new Float32Array(rows * cols * 3),
          pt = { y: 0, z: 0 },
          a = new Three.Vector3(),
          b = new Three.Vector3(),
          tx = new Three.Vector3(),
          tr = new Three.Vector3(),
          n = new Three.Vector3(),
          at = (x, theta, out) => {
            heliSection(stationAt(x), theta, pt);
            return out.set(x, pt.y, pt.z);
          };
        for (let i = 0; i < rows; i++) {
          const x = xs[i],
            st = stationAt(x),
            hx = Math.max(0.04, (xs[Math.min(rows - 1, i + 1)] - xs[Math.max(0, i - 1)]) * 0.2);
          for (let j = 0; j < cols; j++) {
            const theta = (j / segments) * TAU - Math.PI / 2,
              k = (i * cols + j) * 3;
            heliSection(st, theta, pt);
            P[k] = x;
            P[k + 1] = pt.y;
            P[k + 2] = pt.z;
            const ht = (TAU / segments) * 0.35;
            tr.subVectors(at(x, theta + ht, a), at(x, theta - ht, b));
            tx.subVectors(at(x + hx, theta, a), at(x - hx, theta, b));
            n.crossVectors(tx, tr);
            if (n.lengthSq() < 1e-10 || tr.lengthSq() < 1e-8) n.set(Math.sign(x - (xs[0] + xs[rows - 1]) / 2), 0, 0);
            n.normalize();
            N[k] = n.x;
            N[k + 1] = n.y;
            N[k + 2] = n.z;
          }
        }
        return { P, N, rows, cols, xs };
      }
      // ---- Merge helpers (police3d.js MERGING KIT underneath) ---------------------------------
      const heliMatrix = new Three.Matrix4(),
        heliQuat = new Three.Quaternion(),
        heliUp = new Three.Vector3(0, 1, 0),
        heliV1 = new Three.Vector3(),
        heliV2 = new Three.Vector3(),
        heliColor = new Three.Color();
      // Raw triangles into a merge set: positions / normals as flat arrays.
      function heliPushVertex(set, x, y, z, nx, ny, nz, u, v, color, channel = 0) {
        set.position.push(x, y, z);
        set.normal.push(nx, ny, nz);
        set.uv.push(u, v);
        set.color.push(color.r, color.g, color.b);
        set.channel.push(channel);
        return set.count++;
      }
      // A cylinder (or any unit shape along y) from a to b.
      function heliRod(set, a, b, r, color, geo = cylinderGeo, rz = r) {
        heliV1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const length = heliV1.length();
        if (length < 1e-4) return;
        heliQuat.setFromUnitVectors(heliUp, heliV1.divideScalar(length));
        heliMatrix.compose(heliV2.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), heliQuat, new Three.Vector3(r, length, rz));
        policeAddMatrix(set, geo, heliMatrix, color);
      }
      // A tube along a smooth curve through `points` ([x, y, z] each).
      function heliTube(set, points, r, color, segments = 24) {
        const curve = new Three.CatmullRomCurve3(points.map((p) => new Three.Vector3(p[0], p[1], p[2]))),
          tube = new Three.TubeGeometry(curve, segments, r, 8, false);
        policeAddMatrix(set, tube, heliMatrix.identity(), color);
        tube.dispose();
      }
      /*
       * A closed sweep through rings of points (each ring the same count, a closed
       * loop); both ends capped. Normals are averaged, so it shades smoothly.
       */
      function heliSweep(rings) {
        const count = rings[0].length,
          positions = [],
          indices = [];
        for (const ring of rings) for (const p of ring) positions.push(p[0], p[1], p[2]);
        for (let i = 0; i < rings.length - 1; i++)
          for (let j = 0; j < count; j++) {
            const a = i * count + j,
              b = (i + 1) * count + j,
              c = (i + 1) * count + ((j + 1) % count),
              d = i * count + ((j + 1) % count);
            indices.push(a, b, c, a, c, d);
          }
        for (const [k, flip] of [
          [0, true],
          [rings.length - 1, false],
        ]) {
          const ring = rings[k],
            centre = ring.reduce((s, p) => [s[0] + p[0] / count, s[1] + p[1] / count, s[2] + p[2] / count], [0, 0, 0]),
            base = positions.length / 3;
          positions.push(...centre);
          for (const p of ring) positions.push(p[0], p[1], p[2]);
          for (let j = 0; j < count; j++) {
            const p0 = base + 1 + j,
              p1 = base + 1 + ((j + 1) % count);
            if (flip) indices.push(base, p0, p1);
            else indices.push(base, p1, p0);
          }
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
      }
      function heliAddSweep(set, rings, color) {
        const geo = heliSweep(rings);
        policeAddMatrix(set, geo, heliMatrix.identity(), color);
        geo.dispose();
      }
      // ---- Shared materials --------------------------------------------------------------------
      let heliShared = null;
      function heliMaterials() {
        if (heliShared) return heliShared;
        heliShared = {
          trim: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }),
          metal: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }),
          interior: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 }),
          blade: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }),
          // Spinning blades still throw their shadow but draw nothing (the disc shows them).
          shadowOnly: new Three.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
          halos: {},
          glass: {},
          discGeometry: new Three.CircleGeometry(1, 72),
        };
        for (const m of [heliShared.trim, heliShared.metal, heliShared.interior, heliShared.blade, heliShared.shadowOnly]) sharedMaterials.add(m);
        sharedGeometries.add(heliShared.discGeometry);
        return heliShared;
      }
      // Anchor sprites for the halo pass share one material per colour (never drawn).
      function heliHaloMaterial(color) {
        const M = heliMaterials();
        if (!M.halos[color]) {
          M.halos[color] = new Three.SpriteMaterial({ color });
          sharedMaterials.add(M.halos[color]);
        }
        return M.halos[color];
      }
      // Tinted, reflective glass; each model owns a copy (it soots with the wear).
      function heliGlassMaterial(tint) {
        const M = heliMaterials();
        if (!M.glass[tint]) {
          M.glass[tint] = new Three.MeshStandardMaterial({
            color: tint,
            roughness: 0.04,
            metalness: 0.9,
            envMapIntensity: 1.5,
            transparent: true,
            opacity: 0.46,
            depthWrite: false,
          });
          sharedMaterials.add(M.glass[tint]);
        }
        return M.glass[tint];
      }
      const heliLightGain = { value: 3.4 };
      function heliLightMaterial() {
        return new Three.ShaderMaterial({
          uniforms: { ...Three.UniformsUtils.clone(Three.UniformsLib.fog), levels: { value: new Float32Array(8) }, gain: heliLightGain },
          vertexShader: POLICE_LIGHT_VERTEX,
          fragmentShader: POLICE_LIGHT_FRAGMENT,
          vertexColors: true,
          fog: true,
        });
      }
      /*
       * HELI DISC: the blur of a spinning rotor. A flat disc (radius 1, scaled) whose
       * alpha is a light even smear, `uBlades` ghosts trailing behind their leading
       * edges (a trail of equal arc length at every radius, like a real blade seen at
       * a long exposure), the tip paint as a ring, a clear hub and a soft rim. The
       * ghosts drift round at `uPhase`.
       */
      const HELI_DISC_VERTEX = `
        #include <common>
        #include <fog_pars_vertex>
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
        HELI_DISC_FRAGMENT = `
        #include <common>
        #include <fog_pars_fragment>
        uniform float uBlur;
        uniform float uPhase;
        uniform float uBlades;
        uniform float uHub;
        uniform float uTip;
        uniform float uTrail;
        uniform float uSmear;
        uniform vec3 uColor;
        uniform vec3 uTipColor;
        varying vec2 vPos;
        void main() {
          float r = length( vPos );
          float rim = 1.0 - smoothstep( 0.93, 1.0, r );
          float hub = smoothstep( uHub, uHub + 0.05, r );
          float spacing = 6.28318530718 / uBlades;
          float a = atan( vPos.y, vPos.x ) - uPhase;
          float sector = fract( a / spacing );
          // Arc (in radii) behind and ahead of the nearest blade at this radius.
          float behind = ( 1.0 - sector ) * spacing * r;
          float ahead = sector * spacing * r;
          float ghost = exp( -behind / uTrail ) + exp( -ahead / ( uTrail * 0.12 ) );
          // The painted tips smear into a faint band, soft on both edges.
          float tip = smoothstep( uTip - 0.04, uTip + 0.01, r ) * ( 1.0 - smoothstep( 0.965, 1.0, r ) );
          float alpha = uBlur * rim * hub * ( uSmear * ( 0.75 + 0.25 * r ) + 0.24 * ghost + 0.05 * tip );
          gl_FragColor = vec4( mix( uColor, uTipColor, tip ), alpha );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`;
      function heliDiscMaterial(o) {
        return new Three.ShaderMaterial({
          uniforms: {
            ...Three.UniformsUtils.clone(Three.UniformsLib.fog),
            uBlur: { value: 0 },
            uPhase: { value: 0 },
            uBlades: { value: o.blades },
            uHub: { value: o.hub },
            uTip: { value: o.tip },
            uTrail: { value: o.trail },
            uSmear: { value: o.smear },
            uColor: { value: new Three.Color(o.color) },
            uTipColor: { value: new Three.Color(o.tipColor) },
          },
          vertexShader: HELI_DISC_VERTEX,
          fragmentShader: HELI_DISC_FRAGMENT,
          transparent: true,
          depthWrite: false,
          side: Three.DoubleSide,
          fog: true,
        });
      }
