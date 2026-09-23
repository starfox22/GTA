      // BEGIN SUBSYSTEM: src/wakes3d.js — Boat wakes and spray
      /**
       * Boat wakes and spray
       * Source: src/wakes3d.js
       * Scope: createCityRenderer() closure (included after world3d.js, whose water
       * shader samples the wake map).
       *
       * A wake is part of the sea, so the water shader draws it. Every moving hull
       * (the player's boats, jet skis, police launches, the beach jet skis) leaves
       * a trail of points behind its stern. Each frame those trails and a collar
       * round each hull are rendered top-down into a small WAKE MAP centred on the
       * view: red is foam, green and blue the height of the wake's waves (crest and
       * trough). The water shader (world3d.js) reads it: foam is mixed into the
       * surface colour, and the height's gradient tilts the water's normal, so the
       * wake's waves catch the sun glitter, the sky's fresnel and the moon like the
       * swell around them. Nothing lies on top of the water to surface through it.
       *
       *  - KELVIN WAKE: two diverging crests at the Kelvin half-angle (19.5 degrees,
       *    narrowing towards 11 at planing speed) with feathered divergent waves
       *    along them and transverse waves across the V. The arms spread with the
       *    age of the water they were drawn on, so a turn leaves a curved, fanning
       *    wake and a boat that stops leaves its last wake to spread and fade.
       *  - PROPELLER WASH: churned white water along the track, widening and
       *    breaking up into patches of foam as it ages over ~10-25 seconds (longer
       *    behind bigger hulls).
       *  - HULL: a foam collar hugging the waterline, a bow wave pushed ahead and
       *    to the sides, and a trough along the flanks; a faint lap at rest.
       *  - SPRAY: sheets of spray thrown off the bow shoulders and a rooster tail
       *    astern of jet skis and speedboats, as lit particles (one draw call).
       * All of it scales with speed (as a fraction of the craft's top speed) and
       * with the hull's beam and length.
       */
      const WAKE_MAP_SIZE = touchEnabled() || graphicsTier().name === 'LOW' ? 512 : 1024,
        WAKE_POINTS = 120,
        // Kelvin half-angle, and how far it narrows at planing speed.
        WAKE_TAN_KELVIN = Math.tan((19.47 * Math.PI) / 180),
        WAKE_TAN_PLANING = Math.tan((11 * Math.PI) / 180);
      const wakeTarget = new Three.WebGLRenderTarget(WAKE_MAP_SIZE, WAKE_MAP_SIZE, {
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        minFilter: Three.LinearFilter,
        magFilter: Three.LinearFilter,
      });
      const wakeScene = new Three.Scene(),
        wakeCamera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        // Map origin (x, z) and span in world units, shared by every wake shader.
        wakeFrame = { value: new Three.Vector3(0, 0, 2048) },
        wakeClock = { value: 0 },
        wakeClearColor = new Three.Color();
      waterUniforms.uWake.value = wakeTarget.texture;
      const WAKE_NOISE = `
        float wakeHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
        float wakeNoise( vec2 p ) {
          vec2 i = floor( p ), f = fract( p );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( wakeHash( i ), wakeHash( i + vec2( 1.0, 0.0 ) ), f.x ),
                      mix( wakeHash( i + vec2( 0.0, 1.0 ) ), wakeHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
        }`;
      // World xz -> the wake map's clip space (the map is its own top-down camera).
      const WAKE_PLACE = `
        uniform vec3 uWakeFrame;
        vec4 wakeClip( vec2 world ) {
          return vec4( ( world - uWakeFrame.xy ) / uWakeFrame.z * 2.0 - 1.0, 0.0, 1.0 );
        }`;
      // Additive into the map; foam in red, wave crest in green, trough in blue.
      const wakeBlend = {
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: Three.CustomBlending,
        blendEquation: Three.AddEquation,
        blendSrc: Three.OneFactor,
        blendDst: Three.OneFactor,
      };
      /**
       * TRAIL: a ribbon along the stern's track. Each point stores where the stern
       * was, the heading's normal, when (wake clock) and how fast; the vertex
       * shader widens the ribbon with the age of each point, so the V opens out.
       */
      const trailVertex = `
        ${WAKE_PLACE}
        attribute vec4 aPoint;   // stern x, z, normal x, z
        attribute vec4 aInfo;    // wake-clock time it was left, speed (units/s), side (-1, 1), unused
        uniform float uClock, uHalfBeam, uTopSpeed;
        varying float vLat, vAge, vArm, vSpeed, vArmWidth;
        varying vec2 vWorld;
        void main() {
          float age = max( uClock - aInfo.x, 0.0 );
          float speed = aInfo.y;
          float fraction = clamp( speed / uTopSpeed, 0.0, 1.0 );
          float spread = mix( ${WAKE_TAN_KELVIN.toFixed(4)}, ${WAKE_TAN_PLANING.toFixed(4)}, fraction );
          // The arms leave the hull's shoulders and spread as the water ages; the
          // spreading slows as the waves lose their energy.
          float arm = uHalfBeam * 0.9 + min( age * speed * spread, 260.0 + uHalfBeam * 20.0 ) * ( 1.0 - 0.25 * min( age / 30.0, 1.0 ) );
          float armWidth = 1.4 + uHalfBeam * 0.18 + age * 0.9;
          float ribbonHalf = arm + armWidth * 3.0 + 4.0;
          vec2 world = aPoint.xy + aPoint.zw * aInfo.z * ribbonHalf;
          vLat = aInfo.z * ribbonHalf;
          vAge = age;
          vArm = arm;
          vArmWidth = armWidth;
          vSpeed = speed;
          vWorld = world;
          gl_Position = wakeClip( world );
        }`;
      const trailFragment = `
        ${WAKE_NOISE}
        uniform float uHalfBeam, uTopSpeed, uLife;
        varying float vLat, vAge, vArm, vSpeed, vArmWidth;
        varying vec2 vWorld;
        void main() {
          float fraction = clamp( vSpeed / uTopSpeed, 0.0, 1.0 );
          float fade = exp( -vAge / uLife );
          float lat = abs( vLat );
          float d = vAge * vSpeed;   // how far behind the stern this water was left
          float n1 = wakeNoise( vWorld * 0.075 + vec2( vAge * 0.35, -vAge * 0.21 ) );
          float n2 = wakeNoise( vWorld * 0.21 - vec2( vAge * 0.5, vAge * 0.4 ) );
          float grain = n1 * 0.62 + n2 * 0.38;
          // Propeller wash: churned water in the track, widening, then breaking up
          // into lacy patches (the threshold rises as the foam decays).
          float washWidth = uHalfBeam * ( 0.6 + 0.3 * fraction ) + vAge * 2.4;
          float wash = exp( -pow( lat / washWidth, 2.0 ) ) * ( 0.25 + 0.75 * fraction ) * exp( -vAge / ( uLife * 0.5 ) );
          float lace = smoothstep( 0.2 + 0.5 * ( 1.0 - fade ), 0.75 + 0.2 * ( 1.0 - fade ), grain + 0.35 * exp( -vAge * 0.8 ) );
          float foam = wash * mix( 1.2, lace * 1.1, clamp( vAge / 1.8, 0.0, 1.0 ) );
          // Kelvin arms: a breaking crest along each side of the V.
          float armOffset = lat - vArm;
          float arm = exp( -pow( armOffset / vArmWidth, 2.0 ) );
          foam += arm * fraction * exp( -vAge / ( uLife * 0.3 ) ) * smoothstep( 0.25, 0.7, grain + 0.2 ) * 0.9;
          // Waves: transverse crests across the V, divergent crests feathering off
          // the arms, both stationary relative to the boat.
          float lambda = 8.0 + uHalfBeam * 2.2 + fraction * uHalfBeam * 1.5;
          float inside = 1.0 - smoothstep( vArm * 0.8, vArm * 1.02, lat );
          float transverse = cos( 6.2832 * d / lambda ) * inside * 0.45 * smoothstep( 0.0, uHalfBeam * 2.0, d );
          float feather = cos( 6.2832 * ( armOffset * 1.6 - d * 0.55 ) / lambda ) * exp( -pow( armOffset / ( vArmWidth * 4.0 ), 2.0 ) );
          foam += smoothstep( 0.72, 1.0, feather ) * arm * fraction * 0.35 * exp( -vAge / ( uLife * 0.35 ) );
          float height = ( transverse + feather * 0.8 + arm * 0.9 ) * ( 0.2 + 0.8 * fraction ) * fade;
          // Churned water sits low and rough in the track.
          height -= wash * 0.35 * ( grain - 0.4 );
          gl_FragColor = vec4( foam * fade, max( height, 0.0 ), max( -height, 0.0 ), 1.0 );
        }`;
      /**
       * HULL: a quad under each boat, in the boat's frame, drawing the foam collar
       * at the waterline, the bow wave and the trough along the flanks.
       */
      const hullGeometry = new Three.PlaneGeometry(1, 1);
      const hullVertex = `
        ${WAKE_PLACE}
        uniform vec4 uHull;       // x, z, cos, sin of the heading
        uniform vec2 uHullSize;   // length, beam (world units)
        varying vec2 vLocal;      // along (x) and across (y), in hull half-lengths / half-beams
        varying vec2 vWorld;
        void main() {
          vec2 local = position.xy * vec2( uHullSize.x * 1.9, uHullSize.y * 3.4 );
          vec2 world = uHull.xy + vec2( local.x * uHull.z - local.y * uHull.w, local.x * uHull.w + local.y * uHull.z );
          vLocal = local / ( uHullSize * 0.5 );
          vWorld = world;
          gl_Position = wakeClip( world );
        }`;
      const hullFragment = `
        ${WAKE_NOISE}
        uniform float uFraction, uClock;
        varying vec2 vLocal;
        varying vec2 vWorld;
        void main() {
          float x = vLocal.x, y = vLocal.y;
          // Waterplane: full beam aft, fining to a point at the bow.
          float beam = x > 0.0 ? sqrt( max( 1.0 - x * x, 0.0 ) ) : 1.0 - 0.12 * x * x;
          float edge = x > 1.0 ? length( vec2( ( x - 1.0 ) * 2.2, y ) ) : x < -1.0 ? length( vec2( ( x + 1.0 ) * 3.0, max( abs( y ) - 0.88, 0.0 ) ) ) : abs( y ) - beam;
          if ( x <= 1.0 && x >= -1.0 ) edge = max( edge, 0.0 ) * 1.0;
          float bow = smoothstep( -0.3, 0.9, x );
          float grain = wakeNoise( vWorld * 0.2 + vec2( uClock * 0.9, -uClock * 0.6 ) );
          float collar = exp( -pow( edge / ( 0.14 + 0.25 * uFraction ), 2.0 ) );
          float foam = collar * ( 0.18 + 0.82 * uFraction * ( 0.35 + 0.65 * bow ) ) * ( 0.55 + 0.45 * grain );
          // Bow wave: a crest pushed out ahead and to the sides, a trough behind it.
          float bowWave = exp( -pow( ( edge - 0.3 - 0.3 * uFraction ) / 0.22, 2.0 ) ) * ( 0.3 + 0.7 * bow );
          float trough = exp( -pow( ( edge - 0.05 ) / 0.12, 2.0 ) ) * ( 1.0 - bow * 0.6 );
          float height = ( bowWave * 1.1 - trough * 0.6 ) * ( 0.15 + 0.85 * uFraction );
          // A lap of small ripples round a hull at rest.
          height += sin( edge * 18.0 - uClock * 3.0 ) * exp( -edge * 3.0 ) * 0.12 * ( 1.0 - uFraction );
          foam += smoothstep( 0.55, 1.0, bowWave ) * uFraction * 0.5;
          float outside = smoothstep( 0.0, 0.08, edge + 0.02 );
          gl_FragColor = vec4( foam * outside, max( height, 0.0 ) * outside, max( -height, 0.0 ) * outside, 1.0 );
        }`;
      /**
       * SPRAY: one Points object of lit droplets. Spray is scene light (it goes
       * through the tone curve with everything else), coloured by the sun and sky.
       */
      const SPRAY_CAPACITY = 900,
        sprayPositions = new Float32Array(SPRAY_CAPACITY * 3),
        spraySizes = new Float32Array(SPRAY_CAPACITY),
        sprayAlphas = new Float32Array(SPRAY_CAPACITY),
        spray = [];
      const sprayGeometry = new Three.BufferGeometry();
      sprayGeometry.setAttribute('position', new Three.BufferAttribute(sprayPositions, 3).setUsage(Three.DynamicDrawUsage));
      sprayGeometry.setAttribute('aSize', new Three.BufferAttribute(spraySizes, 1).setUsage(Three.DynamicDrawUsage));
      sprayGeometry.setAttribute('aAlpha', new Three.BufferAttribute(sprayAlphas, 1).setUsage(Three.DynamicDrawUsage));
      const sprayUniforms = {
        uLight: { value: new Three.Color(1, 1, 1) },
        uPixels: { value: 1 },
        uPerspective: { value: 0 },
      };
      const sprayPoints = new Three.Points(
        sprayGeometry,
        new Three.ShaderMaterial({
          uniforms: sprayUniforms,
          transparent: true,
          depthWrite: false,
          vertexShader: `
            attribute float aSize;
            attribute float aAlpha;
            uniform float uPixels, uPerspective;
            varying float vAlpha;
            void main() {
              vec4 mv = modelViewMatrix * vec4( position, 1.0 );
              gl_Position = projectionMatrix * mv;
              gl_PointSize = max( 1.0, aSize * ( uPerspective > 0.5 ? uPixels / max( -mv.z, 1.0 ) : uPixels ) );
              vAlpha = aAlpha;
            }`,
          fragmentShader: `
            uniform vec3 uLight;
            varying float vAlpha;
            void main() {
              vec2 c = gl_PointCoord * 2.0 - 1.0;
              float r = dot( c, c );
              if ( r > 1.0 ) discard;
              // A droplet cloud: soft edge, a little brighter on top (lit side).
              float a = ( 1.0 - r ) * vAlpha;
              gl_FragColor = vec4( uLight * ( 0.8 + 0.3 * ( 1.0 - gl_PointCoord.y ) ), a );
            }`,
        }),
      );
      sprayPoints.frustumCulled = false;
      sprayPoints.renderOrder = 8;
      sprayPoints.userData.dynamic = true;
      sprayGeometry.setDrawRange(0, 0);
      scene.add(sprayPoints);
      // ---- Emitters -----------------------------------------------------------------------
      const wakeEmitters = new Map(),
        trailIndex = [];
      for (let i = 0; i < WAKE_POINTS - 1; i++) trailIndex.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      function makeWakeEmitter(key) {
        const geometry = new Three.BufferGeometry(),
          points = new Float32Array(WAKE_POINTS * 2 * 4),
          info = new Float32Array(WAKE_POINTS * 2 * 4);
        geometry.setAttribute('aPoint', new Three.BufferAttribute(points, 4).setUsage(Three.DynamicDrawUsage));
        geometry.setAttribute('aInfo', new Three.BufferAttribute(info, 4).setUsage(Three.DynamicDrawUsage));
        // A dummy position attribute: three.js wants one to count vertices.
        geometry.setAttribute('position', new Three.BufferAttribute(new Float32Array(WAKE_POINTS * 2 * 3), 3));
        geometry.setIndex(trailIndex);
        geometry.setDrawRange(0, 0);
        const trailUniforms = {
          uWakeFrame: wakeFrame,
          uClock: wakeClock,
          uHalfBeam: { value: 6 },
          uTopSpeed: { value: 300 },
          uLife: { value: 12 },
        };
        const trail = new Three.Mesh(
          geometry,
          new Three.ShaderMaterial({ uniforms: trailUniforms, vertexShader: trailVertex, fragmentShader: trailFragment, ...wakeBlend }),
        );
        trail.frustumCulled = false;
        const hullUniforms = {
          uWakeFrame: wakeFrame,
          uClock: wakeClock,
          uHull: { value: new Three.Vector4() },
          uHullSize: { value: new Three.Vector2(30, 12) },
          uFraction: { value: 0 },
        };
        const hull = new Three.Mesh(
          hullGeometry,
          new Three.ShaderMaterial({ uniforms: hullUniforms, vertexShader: hullVertex, fragmentShader: hullFragment, ...wakeBlend }),
        );
        hull.frustumCulled = false;
        wakeScene.add(trail, hull);
        const emitter = {
          key,
          count: 0,
          points,
          info,
          geometry,
          trail,
          hull,
          trailUniforms,
          hullUniforms,
          seen: 0,
          spray: 0,
          x: 0,
          y: 0,
        };
        wakeEmitters.set(key, emitter);
        return emitter;
      }
      function writeTrailPoint(e, i, x, y, nx, ny, time, speed) {
        for (const side of [0, 1]) {
          const o = (i * 2 + side) * 4;
          e.points[o] = x;
          e.points[o + 1] = y;
          e.points[o + 2] = nx;
          e.points[o + 3] = ny;
          e.info[o] = time;
          e.info[o + 1] = speed;
          e.info[o + 2] = side ? 1 : -1;
        }
      }
      let wakeFrameCount = 0;
      /**
       * Called every frame for each craft on the water. `key` identifies the craft
       * (the vehicle object); x, y its centre, a its heading, speed in units per
       * second (signed), then its length, beam and top speed. `spraying` false
       * keeps the hull's wake but throws no spray (a boat under a bridge deck).
       */
      function wakeEmit(key, x, y, a, speed, length, beam, topSpeed, spraying = true) {
        const e = wakeEmitters.get(key) || makeWakeEmitter(key),
          cos = Math.cos(a),
          sin = Math.sin(a),
          sternX = x - cos * length * 0.42,
          sternY = y - sin * length * 0.42,
          moving = Math.abs(speed),
          time = wakeClock.value;
        // A jump (teleport, respawn) starts a new trail.
        if (e.count && Math.hypot(sternX - e.x, sternY - e.y) > 400) e.count = 0;
        e.seen = wakeFrameCount;
        e.x = sternX;
        e.y = sternY;
        e.a = a;
        e.speed = moving;
        e.length = length;
        e.beam = beam;
        e.topSpeed = topSpeed;
        e.spraying = spraying;
        e.trailUniforms.uHalfBeam.value = beam * 0.5;
        e.trailUniforms.uTopSpeed.value = topSpeed;
        // Bigger hulls churn more water that lasts longer.
        e.trailUniforms.uLife.value = 9 + Math.min(16, length * 0.12);
        e.hullUniforms.uHull.value.set(x, y, cos, sin);
        e.hullUniforms.uHullSize.value.set(length, beam);
        e.hullUniforms.uFraction.value = clamp(moving / topSpeed, 0, 1);
        // Point 0 rides at the stern; a new point is committed every few metres of
        // track (closer together for small craft, so turns stay smooth).
        const spacing = clamp(beam * 0.5, 5, 14) + moving * 0.12;
        if (!e.count) {
          writeTrailPoint(e, 0, sternX, sternY, -sin, cos, time, moving);
          writeTrailPoint(e, 1, sternX, sternY, -sin, cos, time, moving);
          e.count = 2;
        } else {
          const lx = e.points[8],
            ly = e.points[9];
          if (Math.hypot(sternX - lx, sternY - ly) > spacing && moving > 4) {
            e.points.copyWithin(8, 0, (WAKE_POINTS - 1) * 8);
            e.info.copyWithin(8, 0, (WAKE_POINTS - 1) * 8);
            e.count = Math.min(WAKE_POINTS, e.count + 1);
          }
          writeTrailPoint(e, 0, sternX, sternY, -sin, cos, time, moving);
          // The first committed point keeps the live speed until the next one,
          // so a boat that stops dead does not leave a fresh, full-speed V.
          if (moving < 4) for (const o of [8, 12]) e.info[o + 1] = Math.min(e.info[o + 1], moving);
        }
      }
      // ---- Spray ----------------------------------------------------------------------------
      function throwSpray(e, deltaSeconds) {
        const fraction = clamp(e.speed / e.topSpeed, 0, 1);
        if (!e.spraying || fraction < 0.12) return;
        const cos = Math.cos(e.a),
          sin = Math.sin(e.a),
          vx = cos * e.speed,
          vy = sin * e.speed,
          small = e.length < 40,
          // Bow sheets: both shoulders, more of it the faster and wider the hull.
          rate = fraction * fraction * (small ? 70 : 40 + e.beam * 2.2);
        e.spray += rate * deltaSeconds;
        while (e.spray >= 1 && spray.length < SPRAY_CAPACITY) {
          e.spray -= 1;
          const side = Math.random() < 0.5 ? -1 : 1,
            along = e.length * (small ? 0.5 : 0.62) + Math.random() * e.length * 0.12,
            out = (14 + 40 * fraction) * (0.6 + Math.random() * 0.6);
          spray.push({
            x: e.x + cos * along - sin * side * e.beam * 0.5,
            y: e.y + sin * along + cos * side * e.beam * 0.5,
            z: -1.5 + Math.random() * 2,
            vx: vx * 0.55 - sin * side * out,
            vy: vy * 0.55 + cos * side * out,
            vz: (16 + 36 * fraction) * (0.6 + Math.random() * 0.7),
            life: 0,
            max: 0.55 + Math.random() * 0.45,
            size: (small ? 2.2 : 3.2) + Math.random() * 2.5 + e.beam * 0.08,
          });
        }
        // Rooster tail: jet skis and fast runabouts throw a plume astern.
        if (e.length < 64 && fraction > 0.35) {
          e.tail = (e.tail || 0) + fraction * fraction * fraction * 55 * deltaSeconds;
          while (e.tail >= 1 && spray.length < SPRAY_CAPACITY) {
            e.tail -= 1;
            const back = 20 + Math.random() * 40 * fraction;
            spray.push({
              x: e.x + (Math.random() - 0.5) * e.beam * 0.3,
              y: e.y + (Math.random() - 0.5) * e.beam * 0.3,
              z: 0,
              vx: vx * 0.35 - cos * back + (Math.random() - 0.5) * 16,
              vy: vy * 0.35 - sin * back + (Math.random() - 0.5) * 16,
              vz: 30 + Math.random() * 40 * fraction,
              life: 0,
              max: 0.7 + Math.random() * 0.5,
              size: 3 + Math.random() * 3,
            });
          }
        }
      }
      function updateSpray(deltaSeconds) {
        let n = 0;
        for (let i = spray.length - 1; i >= 0; i--) {
          const p = spray[i];
          p.life += deltaSeconds;
          p.vz -= 150 * deltaSeconds;
          const drag = Math.exp(-deltaSeconds * 1.6);
          p.vx *= drag;
          p.vy *= drag;
          p.x += p.vx * deltaSeconds;
          p.y += p.vy * deltaSeconds;
          p.z += p.vz * deltaSeconds;
          if (p.life >= p.max || p.z < -3) {
            spray[i] = spray[spray.length - 1];
            spray.pop();
          }
        }
        for (const p of spray) {
          const t = p.life / p.max;
          sprayPositions[n * 3] = p.x;
          sprayPositions[n * 3 + 1] = p.z;
          sprayPositions[n * 3 + 2] = p.y;
          spraySizes[n] = p.size * (0.7 + t * 1.3);
          sprayAlphas[n] = 0.55 * (1 - t) * Math.min(1, t * 8);
          n++;
        }
        sprayGeometry.setDrawRange(0, n);
        if (n) {
          for (const name of ['position', 'aSize', 'aAlpha']) sprayGeometry.attributes[name].needsUpdate = true;
        }
        sprayPoints.visible = n > 0;
      }
      // ---- Frame update ---------------------------------------------------------------------
      const wakeBuffer = new Three.Vector2();
      /**
       * Once a frame, after every craft has called wakeEmit(): retire trails nobody
       * feeds any more once they have faded, upload the rest, draw the wake map
       * round the view and hand it to the water.
       */
      function updateWakes(deltaSeconds) {
        wakeClock.value += deltaSeconds;
        const time = wakeClock.value;
        let live = 0;
        for (const [key, e] of wakeEmitters) {
          const fed = e.seen === wakeFrameCount;
          // Trails outlive their craft (a boat that is gone still leaves its wake
          // behind), until even the youngest point has faded.
          const youngest = e.count ? time - e.info[0] : Infinity;
          if (!fed && youngest > e.trailUniforms.uLife.value * 3) {
            wakeScene.remove(e.trail, e.hull);
            e.geometry.dispose();
            e.trail.material.dispose();
            e.hull.material.dispose();
            wakeEmitters.delete(key);
            continue;
          }
          e.hull.visible = fed;
          if (fed) throwSpray(e, deltaSeconds);
          // Drop points older than the wake lasts.
          const oldest = e.trailUniforms.uLife.value * 3;
          while (e.count > 2 && time - e.info[(e.count - 1) * 8] > oldest) e.count--;
          e.geometry.setDrawRange(0, Math.max(0, (e.count - 1) * 6));
          e.geometry.attributes.aPoint.needsUpdate = true;
          e.geometry.attributes.aInfo.needsUpdate = true;
          live++;
        }
        wakeFrameCount++;
        updateSpray(deltaSeconds);
        waterUniforms.uWakeOn.value = live ? 1 : 0;
        if (!live) return;
        // The map follows the view, snapped to whole texels so the wake does not
        // shimmer as the camera scrolls; it widens (coarser) as the view opens out.
        const span = clamp(viewReach * 2.2, 2048, 6144),
          texel = span / WAKE_MAP_SIZE,
          ox = Math.round((viewCenter.x - span / 2) / texel) * texel,
          oz = Math.round((viewCenter.y - span / 2) / texel) * texel;
        wakeFrame.value.set(ox, oz, span);
        waterUniforms.uWakeRect.value.set(ox, oz, 1 / span, 1 / WAKE_MAP_SIZE);
        // Spray is lit by the sun and the sky like everything else (and dims at
        // night more than the lighting's legibility boost would let it).
        sprayUniforms.uLight.value
          .copy(sun.color)
          .multiplyScalar(sun.intensity * 0.28)
          .add(wakeClearColor.copy(hemi.color).multiplyScalar(hemi.intensity * 0.36))
          .multiplyScalar(0.3 + 0.7 * daylight());
        renderer.getDrawingBufferSize(wakeBuffer);
        sprayUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
        sprayUniforms.uPixels.value = camera.isPerspectiveCamera
          ? (wakeBuffer.y / 2) * camera.projectionMatrix.elements[5]
          : wakeBuffer.y / (camera.top - camera.bottom);
        const clearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(wakeClearColor);
        renderer.setRenderTarget(wakeTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, false, false);
        renderer.render(wakeScene, wakeCamera);
        renderer.setRenderTarget(null);
        renderer.setClearColor(wakeClearColor, clearAlpha);
      }
      // END SUBSYSTEM: src/wakes3d.js
