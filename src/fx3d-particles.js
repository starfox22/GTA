      // Effect particles: smoke, dust, fire, sparks, flashes, glass and drops in one instanced billboard pool, stepped
      // from a struct-of-arrays store (fxAdd), sorted back to front and drawn in one call, lit by the scene's lights.
      /**
       * FX PARTICLES (drawFxParticles, from render3d-frame.js after the vehicles are posed)
       * Every effect sprite the renderer throws (fx3d-recipes.js: blasts, muzzle flashes, bullet
       * strikes, fires, engine smoke, glass) is a slot in `fxs`, a struct of typed arrays: nothing
       * is allocated per particle or per frame. The game's own `particles` (blood mist and drops,
       * the dust that game code throws with particle()) are drawn in the same pass; the game's
       * flame particles are not (the renderer draws each fire from `fires` itself).
       *  - One InstancedBufferGeometry quad, one ShaderMaterial, one draw call for all of them
       *    (it was one Sprite, one draw call, per particle), sorted far to near each frame so the
       *    premultiplied blend (ONE, ONE_MINUS_SRC_ALPHA) composites smoke over smoke correctly;
       *    the same blend adds sparks and flashes (`glow`: light with no coverage).
       *  - LIT: a puff's atlas frame carries the normals of its billows (fx3d-atlas.js), lit by the
       *    sun (wrapped, as light soaks into a translucent volume), the hemisphere sky and ground and
       *    the fill, per pixel; light scattered forward through thin smoke when looking toward the
       *    sky's sun and up to FX_TIER_LIGHTS of the muzzle, blast and fire lights (a fire lights its
       *    own smoke at night) per corner, interpolated: smoke is soft, and a light loop in every
       *    pixel of a big cloud was most of its cost. Light values are the scene's own (sun, hemi,
       *    fill, the point lights), so smoke sits in the picture at any time of day.
       *  - FIRE: `heat` (0..1, cooling with `cool` seconds): a hot puff is a dense glowing gas that shows
       *    a black-body colour (hotter in its thick core) in place of its lit soot, so a stack of flame
       *    saturates to the fire's colour instead of adding up to white; as it cools it turns into its
       *    soot and thins to the smoke's own opacity.
       *  - SOFT: a puff fades into the ground under it (`floor`) over a quarter of its size, so it
       *    never shows the hard line where a billboard cuts the street; a particle the chase camera
       *    is inside (or nearly) fades out instead of filling the frame.
       *  - STREAKS: `streak` seconds of motion stretch a spark, an ember or a flame along its
       *    velocity as seen.
       *  - FOG: the chase view's haze (aerial-haze3d.js fog chunks) applies to the lit colour, and the
       *    emission fades with the same fog factor.
       * FX_SPRITE_ORDER, depthWrite false. fxReport() (console effectParticles()).
       */
      const FX_CAPACITY = 1024,
        FX_DRAW_CAPACITY = 1536,
        FX_SORT_SLOTS = 2048,
        FX_POINT_LIGHTS = 4,
        // The share of a recipe's particle count each tier draws (the bigger effects: blasts, fires), and how
        // many of the flash and fire lights each tier lets light the smoke (a loop at each corner).
        FX_TIER_SHARE = { LOW: 0.55, MEDIUM: 0.8, HIGH: 1, ULTRA: 1 },
        FX_TIER_LIGHTS = { LOW: 1, MEDIUM: 2, HIGH: 4, ULTRA: 4 },
        FX_FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'delay', 'size', 'grow', 'r', 'g', 'b', 'alpha', 'heat', 'cool', 'glow', 'twinkle', 'rot', 'spin', 'frame', 'floor', 'rise', 'drag', 'gravity', 'bounce', 'wind', 'streak', 'fadeIn'];
      const fxs = { n: 0, peak: 0, emitted: 0, dropped: 0, drawn: 0, legacy: 0 };
      for (const name of FX_FIELDS) fxs[name] = new Float32Array(FX_CAPACITY);
      const fxColumns = FX_FIELDS.map((name) => fxs[name]);
      let fxSeed = 0x2545f491;
      // The renderer's own random numbers (xorshift): effects never draw from the game's Math.random stream.
      function fxRandom() {
        fxSeed ^= fxSeed << 13;
        fxSeed ^= fxSeed >>> 17;
        fxSeed ^= fxSeed << 5;
        return (fxSeed >>> 0) / 4294967296;
      }
      function fxBetween(lo, hi) {
        return lo + fxRandom() * (hi - lo);
      }
      function fxTierShare() {
        return FX_TIER_SHARE[graphicsTier().name] || 0.8;
      }
      /* A particle at (x, height y, z) moving (vx, vy, vz) units a second, living `life` seconds, `size` units
         across, `color` a Three.Color (scene-linear), `alpha` its opacity. Every other field starts neutral (no
         growth, heat, glow, spin, forces; ground at 0.5): the caller sets what it needs on the returned slot.
         Returns -1 when the pool is full (the particle is dropped). */
      function fxAdd(x, y, z, vx, vy, vz, life, size, color, alpha) {
        const s = fxs;
        if (s.n >= FX_CAPACITY) {
          s.dropped++;
          return -1;
        }
        const i = s.n++;
        s.x[i] = x;
        s.y[i] = y;
        s.z[i] = z;
        s.vx[i] = vx;
        s.vy[i] = vy;
        s.vz[i] = vz;
        s.life[i] = life;
        s.max[i] = life;
        s.delay[i] = 0;
        s.size[i] = size;
        s.grow[i] = 0;
        s.r[i] = color.r;
        s.g[i] = color.g;
        s.b[i] = color.b;
        s.alpha[i] = alpha;
        s.heat[i] = 0;
        s.cool[i] = 1;
        s.glow[i] = 0;
        s.twinkle[i] = 0;
        s.rot[i] = fxRandom() * TAU;
        s.spin[i] = 0;
        s.frame[i] = 0;
        s.floor[i] = 0.5;
        s.rise[i] = 0;
        s.drag[i] = 0;
        s.gravity[i] = 0;
        s.bounce[i] = 0;
        s.wind[i] = 0;
        s.streak[i] = 0;
        s.fadeIn[i] = 0;
        s.emitted++;
        if (s.n > s.peak) s.peak = s.n;
        return i;
      }
      // ---- The pool's mesh -------------------------------------------------------------------
      const fxGeometry = new Three.InstancedBufferGeometry();
      fxGeometry.setAttribute('position', new Three.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
      fxGeometry.setIndex([0, 1, 2, 0, 2, 3]);
      const fxAttribute = (name) => {
        const attribute = new Three.InstancedBufferAttribute(new Float32Array(FX_DRAW_CAPACITY * 4), 4).setUsage(Three.DynamicDrawUsage);
        fxGeometry.setAttribute(name, attribute);
        return attribute;
      };
      const fxPosAttribute = fxAttribute('iPos'),
        fxColorAttribute = fxAttribute('iColor'),
        fxShapeAttribute = fxAttribute('iShape'),
        fxStreakAttribute = fxAttribute('iStreak'),
        fxAttributes = [fxPosAttribute, fxColorAttribute, fxShapeAttribute, fxStreakAttribute];
      fxGeometry.instanceCount = 0;
      const fxPointPos = Array.from({ length: FX_POINT_LIGHTS }, () => new Three.Vector4(0, -1e5, 0, 1)),
        fxPointColor = Array.from({ length: FX_POINT_LIGHTS }, () => new Three.Vector4(0, 0, 0, 2));
      const fxUniforms = {
        ...Three.UniformsUtils.merge([Three.UniformsLib.fog]),
        uMap: { value: fxAtlas },
        uAtlas: { value: new Three.Vector2(FX_ATLAS_COLUMNS, FX_ATLAS_ROWS) },
        uSunDir: { value: new Three.Vector3(0, 1, 0) },
        uSkySun: { value: new Three.Vector3(0, 1, 0) },
        uSunColor: { value: new Three.Color(1, 1, 1) },
        uSky: { value: new Three.Color(0.3, 0.35, 0.45) },
        uGround: { value: new Three.Color(0.15, 0.13, 0.12) },
        uFillDir: { value: new Three.Vector3(0, 1, 0) },
        uFillColor: { value: new Three.Color(0, 0, 0) },
        uPointPos: { value: fxPointPos },
        uPointColor: { value: fxPointColor },
        uPointCount: { value: 0 },
        // The scene's depth for soft edges against walls, cars and people (renderFxPass), and its texel size.
        tDepth: { value: null },
        uDepthSoft: { value: 0 },
        uDepthTexel: { value: new Three.Vector2(1, 1) },
        uNearFar: { value: new Three.Vector2(1, 1000) },
      };
      const fxMaterial = new Three.ShaderMaterial({
        uniforms: fxUniforms,
        vertexShader: `
          #include <common>
          #include <fog_pars_vertex>
          attribute vec4 iPos;     // x, height, z, size (units across)
          attribute vec4 iColor;   // scene-linear colour, opacity
          attribute vec4 iShape;   // rotation, atlas frame, heat, ground height
          attribute vec4 iStreak;  // motion streak (world units), glow gain
          uniform vec2 uAtlas;
          uniform vec4 uPointPos[ ${FX_POINT_LIGHTS} ];
          uniform vec4 uPointColor[ ${FX_POINT_LIGHTS} ];
          uniform int uPointCount;
          varying vec2 vUv;
          varying vec4 vColor;
          varying vec2 vHeatGlow;
          varying vec3 vAx;
          varying vec3 vAy;
          varying vec3 vBack;
          uniform vec3 uSkySun;
          varying float vScatter;
          varying vec3 vPoint;
          varying float vSoft;
          varying float vFade;
          varying float vViewZ;
          varying float vSoftDepth;
          void main() {
            vec3 right = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] );
            vec3 up = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] );
            vec3 back = vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] );
            float size = iPos.w, c = cos( iShape.x ), s = sin( iShape.x );
            vec3 ax = right * c + up * s, ay = up * c - right * s, centre = iPos.xyz;
            // A streak lies along the motion as the camera sees it, trailing behind the particle.
            vec3 streak = iStreak.xyz - back * dot( iStreak.xyz, back );
            float len = length( streak ), tall = size;
            if ( len > 0.05 * size ) {
              ay = streak / len;
              ax = normalize( cross( ay, back ) );
              tall = size + len;
              centre -= iStreak.xyz * 0.5;
            }
            vec3 p = centre + ax * ( position.x * size ) + ay * ( position.y * tall );
            vUv = ( vec2( mod( iShape.y, uAtlas.x ), floor( iShape.y / uAtlas.x ) ) + position.xy + 0.5 ) / uAtlas;
            vColor = iColor;
            vHeatGlow = vec2( iShape.z, iStreak.w );
            vAx = ax;
            vAy = ay;
            vBack = back;
            // Sunlight scattered forward through thin smoke when the camera looks toward the sky's sun.
            float toSun = max( dot( isOrthographic ? - back : normalize( p - cameraPosition ), uSkySun ), 0.0 ), toSun2 = toSun * toSun;
            vScatter = toSun2 * toSun2 * toSun2 * 1.6;
            // The flash and fire lights, at each corner (half way in: a light inside a puff lights its middle):
            // smoke is soft, so the light is interpolated across the quad instead of summed in every pixel.
            vec3 lit = mix( iPos.xyz, p, 0.5 );
            vPoint = vec3( 0.0 );
            for ( int k = 0; k < ${FX_POINT_LIGHTS}; k++ ) {
              if ( k >= uPointCount ) break;
              vec3 d = uPointPos[ k ].xyz - lit;
              float dist = length( d ), cut = clamp( 1.0 - pow( dist / uPointPos[ k ].w, 4.0 ), 0.0, 1.0 );
              vPoint += uPointColor[ k ].rgb * ( 0.7 * cut * cut / max( pow( dist, uPointColor[ k ].w ), 0.01 ) );
            }
            // Into the ground under it over about a quarter of its size (never a hard line in the street).
            vSoft = ( p.y - iShape.w ) / max( size * 0.26, 1.5 );
            vec4 mvPosition = viewMatrix * vec4( p, 1.0 );
            vViewZ = mvPosition.z;
            // Soft against the scene over a third of its size (half a metre to three metres).
            vSoftDepth = clamp( size * 0.33, 4.0, 24.0 );
            // A particle the lens is inside, or nearly, fades out rather than filling the frame.
            float depth = - ( viewMatrix * vec4( iPos.xyz, 1.0 ) ).z;
            vFade = isOrthographic ? 1.0 : smoothstep( 0.12 * size, 0.5 * size, depth - 4.0 );
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          #include <common>
          #include <packing>
          #include <fog_pars_fragment>
          uniform sampler2D uMap;
          uniform sampler2D tDepth;
          uniform float uDepthSoft;
          uniform vec2 uDepthTexel;
          uniform vec2 uNearFar;
          uniform vec3 uSunDir;
          uniform vec3 uSunColor;
          uniform vec3 uSky;
          uniform vec3 uGround;
          uniform vec3 uFillDir;
          uniform vec3 uFillColor;
          varying vec2 vUv;
          varying vec4 vColor;
          varying vec2 vHeatGlow;
          varying vec3 vAx;
          varying vec3 vAy;
          varying vec3 vBack;
          varying float vScatter;
          varying vec3 vPoint;
          varying float vSoft;
          varying float vFade;
          varying float vViewZ;
          varying float vSoftDepth;
          // Black body, roughly: deep red, orange, yellow, then a white-yellow core (scene-linear, HDR).
          vec3 fxFireColor( float h ) {
            vec3 c = mix( vec3( 0.5, 0.045, 0.006 ), vec3( 1.0, 0.27, 0.03 ), smoothstep( 0.0, 0.45, h ) );
            c = mix( c, vec3( 1.0, 0.6, 0.18 ), smoothstep( 0.45, 0.82, h ) );
            c = mix( c, vec3( 1.0, 0.86, 0.6 ), smoothstep( 0.86, 1.0, h ) );
            return c * ( 0.2 + 4.2 * h * h );
          }
          void main() {
            vec4 t = texture2D( uMap, vUv );
            float fade = vFade * smoothstep( 0.0, 1.0, vSoft );
            // Soft particles: thinning out as it nears whatever stands behind it (the scene's depth).
            if ( uDepthSoft > 0.5 ) {
              float d = texture2D( tDepth, gl_FragCoord.xy * uDepthTexel ).r;
              float sceneZ = isOrthographic ? orthographicDepthToViewZ( d, uNearFar.x, uNearFar.y ) : perspectiveDepthToViewZ( d, uNearFar.x, uNearFar.y );
              fade *= smoothstep( 0.0, 1.0, ( vViewZ - sceneZ ) / vSoftDepth );
            }
            float a = t.a * vColor.a * fade;
            // Glow (sparks, flashes) is light added with no coverage.
            vec3 emit = vColor.rgb * ( vHeatGlow.y * t.a * fade );
            if ( a < 0.002 && max( emit.r, max( emit.g, emit.b ) ) < 0.002 ) discard;
            vec2 nxy = t.rg * 2.0 - 1.0;
            vec3 n = normalize( vAx * nxy.x + vAy * nxy.y + vBack * sqrt( max( 1.0 - dot( nxy, nxy ), 0.0 ) ) );
            // A translucent volume: wrapped sunlight, the sky above and the ground below, the fill, the flash and
            // fire lights (per corner), and the sun through its thin parts.
            vec3 light = uSunColor * ( clamp( ( dot( n, uSunDir ) + 0.6 ) / 1.6, 0.0, 1.0 ) + vScatter * ( 1.0 - t.b ) ) + mix( uGround, uSky, n.y * 0.5 + 0.5 ) + uFillColor * clamp( ( dot( n, uFillDir ) + 0.6 ) / 1.6, 0.0, 1.0 ) + vPoint;
            // Fire is an opaque glowing gas: a hot puff shows the black-body colour (hotter in its thick core,
            // brightest where a billow faces the camera) in place of its lit soot, and turns to soot as it cools.
            vec3 surface = vColor.rgb * light;
            if ( vHeatGlow.x > 0.0 ) surface = mix( surface, fxFireColor( vHeatGlow.x * ( 0.5 + 0.5 * smoothstep( 0.05, 0.85, t.b ) ) ) * ( 0.5 + 0.5 * dot( n, vBack ) ), smoothstep( 0.0, 0.3, vHeatGlow.x ) );
            vec4 glow = vec4( emit, 1.0 );
            #if defined( TONE_MAPPING )
              glow.rgb = toneMapping( glow.rgb );
            #endif
            glow = linearToOutputTexel( glow );
            gl_FragColor = vec4( surface, 1.0 );
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
            #ifdef USE_FOG
              glow.rgb *= 1.0 - fogFactor;
            #endif
            gl_FragColor = vec4( gl_FragColor.rgb * a + glow.rgb, a );
          }`,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        fog: true,
      });
      const fxMesh = new Three.Mesh(fxGeometry, fxMaterial);
      fxMesh.frustumCulled = false;
      fxMesh.renderOrder = FX_SPRITE_ORDER;
      fxMesh.name = 'effect particles';
      fxMesh.userData.dynamic = true;
      fxMesh.visible = false;
      // Drawn in a pass of its own over the finished scene (renderFxPass, from postfx3d.js renderFrame).
      const fxScene = new Three.Scene(),
        fxNoDepth = new Three.DataTexture(new Uint8Array(4), 1, 1);
      fxNoDepth.needsUpdate = true;
      renderer.initTexture(fxNoDepth);
      fxUniforms.tDepth.value = fxNoDepth;
      fxScene.add(fxMesh);
      fxScene.fog = scene.fog;
      registerPrewarmPass(fxScene, streetCamera, () => (hdrCapable && postTier ? postSceneTarget() : 'canvas'));
      /**
       * FX PASS: the pool is drawn after the scene, into the same target with its depth (no clear), so it is
       * depth-tested as before. Where the target is multisampled (HIGH, ULTRA) the scene's depth texture is the
       * resolved copy, not the attachment being drawn into, so the shader can read it: a puff thins out over
       * a third of its size as it nears a wall, a car or a person behind it (soft particles). Elsewhere the
       * depth texture is the attachment itself (reading it would be a feedback loop): the ground fade only.
       */
      function renderFxPass(depthTexture, width, height) {
        if (!fxMesh.visible) return;
        const u = fxUniforms;
        u.tDepth.value = depthTexture || fxNoDepth;
        u.uDepthSoft.value = depthTexture ? 1 : 0;
        u.uDepthTexel.value.set(1 / width, 1 / height);
        u.uNearFar.value.set(camera.near, camera.far);
        if (fxScene.fog !== scene.fog) fxScene.fog = scene.fog;
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(fxScene, camera);
        renderer.autoClear = autoClear;
      }
      // Staging (16 floats a particle, unsorted) and the sort keys: depth bucket * FX_SORT_SLOTS + index, with
      // fixed-size views so a frame sorts only what it draws (no subarray per frame).
      const fxStage = new Float32Array(FX_DRAW_CAPACITY * 16),
        fxKeys = new Float64Array(FX_SORT_SLOTS),
        fxKeyViews = [32, 64, 128, 256, 512, 1024, FX_SORT_SLOTS].map((n) => fxKeys.subarray(0, n));
      let fxLightSources = null,
        // One invisible quad is drawn while this is set (at start-up and when the atlas is done): the buffers,
        // the program and the baked atlas go to the GPU in a frame of their own, not with the first blast.
        fxWarmPending = true,
        fxLastDrawAt = 0;
      // Swap-remove: the last live slot moves into slot i.
      function fxRemove(i, last) {
        for (let k = 0; k < fxColumns.length; k++) fxColumns[k][i] = fxColumns[k][last];
      }
      function fxStep(dt) {
        const s = fxs,
          breeze = (0.4 + 3.5 * (weather.wind || 0)) * UNITS_PER_METRE,
          windX = Math.cos(weather.windAngle || 0) * breeze,
          windZ = Math.sin(weather.windAngle || 0) * breeze;
        let n = s.n;
        for (let i = n - 1; i >= 0; i--) {
          if (s.delay[i] > 0) {
            s.delay[i] -= dt;
            continue;
          }
          const life = s.life[i] - dt;
          if (life <= 0) {
            n--;
            if (i !== n) fxRemove(i, n);
            continue;
          }
          s.life[i] = life;
          const drag = s.drag[i];
          if (drag > 0) {
            const k = Math.exp(-drag * dt),
              wx = windX * s.wind[i],
              wz = windZ * s.wind[i];
            s.vx[i] = wx + (s.vx[i] - wx) * k;
            s.vz[i] = wz + (s.vz[i] - wz) * k;
            s.vy[i] *= k;
          }
          s.vy[i] += (s.rise[i] - s.gravity[i]) * dt;
          s.x[i] += s.vx[i] * dt;
          s.y[i] += s.vy[i] * dt;
          s.z[i] += s.vz[i] * dt;
          s.rot[i] += s.spin[i] * dt;
          const floor = s.floor[i];
          if (s.y[i] < floor) {
            s.y[i] = floor;
            if (s.gravity[i] > 0) {
              // A bit that lands bounces once or twice, then lies a moment before it fades.
              const bounce = s.vy[i] < -12 && s.bounce[i] > 0;
              s.vy[i] = bounce ? -s.vy[i] * s.bounce[i] : 0;
              s.vx[i] *= bounce ? 0.55 : 0.6;
              s.vz[i] *= bounce ? 0.55 : 0.6;
            } else if (s.vy[i] < 0) s.vy[i] = 0;
          }
        }
        s.n = n;
      }
      // One particle's draw record into the staging buffer at slot `o`, and its sort key.
      function fxStageOne(o, depth, x, y, z, size, r, g, b, alpha, rot, frame, heat, floor, sx, sy, sz, glow) {
        const p = o * 16;
        fxStage[p] = x;
        fxStage[p + 1] = y;
        fxStage[p + 2] = z;
        fxStage[p + 3] = size;
        fxStage[p + 4] = r;
        fxStage[p + 5] = g;
        fxStage[p + 6] = b;
        fxStage[p + 7] = alpha;
        fxStage[p + 8] = rot;
        fxStage[p + 9] = frame;
        fxStage[p + 10] = heat;
        fxStage[p + 11] = floor;
        fxStage[p + 12] = sx;
        fxStage[p + 13] = sy;
        fxStage[p + 14] = sz;
        fxStage[p + 15] = glow;
        // Far first: the bucket counts down with depth (1/8 unit steps), the slot breaks ties.
        fxKeys[o] = Math.floor(Math.max(0, 1048576 - depth * 8)) * FX_SORT_SLOTS + o;
      }
      // The muzzle, blast and fire lights that light the smoke this frame (up to FX_POINT_LIGHTS, brightest first
      // as listed: the flash, a burning car, the ground fires).
      function fxPointLights() {
        if (!fxLightSources) fxLightSources = [muzzleLight, carFireLight, ...fireLights];
        const cap = Math.min(FX_POINT_LIGHTS, FX_TIER_LIGHTS[graphicsTier().name] ?? 2);
        let count = 0;
        for (let k = 0; k < fxLightSources.length && count < cap; k++) {
          const light = fxLightSources[k];
          if (!(light.intensity > 0)) continue;
          const scale = light.intensity / Math.PI;
          fxPointPos[count].set(light.position.x, light.position.y, light.position.z, light.distance || 200);
          fxPointColor[count].set(light.color.r * scale, light.color.g * scale, light.color.b * scale, light.decay);
          count++;
        }
        fxUniforms.uPointCount.value = count;
      }
      function fxLightUniforms() {
        const u = fxUniforms,
          inv = 1 / Math.PI;
        // The light's sun (above ~15 degrees) for the shading, the sky's own sun for the glow through thin smoke.
        u.uSunDir.value.copy(sunDirection);
        u.uSkySun.value.copy(skySunDirection);
        u.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity * inv);
        u.uSky.value.copy(hemi.color).multiplyScalar(hemi.intensity * inv);
        u.uGround.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity * inv);
        u.uFillDir.value.copy(fill.position).normalize();
        u.uFillColor.value.copy(fill.color).multiplyScalar(fill.intensity * inv);
        fxPointLights();
      }
      /* Steps the store and draws it with the game's particles: from render3d-frame.js once a frame. */
      function drawFxParticles(deltaSeconds) {
        const s = fxs;
        // The atlas bakes a slice a frame (fx3d-atlas.js): a few per cent of the frame's own time, more behind
        // the title (a slow software renderer bakes it in a few frames, a fast GPU over a second or two).
        if (fxAtlasBake) {
          const now = performance.now(),
            gap = fxLastDrawAt ? now - fxLastDrawAt : 16;
          fxLastDrawAt = now;
          if (fxAtlasStep(clamp(gap * (gameMode === 'menu' ? 0.25 : 0.06), gameMode === 'menu' ? 4 : 1.5, 60))) fxWarmPending = true;
        }
        if (deltaSeconds > 0) fxStep(deltaSeconds);
        const e = camera.matrixWorld.elements,
          cx = e[12],
          cy = e[13],
          cz = e[14],
          fx = -e[8],
          fy = -e[9],
          fz = -e[10];
        let count = 0;
        for (let i = 0; i < s.n && count < FX_DRAW_CAPACITY; i++) {
          if (s.delay[i] > 0) continue;
          const x = s.x[i],
            y = s.y[i],
            z = s.z[i],
            depth = (x - cx) * fx + (y - cy) * fy + (z - cz) * fz,
            t = 1 - s.life[i] / s.max[i],
            size = s.size[i] * (1 + s.grow[i] * (1 - (1 - t) * (1 - t)));
          if (depth < -size) continue;
          let fade = 1 - t * t;
          const fadeIn = s.fadeIn[i];
          if (fadeIn > 0 && t < fadeIn) fade *= t / fadeIn;
          let heat = s.heat[i],
            alpha = s.alpha[i];
          if (heat > 0) {
            heat *= Math.exp(-(s.max[i] - s.life[i]) / s.cool[i]);
            // Flame is dense: it thins to the smoke's own opacity as it cools.
            const hot = heat > 0.34 ? 1 : heat * 2.94;
            alpha += (0.86 - alpha) * hot;
          }
          alpha *= fade;
          let glow = s.glow[i] * fade;
          if (s.twinkle[i] > 0) {
            const wink = Math.max(0, Math.sin((s.max[i] - s.life[i]) * 23 + s.rot[i] * 5));
            glow += s.twinkle[i] * wink * wink * wink * wink * fade;
          }
          const streak = s.streak[i];
          fxStageOne(count++, depth, x, y, z, size, s.r[i], s.g[i], s.b[i], alpha, s.rot[i], s.frame[i], heat, s.floor[i], s.vx[i] * streak, s.vy[i] * streak, s.vz[i] * streak, glow);
        }
        // The game's particles: blood mist and drops, and the dust game code throws (particle()). Left out: a
        // fire's flame particles (the renderer draws each fire itself, fx3d-recipes.js fxGroundFire) and the 2D
        // view's stand-ins for what the recipes draw (`standIn`: muzzle flashes, strikes, blasts, rocket trails).
        let legacy = 0;
        for (let i = 0; i < particles.length && count < FX_DRAW_CAPACITY; i++) {
          const p = particles[i];
          if (p.flame || p.standIn) continue;
          const share = clamp(p.life / p.max, 0, 1),
            x = p.x,
            z = p.y,
            // (A stable per-particle twist and frame from its random size: it has no id.)
            twist = p.size * 1234.567,
            ground = p.surface ?? 0.3;
          let y, size, alpha, frame;
          if (p.blood) {
            y = Math.max(0.3, p.z);
            size = p.size * 1.35;
            alpha = 0.97;
            frame = FX_DROP;
          } else if (p.mist) {
            y = Math.max(0.3, p.z);
            size = p.size * (1.6 + (1 - share) * 2.2);
            alpha = share * 0.45;
            frame = Math.floor((twist % 1) * FX_PUFF_FRAMES);
          } else {
            y = 2 + (1 - share) * 13;
            size = p.size * 1.6;
            alpha = Math.min(share, 0.7) * 0.85;
            frame = Math.floor((twist % 1) * FX_PUFF_FRAMES);
          }
          const depth = (x - cx) * fx + (y - cy) * fy + (z - cz) * fz;
          if (depth < -size) continue;
          const color = cachedColor(p.color);
          fxStageOne(count++, depth, x, y, z, size, color.r, color.g, color.b, alpha, twist % TAU, frame, 0, p.blood ? -1e5 : ground, 0, 0, 0, 0);
          legacy++;
        }
        if (fxWarmPending && count === 0) {
          fxStageOne(count++, 0, cx, cy - 1e4, cz, 0, 0, 0, 0, 0, 0, 0, 0, -1e5, 0, 0, 0, 0);
          fxWarmPending = false;
        }
        s.drawn = count;
        s.legacy = legacy;
        fxMesh.visible = count > 0;
        fxGeometry.instanceCount = count;
        if (!count) return;
        fxLightUniforms();
        // Sort the keys (far first) in the smallest fixed view that holds them; the rest of it reads +Infinity.
        let view = fxKeyViews[fxKeyViews.length - 1];
        for (let k = 0; k < fxKeyViews.length; k++)
          if (fxKeyViews[k].length >= count) {
            view = fxKeyViews[k];
            break;
          }
        view.fill(Infinity, count);
        view.sort();
        const P = fxPosAttribute.array,
          C = fxColorAttribute.array,
          H = fxShapeAttribute.array,
          T = fxStreakAttribute.array;
        for (let k = 0; k < count; k++) {
          const key = view[k],
            o = key - Math.floor(key / FX_SORT_SLOTS) * FX_SORT_SLOTS,
            src = o * 16,
            dst = k * 4;
          P[dst] = fxStage[src];
          P[dst + 1] = fxStage[src + 1];
          P[dst + 2] = fxStage[src + 2];
          P[dst + 3] = fxStage[src + 3];
          C[dst] = fxStage[src + 4];
          C[dst + 1] = fxStage[src + 5];
          C[dst + 2] = fxStage[src + 6];
          C[dst + 3] = fxStage[src + 7];
          H[dst] = fxStage[src + 8];
          H[dst + 1] = fxStage[src + 9];
          H[dst + 2] = fxStage[src + 10];
          H[dst + 3] = fxStage[src + 11];
          T[dst] = fxStage[src + 12];
          T[dst + 1] = fxStage[src + 13];
          T[dst + 2] = fxStage[src + 14];
          T[dst + 3] = fxStage[src + 15];
        }
        for (let k = 0; k < fxAttributes.length; k++) {
          const attribute = fxAttributes[k];
          attribute.clearUpdateRanges();
          attribute.addUpdateRange(0, count * 4);
          attribute.needsUpdate = true;
        }
      }
      /* DeadEndCity.effectParticles(): the pool now (live, waiting on a delay, drawn last frame, of them the
         game's particles), its capacity, the peak, emitted since boot and dropped for want of room, and the tier's
         share of the big recipes. */
      function fxReport() {
        let waiting = 0;
        for (let i = 0; i < fxs.n; i++) if (fxs.delay[i] > 0) waiting++;
        return {
          live: fxs.n,
          waiting,
          drawn: fxs.drawn,
          game: fxs.legacy,
          capacity: FX_CAPACITY,
          drawCapacity: FX_DRAW_CAPACITY,
          peak: fxs.peak,
          emitted: fxs.emitted,
          dropped: fxs.dropped,
          tierShare: fxTierShare(),
          drawCalls: fxMesh.visible ? 1 : 0,
          atlas: { baked: !fxAtlasBake, ms: Math.round(fxAtlasBakeMs * 10) / 10 },
          // Seconds since the last blast (fx3d-recipes.js), null before one.
          blastAge: fxBlast.born < 0 ? null : Math.round((gameTime - fxBlast.born) * 100) / 100,
        };
      }
