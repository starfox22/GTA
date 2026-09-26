      // BEGIN SUBSYSTEM: src/monarch-streets3d.js — Monarch Isle: streetscape, fountains, beach; the build
      /**
       * Monarch Isle: streetscape, fountains, beach and the build
       * Source: src/monarch-streets3d.js
       * Scope: createCityRenderer() closure (the last of the island's renderer
       * files: it builds everything and holds the per-frame update).
       *
       *   Lanterns   Victorian triple-lantern standards on the pavements and the
       *              mole (monarch.js monarchLamps), instanced street props a car
       *              can knock down; their halos in the glow field and their pools
       *              in the island's night light map.
       *   Fountains  Crown Circus: a three-tier stone fountain with a gilded crown,
       *              jets and falling sheets; Harbour Circle: a bronze compass-rose
       *              basin with a ring of arcing jets. Animated each frame near
       *              the camera; uplit at night.
       *   Beach      Monarch Beach's private strands: rows of loungers and
       *              parasols in each villa's colours, cabanas, a lifeguard chair.
       *   The rest   the payphones, the fuel canopy, the showroom forecourt, the
       *              country club's courts and putting green, the academy's
       *              pitch, the chapel's spire, the police lamp.
       */
      const ISLE_LANTERN_CAPACITY = 520,
        isleLanternPosts = new Three.InstancedMesh(new Three.CylinderGeometry(0.45, 0.8, 1, 8), tint('#1d2124', 'satin'), ISLE_LANTERN_CAPACITY),
        isleLanternArms = new Three.InstancedMesh(boxGeo, tint('#1d2124', 'satin'), ISLE_LANTERN_CAPACITY * 2),
        isleLanternHeads = new Three.InstancedMesh(new Three.CylinderGeometry(1.1, 0.7, 1, 6), new Three.MeshStandardMaterial({ color: '#fff2d2', emissive: '#ffd38a', emissiveIntensity: 0, roughness: 0.3 }), ISLE_LANTERN_CAPACITY * 3);
      for (const im of [isleLanternPosts, isleLanternArms, isleLanternHeads]) {
        im.count = 0;
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.name = 'monarch lanterns';
        scene.add(im);
      }
      function buildIsleLanterns() {
        for (const l of monarchLamps) {
          const prop = registerStreetProp('lantern', l.x, l.y),
            height = l.kind === 'mole' ? 4.2 * UNITS_PER_METRE : 4.6 * UNITS_PER_METRE;
          placePropInstance(isleLanternPosts, prop, l.x, height / 2, l.y, 1, height, 1);
          // A cross-arm with a lantern at each end and one on top.
          placePropInstance(isleLanternArms, prop, l.x, height - 3, l.y, 12, 0.7, 0.7);
          for (const [dx, dy] of [
            [-5.6, -4.2],
            [5.6, -4.2],
            [0, 1.4],
          ]) {
            placePropInstance(isleLanternHeads, prop, l.x + dx, height + dy, l.y, 1.1, 3, 1.1);
            const halo = addGlow(l.x + dx, height + dy, l.y, 10, '#ffd9a0', 0.75, { day: 0 });
            if (dx === 0) prop.halo = glowHandle(halo);
          }
          addStreak(l.x, l.y + 8, 7, 52, '#ffcf96', 0.5);
          registerFootObstacle(l.x, l.y, 1.6);
        }
      }
      /* ---- Fountains ----------------------------------------------------------------- */
      const isleFountains = [],
        isleWaterMaterial = new Three.MeshStandardMaterial({ color: '#dff4f8', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55, emissive: '#bfe8ff', emissiveIntensity: 0, depthWrite: false }),
        isleBasinWater = new Three.MeshStandardMaterial({ color: '#2f7384', roughness: 0.05, metalness: 0.3, emissive: '#1a6f8a', emissiveIntensity: 0 });
      function buildIsleFountain(c) {
        const root = isleRoot(c.x, c.y),
          r = c.island - 8,
          animated = new Three.Group();
        animated.position.set(c.x, 0, c.y);
        animated.userData.dynamic = true;
        scene.add(animated);
        statics.push({ x: c.x, y: c.y, group: animated, radius: r + 40 });
        // Planting ring round the basin.
        isleMesh(new Three.CylinderGeometry(c.island, c.island, 1.2, 40), ISLE.lawn, c.x, 0.6, c.y, 1, 1, 1, root);
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * TAU;
          isleMesh(sphereGeo, k % 2 ? ISLE.hedge : tint('#b04a78', 'matte'), c.x + Math.cos(a) * (c.island - 3), 2.2, c.y + Math.sin(a) * (c.island - 3), 2.6, 2, 2.6, root);
        }
        // The basin: a moulded stone rim and the water.
        isleMesh(new Three.CylinderGeometry(r, r + 1.5, 5, 48, 1, true), ISLE.stone, c.x, 2.5, c.y, 1, 1, 1, root);
        isleMesh(new Three.TorusGeometry(r, 1.6, 6, 48), ISLE.stone, c.x, 5, c.y, 1, 1, 1, root).rotation.x = Math.PI / 2;
        isleMesh(new Three.CylinderGeometry(r - 0.5, r - 0.5, 0.4, 48), isleBasinWater, c.x, 3.4, c.y, 1, 1, 1, root);
        const jets = [];
        if (c.id === 'crown') {
          // Three tiers on a fluted column, a gilded crown on top.
          isleMesh(new Three.CylinderGeometry(4, 6, 16, 16), ISLE.stone, c.x, 11, c.y, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(20, 12, 4, 32), ISLE.stone, c.x, 20, c.y, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(19, 19, 0.4, 32), isleBasinWater, c.x, 22, c.y, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(3, 4, 12, 12), ISLE.stone, c.x, 28, c.y, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(10, 6, 3, 24), ISLE.stone, c.x, 34.5, c.y, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(2, 2.6, 6, 10), ISLE.stone, c.x, 39, c.y, 1, 1, 1, root);
          // The crown: a gilded band with points and a cross-and-orb.
          isleMesh(new Three.CylinderGeometry(4, 3.4, 3, 16, 1, true), ISLE.gold, c.x, 43, c.y, 1, 1, 1, root);
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU;
            isleMesh(new Three.ConeGeometry(0.8, 3, 6), ISLE.gold, c.x + Math.cos(a) * 3.8, 46, c.y + Math.sin(a) * 3.8, 1, 1, 1, root);
          }
          isleMesh(sphereGeo, ISLE.gold, c.x, 47, c.y, 1.4, 1.4, 1.4, root);
          // Falling sheets from the two bowls (animated).
          for (const [y, rr, h] of [
            [20, 20, 16],
            [34.5, 10, 12],
          ]) {
            const sheet = mesh(new Three.CylinderGeometry(rr + 0.4, rr + 2.2, h, 32, 1, true), isleWaterMaterial, animated, 0, y - h / 2, 0);
            sheet.castShadow = false;
            jets.push({ mesh: sheet, kind: 'sheet', base: y - h / 2 });
          }
          // A ring of arcing jets from the basin toward the column.
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * TAU,
              j = mesh(new Three.ConeGeometry(0.6, 1, 6, 1, true), isleWaterMaterial, animated, Math.cos(a) * (r - 6), 4, Math.sin(a) * (r - 6));
            j.castShadow = false;
            jets.push({ mesh: j, kind: 'arc', a, phase: k / 12 });
          }
          const plume = mesh(new Three.ConeGeometry(1.4, 1, 8, 1, true), isleWaterMaterial, animated, 0, 48, 0);
          plume.castShadow = false;
          jets.push({ mesh: plume, kind: 'plume', base: 48 });
        } else {
          // Harbour Circle: a bronze compass rose in the basin, a sail of bronze
          // blades rising from it, and eight arcing jets.
          const bronze = tint('#7a5a36', 'metal');
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU,
              blade = isleBox(c.x + Math.cos(a) * 12, 4, c.y + Math.sin(a) * 12, k % 2 ? 10 : 22, 0.8, 3, bronze, root);
            blade.rotation.y = -a;
          }
          const sail = [
            [0, 0],
            [14, 0],
            [0, 26],
          ];
          const shape = new Three.Shape(sail.map(([x, y]) => new Three.Vector2(x, y)));
          const sailGeo = new Three.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
          for (const turn of [0, 2.1, 4.2]) {
            const m = isleMesh(sailGeo, bronze, c.x, 4, c.y, 1, 1, 1, root);
            m.rotation.y = turn;
          }
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU + 0.2,
              j = mesh(new Three.ConeGeometry(0.6, 1, 6, 1, true), isleWaterMaterial, animated, Math.cos(a) * (r - 5), 4, Math.sin(a) * (r - 5));
            j.castShadow = false;
            jets.push({ mesh: j, kind: 'arc', a, phase: k / 8 });
          }
        }
        // Uplights round the rim.
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU;
          addGlow(c.x + Math.cos(a) * (r - 2), 5, c.y + Math.sin(a) * (r - 2), 9, '#bfe8ff', 1.1, { day: 0, phase: k / 10 });
          isleLightPools.push({ x: c.x + Math.cos(a) * (r - 2), y: c.y + Math.sin(a) * (r - 2), r: 28, color: [191, 232, 255], strength: 0.3 });
        }
        signSpill(c.x, c.y, r + 20, '#bfe0ff', 0.25);
        isleFountains.push({ c, group: animated, jets, r });
      }
      function animateIsleFountains(time) {
        for (const f of isleFountains) {
          if (!f.group.visible) continue;
          for (const j of f.jets) {
            const pulse = 0.85 + 0.15 * Math.sin(time * 3 + (j.phase || 0) * TAU);
            if (j.kind === 'arc') {
              // Aim each jet up and in toward the centre, its length pulsing.
              const len = 16 * pulse;
              j.mesh.scale.set(1, len, 1);
              j.mesh.rotation.set(0, 0, 0);
              j.mesh.rotation.z = Math.cos(j.a) * 0.7;
              j.mesh.rotation.x = -Math.sin(j.a) * 0.7;
              j.mesh.position.y = 4 + len * 0.45;
            } else if (j.kind === 'plume') {
              const h = 10 + 3 * Math.sin(time * 2.1);
              j.mesh.scale.set(1, h, 1);
              j.mesh.position.y = j.base + h / 2;
            } else {
              j.mesh.scale.set(1, 1, 1);
              j.mesh.rotation.y = time * 0.4;
            }
          }
        }
      }
      /* ---- The beach ----------------------------------------------------------------- */
      function buildIsleBeach() {
        const colours = ['#1c2a44', '#f2f0ea', '#c23a2e', '#2f6a5e', '#e8c24a', '#8a5c7a'];
        let k = 0;
        for (const plan of monarchPlan.villas) {
          const v = plan.villa;
          if (v.gate !== 'south' || v.lot.y > -4900) continue;
          const colour = tint(colours[k++ % colours.length], 'matte'),
            y = v.lot.y - 100,
            root = isleRoot(v.lot.x + v.lot.w / 2, y);
          for (let x = v.lot.x + 60; x < v.lot.x + v.lot.w - 40; x += 44) {
            if (!landAt(x, y - 40)) continue;
            for (const dy of [0, -26]) lounger(root, x, y + dy, 0.4, 14, 6, colour, ISLE.teak).rotation.y = Math.PI / 2;
            isleMesh(cylinderGeo, ISLE.teak, x + 10, 9, y - 13, 0.4, 18, 0.4, root);
            isleMesh(new Three.ConeGeometry(13, 4.4, 10), colour, x + 10, 18.5, y - 13, 1, 1, 1, root);
          }
          // A cabana at the end of each strand.
          const cx = v.lot.x + v.lot.w - 30;
          if (landAt(cx, y - 20)) {
            for (const dx of [-8, 8]) for (const dz of [-8, 8]) isleBox(cx + dx, 11, y - 13 + dz, 0.8, 22, 0.8, ISLE.white, root);
            isleBox(cx, 22.4, y - 13, 20, 0.8, 20, ISLE.canvas, root);
            isleBox(cx, 12, y - 21, 18, 18, 0.3, ISLE.canvas, root);
            isleBox(cx, 1.6, y - 13, 14, 2, 10, colour, root);
          }
        }
        // The lifeguard's chair at the boulevard's beach path.
        const lx = 7240,
          ly = -5150,
          root = isleRoot(lx, ly);
        for (const dx of [-4, 4]) for (const dz of [-3, 3]) isleBox(lx + dx, 10, ly + dz, 0.8, 20, 0.8, ISLE.white, root);
        isleBox(lx, 20, ly, 10, 1, 8, ISLE.white, root);
        isleBox(lx, 26, ly, 10, 1, 8, tint('#c23a2e', 'matte'), root);
        isleMesh(cylinderGeo, ISLE.white, lx, 30, ly - 3, 0.3, 20, 0.3, root);
        isleBox(lx + 3, 38, ly - 3, 6, 3, 0.2, tint('#c23a2e', 'matte'), root);
      }
      /* ---- Payphones ------------------------------------------------------------------ */
      function buildIslePayphones() {
        for (const p of MONARCH_PAYPHONES) {
          const root = isleRoot(p.x, p.y),
            green = tint('#1f3a2e', 'gloss'),
            h = 2.5 * UNITS_PER_METRE;
          isleBox(p.x, h / 2, p.y, 7, h, 5.4, green, root);
          isleBox(p.x, h / 2 + 1, p.y + 2.8, 5.6, h - 6, 0.3, ISLE.glass, root);
          isleBox(p.x, h + 1, p.y, 8, 2, 6.4, green, root);
          isleBox(p.x, h - 1.8, p.y + 2.9, 5, 1.4, 0.2, tint('#f2e8c8', 'matte'), root);
          isleMesh(new Three.CylinderGeometry(2.4, 3.6, 2, 4), green, p.x, h + 3, p.y, 1, 1, 1, root).rotation.y = Math.PI / 4;
          kitLight(isleLights, root, p.x, h - 1.8, p.y + 3.2, '#fff4d8');
          isleLightPools.push({ x: p.x, y: p.y + 6, r: 30, color: [255, 240, 210], strength: 0.4 });
        }
      }
      /* ---- Block extras: the fuel canopy, the showroom, courts, the chapel ---------------- */
      function buildIsleBlockExtras() {
        for (const plan of monarchPlan.blocks) {
          const B = plan.block;
          if (plan.canopy) {
            const c = plan.canopy,
              root = isleRoot(c.x + c.w / 2, c.y + c.h / 2),
              y = 5.4 * UNITS_PER_METRE;
            isleBox(c.x + c.w / 2, y, c.y + c.h / 2, c.w, 3, c.h, ISLE.white, root);
            isleBox(c.x + c.w / 2, y - 1.8, c.y + c.h / 2, c.w - 4, 0.3, c.h - 4, tint('#f6f8fa', 'matte'), root);
            isleBox(c.x + c.w / 2, y + 0.6, c.y + c.h + 0.2, c.w, 2.4, 0.4, tint('#ffc22a', 'satin'), root);
            for (const px of [c.x + 60, c.x + c.w - 60]) for (const pz of [c.y + 38, c.y + c.h - 38]) isleBox(px, y / 2, pz, 3, y, 3, ISLE.white, root);
            for (const p of plan.pumps) {
              isleBox(p.x, 1, p.y, 26, 2, 12, ISLE.stone, root);
              isleBox(p.x, 7, p.y, 14, 12, 4, tint('#0e2a3a', 'satin'), root);
              isleBox(p.x, 10, p.y + 2.1, 8, 4, 0.2, ISLE.glass, root);
              isleBox(p.x, 12.6, p.y, 14.4, 1.2, 4.4, tint('#ffc22a', 'satin'), root);
            }
            for (let x = c.x + 20; x < c.x + c.w; x += 40) for (let z = c.y + 20; z < c.y + c.h; z += 40) addGlow(x, y - 3, z, 14, '#f4f8ff', 0.7, { day: 0 });
            for (let x = c.x + 20; x < c.x + c.w; x += 40) for (let z = c.y + 20; z < c.y + c.h; z += 40) isleLightPools.push({ x, y: z, r: 48, color: [244, 248, 255], strength: 0.45 });
            registerOverheadCover(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, y - 2, y + 2, 'canopy');
            // The price totem.
            const tx = c.x + c.w + 16,
              tz = c.y + c.h + 10;
            isleBox(tx, 20, tz, 10, 40, 3, tint('#0e2a3a', 'satin'), root);
            atlasSign(root, shopSignCell('SOLARIS'), tx, 34, tz + 1.6, 9.6, 2.4, neonBoard);
            isleBox(tx, 18, tz + 1.6, 8, 16, 0.2, tint('#10161a', 'satin'), root);
            addGlow(tx, 30, tz + 2, 12, '#ffd24a', 1, { day: 0 });
          }
          if (plan.forecourt) {
            const f = plan.forecourt,
              root = isleRoot(f.x + f.w / 2, f.y);
            // Turntable plinths for the cars (monarch-life.js parks them) and flag poles.
            for (let k = 0; k < 4; k++) isleMesh(new Three.CylinderGeometry(13, 13, 0.8, 32), tint('#d8d8d4', 'satin'), f.x + 40 + k * ((f.w - 80) / 3), 0.4, f.y + 24, 1, 1, 1, root);
            for (let x = f.x; x <= f.x + f.w; x += f.w / 5) {
              isleMesh(cylinderGeo, ISLE.chrome, x, 18, f.y + f.h + 2, 0.4, 36, 0.4, root);
              isleBox(x + 3.5, 32, f.y + f.h + 2, 7, 5, 0.2, tint('#c8102e', 'matte'), root);
            }
          }
          if (plan.courts) for (const t of plan.courts) buildIsleCourt(t, isleRoot(t.x, t.y), 'clay');
          if (plan.pool) {
            const P = plan.pool,
              root = isleRoot(P.x + P.w / 2, P.y);
            isleBox(P.x + P.w / 2, 0.5, P.y + P.h / 2, P.w + 10, 1, P.h + 10, ISLE.stone, root);
            isleBox(P.x + P.w / 2, 0.9, P.y + P.h / 2, P.w, 0.4, P.h, ISLE.water, root);
            for (let x = P.x + 10; x < P.x + P.w; x += 20) lounger(root, x, P.y - 12, 0.6, 14, 6, ISLE.canvas, ISLE.teak).rotation.y = Math.PI / 2;
          }
          if (plan.green) {
            const G = plan.green,
              root = isleRoot(G.x + G.w / 2, G.y + G.h / 2);
            for (const [dx, dz, colour] of [
              [0.3, 0.4, '#c8102e'],
              [0.7, 0.6, '#ffd200'],
              [0.5, 0.25, '#ffffff'],
            ]) {
              const x = G.x + G.w * dx,
                z = G.y + G.h * dz;
              isleMesh(cylinderGeo, ISLE.white, x, 8, z, 0.25, 16, 0.25, root);
              isleBox(x + 2, 14.5, z, 4, 3, 0.2, tint(colour, 'matte'), root);
              isleMesh(new Three.CylinderGeometry(1, 1, 0.2, 10), ISLE.black, x, 0.1, z, 1, 1, 1, root);
            }
          }
          if (plan.field) {
            const F = plan.field,
              root = isleRoot(F.x + F.w / 2, F.y + F.h / 2);
            for (const x of [F.x + 12, F.x + F.w - 12]) {
              for (const dz of [-14, 14]) isleBox(x, 8, F.y + F.h / 2 + dz, 0.8, 16, 0.8, ISLE.white, root);
              isleBox(x, 16, F.y + F.h / 2, 0.8, 0.8, 28, ISLE.white, root);
            }
          }
          if (plan.policeYard) {
            const p = plan.policeYard,
              root = isleRoot(p.x, p.y);
            isleMesh(cylinderGeo, ISLE.iron, p.x + p.w / 2 + 40, 13, B.y + B.h - 6, 0.5, 26, 0.5, root);
            isleBox(p.x + p.w / 2 + 40, 27, B.y + B.h - 6, 4, 4, 4, tint('#2f5fd0', 'gloss'), root);
            addGlow(p.x + p.w / 2 + 40, 27, B.y + B.h - 6, 12, '#4f7fff', 1.6, { day: 0.1 });
          }
          if (plan.reflect) {
            // The reflecting pool: a stone kerb, dark water and a line of jets, uplit at night.
            const R = plan.reflect,
              root = isleRoot(R.x + R.w / 2, R.y + R.h / 2),
              along = R.h > R.w;
            isleBox(R.x + R.w / 2, 1, R.y + R.h / 2, R.w + 12, 2, R.h + 12, ISLE.stone, root);
            isleBox(R.x + R.w / 2, 2.1, R.y + R.h / 2, R.w, 0.4, R.h, isleBasinWater, root);
            const n = Math.max(3, Math.floor((along ? R.h : R.w) / 40));
            for (let k = 0; k < n; k++) {
              const f = (k + 0.5) / n,
                x = along ? R.x + R.w / 2 : R.x + R.w * f,
                z = along ? R.y + R.h * f : R.y + R.h / 2;
              isleMesh(new Three.CylinderGeometry(0.5, 1.2, 1, 8), isleWaterMaterial, x, 2.3 + 6, z, 1, 12, 1, root);
              addGlow(x, 4, z, 8, '#bfe8ff', 0.9, { day: 0, phase: f });
              isleLightPools.push({ x, y: z, r: 30, color: [191, 232, 255], strength: 0.28 });
            }
          }
          if (plan.sculpture) {
            // Bronze on a granite drum: interlocking rings for The Sovereign, a
            // leaning arc for Monarch One.
            const S = plan.sculpture,
              root = isleRoot(S.x, S.y),
              bronze = tint('#8a5a2b', 'satin');
            isleMesh(new Three.CylinderGeometry(12, 13, 5, 24), ISLE.stoneDark, S.x, 2.5, S.y, 1, 1, 1, root);
            if (S.kind === 'rings')
              for (const [ry, tilt] of [
                [0, 0.35],
                [1.1, -0.4],
                [2.2, 0.1],
              ]) {
                const ring = isleMesh(new Three.TorusGeometry(10, 1.1, 8, 32), bronze, S.x, 17, S.y, 1, 1, 1, root);
                ring.rotation.set(Math.PI / 2 + tilt, ry, 0);
              }
            else {
              const arc = isleMesh(new Three.TorusGeometry(16, 1.6, 8, 32, Math.PI * 1.25), bronze, S.x, 5, S.y, 1, 1, 1, root);
              arc.rotation.set(0, 0.6, 0.3);
            }
            for (const s of [-1, 1]) addGlow(S.x + s * 10, 1.5, S.y + 10, 7, '#ffe2b0', 0.8, { day: 0 });
            isleLightPools.push({ x: S.x, y: S.y, r: 44, color: [255, 214, 160], strength: 0.35 });
          }
          if (plan.chapel) buildIsleChapel(plan.chapel);
        }
      }
      function buildIsleChapel(c) {
        const root = isleRoot(c.x + c.w / 2, c.y + c.h / 2),
          wall = 58,
          cx = c.x + c.w / 2;
        isleGableRoof(c.x, c.y, c.x + c.w, c.y + c.h, wall, 46, ISLE.slate, ISLE.stone, false, 3);
        // The tower on the south front and its spire.
        const tz = c.y + c.h - 14;
        isleBox(cx, 55, tz, 30, 110, 30, ISLE.stone, root);
        isleBox(cx, 111, tz, 34, 3, 34, ISLE.stoneDark, root);
        const spire = isleMesh(new Three.ConeGeometry(18, 90, 8), ISLE.slate, cx, 157, tz, 1, 1, 1, root);
        spire.rotation.y = Math.PI / 8;
        isleMesh(cylinderGeo, ISLE.gold, cx, 206, tz, 0.5, 8, 0.5, root);
        isleBox(cx, 208, tz, 5, 0.6, 0.6, ISLE.gold, root);
        // The belfry's louvred openings and a clock face.
        for (const [dx, dz, rot] of [
          [0, 15.2, 0],
          [15.2, 0, Math.PI / 2],
          [-15.2, 0, Math.PI / 2],
        ]) {
          isleBox(cx + dx, 92, tz + dz, rot ? 0.4 : 10, 16, rot ? 10 : 0.4, ISLE.black, root);
          const clock = isleMesh(new Three.CylinderGeometry(5, 5, 0.6, 20), tint('#f2ecd8', 'matte'), cx + dx * 1.02, 72, tz + dz * 1.02, 1, 1, 1, root);
          clock.rotation.set(rot ? 0 : Math.PI / 2, 0, rot ? Math.PI / 2 : 0);
        }
        // The west door: an arched oak door under a stone arch.
        isleBox(cx, 11, c.y + c.h + 1, 12, 22, 1.2, tint('#4a2e1c', 'satin'), root);
        isleMesh(new Three.TorusGeometry(7, 1.4, 6, 12, Math.PI), ISLE.stoneDark, cx, 22, c.y + c.h + 1.4, 1, 1, 1, root);
        // Stained-glass lancets glow at evensong.
        for (let z = c.y + 30; z < c.y + c.h - 30; z += 34)
          for (const s of [-1, 1]) {
            isleBox(cx + s * (c.w / 2 + 0.3), 30, z, 0.4, 24, 6, tint('#3a4e8a', 'gloss'), root);
            addGlow(cx + s * (c.w / 2 + 1.5), 30, z, 8, '#9f7fff', 0.6, { day: 0 });
          }
        atlasSign(root, shopSignCell('ST ALDRIC’S CHAPEL'), cx, 30, c.y + c.h + 1.5, 28, 7, neonBoard);
      }
      /* ---- Street trees on the medians: clipped limes, instanced ---------------------- */
      function buildIsleMedians() {
        const limes = monarchTrees.filter((t) => t.median);
        if (!limes.length) return;
        const trunks = new Three.InstancedMesh(new Three.CylinderGeometry(0.6, 0.9, 1, 6), wood, limes.length),
          crowns = new Three.InstancedMesh(new Three.SphereGeometry(1, 10, 8), leafMats[2], limes.length),
          dummy = new Three.Object3D();
        limes.forEach((t, i) => {
          dummy.position.set(t.x, 7, t.y);
          dummy.scale.set(1, 14, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          trunks.setMatrixAt(i, dummy.matrix);
          dummy.position.set(t.x, 19, t.y);
          dummy.scale.set(8, 9, 8);
          dummy.updateMatrix();
          crowns.setMatrixAt(i, dummy.matrix);
        });
        for (const im of [trunks, crowns]) {
          im.castShadow = true;
          im.receiveShadow = true;
          im.name = 'monarch medians';
          scene.add(im);
        }
      }
      /* ---- The build ------------------------------------------------------------------ */
      {
        const started = performance.now();
        for (const b of buildings) if (b.monarch && !b.villa && !b.monarchTower && !b.garden) buildIsleBuilding(b);
        for (const plan of monarchPlan.villas) buildIsleVilla(plan);
        for (const t of MONARCH_TOWERS) buildIsleTower(t);
        buildIsleMarina();
        buildIsleGarden();
        for (const c of ISLE_CIRCLES) buildIsleFountain(c);
        buildIsleBeach();
        buildIslePayphones();
        buildIsleBlockExtras();
        buildIsleLanterns();
        buildIsleMedians();
        let draws = 0;
        for (const root of isleRoots.values()) draws += kitMerge(root).length;
        kitLightCloud(isleLights, 7);
        isleRenderReport.buildMs = Math.round(performance.now() - started);
        isleRenderReport.roots = isleRoots.size;
        isleRenderReport.mergedMeshes = draws;
      }
      /* Per frame: window light after dusk, the fountains and the lighthouse. */
      function updateMonarchVisuals() {
        const night = nightAmount,
          nearIsle = viewCenter.x > 4400 && viewCenter.y < 400;
        const hour = (worldMinutes / 60) % 24,
          late = hour > 0.5 && hour < 6 ? 0.45 : 1;
        for (const m of isleWindowMaterials) m.emissiveIntensity = night * 0.85 * late;
        isleLanternHeads.material.emissiveIntensity = night * 1.8;
        isleWaterMaterial.emissiveIntensity = night * 0.6;
        isleBasinWater.emissiveIntensity = 0.05 + night * 0.4;
        updateIsleGarden(night, nearIsle);
        if (!nearIsle) return;
        animateIsleFountains(gameTime);
      }
      // END SUBSYSTEM: src/monarch-streets3d.js
