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
            if (!b) buckets.set(key, (b = { material: o.material, parts: [], vertices: 0, indices: 0 }));
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
          scene.add(m);
          staticBatchMeshes.push(m);
        }
        return { merged: removed, batches: buckets.size };
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
      // Street trees with proper trunks and layered crowns.
      const blossomMat = mat('#d5a2b5');
      const leafGeo = new Three.IcosahedronGeometry(1, 2),
        trunkGeo = new Three.CylinderGeometry(0.9, 1.9, 1, 8);
      trees.forEach((t, i) => plantTree(t, i));
      // One tree of the plan (or a renderer-only one, landscape3d.js): a palm on the
      // Keys, otherwise a trunk, limbs and a crown of lobes, batched with the rest.
      function plantTree(t, i) {
        if (t.tropical ?? (onPalmKeys(t.x) && !t.county)) {
          makePalm(t.x, t.y, t.r / 17);
          return;
        }
        const group = new Three.Group();
        group.position.set(t.x, terrainHeight(t.x, t.y), t.y);
        scene.add(group);
        batchGroups.push(group);
        // Tapered trunk with a root flare, two main limbs, and a layered crown of
        // five offset lobes so the canopy reads as foliage rather than a ball.
        mesh(trunkGeo, wood, group, 0, t.r * 0.8, 0, 1, t.r * 1.6, 1);
        if (!t.pine) {
          for (const a of [0.7, 3.4]) {
            const limb = mesh(cylinderGeo, wood, group, Math.cos(a) * t.r * 0.25, t.r * 1.45, Math.sin(a) * t.r * 0.25, 0.7, t.r * 0.9, 0.7);
            limb.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
          }
        }
        const lobes = t.pine ? 4 : 5;
        for (let j = 0; j < lobes; j++) {
          const a = j * 2.399 + i * 0.7;
          if (t.pine)
            mesh(
              new Three.ConeGeometry(t.r * (0.95 - j * 0.16), t.r * 1.2, 8),
              leafMats[(i + j) % 3],
              group,
              0,
              t.r * (1.3 + j * 0.55),
              0,
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
        statics.push({
          x: t.x,
          y: t.y,
          group,
          radius: 40,
        });
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
      /**
       * Landmark and business signs: an enamel board with a border and lettering
       * that light up at night. The painted face is the map; lettering and border
       * glow through an emissive mask whose strength signage3d.js drives with the
       * hour (and the district's power), so they bloom after dark. Street-level
       * boards also spill their colour onto the pavement and the wet road, and
       * `options.marquee` rings the board with chasing bulbs (signage3d.js places
       * both once every caller has moved its sign into place).
       */
      const signBoards = [];
      function sign(text, x, z, width, color, vertical = false, options = {}) {
        const face = document.createElement('canvas'),
          glowCanvas = document.createElement('canvas');
        face.width = glowCanvas.width = 1024;
        face.height = glowCanvas.height = 256;
        const cg = face.getContext('2d'),
          gg = glowCanvas.getContext('2d'),
          board = cg.createLinearGradient(0, 0, 0, 256);
        board.addColorStop(0, '#1f2f36');
        board.addColorStop(1, '#101a1f');
        cg.fillStyle = board;
        cg.fillRect(0, 0, 1024, 256);
        gg.fillStyle = '#000';
        gg.fillRect(0, 0, 1024, 256);
        const hot = '#' + new Three.Color(color).lerp(new Three.Color('#ffffff'), 0.55).getHexString();
        for (const g of [cg, gg]) {
          g.font = '600 86px Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.lineJoin = 'round';
        }
        // Border tube and lettering on the board.
        cg.strokeStyle = color;
        cg.lineWidth = 7;
        cg.strokeRect(20, 22, 984, 212);
        cg.fillStyle = 'rgba(0,0,0,0.5)';
        cg.fillText(text, 516, 137, 932);
        cg.fillStyle = color;
        cg.fillText(text, 512, 132, 932);
        // What glows: a coloured spill round both, then their hot cores.
        gg.shadowColor = color;
        gg.shadowBlur = 26;
        gg.strokeStyle = color;
        gg.lineWidth = 9;
        gg.strokeRect(20, 22, 984, 212);
        gg.fillStyle = color;
        gg.fillText(text, 512, 132, 932);
        gg.shadowBlur = 0;
        gg.strokeStyle = hot;
        gg.lineWidth = 3;
        gg.strokeRect(20, 22, 984, 212);
        gg.fillStyle = hot;
        gg.fillText(text, 512, 132, 932);
        const texture = (canvas) => {
          const tx = new Three.CanvasTexture(canvas);
          tx.colorSpace = Three.SRGBColorSpace;
          tx.minFilter = Three.LinearMipmapLinearFilter;
          tx.magFilter = Three.LinearFilter;
          tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          return tx;
        };
        const m = new Three.Mesh(
          new Three.PlaneGeometry(width, width / 4),
          litSignMaterial(texture(face), texture(glowCanvas), { night: 2.6, day: 0.18, doubleSided: true }),
        );
        // Centred 23 up, but never so low that a wide board sinks into the ground
        // (a 235-wide sign is 59 tall); callers raise facade signs further.
        const signY = Math.max(23, width / 8 + 3);
        m.position.set(x, signY, z + 0.6);
        m.userData.sign = true;
        m.receiveShadow = true;
        scene.add(m);
        m.userData.backing = box(scene, x, signY, z - 1.5, width + 5, width / 4 + 5, 3, darkMetal);
        signBoards.push({ mesh: m, width, color, marquee: !!options.marquee });
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
      // @include src/boats3d.js
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
      // @include src/vehicles3d.js
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
        if (vehicle.type === 'helicopter') return makeHelicopter(vehicle);
        if (vehicleSpec(vehicle).bike) return makeMotorcycle(vehicle);
        if (vehicleSpec(vehicle).jetski) return makeJetSki(vehicle);
        if (vehicleSpec(vehicle).boat) return makeBoat(vehicle);
        if (vehicleSpec(vehicle).truck) return makeTruck(vehicle);
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
        const strobes = [];
        // Patrol cars, SWAT vans and agents' SUVs carry a light bar (pursuit.js).
        if (vehicle.type === 'police' || vehicle.lawUnit === 'swat' || vehicle.lawUnit === 'fed') {
          box(body, -1, roof + 1.2, 0, 3, 1, w * 0.73, darkMetal);
          for (const side of [-1, 1]) {
            const model = box(
              body,
              -1,
              roof + 2,
              side * 4,
              3,
              1.5,
              5,
              new Three.MeshBasicMaterial({
                color: side === 1 ? '#5186fa' : '#f24632',
              }),
            );
            strobes.push(model);
          }
          for (const side of [-1, 1])
            box(body, 0, h - 2, side * w * 0.501, l * 0.4, 3, 0.22, mat('#d8d3c7'));
        }
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
          strobes,
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
        };
      }
      /**
       * PLAYER AT NIGHT
       * The player's dark jacket vanished into an unlit street. After dark their
       * model picks up a cool rim light (strongest on the faces turned away from
       * the camera, so the silhouette reads against the ground) and a faint fill,
       * and a soft pool of light rides at their feet (playerGlow, updated in
       * render()). Both follow nightAmount and are gone by day.
       */
      const playerRim = { value: new Three.Color(0, 0, 0) },
        PLAYER_RIM_NIGHT = new Three.Color('#5d6f8f');
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
                totalEmissiveRadiance += cityPlayerRim * ( 0.18 + 1.4 * rimView * rimView );
              }`,
            );
        };
        material.customProgramCacheKey = () => 'player-rim';
      }
      function makePerson(person, isPlayer) {
        const group = new Three.Group();
        scene.add(group);
        const skin = mat(isPlayer ? '#bb9475' : '#af8b72'),
          cloth = mat(isPlayer ? '#272d36' : person.color || '#6b5965'),
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
        // Body, clothes and hair (not the guns) carry the player's night rim light.
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
        if (person.police && person.unit === 'swat') {
          // Helmet, plate carrier with a pale POLICE panel.
          mesh(sphereGeo, mat('#15191e', 0.5, 0.2), group, 0, 16.3, 0, 2.5, 2.1, 2.55);
          box(group, 0.2, 10.3, 0, 5.2, 5.2, 7, mat('#23292f'));
          box(group, -2.7, 11, 0, 0.2, 1.6, 4.6, mat('#c9d3da'));
          box(group, 0, 7.5, 0, 5, 1, 6.7, darkMetal);
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
      const chuteModel = new Three.Group();
      chuteModel.name = 'Player parachute';
      scene.add(chuteModel);
      const canopy = mesh(
        new Three.SphereGeometry(34, 24, 12, 0, TAU, 0, Math.PI / 2),
        new Three.MeshStandardMaterial({
          color: '#dc8757',
          roughness: 0.7,
          side: Three.DoubleSide,
        }),
        chuteModel,
        0,
        48,
        0,
        1,
        0.36,
        0.7,
      );
      for (const a of [
        0,
        Math.PI / 3,
        (Math.PI * 2) / 3,
        Math.PI,
        (Math.PI * 4) / 3,
        (Math.PI * 5) / 3,
      ])
        rod(
          chuteModel,
          new Three.Vector3(0, 16, Math.sin(a) > 0 ? 4 : -4),
          new Three.Vector3(Math.cos(a) * 32, 48, Math.sin(a) * 23),
          0.22,
          chrome,
        );
      chuteModel.visible = false;
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
      // The soft pool of light at the player's feet after dark (see PLAYER AT NIGHT).
      const playerGlowCanvas = document.createElement('canvas');
      playerGlowCanvas.width = playerGlowCanvas.height = 64;
      {
        const g = playerGlowCanvas.getContext('2d'),
          grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
      }
      const playerGlow = new Three.Mesh(
        new Three.PlaneGeometry(64, 64),
        new Three.MeshBasicMaterial({
          map: new Three.CanvasTexture(playerGlowCanvas),
          color: '#b4c2e0',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: Three.AdditiveBlending,
        }),
      );
      playerGlow.rotation.x = -Math.PI / 2;
      playerGlow.renderOrder = 3;
      playerGlow.visible = false;
      scene.add(playerGlow);
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
          if (o.material)
            for (const material of Array.isArray(o.material) ? o.material : [o.material])
              materials.add(material);
        });
      }
      collectResources(scene, sharedGeometries, sharedMaterials);
      const retiredGeometries = new Set(),
        retiredMaterials = new Set();
      function pruneModels(models, active) {
        for (const [entity, model] of models)
          if (!active.has(entity)) {
            const group = model.group || model;
            scene.remove(group);
            collectResources(group, retiredGeometries, retiredMaterials);
            models.delete(entity);
          }
      }
      function disposeRetiredModels() {
        if (!retiredGeometries.size && !retiredMaterials.size) return;
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
                while (named && !named.name && named.parent && named.parent !== scene) named = named.parent;
                while (root.parent && root.parent !== scene) root = root.parent;
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
          shadowMap: sun.shadow.mapSize.x,
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
          // small ones drop out once they would only be a few pixels across.
          for (const s of statics)
            s.group.visible =
              (viewZoom > 0.28 || s.radius >= 50) &&
              Math.abs(s.x - viewCenter.x) < viewReach + s.radius &&
              Math.abs(s.y - viewCenter.y) < viewReach + s.radius;
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
          const people = [...enemies, ...gangMembers, ...officers, ...storyActors, player];
          updateCrowd3D(deltaSeconds);
          lap = profileLap('r:crowd', lap);
          pruneModels(carModels, new Set(vehicles));
          pruneModels(personModels, new Set(people));
          pruneModels(pickupModels, new Set(pickups));
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
              // Lamps on at night and in heavy rain (weather3d.js).
              const lampsOn = vehicleLampAmount(),
                lit = c.hp > 0 && (c.ai || c === player.car) && lampsOn > 0.25;
              for (let k = 0; k < m.nightLights.length; k++) {
                const sprite = m.nightLights[k];
                sprite.visible = lit && !m.lampOut?.[k];
                if (lit) sprite.material.opacity = (k % 2 ? 0.55 : 0.85) * lampsOn;
              }
            }
            // Windscreen wipers in the rain (vehicles3d.js).
            if (m.wipers) updateWipers(c, m, deltaSeconds);
            const wear = clamp(1 - c.hp / c.maxhp, 0, 1);
            paintVehicle(c, m);
            if (m.crank) m.crank.rotation.z -= deltaSeconds * c.speed * 0.13;
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
            } else if (m.damageVersion !== c.damageVersion) {
              // Crumple, panels, glass, lamps and tyres follow the damage data (damage3d.js).
              m.damageVersion = c.damageVersion;
              applyVehicleDamage(c, m);
            }
            if (m.plane) {
              if (m.prop)
                m.prop.rotation.x += deltaSeconds * (c.hp > 0 ? 7 + (c.throttle || 0) * 80 : 0);
              m.body.rotation.set(c.bank || 0, 0, c.pitch || 0, 'ZYX');
              for (const { wheel } of m.wheels) wheel.visible = true;
            }
            if (m.tank) {
              m.turret.rotation.y = -normalizeAngle((c.turretA ?? c.a) - c.a);
              m.barrel.position.x = (-Math.max(0, (c.cannonRecoilUntil || 0) - gameTime) / 0.25) * 4;
            }
            if (m.special) {
              if (!m.plane) m.body.rotation.z = -wear * 0.025 + stance.pitch;
              if (m.bike) {
                m.body.rotation.x = clamp(c.av * 0.13, -0.28, 0.28);
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
            m.strobes.forEach((s, i) => {
              s.material.color.set(
                ((c.cop && wantedStars > 0) || c.airUnit || c.gangTarget || c.type === 'ambulance') &&
                  Math.sin(gameTime * 17 + i * 3) > 0
                  ? i
                    ? '#78aefa'
                    : '#ff6751'
                  : '#3c4147',
              );
            });
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
            const step =
              p.hp > 0 && !incapacitated && p.walking !== false ? Math.sin(p.walk || 0) * 0.5 : 0;
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
              m.torso.rotation.z = -recoil * 0.12;
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
            }
          }
          chuteModel.visible = !!player.parachute && player.parachute.stage === 'canopy';
          if (chuteModel.visible) {
            chuteModel.position.set(player.x, player.altitude, player.y);
            chuteModel.rotation.y = -player.a;
            chuteModel.scale.setScalar(Math.max(0.01, player.parachute.opening));
          }
          playerRing.visible =
            !transitRide && !taxiRide && !player.car && !player.parachute && !player.swimming;
          playerRing.position.set(player.x, 0.3 + entityElevation(player), player.y);
          // After dark: the rim light on the player's model and the pool at their feet.
          playerRim.value.copy(PLAYER_RIM_NIGHT).multiplyScalar(nightAmount * 0.6);
          playerGlow.visible = playerRing.visible && !player.hidden && nightAmount > 0.04;
          if (playerGlow.visible) {
            playerGlow.position.set(player.x, 0.4 + entityElevation(player), player.y);
            playerGlow.material.opacity = nightAmount * 0.16;
          }
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
            s.material.color.set(p.color);
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
            s.material.color.set(p.color);
            if (!p.flame) s.material.color.multiplyScalar(spriteLight);
            s.material.opacity = p.blood ? 0.97 : clamp(p.life / p.max, 0, 0.7);
            s.material.blending = p.flame ? Three.AdditiveBlending : Three.NormalBlending;
            s.scale.set(p.size * (p.blood ? 1.1 : 1.6), p.size * (p.blood ? 1.8 : 1.6), 1);
          }
          for (; pi < particlePool.length; pi++) particlePool[pi].visible = false;
          let bi = 0;
          for (const b of bullets) {
            if (bi + 6 > tracerPositions.length) break;
            tracerPositions[bi++] = b.x;
            tracerPositions[bi++] = 9 + (b.altitude || 0);
            tracerPositions[bi++] = b.y;
            tracerPositions[bi++] = b.x - b.vx * 0.009;
            tracerPositions[bi++] = 9 + (b.altitude || 0) - (b.vz || 0) * 0.009;
            tracerPositions[bi++] = b.y - b.vy * 0.009;
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
          const shadowRefresh = frames++ % shadowRefreshInterval() === 0;
          renderer.shadowMap.needsUpdate = shadowRefresh;
          lap = profileLap('r:people+fx', lap);
          // HDR scene, AO, bloom, tone curve and grade (postfx3d.js).
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
      const batchReport = batchStaticGroups();
      api.batchReport = batchReport;
      tagSceneryDetail();
      compactBuildingBlocks();
      buildFarScenery(staticBatchMeshes);
      paintLampLight();
      applyRendererQuality(graphicsTier());
      refreshEnvironment(true);
      api.resize();
      prewarmShaders();
      return api;
    }
    // END SUBSYSTEM: src/render3d.js
