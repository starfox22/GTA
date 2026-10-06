      // Clouds 3D from below: the cloud layer over the chase view, drawn by the sky dome. HIGH and ULTRA march up into
      // the slab (clouds3d-march.js, uBelow); LOW and MEDIUM draw a cheap 2D layer from the same field in the dome.
      /**
       * CLOUDS FROM BELOW
       * The chase view looks along the street, so the sky (and the layer, 250-400 m up) is in
       * frame most of the time; the flight view's march only runs above the lowest cloud. The
       * dome (lighting3d-sky-dome.js, SKY_CLOUDS) composites the cloud over the sky and under
       * nothing else: it draws after the opaque city, so the cloud is behind all geometry.
       *  - HIGH, ULTRA (mode 2): the far march, at its half resolution, from the camera up
       *    through the slab: the same density field, light (Beer's law, the column above, two
       *    orders of multiple scattering, sky light, the ground's bounce, the city's glow at
       *    night) and tower stops as from the air, lit by skyLightDirection (the sun the sky
       *    draws, so cloud near the sun shows its silver lining), hazed by the chase haze. The
       *    dome reads the target at its own pixel.
       *  - LOW, MEDIUM (mode 1): two looks into the field where the ray crosses the slab (low
       *    and middle of the layer, no detail octave), a soft opacity, and a shaded underside:
       *    sky light, the ground's bounce, the sun through thin cloud and the bright rim towards
       *    it, the city's glow at night. A handful of texture reads per sky pixel.
       * Both sample the coverage map and the noise the cloud shadows use (syncCloudField), so the
       * clouds overhead are the ones whose shadows cross the street. WebGL1 has no field: the dome
       * stays clear there. The camera under the layer is the case drawn; a camera inside it (a
       * summit in a wet deck) sees the march around it on HIGH and ULTRA, nothing on LOW and MEDIUM.
       */
      const skyCloudUniforms = {
        ...cloudFieldUniforms(),
        // 0 none, 1 the layer drawn in the dome (LOW, MEDIUM), 2 the march's target (HIGH, ULTRA).
        uSkyCloudMode: { value: 0 },
        uSkyCloudMarch: { value: cloudTarget ? cloudTarget.texture : null },
        // The scene buffer's size in pixels (the dome's gl_FragCoord into the march target), and the target's.
        uSkyCloudBuffer: { value: new Three.Vector2(1, 1) },
        uSkyCloudMarchSize: { value: new Three.Vector2(4, 4) },
        // The layer's base over the camera, and the chase haze's clear distance and span (scene.fog).
        uSkyCloudBase: { value: 0 },
        uSkyCloudHaze: { value: new Three.Vector2(0, 1) },
        // The light the march uses (the same objects: clouds3d-frame.js setCloudLight fills them).
        uSkyCloudSunDir: { value: skyLightDirection },
        uSkyCloudSun: marchUniforms.uSunColor,
        uSkyCloudAmbient: marchUniforms.uSkyColor,
        uSkyCloudBounce: marchUniforms.uGroundColor,
        uSkyCloudGlow: marchUniforms.uGlowColor,
        uSkyCloudTint: marchUniforms.uCloudTint,
      };
      // (Template-literal GLSL: no backticks in its comments.)
      const SKY_CLOUD_GLSL = `
        ${CLOUD_FIELD_GLSL}
        uniform float uSkyCloudMode, uSkyCloudBase;
        uniform sampler2D uSkyCloudMarch;
        uniform vec2 uSkyCloudBuffer, uSkyCloudMarchSize, uSkyCloudHaze;
        uniform vec3 uSkyCloudSunDir, uSkyCloudSun, uSkyCloudAmbient, uSkyCloudBounce, uSkyCloudGlow, uSkyCloudTint;
        // The cloud in direction d, premultiplied (rgb) with its opacity (a); haze is the sky without its
        // sun, moon and stars in that direction (what distant cloud fades into).
        vec4 skyClouds( vec3 d, vec3 haze ) {
          if ( uSkyCloudMode > 1.5 ) {
            // Four bilinear taps a march texel apart (the target is half size): the march's jittered
            // grain and its stair-stepped edges come out soft.
            vec2 uv = gl_FragCoord.xy / uSkyCloudBuffer, o = 0.75 / uSkyCloudMarchSize;
            vec4 c = ( texture2D( uSkyCloudMarch, uv + vec2( o.x, o.y ) ) + texture2D( uSkyCloudMarch, uv + vec2( -o.x, o.y ) )
                     + texture2D( uSkyCloudMarch, uv + vec2( o.x, -o.y ) ) + texture2D( uSkyCloudMarch, uv - o ) ) * 0.25;
            return vec4( c.rgb / ${CLOUD_STORE_SCALE.toFixed(2)}, c.a );
          }
          if ( uSkyCloudMode < 0.5 || d.y < 0.012 || cameraPosition.y > uSkyCloudBase ) return vec4( 0.0 );
          vec3 ro = cameraPosition;
          // Where the ray meets the base, the layer there, and two looks into it: low and middle.
          vec4 area = cloudArea( ro.xz + d.xz * ( ( uSkyCloudBase - ro.y ) / d.y ) );
          vec2 slab = cloudSlab( area );
          vec3 low = ro + d * ( ( mix( slab.x, slab.y, 0.12 ) - ro.y ) / d.y ),
               mid = ro + d * ( ( mix( slab.x, slab.y, 0.4 ) - ro.y ) / d.y );
          float density = cloudDensityAt( low, area, false ) * 0.6 + cloudDensityAt( mid, area, false ) * 0.4;
          if ( density < 0.002 ) return vec4( 0.0 );
          // Opacity: soft at the edges, solid in the cores, thicker looking along a low ray.
          float alpha = 1.0 - exp( - density * mix( 9.0, 16.0, 1.0 - d.y ) );
          float thick = clamp( density * 2.4, 0.0, 1.0 );
          // The underside: sky light from round about (less under a thick core), the ground's bounce,
          // the sun through thin cloud and the bright rim on the side towards it, the city's glow.
          float toSun = clamp( dot( d, uSkyCloudSunDir ) * 0.5 + 0.5, 0.0, 1.0 );
          float sunUp = smoothstep( -0.12, 0.2, uSkyCloudSunDir.y );
          vec3 light = uSkyCloudAmbient * ( 0.62 - 0.32 * thick )
                     + uSkyCloudBounce * 0.9
                     + uSkyCloudSun * sunUp * ( ( 1.0 - thick ) * 0.3 + pow( toSun, 10.0 ) * ( 1.0 - 0.75 * thick ) * 1.4 )
                     + uSkyCloudGlow * 1.4;
          light *= uSkyCloudTint;
          // The chase haze between the street and the cloud: thinner up high, the sky's own colour.
          vec3 rel = mid - ro;
          float dist = length( rel ), reach = cityHazeReach( rel, dist, uSkyCloudHaze.x, uSkyCloudHaze.y );
          float fade = 1.0 - exp( - reach * reach );
          return vec4( mix( light, haze, fade ) * alpha, alpha );
        }`;
      // The dome takes the clouds where the field exists (WebGL2); its program is warmed with the scene.
      if (cloudsSupported) {
        skyDome.material.dispose();
        skyDome.material = makeSkyMaterial(true, { glsl: SKY_CLOUD_GLSL, uniforms: skyCloudUniforms });
      }
      const skyCloudView = { mode: 0, march: false },
        // How far up and out the march from below looks (world units: about 4.5 km; the haze has closed by then).
        SKY_CLOUD_REACH = 36000;
      /* The layer from below for this frame (from updateCloudVisuals): which way it is drawn, and on HIGH and ULTRA
         the march up into it. `cloudSunIntensity`: the sun the clouds are lit with (clouds3d-frame.js). */
      function updateSkyClouds(tier, coverage, cloudSunIntensity, light) {
        const wanted = cloudsSupported && chaseViewActive && skyDome.visible && coverage > 0.02,
          march = wanted && (tier === 'HIGH' || tier === 'ULTRA');
        skyCloudView.mode = skyCloudUniforms.uSkyCloudMode.value = wanted ? (march ? 2 : 1) : 0;
        skyCloudView.march = march;
        if (!wanted) return;
        setCloudLight(cloudSunIntensity, light);
        sceneBufferSize(skyCloudUniforms.uSkyCloudBuffer.value);
        skyCloudUniforms.uSkyCloudHaze.value.set(scene.fog.near, scene.fog.far);
        if (!march) {
          syncCloudField(skyCloudUniforms);
          skyCloudUniforms.uSkyCloudBase.value = cloudLayerAt(camera.position.x, camera.position.z).base;
          return;
        }
        // The march from the camera up through the slab: no pocket, no veil hand-over, no shafts below it.
        const size = sizeCloudTarget(tier);
        skyCloudUniforms.uSkyCloudMarchSize.value.set(size.width, size.height);
        const u = marchUniforms;
        u.uBelow.value = 1;
        u.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        u.uCameraWorld.value.copy(camera.matrixWorld);
        u.uCameraPosition.value.copy(camera.position);
        u.uSunDirection.value.copy(skyLightDirection);
        u.uEye.value.copy(camera.position);
        u.uHaze.value.set(scene.fog.near, scene.fog.far);
        u.uSlab.value.copy(cloudBounds);
        u.uNearFade.value.set(0, 1);
        u.uPocket.value.set(1, 2, 0);
        u.uMaxDistance.value = SKY_CLOUD_REACH;
        u.uShafts.value.set(0, 0, 0);
        const clearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(cloudClearColor);
        renderer.setRenderTarget(cloudTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.render(marchScene, fullScreenCamera);
        renderer.setRenderTarget(null);
        renderer.setClearColor(cloudClearColor, clearAlpha);
        u.uBelow.value = 0;
      }
