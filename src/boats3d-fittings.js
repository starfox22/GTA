      /* A deck slab: white fascia edge, underside, and a teak (or other) top.
         `holes` are outlines cut right through it, for stair wells. */
      function deckSlab(parent, outline, z, thickness = 3, topMaterial = kitTeak, edge = tint('#f4f4f0'), holes = []) {
        mesh(prismGeometry(outline, outline, z - thickness, z - 0.05, false, true, 0, holes), edge, parent, 0, 0, 0);
        for (const hole of holes) mesh(prismGeometry(hole, hole, z - thickness, z - 0.05, false), edge, parent, 0, 0, 0);
        const shape = new Three.Shape(outline.map((p) => new Three.Vector2(p[0], p[1])));
        for (const hole of holes) shape.holes.push(new Three.Path(hole.map((p) => new Three.Vector2(p[0], p[1]))));
        const geo = new Three.ShapeGeometry(shape);
        // ShapeGeometry lies in x/y; stand it in x/z with planks fore and aft.
        const pos = geo.attributes.position,
          uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const u = pos.getX(i),
            v = pos.getY(i);
          pos.setXYZ(i, u, z, v);
          uv.setXY(i, u * KIT_TEAK_SCALE, v * KIT_TEAK_SCALE);
        }
        // Flip winding so the face points up after swapping axes.
        const index = geo.index;
        for (let i = 0; i < index.count; i += 3) {
          const b = index.getX(i + 1);
          index.setX(i + 1, index.getX(i + 2));
          index.setX(i + 2, b);
        }
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        return mesh(geo, topMaterial, parent, 0, 0, 0);
      }

      function rectOutline(u0, u1, v0, v1) {
        return [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ];
      }

      /* ---- Fittings ------------------------------------------------------------- */
      /* A flight of steps climbing along +u from (u0, zlo) to (u1, zhi) between v0
         and v1: teak treads, white stringers and stainless handrails. */
      function stairFlight(parent, u0, u1, v0, v1, zlo, zhi, opts = {}) {
        const { tread = kitTeak, stringer = tint('#f4f4f0'), rail = tint('#c9d0d4', 'metal'), rails = true } = opts;
        const rise = zhi - zlo,
          steps = Math.max(2, Math.round(Math.abs(rise) / 2.4)),
          run = (u1 - u0) / steps,
          width = v1 - v0,
          vc = (v0 + v1) / 2;
        for (let i = 0; i < steps; i++) {
          const z = zlo + (rise * (i + 1)) / steps;
          box(parent, u0 + run * (i + 0.5), z - 0.5, vc, Math.abs(run) + 0.2, 1, width - 1, tread);
          box(parent, u0 + run * i + 0.1, z - rise / steps / 2 - 0.5, vc, 0.4, rise / steps, width - 1, stringer);
        }
        for (const v of [v0 + 0.5, v1 - 0.5]) {
          strut(parent, [u0, zlo - 1, v], [u1, zhi - 1, v], 1.4, stringer);
          if (rails) strut(parent, [u0, zlo + 7, v], [u1, zhi + 7, v], 0.7, rail);
          if (rails)
            for (const f of [0, 0.5, 1]) {
              const u = u0 + (u1 - u0) * f,
                z = zlo + rise * f;
              box(parent, u, z + 3.5, v, 0.6, 7, 0.6, rail);
            }
        }
      }
      // A thin box from one point to another (u, z, v) with a square section.
      function strut(parent, a, b, thickness, material) {
        return rod(parent, new Three.Vector3(a[0], a[1], a[2]), new Three.Vector3(b[0], b[1], b[2]), thickness / 2, material);
      }
      function beamBox(parent, a, b, width, height, material, y) {
        // A horizontal bar between two plan points at height y (a stainless rail).
        const du = b[0] - a[0],
          dv = b[1] - a[1],
          len = Math.hypot(du, dv);
        if (len < 0.01) return null;
        const m = box(parent, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, len, height, width, material);
        m.rotation.y = -Math.atan2(dv, du);
        return m;
      }
      /**
       * Stainless railing along a polyline of plan points at deck height z:
       * stanchions every `spacing`, a top rail and a mid wire. `glass` fills the
       * panels with tinted glass instead of the wire.
       */
      function railing(parent, pts, z, height = 7, opts = {}) {
        const { spacing = 9, material = tint('#c9d0d4', 'metal'), glass = null, closed = false } = opts;
        const list = closed ? [...pts, pts[0]] : pts;
        let carry = 0;
        for (let i = 0; i < list.length - 1; i++) {
          const a = list[i],
            b = list[i + 1],
            len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          beamBox(parent, a, b, 0.7, 0.7, material, z + height);
          if (glass) {
            const pane = beamBox(parent, a, b, 0.35, height - 1.2, glass, z + (height - 1.2) / 2);
            if (pane) pane.userData.glassRail = true;
          } else beamBox(parent, a, b, 0.3, 0.3, material, z + height * 0.5);
          for (let d = spacing - carry; d <= len; d += spacing) {
            const f = d / Math.max(0.001, len);
            box(parent, a[0] + (b[0] - a[0]) * f, z + height / 2, a[1] + (b[1] - a[1]) * f, 0.6, height, 0.6, material);
          }
          carry = (carry + len) % spacing;
        }
      }
      // A sun lounger: teak frame, cushion and a raised backrest at the aft end.
      function lounger(parent, u, v, z, length = 18, width = 8, cushion = tint('#f3efe6', 'matte'), frame = kitTeak, headAft = true) {
        const g = new Three.Group();
        g.position.set(u, z, v);
        if (!headAft) g.rotation.y = Math.PI;
        parent.add(g);
        box(g, 0, 1.4, 0, length, 1.2, width, frame);
        box(g, length * 0.1, 2.6, 0, length * 0.72, 1.6, width * 0.92, cushion);
        const back = box(g, -length * 0.34, 4.2, 0, length * 0.32, 1.6, width * 0.92, cushion);
        back.rotation.z = -0.5;
        box(g, length * 0.3, 3.6, 0, 2.2, 0.8, width * 0.6, tint('#1f3550', 'matte'));
        return g;
      }
      // A settee: seat, back along one side, and scatter cushions.
      function sofa(parent, u, v, z, length, width, backSide, cushion = tint('#efeae0', 'matte'), accent = tint('#26405e', 'matte'), base = tint('#e8e6e0', 'satin')) {
        const g = new Three.Group();
        g.position.set(u, z, v);
        parent.add(g);
        box(g, 0, 1.6, 0, length, 3.2, width, base);
        box(g, 0, 3.9, 0, length - 0.8, 1.6, width - 0.8, cushion);
        // Back rest on the given side: 'aft', 'fwd', 'port' or 'starboard'.
        const alongU = backSide === 'port' || backSide === 'starboard',
          sign = backSide === 'fwd' || backSide === 'starboard' ? 1 : -1;
        if (alongU) box(g, 0, 5.6, sign * (width / 2 - 1.2), length, 5, 2.4, cushion);
        else box(g, sign * (length / 2 - 1.2), 5.6, 0, 2.4, 5, width, cushion);
        const n = Math.max(2, Math.floor((alongU ? length : width) / 7));
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n - 0.5;
          if (alongU) box(g, f * (length - 4), 5.6, sign * (width / 2 - 3), 3, 3, 1.2, i % 2 ? accent : cushion);
          else box(g, sign * (length / 2 - 3), 5.6, f * (width - 4), 1.2, 3, 3, i % 2 ? accent : cushion);
        }
        return g;
      }
      function table(parent, u, v, z, length, width, top = kitTeak, height = 5) {
        box(parent, u, z + height, v, length, 0.8, width, top);
        box(parent, u, z + height / 2, v, Math.min(3, length * 0.3), height, Math.min(3, width * 0.3), tint('#c9d0d4', 'metal'));
      }
      function diningSet(parent, u, v, z, length, width) {
        table(parent, u, v, z, length * 0.7, width * 0.42, kitTeak, 5.4);
        const chair = tint('#f1ede3', 'matte');
        const n = Math.max(2, Math.floor((length * 0.7) / 7));
        for (let i = 0; i < n; i++) {
          const cu = u + ((i + 0.5) / n - 0.5) * length * 0.66;
          for (const side of [-1, 1]) {
            box(parent, cu, z + 2.6, v + side * width * 0.36, 4.4, 1.2, 4.4, chair);
            box(parent, cu, z + 4.8, v + side * width * 0.45, 4.4, 4, 1, chair);
          }
        }
      }
      // A round hot tub: tiled rim, water and a teak surround.
      function hotTub(parent, u, v, z, radius, rim = tint('#f5f5f2')) {
        const tub = mesh(new Three.CylinderGeometry(radius, radius, 3.4, 28), rim, parent, u, z + 1.7, v);
        const water = mesh(new Three.CylinderGeometry(radius - 1.6, radius - 1.6, 0.4, 28), kitPoolWater, parent, u, z + 3.2, v);
        return { tub, water };
      }
      // An inset pool: coping, blue water and a lighter shallow step.
      function pool(parent, u, v, z, length, width) {
        const coping = tint('#f2efe8', 'satin');
        box(parent, u, z + 0.3, v - width / 2 - 1.2, length + 4.8, 0.8, 2.4, coping);
        box(parent, u, z + 0.3, v + width / 2 + 1.2, length + 4.8, 0.8, 2.4, coping);
        box(parent, u - length / 2 - 1.2, z + 0.3, v, 2.4, 0.8, width, coping);
        box(parent, u + length / 2 + 1.2, z + 0.3, v, 2.4, 0.8, width, coping);
        // The water sits just proud of the deck it is set into.
        box(parent, u, z + 0.25, v, length, 0.3, width, kitPoolWater);
        box(parent, u - length / 2 + 3, z + 0.3, v, 6, 0.3, width, tint('#8fe0e8', 'gloss'));
      }
      // A rigid-inflatable tender: grey tubes, white console, dark seat.
      function ribTender(parent, u, z, v, length, tubeColor = '#50565c', heading = 0) {
        const g = new Three.Group();
        g.position.set(u, z, v);
        g.rotation.y = heading;
        parent.add(g);
        hullMesh(g, {
          length,
          beam: length * 0.4,
          draft: length * 0.05,
          sheer: [
            [-0.5, length * 0.09],
            [0.5, length * 0.12],
          ],
          form: { transom: 0.86, maxAt: -0.1, entry: 1.6, bowShape: 0.6 },
          rake: 0.12,
          bilge: 1.2,
          colors: { bottom: '#e9e9e4', top: '#e9e9e4', boot: '#e9e9e4' },
          stations: 14,
        });
        const tube = tint(tubeColor, 'matte');
        for (const side of [-1, 1]) {
          const t = mesh(cylinderGeo, tube, g, -length * 0.08, length * 0.1, side * length * 0.17, length * 0.05, length * 0.7, length * 0.05);
          t.rotation.z = Math.PI / 2;
        }
        const bow = mesh(sphereGeo, tube, g, length * 0.3, length * 0.1, 0, length * 0.14, length * 0.05, length * 0.19);
        bow.scale.set(length * 0.16, length * 0.05, length * 0.2);
        box(g, 0, length * 0.14, 0, length * 0.12, length * 0.1, length * 0.14, tint('#f2f2ee'));
        box(g, -length * 0.15, length * 0.13, 0, length * 0.14, length * 0.05, length * 0.2, tint('#2a2f35', 'matte'));
        box(g, -length * 0.48, length * 0.1, 0, length * 0.06, length * 0.14, length * 0.08, tint('#2d3237', 'satin'));
        return g;
      }
      // A radar scanner on a pedestal; the bar is returned so it can turn.
      function radarScanner(parent, u, z, v, length = 12) {
        box(parent, u, z + 1.2, v, 2.6, 2.4, 2.6, tint('#e9e9e4'));
        const bar = new Three.Group();
        bar.position.set(u, z + 3, v);
        bar.userData.dynamic = true;
        parent.add(bar);
        const m = box(bar, 0, 0, 0, 1.4, 1.2, length, tint('#1d2226', 'satin'));
        m.userData.dynamic = true;
        return bar;
      }
      function satDome(parent, u, z, v, r = 4) {
        box(parent, u, z + r * 0.4, v, r * 0.9, r * 0.8, r * 0.9, tint('#e9e9e4'));
        return mesh(sphereGeo, tint('#f6f6f2'), parent, u, z + r * 1.4, v, r, r, r);
      }
      function fender(parent, u, z, v, size = 2.2, color = '#1c2b3d') {
        const m = mesh(cylinderGeo, tint(color, 'satin'), parent, u, z, v, size, size * 3, size);
        return m;
      }
      function bollard(parent, u, z, v, size = 1.6) {
        mesh(cylinderGeo, tint('#c9d0d4', 'metal'), parent, u, z + size, v, size, size * 2, size);
      }
      // A furled sail on a boom, as a tapered cover (the familiar blue sail cover).
      function sailCover(parent, u0, u1, z, v, color) {
        const len = u1 - u0,
          g = new Three.Group();
        parent.add(g);
        const cover = mesh(cylinderGeo, tint(color, 'matte'), g, (u0 + u1) / 2, z + 1.4, v, 1.9, len, 1.6);
        cover.rotation.z = Math.PI / 2;
        cover.scale.set(2.2, len, 1.8);
        return g;
      }

      /* ---- Names on transoms and bows ------------------------------------------ */
      /**
       * Every boat name is painted into one shared atlas so that all the name
       * boards merge into a single draw call. `kitNameBoard` returns a plane
       * whose UVs point at the boat's cell; letters are cut out with alphaTest.
       */
      const KIT_NAME_CELLS = 32,
        kitNameCanvas = document.createElement('canvas');
      kitNameCanvas.width = 1024;
      kitNameCanvas.height = 2048;
      const kitNameContext = kitNameCanvas.getContext('2d'),
        kitNameTexture = new Three.CanvasTexture(kitNameCanvas);
      kitNameTexture.colorSpace = Three.SRGBColorSpace;
      kitNameTexture.anisotropy = 4;
      const kitNameMaterial = new Three.MeshBasicMaterial({
        map: kitNameTexture,
        alphaTest: 0.45,
        side: Three.DoubleSide,
        toneMapped: false,
      });
      let kitNameCount = 0;
      // Cells are 512 x 128 pixels: two columns, sixteen rows.
      function kitNameCell(name, port, color, script = false) {
        const index = kitNameCount++ % KIT_NAME_CELLS,
          x = (index % 2) * 512,
          y = Math.floor(index / 2) * 128,
          g = kitNameContext;
        g.clearRect(x, y, 512, 128);
        g.fillStyle = color;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = script ? 'italic 700 70px Georgia, serif' : '700 64px "Helvetica Neue", Arial, sans-serif';
        const text = script ? name : name.split('').join(String.fromCharCode(8202));
        g.fillText(text, x + 256, y + (port ? 50 : 64), 488);
        if (port) {
          g.font = '600 24px "Helvetica Neue", Arial, sans-serif';
          g.fillText(port.split('').join(' '), x + 256, y + 104, 400);
        }
        kitNameTexture.needsUpdate = true;
        return index;
      }
      /* A name board `width` wide (a quarter as tall) facing +z in the parent
         frame before `rotationY` is applied. */
      function kitNameBoard(parent, name, port, color, width, x, y, z, rotationY = 0, script = false) {
        const index = kitNameCell(name, port, color, script),
          geo = new Three.PlaneGeometry(width, width / 4),
          uv = geo.attributes.uv,
          u0 = (index % 2) / 2,
          v1 = 1 - (Math.floor(index / 2) * 128) / 2048,
          v0 = v1 - 128 / 2048;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u0 + 0.5 : u0, uv.getY(i) > 0.5 ? v1 : v0);
        const m = mesh(geo, kitNameMaterial, parent, x, y, z);
        m.rotation.y = rotationY;
        m.castShadow = false;
        return m;
      }

      /* ---- Night lights ----------------------------------------------------------- */
      /**
       * Deck lights, masthead lights and cabin glows are points in one
       * THREE.Points cloud per scene area (one draw call). Register them with
       * `kitLight()` while building, then `kitLightCloud()` bakes the list.
       */
      const kitLightMaterials = [];
      function kitLightList() {
        return [];
      }
      function kitLight(list, parent, u, z, v, color = '#ffd9a0') {
        list.push({ parent, position: new Three.Vector3(u, z, v), color: kitColor(color) });
      }
      /* Lights under a group flagged `userData.lightCloud` get a cloud of their
         own inside that group, so they hide with it (the superyacht's decks);
         everything else shares one cloud in the scene. */
      function kitLightCloud(list, size = 9) {
        const byRoot = new Map();
        for (const l of list) {
          let root = l.parent;
          while (root && !root.userData.lightCloud) root = root.parent;
          root = root || scene;
          if (!byRoot.has(root)) byRoot.set(root, []);
          byRoot.get(root).push(l);
        }
        const clouds = [];
        for (const [root, lights] of byRoot) {
          root.updateWorldMatrix(true, false);
          const toRoot = new Three.Matrix4().copy(root.matrixWorld).invert(),
            positions = [],
            colors = [];
          for (const l of lights) {
            l.parent.updateWorldMatrix(true, false);
            const p = l.position.clone().applyMatrix4(l.parent.matrixWorld).applyMatrix4(toRoot);
            positions.push(p.x, p.y, p.z);
            colors.push(l.color.r, l.color.g, l.color.b);
          }
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
          geo.setAttribute('color', new Three.Float32BufferAttribute(colors, 3));
          geo.computeBoundingSphere();
          const material = new Three.PointsMaterial({
            map: haloTx,
            size,
            vertexColors: true,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: Three.AdditiveBlending,
          });
          material.userData.worldSize = size;
          kitLightMaterials.push(material);
          const points = new Three.Points(geo, material);
          points.userData.dynamic = true;
          points.renderOrder = 6;
          root.add(points);
          clouds.push(points);
        }
        return clouds;
      }
      // Soft coloured glows lying on the water (underwater lights at a stern).
      const kitWaterGlows = [];
      function kitWaterGlow(parent, u, v, size, color = '#39c6ff') {
        const m = new Three.Mesh(
          new Three.PlaneGeometry(size, size),
          new Three.MeshBasicMaterial({
            map: haloTx,
            color,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: Three.AdditiveBlending,
          }),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(u, -2.2, v);
        m.userData.dynamic = true;
        m.renderOrder = 5;
        parent.add(m);
        kitWaterGlows.push(m);
        return m;
      }
      /* Per-frame: windows and pools glow after dusk, lights fade in, and the
         points keep a constant world size whatever the zoom. */
      function updateBoatKitVisuals() {
        const night = nightAmount;
        kitGlass.emissiveIntensity = night * 0.95;
        kitBalconyGlass.emissiveIntensity = night * 0.7;
        kitBridgeGlass.emissiveIntensity = night * 0.35;
        kitPoolWater.emissiveIntensity = 0.15 + night * 0.7;
        const buffer = sceneBufferSize(kitSizeVector),
          ortho = camera.isOrthographicCamera;
        const pixelsPerUnit = ortho
          ? buffer.y / Math.max(1, (camera.top - camera.bottom) / (camera.zoom || 1))
          : buffer.y / 2 / Math.tan(((camera.fov || 50) * Math.PI) / 360);
        for (const m of kitLightMaterials) {
          m.opacity = clamp(night * 1.2 - 0.1, 0, 1);
          m.sizeAttenuation = !ortho;
          m.size = m.userData.worldSize * (ortho ? pixelsPerUnit : pixelsPerUnit / (buffer.y / 2));
          m.visible = m.opacity > 0.01;
        }
        for (const g of kitWaterGlows) {
          g.material.opacity = night * 0.7;
          g.visible = night > 0.02;
        }
      }
      const kitSizeVector = new Three.Vector2();

      /* ---- Merging ---------------------------------------------------------------- */
      /**
       * Collapse every plain mesh under `root` into one mesh per material, baking
       * tinted materials into vertex colours on their finish's shared material.
       * Subtrees flagged `userData.dynamic` (radar bars, flags) are left alone.
       * The merged meshes are added to `root` in its own frame.
       */
      function kitMerge(root) {
        root.updateMatrixWorld(true);
        const inverse = new Three.Matrix4().copy(root.matrixWorld).invert(),
          buckets = new Map(),
          taken = [],
          v = new Three.Vector3(),
          normalMatrix = new Three.Matrix3(),
          local = new Three.Matrix4();
        const visit = (o) => {
          if (o.userData.dynamic) return;
          if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && o.geometry?.attributes?.position) {
            const finish = o.material.userData.finish,
              key = finish ? '#' + finish : o.material.uuid;
            let b = buckets.get(key);
            if (!b) buckets.set(key, (b = { material: finish ? kitFinishMaterials[finish] : o.material, finish, parts: [], vertices: 0, indices: 0 }));
            const count = o.geometry.attributes.position.count;
            b.parts.push({ geo: o.geometry, matrix: local.multiplyMatrices(inverse, o.matrixWorld).clone(), color: o.material.color });
            b.vertices += count;
            b.indices += o.geometry.index ? o.geometry.index.count : count;
            taken.push(o);
          }
          for (const child of o.children) visit(child);
        };
        for (const child of root.children) visit(child);
        for (const o of taken) o.parent.remove(o);
        const results = [];
        for (const b of buckets.values()) {
          const positions = new Float32Array(b.vertices * 3),
            normals = new Float32Array(b.vertices * 3),
            uvs = new Float32Array(b.vertices * 2),
            colors = b.finish ? new Float32Array(b.vertices * 3) : null,
            indices = new Uint32Array(b.indices);
          let vo = 0,
            io = 0;
          for (const { geo, matrix, color } of b.parts) {
            const pos = geo.attributes.position,
              nor = geo.attributes.normal,
              uv = geo.attributes.uv,
              col = geo.attributes.color,
              count = pos.count;
            normalMatrix.getNormalMatrix(matrix);
            for (let i = 0; i < count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
              positions.set([v.x, v.y, v.z], (vo + i) * 3);
              if (nor) v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
              else v.set(0, 1, 0);
              normals.set([v.x, v.y, v.z], (vo + i) * 3);
              if (uv) uvs.set([uv.getX(i), uv.getY(i)], (vo + i) * 2);
              if (colors) {
                if (col) colors.set([col.getX(i), col.getY(i), col.getZ(i)], (vo + i) * 3);
                else colors.set([color.r, color.g, color.b], (vo + i) * 3);
              }
            }
            if (geo.index) {
              for (let i = 0; i < geo.index.count; i++) indices[io + i] = geo.index.getX(i) + vo;
              io += geo.index.count;
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
          if (colors) merged.setAttribute('color', new Three.BufferAttribute(colors, 3));
          merged.setIndex(new Three.BufferAttribute(indices, 1));
          merged.computeBoundingSphere();
          const m = new Three.Mesh(merged, b.material);
          m.castShadow = true;
          m.receiveShadow = true;
          m.name = 'boat batch';
          root.add(m);
          results.push(m);
        }
        return results;
      }
