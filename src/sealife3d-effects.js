      // Sea life 3D life map, blood clouds, foam rings, wakes and spray.
      /* ---- Under the surface: the life map --------------------------------------------------- */
      const LIFE_MAP_SIZE = touchEnabled() || graphicsTier().name === 'LOW' ? 512 : 1024;
      const lifeTarget = new Three.WebGLRenderTarget(LIFE_MAP_SIZE, LIFE_MAP_SIZE, {
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        minFilter: Three.LinearFilter,
        magFilter: Three.LinearFilter,
      });
      const lifeScene = new Three.Scene(),
        lifeCamera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        lifeFrame = { value: new Three.Vector3(0, 0, 2048) },
        lifeClock = { value: 0 };
      waterUniforms.uLife.value = lifeTarget.texture;
      const lifeBlend = {
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: Three.CustomBlending,
        blendEquation: Three.MaxEquation,
        blendSrc: Three.OneFactor,
        blendDst: Three.OneFactor,
      };
      // Silhouettes: the same instanced meshes seen from above, dark by depth.
      for (const name of ['dolphin', 'shark']) {
        const sp = seaSpecies[name];
        const material = new Three.ShaderMaterial({
          uniforms: { uLifeFrame: lifeFrame },
          defines: { SEA_KIND: sp.spec.kind },
          vertexShader: `
            ${SEA_DEFORM}
            uniform vec3 uLifeFrame;
            varying float vDepth;
            void main() {
              vec3 p = position;
              vec3 n = normal;
              seaDeform( p, n );
              vec4 world = modelMatrix * instanceMatrix * vec4( p, 1.0 );
              vDepth = ${SEA_SURFACE.toFixed(2)} - world.y;
              gl_Position = vec4( ( world.xz - uLifeFrame.xy ) / uLifeFrame.z * 2.0 - 1.0, 0.0, 1.0 );
            }`,
          fragmentShader: `
            varying float vDepth;
            void main() {
              if ( vDepth < 0.2 ) discard;
              // Darkest just under the surface, fading out by about 11 m down.
              float k = smoothstep( 0.2, 2.5, vDepth ) * ( 1.0 - smoothstep( 12.0, 90.0, vDepth ) );
              gl_FragColor = vec4( k * 0.92, 0.0, 0.0, 0.0 );
            }`,
          ...lifeBlend,
          side: Three.DoubleSide,
        });
        const ghost = new Three.InstancedMesh(sp.geometry, material, sp.spec.capacity);
        ghost.instanceMatrix = sp.mesh.instanceMatrix;
        ghost.frustumCulled = false;
        ghost.count = 0;
        lifeScene.add(ghost);
        sp.ghost = ghost;
      }
      // Blood clouds (green channel): soft, torn, spreading and fading. One
      // InstancedMesh like the silhouettes: each instance's matrix carries the
      // cloud's centre (x, z), the time it was spilled (y) and its size (scale).
      const BLOOD_CAPACITY = 6,
        seaQuad = new Three.PlaneGeometry(2, 2),
        bloodMatrix = new Three.Matrix4();
      const bloodMesh = new Three.InstancedMesh(
        seaQuad,
        new Three.ShaderMaterial({
          uniforms: { uLifeFrame: lifeFrame, uClock: lifeClock },
          vertexShader: `
            uniform vec3 uLifeFrame;
            uniform float uClock;
            varying vec2 vLocal;
            varying float vAge;
            varying float vSize;
            void main() {
              vec4 cloud = instanceMatrix[3];
              float size = instanceMatrix[0][0];
              float age = max( uClock - cloud.y, 0.0 );
              float radius = size * ( 10.0 + 34.0 * sqrt( age ) ) + 6.0;
              vec2 world = cloud.xz + position.xy * radius;
              vLocal = position.xy;
              vAge = age;
              vSize = size;
              gl_Position = vec4( ( world - uLifeFrame.xy ) / uLifeFrame.z * 2.0 - 1.0, 0.0, 1.0 );
            }`,
          fragmentShader: `
            ${WAKE_NOISE}
            varying vec2 vLocal;
            varying float vAge;
            varying float vSize;
            void main() {
              float r = length( vLocal );
              float torn = wakeNoise( vLocal * 3.0 + vAge * 0.15 ) * 0.6 + wakeNoise( vLocal * 7.0 - vAge * 0.2 ) * 0.4;
              float cloud = 1.0 - smoothstep( 0.35 + 0.45 * torn, 1.0, r );
              float k = cloud * ( 0.35 + 0.65 * torn ) * min( 1.0, vAge * 3.0 ) * exp( -vAge / 22.0 ) * clamp( vSize, 0.0, 1.0 );
              gl_FragColor = vec4( 0.0, k, 0.0, 0.0 );
            }`,
          ...lifeBlend,
        }),
        BLOOD_CAPACITY,
      );
      bloodMesh.instanceMatrix.setUsage(Three.DynamicDrawUsage);
      bloodMesh.count = 0;
      bloodMesh.frustumCulled = false;
      lifeScene.add(bloodMesh);
      const bloodClouds = [];
      /* ---- Foam rings and splash foam in the wake map ---------------------------------------- */
      const RING_CAPACITY = 24,
        ringData = new Float32Array(RING_CAPACITY * 4),
        ringGeometry = new Three.InstancedBufferGeometry();
      ringGeometry.setIndex(seaQuad.index);
      ringGeometry.setAttribute('position', seaQuad.getAttribute('position'));
      const ringAttr = new Three.InstancedBufferAttribute(ringData, 4).setUsage(Three.DynamicDrawUsage);
      ringGeometry.setAttribute('iRing', ringAttr);
      ringGeometry.instanceCount = 0;
      const ringMesh = new Three.Mesh(
        ringGeometry,
        new Three.ShaderMaterial({
          uniforms: { uWakeFrame: wakeFrame, uClock: wakeClock },
          vertexShader: `
            ${WAKE_PLACE}
            attribute vec4 iRing;   // x, z, wake-clock time, size
            uniform float uClock;
            varying vec2 vWorld;
            varying float vAge, vRadius, vSize;
            void main() {
              float age = max( uClock - iRing.z, 0.0 );
              vRadius = iRing.w * ( 4.0 + 15.0 * sqrt( age ) );
              vec2 world = iRing.xy + position.xy * ( vRadius + 14.0 * iRing.w + 6.0 );
              vWorld = world - iRing.xy;
              vAge = age;
              vSize = iRing.w;
              gl_Position = wakeClip( world );
            }`,
          fragmentShader: `
            ${WAKE_NOISE}
            varying vec2 vWorld;
            varying float vAge, vRadius, vSize;
            void main() {
              float d = length( vWorld );
              float grain = wakeNoise( vWorld * 0.35 + vAge ) * 0.6 + wakeNoise( vWorld * 0.9 - vAge * 1.3 ) * 0.4;
              float fade = exp( -vAge / ( 1.1 + vSize * 0.9 ) );
              // The ring of foam thrown out, broken up as it spreads.
              float ringWidth = 1.5 + vSize * 1.5 + vAge * 1.2;
              float ring = exp( -pow( ( d - vRadius ) / ringWidth, 2.0 ) ) * smoothstep( 0.35, 0.8, grain + 0.2 * fade );
              // White water where it went in, torn into lace within a second or two.
              float whiteWater = exp( -pow( d / ( 3.0 + vSize * 5.0 + vAge * 2.0 ), 2.0 ) ) * smoothstep( 0.35 + 0.45 * ( 1.0 - fade ), 0.9, grain + 0.25 * fade );
              float foam = ( ring * 0.75 + whiteWater ) * fade;
              // Ripples running out: crest and trough.
              float wave = cos( ( d - vRadius ) * 0.55 ) * exp( -pow( ( d - vRadius * 0.85 ) / ( 5.0 + vSize * 6.0 ), 2.0 ) ) * exp( -vAge / ( 2.5 + vSize * 1.5 ) );
              gl_FragColor = vec4( foam, max( wave, 0.0 ) * 0.9, max( -wave, 0.0 ) * 0.9, 0.0 );
            }`,
          ...wakeBlend,
        }),
      );
      ringMesh.frustumCulled = false;
      wakeScene.add(ringMesh);
      const foamRings = [];
      function sealifeWakeLive() {
        return foamRings.length;
      }
      /* ---- Splash particles --------------------------------------------------------------------- */
      const SEA_SPRAY_CAPACITY = 900,
        seaSprayPos = new Float32Array(SEA_SPRAY_CAPACITY * 3),
        seaSprayColor = new Float32Array(SEA_SPRAY_CAPACITY * 3),
        seaSpraySize = new Float32Array(SEA_SPRAY_CAPACITY),
        seaSprayAlpha = new Float32Array(SEA_SPRAY_CAPACITY),
        seaSpray = [];
      const seaSprayGeometry = new Three.BufferGeometry();
      seaSprayGeometry.setAttribute('position', new Three.BufferAttribute(seaSprayPos, 3).setUsage(Three.DynamicDrawUsage));
      seaSprayGeometry.setAttribute('aColor', new Three.BufferAttribute(seaSprayColor, 3).setUsage(Three.DynamicDrawUsage));
      seaSprayGeometry.setAttribute('aSize', new Three.BufferAttribute(seaSpraySize, 1).setUsage(Three.DynamicDrawUsage));
      seaSprayGeometry.setAttribute('aAlpha', new Three.BufferAttribute(seaSprayAlpha, 1).setUsage(Three.DynamicDrawUsage));
      const seaSprayUniforms = { uLight: { value: new Three.Color(1, 1, 1) }, uPixels: { value: 1 }, uPerspective: { value: 0 } };
      const seaSprayPoints = new Three.Points(
        seaSprayGeometry,
        new Three.ShaderMaterial({
          uniforms: seaSprayUniforms,
          transparent: true,
          depthWrite: false,
          vertexShader: `
            attribute vec3 aColor;
            attribute float aSize;
            attribute float aAlpha;
            uniform float uPixels, uPerspective;
            varying float vAlpha;
            varying vec3 vColor;
            void main() {
              vec4 mv = modelViewMatrix * vec4( position, 1.0 );
              gl_Position = projectionMatrix * mv;
              gl_PointSize = max( 1.0, aSize * ( uPerspective > 0.5 ? uPixels / max( -mv.z, 1.0 ) : uPixels ) );
              vAlpha = aAlpha;
              vColor = aColor;
            }`,
          fragmentShader: `
            uniform vec3 uLight;
            varying float vAlpha;
            varying vec3 vColor;
            void main() {
              vec2 c = gl_PointCoord * 2.0 - 1.0;
              float r = dot( c, c );
              if ( r > 1.0 ) discard;
              float a = ( 1.0 - r ) * ( 1.0 - r * 0.4 ) * vAlpha;
              gl_FragColor = vec4( vColor * uLight * ( 0.85 + 0.3 * ( 1.0 - gl_PointCoord.y ) ), a );
            }`,
        }),
      );
      seaSprayPoints.frustumCulled = false;
      seaSprayPoints.renderOrder = 9;
      seaSprayPoints.userData.dynamic = true;
      seaSprayGeometry.setDrawRange(0, 0);
      scene.add(seaSprayPoints);
      function seaThrow(x, y, z, vx, vy, vz, size, life, r, g, b, alpha = 0.55, drag = 1.4) {
        if (seaSpray.length >= SEA_SPRAY_CAPACITY) return;
        seaSpray.push({ x, y, z, vx, vy, vz, size, life: 0, max: life, r, g, b, alpha, drag });
      }
      /* A burst of water from (x, y): `size` 1 is a dolphin going in, 2+ the breach. */
      function seaSplash(x, y, size, a = 0, options = {}) {
        const n = Math.round(26 * size * size + 14),
          up = 26 + 22 * size,
          ring = 12 + 18 * size;
        for (let i = 0; i < n; i++) {
          const t = Math.random() * TAU,
            out = ring * (0.3 + Math.random() * 0.9),
            // A crown of droplets thrown up and out.
            vz = up * (0.5 + Math.random() * 0.9);
          seaThrow(x + Math.cos(t) * size * 3, y + Math.sin(t) * size * 3, SEA_SURFACE + 0.5, Math.cos(t) * out, Math.sin(t) * out, vz, (1.6 + Math.random() * 2.4) * (0.7 + size * 0.35), 0.7 + Math.random() * 0.6 + size * 0.2, 1, 1, 1, 0.6);
        }
        // A column of heavier water where it went in (the breach throws a wall).
        const col = Math.round(10 * size + 4);
        for (let i = 0; i < col; i++)
          seaThrow(x + (Math.random() - 0.5) * size * 5, y + (Math.random() - 0.5) * size * 5, SEA_SURFACE + Math.random() * 3, (Math.random() - 0.5) * 18 * size + Math.cos(a) * 10, (Math.random() - 0.5) * 18 * size + Math.sin(a) * 10, up * (1 + Math.random() * 0.8) * (options.fall ? 0.8 : 1.15), (4 + Math.random() * 5) * size * 0.9, 0.9 + Math.random() * 0.5 + size * 0.25, 1, 1, 1, 0.5, 0.9);
        // Mist hanging after.
        const mist = Math.round(6 * size);
        for (let i = 0; i < mist; i++)
          seaThrow(x + (Math.random() - 0.5) * 16 * size, y + (Math.random() - 0.5) * 16 * size, SEA_SURFACE + 2 + Math.random() * 6 * size, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 4 + Math.random() * 6, (8 + Math.random() * 8) * size, 1.6 + Math.random() * 1.2, 0.95, 0.97, 1, 0.16, 2.5);
      }
      function seaBlow(x, y, size) {
        // A dolphin's blow: a short upward puff that drifts and thins.
        for (let i = 0; i < 16; i++)
          seaThrow(x + (Math.random() - 0.5) * 1.2, y + (Math.random() - 0.5) * 1.2, SEA_SURFACE + 2.5, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (14 + Math.random() * 12) * size, (1.4 + Math.random() * 1.8) * size, 0.6 + Math.random() * 0.5, 0.96, 0.98, 1, 0.42, 3.2);
      }
      function seaBloodSpray(x, y, size) {
        for (let i = 0; i < 40 * size; i++) {
          const t = Math.random() * TAU,
            out = 10 + Math.random() * 26;
          seaThrow(x, y, SEA_SURFACE + 6 + Math.random() * 8, Math.cos(t) * out, Math.sin(t) * out, 12 + Math.random() * 34, 1.4 + Math.random() * 2.4, 0.7 + Math.random() * 0.6, 0.62, 0.05, 0.05, 0.75);
        }
      }
      function updateSeaSpray(deltaSeconds) {
        let n = 0;
        for (let i = seaSpray.length - 1; i >= 0; i--) {
          const p = seaSpray[i];
          p.life += deltaSeconds;
          p.vz -= GRAVITY * 1.15 * deltaSeconds;
          const drag = Math.exp(-deltaSeconds * p.drag);
          p.vx *= drag;
          p.vy *= drag;
          if (p.drag > 2) p.vz *= drag;
          p.x += p.vx * deltaSeconds;
          p.y += p.vy * deltaSeconds;
          p.z += p.vz * deltaSeconds;
          if (p.life >= p.max || p.z < SEA_SURFACE - 3) {
            seaSpray[i] = seaSpray[seaSpray.length - 1];
            seaSpray.pop();
          }
        }
        for (const p of seaSpray) {
          const t = p.life / p.max;
          seaSprayPos[n * 3] = p.x;
          seaSprayPos[n * 3 + 1] = p.z;
          seaSprayPos[n * 3 + 2] = p.y;
          seaSprayColor[n * 3] = p.r;
          seaSprayColor[n * 3 + 1] = p.g;
          seaSprayColor[n * 3 + 2] = p.b;
          seaSpraySize[n] = p.size * (0.7 + t * 1.2);
          seaSprayAlpha[n] = p.alpha * (1 - t) * Math.min(1, t * 10);
          n++;
        }
        seaSprayGeometry.setDrawRange(0, n);
        if (n) for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) seaSprayGeometry.attributes[name].needsUpdate = true;
        seaSprayPoints.visible = n > 0;
      }
      /* ---- Events from the game ------------------------------------------------------------------ */
      let seaEventSeen = 0;
      function seaAddRing(x, y, size) {
        if (foamRings.length >= RING_CAPACITY) foamRings.shift();
        foamRings.push({ x, y, t: wakeClock.value, size });
      }
      function seaHandleEvents() {
        for (const e of seaEvents) {
          if (e.id <= seaEventSeen) continue;
          seaEventSeen = e.id;
          if (Math.abs(e.x - viewCenter.x) > viewReach * 2 + 400 || Math.abs(e.y - viewCenter.y) > viewReach * 2 + 400) continue;
          if (e.kind === 'splash') {
            seaSplash(e.x, e.y, e.size, e.a || 0);
            seaAddRing(e.x, e.y, e.size * (e.ring ? 1.1 : 0.7));
          } else if (e.kind === 'breach') {
            seaSplash(e.x, e.y, e.size, e.a || 0, { fall: !!e.fall });
            seaAddRing(e.x, e.y, e.size * 1.2);
            seaAddRing(e.x, e.y, e.size * 0.6);
          } else if (e.kind === 'ripple') seaAddRing(e.x, e.y, e.size * 0.5);
          else if (e.kind === 'blow') seaBlow(e.x, e.y, e.size);
          else if (e.kind === 'blood') {
            if (bloodClouds.length >= BLOOD_CAPACITY) bloodClouds.shift();
            bloodClouds.push({ x: e.x, y: e.y, t: lifeClock.value, size: e.size });
            seaBloodSpray(e.x, e.y, Math.min(1.5, e.size));
          }
        }
      }
      /* ---- Per frame -------------------------------------------------------------------------------- */
      const seaLifeStats = { gulls: 0, dolphins: 0, shark: 0, spray: 0, rings: 0, blood: 0, lifeMap: false, drawCalls: 0, cpuMs: 0, cpuMsAverage: 0 };
      const sharkFinKey = { id: 'shark fin' };
      const seaLifeBuffer = new Three.Vector2();
      function seaNear(x, y, margin) {
        return Math.abs(x - viewCenter.x) < viewReach + margin && Math.abs(y - viewCenter.y) < viewReach + margin;
      }
      function updateSeaLifeVisuals(deltaSeconds) {
        const started = performance.now();
        lifeClock.value += deltaSeconds;
        seaHandleEvents();
        // Dolphins.
        const dol = seaSpecies.dolphin;
        let n = 0;
        for (const pod of dolphinPods) {
          if (!seaNear(pod.x, pod.y, 300)) continue;
          for (const m of pod.members) {
            if (n >= dol.spec.capacity) break;
            const flukes = m.mode === 'leap' ? 0.6 : m.mode === 'rise' ? 3.4 : 2 + clamp(m.speed / 60, 0, 1) * 1.2;
            seaPlace(dol, n, m.x, m.z, m.y, m.a, m.pitch, m.roll, m.scale, m.phase, flukes);
            n++;
            // At the surface: a wake off the back.
            if (Math.abs(m.z - SEA_SURFACE) < 3.5 && m.mode !== 'leap') wakeEmit(m, m.x, m.y, m.a, m.speed, 18 * m.scale, 4 * m.scale, 90, false);
          }
        }
        dol.mesh.count = dol.ghost.count = n;
        dol.drawn = n;
        if (n) {
          dol.mesh.instanceMatrix.needsUpdate = true;
          dol.anim.needsUpdate = true;
        }
        // The shark.
        const sh = seaSpecies.shark;
        const sharkShown = shark.active && seaNear(shark.x, shark.y, 300);
        if (sharkShown) {
          seaPlace(sh, 0, shark.x, shark.z, shark.y, shark.a, shark.pitch, shark.roll, 1, shark.phase, 2.4 + shark.speed / 20, shark.mouth);
          sh.mesh.instanceMatrix.needsUpdate = true;
          sh.anim.needsUpdate = true;
          // The fin cutting the surface leaves its own narrow wake.
          const finX = shark.x + Math.cos(shark.a) * 3,
            finY = shark.y + Math.sin(shark.a) * 3,
            finTop = shark.z + 0.5 * SEA_M + 0.95 * SEA_M;
          if (finTop > SEA_SURFACE + 1 && shark.z < SEA_SURFACE && shark.finUp > 0.3) wakeEmit(sharkFinKey, finX, finY, shark.a, shark.speed, 10, 2.4, 22, false);
        }
        sh.mesh.count = sh.ghost.count = sharkShown ? 1 : 0;
        sh.drawn = sharkShown ? 1 : 0;
        // Gulls.
        const gu = seaSpecies.gull;
        let k = 0;
        for (const g of gulls) {
          if (g.mode === 'off' || !seaNear(g.x, g.y, 120)) continue;
          // A perched gull bobs its head now and then; a flier banks into its turns.
          seaPlace(gu, k, g.x, g.z, g.y, g.a, g.mode === 'perch' ? 0.12 : g.pitch * 0.6, g.mode === 'perch' ? 0 : -g.bank, 1, g.flap, g.fold);
          k++;
        }
        gu.mesh.count = k;
        gu.drawn = k;
        if (k) {
          gu.mesh.instanceMatrix.needsUpdate = true;
          gu.anim.needsUpdate = true;
        }
        // Rings into the wake map.
        const now = wakeClock.value;
        while (foamRings.length && now - foamRings[0].t > 9) foamRings.shift();
        for (let i = 0; i < foamRings.length; i++) {
          const r = foamRings[i];
          ringData[i * 4] = r.x;
          ringData[i * 4 + 1] = r.y;
          ringData[i * 4 + 2] = r.t;
          ringData[i * 4 + 3] = r.size;
        }
        ringGeometry.instanceCount = foamRings.length;
        ringMesh.visible = foamRings.length > 0;
        if (foamRings.length) ringAttr.needsUpdate = true;
        // Blood.
        while (bloodClouds.length && lifeClock.value - bloodClouds[0].t > 45) bloodClouds.shift();
        for (let i = 0; i < bloodClouds.length; i++) {
          const c = bloodClouds[i];
          bloodMatrix.makeScale(c.size, c.size, c.size).setPosition(c.x, c.t, c.y);
          bloodMesh.setMatrixAt(i, bloodMatrix);
        }
        bloodMesh.count = bloodClouds.length;
        bloodMesh.visible = bloodClouds.length > 0;
        if (bloodClouds.length) bloodMesh.instanceMatrix.needsUpdate = true;
        // Spray, lit like the wakes' spray.
        seaSprayUniforms.uLight.value
          .copy(sun.color)
          .multiplyScalar(sun.intensity * 0.3)
          .add(seaLifeTmpColor.copy(hemi.color).multiplyScalar(hemi.intensity * 0.38))
          .multiplyScalar(0.3 + 0.7 * daylight());
        sceneBufferSize(seaLifeBuffer);
        seaSprayUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
        seaSprayUniforms.uPixels.value = camera.isPerspectiveCamera ? (seaLifeBuffer.y / 2) * camera.projectionMatrix.elements[5] : seaLifeBuffer.y / (camera.top - camera.bottom);
        updateSeaSpray(deltaSeconds);
        // The life map, only when something is under the water in view.
        const lifeOn = n > 0 || sharkShown || bloodClouds.length > 0;
        waterUniforms.uLifeOn.value = lifeOn ? 1 : 0;
        if (lifeOn) {
          const span = clamp(viewReach * 2.2, 2048, 6144),
            texel = span / LIFE_MAP_SIZE,
            ox = Math.round((viewCenter.x - span / 2) / texel) * texel,
            oz = Math.round((viewCenter.y - span / 2) / texel) * texel;
          lifeFrame.value.set(ox, oz, span);
          waterUniforms.uLifeRect.value.set(ox, oz, 1 / span, 1 / LIFE_MAP_SIZE);
          const clearAlpha = renderer.getClearAlpha();
          renderer.getClearColor(seaLifeTmpColor);
          renderer.setRenderTarget(lifeTarget);
          renderer.setClearColor(0x000000, 0);
          renderer.clear(true, false, false);
          renderer.render(lifeScene, lifeCamera);
          renderer.setRenderTarget(null);
          renderer.setClearColor(seaLifeTmpColor, clearAlpha);
        }
        seaLifeStats.gulls = k;
        seaLifeStats.dolphins = n;
        seaLifeStats.shark = sharkShown ? 1 : 0;
        seaLifeStats.spray = seaSpray.length;
        seaLifeStats.rings = foamRings.length;
        seaLifeStats.blood = bloodClouds.length;
        seaLifeStats.lifeMap = lifeOn;
        // Camera pass: one per species shown and the spray; shadow pass: gulls;
        // life map: dolphins, shark, blood; wake map: the rings.
        seaLifeStats.drawCalls = (k ? 2 : 0) + (n ? 1 : 0) + (sharkShown ? 1 : 0) + (seaSpray.length ? 1 : 0);
        seaLifeStats.offscreenCalls = (lifeOn ? (n ? 1 : 0) + (sharkShown ? 1 : 0) + (bloodClouds.length ? 1 : 0) : 0) + (foamRings.length ? 1 : 0);
        const ms = performance.now() - started;
        seaLifeStats.cpuMs = +ms.toFixed(3);
        seaLifeStats.cpuMsAverage = +(seaLifeStats.cpuMsAverage * 0.95 + ms * 0.05).toFixed(3);
      }
      const seaLifeTmpColor = new Three.Color();
      sealifeRenderStats = () => ({ ...seaLifeStats, triangles: { dolphin: seaSpecies.dolphin.geometry.index.count / 3, shark: seaSpecies.shark.geometry.index.count / 3, gull: seaSpecies.gull.geometry.index.count / 3 } });
      /* ---- HUD: the SHARK! warning ----------------------------------------------------------------- */
      function drawSealifeOverlay3D(api) {
        const w = sharkWarning();
        if (!w || gameMode !== 'play') return;
        const pulse = 0.65 + 0.35 * Math.sin(gameTime * (w.phase === 'dive' ? 16 : 7)),
          me = api.project(player.x, player.y, entityElevation(player) + 4),
          fin = api.project(w.x, w.y, SEA_SURFACE + 4),
          ctx = worldContext;
        ctx.save();
        // The banner.
        const cx = viewportWidth / 2,
          top = Math.max(96, viewportHeight * 0.14);
        ctx.textAlign = 'center';
        ctx.font = '900 34px Arial';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(20, 6, 6, 0.8)';
        ctx.fillStyle = 'rgba(255, ' + Math.round(70 + 40 * (1 - pulse)) + ', 60, ' + (0.75 + 0.25 * pulse) + ')';
        const title = w.phase === 'dive' ? 'SHARK! BELOW YOU' : 'SHARK!';
        ctx.strokeText(title, cx, top);
        ctx.fillText(title, cx, top);
        ctx.font = 'bold 12px monospace';
        ctx.lineWidth = 3;
        const sub = w.phase === 'dive' ? 'GET OUT OF THE WATER' : 'GET OUT OF THE WATER · ' + distanceLabel(w.d) + (w.exit ? ' · way out ' + distanceLabel(distanceBetween(player, w.exit)) : '');
        ctx.strokeText(sub, cx, top + 20);
        ctx.fillStyle = '#f6e3d6';
        ctx.fillText(sub, cx, top + 20);
        // The arrow round the swimmer, pointing at the fin.
        if (w.phase !== 'dive' && !me.behind) {
          const a = Math.atan2(fin.y - me.y, fin.x - me.x),
            r = 46 + 6 * pulse;
          ctx.save();
          ctx.translate(me.x + Math.cos(a) * r, me.y + Math.sin(a) * r);
          ctx.rotate(a);
          ctx.fillStyle = 'rgba(255, 72, 56, ' + (0.7 + 0.3 * pulse) + ')';
          ctx.strokeStyle = 'rgba(20, 6, 6, 0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-8, -10);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-8, 10);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
          ctx.restore();
          // Brackets round the fin when it is on screen.
          if (!fin.behind && fin.x > 20 && fin.x < viewportWidth - 20 && fin.y > 60 && fin.y < viewportHeight - 60) {
            const s = 16 + 4 * pulse;
            ctx.strokeStyle = 'rgba(255, 72, 56, ' + (0.55 + 0.35 * pulse) + ')';
            ctx.lineWidth = 2;
            for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              ctx.beginPath();
              ctx.moveTo(fin.x + dx * s, fin.y + dy * s * 0.55);
              ctx.lineTo(fin.x + dx * s, fin.y + dy * s);
              ctx.lineTo(fin.x + dx * s * 0.55, fin.y + dy * s);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }
