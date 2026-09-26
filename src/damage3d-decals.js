      const DECAL = {
        hole: 0,
        chip: 1,
        star: 2,
        scuff: 3,
        scorch: 4,
        crater: 5,
        pane: 6,
        crack: 7,
        shards: 8,
        puddle: 9,
        scrape: 10,
        rubble: 11,
        window: 12,
        oil: 13,
        litter: 14,
        soot: 15,
      };
      // ---- Procedural decal atlas: 4 × 4 tiles of 256 px -------------------------------
      function paintDecalAtlas() {
        const size = 256,
          cv = document.createElement('canvas');
        cv.width = cv.height = size * 4;
        const g = cv.getContext('2d');
        let seed = 977;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
          range = (a, b) => a + rnd() * (b - a);
        const tile = (index, paint) => {
          g.save();
          g.translate((index % 4) * size, Math.floor(index / 4) * size);
          g.beginPath();
          g.rect(6, 6, size - 12, size - 12);
          g.clip();
          paint(size / 2);
          g.restore();
        };
        // An irregular closed outline: a rough hole, a chip, a blot.
        const blob = (cx, cy, r, jag, points = 18) => {
          g.beginPath();
          for (let i = 0; i < points; i++) {
            const a = (i / points) * TAU,
              rr = r * (1 - jag + rnd() * jag * 2);
            if (i) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            else g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          }
          g.closePath();
        };
        const soft = (cx, cy, r, rgb, alpha) => {
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
          gr.addColorStop(0, `rgba(${rgb},${alpha})`);
          gr.addColorStop(1, `rgba(${rgb},0)`);
          g.fillStyle = gr;
          g.fillRect(cx - r, cy - r, r * 2, r * 2);
        };
        // Cracks wander outward and fork.
        const crack = (x, y, a, length, width, color, forks = 1) => {
          g.strokeStyle = color;
          g.lineCap = 'round';
          let px = x,
            py = y;
          const steps = Math.max(3, Math.floor(length / 12));
          for (let s = 0; s < steps; s++) {
            a += range(-0.45, 0.45);
            const nx = px + Math.cos(a) * (length / steps),
              ny = py + Math.sin(a) * (length / steps);
            g.lineWidth = Math.max(0.6, width * (1 - s / steps));
            g.beginPath();
            g.moveTo(px, py);
            g.lineTo(nx, ny);
            g.stroke();
            if (forks > 0 && rnd() < 0.18) crack(nx, ny, a + range(-1, 1), length * 0.45, width * 0.6, color, forks - 1);
            px = nx;
            py = ny;
          }
        };
        tile(DECAL.hole, (c) => {
          g.fillStyle = 'rgba(38,34,30,0.35)';
          blob(c, c, 92, 0.3, 24);
          g.fill();
          g.fillStyle = '#9aa0a3';
          blob(c, c, 66, 0.28, 16);
          g.fill();
          g.fillStyle = '#dcdedc';
          blob(c, c, 50, 0.2, 14);
          g.fill();
          g.fillStyle = '#0b0a09';
          blob(c, c, 38, 0.16, 12);
          g.fill();
          for (let i = 0; i < 6; i++) crack(c, c, rnd() * TAU, range(50, 80), 3, 'rgba(60,58,55,0.6)', 0);
        });
        tile(DECAL.chip, (c) => {
          soft(c, c, 118, '214,205,190', 0.4);
          g.fillStyle = '#8a8176';
          blob(c, c, 72, 0.35, 16);
          g.fill();
          g.fillStyle = '#4a433b';
          blob(c, c, 48, 0.3, 13);
          g.fill();
          g.fillStyle = '#100e0c';
          blob(c, c, 26, 0.25, 10);
          g.fill();
          for (let i = 0; i < 5; i++) crack(c, c, rnd() * TAU, range(60, 105), 4, 'rgba(40,34,28,0.75)', 1);
        });
        tile(DECAL.star, (c) => {
          const spokes = 13;
          for (let i = 0; i < spokes; i++)
            crack(c, c, (i / spokes) * TAU + range(-0.15, 0.15), range(70, 118), 3.2, 'rgba(236,244,248,0.9)', 1);
          g.strokeStyle = 'rgba(226,236,242,0.7)';
          for (const r of [22, 44, 72]) {
            g.lineWidth = r < 40 ? 2.4 : 1.6;
            g.beginPath();
            for (let i = 0; i <= spokes; i++) {
              const a = (i / spokes) * TAU,
                rr = r * range(0.8, 1.15);
              if (i) g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
              else g.moveTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
            }
            g.stroke();
          }
          soft(c, c, 22, '240,246,250', 0.9);
          g.fillStyle = '#0d1114';
          blob(c, c, 7, 0.2, 9);
          g.fill();
        });
        tile(DECAL.scuff, (c) => {
          soft(c, c, 80, '190,180,164', 0.45);
          g.fillStyle = 'rgba(38,35,31,0.9)';
          g.beginPath();
          g.ellipse(c, c, 46, 15, 0.2, 0, TAU);
          g.fill();
          g.fillStyle = 'rgba(20,18,16,0.95)';
          g.beginPath();
          g.ellipse(c - 10, c, 20, 8, 0.2, 0, TAU);
          g.fill();
          for (let i = 0; i < 40; i++) {
            g.fillStyle = rnd() < 0.5 ? 'rgba(60,55,48,0.8)' : 'rgba(200,190,172,0.7)';
            g.fillRect(c + range(-90, 90), c + range(-50, 50), range(2, 5), range(2, 5));
          }
        });
        tile(DECAL.scorch, (c) => {
          for (let i = 0; i < 70; i++) {
            const a = rnd() * TAU,
              r = Math.pow(rnd(), 0.7) * 78;
            soft(c + Math.cos(a) * r, c + Math.sin(a) * r, range(22, 52), '14,11,9', range(0.18, 0.36));
          }
          soft(c, c, 70, '8,6,5', 0.75);
        });
        tile(DECAL.crater, (c) => {
          for (let i = 0; i < 9; i++) crack(c, c, rnd() * TAU, range(80, 118), 5, 'rgba(34,29,24,0.8)', 1);
          g.fillStyle = '#9c9284';
          blob(c, c, 86, 0.3, 20);
          g.fill();
          g.fillStyle = '#6e655a';
          blob(c, c, 66, 0.28, 16);
          g.fill();
          for (let i = 0; i < 14; i++) {
            g.fillStyle = rnd() < 0.5 ? '#8a5a45' : '#b3a898';
            blob(c + range(-60, 60), c + range(-60, 60), range(6, 14), 0.3, 7);
            g.fill();
          }
          g.fillStyle = '#302b25';
          blob(c, c, 48, 0.3, 14);
          g.fill();
          g.fillStyle = '#12100e';
          blob(c, c, 28, 0.3, 11);
          g.fill();
          g.strokeStyle = 'rgba(70,58,48,0.9)';
          g.lineWidth = 2.5;
          for (let i = 0; i < 4; i++) {
            const a = rnd() * TAU;
            g.beginPath();
            g.moveTo(c + Math.cos(a) * 20, c + Math.sin(a) * 20);
            g.lineTo(c + Math.cos(a + 0.2) * 70, c + Math.sin(a + 0.2) * 70);
            g.stroke();
          }
        });
        // A shattered shop window: the dark shop behind, with jagged glass left in the frame.
        const brokenFrame = (inset, depth) => {
          g.fillStyle = 'rgba(12,15,18,0.97)';
          g.fillRect(inset, inset, 256 - inset * 2, 256 - inset * 2);
          const edge = (x0, y0, x1, y1, ix, iy) => {
            let t = 0;
            while (t < 1) {
              const step = range(0.06, 0.16),
                mid = t + step / 2,
                reach = range(depth * 0.25, depth);
              g.fillStyle = `rgba(${150 + rnd() * 40},${178 + rnd() * 30},${196 + rnd() * 25},${range(0.45, 0.7)})`;
              g.beginPath();
              g.moveTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
              g.lineTo(x0 + (x1 - x0) * Math.min(1, t + step), y0 + (y1 - y0) * Math.min(1, t + step));
              g.lineTo(x0 + (x1 - x0) * mid + ix * reach, y0 + (y1 - y0) * mid + iy * reach);
              g.closePath();
              g.fill();
              g.strokeStyle = 'rgba(230,240,246,0.5)';
              g.lineWidth = 1.2;
              g.stroke();
              t += step;
            }
          };
          const a = inset,
            b = 256 - inset;
          edge(a, a, b, a, 0, 1);
          edge(b, a, b, b, -1, 0);
          edge(b, b, a, b, 0, -1);
          edge(a, b, a, a, 1, 0);
        };
        tile(DECAL.pane, () => brokenFrame(7, 70));
        tile(DECAL.crack, (c) => {
          g.fillStyle = 'rgba(92,84,74,0.85)';
          blob(c, c, 40, 0.35, 14);
          g.fill();
          g.fillStyle = 'rgba(40,35,30,0.9)';
          blob(c, c, 20, 0.35, 10);
          g.fill();
          for (let i = 0; i < 9; i++) crack(c, c, rnd() * TAU, range(70, 120), 4.5, 'rgba(30,26,22,0.9)', 2);
          for (let i = 0; i < 10; i++) {
            g.fillStyle = 'rgba(70,62,54,0.8)';
            blob(c + range(-70, 70), c + range(-70, 70), range(3, 8), 0.4, 6);
            g.fill();
          }
        });
        tile(DECAL.shards, (c) => {
          for (let i = 0; i < 220; i++) {
            const a = rnd() * TAU,
              r = Math.pow(rnd(), 0.8) * 118,
              x = c + Math.cos(a) * r,
              y = c + Math.sin(a) * r * 0.8,
              s = range(1.5, 5.5);
            g.fillStyle = rnd() < 0.6 ? `rgba(228,240,246,${range(0.7, 0.95)})` : `rgba(150,190,210,${range(0.6, 0.9)})`;
            g.beginPath();
            g.moveTo(x, y - s);
            g.lineTo(x + s * range(0.4, 1), y + s * 0.6);
            g.lineTo(x - s * range(0.4, 1), y + s * 0.3);
            g.closePath();
            g.fill();
          }
        });
        tile(DECAL.puddle, (c) => {
          for (let i = 0; i < 14; i++) soft(c + range(-45, 45), c + range(-40, 40), range(40, 70), '28,40,48', 0.35);
          soft(c - 20, c - 15, 40, '150,175,190', 0.12);
        });
        tile(DECAL.scrape, (c) => {
          for (let i = 0; i < 46; i++) {
            const y = c + range(-26, 26),
              x0 = range(10, 110),
              x1 = range(146, 246);
            g.strokeStyle = rnd() < 0.7 ? `rgba(214,218,216,${range(0.5, 0.85)})` : 'rgba(62,64,66,0.8)';
            g.lineWidth = range(0.8, 2.4);
            g.beginPath();
            g.moveTo(x0, y);
            g.lineTo(x1, y + range(-4, 4));
            g.stroke();
          }
          soft(c, c, 90, '120,120,118', 0.18);
        });
        tile(DECAL.rubble, (c) => {
          for (let i = 0; i < 10; i++) soft(c + range(-40, 40), c + range(-40, 40), range(50, 80), '160,152,140', 0.3);
          for (let i = 0; i < 90; i++) {
            g.fillStyle = rnd() < 0.5 ? 'rgba(74,68,60,0.9)' : 'rgba(186,178,164,0.9)';
            const a = rnd() * TAU,
              r = Math.pow(rnd(), 0.7) * 110;
            blob(c + Math.cos(a) * r, c + Math.sin(a) * r, range(2, 7), 0.4, 6);
            g.fill();
          }
        });
        tile(DECAL.window, () => {
          brokenFrame(30, 42);
          g.strokeStyle = 'rgba(20,18,16,0.8)';
          g.lineWidth = 6;
          g.strokeRect(30, 30, 196, 196);
        });
        tile(DECAL.oil, (c) => {
          soft(c, c, 100, '10,9,8', 0.5);
          g.fillStyle = 'rgba(8,7,6,0.72)';
          blob(c, c, 66, 0.35, 16);
          g.fill();
          soft(c - 18, c - 12, 36, '90,70,120', 0.1);
          soft(c + 16, c + 10, 30, '60,110,90', 0.08);
        });
        tile(DECAL.litter, (c) => {
          const colors = ['#e8e2d0', '#c9c1a8', '#b4483e', '#556c8a', '#9aa6ad', '#d8b44a'];
          for (let i = 0; i < 30; i++) {
            g.save();
            g.translate(c + range(-100, 100), c + range(-100, 100));
            g.rotate(rnd() * TAU);
            g.fillStyle = colors[Math.floor(rnd() * colors.length)];
            g.fillRect(-range(4, 10), -range(3, 7), range(8, 20), range(6, 14));
            g.restore();
          }
        });
        tile(DECAL.soot, (c) => {
          for (let i = 0; i < 26; i++) {
            const x = c + range(-40, 40),
              w = range(26, 60),
              gr = g.createLinearGradient(0, 250, 0, range(6, 60));
            gr.addColorStop(0, 'rgba(12,10,8,0.55)');
            gr.addColorStop(1, 'rgba(12,10,8,0)');
            g.fillStyle = gr;
            g.beginPath();
            g.moveTo(x - w / 2, 250);
            g.quadraticCurveTo(x + range(-30, 30), 120, x + range(-20, 20), 8);
            g.quadraticCurveTo(x + range(-30, 30), 120, x + w / 2, 250);
            g.fill();
          }
        });
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      // A spider-webbed windscreen, mapped across each cracked pane.
      function paintCrackedGlass() {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const g = cv.getContext('2d');
        let seed = 4099;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
        g.fillStyle = '#1b2c39';
        g.fillRect(0, 0, 256, 256);
        const cx = 150,
          cy = 110;
        g.strokeStyle = 'rgba(214,228,236,0.85)';
        for (let i = 0; i < 18; i++) {
          let a = (i / 18) * TAU,
            x = cx,
            y = cy;
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(x, y);
          for (let s = 0; s < 12; s++) {
            a += (rnd() - 0.5) * 0.5;
            x += Math.cos(a) * 16;
            y += Math.sin(a) * 16;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        for (const r of [18, 40, 70, 110]) {
          g.lineWidth = 1;
          g.beginPath();
          for (let i = 0; i <= 18; i++) {
            const a = (i / 18) * TAU,
              rr = r * (0.8 + rnd() * 0.4);
            if (i) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            else g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          }
          g.stroke();
        }
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        return tx;
      }
      // Blistered paint, soot and rust for a burnt-out shell.
      function paintSoot() {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const g = cv.getContext('2d');
        let seed = 733;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
        g.fillStyle = '#34302b';
        g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 420; i++) {
          const r = 2 + rnd() * 16,
            x = rnd() * 256,
            y = rnd() * 256,
            pick = rnd();
          g.fillStyle =
            pick < 0.45 ? 'rgba(14,12,10,0.55)' : pick < 0.7 ? 'rgba(112,58,30,0.45)' : pick < 0.85 ? 'rgba(120,114,106,0.35)' : 'rgba(70,40,26,0.5)';
          g.beginPath();
          g.arc(x, y, r, 0, TAU);
          g.fill();
        }
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        return tx;
      }
      const decalAtlas = paintDecalAtlas(),
        crackedGlassTexture = paintCrackedGlass(),
        sootTexture = paintSoot();
      // ---- Decal layers ------------------------------------------------------------------
      const decalMaterial = new Three.MeshStandardMaterial({
        map: decalAtlas,
        transparent: true,
        depthWrite: false,
        roughness: 0.9,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      // Each instance picks its atlas tile and opacity from two instanced attributes.
      decalMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aTile;\nattribute float aAlpha;\nvarying float vDecalAlpha;')
          .replace(
            '#include <uv_vertex>',
            '#include <uv_vertex>\nvMapUv = vMapUv * 0.25 + vec2(mod(aTile, 4.0), 3.0 - floor(aTile / 4.0)) * 0.25;\nvDecalAlpha = aAlpha;',
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vDecalAlpha;')
          .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vDecalAlpha;');
      };
      const white = new Three.Color('#ffffff'),
        scratchColor = new Three.Color();
      function decalLayer(capacity, order) {
        const geometry = new Three.PlaneGeometry(1, 1),
          tiles = new Three.InstancedBufferAttribute(new Float32Array(capacity), 1),
          alphas = new Three.InstancedBufferAttribute(new Float32Array(capacity), 1);
        tiles.setUsage(Three.DynamicDrawUsage);
        alphas.setUsage(Three.DynamicDrawUsage);
        geometry.setAttribute('aTile', tiles);
        geometry.setAttribute('aAlpha', alphas);
        const decals = new Three.InstancedMesh(geometry, decalMaterial, capacity);
        decals.instanceMatrix.setUsage(Three.DynamicDrawUsage);
        decals.setColorAt(0, white);
        decals.instanceColor.setUsage(Three.DynamicDrawUsage);
        decals.count = 0;
        decals.frustumCulled = false;
        decals.receiveShadow = true;
        decals.renderOrder = order;
        decals.name = 'damage decals';
        scene.add(decals);
        return { mesh: decals, tiles, alphas, capacity, next: 0, used: 0, dirty: false };
      }
      const worldDecals = decalLayer(2400, 3),
        vehicleDecals = decalLayer(1200, 4);
      const decalX = new Three.Vector3(),
        decalY = new Three.Vector3(),
        decalZ = new Three.Vector3(),
        decalMatrix = new Three.Matrix4();
      // Orients a unit quad on a surface: +z along the normal, +x horizontal (world x on
      // the ground), rolled about the normal; scaled to sx by sy.
      function decalPose(target, x, y, z, nx, ny, nz, sx, sy, roll, lift) {
        decalZ.set(nx, ny, nz).normalize();
        if (Math.abs(decalZ.y) > 0.95) decalX.set(1, 0, 0);
        else decalX.set(0, 1, 0).cross(decalZ).normalize();
        decalY.crossVectors(decalZ, decalX);
        if (roll) {
          const c = Math.cos(roll),
            s = Math.sin(roll),
            x0 = decalX.x,
            x1 = decalX.y,
            x2 = decalX.z;
          decalX.set(x0 * c + decalY.x * s, x1 * c + decalY.y * s, x2 * c + decalY.z * s);
          decalY.crossVectors(decalZ, decalX);
        }
        decalX.multiplyScalar(sx);
        decalY.multiplyScalar(sy);
        target.makeBasis(decalX, decalY, decalZ);
        target.setPosition(x + decalZ.x * lift, y + decalZ.y * lift, z + decalZ.z * lift);
        return target;
      }
      function writeDecal(layer, index, matrix, tile, alpha, color) {
        layer.mesh.setMatrixAt(index, matrix);
        layer.tiles.array[index] = tile;
        layer.alphas.array[index] = alpha;
        layer.mesh.setColorAt(index, color ? scratchColor.set(color) : white);
        layer.dirty = true;
      }
      // World decal in Three.js coordinates (x, height, z). The oldest is overwritten when full.
      function addDecal(tile, x, y, z, nx, ny, nz, sx, sy, roll = Math.random() * TAU, alpha = 1, color = null, lift = 0.06) {
        const layer = worldDecals,
          index = layer.next;
        layer.next = (layer.next + 1) % layer.capacity;
        layer.used = Math.min(layer.capacity, layer.used + 1);
        layer.mesh.count = layer.used;
        writeDecal(layer, index, decalPose(decalMatrix, x, y, z, nx, ny, nz, sx, sy, roll, lift), tile, alpha, color);
      }
      function flushDecals(layer) {
        if (!layer.dirty) return;
        layer.dirty = false;
        layer.mesh.instanceMatrix.needsUpdate = true;
        layer.mesh.instanceColor.needsUpdate = true;
        layer.tiles.needsUpdate = true;
        layer.alphas.needsUpdate = true;
      }
      // How far a wall decal must stand off the collision face to sit on the visible
      // surface: shopfronts, plinths and tower podiums project past the footprint.
      function wallOffset(building, ny, z) {
        if (!building || ny < 0.5) return 0.18;
        const podium = building.archetype === 'tower' && building.height > realBuildingHeight(260) ? Math.min(46, building.height * 0.1) : 0;
        if (z < podium) return 11.2;
        if (z < 5 && building.archetype !== 'tower') return 1.95;
        if (building.shopPanes && z < SHOP_FLOOR + 1.3) return 1.2;
        return 0.18;
      }
      function facadeColor(building) {
        const entry = building && allBuildings.find((o) => o.b === building);
        return entry ? '#' + (entry.tint || entry.materials[0].color).getHexString() : '#a39b90';
      }

      // ---- Debris: rubble chunks and torn-off panels -------------------------------------
      const chunkMesh = new Three.InstancedMesh(
          new Three.DodecahedronGeometry(1, 0),
          new Three.MeshStandardMaterial({ roughness: 0.95, metalness: 0.05 }),
          700,
        ),
        panelMesh = new Three.InstancedMesh(boxGeo, new Three.MeshStandardMaterial({ roughness: 0.4, metalness: 0.55 }), 90);
      for (const pool of [chunkMesh, panelMesh]) {
        pool.count = 0;
        pool.castShadow = true;
        pool.receiveShadow = true;
        pool.frustumCulled = false;
        pool.instanceMatrix.setUsage(Three.DynamicDrawUsage);
        pool.setColorAt(0, white);
        scene.add(pool);
      }
      const chunks = [],
        panels = [],
        debrisQuaternion = new Three.Quaternion(),
        debrisScale = new Three.Vector3(),
        debrisPosition = new Three.Vector3(),
        debrisMatrix = new Three.Matrix4();
      let debrisDirty = false;
      function newDebris(list, capacity, piece) {
        if (list.length >= capacity) list.shift();
        piece.q = piece.q || new Three.Quaternion().setFromEuler(new Three.Euler(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU));
        piece.spin = piece.spin || new Three.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        piece.rate = piece.rate ?? (piece.rest ? 0 : 4 + Math.random() * 10);
        piece.born = gameTime;
        list.push(piece);
        debrisDirty = true;
        return piece;
      }
      // Broken masonry: mostly brick and concrete core, some of it the painted facade.
      const rubbleBrick = new Three.Color('#7a5243'),
        rubbleConcrete = new Three.Color('#6c6861');
      function rubbleColor(facade) {
        const pick = Math.random(),
          color = (pick < 0.4 ? rubbleBrick : pick < 0.75 ? rubbleConcrete : facade).clone();
        return color.multiplyScalar((pick < 0.75 ? 0.75 : 0.55) + Math.random() * 0.35);
      }
      // Flying chunks off a wall or a crater: x, height, z in Three.js coordinates.
      function spawnChunks(x, y, z, nx, nz, count, color, speed = 1, masonry = true) {
        const base = new Three.Color(color);
        for (let i = 0; i < count; i++) {
          const spread = (Math.random() - 0.5) * 1.4,
            out = (40 + Math.random() * 110) * speed;
          newDebris(chunks, 700, {
            x: x + (Math.random() - 0.5) * 6,
            y,
            z: z + (Math.random() - 0.5) * 6,
            vx: nx * out - nz * spread * 60 * speed,
            vy: (30 + Math.random() * 90) * speed,
            vz: nz * out + nx * spread * 60 * speed,
            size: 0.6 + Math.random() * 2.2,
            color: masonry ? rubbleColor(base) : base.clone().multiplyScalar(0.7 + Math.random() * 0.4),
          });
        }
      }
      // A heap at the foot of a broken wall, already at rest.
      function spawnRubble(x, z, nx, nz, count, color, spread = 18) {
        const base = new Three.Color(color);
        for (let i = 0; i < count; i++) {
          const along = (Math.random() - 0.5) * 2 * spread,
            out = Math.pow(Math.random(), 1.6) * 12 + 1,
            size = 0.8 + Math.random() * 2.8,
            px = x + nx * out - nz * along,
            pz = z + nz * out + nx * along;
          newDebris(chunks, 700, {
            x: px,
            y: terrainHeight(px, pz) + size * 0.55,
            z: pz,
            vx: 0,
            vy: 0,
            vz: 0,
            size,
            rest: true,
            color: rubbleColor(base),
          });
        }
      }
      // A panel torn off a car keeps the car's speed and tumbles down the road.
      function spawnPanel(part, color, vehicle, sx, sy, sz, kick = 1) {
        part.updateMatrixWorld(true);
        part.matrixWorld.decompose(debrisPosition, debrisQuaternion, debrisScale);
        // The part's size is in its model's design units (render3d.js DESIGN SIZE).
        const k = carModels.get(vehicle)?.modelScale || vehicleSpec(vehicle)?.modelScale || 1,
          ks = Array.isArray(k) ? k[0] : k;
        sx *= ks;
        sy *= ks;
        sz *= ks;
        newDebris(panels, 90, {
          x: debrisPosition.x,
          y: debrisPosition.y,
          z: debrisPosition.z,
          vx: (vehicle.vx || 0) * 0.7 + (Math.random() - 0.5) * 60 * kick,
          vy: 40 + Math.random() * 60 * kick,
          vz: (vehicle.vy || 0) * 0.7 + (Math.random() - 0.5) * 60 * kick,
          sx,
          sy,
          sz,
          q: debrisQuaternion.clone(),
          color: new Three.Color(color),
          panel: true,
        });
      }
      function stepDebris(list, deltaSeconds, lifetime) {
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i],
            age = gameTime - p.born;
          if (age > lifetime) {
            list.splice(i, 1);
            debrisDirty = true;
            continue;
          }
          // The last seconds of a piece's life are a sink out of sight: redraw.
          if (age > lifetime - 4) debrisDirty = true;
          if (p.rest) {
            if (p.flatten) {
              p.q.slerp(p.flatten, Math.min(1, deltaSeconds * 10));
              if (p.q.angleTo(p.flatten) < 0.01) p.flatten = null;
              debrisDirty = true;
            }
            continue;
          }
          debrisDirty = true;
          p.vy -= 210 * deltaSeconds;
          p.x += p.vx * deltaSeconds;
          p.y += p.vy * deltaSeconds;
          p.z += p.vz * deltaSeconds;
          if (p.rate > 0) p.q.multiply(debrisQuaternion.setFromAxisAngle(p.spin, p.rate * deltaSeconds));
          const half = p.panel ? Math.min(p.sx, p.sy, p.sz) / 2 : p.size * 0.55,
            floor = terrainHeight(p.x, p.z) + half;
          if (p.y <= floor) {
            p.y = floor;
            if (p.vy < -28) {
              p.vy *= -0.3;
              p.vx *= 0.6;
              p.vz *= 0.6;
              p.rate *= 0.6;
            } else {
              p.vy = 0;
              p.vx *= Math.pow(0.02, deltaSeconds);
              p.vz *= Math.pow(0.02, deltaSeconds);
              p.rate *= Math.pow(0.02, deltaSeconds);
              if (Math.hypot(p.vx, p.vz) < 3) {
                p.rest = true;
                if (p.panel) {
                  // Lie flat on the thinnest side, keeping the yaw it landed with.
                  const thin = p.sy <= p.sx && p.sy <= p.sz ? 'y' : p.sx <= p.sz ? 'x' : 'z',
                    euler = new Three.Euler().setFromQuaternion(p.q, 'YXZ');
                  p.flatten = new Three.Quaternion().setFromEuler(
                    thin === 'y'
                      ? new Three.Euler(0, euler.y, 0, 'YXZ')
                      : thin === 'x'
                        ? new Three.Euler(0, euler.y, Math.PI / 2, 'YXZ')
                        : new Three.Euler(Math.PI / 2, euler.y, 0, 'YXZ'),
                  );
                }
              }
            }
          }
        }
      }
      function drawDebris(pool, list, lifetime, panel) {
        let n = 0;
        for (const p of list) {
          // The last few seconds: sink out of sight rather than pop.
          const fade = clamp((lifetime - (gameTime - p.born)) / 4, 0, 1);
          debrisPosition.set(p.x, p.y - (1 - fade) * 3, p.z);
          if (panel) debrisScale.set(p.sx, p.sy, p.sz);
          else debrisScale.setScalar(p.size * (0.4 + 0.6 * fade));
          pool.setMatrixAt(n, debrisMatrix.compose(debrisPosition, p.q, debrisScale));
          pool.setColorAt(n, p.color);
          n++;
        }
        pool.count = n;
        pool.instanceMatrix.needsUpdate = true;
        if (pool.instanceColor) pool.instanceColor.needsUpdate = true;
      }
