    // BEGIN SUBSYSTEM: src/render3d.js — Three.js renderer and resource lifecycle
    /**
     * Three.js renderer and resource lifecycle
     * Source: src/render3d.js
     * Scope: shared game closure.
     * Asset loading, camera, lights, shared geometry, entity models, effects and drawing API.
     */
    /* The cinematic renderer consumes the existing simulation without changing its rules. */
    let city3D = null,
      visualAssets = {},
      lastVisualTime = 0;
    async function loadVisuals() {
      // Native simulation tests have no image decoder; canvas geometry stays usable.
      if (typeof Image === 'undefined') return;
      const names = ['architecture', 'ground', 'arsenal', 'harbor'];
      await Promise.all(
        names.map(
          (name) =>
            new Promise((resolve) => {
              const im = new Image();
              im.onload = () => {
                visualAssets[name] = im;
                resolve();
              };
              im.onerror = () => resolve();
              im.src = ASSETS[name];
            }),
        ),
      );
      drawWeapon();
      if (gameMode === 'arsenal') renderArsenal();
      if (typeof THREE === 'undefined' || !visualAssets.architecture || !visualAssets.ground) return;
      try {
        city3D = createCityRenderer();
        getElement('renderBadge').textContent = 'SOUTH COAST · DUSK';
        // The 2D fallback's ground bitmap (~21 MP) is never drawn with the 3D
        // renderer running: free it (late paints into it are harmless no-ops).
        groundCanvas.width = groundCanvas.height = 1;
      } catch (error) {
        console.warn('Reduced graphics mode:', error);
        getElement('renderBadge').textContent = 'REDUCED GRAPHICS';
      }
      drawWeapon();
    }
    function createCityRenderer() {
      const Three = THREE,
        scene = new Three.Scene();
      scene.background = new Three.Color('#444c63');
      // scene.fog (distance haze) is set up with the flight camera in flight-view3d.js.
      const renderer = new Three.WebGLRenderer({
        canvas: getElement('scene'),
        // Anti-aliasing happens on the HDR scene target (postfx3d.js), not the canvas.
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
      });
      // three.js reads back every shader's info log after compiling it, which
      // forces the driver to finish compiling on the spot (and was most of the
      // CPU time in profiles whenever a new material came into view). Only with
      // ?shadercheck in the URL, for debugging a shader.
      renderer.debug.checkShaderErrors = /[?&]shadercheck\b/.test(location.search);
      // Quality tier (quality.js): 'auto' asks the GPU what it is first.
      graphicsDetected = detectGraphicsTier(renderer.getContext());
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, graphicsTier().pixelRatio));
      renderer.setSize(viewportWidth, viewportHeight);
      renderer.outputColorSpace = Three.SRGBColorSpace;
      renderer.toneMapping = Three.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.14;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = Three.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
      /**
       * CAMERA
       * On the street the view is orthographic and overhead: the city reads as a
       * plan, which is the whole point of the view, and a perspective lean on tall
       * buildings would cost legibility there. In the air a perspective camera
       * takes over so height reads as height (see flight-view3d.js). `camera` is
       * whichever of the two is active this frame.
       */
      const streetCamera = new Three.OrthographicCamera(-500, 500, 350, -350, 1, 7500),
        ray = new Three.Raycaster(),
        groundPlane = new Three.Plane(new Three.Vector3(0, 1, 0), -9),
        hitPoint = new Three.Vector3();
      const hemi = new Three.HemisphereLight('#b3c5e9', '#564943', 2.0);
      scene.add(hemi);
      const sun = new Three.DirectionalLight('#ffd7a0', 3.0),
        shadowDetail = touchEnabled() ? 2048 : 3072;
      sun.castShadow = true;
      sun.shadow.mapSize.set(shadowDetail, shadowDetail);
      sun.shadow.camera.left = -900;
      sun.shadow.camera.right = 900;
      sun.shadow.camera.top = 900;
      sun.shadow.camera.bottom = -900;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 3200;
      sun.shadow.bias = -0.00035;
      sun.shadow.normalBias = 1.1;
      sun.shadow.radius = 2.2;
      scene.add(sun, sun.target);
      const fill = new Three.DirectionalLight('#879ccc', 0.55);
      fill.position.set(-200, 100, -300);
      scene.add(fill);
      let camera = streetCamera;
      // @include src/flight-view3d.js
      // @include src/postfx3d.js
      // @include src/lighting3d.js
      // @include src/searchlight3d.js
      const allBuildings = [],
        statics = [],
        carModels = new Map(),
        personModels = new Map(),
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
        // Palms (makePalm in world3d.js) share these so they batch together.
        palmTrunkMaterial = mat('#978266'),
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
      function pattern(q, scale) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = scale;
        const tc = tile.getContext('2d');
        tc.drawImage(
          visualAssets.ground,
          ((q % 2) * visualAssets.ground.width) / 2,
          (Math.floor(q / 2) * visualAssets.ground.height) / 2,
          visualAssets.ground.width / 2,
          visualAssets.ground.height / 2,
          0,
          0,
          scale,
          scale,
        );
        if (q === 0) {
          tc.fillStyle = '#222c38b0';
          tc.fillRect(0, 0, scale, scale);
        }
        return drawingContext.createPattern(tile, 'repeat');
      }
      const asphalt = pattern(0, 112),
        paving = pattern(1, 72),
        grass = pattern(2, 100),
        tarmac = pattern(3, 120);
      drawingContext.save();
      coastPath(drawingContext);
      drawingContext.clip();
      drawingContext.fillStyle = '#263e4d';
      drawingContext.fillRect(CITY_LEFT, CITY_TOP, CITY_WIDTH, CITY_HEIGHT);
      drawingContext.fillStyle = paving;
      drawingContext.fillRect(CITY_LEFT + 48, CITY_TOP + 45, CITY_WIDTH - 112, CITY_HEIGHT - 112);
      paintCityStreets(drawingContext, true);
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
            drawingContext.fillStyle = tarmac;
            drawingContext.fillRect(x + 18, z + 170, 318, 165);
            drawingContext.strokeStyle = '#bebeb044';
            drawingContext.lineWidth = 1;
            for (let px = x + 20; px < x + 340; px += 26) {
              drawingContext.beginPath();
              drawingContext.moveTo(px, z + 178);
              drawingContext.lineTo(px, z + 218);
              drawingContext.moveTo(px, z + 291);
              drawingContext.lineTo(px, z + 330);
              drawingContext.stroke();
            }
            // Zone-specific ground: mirrors the block patterns chosen in buildWorld().
            const zone = districtAt(x + 177, z + 177),
              blockSeed = (bx * 31 + by * 17) % 7;
            if (zone.includes('FINANCIAL') && skylineBlockTowers(bx, by).length) {
              // Cluster plaza (src/skyline.js), the same inset as the game's ground canvas.
              paintSkylinePlaza(drawingContext, x + 14, z + 14, 326, 326);
            } else if (zone.includes('FINANCIAL') && blockSeed % 2 === 0) {
              drawingContext.fillStyle = '#c3bfb2';
              drawingContext.fillRect(x + 10, z + 10, 344, 160);
              drawingContext.strokeStyle = '#a8a497';
              drawingContext.lineWidth = 1.2;
              for (let g = 10; g <= 344; g += 24) {
                drawingContext.beginPath();
                drawingContext.moveTo(x + g, z + 10);
                drawingContext.lineTo(x + g, z + 170);
                drawingContext.stroke();
              }
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
      // Manhole covers and utility plates scattered along the roadway.
      for (let i = 0; i < 260; i++) {
        const mx = CITY_LEFT + 100 + ((i * 7919) % (CITY_WIDTH - 200)),
          mz = 100 + ((i * 104729) % (CITY_SIZE - 200));
        if (!onRoad(mx, mz) || onBridge(mx, mz)) continue;
        drawingContext.fillStyle = '#2b3134';
        drawingContext.beginPath();
        drawingContext.arc(mx, mz, 5.5, 0, TAU);
        drawingContext.fill();
        drawingContext.strokeStyle = '#6b7275';
        drawingContext.lineWidth = 1.2;
        drawingContext.stroke();
      }
      // Avenues carry a solid double yellow centre line; local streets keep their dashes.
      // The line stops short of every junction (at its stop line) and of the
      // street's end, instead of running through the crossings and the box.
      for (const r of cityStreets()) {
        if (r.width < 112) continue;
        const crossings = cityStreets()
          .filter((o) => o.vertical !== r.vertical && r.r >= o.start - 6 && r.r <= o.end + 6 && o.r > r.start && o.r < r.end)
          .map((o) => [o.r - o.width / 2 - 24, o.r + o.width / 2 + 24]);
        const runs = [[r.start + 30, r.end - 30]];
        for (const [c0, c1] of crossings)
          for (let i = runs.length - 1; i >= 0; i--) {
            const [s0, s1] = runs[i];
            if (c1 <= s0 || c0 >= s1) continue;
            runs.splice(i, 1, ...[[s0, c0], [c1, s1]].filter(([p, q]) => q - p > 20));
          }
        const at = (v, offset) => (r.vertical ? [r.r + offset, v] : [v, r.r + offset]);
        for (const [v0, v1] of runs) {
          drawingContext.strokeStyle = '#3b4449';
          drawingContext.lineWidth = 7;
          drawingContext.beginPath();
          drawingContext.moveTo(...at(v0, 0));
          drawingContext.lineTo(...at(v1, 0));
          drawingContext.stroke();
          drawingContext.strokeStyle = '#c9a94a';
          drawingContext.lineWidth = 1.6;
          for (const offset of [-2.4, 2.4]) {
            drawingContext.beginPath();
            drawingContext.moveTo(...at(v0, offset));
            drawingContext.lineTo(...at(v1, offset));
            drawingContext.stroke();
          }
        }
      }
      // Stop lines across the approach lanes at every signalled junction, just
      // before the crossing (the same junctions harbor3d.js gives signals).
      drawingContext.fillStyle = '#dcdccf';
      for (const x of ROAD_CENTERS)
        for (const z of ROAD_ROWS) {
          if (!cityIntersectionAt(x, z) || !groundAt(x, z, 92) || inHarbor(x, z, 100)) continue;
          const col = cityStreets().find((r) => r.vertical && r.r === x && z > r.start && z < r.end),
            row = cityStreets().find((r) => !r.vertical && r.r === z && x > r.start && x < r.end);
          if (!col || !row) continue;
          const hc = col.width / 2,
            hr = row.width / 2;
          // Traffic keeps right: southbound stops north of the box on the west
          // half, northbound south of it on the east half, and so on.
          drawingContext.fillRect(x - hc, z - hr - 23, hc, 3);
          drawingContext.fillRect(x, z + hr + 20, hc, 3);
          drawingContext.fillRect(x + hc + 20, z - hr, 3, hr);
          drawingContext.fillRect(x - hc - 23, z, 3, hr);
        }
      // Patches, drains, stop lines and curb stains keep the road from reading as a flat color.
      let rseed = 47;
      const random = () => {
        rseed = (rseed * 1664525 + 1013904223) >>> 0;
        return rseed / 4294967296;
      };
      for (let i = 0; i < 330; i++) {
        const x = CITY_LEFT + 80 + random() * (CITY_WIDTH - 240),
          z = 80 + random() * (CITY_SIZE - 240);
        if (!onRoad(x, z)) continue;
        drawingContext.fillStyle = 'rgba(12,17,23,' + (0.12 + random() * 0.12) + ')';
        drawingContext.beginPath();
        drawingContext.ellipse(x, z, 12 + random() * 35, 3 + random() * 9, random() * 3, 0, TAU);
        drawingContext.fill();
      }
      // Gully grates in the gutter, only where the street really runs (they
      // used to be stamped down every column line, across plazas and quays).
      for (const road of cityStreets().filter((s) => s.vertical))
        for (let z = CITY_TOP + 240; z < CITY_SIZE - 150; z += 230) {
          if (z < road.start + 20 || z > road.end - 30 || !onRoad(road.r + road.width / 2 - 4, z)) continue;
          if (cityStreets().some((o) => !o.vertical && Math.abs(o.r - z) < o.width / 2 + 26 && road.r > o.start && road.r < o.end))
            continue;
          // The grate (drawn at r + 48, 5 wide) sits in the east gutter.
          const r = road.r + road.width / 2 - 54;
          drawingContext.fillStyle = '#1d282d';
          drawingContext.fillRect(r + 48, z, 5, 11);
          drawingContext.fillStyle = '#707576';
          for (let k = 0; k < 10; k += 3) drawingContext.fillRect(r + 48, z + k, 5, 1);
        }
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
      paintDistrictGround(drawingContext);
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
      const roughCanvas = document.createElement('canvas');
      roughCanvas.width = Math.ceil((896 * CITY_WIDTH) / CITY_SIZE);
      roughCanvas.height = Math.ceil((896 * CITY_HEIGHT) / CITY_SIZE);
      const rg = roughCanvas.getContext('2d');
      rg.scale(896 / CITY_SIZE, 896 / CITY_SIZE);
      rg.translate(-CITY_LEFT, -CITY_TOP);
      rg.fillStyle = '#e9e9e9';
      rg.fillRect(CITY_LEFT, CITY_TOP, CITY_WIDTH, CITY_HEIGHT);
      rg.fillStyle = '#737373';
      for (const r of ROAD_CENTERS) rg.fillRect(r - 56, CITY_TOP + 48, 112, CITY_HEIGHT - 112);
      for (const r of ROAD_ROWS) rg.fillRect(CITY_LEFT + 51, r - 56, CITY_WIDTH - 112, 112);
      const roughTx = new Three.CanvasTexture(roughCanvas);
      const groundMesh = new Three.Mesh(
        new Three.PlaneGeometry(CITY_WIDTH, CITY_HEIGHT),
        new Three.MeshStandardMaterial({
          map: groundTx,
          roughnessMap: roughTx,
          roughness: 1,
          metalness: 0.14,
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
          const im = new Three.InstancedMesh(bucket.geometry, bucket.material, bucket.parts.length);
          im.name = 'breakable scenery';
          im.castShadow = bucket.castShadow;
          im.receiveShadow = true;
          bucket.parts.forEach((part, i) => {
            im.setMatrixAt(i, part.matrix);
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
        }
        breakableBuckets.clear();
      }
      // A palm's seven fronds as one geometry at size 1 (makePalm, world3d.js,
      // scales the whole palm), made on first use.
      let palmFrondGeometry = null;
      // Street trees with proper trunks and layered crowns.
      const blossomMat = mat('#d5a2b5');
      // A crown lobe: 80 smooth-shaded faces read as foliage at street zoom (five
      // per tree, every tree drawn from instanced cells, BREAKABLE SCENERY).
      const leafGeo = new Three.IcosahedronGeometry(1, 1),
        trunkGeo = new Three.CylinderGeometry(0.9, 1.9, 1, 8),
        // A pine's tiers are one unit cone scaled per tier (one draw for them all).
        pineTierGeo = new Three.ConeGeometry(1, 1, 8);
      trees.forEach((t, i) => plantTree(t, i));
      // One tree of the plan (or a renderer-only one, landscape3d.js): a palm on the
      // Keys, otherwise a trunk, limbs and a crown of lobes; a breakable prop drawn
      // as instances (BREAKABLE SCENERY).
      function plantTree(t, i) {
        if (t.tropical ?? (onPalmKeys(t.x) && !t.county)) {
          t.prop = makePalm(t.x, t.y, t.r / 17);
          return;
        }
        const group = new Three.Group();
        group.position.set(t.x, terrainHeight(t.x, t.y), t.y);
        t.prop = treeProp(t);
        // Tapered trunk with a root flare, two main limbs, and a layered crown of
        // five offset lobes so the canopy reads as foliage rather than a ball.
        mesh(trunkGeo, wood, group, 0, t.r * 0.8, 0, 1, t.r * 1.6, 1);
        if (!t.pine) {
          for (const a of [0.7, 3.4]) {
            // The trunk's tapered cylinder, so trunk and limbs are one draw.
            const limb = mesh(trunkGeo, wood, group, Math.cos(a) * t.r * 0.25, t.r * 1.45, Math.sin(a) * t.r * 0.25, 0.45, t.r * 0.9, 0.45);
            limb.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
          }
        }
        const lobes = t.pine ? 4 : 5;
        for (let j = 0; j < lobes; j++) {
          const a = j * 2.399 + i * 0.7;
          if (t.pine)
            mesh(
              pineTierGeo,
              leafMats[(i + j) % 3],
              group,
              0,
              t.r * (1.3 + j * 0.55),
              0,
              t.r * (0.95 - j * 0.16),
              t.r * 1.2,
              t.r * (0.95 - j * 0.16),
            );
          else {
            const spread = j === 0 ? 0 : t.r * 0.42,
              lift = j === 0 ? t.r * 0.35 : (j % 2) * t.r * 0.22;
            mesh(
              leafGeo,
              t.blossom && j % 2 ? blossomMat : leafMats[(i + j) % 3],
              group,
              Math.cos(a) * spread,
              t.r * 1.75 + lift,
              Math.sin(a) * spread,
              t.r * (j === 0 ? 0.95 : 0.7),
              t.r * (j === 0 ? 0.8 : 0.62),
              t.r * (j === 0 ? 0.95 : 0.7),
            );
          }
        }
        breakableGroup(t.prop, group);
      }
      // Lamps, illuminated signs and street furniture.
      const haloCanvas = document.createElement('canvas');
      haloCanvas.width = haloCanvas.height = 64;
      const hg = haloCanvas.getContext('2d'),
        hr = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
      hr.addColorStop(0, '#fff8df');
      hr.addColorStop(0.14, '#ffda92c0');
      hr.addColorStop(0.45, '#ffb45230');
      hr.addColorStop(1, '#ffb45200');
      hg.fillStyle = hr;
      hg.fillRect(0, 0, 64, 64);
      const haloTx = new Three.CanvasTexture(haloCanvas);
      const haloMat = new Three.SpriteMaterial({
        map: haloTx,
        color: '#ffd99b',
        transparent: true,
        blending: Three.AdditiveBlending,
        depthWrite: false,
      });
      function halo(parent, x, y, z, size, color) {
        const s = new Three.Sprite(haloMat.clone());
        s.position.set(x, y, z);
        s.scale.set(size, size, 1);
        if (color) s.material.color.set(color);
        parent.add(s);
        return s;
      }
      /**
       * VEHICLE HALOS
       * Every lit vehicle has four halo sprites (head and tail lamps; planes their
       * navigation lights), and each sprite was a draw call with its own material:
       * a hundred and more at night in a busy street. The sprites stay on the
       * models as anchors, always hidden; the lit ones are gathered during the
       * vehicle pass and drawn as one instanced, camera-facing quad set with the
       * same texture, colour, opacity and additive blending (the quad's size is
       * the sprite's scale, its opacity rides in the unused w of the instance
       * matrix's first column).
       */
      const VEHICLE_HALO_CAPACITY = 640,
        vehicleHaloMaterial = new Three.ShaderMaterial({
          // (merge() would clone the texture; the shared halo texture is set below.)
          uniforms: { ...Three.UniformsUtils.merge([Three.UniformsLib.fog]), map: { value: haloTx } },
          vertexShader: `
            #include <common>
            #include <fog_pars_vertex>
            varying vec2 vUv;
            varying vec3 vColor;
            varying float vOpacity;
            void main() {
              vUv = uv;
              #ifdef USE_INSTANCING_COLOR
                vColor = instanceColor;
              #else
                vColor = vec3( 1.0 );
              #endif
              vOpacity = instanceMatrix[ 0 ].w;
              vec4 mvPosition = modelViewMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 );
              mvPosition.xy += position.xy * length( instanceMatrix[ 0 ].xyz );
              gl_Position = projectionMatrix * mvPosition;
              #include <fog_vertex>
            }
          `,
          fragmentShader: `
            #include <common>
            #include <fog_pars_fragment>
            uniform sampler2D map;
            varying vec2 vUv;
            varying vec3 vColor;
            varying float vOpacity;
            void main() {
              vec4 texel = texture2D( map, vUv );
              gl_FragColor = vec4( vColor * texel.rgb, vOpacity * texel.a );
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
              #include <fog_fragment>
            }
          `,
          transparent: true,
          blending: Three.AdditiveBlending,
          depthWrite: false,
          fog: true,
        }),
        vehicleHalos = new Three.InstancedMesh(new Three.PlaneGeometry(1, 1), vehicleHaloMaterial, VEHICLE_HALO_CAPACITY),
        vehicleHaloQueue = [],
        vehicleHaloOpacity = [],
        vehicleHaloPoint = new Three.Vector3(),
        vehicleHaloMatrix = new Three.Matrix4();
      vehicleHalos.name = 'vehicle halos';
      vehicleHalos.frustumCulled = false;
      vehicleHalos.count = 0;
      vehicleHalos.userData.dynamic = true;
      vehicleHalos.setColorAt(0, new Three.Color(1, 1, 1));
      scene.add(vehicleHalos);
      function queueVehicleHalo(sprite, opacity) {
        if (vehicleHaloQueue.length >= VEHICLE_HALO_CAPACITY) return;
        vehicleHaloQueue.push(sprite);
        vehicleHaloOpacity.push(opacity);
      }
      // After the scene's matrices are current (SCENE MATRICES): place each queued
      // halo where its sprite would have been drawn.
      function flushVehicleHalos() {
        const n = vehicleHaloQueue.length,
          e = vehicleHaloMatrix.elements;
        for (let i = 0; i < n; i++) {
          const sprite = vehicleHaloQueue[i],
            parent = sprite.parent,
            pe = parent.matrixWorld.elements,
            parentScale = Math.hypot(pe[0], pe[1], pe[2]),
            size = sprite.scale.x * parentScale;
          vehicleHaloPoint.copy(sprite.position).applyMatrix4(parent.matrixWorld);
          e[0] = size;
          e[1] = 0;
          e[2] = 0;
          e[3] = vehicleHaloOpacity[i];
          e[4] = 0;
          e[5] = size;
          e[6] = 0;
          e[7] = 0;
          e[8] = 0;
          e[9] = 0;
          e[10] = size;
          e[11] = 0;
          e[12] = vehicleHaloPoint.x;
          e[13] = vehicleHaloPoint.y;
          e[14] = vehicleHaloPoint.z;
          e[15] = 1;
          vehicleHalos.setMatrixAt(i, vehicleHaloMatrix);
          vehicleHalos.setColorAt(i, sprite.material.color);
        }
        vehicleHalos.count = n;
        vehicleHalos.visible = n > 0;
        if (n) {
          vehicleHalos.instanceMatrix.clearUpdateRanges();
          vehicleHalos.instanceMatrix.addUpdateRange(0, n * 16);
          vehicleHalos.instanceMatrix.needsUpdate = true;
          vehicleHalos.instanceColor.clearUpdateRanges();
          vehicleHalos.instanceColor.addUpdateRange(0, n * 3);
          vehicleHalos.instanceColor.needsUpdate = true;
        }
        vehicleHaloQueue.length = 0;
        vehicleHaloOpacity.length = 0;
      }
      // @include src/damage3d.js
      const lampGlowPending = [];
      // Lamp posts are instanced (post, arm, lantern) so a car can knock one flat
      // without unbatching the street; each is a street prop in damage.js.
      const lampPosts = lamps.length,
        lampPoles = new Three.InstancedMesh(boxGeo, darkMetal, lampPosts),
        lampArms = new Three.InstancedMesh(boxGeo, darkMetal, lampPosts),
        lampHeads = new Three.InstancedMesh(boxGeo, warmLamp, lampPosts);
      for (const pool of [lampPoles, lampArms, lampHeads]) {
        pool.count = 0;
        pool.castShadow = true;
        pool.receiveShadow = true;
        pool.frustumCulled = false;
        scene.add(pool);
      }
      // Every lamp is drawn (only every second one used to be, which left most
      // streets dark at night). Its pool of light is in the night light map
      // (lighting3d.js) and its halo in the glow field (below), so a lamp is three
      // instances and nothing else: the per-lamp group, halo sprite and hidden
      // ground-glow plane (a mesh and a material for each of ~1000 lamps) are gone.
      for (let i = 0; i < lamps.length; i++) {
        const l = lamps[i],
          prop = registerStreetProp('lamp', l.x, l.y);
        placePropInstance(lampPoles, prop, l.x, 17, l.y, 1.1, 34, 1.1);
        placePropInstance(lampArms, prop, l.x + 3, 34, l.y, 7, 1, 1);
        placePropInstance(lampHeads, prop, l.x + 6, 33.5, l.y, 5, 1.2, 3);
        lampGlowPending.push({ x: l.x + 6, z: l.y, prop });
      }
      // @include src/signkit3d.js
      // @include src/signdesigns3d.js
      /**
       * Landmark and business signs. Each business's board is designed for its
       * trade (signdesigns3d.js: bent neon for the clubs, marquee bulbs for the
       * casino and cinema, a lightbox for the hospital, stencilled steel for the
       * armory, weathered planks for the pub...). The painted face is the map;
       * what lights up at night (tubes, bulbs, a lightbox panel, a lamp-washed
       * board) is the emissive mask, whose strength signage3d.js drives with the
       * hour (and the district's power), so it blooms after dark. Shaped boards
       * and free-standing letters are cut out. Behind the face sits one backing
       * mesh: a box for a board, a thin raceway for cut-out letters, a smaller box
       * hidden behind an oval or arch. Street-level boards also spill their colour
       * onto the pavement and the wet road; `options.marquee` (or the design) rings
       * the board with chasing bulbs, and floodlit designs get lamps over the
       * board (signage3d.js places both once every caller has moved its sign).
       * `options.style` is a hint for names the style table does not know
       * ('transit', 'kiosk', 'truck', 'town', 'resort', 'trail').
       */
      const signBoards = [],
        signTexture = (canvas) => {
          const tx = new Three.CanvasTexture(canvas);
          tx.colorSpace = Three.SRGBColorSpace;
          tx.minFilter = Three.LinearMipmapLinearFilter;
          tx.magFilter = Three.LinearFilter;
          tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          return tx;
        };
      function sign(text, x, z, width, color, vertical = false, options = {}) {
        const face = document.createElement('canvas'),
          glowCanvas = document.createElement('canvas');
        face.width = glowCanvas.width = 1024;
        face.height = glowCanvas.height = 256;
        const cg = face.getContext('2d'),
          gg = glowCanvas.getContext('2d');
        gg.fillStyle = '#000';
        gg.fillRect(0, 0, 1024, 256);
        const design = SignArt.paint(cg, gg, 1024, 256, text, color, options.style),
          height = width / 4,
          m = new Three.Mesh(
            new Three.PlaneGeometry(width, height),
            litSignMaterial(signTexture(face), signTexture(glowCanvas), {
              night: design.night,
              day: design.day,
              doubleSided: !design.cutout,
              cutout: design.cutout,
              flicker: design.flicker,
            }),
          );
        // Centred 23 up, but never so low that a wide board sinks into the ground
        // (a 235-wide sign is 59 tall); callers raise facade signs further.
        const signY = Math.max(23, width / 8 + 3);
        m.position.set(x, signY, z + 0.6);
        m.userData.sign = true;
        m.receiveShadow = true;
        scene.add(m);
        const backMat = staticMat(design.backColor, 0.6, 0.3);
        m.userData.backing =
          design.backing === 'raceway'
            ? box(scene, x, signY, z - 0.6, width * 0.82, Math.max(1.2, height * 0.14), 1.6, backMat)
            : design.backing === 'inset'
              ? box(scene, x, signY, z - 1.5, width * 0.68, height * 0.62, 3, backMat)
              : box(scene, x, signY, z - 1.5, width + 3, height + 3, 3, backMat);
        signBoards.push({ mesh: m, width, color: design.light || color, marquee: !!(options.marquee || design.marquee), lamps: design.lamps });
        return m;
      }
      const ph = new Three.Group();
      ph.position.set(phone.x, 0, phone.y);
      scene.add(ph);
      box(ph, 0, 7, 0, 7, 14, 5, mat('#4f7d73', 0.5, 0.45));
      box(ph, 0, 10, 2.8, 5, 7, 0.5, darkMetal);
      box(ph, 0, 12, 3.1, 3, 2, 0.1, mat('#b0c9b1'));
      box(ph, 0, 17, 0, 12, 2, 8, mat('#517c70'));
      halo(ph, 0, 14, 0, 8, '#9bdbb1');
      // @include src/cityscape3d.js
      // Street lamp halos in the glow field: lit after dark, dimmed with the district's
      // power, switched off while a car has the lamp down (damage3d.js sets `visible`).
      for (const p of lampGlowPending) {
        p.prop.halo = glowHandle(addGlow(p.x, 33, p.z, 24, '#ffd99b', 0.55, { day: 0, phase: 0 }));
        // Its reflection smeared down the wet street towards the camera (signage3d.js).
        addStreak(p.x, p.z + 8, 8, 64, '#ffcf96', 0.55);
      }
      lampGlowPending.length = 0;
      // Street signs (after the cityscape: their glow and spill live in signage3d.js).
      sign('ROYAL CINEMA', 948, 1056, 106, '#f6b9cb', false, { marquee: true });
      sign('24 HOUR', 1470, 544, 85, '#f3d394');
      sign('FREIGHT CO.', 2880, 549, 106, '#c1d4bb');
      // @include src/sidejobs3d.js
      // @include src/roadblocks3d.js
      // @include src/themepark3d.js
      // @include src/garage3d.js
      // @include src/landmarks3d.js
      // @include src/civic3d.js
      // @include src/air-cover3d.js
      // @include src/renewal3d.js
      // @include src/landscape3d.js
      // @include src/sports3d.js
      // @include src/transit3d.js
      // @include src/ecology3d.js
      // @include src/world3d.js
      // @include src/wakes3d.js
      // @include src/beach3d.js
      // @include src/county3d.js
      // @include src/base3d.js
      // @include src/airfields3d.js
      // @include src/boats3d.js
      // @include src/drawbridge3d.js
      // @include src/bridges3d.js
      // @include src/harbor3d.js
      // @include src/marina3d.js
      // @include src/beachclub3d.js
      // @include src/cycles3d.js
      // @include src/weather3d.js
      // @include src/crowd3d.js
      // @include src/clouds3d.js
      // @include src/surfaces3d.js
      // @include src/helicopter3d.js
      // @include src/apache3d.js
      // @include src/vehicles3d.js
      // @include src/police3d.js
      // @include src/plane3d.js
      /**
       * A car wheel's chrome rim, hub and spokes merged into one geometry (per side,
       * shared by every car): a car was 50-odd draw calls, 32 of them its wheels.
       * The tyre stays the wheel's first child (damage3d.js hides it on a burnt
       * wreck) and the whole wheel group still turns, bends and sits down on a flat.
       */
      const carRims = new Map();
      function carRimGeometry(side) {
        if (carRims.has(side)) return carRims.get(side);
        const parts = [],
          place = (geo, x, y, z, rx, rz, sx, sy, sz) =>
            parts.push(
              geo.clone().applyMatrix4(
                new Three.Matrix4().compose(
                  new Three.Vector3(x, y, z),
                  new Three.Quaternion().setFromEuler(new Three.Euler(rx, 0, rz)),
                  new Three.Vector3(sx, sy, sz),
                ),
              ),
            );
        place(wheelGeo, 0, 0, side * 1.4, Math.PI / 2, 0, 2.8, 0.3, 2.8);
        for (let s = 0; s < 5; s++) place(boxGeo, 0, 0, side * 1.65, 0, (s * Math.PI) / 5, 0.55, 5, 0.2);
        let vertices = 0,
          indices = 0;
        for (const g of parts) {
          vertices += g.attributes.position.count;
          indices += g.index.count;
        }
        const position = new Float32Array(vertices * 3),
          normal = new Float32Array(vertices * 3),
          uv = new Float32Array(vertices * 2),
          index = new Uint16Array(indices);
        let vo = 0,
          io = 0;
        for (const g of parts) {
          position.set(g.attributes.position.array, vo * 3);
          normal.set(g.attributes.normal.array, vo * 3);
          uv.set(g.attributes.uv.array, vo * 2);
          for (let i = 0; i < g.index.count; i++) index[io++] = g.index.getX(i) + vo;
          vo += g.attributes.position.count;
          g.dispose();
        }
        const rim = new Three.BufferGeometry();
        rim.setAttribute('position', new Three.BufferAttribute(position, 3));
        rim.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        rim.setAttribute('uv', new Three.BufferAttribute(uv, 2));
        rim.setIndex(new Three.BufferAttribute(index, 1));
        rim.computeBoundingSphere();
        // Shared by every car: never disposed with a retired model.
        sharedGeometries.add(rim);
        carRims.set(side, rim);
        return rim;
      }
      function makeVehicle(vehicle) {
        if (vehicle.type === 'bicycle') return makeBicycle(vehicle);
        if (vehicle.type === 'plane') return makePlane(vehicle);
        if (vehicleSpec(vehicle).militaryModel) return makeMilitaryVehicle(vehicle);
        if (vehicleSpec(vehicle).tank) return compactTank(makeTank(vehicle));
        if (vehicle.type === 'helicopter') return vehicle.airframe === 'apache' ? makeApache(vehicle) : makeHelicopter(vehicle);
        if (vehicleSpec(vehicle).bike) return makeMotorcycle(vehicle);
        if (vehicleSpec(vehicle).jetski) return makeJetSki(vehicle);
        if (vehicleSpec(vehicle).boat) return makeBoat(vehicle);
        if (vehicleSpec(vehicle).truck) return makeTruck(vehicle);
        // Patrol cars, roadblock cruisers, the SWAT truck and agents' SUVs (police3d.js).
        if (vehicle.type === 'police' || vehicle.lawUnit === 'swat' || vehicle.lawUnit === 'fed' || vehicle.policeLook) {
          const look = policeLookFor(vehicle);
          if (look) return makePoliceVehicle(vehicle, look);
        }
        const group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        const vehicleDefinition = vehicleSpec(vehicle),
          l = vehicleDefinition.l,
          w = vehicleDefinition.w * 0.87,
          low = ['sport', 'supercar', 'roadster'].includes(vehicle.type),
          open = vehicle.type === 'roadster',
          rodCar = vehicle.type === 'hotrod',
          rally = vehicle.type === 'rally',
          limo = vehicle.type === 'limousine',
          van = ['van', 'suv'].includes(vehicle.type),
          roof = van ? 19 : rally ? 17 : rodCar ? 17 : low ? 11.7 : 14.5,
          h = low ? 7 : 9;
        // Metallic base coat under a glossy clear coat: the sky and street lights
        // slide over the paint as a sharp reflection on top of the coloured sheen.
        const paint = new Three.MeshPhysicalMaterial({
          color: vehicle.color,
          roughness: 0.42,
          metalness: 0.55,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1,
        });
        // The deformable shell and per-pane glasshouse (damage3d.js): shared while
        // pristine, copied the first time the car is dented.
        const shell = mesh(carShellGeometry(l, w, h), paint, body, 0, 0, 0),
          wheels = [],
          bumpers = [],
          nightLights = [],
          lamps = [];
        const cabin = open
          ? box(body, l * 0.14, h + 2.4, 0, 0.7, 5, w * 0.73, carGlass)
          : mesh(
              carCabinGeometry(
                l * (rodCar ? 0.55 : 1),
                w * (rodCar ? 0.88 : 1),
                h - 0.5,
                roof,
                van || rally || limo,
              ),
              carGlass,
              body,
              rodCar ? -l * 0.17 : 0,
              0,
              0,
            );
        if (open) cabin.rotation.z = 0.3;
        if (!open)
          box(
            body,
            l * (rodCar ? -0.19 : van || rally || limo ? -0.135 : -0.06),
            roof + 0.1,
            0,
            l * (rodCar ? 0.25 : van || rally || limo ? 0.55 : 0.26),
            0.7,
            w * 0.7,
            paint,
          );
        if (van) {
          box(body, -l * 0.18, (roof + h) / 2, 0, l * 0.51, roof - h, w * 0.83, paint);
          box(body, -l * 0.47, 11, 0, 0.7, 13, w * 0.74, chrome);
          box(body, -l * 0.482, 11, 0, 0.5, 12, 0.3, darkMetal);
        }
        for (const side of [-1, 1]) {
          const z = side * w * 0.423;
          if (!open && !rodCar) {
            rod(
              body,
              new Three.Vector3(-l * (van || rally || limo ? 0.41 : 0.32), h, z),
              new Three.Vector3(-l * (van || rally || limo ? 0.4 : 0.19), roof, side * w * 0.35),
              0.42,
              paint,
            );
            rod(
              body,
              new Three.Vector3(l * 0.27, h, z),
              new Three.Vector3(l * (van || rally || limo ? 0.13 : 0.07), roof, side * w * 0.35),
              0.45,
              paint,
            );
            rod(
              body,
              new Three.Vector3(-l * 0.055, h, z),
              new Three.Vector3(-l * 0.055, roof, side * w * 0.35),
              0.42,
              darkMetal,
            );
          }
          box(body, -l * 0.1, h - 0.8, side * w * 0.503, l * 0.35, 0.35, 0.25, darkMetal);
          box(body, -l * 0.14, h - 0.6, side * w * 0.515, 3, 0.45, 0.4, chrome);
          box(body, l * 0.09, h + 1.2, side * w * 0.52, 2.1, 1.3, 1.5, paint);
          box(body, -1, 4.7, side * w * 0.51, l * 0.75, 0.5, 0.3, chrome);
          for (const x of [-l * 0.31, l * 0.3]) {
            const wheel = new Three.Group();
            wheel.position.set(x, 4.2, side * (w * 0.46));
            body.add(wheel);
            wheels.push({
              wheel,
              side,
            });
            const tire = mesh(wheelGeo, rubber, wheel, 0, 0, 0, 4.2, 2.6, 4.2);
            tire.rotation.x = Math.PI / 2;
            // Hub and five spokes are one merged chrome rim (one draw, not six).
            mesh(carRimGeometry(side), chrome, wheel, 0, 0, 0);
            const center = mesh(wheelGeo, darkMetal, wheel, 0, 0, side * 1.61, 1, 0.4, 1);
            center.rotation.x = Math.PI / 2;
          }
          lamps.push(
            {
              mesh: box(body, l * 0.47, h - 2, side * w * 0.3, 1.5, 2.5, w * 0.24, warmLamp),
              key: side < 0 ? 'headLeft' : 'headRight',
              lit: warmLamp,
            },
            {
              mesh: box(body, -l * 0.47, h - 2, side * w * 0.3, 1.2, 2, w * 0.22, tailLamp),
              key: side < 0 ? 'tailLeft' : 'tailRight',
              lit: tailLamp,
            },
          );
          nightLights.push(
            halo(body, l * 0.5, h - 2, side * w * 0.3, 11, '#ffe9bd'),
            halo(body, -l * 0.5, h - 2, side * w * 0.3, 7, '#ff5a44'),
          );
        }
        bumpers.push(box(body, l * 0.48, 4.8, 0, 1.1, 1.4, w * 0.78, chrome));
        box(body, l * 0.489, 6.2, 0, 0.4, 2, w * 0.33, darkMetal);
        bumpers.push(box(body, -l * 0.49, 5, 0, 1, 1.4, w * 0.8, chrome));
        box(body, -l * 0.5, 6.5, 0, 0.5, 1.7, 4.5, mat('#dbd3b8'));
        box(body, -l * 0.46, 3.2, -w * 0.3, 2.6, 0.8, 1.3, chrome);
        if (vehicle.type === 'muscle') {
          box(body, l * 0.28, h + 0.45, 0, l * 0.18, 0.8, 4, darkMetal);
          box(body, -l * 0.4, h + 0.6, 0, 2, 1, w * 0.8, paint);
        }
        if (low && !open) {
          box(body, -l * 0.39, h + 3, 0, 3, 0.8, w * 0.97, paint);
          for (const side of [-1, 1])
            box(body, -l * 0.39, h + 1.7, side * w * 0.3, 0.7, 2, 0.7, darkMetal);
        }
        if (vehicle.type === 'taxi') box(body, -1, roof + 1.5, 0, 6, 2.2, 4, mat('#d1c5a2'));
        coachDetails(vehicle, body, l, w, h, roof, paint);
        const hood = box(body, l * 0.34, h + 0.05, 0, l * 0.25, 0.4, w * 0.67, paint);
        const bumperOrigins = bumpers.map((b) => b.position.clone());
        // Wipers along the foot of the windscreen (vehicles3d.js); the glass runs from
        // the cowl (0.27 l, h) up to the roof's leading edge.
        const wiperHost = {};
        if (!open && !rodCar) addWipers(wiperHost, body, l * 0.27, h - 0.5, l * (van || rally || limo ? 0.13 : 0.07), roof, w * 0.4);
        return {
          wipers: wiperHost.wipers,
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          dims: { l, w, h, roof, van },
          shell,
          shellBase: shell.geometry.attributes.position.array,
          cabin,
          cabinBase: open ? null : cabin.geometry.attributes.position.array,
          wheels,
          bumpers,
          bumperOrigins,
          hood,
          hoodBaseY: h + 0.05,
          lamps,
          damageVersion: -1,
          nightLights,
          rearDoors: null,
        };
      }
      /**
       * SNIPER SIGHTS (swat.js): while a rooftop marksman lines up, a red laser runs
       * from his rifle to the player, brightening as the aim settles, and the scope
       * glints. Three beams and glints, made once and reused.
       */
      const sniperSights = [];
      function sniperSightPool() {
        if (sniperSights.length) return sniperSights;
        const glow = document.createElement('canvas');
        glow.width = glow.height = 64;
        const g = glow.getContext('2d'),
          gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.25, 'rgba(255,240,220,0.8)');
        gradient.addColorStop(1, 'rgba(255,200,160,0)');
        g.fillStyle = gradient;
        g.fillRect(0, 0, 64, 64);
        const glintTexture = new Three.CanvasTexture(glow);
        for (let i = 0; i < 3; i++) {
          const beam = new Three.Mesh(
            cylinderGeo,
            new Three.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.5, depthWrite: false, blending: Three.AdditiveBlending }),
          );
          beam.visible = false;
          beam.renderOrder = 5;
          scene.add(beam);
          const glint = new Three.Sprite(
            new Three.SpriteMaterial({ map: glintTexture, color: '#ffffff', transparent: true, depthWrite: false, blending: Three.AdditiveBlending }),
          );
          glint.visible = false;
          scene.add(glint);
          sharedMaterials.add(beam.material);
          sharedMaterials.add(glint.material);
          sniperSights.push({ beam, glint });
        }
        return sniperSights;
      }
      const sniperFrom = new Three.Vector3(),
        sniperTo = new Three.Vector3(),
        sniperAxis = new Three.Vector3(0, 1, 0);
      function updateSniperSights() {
        let n = 0;
        // No laser sights while the snipers are switched off (swat.js SNIPERS_ENABLED).
        const aiming = SNIPERS_ENABLED ? officers.filter((o) => o.roofSniper && o.hp > 0 && o.sniperAim > 0) : [];
        if (!aiming.length && !sniperSights.length) return;
        const pool = sniperSightPool();
        for (const o of aiming) {
          if (n >= pool.length) break;
          const { beam, glint } = pool[n++],
            muzzle = o.a || 0;
          sniperFrom.set(o.x + Math.cos(muzzle) * 9, entityElevation(o) + 11, o.y + Math.sin(muzzle) * 9);
          sniperTo.set(player.x, entityElevation(player) + 9, player.y);
          const length = sniperFrom.distanceTo(sniperTo);
          beam.position.copy(sniperFrom).add(sniperTo).multiplyScalar(0.5);
          beam.quaternion.setFromUnitVectors(sniperAxis, sniperTo.clone().sub(sniperFrom).normalize());
          const width = 0.6 + o.sniperAim * 0.7;
          beam.scale.set(width, length, width);
          beam.material.opacity = 0.25 + o.sniperAim * 0.55;
          beam.visible = true;
          glint.position.copy(sniperFrom);
          const flicker = 0.75 + 0.25 * Math.sin(gameTime * 23 + n);
          glint.scale.setScalar((10 + o.sniperAim * 12) * flicker);
          glint.visible = true;
        }
        for (let i = n; i < pool.length; i++) pool[i].beam.visible = pool[i].glint.visible = false;
      }
      /**
       * PLAYER AT NIGHT
       * No light follows the player (the pool of light that rode at their feet
       * read as an effect, not as a lit street). Only a faint cool rim on the
       * edges turned away from the camera, as moonlight catching the shoulders,
       * keeps their silhouette from dissolving into an unlit street; it follows
       * nightAmount and is gone by day.
       */
      const playerRim = { value: new Three.Color(0, 0, 0) },
        PLAYER_RIM_NIGHT = new Three.Color('#6d80a6');
      function playerRimMaterial(material) {
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.uniforms.cityPlayerRim = playerRim;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 cityPlayerRim;')
            .replace(
              '#include <lights_fragment_end>',
              `#include <lights_fragment_end>
              {
                float rimView = 1.0 - clamp( dot( normal, geometryViewDir ), 0.0, 1.0 );
                totalEmissiveRadiance += cityPlayerRim * rimView * rimView * rimView;
              }`,
            );
        };
        material.customProgramCacheKey = () => 'player-rim';
      }
      /* A body thrown off a bike (riders.js): somersaulting about its hips along
         the flight (`pitch`; forward is negative about the model's lateral axis),
         `z` the hips' height above the road; lying flat once down. */
      function poseThrownBody(m, p, t) {
        const hips = 8.5,
          along = -hips * Math.sin(t.pitch);
        m.group.position.set(
          p.x + Math.cos(t.heading) * along,
          entityElevation(p) + t.z - hips * Math.cos(t.pitch) + 2,
          p.y + Math.sin(t.heading) * along,
        );
        m.group.rotation.set(0, -t.heading, -t.pitch);
        const flying = t.phase === 'air' ? 1 : 0;
        m.parts.arm1.rotation.z = 2.3 - flying * 0.5;
        m.parts['arm-1'].rotation.z = 1.9 + flying * 0.4;
        m.parts.leg1.rotation.z = 0.35 + flying * 0.4;
        m.parts['leg-1'].rotation.z = -0.25 - flying * 0.3;
        m.parts.guns.forEach((g) => (g.visible = false));
      }
      /* 0 at a walk .. 1 at the full run (game.js FOOT_WALK / FOOT_RUN), from how
         fast the player's model has actually been moving. */
      function playerRunAmount(m, p, deltaSeconds) {
        const moved = Math.hypot(p.x - (m.lastX ?? p.x), p.y - (m.lastY ?? p.y));
        m.lastX = p.x;
        m.lastY = p.y;
        if (moved > 40) m.pace = 0;
        else if (deltaSeconds > 0)
          m.pace = (m.pace || 0) + (moved / deltaSeconds - (m.pace || 0)) * (1 - Math.exp(-deltaSeconds * 8));
        return clamp(((m.pace || 0) - FOOT_WALK * 1.3) / (FOOT_RUN * 0.85 - FOOT_WALK * 1.3), 0, 1);
      }
      function makePerson(person, isPlayer) {
        const group = new Three.Group();
        scene.add(group);
        const skin = mat(isPlayer ? '#bb9475' : '#af8b72'),
          cloth = mat(isPlayer ? '#353d4a' : person.color || '#6b5965'),
          pants = mat(isPlayer ? '#536273' : '#343b44'),
          shoe = mat('#18191c'),
          parts = {};
        const torso = box(group, 0, 10, 0, 4.5, 6, 6.5, cloth);
        box(group, -0.5, 10, -3.35, 1.5, 5, 0.25, mat('#171c24'));
        const head = mesh(sphereGeo, skin, group, 0, 15.3, 0, 2, 2.5, 2.1);
        mesh(sphereGeo, mat('#302923'), group, -0.5, 16.5, 0, 1.9, 1.6, 2.13);
        for (const side of [-1, 1]) {
          const leg = new Three.Group();
          leg.position.set(0, 7, side * 1.8);
          group.add(leg);
          box(leg, 0, -2.8, 0, 2, 5.5, 2.5, pants);
          box(leg, 1, -5.3, 0, 3.8, 1.3, 2.6, shoe);
          parts['leg' + side] = leg;
          const arm = new Three.Group();
          arm.position.set(0, 12, side * 4);
          group.add(arm);
          box(arm, 0.3, -2, 0, 1.8, 4.8, 1.8, cloth);
          mesh(sphereGeo, skin, arm, 0.6, -4.3, 0, 1, 1.2, 1);
          parts['arm' + side] = arm;
        }
        // Body, clothes and hair (not the guns) carry the player's faint night rim.
        if (isPlayer) group.traverse((o) => o.material?.isMeshStandardMaterial && playerRimMaterial(o.material));
        const guns = [];
        for (let slot = 0; slot < (isPlayer ? 7 : 1); slot++) {
          const gun = new Three.Group();
          gun.position.set(5, 10, 3.8);
          group.add(gun);
          guns.push(gun);
          gun.visible =
            isPlayer || enemies.includes(person) || gangMembers.includes(person) || !!person.police;
          if (slot === KNIFE_INDEX) {
            box(gun, 0.5, 0, 0, 2.8, 0.9, 0.8, rubber);
            box(gun, 2, 0, 0, 0.35, 1.7, 1.3, darkMetal);
            box(gun, 4, 0, 0, 3.8, 0.22, 0.9, mat('#cbd6dd', 0.25, 0.8));
          }
          if (slot === 0 && !isPlayer && person.rifle) {
            // SWAT and agents carry carbines (pursuit.js).
            box(gun, 3, 0, 0, 7, 1.3, 1.1, darkMetal);
            box(gun, -1.5, -0.4, 0, 3.5, 1.4, 1.1, rubber);
            box(gun, 2.5, -1.8, 0, 1, 2.6, 0.9, darkMetal);
            const barrel = mesh(cylinderGeo, darkMetal, gun, 8.5, 0, 0, 0.3, 5, 0.3);
            barrel.rotation.z = Math.PI / 2;
            // A rooftop marksman's rifle: a long barrel and a scope (swat.js).
            if (person.unit === 'sniper') {
              const long = mesh(cylinderGeo, darkMetal, gun, 13, 0, 0, 0.26, 7, 0.26);
              long.rotation.z = Math.PI / 2;
              const scope = mesh(cylinderGeo, darkMetal, gun, 3.5, 1.6, 0, 0.62, 5, 0.62);
              scope.rotation.z = Math.PI / 2;
            }
          } else if (slot === 0) {
            box(gun, 2, 0, 0, 4.5, 1.1, 0.9, darkMetal);
            box(gun, 0.8, -1, 0, 1, 2, 0.8, rubber);
          }
          if (slot === 1) {
            box(gun, 3, 0, 0, 5, 1.5, 1.1, darkMetal);
            box(gun, 3, -2, 0, 0.8, 3, 1, darkMetal);
            box(gun, -0.5, -0.5, 0, 2, 0.6, 1, rubber);
            const barrel = mesh(cylinderGeo, darkMetal, gun, 7, 0, 0, 0.36, 3, 0.36);
            barrel.rotation.z = Math.PI / 2;
          }
          if (slot === 2) {
            const barrel = mesh(cylinderGeo, darkMetal, gun, 6, 0, 0, 0.32, 10, 0.32);
            barrel.rotation.z = Math.PI / 2;
            box(gun, 0, -0.4, 0, 4, 1, 1.1, wood);
            box(gun, 5, -0.6, 0, 3, 1.1, 1.3, wood);
          }
          if (slot === 4 || slot === 5) {
            box(gun, 3, 0, 0, 7, 1.4, 1.3, darkMetal);
            box(gun, -2, -0.5, 0, 4, 1.6, 1.4, slot === 5 ? wood : rubber);
            box(gun, 2, -2, 0, 1, 3, 1, darkMetal);
            const barrel = mesh(cylinderGeo, darkMetal, gun, 10, 0, 0, 0.3, slot === 5 ? 11 : 7, 0.3);
            barrel.rotation.z = Math.PI / 2;
            if (slot === 5) {
              const scope = mesh(cylinderGeo, darkMetal, gun, 3, 1.8, 0, 0.65, 5, 0.65);
              scope.rotation.z = Math.PI / 2;
            }
          }
          if (slot === 3) {
            const tube = mesh(cylinderGeo, mat('#59644c', 0.65, 0.5), gun, 5, 0, 0, 1.2, 13, 1.2);
            tube.rotation.z = Math.PI / 2;
            const mouth = mesh(cylinderGeo, darkMetal, gun, 11.5, 0, 0, 1.5, 0.7, 1.5);
            mouth.rotation.z = Math.PI / 2;
            box(gun, 3, -1.9, 0, 0.8, 2, 1, darkMetal);
            box(gun, 4, 1.6, 0, 2, 1, 0.6, darkMetal);
          }
        }
        if (person.police && (person.unit === 'swat' || person.unit === 'sniper')) {
          // Helmet, plate carrier with a pale POLICE panel.
          mesh(sphereGeo, mat('#15191e', 0.5, 0.2), group, 0, 16.3, 0, 2.5, 2.1, 2.55);
          box(group, 0.2, 10.3, 0, 5.2, 5.2, 7, mat('#23292f'));
          box(group, -2.7, 11, 0, 0.2, 1.6, 4.6, mat('#c9d3da'));
          box(group, 0, 7.5, 0, 5, 1, 6.7, darkMetal);
          if (person.shield) {
            // Ballistic shield carried on the left arm: black, a viewport, POLICE.
            const shield = new Three.Group();
            shield.position.set(5.6, 9.5, -1.6);
            group.add(shield);
            box(shield, 0, 0, 0, 0.9, 15, 8.5, mat('#161a20', 0.45, 0.3));
            box(shield, 0.5, 4.6, 0, 0.3, 2.2, 4.6, mat('#3d5566', 0.1, 0.6));
            plate(shield, 0.5, -1.5, 0, 7, 1.8, plateMaterial('POLICE', { bg: '#161a20', fg: '#f2f2ea', w: 256, h: 64 }), Math.PI / 2);
            parts.shield = shield;
          }
        } else if (person.police && person.unit === 'soldier') {
          // Army: olive helmet and plate carrier.
          mesh(sphereGeo, mat('#4b5635', 0.8, 0.1), group, 0, 16.3, 0, 2.55, 2.1, 2.6);
          box(group, 0.2, 10.3, 0, 5.2, 5.2, 7, mat('#56603f'));
          box(group, 0, 7.5, 0, 5, 1, 6.7, mat('#3a4130'));
        } else if (person.police && person.unit === 'fed') {
          // Windbreaker with the yellow back panel.
          box(group, -2.35, 11, 0, 0.25, 2, 4.8, mat('#d9b93c'));
          box(group, 0, 7.5, 0, 5, 1, 6.7, darkMetal);
        } else if (person.police) {
          mesh(wheelGeo, mat('#20354b'), group, 0, 17.7, 0, 2.5, 1, 2.5);
          box(group, 1.5, 17.4, 0, 3, 0.4, 4, mat('#162332'));
          box(group, 2.35, 11.5, -1.5, 0.3, 1.8, 1.4, mat('#c7b57a'));
          box(group, 0, 7.5, 0, 5, 1, 6.7, darkMetal);
        }
        if (person.boss || person.guest) {
          const cup = new Three.Group();
          parts.arm1.add(cup);
          cup.position.set(0.6, -4.3, 0);
          mesh(cylinderGeo, glass, cup, 0, -1, 0, 1.6, 3, 1.6);
          mesh(cylinderGeo, mat('#8d2942'), cup, 0, -1.2, 0, 1.3, 1.7, 1.3);
          cup.visible = false;
          parts.cup = cup;
        }
        parts.guns = guns;
        const model = {
          group,
          parts,
          torso,
          isPlayer,
          cloth,
          pants,
        };
        // Fort Sentinel soldiers: helmet, plate carrier, carbine (base3d.js).
        if (person.military) dressSoldier(person, model);
        return model;
      }
      // @include src/parachute3d.js
      const playerRing = new Three.Mesh(
        new Three.RingGeometry(10, 11.2, 36),
        new Three.MeshBasicMaterial({
          color: '#c9e29f',
          transparent: true,
          opacity: 0.5,
          side: Three.DoubleSide,
          depthWrite: false,
        }),
      );
      playerRing.rotation.x = -Math.PI / 2;
      scene.add(playerRing);
      const objectiveRing = new Three.Mesh(
        new Three.RingGeometry(27, 29, 48),
        new Three.MeshBasicMaterial({
          color: '#ebd297',
          transparent: true,
          opacity: 0.8,
          side: Three.DoubleSide,
          depthWrite: false,
        }),
      );
      objectiveRing.rotation.x = -Math.PI / 2;
      scene.add(objectiveRing);
      const arrowGroup = new Three.Group();
      const arrowMat = new Three.MeshBasicMaterial({
        color: '#ffe2a2',
        depthTest: false,
        depthWrite: false,
      });
      const cone = mesh(new Three.ConeGeometry(6, 10, 4), arrowMat, arrowGroup, 0, 0, 0);
      cone.rotation.z = Math.PI;
      cone.renderOrder = 99;
      scene.add(arrowGroup);
      const targetLight = new Three.PointLight('#ffd083', 0.5, 90, 1);
      scene.add(targetLight);
      const playerHeadlight = new Three.SpotLight('#ffe6b4', 900, 210, Math.PI * 0.23, 0.7, 1.1);
      playerHeadlight.position.set(0, 10, 0);
      scene.add(playerHeadlight, playerHeadlight.target);
      const muzzleLight = new Three.PointLight('#ffc67a', 0, 95, 1.5);
      scene.add(muzzleLight);
      const smokeCanvas = document.createElement('canvas');
      smokeCanvas.width = smokeCanvas.height = 128;
      const sm = smokeCanvas.getContext('2d');
      for (let i = 0; i < 28; i++) {
        const x = 64 + Math.sin(i * 2.4) * 34,
          y = 64 + Math.cos(i * 1.7) * 34,
          r = 14 + (i % 7) * 3,
          gr = sm.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, '#ffffff55');
        gr.addColorStop(1, '#ffffff00');
        sm.fillStyle = gr;
        sm.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const smokeTx = new Three.CanvasTexture(smokeCanvas);
      const flameCanvas = document.createElement('canvas');
      flameCanvas.width = 64;
      flameCanvas.height = 128;
      const fg = flameCanvas.getContext('2d');
      for (let i = 0; i < 9; i++) {
        const x = 32 + Math.sin(i * 2.4) * 11,
          y = 88 - i * 7,
          r = 21 - i * 1.5,
          gr = fg.createRadialGradient(x, y, 1, x, y, r);
        gr.addColorStop(0, i < 3 ? '#fff5ca' : '#ffbb65');
        gr.addColorStop(0.45, '#ff8313c0');
        gr.addColorStop(1, '#dd3b0000');
        fg.fillStyle = gr;
        fg.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const flameTx = new Three.CanvasTexture(flameCanvas);
      flameTx.colorSpace = Three.SRGBColorSpace;
      const smokeMat = new Three.SpriteMaterial({
        map: smokeTx,
        color: '#8b8b8f',
        transparent: true,
        depthWrite: false,
      });
      const blastRings = Array.from(
        {
          length: 10,
        },
        () => {
          const m = new Three.Mesh(
            new Three.RingGeometry(0.82, 1, 48),
            new Three.MeshBasicMaterial({
              color: '#e7d0a6',
              transparent: true,
              opacity: 0,
              side: Three.DoubleSide,
              depthWrite: false,
            }),
          );
          m.rotation.x = -Math.PI / 2;
          m.visible = false;
          scene.add(m);
          return m;
        },
      );
      let blastRingIndex = 0;
      const flamePool = Array.from(
        {
          length: 72,
        },
        () => {
          const s = new Three.Sprite(
            new Three.SpriteMaterial({
              map: flameTx,
              transparent: true,
              depthWrite: false,
              blending: Three.AdditiveBlending,
            }),
          );
          s.visible = false;
          scene.add(s);
          return s;
        },
      );
      const fireLights = Array.from(
        {
          length: 4,
        },
        () => {
          const light = new Three.PointLight('#ff9f4b', 0, 180, 1.5);
          scene.add(light);
          return light;
        },
      );
      const scorchMeshes = Array.from(
        {
          length: 36,
        },
        () => {
          const m = new Three.Mesh(
            new Three.PlaneGeometry(1, 1),
            new Three.MeshBasicMaterial({
              map: smokeTx,
              color: '#07090b',
              transparent: true,
              opacity: 0.75,
              depthWrite: false,
            }),
          );
          m.rotation.x = -Math.PI / 2;
          m.visible = false;
          m.renderOrder = 2;
          scene.add(m);
          return m;
        },
      );
      const bloodDropCanvas = document.createElement('canvas');
      bloodDropCanvas.width = bloodDropCanvas.height = 32;
      const dropCtx = bloodDropCanvas.getContext('2d');
      dropCtx.fillStyle = '#ffffff';
      dropCtx.beginPath();
      dropCtx.ellipse(16, 16, 9, 13, 0.25, 0, TAU);
      dropCtx.fill();
      const bloodDropTx = new Three.CanvasTexture(bloodDropCanvas);
      const particlePool = Array.from(
        {
          length: 480,
        },
        () => {
          const s = new Three.Sprite(smokeMat.clone());
          s.visible = false;
          scene.add(s);
          return s;
        },
      );
      const tracerGeo = new Three.BufferGeometry(),
        tracerPositions = new Float32Array(3600);
      tracerGeo.setAttribute(
        'position',
        new Three.BufferAttribute(tracerPositions, 3).setUsage(Three.DynamicDrawUsage),
      );
      const tracer = new Three.LineSegments(
        tracerGeo,
        new Three.LineBasicMaterial({
          color: '#ffe1a1',
          transparent: true,
          opacity: 0.85,
        }),
      );
      scene.add(tracer);
      const skidGeo = new Three.BufferGeometry(),
        skidPos = new Float32Array(6600);
      skidGeo.setAttribute(
        'position',
        new Three.BufferAttribute(skidPos, 3).setUsage(Three.DynamicDrawUsage),
      );
      const skidLines = new Three.LineSegments(
        skidGeo,
        new Three.LineBasicMaterial({
          color: '#171b20',
          transparent: true,
          opacity: 0.5,
        }),
      );
      scene.add(skidLines);
      let muzzleUntil = 0,
        frames = 0,
        nightAmount = 0;
      // Dynamic models own their cloned/new resources; the initial world and factory primitives persist.
      const sharedGeometries = new Set([boxGeo, sphereGeo, wheelGeo, cylinderGeo]),
        sharedMaterials = new Set();
      function collectResources(root, geometries, materials) {
        root.traverse((o) => {
          if (o.geometry) geometries.add(o.geometry);
          if (Array.isArray(o.material)) for (const material of o.material) materials.add(material);
          else if (o.material) materials.add(o.material);
        });
      }
      collectResources(scene, sharedGeometries, sharedMaterials);
      const retiredGeometries = new Set(),
        retiredMaterials = new Set();
      // Models whose entity is no longer in `list` are retired. The check set is
      // reused frame to frame rather than built afresh.
      const pruneActive = new Set();
      // Parsed colours for the effect sprites: a CSS colour string is parsed once,
      // not for every sprite on every frame.
      const parsedColors = new Map();
      function cachedColor(value) {
        let color = parsedColors.get(value);
        if (!color) {
          color = new Three.Color(value);
          if (parsedColors.size < 512) parsedColors.set(value, color);
        }
        return color;
      }
      // New vehicle and person models built per frame (see the vehicle pass).
      const NEW_MODELS_PER_FRAME = 6;
      let newModelsThisFrame = 0;
      // Individually modelled people this frame (reused list).
      const renderPeople = [];
      function pruneModels(models, list) {
        pruneActive.clear();
        for (let i = 0; i < list.length; i++) pruneActive.add(list[i]);
        for (const [entity, model] of models)
          if (!pruneActive.has(entity)) {
            const group = model.group || model;
            scene.remove(group);
            collectResources(group, retiredGeometries, retiredMaterials);
            models.delete(entity);
          }
      }
      // Finding what is still in use walks the whole scene (~15,000 objects), so
      // retired models are let go in batches every few seconds rather than on the
      // frame each car or person is removed (traffic comes and goes constantly).
      let lastModelDisposal = -Infinity;
      function disposeRetiredModels() {
        if (!retiredGeometries.size && !retiredMaterials.size) return;
        const now = performance.now();
        if (now - lastModelDisposal < 3000 && retiredGeometries.size + retiredMaterials.size < 400) return;
        lastModelDisposal = now;
        const liveGeometries = new Set(sharedGeometries),
          liveMaterials = new Set(sharedMaterials);
        collectResources(scene, liveGeometries, liveMaterials);
        for (const geometry of retiredGeometries) if (!liveGeometries.has(geometry)) geometry.dispose();
        for (const material of retiredMaterials) if (!liveMaterials.has(material)) material.dispose();
        retiredGeometries.clear();
        retiredMaterials.clear();
      }
      /**
       * BAKED CANVAS RELEASE
       * The painted ground sheets (the city sheet alone is ~29 megapixels, over
       * 110 MB as a canvas; the county, Sunset Pier and Fort Sentinel tiles add
       * ~70 MB) are uploaded to the GPU once and never repainted. Once a sheet's
       * texture is on the GPU its canvas is shrunk to a pixel, which frees the
       * bitmap; the texture keeps its GPU copy (nothing bumps its version again).
       */
      const bakedCanvases = [groundTx, roughTx, ...countyGroundMaterials.map((m) => m.map)].filter((t) => t && t.image);
      function releaseBakedCanvases() {
        for (let i = bakedCanvases.length - 1; i >= 0; i--) {
          const texture = bakedCanvases[i],
            uploaded = renderer.properties.get(texture);
          if (!uploaded.__webglTexture || uploaded.__version !== texture.version) continue;
          texture.image.width = texture.image.height = 1;
          bakedCanvases.splice(i, 1);
        }
      }
      /**
       * SHADER PREWARM
       * A material's program is otherwise compiled the first time it is drawn:
       * a hitch each time a new district, vehicle or effect comes into view. While
       * the title screen is up, the scene's programs are compiled a slice at a time
       * (a few milliseconds per task, so the menu stays smooth) with the HDR target
       * bound, so the programs match the ones the scene pass will ask for, and
       * each is linked once KHR_parallel_shader_compile reports it ready, so the
       * driver does the work in the background (only where that extension exists).
       */
      function prewarmShaders() {
        const queue = [...scene.children],
          slice = new Three.Object3D(),
          // Programs compiled but not yet linked. compile() only starts the work:
          // three.js links a program (the blocking part, ~0.1-0.3 s each on a
          // software rasteriser) the first time it is drawn. Reading its uniforms
          // here does that link now, one or two per slice while the menu is up,
          // and with KHR_parallel_shader_compile only once the driver reports the
          // program ready, so it never blocks at all.
          unlinked = new Set();
        // Without KHR_parallel_shader_compile every link blocks the main thread,
        // and linking every material's program up front (most are never on screen
        // together) cost far more than it saved: there, programs link when first
        // drawn, as before.
        if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
        const step = () => {
          const started = performance.now(),
            previous = renderer.getRenderTarget();
          if (hdrCapable && postTier) renderer.setRenderTarget(sceneTarget);
          while (queue.length && performance.now() - started < 6) {
            // Compile ~40 top-level objects per call: compile() walks the whole
            // scene for its lights each time.
            slice.children = queue.splice(0, 40);
            try {
              for (const material of renderer.compile(slice, camera, scene)) {
                const program = renderer.properties.get(material).currentProgram;
                if (program) unlinked.add(program);
              }
            } catch (error) {
              queue.length = 0;
            }
          }
          slice.children = [];
          renderer.setRenderTarget(previous);
          for (const program of unlinked) {
            if (performance.now() - started > 12) break;
            if (!program.isReady()) continue;
            program.getUniforms();
            unlinked.delete(program);
          }
          if (queue.length || unlinked.size) setTimeout(step, 30);
        };
        setTimeout(step, 1500);
      }
      const viewFrustum = new Three.Frustum(),
        viewProjection = new Three.Matrix4(),
        entityBounds = new Three.Sphere();
      function entityInView(entity, radius = 35) {
        entityBounds.center.set(entity.x, entityElevation(entity) + radius * 0.25, entity.y);
        entityBounds.radius = radius;
        return viewFrustum.intersectsSphere(entityBounds);
      }
      const api = {
        // bulletHole, structureBlast, structureImpact, groundStain, sparks, damageInfo.
        ...damageApi,
        /**
         * Settings contract: the see-through hole round the player under a roof
         * (lighting3d.js, CUTAWAY). On by default; read at start-up from
         * localStorage 'dead-end-city-cutaway' ('off' disables). The settings
         * menu saves that key and calls this to apply it at once.
         */
        setCharacterCutaway(on) {
          setCharacterCutaway(on);
        },
        info() {
          let objects = 0;
          const byType = {};
          scene.traverse((o) => {
            objects++;
            const k = o.type + (o.isMesh && Array.isArray(o.material) ? '[multi]' : '');
            byType[k] = (byType[k] || 0) + 1;
          });
          return {
            byType,
            // Scene pass (plus the shadow pass on frames that refresh it).
            calls: frameStats.sceneCalls,
            triangles: frameStats.sceneTriangles,
            shadowFrame: frameStats.shadowFrame,
            viewCalls: frameStats.viewCalls,
            shadowCalls: frameStats.shadowCalls,
            frameCalls: frameStats.totalCalls,
            objects,
            batched: api.batchReport,
            // Linked shader programs (each one is a compile hitch the first time).
            programs: renderer.info.programs?.length ?? null,
          };
        },
        /**
         * Where this frame's scene draw calls go: every drawable the camera would
         * draw (visible, on an enabled layer, inside the frustum), counted by the
         * name of its nearest named ancestor and by 512-unit cell. For hunting
         * unbatched scenery; DeadEndCity.drawProfile() prints the top entries.
         */
        drawProfile(top = 15) {
          const byName = new Map(),
            byCell = new Map(),
            sphere = new Three.Sphere(),
            roles = new Map();
          for (const m of carModels.values()) roles.set(m.group, 'vehicle');
          for (const m of personModels.values()) roles.set(m.group || m, 'person');
          let total = 0;
          const visit = (o) => {
            if (!o.visible || !o.layers.test(camera.layers)) return;
            if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && o.material) {
              let inView = !o.frustumCulled;
              if (!inView) {
                if (o.isSprite) sphere.set(o.getWorldPosition(new Three.Vector3()), 20);
                else {
                  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
                  sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
                }
                inView = viewFrustum.intersectsSphere(sphere);
              }
              if (inView) {
                const calls = Array.isArray(o.material) ? Math.max(1, o.geometry.groups.length) : 1;
                let named = o,
                  root = o;
                // (A cell group of STATIC CELLS / STATIC BATCH CELLS counts as the scene.)
                const top = (p) => p === scene || p.userData.cellContainer;
                while (named && !named.name && named.parent && !top(named.parent)) named = named.parent;
                while (root.parent && !top(root.parent)) root = root.parent;
                if (roles.has(root)) named = { name: roles.get(root), type: '' };
                else if (!named.name && root !== o)
                  named = {
                    // Unnamed parts of an unnamed group: say what they are, so the
                    // unbatched ones (transparent, multi-material, signs) stand out.
                    name:
                      'group@' + Math.round(root.position.x) + ',' + Math.round(root.position.z) +
                      ' [' + (o.geometry?.type || o.type) + ' ' + (Array.isArray(o.material) ? 'multi' : o.material.type) +
                      (o.material.transparent ? ' transparent' : '') + (o.userData.sign ? ' sign' : '') +
                      (o.material.color ? ' #' + o.material.color.getHexString() : '') + ']',
                    type: '',
                  };
                const material = Array.isArray(o.material) ? o.material[0] : o.material;
                // Static batches by what they are made of (which materials fail to share).
                if (o.name === 'static batch' || o.name === 'far scenery')
                  named = {
                    name:
                      o.name + ' [' + material.type + (material.color ? ' #' + material.color.getHexString() : '') +
                      (material.map ? ' map' : '') + (material.emissiveMap ? ' lit' : '') +
                      (material.vertexColors ? ' vc' : '') + ']',
                    type: '',
                  };
                const key =
                    (named.name || o.type + ' ' + (o.geometry?.type || '') + ' ' + material.type) +
                    (named === o ? '' : ' in ' + (named.name || named.type)) +
                    (o.isSprite ? ' (sprite)' : ''),
                  p = o.getWorldPosition(new Three.Vector3()),
                  cell = Math.floor(p.x / 512) * 512 + ',' + Math.floor(p.z / 512) * 512;
                byName.set(key, (byName.get(key) || 0) + calls);
                byCell.set(cell, (byCell.get(cell) || 0) + calls);
                total += calls;
              }
            }
            for (const c of o.children) visit(c);
          };
          visit(scene);
          const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
          // Shader programs by material type (fewer variants, fewer compile hitches).
          const programs = new Map();
          for (const p of renderer.info.programs || []) {
            const kind = p.name || String(p.cacheKey).split(',')[0].slice(0, 40);
            programs.set(kind, (programs.get(kind) || 0) + 1);
          }
          return { total, byName: sorted(byName), byCell: sorted(byCell), programs: sorted(programs) };
        },
        // Developer view of the post-processing inputs: 'ao', 'bloom' or nothing.
        postView(mode) {
          postCompositeUniforms.uDebugView.value = mode === 'ao' ? 1 : mode === 'bloom' ? 2 : mode === 'depth' ? 3 : 0;
          return mode || 'image';
        },
        // Switch graphics quality tier (quality.js) at runtime.
        setQuality(tier) {
          applyRendererQuality(tier);
          api.resize();
        },
        quality: () => ({
          tier: activeTier?.name,
          gpu: graphicsGpuName,
          hdr: hdrCapable,
          shadowMap: renderer.shadowMap.enabled ? sun.shadow.mapSize.x : 0,
          pixelRatio: renderer.getPixelRatio(),
          renderScale: hdrCapable ? renderScale : 1,
        }),
        // Dynamic resolution (quality.js ADAPTIVE QUALITY); returns the scale applied.
        setRenderScale: (scale) => (hdrCapable ? setRenderScale(scale) : 1),
        resize() {
          renderer.setSize(viewportWidth, viewportHeight);
          const viewH = clamp(viewportHeight * 0.68, 430, 630) / worldZoom;
          streetCamera.left = (-viewH * viewportWidth) / viewportHeight / 2;
          streetCamera.right = (viewH * viewportWidth) / viewportHeight / 2;
          streetCamera.top = viewH / 2;
          streetCamera.bottom = -viewH / 2;
          streetCamera.updateProjectionMatrix();
        },
        project(mapX, mapY, elevation = 0) {
          const v = new Three.Vector3(mapX, elevation, mapY).project(camera);
          return {
            x: (v.x * 0.5 + 0.5) * viewportWidth,
            y: (-0.5 * v.y + 0.5) * viewportHeight,
          };
        },
        aim(mx, my) {
          ray.setFromCamera(
            new Three.Vector2((mx / viewportWidth) * 2 - 1, (-my / viewportHeight) * 2 + 1),
            camera,
          );
          groundPlane.constant = -9 - entityElevation(player);
          if (ray.ray.intersectPlane(groundPlane, hitPoint))
            return Math.atan2(hitPoint.z - player.y, hitPoint.x - player.x);
          return player.a;
        },
        // The map point under the screen point (mx, my) on a level plane at
        // `elevation` (the Apache's aim, apache.js); null when the ray misses it.
        groundPoint(mx, my, elevation = 0) {
          ray.setFromCamera(new Three.Vector2((mx / viewportWidth) * 2 - 1, (-my / viewportHeight) * 2 + 1), camera);
          groundPlane.constant = -elevation;
          return ray.ray.intersectPlane(groundPlane, hitPoint) ? { x: hitPoint.x, y: hitPoint.z } : null;
        },
        // A rocket motor's flame and a puff of its smoke trail at a point in the
        // air (apache.js; `motor` 1 while it burns, less as it coasts).
        smokePuff(x, z, altitude = 0, motor = 1) {
          const y = altitude + 9;
          if (motor >= 1)
            fx.push({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.06, max: 0.06, color: '#ffd28a', size: 7, glow: true });
          fx.push({
            x: x + randomBetween(-1.5, 1.5),
            y,
            z: z + randomBetween(-1.5, 1.5),
            vx: randomBetween(-4, 4),
            vy: randomBetween(2, 7),
            vz: randomBetween(-4, 4),
            life: 1.4 * motor + 0.4,
            max: 1.4 * motor + 0.4,
            color: '#c9c6bb',
            size: 4 + motor * 2,
            smoke: true,
          });
        },
        fire(x, z, a, rocket, altitude = 0) {
          muzzleUntil = gameTime + 0.055;
          muzzleLight.position.set(x, 11 + altitude, z);
          muzzleLight.intensity = rocket ? 1250 : 760;
          for (let j = 0; j < 4; j++)
            fx.push({
              x: x + Math.cos(a) * j * 3,
              y: 11 + altitude,
              z: z + Math.sin(a) * j * 3,
              vx: Math.cos(a) * 65,
              vy: 5,
              vz: Math.sin(a) * 65,
              life: 0.045,
              max: 0.045,
              color: j ? '#ffa33a' : '#fff6d2',
              size: rocket ? 18 : 7 - j,
              glow: true,
            });
          if (!rocket) {
            fx.push({
              x,
              y: 11 + altitude,
              z,
              vx: -Math.sin(a) * 42,
              vy: 44,
              vz: Math.cos(a) * 42,
              life: 0.65,
              max: 0.65,
              color: '#caa55e',
              size: 1.5,
              case: true,
            });
            fx.push({
              x,
              y: 11 + altitude,
              z,
              vx: Math.cos(a) * 15,
              vy: 13,
              vz: Math.sin(a) * 15,
              life: 0.36,
              max: 0.36,
              color: '#aab4b8',
              size: 5,
              smoke: true,
            });
          }
        },
        impact(x, z, kind, altitude = 0) {
          impactEffect(x, z, kind, altitude);
        },
        explosion(x, z, power = 1, altitude = terrainHeight(x, z)) {
          const ring = blastRings[blastRingIndex++ % blastRings.length];
          ring.position.set(x, altitude + 0.38, z);
          ring.userData = {
            born: gameTime,
            power,
          };
          ring.visible = true;
          for (let j = 0; j < 66; j++) {
            const a = Math.random() * TAU,
              s = (25 + Math.random() * 170) * power,
              glow = j < 20;
            const life = glow ? 0.22 + Math.random() * 0.65 : 1.8 + Math.random() * 2.7;
            fx.push({
              x: x + Math.cos(a) * 5,
              y: altitude + 6,
              z: z + Math.sin(a) * 5,
              vx: Math.cos(a) * s,
              vy: glow ? 25 + Math.random() * 75 : 30 + Math.random() * 38,
              vz: Math.sin(a) * s,
              life,
              max: life,
              color: glow ? (j < 5 ? '#fff2bf' : '#ff8c31') : j % 2 ? '#3c4147' : '#656970',
              size: (glow ? 14 : 22) * power,
              glow,
              smoke: !glow,
            });
          }
          for (let j = 0; j < 16; j++) {
            const a = Math.random() * TAU;
            fx.push({
              x,
              y: altitude + 12,
              z,
              vx: Math.cos(a) * randomBetween(80, 180),
              vy: randomBetween(70, 180),
              vz: Math.sin(a) * randomBetween(80, 180),
              life: 1.6,
              max: 1.6,
              color: '#ab9e81',
              size: randomBetween(1, 3),
              case: true,
            });
          }
          if (
            distanceBetween(
              {
                x,
                y: z,
              },
              player,
            ) < 700
          ) {
            muzzleLight.position.set(x, altitude + 20, z);
            muzzleLight.intensity = 1900 * power;
            muzzleUntil = gameTime + 0.18;
          }
        },
        render() {
          const deltaSeconds = Math.min(0.04, Math.max(0, gameTime - lastVisualTime));
          lastVisualTime = gameTime;
          // Split CPU timings of the frame for DeadEndCity.stats() (`r:` parts).
          let lap = performance.now();
          nightAmount = clamp(1 - daylight() * 1.6, 0, 1);
          updateCivicVisuals();
          // A boat passing under a road bridge is dropped 30 units below the deck
          // (boatSurfaceElevation, air-cover.js) so it slips under the roadway. The
          // camera, the shadow fit and the cutaway stay on the water: following that
          // drop jolted the whole view down and back up again at each bridge.
          const altitude = player.car && isBoat(player.car) ? 0 : entityElevation(player.car || player),
            flying = !!(isAircraft(player.car) || player.parachute);
          // Street (orthographic) or flight (perspective) camera, plus what it sees.
          updateFlightView(deltaSeconds, altitude, flying);
          // Riding the Falcon or the Eye: the ride camera takes over (themepark3d.js).
          updateParkCamera(deltaSeconds);
          camera.position.x += (Math.random() - 0.5) * shake * 0.35;
          camera.position.y += (Math.random() - 0.5) * shake * 0.2;
          camera.updateMatrixWorld(true);
          viewFrustum.setFromProjectionMatrix(
            viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
          );
          // Weather runs after the time-of-day pass so it modifies that day's light
          // rather than being overwritten by it; the clouds need the final camera.
          lap = profileLap('r:camera', lap);
          updateWeatherVisuals(deltaSeconds);
          updateLighting(deltaSeconds);
          updateSurfaces(deltaSeconds);
          applyAerialFog();
          updateCloudVisuals(deltaSeconds);
          lap = profileLap('r:sky', lap);
          updateTransitVisuals();
          updateWildlifeVisuals(deltaSeconds);
          updateSportsVisuals(deltaSeconds);
          updateGarageVisuals();
          updateWorldVisuals();
          updateCityscapeVisuals();
          updateSideJobVisuals();
          updateRoadblockVisuals();
          updateParkVisuals();
          updateCountyVisuals();
          updateHarborVisuals();
          updateMarinaVisuals(deltaSeconds);
          updateMissionVisuals();
          lap = profileLap('r:scenery', lap);
          placeSun();
          updateFarScenery();
          // Scenery groups inside the visible ground footprint (flight-view3d.js);
          // small ones drop out once they would only be a few pixels across. Most
          // hang from a cell group (STATIC CELLS): a cell out of reach is hidden
          // whole and its groups are not visited at all.
          for (const cell of staticCells) {
            const show =
              Math.abs(cell.x - viewCenter.x) < viewReach + cell.reach &&
              Math.abs(cell.y - viewCenter.y) < viewReach + cell.reach;
            cell.group.visible = show;
            if (!show) continue;
            for (const s of cell.entries) s.group.visible = staticInView(s);
          }
          for (const s of looseStatics) s.group.visible = staticInView(s);
          for (let i = celledStatics; i < statics.length; i++) statics[i].group.visible = staticInView(statics[i]);
          // Whole cells of merged scenery out of reach (STATIC BATCH CELLS).
          const batchReach = viewReach + STATIC_BATCH_SHADOW_MARGIN;
          for (const cell of staticBatchCells.values())
            cell.group.visible =
              Math.abs(cell.x - viewCenter.x) < batchReach + cell.half &&
              Math.abs(cell.z - viewCenter.y) < batchReach + cell.half;
          // Signals are re-placed from their groups' visibility: after the cull, or a
          // junction coming into view drew its posts and bulbs a frame late (lights
          // popping in at the edge of the frame as the camera moved).
          updateTrafficVisuals();
          // Anything between the camera and the player is cut away round them
          // (lighting3d.js, CUTAWAY).
          updateCutaway(altitude);
          lap = profileLap('r:lod', lap);
          // Pedestrians are drawn by the instanced crowd (src/crowd3d.js), poses and
          // all; guards, gangs, officers, story actors and the player keep
          // individual models for their weapons and uniforms.
          const people = renderPeople;
          people.length = 0;
          for (const list of [enemies, gangMembers, officers, storyActors]) for (let i = 0; i < list.length; i++) people.push(list[i]);
          people.push(player);
          updateCrowd3D(deltaSeconds);
          lap = profileLap('r:crowd', lap);
          pruneModels(carModels, vehicles);
          pruneModels(personModels, people);
          pruneModels(pickupModels, pickups);
          newModelsThisFrame = 0;
          beginVehicleImpostors();
          for (const c of vehicles) {
            let m = carModels.get(c);
            const near =
              c === player.car ||
              entityInView(c, Math.max(65, Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) * 0.75));
            // High above the city, traffic is drawn as instanced boxes (flight-view3d.js).
            if (near && vehicleImpostor(c)) {
              if (m) m.group.visible = false;
              continue;
            }
            if (!m && !near) continue;
            if (!m) {
              // Building a car is a few dozen meshes: a view full of new traffic (a
              // teleport, a fast drive into a new street) is spread over a few
              // frames instead of one long one. The player's own is never held back.
              if (newModelsThisFrame >= NEW_MODELS_PER_FRAME && c !== player.car) continue;
              newModelsThisFrame++;
              m = makeVehicle(c);
              carModels.set(c, m);
              trimShadowCasters(m.group, 4);
            }
            m.group.visible = near;
            if (!near) continue;
            // Suspension: weight transfer, the hop after a blast, a sag onto a flat (damage3d.js).
            const stance = vehiclePose(c);
            m.group.position.set(c.x, 0.1 + entityElevation(c) + stance.lift, c.y);
            m.group.rotation.y = -c.a;
            m.body.rotation.x =
              (c === player.car ? clamp(normalizeAngle(c.a - (c.moveA ?? c.a)) * -0.15, -0.05, 0.05) : 0) +
              stance.roll;
            m.body.rotation.z =
              Math.sin(gameTime * 7 + c.id) * Math.min(0.008, Math.abs(c.speed) * 0.00002) + stance.pitch;
            if (c.type === 'flatbed') {
              if (!m.cargo) {
                m.cargo = Array.from(
                  {
                    length: 3,
                  },
                  (_, i) => {
                    const g = makeCargoCrate(m.body, 18);
                    g.position.set(-34 + i * 19, 8, 0);
                    return g;
                  },
                );
              }
              m.cargo.forEach((g, i) => (g.visible = i < (c.cargoCount || 0)));
            }
            if (m.nightLights) {
              // Drawn together by the instanced halo pass (VEHICLE HALOS), not one
              // sprite draw call each.
              // Lamps on at night and in heavy rain (weather3d.js).
              // Brake lights glow by day too: from above the lamp itself is a sliver.
              const lampsOn = vehicleLampAmount(),
                driven = c.hp > 0 && (c.ai || c === player.car),
                lit = driven && lampsOn > 0.25,
                braking = driven && !!c.braking;
              for (let k = 0; k < m.nightLights.length; k++) {
                const sprite = m.nightLights[k];
                sprite.visible = false;
                if (m.lampOut?.[k]) continue;
                if (k % 2 && braking) queueVehicleHalo(sprite, Math.max(0.75, lampsOn));
                else if (lit) queueVehicleHalo(sprite, (k % 2 ? 0.55 : 0.85) * lampsOn);
              }
            }
            // Brake lights: tail lamps that aren't broken swap material while braking.
            const braking = !!c.braking && c.hp > 0;
            if (m.lamps && m.brakeLit !== braking) {
              m.brakeLit = braking;
              for (const lamp of m.lamps)
                if (lamp.lit === tailLamp && !c.damage?.lights?.[lamp.key]) lamp.mesh.material = braking ? brakeLamp : tailLamp;
            }
            // Windscreen wipers in the rain (vehicles3d.js).
            if (m.wipers) updateWipers(c, m, deltaSeconds);
            const wear = clamp(1 - c.hp / c.maxhp, 0, 1);
            paintVehicle(c, m);
            // The player's cranks turn at their pedalling cadence (still when
            // coasting); anyone else's follow road speed.
            if (m.crank)
              m.crank.rotation.z -=
                deltaSeconds * (c === player.car ? pedalCadence() * Math.PI * 2 : c.speed * 0.13);
            if (m.helicopter) {
              const running =
                (c === player.car ||
                  c.airUnit ||
                  (c.abandonedFlight && entityElevation(c) > terrainHeight(c.x, c.y) + 2)) &&
                c.hp > 0;
              m.rotor.rotation.y += deltaSeconds * (running ? 55 : 2);
              m.tail.rotation.z += deltaSeconds * (running ? 90 : 2);
              m.disc.visible = running;
              m.body.rotation.z = clamp(-c.speed * 0.00035, -0.13, 0.13);
              m.body.rotation.x = clamp(c.av * 0.065, -0.1, 0.1);
              m.canopy.material.roughness = 0.12 + wear * 0.65;
              // The Apache's chin gun and lights (apache3d.js).
              if (m.apache) animateApache(c, m);
            } else if (m.damageVersion !== c.damageVersion) {
              // Crumple, panels, glass, lamps and tyres follow the damage data (damage3d.js).
              m.damageVersion = c.damageVersion;
              applyVehicleDamage(c, m);
              m.brakeLit = null; // lamp materials were reset: re-apply brake lights
            }
            // Control surfaces, gear, propeller, lights and buffet (plane3d.js).
            if (m.plane) animateAircraft(c, m, deltaSeconds);
            if (m.tank) {
              m.turret.rotation.y = -normalizeAngle((c.turretA ?? c.a) - c.a);
              m.barrel.position.x = (-Math.max(0, (c.cannonRecoilUntil || 0) - gameTime) / 0.25) * 4;
            }
            if (m.special) {
              if (!m.plane) m.body.rotation.z = -wear * 0.025 + stance.pitch;
              if (m.bike) {
                // Leaning into the turn, or down on its side after a crash (riders.js).
                m.body.rotation.x = c.fallen ? c.fallen.roll : clamp(c.av * 0.13, -0.28, 0.28);
                m.rider.visible = c.hp > 0 && (c === player.car || c.ai);
              }
              if (m.jetski) m.rider.visible = c === player.car && c.hp > 0;
              if (m.boat) {
                // Under a road bridge the hull slips below the deck (air-cover.js). It
                // starts down as soon as the bow or stern is under the roadway and eases
                // there, instead of popping 30 units when the middle of the boat crosses.
                const half = vehicleSpec(c).l * 0.5,
                  ux = Math.cos(c.a) * half,
                  uy = Math.sin(c.a) * half,
                  underBridge =
                    underBridgeWater(c.x, c.y) ||
                    underBridgeWater(c.x + ux, c.y + uy) ||
                    underBridgeWater(c.x - ux, c.y - uy),
                  float = underBridge ? -30 : 0.6 + Math.sin(gameTime * 1.7 + c.x * 0.02) * 0.45;
                m.float = m.float === undefined || Math.abs(float - m.float) > 60 ? float : m.float + (float - m.float) * (1 - Math.exp(-deltaSeconds * 12));
                m.group.position.y = m.float;
                m.body.rotation.z = Math.sin(gameTime * 2 + c.id) * 0.023;
                m.body.rotation.x = Math.sin(gameTime * 1.3 + c.y * 0.017) * 0.028;
                // Wake, bow wave and spray are drawn into the sea (wakes3d.js).
                const boatSpec = vehicleSpec(c);
                if (c.hp > 0 && (Math.abs(c.speed) > 2 || c === player.car))
                  wakeEmit(c, c.x, c.y, c.a, c.speed, boatSpec.l, boatSpec.w, boatSpec.max || 300, !underBridge);
                if (m.boatUpdate) m.boatUpdate(c);
              }
              for (const { wheel } of m.wheels) wheel.rotation.z -= (c.speed * deltaSeconds) / 5;
            }
            if (c.bloodyUntil > gameTime && !m.blood) {
              m.blood = new Three.Group();
              m.body.add(m.blood);
              const vehicleDefinition = vehicleSpec(c),
                red = mat('#7a0f1f', 0.62);
              for (let j = 0; j < 9; j++)
                box(
                  m.blood,
                  vehicleDefinition.l * 0.493,
                  5 + (j % 3) * 1.4,
                  (j - 4) * vehicleDefinition.w * 0.082,
                  0.3,
                  1.4,
                  1.8,
                  red,
                );
            }
            if (m.blood) m.blood.visible = c.bloodyUntil > gameTime;
            // SWAT van rear doors swing open for the team and stay open (swat.js).
            if (m.rearDoors) {
              const open = c.doorsOpenAt ? clamp((gameTime - c.doorsOpenAt) / 0.7, 0, 1) : 0;
              for (const { pivot, side } of m.rearDoors) pivot.rotation.y = side * open * 1.85;
            }
            // Flash patterns, wig-wag, halos (police3d.js).
            if (m.police) animatePoliceVehicle(c, m);
            for (let i = 0; i < m.strobes.length; i++)
              m.strobes[i].material.color.copy(
                cachedColor(
                  ((c.cop && wantedStars > 0) || c.airUnit || c.gangTarget || c.type === 'ambulance') &&
                    Math.sin(gameTime * 17 + i * 3) > 0
                    ? i
                      ? '#78aefa'
                      : '#ff6751'
                    : '#3c4147',
                ),
              );
            // Engine smoke, fire and the burning wreck (damage3d.js).
            vehicleEffects(c, m, deltaSeconds);
          }
          endVehicleImpostors();
          lap = profileLap('r:vehicles', lap);
          // Every craft on the water has reported in: draw the wake map (wakes3d.js).
          updateWakes(deltaSeconds);
          for (const [c, m] of carModels)
            if (m.group.visible && !isAircraft(c) && !isBoat(c)) {
              m.body.rotation.x += c.slopeRoll || 0;
              m.body.rotation.z += c.slopePitch || 0;
            }
          // Marks on vehicles, debris, knocked furniture and decal uploads (damage3d.js).
          updateDamageVisuals(deltaSeconds);
          lap = profileLap('r:damage', lap);
          updateSniperSights();
          for (const p of people) {
            const activePlayer = p === player;
            let m = personModels.get(p);
            const near =
              activePlayer ||
              ((flightViewActive ? viewZoom > PEOPLE_ZOOM : worldZoom > 0.22) && entityInView(p, 35));
            // Zoomed out, plain standing/walking figures are instanced (flight-view3d.js).
            if (near && !activePlayer && personImpostor(p)) {
              if (m) m.group.visible = false;
              continue;
            }
            if (!m && !near) continue;
            if (!m) {
              if (newModelsThisFrame >= NEW_MODELS_PER_FRAME + 4 && !activePlayer) continue;
              newModelsThisFrame++;
              m = makePerson(p, activePlayer);
              personModels.set(p, m);
              // Only torso-sized parts cast into the shadow map (lighting3d.js).
              trimShadowCasters(m.group, 3.5);
            }
            m.group.visible = near && !(activePlayer && (player.car || transitRide || taxiRide));
            if (p.hidden) m.group.visible = false;
            if (!m.group.visible) continue;
            // Wounds (wounds.js): the dead fall over half a second, backwards, face
            // down or spun, or sit slumped against a wall; a downed officer lies
            // prone and crawls; a fresh hit tilts the body away from the round.
            const death = p.hp <= 0 ? p.deathStyle : null,
              downed = p.hp > 0 && !!p.downed,
              slump = !!death?.slump,
              fallen = slump ? 0 : p.hp <= 0 ? personFallAmount(p) : downed ? 1 : (p.poisonCollapse ?? personFallAmount(p)),
              fallSign = death ? death.sign : downed ? -1 : 1,
              flinch = hitFlinch(p),
              flinchAlong = flinch ? Math.cos(normalizeAngle((p.hitDir || 0) - (p.a || 0))) : 0,
              incapacitated = personIncapacitated(p) || downed;
            m.group.position.set(
              p.x,
              entityElevation(p) + fallen * 1.5 - (slump ? 4.5 : 0) - (p.hitZone === 'leg' ? flinch * 1.5 : 0),
              p.y,
            );
            m.group.rotation.set(
              p.ejected ? p.ejectRoll || 0 : 0,
              -(activePlayer && (mouse.active || touchAim !== null) ? aim() : p.a) - (death?.turn || 0) * fallen,
              (fallSign * fallen * Math.PI) / 2 +
                (slump ? 0.5 : 0) -
                flinchAlong * 0.35 * flinch +
                (p.hp > 0 && p.dazedFor > 0 ? Math.sin(gameTime * 8) * 0.055 : 0),
            );
            // The player's legs swing wider at a run than at a walk; the pace is
            // measured from the model's own travel, so every footing agrees.
            const playerRun = activePlayer ? playerRunAmount(m, p, deltaSeconds) : 0,
              step =
                p.hp > 0 && !incapacitated && p.walking !== false
                  ? Math.sin(p.walk || 0) * (activePlayer ? 0.4 + 0.42 * playerRun : 0.5)
                  : 0;
            m.torso.rotation.z = 0;
            m.parts.leg1.rotation.z = step;
            m.parts['leg-1'].rotation.z = -step;
            m.parts.arm1.rotation.z = -step * 0.5;
            m.parts['arm-1'].rotation.z = step * 0.5;
            if (p.faction && !incapacitated) {
              m.parts.guns[0].visible = p.hp > 0 && !!p.aiming;
              m.parts.arm1.rotation.z = p.aiming ? 1.12 : -step * 0.5;
              m.parts['arm-1'].rotation.z = p.aiming ? 0.9 : step * 0.5;
            }
            if (p.military) poseSoldier(p, m, incapacitated);
            if (p.police && !incapacitated) {
              m.parts.guns[0].visible = p.hp > 0;
              const aiming = p.state === 'aim' || p.state === 'suppress';
              m.parts.arm1.rotation.z = aiming ? 1.12 : 0.3;
              m.parts['arm-1'].rotation.z = aiming ? 0.9 : -step * 0.5;
            }
            if (downed) {
              // Hauling along on the elbows, weapon dropped.
              const c = Math.sin((p.walk || 0) * 0.8);
              m.parts.guns[0].visible = false;
              m.parts.arm1.rotation.z = 2.5 + c * 0.45;
              m.parts['arm-1'].rotation.z = 2.5 - c * 0.45;
              m.parts.leg1.rotation.z = Math.max(0, c) * 0.4;
              m.parts['leg-1'].rotation.z = 0;
            } else if (slump) {
              m.parts.leg1.rotation.z = 1.45;
              m.parts['leg-1'].rotation.z = 1.3;
              m.parts.arm1.rotation.z = 0.15;
              m.parts['arm-1'].rotation.z = 0.35;
            } else if (p.hp <= 0 && fallSign < 0) {
              m.parts.arm1.rotation.z = 2.4;
              m.parts['arm-1'].rotation.z = 1.7;
            } else if (p.limping && p.hp > 0) {
              // Favour one leg: a short stride on it.
              m.parts['leg-1'].rotation.z *= 0.35;
            }
            if (m.parts.cup) m.parts.cup.visible = !!p.drinking && p.hp > 0;
            if (p.hp > 0 && p.dancing) {
              const beat = gameTime * 4 + p.phase;
              m.group.rotation.z = Math.sin(beat) * 0.07;
              m.parts.arm1.rotation.z = 0.7 + Math.sin(beat) * 0.5;
              m.parts['arm-1'].rotation.z = 0.7 - Math.sin(beat) * 0.5;
              m.parts.leg1.rotation.z = Math.sin(beat) * 0.22;
              m.parts['leg-1'].rotation.z = -Math.sin(beat) * 0.22;
            }
            if (p.recoiling && p.hp > 0) {
              m.parts.arm1.rotation.z = 1.2;
              m.parts['arm-1'].rotation.z = 1.1;
            }
            if (p.illness && p.hp > 0) {
              m.group.rotation.z = -p.illness * 0.24 + Math.sin(gameTime * 8) * 0.025;
              m.torso.rotation.z = -p.illness * 0.2;
              m.parts.arm1.rotation.z = 0.85;
              m.parts['arm-1'].rotation.z = 0.5;
            }
            if (p.poisonCollapse !== undefined) {
              m.group.rotation.z = ((p.hp <= 0 ? 1 : p.poisonCollapse) * Math.PI) / 2;
              m.parts.leg1.rotation.z = 0.4 * (1 - p.poisonCollapse);
              m.parts['leg-1'].rotation.z = 0.2 * (1 - p.poisonCollapse);
              m.parts.arm1.rotation.z = 0.8 * (1 - p.poisonCollapse);
              m.parts['arm-1'].rotation.z = 0.3;
            }
            if (incapacitated) m.parts.guns.forEach((g) => (g.visible = false));
            if (p.drinking && p.hp > 0 && !incapacitated) {
              m.parts.arm1.rotation.z = 1.5 + Math.sin(gameTime * 3) * 0.15;
            }
            // Thrown off a bike (riders.js): the player, or traffic's rider.
            const thrown = activePlayer ? player.thrown : p.ejected?.rider ? p.ejected : null;
            if (thrown) poseThrownBody(m, p, thrown);
            if (activePlayer && player.tumble) {
              m.group.rotation.z = Math.PI / 2;
              m.group.rotation.x = player.tumbleRoll || 0;
              m.group.position.y += 4;
              m.parts.arm1.rotation.z = 2.1;
              m.parts['arm-1'].rotation.z = 1.7;
              m.parts.leg1.rotation.z = -0.7;
              m.parts['leg-1'].rotation.z = -0.4;
            }
            if (activePlayer) {
              if (player.parachute) {
                m.parts.arm1.rotation.z = 2.6;
                m.parts['arm-1'].rotation.z = 2.6;
                m.parts.leg1.rotation.z = 0.25;
                m.parts['leg-1'].rotation.z = -0.25;
              }
              m.cloth.color.set(player.disguised ? '#e3dac0' : '#272d36');
              m.pants.color.set(player.disguised ? '#252a33' : '#536273');
              const holstered = !!rooftopJob() && player.disguised && !rooftopJob().weaponDrawn;
              const recoil = Math.max(0, ((player.recoilUntil || 0) - gameTime) / 0.12);
              // Leaning into the run.
              m.torso.rotation.z = -recoil * 0.12 - playerRun * 0.14;
              m.parts.guns.forEach((gun, i) => {
                gun.visible = i === selectedWeaponIndex && !holstered && !player.parachute;
                gun.position.x = 5 - recoil * 1.8;
                gun.rotation.z = -recoil * 0.08;
              });
              const knifeSwing =
                selectedWeaponIndex === KNIFE_INDEX
                  ? Math.max(0, ((player.knifeSwingUntil || 0) - gameTime) / 0.28)
                  : 0;
              const knifeModel = m.parts.guns[KNIFE_INDEX];
              knifeModel.rotation.y = Math.sin(knifeSwing * Math.PI) * 1.3;
              knifeModel.position.x += Math.sin(knifeSwing * Math.PI) * 3;
              m.parts.arm1.rotation.z = holstered
                ? -step * 0.5
                : 1.12 + Math.sin(knifeSwing * Math.PI) * 0.8;
              m.parts['arm-1'].rotation.z = holstered
                ? step * 0.5
                : selectedWeaponIndex > 0
                  ? 0.9
                  : step * 0.5;
              // Fists: arms swing loose while walking; for a few seconds after a
              // punch they come up in a guard and the punching arm snaps out.
              if (selectedWeaponIndex === FISTS_INDEX && !player.parachute) {
                const guard = gameTime - (player.punchAt ?? -100) < 2.5,
                  punch = Math.sin(clamp(1 - ((player.punchUntil || 0) - gameTime) / 0.26, 0, 1) * Math.PI) *
                    ((player.punchUntil || 0) > gameTime ? 1 : 0),
                  lead = player.punchHand === -1 ? 'arm-1' : 'arm1',
                  rear = lead === 'arm1' ? 'arm-1' : 'arm1';
                if (guard) {
                  m.parts[lead].rotation.z = 0.85 + punch * 0.75;
                  m.parts[rear].rotation.z = 0.85;
                  m.torso.rotation.y = (lead === 'arm1' ? -1 : 1) * punch * 0.25;
                } else {
                  m.parts.arm1.rotation.z = -step * 0.5;
                  m.parts['arm-1'].rotation.z = step * 0.5;
                  m.torso.rotation.y = 0;
                }
              } else m.torso.rotation.y = 0;
              if (player.parachute) {
                m.parts.arm1.rotation.z = 2.6;
                m.parts['arm-1'].rotation.z = 2.6;
              }
              /**
               * FRONT CRAWL
               * Swimming is a whole-body pose, so it is applied last and overrides
               * everything the walk and the weapon set before it. The body lies
               * prone along its heading and rolls with the stroke the way a
               * swimmer's does; the arms windmill a half cycle apart, catching and
               * recovering rather than swinging like a walk; the legs flutter at
               * twice the arm rate; and the whole thing rides at the waterline.
               */
              if (player.swimming) {
                const stroke = player.swimStroke || 0,
                  roll = Math.sin(stroke) * 0.44;
                m.group.rotation.set(roll, -player.a, -Math.PI / 2);
                m.group.position.y = entityElevation(player) + 2.6;
                m.parts.arm1.rotation.z = stroke;
                m.parts['arm-1'].rotation.z = stroke + Math.PI;
                m.parts.leg1.rotation.z = Math.sin(stroke * 2) * 0.3;
                m.parts['leg-1'].rotation.z = -Math.sin(stroke * 2) * 0.3;
                m.torso.rotation.z = 0.14 + Math.sin(stroke * 2) * 0.06;
                m.parts.guns.forEach((gun) => (gun.visible = false));
              }
              // Thrown off a bike: the whole-body pose again over the weapon's arms.
              if (player.thrown) poseThrownBody(m, p, player.thrown);
              // Freefall and canopy poses (parachute3d.js); resets the spread limbs after.
              poseParachutist(m, deltaSeconds);
            }
          }
          // The parachute hangs from the harness point the person pass just posed.
          updateParachute3D(deltaSeconds);
          playerRing.visible =
            !transitRide && !taxiRide && !player.car && !player.parachute && !player.swimming;
          playerRing.position.set(player.x, 0.3 + entityElevation(player), player.y);
          playerRim.value.copy(PLAYER_RIM_NIGHT).multiplyScalar(nightAmount * 0.55);
          // A swimmer's wake, kick foam and the ripples round them are drawn into the
          // sea like a boat's (wakes3d.js). The flat V and ring planes that did this
          // sat at a fixed height, so the swell rose through them.
          if (player.swimming) wakeEmit(player, player.x, player.y, player.a, clamp(player.swimDrive || 0, 0, 1) * 70, 16, 7, 80, false);
          for (const p of pickups) {
            let m = pickupModels.get(p);
            if (!m) {
              m = new Three.Group();
              scene.add(m);
              const co = p.type === 'health' ? '#71d2b3' : p.type === 'ammo' ? '#b294d0' : '#7daecb';
              box(m, 0, 5, 0, 9, 9, 9, mat('#3b474b', 0.55, 0.3));
              if (p.type === 'health') {
                box(m, 0, 5, 4.7, 2, 6, 0.2, mat(co));
                box(m, 0, 5, 4.7, 6, 2, 0.2, mat(co));
              } else for (let j = -1; j < 2; j++) box(m, j * 2.3, 5, 4.7, 1.2, 5, 0.2, mat(co));
              halo(m, 0, 5, 0, 24, co);
              pickupModels.set(p, m);
            }
            m.visible = p.ready < gameTime && entityInView(p, 24);
            m.position.set(p.x, terrainHeight(p.x, p.y) + 2 + Math.sin(gameTime * 2) * 1.2, p.y);
            m.rotation.y = gameTime * 0.2;
          }
          disposeRetiredModels();
          const target = objective(),
            targetAltitude = target ? entityElevation(target) : 0;
          objectiveRing.visible = arrowGroup.visible = !!target;
          if (target) {
            objectiveRing.position.set(target.x, 0.4 + targetAltitude, target.y);
            arrowGroup.position.set(
              target.x,
              targetAltitude + 39 + Math.sin(gameTime * 3) * 3,
              target.y,
            );
            arrowGroup.rotation.y = gameTime * 0.6;
            targetLight.position.set(target.x, targetAltitude + 10, target.y);
          }
          if (player.car && !isAircraft(player.car)) {
            playerHeadlight.intensity = 850 * headlightShare(player.car);
            const x = player.x + Math.cos(player.a) * 160,
              z = player.y + Math.sin(player.a) * 160;
            playerHeadlight.position.set(
              player.x + Math.cos(player.a) * 18,
              entityElevation(player.car) + 9,
              player.y + Math.sin(player.a) * 18,
            );
            playerHeadlight.target.position.set(x, terrainHeight(x, z), z);
          } else playerHeadlight.intensity = 0;
          if (gameTime > muzzleUntil) muzzleLight.intensity = 0;
          for (const ring of blastRings) {
            if (!ring.visible) continue;
            const age = gameTime - ring.userData.born;
            ring.visible = age < 0.6;
            const radius = 12 + age * 220 * ring.userData.power;
            ring.scale.set(radius, radius, 1);
            ring.material.opacity = Math.max(0, 0.35 * (1 - age / 0.6));
          }
          let fi = 0,
            li = 0;
          for (const fire of fires) {
            if (distanceBetween(fire, cameraTarget) > 1000) continue;
            const fade = Math.min(1, fire.life / 3),
              age = fire.max - fire.life,
              altitude = fire.altitude ?? terrainHeight(fire.x, fire.y);
            for (let j = 0; j < 3 && fi < flamePool.length; j++) {
              const sp = flamePool[fi++],
                phase = gameTime * 7 + j * 2.4 + fire.x;
              sp.visible = true;
              sp.position.set(
                fire.x + Math.sin(phase * 0.5) * 13 * fire.power,
                altitude + 12 + Math.sin(phase) * 3,
                fire.y + Math.cos(phase * 0.4) * 11 * fire.power,
              );
              sp.scale.set(
                (28 + Math.sin(phase) * 6) * fire.power,
                (52 + Math.cos(phase * 1.3) * 12) * fire.power,
                1,
              );
              sp.material.opacity = fade * 0.9;
            }
            if (li < fireLights.length) {
              const light = fireLights[li++];
              light.position.set(fire.x, altitude + 20, fire.y);
              light.intensity = fade * fire.power * (540 + Math.sin(gameTime * 17) * 90);
            }
            if (deltaSeconds > 0 && Math.random() < deltaSeconds * 12)
              fx.push({
                x: fire.x + randomBetween(-10, 10),
                y: altitude + 18,
                z: fire.y + randomBetween(-10, 10),
                vx: 7,
                vy: randomBetween(22, 40),
                vz: 3,
                life: 3,
                max: 3,
                color: age > 8 ? '#3b4146' : '#606166',
                size: 18 * fire.power,
                smoke: true,
              });
          }
          for (; fi < flamePool.length; fi++) flamePool[fi].visible = false;
          for (; li < fireLights.length; li++) fireLights[li].intensity = 0;
          for (let i = 0; i < scorchMeshes.length; i++) {
            const d = debris[debris.length - 1 - i],
              m = scorchMeshes[i];
            m.visible = !!d && distanceBetween(d, cameraTarget) < 1000;
            if (d) {
              m.position.set(d.x, (d.altitude ?? terrainHeight(d.x, d.y)) + 0.2, d.y);
              m.scale.set(100, 85, 1);
              m.material.opacity = Math.min(0.8, d.life / 10);
            }
          }
          if (fx.length > 620) fx.splice(0, fx.length - 620);
          let pi = 0;
          // Sprites are unlit: blood drops, casings, glass and smoke take the scene's
          // light level so they do not glow in the dark (flames and sparks do).
          const spriteLight = 0.3 + 0.7 * daylight();
          for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.life -= deltaSeconds;
            if (p.life <= 0) {
              fx.splice(i, 1);
              continue;
            }
            p.x += p.vx * deltaSeconds;
            p.y += p.vy * deltaSeconds;
            p.z += p.vz * deltaSeconds;
            if (p.case) p.vy -= 120 * deltaSeconds;
            else {
              const drag = Math.pow(0.97, deltaSeconds * 60);
              p.vx *= drag;
              p.vz *= drag;
            }
            p.y = Math.max(0.5, p.y);
            if (pi >= particlePool.length) continue;
            const s = particlePool[pi++];
            s.visible = true;
            s.position.set(p.x, p.y, p.z);
            const a = p.life / p.max;
            s.material.map = p.glow ? haloTx : smokeTx;
            s.material.color.copy(cachedColor(p.color));
            if (!p.glow) s.material.color.multiplyScalar(spriteLight);
            s.material.opacity = Math.min(p.smoke ? 0.56 : 0.96, a * 1.7);
            s.material.blending = p.glow ? Three.AdditiveBlending : Three.NormalBlending;
            let sz = p.case ? p.size : p.size * (1 + (1 - a) * 2);
            s.scale.set(sz, sz, 1);
          }
          for (const p of particles) {
            if (pi >= particlePool.length) break;
            const s = particlePool[pi++];
            s.visible = true;
            s.position.set(
              p.x,
              p.blood || p.flame ? Math.max(0.3, p.z) : 2 + (1 - p.life / p.max) * 13,
              p.y,
            );
            s.material.map = p.blood ? bloodDropTx : p.flame ? flameTx : smokeTx;
            s.material.color.copy(cachedColor(p.color));
            if (!p.flame) s.material.color.multiplyScalar(spriteLight);
            s.material.opacity = p.blood ? 0.97 : clamp(p.life / p.max, 0, 0.7);
            s.material.blending = p.flame ? Three.AdditiveBlending : Three.NormalBlending;
            s.scale.set(p.size * (p.blood ? 1.1 : 1.6), p.size * (p.blood ? 1.8 : 1.6), 1);
          }
          for (; pi < particlePool.length; pi++) particlePool[pi].visible = false;
          let bi = 0;
          for (const b of bullets) {
            if (bi + 6 > tracerPositions.length) break;
            // A sniper round (combat-rules.js SNIPER FIRE) leaves a longer streak.
            const tail = b.tracer || 0.009;
            tracerPositions[bi++] = b.x;
            tracerPositions[bi++] = 9 + (b.altitude || 0);
            tracerPositions[bi++] = b.y;
            tracerPositions[bi++] = b.x - b.vx * tail;
            tracerPositions[bi++] = 9 + (b.altitude || 0) - (b.vz || 0) * tail;
            tracerPositions[bi++] = b.y - b.vy * tail;
          }
          tracerGeo.setDrawRange(0, bi / 3);
          tracerGeo.attributes.position.needsUpdate = true;
          tracer.frustumCulled = false;
          let si = 0;
          for (const s of skids) {
            if (si + 6 > skidPos.length) break;
            const x = s.x + Math.cos(s.a) * s.len,
              z = s.y + Math.sin(s.a) * s.len;
            skidPos[si++] = s.x;
            skidPos[si++] = terrainHeight(s.x, s.y) + 0.15;
            skidPos[si++] = s.y;
            skidPos[si++] = x;
            skidPos[si++] = terrainHeight(x, z) + 0.15;
            skidPos[si++] = z;
          }
          skidGeo.setDrawRange(0, si / 3);
          skidGeo.attributes.position.needsUpdate = true;
          skidLines.frustumCulled = false;
          // The sun's shadow map is redrawn every frame it is on (quality.js
          // SHADOWS): a map kept for a few frames left the shadows of the player
          // and the traffic trailing behind them. With shadows off, contact
          // blobs ground the cars and people instead.
          frames++;
          const shadowRefresh = renderer.shadowMap.enabled;
          renderer.shadowMap.needsUpdate = shadowRefresh;
          updateContactShadows();
          lap = profileLap('r:people+fx', lap);
          // World matrices of what is shown (SCENE MATRICES), then the HDR scene,
          // AO, bloom, tone curve and grade (postfx3d.js).
          refreshSceneMatrices();
          flushVehicleHalos();
          renderFrame();
          lap = profileLap(shadowRefresh ? 'r:submit+shadow' : 'r:submit', lap);
          if (bakedCanvases.length && frames % 30 === 0) releaseBakedCanvases();
          worldContext.clearRect(0, 0, viewportWidth, viewportHeight);
          if (target && gameMode === 'play') {
            const p = api.project(target.x, target.y, 32 + targetAltitude);
            if (p.x < 60 || p.x > viewportWidth - 60 || p.y < 130 || p.y > viewportHeight - 210) {
              const a = Math.atan2(p.y - viewportHeight / 2, p.x - viewportWidth / 2),
                r = Math.min(
                  (viewportWidth / 2 - 80) / Math.max(0.01, Math.abs(Math.cos(a))),
                  (viewportHeight / 2 - 125) / Math.max(0.01, Math.abs(Math.sin(a))),
                );
              const x = viewportWidth / 2 + Math.cos(a) * r,
                y = viewportHeight / 2 + Math.sin(a) * r;
              worldContext.save();
              worldContext.translate(x, y);
              worldContext.rotate(a);
              worldContext.fillStyle = '#efd7a1';
              worldContext.beginPath();
              worldContext.moveTo(12, 0);
              worldContext.lineTo(-7, -7);
              worldContext.lineTo(-3, 0);
              worldContext.lineTo(-7, 7);
              worldContext.closePath();
              worldContext.fill();
              worldContext.restore();
              worldContext.fillStyle = '#eee0c4';
              worldContext.font = 'bold 11px monospace';
              worldContext.textAlign = 'center';
              worldContext.fillText(distanceLabel(distanceBetween(player, target)), x, y + 24);
            }
          }
          for (const p of [...storyActors, ...enemies, ...gangMembers]) {
            if (
              p.guest ||
              p.boss ||
              p.hidden ||
              p.hp <= 0 ||
              // Soldiers going about their duties are not labelled until they engage.
              (p.military && !p.aiming) ||
              !sameFloor(p, player) ||
              distanceBetween(p, player) > (p.ally ? 400 : 230)
            )
              continue;
            const q = api.project(p.x, p.y, entityElevation(p) + 24);
            if (q.x < 20 || q.x > viewportWidth - 20 || q.y < 80 || q.y > viewportHeight - 180)
              continue;
            worldContext.font = 'bold 10px Arial';
            worldContext.textAlign = 'center';
            worldContext.strokeStyle = '#11202a';
            worldContext.lineWidth = 3;
            worldContext.strokeText(p.name || '', q.x, q.y);
            worldContext.fillStyle = p.ally
              ? '#f0ddae'
              : p.faction === 'harbor'
                ? '#d99b84'
                : '#c9b6e7';
            worldContext.fillText(p.name || '', q.x, q.y);
          }
          // Pedestrian speech: short lines drawn as bubbles above the speaker.
          // Drivers shouting out of the window use the same bubble over the car.
          // speechBubbles() (crowd.js) picks at most two, most important first, and
          // returns none with Settings · Gameplay · NPC chatter off. A second bubble
          // that would overlap the first rises clear above it.
          const bubbleRects = [];
          for (const p of speechBubbles()) {
            const q = api.project(p.x, p.y, entityElevation(p) + (p.type ? 22 : 27));
            if (q.x < 40 || q.x > viewportWidth - 40 || q.y < 90 || q.y > viewportHeight - 190) continue;
            worldContext.font = '600 10px Arial';
            const tw = worldContext.measureText(p.speech).width + 12,
              fade = clamp((p.speechUntil - gameTime) / 0.4, 0, 1);
            for (const r of bubbleRects)
              if (Math.abs(q.x - r.x) < (tw + r.w) / 2 + 4 && Math.abs(q.y - r.y) < 20)
                q.y = r.y - 20;
            bubbleRects.push({ x: q.x, y: q.y, w: tw });
            worldContext.globalAlpha = fade;
            worldContext.fillStyle = '#f4efe2';
            worldContext.beginPath();
            if (worldContext.roundRect) worldContext.roundRect(q.x - tw / 2, q.y - 20, tw, 16, 5);
            else worldContext.rect(q.x - tw / 2, q.y - 20, tw, 16);
            worldContext.fill();
            worldContext.beginPath();
            worldContext.moveTo(q.x - 3, q.y - 4);
            worldContext.lineTo(q.x + 3, q.y - 4);
            worldContext.lineTo(q.x, q.y);
            worldContext.fill();
            worldContext.fillStyle = '#1b2026';
            worldContext.textAlign = 'center';
            worldContext.fillText(p.speech, q.x, q.y - 8);
            worldContext.globalAlpha = 1;
          }
          for (const p of [...pedestrians, ...enemies, ...gangMembers, ...officers])
            if (personIncapacitated(p) && distanceBetween(p, cameraTarget) < 850) {
              const q = api.project(p.x, p.y, entityElevation(p) + (p.knockedFor > 0 ? 10 : 26));
              drawDizzy(q.x, q.y);
            }
          drawHarborLabels3D(api);
          drawHitTargetLabel();
          if (flash > 0) {
            worldContext.fillStyle = 'rgba(199,88,62,' + flash * 0.7 + ')';
            worldContext.fillRect(0, 0, viewportWidth, viewportHeight);
          }
        },
      };
      flushBreakables();
      const batchReport = batchStaticGroups();
      api.batchReport = batchReport;
      tagSceneryDetail();
      compactBuildingBlocks();
      buildFarScenery(staticBatchMeshes);
      cellStatics();
      paintLampLight();
      applyRendererQuality(graphicsTier());
      refreshEnvironment(true);
      api.resize();
      prewarmShaders();
      return api;
    }
    // END SUBSYSTEM: src/render3d.js
