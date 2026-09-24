      // BEGIN SUBSYSTEM: src/base3d.js — Fort Sentinel meshes
      /**
       * Fort Sentinel meshes
       * Source: src/base3d.js
       * Scope: createCityRenderer() closure.
       * Draws the base planned in military.js (SENTINEL): its own detailed ground
       * sheet, double fences with razor wire, watch towers with searchlights, the
       * fortified main gate (animated drop arms, bollards and sliding gates), HQ,
       * barracks, mess hall, motor pool, hangars, control tower, fuel depot,
       * ammunition bunkers, comms mast, radome and radar, water tower, range,
       * obstacle course, parade ground and flags, sandbag nests, camouflage nets,
       * containers, generators, floodlights and CCTV; military vehicle models
       * (`makeMilitaryVehicle`) and soldier kit (`dressSoldier`, `poseSoldier`).
       *
       * Static pieces go into one batched group (merged per material and cell).
       * Anything that moves is under a group flagged `userData.dynamic`. Night
       * light is additive: halos, beams and one merged mesh of ground light pools
       * (the city light map does not reach the county).
       */
      const baseGroup = new Three.Group();
      baseGroup.name = 'Fort Sentinel';
      scene.add(baseGroup);
      batchGroups.push(baseGroup);
      statics.push({ x: 9930, y: 8850, group: baseGroup, radius: 1450 });
      const baseDynamic = new Three.Group();
      baseDynamic.userData.dynamic = true;
      baseGroup.add(baseDynamic);
      // ---- Textures ------------------------------------------------------------------
      function baseTexture(w, h, paint, repeat = true) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        paint(canvas.getContext('2d'), w, h);
        const tx = new Three.CanvasTexture(canvas);
        tx.colorSpace = Three.SRGBColorSpace;
        if (repeat) tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      const chainLinkTx = baseTexture(32, 32, (g) => {
        g.strokeStyle = '#c6cccb';
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(32, 32);
        g.moveTo(32, 0);
        g.lineTo(0, 32);
        g.stroke();
      });
      const coilTx = baseTexture(64, 64, (g) => {
        g.strokeStyle = '#d3d8d6';
        g.lineWidth = 2.5;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.ellipse(32, 32, 30, 10 + k * 6, k * 0.5, 0, TAU);
          g.stroke();
        }
        g.fillStyle = '#e8ecea';
        for (let i = 0; i < 24; i++) g.fillRect((i * 37) % 64, (i * 23) % 64, 3, 2);
      });
      const netTx = baseTexture(128, 128, (g) => {
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 520; i++) {
          g.fillStyle = ['#46533a', '#5b6644', '#6d6a4b', '#394532', '#7a7552'][i % 5];
          g.beginPath();
          g.ellipse(rnd() * 128, rnd() * 128, 3 + rnd() * 6, 2 + rnd() * 3, rnd() * 3, 0, TAU);
          g.fill();
        }
        g.strokeStyle = '#2b3326';
        g.lineWidth = 1;
        for (let i = 0; i <= 128; i += 8) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i, 128);
          g.moveTo(0, i);
          g.lineTo(128, i);
          g.stroke();
        }
      });
      const ribTx = baseTexture(64, 64, (g) => {
        for (let x = 0; x < 64; x += 8) {
          const grad = g.createLinearGradient(x, 0, x + 8, 0);
          grad.addColorStop(0, '#9a9a9a');
          grad.addColorStop(0.5, '#ffffff');
          grad.addColorStop(1, '#8c8c8c');
          g.fillStyle = grad;
          g.fillRect(x, 0, 8, 64);
        }
      });
      const checkerTx = baseTexture(64, 64, (g) => {
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 2; j++) {
            g.fillStyle = (i + j) % 2 ? '#e9e6dc' : '#c2382c';
            g.fillRect(i * 16, j * 32, 16, 32);
          }
      });
      const starTx = baseTexture(
        64,
        64,
        (g) => {
          g.fillStyle = '#e8e6d8';
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 11 : 28,
              a = -Math.PI / 2 + (i * Math.PI) / 5;
            g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
          }
          g.fill();
          g.strokeStyle = '#e8e6d8';
          g.lineWidth = 3;
          g.beginPath();
          g.arc(32, 32, 30, 0, TAU);
          g.stroke();
        },
        false,
      );
      // ---- Materials (shared so the batcher can merge them) ----------------------------
      const B = {
        olive: mat('#5d6a4b', 0.82, 0.12),
        oliveDark: mat('#434c37', 0.85, 0.1),
        sand: mat('#c7b894', 0.9),
        sandDark: mat('#a4957a', 0.9),
        cream: mat('#ddd6c2', 0.85),
        roofGreen: mat('#56604b', 0.78, 0.2),
        roofGrey: mat('#77796f', 0.95),
        steel: mat('#7c8481', 0.45, 0.65),
        galv: mat('#a7afad', 0.38, 0.72),
        concreteLight: mat('#b1ad9f', 0.93),
        white: mat('#dedcd2', 0.7),
        red: mat('#a9362d', 0.6),
        yellow: mat('#d6ae34', 0.6),
        black: mat('#1d1f21', 0.85),
        earth: mat('#5d6c44', 0.98),
        dirt: mat('#7a6a4e', 0.98),
        sandbag: mat('#9c8c66', 0.98),
        canvasTop: mat('#66684a', 0.96),
        wood,
        tank: mat('#d4d1c3', 0.55, 0.2),
        glassBlue: new Three.MeshStandardMaterial({ color: '#2c4450', roughness: 0.1, metalness: 0.6 }),
        cladding: new Three.MeshStandardMaterial({ color: '#8e958e', roughness: 0.5, metalness: 0.55, map: ribTx }),
        claddingOlive: new Three.MeshStandardMaterial({ color: '#6c7658', roughness: 0.6, metalness: 0.45, map: ribTx }),
        vault: new Three.MeshStandardMaterial({ color: '#8f9690', roughness: 0.48, metalness: 0.6, map: ribTx, side: Three.DoubleSide }),
        checker: new Three.MeshStandardMaterial({ map: checkerTx, roughness: 0.6 }),
        dome: new Three.MeshStandardMaterial({ color: '#e9e7de', roughness: 0.6, flatShading: true }),
        fence: new Three.MeshStandardMaterial({ map: chainLinkTx, alphaTest: 0.35, side: Three.DoubleSide, roughness: 0.5, metalness: 0.6 }),
        screen: new Three.MeshStandardMaterial({ color: '#2d3a2f', roughness: 0.95, side: Three.DoubleSide }),
        wire: new Three.MeshStandardMaterial({ map: coilTx, alphaTest: 0.4, side: Three.DoubleSide, roughness: 0.35, metalness: 0.8 }),
        net: new Three.MeshStandardMaterial({ map: netTx, alphaTest: 0.5, side: Three.DoubleSide, roughness: 1 }),
        star: new Three.MeshStandardMaterial({ map: starTx, alphaTest: 0.5, roughness: 0.8 }),
        // Windows: dark glass by day, warm light after dark (updateBaseVisuals).
        window: new Three.MeshStandardMaterial({ color: '#1f2e37', roughness: 0.18, metalness: 0.55, emissive: '#ffd08e', emissiveIntensity: 0 }),
        lamp: new Three.MeshBasicMaterial({ color: '#fff3d6' }),
        redLamp: new Three.MeshBasicMaterial({ color: '#ff3a2c' }),
        greenLamp: new Three.MeshBasicMaterial({ color: '#5cff8a' }),
        blueLamp: new Three.MeshBasicMaterial({ color: '#5a8cff' }),
        amberLamp: new Three.MeshBasicMaterial({ color: '#ffb640' }),
      };
      const containerMats = ['#5d6a4b', '#8a7a58', '#7b4a36', '#56666d'].map(
        (c) => new Three.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0.4, map: ribTx }),
      );
      // Painted signs and plates: one material per text, lit a little at night.
      const plateMaterials = new Map(),
        plateLit = [];
      function plateMaterial(lines, { bg = '#1c2a24', fg = '#e7dcc0', header = null, headerBg = '#b8322a', w = 512, h = 128, font = 'Arial' } = {}) {
        const key = JSON.stringify([lines, bg, fg, header, headerBg, w, h]);
        if (plateMaterials.has(key)) return plateMaterials.get(key);
        const tx = baseTexture(
          w,
          h,
          (g) => {
            g.fillStyle = bg;
            g.fillRect(0, 0, w, h);
            let top = 0;
            if (header) {
              top = h * 0.3;
              g.fillStyle = headerBg;
              g.fillRect(0, 0, w, top);
              g.fillStyle = '#ffffff';
              g.font = `bold ${Math.round(top * 0.62)}px ${font}`;
              g.textAlign = 'center';
              g.textBaseline = 'middle';
              g.fillText(header, w / 2, top / 2 + 1, w * 0.92);
            }
            g.strokeStyle = fg;
            g.lineWidth = Math.max(3, h * 0.03);
            g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2);
            g.fillStyle = fg;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            const rows = Array.isArray(lines) ? lines : [lines],
              rowH = (h - top) / rows.length;
            rows.forEach((text, i) => {
              g.font = `bold ${Math.round(rowH * (rows.length > 1 ? 0.56 : 0.6))}px ${font}`;
              g.fillText(text, w / 2, top + rowH * (i + 0.5) + 1, w * 0.9);
            });
          },
          false,
        );
        const m = new Three.MeshStandardMaterial({ map: tx, roughness: 0.7, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: 0.05 });
        plateMaterials.set(key, m);
        plateLit.push(m);
        return m;
      }
      // A flat plate facing `facing` (radians: 0 = south/+z, PI/2 = east/+x).
      function plate(parent, x, y, z, w, h, material, facing = 0) {
        const m = new Three.Mesh(new Three.PlaneGeometry(w, h), material);
        m.position.set(x, y, z);
        m.rotation.y = facing;
        m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      // ---- Geometry helpers ---------------------------------------------------------
      const rodTo = (parent, ax, ay, az, bx, by, bz, r, material) =>
        rod(parent, new Three.Vector3(ax, ay, az), new Three.Vector3(bx, by, bz), r, material);
      // A vertical strip between two map points with its texture repeated every `period`.
      function strip(parent, ax, az, bx, bz, y0, height, material, period = 16) {
        const length = Math.hypot(bx - ax, bz - az),
          geo = new Three.PlaneGeometry(length, height),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * length) / period, (uv.getY(i) * height) / period);
        const m = new Three.Mesh(geo, material);
        m.position.set((ax + bx) / 2, y0 + height / 2, (az + bz) / 2);
        m.rotation.y = -Math.atan2(bz - az, bx - ax);
        m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      // A concertina coil along a line (an open tube with a looped wire texture).
      function coil(parent, ax, az, bx, bz, y, r) {
        const length = Math.hypot(bx - ax, bz - az),
          geo = new Three.CylinderGeometry(r, r, length, 7, 1, true),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, (uv.getY(i) * length) / (r * 2.2));
        const m = new Three.Mesh(geo, B.wire);
        m.position.set((ax + bx) / 2, y, (az + bz) / 2);
        m.rotation.set(0, -Math.atan2(bz - az, bx - ax), Math.PI / 2);
        parent.add(m);
        return m;
      }
      // Half-elliptic barrel vault: `width` across x, `height` up, `depth` along z.
      function vaultGeometry(width, height, depth, segments = 20) {
        const positions = [],
          indices = [],
          uvs = [];
        for (let i = 0; i <= segments; i++) {
          const a = (Math.PI * i) / segments,
            x = -Math.cos(a) * width * 0.5,
            y = Math.sin(a) * height;
          for (const z of [-depth / 2, depth / 2]) {
            positions.push(x, y, z);
            uvs.push((i / segments) * width * 0.08, (z + depth / 2) * 0.02);
          }
          if (i) {
            const k = i * 2;
            // Wound so the outside faces out (earth mounds are single-sided).
            indices.push(k - 2, k - 1, k, k - 1, k + 1, k);
          }
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
      }
      // Half-ellipse end wall, optionally with a rectangular door opening.
      function archWallGeometry(width, height, doorWidth = 0, doorHeight = 0) {
        const s = new Three.Shape();
        s.moveTo(-width / 2, 0);
        if (doorWidth) {
          s.lineTo(-doorWidth / 2, 0);
          s.lineTo(-doorWidth / 2, doorHeight);
          s.lineTo(doorWidth / 2, doorHeight);
          s.lineTo(doorWidth / 2, 0);
        }
        s.lineTo(width / 2, 0);
        s.absellipse(0, 0, width / 2, height, 0, Math.PI, false);
        const geo = new Three.ShapeGeometry(s, 16),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.08, uv.getY(i) * 0.08);
        return geo;
      }
      // A gable roof: ridge along x, `length` long, `width` across z, rising `rise`.
      function gableRoof(parent, cx, y, cz, length, width, rise, material) {
        const s = new Three.Shape();
        s.moveTo(-width / 2, 0);
        s.lineTo(width / 2, 0);
        s.lineTo(0, rise);
        s.lineTo(-width / 2, 0);
        const geo = new Three.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
        geo.translate(0, 0, -length / 2);
        geo.rotateY(Math.PI / 2);
        const m = new Three.Mesh(geo, material);
        m.position.set(cx, y, cz);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      function cylinder(parent, x, y, z, r, h, material, segments = 16, rTop = r) {
        const m = new Three.Mesh(new Three.CylinderGeometry(rTop, r, h, segments), material);
        m.position.set(x, y, z);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
        return m;
      }
      /* Merge every mesh under `root` (except those under a node in `keep`) into one
         mesh per material in root's frame: a vehicle model of forty boxes becomes a
         handful of draw calls. */
      function mergeUnder(root, keep = new Set()) {
        root.updateMatrixWorld(true);
        const inverse = new Three.Matrix4().copy(root.matrixWorld).invert(),
          buckets = new Map(),
          taken = [],
          v = new Three.Vector3(),
          n3 = new Three.Matrix3(),
          local = new Three.Matrix4();
        root.traverse((o) => {
          if (!o.isMesh || o.isSprite || Array.isArray(o.material) || o === root) return;
          for (let p = o; p && p !== root; p = p.parent) if (keep.has(p)) return;
          if (!buckets.has(o.material)) buckets.set(o.material, []);
          buckets.get(o.material).push(o);
          taken.push(o);
        });
        for (const [material, meshes] of buckets) {
          if (meshes.length < 2) continue;
          let vertices = 0,
            count = 0;
          for (const o of meshes) {
            vertices += o.geometry.attributes.position.count;
            count += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
          }
          const positions = new Float32Array(vertices * 3),
            normals = new Float32Array(vertices * 3),
            uvs = new Float32Array(vertices * 2),
            indices = new Uint32Array(count);
          let vo = 0,
            io = 0;
          for (const o of meshes) {
            const geo = o.geometry,
              pos = geo.attributes.position,
              nor = geo.attributes.normal,
              uv = geo.attributes.uv;
            local.multiplyMatrices(inverse, o.matrixWorld);
            n3.getNormalMatrix(local);
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(local);
              positions.set([v.x, v.y, v.z], (vo + i) * 3);
              if (nor) v.fromBufferAttribute(nor, i).applyMatrix3(n3).normalize();
              else v.set(0, 1, 0);
              normals.set([v.x, v.y, v.z], (vo + i) * 3);
              if (uv) uvs.set([uv.getX(i), uv.getY(i)], (vo + i) * 2);
            }
            if (geo.index) for (let i = 0; i < geo.index.count; i++) indices[io++] = geo.index.getX(i) + vo;
            else for (let i = 0; i < pos.count; i++) indices[io++] = vo + i;
            vo += pos.count;
            o.parent.remove(o);
          }
          const merged = new Three.BufferGeometry();
          merged.setAttribute('position', new Three.BufferAttribute(positions, 3));
          merged.setAttribute('normal', new Three.BufferAttribute(normals, 3));
          merged.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
          merged.setIndex(new Three.BufferAttribute(indices, 1));
          merged.computeBoundingSphere();
          const m = new Three.Mesh(merged, material);
          m.castShadow = m.receiveShadow = true;
          root.add(m);
        }
      }
      // ---- Night light: ground pools (one additive mesh) and halos ---------------------
      const glowPools = [],
        baseHalos = [],
        blinkers = [];
      function glowPool(x, z, r, color = '#ffe2b0', strength = 1) {
        glowPools.push({ x, z, r, color: new Three.Color(color).multiplyScalar(strength) });
      }
      function baseHalo(x, y, z, size, color, kind = 'lamp') {
        const s = halo(baseDynamic, x, y, z, size, color);
        s.visible = false;
        baseHalos.push({ sprite: s, kind, phase: (x * 0.013 + z * 0.007) % 1 });
        return s;
      }
      function redBeacon(x, y, z, size = 3) {
        const m = mesh(sphereGeo, B.redLamp, baseGroup, x, y, z, size * 0.5, size * 0.5, size * 0.5);
        m.castShadow = false;
        baseHalo(x, y, z, size * 9, '#ff4a36', 'beacon');
        return m;
      }
      // ---- Ground sheet -----------------------------------------------------------------
      const G = { x: 9040, y: 7730, w: 1560, h: 2240 },
        groundSheet = document.createElement('canvas');
      groundSheet.width = G.w;
      groundSheet.height = G.h;
      (function paintBaseGround() {
        const g = groundSheet.getContext('2d');
        g.translate(-G.x, -G.y);
        let seed = 4242;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const X0 = MILITARY.x,
          Y0 = MILITARY.y,
          X1 = MILITARY.x + MILITARY.w,
          Y1 = MILITARY.y + MILITARY.h,
          gate = SENTINEL.gate;
        const speckle = (x, y, w, h, colors, n, size = 3) => {
          for (let i = 0; i < n; i++) {
            g.fillStyle = colors[i % colors.length];
            g.fillRect(x + rnd() * w, y + rnd() * h, 1 + rnd() * size, 1 + rnd() * size);
          }
        };
        const slab = (a, fill, joint = 40, jointColor = '#00000022') => {
          g.fillStyle = fill;
          g.fillRect(a.x, a.y, a.w, a.h);
          speckle(a.x, a.y, a.w, a.h, ['#ffffff10', '#00000012'], (a.w * a.h) / 90);
          g.strokeStyle = jointColor;
          g.lineWidth = 1;
          g.beginPath();
          for (let x = a.x + joint; x < a.x + a.w; x += joint) {
            g.moveTo(x, a.y);
            g.lineTo(x, a.y + a.h);
          }
          for (let y = a.y + joint; y < a.y + a.h; y += joint) {
            g.moveTo(a.x, y);
            g.lineTo(a.x + a.w, y);
          }
          g.stroke();
        };
        const asphalt = '#4b5153';
        const road = (points, width, { centre = '#d8b64a', dash = true, edges = true } = {}) => {
          g.strokeStyle = asphalt;
          g.lineWidth = width;
          g.lineCap = 'butt';
          g.beginPath();
          g.moveTo(points[0][0], points[0][1]);
          for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
          g.stroke();
          if (centre) {
            g.strokeStyle = centre;
            g.lineWidth = 2;
            g.setLineDash(dash ? [18, 14] : []);
            g.beginPath();
            g.moveTo(points[0][0], points[0][1]);
            for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
            g.stroke();
            g.setLineDash([]);
          }
          if (edges && points.length === 2) {
            const [a, b] = points,
              len = Math.hypot(b[0] - a[0], b[1] - a[1]),
              nx = -(b[1] - a[1]) / len,
              ny = (b[0] - a[0]) / len;
            g.strokeStyle = '#d9d6c8';
            g.lineWidth = 1.5;
            for (const side of [-1, 1]) {
              const o = side * (width / 2 - 4);
              g.beginPath();
              g.moveTo(a[0] + nx * o, a[1] + ny * o);
              g.lineTo(b[0] + nx * o, b[1] + ny * o);
              g.stroke();
            }
          }
        };
        const text = (t, x, y, size, color = '#e2dfcf', rotation = 0) => {
          g.save();
          g.translate(x, y);
          g.rotate(rotation);
          g.fillStyle = color;
          g.font = `bold ${size}px Arial`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(t, 0, 0);
          g.restore();
        };
        // Grass inside the fence, with mowing stripes and mottling.
        g.fillStyle = '#687452';
        g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
        for (let y = Y0; y < Y1; y += 24) {
          g.fillStyle = (y / 24) % 2 ? '#ffffff08' : '#0000000a';
          g.fillRect(X0, y, X1 - X0, 12);
        }
        speckle(X0, Y0, X1 - X0, Y1 - Y0, ['#7d8a5f55', '#4f5c3e55', '#8f8a5c44', '#3f4a3355'], 26000, 4);
        // Gravel clear zone along the double fence.
        g.fillStyle = '#9a958a';
        g.fillRect(X0 - 10, Y0 - 10, X1 - X0 + 20, 58);
        g.fillRect(X0 - 10, Y1 - 48, X1 - X0 + 20, 58);
        g.fillRect(X0 - 10, Y0 - 10, 58, Y1 - Y0 + 20);
        g.fillRect(X1 - 48, Y0 - 10, 58, Y1 - Y0 + 20);
        speckle(X0 - 10, Y0 - 10, X1 - X0 + 20, 58, ['#6f6b62', '#c2bdb0'], 4000, 2);
        speckle(X0 - 10, Y1 - 48, X1 - X0 + 20, 58, ['#6f6b62', '#c2bdb0'], 4000, 2);
        speckle(X0 - 10, Y0, 58, Y1 - Y0, ['#6f6b62', '#c2bdb0'], 7000, 2);
        speckle(X1 - 48, Y0, 58, Y1 - Y0, ['#6f6b62', '#c2bdb0'], 7000, 2);
        // Gate approach: the causeway road, the checkpoint lanes and the island.
        g.fillStyle = asphalt;
        g.fillRect(G.x, gate.opening[0] - 12, X0 + 60 - G.x, gate.opening[1] - gate.opening[0] + 24);
        g.fillStyle = '#9a958a';
        g.fillRect(G.x, gate.opening[0] - 45, X0 - G.x, 33);
        g.fillRect(G.x, gate.opening[1] + 12, X0 - G.x, 33);
        speckle(G.x, gate.opening[0] - 45, X0 - G.x, 33, ['#6f6b62', '#c2bdb0'], 1200, 2);
        speckle(G.x, gate.opening[1] + 12, X0 - G.x, 33, ['#6f6b62', '#c2bdb0'], 1200, 2);
        g.fillStyle = '#d9d6c8';
        for (const lane of gate.lanes) {
          g.fillRect(G.x, lane.y0 + 3, X0 - G.x, 1.5);
          g.fillRect(G.x, lane.y1 - 4.5, X0 - G.x, 1.5);
        }
        // Stop lines, STOP stencils and rumble strips before the booth.
        for (const lane of gate.lanes) {
          const inbound = !lane.out,
            cy = (lane.y0 + lane.y1) / 2;
          g.fillStyle = '#ece8da';
          g.fillRect(inbound ? gate.checkpoint - 34 : 9330, lane.y0 + 4, 5, lane.y1 - lane.y0 - 8);
          text('STOP', inbound ? gate.checkpoint - 58 : 9352, cy, 20, '#ece8da', inbound ? -Math.PI / 2 : Math.PI / 2);
          text('SLOW', inbound ? 9110 : 9420, cy, 18, '#ece8da', inbound ? -Math.PI / 2 : Math.PI / 2);
          for (let k = 0; k < 4; k++) {
            g.fillStyle = k % 2 ? '#1e2021' : '#d8b23a';
            for (let s = 0; s < 6; s++) g.fillRect(inbound ? 9146 + k * 4 : 9360 + k * 4, lane.y0 + 4 + s * 12, 4, 6);
          }
        }
        // Yellow hatching round the island nose.
        g.strokeStyle = '#d8b23a';
        g.lineWidth = 3;
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.moveTo(gate.island.x - 70 + k * 12, 8138);
          g.lineTo(gate.island.x - 60 + k * 12, 8162);
          g.stroke();
        }
        // Base roads.
        const pr = SENTINEL.perimeterRoad;
        road(
          [
            [pr.x0, pr.y0],
            [pr.x1, pr.y0],
            [pr.x1, pr.y1],
            [pr.x0, pr.y1],
            [pr.x0, pr.y0],
          ],
          pr.width,
          { edges: false },
        );
        for (const r of SENTINEL.roads) road(r.points, r.width, r.name === 'SENTINEL AVENUE' ? { dash: false } : {});
        // Avenue: double yellow centre and crossings.
        g.fillStyle = '#d8b64a';
        g.fillRect(9330, 8146, 1110, 2);
        g.fillRect(9330, 8152, 1110, 2);
        for (const x of [9740, 10000])
          for (let y = 8104; y < 8196; y += 10) {
            g.fillStyle = '#e6e2d4';
            g.fillRect(x - 12, y, 24, 5);
          }
        // Paved areas.
        slab(SENTINEL.hqLot, '#55595a', 1000);
        g.strokeStyle = '#e1ddcf';
        g.lineWidth = 1.5;
        for (let y = SENTINEL.hqLot.y + 12; y < SENTINEL.hqLot.y + SENTINEL.hqLot.h - 10; y += 38) {
          g.beginPath();
          g.moveTo(SENTINEL.hqLot.x + 6, y);
          g.lineTo(SENTINEL.hqLot.x + 60, y);
          g.stroke();
        }
        slab(SENTINEL.motorPool, '#8f8d84', 40);
        g.strokeStyle = '#d8b23a';
        g.lineWidth = 2;
        for (const row of [8950, 9080])
          for (let x = 9446; x < 9950; x += 45) {
            g.beginPath();
            g.moveTo(x, row - 46);
            g.lineTo(x, row + 46);
            g.stroke();
          }
        for (let i = 0; i < 26; i++) {
          g.fillStyle = '#2a2a2a22';
          g.beginPath();
          g.ellipse(9460 + rnd() * 480, 8900 + rnd() * 310, 6 + rnd() * 10, 4 + rnd() * 6, rnd() * 3, 0, TAU);
          g.fill();
        }
        text('MOTOR POOL', 9700, 9205, 18, '#d8b23a');
        // Parade ground: asphalt, marching grid, the crest.
        const pa = SENTINEL.parade;
        g.fillStyle = '#595d5c';
        g.fillRect(pa.x, pa.y, pa.w, pa.h);
        speckle(pa.x, pa.y, pa.w, pa.h, ['#ffffff0c', '#0000000f'], 5000);
        g.strokeStyle = '#e4e0d0';
        g.lineWidth = 3;
        g.strokeRect(pa.x + 8, pa.y + 8, pa.w - 16, pa.h - 16);
        g.lineWidth = 1;
        g.strokeStyle = '#e4e0d055';
        for (let x = pa.x + 30; x < pa.x + pa.w - 20; x += 30) {
          g.beginPath();
          g.moveTo(x, pa.y + 12);
          g.lineTo(x, pa.y + pa.h - 12);
          g.stroke();
        }
        const cx = pa.x + pa.w / 2,
          cy = pa.y + pa.h / 2;
        g.strokeStyle = '#d9c68a';
        g.lineWidth = 5;
        g.beginPath();
        g.arc(cx, cy, 58, 0, TAU);
        g.stroke();
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, 48, 0, TAU);
        g.stroke();
        g.fillStyle = '#d9c68a';
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 14 : 36,
            a = -Math.PI / 2 + (i * Math.PI) / 5;
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.fill();
        text('FORT SENTINEL', cx, cy + 80, 20, '#d9c68a');
        // Footpaths between the buildings.
        g.fillStyle = '#aaa596';
        for (const [x, y, w, h] of [
          [9960, 8200, 30, 480],
          [10030, 8325, 380, 60],
          [10030, 8475, 380, 60],
          [9560, 8575, 400, 26],
          [9690, 8036, 100, 64],
          [9550, 7890, 16, 150],
          [10010, 8625, 220, 24],
          [9440, 8240, 110, 16],
        ])
          g.fillRect(x, y, w, h);
        // Building pads.
        for (const b of SENTINEL.buildings) {
          g.fillStyle = '#7f7d74';
          g.fillRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        }
        // Obstacle course sand, range dirt, fuel gravel, bunker aprons.
        const oc = SENTINEL.obstacleCourse;
        g.fillStyle = '#ad9a73';
        g.fillRect(oc.x, oc.y, oc.w, oc.h);
        speckle(oc.x, oc.y, oc.w, oc.h, ['#8e7c58', '#c8b58c'], 3000, 2);
        const rg = SENTINEL.range;
        g.fillStyle = '#86775a';
        g.fillRect(rg.x, rg.y, rg.w, rg.h);
        speckle(rg.x, rg.y, rg.w, rg.h, ['#6f6148', '#a08e6c'], 3000, 2);
        g.strokeStyle = '#d9d6c8aa';
        g.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          g.beginPath();
          g.moveTo(rg.x + 40, rg.y + i * 20);
          g.lineTo(rg.targetsX, rg.y + i * 20);
          g.stroke();
        }
        for (let x = rg.x + 90; x < rg.targetsX; x += 60) text(String(Math.round((x - rg.x - 40) / 5.12 / 25) * 25), x, rg.y - 7, 9, '#e2dfcf');
        const fb = SENTINEL.fuel.bund;
        slab({ x: fb.x - 6, y: fb.y - 6, w: fb.w + 12, h: fb.h + 12 }, '#8a877d', 1000);
        g.fillStyle = '#958e7c';
        g.fillRect(fb.x, fb.y, fb.w, fb.h);
        speckle(fb.x, fb.y, fb.w, fb.h, ['#6f6b62', '#c2bdb0'], 5000, 2);
        slab({ x: 10040, y: 8990, w: 260, h: 70 }, '#86847b', 30);
        for (const b of SENTINEL.bunkers) {
          g.fillStyle = '#9a958a';
          g.fillRect(b.x - 24, b.y + 8, 26, b.h - 16);
        }
        // Comms compound pad and the radome yard.
        slab({ x: 10010, y: 7905, w: 440, h: 160 }, '#8b897f', 40);
        // Airfield: apron, taxiway, runway and helipads.
        slab(SENTINEL.apron, '#9a978c', 45);
        slab(SENTINEL.taxiway, '#9a978c', 45);
        for (const h of [
          { x: 9440, y: 9430, w: 220, h: 18 },
          { x: 9700, y: 9430, w: 220, h: 18 },
        ])
          slab(h, '#9a978c', 45);
        g.strokeStyle = '#e0bd3c';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(9990, 9750);
        g.lineTo(9990, 9560);
        g.lineTo(9550, 9560);
        g.moveTo(9990, 9560);
        g.lineTo(10420, 9560);
        g.moveTo(9550, 9560);
        g.lineTo(9550, 9432);
        g.moveTo(9810, 9560);
        g.lineTo(9810, 9432);
        g.stroke();
        for (const x of [9550, 9810]) {
          g.strokeStyle = '#e0bd3c';
          g.strokeRect(x - 48, 9500, 96, 44);
          text(x === 9550 ? 'H1' : 'H2', x, 9588, 14, '#e0bd3c');
        }
        const rw = SENTINEL.runway;
        g.fillStyle = '#3c4244';
        g.fillRect(rw.x, rw.y, rw.w, rw.h);
        speckle(rw.x, rw.y, rw.w, rw.h, ['#ffffff09', '#00000014'], 9000);
        for (const x of [rw.x + 60, rw.x + rw.w - 110])
          for (let k = 0; k < 6; k++) {
            g.fillStyle = '#1f2224';
            g.globalAlpha = 0.35;
            g.fillRect(x + rnd() * 50, rw.y + 20 + k * 9, 30 + rnd() * 30, 3);
            g.globalAlpha = 1;
          }
        g.fillStyle = '#e8e5d6';
        g.fillRect(rw.x, rw.y + 3, rw.w, 2);
        g.fillRect(rw.x, rw.y + rw.h - 5, rw.w, 2);
        for (let x = rw.x + 120; x < rw.x + rw.w - 120; x += 60) g.fillRect(x, rw.y + rw.h / 2 - 1.5, 32, 3);
        for (const end of [0, 1]) {
          const x = end ? rw.x + rw.w - 36 : rw.x + 6;
          for (let k = 0; k < 8; k++) if (k !== 3 && k !== 4) g.fillRect(x, rw.y + 8 + k * 10, 30, 5);
          text(end ? '27' : '09', end ? rw.x + rw.w - 60 : rw.x + 60, rw.y + rw.h / 2, 30, '#e8e5d6', end ? Math.PI / 2 : -Math.PI / 2);
          for (const dy of [-26, 26]) g.fillRect(end ? rw.x + rw.w - 160 : rw.x + 120, rw.y + rw.h / 2 + dy - 3, 40, 6);
        }
        for (const p of SENTINEL.helipads) {
          slab({ x: p.x - 58, y: p.y - 58, w: 116, h: 116 }, '#8e8b80', 1000);
          g.strokeStyle = '#e6e2d2';
          g.lineWidth = 4;
          g.beginPath();
          g.arc(p.x, p.y, p.r - 4, 0, TAU);
          g.stroke();
          text('H', p.x, p.y + 2, 54, '#e6e2d2');
        }
        // Lawn in front of HQ with a gravel crest.
        g.fillStyle = '#6f7d54';
        g.fillRect(9570, 8040, 340, 58);
        for (let x = 9570; x < 9910; x += 20) {
          g.fillStyle = (x / 20) % 2 ? '#ffffff0a' : '#0000000c';
          g.fillRect(x, 8040, 10, 58);
        }
        // Outside the fence: tidy the verge the sheet covers (one path: each
        // destination-in fill clears everything outside itself).
        g.globalCompositeOperation = 'destination-in';
        g.fillStyle = '#000';
        g.beginPath();
        g.rect(X0 - 12, Y0 - 12, X1 - X0 + 24, Y1 - Y0 + 24);
        g.rect(G.x, gate.opening[0] - 45, X0 - G.x + 1, gate.opening[1] - gate.opening[0] + 90);
        g.fill();
        g.globalCompositeOperation = 'source-over';
      })();
      {
        const tx = new Three.CanvasTexture(groundSheet);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const groundMaterial = new Three.MeshStandardMaterial({ map: tx, roughness: 0.93, alphaTest: 0.5 }),
          ground = new Three.Mesh(new Three.PlaneGeometry(G.w, G.h), groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        // Above the causeway deck (0.4), which runs on into the gate.
        ground.position.set(G.x + G.w / 2, 0.46, G.y + G.h / 2);
        ground.receiveShadow = true;
        ground.name = 'Fort Sentinel ground';
        scene.add(ground);
        countyGroundMaterials.push(groundMaterial);
        statics.push({ x: G.x + G.w / 2, y: G.y + G.h / 2, group: ground, radius: 1400 });
      }
      // ---- Perimeter: double fence, razor wire, towers, CCTV, signs --------------------
      {
        const X0 = MILITARY.x,
          Y0 = MILITARY.y,
          X1 = MILITARY.x + MILITARY.w,
          Y1 = MILITARY.y + MILITARY.h,
          f = SENTINEL.fence,
          gate = SENTINEL.gate;
        // One fence run: posts, fabric, top rail, outrigger arms, strands and a coil.
        const fenceRun = (ax, az, bx, bz, outX, outZ, screen) => {
          const length = Math.hypot(bx - ax, bz - az),
            n = Math.max(1, Math.round(length / 26));
          strip(baseGroup, ax, az, bx, bz, 0.5, 13, B.fence, 6);
          if (screen) strip(baseGroup, ax + outX * 0.6, az + outZ * 0.6, bx + outX * 0.6, bz + outZ * 0.6, 0.5, 10, B.screen, 20);
          for (let i = 0; i <= n; i++) {
            const x = ax + ((bx - ax) * i) / n,
              z = az + ((bz - az) * i) / n;
            box(baseGroup, x, 7.5, z, 1.3, 15, 1.3, B.galv);
            rodTo(baseGroup, x, 14.5, z, x + outX * 4, 18, z + outZ * 4, 0.3, B.galv);
          }
          strip(baseGroup, ax, az, bx, bz, 13.2, 0.8, B.galv, 100);
          for (const k of [1.6, 2.8, 4])
            box(baseGroup, (ax + bx) / 2 + outX * k, 15.2 + k * 0.7, (az + bz) / 2 + outZ * k, Math.abs(bx - ax) + 0.3, 0.25, Math.abs(bz - az) + 0.3, B.galv);
          coil(baseGroup, ax, az, bx, bz, 16.5, 2.4);
        };
        const side = (ax, az, bx, bz, nx, nz, skip) => {
          // Outer fence on the line, inner fence `f` inside it, skipping the gate.
          for (const [o, screen] of [
            [1, true],
            [f - 1, false],
          ]) {
            const x0 = ax + nx * o,
              z0 = az + nz * o,
              x1 = bx + nx * o,
              z1 = bz + nz * o;
            if (skip) {
              fenceRun(x0, z0, x0, skip[0], -nx, -nz, screen);
              fenceRun(x0, skip[1], x1, z1, -nx, -nz, screen);
            } else fenceRun(x0, z0, x1, z1, -nx, -nz, screen);
          }
        };
        side(X0, Y0, X1, Y0, 0, 1);
        side(X0, Y1, X1, Y1, 0, -1);
        side(X1, Y0, X1, Y1, -1, 0);
        side(X0, Y0, X0, Y1, 1, 0, gate.opening);
        // Gate posts either side of the opening and on the centre fence stub.
        for (const z of [gate.opening[0] - 3, gate.lanes[0].y1 + 2, gate.lanes[1].y0 - 2, gate.opening[1] + 3]) {
          box(baseGroup, X0 + 1, 11, z, 4, 22, 4, B.steel);
          box(baseGroup, X0 + f - 1, 11, z, 4, 22, 4, B.steel);
          box(baseGroup, X0 + f / 2, 21, z, f, 2, 2, B.steel);
        }
        // Warning signs along the outer fence, facing out.
        const warn = plateMaterial(['USE OF DEADLY FORCE', 'AUTHORIZED'], { header: 'RESTRICTED AREA', bg: '#f1eee4', fg: '#1d1f22' });
        const keepOut = plateMaterial(['MILITARY INSTALLATION', 'NO TRESPASSING'], { header: 'WARNING', bg: '#f1eee4', fg: '#1d1f22', headerBg: '#c9392d' });
        let k = 0;
        for (let x = X0 + 150; x < X1 - 60; x += 240) {
          plate(baseGroup, x, 8, Y1 + 0.2, 26, 13, k++ % 2 ? keepOut : warn, 0);
          plate(baseGroup, x, 8, Y0 - 0.2, 26, 13, k % 2 ? keepOut : warn, Math.PI);
        }
        for (let z = Y0 + 150; z < Y1 - 60; z += 240) {
          plate(baseGroup, X1 + 0.2, 8, z, 26, 13, k++ % 2 ? keepOut : warn, Math.PI / 2);
          if (z < gate.opening[0] - 60 || z > gate.opening[1] + 60) plate(baseGroup, X0 - 0.2, 8, z, 26, 13, k % 2 ? keepOut : warn, -Math.PI / 2);
        }
        // CCTV poles.
        for (const [x, z] of SENTINEL.cctv) {
          box(baseGroup, x, 11, z, 1.4, 22, 1.4, B.oliveDark);
          const out = x < X0 + 60 ? -1 : x > X1 - 60 ? 1 : 0,
            outZ = out ? 0 : z < Y0 + 60 ? -1 : 1,
            hx = x + out * 3,
            hz = z + outZ * 3;
          box(baseGroup, hx, 21.5, hz, out ? 6 : 2.6, 2.4, out ? 2.6 : 6, B.cream);
          box(baseGroup, hx + out * 3.2, 21.5, hz + outZ * 3.2, out ? 0.4 : 1.6, 1.6, out ? 1.6 : 0.4, B.black);
          box(baseGroup, x, 16, z, 2.4, 3.4, 2.4, B.oliveDark);
        }
      }
      // Watch towers, each with a searchlight that sweeps at night.
      const searchlights = [];
      for (const [i, t] of SENTINEL.towers.entries()) {
        const x = t.x,
          z = t.y,
          floor = SENTINEL.towerFloor - 2;
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) rodTo(baseGroup, x + sx * 13, 0, z + sz * 13, x + sx * 10, floor, z + sz * 10, 0.9, B.steel);
        for (const lv of [0, 1]) {
          const y0 = lv * floor * 0.5,
            y1 = y0 + floor * 0.5,
            r0 = 13 - lv * 1.5,
            r1 = 11.5 - lv * 1.5;
          for (const s of [-1, 1]) {
            rodTo(baseGroup, x - r0, y0, z + s * r0, x + r1, y1, z + s * r1, 0.35, B.steel);
            rodTo(baseGroup, x + s * r0, y0, z - r0, x + s * r1, y1, z + r1, 0.35, B.steel);
          }
        }
        box(baseGroup, x, floor, z, 28, 1.6, 28, B.oliveDark);
        // Armoured lower cab, glazing, corner posts, roof.
        for (const [dx, dz, w, d] of [
          [0, -12.5, 26, 1],
          [0, 12.5, 26, 1],
          [-12.5, 0, 1, 26],
          [12.5, 0, 1, 26],
        ]) {
          box(baseGroup, x + dx, floor + 4, z + dz, w, 7, d, B.olive);
          box(baseGroup, x + dx, floor + 10, z + dz, w * 0.96, 5, d * 0.96, B.window);
        }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(baseGroup, x + sx * 12.5, floor + 7, z + sz * 12.5, 1.4, 14, 1.4, B.oliveDark);
        box(baseGroup, x, floor + 14.5, z, 32, 1.4, 32, B.roofGreen);
        box(baseGroup, x, floor + 15.6, z, 20, 1, 20, B.roofGreen);
        // Ladder up one leg.
        for (let y = 2; y < floor; y += 3) box(baseGroup, x + 14, y, z + 4, 0.4, 0.4, 5, B.steel);
        rodTo(baseGroup, x + 14, 0, z + 1.5, x + 12, floor, z + 1.5, 0.3, B.steel);
        rodTo(baseGroup, x + 14, 0, z + 6.5, x + 12, floor, z + 6.5, 0.3, B.steel);
        // Sandbags round the tower foot.
        for (let a = 0; a < 8; a++) box(baseGroup, x + Math.cos((a * TAU) / 8) * 17, 1.4, z + Math.sin((a * TAU) / 8) * 17, 7, 2.8, 4, B.sandbag);
        // Searchlight (moves), beam and ground spot (added by the night pass).
        const head = new Three.Group();
        head.position.set(x, floor + 17.5, z);
        baseDynamic.add(head);
        box(head, 0, 0, 0, 2.5, 2, 2.5, B.oliveDark);
        const lampBody = new Three.Group();
        lampBody.position.set(0, 2.5, 0);
        head.add(lampBody);
        mesh(cylinderGeo, B.oliveDark, lampBody, 1.5, 0, 0, 2.6, 5, 2.6).rotation.z = Math.PI / 2;
        const lens = mesh(cylinderGeo, B.lamp, lampBody, 4.1, 0, 0, 2.3, 0.3, 2.3);
        lens.rotation.z = Math.PI / 2;
        lens.castShadow = false;
        const beam = new Three.Mesh(
          (() => {
            const geo = new Three.CylinderGeometry(0.08, 1, 1, 18, 1, true);
            geo.translate(0, -0.5, 0);
            return geo;
          })(),
          new Three.MeshBasicMaterial({ color: '#fff2cf', transparent: true, opacity: 0.1, blending: Three.AdditiveBlending, depthWrite: false, side: Three.DoubleSide }),
        );
        beam.visible = false;
        baseDynamic.add(beam);
        const spot = new Three.Mesh(
          new Three.PlaneGeometry(1, 1),
          new Three.MeshBasicMaterial({ map: haloTx, color: '#fff0c8', transparent: true, opacity: 0.6, blending: Three.AdditiveBlending, depthWrite: false }),
        );
        spot.rotation.x = -Math.PI / 2;
        spot.visible = false;
        baseDynamic.add(spot);
        const beamHalo = baseHalo(x, floor + 20, z, 26, '#fff4d8');
        searchlights.push({ tower: t, head, lampBody, beam, spot, halo: beamHalo, phase: i * 1.7, aim: t.a, target: null });
      }
      // ---- Main gate -------------------------------------------------------------------
      const gateParts = [];
      {
        const g = SENTINEL.gate,
          grp = new Three.Group();
        baseGroup.add(grp);
        // Island kerb with striped nose.
        box(grp, g.island.x + g.island.w / 2, 1.6, 8150, g.island.w, 3.2, g.island.h, B.concreteLight);
        for (let k = 0; k < 6; k++) box(grp, g.island.x + 2 + k * 4, 1.7, 8150, 2, 3.3, g.island.h + 0.2, k % 2 ? B.black : B.yellow);
        // Booth: armoured base, glazing, overhanging roof, door and desk.
        const bx = g.booth.x + g.booth.w / 2,
          bz = g.booth.y + g.booth.h / 2;
        box(grp, bx, 4.5, bz, g.booth.w, 9, g.booth.h, B.cream);
        for (const [dx, dz, w, d] of [
          [0, -g.booth.h / 2, g.booth.w, 0.6],
          [0, g.booth.h / 2, g.booth.w, 0.6],
          [-g.booth.w / 2, 0, 0.6, g.booth.h],
          [g.booth.w / 2, 0, 0.6, g.booth.h],
        ])
          box(grp, bx + dx, 14, bz + dz, w, 9, d, B.window);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(grp, bx + sx * g.booth.w * 0.5, 14, bz + sz * g.booth.h * 0.5, 1.4, 9, 1.4, B.cream);
        box(grp, bx, 19.5, bz, g.booth.w + 8, 2, g.booth.h + 8, B.roofGreen);
        box(grp, bx, 21.5, bz, 10, 3, 6, B.steel);
        box(grp, bx + 12, 5, bz + g.booth.h / 2 + 0.3, 7, 10, 0.4, B.oliveDark);
        plate(grp, bx, 16.5, bz + g.booth.h / 2 + 0.8, 18, 4.5, plateMaterial('MILITARY POLICE', { bg: '#182338', fg: '#f0e6c8' }), 0);
        // Canopy over both lanes: an open steel frame (a solid roof would hide the
        // booth and barriers from the camera), with light bars under the beams.
        const cp = g.canopy,
          ccx = (cp.x0 + cp.x1) / 2,
          ccz = (cp.y0 + cp.y1) / 2;
        for (const x of [cp.x0 + 6, cp.x1 - 6])
          for (const z of [cp.y0 + 4, 8150, cp.y1 - 4]) box(grp, x, cp.height / 2, z, 3.5, cp.height, 3.5, B.white);
        for (const x of [cp.x0 + 1.5, cp.x1 - 1.5]) box(grp, x, cp.height + 2, ccz, 3, 4, cp.y1 - cp.y0, B.olive);
        for (const z of [cp.y0 + 1.5, cp.y1 - 1.5]) box(grp, ccx, cp.height + 2, z, cp.x1 - cp.x0, 4, 3, B.olive);
        for (let z = cp.y0 + 20; z < cp.y1 - 10; z += 20) box(grp, ccx, cp.height + 1, z, cp.x1 - cp.x0 - 2, 2, 1.6, B.white);
        box(grp, ccx, cp.height + 1, 8150, cp.x1 - cp.x0 - 2, 2.4, 3, B.white);
        plate(grp, cp.x0 - 1.2, cp.height + 3, 8150, 150, 6, plateMaterial('FORT SENTINEL · MAIN GATE · ALL VEHICLES SUBJECT TO SEARCH', { w: 1024, h: 48, bg: '#2b3527', fg: '#efe3c0' }), -Math.PI / 2);
        plate(grp, ccx, cp.height + 3, cp.y1 + 1.3, cp.x1 - cp.x0 - 6, 5, plateMaterial('FORT SENTINEL · MAIN GATE', { w: 512, h: 32, bg: '#2b3527', fg: '#efe3c0' }), 0);
        for (const lane of g.lanes) {
          const lz = (lane.y0 + lane.y1) / 2;
          for (const x of [cp.x0 + 20, ccx, cp.x1 - 20]) {
            const l = box(grp, x, cp.height - 0.2, lz, 3, 0.5, 14, B.lamp);
            l.castShadow = false;
          }
          glowPool(ccx, lz, 70, '#fff0d0', 1.2);
          baseHalo(ccx, cp.height - 2, lz, 30, '#fff0d4');
          // Traffic light on the island facing inbound traffic.
        }
        box(grp, g.island.x + 20, 7, 8150, 1.2, 14, 1.2, B.black);
        box(grp, g.island.x + 20, 15, 8150, 2.4, 6, 2.6, B.black);
        const stopLamp = mesh(sphereGeo, B.redLamp, grp, g.island.x + 18.7, 16.5, 8150, 0.9, 0.9, 0.9);
        stopLamp.castShadow = false;
        // Jersey-barrier funnel and median.
        const jersey = (x0, x1, z) => {
          for (let x = x0, k = 0; x < x1 - 4; x += 20, k++) {
            box(grp, x + 9.5, 1.2, z, 19, 2.4, 4.2, B.concreteLight);
            box(grp, x + 9.5, 4.2, z, 18.6, 3.8, 2.4, B.concreteLight);
            for (const s of [-1, 1]) box(grp, x + 9.5, 4.6, z + s * 1.25, 6, 1.2, 0.1, k % 2 ? B.red : B.white);
          }
        };
        jersey(g.funnel.x0, g.funnel.x1, g.opening[0] - 6);
        jersey(g.funnel.x0, g.funnel.x1, g.opening[1] + 6);
        jersey(g.funnel.x0 + 10, g.island.x, 8150);
        // Signs on the approach.
        const warnBig = plateMaterial(['USE OF DEADLY FORCE AUTHORIZED', 'PHOTOGRAPHY PROHIBITED'], { header: 'WARNING · RESTRICTED AREA', bg: '#f3efe4', fg: '#1d1f22', w: 768, h: 256 });
        for (const [x, z] of [
          [9120, 8026],
          [9120, 8282],
        ]) {
          for (const dx of [-15, 15]) box(grp, x + dx, 9, z, 1.3, 18, 1.3, B.galv);
          plate(grp, x, 15, z + 0.9, 36, 12, warnBig, 0);
          box(grp, x, 15, z, 37, 13, 1.2, B.steel);
        }
        const stopSign = plateMaterial(['STOP', 'ID CHECK'], { bg: '#b8322a', fg: '#ffffff', w: 256, h: 256 });
        box(grp, 9186, 6, 8252, 1, 12, 1, B.galv);
        plate(grp, 9186, 12, 8253, 10, 10, stopSign, 0);
        const speed = plateMaterial(['SPEED', 'LIMIT', '10'], { bg: '#f3efe4', fg: '#1d1f22', w: 192, h: 256 });
        box(grp, 9060, 6, 8250, 1, 12, 1, B.galv);
        plate(grp, 9060, 12, 8251, 7.5, 10, speed, 0);
        // The entrance monument: stone wall with the base name and crest.
        const mx = 9150,
          mz = 7996;
        box(grp, mx, 6, mz, 92, 12, 8, B.sandDark);
        box(grp, mx, 12.8, mz, 96, 1.6, 10, B.cream);
        for (const dx of [-50, 50]) box(grp, mx + dx, 8, mz, 10, 16, 10, B.sandDark);
        plate(grp, mx + 6, 6.5, mz + 4.2, 70, 9, plateMaterial(['FORT SENTINEL', 'SOUTH COAST DEFENSE COMMAND'], { bg: '#26321f', fg: '#e3cf97', w: 1024, h: 132 }), 0);
        const crest = mesh(cylinderGeo, B.yellow, grp, mx - 36, 6.5, mz + 4.3, 5.5, 0.6, 5.5);
        crest.rotation.x = Math.PI / 2;
        plate(grp, mx - 36, 6.5, mz + 4.7, 9, 9, B.star, 0);
        for (const dx of [-46, 46]) {
          box(grp, mx + dx, 1, mz + 8, 14, 2, 6, B.earth);
          glowPool(mx + dx, mz + 8, 26, '#ffe0a8', 0.8);
        }
        // Moving pieces per lane: drop arm, bollards, sliding gate.
        for (const [li, lane] of g.lanes.entries()) {
          const dir = lane.out ? -1 : 1,
            edge = lane.out ? lane.y1 : lane.y0,
            span = lane.y1 - lane.y0,
            pedestalZ = edge + (lane.out ? 5 : -5),
            parts = { lane, state: militaryGateState[li] };
          // Drop arm.
          box(grp, g.armX, 4.5, pedestalZ, 5, 9, 5, B.yellow);
          box(grp, g.armX, 9.5, pedestalZ, 4, 1.4, 4, B.black);
          const pivot = new Three.Group();
          pivot.position.set(g.armX, 8.5, pedestalZ);
          baseDynamic.add(pivot);
          const armLength = span + 2;
          for (let k = 0; k < 8; k++) box(pivot, 0, 0, dir * (3 + ((k + 0.5) * armLength) / 8), 1.6, 1.6, armLength / 8, k % 2 ? B.red : B.white);
          box(pivot, 0, 0, -dir * 4, 2.4, 3, 6, B.black);
          const armLamp = mesh(sphereGeo, B.redLamp, pivot, 0, 1.3, dir * (armLength + 1), 0.6, 0.6, 0.6);
          armLamp.castShadow = false;
          parts.pivot = pivot;
          parts.dir = dir;
          const stub = new Three.Group();
          stub.position.set(g.armX, 8.5, pedestalZ);
          stub.visible = false;
          baseDynamic.add(stub);
          box(stub, 0, 0, dir * 8, 1.6, 1.6, 10, B.white);
          for (let k = 0; k < 3; k++) {
            const piece = box(stub, 6 + k * 5, -7.8, dir * (22 + k * 16), 1.6, 1.6, 14, k % 2 ? B.red : B.white);
            piece.rotation.y = 0.4 * (k - 1);
          }
          parts.stub = stub;
          // Bollards (rise out of the road).
          const bollards = new Three.Group();
          bollards.position.set(g.bollardX, 0, 0);
          baseDynamic.add(bollards);
          parts.bollardList = [];
          for (let k = 0; k < 5; k++) {
            const post = new Three.Group();
            post.position.set(0, 0, lane.y0 + 8 + (k * (span - 16)) / 4);
            bollards.add(post);
            cylinder(post, 0, 4.5, 0, 2.3, 9, B.steel, 12);
            cylinder(post, 0, 8.6, 0, 2.35, 1.4, B.yellow, 12);
            parts.bollardList.push(post);
          }
          parts.bollards = bollards;
          // Recess plates in the road.
          box(grp, g.bollardX, 0.5, (lane.y0 + lane.y1) / 2, 7, 0.2, span - 6, B.steel);
          // Sliding palisade gate: slides into the pocket between the fences.
          // Built round its own centre so a burst gate can topple about its foot.
          const slide = new Three.Group(),
            half = span / 2;
          slide.position.set(g.slideX, 0, (lane.y0 + lane.y1) / 2);
          baseDynamic.add(slide);
          box(slide, 0, 2, 0, 3, 1.6, span, B.oliveDark);
          box(slide, 0, 19, 0, 3, 1.6, span, B.oliveDark);
          for (let z = -half + 3; z < half; z += 4.2) {
            box(slide, 0, 11, z, 1, 21, 1.4, B.oliveDark);
            const tip = box(slide, 0, 22, z, 0.6, 2.6, 0.6, B.oliveDark);
            tip.rotation.y = Math.PI / 4;
          }
          rodTo(slide, 0, 2, -half + 2, 0, 19, half - 2, 0.5, B.oliveDark);
          box(slide, 0, 12, 0, 0.2, 6, 18, plateMaterial(['RESTRICTED'], { bg: '#b8322a', fg: '#ffffff', w: 256, h: 64 }));
          parts.slide = slide;
          parts.slideBase = slide.position.clone();
          parts.slideOpenOffset = (lane.out ? -1 : 1) * (span + 6);
          box(grp, g.slideX, 0.5, lane.out ? lane.y0 - span / 2 : lane.y1 + span / 2, 5, 0.3, span + 10, B.steel);
          gateParts.push(parts);
        }
        // Sandbag nests (two inside the gate, two outside) and the other posts.
        for (const n of SENTINEL.nests) {
          const nest = new Three.Group();
          nest.position.set(n.x, 0, n.y);
          nest.rotation.y = -n.a;
          grp.add(nest);
          for (let course = 0; course < 3; course++) {
            const y = 1.3 + course * 2.5,
              off = course % 2 ? 3 : 0;
            for (let z = -9 + off; z <= 9; z += 6) box(nest, 15, y, z, 4, 2.4, 5.6, B.sandbag);
            for (let x = -12 + off; x < 14; x += 6) {
              box(nest, x, y, -10, 5.6, 2.4, 4, B.sandbag);
              box(nest, x, y, 10, 5.6, 2.4, 4, B.sandbag);
            }
          }
          // Machine gun on its tripod.
          rodTo(nest, 10, 0, -3, 12, 8.5, 0, 0.35, B.black);
          rodTo(nest, 10, 0, 3, 12, 8.5, 0, 0.35, B.black);
          rodTo(nest, 15, 0, 0, 12, 8.5, 0, 0.35, B.black);
          box(nest, 13, 9.3, 0, 7, 1.6, 1.4, B.black);
          rodTo(nest, 16, 9.4, 0, 23, 9.4, 0, 0.35, B.black);
          box(nest, 12, 8.6, 1.4, 2, 2, 1.2, B.olive);
          if (n.net) {
            for (const [x, z] of [
              [-14, -13],
              [-14, 13],
              [18, -13],
              [18, 13],
            ])
              box(nest, x, 8, z, 0.8, 16, 0.8, B.wood);
            const net = new Three.Mesh(new Three.PlaneGeometry(40, 34, 4, 4), B.net);
            const p = net.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.12 - Math.abs(p.getY(i)) * 0.1 + 1.5 * Math.sin(i));
            net.geometry.computeVertexNormals();
            net.rotation.x = -Math.PI / 2;
            net.position.set(2, 16.5, 0);
            nest.add(net);
          }
        }
      }
      // ---- Floodlight masts ------------------------------------------------------------
      for (const [x, z] of SENTINEL.floods) {
        box(baseGroup, x, 25, z, 1.8, 50, 1.8, B.galv);
        box(baseGroup, x, 1, z, 5, 2, 5, B.concreteLight);
        box(baseGroup, x, 50, z, 14, 1, 1.4, B.galv);
        for (const dx of [-5.5, -1.8, 1.8, 5.5]) {
          box(baseGroup, x + dx, 48.6, z, 3.2, 2.4, 3, B.oliveDark);
          const lamp = box(baseGroup, x + dx, 47.3, z, 2.6, 0.3, 2.5, B.lamp);
          lamp.castShadow = false;
        }
        baseHalo(x, 48, z, 42, '#fff1d2');
        glowPool(x, z, 150, '#ffe6bb', 0.9);
      }
      // ---- Buildings -----------------------------------------------------------------
      const planOf = (id) => SENTINEL.buildings.find((b) => b.id === id);
      // Window rows on the south and north faces (and optionally east/west).
      function windowRows(b, rows, spacing, w, h, { skip = null, ends = true } = {}) {
        for (const y of rows) {
          for (let x = b.x + spacing * 0.7; x < b.x + b.w - spacing * 0.4; x += spacing) {
            if (skip && x > skip[0] && x < skip[1]) continue;
            for (const [z, s] of [
              [b.y + b.h, 1],
              [b.y, -1],
            ]) {
              box(baseGroup, x, y, z + s * 0.35, w, h, 0.6, B.window);
              box(baseGroup, x, y - h / 2 - 0.6, z + s * 0.9, w + 1.6, 0.8, 1.6, B.cream);
            }
          }
          if (ends)
            for (let z = b.y + spacing * 0.7; z < b.y + b.h - spacing * 0.4; z += spacing)
              for (const [x, s] of [
                [b.x, -1],
                [b.x + b.w, 1],
              ])
                box(baseGroup, x + s * 0.35, y, z, 0.6, h, w, B.window);
        }
      }
      // Headquarters: two storeys, portico, flagpoles in front.
      {
        const b = planOf('hq'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2;
        box(baseGroup, cx, 1.5, cz, b.w + 6, 3, b.h + 6, B.concreteLight);
        box(baseGroup, cx, 21, cz, b.w, 40, b.h, B.sand);
        box(baseGroup, cx, 19.5, cz, b.w + 1.2, 1.4, b.h + 1.2, B.sandDark);
        box(baseGroup, cx, 40.3, cz, b.w - 4, 0.6, b.h - 4, B.roofGrey);
        for (const [dx, dz, w, d] of [
          [0, -b.h / 2, b.w + 2, 2],
          [0, b.h / 2, b.w + 2, 2],
          [-b.w / 2, 0, 2, b.h],
          [b.w / 2, 0, 2, b.h],
        ])
          box(baseGroup, cx + dx, 42.5, cz + dz, w, 4, d, B.sandDark);
        windowRows(b, [11, 28], 20, 11, 9, { skip: [cx - 60, cx + 60] });
        // Portico: columns, canopy, steps, entrance glazing and the crest.
        const pz = b.y + b.h;
        box(baseGroup, cx, 20, pz + 1, 118, 38, 2, B.cream);
        for (let x = cx - 50; x <= cx + 50; x += 20) cylinder(baseGroup, x, 16, pz + 18, 2.4, 32, B.white, 12);
        box(baseGroup, cx, 33.5, pz + 11, 116, 3, 26, B.cream);
        box(baseGroup, cx, 37, pz + 11, 116, 4, 24, B.sandDark);
        box(baseGroup, cx, 12, pz + 2.3, 34, 22, 0.6, B.window);
        box(baseGroup, cx, 28, pz + 2.3, 70, 8, 0.6, B.window);
        for (let s = 0; s < 3; s++) box(baseGroup, cx, 0.8 + s * 1.2, pz + 26 + s * -3, 60 - s * 4, 1.6, 6, B.concreteLight);
        plate(baseGroup, cx, 37, pz + 23.2, 96, 5, plateMaterial('HEADQUARTERS · FORT SENTINEL', { w: 1024, h: 56, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        const crest = cylinder(baseGroup, cx, 28, pz + 2.6, 6, 0.8, B.yellow, 24);
        crest.rotation.x = Math.PI / 2;
        plate(baseGroup, cx, 28, pz + 3.1, 10, 10, B.star, 0);
        glowPool(cx, pz + 30, 60, '#ffe2b0', 1);
        baseHalo(cx, 31, pz + 20, 26, '#ffe8c0');
        // Roof plant: AC units, a stair head, antennas and a satellite dish.
        for (let x = b.x + 40; x < b.x + b.w - 30; x += 60) {
          box(baseGroup, x, 43.5, cz - 25, 18, 6, 12, B.steel);
          cylinder(baseGroup, x - 4, 46.8, cz - 25, 3.5, 0.6, B.black, 12);
          cylinder(baseGroup, x + 4, 46.8, cz - 25, 3.5, 0.6, B.black, 12);
        }
        box(baseGroup, b.x + b.w - 40, 45, cz + 20, 22, 9, 18, B.sandDark);
        rodTo(baseGroup, b.x + 50, 40, cz + 30, b.x + 50, 72, cz + 30, 0.5, B.galv);
        rodTo(baseGroup, b.x + 58, 40, cz + 30, b.x + 58, 64, cz + 30, 0.4, B.galv);
        const dish = cylinder(baseGroup, b.x + 90, 47, cz + 30, 6, 1, B.white, 16, 1.2);
        dish.rotation.z = -0.6;
        redBeacon(b.x + 50, 73, cz + 30, 2.2);
        // Parking lot: staff cars (static props).
        for (let i = 0; i < 3; i++) {
          const z = SENTINEL.hqLot.y + 31 + i * 38;
          box(baseGroup, SENTINEL.hqLot.x + 30, 5, z, 46, 7, 22, [B.oliveDark, B.cream, B.steel][i]);
          box(baseGroup, SENTINEL.hqLot.x + 28, 11, z, 24, 5, 19, B.window);
        }
      }
      // Flags (waving) on the poles in front of HQ and beside the stand.
      const flagTextures = {
        coast: baseTexture(128, 80, (g) => {
          for (let i = 0; i < 7; i++) {
            g.fillStyle = i % 2 ? '#f1eee4' : '#2f4e8c';
            g.fillRect(0, i * 11.5, 128, 11.5);
          }
          g.fillStyle = '#b8322a';
          g.fillRect(0, 0, 48, 46);
          g.fillStyle = '#f1eee4';
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 6 : 15,
              a = -Math.PI / 2 + (i * Math.PI) / 5;
            g.lineTo(24 + Math.cos(a) * r, 23 + Math.sin(a) * r);
          }
          g.fill();
        }, false),
        unit: baseTexture(128, 80, (g) => {
          g.fillStyle = '#3f4d34';
          g.fillRect(0, 0, 128, 80);
          g.fillStyle = '#d8b65a';
          g.fillRect(0, 0, 128, 7);
          g.fillRect(0, 73, 128, 7);
          g.beginPath();
          g.arc(64, 40, 22, 0, TAU);
          g.fill();
          g.fillStyle = '#3f4d34';
          g.font = 'bold 24px Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('XII', 64, 41);
        }, false),
        base: baseTexture(128, 80, (g) => {
          g.fillStyle = '#1e2d44';
          g.fillRect(0, 0, 128, 80);
          g.fillStyle = '#e9d9a0';
          g.font = 'bold 15px Arial';
          g.textAlign = 'center';
          g.fillText('FORT', 64, 30);
          g.fillText('SENTINEL', 64, 52);
          g.strokeStyle = '#e9d9a0';
          g.lineWidth = 3;
          g.strokeRect(6, 6, 116, 68);
        }, false),
      };
      const flags = [];
      for (const p of SENTINEL.flagpoles) {
        cylinder(baseGroup, p.x, p.height / 2, p.y, 0.7, p.height, B.white, 8, 0.45);
        mesh(sphereGeo, B.yellow, baseGroup, p.x, p.height + 0.8, p.y, 1.1, 1.1, 1.1);
        box(baseGroup, p.x, 1, p.y, 6, 2, 6, B.concreteLight);
        const geo = new Three.PlaneGeometry(20, 12.5, 8, 1);
        geo.translate(10, 0, 0);
        const flag = new Three.Mesh(geo, new Three.MeshStandardMaterial({ map: flagTextures[p.flag], side: Three.DoubleSide, roughness: 0.85 }));
        flag.position.set(p.x + 0.6, p.height - 6.5, p.y);
        flag.castShadow = true;
        baseDynamic.add(flag);
        flags.push({ mesh: flag, base: geo.attributes.position.array.slice(), phase: p.x * 0.1 });
        glowPool(p.x, p.y, 20, '#fff1d8', 0.5);
      }
      // Barracks: two-storey blocks, gable roofs, a gallery on the south face.
      for (const id of ['barracks-a', 'barracks-b', 'barracks-c']) {
        const b = planOf(id),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2,
          wall = 22;
        box(baseGroup, cx, 1, cz, b.w + 4, 2, b.h + 4, B.concreteLight);
        box(baseGroup, cx, wall / 2, cz, b.w, wall, b.h, B.sand);
        box(baseGroup, cx, 11, cz, b.w + 0.8, 1, b.h + 0.8, B.sandDark);
        gableRoof(baseGroup, cx, wall, cz, b.w + 8, b.h + 10, 9, B.roofGreen);
        box(baseGroup, cx, wall + 9, cz, b.w + 8, 0.8, 1.6, B.oliveDark);
        windowRows(b, [6, 16.5], 18, 8, 5.5, { ends: false });
        // Gallery with railings on the south face; stair towers at both ends.
        const gz = b.y + b.h;
        box(baseGroup, cx, 11.5, gz + 5, b.w - 20, 1, 10, B.concreteLight);
        box(baseGroup, cx, 15.5, gz + 9.6, b.w - 20, 0.6, 0.6, B.galv);
        for (let x = b.x + 12; x <= b.x + b.w - 12; x += 16) {
          box(baseGroup, x, 13.5, gz + 9.6, 0.5, 4, 0.5, B.galv);
          box(baseGroup, x, 5.5, gz + 9.2, 1, 11, 1, B.cream);
        }
        for (const x of [b.x + 6, b.x + b.w - 6]) {
          box(baseGroup, x, 13, gz + 6, 12, 26, 12, B.sandDark);
          box(baseGroup, x, 27, gz + 6, 14, 1.4, 14, B.roofGreen);
          box(baseGroup, x, 4, gz + 12.2, 6, 8, 0.4, B.oliveDark);
        }
        for (let x = b.x + 60; x < b.x + b.w - 40; x += 90) box(baseGroup, x, 4.5, gz + 0.5, 6, 9, 0.6, B.oliveDark);
        // AC condensers along the north wall, vents on the roof.
        for (let x = b.x + 20; x < b.x + b.w - 10; x += 36) box(baseGroup, x, 2.5, b.y - 3.5, 8, 5, 5, B.steel);
        for (let x = b.x + 50; x < b.x + b.w; x += 100) cylinder(baseGroup, x, wall + 7, cz - 12, 1.5, 6, B.steel, 8);
        plate(baseGroup, b.x + 34, 20, gz + 12.3, 34, 5, plateMaterial(b.name, { w: 256, h: 40, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        glowPool(b.x + 6, gz + 18, 26, '#ffe0a8', 0.8);
        glowPool(b.x + b.w - 6, gz + 18, 26, '#ffe0a8', 0.8);
        glowPool(cx, gz + 12, 70, '#ffdca0', 0.5);
      }
      // Mess hall.
      {
        const b = planOf('mess'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2;
        box(baseGroup, cx, 1, cz, b.w + 4, 2, b.h + 4, B.concreteLight);
        box(baseGroup, cx, 10, cz, b.w, 20, b.h, B.sand);
        gableRoof(baseGroup, cx, 20, cz, b.w + 6, b.h + 6, 6, B.cladding);
        windowRows(b, [11], 16, 11, 7, { skip: [cx - 30, cx + 30], ends: false });
        const fz = b.y + b.h;
        box(baseGroup, cx, 16, fz + 8, 60, 1.5, 16, B.olive);
        for (const dx of [-28, 28]) box(baseGroup, cx + dx, 8, fz + 15, 1.2, 16, 1.2, B.galv);
        box(baseGroup, cx, 7, fz + 0.4, 22, 14, 0.6, B.window);
        plate(baseGroup, cx, 18.5, fz + 16.3, 58, 5, plateMaterial('DINING FACILITY', { w: 512, h: 44, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        glowPool(cx, fz + 18, 45, '#ffe0a8', 1);
        // Kitchen: extract stacks, a loading dock with a roller door, bins.
        for (const x of [b.x + 30, b.x + 60, b.x + 90]) {
          cylinder(baseGroup, x, 26, b.y + 20, 2.4, 12, B.galv, 10);
          cylinder(baseGroup, x, 32.5, b.y + 20, 3.4, 1.2, B.galv, 10);
        }
        box(baseGroup, b.x + b.w - 40, 2, b.y - 8, 40, 4, 16, B.concreteLight);
        box(baseGroup, b.x + b.w - 40, 8, b.y - 0.4, 30, 12, 0.6, B.cladding);
        for (const x of [b.x + b.w - 80, b.x + b.w - 96]) box(baseGroup, x, 4, b.y - 10, 12, 8, 8, B.olive);
      }
      // Clinic.
      {
        const b = planOf('clinic'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2;
        box(baseGroup, cx, 10, cz, b.w, 20, b.h, B.white);
        box(baseGroup, cx, 20.5, cz, b.w + 2, 1.4, b.h + 2, B.sandDark);
        windowRows(b, [11], 18, 9, 6, { skip: [b.x + 40, b.x + 70] });
        box(baseGroup, b.x + 55, 14, b.y + b.h + 9, 34, 1.4, 18, B.white);
        for (const dx of [-15, 15]) box(baseGroup, b.x + 55 + dx, 7, b.y + b.h + 17, 1, 14, 1, B.galv);
        const cross = plateMaterial('+', { bg: '#f4f2ea', fg: '#c62f2a', w: 128, h: 128 });
        plate(baseGroup, b.x + b.w - 30, 12, b.y + b.h + 0.4, 14, 14, cross, 0);
        plate(baseGroup, b.x + 55, 17, b.y + b.h + 18.2, 30, 4, plateMaterial('MEDICAL AID STATION', { w: 512, h: 60, bg: '#f4f2ea', fg: '#c62f2a' }), 0);
        glowPool(b.x + 55, b.y + b.h + 20, 36, '#fff1d8', 0.9);
      }
      // Motor pool maintenance shed: five bays facing the parking rows.
      {
        const b = planOf('motorpool'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2,
          fz = b.y + b.h;
        box(baseGroup, cx, 13, cz - 4, b.w, 26, b.h - 8, B.claddingOlive);
        gableRoof(baseGroup, cx, 26, cz, b.w + 6, b.h + 8, 8, B.cladding);
        const bays = 5,
          bayW = b.w / bays;
        for (let i = 0; i < bays; i++) {
          const x = b.x + bayW * (i + 0.5),
            open = i !== 3;
          box(baseGroup, x, 11, fz - 6, bayW - 10, 22, 0.8, B.black);
          box(baseGroup, x, open ? 20 : 11, fz - 5.4, bayW - 10, open ? 4 : 22, 0.8, B.cladding);
          box(baseGroup, x, 0.6, fz + 6, bayW - 14, 0.2, 12, B.concreteLight);
          const lamp = box(baseGroup, x, 23.5, fz - 4, 8, 0.6, 2, B.lamp);
          lamp.castShadow = false;
          glowPool(x, fz + 10, 40, '#ffe8c6', 0.7);
        }
        for (let i = 0; i <= bays; i++) box(baseGroup, b.x + bayW * i, 13, fz - 4, 5, 26, 4, B.olive);
        plate(baseGroup, cx, 29, fz + 0.6, 110, 6, plateMaterial('MOTOR POOL · VEHICLE MAINTENANCE', { w: 1024, h: 56, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        // Oil drums, tyre stack, a work bench.
        for (let i = 0; i < 6; i++) cylinder(baseGroup, b.x + b.w + 12 + (i % 3) * 5.5, 4, fz - 12 + Math.floor(i / 3) * 5.5, 2.5, 8, i % 2 ? B.olive : B.red, 10);
        for (let i = 0; i < 4; i++) {
          const t = new Three.Mesh(new Three.TorusGeometry(4.2, 1.5, 6, 12), B.black);
          t.rotation.x = Math.PI / 2;
          t.position.set(b.x - 10, 1.5 + i * 3, fz - 16);
          baseGroup.add(t);
        }
      }
      // Camouflage net over the tank row.
      {
        for (const [x, z] of [
          [9458, 9028],
          [9458, 9132],
          [9602, 9028],
          [9602, 9132],
          [9530, 9028],
          [9530, 9132],
        ])
          box(baseGroup, x, 18, z, 1, 36, 1, B.wood);
        const net = new Three.Mesh(new Three.PlaneGeometry(160, 118, 8, 6), B.net),
          p = net.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, -((Math.abs(p.getX(i)) / 80) ** 2) * 5 - ((Math.abs(p.getY(i)) / 59) ** 2) * 6 + Math.sin(i * 1.7) * 1.2);
        net.geometry.computeVertexNormals();
        net.rotation.x = -Math.PI / 2;
        net.position.set(9530, 37, 9080);
        baseGroup.add(net);
      }
      // Containers.
      for (const [i, c] of SENTINEL.containers.entries())
        for (let layer = 0; layer < c.layers; layer++)
          for (let row = 0; row < 5; row++) {
            if (layer && row === 4) continue;
            const z = c.y + 7 + row * 14,
              x = c.x + c.w / 2 + (layer ? 3 : 0),
              y = 6.6 + layer * 13.2,
              m = containerMats[(i * 3 + row + layer * 2) % containerMats.length];
            box(baseGroup, x, y, z, 62, 13, 12.4, m);
            box(baseGroup, x + 31.2, y, z, 0.5, 12.4, 11.8, B.oliveDark);
            for (const dz of [-3, 3]) box(baseGroup, x + 31.5, y, z + dz, 0.3, 12, 0.4, B.galv);
          }
      // Generators.
      for (const g2 of SENTINEL.generators) {
        const x = g2.x + g2.w / 2,
          z = g2.y + g2.h / 2;
        box(baseGroup, x, 1, z, g2.w + 2, 2, g2.h + 2, B.steel);
        box(baseGroup, x, 6.5, z, g2.w, 9, g2.h, B.olive);
        box(baseGroup, x + g2.w / 2 - 2, 6.5, z, 0.5, 7, g2.h - 3, B.black);
        cylinder(baseGroup, x - g2.w / 2 + 5, 14, z, 0.9, 6, B.black, 8);
        for (let k = -2; k <= 2; k++) box(baseGroup, x + k * 4, 11.2, z, 0.5, 0.4, g2.h, B.oliveDark);
      }
      // Hangars: barrel vaults with part-open doors and ribs.
      for (const id of ['hangar-1', 'hangar-2']) {
        const b = planOf(id),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2,
          fz = b.y + b.h,
          H = b.height,
          doorW = 170,
          doorH = 44;
        const vault = new Three.Mesh(vaultGeometry(b.w, H, b.h, 24), B.vault);
        vault.position.set(cx, 0, cz);
        vault.castShadow = vault.receiveShadow = true;
        baseGroup.add(vault);
        for (let z = b.y + 6; z < fz; z += 24) {
          const rib = new Three.Mesh(vaultGeometry(b.w + 1.2, H + 0.8, 2, 24), B.steel);
          rib.position.set(cx, 0, z);
          baseGroup.add(rib);
        }
        const front = new Three.Mesh(archWallGeometry(b.w, H, doorW, doorH), B.cladding);
        front.position.set(cx, 0, fz);
        baseGroup.add(front);
        const back = new Three.Mesh(archWallGeometry(b.w, H), B.cladding);
        back.position.set(cx, 0, b.y);
        back.rotation.y = Math.PI;
        baseGroup.add(back);
        box(baseGroup, cx, doorH + 2, fz + 1, doorW + 6, 4, 2, B.olive);
        // Door leaves stacked to both sides, leaving a 110-wide opening.
        for (const s of [-1, 1])
          for (let k = 0; k < 2; k++) {
            const x = cx + s * (doorW / 2 - 17 - k * 13);
            box(baseGroup, x, doorH / 2, fz + 2 + k * 1.6, 26, doorH, 1.2, B.claddingOlive);
          }
        // Interior: dark floor, work lights, a tug and a rack of crates.
        box(baseGroup, cx, 0.55, cz, b.w - 10, 0.2, b.h - 6, B.roofGrey);
        box(baseGroup, cx - 40, 3, cz, 14, 6, 9, B.yellow);
        for (let i = 0; i < 3; i++) box(baseGroup, cx + 70, 3 + i * 6, b.y + 30, 18, 6, 14, B.olive);
        for (const dx of [-50, 0, 50]) {
          const l = box(baseGroup, cx + dx, H * 0.8, cz, 10, 0.5, 3, B.lamp);
          l.castShadow = false;
        }
        plate(baseGroup, cx, doorH + 8, fz + 0.6, 60, 9, plateMaterial(b.name, { w: 512, h: 80, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        const big = plateMaterial(b.id === 'hangar-1' ? '1' : '2', { bg: '#6c7658', fg: '#e6dfc6', w: 128, h: 128 });
        plate(baseGroup, cx - doorW / 2 + 17, doorH / 2 + 4, fz + 4.4, 18, 18, big, 0);
        glowPool(cx, fz + 30, 90, '#ffe6bb', 0.7);
        baseHalo(cx, doorH + 4, fz + 4, 24, '#ffe8c0');
      }
      // Control tower.
      {
        const b = planOf('atc'),
          cx = b.x + b.w / 2,
          cz = b.y + b.h / 2;
        box(baseGroup, cx, 29, cz, 30, 58, 30, B.concreteLight);
        box(baseGroup, cx, 5, cz + 20, 44, 10, 12, B.concreteLight);
        for (let y = 12; y < 56; y += 11) box(baseGroup, cx, y, cz + 15.3, 6, 5, 0.6, B.window);
        cylinder(baseGroup, cx, 59, cz, 25, 2, B.white, 8);
        const cab = cylinder(baseGroup, cx, 65, cz, 21, 10, B.glassBlue, 8, 24);
        cab.material = B.glassBlue;
        cylinder(baseGroup, cx, 71, cz, 26, 2, B.white, 8);
        rodTo(baseGroup, cx, 72, cz, cx, 92, cz, 0.5, B.galv);
        box(baseGroup, cx + 8, 76, cz, 10, 0.6, 0.6, B.galv);
        redBeacon(cx, 93, cz, 2.4);
        plate(baseGroup, cx, 50, cz + 15.4, 26, 4, plateMaterial('SENTINEL TOWER', { w: 256, h: 40, bg: '#2a3326', fg: '#e8d7a3' }), 0);
      }
      // Comms compound: lattice mast with obstruction lights, dishes and a shelter.
      {
        const c = SENTINEL.comms,
          H = c.height,
          legs = [0, 1, 2].map((k) => (k * TAU) / 3 + Math.PI / 6),
          rAt = (y) => 13 - (y / H) * 9;
        // Legs banded red and white for aircraft, 30 units a band.
        for (const a of legs)
          for (let y = 0, k = 0; y < H; y += 30, k++) {
            const y1 = Math.min(H, y + 30);
            rodTo(baseGroup, c.x + Math.cos(a) * rAt(y), y, c.y + Math.sin(a) * rAt(y), c.x + Math.cos(a) * rAt(y1), y1, c.y + Math.sin(a) * rAt(y1), 0.9, k % 2 ? B.white : B.red);
          }
        for (let y = 0; y < H - 10; y += 16) {
          const y1 = y + 16;
          for (let k = 0; k < 3; k++) {
            const a = legs[k],
              b2 = legs[(k + 1) % 3];
            rodTo(baseGroup, c.x + Math.cos(a) * rAt(y), y, c.y + Math.sin(a) * rAt(y), c.x + Math.cos(b2) * rAt(y1), y1, c.y + Math.sin(b2) * rAt(y1), 0.3, B.galv);
            rodTo(baseGroup, c.x + Math.cos(a) * rAt(y1), y1, c.y + Math.sin(a) * rAt(y1), c.x + Math.cos(b2) * rAt(y1), y1, c.y + Math.sin(b2) * rAt(y1), 0.3, B.galv);
          }
        }
        for (const y of [80, 160]) cylinder(baseGroup, c.x, y, c.y, rAt(y) + 3, 1, B.steel, 6);
        for (const [y, a] of [
          [110, 0.4],
          [128, 2.6],
          [176, 4.4],
        ]) {
          const d = cylinder(baseGroup, c.x + Math.cos(a) * (rAt(y) + 4), y, c.y + Math.sin(a) * (rAt(y) + 4), 7, 2, B.white, 16, 1.5);
          d.rotation.set(0, -a, Math.PI / 2 - 0.1);
        }
        for (let k = 0; k < 3; k++) box(baseGroup, c.x + Math.cos(legs[k]) * 5, H - 14, c.y + Math.sin(legs[k]) * 5, 2, 18, 5, B.white);
        rodTo(baseGroup, c.x, H, c.y, c.x, H + 18, c.y, 0.4, B.galv);
        redBeacon(c.x, H + 19, c.y, 3.2);
        for (const y of [H * 0.66, H * 0.33]) for (const a of [legs[0], legs[2]]) redBeacon(c.x + Math.cos(a) * (rAt(y) + 1.5), y, c.y + Math.sin(a) * (rAt(y) + 1.5), 2.2);
        const s = SENTINEL.shelter;
        box(baseGroup, s.x + s.w / 2, 8, s.y + s.h / 2, s.w, 16, s.h, B.cream);
        box(baseGroup, s.x + s.w / 2, 16.6, s.y + s.h / 2, s.w + 2, 1.2, s.h + 2, B.roofGreen);
        box(baseGroup, s.x + 8, 7, s.y + s.h + 0.3, 7, 13, 0.5, B.steel);
        for (let x = c.x + 10; x < s.x; x += 8) box(baseGroup, x, 12, c.y + 16, 8, 0.6, 3, B.galv);
        box(baseGroup, (c.x + s.x) / 2 + 5, 6, c.y + 16, 0.8, 12, 0.8, B.galv);
        // Compound fence.
        for (const [ax, az, bx2, bz] of [
          [10000, 7920, 10140, 7920],
          [10000, 7920, 10000, 8050],
          [10140, 7920, 10140, 8050],
        ])
          strip(baseGroup, ax, az, bx2, bz, 0.5, 10, B.fence, 6);
        plate(baseGroup, 10070, 6, 8050.2, 22, 8, plateMaterial(['DANGER', 'RF RADIATION'], { header: 'AUTHORIZED ONLY', bg: '#f1eee4', fg: '#1d1f22', headerBg: '#c9392d', w: 256, h: 128 }), 0);
      }
      // Radome and the rotating surveillance radar.
      let radarHead = null;
      {
        const r = SENTINEL.radome;
        cylinder(baseGroup, r.x, 15, r.y, r.base / 2, 30, B.cream, 8);
        cylinder(baseGroup, r.x, 30.6, r.y, r.base / 2 + 1, 1.2, B.sandDark, 8);
        mesh(new Three.IcosahedronGeometry(1, 2), B.dome, baseGroup, r.x, 50, r.y, r.r, r.r, r.r);
        box(baseGroup, r.x, 8, r.y + r.base / 2 - 3, 10, 16, 8, B.steel);
        const q = SENTINEL.radar;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) rodTo(baseGroup, q.x + sx * 7, 0, q.y + sz * 7, q.x + sx * 3, 46, q.y + sz * 3, 0.6, B.galv);
        for (let y = 8; y < 46; y += 12) for (const [a, b2] of [[-1, 1], [1, -1]]) rodTo(baseGroup, q.x + a * 6.5, y, q.y - 6, q.x + b2 * 5, y + 12, q.y - 5, 0.25, B.galv);
        box(baseGroup, q.x, 47, q.y, 9, 2, 9, B.steel);
        radarHead = new Three.Group();
        radarHead.position.set(q.x, 49, q.y);
        baseDynamic.add(radarHead);
        cylinder(radarHead, 0, 1.5, 0, 2, 3, B.steel, 10);
        const reflector = box(radarHead, 0, 6, -2, 30, 7, 1.2, B.white);
        reflector.rotation.x = -0.35;
        rodTo(radarHead, 0, 3, 0, 0, 5, 5, 0.4, B.steel);
        box(radarHead, 0, 5.5, 5.5, 2, 2, 2, B.steel);
        redBeacon(q.x, 58, q.y, 1.8);
      }
      // Water tower.
      {
        const w = SENTINEL.waterTower,
          top = w.height - 22;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) rodTo(baseGroup, w.x + sx * w.spread, 0, w.y + sz * w.spread, w.x + sx * 12, top, w.y + sz * 12, 1.1, B.steel);
        for (const y of [20, 40]) {
          const r = w.spread - ((w.spread - 12) * y) / top;
          box(baseGroup, w.x, y, w.y - r, r * 2, 0.6, 0.6, B.steel);
          box(baseGroup, w.x, y, w.y + r, r * 2, 0.6, 0.6, B.steel);
          box(baseGroup, w.x - r, y, w.y, 0.6, 0.6, r * 2, B.steel);
          box(baseGroup, w.x + r, y, w.y, 0.6, 0.6, r * 2, B.steel);
        }
        rodTo(baseGroup, w.x, 0, w.y, w.x, top, w.y, 1.4, B.steel);
        cylinder(baseGroup, w.x, top + 11, w.y, w.r, 22, B.checker, 20);
        cylinder(baseGroup, w.x, top + 26, w.y, w.r + 1, 8, B.white, 20, 2);
        cylinder(baseGroup, w.x, top + 0.5, w.y, w.r + 3, 1, B.steel, 20);
        redBeacon(w.x, top + 31, w.y, 2.4);
      }
      // Fuel depot: bund wall, tanks, pipes and the pump island.
      {
        const f = SENTINEL.fuel,
          bd = f.bund;
        for (const [x, z, w, d] of [
          [bd.x + bd.w / 2, bd.y + 1.5, bd.w, 3],
          [bd.x + bd.w / 2, bd.y + bd.h - 1.5, bd.w, 3],
          [bd.x + 1.5, bd.y + bd.h / 2, 3, bd.h],
          [bd.x + bd.w - 1.5, bd.y + bd.h / 2, 3, bd.h],
        ])
          box(baseGroup, x, 3.5, z, w, 7, d, B.concreteLight);
        for (const [i, t] of f.vertical.entries()) {
          cylinder(baseGroup, t.x, t.h / 2, t.y, t.r, t.h, B.tank, 24);
          cylinder(baseGroup, t.x, t.h + 2.5, t.y, t.r, 5, B.tank, 24, 4);
          const railRing = new Three.Mesh(new Three.TorusGeometry(t.r - 1, 0.35, 4, 24), B.galv);
          railRing.rotation.x = Math.PI / 2;
          railRing.position.set(t.x, t.h + 4, t.y);
          baseGroup.add(railRing);
          for (let y = 3; y < t.h; y += 3) box(baseGroup, t.x + t.r + 1, y, t.y + 8, 0.4, 0.4, 4, B.galv);
          box(baseGroup, t.x, t.h * 0.55, t.y + t.r - 0.6, 14, 1.2, 1.4, B.olive);
          plate(baseGroup, t.x, t.h * 0.42, t.y + t.r + 0.3, 20, 8, plateMaterial(i === 1 ? ['JP-8', 'AVIATION FUEL'] : ['DIESEL', 'F-54'], { bg: '#e7e2d2', fg: '#1d1f22', w: 256, h: 104 }), 0);
          rodTo(baseGroup, t.x, 3, t.y + t.r, t.x, 3, f.pump.y, 1.1, B.yellow);
        }
        for (const h of f.horizontal) {
          const m = cylinder(baseGroup, (h.x0 + h.x1) / 2, h.r + 4, h.y, h.r, h.x1 - h.x0, B.olive, 18);
          m.rotation.z = Math.PI / 2;
          for (const x of [h.x0 + 12, h.x1 - 12]) box(baseGroup, x, 3, h.y, 6, 6, h.r * 1.6, B.concreteLight);
        }
        rodTo(baseGroup, bd.x + 30, 3, f.pump.y - 6, bd.x + bd.w - 20, 3, f.pump.y - 6, 1.1, B.yellow);
        const p = f.pump;
        box(baseGroup, p.x + p.w / 2, 1.2, p.y + p.h / 2, p.w, 2.4, p.h, B.concreteLight);
        for (const dx of [-16, 16]) {
          box(baseGroup, p.x + p.w / 2 + dx, 6, p.y + p.h / 2, 7, 9, 5, B.red);
          box(baseGroup, p.x + p.w / 2 + dx, 8, p.y + p.h / 2 + 2.6, 4, 3, 0.3, B.lamp);
        }
        box(baseGroup, p.x + p.w / 2, 19, p.y + p.h / 2 + 8, p.w + 30, 1.6, 42, B.white);
        for (const dx of [-38, 38]) box(baseGroup, p.x + p.w / 2 + dx, 9.5, p.y + p.h / 2 + 8, 1.4, 19, 1.4, B.galv);
        plate(baseGroup, p.x + p.w / 2, 21.5, p.y + p.h / 2 + 29.2, 60, 4, plateMaterial('FUEL POINT · NO SMOKING · NO NAKED FLAMES', { w: 1024, h: 64, bg: '#b8322a', fg: '#ffffff' }), 0);
        glowPool(p.x + p.w / 2, p.y + 20, 50, '#fff0d0', 1);
      }
      // Ammunition bunkers: earth-covered vaults with concrete headwalls.
      for (const b of SENTINEL.bunkers) {
        const mound = new Three.Mesh(vaultGeometry(b.h, 26, b.w, 16), B.earth);
        mound.rotation.y = Math.PI / 2;
        mound.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
        mound.castShadow = mound.receiveShadow = true;
        baseGroup.add(mound);
        box(baseGroup, b.x + 1.5, 13, b.y + b.h / 2, 3, 26, b.h + 10, B.concreteLight);
        for (const s of [-1, 1]) box(baseGroup, b.x - 6, 7, b.y + b.h / 2 + s * (b.h / 2 + 3), 14, 14, 4, B.concreteLight);
        box(baseGroup, b.x - 0.4, 8, b.y + b.h / 2, 0.6, 16, 26, B.oliveDark);
        box(baseGroup, b.x - 0.8, 8, b.y + b.h / 2, 0.4, 16, 0.6, B.black);
        plate(baseGroup, b.x - 0.8, 19, b.y + b.h / 2, 16, 5, plateMaterial(b.label, { bg: '#d8b23a', fg: '#1d1f22', w: 128, h: 40 }), -Math.PI / 2);
        const light = box(baseGroup, b.x - 1.2, 22, b.y + b.h / 2, 1.2, 1.2, 4, B.lamp);
        light.castShadow = false;
        rodTo(baseGroup, b.x + b.w / 2, 24, b.y + b.h / 2, b.x + b.w / 2, 44, b.y + b.h / 2, 0.35, B.galv);
        glowPool(b.x - 14, b.y + b.h / 2, 30, '#ffe6bb', 0.7);
      }
      plate(baseGroup, 10300, 7, 9142.2, 22, 9, plateMaterial(['EXPLOSIVES', 'NO UNAUTHORIZED ENTRY'], { header: 'DANGER', bg: '#f1eee4', fg: '#1d1f22', headerBg: '#c9392d', w: 256, h: 128 }), 0);
      box(baseGroup, 10300, 3.5, 9141, 1, 7, 1, B.galv);
      // Rifle range: firing-line shelter, lane berms, targets, backstop.
      {
        const r = SENTINEL.range;
        for (const x of [r.x + 14, r.x + 40]) for (const z of [r.y + 2, r.y + r.h / 2, r.y + r.h - 2]) box(baseGroup, x, 7, z, 1.2, 14, 1.2, B.galv);
        box(baseGroup, r.x + 27, 14.5, r.y + r.h / 2, 36, 1.2, r.h + 8, B.roofGreen);
        for (let i = 0; i < 4; i++) {
          box(baseGroup, r.x + 32, 1.6, r.y + 10 + i * 20, 5, 3.2, 9, B.sandbag);
          const board = box(baseGroup, r.targetsX, 7, r.y + 10 + i * 20, 0.6, 9, 7, B.white);
          board.material = plateMaterial('◎', { bg: '#efeadb', fg: '#1d1f22', w: 128, h: 128 });
          for (const dz of [-3.5, 3.5]) box(baseGroup, r.targetsX + 0.8, 4, r.y + 10 + i * 20 + dz, 0.8, 8, 0.8, B.wood);
        }
        for (let i = 1; i < 4; i++) box(baseGroup, (r.x + 60 + r.targetsX) / 2, 1.2, r.y + i * 20, r.targetsX - r.x - 60, 2.4, 3, B.earth);
        const berm = new Three.Mesh(vaultGeometry(45, 22, r.h + 20, 10), B.earth);
        berm.position.set(r.x + r.w - 22.5, 0, r.y + r.h / 2);
        berm.castShadow = berm.receiveShadow = true;
        baseGroup.add(berm);
        cylinder(baseGroup, r.x + 6, 14, r.y - 8, 0.5, 28, B.white, 6);
        const rangeFlag = box(baseGroup, r.x + 11, 25, r.y - 8, 10, 6, 0.3, B.red);
        rangeFlag.castShadow = false;
        plate(baseGroup, r.x + 120, 6, r.y - 13.8, 34, 10, plateMaterial(['LIVE FIRE RANGE', 'DO NOT ENTER WHEN RED FLAG FLIES'], { header: 'DANGER', bg: '#f1eee4', fg: '#1d1f22', headerBg: '#c9392d', w: 512, h: 160 }), 0);
        box(baseGroup, r.x + 120, 3, r.y - 14.6, 1, 6, 1, B.galv);
      }
      // Obstacle course.
      {
        const o = SENTINEL.obstacleCourse,
          cx = o.x + o.w / 2;
        for (let k = 0; k < 3; k++) {
          const log = cylinder(baseGroup, cx, 2.5, o.y + 16 + k * 10, 1.4, o.w - 30, B.wood, 8);
          log.rotation.z = Math.PI / 2;
          for (const s of [-1, 1]) box(baseGroup, cx + s * (o.w / 2 - 16), 1.5, o.y + 16 + k * 10, 1.2, 3, 1.2, B.wood);
        }
        for (let k = 0; k < 4; k++) {
          const beam = cylinder(baseGroup, cx + (k % 2 ? 10 : -10), 3, o.y + 60 + k * 7, 1, 30, B.wood, 8);
          beam.rotation.set(0, (k % 2 ? 1 : -1) * 0.5, Math.PI / 2);
        }
        box(baseGroup, cx, 6, o.y + 100, o.w - 30, 12, 3, B.wood);
        for (const dx of [-25, 0, 25]) rodTo(baseGroup, cx + dx, 0, o.y + 110, cx + dx, 10, o.y + 101.5, 0.6, B.wood);
        // Cargo-net A-frame.
        for (const dx of [-30, 30]) {
          rodTo(baseGroup, cx + dx, 0, o.y + 140, cx + dx, 28, o.y + 160, 0.9, B.wood);
          rodTo(baseGroup, cx + dx, 0, o.y + 180, cx + dx, 28, o.y + 160, 0.9, B.wood);
        }
        cylinder(baseGroup, cx, 28, o.y + 160, 0.9, 62, B.wood, 8).rotation.z = Math.PI / 2;
        for (const s of [-1, 1]) {
          const net = new Three.Mesh(new Three.PlaneGeometry(58, 34), B.net);
          net.position.set(cx, 14, o.y + 160 + s * 10);
          net.rotation.x = s * 0.53;
          baseGroup.add(net);
        }
        // Monkey bars.
        for (const dx of [-8, 8]) {
          for (const z of [o.y + 215, o.y + 265]) box(baseGroup, cx + dx, 7.5, z, 1, 15, 1, B.steel);
          box(baseGroup, cx + dx, 15, o.y + 240, 1, 1, 50, B.steel);
        }
        for (let z = o.y + 217; z < o.y + 264; z += 4) box(baseGroup, cx, 15, z, 16, 0.5, 0.5, B.steel);
        // Tyre run.
        for (let i = 0; i < 12; i++) {
          const t = new Three.Mesh(new Three.TorusGeometry(3.6, 1.4, 6, 10), B.black);
          t.rotation.x = Math.PI / 2;
          t.position.set(cx + ((i % 4) - 1.5) * 9, 1.4, o.y + 290 + Math.floor(i / 4) * 9);
          baseGroup.add(t);
        }
        // Low crawl under wire.
        for (let z = o.y + 330; z <= o.y + 380; z += 12) for (const dx of [-30, 30]) box(baseGroup, cx + dx, 2.5, z, 0.8, 5, 0.8, B.wood);
        for (let z = o.y + 330; z <= o.y + 380; z += 12) box(baseGroup, cx, 4.6, z, 60, 0.25, 0.25, B.galv);
        // Rope climb gantry.
        for (const dx of [-24, 24]) box(baseGroup, cx + dx, 16, o.y + 420, 1.6, 32, 1.6, B.wood);
        box(baseGroup, cx, 31, o.y + 420, 50, 1.8, 1.8, B.wood);
        for (const dx of [-12, 0, 12]) rodTo(baseGroup, cx + dx, 30, o.y + 420, cx + dx, 2, o.y + 420, 0.4, B.canvasTop);
        plate(baseGroup, cx, 5, o.y + o.h + 1.5, 40, 6, plateMaterial('OBSTACLE COURSE', { w: 512, h: 64, bg: '#2a3326', fg: '#e8d7a3' }), 0);
        box(baseGroup, cx, 2.5, o.y + o.h + 1, 1, 5, 1, B.wood);
      }
      // Reviewing stand at the parade ground.
      {
        const s = SENTINEL.stand,
          cx = s.x + s.w / 2;
        for (let k = 0; k < 3; k++) box(baseGroup, cx, 1.5 + k * 3, s.y + 6 + k * 7, s.w, 3 + k * 6, 8, B.concreteLight);
        box(baseGroup, cx, 11, s.y + 1, s.w, 22, 2, B.sand);
        for (const x of [s.x + 2, s.x + s.w - 2]) for (const z of [s.y + 2, s.y + s.h]) box(baseGroup, x, 11, z, 1.4, 22, 1.4, B.white);
        box(baseGroup, cx, 22.5, s.y + s.h / 2, s.w + 8, 1.4, s.h + 10, B.olive);
        box(baseGroup, cx, 20.3, s.y + s.h + 4, s.w + 8, 2.4, 0.4, B.red);
        box(baseGroup, cx, 18.2, s.y + s.h + 4, s.w + 8, 1.8, 0.4, B.white);
        box(baseGroup, cx, 16.4, s.y + s.h + 4, s.w + 8, 1.8, 0.4, B.blueLamp);
        box(baseGroup, cx, 5, s.y + s.h + 6, 10, 8, 6, B.oliveDark);
      }
      // Airfield lights: runway edges, thresholds, taxiway, helipads; the windsock.
      const windsock = new Three.Group();
      {
        const rw = SENTINEL.runway,
          light = (x, z, material, size = 1.4) => {
            const m = box(baseGroup, x, 0.9, z, size, 1.2, size, material);
            m.castShadow = false;
            glowPool(x, z, 12, material === B.redLamp ? '#ff5a40' : material === B.greenLamp ? '#62ff90' : material === B.blueLamp ? '#6090ff' : '#fff2cf', 1.4);
          };
        for (let x = rw.x + 10; x <= rw.x + rw.w - 10; x += 60) {
          light(x, rw.y - 4, B.lamp);
          light(x, rw.y + rw.h + 4, B.lamp);
        }
        for (let z = rw.y + 6; z < rw.y + rw.h; z += 12) {
          light(rw.x - 4, z, B.greenLamp);
          light(rw.x + rw.w + 4, z, B.redLamp);
        }
        for (let k = 1; k <= 3; k++) for (let z = rw.y + 25; z < rw.y + rw.h - 20; z += 10) light(rw.x - 4 - k * 14, z, B.lamp, 1.1);
        for (let z = 9600; z < 9665; z += 20) {
          light(9956, z, B.blueLamp, 1.1);
          light(10024, z, B.blueLamp, 1.1);
        }
        for (const p of SENTINEL.helipads)
          for (let a = 0; a < 8; a++) light(p.x + Math.cos((a * TAU) / 8) * (p.r + 4), p.y + Math.sin((a * TAU) / 8) * (p.r + 4), B.amberLamp, 1.2);
        // PAPI boxes.
        for (let k = 0; k < 4; k++) box(baseGroup, rw.x + 140, 1.4, rw.y - 16 - k * 6, 4, 2.8, 4, B.white);
        const w = SENTINEL.windsock;
        box(baseGroup, w.x, 12, w.y, 1, 24, 1, B.galv);
        windsock.position.set(w.x, 23, w.y);
        baseDynamic.add(windsock);
        for (let k = 0; k < 5; k++) {
          const seg = cylinder(windsock, 2.2 + k * 3.2, 0, 0, 2.6 - k * 0.3, 3.2, k % 2 ? B.white : B.amberLamp, 10, 2.3 - k * 0.3);
          seg.rotation.z = Math.PI / 2;
        }
        redBeacon(w.x, 25, w.y, 1.4);
      }
      // A few ornamental pines round HQ and the parade ground.
      for (const [x, z, s] of [
        [9555, 8060, 1],
        [9925, 8060, 1.1],
        [9555, 8230, 0.9],
        [9955, 8230, 1],
        [9960, 8600, 1],
        [9570, 8765, 0.8],
        [10025, 8740, 0.9],
      ]) {
        cylinder(baseGroup, x, 5 * s, z, 1.2 * s, 10 * s, B.dirt, 6);
        cylinder(baseGroup, x, 13 * s, z, 9 * s, 14 * s, leafMats[0], 8, 0.5);
        cylinder(baseGroup, x, 22 * s, z, 6 * s, 11 * s, leafMats[0], 8, 0.3);
      }
      // One mesh of ground light pools, lit at night.
      const baseGlowMesh = (() => {
        const positions = new Float32Array(glowPools.length * 12),
          colors = new Float32Array(glowPools.length * 12),
          uvs = new Float32Array(glowPools.length * 8),
          indices = new Uint32Array(glowPools.length * 6);
        glowPools.forEach((p, i) => {
          const corners = [
            [-1, -1, 0, 0],
            [1, -1, 1, 0],
            [1, 1, 1, 1],
            [-1, 1, 0, 1],
          ];
          corners.forEach(([dx, dz, u, v], k) => {
            positions.set([p.x + dx * p.r, 0.9, p.z + dz * p.r], (i * 4 + k) * 3);
            colors.set([p.color.r, p.color.g, p.color.b], (i * 4 + k) * 3);
            uvs.set([u, v], (i * 4 + k) * 2);
          });
          indices.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
        });
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(positions, 3));
        geo.setAttribute('color', new Three.BufferAttribute(colors, 3));
        geo.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
        geo.setIndex(new Three.BufferAttribute(indices, 1));
        geo.computeBoundingSphere();
        const m = new Three.Mesh(
          geo,
          new Three.MeshBasicMaterial({ map: haloTx, vertexColors: true, transparent: true, opacity: 0, blending: Three.AdditiveBlending, depthWrite: false }),
        );
        m.name = 'Fort Sentinel light pools';
        m.renderOrder = 2;
        m.visible = false;
        scene.add(m);
        return m;
      })();
      /* ---- Per frame -------------------------------------------------------------------- */
      const searchBeamDirection = new Three.Vector3(),
        searchBeamDown = new Three.Vector3(0, -1, 0);
      function updateBaseVisuals() {
        const near =
          Math.abs(viewCenter.x - 9930) < viewReach + 1500 && Math.abs(viewCenter.y - 8850) < viewReach + 1600;
        baseGlowMesh.visible = near && nightAmount > 0.05;
        if (!near) return;
        const night = nightAmount,
          alert = militaryAlertUntil > gameTime,
          blink = Math.sin(gameTime * 3.2) > 0.2 ? 1 : 0.15;
        baseGlowMesh.material.opacity = 0.42 * night;
        B.window.emissiveIntensity = 1.35 * night;
        for (const m of plateLit) m.emissiveIntensity = 0.05 + 0.35 * night;
        B.redLamp.color.setRGB(1, 0.23 * (0.3 + 0.7 * blink), 0.17 * (0.3 + 0.7 * blink)).multiplyScalar(0.35 + 0.65 * blink);
        for (const h of baseHalos) {
          if (h.kind === 'beacon') {
            h.sprite.visible = night > 0.05 || blink > 0.5;
            h.sprite.material.opacity = (0.25 + 0.75 * night) * blink;
          } else {
            h.sprite.visible = night > 0.08;
            h.sprite.material.opacity = 0.95 * night;
          }
        }
        // Gate pieces.
        for (const p of gateParts) {
          const s = p.state;
          p.pivot.visible = !s.armBroken;
          p.stub.visible = s.armBroken;
          p.pivot.rotation.x = -p.dir * s.arm * (Math.PI / 2) * 0.95;
          p.bollards.position.y = -9 * (1 - s.bollards);
          for (const [k, post] of p.bollardList.entries()) post.rotation.z = s.bollardsBroken ? 0.9 + k * 0.1 : 0;
          if (s.bollardsBroken) p.bollards.position.y = -2;
          p.slide.position.set(
            p.slideBase.x,
            s.slideBroken ? 1.5 : 0,
            p.slideBase.z + (s.slideBroken ? 0 : (1 - s.slide) * p.slideOpenOffset),
          );
          // Burst: knocked flat, inwards.
          p.slide.rotation.z = s.slideBroken ? -1.48 : 0;
        }
        // Flags wave; the windsock and the radar turn.
        const wind = 0.5 + (weather?.wind || 0.4);
        for (const f of flags) {
          const pos = f.mesh.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = f.base[i * 3];
            pos.setZ(i, Math.sin(gameTime * 4 * wind + f.phase - x * 0.35) * x * 0.09 * wind);
          }
          pos.needsUpdate = true;
          f.mesh.rotation.y = (weather?.windAngle || 0) * 0.3 + Math.sin(gameTime * 0.4 + f.phase) * 0.15;
        }
        windsock.rotation.y = -(weather?.windAngle || -0.7) + Math.sin(gameTime * 1.3) * 0.08;
        windsock.rotation.z = -0.5 + Math.min(0.45, wind * 0.3);
        if (radarHead) radarHead.rotation.y = gameTime * 1.6;
        // Searchlights: slow sweeps along the fence at night; on alert they hunt the intruder.
        const lit = night > 0.15;
        for (const s of searchlights) {
          const t = s.tower;
          let angle = t.a + Math.sin(gameTime * 0.32 + s.phase) * 0.95,
            reach = 170 + Math.sin(gameTime * 0.21 + s.phase * 2) * 60;
          if (alert) {
            const d = Math.hypot(player.x - t.x, player.y - t.y);
            if (d < 520) {
              angle = Math.atan2(player.y - t.y, player.x - t.x);
              reach = Math.max(40, d);
            }
          }
          // Ease the aim so a lock-on swings round rather than snapping.
          const da = Math.atan2(Math.sin(angle - s.aim), Math.cos(angle - s.aim));
          s.aim += da * 0.06;
          s.reach = (s.reach ?? reach) + (reach - (s.reach ?? reach)) * 0.06;
          const tx = t.x + Math.cos(s.aim) * s.reach,
            tz = t.y + Math.sin(s.aim) * s.reach,
            origin = s.head.position;
          s.head.rotation.y = -s.aim;
          s.lampBody.rotation.z = -Math.atan2(origin.y + 2.5, s.reach);
          s.beam.visible = s.spot.visible = lit;
          if (!lit) continue;
          searchBeamDirection.set(tx - origin.x, -(origin.y + 2.5), tz - origin.z);
          const length = searchBeamDirection.length();
          searchBeamDirection.normalize();
          s.beam.position.set(origin.x, origin.y + 2.5, origin.z);
          s.beam.quaternion.setFromUnitVectors(searchBeamDown, searchBeamDirection);
          s.beam.scale.set(16, length, 16);
          s.beam.material.opacity = 0.08 * night * (alert ? 1.4 : 1);
          s.spot.position.set(tx, 1.2, tz);
          s.spot.scale.set(52, 52, 1);
          s.spot.material.opacity = 0.75 * night;
        }
      }
      /* ---- Military vehicle models ------------------------------------------------------ */
      const oliveTrim = mat('#3c4433', 0.8, 0.2),
        canvasMat = mat('#6b6c4c', 0.97);
      function starDecal(parent, x, y, z, size, facing, flat = false) {
        const m = plate(parent, x, y, z, size, size, B.star, facing);
        if (flat) m.rotation.set(-Math.PI / 2, 0, facing);
        return m;
      }
      function militaryLamps(model, b, x, y, halfWidth) {
        for (const side of [-1, 1])
          model.lamps.push(
            { mesh: box(b, x, y, side * halfWidth, 1, 2.4, 3, warmLamp), key: side < 0 ? 'headLeft' : 'headRight', lit: warmLamp },
            { mesh: box(b, -x, y - 1, side * halfWidth, 0.6, 1.8, 2.4, tailLamp), key: side < 0 ? 'tailLeft' : 'tailRight', lit: tailLamp },
          );
      }
      // One wheel as two meshes: tyre and hub.
      function militaryWheel(model, x, z, r, width) {
        const pivot = new Three.Group();
        pivot.position.set(x, r, z);
        model.body.add(pivot);
        const tire = mesh(wheelGeo, rubber, pivot, 0, 0, 0, r, width, r);
        tire.rotation.x = Math.PI / 2;
        const hub = mesh(wheelGeo, oliveTrim, pivot, 0, 0, Math.sign(z) * width * 0.1, r * 0.55, width * 0.9, r * 0.55);
        hub.rotation.x = Math.PI / 2;
        model.wheels.push({ wheel: pivot, side: Math.sign(z) || 1 });
        return pivot;
      }
      function makeMilitaryVehicle(vehicle) {
        const spec = vehicleSpec(vehicle),
          kind = spec.militaryModel,
          model = specialVehicle(vehicle),
          b = model.body,
          p = model.paint,
          l = spec.l,
          w = spec.w,
          keep = new Set();
        p.roughness = 0.78;
        p.metalness = 0.15;
        if (kind === 'jeep') {
          const r = 6.4;
          box(b, 0, 6, 0, l * 0.9, 3, w * 0.7, darkMetal);
          box(b, -1, 10.5, 0, l * 0.96, 7, w * 0.94, p);
          box(b, l * 0.3, 14.2, 0, l * 0.36, 1.6, w * 0.8, p);
          for (const s of [-1, 1]) {
            box(b, l * 0.3, 12.4, s * w * 0.44, l * 0.4, 4.6, w * 0.16, p);
            box(b, -l * 0.3, 12.4, s * w * 0.44, l * 0.4, 4.6, w * 0.16, p);
          }
          box(b, l * 0.43, 12.5, 0, 2, 3, w * 0.5, oliveTrim);
          for (let k = -3; k <= 3; k++) box(b, l * 0.435, 12.5, k * 1.8, 2.2, 2.6, 0.5, darkMetal);
          const screen = box(b, l * 0.1, 18, 0, 1, 7, w * 0.78, glass);
          screen.rotation.z = 0.25;
          box(b, -l * 0.08, 21.8, 0, l * 0.36, 1.2, w * 0.84, p);
          for (const s of [-1, 1]) {
            box(b, -l * 0.07, 18, s * w * 0.43, l * 0.3, 6, 0.5, glass);
            box(b, -l * 0.22, 17.5, s * w * 0.42, 1.6, 8.5, 1.6, p);
            box(b, l * 0.08, 17.5, s * w * 0.42, 1.6, 8.5, 1.6, p);
            box(b, -l * 0.07, 10.5, s * w * 0.475, 0.4, 6, 0.3, oliveTrim);
          }
          box(b, -l * 0.35, 15.5, 0, l * 0.26, 3, w * 0.86, p);
          box(b, -l * 0.35, 18.5, 0, l * 0.26, 5, w * 0.84, canvasMat);
          box(b, l * 0.49, 7, 0, 2.2, 3, w * 0.86, darkMetal);
          for (const s of [-1, 1]) rodTo(b, l * 0.5, 6, s * w * 0.3, l * 0.52, 14, s * w * 0.3, 0.6, darkMetal);
          const spare = mesh(wheelGeo, rubber, b, -l * 0.5, 13, w * 0.2, 5, 2.2, 5);
          spare.rotation.z = Math.PI / 2;
          rodTo(b, -l * 0.3, 22, -w * 0.38, -l * 0.34, 44, -w * 0.4, 0.2, darkMetal);
          starDecal(b, l * 0.28, 15.1, 0, 7, -Math.PI / 2, true);
          for (const s of [-1, 1]) starDecal(b, -l * 0.08, 11, s * (w * 0.47 + 0.05), 5, s > 0 ? 0 : Math.PI);
          militaryLamps(model, b, l * 0.485, 12.2, w * 0.36);
          for (const x of [l * 0.31, -l * 0.31]) for (const s of [-1, 1]) militaryWheel(model, x, s * w * 0.4, r, 4.6);
          if (vehicle.gunner) {
            const ring = cylinder(b, -l * 0.08, 23, 0, 6, 1.4, oliveTrim, 14);
            const turret = new Three.Group();
            turret.position.set(-l * 0.08, 23.5, 0);
            b.add(turret);
            box(turret, 3, 4.5, 0, 1.2, 7, 11, p);
            box(turret, 0, 3, 0, 5, 3, 3, darkMetal);
            const barrel = new Three.Group();
            turret.add(barrel);
            rodTo(barrel, 2, 3.5, 0, 16, 3.5, 0, 0.45, darkMetal);
            box(barrel, 3, 4.5, 2.2, 3, 3, 2, oliveTrim);
            model.tank = true;
            model.turret = turret;
            model.barrel = barrel;
            keep.add(turret);
            ring.castShadow = false;
          }
        } else if (kind === 'apc') {
          const r = 6.3;
          box(b, 0, 13, 0, l * 0.9, 12, w * 0.92, p);
          const glacis = box(b, l * 0.4, 16.5, 0, l * 0.22, 3, w * 0.9, p);
          glacis.rotation.z = -0.55;
          const nose = box(b, l * 0.45, 10, 0, l * 0.12, 7, w * 0.9, p);
          nose.rotation.z = 0.5;
          const rear = box(b, -l * 0.44, 15, 0, l * 0.1, 10, w * 0.9, p);
          rear.rotation.z = -0.2;
          box(b, -l * 0.06, 19.8, 0, l * 0.62, 1.6, w * 0.84, p);
          for (const s of [-1, 1]) {
            const skirt = box(b, 0, 16, s * w * 0.47, l * 0.8, 6, 1.2, p);
            skirt.rotation.x = s * 0.35;
            box(b, -l * 0.2, 17, s * w * 0.5, l * 0.3, 3, 1.4, oliveTrim);
            for (const x of [-l * 0.3, -l * 0.1, l * 0.1]) box(b, x, 21, s * w * 0.36, 3, 1.2, 3, darkMetal);
            starDecal(b, l * 0.18, 13, s * (w * 0.49 + 0.2), 6, s > 0 ? 0 : Math.PI);
          }
          for (const s of [-1, 1]) for (let k = 0; k < 3; k++) box(b, l * 0.3 - k * 2.5, 21.3, s * 3 + s * k * 1.5, 1.6, 1.2, 1.2, darkMetal);
          rodTo(b, -l * 0.35, 20, w * 0.3, -l * 0.38, 50, w * 0.32, 0.2, darkMetal);
          rodTo(b, -l * 0.35, 20, -w * 0.3, -l * 0.37, 42, -w * 0.32, 0.2, darkMetal);
          militaryLamps(model, b, l * 0.48, 12, w * 0.36);
          for (const x of [-l * 0.33, -l * 0.12, l * 0.12, l * 0.33]) for (const s of [-1, 1]) militaryWheel(model, x, s * w * 0.42, r, 4.4);
          const turret = new Three.Group();
          turret.position.set(l * 0.02, 20.6, 0);
          b.add(turret);
          cylinder(turret, 0, 1.6, 0, 8.5, 3.2, p, 10, 7.5);
          box(turret, 1, 5, 0, 12, 4.5, 11, p);
          box(turret, -3, 7.8, -3, 4, 1.2, 4, oliveTrim);
          const barrel = new Three.Group();
          turret.add(barrel);
          rodTo(barrel, 6, 5, 0, 34, 5, 0, 0.7, darkMetal);
          box(barrel, 7.5, 5, 0, 3, 3, 3.6, p);
          model.tank = true;
          model.turret = turret;
          model.barrel = barrel;
          keep.add(turret);
        } else {
          // Cargo truck (or the fuel bowser).
          const r = 6.2,
            bowser = !!vehicle.fuelBowser;
          box(b, -l * 0.02, 7.5, 0, l * 0.94, 3, w * 0.5, darkMetal);
          box(b, l * 0.36, 13.5, 0, l * 0.2, 8, w * 0.52, p);
          for (const s of [-1, 1]) {
            const fender = box(b, l * 0.36, 12, s * w * 0.38, l * 0.2, 1.4, w * 0.26, p);
            fender.rotation.x = s * -0.12;
          }
          box(b, l * 0.465, 13, 0, 1.2, 7, w * 0.44, darkMetal);
          box(b, l * 0.2, 16, 0, l * 0.14, 12, w * 0.9, p);
          box(b, l * 0.275, 19.5, 0, 0.6, 5.5, w * 0.8, glass);
          box(b, l * 0.2, 22.6, 0, l * 0.15, 1.2, w * 0.92, canvasMat);
          for (const s of [-1, 1]) {
            box(b, l * 0.2, 19.5, s * w * 0.455, l * 0.1, 4.5, 0.4, glass);
            box(b, l * 0.28, 19, s * w * 0.5, 0.8, 4, 2.5, darkMetal);
            starDecal(b, l * 0.2, 14, s * (w * 0.455 + 0.2), 5.5, s > 0 ? 0 : Math.PI);
          }
          if (bowser) {
            const tank = cylinder(b, -l * 0.2, 17, 0, w * 0.4, l * 0.52, p, 18);
            tank.rotation.z = Math.PI / 2;
            box(b, -l * 0.2, 25, 0, l * 0.3, 1, 5, darkMetal);
            for (const s of [-1, 1]) plate(b, -l * 0.2, 17, s * (w * 0.41 + 0.3), 18, 5, plateMaterial('FLAMMABLE', { bg: '#b8322a', fg: '#ffffff', w: 256, h: 64 }), s > 0 ? 0 : Math.PI);
          } else {
            box(b, -l * 0.2, 10.5, 0, l * 0.56, 2, w * 0.96, p);
            for (const s of [-1, 1]) box(b, -l * 0.2, 13.5, s * w * 0.47, l * 0.56, 5, 1, p);
            const cover = new Three.Mesh(vaultGeometry(w * 0.96, 12, l * 0.56, 10), canvasMat);
            cover.rotation.y = Math.PI / 2;
            cover.position.set(-l * 0.2, 15.5, 0);
            b.add(cover);
            for (const s of [-1, 1]) box(b, -l * 0.2, 15.5, s * w * 0.475, l * 0.56, 1.5, 0.6, canvasMat);
            const back = new Three.Mesh(archWallGeometry(w * 0.96, 12), canvasMat);
            back.position.set(-l * 0.48, 15.5, 0);
            back.rotation.y = -Math.PI / 2;
            b.add(back);
          }
          militaryLamps(model, b, l * 0.47, 12, w * 0.3);
          for (const x of [l * 0.34, -l * 0.18, -l * 0.34]) for (const s of [-1, 1]) militaryWheel(model, x, s * w * 0.4, r, 4.2);
        }
        for (const lamp of model.lamps) keep.add(lamp.mesh);
        for (const wheel of model.wheels) keep.add(wheel.wheel);
        mergeUnder(b, keep);
        if (model.turret) {
          const inner = new Set([model.barrel]);
          mergeUnder(model.turret, inner);
          mergeUnder(model.barrel);
        }
        return model;
      }
      // The tank (county3d.js) is ~60 meshes: merge its hull and turret the same way.
      function compactTank(model) {
        mergeUnder(model.body, new Set([model.turret, ...(model.lamps || []).map((l) => l.mesh)]));
        mergeUnder(model.turret, new Set([model.barrel]));
        mergeUnder(model.barrel);
        return model;
      }
      /* ---- Soldiers ---------------------------------------------------------------------- */
      const soldierKit = {
        helmet: mat('#4b5539', 0.85),
        vest: mat('#56603f', 0.9),
        pouch: mat('#434b32', 0.9),
        rifle: mat('#26292b', 0.55, 0.4),
        band: mat('#e9e6dc', 0.7),
      };
      function dressSoldier(person, model) {
        const group = model.group;
        mesh(sphereGeo, soldierKit.helmet, group, 0.1, 16.9, 0, 2.45, 1.75, 2.5);
        box(group, 0.1, 16.1, 0, 5.4, 0.35, 5.4, soldierKit.helmet);
        if (person.role === 'gate') box(group, 0.1, 16.9, 0, 4.9, 0.8, 5.1, soldierKit.band);
        box(group, 0.2, 10.4, 0, 5.4, 5.6, 7.2, soldierKit.vest);
        for (const z of [-2, 0, 2]) box(group, 2.8, 9.5, z, 0.9, 1.8, 1.5, soldierKit.pouch);
        box(group, -2.9, 10.8, 0, 1, 3.6, 3.6, soldierKit.pouch);
        // Swap the pistol for a carbine.
        const gun = model.parts.guns[0];
        for (const c of [...gun.children]) gun.remove(c);
        box(gun, 3.5, 0, 0, 8, 1.3, 1.1, soldierKit.rifle);
        box(gun, -1.5, -0.4, 0, 4, 1.8, 1.2, soldierKit.rifle);
        box(gun, 4.5, -1.8, 0, 1.2, 3, 1, soldierKit.rifle);
        box(gun, 3.5, 1.2, 0, 3, 0.8, 0.8, soldierKit.rifle);
        const barrel = mesh(cylinderGeo, soldierKit.rifle, gun, 9.5, 0, 0, 0.3, 5, 0.3);
        barrel.rotation.z = Math.PI / 2;
        gun.visible = true;
        mergeUnder(group, new Set([model.parts.leg1, model.parts['leg-1'], model.parts.arm1, model.parts['arm-1'], gun, model.torso]));
      }
      // Rifle at the ready when aiming or challenging, carried across the chest otherwise.
      function poseSoldier(p, model, incapacitated) {
        const gun = model.parts.guns[0];
        gun.visible = p.hp > 0 && !incapacitated;
        if (incapacitated || p.hp <= 0) return;
        if (p.aiming || p.aimingOnly) {
          gun.position.set(5, 10, 3.8);
          gun.rotation.set(0, 0, 0);
          model.parts.arm1.rotation.z = 1.12;
          model.parts['arm-1'].rotation.z = 0.9;
        } else {
          gun.position.set(3.6, 10.5, 0.8);
          gun.rotation.set(0, -0.9, 0.75);
          model.parts.arm1.rotation.z = 0.6;
          model.parts['arm-1'].rotation.z = 0.75;
        }
      }
      // END SUBSYSTEM: src/base3d.js
