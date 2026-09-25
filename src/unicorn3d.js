      // BEGIN SUBSYSTEM: src/unicorn3d.js — The Unicorn Fountain on Sunset Pier
      /**
       * The Unicorn Fountain on Sunset Pier
       * Source: src/unicorn3d.js
       * Scope: createCityRenderer() closure (included by themepark3d.js, after
       * the gate; uses parkParts, parkMats, parkBulbs and parkGlowPoints).
       * Aurora, a rearing unicorn in pearlescent white marble with a gilded horn
       * and hooves, on a tiered plinth (a bronze plaque on its octagonal die) in
       * the middle of a round basin in the park's forecourt (PIER.unicorn), with
       * eight arcing jets. The statue is sculpted from Catmull-Rom tubes with
       * elliptical sections (body, neck, head, legs, mane and tail locks, the
       * spiral horn), modelled in life-size metres and scaled up. At night four
       * warm uplights on the plinth light her (a shader term on her marble, see
       * UPLIGHTS), the horn glows in slowly shifting pastels and the basin's
       * lamps colour the jets. Everything static is merged per material.
       */
      const UNICORN = PIER.unicorn,
        // Metres of statue to world units (about twice life size); the plinth top.
        UNICORN_SCALE = 16,
        UNICORN_PLINTH_TOP = 19.5,
        UNICORN_WATER = 3.3,
        // The plinth's octagonal die (circumradius) and the plaque's height on it.
        DIE = 7.8,
        PLAQUE_Y = 11.6;
      const unicornFountainMeshes = [],
        unicornHornTip = new Three.Vector3();
      /**
       * UPLIGHTS
       * The island has no city light map, so the uplights are a small term of
       * their own on the statue's and the plinth's material: four lamps on the
       * plinth ledge, each lighting what faces it and rises above it, fading
       * with distance, scaled by the night. The same patch gives the statue's
       * marble a pearl sheen (a pastel shift towards the grazing edges).
       */
      const unicornUniforms = {
        unicornLights: { value: [0, 1, 2, 3].map(() => new Three.Vector3()) },
        unicornLightColor: { value: new Three.Color('#ffc890') },
        unicornLightPower: { value: 0 },
      };
      const UNICORN_PARS = `
        uniform vec3 unicornLights[ 4 ];
        uniform vec3 unicornLightColor;
        uniform float unicornLightPower;
        uniform float unicornPearl;
        uniform float unicornUplight;`,
        UNICORN_PEARL = `
        {
          float unicornEdge = pow( 1.0 - clamp( abs( dot( normal, normalize( vViewPosition ) ) ), 0.0, 1.0 ), 1.6 );
          vec3 unicornTint = 0.5 + 0.5 * cos( 6.2832 * ( unicornEdge * 0.85 + vCityWorld.y * 0.012 + vec3( 0.0, 0.33, 0.67 ) ) );
          diffuseColor.rgb *= mix( vec3( 1.0 ), 0.72 + 0.4 * unicornTint, unicornPearl * ( 0.25 + 0.75 * unicornEdge ) );
        }`,
        UNICORN_UPLIGHT = `
        if ( unicornLightPower > 0.001 ) {
          vec3 unicornNormal = inverseTransformDirection( normal, viewMatrix );
          float unicornLit = 0.0;
          for ( int i = 0; i < 4; i++ ) {
            vec3 toLamp = unicornLights[ i ] - vCityWorld;
            float d = length( toLamp );
            toLamp /= max( d, 0.001 );
            // Aimed up: full above the lamp, nothing below its lens.
            float beam = smoothstep( -0.15, 0.45, -toLamp.y );
            unicornLit += max( dot( unicornNormal, toLamp ), 0.0 ) * beam / ( 1.0 + d * d / 1400.0 );
          }
          vec3 unicornLight = unicornLightColor * unicornLit * unicornLightPower * unicornUplight;
          reflectedLight.directDiffuse += unicornLight * material.diffuseColor;
          reflectedLight.directSpecular += unicornLight * 0.25 * ( 1.0 - material.roughness );
        }`;
      function unicornMaterial(color, roughness, pearl, uplight) {
        const m = new Three.MeshStandardMaterial({ color, roughness, metalness: 0 }),
          own = { unicornPearl: { value: pearl }, unicornUplight: { value: uplight } };
        m.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          Object.assign(shader.uniforms, unicornUniforms, own);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n' + UNICORN_PARS)
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + UNICORN_PEARL)
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + UNICORN_UPLIGHT);
        };
        m.customProgramCacheKey = () => 'unicorn-marble';
        return m;
      }
      const unicornMats = {
        // The statue's marble takes the uplights fully; the warm sandstone of the
        // plinth and basin (which sets the white statue off) only their spill.
        marble: unicornMaterial('#f7f4ef', 0.3, 0.8, 1),
        stone: unicornMaterial('#d9c299', 0.66, 0, 0.18),
        horn: new Three.MeshStandardMaterial({ color: '#f0c860', roughness: 0.2, metalness: 0.95, emissive: '#ffd6f0', emissiveIntensity: 0 }),
        bronze: mat('#7a5530', 0.42, 0.75),
      };
      /**
       * SCULPTED TUBES
       * Control rings {p: [x, y, z], r, w, o}: centre, the half-size along the
       * frame's normal (r) and across it (w), and an offset of the centre along
       * the normal (o). Centres and sizes are Catmull-Rom interpolated, `perSpan`
       * rings between control rings, `sides` round. The normal is `hint` made
       * square to the tube, so a flattened lock's broad side can be turned
       * towards the sky (the camera) or sideways. `groove(angle, s)` scales the
       * section (the horn's spiral); `cap` closes the far end (hooves).
       */
      const unicornCatmull = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
      function unicornTube(ctrl, { perSpan = 3, sides = 10, hint = [0, 1, 0], groove = null, cap = false } = {}) {
        const n = ctrl.length,
          at = (i) => ctrl[Math.max(0, Math.min(n - 1, i))],
          rings = [];
        for (let i = 0; i < n - 1; i++)
          for (let k = 0; k < (i === n - 2 ? perSpan + 1 : perSpan); k++) {
            const t = k / perSpan,
              a = at(i - 1),
              b = at(i),
              c = at(i + 1),
              d = at(i + 2),
              f = (get) => unicornCatmull(get(a), get(b), get(c), get(d), t);
            rings.push({
              p: [0, 1, 2].map((j) => f((q) => q.p[j])),
              r: Math.max(0.0015, f((q) => q.r)),
              w: Math.max(0.0015, f((q) => q.w ?? q.r)),
              o: f((q) => q.o || 0),
            });
          }
        const count = rings.length,
          pos = [],
          idx = [],
          tangent = new Three.Vector3(),
          normal = new Three.Vector3(),
          side = new Three.Vector3(),
          hintV = new Three.Vector3(...hint),
          prevNormal = new Three.Vector3();
        for (let i = 0; i < count; i++) {
          const a = rings[Math.max(0, i - 1)].p,
            b = rings[Math.min(count - 1, i + 1)].p,
            ring = rings[i];
          tangent.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
          normal.copy(hintV).addScaledVector(tangent, -hintV.dot(tangent));
          if (normal.lengthSq() < 0.04) normal.copy(prevNormal).addScaledVector(tangent, -prevNormal.dot(tangent));
          normal.normalize();
          prevNormal.copy(normal);
          side.crossVectors(tangent, normal).normalize();
          for (let k = 0; k < sides; k++) {
            const angle = (k / sides) * TAU,
              g = groove ? groove(angle, i / (count - 1)) : 1,
              u = Math.cos(angle) * ring.r * g + ring.o,
              v = Math.sin(angle) * ring.w * g;
            pos.push(ring.p[0] + normal.x * u + side.x * v, ring.p[1] + normal.y * u + side.y * v, ring.p[2] + normal.z * u + side.z * v);
          }
        }
        for (let i = 0; i < count - 1; i++)
          for (let k = 0; k < sides; k++) {
            const k2 = (k + 1) % sides,
              a = i * sides + k,
              b = i * sides + k2,
              c = (i + 1) * sides + k,
              d = (i + 1) * sides + k2;
            idx.push(a, b, c, b, d, c);
          }
        if (cap) {
          const last = rings[count - 1].p,
            centre = pos.length / 3;
          pos.push(last[0], last[1], last[2]);
          for (let k = 0; k < sides; k++) idx.push((count - 1) * sides + k, (count - 1) * sides + ((k + 1) % sides), centre);
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
      }
      /* Aurora in life-size metres: x forward, y up, z to her left. She rears on
         her hind legs, the body pitched up 35 degrees, forelegs folded, the neck
         arched and the head bowed, the horn thrust forward; the mane streams
         back to her right and the tail sweeps down to the plinth (the
         sculptor's third point of support) and flicks out behind. */
      function unicornStatue(parts, matrix) {
        const add = (material, geo) => parts.add(material, geo, matrix),
          pitch = (42 * Math.PI) / 180,
          dir = [Math.cos(pitch), Math.sin(pitch)],
          up = [-Math.sin(pitch), Math.cos(pitch)],
          rumpX = -0.62,
          rumpY = 0.98,
          length = 1.45,
          // A point in the body's frame: t along the spine, `rise` towards the back.
          body = (t, rise = 0, z = 0) => [rumpX + dir[0] * t * length + up[0] * rise, rumpY + dir[1] * t * length + up[1] * rise, z],
          offset = (p, dx, dy, dz = 0) => [p[0] + dx, p[1] + dy, p[2] + dz];
        let hornTip = null;
        // The rock she rears from, carved out of the same block.
        {
          const rock = new Three.IcosahedronGeometry(1, 1);
          rock.scale(0.52, 0.1, 0.38);
          rock.translate(-0.3, -0.045, 0);
          add(unicornMats.marble, rock);
        }
        // Barrel: round hindquarters, a lean flank, a deep chest.
        add(
          unicornMats.marble,
          unicornTube(
            [
              { p: body(-0.05), r: 0.05, w: 0.05, o: 0.07 },
              { p: body(0.02), r: 0.24, w: 0.2, o: 0.06 },
              { p: body(0.13), r: 0.345, w: 0.3, o: 0.03 },
              { p: body(0.28), r: 0.33, w: 0.27 },
              { p: body(0.48), r: 0.315, w: 0.245, o: -0.035 },
              { p: body(0.7), r: 0.345, w: 0.255, o: -0.02 },
              { p: body(0.86), r: 0.35, w: 0.25 },
              { p: body(0.96), r: 0.28, w: 0.22, o: 0.02 },
              { p: body(1.02), r: 0.14, w: 0.13 },
              { p: body(1.05), r: 0.02, w: 0.02 },
            ],
            { perSpan: 2, sides: 14, hint: [up[0], up[1], 0] },
          ),
        );
        // Neck: out of the top of the chest, a long arch up to the poll.
        const withers = body(0.86, 0.1),
          neck = [
            { p: withers, r: 0.3, w: 0.2 },
            { p: offset(withers, 0.15, 0.34), r: 0.24, w: 0.155 },
            { p: offset(withers, 0.27, 0.66), r: 0.18, w: 0.125 },
            { p: offset(withers, 0.31, 0.91), r: 0.145, w: 0.108 },
            { p: offset(withers, 0.3, 1.03), r: 0.125, w: 0.1 },
          ];
        add(unicornMats.marble, unicornTube(neck, { perSpan: 2, sides: 12, hint: [-1, 0.25, 0] }));
        // Head: bowed 40 degrees below level from the poll; the jaw deep at the back.
        const poll = offset(neck[4].p, 0.02, 0.05),
          headDown = (40 * Math.PI) / 180,
          hd = [Math.cos(headDown), -Math.sin(headDown)],
          hn = [Math.sin(headDown), Math.cos(headDown)],
          headLength = 0.64,
          head = (s, rise = 0, z = 0) => [poll[0] + hd[0] * s * headLength + hn[0] * rise, poll[1] + hd[1] * s * headLength + hn[1] * rise, z];
        add(
          unicornMats.marble,
          unicornTube(
            [
              { p: head(-0.06), r: 0.1, w: 0.09 },
              { p: head(0.08), r: 0.16, w: 0.115, o: -0.04 },
              { p: head(0.24), r: 0.145, w: 0.11, o: -0.03 },
              { p: head(0.42), r: 0.1, w: 0.086 },
              { p: head(0.64), r: 0.082, w: 0.072 },
              { p: head(0.85), r: 0.084, w: 0.07, o: -0.008 },
              { p: head(0.97), r: 0.065, w: 0.06 },
              { p: head(1.02), r: 0.02, w: 0.02 },
            ],
            { perSpan: 2, sides: 12, hint: [hn[0], hn[1], 0] },
          ),
        );
        // Ears, pricked up and a little back.
        for (const z of [-1, 1]) {
          const base = head(0.02, 0.11, z * 0.055),
            tip = offset(base, -0.07, 0.16, z * 0.035);
          add(
            unicornMats.marble,
            unicornTube(
              [
                { p: base, r: 0.036, w: 0.026 },
                { p: offset(base, (tip[0] - base[0]) / 2, (tip[1] - base[1]) / 2 + 0.005, (tip[2] - base[2]) / 2), r: 0.032, w: 0.022 },
                { p: tip, r: 0.003, w: 0.003 },
              ],
              { perSpan: 2, sides: 6, hint: [1, 0, 0] },
            ),
          );
        }
        // The horn: a gilded two-start spiral from the forehead, thrust forward.
        {
          const base = head(0.2, 0.12),
            hornDir = [hd[0] * 0.5 + hn[0] * 0.87, hd[1] * 0.5 + hn[1] * 0.87],
            len = Math.hypot(hornDir[0], hornDir[1]),
            hornLength = 0.58,
            ctrl = [];
          for (let i = 0; i <= 4; i++) {
            const s = i / 4;
            ctrl.push({ p: [base[0] + (hornDir[0] / len) * s * hornLength, base[1] + (hornDir[1] / len) * s * hornLength, 0], r: 0.05 * (1 - s) + 0.003 });
          }
          add(unicornMats.horn, unicornTube(ctrl, { perSpan: 4, sides: 10, hint: [0, 0, 1], groove: (angle, s) => 0.84 + 0.16 * Math.cos(angle * 2 - s * TAU * 3) }));
          hornTip = ctrl[4].p;
        }
        // Legs through their joints (rings flattened across the leg), gilded hooves.
        const leg = (joints, hoofDir) => {
          add(unicornMats.marble, unicornTube(joints, { perSpan: 2, sides: 9, hint: [0, 0, 1] }));
          const end = joints[joints.length - 1].p,
            z = end[2],
            tip = [end[0] + hoofDir[0] * 0.085, end[1] + hoofDir[1] * 0.085, z];
          add(
            parkMats.gold,
            unicornTube(
              [
                { p: [end[0] - hoofDir[0] * 0.01, end[1] - hoofDir[1] * 0.01, z], r: 0.05 },
                { p: tip, r: 0.066, w: 0.07 },
              ],
              { perSpan: 1, sides: 9, hint: [0, 0, 1], cap: true },
            ),
          );
        };
        // Hind legs: thigh to stifle, gaskin to hock, cannon, fetlock, hoof planted.
        const hip = body(0.12, -0.05);
        for (const [z, stifle, hock, fetlock, pastern] of [
          [0.16, [-0.25, 0.68], [-0.5, 0.36], [-0.4, 0.1], [-0.37, 0.075]],
          [-0.16, [-0.18, 0.7], [-0.44, 0.38], [-0.26, 0.11], [-0.22, 0.08]],
        ]) {
          const hoof = [pastern[0] + 0.02, 0.0],
            dx = hoof[0] - pastern[0],
            dy = hoof[1] - pastern[1] - 0.005,
            dl = Math.hypot(dx, dy);
          leg(
            [
              { p: [hip[0], hip[1], z * 0.8], r: 0.16, w: 0.21 },
              { p: [hip[0] + 0.1, hip[1] - 0.18, z], r: 0.135, w: 0.18 },
              { p: [...stifle, z], r: 0.1, w: 0.12 },
              { p: [(stifle[0] + hock[0]) / 2, (stifle[1] + hock[1]) / 2, z], r: 0.07, w: 0.09 },
              { p: [...hock, z], r: 0.055, w: 0.08 },
              { p: [(hock[0] + fetlock[0]) / 2, (hock[1] + fetlock[1]) / 2, z], r: 0.042, w: 0.055 },
              { p: [...fetlock, z], r: 0.05, w: 0.062 },
              { p: [...pastern, z], r: 0.042, w: 0.046 },
            ],
            [dx / dl, dy / dl],
          );
        }
        // Forelegs folded: the near one raised high at the knee, the far one lower.
        const shoulder = body(0.8, -0.05),
          elbow = body(0.88, -0.3);
        for (const [z, knee, fold] of [
          [0.17, [0.32, 0.2], [-0.1, -0.29]],
          [-0.17, [0.25, -0.02], [-0.14, -0.28]],
        ]) {
          const k = offset(elbow, knee[0], knee[1]),
            f = offset(k, fold[0], fold[1]),
            pastern = offset(f, 0.04, -0.09);
          leg(
            [
              { p: [shoulder[0], shoulder[1], z * 0.75], r: 0.13, w: 0.17 },
              { p: [elbow[0], elbow[1], z], r: 0.1, w: 0.12 },
              { p: [(elbow[0] + k[0]) / 2, (elbow[1] + k[1]) / 2, z], r: 0.066, w: 0.085 },
              { p: [k[0], k[1], z], r: 0.058, w: 0.07 },
              { p: [(k[0] + f[0]) / 2, (k[1] + f[1]) / 2, z], r: 0.04, w: 0.052 },
              { p: [f[0], f[1], z], r: 0.048, w: 0.058 },
              { p: [pastern[0], pastern[1], z], r: 0.04, w: 0.044 },
            ],
            [0.35, -0.94],
          );
        }
        // Mane: broad flat locks off the crest, draped in waves down her right
        // side (towards the street camera), a few over to the left, lying on
        // the neck and lifting clear only towards their tips; a forelock.
        for (let i = 0; i < 10; i++) {
          const s = 0.04 + i * 0.094,
            k = Math.min(3, Math.floor(s * 4)),
            f = s * 4 - k,
            c = neck[k].p,
            d = neck[k + 1].p,
            r = neck[k].r + (neck[k + 1].r - neck[k].r) * f,
            half = neck[k].w + (neck[k + 1].w - neck[k].w) * f,
            crest = [c[0] + (d[0] - c[0]) * f - r * 0.8, c[1] + (d[1] - c[1]) * f + r * 0.25, 0],
            side = i % 4 === 3 ? 1 : -1,
            fall = 0.3 + (i % 3) * 0.05 - s * 0.08,
            wave = Math.sin(i * 2.1) * 0.035;
          add(
            unicornMats.marble,
            unicornTube(
              [
                { p: offset(crest, 0.05, 0.02), r: 0.035, w: 0.07 },
                { p: offset(crest, -0.04, 0.0, side * half * 0.75), r: 0.03, w: 0.09 },
                { p: offset(crest, -0.03 + wave, -fall * 0.4, side * (half + 0.035)), r: 0.026, w: 0.085 },
                { p: offset(crest, -0.07 - wave, -fall * 0.75, side * (half + 0.06)), r: 0.02, w: 0.06 },
                { p: offset(crest, -0.13, -fall, side * (half + 0.05)), r: 0.004, w: 0.008 },
              ],
              { perSpan: 2, sides: 5, hint: [0, 0, 1] },
            ),
          );
        }
        add(
          unicornMats.marble,
          unicornTube(
            [
              { p: head(-0.02, 0.13), r: 0.024, w: 0.045 },
              { p: head(0.1, 0.17, -0.02), r: 0.022, w: 0.05 },
              { p: head(0.2, 0.15, -0.06), r: 0.014, w: 0.032 },
              { p: head(0.27, 0.11, -0.08), r: 0.003, w: 0.004 },
            ],
            { perSpan: 2, sides: 6, hint: [hn[0], hn[1], 0] },
          ),
        );
        // Tail: a thick root off the croup; the locks run together down to the
        // plinth (the main one touches it and flicks out behind), fanning and
        // curling apart towards their ends. Broad side outward.
        const dock = body(-0.02, 0.22),
          spine = [offset(dock, -0.14, 0.0), offset(dock, -0.27, -0.25), offset(dock, -0.25, -0.6), offset(dock, -0.16, -0.9), offset(dock, -0.13, -1.1)];
        const tailLocks = [
          { z: 0, spread: 0, end: 5, flick: [-0.3, -1.04, -0.03] },
          { z: 0.055, spread: -0.05, end: 4, flick: [-0.36, -0.82, 0.16] },
          { z: -0.055, spread: -0.04, end: 4, flick: [-0.3, -0.86, -0.16] },
          { z: 0.03, spread: -0.1, end: 3, flick: [-0.46, -0.52, 0.1] },
          { z: -0.03, spread: 0.06, end: 4, flick: [-0.12, -0.98, -0.1] },
        ];
        tailLocks.forEach((lock, i) => {
          const ctrl = [{ p: offset(dock, 0.03, 0.01), r: 0.075, w: 0.06 }];
          for (let k = 0; k < lock.end; k++) {
            const s = (k + 1) / 5,
              taper = 1 - s * 0.45;
            ctrl.push({ p: offset(spine[k], lock.spread * s * s, 0, lock.z * s * 1.6), r: (i ? 0.062 : 0.08) * taper, w: 0.034 * taper });
          }
          ctrl.push({ p: offset(dock, ...lock.flick), r: 0.006, w: 0.006 });
          add(unicornMats.marble, unicornTube(ctrl, { perSpan: 2, sides: 6, hint: [0, 0, 1] }));
        });
        return hornTip;
      }
      // ---- The fountain: basin, plinth, plaque, statue ------------------------------
      // The fountain's own frame faces the drive (south): the plaque is on its +x side.
      const unicornFountain = parkPlaced(UNICORN.x, UNICORN.y, 0, 1, 1, 1, Math.PI / 2).clone(),
        unicornLocal = new Three.Matrix4();
      // Matrix for local fountain coordinates (x forward, y up, z lateral).
      const inFountain = (m) => unicornLocal.multiplyMatrices(unicornFountain, m);
      const lathe = (profile, segments = 32) => new Three.LatheGeometry(profile.map(([r, y]) => new Three.Vector2(r, y)), segments);
      {
        const b = parkParts(),
          R = UNICORN.r,
          identity = new Three.Matrix4();
        // Basin: a moulded rim wall with a broad coping, and dark water.
        b.add(
          unicornMats.stone,
          // Traced outside in (up the outer wall, over the coping, down into
          // the water) so every face looks outward from the stone.
          lathe([
            [R + 1.4, 0],
            [R + 1.4, 0.6],
            [R + 0.5, 1.2],
            [R + 0.5, 4.2],
            [R + 0.9, 4.8],
            [R + 0.4, 5.4],
            [R - 4.6, 5.4],
            [R - 5.8, 4.9],
            [R - 5.2, 4.3],
            [R - 5.5, 1.2],
          ]),
          inFountain(identity),
        );
        b.add(parkMats.gold, lathe([[R - 5.2, 4.2], [R - 5.6, 3.95], [R - 5.2, 3.7]], 48), inFountain(identity));
        const water = new Three.CircleGeometry(R - 5.1, 48);
        water.rotateX(-Math.PI / 2);
        water.translate(0, UNICORN_WATER, 0);
        b.add(parkMats.water, water, inFountain(identity));
        // Plinth: a moulded drum in the water, an octagonal die, a cornice.
        b.add(
          unicornMats.stone,
          lathe([
            [11.4, 1.5],
            [11.4, 4.4],
            [12.0, 4.8],
            [12.0, 5.7],
            [10.9, 6.3],
            [9.6, 6.7],
            [8.4, 6.8],
          ]),
          inFountain(identity),
        );
        const die = new Three.CylinderGeometry(DIE, DIE, 9.4, 8).toNonIndexed();
        die.rotateY(Math.PI / 8);
        die.computeVertexNormals();
        die.translate(0, 11.5, 0);
        b.add(unicornMats.stone, die, inFountain(identity));
        b.add(
          unicornMats.stone,
          lathe([
            [DIE - 0.1, 16.2],
            [DIE + 1.0, 16.7],
            [DIE + 1.7, 17.6],
            [DIE + 1.7, 18.4],
            [DIE + 1.2, 19.0],
            [DIE + 1.1, UNICORN_PLINTH_TOP],
            [0, UNICORN_PLINTH_TOP],
          ]),
          inFountain(identity),
        );
        // Gilded astragals at the foot and the top of the die.
        b.add(parkMats.gold, lathe([[DIE + 0.3, 6.75], [DIE + 0.75, 7.05], [DIE + 0.3, 7.4]], 32), inFountain(identity));
        b.add(parkMats.gold, lathe([[DIE, 15.5], [DIE + 0.45, 15.8], [DIE, 16.15]], 32), inFountain(identity));
        // The plaque on the die's front face, in a bronze frame.
        const apothem = DIE * Math.cos(Math.PI / 8);
        b.box(unicornMats.bronze, inFountain(parkPlaced(apothem + 0.15, 0, PLAQUE_Y, 0.3, 3.9, 5.6)));
        const plaqueCanvas = document.createElement('canvas');
        plaqueCanvas.width = 256;
        plaqueCanvas.height = 160;
        {
          const g = plaqueCanvas.getContext('2d'),
            shade = g.createLinearGradient(0, 0, 0, 160);
          shade.addColorStop(0, '#9a6d3c');
          shade.addColorStop(1, '#5e3f1f');
          g.fillStyle = shade;
          g.fillRect(0, 0, 256, 160);
          g.strokeStyle = '#d9b06a';
          g.lineWidth = 6;
          g.strokeRect(9, 9, 238, 142);
          g.lineWidth = 2;
          g.strokeRect(18, 18, 220, 124);
          g.fillStyle = '#f0d49a';
          g.textAlign = 'center';
          g.font = 'bold 50px Georgia, serif';
          g.fillText('AURORA', 128, 80);
          g.font = 'bold 20px Georgia, serif';
          g.fillText('SUNSET  PIER', 128, 112);
          g.fillText('✦', 128, 134);
        }
        const plaqueTexture = new Three.CanvasTexture(plaqueCanvas);
        plaqueTexture.colorSpace = Three.SRGBColorSpace;
        plaqueTexture.anisotropy = 4;
        const plaque = new Three.Mesh(new Three.PlaneGeometry(5.1, 3.2), new Three.MeshStandardMaterial({ map: plaqueTexture, roughness: 0.4, metalness: 0.6 }));
        plaque.applyMatrix4(inFountain(new Three.Matrix4().makeRotationY(Math.PI / 2).setPosition(apothem + 0.32, PLAQUE_Y, 0)));
        plaque.userData.dynamic = true;
        plaque.name = 'unicorn plaque';
        parkRoot.add(plaque);
        // The four uplights on the drum's ledge, between the jets, aimed up at her.
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i * Math.PI) / 2,
            lx = Math.cos(a) * 10.9,
            lz = Math.sin(a) * 10.9;
          b.add(unicornMats.bronze, new Three.CylinderGeometry(0.55, 0.8, 1.1, 8), inFountain(new Three.Matrix4().setPosition(lx, 6.3, lz)));
          const world = new Three.Vector3(lx * 1.1, 7.0, lz * 1.1).applyMatrix4(unicornFountain);
          unicornUniforms.unicornLights.value[i].copy(world);
          parkBulbs.add(world.x, world.z, 7.3, 3.2, '#ffd9a0');
        }
        // Aurora herself, turned from the fountain's frame to her own heading.
        const statueMatrix = inFountain(
          new Three.Matrix4()
            .makeTranslation(0, UNICORN_PLINTH_TOP, 0)
            .multiply(new Three.Matrix4().makeRotationY(Math.PI / 2 - UNICORN.face))
            .multiply(new Three.Matrix4().makeScale(UNICORN_SCALE, UNICORN_SCALE, UNICORN_SCALE))
            .multiply(new Three.Matrix4().makeTranslation(0.42, 0, 0)),
        ).clone();
        const hornTip = unicornStatue(b, statueMatrix);
        unicornFountainMeshes.push(...b.flush(parkRoot, 'unicorn fountain'));
        unicornHornTip.set(...hornTip).applyMatrix4(statueMatrix);
      }
      // ---- Jets, spray and the basin's lamps ---------------------------------------
      /* Eight jets arc from the coping to the foot of the plinth, drawn as
         additive tubes whose streaks run along the arc (uv.x). */
      const UNICORN_JETS = 8,
        unicornJetLandings = [];
      const unicornJetMaterial = new Three.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new Three.Color('#dff4ff') }, uIntensity: { value: 0.8 } },
        vertexShader: `
          varying vec2 vArc;
          void main() {
            vArc = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,
        fragmentShader: `
          varying vec2 vArc;
          uniform float uTime, uIntensity;
          uniform vec3 uColor;
          void main() {
            float fade = smoothstep( 0.0, 0.08, vArc.x ) * ( 1.0 - 0.7 * smoothstep( 0.8, 1.0, vArc.x ) );
            float streak = 0.55 + 0.45 * sin( vArc.x * 46.0 - uTime * 13.0 + vArc.y * 9.0 );
            gl_FragColor = vec4( uColor * fade * streak * uIntensity, 1.0 );
          }`,
        transparent: true,
        depthWrite: false,
        blending: Three.AdditiveBlending,
        side: Three.DoubleSide,
      });
      {
        const pos = [],
          uvs = [],
          idx = [],
          segments = 10,
          sides = 4,
          point = new Three.Vector3(),
          next = new Three.Vector3(),
          tangent = new Three.Vector3(),
          across = new Three.Vector3(),
          lift = new Three.Vector3();
        for (let j = 0; j < UNICORN_JETS; j++) {
          const a = Math.PI / 8 + (j * TAU) / UNICORN_JETS,
            c = Math.cos(a),
            s = Math.sin(a),
            from = [c * (UNICORN.r - 5.6), 5.0, s * (UNICORN.r - 5.6)],
            to = [c * 12.6, UNICORN_WATER, s * 12.6],
            arcAt = (u, out) => out.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u + 4 * 11 * u * (1 - u), from[2] + (to[2] - from[2]) * u);
          const base = pos.length / 3;
          for (let i = 0; i <= segments; i++) {
            const u = i / segments;
            arcAt(u, point);
            arcAt(Math.min(1, u + 0.02), next);
            if (u >= 1) arcAt(u - 0.02, next).sub(point).negate().add(point);
            tangent.subVectors(next, point).normalize();
            across.set(-s, 0, c);
            lift.crossVectors(tangent, across).normalize();
            const radius = 0.35 + u * 0.55;
            for (let k = 0; k < sides; k++) {
              const t = (k / sides) * TAU,
                v = point.clone().addScaledVector(across, Math.cos(t) * radius).addScaledVector(lift, Math.sin(t) * radius);
              pos.push(v.x, v.y, v.z);
              uvs.push(u, k / sides);
            }
          }
          for (let i = 0; i < segments; i++)
            for (let k = 0; k < sides; k++) {
              const k2 = (k + 1) % sides,
                q = base + i * sides;
              idx.push(q + k, q + k2, q + sides + k, q + k2, q + sides + k2, q + sides + k);
            }
          unicornJetLandings.push(new Three.Vector3(...to).applyMatrix4(unicornFountain));
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.setIndex(idx);
        const jets = new Three.Mesh(geo, unicornJetMaterial);
        jets.applyMatrix4(unicornFountain);
        jets.renderOrder = 4;
        jets.userData.dynamic = true;
        jets.name = 'unicorn jets';
        parkRoot.add(jets);
      }
      /* Spray where the jets land (two puffs each), a glint on the horn tip and
         eight lamps under the water; one set of glow points, recoloured each frame. */
      const unicornGlow = parkGlowPoints(UNICORN_JETS * 2 + 1 + 8, 'unicorn sparkle'),
        unicornLampSpots = [];
      for (let i = 0; i < UNICORN_JETS * 2; i++) unicornGlow.add(0, 0, -100, 0, '#ffffff');
      unicornGlow.add(unicornHornTip.x, unicornHornTip.z, unicornHornTip.y, 9, '#ffffff', 0.7);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU,
          v = new Three.Vector3(Math.cos(a) * 19.5, UNICORN_WATER + 0.3, Math.sin(a) * 19.5).applyMatrix4(unicornFountain);
        unicornLampSpots.push(v);
        unicornGlow.add(v.x, v.z, v.y, 6, '#ffffff');
      }
      unicornGlow.done();
      const unicornColor = new Three.Color();
      function updateUnicornFountain(night) {
        const lit = night > 0.2;
        unicornUniforms.unicornLightPower.value = night * 2.4;
        // The horn: a slow pastel drift (rose, lilac, sky, mint) after dark.
        const hue = (gameTime * 0.035) % 1;
        unicornMats.horn.emissive.setHSL(hue, 0.75, 0.72);
        unicornMats.horn.emissiveIntensity = night * 1.8;
        unicornJetMaterial.uniforms.uTime.value = gameTime;
        unicornJetMaterial.uniforms.uIntensity.value = lit ? 0.95 : 0.75;
        if (lit) unicornJetMaterial.uniforms.uColor.value.setHSL((hue + 0.5) % 1, 0.75, 0.6);
        else unicornJetMaterial.uniforms.uColor.value.set('#dff4ff');
        unicornGlow.points.material.uniforms.uIntensity.value = lit ? 1.6 : 0.55;
        const attr = unicornGlow.points.geometry.attributes;
        for (let j = 0; j < UNICORN_JETS; j++) {
          const p = unicornJetLandings[j];
          for (let k = 0; k < 2; k++) {
            const i = j * 2 + k,
              bob = Math.sin(gameTime * 3.1 + j * 1.7 + k * 2.3);
            attr.position.setXYZ(i, p.x + Math.sin(gameTime * 2 + i) * 0.8, UNICORN_WATER + 1.2 + k * 1.3 + bob * 0.6, p.z + Math.cos(gameTime * 1.7 + i) * 0.8);
            attr.size.setX(i, 3.2 + k * 1.4 + bob * 0.8);
            if (lit) unicornColor.setHSL((hue + 0.5 + j * 0.02) % 1, 0.5, 0.75);
            else unicornColor.setRGB(0.85, 0.92, 1);
            attr.color.setXYZ(i, unicornColor.r, unicornColor.g, unicornColor.b);
          }
        }
        const horn = UNICORN_JETS * 2;
        unicornColor.setHSL(hue, 0.7, 0.75);
        attr.color.setXYZ(horn, unicornColor.r * night, unicornColor.g * night, unicornColor.b * night);
        for (let i = 0; i < 8; i++) {
          unicornColor.setHSL((hue + 0.5 + i * 0.03) % 1, 0.55, 0.65);
          attr.color.setXYZ(horn + 1 + i, unicornColor.r * night, unicornColor.g * night, unicornColor.b * night);
        }
        attr.position.needsUpdate = attr.size.needsUpdate = attr.color.needsUpdate = true;
      }
      // END SUBSYSTEM: src/unicorn3d.js
