      // Clouds 3D sky history: the march from below (chase view, HIGH and ULTRA) averaged over frames, each frame's
      // result reprojected by where the camera looked last frame, so its step jitter turns into smooth cloud.
      /**
       * SKY CLOUD HISTORY
       * The march from below (clouds3d-march.js cloudMarchBelow) takes a new step jitter each
       * frame (uBelowJitter); this pass keeps a running average of those frames in two half-size
       * targets (ping-pong), the way temporal anti-aliasing does: the previous average is read
       * where this pixel's ray met the layer's base last frame (the camera's turn and travel),
       * clamped to the box of this frame's neighbours (no ghosts when the view changes) and
       * kept at SKY_HISTORY_KEEP. One full-screen pass at the march's size; the dome reads the
       * result. The history starts again on a resize, a jump of the camera or a frame without
       * the march. Only the chase view uses it; the flight view's march is untouched.
       */
      const SKY_HISTORY_KEEP = 0.88,
        // A camera move beyond this in one frame (world units) starts the average again.
        SKY_HISTORY_JUMP = 400,
        skyHistoryTargets = cloudTarget
          ? [0, 1].map(
              () =>
                new Three.WebGLRenderTarget(4, 4, {
                  depthBuffer: false,
                  type: cloudTarget.texture.type,
                  magFilter: Three.LinearFilter,
                  minFilter: Three.LinearFilter,
                  generateMipmaps: false,
                }),
            )
          : null,
        skyHistory = { read: 0, valid: false, frame: 0, lastFrame: -2, since: 0, x: 0, y: 0, z: 0 },
        skyHistoryView = new Three.Matrix4(),
        skyHistoryUniforms = {
          tCurrent: { value: cloudTarget ? cloudTarget.texture : null },
          tHistory: { value: null },
          uInverseProjection: { value: new Three.Matrix4() },
          uCameraWorld: { value: new Three.Matrix4() },
          uPrevViewProjection: { value: new Three.Matrix4() },
          uCameraPosition: { value: new Three.Vector3() },
          uTexel: { value: new Three.Vector2(0.25, 0.25) },
          // The layer's base over the camera (the depth the reprojection assumes), and how much history is kept.
          uBase: { value: 0 },
          uKeep: { value: 0 },
        },
        skyHistoryScene = new Three.Scene(),
        skyHistoryQuad = new Three.Mesh(
          fullScreenGeometry,
          new Three.ShaderMaterial({
            uniforms: skyHistoryUniforms,
            depthTest: false,
            depthWrite: false,
            vertexShader: `
              varying vec2 vUv;
              void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
            fragmentShader: `
              precision highp float;
              uniform sampler2D tCurrent, tHistory;
              uniform mat4 uInverseProjection, uCameraWorld, uPrevViewProjection;
              uniform vec3 uCameraPosition;
              uniform vec2 uTexel;
              uniform float uBase, uKeep;
              varying vec2 vUv;
              void main(){
                vec4 c = texture2D(tCurrent, vUv);
                if (uKeep <= 0.){ gl_FragColor = c; return; }
                // The box of this frame's neighbours: history outside it is a view that has changed.
                vec4 lo = c, hi = c;
                for (int y = -1; y <= 1; y++)
                  for (int x = -1; x <= 1; x++){
                    if (x == 0 && y == 0) continue;
                    vec4 s = texture2D(tCurrent, vUv + vec2(float(x), float(y)) * uTexel);
                    lo = min(lo, s);
                    hi = max(hi, s);
                  }
                // Where this ray met the base last frame (far out for a ray near the horizon).
                vec4 view = uInverseProjection * vec4(vUv * 2. - 1., 1., 1.);
                vec3 rd = normalize((uCameraWorld * vec4(view.xyz / view.w, 0.)).xyz);
                float t = rd.y > 0.02 ? (uBase - uCameraPosition.y) / rd.y : 160000.;
                vec4 prev = uPrevViewProjection * vec4(uCameraPosition + rd * clamp(t, 800., 160000.), 1.);
                vec2 puv = prev.xy / max(prev.w, 1e-6) * 0.5 + 0.5;
                if (prev.w <= 0. || puv.x < 0. || puv.y < 0. || puv.x > 1. || puv.y > 1.){ gl_FragColor = c; return; }
                gl_FragColor = mix(c, clamp(texture2D(tHistory, puv), lo, hi), uKeep);
              }`,
          }),
        );
      skyHistoryQuad.frustumCulled = false;
      skyHistoryScene.add(skyHistoryQuad);
      if (skyHistoryTargets) registerPrewarmPass(skyHistoryScene, fullScreenCamera, () => skyHistoryTargets[0]);
      /* After the march from below has drawn into cloudTarget (clouds3d-sky.js updateSkyClouds): fold it into the
         history and return the texture the dome reads. `base`: the layer's base over the camera (world units). */
      function resolveSkyCloudHistory(width, height, base) {
        const H = skyHistory,
          u = skyHistoryUniforms,
          write = skyHistoryTargets[1 - H.read],
          read = skyHistoryTargets[H.read],
          p = camera.position;
        if (write.width !== width || write.height !== height) {
          write.setSize(width, height);
          read.setSize(width, height);
          H.valid = false;
        }
        if (H.lastFrame !== H.frame - 1 || Math.abs(p.x - H.x) + Math.abs(p.y - H.y) + Math.abs(p.z - H.z) > SKY_HISTORY_JUMP) H.valid = false;
        if (!H.valid) H.since = H.frame;
        u.tHistory.value = read.texture;
        u.uKeep.value = H.valid ? SKY_HISTORY_KEEP : 0;
        u.uTexel.value.set(1 / width, 1 / height);
        u.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        u.uCameraWorld.value.copy(camera.matrixWorld);
        u.uCameraPosition.value.copy(p);
        u.uBase.value = base;
        renderer.setRenderTarget(write);
        renderer.render(skyHistoryScene, fullScreenCamera);
        // This frame's view for the next one's reprojection.
        u.uPrevViewProjection.value.multiplyMatrices(camera.projectionMatrix, skyHistoryView.copy(camera.matrixWorld).invert());
        H.x = p.x;
        H.y = p.y;
        H.z = p.z;
        H.valid = true;
        H.lastFrame = H.frame;
        H.read = 1 - H.read;
        return write.texture;
      }
      /* Console skyCloudBench(rounds): GPU time of the clouds from below on this frame's view (the chase view, HIGH or
         ULTRA), each pass drawn `rounds` times and waited for: `march` (cloudMarchBelow) plus `history`, against
         `uniformMarch`, the same view marched the old way (56 even steps to 4.5 km, the flight view's loop). */
      function skyCloudBench(rounds = 8) {
        if (!skyCloudView.march) return { error: 'the march from below runs only in the chase view on HIGH or ULTRA' };
        const gl = renderer.getContext(),
          u = marchUniforms,
          n = clamp(Math.round(rounds) || 8, 1, 60),
          // A one-pixel read waits for the GPU (gl.finish alone returns at once in Chrome).
          pixel = new Uint8Array(4),
          settle = () => {
            renderer.setRenderTarget(null);
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          },
          time = (draw) => {
            settle();
            const start = performance.now();
            for (let i = 0; i < n; i++) draw();
            settle();
            return +((performance.now() - start) / n).toFixed(2);
          },
          march = () => {
            renderer.setRenderTarget(cloudTarget);
            renderer.render(marchScene, fullScreenCamera);
          };
        const reach = u.uMaxDistance.value;
        u.uBelow.value = 0;
        u.uMaxDistance.value = 36000;
        const uniformMarch = time(march);
        u.uBelow.value = 1;
        u.uMaxDistance.value = SKY_CLOUD_REACH;
        if (cloudNoiseSky) u.uNoise.value = cloudNoiseSky.texture;
        const below = time(march),
          history = time(() => {
            renderer.setRenderTarget(skyHistoryTargets[1 - skyHistory.read]);
            renderer.render(skyHistoryScene, fullScreenCamera);
          });
        u.uBelow.value = 0;
        u.uNoise.value = cloudNoise.texture;
        u.uMaxDistance.value = reach;
        renderer.setRenderTarget(null);
        return { rounds: n, size: [cloudTarget.width, cloudTarget.height], msPerFrame: { march: below, history, uniformMarch } };
      }
