      // BEGIN SUBSYSTEM: src/garage3d.js — Garage meshes
      /**
       * Garage meshes
       * Source: src/garage3d.js
       * Scope: createCityRenderer() closure.
       * The respray garages at real scale (garages.js GARAGE_PLAN): brick and
       * steel workshops with a sectional roll-up door, a rooftop billboard that
       * says MECHANICS, AC units on the roof and an office beside the bay.
       *
       * Inside (seen through the cutaway when the player is in the bay: the roof
       * lifts off and, once the door is down, the front wall above 2.6 m goes
       * too): an epoxy floor with oil stains and bay lines, a two-post lift, red
       * rolling tool chests, a workbench with a vice and a pegboard, a compressor,
       * a tyre stack, an engine hoist with an engine on the chain, oil drums, the
       * paint zone at the back (extraction fan, filters, a spray gun on a gantry
       * trolley, the paint cart), fluorescent tubes, a NO SMOKING sign and a
       * calendar. The mechanics are crowd people (garages.js staffGarages).
       *
       * The drive-in show (garages.js repairJob) moves the door slats (with a
       * rattle), the amber beacon, the spray trolley, the paint mist in the new
       * colour and the grinder sparks. Everything static is merged by the
       * batcher; the door, roof, upper facade, rig and fan stay live.
       */
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
      // The fascia strip: tagline on the shop colour; the letters glow at night.
      function garageFasciaMaterial(s) {
        const paint = (g, w, h, glow) => {
          g.fillStyle = glow ? '#000' : s.color;
          g.fillRect(0, 0, w, h);
          if (!glow) {
            g.fillStyle = 'rgba(0,0,0,0.18)';
            g.fillRect(0, h - 10, w, 10);
            g.fillStyle = 'rgba(255,255,255,0.25)';
            g.fillRect(0, 0, w, 6);
          }
          g.font = '900 58px Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          const text = s.tagline.replace(/ · /g, '  ·  ');
          let size = 58;
          while (g.measureText(text).width > w * 0.94 && size > 20) g.font = '900 ' + (size -= 2) + 'px Arial';
          g.fillStyle = glow ? '#fff4d8' : '#10181c';
          g.fillText(text, w / 2, h / 2 + 3);
        };
        const face = garageCanvas('fascia-' + s.id, 1024, 96, (g, w, h) => paint(g, w, h, false)),
          glow = garageCanvas('fascia-glow-' + s.id, 1024, 96, (g, w, h) => paint(g, w, h, true));
        return litSignMaterial(face, glow, { night: 1.6, day: 0.05 });
      }
      function buildGarage3D(s) {
        const P = GARAGE_PLAN,
          group = new Three.Group(),
          live = new Three.Group(), // door, roof, upper facade, rig, fan: not merged
          roof = new Three.Group(),
          upper = new Three.Group(),
          bay = s.bay,
          wallX0 = bay.x0 - P.wall,
          wallX1 = bay.x1 + P.wall,
          front = s.front,
          back = s.back,
          depth = front - back,
          eaves = P.eaves,
          // v: map units from the inside of the door line towards the back wall.
          zOf = (v) => bay.y1 - v,
          B = (x, y, z, w, h, d, material, parent = group) => box(parent, x, y, z, w, h, d, material);
        live.userData.dynamic = true;
        scene.add(group);
        group.add(live);
        live.add(roof, upper);
        batchGroups.push(group);
        statics.push({ x: s.x, y: s.y, group, radius: 220 });

        // ---- Ground: apron slab and the bay's epoxy floor.
        B(s.bayX, 0.15, (front + s.lotY1) / 2, s.door.x1 - s.door.x0 + 28, 0.3, s.lotY1 - front, GM.concrete);
        const floor = garagePlane(group, s.bayX, 0.36, (bay.y0 + bay.y1) / 2, bay.x1 - bay.x0, bay.y1 - bay.y0, garageFloorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.userData.sign = true;

        // ---- Walls: clad steel outside, painted block lining inside.
        for (const [x0, x1] of [
          [wallX0, bay.x0],
          [bay.x1, wallX1],
        ]) {
          const outer = x0 < s.bayX ? x0 + 0.8 : x1 - 0.8,
            inner = x0 < s.bayX ? x1 - 0.8 : x0 + 0.8;
          B(outer, eaves / 2, (back + front) / 2, 1.6, eaves, depth, x0 < s.bayX ? garageCladding(depth, eaves) : garageBrick(depth, eaves));
          B(inner, eaves / 2, (back + front - P.wall) / 2, 1.6, eaves, depth - P.wall, GM.lining);
        }
        B(s.bayX, eaves / 2, back + 0.8, wallX1 - wallX0, eaves, 1.6, garageCladding(wallX1 - wallX0, eaves));
        B(s.bayX, eaves / 2, back + 2.4, bay.x1 - bay.x0, eaves, 1.6, GM.lining);
        // A plinth round the base.
        B(s.bayX, 1.6, back - 0.3, wallX1 - wallX0 + 1, 3.2, 1, GM.concrete);
        B(wallX0 - 0.3, 1.6, (back + front) / 2, 1, 3.2, depth, GM.concrete);
        // West side windows (high, over the bench) and a downpipe at each front corner.
        for (const v of [28, 60, 92]) {
          B(wallX0 - 0.1, 32, zOf(v), 0.8, 8, 14, GM.glass);
          B(wallX0 - 0.4, 27.6, zOf(v), 1.2, 0.8, 15.5, GM.coping);
          B(wallX0 - 0.4, 36.4, zOf(v), 1.2, 0.8, 15.5, GM.steel);
          B(bay.x0 + 0.05, 32, zOf(v), 0.4, 8, 14, GM.glass);
        }
        for (const x of [wallX0 + 1, wallX1 - 1]) B(x, eaves / 2, front + 1.2, 1.2, eaves, 1.2, GM.steel);

        // ---- The facade: brick piers either side of the door, the header above.
        const pierWest = s.door.x0 - wallX0,
          pierEast = wallX1 - s.door.x1,
          pierZ = front - P.wall / 2;
        for (const [cx, w] of [
          [wallX0 + pierWest / 2, pierWest],
          [s.door.x1 + pierEast / 2, pierEast],
        ]) {
          B(cx, GARAGE_CUT / 2, pierZ, w, GARAGE_CUT, P.wall, garageBrick(w, GARAGE_CUT));
          B(cx, (GARAGE_CUT + eaves) / 2, pierZ, w, eaves - GARAGE_CUT, P.wall, garageBrick(w, eaves - GARAGE_CUT), upper);
        }
        const doorW = s.door.x1 - s.door.x0;
        B(s.bayX, (P.doorHeight + eaves) / 2, pierZ, doorW, eaves - P.doorHeight, P.wall, garageBrick(doorW, eaves - P.doorHeight), upper);
        // Steel jamb channels, hazard stripes at bumper height, the head beam.
        for (const x of [s.door.x0, s.door.x1]) {
          B(x, GARAGE_CUT / 2, front + 0.2, 1.4, GARAGE_CUT, 1.2, GM.steel);
          B(x, (GARAGE_CUT + P.doorHeight) / 2, front + 0.2, 1.4, P.doorHeight - GARAGE_CUT, 1.2, GM.steel, upper);
          B(x + (x < s.bayX ? -2.2 : 2.2), 5, front + 0.3, 3, 9, 0.6, garageHazardMat);
        }
        B(s.bayX, P.doorHeight + 0.7, front + 0.2, doorW + 2.8, 1.4, 1.2, GM.steel, upper);
        // The fascia over the door: the shop's colour with its trade in big
        // letters (MECHANICS on every shop), lit at night.
        const fasciaW = wallX1 - wallX0 + 0.8,
          fascia = garagePlane(upper, s.bayX, P.doorHeight + 6.2, front + 0.9, fasciaW - 3, 7, garageFasciaMaterial(s));
        fascia.userData.sign = true;
        B(s.bayX, P.doorHeight + 6.2, front + 0.4, fasciaW, 8.4, 1, GM.steel, upper);
        // The door drum housing inside, over the opening.
        B(s.bayX, P.doorHeight + 4, front - P.wall - 2.4, doorW + 4, 5, 4.4, GM.galv, upper);
        // Amber beacon over the door (flashes while the door moves) and two wall lamps.
        const beacon = B(s.bayX, P.doorHeight + 4.2, front + 1.4, 2.2, 1.6, 1.6, garageBeaconOff, upper);
        for (const x of [s.door.x0 - 6, s.door.x1 + 6]) {
          B(x, P.doorHeight + 2, front + 1.6, 1.2, 1.2, 3.2, GM.steel, upper);
          B(x, P.doorHeight + 1.2, front + 3, 3, 0.8, 2.4, GM.steel, upper);
          addGlow(x, P.doorHeight + 0.6, front + 3, 10, '#ffe2b0', 0.9, { day: 0 });
        }
        signSpill(s.bayX, front + 10, 70, '#ffe2b0', 0.35);

        // ---- The roll-up door: ten slats that stack into the drum as it opens.
        const SLATS = 10,
          slatH = P.doorHeight / SLATS,
          slats = [];
        for (let i = 0; i < SLATS; i++) {
          const slat = new Three.Group();
          slat.userData.dynamic = true;
          live.add(slat);
          box(slat, 0, 0, 0, doorW + 1.6, slatH - 0.15, 0.8, garageSlatMat);
          // Vision panels in the sixth slat; the bottom rail and a handle on the first.
          if (i === 6) for (let k = -2; k <= 2; k++) box(slat, k * 8, 0, 0.45, 5, slatH * 0.55, 0.2, GM.glass);
          if (i === 0) {
            box(slat, 0, -slatH / 2 + 0.3, 0, doorW + 1.6, 0.6, 1.2, GM.rubber);
            box(slat, 0, 0.4, 0.6, 5, 0.6, 0.6, GM.steel);
          }
          slat.position.set(s.bayX, 0, front - P.wall / 2 - 0.2);
          slats.push(slat);
        }

        // ---- Roof: membrane deck, parapet and coping, AC units, extract stack,
        // skylights and the billboard.
        const roofW = wallX1 - wallX0,
          deckTop = eaves + P.roof;
        B(s.bayX, eaves + P.roof / 2, (back + front) / 2, roofW, P.roof, depth, GM.roofDeck, roof);
        for (const [x, z, w, d] of [
          [s.bayX, back + 0.8, roofW, 1.6],
          [s.bayX, front - 0.8, roofW, 1.6],
          [wallX0 + 0.8, (back + front) / 2, 1.6, depth],
          [wallX1 - 0.8, (back + front) / 2, 1.6, depth],
        ]) {
          B(x, deckTop + 2.4, z, w, 4.8, d, x === s.bayX ? garageBrick(w, 4.8) : garageCladding(d, 4.8), roof);
          B(x, deckTop + 5, z, w + 0.6, 0.6, d + 0.6, GM.coping, roof);
        }
        for (const [v, u] of [
          [70, -18],
          [96, 14],
        ]) {
          B(s.bayX + u, deckTop + 4, zOf(v), 12, 8, 9, GM.acBody, roof);
          B(s.bayX + u, deckTop + 8.2, zOf(v), 11, 0.4, 8, GM.steel, roof);
          const fan = mesh(cylinderGeo, GM.steel, roof, s.bayX + u, deckTop + 8.5, zOf(v), 3.2, 0.3, 3.2);
          fan.castShadow = false;
          B(s.bayX + u + 7, deckTop + 2, zOf(v), 2, 2, 2, GM.galv, roof);
        }
        for (const v of [36, 50]) B(s.bayX - 10, deckTop + 0.8, zOf(v), 18, 1.6, 10, GM.glass, roof);
        mesh(cylinderGeo, GM.galv, roof, s.bayX + 26, deckTop + 6, zOf(112), 2.2, 12, 2.2);
        mesh(cylinderGeo, GM.steel, roof, s.bayX + 26, deckTop + 12.6, zOf(112), 3.4, 1.2, 3.4);
        // The rooftop billboard: two steel legs with braces, lit from below.
        const boardW = 124,
          boardH = boardW / 4,
          boardY = deckTop + 6 + boardH / 2,
          boardZ = front - 5;
        for (const x of [s.bayX - boardW * 0.32, s.bayX + boardW * 0.32]) {
          B(x, deckTop + 3 + boardH / 2, boardZ - 2.2, 1.4, boardH + 6, 1.4, GM.steel, roof);
          rod(roof, new Three.Vector3(x, deckTop, boardZ - 12), new Three.Vector3(x, boardY, boardZ - 2.4), 0.5, GM.steel);
        }
        B(s.bayX, deckTop + 5.2, boardZ + 0.4, boardW + 4, 0.6, 3, GM.steel, roof);
        const title = sign(s.name, s.bayX, boardZ, boardW, s.color);
        title.position.y = title.userData.backing.position.y = boardY;
        roof.add(title, title.userData.backing);
        for (const x of [-0.3, 0, 0.3]) addGlow(s.bayX + x * boardW, deckTop + 4.4, boardZ + 3, 12, '#fff1d0', 0.8, { day: 0 });

        // ---- The office: brick, a glass door and a big window, a lightbox sign.
        const O = s.office,
          oh = P.officeHeight,
          ox = O.x + O.w / 2,
          oz = O.y + O.h / 2;
        B(ox, oh / 2, oz, O.w, oh, O.h, garageBrick(O.w, oh));
        B(ox, oh + 1.6, oz, O.w + 0.8, 3.2, O.h + 0.8, GM.coping);
        B(ox, oh + 3.4, oz - 6, 10, 5, 8, GM.acBody);
        B(ox - 10, 12, front + 0.25, 22, 13, 0.6, GM.glass);
        B(ox - 10, 18.9, front + 0.5, 23.4, 0.8, 0.8, GM.steel);
        B(ox - 10, 5.1, front + 0.5, 23.4, 0.8, 0.8, GM.steel);
        B(ox + 13, DOOR_HEIGHT / 2, front + 0.25, 9, DOOR_HEIGHT, 0.6, GM.glass);
        B(ox + 13, DOOR_HEIGHT + 0.5, front + 0.5, 10.4, 1, 0.8, GM.steel);
        const officeSign = sign('MECHANICS', ox, front + 0.6, 40, s.color);
        officeSign.position.y = officeSign.userData.backing.position.y = oh - 6;
        group.add(officeSign, officeSign.userData.backing);
        // Warm light through the office glass at night.
        addGlow(ox - 10, 12, front + 1.2, 18, '#ffd49a', 0.35, { day: 0 });
        signSpill(ox, front + 12, 40, '#ffd49a', 0.3);

        // ---- Interior.
        // The lift: blue posts, yellow carriages, folded arms and a floor plate.
        for (const side of [-1, 1]) {
          const px = s.service.x + side * (P.liftHalfSpan + 1.6),
            pz = s.service.y;
          B(px, 15, pz, 3.2, 30, 4, GM.liftBlue);
          B(px, 30.3, pz, 3.8, 0.6, 4.6, GM.liftYellow);
          B(px, 0.6, pz, 6, 0.6, 7, GM.steel);
          B(px - side * 2.2, 4, pz, 1.4, 5, 5, GM.liftYellow);
          for (const dir of [-1, 1]) {
            B(px - side * 3.4, 2.4, pz + dir * 7, 1.4, 0.9, 13, GM.liftYellow);
            mesh(cylinderGeo, GM.rubber, group, px - side * 3.4, 3, pz + dir * 13, 1.2, 0.6, 1.2);
          }
          // Hydraulic power unit on the west post.
          if (side < 0) {
            B(px - 2.8, 18, pz, 2.4, 6, 3.2, GM.steel);
            mesh(cylinderGeo, GM.galv, group, px - 2.8, 22.5, pz, 1.1, 3, 1.1);
          }
        }
        B(s.service.x, 0.5, s.service.y, P.liftHalfSpan * 2, 0.3, 3.4, GM.galv);

        // West wall, front to back: tyre stack, two red tool chests, the bench, the compressor.
        const wx = bay.x0;
        for (const [u, v] of [
          [6, 8],
          [12, 8],
          [6, 15],
        ])
          for (let k = 0; k < (v === 15 ? 3 : 4); k++) garageTyre(group, wx + u, 1.1 + k * 2.1, zOf(v));
        garageTyre(group, wx + 2, 3.7, zOf(22), false);
        for (const v of [30, 43]) {
          const z = zOf(v);
          B(wx + 3.4, 5.6, z, 5.6, 8.8, 11, GM.chestRed);
          for (let k = 0; k < 6; k++) {
            B(wx + 6.25, 2.6 + k * 1.3, z, 0.15, 0.18, 10.6, GM.chestDark);
            B(wx + 6.4, 3.2 + k * 1.3, z, 0.4, 0.3, 8, chrome);
          }
          B(wx + 3.2, 12.3, z, 5, 4.2, 10.4, GM.chestRed);
          B(wx + 5.8, 12.3, z, 0.15, 0.18, 10, GM.chestDark);
          for (const dz of [-4.6, 4.6]) for (const dx of [1.2, 5.6]) mesh(cylinderGeo, GM.rubber, group, wx + dx, 0.7, z + dz, 0.6, 1, 0.6);
        }
        // Workbench with a steel top, a shelf, a vice at the back end and the pegboard.
        const benchZ = zOf(84);
        B(wx + 3.4, 7.2, benchZ, 6.4, 0.8, 24, GM.benchTop);
        B(wx + 3.4, 2.4, benchZ, 6, 0.4, 23, GM.steel);
        for (const dz of [-11, 11]) for (const dx of [0.8, 6]) B(wx + dx, 3.6, benchZ + dz, 0.6, 7.2, 0.6, GM.steel);
        B(wx + 5, 8.6, benchZ - 10, 2.4, 2, 3.2, GM.viceBlue);
        B(wx + 6.6, 9, benchZ - 10, 0.8, 1.6, 3.6, chrome);
        rod(group, new Three.Vector3(wx + 7.2, 9.2, benchZ - 12.5), new Three.Vector3(wx + 7.2, 9.2, benchZ - 7.5), 0.2, chrome);
        mesh(cylinderGeo, chrome, group, wx + 3, 7.8, benchZ + 4, 1.8, 0.4, 1.8);
        mesh(cylinderGeo, GM.tin[0], group, wx + 2.6, 8.8, benchZ + 9, 0.7, 2, 0.7);
        const peg = garagePlane(group, wx + 0.15, 16.5, benchZ, 24, 10, garagePegboardMat, Math.PI / 2);
        peg.userData.sign = true;
        // Compressor in the corner: a red receiver tank, the motor and belt guard, a hose reel.
        const cz = zOf(111);
        const tank = mesh(cylinderGeo, GM.compressorRed, group, wx + 7, 3.6, cz, 2.6, 11, 2.6);
        tank.rotation.x = Math.PI / 2;
        B(wx + 7, 0.6, cz - 3.5, 4, 1.2, 1, GM.steel);
        B(wx + 7, 0.6, cz + 3.5, 4, 1.2, 1, GM.steel);
        B(wx + 7, 7.4, cz + 1.5, 3.4, 3, 4, GM.engine);
        B(wx + 7, 7.2, cz - 2.8, 1, 3.6, 3.6, GM.galv);
        mesh(cylinderGeo, chrome, group, wx + 9.2, 6.6, cz - 1, 0.6, 0.4, 0.6).rotation.z = Math.PI / 2;
        const reel = new Three.Mesh(new Three.TorusGeometry(2.2, 0.5, 6, 14), GM.compressorRed);
        reel.position.set(wx + 0.8, 18, zOf(100));
        reel.rotation.y = Math.PI / 2;
        group.add(reel);
        // The fire extinguisher by the door and the NO SMOKING sign.
        mesh(cylinderGeo, GM.fire, group, wx + 1.4, 3.2, zOf(3), 0.9, 5, 0.9);
        const noSmoking = garagePlane(group, wx + 0.2, 18, zOf(56), 5, 6.25, garageNoSmokingMat, Math.PI / 2);
        noSmoking.userData.sign = true;

        // East wall, front to back: engine hoist with an engine, oil drums, calendar, paint cart.
        const ex = bay.x1;
        const hz0 = zOf(8),
          hz1 = zOf(24);
        for (const dx of [-8, -2]) B(ex + dx, 0.8, (hz0 + hz1) / 2, 1.2, 1.2, 16, GM.hoistYellow);
        B(ex - 5, 0.8, hz1, 7.2, 1.2, 1.4, GM.hoistYellow);
        B(ex - 5, 8.5, hz1, 1.4, 16, 1.4, GM.hoistYellow);
        rod(group, new Three.Vector3(ex - 5, 16, hz1), new Three.Vector3(ex - 8, 19.5, hz0 + 1), 0.8, GM.hoistYellow);
        rod(group, new Three.Vector3(ex - 5, 5, hz1), new Three.Vector3(ex - 5, 14, hz1 - 5), 0.5, GM.steel);
        rod(group, new Three.Vector3(ex - 8, 19, hz0 + 1), new Three.Vector3(ex - 8, 12.5, hz0 + 1), 0.15, GM.steel);
        B(ex - 8, 9.5, hz0 + 1, 6, 5, 4.4, GM.engine);
        B(ex - 8, 12.4, hz0 + 1, 5, 1, 3.2, GM.engineRed);
        mesh(cylinderGeo, GM.steel, group, ex - 8, 9.5, hz0 + 3.6, 1.6, 0.6, 1.6).rotation.x = Math.PI / 2;
        for (const [dx, v] of [
          [-3.2, 38],
          [-3.2, 44],
        ]) {
          mesh(cylinderGeo, GM.drumBlue, group, ex + dx, 3.6, zOf(v), 2.3, 7.2, 2.3);
          mesh(cylinderGeo, GM.steel, group, ex + dx, 7.3, zOf(v), 2.35, 0.2, 2.35);
        }
        B(ex - 3.2, 0.3, zOf(41), 6, 0.6, 12, GM.steel);
        const calendar = garagePlane(group, ex - 0.2, 15, zOf(56), 5, 6.9, garageCalendarMat, -Math.PI / 2);
        calendar.userData.sign = true;
        // Paint cart: a trolley with two shelves of tins.
        const cartZ = zOf(80);
        for (const y of [2, 6.5]) B(ex - 4, y, cartZ, 5, 0.4, 9, GM.galv);
        for (const dz of [-4.2, 4.2]) for (const dx of [-6.2, -1.8]) B(ex + dx, 4, cartZ + dz, 0.4, 8, 0.4, GM.galv);
        for (let k = 0; k < 6; k++) mesh(cylinderGeo, GM.tin[k % 4], group, ex - 5 + (k % 2) * 2.2, 7.8 + (k > 3 ? 0 : 0), cartZ - 3 + Math.floor(k / 2) * 3, 0.9, 2.2, 0.9);
        // The trolley jack and a creeper board by the lift.
        B(s.service.x + 30, 1, zOf(64), 3, 1.6, 8, GM.chestRed);
        rod(group, new Three.Vector3(s.service.x + 30, 1.6, zOf(68)), new Three.Vector3(s.service.x + 30, 7, zOf(72)), 0.3, GM.steel);
        B(s.service.x - 30, 0.9, zOf(64), 4, 0.5, 10, GM.steel);

        // Paint zone at the back: extraction fan between two filter banks, the stencilled sign.
        const bz = back + P.wall + 0.3;
        B(s.bayX, 26, bz + 0.8, 17, 17, 1.6, GM.galv);
        const fanBlades = garagePlane(live, s.bayX, 26, bz + 1.8, 14, 14, garageFanMat);
        fanBlades.userData.dynamic = true;
        garagePlane(group, s.bayX, 26, bz + 2.1, 15, 15, garageGrilleMat).userData.sign = true;
        for (const x of [-19, 19]) {
          B(s.bayX + x, 16, bz + 0.5, 14, 20, 0.8, GM.filter);
          B(s.bayX + x, 26.4, bz + 0.6, 14.6, 0.8, 1.2, GM.galv);
          B(s.bayX + x, 5.6, bz + 0.6, 14.6, 0.8, 1.2, GM.galv);
        }
        garagePlane(group, s.bayX, 38, bz + 0.2, 34, 6.4, garageBoothSignMat).userData.sign = true;

        // The spray rig: a gantry beam across the bay and a trolley with hose and gun.
        const rigY = 44;
        B(s.bayX, rigY, s.service.y - 6, bay.x1 - bay.x0, 1.6, 1.6, GM.steel);
        const rig = new Three.Group();
        rig.userData.dynamic = true;
        live.add(rig);
        box(rig, 0, 0, 0, 3.4, 2, 3.2, GM.liftYellow);
        const hose = mesh(cylinderGeo, GM.rubber, rig, 0, -8, 0, 0.35, 16, 0.35);
        hose.castShadow = false;
        const gun = new Three.Group();
        gun.position.set(0, -16, 0);
        rig.add(gun);
        box(gun, 0, 0, 0, 0.8, 1.8, 1.2, GM.steel);
        box(gun, 0, 1.2, 0.2, 1.6, 1, 1.6, GM.galv);
        box(gun, 0, -0.2, 1.1, 0.4, 0.4, 1.4, chrome);
        rig.position.set(bay.x1 - 10, rigY - 1.8, s.service.y - 6);

        // Fluorescent tubes: two rows of three, on drop rods.
        for (const u of [-16, 16])
          for (const v of [24, 60, 96]) {
            const x = s.bayX + u,
              z = zOf(v);
            B(x, 47.4, z, 2.2, 0.8, 13, GM.white);
            B(x, 46.8, z, 1, 0.4, 12, garageTubeMat);
            rod(group, new Three.Vector3(x, 47.8, z - 5), new Three.Vector3(x, eaves, z - 5), 0.12, GM.steel);
            rod(group, new Three.Vector3(x, 47.8, z + 5), new Three.Vector3(x, eaves, z + 5), 0.12, GM.steel);
            addGlow(x, 46.4, z, 16, '#e8f2ff', 0.5, { day: 0.15 });
          }
        // The tubes' light on the floor at night (the light map; lighting3d.js).
        for (const v of [34, 84]) signSpill(s.bayX, zOf(v), 44, '#dfeaff', 0.22);

        const model = { shop: s, group, roof, upper, slats, slatH, beacon, rig, gun, fanBlades, rigPark: bay.x1 - 10 };
        garageModels.push(model);
        return model;
      }
      for (const s of GARAGES) buildGarage3D(s);

      /* THE SHOW'S EFFECTS: one pool of paint mist and one of sparks, used at
         whichever garage has the job. */
      const garageMistTexture = garageCanvas('mist', 64, 64, (g, w) => {
          const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
          grad.addColorStop(0, 'rgba(255,255,255,0.85)');
          grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grad;
          g.fillRect(0, 0, w, w);
        }),
        garageFx = { mist: [], sparks: [], spawnMist: 0, spawnSpark: 0 };
      for (let i = 0; i < 56; i++) {
        const sprite = new Three.Sprite(new Three.SpriteMaterial({ map: garageMistTexture, transparent: true, depthWrite: false, opacity: 0 }));
        sprite.visible = false;
        scene.add(sprite);
        garageFx.mist.push({ sprite, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
      }
      for (let i = 0; i < 40; i++) {
        const sprite = new Three.Sprite(
          new Three.SpriteMaterial({ map: garageMistTexture, color: '#ffb347', transparent: true, depthWrite: false, blending: Three.AdditiveBlending, opacity: 0 }),
        );
        sprite.visible = false;
        scene.add(sprite);
        garageFx.sparks.push({ sprite, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
      }
      function emitGarageFx(pool, setup) {
        const p = pool.find((q) => q.life <= 0);
        if (!p) return;
        setup(p);
        p.max = p.life;
        p.sprite.visible = true;
      }
      function stepGarageFx(pool, dt, gravity, grow) {
        for (const p of pool) {
          if (p.life <= 0) continue;
          p.life -= dt;
          if (p.life <= 0) {
            p.sprite.visible = false;
            continue;
          }
          p.vy -= gravity * dt;
          p.sprite.position.x += p.vx * dt;
          p.sprite.position.y = Math.max(0.5, p.sprite.position.y + p.vy * dt);
          p.sprite.position.z += p.vz * dt;
          const a = p.life / p.max;
          p.sprite.material.opacity = grow ? Math.min(0.62, a * 1.1) : a;
          const size = grow ? p.size * (1.6 - a * 0.9) : p.size;
          p.sprite.scale.set(size, size, 1);
        }
      }
      let garageFxClock = 0;
      function updateGarageVisuals() {
        const job = repairJob,
          dt = Math.min(0.1, Math.max(0, gameTime - garageFxClock));
        garageFxClock = gameTime;
        for (const model of garageModels) {
          const s = model.shop,
            mine = job?.shop === s,
            near = Math.abs(player.x - s.x) < 700 && Math.abs(player.y - s.y) < 700;
          if (!near && !mine) {
            model.roof.visible = model.upper.visible = true;
            continue;
          }
          // Inside the bay (or on the job) the roof lifts off; with the door down
          // for the work, or walking round inside, the front above 2.6 m goes too.
          const inside =
            player.x > s.bay.x0 - 4 && player.x < s.bay.x1 + 4 && player.y > s.bay.y0 - 4 && player.y < s.front + 2,
            showing = mine || inside,
            cut = showing && (!mine || job.phase === 'work' || job.phase === 'fade');
          model.roof.visible = !showing;
          model.upper.visible = !cut;
          // Door slats: slat i sits at open * doorHeight + i slats up; those above
          // the opening are in the drum. A rattle while it moves.
          const moving = mine && (job.phase === 'doorDown' || job.phase === 'doorUp'),
            bottom = s.open * GARAGE_PLAN.doorHeight;
          model.slats.forEach((slat, i) => {
            const y = bottom + (i + 0.5) * model.slatH;
            slat.visible = y < GARAGE_PLAN.doorHeight && (!cut || y - model.slatH / 2 < GARAGE_CUT);
            slat.position.y = y;
            slat.position.x = s.bayX + (moving ? (Math.random() - 0.5) * 0.3 : 0);
          });
          model.beacon.material = moving && Math.floor(gameTime * 6) % 2 ? garageBeaconLit : garageBeaconOff;
          model.fanBlades.rotation.z += dt * (mine && job.phase === 'work' ? 14 : 4);
          // The spray trolley sweeps over the car while the paint goes on, then parks.
          const spraying = mine && job.phase === 'work' && job.t / job.duration < 0.72,
            tall = mine && vehicleSpec(job.car).truck ? 30 : 17,
            gunDrop = spraying ? clamp(40 - tall - 4, 8, 22) : 8,
            targetX = spraying ? s.bayX + Math.sin(job.t * 2.4) * 12 : model.rigPark;
          model.rig.position.x += (targetX - model.rig.position.x) * Math.min(1, dt * (spraying ? 8 : 2));
          model.gun.position.y += (-gunDrop - model.gun.position.y) * Math.min(1, dt * 3);
          model.rig.children[1].scale.y = -model.gun.position.y;
          model.rig.children[1].position.y = model.gun.position.y / 2;
          if (!mine) continue;
          // Paint mist in the new colour round the gun and over the body.
          const car = job.car,
            spec = vehicleSpec(car);
          if (spraying) {
            garageFx.spawnMist -= dt;
            while (garageFx.spawnMist < 0) {
              garageFx.spawnMist += 0.028;
              emitGarageFx(garageFx.mist, (p) => {
                const along = (Math.random() - 0.5) * spec.l * 0.9,
                  across = (Math.random() - 0.5) * spec.w * 1.3;
                p.sprite.position.set(
                  model.rig.position.x + (Math.random() - 0.5) * 6,
                  model.rig.position.y + model.gun.position.y - 1,
                  car.y + along * 0.3 + (Math.random() - 0.5) * 8,
                );
                if (Math.random() < 0.5) p.sprite.position.set(car.x + across, 4 + Math.random() * (tall - 4), car.y + along);
                p.sprite.material.color.set(job.colorTo);
                p.life = 1 + Math.random() * 0.9;
                p.size = 8 + Math.random() * 9;
                p.vx = (Math.random() - 0.5) * 8;
                p.vy = 2 + Math.random() * 4;
                p.vz = (Math.random() - 0.5) * 8;
              });
            }
          }
          // Grinder sparks at a panel being straightened, when there is a repair.
          const grinding = job.phase === 'work' && job.offer.service === 'full' && job.offer.repair > 0 && job.t / job.duration > 0.5;
          if (grinding) {
            garageFx.spawnSpark -= dt;
            const side = Math.floor(job.t * 1.3) % 2 ? 1 : -1,
              ax = car.x + side * (spec.w / 2 + 1),
              az = car.y + Math.sin(job.t * 0.9) * spec.l * 0.3;
            while (garageFx.spawnSpark < 0) {
              garageFx.spawnSpark += 0.012;
              emitGarageFx(garageFx.sparks, (p) => {
                p.sprite.position.set(ax, 5 + Math.random() * 2, az);
                p.life = 0.25 + Math.random() * 0.35;
                p.size = 0.9 + Math.random() * 0.9;
                p.vx = side * (10 + Math.random() * 30);
                p.vy = 6 + Math.random() * 22;
                p.vz = (Math.random() - 0.5) * 36;
              });
            }
          }
        }
        stepGarageFx(garageFx.mist, dt, -1.5, true);
        stepGarageFx(garageFx.sparks, dt, 90, false);
      }
      for (const p of [FLIGHT.heli, FLIGHT.pickup]) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const drawingContext2 = cv.getContext('2d');
        drawingContext2.fillStyle = '#56656a';
        drawingContext2.fillRect(0, 0, 256, 256);
        drawingContext2.strokeStyle = '#e6d5a0';
        drawingContext2.lineWidth = 6;
        drawingContext2.beginPath();
        drawingContext2.arc(128, 128, 104, 0, TAU);
        drawingContext2.stroke();
        drawingContext2.fillStyle = '#f0dfb3';
        drawingContext2.font = 'bold 126px Arial';
        drawingContext2.textAlign = 'center';
        drawingContext2.fillText('H', 128, 172);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        const pad = new Three.Mesh(
          new Three.PlaneGeometry(114, 114),
          new Three.MeshStandardMaterial({
            map: tx,
            roughness: 0.8,
          }),
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(p.x, 0.4, p.y);
        scene.add(pad);
      }
      // END SUBSYSTEM: src/garage3d.js
