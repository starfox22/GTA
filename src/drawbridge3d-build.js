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
