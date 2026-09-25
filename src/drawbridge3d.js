      // BEGIN SUBSYSTEM: src/drawbridge3d.js — The Palm Sound drawbridge in 3D
      /**
       * The Palm Sound drawbridge in 3D
       * Source: src/drawbridge3d.js
       * Scope: createCityRenderer() closure, included just before bridges3d.js;
       * buildDrawbridge() is the Palm Sound Causeway's builder there (called while
       * the bridges are built, so it may use every bridges3d helper), and
       * updateDrawbridgeVisuals() runs each frame from updateBridgeVisuals().
       * Nothing here runs at include time.
       *
       * A double-leaf trunnion bascule in the Chicago manner, drawn from the same
       * layout the game uses (bridgeStructure 's.bascule', drawbridge.js):
       *   leaves     each a group hinged `drop` below the road at its trunnion:
       *              carriageway and footways in the deck's own materials (the
       *              markings and lamp light run on), open steel grid decking
       *              over the joint and a finger lock at the tips, ornamental
       *              railings, tapered fascia and main girders, floor beams,
       *              stringers and lateral bracing under the deck (seen as the
       *              leaf stands up), the trunnion shaft and the counterweight
       *              swinging down into the pier's pit, red / green tip lights
       *   piers      rusticated granite with cutwaters, platforms for the four
       *              limestone tender's houses (copper hip roofs, glazed
       *              lookouts lit at night), the south-east one the two-storey
       *              control house with its vessel signal mast and horn
       *   fenders    timber pile walls up and down the channel, red lights on
       *              their dolphins
       *   gates      per approach two kerb cabinets with red / white striped
       *              arms (lamps along them), short sidewalk arms, wig-wag
       *              lamps, a mast-arm traffic signal (red / amber / green) and
       *              a stop line; an advance DRAWBRIDGE AHEAD sign with amber
       *              flashers. A snapped arm leaves a stub and its boom on the road
       *   ketch      ALBATROSS, the tall-masted ketch the bridge opens for,
       *              built with the boat kit the first frame she is needed
       * Signal lenses are shared MeshBasicMaterials switched each frame; the lit
       * ones get soft halos (Points), hidden while dark.
       */
      const drawbridgeView = { built: false, leaves: [], arms: [], lenses: [], glows: [], ketch: null };
      // A signal lens: dark glass until switched on, then its colour, bright enough to bloom.
      function drawbridgeLens(color, key) {
        const m = new Three.MeshBasicMaterial({ color: '#1a1c1e', toneMapped: false });
        m.userData.lens = { key, on: new Three.Color(color), off: new Three.Color(color).multiplyScalar(0.07) };
        drawbridgeView.lenses.push(m);
        return m;
      }
      // Halos round a set of lamps of one kind, in `parent`'s frame.
      function drawbridgeGlow(parent, points, color, key, size = 14) {
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3));
        geo.computeBoundingSphere();
        const material = new Three.PointsMaterial({ map: haloTx, color, size, transparent: true, opacity: 0, depthWrite: false, blending: Three.AdditiveBlending });
        material.userData.worldSize = size;
        const cloud = new Three.Points(geo, material);
        cloud.userData.dynamic = true;
        cloud.renderOrder = 6;
        cloud.visible = false;
        parent.add(cloud);
        drawbridgeView.glows.push({ cloud, material, key });
        return cloud;
      }
      // A box whose underside slopes from `bottom0` at x0 to `bottom1` at x1 (a tapered girder).
      function drawbridgeTaper(parent, x0, x1, top, bottom0, bottom1, z, depth, material) {
        const geo = new Three.BoxGeometry(1, 1, 1),
          pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const t = pos.getX(i) + 0.5,
            x = x0 + (x1 - x0) * t,
            y = pos.getY(i) > 0 ? top : bottom0 + (bottom1 - bottom0) * t;
          pos.setXYZ(i, x, y, z + pos.getZ(i) * depth);
        }
        geo.computeVertexNormals();
        return mesh(geo, material, parent, 0, 0, 0);
      }
      // Open steel grid decking: bearing bars and cross bars, the holes cut by alpha test.
      let drawbridgeGratingMaterial = null;
      function drawbridgeGrating() {
        if (drawbridgeGratingMaterial) return drawbridgeGratingMaterial;
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        const c = cv.getContext('2d');
        c.clearRect(0, 0, 64, 64);
        c.fillStyle = '#9aa2a6';
        for (let x = 0; x < 64; x += 8) c.fillRect(x, 0, 3, 64);
        c.fillStyle = '#7f878b';
        for (let y = 0; y < 64; y += 16) c.fillRect(0, y, 64, 2);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.anisotropy = 4;
        drawbridgeGratingMaterial = new Three.MeshStandardMaterial({ map: tx, alphaTest: 0.45, roughness: 0.42, metalness: 0.75, side: Three.DoubleSide });
        return drawbridgeGratingMaterial;
      }
      // A flat grating panel, `length` along x and `width` across, one tile every 4 units.
      function drawbridgeGratingPanel(parent, x, y, z, length, width) {
        const geo = new Three.PlaneGeometry(length, width),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * length) / 4, (uv.getY(i) * width) / 4);
        const m = mesh(geo, drawbridgeGrating(), parent, x, y, z);
        m.rotation.x = -Math.PI / 2;
        return m;
      }
      /* ---- The leaves --------------------------------------------------------------- */
      function drawbridgeLeaf(g, bridge, s, dir, paint) {
        const W = bridge.width,
          half = W / 2,
          road = W - 22,
          b = s.bascule,
          L = b.leaf,
          d = b.drop,
          hinge = b.trunnions[dir > 0 ? 0 : 1],
          mats = g.userData.deckMaterials,
          leaf = new Three.Group(),
          X = (x) => dir * x,
          iron = tint('#1f2a2a', 'satin'),
          steel = tint('#58625f', 'metal'),
          concrete = tint('#7c7a72', 'matte');
        leaf.name = 'drawbridge leaf';
        leaf.position.set(hinge, -d, 0);
        leaf.userData.dynamic = true;
        leaf.userData.lightCloud = true;
        g.add(leaf);
        // Where along the whole deck a leaf piece starts (for the road's uv).
        const startOf = (x0, x1) => (dir > 0 ? hinge + x0 : hinge - x1) - mats.from;
        const top = d + 0.4,
          roadEnd = L - 14,
          tipEnd = L - 0.75;
        // Carriageway (the deck's own shaded surface) and the open grid over the joint.
        mesh(bridgeRoadGeometry(roadEnd - 0.6, road, 0.4, 0, startOf(0.6, roadEnd)), mats.road, leaf, X((0.6 + roadEnd) / 2), d + 0.2, 0);
        drawbridgeGratingPanel(leaf, X((roadEnd + tipEnd) / 2), top - 0.05, 0, tipEnd - roadEnd, road);
        // The grid's frame and the bearing bars' supports seen through it.
        for (const z of [-road / 2 + 0.6, road / 2 - 0.6]) box(leaf, X((roadEnd + tipEnd) / 2), top - 0.5, z, tipEnd - roadEnd, 1, 1.2, steel);
        for (let x = roadEnd; x <= tipEnd; x += 3.4) box(leaf, X(x), top - 1.3, 0, 0.6, 2.4, road, iron);
        box(leaf, X(roadEnd), top - 0.2, 0, 0.8, 0.5, road, steel);
        // Finger lock at the tip: this leaf's teeth in every other slot, meshing with the other's.
        for (let k = 0, z = -road / 2 + 1.5; z < road / 2 - 1; z += 3, k++)
          if ((k + (dir > 0 ? 0 : 1)) % 2 === 0) box(leaf, X(tipEnd + 0.6), top - 0.15, z, 2.6, 0.3, 1.9, steel);
        box(leaf, X(tipEnd - 0.4), top - 2.4, 0, 0.8, 4.4, W - 2, iron);
        // Footways and kerbs.
        for (const side of [-1, 1]) {
          mesh(bridgeRoadGeometry(tipEnd - 0.6, 11, 1.1, side * (half - 5.5), startOf(0.6, tipEnd)), mats.walk, leaf, X((0.6 + tipEnd) / 2), d + 0.55, side * (half - 5.5));
          mesh(bridgeRoadGeometry(tipEnd - 0.6, 0.8, 1.24, side * (road / 2 + 0.4), startOf(0.6, tipEnd)), mats.kerb, leaf, X((0.6 + tipEnd) / 2), d + 0.62, side * (road / 2 + 0.4));
          box(leaf, X((0.6 + tipEnd) / 2), d + 1.26, side * (road / 2 + 0.12), tipEnd - 0.6, 0.06, 0.25, BRIDGE_KIT.white);
          // Ornamental railing: posts with caps, top and bottom rails, close balusters.
          const z = side * (half - 1);
          box(leaf, X((0.6 + tipEnd) / 2), top + 7.4, z, tipEnd - 1, 0.9, 1.3, paint);
          box(leaf, X((0.6 + tipEnd) / 2), top + 2.1, z, tipEnd - 1, 0.7, 1.1, paint);
          for (let x = 2; x < tipEnd - 1; x += 2.2) box(leaf, X(x), top + 4.7, z, 0.35, 4.6, 0.35, paint);
          for (let x = 1.2; x < tipEnd; x += 12.4) {
            box(leaf, X(x), top + 4.2, z, 1.5, 8.4, 1.5, paint);
            mesh(sphereGeo, paint, leaf, X(x), top + 8.9, z, 0.9, 0.9, 0.9);
          }
          // Fascia girder outside the rail, deep at the trunnion and shallow at the tip,
          // with flanges and stiffeners; a main girder under each kerb.
          drawbridgeTaper(leaf, X(-12), X(tipEnd), d - 0.2, d - 15, d - 4.8, side * (half + 0.7), 1.3, paint);
          drawbridgeTaper(leaf, X(-12), X(tipEnd), d - 0.2, d - 15.4, d - 5.2, side * (half + 1.4), 0.3, iron);
          box(leaf, X((tipEnd - 12) / 2), d - 0.1, side * (half + 0.9), tipEnd + 12, 0.7, 2.6, iron);
          for (let x = 4; x < tipEnd - 2; x += 8) {
            const depth = 15 - (10 * (x + 12)) / (tipEnd + 12);
            box(leaf, X(x), d - depth / 2, side * (half + 1.5), 0.6, depth - 0.8, 0.5, iron);
          }
          drawbridgeTaper(leaf, X(-14), X(tipEnd - 1), d - 1, d - 14, d - 5, side * (road / 2 + 2), 1.6, steel);
          // Tip lanterns for shipping: red while the bridge is down, green when it is open.
          const lx = X(tipEnd - 1.6),
            lz = side * (half + 2.4);
          box(leaf, lx, top + 9.6, lz, 1.8, 5.2, 1.8, iron);
          box(leaf, lx, top + 11.2, lz + side * 0.95, 1.1, 1.1, 0.2, drawbridgeView.tipRed);
          box(leaf, lx, top + 8.8, lz + side * 0.95, 1.1, 1.1, 0.2, drawbridgeView.tipGreen);
          box(leaf, lx, top + 12.4, lz, 2.2, 0.5, 2.2, iron);
        }
        drawbridgeGlow(leaf, [-1, 1].map((side) => V3(X(tipEnd - 1.6), top + 11.2, side * (half + 3.6))), '#ff4a3c', 'tipRed', 12);
        drawbridgeGlow(leaf, [-1, 1].map((side) => V3(X(tipEnd - 1.6), top + 8.8, side * (half + 3.6))), '#3dff7a', 'tipGreen', 12);
        // Floor system: cross girders every 8, stringers, bottom lateral bracing.
        for (let x = 4; x < tipEnd - 2; x += 8) box(leaf, X(x), d - 3.4, 0, 1.2, 5.6, road + 4, iron);
        for (let z = -road / 2 + 7; z < road / 2 - 5; z += 11.5) box(leaf, X(roadEnd / 2), d - 1.4, z, roadEnd - 1, 2.2, 1.1, steel);
        for (let x = 0; x < tipEnd - 16; x += 16) {
          const y = d - 11 + (6 * x) / tipEnd,
            y2 = d - 11 + (6 * (x + 16)) / tipEnd,
            zz = road / 2 + 1;
          bridgeMember(leaf, V3(X(x), y, -zz), V3(X(x + 16), y2, zz), 0.7, 0.7, steel);
          bridgeMember(leaf, V3(X(x), y, zz), V3(X(x + 16), y2, -zz), 0.7, 0.7, steel);
        }
        // Trunnion shaft and hubs; the tail girders and the counterweight behind them.
        const shaft = mesh(cylinderGeo, steel, leaf, 0, 0, 0, 2.6, W + 8, 2.6);
        shaft.rotation.x = Math.PI / 2;
        for (const side of [-1, 1]) {
          const hub = mesh(cylinderGeo, iron, leaf, 0, 0, side * (half + 2.4), 5, 3.4, 5);
          hub.rotation.x = Math.PI / 2;
        }
        box(leaf, X(-30), d - 20, 0, 34, 24, road + 8, concrete);
        box(leaf, X(-30), d - 7.6, 0, 36, 1.4, road + 10, iron);
        for (const side of [-1, 1]) bridgeMember(leaf, V3(X(-12), d - 2, side * (road / 2 + 2)), V3(X(-44), d - 10, side * (road / 2 + 2)), 1.4, 1.4, iron);
        drawbridgeView.leaves.push({ group: leaf, dir });
        return leaf;
      }
      /* ---- Piers, fenders and houses -------------------------------------------------- */
      // A Beaux-Arts tender's house: granite plinth, limestone walls with quoins,
      // tall windows, a glazed lookout and a copper hip roof. `main` is the
      // two-storey control house.
      function drawbridgeHouse(g, h, s, kit, main) {
        const out = Math.sign(h.across),
          x = h.along,
          z = h.across,
          stone = tint('#e6dfcf', 'satin'),
          granite = tint('#8d887e', 'matte'),
          copper = tint('#5f9583', 'matte'),
          iron = tint('#1f2a2a', 'satin'),
          door = tint('#3a2a1e', 'satin'),
          w = main ? 32 : 22,
          dz = main ? 22 : 18,
          body = main ? 27 : 16,
          base = 1.4;
        box(g, x, base + 1.5, z, w + 2.4, 3, dz + 2.4, granite);
        box(g, x, base + 3 + body / 2, z, w, body, dz, stone);
        // Quoins at the corners.
        for (const cx of [-1, 1])
          for (const cz of [-1, 1])
            for (let y = base + 4; y < base + 3 + body - 1; y += 3.6)
              box(g, x + cx * (w / 2 - 0.4), y + 0.9, z + cz * (dz / 2 - 0.4), ((y / 3.6) | 0) % 2 ? 2.6 : 1.9, 1.7, ((y / 3.6) | 0) % 2 ? 1.9 : 2.6, stone);
        // Windows: on the long faces toward the channel and the land, the short outer face.
        const rows = main ? [base + 8, base + 20] : [base + 8];
        for (const y0 of rows) {
          for (const face of [-1, 1]) {
            const n = main ? 3 : 2;
            for (let k = 0; k < n; k++) {
              const zz = z + (k - (n - 1) / 2) * (dz / n);
              box(g, x + face * (w / 2 + 0.05), y0 + 4, zz, 0.3, 8, 3.6, BRIDGE_KIT.glass);
              box(g, x + face * (w / 2 + 0.3), y0 - 0.3, zz, 0.8, 0.6, 4.8, stone);
              box(g, x + face * (w / 2 + 0.3), y0 + 8.6, zz, 0.8, 1.2, 4.8, stone);
              box(g, x + face * (w / 2 + 0.2), y0 + 4, zz, 0.3, 8, 0.3, iron);
            }
          }
          box(g, x, y0 + 4, z + out * (dz / 2 + 0.05), w * 0.34, 8, 0.3, BRIDGE_KIT.glass);
          box(g, x, y0 + 8.6, z + out * (dz / 2 + 0.3), w * 0.4, 1.2, 0.8, stone);
        }
        // Door on the footway side, lanterns either side of it.
        const inZ = z - out * (dz / 2 + 0.15);
        box(g, x, base + 3 + 4.5, inZ, 4.4, 9, 0.4, door);
        box(g, x, base + 3 + 9.6, inZ - out * 0.2, 6, 1.2, 0.6, stone);
        for (const dx of [-4.2, 4.2]) {
          box(g, x + dx, base + 10.5, inZ - out * 0.6, 0.9, 1.6, 0.9, bridgeLampMaterial);
          kitLight(kit.lights, g, x + dx, base + 10.5, inZ - out * 1.2, '#ffd29a');
        }
        // Cornice, glazed lookout and copper hip roof.
        const corniceY = base + 3 + body;
        box(g, x, corniceY + 0.7, z, w + 1.8, 1.4, dz + 1.8, stone);
        box(g, x, corniceY + 1.7, z, w + 0.6, 0.6, dz + 0.6, granite);
        const cabW = main ? w - 2 : w - 4,
          cabD = main ? dz - 2 : dz - 4,
          cabH = main ? 10 : 8,
          cabY = corniceY + 2;
        box(g, x, cabY + cabH / 2, z, cabW, cabH, cabD, BRIDGE_KIT.glass);
        for (const cx of [-1, 1]) for (const cz of [-1, 1]) box(g, x + (cx * cabW) / 2, cabY + cabH / 2, z + (cz * cabD) / 2, 1, cabH, 1, stone);
        for (let k = 1; k < 4; k++)
          for (const face of [-1, 1]) {
            box(g, x + face * (cabW / 2), cabY + cabH / 2, z - cabD / 2 + (cabD * k) / 4, 0.4, cabH, 0.4, iron);
            box(g, x - cabW / 2 + (cabW * k) / 4, cabY + cabH / 2, z + face * (cabD / 2), 0.4, cabH, 0.4, iron);
          }
        box(g, x, cabY + cabH + 0.6, z, cabW + 2.4, 1.2, cabD + 2.4, stone);
        const roofH = main ? 12 : 9,
          roof = mesh(new Three.ConeGeometry(Math.SQRT1_2, 1, 4, 1), copper, g, x, cabY + cabH + 1.2 + roofH / 2, z, cabW + 3, roofH, cabD + 3);
        roof.rotation.y = Math.PI / 4;
        mesh(sphereGeo, copper, g, x, cabY + cabH + roofH + 1.6, z, 1.1, 1.1, 1.1);
        box(g, x, cabY + cabH + roofH + 3.4, z, 0.35, 3, 0.35, iron);
        for (const dx of [-cabW / 2 + 2, cabW / 2 - 2]) kitLight(kit.lights, g, x + dx, cabY + cabH / 2, z, '#ffcf8c');
        if (!main) return cabY + cabH + roofH + 5;
        // The control house: a balcony round the lookout, the vessel signal mast
        // (red / green to each way up the channel), the horn and a floodlight.
        box(g, x, cabY - 0.2, z, w + 5, 0.8, dz + 5, stone);
        for (const [sx, sz, lx, lz] of [
          [0, 1, w + 5, 0.5],
          [0, -1, w + 5, 0.5],
          [1, 0, 0.5, dz + 5],
          [-1, 0, 0.5, dz + 5],
        ]) {
          box(g, x + (sx * (w + 5)) / 2, cabY + 3.2, z + (sz * (dz + 5)) / 2, lx, 0.5, lz, iron);
          box(g, x + (sx * (w + 5)) / 2, cabY + 1.6, z + (sz * (dz + 5)) / 2, lx, 0.3, lz, iron);
        }
        const mastX = x + w / 2 - 4,
          mastZ = z,
          mastTop = cabY + cabH + roofH + 16;
        box(g, mastX, (cabY + cabH + mastTop) / 2, mastZ, 1.2, mastTop - cabY - cabH, 1.2, iron);
        for (const face of [-1, 1]) {
          const fz = mastZ + face * 1.6;
          box(g, mastX, mastTop - 5, fz, 3, 8, 0.6, iron);
          box(g, mastX, mastTop - 2.6, fz + face * 0.4, 1.8, 1.8, 0.3, drawbridgeView.navRed);
          box(g, mastX, mastTop - 6.4, fz + face * 0.4, 1.8, 1.8, 0.3, drawbridgeView.navGreen);
        }
        drawbridgeGlow(g, [-1, 1].map((face) => V3(mastX, mastTop - 2.6, mastZ + face * 2.6)), '#ff4a3c', 'navRed', 16);
        drawbridgeGlow(g, [-1, 1].map((face) => V3(mastX, mastTop - 6.4, mastZ + face * 2.6)), '#3dff7a', 'navGreen', 16);
        const horn = mesh(new Three.ConeGeometry(1.6, 4, 10, 1, true), iron, g, mastX - 2.6, mastTop - 11, mastZ, 1, 1, 1);
        horn.rotation.z = Math.PI / 2;
        box(g, mastX, mastTop + 0.6, mastZ, 0.3, 1.6, 0.3, iron);
        kitLight(kit.lights, g, mastX, mastTop + 1.6, mastZ, '#ff5040');
        bridgePlaque(g, 'BRIDGE TENDER', 'PALM SOUND BASCULE · 1926', '#e9e3d0', '#39463f', 18, x, corniceY - 3, z - out * (dz / 2 + 0.3), out > 0 ? Math.PI : 0);
        return mastTop;
      }
      // Timber fender wall from the pier face out along the channel, ending in a dolphin.
      function drawbridgeFender(g, f, bridge, kit) {
        const W = bridge.width,
          out = Math.sign(f.across),
          z0 = out * (W / 2 + 30),
          z1 = out * (W / 2 + 190),
          timber = tint('#5a4636', 'matte'),
          wale = tint('#6b5442', 'matte'),
          cap = tint('#2a2e30', 'metal'),
          len = Math.abs(z1 - z0),
          mid = (z0 + z1) / 2;
        for (let z = z0; Math.abs(z - z0) <= len; z += out * 10) mesh(cylinderGeo, timber, g, f.along, -6, z, 1.3, 16, 1.3);
        for (const y of [1.6, -1.2, -4]) box(g, f.along, y, mid, 2.4, 1.6, len, wale);
        box(g, f.along, 2.6, mid, 3, 0.5, len, cap);
        // The dolphin: a cluster of piles lashed together, a red light on a post.
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2,
            r = k ? 3.2 : 0;
          mesh(cylinderGeo, timber, g, f.along + Math.cos(a) * r, -5, z1 + out * 4 + Math.sin(a) * r, 1.4, k ? 18 : 22, 1.4);
        }
        box(g, f.along, 3.6, z1 + out * 4, 7.6, 1.2, 7.6, cap);
        box(g, f.along, 7, z1 + out * 4, 0.6, 6, 0.6, cap);
        box(g, f.along, 10.4, z1 + out * 4, 1.4, 1.4, 1.4, drawbridgeView.fenderRed);
        kitLight(kit.lights, g, f.along, 10.4, z1 + out * 4, '#ff3a2a');
        return V3(f.along, 10.4, z1 + out * 4);
      }
      /* ---- Gates, signals and signs ---------------------------------------------------- */
      /* One barrier: a kerb cabinet, the long striped arm over its half of the
         road (lamps along it) and the short arm over the footway, hinged at the
         cabinet. Arms are built lying down and swing up about the deck's axis. */
      function drawbridgeGate(g, arm, bridge, kit) {
        const W = bridge.width,
          half = W / 2,
          road = W - 22,
          side = arm.side,
          x = arm.u,
          cz = side * (road / 2 + 2.8),
          red = tint('#c8262a', 'gloss'),
          white = tint('#f2f0ea', 'gloss'),
          black = tint('#15181a', 'satin'),
          // Gloss like the stripes, so an arm merges into as few meshes as possible.
          housing = tint('#15181a', 'gloss'),
          cabinet = tint('#e6dfc8', 'satin'),
          stripe = tint('#e0b020', 'gloss');
        // Cabinet on the footway, hazard-striped plinth, wig-wag lamps on a crossbar.
        box(g, x, 1.4 + 4.6, cz, 3.4, 9.2, 3.2, cabinet);
        for (let k = 0; k < 3; k++) box(g, x, 1.4 + 0.6 + k * 1.2, cz, 3.5, 0.6, 3.3, k % 2 ? black : stripe);
        box(g, x, 1.4 + 9.6, cz, 3.8, 0.6, 3.6, black);
        box(g, x, 1.4 + 14, cz, 0.8, 8, 0.8, black);
        box(g, x, 1.4 + 17.4, cz, 0.6, 0.6, 9, black);
        for (const [dz, lens] of [
          [-3.4, drawbridgeView.flashA],
          [3.4, drawbridgeView.flashB],
        ]) {
          box(g, x, 1.4 + 17.4, cz + dz, 1.4, 3.4, 3.4, black);
          for (const face of [-1, 1]) box(g, x + face * 0.75, 1.4 + 17.4, cz + dz, 0.2, 2.2, 2.2, lens);
        }
        const pivotY = 1.4 + 7.6;
        // The long arm.
        const long = new Three.Group(),
          whole = new Three.Group(),
          stub = new Three.Group(),
          length = road / 2 + 1.6;
        long.position.set(x, pivotY, cz - side * 1.9);
        long.userData.dynamic = true;
        g.add(long);
        long.add(whole, stub);
        // Merged apart, so a snapped arm can lose its boom and keep the stub.
        whole.userData.dynamic = stub.userData.dynamic = true;
        for (let k = 0, zz = 0; zz < length; zz += 4, k++) {
          const seg = Math.min(4, length - zz),
            thick = 1.3 - (0.5 * zz) / length,
            target = zz < 5 ? stub : whole;
          box(target, 0, 0, -side * (zz + seg / 2), thick, thick, seg, k % 2 ? white : red);
        }
        for (const t of [0.34, 0.66, 0.97]) {
          box(whole, 0, 1.2, -side * length * t, 1.2, 1.2, 1.4, housing);
          for (const face of [-1, 1]) box(whole, face * 0.65, 1.2, -side * length * t, 0.15, 0.8, 0.8, drawbridgeView.armLamp);
        }
        box(stub, 0, 0, side * 2.4, 1.6, 2.2, 3.6, housing);
        const merge = (group) => {
          for (const m of kitMerge(group)) {
            m.name = 'drawbridge arm';
            farHidden.push(m);
          }
        };
        merge(whole);
        merge(stub);
        // The short footway arm, hinged on the cabinet's outer face.
        const walkArm = new Three.Group();
        walkArm.position.set(x, pivotY, cz + side * 1.9);
        walkArm.userData.dynamic = true;
        g.add(walkArm);
        const walkLength = half - 1 - Math.abs(cz) - 1.9;
        for (let k = 0, zz = 0; zz < walkLength; zz += 2.4, k++) box(walkArm, 0, 0, side * (zz + Math.min(2.4, walkLength - zz) / 2), 0.8, 0.8, Math.min(2.4, walkLength - zz), k % 2 ? white : red);
        merge(walkArm);
        // The boom lying on the road where a car snapped it, shown once broken.
        const fallen = new Three.Group();
        fallen.position.set(x + (arm.approach < 0 ? 9 : -9), 1, cz - side * (length * 0.55));
        fallen.rotation.y = side * arm.approach * 0.35;
        fallen.userData.dynamic = true;
        fallen.visible = false;
        g.add(fallen);
        for (let k = 0, zz = 5; zz < length; zz += 4, k++) box(fallen, 0, 0, -side * (zz - length * 0.55), 1, 1, Math.min(4, length - zz), k % 2 ? white : red);
        merge(fallen);
        drawbridgeView.arms.push({ arm, long, whole, stub, walkArm, fallen });
        return V3(x, 1.4 + 17.4, cz);
      }
      // A three-aspect signal head facing `face` along x (-1 west): backplate with a reflective border.
      function drawbridgeSignalHead(g, x, y, z, face) {
        const black = tint('#15181a', 'satin'),
          border = tint('#e8c23a', 'gloss');
        box(g, x - face * 0.5, y, z, 0.4, 13.4, 6.4, border);
        box(g, x, y, z, 1.8, 12.6, 5.6, black);
        [
          [4, drawbridgeView.sigRed],
          [0, drawbridgeView.sigAmber],
          [-4, drawbridgeView.sigGreen],
        ].forEach(([dy, lens]) => {
          const disc = mesh(cylinderGeo, lens, g, x + face * 0.95, y + dy, z, 1.5, 0.2, 1.5);
          disc.rotation.z = Math.PI / 2;
          box(g, x + face * 1.9, y + dy + 1.4, z, 2, 0.3, 3.4, black);
        });
        return [4, 0, -4].map((dy) => V3(x + face * 1.4, y + dy, z));
      }
      /* The approach's signals: a mast arm over the lanes into the bridge with two
         heads and a STOP HERE ON RED sign, and the DRAWBRIDGE AHEAD sign with
         amber flashers further back. */
      function drawbridgeApproach(g, bridge, s, approach, kit, heads) {
        const W = bridge.width,
          half = W / 2,
          b = s.bascule,
          face = approach,
          side = -approach,
          gate = b.gates[approach < 0 ? 0 : 1],
          stop = b.stops[approach < 0 ? 0 : 1],
          x = gate + approach * 5,
          z = side * (half + 2.4),
          pole = tint('#2c3336', 'satin'),
          white = tint('#f3f1ea', 'matte');
        box(g, x, 17, z, 1.6, 34, 1.6, pole);
        box(g, x, 33, z - side * 20, 1.1, 1.1, 42, pole);
        bridgeMember(g, V3(x, 27, z), V3(x, 33, z - side * 10), 0.7, 0.7, pole);
        for (const dz of [16, 34]) {
          box(g, x, 30.4, z - side * dz, 0.4, 3, 0.4, pole);
          heads.push(...drawbridgeSignalHead(g, x, 22.4, z - side * dz, face));
        }
        heads.push(...drawbridgeSignalHead(g, x, 11, z + side * 0.4, face));
        bridgePlaque(g, 'DRAWBRIDGE', 'STOP HERE ON RED SIGNAL', '#f3f1ea', '#1b1d1f', 12, x + face * 0.4, 31, z - side * 25, face < 0 ? -Math.PI / 2 : Math.PI / 2);
        // Stop line across the lanes into the bridge.
        box(g, stop, 0.44, (side * (W - 22)) / 4, 3.2, 0.06, (W - 22) / 2 - 2, white);
        // Advance warning with two amber flashers that wig-wag while the bridge works.
        const wx = stop + approach * 150,
          wz = side * (half + 2.4);
        box(g, wx, 11, wz, 1.2, 22, 1.2, pole);
        box(g, wx, 17, wz - side * 6, 0.6, 9, 13, tint('#e7c53a', 'matte'));
        bridgePlaque(g, 'DRAWBRIDGE AHEAD', 'PREPARE TO STOP WHEN FLASHING', '#e7c53a', '#161616', 12, wx + face * 0.4, 17, wz - side * 6, face < 0 ? -Math.PI / 2 : Math.PI / 2);
        const flashers = [];
        for (const [dz, lens, key] of [
          [-4, drawbridgeView.warnA, 'warnA'],
          [4, drawbridgeView.warnB, 'warnB'],
        ]) {
          const fz = wz - side * 6 + dz;
          box(g, wx, 23.4, fz, 1.4, 2.6, 2.6, pole);
          const disc = mesh(cylinderGeo, lens, g, wx + face * 0.8, 23.4, fz, 1, 0.2, 1);
          disc.rotation.z = Math.PI / 2;
          flashers.push({ key, point: V3(wx + face * 1.3, 23.4, fz) });
        }
        return flashers;
      }
      /* ---- Build (called by bridges3d's BRIDGE_BUILDERS.bascule) ---------------------- */
      function buildDrawbridge(g, bridge, s, kit) {
        const W = bridge.width,
          half = W / 2,
          b = s.bascule,
          iron = tint('#1f2a2a', 'satin'),
          paint = bridgeGlowPaint('#46615a', '#ffdca6', 0.22, 'satin'),
          granite = tint('#8f8a80', 'matte'),
          v = drawbridgeView;
        v.sigRed = drawbridgeLens('#ff2a1c', 'sigRed');
        v.sigAmber = drawbridgeLens('#ffb020', 'sigAmber');
        v.sigGreen = drawbridgeLens('#22ff8a', 'sigGreen');
        v.flashA = drawbridgeLens('#ff2a1c', 'flashA');
        v.flashB = drawbridgeLens('#ff2a1c', 'flashB');
        v.armLamp = drawbridgeLens('#ff3322', 'armLamp');
        v.warnA = drawbridgeLens('#ffb020', 'warnA');
        v.warnB = drawbridgeLens('#ffb020', 'warnB');
        v.tipRed = drawbridgeLens('#ff3a2a', 'tipRed');
        v.tipGreen = drawbridgeLens('#2aff6a', 'tipGreen');
        v.navRed = drawbridgeLens('#ff3a2a', 'navRed');
        v.navGreen = drawbridgeLens('#2aff6a', 'navGreen');
        v.fenderRed = drawbridgeLens('#ff3a2a', 'fenderRed');
        // The fixed deck up to each trunnion; the leaves carry the rest.
        bridgeDeck(g, bridge, s, { fascia: BRIDGE_KIT.concrete, rail: guardBalustrade(BRIDGE_KIT.white, BRIDGE_KIT.kerb), gap: [b.trunnions[0] + 0.5, b.trunnions[1] - 0.5] });
        for (const p of s.approach) approachPier(g, bridge, p, BRIDGE_KIT.concrete);
        // The bascule piers: granite with cutwaters, a platform each side for the houses,
        // a heel joint where the fixed deck meets each leaf.
        for (const [i, p] of b.piers.entries()) {
          cutwaterPier(g, p, b.pier / 2 + 1, half + 28, -14, -0.8, BRIDGE_KIT.stone);
          for (let y = -12; y < -1; y += 3.5) box(g, p, y, 0, b.pier + 2.4, 0.5, W + 58, granite);
          for (const side of [-1, 1]) {
            box(g, p, 0.3, side * (half + 15), b.pier + 2, 2.2, 26, BRIDGE_KIT.stone);
            box(g, p, 1.46, side * (half + 15), b.pier + 2.2, 0.1, 26.2, granite);
            // Balustrade round each platform's outer edges.
            box(g, p, 6.6, side * (half + 27.4), b.pier, 1.2, 2.4, BRIDGE_KIT.kerb);
            for (let x = -b.pier / 2 + 2.5; x < b.pier / 2; x += 5) box(g, p + x, 3.9, side * (half + 27.4), 1.4, 4.2, 1.4, BRIDGE_KIT.white);
            for (const end of [-1, 1]) {
              box(g, p + end * (b.pier / 2 + 0.2), 6.6, side * (half + 14.5), 2.4, 1.2, 26, BRIDGE_KIT.kerb);
              box(g, p + end * (b.pier / 2 + 0.2), 3.9, side * (half + 14.5), 1.6, 4.2, 26, BRIDGE_KIT.white);
            }
          }
          const hinge = b.trunnions[i];
          box(g, hinge + (i ? 0.9 : -0.9), 0.43, 0, 1.4, 0.08, W - 22, BRIDGE_KIT.darkSteel);
          // The channel face of the pier under the leaf's toe: dressed granite and a steel nosing.
          box(g, hinge + (i ? 1 : -1), -7, 0, 2, 13, W + 6, granite);
        }
        for (const dir of [1, -1]) drawbridgeLeaf(g, bridge, s, dir, paint);
        for (const leaf of v.leaves)
          for (const mm of kitMerge(leaf.group)) {
            mm.name = 'drawbridge leaf';
            farHidden.push(mm);
          }
        // Tender's houses and the control house.
        for (const h of b.houses) drawbridgeHouse(g, h, s, kit, h.main);
        const fenderLights = b.fenders.map((f) => drawbridgeFender(g, f, bridge, kit));
        drawbridgeGlow(g, fenderLights, '#ff3a2a', 'fenderRed', 12);
        // Ornamental lamps: globe standards along the approaches, triple lamps at the piers.
        bridgeLamps(g, bridge, s, kit.lights, kit.pools, 56, 'globe', iron, [[b.trunnions[0] - b.pier - 30, b.trunnions[1] + b.pier + 30]]);
        for (const p of b.piers) for (const end of [-1, 1]) for (const side of [-1, 1]) bridgeLampPost(g, p + end * (b.pier / 2 + 6), side, W, 'globe', iron, kit.lights, kit.pools);
        // Gates, signals and signs.
        const flash = [],
          heads = [];
        for (const arm of drawbridgeArms()) flash.push(drawbridgeGate(g, arm, bridge, kit));
        const warn = [];
        for (const approach of [-1, 1]) warn.push(...drawbridgeApproach(g, bridge, s, approach, kit, heads));
        drawbridgeGlow(g, flash.map((p) => V3(p.x, p.y, p.z - 3.4)), '#ff2a1c', 'flashA', 10);
        drawbridgeGlow(g, flash.map((p) => V3(p.x, p.y, p.z + 3.4)), '#ff2a1c', 'flashB', 10);
        drawbridgeGlow(g, heads.filter((_, i) => i % 3 === 0), '#ff2a1c', 'sigRed', 9);
        drawbridgeGlow(g, heads.filter((_, i) => i % 3 === 1), '#ffb020', 'sigAmber', 9);
        drawbridgeGlow(g, heads.filter((_, i) => i % 3 === 2), '#22ff8a', 'sigGreen', 9);
        drawbridgeGlow(g, warn.filter((f) => f.key === 'warnA').map((f) => f.point), '#ffb020', 'warnA', 9);
        drawbridgeGlow(g, warn.filter((f) => f.key === 'warnB').map((f) => f.point), '#ffb020', 'warnB', 9);
        // Name plaques on the approach piers.
        for (const [x, rot] of [
          [s.water[0] - 20, -Math.PI / 2],
          [s.water[1] + 20, Math.PI / 2],
        ])
          for (const side of [-1, 1]) {
            box(g, x, 5, side * (half + 6), 5, 10, 5, BRIDGE_KIT.stone);
            if (side > 0) bridgePlaque(g, 'PALM SOUND', 'CAUSEWAY · 1926', '#e9e3d0', '#39463f', 20, x + (rot < 0 ? -2.6 : 2.6), 6, side * (half + 6), rot);
          }
        aviationBeacons(g, b.houses.map((h) => V3(h.along, h.main ? 66 : 50, h.across)));
        v.group = g;
        v.built = true;
      }
      /* ---- The ketch ------------------------------------------------------------------ */
      // ALBATROSS: navy hull with a gold cove line, teak decks, varnished deckhouse,
      // main and mizzen masts with their sails furled under blue covers.
      function buildDrawbridgeKetch() {
        const d = { len: DRAWBRIDGE_VESSEL.length, beam: DRAWBRIDGE_VESSEL.beam, hull: '#1c3350', accent: '#1d3f6e' },
          l = d.len,
          bm = d.beam,
          g = new Three.Group(),
          lights = kitLightList(),
          varnish = tint('#7a4a26', 'gloss'),
          spar = tint('#b9874f', 'satin');
        g.name = 'ALBATROSS';
        g.userData.lightCloud = true;
        scene.add(g);
        const spec = yachtSpec(d, {
          draft: l * 0.09,
          sheer: [
            [-0.5, 12],
            [-0.05, 10],
            [0.5, 16],
          ],
          form: { transom: 0.5, maxAt: -0.06, entry: 1.8, bowShape: 0.8, sternCurve: 1.6 },
          rake: 0.2,
          stemCurve: 1.5,
          bilge: 2.2,
          colors: { boot: '#e9dfc2', bands: [[0.84, 0.9, '#d8b25a']] },
        });
        hullMesh(g, spec);
        hullDeck(g, spec, 10, -l * 0.5, l * 0.48, 0.9, kitTeak);
        deckhouse(g, deckOutline(-l * 0.2, l * 0.08, bm * 0.3, l * 0.05, 3), 10, 16, { paint: varnish, glassFrom: 0.3, glassTo: 0.72 });
        deckhouse(g, deckOutline(l * 0.12, l * 0.24, bm * 0.22, l * 0.04, 3), 10, 13.5, { paint: varnish, glassFrom: 0.35, glassTo: 0.7 });
        box(g, -l * 0.36, 9.4, 0, l * 0.16, 1, bm * 0.5, kitTeak);
        wheel(g, -l * 0.42, 10, 0, 3.6);
        const head = sailRig(g, spec, l * 0.1, 10, l * 1.18, { color: spar, stay: tint('#aeb4b8', 'metal') }),
          mizzenHead = sailRig(g, spec, -l * 0.3, 10, l * 0.78, { color: spar, backstay: true, bow: l * 0.1 });
        boom(g, l * 0.1, 17, l * 0.34, d.accent, '#b9874f');
        boom(g, -l * 0.3, 16, l * 0.2, d.accent, '#b9874f');
        furledJib(g, spec, l * 0.1, head, 10);
        box(g, l * 0.6, sheerAt(spec, l * 0.5) - 0.5, 0, l * 0.2, 1.6, 1.6, spar);
        strut(g, [l * 0.1, head, 0], [l * 0.7, sheerAt(spec, l * 0.5), 0], 0.35, tint('#aeb4b8', 'metal'));
        for (const side of [-1, 1]) railing(g, hullEdge(spec, 10, -l * 0.46, l * 0.44, 0.9, 10).map(([u, vv]) => [u, side * vv]), 10, 4, { material: varnish });
        // Navigation lights: masthead, side lights (red port, green starboard), stern light.
        kitLight(lights, g, l * 0.1, head * 0.62, 0, '#ffffff');
        kitLight(lights, g, l * 0.1, head + 1, 0, '#ff4030');
        kitLight(lights, g, -l * 0.3, mizzenHead + 1, 0, '#ffffff');
        kitLight(lights, g, l * 0.3, 13, -bm * 0.42, '#ff3a2a');
        kitLight(lights, g, l * 0.3, 13, bm * 0.42, '#3dff7a');
        kitLight(lights, g, -l * 0.5, 13, 0, '#ffffff');
        for (const u of [-l * 0.16, -l * 0.04, l * 0.16]) kitLight(lights, g, u, 14, 0, '#ffcf8a');
        for (const mm of kitMerge(g)) mm.name = 'ALBATROSS';
        kitLightCloud(lights, 9);
        return g;
      }
      /* ---- Per frame ----------------------------------------------------------------- */
      function updateDrawbridgeVisuals() {
        const v = drawbridgeView;
        if (!v.built) return;
        const d = drawbridge,
          night = nightAmount,
          lit = clamp(night * 1.3 - 0.1, 0, 1);
        for (const leaf of v.leaves) leaf.group.rotation.z = leaf.dir * d.angle;
        for (const a of v.arms) {
          const up = (1 - a.arm.pos) * (Math.PI / 2);
          a.long.rotation.x = a.arm.side * up;
          a.walkArm.rotation.x = -a.arm.side * up;
          a.whole.visible = !a.arm.broken;
          a.fallen.visible = a.arm.broken;
        }
        // Lamp states: steady, flashing (1 Hz, the pairs alternating) or dark.
        const blink = Math.sin(gameTime * Math.PI * 2 * 0.9) > 0,
          working = d.phase !== 'idle',
          amberPhase = d.phase === 'warning' && d.timer < 3,
          armsDown = d.arms && d.arms.some((a) => a.pos > 0.05),
          open = d.angle > 0.004,
          fullyOpen = d.phase === 'open' && d.held === null,
          levels = {
            sigGreen: working ? 0 : 1,
            sigAmber: amberPhase ? 1 : 0,
            sigRed: working && !amberPhase ? 1 : 0,
            flashA: working && blink ? 1 : 0,
            flashB: working && !blink ? 1 : 0,
            armLamp: armsDown ? (blink ? 1 : 0.35) : 0,
            warnA: working && blink ? 1 : 0,
            warnB: working && !blink ? 1 : 0,
            tipRed: fullyOpen ? 0 : 1,
            tipGreen: fullyOpen ? 1 : 0,
            navRed: fullyOpen ? 0 : 1,
            navGreen: fullyOpen ? 1 : 0,
            fenderRed: 1,
          },
          bright = 1.4 + lit * 2.2;
        for (const m of v.lenses) {
          const lens = m.userData.lens,
            level = levels[lens.key] ?? 0;
          m.color.copy(lens.off).lerp(drawbridgeColor.copy(lens.on).multiplyScalar(bright), level);
        }
        const buffer = sceneBufferSize(kitSizeVector),
          ortho = camera.isOrthographicCamera,
          pixelsPerUnit = ortho
            ? buffer.y / Math.max(1, (camera.top - camera.bottom) / (camera.zoom || 1))
            : buffer.y / 2 / Math.tan(((camera.fov || 50) * Math.PI) / 360);
        for (const glow of v.glows) {
          const level = levels[glow.key] ?? 0,
            opacity = level * (0.28 + 0.72 * lit);
          glow.cloud.visible = opacity > 0.01;
          glow.material.opacity = opacity;
          glow.material.sizeAttenuation = !ortho;
          glow.material.size = glow.material.userData.worldSize * (ortho ? pixelsPerUnit : pixelsPerUnit / (buffer.y / 2));
        }
        // The ketch: built the first time she is needed, then follows the game's vessel.
        const vessel = d.vessel;
        if (vessel) {
          if (!v.ketch) {
            v.ketch = buildDrawbridgeKetch();
            v.ketchFloat = 0;
          }
          const k = v.ketch;
          k.position.set(vessel.x, 0.4 + Math.sin(gameTime * 1.1 + 0.7) * 0.4, vessel.y);
          k.rotation.y = -vessel.a;
          k.rotation.x = Math.sin(gameTime * 0.9) * 0.02;
          k.rotation.z = Math.sin(gameTime * 1.3 + 1) * 0.015;
          const far = Math.abs(vessel.x - viewCenter.x) > viewReach + 400 || Math.abs(vessel.y - viewCenter.y) > viewReach + 400;
          k.visible = !far && !farSceneryShown;
          if (k.visible && vessel.speed > 1) wakeEmit(vessel, vessel.x, vessel.y, vessel.a, vessel.speed, DRAWBRIDGE_VESSEL.length, DRAWBRIDGE_VESSEL.beam, 120, true);
        }
      }
      const drawbridgeColor = new Three.Color();
      // END SUBSYSTEM: src/drawbridge3d.js
