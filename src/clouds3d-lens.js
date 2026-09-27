      // Clouds 3D lens: beads of water on the camera's lens after a cloud, refracting the frame and swept up it by
      // the freefall airflow; a GLSL chunk and uniforms the post composite uses (included by postfx3d.js).
      /* Set once a frame by the clouds (clouds3d-frame.js): uLensWet 0..1 how wet the lens
         is (beads gather in cloud and dry off after it), uLensFlow 0..1 how hard the air
         sweeps them (their stretch) and uLensScroll how far it has swept them (world
         time integrated with the flow, so a change of speed never makes them jump). */
      const cloudLensUniforms = {
        uLensWet: { value: 0 },
        uLensFlow: { value: 0 },
        uLensScroll: { value: 0 },
      };
      Three.ShaderChunk.city_lens_pars = `
        uniform float uLensWet, uLensFlow, uLensScroll;
        vec3 cityLensHash( vec2 p ) {
          vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) );
          p3 += dot( p3, p3.yxz + 33.33 );
          return fract( ( p3.xxy + p3.yzz ) * p3.zyx );
        }
        // Beads on the lens at this pixel: xy the offset of the scene lookup (a bead is a
        // tiny lens that shows the scene around it flipped and drawn in), z its rim.
        vec3 cityLens( vec2 uv, float aspect ) {
          vec3 lens = vec3( 0.0 );
          if ( uLensWet < 0.002 ) return lens;
          vec2 p = ( uv - 0.5 ) * vec2( aspect, 1.0 );
          for ( int layer = 0; layer < 2; layer++ ) {
            float fl = float( layer ), scale = mix( 9.0, 19.0, fl );
            // The airflow stretches the beads and sweeps them up the frame.
            float stretch = 1.0 + uLensFlow * ( 1.2 + fl );
            vec2 q = vec2( p.x * scale, p.y * scale / stretch - uLensScroll * mix( 0.9, 1.6, fl ) );
            vec2 cell = floor( q ), f = fract( q ) - 0.5;
            vec3 h = cityLensHash( cell + fl * 37.1 );
            // More beads the wetter the lens; at most one to a cell.
            if ( h.x > uLensWet * mix( 0.5, 0.8, fl ) ) continue;
            vec2 d = f - ( h.yz - 0.5 ) * 0.5;
            float r = mix( 0.14, 0.28, h.y ) * mix( 1.0, 0.7, fl ), l = length( d );
            float bead = 1.0 - smoothstep( r * 0.75, r, l );
            lens.xy -= d / scale * vec2( 1.0 / aspect, stretch ) * bead * 2.4;
            // The rim: a glint along the top (light caught from above), shade along the
            // bottom; z is how much darker (negative: brighter) the pixel is.
            float rim = bead * smoothstep( r * 0.45, r, l ), up = d.y / max( l, 1e-4 );
            lens.z += rim * ( 0.5 - 1.6 * max( up, 0.0 ) );
          }
          return lens;
        }`;
