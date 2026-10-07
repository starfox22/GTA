      // Aerial perspective: the fog chunks every fog-enabled material compiles (clear to fogNear, then exp-squared), and
      // the chase view's haze on top: the sky's own horizon colour, warmer into the sun, thinning with height.
      /**
       * AERIAL PERSPECTIVE
       * Exponential fog measured from the camera is the wrong model for a camera that
       * looks down from a height: everything is equally far away, so it greys the whole
       * frame evenly, which read as a milky filter. Haze here is clear out to `near`
       * (set to most of the distance to the ground in the middle of the frame) and
       * thickens with the distance beyond it, so only the far edge of a high view picks
       * up the sky colour, the way distant land does. `scene.fog` is a linear Fog whose
       * near/far feed this curve; `density` is kept as the knob the time-of-day and
       * weather code turn (far = 1 / density), with the same meaning it always had.
       *
       * CHASE HAZE (cityHazeSun.w = 1, only while the chase view draws): the same curve, but
       *  - the air thins with height (scale height 1 / cityHazeSky.w above sea level): a ray
       *    counts the air it crosses against air as dense as at the camera, so towers and
       *    hills rise out of the haze and a view down from a roof looks through more of it;
       *  - its colour is the sky's own colour in that direction (cityHazeColor: the horizon
       *    band, brighter and warmer towards the sun, cooler away from it, the aureole round
       *    the sun), the same function the sky dome draws, so buildings melt into the sky;
       *  - it closes completely over the last fifth before the far clip (cityHazeView.y).
       * The overhead street view keeps cityHazeSun.w = 0: the old curve and fogColor exactly.
       * The six cityHaze* uniforms are shared Float32Arrays (CITY_HAZE): three.js clones
       * uniforms per material but copies a typed array by reference, so writing them once a
       * frame (lighting3d-look.js updateHaze) reaches every fog-enabled material, the built-in
       * ones (ShaderLib) and the custom ones made from UniformsLib.fog. A custom shader whose
       * uniforms lack them reads zeros: the old fog. The sky (lighting3d-sky.js) and the
       * clouds seen from below (clouds3d-sky.js) include CITY_HAZE_GLSL too.
       */
      const CITY_HAZE = {
        // xyz: the sun as the sky draws it (world, unit); w: 1 while the chase haze is on.
        cityHazeSun: { value: new Float32Array([0, 1, 0, 0]) },
        // rgb: the horizon away from the sun (scene-linear); w: 1 / the haze's scale height (per world unit).
        cityHazeSky: { value: new Float32Array([0.5, 0.6, 0.7, 1 / 1200]) },
        // rgb: sunlight scattered along the horizon on the sun's side; w: how tight that lobe is.
        cityHazeGlow: { value: new Float32Array([0, 0, 0, 6]) },
        // rgb: the zenith; w: how quickly the horizon band gives way to it (per unit of sine elevation).
        cityHazeTop: { value: new Float32Array([0.2, 0.3, 0.6, 4]) },
        // rgb: the circumsolar glow; w: how tight it is (the dome adds its bright core, twice as bright, 24 times tighter).
        cityHazeHalo: { value: new Float32Array([0, 0, 0, 200]) },
        // x: haze density at the camera's height (1 at sea level), y: the far clip (view depth, 0: none), z: camera height.
        cityHazeView: { value: new Float32Array([1, 0, 0, 0]) },
      };
      const CITY_HAZE_GLSL = `
        uniform vec4 cityHazeSun, cityHazeSky, cityHazeGlow, cityHazeTop, cityHazeHalo, cityHazeView;
        // The sky in direction dir (unit, world) without its sun, moon, stars and clouds.
        vec3 cityHazeColor( vec3 dir ) {
          float toSun = clamp( dot( dir, cityHazeSun.xyz ) * 0.5 + 0.5, 0.0, 1.0 );
          vec3 horizon = cityHazeSky.rgb + cityHazeGlow.rgb * pow( toSun, cityHazeGlow.w );
          vec3 sky = mix( cityHazeTop.rgb, horizon, exp( - max( dir.y, 0.0 ) * cityHazeTop.w ) );
          return sky + cityHazeHalo.rgb * pow( toSun, cityHazeHalo.w );
        }
        // The curve's reach for a point rel (world) from the camera, dist = length( rel ): the air crossed
        // (thinning with height) against air as dense as at sea level.
        float cityHazeReach( vec3 rel, float dist, float clearTo, float span ) {
          float k = clamp( rel.y * cityHazeSky.w, -20.0, 20.0 );
          float column = abs( k ) > 1e-3 ? ( 1.0 - exp( -k ) ) / k : 1.0 - 0.5 * k;
          return max( dist - clearTo, 0.0 ) * cityHazeView.x * column / span;
        }`;
      Three.ShaderChunk.fog_pars_vertex = `
        #ifdef USE_FOG
          varying vec3 vFogView;
        #endif`;
      Three.ShaderChunk.fog_vertex = `
        #ifdef USE_FOG
          vFogView = mvPosition.xyz;
        #endif`;
      Three.ShaderChunk.fog_pars_fragment = `
        #ifdef USE_FOG
          uniform vec3 fogColor;
          varying vec3 vFogView;
          #ifdef FOG_EXP2
            uniform float fogDensity;
          #else
            uniform float fogNear;
            uniform float fogFar;
            ${CITY_HAZE_GLSL}
          #endif
        #endif`;
      Three.ShaderChunk.fog_fragment = `
        #ifdef USE_FOG
          // (fogBase: the colour before the haze, for a display-referred shader's city_hdr_output, postfx3d.js.)
          float vFogDepth = - vFogView.z;
          vec3 fogTint = fogColor, fogBase = gl_FragColor.rgb;
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
          #else
            // Aerial perspective (aerial-haze3d.js): clear to fogNear, then exp-squared over fogFar.
            float fogReach = max( vFogDepth - fogNear, 0.0 ) / fogFar, fogFloor = 0.0;
            if ( cityHazeSun.w > 0.5 ) {
              // The chase haze: rel is the world offset from the camera (the view matrix is a rotation and a shift).
              vec3 fogRel = ( vec4( vFogView, 0.0 ) * viewMatrix ).xyz;
              float fogDist = length( fogRel );
              fogReach = cityHazeReach( fogRel, fogDist, fogNear, fogFar );
              fogTint = cityHazeColor( fogRel / max( fogDist, 1e-3 ) );
              fogFloor = smoothstep( cityHazeView.y * 0.8, cityHazeView.y * 0.97, vFogDepth );
            }
            float fogFactor = max( 1.0 - exp( - fogReach * fogReach ), fogFloor );
          #endif
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );
        #endif`;
      // The shared uniforms into every material that has fog: the built-in ones (cloned from ShaderLib per
      // material) and the custom ones built from UniformsLib.fog (merge / clone keep the typed arrays shared).
      Object.assign(Three.UniformsLib.fog, CITY_HAZE);
      for (const name in Three.ShaderLib) {
        const shader = Three.ShaderLib[name];
        if (shader && shader.uniforms && shader.uniforms.fogColor) Object.assign(shader.uniforms, CITY_HAZE);
      }
