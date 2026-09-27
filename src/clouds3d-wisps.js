      // Clouds 3D wisps: soft rags of cloud streaming past the camera at the speed it moves through the layer
      // (streaked along the relative wind), shown only where the density field has cloud; count by tier.
      /**
       * WISPS
       * The marched layer is smooth at the scale of a falling body: what sells the speed
       * of a freefall through cloud is the rags whipping past close to the lens. WISP_COUNT
       * camera-facing puffs live in the stretch of the view between the near plane and
       * just beyond the subject. Each is fixed in the air (drifting with the cloud) so the
       * camera's own motion sweeps them past with true parallax; one that leaves that
       * stretch is re-seeded at the far end (or the side) it is being approached from.
       * The vertex shader reads the same density field at the wisp's centre, so rags only
       * appear inside cloud, and lights them as the veil is lit. Each is drawn as a streak
       * along its motion across the frame over a short exposure, its opacity divided by
       * the stretch so a fast rag is a faint long smear, not a bright bar.
       */
      const WISP_MAX = 56,
        WISP_COUNT = { LOW: 10, MEDIUM: 24, HIGH: 40, ULTRA: 56 },
        wispData = new Float32Array(WISP_MAX * 4),
        wispSeeds = new Float32Array(WISP_MAX);
      for (let i = 0; i < WISP_MAX; i++) wispSeeds[i] = ((i * 0.6180339887) % 1) * 97;
      const wispGeometry = new Three.InstancedBufferGeometry();
      wispGeometry.setIndex([0, 1, 2, 0, 2, 3]);
      wispGeometry.setAttribute('position', new Three.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
      const wispAttribute = new Three.InstancedBufferAttribute(wispData, 4);
      wispAttribute.setUsage(Three.DynamicDrawUsage);
      wispGeometry.setAttribute('iWisp', wispAttribute);
      wispGeometry.setAttribute('iSeed', new Three.InstancedBufferAttribute(wispSeeds, 1));
      wispGeometry.instanceCount = 0;
      const wispUniforms = {
        ...cloudFieldUniforms(),
        ...cloudLightUniforms(),
        // Air relative to the camera (world units per second) and the streak's exposure.
        uVelocity: { value: new Three.Vector3() },
        uExposure: { value: 0.06 },
        // Fade in from the near plane (x .. y) and out towards the far end (z .. w).
        uFade: { value: new Three.Vector4(0, 1, 1e5, 2e5) },
        uOpacity: { value: 0 },
      };
      const wispMesh = new Three.Mesh(
        wispGeometry,
        new Three.ShaderMaterial({
          uniforms: wispUniforms,
          depthWrite: false,
          transparent: true,
          blending: Three.CustomBlending,
          blendSrc: Three.OneFactor,
          blendDst: Three.OneMinusSrcAlphaFactor,
          vertexShader: `
            precision highp float;
            ${CLOUD_FIELD_GLSL}
            ${CLOUD_LIGHT_GLSL}
            attribute vec4 iWisp;
            attribute float iSeed;
            uniform vec3 uVelocity;
            uniform vec4 uFade;
            uniform float uExposure, uOpacity;
            varying vec2 vCorner;
            varying float vAlpha, vSeed, vStretch;
            varying vec3 vLight;
            void main(){
              vec3 centre = iWisp.xyz;
              float size = iWisp.w;
              vec4 area = cloudArea(centre.xz);
              float d = cloudDensityAt(centre, area, false);
              vec3 view = (viewMatrix * vec4(centre, 1.)).xyz;
              float depth = -view.z;
              vAlpha = smoothstep(0.02, 0.35, d) * uOpacity
                     * smoothstep(uFade.x, uFade.y, depth) * (1. - smoothstep(uFade.z, uFade.w, depth));
              vSeed = iSeed;
              vCorner = position.xy;
              if (vAlpha < 0.002 || depth < 1.){
                gl_Position = vec4(2., 2., 2., 1.);
                vStretch = 1.;
                vLight = vec3(0.);
                return;
              }
              vLight = cloudRadiance(centre, area, max(d, 0.3), cloudPhase(dot(normalize(centre - cameraPosition), uSunDirection)));
              // The streak: where the rag was over the exposure, across the line of sight.
              vec3 trail = (viewMatrix * vec4(-uVelocity * uExposure, 0.)).xyz;
              vec3 ray = normalize(view);
              vec3 across = trail - ray * dot(trail, ray);
              float stretch = length(across);
              vec3 along = stretch > 0.01 * size ? across / stretch : normalize(cross(ray, vec3(0., 1., 0.)));
              vec3 side = normalize(cross(ray, along));
              float halfLength = stretch * 0.5 + size;
              vStretch = halfLength / size;
              vec3 corner = view + across * 0.5 + side * position.x * size + along * position.y * halfLength;
              gl_Position = projectionMatrix * vec4(corner, 1.);
            }`,
          fragmentShader: `
            precision highp float;
            precision highp sampler3D;
            uniform sampler3D uNoise;
            uniform float uTime;
            varying vec2 vCorner;
            varying float vAlpha, vSeed, vStretch;
            varying vec3 vLight;
            void main(){
              // A ragged puff: soft round falloff eaten into by the cloud's own billows,
              // stretched along the streak.
              vec2 c = vCorner;
              float r = length(c);
              if (r > 1.) discard;
              vec4 n = texture(uNoise, vec3(c.x * 0.3 + vSeed, c.y * 0.3 / vStretch + vSeed * 0.37, vSeed * 0.13 + uTime * 0.004));
              float body = smoothstep(1., 0.15, r) * smoothstep(0.3, 0.8, n.g * 0.7 + n.r * 0.5 + (1. - r) * 0.3);
              float a = body * vAlpha / vStretch;
              if (a < 0.002) discard;
              gl_FragColor = vec4(vLight, 1.);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
              gl_FragColor = vec4(gl_FragColor.rgb * a, a);
            }`,
        }),
      );
      wispMesh.frustumCulled = false;
      wispMesh.renderOrder = 1101;
      wispMesh.visible = false;
      scene.add(wispMesh);
      // Camera frame for placing wisps (no allocations per frame).
      const wispLast = new Three.Vector3(),
        wispVelocity = new Three.Vector3(),
        wispScratch = new Three.Vector3(),
        wispInverse = new Three.Matrix4();
      let wispReady = false,
        wispSeed = 7;
      const wispRandom = () => (wispSeed = (wispSeed * 16807) % 2147483647) / 2147483647;
      // A wisp at view depth `depth`, somewhere across the frame there (world position in `out`).
      function placeWisp(i, depth, lateral) {
        const tanY = Math.tan((camera.fov * Math.PI) / 360) * 1.15,
          tanX = tanY * camera.aspect;
        let x = (wispRandom() * 2 - 1) * tanX * depth,
          y = (wispRandom() * 2 - 1) * tanY * depth;
        // Re-seeded at a side of the frame: the side the camera is moving towards.
        if (lateral) {
          if (Math.abs(lateral.x) > Math.abs(lateral.y)) x = Math.sign(lateral.x) * tanX * depth;
          else y = Math.sign(lateral.y) * tanY * depth;
        }
        wispScratch.set(x, y, -depth).applyMatrix4(camera.matrixWorld);
        wispData[i * 4] = wispScratch.x;
        wispData[i * 4 + 1] = wispScratch.y;
        wispData[i * 4 + 2] = wispScratch.z;
        // 3-12 m rags, larger farther away.
        wispData[i * 4 + 3] = (24 + wispRandom() * 50) * (0.6 + 0.8 * clamp(depth / 700, 0, 1));
      }
      const wispLateral = { x: 0, y: 0 };
      // Once a frame while the flight camera is in or near the layer: `count` wisps between
      // the near plane and `reach` (world units) ahead, `opacity` 0 hides them.
      function updateCloudWisps(deltaSeconds, count, reach, opacity) {
        const show = opacity > 0.01 && count > 0 && cloudsSupported && camera === flightCamera;
        wispMesh.visible = show;
        if (!show) {
          wispReady = false;
          return;
        }
        // The camera's velocity through the air (the cloud drifts with the wind too).
        if (!wispReady) wispLast.copy(camera.position);
        const dt = Math.max(deltaSeconds, 1e-3),
          windSpeed = 30 + weather.wind * 70;
        wispScratch.copy(camera.position).sub(wispLast).divideScalar(dt);
        wispVelocity.lerp(wispScratch, wispReady ? 1 - Math.exp(-deltaSeconds * 8) : 1);
        wispLast.copy(camera.position);
        const near = camera.near * 1.05,
          far = Math.max(near * 2, reach);
        wispInverse.copy(camera.matrixWorldInverse);
        // The air past the camera, in its own frame: which end and side rags come from.
        wispScratch.copy(wispVelocity).transformDirection(wispInverse).multiplyScalar(wispVelocity.length());
        const approaching = wispScratch.z < 0;
        wispLateral.x = wispScratch.x;
        wispLateral.y = wispScratch.y;
        const tanY = Math.tan((camera.fov * Math.PI) / 360) * 1.2,
          tanX = tanY * camera.aspect;
        for (let i = 0; i < count; i++) {
          if (!wispReady) {
            placeWisp(i, near + wispRandom() * (far - near), null);
            continue;
          }
          // Drift with the cloud (the field moves the other way to its wind offset).
          wispData[i * 4] -= Math.cos(weather.windAngle) * windSpeed * deltaSeconds;
          wispData[i * 4 + 2] -= Math.sin(weather.windAngle) * windSpeed * deltaSeconds;
          wispScratch.set(wispData[i * 4], wispData[i * 4 + 1], wispData[i * 4 + 2]).applyMatrix4(wispInverse);
          const depth = -wispScratch.z;
          if (depth < near || depth > far * 1.05) placeWisp(i, approaching ? far * (0.9 + 0.1 * wispRandom()) : near * 1.02, null);
          else if (Math.abs(wispScratch.x) > tanX * depth || Math.abs(wispScratch.y) > tanY * depth)
            placeWisp(i, near + wispRandom() * (far - near), wispLateral);
        }
        wispReady = true;
        wispGeometry.instanceCount = count;
        wispAttribute.needsUpdate = true;
        syncCloudField(wispUniforms);
        for (const key of ['uSunDirection', 'uSunColor', 'uSkyColor', 'uGroundColor', 'uGlowColor'])
          wispUniforms[key].value.copy(marchUniforms[key].value);
        // The air moves opposite to the camera through it; the wind carries the rags.
        wispUniforms.uVelocity.value
          .copy(wispVelocity)
          .negate()
          .add(wispScratch.set(-Math.cos(weather.windAngle) * windSpeed, 0, -Math.sin(weather.windAngle) * windSpeed));
        wispUniforms.uFade.value.set(near, near * 1.8, far * 0.8, far);
        wispUniforms.uOpacity.value = opacity;
      }
