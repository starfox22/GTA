      // BEGIN SUBSYSTEM: src/monarch-garden3d.js — The Royal Botanic Garden and its Palm House
      /**
       * The Royal Botanic Garden
       * Source: src/monarch-garden3d.js
       * Scope: createCityRenderer() closure (after monarch3d.js).
       *
       * THE PALM HOUSE, after Kew's: a long glasshouse of curved wrought-iron ribs
       * and glass on a Portland stone plinth. The centre is a two-tier transept (a
       * lower barrel along the house, a clerestory gallery, an upper barrel across
       * it ending in two half-domes, 19 m to the ridge); the two wings are lower
       * barrels ending in apsidal half-domes. The glass is a translucent,
       * reflective material (the interior shows through: palms under the
       * transept, banana and tree ferns in the wings, a white spiral stair to the
       * gallery); after dark it is lit warm from inside.
       *
       * THE PLANTS, each its own model: giant water lilies with upturned rims and
       * pink flowers on the pond, tree ferns in the fern gully, a grove of dragon
       * blood trees (forked branches under dense umbrella crowns) in the Socotra
       * bed, saguaro, barrel cacti, agaves and prickly pears in the arid bed,
       * clumps of bird-of-paradise round the pond, a bamboo grove, clipped
       * topiary (cones, balls, spirals and a peacock) in the parterres, and
       * bougainvillea arches along the terrace walk. The flowering cherries are
       * ordinary trees (monarch.js plants them as blossoming trees).
       */
      const gardenGlass = new Three.MeshStandardMaterial({
          color: '#e4f3ee',
          roughness: 0.06,
          metalness: 0.25,
          transparent: true,
          opacity: 0.3,
          emissive: '#ffcf8a',
          emissiveIntensity: 0,
          side: Three.DoubleSide,
          depthWrite: false,
        }),
        gardenIron = tint('#f3f3ec', 'satin'),
        gardenGlows = [];
      gardenGlass.onBeforeCompile = cityMaterialPatch;
      gardenGlass.customProgramCacheKey = () => 'isle-garden-glass';
      /* A glass barrel along x (from x0 to x1) or along z: vertical glass walls to
         `wall`, then an elliptical roof to `top`; iron ribs every `rib` units. */
      function gardenBarrel(root, c, alongX, from, to, half, wall, top, rib = 9) {
        const profile = [];
        const n = 14;
        profile.push([-half, 3], [-half, wall]);
        for (let k = 1; k < n; k++) {
          const th = Math.PI - (k / n) * Math.PI;
          profile.push([half * Math.cos(th), wall + (top - wall) * Math.sin(th)]);
        }
        profile.push([half, wall], [half, 3]);
        // The glass skin as one strip per profile segment.
        const positions = [],
          at = (a, p) => (alongX ? [a, p[1], c + p[0]] : [c + p[0], p[1], a]);
        for (let k = 0; k < profile.length - 1; k++) {
          const p = profile[k],
            q = profile[k + 1],
            quad = [at(from, p), at(to, p), at(to, q), at(from, p), at(to, q), at(from, q)];
          for (const v of quad) positions.push(...v);
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        root.add(new Three.Mesh(geo, gardenGlass));
        // Ribs across, purlins along.
        for (let a = from; a <= to + 0.1; a += rib) bridgeTube(root, profile.map((p) => V3(...at(a, p))), a === from || a > to - rib ? 1 : 0.55, gardenIron, 4);
        for (const k of [1, 4, 7, 10, 13, 16]) {
          const p = profile[Math.min(k, profile.length - 1)];
          bridgeMember(root, V3(...at(from, p)), V3(...at(to, p)), 0.6, 0.6, gardenIron);
        }
        return profile;
      }
      /* A half-dome over a semicircle of radius r at (x, z), bulging toward `dir`
         (+1 / -1 along x, or along z), with vertical glass to `wall` and a dome to `top`. */
      function gardenApse(root, x, z, r, wall, top, alongX, dir) {
        const start = alongX ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : dir > 0 ? 0 : Math.PI;
        const wallGeo = new Three.CylinderGeometry(r, r, wall - 3, 20, 1, true, start, Math.PI);
        const wallMesh = new Three.Mesh(wallGeo, gardenGlass);
        wallMesh.position.set(x, (wall + 3) / 2, z);
        root.add(wallMesh);
        const dome = new Three.Mesh(new Three.SphereGeometry(1, 20, 8, start, Math.PI, 0, Math.PI / 2), gardenGlass);
        dome.position.set(x, wall, z);
        dome.scale.set(r, top - wall, r);
        root.add(dome);
        // Ribs radiating over the dome and a ring at the eaves.
        for (let k = 0; k <= 8; k++) {
          const a = start + (k / 8) * Math.PI,
            pts = [];
          for (let j = 0; j <= 8; j++) {
            const t = (j / 8) * (Math.PI / 2);
            pts.push(V3(x + Math.sin(a) * Math.cos(t) * r, wall + Math.sin(t) * (top - wall), z + Math.cos(a) * Math.cos(t) * r));
          }
          pts.unshift(V3(x + Math.sin(a) * r, 3, z + Math.cos(a) * r));
          bridgeTube(root, pts, 0.55, gardenIron, 4);
        }
      }
      function buildIslePalmHouse() {
        const G = MONARCH_GARDEN,
          H = G.house,
          cx = H.x,
          cz = H.y,
          root = isleRoot(cx, cz),
          wingHalf = 78,
          centreHalf = H.d / 2 - 2,
          dome = H.dome / 2,
          x0 = cx - H.w / 2,
          x1 = cx + H.w / 2;
        // The Portland stone plinth and steps.
        isleBox(cx, 1.5, cz, H.w - wingHalf * 2 + 4, 3, wingHalf * 2 + 6, ISLE.stone, root);
        isleBox(cx, 1.5, cz, H.dome + 4, 3, H.d, ISLE.stone, root);
        for (const x of [x0 + wingHalf, x1 - wingHalf]) isleMesh(new Three.CylinderGeometry(wingHalf + 3, wingHalf + 3, 3, 24), ISLE.stone, x, 1.5, cz, 1, 1, 1, root);
        for (let k = 0; k < 3; k++) isleBox(cx, 0.5 + k, cz + centreHalf + 9 - k * 3, 60 - k * 6, 1, 4, ISLE.stone, root);
        // The wings: lower barrels to their apses.
        for (const [a, b, dir] of [
          [x0 + wingHalf, cx - dome, -1],
          [cx + dome, x1 - wingHalf, 1],
        ]) {
          gardenBarrel(root, cz, true, a, b, wingHalf, 30, 78);
          gardenApse(root, dir < 0 ? a : b, cz, wingHalf, 30, 78, true, dir);
        }
        // The transept: a lower barrel along the house, the clerestory, an upper barrel across.
        gardenBarrel(root, cz, true, cx - dome, cx + dome, centreHalf, 38, 96, 8);
        const galleryHalf = 56;
        for (const side of [-1, 1]) {
          isleBox(cx, 96, cz + side * galleryHalf, H.dome - 12, 1.6, 4, gardenIron, root);
          isleBox(cx + side * (dome - 6), 96, cz, 4, 1.6, galleryHalf * 2, gardenIron, root);
        }
        gardenBarrel(root, cx, false, cz - galleryHalf, cz + galleryHalf, dome - 6, 112, 152, 8);
        const clerestory = new Three.Mesh(isleWallGeometry(cx - dome + 6, cz - galleryHalf, cx + dome - 6, cz + galleryHalf, 96, 112, 96), gardenGlass);
        root.add(clerestory);
        for (const dir of [-1, 1]) gardenApse(root, cx, cz + dir * galleryHalf, dome - 6, 112, 152, false, dir);
        // The lantern on the ridge with a gilded finial.
        isleBox(cx, 155, cz, 10, 6, galleryHalf * 1.4, gardenIron, root);
        isleMesh(new Three.ConeGeometry(2, 8, 8), ISLE.gold, cx, 162, cz, 1, 1, 1, root);
        // The south doors: a glazed porch with a pediment.
        const pz = cz + centreHalf;
        for (const dx of [-14, 14]) isleBox(cx + dx, 13, pz + 6, 2, 26, 2, gardenIron, root);
        isleBox(cx, 27, pz + 6, 32, 2, 14, gardenIron, root);
        isleBox(cx, 13, pz + 12, 26, 24, 0.4, gardenGlass, root);
        // ---- The interior ----
        // Beds on the floor, a white spiral stair to the gallery.
        isleBox(cx, 3.6, cz, H.w - 60, 1, 60, tint('#3f5a34', 'matte'), root);
        const stairX = cx + dome - 24,
          stairZ = cz - 30;
        isleMesh(cylinderGeo, gardenIron, stairX, 50, stairZ, 1, 94, 1, root);
        for (let k = 0; k < 30; k++) {
          const a = k * 0.55,
            step = isleBox(stairX + Math.cos(a) * 5, 4 + k * 3.1, stairZ + Math.sin(a) * 5, 9, 0.6, 3, gardenIron, root);
          step.rotation.y = -a;
        }
        // Palms under the transept, banana and ferns down the wings.
        for (const [dx, dz, s] of [
          [-30, -20, 1.9],
          [26, 24, 2.1],
          [0, -48, 1.6],
          [-40, 40, 1.4],
          [44, -36, 1.5],
        ])
          makePalm(cx + dx, cz + dz, s);
        for (let x = x0 + 70; x < x1 - 60; x += 38) {
          if (Math.abs(x - cx) < dome + 10) continue;
          const z = cz + ((Math.round(x) % 3) - 1) * 26;
          gardenBanana(root, x, z, 1 + ((x * 7) % 5) / 10);
          gardenTreeFern(root, x + 16, cz - 30 + ((x * 13) % 60), 0.8);
        }
        // The warm light inside at night, and the glass itself glowing.
        for (let x = x0 + 40; x < x1 - 30; x += 60) {
          gardenGlows.push(addGlow(x, 40, cz, 40, '#ffd8a0', 0.6, { day: 0 }));
          isleLightPools.push({ x, y: cz, r: 110, color: [255, 206, 140], strength: 0.4 });
          kitLight(isleLights, root, x, 60, cz + 40, '#ffe2b0');
          kitLight(isleLights, root, x, 60, cz - 40, '#ffe2b0');
        }
        signSpill(cx, cz, 320, '#ffd9a0', 0.4);
      }
      /* ---- Plants ------------------------------------------------------------------- */
      const P_GREEN = tint('#3f7a3a', 'matte'),
        P_DARK = tint('#2c5a2e', 'matte'),
        P_BLUE = tint('#6f9a8e', 'matte'),
        P_BARK = tint('#6b5440', 'matte'),
        P_FERN = tint('#4f8f3e', 'matte'),
        P_CACTUS = tint('#5c8a4a', 'matte'),
        P_BAMBOO = tint('#8fae4a', 'satin'),
        P_MAGENTA = tint('#c2307a', 'matte'),
        P_PINK = tint('#f2a6c4', 'matte'),
        P_ORANGE = tint('#f08a1c', 'satin'),
        P_LILY = tint('#3f7a36', 'satin');
      // A curved frond (or leaf) as a chain of flat boxes from a point, arching over.
      function gardenFrond(root, x, y, z, heading, length, width, droop, material, segments = 4) {
        let px = x,
          py = y,
          pz = z,
          pitch = 0.7;
        for (let k = 0; k < segments; k++) {
          const seg = length / segments,
            nx = px + Math.cos(heading) * Math.cos(pitch) * seg,
            nz = pz + Math.sin(heading) * Math.cos(pitch) * seg,
            ny = py + Math.sin(pitch) * seg;
          const m = bridgeMember(root, V3(px, py, pz), V3(nx, ny, nz), width * (1 - k / (segments + 1)), 0.3, material);
          m.castShadow = k < 2;
          px = nx;
          py = ny;
          pz = nz;
          pitch -= droop;
        }
      }
      function gardenTreeFern(root, x, z, s = 1) {
        const h = 22 * s;
        isleMesh(new Three.CylinderGeometry(1.2 * s, 1.8 * s, h, 7), P_BARK, x, h / 2, z, 1, 1, 1, root);
        for (let k = 0; k < 11; k++) gardenFrond(root, x, h, z, (k / 11) * TAU, 17 * s, 3.6 * s, 0.42, P_FERN);
        isleMesh(sphereGeo, tint('#6b5a30', 'matte'), x, h + 0.8, z, 1.8 * s, 1.4 * s, 1.8 * s, root);
        registerFootObstacle(x, z, 2 * s);
      }
      function gardenBanana(root, x, z, s = 1) {
        const h = 16 * s;
        isleMesh(new Three.CylinderGeometry(1.1 * s, 1.5 * s, h, 7), tint('#7a8a4a', 'matte'), x, h / 2, z, 1, 1, 1, root);
        for (let k = 0; k < 7; k++) gardenFrond(root, x, h, z, (k / 7) * TAU + 0.3, 14 * s, 6 * s, 0.32, P_GREEN, 3);
      }
      function gardenDragonTree(root, x, z, s = 1) {
        // A stout trunk forking twice into a dense umbrella crown.
        const h = 20 * s;
        isleMesh(new Three.CylinderGeometry(2 * s, 2.8 * s, h, 9), tint('#8a7a62', 'matte'), x, h / 2, z, 1, 1, 1, root);
        const tips = [];
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + 0.4,
            mid = V3(x + Math.cos(a) * 5 * s, h + 7 * s, z + Math.sin(a) * 5 * s);
          bridgeMember(root, V3(x, h - 1, z), mid, 1.8 * s, 1.8 * s, tint('#8a7a62', 'matte'));
          for (const turn of [-0.45, 0.45]) {
            const b = a + turn,
              tip = V3(mid.x + Math.cos(b) * 7 * s, mid.y + 5 * s, mid.z + Math.sin(b) * 7 * s);
            bridgeMember(root, mid, tip, 1.1 * s, 1.1 * s, tint('#8a7a62', 'matte'));
            tips.push(tip);
          }
        }
        // The crown: a flattened dome with the rosettes of stiff leaves on top.
        const crownY = h + 13 * s;
        isleMesh(new Three.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2), P_DARK, x, crownY - 2 * s, z, 18 * s, 7 * s, 18 * s, root);
        isleMesh(new Three.CylinderGeometry(18 * s, 16 * s, 2 * s, 16), tint('#243f24', 'matte'), x, crownY - 2.5 * s, z, 1, 1, 1, root);
        for (const t of tips) isleMesh(new Three.ConeGeometry(3 * s, 4 * s, 7), tint('#35602f', 'matte'), t.x, crownY + 3.4 * s, t.z, 1, 1, 1, root);
        registerFootObstacle(x, z, 3 * s);
      }
      function gardenSaguaro(root, x, z, s = 1) {
        const h = 28 * s;
        isleMesh(new Three.CylinderGeometry(2.4 * s, 2.6 * s, h, 10), P_CACTUS, x, h / 2, z, 1, 1, 1, root);
        isleMesh(sphereGeo, P_CACTUS, x, h, z, 2.4 * s, 2.2 * s, 2.4 * s, root);
        for (const [a, y, reach, up] of [
          [0.3, h * 0.45, 6, 10],
          [3.4, h * 0.6, 5, 8],
        ]) {
          const ax = x + Math.cos(a) * reach * s,
            az = z + Math.sin(a) * reach * s;
          bridgeMember(root, V3(x, y, z), V3(ax, y, az), 3.4 * s, 3.4 * s, P_CACTUS);
          isleMesh(new Three.CylinderGeometry(1.7 * s, 1.7 * s, up * s, 8), P_CACTUS, ax, y + (up * s) / 2, az, 1, 1, 1, root);
          isleMesh(sphereGeo, P_CACTUS, ax, y + up * s, az, 1.7 * s, 1.6 * s, 1.7 * s, root);
        }
        registerFootObstacle(x, z, 2.6 * s);
      }
      function gardenAgave(root, x, z, s = 1) {
        for (let k = 0; k < 13; k++) {
          const a = (k / 13) * TAU,
            tilt = 0.35 + (k % 3) * 0.2;
          const leaf = isleMesh(new Three.ConeGeometry(0.9 * s, 9 * s, 4), P_BLUE, x + Math.cos(a) * 2 * s, 4 * s, z + Math.sin(a) * 2 * s, 1, 1, 1, root);
          leaf.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
        }
      }
      function gardenBarrelCactus(root, x, z, s = 1) {
        isleMesh(new Three.SphereGeometry(1, 12, 6), tint('#7a9a3a', 'matte'), x, 2.6 * s, z, 3.2 * s, 3 * s, 3.2 * s, root);
        isleMesh(sphereGeo, tint('#e8c43a', 'matte'), x, 5.4 * s, z, 1.2 * s, 0.6 * s, 1.2 * s, root);
      }
      function gardenPricklyPear(root, x, z, s = 1) {
        const pads = [
          [0, 4, 0, 0],
          [3, 9, 0.5, 0.6],
          [-3, 9, -0.4, -0.5],
          [5, 14, 0.9, 1.1],
          [-1, 14, 0, -0.2],
        ];
        for (const [dx, y, rz, ry] of pads) {
          const pad = isleMesh(sphereGeo, P_CACTUS, x + dx * s, y * s, z, 3 * s, 3.6 * s, 0.8 * s, root);
          pad.rotation.set(0, ry, rz * 0.4);
        }
      }
      function gardenBirdOfParadise(root, x, z, s = 1) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU,
            lx = x + Math.cos(a) * 3 * s,
            lz = z + Math.sin(a) * 3 * s;
          bridgeMember(root, V3(x, 0.5, z), V3(lx, 9 * s, lz), 0.4, 0.4, P_GREEN);
          const leaf = isleMesh(sphereGeo, P_GREEN, lx, 12 * s, lz, 1.4 * s, 4 * s, 0.4 * s, root);
          leaf.rotation.y = -a;
        }
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1,
            fx = x + Math.cos(a) * 2 * s,
            fz = z + Math.sin(a) * 2 * s,
            flower = isleMesh(new Three.ConeGeometry(0.9 * s, 5 * s, 5), P_ORANGE, fx, 13 * s, fz, 1, 1, 1, root);
          flower.rotation.z = 1.2;
          flower.rotation.y = -a;
          isleMesh(new Three.ConeGeometry(0.5 * s, 3 * s, 4), tint('#3f5ad8', 'satin'), fx + 1, 13.5 * s, fz, 1, 1, 1, root).rotation.z = 1.4;
        }
      }
      function gardenBamboo(root, bed) {
        let seed = 91;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 70; i++) {
          const x = bed.x + 10 + rnd() * (bed.w - 20),
            z = bed.y + 10 + rnd() * (bed.h - 20),
            h = 34 + rnd() * 26;
          const culm = isleMesh(new Three.CylinderGeometry(0.55, 0.7, h, 5), P_BAMBOO, x, h / 2, z, 1, 1, 1, root);
          culm.rotation.set((rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12);
          for (let k = 0; k < 3; k++) isleMesh(sphereGeo, P_GREEN, x + (rnd() - 0.5) * 6, h * (0.6 + k * 0.15), z + (rnd() - 0.5) * 6, 4, 2.2, 3, root);
          if (i % 6 === 0) registerFootObstacle(x, z, 5);
        }
      }
      function gardenTopiary(root, x, z, kind, s = 1) {
        isleBox(x, 2, z, 7 * s, 4, 7 * s, ISLE.terracotta, root);
        if (kind === 'cone') isleMesh(new Three.ConeGeometry(5 * s, 18 * s, 14), ISLE.hedge, x, 4 + 9 * s, z, 1, 1, 1, root);
        else if (kind === 'ball') {
          isleMesh(sphereGeo, ISLE.hedge, x, 4 + 5 * s, z, 5 * s, 5 * s, 5 * s, root);
          isleMesh(sphereGeo, ISLE.hedge, x, 4 + 13 * s, z, 3.4 * s, 3.4 * s, 3.4 * s, root);
        } else if (kind === 'spiral') {
          for (let k = 0; k < 5; k++) {
            const r = (5 - k * 0.8) * s,
              t = isleMesh(new Three.TorusGeometry(r, 1.8 * s, 6, 16), ISLE.hedge, x, 5 + k * 4 * s, z, 1, 1, 1, root);
            t.rotation.x = Math.PI / 2 + 0.25;
            t.rotation.y = k * 1.2;
          }
          isleMesh(sphereGeo, ISLE.hedge, x, 5 + 21 * s, z, 1.8 * s, 1.8 * s, 1.8 * s, root);
        } else if (kind === 'peacock') {
          isleMesh(sphereGeo, ISLE.hedge, x, 9 * s, z, 8 * s, 5 * s, 6 * s, root);
          isleMesh(new Three.CylinderGeometry(1.6 * s, 2.4 * s, 10 * s, 8), ISLE.hedge, x + 5 * s, 16 * s, z, 1, 1, 1, root).rotation.z = -0.3;
          isleMesh(sphereGeo, ISLE.hedge, x + 7 * s, 22 * s, z, 2.2 * s, 2.2 * s, 2.2 * s, root);
          // The fanned tail.
          const tail = isleMesh(new Three.CylinderGeometry(12 * s, 12 * s, 2 * s, 18, 1, false, Math.PI * 0.55, Math.PI * 0.9), ISLE.hedge, x - 5 * s, 16 * s, z, 1, 1, 1, root);
          tail.rotation.z = Math.PI / 2;
        }
      }
      function gardenLilyPads(root, pond) {
        let seed = 17;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 26; i++) {
          const a = rnd() * TAU,
            d = Math.sqrt(rnd()) * 0.8,
            x = pond.x + Math.cos(a) * pond.rx * d,
            z = pond.y + Math.sin(a) * pond.ry * d,
            r = 5 + rnd() * 5;
          // The Victoria's pad: a flat disc with a tall upturned rim, red beneath.
          isleMesh(new Three.CylinderGeometry(r, r, 0.4, 20), P_LILY, x, 1.1, z, 1, 1, 1, root);
          isleMesh(new Three.CylinderGeometry(r + 0.3, r, 1.4, 20, 1, true), tint('#9a3a36', 'satin'), x, 1.6, z, 1, 1, 1, root);
          if (i % 4 === 0) {
            isleMesh(sphereGeo, rnd() < 0.5 ? P_PINK : tint('#f6f2ec', 'satin'), x + r * 0.2, 2.4, z, 1.6, 1.2, 1.6, root);
            for (let k = 0; k < 6; k++) {
              const pa = (k / 6) * TAU,
                petal = isleMesh(sphereGeo, P_PINK, x + r * 0.2 + Math.cos(pa) * 1.4, 2.2, z + Math.sin(pa) * 1.4, 1.2, 0.4, 0.6, root);
              petal.rotation.y = -pa;
            }
          }
        }
      }
      function gardenArch(root, x, z) {
        const arch = isleMesh(new Three.TorusGeometry(14, 0.5, 5, 16, Math.PI), ISLE.iron, x, 4, z, 1, 1, 1, root);
        void arch;
        for (let k = 0; k <= 10; k++) {
          const a = (k / 10) * Math.PI;
          isleMesh(sphereGeo, k % 3 ? P_MAGENTA : P_GREEN, x + Math.cos(a) * 14, 4 + Math.sin(a) * 14, z + ((k % 2) - 0.5) * 1.6, 3, 2.6, 2.6, root);
        }
        for (const s of [-1, 1]) registerFootObstacle(x + s * 14, z, 1.2);
      }
      function buildIsleGarden() {
        const G = MONARCH_GARDEN,
          B = G.beds,
          root = isleRoot(G.x + G.w / 2, G.y + G.h / 2);
        buildIslePalmHouse();
        gardenLilyPads(isleRoot(G.pond.x, G.pond.y), G.pond);
        // The pond's coping and a water surface.
        isleMesh(new Three.CylinderGeometry(1, 1, 0.4, 48), isleBasinWater, G.pond.x, 0.8, G.pond.y, G.pond.rx, 1, G.pond.ry);
        isleMesh(new Three.TorusGeometry(1, 0.03, 6, 48), ISLE.stone, G.pond.x, 1.2, G.pond.y, G.pond.rx + 4, G.pond.ry + 4, 1).rotation.x = Math.PI / 2;
        // Bird-of-paradise round the pond.
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU;
          gardenBirdOfParadise(root, G.pond.x + Math.cos(a) * (G.pond.rx + 22), G.pond.y + Math.sin(a) * (G.pond.ry + 22), 0.9);
        }
        // The arid bed.
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 9; i++) gardenSaguaro(root, B.arid.x + 20 + rnd() * (B.arid.w - 40), B.arid.y + 20 + rnd() * (B.arid.h - 40), 0.8 + rnd() * 0.5);
        for (let i = 0; i < 14; i++) gardenBarrelCactus(root, B.arid.x + 10 + rnd() * (B.arid.w - 20), B.arid.y + 10 + rnd() * (B.arid.h - 20), 0.7 + rnd() * 0.6);
        for (let i = 0; i < 10; i++) gardenAgave(root, B.arid.x + 14 + rnd() * (B.arid.w - 28), B.arid.y + 14 + rnd() * (B.arid.h - 28), 0.8 + rnd() * 0.5);
        for (let i = 0; i < 5; i++) gardenPricklyPear(root, B.arid.x + 20 + rnd() * (B.arid.w - 40), B.arid.y + 20 + rnd() * (B.arid.h - 40), 0.9);
        // The fern gully.
        for (let i = 0; i < 16; i++) gardenTreeFern(root, B.ferns.x + 16 + rnd() * (B.ferns.w - 32), B.ferns.y + 16 + rnd() * (B.ferns.h - 32), 0.8 + rnd() * 0.5);
        // The Socotra grove.
        for (let i = 0; i < 7; i++) gardenDragonTree(root, B.socotra.x + 30 + (i % 4) * 75 + rnd() * 10, B.socotra.y + 40 + Math.floor(i / 4) * 70 + rnd() * 10, 0.9 + rnd() * 0.35);
        gardenBamboo(root, B.bamboo);
        // Topiary on the parterres.
        for (const bed of [B.parterreWest, B.parterreEast]) {
          const kinds = ['cone', 'ball', 'spiral'];
          for (let k = 0; k < 4; k++) gardenTopiary(root, bed.x + 12 + (k * (bed.w - 24)) / 3, bed.y - 12, kinds[k % 3], 1);
          for (let k = 0; k < 4; k++) gardenTopiary(root, bed.x + 12 + (k * (bed.w - 24)) / 3, bed.y + bed.h + 12, kinds[(k + 1) % 3], 0.9);
        }
        gardenTopiary(root, G.gate.x - 60, G.gate.y - 30, 'peacock', 1.1);
        gardenTopiary(root, G.gate.x + 60, G.gate.y - 30, 'peacock', 1.1);
        for (const a of G.arches) gardenArch(root, a.x, a.y);
        // The railings and the gates.
        for (const f of G.fence) {
          const along = f.w > f.h,
            len = along ? f.w : f.h,
            cx = f.x + f.w / 2,
            cz = f.y + f.h / 2;
          isleBox(cx, 2, cz, along ? len : 3, 4, along ? 3 : len, ISLE.stone, root);
          isleBox(cx, 12, cz, along ? len : 0.5, 0.6, along ? 0.5 : len, ISLE.iron, root);
          for (let d = 1.5; d < len; d += 3) {
            const bar = isleBox(along ? f.x + d : cx, 8, along ? cz : f.y + d, 0.4, 8, 0.4, ISLE.iron, root);
            void bar;
          }
        }
        for (const b of G.bollards) isleMesh(cylinderGeo, ISLE.iron, b.x, 4, b.y, 1.4, 8, 1.4, root);
        for (const gate of G.gates)
          for (const s of [-1, 1]) {
            const px = gate.axis === 'y' ? gate.x + s * (gate.width / 2 + 4) : gate.x,
              pz = gate.axis === 'y' ? gate.y : gate.y + s * (gate.width / 2 + 4);
            isleBox(px, 12, pz, 8, 24, 8, ISLE.stone, root);
            isleMesh(sphereGeo, ISLE.stone, px, 27, pz, 3.4, 3.4, 3.4, root);
            addGlow(px, 20, pz, 8, '#ffd9a0', 0.7, { day: 0 });
            isleLightPools.push({ x: px, y: pz, r: 64, color: [255, 214, 160], strength: 0.4 });
          }
        // The name over the south gate on an iron overthrow.
        const sg = G.gates[0];
        isleBox(sg.x, 30, sg.y, sg.width + 8, 1.2, 1.2, ISLE.iron, root);
        isleBox(sg.x, 36, sg.y + 0.2, 60, 15, 1.4, tint('#2f4a2a', 'satin'), root);
        atlasSign(root, shopSignCell('ROYAL BOTANIC GARDEN'), sg.x, 36, sg.y + 1.2, 56, 14, neonBoard);
        // Benches round the pond.
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU + 0.2,
            x = G.pond.x + Math.cos(a) * (G.pond.rx + 34),
            z = G.pond.y + Math.sin(a) * (G.pond.ry + 34),
            bench = isleBox(x, 3.4, z, 14, 1, 4.4, ISLE.teak, root);
          bench.rotation.y = -a + Math.PI / 2;
          registerFootObstacle(x, z, 5);
        }
        // Garden lamps along the walks.
        for (let z = G.y + 40; z < G.y + G.h; z += 70)
          for (const s of [-1, 1]) {
            if (z > G.house.y - G.house.d / 2 - 40 && z < G.house.y + G.house.d / 2 + 40) continue;
            isleMesh(cylinderGeo, ISLE.iron, 8000 + s * 30, 9, z, 0.6, 18, 0.6, root);
            isleMesh(sphereGeo, tint('#fff2d2', 'satin'), 8000 + s * 30, 19, z, 1.8, 1.8, 1.8, root);
            addGlow(8000 + s * 30, 19, z, 9, '#ffe0b0', 0.8, { day: 0 });
            isleLightPools.push({ x: 8000 + s * 30, y: z, r: 60, color: [255, 214, 160], strength: 0.4 });
            registerFootObstacle(8000 + s * 30, z, 1.2);
          }
      }
      function updateIsleGarden(night, near) {
        gardenGlass.emissiveIntensity = night * 0.32;
        gardenGlass.opacity = 0.3 + night * 0.12;
        void near;
      }
      // END SUBSYSTEM: src/monarch-garden3d.js
