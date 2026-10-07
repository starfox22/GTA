      // BEGIN SUBSYSTEM: src/weather3d.js — Weather and sky visuals
      /**
       * Weather and sky visuals
       * Source: src/weather3d.js
       * Scope: createCityRenderer() closure.
       * Rain, splashes, drips, spray, wet roads, lightning and the storm light
       * (clouds are clouds3d.js, puddle ripples surfaces3d.js, rain rings on the
       * sea world3d.js, wet-road light streaks signage3d.js).
       *
       * Everything that moves is animated on the GPU from a few uniforms, so the
       * CPU cost of a downpour is a handful of uniform writes a frame:
       *
       *  - RAIN: streaks in a box that follows the view. Each drop is anchored in
       *    the world and wrapped into the box, so walking through the rain does
       *    not drag it along. A per-drop depth value gives three layers at once:
       *    fine far drops (short, faint, slower) to heavy near ones (long, bright,
       *    fast); all slant with the wind. Drops near the ground pick up the
       *    city's night light map, so rain glitters in the lamp pools and under
       *    the neon. The count follows the quality tier.
       *  - SPLASHES: small crowns and expanding rings on the streets, a tier-sized
       *    pool of instanced quads cycling through random spots round the view,
       *    thicker where the tarmac holds puddles (the same noise the ground uses).
       *  - DRIPS: water running off roof edges and shop awnings on the faces the
       *    camera sees, dripping on after the rain has stopped while it is wet.
       *  - SPRAY: mist thrown up behind fast cars on a wet road (a ring buffer of
       *    particles the CPU only spawns; the GPU flies them).
       *  - LIGHTNING: the flash lights the city (sun, sky fill, exposure), and a
       *    strike close enough to see draws a forked bolt from the cloud base.
       *  - STORM LIGHT: overcast flattens the sun and lifts the fill, rain darkens
       *    and cools the grade (weatherGrade, called by updateLighting).
       */
      const RAIN_MAX = 3200,
        RAIN_BOX = 1500,
        RAIN_TOP = 560;
      // Rain streaks: two vertices a drop; aDrop = (x, z in the box, phase, depth), aEnd 0 head / 1 tail.
      const rainGeometry = new Three.BufferGeometry();
      {
        const drop = new Float32Array(RAIN_MAX * 2 * 4),
          end = new Float32Array(RAIN_MAX * 2);
        for (let i = 0; i < RAIN_MAX; i++) {
          const x = Math.random() - 0.5,
            z = Math.random() - 0.5,
            phase = Math.random(),
            depth = Math.pow(Math.random(), 1.6);
          drop.set([x, z, phase, depth, x, z, phase, depth], i * 8);
          end[i * 2 + 1] = 1;
        }
        rainGeometry.setAttribute('position', new Three.BufferAttribute(new Float32Array(RAIN_MAX * 2 * 3), 3));
        rainGeometry.setAttribute('aDrop', new Three.BufferAttribute(drop, 4));
        rainGeometry.setAttribute('aEnd', new Three.BufferAttribute(end, 1));
      }
      const rainUniforms = {
        uOrigin: { value: new Three.Vector3() },
        uTime: { value: 0 },
        uFall: { value: 1200 },
        uTop: { value: RAIN_TOP },
        uBox: { value: RAIN_BOX },
        uLength: { value: 30 },
        uWind: { value: new Three.Vector2() },
        uOpacity: { value: 0 },
        uAmbient: { value: new Three.Color('#bcd2e4') },
        uFlash: { value: 0 },
        // Street level (the chase view, weather3d-chase.js): the lens (xyz) and how close a drop may come
        // to it (w, units; 0 in the street view and the air: no change).
        uNear: { value: new Three.Vector4() },
      };
      // Night light map (lighting3d.js): the drops glitter where the lamps are,
      // and in the low beams of the nearest cars (CAR LAMPS), whose cut-off is
      // relaxed a little so the rain over the lit road catches them. The beams
      // run in the car's body frame as the ground's do (CAR LAMP FRAME,
      // lighting3d-sky.js): on a slope the lit column follows the road, a light
      // bar slot throws its flood, and a slot on the range reads the TERRAIN
      // HORIZON, so drops past a crest below the line the beam grazes stay dark.
      // A level car (C = 0, 0, 1) gives the old level numbers.
      const RAIN_LAMP_GLSL = `
        uniform sampler2D cityLampMap;
        uniform vec4 cityLampRect;
        uniform float cityLampPower;
        uniform vec4 cityCarLampA[ ${CAR_LAMP_SLOTS} ];
        uniform vec4 cityCarLampB[ ${CAR_LAMP_SLOTS} ];
        uniform vec4 cityCarLampC[ ${CAR_LAMP_SLOTS} ];
        uniform float cityCarLampCount;
        uniform sampler2D cityBeamShadow;
        ${CITY_LOW_BEAM}
        ${CITY_LAMP_FRAME}
        vec3 rainCarLight( vec3 p ) {
          float sum = 0.0;
          for ( int i = 0; i < ${CAR_LAMP_SLOTS}; i ++ ) {
            if ( float( i ) >= cityCarLampCount ) break;
            vec4 a = cityCarLampA[ i ], b = cityCarLampB[ i ], c = cityCarLampC[ i ];
            vec3 aim, kerb;
            cityLampFrame( b, c, aim, kerb );
            vec3 d = p - a.xyz;
            float ahead = dot( d, aim );
            if ( ahead < 2.0 || ahead > 480.0 ) continue;
            float side = dot( d, kerb );
            side = sign( side ) * max( abs( side ) - b.z, 0.0 );
            float rise = dot( d, cross( kerb, aim ) );
            float beam = c.w > 1.5 ? cityFloodBeam( side / ahead, rise / ahead ) : cityLowBeam( side / ahead, rise / ahead - 0.05 );
            bool onRange = mod( c.w, 2.0 ) > 0.5;
            if ( beam > 0.0005 && onRange ) beam *= cityHorizonShade( float( i ), d, b.xy );
            float metres2 = dot( d, d ) * 0.015625;
            vec2 reach = onRange ? vec2( ${CAR_LAMP_RANGE_REACH.map((m) => (m * m).toFixed(1)).join(', ')} ) : vec2( ${CAR_LAMP_REACH.map((m) => (m * m).toFixed(1)).join(', ')} );
            sum += a.w * beam / max( metres2, 0.5 ) * ( 1.0 - smoothstep( reach.x, reach.y, metres2 ) );
          }
          // Soft capped as the ground's VEHICLE LIGHT BUDGET is: one beam's cone
          // glitters, the rain over a junction lit by eight is not a grey veil.
          return vec3( 1.0, 0.93, 0.8 ) * 1.4 * ( 1.0 - exp( -sum * 0.006 / 1.4 ) );
        }
        vec3 rainLampLight( vec3 p ) {
          vec3 cars = cityCarLampCount > 0.5 ? rainCarLight( p ) : vec3( 0.0 );
          vec2 uv = ( p.xz - cityLampRect.xy ) * cityLampRect.zw;
          if ( cityLampPower < 0.001 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) return cars;
          return cars + texture2D( cityLampMap, uv ).rgb * cityLampPower * ( 1.0 - smoothstep( 8.0, 70.0, p.y ) );
        }`;
      // The uniforms RAIN_LAMP_GLSL reads: the lit materials' own (street lamps, CAR LAMPS,
      // the horizon strip under the BEAM SHADOWS mask).
      const RAIN_LAMP_UNIFORMS = {
        cityLampMap: cityLightUniforms.cityLampMap,
        cityLampRect: cityLightUniforms.cityLampRect,
        cityLampPower: cityLightUniforms.cityLampPower,
        cityCarLampA: cityLightUniforms.cityCarLampA,
        cityCarLampB: cityLightUniforms.cityCarLampB,
        cityCarLampC: cityLightUniforms.cityCarLampC,
        cityCarLampCount: cityLightUniforms.cityCarLampCount,
        cityBeamShadow: cityLightUniforms.cityBeamShadow,
      };
      const rainMaterial = new Three.ShaderMaterial({
        uniforms: {
          ...rainUniforms,
          ...RAIN_LAMP_UNIFORMS,
        },
        vertexShader: `
          attribute vec4 aDrop;
          attribute float aEnd;
          uniform vec3 uOrigin;
          uniform float uTime, uFall, uTop, uBox, uLength, uOpacity, uFlash;
          uniform vec2 uWind;
          uniform vec3 uAmbient;
          uniform vec4 uNear;
          varying vec4 vColor;
          ${RAIN_LAMP_GLSL}
          void main() {
            float depth = aDrop.w;
            float speed = uFall * ( 0.72 + 0.5 * depth );
            float cycle = uTop / speed;
            float t = fract( uTime / cycle + aDrop.z );
            // World-anchored: drift with the wind, then wrap into the box round the view.
            vec2 p = aDrop.xy * uBox + uWind * ( t * cycle + aDrop.z * 7.0 );
            p = mod( p - uOrigin.xz + uBox * 0.5, uBox ) - uBox * 0.5 + uOrigin.xz;
            vec3 head = vec3( p.x, uOrigin.y + uTop * ( 1.0 - t ), p.y );
            // The tail trails up-wind along the drop's velocity.
            vec3 velocity = vec3( uWind.x, -speed, uWind.y );
            vec3 pos = head - velocity / speed * uLength * ( 0.45 + 0.9 * depth ) * aEnd;
            vec3 lamp = rainLampLight( head );
            float fadeIn = smoothstep( 0.0, 0.06, t ) * ( 1.0 - smoothstep( 0.93, 1.0, t ) );
            float alpha = uOpacity * ( 0.3 + 0.7 * depth ) * fadeIn * ( 1.0 - aEnd * 0.85 ), sky = 1.0;
            // At street level (uNear.w > 0) no drop crosses the lens (a streak the height of the frame),
            // the nearest are the brightest and at night they catch more of the city's light (against the
            // dark street the night sky's own was too dim to show them).
            if ( uNear.w > 0.0 ) {
              float lens = distance( head, uNear.xyz );
              alpha *= smoothstep( uNear.w, uNear.w * 2.5, lens ) * ( 1.0 + 1.2 * ( 1.0 - smoothstep( uNear.w, uNear.w * 14.0, lens ) ) );
              sky = 1.0 + 1.8 * ( 1.0 - smoothstep( 0.08, 0.4, dot( uAmbient, vec3( 0.3333 ) ) ) );
            }
            vColor = vec4( uAmbient * ( sky + uFlash * 6.0 ) + lamp * ( 0.9 + depth ), alpha * ( 1.0 + min( dot( lamp, vec3( 0.33 ) ) * 1.5, 2.0 ) ) );
            gl_Position = projectionMatrix * viewMatrix * vec4( pos, 1.0 );
          }`,
        fragmentShader: `
          varying vec4 vColor;
          void main() {
            gl_FragColor = vec4( vColor.rgb, clamp( vColor.a, 0.0, 1.0 ) );
          }`,
        transparent: true,
        depthWrite: false,
      });
      const rainMesh = new Three.LineSegments(rainGeometry, rainMaterial);
      rainMesh.frustumCulled = false;
      rainMesh.visible = false;
      rainMesh.renderOrder = 7;
      rainMesh.name = 'rain';
      scene.add(rainMesh);
      /* ---- Splashes -------------------------------------------------------------------- */
      const SPLASH_MAX = 1400;
      const splashGeometry = new Three.InstancedBufferGeometry();
      {
        const quad = new Three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        splashGeometry.index = quad.index;
        splashGeometry.setAttribute('position', quad.attributes.position);
        splashGeometry.setAttribute('uv', quad.attributes.uv);
        const seeds = new Float32Array(SPLASH_MAX * 3);
        for (let i = 0; i < SPLASH_MAX * 3; i++) seeds[i] = Math.random();
        splashGeometry.setAttribute('aSeed', new Three.InstancedBufferAttribute(seeds, 3));
        splashGeometry.instanceCount = 0;
      }
      const splashUniforms = {
        uOrigin: { value: new Three.Vector3() },
        uTime: rainUniforms.uTime,
        uReach: { value: 700 },
        uStrength: { value: 0 },
        uAmbient: rainUniforms.uAmbient,
        // Street level (the chase view): the splashes' size and the share that stand up as crowns facing the camera.
        uSize: { value: 1 },
        uUpright: { value: 0 },
      };
      const splashMaterial = new Three.ShaderMaterial({
        uniforms: {
          ...splashUniforms,
          ...RAIN_LAMP_UNIFORMS,
        },
        vertexShader: `
          attribute vec3 aSeed;
          uniform vec3 uOrigin;
          uniform float uTime, uReach, uStrength, uSize, uUpright;
          uniform vec3 uAmbient;
          varying vec2 vUv;
          varying float vLife;
          varying vec3 vLight;
          varying float vAlpha;
          varying float vCrown;
          ${RAIN_LAMP_GLSL}
          float sHash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
          float sNoise( vec2 p ) {
            vec2 i = floor( p ), f = fract( p );
            f = f * f * ( 3.0 - 2.0 * f );
            return mix( mix( sHash( i ), sHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( sHash( i + vec2( 0.0, 1.0 ) ), sHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
          }
          void main() {
            float period = 0.45 + aSeed.z * 0.35;
            float cycle = uTime / period + aSeed.x * 17.0;
            float n = floor( cycle );
            vLife = fract( cycle );
            // A new random spot round the view for every splash.
            vec2 spot = vec2( sHash( vec2( n, aSeed.y * 91.7 ) ), sHash( vec2( aSeed.x * 53.1, n ) ) ) - 0.5;
            vec2 p = uOrigin.xz + spot * uReach * 2.0;
            // Puddles (the ground shader's puddle noise) ring widely; tarmac only spits.
            float puddle = smoothstep( 0.56, 0.68, sNoise( p * 0.017 + 41.0 ) );
            float size = mix( 1.2, 3.4, puddle ) * ( 0.7 + 0.6 * aSeed.z ) * uSize;
            vUv = uv;
            vLight = uAmbient * 0.9 + rainLampLight( vec3( p.x, 1.0, p.y ) ) * 1.4;
            vAlpha = uStrength * mix( 0.5, 1.0, puddle );
            vec3 pos = vec3( p.x, uOrigin.y + 0.55, p.y ) + position * size * 2.0;
            // At street level a share of them stand up as a crown thrown off the tarmac (a quad facing the
            // camera, uv.y up): seen along the street a flat splash is only a sliver.
            vCrown = step( aSeed.y, 0.5 ) * uUpright * ( 1.0 - puddle * 0.6 );
            if ( vCrown > 0.0 ) {
              vec2 side = normalize( vec2( p.y - cameraPosition.z, cameraPosition.x - p.x ) + 1e-4 );
              pos = vec3( p.x + side.x * position.x * size * 1.4, uOrigin.y + 0.2 + uv.y * size * 1.1, p.y + side.y * position.x * size * 1.4 );
            }
            gl_Position = projectionMatrix * viewMatrix * vec4( pos, 1.0 );
          }`,
        fragmentShader: `
          varying vec2 vUv;
          varying float vLife;
          varying vec3 vLight;
          varying float vAlpha;
          varying float vCrown;
          void main() {
            if ( vCrown > 0.0 ) {
              // A crown: two thin sheets of spray leaning out from the impact, rising and falling back
              // in the first third of the splash's life, beaded at the rim.
              float x = ( vUv.x - 0.5 ) * 2.0, y = vUv.y;
              float life = clamp( vLife * 3.2, 0.0, 1.0 ), rise = sin( life * 3.1416 ) * 0.95;
              float sheet = exp( -pow( ( abs( x ) - ( 0.12 + 0.55 * y ) ) * 9.0, 2.0 ) ) * step( y, rise );
              float beads = exp( -pow( ( y - rise ) * 14.0, 2.0 ) ) * ( 0.5 + 0.5 * sin( x * 23.0 + vLife * 7.0 ) ) * step( 0.1, abs( x ) );
              float c = ( sheet * ( 1.0 - y * 0.6 ) * 0.7 + beads ) * ( 1.0 - life ) * vAlpha * vCrown * 1.6;
              if ( c < 0.004 ) discard;
              gl_FragColor = vec4( vLight, c );
              return;
            }
            float d = length( vUv - 0.5 ) * 2.0;
            // An expanding ring, and a crown of spray in the first instant.
            float r = vLife;
            float ring = exp( -pow( ( d - r ) * 6.0, 2.0 ) ) * ( 1.0 - vLife ) * ( 1.0 - vLife ) * 0.45;
            // (A pin-prick crown: at 0.4 of the quad every drop on the tarmac
            // left a bright blob several pixels wide, and a downpour read as snow.)
            float crown = ( 1.0 - smoothstep( 0.0, 0.2, d ) ) * ( 1.0 - smoothstep( 0.0, 0.15, vLife ) ) * 0.7;
            float a = ( ring + crown ) * vAlpha;
            if ( a < 0.004 || d > 1.0 ) discard;
            gl_FragColor = vec4( vLight, a );
          }`,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const splashMesh = new Three.Mesh(splashGeometry, splashMaterial);
      splashMesh.frustumCulled = false;
      splashMesh.visible = false;
      splashMesh.renderOrder = 3;
      splashMesh.name = 'rain splashes';
      scene.add(splashMesh);
      // @include src/weather3d-chase.js
      /* ---- Drips off roofs and awnings ------------------------------------------------- */
      const DRIP_MAX = 700;
      const dripGeometry = new Three.BufferGeometry();
      const dripEmit = new Float32Array(DRIP_MAX * 2 * 4);
      {
        const end = new Float32Array(DRIP_MAX * 2);
        for (let i = 0; i < DRIP_MAX; i++) end[i * 2 + 1] = 1;
        dripGeometry.setAttribute('position', new Three.BufferAttribute(new Float32Array(DRIP_MAX * 2 * 3), 3));
        dripGeometry.setAttribute('aEmit', new Three.BufferAttribute(dripEmit, 4));
        dripGeometry.setAttribute('aEnd', new Three.BufferAttribute(end, 1));
        dripGeometry.setDrawRange(0, 0);
      }
      const dripUniforms = {
        uTime: rainUniforms.uTime,
        uAmbient: rainUniforms.uAmbient,
        uOpacity: { value: 0 },
        uGround: { value: 0 },
      };
      const dripMaterial = new Three.ShaderMaterial({
        uniforms: {
          ...dripUniforms,
          ...RAIN_LAMP_UNIFORMS,
        },
        vertexShader: `
          attribute vec4 aEmit;
          attribute float aEnd;
          uniform float uTime, uOpacity, uGround;
          uniform vec3 uAmbient;
          varying vec4 vColor;
          ${RAIN_LAMP_GLSL}
          void main() {
            // aEmit: edge point (x, height, z) and a seed. Drops leave every
            // 0.5-1.4 s and fall freely (g = 9.8 m/s^2 is 50 units/s^2) to the street.
            float h = max( aEmit.y - uGround, 1.0 );
            float fall = sqrt( 2.0 * h / 50.0 );
            float period = fall + 0.25 + fract( aEmit.w * 7.3 ) * 1.1;
            float t = mod( uTime + aEmit.w * 13.0, period );
            float drop = 25.0 * t * t;
            float v = 50.0 * t;
            vec3 head = vec3( aEmit.x, aEmit.y - min( drop, h ), aEmit.z );
            vec3 pos = head + vec3( 0.0, min( v * 0.045 + 0.6, 5.0 ), 0.0 ) * aEnd;
            float falling = step( t, fall );
            vColor = vec4( uAmbient * 1.1 + rainLampLight( head ) * 1.6, uOpacity * falling * ( 1.0 - aEnd * 0.8 ) );
            gl_Position = projectionMatrix * viewMatrix * vec4( pos, 1.0 );
          }`,
        fragmentShader: `
          varying vec4 vColor;
          void main() { gl_FragColor = vec4( vColor.rgb, clamp( vColor.a, 0.0, 1.0 ) ); }`,
        transparent: true,
        depthWrite: false,
      });
      const dripMesh = new Three.LineSegments(dripGeometry, dripMaterial);
      dripMesh.frustumCulled = false;
      dripMesh.visible = false;
      dripMesh.renderOrder = 7;
      dripMesh.name = 'rain drips';
      scene.add(dripMesh);
      let dripCenterX = 1e9,
        dripCenterY = 1e9,
        dripStreet = false;
      // At street level the drips stand round a point DRIP_STREET_AHEAD ahead of the camera, within
      // DRIP_STREET_REACH, placed again when that point has moved DRIP_STREET_MOVE.
      const DRIP_STREET_AHEAD = 220,
        DRIP_STREET_REACH = 520,
        DRIP_STREET_MOVE = 160,
        dripEye = { x: 0, y: 0 };
      // Emitters along the roof edges and awnings facing the camera, round the view.
      // `eye` (the chase view's camera, or null): the faces it sees, not the street camera's south faces.
      function placeDrips(cx, cy, reach, eye = null) {
        let n = 0;
        const add = (x, y, z) => {
          if (n >= DRIP_MAX) return;
          dripEmit.set([x, y, z, Math.random(), x, y, z, Math.random()], n * 8);
          dripEmit[n * 8 + 7] = dripEmit[n * 8 + 3];
          n++;
        };
        for (const b of buildings) {
          if (n >= DRIP_MAX) break;
          if (b.x + b.w < cx - reach || b.x > cx + reach || b.y + b.h < cy - reach || b.y > cy + reach) continue;
          // The south face (towards the camera): gutters every 16-30 units.
          const eaves = (b.eaves ?? b.height) - 0.5;
          if (!eye || eye.y > b.y + b.h) for (let x = b.x + 6 + Math.random() * 10; x < b.x + b.w - 4; x += 16 + Math.random() * 14) add(x, eaves, b.y + b.h + 1.2);
          if (eye) {
            // Street level: whichever faces the camera stands in front of.
            if (eye.y < b.y) for (let x = b.x + 6 + Math.random() * 10; x < b.x + b.w - 4; x += 16 + Math.random() * 14) add(x, eaves, b.y - 1.2);
            if (eye.x < b.x) for (let y = b.y + 6 + Math.random() * 10; y < b.y + b.h - 4; y += 16 + Math.random() * 14) add(b.x - 1.2, eaves, y);
            if (eye.x > b.x + b.w) for (let y = b.y + 6 + Math.random() * 10; y < b.y + b.h - 4; y += 16 + Math.random() * 14) add(b.x + b.w + 1.2, eaves, y);
          }
          // Shop awnings drip in a row along their front edge.
          for (const pane of b.shopPanes || [])
            for (let k = -pane.width / 2 + 2; k < pane.width / 2; k += 5 + Math.random() * 4) add(pane.cx + k, SHOP_FLOOR * 0.72 - 2.3, pane.face + 10.5);
        }
        dripGeometry.setDrawRange(0, n * 2);
        dripGeometry.attributes.aEmit.needsUpdate = true;
      }
      /* ---- Spray behind cars ------------------------------------------------------------ */
      const ROAD_SPRAY_MAX = 1600;
      const roadSprayGeometry = new Three.BufferGeometry(),
        roadSprayStart = new Float32Array(ROAD_SPRAY_MAX * 3),
        roadSprayVelocity = new Float32Array(ROAD_SPRAY_MAX * 3),
        roadSprayBirth = new Float32Array(ROAD_SPRAY_MAX).fill(-100),
        // How much of the car's tail lamps the mist behind it carries (brake lights more): at night
        // the spray off a car's rear wheels glows red in its own tail lights.
        roadSprayTint = new Float32Array(ROAD_SPRAY_MAX),
        ROAD_SPRAY_ATTRIBUTES = ['position', 'aVelocity', 'aBirth', 'aTint'];
      roadSprayGeometry.setAttribute('position', new Three.BufferAttribute(roadSprayStart, 3));
      roadSprayGeometry.setAttribute('aVelocity', new Three.BufferAttribute(roadSprayVelocity, 3));
      roadSprayGeometry.setAttribute('aBirth', new Three.BufferAttribute(roadSprayBirth, 1));
      roadSprayGeometry.setAttribute('aTint', new Three.BufferAttribute(roadSprayTint, 1));
      const roadSprayUniforms = {
        uTime: rainUniforms.uTime,
        uAmbient: rainUniforms.uAmbient,
        uPixels: { value: 1 },
        uPerspective: { value: 0 },
      };
      const roadSprayMaterial = new Three.ShaderMaterial({
        uniforms: {
          ...roadSprayUniforms,
          ...RAIN_LAMP_UNIFORMS,
        },
        vertexShader: `
          attribute vec3 aVelocity;
          attribute float aBirth, aTint;
          uniform float uTime, uPixels, uPerspective;
          uniform vec3 uAmbient;
          varying vec4 vColor;
          ${RAIN_LAMP_GLSL}
          void main() {
            float age = uTime - aBirth;
            float life = 0.9;
            vec3 p = position + aVelocity * age * ( 1.0 - age * 0.45 ) + vec3( 0.0, -18.0 * age * age, 0.0 );
            p.y = max( p.y, position.y - 1.0 );
            float k = clamp( age / life, 0.0, 1.0 );
            float alive = step( 0.0, age ) * step( age, life );
            // (The tail lamps' red fades as the mist drifts back out of their light.)
            vec3 tail = vec3( 1.0, 0.1, 0.05 ) * aTint * ( 1.0 - k ) * ( 1.0 - k );
            vColor = vec4( uAmbient * 0.95 + rainLampLight( p ) * 0.8 + tail, alive * 0.2 * ( 1.0 - k ) * smoothstep( 0.0, 0.08, age ) );
            vec4 mv = viewMatrix * vec4( p, 1.0 );
            gl_Position = projectionMatrix * mv;
            float size = ( 5.0 + 16.0 * k ) * alive;
            gl_PointSize = uPerspective > 0.5 ? size * uPixels / max( -mv.z, 1.0 ) : size * uPixels;
          }`,
        fragmentShader: `
          varying vec4 vColor;
          void main() {
            float d = length( gl_PointCoord - 0.5 ) * 2.0;
            float a = vColor.a * ( 1.0 - smoothstep( 0.2, 1.0, d ) );
            if ( a < 0.003 ) discard;
            gl_FragColor = vec4( vColor.rgb, a );
          }`,
        transparent: true,
        depthWrite: false,
      });
      const roadSprayMesh = new Three.Points(roadSprayGeometry, roadSprayMaterial);
      roadSprayMesh.frustumCulled = false;
      roadSprayMesh.visible = false;
      roadSprayMesh.renderOrder = 6;
      roadSprayMesh.name = 'road spray';
      scene.add(roadSprayMesh);
      let roadSprayNext = 0,
        roadSprayDirtyFrom = ROAD_SPRAY_MAX,
        roadSprayDirtyTo = -1;
      function spawnRoadSpray(x, y, z, vx, vy, vz, tint) {
        const i = roadSprayNext;
        roadSprayTint[i] = tint;
        roadSprayNext = (roadSprayNext + 1) % ROAD_SPRAY_MAX;
        roadSprayStart[i * 3] = x;
        roadSprayStart[i * 3 + 1] = y;
        roadSprayStart[i * 3 + 2] = z;
        roadSprayVelocity[i * 3] = vx;
        roadSprayVelocity[i * 3 + 1] = vy;
        roadSprayVelocity[i * 3 + 2] = vz;
        roadSprayBirth[i] = rainUniforms.uTime.value;
        roadSprayDirtyFrom = Math.min(roadSprayDirtyFrom, i);
        roadSprayDirtyTo = Math.max(roadSprayDirtyTo, i);
      }
      function emitCarSpray(deltaSeconds, budget) {
        if (weather.wet < 0.15 || budget <= 0) return;
        const lamps = vehicleLampAmount();
        for (let v = 0; v < vehicles.length; v++) {
          const c = vehicles[v],
            speed = Math.abs(c.speed || 0);
          if (speed < 70 || c.hp <= 0 || isAircraft(c)) continue;
          const spec = vehicleSpec(c);
          if (spec.boat || spec.jetski || spec.bicycle) continue;
          if (!entityInView(c, 80)) continue;
          const rate = (speed - 60) * 0.12 * weather.wet * budget,
            count = Math.floor(rate * deltaSeconds + Math.random()),
            // Driven cars' tail lamps (render3d-frame.js lights them the same way), brighter braking.
            driven = c.ai || c === player.car,
            tint = driven ? (c.braking ? Math.max(0.75, lamps) * 1.6 : lamps > 0.25 ? lamps * 0.5 : 0) : 0;
          const cos = Math.cos(c.a),
            sin = Math.sin(c.a),
            ground = entityElevation(c) + 1.2,
            back = spec.l * 0.42;
          for (let k = 0; k < count; k++) {
            const side = Math.random() < 0.5 ? -1 : 1,
              across = side * spec.w * (0.3 + Math.random() * 0.2),
              x = c.x - cos * back - sin * across,
              z = c.y - sin * back + cos * across,
              kick = speed * (0.12 + Math.random() * 0.1);
            spawnRoadSpray(x, ground, z, -cos * kick + (Math.random() - 0.5) * 18 - sin * side * 8, 10 + Math.random() * 16, -sin * kick + (Math.random() - 0.5) * 18 + cos * side * 8, tint);
          }
        }
        if (roadSprayDirtyTo >= roadSprayDirtyFrom) {
          // Only the particles written this frame go to the GPU.
          for (let a = 0; a < ROAD_SPRAY_ATTRIBUTES.length; a++) {
            const attr = roadSprayGeometry.attributes[ROAD_SPRAY_ATTRIBUTES[a]];
            attr.clearUpdateRanges();
            attr.addUpdateRange(roadSprayDirtyFrom * attr.itemSize, (roadSprayDirtyTo - roadSprayDirtyFrom + 1) * attr.itemSize);
            attr.needsUpdate = true;
          }
          roadSprayDirtyFrom = ROAD_SPRAY_MAX;
          roadSprayDirtyTo = -1;
        }
      }
      /* ---- Lightning bolt ---------------------------------------------------------------- */
      const BOLT_MAX_SEGMENTS = 220;
      const boltPositions = new Float32Array(BOLT_MAX_SEGMENTS * 6 * 3),
        boltGeometry = new Three.BufferGeometry();
      boltGeometry.setAttribute('position', new Three.BufferAttribute(boltPositions, 3));
      boltGeometry.setDrawRange(0, 0);
      const boltMaterial = new Three.MeshBasicMaterial({
        color: new Three.Color('#dfe8ff').multiplyScalar(6),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: Three.AdditiveBlending,
        side: Three.DoubleSide,
        fog: false,
      });
      const boltMesh = new Three.Mesh(boltGeometry, boltMaterial);
      boltMesh.frustumCulled = false;
      boltMesh.visible = false;
      boltMesh.renderOrder = 8;
      boltMesh.name = 'lightning bolt';
      scene.add(boltMesh);
      let boltStrike = 0;
      const boltView = new Three.Vector3(),
        boltSide = new Three.Vector3(),
        boltDir = new Three.Vector3();
      // A forked channel from the cloud base to the ground at (x, z), as camera-facing ribbons.
      function buildBolt(x, z, ground, seed) {
        let rnd = seed * 2147483646 + 1;
        const random = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647),
          // (Seen from the street, whose camera never shows the real base: ~110 m up.)
          top = 900,
          paths = [];
        // Midpoint displacement: jagged at every scale, like a real channel.
        const channel = (a, b, rough, depth, out) => {
          if (depth === 0) {
            out.push(b);
            return;
          }
          const m = new Three.Vector3().lerpVectors(a, b, 0.5),
            len = a.distanceTo(b);
          m.x += (random() - 0.5) * len * rough;
          m.z += (random() - 0.5) * len * rough;
          m.y += (random() - 0.5) * len * rough * 0.3;
          channel(a, m, rough, depth - 1, out);
          channel(m, b, rough, depth - 1, out);
        };
        const start = new Three.Vector3(x + (random() - 0.5) * 300, ground + top, z + (random() - 0.5) * 300 - 120),
          end = new Three.Vector3(x, ground, z),
          main = [start];
        channel(start, end, 0.55, 6, main);
        paths.push({ points: main, width: 1.8 });
        // Branches leave the upper two thirds and die out in the air.
        for (let k = 0, count = 2 + Math.floor(random() * 3); k < count; k++) {
          const from = main[Math.floor(random() * main.length * 0.6)],
            to = new Three.Vector3(from.x + (random() - 0.5) * 420, from.y - 120 - random() * 260, from.z + (random() - 0.5) * 420),
            points = [from];
          channel(from, to, 0.6, 4, points);
          paths.push({ points, width: 0.8 });
        }
        camera.getWorldDirection(boltView);
        let v = 0;
        for (const { points, width } of paths)
          for (let i = 0; i + 1 < points.length && v + 6 <= BOLT_MAX_SEGMENTS * 6; i++) {
            const a = points[i],
              b = points[i + 1],
              w = width * (1 - (i / points.length) * 0.5);
            boltDir.subVectors(b, a).normalize();
            boltSide.crossVectors(boltDir, boltView).normalize().multiplyScalar(w);
            const quad = [
              [a.x - boltSide.x, a.y - boltSide.y, a.z - boltSide.z],
              [a.x + boltSide.x, a.y + boltSide.y, a.z + boltSide.z],
              [b.x + boltSide.x, b.y + boltSide.y, b.z + boltSide.z],
              [a.x - boltSide.x, a.y - boltSide.y, a.z - boltSide.z],
              [b.x + boltSide.x, b.y + boltSide.y, b.z + boltSide.z],
              [b.x - boltSide.x, b.y - boltSide.y, b.z - boltSide.z],
            ];
            for (const q of quad) boltPositions.set(q, v++ * 3);
          }
        boltGeometry.setDrawRange(0, v);
        boltGeometry.attributes.position.needsUpdate = true;
      }
      /* ---- Headlights in the rain -------------------------------------------------------- */
      // How far vehicle lamps are on: at night, and in a downpour by day.
      function vehicleLampAmount() {
        return Math.max(nightAmount, clamp((weather.rain - 0.4) / 0.4, 0, 1) * 0.65);
      }
      // No drop falls below the rain box's floor. On the range it reaches down to the lowest
      // ground RAIN_FLOOR_REACH round the view's subject (RAIN_FLOOR_DIP at most below the
      // street there), so rain falls down a slope below the car too and a beam aimed down a
      // descent has drops to light. The city is level: the floor is the street.
      const RAIN_FLOOR_REACH = 32 * UNITS_PER_METRE,
        RAIN_FLOOR_DIP = 12 * UNITS_PER_METRE,
        RAIN_FLOOR_SAMPLES = Object.freeze([1, 0, -1, 0, 0, 1, 0, -1, 0.7, 0.7, -0.7, 0.7, 0.7, -0.7, -0.7, -0.7]);
      function rainFloor(x, y, street) {
        if (!terrainWithin(x, y, RAIN_FLOOR_REACH)) return street;
        let low = street;
        for (let i = 0; i < RAIN_FLOOR_SAMPLES.length; i += 2)
          low = Math.min(low, terrainHeight(x + RAIN_FLOOR_SAMPLES[i] * RAIN_FLOOR_REACH, y + RAIN_FLOOR_SAMPLES[i + 1] * RAIN_FLOOR_REACH));
        return Math.max(low, street - RAIN_FLOOR_DIP);
      }
      // ---- Frame update --------------------------------------------------------------
      const rainAmbientDay = new Three.Color('#b9c8d6'),
        rainAmbientNight = new Three.Color('#3d4a5c'),
        stormBackground = new Three.Color('#8d949c'),
        flashBackground = new Three.Color('#dfe6f2'),
        rainSizeVector = new Three.Vector2();
      let rainClock = 0,
        dripCheck = 0;
      function updateWeatherVisuals(deltaSeconds) {
        const rain = weather.rain,
          cloud = weather.cloud,
          light = daylight(),
          tier = activeTier || graphicsTier(),
          low = tier.name === 'LOW';
        rainClock += deltaSeconds;
        rainUniforms.uTime.value = rainClock;
        rainUniforms.uFlash.value = weather.flash;
        // Rain lit by the sky: pale grey by day, a dim blue by night, whiter in a flash.
        rainUniforms.uAmbient.value.copy(rainAmbientNight).lerp(rainAmbientDay, light).multiplyScalar(1 - cloud * 0.25);
        const street = terrainHeight(cameraTarget.x, cameraTarget.y),
          // In the air the box of rain rides with the aircraft (below the cloud base),
          // so you fly through the streaks instead of looking down on a patch of them.
          ground = flightViewActive
            ? Math.max(street, Math.min(flightAltitude, cloudBaseAt(cameraTarget.x, cameraTarget.y)) - RAIN_TOP * 0.6)
            : rainFloor(cameraTarget.x, cameraTarget.y, street);
        // In the chase view the rain stands round the camera, a little ahead of it (chase-view3d.js).
        const rainX = chaseViewActive ? chaseCam.x + Math.cos(chaseCam.viewYaw) * 260 : viewCenter.x,
          rainZ = chaseViewActive ? chaseCam.y + Math.sin(chaseCam.viewYaw) * 260 : viewCenter.y;
        rainUniforms.uOrigin.value.set(rainX, ground, rainZ);
        // Splashes stay on the street (they are not drawn from the air).
        splashUniforms.uOrigin.value.set(rainX, street, rainZ);
        rainMesh.visible = rain > 0.02;
        if (rainMesh.visible) {
          const drops = Math.min(RAIN_MAX, Math.round((touchEnabled() ? Math.min(tier.rain, 1100) : tier.rain) * clamp(0.25 + rain, 0, 1)));
          rainGeometry.setDrawRange(0, drops * 2);
          rainUniforms.uOpacity.value = clamp(rain * 0.55 + 0.08, 0, 0.62);
          rainUniforms.uFall.value = 950 + rain * 650;
          rainUniforms.uLength.value = 16 + rain * 30;
          const slant = weather.wind * (150 + weather.gust * 120);
          rainUniforms.uWind.value.set(Math.cos(weather.windAngle) * slant, Math.sin(weather.windAngle) * slant);
        }
        // Splashes on the street (not from the air: they would be sub-pixel).
        const splashes = low ? 180 : tier.name === 'MEDIUM' ? 500 : tier.name === 'HIGH' ? 900 : 1400;
        splashMesh.visible = rain > 0.08 && !flightViewActive;
        if (splashMesh.visible) {
          splashGeometry.instanceCount = Math.round(splashes * clamp(rain * 1.2, 0, 1));
          splashUniforms.uReach.value = Math.min(viewReach, 1100);
          splashUniforms.uStrength.value = clamp(rain * 0.6, 0, 0.5);
        }
        // At street level: the near field of rain, the side view's fall and the splashes ahead (weather3d-chase.js).
        updateStreetRain(rain, ground, street, tier);
        // Drips: while it rains and on for a while after, on MEDIUM and up.
        const drip = low || flightViewActive ? 0 : clamp(Math.max(rain * 1.2, (weather.wet - 0.2) * 0.8), 0, 1);
        dripMesh.visible = drip > 0.02;
        if (dripMesh.visible) {
          dripUniforms.uOpacity.value = 0.55 * drip;
          dripUniforms.uGround.value = street;
          dripCheck -= deltaSeconds;
          // At street level round the camera (the view's centre lies far down the street), on the faces it sees.
          const street3d = chaseViewActive,
            focusX = street3d ? chaseCam.x + Math.cos(chaseCam.viewYaw) * DRIP_STREET_AHEAD : viewCenter.x,
            focusY = street3d ? chaseCam.y + Math.sin(chaseCam.viewYaw) * DRIP_STREET_AHEAD : viewCenter.y;
          if (street3d !== dripStreet || (dripCheck <= 0 && hypot2(focusX - dripCenterX, focusY - dripCenterY) > (street3d ? DRIP_STREET_MOVE : viewReach * 0.35))) {
            dripCheck = 0.5;
            dripStreet = street3d;
            dripCenterX = focusX;
            dripCenterY = focusY;
            dripEye.x = chaseCam.x;
            dripEye.y = chaseCam.y;
            placeDrips(dripCenterX, dripCenterY, street3d ? DRIP_STREET_REACH : Math.min(viewReach * 1.3, 1400), street3d ? dripEye : null);
          }
        }
        // Spray behind fast cars on a wet road.
        roadSprayMesh.visible = weather.wet > 0.15 && !low;
        if (roadSprayMesh.visible) {
          const buffer = sceneBufferSize(rainSizeVector),
            ortho = camera.isOrthographicCamera;
          roadSprayUniforms.uPerspective.value = ortho ? 0 : 1;
          roadSprayUniforms.uPixels.value = ortho
            ? buffer.y / Math.max(1, (camera.top - camera.bottom) / (camera.zoom || 1))
            : buffer.y / 2 / Math.tan(((camera.fov || 50) * Math.PI) / 360);
          emitCarSpray(deltaSeconds, tier.name === 'MEDIUM' ? 0.5 : 1);
        }
        updateWetGround(tier, light);
        // Overcast flattens the sun and lifts the ambient; lightning blows both out.
        const overcast = cloud * cloud;
        sun.intensity *= 1 - overcast * 0.62 - rain * 0.12;
        hemi.intensity *= 1 + overcast * 0.22 - rain * 0.1;
        // (The chase view thickens its own haze in the rain: chase-view3d.js, the Haze lines.)
        if (!chaseViewActive) scene.fog.density *= 1 + rain * 2.6 + weather.approach * 0.6;
        const flash = weather.flash;
        if (flash > 0.01) {
          const f = flash * flash;
          sun.intensity += 9 * f;
          hemi.intensity += 3.5 * f;
          scene.background.lerp(flashBackground, f * 0.7);
        } else {
          // Grey the sky down as it clouds over, without losing the dusk colour.
          scene.background.lerp(stormBackground, overcast * 0.4 + weather.approach * 0.1);
          scene.fog.color.lerp(stormBackground, overcast * 0.4);
        }
        // A new strike near enough to see: draw its bolt while its strokes flash.
        const strike = weather.strike;
        if (strike && strike.id !== boltStrike) {
          boltStrike = strike.id;
          const near = Math.hypot(strike.x - viewCenter.x, strike.y - viewCenter.y) < viewReach * 1.6 + 600;
          if (near) buildBolt(strike.x, strike.y, terrainHeight(strike.x, strike.y), strike.seed);
          else boltGeometry.setDrawRange(0, 0);
        }
        boltMesh.visible = !!strike && gameTime - strike.at < 1.2 && flash > 0.03;
        if (boltMesh.visible) boltMaterial.opacity = clamp(flash * 1.4, 0, 1);
      }
      /**
       * WET GROUND
       * The ground shader (surfaces3d.js) draws the wet look from weather.wet
       * (cityWet) at the tier's level: LOW darkens only, MEDIUM adds the glossy
       * film and the sky in it, HIGH and ULTRA standing water with rain rings and
       * the wet reflections pass (postfx3d.js). `WET_MIRROR` is how much of the
       * scene a fully wet surface mirrors (a real puddle seen at the street
       * camera's angle reflects far less; this is the look, not the physics).
       */
      const WET_MIRROR_DAY = 0.55,
        WET_MIRROR_NIGHT = 0.6,
        WET_STREAK_GAIN = 0.65,
        // The sky's share by day and by night: the night sky is the readable
        // blue-hour ambient, and mirrored at the day's share it greyed a wet
        // night road lighter than a dry one (wet asphalt at night reads darker,
        // with the lamps and neon shining in it).
        WET_SKY_SHARE = 0.4,
        WET_SKY_SHARE_NIGHT = 0.14,
        wetGreyScratch = new Three.Color(),
        wetSkyScratch = new Three.Color(),
        wetViewScratch = new Three.Vector3();
      function updateWetGround(tier, light) {
        const wet = weather.wet,
          detail = tier.name === 'LOW' ? 0 : tier.name === 'MEDIUM' ? 1 : 2,
          reflections = wet > 0.01 && detail === 2 && wetReflectionsAvailable(),
          mirror = WET_MIRROR_NIGHT + (WET_MIRROR_DAY - WET_MIRROR_NIGHT) * light;
        wetUniforms.cityWetDetail.value = detail;
        wetUniforms.cityReflectOut.value = reflections ? 1 : 0;
        // The sky the wet road mirrors, about 40 degrees up (the sky shader's
        // gradient there, lighting3d.js), as the environment map holds it.
        // Toned down and greyed: at the street camera's angle a wet road mirrors
        // only a few percent of the sky, and a clear blue sky in the drying
        // patches read as blue paint.
        wetSkyScratch.copy(skyUniforms.uHorizon.value).lerp(skyUniforms.uZenith.value, 0.78);
        const skyGrey = (wetSkyScratch.r + wetSkyScratch.g + wetSkyScratch.b) / 3,
          skyShare = WET_SKY_SHARE_NIGHT + (WET_SKY_SHARE - WET_SKY_SHARE_NIGHT) * light;
        wetSkyScratch.lerp(wetGreyScratch.setScalar(skyGrey), 0.4).multiplyScalar(skyShare);
        wetUniforms.citySkyReflect.value.copy(wetSkyScratch).multiplyScalar(mirror);
        camera.getWorldDirection(wetViewScratch);
        const flat = Math.hypot(wetViewScratch.x, wetViewScratch.z);
        // (At street level 0: the ground runs each streak away from the camera itself, surfaces3d.js.)
        if (chaseViewActive) wetUniforms.citySheenDir.value.set(0, 0);
        else if (flat > 0.05) wetUniforms.citySheenDir.value.set(wetViewScratch.x / flat, wetViewScratch.z / flat);
        wetUniforms.citySheenGain.value = detail === 0 ? 0 : WET_STREAK_GAIN;
        postLook.reflect = reflections ? mirror : 0;
        postLook.reflectSky.copy(wetSkyScratch);
        postLook.reflectShare = skyShare;
        postLook.rain = weather.rain;
        postLook.rainTime = surfaceUniforms.cityRainTime.value;
      }
      /* Storm grade, applied after the time-of-day look (updateLighting): a rainy
         day is darker, flatter and cooler; a flash opens the exposure. */
      function weatherGrade() {
        const light = daylight(),
          rain = weather.rain,
          storm = Math.max(rain, weather.approach * 0.5);
        postLook.exposure *= (1 - storm * 0.16 * light) * (1 + weather.flash * 0.6);
        postLook.saturation *= 1 - storm * 0.1;
        postLook.contrast *= 1 - storm * 0.04;
        postLook.bloomThreshold *= 1 + weather.flash * 0.5;
        // The chase view's rainy air, darker than the sky keys' (weather3d-chase.js).
        chaseRainAir();
      }
      // END SUBSYSTEM: src/weather3d.js
