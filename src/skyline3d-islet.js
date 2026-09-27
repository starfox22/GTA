      // North Point Key's dressing: the fountain on the circle's island, the gate pylons, lamp standards, forecourt benches, loungers and parasols on the sand.
      /* Built once from the islet plan (skyline-islet.js: NORTH_POINT_KEY,
         northPointKeyFurniture): static meshes in one batched group, the lamps and
         benches as knockable pieces like the esplanade's. The lamps and fountain
         light the night with glows (the city's lamp light map, and with it every
         signSpill pool, stops at the city frame, west of the islet). */
      {
        const K = NORTH_POINT_KEY,
          C = K.circle,
          G = NORTH_POINT_KEY_GATE,
          furniture = northPointKeyFurniture(),
          group = new Three.Group(),
          limestone = staticMat('#e3dccb', 0.72),
          whiteStone = staticMat('#f0ece2', 0.55),
          gilt = staticMat('#c9a458', 0.32, 0.85),
          lampPost = staticMat('#23282c', 0.5, 0.5),
          lampGlass = new Three.MeshBasicMaterial({ color: '#ffe9bd' }),
          seatWood = staticMat('#9c7b52', 0.85),
          canvas = [staticMat('#f2ede2', 0.9), staticMat('#1f5f7a', 0.9)],
          cushion = staticMat('#f4f1ea', 0.9),
          fountainWater = new Three.MeshStandardMaterial({ color: '#3f8fa3', roughness: 0.05, metalness: 0.3 });
        group.name = 'north point key';
        scene.add(group);
        batchGroups.push(group);
        statics.push({ x: 4100, y: -3540, group, radius: 720 });
        // The fountain: a white basin, a tiered centre and a gilt armillary sphere.
        const fr = K.fountain.r;
        mesh(new Three.CylinderGeometry(fr, fr + 2, 4, 48), whiteStone, group, C.x, 2, C.y);
        mesh(new Three.CylinderGeometry(fr - 2.5, fr - 2.5, 0.6, 48), fountainWater, group, C.x, 3.7, C.y);
        mesh(new Three.CylinderGeometry(13, 15, 7, 32), whiteStone, group, C.x, 3.5, C.y);
        mesh(new Three.CylinderGeometry(11.5, 11.5, 0.5, 32), fountainWater, group, C.x, 7.2, C.y);
        mesh(new Three.CylinderGeometry(2.6, 3.6, 18, 16), whiteStone, group, C.x, 15, C.y);
        for (let k = 0; k < 3; k++) {
          const ring = mesh(new Three.TorusGeometry(7, 0.45, 8, 40), gilt, group, C.x, 31, C.y);
          ring.rotation.set((k * Math.PI) / 3, k * 0.9, 0);
        }
        mesh(sphereGeo, gilt, group, C.x, 31, C.y, 2.2, 2.2, 2.2);
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU;
          addGlow(C.x + Math.cos(a) * 24, 4.6, C.y + Math.sin(a) * 24, 7, '#aee6ff', 1.2, { mode: 'pulse', phase: k / 12 });
        }
        addGlow(C.x, 31, C.y, 16, '#ffe0a0', 1.2, { day: 0.05 });
        // The gate at the bridge landing: limestone pylons, the islet's name, a lantern on each.
        for (const side of [-1, 1]) {
          const y = K.row + side * G.half;
          box(group, G.x, 2, y, G.size + 6, 4, G.size + 6, limestone);
          box(group, G.x, 36, y, G.size, 64, G.size, limestone);
          box(group, G.x, 69, y, G.size + 4, 2.4, G.size + 4, gilt);
          box(group, G.x, 74, y, 6, 8, 6, lampGlass);
          atlasSign(group, towerNameCell('NORTH POINT KEY'), G.x - G.size / 2 - 0.4, 50, y, G.size + 22, (G.size + 22) / 8, neonCutout, -Math.PI / 2);
          addGlow(G.x, 74, y, 12, '#ffd9a0', 1.6, { day: 0.05 });
        }
        // Lamp standards: a slim black post, a lantern head.
        for (const l of furniture.lamps) {
          const g = new Three.Group(),
            prop = registerStreetProp('lantern', l.x, l.y, 0, { half: [2.2, 2.2] });
          g.position.set(l.x, 0, l.y);
          box(g, 0, 1.5, 0, 4, 3, 4, lampPost);
          box(g, 0, 16, 0, 1.4, 28, 1.4, lampPost);
          box(g, 0, 30.5, 0, 4.4, 5, 4.4, lampGlass);
          box(g, 0, 33.4, 0, 5.4, 0.8, 5.4, lampPost);
          breakableGroup(prop, g);
          addGlow(l.x, 30.5, l.y, 13, '#ffe0b0', 1.5, { day: 0 });
        }
        // Benches on the forecourt, facing the circle.
        for (const s of furniture.benches) {
          const g = new Three.Group(),
            prop = registerStreetProp('seat', s.x, s.y, 0, { half: [10, 3.5] });
          g.position.set(s.x, 0, s.y);
          box(g, 0, 4.4, 0, 20, 1.6, 6, seatWood);
          box(g, 0, 7.6, -2.4, 20, 5.4, 1.4, seatWood);
          for (const dx of [-8, 8]) box(g, dx, 2, 0, 1.4, 4.4, 5.4, lampPost);
          breakableGroup(prop, g);
        }
        // The sand: pairs of loungers under a canvas parasol.
        for (const l of furniture.loungers) {
          const ca = Math.cos(l.a),
            sa = Math.sin(l.a);
          for (const off of [-6, 6]) {
            const x = l.x - sa * off,
              z = l.y + ca * off,
              seat = mesh(boxGeo, cushion, group, x, 2.4, z, 16, 1.2, 5);
            seat.rotation.y = -l.a;
            const back = mesh(boxGeo, cushion, group, x - ca * 7, 4.6, z - sa * 7, 4, 1, 5);
            back.rotation.set(0, -l.a, 0.9);
          }
          const p = l.parasol;
          mesh(cylinderGeo, lampPost, group, p.x, 9, p.y, 0.5, 18, 0.5);
          mesh(new Three.ConeGeometry(15, 4.5, 12), canvas[(Math.round(p.x) >> 4) & 1], group, p.x, 18.4, p.y);
        }
      }
