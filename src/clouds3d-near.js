      // Clouds 3D near the camera: the veil of cloud between the camera and the subject (the jumper or the
      // aircraft), marched like the far layer and composited over the subject, capped so the subject stays readable.
      /**
       * IN THE CLOUD
       * The far march (clouds3d-march.js) draws the layer beyond the subject; the stretch
       * between the camera and the subject is this veil. It is marched through the same
       * density field and lit the same way (sun through the cloud above, grey in the
       * heart of a deck, darker towards the base), at the tier's step count, and drawn
       * over everything, the subject included: falling into a cloud the jumper sinks into
       * the white, the ground below goes, and the jumper is still there, softened. The
       * veil's opacity has a soft cap (NEAR_CAP by context): real cloud a few tens of
       * metres thick hides a person completely, and a chase camera must never lose its
       * subject. The two passes share the handover (uNearFade) so nothing is counted twice.
       * On LOW there is no march: a flat veil of the in-cloud colour from the CPU
       * estimate (cloudAmountAt at the camera).
       */
      const NEAR_MAX_STEPS = 24,
        NEAR_STEPS = { LOW: 0, MEDIUM: 10, HIGH: 18, ULTRA: 24 },
        // The veil's most opaque: freefall, under canopy, aircraft (times the aircraft's own immersion).
        NEAR_CAP = { freefall: 0.62, canopy: 0.55, aircraft: 0.45 };
      const nearTarget = cloudsSupported
        ? new Three.WebGLRenderTarget(4, 4, {
            depthBuffer: false,
            type: cloudHalfFloat ? Three.HalfFloatType : Three.UnsignedByteType,
            magFilter: Three.LinearFilter,
            minFilter: Three.LinearFilter,
            generateMipmaps: false,
          })
        : null;
      const nearUniforms = {
        ...cloudFieldUniforms(),
        ...cloudLightUniforms(),
        uInverseProjection: { value: new Three.Matrix4() },
        uCameraWorld: { value: new Three.Matrix4() },
        uCameraPosition: { value: new Three.Vector3() },
        // The veil runs from the camera to uSegment.y, fading out over uSegment.x .. y.
        uSegment: { value: new Three.Vector2(0, 1) },
        uSteps: { value: 0 },
        uCap: { value: 0.6 },
        uTowerBox: { value: cloudTowerBoxes },
        uTowerTop: { value: cloudTowerTops },
      };
      const nearMaterial = new Three.ShaderMaterial({
        uniforms: nearUniforms,
        depthTest: false,
        depthWrite: false,
        vertexShader: marchMaterial.vertexShader,
        fragmentShader: `
          precision highp float;
          ${CLOUD_FIELD_GLSL}
          ${CLOUD_LIGHT_GLSL}
          ${CLOUD_TOWERS_GLSL}
          uniform vec3 uCameraPosition;
          uniform vec2 uSegment;
          uniform float uSteps, uCap;
          varying vec3 vRay;
          void main(){
            vec3 rd = normalize(vRay), ro = uCameraPosition;
            float t1 = min(uSegment.y, cloudOccluded(ro, rd));
            float stepLength = t1 / max(uSteps, 1.);
            float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            float t = stepLength * jitter;
            float phase = cloudPhase(dot(rd, uSunDirection));
            float transmittance = 1.;
            vec3 light = vec3(0.);
            for (int i = 0; i < ${NEAR_MAX_STEPS}; i++){
              if (float(i) >= uSteps) break;
              vec3 p = ro + rd * t;
              vec4 area = cloudArea(p.xz);
              if (p.y < cloudGround(area)) break;
              float d = cloudDensityAt(p, area, true) * (1. - smoothstep(uSegment.x, uSegment.y, t));
              if (d > 0.003){
                vec3 radiance = cloudRadiance(p, area, d, phase);
                float stepTransmittance = exp(-d * EXTINCTION * stepLength);
                light += transmittance * radiance * (1. - stepTransmittance);
                transmittance *= stepTransmittance;
              }
              t += stepLength;
            }
            float alpha = 1. - transmittance;
            // Soft cap: thin veils pass unchanged, a wall of cloud tops out at about uCap.
            float capped = uCap * (1. - exp(-alpha / max(uCap, 0.01)));
            gl_FragColor = vec4(light * (alpha > 0.0001 ? capped / alpha : 0.) * ${CLOUD_STORE_SCALE.toFixed(2)}, capped);
          }`,
      });
      const nearScene = new Three.Scene(),
        nearQuad = new Three.Mesh(fullScreenGeometry, nearMaterial);
      nearQuad.frustumCulled = false;
      nearScene.add(nearQuad);
      // The veil over the whole frame, after everything else in the scene (the subject
      // included). `uFlat` (premultiplied, scene light) is LOW's veil, or added haze.
      const nearCompositeUniforms = {
        uNear: { value: nearTarget ? nearTarget.texture : null },
        uResolution: { value: new Three.Vector2(1, 1) },
        uUseTarget: { value: 0 },
        uFlat: { value: new Three.Vector4(0, 0, 0, 0) },
      };
      const cloudVeil = new Three.Mesh(
        fullScreenGeometry,
        new Three.ShaderMaterial({
          uniforms: nearCompositeUniforms,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          blending: Three.CustomBlending,
          blendSrc: Three.OneFactor,
          blendDst: Three.OneMinusSrcAlphaFactor,
          vertexShader: `void main(){ gl_Position = vec4(position.xy, 0., 1.); }`,
          fragmentShader: `
            uniform sampler2D uNear;
            uniform vec2 uResolution;
            uniform float uUseTarget;
            uniform vec4 uFlat;
            void main(){
              vec4 c = uUseTarget > 0.5 ? texture2D(uNear, gl_FragCoord.xy / uResolution) : vec4(0.);
              c.rgb /= ${CLOUD_STORE_SCALE.toFixed(2)};
              // The flat veil goes under the marched one (LOW has only the flat one).
              c = c + vec4(uFlat.rgb, uFlat.a) * (1. - c.a);
              if (c.a < 0.004) discard;
              gl_FragColor = vec4(c.rgb / c.a, 1.);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
              gl_FragColor = vec4(gl_FragColor.rgb * c.a, c.a);
            }`,
        }),
      );
      cloudVeil.renderOrder = 1100;
      cloudVeil.frustumCulled = false;
      cloudVeil.visible = false;
      scene.add(cloudVeil);
      // Renders the veil for this frame: from the camera to `subjectDistance`, capped at
      // `cap`; `steps` 0 draws only the flat veil `flat` (premultiplied colour, alpha).
      function renderCloudVeil(subjectDistance, cap, steps, width, height, flat) {
        nearCompositeUniforms.uFlat.value.copy(flat);
        nearCompositeUniforms.uUseTarget.value = steps > 0 ? 1 : 0;
        cloudVeil.visible = steps > 0 || flat.w > 0.004;
        if (!(steps > 0)) return;
        if (nearTarget.width !== width || nearTarget.height !== height) nearTarget.setSize(width, height);
        syncCloudField(nearUniforms);
        for (const key of ['uSunDirection', 'uSunColor', 'uSkyColor', 'uGroundColor', 'uGlowColor'])
          nearUniforms[key].value.copy(marchUniforms[key].value);
        nearUniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        nearUniforms.uCameraWorld.value.copy(camera.matrixWorld);
        nearUniforms.uCameraPosition.value.copy(camera.position);
        nearUniforms.uSegment.value.set(subjectDistance * 0.9, subjectDistance * 1.02);
        nearUniforms.uSteps.value = steps;
        nearUniforms.uCap.value = cap;
        renderer.setRenderTarget(nearTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.render(nearScene, fullScreenCamera);
      }
