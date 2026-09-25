      // BEGIN SUBSYSTEM: src/searchlight3d.js — Searchlights: light shafts, ground pools, the helicopter's spot
      /**
       * Searchlights: light shafts, ground pools and the police helicopter's spot
       * Source: src/searchlight3d.js
       * Scope: createCityRenderer() closure (included after lighting3d.js, before the
       * city is built; base3d.js and harbor3d.js use it).
       *
       *  - LIGHT SHAFT (createSearchBeam): a volumetric cone. Each fragment of the
       *    cone's front face marches the view ray through the cone (the exit is
       *    solved analytically) and sums in-scattered light: a soft radial profile
       *    with a hotter core, brighter towards the lamp, forward scattering (a
       *    beam aimed towards the camera glows), drifting dust or haze noise, and a
       *    fade into the ground plane, so the shaft never ends in a hard ellipse.
       *    Additive and HDR, so bloom catches the bright end. The helicopter's
       *    shaft also thins out over its last stretch and leaves clear air round
       *    the lit target, so it never lies over the player as a white veil.
       *  - GROUND POOL: the helicopter's spot is a real SpotLight with a cookie
       *    (hot centre, even plateau, crisp edge with a narrow penumbra) that
       *    lights the ground, cars, facades and the player through their own
       *    materials, exposed so pale paving does not clip, and casts shadows on
       *    HIGH/ULTRA (HELICOPTER SEARCHLIGHT LOOK below). The watch towers use a
       *    softer cookie decal on the ground (eight real lights would cost every
       *    material in the city).
       *  - RAIN IN THE BEAM: a few hundred streaks that live inside the cone and
       *    are lit by it, animated on the GPU.
       *  - THE HELICOPTER'S CREW (updateHelicopterSearchlight): the aim lags a
       *    little behind a fast target, sways with the operator's hand and buzzes
       *    with the airframe, sweeps a search pattern round the last sighting when
       *    the player is hidden, and snaps on (with a flare) when it finds them
       *    again. The lens flares when it looks towards the camera.
       */
      // ---- Shared shader pieces ---------------------------------------------------------
      // Beam frame: the cone's virtual apex (where its sides meet, behind the lens),
      // the axis and the tangent of its half angle; `r0` is the lens radius.
      const SEARCH_BEAM_COMMON = `
        uniform vec3 uApex;
        uniform vec3 uAxis;
        uniform float uLength;
        uniform float uRadius0;
        uniform float uTan;
        vec3 beamVirtualApex() { return uApex - uAxis * ( uRadius0 / uTan ); }
        void beamBasis( out vec3 u, out vec3 v ) {
          vec3 up = abs( uAxis.y ) < 0.98 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
          u = normalize( cross( uAxis, up ) );
          v = cross( uAxis, u );
        }
        // Normalised radius (0 on the axis, 1 on the cone's side) and distance along
        // the beam from the lens (0) to the end (1) of a world point.
        vec2 beamCoords( vec3 p ) {
          vec3 w = p - beamVirtualApex();
          float h = dot( w, uAxis );
          float radial = length( w - uAxis * h ) / max( h * uTan, 0.001 );
          return vec2( radial, ( h - uRadius0 / uTan ) / uLength );
        }`;
      const SEARCH_BEAM_VERTEX = `
        ${SEARCH_BEAM_COMMON}
        varying vec3 vWorld;
        void main() {
          vec3 u, v;
          beamBasis( u, v );
          // position: (cos, along 0..1, sin) of the unit cone.
          float along = position.y * uLength;
          float radius = ( uRadius0 + along * uTan ) * 1.015;
          vec3 world = uApex + uAxis * along + ( u * position.x + v * position.z ) * radius;
          vWorld = world;
          gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
        }`;
      const SEARCH_BEAM_FRAGMENT = `
        ${SEARCH_BEAM_COMMON}
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uNorm;
        uniform float uGroundY;
        uniform float uTime;
        uniform float uNoise;
        uniform vec3 uDrift;
        uniform vec3 uTarget;
        uniform float uClear;
        uniform float uTail;
        uniform float uCap;
        varying vec3 vWorld;
        float beamHash( vec3 p ) {
          p = fract( p * 0.3183099 + 0.1 );
          p *= 17.0;
          return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
        }
        float beamNoise( vec3 x ) {
          vec3 i = floor( x ), f = fract( x );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix(
            mix( mix( beamHash( i ), beamHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
                 mix( beamHash( i + vec3( 0.0, 1.0, 0.0 ) ), beamHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
            mix( mix( beamHash( i + vec3( 0.0, 0.0, 1.0 ) ), beamHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
                 mix( beamHash( i + vec3( 0.0, 1.0, 1.0 ) ), beamHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
        }
        void main() {
          // The view ray through this point of the cone's front face.
          vec3 forward = -vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] );
          vec3 dir = isOrthographic ? forward : normalize( vWorld - cameraPosition );
          // Where it leaves the cone: |w + t d|^2 = k (w.a + t d.a)^2, one root ~0.
          float k = 1.0 + uTan * uTan;
          vec3 w0 = vWorld - beamVirtualApex();
          float da = dot( dir, uAxis ), wa = dot( w0, uAxis );
          float qa = 1.0 - k * da * da,
            qb = 2.0 * ( dot( w0, dir ) - k * da * wa ),
            qc = dot( w0, w0 ) - k * wa * wa;
          float exitT = 1e5;
          if ( abs( qa ) < 1e-5 ) {
            if ( abs( qb ) > 1e-5 && -qc / qb > 0.0 ) exitT = -qc / qb;
          } else {
            float disc = qb * qb - 4.0 * qa * qc;
            if ( disc < 0.0 ) discard;
            float s = sqrt( disc ),
              t1 = ( -qb - s ) / ( 2.0 * qa ),
              t2 = ( -qb + s ) / ( 2.0 * qa ),
              far = abs( t1 ) > abs( t2 ) ? t1 : t2;
            // Only a root on the forward nappe ends the path; otherwise the ray stays
            // inside until the end caps or the ground cut it.
            if ( far > 0.0 && wa + far * da > 0.0 ) exitT = far;
          }
          // Clip between the lens and the far end, and above the ground.
          float h0 = uRadius0 / uTan, h1 = h0 + uLength;
          float t0 = 0.0, t1 = exitT;
          if ( abs( da ) > 1e-5 ) {
            float ta = ( h0 - wa ) / da, tb = ( h1 - wa ) / da;
            t0 = max( t0, min( ta, tb ) );
            t1 = min( t1, max( ta, tb ) );
          }
          if ( dir.y < 0.0 ) t1 = min( t1, ( uGroundY - vWorld.y ) / dir.y );
          if ( t1 <= t0 ) discard;
          // March it, jittered per pixel so the steps do not band.
          float dt = ( t1 - t0 ) / float( BEAM_STEPS );
          float jitter = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
          const float g = 0.3;
          float hg90 = ( 1.0 - g * g ) / pow( 1.0 + g * g, 1.5 );
          float sum = 0.0;
          for ( int i = 0; i < BEAM_STEPS; i++ ) {
            vec3 p = vWorld + dir * ( t0 + ( float( i ) + jitter ) * dt );
            vec2 bc = beamCoords( p );
            float radial = bc.x;
            if ( radial >= 1.0 ) continue;
            float edge = 1.0 - smoothstep( 0.62, 1.0, radial );
            float profile = exp( -3.2 * radial * radial ) * edge + 1.3 * exp( -26.0 * radial * radial );
            // The light spreads out along the beam: denser near the lens.
            float spread = uRadius0 + bc.y * uLength * uTan;
            float along = pow( clamp( ( uRadius0 + uLength * uTan ) / spread, 1.0, 10.0 ), 1.1 );
            // Forward scattering (Henyey-Greenstein), half isotropic.
            float c = dot( normalize( p - uApex ), -dir );
            float phase = mix( 1.0, ( 1.0 - g * g ) / pow( 1.0 + g * g - 2.0 * g * c, 1.5 ) / hg90, 0.55 );
            // Soft landing: the shaft thins into the ground where the pool takes over.
            float ground = 0.18 + 0.82 * smoothstep( 0.0, 22.0, p.y - uGroundY );
            // Clear air round the target (the helicopter's beam): the last stretch of
            // the shaft thins out (uTail of it gone by the ground) and nothing is left
            // within ~uClear of the lit point, so the haze never lies over what the
            // pool lights. The march cannot read the depth buffer it is drawn into;
            // this keeps everything standing in the pool (people, cars) out of it.
            float tail = 1.0 - uTail * smoothstep( 0.45, 1.0, bc.y );
            float clearing = uClear > 0.0 ? smoothstep( uClear * 0.6, uClear * 1.7, length( p - uTarget ) ) : 1.0;
            float density = profile * along * phase * ground * tail * clearing;
            #ifdef BEAM_NOISE
              // Slow billows of haze with finer dust through them.
              vec3 q = p * 0.021 + uDrift;
              float n = beamNoise( q ) * 0.6 + beamNoise( q * 3.1 + 11.0 ) * 0.4;
              density *= mix( 1.0, 2.6 * n * n, uNoise );
            #endif
            sum += density;
          }
          // Soft shoulder: looking down the length of the beam saturates (at uCap)
          // instead of blowing out into a solid column.
          float light = uIntensity * sum * dt * uNorm;
          light = light / ( 1.0 + light / uCap );
          gl_FragColor = vec4( uColor * light, 1.0 );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`;
      // One unit cone (apex ring at y 0, far ring at y 1), shared by every beam.
      const searchBeamGeometry = (() => {
        const segments = 28,
          positions = [],
          index = [];
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * TAU;
          positions.push(Math.cos(a), 0, Math.sin(a), Math.cos(a), 1, Math.sin(a));
        }
        for (let i = 0; i < segments; i++) {
          const a = i * 2;
          index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geometry.setIndex(index);
        return geometry;
      })();
      // March steps per quality tier (setSearchlightQuality).
      let searchBeamSteps = 8,
        searchBeamNoise = false;
      const searchBeams = [];
      /**
       * A light shaft. `set(apex, target, endRadius, lensRadius)` aims it; the
       * cone runs a little past the target so the ground plane (uGroundY), not
       * the mesh, ends it.
       */
      function createSearchBeam(color) {
        const uniforms = {
          uApex: { value: new Three.Vector3() },
          uAxis: { value: new Three.Vector3(0, -1, 0) },
          uLength: { value: 1 },
          uRadius0: { value: 1 },
          uTan: { value: 0.1 },
          uColor: { value: new Three.Color(color) },
          uIntensity: { value: 0 },
          uNorm: { value: 0.01 },
          uGroundY: { value: 0 },
          uTime: { value: 0 },
          uNoise: { value: 1 },
          uDrift: { value: new Three.Vector3() },
          // Target clearing, tail fade and shoulder (the helicopter sets them; a
          // watch tower keeps these: no clearing, the old 2.2 shoulder).
          uTarget: { value: new Three.Vector3() },
          uClear: { value: 0 },
          uTail: { value: 0 },
          uCap: { value: 2.2 },
        };
        const material = new Three.ShaderMaterial({
          uniforms,
          vertexShader: SEARCH_BEAM_VERTEX,
          fragmentShader: SEARCH_BEAM_FRAGMENT,
          defines: searchBeamDefines(),
          transparent: true,
          depthWrite: false,
          blending: Three.AdditiveBlending,
          fog: false,
        });
        const mesh = new Three.Mesh(searchBeamGeometry, material);
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.renderOrder = 5;
        mesh.userData.dynamic = true;
        scene.add(mesh);
        const beam = {
          mesh,
          uniforms,
          set(apex, target, endRadius, lensRadius, groundY) {
            const axis = uniforms.uAxis.value.copy(target).sub(apex),
              distance = Math.max(1, axis.length());
            axis.divideScalar(distance);
            uniforms.uApex.value.copy(apex);
            uniforms.uRadius0.value = lensRadius;
            // Run on past the target; the ground plane cuts it softly.
            uniforms.uLength.value = distance * 1.12;
            uniforms.uTan.value = Math.max(0.01, (endRadius - lensRadius) / distance);
            uniforms.uNorm.value = 1 / (2 * endRadius);
            uniforms.uGroundY.value = groundY;
            uniforms.uTime.value = gameTime;
            // Dust drifts with the wind and billows slowly.
            const drift = gameTime * (4 + weather.wind * 10) * 0.034;
            uniforms.uDrift.value.set(Math.cos(weather.windAngle) * drift, gameTime * 0.05, Math.sin(weather.windAngle) * drift);
          },
        };
        searchBeams.push(beam);
        return beam;
      }
      function searchBeamDefines() {
        const defines = { BEAM_STEPS: searchBeamSteps };
        if (searchBeamNoise) defines.BEAM_NOISE = 1;
        return defines;
      }
      /**
       * Searchlight cookies: a light's cross-section as a texture, from a radial
       * profile `shape(r, angle, x, y)` (r 0 centre .. 1 texture edge).
       */
      function searchCookie(shape) {
        const size = 256,
          c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d'),
          image = g.createImageData(size, size),
          data = image.data;
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++) {
            const dx = ((x + 0.5) / size - 0.5) * 2,
              dy = ((y + 0.5) / size - 0.5) * 2,
              v = shape(Math.hypot(dx, dy), Math.atan2(dy, dx), dx, dy),
              byte = Math.round(clamp(v, 0, 1) * 255),
              o = (y * size + x) * 4;
            data[o] = data[o + 1] = data[o + 2] = byte;
            data[o + 3] = 255;
          }
        g.putImageData(image, 0, 0);
        const t = new Three.CanvasTexture(c);
        t.colorSpace = Three.NoColorSpace;
        t.wrapS = t.wrapT = Three.ClampToEdgeWrapping;
        return t;
      }
      /**
       * The helicopter's xenon spot through a parabolic reflector: a hot centre
       * over a broad even plateau, a faint bright caustic ring just inside a crisp
       * edge, a narrow penumbra (r 0.80..0.93 of the texture) and a whisper of
       * spill beyond it, very slightly oval, with a little mottling so it never
       * looks like a perfect disc.
       */
      const searchCookieTexture = searchCookie((round, a, x, y) => {
        const r = Math.hypot(x, y * 1.04);
        if (r >= 1) return 0;
        // Plateau with a hot core, sagging a little towards the rim.
        let v = (0.6 + 0.4 * Math.exp(-(r * r) / 0.07)) * (1 - 0.14 * r * r);
        // The reflector's caustic ring, then the crisp edge and its penumbra.
        v *= 1 + 0.08 * Math.exp(-Math.pow((r - 0.76) / 0.035, 2));
        v *= 1 - smoothUnit(0.8, 0.93, r);
        v += 0.035 * (1 - smoothUnit(0.84, 1, r)) * smoothUnit(0.7, 0.86, r);
        // A slight asymmetry of the arc and the lens.
        return v * (1 + 0.035 * Math.sin(a * 3 + r * 9) * r + 0.025 * Math.sin(a * 7 - r * 13) * r);
      });
      /**
       * The watch towers' softer lamps (ground decals): a hot centre, a long soft
       * shoulder, a faint reflector ring and a feathered edge.
       */
      const searchPoolDecalTexture = searchCookie((r, a) => {
        if (r >= 1) return 0;
        const feather = 1 - smoothUnit(0.66, 1, r);
        let v = (0.5 * Math.exp(-2.4 * r * r) + 0.5 * Math.exp(-11 * r * r)) * feather;
        // Reflector rings and a slight asymmetry of the arc lamp.
        v *= 1 + 0.09 * Math.exp(-Math.pow((r - 0.72) / 0.05, 2)) + 0.05 * Math.exp(-Math.pow((r - 0.4) / 0.04, 2));
        v *= 1 + 0.05 * Math.sin(a * 3 + r * 9) * r + 0.04 * Math.sin(a * 7 - r * 13) * r;
        return v / 1.02;
      });
      function smoothUnit(edge0, edge1, x) {
        const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
      }
      /**
       * Ground pool decal for lights that are not real lights (the watch towers):
       * the cookie laid on the ground, stretched along the beam where it grazes.
       */
      function createSearchPool(color) {
        const mesh = new Three.Mesh(
          new Three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
          new Three.MeshBasicMaterial({
            map: searchPoolDecalTexture,
            color,
            transparent: true,
            depthWrite: false,
            blending: Three.AdditiveBlending,
            fog: false,
          }),
        );
        mesh.visible = false;
        mesh.renderOrder = 4;
        mesh.userData.dynamic = true;
        mesh.userData.baseColor = new Three.Color(color);
        scene.add(mesh);
        return mesh;
      }
      // ---- Rain lit inside the beam -----------------------------------------------------
      const BEAM_RAIN_MAX = 520;
      const beamRainUniforms = {
        uApex: { value: new Three.Vector3() },
        uAxis: { value: new Three.Vector3(0, -1, 0) },
        uLength: { value: 1 },
        uRadius0: { value: 1 },
        uTan: { value: 0.1 },
        uTime: { value: 0 },
        uGroundY: { value: 0 },
        uWind: { value: new Three.Vector2() },
        uColor: { value: new Three.Color('#dbe8ff') },
        uIntensity: { value: 0 },
      };
      const beamRain = (() => {
        const seeds = new Float32Array(BEAM_RAIN_MAX * 2 * 4),
          tips = new Float32Array(BEAM_RAIN_MAX * 2),
          positions = new Float32Array(BEAM_RAIN_MAX * 2 * 3);
        for (let i = 0; i < BEAM_RAIN_MAX; i++) {
          // More drops near the ground end, where the cone is widest.
          const along = Math.pow(Math.random(), 0.6),
            angle = Math.random() * TAU,
            radius = Math.sqrt(Math.random()) * 0.95,
            phase = Math.random();
          for (let e = 0; e < 2; e++) {
            seeds.set([along, angle, radius, phase], (i * 2 + e) * 4);
            tips[i * 2 + e] = e;
          }
        }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.BufferAttribute(positions, 3));
        geometry.setAttribute('seed', new Three.BufferAttribute(seeds, 4));
        geometry.setAttribute('tip', new Three.BufferAttribute(tips, 1));
        const material = new Three.ShaderMaterial({
          uniforms: beamRainUniforms,
          vertexShader: `
            ${SEARCH_BEAM_COMMON}
            uniform float uTime;
            uniform float uGroundY;
            uniform vec2 uWind;
            attribute vec4 seed;
            attribute float tip;
            varying float vLight;
            void main() {
              vec3 u, v;
              beamBasis( u, v );
              float along = seed.x * uLength * 0.9;
              vec3 base = uApex + uAxis * along + ( u * cos( seed.y ) + v * sin( seed.y ) ) * ( ( uRadius0 + along * uTan ) * seed.z );
              // Each drop falls through a short column and wraps; it fades in and out.
              const float span = 110.0;
              float cycle = fract( seed.w + uTime * 720.0 / span );
              float drop = ( cycle - 0.5 ) * span;
              vec3 slant = vec3( uWind.x, -1.0, uWind.y );
              vec3 p = base + slant * drop - slant * ( 13.0 * tip );
              vec2 bc = beamCoords( p );
              float inside = ( 1.0 - smoothstep( 0.55, 1.0, bc.x ) ) * step( 0.0, bc.y ) * step( bc.y, 1.0 );
              float spread = uRadius0 + max( bc.y, 0.0 ) * uLength * uTan;
              float near = clamp( ( uRadius0 + uLength * uTan * 0.9 ) / spread, 1.0, 6.0 );
              // Dimmer at head height, where they would streak over the lit target.
              float low = mix( 0.35, 1.0, smoothstep( 6.0, 34.0, p.y - uGroundY ) );
              vLight = inside * sin( cycle * 3.14159 ) * near * low * step( uGroundY + 0.5, p.y ) * ( 1.0 - 0.6 * tip );
              gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
            }`,
          fragmentShader: `
            uniform vec3 uColor;
            uniform float uIntensity;
            varying float vLight;
            void main() {
              gl_FragColor = vec4( uColor * ( uIntensity * vLight ), 1.0 );
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
          transparent: true,
          depthWrite: false,
          blending: Three.AdditiveBlending,
          fog: false,
        });
        const lines = new Three.LineSegments(geometry, material);
        lines.frustumCulled = false;
        lines.visible = false;
        lines.renderOrder = 6;
        lines.userData.dynamic = true;
        scene.add(lines);
        return lines;
      })();
      // ---- Lens flare -------------------------------------------------------------------
      const searchFlareUniforms = {
        uCenter: { value: new Three.Vector3() },
        uSize: { value: 10 },
        uColor: { value: new Three.Color('#e4efff') },
        uIntensity: { value: 0 },
        uStreak: { value: 0 },
      };
      const searchFlare = new Three.Mesh(
        new Three.PlaneGeometry(2, 2),
        new Three.ShaderMaterial({
          uniforms: searchFlareUniforms,
          vertexShader: `
            uniform vec3 uCenter;
            uniform float uSize;
            varying vec2 vUv;
            void main() {
              vUv = position.xy;
              vec4 view = viewMatrix * vec4( uCenter, 1.0 );
              // Wide enough for the streak; pulled towards the camera off the fuselage.
              view.xy += position.xy * vec2( uSize * 4.0, uSize );
              view.z += 12.0;
              gl_Position = projectionMatrix * view;
            }`,
          fragmentShader: `
            uniform vec3 uColor;
            uniform float uIntensity;
            uniform float uStreak;
            varying vec2 vUv;
            void main() {
              vec2 p = vec2( vUv.x * 4.0, vUv.y );
              float r2 = dot( p, p );
              float core = exp( -r2 * 22.0 ) * 3.0 + exp( -r2 * 4.0 ) * 0.35;
              // Anamorphic streak across the lens.
              float streak = exp( -abs( vUv.y ) * 26.0 ) * pow( max( 0.0, 1.0 - abs( vUv.x ) ), 2.2 ) * uStreak;
              float fade = ( 1.0 - smoothstep( 0.8, 1.0, abs( vUv.x ) ) ) * ( 1.0 - smoothstep( 0.8, 1.0, abs( vUv.y ) ) );
              gl_FragColor = vec4( uColor * ( uIntensity * ( core + streak ) * fade ), 1.0 );
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
          transparent: true,
          depthWrite: false,
          blending: Three.AdditiveBlending,
          fog: false,
        }),
      );
      searchFlare.frustumCulled = false;
      searchFlare.visible = false;
      searchFlare.renderOrder = 7;
      searchFlare.userData.dynamic = true;
      scene.add(searchFlare);
      // ---- The helicopter's spot ---------------------------------------------------------
      /**
       * HELICOPTER SEARCHLIGHT LOOK
       * The pool is light, not an overlay: one real SpotLight (cookie above) that
       * lights the ground, cars, facades and the player through their own
       * materials, so whoever stands in it is lit from above in the lamp's colour,
       * keeps their contrast and detail and casts a crisp shadow away from the
       * helicopter (HIGH/ULTRA). Its brightness is set as exposed light (divided by
       * the night exposure), so pale paving comes out near white without clipping
       * and asphalt a clear mid grey, whatever the time-of-day look does to the
       * exposure, and it stays under the night bloom threshold on dark ground.
       * The shaft is a garnish: faint in clear air, fuller in rain and murk, gone
       * over the last stretch of the beam and round the target (uTail, uClear), and
       * only drawn on HIGH/ULTRA.
       */
      const AIR_LIGHT = {
        color: '#d8e5ff', // xenon arc: cool white with a slight blue tint
        shaftColor: '#d0e0ff',
        poolNight: 7.2, // irradiance x exposure at the pool's hot centre, full night
        poolDay: 2.2, // the same by day (it barely shows against the sun)
        wetDim: 0.45, // share lost on soaked tarmac, which mirrors it at the camera
        shaftClear: 0.3, // shaft strength in clear air at night
        shaftMurk: 0.8, // added per unit of murk (rain, overcast, lightning)
        capClear: 0.3, // shaft shoulder (HDR ceiling of a pixel) in clear air
        capMurk: 0.55, // added at full murk
        tailClear: 0.95, // share of the shaft gone by the ground in clear air
        tailRain: 0.6, // the same in heavy rain, where the lit drops carry it down
        clear: 1.25, // radius of the clear air round the target, in pool radii
        trackRadius: 44, // pool radius on the target (map units)
        searchRadius: 60, // wider while searching
        velocityFeed: 0.82, // share of the target's velocity the crew anticipates
      };
      /**
       * HELI SEARCHLIGHT MOUNT: where the lamp sits on a police helicopter, in the
       * airframe's frame (map units): `forward` along its heading from the vehicle's
       * position, `side` across it (towards (-sin, cos) of the heading), `up` above
       * entityElevation(). This is the only thing the searchlight takes from the
       * helicopter model (helicopter3d.js): a new airframe keeps its chin housing
       * here, or changes these numbers.
       */
      const HELI_SEARCHLIGHT_MOUNT = { forward: 16.5, side: 0, up: 4.3 };
      // Always in the scene (intensity 0 when idle) so every material keeps the same
      // program; its shadow is switched with the quality tier (setSearchlightQuality).
      // A hard-edged lamp: the cookie shapes the edge, the cone barely softens it.
      const airSpot = new Three.SpotLight(AIR_LIGHT.color, 0, 600, 0.2, 0.04, 2);
      airSpot.map = searchCookieTexture;
      airSpot.shadow.bias = -0.00045;
      airSpot.shadow.normalBias = 0.7;
      airSpot.shadow.mapSize.set(1024, 1024);
      scene.add(airSpot, airSpot.target);
      const airBeam = createSearchBeam(AIR_LIGHT.shaftColor);
      // The shaft is drawn on HIGH/ULTRA only (setSearchlightQuality); the
      // developer console can switch the shaft and pool off for A/B tests.
      let airShaftTier = true;
      const searchlightDebug = { shaft: true, pool: true };
      const airSearch = {
        unit: null,
        aim: new Three.Vector3(),
        aimVelocity: new Three.Vector3(),
        goal: new Three.Vector3(),
        lastGoal: new Three.Vector3(),
        goalVelocity: new Three.Vector3(),
        apex: new Three.Vector3(),
        lit: new Three.Vector3(),
        ground: 0,
        radius: 48,
        fade: 0,
        state: '',
        snapUntil: 0,
        flareUntil: 0,
        clock: 0,
        valid: false,
        irradiance: 0,
      };
      const airScratch = new Three.Vector3(),
        airToCamera = new Three.Vector3();
      // Where the crew points the light this frame, or null (see airSearchPoint).
      function airSearchGoal(h) {
        const seen = airSearchPoint(h);
        if (!seen) return null;
        if (h.airState === 'searching') {
          // Hunting: a sweeping figure round the last sighting that dwells and
          // doubles back, wider as the search drags on.
          const t = gameTime,
            centre = h.airLastSeen || seen,
            reach = 55 + Math.min(70, (h.airLostFor || 0) * 6),
            a = t * 0.62 + Math.sin(t * 0.27) * 1.3;
          return {
            x: centre.x + Math.cos(a) * reach * (0.55 + 0.45 * Math.sin(t * 0.41)),
            y: centre.y + Math.sin(a * 1.5) * reach * 0.8,
            elevation: terrainHeight(centre.x, centre.y),
          };
        }
        // Tracking: the live target, not the last simulation snapshot.
        const live = h.airTarget && h.airTarget.hp > 0 ? h.airTarget : seen;
        return { x: live.x, y: live.y, elevation: entityElevation(live) };
      }
      /**
       * Critically damped spring, solved exactly (stable at any frame time), towards
       * a goal moving at `goalVelocity`: it settles on a moving target without lag.
       */
      function springTowards(position, velocity, goal, goalVelocity, omega, dt) {
        const decay = Math.exp(-omega * dt);
        for (const k of ['x', 'y', 'z']) {
          const error = position[k] - goal[k],
            drift = velocity[k] - goalVelocity[k],
            c = drift + omega * error;
          position[k] = goal[k] + (error + c * dt) * decay;
          velocity[k] = goalVelocity[k] + (drift - omega * c * dt) * decay;
        }
      }
      /**
       * Called once a frame (from harbor3d.js). The beam belongs to the live
       * police helicopter nearest the camera.
       */
      function updateHelicopterSearchlight() {
        const s = airSearch,
          elapsed = gameTime - s.clock,
          dt = clamp(elapsed, 0, 0.5);
        s.clock = gameTime;
        let h = null;
        for (const c of vehicles)
          if (c.airUnit && c.hp > 0 && !c.airRetreat && (!h || distanceBetween(c, cameraTarget) < distanceBetween(h, cameraTarget)))
            h = c;
        const goal = h && distanceBetween(h, cameraTarget) < 950 ? airSearchGoal(h) : null;
        if (h !== s.unit) {
          s.unit = h;
          s.valid = false;
        }
        if (goal) {
          s.goal.set(goal.x, goal.elevation, goal.y);
          if (!s.valid) {
            // First sight: start on the goal, no swing in from nowhere.
            s.aim.copy(s.goal);
            s.lastGoal.copy(s.goal);
            s.aimVelocity.set(0, 0, 0);
            s.goalVelocity.set(0, 0, 0);
            s.ground = goal.elevation;
            s.valid = true;
          }
          const state = h.airState;
          if (state === 'tracking' && s.state === 'searching') {
            s.snapUntil = gameTime + 0.7;
            s.flareUntil = gameTime + 0.45;
          }
          s.state = state;
          // Target velocity (smoothed) feeds the spring so a moving car stays in
          // the pool; the crew anticipates most of it, not all, so a fast car
          // sits a little ahead of the centre, the light catching up.
          if (elapsed > 0) {
            airScratch.copy(s.goal).sub(s.lastGoal).divideScalar(elapsed);
            if (elapsed > 0.5 || airScratch.lengthSq() > 900 * 900) airScratch.set(0, 0, 0);
            s.goalVelocity.lerp(airScratch, clamp(dt * 8, 0, 1));
          }
          s.lastGoal.copy(s.goal);
          const searching = state === 'searching',
            omega = gameTime < s.snapUntil ? 11 : searching ? 2.2 : 5.2;
          // A jump (teleport, respawn) is not something to swing across.
          if (s.aim.distanceTo(s.goal) > 280) {
            s.aim.copy(s.goal);
            s.aimVelocity.copy(s.goalVelocity);
          } else {
            airScratch.copy(s.goalVelocity).multiplyScalar(searching ? 1 : AIR_LIGHT.velocityFeed);
            springTowards(s.aim, s.aimVelocity, s.goal, airScratch, omega, dt);
          }
          s.ground += (goal.elevation - s.ground) * clamp(dt * 6, 0, 1);
          // A wider beam to search with, narrowed onto the target once found.
          s.radius += ((searching ? AIR_LIGHT.searchRadius : AIR_LIGHT.trackRadius) - s.radius) * clamp(dt * 2.5, 0, 1);
          s.fade = Math.min(1, s.fade + dt * 2.5);
        } else s.fade = Math.max(0, s.fade - dt * 1.8);
        const active = s.fade > 0.001 && s.valid && !!h;
        airBeam.mesh.visible = active && airShaftTier && searchlightDebug.shaft;
        searchFlare.visible = active;
        beamRain.visible = active && weather.rain > 0.04;
        if (!active) {
          airSpot.intensity = 0;
          return;
        }
        // The light sits in the chin housing under the nose (HELI_SEARCHLIGHT_MOUNT).
        const cos = Math.cos(h.a),
          sin = Math.sin(h.a),
          mount = HELI_SEARCHLIGHT_MOUNT,
          base = entityElevation(h);
        s.apex.set(h.x + cos * mount.forward - sin * mount.side, base + mount.up, h.y + sin * mount.forward + cos * mount.side);
        // The operator's hand (slow sways, looser while searching) and the
        // airframe's vibration through the gimbal, busier as it flies faster.
        const t = gameTime,
          wobble = s.state === 'searching' ? 3 : 1.6,
          buzz = 0.35 * (1 + (h.speed ? Math.min(1, Math.abs(h.speed) / 200) : 0)),
          aim = s.lit.set(
            s.aim.x + (Math.sin(t * 1.7) + 0.5 * Math.sin(t * 4.3 + 1.1)) * wobble + Math.sin(t * 71) * Math.sin(t * 13.1) * buzz,
            s.aim.y,
            s.aim.z + (Math.sin(t * 1.3 + 2) + 0.5 * Math.sin(t * 3.7)) * wobble + Math.sin(t * 83 + 1) * Math.sin(t * 11.3) * buzz,
          );
        const distance = s.apex.distanceTo(aim),
          night = nightAmount,
          rain = weather.rain,
          overcast = weather.cloud * weather.cloud,
          flash = weather.flash || 0,
          // A xenon arc barely flickers; a new find flares the beam.
          flicker = 1 + 0.025 * Math.sin(t * 43) * Math.sin(t * 17.3),
          flare = gameTime < s.flareUntil ? 1 + 0.35 * ((s.flareUntil - gameTime) / 0.45) : 1,
          power = s.fade * flicker * flare;
        // Ground pool: a real spot light, constant brightness at the target
        // whatever the altitude (decay 2, intensity scaled by distance squared),
        // set against the exposure (not the lightning's flash) so it is the same
        // on screen however the night look is exposed.
        const cutoff = distance * 1.45,
          windowing = Math.pow(1 - Math.pow(distance / cutoff, 4), 2),
          exposure = Math.max(0.2, postLook.exposure / (1 + flash * 0.6)),
          irradiance = ((AIR_LIGHT.poolDay + (AIR_LIGHT.poolNight - AIR_LIGHT.poolDay) * night) / exposure) * (1 - weather.wet * AIR_LIGHT.wetDim);
        s.irradiance = irradiance * power;
        airSpot.position.copy(s.apex);
        airSpot.target.position.copy(aim);
        airSpot.target.updateMatrixWorld();
        airSpot.distance = cutoff;
        airSpot.angle = Math.atan((s.radius * 1.12) / distance);
        airSpot.intensity = searchlightDebug.pool ? (irradiance * distance * distance * power) / windowing : 0;
        if (airSpot.castShadow) {
          airSpot.shadow.camera.near = Math.max(10, distance - 170);
          airSpot.shadow.camera.updateProjectionMatrix();
        }
        // The shaft: faint by day and in clear air, fuller in rain and murk, and
        // clear of the target.
        const murk = Math.min(1.6, rain * 1.3 + overcast * 0.5 + flash * 0.5),
          b = airBeam.uniforms;
        airBeam.set(s.apex, aim, s.radius, 1.6, s.ground);
        b.uIntensity.value = (0.03 + night * 0.97) * (AIR_LIGHT.shaftClear + AIR_LIGHT.shaftMurk * murk) * power;
        b.uNoise.value = 0.9 - rain * 0.3;
        b.uCap.value = AIR_LIGHT.capClear + AIR_LIGHT.capMurk * Math.min(1, murk);
        b.uTail.value = AIR_LIGHT.tailClear + (AIR_LIGHT.tailRain - AIR_LIGHT.tailClear) * Math.min(1, rain * 1.5);
        b.uTarget.value.copy(aim);
        b.uClear.value = s.radius * AIR_LIGHT.clear;
        // Rain streaks lit inside the cone.
        if (beamRain.visible) {
          const u = beamRainUniforms;
          u.uApex.value.copy(b.uApex.value);
          u.uAxis.value.copy(b.uAxis.value);
          u.uLength.value = b.uLength.value;
          u.uRadius0.value = b.uRadius0.value;
          u.uTan.value = b.uTan.value;
          u.uGroundY.value = s.ground;
          u.uTime.value = gameTime;
          const slant = weather.wind * 0.21;
          u.uWind.value.set(Math.cos(weather.windAngle) * slant, Math.sin(weather.windAngle) * slant);
          u.uIntensity.value = Math.min(1, rain * 1.4) * (0.15 + night * 0.85) * 0.8 * power;
        }
        // Lens: a hot point always, a flare and streak when it looks at the camera.
        if (camera.isOrthographicCamera) camera.getWorldDirection(airToCamera).negate();
        else airToCamera.copy(camera.position).sub(s.apex).normalize();
        const facing = Math.max(0, -b.uAxis.value.dot(airToCamera)),
          glare = Math.pow(facing, 3);
        searchFlareUniforms.uCenter.value.copy(s.apex);
        searchFlareUniforms.uSize.value = 7 + glare * 9;
        searchFlareUniforms.uIntensity.value = (0.25 + night * 1.6) * (0.35 + glare * 2.4) * power * (1 + 0.06 * Math.sin(t * 31));
        searchFlareUniforms.uStreak.value = glare * (0.4 + night * 0.6);
      }
      /**
       * Developer console (DeadEndCity.searchlight): the helicopter light's state,
       * where its pool and the player are on screen (for contrast measurements),
       * and switches for the shaft and the pool (`{ shaft: false }`) for A/B shots.
       */
      function searchlightReport(options) {
        if (options && typeof options === 'object')
          for (const key of ['shaft', 'pool']) if (typeof options[key] === 'boolean') searchlightDebug[key] = options[key];
        const s = airSearch,
          screen = (x, elevation, y) => {
            const v = airScratch.set(x, elevation, y).project(camera);
            return { x: Math.round((v.x * 0.5 + 0.5) * viewportWidth), y: Math.round((-0.5 * v.y + 0.5) * viewportHeight) };
          },
          round = (v) => Math.round(v * 100) / 100,
          target = player.car || player;
        return {
          active: airSpot.intensity > 0 || airBeam.mesh.visible,
          unit: s.unit ? s.unit.id : null,
          state: s.state,
          switches: { ...searchlightDebug },
          shaftTier: airShaftTier,
          shaftShown: airBeam.mesh.visible,
          rainShown: beamRain.visible,
          aim: { x: round(s.lit.x), y: round(s.lit.z), elevation: round(s.lit.y) },
          lag: round(Math.hypot(s.lit.x - s.goal.x, s.lit.z - s.goal.z)),
          radius: round(s.radius),
          altitude: s.unit ? round(s.apex.y - s.ground) : null,
          irradiance: round(s.irradiance),
          exposure: round(postLook.exposure),
          shaft: { intensity: round(airBeam.uniforms.uIntensity.value), cap: round(airBeam.uniforms.uCap.value), tail: round(airBeam.uniforms.uTail.value), clear: round(airBeam.uniforms.uClear.value), steps: searchBeamSteps },
          shadow: airSpot.castShadow ? airSpot.shadow.mapSize.x : 0,
          screen: { aim: screen(s.lit.x, s.lit.y, s.lit.z), player: screen(target.x, entityElevation(target) + 8, target.y) },
          pixelsPerUnit: round(viewportHeight / (streetCamera.top - streetCamera.bottom)),
        };
      }
      // ---- Quality ----------------------------------------------------------------------
      /**
       * LOW/MEDIUM: the pool alone (no shaft for the helicopter, no shadow), a
       * short march for the watch towers, fewer lit raindrops. HIGH/ULTRA add
       * the helicopter's shaft, march further and give its spot a shadow while
       * sun shadows are HIGH (a program change for lit materials, so only on a
       * tier or shadow setting change).
       */
      function setSearchlightQuality(tier) {
        const steps = tier.ao >= 14 ? 22 : tier.ao > 0 ? 16 : tier.bloom > 0 ? 10 : 6,
          noise = tier.bloom > 0;
        airShaftTier = tier.ao > 0;
        if (steps !== searchBeamSteps || noise !== searchBeamNoise) {
          searchBeamSteps = steps;
          searchBeamNoise = noise;
          for (const beam of searchBeams) {
            beam.mesh.material.defines = searchBeamDefines();
            beam.mesh.material.needsUpdate = true;
          }
        }
        const shadows = tier.shadowMap >= 3072 && shadowQuality() === 'high',
          shadowSize = tier.shadowMap >= 4096 ? 2048 : 1024;
        if (airSpot.castShadow !== shadows || airSpot.shadow.mapSize.x !== shadowSize) {
          airSpot.castShadow = shadows;
          airSpot.shadow.mapSize.set(shadowSize, shadowSize);
          if (airSpot.shadow.map) {
            airSpot.shadow.map.dispose();
            airSpot.shadow.map = null;
          }
        }
        beamRain.geometry.setDrawRange(0, (tier.ao > 0 ? BEAM_RAIN_MAX : tier.bloom > 0 ? 340 : 200) * 2);
      }
      // END SUBSYSTEM: src/searchlight3d.js
