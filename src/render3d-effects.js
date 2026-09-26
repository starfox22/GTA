      // Player/objective rings, arrows, muzzle and head lights, smoke and flame sprites.
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
      const objectiveRing = new Three.Mesh(
        new Three.RingGeometry(27, 29, 48),
        new Three.MeshBasicMaterial({
          color: '#ebd297',
          transparent: true,
          opacity: 0.8,
          side: Three.DoubleSide,
          depthWrite: false,
        }),
      );
      objectiveRing.rotation.x = -Math.PI / 2;
      scene.add(objectiveRing);
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
      const targetLight = new Three.PointLight('#ffd083', 0.5, 90, 1);
      scene.add(targetLight);
      const playerHeadlight = new Three.SpotLight('#ffe6b4', 900, 210, Math.PI * 0.23, 0.7, 1.1);
      playerHeadlight.position.set(0, 10, 0);
      scene.add(playerHeadlight, playerHeadlight.target);
      const muzzleLight = new Three.PointLight('#ffc67a', 0, 95, 1.5);
      scene.add(muzzleLight);
      const smokeCanvas = document.createElement('canvas');
      smokeCanvas.width = smokeCanvas.height = 128;
      const sm = smokeCanvas.getContext('2d');
      for (let i = 0; i < 28; i++) {
        const x = 64 + Math.sin(i * 2.4) * 34,
          y = 64 + Math.cos(i * 1.7) * 34,
          r = 14 + (i % 7) * 3,
          gr = sm.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, '#ffffff55');
        gr.addColorStop(1, '#ffffff00');
        sm.fillStyle = gr;
        sm.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const smokeTx = new Three.CanvasTexture(smokeCanvas);
      const flameCanvas = document.createElement('canvas');
      flameCanvas.width = 64;
      flameCanvas.height = 128;
      const fg = flameCanvas.getContext('2d');
      for (let i = 0; i < 9; i++) {
        const x = 32 + Math.sin(i * 2.4) * 11,
          y = 88 - i * 7,
          r = 21 - i * 1.5,
          gr = fg.createRadialGradient(x, y, 1, x, y, r);
        gr.addColorStop(0, i < 3 ? '#fff5ca' : '#ffbb65');
        gr.addColorStop(0.45, '#ff8313c0');
        gr.addColorStop(1, '#dd3b0000');
        fg.fillStyle = gr;
        fg.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const flameTx = new Three.CanvasTexture(flameCanvas);
      flameTx.colorSpace = Three.SRGBColorSpace;
      const smokeMat = new Three.SpriteMaterial({
        map: smokeTx,
        color: '#8b8b8f',
        transparent: true,
        depthWrite: false,
      });
      const blastRings = Array.from(
        {
          length: 10,
        },
        () => {
          const m = new Three.Mesh(
            new Three.RingGeometry(0.82, 1, 48),
            new Three.MeshBasicMaterial({
              color: '#e7d0a6',
              transparent: true,
              opacity: 0,
              side: Three.DoubleSide,
              depthWrite: false,
            }),
          );
          m.rotation.x = -Math.PI / 2;
          m.visible = false;
          scene.add(m);
          return m;
        },
      );
      let blastRingIndex = 0;
      const flamePool = Array.from(
        {
          length: 72,
        },
        () => {
          const s = new Three.Sprite(
            new Three.SpriteMaterial({
              map: flameTx,
              transparent: true,
              depthWrite: false,
              blending: Three.AdditiveBlending,
            }),
          );
          s.visible = false;
          scene.add(s);
          return s;
        },
      );
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
              map: smokeTx,
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
      const bloodDropCanvas = document.createElement('canvas');
      bloodDropCanvas.width = bloodDropCanvas.height = 32;
      const dropCtx = bloodDropCanvas.getContext('2d');
      dropCtx.fillStyle = '#ffffff';
      dropCtx.beginPath();
      dropCtx.ellipse(16, 16, 9, 13, 0.25, 0, TAU);
      dropCtx.fill();
      const bloodDropTx = new Three.CanvasTexture(bloodDropCanvas);
      const particlePool = Array.from(
        {
          length: 480,
        },
        () => {
          const s = new Three.Sprite(smokeMat.clone());
          s.visible = false;
          scene.add(s);
          return s;
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
      const skidGeo = new Three.BufferGeometry(),
        skidPos = new Float32Array(6600);
      skidGeo.setAttribute(
        'position',
        new Three.BufferAttribute(skidPos, 3).setUsage(Three.DynamicDrawUsage),
      );
      const skidLines = new Three.LineSegments(
        skidGeo,
        new Three.LineBasicMaterial({
          color: '#171b20',
          transparent: true,
          opacity: 0.5,
        }),
      );
      scene.add(skidLines);
      let muzzleUntil = 0,
        frames = 0,
        nightAmount = 0;
