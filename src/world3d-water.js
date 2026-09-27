      // Water: the distance-to-shore field, the one water shader (bay, river, ocean, reservoir) and its surfaces.
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
