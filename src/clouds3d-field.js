      // Clouds 3D field: textures of the game's cloud layer (clouds.js), the GPU noise volume, the shared density
      // field (CLOUD_FIELD_GLSL: base and top by area, scud, no cloud inside the hills) and the tall-tower occluders.
      const CLOUD_SHAPE_SCALE = 2200, // world units per tile of the noise volume (shapes)
        CLOUD_DETAIL_SCALE = 460, // ... and for the eroding detail
        CLOUD_NOISE_SIZE = 64,
        CLOUD_POCKET_INNER = 160, // clear air around the aircraft (world units)...
        CLOUD_POCKET_OUTER = 520, // ...thickening to full cloud by here
        cloudsMobile = touchEnabled(),
        cloudsSupported = !!renderer.capabilities.isWebGL2;
      // ---- The game's maps as textures ---------------------------------------------------
      // Coverage (clouds.js cloudMapBytes): where cloud may form; tiles, drifts with the wind.
      const cloudMapTexture = (() => {
        const bytes = new Uint8Array(CLOUD_MAP_SIZE * CLOUD_MAP_SIZE * 4);
        for (let i = 0; i < cloudMapBytes.length; i++) bytes[i * 4] = bytes[i * 4 + 1] = bytes[i * 4 + 2] = bytes[i * 4 + 3] = cloudMapBytes[i];
        const tx = new Three.DataTexture(bytes, CLOUD_MAP_SIZE, CLOUD_MAP_SIZE, Three.RGBAFormat);
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.magFilter = tx.minFilter = Three.LinearFilter;
        tx.needsUpdate = true;
        return tx;
      })();
      // Area (clouds.js cloudAreaMap): sea, mountain, city weights and the ground, fixed to
      // the world rectangle. The GPU filters the same bytes cloudAreaAt() reads.
      const cloudAreaTexture = (() => {
        const tx = new Three.DataTexture(cloudAreaMap(), CLOUD_AREA_SIZE, CLOUD_AREA_SIZE, Three.RGBAFormat);
        tx.wrapS = tx.wrapT = Three.ClampToEdgeWrapping;
        tx.magFilter = tx.minFilter = Three.LinearFilter;
        tx.needsUpdate = true;
        return tx;
      })();
      // ---- Tall towers the layer can reach (ray stops) ------------------------------------
      // In a low deck the tops of the tallest towers (North Point Key, MONARCH ONE) stand in
      // the cloud: rays stop at their boxes so the cloud behind a tower never draws over it
      // and a tower fades into the cloud with depth. The hills are the area map's ground.
      const CLOUD_TOWERS = 6,
        cloudTowerBoxes = Array.from({ length: CLOUD_TOWERS }, () => new Three.Vector4(0, 0, -1, -1)),
        cloudTowerTops = Array.from({ length: CLOUD_TOWERS }, () => 0);
      allBuildings
        .filter((o) => o.b && (o.height || 0) > 160 * UNITS_PER_METRE && o.b.w > 0 && o.b.h > 0)
        .sort((a, b) => b.height - a.height)
        .slice(0, CLOUD_TOWERS)
        .forEach((o, i) => {
          const ground = terrainHeight(o.b.x + o.b.w / 2, o.b.y + o.b.h / 2);
          cloudTowerBoxes[i].set(o.b.x - 4, o.b.y - 4, o.b.x + o.b.w + 4, o.b.y + o.b.h + 4);
          // (The recorded height includes the crown and mast.)
          cloudTowerTops[i] = ground + o.height + 4 * UNITS_PER_METRE;
        });
      // ---- Noise volume (GPU, once) -----------------------------------------------------
      const cloudNoise = cloudsSupported
        ? new Three.WebGL3DRenderTarget(CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, {
            depthBuffer: false,
            generateMipmaps: false,
          })
        : null;
      /* The same volume at half-float precision for the clouds from below (clouds3d-sky.js): a ray to the horizon
         takes long steps, and the 8-bit volume's quanta, sharpened by the coverage cut, show there as contour
         rings round every billow. The flight view keeps the 8-bit volume (its look is unchanged). */
      const cloudNoiseSky =
        cloudNoise && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'))
          ? new Three.WebGL3DRenderTarget(CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, {
              depthBuffer: false,
              generateMipmaps: false,
              type: Three.HalfFloatType,
            })
          : null;
      const fullScreenCamera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        fullScreenGeometry = new Three.PlaneGeometry(2, 2);
      if (cloudNoise) {
        for (const volume of [cloudNoise, cloudNoiseSky]) {
          if (!volume) continue;
          const t = volume.texture;
          t.wrapS = t.wrapT = t.wrapR = Three.RepeatWrapping;
          t.magFilter = t.minFilter = Three.LinearFilter;
        }
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
        for (const volume of [cloudNoise, cloudNoiseSky]) {
          if (!volume) continue;
          for (let z = 0; z < CLOUD_NOISE_SIZE; z++) {
            generator.uniforms.uZ.value = (z + 0.5) / CLOUD_NOISE_SIZE;
            renderer.setRenderTarget(volume, z);
            renderer.render(noiseScene, fullScreenCamera);
          }
        }
        renderer.setRenderTarget(null);
        generator.dispose();
      }
      // ---- Shared density field (GLSL) ---------------------------------------------------
      // Everything that needs "how much cloud is here" uses this one function, so the
      // clouds you fly through, the wisps that stream past you and the shadows on the
      // street always agree. The heights are the game's (clouds.js cloudLayerAt): the
      // weather's base and top, moved by the area map's sea, mountain and city weights.
      const CLOUD_FIELD_GLSL = `
        precision highp sampler3D;
        uniform sampler3D uNoise;
        uniform sampler2D uCoverageMap;
        uniform sampler2D uAreaMap;
        uniform vec4 uAreaFrame;
        uniform vec2 uWind;
        uniform float uCoverage, uBase, uTop, uTime, uDeck;
        // Base and top offsets per unit of the (sea, mountain, city) weights.
        uniform vec3 uAreaBase, uAreaTop;
        // x: extra cover over the mountains, y: scud depth under the base, z: scud amount.
        uniform vec3 uLayerExtra;
        // The camera (far away for the shadows): cloud within ~150 m of it gets a finer
        // octave of billows, what a body falling through it actually sees.
        uniform vec3 uEye;
        float cloudCloseness(vec3 p){ return 1. - smoothstep(700., 1300., length(p - uEye)); }
        // The area map at a map point: r sea, g mountain, b city, a the highest ground.
        vec4 cloudArea(vec2 xz){ return texture2D(uAreaMap, (xz - uAreaFrame.xy) * uAreaFrame.zw); }
        float cloudGround(vec4 area){ return area.a * ${(255 * CLOUD_GROUND_STEP).toFixed(1)}; }
        // The layer's base (x) and top (y) over that area.
        vec2 cloudSlab(vec4 area){ return vec2(uBase + dot(area.rgb, uAreaBase), uTop + dot(area.rgb, uAreaTop)); }
        // Coverage in [0, 1] at a map point: where cloud may form, and how tall it grows.
        float cloudCoverage(vec2 xz, vec4 area){
          float c = clamp(uCoverage + area.g * uLayerExtra.x, 0., 1.);
          float m = texture2D(uCoverageMap, (xz + uWind) / ${CLOUD_MAP_SPAN.toFixed(1)}).r;
          return smoothstep(1. - c, 1. - c + 0.28, m);
        }
        float cloudDensityAt(vec3 p, vec4 area, bool detailed){
          vec2 slab = cloudSlab(area);
          float h = (p.y - slab.x) / (slab.y - slab.x);
          if (h >= 1. || p.y < cloudGround(area)) return 0.;
          if (h <= 0. && (uLayerExtra.z < 0.01 || p.y < slab.x - uLayerExtra.y)) return 0.;
          float cover = cloudCoverage(p.xz, area);
          if (cover <= 0.001) return 0.;
          vec3 q = vec3(p.x + uWind.x, p.y, p.z + uWind.y);
          vec4 n = texture(uNoise, q / ${CLOUD_SHAPE_SCALE.toFixed(1)});
          float shape = n.r * 0.75 + n.b * 0.25, cut;
          if (h > 0.){
            // Cumulus profile: a firm, flat base and a domed top whose height grows with
            // coverage, so thin cover is fair-weather puffs and heavy cover towers; a
            // closed deck (stratocumulus) keeps a flatter top.
            float top = mix(0.36, 1.0, cover);
            float profile = smoothstep(0., 0.07, h) * (1. - smoothstep(top * mix(0.35, 0.72, uDeck), top, h));
            // The noise must clear a threshold that rises towards the edge of the
            // coverage and towards the top, which carves separate, domed cells.
            cut = 1. - cover * profile * 0.94;
          } else {
            // Scud: rags of cloud under a wet base, fewer and thinner the lower they hang.
            cut = 1. - cover * uLayerExtra.z * (1. - (slab.x - p.y) / uLayerExtra.y) * 0.55;
          }
          float d = clamp((shape - cut) / max(1. - cut, 0.06), 0., 1.);
          if (detailed && d > 0.){
            // Erode the edges with finer billows: ragged wisps at the base, cauliflower
            // tops above.
            vec4 fine = texture(uNoise, q / ${CLOUD_DETAIL_SCALE.toFixed(1)} + vec3(uTime * 0.003, uTime * 0.006, 0.));
            float erode = mix(1. - fine.g, fine.g, clamp(h * 3., 0., 1.)) * mix(0.38, 0.5, smoothstep(0.3, 0.8, h));
            d = clamp((d - erode) / (1. - erode), 0., 1.);
            float close = cloudCloseness(p);
            if (close > 0. && d > 0.){
              vec4 finer = texture(uNoise, q / ${(CLOUD_DETAIL_SCALE * 0.22).toFixed(1)} + vec3(uTime * 0.011, uTime * 0.02, uTime * 0.004));
              float bite = mix(1. - finer.g, finer.b, clamp(h * 3., 0., 1.)) * 0.34 * close;
              d = clamp((d - bite) / (1. - bite), 0., 1.);
            }
          }
          return h > 0. ? d : d * 0.7;
        }
        float cloudDensity(vec3 p, bool detailed){ return cloudDensityAt(p, cloudArea(p.xz), detailed); }
        // Cloud standing above p in its column (world units weighted by cover): light that
        // reaches the heart of a deep deck has come down through all of it.
        float cloudColumnAbove(vec3 p, vec4 area){
          vec2 slab = cloudSlab(area);
          float cover = cloudCoverage(p.xz, area);
          return max(slab.x + (slab.y - slab.x) * mix(0.36, 1.0, cover) - p.y, 0.) * cover;
        }`;
      function cloudFieldUniforms() {
        return {
          uNoise: { value: cloudNoise ? cloudNoise.texture : null },
          uCoverageMap: { value: cloudMapTexture },
          uAreaMap: { value: cloudAreaTexture },
          uAreaFrame: { value: new Three.Vector4(WORLD_LEFT, WORLD_TOP, 1 / WORLD_WIDTH, 1 / WORLD_HEIGHT) },
          uWind: { value: new Three.Vector2() },
          uCoverage: { value: 0 },
          uBase: { value: 0 },
          uTop: { value: 1 },
          uTime: { value: 0 },
          uDeck: { value: 0 },
          uAreaBase: { value: new Three.Vector3() },
          uAreaTop: { value: new Three.Vector3() },
          uLayerExtra: { value: new Three.Vector3(0, 1, 0) },
          uEye: { value: new Three.Vector3(0, 1e7, 0) },
        };
      }
      // The game's layer (clouds.js) into a set of field uniforms, once a frame.
      function syncCloudField(u) {
        const L = cloudLayer;
        u.uWind.value.set(L.windX, L.windY);
        u.uCoverage.value = L.coverage;
        u.uBase.value = L.base;
        u.uTop.value = L.top;
        u.uTime.value = L.clock;
        u.uDeck.value = L.deck;
        u.uAreaBase.value.set(L.seaBase, L.mountainBase, L.cityBase);
        u.uAreaTop.value.set(L.seaTop, L.mountainTop, L.cityTop);
        u.uLayerExtra.value.set(L.mountainCover, Math.max(1, L.scudDepth), L.scud);
      }
      // The lowest (x, scud included) and highest (y) the layer reaches anywhere now.
      function cloudLayerBounds(out) {
        const L = cloudLayer;
        out.x = L.base + Math.min(0, L.seaBase) + Math.min(0, L.mountainBase) + Math.min(0, L.cityBase) - (L.scud > 0.01 ? L.scudDepth : 0);
        out.y = L.top + Math.max(0, L.seaTop) + Math.max(0, L.mountainTop) + Math.max(0, L.cityTop);
        return out;
      }
      // The sun the clouds are lit by (lighting3d-look.js copies the real sun, or the moon, in).
      const SUN_DIRECTION = new Three.Vector3(-620, 980, -340).normalize();
