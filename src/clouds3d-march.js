      // Clouds 3D ray-march pass: the half-resolution march through the layer, its composite and depth quads behind the aircraft.
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
                float city = smoothstep(-3900., -2700., p.x) * smoothstep(4600., 3600., p.x)
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
