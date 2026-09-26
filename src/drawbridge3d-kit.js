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
