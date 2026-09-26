      // Damage 3D world hits: shop windows, bullet holes, structure impacts and blasts, sparks, knocked props (impactEffect).
      // ---- World hits: walls, shop windows, ground -------------------------------------------
      function shopPaneAt(building, x) {
        return building?.shopPanes?.find((p) => x > p.x0 - 0.5 && x < p.x1 + 0.5) || null;
      }
      function shatterShopPane(pane) {
        if (pane.state === 2) return;
        pane.state = 2;
        addDecal(DECAL.pane, pane.cx, (3 + SHOP_FLOOR * 0.8) / 2, pane.face, 0, 0, 1, pane.width + 0.4, SHOP_FLOOR * 0.8 - 2.6, 0, 1, null, 0.14);
        addDecal(DECAL.shards, pane.cx, 0.12, pane.face + 7, 0, 1, 0, pane.width * 0.95, 12, Math.random() < 0.5 ? 0 : Math.PI, 0.95);
        for (let j = 0; j < 22; j++)
          fx.push({
            x: pane.cx + (Math.random() - 0.5) * pane.width,
            y: 3 + Math.random() * 24,
            z: pane.face + 1,
            vx: (Math.random() - 0.5) * 30,
            vy: 10 + Math.random() * 30,
            vz: 10 + Math.random() * 40,
            life: 0.6 + Math.random() * 0.5,
            max: 1.1,
            color: Math.random() < 0.5 ? '#e4f1f7' : '#9fc4d6',
            size: 1 + Math.random() * 1.4,
            case: true,
          });
      }
      function bulletHole(x, y, z, nx, ny, size, surface, building) {
        if (surface === 'ground') {
          addDecal(DECAL.scuff, x, z + 0.1, y, 0, 1, 0, size * 3.2, size * 2.2, Math.random() * TAU, 0.9);
          return 'dust';
        }
        const pane = ny > 0.5 && z > 1.8 && z < 12.2 ? shopPaneAt(building, x) : null;
        if (pane) {
          if (pane.state === 2) return 'glass';
          pane.hits = (pane.hits || 0) + 1;
          // Plate glass stars around each round, then gives way after a handful, or at once to a rifle.
          if (pane.hits >= 5 || size >= 2.4) shatterShopPane(pane);
          else {
            pane.state = 1;
            addDecal(DECAL.star, x, z, pane.face, 0, 0, 1, size * 5, size * 5, Math.random() * TAU, 0.95, null, 0.12);
          }
          return 'glass';
        }
        addDecal(DECAL.chip, x, z, y, nx, 0, ny, size * 3, size * 3, Math.random() * TAU, 0.95, null, wallOffset(building, ny, z));
        return 'wall';
      }
      // Heavy impact into a facade: a crack star, chunks knocked off, a shop window gone.
      function structureImpact(x, y, nx, ny, closing, building, elevation) {
        const z = elevation + 4 + Math.random() * 4,
          size = clamp(9 + (closing - 110) * 0.06, 9, 26),
          color = facadeColor(building);
        const pane = ny > 0.5 ? shopPaneAt(building, x) : null;
        if (pane) shatterShopPane(pane);
        else addDecal(DECAL.crack, x, z, y, nx, 0, ny, size, size, Math.random() * TAU, 0.92, null, wallOffset(building, ny, z));
        const off = wallOffset(building, ny, z);
        spawnChunks(x + nx * (off + 1), z, y + ny * (off + 1), nx, ny, Math.round(clamp((closing - 100) / 14, 3, 14)), color, 0.5);
        if (closing > 190) spawnRubble(x + nx * off, y + ny * off, nx, ny, Math.round(clamp((closing - 180) / 10, 3, 14)), color, 8);
        for (let j = 0; j < 6; j++)
          fx.push({
            x: x + nx * 4 + (Math.random() - 0.5) * 10,
            y: z,
            z: y + ny * 4 + (Math.random() - 0.5) * 10,
            vx: nx * 20 + (Math.random() - 0.5) * 20,
            vy: 8 + Math.random() * 10,
            vz: ny * 20 + (Math.random() - 0.5) * 20,
            life: 1.4,
            max: 1.4,
            color: '#b3aa9c',
            size: 10,
            smoke: true,
          });
      }
      // The windows of the floors above a blast. They are painted into the facade atlas
      // (WINDOW_GRIDS in cityscape3d.js, in 512-pixel tile coordinates), so each broken
      // pane is placed where the wall texture repeats its window. Only the street (south)
      // faces are mapped this way; they are the ones the camera sees.
      let windowsBroken = 0;
      function blowWindows(building, px, py, ny, reach, base) {
        const kind = building.archetype;
        if (ny < 0.5 || kind === 'tower' || kind === 'decoTower' || kind === 'skyline') return;
        const grid = WINDOW_GRIDS[kind === 'brick' ? 0 : kind === 'office' ? 1 : kind === 'warehouse' ? 2 : 3];
        if (!grid) return;
        // The same repeats facadeMaterial() gives the wall texture.
        const repeatX = Math.max(1, Math.round(building.w / 34) / 4),
          repeatY = Math.max(0.5, Math.round(building.height / STOREY) / 4),
          // The dark pane fills the middle 77% of the decal tile.
          width = ((grid.w / 512 / repeatX) * building.w) / 0.77,
          height = ((grid.h / 512 / repeatY) * building.height) / 0.77,
          lowest = building.shopPanes ? SHOP_FLOOR + 1.3 : 5;
        for (let n = 0; n < Math.ceil(repeatY); n++)
          for (const row of grid.rows) {
            // A row can be cut by the cornice or the shopfront: break only what shows.
            const centre = ((n + 1 - row / 512) / repeatY) * building.height,
              bottom = Math.max(lowest, centre - height * 0.385),
              top = Math.min(building.height - 1, centre + height * 0.385);
            if (top - bottom < 3) continue;
            const z = (bottom + top) / 2,
              paneHeight = (top - bottom) / 0.77;
            for (let k = 0; k < Math.ceil(repeatX); k++)
              for (const col of grid.cols) {
                const x = building.x + ((k + col / 512) / repeatX) * building.w;
                if (x > building.x + building.w - 2) continue;
                if (Math.hypot(x - px, z - (base + 10)) > reach || Math.random() > 0.85) continue;
                addDecal(DECAL.window, x, z, py, 0, 0, 1, width, paneHeight, 0, 0.95, null, wallOffset(building, 1, z) + 0.08);
                windowsBroken++;
                for (let j = 0; j < 4; j++)
                  fx.push({
                    x,
                    y: z,
                    z: py + 2,
                    vx: (Math.random() - 0.5) * 16,
                    vy: Math.random() * 10,
                    vz: 20 + (Math.random() - 0.5) * 16,
                    life: 1 + Math.random() * 0.6,
                    max: 1.6,
                    color: '#cfe3ec',
                    size: 1.2,
                    case: true,
                  });
              }
          }
      }
      // An explosion near buildings: soot blooms and streaks on the nearest faces, blown
      // chunks and a rubble heap close in, every shop window and upper pane in reach.
      function structureBlast(x, y, altitude, power) {
        const reach = 120 * power,
          seen = new Set();
        for (const dx of [-1, 0, 1])
          for (const dy of [-1, 0, 1])
            for (const b of buildingsNear(x + dx * reach * 0.7, y + dy * reach * 0.7)) {
              if (seen.has(b) || b.depotWall) continue;
              seen.add(b);
              const px = clamp(x, b.x, b.x + b.w),
                py = clamp(y, b.y, b.y + b.h),
                distance = Math.hypot(px - x, py - y);
              if (distance > reach || distance < 0.01 || altitude > b.height + 10) continue;
              // The face the blast is outside of.
              const gaps = [
                  [x - (b.x + b.w), 1, 0],
                  [b.x - x, -1, 0],
                  [y - (b.y + b.h), 0, 1],
                  [b.y - y, 0, -1],
                ].sort((p, q) => q[0] - p[0]),
                [, nx, ny] = gaps[0],
                k = 1 - distance / reach,
                color = facadeColor(b),
                tx = -ny,
                ty = nx,
                bloom = clamp(altitude + 12 + 6 * power, 6, b.height - 4);
              addDecal(DECAL.scorch, px, bloom, py, nx, 0, ny, (48 + 60 * power) * (0.55 + 0.45 * k), (40 + 50 * power) * (0.55 + 0.45 * k), Math.random() * TAU, clamp(0.4 + 0.55 * k, 0, 0.95), null, wallOffset(b, ny, bloom) + 0.05);
              if (b.height > 36 && k > 0.25)
                addDecal(DECAL.soot, px + tx * (Math.random() - 0.5) * 10, bloom + 30 * power, py + ty * (Math.random() - 0.5) * 10, nx, 0, ny, 36 * power, Math.min(b.height - bloom, 80 * power), 0, 0.6 * k, null, 0.26);
              if (k > 0.35) {
                const craters = 1 + Math.floor(k * 2.5 * power);
                for (let i = 0; i < craters; i++) {
                  const along = (Math.random() - 0.5) * 36 * power,
                    cz = altitude + 3 + Math.random() * 15,
                    size = (10 + Math.random() * 12) * power * (0.6 + k * 0.6);
                  addDecal(DECAL.crater, px + tx * along, cz, py + ty * along, nx, 0, ny, size, size * (0.8 + Math.random() * 0.3), Math.random() * TAU, 0.97, null, wallOffset(b, ny, cz) + 0.1);
                }
                const off = wallOffset(b, ny, 2);
                spawnRubble(px + nx * off, py + ny * off, nx, ny, Math.round((10 + 26 * k) * power), color, 16 * power);
                addDecal(DECAL.rubble, px + nx * (off + 9), terrainHeight(px, py) + 0.14, py + ny * (off + 9), 0, 1, 0, 46 * power, 30 * power, Math.atan2(nx, ny), 0.9);
                spawnChunks(px + nx * (off + 2), altitude + 8, py + ny * (off + 2), nx, ny, Math.round(18 * k * power), color);
              }
              if (b.shopPanes && ny > 0.5)
                for (const pane of b.shopPanes) if (Math.abs(pane.cx - x) < reach * 0.8 && distance < reach * 0.75) shatterShopPane(pane);
              if (k > 0.2) blowWindows(b, px, py, ny, reach * 0.6 * k, altitude);
            }
      }
      /**
       * A main-gun round into a facade (damage.js heavyRoundHitsBuilding): a breach
       * blown through the wall (a dark hole in a ring of stripped plaster, cracks
       * running out of it, soot above), a burst of masonry thrown into the street,
       * rubble raining down the face onto the pavement and heaping at its foot, a
       * dust cloud, and the windows and shop glass around it gone. Everything comes
       * from the shared decal ring and debris pools, so a long bombardment only
       * recycles the oldest marks. structureBlast() then adds the scorch and craters
       * of the explosion itself.
       */
      let shellBreaches = 0;
      function shellImpact(x, y, z, nx, ny, building, power = 1) {
        shellBreaches++;
        const color = facadeColor(building),
          off = wallOffset(building, ny, z),
          tx = -ny,
          ty = nx,
          size = 22 * power;
        // Stripped render round the hole, then the hole, then cracks and soot.
        addDecal(DECAL.crater, x, z, y, nx, 0, ny, size * 1.9, size * 1.7, Math.random() * TAU, 0.97, null, off + 0.12);
        addDecal(DECAL.hole, x, z, y, nx, 0, ny, size * 1.25, size * 1.1, Math.random() * TAU, 1, null, off + 0.2);
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * TAU,
            r = size * (0.8 + Math.random() * 0.5),
            cz = z + Math.sin(a) * r;
          if (cz < 2 || cz > building.height - 2) continue;
          addDecal(DECAL.crack, x + tx * Math.cos(a) * r, cz, y + ty * Math.cos(a) * r, nx, 0, ny, size * 0.9, size * 0.9, a, 0.9, null, off + 0.1);
        }
        if (building.height - z > 20)
          addDecal(DECAL.soot, x, Math.min(building.height - 8, z + 26 * power), y, nx, 0, ny, 26 * power, Math.min(building.height - z - 4, 60), 0, 0.55, null, off + 0.25);
        // Masonry thrown out into the street...
        spawnChunks(x + nx * (off + 2), z, y + ny * (off + 2), nx, ny, Math.round(24 * power), color, 1.25);
        // ...and more that tumbles down the face and piles on the pavement.
        for (let i = 0; i < Math.round(20 * power); i++) {
          const along = (Math.random() - 0.5) * size * 1.2;
          newDebris(chunks, 700, {
            x: x + nx * (off + 1.5) + tx * along,
            y: z + (Math.random() - 0.5) * size * 0.6,
            z: y + ny * (off + 1.5) + ty * along,
            vx: nx * (8 + Math.random() * 26) + tx * (Math.random() - 0.5) * 20,
            vy: Math.random() * 25,
            vz: ny * (8 + Math.random() * 26) + ty * (Math.random() - 0.5) * 20,
            size: 1 + Math.random() * 3.2,
            color: rubbleColor(new Three.Color(color)),
          });
        }
        const foot = wallOffset(building, ny, 2);
        spawnRubble(x + nx * foot, y + ny * foot, nx, ny, Math.round(22 * power), color, size * 0.7);
        addDecal(DECAL.rubble, x + nx * (foot + 10), terrainHeight(x, y) + 0.15, y + ny * (foot + 10), 0, 1, 0, size * 2.4, size * 1.5, Math.atan2(nx, ny), 0.92);
        // A dust cloud rolling off the wall.
        for (let j = 0; j < 16; j++)
          fx.push({
            x: x + nx * (off + 4) + tx * (Math.random() - 0.5) * size,
            y: z + (Math.random() - 0.5) * size * 0.6,
            z: y + ny * (off + 4) + ty * (Math.random() - 0.5) * size,
            vx: nx * (14 + Math.random() * 26) + tx * (Math.random() - 0.5) * 24,
            vy: -4 + Math.random() * 12,
            vz: ny * (14 + Math.random() * 26) + ty * (Math.random() - 0.5) * 24,
            life: 2.4 + Math.random() * 1.6,
            max: 4,
            color: '#a79d8e',
            size: 16 + Math.random() * 10,
            smoke: true,
          });
        const pane = ny > 0.5 && z < 16 ? shopPaneAt(building, x) : null;
        if (pane) shatterShopPane(pane);
        if (building.shopPanes && ny > 0.5)
          for (const p of building.shopPanes) if (Math.abs(p.cx - x) < 60 * power) shatterShopPane(p);
        blowWindows(building, x, y, ny, 70 * power, z - 10);
      }
      function groundStain(x, y, elevation, kind, size) {
        addDecal(DECAL[kind] ?? DECAL.oil, x, elevation + 0.12, y, 0, 1, 0, size, size * (0.7 + Math.random() * 0.3), Math.random() * TAU, 0.85);
      }
      function sparks(x, y, height, dx, dy, count) {
        for (let j = 0; j < count; j++) {
          const s = 50 + Math.random() * 90,
            spread = (Math.random() - 0.5) * 0.9;
          fx.push({
            x,
            y: height,
            z: y,
            vx: (dx + dy * spread) * s * (Math.random() < 0.5 ? 1 : -1),
            vy: 15 + Math.random() * 45,
            vz: (dy - dx * spread) * s * (Math.random() < 0.5 ? 1 : -1),
            life: 0.18 + Math.random() * 0.3,
            max: 0.48,
            color: Math.random() < 0.3 ? '#fff6d8' : '#ffb347',
            size: 1.1 + Math.random() * 0.8,
            glow: true,
            case: true,
          });
        }
      }
      // Bullet strike effects: sparks off metal, glitter off glass, a puff off masonry
      // or dirt, a splash on water.
      function impactEffect(x, z, kind, altitude) {
        const metal = kind === 'metal',
          glassHit = kind === 'glass',
          water = kind === 'water';
        const count = metal ? 8 : glassHit ? 10 : water ? 9 : 5;
        for (let j = 0; j < count; j++)
          fx.push({
            x,
            y: 5 + altitude,
            z,
            vx: (Math.random() - 0.5) * (water ? 30 : 100),
            vy: water ? 50 + Math.random() * 60 : 35 + Math.random() * 55,
            vz: (Math.random() - 0.5) * (water ? 30 : 100),
            life: 0.18 + Math.random() * 0.22 + (water ? 0.3 : 0),
            max: water ? 0.7 : 0.4,
            color: metal ? '#ffd084' : glassHit ? (j % 2 ? '#e8f4fa' : '#9fc4d6') : water ? '#dcedf5' : kind === 'dust' ? '#a8987f' : '#b6aba0',
            size: metal ? 1.7 : glassHit ? 1.3 : water ? 2.2 : 3,
            glow: metal,
            case: metal || glassHit || water,
            smoke: !metal && !glassHit && !water,
          });
      }

      // ---- Street furniture ------------------------------------------------------------------
      const propDummy = new Three.Object3D();
      // Adds a part of a knockable prop to an instanced pool and links it to the prop.
      function placePropInstance(im, prop, x, y, z, sx, sy, sz, yaw = 0) {
        if (im.count >= im.instanceMatrix.count) return;
        propDummy.position.set(x, y, z);
        propDummy.rotation.set(0, yaw, 0);
        propDummy.scale.set(sx, sy, sz);
        propDummy.updateMatrix();
        im.setMatrixAt(im.count, propDummy.matrix);
        linkPropInstance(prop, im, im.count++);
      }
      function linkPropInstance(prop, im, index) {
        (prop.instances || (prop.instances = [])).push({ im, index });
      }
      // How each kind goes over: tip angle, how far it skids, how long the fall takes,
      // how high it bounces; `pivot` raises the hinge (a trunk breaks above a stump),
      // `stump` leaves one behind, `yaw` slews it round as it goes.
      const PROP_FALLS = {
        lamp: { tip: 1.5, slide: 0.02, time: 0.85, lift: 0.6 },
        lantern: { tip: 1.5, slide: 0.02, time: 0.85, lift: 0.6 },
        signal: { tip: 1.5, slide: 0.02, time: 0.9, lift: 0.6 },
        hydrant: { tip: 1.45, slide: 0.08, time: 0.4, lift: 1.4 },
        trash: { tip: 1.57, slide: 0.3, time: 0.8, lift: 2.4 },
        cone: { tip: 1.57, slide: 0.35, time: 0.9, lift: 1.5 },
        news: { tip: 1.57, slide: 0.18, time: 0.6, lift: 1.5 },
        mailbox: { tip: 1.3, slide: 0.12, time: 0.55, lift: 1.8 },
        meter: { tip: 1.25, slide: 0, time: 0.4, lift: 0.3 },
        bollard: { tip: 1.1, slide: 0, time: 0.35, lift: 0.3 },
        bench: { tip: 1.5, slide: 0.15, time: 0.6, lift: 2 },
        // Bike share (cycles3d.js): bikes clatter onto their sides and skid, the
        // rack folds over at its feet, the totem topples like a lamp.
        sharebike: { tip: 1.45, slide: 0.35, time: 0.55, lift: 1.4, yaw: 0.5 },
        bikerack: { tip: 1.2, slide: 0.04, time: 0.5, lift: 0.3 },
        biketotem: { tip: 1.5, slide: 0.05, time: 0.8, lift: 0.5 },
        seat: { tip: 1.5, slide: 0.18, time: 0.6, lift: 2 },
        railing: { tip: 1.35, slide: 0.22, time: 0.45, lift: 0.6 },
        umbrella: { tip: 1.57, slide: 0.45, time: 0.7, lift: 2 },
        lounger: { tip: 0.45, slide: 0.55, time: 0.6, lift: 1.5, yaw: 1.2 },
        planter: { tip: 1.35, slide: 0.1, time: 1, lift: 0.4 },
        dumpster: { tip: 0.12, slide: 0.25, time: 1, lift: 0, yaw: 0.7 },
        crate: { tip: 0, slide: 0, time: 0.1, lift: 0, shatter: true },
        // A trunk goes over slowly, gathering speed, and lands with a thump.
        tree: { tip: 1.5, slide: 0, time: 2.1, lift: 0, pivot: 2.5, stump: true },
        palm: { tip: 1.52, slide: 0, time: 1.7, lift: 0, pivot: 1.8, stump: true },
      };
      const propVisuals = new Map(),
        propAxis = new Three.Vector3(),
        propMatrix = new Three.Matrix4(),
        propRotation = new Three.Matrix4(),
        propYaw = new Three.Matrix4(),
        propToPivot = new Three.Matrix4(),
        propFromPivot = new Three.Matrix4(),
        propScratch = new Three.Matrix4(),
        propZero = new Three.Matrix4().makeScale(0, 0, 0);
      // Stumps left by felled trees and palms: one pooled instanced mesh, every
      // slot scaled to nothing until a trunk breaks above it.
      const STUMP_SLOTS = 48,
        stumpMesh = new Three.InstancedMesh(new Three.CylinderGeometry(0.85, 1.15, 1, 9), mat('#5a4636', 0.9), STUMP_SLOTS),
        stumpOwners = new Array(STUMP_SLOTS).fill(null);
      let stumpNext = 0;
      stumpMesh.name = 'tree stumps';
      stumpMesh.castShadow = true;
      stumpMesh.receiveShadow = true;
      stumpMesh.frustumCulled = false;
      stumpMesh.userData.dynamic = true;
      for (let i = 0; i < STUMP_SLOTS; i++) stumpMesh.setMatrixAt(i, propZero);
      scene.add(stumpMesh);
      function placeStump(prop, visual) {
        const slot = stumpNext++ % STUMP_SLOTS,
          previous = stumpOwners[slot];
        if (previous && propVisuals.get(previous)) propVisuals.get(previous).stump = -1;
        stumpOwners[slot] = prop;
        const radius = prop.hx * 0.95,
          height = visual.fall.pivot + 0.6;
        propDummy.position.set(prop.x, visual.ground + height / 2, prop.y);
        propDummy.rotation.set(0, Math.random() * TAU, 0);
        propDummy.scale.set(radius, height, radius);
        propDummy.updateMatrix();
        stumpMesh.setMatrixAt(slot, propDummy.matrix);
        stumpMesh.instanceMatrix.needsUpdate = true;
        return slot;
      }
      function clearStump(prop, visual) {
        if (visual.stump < 0 || stumpOwners[visual.stump] !== prop) return;
        stumpOwners[visual.stump] = null;
        stumpMesh.setMatrixAt(visual.stump, propZero);
        stumpMesh.instanceMatrix.needsUpdate = true;
      }
      function startPropFall(prop) {
        const fall = PROP_FALLS[prop.kind] || PROP_FALLS.trash,
          instances = prop.instances || [],
          originals = [];
        for (let i = 0; i < instances.length; i++) {
          const m0 = new Three.Matrix4();
          instances[i].im.getMatrixAt(instances[i].index, m0);
          originals.push(m0);
        }
        const visual = {
          fall,
          originals,
          groupPose: prop.group ? { position: prop.group.position.clone(), quaternion: prop.group.quaternion.clone() } : null,
          ground: terrainHeight(prop.x, prop.y),
          slide: Math.min(80, (prop.fallSpeed || 60) * fall.slide),
          puddles: 0,
          done: false,
          landed: false,
          stump: -1,
        };
        if (prop.halo) prop.halo.visible = false;
        if (prop.glow) prop.glow.visible = false;
        // A lamp's pool goes out with it (lighting3d.js).
        lampLightSwitch(prop, false);
        if (fall.stump) visual.stump = placeStump(prop, visual);
        if (fall.shatter) {
          // A crate bursts into boards.
          spawnChunks(prop.x, visual.ground + 3, prop.y, Math.cos(prop.fallA), Math.sin(prop.fallA), 10, '#8a6a45', 0.5, false);
          addDecal(DECAL.litter, prop.x, visual.ground + 0.12, prop.y, 0, 1, 0, 14, 14, Math.random() * TAU, 0.8);
        }
        if (prop.kind === 'trash') addDecal(DECAL.litter, prop.x, visual.ground + 0.12, prop.y, 0, 1, 0, 20, 20, Math.random() * TAU, 0.9);
        return visual;
      }
      function posePropFall(prop, visual) {
        const fall = visual.fall,
          t = clamp((gameTime - prop.knockedAt) / fall.time, 0, 1),
          tip = fall.tip * t * t,
          slide = visual.slide * (1 - (1 - t) * (1 - t)),
          dx = Math.cos(prop.fallA),
          dz = Math.sin(prop.fallA),
          pivot = fall.pivot || 0,
          lift = fall.lift * Math.sin((tip / Math.max(0.01, fall.tip)) * Math.PI * 0.5);
        // Tip about the base (or the break above the stump) toward the fall
        // direction: axis = up x direction.
        propAxis.set(dz, 0, -dx);
        propRotation.makeRotationAxis(propAxis, tip);
        if (fall.yaw) propRotation.multiply(propYaw.makeRotationY(fall.yaw * t * (prop.id.length % 2 ? 1 : -1)));
        propToPivot.makeTranslation(-prop.x, -visual.ground - pivot, -prop.y);
        propFromPivot.makeTranslation(prop.x + dx * slide, visual.ground + pivot + lift, prop.y + dz * slide);
        propMatrix.multiplyMatrices(propFromPivot, propRotation).multiply(propToPivot);
        const instances = prop.instances;
        if (instances)
          for (let i = 0; i < instances.length; i++) {
            if (fall.shatter) propScratch.copy(propZero);
            else propScratch.multiplyMatrices(propMatrix, visual.originals[i]);
            instances[i].im.setMatrixAt(instances[i].index, propScratch);
            instances[i].im.instanceMatrix.needsUpdate = true;
          }
        if (prop.group && visual.groupPose) {
          prop.group.quaternion.setFromAxisAngle(propAxis, tip);
          prop.group.position.set(visual.groupPose.position.x + dx * slide, visual.groupPose.position.y + lift, visual.groupPose.position.z + dz * slide);
        }
        visual.done = t >= 1;
        // A tree hitting the ground: a burst of leaves and dust along the crown.
        if (visual.done && !visual.landed && fall.stump) {
          visual.landed = true;
          const reach = (prop.size || 12) * 1.9;
          for (let k = 0; k < 3; k++) {
            const along = reach * (0.55 + k * 0.3);
            impactEffect(prop.x + dx * along, prop.y + dz * along, 'dust', visual.ground);
          }
          spawnChunks(prop.x + dx * reach, visual.ground + 4, prop.y + dz * reach, dx, dz, 12, '#4e654a', 0.35, false);
          addDecal(DECAL.litter, prop.x + dx * reach, visual.ground + 0.12, prop.y + dz * reach, 0, 1, 0, reach * 0.9, reach * 0.7, prop.fallA, 0.7);
        }
      }
      function restoreProp(prop, visual) {
        const instances = prop.instances;
        if (instances)
          for (let i = 0; i < instances.length; i++) {
            instances[i].im.setMatrixAt(instances[i].index, visual.originals[i]);
            instances[i].im.instanceMatrix.needsUpdate = true;
          }
        if (prop.group && visual.groupPose) {
          prop.group.position.copy(visual.groupPose.position);
          prop.group.quaternion.copy(visual.groupPose.quaternion);
        }
        if (prop.halo) prop.halo.visible = true;
        if (prop.glow) prop.glow.visible = true;
        lampLightSwitch(prop, true);
        clearStump(prop, visual);
      }
      /* The debris of a piece going down, by what it is made of (called by
         damage.js knockStreetProp): splinters, sparks, glitter, chips, scraps. */
      const PROP_DEBRIS_COLOURS = {
        trash: '#3d5a45',
        cone: '#e2702c',
        news: '#b8312a',
        mailbox: '#2e4d7a',
        lounger: '#f1efe8',
        umbrella: '#e0c24a',
        sharebike: '#12948f',
      };
      function propDebris(prop, x, z, material, altitude, closing) {
        const dx = Math.cos(prop.fallA || 0),
          dz = Math.sin(prop.fallA || 0),
          speed = clamp(closing / 180, 0.35, 1.3),
          ground = terrainHeight(prop.x, prop.y),
          big = prop.massKg > 500;
        if (material === 'wood') {
          spawnChunks(x, ground + 3, z, dx, dz, big ? 16 : 8, '#8a6a45', speed, false);
          if (big) spawnChunks(x, ground + 6, z, dx, dz, 8, '#4e654a', speed * 0.6, false);
          impactEffect(x, z, 'dust', ground);
        } else if (material === 'stone') {
          spawnChunks(x, ground + 2, z, dx, dz, 14, '#8c8779', speed * 0.8, true);
          spawnRubble(prop.x, prop.y, dx, dz, 10, '#8c8779', 8);
          impactEffect(x, z, 'dust', ground);
        } else if (material === 'glass') {
          impactEffect(x, z, 'glass', ground + 12);
          impactEffect(x, z, 'metal', ground);
          spawnChunks(x, ground + 3, z, dx, dz, 5, '#42484a', speed, false);
        } else if (material === 'plastic' || material === 'fabric') {
          spawnChunks(x, ground + 2, z, dx, dz, 6, PROP_DEBRIS_COLOURS[prop.kind] || '#c9c4b8', speed * 0.8, false);
        } else {
          impactEffect(x, z, 'metal', altitude);
          if (prop.kind === 'lamp' || prop.kind === 'signal') impactEffect(x, z, 'glass', ground + 25);
          spawnChunks(x, ground + 2, z, dx, dz, big ? 8 : 4, '#5d6264', speed, false);
        }
      }
      // A sheared hydrant: a column of spray, mist, and a spreading puddle.
      function sprayHydrant(prop, visual, deltaSeconds) {
        const age = gameTime - prop.knockedAt;
        if (visual.puddles < 3 && age > [0, 6, 16][visual.puddles]) {
          const size = [18, 30, 42][visual.puddles++];
          addDecal(DECAL.puddle, prop.x + Math.cos(prop.fallA) * size * 0.2, visual.ground + 0.1, prop.y + Math.sin(prop.fallA) * size * 0.2, 0, 1, 0, size, size * 0.8, Math.random() * TAU, 0.9);
        }
        if (gameTime > prop.sprayUntil || distanceBetween(prop, cameraTarget) > 900) return;
        const pressure = clamp((prop.sprayUntil - gameTime) / 10, 0.3, 1),
          count = Math.floor(deltaSeconds * 70 + Math.random());
        for (let j = 0; j < count; j++)
          fx.push({
            x: prop.x + (Math.random() - 0.5) * 2,
            y: visual.ground + 2,
            z: prop.y + (Math.random() - 0.5) * 2,
            vx: (Math.random() - 0.5) * 22,
            vy: (90 + Math.random() * 45) * pressure,
            vz: (Math.random() - 0.5) * 22,
            life: 1.1,
            max: 1.1,
            color: Math.random() < 0.5 ? '#e2f1f8' : '#bcd9e6',
            size: 2 + Math.random() * 2.5,
            case: true,
          });
        if (Math.random() < deltaSeconds * 8)
          fx.push({
            x: prop.x,
            y: visual.ground + 25 * pressure,
            z: prop.y,
            vx: 6,
            vy: 4,
            vz: 2,
            life: 1.6,
            max: 1.6,
            color: '#e8f2f6',
            size: 12,
            smoke: true,
          });
      }
      function updatePropVisuals(deltaSeconds) {
        for (const prop of knockedProps) {
          let visual = propVisuals.get(prop);
          if (!visual) propVisuals.set(prop, (visual = startPropFall(prop)));
          if (!visual.done) posePropFall(prop, visual);
          if (prop.kind === 'hydrant') sprayHydrant(prop, visual, deltaSeconds);
        }
        if (propVisuals.size > knockedProps.length)
          for (const [prop, visual] of propVisuals)
            if (!prop.down) {
              restoreProp(prop, visual);
              propVisuals.delete(prop);
            }
      }

      // ---- Frame -------------------------------------------------------------------------
      // After the vehicle loop: debris, furniture, marks on vehicles, spare flames.
      function updateDamageVisuals(deltaSeconds) {
        claimDamageResources();
        if (deltaSeconds > 0) {
          stepDebris(chunks, deltaSeconds, 75);
          stepDebris(panels, deltaSeconds, 150);
        }
        // Resting rubble costs nothing: matrices are rewritten only when something moved.
        if (debrisDirty) {
          drawDebris(chunkMesh, chunks, 75, false);
          drawDebris(panelMesh, panels, 150, true);
          debrisDirty = false;
        }
        updatePropVisuals(deltaSeconds);
        drawVehicleMarks();
        flushDecals(worldDecals);
        flushDecals(vehicleDecals);
        if (carFlames) for (let i = carFlameIndex; i < carFlames.length; i++) carFlames[i].visible = false;
        carFlameIndex = 0;
        if (!carFireLightUsed) carFireLight.intensity = 0;
        carFireLightUsed = false;
      }
      // How much of the player's headlight beam is left.
      function headlightShare(vehicle) {
        const lights = vehicle?.damage?.lights;
        return lights ? ((lights.headLeft ? 0 : 0.5) + (lights.headRight ? 0 : 0.5)) : 1;
      }
      const damageApi = {
        bulletHole,
        structureBlast,
        structureImpact,
        shellImpact,
        propDebris,
        groundStain,
        sparks,
        damageInfo: () => ({
          worldDecals: worldDecals.used,
          worldDecalCapacity: worldDecals.capacity,
          vehicleDecals: vehicleDecals.mesh.count,
          chunks: chunks.length,
          panels: panels.length,
          knockedProps: knockedProps.length,
          windowsBroken,
          shellBreaches,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        }),
      };
