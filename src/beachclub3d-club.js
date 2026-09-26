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
        // Polished marble by day, black glass under the LEDs at night.
        const floorMaterial = mat('#ece6da', 0.3),
          floorDay = new Three.Color('#ece6da'),
          floorNight = new Three.Color('#101014');
        clubPlane(F[0], F[1], F[2], F[3], 0.42, floorMaterial);
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
            new Three.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.55, blending: Three.AdditiveBlending, depthWrite: false }),
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
        // Colour buffers exist from the start, so the first night needs no new shader.
        const black = new Three.Color(0, 0, 0);
        for (const m of [beams, spots, lasers]) for (let i = 0; i < m.count; i++) m.setColorAt(i, black);
