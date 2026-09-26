      // ---- Mud, dust, splats and tracks -----------------------------------------------------------
      const MUD_CLUMPS = 640,
        MUD_MIST = 360,
        MUD_SPLATS = 700,
        MUD_TRACKS = 1800;
      // Clumps: lit, instanced lumps flying ballistic arcs.
      const clumpMesh = new Three.InstancedMesh(
          new Three.IcosahedronGeometry(1, 0),
          new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0 }),
          MUD_CLUMPS,
        ),
        clump = {
          x: new Float32Array(MUD_CLUMPS),
          y: new Float32Array(MUD_CLUMPS),
          z: new Float32Array(MUD_CLUMPS),
          vx: new Float32Array(MUD_CLUMPS),
          vy: new Float32Array(MUD_CLUMPS),
          vz: new Float32Array(MUD_CLUMPS),
          life: new Float32Array(MUD_CLUMPS),
          size: new Float32Array(MUD_CLUMPS),
          wet: new Float32Array(MUD_CLUMPS),
          count: 0,
        };
      clumpMesh.count = 0;
      clumpMesh.frustumCulled = false;
      clumpMesh.castShadow = false;
      clumpMesh.userData.dynamic = true;
      clumpMesh.name = 'mud clumps';
      clumpMesh.setColorAt(0, new Three.Color(1, 1, 1));
      scene.add(clumpMesh);
      // Mist and dust: soft billboards with their own size and opacity.
      function billboardPool(capacity, name) {
        const geo = new Three.InstancedBufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const at = (n) => new Three.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(Three.DynamicDrawUsage);
        geo.setAttribute('iPos', at(3));
        geo.setAttribute('iSize', at(1));
        geo.setAttribute('iAlpha', at(1));
        geo.setAttribute('iColor', at(3));
        geo.instanceCount = 0;
        const material = new Three.ShaderMaterial({
          uniforms: { uLight: { value: 1 } },
          vertexShader: `
            attribute vec3 iPos; attribute float iSize; attribute float iAlpha; attribute vec3 iColor;
            varying vec2 vUv; varying float vAlpha; varying vec3 vColor;
            void main() {
              vec3 right = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] );
              vec3 up = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] );
              vec3 p = iPos + ( right * position.x + up * position.y ) * iSize;
              vUv = position.xy + 0.5; vAlpha = iAlpha; vColor = iColor;
              gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
            }`,
          fragmentShader: `
            uniform float uLight; varying vec2 vUv; varying float vAlpha; varying vec3 vColor;
            void main() {
              float d = length( vUv - 0.5 ) * 2.0;
              float a = ( 1.0 - smoothstep( 0.35, 1.0, d ) ) * vAlpha;
              if ( a < 0.01 ) discard;
              gl_FragColor = vec4( vColor * uLight, a );
              #include <colorspace_fragment>
            }`,
          transparent: true,
          depthWrite: false,
        });
        const meshPool = new Three.Mesh(geo, material);
        meshPool.frustumCulled = false;
        meshPool.renderOrder = 3;
        meshPool.name = name;
        meshPool.userData.dynamic = true;
        scene.add(meshPool);
        return {
          mesh: meshPool,
          geo,
          x: new Float32Array(capacity),
          y: new Float32Array(capacity),
          z: new Float32Array(capacity),
          vx: new Float32Array(capacity),
          vy: new Float32Array(capacity),
          vz: new Float32Array(capacity),
          life: new Float32Array(capacity),
          max: new Float32Array(capacity),
          size: new Float32Array(capacity),
          grow: new Float32Array(capacity),
          alpha: new Float32Array(capacity),
          r: new Float32Array(capacity),
          g: new Float32Array(capacity),
          b: new Float32Array(capacity),
          count: 0,
          capacity,
        };
      }
      const mist = billboardPool(MUD_MIST, 'mud mist');
      /*
       * Ground decals (splats and tracks): a quad per instance laid on the ground
       * along `iAxis` (its length) and `iSide` (its width), multiplied into what is
       * under it, fading from its birth over `iLife.y` seconds.
       */
      function decalPool(capacity, texture, name) {
        const geo = new Three.InstancedBufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const at = (n) => new Three.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(Three.DynamicDrawUsage);
        geo.setAttribute('iPos', at(3));
        geo.setAttribute('iAxis', at(3));
        geo.setAttribute('iSide', at(3));
        geo.setAttribute('iLife', at(3));
        geo.instanceCount = 0;
        const material = new Three.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uMap: { value: texture } },
          vertexShader: `
            attribute vec3 iPos; attribute vec3 iAxis; attribute vec3 iSide; attribute vec3 iLife;
            varying vec2 vUv; varying float vFade; varying float vWet;
            uniform float uTime;
            void main() {
              vec3 p = iPos + iAxis * position.x + iSide * position.y;
              vUv = uv;
              float age = uTime - iLife.x;
              vFade = clamp( 1.0 - age / iLife.y, 0.0, 1.0 ) * step( 0.0, age );
              vWet = iLife.z;
              gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
            }`,
          fragmentShader: `
            uniform sampler2D uMap; varying vec2 vUv; varying float vFade; varying float vWet;
            void main() {
              vec4 t = texture2D( uMap, vUv );
              float a = t.a * vFade;
              if ( a < 0.01 ) discard;
              // Multiplied into the ground: dark, wet mud darker still.
              vec3 tint = mix( vec3( 0.7, 0.6, 0.5 ), vec3( 0.46, 0.37, 0.29 ), vWet ) * ( 0.85 + 0.3 * t.r );
              gl_FragColor = vec4( mix( vec3( 1.0 ), tint, a ), 1.0 );
            }`,
          transparent: true,
          depthWrite: false,
          blending: Three.CustomBlending,
          blendSrc: Three.DstColorFactor,
          blendDst: Three.ZeroFactor,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        });
        const meshPool = new Three.Mesh(geo, material);
        meshPool.frustumCulled = false;
        meshPool.renderOrder = 1;
        meshPool.name = name;
        meshPool.userData.dynamic = true;
        scene.add(meshPool);
        return { mesh: meshPool, geo, material, next: 0, used: 0, capacity };
      }
      function decalTexture(paint) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const g = canvas.getContext('2d');
        paint(g);
        const tx = new Three.CanvasTexture(canvas);
        tx.anisotropy = 4;
        return tx;
      }
      // A splat: a lumpy blob with droplets flung round it.
      const splatTexture = decalTexture((g) => {
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.beginPath();
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * TAU,
            rr = 30 + rnd() * 16;
          if (i) g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr);
          else g.moveTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr);
        }
        g.fill();
        for (let i = 0; i < 26; i++) {
          const a = rnd() * TAU,
            d = 36 + rnd() * 26;
          g.beginPath();
          g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1.5 + rnd() * 5, 0, TAU);
          g.fill();
        }
        g.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < 120; i++) {
          g.fillStyle = `rgba(${rnd() < 0.5 ? 60 : 255},0,0,0.25)`;
          g.fillRect(rnd() * 128, rnd() * 128, 5, 5);
        }
      });
      // A tread print: chevron lugs across the track, soft edges.
      const trackTexture = decalTexture((g) => {
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.fillRect(0, 22, 128, 84);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        for (let x = -16; x < 144; x += 16) {
          g.beginPath();
          g.moveTo(x, 24);
          g.lineTo(x + 7, 24);
          g.lineTo(x + 13, 64);
          g.lineTo(x + 7, 104);
          g.lineTo(x, 104);
          g.lineTo(x + 6, 64);
          g.fill();
        }
      });
      trackTexture.wrapS = Three.RepeatWrapping;
      const mudSplats = decalPool(MUD_SPLATS, splatTexture, 'mud splats'),
        tyreTracks = decalPool(MUD_TRACKS, trackTexture, 'tyre tracks');
      const decalNormal = new Three.Vector3(),
        decalAlong = new Three.Vector3(),
        decalAcross = new Three.Vector3();
      // Lays one decal on the ground at (x, y) along heading `a`.
      function addGroundDecal(pool, x, y, a, length, width, seconds, wet) {
        const i = pool.next;
        pool.next = (pool.next + 1) % pool.capacity;
        pool.used = Math.min(pool.capacity, pool.used + 1);
        const h = terrainHeight(x, y),
          sx = (terrainHeight(x + 2, y) - terrainHeight(x - 2, y)) / 4,
          sy = (terrainHeight(x, y + 2) - terrainHeight(x, y - 2)) / 4;
        decalNormal.set(-sx, 1, -sy).normalize();
        decalAlong.set(Math.cos(a), 0, Math.sin(a));
        decalAlong.y = sx * decalAlong.x + sy * decalAlong.z;
        decalAlong.normalize();
        decalAcross.crossVectors(decalNormal, decalAlong).normalize();
        const at = pool.geo.attributes,
          lift = 0.12 + (h > 0.2 ? 0.1 : 0);
        at.iPos.setXYZ(i, x + decalNormal.x * lift, h + 0.06 + decalNormal.y * lift, y + decalNormal.z * lift);
        at.iAxis.setXYZ(i, decalAlong.x * length, decalAlong.y * length, decalAlong.z * length);
        at.iSide.setXYZ(i, decalAcross.x * width, decalAcross.y * width, decalAcross.z * width);
        at.iLife.setXYZ(i, gameTime, seconds, wet);
        for (const name of ['iPos', 'iAxis', 'iSide', 'iLife']) at[name].needsUpdate = true;
        pool.geo.instanceCount = pool.used;
      }
      function spawnClump(x, y, z, vx, vy, vz, size, wet) {
        if (clump.count >= MUD_CLUMPS) return;
        const i = clump.count++;
        clump.x[i] = x;
        clump.y[i] = y;
        clump.z[i] = z;
        clump.vx[i] = vx;
        clump.vy[i] = vy;
        clump.vz[i] = vz;
        clump.life[i] = 2.2;
        clump.size[i] = size;
        clump.wet[i] = wet;
      }
      function spawnMist(x, y, z, vx, vy, vz, size, grow, alpha, life, color) {
        if (mist.count >= mist.capacity) return;
        const i = mist.count++;
        mist.x[i] = x;
        mist.y[i] = y;
        mist.z[i] = z;
        mist.vx[i] = vx;
        mist.vy[i] = vy;
        mist.vz[i] = vz;
        mist.size[i] = size;
        mist.grow[i] = grow;
        mist.alpha[i] = alpha;
        mist.life[i] = mist.max[i] = life;
        mist.r[i] = color.r;
        mist.g[i] = color.g;
        mist.b[i] = color.b;
      }
      const MUD_WET = new Three.Color('#35261a'),
        MUD_DRY = new Three.Color('#8c7353'),
        DUST = new Three.Color('#a8957a'),
        clumpColor = new Three.Color(),
        clumpMatrix = new Three.Matrix4(),
        clumpQuat = new Three.Quaternion(),
        clumpEuler = new Three.Euler(),
        clumpScale = new Three.Vector3(),
        clumpPos = new Three.Vector3();
      // Wheel contact points of a model in body space (club trucks: their knuckles).
      function contactWheels(c, m) {
        if (m.contacts) return m.contacts;
        const spec = vehicleSpec(c),
          list = [];
        if (m.knuckles) for (const k of m.knuckles) list.push({ x: k.x, z: k.z, driven: k.driven, r: m.wheelRadius, width: OFFROAD_BODIES[spec.clubModel].wheel.width, emit: 0, lastX: NaN, lastY: NaN });
        else if (m.wheels?.length && m.wheels[0].wheel.position)
          for (const { wheel } of m.wheels) {
            // Other models are built at design size and drawn at modelScale.
            const k = m.modelScale || 1,
              x = wheel.position.x * k,
              drive = spec.drive || (spec.offroad ? '4x4' : 'rwd');
            list.push({ x, z: wheel.position.z * k, driven: drive === '4x4' || (drive === 'fwd' ? x > 0 : x < 0), r: (wheel.position.y || 4) * k, width: 2.6 * k, emit: 0, lastX: NaN, lastY: NaN });
          }
        m.contacts = list;
        return list;
      }
      // Throw mud (or dust) from a vehicle's tyres and lay its tracks.
      function vehicleSpray(c, m, deltaSeconds) {
        const onRange = !!c.offroadState,
          dirt = onRange || (c.x > CITY_SIZE - 200 && landAt(c.x, c.y) && !onRoad(c.x, c.y) && !onCountyRoad(c.x, c.y, 2));
        if (!dirt || isAircraft(c) || isBoat(c) || c.hp <= 0) return;
        const along = c.speed || 0,
          speed = Math.abs(along),
          spin = c.wheelSpin || 0,
          mud = onRange ? c.surfaceMud || 0 : 0.05,
          wet = clamp(0.45 + 0.55 * (weather.wet || 0), 0, 1) * (mud > 0.1 ? 1 : 0.4),
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          wheelSpeed = speed + (c.spinSpeed || 0),
          dir = along < -2 ? -1 : 1,
          base = entityElevation(c);
        for (const w of contactWheels(c, m)) {
          const wx = c.x + cos * w.x - sin * w.z,
            wy = c.y + sin * w.x + cos * w.z;
          // Tracks: a print every metre and a half of travel.
          if (w.lastX !== w.lastX) {
            w.lastX = wx;
            w.lastY = wy;
          }
          const moved = Math.hypot(wx - w.lastX, wy - w.lastY);
          if (moved > 12 || (moved > 2 && spin > 0.5 && moved > 6)) {
            if (moved < 40) addGroundDecal(tyreTracks, (wx + w.lastX) / 2, (wy + w.lastY) / 2, Math.atan2(wy - w.lastY, wx - w.lastX), moved + 1, w.width * 0.95, 90 + mud * 120, mud > 0.15 ? wet : 0.1);
            w.lastX = wx;
            w.lastY = wy;
          } else if (spin > 0.6 && speed < 8 && Math.random() < deltaSeconds * 4) addGroundDecal(tyreTracks, wx, wy, c.a, w.r * 1.2, w.width, 120, wet);
          if (!w.driven && spin > 0.1) continue;
          // How much is thrown: spin in mud throws the most; speed through mud some;
          // dry dirt only a haze.
          const rate = (spin * 150 + speed * (mud * 0.6 + 0.03)) * (w.driven ? 1 : 0.4) * (mud > 0.1 ? 1 : 0.25);
          w.emit += rate * deltaSeconds;
          while (w.emit >= 1) {
            w.emit -= 1;
            const throwSpeed = Math.min(160, wheelSpeed) * (0.25 + Math.random() * 0.35),
              up = 14 + Math.random() * 28 + throwSpeed * 0.35,
              sideways = (Math.random() - 0.5) * 16 + Math.sign(w.z) * Math.random() * 10,
              ox = wx - cos * dir * w.r * 0.8,
              oy = wy - sin * dir * w.r * 0.8,
              oz = base + w.r * (0.35 + Math.random() * 0.5),
              vx = -cos * dir * throwSpeed - sin * sideways + (c.vx || 0) * 0.85,
              vy = -sin * dir * throwSpeed + cos * sideways + (c.vy || 0) * 0.85;
            if (mud > 0.1) {
              spawnClump(ox, oz, oy, vx, up, vy, 0.45 + Math.random() * 0.75, wet);
              // Droplets fly off with it, faster and smaller.
              spawnClump(ox, oz, oy, vx * 1.2 + (Math.random() - 0.5) * 20, up * (0.7 + Math.random() * 0.6), vy * 1.2 + (Math.random() - 0.5) * 20, 0.2 + Math.random() * 0.2, wet);
              if (Math.random() < 0.5) {
                clumpColor.copy(MUD_DRY).lerp(MUD_WET, wet).multiplyScalar(0.8);
                spawnMist(ox, oz, oy, vx * 0.5, up * 0.4, vy * 0.5, 1.6 + Math.random() * 1.2, 4, 0.5, 0.7 + Math.random() * 0.5, clumpColor);
              }
            } else if (Math.random() < 0.6) spawnMist(ox, oz - w.r * 0.3, oy, vx * 0.35, 4 + Math.random() * 6, vy * 0.35, 2.5 + Math.random() * 2, 9, 0.3, 1.6 + Math.random(), DUST);
          }
        }
      }
      function updateMudParticles(deltaSeconds) {
        const g = GRAVITY,
          drag = Math.exp(-0.35 * deltaSeconds);
        let n = clump.count;
        for (let i = 0; i < n; i++) {
          clump.vy[i] -= g * deltaSeconds;
          clump.vx[i] *= drag;
          clump.vz[i] *= drag;
          clump.x[i] += clump.vx[i] * deltaSeconds;
          clump.y[i] += clump.vy[i] * deltaSeconds;
          clump.z[i] += clump.vz[i] * deltaSeconds;
          clump.life[i] -= deltaSeconds;
          let dead = clump.life[i] <= 0;
          if (!dead && clump.vy[i] < 0) {
            const ground = terrainHeight(clump.x[i], clump.z[i]);
            if (clump.y[i] <= ground + 0.1) {
              dead = true;
              // A splat where it lands (the bigger lumps).
              if (clump.size[i] > 0.4 || Math.random() < 0.35) addGroundDecal(mudSplats, clump.x[i], clump.z[i], Math.random() * TAU, clump.size[i] * 7, clump.size[i] * 7, 70, clump.wet[i]);
            }
          }
          if (dead) {
            n--;
            for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'size', 'wet']) clump[k][i] = clump[k][n];
            i--;
          }
        }
        clump.count = n;
        for (let i = 0; i < n; i++) {
          const s = clump.size[i];
          clumpEuler.set(clump.life[i] * 7, clump.life[i] * 5, i);
          clumpQuat.setFromEuler(clumpEuler);
          clumpScale.set(s * 1.2, s * 0.8, s);
          clumpPos.set(clump.x[i], clump.y[i], clump.z[i]);
          clumpMatrix.compose(clumpPos, clumpQuat, clumpScale);
          clumpMesh.setMatrixAt(i, clumpMatrix);
          clumpMesh.setColorAt(i, clumpColor.copy(MUD_DRY).lerp(MUD_WET, clump.wet[i]));
        }
        clumpMesh.count = n;
        clumpMesh.instanceMatrix.needsUpdate = true;
        if (clumpMesh.instanceColor) clumpMesh.instanceColor.needsUpdate = true;
        // Mist and dust.
        const at = mist.geo.attributes,
          mistDrag = Math.exp(-2.2 * deltaSeconds);
        n = mist.count;
        for (let i = 0; i < n; i++) {
          mist.life[i] -= deltaSeconds;
          if (mist.life[i] <= 0) {
            n--;
            for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'size', 'grow', 'alpha', 'r', 'g', 'b']) mist[k][i] = mist[k][n];
            i--;
            continue;
          }
          mist.vx[i] *= mistDrag;
          mist.vz[i] *= mistDrag;
          mist.vy[i] = mist.vy[i] * mistDrag - g * 0.08 * deltaSeconds;
          mist.x[i] += mist.vx[i] * deltaSeconds;
          mist.y[i] += mist.vy[i] * deltaSeconds;
          mist.z[i] += mist.vz[i] * deltaSeconds;
          mist.size[i] += mist.grow[i] * deltaSeconds;
        }
        mist.count = n;
        for (let i = 0; i < n; i++) {
          const t = mist.life[i] / mist.max[i];
          at.iPos.setXYZ(i, mist.x[i], mist.y[i], mist.z[i]);
          at.iSize.setX(i, mist.size[i]);
          at.iAlpha.setX(i, mist.alpha[i] * t * Math.min(1, (1 - t) * 8));
          at.iColor.setXYZ(i, mist.r[i], mist.g[i], mist.b[i]);
        }
        for (const name of ['iPos', 'iSize', 'iAlpha', 'iColor']) at[name].needsUpdate = true;
        mist.geo.instanceCount = n;
        mist.mesh.material.uniforms.uLight.value = (1 - 0.8 * nightAmount) * 0.72;
      }
      // ---- The club's flag pole (the flag itself below) ----------------------------------------------
      const trailClubGroup = new Three.Group();
      trailClubGroup.name = '4x4 club';
      scene.add(trailClubGroup);
      batchGroups.push(trailClubGroup);
      const trailClubLive = new Three.Group();
      trailClubLive.name = '4x4 club (animated)';
      scene.add(trailClubLive);
      const clubStone = staticMat('#77756d', 0.95);
      function canvasMap(width, height, paint) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        paint(canvas.getContext('2d'), width, height);
        const tx = new Three.CanvasTexture(canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      // The club block itself (clubhouse, workshop, yard, lot, gate and its carved
      // sign) is built with the mountain village kit: mountain-club3d.js.
      statics.push({ x: OFFROAD_CLUB.lot.x + OFFROAD_CLUB.lot.w / 2, y: OFFROAD_CLUB.lot.y + OFFROAD_CLUB.lot.h / 2, group: trailClubGroup, radius: 420 });
      // ---- The flag: club colours on a pole, flying ----------------------------------------------
      const flagPoint = OFFROAD_CLUB.flag,
        flagGeometry = new Three.PlaneGeometry(14, 9, 12, 4);
      flagGeometry.translate(7, 0, 0);
      const flagBase = Float32Array.from(flagGeometry.attributes.position.array),
        clubFlag = new Three.Mesh(
          flagGeometry,
          new Three.MeshStandardMaterial({
            map: canvasMap(256, 160, (g) => {
              g.fillStyle = '#2f5d3a';
              g.fillRect(0, 0, 256, 160);
              g.fillStyle = '#d9a441';
              g.fillRect(0, 118, 256, 14);
              g.fillStyle = '#f2e8cf';
              g.beginPath();
              g.moveTo(40, 110);
              g.lineTo(96, 34);
              g.lineTo(122, 70);
              g.lineTo(150, 28);
              g.lineTo(214, 110);
              g.fill();
              g.fillStyle = '#2f5d3a';
              g.font = `bold 34px ${POLICE_FONT}`;
              g.textAlign = 'center';
              g.fillText('4X4', 128, 100);
            }),
            side: Three.DoubleSide,
            roughness: 0.85,
          }),
        );
      clubFlag.position.set(flagPoint.x + 0.4, 50, flagPoint.y);
      clubFlag.castShadow = true;
      trailClubLive.add(clubFlag);
      box(trailClubGroup, flagPoint.x, 28, flagPoint.y, 0.7, 56, 0.7, staticMat('#d8dadc', 0.3, 0.7));
      mesh(sphereGeo, staticMat('#d9a441', 0.3, 0.8), trailClubGroup, flagPoint.x, 56.4, flagPoint.y, 0.8, 0.8, 0.8);
      function waveFlag() {
        const pos = flagGeometry.attributes.position,
          wind = weather.wind || 0.4,
          t = gameTime * (4 + wind * 4),
          angle = weather.windAngle || 0;
        for (let i = 0; i < pos.count; i++) {
          const x = flagBase[i * 3],
            y = flagBase[i * 3 + 1],
            f = x / 14;
          pos.setXYZ(i, x * (0.96 + 0.04 * Math.cos(t)), y - f * f * (1.6 - wind), Math.sin(x * 0.55 - t + y * 0.08) * f * (1.2 + wind * 1.4));
        }
        pos.needsUpdate = true;
        flagGeometry.computeVertexNormals();
        clubFlag.rotation.y = -angle;
      }
      // ---- Trail furniture: start gate, checkpoints, rock steps, finish ------------------------------
      const trailGroup = new Three.Group();
      trailGroup.name = 'hill climb course';
      scene.add(trailGroup);
      batchGroups.push(trailGroup);
      const bannerMaterial = (text, colors = ['#1d1f22', '#f6ead0', '#e2721f']) =>
        new Three.MeshStandardMaterial({
          map: canvasMap(512, 96, (g, W, H) => {
            g.fillStyle = colors[0];
            g.fillRect(0, 0, W, H);
            // Chequered ends.
            for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) {
              g.fillStyle = colors[1];
              g.fillRect(i * 16, j * 32, 16, 32);
              g.fillRect(W - 96 + i * 16, j * 32, 16, 32);
            }
            g.fillStyle = colors[1];
            g.font = `bold 54px ${POLICE_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(text, W / 2, H / 2 + 3);
            g.fillStyle = colors[2];
            g.fillRect(96, H - 8, W - 192, 5);
          }),
          side: Three.DoubleSide,
          roughness: 0.8,
        });
      function gateAt(trail, point, text, width, height) {
        const path = trail.path,
          i = point.i,
          next = path[Math.min(path.length - 1, i + 1)],
          prev = path[Math.max(0, i - 1)],
          dx = next[0] - prev[0],
          dy = next[1] - prev[1],
          len = Math.hypot(dx, dy) || 1,
          px = -dy / len,
          py = dx / len,
          half = trail.width / 2 + 5,
          ground = terrainHeight(point.x, point.y);
        for (const side of [-1, 1]) {
          const x = point.x + px * half * side,
            y = point.y + py * half * side,
            h = terrainHeight(x, y);
          box(trailGroup, x, h + height / 2 - 2, y, 1.1, height + 4, 1.1, staticMat('#e8e6df', 0.5));
          box(trailGroup, x, h + 1.2, y, 2.4, 2.4, 2.4, staticMat('#e2721f', 0.7));
        }
        if (text) {
          const banner = new Three.Mesh(new Three.PlaneGeometry(half * 2, width), bannerMaterial(text));
          banner.position.set(point.x, ground + height - 1, point.y);
          banner.rotation.y = -Math.atan2(py, px);
          trailGroup.add(banner);
        } else {
          for (const side of [-1, 1]) {
            const x = point.x + px * half * side,
              y = point.y + py * half * side,
              h = terrainHeight(x, y),
              f = new Three.Mesh(new Three.PlaneGeometry(6, 4), bannerMaterial('', ['#f6ead0', '#1d1f22', '#1d1f22']));
            f.position.set(x + px * 3 * side, h + height - 1, y + py * 3 * side);
            f.rotation.y = -Math.atan2(py, px);
            trailGroup.add(f);
          }
        }
      }
      MOUNTAIN_TRAILS.forEach((trail, t) => {
        const course = trailCourse(t);
        gateAt(trail, course.start, 'HILL CLIMB · START', 5, 26);
        course.checkpoints.forEach((cp) => gateAt(trail, cp, null, 0, 16));
        // Rock steps: slabs across the trail, every other path sample in the band.
        const sections = OFFROAD_SECTIONS[t];
        for (const band of sections.rocks) {
          const i0 = Math.round(band.from * (trail.path.length - 1)),
            i1 = Math.round(band.to * (trail.path.length - 1));
          for (let i = i0 - (i0 % 2); i <= i1; i += 2) {
            const [x, y] = trail.path[i],
              next = trail.path[Math.min(trail.path.length - 1, i + 1)],
              a = Math.atan2(next[1] - y, next[0] - x);
            for (let k = -2; k <= 2; k++) {
              const across = k * trail.width * 0.2 + (terrainHash(i, k + 9, 5) - 0.5) * 3,
                sx = x - Math.sin(a) * across,
                sy = y + Math.cos(a) * across,
                h = terrainHeight(sx, sy),
                slab = mesh(new Three.IcosahedronGeometry(1, 0), clubStone, trailGroup, sx, h + 0.35, sy, 3.2 + terrainHash(i, k, 3) * 2, 1.1, 4.5 + terrainHash(i, k, 4) * 2.5);
              slab.rotation.y = -a + (terrainHash(i, k, 6) - 0.5) * 0.5;
            }
          }
        }
        const top = trail.path.at(-1),
          prevTop = trail.path.at(-6);
        gateAt(trail, { x: prevTop[0], y: prevTop[1], i: trail.path.length - 6 }, 'SUMMIT · FINISH', 5, 24);
        statics.push({ x: (course.start.x + top[0]) / 2, y: (course.start.y + top[1]) / 2, group: trailGroup, radius: 1400 });
      });
      // SIGN_DESIGNS gets the club's own board (signdesigns3d.js).
      // ---- Per frame -----------------------------------------------------------------------------
      let grillSmoke = 0;
      function updateOffroadVisuals(deltaSeconds) {
        if (deltaSeconds <= 0) return;
        const L = OFFROAD_CLUB.lot,
          nearClub = Math.abs(viewCenter.x - L.x - L.w / 2) < viewReach + 300 && Math.abs(viewCenter.y - L.y - L.h / 2) < viewReach + 300;
        trailClubLive.visible = nearClub;
        if (nearClub) {
          waveFlag();
          // The grill smokes; the fire ring smoulders by day and burns at night.
          grillSmoke += deltaSeconds * (5 + nightAmount * 3);
          while (grillSmoke > 1) {
            grillSmoke -= 1;
            const gr = OFFROAD_CLUB.grill,
              fr = OFFROAD_CLUB.fire;
            engineSmoke(gr.x, 8.2, gr.y, '#cfcfca', 5, 9);
            if (Math.random() < 0.4) engineSmoke(fr.x, 3, fr.y, nightAmount > 0.3 ? '#8a7f74' : '#b5b2ab', 7, 12);
          }
        }
        for (const [c, m] of carModels)
          if (m.group.visible && (c.offroadState || c.x > CITY_SIZE - 200) && Math.abs(c.x - viewCenter.x) < viewReach + 100 && Math.abs(c.y - viewCenter.y) < viewReach + 100)
            vehicleSpray(c, m, deltaSeconds);
        updateMudParticles(deltaSeconds);
        mudSplats.material.uniforms.uTime.value = gameTime;
        tyreTracks.material.uniforms.uTime.value = gameTime;
      }
      function offroadEffectsInfo() {
        return { clumps: clump.count, mist: mist.count, splats: mudSplats.used, tracks: tyreTracks.used, capacity: { clumps: MUD_CLUMPS, mist: MUD_MIST, splats: MUD_SPLATS, tracks: MUD_TRACKS } };
      }
