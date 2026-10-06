      // Post composite (one material per tier): AO upsampling, wet reflections, bloom, ACES tone curve, film grade,
      // vignette and dither; the sun glare lands here too (postfx3d-sun.js).
      /**
       * COMPOSITE
       * AO darkens the scene (less where the pixel is itself a light), the bloom is
       * added, and the result goes through the same ACES filmic curve the renderer
       * used before (so exposure keeps its meaning). The grade then works on the
       * display image: saturation, contrast about mid grey, a lift/gain pair that
       * tints shadows and highlights separately (teal shadows and amber lights at
       * dusk, blue shadows and sodium-warm lights at night), and a gentle vignette.
       * A little blue-noise-like dither stops the night sky and fog from banding.
       * Water on the lens after a cloud refracts the whole frame (clouds3d-lens.js).
       */
      // @include src/clouds3d-lens.js
      const postCompositeUniforms = {
        ...cloudLensUniforms,
        ...sunGlareUniforms,
        tScene: { value: null },
        tDepth: { value: null },
        tAo: { value: null },
        // Joint bilateral AO upsampling: the AO target's size, the depth texel
        // and the inverse projection (shared with the AO pass).
        uAoSize: { value: new Three.Vector2(1, 1) },
        uFullTexel: { value: new Three.Vector2(1, 1) },
        uInvProjection: aoUniforms.uInvProjection,
        tBloom: { value: null },
        tReflect: { value: null },
        uReflect: { value: 0 },
        uExposure: { value: 1.14 },
        uAoStrength: { value: 0 },
        uBloomStrength: { value: 0 },
        uSaturation: { value: 1 },
        uVibrance: { value: 0 },
        uContrast: { value: 1 },
        uLift: { value: new Three.Vector3(0, 0, 0) },
        uGain: { value: new Three.Vector3(1, 1, 1) },
        uVignette: { value: 0 },
        uGrain: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        // Developer view: 0 the image, 1 the AO term, 2 the bloom (DeadEndCity.postView).
        uDebugView: { value: 0 },
      };
      function makeCompositeMaterial(tier) {
        return postMaterial(
          `
          varying vec2 vUv;
          uniform sampler2D tScene;
          uniform sampler2D tAo;
          uniform sampler2D tBloom;
          uniform sampler2D tReflect;
          uniform float uReflect;
          uniform float uExposure;
          uniform float uAoStrength;
          uniform float uBloomStrength;
          uniform float uSaturation;
          uniform float uVibrance;
          uniform float uContrast;
          uniform vec3 uLift;
          uniform vec3 uGain;
          uniform float uVignette;
          uniform float uGrain;
          uniform float uTime;
          uniform float uAspect;
          uniform float uDebugView;
          uniform sampler2D tDepth;
          #ifdef USE_AO
            uniform vec2 uAoSize;
            uniform vec2 uFullTexel;
            uniform mat4 uInvProjection;
            float compositeViewZ( float depth ) {
              float z = depth * 2.0 - 1.0;
              return ( uInvProjection[2][2] * z + uInvProjection[3][2] ) / ( uInvProjection[2][3] * z + uInvProjection[3][3] );
            }
            // The half-resolution AO brought up to full resolution taking only
            // the texels on this pixel's own surface (their depth within half a
            // metre): plain bilinear filtering smeared a roof's or a car's shade
            // a pixel or two over the street beside it (and the street's onto
            // the edge of the car), a fringe that flickered as the view moved.
            float compositeAo( vec2 uv ) {
              float zc = compositeViewZ( texture2D( tDepth, uv ).x );
              vec2 p = uv * uAoSize - 0.5, i0 = floor( p ), f = p - i0;
              float sum = 0.0, weights = 0.0;
              for ( int k = 0; k < 4; k++ ) {
                vec2 o = vec2( mod( float( k ), 2.0 ), floor( float( k ) * 0.5 ) );
                vec2 cell = i0 + o;
                // (The AO pass read each block's top-left depth texel.)
                float z = compositeViewZ( texture2D( tDepth, ( cell * 2.0 + 0.5 ) * uFullTexel ).x );
                float w = mix( 1.0 - f.x, f.x, o.x ) * mix( 1.0 - f.y, f.y, o.y ) * max( 1e-3, 1.0 - abs( z - zc ) * 0.25 );
                sum += texture2D( tAo, ( cell + 0.5 ) / uAoSize ).r * w;
                weights += w;
              }
              return sum / weights;
            }
          #endif
          vec3 cityACES( vec3 color ) {
            const mat3 inputMat = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
            const mat3 outputMat = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
            color = inputMat * ( color * uExposure / 0.6 );
            vec3 a = color * ( color + 0.0245786 ) - 0.000090537;
            vec3 b = color * ( 0.983729 * color + 0.4329510 ) + 0.238081;
            return clamp( outputMat * ( a / b ), 0.0, 1.0 );
          }
          vec3 cityLinearToSRGB( vec3 c ) {
            return mix( c * 12.92, pow( c, vec3( 0.41666 ) ) * 1.055 - 0.055, step( 0.0031308, c ) );
          }
          #include <city_lens_pars>
          #include <city_sun_glare_pars>
          void main() {
            // Water on the lens bends the whole image under each bead.
            vec3 lens = cityLens( vUv, uAspect );
            vec2 sceneUv = clamp( vUv + lens.xy, 0.0, 1.0 );
            vec3 color = texture2D( tScene, sceneUv ).rgb;
            // A NaN pixel would come out of the tone curve black, an overflowed one
            // (half float infinity) as NaN too: show them as nothing and as white.
            color = any( isnan( color ) ) ? vec3( 0.0 ) : clamp( color, vec3( 0.0 ), vec3( 6.0e4 ) );
            #ifdef USE_AO
              float ao = compositeAo( sceneUv );
              // Lights (lamps, neon, lit windows) are not shaded; sunlit paving is.
              float lum = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
              color *= mix( 1.0, ao, uAoStrength * ( 1.0 - smoothstep( 3.5, 9.0, lum ) ) );
            #endif
            #ifdef USE_SSR
              // Wet reflections: the ground's own reflectivity (negative alpha) at
              // full resolution keeps the half-resolution reflection off the cars
              // and kerbs standing in it.
              float wet = clamp( -texture2D( tScene, sceneUv ).a, 0.0, 1.0 );
              if ( uReflect > 0.0 && wet > 0.0 ) color = max( color + texture2D( tReflect, sceneUv ).rgb * wet * uReflect, 0.0 );
            #endif
            #ifdef USE_BLOOM
              color += texture2D( tBloom, sceneUv ).rgb * uBloomStrength;
            #endif
            #ifdef USE_SUN_GLARE
              // The sun in frame (chase view): veiling glare, the flare's ghosts and the shafts (postfx3d-sun.js).
              color += citySunGlare( sceneUv );
            #endif
            // A bead's rim: a glint along its top, shade along its bottom.
            color *= 1.0 - lens.z * 0.1;
            color = cityACES( color );
            #ifdef USE_GRADE
              float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
              // Saturation, plus vibrance: more for muted colours than vivid ones,
              // judged by saturation (chroma over value). Raw chroma counted every
              // dark colour as muted, so shade and night went to saturated navy.
              float peak = max( color.r, max( color.g, color.b ) );
              float sat = ( peak - min( color.r, min( color.g, color.b ) ) ) / max( peak, 1e-4 );
              color = max( mix( vec3( luma ), color, uSaturation * ( 1.0 + uVibrance * ( 1.0 - smoothstep( 0.05, 0.6, sat ) ) ) ), 0.0 );
              // FILM GRADE: contrast and lift on a perceptual scale (gamma 2.2).
              // The contrast is an S-curve about mid grey that bends but never
              // clips (the old linear ( c - 0.18 ) * k + 0.18 cut everything under
              // ~20% of the display range to black: shade and night streets lost
              // their texture and showed only the lift's flat navy). The lift
              // tints the darks and the gain the lights (split toning): a gain
              // over the whole range also reddened the blue shade, magenta at dusk.
              vec3 g = pow( min( color, vec3( 1.0 ) ), vec3( 1.0 / 2.2 ) );
              g += uContrast * g * ( 1.0 - g ) * ( 2.0 * g - 1.0 );
              g += uLift * ( 1.0 - g );
              g = max( g, vec3( 0.0 ) );
              float lights = smoothstep( 0.05, 0.7, dot( g, vec3( 0.2126, 0.7152, 0.0722 ) ) );
              color = pow( g, vec3( 2.2 ) ) * mix( vec3( 1.0 ), uGain, lights );
              vec2 v = ( vUv - 0.5 ) * vec2( uAspect, 1.0 );
              color *= 1.0 - uVignette * smoothstep( 0.35, 1.05, length( v ) );
            #endif
            #ifdef USE_AO
              if ( uDebugView > 0.5 && uDebugView < 1.5 ) color = vec3( texture2D( tAo, vUv ).r );
            #endif
            #ifdef USE_BLOOM
              if ( uDebugView > 1.5 && uDebugView < 2.5 ) color = texture2D( tBloom, vUv ).rgb;
            #endif
            if ( uDebugView > 2.5 && uDebugView < 3.5 ) color = vec3( fract( texture2D( tDepth, vUv ).x * 400.0 ) );
            #ifdef USE_SSR
              // The wet reflections (red: the ground's reflectivity) around mid grey.
              if ( uDebugView > 3.5 ) color = clamp( texture2D( tReflect, vUv ).rgb * 0.5 + 0.25, 0.0, 1.0 ) + vec3( clamp( -texture2D( tScene, vUv ).a, 0.0, 1.0 ) * 0.25, 0.0, 0.0 );
            #endif
            color = cityLinearToSRGB( clamp( color, 0.0, 1.0 ) );
            // Dither (and, when graded, a whisper of film grain) against banding. An
            // arithmetic hash: the old fract( sin( dot( ... ) ) * 43758 ) one fed sin()
            // arguments in the hundreds of thousands on large canvases, where GPUs'
            // sin() loses precision and the "noise" turns into rows of lines.
            vec3 p3 = fract( vec3( gl_FragCoord.xyx + fract( uTime ) * 61.0 ) * 0.1031 );
            p3 += dot( p3, p3.yzx + 33.33 );
            float n = fract( ( p3.x + p3.y ) * p3.z );
            color += ( n - 0.5 ) * ( 1.5 / 255.0 + uGrain );
            gl_FragColor = vec4( color, 1.0 );
          }`,
          postCompositeUniforms,
          Object.assign(
            {},
            tier.ao ? { USE_AO: 1 } : {},
            tier.bloom ? { USE_BLOOM: 1 } : {},
            tier.grade ? { USE_GRADE: 1 } : {},
            tier.ssr ? { USE_SSR: 1 } : {},
            sunGlareDefines(tier),
          ),
        );
      }
      let compositeMaterial = null;
