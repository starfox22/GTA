      // BEGIN SUBSYSTEM: src/monarch-villas3d.js — Monarch Isle: villas and towers
      /**
       * Monarch Isle: villas and towers
       * Source: src/monarch-villas3d.js
       * Scope: createCityRenderer() closure (after monarch3d.js, whose kit it uses).
       *
       * VILLAS. Each of the fourteen villas (monarch.js MONARCH_VILLAS, planVilla)
       * is built in its style from the same plan the collision uses: the house
       * boxes, the garage, the terrace, the pool, the court, the boundary wall
       * with its gate. Styles:
       *   modern        white cantilevered volumes, floor-to-ceiling glass, a roof
       *                 terrace, an infinity pool
       *   mediterranean ochre stucco, terracotta hipped roof, an arched loggia
       *   spanish       white stucco, terracotta roof, a round tower
       *   hamptons      grey shingle, white trim, gabled roofs with dormers, a porch
       *   neoclassical  white stucco, a pedimented portico of columns, slate roof
       *   georgian      red brick, white sash windows, a hipped slate roof
       *   tudor         half-timbered gables, tall brick chimneys
       *   chateau       limestone, a steep slate mansard, conical corner turrets
       *   artdeco       white streamline, a round corner, porthole windows
       * Every garden has hedges inside the wall, specimen trees (monarch.js plants
       * them so they collide and can be knocked down), a pool with loungers and
       * parasols, garden lamps and, on the grand lots, a tennis court.
       *
       * TOWERS. Built with the financial cluster's lofting kit (skyline3d.js):
       *   THE SOVEREIGN  a pencil tower: a chamfered square shaft in bronze glass
       *                  behind full-height bronze fins, four setbacks and an open
       *                  lantern crown lit gold with a spire.
       *   MONARCH ONE    a twisting tower: a softened square turning a quarter turn
       *                  over 48 storeys, a white balcony band every other floor, a
       *                  colour-walking LED crown and a helipad.
       */
      const VILLA_LOOK = {
        modern: { facade: 'villaGlass', roof: 'flat', wall: 'render' },
        mediterranean: { facade: 'villaTerracotta', roof: 'hip', roofColor: ISLE.terracotta, wall: 'stone' },
        spanish: { facade: 'villaStucco', roof: 'hip', roofColor: ISLE.terracotta, wall: 'render' },
        hamptons: { facade: 'villaShingle', roof: 'gable', roofColor: ISLE.slate, wall: 'hedge' },
        neoclassical: { facade: 'villaWhite', roof: 'hip', roofColor: ISLE.slate, wall: 'railings' },
        georgian: { facade: 'townhouseBrick', roof: 'hip', roofColor: ISLE.slate, wall: 'railings' },
        tudor: { facade: 'villaTudor', roof: 'gable', roofColor: tint('#5a4638', 'matte'), wall: 'hedge' },
        chateau: { facade: 'villaChateau', roof: 'mansard', roofColor: ISLE.slate, wall: 'stone' },
        artdeco: { facade: 'villaDeco', roof: 'flat', wall: 'render' },
      };
      function buildIsleVilla(plan) {
        const v = plan.villa,
          look = VILLA_LOOK[v.style],
          face = isleFacade(look.facade),
          H = plan.house,
          root = isleRoot(H.x + H.w / 2, H.y + H.h / 2),
          south = v.gate !== 'west',
          frontZ = H.y + H.h,
          cx = H.x + H.w / 2;
        const houseBox = (r, height, facade = face) => {
          isleMesh(isleWallGeometry(r.x, r.y, r.x + r.w, r.y + r.h, 0, height, 0), facade, 0, 0, 0, 1, 1, 1, root);
          isleBox(r.x + r.w / 2, 1, r.y + r.h / 2, r.w + 1.4, 2, r.h + 1.4, ISLE.stoneWarm, root);
        };
        const roofOver = (r, y, kind = look.roof, rise = Math.min(r.w, r.h) * 0.34) => {
          if (kind === 'hip') isleHipRoof(r.x, r.y, r.x + r.w, r.y + r.h, y, rise, look.roofColor, 4);
          else if (kind === 'gable') isleGableRoof(r.x, r.y, r.x + r.w, r.y + r.h, y, rise * 1.2, look.roofColor, face === isleFacade('villaTudor') ? ISLE.cream : ISLE.white, r.w >= r.h, 4);
          else if (kind === 'mansard') {
            isleMansard(r.x, r.y, r.x + r.w, r.y + r.h, y, STOREY * 1.2, look.roofColor, true);
          } else {
            isleRoofCap(r.x, r.y, r.x + r.w, r.y + r.h, y + 0.2, isleRoofMaterials.pavers);
            isleBox(r.x + r.w / 2, y + 1.6, r.y + r.h / 2, r.w + 2, 3.2, r.h + 2, ISLE.white, root).scale.set(r.w + 2, 3.2, r.h + 2);
          }
        };
        const eaves = plan.height - (look.roof === 'mansard' ? STOREY * 0.2 : 0);
        // ---- The house, by style ----
        switch (v.style) {
          case 'modern': {
            // Ground floor: a glass pavilion set back under a white upper volume that
            // cantilevers out over the terrace; a white service core.
            const g0 = { x: H.x + 10, y: H.y + 6, w: H.w - 20, h: H.h - 12 };
            houseBox(g0, plan.storey, face);
            const up = { x: H.x - 12, y: H.y - 6, w: H.w * 0.72, h: H.h + 12 };
            isleBox(up.x + up.w / 2, plan.storey + 1, up.y + up.h / 2, up.w, 2, up.h, ISLE.white, root);
            isleMesh(isleWallGeometry(up.x, up.y, up.x + up.w, up.y + up.h, plan.storey + 2, plan.storey * 2, plan.storey + 2), isleFacade('villaGlass'), 0, 0, 0, 1, 1, 1, root);
            // White fins framing the glass, and a thin roof slab with a deep overhang.
            for (let x = up.x; x <= up.x + up.w; x += 16) isleBox(x, plan.storey * 1.5 + 1, up.y + up.h + 0.6, 1.4, plan.storey - 2, 2, ISLE.white, root);
            isleBox(up.x + up.w / 2, plan.storey * 2 + 1, up.y + up.h / 2, up.w + 10, 2.4, up.h + 10, ISLE.white, root);
            isleRoofCap(up.x, up.y, up.x + up.w, up.y + up.h, plan.storey * 2 + 2.3, isleRoofMaterials.pavers);
            // The roof terrace over the rest of the ground floor.
            const t = { x: up.x + up.w, y: H.y + 6, w: H.x + H.w - 10 - (up.x + up.w), h: H.h - 12 };
            if (t.w > 20) {
              isleRoofCap(t.x, t.y, t.x + t.w, t.y + t.h, plan.storey + 2.2, isleRoofMaterials.pavers);
              isleBox(t.x + t.w / 2, plan.storey + 5.5, t.y + t.h, t.w, 6.6, 0.5, ISLE.glassRail, root);
              for (let k = 0; k < 2; k++) lounger(root, t.x + 14 + k * 14, t.y + t.h - 16, plan.storey + 2.2, 14, 6, ISLE.canvas, ISLE.teak).rotation.y = Math.PI / 2;
            }
            if (v.cantilever) {
              // Clifftop: the upper volume leaps out toward the sea on steel.
              isleBox(H.x + H.w + 30, plan.storey * 1.5 + 1, H.y + H.h / 2, 60, plan.storey, H.h * 0.6, ISLE.white, root);
              isleBox(H.x + H.w + 30, plan.storey * 1.5 + 1, H.y + H.h / 2, 61, plan.storey - 6, H.h * 0.6 - 4, ISLE.glass, root);
            }
            break;
          }
          case 'mediterranean':
          case 'spanish': {
            houseBox(H, eaves);
            roofOver(H, eaves);
            // An arched loggia along the garden front and a smaller one to the street.
            const loggiaZ = south ? H.y - 10 : H.y + H.h + 10;
            for (const [z, span] of [
              [loggiaZ, H.w * 0.7],
              [south ? H.y + H.h + 9 : H.y - 9, H.w * 0.4],
            ]) {
              const n = Math.max(3, Math.round(span / 22)),
                step = span / n;
              for (let k = 0; k <= n; k++) isleBox(cx - span / 2 + step * k, plan.storey / 2, z, 3.4, plan.storey, 3.4, ISLE.cream, root);
              for (let k = 0; k < n; k++) {
                const ax = cx - span / 2 + step * (k + 0.5),
                  arch = isleMesh(new Three.TorusGeometry(step / 2 - 1.7, 1.6, 6, 12, Math.PI), ISLE.cream, ax, plan.storey - step / 2, z, 1, 1, 1, root);
                void arch;
              }
              isleBox(cx, plan.storey + 1.4, z, span + 4, 2.8, 12, ISLE.cream, root);
              isleHipRoof(cx - span / 2 - 2, z - 6, cx + span / 2 + 2, z + 6, plan.storey + 2.8, 6, ISLE.terracotta, 2);
            }
            if (v.style === 'spanish') {
              // The round tower at the entrance corner.
              const tx = H.x + H.w - 6,
                tz = south ? H.y + H.h - 6 : H.y + 6;
              isleMesh(new Three.CylinderGeometry(14, 14, plan.height + 18, 20), ISLE.cream, tx, (plan.height + 18) / 2, tz, 1, 1, 1, root);
              isleMesh(new Three.ConeGeometry(17, 20, 20), ISLE.terracotta, tx, plan.height + 28, tz, 1, 1, 1, root);
              for (let k = 0; k < 4; k++) {
                const a = (k * Math.PI) / 2 + Math.PI / 4;
                isleBox(tx + Math.cos(a) * 14, plan.height + 6, tz + Math.sin(a) * 14, 4, 7, 0.6, ISLE.glass, root).rotation.y = -a + Math.PI / 2;
              }
            }
            break;
          }
          case 'hamptons': {
            houseBox(H, eaves);
            roofOver(H, eaves);
            // Dormers on the roof's street side and a pair of chimneys.
            const rz = south ? H.y + H.h - H.h * 0.22 : H.y + H.h * 0.22;
            for (let x = H.x + 26; x < H.x + H.w - 20; x += 34) {
              isleBox(x, eaves + 12, rz, 12, 12, 14, ISLE.white, root);
              isleBox(x, eaves + 12, rz + (south ? 7.2 : -7.2), 7, 7, 0.4, ISLE.glass, root);
              isleGableRoof(x - 6, rz - 7, x + 6, rz + 7, eaves + 18, 6, ISLE.slate, ISLE.white, false, 1.5);
            }
            for (const x of [H.x + 14, H.x + H.w - 14]) isleBox(x, eaves + 20, H.y + H.h / 2, 8, 40, 10, ISLE.brick, root);
            // The deep porch across the front: white columns and a shed roof.
            const pz = south ? H.y + H.h + 10 : H.y - 10;
            for (let x = H.x + 8; x <= H.x + H.w - 8; x += 24) isleMesh(cylinderGeo, ISLE.white, x, plan.storey / 2, pz + (south ? 8 : -8), 1.6, plan.storey, 1.6, root);
            isleBox(cx, plan.storey + 1, pz, H.w, 2, 22, ISLE.white, root);
            isleBox(cx, 0.8, pz, H.w, 1.6, 22, ISLE.teak, root);
            break;
          }
          case 'neoclassical':
          case 'georgian': {
            houseBox(H, eaves);
            roofOver(H, eaves, 'hip', Math.min(H.w, H.h) * 0.28);
            // A parapet balustrade over the cornice and end chimneys.
            for (const x of [H.x + 10, H.x + H.w - 10]) isleBox(x, eaves + 16, H.y + H.h / 2, 12, 22, 8, v.style === 'georgian' ? ISLE.brick : ISLE.white, root);
            // The portico: columns and a pediment over the front door.
            const pz = south ? H.y + H.h : H.y,
              dir = south ? 1 : -1,
              cols = v.style === 'neoclassical' ? 6 : 4,
              span = v.style === 'neoclassical' ? Math.min(H.w * 0.55, 110) : 56,
              depth = 22;
            for (let k = 0; k < cols; k++) {
              const x = cx - span / 2 + (span * k) / (cols - 1);
              isleMesh(new Three.CylinderGeometry(2.2, 2.6, eaves - 6, 12), ISLE.white, x, (eaves - 6) / 2 + 1.5, pz + dir * (depth - 3), 1, 1, 1, root);
              isleBox(x, eaves - 3.5, pz + dir * (depth - 3), 6, 2, 6, ISLE.white, root);
            }
            isleBox(cx, eaves - 1.5, pz + dir * (depth / 2), span + 8, 3, depth + 2, ISLE.white, root);
            // The pediment: a triangular prism.
            const ped = [
              [cx - span / 2 - 4, pz],
              [cx + span / 2 + 4, pz],
              [cx + span / 2 + 4, pz + dir * (depth + 1)],
              [cx - span / 2 - 4, pz + dir * (depth + 1)],
            ];
            isleMesh(prismGeometry(ped, [[cx, pz], [cx, pz], [cx, pz + dir * (depth + 1)], [cx, pz + dir * (depth + 1)]], eaves, eaves + span * 0.18, false), ISLE.white, 0, 0, 0, 1, 1, 1, root);
            // Steps up to it.
            for (let k = 0; k < 3; k++) isleBox(cx, 0.6 + k * 1.2, pz + dir * (depth + 6 - k * 3), span + 12 - k * 4, 1.2, 6, ISLE.stone, root);
            break;
          }
          case 'tudor': {
            houseBox(H, eaves);
            roofOver(H, eaves, 'gable', Math.min(H.w, H.h) * 0.5);
            // Two projecting front gables and tall clustered chimneys.
            const fz = south ? H.y + H.h : H.y,
              dir = south ? 1 : -1;
            for (const x of [H.x + H.w * 0.22, H.x + H.w * 0.72]) {
              const r = { x: x - 22, y: south ? fz - 4 : fz - 16, w: 44, h: 20 };
              houseBox(r, eaves);
              isleGableRoof(r.x, r.y, r.x + r.w, r.y + r.h, eaves, 30, look.roofColor, ISLE.cream, false, 3);
            }
            for (const x of [H.x + H.w * 0.47, H.x + 8]) {
              isleBox(x, eaves + 26, H.y + H.h / 2, 10, 52, 8, ISLE.brick, root);
              for (const dx of [-3, 3]) isleMesh(cylinderGeo, ISLE.brick, x + dx, eaves + 55, H.y + H.h / 2, 1.8, 6, 1.8, root);
            }
            void dir;
            break;
          }
          case 'chateau': {
            houseBox(H, eaves);
            roofOver(H, eaves);
            // Conical turrets at the four corners and a tall slate hipped top.
            isleHipRoof(H.x + STOREY * 0.5, H.y + STOREY * 0.5, H.x + H.w - STOREY * 0.5, H.y + H.h - STOREY * 0.5, eaves + STOREY * 1.2, 26, ISLE.slate, 0);
            for (const [x, z] of [
              [H.x, H.y],
              [H.x + H.w, H.y],
              [H.x, H.y + H.h],
              [H.x + H.w, H.y + H.h],
            ]) {
              isleMesh(new Three.CylinderGeometry(11, 11, plan.height + 8, 18), ISLE.stone, x, (plan.height + 8) / 2, z, 1, 1, 1, root);
              isleMesh(new Three.ConeGeometry(13.5, 34, 18), ISLE.slate, x, plan.height + 25, z, 1, 1, 1, root);
              isleMesh(cylinderGeo, ISLE.gold, x, plan.height + 45, z, 0.4, 8, 0.4, root);
            }
            // A grand stair and a balustraded terrace on the garden front.
            const tz = south ? H.y - 14 : H.y + H.h + 14;
            isleBox(cx, 3, tz, H.w * 0.6, 6, 26, ISLE.stone, root);
            break;
          }
          case 'artdeco': {
            houseBox(H, eaves);
            roofOver(H, eaves, 'flat');
            // The streamline corner: a full-height drum with horizontal bands, and
            // a stepped tower over the entrance.
            const dx = H.x + H.w,
              dz = south ? H.y + H.h - 20 : H.y + 20;
            isleMesh(new Three.CylinderGeometry(20, 20, plan.height, 24), ISLE.white, dx - 10, plan.height / 2, dz, 1, 1, 1, root);
            for (let y = 8; y < plan.height; y += 10) isleMesh(new Three.CylinderGeometry(20.6, 20.6, 1.2, 24), tint('#9fc4c8', 'satin'), dx - 10, y, dz, 1, 1, 1, root);
            isleMesh(new Three.CylinderGeometry(20.4, 20.4, plan.storey * 0.5, 24, 1, true), ISLE.glass, dx - 10, plan.storey * 1.4, dz, 1, 1, 1, root);
            const tw = { x: cx - 18, y: south ? H.y + H.h - 20 : H.y, w: 36, h: 20 };
            houseBox(tw, plan.height + 22);
            isleBox(tw.x + 18, plan.height + 23, tw.y + 10, 40, 2.4, 24, tint('#9fc4c8', 'satin'), root);
            // Portholes.
            for (let k = 0; k < 3; k++) isleMesh(new Three.CylinderGeometry(2.4, 2.4, 0.6, 16), ISLE.glass, tw.x + 18, plan.storey + 10 + k * 9, (south ? tw.y + tw.h : tw.y) + (south ? 0.4 : -0.4), 1, 1, 1, root).rotation.x = Math.PI / 2;
            break;
          }
        }
        // Wings and the garage.
        for (const w of plan.wings) {
          houseBox(w, w.height, face);
          if (look.roof === 'flat') isleRoofCap(w.x, w.y, w.x + w.w, w.y + w.h, w.height + 0.2, isleRoofMaterials.green);
          else roofOver(w, w.height, look.roof === 'mansard' ? 'hip' : look.roof, Math.min(w.w, w.h) * 0.3);
        }
        const G = plan.garage;
        houseBox(G, G.height, face);
        if (look.roof === 'flat') isleRoofCap(G.x, G.y, G.x + G.w, G.y + G.h, G.height + 0.2, isleRoofMaterials.gravel);
        else isleHipRoof(G.x, G.y, G.x + G.w, G.y + G.h, G.height, 12, look.roofColor || ISLE.slate, 2);
        // Garage doors on the drive side.
        const gz = v.gate === 'west' ? null : v.gate === 'south' ? G.y + G.h : G.y;
        if (gz !== null) isleBox(G.x + G.w / 2, 11, gz + (v.gate === 'south' ? 0.4 : -0.4), G.w - 12, 22, 0.6, tint(look.roof === 'flat' ? '#3a3e42' : '#e8e2d4', 'satin'), root);
        // The front door (if the style did not build a portico).
        if (!['neoclassical', 'georgian'].includes(v.style)) {
          if (v.gate !== 'west') isleDoorway(cx, south ? H.y + H.h : H.y, root, 'villa');
        }
        buildIsleVillaGarden(plan, look, root);
        // Night: the house is lit through its windows (the facade mask) and by
        // uplights on the front.
        for (let x = H.x + 10; x < H.x + H.w; x += 30) addGlow(x, 1.2, (south ? H.y + H.h : H.y) + (south ? 3 : -3), 7, '#ffe2b0', 0.8, { day: 0 });
      }
      function buildIsleVillaGarden(plan, look, root) {
        const v = plan.villa,
          L = v.lot;
        // The boundary: wall, railings on a low wall, or a privet hedge.
        for (const w of plan.walls) {
          const cx = w.x + w.w / 2,
            cz = w.y + w.h / 2;
          if (look.wall === 'hedge') {
            isleBox(cx, 7, cz, w.w + 1, 14, w.h + 3, ISLE.hedge, root);
            isleBox(cx, 14.2, cz, w.w + 1.4, 0.8, w.h + 3.4, ISLE.hedgeDark, root);
          } else if (look.wall === 'railings') {
            isleBox(cx, 2, cz, w.w, 4, w.h, ISLE.stone, root);
            const along = w.w > w.h,
              len = along ? w.w : w.h;
            isleBox(cx, 11, cz, along ? len : 0.5, 0.6, along ? 0.5 : len, ISLE.iron, root);
            for (let d = 2; d < len; d += 3) isleBox(along ? w.x + d : cx, 7.5, along ? cz : w.y + d, 0.4, 7, 0.4, ISLE.iron, root);
            for (let d = 0; d <= len; d += 60) isleBox(along ? w.x + d : cx, 7, along ? cz : w.y + d, 4, 14, 4, ISLE.stone, root);
          } else {
            const mat = look.wall === 'render' ? ISLE.white : ISLE.stoneWarm;
            isleBox(cx, 5, cz, w.w, 10, w.h, mat, root);
            isleBox(cx, 10.4, cz, w.w + 1, 0.8, w.h + 1.2, ISLE.stone, root);
            // Hedges inside the wall.
            const along = w.w > w.h;
            isleBox(cx + (along ? 0 : w.x <= L.x + 1 ? 5 : -5), 6, cz + (along ? (w.y <= L.y + 1 ? 5 : -5) : 0), along ? w.w : 6, 12, along ? 6 : w.h, ISLE.hedge, root);
          }
        }
        // The gate: stone piers with lanterns and a pair of iron gates standing open.
        const gate = plan.gateAt,
          axisY = plan.gateAxis === 'y',
          half = plan.gateWidth / 2;
        for (const s of [-1, 1]) {
          const px = axisY ? gate.x + s * (half + 3) : gate.x,
            pz = axisY ? gate.y : gate.y + s * (half + 3);
          isleBox(px, 9, pz, 7, 18, 7, ISLE.stone, root);
          isleBox(px, 18.6, pz, 8.4, 1.2, 8.4, ISLE.stoneDark, root);
          isleBox(px, 21, pz, 2.6, 3.4, 2.6, ISLE.iron, root);
          kitLight(isleLights, root, px, 21, pz, '#ffd9a0');
          addGlow(px, 21.5, pz, 9, '#ffd9a0', 0.9, { day: 0 });
          // The gate leaf, swung inward.
          const leaf = new Three.Group();
          leaf.position.set(axisY ? gate.x + s * half : gate.x, 0, axisY ? gate.y : gate.y + s * half);
          const inward = axisY ? (v.gate === 'south' ? -1 : 1) : 1;
          leaf.rotation.y = axisY ? s * inward * -1.2 : s * -1.2 + Math.PI / 2;
          root.add(leaf);
          box(leaf, -s * half * 0.5, 7, 0, half, 0.8, 0.5, ISLE.iron);
          box(leaf, -s * half * 0.5, 13, 0, half, 0.6, 0.5, ISLE.iron);
          for (let k = 1; k < 9; k++) box(leaf, -s * (half * k) / 9, 8, 0, 0.4, 13 + Math.sin((k / 9) * Math.PI) * 3, 0.4, ISLE.iron);
        }
        // A guard's lodge beside the gate on the grandest lots.
        if (L.w * L.h > 180000) {
          const lx = axisY ? gate.x + half + 22 : gate.x + 22,
            lz = axisY ? gate.y + (v.gate === 'south' ? -16 : 16) : gate.y + half + 22;
          isleBox(lx, 8, lz, 18, 16, 14, ISLE.white, root);
          isleBox(lx, 9, lz + 7.2, 12, 6, 0.4, ISLE.glass, root);
          isleBox(lx, 16.6, lz, 21, 1.2, 17, ISLE.slate, root);
          kitLight(isleLights, root, lx, 10, lz + 8, '#ffe8c0');
        }
        // Pool: coping, water, loungers and parasols along one side.
        if (plan.pool) {
          const P = plan.pool,
            pcx = P.x + P.w / 2,
            pcz = P.y + P.h / 2;
          isleBox(pcx, 0.5, pcz, P.w + 8, 1, P.h + 8, ISLE.stone, root);
          isleBox(pcx, 0.9, pcz, P.w, 0.4, P.h, ISLE.water, root);
          const along = P.w >= P.h,
            n = Math.max(2, Math.floor((along ? P.w : P.h) / 20));
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n,
              lx = along ? P.x + P.w * t : P.x + P.w + 14,
              lz = along ? P.y - 14 : P.y + P.h * t;
            const l = lounger(root, lx, lz, 0.9, 15, 6, ISLE.canvas, ISLE.teak);
            l.rotation.y = along ? Math.PI / 2 : 0;
            if (k % 2 === 0) {
              isleMesh(cylinderGeo, ISLE.teak, lx + 6, 9, lz, 0.4, 18, 0.4, root);
              isleMesh(new Three.ConeGeometry(12, 4, 8), tint(v.style === 'modern' ? '#f4f2ec' : '#e8e0cc', 'matte'), lx + 6, 18.5, lz, 1, 1, 1, root);
            }
          }
          kitLight(isleLights, root, pcx, 0.6, pcz, '#7fe8ff');
        }
        if (plan.terrace) {
          const T = plan.terrace;
          isleBox(T.x + T.w / 2, 0.6, T.y + T.h / 2, T.w, 1.2, T.h, ISLE.stone, root);
          // A dining table under a pergola at one end.
          const tx = T.x + 24,
            tz = T.y + T.h / 2;
          table(root, tx, tz, 1.2, 16, 7, ISLE.teak, 4.6);
          for (const dx of [-8, 8]) for (const dz of [-8, 8]) isleBox(tx + dx, 13, tz + dz, 1, 24, 1, ISLE.white, root);
          for (let k = -8; k <= 8; k += 4) isleBox(tx + k, 25, tz, 0.8, 0.8, 20, ISLE.white, root);
        }
        if (plan.tennis) buildIsleCourt(plan.tennis, root, v.style === 'mediterranean' || v.style === 'spanish' ? 'clay' : 'hard');
        // Garden lamps along the drive.
        const H = plan.house;
        if (plan.gateAxis === 'y') {
          const front = v.gate === 'south' ? H.y + H.h + 36 : H.y - 36;
          for (let z = Math.min(front, gate.y) + 20; z < Math.max(front, gate.y) - 10; z += 40)
            for (const s of [-1, 1]) {
              isleBox(gate.x + s * 20, 3, z, 1.2, 6, 1.2, ISLE.iron, root);
              addGlow(gate.x + s * 20, 6.2, z, 5, '#ffe0b0', 0.8, { day: 0 });
            }
        }
      }
      // A tennis court: surface paint is on the ground sheet; the net, the posts
      // and the chain-link fence with its green windbreak.
      function buildIsleCourt(t, root, surface) {
        const cx = t.x + t.w / 2,
          cz = t.y + t.h / 2,
          along = t.h > t.w;
        isleBox(cx, 1.6, cz, along ? t.w - 16 : 1, 3, along ? 1 : t.h - 16, tint('#f2f2ec', 'matte'), root);
        isleBox(cx, 3.2, cz, along ? t.w - 16 : 0.6, 0.4, along ? 0.6 : t.h - 16, tint('#f2f2ec', 'matte'), root);
        for (const s of [-1, 1]) isleBox(along ? cx + s * (t.w / 2 - 6) : cx, 2, along ? cz : cz + s * (t.h / 2 - 6), 1, 4, 1, ISLE.iron, root);
        const fence = tint('#2f4a38', 'satin');
        for (const [ax, az, bx, bz] of [
          [t.x - 6, t.y - 6, t.x + t.w + 6, t.y - 6],
          [t.x - 6, t.y + t.h + 6, t.x + t.w + 6, t.y + t.h + 6],
          [t.x - 6, t.y - 6, t.x - 6, t.y + t.h + 6],
          [t.x + t.w + 6, t.y - 6, t.x + t.w + 6, t.y + t.h + 6],
        ]) {
          const alongX = ax !== bx,
            len = alongX ? bx - ax : bz - az;
          isleBox((ax + bx) / 2, 13.5, (az + bz) / 2, alongX ? len : 0.5, 0.6, alongX ? 0.5 : len, fence, root);
          isleBox((ax + bx) / 2, 3, (az + bz) / 2, alongX ? len : 0.3, 6, alongX ? 0.3 : len, fence, root);
          for (let d = 0; d <= len; d += 16) isleBox(alongX ? ax + d : ax, 7, alongX ? az : az + d, 0.8, 14, 0.8, fence, root);
        }
        void surface;
      }
      /* ---- The towers ------------------------------------------------------------------ */
      SKY_GLAZING.sovereign = { glass: ['#b89a74', '#5a4632'], mullion: ['#3d2c1c', 3], spandrel: ['#7a5c3c', 0.14], pattern: 'fins', lit: 0.5, warm: 0.9 };
      SKY_GLAZING.monarchOne = { glass: ['#a8c8d8', '#4a7086'], mullion: ['#f2f4f5', 2], spandrel: ['#f4f5f4', 0.3], pattern: 'bands', lit: 0.55, warm: 0.7 };
      function buildIsleTower(t) {
        const b = t.building,
          group = new Three.Group();
        group.position.set(b.x, 0, b.y);
        scene.add(group);
        batchGroups.push(group);
        statics.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, group, radius: Math.max(b.w, b.h) + 60 });
        skySeed = 2024 + (t.id === 'sovereign' ? 0 : 1) * 7919;
        const T = { b, group, W: b.w, D: b.h, cx: b.w / 2, cz: b.h / 2, top: b.height, podium: 0 },
          H = b.height;
        if (t.id === 'sovereign') {
          const glass = skyGlass('sovereign', b),
            gold = skyLed('#ffcf7a', 2.6),
            plan = planRect(T.W - 14, T.D - 14, 16);
          // A limestone base of two storeys with a bronze entrance frame.
          box(group, T.cx, 14, T.cz, T.W, 28, T.D, skyStone);
          box(group, T.cx, 12, T.D + 0.6, 30, 20, 1.2, skyLobby);
          box(group, T.cx, 24, T.D + 5, 44, 1.4, 10, skyBronze);
          const tiers = [
            [26, H * 0.62, 1],
            [H * 0.62, H * 0.8, 0.9],
            [H * 0.8, H * 0.93, 0.8],
            [H * 0.93, H, 0.7],
          ];
          for (const [y0, y1, s] of tiers) {
            skyLoft(T, plan, [{ y: y0, s }, { y: y1, s }], glass, { cap: skyRoof });
            skyFins(T, plan, { y: y0, s }, y0 + 1, y1 - 2, 11, 3.4, 1.3, skyBronze);
            skyBand(T, plan, { s }, y1 - 3, y1 + 1, 1.4, skyBronze);
            skyBand(T, plan, { s }, y1 + 0.6, y1 + 1.6, 1.6, gold);
          }
          // The lantern crown: gilded fins round a lit core, and a spire.
          skyFins(T, plan, { y: H, s: 0.7 }, H, H + t.crown, 8, 4, 1.5, gold);
          skyLoft(T, planRect(T.W * 0.34, T.D * 0.34, 8), [{ y: H }, { y: H + t.crown * 0.8 }], skyLed('#ffe6b0', 1.6));
          mesh(new Three.CylinderGeometry(0.8, 3.2, 120, 10), skyBronze, group, T.cx, H + t.crown + 60, T.cz);
          skyBeacon(T, T.cx, H + t.crown + 122, T.cz, 0.2);
          roofKeepOut(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);
          T.top = H + t.crown + 122;
        } else {
          const glass = skyGlass('monarchOne', b),
            white = skyStone,
            plan0 = planSuper(1, 1, 3.4, 48),
            steps = 24,
            sections = [];
          // Podium: a double-height lobby in glass with a white canopy.
          box(group, T.cx, 18, T.cz, T.W - 4, 36, T.D - 4, skyLobby);
          box(group, T.cx, 37, T.cz, T.W, 2.4, T.D, white);
          for (let k = 0; k <= steps; k++) {
            const u = k / steps;
            sections.push({ y: 38 + (H - 38) * u, r: u * (Math.PI / 2), s: 1 - 0.06 * Math.sin(u * Math.PI) });
          }
          const f = fitScale(plan0, sections, T.W / 2 - 8, T.D / 2 - 8),
            plan = scalePlan(plan0, f);
          skyLoft(T, plan, sections, glass);
          // A white balcony band every other floor, turning with the tower.
          const floor = t.floor;
          for (let y = 38 + floor * 2; y < H - 4; y += floor * 2) {
            const u = (y - 38) / (H - 38);
            skyBand(T, plan, { r: u * (Math.PI / 2), s: 1 - 0.06 * Math.sin(u * Math.PI) }, y - 0.9, y + 0.6, 2.6, white);
          }
          const last = sections[steps];
          skyBand(T, plan, last, H - 4, H + 2, 1.6, skyLed('#9fe0ff', 3.2, true));
          skyBand(T, plan, sections[Math.round(steps * 0.5)], (38 + H) / 2 - 2, (38 + H) / 2 + 2, 1.6, skyLed('#9fe0ff', 2.2, true));
          if (b.helipad) roofHelipad(group, b, H);
          box(group, T.W - 18, H + 18, T.D - 18, 1.2, 36, 1.2, skySteel);
          roofKeepOut(b.x + T.W - 18, b.y + T.D - 18, 8, 8);
          skyBeacon(T, T.W - 18, H + 37, T.D - 18, 0.6);
          T.top = H + 38;
        }
        // The name on the podium.
        atlasSign(group, towerNameCell(t.name), T.cx, 30, T.D + 1.4, Math.min(T.W * 0.8, 90), Math.min(T.W * 0.8, 90) / 8, neonCutout);
        signSpill(b.x + T.cx, b.y + T.D + 14, 50, '#ffe2b0', 0.35);
        b.crownHeight = Math.max(0, T.top - H);
        allBuildings.push({ b, group, height: T.top, materials: [skyGlassMaterials.get(t.id === 'sovereign' ? 'sovereign' : 'monarchOne')] });
      }
      // END SUBSYSTEM: src/monarch-villas3d.js
