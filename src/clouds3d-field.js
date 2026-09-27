      // Clouds 3D field: layer constants, the coverage map, the GPU noise volume and the shared density field (CLOUD_FIELD_GLSL).
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
