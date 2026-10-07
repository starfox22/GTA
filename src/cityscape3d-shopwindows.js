      // Shop windows: a painted atlas of eight shop and lobby interiors, the shared lit shop-window material and its panes.
      /**
       * SHOP WINDOWS
       * A display window is a flat pane that shows a painted interior (aisles, racks,
       * a counter, shelves, a market stall, machines, a pawn counter, a lobby) from one
       * atlas, in one material shared by every shopfront in the city and made like the
       * facades (SHARED FACADES): the glass tint is a vertex colour and the night light
       * the `cityLit` attribute (strength, phase), which the facade shader multiplies by
       * the street power at the fragment, so a blackout puts the shops out with the
       * windows above them and a shop with strength 0 stays dark at night. By day the
       * interior shows dim behind the city glass reflection; after dark it lights up
       * shop by shop. A pane shows a slice of its cell at the window's own aspect, so
       * neighbouring windows of one shop never repeat the same picture. The atlas is
       * painted once with its own seeded random (never cityRandom: the roof plant and the
       * bus stops are drawn from that stream after the buildings).
       */
      const SHOP_INTERIOR = { aisles: 0, racks: 1, cafe: 2, shelves: 3, market: 4, service: 5, goods: 6, lobby: 7 },
        // By day an interior reads darker than the street behind the glass's reflection.
        SHOP_PANE_TINTS = [
          [0.36, 0.39, 0.41],
          [0.41, 0.38, 0.34],
          [0.32, 0.37, 0.4],
        ].map(([r, g, b]) => new Three.Color(r, g, b));
      let shopPaintSeed = 6211;
      const shopPaintRandom = () => {
          shopPaintSeed = (shopPaintSeed * 1664525 + 1013904223) >>> 0;
          return shopPaintSeed / 4294967296;
        },
        shopPaintPick = (list) => list[Math.floor(shopPaintRandom() * list.length)];
      // The business a shop sign names → the interior behind its glass.
      function shopInteriorFor(name) {
        if (/DINER|CAFÉ|PIZZA|NOODLE|BAKERY|DELI/.test(name)) return SHOP_INTERIOR.cafe;
        if (/BOOK|VINYL|VIDEO|PHOTO|ARCADE/.test(name)) return SHOP_INTERIOR.shelves;
        if (/SEAFOOD|FLOWER|BOTÁNICA/.test(name)) return SHOP_INTERIOR.market;
        if (/LAUNDROMAT|BARBER|TATTOO|GYM|DRY CLEANER/.test(name)) return SHOP_INTERIOR.service;
        if (/TAILOR|THRIFT|SHOE/.test(name)) return SHOP_INTERIOR.racks;
        if (/PAWN|HARDWARE|FURNITURE|BAIL|CHECK/.test(name)) return SHOP_INTERIOR.goods;
        return SHOP_INTERIOR.aisles;
      }
      // One 512 x 256 cell: back wall, ceiling lights and floor, then the trade's contents.
      function paintShopInterior(g, kind) {
        const W = 512,
          H = 256,
          R = shopPaintRandom,
          pick = shopPaintPick,
          wall = ['#d8ccb4', '#cdd3cf', '#e0d2bc', '#c4cbc9', '#d6c9b4', '#c8cfc6', '#c9bba6', '#ddd6cb'][kind];
        g.fillStyle = wall;
        g.fillRect(0, 0, W, H);
        // Light from the ceiling: bright near the fittings, falling off down the wall.
        let grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, 'rgba(255,246,222,0.55)');
        grad.addColorStop(0.35, 'rgba(255,240,210,0.1)');
        grad.addColorStop(1, 'rgba(0,0,0,0.35)');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(30,26,22,0.55)';
        g.fillRect(0, 0, W, 22);
        for (let x = 24 + R() * 30; x < W - 40; x += 92 + R() * 20) {
          g.fillStyle = '#fff6dc';
          g.fillRect(x, 7, 50, 7);
          const pool = g.createRadialGradient(x + 25, 16, 2, x + 25, 16, 70);
          pool.addColorStop(0, 'rgba(255,244,214,0.5)');
          pool.addColorStop(1, 'rgba(255,244,214,0)');
          g.fillStyle = pool;
          g.fillRect(x - 50, 0, 150, 90);
        }
        const floor = ['#6a5a4a', '#5d6466', '#7a5f45', '#4f5659', '#6b6152', '#7d7f80', '#5a4a3c', '#b8b2a6'][kind];
        grad = g.createLinearGradient(0, H * 0.8, 0, H);
        grad.addColorStop(0, floor);
        grad.addColorStop(1, '#1d1a17');
        g.fillStyle = grad;
        g.fillRect(0, H * 0.8, W, H * 0.2);
        const goods = ['#c8382e', '#e0a032', '#2f7fb8', '#3b9a55', '#e6dccb', '#8c3fa0', '#f2d23a', '#d8642a', '#1f4f8a', '#b8b8b8'];
        if (kind === SHOP_INTERIOR.aisles) {
          // Shelves of packets and tins, aisle ends running back into the shop.
          for (let row = 0; row < 4; row++) {
            const y = 56 + row * 40;
            for (let x = 4; x < W - 6; ) {
              const w = 5 + R() * 9,
                h = 14 + R() * 18;
              g.fillStyle = pick(goods);
              g.fillRect(x, y + 32 - h, w, h);
              x += w + 1 + (R() < 0.15 ? 4 : 0);
            }
            g.fillStyle = '#e8e4dc';
            g.fillRect(0, y + 32, W, 4);
          }
          for (const x of [130, 300, 450]) {
            g.fillStyle = 'rgba(40,36,32,0.55)';
            g.fillRect(x, 50, 18, 160);
          }
        } else if (kind === SHOP_INTERIOR.racks) {
          // Garments on rails, a mannequin and a counter.
          for (const [x0, x1, y] of [[10, 240, 70], [270, 500, 82]]) {
            g.fillStyle = '#9a9a96';
            g.fillRect(x0, y, x1 - x0, 3);
            for (let x = x0 + 4; x < x1 - 10; x += 11 + R() * 5) {
              g.fillStyle = pick(['#2c3e50', '#8a2c2c', '#d9d0c0', '#4a6a3a', '#2a2a2a', '#c27a3a', '#6a5a8a', '#b0485a']);
              g.fillRect(x, y + 3, 10, 56 + R() * 50);
            }
          }
          g.fillStyle = '#1f1d1b';
          g.beginPath();
          g.arc(250, 70, 11, 0, TAU);
          g.fill();
          g.fillRect(238, 82, 24, 74);
          g.fillRect(242, 156, 6, 50);
          g.fillRect(252, 156, 6, 50);
          g.fillStyle = '#6b4a32';
          g.fillRect(400, 160, 100, 46);
        } else if (kind === SHOP_INTERIOR.cafe) {
          // A menu board, pendant lamps, a counter with stools and bottles behind it.
          g.fillStyle = '#2a2622';
          g.fillRect(60, 40, 170, 70);
          g.fillStyle = 'rgba(240,230,200,0.85)';
          for (let k = 0; k < 6; k++) g.fillRect(72, 50 + k * 10, 60 + R() * 90, 3);
          for (let x = 270; x < 500; x += 18 + R() * 10) {
            g.fillStyle = pick(['#3b6e3a', '#7a3a1e', '#c8a040', '#2f4f6f', '#e8e0d0']);
            g.fillRect(x, 92 - R() * 14, 7, 26);
          }
          g.fillStyle = '#5a3a24';
          g.fillRect(270, 116, 230, 4);
          for (const x of [90, 200, 310, 420]) {
            g.strokeStyle = 'rgba(30,30,30,0.6)';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x, 22);
            g.lineTo(x, 64);
            g.stroke();
            const lamp = g.createRadialGradient(x, 70, 1, x, 70, 26);
            lamp.addColorStop(0, '#fff2c8');
            lamp.addColorStop(0.3, 'rgba(255,214,140,0.8)');
            lamp.addColorStop(1, 'rgba(255,200,120,0)');
            g.fillStyle = lamp;
            g.fillRect(x - 26, 44, 52, 52);
          }
          g.fillStyle = '#7a4e30';
          g.fillRect(0, 150, W, 54);
          g.fillStyle = '#c9b089';
          g.fillRect(0, 146, W, 6);
          for (let x = 40; x < W; x += 70) {
            g.fillStyle = '#b8342c';
            g.beginPath();
            g.ellipse(x, 186, 17, 7, 0, 0, TAU);
            g.fill();
            g.fillStyle = '#9a9a96';
            g.fillRect(x - 2, 192, 4, 26);
          }
        } else if (kind === SHOP_INTERIOR.shelves) {
          // Floor-to-ceiling shelving: book spines, record sleeves, tapes.
          for (let row = 0; row < 5; row++) {
            const y = 30 + row * 34;
            g.fillStyle = '#4a3624';
            g.fillRect(0, y + 30, W, 4);
            for (let x = 2; x < W - 4; ) {
              const w = 3 + R() * 6;
              g.fillStyle = pick(['#7a2a24', '#2a4a6a', '#d8c8a0', '#3a5a3a', '#8a6a2a', '#1f1f24', '#a84a2a', '#e0d8c8', '#5a3a6a']);
              g.fillRect(x, y + 30 - (18 + R() * 11), w, 30);
              x += w + (R() < 0.08 ? 10 : 0.6);
            }
          }
          g.fillStyle = 'rgba(30,24,20,0.5)';
          g.fillRect(236, 30, 14, 176);
        } else if (kind === SHOP_INTERIOR.market) {
          // Tiered stalls of produce, flowers in buckets and crates.
          for (let tier = 0; tier < 3; tier++) {
            const y = 120 + tier * 30;
            g.fillStyle = '#6a4a2a';
            g.fillRect(0, y + 22, W, 8);
            for (let x = 6; x < W - 6; x += 9 + R() * 4) {
              g.fillStyle = pick(['#d8302a', '#f0a020', '#6aa83a', '#f0d040', '#a8283a', '#e86a2a', '#ffffff', '#ff8ac0']);
              g.beginPath();
              g.arc(x, y + 16 - R() * 6, 4 + R() * 3, 0, TAU);
              g.fill();
            }
          }
          for (let x = 20; x < W; x += 96) {
            g.fillStyle = '#2f6a3a';
            g.fillRect(x, 64, 3, 46);
            g.fillRect(x + 8, 70, 3, 40);
            g.fillStyle = pick(['#ff5aa5', '#ffd23f', '#ffffff', '#d8302a']);
            g.beginPath();
            g.arc(x + 5, 64, 13, 0, TAU);
            g.fill();
          }
          g.fillStyle = '#f2ede0';
          for (let x = 30; x < W; x += 60) g.fillRect(x, 196, 14, 8);
        } else if (kind === SHOP_INTERIOR.service) {
          // Machines along the back wall (washers, chairs) under a long mirror.
          g.fillStyle = 'rgba(220,235,240,0.55)';
          g.fillRect(10, 40, W - 20, 52);
          for (let x = 14; x < W - 50; x += 62) {
            g.fillStyle = '#e8e6e0';
            g.fillRect(x, 108, 54, 96);
            g.fillStyle = '#3a4248';
            g.beginPath();
            g.arc(x + 27, 152, 18, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(120,170,200,0.75)';
            g.beginPath();
            g.arc(x + 27, 152, 13, 0, TAU);
            g.fill();
            g.fillStyle = '#9aa0a4';
            g.fillRect(x + 4, 114, 46, 8);
          }
        } else if (kind === SHOP_INTERIOR.goods) {
          // A pegboard wall of guitars, tools and sets above glass counters.
          g.fillStyle = '#b89a72';
          g.fillRect(0, 34, W, 110);
          for (let x = 20; x < W - 30; x += 46 + R() * 20) {
            if (R() < 0.45) {
              g.fillStyle = pick(['#8a3a1e', '#2a2a2a', '#c87a2a', '#6a1e1e']);
              g.beginPath();
              g.ellipse(x + 10, 116, 12, 16, 0, 0, TAU);
              g.fill();
              g.fillRect(x + 8, 46, 4, 60);
            } else {
              g.fillStyle = '#26282c';
              g.fillRect(x, 60 + R() * 20, 34, 26);
              g.fillStyle = 'rgba(110,170,220,0.8)';
              g.fillRect(x + 3, 63 + R() * 20, 28, 18);
            }
          }
          g.fillStyle = 'rgba(190,215,225,0.6)';
          g.fillRect(0, 160, W, 46);
          g.fillStyle = '#3a3532';
          g.fillRect(0, 196, W, 10);
          for (let x = 12; x < W; x += 26) {
            g.fillStyle = pick(['#d8b040', '#c0c0c0', '#a83a3a', '#3a6aa8']);
            g.fillRect(x, 176 + R() * 10, 10, 6);
          }
        } else {
          // A lobby: marble floor, lift doors, a reception desk and a palm.
          g.fillStyle = '#9aa2a8';
          for (const x of [150, 270]) g.fillRect(x, 70, 70, 136);
          g.fillStyle = 'rgba(40,44,48,0.5)';
          for (const x of [184, 304]) g.fillRect(x, 70, 2, 136);
          g.fillStyle = '#ffe8b0';
          for (const x of [180, 300]) g.fillRect(x, 58, 10, 5);
          g.fillStyle = '#3a2a20';
          g.fillRect(360, 150, 130, 56);
          g.fillStyle = '#c8b089';
          g.fillRect(356, 146, 138, 6);
          g.fillStyle = '#3a6a3a';
          g.beginPath();
          g.arc(60, 120, 30, 0, TAU);
          g.fill();
          g.fillStyle = '#6a5a4a';
          g.fillRect(48, 150, 24, 56);
          grad = g.createLinearGradient(0, H * 0.8, 0, H);
          grad.addColorStop(0, 'rgba(255,255,255,0.25)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grad;
          g.fillRect(0, H * 0.8, W, H * 0.2);
        }
        // Depth: the room darkens towards its side walls.
        grad = g.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.35)');
        grad.addColorStop(0.12, 'rgba(0,0,0,0)');
        grad.addColorStop(0.88, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.35)');
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
      }
      const shopInteriorTexture = (() => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 1024;
        const g = cv.getContext('2d');
        for (let k = 0; k < 8; k++) {
          g.save();
          g.translate((k % 2) * 512, Math.floor(k / 2) * 256);
          g.beginPath();
          g.rect(0, 0, 512, 256);
          g.clip();
          paintShopInterior(g, k);
          g.restore();
        }
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        // (Not a baked canvas: the far copy clones this texture, BAKED CANVAS RELEASE.)
        return tx;
      })();
      // Dim by day behind the glass, lit after dark by the facades' night level (updateCityscapeVisuals).
      const shopWindowMaterial = sharedFacade(
        'shopWindow',
        () =>
          new Three.MeshStandardMaterial({
            map: shopInteriorTexture,
            emissive: '#ffe2b4',
            emissiveMap: shopInteriorTexture,
            roughness: 0.12,
            metalness: 0.3,
          }),
      );
      // A pane's geometry: a unit quad showing a slice of interior `cell` at the window's `aspect`
      // (`slice` 0..1 picks which part of the 2:1 cell), tinted and lit like a facade.
      function shopPaneGeometry(cell, aspect, slice, lit, phase, tint) {
        const g = new Three.PlaneGeometry(1, 1),
          uv = g.attributes.uv,
          count = uv.count,
          px = (cell % 2) * 512,
          py = Math.floor(cell / 2) * 256,
          span = Math.min(1, aspect / 2),
          from = (1 - span) * slice,
          colors = new Float32Array(count * 3),
          light = new Float32Array(count * 2),
          c = SHOP_PANE_TINTS[tint % SHOP_PANE_TINTS.length];
        for (let k = 0; k < count; k++) {
          const s = from + uv.getX(k) * span,
            t = 1 - uv.getY(k);
          uv.setXY(k, (px + 4 + s * 504) / 1024, 1 - (py + 4 + t * 248) / 1024);
          colors[k * 3] = c.r;
          colors[k * 3 + 1] = c.g;
          colors[k * 3 + 2] = c.b;
          light[k * 2] = lit;
          light[k * 2 + 1] = phase;
        }
        g.setAttribute('color', new Three.BufferAttribute(colors, 3));
        g.setAttribute('cityLit', new Three.BufferAttribute(light, 2));
        return g;
      }
