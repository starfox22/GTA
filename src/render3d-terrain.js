      // Mesh/box/rod helpers, wall textures, the ground mesh and kerbs.
      function mesh(geo, material, parent, x, y, z, sx = 1, sy = 1, sz = 1) {
        const m = new Three.Mesh(geo, material);
        m.position.set(x, y, z);
        m.scale.set(sx, sy, sz);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      function box(parent, x, y, z, width, height, depth, material) {
        return mesh(boxGeo, material, parent, x, y, z, width, height, depth);
      }
      function rod(parent, a, b, r, material) {
        const dir = new Three.Vector3().subVectors(b, a),
          m = mesh(
            cylinderGeo,
            material,
            parent,
            (a.x + b.x) / 2,
            (a.y + b.y) / 2,
            (a.z + b.z) / 2,
            r,
            dir.length(),
            r,
          );
        m.quaternion.setFromUnitVectors(new Three.Vector3(0, 1, 0), dir.normalize());
        return m;
      }
      function texture(im, quadrant, repeatX = 1, repeatY = 1) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = 512;
        const drawingContext2 = tile.getContext('2d');
        drawingContext2.drawImage(
          im,
          ((quadrant % 2) * im.width) / 2,
          (Math.floor(quadrant / 2) * im.height) / 2,
          im.width / 2,
          im.height / 2,
          0,
          0,
          512,
          512,
        );
        const tx = new Three.CanvasTexture(tile);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.repeat.set(repeatX, repeatY);
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      const wallTextures = [0, 1, 2, 3].map((i) => texture(visualAssets.architecture, i));
      // Subtle environment reflections across paintwork, chrome and glass.
      const faces = [];
      for (let i = 0; i < 6; i++) {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const drawingContext2 = c.getContext('2d'),
          gr = drawingContext2.createLinearGradient(0, 0, 0, 128);
        gr.addColorStop(0, '#718bad');
        gr.addColorStop(0.43, '#b3b0a0');
        gr.addColorStop(0.5, '#d9bc95');
        gr.addColorStop(0.56, '#4f555e');
        gr.addColorStop(1, '#181e28');
        drawingContext2.fillStyle = gr;
        drawingContext2.fillRect(0, 0, 128, 128);
        faces.push(c);
      }
      const env = new Three.CubeTexture(faces);
      env.needsUpdate = true;
      env.colorSpace = Three.SRGBColorSpace;
      scene.environment = env;
      // Real ground materials and painted markings are baked once, then receive live shadows.
      // The baked ground now has to cover the northern reclamation as well, so the
      // canvas is taller than it is wide and its pixels-per-unit is chosen to keep
      // the texture's memory close to the old 4096-square sheet's.
      const terrainPixelsPerUnit = (touchEnabled() ? 2560 : 3584) / CITY_SIZE;
      const terrain = document.createElement('canvas');
      terrain.width = Math.round(CITY_WIDTH * terrainPixelsPerUnit);
      terrain.height = Math.ceil(CITY_HEIGHT * terrainPixelsPerUnit);
      const drawingContext = terrain.getContext('2d');
      drawingContext.scale(terrainPixelsPerUnit, terrainPixelsPerUnit);
      drawingContext.translate(-CITY_LEFT, -CITY_TOP);
      // Flat fills: the sheet says what lies where and the ground shader draws the
      // surface (ground-shader3d.js). These used to be the ground atlas's photos
      // squeezed into 72-120 texel tiles, so up close the pavements showed
      // 4.7 m slabs and the tarmac a blurred, blotchy print. The photos now
      // serve as detail layers at their true scale (ground-data3d.js). The
      // pavement fill is close to the kerbside strip's colour so a pavement
      // reads as one surface, kerb to building line.
      const paving = '#8f9086',
        grass = '#3c4726',
        tarmac = '#484949';
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      drawingContext.fillStyle = '#263e4d';
      drawingContext.fillRect(CITY_LEFT, CITY_TOP, CITY_WIDTH, CITY_HEIGHT);
      drawingContext.fillStyle = paving;
      drawingContext.fillRect(CITY_LEFT + 48, CITY_TOP + 45, CITY_WIDTH - 112, CITY_HEIGHT - 112);
      paintCityStreets(drawingContext, false);
      const curbGroup = new Three.Group();
      curbGroup.name = 'kerbs';
      scene.add(curbGroup);
      batchGroups.push(curbGroup);
      for (let bx = BLOCK_X_MIN; bx <= BLOCK_X_MAX; bx++)
        for (let by = BLOCK_Y_MIN; by <= BLOCK_Y_MAX; by++) {
          const x = blockX(bx) + 79,
            z = blockY(by) + 79;
          if (
            !validCityBlock(x + 10, z + 10) ||
            harborOverlap(x, z, 354, 354) ||
            stadiumOverlap(x, z, 354, 354)
          )
            continue;
          if (bx === -4 && by === 4) {
            drawingContext.fillStyle = paving;
            drawingContext.fillRect(ROOFTOP.x - 14, ROOFTOP.y - 14, ROOFTOP.w + 28, ROOFTOP.h + 44);
            continue;
          }
          if (isPark(bx, by)) continue;
          // Curbs catch the low evening sun. Park blocks are kerbed by the park painter instead.
          if (!onBoulevard(x + 177, z - 2, 190)) box(curbGroup, x + 177, 1.4, z - 2, 354, 2.8, 3, concrete);
          if (!onBoulevard(x - 2, z + 177, 190)) box(curbGroup, x - 2, 1.4, z + 177, 3, 2.8, 354, concrete);
          if (!onBoulevard(x + 355, z + 177, 190))
            box(curbGroup, x + 355, 1.4, z + 177, 3, 2.8, 354, concrete);
          if (!onBoulevard(x + 177, z + 355, 190))
            box(curbGroup, x + 177, 1.4, z + 355, 354, 2.8, 3, concrete);
          const park = isPark(bx, by);
          if (park) {
            continue;
          } else {
            // The block's car park (its bay lines are marks, ground-data3d.js cityLotRecords).
            drawingContext.fillStyle = tarmac;
            drawingContext.fillRect(x + 18, z + 170, 318, 165);
            // Zone-specific ground: mirrors the block patterns chosen in buildWorld().
            const zone = districtAt(x + 177, z + 177),
              blockSeed = (bx * 31 + by * 17) % 7;
            if (zone.includes('FINANCIAL') && skylineBlockTowers(bx, by).length) {
              // Cluster plaza (src/skyline.js), the same inset as the game's ground canvas.
              paintSkylinePlaza(drawingContext, x + 14, z + 14, 326, 326);
            } else if (zone.includes('FINANCIAL') && blockSeed % 2 === 0) {
              // A granite forecourt (the ground shader lays its slabs).
              drawingContext.fillStyle = '#c3bfb2';
              drawingContext.fillRect(x + 10, z + 10, 344, 160);
              // Planted beds under the plaza's two tree lines (buildWorld puts the
              // trees there). Two teal discs used to be painted here, pools with
              // nothing in them.
              drawingContext.fillStyle = '#5f7a52';
              drawingContext.fillRect(x + 18, z + 22, 36, 146);
              drawingContext.fillRect(x + 300, z + 22, 36, 146);
            } else if (zone.includes('OLD QUARTER') || zone === 'BATTERY POINT') {
              drawingContext.fillStyle = '#3a3d3c';
              for (const ax of [115, 226]) drawingContext.fillRect(x + ax, z + 14, 13, 150);
            }
            if (zone === 'SOUTH BANK' && blockSeed % 3 === 0) {
              drawingContext.fillStyle = grass;
              drawingContext.fillRect(x + 50, z + 260, 254, 70);
              drawingContext.fillStyle = paving;
              drawingContext.fillRect(x + 170, z + 250, 14, 90);
            }
            // Kerb line: a pale edge that separates sidewalk from roadway.
            drawingContext.strokeStyle = '#d2cfc366';
            drawingContext.lineWidth = 2.5;
            drawingContext.strokeRect(x - 1, z - 1, 356, 356);
          }
        }
      // The road markings (lane dashes, crossings, stop lines, the avenues'
      // double yellow), manhole covers and gully grates are not painted into this
      // sheet: the ground shader draws them from data, crisp at any zoom
      // (ground-data3d.js MARKS). (330 dark ellipses, 25-95 units long at random
      // angles, also used to be stamped on the roads here as "patches"; from the
      // street camera they read as long shadows with nothing casting them. The
      // ground shader's utility patches and sealed cracks break the tarmac up.)
      // A broad river separates the old city from the garden borough.
      paintPromenades(drawingContext);
      drawingContext.fillStyle = tarmac;
      drawingContext.fillRect(1250, 3971, 300, 158);
      for (let x = 1254; x < 1540; x += 53) {
        drawingContext.fillStyle = '#cbd3c077';
        drawingContext.fillRect(x, 3975, 1.5, 45);
      }
      for (const pad of HELIPADS) {
        drawingContext.fillStyle = tarmac;
        drawingContext.fillRect(pad.x - 50, pad.y - 50, 100, 100);
      }
      drawingContext.restore();
      paintDistrictGround(drawingContext, true, true);
      // No park names painted across the lawns: the map and the HUD name them.
      paintParks(drawingContext, false);
      for (const r of SERVICE_ROADS.filter((r) => r.name.startsWith('SOUTHPORT ')))
        strokeRoad(drawingContext, r.points, r.width, '#606664');
      paintServiceForecourts(drawingContext, true);
      paintCasinoGround(drawingContext);
      paintHarborGround(drawingContext);
      paintMarina(drawingContext);
      paintDepotGround(drawingContext);
      paintSportsGround(drawingContext);
      const groundTx = new Three.CanvasTexture(terrain);
      groundTx.colorSpace = Three.SRGBColorSpace;
      groundTx.anisotropy = 8;
      // Roughness and metalness come from the ground materials (ground-shader3d.js);
      // the coarse roughness sheet that used to mark the roads is gone.
      const groundMesh = new Three.Mesh(
        new Three.PlaneGeometry(CITY_WIDTH, CITY_HEIGHT),
        new Three.MeshStandardMaterial({
          map: groundTx,
          roughness: 1,
          metalness: 0,
          transparent: false,
          alphaTest: 0.5,
        }),
      );
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.set((CITY_LEFT + CITY_RIGHT) / 2, 0.02, (CITY_TOP + CITY_SIZE) / 2);
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);
      // Buildings are constructed by src/cityscape3d.js (included below, after the halo helper).
      /**
       * BREAKABLE SCENERY
       * Trees, palms and the esplanade's furniture can be knocked down by a vehicle
       * (damage.js BREAKABLE FURNITURE AND TREES), so they cannot be merged into the
       * static batches: a merged tree could never fall. Each piece is modelled as
       * before, in a throwaway group, and `breakableGroup(prop, group)` files every
       * mesh of it as one instance of an InstancedMesh per (2048-unit map cell,
       * geometry, material). `flushBreakables()` (just before the static batching)
       * builds those meshes under cell groups kept with the static batch cells, so
       * they are culled with the cell (and by their own bounds) and hidden by the
       * far city like the batches (flight-view3d.js), whose
       * copy still gets every piece (noteFarScenery). The prop's instances are
       * linked so damage3d.js can topple them by rewriting their matrices; nothing
       * is allocated per frame. Geometry must be shared between pieces
       * (boxGeo, cylinderGeo, leafGeo...) or each would be its own draw.
       */
      // Cells twice the batches' size: an instanced piece costs a draw per
      // geometry and material in each cell, so fewer, larger cells keep the
      // count near what the merged batches cost.
      const BREAKABLE_CELL = 2048,
        breakableBuckets = new Map();
      let breakablesFlushed = false;
      function breakableGroup(prop, group, castShadow = true) {
        group.updateMatrixWorld(true);
        const e = group.matrixWorld.elements,
          cx = Math.floor(e[12] / BREAKABLE_CELL),
          cz = Math.floor(e[14] / BREAKABLE_CELL);
        group.traverse((o) => {
          if (!o.isMesh) return;
          const key = cx + '|' + cz + '|' + o.geometry.uuid + '|' + o.material.uuid;
          let bucket = breakableBuckets.get(key);
          if (!bucket) breakableBuckets.set(key, (bucket = { geometry: o.geometry, material: o.material, cx, cz, parts: [], castShadow }));
          bucket.parts.push({ matrix: o.matrixWorld.clone(), prop, source: o });
        });
      }
      // A cell group shown and hidden by the static batch cell loop (render()).
      function breakableCell(cx, cz) {
        const key = 'breakable ' + cx + ',' + cz;
        let cell = staticBatchCells.get(key);
        if (!cell) {
          const group = new Three.Group();
          group.name = 'breakable cell';
          group.userData.cellContainer = true;
          scene.add(group);
          cell = { group, x: (cx + 0.5) * BREAKABLE_CELL, z: (cz + 0.5) * BREAKABLE_CELL, half: BREAKABLE_CELL / 2 };
          staticBatchCells.set(key, cell);
        }
        return cell;
      }
      function flushBreakables() {
        if (breakablesFlushed) return;
        breakablesFlushed = true;
        for (const bucket of breakableBuckets.values()) {
          // Trees (vegetation3d.js) carry per-instance tint, morph and density.
          const foliage = !!bucket.geometry.userData.foliage,
            im = foliage ? foliageInstances(bucket.geometry, bucket.parts.length) : new Three.InstancedMesh(bucket.geometry, bucket.material, bucket.parts.length);
          if (!foliage) im.name = 'breakable scenery';
          im.castShadow = bucket.castShadow;
          im.receiveShadow = true;
          bucket.parts.forEach((part, i) => {
            im.setMatrixAt(i, part.matrix);
            if (foliage) setFoliageInstance(im, i, part.source.userData.foliageTint, part.source.userData.foliageMorph, part.source.userData.foliageDensity);
            if (part.prop) linkPropInstance(part.prop, im, i);
            // The far city keeps an intact copy of every piece.
            noteFarScenery(part.source);
          });
          im.instanceMatrix.needsUpdate = true;
          // Culled by its own bounds, padded for a tree lying across the street.
          im.computeBoundingSphere();
          im.boundingSphere.radius += 90;
          breakableCell(bucket.cx, bucket.cz).group.add(im);
          farHidden.push(im);
          if (foliage) noteFoliageLod(im);
        }
        breakableBuckets.clear();
      }
