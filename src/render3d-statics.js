      const allBuildings = [],
        statics = [],
        carModels = new Map(),
        pickupModels = new Map(),
        fx = [];
      const boxGeo = new Three.BoxGeometry(1, 1, 1),
        sphereGeo = new Three.SphereGeometry(1, 12, 8),
        wheelGeo = new Three.CylinderGeometry(1, 1, 1, 20),
        cylinderGeo = new Three.CylinderGeometry(1, 1, 1, 10);
      const mat = (color, roughness = 0.7, metalness = 0) =>
        new Three.MeshStandardMaterial({
          color,
          roughness,
          metalness,
        });
      const concrete = mat('#8a887e'),
        darkMetal = mat('#353a3d', 0.5, 0.6),
        chrome = mat('#b8c0c3', 0.22, 0.88),
        rubber = mat('#141518', 0.93),
        glass = new Three.MeshStandardMaterial({
          color: '#182b3c',
          roughness: 0.12,
          metalness: 0.65,
        }),
        wood = mat('#4f4037'),
        leafMats = ['#344c3c', '#4e654a', '#5b7150'].map((c) => mat(c)),
        // Planted greenery (hedges, planters, potted palms, roof gardens): the same
        // green as leafMats[1] but it never sways. The wind patch (surfaces3d.js) is
        // for trees; a clipped hedge or a pot on a sheltered roof waving about read
        // as a glitch.
        stillLeafMat = mat('#4e654a'),
        // (Trees and palms are vegetation3d.js's; this is left in surfaces3d.js's
        // list of swaying materials.)
        palmFrondMaterial = new Three.MeshStandardMaterial({ color: '#3e7862', roughness: 0.7, side: Three.DoubleSide });
      const warmLamp = new Three.MeshBasicMaterial({
          color: '#ffde9b',
        }),
        tailLamp = new Three.MeshBasicMaterial({
          color: '#e6614f',
        }),
        // Tail lamps swap to this while the vehicle brakes (c.braking, physics.js):
        // bright enough to bloom by day as well as at night.
        brakeLamp = new Three.MeshBasicMaterial({
          color: '#ff2a1c',
        });
      /**
       * STATIC BATCHER
       * Static scenery is authored as thousands of small meshes (parapets, ledges,
       * tree crowns, lamp posts, kerbs). Traversing and drawing them one by one
       * costs more than the pixels they cover, so after construction each group
       * registered here has its plain single-material meshes merged into one
       * geometry per (material, 1024-unit cell). Materials are untouched, so
       * per-building fades and night emissive still work; frustum culling per
       * cell replaces the old per-group distance culling. Objects that move or
       * animate must be flagged `userData.dynamic = true` to be left alone.
       */
      const batchGroups = [],
        staticBatchMeshes = [];
      function batchStaticGroups(cellSize = 1024) {
        const buckets = new Map(),
          v = new Three.Vector3(),
          n3 = new Three.Matrix3();
        let removed = 0;
        for (const group of batchGroups) {
          group.updateMatrixWorld(true);
          const taken = [];
          // A mesh stays live if it, or any group between it and the batch root, is
          // flagged dynamic (a crane trolley, a gate, a door that swings).
          const liveBranch = (o) => {
            for (; o && o !== group; o = o.parent) if (o.userData.dynamic) return true;
            return false;
          };
          group.traverse((o) => {
            if (!o.isMesh || o.isInstancedMesh || o.isSprite || o.userData.sign || liveBranch(o)) return;
            if (Array.isArray(o.material) || !o.geometry?.attributes?.position) return;
            if (o.material.transparent && o.material.opacity < 1) return;
            const e = o.matrixWorld.elements,
              key = o.material.uuid + '|' + Math.floor(e[12] / cellSize) + '|' + Math.floor(e[14] / cellSize);
            let b = buckets.get(key);
            if (!b)
              buckets.set(
                key,
                (b = { material: o.material, parts: [], vertices: 0, indices: 0, cx: Math.floor(e[12] / cellSize), cz: Math.floor(e[14] / cellSize) }),
              );
            const geo = o.geometry,
              count = geo.attributes.position.count;
            b.parts.push({ geo, matrix: o.matrixWorld.clone() });
            noteFarScenery(o);
            b.vertices += count;
            b.indices += geo.index ? geo.index.count : count;
            taken.push(o);
          });
          for (const o of taken) o.parent.remove(o);
          removed += taken.length;
        }
        for (const b of buckets.values()) {
          const positions = new Float32Array(b.vertices * 3),
            normals = new Float32Array(b.vertices * 3),
            uvs = new Float32Array(b.vertices * 2),
            indices = new Uint32Array(b.indices),
            // Other attributes every part carries (a shared facade's tint and window
            // light, cityscape3d.js SHARED FACADES) are copied along as they are.
            first = b.parts[0].geo.attributes,
            extras = Object.keys(first)
              .filter((name) => !['position', 'normal', 'uv'].includes(name))
              .filter((name) => b.parts.every(({ geo }) => geo.attributes[name]?.itemSize === first[name].itemSize))
              .map((name) => ({ name, size: first[name].itemSize, array: new Float32Array(b.vertices * first[name].itemSize) }));
          let vo = 0,
            io = 0;
          for (const { geo, matrix } of b.parts) {
            const pos = geo.attributes.position,
              nor = geo.attributes.normal,
              uv = geo.attributes.uv,
              count = pos.count;
            n3.getNormalMatrix(matrix);
            for (let i = 0; i < count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
              positions[(vo + i) * 3] = v.x;
              positions[(vo + i) * 3 + 1] = v.y;
              positions[(vo + i) * 3 + 2] = v.z;
              if (nor) v.fromBufferAttribute(nor, i).applyMatrix3(n3).normalize();
              else v.set(0, 1, 0);
              normals[(vo + i) * 3] = v.x;
              normals[(vo + i) * 3 + 1] = v.y;
              normals[(vo + i) * 3 + 2] = v.z;
              if (uv) {
                uvs[(vo + i) * 2] = uv.getX(i);
                uvs[(vo + i) * 2 + 1] = uv.getY(i);
              }
              for (const extra of extras) {
                const source = geo.attributes[extra.name];
                for (let k = 0; k < extra.size; k++) extra.array[(vo + i) * extra.size + k] = source.getComponent(i, k);
              }
            }
            if (geo.index) {
              const idx = geo.index;
              for (let i = 0; i < idx.count; i++) indices[io + i] = idx.getX(i) + vo;
              io += idx.count;
            } else {
              for (let i = 0; i < count; i++) indices[io + i] = vo + i;
              io += count;
            }
            vo += count;
          }
          const merged = new Three.BufferGeometry();
          merged.setAttribute('position', new Three.BufferAttribute(positions, 3));
          merged.setAttribute('normal', new Three.BufferAttribute(normals, 3));
          merged.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
          for (const extra of extras) merged.setAttribute(extra.name, new Three.BufferAttribute(extra.array, extra.size));
          merged.setIndex(new Three.BufferAttribute(indices, 1));
          merged.computeBoundingSphere();
          const m = new Three.Mesh(merged, b.material);
          m.castShadow = true;
          m.receiveShadow = true;
          m.name = 'static batch';
          staticBatchCell(b.cx, b.cz, cellSize).group.add(m);
          staticBatchMeshes.push(m);
        }
        return { merged: removed, batches: buckets.size };
      }
      /**
       * SCENE MATRICES
       * three.js recomputes every object's local and world matrix on every render
       * (the scene's matrixAutoUpdate forces the whole tree), ~15,000 objects in a
       * city view, visible or not. The scene's own update is switched off and this
       * pass runs once a frame instead, with the same results for everything that
       * is drawn:
       *  - a local matrix is recomposed only when position, rotation or scale
       *    changed since it was last composed (a matrixAutoUpdate = false object
       *    keeps its hand-set matrix and is always re-multiplied, as before);
       *  - a world matrix is re-multiplied only when its local matrix or an
       *    ancestor's world matrix changed, or it was flagged matrixWorldNeedsUpdate;
       *  - a hidden subtree is skipped and marked stale, so it is brought up to date
       *    on the frame it is shown again.
       * Code that reads a hidden object's matrixWorld must bring it up to date itself
       * (updateWorldMatrix), which the ride and signal instancing already do.
       */
      scene.matrixWorldAutoUpdate = false;
      function refreshObjectMatrices(o, parentMoved) {
        let moved = parentMoved || o.matrixWorldNeedsUpdate || o.matrixStale === true || o.matrixParent !== o.parent;
        if (o.matrixAutoUpdate) {
          const p = o.position,
            q = o.quaternion,
            s = o.scale;
          let c = o.matrixSource;
          if (!c) c = o.matrixSource = new Float64Array(10).fill(NaN);
          if (
            c[0] !== p.x || c[1] !== p.y || c[2] !== p.z ||
            c[3] !== q._x || c[4] !== q._y || c[5] !== q._z || c[6] !== q._w ||
            c[7] !== s.x || c[8] !== s.y || c[9] !== s.z
          ) {
            c[0] = p.x;
            c[1] = p.y;
            c[2] = p.z;
            c[3] = q._x;
            c[4] = q._y;
            c[5] = q._z;
            c[6] = q._w;
            c[7] = s.x;
            c[8] = s.y;
            c[9] = s.z;
            o.matrix.compose(p, q, s);
            moved = true;
          }
        } else moved = true;
        if (moved) {
          if (o.parent) o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
          else o.matrixWorld.copy(o.matrix);
          o.matrixWorldNeedsUpdate = false;
          o.matrixParent = o.parent;
          o.matrixStale = false;
        }
        const children = o.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.matrixWorldAutoUpdate !== true) continue;
          if (!child.visible) {
            // Whatever happens to it (or above it) while hidden, recompute it when shown.
            if (child.matrixStale !== true) child.matrixStale = true;
            continue;
          }
          refreshObjectMatrices(child, moved);
        }
      }
      function refreshSceneMatrices() {
        refreshObjectMatrices(scene, false);
      }
      /**
       * STATIC BATCH CELLS
       * The merged batches (a few thousand across the map) hang from one group per
       * batching cell, so the camera and shadow passes skip a whole far cell in one
       * visibility test instead of testing each batch against the frustum. A cell
       * is shown while it is within the view's reach plus a margin for the shadows
       * of tall buildings standing just outside the view (see render()).
       */
      const staticBatchCells = new Map(),
        // Beyond the view's reach: long shadows of towers just outside the frame.
        STATIC_BATCH_SHADOW_MARGIN = 700;
      function staticBatchCell(cx, cz, cellSize) {
        const key = cx * 4096 + cz;
        let cell = staticBatchCells.get(key);
        if (!cell) {
          const group = new Three.Group();
          group.name = 'static batch cell';
          group.userData.cellContainer = true;
          scene.add(group);
          cell = { group, x: (cx + 0.5) * cellSize, z: (cz + 0.5) * cellSize, half: cellSize / 2 };
          staticBatchCells.set(key, cell);
        }
        return cell;
      }
      /**
       * STATIC CELLS
       * Thousands of scenery groups (buildings, parks, props) are shown or hidden
       * each frame by whether they fall inside the view's footprint. Once the city
       * is built, every group that is a direct child of the scene and registered
       * once in `statics` is moved under a 1024-unit cell group (identity
       * transform, so nothing moves). A cell entirely out of reach is hidden in
       * one test and its groups are skipped by the visibility loop, the matrix
       * pass and both render passes. Groups registered twice, parented elsewhere
       * or added later stay loose and are tested one by one as before.
       */
      const staticCells = [],
        looseStatics = [];
      let celledStatics = 0;
      function staticInView(s) {
        return (
          (viewZoom > 0.28 || s.radius >= 50) &&
          Math.abs(s.x - viewCenter.x) < viewReach + s.radius &&
          Math.abs(s.y - viewCenter.y) < viewReach + s.radius
        );
      }
      function cellStatics(cellSize = 1024) {
        const uses = new Map(),
          cells = new Map(),
          moved = new Map();
        for (const s of statics) uses.set(s.group, (uses.get(s.group) || 0) + 1);
        for (const s of statics) {
          if (s.group.parent !== scene || uses.get(s.group) !== 1) {
            looseStatics.push(s);
            continue;
          }
          const key = Math.floor(s.x / cellSize) * 4096 + Math.floor(s.y / cellSize);
          let cell = cells.get(key);
          if (!cell) {
            const group = new Three.Group();
            group.name = 'static cell';
            group.userData.cellContainer = true;
            scene.add(group);
            cell = {
              group,
              x: (Math.floor(s.x / cellSize) + 0.5) * cellSize,
              y: (Math.floor(s.y / cellSize) + 0.5) * cellSize,
              reach: 0,
              entries: [],
            };
            cells.set(key, cell);
            staticCells.push(cell);
          }
          cell.reach = Math.max(cell.reach, Math.abs(s.x - cell.x) + s.radius, Math.abs(s.y - cell.y) + s.radius);
          cell.entries.push(s);
          moved.set(s.group, cell.group);
        }
        // Re-parent in one pass (scene.remove() would splice the scene's list of
        // ~10,000 children once per group).
        scene.children = scene.children.filter((o) => !moved.has(o));
        for (const [group, parent] of moved) {
          group.parent = parent;
          parent.children.push(group);
        }
        celledStatics = statics.length;
      }
