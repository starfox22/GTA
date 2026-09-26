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
       */
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
              mvPosition.xy += position.xy * length( instanceMatrix[ 0 ].xyz );
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
        vehicleHaloQueue = [],
        vehicleHaloOpacity = [],
        vehicleHaloPoint = new Three.Vector3(),
        vehicleHaloMatrix = new Three.Matrix4();
      vehicleHalos.name = 'vehicle halos';
      vehicleHalos.frustumCulled = false;
      vehicleHalos.count = 0;
      vehicleHalos.userData.dynamic = true;
      vehicleHalos.setColorAt(0, new Three.Color(1, 1, 1));
      scene.add(vehicleHalos);
      function queueVehicleHalo(sprite, opacity) {
        if (vehicleHaloQueue.length >= VEHICLE_HALO_CAPACITY) return;
        vehicleHaloQueue.push(sprite);
        vehicleHaloOpacity.push(opacity);
      }
      // After the scene's matrices are current (SCENE MATRICES): place each queued
      // halo where its sprite would have been drawn.
      function flushVehicleHalos() {
        const n = vehicleHaloQueue.length,
          e = vehicleHaloMatrix.elements;
        for (let i = 0; i < n; i++) {
          const sprite = vehicleHaloQueue[i],
            parent = sprite.parent,
            pe = parent.matrixWorld.elements,
            parentScale = Math.hypot(pe[0], pe[1], pe[2]),
            size = sprite.scale.x * parentScale;
          vehicleHaloPoint.copy(sprite.position).applyMatrix4(parent.matrixWorld);
          e[0] = size;
          e[1] = 0;
          e[2] = 0;
          e[3] = vehicleHaloOpacity[i];
          e[4] = 0;
          e[5] = size;
          e[6] = 0;
          e[7] = 0;
          e[8] = 0;
          e[9] = 0;
          e[10] = size;
          e[11] = 0;
          e[12] = vehicleHaloPoint.x;
          e[13] = vehicleHaloPoint.y;
          e[14] = vehicleHaloPoint.z;
          e[15] = 1;
          vehicleHalos.setMatrixAt(i, vehicleHaloMatrix);
          vehicleHalos.setColorAt(i, sprite.material.color);
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
        vehicleHaloQueue.length = 0;
        vehicleHaloOpacity.length = 0;
      }
      // @include src/damage3d.js
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
      const signBoards = [],
        signTexture = (canvas) => {
          const tx = new Three.CanvasTexture(canvas);
          tx.colorSpace = Three.SRGBColorSpace;
          tx.minFilter = Three.LinearMipmapLinearFilter;
          tx.magFilter = Three.LinearFilter;
          tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
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
      const ph = new Three.Group();
      ph.position.set(phone.x, 0, phone.y);
      scene.add(ph);
      box(ph, 0, 7, 0, 7, 14, 5, mat('#4f7d73', 0.5, 0.45));
      box(ph, 0, 10, 2.8, 5, 7, 0.5, darkMetal);
      box(ph, 0, 12, 3.1, 3, 2, 0.1, mat('#b0c9b1'));
      box(ph, 0, 17, 0, 12, 2, 8, mat('#517c70'));
      halo(ph, 0, 14, 0, 8, '#9bdbb1');
