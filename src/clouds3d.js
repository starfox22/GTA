      // BEGIN SUBSYSTEM: src/clouds3d.js — Volumetric clouds and cloud shadows
      /**
       * Volumetric clouds and cloud shadows
       * Source: src/clouds3d.js
       * Scope: createCityRenderer() closure (included after weather3d.js).
       * A cumulus layer high above the city (600-950 m), ray-marched through 3D noise
       * and lit by the sun, and the shadows those same clouds throw on the streets.
       *
       * The layer only exists where it would in life: well above the rooftops. From the
       * street you never see it, only its shadows drifting over the city and the light
       * dimming as one crosses you. You first meet it from an aircraft: wisps slide past
       * as you climb towards the base, you fly through the gaps (or into the murk under
       * an overcast), and above the tops you look down on sunlit cloud with the city
       * showing through the breaks.
       *
       * How it is drawn (WebGL2 only; on WebGL1 the sky simply stays clear):
       *   1. Once, at start-up, a 64^3 tiling noise volume (Perlin-Worley shape plus
       *      Worley detail) is rendered on the GPU into a 3D texture.
       *   2. A coverage map (128^2, CPU, histogram-equalised so `coverage` really is the
       *      fraction of sky with cloud in it) says where clouds may form; weather.cloud
       *      sets the coverage and the wind carries the whole field.
       *   3. Each frame the flight camera is above the cloud base, a full-screen pass at
       *      half resolution marches every view ray through the slab: Beer-Lambert
       *      extinction, a short march towards the sun for self-shadowing, a two-lobe
       *      phase function, sky and ground ambient, city glow under the base at night,
       *      and the scene's distance haze. It writes premultiplied colour + coverage.
       *      Cloud is also thinned in a pocket around the aircraft, so flying inside
       *      the layer shows walls of cloud and the ground below, not a white-out.
       *   4. That image is composited behind the player's aircraft: a camera-facing
       *      quad at the aircraft's depth, so the aircraft always draws over the cloud
       *      beyond it, while cloud between the camera and the aircraft is cut away
       *      (a chase camera must never lose its subject in the murk, and a veil over
       *      the whole frame is exactly the milky look this replaced).
       *   5. A second quad writes depth where the cloud is thick, so transparent effects
       *      on the ground below do not shine through it.
       * Cloud shadows are a plane just above the tallest roof that, for every pixel,
       * follows the view ray down to the ground and samples the same density field
       * along the sun direction. Everything under it (streets, cars, people, low
       * aircraft) darkens together.
       */
      const CLOUD_BASE = 3072, // 600 m
        CLOUD_TOP = 4864, // 950 m at the tallest towers
        CLOUD_MAP_SPAN = 9000, // world units per tile of the coverage map
        CLOUD_SHAPE_SCALE = 2200, // world units per tile of the noise volume (shapes)
        CLOUD_DETAIL_SCALE = 460, // ... and for the eroding detail
        CLOUD_NOISE_SIZE = 64,
        CLOUD_POCKET_INNER = 160, // clear air around the aircraft (world units)...
        CLOUD_POCKET_OUTER = 520, // ...thickening to full cloud by here
        cloudsMobile = touchEnabled(),
        cloudsSupported = !!renderer.capabilities.isWebGL2;
      const SUN_DIRECTION = new Three.Vector3(-620, 980, -340).normalize();
      // ---- Coverage map ----------------------------------------------------------------
      const CLOUD_MAP_SIZE = 128,
        cloudMap = new Float32Array(CLOUD_MAP_SIZE * CLOUD_MAP_SIZE);
      {
        let seed = 19970611;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
        // Tiling value noise, four octaves, quintic interpolation.
        for (const [cells, weight] of [
          [4, 1],
          [8, 0.5],
          [16, 0.26],
          [32, 0.12],
        ]) {
          const lattice = Array.from({ length: cells * cells }, rnd);
          for (let y = 0; y < CLOUD_MAP_SIZE; y++)
            for (let x = 0; x < CLOUD_MAP_SIZE; x++) {
              const fx = (x / CLOUD_MAP_SIZE) * cells,
                fy = (y / CLOUD_MAP_SIZE) * cells,
                ix = Math.floor(fx),
                iy = Math.floor(fy),
                ease = (t) => t * t * t * (t * (t * 6 - 15) + 10),
                u = ease(fx - ix),
                v = ease(fy - iy),
                at = (i, j) => lattice[((j + cells) % cells) * cells + ((i + cells) % cells)],
                top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * u,
                bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * u;
              cloudMap[y * CLOUD_MAP_SIZE + x] += (top + (bottom - top) * v) * weight;
            }
        }
        // Histogram-equalise: rank order becomes value, so a coverage of 0.3 puts cloud
        // over 30% of the map whatever the noise statistics were.
        const order = Array.from(cloudMap.keys()).sort((a, b) => cloudMap[a] - cloudMap[b]);
        order.forEach((index, rank) => (cloudMap[index] = rank / (order.length - 1)));
      }
      const cloudMapTexture = (() => {
        const bytes = new Uint8Array(CLOUD_MAP_SIZE * CLOUD_MAP_SIZE * 4);
        for (let i = 0; i < cloudMap.length; i++) bytes[i * 4] = bytes[i * 4 + 1] = bytes[i * 4 + 2] = bytes[i * 4 + 3] = Math.round(cloudMap[i] * 255);
        const tx = new Three.DataTexture(bytes, CLOUD_MAP_SIZE, CLOUD_MAP_SIZE, Three.RGBAFormat);
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.magFilter = tx.minFilter = Three.LinearFilter;
        tx.needsUpdate = true;
        return tx;
      })();
      // Bilinear read of the coverage map, for the CPU side (sun dimming).
      function cloudMapAt(x, z) {
        const fx = (((x / CLOUD_MAP_SPAN) % 1) + 1) % 1 * CLOUD_MAP_SIZE - 0.5,
          fz = (((z / CLOUD_MAP_SPAN) % 1) + 1) % 1 * CLOUD_MAP_SIZE - 0.5,
          ix = Math.floor(fx),
          iz = Math.floor(fz),
          u = fx - ix,
          v = fz - iz,
          at = (i, j) =>
            cloudMap[(((j % CLOUD_MAP_SIZE) + CLOUD_MAP_SIZE) % CLOUD_MAP_SIZE) * CLOUD_MAP_SIZE + (((i % CLOUD_MAP_SIZE) + CLOUD_MAP_SIZE) % CLOUD_MAP_SIZE)],
          top = at(ix, iz) + (at(ix + 1, iz) - at(ix, iz)) * u,
          bottom = at(ix, iz + 1) + (at(ix + 1, iz + 1) - at(ix, iz + 1)) * u;
        return top + (bottom - top) * v;
      }
      // ---- Noise volume (GPU, once) -----------------------------------------------------
      const cloudNoise = cloudsSupported
        ? new Three.WebGL3DRenderTarget(CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, {
            depthBuffer: false,
            generateMipmaps: false,
          })
        : null;
      const fullScreenCamera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        fullScreenGeometry = new Three.PlaneGeometry(2, 2);
      if (cloudNoise) {
        const t = cloudNoise.texture;
        t.wrapS = t.wrapT = t.wrapR = Three.RepeatWrapping;
        t.magFilter = t.minFilter = Three.LinearFilter;
        const generator = new Three.ShaderMaterial({
          uniforms: { uZ: { value: 0 } },
          vertexShader: `
            varying vec2 vUv;
            void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
          fragmentShader: `
            precision highp float;
            uniform float uZ;
            varying vec2 vUv;
            // Integer hash (Hoskins): lattice cell -> three values in [0, 1).
            vec3 hash33(vec3 p){
              uvec3 q = uvec3(ivec3(p)) * uvec3(1597334673u, 3812015801u, 2798796415u);
              q = (q.x ^ q.y ^ q.z) * uvec3(1597334673u, 3812015801u, 2798796415u);
              return vec3(q) * (1.0 / 4294967295.0);
            }
            // Tiling Worley: 1 at feature points, falling to 0 a cell away ("billows").
            float worley(vec3 p, float cells){
              vec3 cell = floor(p * cells), f = p * cells - cell;
              float best = 1.;
              for (int x = -1; x <= 1; x++)
                for (int y = -1; y <= 1; y++)
                  for (int z = -1; z <= 1; z++){
                    vec3 o = vec3(x, y, z);
                    vec3 d = o + hash33(mod(cell + o, cells)) - f;
                    best = min(best, dot(d, d));
                  }
              return 1. - sqrt(best);
            }
            // Tiling gradient (Perlin) noise in about [-1, 1].
            float gradient(vec3 p, float cells){
              vec3 i = floor(p * cells), f = p * cells - i;
              vec3 u = f * f * f * (f * (f * 6. - 15.) + 10.);
              float n[8];
              for (int k = 0; k < 8; k++){
                vec3 c = vec3(k & 1, (k >> 1) & 1, (k >> 2) & 1);
                vec3 g = normalize(hash33(mod(i + c, cells)) * 2. - 1. + 1e-4);
                n[k] = dot(g, f - c);
              }
              return mix(mix(mix(n[0], n[1], u.x), mix(n[2], n[3], u.x), u.y),
                         mix(mix(n[4], n[5], u.x), mix(n[6], n[7], u.x), u.y), u.z);
            }
            float worleyFbm(vec3 p, float cells){
              return worley(p, cells) * .625 + worley(p, cells * 2.) * .25 + worley(p, cells * 4.) * .125;
            }
            void main(){
              vec3 p = vec3(vUv, uZ);
              float perlin = gradient(p, 4.) + gradient(p, 8.) * .5 + gradient(p, 16.) * .25;
              perlin = clamp(perlin * .5 + .5, 0., 1.);
              float cells = worleyFbm(p, 4.);
              // Perlin-Worley: Perlin's connected shapes with Worley's round billows.
              float shape = clamp((perlin - (cells - 1.)) / (1. - (cells - 1.)), 0., 1.);
              gl_FragColor = vec4(shape, worleyFbm(p, 8.), cells, perlin);
            }`,
        });
        const quad = new Three.Mesh(fullScreenGeometry, generator),
          noiseScene = new Three.Scene();
        quad.frustumCulled = false;
        noiseScene.add(quad);
        for (let z = 0; z < CLOUD_NOISE_SIZE; z++) {
          generator.uniforms.uZ.value = (z + 0.5) / CLOUD_NOISE_SIZE;
          renderer.setRenderTarget(cloudNoise, z);
          renderer.render(noiseScene, fullScreenCamera);
        }
        renderer.setRenderTarget(null);
        generator.dispose();
      }
      // ---- Shared density field (GLSL) ---------------------------------------------------
      // Everything that needs "how much cloud is here" uses this one function, so the
      // clouds you fly through and the shadows on the street always agree.
      const CLOUD_FIELD_GLSL = `
        precision highp sampler3D;
        uniform sampler3D uNoise;
        uniform sampler2D uCoverageMap;
        uniform vec2 uWind;
        uniform float uCoverage, uBase, uTop, uTime;
        float cloudRemap(float v, float a, float b, float c, float d){ return c + (v - a) / (b - a) * (d - c); }
        // Coverage in [0, 1] at a map point: where cloud may form, and how tall it grows.
        float cloudCoverage(vec2 xz){
          float m = texture2D(uCoverageMap, (xz + uWind) / ${CLOUD_MAP_SPAN.toFixed(1)}).r;
          return smoothstep(1. - uCoverage, 1. - uCoverage + 0.28, m);
        }
        float cloudDensity(vec3 p, bool detailed){
          float h = (p.y - uBase) / (uTop - uBase);
          if (h <= 0. || h >= 1.) return 0.;
          float cover = cloudCoverage(p.xz);
          if (cover <= 0.001) return 0.;
          // Cumulus profile: a firm, flat base and a domed top whose height grows with
          // coverage, so thin cover is fair-weather puffs and heavy cover towers.
          float top = mix(0.36, 1.0, cover);
          float profile = smoothstep(0., 0.07, h) * (1. - smoothstep(top * 0.35, top, h));
          vec3 q = vec3(p.x + uWind.x, p.y, p.z + uWind.y);
          vec4 n = texture(uNoise, q / ${CLOUD_SHAPE_SCALE.toFixed(1)});
          float shape = n.r * 0.75 + n.b * 0.25;
          // The noise must clear a threshold that rises towards the edge of the
          // coverage and towards the top, which carves separate, domed cells.
          float cut = 1. - cover * profile * 0.94;
          float d = clamp((shape - cut) / max(1. - cut, 0.06), 0., 1.);
          if (detailed && d > 0.){
            // Erode the edges with finer billows: ragged wisps at the base, cauliflower
            // tops above.
            vec4 fine = texture(uNoise, q / ${CLOUD_DETAIL_SCALE.toFixed(1)} + vec3(uTime * 0.003, uTime * 0.006, 0.));
            float erode = mix(1. - fine.g, fine.g, clamp(h * 3., 0., 1.));
            d = clamp((d - erode * 0.38) / (1. - erode * 0.38), 0., 1.);
          }
          return d;
        }`;
      function cloudFieldUniforms() {
        return {
          uNoise: { value: cloudNoise ? cloudNoise.texture : null },
          uCoverageMap: { value: cloudMapTexture },
          uWind: { value: new Three.Vector2() },
          uCoverage: { value: 0 },
          uBase: { value: CLOUD_BASE },
          uTop: { value: CLOUD_TOP },
          uTime: { value: 0 },
        };
      }
      // ---- Ray-march pass ----------------------------------------------------------------
      const CLOUD_STEPS = cloudsMobile ? 28 : 56,
        CLOUD_RESOLUTION = cloudsMobile ? 0.34 : 0.5,
        // Half float keeps sunlit tops above 1.0 before tone mapping; without it the
        // colour is stored at a quarter scale in 8 bits.
        cloudHalfFloat =
          cloudsSupported &&
          (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')),
        CLOUD_STORE_SCALE = cloudHalfFloat ? 1 : 0.25;
      const cloudTarget = cloudsSupported
        ? new Three.WebGLRenderTarget(4, 4, {
            depthBuffer: false,
            type: cloudHalfFloat ? Three.HalfFloatType : Three.UnsignedByteType,
            magFilter: Three.LinearFilter,
            minFilter: Three.LinearFilter,
            generateMipmaps: false,
          })
        : null;
      const marchUniforms = {
        ...cloudFieldUniforms(),
        uInverseProjection: { value: new Three.Matrix4() },
        uCameraWorld: { value: new Three.Matrix4() },
        uCameraPosition: { value: new Three.Vector3() },
        uSunDirection: { value: SUN_DIRECTION.clone() },
        uSunColor: { value: new Three.Color() },
        uSkyColor: { value: new Three.Color() },
        uGroundColor: { value: new Three.Color() },
        uGlowColor: { value: new Three.Color() },
        uHazeColor: { value: new Three.Color() },
        uHaze: { value: new Three.Vector2(0, 6000) },
        uNearFade: { value: new Three.Vector2(0, 1) },
        uAircraft: { value: new Three.Vector3() },
        uMaxDistance: { value: 30000 },
      };
      const marchMaterial = new Three.ShaderMaterial({
        uniforms: marchUniforms,
        depthTest: false,
        depthWrite: false,
        vertexShader: `
          uniform mat4 uInverseProjection;
          uniform mat4 uCameraWorld;
          varying vec3 vRay;
          void main(){
            vec4 view = uInverseProjection * vec4(position.xy, 1., 1.);
            vRay = (uCameraWorld * vec4(view.xyz / view.w, 0.)).xyz;
            gl_Position = vec4(position.xy, 0., 1.);
          }`,
        fragmentShader: `
          precision highp float;
          ${CLOUD_FIELD_GLSL}
          uniform vec3 uCameraPosition, uSunDirection, uSunColor, uSkyColor, uGroundColor, uGlowColor, uHazeColor;
          uniform vec2 uHaze, uNearFade;
          uniform vec3 uAircraft;
          uniform float uMaxDistance;
          varying vec3 vRay;
          const float EXTINCTION = 0.028; // per world unit at density 1
          float henyeyGreenstein(float c, float g){
            float g2 = g * g;
            return (1. - g2) / pow(1. + g2 - 2. * g * c, 1.5); // x 4pi: isotropic = 1
          }
          // Optical depth towards the sun, for self-shadowing.
          float sunDepth(vec3 p){
            float d = cloudDensity(p + uSunDirection * 70., false) * 140.
                    + cloudDensity(p + uSunDirection * 260., false) * 240.;
            ${cloudsMobile ? '' : 'd += cloudDensity(p + uSunDirection * 620., false) * 480.;'}
            return d * EXTINCTION;
          }
          void main(){
            vec3 rd = normalize(vRay);
            gl_FragColor = vec4(0.);
            if (rd.y > -0.0001 && uCameraPosition.y < uBase) return;
            // Where the ray is inside the slab, less what is faded out near the camera.
            float toBase = (uBase - uCameraPosition.y) / rd.y, toTop = (uTop - uCameraPosition.y) / rd.y;
            float t0 = max(max(min(toBase, toTop), 0.), uNearFade.x);
            float t1 = min(max(toBase, toTop), uMaxDistance);
            if (t1 <= t0) return;
            float stepLength = (t1 - t0) / float(${CLOUD_STEPS});
            // Interleaved-gradient jitter trades banding for fine grain.
            float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            float t = t0 + stepLength * jitter;
            float cosine = dot(rd, uSunDirection);
            float phase = mix(henyeyGreenstein(cosine, 0.6), henyeyGreenstein(cosine, -0.25), 0.4);
            float transmittance = 1., firstHit = -1.;
            vec3 light = vec3(0.);
            // Over the city at night the streetlights glow on the underside of the deck.
            for (int i = 0; i < ${CLOUD_STEPS}; i++){
              vec3 p = uCameraPosition + rd * t;
              // A pocket of clear air around the aircraft: inside the layer you see
              // cloud walls and wisps around you and the ground straight below,
              // rather than a flat white-out.
              vec3 fromCraft = p - uAircraft;
              fromCraft.y *= 1.4;
              float d = cloudDensity(p, true) * smoothstep(uNearFade.x, uNearFade.y, t)
                      * smoothstep(${CLOUD_POCKET_INNER.toFixed(1)}, ${CLOUD_POCKET_OUTER.toFixed(1)}, length(fromCraft));
              if (d > 0.003){
                if (firstHit < 0.) firstHit = t;
                float h = clamp((p.y - uBase) / (uTop - uBase), 0., 1.);
                float od = sunDepth(p);
                // Beer's law with a softened tail (multiple scattering keeps deep
                // cloud from going black) and "powder" darkening on thin edges.
                float sun = max(exp(-od), exp(-od * 0.25) * 0.3) * (1. - exp(-d * 4.)) * 1.2;
                float city = smoothstep(-900., 400., p.x) * smoothstep(6200., 5200., p.x)
                           * smoothstep(-4700., -3800., p.z) * smoothstep(6200., 5300., p.z);
                // Ambient: open sky above, fading into the shadowed body; a little
                // light bounced up from the ground under the base.
                vec3 radiance = uSunColor * phase * sun
                              + uSkyColor * (0.25 + 0.75 * h) * (0.35 + 0.65 * exp(-od * 0.5))
                              + uGroundColor * (1. - h)
                              + uGlowColor * city * pow(1. - h, 3.);
                float stepTransmittance = exp(-d * EXTINCTION * stepLength);
                light += transmittance * radiance * (1. - stepTransmittance);
                transmittance *= stepTransmittance;
                if (transmittance < 0.015) break;
              }
              t += stepLength;
            }
            float alpha = 1. - transmittance;
            if (firstHit > 0.){
              // The same aerial perspective as the scene (flight-view3d.js).
              float reach = max(firstHit - uHaze.x, 0.) / uHaze.y;
              light = mix(light, uHazeColor * alpha, 1. - exp(-reach * reach));
            }
            gl_FragColor = vec4(light * ${CLOUD_STORE_SCALE.toFixed(2)}, alpha);
          }`,
      });
      const marchScene = new Three.Scene(),
        marchQuad = new Three.Mesh(fullScreenGeometry, marchMaterial);
      marchQuad.frustumCulled = false;
      marchScene.add(marchQuad);
      // ---- Composite behind the aircraft ------------------------------------------------
      const compositeUniforms = {
        uClouds: { value: cloudTarget ? cloudTarget.texture : null },
        uResolution: { value: new Three.Vector2(1, 1) },
      };
      const cloudComposite = new Three.Mesh(
        new Three.PlaneGeometry(1, 1),
        new Three.ShaderMaterial({
          uniforms: compositeUniforms,
          depthWrite: false,
          blending: Three.CustomBlending,
          blendSrc: Three.OneFactor,
          blendDst: Three.OneMinusSrcAlphaFactor,
          vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `
            uniform sampler2D uClouds;
            uniform vec2 uResolution;
            void main(){
              vec4 c = texture2D(uClouds, gl_FragCoord.xy / uResolution);
              if (c.a < 0.004) discard;
              gl_FragColor = vec4(c.rgb / c.a / ${CLOUD_STORE_SCALE.toFixed(2)}, 1.);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
              gl_FragColor = vec4(gl_FragColor.rgb * c.a, c.a);
            }`,
        }),
      );
      // Opaque queue, after every opaque object: the depth buffer then holds the city
      // and the aircraft, and transparent effects draw afterwards.
      cloudComposite.renderOrder = 1000;
      cloudComposite.frustumCulled = false;
      cloudComposite.visible = false;
      scene.add(cloudComposite);
      const cloudDepth = new Three.Mesh(
        cloudComposite.geometry,
        new Three.ShaderMaterial({
          uniforms: compositeUniforms,
          colorWrite: false,
          vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `
            uniform sampler2D uClouds;
            uniform vec2 uResolution;
            void main(){
              if (texture2D(uClouds, gl_FragCoord.xy / uResolution).a < 0.6) discard;
              gl_FragColor = vec4(0.);
            }`,
        }),
      );
      cloudDepth.renderOrder = 1001;
      cloudDepth.frustumCulled = false;
      cloudDepth.visible = false;
      scene.add(cloudDepth);
      // ---- Cloud shadows ------------------------------------------------------------------
      const shadeHeight =
        Math.min(620, Math.max(330, ...allBuildings.map((o) => o.height || 0))) + 12;
      const shadeUniforms = {
        ...cloudFieldUniforms(),
        uSunDirection: { value: SUN_DIRECTION.clone() },
        uViewDirection: { value: new Three.Vector3(0, -1, 0) },
        uPerspective: { value: 0 },
        uGround: { value: 0 },
        uStrength: { value: 0 },
      };
      const cloudShade = new Three.Mesh(
        new Three.PlaneGeometry(1, 1),
        new Three.ShaderMaterial({
          uniforms: shadeUniforms,
          // Blended, but queued with the opaque objects just before the cloud
          // composite, so the shadows darken the ground and never the clouds.
          depthWrite: false,
          blending: Three.CustomBlending,
          blendSrc: Three.SrcAlphaFactor,
          blendDst: Three.OneMinusSrcAlphaFactor,
          vertexShader: `
            varying vec3 vWorld;
            void main(){
              vec4 world = modelMatrix * vec4(position, 1.);
              vWorld = world.xyz;
              gl_Position = projectionMatrix * viewMatrix * world;
            }`,
          fragmentShader: `
            precision highp float;
            ${CLOUD_FIELD_GLSL}
            uniform vec3 uSunDirection, uViewDirection;
            uniform float uPerspective, uGround, uStrength;
            varying vec3 vWorld;
            // The layer's density with a soft threshold. cloudDensity() carves crisp
            // cells out of the noise, right for the cloud you fly past but, thrown on
            // the ground, a pattern of hard-edged blotches a hundred metres across
            // (camouflage, seen from a helicopter). A real cloud shadow is a broad,
            // soft pool: the same cells, but their edges ramp in over a wide band.
            float softCloud(vec3 p){
              float h = (p.y - uBase) / (uTop - uBase);
              float cover = cloudCoverage(p.xz);
              if (cover <= 0.001 || h <= 0. || h >= 1.) return 0.;
              float top = mix(0.36, 1.0, cover);
              float profile = smoothstep(0., 0.07, h) * (1. - smoothstep(top * 0.35, top, h));
              vec3 q = vec3(p.x + uWind.x, p.y, p.z + uWind.y);
              vec4 n = texture(uNoise, q / ${CLOUD_SHAPE_SCALE.toFixed(1)});
              float shape = n.r * 0.75 + n.b * 0.25;
              float cut = 1. - cover * profile * 0.94;
              return smoothstep(cut - 0.16, cut + 0.3, shape);
            }
            void main(){
              // Follow the view ray from this plane down to the ground it covers...
              vec3 rd = normalize(mix(uViewDirection, vWorld - cameraPosition, uPerspective));
              vec3 ground = vWorld + rd * ((uGround - vWorld.y) / min(rd.y, -0.05));
              // ...then look up the sun ray through the slab from there, at two heights,
              // each a small ring of taps (a ~60 m penumbra) so edges blur into the
              // soft pools a sun-lit cumulus actually throws.
              float depth = 0.;
              for (int i = 0; i < 2; i++){
                float y = mix(uBase, uTop, 0.22 + 0.26 * float(i));
                vec3 p = ground + uSunDirection * ((y - ground.y) / uSunDirection.y);
                depth += softCloud(p) * 2.;
                depth += softCloud(p + vec3(310., 0., 90.));
                depth += softCloud(p + vec3(-90., 0., 310.));
                depth += softCloud(p + vec3(-310., 0., -90.));
                depth += softCloud(p + vec3(90., 0., -310.));
              }
              float shade = smoothstep(0.04, 0.8, depth / 12.);
              // Sky-lit shade is cool but not ink: a slate tone rather than navy.
              gl_FragColor = vec4(0.06, 0.08, 0.12, shade * uStrength);
            }`,
        }),
      );
      cloudShade.rotation.x = -Math.PI / 2;
      cloudShade.renderOrder = 999;
      cloudShade.visible = false;
      cloudShade.frustumCulled = false;
      scene.add(cloudShade);
      // ---- Frame update -------------------------------------------------------------------
      const cloudWind = new Three.Vector2(),
        cloudBuffer = new Three.Vector2(),
        cloudForward = new Three.Vector3(),
        cloudClearColor = new Three.Color(),
        cloudGrey = new Three.Color();
      let cloudClock = 0;
      // How much cloud there is between the sun and a ground point, from the coverage
      // map alone (the CPU has no copy of the noise volume): enough to dim the sun as
      // a big shadow crosses you.
      function cloudOverhead(x, z, coverage) {
        const lift = (CLOUD_BASE + CLOUD_TOP) / 2 / SUN_DIRECTION.y,
          m = cloudMapAt(x + SUN_DIRECTION.x * lift + cloudWind.x, z + SUN_DIRECTION.z * lift + cloudWind.y),
          t = clamp((m - (1 - coverage)) / 0.28, 0, 1);
        return t * t * (3 - 2 * t);
      }
      function updateCloudVisuals(deltaSeconds) {
        const light = daylight(),
          cloud = weather.cloud,
          // A few fair-weather puffs even on a clear day; a closed deck in a storm.
          coverage = clamp(0.1 + cloud * 0.95, 0, 1),
          overcast = clamp((cloud - 0.8) / 0.2, 0, 1),
          // A closed deck is a flatter, lower-topped layer than towering cumulus.
          top = CLOUD_TOP - overcast * 700,
          windSpeed = 30 + weather.wind * 70;
        cloudWind.x += Math.cos(weather.windAngle) * windSpeed * deltaSeconds;
        cloudWind.y += Math.sin(weather.windAngle) * windSpeed * deltaSeconds;
        cloudClock += deltaSeconds;
        // Keep the offset small so float precision holds; the fields tile.
        cloudWind.x %= CLOUD_MAP_SPAN * 3;
        cloudWind.y %= CLOUD_MAP_SPAN * 3;
        for (const u of [marchUniforms, shadeUniforms]) {
          u.uWind.value.copy(cloudWind);
          u.uCoverage.value = coverage;
          u.uTop.value = top;
          u.uTime.value = cloudClock;
        }
        // Shadows on the ground: strongest in broken cloud, gone under a closed deck
        // (whose even gloom is the overcast dimming in weather3d.js) and at night.
        // At most a third darker: enough to read as passing cloud without turning
        // the streets into a patchwork from the air.
        const shadeStrength = cloudsSupported ? 0.34 * clamp(light * 1.4, 0, 1) * (1 - overcast * 0.85) : 0;
        cloudShade.visible = shadeStrength > 0.01 && coverage > 0.05;
        if (cloudShade.visible) {
          const ground = terrainHeight(viewCenter.x, viewCenter.y),
            span = viewReach * 2.6 + 1200;
          cloudShade.position.set(viewCenter.x, ground + shadeHeight, viewCenter.y);
          cloudShade.scale.set(span, span, 1);
          shadeUniforms.uGround.value = ground;
          shadeUniforms.uStrength.value = shadeStrength;
          shadeUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
          camera.getWorldDirection(shadeUniforms.uViewDirection.value);
        }
        // The sun dims as a shadow crosses the middle of the view. The clouds are lit
        // by the sun above the weather (the time-of-day strength, plus any lightning):
        // an overcast is grey underneath and bright on top.
        const cloudSunIntensity = 0.35 + light * 3.6 + 9 * weather.flash * weather.flash;
        // Only while the view is about the size of a cloud: from the air the frame
        // spans several, and dimming the whole city for the one in the middle made
        // the light pump as the helicopter crossed their edges.
        const cloudSized = clamp((2600 - viewReach) / 1600, 0, 1);
        sun.intensity *=
          1 - cloudOverhead(viewCenter.x, viewCenter.y, coverage) * (0.42 - overcast * 0.25) * cloudSized * (cloudsSupported ? 1 : 0);
        // The layer itself: only from the flight camera, and only once it is above the
        // base (every view ray points downwards, so below it there is nothing to see).
        const active =
          cloudsSupported && camera === flightCamera && camera.position.y > CLOUD_BASE && coverage > 0.02;
        cloudComposite.visible = cloudDepth.visible = active;
        if (!active) return;
        renderer.getDrawingBufferSize(cloudBuffer);
        const width = Math.max(4, Math.round((viewportWidth || cloudBuffer.x) * CLOUD_RESOLUTION)),
          height = Math.max(4, Math.round((viewportHeight || cloudBuffer.y) * CLOUD_RESOLUTION));
        if (cloudTarget.width !== width || cloudTarget.height !== height) cloudTarget.setSize(width, height);
        compositeUniforms.uResolution.value.copy(cloudBuffer);
        marchUniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        marchUniforms.uCameraWorld.value.copy(camera.matrixWorld);
        marchUniforms.uCameraPosition.value.copy(camera.position);
        // Light: the scene's own sun, sky and ground colours, so dawn, dusk, night and
        // lightning all reach the clouds without a palette of their own.
        marchUniforms.uSunColor.value.copy(sun.color).multiplyScalar(cloudSunIntensity * 0.62);
        marchUniforms.uSkyColor.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.42);
        // Light bounced up off the city is greyed, or cloud bases turn olive.
        marchUniforms.uGroundColor.value
          .copy(hemi.groundColor)
          .lerp(cloudGrey.setScalar(hemi.groundColor.r * 0.3 + hemi.groundColor.g * 0.59 + hemi.groundColor.b * 0.11), 0.7)
          .multiplyScalar(hemi.intensity * 0.3);
        marchUniforms.uGlowColor.value.setRGB(1, 0.56, 0.3).multiplyScalar(nightAmount * 0.55);
        marchUniforms.uHazeColor.value.copy(scene.fog.color);
        marchUniforms.uHaze.value.set(scene.fog.near, scene.fog.far);
        // Cloud between the camera and the aircraft is cut away (flightDistance is how
        // far the aircraft is from the camera), fading in over the last stretch before
        // it: the chase camera never looks through a veil, and cloud at the aircraft's
        // own level wells up around it as it climbs into the layer.
        marchUniforms.uNearFade.value.set(flightDistance * 0.72, flightDistance * 1.02);
        marchUniforms.uAircraft.value.set(player.x, entityElevation(player.car || player), player.y);
        marchUniforms.uMaxDistance.value = camera.far;
        const clearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(cloudClearColor);
        renderer.setRenderTarget(cloudTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.render(marchScene, fullScreenCamera);
        renderer.setRenderTarget(null);
        renderer.setClearColor(cloudClearColor, clearAlpha);
        // Composite quad: square to the camera, just beyond the aircraft, filling the frame.
        const depth = flightDistance + 70,
          tall = 2 * depth * Math.tan((camera.fov * Math.PI) / 360) * 1.25;
        camera.getWorldDirection(cloudForward);
        for (const quad of [cloudComposite, cloudDepth]) {
          quad.position.copy(camera.position).addScaledVector(cloudForward, depth);
          quad.quaternion.copy(camera.quaternion);
          quad.scale.set(tall * camera.aspect, tall, 1);
        }
      }
      // END SUBSYSTEM: src/clouds3d.js
