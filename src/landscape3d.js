      // BEGIN SUBSYSTEM: src/landscape3d.js — Landscaping for open lawns
      /**
       * Landscaping for open lawns
       * Source: src/landscape3d.js
       * Scope: createCityRenderer() closure (included after renewal3d.js).
       *
       * Renderer-only planting on the big open lawns that read as flat green
       * sheets from the street camera (graphics review, docs/audit/graphics-review.md):
       *
       *  - Battery Park: a tree either side of each lawn bay between the cross
       *    paths and a raised flower bed with a clipped box hedge in the middle.
       *  - The Great Lawn (Central Garden): picnic blankets with baskets, left
       *    where the crowd does not walk its paths.
       *
       * None of it is in the plan (no collision, nothing for the 2D map): the
       * trees stand where people may walk, like the park trees, and the beds and
       * blankets are ankle-high. Everything static goes through the batcher; the
       * flowers are one instanced draw.
       */
      {
        const group = new Three.Group();
        group.name = 'landscaping';
        scene.add(group);
        batchGroups.push(group);
        const soil = mat('#4a3a2c', 0.95),
          kerbStone = mat('#b9b2a2', 0.85),
          flowerColors = ['#d4495c', '#f0c243', '#e8e4d8', '#b464b8', '#ef8a3c', '#6f8fd8'].map((c) => new Three.Color(c)),
          flowerSpots = [];
        // A raised bed: stone kerb, soil, a box-hedge rim and flowers in drifts.
        function flowerBed(cx, cy, w, d, seed) {
          box(group, cx, 1.1, cy, w + 3, 2.2, d + 3, kerbStone);
          box(group, cx, 1.6, cy, w, 2.2, d, soil);
          box(group, cx, 3.2, cy - d / 2 + 1.6, w - 2, 2.6, 2.4, stillLeafMat);
          box(group, cx, 3.2, cy + d / 2 - 1.6, w - 2, 2.6, 2.4, stillLeafMat);
          let r = seed;
          const random = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646;
          for (let i = 0; i < w * d * 0.07; i++) {
            const u = random(),
              drift = Math.floor(u * 3);
            flowerSpots.push({
              x: cx + (u - 0.5) * (w - 5) + (random() - 0.5) * 3,
              y: cy + (random() - 0.5) * (d - 7),
              color: flowerColors[(seed + drift) % flowerColors.length],
              size: 0.9 + random() * 0.6,
            });
          }
        }
        // Battery Park: bays between the cross paths (geography.js paints them
        // every 280 units from 140 in, 16 wide).
        const park = SOUTH_PROMENADE,
          paths = [];
        for (let x = park.x + 140; x < park.x + park.w - 60; x += 280) paths.push(x);
        const midY = park.y + park.h / 2;
        paths.forEach((x, i) => {
          const next = paths[i + 1];
          if (!next) return;
          const cx = (x + 16 + next) / 2;
          flowerBed(cx, midY, 64, 16, 7 + i * 3);
          for (const side of [-1, 1]) plantTree({ x: cx + side * 86, y: midY, r: 14 + ((i + side + 2) % 3) * 1.5, blossom: (i + side) % 3 === 0, park: 'battery' });
        });
        // The Great Lawn (renewal.js COMMONS): picnic blankets and baskets.
        const lawn = COMMONS.lawn,
          blanketMaterials = [
            ['#c0392b', '#f3ece0'],
            ['#2e6a9e', '#f1f1ea'],
            ['#d9a441', '#6d4b2f'],
            ['#3f7f5b', '#efe7d0'],
          ].map(([a, b]) => {
            const tx = canvasTexture(32, (g, s) => {
              g.fillStyle = b;
              g.fillRect(0, 0, s, s);
              g.fillStyle = a;
              for (let i = 0; i < 4; i++) {
                g.fillRect(i * 8, 0, 4, s);
                g.fillRect(0, i * 8, s, 4);
              }
            });
            tx.magFilter = Three.NearestFilter;
            return new Three.MeshStandardMaterial({ map: tx, roughness: 0.95 });
          }),
          wicker = mat('#9b7446', 0.9);
        const BLANKETS = [
          [0.18, 0.22, 0.3],
          [0.34, 0.16, -0.4],
          [0.72, 0.2, 0.9],
          [0.82, 0.38, 0.2],
          [0.22, 0.62, -0.2],
          [0.3, 0.8, 1.2],
          [0.62, 0.72, 0.5],
          [0.8, 0.84, -0.6],
          [0.5, 0.36, 0.1],
          [0.46, 0.58, -1.0],
        ];
        BLANKETS.forEach(([u, v, a], i) => {
          const x = lawn.x + lawn.w * u,
            y = lawn.y + lawn.h * v,
            blanket = box(group, x, 0.35, y, 15, 0.3, 11, blanketMaterials[i % blanketMaterials.length]);
          blanket.rotation.y = a;
          const basket = box(group, x + Math.cos(a) * 5, 1.6, y - Math.sin(a) * 5, 3.2, 2.6, 2.2, wicker);
          basket.rotation.y = a;
        });
        // All the flowers: one instanced draw.
        const flowers = new Three.InstancedMesh(new Three.IcosahedronGeometry(1, 0), mat('#ffffff', 0.8), flowerSpots.length);
        flowers.name = 'bed flowers';
        const dummy = new Three.Object3D();
        flowerSpots.forEach((f, i) => {
          dummy.position.set(f.x, 3.3, f.y);
          dummy.scale.setScalar(f.size);
          dummy.updateMatrix();
          flowers.setMatrixAt(i, dummy.matrix);
          flowers.setColorAt(i, f.color);
        });
        flowers.computeBoundingSphere();
        scene.add(flowers);
      }
      // END SUBSYSTEM: src/landscape3d.js
