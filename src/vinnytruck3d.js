      // Vinny's truck (mission 1, the 'flatbed' type): a 1990s medium-duty conventional flatbed at real size, merged into a
      // few draws (makeVinnyTruck), with its door livery, lamps, markers and hazards, dual rear wheels and the crate slots.
      /**
       * VINNY'S TRUCK
       * Scope: createCityRenderer() closure, after cars3d.js (it merges with the
       * civilian car kit: civAdd / civBar / civBeam, the trim atlas and finishes,
       * the tyre lathe and the lamp materials) and harbor3d.js (makeCargoCrate).
       *
       * An ATLAS medium-duty conventional of the late eighties / nineties (the
       * International 4700 / Ford F-800 class) with a 5.4 m hardwood flatbed:
       * set-back hood between flared fenders, rectangular twin sealed beams, a
       * chrome bar grille and bumper, two-piece flat windscreen with a sun visor
       * and five amber cab markers, West Coast mirrors on tube arms, a polished
       * fuel tank as the driver's step, battery box, exhaust stack and air horns,
       * a mesh headache rack, stake pockets, conspicuity tape, an underride bar,
       * mud flaps and dual rear wheels on steel Budd discs. Built in metres at
       * real size (`modelScale` 1): 9.5 m by 2.44 m of body, 2.8 m over the
       * mirrors (the collider's width), cab roof 2.74 m, deck 1.28 m.
       *
       * The model rides the civilian car contract (`civilian`, cars3d.js
       * animateCivilianCar): the four lamps swap between the shared lamp
       * materials, the wheels roll at their radius and the fronts steer, and
       * `extra.animate` runs the markers (lit with the lamps), the hazards (the
       * waiting mission truck blinks them), the halos a broken lamp puts out and
       * the livery on a burnt shell. It is not `car` (no crumple shell): damage
       * is specialDamage's (tyres, burn) and the lamps.
       *
       * One kit per session (geometry shared by every build of the truck, kept
       * in sharedGeometries): paint (livery-mapped), trim (vertex colour, finish
       * and atlas cell per part), glass, markers, indicators, the four lamps, a
       * tyre, a dual tyre pair and three rims. The crates the crane loads sit on
       * VINNY_CARGO's slots (harbor-terminal.js, which the crane animation in
       * harbor3d.js lowers them onto).
       */
      const VT = UNITS_PER_METRE,
        // The livery canvas: the left side's band (rows 0-319), the right side's
        // (320-639) and the roof number (660-1000), 3.6 m of side (x 0.9..4.5)
        // by 1.1 m (y 0.75..1.85) per band.
        VT_LIVERY = { x0: 0.9, x1: 4.5, y0: 0.75, y1: 1.85, size: 1024, band: 320, roof: [660, 1000], roofX: [0.96, 2.4] },
        VT_CLEAR_UV = [1 - 3 / 1024, 3 / 1024],
        VT_WHEEL = { r: 0.51, front: 3.55, rear: -1.9, frontZ: 1.03, dualZ: 0.89, dualGap: 0.145, width: 0.27 };
      let vinnyKitCache = null,
        vinnyLiveryTexture = null,
        vinnyShared = null;
      // ---- Metre helpers over the civilian merging kit ----
      function vtBox(set, x0, x1, y0, y1, z0, z1, options, geo = boxGeo) {
        civAdd(set, geo, ((x0 + x1) / 2) * VT, ((y0 + y1) / 2) * VT, ((z0 + z1) / 2) * VT, Math.abs(x1 - x0) * VT, Math.abs(y1 - y0) * VT, Math.abs(z1 - z0) * VT, options);
      }
      function vtBar(set, a, b, height, depth, radius, options, up) {
        civBar(set, a.map((v) => v * VT), b.map((v) => v * VT), height * VT, depth * VT, radius * VT, options, up);
      }
      function vtBeam(set, geo, a, b, height, depth, options, up) {
        civBeam(set, geo, a.map((v) => v * VT), b.map((v) => v * VT), height * VT, depth * VT, options, up);
      }
      // A cylinder (unit, axis y) of radius r and length `length` along axis 'x', 'y' or 'z'.
      function vtCylinder(set, geo, x, y, z, r, length, axis, options) {
        civAdd(set, geo, x * VT, y * VT, z * VT, r * VT, length * VT, r * VT, options, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0);
      }
      // A side profile [[x, y], ...] (metres) extruded across z0..z1 with rounded edges.
      function vtProfile(set, points, z0, z1, options, bevel = 0.03, arch = null) {
        const shape = new Three.Shape();
        points.forEach(([x, y], i) => (i ? shape.lineTo(x * VT, y * VT) : shape.moveTo(x * VT, y * VT)));
        if (arch) arch(shape);
        const depth = Math.max(0.01, Math.abs(z1 - z0) - bevel * 2) * VT,
          geo = new Three.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel * VT * 0.8, bevelThickness: bevel * VT, bevelSegments: 2, curveSegments: 10 });
        geo.translate(0, 0, (Math.min(z0, z1) + bevel) * VT);
        civAddMatrix(set, geo, civIdentity, options);
        geo.dispose();
      }
      // A flat polygon [[x, y], ...] (metres) standing in the plane z (a thin slab `t` thick).
      function vtPane(set, points, z, t, options) {
        const shape = new Three.Shape();
        points.forEach(([x, y], i) => (i ? shape.lineTo(x * VT, y * VT) : shape.moveTo(x * VT, y * VT)));
        const geo = new Three.ExtrudeGeometry(shape, { depth: t * VT, bevelEnabled: false });
        geo.translate(0, 0, (z - t / 2) * VT);
        civAddMatrix(set, geo, civIdentity, options);
        geo.dispose();
      }
      // Copies of a geometry at the given matrices, every attribute kept (the tyre lathe's colours and finish).
      function vtCopies(geo, matrices) {
        const out = new Three.BufferGeometry(),
          n = geo.attributes.position.count,
          normalMatrix = new Three.Matrix3(),
          v = new Three.Vector3();
        for (const name of Object.keys(geo.attributes)) {
          const src = geo.attributes[name],
            data = new Float32Array(src.count * src.itemSize * matrices.length);
          matrices.forEach((matrix, k) => {
            normalMatrix.getNormalMatrix(matrix);
            for (let i = 0; i < src.count; i++) {
              const at = (k * src.count + i) * src.itemSize;
              if (name === 'position' || name === 'normal') {
                v.fromBufferAttribute(src, i);
                if (name === 'position') v.applyMatrix4(matrix);
                else v.applyMatrix3(normalMatrix).normalize();
                data[at] = v.x;
                data[at + 1] = v.y;
                data[at + 2] = v.z;
              } else for (let c = 0; c < src.itemSize; c++) data[at + c] = src.array[i * src.itemSize + c];
            }
          });
          out.setAttribute(name, new Three.BufferAttribute(data, src.itemSize));
        }
        const index = [];
        for (let k = 0; k < matrices.length; k++) for (let i = 0; i < geo.index.count; i++) index.push(geo.index.getX(i) + k * n);
        out.setIndex(index);
        out.computeBoundingSphere();
        sharedGeometries.add(out);
        return out;
      }
      // ---- The livery: door lettering, pinstripe and the roof's fleet number ----
      function vinnyLivery() {
        if (vinnyLiveryTexture) return vinnyLiveryTexture;
        const L = VT_LIVERY,
          canvas = document.createElement('canvas');
        canvas.width = canvas.height = L.size;
        const g = canvas.getContext('2d'),
          pxPerM = L.size / (L.x1 - L.x0),
          rowPerM = L.band / (L.y1 - L.y0),
          maroon = '#5e1a1c',
          cream = '#f1e4c2';
        for (const [bandIndex, side] of [[0, -1], [1, 1]]) {
          const top = bandIndex * L.band,
            // Metres along the truck to pixels in this band (the left side reads front to rear).
            px = (x) => (side < 0 ? (L.x1 - x) * pxPerM : (x - L.x0) * pxPerM),
            row = (y) => top + (L.y1 - y) * rowPerM,
            doorA = px(2.5),
            doorB = px(1.38),
            left = Math.min(doorA, doorB),
            width = Math.abs(doorB - doorA),
            cx = left + width / 2;
          g.save();
          g.beginPath();
          g.rect(0, top, L.size, L.band);
          g.clip();
          // A maroon pinstripe under the side glass, cream hairlines either side (cab only).
          const cabA = px(2.74),
            cabB = px(1.0);
          g.fillStyle = cream;
          g.fillRect(Math.min(cabA, cabB), row(1.735), Math.abs(cabB - cabA), row(1.66) - row(1.735));
          g.fillStyle = maroon;
          g.fillRect(Math.min(cabA, cabB), row(1.725), Math.abs(cabB - cabA), row(1.67) - row(1.725));
          // The company on the door: a script name over a banner.
          g.textAlign = 'center';
          g.textBaseline = 'alphabetic';
          g.lineJoin = 'round';
          g.font = 'italic bold 84px Georgia, "Times New Roman", serif';
          g.lineWidth = 9;
          g.strokeStyle = cream;
          g.strokeText('Moretti', cx, row(1.415), width * 0.94);
          g.fillStyle = maroon;
          g.fillText('Moretti', cx, row(1.415), width * 0.94);
          g.font = 'bold 26px Georgia, "Times New Roman", serif';
          g.fillText('& SONS', cx, row(1.345), width * 0.6);
          // Banner: CARTAGE · HAULING in cream on maroon.
          const bannerTop = row(1.31),
            bannerH = row(1.225) - bannerTop;
          g.fillStyle = maroon;
          g.fillRect(cx - width * 0.42, bannerTop, width * 0.84, bannerH);
          g.fillStyle = cream;
          g.font = 'bold 21px Arial, Helvetica, sans-serif';
          g.fillText('CARTAGE · HAULING', cx, bannerTop + bannerH * 0.8, width * 0.8);
          g.fillStyle = maroon;
          g.font = 'bold 19px Arial, Helvetica, sans-serif';
          g.fillText('SOUTH COAST  ·  (555) 0147', cx, row(1.155), width * 0.92);
          g.font = '14px Arial, Helvetica, sans-serif';
          g.fillText('USDOT 311729   CA 3317', cx, row(1.085), width * 0.7);
          g.restore();
        }
        // The fleet number on the roof, read from above (letters' tops to the truck's right).
        const [r0, r1] = L.roof;
        g.save();
        g.fillStyle = 'rgba(241,228,194,0.92)';
        g.font = 'bold 250px Arial, Helvetica, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('07', L.size * 0.5, (r0 + r1) / 2 + 12);
        g.restore();
        const texture = new Three.CanvasTexture(canvas);
        texture.colorSpace = Three.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        vinnyLiveryTexture = texture;
        return texture;
      }
      // Livery UVs: a door skin projects onto its side's band, the roof skin onto the number.
      // (Only those thin skins carry the livery: a part spanning both bands or the
      // band and the clear texel would smear lettering across its faces.)
      function vinnySideUv(side) {
        const L = VT_LIVERY,
          inset = 2 / L.size,
          top = side < 0 ? 0 : L.band;
        return (x, y) => {
          const along = (x / VT - L.x0) / (L.x1 - L.x0),
            u = side < 0 ? 1 - along : along,
            v = clamp((y / VT - L.y0) / (L.y1 - L.y0), 0.01, 0.99);
          return [clamp(u, inset, 1 - inset), 1 - (top + (1 - v) * L.band) / L.size];
        };
      }
      function vinnyRoofUv(x, y, z) {
        const L = VT_LIVERY,
          inset = 2 / L.size,
          u = (L.roofX[1] - x / VT) / (L.roofX[1] - L.roofX[0]),
          v = clamp((z / VT + 1.15) / 2.3, 0.01, 0.99);
        return [clamp(u, inset, 1 - inset), 1 - (L.roof[1] - v * (L.roof[1] - L.roof[0])) / L.size];
      }
      // ---- The kit ----
      function vinnyKit() {
        if (vinnyKitCache) return vinnyKitCache;
        const S = civShapeKit(),
          paint = civSet(),
          trim = civSet(),
          glass = civSet(),
          markers = civSet(),
          indicators = civSet(),
          plain = { uv: VT_CLEAR_UV, finish: 'paintLike' },
          black = { color: '#18191b', finish: 'satin' },
          frame = { color: '#1c1d1f', finish: 'satin' },
          rubber = { color: '#141516', finish: 'rubber' },
          bright = { color: '#dfe3e6', finish: 'chrome' },
          alloy = { color: '#cfd3d6', finish: 'alloy' },
          tread = { color: '#b9bdc0', finish: 'alloy', cell: 'tread' },
          amber = { color: '#ffb03a', finish: 'lens' },
          red = { color: '#e0281e', finish: 'lens' },
          sides = [-1, 1];
        // CAB: the lower shell (doors carry the livery), the greenhouse, roof and visor.
        vtBar(paint, [2.8, 1.375, 0], [0.96, 1.375, 0], 0.85, 2.26, 0.07, plain);
        // The door skins carry the lettering and the pinstripe (a hair proud of the flat side).
        for (const s of sides) vtBox(paint, 1.03, 2.73, 1.02, 1.735, s * 1.13, s * 1.1335, { uvOf: vinnySideUv(s), finish: 'paintLike' });
        // Door shut lines, handles and the step well under each door.
        for (const s of sides) {
          const z = s * 1.132;
          for (const x of [2.53, 1.36]) vtBox(trim, x - 0.006, x + 0.006, 1.0, 1.79, z - 0.004, z + 0.004, black);
          vtBox(trim, 1.36, 2.53, 0.995, 1.007, z - 0.004, z + 0.004, black);
          vtBox(trim, 1.5, 1.66, 1.62, 1.66, z + s * 0.012, z + s * 0.03, bright);
          vtBox(trim, 1.44, 1.47, 1.5, 1.53, z + s * 0.004, z + s * 0.012, black);
          // The cab's floor sill and the black step well.
          vtBox(trim, 1.02, 2.74, 0.7, 0.95, s * 0.98, s * 1.1, black);
        }
        // Greenhouse: A-pillars, the windscreen's centre bar and gaskets, the B pillars and rear corners.
        const screenBase = 1.8,
          screenTop = 2.61,
          baseX = 2.64,
          topX = 2.4;
        for (const s of sides) {
          vtBar(paint, [baseX, screenBase, s * 1.08], [topX, screenTop, s * 1.07], 0.1, 0.1, 0.03, plain, [0, 0, 1]);
          vtBar(paint, [1.37, screenBase, s * 1.09], [1.37, screenTop + 0.02, s * 1.09], 0.1, 0.1, 0.03, plain, [1, 0, 0]);
          vtBox(paint, 0.96, 1.33, screenBase, screenTop + 0.02, s * 1.04, s * 1.13, plain);
          // Side glass from the A-pillar back to the B pillar, the vent window split.
          vtPane(glass, [[baseX - 0.06, screenBase + 0.04], [topX - 0.03, screenTop - 0.03], [1.42, screenTop - 0.03], [1.42, screenBase + 0.04]], s * 1.105, 0.02, {});
          vtBeam(trim, S.box, [2.3, screenBase + 0.04, s * 1.12], [2.3, screenTop - 0.04, s * 1.12], 0.025, 0.02, black, [0, 0, 1]);
          vtBox(trim, 1.42, baseX - 0.05, screenBase + 0.02, screenBase + 0.045, s * 1.1, s * 1.125, rubber);
        }
        // Two-piece flat windscreen, raked, a black gasket round each half.
        for (const s of sides)
          vtBeam(glass, S.box, [baseX + 0.012, screenBase + 0.03, s * 0.54], [topX + 0.012, screenTop - 0.02, s * 0.54], 1.02, 0.02, {}, [0, 0, 1]);
        vtBeam(trim, S.box, [baseX + 0.03, screenBase, 0], [topX + 0.03, screenTop, 0], 0.05, 0.03, rubber, [0, 0, 1]);
        vtBar(trim, [baseX + 0.03, screenBase + 0.01, -1.06], [baseX + 0.03, screenBase + 0.01, 1.06], 0.035, 0.05, 0.01, rubber);
        vtBar(trim, [topX + 0.03, screenTop - 0.01, -1.06], [topX + 0.03, screenTop - 0.01, 1.06], 0.035, 0.05, 0.01, rubber);
        // Cowl panel under the windscreen, with the wiper pivots.
        vtBox(trim, 2.66, 2.78, 1.8, 1.815, -0.9, 0.9, { color: '#202225', finish: 'satin', cell: 'louvre' });
        // The roof (the fleet number lives in its livery), rain gutters and the sun visor.
        vtBar(paint, [2.44, 2.68, 0], [0.96, 2.68, 0], 0.13, 2.26, 0.07, plain);
        vtBox(paint, 1.03, 2.37, 2.745, 2.7485, -1.06, 1.06, { uvOf: vinnyRoofUv, finish: 'paintLike' });
        for (const s of sides) vtBar(trim, [2.4, 2.63, s * 1.135], [0.98, 2.63, s * 1.135], 0.025, 0.025, 0.01, black);
        vtBeam(paint, S.box, [2.44, 2.735, 0], [2.7, 2.71, 0], 2.08, 0.035, plain, [0, 0, 1]);
        vtBox(trim, 2.42, 2.46, 2.66, 2.72, -1.04, 1.04, black);
        // Five amber cab markers along the visor's edge (the three in the middle a cluster).
        for (const z of [-0.92, -0.14, 0, 0.14, 0.92]) vtBox(markers, 2.6, 2.67, 2.715, 2.765, z - 0.05, z + 0.05, amber);
        // Air horns on the roof, a CB whip and its spring on the left mirror arm.
        for (const [z, len] of [[-0.42, 0.42], [-0.26, 0.3]]) {
          // (The cone's axis is its y: turned to point the bell forward.)
          civAdd(trim, S.cone, (1.95 + len / 2) * VT, 2.81 * VT, z * VT, 0.045 * VT, len * VT, 0.045 * VT, bright, 0, 0, Math.PI / 2);
          vtBox(trim, 1.9, 1.98, 2.745, 2.8, z - 0.02, z + 0.02, black);
        }
        vtBeam(trim, S.box, [2.34, 2.34, -1.2], [2.28, 3.55, -1.2], 0.012, 0.012, black, [1, 0, 0]);
        vtCylinder(trim, S.cylinderLow, 2.34, 2.38, -1.2, 0.018, 0.08, 'y', bright);
        // Back wall with its small rear window.
        vtBox(paint, 0.93, 0.98, 0.96, 2.62, -1.12, 1.12, plain);
        vtBox(glass, 0.915, 0.93, 2.02, 2.42, -0.52, 0.52, {});
        vtBox(trim, 0.92, 0.935, 1.99, 2.45, -0.56, 0.56, rubber);
        // HOOD between the fenders: sloping gently to the grille, a centre crease and a badge.
        vtProfile(
          paint,
          [[2.78, 1.04], [4.41, 1.04], [4.41, 1.41], [4.27, 1.515], [3.3, 1.585], [2.78, 1.605]],
          -0.62,
          0.62,
          plain,
          0.05,
        );
        // (The profile's bevel grows its outline by 0.04 m: the top runs 1.645 → 1.555.)
        vtBeam(trim, S.box, [2.84, 1.646, 0], [3.3, 1.628, 0], 0.012, 0.03, bright, [0, 0, 1]);
        vtBeam(trim, S.box, [3.3, 1.628, 0], [4.22, 1.562, 0], 0.012, 0.03, bright, [0, 0, 1]);
        for (const s of sides) vtBox(trim, 3.6, 3.92, 1.32, 1.36, s * 0.622, s * 0.632, bright);
        // Hood hinge line / cowl seam and the side vents.
        for (const s of sides) vtBox(trim, 3.0, 3.34, 1.36, 1.5, s * 0.621, s * 0.628, { color: '#1b1c1e', finish: 'satin', cell: 'louvre' });
        // FENDERS: flared, over the front wheels, cut round the arch; amber side markers.
        const W = VT_WHEEL,
          archR = 0.66,
          archY = 0.8,
          dx = Math.sqrt(archR * archR - (archY - W.r) * (archY - W.r)),
          a0 = Math.atan2(archY - W.r, dx);
        for (const s of sides) {
          vtProfile(
            paint,
            [[2.78, 0.8], [W.front - dx, 0.8]],
            s * 0.6,
            s * 1.2,
            plain,
            0.035,
            (shape) => {
              shape.absarc(W.front * VT, W.r * VT, archR * VT, Math.PI - a0, a0, true);
              shape.lineTo(4.4 * VT, 0.8 * VT);
              shape.lineTo(4.4 * VT, 1.18 * VT);
              shape.quadraticCurveTo(4.37 * VT, 1.285 * VT, 4.1 * VT, 1.3 * VT);
              shape.lineTo(3.05 * VT, 1.29 * VT);
              shape.quadraticCurveTo(2.84 * VT, 1.27 * VT, 2.78 * VT, 1.18 * VT);
            },
          );
          // The arch's black rubber lip.
          for (let k = 0; k < 9; k++) {
            const a = Math.PI - a0 - ((Math.PI - 2 * a0) * (k + 0.5)) / 9,
              b = Math.PI - a0 - ((Math.PI - 2 * a0) * (k + 1.5)) / 9;
            if (k === 8) break;
            vtBeam(trim, S.box, [W.front + Math.cos(a) * (archR + 0.015), W.r + Math.sin(a) * (archR + 0.015), s * 1.19], [W.front + Math.cos(b) * (archR + 0.015), W.r + Math.sin(b) * (archR + 0.015), s * 1.19], 0.05, 0.04, rubber, [0, 0, 1]);
          }
          vtBox(indicators, 4.2, 4.32, 1.07, 1.12, s * 1.2, s * 1.215, amber);
        }
        // GRILLE: chrome surround, horizontal bars over black, the ATLAS badge.
        vtBox(trim, 4.45, 4.465, 0.84, 1.44, -0.5, 0.5, { color: '#0f1011', finish: 'satin', cell: 'mesh' });
        for (const [y0, y1, z0, z1] of [[1.41, 1.47, -0.53, 0.53], [0.8, 0.86, -0.53, 0.53], [0.8, 1.47, -0.53, -0.47], [0.8, 1.47, 0.47, 0.53]])
          vtBox(trim, 4.45, 4.49, y0, y1, z0, z1, bright);
        for (let k = 0; k < 7; k++) {
          const y = 0.9 + k * 0.075;
          vtBar(trim, [4.472, y, -0.47], [4.472, y, 0.47], 0.025, 0.02, 0.008, bright);
        }
        vtBox(trim, 4.485, 4.5, 1.3, 1.37, -0.14, 0.14, { color: '#c9a646', finish: 'chrome', cell: 'badge' });
        // Headlamp bezels (the lenses are the lamp meshes) and the amber indicators under them.
        for (const s of sides) {
          vtBox(trim, 4.428, 4.442, 0.9, 1.14, s * 0.66, s * 1.14, bright);
          vtBox(indicators, 4.43, 4.455, 0.83, 0.88, s * 0.9, s * 1.12, amber);
        }
        // BUMPER: chrome, rounded, the plate and two tow hooks.
        vtBar(trim, [4.6, 0.6, -1.22], [4.6, 0.6, 1.22], 0.3, 0.22, 0.05, bright);
        vtBox(trim, 4.705, 4.72, 0.51, 0.66, -0.16, 0.16, { color: '#f2f2ec', finish: 'plastic', cell: 'plate' });
        for (const s of sides) vtBox(trim, 4.62, 4.74, 0.42, 0.48, s * 0.5, s * 0.58, { color: '#8c1c1c', finish: 'gloss' });
        vtBox(trim, 4.45, 4.52, 0.5, 0.8, -0.9, 0.9, black);
        // MIRRORS: West Coast heads on tube arms from the doors, a round spot mirror under each.
        for (const s of sides) {
          for (const y of [1.88, 2.3]) vtBar(trim, [2.46, y, s * 1.11], [2.33, y, s * 1.32], 0.022, 0.022, 0.01, bright);
          vtBar(trim, [2.46, 1.95, s * 1.11], [2.33, 2.26, s * 1.32], 0.018, 0.018, 0.008, bright);
          vtBox(trim, 2.3, 2.38, 1.8, 2.38, s * 1.29, s * 1.4, black);
          vtBox(glass, 2.285, 2.3, 1.83, 2.35, s * 1.3, s * 1.39, {});
          vtCylinder(trim, S.cylinderLow, 2.34, 1.68, s * 1.33, 0.085, 0.05, 'x', black);
        }
        // FUEL TANK (left, the driver's step) and BATTERY BOX (right, a step on its lid).
        vtCylinder(trim, S.cylinder, 1.75, 0.68, -0.96, 0.26, 1.34, 'x', alloy);
        for (const x of [1.3, 2.2]) vtCylinder(trim, S.cylinderLow, x, 0.68, -0.96, 0.272, 0.06, 'x', black);
        vtCylinder(trim, S.cylinderLow, 1.95, 0.95, -0.98, 0.06, 0.04, 'y', bright);
        vtBox(trim, 1.4, 2.12, 0.94, 0.965, -1.2, -0.88, tread);
        vtBox(trim, 1.15, 2.3, 0.45, 0.93, 0.82, 1.17, black);
        vtBox(trim, 1.15, 2.3, 0.93, 0.955, 0.82, 1.19, tread);
        vtBox(trim, 1.45, 2.05, 0.5, 0.52, 0.82, 1.2, tread);
        // EXHAUST STACK behind the cab (right), perforated heat shield, curved tip.
        vtCylinder(trim, S.cylinder, 0.8, 2.05, 0.94, 0.065, 2.2, 'y', bright);
        vtCylinder(trim, S.tube, 0.8, 2.3, 0.94, 0.085, 0.9, 'y', { color: '#c5c9cc', finish: 'alloy', cell: 'perforated' });
        civAdd(trim, S.cylinder, 0.75 * VT, 3.19 * VT, 0.94 * VT, 0.065 * VT, 0.172 * VT, 0.065 * VT, bright, 0, 0, 0.62);
        for (const y of [1.55, 2.85]) vtBox(trim, 0.84, 0.95, y - 0.02, y + 0.02, 0.9, 0.98, black);
        // CHASSIS: rails, crossmembers, front axle and springs, driveshaft, rear axle and diff, air tanks.
        for (const s of sides) {
          vtBox(trim, -4.6, 4.3, 0.72, 0.98, s * 0.4, s * 0.48, frame);
          vtBox(trim, 3.0, 4.1, 0.58, 0.66, s * 0.38, s * 0.5, frame);
          vtBox(trim, -2.7, -1.1, 0.6, 0.7, s * 0.38, s * 0.5, frame);
        }
        for (const x of [4.25, 2.5, 0.2, -1.4, -3.2, -4.5]) vtBox(trim, x - 0.05, x + 0.05, 0.76, 0.94, -0.4, 0.4, frame);
        vtBox(trim, W.front - 0.06, W.front + 0.06, 0.44, 0.56, -0.98, 0.98, frame);
        vtCylinder(trim, S.cylinderLow, 0.2, 0.62, 0, 0.05, 3.7, 'x', frame);
        vtCylinder(trim, S.cylinderLow, W.rear, W.r, 0, 0.09, 1.52, 'z', frame);
        civAdd(trim, S.sphere, W.rear * VT, W.r * VT, 0.08 * VT, 0.24 * VT, 0.22 * VT, 0.2 * VT, frame);
        for (const z of [0.66, -0.66]) vtCylinder(trim, S.cylinderLow, -0.3, 0.74, z, 0.13, 1.05, 'x', { color: '#2a2c2f', finish: 'satin' });
        // DECK: hardwood planks over steel crossmembers, C-channel side rails with stake pockets,
        // rub rail and rope hooks; red and white conspicuity tape along the rails.
        const deckFront = 0.72,
          deckRear = -4.74,
          deckTop = VINNY_CARGO.deck;
        const plankColors = ['#7a5a3b', '#6d4f33', '#846341', '#735538', '#7c6a55', '#6a4c31', '#80603f', '#71533a', '#7a5d40', '#68513b', '#7f5f3d'];
        for (let k = 0; k < 11; k++) {
          const z0 = -1.13 + k * 0.2055;
          vtBox(trim, deckRear + 0.05, deckFront - 0.05, deckTop - 0.05, deckTop, z0 + 0.004, z0 + 0.2015, { color: plankColors[k], finish: 'matte' });
        }
        vtBox(trim, deckRear + 0.05, deckFront - 0.05, deckTop - 0.08, deckTop - 0.05, -1.13, 1.13, { color: '#221a13', finish: 'matte' });
        for (let x = 0.45; x > deckRear; x -= 0.6) vtBox(trim, x - 0.04, x + 0.04, 1.03, deckTop - 0.08, -1.15, 1.15, frame);
        for (const s of sides) {
          vtBox(trim, deckRear, deckFront, 1.06, deckTop + 0.02, s * 1.17, s * 1.225, frame);
          vtBox(trim, deckRear, deckFront, 1.09, 1.12, s * 1.225, s * 1.24, frame);
          for (let x = deckFront - 0.3; x > deckRear + 0.1; x -= 0.56) {
            vtBox(trim, x - 0.045, x + 0.045, 1.15, 1.27, s * 1.224, s * 1.232, { color: '#060606', finish: 'satin' });
            vtBox(trim, x - 0.03, x + 0.03, 0.99, 1.06, s * 1.19, s * 1.23, frame);
          }
          // Conspicuity tape: alternating red and white blocks on the rail's lower lip.
          let k = 0;
          for (let x = deckFront - 0.2; x > deckRear + 0.2; x -= 0.34, k++)
            vtBox(trim, x - 0.15, x + 0.15, 1.062, 1.086, s * 1.225, s * 1.229, { color: k % 2 ? '#e9e9e4' : '#c2262c', finish: 'lens' });
          // A red side marker at the rear of each rail, amber at the front.
          vtBox(markers, deckRear + 0.12, deckRear + 0.22, 1.14, 1.2, s * 1.228, s * 1.244, red);
          vtBox(markers, deckFront - 0.24, deckFront - 0.14, 1.14, 1.2, s * 1.228, s * 1.244, amber);
        }
        // HEADACHE RACK: square-tube frame, black mesh panel, two work lamps facing aft.
        const rackX = 0.66;
        for (const z of [-1.16, 0, 1.16]) vtBox(trim, rackX - 0.04, rackX + 0.04, deckTop, 2.88, z - 0.04, z + 0.04, frame);
        for (const y of [2.86, 2.08]) vtBox(trim, rackX - 0.04, rackX + 0.04, y - 0.035, y + 0.035, -1.2, 1.2, frame);
        vtBox(trim, rackX - 0.01, rackX + 0.01, deckTop + 0.04, 2.82, -1.12, 1.12, { color: '#141517', finish: 'satin', cell: 'mesh' });
        for (const s of sides) {
          vtBox(trim, rackX - 0.12, rackX - 0.04, 2.83, 2.95, s * 0.62 - 0.08, s * 0.62 + 0.08, black);
          vtBox(trim, rackX - 0.125, rackX - 0.12, 2.845, 2.935, s * 0.62 - 0.065, s * 0.62 + 0.065, { color: '#eef1f2', finish: 'lens' });
        }
        // REAR: sill with three red ID lamps, the lamp bar, plate, underride bar with tape, mud flaps.
        vtBox(trim, deckRear, deckRear + 0.07, 1.13, deckTop + 0.02, -1.225, 1.225, frame);
        for (const z of [-0.26, 0, 0.26]) vtBox(markers, deckRear - 0.012, deckRear, 1.19, 1.25, z - 0.045, z + 0.045, red);
        for (const s of sides) vtBox(markers, deckRear - 0.012, deckRear, 1.19, 1.25, s * 1.08, s * 1.17, red);
        vtBox(trim, deckRear, deckRear + 0.08, 0.94, 1.13, -1.16, 1.16, frame);
        for (const s of sides) {
          vtBox(indicators, deckRear - 0.012, deckRear, 0.98, 1.1, s * 0.62, s * 0.8, amber);
          vtBox(trim, deckRear - 0.012, deckRear, 0.98, 1.1, s * 0.44, s * 0.58, { color: '#eef1f2', finish: 'lens' });
          vtBox(trim, deckRear - 0.006, deckRear, 0.96, 1.12, s * 0.42, s * 1.13, black);
        }
        vtBox(trim, deckRear - 0.012, deckRear, 0.97, 1.12, -0.16, 0.16, { color: '#f2f2ec', finish: 'plastic', cell: 'plate' });
        vtBox(trim, -4.6, -4.5, 0.42, 0.58, -1.1, 1.1, frame);
        for (let k = 0; k < 6; k++) {
          const z = -1.0 + k * 0.4;
          vtBox(trim, -4.605, -4.598, 0.45, 0.55, z - 0.19, z + 0.19, { color: k % 2 ? '#e9e9e4' : '#c2262c', finish: 'lens' });
        }
        for (const s of sides) vtBox(trim, -4.58, -4.5, 0.58, 0.96, s * 0.4, s * 0.48, frame);
        for (const s of sides) {
          vtBox(trim, -2.6, -2.5, 0.84, 0.9, s * 0.44, s * 1.2, frame);
          vtBox(trim, -2.57, -2.555, 0.14, 0.86, s * 0.6, s * 1.2, rubber);
          vtBox(trim, -2.58, -2.575, 0.18, 0.3, s * 0.64, s * 1.16, { color: '#9da2a6', finish: 'alloy' });
        }
        const lamps = {};
        for (const s of sides) {
          const head = civSet(),
            tail = civSet();
          for (const z of [0.8, 1.02]) vtBox(head, 4.435, 4.452, 0.93, 1.11, s * (z - 0.095), s * (z + 0.095), { color: '#f7f4ea', finish: 'lens' });
          vtBox(tail, deckRear - 0.014, deckRear, 0.98, 1.1, s * 0.84, s * 1.1, { color: '#e3261c', finish: 'lens' });
          lamps['head' + (s < 0 ? 'Left' : 'Right')] = civGeometry(head);
          lamps['tail' + (s < 0 ? 'Left' : 'Right')] = civGeometry(tail);
        }
        // WHEELS: a tyre, a dual pair, and steel Budd discs (front with a chrome cap, rear dished out).
        const W2 = VT_WHEEL,
          tyreUnit = civTyreGeometry('road', 0.58),
          m4 = (x, y, z, sx, sy, sz, rx) => new Three.Matrix4().compose(new Three.Vector3(x, y, z), new Three.Quaternion().setFromEuler(new Three.Euler(rx, 0, 0)), new Three.Vector3(sx, sy, sz)),
          rw = W2.r * VT,
          ww = W2.width * VT,
          tyre = vtCopies(tyreUnit, [m4(0, 0, 0, rw, ww, rw, Math.PI / 2)]),
          dual = vtCopies(tyreUnit, [m4(0, 0, -W2.dualGap * VT, rw, ww, rw, Math.PI / 2), m4(0, 0, W2.dualGap * VT, rw, ww, rw, Math.PI / 2)]);
        const rim = (side, kind) => {
          const set = civSet(),
            face = (kind === 'dual' ? W2.dualGap + W2.width * 0.36 : W2.width * 0.36) * side,
            R = W2.r * 0.58,
            steel = { color: '#e6e3dc', finish: 'satin' },
            disc = (r, t, z, options, geo = S.cylinder) => vtCylinder(set, geo, 0, 0, z, r, t, 'z', options);
          disc(R, 0.02, face - side * 0.05, { color: '#2c2e31', finish: 'satin' });
          disc(R * 0.985, 0.03, face, steel);
          civAdd(set, S.torus, 0, 0, (face + side * 0.012) * VT, R * 0.98 * VT, R * 0.98 * VT, 1.1 * VT, steel);
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU + 0.3;
            civAdd(set, S.cylinderLow, Math.cos(a) * R * 0.66 * VT, Math.sin(a) * R * 0.66 * VT, (face + side * 0.012) * VT, R * 0.14 * VT, 0.012 * VT, R * 0.14 * VT, { color: '#101112', finish: 'satin' }, Math.PI / 2, 0, 0);
          }
          const hubOut = kind === 'dual' ? 0.07 : 0.03;
          disc(R * 0.42, hubOut + 0.02, face + side * (hubOut / 2 + 0.01), { color: '#3a3d41', finish: 'satin' });
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU;
            civAdd(set, S.hex, Math.cos(a) * R * 0.36 * VT, Math.sin(a) * R * 0.36 * VT, (face + side * (hubOut + 0.03)) * VT, 0.022 * VT, 0.04 * VT, 0.022 * VT, bright, Math.PI / 2, 0, 0);
          }
          civAdd(set, S.dome, 0, 0, (face + side * (hubOut + 0.02)) * VT, R * (kind === 'dual' ? 0.3 : 0.27) * VT, (kind === 'dual' ? 0.1 : 0.07) * VT, R * (kind === 'dual' ? 0.3 : 0.27) * VT, bright, (side * Math.PI) / 2, 0, 0);
          if (kind === 'dual') disc(R * 0.95, 0.03, -side * (W2.dualGap - W2.width * 0.36), { color: '#9a9994', finish: 'satin' });
          return civGeometry(set);
        };
        vinnyKitCache = {
          paint: civGeometry(paint),
          trim: civGeometry(trim),
          glass: civGeometry(glass, { colors: false, finish: false }),
          markers: civGeometry(markers),
          indicators: civGeometry(indicators),
          lamps,
          tyre,
          dual,
          rims: { front: [rim(-1, 'front'), rim(1, 'front')], dual: [rim(-1, 'dual'), rim(1, 'dual')] },
        };
        return vinnyKitCache;
      }
      function vinnySharedMaterials() {
        if (vinnyShared) return vinnyShared;
        vinnyShared = {
          markerOff: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.1, color: new Three.Color(0.62, 0.55, 0.5), emissive: new Three.Color(0.05, 0.02, 0) }),
          markerOn: new Three.MeshBasicMaterial({ vertexColors: true, color: new Three.Color(2.3, 1.9, 1.7) }),
        };
        for (const m of Object.values(vinnyShared)) sharedMaterials.add(m);
        return vinnyShared;
      }
      // ---- The model ----
      function makeVinnyTruck(vehicle) {
        const kit = vinnyKit(),
          materials = civSharedMaterials(),
          lampMaterials = civLampSet(),
          own = vinnySharedMaterials(),
          group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        const livery = vinnyLivery(),
          finish = { roughness: 0.38, metalness: 0.08 },
          paint = civPaintMaterial(vehicle.color, livery, finish);
        mesh(kit.paint, paint, body, 0, 0, 0);
        mesh(kit.trim, materials.trim, body, 0, 0, 0);
        const glass = mesh(kit.glass, materials.glass, body, 0, 0, 0),
          markers = mesh(kit.markers, own.markerOff, body, 0, 0, 0),
          indicators = mesh(kit.indicators, own.markerOff, body, 0, 0, 0);
        glass.castShadow = markers.castShadow = indicators.castShadow = false;
        const W = VT_WHEEL,
          wheels = [];
        for (const [front, x] of [[true, W.front], [false, W.rear]])
          for (const side of [-1, 1]) {
            const wheel = new Three.Group();
            wheel.position.set(x * VT, W.r * VT, side * (front ? W.frontZ : W.dualZ) * VT);
            body.add(wheel);
            // The tyre stays the wheel's first child (hidden on a burnt wreck).
            mesh(front ? kit.tyre : kit.dual, materials.rubber, wheel, 0, 0, 0);
            mesh(kit.rims[front ? 'front' : 'dual'][side < 0 ? 0 : 1], materials.wheel, wheel, 0, 0, 0);
            wheels.push({ wheel, side, front, radius: W.r * VT });
          }
        const lamps = [],
          nightLights = [];
        for (const side of [-1, 1]) {
          for (const kind of ['head', 'tail']) {
            const key = kind + (side < 0 ? 'Left' : 'Right'),
              lit = kind === 'head' ? lampMaterials.headOff : lampMaterials.tailOff,
              lamp = mesh(kit.lamps[key], lit, body, 0, 0, 0);
            lamp.castShadow = false;
            lamps.push({ mesh: lamp, key, lit, kind });
          }
          // Head, tail per side: the order lampOut expects (damage3d.js).
          nightLights.push(halo(body, 4.5 * VT, 1.02 * VT, side * 0.91 * VT, 11, '#ffe9bd'), halo(body, -4.8 * VT, 1.04 * VT, side * 0.97 * VT, 7, '#ff5a44'));
        }
        // The crates the crane loads, one per VINNY_CARGO slot (shown by cargoCount, render3d-frame.js).
        const cargo = VINNY_CARGO.slots.map((x) => {
          const crate = makeCargoCrate(body, 28);
          crate.position.set(x * VT, VINNY_CARGO.deck * VT, 0);
          crate.scale.setScalar(VINNY_CARGO.scale);
          crate.visible = false;
          return crate;
        });
        const wiperHost = {};
        addWipers(wiperHost, body, 2.66 * VT, 1.84 * VT, 2.5 * VT, 2.28 * VT, 1.0 * VT);
        const model = {
          wipers: wiperHost.wipers,
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          civilian: true,
          vinnyTruck: true,
          realSize: true,
          wheels,
          lamps,
          damageVersion: -1,
          nightLights,
          cargo,
          glass: materials.glass,
          liveryMap: livery,
          liveryColor: null,
          finish,
          extra: {
            animate: (c, m, deltaSeconds, driven, lampsOn) => {
              const lit = driven && lampsOn > 0.25;
              markers.material = lit ? own.markerOn : own.markerOff;
              // Hazards: the mission truck blinks while it waits for its driver.
              const hazard = !driven && c.mission && c.hp > 0 && gameTime % 0.9 < 0.45;
              indicators.material = hazard ? own.markerOn : own.markerOff;
              const lights = c.damage?.lights;
              m.lampOut = lights ? [lights.headLeft, lights.tailLeft, lights.headRight, lights.tailRight] : null;
              // A burnt shell loses its lettering with the paint (restored with a repair, paintVehicle).
              if (m.charred && m.paint.map) {
                m.paint.map = null;
                m.paint.needsUpdate = true;
              }
            },
          },
        };
        return model;
      }
