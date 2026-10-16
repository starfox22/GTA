      // Off-road 3D mud, dust, splats and tyre tracks: thrown clods, spray sprites, fine drops and mist (the effect
      // pool), and lit ground decals (ruts and splats); TRAIL MUD maps from offroad3d-models.js.
      // ---- Mud, dust, splats and tracks -----------------------------------------------------------
      /*
       * TRAIL MUD (rendering-effects.md): what a tyre throws in mud is four layers. CLODS: instanced lit lumps
       * (a dented, smooth-shaded ball) with the mud photo and its relief on them, glossy when wet, stretched
       * along their flight at speed. SPRAY: textured sprite clusters of droplets (Kenney's dirt cells) lit
       * through their own normals, streaked along their screen motion. DROPS: the effect pool's streaked drops
       * (fxBit). MIST and dust: the effect pool's lit puffs (fxPuff), lingering longer in the chase view, at most
       * MUD_TIER.puffs alive. Splats and ruts are decals lit through their own normals (the mud photo's normal
       * map; a rut's basin, lips and tread lugs; a splat cell's domes) as a 2x modulate of the ground, so the
       * ground's own light and shadow stay, with a wet gloss (sun and sky) relative to it. Randomness is
       * mudRandom (its own stream); a vehicle far enough off in the chase view throws only what still shows
       * (chaseSpriteHidden).
       */
      const MUD_CLUMPS = 640,
        MUD_SPRAY = 360,
        MUD_SPLATS = 700,
        MUD_TRACKS = 1800,
        MUD_PUFF_RING = 128,
        MUD_DROP_RING = 256,
        // The sprite cells of the trail-mud sheet (tools/trail_mud.py CELLS: keep them in step).
        MUD_SPRITE_CELLS = { clumpA: 0, clumpB: 1, clumpC: 2, splash: 3, mist: 4, drop: 5, burst: 6, cloud: 7 },
        // Per tier: clods in flight at most and a throw (the second a small one), fine drops a throw and alive at
        // most (effect pool), the share of throws that add a spray sprite, mist and dust puffs alive at most (effect pool), how
        // much longer mist lingers in the chase view, the clod ball's detail (1: 80 faces, 2: 320). LOW and
        // MEDIUM throw one clod a throw where there were two.
        MUD_TIER = {
          LOW: { clumps: 200, clods: 1, drops: 1, dropsLive: 48, spray: 0.35, puffs: 24, linger: 1, detail: 1 },
          MEDIUM: { clumps: 360, clods: 1, drops: 2, dropsLive: 96, spray: 0.6, puffs: 48, linger: 1.3, detail: 1 },
          HIGH: { clumps: 640, clods: 2, drops: 3, dropsLive: 192, spray: 1, puffs: 96, linger: 1.7, detail: 2 },
          ULTRA: { clumps: 640, clods: 2, drops: 4, dropsLive: 256, spray: 1, puffs: 128, linger: 2, detail: 2 },
        };
      let mudSeed = 0x6d2b79f5;
      // The mud's own random numbers (xorshift): never the game's Math.random, nor the effect pool's stream.
      function mudRandom() {
        mudSeed ^= mudSeed << 13;
        mudSeed ^= mudSeed >>> 17;
        mudSeed ^= mudSeed << 5;
        return (mudSeed >>> 0) / 4294967296;
      }
      function mudTier() {
        return MUD_TIER[(activeTier || graphicsTier()).name] || MUD_TIER.MEDIUM;
      }
      // The light the mud's own programs share with the effect pool (fx3d-particles.js fxLightUniforms, each over pi).
      const mudLight = {
        uSunDir: { value: new Three.Vector3(0, 1, 0) },
        uSunColor: { value: new Three.Color(1, 1, 1) },
        uSky: { value: new Three.Color(0.3, 0.3, 0.3) },
        uGround: { value: new Three.Color(0.1, 0.1, 0.1) },
      };
      function mudLightUpdate() {
        const u = fxUniforms;
        mudLight.uSunDir.value.copy(u.uSunDir.value);
        mudLight.uSunColor.value.copy(u.uSunColor.value);
        mudLight.uSky.value.copy(u.uSky.value);
        mudLight.uGround.value.copy(u.uGround.value);
      }
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
      // ---- Clods: a dented ball, welded and smooth-shaded ------------------------------------------
      function mudClumpGeometry(detail) {
        const ball = new Three.IcosahedronGeometry(1, detail),
          pos = ball.attributes.position,
          seen = new Map(),
          index = [],
          verts = [];
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i),
            y = pos.getY(i),
            z = pos.getZ(i),
            key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
          let k = seen.get(key);
          if (k === undefined) {
            k = verts.length / 3;
            seen.set(key, k);
            // A fixed lumpy field over the sphere: a squashed clod with a few knobs.
            const r = 1 + 0.2 * Math.sin(x * 5.1 + y * 2.3) * Math.cos(z * 4.7 - x * 1.9) + 0.1 * Math.sin(y * 9.3 + z * 7.1) + 0.06 * Math.cos(x * 13.7 - z * 11.3);
            verts.push(x * r, y * r * 0.8, z * r);
          }
          index.push(k);
        }
        ball.dispose();
        const g = new Three.BufferGeometry();
        g.setAttribute('position', new Three.Float32BufferAttribute(verts, 3));
        g.setIndex(index);
        g.computeVertexNormals();
        return g;
      }
      const clumpGeometries = [null, mudClumpGeometry(1), mudClumpGeometry(2)],
        clumpLook = new Three.InstancedBufferAttribute(new Float32Array(MUD_CLUMPS * 2), 2).setUsage(Three.DynamicDrawUsage);
      // Per clod: x its wetness, y its seed (where on the photo it sits).
      clumpGeometries[1].setAttribute('iMud', clumpLook);
      clumpGeometries[2].setAttribute('iMud', clumpLook);
      const clumpMaterial = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0 });
      clumpMaterial.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, trailMud.uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute vec2 iMud;\nvarying vec2 vMudLook;\nvarying vec3 vClodLocal;\nvarying vec3 vClodNormal;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMudLook = iMud;\nvClodLocal = position + iMud.y * 7.31;\nvClodNormal = normal;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform sampler2D mudColorMap;\nuniform vec3 mudMean;\nvarying vec2 vMudLook;\nvarying vec3 vClodLocal;\nvarying vec3 vClodNormal;\n' + MUD_PHOTO)
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            vec4 clodPhoto = mudPhoto( vClodLocal * 0.42, vClodNormal );
            float clodWet = clamp( vMudLook.x, 0.0, 1.0 );
            diffuseColor.rgb *= clamp( clodPhoto.rgb, vec3( 0.45 ), vec3( 1.9 ) );
            float clodRelief = clodPhoto.a;`,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            '#include <roughnessmap_fragment>\nroughnessFactor = clamp( mix( 0.9, 0.2, clodWet ) + ( 0.5 - clodRelief ) * 0.25 * clodWet, 0.1, 1.0 );',
          )
          .replace(
            '#include <normal_fragment_maps>',
            '#include <normal_fragment_maps>\nnormal = mudPerturb( - vViewPosition, normal, vec2( dFdx( clodRelief ), dFdy( clodRelief ) ) * 0.8, faceDirection );',
          );
      };
      clumpMaterial.customProgramCacheKey = () => 'mud-clod';
      const clumpMesh = new Three.InstancedMesh(clumpGeometries[2], clumpMaterial, MUD_CLUMPS),
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
          seed: new Float32Array(MUD_CLUMPS),
          count: 0,
        };
      const CLUMP_FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'size', 'wet', 'seed'];
      clumpMesh.count = 0;
      clumpMesh.frustumCulled = false;
      clumpMesh.castShadow = false;
      clumpMesh.userData.dynamic = true;
      clumpMesh.name = 'mud clumps';
      clumpMesh.setColorAt(0, new Three.Color(1, 1, 1));
      scene.add(clumpMesh);
      // ---- Spray: sprite clusters of droplets, lit through their own normals ------------------------
      const mudSprayGeometry = new Three.InstancedBufferGeometry();
      mudSprayGeometry.setAttribute('position', new Three.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
      mudSprayGeometry.setIndex([0, 1, 2, 0, 2, 3]);
      const mudSprayAttribute = (name, n) => {
        const a = new Three.InstancedBufferAttribute(new Float32Array(MUD_SPRAY * n), n).setUsage(Three.DynamicDrawUsage);
        mudSprayGeometry.setAttribute(name, a);
        return a;
      };
      // iPos: position and size; iVel: velocity and turn; iLook: opacity, wetness, cell, water (1) or mud (0).
      const mudSprayPos = mudSprayAttribute('iPos', 4),
        mudSprayVel = mudSprayAttribute('iVel', 4),
        mudSprayLook = mudSprayAttribute('iLook', 4),
        mudSprayColor = mudSprayAttribute('iColor', 3);
      mudSprayGeometry.instanceCount = 0;
      const mudSprayMaterial = new Three.ShaderMaterial({
        uniforms: { ...mudLight, uSprites: { value: trailMud.sprites }, uStreak: { value: 0.045 } },
        vertexShader: `
          attribute vec4 iPos; attribute vec4 iVel; attribute vec4 iLook; attribute vec3 iColor;
          uniform float uStreak;
          varying vec2 vUv; varying vec4 vLook; varying vec3 vColor; varying vec3 vRight; varying vec3 vUp; varying vec3 vToEye;
          void main() {
            vec3 right = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] );
            vec3 up = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] );
            vec3 toEye = vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] );
            float c = cos( iVel.w ), s = sin( iVel.w );
            vec3 r = right * c + up * s, u = up * c - right * s;
            // Streaked along its motion across the view: the frame turns to the motion as the streak grows.
            vec2 sv = vec2( dot( iVel.xyz, right ), dot( iVel.xyz, up ) );
            float sl = length( sv );
            float stretch = 1.0 + min( 2.2, sl * uStreak / max( iPos.w, 0.5 ) );
            if ( sl > 1e-3 ) {
              vec2 d = sv / sl;
              float k = smoothstep( 1.05, 1.4, stretch );
              r = normalize( mix( r, right * d.x + up * d.y, k ) );
              u = normalize( cross( toEye, r ) );
            }
            vec3 p = iPos.xyz + ( r * position.x * stretch + u * position.y ) * iPos.w;
            vUv = position.xy + 0.5;
            vLook = iLook;
            vColor = iColor;
            vRight = r;
            vUp = u;
            vToEye = toEye;
            gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
          }`,
        fragmentShader: `
          uniform sampler2D uSprites; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSky; uniform vec3 uGround;
          varying vec2 vUv; varying vec4 vLook; varying vec3 vColor; varying vec3 vRight; varying vec3 vUp; varying vec3 vToEye;
          void main() {
            float cell = vLook.z;
            float col = mod( cell, 4.0 ), row = floor( cell / 4.0 );
            vec4 t = texture2D( uSprites, vec2( ( col + vUv.x ) * 0.25, 1.0 - ( row + 1.0 - vUv.y ) * 0.5 ) );
            float a = t.r * vLook.x;
            if ( a < 0.01 ) discard;
            vec2 nxy = t.gb * 2.0 - 1.0;
            vec3 n = normalize( vRight * nxy.x + vUp * nxy.y + vToEye * sqrt( max( 0.0, 1.0 - dot( nxy, nxy ) ) ) );
            float wet = vLook.y;
            float water = vLook.w;
            // Lambert from the sun, wrapped a little (a cluster is thin), the sky and ground by the normal's lean.
            float sunLit = max( dot( n, uSunDir ) * 0.8 + 0.2, 0.0 );
            vec3 light = uSunColor * sunLit + mix( uGround, uSky, n.y * 0.5 + 0.5 );
            vec3 colour = vColor * light;
            // Wet gloss: the sun's highlight and the sky in it at a glance.
            vec3 h = normalize( uSunDir + vToEye );
            float gloss = max( wet, water );
            colour += uSunColor * pow( max( dot( n, h ), 0.0 ), mix( 10.0, 80.0, gloss ) ) * gloss * mix( 0.12, 0.6, water );
            colour += uSky * pow( 1.0 - max( dot( n, vToEye ), 0.0 ), 4.0 ) * gloss * 0.3;
            gl_FragColor = vec4( colour, a * mix( 1.0, 0.7, water ) );
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
      });
      const mudSprayMesh = new Three.Mesh(mudSprayGeometry, mudSprayMaterial);
      mudSprayMesh.frustumCulled = false;
      mudSprayMesh.renderOrder = 3;
      mudSprayMesh.name = 'mud spray';
      mudSprayMesh.userData.dynamic = true;
      scene.add(mudSprayMesh);
      const mudSpray = { count: 0 };
      const MUD_SPRAY_FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'size', 'grow', 'alpha', 'turn', 'spin', 'wet', 'cell', 'water', 'r', 'g', 'b'];
      for (const name of MUD_SPRAY_FIELDS) mudSpray[name] = new Float32Array(MUD_SPRAY);
      /*
       * Ground decals (splats and ruts): a quad per instance laid on the ground along `iAxis` (its length) and
       * `iSide` (its width), fading from its birth over `iLife.y` seconds; `iLife.z` its wetness, `iLife.w` its
       * sprite cell (a splat) or -1 (a rut). Lit through its own normal and drawn as a 2x modulate of the ground
       * (0.5 leaves it as it is), so the ground's light and shadow stay under it.
       */
      const DECAL_VERTEX = `
        attribute vec3 iPos; attribute vec3 iAxis; attribute vec3 iSide; attribute vec4 iLife;
        uniform float uTime;
        varying vec2 vUv; varying float vFade; varying float vWet; varying float vCell; varying float vLength;
        varying vec3 vAxis; varying vec3 vSide; varying vec3 vWorld;
        void main() {
          vec3 p = iPos + iAxis * position.x + iSide * position.y;
          vUv = uv;
          float age = uTime - iLife.x;
          vFade = clamp( 1.0 - age / iLife.y, 0.0, 1.0 ) * step( 0.0, age );
          vWet = iLife.z;
          vCell = iLife.w;
          vLength = length( iAxis );
          vAxis = iAxis / max( vLength, 1e-4 );
          vSide = normalize( iSide );
          vWorld = p;
          gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
        }`;
      const DECAL_FRAGMENT = `
        uniform sampler2D uSprites; uniform sampler2D uMudColor; uniform sampler2D uMudDetail; uniform vec3 uMudMean;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSky;
        varying vec2 vUv; varying float vFade; varying float vWet; varying float vCell; varying float vLength;
        varying vec3 vAxis; varying vec3 vSide; varying vec3 vWorld;
        void main() {
          // The mud photo laid in world space, about 2.75 m a repeat.
          vec2 wuv = vWorld.xz / 22.0;
          vec3 photo = texture2D( uMudColor, wuv ).rgb / max( uMudMean, vec3( 1e-4 ) );
          vec3 detail = texture2D( uMudDetail, wuv ).rgb;
          float lum = dot( photo, vec3( 0.3, 0.55, 0.15 ) );
          vec3 up = normalize( cross( vAxis, vSide ) );
          if ( up.y < 0.0 ) up = -up;
          vec3 n;
          float cover;
          float pool = 1.0;
          if ( vCell < 0.0 ) {
            // A RUT: a basin across (y from -1 to 1) with raised lips, chevron lugs pressed along it every ~0.4 m;
            // the edges ragged by the photo, the ends feathered into the last print.
            float y = vUv.y * 2.0 - 1.0;
            float ay = abs( y );
            cover = ( 1.0 - smoothstep( 0.72 + ( lum - 1.0 ) * 0.2, 1.0, ay ) ) * smoothstep( 0.0, 0.1, vUv.x ) * ( 1.0 - smoothstep( 0.9, 1.0, vUv.x ) );
            float phase = 6.2832 * ( vUv.x * vLength / 3.2 + ay * 0.55 );
            float lug = smoothstep( -0.2, 0.5, sin( phase ) ) * ( 1.0 - smoothstep( 0.6, 0.86, ay ) );
            // Height slopes (per unit along the decal's own axes): the basin, the lips, the lugs.
            float across = 0.55 * sin( y * 1.5708 ) - 0.9 * sign( y ) * smoothstep( 0.7, 0.95, ay ) * ( 1.0 - smoothstep( 0.95, 1.0, ay ) );
            float along = 0.35 * cos( phase ) * ( 1.0 - smoothstep( 0.6, 0.86, ay ) );
            n = normalize( up - vAxis * along - vSide * across );
            pool = 1.0 - ay * 0.5 - lug * 0.25;
          } else {
            // A SPLAT: the cell's coverage and its domed lumps.
            float col = mod( vCell, 4.0 ), row = floor( vCell / 4.0 );
            vec4 t = texture2D( uSprites, vec2( ( col + vUv.x ) * 0.25, 1.0 - ( row + 1.0 - vUv.y ) * 0.5 ) );
            cover = smoothstep( 0.05, 0.5, t.r );
            vec2 nxy = ( t.gb * 2.0 - 1.0 ) * 1.3;
            n = normalize( up * 0.8 + vAxis * nxy.x + vSide * nxy.y );
          }
          float a = cover * vFade;
          if ( a < 0.01 ) discard;
          // The photo's own relief on top (its normal map in world x and z).
          vec2 dn = ( detail.rg * 2.0 - 1.0 ) * 0.55;
          n = normalize( n + vec3( dn.x, 0.0, -dn.y ) );
          float wet = clamp( vWet, 0.0, 1.0 );
          // Light against the bare ground's: the decal's lean shades it, a ratio so shadow stays shadow.
          float sunK = dot( uSunColor, vec3( 0.3, 0.55, 0.15 ) ), skyK = dot( uSky, vec3( 0.3, 0.55, 0.15 ) ) + 1e-4;
          float flatLit = sunK * max( dot( up, uSunDir ), 0.0 ) + skyK;
          float lit = sunK * max( dot( n, uSunDir ), 0.0 ) + skyK * ( 0.55 + 0.45 * n.y );
          vec3 tint = mix( vec3( 0.74, 0.64, 0.54 ), vec3( 0.44, 0.35, 0.27 ), wet ) * clamp( photo, vec3( 0.55 ), vec3( 1.7 ) );
          vec3 m = min( tint * ( lit / flatLit ), vec3( 0.9 ) );
          // Wet gloss (relative to the lit bare ground, ~0.15 albedo): the sun's highlight and the sky at a glance.
          vec3 v = normalize( cameraPosition - vWorld );
          float gloss = wet * ( 1.0 - detail.b * 0.55 ) * clamp( pool, 0.3, 1.0 );
          vec3 h = normalize( uSunDir + v );
          float spec = pow( max( dot( n, h ), 0.0 ), mix( 16.0, 140.0, gloss ) ) * gloss * sunK * 0.3;
          float sheen = pow( 1.0 - max( dot( n, v ), 0.0 ), 5.0 ) * gloss * skyK * 0.7;
          // Capped: overlapping decals multiply, so a brightening compounds (a few wet splats must not burn white).
          m = min( m + vec3( min( ( spec + sheen ) / ( flatLit * 0.15 ), 0.5 ) ), vec3( 1.3 ) );
          gl_FragColor = vec4( mix( vec3( 1.0 ), m, a ) * 0.5, 1.0 );
        }`;
      function decalPool(capacity, name) {
        const geo = new Three.InstancedBufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const at = (n) => new Three.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(Three.DynamicDrawUsage);
        geo.setAttribute('iPos', at(3));
        geo.setAttribute('iAxis', at(3));
        geo.setAttribute('iSide', at(3));
        geo.setAttribute('iLife', at(4));
        geo.instanceCount = 0;
        // Both pools share one program (the same source; a rut or a splat is per instance).
        const material = new Three.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uSprites: { value: trailMud.sprites },
            uMudColor: { value: trailMud.colour },
            uMudDetail: { value: trailMud.detail },
            uMudMean: { value: trailMud.mean },
            uSunDir: mudLight.uSunDir,
            uSunColor: mudLight.uSunColor,
            uSky: mudLight.uSky,
          },
          vertexShader: DECAL_VERTEX,
          fragmentShader: DECAL_FRAGMENT,
          transparent: true,
          depthWrite: false,
          // 2x modulate: dst * src * 2, the destination's alpha kept.
          blending: Three.CustomBlending,
          blendSrc: Three.DstColorFactor,
          blendDst: Three.SrcColorFactor,
          blendSrcAlpha: Three.ZeroFactor,
          blendDstAlpha: Three.OneFactor,
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
      const mudSplats = decalPool(MUD_SPLATS, 'mud splats'),
        tyreTracks = decalPool(MUD_TRACKS, 'tyre tracks');
      const decalNormal = new Three.Vector3(),
        decalAlong = new Three.Vector3(),
        decalAcross = new Three.Vector3();
      // Lays one decal on the ground at (x, y) along heading `a`: `cell` a splat's sprite cell, -1 a rut.
      function addGroundDecal(pool, x, y, a, length, width, seconds, wet, cell) {
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
        at.iLife.setXYZW(i, gameTime, seconds, wet, cell);
        // Only the decal written goes up (uploadChurn).
        for (const name of DECAL_ATTRIBUTES) {
          at[name].addUpdateRange(i * at[name].itemSize, at[name].itemSize);
          at[name].needsUpdate = true;
        }
        pool.geo.instanceCount = pool.used;
      }
      const DECAL_ATTRIBUTES = ['iPos', 'iAxis', 'iSide', 'iLife'];
      function spawnClump(x, y, z, vx, vy, vz, size, wet) {
        if (clump.count >= Math.min(MUD_CLUMPS, mudTierNow.clumps)) return;
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
        const k = (clump.seed[i] = mudRandom()),
          colours = clumpMesh.instanceColor.array,
          dry = 1 - wet,
          // Clods are the trail's own churned mud: darker than the dust and drops thrown with them.
          tone = 0.68;
        // Its colour (each clod a little lighter or darker, warmer or cooler) and look, once.
        colours[i * 3] = (MUD_DRY.r * dry + MUD_WET.r * wet) * tone * (0.82 + 0.36 * k);
        colours[i * 3 + 1] = (MUD_DRY.g * dry + MUD_WET.g * wet) * tone * (0.82 + 0.3 * k);
        colours[i * 3 + 2] = (MUD_DRY.b * dry + MUD_WET.b * wet) * tone * (0.84 + 0.24 * ((k * 7.3) % 1));
        clumpLook.array[i * 2] = wet;
        clumpLook.array[i * 2 + 1] = k;
      }
      // A spray sprite: `cell` of the sheet, `grow` times its size over its life, `water` 1 for a ford's water.
      function spawnSpray(x, y, z, vx, vy, vz, size, grow, alpha, life, cell, wet, water, color) {
        if (mudSpray.count >= MUD_SPRAY) return;
        const i = mudSpray.count++,
          s = mudSpray;
        s.x[i] = x;
        s.y[i] = y;
        s.z[i] = z;
        s.vx[i] = vx;
        s.vy[i] = vy;
        s.vz[i] = vz;
        s.life[i] = s.max[i] = life;
        s.size[i] = size;
        s.grow[i] = grow;
        s.alpha[i] = alpha;
        s.turn[i] = mudRandom() * TAU;
        s.spin[i] = (mudRandom() - 0.5) * 3;
        s.wet[i] = wet;
        s.cell[i] = cell;
        s.water[i] = water;
        s.r[i] = color.r;
        s.g[i] = color.g;
        s.b[i] = color.b;
      }
      // Mist and dust are the effect pool's lit puffs, at most MUD_TIER.puffs alive (a ring of their end times).
      const mudPuffEnds = new Float32Array(MUD_PUFF_RING);
      let mudPuffNext = 0,
        mudPuffs = 0,
        mudDrops = 0;
      function mudPuff(x, y, z, vx, vy, vz, life, size, grow, color, alpha, ground) {
        const cap = Math.min(MUD_PUFF_RING, mudTierNow.puffs),
          k = mudPuffNext % cap;
        if (mudPuffEnds[k] > gameTime) return;
        if (chaseViewActive) life *= mudTierNow.linger;
        if (fxPuff(x, y, z, vx, vy, vz, life, size, grow, color, alpha, ground, 2.2, 3) < 0) return;
        mudPuffEnds[k] = gameTime + life;
        mudPuffNext = k + 1;
        mudPuffs++;
      }
      // A fine drop: the effect pool's streaked drop, falling with the clods.
      // At most MUD_TIER.dropsLive alive (a ring of end times, as the puffs): the mud never fills the pool that the
      // guns, blasts and fires share.
      const mudDropEnds = new Float32Array(MUD_DROP_RING);
      let mudDropNext = 0;
      function mudDrop(x, y, z, vx, vy, vz, size, color, ground) {
        const cap = Math.min(MUD_DROP_RING, mudTierNow.dropsLive),
          k = mudDropNext % cap;
        if (mudDropEnds[k] > gameTime) return;
        const life = 0.9 + mudRandom() * 0.5,
          i = fxBit(x, y, z, vx, vy, vz, life, size, color, 1, ground, FX_DROP);
        if (i < 0) return;
        fxs.streak[i] = 0.035;
        fxs.bounce[i] = 0;
        fxs.drag[i] = 0.35;
        mudDropEnds[k] = gameTime + life;
        mudDropNext = k + 1;
        mudDrops++;
      }
      let mudTierNow = MUD_TIER.MEDIUM;
      const MUD_WET = new Three.Color('#35261a'),
        MUD_DRY = new Three.Color('#8c7353'),
        DUST = new Three.Color('#a8957a'),
        clumpColor = new Three.Color(),
        mudShade = new Three.Color();
      // Wheel contact points of a model in body space (club trucks: their knuckles).
      function contactWheels(c, m) {
        if (m.contacts) return m.contacts;
        const spec = vehicleSpec(c),
          list = [];
        if (m.knuckles) for (const k of m.knuckles) list.push({ x: k.x, z: k.z, driven: k.driven, r: m.wheelRadius, width: OFFROAD_BODIES[spec.clubModel].wheel.width, emit: 0, lastX: NaN, lastY: NaN });
        else if (m.wheels?.length && m.wheels[0].wheel.position)
          for (const { wheel } of m.wheels) {
            // Motorcycle fronts sit inside a steering/axle rig, so their local position
            // is not a body-space tyre contact. The kit records the original body-space
            // location and real wheel dimensions once, independent of steering and roll.
            const bike = wheel.userData.bikeContact;
            if (bike) {
              list.push({ x: bike.x, z: bike.z, front: bike.front, driven: !bike.front, r: bike.r, width: bike.width, emit: 0, lastX: NaN, lastY: NaN });
              continue;
            }
            // Other models are built at design size and drawn at modelScale.
            const k = m.modelScale || 1,
              x = wheel.position.x * k,
              drive = spec.drive || (spec.offroad ? '4x4' : 'rwd');
            list.push({ x, z: wheel.position.z * k, front: x > 0, driven: drive === '4x4' || (drive === 'fwd' ? x > 0 : x < 0), r: (wheel.position.y || 4) * k, width: 2.6 * k, emit: 0, lastX: NaN, lastY: NaN });
          }
        m.contacts = list;
        return list;
      }
      // Wading a ford (tyreEmission 'ford'): sheets of water off every wheel (spray sprites), streaked drops
      // and a white mist, the bow wave's spray ahead at speed.
      const FORD_SPRAY = new Three.Color('#dfe8ea'),
        FORD_MIST = new Three.Color('#eef3f4');
      function fordSpray(c, m, e, deltaSeconds) {
        const cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          speed = Math.abs(c.speed || 0),
          level = entityElevation(c) + Math.min(c.fordDepth, 6);
        for (const w of contactWheels(c, m)) {
          const contact = w.front ? e.frontContact : 1;
          if (!(contact > 0)) {
            w.emit = 0;
            w.lastX = w.lastY = NaN;
            continue;
          }
          w.emit += (e.rate / 4) * deltaSeconds * 4 * contact;
          const wx = c.x + cos * w.x - sin * w.z,
            wy = c.y + sin * w.x + cos * w.z;
          while (w.emit >= 1) {
            w.emit -= 1;
            const out = Math.sign(w.z) * (6 + mudRandom() * 14),
              fwd = (mudRandom() - 0.3) * speed * 0.5,
              vx = cos * fwd - sin * out + (c.vx || 0) * 0.6,
              vy = sin * fwd + cos * out + (c.vy || 0) * 0.6,
              up = 10 + mudRandom() * 18 + speed * 0.25;
            if (chaseSpriteHidden(wx, level, wy, 1)) continue;
            for (let k = 0; k < mudTierNow.drops; k++)
              mudDrop(wx, level, wy, vx * (0.8 + mudRandom() * 0.5), up * (0.7 + mudRandom() * 0.6), vy * (0.8 + mudRandom() * 0.5), 0.3 + mudRandom() * 0.3, FORD_SPRAY, level - 0.5);
            if (mudRandom() < mudTierNow.spray) spawnSpray(wx, level, wy, vx, up, vy, 3 + mudRandom() * 3, 1.8, 0.75, 0.5 + mudRandom() * 0.4, (mudRandom() * 3) | 0, 1, 1, FORD_SPRAY);
            if (mudRandom() < 0.35) mudPuff(wx, level + 1, wy, vx * 0.4, up * 0.3, vy * 0.4, 0.8 + mudRandom() * 0.5, 2.6 + mudRandom() * 2, 3.5, FORD_MIST, 0.32, level);
          }
        }
      }
      // Throw mud (or dust) from a vehicle's tyres and lay its tracks.
      function vehicleSpray(c, m, deltaSeconds) {
        const onRange = !!c.offroadState && !c.offroadState.paved;
        if (!offroadGround(c) || isAircraft(c) || isBoat(c) || c.hp <= 0) return;
        const emission = tyreEmission(c);
        if (emission.kind === 'ford') return fordSpray(c, m, emission, deltaSeconds);
        const along = c.speed || 0,
          speed = Math.abs(along),
          spin = c.wheelSpin || 0,
          mud = onRange ? c.surfaceMud || 0 : 0.05,
          wet = clamp(0.45 + 0.55 * (weather.wet || 0), 0, 1) * (mud > 0.1 ? 1 : 0.4),
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          wheelSpeed = speed + (c.spinSpeed || 0),
          dir = along < -2 ? -1 : 1,
          base = entityElevation(c),
          tier = mudTierNow;
        // The thrown mud's colour: drier is paler.
        mudShade.copy(MUD_DRY).lerp(MUD_WET, wet);
        for (const w of contactWheels(c, m)) {
          const contact = w.front ? emission.frontContact : 1;
          if (!(contact > 0)) {
            // End the print at lift-off. A new patch after landing starts here,
            // instead of joining the old front track across the airborne travel.
            w.emit = 0;
            w.lastX = w.lastY = NaN;
            continue;
          }
          const wx = c.x + cos * w.x - sin * w.z,
            wy = c.y + sin * w.x + cos * w.z;
          // Tracks: a print every metre and a half of travel.
          if (w.lastX !== w.lastX) {
            w.lastX = wx;
            w.lastY = wy;
          }
          const moved = Math.hypot(wx - w.lastX, wy - w.lastY);
          if (moved > 12 || (moved > 2 && spin > 0.5 && moved > 6)) {
            if (moved < 40) addGroundDecal(tyreTracks, (wx + w.lastX) / 2, (wy + w.lastY) / 2, Math.atan2(wy - w.lastY, wx - w.lastX), moved + 1, w.width * 0.95 * contact, 90 + mud * 120, mud > 0.15 ? wet : 0.1, -1);
            w.lastX = wx;
            w.lastY = wy;
          } else if (spin > 0.6 && speed < 8 && mudRandom() < deltaSeconds * 4 * contact) addGroundDecal(tyreTracks, wx, wy, c.a, w.r * 1.2, w.width * contact, 120, wet, -1);
          if (!w.driven && spin > 0.1) continue;
          // How much is thrown: spin in mud throws the most, speed through mud some; dry
          // ground gives dust by speed and spin, more from a 4x4, none when wet
          // (tyreDustRate, tyre-effects.js).
          const rate = mud > 0.1 ? (spin * 150 + speed * (mud * 0.6 + 0.03)) * (w.driven ? 1 : 0.4) : tyreDustRate(c, w.driven);
          w.emit += rate * deltaSeconds * contact;
          while (w.emit >= 1) {
            w.emit -= 1;
            const throwSpeed = Math.min(160, wheelSpeed) * (0.25 + mudRandom() * 0.35),
              up = 14 + mudRandom() * 28 + throwSpeed * 0.35,
              sideways = (mudRandom() - 0.5) * 16 + Math.sign(w.z) * mudRandom() * 10,
              ox = wx - cos * dir * w.r * 0.8,
              oy = wy - sin * dir * w.r * 0.8,
              oz = base + w.r * (0.35 + mudRandom() * 0.5),
              vx = -cos * dir * throwSpeed - sin * sideways + (c.vx || 0) * 0.85,
              vy = -sin * dir * throwSpeed + cos * sideways + (c.vy || 0) * 0.85;
            // Far off in the chase view a clod is under a pixel: nothing is thrown that would not show.
            if (chaseSpriteHidden(ox, oz, oy, 1.2)) continue;
            if (mud > 0.1) {
              spawnClump(ox, oz, oy, vx, up, vy, 0.38 + mudRandom() * 0.6, wet);
              if (tier.clods > 1) spawnClump(ox, oz, oy, vx * 1.15 + (mudRandom() - 0.5) * 16, up * (0.75 + mudRandom() * 0.5), vy * 1.15 + (mudRandom() - 0.5) * 16, 0.22 + mudRandom() * 0.22, wet);
              // Fine drops fly off with it, faster and smaller (the effect pool).
              for (let k = 0; k < tier.drops; k++)
                mudDrop(ox, oz, oy, vx * 1.2 + (mudRandom() - 0.5) * 20, up * (0.7 + mudRandom() * 0.6), vy * 1.2 + (mudRandom() - 0.5) * 20, 0.28 + mudRandom() * 0.3, mudShade, base - 1);
              // A cluster of spray: a sheet of droplets thrown off the tread, streaked at speed.
              if (mudRandom() < tier.spray)
                spawnSpray(ox, oz, oy, vx * 0.9, up * 0.85, vy * 0.9, 3.2 + mudRandom() * 3.6, 1.5, 0.95, 0.45 + mudRandom() * 0.35, (mudRandom() * 3) | 0, wet, 0, mudShade);
              if (mudRandom() < 0.4) {
                clumpColor.copy(mudShade).lerp(DUST, 0.35).multiplyScalar(0.85);
                mudPuff(ox, oz, oy, vx * 0.35, up * 0.25, vy * 0.35, 1.1 + mudRandom() * 0.8, 2.2 + mudRandom() * 1.6, 3.2, clumpColor, 0.26, base);
              }
            } else mudPuff(ox, oz - w.r * 0.3, oy, vx * 0.3, 4 + mudRandom() * 6, vy * 0.3, 1.8 + mudRandom() * 1.2, 3.5 + mudRandom() * 3, 5, DUST, 0.3, base);
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
              // A splat where it lands (the bigger lumps): one of the clump cells, or the splash.
              if (clump.size[i] > 0.4 || mudRandom() < 0.35) {
                const cell = mudRandom() < 0.25 ? MUD_SPRITE_CELLS.splash : (mudRandom() * 3) | 0;
                addGroundDecal(mudSplats, clump.x[i], clump.z[i], mudRandom() * TAU, clump.size[i] * 8, clump.size[i] * 8, 70, clump.wet[i], cell);
              }
            }
          }
          if (dead) {
            n--;
            for (let k = 0; k < CLUMP_FIELDS.length; k++) {
              const column = clump[CLUMP_FIELDS[k]];
              column[i] = column[n];
            }
            // Its colour and look were written once, at its throw: the last clod's move with it.
            const colours = clumpMesh.instanceColor.array,
              looks = clumpLook.array;
            colours[i * 3] = colours[n * 3];
            colours[i * 3 + 1] = colours[n * 3 + 1];
            colours[i * 3 + 2] = colours[n * 3 + 2];
            looks[i * 2] = looks[n * 2];
            looks[i * 2 + 1] = looks[n * 2 + 1];
            i--;
          }
        }
        clump.count = n;
        const te = clumpMesh.instanceMatrix.array;
        for (let i = 0; i < n; i++) {
          const s = clump.size[i],
            vx = clump.vx[i],
            vy = clump.vy[i],
            vz = clump.vz[i],
            v = Math.sqrt(vx * vx + vy * vy + vz * vz),
            // Stretched along its flight at speed (a clod smears in a frame), tumbling about that line.
            stretch = 1 + Math.min(0.9, v * 0.0055),
            roll = clump.seed[i] * 40 + clump.life[i] * 9,
            rc = Math.cos(roll),
            rs = Math.sin(roll);
          // The flight's frame written straight into the matrix: x along the velocity, y and z round it.
          let ax = 1,
            ay = 0,
            az = 0;
          if (v > 1e-3) {
            ax = vx / v;
            ay = vy / v;
            az = vz / v;
          }
          let zx, zy, zz;
          if (ay < 0.9 && ay > -0.9) {
            const k = 1 / Math.sqrt(ax * ax + az * az);
            zx = -az * k;
            zy = 0;
            zz = ax * k;
          } else {
            const k = 1 / Math.sqrt(ay * ay + az * az);
            zx = 0;
            zy = az * k;
            zz = -ay * k;
          }
          const yx = zy * az - zz * ay,
            yy = zz * ax - zx * az,
            yz = zx * ay - zy * ax,
            sx = s * 1.15 * stretch,
            sy = s * 0.85,
            sz = s / Math.sqrt(stretch),
            o = i * 16;
          te[o] = ax * sx;
          te[o + 1] = ay * sx;
          te[o + 2] = az * sx;
          te[o + 3] = 0;
          te[o + 4] = (yx * rc + zx * rs) * sy;
          te[o + 5] = (yy * rc + zy * rs) * sy;
          te[o + 6] = (yz * rc + zz * rs) * sy;
          te[o + 7] = 0;
          te[o + 8] = (zx * rc - yx * rs) * sz;
          te[o + 9] = (zy * rc - yy * rs) * sz;
          te[o + 10] = (zz * rc - yz * rs) * sz;
          te[o + 11] = 0;
          te[o + 12] = clump.x[i];
          te[o + 13] = clump.y[i];
          te[o + 14] = clump.z[i];
          te[o + 15] = 1;
        }
        clumpMesh.count = n;
        // Only the clumps in flight go up, and nothing when there are none (uploadChurn).
        if (n) {
          clumpMesh.instanceMatrix.addUpdateRange(0, n * 16);
          clumpMesh.instanceMatrix.needsUpdate = true;
          clumpLook.addUpdateRange(0, n * 2);
          clumpLook.needsUpdate = true;
          if (clumpMesh.instanceColor) {
            clumpMesh.instanceColor.addUpdateRange(0, n * 3);
            clumpMesh.instanceColor.needsUpdate = true;
          }
        }
        // Spray sprites: ballistic, slowed by the air, spreading; short-lived (no ground test: the depth hides one
        // that lands).
        const s = mudSpray,
          mudSprayDrag = Math.exp(-1.1 * deltaSeconds);
        n = s.count;
        for (let i = 0; i < n; i++) {
          s.life[i] -= deltaSeconds;
          let dead = s.life[i] <= 0;
          if (!dead) {
            s.vx[i] *= mudSprayDrag;
            s.vz[i] *= mudSprayDrag;
            s.vy[i] = s.vy[i] * mudSprayDrag - g * 0.85 * deltaSeconds;
            s.x[i] += s.vx[i] * deltaSeconds;
            s.y[i] += s.vy[i] * deltaSeconds;
            s.z[i] += s.vz[i] * deltaSeconds;
            s.turn[i] += s.spin[i] * deltaSeconds;
          }
          if (dead) {
            n--;
            for (let k = 0; k < MUD_SPRAY_FIELDS.length; k++) {
              const column = s[MUD_SPRAY_FIELDS[k]];
              column[i] = column[n];
            }
            i--;
          }
        }
        s.count = n;
        for (let i = 0; i < n; i++) {
          const t = s.life[i] / s.max[i];
          mudSprayPos.setXYZW(i, s.x[i], s.y[i], s.z[i], s.size[i] * (1 + (s.grow[i] - 1) * (1 - t)));
          mudSprayVel.setXYZW(i, s.vx[i], s.vy[i], s.vz[i], s.turn[i]);
          mudSprayLook.setXYZW(i, s.alpha[i] * Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 12), s.wet[i], s.cell[i], s.water[i]);
          mudSprayColor.setXYZ(i, s.r[i], s.g[i], s.b[i]);
        }
        if (n) {
          for (const attribute of MUD_SPRAY_ATTRIBUTES) {
            attribute.addUpdateRange(0, n * attribute.itemSize);
            attribute.needsUpdate = true;
          }
        }
        mudSprayGeometry.instanceCount = n;
      }
      const MUD_SPRAY_ATTRIBUTES = [mudSprayPos, mudSprayVel, mudSprayLook, mudSprayColor];
      // ---- Per frame -----------------------------------------------------------------------------
      function updateOffroadVisuals(deltaSeconds) {
        if (deltaSeconds <= 0) return;
        const mudStart = performance.now();
        const L = OFFROAD_CLUB.lot,
          nearClub = Math.abs(viewCenter.x - L.x - L.w / 2) < viewReach + 300 && Math.abs(viewCenter.y - L.y - L.h / 2) < viewReach + 300;
        trailClubLive.visible = nearClub;
        if (nearClub) {
          waveFlag();
          // The grill smokes; the fire ring smoulders by day and burns at night (chimney-smoke3d.js).
          updateClubYardSmoke(deltaSeconds, true);
        }
        mudTierNow = mudTier();
        if (clumpMesh.geometry !== clumpGeometries[mudTierNow.detail]) clumpMesh.geometry = clumpGeometries[mudTierNow.detail];
        for (const [c, m] of carModels)
          if (m.group.visible && (c.offroadState || c.x > CITY_SIZE - 200) && Math.abs(c.x - viewCenter.x) < viewReach + 100 && Math.abs(c.y - viewCenter.y) < viewReach + 100)
            vehicleSpray(c, m, deltaSeconds);
        updateMudParticles(deltaSeconds);
        // The spray and the decals light with the effect pool's light (a frame old: it is set as the pool draws).
        if (clump.count || mudSpray.count || mudSplats.used || tyreTracks.used) mudLightUpdate();
        mudSplats.material.uniforms.uTime.value = gameTime;
        tyreTracks.material.uniforms.uTime.value = gameTime;
        // CPU of this pass (ms, smoothed over ~30 frames or staged steps, without the effect pool; offroad().effects.cpuMs).
        mudCpuMs += (performance.now() - mudStart - mudCpuMs) * 0.033;
      }
      let mudCpuMs = 0;
      /* Console trailMud (a scene staged without drawing): one step of what updateOffroadVisuals throws and moves,
         and of the effect pool the drops and mist went into. */
      function trailMudStage(deltaSeconds) {
        const mudStart = performance.now();
        mudTierNow = mudTier();
        if (clumpMesh.geometry !== clumpGeometries[mudTierNow.detail]) clumpMesh.geometry = clumpGeometries[mudTierNow.detail];
        for (const [c, m] of carModels)
          if (m.group.visible && (c.offroadState || c.x > CITY_SIZE - 200) && Math.abs(c.x - viewCenter.x) < viewReach + 100 && Math.abs(c.y - viewCenter.y) < viewReach + 100)
            vehicleSpray(c, m, deltaSeconds);
        updateMudParticles(deltaSeconds);
        mudCpuMs += (performance.now() - mudStart - mudCpuMs) * 0.05;
        fxStep(deltaSeconds);
        mudSplats.material.uniforms.uTime.value = gameTime;
        tyreTracks.material.uniforms.uTime.value = gameTime;
      }
      function offroadEffectsInfo() {
        return {
          clumps: clump.count,
          spray: mudSpray.count,
          splats: mudSplats.used,
          tracks: tyreTracks.used,
          // Thrown into the effect pool since the page loaded: fine drops and mist or dust puffs.
          drops: mudDrops,
          puffs: mudPuffs,
          cpuMs: Math.round(mudCpuMs * 1000) / 1000,
          tier: { ...mudTierNow },
          textures: trailMud.ready,
          capacity: { clumps: MUD_CLUMPS, spray: MUD_SPRAY, splats: MUD_SPLATS, tracks: MUD_TRACKS, puffs: MUD_PUFF_RING, drops: MUD_DROP_RING },
          dressing: trailDressing,
        };
      }
