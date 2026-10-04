      // Off-road 3D trail dressing: the rock the tyres feel (rideRelief) drawn as rock, edge boulders, trail-marker posts, cairns, fallen logs, the ford's wet stones.
      /**
       * TRAIL DRESSING (the hill climb courses, built once; everything static goes in
       * the course group, merged per material and cell by batchStaticGroups, so the
       * whole dressing is a handful of draw calls on materials every program
       * already has):
       *   rock skin   on each rock section (OFFROAD_SECTIONS rocks) a fine sheet laid
       *               over the carriageway at terrainHeight + rideRelief, sunk a
       *               little, so exactly the slabs and stones the suspension climbs
       *               stand out of the ground (granite in the rock garden, sandstone
       *               on the slickrock); boulders line the edges beyond the wheels
       *   markers     a wooden post with an amber band every ~60 m, alternating
       *               sides (not on the rock, not round the hairpins)
       *   cairns      a stack of stones on each keyhole's island and a big one on
       *               the summit
       *   logs        a few fallen trunks beside the forest two-track
       *   ford        wet stones along the waterline at each ford (offroadFords;
       *               the water itself is the streams' ribbon, county3d-forest.js)
       * Nothing here collides or changes the trail: the renderer only reads the plan.
       */
      // Faceted (detail 0: flat faces) and varied: smooth spheres read as eggs.
      const trailRockGeo = new Three.DodecahedronGeometry(1, 0),
        trailStoneGeo = new Three.IcosahedronGeometry(1, 0),
        trailGranite = staticMat('#6e6a62', 0.93),
        trailGraniteDark = staticMat('#59564f', 0.95),
        trailGraniteWarm = staticMat('#7a7064', 0.92),
        trailSandstone = staticMat('#9c8366', 0.9),
        trailSkinGranite = staticMat('#5f5b54', 0.9),
        trailSkinSandstone = staticMat('#8e7558', 0.88),
        trailWetStone = staticMat('#4f4c45', 0.32),
        trailPostWood = staticMat('#6a5035', 0.86),
        trailPostBand = staticMat('#e3a234', 0.55),
        trailBark = staticMat('#4e3e2d', 0.95),
        trailDressing = { skins: 0, skinVertices: 0, boulders: 0, posts: 0, cairns: 0, logs: 0, wetStones: 0 };
      // Unit tangent and left normal of a trail at a path sample.
      function trailFrame(path, i) {
        const n = path.length - 1,
          a = path[Math.max(0, i - 1)],
          b = path[Math.min(n, i + 1)],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          len = Math.hypot(dx, dy) || 1;
        return { tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len };
      }
      // A rock sheet over a rock section: rideRelief exactly, sunk 0.35 so bare ground stays ground.
      function trailRockSkin(trail, band, material) {
        const path = trail.path,
          n = path.length - 1,
          i0 = Math.max(1, Math.round(band.from * n) - 3),
          i1 = Math.min(n - 1, Math.round(band.to * n) + 3),
          half = trail.width / 2 + 5,
          step = 2,
          columns = Math.ceil((2 * half) / step) + 1,
          positions = [],
          indices = [];
        let rows = 0;
        for (let i = i0; i < i1; i++) {
          const [ax, ay] = path[i],
            [bx, by] = path[i + 1],
            k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
          for (let sub = 0; sub < k; sub++) {
            const f = sub / k,
              x = ax + (bx - ax) * f,
              y = ay + (by - ay) * f,
              fa = trailFrame(path, i),
              fb = trailFrame(path, i + 1),
              nx = fa.nx + (fb.nx - fa.nx) * f,
              ny = fa.ny + (fb.ny - fa.ny) * f;
            for (let j = 0; j < columns; j++) {
              const across = -half + j * step,
                px = x + nx * across,
                py = y + ny * across;
              positions.push(px, terrainHeight(px, py) + rideRelief(px, py) - 0.22, py);
            }
            if (rows)
              for (let j = 0; j < columns - 1; j++) {
                const a = (rows - 1) * columns + j,
                  b = rows * columns + j;
                indices.push(a, b, a + 1, a + 1, b, b + 1);
              }
            rows++;
          }
        }
        if (rows < 2) return;
        // Each triangle its own vertices: flat faces, the facets of broken rock.
        const flat = new Float32Array(indices.length * 3);
        indices.forEach((v, k) => flat.set(positions.slice(v * 3, v * 3 + 3), k * 3));
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(flat, 3));
        geo.computeVertexNormals();
        const skin = new Three.Mesh(geo, material);
        skin.castShadow = false;
        skin.receiveShadow = true;
        trailGroup.add(skin);
        trailDressing.skins++;
        trailDressing.skinVertices += flat.length / 3;
      }
      function trailBoulder(x, y, size, material, seed) {
        const h = terrainHeight(x, y),
          squash = 0.5 + terrainHash(seed, 2, 41) * 0.35,
          b = mesh(trailRockGeo, material, trailGroup, x, h + size * squash * 0.2, y, size * (0.8 + terrainHash(seed, 3, 41) * 0.7), size * squash, size * (0.8 + terrainHash(seed, 7, 41) * 0.4));
        b.rotation.set((terrainHash(seed, 4, 41) - 0.5) * 0.6, terrainHash(seed, 5, 41) * TAU, (terrainHash(seed, 6, 41) - 0.5) * 0.6);
        trailDressing.boulders++;
        return b;
      }
      function trailCairn(x, y, base, seed) {
        let z = terrainHeight(x, y) - base * 0.15,
          size = base;
        for (let k = 0; k < 5 && size > 0.7; k++) {
          const s = mesh(trailStoneGeo, trailGranite, trailGroup, x + (terrainHash(seed, k, 43) - 0.5) * size * 0.3, z + size * 0.55, y + (terrainHash(seed, k, 44) - 0.5) * size * 0.3, size * 1.15, size * 0.62, size);
          s.rotation.y = terrainHash(seed, k, 45) * TAU;
          z += size * 1.05;
          size *= 0.76;
        }
        trailDressing.cairns++;
      }
      function trailPost(x, y) {
        const h = terrainHeight(x, y);
        box(trailGroup, x, h + 4.2, y, 1.3, 9, 1.3, trailPostWood);
        box(trailGroup, x, h + 7.6, y, 1.45, 1.3, 1.45, trailPostBand);
        trailDressing.posts++;
      }
      MOUNTAIN_TRAILS.forEach((trail, t) => {
        const path = trail.path,
          n = path.length - 1,
          half = trail.width / 2,
          sections = OFFROAD_SECTIONS[t],
          onRock = (i) => sections.rocks.some((b) => i >= b.from * n - 4 && i <= b.to * n + 4),
          nearTurn = (x, y, extra) => (trail.turns || []).some((k) => Math.hypot(x - k.x, y - k.y) < k.r + half + extra) || trail.hairpins.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < HAIRPIN_PAD + extra);
        // The rock the tyres feel, and boulders along the edges of it.
        for (const band of sections.rocks) {
          const slick = /SLICK/.test(band.name),
            stones = slick ? [trailSandstone, trailGraniteWarm] : [trailGranite, trailGraniteDark, trailGraniteWarm];
          trailRockSkin(trail, band, slick ? trailSkinSandstone : trailSkinGranite);
          for (let i = Math.round(band.from * n); i <= Math.round(band.to * n); i += 2)
            for (const side of [-1, 1]) {
              if (terrainHash(i, side + 3, 47) < 0.45) continue;
              const f = trailFrame(path, i),
                across = side * (half + 4 + terrainHash(i, side, 48) * 10),
                x = path[i][0] + f.nx * across,
                y = path[i][1] + f.ny * across;
              trailBoulder(x, y, 2.4 + terrainHash(i, side, 49) * 3.6, stones[Math.floor(terrainHash(i, side, 50) * stones.length)], i * 7 + side);
            }
        }
        // Trail markers: a post every ~60 m, alternating sides.
        for (let i = 12, side = 1; i < n - 14; i += 10, side = -side) {
          const f = trailFrame(path, i),
            x = path[i][0] + f.nx * side * (half + 4),
            y = path[i][1] + f.ny * side * (half + 4);
          if (onRock(i) || nearTurn(x, y, 12)) continue;
          trailPost(x, y);
        }
        // Cairns: on each keyhole's island, and on the summit.
        (trail.turns || []).forEach((k, j) => trailCairn(k.x, k.y, 2.8, 900 + j));
        const top = path[n];
        trailCairn(top[0] + 12, top[1] - 10, 4.6, 990 + t);
        // Fallen trunks beside the two-track through the woods (the muddy lower trail).
        for (let i = 20, side = -1; i < sections.mudTo * n; i += 23, side = -side) {
          const f = trailFrame(path, i),
            across = side * (half + 9 + terrainHash(i, 1, 51) * 8),
            x = path[i][0] + f.nx * across,
            y = path[i][1] + f.ny * across;
          if (nearTurn(x, y, 6) || terrainHash(i, 2, 51) < 0.3) continue;
          const length = 26 + terrainHash(i, 3, 51) * 20,
            radius = 1.4 + terrainHash(i, 4, 51) * 0.9,
            a = Math.atan2(f.ty, f.tx) + (terrainHash(i, 5, 51) - 0.5) * 0.8,
            ca = Math.cos(a),
            sa = Math.sin(a),
            ha = terrainHeight(x - ca * length * 0.5, y - sa * length * 0.5),
            hb = terrainHeight(x + ca * length * 0.5, y + sa * length * 0.5);
          rod(trailGroup, new Three.Vector3(x - ca * length * 0.5, ha + radius * 0.8, y - sa * length * 0.5), new Three.Vector3(x + ca * length * 0.5, hb + radius * 0.8, y + sa * length * 0.5), radius, trailBark);
          trailDressing.logs++;
        }
      });
      // The fords: wet stones along both waterlines and a few in the shallows.
      for (const [j, f] of offroadFords().entries()) {
        const c = Math.cos(f.a),
          s = Math.sin(f.a);
        for (let k = 0; k < 26; k++) {
          const along = (terrainHash(j, k, 53) - 0.5) * 2 * f.along * 1.1,
            across = (terrainHash(j, k, 54) - 0.5) * 2 * f.across,
            x = f.x + c * along - s * across,
            y = f.y + s * along + c * across,
            depth = f.level - terrainHeight(x, y);
          // On the waterline or in the shallows, never out in the wheel lines' deep water.
          if (depth > 2.2 || depth < -2.5 || (Math.abs(across) < 12 && depth > 0.4)) continue;
          const size = 0.9 + terrainHash(j, k, 55) * 1.6,
            stone = mesh(trailStoneGeo, trailWetStone, trailGroup, x, terrainHeight(x, y) + size * 0.25, y, size * 1.3, size * 0.55, size);
          stone.rotation.y = terrainHash(j, k, 56) * TAU;
          trailDressing.wetStones++;
        }
      }
