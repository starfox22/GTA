      // Vegetation 3D landscaping: dune grass and sea grape on the Palm Keys beach, flowering shrubs in the Keys' parks, meadow grass on the mountain roads' verges (instanced, nothing to knock over).
      /**
       * LANDSCAPING
       * Plants that are scenery only, like the Ridgeline forest: no collision,
       * nothing to fell, instanced per species and 2048-unit cell with the near
       * model at street zoom and the mid model beyond (grass only near). Where:
       *   Palm Keys beach   dune grass in drifts along the top of the sand below
       *                     the boardwalk, and sea grape clumps behind it, only
       *                     on sand the beach plan leaves free (kiosks, showers,
       *                     racks, the court and the pier's lanes are reserved)
       *   Keys parks        hibiscus and bougainvillea mounds in the corners
       *   mountain roads    tufts of meadow grass in patches on the verges of
       *                     the graded roads (not on junctions, trails, rock or
       *                     snow)
       * Every plant is counted in the vegetation survey (DeadEndCity.vegetation).
       */
      function plantLandscape(entries) {
        const cells = new Map();
        for (const e of entries) {
          const key = Math.floor(e.x / 2048) * 4096 + Math.floor(e.y / 2048);
          if (!cells.has(key)) cells.set(key, new Map());
          const bySpecies = cells.get(key);
          if (!bySpecies.has(e.key)) bySpecies.set(e.key, []);
          bySpecies.get(e.key).push(e);
        }
        const m = new Three.Matrix4(),
          q = new Three.Quaternion(),
          s = new Three.Vector3(),
          p = new Three.Vector3(),
          up = new Three.Vector3(0, 1, 0);
        let meshes = 0;
        for (const bySpecies of cells.values())
          for (const [key, list] of bySpecies) {
            const S = TREE_SPECIES[key];
            for (const lod of S.form === 'grass' ? [0] : [0, 1]) {
              const im = foliageInstances(speciesGeometry(key, lod), list.length);
              list.forEach((e, j) => {
                const v = treeVariation(S, e.x, e.y),
                  size = e.size * v.scale;
                q.setFromAxisAngle(up, v.yaw);
                s.set(size * v.aspect, size / Math.sqrt(v.aspect), size * v.aspect);
                p.set(e.x, terrainHeight(e.x, e.y) - 0.3, e.y);
                m.compose(p, q, s);
                im.setMatrixAt(j, m);
                setFoliageInstance(im, j, v.tint, v.morph, lod ? 0 : v.density);
                if (!lod) tallyVegetation(e.x, e.y, key);
              });
              im.name = 'landscape ' + key + (lod ? ' mid' : '');
              if (S.form === 'grass') im.castShadow = false;
              im.computeBoundingSphere();
              scene.add(im);
              noteFoliageLod(im);
              meshes++;
            }
          }
        return meshes;
      }
      const landscapeCounts = {};
      {
        const plants = [],
          add = (x, y, key, size, where) => {
            plants.push({ x, y, key, size });
            landscapeCounts[where] = (landscapeCounts[where] || 0) + 1;
          };
        // Palm Keys beach: dunes along the top of the sand.
        {
          buildBeachLayout();
          const walkBottom = BEACH.boardwalk.y + BEACH.boardwalk.width / 2;
          for (let x = BEACH.boardwalk.x0 + 16; x < BEACH.boardwalk.x1 - 8; x += 7) {
            // Drifts come and go along the strand.
            if (vegHash(Math.round(x / 70), 3, 91) < 0.3) continue;
            for (let row = 0; row < 4; row++) {
              const jx = x + (vegHash(x, row, 92) - 0.5) * 7,
                jy = walkBottom + 10 + row * 9 + (vegHash(x, row, 93) - 0.5) * 7;
              if (vegHash(jx, jy, 94) < 0.25 + row * 0.15) continue;
              if (!beachSpotFree(jx, jy, 5) || onBeachPier(jx, jy, -30)) continue;
              add(jx, jy, 'duneGrass', 0.8 + vegHash(jx, jy, 95) * 0.6, 'Palm Keys dunes');
            }
          }
          for (let x = BEACH.boardwalk.x0 + 60; x < BEACH.boardwalk.x1 - 40; x += 95) {
            const n = 1 + Math.floor(vegHash(x, 1, 96) * 3);
            for (let i = 0; i < n; i++) {
              const jx = x + (i - (n - 1) / 2) * 20 + (vegHash(x, i, 97) - 0.5) * 10,
                jy = walkBottom + 26 + vegHash(x, i, 98) * 14;
              if (!beachSpotFree(jx, jy, 16) || onBeachPier(jx, jy, -40)) continue;
              add(jx, jy, 'seagrape', 0.75 + vegHash(jx, jy, 99) * 0.4, 'Palm Keys dunes');
            }
          }
        }
        // The Keys' parks: flowering mounds in the corners, clear of the park's trees.
        for (const park of CITY_PARKS) {
          if (!onPalmKeys(park.x)) continue;
          for (const [cx, cy] of [
            [park.x + 26, park.y + 26],
            [park.x + park.w - 26, park.y + 26],
            [park.x + 26, park.y + park.h - 26],
            [park.x + park.w - 26, park.y + park.h - 26],
          ])
            for (let i = 0; i < 4; i++) {
              const x = cx + (vegHash(cx, i, 81) - 0.5) * 30,
                y = cy + (vegHash(cy, i, 82) - 0.5) * 30;
              if (!landAt(x, y) || solid(x, y, 9) || cityStreetAt(x, y, 6) || trees.some((t) => Math.abs(t.x - x) < 16 && Math.abs(t.y - y) < 16)) continue;
              add(x, y, i % 2 ? 'bougainvillea' : 'hibiscus', 0.85 + vegHash(x, y, 83) * 0.35, 'Palm Keys parks');
            }
        }
        // The mountain roads' verges: meadow grass in patches.
        terrainField(TERRAIN_FIELDS[0]);
        scenicJunctions();
        for (const road of SCENIC_ROADS) {
          if (!scenicRoadGraded(road, TERRAIN_FIELDS[0])) continue;
          const skip = scenicRoadSkip(road),
            point = {};
          for (let k = 2; k < road.n - 2; k += 2)
            for (const side of [1, -1]) {
              if (skip[k] || road.junction[k] > 0.02) continue;
              const x0 = road.dense[k * 2],
                y0 = road.dense[k * 2 + 1];
              if (terrainNoise(x0 / 90, y0 / 90, 61 + side) < 0.05) continue;
              const out = road.half + scenicBayWidth(road, k, side) + SCENIC_SHOULDER + 5 + vegHash(k, side, 62) * 30;
              scenicPointAt(road, k + (vegHash(k, side, 63) - 0.5) * 2, side * out, point);
              const h = terrainHeight(point.x, point.y),
                slope = terrainSlope(point.x, point.y);
              if (h < 2 || h > TERRAIN_SNOWLINE - 120 || Math.hypot(slope.x, slope.y) > 0.5 || onMountainTrail(point.x, point.y) || solid(point.x, point.y, 4)) continue;
              add(point.x, point.y, 'meadowGrass', 0.8 + vegHash(point.x, point.y, 64) * 0.7, 'mountain road verges');
            }
        }
        landscapeCounts.meshes = plantLandscape(plants);
      }
