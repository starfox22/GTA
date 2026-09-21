      // BEGIN SUBSYSTEM: src/world3d.js — World scenery meshes
      /**
       * World scenery meshes
       * Source: src/world3d.js
       * Scope: createCityRenderer() closure.
       * Coastal details, street scenery and environmental objects.
       */
      /**
       * WATER
       * One shader draws every body of water: the bay, the river, the ocean and the
       * reservoir. A distance-to-shore field (built once from the land polygons)
       * drives shallow turquoise near beaches, breaking foam on the shoreline and
       * flattened swell in the shallows. Four Gerstner swells displace the mesh;
       * two scrolling noise fields add fine ripples in the fragment shader.
       */
      const SHORE_RES = 512,
        SHORE_UNIT_SCALE = 4; // texel value 255 = 1020 world units from land
      function buildShoreDistanceTexture() {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = maskCanvas.height = SHORE_RES;
        const mc = maskCanvas.getContext('2d');
        mc.fillStyle = '#000';
        mc.fillRect(0, 0, SHORE_RES, SHORE_RES);
        mc.scale(SHORE_RES / WORLD_SIZE, SHORE_RES / WORLD_SIZE);
        coastPath(mc);
        mc.fillStyle = '#fff';
        mc.fill();
        const px = mc.getImageData(0, 0, SHORE_RES, SHORE_RES).data,
          n = SHORE_RES * SHORE_RES,
          dist = new Float32Array(n),
          far = 1e6;
        for (let i = 0; i < n; i++) dist[i] = px[i * 4] > 127 ? 0 : far;
        // Two-pass chamfer distance transform (3-4 metric) in texel units.
        const relax = (i, j, cost) => {
          if (dist[j] + cost < dist[i]) dist[i] = dist[j] + cost;
        };
        for (let y = 0; y < SHORE_RES; y++)
          for (let x = 0; x < SHORE_RES; x++) {
            const i = y * SHORE_RES + x;
            if (x > 0) relax(i, i - 1, 3);
            if (y > 0) {
              relax(i, i - SHORE_RES, 3);
              if (x > 0) relax(i, i - SHORE_RES - 1, 4);
              if (x < SHORE_RES - 1) relax(i, i - SHORE_RES + 1, 4);
            }
          }
        for (let y = SHORE_RES - 1; y >= 0; y--)
          for (let x = SHORE_RES - 1; x >= 0; x--) {
            const i = y * SHORE_RES + x;
            if (x < SHORE_RES - 1) relax(i, i + 1, 3);
            if (y < SHORE_RES - 1) {
              relax(i, i + SHORE_RES, 3);
              if (x < SHORE_RES - 1) relax(i, i + SHORE_RES + 1, 4);
              if (x > 0) relax(i, i + SHORE_RES - 1, 4);
            }
          }
        const data = new Uint8Array(n * 4),
          unitsPerTexel = WORLD_SIZE / SHORE_RES;
        for (let i = 0; i < n; i++) {
          const units = (dist[i] / 3) * unitsPerTexel,
            v = Math.round(Math.min(255, units / SHORE_UNIT_SCALE));
          data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
          data[i * 4 + 3] = 255;
        }
        const tx = new Three.DataTexture(data, SHORE_RES, SHORE_RES, Three.RGBAFormat);
        tx.minFilter = tx.magFilter = Three.LinearFilter;
        tx.wrapS = tx.wrapT = Three.ClampToEdgeWrapping;
        tx.needsUpdate = true;
        return tx;
      }
      const waterUniforms = {
        uTime: { value: 0 },
        uDay: { value: 1 },
        uDusk: { value: 0 },
        uViewDir: { value: new Three.Vector3(0, 1, 0) },
        uSun: { value: new Three.Vector3(-0.45, 0.76, -0.23).normalize() },
        uShore: { value: buildShoreDistanceTexture() },
        uWorldSize: { value: WORLD_SIZE },
        uShoreScale: { value: 255 * SHORE_UNIT_SCALE },
      };
      const waterMaterial = new Three.ShaderMaterial({
        uniforms: waterUniforms,
        vertexShader: `
          varying vec3 vWorld;
          varying vec3 vNormal;
          varying float vCrest;
          varying float vShore;
          uniform float uTime;
          uniform sampler2D uShore;
          uniform float uWorldSize;
          uniform float uShoreScale;
          // Gerstner swell: horizontal pinch sharpens crests without extra geometry.
          void wave(vec2 dir, float amp, float wavelength, float speed, float steep, vec2 p,
                    inout vec3 offset, inout vec3 dNormal) {
            float k = 6.28318 / wavelength;
            float phase = k * dot(dir, p) - speed * uTime;
            float c = cos(phase), s = sin(phase);
            offset.xz += dir * (steep * amp * c);
            offset.y += amp * s;
            dNormal.x -= dir.x * k * amp * c;
            dNormal.z -= dir.y * k * amp * c;
          }
          void main(){
            vec4 origin = modelMatrix * vec4(position, 1.);
            vec2 p = origin.xz;
            float shore = texture2D(uShore, p / uWorldSize).r * uShoreScale;
            float depthFade = 0.22 + 0.78 * smoothstep(8., 190., shore);
            vec3 offset = vec3(0.);
            vec3 dNormal = vec3(0., 1., 0.);
            wave(normalize(vec2(0.82, 0.57)), 1.9 * depthFade, 210., 1.05, 0.55, p, offset, dNormal);
            wave(normalize(vec2(-0.35, 0.94)), 1.1 * depthFade, 128., 1.5, 0.5, p, offset, dNormal);
            wave(normalize(vec2(0.98, -0.2)), 0.55 * depthFade, 66., 2.1, 0.4, p, offset, dNormal);
            wave(normalize(vec2(0.3, -0.95)), 0.32 * depthFade, 37., 2.9, 0.3, p, offset, dNormal);
            vec3 world = origin.xyz + offset;
            vWorld = world;
            vCrest = offset.y / max(0.05, 3.9 * depthFade);
            vShore = shore;
            vNormal = normalize(dNormal);
            gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec3 vWorld;
          varying vec3 vNormal;
          varying float vCrest;
          varying float vShore;
          uniform float uTime;
          uniform float uDay;
          uniform float uDusk;
          uniform vec3 uViewDir;
          uniform vec3 uSun;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float vnoise(vec2 p){
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3. - 2. * f);
            return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
                       mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
          }
          float ripples(vec2 p){
            return vnoise(p * 0.045 + vec2(uTime * 0.09, -uTime * 0.05)) * 0.6
                 + vnoise(p * 0.11 + vec2(-uTime * 0.13, uTime * 0.07)) * 0.3
                 + vnoise(p * 0.27 + vec2(uTime * 0.21, uTime * 0.16)) * 0.1;
          }
          void main(){
            // Fine ripple normal from noise gradient.
            float e = 1.6;
            float h0 = ripples(vWorld.xz);
            float hx = ripples(vWorld.xz + vec2(e, 0.));
            float hz = ripples(vWorld.xz + vec2(0., e));
            float rippleScale = 0.55 + 0.45 * smoothstep(4., 120., vShore);
            vec3 n = normalize(vNormal + vec3((h0 - hx) * 2.2, 0., (h0 - hz) * 2.2) * rippleScale);
            vec3 viewDir = normalize(uViewDir);
            float facing = max(dot(viewDir, n), 0.);
            float fresnel = 0.04 + 0.96 * pow(1. - facing, 4.);
            // Regional palettes: turquoise Keys and county reefs, cold slate in Marlow Bay.
            float tropical = smoothstep(3500., 4600., vWorld.x) + smoothstep(5400., 6400., vWorld.z);
            tropical = clamp(tropical, 0., 1.);
            vec3 deep = mix(vec3(.018, .10, .19), vec3(.02, .26, .32), tropical);
            vec3 shallow = mix(vec3(.10, .40, .48), vec3(.22, .68, .66), tropical);
            float depthMix = 1. - smoothstep(0., 230., vShore + h0 * 30.);
            vec3 body = mix(deep, shallow, depthMix * depthMix);
            // Sky reflection: night navy -> dusk amber horizon -> pale day sky.
            vec3 skyNight = vec3(.05, .08, .16);
            vec3 skyDay = vec3(.55, .70, .84);
            vec3 sky = mix(skyNight, skyDay, uDay);
            sky = mix(sky, vec3(.92, .55, .33), uDusk * 0.55);
            vec3 color = mix(body, sky, fresnel * 0.62);
            // Wave-crest scattering lifts the color where the swell is tallest.
            color += shallow * 0.18 * clamp(vCrest, 0., 1.) * uDay;
            // Sun glitter: tight and broad specular lobes.
            vec3 reflected = reflect(-uSun, n);
            float spec = pow(max(dot(reflected, viewDir), 0.), 320.) * 2.4
                       + pow(max(dot(reflected, viewDir), 0.), 28.) * 0.22;
            vec3 sunColor = mix(vec3(1., .96, .86), vec3(1., .62, .34), uDusk);
            color += sunColor * spec * (0.25 + 1.1 * uDay);
            // Moon path and shoreline light spill at night.
            float sparkle = smoothstep(0.78, 0.92, vnoise(vWorld.xz * 0.9 + uTime * 0.6));
            color += vec3(.75, .82, 1.) * sparkle * 0.08 * (1. - uDay) * (0.3 + fresnel);
            color += vec3(1., .78, .5) * sparkle * 0.14 * (1. - uDay) * (1. - smoothstep(0., 360., vShore));
            // Foam: breaking edge, retreating wash and crest whitecaps.
            float washPhase = fract(vShore * 0.022 - uTime * 0.26 + h0 * 0.4);
            float wash = smoothstep(0.78, 1., washPhase) * (1. - smoothstep(24., 120., vShore));
            float edge = 1. - smoothstep(0., 22. + h0 * 14., vShore);
            float caps = smoothstep(0.58, 0.95, vCrest * (0.65 + h0 * 0.7)) * smoothstep(40., 160., vShore);
            float foam = clamp(edge * 0.9 + wash * 0.65 + caps * 0.4, 0., 1.);
            foam *= 0.55 + 0.45 * vnoise(vWorld.xz * 0.35 + uTime * 0.4);
            color = mix(color, vec3(.86, .93, .92), foam);
            color *= 0.3 + 0.7 * uDay;
            gl_FragColor = vec4(color, 1.);
          }
        `,
      });
      // Mobile halves the grid density; wave phase stays world-aligned at either resolution.
      const waterSurface = new Three.Mesh(
        new Three.PlaneGeometry(7000, 7000, touchEnabled() ? 110 : 220, touchEnabled() ? 110 : 220),
        waterMaterial,
      );
      waterSurface.rotation.x = -Math.PI / 2;
      waterSurface.position.set(WORLD_SIZE / 2, -3.1, WORLD_SIZE / 2);
      waterSurface.frustumCulled = false;
      scene.add(waterSurface);
      const farWater = new Three.Mesh(
        new Three.PlaneGeometry(28000, 28000),
        new Three.MeshBasicMaterial({
          color: '#204e60',
        }),
      );
      farWater.rotation.x = -Math.PI / 2;
      // Sits well below the deepest wave trough so it never pokes through the swell.
      farWater.position.set(WORLD_SIZE / 2, -18, WORLD_SIZE / 2);
      scene.add(farWater);
      const shoreFoam = [],
        shoreMaterial = new Three.MeshBasicMaterial({
          color: '#92cfbf',
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
          side: Three.DoubleSide,
        });
      const foamCanvas = document.createElement('canvas');
      foamCanvas.width = 128;
      foamCanvas.height = 32;
      const foamContext = foamCanvas.getContext('2d');
      for (let x = 0; x < 128; x += 2) {
        const y = 13 + Math.sin(x * 0.1) * 3 + Math.sin(x * 0.29) * 2;
        foamContext.fillStyle =
          'rgba(223,243,227,' + (0.28 + 0.28 * (0.5 + 0.5 * Math.sin(x * 0.37))) + ')';
        foamContext.fillRect(x, y, 3, 2 + Math.sin(x * 0.16) * 1.5);
      }
      const foamTex = new Three.CanvasTexture(foamCanvas);
      for (const e of coastSegments()) {
        if (e.opening) continue;
        const group = new Three.Group(),
          style = shoreStyle(e),
          { nx, ny } = shoreNormal(e);
        group.position.set(e.x, 0, e.y);
        group.rotation.y = -e.a;
        scene.add(group);
        batchGroups.push(group);
        const outward = -Math.sin(e.a) * nx + Math.cos(e.a) * ny;
        if (style === 'quay') {
          box(group, 0, 2.3, 0, e.length + 1, 5, 5, mat('#727e80'));
          box(group, 0, 5.2, 0, e.length + 1, 0.9, 7, concrete);
        }
        const shallow = new Three.Mesh(
          new Three.PlaneGeometry(e.length + 2, style === 'beach' ? 48 : 15),
          shoreMaterial,
        );
        shallow.rotation.x = -Math.PI / 2;
        shallow.position.set(0, -0.55, outward * (style === 'beach' ? 19 : 7));
        group.add(shallow);
        for (let k = 0; k < (style === 'beach' ? 2 : 1); k++) {
          const material = new Three.MeshBasicMaterial({
              map: foamTex,
              transparent: true,
              opacity: 0.25,
              depthWrite: false,
              side: Three.DoubleSide,
            }),
            foam = new Three.Mesh(new Three.PlaneGeometry(e.length + 2, 13), material);
          foam.rotation.x = -Math.PI / 2;
          foam.userData.dynamic = true;
          foam.position.y = -0.35 - k * 0.05;
          foam.userData = {
            outward,
            phase: e.x * 0.003 + e.y * 0.002 + k * 0.5,
            beach: style === 'beach',
          };
          group.add(foam);
          shoreFoam.push(foam);
        }
        statics.push({
          x: e.x,
          y: e.y,
          group,
          radius: 90,
        });
      }
      function makePalm(x, z, size = 1) {
        const g = new Three.Group();
        g.position.set(x, 0, z);
        scene.add(g);
        batchGroups.push(g);
        const trunk = mat('#978266'),
          palm = mat('#3e7862');
        rod(g, new Three.Vector3(0, 0, 0), new Three.Vector3(2 * size, 28 * size, 0), 1.5 * size, trunk);
        for (let k = 0; k < 7; k++) {
          const a = (k * TAU) / 7,
            verts = [];
          for (let j = 0; j < 7; j++) {
            const d = (j / 6) * 19 * size,
              h = 31 * size + Math.sin((j / 6) * Math.PI) * 4 * size - (j / 6) * 8 * size,
              w = Math.sin((j / 6) * Math.PI) * 3 * size;
            verts.push(
              2 * size + Math.cos(a) * d - Math.sin(a) * w,
              h,
              Math.sin(a) * d + Math.cos(a) * w,
              2 * size + Math.cos(a) * d + Math.sin(a) * w,
              h,
              Math.sin(a) * d - Math.cos(a) * w,
            );
          }
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.Float32BufferAttribute(verts, 3));
          const idx = [];
          for (let j = 0; j < 6; j++)
            idx.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2);
          geo.setIndex(idx);
          geo.computeVertexNormals();
          const model = mesh(geo, palm, g, 0, 0, 0);
          model.material.side = Three.DoubleSide;
        }
        statics.push({
          x,
          y: z,
          group: g,
          radius: 35,
        });
        return g;
      }
      // The keys trade brick canyons for pastel hotels, pools, palms and beach furniture.
      for (let z = 730; z < 4550; z += 145) {
        const x = z < 1900 ? 5250 : z < 3200 ? 5260 : 5170;
        if (landAt(x, z)) {
          makePalm(x - 62, z, 1.15);
          makePalm(x + 67, z + 20, 1);
        }
      }
      const resortColors = ['#e3b7a6', '#a7cbc5', '#d8cba8', '#aebbd8'];
      for (const b of buildings.filter((b) => b.tropical && !b.place && !b.roofBar)) {
        const group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        const co = mat(resortColors[Math.floor(b.y / 200) % 4]);
        for (let y = 15; y < b.height; y += 13) {
          box(group, b.x + b.w / 2, y, b.y + b.h + 3, b.w - 12, 1.1, 7, co);
          box(group, b.x + b.w / 2, y + 3.5, b.y + b.h + 6, b.w - 14, 5, 0.6, glass);
        }
        for (const x of [b.x + 10, b.x + b.w - 10])
          box(group, x, b.height / 2, b.y + b.h + 3, 3, b.height, 5, co);
        if (b.w > 220) {
          const px = b.x + b.w / 2,
            pz = b.y + b.h + 47;
          box(group, px, 0.18, pz, 99, 0.35, 40, mat('#c9c1a7'));
          box(group, px, 0.4, pz, 86, 0.4, 29, mat('#65b8b7', 0.15, 0.3));
          for (const side of [-1, 1])
            for (let j = -1; j <= 1; j++)
              box(group, px + j * 29, 1.8, pz + side * 25, 15, 2, 5, mat('#d1ddd4'));
        }
        statics.push({
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          group,
          radius: 230,
        });
      }
      for (let z = 1100; z < 4200; z += 180) {
        const x = z < 2600 ? 5400 : 5390;
        if (!landAt(x, z)) continue;
        const group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        box(group, x, 9, z, 0.8, 18, 0.8, wood);
        mesh(new Three.ConeGeometry(12, 5, 10), mat(z % 360 ? '#dca48f' : '#92bbbd'), group, x, 18, z);
        for (const side of [-1, 1]) {
          box(group, x + side * 13, 1.4, z + 10, 5, 2, 15, mat('#e5dac6'));
        }
        statics.push({
          x,
          y: z,
          group,
          radius: 30,
        });
      }
      sign('OCEAN DRIVE', 5170, 1620, 125, '#b7ece1');
      sign('PALM KEYS', 4180, 1110, 150, '#eab7bc');
      sign('NORTHBANK', 3200, 1090, 125, '#d1d9ce');
      // A terminal, gate arms, control tower, service equipment and parked aircraft.
      const ag = new Three.Group();
      scene.add(ag);
      batchGroups.push(ag);
      const terminalGlass = mat('#446875', 0.16, 0.55),
        airWhite = mat('#d8dfdc', 0.36, 0.3),
        airTrim = mat('#507f8f');
      box(
        ag,
        AIRPORT.x + AIRPORT.w / 2,
        22,
        AIRPORT.y + AIRPORT.h + 1,
        AIRPORT.w - 12,
        29,
        1.1,
        terminalGlass,
      );
      for (let x = AIRPORT.x + 12; x < AIRPORT.x + AIRPORT.w; x += 19)
        box(ag, x, 22, AIRPORT.y + AIRPORT.h + 2, 1, 30, 1, chrome);
      sign('SOUTHPORT INTERNATIONAL', 1010, 4990, 235, '#bcd9dc');
      box(ag, 790, 54, 5075, 19, 108, 19, concrete);
      box(ag, 790, 113, 5075, 46, 20, 40, terminalGlass);
      box(ag, 790, 124, 5075, 50, 3, 44, airWhite);
      box(ag, 790, 139, 5075, 1, 27, 1, chrome);
      // Static apron aircraft share the flying airframes' geometry (plane3d.js).
      function parkedJet(x, z, a, size = 1) {
        const group = new Three.Group();
        group.position.set(x, 0, z);
        group.rotation.y = a;
        const kind = size >= 0.9 ? 'airliner' : 'jet';
        group.scale.setScalar(size * (kind === 'airliner' ? 0.63 : 0.9));
        ag.add(group);
        buildAircraft(kind, group, { color: kind === 'airliner' ? '#e6ebe8' : '#dfe3e0', accent: kind === 'airliner' ? '#2c6f8e' : '#8a3b46' });
      }
      parkedJet(680, 4800, -Math.PI / 2, 0.9);
      parkedJet(680, 5110, -Math.PI / 2, 1);
      parkedJet(1000, 5400, 0, 0.65);
      for (let y = 4300; y < 5290; y += 55)
        for (const x of [294, 542]) {
          box(ag, x, 1, y, 2, 2, 2, warmLamp);
          halo(ag, x, 2, y, 8, '#e8dca5');
        }
      for (const z of [4790, 5110]) box(ag, 806, 14, z, 108, 15, 12, airWhite);
      for (let x = 840; x < 1070; x += 30) box(ag, x, 3, 5140, 21, 6, 12, mat('#91836d'));
      statics.push({
        x: 750,
        y: 4900,
        group: ag,
        radius: 850,
      });
      // The entire block is the hotel; every substantial roof prop shares its collision footprint.
      const roofGroup = new Three.Group();
      roofGroup.name = 'Blue Hour rooftop';
      scene.add(roofGroup);
      roofGroup.position.set(ROOFTOP.x, ROOFTOP.height, ROOFTOP.y);
      const rw = ROOFTOP.w,
        rh = ROOFTOP.h,
        deckMat = mat('#a4917d'),
        ivory = mat('#e4d8bd'),
        navy = mat('#264354'),
        brass = mat('#bd9960', 0.35, 0.65),
        cushion = mat('#e5dbce'),
        poolMat = new Three.MeshStandardMaterial({
          color: '#48aeb7',
          roughness: 0.17,
          metalness: 0.35,
          emissive: '#15515a',
          emissiveIntensity: 0.25,
        }),
        wine = mat('#812e45', 0.25),
        bottleMats = [mat('#527e68', 0.22), mat('#b89463', 0.23), mat('#7796a2', 0.22)];
      box(roofGroup, rw / 2, 1.3, rh / 2, rw - 8, 2.6, rh - 8, deckMat);
      for (let z = 12; z < rh - 12; z += 12)
        box(roofGroup, rw / 2, 2.65, z, rw - 24, 0.08, 0.4, mat('#796954'));
      box(roofGroup, 84, 2.75, 161, 140, 0.12, 96, mat('#aa826a'));
      box(roofGroup, 285, 2.75, 122, 98, 0.12, 123, mat('#516574'));
      box(roofGroup, 195, 2.75, 247, 100, 0.12, 90, navy);
      for (const z of [6, rh - 6]) {
        box(roofGroup, rw / 2, 6, z, rw - 10, 9, 1, glass);
        box(roofGroup, rw / 2, 11, z, rw - 9, 0.8, 1, brass);
      }
      for (const x of [6, rw - 6]) {
        box(roofGroup, x, 6, rh / 2, 1, 9, rh - 10, glass);
        box(roofGroup, x, 11, rh / 2, 1, 0.8, rh - 9, brass);
      }
      for (let x = 15; x < rw; x += 30)
        for (const z of [6, rh - 6]) box(roofGroup, x, 7, z, 0.8, 12, 0.8, brass);
      for (let z = 35; z < rh - 20; z += 30)
        for (const x of [6, rw - 6]) box(roofGroup, x, 7, z, 0.8, 12, 0.8, brass);
      let roofPool;
      for (const p of roofCover) {
        const x = p.x - ROOFTOP.x + p.w / 2,
          z = p.y - ROOFTOP.y + p.h / 2;
        if (p.kind === 'pool') {
          box(roofGroup, x, 3, z, p.w, 1.6, p.h, ivory);
          roofPool = box(roofGroup, x, 3.9, z, p.w - 12, 0.35, p.h - 12, poolMat);
          for (let i = -1; i <= 1; i++)
            box(roofGroup, x + i * 29, 4.11, z, 1, 0.06, p.h - 13, mat('#94d9d7'));
          for (const side of [-1, 1]) {
            rod(
              roofGroup,
              new Three.Vector3(x + 38, 5, z + side * 6),
              new Three.Vector3(x + 46, 8, z + side * 6),
              0.65,
              chrome,
            );
            box(roofGroup, x + 39, 4.5, z + side * 6, 0.7, 1, 1, chrome);
          }
        } else if (p.kind === 'lift') {
          box(roofGroup, x, 17, z, p.w, 34, p.h, navy);
          box(roofGroup, x, 35, z, p.w + 3, 2, p.h + 3, ivory);
          box(roofGroup, x + p.w / 2 + 0.4, 13, z, 1, 22, 20, chrome);
          box(roofGroup, x + p.w / 2 + 1, 13, z, 0.6, 22, 0.5, navy);
          box(roofGroup, x + p.w / 2 + 1, 15, z + 14, 1, 4, 2, warmLamp);
        } else if (p.kind === 'bar') {
          box(roofGroup, x, 10, z, p.w, 20, p.h, navy);
          box(roofGroup, x, 21, z, p.w + 2, 2, p.h + 2, ivory);
          box(roofGroup, x, 13, z + p.h / 2 + 0.2, p.w - 6, 1, 0.6, brass);
          for (let i = 0; i < 15; i++) {
            const xx = x - p.w / 2 + 6 + i * 7.5;
            mesh(cylinderGeo, bottleMats[i % 3], roofGroup, xx, 25, z - 5, 1.5, 6, 1.5);
            box(roofGroup, xx, 28.5, z - 5, 1, 1.4, 1, brass);
          }
          for (const dx of [-43, -14, 14, 43]) {
            mesh(cylinderGeo, navy, roofGroup, x + dx, 7, z + 20, 4, 2, 4);
            box(roofGroup, x + dx, 4, z + 20, 0.8, 5, 0.8, brass);
          }
          box(roofGroup, x, 35, z - 8, p.w, 2, 3, brass);
          for (let i = -2; i <= 2; i++) halo(roofGroup, x + i * 22, 30, z - 8, 13, '#edd1a0');
        } else if (p.kind === 'hedge') {
          box(roofGroup, x, 7, z, p.w, 14, p.h, ivory);
          const along = p.w > p.h,
            steps = Math.ceil(Math.max(p.w, p.h) / 8);
          for (let i = 0; i < steps; i++)
            mesh(
              sphereGeo,
              leafMats[1],
              roofGroup,
              along ? p.x - ROOFTOP.x + 4 + i * 8 : x,
              20,
              along ? z : p.y - ROOFTOP.y + 4 + i * 8,
              along ? 6 : 8,
              6,
              along ? 8 : 6,
            );
        } else if (p.kind === 'sofa') {
          box(roofGroup, x, 5, z, p.w, 6, p.h, navy);
          box(roofGroup, x, 8, z + 1, p.w - 3, 2, p.h - 4, cushion);
          box(roofGroup, x, 10, z - p.h / 2 + 2, p.w, 9, 4, navy);
          for (let i = 0; i < Math.floor(p.w / 12); i++)
            box(roofGroup, p.x - ROOFTOP.x + 7 + i * 12, 10, z - p.h / 2 + 5, 9, 5, 3, cushion);
        } else if (p.kind === 'table') {
          box(roofGroup, x, 5, z, 2, 7, 2, brass);
          box(roofGroup, x, 9, z, p.w, 1.5, p.h, ivory);
          box(roofGroup, x + 3, 10, z - 4, 5, 0.1, 3, navy);
          mesh(cylinderGeo, brass, roofGroup, x - 4, 11, z + 4, 1, 3, 1);
          halo(roofGroup, x - 4, 13, z + 4, 7, '#ffe1a9');
        } else if (p.kind === 'buffet') {
          box(roofGroup, x, 7, z, p.w, 14, p.h, navy);
          box(roofGroup, x, 14.8, z, p.w + 1, 1.4, p.h + 1, ivory);
          for (let i = -1; i <= 1; i++) mesh(sphereGeo, chrome, roofGroup, x + i * 12, 17, z, 4, 2.5, 4);
        } else if (p.kind === 'dj') {
          box(roofGroup, x, 5, z, p.w, 6, p.h, navy);
          box(roofGroup, x, 11, z - 3, p.w - 26, 7, 10, navy);
          for (const dx of [-23, 23]) {
            mesh(cylinderGeo, chrome, roofGroup, x + dx, 15, z - 3, 5, 0.6, 5);
            mesh(cylinderGeo, darkMetal, roofGroup, x + dx, 15.4, z - 3, 3.5, 0.1, 3.5);
          }
          box(roofGroup, x, 15, z - 3, 11, 1, 7, chrome);
          for (const dx of [-p.w / 2 + 6, p.w / 2 - 6]) {
            box(roofGroup, x + dx, 16, z, 10, 22, 10, darkMetal);
            for (const h of [12, 21]) {
              const speaker = mesh(cylinderGeo, rubber, roofGroup, x + dx, h, z - 5.1, 3.3, 0.8, 3.3);
              speaker.rotation.x = Math.PI / 2;
            }
          }
        }
      }
      const reservedGlass = new Three.Group();
      roofGroup.add(reservedGlass);
      reservedGlass.position.set(273, 10, 131);
      mesh(new Three.CylinderGeometry(2.5, 1.7, 4, 12), glass, reservedGlass, 0, 4, 0);
      mesh(new Three.CylinderGeometry(2, 1.4, 2, 12), wine, reservedGlass, 0, 3.3, 0);
      box(reservedGlass, 0, 1, 0, 0.5, 2, 0.5, brass);
      mesh(cylinderGeo, brass, reservedGlass, 0, 0, 0, 2, 0.3, 2);
      const drinkLabel = sign(
        'P · RESERVED GLASS',
        ROOF_HIT.drink.x,
        ROOF_HIT.drink.y - 12,
        66,
        '#f2d491',
      );
      drinkLabel.position.y = ROOFTOP.height + 25;
      drinkLabel.userData.backing.position.y = ROOFTOP.height + 25;
      const danceTiles = [];
      for (let x = 0; x < 6; x++)
        for (let z = 0; z < 5; z++) {
          const material = new Three.MeshStandardMaterial({
            color: (x + z) % 2 ? '#406b77' : '#705878',
            emissive: (x + z) % 2 ? '#355b68' : '#62365e',
            emissiveIntensity: 0.35,
            roughness: 0.3,
          });
          danceTiles.push(box(roofGroup, 158 + x * 14, 2.95, 217 + z * 15, 13, 0.2, 14, material));
        }
      // Slim festoon cables give the party a ceiling without obscuring navigation.
      for (const z of [186, 289]) {
        for (const x of [22, 337]) box(roofGroup, x, 22, z, 1, 44, 1, brass);
        for (let i = 0; i < 15; i++) {
          const x = 22 + i * 22.5,
            y = 42 - Math.sin((i / 14) * Math.PI) * 5;
          rod(
            roofGroup,
            new Three.Vector3(x, y, z),
            new Three.Vector3(x + 22.5, 42 - Math.sin(((i + 1) / 14) * Math.PI) * 5, z),
            0.18,
            darkMetal,
          );
          if (i < 14) {
            mesh(sphereGeo, warmLamp, roofGroup, x, y - 1, z, 1, 1.3, 1);
            halo(roofGroup, x, y - 1, z, 9, '#efd6a2');
          }
        }
      }
      for (const [x, z] of [
        [92, 204],
        [300, 204],
        [283, 263],
      ]) {
        box(roofGroup, x, 22, z, 1.5, 31, 1.5, wood);
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6,
            leaf = box(roofGroup, x + Math.cos(a) * 7, 38, z + Math.sin(a) * 7, 15, 1.4, 3, leafMats[1]);
          leaf.rotation.y = -a;
          leaf.rotation.z = 0.18;
        }
      }
      function roofSign(text, x, z, width, color, y = 27) {
        const s = sign(text, ROOFTOP.x + x, ROOFTOP.y + z, width, color);
        s.position.y = ROOFTOP.height + y;
        s.userData.backing.position.y = s.position.y;
        return s;
      }
      roofSign('THE BLUE HOUR', 180, rh + 2, 196, '#9fdad8', 20);
      roofSign('COCKTAILS', 251, 23, 77, '#edcc99', 40);
      roofSign('ELEVATOR', 37, 327, 54, '#c4d9d7', 29);
      roofSign('PRIVATE LOUNGE', 303, 74, 73, '#d6bf8b', 27);
      const entrySign = sign('BLUE HOUR HOTEL', ROOFTOP.door.x, ROOFTOP.y + rh + 3, 190, '#d4c4a1');
      entrySign.position.y = 34;
      entrySign.userData.backing.position.y = 34;
      statics.push({
        x: ROOFTOP.x + rw / 2,
        y: ROOFTOP.y + rh / 2,
        group: roofGroup,
        radius: 300,
      });
      function updateWorldVisuals() {
        const hit = rooftopJob();
        reservedGlass.visible = !hit || !['sip', 'sick', 'collapse', 'dead'].includes(hit.poisonPhase);
        poolMat.emissiveIntensity = 0.22 + Math.sin(gameTime * 1.8) * 0.055;
        danceTiles.forEach(
          (t, i) =>
            (t.material.emissiveIntensity = hit?.partyPanic
              ? 0.08
              : 0.23 + Math.sin(gameTime * 2.3 + i * 0.7) * 0.13),
        );
        drinkLabel.visible = drinkLabel.userData.backing.visible =
          !!rooftopJob() && player.roof && !rooftopJob().killRegistered;
        const light = daylight();
        waterUniforms.uTime.value = gameTime;
        waterUniforms.uDay.value = 0.12 + 0.88 * light;
        waterUniforms.uDusk.value = clamp(1 - Math.abs(light - 0.3) / 0.28, 0, 1);
        camera.getWorldDirection(waterUniforms.uViewDir.value).multiplyScalar(-1);
        waterSurface.scale.set(Math.max(1, 1 / worldZoom / 2), Math.max(1, 1 / worldZoom / 2), 1);
        waterSurface.position.x = Math.round(cameraTarget.x / 25) * 25;
        waterSurface.position.z = Math.round(cameraTarget.y / 25) * 25;
        shoreFoam.forEach((m) => {
          const t = (gameTime * 0.18 + m.userData.phase) % 1;
          m.position.z = m.userData.outward * (3 + (1 - t) * (m.userData.beach ? 36 : 10));
          m.material.opacity = Math.sin(t * Math.PI) * (m.userData.beach ? 0.3 : 0.12);
        });
        farWater.material.color
          .set('#061421')
          .lerp(new Three.Color(cameraTarget.x > 3900 ? '#0c5a68' : '#0f3a52'), light);
      }

      // Causeway railings match the complete collision spans, including the wider southern bay.
      for (const z of BRIDGES) {
        const [start, end] = bridgeSpan(z),
          group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        for (const [a, b] of bridgeRailSpans(z).flatMap(([a, b]) => [
          [a, Math.min(b, RIVER.left)],
          [Math.max(a, RIVER.right), b],
        ]))
          if (b > a)
            for (const side of [-1, 1]) {
              box(group, (a + b) / 2, 4, z + side * 55, b - a, 7, 4, concrete);
              box(group, (a + b) / 2, 8, z + side * 55, b - a, 1.1, 1.5, chrome);
              for (let x = a + 18; x < b; x += 68) box(group, x, 3, z + side * 55, 2, 9, 5, chrome);
            }
        statics.push({
          x: (start + end) / 2,
          y: z,
          group,
          radius: (end - start) / 2 + 100,
        });
      }
      const rescueBuoy = new Three.Group();
      rescueBuoy.position.set(LOC.waterCase.x, 0, LOC.waterCase.y);
      scene.add(rescueBuoy);
      mesh(cylinderGeo, mat('#cfa74c'), rescueBuoy, 0, 1, 0, 8, 5, 8);
      box(rescueBuoy, 0, 11, 0, 1, 20, 1, chrome);
      box(rescueBuoy, 0, 19, 0, 9, 7, 1, mat('#e0c56e'));
      halo(rescueBuoy, 0, 23, 0, 10, '#efd197');
      box(rescueBuoy, 8, 3, 1, 8, 5, 6, mat('#353f43'));
      statics.push({
        x: LOC.waterCase.x,
        y: LOC.waterCase.y,
        group: rescueBuoy,
        radius: 28,
      });
      // END SUBSYSTEM: src/world3d.js
