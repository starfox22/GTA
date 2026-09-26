      // Fort Sentinel textures and materials: fences, nets, plates, containers (baseTexture, plateMaterial).
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
