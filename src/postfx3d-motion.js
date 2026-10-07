      // Camera motion blur in the chase view: the scene smeared along each pixel's screen motion since the last
      // frame (from the depth and the two frames' cameras), for a short fixed shutter; the player's own vehicle stays sharp.
      /**
       * CAMERA MOTION BLUR (Settings · Graphics · Motion blur; HIGH and ULTRA, the chase view only)
       * The world point under each pixel is rebuilt from the depth buffer and this frame's camera,
       * projected with last frame's camera, and the pixel is averaged along the difference (8 taps
       * either side of it), scaled to a fixed exposure (MOTION_SHUTTER seconds, so the smear does
       * not grow on a slow frame) and capped at MOTION_MAX_SHARE of the screen. Only the camera's own
       * motion counts (no per-object velocities): what moves with the camera (the player's car, the
       * player on foot) would smear wrongly, so anything nearer than MOTION_NEAR stays sharp and is
       * never smeared over the scene behind it. Off in the street view (its scrolling is pixel-locked),
       * in the air, with Motion comfort (motionComfortOn), on a camera cut (a teleport, the look
       * behind, a switch of view) and while paused. The alpha channel (the wet ground's reflectivity,
       * postfx3d.js SSR) is the centre pixel's.
       */
      const MOTION_SHUTTER = 1 / 90,
        MOTION_MAX_SHARE = 0.035,
        MOTION_NEAR = 12 * UNITS_PER_METRE,
        motionUniforms = {
          tScene: { value: null },
          tDepth: { value: null },
          uInvViewProj: { value: new Three.Matrix4() },
          uPrevViewProj: { value: new Three.Matrix4() },
          uInvProjection: { value: new Three.Matrix4() },
          uStrength: { value: 0 },
          uNear: { value: MOTION_NEAR },
          uMaxShare: { value: MOTION_MAX_SHARE },
          uAspect: { value: 1 },
        },
        motionPrevViewProj = new Three.Matrix4(),
        motionViewProj = new Three.Matrix4(),
        motionPrevPosition = new Three.Vector3(),
        motionPrevForward = new Three.Vector3(),
        motionForward = new Three.Vector3();
      let motionMaterial = null,
        motionTarget = null,
        motionPrevCamera = null,
        motionPrevTime = 0,
        motionActive = false;
      function makeMotionMaterial() {
        return postMaterial(
          `
          varying vec2 vUv;
          uniform sampler2D tScene;
          uniform sampler2D tDepth;
          uniform mat4 uInvViewProj, uPrevViewProj, uInvProjection;
          uniform float uStrength, uNear, uMaxShare, uAspect;
          float motionViewDepth( vec2 uv, float depth ) {
            vec4 v = uInvProjection * vec4( uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
            return -v.z / v.w;
          }
          void main() {
            vec4 centre = texture2D( tScene, vUv );
            float depth = texture2D( tDepth, vUv ).x;
            float viewZ = motionViewDepth( vUv, depth );
            // What moves with the camera (the player, their car) stays sharp.
            float keep = smoothstep( uNear, uNear * 1.8, viewZ );
            vec4 world = uInvViewProj * vec4( vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
            world /= world.w;
            vec4 before = uPrevViewProj * world;
            vec2 motion = ( vUv - ( before.xy / before.w * 0.5 + 0.5 ) ) * uStrength * keep;
            float span = length( motion * vec2( uAspect, 1.0 ) );
            if ( span < 0.0008 ) { gl_FragColor = centre; return; }
            motion *= min( 1.0, uMaxShare / span );
            vec3 sum = centre.rgb;
            float weight = 1.0;
            for ( int i = 1; i <= 4; i++ ) {
              float t = float( i ) / 8.0;
              for ( int s = 0; s < 2; s++ ) {
                vec2 uv = vUv + motion * ( s == 0 ? t : -t );
                float d = texture2D( tDepth, uv ).x;
                // A tap on something near (the player's car) is not smeared over the street behind it.
                float w = smoothstep( uNear, uNear * 1.8, motionViewDepth( uv, d ) );
                sum += texture2D( tScene, clamp( uv, 0.0, 1.0 ) ).rgb * w;
                weight += w;
              }
            }
            gl_FragColor = vec4( sum / weight, centre.a );
          }`,
          motionUniforms,
        );
      }
      /* Whether this frame smears: the game allows it (chaseMotionBlurAllowed: the chase view, the setting, no
         comfort, in play), the chase camera draws, not in the air, HIGH or ULTRA (the caller adds: not a cut). */
      function cameraMotionWanted(tier) {
        return chaseMotionBlurAllowed() && chaseViewActive && !flightViewActive && (tier.name === 'HIGH' || tier.name === 'ULTRA');
      }
      /* Before the bloom and the composite: returns the texture the rest of the frame reads as the scene's
         colour (the smeared one, or the scene target's own). */
      function renderCameraMotion(tier, sceneTexture) {
        motionViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        camera.getWorldDirection(motionForward);
        const dt = clamp(gameTime - motionPrevTime, 0, 0.25),
          cut =
            camera !== motionPrevCamera ||
            camera.position.distanceToSquared(motionPrevPosition) > 40 * 40 ||
            motionForward.dot(motionPrevForward) < 0.9;
        let out = sceneTexture;
        motionActive = cameraMotionWanted(tier) && !cut && dt > 1e-4;
        if (motionActive) {
          if (!motionMaterial) motionMaterial = makeMotionMaterial();
          motionTargetSized(postWidth, postHeight);
          motionUniforms.tScene.value = sceneTexture;
          motionUniforms.tDepth.value = sceneTarget.depthTexture;
          motionUniforms.uInvViewProj.value.copy(motionViewProj).invert();
          motionUniforms.uPrevViewProj.value.copy(motionPrevViewProj);
          motionUniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
          motionUniforms.uStrength.value = MOTION_SHUTTER / dt;
          motionUniforms.uAspect.value = postWidth / Math.max(1, postHeight);
          runPass(motionMaterial, motionTarget);
          out = motionTarget.texture;
        }
        motionPrevViewProj.copy(motionViewProj);
        motionPrevPosition.copy(camera.position);
        motionPrevForward.copy(motionForward);
        motionPrevCamera = camera;
        motionPrevTime = gameTime;
        return out;
      }
      function motionTargetSized(width, height) {
        if (!motionTarget || motionTarget.width !== width || motionTarget.height !== height) {
          if (motionTarget) motionTarget.dispose();
          motionTarget = colorTarget(width, height);
        }
        return motionTarget;
      }
      /* The title prewarm compiles the pass (postWarmPasses, rendering-hiccups.md) on the tiers that run it. The post
         size may not be known when the list is made (the pass then linked on the first chase frame): the target is
         looked up when compiled, as the sun shafts' are. */
      function cameraMotionWarmPasses(pass) {
        const tier = postTier;
        if (!tier || (tier.name !== 'HIGH' && tier.name !== 'ULTRA')) return;
        if (!motionMaterial) motionMaterial = makeMotionMaterial();
        pass(motionMaterial, () => motionTargetSized(Math.max(1, postWidth), Math.max(1, postHeight)));
      }
      function cameraMotionReport() {
        return { active: motionActive, strength: +motionUniforms.uStrength.value.toFixed(3), setting: settings.motionBlur !== false, comfort: motionComfortOn() };
      }
