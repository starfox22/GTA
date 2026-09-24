      // BEGIN SUBSYSTEM: src/damage3d.js — Crumpling bodies, decals, debris and knocked furniture
      /**
       * Crumpling bodies, decals, debris and knocked furniture
       * Source: src/damage3d.js
       * Scope: createCityRenderer() closure.
       *
       * Draws what damage.js records, and never decides anything itself:
       *  - Car bodies are a finely sliced shell whose vertices are pushed along each
       *    dent's direction (crumple). Pristine cars share one geometry per body size;
       *    a car gets its own copy the first time it is dented.
       *  - Hoods buckle, spring open and fly off; bumpers hang by one bracket; doors
       *    swing open on a bent hinge; trunks pop; glass cracks per pane then bursts;
       *    lamps go dark; flat tyres sit the corner down; wrecks char and glow.
       *  - Decals come from one procedural atlas through two InstancedMeshes: one ring
       *    buffer for the world (wall chips, star-cracked shop glass, scorch, craters,
       *    ground scuffs, oil, puddles) and one rebuilt each frame for marks on vehicles,
       *    anchored where a ray along the bullet's path meets the (crumpled) body.
       *    Thousands of shots only ever overwrite the oldest decal.
       *  - Debris (rubble chunks, torn-off panels) are two small instanced pools with a
       *    little rigid-body motion; knocked street furniture is re-posed in place.
       */
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
        const podium = building.archetype === 'tower' && building.height > 260 ? Math.min(46, building.height * 0.1) : 0;
        if (z < podium) return 11.2;
        if (z < 5 && building.archetype !== 'tower') return 1.95;
        if (building.shopPanes && z < 16.3) return 1.2;
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

      // ---- Vehicle bodies ------------------------------------------------------------------
      // Section table of the saloon shell: x along the length, then width
      // and height factors. The damageable shell is re-sliced much finer from it.
      const SHELL_SECTIONS = [
        [-0.5, 0.82, 0.84],
        [-0.43, 1, 1],
        [-0.21, 1, 1],
        [0.19, 1, 1],
        [0.42, 0.94, 0.88],
        [0.5, 0.78, 0.73],
      ];
      const pristineShells = new Map(),
        pristineCabins = new Map(),
        carGlass = new Three.MeshStandardMaterial({ color: '#182b3c', roughness: 0.12, metalness: 0.65 }),
        crackedGlass = new Three.MeshStandardMaterial({ map: crackedGlassTexture, roughness: 0.32, metalness: 0.45 }),
        // An empty frame: the dark cabin seen through where the glass was.
        brokenGlass = new Three.MeshStandardMaterial({ color: '#0d0f11', roughness: 0.95 }),
        deadLamp = new Three.MeshStandardMaterial({ color: '#2b2824', roughness: 0.45, metalness: 0.35 }),
        burntMetal = new Three.MeshStandardMaterial({ color: '#2c2a27', roughness: 0.95, metalness: 0.25 }),
        engineBay = new Three.MeshStandardMaterial({ color: '#25282a', roughness: 0.6, metalness: 0.5 });
      let damageResourcesClaimed = false;
      // Shared damage resources must survive pruneModels(); register them once.
      function claimDamageResources() {
        if (damageResourcesClaimed) return;
        damageResourcesClaimed = true;
        for (const material of [carGlass, crackedGlass, brokenGlass, deadLamp, burntMetal, engineBay]) sharedMaterials.add(material);
      }
      function shellSection(t) {
        for (let k = 0; k < SHELL_SECTIONS.length - 1; k++) {
          const a = SHELL_SECTIONS[k],
            b = SHELL_SECTIONS[k + 1];
          if (t <= b[0] + 1e-6) {
            const f = (t - a[0]) / (b[0] - a[0]);
            return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
          }
        }
        return SHELL_SECTIONS[SHELL_SECTIONS.length - 1].slice(1);
      }
      // The saloon shell with 23 slices (closer together at the ends, where cars crumple)
      // and 13 points round each, with UVs for the soot map. Shared until dented.
      function carShellGeometry(l, w, h) {
        claimDamageResources();
        const key = l + ':' + w + ':' + h;
        if (pristineShells.has(key)) return pristineShells.get(key);
        const verts = [],
          uvs = [],
          indices = [],
          slices = 23,
          ring = 13;
        for (let i = 0; i < slices; i++) {
          const t = -0.5 * Math.cos((i / (slices - 1)) * Math.PI),
            [ww, hh] = shellSection(t),
            z = (w / 2) * ww,
            top = h * hh,
            mid = (4.8 + top - 1) / 2;
          const points = [
            [3.8, -z * 0.84],
            [4.8, -z],
            [mid, -z],
            [top - 1, -z],
            [top, -z * 0.83],
            [top, -z * 0.42],
            [top, 0],
            [top, z * 0.42],
            [top, z * 0.83],
            [top - 1, z],
            [mid, z],
            [4.8, z],
            [3.8, z * 0.84],
          ];
          points.forEach(([y, zz], j) => {
            verts.push(t * l, y, zz);
            uvs.push(t + 0.5, j / (ring - 1));
          });
        }
        for (let k = 0; k < slices - 1; k++)
          for (let j = 0; j < ring; j++) {
            const a = k * ring + j,
              b = k * ring + ((j + 1) % ring),
              c = (k + 1) * ring + ((j + 1) % ring),
              d = (k + 1) * ring + j;
            indices.push(a, b, d, b, c, d);
          }
        const last = (slices - 1) * ring;
        for (let j = 1; j < ring - 1; j++) {
          indices.push(0, j + 1, j);
          indices.push(last, last + j, last + j + 1);
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        pristineShells.set(key, geo);
        sharedGeometries.add(geo);
        return geo;
      }
      // The glasshouse as five separate panes (left, front, right, rear, roof) in
      // material groups, so each can crack or burst on its own.
      const PANE_ORDER = ['left', 'front', 'right', 'rear', 'roof'];
      function carCabinGeometry(l, w, base, roof, van) {
        const key = [l, w, base, roof, van].join(':');
        if (pristineCabins.has(key)) return pristineCabins.get(key);
        const xb = van ? -0.41 : -0.32,
          xf = 0.27,
          rb = van ? -0.4 : -0.19,
          rf = van ? 0.13 : 0.07,
          wb = w * 0.42,
          wt = w * 0.35,
          corner = [
            [xb * l, base, -wb],
            [xf * l, base, -wb],
            [xf * l, base, wb],
            [xb * l, base, wb],
            [rb * l, roof, -wt],
            [rf * l, roof, -wt],
            [rf * l, roof, wt],
            [rb * l, roof, wt],
          ],
          // Each pane as [bottom 1, bottom 2, top 2, top 1], wound to face outward.
          quads = [
            [0, 1, 5, 4],
            [1, 2, 6, 5],
            [2, 3, 7, 6],
            [3, 0, 4, 7],
            [4, 5, 6, 7],
          ],
          positions = [],
          uvs = [],
          geo = new Three.BufferGeometry();
        quads.forEach(([b1, b2, t2, t1], pane) => {
          const uv = { [b1]: [0, 0], [b2]: [1, 0], [t2]: [1, 1], [t1]: [0, 1] };
          for (const v of [b1, t1, b2, b2, t1, t2]) {
            positions.push(...corner[v]);
            uvs.push(...uv[v]);
          }
          geo.addGroup(pane * 6, 6, pane);
        });
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.computeVertexNormals();
        pristineCabins.set(key, geo);
        sharedGeometries.add(geo);
        return geo;
      }
      // Pushes every vertex along the dents it lies inside: full depth at the centre,
      // easing to nothing at the dent's radius, with a per-vertex wrinkle so the metal
      // folds rather than dishes. `offsetX` is the mesh's place along the body.
      function crumple(geometry, base, dents, offsetX, seed) {
        const position = geometry.attributes.position,
          array = position.array;
        for (let i = 0; i < position.count; i++) {
          const x = base[i * 3] + offsetX,
            y = base[i * 3 + 1],
            z = base[i * 3 + 2],
            wrinkle = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453,
            n = (wrinkle - Math.floor(wrinkle)) * 2 - 1;
          let dx = 0,
            dy = 0,
            dz = 0;
          for (const d of dents) {
            if (d.depth === undefined) continue;
            const ex = x - d.x,
              ey = (y - d.z) * 0.6,
              ez = z - d.y,
              q = (ex * ex + ey * ey + ez * ez) / (d.r * d.r);
            if (q >= 1) continue;
            const f = (1 - q) * (1 - q) * d.depth,
              // Crushed metal has to go somewhere: it bulges out sideways from the push.
              across = ex * -d.ny + ez * d.nx,
              bulge = f * 0.14 * Math.sign(across);
            dx += d.nx * f * (1 + 0.45 * n) - d.ny * bulge;
            dz += d.ny * f * (1 + 0.45 * n) + d.nx * bulge;
            dy += f * (0.32 * n - 0.14);
          }
          array[i * 3] = base[i * 3] + dx;
          array[i * 3 + 1] = base[i * 3 + 1] + dy;
          array[i * 3 + 2] = base[i * 3 + 2] + dz;
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
      }
      // Moves a part into a pivot group at `hinge` so it can swing about that point.
      function hingePart(m, part, hinge) {
        const pivot = new Three.Group();
        pivot.position.copy(hinge);
        part.parent.add(pivot);
        part.position.sub(hinge);
        pivot.add(part);
        return pivot;
      }
      const hingeScratch = new Three.Vector3();
      function carBodyDamage(c, m, damage) {
        const { l, w, h, van } = m.dims,
          parts = damage.parts,
          first = !m.partState,
          before = m.partState || {},
          paintColor = '#' + m.paint.color.getHexString();
        // Crumple the shell and the glasshouse with the same dents.
        const signature = c.dents.reduce((s, d) => s + (d.depth || 0) * 7 + d.x + d.y * 3, c.dents.length);
        if (signature !== m.dentSignature) {
          m.dentSignature = signature;
          if (c.dents.length) {
            if (!m.ownShell) {
              m.shell.geometry = m.shell.geometry.clone();
              m.ownShell = true;
            }
            crumple(m.shell.geometry, m.shellBase, c.dents, 0, c.id);
            if (m.cabinBase) {
              if (!m.ownCabin) {
                m.cabin.geometry = m.cabin.geometry.clone();
                m.ownCabin = true;
              }
              crumple(m.cabin.geometry, m.cabinBase, c.dents, m.cabin.position.x, c.id);
            }
          }
          m.shapeVersion = (m.shapeVersion || 0) + 1;
        }
        const frontDepth = c.dents.reduce((s, d) => (d.x > l * 0.2 && d.depth ? Math.max(s, d.depth) : s), 0);
        // Hood: buckles up in the middle, springs open on its hinge, or is gone.
        if (!m.hoodPivot) m.hoodPivot = hingePart(m, m.hood, hingeScratch.set(l * 0.215, m.hoodBaseY, 0));
        m.hood.visible = parts.hood < 2;
        if (parts.hood === 2 && before.hood !== 2 && !first) spawnPanel(m.hood, paintColor, c, l * 0.25, 0.4, w * 0.67, 1.4);
        m.hoodPivot.position.set(l * 0.215 - frontDepth * 0.12, m.hoodBaseY - frontDepth * 0.08, 0);
        m.hoodPivot.rotation.set(parts.hood === 1 ? 0.07 : 0, 0, parts.hood === 1 ? 0.78 + (c.id % 5) * 0.05 : Math.min(0.32, damage.front * 0.3));
        m.hood.scale.x = l * 0.25 * (1 - clamp(frontDepth / (l * 0.3), 0, 0.45));
        m.hood.position.x = m.hood.scale.x / 2;
        if (parts.hood >= 1 && !m.engine) {
          // The engine bay the hood was covering: block, rocker cover, air box.
          m.engine = new Three.Group();
          m.engine.position.set(l * 0.34, m.hoodBaseY - 0.2, 0);
          m.body.add(m.engine);
          box(m.engine, 0, 0, 0, l * 0.21, 0.9, w * 0.58, engineBay);
          box(m.engine, -l * 0.02, 0.8, 0, l * 0.12, 0.9, w * 0.22, darkMetal);
          mesh(cylinderGeo, darkMetal, m.engine, l * 0.05, 0.9, w * 0.17, 1.6, 0.8, 1.6);
        }
        if (m.engine) m.engine.visible = parts.hood >= 1;
        // Bumpers: pushed in with the crumple, hanging off one bracket, or torn away.
        m.bumpers.forEach((bumper, i) => {
          const state = i ? parts.bumperRear : parts.bumperFront,
            amount = i ? damage.rear : damage.front,
            side = (i ? damage.bumperRearSide : damage.bumperFrontSide) || 1,
            half = bumper.scale.z / 2;
          if (state === 2) {
            if (before[i ? 'bumperRear' : 'bumperFront'] !== 2 && !first)
              spawnPanel(bumper, damage.burnt ? '#2c2a27' : '#b8c0c3', c, bumper.scale.x, bumper.scale.y, bumper.scale.z, 1.2);
            bumper.visible = false;
            return;
          }
          bumper.visible = true;
          bumper.position.copy(m.bumperOrigins[i]);
          bumper.position.x += (i ? 1 : -1) * amount * 2.4;
          bumper.position.y -= amount * 1.1;
          bumper.rotation.set(0, (i ? 1 : -1) * amount * 0.15 * side, 0);
          if (state === 1) {
            // Held by the far bracket: the loose end drops about 25 degrees.
            const drop = 0.44;
            bumper.rotation.x = side * drop;
            bumper.position.y -= half * Math.sin(drop);
            bumper.position.z += side * half * (1 - Math.cos(drop));
          }
          bumper.material = damage.burnt ? burntMetal : chrome;
        });
        // Doors swing out on a bent hinge; torn off, the dark opening is left.
        for (const side of [-1, 1]) {
          const key = side < 0 ? 'doorLeft' : 'doorRight',
            state = parts[key];
          if (!state) continue;
          m.doors = m.doors || {};
          let door = m.doors[side];
          if (!door) {
            const pivot = new Three.Group();
            pivot.position.set(l * 0.2, 0, side * w * 0.5);
            m.body.add(pivot);
            const panel = box(pivot, -l * 0.13, (4.8 + h) / 2 + 0.2, side * 0.25, l * 0.26, h - 4.4, 0.45, m.paint),
              opening = box(m.body, l * 0.07, (4.8 + h) / 2, side * (w * 0.5 + 0.04), l * 0.24, h - 5, 0.3, engineBay);
            door = m.doors[side] = { pivot, panel, opening };
          }
          door.pivot.rotation.set(0, side * (state === 1 ? 0.95 : 0), state === 1 ? -0.09 : 0);
          if (state === 2 && before[key] !== 2 && !first && door.panel.visible)
            spawnPanel(door.panel, paintColor, c, l * 0.26, h - 4.4, 0.45, 1.2);
          door.panel.visible = state < 2;
        }
        // The trunk lid pops up on its hinge (vans and SUVs have tailgates in the body).
        if (parts.trunk && !van && !m.trunk) {
          m.trunk = new Three.Group();
          m.trunk.position.set(-l * 0.3, m.hoodBaseY, 0);
          m.body.add(m.trunk);
          box(m.trunk, -l * 0.09, 0, 0, l * 0.18, 0.4, w * 0.67, m.paint);
        }
        if (m.trunk) m.trunk.rotation.z = parts.trunk ? -0.85 : 0;
        // Glass: one material per pane once any pane is damaged.
        const glass = damage.glass,
          paneMaterial = (state) => (state === 2 ? brokenGlass : state === 1 ? crackedGlass : carGlass);
        if (m.cabinBase) {
          const hurt = damage.burnt || glass.front || glass.rear || glass.left || glass.right;
          if (hurt) {
            m.paneMaterials = m.paneMaterials || [carGlass, carGlass, carGlass, carGlass, carGlass];
            PANE_ORDER.forEach((pane, i) => (m.paneMaterials[i] = paneMaterial(pane === 'roof' ? (damage.burnt ? 2 : 0) : glass[pane])));
            m.cabin.material = m.paneMaterials;
          } else m.cabin.material = carGlass;
        } else m.cabin.material = paneMaterial(glass.front);
        // Wheels: bent inward on a crumpled side; a flat tyre sits down on its rim.
        m.wheels.forEach(({ wheel, side }) => {
          const key = (wheel.position.x > 0 ? 'front' : 'rear') + (side < 0 ? 'Left' : 'Right');
          if (wheel.userData.baseY === undefined) wheel.userData.baseY = wheel.position.y;
          const flat = damage.tires[key],
            burnt = damage.burnt;
          wheel.rotation.x = side * damage[side > 0 ? 'right' : 'left'] * 0.16;
          wheel.scale.y = flat && !burnt ? 0.8 : 1;
          wheel.position.y = wheel.userData.baseY - (burnt ? 1.6 : flat ? 0.8 : 0);
          if (wheel.children[0]) wheel.children[0].visible = !burnt;
        });
        m.partState = { ...parts };
      }
      // Trucks, bikes, tanks and aircraft: no crumple, but tyres, burn and lamps.
      function specialDamage(c, m, damage) {
        if (isAircraft(c) || isBoat(c)) return;
        for (const { wheel, side } of m.wheels || []) {
          if (!wheel.position) continue;
          if (wheel.userData.baseY === undefined) wheel.userData.baseY = wheel.position.y;
          const key = (wheel.position.x > 0 ? 'front' : 'rear') + (side < 0 ? 'Left' : 'Right'),
            flat = damage.tires?.[key];
          wheel.scale.y = flat && !damage.burnt ? 0.82 : 1;
          wheel.position.y = wheel.userData.baseY - (damage.burnt ? 1.6 : flat ? 0.8 : 0);
          if (wheel.children[0] && damage.burnt) wheel.children[0].visible = false;
        }
      }
      // Glass that bursts throws a glitter of crumbs out of the frame.
      function glassBurst(c, m, pane) {
        const { l, w } = m.dims || { l: vehicleSpec(c).l, w: vehicleSpec(c).w },
          local = { front: [l * 0.27, 0], rear: [-l * 0.32, 0], left: [0, -w * 0.45], right: [0, w * 0.45] }[pane] || [0, 0],
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          x = c.x + local[0] * cos - local[1] * sin,
          z = c.y + local[0] * sin + local[1] * cos,
          y = entityElevation(c) + 11;
        for (let j = 0; j < 14; j++)
          fx.push({
            x: x + (Math.random() - 0.5) * 6,
            y,
            z: z + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 70 + (c.vx || 0) * 0.5,
            vy: 20 + Math.random() * 40,
            vz: (Math.random() - 0.5) * 70 + (c.vy || 0) * 0.5,
            life: 0.5 + Math.random() * 0.4,
            max: 0.9,
            color: Math.random() < 0.5 ? '#e4f1f7' : '#9fc4d6',
            size: 1 + Math.random() * 1.2,
            case: true,
          });
      }
      /**
       * Brings a vehicle model in line with its damage data. Runs when the vehicle's
       * damageVersion changes (and once when a model is built for a damaged vehicle).
       */
      function applyVehicleDamage(c, m) {
        const damage = c.damage;
        if (!damage?.parts) return;
        const glassBefore = m.glassState;
        if (m.car) carBodyDamage(c, m, damage);
        else specialDamage(c, m, damage);
        if (glassBefore)
          for (const pane of ['front', 'rear', 'left', 'right'])
            if (damage.glass[pane] === 2 && glassBefore[pane] !== 2) glassBurst(c, m, pane);
        m.glassState = { ...damage.glass };
        // Lamps: a broken one is dark glass, and its night halo stays off.
        for (const lamp of m.lamps || []) lamp.mesh.material = damage.lights[lamp.key] ? deadLamp : lamp.lit;
        if (m.car && m.nightLights)
          m.lampOut = ['headLeft', 'tailLeft', 'headRight', 'tailRight'].map((key) => damage.lights[key]);
        // A burnt shell sits down on its rims (road vehicles only: aircraft bodies are posed).
        if (m.car || vehicleSpec(c).truck) m.body.position.y = damage.burnt ? -1.2 : 0;
        m.shapeVersion = (m.shapeVersion || 0) + 1;
      }
      const grime = new Three.Color('#585451'),
        sootColor = new Three.Color('#1d1a17');
      // Paint dulls with wear, blisters while burning, chars when the fire is out.
      function paintVehicle(c, m) {
        const damage = c.damage,
          burnt = damage?.burnt || c.hp <= 0;
        if (burnt) {
          if (!m.charred) {
            m.charred = true;
            if (m.car) {
              // Soot and blistered paint; the same map masks where embers glow.
              m.paint.map = sootTexture;
              m.paint.emissiveMap = sootTexture;
              m.paint.color.set('#ffffff');
            } else m.paint.color.set('#302c28');
            m.paint.roughness = 0.97;
            m.paint.metalness = 0.12;
            // Burnt paint has no clear coat left (car paint is MeshPhysicalMaterial).
            if (m.paint.isMeshPhysicalMaterial) m.paint.clearcoat = 0;
            m.paint.needsUpdate = true;
          }
          // Embers: the fresh wreck glows through the soot for a few seconds.
          const age = gameTime - (damage?.wreckedAt || c.deadTime || 0),
            glow = clamp(1 - age / 14, 0, 1) * (0.8 + 0.2 * Math.sin(gameTime * 9 + c.id));
          m.paint.emissive.setRGB(0.85 * glow * glow, 0.2 * glow * glow, 0.03 * glow * glow);
          return;
        }
        if (m.charred) {
          m.charred = false;
          m.paint.map = null;
          m.paint.emissiveMap = null;
          m.paint.emissive.setRGB(0, 0, 0);
          m.paint.needsUpdate = true;
          m.paintWear = -1;
        }
        const wear = clamp(1 - c.hp / c.maxhp, 0, 1),
          heat = damage?.burning ? clamp(damage.burning / 8, 0, 0.7) : 0,
          key = wear + heat * 10;
        if (m.paintWear === key) return;
        m.paintWear = key;
        m.paint.color.set(c.color).lerp(grime, wear * 0.22).lerp(sootColor, heat);
        m.paint.roughness = 0.3 + wear * 0.6;
        m.paint.metalness = 0.63 - wear * 0.42;
        // Scuffed and dented panels lose the gloss of their clear coat.
        if (m.paint.isMeshPhysicalMaterial) {
          m.paint.roughness = 0.42 + wear * 0.5;
          m.paint.metalness = 0.55 - wear * 0.35;
          m.paint.clearcoat = 1 - wear * 0.8;
          m.paint.clearcoatRoughness = 0.08 + wear * 0.5;
        }
      }
      // Suspension pose on top of the body's own animation: weight transfer, the blast
      // hop, and the sag toward a flat tyre.
      const pose = { lift: 0, roll: 0, pitch: 0 };
      function vehiclePose(c) {
        const hop = c.hop,
          tires = c.damage?.tires;
        pose.lift = hop ? hop.z : 0;
        pose.roll = (c.loadRoll || 0) + (hop ? hop.roll : 0);
        pose.pitch = (c.loadPitch || 0) + (hop ? hop.pitch : 0);
        if (tires && !c.damage.burnt) {
          const left = (tires.frontLeft ? 1 : 0) + (tires.rearLeft ? 1 : 0),
            right = (tires.frontRight ? 1 : 0) + (tires.rearRight ? 1 : 0),
            front = (tires.frontLeft ? 1 : 0) + (tires.frontRight ? 1 : 0),
            rear = (tires.rearLeft ? 1 : 0) + (tires.rearRight ? 1 : 0);
          // Rolling +x lifts the left side: a flat on the right leans the body right.
          pose.roll += (right - left) * 0.028;
          pose.pitch += (rear - front) * 0.018;
        }
        return pose;
      }

      // ---- Smoke and fire ------------------------------------------------------------------
      let carFlames = null,
        carFlameIndex = 0,
        carFireLightUsed = false;
      const carFireLight = new Three.PointLight('#ff8f3a', 0, 170, 1.6);
      scene.add(carFireLight);
      function flameAt(x, y, z, size, strength) {
        if (!carFlames)
          carFlames = Array.from({ length: 32 }, () => {
            const s = new Three.Sprite(
              new Three.SpriteMaterial({ map: flameTx, transparent: true, depthWrite: false, blending: Three.AdditiveBlending }),
            );
            s.visible = false;
            scene.add(s);
            return s;
          });
        if (carFlameIndex >= carFlames.length) return;
        const s = carFlames[carFlameIndex++];
        s.visible = true;
        s.position.set(x, y + size * 0.35, z);
        s.scale.set(size * 0.62, size, 1);
        s.material.opacity = strength;
      }
      function engineSmoke(x, y, z, color, size, rise) {
        fx.push({
          x: x + (Math.random() - 0.5) * 4,
          y,
          z: z + (Math.random() - 0.5) * 4,
          vx: 4 + (Math.random() - 0.5) * 6,
          vy: rise,
          vz: 2 + (Math.random() - 0.5) * 6,
          life: 2.2,
          max: 2.2,
          color,
          size,
          smoke: true,
        });
      }
      /**
       * Per-frame damage effects for a visible vehicle: grey wisps from a hurt engine,
       * thick black smoke and flames from a burning one, and a wreck that burns out and
       * smoulders for most of a minute.
       */
      function vehicleEffects(c, m, deltaSeconds) {
        const spec = vehicleSpec(c);
        if (deltaSeconds <= 0 || spec.bicycle) return;
        const damage = c.damage,
          health = c.hp / c.maxhp,
          elevation = entityElevation(c) + (c.hop?.z || 0),
          engineX = m.car ? spec.l * 0.33 : spec.truck ? spec.l * 0.3 : 0,
          engineY = elevation + (m.car ? m.dims.h + 1.2 : spec.truck ? 14 : 9),
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          x = c.x + cos * engineX,
          z = c.y + sin * engineX,
          chance = (rate) => Math.random() < 1 - Math.exp(-rate * deltaSeconds);
        if (c.hp <= 0) {
          const age = gameTime - c.deadTime;
          if (age < 12) {
            // The whole shell burns for a while after the tank goes.
            const strength = clamp(1 - age / 12, 0, 1);
            for (let k = 0; k < 3; k++) {
              const along = (k - 1) * spec.l * 0.28;
              flameAt(c.x + cos * along, elevation + 6, c.y + sin * along, (16 + Math.sin(gameTime * 11 + k * 2) * 3) * (0.6 + strength * 0.6), 0.9 * strength);
            }
            if (!carFireLightUsed) {
              carFireLightUsed = true;
              carFireLight.position.set(c.x, elevation + 18, c.y);
              carFireLight.intensity = 620 * strength * (0.85 + 0.15 * Math.sin(gameTime * 17));
            }
          }
          if (age < 55 && chance(age < 12 ? 16 : 6 * (1 - age / 55)))
            engineSmoke(c.x, elevation + 10, c.y, age < 12 ? '#27292c' : '#4a4d52', age < 12 ? 17 : 12, 18);
          return;
        }
        if (damage?.burning) {
          const grow = clamp(damage.burning / 3, 0.35, 1);
          for (let k = 0; k < 2; k++)
            flameAt(
              x + (k - 0.5) * 3 * -sin,
              engineY - 1,
              z + (k - 0.5) * 3 * cos,
              (9 + Math.sin(gameTime * 13 + k * 3) * 2.5) * grow,
              0.95,
            );
          if (!carFireLightUsed) {
            carFireLightUsed = true;
            carFireLight.position.set(x, engineY + 8, z);
            carFireLight.intensity = 380 * grow * (0.85 + 0.15 * Math.sin(gameTime * 19));
          }
          if (chance(14)) engineSmoke(x, engineY + 3, z, '#222427', 14, 22);
          return;
        }
        if (health < 0.6 && chance((0.6 - health) * 22))
          engineSmoke(x, engineY, z, health < 0.4 ? '#55595f' : '#a4a8ad', health < 0.4 ? 11 : 8, health < 0.4 ? 16 : 12);
      }

      // ---- Marks on vehicles ------------------------------------------------------------------
      const markAnchors = new WeakMap(),
        markRay = new Three.Raycaster(),
        markOrigin = new Three.Vector3(),
        markDirection = new Three.Vector3(),
        markInverse = new Three.Matrix4(),
        bodyWorld = new Three.Matrix4(),
        markWorld = new Three.Matrix4();
      function rayTargets(m) {
        const wheelParts = new Set();
        for (const { wheel } of m.wheels || []) wheel?.traverse?.((o) => wheelParts.add(o));
        const list = [];
        m.body.traverse((o) => {
          if (!o.isMesh || o.isInstancedMesh || wheelParts.has(o)) return;
          for (let p = o; p && p !== m.body; p = p.parent) if (!p.visible) return;
          list.push(o);
        });
        return list;
      }
      // Finds where a mark sits on the body: cast along the bullet's line from outside,
      // take the first surface it meets, and keep that pose in body space.
      function anchorMark(c, m, mark) {
        m.group.updateMatrixWorld(true);
        markInverse.copy(m.body.matrixWorld).invert();
        markDirection.set(mark.dx, 0, mark.dy);
        if (markDirection.lengthSq() < 1e-6) markDirection.set(-mark.x, 0, -mark.y);
        markDirection.normalize();
        markOrigin.set(mark.x, mark.z, mark.y).addScaledVector(markDirection, -18).applyMatrix4(m.body.matrixWorld);
        const worldDirection = markDirection.clone().transformDirection(m.body.matrixWorld);
        markRay.set(markOrigin, worldDirection);
        markRay.far = 44;
        if (!m.rayTargets || m.rayTargetsVersion !== m.shapeVersion) {
          m.rayTargets = rayTargets(m);
          m.rayTargetsVersion = m.shapeVersion;
        }
        const hit = markRay.intersectObjects(m.rayTargets, false)[0],
          point = new Three.Vector3(),
          normal = new Three.Vector3();
        if (hit && hit.face) {
          point.copy(hit.point).applyMatrix4(markInverse);
          normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).transformDirection(markInverse);
          if (normal.dot(markDirection) > 0) normal.negate();
        } else {
          point.set(mark.x, mark.z, mark.y);
          normal.copy(markDirection).negate();
        }
        const scrape = mark.kind === 'scrape',
          sx = scrape ? mark.size * 1.8 : mark.kind === 'star' ? mark.size : mark.size * 4.2,
          sy = scrape ? mark.size * 0.45 : sx,
          anchor = {
            matrix: decalPose(new Three.Matrix4(), point.x, point.y, point.z, normal.x, normal.y, normal.z, sx, sy, scrape ? 0 : (mark.id * 2.39996) % TAU, 0.07),
            version: m.shapeVersion,
          };
        markAnchors.set(mark, anchor);
        return anchor;
      }
      const MARK_TILES = { hole: DECAL.hole, star: DECAL.star, scrape: DECAL.scrape };
      function drawVehicleMarks() {
        const layer = vehicleDecals;
        let n = 0,
          budget = 8;
        for (const [c, m] of carModels) {
          const marks = c.damage?.marks;
          if (!marks?.length || !m.group.visible) continue;
          m.group.updateMatrix();
          m.body.updateMatrix();
          bodyWorld.multiplyMatrices(m.group.matrix, m.body.matrix);
          for (const mark of marks) {
            if (n >= layer.capacity) break;
            if (mark.kind === 'star' && c.damage.glass[mark.pane] === 2) continue;
            let anchor = markAnchors.get(mark);
            if (!anchor || anchor.version !== m.shapeVersion) {
              if (budget <= 0 && !anchor) continue;
              if (budget-- > 0) anchor = anchorMark(c, m, mark);
            }
            writeDecal(layer, n++, markWorld.multiplyMatrices(bodyWorld, anchor.matrix), MARK_TILES[mark.kind], mark.kind === 'scrape' ? 0.85 : 1, null);
          }
        }
        layer.mesh.count = n;
        if (n) layer.dirty = true;
      }

      // ---- World hits: walls, shop windows, ground -------------------------------------------
      function shopPaneAt(building, x) {
        return building?.shopPanes?.find((p) => x > p.x0 - 0.5 && x < p.x1 + 0.5) || null;
      }
      function shatterShopPane(pane) {
        if (pane.state === 2) return;
        pane.state = 2;
        addDecal(DECAL.pane, pane.cx, 7, pane.face, 0, 0, 1, pane.width + 0.4, 10.4, 0, 1, null, 0.14);
        addDecal(DECAL.shards, pane.cx, 0.12, pane.face + 7, 0, 1, 0, pane.width * 0.95, 12, Math.random() < 0.5 ? 0 : Math.PI, 0.95);
        for (let j = 0; j < 22; j++)
          fx.push({
            x: pane.cx + (Math.random() - 0.5) * pane.width,
            y: 3 + Math.random() * 8,
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
          repeatY = Math.max(0.5, Math.round(building.height / 18) / 4),
          // The dark pane fills the middle 77% of the decal tile.
          width = ((grid.w / 512 / repeatX) * building.w) / 0.77,
          height = ((grid.h / 512 / repeatY) * building.height) / 0.77,
          lowest = building.shopPanes ? 16.3 : 5;
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
      // How each kind goes over: tip angle, how far it skids, how long the fall takes.
      const PROP_FALLS = {
        lamp: { tip: 1.5, slide: 0.02, time: 0.85, lift: 0.6 },
        signal: { tip: 1.5, slide: 0.02, time: 0.9, lift: 0.6 },
        hydrant: { tip: 1.45, slide: 0.08, time: 0.4, lift: 1.4 },
        trash: { tip: 1.57, slide: 0.3, time: 0.8, lift: 2.4 },
        cone: { tip: 1.57, slide: 0.35, time: 0.9, lift: 1.5 },
        news: { tip: 1.57, slide: 0.18, time: 0.6, lift: 1.5 },
        mailbox: { tip: 1.3, slide: 0.12, time: 0.55, lift: 1.8 },
        meter: { tip: 1.25, slide: 0, time: 0.4, lift: 0.3 },
        bollard: { tip: 1.1, slide: 0, time: 0.35, lift: 0.3 },
        bench: { tip: 1.5, slide: 0.15, time: 0.6, lift: 2 },
        dumpster: { tip: 0.12, slide: 0.25, time: 1, lift: 0, yaw: 0.7 },
        crate: { tip: 0, slide: 0, time: 0.1, lift: 0, shatter: true },
      };
      const propVisuals = new Map(),
        propAxis = new Three.Vector3(),
        propMatrix = new Three.Matrix4(),
        propRotation = new Three.Matrix4(),
        propYaw = new Three.Matrix4(),
        propToPivot = new Three.Matrix4(),
        propFromPivot = new Three.Matrix4(),
        propScratch = new Three.Matrix4();
      function startPropFall(prop) {
        const fall = PROP_FALLS[prop.kind] || PROP_FALLS.trash,
          visual = {
            fall,
            originals: (prop.instances || []).map(({ im, index }) => {
              const m0 = new Three.Matrix4();
              im.getMatrixAt(index, m0);
              return m0;
            }),
            groupPose: prop.group ? { position: prop.group.position.clone(), quaternion: prop.group.quaternion.clone() } : null,
            ground: terrainHeight(prop.x, prop.y),
            slide: Math.min(80, (prop.fallSpeed || 60) * fall.slide),
            puddles: 0,
            done: false,
          };
        if (prop.halo) prop.halo.visible = false;
        if (prop.glow) prop.glow.visible = false;
        // A lamp's pool goes out with it (lighting3d.js).
        lampLightSwitch(prop, false);
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
          lift = fall.lift * Math.sin((tip / Math.max(0.01, fall.tip)) * Math.PI * 0.5);
        // Tip about the base toward the fall direction: axis = up × direction.
        propAxis.set(dz, 0, -dx);
        propRotation.makeRotationAxis(propAxis, tip);
        if (fall.yaw) propRotation.multiply(propYaw.makeRotationY(fall.yaw * t * (prop.id.length % 2 ? 1 : -1)));
        propToPivot.makeTranslation(-prop.x, -visual.ground, -prop.y);
        propFromPivot.makeTranslation(prop.x + dx * slide, visual.ground + lift, prop.y + dz * slide);
        propMatrix.multiplyMatrices(propFromPivot, propRotation).multiply(propToPivot);
        (prop.instances || []).forEach(({ im, index }, i) => {
          if (fall.shatter) propScratch.makeScale(0, 0, 0);
          else propScratch.multiplyMatrices(propMatrix, visual.originals[i]);
          im.setMatrixAt(index, propScratch);
          im.instanceMatrix.needsUpdate = true;
        });
        if (prop.group && visual.groupPose) {
          prop.group.quaternion.setFromAxisAngle(propAxis, tip);
          prop.group.position.set(visual.groupPose.position.x + dx * slide, visual.groupPose.position.y + lift, visual.groupPose.position.z + dz * slide);
        }
        visual.done = t >= 1;
      }
      function restoreProp(prop, visual) {
        (prop.instances || []).forEach(({ im, index }, i) => {
          im.setMatrixAt(index, visual.originals[i]);
          im.instanceMatrix.needsUpdate = true;
        });
        if (prop.group && visual.groupPose) {
          prop.group.position.copy(visual.groupPose.position);
          prop.group.quaternion.copy(visual.groupPose.quaternion);
        }
        if (prop.halo) prop.halo.visible = true;
        if (prop.glow) prop.glow.visible = true;
        lampLightSwitch(prop, true);
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
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        }),
      };
      // END SUBSYSTEM: src/damage3d.js
