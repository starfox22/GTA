      // Garage 3D materials: canvases, brick, stone and board tiles, slats, floor and pegboard.
      const garageModels = [],
        GARAGE_CUT = 2.6 * UNITS_PER_METRE, // the cutaway's height on the facade
        garageTextures = new Map();
      // A canvas texture painted once and shared (sRGB).
      function garageCanvas(key, width, height, paint) {
        if (garageTextures.has(key)) return garageTextures.get(key);
        const cv = document.createElement('canvas');
        cv.width = width;
        cv.height = height;
        paint(cv.getContext('2d'), width, height);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        garageTextures.set(key, tx);
        return tx;
      }
      // Running-bond brick, 2 m to the tile.
      const garageBrickTile = garageCanvas('brick', 256, 256, (g, w, h) => {
        g.fillStyle = '#c9b9a6';
        g.fillRect(0, 0, w, h);
        const course = 9.6,
          brick = 28;
        let row = 0;
        for (let y = 0; y < h; y += course, row++)
          for (let x = row % 2 ? -brick / 2 : 0; x < w; x += brick) {
            const tone = ['#8e3b2a', '#9b4430', '#7d3325', '#a24b36', '#87402d'][Math.floor(Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5)) % 5];
            g.fillStyle = tone;
            g.fillRect(x + 1, y + 1, brick - 2, course - 1.6);
          }
        g.fillStyle = 'rgba(40,20,12,0.12)';
        for (let i = 0; i < 180; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
      });
      garageBrickTile.wrapS = garageBrickTile.wrapT = Three.RepeatWrapping;
      const garageTiledMats = new Map();
      // One material per (kind, size) so a face shows the texture at world scale.
      function garageTiled(kind, width, height, base, options = {}) {
        const key = kind + '|' + Math.round(width) + '|' + Math.round(height);
        if (garageTiledMats.has(key)) return garageTiledMats.get(key);
        const tx = base.clone();
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.repeat.set(Math.max(0.25, width / (options.tile || 16)), Math.max(0.25, height / (options.tile || 16)));
        tx.needsUpdate = true;
        const m = new Three.MeshStandardMaterial({ map: tx, roughness: options.roughness ?? 0.85, metalness: options.metalness ?? 0, color: options.color || '#ffffff' });
        garageTiledMats.set(key, m);
        return m;
      }
      // The rustic shop (STONECREEK GARAGE, a mountain village's): fieldstone and
      // board and batten, 2 m to the tile.
      const garageStoneTile = garageCanvas('fieldstone', 256, 256, (g, w, h) => {
        g.fillStyle = '#857f74';
        g.fillRect(0, 0, w, h);
        const tones = ['#c9c1b3', '#b3ab9e', '#d6cfc2', '#a69f94', '#bfc2bd', '#c7b79d'];
        for (let row = 0; row < 7; row++)
          for (let x = -20 + (row % 2) * 16; x < w + 20; ) {
            const sw = 26 + Math.abs(Math.sin(row * 7.1 + x * 0.37)) * 22,
              sh = 28 + Math.abs(Math.sin(row * 3.3 + x * 0.11)) * 8,
              cx = x + sw / 2,
              cy = row * 37 + 18;
            for (const dx of [-w, 0, w]) {
              g.fillStyle = 'rgba(40,36,30,0.55)';
              g.beginPath();
              g.ellipse(cx + dx + 1, cy + 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
              g.fill();
              g.fillStyle = tones[(row * 3 + Math.round(x)) % tones.length];
              g.beginPath();
              g.ellipse(cx + dx, cy, sw / 2 - 1.5, sh / 2 - 1.5, 0, 0, Math.PI * 2);
              g.fill();
              g.fillStyle = 'rgba(255,255,255,0.16)';
              g.beginPath();
              g.ellipse(cx + dx - sw * 0.1, cy - sh * 0.2, sw * 0.26, sh * 0.14, 0, 0, Math.PI * 2);
              g.fill();
            }
            x += sw + 3;
          }
      });
      garageStoneTile.wrapS = garageStoneTile.wrapT = Three.RepeatWrapping;
      const garageBoardTile = garageCanvas('boards', 256, 256, (g, w, h) => {
        for (let i = 0; i < 8; i++) {
          const v = 118 + ((i * 37) % 30);
          g.fillStyle = `rgb(${v},${Math.round(v * 0.78)},${Math.round(v * 0.55)})`;
          g.fillRect(i * 32, 0, 32, h);
          g.fillStyle = 'rgba(255,240,215,0.25)';
          g.fillRect(i * 32 + 27, 0, 2, h);
          g.fillStyle = 'rgba(30,18,10,0.6)';
          g.fillRect(i * 32 + 29, 0, 3, h);
        }
      });
      garageBoardTile.wrapS = garageBoardTile.wrapT = Three.RepeatWrapping;
      const garageStone = (w, h) => garageTiled('fieldstone', w, h, garageStoneTile, { tile: 16 }),
        garageBoards = (w, h) => garageTiled('boards', w, h, garageBoardTile, { tile: 16 }),
        garageRedRoof = (w, h) => garageTiled('redroof', w, h, ROOF_TEXTURES.metal, { color: '#9a3a2a', roughness: 0.5, metalness: 0.35, tile: 20 });
      const garageBrick = (w, h) => garageTiled('brick', w, h, garageBrickTile),
        garageCladding = (w, h) => garageTiled('metal', w, h, ROOF_TEXTURES.metal, { color: '#b9c2c4', roughness: 0.55, metalness: 0.4 });
      // Door slats: ribbed galvanised steel.
      const garageSlatMat = new Three.MeshStandardMaterial({
        map: garageCanvas('slat', 64, 32, (g, w, h) => {
          g.fillStyle = '#c9cdca';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#9da3a1';
          g.fillRect(0, 0, w, 3);
          g.fillRect(0, h / 2 - 1, w, 2);
          g.fillStyle = '#e1e4e1';
          g.fillRect(0, 4, w, 2);
        }),
        roughness: 0.42,
        metalness: 0.55,
      });
      // The bay floor: epoxy with bay lines, the paint zone's hatching, a drain and oil stains.
      function paintGarageFloor(g, w, h) {
        const u = w / GARAGE_PLAN.bayWidth; // pixels per map unit
        g.fillStyle = '#86958f';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) {
          g.fillStyle = ['#7f8e89', '#8e9c97', '#93a19c', '#7a8984'][i % 4];
          g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
        }
        const vY = (v) => h - v * u,
          uX = (x) => w / 2 + x * u;
        // Lane lines either side of the drive line, the lift box and the booth zone.
        g.fillStyle = '#e3bd2e';
        for (const x of [-27, 27]) g.fillRect(uX(x) - 1.5, vY(116), 3, (116 - 4) * u);
        g.strokeStyle = '#e3bd2e';
        g.lineWidth = 2.5;
        g.strokeRect(uX(-15), vY(78), 30 * u, 36 * u);
        g.save();
        g.beginPath();
        g.rect(uX(-40), vY(119), 80 * u, 21 * u);
        g.clip();
        g.fillStyle = 'rgba(227,189,46,0.55)';
        for (let x = -60; x < 60; x += 6) {
          g.beginPath();
          g.moveTo(uX(x), vY(98));
          g.lineTo(uX(x + 3), vY(98));
          g.lineTo(uX(x + 24), vY(120));
          g.lineTo(uX(x + 21), vY(120));
          g.fill();
        }
        g.restore();
        g.fillStyle = '#86958f';
        g.fillRect(uX(-14), vY(112), 28 * u, 10 * u);
        g.fillStyle = '#c9a524';
        g.font = 'bold ' + Math.round(6 * u) + 'px Arial';
        g.textAlign = 'center';
        g.fillText('PAINT ZONE', uX(0), vY(104));
        // Drain grate under the lift.
        g.fillStyle = '#3d4442';
        g.fillRect(uX(-9), vY(61.2), 18 * u, 2.4 * u);
        g.fillStyle = '#6b7471';
        for (let x = -8; x < 9; x += 1.5) g.fillRect(uX(x), vY(61), 0.5 * u, 2 * u);
        // Oil and coolant stains: under the lift, by the bench, under the hoist, a trail in.
        const stain = (x, v, r, a = 0.5, color = '20,18,14') => {
          const grad = g.createRadialGradient(uX(x), vY(v), 0, uX(x), vY(v), r * u);
          grad.addColorStop(0, `rgba(${color},${a})`);
          grad.addColorStop(0.6, `rgba(${color},${a * 0.5})`);
          grad.addColorStop(1, `rgba(${color},0)`);
          g.fillStyle = grad;
          g.beginPath();
          g.ellipse(uX(x), vY(v), r * u, r * u * 0.7, x * 0.3, 0, TAU);
          g.fill();
        };
        stain(-3, 70, 7, 0.55);
        stain(5, 54, 5, 0.45);
        stain(-1, 44, 3.5, 0.4);
        stain(-30, 82, 4, 0.35);
        stain(30, 20, 5, 0.5);
        stain(8, 30, 3, 0.3, '40,70,60');
        stain(-6, 12, 2.5, 0.3);
        // Faint tyre marks from the door.
        g.strokeStyle = 'rgba(30,30,30,0.18)';
        g.lineWidth = 2.2 * u;
        for (const x of [-7, 7]) {
          g.beginPath();
          g.moveTo(uX(x), vY(0));
          g.lineTo(uX(x * 0.9), vY(80));
          g.stroke();
        }
      }
      const garageFloorMat = new Three.MeshStandardMaterial({
        map: garageCanvas('floor', 320, 480, paintGarageFloor),
        roughness: 0.26,
        metalness: 0.06,
      });
      // Pegboard with outlined tools.
      const garagePegboardMat = new Three.MeshStandardMaterial({
        map: garageCanvas('pegboard', 256, 108, (g, w, h) => {
          g.fillStyle = '#a4825c';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#6d5438';
          for (let x = 6; x < w; x += 10) for (let y = 6; y < h; y += 10) g.fillRect(x, y, 2, 2);
          g.strokeStyle = '#1e1e1e';
          g.fillStyle = '#5a5f63';
          g.lineWidth = 3;
          // Spanners in a row.
          for (let i = 0; i < 8; i++) {
            const x = 18 + i * 13,
              len = 30 + i * 4;
            g.fillRect(x - 2, 14, 4, len);
            g.beginPath();
            g.arc(x, 14, 5, 0, TAU);
            g.fill();
          }
          // Hammer, screwdrivers, pliers.
          g.fillStyle = '#c0392b';
          g.fillRect(140, 20, 6, 50);
          g.fillStyle = '#4a4f53';
          g.fillRect(130, 14, 26, 10);
          for (let i = 0; i < 5; i++) {
            g.fillStyle = ['#e2b007', '#c0392b', '#2d6a93', '#e2b007', '#27ae60'][i];
            g.fillRect(172 + i * 12, 16, 7, 18);
            g.fillStyle = '#9aa0a4';
            g.fillRect(174 + i * 12, 34, 3, 26);
          }
          g.fillStyle = '#c0392b';
          g.fillRect(180, 76, 8, 22);
          g.fillRect(194, 76, 8, 22);
          g.fillStyle = '#5a5f63';
          g.fillRect(184, 64, 14, 14);
        }),
        roughness: 0.8,
      });
      const garageNoSmokingMat = new Three.MeshStandardMaterial({
        map: garageCanvas('nosmoking', 128, 160, (g, w, h) => {
          g.fillStyle = '#f4f2ec';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#1e1e1e';
          g.lineWidth = 3;
          g.strokeRect(3, 3, w - 6, h - 6);
          // A cigarette under the red ring and bar.
          g.fillStyle = '#ffffff';
          g.fillRect(28, 58, 58, 12);
          g.fillStyle = '#d88a3a';
          g.fillRect(86, 58, 14, 12);
          g.fillStyle = '#9a9a9a';
          g.fillRect(24, 56, 5, 16);
          g.strokeStyle = '#d0121b';
          g.lineWidth = 11;
          g.beginPath();
          g.arc(64, 64, 42, 0, TAU);
          g.stroke();
          g.beginPath();
          g.moveTo(34, 34);
          g.lineTo(94, 94);
          g.stroke();
          g.fillStyle = '#d0121b';
          g.font = 'bold 21px Arial';
          g.textAlign = 'center';
          g.fillText('NO', 64, 130);
          g.fillText('SMOKING', 64, 151);
        }),
        roughness: 0.6,
      });
      const garageCalendarMat = new Three.MeshStandardMaterial({
        map: garageCanvas('calendar', 128, 176, (g, w, h) => {
          g.fillStyle = '#f7f3ea';
          g.fillRect(0, 0, w, h);
          // The picture: a red coupe on a sunset.
          const sky = g.createLinearGradient(0, 0, 0, 84);
          sky.addColorStop(0, '#f7a24a');
          sky.addColorStop(1, '#e0537a');
          g.fillStyle = sky;
          g.fillRect(6, 6, w - 12, 80);
          g.fillStyle = '#ffd36b';
          g.beginPath();
          g.arc(84, 56, 16, 0, TAU);
          g.fill();
          g.fillStyle = '#2b2440';
          g.fillRect(6, 70, w - 12, 16);
          g.fillStyle = '#c2141e';
          g.beginPath();
          g.moveTo(18, 74);
          g.lineTo(30, 62);
          g.lineTo(70, 60);
          g.lineTo(86, 66);
          g.lineTo(110, 70);
          g.lineTo(110, 78);
          g.lineTo(18, 80);
          g.fill();
          g.fillStyle = '#111';
          for (const x of [34, 92]) {
            g.beginPath();
            g.arc(x, 80, 6, 0, TAU);
            g.fill();
          }
          g.fillStyle = '#1e2a38';
          g.font = 'bold 12px Arial';
          g.textAlign = 'center';
          g.fillText('JULY 1997', 64, 102);
          g.font = 'bold 8px Arial';
          g.fillText('SOUTH COAST AUTO PARTS', 64, 170);
          g.strokeStyle = '#9aa3ab';
          g.lineWidth = 1;
          for (let r = 0; r < 5; r++)
            for (let c = 0; c < 7; c++) {
              g.strokeRect(10 + c * 15.4, 108 + r * 11, 15.4, 11);
              g.fillStyle = r === 2 && c === 3 ? '#d0121b' : '#55606a';
              g.font = '7px Arial';
              g.fillText(String(r * 7 + c + 1), 17 + c * 15.4, 116 + r * 11);
            }
        }),
        roughness: 0.7,
      });
      const garageFanMat = new Three.MeshStandardMaterial({
        map: garageCanvas('fan', 128, 128, (g, w) => {
          g.fillStyle = '#2b3033';
          g.fillRect(0, 0, w, w);
          g.fillStyle = '#9aa2a6';
          for (let i = 0; i < 5; i++) {
            g.save();
            g.translate(64, 64);
            g.rotate((i / 5) * TAU);
            g.beginPath();
            g.ellipse(0, -28, 11, 26, 0.5, 0, TAU);
            g.fill();
            g.restore();
          }
          g.fillStyle = '#50585c';
          g.beginPath();
          g.arc(64, 64, 11, 0, TAU);
          g.fill();
        }),
        transparent: false,
        roughness: 0.5,
        metalness: 0.4,
      });
      const garageGrilleMat = new Three.MeshStandardMaterial({
        map: garageCanvas('grille', 128, 128, (g, w) => {
          g.clearRect(0, 0, w, w);
          g.strokeStyle = '#c3c9cc';
          g.lineWidth = 2;
          for (let r = 12; r < 64; r += 9) {
            g.beginPath();
            g.arc(64, 64, r, 0, TAU);
            g.stroke();
          }
          g.beginPath();
          g.moveTo(0, 64);
          g.lineTo(w, 64);
          g.moveTo(64, 0);
          g.lineTo(64, w);
          g.stroke();
        }),
        transparent: true,
        alphaTest: 0.4,
        roughness: 0.4,
        metalness: 0.7,
      });
      const garageHazardMat = new Three.MeshStandardMaterial({
        map: garageCanvas('hazard', 64, 64, (g, w) => {
          g.fillStyle = '#f2c21b';
          g.fillRect(0, 0, w, w);
          g.fillStyle = '#1a1a1a';
          for (let x = -w; x < w; x += 16) {
            g.beginPath();
            g.moveTo(x, w);
            g.lineTo(x + 8, w);
            g.lineTo(x + 8 + w, 0);
            g.lineTo(x + w, 0);
            g.fill();
          }
        }),
        roughness: 0.6,
      });
      const garageBoothSignMat = new Three.MeshStandardMaterial({
        map: garageCanvas('booth', 256, 48, (g, w, h) => {
          g.fillStyle = '#e8e4d8';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#b3202a';
          g.font = 'bold 26px Arial';
          g.textAlign = 'center';
          g.fillText('PAINT BOOTH · RESPIRATOR', w / 2, 33);
        }),
        roughness: 0.7,
      });
      // Shared finishes.
      const GM = {
        lining: staticMat('#d9d4c7', 0.9),
        concrete: staticMat('#9a9c96', 0.9),
        steel: staticMat('#3a4044', 0.5, 0.6),
        galv: staticMat('#aeb4b3', 0.45, 0.6),
        white: staticMat('#e8ecea', 0.5, 0.2),
        liftBlue: staticMat('#1f4f9c', 0.45, 0.35),
        liftYellow: staticMat('#f2c21b', 0.5, 0.2),
        chestRed: staticMat('#c3202a', 0.32, 0.35),
        chestDark: staticMat('#2a1416', 0.5, 0.2),
        benchTop: staticMat('#6c7174', 0.35, 0.7),
        viceBlue: staticMat('#23427a', 0.4, 0.5),
        rubber: staticMat('#1c1c1c', 0.95),
        rim: staticMat('#8d9396', 0.35, 0.8),
        hoistYellow: staticMat('#e8b21a', 0.45, 0.3),
        engine: staticMat('#4a4e50', 0.55, 0.6),
        engineRed: staticMat('#a8201e', 0.4, 0.4),
        drumBlue: staticMat('#1f5aa8', 0.45, 0.3),
        compressorRed: staticMat('#b8292a', 0.35, 0.35),
        filter: staticMat('#f0ece0', 0.9),
        glass: staticMat('#3c5364', 0.08, 0.6),
        roofDeck: (() => {
          const tx = ROOF_TEXTURES.membrane.clone();
          tx.repeat.set(3, 4);
          tx.needsUpdate = true;
          return new Three.MeshStandardMaterial({ map: tx, color: '#c4c8c3', roughness: 0.85 });
        })(),
        coping: staticMat('#8f9391', 0.6, 0.3),
        acBody: staticMat('#cfd3d0', 0.5, 0.35),
        fire: staticMat('#c8161d', 0.35, 0.2),
        tin: [staticMat('#d8261c', 0.35, 0.6), staticMat('#1d5fb0', 0.35, 0.6), staticMat('#f2efe6', 0.35, 0.6), staticMat('#1b1b1b', 0.35, 0.6)],
      };
      const garageTubeMat = new Three.MeshBasicMaterial({ color: '#eef6ff', toneMapped: false }),
        garageBeaconLit = new Three.MeshBasicMaterial({ color: '#ffb300', toneMapped: false }),
        garageBeaconOff = staticMat('#7a5a18', 0.4, 0.2);
      const garagePlane = (parent, x, y, z, w, h, material, turn = 0) => {
        const m = new Three.Mesh(new Three.PlaneGeometry(w, h), material);
        m.position.set(x, y, z);
        m.rotation.y = turn;
        m.receiveShadow = true;
        parent.add(m);
        return m;
      };
      const garageTyreGeo = new Three.TorusGeometry(2.6, 1.05, 8, 18);
      function garageTyre(parent, x, y, z, flatDown = true) {
        const t = new Three.Mesh(garageTyreGeo, GM.rubber);
        t.position.set(x, y, z);
        // Lying flat, or standing on its tread facing east-west.
        if (flatDown) t.rotation.x = Math.PI / 2;
        else t.rotation.y = Math.PI / 2;
        t.castShadow = t.receiveShadow = true;
        parent.add(t);
        const hub = mesh(cylinderGeo, GM.rim, parent, x, y, z, 1.7, 1.2, 1.7);
        if (!flatDown) hub.rotation.z = Math.PI / 2;
        return t;
      }
