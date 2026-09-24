      // BEGIN SUBSYSTEM: src/beach3d.js — Palm Keys Beach meshes
      /**
       * Palm Keys Beach meshes
       * Source: src/beach3d.js
       * Scope: createCityRenderer() closure.
       * The sand, the swash, the boardwalk, the pier, the beach furniture, the
       * ladders out of the sea and the people on the strand.
       */
      /**
       * DRAW-CALL BUDGET
       * The beach holds a few hundred people and several hundred props, so almost
       * everything here is instanced or batched:
       *   - the sand is one textured mesh; the swash one shader ribbon;
       *   - fixed buildings (towers, kiosks, the pier, showers, benches, lamps) are
       *     ordinary groups handed to `batchGroups`, merged after construction;
       *   - repeated props (umbrellas, towels, loungers, boards, buoys, boats,
       *     ladder parts) are one InstancedMesh each, coloured per instance;
       *   - people are a rig of seven InstancedMeshes (hips, torso, top, head,
       *     hair, arms, legs); `poseBeachgoer` writes every part's matrix from
       *     the slot's pose and animation phase.
       * Nothing animates unless the camera is near the beach.
       */
      buildBeachLayout();
      const BEACH_BOX = { x: -2780, y: 5286, w: 1520, h: 630 },
        beachGroup = new Three.Group();
      beachGroup.name = 'Palm Keys Beach';
      scene.add(beachGroup);
      const BEACH_NO_SHADOW = ['swim zone buoys', 'surfboards', 'pedal boats and jet skis', 'boat seats', 'ladder rails', 'ladder rungs', 'ladder grab rails', 'ladder lifebuoys', 'lifebuoy posts and edge paint', 'beach towels'];
      const beachInstanced = (geo, material, count, name) => {
        const m = new Three.InstancedMesh(geo, material, Math.max(1, count));
        m.name = name;
        // Small props skip the shadow pass: they cost a draw call each for a dot.
        m.castShadow = !BEACH_NO_SHADOW.includes(name);
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.userData.dynamic = true;
        const white = new Three.Color('#ffffff');
        for (let i = 0; i < m.count; i++) m.setColorAt(i, white);
        beachGroup.add(m);
        return m;
      };
      const beachZero = new Three.Matrix4().makeScale(0, 0, 0),
        bm = new Three.Matrix4(),
        bq = new Three.Quaternion(),
        bv = new Three.Vector3(),
        bs = new Three.Vector3(),
        be = new Three.Euler(),
        bc = new Three.Color(),
        bq2 = new Three.Quaternion(),
        yAxis = new Three.Vector3(0, 1, 0);
      /* One instance: position (map x, height, map y), yaw from a map heading, a
         pitch about its own length and a roll across it, and a scale. */
      function placeInstance(mesh, i, x, h, y, a, sx, sy, sz, pitch = 0, roll = 0) {
        bq.setFromAxisAngle(yAxis, -a);
        if (pitch || roll) bq.multiply(bq2.setFromEuler(be.set(roll, 0, pitch)));
        bm.compose(bv.set(x, h, y), bq, bs.set(sx, sy, sz));
        mesh.setMatrixAt(i, bm);
      }
      /**
       * SAND
       * Painted once into its own canvas at a finer grain than the city ground:
       * warm dry sand with wind ripples and footprints, the high-tide wrack line,
       * a damp band darkening to wet sand at the water, the volleyball court
       * ropes and the boardwalk planks. Clipped to the strand; the rest of the
       * sheet is transparent.
       */
      function paintBeachSand() {
        const k = touchEnabled() ? 1 : 1.5,
          cv = document.createElement('canvas');
        cv.width = Math.round(BEACH_BOX.w * k);
        cv.height = Math.round(BEACH_BOX.h * k);
        const g = cv.getContext('2d');
        g.scale(k, k);
        g.translate(-BEACH_BOX.x, -BEACH_BOX.y);
        let seed = 5150;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
        g.save();
        regionPath(g, LAND_REGIONS[1]);
        g.clip();
        g.beginPath();
        BEACH.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.clip();
        g.fillStyle = '#e1cea2';
        g.fillRect(BEACH_BOX.x, BEACH_BOX.y, BEACH_BOX.w, BEACH_BOX.h);
        // Broad variation: the sand is never one colour.
        for (let i = 0; i < 160; i++) {
          const x = BEACH_BOX.x + rnd() * BEACH_BOX.w,
            y = BEACH_BOX.y + rnd() * BEACH_BOX.h,
            r = 30 + rnd() * 120,
            grad = g.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, rnd() < 0.5 ? 'rgba(250,236,204,0.16)' : 'rgba(176,150,108,0.10)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // Wind ripples across the dry sand.
        g.lineWidth = 0.8;
        for (let i = 0; i < 1600; i++) {
          const x = BEACH_BOX.x + rnd() * BEACH_BOX.w,
            y = BEACH_BOX.y + rnd() * BEACH_BOX.h,
            len = 8 + rnd() * 22,
            bend = (rnd() - 0.5) * 5;
          g.strokeStyle = 'rgba(150,122,84,0.16)';
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + len / 2, y + bend, x + len, y + bend * 0.3);
          g.stroke();
          g.strokeStyle = 'rgba(255,246,222,0.18)';
          g.beginPath();
          g.moveTo(x, y - 1.1);
          g.quadraticCurveTo(x + len / 2, y + bend - 1.1, x + len, y + bend * 0.3 - 1.1);
          g.stroke();
        }
        // Grain.
        for (let i = 0; i < 26000; i++) {
          g.fillStyle = i % 2 ? 'rgba(255,248,230,0.35)' : 'rgba(128,104,70,0.28)';
          g.fillRect(BEACH_BOX.x + rnd() * BEACH_BOX.w, BEACH_BOX.y + rnd() * BEACH_BOX.h, 0.7, 0.7);
        }
        // Footprint trails from the boardwalk down to the water and along it.
        for (let t = 0; t < 70; t++) {
          let x = BEACH.boardwalk.x0 + rnd() * (BEACH.boardwalk.x1 - BEACH.boardwalk.x0),
            y = BEACH.boardwalk.y + 24,
            a = Math.PI / 2 + (rnd() - 0.5) * 0.8;
          g.fillStyle = 'rgba(146,118,82,0.3)';
          for (let step = 0; step < 90; step++) {
            a += (rnd() - 0.5) * 0.25;
            x += Math.cos(a) * 5;
            y += Math.sin(a) * 5;
            const side = step % 2 ? 1.3 : -1.3;
            g.beginPath();
            g.ellipse(x - Math.sin(a) * side, y + Math.cos(a) * side, 1.2, 0.7, a, 0, TAU);
            g.fill();
            if (!landAt(x, y + 20)) a = rnd() < 0.5 ? 0 : Math.PI;
          }
        }
        // Damp sand darkening towards the water, and the wet strip the swash keeps wet.
        const line = beachWaterline().points,
          strokeShore = (width, color) => {
            g.strokeStyle = color;
            g.lineWidth = width;
            g.lineJoin = 'round';
            g.beginPath();
            line.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
            g.stroke();
          };
        strokeShore(170, 'rgba(196,172,128,0.22)');
        strokeShore(110, 'rgba(184,158,114,0.28)');
        strokeShore(64, 'rgba(170,144,102,0.42)');
        strokeShore(36, 'rgba(150,126,88,0.6)');
        strokeShore(14, 'rgba(128,108,76,0.75)');
        // The high-tide wrack line: dried weed and shell grit.
        for (let s = 40; s < beachWaterline().length - 30; s += 2.2) {
          const d = 52 + Math.sin(s * 0.013) * 6 + Math.sin(s * 0.051) * 3,
            p = shoreAt(s, d);
          if (rnd() < 0.55) continue;
          g.fillStyle = rnd() < 0.7 ? 'rgba(92,86,56,0.55)' : 'rgba(236,228,210,0.7)';
          g.fillRect(p.x, p.y, 1.2 + rnd() * 2.4, 0.8);
        }
        // Volleyball court: raked sand inside blue boundary ropes.
        const c = BEACH_LAYOUT.court;
        g.fillStyle = 'rgba(245,232,200,0.5)';
        g.fillRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
        g.strokeStyle = '#2d69b3';
        g.lineWidth = 1.4;
        g.strokeRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
        // Boardwalk planks.
        const w = BEACH.boardwalk;
        g.fillStyle = '#8f7457';
        g.fillRect(w.x0, w.y - w.width / 2, w.x1 - w.x0, w.width);
        for (let x = w.x0; x < w.x1; x += 3.2) {
          g.fillStyle = (Math.floor(x / 3.2) * 7) % 5 ? 'rgba(170,140,106,0.5)' : 'rgba(110,86,62,0.45)';
          g.fillRect(x, w.y - w.width / 2, 0.6, w.width);
        }
        g.fillStyle = '#6f5a44';
        g.fillRect(w.x0, w.y + w.width / 2 - 2.5, w.x1 - w.x0, 2.5);
        g.restore();
        return cv;
      }
      const sandTexture = new Three.CanvasTexture(paintBeachSand());
      sandTexture.colorSpace = Three.SRGBColorSpace;
      sandTexture.anisotropy = 8;
      const sand = new Three.Mesh(
        new Three.PlaneGeometry(BEACH_BOX.w, BEACH_BOX.h),
        new Three.MeshStandardMaterial({ map: sandTexture, roughness: 0.96, metalness: 0, alphaTest: 0.5 }),
      );
      sand.rotation.x = -Math.PI / 2;
      sand.position.set(BEACH_BOX.x + BEACH_BOX.w / 2, 0.06, BEACH_BOX.y + BEACH_BOX.h / 2);
      sand.receiveShadow = true;
      sand.name = 'Palm Keys Beach sand';
      beachGroup.add(sand);
      /**
       * SWASH
       * A flat ribbon lying along the waterline from 30 units out to 46 inland,
       * drawn with its own shader. Two trains of waves with different periods
       * run up the sand, each a thin sheet of water with a bright foam lip and
       * lace behind it, and drain back leaving a band of dark wet sand. The
       * phase drifts along the shore so the beach is never in step with itself.
       * Out over the water only the foam is drawn, so the ribbon melts into the
       * water shader's own surf.
       */
      const swashUniforms = { uTime: { value: 0 }, uDay: { value: 1 }, uDusk: { value: 0 } };
      function buildSwash() {
        const { length } = beachWaterline(),
          across = [-30, -20, -12, -5, 0, 5, 11, 18, 26, 35, 46],
          steps = Math.ceil(length / 6),
          positions = [],
          shore = [],
          index = [];
        for (let i = 0; i <= steps; i++) {
          const s = (i / steps) * length;
          for (const d of across) {
            const p = shoreAt(s, d);
            positions.push(p.x, 0.12, p.y);
            shore.push(s, d);
          }
        }
        const n = across.length;
        for (let i = 0; i < steps; i++)
          for (let j = 0; j < n - 1; j++) {
            const a = i * n + j,
              b = a + n;
            index.push(a, b, a + 1, a + 1, b, b + 1);
          }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setAttribute('aShore', new Three.Float32BufferAttribute(shore, 2));
        geo.setIndex(index);
        geo.computeBoundingSphere();
        const m = new Three.Mesh(
          geo,
          new Three.ShaderMaterial({
            uniforms: swashUniforms,
            transparent: true,
            depthWrite: false,
            vertexShader: `
              attribute vec2 aShore;
              varying vec2 vShore;
              void main(){
                vShore = aShore;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
              }
            `,
            fragmentShader: `
              precision highp float;
              varying vec2 vShore;
              uniform float uTime;
              uniform float uDay;
              uniform float uDusk;
              float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
              float vnoise(vec2 p){
                vec2 i = floor(p), f = fract(p);
                f = f * f * (3. - 2. * f);
                return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
                           mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
              }
              // Run-up then backwash over one wave: quick up, slow drain.
              float runup(float ph){
                return ph < 0.28 ? sin(ph / 0.28 * 1.5708) : pow(1. - (ph - 0.28) / 0.72, 1.7);
              }
              void main(){
                float s = vShore.x, d = vShore.y;
                float n1 = vnoise(vec2(s * 0.011, 0.3)), n2 = vnoise(vec2(s * 0.027 + 7., 1.3));
                float ph1 = fract(uTime / 7.3 + n1 * 0.35 + s * 0.0009);
                float ph2 = fract(uTime / 9.7 + n2 * 0.4 + 0.47 - s * 0.0006);
                float top1 = 16. + 12. * n2, top2 = 10. + 9. * n1;
                float reach = max(-8. + (top1 + 8.) * runup(ph1), -8. + (top2 + 8.) * runup(ph2));
                float wob = (vnoise(vec2(s * 0.09, uTime * 0.35)) - 0.5) * 5.;
                float edgeD = d - reach - wob;
                float sheet = 1. - smoothstep(-1.2, 1.2, edgeD);
                float lip = exp(-edgeD * edgeD / 5.) * step(-9., reach);
                float lace = smoothstep(0.52, 0.8, vnoise(vec2(s * 0.16, d * 0.33 - uTime * 0.55))) * sheet;
                // Wet sand: up to where the waves have been reaching, drying above it.
                float wetTop = max(top1, top2) + 2.;
                float wet = (1. - smoothstep(wetTop - 6., wetTop + 4., d)) * (1. - sheet) * smoothstep(-2., 4., d);
                // The sheet thins as it runs up: turquoise at the break, sand-coloured at the top.
                float thin = smoothstep(-6., 20., d);
                vec3 waterCol = mix(vec3(.26, .58, .60), vec3(.66, .72, .62), thin);
                float body = sheet * mix(0.72, 0.32, thin) * smoothstep(-4., 3., d);
                float foam = clamp(lip * 0.95 + lace * mix(0.8, 0.35, thin), 0., 1.);
                vec3 col = mix(waterCol, vec3(.95, .97, .96), foam);
                float alpha = max(body, foam * 0.9 * smoothstep(-30., -16., d));
                // Wet sand darkens and takes a little sky.
                col = mix(col, vec3(.40, .33, .24), wet * (1. - alpha));
                alpha = max(alpha, wet * 0.42);
                // Sun on the thin water.
                col += vec3(1., .95, .85) * sheet * (1. - thin) * 0.08 * uDay;
                col *= 0.3 + 0.7 * uDay;
                col = mix(col, col * vec3(1.12, .86, .72), uDusk * 0.45);
                alpha *= 1. - smoothstep(38., 46., d);
                gl_FragColor = vec4(col, alpha);
              }
            `,
          }),
        );
        m.name = 'Palm Keys Beach swash';
        m.renderOrder = 2;
        m.userData.dynamic = true;
        beachGroup.add(m);
        return m;
      }
      buildSwash();
      /**
       * FIXED BUILD
       * Towers, kiosks, the bar deck, showers, bins, racks, benches, lamps, the
       * pier and the court's net posts: plain groups, merged by the batcher.
       */
      const beachPaint = {
        white: staticMat('#f2efe6', 0.6),
        red: staticMat('#d23b33', 0.55),
        yellow: staticMat('#efc93c', 0.5),
        timber: staticMat('#9b7a55', 0.85),
        darkTimber: staticMat('#6c533b', 0.9),
        sandCastle: staticMat('#cdb487', 0.98),
        net: new Three.MeshStandardMaterial({ color: '#f4f4ee', transparent: true, opacity: 0.55, side: Three.DoubleSide, roughness: 0.9 }),
        steel: staticMat('#9aa3a6', 0.35, 0.7),
        lampGlass: new Three.MeshBasicMaterial({ color: '#ffe4b0' }),
        window: new Three.MeshStandardMaterial({ color: '#2a3a44', emissive: '#ffcf8a', emissiveIntensity: 0, roughness: 0.3 }),
      };
      // Lamp and string-light halos are glow-field instances (signage3d.js): one
      // draw for all of them, lit after dark.
      function beachStatic(x, y, a = 0) {
        const g = new Three.Group();
        g.position.set(x, 0, y);
        g.rotation.y = -a;
        scene.add(g);
        batchGroups.push(g);
        statics.push({ x, y, group: g, radius: 60 });
        return g;
      }
      /* Striped awning texture shared by the kiosks, tinted per kiosk. */
      function stripeTexture(color) {
        const cv = document.createElement('canvas');
        cv.width = 64;
        cv.height = 8;
        const g = cv.getContext('2d');
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? '#f5f1e6' : color;
          g.fillRect(i * 8, 0, 8, 8);
        }
        const t = new Three.CanvasTexture(cv);
        t.colorSpace = Three.SRGBColorSpace;
        return t;
      }
      for (const t of BEACH_LAYOUT.towers) {
        // Stilts, a cabin with a shaded seat on its deck, a ramp to the sand and a flag.
        const g = beachStatic(t.x, t.y, t.a);
        for (const [dx, dz] of [
          [-7, -7],
          [-7, 7],
          [7, -7],
          [7, 7],
        ])
          box(g, dx, 9, dz, 1.6, 18, 1.6, beachPaint.white);
        box(g, 0, 18.5, 0, 20, 1.2, 20, beachPaint.timber);
        box(g, -4, 24.5, 0, 10, 11, 16, beachPaint.red);
        box(g, -4, 30.5, 0, 13, 1, 19, beachPaint.white);
        box(g, 1.2, 26, 0, 0.3, 4, 12, beachPaint.window);
        for (const side of [-1, 1]) box(g, 6, 21, side * 9.5, 8, 0.8, 0.8, beachPaint.white);
        const ramp = box(g, 14, 9, 0, 22, 1, 7, beachPaint.timber);
        ramp.rotation.z = -0.78;
        box(g, -9, 38, 7, 0.5, 16, 0.5, beachPaint.steel);
        box(g, -6.5, 43, 7, 5, 3.2, 0.2, beachPaint.red);
        box(g, -4, 31.4, 0, 3, 0.6, 3, beachPaint.yellow);
      }
      const barStringLights = [];
      for (const k of BEACH_LAYOUT.kiosks) {
        const g = beachStatic(k.x + k.w / 2, k.y + k.h / 2),
          body = mat(k.kind === 'station' ? '#f3f0e8' : '#e9e2d0', 0.8),
          awning = new Three.MeshStandardMaterial({ map: stripeTexture(k.color), roughness: 0.8 });
        box(g, 0, 8, 0, k.w, 16, k.h, body);
        box(g, 0, 17, 0, k.w + 4, 1.5, k.h + 4, k.kind === 'bar' ? beachPaint.darkTimber : mat(k.color, 0.7));
        // Serving hatch and counter on the sea side, under a striped awning.
        box(g, 0, 9, k.h / 2 + 0.3, k.w * 0.7, 6, 0.4, beachPaint.window);
        box(g, 0, 6, k.h / 2 + 2, k.w * 0.74, 1, 4, beachPaint.timber);
        const aw = box(g, 0, 13.5, k.h / 2 + 5, k.w * 0.9, 0.6, 11, awning);
        aw.rotation.x = 0.35;
        if (k.kind === 'station') {
          box(g, 0, 21, 0, 3, 6, 3, beachPaint.red);
          box(g, 0, 21, 0, 8, 2, 3.1, beachPaint.white);
        }
        if (k.kind === 'icecream') mesh(sphereGeo, staticMat('#f6c9d8', 0.6), g, 0, 22, 0, 5, 5, 5);
        if (k.kind === 'bar') {
          // A timber deck with tables in front, lights strung above it.
          box(g, 0, 0.6, k.h / 2 + 40, k.w + 30, 1.2, 76, beachPaint.timber);
          for (let x = -k.w / 2 - 10; x <= k.w / 2 + 10; x += 32) {
            box(g, x, 12, k.h / 2 + 76, 0.8, 24, 0.8, beachPaint.darkTimber);
            for (let j = 0; j < 4; j++) barStringLights.push({ x: k.x + k.w / 2 + x + 8 * j - 12, y: k.y + k.h + 36 + j * 9, z: 21 - Math.sin((j / 3) * Math.PI) * 3 });
          }
          for (let i = 0; i < 6; i++) box(g, -k.w / 2 + 12 + i * 18, 4, k.h / 2 + 5, 2.5, 8, 2.5, beachPaint.darkTimber);
        }
        sign(k.name, k.x + k.w / 2, k.y + k.h + 1, Math.min(84, k.w + 26), k.color === '#d9603f' ? '#ffd28a' : '#f5ecd6');
      }
      for (const t of BEACH_LAYOUT.tables) {
        const g = beachStatic(t.x, t.y);
        mesh(cylinderGeo, beachPaint.white, g, 0, 5, 0, 5, 0.6, 5);
        box(g, 0, 2.5, 0, 0.8, 5, 0.8, beachPaint.steel);
        box(g, 0, 11, 0, 0.5, 13, 0.5, beachPaint.steel);
        mesh(new Three.ConeGeometry(9, 4, 8), mat(t.color, 0.7), g, 0, 17, 0);
        for (const side of [-1, 1]) mesh(cylinderGeo, beachPaint.darkTimber, g, side * 8, 1.7, 0, 1.8, 3.4, 1.8);
      }
      for (const s of BEACH_LAYOUT.showers) {
        const g = beachStatic(s.x, s.y);
        box(g, 0, 0.4, 0, 10, 0.8, 10, beachPaint.timber);
        box(g, 0, 11, -3.5, 1, 22, 1, beachPaint.steel);
        box(g, 0, 21.5, -1, 1, 1, 6, beachPaint.steel);
        mesh(cylinderGeo, beachPaint.steel, g, 0, 21, 2, 2, 0.8, 2);
      }
      for (const b of BEACH_LAYOUT.bins) {
        const g = beachStatic(b.x, b.y);
        mesh(cylinderGeo, staticMat('#2f6a58', 0.6), g, 0, 3.5, 0, 3, 7, 3);
        mesh(cylinderGeo, beachPaint.white, g, 0, 7.2, 0, 3.2, 0.5, 3.2);
      }
      for (const r of BEACH_LAYOUT.racks) {
        const g = beachStatic(r.x, r.y);
        for (let x = -r.w / 2 + 4; x <= r.w / 2 - 4; x += 8) {
          box(g, x, 3, 0, 0.6, 6, 0.6, beachPaint.steel);
          box(g, x, 6, 0, 0.6, 0.6, 5, beachPaint.steel);
        }
        // A couple of bikes left against it.
        for (const x of [-r.w / 2 + 8, r.w / 2 - 16]) {
          const frameColor = mat(x < 0 ? '#2d6fbe' : '#d9534a', 0.5);
          for (const dz of [-6, 6]) {
            const wheel = mesh(new Three.TorusGeometry(3, 0.35, 5, 14), rubber, g, x, 3.2, dz);
            wheel.rotation.y = Math.PI / 2;
          }
          box(g, x, 5.2, 0, 0.6, 0.6, 11, frameColor);
          box(g, x, 6.8, -3, 0.6, 3.4, 0.6, frameColor);
        }
      }
      // Boardwalk: a timber kerb on the sand side, lamp standards, benches facing the sea.
      {
        const w = BEACH.boardwalk,
          g = beachStatic((w.x0 + w.x1) / 2, w.y);
        box(g, 0, 0.8, w.width / 2 - 1, w.x1 - w.x0, 1.6, 2, beachPaint.darkTimber);
        for (let x = w.x0 + 24; x < w.x1; x += 48) box(g, x - (w.x0 + w.x1) / 2, 1.8, w.width / 2 - 1, 1.6, 3.6, 2.4, beachPaint.darkTimber);
        for (let x = w.x0 + 90; x < w.x1 - 40; x += 190) {
          const bx = x - (w.x0 + w.x1) / 2;
          box(g, bx, 3.5, -w.width / 2 + 5, 20, 1, 5, beachPaint.timber);
          box(g, bx, 6.5, -w.width / 2 + 2.8, 20, 4, 0.8, beachPaint.timber);
          for (const side of [-1, 1]) box(g, bx + side * 8, 1.8, -w.width / 2 + 5, 1, 3.5, 4, darkMetal);
        }
      }
      for (const l of BEACH_LAYOUT.lamps) {
        const g = beachStatic(l.x, l.y);
        box(g, 0, 15, 0, 1, 30, 1, darkMetal);
        box(g, 0, 30.5, -2.5, 1, 1, 6, darkMetal);
        box(g, 0, 30, -5, 3.5, 1.4, 3.5, beachPaint.lampGlass);
        addGlow(l.x, 29.5, l.y - 5, 18, '#ffd9a0', 0.45, { day: 0, phase: 0 });
      }
      for (const l of barStringLights) addGlow(l.x, l.z, l.y, 6, '#ffc27a', 0.5, { day: 0, phase: 0 });
      // Volleyball: two posts and a net across the middle of the court.
      {
        const c = BEACH_LAYOUT.court,
          g = beachStatic(c.x, c.y);
        for (const dz of [-c.h / 2 - 4, c.h / 2 + 4]) box(g, 0, 8.5, dz, 1, 17, 1, beachPaint.steel);
        const netCanvas = document.createElement('canvas');
        netCanvas.width = 64;
        netCanvas.height = 16;
        const ng = netCanvas.getContext('2d');
        ng.strokeStyle = '#fff';
        ng.lineWidth = 1;
        for (let x = 0; x <= 64; x += 4) ng.strokeRect(x, 0, 0.5, 16);
        for (let y = 0; y <= 16; y += 4) ng.strokeRect(0, y, 64, 0.5);
        ng.fillStyle = '#fff';
        ng.fillRect(0, 0, 64, 2);
        const netTexture = new Three.CanvasTexture(netCanvas);
        netTexture.wrapS = Three.RepeatWrapping;
        const net = new Three.Mesh(
          new Three.PlaneGeometry(c.h + 8, 6),
          new Three.MeshBasicMaterial({ map: netTexture, transparent: true, side: Three.DoubleSide, depthWrite: false }),
        );
        net.rotation.y = Math.PI / 2;
        net.position.set(c.x, 13, c.y);
        net.userData.dynamic = true;
        beachGroup.add(net);
      }
      for (const c of BEACH_LAYOUT.castles) {
        // A keep and four towers, a little lopsided.
        const g = beachStatic(c.x, c.y, c.a);
        box(g, 0, 1.5 * c.size, 0, 7 * c.size, 3 * c.size, 7 * c.size, beachPaint.sandCastle);
        for (const [dx, dz] of [
          [-3.5, -3.5],
          [3.5, -3.5],
          [-3.5, 3.5],
          [3.5, 3.5],
        ])
          mesh(new Three.ConeGeometry(1.8 * c.size, 5.5 * c.size, 6), beachPaint.sandCastle, g, dx * c.size, 2.6 * c.size, dz * c.size);
        mesh(new Three.ConeGeometry(2.4 * c.size, 7 * c.size, 6), beachPaint.sandCastle, g, 0, 5.8 * c.size, 0);
        box(g, 8 * c.size, 1, 0, 3, 2, 2, staticMat('#e04a3f', 0.6));
      }
      // Palms by the bar and the kiosks.
      for (const [x, y, size] of [
        [-2100, 5378, 0.9],
        [-1934, 5382, 1],
        [-2415, 5374, 0.85],
        [-1605, 5376, 0.9],
        [-1330, 5380, 0.8],
      ])
        makePalm(x, y, size);
      /**
       * THE PIER
       * Timber deck on piles from the lower sand out past the breakers, with a
       * rail along both sides, benches and lamps on the T of the head.
       */
      {
        const [stem, head] = BEACH.pier,
          g = beachStatic(stem.x + stem.w / 2, stem.y + stem.h / 2),
          ox = stem.x + stem.w / 2,
          oz = stem.y + stem.h / 2,
          deck = 1.2;
        // Deck boards run across the pier: a small plank texture repeated along it.
        const plankCanvas = document.createElement('canvas');
        plankCanvas.width = 16;
        plankCanvas.height = 64;
        const pg = plankCanvas.getContext('2d');
        pg.fillStyle = '#a6835c';
        pg.fillRect(0, 0, 16, 64);
        for (let y = 0; y < 64; y += 8) {
          pg.fillStyle = (y / 8) % 3 ? '#b08d64' : '#977550';
          pg.fillRect(0, y, 16, 7);
          pg.fillStyle = '#5e4631';
          pg.fillRect(0, y + 7, 16, 1);
        }
        for (const d of BEACH.pier) {
          const planks = new Three.CanvasTexture(plankCanvas);
          planks.colorSpace = Three.SRGBColorSpace;
          planks.wrapS = planks.wrapT = Three.RepeatWrapping;
          planks.repeat.set(1, d.h / 8);
          if (d.w > d.h) {
            planks.repeat.set(d.w / 8, 1);
            planks.rotation = Math.PI / 2;
          }
          const top = new Three.Mesh(new Three.PlaneGeometry(d.w, d.h), new Three.MeshStandardMaterial({ map: planks, roughness: 0.9 }));
          top.rotation.x = -Math.PI / 2;
          top.position.set(d.x + d.w / 2, deck + 0.02, d.y + d.h / 2);
          top.receiveShadow = true;
          top.userData.sign = true;
          beachGroup.add(top);
          box(g, d.x + d.w / 2 - ox, deck - 0.6, d.y + d.h / 2 - oz, d.w, 1.2, d.h, beachPaint.timber);
          box(g, d.x + d.w / 2 - ox, deck - 1.8, d.y + d.h / 2 - oz, d.w - 2, 1.2, d.h - 2, beachPaint.darkTimber);
          // Piles every 20 units down into the water.
          for (let x = d.x + 3; x < d.x + d.w; x += Math.max(20, d.w - 6))
            for (let y = d.y + (d === stem ? 40 : 3); y < d.y + d.h; y += 20)
              mesh(cylinderGeo, beachPaint.darkTimber, g, x - ox, -6, y - oz, 1.3, 14, 1.3);
        }
        // Rails: along the stem to the head, round the head leaving gaps for the ladders.
        const rail = (x0, y0, x1, y1) => {
          const len = Math.hypot(x1 - x0, y1 - y0),
            r = box(g, (x0 + x1) / 2 - ox, deck + 5, (y0 + y1) / 2 - oz, len, 0.8, 0.8, beachPaint.white);
          r.rotation.y = -Math.atan2(y1 - y0, x1 - x0);
          for (let t = 0; t <= len; t += 12)
            box(g, x0 + ((x1 - x0) * t) / len - ox, deck + 2.5, y0 + ((y1 - y0) * t) / len - oz, 0.7, 5, 0.7, beachPaint.white);
        };
        rail(stem.x, stem.y + 30, stem.x, head.y);
        rail(stem.x + stem.w, stem.y + 30, stem.x + stem.w, head.y);
        rail(head.x, head.y, stem.x, head.y);
        rail(stem.x + stem.w, head.y, head.x + head.w, head.y);
        rail(head.x, head.y + head.h, head.x + head.w, head.y + head.h);
        rail(head.x, head.y, head.x, head.y + head.h / 2 - 7);
        rail(head.x + head.w, head.y, head.x + head.w, head.y + head.h / 2 - 7);
        for (const x of [head.x + 14, head.x + head.w - 14]) {
          box(g, x - ox, deck + 10, head.y + head.h - 3 - oz, 0.9, 20, 0.9, darkMetal);
          box(g, x - ox, deck + 20.5, head.y + head.h - 3 - oz, 3, 1.4, 3, beachPaint.lampGlass);
          addGlow(x, deck + 20, head.y + head.h - 3, 14, '#ffd9a0', 0.45, { day: 0, phase: 0 });
        }
        for (const x of [head.x + 40, head.x + head.w - 40]) box(g, x - ox, deck + 2.2, head.y + head.h - 8 - oz, 18, 1, 4, beachPaint.timber);
        // Lamps down the stem.
        for (let y = stem.y + 70; y < head.y - 10; y += 80) {
          box(g, stem.x + stem.w - 2 - ox, deck + 10, y - oz, 0.9, 20, 0.9, darkMetal);
          box(g, stem.x + stem.w - 4 - ox, deck + 20, y - oz, 4, 1.2, 2.4, beachPaint.lampGlass);
          addGlow(stem.x + stem.w - 4, deck + 19.5, y, 13, '#ffd9a0', 0.45, { day: 0, phase: 0 });
        }
      }
      /**
       * INSTANCED PROPS
       * Umbrellas (pole plus a canopy split into alternating coloured and white
       * panels), towels, loungers, surfboards, buoys, pedal boats, jet skis and
       * the ladders out of the sea.
       */
      function canopyGeometry(odd) {
        // Eight panels of a shallow cone; half of them, so two meshes make stripes.
        const verts = [],
          panels = 8;
        for (let i = odd; i < panels; i += 2) {
          const a0 = (i / panels) * TAU,
            a1 = ((i + 1) / panels) * TAU;
          verts.push(0, 1, 0, Math.cos(a1), 0, Math.sin(a1), Math.cos(a0), 0, Math.sin(a0));
          // Underside, so the shade reads from below too.
          verts.push(0, 0.96, 0, Math.cos(a0), -0.02, Math.sin(a0), Math.cos(a1), -0.02, Math.sin(a1));
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(verts, 3));
        geo.computeVertexNormals();
        return geo;
      }
      const L = BEACH_LAYOUT,
        umbrellaPoles = beachInstanced(cylinderGeo, beachPaint.steel, L.umbrellas.length, 'beach umbrella poles'),
        canopyColour = beachInstanced(canopyGeometry(0), new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, side: Three.DoubleSide }), L.umbrellas.length, 'beach umbrella canopies'),
        canopyWhite = beachInstanced(canopyGeometry(1), new Three.MeshStandardMaterial({ color: '#f6f2e8', roughness: 0.75, side: Three.DoubleSide }), L.umbrellas.length, 'beach umbrella canopies (white)');
      L.umbrellas.forEach((u, i) => canopyColour.setColorAt(i, bc.set(u.color)));
      let umbrellasOpen = null;
      function setUmbrellas(open) {
        umbrellasOpen = open;
        L.umbrellas.forEach((u, i) => {
          placeInstance(umbrellaPoles, i, u.x, 13, u.y, 0, 0.45, 26, 0.45, u.tilt, u.tilt * 0.5);
          // Open: a wide shallow cone; furled: a tall thin one tied to the pole.
          const r = open ? 17 : 2.4,
            h = open ? 6 : 13;
          placeInstance(canopyColour, i, u.x, open ? 21 : 13.5, u.y, 0, r, h, r, u.tilt, u.tilt * 0.5);
          placeInstance(canopyWhite, i, u.x, open ? 21 : 13.5, u.y, 0, r, h, r, u.tilt, u.tilt * 0.5);
        });
        for (const m of [umbrellaPoles, canopyColour, canopyWhite]) m.instanceMatrix.needsUpdate = true;
        canopyColour.instanceColor.needsUpdate = true;
      }
      // Towels: white with darker stripes, tinted per towel.
      const towelCanvas = document.createElement('canvas');
      towelCanvas.width = 32;
      towelCanvas.height = 16;
      {
        const g = towelCanvas.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 32, 16);
        g.fillStyle = '#c9c9c9';
        for (const x of [4, 12, 20, 28]) g.fillRect(x, 0, 3, 16);
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 1, 16);
        g.fillRect(31, 0, 1, 16);
      }
      const towelTexture = new Three.CanvasTexture(towelCanvas);
      towelTexture.colorSpace = Three.SRGBColorSpace;
      const towels = beachInstanced(boxGeo, new Three.MeshStandardMaterial({ map: towelTexture, roughness: 0.95 }), L.towels.length, 'beach towels');
      towels.castShadow = false;
      L.towels.forEach((t, i) => {
        towels.setColorAt(i, bc.set(t.color));
        towels.setMatrixAt(i, beachZero);
      });
      // Who lies on which towel. Rebuilt if a new game recasts the beach.
      const towelOwners = new Map();
      let towelCast = null;
      function mapTowelOwners() {
        towelOwners.clear();
        towelCast = beachgoers[0];
        for (const p of beachgoers) if (L.towels.includes(p.anchor)) towelOwners.set(p.anchor, [...(towelOwners.get(p.anchor) || []), p]);
      }
      const loungerBeds = beachInstanced(boxGeo, staticMat('#f1efe8', 0.7), L.loungers.length * 2, 'beach loungers');
      L.loungers.forEach((t, i) => {
        // Bed along the heading (feet to the sea), backrest raised at the landward end.
        placeInstance(loungerBeds, i * 2, t.x, 2.6, t.y, t.a, 20, 1.2, 8);
        placeInstance(
          loungerBeds,
          i * 2 + 1,
          t.x - Math.cos(t.a) * 11.5,
          5.2,
          t.y - Math.sin(t.a) * 11.5,
          t.a,
          8,
          1.1,
          8,
          -0.75,
        );
        loungerBeds.setColorAt(i * 2 + 1, bc.set(t.color));
      });
      const boards = beachInstanced(sphereGeo, staticMat('#ffffff', 0.35), L.boards.length, 'surfboards');
      L.boards.forEach((b, i) => {
        placeInstance(boards, i, b.x, 11, b.y, b.a, 0.9, 11, 3.2);
        boards.setColorAt(i, bc.set(b.color));
      });
      const buoys = beachInstanced(sphereGeo, staticMat('#ffffff', 0.45), L.buoys.length, 'swim zone buoys');
      L.buoys.forEach((b, i) => buoys.setColorAt(i, bc.set(b.big ? '#f4c430' : i % 2 ? '#f6f3ea' : '#f07a2a')));
      {
        // The rope between the buoys.
        const pts = L.buoys.map((b) => new Three.Vector3(b.x, -2.7, b.y));
        const rope = new Three.Line(new Three.BufferGeometry().setFromPoints(pts), new Three.LineBasicMaterial({ color: '#f2e9cf' }));
        rope.userData.dynamic = true;
        beachGroup.add(rope);
      }
      const hulls = beachInstanced(boxGeo, staticMat('#ffffff', 0.4), L.pedalos.length * 2 + L.jetskis.length, 'pedal boats and jet skis'),
        seats = beachInstanced(boxGeo, staticMat('#f2efe6', 0.6), L.pedalos.length + L.jetskis.length, 'boat seats');
      L.pedalos.forEach((b, i) => {
        hulls.setColorAt(i * 2, bc.set(b.color));
        hulls.setColorAt(i * 2 + 1, bc.set(b.color));
        seats.setColorAt(i, bc.set('#f4f1e6'));
      });
      L.jetskis.forEach((b, i) => {
        hulls.setColorAt(L.pedalos.length * 2 + i, bc.set(b.color));
        seats.setColorAt(L.pedalos.length + i, bc.set('#222a33'));
      });
      function placeBoats() {
        L.pedalos.forEach((b, i) => {
          const on = b.beached || b.active,
            x = b.beached ? b.x : b.x ?? b.cx,
            y = b.beached ? b.y : b.y ?? b.cy,
            a = b.a ?? 0,
            h = b.beached ? 1.6 : -2.2 + Math.sin(gameTime * 1.4 + i) * 0.35;
          if (!on) {
            hulls.setMatrixAt(i * 2, beachZero);
            hulls.setMatrixAt(i * 2 + 1, beachZero);
            seats.setMatrixAt(i, beachZero);
            return;
          }
          // Two pontoons and a moulded seat between them.
          for (const side of [0, 1]) {
            const off = side ? 5.5 : -5.5;
            placeInstance(hulls, i * 2 + side, x - Math.sin(a) * off, h, y + Math.cos(a) * off, a, 20, 3, 4);
          }
          placeInstance(seats, i, x, h + 3, y, a, 9, 3, 12);
        });
        L.jetskis.forEach((b, i) => {
          const on = b.active,
            k = L.pedalos.length * 2 + i;
          if (!on) {
            hulls.setMatrixAt(k, beachZero);
            seats.setMatrixAt(L.pedalos.length + i, beachZero);
            return;
          }
          const h = -2 + Math.sin(gameTime * 3 + i) * 0.3;
          placeInstance(hulls, k, b.x, h, b.y, b.a, 16, 3, 6, Math.sin(gameTime * 4 + i) * 0.04);
          placeInstance(seats, L.pedalos.length + i, b.x - Math.cos(b.a) * 2, h + 2.4, b.y - Math.sin(b.a) * 2, b.a, 8, 1.8, 3.4);
          // Wake, bow wave and spray go into the sea (wakes3d.js): a leisure jet ski
          // circling at a third of a racing one's speed.
          wakeEmit(b, b.x, b.y, b.a, Math.abs(b.speed * b.r), 16, 6, 140);
        });
        hulls.instanceMatrix.needsUpdate = seats.instanceMatrix.needsUpdate = true;
      }
      hulls.instanceColor.needsUpdate = seats.instanceColor.needsUpdate = true;
      // Ladders: two rails, rungs down into the water and grab handles over the edge.
      const ladders = ladderList(),
        rungsPer = 7,
        ladderRails = beachInstanced(boxGeo, beachPaint.yellow, ladders.length * 2, 'ladder rails'),
        ladderRungs = beachInstanced(boxGeo, beachPaint.steel, ladders.length * rungsPer, 'ladder rungs'),
        ladderGrabs = beachInstanced(boxGeo, beachPaint.yellow, ladders.length * 2, 'ladder grab rails');
      // Beside every ladder, a lifebuoy on a post and a yellow band on the edge,
      // so a swimmer looking for a way out can spot one from a distance.
      const lifebuoys = beachInstanced(new Three.TorusGeometry(2.6, 0.9, 6, 14), staticMat('#e2412f', 0.6), ladders.length, 'ladder lifebuoys'),
        buoyPosts = beachInstanced(boxGeo, beachPaint.white, ladders.length * 2, 'lifebuoy posts and edge paint');
      ladders.forEach((l, i) => {
        const px = l.top.x - Math.sin(l.a) * 9 - Math.cos(l.a) * 8,
          py = l.top.y + Math.cos(l.a) * 9 - Math.sin(l.a) * 8;
        placeInstance(buoyPosts, i * 2, px, l.deck + 5, py, l.a, 1.2, 10, 1.2);
        placeInstance(buoyPosts, i * 2 + 1, l.edge.x + Math.cos(l.a) * 1.2, l.deck + 0.25, l.edge.y + Math.sin(l.a) * 1.2, l.a, 2.4, 0.5, 11);
        buoyPosts.setColorAt(i * 2 + 1, bc.set('#f2c233'));
        bq.setFromAxisAngle(yAxis, -l.a + Math.PI / 2);
        bm.compose(bv.set(px - Math.cos(l.a) * 1.2, l.deck + 7, py - Math.sin(l.a) * 1.2), bq, bs.set(1, 1, 1));
        lifebuoys.setMatrixAt(i, bm);
      });
      buoyPosts.instanceColor.needsUpdate = true;
      ladders.forEach((l, i) => {
        const ex = l.edge.x - Math.cos(l.a) * 1.4,
          ey = l.edge.y - Math.sin(l.a) * 1.4,
          sx = -Math.sin(l.a),
          sy = Math.cos(l.a),
          low = -8,
          top = l.deck + 0.4;
        for (const side of [0, 1]) {
          const off = side ? 3 : -3;
          placeInstance(ladderRails, i * 2 + side, ex + sx * off, (low + top + 4) / 2, ey + sy * off, l.a, 0.7, top + 4 - low, 0.7);
          placeInstance(ladderGrabs, i * 2 + side, ex + sx * off + Math.cos(l.a) * 2.6, top + 4, ey + sy * off + Math.sin(l.a) * 2.6, l.a, 5.8, 0.7, 0.7);
        }
        for (let r = 0; r < rungsPer; r++) placeInstance(ladderRungs, i * rungsPer + r, ex, low + 1.5 + ((top - low - 1.5) * r) / (rungsPer - 1), ey, l.a, 0.6, 0.5, 6);
      });
      /**
       * PEOPLE
       * A beachgoer is built from seven instanced parts in a shared rig (feet at
       * 0, head at ~17, facing +x like the city's pedestrians). `poseBeachgoer`
       * places the rig's root for the pose (upright, sitting, lying on the back
       * or front, prone in the crawl, floating, treading water) and swings the
       * limbs about their pivots.
       */
      const count = Math.max(1, beachgoers.length),
        skinMat = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62 }),
        suitMat = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }),
        rig = {
          hips: beachInstanced(boxGeo, suitMat, count, 'beachgoer hips'),
          torso: beachInstanced(boxGeo, skinMat, count, 'beachgoer torsos'),
          top: beachInstanced(boxGeo, suitMat, count, 'beachgoer tops'),
          head: beachInstanced(sphereGeo, skinMat, count, 'beachgoer heads'),
          hair: beachInstanced(sphereGeo, new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), count, 'beachgoer hair'),
          arms: beachInstanced(boxGeo, skinMat, count * 2, 'beachgoer arms'),
          legs: beachInstanced(boxGeo, skinMat, count * 2, 'beachgoer legs'),
        };
      beachgoers.forEach((p, i) => {
        rig.hips.setColorAt(i, bc.set(p.suit));
        rig.torso.setColorAt(i, bc.set(p.shirt || p.skin));
        rig.top.setColorAt(i, bc.set(p.shirt || p.suit));
        rig.head.setColorAt(i, bc.set(p.skin));
        rig.hair.setColorAt(i, bc.set(p.hair));
        for (const side of [0, 1]) {
          rig.arms.setColorAt(i * 2 + side, bc.set(p.shirt && p.kind !== 'lifeguard' ? p.shirt : p.skin));
          rig.legs.setColorAt(i * 2 + side, bc.set(p.skin));
        }
      });
      for (const m of Object.values(rig)) m.instanceColor.needsUpdate = true;
      const rootMatrix = new Three.Matrix4(),
        pivotMatrix = new Three.Matrix4(),
        partMatrix = new Three.Matrix4(),
        rq = new Three.Quaternion(),
        rq2 = new Three.Quaternion(),
        leanQ = new Three.Quaternion(),
        HIP = 6.4,
        zAxis = new Three.Vector3(0, 0, 1),
        xAxis = new Three.Vector3(1, 0, 0),
        one = new Three.Vector3(1, 1, 1),
        pv = new Three.Vector3();
      /* Root quaternion for a whole-body orientation, from turns about z then y. */
      const Q_SUPINE = new Three.Quaternion().setFromAxisAngle(zAxis, Math.PI / 2),
        Q_PRONE = new Three.Quaternion().setFromAxisAngle(zAxis, Math.PI / 2).multiply(new Three.Quaternion().setFromAxisAngle(yAxis, Math.PI)),
        Q_CRAWL = new Three.Quaternion().setFromAxisAngle(zAxis, -Math.PI / 2 + 0.14);
      function setPart(mesh, index, px, py, pz, rx, rz, ox, oy, sx, sy, sz) {
        rq.setFromEuler(be.set(rx, 0, rz));
        pivotMatrix.compose(pv.set(px, py, pz), rq, one);
        partMatrix.multiplyMatrices(rootMatrix, pivotMatrix);
        pivotMatrix.compose(pv.set(ox, oy, 0), rq.identity(), bs.set(sx, sy, sz));
        partMatrix.multiply(pivotMatrix);
        mesh.setMatrixAt(index, partMatrix);
      }
      function hideBeachgoer(i) {
        for (const key of ['hips', 'torso', 'top', 'head', 'hair']) rig[key].setMatrixAt(i, beachZero);
        for (const side of [0, 1]) {
          rig.arms.setMatrixAt(i * 2 + side, beachZero);
          rig.legs.setMatrixAt(i * 2 + side, beachZero);
        }
      }
      function poseBeachgoer(p, i) {
        const t = p.phase,
          swing = Math.sin(t);
        // Root: where the rig's origin sits, how the whole body is turned, and a lean.
        let rx = 0,
          ry = 0,
          rz = 0,
          quat = null,
          lean = 0,
          legL = 0,
          legR = 0,
          armL = 0.06,
          armR = 0.06,
          outL = 0.08,
          outR = 0.08;
        switch (p.pose) {
          case 'walk':
          case 'wadeWalk':
            legL = swing * 0.5;
            legR = -swing * 0.5;
            armL = -swing * 0.42;
            armR = swing * 0.42;
            if (p.pose === 'wadeWalk') outL = outR = 0.45;
            break;
          case 'run':
            legL = swing * 0.85;
            legR = -swing * 0.85;
            armL = -swing * 0.8;
            armR = swing * 0.8;
            lean = -0.18;
            ry = Math.abs(Math.cos(t)) * 1.2;
            break;
          case 'sit':
          case 'ride':
            ry = -5.4;
            lean = p.pose === 'ride' ? -0.1 : 0.25;
            legL = legR = Math.PI / 2 - lean;
            outL = outR = 0.12;
            armL = armR = p.pose === 'ride' ? 1.25 : -0.55;
            if (p.pose === 'sit' && p.kind === 'sitter') armR = 0.9 + Math.sin(t * 0.3) * 0.1;
            break;
          case 'recline':
            ry = -6.0;
            lean = 0.95;
            legL = legR = Math.PI / 2 - lean;
            armL = armR = -0.2;
            break;
          case 'kneel':
            ry = -4.9;
            lean = -0.35;
            legL = legR = -1.45;
            armL = 0.9 + Math.sin(t * 5) * 0.5;
            armR = 0.9 + Math.sin(t * 5 + 1.6) * 0.5;
            break;
          case 'lie':
            quat = Q_SUPINE;
            rx = 2.35;
            ry = -4.1;
            // Hands behind the head for some, along the body for others.
            armL = armR = p.threshold > 0.5 ? 2.9 : 0.1;
            legR = p.threshold > 0.75 ? 0.35 : 0;
            break;
          case 'lieFront':
            quat = Q_PRONE;
            rx = 2.35;
            ry = -4.1;
            armL = armR = 2.7;
            outL = outR = 0.4;
            break;
          case 'swim': {
            quat = Q_CRAWL;
            rx = -2.35;
            ry = -6.4;
            const stroke = t * 3.2;
            armL = stroke;
            armR = stroke + Math.PI;
            legL = Math.sin(stroke * 2) * 0.3;
            legR = -legL;
            break;
          }
          case 'float':
            quat = Q_SUPINE;
            rx = 2.35;
            ry = -7.4;
            outL = outR = 1.2;
            armL = armR = 0;
            legL = 0.1;
            legR = -0.1;
            break;
          case 'tread':
          case 'dive':
            ry = -9.4;
            outL = outR = 1.25 + Math.sin(t * 3) * 0.2;
            armL = armR = 0.35;
            legL = Math.sin(t * 2.4) * 0.4;
            legR = -legL;
            break;
          case 'ready':
            ry = -1.1;
            lean = -0.3;
            legL = 0.35;
            legR = -0.1;
            armL = armR = 0.75;
            outL = outR = 0.15;
            break;
          case 'hit':
            ry = 1.5;
            armL = armR = 2.85;
            outL = outR = 0.12;
            break;
          case 'throw':
            armR = 1.5;
            armL = -0.4;
            lean = -0.08;
            legL = 0.3;
            legR = -0.2;
            break;
          case 'wade':
            outL = outR = 0.35 + Math.sin(t * 0.8) * 0.1;
            armL = armR = 0.15;
            break;
          case 'stand':
          default:
            armL = 0.05 + Math.sin(t * 0.7) * 0.04;
            armR = 0.05 - Math.sin(t * 0.7) * 0.04;
        }
        if (p.pose === 'dive') {
          hideBeachgoer(i);
          return;
        }
        const scale = p.scale;
        rootMatrix.compose(bv.set(p.x, p.z + (p.pose === 'ride' ? -0.5 : 0) + 0.1, p.y), rq2.setFromAxisAngle(yAxis, -p.a), bs.set(scale, scale, scale));
        // Whole-body turns and leans pivot about the hip joint.
        rq.copy(quat || rq.identity());
        if (lean) rq.multiply(leanQ.setFromAxisAngle(zAxis, lean));
        pivotMatrix.compose(pv.set(rx, ry + HIP, 0), rq, one);
        rootMatrix.multiply(pivotMatrix);
        rootMatrix.multiply(pivotMatrix.makeTranslation(0, -HIP, 0));
        setPart(rig.hips, i, 0, 7.4, 0, 0, 0, 0, 0, 4.2, 2.6, 6.0);
        setPart(rig.torso, i, 0, 10.7, 0, 0, 0, 0, 0, 4.0, 5.0, 5.8);
        if (p.shirt) setPart(rig.top, i, 0, 10.9, 0, 0, 0, 0, 0, 4.4, 5.6, 6.3);
        else if (p.top) setPart(rig.top, i, 0.3, 11.7, 0, 0, 0, 0, 0, 4.2, 1.7, 6.0);
        else rig.top.setMatrixAt(i, beachZero);
        setPart(rig.head, i, 0.1, 15.3, 0, 0, 0, 0, 0, 2.0, 2.4, 2.05);
        if (p.female) setPart(rig.hair, i, -0.9, 15.6, 0, 0, 0, 0, 0, 2.2, 2.6, 2.3);
        else setPart(rig.hair, i, -0.5, 16.4, 0, 0, 0, 0, 0, 1.95, 1.55, 2.12);
        setPart(rig.legs, i * 2, 0, 6.4, -1.6, outL * 0.2, legL, 0, -3.2, 2.0, 6.6, 2.2);
        setPart(rig.legs, i * 2 + 1, 0, 6.4, 1.6, -outR * 0.2, legR, 0, -3.2, 2.0, 6.6, 2.2);
        setPart(rig.arms, i * 2, 0, 12.8, -3.6, outL, armL, 0, -3.0, 1.5, 6.0, 1.5);
        setPart(rig.arms, i * 2 + 1, 0, 12.8, 3.6, -outR, armR, 0, -3.0, 1.5, 6.0, 1.5);
      }
      const beachBallMesh = mesh(sphereGeo, staticMat('#f5f1e6', 0.5), beachGroup, 0, -50, 0, 2.2, 2.2, 2.2),
        discMeshes = beachDiscs.map((d) =>
          mesh(d.ball ? sphereGeo : cylinderGeo, mat(d.ball ? '#e7473c' : '#f6d23a', 0.5), beachGroup, 0, -50, 0, d.ball ? 2 : 3, d.ball ? 2 : 0.5, d.ball ? 2 : 3),
        );
      beachBallMesh.userData.dynamic = true;
      discMeshes.forEach((m) => (m.userData.dynamic = true));
      let beachWasNear = true;
      /* Per-frame: called from updateWorldVisuals (world3d.js). */
      function updateBeachVisuals() {
        // The Marea beach club at the west end of the strand (beachclub3d.js).
        updateBeachClubVisuals();
        const near = Math.abs(cameraTarget.x + 2010) < 1900 && Math.abs(cameraTarget.y - 5620) < 1500;
        beachGroup.visible = near;
        if (!near) {
          beachWasNear = false;
          return;
        }
        const light = daylight();
        swashUniforms.uTime.value = gameTime;
        swashUniforms.uDay.value = clamp(0.25 + light * 0.85, 0, 1);
        swashUniforms.uDusk.value = clamp(1 - Math.abs(light - 0.3) / 0.28, 0, 1);
        beachPaint.window.emissiveIntensity = nightAmount * 1.4;
        const hour = (worldMinutes % 1440) / 60,
          open = hour > 8.4 && hour < 19.6 && weather.rain < 0.5;
        if (open !== umbrellasOpen) setUmbrellas(open);
        // Towels are down while someone is on them.
        if (towelCast !== beachgoers[0]) mapTowelOwners();
        L.towels.forEach((t, i) => {
          const owners = towelOwners.get(t),
            here = !!owners && owners.some((p) => p.visible && p.state === 'on');
          if (here === !!t.shown && beachWasNear) return;
          t.shown = here;
          if (here) placeInstance(towels, i, t.x, 0.35, t.y, t.a, 19, 0.4, 9);
          else towels.setMatrixAt(i, beachZero);
          towels.instanceMatrix.needsUpdate = true;
        });
        beachWasNear = true;
        L.buoys.forEach((b, i) => {
          const r = b.big ? 3.6 : 2.2;
          placeInstance(buoys, i, b.x, -2.9 + Math.sin(gameTime * 1.3 + i * 0.7) * 0.35 + r * 0.5, b.y, 0, r, r, r);
        });
        buoys.instanceMatrix.needsUpdate = true;
        placeBoats();
        beachgoers.forEach((p, i) => {
          if (p.visible && p.state !== 'off') {
            poseBeachgoer(p, i);
            p.drawn = true;
          } else if (p.drawn) {
            hideBeachgoer(i);
            p.drawn = false;
          }
        });
        for (const m of Object.values(rig)) m.instanceMatrix.needsUpdate = true;
        beachBallMesh.visible = beachBall.active;
        if (beachBall.active) beachBallMesh.position.set(beachBall.x, beachBall.z, beachBall.y);
        beachDiscs.forEach((d, i) => {
          discMeshes[i].visible = !!d.active;
          if (d.active) discMeshes[i].position.set(d.x, d.z, d.y);
        });
      }
      // END SUBSYSTEM: src/beach3d.js
