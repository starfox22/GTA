      // BEGIN SUBSYSTEM: src/beachclub3d.js — Marea Beach Club meshes and show lighting
      /**
       * Marea Beach Club meshes and show lighting
       * Source: src/beachclub3d.js
       * Scope: createCityRenderer() closure.
       *
       * Draws the plan in beachclub.js (MAREA, plot-local u east / v south): the
       * forecourt with its ropes, red carpet, portal and neon sign; the low street
       * wall; the staff and restroom blocks; the stage with the DJ desk, the LED
       * wall and the speaker stacks; the dance floor under a lighting truss; the
       * main bar and back bar under white sails; the VIP terrace; daybeds and
       * cabanas; the infinity pool with its swim-up bar; the sunken fire lounge;
       * the deck, the beach gate and the club's sand with sunbeds and parasols.
       *
       * DRAW CALLS: everything fixed goes into `batchGroups` (merged per material),
       * sharing a small set of materials. What moves or glows is instanced: 153
       * LED floor tiles, 8 moving-head beams and their floor spots, 12 lasers,
       * torch flames; string lights and uplights are one Points cloud (kitLight,
       * boats3d.js). The sails fade out while the player is inside, so they never
       * hide the people under them.
       *
       * SHOW: `updateBeachClubVisuals` (called from updateBeachVisuals) runs the
       * lights from `mareaGroove` (beachclub-audio.js): the floor patterns change
       * every bar, the moving heads chase on the beat, lasers fan out in the
       * groove and the drop, the strobe fires in the last bar of the build, the
       * LED wall draws an equaliser. By day the floor is marble, the wall shows
       * the sea, and only the pool glitters. Gunfire kills the show and brings the
       * house lights up.
       */
      // The club's many local names (materials, meshes, the show state) stay in
      // their own scope; the renderer only needs the per-frame update.
      const updateBeachClubVisuals = buildBeachClub3D();
      function buildBeachClub3D() {
        const MX = MAREA.plot.x,
          MY = MAREA.plot.y,
          clubGroup = new Three.Group(),
          clubLive = new Three.Group();
        clubGroup.name = 'Marea beach club';
        clubLive.name = 'Marea show lighting';
        clubLive.userData.dynamic = true;
        scene.add(clubGroup);
        scene.add(clubLive);
        // Glow sprites hang off a group at the plot corner, in plot-local units, so
        // the neon pass (cityscape3d.js) reads the club's own district power.
        const clubHalos = new Three.Group();
        clubHalos.position.set(MX, 0, MY);
        clubLive.add(clubHalos);
        batchGroups.push(clubGroup);
        statics.push({ x: MX + 200, y: MY + 150, group: clubGroup, radius: 320 });
        const clubLights = [];
        /* A box by plot-local extents: u0..u1, v0..v1, from height y0 to y1. */
        function clubSlab(group, u0, v0, u1, v1, y0, y1, material) {
          return box(group, MX + (u0 + u1) / 2, (y0 + y1) / 2, MY + (v0 + v1) / 2, u1 - u0, y1 - y0, v1 - v0, material);
        }
        function clubCyl(group, u, v, y0, y1, r, material, segments) {
          const m = mesh(segments ? new Three.CylinderGeometry(1, 1, 1, segments) : cylinderGeo, material, group, MX + u, (y0 + y1) / 2, MY + v, r, y1 - y0, r);
          return m;
        }
        /* Canvas textures. */
        function clubTexture(w, h, draw, repeat) {
          const cv = document.createElement('canvas');
          cv.width = w;
          cv.height = h;
          draw(cv.getContext('2d'), w, h);
          const t = new Three.CanvasTexture(cv);
          t.colorSpace = Three.SRGBColorSpace;
          if (repeat) {
            t.wrapS = t.wrapT = Three.RepeatWrapping;
            t.repeat.set(repeat[0], repeat[1]);
          }
          t.anisotropy = 4;
          return t;
        }
        const stoneTexture = clubTexture(
            128,
            128,
            (g, w, h) => {
              g.fillStyle = '#e8e0d0';
              g.fillRect(0, 0, w, h);
              let seed = 17;
              const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
              for (let i = 0; i < 900; i++) {
                g.fillStyle = rnd() < 0.5 ? 'rgba(170,150,120,0.10)' : 'rgba(255,255,250,0.18)';
                g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2);
              }
              g.strokeStyle = 'rgba(150,135,110,0.45)';
              g.lineWidth = 1.2;
              for (let k = 0; k <= 2; k++) {
                g.beginPath();
                g.moveTo(0, (k * h) / 2);
                g.lineTo(w, (k * h) / 2);
                g.stroke();
              }
              for (let row = 0; row < 2; row++)
                for (const x of row ? [0, w / 2] : [w / 4, (3 * w) / 4]) {
                  g.beginPath();
                  g.moveTo(x, (row * h) / 2);
                  g.lineTo(x, ((row + 1) * h) / 2);
                  g.stroke();
                }
            },
            [16, 12],
          ),
          plankTexture = clubTexture(
            64,
            64,
            (g, w, h) => {
              g.fillStyle = '#9c7352';
              g.fillRect(0, 0, w, h);
              for (let i = 0; i < 8; i++) {
                g.fillStyle = ['#a67b58', '#8f6849', '#b0845f', '#976f4f'][i % 4];
                g.fillRect(0, i * 8, w, 7);
                g.fillStyle = 'rgba(60,40,25,0.55)';
                g.fillRect(0, i * 8 + 7, w, 1);
                g.fillRect(((i * 37) % 64) | 0, i * 8, 1, 7);
              }
            },
            [10, 4],
          ),
          mosaicTexture = clubTexture(
            128,
            64,
            (g, w, h) => {
              g.fillStyle = '#2aa9c0';
              g.fillRect(0, 0, w, h);
              let seed = 5;
              const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
              for (let y = 0; y < h; y += 4)
                for (let x = 0; x < w; x += 4) {
                  const c = rnd();
                  g.fillStyle = c < 0.3 ? '#35bfd4' : c < 0.55 ? '#1f97b3' : c < 0.6 ? '#e8f6f8' : '#2cb0c8';
                  g.fillRect(x, y, 3.4, 3.4);
                }
              // Lane lines.
              g.fillStyle = '#16517a';
              for (let y = 8; y < h; y += 16) g.fillRect(6, y, w - 12, 2);
            },
            [6, 3],
          );
        const M = {
          render: mat('#f1ece2', 0.88),
          stone: new Three.MeshStandardMaterial({ map: stoneTexture, roughness: 0.62 }),
          paving: mat('#58534d', 0.8),
          deck: new Three.MeshStandardMaterial({ map: plankTexture, roughness: 0.78 }),
          teak: mat('#9a6f4c', 0.7),
          darkWood: mat('#4a3526', 0.72),
          bronze: mat('#6e5436', 0.42, 0.62),
          black: mat('#141518', 0.55),
          speaker: mat('#1b1c1f', 0.8),
          cone: mat('#2c2d31', 0.45, 0.3),
          cushion: mat('#f6f3ec', 0.95),
          teal: mat('#2c7a84', 0.9),
          thatch: mat('#b89662', 0.95),
          green: mat('#3f6d45', 0.9),
          bougainvillea: mat('#c93f7e', 0.85),
          gold: mat('#caa24a', 0.3, 0.8),
          velvet: mat('#7d1424', 0.85),
          carpet: mat('#8c1a2a', 0.95),
          chrome: chrome,
          metal: darkMetal,
          coping: mat('#f4efe6', 0.6),
          glassRail: new Three.MeshStandardMaterial({ color: '#b9dde2', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28 }),
          stage: mat('#1e1f23', 0.6),
          bottle: new Three.MeshStandardMaterial({ color: '#6b8f7a', roughness: 0.2, emissive: '#ffb45a', emissiveIntensity: 0 }),
        };
        /* LEDs: unlit colours that follow the night (dim grey tubes by day). */
        const clubLeds = [];
        function clubLed(color, dayLevel = 0.08) {
          const m = new Three.MeshBasicMaterial({ color, toneMapped: false });
          clubLeds.push({ m, color: new Three.Color(color), day: dayLevel });
          return m;
        }
        const LED = {
          cyan: clubLed('#34e4ff'),
          magenta: clubLed('#ff3ab0'),
          warm: clubLed('#ffc27a', 0.2),
          white: clubLed('#fff6e8', 0.35),
          amber: clubLed('#ffa640', 0.12),
        };

        /* ---- ground: forecourt paving, club floor, deck, dance floor base ---- */
        function clubPlane(u0, v0, u1, v1, y, material, repeatScale) {
          const geo = new Three.PlaneGeometry(u1 - u0, v1 - v0);
          geo.rotateX(-Math.PI / 2);
          if (repeatScale) {
            const uv = geo.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (u1 - u0)) / repeatScale, (uv.getY(i) * (v1 - v0)) / repeatScale);
          }
          const m = mesh(geo, material, clubGroup, MX + (u0 + u1) / 2, y, MY + (v0 + v1) / 2);
          m.castShadow = false;
          return m;
        }
        stoneTexture.repeat.set(1, 1);
        plankTexture.repeat.set(1, 1);
        mosaicTexture.repeat.set(1, 1);
        clubPlane(0, 0, 400, 44, 0.3, M.paving);
        clubPlane(0, 52, 400, 272, 0.35, M.stone, 24);
        clubPlane(0, 272, 400, 300, 0.4, M.deck, 22);
        // The club's own sand between the deck and the sea (the public beach's sand
        // is beach3d.js's; this covers the point round the plot).
        (function clubSand() {
          const x0 = MX - 80,
            y0 = MY - 10,
            x1 = BEACH.polygon[0][0] + 2,
            y1 = MY + 430,
            cell = 4,
            w = Math.ceil((x1 - x0) / cell),
            h = Math.ceil((y1 - y0) / cell),
            tx = clubTexture(w, h, (g) => {
              let seed = 99;
              const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
              for (let j = 0; j < h; j++)
                for (let i = 0; i < w; i++) {
                  const x = x0 + (i + 0.5) * cell,
                    y = y0 + (j + 0.5) * cell;
                  const inPlot = x > MX - 2 && x < MX + 402 && y < MY + 302;
                  if (inPlot || !landAt(x, y)) continue;
                  const n = rnd();
                  g.fillStyle = n < 0.15 ? '#dcc79a' : n < 0.3 ? '#efe0b8' : '#e6d4a8';
                  g.fillRect(i, j, 1, 1);
                }
            });
          tx.magFilter = Three.LinearFilter;
          const geo = new Three.PlaneGeometry(x1 - x0, y1 - y0);
          geo.rotateX(-Math.PI / 2);
          const m = new Three.Mesh(geo, new Three.MeshStandardMaterial({ map: tx, roughness: 0.95, alphaTest: 0.5, transparent: false }));
          m.position.set((x0 + x1) / 2, 0.22, (y0 + y1) / 2);
          m.receiveShadow = true;
          clubGroup.add(m);
        })();

        /* ---- the street side ---- */
        const d = MAREA.door;
        // The low white wall with a planted top and a cyan LED line.
        for (const [u0, u1] of [
          [0, d[0] - 6],
          [d[2] + 6, 400],
        ]) {
          clubSlab(clubGroup, u0, 44, u1, 52, 0, 10, M.render);
          clubSlab(clubGroup, u0, 44.6, u1, 51.4, 10, 11.2, M.green);
          clubSlab(clubGroup, u0, 43.6, u1, 44.2, 1.2, 1.8, LED.cyan);
        }
        // Side walls and the planting along them.
        clubSlab(clubGroup, 0, 52, 5, 262, 0, 16, M.render);
        clubSlab(clubGroup, 395, 52, 400, 200, 0, 16, M.render);
        for (const [u0, u1] of [
          [5, 9],
          [391, 395],
        ])
          clubSlab(clubGroup, u0, 104, u1, u0 < 100 ? 190 : 196, 0, 9, M.green);
        for (let v = 110; v < 190; v += 13) clubSlab(clubGroup, 391, v, 395, v + 6, 8.5, 10.5, M.bougainvillea);
        // Glass balustrades to the sea and the sides.
        const glassRail = new Three.Group();
        glassRail.userData.dynamic = true;
        clubGroup.add(glassRail);
        for (const r of [
          [0, 262, 4, 300],
          [396, 200, 400, 300],
          [0, 296, MAREA.gate[0], 300],
          [MAREA.gate[2], 296, 400, 300],
        ]) {
          clubSlab(glassRail, r[0] + 1, r[1] + 1, r[2] - 1, r[3] - 1, 0.5, 6.5, M.glassRail);
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 6.5, 7.2, M.teak);
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 0, 0.8, M.teak);
        }
        // The beach gate: two posts and steps down onto the sand.
        for (const u of [MAREA.gate[0] - 3, MAREA.gate[2] + 1]) clubSlab(clubGroup, u, 295, u + 2, 301, 0, 9, M.teak);
        for (let k = 0; k < 3; k++) clubSlab(clubGroup, MAREA.gate[0], 300 + k * 4, MAREA.gate[2], 304 + k * 4, 0, 1.6 - k * 0.5, M.deck);
        clubSlab(clubGroup, MAREA.gate[0] + 6, 312, MAREA.gate[2] - 6, 346, 0, 0.5, M.deck);
        // Portal: bronze frame round the door, the host's podium, the ropes, the carpet.
        clubSlab(clubGroup, 284, 43, 290, 53, 0, 30, M.bronze);
        clubSlab(clubGroup, 314, 43, 320, 53, 0, 30, M.bronze);
        clubSlab(clubGroup, 284, 43, 320, 53, 30, 34, M.bronze);
        clubSlab(clubGroup, 290, 43.4, 314, 44, 29, 30, LED.warm);
        clubSlab(clubGroup, 290, 40, 314, 60, 0.36, 0.5, M.carpet);
        clubSlab(clubGroup, 284, 24, 400, 40, 0.34, 0.46, M.carpet);
        clubSlab(clubGroup, 318, 12, 400, 24, 0.34, 0.46, M.carpet);
        const ropeLine = (u0, u1, v) => {
          const n = Math.max(1, Math.round((u1 - u0) / 10));
          for (let k = 0; k <= n; k++) {
            const u = u0 + ((u1 - u0) * k) / n;
            clubCyl(clubGroup, u, v, 0, 7, 0.45, M.gold);
            clubCyl(clubGroup, u, v, 0, 0.6, 1.4, M.gold);
            clubCyl(clubGroup, u, v, 7, 7.9, 0.8, M.gold);
            if (k < n) clubSlab(clubGroup, u, v - 0.4, u + (u1 - u0) / n, v + 0.4, 5.6, 6.4, M.velvet);
          }
        };
        ropeLine(318, 386, 28);
        ropeLine(320, 398, 39);
        ropeLine(318, 398, 16);
        for (let k = 0; k <= 2; k++) clubCyl(clubGroup, 398, 16 + k * 11.5, 0, 7, 0.45, M.gold);
        clubSlab(clubGroup, 397.6, 16, 398.4, 39, 5.6, 6.4, M.velvet);
        // Host podium with its lamp.
        clubSlab(clubGroup, 308, 20, 314, 24, 0, 8, M.black);
        clubSlab(clubGroup, 307.5, 19.5, 314.5, 24.5, 8, 8.6, M.bronze);
        kitLight(clubLights, scene, MX + 311, 10, MY + 22, '#ffd08a');
        // Kerb planters and bollards with glowing caps.
        for (let u = 12; u < 400; u += 26) {
          clubCyl(clubGroup, u, 12, 0, 5, 1.2, M.metal);
          clubCyl(clubGroup, u, 12, 5, 5.6, 1.25, LED.warm);
        }
        for (const [u, v] of MAREA.palms.slice(0, 3)) clubSlab(clubGroup, u - 8, v - 8, u + 8, v + 8, 0, 3, M.render);
        // The pylon sign on the corner and the neon over the door.
        clubSlab(clubGroup, 403, 26, 409, 34, 0, 70, M.black);
        const neonCanvas = (w, h, draw) => {
          const t = clubTexture(w, h, draw);
          t.colorSpace = Three.SRGBColorSpace;
          return t;
        };
        const signTexture = neonCanvas(512, 160, (g, w, h) => {
            g.clearRect(0, 0, w, h);
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.font = 'italic 700 104px Georgia, serif';
            g.shadowColor = '#ff3ab0';
            g.shadowBlur = 22;
            g.fillStyle = '#ffd6ef';
            g.fillText('Marea', w / 2, 66);
            g.shadowColor = '#34e4ff';
            g.shadowBlur = 14;
            g.font = '600 30px Arial';
            g.fillStyle = '#d8fbff';
            g.fillText('B E A C H   C L U B', w / 2, 136);
          }),
          pylonTexture = neonCanvas(64, 512, (g, w, h) => {
            g.fillStyle = '#101114';
            g.fillRect(0, 0, w, h);
            g.textAlign = 'center';
            g.font = '700 52px Arial';
            g.shadowColor = '#ff3ab0';
            g.shadowBlur = 16;
            g.fillStyle = '#ffe0f2';
            'MAREA'.split('').forEach((c, i) => g.fillText(c, w / 2, 70 + i * 86));
          });
        const signMaterial = new Three.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false, side: Three.DoubleSide, depthWrite: false }),
          pylonMaterial = new Three.MeshBasicMaterial({ map: pylonTexture, toneMapped: false });
        const sign = new Three.Mesh(new Three.PlaneGeometry(92, 29), signMaterial);
        // Tilted back over the door so it reads from the street camera (which looks north).
        sign.position.set(MX + 302, 42, MY + 50);
        sign.rotation.x = -0.95;
        sign.userData.sign = true;
        clubLive.add(sign);
        const pylonFace = new Three.Mesh(new Three.PlaneGeometry(5.4, 60), pylonMaterial);
        pylonFace.position.set(MX + 406, 36, MY + 34.1);
        pylonFace.userData.sign = true;
        clubLive.add(pylonFace);
        neonSigns.push({ sprite: halo(clubHalos, 302, 40, 44, 70, '#ff4fb8'), base: 0.55 });
        neonSigns.push({ sprite: halo(clubHalos, 406, 40, 36, 40, '#ff4fb8'), base: 0.5 });

        /* ---- staff block, restrooms, cashier ---- */
        function pavilionBlock(r, height, label) {
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 0, height, M.render);
          clubSlab(clubGroup, r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1, height, height + 1.4, M.teak);
          // Timber slats on the south face (the face the camera sees).
          for (let u = r[0] + 3; u < r[2] - 2; u += 3.2) clubSlab(clubGroup, u, r[3], u + 1.4, r[3] + 0.8, 1, height - 1, M.teak);
          if (label) {
            const t = neonCanvas(256, 64, (g, w, h) => {
              g.clearRect(0, 0, w, h);
              g.textAlign = 'center';
              g.textBaseline = 'middle';
              g.font = '700 40px Arial';
              g.shadowColor = label.glow;
              g.shadowBlur = 12;
              g.fillStyle = label.color;
              g.fillText(label.text, w / 2, h / 2 + 2);
            });
            const plate = new Three.Mesh(
              new Three.PlaneGeometry(label.w, label.w / 4),
              new Three.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }),
            );
            plate.position.set(MX + label.u, height - 4, MY + r[3] + 1.2);
            plate.userData.sign = true;
            clubLive.add(plate);
            neonSigns.push({ sprite: halo(clubHalos, label.u, height - 4, r[3] + 4, label.w * 0.9, label.glow), base: 0.4 });
          }
        }
        pavilionBlock(MAREA.staff, 16, { text: 'BAR', u: 49, w: 28, color: '#fff1d8', glow: '#ffa640' });
        pavilionBlock(MAREA.restrooms, 14, { text: 'VIP', u: 365, w: 26, color: '#fff4c8', glow: '#d4b24a' });
        clubSlab(clubGroup, MAREA.cashier[0], MAREA.cashier[1], MAREA.cashier[2], MAREA.cashier[3], 0, 12, M.darkWood);
        clubSlab(clubGroup, MAREA.cashier[0] - 1, MAREA.cashier[1] - 1, MAREA.cashier[2] + 1, MAREA.cashier[3] + 1, 12, 13, M.bronze);
        // Rooftop plant on the staff block.
        for (const u of [24, 44]) clubSlab(clubGroup, u, 62, u + 12, 74, 17.4, 22, M.metal);

        /* ---- stage, LED wall, speakers, DJ desk ---- */
        const b = MAREA.booth;
        clubSlab(clubGroup, b[0], b[1], b[2], b[3], 0, 9, M.stage);
        clubSlab(clubGroup, b[0], b[3] - 0.6, b[2], b[3] + 0.2, 7.6, 8.4, LED.magenta);
        clubSlab(clubGroup, b[0], b[3] - 0.6, b[2], b[3] + 0.2, 0.6, 1.2, LED.cyan);
        for (let k = 0; k < 4; k++) clubSlab(clubGroup, b[0] - 8, 82 + k * 2.5 - 8, b[0], 84 + k * 2.5 - 8, 0, 2.2 * (k + 1), M.stage);
        clubSlab(clubGroup, 184, 77, 216, 82, 9, 15, M.black);
        clubSlab(clubGroup, 184.5, 81.6, 215.5, 82.4, 10, 14, LED.white);
        for (const u of [188, 199, 210]) clubCyl(clubGroup, u, 79, 15, 15.4, 2.4, M.cone, 16);
        const S = MAREA.screen;
        clubSlab(clubGroup, S[0] - 2, S[1], S[2] + 2, S[3], 0, 42, M.black);
        const screenCanvas = document.createElement('canvas');
        screenCanvas.width = 256;
        screenCanvas.height = 96;
        const screenTexture = new Three.CanvasTexture(screenCanvas);
        screenTexture.colorSpace = Three.SRGBColorSpace;
        const screenMaterial = new Three.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
        const screen = new Three.Mesh(new Three.PlaneGeometry(S[2] - S[0] - 4, 34), screenMaterial);
        screen.position.set(MX + (S[0] + S[2]) / 2, 22, MY + S[3] + 0.2);
        screen.userData.sign = true;
        clubLive.add(screen);
        for (const r of MAREA.speakers) {
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 0, 26, M.speaker);
          for (const [h, rad] of [
            [6, 6],
            [15, 4.5],
            [22, 2.4],
          ]) {
            const c = mesh(new Three.CylinderGeometry(rad, rad, 0.8, 18), M.cone, clubGroup, MX + (r[0] + r[2]) / 2, h, MY + r[3] + 0.3);
            c.rotation.x = Math.PI / 2;
          }
        }
        // The big white sail behind and over the booth, rising towards the back.
        const sailMaterial = new Three.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.9, side: Three.DoubleSide, transparent: true, opacity: 1 });
        function sail(corners, sag = 3) {
          const n = 10,
            pos = [],
            idx = [];
          for (let j = 0; j <= n; j++)
            for (let i = 0; i <= n; i++) {
              const s = i / n,
                t = j / n,
                lerp = (k) => corners[0][k] * (1 - s) * (1 - t) + corners[1][k] * s * (1 - t) + corners[2][k] * s * t + corners[3][k] * (1 - s) * t;
              pos.push(MX + lerp(0), lerp(1) - sag * Math.sin(Math.PI * s) * Math.sin(Math.PI * t), MY + lerp(2));
            }
          for (let j = 0; j < n; j++)
            for (let i = 0; i < n; i++) {
              const a = j * (n + 1) + i;
              idx.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1);
            }
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.Float32BufferAttribute(pos, 3));
          geo.setIndex(idx);
          geo.computeVertexNormals();
          const m = new Three.Mesh(geo, sailMaterial);
          m.castShadow = true;
          m.receiveShadow = true;
          clubLive.add(m);
          // Masts and ties at the corners.
          for (const [u, y, v] of corners) {
            clubCyl(clubGroup, u, v, 0, y + 3, 0.9, M.teak);
            clubCyl(clubGroup, u, v, y + 3, y + 4, 1.1, M.metal);
          }
          return m;
        }
        sail([
          [140, 64, 44],
          [260, 64, 44],
          [250, 40, 88],
          [150, 40, 88],
        ]);
        // The pavilion over the main bar: two hypar sails.
        sail([
          [0, 42, 94],
          [112, 30, 94],
          [112, 44, 146],
          [0, 30, 146],
        ]);
        sail([
          [0, 30, 146],
          [112, 44, 146],
          [112, 30, 200],
          [0, 42, 200],
        ]);
        // VIP sail.
        sail([
          [322, 36, 100],
          [398, 44, 100],
          [398, 30, 190],
          [322, 42, 190],
        ]);

        /* ---- dance floor and truss ---- */
        const F = MAREA.floor;
        clubPlane(F[0], F[1], F[2], F[3], 0.42, M.stage);
        const tileCols = 17,
          tileRows = 9,
          tileW = (F[2] - F[0]) / tileCols,
          tileH = (F[3] - F[1]) / tileRows,
          tileMaterial = new Three.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: Three.AdditiveBlending, depthWrite: false }),
          tiles = new Three.InstancedMesh(new Three.BoxGeometry(1, 0.1, 1), tileMaterial, tileCols * tileRows);
        tiles.name = 'Marea LED floor';
        tiles.frustumCulled = false;
        tiles.renderOrder = 2;
        const tm = new Three.Matrix4();
        for (let j = 0; j < tileRows; j++)
          for (let i = 0; i < tileCols; i++) {
            tm.makeScale(tileW - 0.7, 1, tileH - 0.7);
            tm.setPosition(MX + F[0] + (i + 0.5) * tileW, 0.55, MY + F[1] + (j + 0.5) * tileH);
            tiles.setMatrixAt(j * tileCols + i, tm);
            tiles.setColorAt(j * tileCols + i, new Three.Color(0, 0, 0));
          }
        clubLive.add(tiles);
        // Marble grid lines between tiles by day.
        for (let i = 0; i <= tileCols; i++) clubSlab(clubGroup, F[0] + i * tileW - 0.3, F[1], F[0] + i * tileW + 0.3, F[3], 0.42, 0.5, M.gold);
        for (let j = 0; j <= tileRows; j++) clubSlab(clubGroup, F[0], F[1] + j * tileH - 0.3, F[2], F[1] + j * tileH + 0.3, 0.42, 0.5, M.gold);
        const TRUSS_H = 50;
        for (const [u, v] of MAREA.truss) clubSlab(clubGroup, u - 1.5, v - 1.5, u + 1.5, v + 1.5, 0, TRUSS_H, M.metal);
        const [t0, t1, t2, t3] = MAREA.truss;
        for (const [a, c] of [
          [t0, t1],
          [t2, t3],
        ]) {
          clubSlab(clubGroup, a[0], a[1] - 1.5, c[0], a[1] + 1.5, TRUSS_H - 1, TRUSS_H + 1, M.metal);
          clubSlab(clubGroup, a[0], a[1] - 1.5, c[0], a[1] + 1.5, TRUSS_H - 4, TRUSS_H - 3, M.metal);
        }
        for (const u of [t0[0], (t0[0] + t1[0]) / 2, t1[0]]) clubSlab(clubGroup, u - 1.5, t0[1], u + 1.5, t2[1], TRUSS_H - 1, TRUSS_H + 1, M.metal);
        // Moving heads: four on each long beam.
        const heads = [];
        for (const v of [t0[1], t2[1]])
          for (let k = 0; k < 4; k++) {
            const u = 140 + k * 44;
            clubSlab(clubGroup, u - 2, v - 2, u + 2, v + 2, TRUSS_H - 7, TRUSS_H - 3, M.black);
            heads.push({ u, v, y: TRUSS_H - 7 });
          }
        const beamGeo = new Three.ConeGeometry(1, 1, 18, 1, true);
        beamGeo.translate(0, -0.5, 0);
        const beamTexture = clubTexture(8, 64, (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(1, 'rgba(255,255,255,0.15)');
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
        });
        const beamMaterial = new Three.MeshBasicMaterial({
            map: beamTexture,
            toneMapped: false,
            transparent: true,
            opacity: 0.22,
            blending: Three.AdditiveBlending,
            depthWrite: false,
            side: Three.DoubleSide,
          }),
          beams = new Three.InstancedMesh(beamGeo, beamMaterial, heads.length + 2);
        beams.name = 'Marea moving-head beams';
        beams.frustumCulled = false;
        beams.renderOrder = 7;
        clubLive.add(beams);
        const spotTexture = clubTexture(64, 64, (g, w, h) => {
          const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
          r.addColorStop(0, 'rgba(255,255,255,1)');
          r.addColorStop(0.5, 'rgba(255,255,255,0.45)');
          r.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = r;
          g.fillRect(0, 0, w, h);
        });
        const spotGeo = new Three.PlaneGeometry(1, 1);
        spotGeo.rotateX(-Math.PI / 2);
        const spots = new Three.InstancedMesh(
          spotGeo,
          new Three.MeshBasicMaterial({ map: spotTexture, toneMapped: false, transparent: true, blending: Three.AdditiveBlending, depthWrite: false }),
          heads.length,
        );
        spots.frustumCulled = false;
        spots.renderOrder = 3;
        clubLive.add(spots);
        const laserGeo = new Three.BoxGeometry(1, 1, 1);
        laserGeo.translate(0.5, 0, 0);
        const LASERS = 12,
          lasers = new Three.InstancedMesh(
            laserGeo,
            new Three.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85, blending: Three.AdditiveBlending, depthWrite: false }),
            LASERS,
          );
        lasers.frustumCulled = false;
        lasers.renderOrder = 8;
        clubLive.add(lasers);
        const strobe = new Three.Mesh(
          new Three.PlaneGeometry(F[2] - F[0] + 40, F[3] - F[1] + 30),
          new Three.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0, blending: Three.AdditiveBlending, depthWrite: false }),
        );
        strobe.rotation.x = -Math.PI / 2;
        strobe.position.set(MX + (F[0] + F[2]) / 2, 20, MY + (F[1] + F[3]) / 2);
        strobe.renderOrder = 9;
        clubLive.add(strobe);

        /* ---- bars ---- */
        const bar = MAREA.bar,
          back = MAREA.backBar;
        clubSlab(clubGroup, bar[0], bar[1], bar[2], bar[3], 0, 9, M.darkWood);
        clubSlab(clubGroup, bar[0] - 1, bar[1] - 1, bar[2] + 1.5, bar[3] + 1, 9, 10, M.coping);
        clubSlab(clubGroup, bar[2] + 1, bar[1], bar[2] + 1.6, bar[3], 1, 2, LED.amber);
        clubSlab(clubGroup, back[0], back[1], back[2], back[3], 0, 18, M.darkWood);
        for (let v = back[1] + 3; v < back[3] - 2; v += 3.4)
          for (const y of [10, 14]) clubCyl(clubGroup, back[2] - 3 - ((v * 7) % 4), v, y, y + 3.4, 0.55, M.bottle);
        clubSlab(clubGroup, back[0], back[1], back[2], back[3], 18, 19, M.bronze);
        for (const [u, v] of MAREA.highTables) {
          clubCyl(clubGroup, u, v, 0, 8, 0.5, M.metal);
          clubCyl(clubGroup, u, v, 8, 8.6, 4, M.coping, 16);
        }
        // Pool bar: a stone counter, a thatched parasol roof, stools.
        const pb = MAREA.poolBar;
        clubSlab(clubGroup, pb[0], pb[1], pb[2], pb[3], 0, 9, M.stone);
        clubSlab(clubGroup, pb[0] - 1, pb[1] - 1, pb[2] + 1, pb[3] + 1, 9, 10, M.teak);
        clubSlab(clubGroup, pb[0], pb[3] + 0.2, pb[2], pb[3] + 0.8, 1, 2, LED.cyan);
        for (let u = 350; u <= 386; u += 9) {
          clubCyl(clubGroup, u, 226, 0, 6.4, 0.4, M.metal);
          clubCyl(clubGroup, u, 226, 6.4, 7, 2, M.teak, 12);
        }
        for (const [u, v] of [
          [pb[0], pb[1]],
          [pb[2], pb[1]],
        ])
          clubCyl(clubGroup, u, v, 0, 22, 0.8, M.teak);
        const thatch = mesh(new Three.ConeGeometry(30, 10, 6, 1), M.thatch, clubGroup, MX + (pb[0] + pb[2]) / 2, 26, MY + pb[1] + 4, 1, 1, 0.55);
        thatch.rotation.y = Math.PI / 6;

        /* ---- VIP terrace ---- */
        const vip = MAREA.vip;
        clubSlab(clubGroup, vip[0], vip[1], vip[2], vip[3], 0, 1.4, M.darkWood);
        for (const r of MAREA.vipSofas) {
          const alongV = r[3] - r[1] > r[2] - r[0];
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 1.4, 5, M.cushion);
          if (alongV) clubSlab(clubGroup, r[2] - 3.5, r[1], r[2], r[3], 5, 10, M.cushion);
          else clubSlab(clubGroup, r[0], r[1], r[2], r[1] + 3.5, 5, 10, M.cushion);
          for (let k = alongV ? r[1] + 6 : r[0] + 6; k < (alongV ? r[3] : r[2]) - 3; k += 13)
            if (alongV) clubSlab(clubGroup, r[2] - 6, k, r[2] - 3.5, k + 5, 5, 8.5, M.teal);
            else clubSlab(clubGroup, k, r[1] + 3.5, k + 5, r[1] + 6, 5, 8.5, M.teal);
        }
        for (const [u, v] of MAREA.vipTables) {
          clubCyl(clubGroup, u, v, 1.4, 5.2, 5, M.black, 16);
          clubCyl(clubGroup, u, v, 5.2, 8, 1.6, M.chrome, 12);
          clubCyl(clubGroup, u + 0.5, v, 7, 10.5, 0.45, M.bottle);
          kitLight(clubLights, scene, MX + u, 6.5, MY + v, '#ffd08a');
        }
        // Gold rope posts round the terrace (the gate gap is left open).
        const vipRope = (u0, v0, u1, v1) => {
          const n = Math.max(1, Math.round(Math.hypot(u1 - u0, v1 - v0) / 10));
          for (let k = 0; k <= n; k++) {
            const u = u0 + ((u1 - u0) * k) / n,
              v = v0 + ((v1 - v0) * k) / n;
            clubCyl(clubGroup, u, v, 1.4, 8, 0.45, M.gold);
            clubCyl(clubGroup, u, v, 8, 8.8, 0.8, M.gold);
            if (k < n) {
              const u2 = u0 + ((u1 - u0) * (k + 1)) / n,
                v2 = v0 + ((v1 - v0) * (k + 1)) / n;
              clubSlab(clubGroup, Math.min(u, u2) - 0.4, Math.min(v, v2) - 0.4, Math.max(u, u2) + 0.4, Math.max(v, v2) + 0.4, 6.4, 7.2, M.velvet);
            }
          }
        };
        vipRope(vip[0], vip[1], vip[0], MAREA.vipGate[1]);
        vipRope(vip[0], MAREA.vipGate[3], vip[0], vip[3]);
        vipRope(vip[0], vip[3], vip[2], vip[3]);
        // The VIP gate rope: drawn across the gap while the player has no band.
        const vipGateRope = clubSlab(clubLive, vip[0] - 0.4, MAREA.vipGate[1], vip[0] + 0.4, MAREA.vipGate[3], 6.4, 7.2, M.velvet);

        /* ---- daybeds, cabanas, sunbeds ---- */
        function daybed(r, height = 4.2) {
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 0, height - 1.6, M.teak);
          clubSlab(clubGroup, r[0] + 0.5, r[1] + 0.5, r[2] - 0.5, r[3] - 0.5, height - 1.6, height, M.cushion);
          clubSlab(clubGroup, r[0] + 1, r[1] + 1, r[0] + 5, r[3] - 1, height, height + 1.6, M.teal);
        }
        for (const r of MAREA.daybeds) daybed(r);
        for (const r of MAREA.southDaybeds) daybed(r);
        for (const r of MAREA.cabanas) {
          clubSlab(clubGroup, r[0], r[1], r[2], r[3], 0, 0.8, M.deck);
          daybed([r[0] + 6, r[1] + 3, r[2] - 4, r[1] + 13]);
          clubCyl(clubGroup, r[2] - 4, r[1] + 19, 0, 2.6, 3, M.teal, 12);
          for (const [u, v] of [
            [r[0] + 1, r[1] + 1],
            [r[2] - 1, r[1] + 1],
            [r[0] + 1, r[3] - 1],
            [r[2] - 1, r[3] - 1],
          ])
            clubCyl(clubGroup, u, v, 0, 20, 0.6, M.teak);
          // Curtains on the back and a canvas roof that fades with the sails.
          clubSlab(clubGroup, r[0] + 0.5, r[1] + 1, r[0] + 1.2, r[3] - 1, 1, 19, M.cushion);
          clubSlab(clubLive, r[0], r[1], r[2], r[3], 20, 20.8, sailMaterial);
        }
        const parasolRibs = new Three.ConeGeometry(13, 5, 10, 1);
        for (const s of MAREA.sunbeds) {
          clubSlab(clubGroup, s.u, s.v - 4, s.u + 20, s.v + 4, 0, 1.6, M.teak);
          clubSlab(clubGroup, s.u + 0.5, s.v - 3.5, s.u + 19.5, s.v + 3.5, 1.6, 2.6, M.cushion);
          clubSlab(clubGroup, s.u + 0.5, s.v - 3.5, s.u + 4, s.v + 3.5, 2.6, 3.6, M.cushion);
          clubCyl(clubGroup, s.u + 10, s.v - 9, 0, 16, 0.45, M.teak);
          mesh(parasolRibs, M.thatch, clubGroup, MX + s.u + 10, 18, MY + s.v - 9);
        }

        /* ---- the pool ---- */
        const P = MAREA.pool,
          W = MAREA.poolWater;
        clubSlab(clubGroup, P[0], P[1], P[2], W[1], 0, 1.6, M.coping);
        clubSlab(clubGroup, P[0], W[1], W[0], W[3], 0, 1.6, M.coping);
        clubSlab(clubGroup, W[2], W[1], P[2], W[3], 0, 1.6, M.coping);
        // The infinity edge: the south lip sits flush with the water, a dark slot below.
        clubSlab(clubGroup, P[0], W[3], P[2], P[3], 0, 1.05, M.coping);
        clubSlab(clubGroup, W[0], W[3] + 0.5, W[2], W[3] + 2.5, 0.9, 1.1, M.stage);
        const poolFloorMaterial = new Three.MeshStandardMaterial({ map: mosaicTexture, emissiveMap: mosaicTexture, emissive: '#39d8ff', emissiveIntensity: 0, roughness: 0.4 });
        const poolFloor = clubPlane(W[0], W[1], W[2], W[3], 0.45, poolFloorMaterial, 42);
        poolFloor.parent.remove(poolFloor);
        clubLive.add(poolFloor);
        const rippleTexture = clubTexture(128, 128, (g, w, h) => {
          const img = g.createImageData(w, h);
          const f = (x, y) => Math.sin((x / w) * TAU * 3 + Math.sin((y / h) * TAU * 2) * 1.5) + Math.sin((y / h) * TAU * 4 + Math.cos((x / w) * TAU * 2) * 1.2);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const dx = f(x + 1, y) - f(x - 1, y),
                dy = f(x, y + 1) - f(x, y - 1),
                i = (y * w + x) * 4;
              img.data[i] = 128 + dx * 40;
              img.data[i + 1] = 128 + dy * 40;
              img.data[i + 2] = 255;
              img.data[i + 3] = 255;
            }
          g.putImageData(img, 0, 0);
        });
        rippleTexture.colorSpace = Three.NoColorSpace;
        rippleTexture.wrapS = rippleTexture.wrapT = Three.RepeatWrapping;
        rippleTexture.repeat.set(5, 1);
        const waterMaterial = new Three.MeshStandardMaterial({
          color: '#5fd6e2',
          roughness: 0.06,
          metalness: 0.1,
          transparent: true,
          opacity: 0.5,
          normalMap: rippleTexture,
          normalScale: new Three.Vector2(0.35, 0.35),
          emissive: '#1fb8d8',
          emissiveIntensity: 0,
          depthWrite: false,
        });
        const water = clubPlane(W[0], W[1], W[2], W[3], 1.0, waterMaterial);
        water.parent.remove(water);
        water.receiveShadow = false;
        water.renderOrder = 4;
        clubLive.add(water);
        for (let u = W[0] + 20; u < W[2] - 10; u += 40)
          for (const v of [W[1] + 1.5, W[3] - 1.5]) kitLight(clubLights, scene, MX + u, 0.9, MY + v, '#7ff4ff');

        /* ---- the sunken fire lounge ---- */
        const L = MAREA.lounge;
        const loungeFloor = mesh(new Three.CylinderGeometry(L.r, L.r, 0.4, 36), M.stage, clubGroup, MX + L.u, 0.3, MY + L.v);
        loungeFloor.castShadow = false;
        mesh(new Three.CylinderGeometry(L.r + 1.5, L.r + 1.5, 1.6, 36, 1, true), M.coping, clubGroup, MX + L.u, 0.8, MY + L.v);
        const seat = new Three.RingGeometry(L.r - 9, L.r - 1, 36);
        seat.rotateX(-Math.PI / 2);
        mesh(seat, M.cushion, clubGroup, MX + L.u, 2.3, MY + L.v);
        mesh(new Three.CylinderGeometry(L.r - 1, L.r - 1, 6, 36, 1, true), M.teal, clubGroup, MX + L.u, 3, MY + L.v);
        clubCyl(clubGroup, L.u, L.v, 0, 2.4, 5, M.render, 18);
        // Flames: the fire pit and the tiki torches round the deck.
        const torches = [
          [L.u, L.v, 2.4, 1.6],
          [60, 206, 8, 1],
          [320, 206, 8, 1],
          [60, 282, 8, 1],
          [180, 292, 8, 1],
          [260, 292, 8, 1],
          [330, 282, 8, 1],
          [150, 346, 8, 1],
          [290, 346, 8, 1],
        ];
        for (const [u, v, h, big] of torches) {
          if (big === 1) {
            clubCyl(clubGroup, u, v, 0, h, 0.5, M.teak);
            clubCyl(clubGroup, u, v, h - 1, h + 0.4, 0.9, M.metal);
          }
          kitLight(clubLights, scene, MX + u, h + 3, MY + v, '#ff9a3a');
        }
        const flameGeo = new Three.ConeGeometry(1, 1, 7, 1);
        flameGeo.translate(0, 0.5, 0);
        const flames = new Three.InstancedMesh(
          flameGeo,
          new Three.MeshBasicMaterial({ color: '#ffa640', toneMapped: false, transparent: true, opacity: 0.9, blending: Three.AdditiveBlending, depthWrite: false }),
          torches.length * 2,
        );
        flames.frustumCulled = false;
        clubLive.add(flames);

        /* ---- palms, uplights and string lights ---- */
        for (const [u, v] of MAREA.palms) {
          makePalm(MX + u, MY + v, 0.95 + ((u * 13 + v * 7) % 10) / 40);
          kitLight(clubLights, scene, MX + u + 2, 1.5, MY + v + 3, v > 40 ? '#ff6ad0' : '#ffd08a');
        }
        // Festoons: warm bulbs on catenaries across the deck.
        const festoon = (a, c, n, droop) => {
          for (let k = 1; k < n; k++) {
            const s = k / n,
              y = a[2] + (c[2] - a[2]) * s - droop * Math.sin(Math.PI * s);
            kitLight(clubLights, scene, MX + a[0] + (c[0] - a[0]) * s, y, MY + a[1] + (c[1] - a[1]) * s, '#ffd28a');
          }
        };
        festoon([20, 204, 26], [340, 194, 26], 26, 5);
        festoon([50, 292, 22], [330, 292, 22], 22, 4);
        festoon([20, 204, 26], [50, 292, 22], 8, 3);
        festoon([340, 194, 26], [392, 290, 22], 9, 3);
        for (let u = 132; u < 290; u += 26) kitLight(clubLights, scene, MX + u, 10, MY + 94, '#ff4fb8');
        neonSigns.push({ sprite: halo(clubHalos, 188, 12, 244, 150, '#40e0ff'), base: 0.35 });
        neonSigns.push({ sprite: halo(clubHalos, 206, 12, 140, 150, '#b84fff'), base: 0.3 });
        neonSigns.push({ sprite: halo(clubHalos, 60, 10, 150, 80, '#ffb45a'), base: 0.35 });
        kitLightCloud(clubLights, 7);

        /**
         * THE SHOW
         */
        const PALETTE = ['#ff2fa8', '#27e3ff', '#9b4dff', '#ffb43a', '#30ff9a', '#ff4a3a'].map((c) => new Three.Color(c));
        const WHITE = new Three.Color('#ffffff'),
          scratchColor = new Three.Color(),
          clubMatrix = new Three.Matrix4(),
          clubQuat = new Three.Quaternion(),
          clubDown = new Three.Vector3(0, -1, 0),
          clubX = new Three.Vector3(1, 0, 0),
          clubDir = new Three.Vector3(),
          clubPos = new Three.Vector3(),
          clubScale = new Three.Vector3(),
          clubZero = new Three.Matrix4().makeScale(0, 0, 0);
        let clubLastTime = 0,
          screenClock = 0,
          clubWasShowing = true,
          sailFade = 1;
        const hashN = (n) => {
          const x = Math.sin(n * 91.7 + 13.3) * 43758.5453;
          return x - Math.floor(x);
        };
        function drawScreen(showing, g) {
          const c = screenCanvas.getContext('2d'),
            w = screenCanvas.width,
            h = screenCanvas.height;
          if (!showing) {
            // Day: the sea, slow waves and the logo.
            const grad = c.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#7fd3e8');
            grad.addColorStop(0.55, '#2f9fc4');
            grad.addColorStop(1, '#0f4f7a');
            c.fillStyle = grad;
            c.fillRect(0, 0, w, h);
            c.strokeStyle = 'rgba(255,255,255,0.35)';
            c.lineWidth = 2;
            for (let k = 0; k < 4; k++) {
              c.beginPath();
              for (let x = 0; x <= w; x += 8) c.lineTo(x, 50 + k * 12 + Math.sin(x / 20 + gameTime * 0.8 + k) * 3);
              c.stroke();
            }
            c.fillStyle = '#ffffff';
            c.font = 'italic 700 34px Georgia, serif';
            c.textAlign = 'center';
            c.fillText('Marea', w / 2, 38);
            return;
          }
          const col = PALETTE[Math.floor(g.bar / 2) % PALETTE.length],
            col2 = PALETTE[(Math.floor(g.bar / 2) + 2) % PALETTE.length];
          c.fillStyle = '#05040a';
          c.fillRect(0, 0, w, h);
          const on = Math.max(0, Math.cos(g.beat * TAU)),
            bars = 24;
          for (let i = 0; i < bars; i++) {
            const level = (0.25 + 0.75 * hashN(i * 7 + Math.floor(g.beat * 4))) * (0.35 + on * 0.65) * (0.3 + g.energy * 0.7),
              bh = level * (h - 10);
            const grad = c.createLinearGradient(0, h, 0, h - bh);
            grad.addColorStop(0, '#' + col.getHexString());
            grad.addColorStop(1, '#' + col2.getHexString());
            c.fillStyle = grad;
            c.fillRect(4 + i * (w - 8) / bars, h - bh, (w - 8) / bars - 3, bh);
          }
          c.globalAlpha = 0.85;
          c.fillStyle = '#ffffff';
          c.font = 'italic 700 30px Georgia, serif';
          c.textAlign = 'center';
          c.fillText(g.section === 'break' ? 'M A R E A' : 'Marea', w / 2, 34 + on * 3);
          c.globalAlpha = 1;
        }
        /* Per frame, from updateBeachVisuals (beach3d.js). */
        function updateBeachClubVisuals() {
          const dt = clamp(gameTime - clubLastTime, 0, 0.1);
          clubLastTime = gameTime;
          const near = Math.abs(viewCenter.x - (MX + 200)) < viewReach + 450 && Math.abs(viewCenter.y - (MY + 150)) < viewReach + 450;
          clubLive.visible = near;
          if (!near) return;
          const night = nightAmount,
            g = mareaGroove,
            spooked = gameTime < marea.spookedUntil,
            show = !spooked && g.set === 'night' && night > 0.2,
            dusk = !spooked && g.set === 'sunset' && night > 0.1,
            e = g.energy,
            ph = g.beat * TAU,
            on = Math.max(0, Math.cos(ph)),
            bar = g.bar,
            section = g.section,
            drop = section === 'drop',
            sinceDrop = gameTime - g.dropAt;
          // LEDs follow the night; the booth strips pulse on the beat.
          for (const l of clubLeds) l.m.color.copy(l.color).multiplyScalar(l.day + (1 - l.day) * night * (spooked ? 0.6 : 1));
          if (show) LED.magenta.color.copy(PALETTE[Math.floor(bar / 4) % PALETTE.length]).multiplyScalar(0.35 + on * 0.65);
          signMaterial.opacity = 0.45 + night * 0.55;
          pylonMaterial.color.setScalar(0.35 + night * 0.65);
          screenMaterial.color.setScalar(show ? 1 : 0.45 + 0.5 * (1 - night));
          M.bottle.emissiveIntensity = night * 0.8;
          // Pool: gently moving ripples, glowing at night.
          rippleTexture.offset.set(gameTime * 0.012, gameTime * 0.007);
          poolFloorMaterial.emissiveIntensity = night * (0.55 + Math.sin(gameTime * 1.3) * 0.05);
          waterMaterial.emissiveIntensity = night * 0.35;
          // Sails fade while the player is inside so nobody under them is hidden.
          const inside = mareaInside(player.x, player.y) && !isAircraft(player.car);
          sailFade += ((inside ? 0.22 : 1) - sailFade) * Math.min(1, dt * 4);
          sailMaterial.opacity = sailFade;
          sailMaterial.depthWrite = sailFade > 0.9;
          vipGateRope.visible = !marea.vip;
          // Flames flicker.
          torches.forEach(([u, v, h, big], i) => {
            for (let k = 0; k < 2; k++) {
              const f = 0.75 + 0.25 * Math.sin(gameTime * (11 + k * 5) + i * 1.7 + k),
                lit = night > 0.08 || big > 1;
              if (!lit) {
                flames.setMatrixAt(i * 2 + k, clubZero);
                continue;
              }
              clubScale.set(big * (1.3 - k * 0.5), big * (4.2 - k * 1.6) * f, big * (1.3 - k * 0.5));
              clubPos.set(MX + u + Math.sin(gameTime * 7 + i) * 0.2, h, MY + v);
              clubQuat.identity();
              flames.setMatrixAt(i * 2 + k, clubMatrix.compose(clubPos, clubQuat, clubScale));
            }
          });
          flames.instanceMatrix.needsUpdate = true;
          // The LED wall redraws about ten times a second.
          screenClock -= dt;
          if (screenClock <= 0) {
            screenClock = 0.1;
            drawScreen(show || dusk, g);
            screenTexture.needsUpdate = true;
          }
          const showing = show || dusk;
          tiles.visible = spots.visible = beams.visible = showing;
          lasers.visible = show && section !== 'break';
          strobe.visible = show;
          if (!showing) {
            if (clubWasShowing) strobe.material.opacity = 0;
            clubWasShowing = false;
            return;
          }
          clubWasShowing = true;
          // LED floor: a pattern per bar, palette per two bars.
          const pattern = section === 'break' ? 4 : dusk ? 5 : bar % 4,
            colA = PALETTE[Math.floor(bar / 2) % PALETTE.length],
            colB = PALETTE[(Math.floor(bar / 2) + 3) % PALETTE.length],
            level = dusk ? 0.35 : 0.3 + e * 0.7;
          for (let j = 0; j < tileRows; j++)
            for (let i = 0; i < tileCols; i++) {
              const cx = (i - (tileCols - 1) / 2) / tileCols,
                cy = j / tileRows,
                beatFrac = g.beat % 1;
              let k = 0,
                useB = false;
              if (pattern === 0) {
                const r = Math.hypot(cx * 1.8, cy);
                k = Math.max(0, 1 - Math.abs(r - beatFrac * 1.4) * 5);
              } else if (pattern === 1) {
                k = (i + j + Math.floor(g.beat)) % 2 ? 0.9 : 0.12;
                useB = (i + j) % 2 === 0;
              } else if (pattern === 2) {
                k = 0.5 + 0.5 * Math.sin(i * 0.8 - g.beat * Math.PI);
                useB = j % 2 === 1;
              } else if (pattern === 3) k = hashN(i * 31 + j * 17 + Math.floor(g.beat * 4)) > 0.6 ? 1 : 0.06;
              else if (pattern === 4) k = 0.25 + 0.2 * Math.sin(gameTime * 1.5 + i * 0.4 + j * 0.3);
              else k = 0.3 + 0.25 * Math.sin(gameTime * 0.9 + i * 0.35 - j * 0.2);
              if (drop && sinceDrop < 0.4) k = 1;
              scratchColor.copy(useB ? colB : colA).multiplyScalar(k * level * night);
              tiles.setColorAt(j * tileCols + i, scratchColor);
            }
          tiles.instanceColor.needsUpdate = true;
          // Moving heads and their floor spots.
          const speed = section === 'build' ? 2 : drop ? 1 : 0.5;
          heads.forEach((hd, i) => {
            const sweep = g.beat * speed * Math.PI * 0.25 + i * 0.9,
              pointUp = section === 'break',
              tu = pointUp ? hd.u + Math.sin(sweep) * 30 : 206 + Math.sin(sweep) * 70,
              tv = pointUp ? hd.v + (hd.v < 140 ? -40 : 40) : 140 + Math.cos(sweep * 0.7 + i) * 36,
              ty = pointUp ? 140 : 0.6;
            clubPos.set(MX + hd.u, hd.y, MY + hd.v);
            clubDir.set(MX + tu - clubPos.x, ty - hd.y, MY + tv - clubPos.z);
            const len = clubDir.length();
            clubDir.normalize();
            clubQuat.setFromUnitVectors(clubDown, clubDir);
            const width = pointUp ? 5 : drop ? 9 : 7;
            clubScale.set(width, len, width);
            beams.setMatrixAt(i, clubMatrix.compose(clubPos, clubQuat, clubScale));
            const strobeOff = (drop || section === 'build') && hashN(i + Math.floor(g.beat * 4) * 13) < 0.25;
            scratchColor.copy(PALETTE[(i + Math.floor(bar / 2)) % PALETTE.length]).multiplyScalar(strobeOff ? 0 : dusk ? 0.35 : 0.5 + e * 0.5);
            beams.setColorAt(i, scratchColor);
            if (pointUp) spots.setMatrixAt(i, clubZero);
            else {
              clubQuat.identity();
              clubPos.set(MX + tu, 0.7, MY + tv);
              clubScale.set(width * 2.6, 1, width * 2.6);
              spots.setMatrixAt(i, clubMatrix.compose(clubPos, clubQuat, clubScale));
            }
            spots.setColorAt(i, scratchColor);
          });
          // Two searchlights sweep the sky from the corners at night.
          [
            [30, 60],
            [370, 60],
          ].forEach(([u, v], k) => {
            const i = heads.length + k,
              a = gameTime * 0.35 + k * Math.PI;
            if (!show) {
              beams.setMatrixAt(i, clubZero);
              return;
            }
            clubPos.set(MX + u, 17, MY + v);
            clubDir.set(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35 - 0.15).normalize();
            clubQuat.setFromUnitVectors(clubDown, clubDir);
            clubScale.set(22, 520, 22);
            beams.setMatrixAt(i, clubMatrix.compose(clubPos, clubQuat, clubScale));
            beams.setColorAt(i, scratchColor.set('#b8d8ff').multiplyScalar(0.45));
          });
          beams.instanceMatrix.needsUpdate = true;
          beams.instanceColor.needsUpdate = true;
          spots.instanceMatrix.needsUpdate = true;
          spots.instanceColor.needsUpdate = true;
          beamMaterial.opacity = dusk ? 0.1 : 0.14 + e * 0.12;
          // Lasers fan out from the booth over the floor.
          if (lasers.visible) {
            const fan = drop ? 1.1 : 0.7,
              laserCol = PALETTE[drop ? 4 : 1],
              blink = drop ? (Math.floor(g.beat * 2) % 2 ? 1 : 0.4) : 1;
            for (let i = 0; i < LASERS; i++) {
              const s = i / (LASERS - 1) - 0.5,
                a = Math.PI / 2 + s * fan * 2 + Math.sin(g.beat * Math.PI * 0.5) * 0.35,
                tilt = -0.1 - 0.04 * Math.sin(g.beat * Math.PI + i);
              clubPos.set(MX + 200, 16, MY + 84);
              clubDir.set(Math.cos(a), tilt, Math.sin(a)).normalize();
              clubQuat.setFromUnitVectors(clubX, clubDir);
              clubScale.set(170, 0.35, 0.35);
              lasers.setMatrixAt(i, clubMatrix.compose(clubPos, clubQuat, clubScale));
              lasers.setColorAt(i, scratchColor.copy(i % 3 === 0 ? WHITE : laserCol).multiplyScalar(blink));
            }
            lasers.instanceMatrix.needsUpdate = true;
            lasers.instanceColor.needsUpdate = true;
          }
          // Strobe: the last bar of the build and the first moments of the drop.
          const barInCycle = bar % 32,
            sixteenth = Math.floor(g.beat * 4),
            strobeOn = (section === 'build' && barInCycle === 27 && sixteenth % 2 === 0) || (drop && sinceDrop < 1.2 && sixteenth % 2 === 0);
          strobe.material.opacity = strobeOn ? 0.22 * night : 0;
        }
        return updateBeachClubVisuals;
      }
      // END SUBSYSTEM: src/beachclub3d.js
