      // A carved balcony across the street face at `y`, with flower boxes and brackets.
      function mvBalcony(batch, b, cx, y, face, width) {
        const F = b.finish,
          depth = 1.15 * MVU,
          stain = mvMix(F.stain, '#ffffff', 0.35),
          x0 = cx - width / 2,
          x1 = cx + width / 2;
        mvBlock(batch, 'planks', x0, y - 0.2 * MVU, face, x1, y, face + depth, stain, '');
        // Railing: the carved boards on three sides.
        const top = y + 1.0 * MVU;
        mvQuad(batch, 'railing', [mvV3(x0, y, face + depth), mvV3(x1, y, face + depth), mvV3(x1, top, face + depth), mvV3(x0, top, face + depth)], stain, [[0, 0], [width / (2 * MVU), 0], [width / (2 * MVU), 1], [0, 1]], false);
        for (const [x, s] of [[x0, -1], [x1, 1]]) {
          const q = s < 0 ? [mvV3(x, y, face), mvV3(x, y, face + depth), mvV3(x, top, face + depth), mvV3(x, top, face)] : [mvV3(x, y, face + depth), mvV3(x, y, face), mvV3(x, top, face), mvV3(x, top, face + depth)];
          mvQuad(batch, 'railing', q, stain, [[0, 0], [depth / (2 * MVU), 0], [depth / (2 * MVU), 1], [0, 1]], false);
        }
        mvBox(batch, 'timber', cx, top + 0.05 * MVU, face + depth, width + 0.1 * MVU, 0.12 * MVU, 0.16 * MVU, mvMix(F.stain, '#000000', 0.1));
        // Long flower box on the rail, geraniums spilling over.
        mvBox(batch, 'timber', cx, top + 0.25 * MVU, face + depth + 0.12 * MVU, width * 0.86, 0.3 * MVU, 0.3 * MVU, F.trim);
        const n = Math.round((width * 0.86) / (0.28 * MVU));
        for (let k = 0; k < n; k++) {
          const x = cx - width * 0.43 + ((k + 0.5) * width * 0.86) / n,
            r = (0.17 + mvRand() * 0.08) * MVU;
          mvGeometry(batch, 'paint', MV_GEO.blob, x, top + 0.45 * MVU, face + depth + 0.14 * MVU, r, r, r, k % 4 === 2 ? '#3f6a32' : F.flower, k);
        }
        mvBox(batch, 'paint', cx, top + 0.02 * MVU, face + depth + 0.3 * MVU, width * 0.8, 0.3 * MVU, 0.07 * MVU, '#3f6a32');
        // Brackets under it.
        const brackets = Math.max(2, Math.round(width / (2.5 * MVU)));
        for (let k = 0; k <= brackets; k++) {
          const x = x0 + 0.2 * MVU + (k * (width - 0.4 * MVU)) / brackets,
            c = mvV3(x, y - 0.6 * MVU, face + depth * 0.45),
            dir = mvV3(0, 0.62, 0.78).normalize();
          mvOBox(batch, 'timber', c, [mvAX, dir, mvAX.clone().cross(dir).normalize()], [0.08 * MVU, 0.62 * MVU, 0.08 * MVU], mvMix(F.stain, '#000000', 0.15));
        }
        // The door onto it.
        mvCellQuad(batch, 'door', mvFacing(cx, y, y + DOOR_HEIGHT, face + 0.04 * MVU, 1.1 * MVU), [MV_DOOR_CELL[1][0], 0, MV_DOOR_CELL[1][1], 1], mvMix(F.stain, '#ffffff', 0.4));
      }
      // A false front: the facade carried up square past the gable, a cornice and the name.
      function mvFalseFront(batch, b, ridgeY) {
        const F = b.finish,
          [material, color] = mvWallFinish(b, F.walls === 'log' ? 'boards' : F.walls),
          top = Math.max(ridgeY + 0.6 * MVU, b.eaves + 2.4 * MVU),
          z = b.y + b.h,
          x0 = b.x - 0.15 * MVU,
          x1 = b.x + b.w + 0.15 * MVU,
          painted = mvMix(F.boards, '#ffffff', 0.2);
        mvBlock(batch, material, x0, b.eaves - 0.2 * MVU, z - 0.1 * MVU, x1, top, z + 0.25 * MVU, material === 'logs' ? color : painted, 'ny');
        // Stepped parapet and cornice with brackets.
        mvBlock(batch, 'timber', x0 - 0.2 * MVU, top, z - 0.15 * MVU, x1 + 0.2 * MVU, top + 0.35 * MVU, z + 0.55 * MVU, F.trim, '');
        for (let k = 0; k <= 6; k++) mvBox(batch, 'timber', x0 + ((x1 - x0) * k) / 6, top - 0.25 * MVU, z + 0.4 * MVU, 0.18 * MVU, 0.5 * MVU, 0.3 * MVU, F.trim);
        mvBlock(batch, 'timber', (x0 + x1) / 2 - b.w * 0.2, top + 0.35 * MVU, z - 0.1 * MVU, (x0 + x1) / 2 + b.w * 0.2, top + 0.85 * MVU, z + 0.3 * MVU, F.trim, 'ny');
        // Pilasters at the corners.
        for (const x of [x0 + 0.15 * MVU, x1 - 0.15 * MVU]) mvBox(batch, 'timber', x, top / 2, z + 0.32 * MVU, 0.35 * MVU, top, 0.2 * MVU, F.trim);
        // Upper floor windows in the false front.
        if (b.floors >= 2)
          for (let k = 0; k < 3; k++) mvWindow(batch, b, 'south', b.x + ((k + 0.5) * b.w) / 3, b.eaves - 1.9 * MVU, z + 0.26 * MVU, 0.9 * MVU, 1.3 * MVU, { cell: 1 });
        if (b.name) mvSign(batch, b.name, (x0 + x1) / 2, (b.eaves + top) / 2 + 0.4 * MVU, z + 0.3 * MVU, Math.min(b.w * 0.86, 9 * MVU));
      }
      // A porch roof on posts over the boardwalk (or a house's front porch).
      function mvPorch(batch, b, ground) {
        const F = b.finish,
          z1 = b.y + b.h,
          depth = b.boardwalk ? b.boardwalk.h : 2 * MVU,
          width = b.boardwalk ? b.w + 0.6 * MVU : Math.min(b.w * 0.75, 7 * MVU),
          cx = b.x + b.w / 2,
          x0 = cx - width / 2,
          x1 = cx + width / 2,
          h = Math.min(ground, 3.4 * MVU),
          [roofMat, roofColor] = mvRoofFinish(b),
          post = mvMix(F.stain, '#000000', 0.1);
        if (!b.boardwalk) mvBlock(batch, 'planks', x0, 0, z1, x1, 0.3 * MVU, z1 + depth, mvMix(F.stain, '#ffffff', 0.35), 'ny');
        const posts = Math.max(2, Math.round(width / (2.6 * MVU)));
        for (let k = 0; k <= posts; k++) {
          const x = x0 + 0.15 * MVU + (k * (width - 0.3 * MVU)) / posts;
          mvBox(batch, 'timber', x, h / 2, z1 + depth - 0.2 * MVU, 0.24 * MVU, h, 0.24 * MVU, post);
          // Knee braces.
          for (const s of [-1, 1]) {
            if ((k === 0 && s < 0) || (k === posts && s > 0)) continue;
            mvOBox(batch, 'timber', mvV3(x + s * 0.3 * MVU, h - 0.35 * MVU, z1 + depth - 0.2 * MVU), [mvV3(s, 1, 0).normalize(), mvV3(-1, s, 0).normalize(), mvAZ], [0.42 * MVU, 0.06 * MVU, 0.06 * MVU], post);
          }
        }
        mvBox(batch, 'timber', cx, h + 0.1 * MVU, z1 + depth - 0.2 * MVU, width + 0.3 * MVU, 0.3 * MVU, 0.26 * MVU, post);
        // The shed roof, pitched down from the wall.
        const drop = 0.55 * MVU,
          run = depth + 0.35 * MVU,
          pitch = Math.atan2(drop, run),
          L = Math.hypot(run, drop),
          D = mvV3(0, -Math.sin(pitch), Math.cos(pitch)),
          N = mvV3(0, Math.cos(pitch), Math.sin(pitch)),
          c = mvV3(cx, h + 0.35 * MVU + drop / 2 + 0.1 * MVU, z1 + run / 2);
        mvOBox(batch, roofMat, c, [mvAX, N, D], [width / 2 + 0.25 * MVU, 0.1 * MVU, L / 2], roofColor);
        mvOBox(batch, 'timber', c.clone().addScaledVector(D, L / 2).addScaledVector(N, -0.05 * MVU), [mvAX, N, D], [width / 2 + 0.3 * MVU, 0.16 * MVU, 0.05 * MVU], F.trim);
        // House porches get a rail; shops a hitching rail at the walk's edge.
        if (!b.boardwalk)
          for (const [a, bb] of [[x0, cx - 0.8 * MVU], [cx + 0.8 * MVU, x1]]) mvBox(batch, 'timber', (a + bb) / 2, 0.95 * MVU, z1 + depth - 0.2 * MVU, bb - a, 0.12 * MVU, 0.12 * MVU, post);
        // A lantern hanging under the porch.
        addGlow(cx, h - 0.3 * MVU, z1 + depth * 0.5, 6, '#ffcf8a', 0.9, { day: 0 });
        mvBox(batch, 'lamp', cx, h - 0.35 * MVU, z1 + depth * 0.5, 0.3 * MVU, 0.4 * MVU, 0.3 * MVU, '#fff0cc');
        mvPool(batch, cx, z1 + depth * 0.6, 4 * MVU + width * 0.2, '#ffc27a', 0.5, 2.6);
      }
      // A striped awning over the shop windows (bakery, café).
      function mvAwning(batch, b) {
        const z1 = b.y + b.h,
          y = 3.1 * MVU,
          depth = 1.3 * MVU,
          x0 = b.x + 0.2 * MVU,
          x1 = b.x + b.w - 0.2 * MVU,
          w = x1 - x0;
        mvQuad(batch, 'awning', [mvV3(x0, y - 0.7 * MVU, z1 + depth), mvV3(x1, y - 0.7 * MVU, z1 + depth), mvV3(x1, y, z1), mvV3(x0, y, z1)], '#ffffff', [[0, 0], [w / (2 * MVU), 0], [w / (2 * MVU), 1], [0, 1]], false);
        mvQuad(batch, 'awning', [mvV3(x0, y - 1.0 * MVU, z1 + depth), mvV3(x1, y - 1.0 * MVU, z1 + depth), mvV3(x1, y - 0.7 * MVU, z1 + depth), mvV3(x0, y - 0.7 * MVU, z1 + depth)], '#ffffff', [[0, 0], [w / (2 * MVU), 0], [w / (2 * MVU), 0.4], [0, 0.4]], false);
        registerOverheadCover((x0 + x1) / 2, z1 + depth / 2, w / 2, depth / 2, 0, y - 0.8 * MVU, y, 'awning');
      }
      // Dormers on the south slope of a ridge-x roof.
      function mvDormers(batch, b, x0, face, x1, eaves, roofFinish, wallMat, wallColor, trim) {
        const n = b.w > 16 * MVU ? 3 : b.w > 10 * MVU ? 2 : 1,
          w = 1.8 * MVU,
          depth = 2.4 * MVU,
          h = 1.9 * MVU;
        for (let k = 0; k < n; k++) {
          const cx = x0 + ((k + 0.5) * (x1 - x0)) / n;
          if (b.kind === 'lodge' || b.kind === 'tavern') if (Math.abs(cx - (x0 + x1) / 2) < 3.5 * MVU) continue;
          const zf = face - 0.4 * MVU;
          mvBlock(batch, wallMat, cx - w / 2, eaves - 0.2 * MVU, zf - depth, cx + w / 2, eaves + h, zf, wallColor, 'ny');
          mvWindow(batch, b, 'south', cx, eaves + 0.25 * MVU, zf, 1.0 * MVU, 1.2 * MVU, { cell: 0 });
          mvGables(batch, cx - w / 2, zf - depth, cx + w / 2, zf, 'y', eaves + h, 0.9 * MVU, wallMat, wallColor, 'south');
          mvGableRoof(batch, cx - w / 2, zf - depth, cx + w / 2, zf, 'y', eaves + h, 0.9 * MVU, 0.35 * MVU, 0.35 * MVU, roofFinish, trim, b.snow);
        }
      }
      // A front gable on the street face of a long building (lodge, tavern).
      function mvCrossGable(batch, b, eaves, ridgeY, roofFinish, wallMat, wallColor, trim) {
        const w = Math.min(b.w * 0.36, 8 * MVU),
          cx = b.door.x,
          z1 = b.y + b.h,
          proj = 1.3 * MVU,
          rise = Math.min((w / 2) * Math.tan((48 * Math.PI) / 180), ridgeY - eaves - 0.3 * MVU),
          z0 = b.y + b.h * 0.35;
        mvBlock(batch, wallMat, cx - w / 2, 0.6 * MVU, z1 - 0.2 * MVU, cx + w / 2, eaves, z1 + proj, wallColor, 'ny');
        mvBlock(batch, 'stone', cx - w / 2 - 0.1 * MVU, 0, z1, cx + w / 2 + 0.1 * MVU, 0.6 * MVU, z1 + proj + 0.1 * MVU, mvMix(b.finish.stone, '#ffffff', 0.2));
        mvGables(batch, cx - w / 2, z0, cx + w / 2, z1 + proj, 'y', eaves, rise, 'boards', mvMix(b.finish.stain, '#ffffff', 0.3), 'south');
        // A big glazed gable (the lodge look): mullioned lights under the apex.
        mvWindow(batch, b, 'south', cx, eaves + 0.3 * MVU, z1 + proj, w * 0.42, Math.min(rise * 0.55, 2.6 * MVU), { cell: 1, lit: true });
        mvGableRoof(batch, cx - w / 2, z0, cx + w / 2, z1 + proj, 'y', eaves, rise, 0.9 * MVU, 0.9 * MVU, roofFinish, trim, b.snow);
        // King post and collar ties in the gable.
        mvBox(batch, 'timber', cx, eaves + rise * 0.55, z1 + proj + 0.15 * MVU, 0.24 * MVU, rise * 0.9, 0.2 * MVU, trim);
        mvBox(batch, 'timber', cx, eaves + rise * 0.28, z1 + proj + 0.15 * MVU, w * 0.62, 0.22 * MVU, 0.2 * MVU, trim);
        // Windows either side of the door on the projection.
        for (const side of [-1, 1]) mvWindow(batch, b, 'south', cx + side * w * 0.3, 1.2 * MVU, z1 + proj, 1.0 * MVU, 1.4 * MVU, { cell: 1 });
        // Upper windows over the name board (the first upper floor carries the board).
        for (let f = 2; f < b.floors; f++) mvWindow(batch, b, 'south', cx, (MOUNTAIN_KINDS[b.kind].ground + (f - 1) * MOUNTAIN_KINDS[b.kind].upper + 0.8) * MVU, z1 + proj, 1.1 * MVU, 1.25 * MVU, { cell: 1, flowers: true, shutters: true });
        // The door is on the projection's face.
        mvDoor(batch, b, cx, z1 + proj, 2, 2 * MVU);
      }
      // The chapel's steeple over the street gable: tower, belfry, spire and cross.
      function mvSteeple(batch, b, ridgeY, roofFinish, trim) {
        const cx = b.x + b.w / 2,
          zc = b.y + b.h - 2.2 * MVU,
          s = 3.2 * MVU,
          towerTop = ridgeY + 2.6 * MVU,
          white = mvMix(b.finish.boards, '#ffffff', 0.7);
        mvBlock(batch, 'boards', cx - s / 2, ridgeY - 3 * MVU, zc - s / 2, cx + s / 2, towerTop, zc + s / 2, white, 'ny');
        // Belfry: louvred openings and a bell.
        for (const face of ['south', 'east', 'west']) {
          const x = face === 'south' ? cx : face === 'east' ? cx + s / 2 : cx - s / 2,
            z = face === 'south' ? zc + s / 2 : zc;
          mvCellQuad(batch, 'shutter', mvFacing(x + (face === 'east' ? 0.05 * MVU : face === 'west' ? -0.05 * MVU : 0), towerTop - 2.2 * MVU, towerTop - 0.4 * MVU, z + (face === 'south' ? 0.05 * MVU : 0), 1.4 * MVU, face), [0, 0, 1, 1], '#5a4a3a');
        }
        mvBlock(batch, 'timber', cx - s / 2 - 0.2 * MVU, towerTop, zc - s / 2 - 0.2 * MVU, cx + s / 2 + 0.2 * MVU, towerTop + 0.3 * MVU, zc + s / 2 + 0.2 * MVU, trim, '');
        // Spire: a tall four-sided pyramid.
        const h = 7 * MVU,
          apex = mvV3(cx, towerTop + 0.3 * MVU + h, zc),
          [material, color] = roofFinish,
          e = s / 2 + 0.25 * MVU,
          y = towerTop + 0.3 * MVU,
          corners = [mvV3(cx - e, y, zc + e), mvV3(cx + e, y, zc + e), mvV3(cx + e, y, zc - e), mvV3(cx - e, y, zc - e)];
        for (let k = 0; k < 4; k++) mvTri(batch, material, corners[k], corners[(k + 1) % 4], apex, color);
        // The cross, and the round window in the gable below it.
        mvBox(batch, 'iron', cx, apex.y + 1.1 * MVU, zc, 0.16 * MVU, 2.2 * MVU, 0.16 * MVU, '#2a2a2a');
        mvBox(batch, 'iron', cx, apex.y + 1.5 * MVU, zc, 1.1 * MVU, 0.16 * MVU, 0.16 * MVU, '#2a2a2a');
        mvWindow(batch, b, 'south', cx, b.eaves + 0.6 * MVU, b.y + b.h, 1.6 * MVU, 1.8 * MVU, { cell: 3, lit: true });
        // Tall lancet windows down the side walls.
        for (let k = 0; k < 3; k++) {
          const z = b.y + ((k + 0.5) * b.h) / 3;
          mvWindow(batch, b, 'east', b.x + b.w, 1.2 * MVU, z, 1.1 * MVU, 3.2 * MVU, { cell: 3, lit: true });
          mvWindow(batch, b, 'west', b.x, 1.2 * MVU, z, 1.1 * MVU, 3.2 * MVU, { cell: 3, lit: true });
        }
      }
      // The motel's run of rooms: a door and a window per room along the porch, numbers, the office sign.
      function mvMotelFront(batch, b, dark) {
        const long = b.ridge !== 'y',
          F = b.finish,
          rooms = Math.floor((long ? b.w : b.h) / (3.6 * MVU));
        for (let k = 0; k < rooms; k++) {
          const t = (k + 0.5) / rooms;
          if (long) {
            const x = b.x + b.w * t;
            mvDoor(batch, b, x - 0.8 * MVU, b.y + b.h, 0);
            mvWindow(batch, b, 'south', x + 0.9 * MVU, 1.0 * MVU, b.y + b.h, 1.1 * MVU, 1.2 * MVU, { cell: 0, flowers: k % 2 === 0 });
          } else {
            const z = b.y + b.h * t;
            mvWindow(batch, b, 'east', b.x + b.w, 1.0 * MVU, z, 1.1 * MVU, 1.2 * MVU, { cell: 0 });
          }
        }
        // A porch along the whole run.
        const z1 = b.y + b.h,
          depth = 1.9 * MVU,
          h = 2.9 * MVU,
          [roofMat, roofColor] = mvRoofFinish(b);
        if (long) {
          mvBlock(batch, 'planks', b.x, 0, z1, b.x + b.w, 0.25 * MVU, z1 + depth, mvMix(F.stain, '#ffffff', 0.35), 'ny');
          for (let x = b.x + 0.2 * MVU; x <= b.x + b.w; x += 3.6 * MVU) mvBox(batch, 'timber', x, h / 2, z1 + depth - 0.2 * MVU, 0.22 * MVU, h, 0.22 * MVU, dark);
          const pitch = 0.16;
          mvOBox(batch, roofMat, mvV3(b.x + b.w / 2, h + 0.35 * MVU, z1 + depth / 2), [mvAX, mvV3(0, Math.cos(pitch), Math.sin(pitch)), mvV3(0, -Math.sin(pitch), Math.cos(pitch))], [b.w / 2 + 0.3 * MVU, 0.1 * MVU, depth / 2 + 0.3 * MVU], roofColor);
          for (let x = b.x + 1.8 * MVU; x < b.x + b.w; x += 7.2 * MVU) {
            addGlow(x, h - 0.3 * MVU, z1 + depth * 0.5, 5, '#ffd08a', 0.9, { day: 0 });
            mvPool(batch, x, z1 + depth, 3.5 * MVU, '#ffc27a', 0.4);
          }
          if (b.name) {
            mvSign(batch, b.name, b.x + b.w * 0.5, h + 1.7 * MVU, z1 + depth + 0.1 * MVU, 7.5 * MVU);
            mvSign(batch, 'VACANCY', b.x + b.w * 0.5 + 5.2 * MVU, h + 1.0 * MVU, z1 + depth + 0.15 * MVU, 2.6 * MVU, false);
          }
        }
      }
      // A barn front: the big X-braced door, the hay-loft door in the gable, a cupola.
      function mvBarnFront(batch, b, ridgeY, roofFinish) {
        const z1 = b.y + b.h,
          cx = b.x + b.w / 2,
          w = Math.min(4.2 * MVU, b.w * 0.4);
        mvCellQuad(batch, 'door', mvFacing(cx, 0.1 * MVU, 4 * MVU, z1 + 0.06 * MVU, w), [MV_DOOR_CELL[3][0], 0, MV_DOOR_CELL[3][1], 1], '#b04a3a');
        mvCellQuad(batch, 'door', mvFacing(cx, b.eaves + 0.3 * MVU, b.eaves + 2.1 * MVU, z1 + 0.06 * MVU, 1.8 * MVU), [MV_DOOR_CELL[3][0], 0, MV_DOOR_CELL[3][1], 1], '#b04a3a');
        mvBox(batch, 'iron', cx, 4.3 * MVU, z1 + 0.2 * MVU, w * 2.1, 0.2 * MVU, 0.2 * MVU, '#2a2a2a');
        const [material, color] = roofFinish;
        mvBlock(batch, 'boards', cx - 0.9 * MVU, ridgeY - 0.4 * MVU, b.y + b.h / 2 - 0.9 * MVU, cx + 0.9 * MVU, ridgeY + 1.3 * MVU, b.y + b.h / 2 + 0.9 * MVU, '#f1e8d2', 'ny');
        mvGableRoof(batch, cx - 0.9 * MVU, b.y + b.h / 2 - 0.9 * MVU, cx + 0.9 * MVU, b.y + b.h / 2 + 0.9 * MVU, 'y', ridgeY + 1.3 * MVU, 0.8 * MVU, 0.25 * MVU, 0.25 * MVU, [material, color], '#3a2a1e');
        if (b.name) mvSign(batch, b.name, cx, 5.4 * MVU, z1 + 0.12 * MVU, Math.min(b.w * 0.7, 8 * MVU));
      }
      // The rescue barn's two bay doors.
      function mvBayDoors(batch, b) {
        const z1 = b.y + b.h;
        for (const t of [0.3, 0.7]) {
          const x = b.x + b.w * t;
          mvCellQuad(batch, 'door', mvFacing(x, 0.1 * MVU, 4.2 * MVU, z1 + 0.06 * MVU, 4 * MVU), [MV_DOOR_CELL[4][0], 0, MV_DOOR_CELL[4][1], 1], '#c9c2b2');
          mvBox(batch, 'timber', x, 4.4 * MVU, z1 + 0.15 * MVU, 4.4 * MVU, 0.3 * MVU, 0.3 * MVU, b.finish.trim);
          addGlow(x, 4.8 * MVU, z1 + 0.5 * MVU, 7, '#ffe6b8', 1, { day: 0 });
          mvPool(batch, x, z1 + 3 * MVU, 5 * MVU, '#ffe0b0', 0.45);
        }
        if (b.name) mvSign(batch, b.name, b.x + b.w / 2, 5.0 * MVU, z1 + 0.14 * MVU, Math.min(b.w * 0.6, 7 * MVU));
      }
      function mvFlagpole(batch, x, z, h) {
        mvCyl(batch, 'chrome', mvV3(x, 0, z), mvV3(x, h, z), 0.09 * MVU, 8, '#dcdcdc');
        mvGeometry(batch, 'chrome', MV_GEO.ball, x, h + 0.15 * MVU, z, 0.2 * MVU, 0.2 * MVU, 0.2 * MVU, '#d9b44a');
        // A county flag, hanging still (the club's flag is the one that flies).
        mvBox(batch, 'paint', x + 0.9 * MVU, h - 0.8 * MVU, z, 1.8 * MVU, 1.1 * MVU, 0.04 * MVU, '#2f5a3a');
        mvBox(batch, 'paint', x + 0.9 * MVU, h - 0.8 * MVU, z + 0.03 * MVU, 0.9 * MVU, 0.5 * MVU, 0.02 * MVU, '#e8dcc0');
        mvBlock(batch, 'stone', x - 0.5 * MVU, 0, z - 0.5 * MVU, x + 0.5 * MVU, 0.4 * MVU, z + 0.5 * MVU, '#b8b2a6');
      }
      // The tavern's front deck: planks, rail, picnic tables, and the string lights over it.
      function mvTavernDeck(batch, b) {
        const D = b.options.deck,
          blockX = b.x - 70,
          blockY = b.y - 200,
          x0 = blockX + D.x,
          z0 = blockY + D.y,
          x1 = x0 + D.w,
          z1 = z0 + D.h,
          stain = mvMix(b.finish.stain, '#ffffff', 0.35);
        mvBlock(batch, 'planks', x0, 0, z0, x1, 0.35 * MVU, z1, stain, 'ny');
        for (const [a, bb] of [[x0, b.door.x - 1.4 * MVU], [b.door.x + 1.4 * MVU, x1]]) {
          mvBox(batch, 'timber', (a + bb) / 2, 1.0 * MVU, z1 - 0.15 * MVU, bb - a, 0.14 * MVU, 0.14 * MVU, mvMix(b.finish.stain, '#000000', 0.1));
          for (let x = a; x <= bb; x += 1.8 * MVU) mvBox(batch, 'timber', x, 0.55 * MVU, z1 - 0.15 * MVU, 0.14 * MVU, 1.0 * MVU, 0.14 * MVU, mvMix(b.finish.stain, '#000000', 0.1));
        }
        mvBox(batch, 'timber', x1 - 0.15 * MVU, 1.0 * MVU, (z0 + z1) / 2, 0.14 * MVU, 0.14 * MVU, z1 - z0, mvMix(b.finish.stain, '#000000', 0.1));
        // Picnic tables with benches, a keg umbrella-less look.
        const tables = Math.floor((x1 - x0) / (4.2 * MVU));
        for (let k = 0; k < tables; k++) {
          const x = x0 + (k + 0.5) * ((x1 - x0) / tables);
          if (Math.abs(x - b.door.x) < 2 * MVU) continue;
          const z = (z0 + z1) / 2 + 0.2 * MVU;
          mvBox(batch, 'timber', x, 0.35 * MVU + 0.75 * MVU, z, 1.9 * MVU, 0.08 * MVU, 0.8 * MVU, stain);
          for (const s of [-1, 1]) mvBox(batch, 'timber', x, 0.35 * MVU + 0.45 * MVU, z + s * 0.75 * MVU, 1.9 * MVU, 0.06 * MVU, 0.3 * MVU, stain);
          for (const s of [-1, 1]) mvBox(batch, 'timber', x + s * 0.7 * MVU, 0.35 * MVU + 0.4 * MVU, z, 0.1 * MVU, 0.8 * MVU, 1.8 * MVU, mvMix(b.finish.stain, '#000000', 0.1));
          mvGeometry(batch, 'glass', MV_GEO.ball, x - 0.3 * MVU, 0.35 * MVU + 0.9 * MVU, z, 0.09 * MVU, 0.14 * MVU, 0.09 * MVU, '#e8b04a');
        }
        // String lights on poles at the deck's corners, sagging towards the tavern.
        const poles = [[x0 + 0.3 * MVU, z1 - 0.3 * MVU], [x1 - 0.3 * MVU, z1 - 0.3 * MVU], [(x0 + x1) / 2, z1 - 0.3 * MVU]];
        for (const [px, pz] of poles) mvCyl(batch, 'timber', mvV3(px, 0, pz), mvV3(px, 4.2 * MVU, pz), 0.1 * MVU, 6, mvMix(b.finish.stain, '#000000', 0.2));
        const eave = b.eaves - 0.2 * MVU;
        mvStringLights(batch, [[poles[0][0], 4.1 * MVU, poles[0][1]], [b.x + 1 * MVU, eave, b.y + b.h + 0.4 * MVU]]);
        mvStringLights(batch, [[poles[2][0], 4.1 * MVU, poles[2][1]], [b.x + b.w / 2, eave, b.y + b.h + 0.4 * MVU]]);
        mvStringLights(batch, [[poles[1][0], 4.1 * MVU, poles[1][1]], [b.x + b.w - 1 * MVU, eave, b.y + b.h + 0.4 * MVU]]);
        mvStringLights(batch, [[poles[0][0], 4.1 * MVU, poles[0][1]], [poles[2][0], 4.1 * MVU, poles[2][1]], [poles[1][0], 4.1 * MVU, poles[1][1]]]);
        mvPool(batch, (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) * 0.55, '#ffcf8a', 0.55);
      }
      // Festoon lights along a polyline of [x, y, z] points: a sagging wire and a bulb every 1.4 m.
      function mvStringLights(batch, points) {
        for (let i = 1; i < points.length; i++) {
          const [ax, ay, az] = points[i - 1],
            [bx, by, bz] = points[i],
            length = Math.hypot(bx - ax, bz - az),
            n = Math.max(2, Math.round(length / (1.4 * MVU))),
            sag = length * 0.07;
          let prev = mvV3(ax, ay, az);
          for (let k = 1; k <= n; k++) {
            const t = k / n,
              p = mvV3(ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * sag, az + (bz - az) * t);
            mvCyl(batch, 'iron', prev, p, 0.03 * MVU, 3, '#1a1a1a');
            if (k < n) {
              mvGeometry(batch, 'lamp', MV_GEO.ball, p.x, p.y - 0.12 * MVU, p.z, 0.09 * MVU, 0.12 * MVU, 0.09 * MVU, k % 3 ? '#fff0c8' : '#ffd0a0');
              if (k % 2 === 0) addGlow(p.x, p.y - 0.15 * MVU, p.z, 3.2, k % 3 ? '#ffd9a0' : '#ffb27a', 1.2, { day: 0, mode: 'steady' });
            }
            prev = p;
          }
        }
      }
      // The fire lookout: four braced legs, a stair, the glazed cab with a catwalk and a hipped roof.
      function mvLookout(batch, b) {
        const cx = b.x + b.w / 2,
          cz = b.y + b.h / 2,
          top = b.eaves,
          leg = b.w / 2 - 0.3 * MVU,
          cabHalf = 2.2 * MVU,
          wood = mvMix(b.finish.stain, '#000000', 0.1);
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mvCyl(batch, 'timber', mvV3(cx + sx * leg, 0, cz + sz * leg), mvV3(cx + sx * cabHalf * 0.8, top, cz + sz * cabHalf * 0.8), 0.16 * MVU, 6, wood, 'timber', wood);
        for (let y = 2.5 * MVU; y < top; y += 2.8 * MVU) {
          const f = 1 - y / top,
            e = cabHalf * 0.8 + (leg - cabHalf * 0.8) * f;
          for (const [a, bb] of [[[-1, -1], [1, 1]], [[1, -1], [-1, 1]], [[-1, 1], [1, 1]], [[-1, -1], [1, -1]]]) {
            if (a[1] === bb[1]) mvCyl(batch, 'timber', mvV3(cx + a[0] * e, y, cz + a[1] * e), mvV3(cx + bb[0] * e, y, cz + bb[1] * e), 0.07 * MVU, 4, wood);
          }
          mvCyl(batch, 'timber', mvV3(cx - e, y, cz + e), mvV3(cx + e, y + 2.8 * MVU, cz + e), 0.06 * MVU, 4, wood);
        }
        // Cab, catwalk, roof.
        mvBlock(batch, 'planks', cx - cabHalf - 0.8 * MVU, top - 0.25 * MVU, cz - cabHalf - 0.8 * MVU, cx + cabHalf + 0.8 * MVU, top, cz + cabHalf + 0.8 * MVU, wood, '');
        mvBlock(batch, 'boards', cx - cabHalf, top, cz - cabHalf, cx + cabHalf, top + 1.0 * MVU, cz + cabHalf, b.finish.boards, 'ny');
        for (const face of ['south', 'east', 'west', 'north'])
          for (const t of [-0.5, 0.5]) {
            const off = face === 'south' ? [cx + t * cabHalf, cz + cabHalf] : face === 'north' ? [cx + t * cabHalf, cz - cabHalf] : face === 'east' ? [cx + cabHalf, cz + t * cabHalf] : [cx - cabHalf, cz + t * cabHalf];
            mvCellQuad(batch, 'windowDark', mvFacing(off[0], top + 1.0 * MVU, top + 2.4 * MVU, off[1], cabHalf * 0.95, face), MV_WINDOW_CELL[0]);
          }
        const roofY = top + 2.5 * MVU,
          e = cabHalf + 0.5 * MVU,
          apex = mvV3(cx, roofY + 1.4 * MVU, cz),
          corners = [mvV3(cx - e, roofY, cz + e), mvV3(cx + e, roofY, cz + e), mvV3(cx + e, roofY, cz - e), mvV3(cx - e, roofY, cz - e)];
        for (let k = 0; k < 4; k++) mvTri(batch, 'metal', corners[k], corners[(k + 1) % 4], apex, b.finish.roofColor);
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mvBox(batch, 'timber', cx + sx * cabHalf, top + 1.75 * MVU, cz + sz * cabHalf, 0.15 * MVU, 1.5 * MVU, 0.15 * MVU, wood);
        // Catwalk rail.
        const r = cabHalf + 0.75 * MVU;
        for (const [ax, az, bx2, bz2] of [[-r, r, r, r], [r, -r, r, r], [-r, -r, -r, r], [-r, -r, r, -r]]) mvCyl(batch, 'timber', mvV3(cx + ax, top + 1.0 * MVU, cz + az), mvV3(cx + bx2, top + 1.0 * MVU, cz + bz2), 0.05 * MVU, 4, wood);
        mvCyl(batch, 'iron', mvV3(cx, apex.y, cz), mvV3(cx, apex.y + 1.6 * MVU, cz), 0.04 * MVU, 4, '#333');
        addGlow(cx, apex.y + 1.6 * MVU, cz, 4, '#ff4a3a', 1.6, { day: 0, mode: 'flicker' });
      }
      // An open-sided shed on posts (the sawmill, a woodshed): roof, a back wall, what is inside.
      function mvOpenShed(batch, b) {
        const F = b.finish,
          x0 = b.x,
          z0 = b.y,
          x1 = b.x + b.w,
          z1 = b.y + b.h,
          eaves = b.eaves,
          wood = mvMix(F.stain, '#000000', 0.1),
          roofFinish = mvRoofFinish(b),
          axis = b.ridge === 'y' ? 'y' : 'x';
        // Posts round the edge.
        const nx = Math.max(2, Math.round(b.w / (4 * MVU))),
          nz = Math.max(1, Math.round(b.h / (4 * MVU)));
        for (let i = 0; i <= nx; i++)
          for (const z of [z0 + 0.2 * MVU, z1 - 0.2 * MVU]) mvBox(batch, 'timber', x0 + 0.2 * MVU + (i * (b.w - 0.4 * MVU)) / nx, eaves / 2, z, 0.3 * MVU, eaves, 0.3 * MVU, wood);
        for (let j = 1; j < nz; j++) for (const x of [x0 + 0.2 * MVU, x1 - 0.2 * MVU]) mvBox(batch, 'timber', x, eaves / 2, z0 + (j * b.h) / nz, 0.3 * MVU, eaves, 0.3 * MVU, wood);
        // Back (north) wall in boards, beams along the eaves.
        mvBlock(batch, 'boards', x0, 0, z0, x1, eaves, z0 + 0.25 * MVU, F.boards);
        for (const z of [z0 + 0.2 * MVU, z1 - 0.2 * MVU]) mvBox(batch, 'timber', (x0 + x1) / 2, eaves - 0.2 * MVU, z, b.w, 0.4 * MVU, 0.3 * MVU, wood);
        mvGables(batch, x0, z0, x1, z1, axis, eaves, b.rise, 'boards', F.boards);
        mvGableRoof(batch, x0, z0, x1, z1, axis, eaves, b.rise, MOUNTAIN_KINDS[b.kind].overhang * MVU, 0.8 * MVU, roofFinish, wood, b.snow);
        if (b.kind === 'woodshed') {
          mvBlock(batch, 'stack', x0 + 0.4 * MVU, 0, z0 + 0.4 * MVU, x1 - 0.4 * MVU, eaves * 0.75, z1 - 1.2 * MVU, '#ffffff', 'ny');
          return;
        }
        // The sawmill inside: the carriage track, a log on the carriage, the head saw, sawdust, lumber.
        const trackZ = (z0 + z1) / 2;
        mvBox(batch, 'iron', (x0 + x1) / 2, 0.4 * MVU, trackZ, b.w * 0.8, 0.8 * MVU, 1.4 * MVU, '#4a4a48');
        mvCyl(batch, 'logs', mvV3(x0 + b.w * 0.2, 1.4 * MVU, trackZ), mvV3(x0 + b.w * 0.55, 1.4 * MVU, trackZ), 0.4 * MVU, 9, mvMix(F.stain, '#ffffff', 0.2), 'stack', '#caa678');
        mvBox(batch, 'iron', x0 + b.w * 0.62, 2.2 * MVU, trackZ, 1.2 * MVU, 4.4 * MVU, 2.6 * MVU, '#6a6f73');
        mvCyl(batch, 'chrome', mvV3(x0 + b.w * 0.62, 2.2 * MVU, trackZ - 0.2 * MVU), mvV3(x0 + b.w * 0.62, 2.2 * MVU, trackZ + 0.2 * MVU), 1.5 * MVU, 16, '#c9cdd0');
        mvGeometry(batch, 'paint', MV_GEO.cone, x0 + b.w * 0.75, 0.9 * MVU, z1 - 3 * MVU, 2.2 * MVU, 1.8 * MVU, 2.2 * MVU, '#d9b88a');
        for (let k = 0; k < 3; k++) mvBlock(batch, 'planks', x0 + b.w * 0.78 + k * 0.1 * MVU, 0, z0 + 2 * MVU + k * 2.2 * MVU, x0 + b.w * 0.95, (0.8 + k * 0.3) * MVU, z0 + 3.6 * MVU + k * 2.2 * MVU, '#e2c89e');
        for (let x = x0 + 4 * MVU; x < x1 - 2 * MVU; x += 8 * MVU) {
          addGlow(x, eaves - 0.8 * MVU, trackZ, 8, '#fff0d8', 0.8, { day: 0 });
          mvPool(batch, x, trackZ, 5 * MVU, '#ffe8c8', 0.35);
        }
        if (b.name) mvSign(batch, b.name, (x0 + x1) / 2, eaves + b.rise * 0.45, z1 + MOUNTAIN_KINDS[b.kind].overhang * MVU * 0.5 + 0.3 * MVU, Math.min(b.w * 0.5, 10 * MVU));
      }
      /* ---- Street dressing ------------------------------------------------------------------ */
      function mvBoardwalk(batch, w) {
        const b = w.building,
          stain = mvMix(b.finish.stain, '#ffffff', 0.4);
        mvBlock(batch, 'planks', w.x, 0, w.y, w.x + w.w, 0.28 * MVU, w.y + w.h, stain, 'ny');
        // Edge beam and a step down at the front.
        mvBox(batch, 'timber', w.x + w.w / 2, 0.14 * MVU, w.y + w.h + 0.12 * MVU, w.w, 0.28 * MVU, 0.24 * MVU, mvMix(b.finish.stain, '#000000', 0.2));
      }
      function mvFence(batch, f) {
        const length = Math.hypot(f.x1 - f.x0, f.y1 - f.y0),
          n = Math.max(1, Math.round(length / (2.6 * MVU))),
          wood = '#8a7458';
        for (let k = 0; k <= n; k++) {
          const t = k / n,
            x = f.x0 + (f.x1 - f.x0) * t,
            z = f.y0 + (f.y1 - f.y0) * t;
          mvCyl(batch, 'timber', mvV3(x, 0, z), mvV3(x, 1.2 * MVU, z), 0.09 * MVU, 5, wood);
        }
        for (const y of [0.55 * MVU, 1.0 * MVU]) mvCyl(batch, 'timber', mvV3(f.x0, y, f.y0), mvV3(f.x1, y, f.y1), 0.06 * MVU, 5, '#9a8466');
      }
      function mvFirewood(batch, f) {
        mvBlock(batch, 'stack', f.x - f.w / 2, 0, f.y, f.x + f.w / 2, f.height, f.y + f.h, '#ffffff', 'ny');
        mvBox(batch, 'metal', f.x, f.height + 0.08 * MVU, f.y + f.h / 2, f.w + 0.3 * MVU, 0.08 * MVU, f.h + 0.3 * MVU, '#5a5a5a');
      }
      function mvPlanter(batch, p) {
        mvCyl(batch, 'timber', mvV3(p.x, 0, p.y), mvV3(p.x, 0.55 * MVU, p.y), 0.42 * MVU, 10, '#7a5a3c');
        for (const y of [0.12, 0.45]) mvCyl(batch, 'iron', mvV3(p.x, y * MVU, p.y), mvV3(p.x, y * MVU + 0.05 * MVU, p.y), 0.43 * MVU, 10, '#2a2a2a');
        mvGeometry(batch, 'paint', MV_GEO.blob, p.x, 0.65 * MVU, p.y, 0.38 * MVU, 0.3 * MVU, 0.38 * MVU, '#3f6a32');
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU;
          mvGeometry(batch, 'paint', MV_GEO.blob, p.x + Math.cos(a) * 0.22 * MVU, 0.82 * MVU, p.y + Math.sin(a) * 0.22 * MVU, 0.13 * MVU, 0.13 * MVU, 0.13 * MVU, p.color, k);
        }
      }
      function mvBench(batch, bench) {
        const c = Math.cos(bench.a),
          s = Math.sin(bench.a);
        // A split-log bench: seat and back on log legs.
        const at = (u, v) => [bench.x + c * u - s * v, bench.y + s * u + c * v];
        const [sx, sz] = at(0, 0),
          [bx, bz] = at(0, -0.35 * MVU);
        mvBox(batch, 'timber', sx, 0.46 * MVU, sz, 1.9 * MVU, 0.1 * MVU, 0.45 * MVU, '#8a6a48', -bench.a);
        mvBox(batch, 'timber', bx, 0.85 * MVU, bz, 1.9 * MVU, 0.4 * MVU, 0.08 * MVU, '#8a6a48', -bench.a);
        for (const u of [-0.75, 0.75]) {
          const [lx, lz] = at(u * MVU, -0.1 * MVU);
          mvCyl(batch, 'logs', mvV3(lx, 0, lz), mvV3(lx, 0.44 * MVU, lz), 0.12 * MVU, 6, '#7a5a3c');
        }
      }
      // The town square: cobbles, a kerb, and the fountain (Northridge) or the well (Stonecreek).
      function mvSquare(batch, s) {
        mvGround(batch, 'cobbles', s.x, s.y, s.x + s.w, s.y + s.h, '#a9a196', 0.18);
        for (const [x0, z0, x1, z1] of [[s.x, s.y, s.x + s.w, s.y + 0.3 * MVU], [s.x, s.y + s.h - 0.3 * MVU, s.x + s.w, s.y + s.h], [s.x, s.y, s.x + 0.3 * MVU, s.y + s.h], [s.x + s.w - 0.3 * MVU, s.y, s.x + s.w, s.y + s.h]])
          mvBlock(batch, 'stone', x0, 0, z0, x1, 0.15 * MVU, z1, '#b3ada2');
        const cx = s.cx,
          cz = s.cy;
        if (s.feature === 'fountain') {
          // An octagonal stone basin, the water, a column with a bowl, a carved bear on top.
          const r = 3.6 * MVU;
          mvCyl(batch, 'stone', mvV3(cx, 0, cz), mvV3(cx, 0.7 * MVU, cz), r, 8, '#c8c2b6', 'stone', '#c8c2b6');
          mvCyl(batch, 'water', mvV3(cx, 0.55 * MVU, cz), mvV3(cx, 0.72 * MVU, cz), r - 0.35 * MVU, 8, '#2e5560', 'water', '#2e5560');
          mvCyl(batch, 'stone', mvV3(cx, 0.7 * MVU, cz), mvV3(cx, 2.3 * MVU, cz), 0.45 * MVU, 8, '#b9b3a8');
          mvCyl(batch, 'stone', mvV3(cx, 2.3 * MVU, cz), mvV3(cx, 2.55 * MVU, cz), 1.3 * MVU, 10, '#c8c2b6', 'water', '#3e6a74');
          mvGeometry(batch, 'stone', MV_GEO.blob, cx, 3.1 * MVU, cz, 0.55 * MVU, 0.6 * MVU, 0.85 * MVU, '#8a8276', 0.3);
          mvGeometry(batch, 'stone', MV_GEO.blob, cx, 3.55 * MVU, cz + 0.55 * MVU, 0.32 * MVU, 0.3 * MVU, 0.35 * MVU, '#8a8276');
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * TAU + 0.4;
            mvCyl(batch, 'water', mvV3(cx + Math.cos(a) * 1.2 * MVU, 2.45 * MVU, cz + Math.sin(a) * 1.2 * MVU), mvV3(cx + Math.cos(a) * 2.2 * MVU, 0.72 * MVU, cz + Math.sin(a) * 2.2 * MVU), 0.07 * MVU, 4, '#cfeef6');
          }
          mvPool(batch, cx, cz, 7 * MVU, '#9fd8ff', 0.18);
        } else {
          // A round stone well under a little shake roof with a windlass and bucket.
          const r = 1.3 * MVU;
          mvCyl(batch, 'stone', mvV3(cx, 0, cz), mvV3(cx, 0.9 * MVU, cz), r, 10, '#bdb6aa', 'stone', '#6b665f');
          mvCyl(batch, 'water', mvV3(cx, 0.5 * MVU, cz), mvV3(cx, 0.55 * MVU, cz), r - 0.25 * MVU, 10, '#22404a');
          for (const s2 of [-1, 1]) mvBox(batch, 'timber', cx + s2 * (r - 0.1 * MVU), 1.6 * MVU, cz, 0.2 * MVU, 3.2 * MVU, 0.2 * MVU, '#6e5540');
          mvCyl(batch, 'timber', mvV3(cx - r, 2.3 * MVU, cz), mvV3(cx + r, 2.3 * MVU, cz), 0.12 * MVU, 6, '#8a6a48');
          mvBox(batch, 'timber', cx + r + 0.25 * MVU, 2.1 * MVU, cz, 0.1 * MVU, 0.5 * MVU, 0.1 * MVU, '#5a4a3a');
          mvCyl(batch, 'timber', mvV3(cx, 1.3 * MVU, cz), mvV3(cx, 1.65 * MVU, cz), 0.22 * MVU, 8, '#6e5540');
          mvGableRoof(batch, cx - r - 0.2 * MVU, cz - 0.9 * MVU, cx + r + 0.2 * MVU, cz + 0.9 * MVU, 'x', 3.2 * MVU, 0.9 * MVU, 0.35 * MVU, 0.25 * MVU, ['shake', '#bfa98e'], '#4a3a2a');
        }
      }
      // The gas station's canopy: log posts, a timber-framed gable roof over two pump islands.
      function mvGasCanopy(batch) {
        const g = MOUNTAIN_VILLAGE.gas,
          h = 4.8 * MVU,
          wood = '#6e5238';
        for (const p of gasCanopyPosts()) {
          mvCyl(batch, 'logs', mvV3(p.x, 0, p.y), mvV3(p.x, h, p.y), 0.28 * MVU, 8, '#b8956a', 'stack', '#caa678');
          mvBlock(batch, 'stone', p.x - 0.5 * MVU, 0, p.y - 0.5 * MVU, p.x + 0.5 * MVU, 0.7 * MVU, p.y + 0.5 * MVU, '#b8b2a6');
        }
        for (const z of [g.y + 12, g.y + g.h - 12]) mvBox(batch, 'timber', g.x + g.w / 2, h + 0.2 * MVU, z, g.w - 10, 0.45 * MVU, 0.35 * MVU, wood);
        mvGables(batch, g.x - 4, g.y, g.x + g.w + 4, g.y + g.h, 'x', h + 0.45 * MVU, 1.8 * MVU, 'boards', '#9a7a58');
        mvGableRoof(batch, g.x - 4, g.y, g.x + g.w + 4, g.y + g.h, 'x', h + 0.45 * MVU, 1.8 * MVU, 0.6 * MVU, 0.6 * MVU, ['metal', '#6b2a24'], '#3a2a1e', 0, true);
        registerOverheadCover(g.x + g.w / 2, g.y + g.h / 2, g.w / 2, g.h / 2, 0, h, h + 2.4 * MVU, 'canopy');
        // Concrete apron, the islands and the pumps (glowing faces at night).
        mvGround(batch, 'gravel', g.x - 20, g.y - 30, g.x + g.w + 20, g.y + g.h + 50, '#c9c6bd', 0.16);
        for (const p of gasPumps()) {
          mvBlock(batch, 'stone', p.x - 1.4 * MVU, 0, p.y - 0.6 * MVU, p.x + 1.4 * MVU, 0.2 * MVU, p.y + 0.6 * MVU, '#d8d4ca');
          mvBox(batch, 'paint', p.x, 1.0 * MVU, p.y, 0.9 * MVU, 1.6 * MVU, 0.55 * MVU, '#b8322a');
          mvBox(batch, 'lamp', p.x, 1.35 * MVU, p.y + 0.29 * MVU, 0.6 * MVU, 0.35 * MVU, 0.02 * MVU, '#f6f0e0');
          mvBox(batch, 'paint', p.x, 1.95 * MVU, p.y, 1.0 * MVU, 0.3 * MVU, 0.6 * MVU, '#f1e8d2');
          mvCyl(batch, 'iron', mvV3(p.x + 0.5 * MVU, 1.2 * MVU, p.y), mvV3(p.x + 0.7 * MVU, 0.6 * MVU, p.y + 0.3 * MVU), 0.04 * MVU, 4, '#111');
        }
        for (let k = 0; k < 3; k++) {
          const x = g.x + (g.w * (k + 1)) / 4;
          addGlow(x, h - 0.2 * MVU, g.y + g.h / 2, 12, '#fff2dc', 0.9, { day: 0 });
        }
        mvPool(batch, g.x + g.w / 2, g.y + g.h / 2, g.w * 0.6, '#fff0d8', 0.6);
        // The price board on a post by the avenue.
        const px = g.x - 6,
          pz = g.y + g.h + 20;
        mvCyl(batch, 'logs', mvV3(px, 0, pz), mvV3(px, 4.4 * MVU, pz), 0.18 * MVU, 7, '#b8956a');
        mvSign(batch, 'GAS · GROCERIES', px, 3.6 * MVU, pz + 0.3 * MVU, 3.6 * MVU, false);
      }
      // The sawmill yard: log decks and lumber stacks.
      function mvMillYard(batch) {
        for (const pile of millLogPiles()) {
          const rows = 3,
            r = 0.36 * MVU;
          for (let k = 0; k < 9; k++)
            for (let j = 0; j < rows - (k % 3 === 2 ? 1 : 0); j++) {
              const z = pile.y + r + ((k * (pile.h - 2 * r)) / 8) * 1,
                y = r + j * r * 1.7;
              if (z > pile.y + pile.h) continue;
              mvCyl(batch, 'logs', mvV3(pile.x + 2, y, z), mvV3(pile.x + pile.w - 2 - (k % 2) * 6, y, z), r, 7, '#a8845c', 'stack', '#caa678');
            }
          mvBox(batch, 'timber', pile.x + pile.w / 2, 0.15 * MVU, pile.y + pile.h / 2, pile.w, 0.3 * MVU, pile.h, '#5a4430');
        }
        for (const s of millLumberStacks()) {
          for (let y = 0.2 * MVU; y < s.height; y += 0.42 * MVU) mvBlock(batch, 'planks', s.x, y, s.y, s.x + s.w, y + 0.34 * MVU, s.y + s.h, '#e0c69c', '');
          for (const x of [s.x + 2, s.x + s.w / 2, s.x + s.w - 2]) for (let y = 0.12 * MVU; y < s.height; y += 0.42 * MVU) mvBox(batch, 'timber', x, y, s.y + s.h / 2, 0.3 * MVU, 0.12 * MVU, s.h + 0.3 * MVU, '#6a5238');
        }
      }
      // The Mountain Rescue pad: concrete, the H and ring, edge lights, the windsock.
      function mvHelipad(batch, h) {
        const s = h.size / 2;
        mvBlock(batch, 'stone', h.x - s, 0, h.y - s, h.x + s, 0.15 * MVU, h.y + s, '#c9c5bc');
        const ring = 5 * MVU;
        for (let k = 0; k < 28; k++) {
          const a0 = (k / 28) * TAU,
            a1 = ((k + 1) / 28) * TAU;
          const p = (a, r) => mvV3(h.x + Math.cos(a) * r, 0.2 * MVU, h.y + Math.sin(a) * r);
          mvQuad(batch, 'paint', [p(a0, ring), p(a0, ring - 0.4 * MVU), p(a1, ring - 0.4 * MVU), p(a1, ring)], '#f2d35a', null, false);
        }
        for (const [x0, z0, x1, z1] of [[-1.6, -2, -1.0, 2], [1.0, -2, 1.6, 2], [-1.0, -0.3, 1.0, 0.3]])
          mvGround(batch, 'gravel', h.x + x0 * MVU, h.y + z0 * MVU, h.x + x1 * MVU, h.y + z1 * MVU, '#fbfbf7', 0.22);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU,
            x = h.x + Math.cos(a) * (s - 1),
            z = h.y + Math.sin(a) * (s - 1);
          mvCyl(batch, 'lamp', mvV3(x, 0.15 * MVU, z), mvV3(x, 0.4 * MVU, z), 0.15 * MVU, 6, '#e6f0ff');
          addGlow(x, 0.5 * MVU, z, 3, '#8fd06a', 1.4, { day: 0 });
        }
        // Windsock on its pole at the pad's corner.
        const wx = h.x - s - 22 + 1.5,
          wz = h.y - s - 2 + 1.5;
        mvCyl(batch, 'iron', mvV3(wx, 0, wz), mvV3(wx, 6 * MVU, wz), 0.07 * MVU, 6, '#d8d8d8');
        mvGeometry(batch, 'paint', MV_GEO.cone, wx + 1.0 * MVU, 5.8 * MVU, wz, 0.45 * MVU, 2.0 * MVU, 0.45 * MVU, '#ff7a1a', 0, Math.PI / 2);
      }
      // A lantern lamp standard: instanced, knockable, and lit (the city's 'lantern' prop kind).
      const MV_LAMP_CAPACITY = 220,
        mvLampPosts = new Three.InstancedMesh(new Three.CylinderGeometry(0.5, 0.9, 1, 8), new Three.MeshStandardMaterial({ color: '#1c1d1f', roughness: 0.5, metalness: 0.6 }), MV_LAMP_CAPACITY),
        mvLampArms = new Three.InstancedMesh(boxGeo, mvLampPosts.material, MV_LAMP_CAPACITY * 2),
        mvLampHeads = new Three.InstancedMesh(new Three.CylinderGeometry(0.75, 1.05, 1, 4), new Three.MeshStandardMaterial({ color: '#fff0cc', emissive: '#ffc977', emissiveIntensity: 0, roughness: 0.25 }), MV_LAMP_CAPACITY);
      for (const im of [mvLampPosts, mvLampArms, mvLampHeads]) {
        im.count = 0;
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.name = 'village lanterns';
        scene.add(im);
      }
      function mvLamp(batch, l) {
        const prop = registerStreetProp('lantern', l.x, l.y),
          height = 3.9 * MVU;
        placePropInstance(mvLampPosts, prop, l.x, height / 2, l.y, 1, height, 1);
        // A scroll bracket and the lantern hung from it.
        placePropInstance(mvLampArms, prop, l.x + 2.2, height - 1.2, l.y, 5, 0.6, 0.6);
        placePropInstance(mvLampArms, prop, l.x, height + 0.6, l.y, 1.6, 1.2, 1.6);
        placePropInstance(mvLampHeads, prop, l.x + 4.2, height - 3.4, l.y, 1.1, 2.6, 1.1, Math.PI / 4);
        prop.halo = glowHandle(addGlow(l.x + 4.2, height - 3.4, l.y, 12, '#ffcf8a', 0.85, { day: 0 }));
        mvPool(batch, l.x + 4, l.y + 2, 8 * MVU, '#ffc27a', 0.42);
      }
      /* ---- The towns ------------------------------------------------------------------------- */
      const mvTownGroups = new Map();
      function mvTownGroup(name, cx, cz) {
        let g = mvTownGroups.get(name);
        if (!g) {
          g = new Three.Group();
          g.name = 'village ' + name;
          scene.add(g);
          statics.push({ x: cx, y: cz, group: g, radius: 820 });
          mvTownGroups.set(name, g);
        }
        return g;
      }
      for (const town of COUNTY_TOWNS) {
        if (!isMountainTown(town)) continue;
        const batch = mvBatch(town.name),
          inTown = (x, y) => x > town.x - 100 && x < town.x + BLOCK_SIZE * 2 + 100 && y > town.y - 100 && y < town.y + BLOCK_SIZE * 2 + 100;
        for (const y of MOUNTAIN_VILLAGE.yards) if (inTown(y.x, y.y)) mvGround(batch, y.kind === 'dirt' ? 'dirt' : 'gravel', y.x, y.y, y.x + y.w, y.y + y.h, y.kind === 'dirt' ? '#d8cbb4' : '#b9ae9c');
        for (const b of MOUNTAIN_VILLAGE.buildings) if (b.town === town.name) mvHouse(batch, b);
        for (const w of MOUNTAIN_VILLAGE.boardwalks) if (w.building.town === town.name) mvBoardwalk(batch, w);
        for (const f of MOUNTAIN_VILLAGE.fences) if (inTown(f.x0, f.y0)) mvFence(batch, f);
        for (const f of MOUNTAIN_VILLAGE.firewood) if (inTown(f.x, f.y)) mvFirewood(batch, f);
        for (const p of MOUNTAIN_VILLAGE.planters) if (inTown(p.x, p.y)) mvPlanter(batch, p);
        for (const s of MOUNTAIN_VILLAGE.benches) if (inTown(s.x, s.y)) mvBench(batch, s);
        for (const s of MOUNTAIN_VILLAGE.squares) if (s.town === town.name) mvSquare(batch, s);
        for (const l of MOUNTAIN_VILLAGE.lamps) if (inTown(l.x, l.y)) mvLamp(batch, l);
        if (MOUNTAIN_VILLAGE.gas && inTown(MOUNTAIN_VILLAGE.gas.x, MOUNTAIN_VILLAGE.gas.y)) mvGasCanopy(batch);
        if (MOUNTAIN_VILLAGE.mill && inTown(MOUNTAIN_VILLAGE.mill.logs.x, MOUNTAIN_VILLAGE.mill.logs.y)) mvMillYard(batch);
        if (MOUNTAIN_VILLAGE.helipad && inTown(MOUNTAIN_VILLAGE.helipad.x, MOUNTAIN_VILLAGE.helipad.y)) mvHelipad(batch, MOUNTAIN_VILLAGE.helipad);
        const group = mvTownGroup(town.name, town.x + BLOCK_SIZE, town.y + BLOCK_SIZE);
        mvFlush(batch, group);
        // Every building counts as an occluder for the cutaway (the player behind a chalet stays visible).
        for (const b of MOUNTAIN_VILLAGE.buildings)
          if (b.town === town.name) allBuildings.push({ b, group, height: b.height, materials: [MV_MAT[mvWallFinish(b, b.finish.walls)[0]]], tint: new Three.Color(mvWallFinish(b, b.finish.walls)[1]) });
      }
      mvLampPosts.instanceMatrix.needsUpdate = mvLampArms.instanceMatrix.needsUpdate = mvLampHeads.instanceMatrix.needsUpdate = true;
      // @include src/mountain-club3d.js
      /* ---- Per frame -------------------------------------------------------------------------- */
      let mvSmokeClock = 0,
        mvLastTime = 0;
      function updateMountainVisuals() {
        const deltaSeconds = clamp(gameTime - mvLastTime, 0, 0.25),
          night = nightAmount,
          hour = (worldMinutes % 1440) / 60,
          late = hour > 1 && hour < 5 ? 0.35 : 1;
        mvLastTime = gameTime;
        MV_MAT.windowLit.emissiveIntensity = night * 1.25 * late;
        MV_MAT.windowDark.emissiveIntensity = night * 0.05;
        MV_MAT.lamp.emissiveIntensity = night * 2.2;
        mvLampHeads.material.emissiveIntensity = night * 2.4;
        mvPoolMaterial.opacity = clamp(night * 1.15, 0, 1);
        MV_MAT.water.emissiveIntensity = 0.1 + night * 0.25;
        // Wood smoke from a few chimneys, more on a cold night.
        mvSmokeClock -= deltaSeconds;
        if (mvSmokeClock <= 0 && mvChimneys.length) {
          mvSmokeClock = 0.35 + (1 - night) * 0.5;
          for (let k = 0; k < mvChimneys.length; k += 5) {
            const c = mvChimneys[(k + Math.floor(gameTime * 0.1)) % mvChimneys.length];
            if (Math.abs(c.x - viewCenter.x) < viewReach + 100 && Math.abs(c.z - viewCenter.y) < viewReach + 100) engineSmoke(c.x, c.y, c.z, night > 0.4 ? '#8d857c' : '#c9c5bf', 6, 14);
          }
        }
        updateClubVisuals(deltaSeconds);
      }
      function mountainVillageInfo() {
        const towns = {};
        for (const [name, g] of mvTownGroups) {
          let meshes = 0,
            triangles = 0;
          g.traverse((o) => {
            if (!o.isMesh) return;
            meshes++;
            triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
          });
          towns[name] = { meshes, triangles: Math.round(triangles) };
        }
        return { towns, lamps: mvLampPosts.count, signs: mvSignTexts.length, chimneys: mvChimneys.length, total: { meshes: mvStats.meshes, triangles: Math.round(mvStats.triangles), vertices: mvStats.vertices }, club: clubVisualInfo() };
      }
