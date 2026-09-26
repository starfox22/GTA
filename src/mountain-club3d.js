      // BEGIN SUBSYSTEM: src/mountain-club3d.js — The 4x4 clubhouse block
      /**
       * The 4x4 clubhouse block
       * Source: src/mountain-club3d.js
       * Scope: createCityRenderer() closure, included by mountain-village3d.js
       * (it builds with that file's kit: mvBox, mvBlock, mvCyl, mvGableRoof...).
       *
       * RIDGELINE 4X4 CLUB's block in Northridge (offroad.js OFFROAD_CLUB has the
       * plan): the clubhouse, a two-storey lodge (fieldstone ground floor, log
       * upper storey, a steep shake roof with a glazed front gable, an outside
       * stone chimney), the covered veranda with the carved balcony over it and
       * the club's board above the steps; the workshop bay with its barn door
       * rolled aside; the members' yard (fire pit, log benches, Adirondack chairs,
       * the stone BBQ and a smoker, string lights); the gravel lot with its log
       * rails and the timber gate carrying the carved 4X4 CLUB sign.
       *
       * Inside (drawn always, seen when the roof lifts off): plank floor and
       * rugs, the stone fireplace with antlers over the mantel, leather couches,
       * the bar (counter, brass taps, stools, back bar with bottles and a
       * mirror), two pool tables under wagon-wheel lamps, the big TV, trail maps,
       * a tyre, a winch and number plates on the walls; the workshop's lift with
       * a rig up on it, the bench, tool chests, tyres, jerry cans and tubes.
       *
       * Four batches: the shell (always shown), the upper part (the roof, the
       * upper storey, the balcony and the front wall above 2.4 m: hidden while
       * the player is inside the clubhouse), the workshop's roof (hidden while
       * the player is in the workshop) and the interior.
       */
      const CLUBK = OFFROAD_CLUB,
        CLUBH = CLUBK.house,
        CLUBS = CLUBK.workshop,
        CLUBD = CLUBK.deck,
        CLUB_GF = 3.6 * MVU, // ground floor ceiling (the upper storey's floor)
        CLUB_EAVES = 7.2 * MVU,
        CLUB_SHOP_EAVES = 6.8 * MVU,
        CLUB_CUT = 2.4 * MVU, // the front wall is cut here while the player is inside
        clubRoot = new Three.Group(),
        clubUpperGroup = new Three.Group(),
        clubShopRoofGroup = new Three.Group();
      clubRoot.name = '4x4 club block';
      clubUpperGroup.name = '4x4 clubhouse roof and upper storey';
      clubShopRoofGroup.name = '4x4 club workshop roof';
      clubRoot.add(clubUpperGroup, clubShopRoofGroup);
      scene.add(clubRoot);
      statics.push({ x: CLUBK.lot.x + CLUBK.lot.w / 2, y: CLUBK.lot.y + CLUBK.lot.h / 2, group: clubRoot, radius: 420 });
      {
        const shell = mvBatch('club'),
          upper = mvBatch('club'),
          shopRoof = mvBatch('club'),
          inside = mvBatch('club'),
          M = MVU,
          stoneTint = '#d8d2c6',
          logTint = '#b58c62',
          stain = '#8a6440',
          dark = '#4a3524',
          lining = '#e2c49a',
          trim = '#2f4a34',
          club = {
            seed: 4487,
            finish: { stain, trim, stone: '#9a948a', boards: '#7a5a3c', flower: '#d43a3a', shutter: '#2f5a3a', roofColor: '#6e5540', roof: 'shake', walls: 'log', base: 'stone', plaster: '#efe6d2' },
          };
        mvSeed = 4487;
        const houseCx = CLUBH.x + CLUBH.w / 2,
          houseCz = CLUBH.y + CLUBH.h / 2;
        // ---- Walls: stone outside, warm boards inside; the front wall's top band is in `upper`.
        for (const w of clubWalls()) {
          const inShop = w.x >= CLUBS.x + 1 && w.x < CLUBS.x + CLUBS.w,
            front = !inShop && w.y >= CLUBH.y + CLUBH.h - CLUBK.wall - 0.5 && w.h <= CLUBK.wall + 0.5,
            top = inShop ? CLUB_SHOP_EAVES : CLUB_GF,
            outer = inShop ? 'boards' : 'stone',
            outerTint = inShop ? '#8e6a44' : stoneTint;
          if (front) {
            mvBlock(shell, outer, w.x, 0, w.y, w.x + w.w, CLUB_CUT, w.y + w.h, outerTint, 'ny');
            mvBlock(upper, outer, w.x, CLUB_CUT, w.y, w.x + w.w, CLUB_GF, w.y + w.h, outerTint, 'ny');
          } else mvBlock(shell, outer, w.x, 0, w.y, w.x + w.w, top, w.y + w.h, outerTint, 'ny');
          // The lining: a board face on the room side of each clubhouse wall.
          if (!inShop) {
            const horizontal = w.w > w.h,
              roomSide = horizontal ? (w.y + w.h / 2 < houseCz ? 1 : -1) : w.x + w.w / 2 < houseCx ? 1 : -1;
            if (horizontal) {
              const z = roomSide > 0 ? w.y + w.h + 0.05 : w.y - 0.05;
              const q = roomSide > 0 ? [mvV3(w.x, 0, z), mvV3(w.x + w.w, 0, z), mvV3(w.x + w.w, front ? CLUB_CUT : CLUB_GF, z), mvV3(w.x, front ? CLUB_CUT : CLUB_GF, z)] : [mvV3(w.x + w.w, 0, z), mvV3(w.x, 0, z), mvV3(w.x, front ? CLUB_CUT : CLUB_GF, z), mvV3(w.x + w.w, front ? CLUB_CUT : CLUB_GF, z)];
              mvQuad(inside, 'boards', q, lining);
            } else {
              const x = roomSide > 0 ? w.x + w.w + 0.05 : w.x - 0.05;
              const q = roomSide > 0 ? [mvV3(x, 0, w.y + w.h), mvV3(x, 0, w.y), mvV3(x, CLUB_GF, w.y), mvV3(x, CLUB_GF, w.y + w.h)] : [mvV3(x, 0, w.y), mvV3(x, 0, w.y + w.h), mvV3(x, CLUB_GF, w.y + w.h), mvV3(x, CLUB_GF, w.y)];
              mvQuad(inside, 'boards', q, lining);
            }
          }
        }
        // Lintels over the door gaps.
        const D = CLUBK.doors;
        mvBlock(shell, 'timber', D.front[0] - 0.3 * M, DOOR_HEIGHT, CLUBH.y + CLUBH.h - 3.4, D.front[1] + 0.3 * M, CLUB_CUT, CLUBH.y + CLUBH.h + 0.4, dark, 'ny');
        mvBlock(upper, 'stone', D.front[0], CLUB_CUT, CLUBH.y + CLUBH.h - 3, D.front[1], CLUB_GF, CLUBH.y + CLUBH.h, stoneTint, 'ny');
        mvBlock(shell, 'timber', CLUBH.x - 0.4, DOOR_HEIGHT, D.yard[0] - 0.3 * M, CLUBH.x + 3.4, DOOR_HEIGHT + 0.3 * M, D.yard[1] + 0.3 * M, dark, 'ny');
        mvBlock(shell, 'stone', CLUBH.x, DOOR_HEIGHT + 0.3 * M, D.yard[0], CLUBH.x + 3, CLUB_GF, D.yard[1], stoneTint, 'ny');
        mvBlock(shell, 'stone', CLUBS.x, DOOR_HEIGHT, D.inner[0], CLUBS.x + 3, CLUB_GF, D.inner[1], stoneTint, 'ny');
        mvBlock(shell, 'boards', D.barn[0], 5.2 * M, CLUBS.y + CLUBS.h - 3, D.barn[1], CLUB_SHOP_EAVES, CLUBS.y + CLUBS.h, '#8e6a44', 'ny');
        mvBox(shell, 'timber', (D.barn[0] + D.barn[1]) / 2, 5.1 * M, CLUBS.y + CLUBS.h + 0.3, D.barn[1] - D.barn[0] + 1.2 * M, 0.35 * M, 0.4 * M, dark);
        // The bay's door is rolled up into its drum over the opening; guide rails down the jambs.
        mvCyl(shell, 'metal', mvV3(D.barn[0] - 0.2 * M, 4.85 * M, CLUBS.y + CLUBS.h - 3 - 0.35 * M), mvV3(D.barn[1] + 0.2 * M, 4.85 * M, CLUBS.y + CLUBS.h - 3 - 0.35 * M), 0.32 * M, 10, '#8e2f26', 'iron', '#262626');
        for (const x of D.barn) mvBox(shell, 'iron', x, 2.5 * M, CLUBS.y + CLUBS.h - 3.2, 0.12 * M, 5 * M, 0.12 * M, '#262626');
        // Doors: double doors open inwards at the front (leaves against the jambs), a plank door to the yard.
        for (const side of [-1, 1]) mvBox(shell, 'timber', (side < 0 ? D.front[0] : D.front[1]) - side * 0.3 * M, DOOR_HEIGHT / 2, CLUBH.y + CLUBH.h - 3 - 0.55 * M, 0.12 * M, DOOR_HEIGHT, 1.2 * M, '#6a4a30');
        // Plinth and corner quoins.
        mvBlock(shell, 'stone', CLUBH.x - 0.12 * M, 0, CLUBH.y - 0.12 * M, CLUBS.x + CLUBS.w + 0.12 * M, 0.45 * M, CLUBH.y + 0.4, '#b8b2a6', 'ny');
        for (const [x, z] of [[CLUBH.x, CLUBH.y], [CLUBH.x, CLUBH.y + CLUBH.h]]) for (let y = 0; y < CLUB_GF - 0.4 * M; y += 0.6 * M) mvBox(shell, 'stone', x + ((y / (0.6 * M)) % 2 ? 0.4 * M : 0.2 * M), y + 0.3 * M, z + (z > CLUBH.y ? -0.2 * M : 0.2 * M), (y / (0.6 * M)) % 2 ? 0.9 * M : 0.5 * M, 0.55 * M, 0.5 * M, '#e2dccf');
        // Windows through the stone: glass on both faces, the room side seen from inside.
        const glassFaces = (x, y0, z, width, height, faces) => {
          for (const face of faces) mvCellQuad(face === 'north' || face === 'east' ? inside : shell, 'windowLit', mvFacing(x, y0, y0 + height, z + (face === 'south' ? 0.1 : face === 'north' ? -0.1 : 0), width, face), MV_WINDOW_CELL[1]);
          mvBox(shell, 'timber', x, y0 - 0.08 * M, z + 0.25 * M, width + 0.3 * M, 0.14 * M, 0.35 * M, dark);
          mvBox(shell, 'stone', x, y0 + height + 0.18 * M, z + 0.12 * M, width + 0.5 * M, 0.36 * M, 0.26 * M, '#c9c2b4');
        };
        for (const x of [CLUBH.x + 3 * M, CLUBH.x + 6.6 * M, CLUBH.x + 10.2 * M, CLUBH.x + 16 * M, CLUBH.x + 19.6 * M, CLUBH.x + 23.6 * M]) glassFaces(x, 0.9 * M, CLUBH.y + CLUBH.h, 1.2 * M, 1.4 * M, ['south']);
        for (const z of [CLUBH.y + 3 * M, CLUBH.y + 7 * M]) mvCellQuad(shell, 'windowLit', mvFacing(CLUBH.x - 0.1, 0.9 * M, 2.3 * M, z, 1.2 * M, 'west'), MV_WINDOW_CELL[1]);
        // ---- The upper storey: logs, jettied, with the floor band.
        const J = 0.15 * M,
          ux0 = CLUBH.x - J,
          uz0 = CLUBH.y - J,
          ux1 = CLUBH.x + CLUBH.w + J,
          uz1 = CLUBH.y + CLUBH.h + J;
        mvBlock(upper, 'timber', ux0 - 0.06 * M, CLUB_GF - 0.25 * M, uz0 - 0.06 * M, ux1 + 0.06 * M, CLUB_GF + 0.05 * M, uz1 + 0.06 * M, dark, '');
        mvBlock(upper, 'logs', ux0, CLUB_GF, uz0, ux1, CLUB_EAVES, uz1, logTint, 'nypy');
        mvLogCorners(upper, club, ux0, uz0, CLUBH.x + CLUBH.w, uz1, CLUB_GF, CLUB_EAVES, logTint);
        for (const x of [CLUBH.x + 2.4 * M, CLUBH.x + 5.6 * M, CLUBH.x + 21.8 * M, CLUBH.x + 25 * M]) mvWindow(upper, club, 'south', x, CLUB_GF + 0.9 * M, uz1, 1.0 * M, 1.3 * M, { cell: 0, shutters: true, flowers: true });
        for (const z of [CLUBH.y + 4 * M, CLUBH.y + 10 * M]) mvWindow(upper, club, 'west', ux0, CLUB_GF + 0.9 * M, z, 1.0 * M, 1.3 * M, { cell: 0, shutters: true });
        // Balcony doors (glazed) onto the balcony over the veranda.
        for (const x of [CLUBH.x + 9 * M, CLUBH.x + 18.5 * M]) mvCellQuad(upper, 'door', mvFacing(x, CLUB_GF, CLUB_GF + DOOR_HEIGHT, uz1 + 0.05 * M, 1.2 * M), [MV_DOOR_CELL[1][0], 0, MV_DOOR_CELL[1][1], 1], '#c9a882');
        // ---- The roof: a big gable along the block, and the glazed front gable.
        const roofFinish = ['shake', '#bda88c'],
          rise = 60,
          ridgeY = mvGableRoof(upper, ux0, uz0, ux1, uz1, 'x', CLUB_EAVES, rise, 1.4 * M, 1.2 * M, roofFinish, dark, 0, true);
        mvGables(upper, ux0, uz0, ux1, uz1, 'x', CLUB_EAVES, rise, 'logs', logTint);
        const fgW = 11 * M,
          fgX = (D.front[0] + D.front[1]) / 2,
          fgRise = 46;
        mvBlock(upper, 'logs', fgX - fgW / 2, CLUB_EAVES - 0.3 * M, uz1 - 3 * M, fgX + fgW / 2, CLUB_EAVES, uz1, logTint, 'ny');
        mvGables(upper, fgX - fgW / 2, uz1 - 7 * M, fgX + fgW / 2, uz1, 'y', CLUB_EAVES, fgRise, 'boards', '#b89a74', 'south');
        mvGableRoof(upper, fgX - fgW / 2, uz1 - 7 * M, fgX + fgW / 2, uz1, 'y', CLUB_EAVES, fgRise, 1.2 * M, 1.2 * M, roofFinish, dark);
        // Glass under the truss: three tall lights and a transom row, lit amber at night.
        for (const dx of [-2.4, 0, 2.4]) mvCellQuad(upper, 'windowLit', mvFacing(fgX + dx * M, CLUB_EAVES + 0.2 * M, CLUB_EAVES + (dx === 0 ? 3.6 : 2.4) * M, uz1 + 0.08 * M, 2.1 * M), MV_WINDOW_CELL[1]);
        mvBox(upper, 'timber', fgX, CLUB_EAVES + fgRise * 0.52, uz1 + 0.25 * M, 0.3 * M, fgRise * 0.95, 0.3 * M, dark);
        mvBox(upper, 'timber', fgX, CLUB_EAVES + 0.1 * M, uz1 + 0.25 * M, fgW, 0.3 * M, 0.3 * M, dark);
        for (const s of [-1, 1]) mvOBox(upper, 'timber', mvV3(fgX + s * fgW * 0.22, CLUB_EAVES + fgRise * 0.3, uz1 + 0.26 * M), [mvV3(s * 0.8, 0.6, 0).normalize(), mvV3(-0.6, s * 0.8, 0).normalize(), mvAZ], [fgW * 0.26, 0.14 * M, 0.14 * M], dark);
        // Dormers either side of the front gable.
        for (const dx of [-8.5, 8.5]) {
          const cx = fgX + dx * M,
            zf = uz1 - 0.4 * M;
          mvBlock(upper, 'logs', cx - 1.1 * M, CLUB_EAVES - 0.2 * M, zf - 2.6 * M, cx + 1.1 * M, CLUB_EAVES + 2 * M, zf, logTint, 'ny');
          mvWindow(upper, club, 'south', cx, CLUB_EAVES + 0.3 * M, zf, 1.1 * M, 1.2 * M, { cell: 0 });
          mvGables(upper, cx - 1.1 * M, zf - 2.6 * M, cx + 1.1 * M, zf, 'y', CLUB_EAVES + 2 * M, 1.0 * M, 'boards', '#b89a74', 'south');
          mvGableRoof(upper, cx - 1.1 * M, zf - 2.6 * M, cx + 1.1 * M, zf, 'y', CLUB_EAVES + 2 * M, 1.0 * M, 0.4 * M, 0.4 * M, roofFinish, dark);
        }
        // The outside chimney: a stone stack up the west gable, above the ridge.
        const chimney = CLUBK.furniture.find((f) => f.kind === 'chimney');
        if (chimney) {
          mvBlock(shell, 'stone', chimney.x, 0, chimney.y, chimney.x + chimney.w, CLUB_EAVES, chimney.y + chimney.h, stoneTint, 'ny');
          mvBlock(shell, 'stone', chimney.x + 1.5, CLUB_EAVES, chimney.y + chimney.h * 0.25, chimney.x + chimney.w - 0.5, ridgeY + 1.5 * M, chimney.y + chimney.h * 0.75, stoneTint, 'ny');
          mvBlock(shell, 'stone', chimney.x + 0.5, ridgeY + 1.5 * M, chimney.y + chimney.h * 0.2, chimney.x + chimney.w + 0.5, ridgeY + 1.75 * M, chimney.y + chimney.h * 0.8, '#a9a296', '');
          mvChimneys.push({ x: chimney.x + chimney.w / 2, y: ridgeY + 1.8 * M, z: chimney.y + chimney.h / 2 });
        }
        // ---- The veranda: deck, posts, rail, steps; the balcony over it.
        mvBlock(shell, 'planks', CLUBD.x, 0, CLUBD.y, CLUBD.x + CLUBD.w, 0.15 * M, CLUBD.y + CLUBD.h, '#d8b88e', 'ny');
        for (const x of clubDeckPosts()) {
          mvBlock(shell, 'stone', x - 0.35 * M, 0, CLUBD.y + CLUBD.h - 0.9 * M, x + 0.35 * M, 0.5 * M, CLUBD.y + CLUBD.h - 0.2 * M, '#b8b2a6');
          mvCyl(shell, 'logs', mvV3(x, 0.5 * M, CLUBD.y + CLUBD.h - 0.55 * M), mvV3(x, CLUB_GF - 0.25 * M, CLUBD.y + CLUBD.h - 0.55 * M), 0.2 * M, 8, '#c49a6c', 'stack', '#caa678');
        }
        for (const [x0, x1] of CLUBK.deckRail) {
          mvBox(shell, 'timber', (x0 + x1) / 2, 0.95 * M, CLUBD.y + CLUBD.h - 0.55 * M, x1 - x0, 0.14 * M, 0.14 * M, dark);
          for (let x = x0; x <= x1; x += 0.5 * M) mvBox(shell, 'timber', x, 0.55 * M, CLUBD.y + CLUBD.h - 0.55 * M, 0.08 * M, 0.8 * M, 0.08 * M, dark);
        }
        for (let k = 0; k < 2; k++) mvBlock(shell, 'planks', 8664, 0, CLUBD.y + CLUBD.h + k * 0.35 * M, 8696, 0.12 * M - k * 0.05 * M, CLUBD.y + CLUBD.h + (k + 1) * 0.35 * M, '#caa678', 'ny');
        mvBlock(upper, 'planks', CLUBD.x - 0.2 * M, CLUB_GF - 0.25 * M, CLUBD.y, CLUBD.x + CLUBD.w, CLUB_GF, CLUBD.y + CLUBD.h, '#d8b88e', '');
        mvBox(upper, 'timber', CLUBD.x + CLUBD.w / 2, CLUB_GF - 0.35 * M, CLUBD.y + CLUBD.h - 0.55 * M, CLUBD.w, 0.35 * M, 0.3 * M, dark);
        const railTop = CLUB_GF + 1.0 * M;
        mvQuad(upper, 'railing', [mvV3(CLUBD.x, CLUB_GF, CLUBD.y + CLUBD.h), mvV3(CLUBD.x + CLUBD.w, CLUB_GF, CLUBD.y + CLUBD.h), mvV3(CLUBD.x + CLUBD.w, railTop, CLUBD.y + CLUBD.h), mvV3(CLUBD.x, railTop, CLUBD.y + CLUBD.h)], '#caa06e', [[0, 0], [CLUBD.w / (2 * M), 0], [CLUBD.w / (2 * M), 1], [0, 1]], false);
        mvQuad(upper, 'railing', [mvV3(CLUBD.x, CLUB_GF, CLUBD.y), mvV3(CLUBD.x, CLUB_GF, CLUBD.y + CLUBD.h), mvV3(CLUBD.x, railTop, CLUBD.y + CLUBD.h), mvV3(CLUBD.x, railTop, CLUBD.y)], '#caa06e', [[0, 0], [CLUBD.h / (2 * M), 0], [CLUBD.h / (2 * M), 1], [0, 1]], false);
        mvBox(upper, 'timber', CLUBD.x + CLUBD.w / 2, railTop + 0.05 * M, CLUBD.y + CLUBD.h, CLUBD.w, 0.12 * M, 0.16 * M, dark);
        for (let x = CLUBD.x + 1.5 * M; x < CLUBD.x + CLUBD.w - 1 * M; x += 4.5 * M) {
          if (Math.abs(x - fgX) < 3 * M) continue;
          mvBox(upper, 'timber', x + 1.2 * M, railTop + 0.25 * M, CLUBD.y + CLUBD.h + 0.12 * M, 2.4 * M, 0.3 * M, 0.3 * M, trim);
          for (let k = 0; k < 8; k++) mvGeometry(upper, 'paint', MV_GEO.blob, x + 0.2 * M + k * 0.3 * M, railTop + 0.45 * M, CLUBD.y + CLUBD.h + 0.14 * M, 0.18 * M, 0.18 * M, 0.18 * M, k % 3 === 1 ? '#3f6a32' : '#d43a3a', k);
        }
        // The club's board over the steps, on the balcony front.
        mvSign(upper, 'RIDGELINE 4X4 CLUB', fgX, CLUB_GF + 1.6 * M, CLUBD.y + CLUBD.h + 0.3 * M, 7.2 * M);
        // Veranda furniture: Adirondack chairs, a side table, lanterns on the posts.
        for (const [u, v, a] of [[150, 172, Math.PI / 2 + 0.3], [196, 170, Math.PI / 2 - 0.4], [118, 168, Math.PI / 2]]) {
          const p = clubPoint(u, v);
          mvAdirondack(shell, p.x, p.y, a, '#4f6a4a');
        }
        mvBox(shell, 'timber', clubPoint(172, 166).x, 0.5 * M, clubPoint(172, 166).y, 0.6 * M, 0.08 * M, 0.6 * M, '#8a6a48');
        for (const x of clubDeckPosts().filter((x, i) => i % 2)) {
          mvBox(shell, 'lamp', x, CLUB_GF - 0.7 * M, CLUBD.y + CLUBD.h - 0.2 * M, 0.3 * M, 0.4 * M, 0.3 * M, '#fff0cc');
          addGlow(x, CLUB_GF - 0.8 * M, CLUBD.y + CLUBD.h, 6, '#ffcf8a', 1, { day: 0, mode: 'flicker' });
        }
        mvPool(shell, CLUBD.x + CLUBD.w / 2, CLUBD.y + CLUBD.h / 2 + 10, CLUBD.w * 0.55, '#ffc27a', 0.55);
        // ---- The workshop: board walls, a gable roof (ridge north-south), a cupola.
        const shopRise = 26,
          sx0 = CLUBS.x,
          sx1 = CLUBS.x + CLUBS.w,
          sz0 = CLUBS.y,
          sz1 = CLUBS.y + CLUBS.h,
          shopRidge = mvGableRoof(shopRoof, sx0, sz0, sx1, sz1, 'y', CLUB_SHOP_EAVES, shopRise, 0.8 * M, 0.8 * M, ['metal', '#6b2a24'], dark);
        mvGables(shopRoof, sx0, sz0, sx1, sz1, 'y', CLUB_SHOP_EAVES, shopRise, 'boards', '#8e6a44');
        mvBlock(shopRoof, 'boards', (sx0 + sx1) / 2 - 0.8 * M, shopRidge - 0.3 * M, (sz0 + sz1) / 2 - 0.8 * M, (sx0 + sx1) / 2 + 0.8 * M, shopRidge + 1.1 * M, (sz0 + sz1) / 2 + 0.8 * M, '#f1e8d2', 'ny');
        mvGableRoof(shopRoof, (sx0 + sx1) / 2 - 0.8 * M, (sz0 + sz1) / 2 - 0.8 * M, (sx0 + sx1) / 2 + 0.8 * M, (sz0 + sz1) / 2 + 0.8 * M, 'y', shopRidge + 1.1 * M, 0.7 * M, 0.25 * M, 0.25 * M, ['metal', '#6b2a24'], dark);
        mvSign(shell, 'MECHANICS', (D.barn[0] + D.barn[1]) / 2, 5.8 * M, sz1 + 0.35 * M, 3.4 * M);
        for (const z of [sz0 + 4 * M, sz0 + 10 * M]) mvCellQuad(shell, 'windowLit', mvFacing(sx1 + 0.1, 3 * M, 4.4 * M, z, 1.6 * M, 'east'), MV_WINDOW_CELL[2]);
        // A tyre stack and jerry cans by the barn door.
        for (let k = 0; k < 4; k++) mvGeometry(shell, 'paint', MV_GEO.torus, D.barn[1] + 1.6 * M, 0.3 * M + k * 0.45 * M, sz1 + 1.2 * M, 0.55 * M, 0.55 * M, 0.55 * M, '#1c1c1d', 0, Math.PI / 2);
        for (let k = 0; k < 3; k++) mvBox(shell, 'paint', D.barn[0] - 1.2 * M - k * 0.4 * M, 0.3 * M, sz1 + 0.6 * M, 0.25 * M, 0.6 * M, 0.45 * M, '#4a5a2a');
        // ---- The yard: fire pit, log benches, chairs, the BBQ, the smoker, string lights, firewood.
        const fire = CLUBK.fire;
        for (let k = 0; k < 13; k++) {
          const a = (k / 13) * TAU;
          mvGeometry(shell, 'stone', MV_GEO.rock, fire.x + Math.cos(a) * 5.4, 0.9, fire.y + Math.sin(a) * 5.4, 1.6, 1.2, 1.4, k % 2 ? '#bdb6aa' : '#a39c90', k);
        }
        mvGround(shell, 'dirt', fire.x - 5, fire.y - 5, fire.x + 5, fire.y + 5, '#3a2e24', 0.2);
        mvCyl(shell, 'ember', mvV3(fire.x, 0.2, fire.y), mvV3(fire.x, 0.6, fire.y), 3.2, 10, '#5a2a14');
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + 0.3;
          mvCyl(shell, 'logs', mvV3(fire.x + Math.cos(a) * 3, 0.6, fire.y + Math.sin(a) * 3), mvV3(fire.x - Math.cos(a) * 0.4, 2.6, fire.y - Math.sin(a) * 0.4), 0.5, 6, '#3a2a1c', 'stack', '#caa678');
        }
        addGlow(fire.x, 3, fire.y, 16, '#ff9a48', 2.4, { day: 0.2, mode: 'flicker' });
        mvPool(shell, fire.x, fire.y, 13 * M, '#ff9448', 0.7);
        for (const [du, dv, a] of [[-18, 0, 0], [16, -12, 2.2], [14, 14, -2.2]]) mvCyl(shell, 'logs', mvV3(fire.x + du - Math.sin(a) * 9, 1.8, fire.y + dv - Math.cos(a) * 9), mvV3(fire.x + du + Math.sin(a) * 9, 1.8, fire.y + dv + Math.cos(a) * 9), 1.8, 8, '#8a6a48', 'stack', '#caa678');
        mvAdirondack(shell, fire.x - 14, fire.y + 16, -0.8, '#8e2f26');
        mvAdirondack(shell, fire.x + 2, fire.y + 20, -1.4, '#2a4766');
        const g = CLUBK.grill,
          sm = CLUBK.smoker;
        mvBlock(shell, 'stone', g.x - 14, 0, g.y - 5, g.x + 14, 7.2, g.y + 5, stoneTint, 'ny');
        mvBlock(shell, 'timber', g.x - 14.5, 7.2, g.y - 5.5, g.x + 14.5, 7.8, g.y + 5.5, '#5a4430', '');
        mvBox(shell, 'iron', g.x - 4, 8.0, g.y, 10, 0.4, 7, '#222');
        mvBlock(shell, 'stone', g.x + 6, 7.8, g.y - 4, g.x + 13, 16, g.y + 3, stoneTint, 'ny');
        mvBlock(shell, 'stone', g.x + 8, 16, g.y - 2.5, g.x + 11, 22, g.y + 1, stoneTint, 'ny');
        mvCyl(shell, 'iron', mvV3(sm.x - 4, 6.5, sm.y), mvV3(sm.x + 4, 6.5, sm.y), 3, 10, '#202020', 'iron', '#202020');
        for (const dx of [-3, 3]) for (const dz of [-2, 2]) mvBox(shell, 'iron', sm.x + dx, 2.5, sm.y + dz, 0.4, 5, 0.4, '#202020');
        mvCyl(shell, 'iron', mvV3(sm.x + 3, 9, sm.y), mvV3(sm.x + 3, 15, sm.y), 0.7, 6, '#202020');
        addGlow(g.x - 4, 8.4, g.y, 5, '#ff8a3a', 1.2, { day: 0.1, mode: 'flicker' });
        // A picnic table in the yard.
        mvPicnic(shell, clubPoint(66, 78).x, clubPoint(66, 78).y);
        // Firewood against the west wall, north of the chimney.
        mvBlock(shell, 'stack', CLUBH.x - 4.5, 0, CLUBH.y + 2, CLUBH.x - 0.2, 1.5 * M, CLUBH.y + 4.6 * M, '#ffffff', 'ny');
        // String lights over the yard: eave to poles.
        const pole1 = clubPoint(8, 20),
          pole2 = clubPoint(8, 150),
          pole3 = clubPoint(96, 196);
        for (const p of [pole1, pole2, pole3]) mvCyl(shell, 'timber', mvV3(p.x, 0, p.y), mvV3(p.x, 4.6 * M, p.y), 0.12 * M, 6, '#5a4630');
        mvStringLights(shell, [[pole1.x, 4.5 * M, pole1.y], [CLUBH.x - 1, CLUB_GF - 0.2 * M, CLUBH.y + 3 * M]]);
        mvStringLights(shell, [[pole2.x, 4.5 * M, pole2.y], [CLUBH.x - 1, CLUB_GF - 0.2 * M, CLUBH.y + CLUBH.h - 3 * M]]);
        mvStringLights(shell, [[pole1.x, 4.5 * M, pole1.y], [pole2.x, 4.5 * M, pole2.y], [pole3.x, 4.5 * M, pole3.y], [CLUBD.x, CLUB_GF - 0.3 * M, CLUBD.y + CLUBD.h]]);
        // ---- The lot: gravel, wheel tracks, log rails, wheel stops, the gate and its carved sign.
        const L = CLUBK.lot;
        mvGround(shell, 'gravel', L.x, L.y + 196, L.x + L.w, L.y + L.h, '#c9bda9', 0.12);
        mvGround(shell, 'dirt', L.x + 112, L.y + 206, L.x + 140, L.y + L.h, '#b8a48a', 0.16);
        mvGround(shell, 'dirt', L.x + 112, L.y + 196, L.x + 410, L.y + 218, '#b8a48a', 0.16);
        for (const [u0, v0, u1, v1] of CLUBK.rails) {
          const a = clubPoint(u0, v0),
            b = clubPoint(u1, v1),
            length = Math.hypot(b.x - a.x, b.y - a.y),
            n = Math.max(1, Math.round(length / 22));
          mvCyl(shell, 'logs', mvV3(a.x, 3.3, a.y), mvV3(b.x, 3.3, b.y), 1.05, 7, '#a88460', 'stack', '#caa678');
          for (let k = 0; k <= n; k++) {
            const t = k / n,
              x = a.x + (b.x - a.x) * t,
              z = a.y + (b.y - a.y) * t;
            mvCyl(shell, 'logs', mvV3(x, 0, z), mvV3(x, 4.3, z), 0.95, 7, '#8a6a48', 'stack', '#caa678');
          }
        }
        for (const [u, v] of CLUBK.slots.slice(0, 5)) {
          const p = clubPoint(u, v + 30);
          mvCyl(shell, 'logs', mvV3(p.x - 9, 0.9, p.y), mvV3(p.x + 9, 0.9, p.y), 0.9, 6, '#8a6a48', 'stack', '#caa678');
        }
        const gate = CLUBK.gate,
          ga = clubPoint(gate.u0, gate.v),
          gb = clubPoint(gate.u1, gate.v),
          beamY = 6.2 * M;
        for (const p of [ga, gb]) {
          mvBlock(shell, 'stone', p.x - 4, 0, p.y - 4, p.x + 4, 1.2 * M, p.y + 4, stoneTint, 'ny');
          mvCyl(shell, 'logs', mvV3(p.x, 1.2 * M, p.y), mvV3(p.x, beamY + 0.9 * M, p.y), 2.6, 9, '#b8906a', 'stack', '#caa678');
          mvBox(shell, 'lamp', p.x, 2.6 * M, p.y + 2.8, 0.5 * M, 0.7 * M, 0.5 * M, '#fff0cc');
          addGlow(p.x, 2.6 * M, p.y + 4, 8, '#ffcf8a', 1.2, { day: 0, mode: 'flicker' });
        }
        mvCyl(shell, 'logs', mvV3(ga.x - 1.2 * M, beamY, ga.y), mvV3(gb.x + 1.2 * M, beamY, gb.y), 2.2, 9, '#a88460', 'stack', '#caa678');
        for (const s of [-1, 1]) mvOBox(shell, 'timber', mvV3((s < 0 ? ga.x : gb.x) - s * 1.1 * M, beamY - 1.0 * M, ga.y), [mvV3(-s, 1, 0).normalize(), mvV3(s, 1, 0).normalize(), mvAZ], [1.4 * M, 0.12 * M, 0.12 * M], dark);
        // The carved board hangs from the beam on chains, facing the avenue; the club's emblem stands on the beam.
        const signW = 9 * M,
          signY = beamY - 1.9 * M;
        for (const s of [-1, 1]) mvBox(shell, 'iron', (ga.x + gb.x) / 2 + s * signW * 0.38, beamY - 0.8 * M, ga.y + 0.3, 0.08 * M, 1.4 * M, 0.08 * M, '#222');
        mvBox(shell, 'timber', (ga.x + gb.x) / 2, signY, ga.y, signW + 0.4 * M, signW / 4 + 0.4 * M, 0.3 * M, '#3d2a1a');
        mvSign(shell, '4X4 CLUB', (ga.x + gb.x) / 2, signY, ga.y + 1.4, signW);
        mvSign(shell, '4X4 CLUB', (ga.x + gb.x) / 2, signY, ga.y - 1.4, signW, false, 'north');
        const emblemX = (ga.x + gb.x) / 2;
        mvGeometry(shell, 'iron', MV_GEO.torus, emblemX, beamY + 3.6 * M * 0.5 + 1, ga.y, 1.4 * M, 1.4 * M, 0.5 * M, '#7a3f22');
        mvTri(shell, 'iron', mvV3(emblemX - 1.3 * M, beamY + 1.2 * M, ga.y + 0.3), mvV3(emblemX + 1.3 * M, beamY + 1.2 * M, ga.y + 0.3), mvV3(emblemX - 0.1 * M, beamY + 3 * M, ga.y + 0.3), '#7a3f22');
        mvPool(shell, (ga.x + gb.x) / 2, ga.y + 12, 10 * M, '#ffc27a', 0.6);
        // Lamps round the lot.
        for (const [u, v] of [[210, 380], [330, 380], [420, 200]]) {
          const p = clubPoint(u, v);
          mvCyl(shell, 'logs', mvV3(p.x, 0, p.y), mvV3(p.x, 5.2 * M, p.y), 0.8, 6, '#8a6a48');
          mvBox(shell, 'iron', p.x, 5.2 * M, p.y, 1.6, 1.2, 1.6, '#1d1d1d');
          mvBox(shell, 'lamp', p.x, 4.9 * M, p.y, 1.2, 1.4, 1.2, '#fff0cc');
          addGlow(p.x, 4.8 * M, p.y, 14, '#ffd9a0', 0.9, { day: 0 });
          mvPool(shell, p.x, p.y + 6, 12 * M, '#ffd09a', 0.55);
        }
        // ---- Inside the clubhouse.
        const ix0 = CLUBH.x + 3,
          iz0 = CLUBH.y + 3,
          ix1 = CLUBS.x,
          iz1 = CLUBH.y + CLUBH.h - 3;
        mvGround(inside, 'planks', ix0, iz0, ix1, iz1, '#caa27a', 0.2);
        mvGround(inside, 'plaster', ix1 + 3, CLUBS.y + 3, CLUBS.x + CLUBS.w - 3, CLUBS.y + CLUBS.h - 3, '#8f8d88', 0.2);
        const F = (kind) => CLUBK.furniture.filter((f) => f.kind === kind);
        // Rugs.
        mvGround(inside, 'paint', clubPoint(118, 58).x, clubPoint(118, 58).y, clubPoint(160, 106).x, clubPoint(160, 106).y, '#7a2a24', 0.26);
        mvGround(inside, 'paint', clubPoint(121, 61).x, clubPoint(121, 61).y, clubPoint(157, 103).x, clubPoint(157, 103).y, '#a8743a', 0.27);
        mvGround(inside, 'paint', clubPoint(121, 64).x, clubPoint(121, 64).y, clubPoint(157, 100).x, clubPoint(157, 100).y, '#6a2420', 0.28);
        // The fireplace: stone mass, firebox, embers, mantel, antlers.
        for (const f of F('fireplace')) {
          mvBlock(inside, 'stone', f.x, 0, f.y, f.x + f.w, CLUB_GF - 0.1 * M, f.y + f.h, '#d6cfc2', 'ny');
          mvCellQuad(inside, 'paint', mvFacing(f.x + f.w + 0.05, 0.3 * M, 1.4 * M, f.y + f.h / 2, 1.4 * M, 'east'), [0, 0, 1, 1], '#140e0a');
          mvBox(inside, 'ember', f.x + f.w - 1.5, 0.4 * M, f.y + f.h / 2, 2, 0.3 * M, 1.1 * M, '#7a2a10');
          mvBox(inside, 'timber', f.x + f.w + 1, 1.8 * M, f.y + f.h / 2, 2.4, 0.25 * M, f.h + 4, '#5a3a22');
          mvBlock(inside, 'stone', f.x + f.w, 0, f.y - 3, f.x + f.w + 7, 0.25 * M, f.y + f.h + 3, '#bdb6aa', 'ny');
          addGlow(f.x + f.w + 2, 0.8 * M, f.y + f.h / 2, 9, '#ff8a3a', 1.8, { day: 0.3, mode: 'flicker' });
          mvPool(inside, f.x + f.w + 10, f.y + f.h / 2, 5 * M, '#ff9448', 0.5);
          const ax = f.x + f.w + 0.6,
            ay = 2.6 * M,
            az = f.y + f.h / 2;
          mvBox(inside, 'timber', ax, ay, az, 0.4, 0.8 * M, 0.6 * M, '#5a3a22');
          for (const s of [-1, 1])
            for (let k = 0; k < 4; k++) mvCyl(inside, 'paint', mvV3(ax + 0.5, ay + k * 0.25 * M, az + s * (0.2 + k * 0.15) * M), mvV3(ax + 1.2, ay + (k + 1) * 0.28 * M, az + s * (0.45 + k * 0.2) * M), 0.06 * M, 4, '#e8dcc0');
        }
        // Leather couches facing the fire, a log-slice table between.
        for (const f of F('couch')) {
          const leather = '#5a3222',
            along = f.w > f.h;
          mvBlock(inside, 'paint', f.x, 0, f.y, f.x + f.w, 0.45 * M, f.y + f.h, leather, 'ny');
          if (along) {
            mvBlock(inside, 'paint', f.x, 0.45 * M, f.y + f.h - 0.25 * M, f.x + f.w, 0.95 * M, f.y + f.h, leather, 'ny');
            for (const x of [f.x, f.x + f.w - 0.25 * M]) mvBlock(inside, 'paint', x, 0.45 * M, f.y, x + 0.25 * M, 0.7 * M, f.y + f.h, '#4a2a1c', 'ny');
          } else {
            mvBlock(inside, 'paint', f.x + f.w - 0.25 * M, 0.45 * M, f.y, f.x + f.w, 0.95 * M, f.y + f.h, leather, 'ny');
            for (const z of [f.y, f.y + f.h - 0.25 * M]) mvBlock(inside, 'paint', f.x, 0.45 * M, z, f.x + f.w, 0.7 * M, z + 0.25 * M, '#4a2a1c', 'ny');
          }
          for (let k = 0; k < 3; k++)
            if (along) mvBox(inside, 'paint', f.x + ((k + 0.5) * f.w) / 3, 0.52 * M, f.y + f.h / 2 - 0.1 * M, f.w / 3 - 0.3, 0.14 * M, f.h * 0.6, '#6a3a26');
            else mvBox(inside, 'paint', f.x + f.w / 2 - 0.1 * M, 0.52 * M, f.y + ((k + 0.5) * f.h) / 3, f.w * 0.6, 0.14 * M, f.h / 3 - 0.3, '#6a3a26');
        }
        const table = clubPoint(130, 80);
        mvCyl(inside, 'timber', mvV3(table.x, 0, table.y), mvV3(table.x, 0.45 * M, table.y), 0.55 * M, 12, '#a8845c', 'stack', '#d9b98c');
        mvGeometry(inside, 'glass', MV_GEO.ball, table.x + 1, 0.52 * M, table.y, 0.1 * M, 0.14 * M, 0.1 * M, '#e8b04a');
        // The bar: counter, top, footrail, taps, stools; the back bar with bottles and a mirror.
        for (const f of F('bar')) {
          mvBlock(inside, 'planks', f.x, 0, f.y, f.x + f.w, 1.05 * M, f.y + f.h, '#8a5a36', 'ny');
          mvBlock(inside, 'timber', f.x - 0.1 * M, 1.05 * M, f.y - 0.15 * M, f.x + f.w + 0.1 * M, 1.12 * M, f.y + f.h + 0.2 * M, '#4a2a18', '');
          mvCyl(inside, 'chrome', mvV3(f.x + 0.3 * M, 0.2 * M, f.y + f.h + 0.25 * M), mvV3(f.x + f.w - 0.3 * M, 0.2 * M, f.y + f.h + 0.25 * M), 0.035 * M, 6, '#c9a44a');
          for (let k = 0; k < 6; k++) {
            const x = f.x + f.w * 0.35 + k * 0.28 * M;
            mvCyl(inside, 'chrome', mvV3(x, 1.12 * M, f.y + f.h / 2), mvV3(x, 1.45 * M, f.y + f.h / 2), 0.03 * M, 6, '#c9a44a');
            mvBox(inside, 'paint', x, 1.55 * M, f.y + f.h / 2, 0.05 * M, 0.22 * M, 0.05 * M, ['#1a1a1a', '#8a2a1a', '#2a4a2a'][k % 3]);
          }
          mvBox(inside, 'chrome', f.x + f.w * 0.35 + 0.7 * M, 1.4 * M, f.y + f.h / 2, 1.8 * M, 0.08 * M, 0.08 * M, '#c9a44a');
          for (let k = 0; k < 5; k++) {
            const x = f.x + 0.6 * M + k * 2.1 * M;
            if (x > f.x + f.w - 0.5 * M) break;
            mvCyl(inside, 'chrome', mvV3(x, 0, f.y + f.h + 0.55 * M), mvV3(x, 0.75 * M, f.y + f.h + 0.55 * M), 0.04 * M, 6, '#9a9a9a');
            mvCyl(inside, 'paint', mvV3(x, 0.75 * M, f.y + f.h + 0.55 * M), mvV3(x, 0.83 * M, f.y + f.h + 0.55 * M), 0.2 * M, 10, '#5a3222');
          }
          for (let k = 0; k < 3; k++) {
            const x = f.x + f.w * (0.2 + k * 0.3);
            mvCyl(inside, 'iron', mvV3(x, CLUB_GF, f.y + f.h / 2), mvV3(x, 2.5 * M, f.y + f.h / 2), 0.02 * M, 3, '#111');
            mvCyl(inside, 'lamp', mvV3(x, 2.35 * M, f.y + f.h / 2), mvV3(x, 2.5 * M, f.y + f.h / 2), 0.16 * M, 8, '#ffe0a8');
            addGlow(x, 2.3 * M, f.y + f.h / 2, 7, '#ffd08a', 1.1, { day: 0.2 });
          }
          mvPool(inside, f.x + f.w / 2, f.y + f.h + 6, 5 * M, '#ffc27a', 0.5);
        }
        for (const f of F('backbar')) {
          mvBlock(inside, 'timber', f.x, 0, f.y, f.x + f.w, 1.0 * M, f.y + f.h, '#5a3a22', 'ny');
          mvCellQuad(inside, 'glass', mvFacing(f.x + f.w / 2, 1.3 * M, 2.4 * M, f.y + 0.3, f.w * 0.6), [0, 0, 1, 1], '#8aa0aa');
          for (const y of [1.25 * M, 1.8 * M, 2.35 * M]) {
            mvBox(inside, 'timber', f.x + f.w / 2, y, f.y + 1.5, f.w, 0.08 * M, 0.3 * M, '#4a2a18');
            for (let x = f.x + 1; x < f.x + f.w - 1; x += 1.6) {
              const tone = ['#3a6a2a', '#7a3a1a', '#c9a44a', '#2a3a5a', '#d8d0c0', '#5a1a2a'][Math.floor(mvRand() * 6)];
              mvCyl(inside, 'glass', mvV3(x, y + 0.04 * M, f.y + 1.5), mvV3(x, y + (0.3 + mvRand() * 0.12) * M, f.y + 1.5), 0.06 * M, 5, tone);
            }
          }
          addGlow(f.x + f.w * 0.8, 2.6 * M, f.y + 2, 5, '#ff4a6a', 1.6, { day: 0.3, mode: 'steady' });
        }
        // Pool tables and a wagon-wheel lamp over each.
        for (const f of F('pool')) {
          const cx = f.x + f.w / 2,
            cz = f.y + f.h / 2;
          for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mvBox(inside, 'timber', cx + dx * (f.w / 2 - 1.2), 0.35 * M, cz + dz * (f.h / 2 - 1.2), 0.2 * M, 0.7 * M, 0.2 * M, '#3a2414');
          mvBlock(inside, 'timber', f.x, 0.6 * M, f.y, f.x + f.w, 0.82 * M, f.y + f.h, '#4a2a18', 'ny');
          mvBlock(inside, 'paint', f.x + 0.9, 0.82 * M, f.y + 0.9, f.x + f.w - 0.9, 0.85 * M, f.y + f.h - 0.9, '#1f5a3a', 'ny');
          for (let k = 0; k < 9; k++) mvGeometry(inside, 'glass', MV_GEO.ball, cx - 4 + (k % 3) * 1.1 + (k > 5 ? 3 : 0), 0.88 * M, cz - 1 + Math.floor(k / 3) * 1, 0.45, 0.45, 0.45, ['#f2f0e8', '#e8c02a', '#2a4ab0', '#c82a2a', '#6a2a8a', '#e86a1a', '#1a7a3a', '#6a1a1a', '#111111'][k]);
          mvCyl(inside, 'timber', mvV3(cx - 7, 0.95 * M, cz + 3), mvV3(cx + 6, 0.93 * M, cz + 2), 0.12, 4, '#c9a06a');
          const wy = 2.9 * M;
          mvCyl(inside, 'iron', mvV3(cx, wy, cz), mvV3(cx, CLUB_GF, cz), 0.03 * M, 3, '#111');
          mvGeometry(inside, 'timber', MV_GEO.torus, cx, wy, cz, 0.7 * M, 0.7 * M, 0.28 * M, '#4a2a18', 0, Math.PI / 2);
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU;
            mvGeometry(inside, 'lamp', MV_GEO.ball, cx + Math.cos(a) * 0.7 * M, wy + 0.15 * M, cz + Math.sin(a) * 0.7 * M, 0.1 * M, 0.14 * M, 0.1 * M, '#ffe0a8');
          }
          addGlow(cx, wy - 0.2 * M, cz, 10, '#ffd49a', 1.3, { day: 0.2 });
          mvPool(inside, cx, cz, 5 * M, '#ffd49a', 0.5);
        }
        // North wall (the camera sees its inside face): the TV, trail maps, a tyre, a winch, plates.
        const wallZ = CLUBH.y + 3.1;
        const tvX = clubPoint(172, 0).x;
        mvBox(inside, 'iron', tvX, 1.9 * M, wallZ + 0.3, 2.3 * M, 1.35 * M, 0.5, '#101010');
        mvCellQuad(inside, 'sign', mvFacing(tvX, 1.9 * M - 0.6 * M, 1.9 * M + 0.6 * M, wallZ + 0.6, 2.15 * M), mvSignCells.get('4X4 CLUB · TV'));
        for (const u of [128, 146]) mvCellQuad(inside, 'map', mvFacing(clubPoint(u, 0).x, 1.4 * M, 2.4 * M, wallZ + 0.2, 1.9 * M), [0, 0, 1, 1]);
        mvCellQuad(inside, 'map', mvFacing(clubPoint(196, 0).x, 1.3 * M, 2.5 * M, wallZ + 0.2, 2.4 * M), [0, 0, 1, 1]);
        const partsX = clubPoint(236, 0).x;
        mvGeometry(inside, 'paint', MV_GEO.torus, partsX, 2.9 * M, wallZ + 0.8, 0.5 * M, 0.5 * M, 0.5 * M, '#1c1c1d');
        mvCyl(inside, 'iron', mvV3(partsX + 2.4 * M, 2.9 * M, wallZ + 0.8), mvV3(partsX + 3.3 * M, 2.9 * M, wallZ + 0.8), 0.28 * M, 10, '#b8322a', 'iron', '#222');
        for (let k = 0; k < 4; k++) mvCellQuad(inside, 'paint', mvFacing(partsX + (4.4 + k * 0.8) * M, 2.7 * M, 3.05 * M, wallZ + 0.25, 0.65 * M), [0, 0, 1, 1], ['#e8dcc0', '#f2d35a', '#c9e0f0', '#e8c0c0'][k]);
        mvGeometry(inside, 'paint', MV_GEO.torus, partsX + 8 * M, 2.6 * M, wallZ + 0.4, 0.35 * M, 0.35 * M, 0.2 * M, '#2a2a2a');
        // A string of club pennants across the room.
        mvStringLights(inside, [[CLUBH.x + 4, CLUB_GF - 0.3 * M, CLUBH.y + 6], [CLUBS.x - 4, CLUB_GF - 0.3 * M, CLUBH.y + CLUBH.h - 6]]);
        // Ceiling light over the room at night.
        mvPool(inside, houseCx, houseCz, 11 * M, '#ffcf8a', 0.35);
        // ---- The workshop inside: the lift with a rig on it, the bench, chests, tyres, tubes.
        const lifts = F('lift');
        for (const f of lifts) {
          mvBlock(inside, 'paint', f.x, 0, f.y, f.x + f.w, 3.6 * M, f.y + f.h, '#2a5aa0', 'ny');
          mvBox(inside, 'paint', f.x + f.w / 2, 1.6 * M, f.y + f.h / 2, 1.2 * M, 0.25 * M, 0.3 * M, '#e8c02a');
        }
        if (lifts.length === 2) {
          const lx = (lifts[0].x + lifts[1].x + lifts[1].w) / 2,
            lz = lifts[0].y + 2;
          // A member's rig up on the lift, wheels off: a boxy body, a roof rack, big tyres.
          const bodyY = 2.2 * M;
          mvBlock(inside, 'paint', lx - 1.0 * M, bodyY, lz - 2.2 * M, lx + 1.0 * M, bodyY + 1.0 * M, lz + 2.2 * M, '#3a5a3a', '');
          mvBlock(inside, 'paint', lx - 0.95 * M, bodyY + 1.0 * M, lz - 1.6 * M, lx + 0.95 * M, bodyY + 1.75 * M, lz + 1.0 * M, '#34503a', '');
          mvBlock(inside, 'glass', lx - 0.9 * M, bodyY + 1.05 * M, lz + 0.95 * M, lx + 0.9 * M, bodyY + 1.65 * M, lz + 1.02 * M, '#2a3a44', '');
          mvBox(inside, 'iron', lx, bodyY + 1.85 * M, lz - 0.3 * M, 1.8 * M, 0.1 * M, 2.4 * M, '#1a1a1a');
          for (const dx of [-1, 1]) for (const dz of [-1.4, 1.4]) mvGeometry(inside, 'paint', MV_GEO.torus, lx + dx * 1.0 * M, bodyY - 0.05 * M, lz + dz * M, 0.42 * M, 0.42 * M, 0.42 * M, '#161616', Math.PI / 2);
        }
        for (const f of F('bench')) {
          mvBlock(inside, 'timber', f.x, 0.9 * M, f.y, f.x + f.w, 1.0 * M, f.y + f.h, '#6a4a2a', '');
          for (const z of [f.y + 1, f.y + f.h - 1]) for (const x of [f.x + 1, f.x + f.w - 1]) mvBox(inside, 'iron', x, 0.45 * M, z, 0.12 * M, 0.9 * M, 0.12 * M, '#333');
          mvCellQuad(inside, 'paint', mvFacing(f.x + f.w - 0.2, 1.3 * M, 2.4 * M, f.y + f.h / 2, f.h * 0.8, 'west'), [0, 0, 1, 1], '#b8a070');
          mvBox(inside, 'iron', f.x + f.w * 0.3, 1.15 * M, f.y + f.h * 0.2, 0.3 * M, 0.3 * M, 0.4 * M, '#2a4a7a');
        }
        for (const f of F('chest')) {
          mvBlock(inside, 'paint', f.x, 0, f.y, f.x + f.w, 1.1 * M, f.y + f.h, '#b8262a', 'ny');
          for (let k = 0; k < 5; k++) mvBox(inside, 'chrome', f.x + f.w / 2, (0.2 + k * 0.18) * M, f.y + f.h + 0.1, f.w * 0.7, 0.04 * M, 0.08, '#c0c0c0');
        }
        for (let k = 0; k < 5; k++) mvGeometry(inside, 'paint', MV_GEO.torus, CLUBS.x + CLUBS.w - 8, 0.3 * M + k * 0.45 * M, CLUBS.y + CLUBS.h - 16, 0.55 * M, 0.55 * M, 0.55 * M, '#1c1c1d', 0, Math.PI / 2);
        for (const z of [CLUBS.y + 30, CLUBS.y + 70, CLUBS.y + 110]) {
          mvBox(inside, 'lamp', CLUBS.x + CLUBS.w / 2, CLUB_SHOP_EAVES - 0.6 * M, z, 0.25 * M, 0.1 * M, 1.6 * M, '#f0f6ff');
          addGlow(CLUBS.x + CLUBS.w / 2, CLUB_SHOP_EAVES - 0.8 * M, z, 12, '#e8f2ff', 0.7, { day: 0.2 });
          mvPool(inside, CLUBS.x + CLUBS.w / 2, z, 5 * M, '#e0eaff', 0.3);
        }
        mvFlush(shell, clubRoot, 'club');
        mvFlush(inside, clubRoot, 'club');
        mvFlush(upper, clubUpperGroup, 'club');
        mvFlush(shopRoof, clubShopRoofGroup, 'club');
      }
      // Under the roof (and the balcony): cover from the police helicopter, and the cutaway's volume.
      registerCutawayRoof(CLUBH.x + CLUBH.w / 2, CLUBH.y + CLUBH.h / 2, CLUBH.w / 2 + 2, CLUBH.h / 2 + 2, 0, CLUB_GF - 0.3 * MVU, CLUB_EAVES + 60);
      registerCutawayRoof(CLUBS.x + CLUBS.w / 2, CLUBS.y + CLUBS.h / 2, CLUBS.w / 2 + 2, CLUBS.h / 2 + 2, 0, CLUB_SHOP_EAVES - 0.2 * MVU, CLUB_SHOP_EAVES + 30);
      registerCutawayRoof(CLUBD.x + CLUBD.w / 2, CLUBD.y + CLUBD.h / 2, CLUBD.w / 2, CLUBD.h / 2, 0, CLUB_GF - 0.3 * MVU, CLUB_GF + 1.2 * MVU);
      // The clubhouse and the workshop as occluders: a player behind them keeps a hole through.
      allBuildings.push({ b: { x: CLUBH.x, y: CLUBH.y, w: CLUBH.w, h: CLUBH.h, height: CLUB_EAVES + 60 }, group: clubRoot, height: CLUB_EAVES + 60, materials: [MV_MAT.logs], tint: new Three.Color('#b58c62') });
      allBuildings.push({ b: { x: CLUBS.x, y: CLUBS.y, w: CLUBS.w, h: CLUBS.h, height: CLUB_SHOP_EAVES + 26 }, group: clubRoot, height: CLUB_SHOP_EAVES + 26, materials: [MV_MAT.boards], tint: new Three.Color('#8e6a44') });
      // An Adirondack chair: slatted seat and fan back, wide arms.
      function mvAdirondack(batch, x, z, a, color) {
        const c = Math.cos(a),
          s = Math.sin(a),
          at = (u, v) => [x + c * u - s * v, z + s * u + c * v];
        const yaw = -a;
        const [sx, sz] = at(0, 0);
        mvBox(batch, 'paint', sx, 0.38 * MVU, sz, 0.55 * MVU, 0.06 * MVU, 0.6 * MVU, color, yaw);
        const [bx, bz] = at(-0.35 * MVU, 0);
        const back = mvV3(bx, 0.75 * MVU, bz),
          lean = mvV3(-c * 0.35, 0.94, -s * 0.35).normalize(),
          side = mvV3(-s, 0, c);
        mvOBox(batch, 'paint', back, [side, lean, side.clone().cross(lean).normalize()], [0.32 * MVU, 0.45 * MVU, 0.03 * MVU], color);
        for (const v of [-0.33, 0.33]) {
          const [ax, az] = at(0.05 * MVU, v * MVU);
          mvBox(batch, 'paint', ax, 0.62 * MVU, az, 0.7 * MVU, 0.04 * MVU, 0.12 * MVU, color, yaw);
          const [lx, lz] = at(0.25 * MVU, v * MVU);
          mvBox(batch, 'paint', lx, 0.3 * MVU, lz, 0.06 * MVU, 0.6 * MVU, 0.06 * MVU, color, yaw);
        }
      }
      function mvPicnic(batch, x, z) {
        mvBox(batch, 'timber', x, 0.75 * MVU, z, 1.9 * MVU, 0.08 * MVU, 0.8 * MVU, '#a8845c');
        for (const s of [-1, 1]) mvBox(batch, 'timber', x, 0.45 * MVU, z + s * 0.75 * MVU, 1.9 * MVU, 0.06 * MVU, 0.3 * MVU, '#a8845c');
        for (const s of [-1, 1]) mvBox(batch, 'timber', x + s * 0.7 * MVU, 0.4 * MVU, z, 0.1 * MVU, 0.8 * MVU, 1.8 * MVU, '#6a5238');
      }
      /* ---- The trailhead car park where the lot used to be: gravel, rails, wheel stops, the board. ---- */
      {
        const P = TRAILHEAD_PARKING,
          batch = mvBatch('trailhead'),
          group = new Three.Group(),
          h = (x, y) => terrainHeight(x, y);
        group.name = 'Mount Ascent trailhead car park';
        scene.add(group);
        statics.push({ x: P.x + P.w / 2, y: P.y + P.h / 2, group, radius: 200 });
        const y0 = h(P.x + P.w / 2, P.y + P.h / 2);
        mvGround(batch, 'gravel', P.x, P.y, P.x + P.w, P.y + P.h, '#e8e0d2', y0 + 0.14);
        for (const [ax, az, bx, bz] of [[P.x, P.y + P.h, P.x + P.w, P.y + P.h], [P.x, P.y, P.x, P.y + P.h], [P.x + P.w, P.y, P.x + P.w, P.y + P.h]]) {
          mvCyl(batch, 'logs', mvV3(ax, y0 + 3.3, az), mvV3(bx, y0 + 3.3, bz), 1, 7, '#a88460', 'stack', '#caa678');
          const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 24));
          for (let k = 0; k <= n; k++) mvCyl(batch, 'logs', mvV3(ax + ((bx - ax) * k) / n, y0, az + ((bz - az) * k) / n), mvV3(ax + ((bx - ax) * k) / n, y0 + 4.3, az + ((bz - az) * k) / n), 0.95, 7, '#8a6a48', 'stack', '#caa678');
        }
        for (let k = 0; k < 3; k++) {
          const x = P.x + 30 + k * 40;
          mvCyl(batch, 'logs', mvV3(x - 9, y0 + 0.9, P.y + P.h - 12), mvV3(x + 9, y0 + 0.9, P.y + P.h - 12), 0.9, 6, '#8a6a48', 'stack', '#caa678');
        }
        // The trail board: two log posts, a little shake roof, the map and the name.
        const kx = P.x + P.w - 26,
          kz = P.y + 14;
        for (const s of [-1, 1]) mvCyl(batch, 'logs', mvV3(kx + s * 12, y0, kz), mvV3(kx + s * 12, y0 + 3.2 * MVU, kz), 1.1, 7, '#9a7a58', 'stack', '#caa678');
        mvBox(batch, 'timber', kx, y0 + 1.9 * MVU, kz, 22, 1.4 * MVU, 1, '#5a4430');
        mvCellQuad(batch, 'map', mvFacing(kx, y0 + 1.3 * MVU, y0 + 2.5 * MVU, kz + 0.6, 20), [0, 0, 1, 1]);
        mvGableRoof(batch, kx - 13, kz - 5, kx + 13, kz + 5, 'x', y0 + 3.2 * MVU, 0.9 * MVU, 0.3 * MVU, 0.2 * MVU, ['shake', '#bfa98e'], '#4a3a2a');
        mvSign(batch, 'MOUNT ASCENT TRAILHEAD', kx - 60, y0 + 2.2 * MVU, P.y + P.h + 4, 5.2 * MVU, false);
        for (const s of [-1, 1]) mvCyl(batch, 'logs', mvV3(kx - 60 + s * 2.4 * MVU, y0, P.y + P.h + 3), mvV3(kx - 60 + s * 2.4 * MVU, y0 + 3 * MVU, P.y + P.h + 3), 0.9, 6, '#8a6a48');
        mvFlush(batch, group);
      }
      /* ---- Per frame: the roof lifts off while the player is inside ---------------------------- */
      function clubInside(rect, margin = 0) {
        return player.x > rect.x - margin && player.x < rect.x + rect.w + margin && player.y > rect.y - margin && player.y < rect.y + rect.h + margin && (player.altitude || 0) < CLUB_GF;
      }
      function updateClubVisuals() {
        const inHouse = clubInside(CLUBH, -1),
          inShop = clubInside(CLUBS, -1);
        clubUpperGroup.visible = !inHouse;
        clubShopRoofGroup.visible = !inShop;
      }
      function clubVisualInfo() {
        let meshes = 0,
          triangles = 0;
        clubRoot.traverse((o) => {
          if (!o.isMesh) return;
          meshes++;
          triangles += o.geometry.index.count / 3;
        });
        return { meshes, triangles, upperShown: clubUpperGroup.visible, workshopRoofShown: clubShopRoofGroup.visible };
      }
      // END SUBSYSTEM: src/mountain-club3d.js
