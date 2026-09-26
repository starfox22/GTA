      // BEGIN SUBSYSTEM: src/postfx3d.js — HDR post-processing pipeline
      /**
       * HDR post-processing pipeline
       * Source: src/postfx3d.js
       * Scope: createCityRenderer() closure (included right after flight-view3d.js).
       *
       * The scene is drawn into a half-float (HDR) render target instead of straight
       * to the canvas, so light brighter than white (lamps, neon, headlights, sun
       * glints on water and glass) keeps its energy for the bloom, and the image is
       * tone mapped once, at the end, together with everything else:
       *
       *   scene ──> HDR target (MSAA on HIGH/ULTRA, with a depth texture)
       *     │  ├──> ambient occlusion, half resolution, from the depth buffer
       *     │  │      └── two depth-aware blur passes
       *     │  ├──> bloom: bright-pass, then a mip chain down and back up
       *     │  └──> wet reflections (HIGH / ULTRA, wet streets only), half
       *     │         resolution, then a blur along the reflection
       *     └──> composite: AO, wet reflections, bloom, exposure, ACES filmic tone curve, colour
       *          grade for the time of day, vignette, dither, sRGB
       *            └── FXAA when the scene target is not multisampled
       *
       * Every stage is switched by the quality tier (quality.js); LOW keeps only
       * the composite and FXAA. Nothing here allocates per frame. The HUD is a
       * separate 2D canvas above the 3D one and never goes through this.
       *
       * Display-referred shaders: the water and cloud ShaderMaterials were written
       * to output final screen colours. Drawn into a linear HDR target they would
       * be tone mapped twice, so they end with `#include <city_hdr_output>`, which
       * turns their screen colour back into the scene light that the composite's
       * tone curve maps to that same screen colour. Built-in materials that opt
       * out of tone mapping (`toneMapped: false`: signs, ad panels) get the same
       * treatment through the material patch in lighting3d.js.
       */
      const hdrCapable =
        renderer.capabilities.isWebGL2 &&
        !!(renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
      // Inverse of the composite's tone curve (sRGB decode, then the three.js ACES
      // fit run backwards at the default exposure) for display-referred shaders.
      Three.ShaderChunk.city_hdr_pars = `
        vec3 cityInverseTone( vec3 display ) {
          const mat3 invOutput = mat3(
            vec3( 0.643038, 0.059269, 0.005962 ),
            vec3( 0.311187, 0.931436, 0.063929 ),
            vec3( 0.045775, 0.009295, 0.930118 ) );
          const mat3 invInput = mat3(
            vec3( 1.764741, -0.147028, -0.036337 ),
            vec3( -0.675778, 1.160252, -0.162436 ),
            vec3( -0.088963, -0.013224, 1.198773 ) );
          vec3 y = clamp( invOutput * display, 0.0, 0.94 );
          // RRTAndODTFit solved for its input: (yc - 1) x^2 + (yd - a) x + (ye + b) = 0.
          vec3 qa = y * 0.983729 - 1.0, qb = y * 0.4329510 - 0.0245786, qc = y * 0.238081 + 0.000090537;
          vec3 x = ( -qb - sqrt( max( qb * qb - 4.0 * qa * qc, 0.0 ) ) ) / ( 2.0 * qa );
          return max( invInput * x, 0.0 ) * ( 0.6 / ${(1.14).toFixed(3)} );
        }
        vec3 citySRGBToLinear( vec3 c ) {
          return mix( c * 0.0773993808, pow( c * 0.9478672986 + 0.0521327014, vec3( 2.4 ) ), step( 0.04045, c ) );
        }`;
      Three.ShaderChunk.city_hdr_output = hdrCapable
        ? `gl_FragColor.rgb = cityInverseTone( citySRGBToLinear( clamp( gl_FragColor.rgb, 0.0, 1.0 ) ) );`
        : '';
      // ---- Full-screen passes --------------------------------------------------------
      const postScene = new Three.Scene(),
        postCamera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        postQuad = new Three.Mesh(new Three.PlaneGeometry(2, 2));
      postQuad.frustumCulled = false;
      postScene.add(postQuad);
      const POST_VERTEX = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4( position.xy, 0.0, 1.0 );
        }`;
      function postMaterial(fragmentShader, uniforms, defines = {}) {
        return new Three.ShaderMaterial({
          uniforms,
          defines,
          vertexShader: POST_VERTEX,
          fragmentShader,
          depthTest: false,
          depthWrite: false,
        });
      }
      function runPass(material, target) {
        postQuad.material = material;
        renderer.setRenderTarget(target);
        renderer.render(postScene, postCamera);
      }
      function colorTarget(width, height, type = Three.HalfFloatType) {
        const target = new Three.WebGLRenderTarget(width, height, {
          type,
          depthBuffer: false,
          minFilter: Three.LinearFilter,
          magFilter: Three.LinearFilter,
        });
        target.texture.generateMipmaps = false;
        return target;
      }
      // ---- Scene target ----------------------------------------------------------------
      let sceneTarget = null,
        ldrTarget = null,
        aoTargets = [],
        bloomTargets = [],
        ssrTargets = [],
        postWidth = 0,
        postHeight = 0,
        // The canvas's drawing buffer the targets were sized for, and the share of
        // it the scene is drawn at (dynamic resolution, quality.js ADAPTIVE QUALITY):
        // the composite pass upsamples to the full canvas, so the HUD, the grade and
        // FXAA stay sharp while the expensive scene, AO and bloom passes shrink.
        canvasWidth = 0,
        canvasHeight = 0,
        renderScale = 1,
        postTier = null;
      function buildSceneTarget(width, height, samples) {
        if (sceneTarget) {
          sceneTarget.depthTexture.dispose();
          sceneTarget.dispose();
        }
        const depthTexture = new Three.DepthTexture(width, height, Three.UnsignedIntType);
        sceneTarget = new Three.WebGLRenderTarget(width, height, {
          type: Three.HalfFloatType,
          samples,
          depthTexture,
          stencilBuffer: false,
          minFilter: Three.LinearFilter,
          magFilter: Three.LinearFilter,
        });
        sceneTarget.texture.generateMipmaps = false;
      }
      /**
       * AMBIENT OCCLUSION
       * Obscurance in the manner of Scalable Ambient Obscurance (McGuire et al.
       * 2012), with a cosine estimator that suits the steep street view, on the depth buffer: view
       * positions are rebuilt through the inverse projection (so it works for the
       * orthographic street camera and the perspective flight camera alike),
       * normals come from neighbouring depths, and a spiral of samples within a
       * world-space radius measures how much geometry crowds each point. That is
       * the dark contact line under a car, the soft corner where a wall meets the
       * pavement, the shade in a narrow street canyon and under roof edges. Drawn
       * at half resolution, then blurred twice with weights that stop at depth
       * edges so the shade never bleeds from a roof onto the street below it.
       */
      const aoUniforms = {
        tDepth: { value: null },
        uInvProjection: { value: new Three.Matrix4() },
        uProjection: { value: new Three.Matrix4() },
        uDepthTexel: { value: new Three.Vector2() },
        uRadius: { value: 16 },
        uIntensity: { value: 1.1 },
        uPerspective: { value: 0 },
      };
      const AO_COMMON = `
        uniform sampler2D tDepth;
        uniform mat4 uInvProjection;
        float cityViewZ( float depth ) {
          float z = depth * 2.0 - 1.0;
          return ( uInvProjection[2][2] * z + uInvProjection[3][2] ) / ( uInvProjection[2][3] * z + uInvProjection[3][3] );
        }
        vec3 cityViewPosition( vec2 uv ) {
          float depth = texture2D( tDepth, uv ).x;
          vec4 p = uInvProjection * vec4( uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
          return p.xyz / p.w;
        }`;
      function makeAoMaterial(samples) {
        return postMaterial(
          `
          varying vec2 vUv;
          uniform mat4 uProjection;
          uniform vec2 uDepthTexel;
          uniform float uRadius;
          uniform float uIntensity;
          uniform float uPerspective;
          ${AO_COMMON}
          void main() {
            // This pass is half the depth buffer's size, so the centre of each of
            // its pixels (vUv) falls exactly on the corner between four depth
            // texels, and so do the one-texel neighbours below. The depth texture
            // is sampled nearest, and which of the four a corner fetch returns
            // flipped with sub-ULP rounding of the interpolated vUv: one way above
            // the middle row of the screen (vUv.y = 0.5, where the float exponent
            // changes) and on one side of the full-screen quad's diagonal, the
            // other way elsewhere. Where a pixel and its neighbour read the same
            // texel the rebuilt normal faced the camera instead of the sky, half
            // the samples on flat ground counted as occluders, and the AO printed
            // rows of faint stripes and a darker band with a hard horizontal edge
            // across the middle of the frame, right under the player (the ULTRA
            // "horizontal lines"). Every depth read now starts from the centre of
            // a texel of its own: the top-left one of this pixel's 2x2 block.
            vec2 uv = ( floor( gl_FragCoord.xy ) * 2.0 + 0.5 ) * uDepthTexel;
            float depth = texture2D( tDepth, uv ).x;
            if ( depth >= 0.99999 ) { gl_FragColor = vec4( 1.0 ); return; }
            vec3 P = cityViewPosition( uv );
            // Normal from the flatter of the two neighbours on each axis, so an
            // edge pixel takes the surface it belongs to rather than the step.
            vec3 px0 = cityViewPosition( uv - vec2( uDepthTexel.x, 0.0 ) ), px1 = cityViewPosition( uv + vec2( uDepthTexel.x, 0.0 ) );
            vec3 py0 = cityViewPosition( uv - vec2( 0.0, uDepthTexel.y ) ), py1 = cityViewPosition( uv + vec2( 0.0, uDepthTexel.y ) );
            vec3 dx = abs( px1.z - P.z ) < abs( P.z - px0.z ) ? px1 - P : P - px0;
            vec3 dy = abs( py1.z - P.z ) < abs( P.z - py0.z ) ? py1 - P : P - py0;
            vec3 N = normalize( cross( dx, dy ) );
            // The sampling disc: uRadius world units, in texture coordinates.
            float scale = uPerspective > 0.5 ? 1.0 / max( -P.z, 1.0 ) : 1.0;
            vec2 discUv = vec2( uProjection[0][0], uProjection[1][1] ) * 0.5 * uRadius * scale;
            // Interleaved gradient noise rotates the spiral per pixel; the blur removes it.
            float spin = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
            // Two scales share the samples: even ones search the contact radius
            // (under cars, wall bases, kerbs), odd ones four times as far for the
            // broad shade of a street canyon or a courtyard.
            float nearSum = 0.0, farSum = 0.0;
            for ( int i = 0; i < AO_SAMPLES; i++ ) {
              float t = ( float( i ) + 0.5 ) / float( AO_SAMPLES );
              // Golden-angle spiral: every sample count spreads round the disc, and
              // so do the even (near) and odd (far) halves. (The spiral used to make
              // seven turns over the samples; at ULTRA's 14 that stepped exactly one
              // turn between samples of a half, so each pixel searched along a
              // single line and the rotation noise printed in rows as horizontal
              // bands across the ground.)
              float angle = float( i ) * 2.3999632 + spin;
              float wide = mod( float( i ), 2.0 ) > 0.5 ? 4.0 : 1.0;
              float radius = uRadius * wide, radius2 = radius * radius;
              vec2 offset = vec2( cos( angle ), sin( angle ) ) * sqrt( t ) * discUv * wide;
              vec3 v = cityViewPosition( uv + offset ) - P;
              float vv = dot( v, v ), vn = dot( v, N );
              // Cosine of the angle above the surface, fading out towards the radius.
              float term = max( ( vn - 0.02 * radius ) * inversesqrt( vv + 0.01 * radius2 ), 0.0 ) * max( 1.0 - vv / radius2, 0.0 );
              if ( wide > 1.5 ) farSum += term; else nearSum += term;
            }
            float perScale = 2.0 / float( AO_SAMPLES );
            float ao = max( 0.0, 1.0 - nearSum * perScale * uIntensity ) * max( 0.0, 1.0 - farSum * perScale * uIntensity * 0.55 );
            gl_FragColor = vec4( ao, 0.0, 0.0, 1.0 );
          }`,
          aoUniforms,
          { AO_SAMPLES: samples },
        );
      }
      let aoMaterial = null;
      const aoBlurUniforms = {
        tAo: { value: null },
        tDepth: { value: null },
        uInvProjection: aoUniforms.uInvProjection,
        uDirection: { value: new Three.Vector2() },
        uRadius: aoUniforms.uRadius,
        uDepthTexel: aoUniforms.uDepthTexel,
      };
      const aoBlurMaterial = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tAo;
        uniform vec2 uDirection;
        uniform float uRadius;
        ${AO_COMMON}
        uniform vec2 uDepthTexel;
        void main() {
          // Depth read at texel centres, as in the AO pass (see there).
          vec2 depthUv = ( floor( gl_FragCoord.xy ) * 2.0 + 0.5 ) * uDepthTexel;
          float centreZ = cityViewZ( texture2D( tDepth, depthUv ).x );
          float total = 0.0, weights = 0.0;
          for ( int i = -3; i <= 3; i++ ) {
            vec2 uv = vUv + uDirection * float( i );
            float z = cityViewZ( texture2D( tDepth, depthUv + uDirection * float( i ) ).x );
            float w = ( 1.0 - abs( float( i ) ) / 4.0 ) * max( 0.0, 1.0 - abs( z - centreZ ) / ( uRadius * 0.6 ) );
            total += texture2D( tAo, uv ).r * w;
            weights += w;
          }
          gl_FragColor = vec4( total / max( weights, 1e-4 ), 0.0, 0.0, 1.0 );
        }`,
        aoBlurUniforms,
      );
      /**
       * WET REFLECTIONS
       * On HIGH and ULTRA, while the streets are wet, the wet ground mirrors what
       * stands on it: facades, shop windows and neon, lamp heads, cars and their
       * lights, people. The ground shader (surfaces3d.js) marks wet pixels in the
       * HDR target's alpha with a negative reflectivity (damp film a little,
       * standing water a lot); this pass, at half resolution, traces each marked
       * pixel's mirror ray through the depth buffer (geometric steps out to about
       * a frame height, then a binary search for the crossing) and fetches the
       * scene colour where it meets something. The ray is jittered in its
       * vertical plane by the surface roughness (hardly in a puddle, widely on
       * damp tarmac), so lights stretch into the long streaks wet asphalt shows,
       * and the blur pass after it smooths them along the reflection. Rain rings
       * in the puddles (the same pattern the ground uses) wobble the mirror.
       * The result is stored as the hit colour minus the sky the ground already
       * reflects, so the composite adds `reflection * wetness * mirror` and a
       * building reflected in a puddle darkens it while a lamp brightens it.
       * Dry streets skip both passes.
       */
      const ssrUniforms = {
        tScene: { value: null },
        tDepth: { value: null },
        uInvProjection: aoUniforms.uInvProjection,
        uProjection: aoUniforms.uProjection,
        uDepthTexel: aoUniforms.uDepthTexel,
        uPerspective: aoUniforms.uPerspective,
        uView: { value: new Three.Matrix4() },
        uCameraWorld: { value: new Three.Matrix4() },
        uReach: { value: 600 },
        uSky: { value: new Three.Color(0, 0, 0) },
        uRain: { value: 0 },
        uRainTime: { value: 0 },
      };
      function makeSsrMaterial(steps) {
        return postMaterial(
          `
          varying vec2 vUv;
          uniform sampler2D tScene;
          uniform mat4 uProjection, uView, uCameraWorld;
          uniform vec2 uDepthTexel;
          uniform float uPerspective, uReach, uRain, uRainTime;
          uniform vec3 uSky;
          ${AO_COMMON}
          ${SURFACE_NOISE}
          ${RAIN_RINGS}
          vec2 cityProject( vec3 q ) {
            vec4 clip = uProjection * vec4( q, 1.0 );
            return clip.xy / clip.w * 0.5 + 0.5;
          }
          void main() {
            // Texel centres, as in the AO pass.
            vec2 uv = ( floor( gl_FragCoord.xy ) * 2.0 + 0.5 ) * uDepthTexel;
            float wet = clamp( -texture2D( tScene, uv ).a, 0.0, 1.0 );
            if ( wet < 0.004 ) { gl_FragColor = vec4( 0.0 ); return; }
            vec3 P = cityViewPosition( uv );
            vec3 V = uPerspective > 0.5 ? normalize( P ) : vec3( 0.0, 0.0, -1.0 );
            vec3 N = normalize( ( uView * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
            // Standing water shivers in the rain (surfaces3d.js puts the same rings in its normal).
            float pool = smoothstep( 0.45, 0.9, wet );
            if ( uRain > 0.01 && pool > 0.01 ) {
              vec2 world = ( uCameraWorld * vec4( P, 1.0 ) ).xz;
              vec2 tilt = cityPuddleRipples( world, uRainTime ) * uRain * pool * 0.6;
              N = normalize( N + ( uView * vec4( tilt.x, 0.0, tilt.y, 0.0 ) ).xyz );
            }
            vec3 R = reflect( V, N );
            // Glossy lobe: jitter the ray in its vertical plane (streaks along the
            // view) and a little sideways, more on damp tarmac than in a puddle.
            float rough = mix( 0.2, 0.012, pool );
            float n1 = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
            float n2 = fract( n1 * 7.13 + 0.37 );
            vec3 side = normalize( cross( R, N ) ), lift = normalize( cross( side, R ) );
            R = normalize( R + lift * ( n1 - 0.5 ) * rough * 2.4 + side * ( n2 - 0.5 ) * rough * 0.3 );
            if ( dot( R, N ) < 0.02 ) { gl_FragColor = vec4( 0.0 ); return; }
            // March out along the ray in growing steps.
            float growth = pow( uReach / 1.5, 1.0 / float( SSR_STEPS - 1 ) );
            float t = 1.5 * ( 0.75 + 0.5 * n2 ), last = 0.0, hit = 0.0;
            vec2 q = uv;
            for ( int i = 0; i < SSR_STEPS; i++ ) {
              vec3 Q = P + R * t;
              q = cityProject( Q );
              if ( q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 ) break;
              float dz = cityViewZ( texture2D( tDepth, q ).x ) - Q.z;
              if ( dz > 0.0 && dz < max( 6.0, ( t - last ) * 1.2 ) ) { hit = 1.0; break; }
              last = t;
              t *= growth;
            }
            if ( hit < 0.5 ) { gl_FragColor = vec4( 0.0 ); return; }
            // Refine the crossing between the last miss and the hit.
            float lo = last, hi = t;
            for ( int j = 0; j < 5; j++ ) {
              float mid = 0.5 * ( lo + hi );
              vec3 Q = P + R * mid;
              vec2 m = cityProject( Q );
              if ( cityViewZ( texture2D( tDepth, m ).x ) - Q.z > 0.0 ) { hi = mid; q = m; } else lo = mid;
            }
            vec3 c = texture2D( tScene, q ).rgb;
            c = any( isnan( c ) ) ? vec3( 0.0 ) : clamp( c, vec3( 0.0 ), vec3( 64.0 ) );
            // Fade out towards the frame edges (nothing beyond them to reflect) and the reach.
            vec2 edge = smoothstep( vec2( 0.0 ), vec2( 0.06, 0.1 ), q ) * smoothstep( vec2( 1.0 ), vec2( 0.94, 0.9 ), q );
            float fade = edge.x * edge.y * ( 1.0 - smoothstep( uReach * 0.55, uReach, hi ) );
            gl_FragColor = vec4( ( c - uSky ) * fade, fade );
          }`,
          ssrUniforms,
          { SSR_STEPS: steps },
        );
      }
      let ssrMaterial = null;
      // A 9-tap blur along the reflection (screen-vertical for the street camera),
      // weighted towards the viewer so streaks run down the wet road.
      const ssrBlurUniforms = { tSource: { value: null }, uDirection: { value: new Three.Vector2() } };
      const ssrBlurMaterial = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tSource;
        uniform vec2 uDirection;
        void main() {
          vec4 sum = vec4( 0.0 );
          float weights = 0.0;
          for ( int i = -4; i <= 4; i++ ) {
            float f = float( i );
            float w = exp( -f * f / ( f < 0.0 ? 10.0 : 5.0 ) );
            sum += texture2D( tSource, vUv + uDirection * f ) * w;
            weights += w;
          }
          gl_FragColor = sum / weights;
        }`,
        ssrBlurUniforms,
      );
      /**
       * BLOOM
       * A soft-knee bright-pass keeps only light well above the scene's whites,
       * then a chain of half-size targets is filtered down (13 taps, the "Call of
       * Duty: Advanced Warfare" downsampler, which does not flicker on thin bright
       * lines) and back up with a tent filter, each level adding into the one
       * above. The result is a wide, smooth glow that costs a few hundred
       * microseconds at any resolution.
       */
      const bloomUniforms = {
        tSource: { value: null },
        uTexel: { value: new Three.Vector2() },
        uThreshold: { value: 1.6 },
        uKnee: { value: 0.6 },
      };
      /* The bright-pass is where bad pixels are stopped before the mip chain can
         spread them. A NaN or infinity in the scene buffer (a degenerate normal
         in some shader, stacked additive glows overflowing half float) used to be
         blurred into a black or white square the size of the lowest bloom level,
         32 to 64 pixels across, popping in and out at night: every tap is now
         sanitised. The four taps are then averaged with Karis weights
         (1 / (1 + brightness)), so one sub-pixel specular sparkle (a clear-coat
         glint, a lamp caught by a wet puddle) cannot outweigh its neighbours and
         flicker as a "firefly" as it crawls from pixel to pixel. */
      const bloomPrefilter = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tSource;
        uniform vec2 uTexel;
        uniform float uThreshold;
        uniform float uKnee;
        vec3 safeTap( vec2 o ) {
          vec3 c = texture2D( tSource, vUv + uTexel * o ).rgb;
          if ( any( isnan( c ) ) ) return vec3( 0.0 );
          return clamp( c, vec3( 0.0 ), vec3( 48.0 ) );
        }
        float karis( vec3 c ) { return 1.0 / ( 1.0 + max( c.r, max( c.g, c.b ) ) ); }
        void main() {
          vec3 a = safeTap( vec2( -0.5, -0.5 ) ), b = safeTap( vec2( 0.5, -0.5 ) ), d = safeTap( vec2( -0.5, 0.5 ) ), e = safeTap( vec2( 0.5, 0.5 ) );
          float wa = karis( a ), wb = karis( b ), wd = karis( d ), we = karis( e );
          vec3 c = ( a * wa + b * wb + d * wd + e * we ) / ( wa + wb + wd + we );
          float bright = max( c.r, max( c.g, c.b ) );
          float soft = clamp( bright - uThreshold + uKnee, 0.0, 2.0 * uKnee );
          soft = soft * soft / ( 4.0 * uKnee + 1e-4 );
          gl_FragColor = vec4( c * max( soft, bright - uThreshold ) / max( bright, 1e-4 ), 1.0 );
        }`,
        bloomUniforms,
      );
      const bloomDown = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tSource;
        uniform vec2 uTexel;
        vec3 tap( vec2 o ) { return texture2D( tSource, vUv + uTexel * o ).rgb; }
        void main() {
          vec3 inner = tap( vec2( -1.0, -1.0 ) ) + tap( vec2( 1.0, -1.0 ) ) + tap( vec2( -1.0, 1.0 ) ) + tap( vec2( 1.0, 1.0 ) );
          vec3 outer = tap( vec2( -2.0, -2.0 ) ) + tap( vec2( 2.0, -2.0 ) ) + tap( vec2( -2.0, 2.0 ) ) + tap( vec2( 2.0, 2.0 ) );
          vec3 cross = tap( vec2( -2.0, 0.0 ) ) + tap( vec2( 2.0, 0.0 ) ) + tap( vec2( 0.0, -2.0 ) ) + tap( vec2( 0.0, 2.0 ) );
          gl_FragColor = vec4( inner * 0.125 + outer * 0.03125 + cross * 0.0625 + tap( vec2( 0.0 ) ) * 0.125, 1.0 );
        }`,
        bloomUniforms,
      );
      const bloomUp = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tSource;
        uniform vec2 uTexel;
        vec3 tap( vec2 o ) { return texture2D( tSource, vUv + uTexel * o ).rgb; }
        void main() {
          vec3 c = tap( vec2( 0.0 ) ) * 4.0
                 + ( tap( vec2( -1.0, 0.0 ) ) + tap( vec2( 1.0, 0.0 ) ) + tap( vec2( 0.0, -1.0 ) ) + tap( vec2( 0.0, 1.0 ) ) ) * 2.0
                 + tap( vec2( -1.0, -1.0 ) ) + tap( vec2( 1.0, -1.0 ) ) + tap( vec2( -1.0, 1.0 ) ) + tap( vec2( 1.0, 1.0 ) );
          gl_FragColor = vec4( c / 16.0, 1.0 );
        }`,
        bloomUniforms,
      );
      // Upsampled light is added onto the level above.
      bloomUp.blending = Three.CustomBlending;
      bloomUp.blendEquation = Three.AddEquation;
      bloomUp.blendSrc = Three.OneFactor;
      bloomUp.blendDst = Three.OneFactor;
      /**
       * COMPOSITE
       * AO darkens the scene (less where the pixel is itself a light), the bloom is
       * added, and the result goes through the same ACES filmic curve the renderer
       * used before (so exposure keeps its meaning). The grade then works on the
       * display image: saturation, contrast about mid grey, a lift/gain pair that
       * tints shadows and highlights separately (teal shadows and amber lights at
       * dusk, blue shadows and sodium-warm lights at night), and a gentle vignette.
       * A little blue-noise-like dither stops the night sky and fog from banding.
       */
      const postCompositeUniforms = {
        tScene: { value: null },
        tDepth: { value: null },
        tAo: { value: null },
        tBloom: { value: null },
        tReflect: { value: null },
        uReflect: { value: 0 },
        uExposure: { value: 1.14 },
        uAoStrength: { value: 0 },
        uBloomStrength: { value: 0 },
        uSaturation: { value: 1 },
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
          uniform float uContrast;
          uniform vec3 uLift;
          uniform vec3 uGain;
          uniform float uVignette;
          uniform float uGrain;
          uniform float uTime;
          uniform float uAspect;
          uniform float uDebugView;
          uniform sampler2D tDepth;
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
          void main() {
            vec3 color = texture2D( tScene, vUv ).rgb;
            // A NaN pixel would come out of the tone curve black, an overflowed one
            // (half float infinity) as NaN too: show them as nothing and as white.
            color = any( isnan( color ) ) ? vec3( 0.0 ) : clamp( color, vec3( 0.0 ), vec3( 6.0e4 ) );
            #ifdef USE_AO
              float ao = texture2D( tAo, vUv ).r;
              float lum = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
              color *= mix( 1.0, ao, uAoStrength * ( 1.0 - smoothstep( 1.2, 4.0, lum ) ) );
            #endif
            #ifdef USE_SSR
              // Wet reflections: the ground's own reflectivity (negative alpha) at
              // full resolution keeps the half-resolution reflection off the cars
              // and kerbs standing in it.
              float wet = clamp( -texture2D( tScene, vUv ).a, 0.0, 1.0 );
              if ( uReflect > 0.0 && wet > 0.0 ) color = max( color + texture2D( tReflect, vUv ).rgb * wet * uReflect, 0.0 );
            #endif
            #ifdef USE_BLOOM
              color += texture2D( tBloom, vUv ).rgb * uBloomStrength;
            #endif
            color = cityACES( color );
            #ifdef USE_GRADE
              float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
              color = mix( vec3( luma ), color, uSaturation );
              color = clamp( ( color - 0.18 ) * uContrast + 0.18, 0.0, 1.0 );
              color = uGain * ( color + uLift * ( 1.0 - color ) );
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
          ),
        );
      }
      let compositeMaterial = null;
      /**
       * FXAA
       * Fast approximate anti-aliasing (after Timothy Lottes' FXAA, NVIDIA) for the
       * tiers without a multisampled scene target: find the local luma contrast,
       * blur along the edge direction and keep the two- or four-tap result that
       * stays inside the neighbourhood's luma range.
       */
      const fxaaUniforms = { tSource: { value: null }, uTexel: { value: new Three.Vector2() } };
      const fxaaMaterial = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tSource;
        uniform vec2 uTexel;
        float luma( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }
        void main() {
          vec3 rgbNW = texture2D( tSource, vUv + vec2( -1.0, -1.0 ) * uTexel ).rgb;
          vec3 rgbNE = texture2D( tSource, vUv + vec2( 1.0, -1.0 ) * uTexel ).rgb;
          vec3 rgbSW = texture2D( tSource, vUv + vec2( -1.0, 1.0 ) * uTexel ).rgb;
          vec3 rgbSE = texture2D( tSource, vUv + vec2( 1.0, 1.0 ) * uTexel ).rgb;
          vec3 rgbM = texture2D( tSource, vUv ).rgb;
          float lNW = luma( rgbNW ), lNE = luma( rgbNE ), lSW = luma( rgbSW ), lSE = luma( rgbSE ), lM = luma( rgbM );
          float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) );
          float lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );
          if ( lMax - lMin < max( 0.0312, lMax * 0.125 ) ) { gl_FragColor = vec4( rgbM, 1.0 ); return; }
          vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( lNW + lSW ) - ( lNE + lSE ) );
          float reduce = max( ( lNW + lNE + lSW + lSE ) * 0.03125, 1.0 / 128.0 );
          float rcpMin = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + reduce );
          dir = clamp( dir * rcpMin, vec2( -8.0 ), vec2( 8.0 ) ) * uTexel;
          vec3 a = 0.5 * ( texture2D( tSource, vUv + dir * ( 1.0 / 3.0 - 0.5 ) ).rgb + texture2D( tSource, vUv + dir * ( 2.0 / 3.0 - 0.5 ) ).rgb );
          vec3 b = a * 0.5 + 0.25 * ( texture2D( tSource, vUv - dir * 0.5 ).rgb + texture2D( tSource, vUv + dir * 0.5 ).rgb );
          float lB = luma( b );
          gl_FragColor = vec4( ( lB < lMin || lB > lMax ) ? a : b, 1.0 );
        }`,
        fxaaUniforms,
      );
      // ---- Sizing and tiers ------------------------------------------------------------
      function disposeTargets(list) {
        for (const t of list) t.dispose();
        list.length = 0;
      }
      function sizePostTargets() {
        const size = renderer.getDrawingBufferSize(new Three.Vector2()),
          width = Math.max(1, Math.floor(size.x * renderScale)),
          height = Math.max(1, Math.floor(size.y * renderScale)),
          tier = postTier;
        if (!tier) return;
        canvasWidth = size.x;
        canvasHeight = size.y;
        postWidth = width;
        postHeight = height;
        buildSceneTarget(width, height, tier.msaa);
        disposeTargets(aoTargets);
        if (tier.ao) {
          const w = Math.max(1, width >> 1),
            h = Math.max(1, height >> 1);
          aoTargets.push(colorTarget(w, h, Three.UnsignedByteType), colorTarget(w, h, Three.UnsignedByteType));
        }
        disposeTargets(ssrTargets);
        if (tier.ssr) {
          const w = Math.max(1, width >> 1),
            h = Math.max(1, height >> 1);
          ssrTargets.push(colorTarget(w, h), colorTarget(w, h));
        }
        disposeTargets(bloomTargets);
        for (let i = 0, w = width >> 1, h = height >> 1; i < tier.bloom && w >= 4 && h >= 4; i++, w >>= 1, h >>= 1)
          bloomTargets.push(colorTarget(w, h));
        if (ldrTarget) ldrTarget.dispose();
        ldrTarget = tier.msaa ? null : colorTarget(width, height, Three.UnsignedByteType);
        postCompositeUniforms.uAspect.value = width / height;
      }
      // Dynamic resolution: the share of the canvas the scene is drawn at (0.5..1).
      // Resizing the targets costs a reallocation, so callers change it in steps.
      function setRenderScale(scale) {
        const next = clamp(Math.round(scale * 20) / 20, 0.5, 1);
        if (next === renderScale) return renderScale;
        renderScale = next;
        if (hdrCapable && postTier) sizePostTargets();
        return renderScale;
      }
      // Size in pixels of the buffer the scene pass draws into (the canvas, or the
      // scaled HDR target): point sprites and screen-space lookups in scene
      // shaders must use this rather than the canvas's drawing buffer.
      function sceneBufferSize(target) {
        renderer.getDrawingBufferSize(target);
        if (hdrCapable && postTier && renderScale < 1)
          target.set(Math.max(1, Math.floor(target.x * renderScale)), Math.max(1, Math.floor(target.y * renderScale)));
        return target;
      }
      function setPostQuality(tier) {
        postTier = tier;
        if (aoMaterial) aoMaterial.dispose();
        aoMaterial = tier.ao ? makeAoMaterial(tier.ao) : null;
        if (compositeMaterial) compositeMaterial.dispose();
        compositeMaterial = makeCompositeMaterial(tier);
        if (ssrMaterial) ssrMaterial.dispose();
        ssrMaterial = tier.ssr ? makeSsrMaterial(tier.ssr) : null;
        postCompositeUniforms.uAoStrength.value = tier.ao ? 1 : 0;
        if (hdrCapable) sizePostTargets();
      }
      /**
       * Per-frame look, set by the time-of-day code (lighting3d.js): exposure,
       * bloom threshold and strength, and the grade.
       */
      const postLook = {
        exposure: 1.14,
        bloomThreshold: 1.6,
        bloomStrength: 0.35,
        aoRadius: 16,
        aoIntensity: 1.1,
        saturation: 1.05,
        contrast: 1.04,
        lift: new Three.Vector3(0, 0, 0),
        gain: new Three.Vector3(1, 1, 1),
        vignette: 0.22,
        grain: 0.006,
        // Wet reflections (weather3d.js): how much of the scene a fully wet
        // surface mirrors (0 = pass off), the sky it already reflects
        // (scene-linear), and the rain on the puddles.
        reflect: 0,
        reflectSky: new Three.Color(0, 0, 0),
        rain: 0,
        rainTime: 0,
      };
      // Whether this tier can draw the wet reflections (the ground then marks
      // itself for them; weather3d.js decides when they are worth it).
      function wetReflectionsAvailable() {
        return hdrCapable && !!postTier && postTier.ssr > 0;
      }
      // Draws the frame: the whole pipeline, or straight to the canvas without HDR.
      // Draw calls and triangles of the scene pass (shadow map included when it was
      // refreshed this frame) and of the whole frame, for DeadEndCity.stats().
      const frameStats = { sceneCalls: 0, sceneTriangles: 0, shadowFrame: false, totalCalls: 0, viewCalls: 0, shadowCalls: 0 };
      // Split the scene pass into camera and shadow-map calls (the shadow pass
      // counts its own, flight-view3d.js).
      function noteSceneCalls() {
        frameStats.sceneCalls = renderer.info.render.calls;
        frameStats.sceneTriangles = renderer.info.render.triangles;
        if (!frameStats.shadowFrame) frameStats.shadowCalls = 0;
        frameStats.viewCalls = Math.max(0, frameStats.sceneCalls - frameStats.shadowCalls);
      }
      renderer.info.autoReset = false;
      function renderFrame() {
        renderer.info.reset();
        frameStats.shadowFrame = renderer.shadowMap.enabled && renderer.shadowMap.needsUpdate;
        if (!hdrCapable || !postTier) {
          renderer.toneMappingExposure = postLook.exposure;
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
          noteSceneCalls();
          frameStats.totalCalls = frameStats.sceneCalls;
          return;
        }
        const size = renderer.getDrawingBufferSize(postSizeScratch);
        if (size.x !== canvasWidth || size.y !== canvasHeight) sizePostTargets();
        renderer.setRenderTarget(sceneTarget);
        renderer.render(scene, camera);
        noteSceneCalls();
        const tier = postTier;
        if (tier.ao && aoMaterial) {
          aoUniforms.tDepth.value = sceneTarget.depthTexture;
          aoUniforms.uProjection.value.copy(camera.projectionMatrix);
          aoUniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
          aoUniforms.uDepthTexel.value.set(1 / postWidth, 1 / postHeight);
          aoUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
          aoUniforms.uRadius.value = postLook.aoRadius;
          aoUniforms.uIntensity.value = postLook.aoIntensity;
          runPass(aoMaterial, aoTargets[0]);
          aoBlurUniforms.tDepth.value = sceneTarget.depthTexture;
          aoBlurUniforms.tAo.value = aoTargets[0].texture;
          aoBlurUniforms.uDirection.value.set(1 / aoTargets[0].width, 0);
          runPass(aoBlurMaterial, aoTargets[1]);
          aoBlurUniforms.tAo.value = aoTargets[1].texture;
          aoBlurUniforms.uDirection.value.set(0, 1 / aoTargets[0].height);
          runPass(aoBlurMaterial, aoTargets[0]);
          postCompositeUniforms.tAo.value = aoTargets[0].texture;
        }
        postCompositeUniforms.uReflect.value = 0;
        if (tier.ssr && ssrMaterial && postLook.reflect > 0.001) {
          ssrUniforms.tScene.value = sceneTarget.texture;
          ssrUniforms.tDepth.value = sceneTarget.depthTexture;
          // (Projection, inverse and texel size are shared with the AO pass.)
          aoUniforms.uProjection.value.copy(camera.projectionMatrix);
          aoUniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
          aoUniforms.uDepthTexel.value.set(1 / postWidth, 1 / postHeight);
          aoUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
          ssrUniforms.uView.value.copy(camera.matrixWorldInverse);
          ssrUniforms.uCameraWorld.value.copy(camera.matrixWorld);
          ssrUniforms.uSky.value.copy(postLook.reflectSky);
          ssrUniforms.uRain.value = postLook.rain;
          ssrUniforms.uRainTime.value = postLook.rainTime;
          // Out to about a frame height of ground (the street view's is ~630 units at zoom 1).
          ssrUniforms.uReach.value = clamp(700 / Math.max(0.2, viewZoom), 400, 2400);
          runPass(ssrMaterial, ssrTargets[0]);
          ssrBlurUniforms.tSource.value = ssrTargets[0].texture;
          ssrBlurUniforms.uDirection.value.set(0, 1.4 / ssrTargets[0].height);
          runPass(ssrBlurMaterial, ssrTargets[1]);
          postCompositeUniforms.tReflect.value = ssrTargets[1].texture;
          postCompositeUniforms.uReflect.value = postLook.reflect;
        } else if (ssrTargets.length) postCompositeUniforms.tReflect.value = ssrTargets[1].texture;
        if (bloomTargets.length) {
          bloomUniforms.uThreshold.value = postLook.bloomThreshold;
          bloomUniforms.tSource.value = sceneTarget.texture;
          bloomUniforms.uTexel.value.set(1 / postWidth, 1 / postHeight);
          runPass(bloomPrefilter, bloomTargets[0]);
          for (let i = 1; i < bloomTargets.length; i++) {
            bloomUniforms.tSource.value = bloomTargets[i - 1].texture;
            bloomUniforms.uTexel.value.set(1 / bloomTargets[i - 1].width, 1 / bloomTargets[i - 1].height);
            runPass(bloomDown, bloomTargets[i]);
          }
          renderer.autoClear = false;
          for (let i = bloomTargets.length - 1; i > 0; i--) {
            bloomUniforms.tSource.value = bloomTargets[i].texture;
            bloomUniforms.uTexel.value.set(1 / bloomTargets[i].width, 1 / bloomTargets[i].height);
            runPass(bloomUp, bloomTargets[i - 1]);
          }
          renderer.autoClear = true;
          postCompositeUniforms.tBloom.value = bloomTargets[0].texture;
        }
        postCompositeUniforms.tScene.value = sceneTarget.texture;
        postCompositeUniforms.tDepth.value = sceneTarget.depthTexture;
        postCompositeUniforms.uExposure.value = postLook.exposure;
        postCompositeUniforms.uBloomStrength.value = postLook.bloomStrength;
        postCompositeUniforms.uSaturation.value = postLook.saturation;
        postCompositeUniforms.uContrast.value = postLook.contrast;
        postCompositeUniforms.uLift.value.copy(postLook.lift);
        postCompositeUniforms.uGain.value.copy(postLook.gain);
        postCompositeUniforms.uVignette.value = postLook.vignette;
        postCompositeUniforms.uGrain.value = postLook.grain;
        postCompositeUniforms.uTime.value = gameTime;
        if (ldrTarget) {
          runPass(compositeMaterial, ldrTarget);
          fxaaUniforms.tSource.value = ldrTarget.texture;
          fxaaUniforms.uTexel.value.set(1 / postWidth, 1 / postHeight);
          runPass(fxaaMaterial, null);
        } else runPass(compositeMaterial, null);
        frameStats.totalCalls = renderer.info.render.calls;
      }
      const postSizeScratch = new Three.Vector2();
      // END SUBSYSTEM: src/postfx3d.js
