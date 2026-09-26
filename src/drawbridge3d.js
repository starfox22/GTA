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
       *   leaves     each a group hinged `drop` below the road at its trunnion, 44 m
       *              long: carriageway and footways in the deck's own materials
       *              (the markings and lamp light run on), open steel grid decking
       *              over the joint and a finger lock at the tips, ornamental
       *              railings and globe lamps, two deep outboard main girders
       *              (5.5 m at the trunnion, 1.8 m at the tip, floodlit at night),
       *              the floor system seen from below as the leaf stands up (cross
       *              girders, stringers, lateral bracing), red / green tip
       *              lanterns, the centre lock bars (withdrawn and driven home,
       *              `drawbridge.locks`); behind the trunnion each girder's tail
       *              carries a curved rack and a counterweight
       *   piers      granite, with the nose running under the leaf's heel and two
       *              open counterweight pits flanking the fixed deck, 17 m deep:
       *              the counterweights swing down into them as the leaves rise,
       *              the racks rolling through pinions on shafts across each pit.
       *              The pits reach below the sea, so a depth mask over their
       *              openings (drawn after the pit and the leaves, before the
       *              water) keeps the water plane out of them. Platforms beyond the
       *              pits carry the four limestone tender's houses (copper hip
       *              roofs, lookouts lit at night), the south-east one the
       *              two-storey control house with its vessel signal mast and horn;
       *              floodlights on the pier noses throw beams onto the raised
       *              leaves after dark
       *   fenders    timber pile walls up and down the channel, red lights on
       *              their dolphins
       *   gates      per approach two kerb cabinets with red / white striped
       *              arms (lamps along them), short sidewalk arms, wig-wag
       *              lamps, a mast-arm traffic signal (red / amber / green) and
       *              a stop line; an advance DRAWBRIDGE AHEAD sign with amber
       *              flashers. A snapped arm leaves a stub and its boom on the road
       *   water      drips and spray off the rising leaves (one points cloud)
       *   ship       ALBATROSS, the brigantine the bridge opens for (square sails
       *              on the foremast, gaff main, three headsails, set as she gets
       *              under way; deck lights dressed overall), built with the boat
       *              kit the first frame she is needed
       * Signal lenses are shared MeshBasicMaterials switched each frame; the lit
       * ones get soft halos (Points), hidden while dark.
       */
      const drawbridgeView = { built: false, leaves: [], arms: [], lenses: [], glows: [], pinions: [], locks: [], floodlit: [], ship: null };
      // Drawn before the pit mask (renderOrder -2), which is drawn before the water.
      const DRAWBRIDGE_PIT_ORDER = -3;
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
      // Steel that the floodlights pick out at night (its emissive driven per frame).
      function drawbridgeFloodlit(color, glow, finish = 'satin') {
        const m = new Three.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 0, ...KIT_FINISHES[finish] });
        drawbridgeView.floodlit.push(m);
        return m;
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
      /* A ring segment about the z axis (a curved rack's body): radius r0..r1, from
         angle a0 to a1, z0..z1 across. */
      function drawbridgeArc(parent, r0, r1, a0, a1, z0, z1, material, segments = 10) {
        const data = kitMeshData(),
          ring = (r, z) => {
            const out = [];
            for (let i = 0; i <= segments; i++) {
              const a = a0 + ((a1 - a0) * i) / segments;
              out.push(kitVertex(data, Math.cos(a) * r, Math.sin(a) * r, z));
            }
            return out;
          },
          rows = [ring(r1, z0), ring(r1, z1), ring(r0, z1), ring(r0, z0)];
        for (let k = 0; k < 4; k++) {
          const a = rows[k],
            b = rows[(k + 1) % 4];
          for (let i = 0; i < segments; i++) data.indices.push(a[i], b[i], b[i + 1], a[i], b[i + 1], a[i + 1]);
        }
        const geo = kitGeometry(data);
        geo.computeVertexNormals();
        return mesh(geo, material, parent, 0, 0, 0);
      }
      /* ---- The leaves --------------------------------------------------------------- */
      /* Across the leaf: road to ±45, footways to ±56 (railing at 55), the main
         girders outboard at ±G, their counterweights further out, clear of the pit
         walls (bridgeStructure's `pit`). The rack sits between girder and
         counterweight at radius DRAWBRIDGE_RACK about the trunnion. */
      const DRAWBRIDGE_RACK = 36,
        DRAWBRIDGE_PINION = 6;
      function drawbridgeLayout(bridge, s) {
        const half = bridge.width / 2,
          G = half + 6;
        return {
          half,
          road: bridge.width - 22,
          G,
          girderW: 5,
          /* The counterweight: along -104..-52 behind the trunnion, 48 deep from the
             road and 50 across (6.5 x 6.25 x 6 m each, about 590 t of concrete),
             clear of the pinion's shaft (inside radius 52) and of the pit's walls
             through the whole swing. */
          cw: { x0: -104, x1: -52, z0: G + 6.5, z1: G + 56.5, depth: 48 },
          rackZ: G + 4.5,
          pinionRadius: DRAWBRIDGE_RACK + DRAWBRIDGE_PINION - 1,
          // The rack spans the angles the pinion (fixed, straight below-behind the
          // trunnion at 250 degrees) sees as the leaf swings 0..78 degrees.
          pinionAngle: (250 * Math.PI) / 180,
        };
      }
      function drawbridgeLeaf(g, bridge, s, dir, paint, kit) {
        const W = bridge.width,
          lay = drawbridgeLayout(bridge, s),
          half = lay.half,
          road = lay.road,
          G = lay.G,
          b = s.bascule,
          L = b.leaf,
          d = b.drop,
          hinge = b.trunnions[dir > 0 ? 0 : 1],
          mats = g.userData.deckMaterials,
          leaf = new Three.Group(),
          X = (x) => dir * x,
          iron = tint('#1f2a2a', 'satin'),
          steel = drawbridgeView.underside,
          concrete = tint('#8a867c', 'matte'),
          hazard = tint('#e0b020', 'gloss'),
          black = tint('#15181a', 'gloss'),
          brass = tint('#b08a3a', 'metal');
        leaf.name = 'drawbridge leaf';
        leaf.position.set(hinge, -d, 0);
        leaf.userData.dynamic = true;
        leaf.userData.lightCloud = true;
        g.add(leaf);
        // Where along the whole deck a leaf piece starts (for the road's uv).
        const startOf = (x0, x1) => (dir > 0 ? hinge + x0 : hinge - x1) - mats.from;
        const top = d + 0.4,
          roadEnd = L - 14,
          tipEnd = L - 0.75,
          girderTop = d + 1.25,
          depthAt = (x) => 44 - (30 * Math.max(0, x)) / L;
        // Carriageway (the deck's own shaded surface) and the open grid over the joint.
        mesh(bridgeRoadGeometry(roadEnd - 0.6, road, 0.4, 0, startOf(0.6, roadEnd)), mats.road, leaf, X((0.6 + roadEnd) / 2), d + 0.2, 0);
        drawbridgeGratingPanel(leaf, X((roadEnd + tipEnd) / 2), top - 0.05, 0, tipEnd - roadEnd, road);
        // The grid's frame and the bearing bars' supports seen through it.
        for (const z of [-road / 2 + 0.6, road / 2 - 0.6]) box(leaf, X((roadEnd + tipEnd) / 2), top - 0.5, z, tipEnd - roadEnd, 1, 1.2, iron);
        for (let x = roadEnd; x <= tipEnd; x += 3.4) box(leaf, X(x), top - 1.3, 0, 0.6, 2.4, road, iron);
        box(leaf, X(roadEnd), top - 0.2, 0, 0.8, 0.5, road, iron);
        // Finger lock at the tip: this leaf's teeth in every other slot, meshing with the other's.
        for (let k = 0, z = -road / 2 + 1.5; z < road / 2 - 1; z += 3, k++)
          if ((k + (dir > 0 ? 0 : 1)) % 2 === 0) box(leaf, X(tipEnd + 0.6), top - 0.15, z, 2.6, 0.3, 1.9, iron);
        box(leaf, X(tipEnd - 0.4), top - 3.4, 0, 0.8, 6.4, W, iron);
        // Footways and kerbs.
        for (const side of [-1, 1]) {
          mesh(bridgeRoadGeometry(tipEnd - 0.6, 11, 1.1, side * (half - 5.5), startOf(0.6, tipEnd)), mats.walk, leaf, X((0.6 + tipEnd) / 2), d + 0.55, side * (half - 5.5));
          mesh(bridgeRoadGeometry(tipEnd - 0.6, 0.8, 1.24, side * (road / 2 + 0.4), startOf(0.6, tipEnd)), mats.kerb, leaf, X((0.6 + tipEnd) / 2), d + 0.62, side * (road / 2 + 0.4));
          box(leaf, X((0.6 + tipEnd) / 2), d + 1.26, side * (road / 2 + 0.12), tipEnd - 0.6, 0.06, 0.25, BRIDGE_KIT.white);
          // The footway's edge plate out to the main girder.
          box(leaf, X((0.6 + tipEnd) / 2), d + 0.9, side * (half + 1.6), tipEnd - 0.6, 0.7, 3.4, iron);
          // Ornamental railing: posts with caps, top and bottom rails, close balusters.
          const z = side * (half - 1);
          box(leaf, X((0.6 + tipEnd) / 2), top + 7.4, z, tipEnd - 1, 0.9, 1.3, paint);
          box(leaf, X((0.6 + tipEnd) / 2), top + 2.1, z, tipEnd - 1, 0.7, 1.1, paint);
          for (let x = 2; x < tipEnd - 1; x += 2.6) box(leaf, X(x), top + 4.7, z, 0.35, 4.6, 0.35, paint);
          for (let x = 1.2; x < tipEnd; x += 12.4) {
            box(leaf, X(x), top + 4.2, z, 1.5, 8.4, 1.5, paint);
            mesh(sphereGeo, paint, leaf, X(x), top + 8.9, z, 0.9, 0.9, 0.9);
          }
          /* The main girder: a deep riveted plate girder outboard of the footway,
             5.5 m at the trunnion tapering to 1.8 m at the tip, and behind the
             trunnion its tail down to the counterweight. Flanges, a cover plate and
             stiffeners on the outer face. */
          const gz = side * G;
          drawbridgeTaper(leaf, X(-6), X(tipEnd), girderTop, girderTop - depthAt(0), girderTop - depthAt(tipEnd), gz, lay.girderW, paint);
          box(leaf, X(-56), girderTop - 22, gz, 100, 44, lay.girderW, paint);
          box(leaf, X((tipEnd - 106) / 2), girderTop + 0.35, gz, tipEnd + 106, 0.7, lay.girderW + 1.6, iron);
          drawbridgeTaper(leaf, X(-6), X(tipEnd), girderTop - depthAt(0) + 1.2, girderTop - depthAt(0), girderTop - depthAt(tipEnd), gz, lay.girderW + 1.4, iron);
          box(leaf, X(-56), girderTop - 43.4, gz, 100, 1.2, lay.girderW + 1.4, iron);
          for (let x = -100; x < tipEnd - 3; x += 11) {
            const depth = depthAt(x) - 1;
            box(leaf, X(x), girderTop - depth / 2, side * (G + lay.girderW / 2 + 0.3), 0.8, depth, 0.6, iron);
          }
          // Tip lanterns for shipping: red while the bridge is down, green when it is open.
          const lx = X(tipEnd - 1.6),
            lz = side * (G + 3.6);
          box(leaf, lx, top + 9.6, lz, 1.8, 5.2, 1.8, iron);
          box(leaf, lx, top + 11.2, lz + side * 0.95, 1.1, 1.1, 0.2, drawbridgeView.tipRed);
          box(leaf, lx, top + 8.8, lz + side * 0.95, 1.1, 1.1, 0.2, drawbridgeView.tipGreen);
          box(leaf, lx, top + 12.4, lz, 2.2, 0.5, 2.2, iron);
          /* The tail: counterweight (reinforced concrete in a steel box, a yellow
             edge band on top so it reads from above), its brackets off the girder,
             and the curved rack between them, teeth outward. */
          const c = lay.cw,
            cz = side * ((c.z0 + c.z1) / 2);
          box(leaf, X((c.x0 + c.x1) / 2), top - c.depth / 2, cz, c.x1 - c.x0, c.depth, c.z1 - c.z0, concrete);
          // Its top and back faces striped yellow and black, so it reads from above as it sinks.
          box(leaf, X((c.x0 + c.x1) / 2), top + 0.15, cz, c.x1 - c.x0 + 0.6, 0.5, c.z1 - c.z0 + 0.6, hazard);
          for (let x = c.x0 + 3; x < c.x1 - 2; x += 8) box(leaf, X(x), top + 0.45, cz, 3.6, 0.2, c.z1 - c.z0 - 2, black);
          box(leaf, X(c.x0 - 0.3), top - c.depth / 2, cz, 0.6, c.depth, c.z1 - c.z0, hazard);
          for (let y = top - 4; y > top - c.depth; y -= 8) box(leaf, X(c.x0 - 0.5), y, cz, 0.3, 3.6, c.z1 - c.z0 - 2, black);
          for (const x of [c.x0 + 1, c.x1 - 1]) box(leaf, X(x), top - c.depth + 1, cz, 2.4, 2, c.z1 - c.z0 + 0.8, iron);
          for (const x of [c.x0 + 6, (c.x0 + c.x1) / 2]) box(leaf, X(x), top - 20, side * (G + 4.5), 4, 40, 4, iron);
          const rz = side * lay.rackZ,
            a0 = lay.pinionAngle - DRAWBRIDGE_MAX_ANGLE - 0.08,
            a1 = lay.pinionAngle + 0.08,
            // In the leaf's frame the rack runs over the same angles, mirrored for the east leaf.
            arc = (a) => (dir > 0 ? a : Math.PI - a);
          const rackGroup = new Three.Group();
          leaf.add(rackGroup);
          drawbridgeArc(rackGroup, DRAWBRIDGE_RACK - 6, DRAWBRIDGE_RACK - 1.2, Math.min(arc(a0), arc(a1)), Math.max(arc(a0), arc(a1)), rz - 1.8, rz + 1.8, brass, 16);
          for (let a = a0; a <= a1; a += 2.2 / DRAWBRIDGE_RACK) {
            const t = mesh(boxGeo, brass, rackGroup, Math.cos(arc(a)) * (DRAWBRIDGE_RACK - 0.4), Math.sin(arc(a)) * (DRAWBRIDGE_RACK - 0.4), rz, 1.6, 1.3, 3.2);
            t.rotation.z = arc(a);
          }
          // Spokes from the trunnion hub out to the rack.
          for (const f of [0.2, 0.55, 0.9]) {
            const a = arc(a0 + (a1 - a0) * f);
            bridgeMember(leaf, V3(0, 0, rz), V3(Math.cos(a) * (DRAWBRIDGE_RACK - 7), Math.sin(a) * (DRAWBRIDGE_RACK - 7), rz), 2.2, 2.4, iron);
          }
        }
        drawbridgeGlow(leaf, [-1, 1].map((side) => V3(X(tipEnd - 1.6), top + 11.2, side * (G + 4.8))), '#ff4a3c', 'tipRed', 12);
        drawbridgeGlow(leaf, [-1, 1].map((side) => V3(X(tipEnd - 1.6), top + 8.8, side * (G + 4.8))), '#3dff7a', 'tipGreen', 12);
        // Flashing red on the tip barrier while the span works (a warning to anyone left on it).
        for (const side of [-1, 1]) box(leaf, X(tipEnd - 3), top + 3.2, side * (road / 2 - 3), 1.4, 1.4, 1.4, drawbridgeView.spanFlash);
        drawbridgeGlow(leaf, [-1, 1].map((side) => V3(X(tipEnd - 3), top + 3.2, side * (road / 2 - 3))), '#ff3322', 'spanFlash', 9);
        /* Floor system, seen from below as the leaf stands up: cross girders every
           3.5 m between the main girders, five stringers, a bottom lateral
           system of X bracing, and the floor beams' bottom flanges. */
        for (let x = 4; x < tipEnd - 2; x += 28) {
          const depth = Math.min(12, depthAt(x) * 0.42);
          box(leaf, X(x), d - depth / 2 - 0.2, 0, 1.6, depth, 2 * G - lay.girderW, steel);
          box(leaf, X(x), d - depth - 0.2, 0, 3.2, 0.6, 2 * G - lay.girderW, iron);
        }
        for (let z = -road / 2 + 7; z < road / 2 - 5; z += 19) box(leaf, X(roadEnd / 2), d - 3.2, z, roadEnd - 1, 5, 1.6, steel);
        for (let x = 4; x < tipEnd - 30; x += 56) {
          const depth0 = Math.min(12, depthAt(x) * 0.42),
            depth1 = Math.min(12, depthAt(x + 56) * 0.42),
            zz = G - 4;
          bridgeMember(leaf, V3(X(x), d - depth0, -zz), V3(X(x + 56), d - depth1, zz), 1, 1, iron);
          bridgeMember(leaf, V3(X(x), d - depth0, zz), V3(X(x + 56), d - depth1, -zz), 1, 1, iron);
        }
        // Globe lamps along the leaf's railings: their light pools are in the deck's light map.
        for (const x of [L * 0.25, L * 0.5, L * 0.75])
          for (const side of [-1, 1]) {
            const z = side * (half + 1.8);
            box(leaf, X(x), top + 1.5, z, 3.2, 3, 3.2, iron);
            box(leaf, X(x), top + 13, z, 1.3, 24, 1.3, iron);
            box(leaf, X(x), top + 23, z, 0.8, 0.8, 11, iron);
            for (const dz of [-5, 5]) {
              mesh(sphereGeo, bridgeLampMaterial, leaf, X(x), top + 25.4, z + dz, 2.2, 2.2, 2.2);
              kitLight(kit.lights, leaf, X(x), top + 25.4, z + dz, '#ffe2b0');
            }
            mesh(sphereGeo, bridgeLampMaterial, leaf, X(x), top + 27.5, z, 1.9, 2.4, 1.9);
            kit.pools.push({ x: hinge + X(x), z: z - side * 6, size: 34 });
          }
        // Trunnion shaft and hubs.
        const shaft = mesh(cylinderGeo, iron, leaf, 0, 0, 0, 3.4, 2 * G + 12, 3.4);
        shaft.rotation.x = Math.PI / 2;
        for (const side of [-1, 1]) {
          const hub = mesh(cylinderGeo, iron, leaf, 0, 0, side * (G + 3.4), 7, 3.6, 7);
          hub.rotation.x = Math.PI / 2;
        }
        /* The centre lock bars: on the east leaf, a housing on each girder's top by
           the tip and a striped bar that slides out across the joint into a
           receiver on the west leaf's girder (updateDrawbridgeVisuals moves it). */
        for (const side of [-1, 1]) {
          const gz = side * G;
          if (dir < 0) {
            box(leaf, X(tipEnd - 9), girderTop + 1.6, gz, 12, 2.4, 3.4, black);
            const bar = new Three.Group();
            bar.userData.dynamic = true;
            leaf.add(bar);
            for (let k = 0; k < 4; k++) box(bar, X(-6 + k * 3 + 1.5), 0, 0, 3, 1.4, 1.8, k % 2 ? black : hazard);
            bar.position.set(0, girderTop + 1.6, gz);
            for (const m of kitMerge(bar)) m.renderOrder = DRAWBRIDGE_PIT_ORDER;
            drawbridgeView.locks.push({ bar, dir, from: tipEnd - 6, to: tipEnd + 4 });
          } else box(leaf, X(tipEnd - 3), girderTop + 1.6, gz, 6, 2.6, 3.6, black);
        }
        drawbridgeView.leaves.push({ group: leaf, dir, hinge });
        return leaf;
      }
      /* ---- Piers and pits ------------------------------------------------------------- */
      /* One bascule pier (the leaf at `hinge` with `dir`): the centre under the
         fixed deck, the nose under the leaf's heel, the open counterweight pits
         either side (their walls and floor in `pit`, drawn before the mask), the
         house platforms beyond, cutwaters up and down the channel. */
      function drawbridgePier(g, pit, bridge, s, hinge, dir, kit, masks) {
        const b = s.bascule,
          lay = drawbridgeLayout(bridge, s),
          P = b.pit,
          half = lay.half,
          X = (x) => hinge + dir * x,
          mid = (x0, x1) => (X(x0) + X(x1)) / 2,
          stone = BRIDGE_KIT.stone,
          granite = tint('#8f8a80', 'matte'),
          wall = tint('#a39f95', 'matte'),
          floor = tint('#3b3a37', 'matte'),
          iron = tint('#1f2a2a', 'satin'),
          hazard = tint('#e0b020', 'gloss'),
          back = b.tail,
          toe = b.toe,
          sea = -40;
        // The centre strip under the fixed deck, and the lower nose under the leaf's heel.
        box(g, mid(-back, 0), (sea - 0.8) / 2, 0, back, -0.8 - sea, 2 * P.inner, stone);
        box(g, mid(0, toe), (sea - 14) / 2, 0, toe, -14 - sea, 2 * P.inner, stone);
        box(g, mid(0, toe), -14.2, 0, toe - 1, 0.5, 2 * P.inner - 2, granite);
        for (const side of [-1, 1]) {
          const zs = (a, c) => side * ((a + c) / 2);
          // House platform beyond the pit, its paving and balustrade.
          box(g, mid(-back, toe), (sea + 0.3) / 2, zs(P.outer, b.wide), back + toe, 0.3 - sea, b.wide - P.outer, stone);
          box(g, mid(-back, toe), 0.36, zs(P.outer + 6, b.wide), back + toe - 1, 0.1, b.wide - P.outer - 7, granite);
          box(g, mid(-back, toe), 6.6, side * (b.wide - 1.2), back + toe, 1.2, 2.4, BRIDGE_KIT.kerb);
          for (let x = -back + 2.5; x < toe; x += 5) box(g, X(x), 3.9, side * (b.wide - 1.2), 1.4, 4.2, 1.4, BRIDGE_KIT.white);
          // The pit's lip: a balustrade along the outer edge, yellow nosing on the rest.
          box(g, mid(-back, toe), 6.6, side * (P.outer + 1.5), back + toe - 2, 1.2, 1.6, BRIDGE_KIT.kerb);
          for (let x = -back + 3; x < toe - 1; x += 5) box(g, X(x), 3.9, side * (P.outer + 1.5), 1.2, 4.2, 1.2, BRIDGE_KIT.white);
          box(g, X(-back + 3), 0.4, zs(P.inner, P.outer), 6, 0.2, P.outer - P.inner, hazard);
          box(g, X(toe - 2), 0.4, zs(lay.G + 3, P.outer), 4, 0.2, P.outer - lay.G - 3, hazard);
          /* The pit: floor, the back and front walls (the front one notched where the
             girder passes over it), the outer wall and the inner wall under the deck
             edge; ladders, lamps and a drainage sump. */
          const px0 = -P.back,
            px1 = P.front,
            depth = -P.depth;
          box(pit, mid(px0, px1), depth - 2, zs(P.inner, P.outer), P.back + P.front, 4, P.outer - P.inner, floor);
          box(pit, X(-back + 3), (depth + 0.3) / 2, zs(P.inner - 2, P.outer + 3), 6, 0.3 - depth, P.outer - P.inner + 5, wall);
          box(pit, X(toe - 2), (depth + 0.3) / 2, zs(lay.G + 4, P.outer + 3), 4, 0.3 - depth, P.outer - lay.G - 1, wall);
          box(pit, X(toe - 2), (depth - 46) / 2, zs(P.inner - 2, lay.G + 4), 4, -46 - depth, lay.G + 6 - P.inner, wall);
          box(pit, mid(px0, px1), (depth + 0.3) / 2, side * (P.outer + 1.5), P.back + P.front, 0.3 - depth, 3, wall);
          box(pit, mid(px0, px1), (depth - 1) / 2, side * (P.inner - 1), P.back + P.front, -1 - depth, 2, wall);
          /* The camera looks north and down at 50 degrees, so each pit shows its far
             wall (the inner one for the south pit, the outer for the north): banded
             every 2 m and lit, so the depth and what moves in front of it read. */
          for (let y = depth + 12; y < -6; y += 16)
            for (const z of [P.outer - 0.2, P.inner + 0.2]) box(pit, mid(px0, px1), y, side * z, P.back + P.front - 1, 1, 0.4, tint('#55524c', 'matte'));
          for (let y = depth + 2; y < 0; y += 3) box(pit, X(-P.back + 0.5), y, side * (P.outer - 6), 0.4, 0.3, 3.2, iron);
          box(pit, X(-P.back + 0.5), depth / 2, side * (P.outer - 7.6), 0.5, -depth, 0.5, iron);
          box(pit, X(-P.back + 0.5), depth / 2, side * (P.outer - 4.4), 0.5, -depth, 0.5, iron);
          box(pit, mid(px0, px1), depth + 0.2, side * (P.outer - 4), 8, 0.3, 5, iron);
          // Bulkhead lamps down the outer wall (their halos would sit under the mask).
          for (const x of [-P.back + 12, -40, P.front - 10])
            for (const y of [-8, -36, -64]) for (const z of [P.outer - 0.6, P.inner + 0.6]) box(pit, X(x), y, side * z, 2.2, 1.4, 1.2, bridgeLampMaterial);
          // The trunnion's inner bearing on the pit's inner wall.
          box(pit, hinge, -16, side * (P.inner + 0.6), 12, 12, 3.2, iron);
          box(pit, hinge, -24, side * (P.inner + 0.6), 14, 4, 4, wall);
          /* The pinion, fixed straight below-behind the trunnion where the rack rolls
             through it, on a shaft across the pit (clear of the counterweight's
             sweep, which stays outside radius 40) to the drive machinery in the
             outer wall: a motor house on the platform above. */
          const pa = lay.pinionAngle,
            px = Math.cos(pa) * lay.pinionRadius * dir,
            py = Math.sin(pa) * lay.pinionRadius - b.drop,
            pz = side * lay.rackZ;
          const pinion = new Three.Group();
          pinion.position.set(hinge + px, py, pz);
          pinion.userData.dynamic = true;
          g.add(pinion);
          const gear = mesh(cylinderGeo, tint('#b08a3a', 'metal'), pinion, 0, 0, 0, DRAWBRIDGE_PINION - 0.8, 3.4, DRAWBRIDGE_PINION - 0.8);
          gear.rotation.x = Math.PI / 2;
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2,
              t = mesh(boxGeo, tint('#b08a3a', 'metal'), pinion, Math.cos(a) * DRAWBRIDGE_PINION, Math.sin(a) * DRAWBRIDGE_PINION, 0, 1.8, 1.2, 3.2);
            t.rotation.z = a;
          }
          box(pinion, 0, 0, 0, DRAWBRIDGE_PINION * 1.6, 0.9, 3.8, iron);
          for (const m of kitMerge(pinion)) m.renderOrder = DRAWBRIDGE_PIT_ORDER;
          drawbridgeView.pinions.push({ group: pinion, dir });
          const shaft = mesh(cylinderGeo, iron, pit, hinge + px, py, side * ((lay.rackZ + P.outer) / 2 + 1), 1.6, P.outer - lay.rackZ + 2, 1.6);
          shaft.rotation.x = Math.PI / 2;
          box(pit, hinge + px, py, side * (P.outer - 2), 8, 8, 4, iron);
          box(pit, hinge + px, py - 10, side * (P.outer - 2), 6, 14, 3, wall);
          box(g, hinge + px, 5, side * (P.outer + 10), 14, 9, 12, tint('#6d7570', 'satin'));
          box(g, hinge + px, 9.8, side * (P.outer + 10), 15, 0.8, 13, iron);
          // The depth mask over the pit's opening, just under the lip.
          masks.push([X(px0), X(px1), side * P.inner, side * P.outer]);
          // Cutwaters up and down the channel, below the platform.
          const x0 = X(-back),
            x1 = X(toe),
            zA = side * (b.wide - 12),
            zB = side * b.wide,
            nose = side * (b.wide + 26),
            outline = [
              [x0, zA],
              [x1, zA],
              [x1, zB],
              [(x0 + x1) / 2, nose],
              [x0, zB],
            ];
          mesh(prismGeometry(outline, outline, sea, -0.6, true), stone, g, 0, 0, 0);
          for (let y = -12; y < -1; y += 3.5) box(g, (x0 + x1) / 2, y, side * (b.wide - 2), back + toe + 1, 0.5, 4, granite);
        }
        // The heel joint where the fixed deck meets the leaf, and the pier's back face.
        box(g, hinge - dir * 0.9, 0.43, 0, 1.4, 0.08, lay.road, BRIDGE_KIT.darkSteel);
        box(g, X(-back - 1), -7, 0, 2, 13, 2 * b.wide, granite);
        box(g, X(toe + 1), -8, 0, 2, 12, 2 * P.inner, granite);
      }
      // The masks as one mesh: flat quads that only write depth.
      function drawbridgePitMask(g, quads) {
        const positions = [],
          y = 0.34;
        for (const [x0, x1, z0, z1] of quads) positions.push(x0, y, z0, x1, y, z1, x1, y, z0, x0, y, z0, x0, y, z1, x1, y, z1);
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.computeBoundingSphere();
        const m = new Three.Mesh(geo, new Three.MeshBasicMaterial({ colorWrite: false, side: Three.DoubleSide }));
        m.name = 'drawbridge pit mask';
        m.renderOrder = DRAWBRIDGE_PIT_ORDER + 1;
        m.userData.dynamic = true;
        g.add(m);
        farHidden.push(m);
        return m;
      }
      /* ---- Houses and fenders --------------------------------------------------------- */
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
        // Door on the pit side, lanterns either side of it.
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
      // Timber fender wall along the channel from the pier's cutwater, ending in a dolphin.
      function drawbridgeFender(g, f, bridge, kit) {
        const out = Math.sign(f.across),
          z0 = f.across - out * 80,
          z1 = f.across + out * 80,
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
      /* ---- Floodlights ------------------------------------------------------------------ */
      /* Two floodlights on each pier nose, one each side, aimed up the raised leaf;
         after dark their beams (additive cones, one mesh) show while the leaves
         stand up, and the leaves' paint and underside glow in the light. */
      function drawbridgeFloodlights(g, bridge, s) {
        const b = s.bascule,
          lay = drawbridgeLayout(bridge, s),
          positions = [],
          iron = tint('#1f2a2a', 'satin'),
          lamps = [];
        for (const [i, hinge] of b.trunnions.entries()) {
          const dir = i ? -1 : 1;
          for (const side of [-1, 1]) {
            const from = V3(hinge + dir * (b.toe - 6), 9, side * (b.pit.outer + 16)),
              // The raised leaf's girder at mid-height (78 degrees).
              along = b.leaf * 0.55,
              to = V3(hinge + dir * (along * Math.cos(DRAWBRIDGE_MAX_ANGLE) - 20), along * Math.sin(DRAWBRIDGE_MAX_ANGLE) - b.drop, side * lay.G * 0.6);
            box(g, from.x, 4.5, from.z, 2, 9, 2, iron);
            box(g, from.x, 9.5, from.z, 5, 3.2, 5, iron);
            lamps.push(V3(from.x, 10.2, from.z));
            // The beam: a cone from the lamp to a pool 34 across on the leaf.
            const axis = new Three.Vector3().subVectors(to, from),
              length = axis.length(),
              cone = new Three.CylinderGeometry(17, 1.6, length, 14, 1, true);
            cone.translate(0, length / 2, 0);
            cone.applyQuaternion(new Three.Quaternion().setFromUnitVectors(new Three.Vector3(0, 1, 0), axis.normalize()));
            cone.translate(from.x, 10.2, from.z);
            const p = cone.attributes.position,
              t = cone.attributes.uv;
            for (let k = 0; k < p.count; k++) positions.push(p.getX(k), p.getY(k), p.getZ(k), t.getY(k));
            const index = cone.index;
            positions.index = (positions.index || []).concat(Array.from(index.array, (n) => n + (positions.length / 4 - p.count)));
          }
        }
        const geo = new Three.BufferGeometry(),
          xyz = [],
          fade = [];
        for (let k = 0; k < positions.length; k += 4) {
          xyz.push(positions[k], positions[k + 1], positions[k + 2]);
          fade.push(positions[k + 3]);
        }
        geo.setAttribute('position', new Three.Float32BufferAttribute(xyz, 3));
        geo.setAttribute('fade', new Three.Float32BufferAttribute(fade, 1));
        geo.setIndex(positions.index);
        geo.computeBoundingSphere();
        // Brightest at the lamp, fading along the beam.
        const material = new Three.ShaderMaterial({
          uniforms: { uStrength: { value: 0 } },
          vertexShader: 'attribute float fade; varying float vFade; void main(){ vFade = fade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
          fragmentShader: 'uniform float uStrength; varying float vFade; void main(){ float f = 1. - vFade; float a = uStrength * (0.06 + 0.3 * f * f); gl_FragColor = vec4(vec3(1., 0.9, 0.72) * a, a); }',
          transparent: true,
          depthWrite: false,
          blending: Three.AdditiveBlending,
          side: Three.DoubleSide,
        });
        const beams = new Three.Mesh(geo, material);
        beams.name = 'drawbridge floodlight beams';
        beams.userData.dynamic = true;
        beams.renderOrder = 7;
        beams.visible = false;
        beams.castShadow = beams.receiveShadow = false;
        g.add(beams);
        farHidden.push(beams);
        drawbridgeView.beams = beams;
        drawbridgeGlow(g, lamps, '#fff1d8', 'flood', 14);
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
      /* ---- Water off the leaves ---------------------------------------------------------- */
      /* Drips and spray: a pool of droplets in the bridge's frame, shed from the
         rising leaves' tips, grating and girders (most in the first twenty degrees,
         a burst of spray as the tips part), falling under gravity to the Sound
         where each flashes as a small splash. One points cloud. */
      const DRAWBRIDGE_DROPS = 420;
      function drawbridgeWater(g) {
        const geo = new Three.BufferGeometry(),
          positions = new Float32Array(DRAWBRIDGE_DROPS * 3).fill(-999);
        geo.setAttribute('position', new Three.BufferAttribute(positions, 3));
        geo.boundingSphere = new Three.Sphere(new Three.Vector3(0, 0, 0), 2400);
        const material = new Three.PointsMaterial({ map: haloTx, color: '#d8ecff', size: 3, transparent: true, opacity: 0.85, depthWrite: false, blending: Three.AdditiveBlending });
        material.userData.worldSize = 3;
        const cloud = new Three.Points(geo, material);
        cloud.name = 'drawbridge water';
        cloud.userData.dynamic = true;
        cloud.renderOrder = 6;
        cloud.visible = false;
        g.add(cloud);
        farHidden.push(cloud);
        drawbridgeView.water = { cloud, material, positions, drops: [], burst: 0, lastAngle: 0 };
      }
      // A point on a leaf (along, height over the trunnion, across) in the bridge's frame now.
      function drawbridgeLeafPoint(leaf, along, y, z, angle, out) {
        const c = Math.cos(angle),
          s = Math.sin(angle);
        out.x = leaf.hinge + leaf.dir * (along * c - y * s);
        out.y = -drawbridgeGeometry().drop + along * s + y * c;
        out.z = z;
        return out;
      }
      const drawbridgeDropPoint = { x: 0, y: 0, z: 0 };
      function updateDrawbridgeWater(deltaSeconds, visible) {
        const w = drawbridgeView.water;
        if (!w) return;
        const d = drawbridge,
          geo = drawbridgeGeometry(),
          rising = d.phase === 'raising' && d.rate > 0.0005,
          wet = clamp(1 - d.angle / 0.45, 0.12, 1),
          gravity = GRAVITY;
        // The tips part: a burst of spray from the joint.
        if (w.lastAngle < 0.002 && d.angle >= 0.002 && d.phase === 'raising') w.burst = 170;
        w.lastAngle = d.angle;
        let spawn = rising && visible ? Math.floor(deltaSeconds * 150 * wet + Math.random()) : 0;
        const add = (leaf, along, y, z, vx, vy, vz, life) => {
          if (w.drops.length >= DRAWBRIDGE_DROPS) return;
          drawbridgeLeafPoint(leaf, along, y, z, d.angle, drawbridgeDropPoint);
          w.drops.push({ x: drawbridgeDropPoint.x, y: drawbridgeDropPoint.y, z: drawbridgeDropPoint.z, vx, vy, vz, life, splash: 0 });
        };
        const leaves = drawbridgeView.leaves;
        while (spawn-- > 0 && leaves.length) {
          const leaf = leaves[Math.random() < 0.5 ? 0 : 1],
            r = Math.random();
          if (r < 0.45) add(leaf, geo.leaf - 2, geo.drop - 8, (Math.random() - 0.5) * 2 * (geo.half + 6), 0, 0, 0, 4);
          else if (r < 0.75) add(leaf, geo.leaf - 14 + Math.random() * 12, geo.drop - 2, (Math.random() - 0.5) * 90, 0, 0, 0, 4);
          else add(leaf, Math.random() * geo.leaf, geo.drop - 30 + (Math.random() * 20 * geo.leaf) / geo.leaf, (Math.random() < 0.5 ? -1 : 1) * (geo.half + 6), 0, 0, 0, 4);
        }
        while (w.burst > 0 && leaves.length && visible) {
          w.burst--;
          const leaf = leaves[w.burst % 2],
            speed = 20 + Math.random() * 40,
            a = Math.random() * Math.PI * 2;
          add(leaf, geo.leaf - 1, geo.drop - 1, (Math.random() - 0.5) * 100, leaf.dir * Math.cos(a) * speed * 0.6, 20 + Math.random() * 45, Math.sin(a) * speed, 3);
        }
        const p = w.positions;
        let n = 0;
        for (let i = w.drops.length - 1; i >= 0; i--) {
          const q = w.drops[i];
          q.life -= deltaSeconds;
          if (q.splash > 0) q.splash -= deltaSeconds;
          else {
            q.vy -= gravity * deltaSeconds;
            q.x += q.vx * deltaSeconds;
            q.y += q.vy * deltaSeconds;
            q.z += q.vz * deltaSeconds;
            if (q.y < -2.6) {
              q.y = -2.4;
              q.splash = 0.18;
              q.life = Math.min(q.life, 0.18);
            }
          }
          if (q.life <= 0) {
            w.drops.splice(i, 1);
            continue;
          }
        }
        for (const q of w.drops) {
          if (n >= DRAWBRIDGE_DROPS) break;
          p[n * 3] = q.x;
          p[n * 3 + 1] = q.y;
          p[n * 3 + 2] = q.z;
          n++;
        }
        w.cloud.geometry.setDrawRange(0, n);
        w.cloud.geometry.attributes.position.needsUpdate = n > 0;
        w.cloud.visible = n > 0 && visible;
      }
      /* ---- Build (called by bridges3d's BRIDGE_BUILDERS.bascule) ---------------------- */
      function buildDrawbridge(g, bridge, s, kit) {
        const W = bridge.width,
          b = s.bascule,
          iron = tint('#1f2a2a', 'satin'),
          v = drawbridgeView;
        // The leaves' paint and undersides: floodlit at night (updateDrawbridgeVisuals).
        const paint = drawbridgeFloodlit('#46615a', '#ffdca6');
        v.underside = drawbridgeFloodlit('#59625f', '#ffe6c0', 'metal');
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
        v.spanFlash = drawbridgeLens('#ff3322', 'spanFlash');
        // The fixed deck up to each trunnion; the leaves carry the rest.
        bridgeDeck(g, bridge, s, { fascia: BRIDGE_KIT.concrete, rail: guardBalustrade(BRIDGE_KIT.white, BRIDGE_KIT.kerb), gap: [b.trunnions[0] + 0.5, b.trunnions[1] - 0.5] });
        for (const p of s.approach) approachPier(g, bridge, p, BRIDGE_KIT.concrete);
        // The piers and their pits (the pits drawn first, then the mask, then the water).
        const pit = new Three.Group(),
          masks = [];
        pit.userData.dynamic = true;
        g.add(pit);
        for (const [i, hinge] of b.trunnions.entries()) drawbridgePier(g, pit, bridge, s, hinge, i ? -1 : 1, kit, masks);
        for (const mm of kitMerge(pit)) {
          mm.name = 'drawbridge pit';
          mm.renderOrder = DRAWBRIDGE_PIT_ORDER;
          farHidden.push(mm);
        }
        drawbridgePitMask(g, masks);
        for (const dir of [1, -1]) drawbridgeLeaf(g, bridge, s, dir, paint, kit);
        for (const leaf of v.leaves)
          for (const mm of kitMerge(leaf.group)) {
            mm.name = 'drawbridge leaf';
            mm.renderOrder = DRAWBRIDGE_PIT_ORDER;
            farHidden.push(mm);
          }
        // Tender's houses and the control house.
        for (const h of b.houses) drawbridgeHouse(g, h, s, kit, h.main);
        const fenderLights = b.fenders.map((f) => drawbridgeFender(g, f, bridge, kit));
        drawbridgeGlow(g, fenderLights, '#ff3a2a', 'fenderRed', 12);
        drawbridgeFloodlights(g, bridge, s);
        drawbridgeWater(g);
        // Ornamental lamps: globe standards along the approaches, triple lamps at the piers.
        bridgeLamps(g, bridge, s, kit.lights, kit.pools, 56, 'globe', iron, [[b.trunnions[0] - b.tail - 24, b.trunnions[1] + b.tail + 24]]);
        for (const [i, hinge] of b.trunnions.entries())
          for (const x of [b.tail - 8, 8]) for (const side of [-1, 1]) bridgeLampPost(g, hinge - (i ? -1 : 1) * x, side, W, 'globe', iron, kit.lights, kit.pools);
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
        // Name plaques on the approach spans.
        for (const [x, rot] of [
          [s.water[0] - 20, -Math.PI / 2],
          [s.water[1] + 20, Math.PI / 2],
        ])
          for (const side of [-1, 1]) {
            box(g, x, 5, side * (W / 2 + 6), 5, 10, 5, BRIDGE_KIT.stone);
            if (side > 0) bridgePlaque(g, 'PALM SOUND', 'CAUSEWAY · 1926', '#e9e3d0', '#39463f', 20, x + (rot < 0 ? -2.6 : 2.6), 6, side * (W / 2 + 6), rot);
          }
        aviationBeacons(g, b.houses.map((h) => V3(h.along, h.main ? 66 : 50, h.across)));
        v.group = g;
        v.built = true;
      }
      /* ---- The tall ship ------------------------------------------------------------- */
      /* A sail as a billowed sheet hanging from its head (the pivot, so scaling it
         furls it up to the yard or gaff): `corners` [head-left, head-right,
         foot-right, foot-left] in the sail's own plane (u across, y up), the belly
         bulging along `bulge` (a unit vector) by `belly`. */
      function drawbridgeSail(parent, corners, belly, bulge, material, pivot, plane) {
        const n = 7,
          positions = [],
          uvs = [],
          indices = [];
        const [a, bq, c, dq] = corners,
          origin = plane(pivot[0], pivot[1]);
        for (let j = 0; j <= n; j++)
          for (let i = 0; i <= n; i++) {
            const s = i / n,
              t = j / n,
              top = [a[0] + (bq[0] - a[0]) * s, a[1] + (bq[1] - a[1]) * s],
              bot = [dq[0] + (c[0] - dq[0]) * s, dq[1] + (c[1] - dq[1]) * s],
              u = top[0] + (bot[0] - top[0]) * t,
              y = top[1] + (bot[1] - top[1]) * t,
              bell = belly * Math.sin(Math.PI * s) * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08));
            const p = plane(u, y);
            positions.push(p.x - origin.x + bulge.x * bell, p.y - origin.y + bulge.y * bell, p.z - origin.z + bulge.z * bell);
            uvs.push(s, t);
          }
        for (let j = 0; j < n; j++)
          for (let i = 0; i < n; i++) {
            const k = j * (n + 1) + i;
            indices.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
          }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const m = new Three.Mesh(geo, material);
        m.position.set(origin.x, origin.y, origin.z);
        m.castShadow = true;
        m.userData.dynamic = true;
        parent.add(m);
        return m;
      }
      // ALBATROSS: black hull with a white gunstripe, teak decks, varnished deckhouses,
      // square sails on the foremast, a gaff main, three headsails, festoon lights.
      function buildDrawbridgeShip() {
        const d = { len: DRAWBRIDGE_VESSEL.length, beam: DRAWBRIDGE_VESSEL.beam, hull: '#16191c', accent: '#1d3f6e' },
          l = d.len,
          bm = d.beam,
          g = new Three.Group(),
          lights = kitLightList(),
          varnish = tint('#7a4a26', 'gloss'),
          spar = tint('#b9874f', 'satin'),
          black = tint('#1b1d1f', 'satin'),
          rigging = tint('#3a3530', 'matte'),
          canvas = new Three.MeshStandardMaterial({ color: '#efe6d0', roughness: 0.85, side: Three.DoubleSide, emissive: '#ffcf96', emissiveIntensity: 0 }),
          deckZ = 15;
        g.name = 'ALBATROSS';
        g.userData.lightCloud = true;
        scene.add(g);
        const spec = yachtSpec(d, {
          draft: l * 0.1,
          sheer: [
            [-0.5, 21],
            [-0.05, 17],
            [0.5, 25],
          ],
          form: { transom: 0.42, maxAt: -0.04, entry: 1.9, bowShape: 0.82, sternCurve: 1.5 },
          rake: 0.22,
          stemCurve: 1.5,
          bilge: 2.2,
          colors: { boot: '#e9dfc2', bottom: '#7a2a22', bands: [[0.8, 0.86, '#f2efe6']] },
        });
        hullMesh(g, spec);
        hullDeck(g, spec, deckZ, -l * 0.5, l * 0.48, 1.2, kitTeak);
        deckhouse(g, deckOutline(-l * 0.3, -l * 0.12, bm * 0.26, l * 0.03, 3), deckZ, deckZ + 7, { paint: varnish, glassFrom: 0.3, glassTo: 0.72 });
        deckhouse(g, deckOutline(-l * 0.02, l * 0.1, bm * 0.2, l * 0.02, 3), deckZ, deckZ + 6.5, { paint: varnish, glassFrom: 0.35, glassTo: 0.7 });
        box(g, -l * 0.44, deckZ + 0.6, 0, l * 0.1, 1.2, bm * 0.5, kitTeak);
        wheel(g, -l * 0.4, deckZ, 0, 4);
        for (const side of [-1, 1]) railing(g, hullEdge(spec, deckZ, -l * 0.46, l * 0.45, 1.2, 10).map(([u, vv]) => [u, side * vv]), deckZ, 5, { material: varnish });
        // Bowsprit and jib-boom, a dolphin striker below.
        const stem = sheerAt(spec, l * 0.5),
          sprit = [l * 0.5 + 76, stem + 14];
        strut(g, [l * 0.44, stem, 0], [sprit[0], sprit[1], 0], 3, spar);
        strut(g, [l * 0.52, stem - 2, 0], [l * 0.55, stem - 14, 0], 1, spar);
        strut(g, [sprit[0], sprit[1], 0], [l * 0.55, stem - 14, 0], 0.5, rigging);
        // Masts: the foremast square-rigged, the mainmast with gaff and boom.
        const fore = l * 0.22,
          main = -l * 0.1,
          foreTop = 224,
          mainTop = 240,
          mast = (u, topY) => {
            box(g, u, (deckZ + topY) / 2, 0, 3.2, topY - deckZ, 3.2, spar);
            for (const y of [topY * 0.42, topY * 0.72]) box(g, u, y, 0, 6, 1.2, 10, spar);
            box(g, u, topY + 1, 0, 2, 2, 2, black);
            for (const side of [-1, 1])
              for (const k of [0, 1, 2]) {
                const chain = [u - 6 - k * 5, sheerAt(spec, u) + 1, side * hullBeamAt(spec, u - 6 - k * 5, deckZ) * 0.98];
                strut(g, [u, topY * (k === 2 ? 0.95 : 0.7), 0], chain, 0.35, rigging);
              }
            // Ratlines: rungs across the lower shrouds.
            for (const side of [-1, 1])
              for (let y = deckZ + 8; y < topY * 0.66; y += 7) {
                const f = (y - deckZ) / (topY * 0.7 - deckZ),
                  hw = hullBeamAt(spec, u - 11, deckZ) * 0.98 * (1 - f);
                strut(g, [u - 6 - 5 * (1 - f), y, side * hw], [u - 16 * (1 - f), y, side * hw], 0.25, rigging);
              }
          };
        mast(fore, foreTop);
        mast(main, mainTop);
        strut(g, [fore, foreTop - 4, 0], [sprit[0], sprit[1], 0], 0.4, rigging);
        strut(g, [fore, foreTop * 0.72, 0], [l * 0.5, stem + 2, 0], 0.4, rigging);
        strut(g, [main, mainTop - 6, 0], [fore, foreTop - 6, 0], 0.35, rigging);
        strut(g, [main, mainTop, 0], [-l * 0.5, sheerAt(spec, -l * 0.5) + 2, 0], 0.35, rigging);
        // Yards on the foremast: course, topsail, topgallant and royal, each with its furled canvas.
        const yards = [
          [80, 62],
          [124, 50],
          [166, 40],
          [200, 30],
        ];
        for (const [y, hw] of yards) {
          strut(g, [fore + 1, y, -hw], [fore + 1, y, hw], 1.6, spar);
          strut(g, [fore + 2.2, y - 1.4, -hw * 0.95], [fore + 2.2, y - 1.4, hw * 0.95], 2.6, tint('#e6ddc6', 'matte'));
        }
        // Gaff and boom on the main.
        const gaffThroat = [main, 152],
          gaffPeak = [main - 84, 178],
          boomEnd = [main - 104, 32];
        strut(g, [main - 1, gaffThroat[1], 0], [gaffPeak[0], gaffPeak[1], 0], 1.4, spar);
        strut(g, [main - 1, 32, 0], [boomEnd[0], boomEnd[1], 0], 1.8, spar);
        strut(g, [main, mainTop - 2, 0], [gaffPeak[0], gaffPeak[1], 0], 0.3, rigging);
        // Deck lights: masthead, side lights (red port, green starboard), stern light,
        // lanterns on deck and the festoon dressed overall bowsprit - mastheads - taffrail.
        kitLight(lights, g, fore, foreTop * 0.62, 0, '#ffffff');
        kitLight(lights, g, main, mainTop + 3, 0, '#ff4030');
        kitLight(lights, g, l * 0.3, deckZ + 4, -bm * 0.44, '#ff3a2a');
        kitLight(lights, g, l * 0.3, deckZ + 4, bm * 0.44, '#3dff7a');
        kitLight(lights, g, -l * 0.5, deckZ + 6, 0, '#ffffff');
        for (const u of [-l * 0.36, -l * 0.2, 0, l * 0.16, l * 0.34]) kitLight(lights, g, u, deckZ + 5, 0, '#ffcf8a');
        const festoon = [
          [sprit[0], sprit[1]],
          [fore, foreTop],
          [main, mainTop],
          [-l * 0.5, sheerAt(spec, -l * 0.5) + 4],
        ];
        for (let k = 0; k < festoon.length - 1; k++) {
          const [a, c] = [festoon[k], festoon[k + 1]],
            n = Math.round(Math.hypot(c[0] - a[0], c[1] - a[1]) / 11);
          for (let i = 1; i <= n; i++) {
            const t = i / n,
              sag = Math.sin(Math.PI * t) * 6;
            kitLight(lights, g, a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag, 0, ['#ffd98a', '#ff9a6a', '#fff2c8', '#9ad8ff'][i % 4]);
          }
        }
        kitNameBoard(g, 'ALBATROSS', 'PALM KEYS', '#e9d7a0', 40, -l * 0.5 - 0.5, sheerAt(spec, -l * 0.5) - 5, 0, -Math.PI / 2);
        for (const mm of kitMerge(g)) mm.name = 'ALBATROSS';
        kitLightCloud(lights, 9);
        /* The sails (dynamic, not merged): the four square sails hang from their
           yards and bulge forward; the gaff main, gaff topsail and the headsails
           lie fore and aft and bulge to starboard, as with the breeze on the
           port quarter. */
        const sails = [],
          square = (u) => (su, y) => ({ x: u + 3, y, z: su }),
          fAft = (su, y) => ({ x: su, y, z: 0 });
        for (let k = 0; k < yards.length; k++) {
          const [y, hw] = yards[k],
            below = k ? yards[k - 1][0] + 3 : deckZ + 14,
            bw = k ? yards[k - 1][1] * 0.94 : hw * 1.06;
          sails.push(drawbridgeSail(g, [[-hw * 0.96, y - 1], [hw * 0.96, y - 1], [bw, below], [-bw, below]], (y - below) * 0.16, { x: 1, y: 0, z: 0 }, canvas, [0, y - 1], square(fore)));
        }
        sails.push(drawbridgeSail(g, [[main - 3, gaffThroat[1] - 2], [gaffPeak[0] + 2, gaffPeak[1] - 2], [boomEnd[0] + 4, boomEnd[1] + 2], [main - 3, 34]], 14, { x: 0, y: 0, z: 1 }, canvas, [main - 3, gaffThroat[1] - 2], fAft));
        sails.push(drawbridgeSail(g, [[main - 2, mainTop - 8], [main - 2, mainTop - 8], [gaffPeak[0] + 4, gaffPeak[1] + 2], [main - 2, gaffThroat[1] + 3]], 6, { x: 0, y: 0, z: 1 }, canvas, [main - 2, mainTop - 8], fAft));
        for (const [headY, tackU, tackY, clewU] of [
          [150, l * 0.47, stem + 3, fore + 30],
          [182, l * 0.5 + 34, stem + 10, fore + 44],
          [210, sprit[0] - 6, sprit[1] - 1, fore + 60],
        ]) {
          const head = [fore + 4 + (tackU - fore) * ((foreTop - headY) / (foreTop - tackY)) * 0.9, headY];
          sails.push(drawbridgeSail(g, [head, head, [tackU, tackY + 3], [clewU, deckZ + 18 + (headY - 150) * 0.3]], 7, { x: 0, y: 0, z: 1 }, canvas, head, fAft));
        }
        return { group: g, sails, canvas };
      }
      /* ---- Per frame ----------------------------------------------------------------- */
      function updateDrawbridgeVisuals() {
        const v = drawbridgeView;
        if (!v.built) return;
        const d = drawbridge,
          night = nightAmount,
          lit = clamp(night * 1.3 - 0.1, 0, 1),
          deltaSeconds = clamp(gameTime - (v.lastTime ?? gameTime), 0, 0.1);
        v.lastTime = gameTime;
        for (const leaf of v.leaves) leaf.group.rotation.z = leaf.dir * d.angle;
        // The pinions turn as the rack rolls through them; the lock bars slide.
        for (const p of v.pinions) p.group.rotation.z = p.dir * d.angle * (DRAWBRIDGE_RACK / DRAWBRIDGE_PINION);
        const engaged = d.angle > 0.004 ? 0 : 1 - d.locks;
        for (const l of v.locks) l.bar.position.x = l.dir * (l.from + (l.to - l.from) * engaged);
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
          moving = Math.abs(d.rate) > 0.0005 || d.phase === 'unlock' || d.phase === 'seating',
          fullyOpen = d.phase === 'open' && d.held === null,
          raised = clamp(d.angle / DRAWBRIDGE_MAX_ANGLE, 0, 1),
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
            spanFlash: moving && Math.sin(gameTime * Math.PI * 2 * 1.4) > 0 ? 1 : 0,
            flood: working ? lit : 0,
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
            : buffer.y / 2 / Math.tan(((camera.fov || 50) * Math.PI) / 360),
          pointSize = (m) => {
            m.sizeAttenuation = !ortho;
            m.size = m.userData.worldSize * (ortho ? pixelsPerUnit : pixelsPerUnit / (buffer.y / 2));
          };
        for (const glow of v.glows) {
          const level = levels[glow.key] ?? 0,
            opacity = level * (0.28 + 0.72 * lit);
          glow.cloud.visible = opacity > 0.01;
          glow.material.opacity = opacity;
          pointSize(glow.material);
        }
        /* Floodlights after dark: the beams show while the leaves stand up, and the
           leaves' paint and steel glow in the light (a little always, as the
           street lamps catch them). */
        const flood = working ? lit * clamp(raised * 1.6, 0, 1) : 0;
        if (v.beams) {
          v.beams.visible = flood > 0.02;
          v.beams.material.uniforms.uStrength.value = flood;
        }
        for (const m of v.floodlit) m.emissiveIntensity = lit * (0.08 + 0.3 * flood) * (m === v.underside ? 0.6 : 1);
        // Water off the leaves: only simulated while the bridge is in view.
        const g = drawbridgeGeometry(),
          near = Math.abs(g.channel.x - viewCenter.x) < viewReach + 700 && Math.abs(g.channel.y - viewCenter.y) < viewReach + 700 && !farSceneryShown;
        updateDrawbridgeWater(deltaSeconds, near);
        if (v.water) pointSize(v.water.material);
        // The ship: built the first time she is needed, then follows the game's vessel.
        const vessel = d.vessel;
        if (vessel) {
          if (!v.ship) v.ship = buildDrawbridgeShip();
          const ship = v.ship,
            k = ship.group;
          k.position.set(vessel.x, 0.4 + Math.sin(gameTime * 0.8 + 0.7) * 0.5, vessel.y);
          k.rotation.y = -vessel.a;
          k.rotation.x = Math.sin(gameTime * 0.7) * 0.012 + vessel.sails * 0.035;
          k.rotation.z = Math.sin(gameTime * 1.05 + 1) * 0.01;
          const far = Math.abs(vessel.x - viewCenter.x) > viewReach + 500 || Math.abs(vessel.y - viewCenter.y) > viewReach + 500;
          k.visible = !far && !farSceneryShown;
          // Sails set (scaled out from their heads) as she gets under way, furled at anchor.
          const set = vessel.sails,
            shown = set > 0.02;
          for (const s of ship.sails) {
            s.visible = shown;
            if (shown) s.scale.set(0.3 + 0.7 * set, Math.max(0.04, set), 0.3 + 0.7 * set);
          }
          ship.canvas.emissiveIntensity = lit * 0.16;
          if (k.visible && vessel.speed > 1) wakeEmit(vessel, vessel.x, vessel.y, vessel.a, vessel.speed, DRAWBRIDGE_VESSEL.length, DRAWBRIDGE_VESSEL.beam, 120, true);
        }
      }
      const drawbridgeColor = new Three.Color();
      // END SUBSYSTEM: src/drawbridge3d.js
