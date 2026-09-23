      // BEGIN SUBSYSTEM: src/cityscape3d.js — Building archetypes, roofs, shopfronts and street furniture
      /**
       * Building archetypes, roofs, shopfronts and street furniture
       * Source: src/cityscape3d.js
       * Scope: createCityRenderer() closure.
       * Procedural roof and curtain-wall textures, district-driven facade archetypes,
       * windows that light up at night, ground-floor shops with awnings and signs,
       * instanced rooftop equipment and sidewalk furniture, and the per-frame
       * night-lighting update (updateCityscapeVisuals).
       *
       * DESIGN NOTES
       * The camera looks down at about 40 degrees from the south, so roofs and
       * south-facing facades carry almost all of the visual identity. Every
       * building therefore gets: a roof material chosen by archetype, a parapet,
       * a seeded set of roof props, and (where a street runs along its south
       * face) a shopfront. Repeated small props use InstancedMesh so the whole
       * city costs a handful of draw calls regardless of density.
       */
      let cityscapeSeed = 8191;
      const cityRandom = () => {
          cityscapeSeed = (cityscapeSeed * 1664525 + 1013904223) >>> 0;
          return cityscapeSeed / 4294967296;
        },
        cityPick = (list) => list[Math.floor(cityRandom() * list.length)],
        cityRange = (lo, hi) => lo + cityRandom() * (hi - lo);
      const instanceDummy = new Three.Object3D();
      function instanced(geo, material, capacity) {
        const im = new Three.InstancedMesh(geo, material, capacity);
        im.count = 0;
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false;
        scene.add(im);
        return im;
      }
      function place(im, x, y, z, sx, sy, sz, yaw = 0) {
        if (im.count >= im.instanceMatrix.count) return;
        instanceDummy.position.set(x, y, z);
        instanceDummy.rotation.set(0, yaw, 0);
        instanceDummy.scale.set(sx, sy, sz);
        instanceDummy.updateMatrix();
        im.setMatrixAt(im.count++, instanceDummy.matrix);
      }
      // Knockable sidewalk furniture: the instance is also a street prop (damage.js) that
      // a car can flatten; damage3d.js re-poses it. Pass `prop` to add a part to one.
      function placeProp(kind, im, x, y, z, sx, sy, sz, yaw = 0, prop = null) {
        const index = im.count;
        place(im, x, y, z, sx, sy, sz, yaw);
        if (im.count === index) return prop;
        prop = prop || registerStreetProp(kind, x, z, yaw);
        linkPropInstance(prop, im, index);
        return prop;
      }
      // ---- Procedural roof textures --------------------------------------------------
      function canvasTexture(size, paint, repeatX = 1, repeatY = 1) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        paint(cv.getContext('2d'), size);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.repeat.set(repeatX, repeatY);
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      function speckle(g, size, count, colors, minR = 0.6, maxR = 1.6) {
        for (let i = 0; i < count; i++) {
          g.fillStyle = cityPick(colors);
          g.beginPath();
          g.arc(cityRandom() * size, cityRandom() * size, cityRange(minR, maxR), 0, TAU);
          g.fill();
        }
      }
      const ROOF_TEXTURES = {
        gravel: canvasTexture(256, (g, s) => {
          g.fillStyle = '#8c887f';
          g.fillRect(0, 0, s, s);
          speckle(g, s, 2600, ['#a29d93', '#7a766d', '#b7b2a6', '#6d6a63', '#c2bdb1']);
          g.strokeStyle = '#6a665f';
          g.lineWidth = 2;
          for (const v of [64, 128, 192]) {
            g.beginPath();
            g.moveTo(v, 0);
            g.lineTo(v, s);
            g.stroke();
          }
        }),
        membrane: canvasTexture(256, (g, s) => {
          g.fillStyle = '#b6bab4';
          g.fillRect(0, 0, s, s);
          speckle(g, s, 900, ['#c3c7c1', '#a9ada7', '#bfc3bd'], 0.5, 1.2);
          g.strokeStyle = '#9a9e98';
          g.lineWidth = 2;
          for (let v = 0; v < s; v += 32) {
            g.beginPath();
            g.moveTo(0, v + 1);
            g.lineTo(s, v + 1);
            g.stroke();
          }
          g.fillStyle = '#8f938d';
          for (let i = 0; i < 6; i++) {
            g.beginPath();
            g.ellipse(cityRandom() * s, cityRandom() * s, cityRange(8, 22), cityRange(5, 12), 0, 0, TAU);
            g.fill();
          }
        }),
        tar: canvasTexture(256, (g, s) => {
          g.fillStyle = '#4e5154';
          g.fillRect(0, 0, s, s);
          speckle(g, s, 1400, ['#5a5d60', '#454749', '#63666a'], 0.5, 1.4);
          g.fillStyle = '#5c5f62';
          for (let i = 0; i < 5; i++)
            g.fillRect(cityRandom() * s, cityRandom() * s, cityRange(30, 90), cityRange(20, 60));
          g.strokeStyle = '#3d3f42';
          g.lineWidth = 3;
          for (let v = 0; v < s; v += 64) {
            g.beginPath();
            g.moveTo(v, 0);
            g.lineTo(v, s);
            g.stroke();
          }
        }),
        terracotta: canvasTexture(256, (g, s) => {
          g.fillStyle = '#a95a3f';
          g.fillRect(0, 0, s, s);
          for (let row = 0; row < s; row += 16) {
            const shift = (row / 16) % 2 ? 12 : 0;
            for (let x = -12; x < s + 12; x += 24) {
              g.fillStyle = cityPick(['#b8664a', '#a55538', '#c07152', '#9f5236']);
              g.fillRect(x + shift, row, 23, 15);
              g.fillStyle = '#7d3d2a';
              g.fillRect(x + shift, row + 13, 23, 3);
              g.fillStyle = '#d08a6c55';
              g.fillRect(x + shift + 2, row + 1, 19, 3);
            }
          }
        }),
        pavers: canvasTexture(256, (g, s) => {
          g.fillStyle = '#c6c2b6';
          g.fillRect(0, 0, s, s);
          speckle(g, s, 900, ['#d1cdc1', '#b8b4a8', '#cbc7bb'], 0.5, 1.2);
          g.strokeStyle = '#a19d92';
          g.lineWidth = 2;
          for (let v = 0; v < s; v += 32) {
            g.beginPath();
            g.moveTo(v, 0);
            g.lineTo(v, s);
            g.moveTo(0, v);
            g.lineTo(s, v);
            g.stroke();
          }
        }),
        green: canvasTexture(256, (g, s) => {
          g.fillStyle = '#5f7f4a';
          g.fillRect(0, 0, s, s);
          speckle(g, s, 3200, ['#6a8d52', '#4f6f3f', '#7a9a5c', '#587a45'], 0.8, 2.2);
          g.fillStyle = '#b9b09a';
          g.fillRect(0, s / 2 - 10, s, 20);
        }),
        metal: canvasTexture(256, (g, s) => {
          g.fillStyle = '#7d8a91';
          g.fillRect(0, 0, s, s);
          for (let x = 0; x < s; x += 8) {
            g.fillStyle = x % 16 ? '#88959c' : '#6f7c83';
            g.fillRect(x, 0, 4, s);
          }
          speckle(g, s, 500, ['#9c6c4f66', '#6b747a66'], 1, 3);
        }),
      };
      // ---- Window masks that glow at night -----------------------------------------
      // Window centres per facade atlas quadrant, in 512-pixel tile coordinates.
      const WINDOW_GRIDS = [
        { cols: [75, 200, 315, 435], rows: [85, 240, 395], w: 60, h: 112 },
        { cols: [94, 210, 325, 440], rows: [88, 240, 393], w: 66, h: 110 },
        null,
        { cols: [80, 197, 315, 433], rows: [95, 250, 408], w: 58, h: 100 },
      ];
      function windowMask(grid, litChance) {
        return canvasTexture(256, (g, s) => {
          g.fillStyle = '#000';
          g.fillRect(0, 0, s, s);
          for (const cx of grid.cols)
            for (const cy of grid.rows) {
              if (cityRandom() > litChance) continue;
              const x = ((cx - grid.w / 2) / 512) * s,
                y = ((cy - grid.h / 2) / 512) * s,
                w = (grid.w / 512) * s,
                h = (grid.h / 512) * s,
                warm = cityRandom() > 0.2,
                grad = g.createLinearGradient(x, y, x, y + h);
              grad.addColorStop(0, warm ? '#fff1cc' : '#dbe9ff');
              grad.addColorStop(1, warm ? '#f2c98a' : '#a8c3ea');
              g.fillStyle = grad;
              g.globalAlpha = cityRange(0.55, 1);
              g.fillRect(x, y, w, h);
              if (cityRandom() > 0.5) {
                g.fillStyle = '#00000088';
                g.fillRect(x, y, w, h * cityRange(0.2, 0.45));
              }
              g.globalAlpha = 1;
            }
        });
      }
      const windowMasks = WINDOW_GRIDS.map((grid) =>
        grid ? Array.from({ length: 6 }, (_, k) => windowMask(grid, 0.32 + k * 0.08)) : null,
      );
      // Curtain wall tile for glass towers: panes, mullions and a lit variant.
      function curtainWall(tint, lit) {
        return canvasTexture(256, (g, s) => {
          g.fillStyle = lit ? '#000' : '#2b3b4a';
          g.fillRect(0, 0, s, s);
          const cols = 4,
            rows = 4,
            pw = s / cols,
            ph = s / rows;
          for (let c = 0; c < cols; c++)
            for (let r = 0; r < rows; r++) {
              const x = c * pw + 3,
                y = r * ph + 3;
              if (lit) {
                if (cityRandom() < 0.42) {
                  g.fillStyle = cityRandom() > 0.3 ? '#ffe8bf' : '#cfe1ff';
                  g.globalAlpha = cityRange(0.5, 1);
                  g.fillRect(x + 2, y + 2, pw - 10, ph - 10);
                  g.globalAlpha = 1;
                }
              } else {
                const grad = g.createLinearGradient(x, y, x, y + ph);
                grad.addColorStop(0, tint[0]);
                grad.addColorStop(1, tint[1]);
                g.fillStyle = grad;
                g.fillRect(x, y, pw - 6, ph - 6);
                g.fillStyle = '#ffffff22';
                g.fillRect(x, y, pw - 6, 3);
              }
            }
          if (!lit) {
            g.fillStyle = '#d8dee3';
            for (let c = 0; c <= cols; c++) g.fillRect(c * pw - 1, 0, 2, s);
            for (let r = 0; r <= rows; r++) g.fillRect(0, r * ph - 1, s, 2);
          }
        });
      }
      const CURTAIN_TINTS = [
        ['#5d86a8', '#2f4d66'],
        ['#6aa39a', '#2c5a57'],
        ['#8d8ba3', '#45445e'],
        ['#a5875f', '#5b4630'],
        ['#7a94b3', '#3b4d63'],
      ];
      const curtainWalls = CURTAIN_TINTS.map((tint) => ({
        map: curtainWall(tint, false),
        lit: curtainWall(tint, true),
      }));
      // ---- Shared sign atlases (shops, hotels, billboards) --------------------------
      const SHOP_NAMES = [
        'LAUNDROMAT',
        'PAWN & LOAN',
        'ROSIE’S DINER',
        'BODEGA 24H',
        'VINYL VAULT',
        'INK & IRON TATTOO',
        'CUTS BARBER',
        'GOLDEN NOODLE',
        'LIQUOR',
        'SLICE PIZZA',
        'CORNER PHARMACY',
        'BAIL BONDS',
        'VIDEO WORLD',
        'CAFÉ MARLOW',
        'DRY CLEANER',
        'HARDWARE',
        'CHECK CASHING',
        'BAKERY',
        'DELI',
        'FLOWERS',
        'TAILOR',
        'ARCADE',
        'THRIFT',
        'BOOKS',
        'BOTÁNICA',
        'SEAFOOD MARKET',
        'CIGARS',
        'PAWN SHOP',
        'FURNITURE',
        'GYM',
        'SHOE REPAIR',
        'PHOTO 1HR',
      ];
      const HOTEL_NAMES = [
        'THE FLAMINGO',
        'SEABREEZE',
        'CASA MARINA',
        'THE CARLYLE',
        'BEACON HOTEL',
        'AVALON',
        'TIDES INN',
        'LA PLAYA',
        'STARLITE',
        'PALM COURT',
        'EL DORADO',
        'BREAKWATER',
      ];
      const AD_LINES = [
        ['DRINK KOLA', 'ICE COLD · SINCE 1921', '#d94b3d', '#fff2df'],
        ['NEON 88.7', 'THE SOUND OF THE COAST', '#2a3f6a', '#8ff0ff'],
        ['GOLDEN TIDE CASINO', 'FORTUNE FAVORS THE BOLD', '#3b2a1c', '#f5d27a'],
        ['SUNSET MOTEL', 'VACANCY · HBO · POOL', '#1f5f63', '#c9f5f0'],
        ['RIOT 104.5', 'LOUD. ALL NIGHT.', '#1c1c1f', '#ff6f4e'],
        ['SOUTHPORT AIR', 'FLY THE KEYS DAILY', '#dfe7ea', '#1f3c52'],
        ['PALM AUTO PAINT', 'RESPRAYS WHILE YOU WAIT', '#f0a7b8', '#2c1e2a'],
        ['MARLOW BAY FERRIES', 'NO LAST FERRY TONIGHT', '#22415a', '#e6e0c8'],
      ];
      function textAtlas(entries, cellW, cellH, paintCell) {
        const cols = Math.ceil(Math.sqrt(entries.length)),
          rows = Math.ceil(entries.length / cols),
          cv = document.createElement('canvas');
        cv.width = cols * cellW;
        cv.height = rows * cellH;
        const g = cv.getContext('2d');
        entries.forEach((entry, i) => {
          g.save();
          g.translate((i % cols) * cellW, Math.floor(i / cols) * cellH);
          paintCell(g, entry, cellW, cellH, i);
          g.restore();
        });
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.minFilter = Three.LinearMipmapLinearFilter;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return {
          tx,
          cols,
          rows,
          cell(i) {
            const t = tx.clone();
            t.repeat.set(1 / cols, 1 / rows);
            t.offset.set((i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows);
            t.needsUpdate = true;
            return t;
          },
        };
      }
      const SHOP_COLORS = ['#c7463a', '#2f6b5e', '#213a63', '#c99a2e', '#6c3b73', '#1f1f24', '#a5552b'];
      const shopAtlas = textAtlas(SHOP_NAMES, 256, 64, (g, name, w, h, i) => {
        g.fillStyle = SHOP_COLORS[i % SHOP_COLORS.length];
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#00000033';
        g.fillRect(0, h - 8, w, 8);
        g.fillStyle = i % 3 ? '#f4ead6' : '#ffd479';
        g.font = '700 ' + (name.length > 12 ? 24 : 30) + 'px Arial';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(name, w / 2, h / 2 - 2, w - 16);
      });
      const hotelAtlas = textAtlas(HOTEL_NAMES, 512, 96, (g, name, w, h, i) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = ['#ff7fb0', '#7fe9ff', '#ffe27a', '#b7ff9a'][i % 4];
        g.font = 'italic 700 62px Arial';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = g.fillStyle;
        g.shadowBlur = 18;
        g.fillText(name, w / 2, h / 2, w - 24);
      });
      const adAtlas = textAtlas(AD_LINES, 512, 160, (g, [title, sub, bg, fg], w, h) => {
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
        g.fillStyle = fg;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '800 54px Arial';
        g.fillText(title, w / 2, h / 2 - 22, w - 30);
        g.font = '500 24px Arial';
        g.globalAlpha = 0.85;
        g.fillText(sub, w / 2, h / 2 + 38, w - 30);
      });
      // ---- Instanced prop pools -----------------------------------------------------
      const propMats = {
        acUnit: mat('#9aa3a6', 0.55, 0.45),
        acFan: mat('#3d4447', 0.7, 0.5),
        vent: mat('#4e5558', 0.6, 0.6),
        skylight: new Three.MeshStandardMaterial({ color: '#86a9bd', roughness: 0.18, metalness: 0.6 }),
        dish: mat('#d5d8d6', 0.5, 0.3),
        planter: mat('#8e5a44', 0.85),
        shrub: leafMats[1],
        solar: new Three.MeshStandardMaterial({ color: '#1d2f57', roughness: 0.2, metalness: 0.7 }),
        hatch: mat('#4b4f52', 0.7, 0.4),
        chimney: mat('#7d5245', 0.9),
        pipe: mat('#8a8f92', 0.5, 0.6),
        hydrant: mat('#c23b2e', 0.55, 0.3),
        trash: mat('#3f5a4a', 0.7, 0.3),
        benchSeat: mat('#7a5a3c', 0.85),
        benchLeg: darkMetal,
        mailbox: mat('#2c4d8a', 0.5, 0.4),
        newsRed: mat('#b8392f', 0.5, 0.3),
        newsYellow: mat('#d6a72a', 0.5, 0.3),
        newsBlue: mat('#2f5f9a', 0.5, 0.3),
        bollard: mat('#3a3f44', 0.6, 0.5),
        meter: mat('#7b8489', 0.5, 0.6),
        coneOrange: mat('#e0742a', 0.6),
        crate: mat('#8b6a44', 0.9),
        dumpster: mat('#3d6b4a', 0.7, 0.3),
        tank: mat('#b7bfc3', 0.45, 0.5),
      };
      const pools = {
        acUnit: instanced(boxGeo, propMats.acUnit, 3200),
        acFan: instanced(cylinderGeo, propMats.acFan, 3200),
        vent: instanced(cylinderGeo, propMats.vent, 2600),
        skylight: instanced(boxGeo, propMats.skylight, 1800),
        dish: instanced(sphereGeo, propMats.dish, 800),
        planter: instanced(boxGeo, propMats.planter, 900),
        shrub: instanced(sphereGeo, propMats.shrub, 900),
        solar: instanced(boxGeo, propMats.solar, 1600),
        hatch: instanced(boxGeo, propMats.hatch, 700),
        chimney: instanced(boxGeo, propMats.chimney, 700),
        pipe: instanced(cylinderGeo, propMats.pipe, 1400),
        tank: instanced(cylinderGeo, propMats.tank, 400),
        hydrant: instanced(cylinderGeo, propMats.hydrant, 500),
        trash: instanced(cylinderGeo, propMats.trash, 900),
        benchSeat: instanced(boxGeo, propMats.benchSeat, 700),
        benchLeg: instanced(boxGeo, propMats.benchLeg, 1400),
        mailbox: instanced(boxGeo, propMats.mailbox, 400),
        newsRed: instanced(boxGeo, propMats.newsRed, 300),
        newsYellow: instanced(boxGeo, propMats.newsYellow, 300),
        newsBlue: instanced(boxGeo, propMats.newsBlue, 300),
        bollard: instanced(cylinderGeo, propMats.bollard, 900),
        meter: instanced(boxGeo, propMats.meter, 900),
        cone: instanced(new Three.ConeGeometry(1, 1, 8), propMats.coneOrange, 200),
        crate: instanced(boxGeo, propMats.crate, 500),
        dumpster: instanced(boxGeo, propMats.dumpster, 400),
      };
      // ---- Archetype selection ------------------------------------------------------
      function archetypeFor(b) {
        if (b.roofBar) return 'hotel';
        if (b.style === 2) return 'warehouse';
        if (b.tropical) return b.height >= 60 ? 'decoTower' : 'deco';
        const district = districtAt(b.x + b.w / 2, b.y + b.h / 2);
        if (b.height >= 100) return 'tower';
        if (b.height >= 68) return district.includes('FINANCIAL') ? 'tower' : 'office';
        if (district.includes('OLD QUARTER') || district.includes('IRONWORKS')) return b.style === 1 ? 'stucco' : 'brick';
        if (district === 'MIDTOWN' || district === 'BROADWAY') return cityRandom() < 0.55 ? 'brick' : 'office';
        return cityRandom() < 0.5 ? 'brick' : 'stucco';
      }
      const FACADE_TINTS = {
        brick: ['#bfb3a7', '#cdbcab', '#b1a397', '#c9b7a0', '#d2c1b0'],
        office: ['#cfccc4', '#c0c5ca', '#d6cfbe', '#c9c3b7'],
        stucco: ['#e7c8b5', '#badcd5', '#ddd7c3', '#c4d0e5', '#e3d3a9', '#d9b6c3', '#f1e0c8'],
        warehouse: ['#9fb0bb', '#b1a89b', '#8f9aa3', '#a89e8f'],
      };
      const ROOF_FOR = {
        tower: ['membrane', 'pavers', 'membrane'],
        office: ['gravel', 'membrane', 'gravel', 'tar'],
        brick: ['tar', 'gravel', 'terracotta', 'tar', 'gravel'],
        stucco: ['terracotta', 'tar', 'terracotta', 'gravel'],
        warehouse: ['metal', 'metal', 'tar'],
        deco: ['pavers', 'terracotta', 'membrane'],
        decoTower: ['pavers', 'membrane'],
        hotel: ['pavers'],
      };
      const litWindowMaterials = [],
        neonSigns = [],
        shopGlassMaterial = new Three.MeshStandardMaterial({
          color: '#1a2a33',
          roughness: 0.15,
          metalness: 0.6,
          emissive: '#ffd6a0',
          emissiveIntensity: 0,
        }),
        beaconMaterial = new Three.MeshBasicMaterial({ color: '#ff3b2f' }),
        beacons = [],
        awningMaterials = ['#b7413a', '#2d6a5e', '#26426d', '#c99a2e', '#6d3f76', '#d86d4a'].map((c) =>
          mat(c, 0.9),
        ),
        awningStripe = mat('#efe6d3', 0.9);
      function facadeMaterial(kind, index, b) {
        if (kind === 'tower' || kind === 'decoTower') {
          const wall = curtainWalls[index % curtainWalls.length],
            map = wall.map.clone(),
            lit = wall.lit.clone(),
            repeatX = Math.max(1, Math.round(b.w / 36)),
            repeatY = Math.max(1, Math.round(b.height / 34));
          map.repeat.set(repeatX, repeatY);
          lit.repeat.set(repeatX, repeatY);
          map.needsUpdate = lit.needsUpdate = true;
          const material = new Three.MeshStandardMaterial({
            map,
            color: kind === 'decoTower' ? '#e9dccb' : '#cfd6dc',
            roughness: 0.25,
            metalness: 0.55,
            emissive: '#ffe6bf',
            emissiveMap: lit,
            emissiveIntensity: 0,
          });
          litWindowMaterials.push({ material, strength: cityRange(0.7, 1.1), phase: cityRandom() * 9, x: b.x, y: b.y });
          return material;
        }
        const quadrant = kind === 'brick' ? 0 : kind === 'office' ? 1 : kind === 'warehouse' ? 2 : 3,
          wall = wallTextures[quadrant].clone(),
          repeatX = Math.max(1, Math.round(b.w / 34) / 4),
          repeatY = Math.max(0.5, Math.round(b.height / 18) / 4);
        wall.repeat.set(repeatX, repeatY);
        wall.needsUpdate = true;
        const tints = FACADE_TINTS[kind === 'deco' ? 'stucco' : kind] || FACADE_TINTS.stucco,
          material = new Three.MeshStandardMaterial({
            map: wall,
            color: tints[index % tints.length],
            roughness: kind === 'warehouse' ? 0.6 : 0.9,
            metalness: kind === 'warehouse' ? 0.35 : 0,
          });
        if (windowMasks[quadrant]) {
          const lit = cityPick(windowMasks[quadrant]).clone();
          lit.repeat.set(repeatX, repeatY);
          lit.needsUpdate = true;
          material.emissive = new Three.Color('#ffd9a6');
          material.emissiveMap = lit;
          material.emissiveIntensity = 0;
          litWindowMaterials.push({ material, strength: cityRange(0.6, 1.0), phase: cityRandom() * 9, x: b.x, y: b.y });
        }
        return material;
      }
      function roofMaterial(kind) {
        const name = cityPick(ROOF_FOR[kind] || ROOF_FOR.brick),
          tx = ROOF_TEXTURES[name].clone();
        tx.needsUpdate = true;
        return {
          name,
          material: new Three.MeshStandardMaterial({
            map: tx,
            roughness: name === 'metal' ? 0.45 : 0.92,
            metalness: name === 'metal' ? 0.5 : 0.02,
          }),
        };
      }
      // ---- Roof props ----------------------------------------------------------------
      function acCluster(gx, top, gz, count) {
        for (let j = 0; j < count; j++) {
          const x = gx + j * 21,
            z = gz + (j % 2) * 6;
          place(pools.acUnit, x, top + 4.5, z, 17, 9, 14);
          place(pools.acFan, x, top + 9.3, z, 5.5, 0.6, 5.5);
          place(pools.pipe, x + 9, top + 2.5, z, 0.7, 5, 0.7);
        }
      }
      function waterTower(group, x, top, z) {
        const legs = [-6, 6];
        for (const dx of legs) for (const dz of legs) box(group, x + dx, top + 8, z + dz, 1, 16, 1, darkMetal);
        box(group, x, top + 9, z, 15, 0.8, 15, darkMetal);
        mesh(new Three.CylinderGeometry(9.5, 9.5, 17, 16), wood, group, x, top + 25, z);
        mesh(new Three.ConeGeometry(11, 5.5, 16), darkMetal, group, x, top + 36, z);
        for (const y of [19, 26, 32]) box(group, x, top + y, z, 0.6, 0.6, 20.2, darkMetal);
      }
      function bulkhead(group, x, top, z, w = 18, d = 14, h = 11, material = concrete) {
        box(group, x, top + h / 2, z, w, h, d, material);
        box(group, x, top + h + 0.6, z, w + 1.5, 1.2, d + 1.5, darkMetal);
        box(group, x, top + h * 0.45, z + d / 2 + 0.3, 5, h * 0.8, 0.5, mat('#3a4247'));
      }
      function billboard(group, x, top, z, width, faceSouth = true) {
        const height = width * 0.3125,
          plane = new Three.Mesh(
            new Three.PlaneGeometry(width, height),
            new Three.MeshBasicMaterial({
              map: adAtlas.cell(Math.floor(cityRandom() * AD_LINES.length)),
              toneMapped: false,
              side: Three.DoubleSide,
            }),
          );
        plane.position.set(x, top + 9 + height / 2, z + (faceSouth ? 0.7 : -0.7));
        if (!faceSouth) plane.rotation.y = Math.PI;
        group.add(plane);
        box(group, x, top + 9 + height / 2, z, width + 2, height + 2, 1, darkMetal);
        for (const dx of [-width * 0.35, width * 0.35]) box(group, x + dx, top + 4.5, z, 0.8, 9, 0.8, darkMetal);
        for (const dx of [-width * 0.3, 0, width * 0.3]) {
          box(group, x + dx, top + 9 + height + 2.5, z + 3, 1, 1, 6, darkMetal);
          neonSigns.push({ sprite: halo(group, x + dx, top + 9 + height + 1, z + 4, 12, '#ffe7c2'), base: 0.8 });
        }
      }
      function helipad(group, x, top, z) {
        mesh(new Three.CylinderGeometry(22, 22, 0.6, 32), mat('#3f464b', 0.85), group, x, top + 0.3, z);
        const ring = new Three.Mesh(
          new Three.RingGeometry(17, 19, 40),
          new Three.MeshBasicMaterial({ color: '#f1e3ad', side: Three.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, top + 0.7, z);
        group.add(ring);
        const h = new Three.MeshBasicMaterial({ color: '#f1e3ad' });
        box(group, x - 6, top + 0.7, z, 2.5, 0.1, 18, h);
        box(group, x + 6, top + 0.7, z, 2.5, 0.1, 18, h);
        box(group, x, top + 0.7, z, 12, 0.1, 2.5, h);
        for (let k = 0; k < 8; k++) {
          const a = (k * TAU) / 8;
          neonSigns.push({
            sprite: halo(group, x + Math.cos(a) * 21, top + 1.5, z + Math.sin(a) * 21, 6, '#a9f5c2'),
            base: 0.9,
          });
        }
      }
      function pergola(group, x, top, z, w, d) {
        for (const dx of [-w / 2, w / 2])
          for (const dz of [-d / 2, d / 2]) box(group, x + dx, top + 5.5, z + dz, 1, 11, 1, wood);
        for (let k = -w / 2; k <= w / 2; k += 4) box(group, x + k, top + 11, z, 0.8, 0.8, d + 2, wood);
        box(group, x, top + 10.2, z + d / 2, w + 2, 0.8, 0.8, wood);
        box(group, x, top + 10.2, z - d / 2, w + 2, 0.8, 0.8, wood);
        // Instanced props live in world space; the pergola is placed in group-local space.
        const wx = group.position.x,
          wz = group.position.z,
          wy = group.position.y;
        for (let k = -w / 2 + 6; k < w / 2; k += 12) {
          place(pools.planter, wx + x + k, wy + top + 1.5, wz + z + d / 2 + 5, 8, 3, 5);
          place(pools.shrub, wx + x + k, wy + top + 5, wz + z + d / 2 + 5, 4, 3, 3);
        }
        neonSigns.push({ sprite: halo(group, x, top + 9.5, z, 26, '#ffd9a0'), base: 0.7 });
      }
      function sawtoothRoof(group, b, top) {
        const rows = Math.max(1, Math.floor(b.h / 34));
        for (let r = 0; r < rows; r++) {
          const z = 17 + r * 34;
          box(group, b.w / 2, top + 4, z + 6, b.w - 14, 8, 14, mat('#6f7c83', 0.55, 0.4));
          place(pools.skylight, b.x + b.w / 2, top + 5.5, b.y + z - 4, b.w - 18, 7, 1.2);
        }
        for (let k = 0; k < Math.floor(b.w / 60); k++) {
          const x = 30 + k * 60;
          place(pools.vent, b.x + x, top + 6, b.y + b.h - 12, 3, 12, 3);
          place(pools.vent, b.x + x, top + 12.8, b.y + b.h - 12, 4.5, 1.6, 4.5);
        }
      }
      function decorateRoof(kind, b, group, i) {
        const top = b.height,
          gx = b.x,
          gz = b.y;
        if (kind === 'hotel') return;
        if (kind === 'warehouse') {
          sawtoothRoof(group, b, top);
          if (cityRandom() < 0.6) {
            place(pools.chimney, gx + b.w - 18, top + 12, gz + 18, 8, 24, 8);
            place(pools.vent, gx + b.w - 18, top + 25, gz + 18, 2.2, 3, 2.2);
          }
          place(pools.tank, gx + 22, top + 7, gz + b.h - 24, 9, 14, 9);
          return;
        }
        // Access bulkhead on almost every roof.
        if (cityRandom() < 0.85) bulkhead(group, 20 + cityRandom() * 12, top, 16 + cityRandom() * 10);
        if (kind === 'tower') {
          // Plant sits on the finished crown, not buried inside the setbacks.
          const crownTop = top + (b.crownHeight || 0);
          bulkhead(group, b.w / 2, crownTop, b.h / 2, b.w * 0.3, b.h * 0.28, 14 + (i % 3) * 5, mat('#8c949a', 0.6, 0.3));
          const penthouseTop = crownTop + 14 + (i % 3) * 5;
          acCluster(gx + b.w * 0.2, penthouseTop, gz + b.h * 0.25, Math.max(1, Math.floor(b.w / 95)));
          box(group, b.w / 2, penthouseTop + 12, b.h / 2, 1.2, 24, 1.2, darkMetal);
          const beacon = mesh(sphereGeo, beaconMaterial, group, b.w / 2, penthouseTop + 25, b.h / 2, 1.6, 1.6, 1.6);
          beacons.push(beacon);
          neonSigns.push({ sprite: halo(group, b.w / 2, penthouseTop + 25, b.h / 2, 16, '#ff6a5c'), base: 1, beacon: true });
          // The pad goes on the terrace the setback leaves, never inside it.
          const terrace = Math.max(0, Math.min(b.w, b.h) * 0.11 - 6);
          if (b.height >= 150 && terrace > 20) helipad(group, b.w - terrace, top, b.h - terrace);
          else if (cityRandom() < 0.5) {
            for (let k = 0; k < 3; k++) place(pools.solar, gx + b.w - 12 - k * 11, top + 2.5, gz + b.h - 12, 9, 0.6, 16, 0.3);
          }
          for (const dx of [7, b.w - 7]) for (const dz of [7, b.h - 7]) place(pools.vent, gx + dx, top + 3, gz + dz, 1.6, 6, 1.6);
          return;
        }
        if (kind === 'office') {
          acCluster(gx + 24, top, gz + b.h - 34, Math.max(2, Math.floor(b.w / 70)));
          if (!b.place && cityRandom() < 0.5) billboard(group, b.w / 2, top, b.h - 4, Math.min(120, b.w * 0.6));
          if (cityRandom() < 0.5) place(pools.dish, gx + b.w - 20, top + 6, gz + 22, 6, 3, 6);
          for (let k = 0; k < Math.floor(b.w / 45); k++) place(pools.hatch, gx + 14 + k * 45, top + 0.6, gz + b.h / 2, 6, 1.2, 6);
          if (cityRandom() < 0.4)
            for (let k = 0; k < 4; k++) place(pools.solar, gx + 40 + k * 15, top + 2.2, gz + 30, 13, 0.6, 20, 0.28);
          return;
        }
        if (kind === 'brick' || kind === 'stucco') {
          if (cityRandom() < (kind === 'brick' ? 0.42 : 0.2)) waterTower(group, b.w - 32, top, b.h - 30);
          if (cityRandom() < 0.6) place(pools.chimney, gx + 14 + cityRandom() * (b.w - 28), top + 5, gz + 12 + cityRandom() * (b.h - 24), 5, 10, 5);
          if (cityRandom() < 0.45) acCluster(gx + b.w * 0.3, top, gz + b.h * 0.55, 1 + Math.floor(cityRandom() * 2));
          if (cityRandom() < 0.35) place(pools.skylight, gx + b.w * 0.55, top + 2.5, gz + b.h * 0.3, 16, 5, 10);
          if (cityRandom() < 0.18) pergola(group, b.w * 0.5, top, b.h * 0.55, Math.min(50, b.w * 0.4), 22);
          if (cityRandom() < 0.3) place(pools.dish, gx + b.w - 18, top + 4, gz + b.h - 20, 4.5, 2.2, 4.5);
          if (cityRandom() < 0.3) {
            for (let k = 0; k < 3; k++) {
              place(pools.planter, gx + 30 + k * 16, top + 1.5, gz + 10, 9, 3, 6);
              place(pools.shrub, gx + 30 + k * 16, top + 5, gz + 10, 4, 3.2, 3);
            }
          }
          for (let k = 0; k < 2 + Math.floor(cityRandom() * 3); k++)
            place(pools.vent, gx + 10 + cityRandom() * (b.w - 20), top + 2.5, gz + 10 + cityRandom() * (b.h - 20), 1.4, 5, 1.4);
          if (!b.place && cityRandom() < 0.25 && b.w > 150) billboard(group, b.w / 2, top, b.h - 4, Math.min(90, b.w * 0.5));
          return;
        }
        if (kind === 'deco' || kind === 'decoTower') {
          const wide = b.w > 200;
          if (cityRandom() < 0.7) pergola(group, wide ? b.w * 0.3 : b.w / 2, top, b.h * 0.5, Math.min(46, b.w * 0.35), 20);
          if (cityRandom() < 0.5) acCluster(gx + b.w - 60, top, gz + 22, 1 + Math.floor(cityRandom() * 2));
          const sign = new Three.Mesh(
            new Three.PlaneGeometry(Math.min(110, b.w * 0.7), Math.min(110, b.w * 0.7) * 0.1875),
            new Three.MeshBasicMaterial({
              map: hotelAtlas.cell(i % HOTEL_NAMES.length),
              transparent: true,
              toneMapped: false,
              side: Three.DoubleSide,
              depthWrite: false,
            }),
          );
          sign.position.set(b.w / 2, top + 12, b.h + 0.8);
          group.add(sign);
          box(group, b.w / 2, top + 6, b.h - 2, Math.min(112, b.w * 0.72), 1, 1, darkMetal);
          for (const dx of [-Math.min(50, b.w * 0.3), Math.min(50, b.w * 0.3)])
            box(group, b.w / 2 + dx, top + 8, b.h - 2, 0.8, 16, 0.8, darkMetal);
          neonSigns.push({ sprite: halo(group, b.w / 2, top + 12, b.h + 2, Math.min(110, b.w * 0.7) * 0.9, ['#ff7fb0', '#7fe9ff', '#ffe27a', '#b7ff9a'][i % 4]), base: 0.9, mesh: sign });
        }
      }
      // ---- Facade details: shopfronts, awnings, fire escapes ------------------------
      function shopfront(group, b, kind, i) {
        const face = b.h + 0.6,
          bays = Math.max(1, Math.floor((b.w - 16) / 46)),
          bayWidth = (b.w - 16) / bays;
        box(group, b.w / 2, 7.5, b.h + 0.4, b.w - 2, 15, 1.2, mat('#2b3033', 0.7, 0.2));
        box(group, b.w / 2, 15.6, b.h + 1.2, b.w, 1.4, 2.6, mat(kind === 'stucco' ? '#d9c8a8' : '#4a4d50'));
        for (let k = 0; k < bays; k++) {
          const x = 8 + bayWidth * (k + 0.5),
            door = k === Math.floor(bays / 2);
          if (door) {
            box(group, x, 6, face + 0.2, 8, 12, 0.6, mat('#3f2f28'));
            box(group, x, 6, face + 0.6, 0.6, 12, 0.3, chrome);
            box(group, x, 12.6, face + 0.4, 9, 0.8, 0.6, chrome);
          } else {
            box(group, x, 7, face + 0.2, bayWidth - 8, 10, 0.5, shopGlassMaterial);
            // The pane in world space, so a bullet can star it and a blast blow it in.
            (b.shopPanes || (b.shopPanes = [])).push({
              x0: b.x + x - (bayWidth - 8) / 2,
              x1: b.x + x + (bayWidth - 8) / 2,
              cx: b.x + x,
              width: bayWidth - 8,
              face: b.y + face + 0.45,
              state: 0,
              hits: 0,
            });
            box(group, x, 1.8, face + 0.3, bayWidth - 8, 2.4, 0.7, mat('#5b5f63'));
          }
          if (!door && cityRandom() < 0.55) {
            const awning = box(group, x, 13.2, face + 4.2, bayWidth - 6, 0.7, 8.5, cityPick(awningMaterials));
            awning.rotation.x = 0.42;
            const stripe = box(group, x, 13.2, face + 4.2, bayWidth - 6, 0.75, 8.5, awningStripe);
            stripe.rotation.x = 0.42;
            stripe.scale.x = 0.34;
          }
        }
        const signPlane = new Three.Mesh(
          new Three.PlaneGeometry(Math.min(64, bayWidth * 1.4), Math.min(64, bayWidth * 1.4) / 4),
          new Three.MeshBasicMaterial({
            map: shopAtlas.cell((i * 7 + Math.floor(cityRandom() * 5)) % SHOP_NAMES.length),
            toneMapped: false,
          }),
        );
        signPlane.position.set(8 + bayWidth * 0.5 + (bays > 2 ? bayWidth : 0), 19.5, b.h + 1.9);
        group.add(signPlane);
        box(group, signPlane.position.x, 19.5, b.h + 1.2, signPlane.geometry.parameters.width + 2, signPlane.geometry.parameters.height + 2, 0.8, darkMetal);
        neonSigns.push({ sprite: halo(group, signPlane.position.x, 19.5, b.h + 3, 30, '#ffe0b3'), base: 0.5 });
      }
      function fireEscape(group, b) {
        const x = Math.max(24, b.w * 0.3),
          floors = Math.floor((b.height - 14) / 16);
        for (let f = 1; f <= floors; f++) {
          const y = f * 16 - 4;
          box(group, x, y, b.h + 3.2, 24, 0.6, 6, darkMetal);
          for (const dx of [-11, 11]) box(group, x + dx, y + 3, b.h + 6, 0.5, 6, 0.5, darkMetal);
          box(group, x, y + 6, b.h + 6.2, 24, 0.5, 0.5, darkMetal);
          if (f < floors)
            rod(
              group,
              new Three.Vector3(x + (f % 2 ? -11 : 11), y + 0.5, b.h + 4),
              new Three.Vector3(x + (f % 2 ? 11 : -11), y + 15.5, b.h + 4),
              0.4,
              darkMetal,
            );
        }
      }
      function balconies(group, b, material) {
        const floors = Math.floor((b.height - 12) / 14);
        for (let f = 1; f < floors; f++) {
          const y = f * 14;
          for (let x = 16; x < b.w - 12; x += 30) {
            box(group, x, y, b.h + 2.4, 18, 0.8, 5, material);
            box(group, x, y + 3, b.h + 4.6, 18, 5, 0.4, glass);
          }
        }
      }
      // ---- Build every building -------------------------------------------------------
      const cityStreetSouth = (b) => cityStreetAt(b.x + b.w / 2, b.y + b.h + 44, 10);
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (b.depotWall) continue;
        const kind = (b.archetype = archetypeFor(b)),
          height = b.height,
          group = new Three.Group();
        group.position.set(b.x, 0, b.y);
        scene.add(group);
        batchGroups.push(group);
        const face = facadeMaterial(kind, i, b),
          roof = roofMaterial(kind),
          top = roof.material,
          trimColor =
            kind === 'tower'
              ? '#a9b3ba'
              : kind === 'deco' || kind === 'decoTower'
                ? '#f1e6d4'
                : kind === 'warehouse'
                  ? '#6b7379'
                  : i % 2
                    ? '#9a958d'
                    : '#7c6d63',
          trim = mat(trimColor);
        box(group, b.w / 2, height / 2, b.h / 2, b.w, height, b.h, [face, face, top, concrete, face, face]);
        // Parapet coping and a plinth along the street.
        box(group, b.w / 2, height + 1.6, 2, b.w + 3, 3.2, 4, trim);
        box(group, b.w / 2, height + 1.6, b.h - 2, b.w + 3, 3.2, 4, trim);
        box(group, 2, height + 1.6, b.h / 2, 4, 3.2, b.h, trim);
        box(group, b.w - 2, height + 1.6, b.h / 2, 4, 3.2, b.h, trim);
        if (kind !== 'tower') box(group, b.w / 2, 2.5, b.h + 0.8, b.w + 3, 5, 2, kind === 'stucco' || kind === 'deco' ? mat('#cbbfae') : trim);
        if (kind === 'tower' && height > 120) {
          /* Setback crown. A single step reads as an office block; the towers of
             the financial core step two or three times and carry a mast, which is
             what makes a skyline out of a row of buildings. */
          const steps = height > 420 ? 3 : height > 260 ? 2 : 1;
          let level = height,
            sw = b.w,
            sh = b.h,
            crown = 0;
          for (let s = 0; s < steps; s++) {
            const stepH = Math.min(52, height * (0.2 - s * 0.042));
            sw *= 0.78;
            sh *= 0.78;
            box(group, b.w / 2, level + stepH / 2, b.h / 2, sw, stepH, sh, [face, face, top, top, face, face]);
            box(group, b.w / 2, level + stepH + 1.2, b.h / 2, sw + 2, 2.4, sh + 2, trim);
            level += stepH + 1.2;
            crown += stepH + 1.2;
          }
          if (height > 420) {
            const spire = Math.min(110, height * 0.17);
            mesh(cylinderGeo, trim, group, b.w / 2, level + spire / 2, b.h / 2, 2.8, spire, 2.8);
            mesh(cylinderGeo, chrome, group, b.w / 2, level + spire + 8, b.h / 2, 0.9, 20, 0.9);
            crown += spire + 18;
          }
          // Vertical mullion fins: the curtain wall needs relief to catch the sun.
          if (height > 260) {
            const finMat = mat('#b6bec4', 0.45, 0.35);
            for (let x = 22; x < b.w - 14; x += 38) {
              box(group, x, height / 2, b.h + 0.7, 1.4, height - 10, 1.4, finMat);
              box(group, x, height / 2, -0.7, 1.4, height - 10, 1.4, finMat);
            }
            for (let z = 22; z < b.h - 14; z += 38) {
              box(group, -0.7, height / 2, z, 1.4, height - 10, 1.4, finMat);
              box(group, b.w + 0.7, height / 2, z, 1.4, height - 10, 1.4, finMat);
            }
          }
          // Glazed podium: towers meet the street on a wider base, never on a knife edge.
          if (height > 260) {
            const podium = Math.min(46, height * 0.1);
            box(group, b.w / 2, podium / 2, b.h / 2, b.w + 22, podium, b.h + 22, [face, face, top, top, face, face]);
            box(group, b.w / 2, podium + 1.4, b.h / 2, b.w + 26, 2.8, b.h + 26, trim);
          }
          b.crownHeight = crown;
        }
        if (kind === 'brick' && cityRandom() < 0.5)
          for (let y = 16; y < height - 6; y += 16) box(group, b.w / 2, y, b.h + 0.3, b.w + 1, 1.1, 1.4, trim);
        if (kind === 'office') box(group, b.w / 2, height - 5, b.h + 0.6, b.w + 1.5, 2.2, 2, trim);
        if (kind === 'hotel') {
          for (let y = 25; y < height - 8; y += 18) {
            for (const z of [-1, b.h + 1]) {
              box(group, b.w / 2, y, z, b.w + 2, 1.8, 3, concrete);
              for (let x = 18; x < b.w - 12; x += 26) {
                box(group, x, y + 7, z, 18, 10, 1, glass);
                box(group, x, y + 2, z + (z < 0 ? -1 : 1), 20, 1.2, 5, trim);
              }
            }
            for (const x of [-1, b.w + 1]) {
              box(group, x, y, b.h / 2, 3, 1.8, b.h, concrete);
              for (let z = 18; z < b.h - 12; z += 26) box(group, x, y + 7, z, 1, 10, 18, glass);
            }
          }
          for (const x of [5, b.w - 5]) for (const z of [5, b.h - 5]) box(group, x, height / 2, z, 7, height + 1, 7, concrete);
        }
        const streetSouth = cityStreetSouth(b);
        if (streetSouth && !b.place && ['brick', 'stucco', 'office', 'deco'].includes(kind)) shopfront(group, b, kind, i);
        else if (kind === 'brick' && !b.place && cityRandom() < 0.7) fireEscape(group, b);
        if (kind === 'decoTower' && !b.place) balconies(group, b, mat('#efe4d2'));
        decorateRoof(kind, b, group, i);
        allBuildings.push({
          b,
          group,
          height: height + (b.crownHeight || 0),
          materials: [face, top, trim],
          opacity: 1,
        });
        statics.push({
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          group,
          radius: Math.max(b.w, b.h),
        });
      }
      // ---- Sidewalk furniture --------------------------------------------------------
      const furnitureGroup = new Three.Group();
      scene.add(furnitureGroup);
      batchGroups.push(furnitureGroup);
      const shelters = [];
      function clearSidewalk(x, y) {
        return landAt(x, y) && !onRoad(x, y) && !solid(x, y, 5) && !onBoulevard(x, y, 12) && !inHarbor(x, y, 20) && !inStadiumLot(x, y, 10) && !inGarageLot(x, y, 6);
      }
      function busShelter(x, z, faceSouth) {
        const g = new Three.Group();
        g.position.set(x, 0, z);
        g.rotation.y = faceSouth ? 0 : Math.PI;
        furnitureGroup.add(g);
        for (const dx of [-13, 13]) box(g, dx, 8, -3, 1, 16, 1, darkMetal);
        box(g, 0, 16.2, 0, 30, 0.7, 9, mat('#6b7378', 0.4, 0.5));
        box(g, 0, 8.5, -3.4, 27, 12, 0.5, glass);
        box(g, 0, 4.8, -0.5, 22, 0.8, 4, propMats.benchSeat);
        for (const dx of [-9, 9]) box(g, dx, 2.4, -0.5, 0.8, 4.6, 3.4, darkMetal);
        const adPlane = new Three.Mesh(
          new Three.PlaneGeometry(9, 12),
          new Three.MeshBasicMaterial({ map: adAtlas.cell(Math.floor(cityRandom() * AD_LINES.length)), toneMapped: false }),
        );
        adPlane.position.set(-16.5, 9, 2.8);
        adPlane.rotation.y = Math.PI / 2;
        g.add(adPlane);
        box(g, -16.5, 9, 2.8, 0.8, 13, 10, darkMetal);
        box(g, 18, 9, 2, 0.8, 18, 0.8, darkMetal);
        box(g, 18, 17, 2, 6, 3, 0.4, mat('#2f5f9a'));
        shelters.push(g);
        statics.push({ x, y: z, group: g, radius: 40 });
        // People wait here (src/crowd.js) and buses stop for them.
        registerBusStop(x, z);
      }
      for (let bx = BLOCK_X_MIN; bx <= BLOCK_X_MAX; bx++)
        for (let by = BLOCK_Y_MIN; by <= BLOCK_Y_MAX; by++) {
          const x = blockX(bx) + 89,
            z = blockY(by) + 89,
            w = 334;
          if (!validCityBlock(x, z, w, w) || harborOverlap(x, z, w, w) || stadiumOverlap(x, z, w, w) || isPark(bx, by)) continue;
          const south = z + w + 14,
            north = z - 14,
            west = x - 14,
            east = x + w + 14;
          // South sidewalk: hydrant, bins, newspaper boxes, mailbox, parking meters.
          if (clearSidewalk(x + 10, south)) placeProp('hydrant', pools.hydrant, x + 10, 2.8, south, 1.6, 5.6, 1.6);
          for (const px of [x + 96, x + 238])
            if (clearSidewalk(px, south + 4)) placeProp('trash', pools.trash, px, 3.2, south + 4, 2.6, 6.4, 2.6);
          if (clearSidewalk(x + 150, south + 4)) {
            placeProp('news', pools.newsRed, x + 150, 3.6, south + 4, 3.5, 7, 3);
            placeProp('news', pools.newsYellow, x + 154, 3.6, south + 4, 3.5, 7, 3);
            placeProp('news', pools.newsBlue, x + 158, 3.6, south + 4, 3.5, 7, 3);
          }
          if (clearSidewalk(x + 300, south + 3) && cityRandom() < 0.6) placeProp('mailbox', pools.mailbox, x + 300, 4, south + 3, 4, 8, 4);
          if (cityRandom() < 0.5)
            for (let px = x + 40; px < x + w - 30; px += 52)
              if (clearSidewalk(px, south - 4)) placeProp('meter', pools.meter, px, 4.5, south - 4, 1.2, 9, 1.2);
          // North sidewalk: a bin and bollards; benches come from the shared benchSpots() list below.
          if (clearSidewalk(x + w - 30, north)) placeProp('trash', pools.trash, x + w - 30, 3.2, north, 2.6, 6.4, 2.6);
          // West and east sidewalks: bollards and the odd traffic cone.
          for (const [sx, sz] of [[west, z + 30], [west, z + w - 30], [east, z + 30], [east, z + w - 30]])
            if (clearSidewalk(sx, sz)) placeProp('bollard', pools.bollard, sx, 2.6, sz, 1.2, 5.2, 1.2);
          if (cityRandom() < 0.25 && clearSidewalk(east, z + w / 2)) placeProp('cone', pools.cone, east, 3, z + w / 2, 3, 6, 3);
          // Alley clutter: dumpsters and crates in the interior parking court.
          if (cityRandom() < 0.7 && clearSidewalk(x + 200, z + 176)) {
            placeProp('dumpster', pools.dumpster, x + 200, 4.5, z + 176, 16, 9, 8);
            if (cityRandom() < 0.5) placeProp('crate', pools.crate, x + 214, 3, z + 176, 6, 6, 6, 0.4);
          }
          // Bus shelters on the wide avenues, one per block on the north sidewalk.
          const avenue = blockY(by + 1);
          if (WIDE_ROADS.includes(avenue) && cityRandom() < 0.6 && clearSidewalk(x + 180, south + 6))
            busShelter(x + 180, south + 6, true);
        }
      for (const spot of benchSpots()) {
        const bench = placeProp('bench', pools.benchSeat, spot.x, 4.2, spot.y, 16, 1, 5);
        placeProp('bench', pools.benchSeat, spot.x, 7, spot.y - 2.4, 16, 4.5, 0.8, 0, bench);
        placeProp('bench', pools.benchLeg, spot.x - 6.5, 2, spot.y, 1, 4, 4.6, 0, bench);
        placeProp('bench', pools.benchLeg, spot.x + 6.5, 2, spot.y, 1, 4, 4.6, 0, bench);
        // Knocked over, nobody can sit on it (damage.js topple).
        if (bench) bench.bench = spot;
      }
      for (const im of Object.values(pools)) im.instanceMatrix.needsUpdate = true;
      // ---- Night lighting update --------------------------------------------------------
      function updateCityscapeVisuals() {
        const light = daylight(),
          night = clamp(1 - light * 1.6, 0, 1),
          hour = (worldMinutes % 1440) / 60,
          lateNight = hour > 1 && hour < 5 ? 0.45 : 1;
        for (const w of litWindowMaterials) {
          const flicker = 0.92 + 0.08 * Math.sin(gameTime * 0.7 + w.phase);
          w.material.emissiveIntensity =
            night * w.strength * lateNight * flicker * 1.35 * sideJobPower(w.x, w.y);
        }
        shopGlassMaterial.emissiveIntensity = night * 0.9 * (hour > 0.5 && hour < 6 ? 0.35 : 1);
        for (const n of neonSigns) {
          const on = n.beacon ? (Math.sin(gameTime * 2.4) > 0 ? 1 : 0.15) : 1,
            power = sideJobPower(n.sprite.parent.position.x, n.sprite.parent.position.z);
          n.sprite.material.opacity = clamp(0.06 + night * n.base, 0, 1) * on * power;
          if (n.mesh) n.mesh.material.opacity = (0.65 + night * 0.35) * (0.3 + 0.7 * power);
        }
        beaconMaterial.color.set(Math.sin(gameTime * 2.4) > 0 ? '#ff3b2f' : '#4a1512');
      }
      // END SUBSYSTEM: src/cityscape3d.js
