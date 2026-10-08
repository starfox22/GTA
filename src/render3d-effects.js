      // The optional player ring, the objective arrow, the muzzle and fire lights, the effect particles (fx3d-*.js), scorch, tracers, skid marks.
      /**
       * PLAYER AT NIGHT
       * No light follows the player (the pool of light that rode at their feet
       * read as an effect, not as a lit street). Only a faint cool rim on the
       * edges turned away from the camera, as moonlight catching the shoulders,
       * keeps their silhouette from dissolving into an unlit street; it follows
       * nightAmount and is gone by day. Settings · Graphics · Player outline at
       * night (settings.js `playerOutlineOn`, saved with the other settings)
       * switches it off.
       */
      // The rim itself is in the rig's paint shader (character-rig3d.js `playerRim`).
      const PLAYER_RIM_NIGHT = new Three.Color('#6d80a6');
      // @include src/parachute3d.js
      const playerRing = new Three.Mesh(
        new Three.RingGeometry(10, 11.2, 36),
        new Three.MeshBasicMaterial({
          color: '#c9e29f',
          transparent: true,
          opacity: 0.5,
          side: Three.DoubleSide,
          depthWrite: false,
        }),
      );
      playerRing.rotation.x = -Math.PI / 2;
      scene.add(playerRing);
      const arrowGroup = new Three.Group();
      const arrowMat = new Three.MeshBasicMaterial({
        color: '#ffe2a2',
        depthTest: false,
        depthWrite: false,
      });
      const cone = mesh(new Three.ConeGeometry(6, 10, 4), arrowMat, arrowGroup, 0, 0, 0);
      cone.rotation.z = Math.PI;
      cone.renderOrder = 99;
      scene.add(arrowGroup);
      // The respray arrow (garages.js garageBeacon): the same pointer in the shops' paint-blue, over a garage door
      // while the police chase the player.
      const resprayArrow = new Three.Group();
      const resprayCone = mesh(cone.geometry, new Three.MeshBasicMaterial({ color: '#8fd3ff', depthTest: false, depthWrite: false }), resprayArrow, 0, 0, 0);
      resprayCone.rotation.z = Math.PI;
      resprayCone.renderOrder = 99;
      resprayArrow.visible = false;
      scene.add(resprayArrow);
      // (The player's headlights are CAR LAMPS slot 0, lighting3d-vehicle-lights.js.)
      const muzzleLight = new Three.PointLight('#ffc67a', 0, 95, 1.5);
      scene.add(muzzleLight);
      // A blast's scorch on the ground (`debris`): a soot core, a ragged edge and rays of soot thrown out from it
      // (it was the old smoke sprite's ring of soft blobs, a pale donut at street level). Drawn once, no randomness.
      const scorchCanvas = document.createElement('canvas');
      scorchCanvas.width = scorchCanvas.height = 128;
      const sm = scorchCanvas.getContext('2d');
      const scorchCore = sm.createRadialGradient(64, 64, 0, 64, 64, 46);
      scorchCore.addColorStop(0, '#ffffffff');
      scorchCore.addColorStop(0.45, '#ffffffc8');
      scorchCore.addColorStop(0.8, '#ffffff50');
      scorchCore.addColorStop(1, '#ffffff00');
      sm.fillStyle = scorchCore;
      sm.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 30; i++) {
        const a = i * 2.39996 + (i % 3) * 0.21,
          length = 30 + ((i * 37) % 31),
          half = 0.035 + (i % 4) * 0.02;
        sm.fillStyle = 'rgba(255,255,255,' + (0.16 + (i % 5) * 0.045) + ')';
        sm.beginPath();
        sm.moveTo(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 8);
        sm.lineTo(64 + Math.cos(a - half) * length, 64 + Math.sin(a - half) * length);
        sm.lineTo(64 + Math.cos(a + half) * length, 64 + Math.sin(a + half) * length);
        sm.closePath();
        sm.fill();
      }
      for (let i = 0; i < 16; i++) {
        const a = i * 1.7 + 0.4,
          r = 26 + ((i * 13) % 14),
          x = 64 + Math.cos(a) * r,
          y = 64 + Math.sin(a) * r,
          size = 5 + (i % 4) * 2.5,
          blot = sm.createRadialGradient(x, y, 0, x, y, size);
        blot.addColorStop(0, '#ffffff70');
        blot.addColorStop(1, '#ffffff00');
        sm.fillStyle = blot;
        sm.fillRect(x - size, y - size, size * 2, size * 2);
      }
      const scorchTx = new Three.CanvasTexture(scorchCanvas);
      // On the GPU from the start (the first blast must not upload it), its canvas then freed.
      renderer.initTexture(scorchTx);
      bakedCanvases.push(scorchTx);
      /* FX SPRITE ORDER: the effect particles (smoke, flame, sparks, blood drops: fx3d-particles.js)
         are drawn after every ground decal (blood pools 3, scorch 2, mud 3), tyre smoke (4) and
         the car blood skin (6). Three.js sorts transparent objects by renderOrder before depth
         and none of these write depth, so with the default 0 a blood pool under a blast was
         painted over the fireball. */
      const FX_SPRITE_ORDER = 8;
      // Smoke, dust, fire, sparks, flashes, glass and drops: one instanced pool and its recipes.
      // @include src/fx3d-atlas.js
      // @include src/fx3d-particles.js
      // @include src/fx3d-recipes.js
      const fireLights = Array.from(
        {
          length: 4,
        },
        () => {
          const light = new Three.PointLight('#ff9f4b', 0, 180, 1.5);
          scene.add(light);
          return light;
        },
      );
      const scorchMeshes = Array.from(
        {
          length: 36,
        },
        () => {
          const m = new Three.Mesh(
            new Three.PlaneGeometry(1, 1),
            new Three.MeshBasicMaterial({
              map: scorchTx,
              color: '#07090b',
              transparent: true,
              opacity: 0.75,
              depthWrite: false,
            }),
          );
          m.rotation.x = -Math.PI / 2;
          m.visible = false;
          m.renderOrder = 2;
          scene.add(m);
          return m;
        },
      );
      const tracerGeo = new Three.BufferGeometry(),
        tracerPositions = new Float32Array(3600);
      tracerGeo.setAttribute(
        'position',
        new Three.BufferAttribute(tracerPositions, 3).setUsage(Three.DynamicDrawUsage),
      );
      const tracer = new Three.LineSegments(
        tracerGeo,
        new Three.LineBasicMaterial({
          color: '#ffe1a1',
          transparent: true,
          opacity: 0.85,
        }),
      );
      scene.add(tracer);
      // Skid marks (tyre-effects.js `skids`): a thin strip per mark, two triangles, each
      // with its own darkness and fade in the vertex colour's alpha.
      const SKID_MARKS = 1100,
        skidGeo = new Three.BufferGeometry(),
        skidPos = new Float32Array(SKID_MARKS * 18),
        skidColor = new Float32Array(SKID_MARKS * 24).fill(1);
      skidGeo.setAttribute('position', new Three.BufferAttribute(skidPos, 3).setUsage(Three.DynamicDrawUsage));
      skidGeo.setAttribute('color', new Three.BufferAttribute(skidColor, 4).setUsage(Three.DynamicDrawUsage));
      const skidLines = new Three.Mesh(
        skidGeo,
        new Three.MeshBasicMaterial({
          color: '#15181b',
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      skidLines.renderOrder = 2;
      scene.add(skidLines);
      let muzzleUntil = 0,
        frames = 0,
        nightAmount = 0;
