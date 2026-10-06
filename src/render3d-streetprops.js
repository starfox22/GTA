      // Street lamps and their glow halos, vehicle halos, blossom, sign() boards.
      // (Still in surfaces3d.js's list of swaying materials.)
      const blossomMat = mat('#d5a2b5');
      trees.forEach((t) => plantTree(t));
      // Lamps, illuminated signs and street furniture.
      const haloCanvas = document.createElement('canvas');
      haloCanvas.width = haloCanvas.height = 64;
      const hg = haloCanvas.getContext('2d'),
        hr = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
      hr.addColorStop(0, '#fff8df');
      hr.addColorStop(0.14, '#ffda92c0');
      hr.addColorStop(0.45, '#ffb45230');
      hr.addColorStop(1, '#ffb45200');
      hg.fillStyle = hr;
      hg.fillRect(0, 0, 64, 64);
      const haloTx = new Three.CanvasTexture(haloCanvas);
      const haloMat = new Three.SpriteMaterial({
        map: haloTx,
        color: '#ffd99b',
        transparent: true,
        blending: Three.AdditiveBlending,
        depthWrite: false,
      });
      function halo(parent, x, y, z, size, color) {
        const s = new Three.Sprite(haloMat.clone());
        s.position.set(x, y, z);
        s.scale.set(size, size, 1);
        if (color) s.material.color.set(color);
        parent.add(s);
        return s;
      }
      /**
       * VEHICLE HALOS
       * Every lit vehicle has four halo sprites (head and tail lamps; planes their
       * navigation lights), and each sprite was a draw call with its own material:
       * a hundred and more at night in a busy street. The sprites stay on the
       * models as anchors, always hidden; the lit ones are gathered during the
       * vehicle pass and drawn as one instanced, camera-facing quad set with the
       * same texture, colour, opacity and additive blending (the quad's size is
       * the sprite's scale, its opacity rides in the unused w of the instance
       * matrix's first column).
       *
       * Lamps that shine one way (head and tail lamps: `facing` 1 or -1 along
       * the body) glow brighter than white when they face the camera, so the
       * bloom turns them into a lens glow, and dimmer seen from behind; facing
       * head lamps add a faint horizontal flare streak on HIGH and ULTRA. `gain`
       * brightens a lamp (brake lights), `tint` recolours it (reversing lamps on
       * the tail sprites) and `size` scales it.
       *
       * At street level (the chase view) a lamp faces the lens itself, not the
       * view's axis; a halo is never wider than HALO_STREET_ANGLE of the view (the
       * world-sized glow round the tail lamps of the car just ahead was a red blob
       * a tenth of the frame wide); and a head lamp looking at the camera adds a
       * soft glare of a fixed size on screen (HALO_GLARE_ANGLE), strongest close
       * up, fading with the distance (HALO_GLARE_FADE), as oncoming lights dazzle.
       */
      const HALO_STREET_ANGLE = 0.05,
        HALO_GLARE_ANGLE = 0.15,
        HALO_GLARE_FADE = [70 * UNITS_PER_METRE, 260 * UNITS_PER_METRE];
      const VEHICLE_HALO_CAPACITY = 640,
        vehicleHaloMaterial = new Three.ShaderMaterial({
          // (merge() would clone the texture; the shared halo texture is set below.)
          uniforms: { ...Three.UniformsUtils.merge([Three.UniformsLib.fog]), map: { value: haloTx } },
          vertexShader: `
            #include <common>
            #include <fog_pars_vertex>
            varying vec2 vUv;
            varying vec3 vColor;
            varying float vOpacity;
            void main() {
              vUv = uv;
              #ifdef USE_INSTANCING_COLOR
                vColor = instanceColor;
              #else
                vColor = vec3( 1.0 );
              #endif
              vOpacity = instanceMatrix[ 0 ].w;
              vec4 mvPosition = modelViewMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 );
              mvPosition.xy += position.xy * vec2( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ) );
              gl_Position = projectionMatrix * mvPosition;
              #include <fog_vertex>
            }
          `,
          fragmentShader: `
            #include <common>
            #include <fog_pars_fragment>
            uniform sampler2D map;
            varying vec2 vUv;
            varying vec3 vColor;
            varying float vOpacity;
            void main() {
              vec4 texel = texture2D( map, vUv );
              gl_FragColor = vec4( vColor * texel.rgb, vOpacity * texel.a );
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
              #include <fog_fragment>
            }
          `,
          transparent: true,
          blending: Three.AdditiveBlending,
          depthWrite: false,
          fog: true,
        }),
        vehicleHalos = new Three.InstancedMesh(new Three.PlaneGeometry(1, 1), vehicleHaloMaterial, VEHICLE_HALO_CAPACITY),
        vehicleHaloQueue = new Array(VEHICLE_HALO_CAPACITY).fill(null),
        vehicleHaloTint = new Array(VEHICLE_HALO_CAPACITY).fill(null),
        vehicleHaloOpacity = new Float32Array(VEHICLE_HALO_CAPACITY),
        vehicleHaloFacing = new Int8Array(VEHICLE_HALO_CAPACITY),
        vehicleHaloGain = new Float32Array(VEHICLE_HALO_CAPACITY),
        vehicleHaloSize = new Float32Array(VEHICLE_HALO_CAPACITY),
        vehicleHaloPoint = new Three.Vector3(),
        vehicleHaloMatrix = new Three.Matrix4(),
        vehicleHaloColor = new Three.Color();
      let vehicleHaloCount = 0;
      vehicleHalos.name = 'vehicle halos';
      vehicleHalos.frustumCulled = false;
      vehicleHalos.count = 0;
      vehicleHalos.userData.dynamic = true;
      vehicleHalos.setColorAt(0, new Three.Color(1, 1, 1));
      scene.add(vehicleHalos);
      function queueVehicleHalo(sprite, opacity, facing = 0, gain = 1, tint = null, size = 1) {
        if (vehicleHaloCount >= VEHICLE_HALO_CAPACITY) return;
        const i = vehicleHaloCount++;
        vehicleHaloQueue[i] = sprite;
        vehicleHaloOpacity[i] = opacity;
        vehicleHaloFacing[i] = facing;
        vehicleHaloGain[i] = gain;
        vehicleHaloTint[i] = tint;
        vehicleHaloSize[i] = size;
      }
      function writeVehicleHalo(n, x, y, z, sizeX, sizeY, opacity, color) {
        const e = vehicleHaloMatrix.elements;
        e[0] = sizeX;
        e[1] = 0;
        e[2] = 0;
        e[3] = opacity;
        e[4] = 0;
        e[5] = sizeY;
        e[6] = 0;
        e[7] = 0;
        e[8] = 0;
        e[9] = 0;
        e[10] = 1;
        e[11] = 0;
        e[12] = x;
        e[13] = y;
        e[14] = z;
        e[15] = 1;
        vehicleHalos.setMatrixAt(n, vehicleHaloMatrix);
        vehicleHalos.setColorAt(n, color);
      }
      // After the scene's matrices are current (SCENE MATRICES): place each queued
      // halo where its sprite would have been drawn.
      function flushVehicleHalos() {
        const count = vehicleHaloCount,
          ce = camera.matrixWorld.elements,
          // Towards the viewer: the camera's backward axis.
          vx = ce[8],
          vy = ce[9],
          vz = ce[10],
          flares = (activeTier?.bloom ?? 0) >= 5,
          // At street level: towards the lens (its place), sizes held to a share of the view.
          street = chaseViewActive,
          lensX = ce[12],
          lensY = ce[13],
          lensZ = ce[14];
        let n = 0;
        for (let i = 0; i < count; i++) {
          const sprite = vehicleHaloQueue[i],
            parent = sprite.parent,
            pe = parent.matrixWorld.elements,
            parentScale = Math.hypot(pe[0], pe[1], pe[2]),
            facing = vehicleHaloFacing[i];
          let size = sprite.scale.x * parentScale * vehicleHaloSize[i],
            lens = 0,
            ax = vx,
            ay = vy,
            az = vz;
          vehicleHaloPoint.copy(sprite.position).applyMatrix4(parent.matrixWorld);
          if (street) {
            ax = lensX - vehicleHaloPoint.x;
            ay = lensY - vehicleHaloPoint.y;
            az = lensZ - vehicleHaloPoint.z;
            lens = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
            ax /= lens;
            ay /= lens;
            az /= lens;
            if (size > lens * HALO_STREET_ANGLE) size = lens * HALO_STREET_ANGLE;
          }
          let gain = vehicleHaloGain[i],
            toward = 0;
          if (facing) {
            // How squarely the lamp faces the camera (the body's x axis is its heading).
            toward = (facing * (pe[0] * ax + pe[1] * ay + pe[2] * az)) / (parentScale || 1);
            gain *= (0.55 + 0.45 * Three.MathUtils.smoothstep(toward, -0.6, 0.15)) * (1 + (facing > 0 ? 1.0 : 0.6) * Three.MathUtils.smoothstep(toward, 0.05, 0.7));
          }
          vehicleHaloColor.copy(vehicleHaloTint[i] || sprite.material.color).multiplyScalar(gain);
          const opacity = vehicleHaloOpacity[i];
          writeVehicleHalo(n++, vehicleHaloPoint.x, vehicleHaloPoint.y, vehicleHaloPoint.z, size, size, opacity, vehicleHaloColor);
          // Street level: a head lamp looking at the lens dazzles (a soft glare of a fixed size on screen).
          if (street && facing > 0 && toward > 0.5 && n < VEHICLE_HALO_CAPACITY) {
            const glare = Three.MathUtils.smoothstep(toward, 0.5, 0.95) * (1 - Three.MathUtils.smoothstep(lens, HALO_GLARE_FADE[0], HALO_GLARE_FADE[1]));
            if (glare > 0.01) {
              const wide = lens * HALO_GLARE_ANGLE;
              writeVehicleHalo(n++, vehicleHaloPoint.x, vehicleHaloPoint.y, vehicleHaloPoint.z, wide, wide, opacity * 0.2 * glare, vehicleHaloColor);
            }
          }
          // A head lamp looking at the camera: a thin horizontal flare streak.
          if (flares && facing > 0 && toward > 0.2 && n < VEHICLE_HALO_CAPACITY) {
            const streak = Three.MathUtils.smoothstep(toward, 0.2, 0.8);
            writeVehicleHalo(n++, vehicleHaloPoint.x, vehicleHaloPoint.y, vehicleHaloPoint.z, size * 5, size * 0.2, opacity * 0.28 * streak, vehicleHaloColor);
          }
          vehicleHaloQueue[i] = null;
          vehicleHaloTint[i] = null;
        }
        vehicleHalos.count = n;
        vehicleHalos.visible = n > 0;
        if (n) {
          vehicleHalos.instanceMatrix.clearUpdateRanges();
          vehicleHalos.instanceMatrix.addUpdateRange(0, n * 16);
          vehicleHalos.instanceMatrix.needsUpdate = true;
          vehicleHalos.instanceColor.clearUpdateRanges();
          vehicleHalos.instanceColor.addUpdateRange(0, n * 3);
          vehicleHalos.instanceColor.needsUpdate = true;
        }
        vehicleHaloCount = 0;
      }
      // @include src/damage3d.js
      // Blood stains on a vehicle's bodywork (car-stains.js holds the data).
      // @include src/carblood3d.js
      const lampGlowPending = [];
      // Lamp posts are instanced (post, arm, lantern) so a car can knock one flat
      // without unbatching the street; each is a street prop in damage.js.
      const LAMP_HEIGHT = 9 * UNITS_PER_METRE,
        lampPosts = lamps.length,
        lampPoles = new Three.InstancedMesh(boxGeo, darkMetal, lampPosts),
        lampArms = new Three.InstancedMesh(boxGeo, darkMetal, lampPosts),
        lampHeads = new Three.InstancedMesh(boxGeo, warmLamp, lampPosts);
      for (const pool of [lampPoles, lampArms, lampHeads]) {
        pool.count = 0;
        pool.castShadow = true;
        pool.receiveShadow = true;
        pool.frustumCulled = false;
        scene.add(pool);
      }
      // Every lamp is drawn (only every second one used to be, which left most
      // streets dark at night). Its pool of light is in the night light map
      // (lighting3d.js) and its halo in the glow field (below), so a lamp is three
      // instances and nothing else: the per-lamp group, halo sprite and hidden
      // ground-glow plane (a mesh and a material for each of ~1000 lamps) are gone.
      for (let i = 0; i < lamps.length; i++) {
        const l = lamps[i],
          prop = registerStreetProp('lamp', l.x, l.y);
        // A 9 m street light (LAMP_HEIGHT), its arm reaching out over the kerb.
        placePropInstance(lampPoles, prop, l.x, LAMP_HEIGHT / 2, l.y, 1.6, LAMP_HEIGHT, 1.6);
        placePropInstance(lampArms, prop, l.x + 3, LAMP_HEIGHT, l.y, 7, 1, 1);
        placePropInstance(lampHeads, prop, l.x + 6, LAMP_HEIGHT - 0.5, l.y, 5, 1.2, 3);
        lampGlowPending.push({ x: l.x + 6, z: l.y, prop });
      }
      // @include src/signkit3d.js
      // @include src/signdesigns3d.js
      /**
       * Landmark and business signs. Each business's board is designed for its
       * trade (signdesigns3d.js: bent neon for the clubs, marquee bulbs for the
       * casino and cinema, a lightbox for the hospital, stencilled steel for the
       * armory, weathered planks for the pub...). The painted face is the map;
       * what lights up at night (tubes, bulbs, a lightbox panel, a lamp-washed
       * board) is the emissive mask, whose strength signage3d.js drives with the
       * hour (and the district's power), so it blooms after dark. Shaped boards
       * and free-standing letters are cut out. Behind the face sits one backing
       * mesh: a box for a board, a thin raceway for cut-out letters, a smaller box
       * hidden behind an oval or arch. Street-level boards also spill their colour
       * onto the pavement and the wet road; `options.marquee` (or the design) rings
       * the board with chasing bulbs, and floodlit designs get lamps over the
       * board (signage3d.js places both once every caller has moved its sign).
       * `options.style` is a hint for names the style table does not know
       * ('transit', 'kiosk', 'truck', 'town', 'resort', 'trail').
       */
      // Canvas textures painted once and uploaded once (the ground sheets, each sign's face and glow mask): their
      // bitmaps are freed after the upload (render3d-resources.js BAKED CANVAS RELEASE). A sign's two 1024 x 256
      // canvases are 2 MB: a few hundred signs held ~0.5 GB of canvas memory beside their copy on the GPU.
      const bakedCanvases = [],
        // Every sign() board: they hang straight from the scene, so the cell pre-upload lists them itself.
        signMeshes = [];
      const signBoards = [],
        signTexture = (canvas) => {
          const tx = new Three.CanvasTexture(canvas);
          tx.colorSpace = Three.SRGBColorSpace;
          tx.minFilter = Three.LinearMipmapLinearFilter;
          tx.magFilter = Three.LinearFilter;
          tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          bakedCanvases.push(tx);
          return tx;
        };
      function sign(text, x, z, width, color, vertical = false, options = {}) {
        const face = document.createElement('canvas'),
          glowCanvas = document.createElement('canvas');
        face.width = glowCanvas.width = 1024;
        face.height = glowCanvas.height = 256;
        const cg = face.getContext('2d'),
          gg = glowCanvas.getContext('2d');
        gg.fillStyle = '#000';
        gg.fillRect(0, 0, 1024, 256);
        const design = SignArt.paint(cg, gg, 1024, 256, text, color, options.style),
          height = width / 4,
          m = new Three.Mesh(
            new Three.PlaneGeometry(width, height),
            litSignMaterial(signTexture(face), signTexture(glowCanvas), {
              night: design.night,
              day: design.day,
              doubleSided: !design.cutout,
              cutout: design.cutout,
              flicker: design.flicker,
            }),
          );
        // Centred on the fascia over the ground floor (SHOP_FLOOR), but never so low that a wide board sinks into the ground
        // (a 235-wide sign is 59 tall); callers raise facade signs further.
        const signY = Math.max(SHOP_FLOOR + 5, width / 8 + 3);
        m.position.set(x, signY, z + 0.6);
        m.userData.sign = true;
        m.receiveShadow = true;
        scene.add(m);
        signMeshes.push(m);
        const backMat = staticMat(design.backColor, 0.6, 0.3);
        m.userData.backing =
          design.backing === 'raceway'
            ? box(scene, x, signY, z - 0.6, width * 0.82, Math.max(1.2, height * 0.14), 1.6, backMat)
            : design.backing === 'inset'
              ? box(scene, x, signY, z - 1.5, width * 0.68, height * 0.62, 3, backMat)
              : box(scene, x, signY, z - 1.5, width + 3, height + 3, 3, backMat);
        signBoards.push({ mesh: m, width, color: design.light || color, marquee: !!(options.marquee || design.marquee), lamps: design.lamps });
        return m;
      }
      // (The story payphone is payphone3d.js.)
