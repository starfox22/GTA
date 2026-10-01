      // Clouds 3D ray-march pass: the half-resolution march through the layer beyond the subject (stopped by the
      // hills and the tall towers), its composite and depth quads behind the aircraft, and the shared cloud lighting.
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
      // Light uniforms shared by the far march and the veil near the camera (clouds3d-near.js).
      function cloudLightUniforms() {
        return {
          uSunDirection: { value: SUN_DIRECTION.clone() },
          uSunColor: { value: new Three.Color() },
          uSkyColor: { value: new Three.Color() },
          uGroundColor: { value: new Three.Color() },
          uGlowColor: { value: new Three.Color() },
          // White balance against the day grade's warm gain (postLook.gain), so sunlit
          // cloud comes out of the grade white rather than sand-coloured.
          uCloudTint: { value: new Three.Vector3(1, 1, 1) },
        };
      }
      // The per-frame light (and eye) the veil and the wisps copy from the far march.
      const CLOUD_LIGHT_KEYS = ['uSunDirection', 'uSunColor', 'uSkyColor', 'uGroundColor', 'uGlowColor', 'uCloudTint', 'uEye'];
      /* The light a bit of cloud sends towards the eye. Beer-Lambert extinction and a
         short march towards the sun for self-shadowing; the cloud standing above in its
         column dims it further, so the heart and underside of a deep deck are grey and
         only its top is sunlit; a two-lobe phase function; sky light from above fading
         into the shadowed body; light bounced up from the ground under the base; and at
         night the city's glow on the underside of the deck. */
      const CLOUD_LIGHT_GLSL = `
        uniform vec3 uSunDirection, uSunColor, uSkyColor, uGroundColor, uGlowColor, uCloudTint;
        const float EXTINCTION = 0.028; // per world unit at density 1
        float henyeyGreenstein(float c, float g){
          float g2 = g * g;
          return (1. - g2) / pow(1. + g2 - 2. * g * c, 1.5); // x 4pi: isotropic = 1
        }
        float cloudPhase(float cosine){
          return mix(henyeyGreenstein(cosine, 0.6), henyeyGreenstein(cosine, -0.25), 0.4);
        }
        // Optical depth towards the sun, for self-shadowing.
        float sunDepth(vec3 p){
          float d = cloudDensity(p + uSunDirection * 70., false) * 140.
                  + cloudDensity(p + uSunDirection * 260., false) * 240.;
          ${cloudsMobile ? '' : 'd += cloudDensity(p + uSunDirection * 620., false) * 480.;'}
          return d * EXTINCTION;
        }
        vec3 cloudRadiance(vec3 p, vec4 area, float d, float phase){
          vec2 slab = cloudSlab(area);
          float h = clamp((p.y - slab.x) / (slab.y - slab.x), 0., 1.);
          float od = sunDepth(p) + cloudColumnAbove(p, area) * 0.0012;
          // Close to the camera a short, detailed tap towards the sun shades the fine
          // billows, so the cauliflower relief of a top reads as you fall onto it.
          float close = cloudCloseness(p);
          if (close > 0.) od += cloudDensityAt(p + uSunDirection * 28., area, true) * 28. * EXTINCTION * close;
          // Beer's law plus two orders of multiple scattering (each weaker, reaching
          // deeper and less forward-peaked), which is why a real cloud glows white
          // right through and only its heart and base go grey; a touch of "powder"
          // darkening on thin edges.
          float sun = (exp(-od) * phase + exp(-od * 0.25) * 0.5 * mix(1., phase, 0.5) + exp(-od * 0.07) * 0.22)
                    * mix(1., 1. - exp(-d * 6.), 0.5) * 1.3;
          float city = smoothstep(-3900., -2700., p.x) * smoothstep(4600., 3600., p.x)
                     * smoothstep(-4700., -3800., p.z) * smoothstep(6200., 5300., p.z);
          return (uSunColor * sun
               + uSkyColor * (0.25 + 0.75 * h) * (0.35 + 0.65 * exp(-od * 0.5))
               + uGroundColor * (1. - h)
               + uGlowColor * city * pow(1. - h, 3.)) * uCloudTint;
        }`;
      // Where a ray first meets one of the tall towers the layer can reach (a big number if none).
      const CLOUD_TOWERS_GLSL = `
        uniform vec4 uTowerBox[${CLOUD_TOWERS}];
        uniform float uTowerTop[${CLOUD_TOWERS}];
        float cloudOccluded(vec3 ro, vec3 rd){
          float hit = 1e9;
          vec3 inv = 1. / (rd + vec3(equal(rd, vec3(0.))) * 1e-6);
          for (int i = 0; i < ${CLOUD_TOWERS}; i++){
            vec4 b = uTowerBox[i];
            if (b.z < b.x) continue;
            vec3 ta = (vec3(b.x, -1000., b.y) - ro) * inv, tb = (vec3(b.z, uTowerTop[i], b.w) - ro) * inv;
            vec3 lo = min(ta, tb), hi = max(ta, tb);
            float enter = max(max(lo.x, lo.y), lo.z), leave = min(min(hi.x, hi.y), hi.z);
            if (leave > max(enter, 0.)) hit = min(hit, max(enter, 0.));
          }
          return hit;
        }`;
      const marchUniforms = {
        ...cloudFieldUniforms(),
        ...cloudLightUniforms(),
        uInverseProjection: { value: new Three.Matrix4() },
        uCameraWorld: { value: new Three.Matrix4() },
        uCameraPosition: { value: new Three.Vector3() },
        uHazeColor: { value: new Three.Color() },
        uHaze: { value: new Three.Vector2(0, 6000) },
        uNearFade: { value: new Three.Vector2(0, 1) },
        uAircraft: { value: new Three.Vector3() },
        // Clear air round the subject: inner and outer radius, strength (1 for aircraft).
        uPocket: { value: new Three.Vector3(CLOUD_POCKET_INNER, CLOUD_POCKET_OUTER, 1) },
        // The layer's lowest and highest point now (cloudLayerBounds).
        uSlab: { value: new Three.Vector2(0, 1) },
        uTowerBox: { value: cloudTowerBoxes },
        uTowerTop: { value: cloudTowerTops },
        uMaxDistance: { value: 30000 },
        uShafts: { value: new Three.Vector3(0, 0, 0) },
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
          ${CLOUD_LIGHT_GLSL}
          ${CLOUD_TOWERS_GLSL}
          uniform vec3 uCameraPosition, uHazeColor, uAircraft, uPocket;
          uniform vec2 uHaze, uNearFade, uSlab;
          uniform float uMaxDistance;
          // Shafts under the layer: x strength (0 off), y haze per world unit, z the ground.
          uniform vec3 uShafts;
          varying vec3 vRay;
          void main(){
            vec3 rd = normalize(vRay), ro = uCameraPosition;
            gl_FragColor = vec4(0.);
            // Where the ray is inside the slab, less what is faded out near the camera and
            // what lies behind a tower.
            float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
            float toLow = (uSlab.x - ro.y) / ry, toHigh = (uSlab.y - ro.y) / ry;
            float t0 = max(max(min(toLow, toHigh), 0.), uNearFade.x);
            float t1 = min(min(max(toLow, toHigh), uMaxDistance), cloudOccluded(ro, rd));
            float stepLength = max(t1 - t0, 0.) / float(${CLOUD_STEPS});
            // Interleaved-gradient jitter trades banding for fine grain.
            float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            float t = t0 + stepLength * jitter;
            float phase = cloudPhase(dot(rd, uSunDirection));
            float transmittance = 1., firstHit = -1.;
            vec3 light = vec3(0.);
            for (int i = 0; i < ${CLOUD_STEPS}; i++){
              if (t1 <= t0) break;
              vec3 p = ro + rd * t;
              vec4 area = cloudArea(p.xz);
              // The ray has met the hills: nothing beyond is seen.
              if (p.y < cloudGround(area)) break;
              // A pocket of clear air around the aircraft: inside the layer you see
              // cloud walls and wisps around you and the ground straight below,
              // rather than a flat white-out.
              vec3 fromCraft = p - uAircraft;
              fromCraft.y *= 1.4;
              float d = cloudDensityAt(p, area, true) * smoothstep(uNearFade.x, uNearFade.y, t)
                      * mix(1., smoothstep(uPocket.x, uPocket.y, length(fromCraft)), uPocket.z);
              if (d > 0.003){
                if (firstHit < 0.) firstHit = t;
                vec3 radiance = cloudRadiance(p, area, d, phase);
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
            // Shafts: the haze under the layer is lit only where the sun gets through, so
            // each cloud's shadow runs down through the air to the ground as a darker column
            // and the gaps between stand out as beams (seen from above: slanting light
            // under the breaks). The shadowed haze is drawn as black over what lies below.
            if (uShafts.x > 0. && rd.y < -0.05 && transmittance > 0.05){
              float a = max(max(toLow, 0.), uNearFade.x), b = min((uShafts.z - ro.y) / rd.y, uMaxDistance);
              if (b > a){
                float shade = 0.;
                for (int k = 0; k < 6; k++){
                  vec3 p = ro + rd * mix(a, b, (float(k) + jitter) / 6.);
                  vec2 slab = cloudSlab(cloudArea(p.xz));
                  shade += cloudDensity(p + uSunDirection * ((mix(slab.x, slab.y, 0.25) - p.y) / uSunDirection.y), false);
                }
                float dark = (1. - exp(-(b - a) * uShafts.y)) * clamp(shade / 6. * 3., 0., 1.) * uShafts.x;
                alpha += transmittance * dark;
              }
            }
            gl_FragColor = vec4(light * ${CLOUD_STORE_SCALE.toFixed(2)}, alpha);
          }`,
      });
      const marchScene = new Three.Scene(),
        marchQuad = new Three.Mesh(fullScreenGeometry, marchMaterial);
      marchQuad.frustumCulled = false;
      marchScene.add(marchQuad);
      registerPrewarmPass(marchScene, fullScreenCamera, () => cloudTarget);
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
