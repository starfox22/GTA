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
       *     │  └──> bloom: bright-pass, then a mip chain down and back up
       *     └──> composite: AO, bloom, exposure, ACES filmic tone curve, colour
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
        postWidth = 0,
        postHeight = 0,
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
       * Scalable Ambient Obscurance (McGuire et al. 2012) on the depth buffer: view
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
            float depth = texture2D( tDepth, vUv ).x;
            if ( depth >= 0.99999 ) { gl_FragColor = vec4( 1.0 ); return; }
            vec3 P = cityViewPosition( vUv );
            // Normal from the flatter of the two neighbours on each axis, so an
            // edge pixel takes the surface it belongs to rather than the step.
            vec3 px0 = cityViewPosition( vUv - vec2( uDepthTexel.x, 0.0 ) ), px1 = cityViewPosition( vUv + vec2( uDepthTexel.x, 0.0 ) );
            vec3 py0 = cityViewPosition( vUv - vec2( 0.0, uDepthTexel.y ) ), py1 = cityViewPosition( vUv + vec2( 0.0, uDepthTexel.y ) );
            vec3 dx = abs( px1.z - P.z ) < abs( P.z - px0.z ) ? px1 - P : P - px0;
            vec3 dy = abs( py1.z - P.z ) < abs( P.z - py0.z ) ? py1 - P : P - py0;
            vec3 N = normalize( cross( dx, dy ) );
            // The sampling disc: uRadius world units, in texture coordinates.
            float scale = uPerspective > 0.5 ? 1.0 / max( -P.z, 1.0 ) : 1.0;
            vec2 discUv = vec2( uProjection[0][0], uProjection[1][1] ) * 0.5 * uRadius * scale;
            // Interleaved gradient noise rotates the spiral per pixel; the blur removes it.
            float spin = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
            float radius2 = uRadius * uRadius, sum = 0.0;
            for ( int i = 0; i < AO_SAMPLES; i++ ) {
              float t = ( float( i ) + 0.5 ) / float( AO_SAMPLES );
              float angle = t * 43.98 + spin; // seven turns of the spiral
              vec2 offset = vec2( cos( angle ), sin( angle ) ) * t * discUv;
              vec3 v = cityViewPosition( vUv + offset ) - P;
              float vv = dot( v, v ), vn = dot( v, N );
              float f = max( radius2 - vv, 0.0 );
              sum += f * f * f * max( ( vn - 0.02 * uRadius ) / ( 0.01 * radius2 + vv ), 0.0 );
            }
            float ao = max( 0.0, 1.0 - sum * uIntensity * 5.0 / ( radius2 * radius2 * radius2 * float( AO_SAMPLES ) ) );
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
      };
      const aoBlurMaterial = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tAo;
        uniform vec2 uDirection;
        uniform float uRadius;
        ${AO_COMMON}
        void main() {
          float centreZ = cityViewZ( texture2D( tDepth, vUv ).x );
          float total = 0.0, weights = 0.0;
          for ( int i = -3; i <= 3; i++ ) {
            vec2 uv = vUv + uDirection * float( i );
            float z = cityViewZ( texture2D( tDepth, uv ).x );
            float w = ( 1.0 - abs( float( i ) ) / 4.0 ) * max( 0.0, 1.0 - abs( z - centreZ ) / ( uRadius * 0.6 ) );
            total += texture2D( tAo, uv ).r * w;
            weights += w;
          }
          gl_FragColor = vec4( total / max( weights, 1e-4 ), 0.0, 0.0, 1.0 );
        }`,
        aoBlurUniforms,
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
      const bloomPrefilter = postMaterial(
        `
        varying vec2 vUv;
        uniform sampler2D tSource;
        uniform vec2 uTexel;
        uniform float uThreshold;
        uniform float uKnee;
        void main() {
          vec3 c = ( texture2D( tSource, vUv + uTexel * vec2( -0.5, -0.5 ) ).rgb + texture2D( tSource, vUv + uTexel * vec2( 0.5, -0.5 ) ).rgb
                   + texture2D( tSource, vUv + uTexel * vec2( -0.5, 0.5 ) ).rgb + texture2D( tSource, vUv + uTexel * vec2( 0.5, 0.5 ) ).rgb ) * 0.25;
          c = min( c, vec3( 64.0 ) );
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
        tAo: { value: null },
        tBloom: { value: null },
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
      };
      function makeCompositeMaterial(tier) {
        return postMaterial(
          `
          varying vec2 vUv;
          uniform sampler2D tScene;
          uniform sampler2D tAo;
          uniform sampler2D tBloom;
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
            #ifdef USE_AO
              float ao = texture2D( tAo, vUv ).r;
              float lum = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
              color *= mix( 1.0, ao, uAoStrength * ( 1.0 - smoothstep( 1.2, 4.0, lum ) ) );
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
            color = cityLinearToSRGB( clamp( color, 0.0, 1.0 ) );
            // Dither (and, when graded, a whisper of film grain) against banding.
            float n = fract( sin( dot( gl_FragCoord.xy + fract( uTime ) * 61.0, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
            color += ( n - 0.5 ) * ( 1.5 / 255.0 + uGrain );
            gl_FragColor = vec4( color, 1.0 );
          }`,
          postCompositeUniforms,
          Object.assign(
            {},
            tier.ao ? { USE_AO: 1 } : {},
            tier.bloom ? { USE_BLOOM: 1 } : {},
            tier.grade ? { USE_GRADE: 1 } : {},
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
          width = Math.max(1, Math.floor(size.x)),
          height = Math.max(1, Math.floor(size.y)),
          tier = postTier;
        if (!tier) return;
        postWidth = width;
        postHeight = height;
        buildSceneTarget(width, height, tier.msaa);
        disposeTargets(aoTargets);
        if (tier.ao) {
          const w = Math.max(1, width >> 1),
            h = Math.max(1, height >> 1);
          aoTargets.push(colorTarget(w, h, Three.UnsignedByteType), colorTarget(w, h, Three.UnsignedByteType));
        }
        disposeTargets(bloomTargets);
        for (let i = 0, w = width >> 1, h = height >> 1; i < tier.bloom && w >= 4 && h >= 4; i++, w >>= 1, h >>= 1)
          bloomTargets.push(colorTarget(w, h));
        if (ldrTarget) ldrTarget.dispose();
        ldrTarget = tier.msaa ? null : colorTarget(width, height, Three.UnsignedByteType);
        postCompositeUniforms.uAspect.value = width / height;
      }
      function setPostQuality(tier) {
        postTier = tier;
        if (aoMaterial) aoMaterial.dispose();
        aoMaterial = tier.ao ? makeAoMaterial(tier.ao) : null;
        if (compositeMaterial) compositeMaterial.dispose();
        compositeMaterial = makeCompositeMaterial(tier);
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
      };
      // Draws the frame: the whole pipeline, or straight to the canvas without HDR.
      // Draw calls and triangles of the scene pass (shadow map included when it was
      // refreshed this frame) and of the whole frame, for DeadEndCity.stats().
      const frameStats = { sceneCalls: 0, sceneTriangles: 0, shadowFrame: false, totalCalls: 0 };
      renderer.info.autoReset = false;
      function renderFrame() {
        // Crowd impostors placed during this frame's people pass (flight-view3d.js).
        endPersonImpostors();
        renderer.info.reset();
        frameStats.shadowFrame = renderer.shadowMap.needsUpdate;
        if (!hdrCapable || !postTier) {
          renderer.toneMappingExposure = postLook.exposure;
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
          frameStats.sceneCalls = frameStats.totalCalls = renderer.info.render.calls;
          frameStats.sceneTriangles = renderer.info.render.triangles;
          return;
        }
        const size = renderer.getDrawingBufferSize(postSizeScratch);
        if (size.x !== postWidth || size.y !== postHeight) sizePostTargets();
        renderer.setRenderTarget(sceneTarget);
        renderer.render(scene, camera);
        frameStats.sceneCalls = renderer.info.render.calls;
        frameStats.sceneTriangles = renderer.info.render.triangles;
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
