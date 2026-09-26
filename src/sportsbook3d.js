      // BEGIN SUBSYSTEM: src/sportsbook3d.js — GOALLINE betting shop meshes
      /**
       * GOALLINE betting shop meshes
       * Source: src/sportsbook3d.js
       * Scope: createCityRenderer() closure (after sports3d.js).
       *
       * The sportsbook beside the stadium plaza (sportsbook.js SPORTSBOOK_SHOP)
       * at real scale: a 16 x 12 m box in charcoal composite panels with a
       * green accent band, a full-height glass frontage with a double door on
       * the south, the GOALLINE SPORTS BET neon sign standing on the front
       * parapet and a lit fascia strip (LIVE ODDS · IN-PLAY · CASH OUT).
       *
       * Inside (through the glass, and from above when the player is in: the
       * roof lifts off as at the garages): a dark floor with a pitch-green
       * carpet, the video wall on the back wall (the big screen shares the
       * stadium's live board, sports3d.js paintSportsBoard, and two odds boards
       * paint GOALLINE's live prices, SUSPENDED over a goal), the counter with
       * its till and PAY OUT sign along the west wall, three self-service
       * terminals on the east wall, a long ledge with low stools, ceiling light
       * strips, posters and a plant. The clerk and the punters are crowd people
       * (sportsbook.js staffSportsbook). Warm light spills on the apron at night.
       */
      const sportsbookModel = (() => {
        const S = SPORTSBOOK_SHOP,
          I = S.inner,
          H = S.height,
          cx = (S.x0 + S.x1) / 2,
          group = new Three.Group(),
          live = new Three.Group(), // roof, lights, screens: not merged
          roof = new Three.Group();
        live.userData.dynamic = true;
        group.add(live);
        live.add(roof);
        scene.add(group);
        batchGroups.push(group);
        statics.push({ x: cx, y: (S.y0 + S.y1) / 2, group, radius: 160 });
        const canvasTexture = (width, height, paint) => {
          const cv = document.createElement('canvas');
          cv.width = width;
          cv.height = height;
          paint(cv.getContext('2d'), width, height);
          const tx = new Three.CanvasTexture(cv);
          tx.colorSpace = Three.SRGBColorSpace;
          tx.anisotropy = 4;
          return { cv, tx };
        };
        const M = {
          cladding: mat('#2a3136', 0.55, 0.35),
          claddingDark: mat('#1b2024', 0.5, 0.4),
          lining: mat('#39454b', 0.8),
          green: new Three.MeshStandardMaterial({ color: '#1fbf66', emissive: '#1fbf66', emissiveIntensity: 0.35, roughness: 0.4 }),
          floor: mat('#1d2427', 0.35, 0.2),
          mullion: mat('#15191c', 0.4, 0.7),
          glass: new Three.MeshStandardMaterial({ color: '#a8d8ff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }),
          counterTop: mat('#d9dcd8', 0.3, 0.1),
          counterFront: mat('#14372a', 0.5, 0.2),
          steel: mat('#8d989c', 0.35, 0.7),
          stool: mat('#1fbf66', 0.5, 0.1),
          seat: mat('#101416', 0.7),
          screenBack: mat('#0c0f11', 0.5, 0.4),
          light: new Three.MeshBasicMaterial({ color: '#f6fbff' }),
          plant: mat('#3f7a4a', 0.8),
          pot: mat('#c9c2b4', 0.7),
          roofDeck: mat('#474d4f', 0.9),
          coping: mat('#8b9194', 0.6, 0.3),
        };
        const B = (x, y, z, w, h, d, material, parent = group) => box(parent, x, y, z, w, h, d, material);
        const plane = (parent, x, y, z, w, h, material) => {
          const m = new Three.Mesh(new Three.PlaneGeometry(w, h), material);
          m.position.set(x, y, z);
          m.receiveShadow = true;
          parent.add(m);
          return m;
        };

        // ---- Floor: dark polished concrete, a pitch-green carpet with its lines.
        const carpet = canvasTexture(512, 384, (g, w, h) => {
          g.fillStyle = '#1f5c3b';
          g.fillRect(0, 0, w, h);
          for (let i = 0; i < 8; i++) {
            g.fillStyle = i % 2 ? '#236642' : '#1c5536';
            g.fillRect((i * w) / 8, 0, w / 8, h);
          }
          g.strokeStyle = '#e8f2ea';
          g.lineWidth = 5;
          g.strokeRect(14, 14, w - 28, h - 28);
          g.beginPath();
          g.moveTo(w / 2, 14);
          g.lineTo(w / 2, h - 14);
          g.stroke();
          g.beginPath();
          g.arc(w / 2, h / 2, 48, 0, TAU);
          g.stroke();
          g.strokeRect(14, h / 2 - 80, 60, 160);
          g.strokeRect(w - 74, h / 2 - 80, 60, 160);
        });
        B(cx, 0.15, (S.y0 + S.y1) / 2, S.x1 - S.x0, 0.3, S.y1 - S.y0, M.floor);
        const carpetMesh = plane(group, I.x0 + 64, 0.34, I.y0 + 44, 76, 46, new Three.MeshStandardMaterial({ map: carpet.tx, roughness: 0.95 }));
        carpetMesh.rotation.x = -Math.PI / 2;
        // The apron in front and its step.
        B(cx, 0.2, S.y1 + 13, S.x1 - S.x0 + 12, 0.4, 26, concrete);

        // ---- Walls: west, east, north (composite panels outside, lining inside).
        const wallH = H,
          depth = S.y1 - S.y0;
        for (const x of [S.x0 + S.wall / 2, S.x1 - S.wall / 2]) {
          B(x, wallH / 2, (S.y0 + S.y1) / 2, S.wall, wallH, depth, M.cladding);
          B(x + (x < cx ? 1.3 : -1.3), wallH / 2, (S.y0 + S.y1) / 2, 0.2, wallH - 0.4, depth - 5, M.lining);
        }
        B(cx, wallH / 2, S.y0 + S.wall / 2, S.x1 - S.x0, wallH, S.wall, M.cladding);
        B(cx, wallH / 2, S.y0 + S.wall + 0.1, S.x1 - S.x0 - 5, wallH - 0.4, 0.2, M.lining);
        // The green accent band round the top, and a plinth.
        for (const [x, z, w, d] of [
          [cx, S.y1 + 0.15, S.x1 - S.x0 + 0.6, 0.6],
          [S.x0 - 0.15, (S.y0 + S.y1) / 2, 0.6, depth],
          [S.x1 + 0.15, (S.y0 + S.y1) / 2, 0.6, depth],
        ]) {
          B(x, H - 3.2, z, w, 1.2, d, M.green);
          B(x, 0.8, z, w, 1.6, d, M.claddingDark);
        }

        // ---- The frontage: glass between slim mullions, the double door.
        const glassTop = 3.4 * UNITS_PER_METRE,
          frontZ = S.y1 - S.wall / 2;
        const bays = [];
        for (let x = S.x0 + S.wall; x < S.door.x0 - 1; x += 16) bays.push([x, Math.min(x + 16, S.door.x0)]);
        for (let x = S.door.x1; x < S.x1 - S.wall - 1; x += 16) bays.push([x, Math.min(x + 16, S.x1 - S.wall)]);
        for (const [a, b] of bays) {
          B((a + b) / 2, glassTop / 2 + 0.6, frontZ, b - a - 0.6, glassTop - 1.2, 0.4, M.glass);
          B(b, glassTop / 2, frontZ, 0.8, glassTop, 1.4, M.mullion);
        }
        B(S.x0 + S.wall, glassTop / 2, frontZ, 0.8, glassTop, 1.4, M.mullion);
        // The door: two glass leaves with green push bars, a steel frame.
        const doorW = S.door.x1 - S.door.x0;
        for (const side of [-1, 1]) {
          const x = (S.door.x0 + S.door.x1) / 2 + side * (doorW / 4);
          B(x, DOOR_HEIGHT / 2 + 0.3, frontZ + 0.8, doorW / 2 - 0.8, DOOR_HEIGHT - 0.6, 0.3, M.glass);
          B(x - side * (doorW / 4 - 1.6), DOOR_HEIGHT * 0.45, frontZ + 1.2, 0.5, 4.2, 0.6, M.green);
        }
        for (const x of [S.door.x0, S.door.x1]) B(x, glassTop / 2, frontZ, 1, glassTop, 1.6, M.mullion);
        B((S.door.x0 + S.door.x1) / 2, DOOR_HEIGHT + 0.4, frontZ, doorW + 1, 0.8, 1.6, M.mullion);
        B((S.door.x0 + S.door.x1) / 2, (DOOR_HEIGHT + glassTop) / 2 + 0.4, frontZ, doorW - 1, glassTop - DOOR_HEIGHT - 1, 0.4, M.glass);
        // The transom head and the fascia band over the glass: lit lettering.
        B(cx, glassTop + 0.4, frontZ, S.x1 - S.x0, 0.8, 1.8, M.mullion);
        const fasciaPaint = (glow) => (g, w, h) => {
          g.fillStyle = glow ? '#000' : '#0d1a14';
          g.fillRect(0, 0, w, h);
          g.font = '900 italic 56px Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          const text = 'LIVE ODDS  ·  IN-PLAY  ·  EVERY MATCH  ·  CASH PAID HERE';
          let size = 56;
          while (g.measureText(text).width > w * 0.95 && size > 20) g.font = '900 italic ' + (size -= 2) + 'px Arial';
          g.fillStyle = glow ? '#c8ffd9' : '#3dff8e';
          g.fillText(text, w / 2, h / 2 + 2);
        };
        const fasciaFace = canvasTexture(1024, 96, fasciaPaint(false)),
          fasciaGlow = canvasTexture(1024, 96, fasciaPaint(true)),
          fasciaH = H - glassTop - 1.6,
          fascia = plane(group, cx, glassTop + 0.8 + fasciaH / 2, S.y1 + 0.35, S.x1 - S.x0 - 4, fasciaH - 0.8, litSignMaterial(fasciaFace.tx, fasciaGlow.tx, { night: 2.2, day: 0.25 }));
        fascia.userData.sign = true;
        B(cx, glassTop + 0.8 + fasciaH / 2, S.y1 - 0.4, S.x1 - S.x0, fasciaH, 1.4, M.claddingDark);
        // Warm light through the glass at night, onto the apron.
        signSpill(cx, S.y1 + 10, 80, '#dfffe9', 0.25, { width: 70, length: 40, strength: 0.45 });
        signSpill(cx, (S.y0 + S.y1) / 2, 70, '#fff3dc', 0.45);
        for (const x of [S.x0 + 26, cx, S.x1 - 26]) addGlow(x, glassTop * 0.6, S.y1 + 1, 18, '#e9fff0', 0.16, { day: 0 });

        // ---- Roof: deck, parapet and coping, AC units; the neon sign on the front.
        B(cx, H + 1, (S.y0 + S.y1) / 2, S.x1 - S.x0, 2, depth, M.roofDeck, roof);
        for (const [x, z, w, d] of [
          [cx, S.y0 + 0.8, S.x1 - S.x0, 1.6],
          [cx, S.y1 - 0.8, S.x1 - S.x0, 1.6],
          [S.x0 + 0.8, (S.y0 + S.y1) / 2, 1.6, depth],
          [S.x1 - 0.8, (S.y0 + S.y1) / 2, 1.6, depth],
        ]) {
          B(x, H + 3.4, z, w, 4.8, d, M.cladding, roof);
          B(x, H + 6, z, w + 0.6, 0.6, d + 0.6, M.coping, roof);
        }
        for (const [x, z] of [
          [S.x0 + 30, S.y0 + 26],
          [S.x0 + 52, S.y0 + 26],
        ]) {
          B(x, H + 5, z, 12, 8, 10, M.steel, roof);
          mesh(cylinderGeo, M.claddingDark, roof, x, H + 9.2, z, 3.4, 0.4, 3.4);
        }
        // Ceiling light strips under the roof (they go with it when the player is in).
        for (const v of [16, 40, 64]) B(I.x0 + 64, H - 1.4, I.y0 + v, 90, 0.6, 1.6, M.light, roof);
        // The sign: GOALLINE SPORTS BET on two legs above the front parapet.
        const signW = 92,
          signH = signW / 4,
          signY = H + 7 + signH / 2,
          signZ = S.y1 - 4;
        for (const x of [cx - signW * 0.3, cx + signW * 0.3]) B(x, H + 5 + signH / 2, signZ - 2, 1.2, signH + 4, 1.2, M.mullion, roof);
        const title = sign(S.name, cx, signZ, signW, '#3dff8e');
        title.position.y = title.userData.backing.position.y = signY;
        roof.add(title, title.userData.backing);
        addGlow(cx, signY, signZ + 3, signW * 0.5, '#3dff8e', 0.22, { day: 0 });
        signSpill(cx, S.y1 + 20, 90, '#3dff8e', 0.16);

        // ---- The video wall: the live board in the middle, odds boards either side.
        const wallZ = S.y0 + S.wall + 0.6,
          liveW = 36,
          liveY = 2.9 * UNITS_PER_METRE;
        B(cx, liveY, wallZ, 118, 22, 0.8, M.screenBack);
        const liveBoard = plane(live, cx, liveY, wallZ + 0.6, liveW, liveW / 2, sportsBoardSurface('soccer').material);
        liveBoard.castShadow = false;
        const oddsBoard = canvasTexture(512, 256, () => {}),
          oddsMaterial = new Three.MeshBasicMaterial({ map: oddsBoard.tx, toneMapped: false });
        for (const side of [-1, 1]) {
          const board = plane(live, cx + side * 40, liveY, wallZ + 0.6, 34, 17, oddsMaterial);
          board.castShadow = false;
        }
        // A green LED strip under the wall, a ticker over it.
        B(cx, liveY - 12, wallZ + 0.4, 118, 0.8, 0.6, M.green);
        B(cx, liveY + 12, wallZ + 0.4, 118, 0.8, 0.6, M.green);

        // ---- The counter along the west wall: top, front panel, till, PAY OUT.
        const C = S.counter,
          counterX = C.x + C.w / 2,
          counterZ = C.y + C.h / 2;
        B(counterX, C.height / 2, counterZ, C.w, C.height - 0.6, C.h, M.counterFront);
        B(counterX, C.height - 0.2, counterZ, C.w + 1.2, 0.6, C.h + 1.2, M.counterTop);
        B(C.x + C.w + 0.3, C.height * 0.55, counterZ, 0.4, 0.8, C.h - 2, M.green);
        const tillScreen = canvasTexture(128, 96, (g, w, h) => {
          g.fillStyle = '#0a1a12';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#3dff8e';
          g.font = 'bold 18px Arial';
          g.textAlign = 'center';
          g.fillText('GOALLINE', w / 2, 30);
          g.fillStyle = '#e6f5ea';
          g.font = 'bold 14px Arial';
          g.fillText('SLIP ACCEPTED', w / 2, 58);
          g.fillText('✓', w / 2, 82);
        });
        for (const v of [14, 36]) {
          B(C.x + 3, C.height + 1.6, C.y + v, 2.4, 2.4, 3.2, M.screenBack);
          const s = plane(live, C.x + 4.3, C.height + 1.8, C.y + v, 3, 2.2, new Three.MeshBasicMaterial({ map: tillScreen.tx, toneMapped: false }));
          s.rotation.y = Math.PI / 2;
        }
        // Slip rack and a screen on the wall behind the clerk.
        B(I.x0 + 1.2, 12, counterZ, 1.4, 10, 22, M.steel);
        const payPaint = (glow) => (g, w, h) => {
          g.fillStyle = glow ? '#000' : '#f2d34a';
          g.fillRect(0, 0, w, h);
          g.fillStyle = glow ? '#fff4c0' : '#131313';
          g.font = '900 60px Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('PAY OUT', w / 2, h / 2 + 3);
        };
        const pay = plane(live, counterX, C.height + 13, C.y - 1, 16, 4, litSignMaterial(canvasTexture(256, 64, payPaint(false)).tx, canvasTexture(256, 64, payPaint(true)).tx, { night: 1.6, day: 0.2 }));
        pay.rotation.y = 0;
        for (const x of [counterX - 6, counterX + 6]) B(x, C.height + 17, C.y - 1, 0.2, 4, 0.2, M.steel, live);

        // ---- Terminals on the east wall: a pedestal, a lit screen angled to the room.
        const terminalScreen = canvasTexture(128, 192, (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, '#0f2c1e');
          grad.addColorStop(1, '#07130d');
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#3dff8e';
          g.font = 'bold 16px Arial';
          g.textAlign = 'center';
          g.fillText('GOALLINE', w / 2, 24);
          for (let i = 0; i < 5; i++) {
            g.fillStyle = '#ffffff18';
            g.fillRect(10, 40 + i * 26, w - 20, 20);
            g.fillStyle = '#e6f5ea';
            g.font = 'bold 11px Arial';
            g.textAlign = 'left';
            g.fillText(['1X2', 'NEXT GOAL', 'TOTALS', 'BTTS', 'SCORE'][i], 16, 54 + i * 26);
            g.fillStyle = '#3dff8e';
            g.textAlign = 'right';
            g.fillText((1.5 + i * 0.85).toFixed(2), w - 16, 54 + i * 26);
          }
          g.fillStyle = '#3dff8e';
          g.fillRect(14, h - 34, w - 28, 22);
          g.fillStyle = '#06140c';
          g.font = 'bold 12px Arial';
          g.textAlign = 'center';
          g.fillText('PLACE BET', w / 2, h - 19);
        });
        const terminalMaterial = new Three.MeshBasicMaterial({ map: terminalScreen.tx, toneMapped: false });
        for (const t of S.terminals) {
          const tx = t.x + t.w / 2,
            tz = t.y + t.h / 2;
          B(tx + 1, 5, tz, 3, 10, 4, M.claddingDark);
          B(tx + 1, 0.6, tz, 5, 1.2, 6, M.steel);
          B(tx, 11, tz, 2, 7, 5.4, M.screenBack);
          const s = plane(live, tx - 1.1, 11, tz, 4.6, 6.4, terminalMaterial);
          s.rotation.y = -Math.PI / 2;
          s.rotation.x = 0;
          B(tx - 1.6, 7.4, tz, 2, 0.4, 4.4, M.green);
        }

        // ---- The ledge with low stools, facing the screens.
        const L = S.ledge;
        B(L.x + L.w / 2, L.height - 0.4, L.y + L.h / 2, L.w, 0.8, L.h + 1, M.counterTop);
        for (const x of [L.x + 2, L.x + L.w - 2]) B(x, (L.height - 0.8) / 2, L.y + L.h / 2, 1, L.height - 0.8, 1, M.steel);
        for (const st of S.stools) {
          mesh(cylinderGeo, M.steel, group, st.x, 2, st.y, 0.5, 4, 0.5);
          mesh(cylinderGeo, M.stool, group, st.x, 4.2, st.y, 2.2, 0.8, 2.2);
          mesh(cylinderGeo, M.seat, group, st.x, 0.4, st.y, 1.8, 0.4, 1.8);
        }

        // ---- Posters and a plant.
        const posterPaint = (text, color) => (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, color);
          grad.addColorStop(1, '#0b1210');
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#ffffff';
          g.font = '900 italic 34px Arial';
          g.textAlign = 'center';
          g.fillText(text, w / 2, h * 0.55);
          g.font = 'bold 14px Arial';
          g.fillStyle = '#3dff8e';
          g.fillText('GOALLINE', w / 2, h * 0.85);
        };
        for (const [x, text, color] of [
          [S.x0 + 14, 'IN-PLAY', '#1fbf66'],
          [S.x1 - 14, 'BOOSTS', '#d9482b'],
        ]) {
          const p = plane(live, x, 18, S.y0 + S.wall + 0.5, 12, 16, new Three.MeshStandardMaterial({ map: canvasTexture(128, 170, posterPaint(text, color)).tx, roughness: 0.6 }));
          p.castShadow = false;
        }
        mesh(cylinderGeo, M.pot, group, I.x0 + 5, 2.2, I.y1 - 5, 2.6, 4.4, 2.6);
        mesh(sphereGeo, M.plant, group, I.x0 + 5, 8, I.y1 - 5, 4, 5, 4);

        return { group, roof, oddsBoard, oddsMaterial, key: '' };
      })();

      /* The odds boards: the live 1X2, next goal and over / under 2.5 prices. */
      function paintSportsbookOddsBoard(model, match) {
        const markets = sportsbookRefreshMarkets(),
          suspended = sportsbookSuspended(match),
          key = sportsbook.marketsKey + '|' + suspended + '|' + match.fixture.id;
        if (key === model.key) return;
        model.key = key;
        const g = model.oddsBoard.cv.getContext('2d'),
          W = 512,
          Hh = 256;
        const grad = g.createLinearGradient(0, 0, 0, Hh);
        grad.addColorStop(0, '#0c2418');
        grad.addColorStop(1, '#050d09');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, Hh);
        g.fillStyle = '#3dff8e';
        g.fillRect(0, 0, W, 38);
        g.fillStyle = '#06140c';
        g.font = '900 italic 26px Arial';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('GOALLINE · LIVE ODDS', 14, 20);
        g.textAlign = 'right';
        g.font = '900 22px Arial';
        g.fillText(match.teams[0].short + ' v ' + match.teams[1].short, W - 14, 20);
        const rows = [
          ['result', 'MATCH RESULT'],
          ['next', 'NEXT GOAL'],
          ['total:2.5', 'OVER / UNDER 2.5'],
        ];
        rows.forEach(([id, title], i) => {
          const m = markets.find((mk) => mk.id === id || (id === 'next' && mk.kind === 'next')),
            y = 64 + i * 64;
          g.fillStyle = '#ffffff99';
          g.font = 'bold 16px Arial';
          g.textAlign = 'left';
          g.fillText(title, 14, y - 14);
          const outcomes = m ? m.outcomes : [];
          const cell = (W - 28) / Math.max(1, outcomes.length);
          outcomes.forEach((o, k) => {
            const x = 14 + k * cell;
            g.fillStyle = '#ffffff14';
            g.fillRect(x + 2, y, cell - 4, 34);
            g.fillStyle = '#e6f5ea';
            g.font = 'bold 15px Arial';
            g.textAlign = 'left';
            g.fillText(o.label.replace('OVER ', 'O ').replace('UNDER ', 'U '), x + 10, y + 17);
            g.fillStyle = '#3dff8e';
            g.font = '900 22px Arial';
            g.textAlign = 'right';
            g.fillText(o.odds ? o.odds.toFixed(2) : '—', x + cell - 10, y + 18);
          });
          if (!m) {
            g.fillStyle = '#ffffff55';
            g.font = 'bold 18px Arial';
            g.textAlign = 'left';
            g.fillText(match.abandoned ? 'VOID' : 'SETTLED', 16, y + 17);
          }
        });
        if (suspended) {
          g.fillStyle = 'rgba(12,18,14,0.82)';
          g.fillRect(0, 40, W, Hh - 40);
          g.fillStyle = '#ffd76a';
          g.font = '900 44px Arial';
          g.textAlign = 'center';
          g.fillText('SUSPENDED', W / 2, 150);
        }
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let y = 0; y < Hh; y += 3) g.fillRect(0, y, W, 1);
        model.oddsBoard.tx.needsUpdate = true;
      }
      /* Once a frame: the roof lifts off with the player inside, the screens stay live. */
      function updateSportsbookVisuals() {
        const model = sportsbookModel,
          S = SPORTSBOOK_SHOP,
          near = Math.abs(player.x - (S.x0 + S.x1) / 2) < 900 && Math.abs(player.y - (S.y0 + S.y1) / 2) < 900;
        model.roof.visible = !(near && sportsbookInside());
        if (!near) return;
        const match = sportsMatches.soccer;
        if (!match) return;
        paintSportsbookOddsBoard(model, match);
        const surface = sportsBoardSurfaces.get('soccer');
        if (surface) paintSportsBoard(surface, match);
      }
      // END SUBSYSTEM: src/sportsbook3d.js
