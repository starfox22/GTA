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
      // The world box is taller than it is wide since the northern reclamation, so
      // the distance field is too; texels stay square, which the chamfer pass needs.
      const SHORE_RES = 768,
        SHORE_ROWS = Math.round((SHORE_RES * WORLD_HEIGHT) / WORLD_WIDTH),
        SHORE_UNIT_SCALE = 4; // texel value 255 = 1020 world units from land
      function buildShoreDistanceTexture() {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = SHORE_RES;
        maskCanvas.height = SHORE_ROWS;
        const mc = maskCanvas.getContext('2d', { willReadFrequently: true });
        mc.fillStyle = '#000';
        mc.fillRect(0, 0, SHORE_RES, SHORE_ROWS);
        mc.scale(SHORE_RES / WORLD_WIDTH, SHORE_RES / WORLD_WIDTH);
        mc.translate(-WORLD_LEFT, -WORLD_TOP);
        coastPath(mc);
        mc.fillStyle = '#fff';
        mc.fill();
        const px = mc.getImageData(0, 0, SHORE_RES, SHORE_ROWS).data,
          n = SHORE_RES * SHORE_ROWS,
          dist = new Float32Array(n),
          far = 1e6;
        for (let i = 0; i < n; i++) dist[i] = px[i * 4] > 127 ? 0 : far;
        // Two-pass chamfer distance transform (3-4 metric) in texel units.
        const relax = (i, j, cost) => {
          if (dist[j] + cost < dist[i]) dist[i] = dist[j] + cost;
        };
        for (let y = 0; y < SHORE_ROWS; y++)
          for (let x = 0; x < SHORE_RES; x++) {
            const i = y * SHORE_RES + x;
            if (x > 0) relax(i, i - 1, 3);
            if (y > 0) {
              relax(i, i - SHORE_RES, 3);
              if (x > 0) relax(i, i - SHORE_RES - 1, 4);
              if (x < SHORE_RES - 1) relax(i, i - SHORE_RES + 1, 4);
            }
          }
        for (let y = SHORE_ROWS - 1; y >= 0; y--)
          for (let x = SHORE_RES - 1; x >= 0; x--) {
            const i = y * SHORE_RES + x;
            if (x < SHORE_RES - 1) relax(i, i + 1, 3);
            if (y < SHORE_ROWS - 1) {
              relax(i, i + SHORE_RES, 3);
              if (x < SHORE_RES - 1) relax(i, i + SHORE_RES + 1, 4);
              if (x > 0) relax(i, i + SHORE_RES - 1, 4);
            }
          }
        // Green channel: how close the water is to an open-sea beach, so the
        // shader knows where to draw sandy shallows and rolling breakers. Beach
        // shores in a sheltered sound would be left out; every sand shore faces open sea.
        mc.setTransform(1, 0, 0, 1, 0, 0);
        mc.fillStyle = '#000';
        mc.fillRect(0, 0, SHORE_RES, SHORE_ROWS);
        mc.scale(SHORE_RES / WORLD_WIDTH, SHORE_RES / WORLD_WIDTH);
        mc.translate(-WORLD_LEFT, -WORLD_TOP);
        mc.filter = 'blur(3px)';
        mc.strokeStyle = 'rgba(255,255,255,0.6)';
        mc.lineWidth = 460;
        mc.lineCap = 'round';
        mc.beginPath();
        for (const e of coastSegments()) {
          if (e.opening || shoreStyle(e) !== 'beach') continue;
          const dx = (Math.cos(e.a) * e.length) / 2,
            dy = (Math.sin(e.a) * e.length) / 2;
          mc.moveTo(e.x - dx, e.y - dy);
          mc.lineTo(e.x + dx, e.y + dy);
        }
        mc.stroke();
        mc.filter = 'none';
        const beachMask = mc.getImageData(0, 0, SHORE_RES, SHORE_ROWS).data;
        const data = new Uint8Array(n * 4),
          unitsPerTexel = WORLD_WIDTH / SHORE_RES;
        for (let i = 0; i < n; i++) {
          const units = (dist[i] / 3) * unitsPerTexel,
            v = Math.round(Math.min(255, units / SHORE_UNIT_SCALE));
          data[i * 4] = data[i * 4 + 2] = v;
          data[i * 4 + 1] = Math.min(255, beachMask[i * 4] * 1.6);
          data[i * 4 + 3] = 255;
        }
        const tx = new Three.DataTexture(data, SHORE_RES, SHORE_ROWS, Three.RGBAFormat);
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
        uWorldOrigin: { value: new Three.Vector2(WORLD_LEFT, WORLD_TOP) },
        uWorldExtent: { value: new Three.Vector2(WORLD_WIDTH, WORLD_HEIGHT) },
        uShoreScale: { value: 255 * SHORE_UNIT_SCALE },
        // 1 while the perspective flight camera is active: view vectors then run
        // from each fragment to the camera instead of along one fixed direction.
        uPerspective: { value: 0 },
        // Boat wakes (wakes3d.js): foam in red, wave crest and trough in green and
        // blue, over (origin x, origin z, 1 / span, 1 / map size).
        uWake: { value: null },
        uWakeRect: { value: new Three.Vector4(0, 0, 1 / 2048, 1 / 1024) },
        uWakeOn: { value: 0 },
        // Sea life (sealife3d.js): how dark what swims under the surface makes the
        // water in red, blood in green, over (origin x, origin z, 1 / span, 1 / size).
        uLife: { value: null },
        uLifeRect: { value: new Three.Vector4(0, 0, 1 / 2048, 1 / 512) },
        uLifeOn: { value: 0 },
        // Rain on the sea: rings from the drops, the glitter dulled (weather.rain).
        uRain: { value: 0 },
        // Distance haze (flight-view3d.js) so open sea fades like the land does.
        ...Three.UniformsUtils.clone(Three.UniformsLib.fog),
      };
      const waterMaterial = new Three.ShaderMaterial({
        uniforms: waterUniforms,
        fog: true,
        extensions: { derivatives: true },
        vertexShader: `
          varying vec3 vWorld;
          varying vec3 vNormal;
          varying float vCrest;
          varying float vShore;
          varying float vBeach;
          #include <fog_pars_vertex>
          uniform float uTime;
          uniform sampler2D uShore;
          uniform float uWorldSize;
          uniform vec2 uWorldOrigin;
          uniform vec2 uWorldExtent;
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
            vec2 shoreUv = (p - uWorldOrigin) / uWorldExtent;
            vec4 shoreTexel = texture2D(uShore, shoreUv);
            // Beyond the edge of the field the clamped edge texel would be smeared out
            // to the horizon (turquoise shallows and foam streaks far out in the west
            // sea): add the distance past the edge so open water deepens as it should.
            float beyond = length(max(vec2(0.), max(-shoreUv, shoreUv - 1.)) * uWorldExtent);
            float shore = shoreTexel.r * uShoreScale + beyond;
            vBeach = shoreTexel.g * (1. - smoothstep(0., 160., beyond));
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
            vec4 mvPosition = viewMatrix * vec4(world, 1.);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec3 vWorld;
          varying vec3 vNormal;
          varying float vCrest;
          varying float vShore;
          varying float vBeach;
          uniform float uTime;
          uniform float uDay;
          uniform float uDusk;
          uniform vec3 uViewDir;
          uniform float uPerspective;
          uniform vec3 uSun;
          uniform sampler2D uWake;
          uniform vec4 uWakeRect;
          uniform float uWakeOn;
          uniform sampler2D uLife;
          uniform vec4 uLifeRect;
          uniform float uLifeOn;
          uniform float uRain;
          vec2 rainRings(vec2 p, float t, float cell){
            vec2 c = floor(p / cell), f = p / cell - c;
            float h = fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
            vec2 centre = vec2(fract(sin(dot(c + 3.1, vec2(127.1, 311.7))) * 43758.5453), fract(sin(dot(c + 7.7, vec2(127.1, 311.7))) * 43758.5453)) * 0.6 + 0.2;
            float life = fract(t * 1.3 + h);
            vec2 d = (f - centre) * cell;
            float dist = length(d);
            float w = dist - life * cell * 0.45;
            float slope = -6. * w * exp(-w * w * 3.) * (1. - life);
            return d / max(dist, 1e-3) * slope;
          }
          #include <fog_pars_fragment>
          #include <city_hdr_pars>
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
            // How much sea one pixel covers. Ripples a few units across cannot be
            // resolved from high up: left at full strength they flicker as white
            // sub-pixel glints all over the sea (shimmer). They fade with the
            // footprint and the sun's highlight widens instead (a rougher-looking
            // surface at a distance, as real water reads).
            float footprint = length(fwidth(vWorld.xz));
            float fine = 1. - smoothstep(1.2, 6.5, footprint);
            rippleScale *= mix(0.3, 1., fine);
            vec3 n = normalize(vNormal + vec3((h0 - hx) * 2.2, 0., (h0 - hz) * 2.2) * rippleScale);
            // Rain: rings from the drops wherever they land (only where they resolve).
            // Rings only where a unit spans a few pixels; any coarser and they alias.
            float ringsResolve = 1. - smoothstep(0.3, 0.8, footprint);
            if (uRain > 0.01 && ringsResolve > 0.01) {
              vec2 rr = rainRings(vWorld.xz, uTime, 9.) + rainRings(vWorld.xz + 4.3, uTime * 1.17 + 0.3, 7.);
              n = normalize(n + vec3(rr.x, 0., rr.y) * 0.35 * uRain * ringsResolve);
            }
            // Boat wakes (wakes3d.js): their waves tilt the surface so they catch the
            // sun and the sky like the swell does; their foam is mixed in below.
            float wakeFoam = 0.;
            if (uWakeOn > 0.5) {
              vec2 wuv = (vWorld.xz - uWakeRect.xy) * uWakeRect.z;
              float inMap = smoothstep(0., 0.03, min(min(wuv.x, wuv.y), min(1. - wuv.x, 1. - wuv.y)));
              if (inMap > 0.) {
                vec3 w0 = texture2D(uWake, wuv).rgb;
                vec3 wx = texture2D(uWake, wuv + vec2(uWakeRect.w, 0.)).rgb;
                vec3 wz = texture2D(uWake, wuv + vec2(0., uWakeRect.w)).rgb;
                float wh = w0.g - w0.b;
                n = normalize(n + vec3(wh - (wx.g - wx.b), 0., wh - (wz.g - wz.b)) * 1.6 * inMap);
                wakeFoam = clamp(w0.r, 0., 1.) * inMap;
              }
            }
            vec3 viewDir = normalize(mix(uViewDir, normalize(cameraPosition - vWorld), uPerspective));
            float facing = max(dot(viewDir, n), 0.);
            float fresnel = 0.04 + 0.96 * pow(1. - facing, 4.);
            // Regional palettes: turquoise Keys and county reefs, cold slate in Marlow Bay.
            float tropical = 1. - smoothstep(-1700., -300., vWorld.x) + smoothstep(5400., 6400., vWorld.z);
            tropical = clamp(tropical, 0., 1.);
            vec3 deep = mix(vec3(.018, .10, .19), vec3(.02, .26, .32), tropical);
            vec3 shallow = mix(vec3(.10, .40, .48), vec3(.22, .68, .66), tropical);
            float depthMix = 1. - smoothstep(0., 230., vShore + h0 * 30.);
            vec3 body = mix(deep, shallow, depthMix * depthMix);
            // Off a beach the sand bottom shows through the shallows: clear
            // turquoise over pale sand, darkening where it shelves away.
            float sandy = vBeach * (1. - smoothstep(8., 170., vShore + h0 * 24.));
            body = mix(body, vec3(.30, .62, .60), sandy * 0.7);
            body = mix(body, vec3(.58, .70, .60), vBeach * (1. - smoothstep(0., 50., vShore + h0 * 12.)) * 0.55);
            // Sea life under the surface (sealife3d.js): a dark shape in the body of
            // the water, softened by the swell's refraction; blood clouding it red.
            vec2 lifeSeen = vec2(0.);
            if (uLifeOn > 0.5) {
              vec2 luv = (vWorld.xz + (n.xz - vNormal.xz) * 3.0 - uLifeRect.xy) * uLifeRect.z;
              if (luv.x > 0. && luv.y > 0. && luv.x < 1. && luv.y < 1.) {
                vec2 l0 = texture2D(uLife, luv).rg;
                vec2 l1 = texture2D(uLife, luv + vec2(uLifeRect.w, 0.)).rg + texture2D(uLife, luv - vec2(uLifeRect.w, 0.)).rg
                        + texture2D(uLife, luv + vec2(0., uLifeRect.w)).rg + texture2D(uLife, luv - vec2(0., uLifeRect.w)).rg;
                lifeSeen = l0 * 0.6 + l1 * 0.1;
                body = mix(body, body * 0.1 + vec3(.003, .012, .018), clamp(lifeSeen.r, 0., 1.));
                body = mix(body, vec3(.30, .018, .02), clamp(lifeSeen.g * 1.3, 0., 0.92));
              }
            }
            // Sky reflection: night navy -> dusk amber horizon -> pale day sky.
            vec3 skyNight = vec3(.05, .08, .16);
            vec3 skyDay = vec3(.55, .70, .84);
            vec3 sky = mix(skyNight, skyDay, uDay);
            sky = mix(sky, vec3(.92, .55, .33), uDusk * 0.55);
            // Over a shape in the water the eye reads through the surface: less sky.
            float lifeShade = clamp(lifeSeen.r, 0., 1.);
            vec3 color = mix(body, sky, fresnel * 0.62 * (1. - 0.45 * lifeShade));
            // Wave-crest scattering lifts the color where the swell is tallest.
            color += shallow * 0.18 * clamp(vCrest, 0., 1.) * uDay;
            // Sun glitter: tight and broad specular lobes.
            vec3 reflected = reflect(-uSun, n);
            float spec = pow(max(dot(reflected, viewDir), 0.), mix(110., 320., fine)) * mix(0.4, 2.4, fine * fine)
                       + pow(max(dot(reflected, viewDir), 0.), 28.) * 0.22;
            vec3 sunColor = mix(vec3(1., .96, .86), vec3(1., .62, .34), uDusk);
            color += sunColor * spec * (0.25 + 1.1 * uDay) * (1. - uRain * 0.75) * (1. - 0.55 * lifeShade);
            // A shower greys the sea and roughens it into a pale sheen.
            color = mix(color, color * 0.82 + sky * 0.1, uRain * 0.5);
            // Moon path and shoreline light spill at night.
            float sparkle = smoothstep(0.78, 0.92, vnoise(vWorld.xz * 0.9 + uTime * 0.6)) * fine;
            color += vec3(.75, .82, 1.) * sparkle * 0.08 * (1. - uDay) * (0.3 + fresnel);
            color += vec3(1., .78, .5) * sparkle * 0.14 * (1. - uDay) * (1. - smoothstep(0., 360., vShore));
            // Foam: breaking edge, retreating wash and crest whitecaps.
            float washPhase = fract(vShore * 0.022 - uTime * 0.26 + h0 * 0.4);
            // Rolling wash lines belong on a beach; off a sea wall or a quay they read
            // as rings of foam drawn round the whole island, so there only a trace.
            float wash = smoothstep(0.78, 1., washPhase) * (1. - smoothstep(24., 120., vShore)) * mix(0.22, 1., clamp(vBeach * 2., 0., 1.));
            float edge = 1. - smoothstep(0., 22. + h0 * 14., vShore);
            float caps = smoothstep(0.58, 0.95, vCrest * (0.65 + h0 * 0.7)) * smoothstep(40., 160., vShore);
            // Breakers rolling in on a beach: lines of white water parallel to the
            // shore, broken along their length, each trailing a fading wake of foam.
            float bp = fract(vShore * 0.0125 - uTime * 0.137 + vnoise(vWorld.xz * 0.004) * 0.6);
            float surfZone = vBeach * smoothstep(22., 60., vShore) * (1. - smoothstep(160., 270., vShore));
            float broken = smoothstep(0.3, 0.75, vnoise(vec2(vWorld.x * 0.028 + vWorld.z * 0.011, bp * 2.5)));
            float breaker = smoothstep(0.86, 0.96, bp) * (1. - smoothstep(0.965, 1., bp)) * surfZone * (0.3 + 0.7 * broken);
            float trail = smoothstep(0.5, 0.96, bp) * (1. - smoothstep(0.965, 1., bp)) * surfZone * 0.35
                        * vnoise(vWorld.xz * 0.18 + vec2(uTime * 0.2, -uTime * 0.25));
            float foam = clamp(edge * 0.9 + wash * 0.65 + caps * 0.4 + breaker * 0.9 + trail, 0., 1.);
            foam *= 0.55 + 0.45 * vnoise(vWorld.xz * 0.35 + uTime * 0.4);
            color = mix(color, vec3(.86, .93, .92), foam);
            // Wake: aerated water turns pale green-blue under the foam, then the foam.
            color = mix(color, color * 0.55 + vec3(.12, .26, .27), smoothstep(0., 0.35, wakeFoam) * 0.3);
            color = mix(color, vec3(.88, .94, .94), smoothstep(0.05, 0.9, wakeFoam) * 0.92);
            // Blood reaches the surface too: pink foam, a red slick over the glitter.
            color = mix(color, color * vec3(.9, .35, .33) + vec3(.16, 0., 0.), clamp(lifeSeen.g, 0., 1.) * 0.75);
            color *= 0.3 + 0.7 * uDay;
            gl_FragColor = vec4(color, 1.);
            #include <fog_fragment>
            #include <city_hdr_output>
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
      /**
       * SHORELINE
       * The wash, the breaking band and the wet-sand darkening are all produced by
       * the water shader from its distance-to-shore field, so the shore carries no
       * overlay planes. An earlier pass laid flat foam and shallow quads a few
       * units under the surface; because they were fixed while the water is
       * displaced by four Gerstner swells, they surfaced through the waves as pale
       * rectangles. They are gone. What remains here is real build: the concrete
       * quay edge, its coping, mooring bollards and a sand bank along the beaches.
       */
      for (const e of coastSegments()) {
        if (e.opening) continue;
        // Palm Keys Beach's waterline is drawn by beach3d.js (sand, wet sand, swash).
        if (beachShore(e)) continue;
        const group = new Three.Group(),
          style = shoreStyle(e),
          { nx, ny } = shoreNormal(e);
        group.position.set(e.x, 0, e.y);
        group.rotation.y = -e.a;
        scene.add(group);
        batchGroups.push(group);
        const outward = -Math.sin(e.a) * nx + Math.cos(e.a) * ny;
        if (style === 'quay') {
          box(group, 0, 2.3, 0, e.length + 1, 5, 5, staticMat('#727e80'));
          box(group, 0, 5.2, 0, e.length + 1, 0.9, 7, concrete);
          box(group, 0, 0.6, outward * 3.4, e.length + 1, 4, 2.2, staticMat('#5d6668', 0.95));
          if (Math.round(e.x + e.y) % 3 === 0) {
            mesh(cylinderGeo, darkMetal, group, 0, 6.6, -outward * 1.4, 1.5, 3.4, 1.5);
            mesh(sphereGeo, darkMetal, group, 0, 8.3, -outward * 1.4, 1.9, 1.1, 1.9);
          }
        } else if (RUNWAY_PIERS.some((p) => p.id === e.region)) {
          // A runway pier's rock armour: a sloping band of grey armour stone into
          // the water under a concrete coping.
          box(group, 0, 0.5, 0, e.length + 1, 1.6, 4, concrete);
          box(group, 0, -0.6, outward * 5, e.length + 1, 3.2, 7, staticMat('#6f6d66', 0.97));
          box(group, 0, -2.2, outward * 10, e.length + 2, 3, 6, staticMat('#5c5a54', 0.98));
          for (let k = -1; k <= 1; k++)
            if ((Math.round(e.x * 0.7 + e.y * 1.3) + k) % 2 === 0)
              box(group, k * e.length * 0.3, -0.2, outward * (6 + k), e.length * 0.28, 2.4, 3.2, staticMat('#7b786f', 0.96));
        } else {
          // A low sand bank so the beach meets the water with a lip, not an edge.
          box(group, 0, 0.45, -outward * 5, e.length + 1, 1.2, 12, staticMat('#c8b68e', 0.97));
          box(group, 0, 0.18, -outward * 13, e.length + 1, 0.9, 10, staticMat('#b8a884', 0.97));
        }
        statics.push({
          x: e.x,
          y: e.y,
          group,
          radius: 90,
        });
      }
      /**
       * STREET ENDS
       * Every grid road stops where the land does. A road that simply stops is a
       * bug; a road that stops at a kerbed turning head with a guardrail, a pair
       * of chevron boards and a NO THROUGH ROAD plate is a street. Ends on a
       * bridge or a boulevard are junctions, not ends, and are skipped.
       */
      function buildStreetEnds() {
        const railMat = staticMat('#cfd3cd', 0.7),
          chevron = staticMat('#e9e3d0', 0.75),
          stripe = staticMat('#c14c3c', 0.7),
          kerb = staticMat('#a9a89b', 0.92);
        // One plate texture shared by every end: a canvas per sign would cost
        // more memory than the rest of the street furniture put together.
        const plate = document.createElement('canvas');
        plate.width = 512;
        plate.height = 128;
        const pg = plate.getContext('2d');
        pg.fillStyle = '#e9e3d0';
        pg.fillRect(0, 0, 512, 128);
        pg.strokeStyle = '#b23c33';
        pg.lineWidth = 10;
        pg.strokeRect(10, 10, 492, 108);
        pg.fillStyle = '#20262a';
        pg.font = '700 46px Arial';
        pg.textAlign = 'center';
        pg.textBaseline = 'middle';
        pg.fillText('NO THROUGH ROAD', 256, 66, 460);
        const plateTexture = new Three.CanvasTexture(plate);
        plateTexture.colorSpace = Three.SRGBColorSpace;
        const plateMaterial = new Three.MeshBasicMaterial({
          map: plateTexture,
          side: Three.DoubleSide,
          toneMapped: false,
        });
        const plateGeometry = new Three.PlaneGeometry(34, 8.5);
        // Where each piece stands comes from streetEndPlan() (streets.js), which
        // also gives the pieces their colliders, so a rail you see is a rail that
        // stops you. Local frame: +x out past the end, z across the street.
        for (const end of streetEndPlan()) {
          const { p, a, width } = end,
            half = width / 2,
            group = new Three.Group();
          group.position.set(p.x, terrainHeight(p.x, p.y), p.y);
          group.rotation.y = -a;
          scene.add(group);
          batchGroups.push(group);
          statics.push({ x: p.x, y: p.y, group, radius: 120 });
          if (end.kind === 'gate') {
            // Gate piers either side of the forecourt with a length of railing
            // running back from each pier along the edge of the footway.
            const pier = staticMat('#a8a396', 0.9),
              gateIron = staticMat('#3f4744', 0.5, 0.5),
              g = STREET_END_GATE;
            for (const side of [-1, 1]) {
              const z = side * (half + g.offset);
              box(group, g.pierX, 13, z, g.pier, 26, g.pier, pier);
              box(group, g.pierX, 27.5, z, g.pier + 3, 3, g.pier + 3, pier);
              const length = g.railTo - g.railFrom,
                mid = (g.railFrom + g.railTo) / 2;
              box(group, mid, 8, z, length, 1.8, 1.8, gateIron);
              box(group, mid, 4, z, length, 1.4, 1.4, gateIron);
              for (let d = g.railFrom + 1; d < g.railTo; d += 16) box(group, d, 6, z, 1.6, 12, 1.6, gateIron);
              box(group, g.pierX, 32, z, 2.4, 10, 2.4, gateIron);
            }
            continue;
          }
          // A closed end: the carriageway stops square at a kerb, a guardrail
          // with chevron boards spans it, and the footways carry on round it.
          const g = STREET_END_RAIL;
          box(group, 0.2, 1.4, 0, 3, 2.8, width, kerb);
          for (let i = 0; i <= 6; i++) box(group, g.x, 7, -half + (i * width) / 6, 3.4, 14, 3.4, railMat);
          box(group, g.x, 12, 0, 3, 3.6, width + 4, railMat);
          box(group, g.x, 6.4, 0, 3, 3, width + 4, railMat);
          // Chevron boards facing the road, red and white.
          for (const side of [-1, 1]) {
            const z = side * (width * 0.24);
            box(group, g.x - 2.6, 9.5, z, 1.6, 13, 26, chevron);
            for (let k = -2; k <= 2; k++) box(group, g.x - 3.4, 9.5, z + k * 5.2, 0.8, 13, 2.6, stripe);
          }
          // NO THROUGH ROAD plate on a post at the kerb, a car length before the end.
          box(group, g.plateX, 11, -half - g.plateZ, 1.8, 22, 1.8, railMat);
          const boardMesh = new Three.Mesh(plateGeometry, plateMaterial);
          boardMesh.position.set(g.plateX, 22, -half - g.plateZ);
          boardMesh.rotation.y = -Math.PI / 2;
          boardMesh.userData.sign = true;
          group.add(boardMesh);
        }
      }
      buildStreetEnds();
      /**
       * ESPLANADE
       * Railing bays, lamp standards, benches and planters along the whole
       * waterfront, built from the shared promenadeSpots() list so the people
       * strolling it walk exactly where the furniture is.
       */
      function buildPromenade() {
        const railMetal = staticMat('#b9bcb4', 0.4, 0.55),
          walkStone = staticMat('#b7b4a6', 0.9),
          seatWood = staticMat('#9c7b52', 0.85),
          lampPost = staticMat('#42484a', 0.6, 0.35),
          lampGlass = new Three.MeshBasicMaterial({ color: '#ffe9bd' }),
          planter = staticMat('#8c8779', 0.9),
          planterTrunk = staticMat('#6b5442'),
          planterGeo = new Three.CylinderGeometry(9, 9.6, 3, 12);
        let group = null,
          groupAt = null,
          count = 0;
        for (const spot of promenadeSpots()) {
          // Batch the furniture in runs so a mile of railing is a handful of meshes.
          if (!group || Math.hypot(spot.x - groupAt.x, spot.y - groupAt.y) > 420 || count > 40) {
            group = new Three.Group();
            scene.add(group);
            batchGroups.push(group);
            statics.push({ x: spot.x, y: spot.y, group, radius: 560 });
            groupAt = spot;
            count = 0;
          }
          count++;
          // Local +z points out to sea whichever way the coast polygon is wound
          // (the coast heading alone put the railing on the landward edge of the
          // walk on every Northbank and Palm Keys quay, beside the road).
          const inner = new Three.Group();
          inner.position.set(spot.x, terrainHeight(spot.x, spot.y), spot.y);
          inner.rotation.y = -promenadeYaw(spot);
          group.add(inner);
          // A breakable piece (damage.js) is modelled in its own throwaway group
          // placed like `inner` and drawn as instances (render3d.js BREAKABLE SCENERY).
          const yaw = promenadeYaw(spot),
            at = (lx, lz) => [spot.x + lx * Math.cos(yaw) - lz * Math.sin(yaw), spot.y + lx * Math.sin(yaw) + lz * Math.cos(yaw)],
            piece = () => {
              const g = new Three.Group();
              g.position.copy(inner.position);
              g.rotation.y = inner.rotation.y;
              return g;
            };
          if (!spot.beach) {
            // Sea railing on the quay coping, carried straight across a street
            // mouth; it breaks for ladders and gangways (promenadeRailRuns). Each
            // run is a breakable railing: a pedestrian rail does not stop a car,
            // and where one is broken the quay edge is open (promenadeRailBlocked).
            spot.railProps = [];
            for (const run of spot.rail) {
              const length = run[1] - run[0],
                mid = (run[0] + run[1]) / 2;
              if (length < 2) {
                spot.railProps.push(null);
                continue;
              }
              box(inner, mid, 1.2, ESPLANADE_RAIL_Z, length, 2.4, 3, walkStone);
              const g = piece(),
                prop = registerStreetProp('railing', ...at(mid, ESPLANADE_RAIL_Z), -yaw, { half: [length / 2, 1.5] });
              for (const u of [run[0] + 1, run[1] - 1]) box(g, u, 6, ESPLANADE_RAIL_Z, 2, 12, 2, railMetal);
              box(g, mid, 11, ESPLANADE_RAIL_Z, length, 1.8, 1.8, railMetal);
              box(g, mid, 6.5, ESPLANADE_RAIL_Z, length, 1.4, 1.4, railMetal);
              breakableGroup(prop, g);
              spot.railProps.push(prop);
            }
          }
          if (spot.crossing) continue;
          // Lamp standards, benches and planters are breakable props; standing,
          // they are also what stops people on foot (footObstacleBlocked). A piece
          // whose place falls in the mouth of a street (the spot itself is just
          // clear of it) is left out.
          const pieceAt = spot.kind === 'lamp' ? at(0, 14) : spot.kind === 'bench' ? at(0, 5) : at(0, -22);
          if (spot.kind !== 'rail' && cityStreetAt(pieceAt[0], pieceAt[1], 4)) continue;
          if (spot.kind === 'lamp') {
            const g = piece(),
              prop = registerStreetProp('lantern', ...at(0, 14), -yaw, { half: [3, 3] });
            box(g, 0, 15, 14, 2.6, 30, 2.6, lampPost);
            box(g, 0, 2, 14, 7, 4, 7, lampPost);
            mesh(sphereGeo, lampGlass, g, 0, 32, 14, 3.4, 4.2, 3.4);
            breakableGroup(prop, g);
          } else if (spot.kind === 'bench') {
            const g = piece(),
              prop = registerStreetProp('seat', ...at(0, 5), -yaw, { half: [10, 3.5] });
            box(g, 0, 4.4, 6, 20, 1.6, 6, seatWood);
            box(g, 0, 7.6, 3.6, 20, 5.4, 1.4, seatWood);
            for (const side of [-1, 1]) box(g, side * 8, 2, 6, 1.4, 4.4, 5.4, lampPost);
            breakableGroup(prop, g);
          } else if (spot.kind === 'tree') {
            const g = piece(),
              prop = registerStreetProp('planter', ...at(0, -22), -yaw, { half: [9, 9], size: 11 });
            mesh(planterGeo, planter, g, 0, 1.5, -22);
            rod(g, new Three.Vector3(0, 3, -22), new Three.Vector3(0, 17, -22), 1.3, planterTrunk);
            mesh(sphereGeo, leafMats[0], g, 0, 22, -22, 11, 9, 11);
            breakableGroup(prop, g);
          }
        }
      }
      buildPromenade();
      // A palm of the species library (vegetation3d.js plantPalm): the species by
      // place (fan palms down Ocean Drive, coconuts on the beach...). A palm is a
      // breakable prop (damage.js) drawn as instances (render3d.js BREAKABLE
      // SCENERY): it snaps and falls when a vehicle brings enough energy. Returns
      // the prop.
      function makePalm(x, z, size = 1, species = null) {
        return plantPalm(x, z, size, species);
      }
      // The keys trade brick canyons for pastel hotels, pools, palms and beach
      // furniture. Palms line both kerbs of Ocean Dr (x -2432) on the sea side.
      for (const p of oceanDrivePalms()) makePalm(p.x, p.y, p.size);
      const resortColors = ['#e3b7a6', '#a7cbc5', '#d8cba8', '#aebbd8'];
      for (const b of buildings.filter((b) => b.tropical && !b.place && !b.roofBar)) {
        const group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        const co = mat(resortColors[Math.floor(b.y / 200) % 4]);
        // A balcony slab and its glass rail at every storey (game.js STOREY).
        for (let y = SHOP_FLOOR; y < b.height; y += STOREY) {
          box(group, b.x + b.w / 2, y, b.y + b.h + 3, b.w - 12, 1.1, 7, co);
          box(group, b.x + b.w / 2, y + 4.4, b.y + b.h + 6, b.w - 14, 7.6, 0.6, glass);
        }
        for (const x of [b.x + 10, b.x + b.w - 10])
          box(group, x, b.height / 2, b.y + b.h + 3, 3, b.height, 5, co);
        if (b.w > 220) {
          const px = b.x + b.w / 2,
            pz = b.y + b.h + 47;
          box(group, px, 0.18, pz, 99, 0.35, 40, staticMat('#c9c1a7'));
          box(group, px, 0.4, pz, 86, 0.4, 29, staticMat('#65b8b7', 0.15, 0.3));
          for (const side of [-1, 1])
            for (let j = -1; j <= 1; j++)
              box(group, px + j * 29, 1.8, pz + side * 25, 15, 2, 5, staticMat('#d1ddd4'));
        }
        statics.push({
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          group,
          radius: 230,
        });
      }
      // Beach umbrellas on Ocean Drive's strand.
      for (let z = 1100; z < 4200; z += 180) {
        const x = z < 2600 ? -2584 : -2574;
        if (!landAt(x, z)) continue;
        const group = new Three.Group();
        scene.add(group);
        batchGroups.push(group);
        box(group, x, 9, z, 0.8, 18, 0.8, wood);
        mesh(new Three.ConeGeometry(12, 5, 10), mat(z % 360 ? '#dca48f' : '#92bbbd'), group, x, 18, z);
        for (const side of [-1, 1]) {
          box(group, x + side * 13, 1.4, z + 10, 5, 2, 15, staticMat('#e5dac6'));
        }
        statics.push({
          x,
          y: z,
          group,
          radius: 30,
        });
      }
      // No district or street name boards over the carriageway (OCEAN DRIVE,
      // PALM KEYS and NORTHBANK used to hang over Ocean Dr and both ends of the
      // Keys Bridge): district names belong to the HUD and the map.
      // A terminal, gate arms, control tower, service equipment and parked aircraft.
      const ag = new Three.Group();
      scene.add(ag);
      batchGroups.push(ag);
      const terminalGlass = staticMat('#446875', 0.16, 0.55),
        airWhite = staticMat('#d8dfdc', 0.36, 0.3);
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
      // Southport is a GA strip (airfields.js): light aircraft on its apron
      // (AIRPORT_SCENERY_SOLIDS). The runway, its lights and markings are
      // airfields3d.js.
      for (const [x, z, a, color, accent] of [
        [800, 4650, 0, '#e8e2d2', '#8a3b46'],
        [800, 4930, 0, '#dfe6ea', '#2c6f8e'],
        [1000, 5420, Math.PI / 2, '#ece4c8', '#3d6b4a'],
      ]) {
        const group = new Three.Group();
        group.position.set(x, 0, z);
        group.rotation.y = a;
        ag.add(group);
        buildAircraft('courier', group, { color, accent });
      }
      for (let x = 840; x < 1070; x += 30) box(ag, x, 3, 5140, 21, 6, 12, staticMat('#91836d'));
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
        deckMat = staticMat('#a4917d'),
        ivory = staticMat('#e4d8bd'),
        navy = staticMat('#264354'),
        brass = staticMat('#bd9960', 0.35, 0.65),
        cushion = staticMat('#e5dbce'),
        poolMat = new Three.MeshStandardMaterial({
          color: '#48aeb7',
          roughness: 0.17,
          metalness: 0.35,
          emissive: '#15515a',
          emissiveIntensity: 0.25,
        }),
        wine = staticMat('#812e45', 0.25),
        bottleMats = [staticMat('#527e68', 0.22), staticMat('#b89463', 0.23), staticMat('#7796a2', 0.22)];
      box(roofGroup, rw / 2, 1.3, rh / 2, rw - 8, 2.6, rh - 8, deckMat);
      for (let z = 12; z < rh - 12; z += 12)
        box(roofGroup, rw / 2, 2.65, z, rw - 24, 0.08, 0.4, staticMat('#796954'));
      box(roofGroup, 84, 2.75, 161, 140, 0.12, 96, staticMat('#aa826a'));
      box(roofGroup, 285, 2.75, 122, 98, 0.12, 123, staticMat('#516574'));
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
            box(roofGroup, x + i * 29, 4.11, z, 1, 0.06, p.h - 13, staticMat('#94d9d7'));
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
              stillLeafMat,
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
            leaf = box(roofGroup, x + Math.cos(a) * 7, 38, z + Math.sin(a) * 7, 15, 1.4, 3, stillLeafMat);
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
        updateBeachVisuals();
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
        waterUniforms.uRain.value = weather.rain;
        waterUniforms.uTime.value = gameTime;
        waterUniforms.uDay.value = 0.12 + 0.88 * light;
        waterUniforms.uDusk.value = clamp(1 - Math.abs(light - 0.3) / 0.28, 0, 1);
        camera.getWorldDirection(waterUniforms.uViewDir.value).multiplyScalar(-1);
        waterUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
        // The swell mesh follows the middle of the view and grows to cover what
        // the camera can see, which from the air is far more than the street view.
        const waterScale = Math.max(1, 1 / viewZoom / 2, (viewReach * 2.2) / 7000);
        waterSurface.scale.set(waterScale, waterScale, 1);
        waterSurface.position.x = Math.round(viewCenter.x / 25) * 25;
        waterSurface.position.z = Math.round(viewCenter.y / 25) * 25;
        farWater.material.color
          .set('#061421')
          .lerp(new Three.Color(cameraTarget.x < -600 ? '#0c5a68' : '#0f3a52'), light);
      }

      const rescueBuoy = new Three.Group();
      rescueBuoy.position.set(LOC.waterCase.x, 0, LOC.waterCase.y);
      scene.add(rescueBuoy);
      mesh(cylinderGeo, staticMat('#cfa74c'), rescueBuoy, 0, 1, 0, 8, 5, 8);
      box(rescueBuoy, 0, 11, 0, 1, 20, 1, chrome);
      box(rescueBuoy, 0, 19, 0, 9, 7, 1, staticMat('#e0c56e'));
      halo(rescueBuoy, 0, 23, 0, 10, '#efd197');
      box(rescueBuoy, 8, 3, 1, 8, 5, 6, staticMat('#353f43'));
      statics.push({
        x: LOC.waterCase.x,
        y: LOC.waterCase.y,
        group: rescueBuoy,
        radius: 28,
      });
      // END SUBSYSTEM: src/world3d.js
