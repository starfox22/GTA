      // The far copy of the city (FAR SCENERY): built once, drawn whole from the air and cell by cell in the chase view.
      /**
       * FAR SCENERY
       * The static batches keep one material per building (for each building's own
       * window lighting), so the whole city is ~8000 draw
       * calls, and every building's main block is a six-material box on top. Seen
       * from the street only a few hundred are in view; from high up, all of them.
       * So a second, coarse copy of the city is built once: every piece of batched
       * scenery at least FAR_PIECE_SIZE across seen from above (so parapets, roofs and
       * tree crowns, not posts and trunks), plus the building blocks, merged
       * into a handful of shared materials per 3 km cell. A material's colour goes
       * into vertex colours and its texture repeat into the UVs, so ~7000 materials
       * collapse to the ~20 real combinations of texture and finish, and window
       * lighting follows the average of the buildings it stands for. Below
       * FAR_SCENERY_ZOOM (roughly 500 m up) the flight camera shows this copy instead.
       *
       * The chase view uses it cell by cell (chase-view3d.js CHASE FAR CELLS): inside
       * each 3 km mesh the pieces that stand for the static batches and the building
       * blocks are ordered by 1024-unit cell (the static batch cells, in a serpentine
       * so neighbours follow each other), each cell's run is a draw group, and the
       * pieces of breakable scenery and the far trees (whose full models the chase view
       * keeps) follow at the end. The air draws the whole mesh as before; the chase
       * view swaps in a material array whose groups draw the runs of its far cells
       * (consecutive cells as one call) and skip the rest.
       */
      const SHADOW_PROXY_ZOOM = 0.55,
        SHADOW_PROXY_LAYER = 6,
        FAR_SCENERY_ZOOM = 0.2,
        STREET_FAR_SCENERY_ZOOM = 0.2,
        FAR_PIECE_SIZE = 20,
        farBox = new Three.Box3(),
        FAR_CELL = 3072,
        FAR_CHASE_CELL = 1024,
        farPieces = [],
        farScenery = new Three.Group(),
        farHidden = [],
        // A group drawn with this material is skipped (the chase view's cells that are not far).
        farSkipMaterial = new Three.MeshBasicMaterial({ visible: false });
      let farClasses = [],
        farSceneryShown = false,
        shadowProxyShown = false,
        // The chase view draws far cells from the copy (chase-view3d.js CHASE FAR CELLS).
        farChaseShown = false,
        // Set while batchStaticGroups() notes pieces: those the chase view may swap for the copy.
        farNoteChase = false;
      // three.js tests an object's layers against the *view* camera in the shadow
      // pass too (WebGLShadowMap.renderObject), so enabling the proxy layer on the
      // sun's shadow camera does nothing: the proxy never reached the shadow map and
      // the city lost every building shadow between ~150 m and ~500 m up. The view
      // camera's render list is already built when the renderer draws the shadow
      // map, so turning the layer on for the view camera just for that pass puts the
      // proxy into the shadow map and nowhere else.
      {
        const renderShadowMap = renderer.shadowMap.render;
        renderer.shadowMap.render = function (lights, shadowScene, viewCamera) {
          const had = viewCamera.layers.isEnabled(SHADOW_PROXY_LAYER);
          viewCamera.layers.enable(SHADOW_PROXY_LAYER);
          // Draw calls of the shadow pass, for DeadEndCity.stats() (postfx3d.js).
          const before = renderer.info.render.calls,
            refresh = this.enabled && this.needsUpdate && lights.length > 0;
          // The chase view leaves out the cells that cannot shade what it sees (chase-view3d.js CHASE SHADOWS).
          if (refresh && viewCamera === chaseCamera) chaseShadowCasters(true);
          try {
            renderShadowMap.call(this, lights, shadowScene, viewCamera);
            if (refresh) frameStats.shadowCalls = renderer.info.render.calls - before;
          } finally {
            if (!had) viewCamera.layers.disable(SHADOW_PROXY_LAYER);
            chaseShadowCasters(false);
          }
        };
      }
      farScenery.visible = false;
      scene.add(farScenery);
      function farMaterialUsable(material) {
        return (
          !!material &&
          material.isMeshStandardMaterial &&
          !material.transparent &&
          // Shared facades (cityscape3d.js) carry their tint as vertex colours.
          (!material.vertexColors || material.userData.cityFacade) &&
          !material.alphaTest &&
          !material.normalMap
        );
      }
      // Called by batchStaticGroups() for every mesh it merges.
      function noteFarScenery(mesh) {
        if (!farMaterialUsable(mesh.material)) return;
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        farBox.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        if (Math.max(farBox.max.x - farBox.min.x, farBox.max.z - farBox.min.z) < FAR_PIECE_SIZE) return;
        farPieces.push({ geometry, matrix: mesh.matrixWorld.clone(), material: mesh.material, start: 0, count: Infinity, chase: farNoteChase });
      }
      function buildFarScenery(staticBatches) {
        // Building blocks: one piece per face group of the multi-material box.
        for (const o of allBuildings)
          o.group.traverse((mesh) => {
            if (!mesh.isMesh || !Array.isArray(mesh.material)) return;
            mesh.updateMatrixWorld(true);
            if (!mesh.geometry.groups.every((g) => farMaterialUsable(mesh.material[g.materialIndex]))) return;
            for (const group of mesh.geometry.groups)
              farPieces.push({
                geometry: mesh.geometry,
                matrix: mesh.matrixWorld,
                material: mesh.material[group.materialIndex],
                start: group.start,
                count: group.count,
                chase: true,
              });
            farHidden.push(mesh);
            // The chase view hides it in its far cells (CHASE FAR CELLS).
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            farBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
            const e = mesh.matrixWorld.elements,
              cell = chaseFarCell(Math.floor(e[12] / FAR_CHASE_CELL), Math.floor(e[14] / FAR_CHASE_CELL));
            cell.blocks.push(mesh);
            cell.top = Math.max(cell.top, farBox.max.y);
          });
        for (const m of staticBatches) {
          if (!farMaterialUsable(m.material)) continue;
          farHidden.push(m);
          const batchCell = staticBatchCells.get(m.userData.cellX * 4096 + m.userData.cellZ),
            cell = chaseFarCell(m.userData.cellX, m.userData.cellZ);
          cell.full = batchCell.full;
          cell.top = Math.max(cell.top, batchCell.top);
        }
        // Group the pieces by look (texture, finish) and by cell.
        // Tree crowns are finely tessellated spheres; a few pixels across, a coarse
        // one looks the same for a quarter of the vertices.
        const coarseCrowns = new Map();
        for (const piece of farPieces) {
          const g = piece.geometry;
          if (g.type !== 'IcosahedronGeometry' || g.parameters.detail < 2 || piece.count !== Infinity) continue;
          const radius = g.parameters.radius;
          if (!coarseCrowns.has(radius)) coarseCrowns.set(radius, new Three.IcosahedronGeometry(radius, 1));
          piece.geometry = coarseCrowns.get(radius);
        }
        const classes = new Map(),
          position = new Three.Vector3(),
          normal = new Three.Vector3(),
          normalMatrix = new Three.Matrix3(),
          uvMatrix = new Three.Matrix3(),
          uvPoint = new Three.Vector3();
        const keyOf = (m) =>
          [
            m.map ? m.map.source.uuid : '',
            m.emissiveMap ? m.emissiveMap.source.uuid : '',
            m.roughnessMap ? m.roughnessMap.source.uuid : '',
            m.metalnessMap ? m.metalnessMap.source.uuid : '',
            m.emissiveMap || m.emissiveIntensity > 0 ? m.emissive.getHexString() : '',
            m.roughness.toFixed(1),
            m.metalness.toFixed(1),
            m.side,
          ].join('|');
        for (const piece of farPieces) {
          const m = piece.material,
            key = keyOf(m),
            e = piece.matrix.elements,
            cell = Math.floor(e[12] / FAR_CELL) + ',' + Math.floor(e[14] / FAR_CELL);
          let c = classes.get(key);
          if (!c) classes.set(key, (c = { sample: m, members: new Set(), cells: new Map() }));
          c.members.add(m);
          let bucket = c.cells.get(cell);
          if (!bucket)
            c.cells.set(
              cell,
              (bucket = {
                // The chase view's nine 1024-unit cells in serpentine order, then the rest (see above).
                slots: [[], [], [], [], [], [], [], [], []],
                tail: [],
                vertices: 0,
                indices: 0,
                cx: Math.floor(e[12] / FAR_CELL),
                cz: Math.floor(e[14] / FAR_CELL),
              }),
            );
          const index = piece.geometry.index,
            total = index ? index.count : piece.geometry.attributes.position.count;
          piece.count = Math.min(piece.count, total - piece.start);
          if (piece.chase) {
            const sx = Math.floor(e[12] / FAR_CHASE_CELL) - bucket.cx * 3,
              sz = Math.floor(e[14] / FAR_CHASE_CELL) - bucket.cz * 3;
            bucket.slots[sz * 3 + (sz % 2 ? 2 - sx : sx)].push(piece);
          } else bucket.tail.push(piece);
          bucket.vertices += piece.geometry.attributes.position.count;
          bucket.indices += piece.count;
        }
        // The chase view draws a class with its own material where that is one look (a shared
        // facade, whose window light then varies building by building as up close, or a class of
        // one material) and its texture repeat is already in the geometry; else with the copy's.
        const plainTransform = (m) =>
          [m.map, m.emissiveMap, m.roughnessMap, m.metalnessMap].every((t) => {
            if (!t) return true;
            t.updateMatrix();
            return t.matrix.equals(uvMatrix.identity());
          });
        const identity = (texture) => {
          if (!texture) return null;
          const t = texture.clone();
          t.repeat.set(1, 1);
          t.offset.set(0, 0);
          t.rotation = 0;
          t.needsUpdate = true;
          return t;
        };
        farClasses = [];
        for (const c of classes.values()) {
          const sample = c.sample,
            material = new Three.MeshStandardMaterial({
              vertexColors: true,
              map: identity(sample.map),
              emissiveMap: identity(sample.emissiveMap),
              roughnessMap: identity(sample.roughnessMap),
              metalnessMap: identity(sample.metalnessMap),
              emissive: sample.emissive.clone(),
              emissiveIntensity: sample.emissiveIntensity,
              roughness: sample.roughness,
              metalness: sample.metalness,
              side: sample.side,
            });
          // (A material with its own shader patch may want attributes the copy does not carry: not that one.)
          const members = [...c.members],
            facade = !!sample.userData.cityFacade && members.every((m) => m.userData.cityFacade),
            plainPatch = sample.onBeforeCompile === Three.MeshStandardMaterial.prototype.onBeforeCompile || sample.onBeforeCompile === cityGlassPatch,
            chaseMaterial = (facade || (members.length === 1 && plainPatch)) && members.every(plainTransform) ? sample : material;
          farClasses.push({ material, members, chaseMaterial });
          for (const bucket of c.cells.values()) {
            // Each piece copies its geometry's vertices and its own index range.
            const n = bucket.vertices,
              positions = new Float32Array(n * 3),
              normals = new Float32Array(n * 3),
              uvs = new Float32Array(n * 2),
              colors = new Uint8Array(n * 3),
              // A shared facade's window light (strength, phase) for the chase view's facade material.
              lit = facade ? new Float32Array(n * 2) : null,
              indices = new Uint32Array(bucket.indices),
              starts = new Int32Array(9),
              counts = new Int32Array(9);
            let o = 0,
              io = 0;
            for (let slot = 0; slot <= 9; slot++) {
              if (slot < 9) starts[slot] = io;
              const list = slot < 9 ? bucket.slots[slot] : bucket.tail;
              for (const piece of list) {
                const geo = piece.geometry,
                  pos = geo.attributes.position,
                  nor = geo.attributes.normal,
                  uv = geo.attributes.uv,
                  idx = geo.index,
                  m = piece.material,
                  uvSource = m.map || m.emissiveMap || m.roughnessMap;
                normalMatrix.getNormalMatrix(piece.matrix);
                if (uvSource) {
                  uvSource.updateMatrix();
                  uvMatrix.copy(uvSource.matrix);
                } else uvMatrix.identity();
                for (let k = 0; k < piece.count; k++)
                  indices[io++] = o + (idx ? idx.getX(piece.start + k) : piece.start + k);
                for (let i = 0; i < pos.count; i++, o++) {
                  position.fromBufferAttribute(pos, i).applyMatrix4(piece.matrix);
                  positions[o * 3] = position.x;
                  positions[o * 3 + 1] = position.y;
                  positions[o * 3 + 2] = position.z;
                  if (nor) normal.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
                  else normal.set(0, 1, 0);
                  normals[o * 3] = normal.x;
                  normals[o * 3 + 1] = normal.y;
                  normals[o * 3 + 2] = normal.z;
                  if (uv) {
                    uvPoint.set(uv.getX(i), uv.getY(i), 1).applyMatrix3(uvMatrix);
                    uvs[o * 2] = uvPoint.x;
                    uvs[o * 2 + 1] = uvPoint.y;
                  }
                  const tint = geo.attributes.color;
                  colors[o * 3] = Math.round(m.color.r * (tint ? tint.getX(i) : 1) * 255);
                  colors[o * 3 + 1] = Math.round(m.color.g * (tint ? tint.getY(i) : 1) * 255);
                  colors[o * 3 + 2] = Math.round(m.color.b * (tint ? tint.getZ(i) : 1) * 255);
                  if (lit) {
                    const source = geo.attributes.cityLit;
                    lit[o * 2] = source ? source.getX(i) : 1;
                    lit[o * 2 + 1] = source ? source.getY(i) : 0;
                  }
                }
              }
              if (slot < 9) counts[slot] = io - starts[slot];
            }
            const geometry = new Three.BufferGeometry();
            geometry.setAttribute('position', new Three.BufferAttribute(positions, 3));
            geometry.setAttribute('normal', new Three.BufferAttribute(normals, 3));
            geometry.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
            geometry.setAttribute('color', new Three.BufferAttribute(colors, 3, true));
            if (lit) geometry.setAttribute('cityLit', new Three.BufferAttribute(lit, 2));
            geometry.setIndex(new Three.BufferAttribute(indices, 1));
            geometry.computeBoundingSphere();
            // The chase view's draw groups, one per cell (skipped until the cell is far).
            for (let slot = 0; slot < 9; slot++) geometry.addGroup(starts[slot], counts[slot], 1);
            // Nothing reads these back on the CPU: let them go once on the GPU.
            for (const attribute of [...Object.values(geometry.attributes), geometry.index])
              attribute.onUpload(function () {
                this.array = null;
              });
            const mesh = new Three.Mesh(geometry, material);
            mesh.castShadow = mesh.receiveShadow = true;
            mesh.name = 'far scenery';
            mesh.userData.farMaterial = material;
            const cells = [];
            for (let slot = 0; slot < 9; slot++) {
              const sz = Math.floor(slot / 3),
                sx = sz % 2 ? 2 - (slot % 3) : slot % 3,
                cell = counts[slot] ? chaseFarCell(bucket.cx * 3 + sx, bucket.cz * 3 + sz) : null;
              if (cell) cell.meshes.push(mesh);
              cells.push(cell);
            }
            if (counts.some((n) => n > 0))
              mesh.userData.chase = {
                materials: [chaseMaterial, farSkipMaterial],
                starts,
                counts,
                cells,
                dirty: false,
                // The groups the view draws, and the ones swapped in for the shadow pass (CHASE SHADOW CASTERS).
                viewGroups: geometry.groups,
                shadowGroups: geometry.groups.map((g) => ({ start: g.start, count: g.count, materialIndex: 1 })),
                shadowFrame: 0,
                viewVisible: false,
              };
            farScenery.add(mesh);
          }
        }
        farPieces.length = 0;
        chaseFarReady();
      }
      // Swap between the full city and the far copy; keep window light in step.
      function updateFarScenery() {
        // Zoomed right out on the street the whole city is in view too, so the far
        // copy serves both cameras (the quality tier's lodBias moves the switch).
        const lod = activeTier ? activeTier.lodBias : 1,
          far = !chaseViewActive && viewZoom < (flightViewActive ? FAR_SCENERY_ZOOM : STREET_FAR_SCENERY_ZOOM) * lod && farClasses.length > 0;
        // Between the street and the far view, the full city is drawn but its
        // shadows come from the far copy on a layer only the sun's shadow camera
        // renders: a few dozen merged casters instead of every building batch.
        const proxy = !far && !chaseViewActive && viewZoom < SHADOW_PROXY_ZOOM * lod && farClasses.length > 0;
        // The chase view: the full city near the camera, the copy cell by cell beyond (chase-view3d.js CHASE FAR CELLS).
        const chase = chaseViewActive && farClasses.length > 0;
        if (far !== farSceneryShown || proxy !== shadowProxyShown || chase !== farChaseShown) {
          farSceneryShown = far;
          shadowProxyShown = proxy;
          farChaseShown = chase;
          farScenery.visible = far || proxy || chase;
          const children = farScenery.children;
          for (let i = 0; i < children.length; i++) {
            const mesh = children[i],
              cells = mesh.userData.chase;
            mesh.layers.set(proxy ? SHADOW_PROXY_LAYER : 0);
            if (cells) mesh.material = chase ? cells.materials : mesh.userData.farMaterial;
            // (In the chase view a mesh is shown while one of its cells is far.)
            mesh.visible = !chase;
          }
          for (const mesh of farHidden) {
            mesh.visible = !far;
            mesh.castShadow = !proxy;
          }
          resetChaseFar();
        }
        if (chase) updateChaseFar();
        if (!far && !(chase && chaseFarShownCount)) return;
        for (const c of farClasses) {
          if (!far && c.chaseMaterial !== c.material) continue;
          if (!c.material.emissiveMap && !c.members[0].emissiveIntensity) continue;
          let sum = 0;
          for (const m of c.members) sum += m.emissiveIntensity;
          c.material.emissiveIntensity = sum / c.members.length;
        }
      }
