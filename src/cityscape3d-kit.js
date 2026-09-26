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
        if (roofOwner && roofPlantPools.has(im)) roofKeepOut(x, z, sx + 2, sz + 2);
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
      /**
       * Shared finishes for building parts (trims, plinths, bulkhead doors, fins,
       * balconies, shopfront frames): one material per colour and finish, so the
       * static batcher (render3d.js) merges every building's copies in a map cell
       * into one draw instead of one per building. Nothing may change these at run
       * time; a part that needs its own state gets its own mat().
       */
      const staticMats = new Map();
      function staticMat(color, roughness = 0.7, metalness = 0) {
        const key = color + '|' + roughness + '|' + metalness;
        if (!staticMats.has(key)) staticMats.set(key, mat(color, roughness, metalness));
        return staticMats.get(key);
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
      /**
       * Window gloss: one roughness/metalness map per facade quadrant (three.js
       * reads roughness from green and metalness from blue). Masonry stays matte;
       * the panes are smooth and faintly metallic, so from the tilted street camera
       * every window catches the sky from the environment map (and the lamps at
       * night) instead of reading as painted-on dark rectangles.
       */
      const windowGloss = WINDOW_GRIDS.map((grid) => {
        if (!grid) return null;
        const t = canvasTexture(256, (g, s) => {
          g.fillStyle = 'rgb(0,235,0)';
          g.fillRect(0, 0, s, s);
          g.fillStyle = 'rgb(0,34,120)';
          for (const cx of grid.cols)
            for (const cy of grid.rows)
              g.fillRect(((cx - grid.w / 2) / 512) * s + 1, ((cy - grid.h / 2) / 512) * s + 1, (grid.w / 512) * s - 2, (grid.h / 512) * s - 2);
        });
        t.colorSpace = Three.NoColorSpace;
        return t;
      });
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
        ['PALM KEYS AUTO', 'MECHANICS · RESPRAYS WHILE YOU WAIT', '#f0a7b8', '#2c1e2a'],
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
      // The stadium's perimeter boards (sports3d.js): the advertisers' own artwork
      // (signdesigns3d.js), the same as on the city's billboards.
      const adAtlas = textAtlas(AD_LINES, 512, 160, (g, [title, sub, bg, fg], w, h) => {
        const art = SignArt.ADS.find(([name]) => name === title);
        if (art) return art[1](g, w, h);
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
        shrub: stillLeafMat,
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
      // @include src/signage3d.js
      // The building being dressed and the instanced plant that counts as roof clutter.
      let roofOwner = null;
      const roofPlantPools = new Set([pools.acUnit, pools.dish, pools.chimney, pools.skylight, pools.tank]);
      // ---- Archetype selection ------------------------------------------------------
      function archetypeFor(b) {
        if (b.skyline) return 'skyline';
        if (b.roofBar) return 'hotel';
        if (b.style === 2) return 'warehouse';
        if (b.tropical) return b.height >= realBuildingHeight(60) ? 'decoTower' : 'deco';
        const district = districtAt(b.x + b.w / 2, b.y + b.h / 2);
        if (b.height >= realBuildingHeight(100)) return 'tower';
        if (b.height >= realBuildingHeight(68)) return district.includes('FINANCIAL') ? 'tower' : 'office';
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
        shopGlassMaterial = useCityGlass(
          new Three.MeshStandardMaterial({
            color: '#1a2a33',
            roughness: 0.15,
            metalness: 0.6,
            emissive: '#ffd6a0',
            emissiveIntensity: 0,
          }),
        ),
        beaconMaterial = new Three.MeshBasicMaterial({ color: '#ff3b2f' }),
        beacons = [],
        awningMaterials = ['#b7413a', '#2d6a5e', '#26426d', '#c99a2e', '#6d3f76', '#d86d4a'].map((c) =>
          mat(c, 0.9),
        ),
        awningStripe = mat('#efe6d3', 0.9);
      /**
       * SHARED FACADES
       * Every building used to have its own facade material (its own texture
       * repeat, tint and window-light schedule), so every building's walls were a
       * draw call of their own that the batcher could not merge: most of the
       * several hundred static draws in any city view. Now a facade is one of a
       * few shared materials (a wall texture and a window-light mask) and what was
       * per building lives in the building's wall geometry:
       *
       *  - the texture repeat is baked into its UVs,
       *  - its tint is a vertex colour,
       *  - its window light (strength, phase) is the `cityLit` attribute, which
       *    the facade shader multiplies into the emissive together with the
       *    street power at the fragment (the blackout job, cityPower()).
       *
       * The materials' emissive intensity is the city-wide night level
       * (updateCityscapeVisuals), so the far copy of the city (flight-view3d.js)
       * lights up with them. The batcher carries the extra attributes along.
       */
      const facadeMaterials = new Map(),
        facadeClock = { value: 0 };
      function cityFacadePatch(shader) {
        cityGlassPatch(shader);
        shader.uniforms.cityClock = facadeClock;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute vec2 cityLit;\nvarying vec2 vCityLit;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCityLit = cityLit;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vCityLit;\nuniform float cityClock;')
          .replace(
            '#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vCityLit.x * ( 0.92 + 0.08 * sin( cityClock * 0.7 + vCityLit.y ) ) * cityPower();',
          );
      }
      function sharedFacade(key, make) {
        if (!facadeMaterials.has(key)) {
          const material = make();
          material.vertexColors = true;
          material.emissiveIntensity = 0;
          material.userData.cityFacade = true;
          material.onBeforeCompile = cityFacadePatch;
          material.customProgramCacheKey = () => 'cityFacade';
          facadeMaterials.set(key, material);
        }
        return facadeMaterials.get(key);
      }
      // A building's facade: the shared material plus what its wall geometry carries.
      function facadeMaterial(kind, index, b) {
        if (kind === 'tower' || kind === 'decoTower') {
          const which = index % curtainWalls.length,
            wall = curtainWalls[which],
            material = sharedFacade('curtain' + which, () =>
              useCityGlass(
                new Three.MeshStandardMaterial({
                  map: wall.map,
                  roughness: 0.25,
                  metalness: 0.55,
                  emissive: '#ffe6bf',
                  emissiveMap: wall.lit,
                }),
              ),
            );
          return {
            material,
            tint: new Three.Color(kind === 'decoTower' ? '#e9dccb' : '#cfd6dc'),
            // A curtain-wall tile is two storeys high.
            repeatX: Math.max(1, Math.round(b.w / 36)),
            repeatY: Math.max(1, Math.round(b.height / (2 * STOREY))),
            strength: cityRange(0.7, 1.1),
            phase: cityRandom() * 9,
          };
        }
        const quadrant = kind === 'brick' ? 0 : kind === 'office' ? 1 : kind === 'warehouse' ? 2 : 3,
          tints = FACADE_TINTS[kind === 'deco' ? 'stucco' : kind] || FACADE_TINTS.stucco,
          mask = windowMasks[quadrant] ? cityPick(windowMasks[quadrant]) : null,
          material = sharedFacade(kind + '|' + quadrant + '|' + (mask ? mask.uuid : ''), () => {
            const m = new Three.MeshStandardMaterial({
              map: wallTextures[quadrant],
              roughness: kind === 'warehouse' ? 0.6 : 0.9,
              metalness: kind === 'warehouse' ? 0.35 : 0,
            });
            if (windowGloss[quadrant]) {
              m.roughnessMap = m.metalnessMap = windowGloss[quadrant];
              m.roughness = kind === 'warehouse' ? 0.65 : 1;
              m.metalness = kind === 'warehouse' ? 0.6 : 1;
            }
            if (mask) {
              m.emissive = new Three.Color('#ffd9a6');
              m.emissiveMap = mask;
            }
            return m;
          });
        return {
          material,
          tint: new Three.Color(tints[index % tints.length]),
          // A wall tile is four bays by four storeys.
          repeatX: Math.max(1, Math.round(b.w / 34) / 4),
          repeatY: Math.max(0.5, Math.round(b.height / STOREY) / 4),
          strength: mask ? cityRange(0.6, 1.0) : 0,
          phase: mask ? cityRandom() * 9 : 0,
        };
      }
      // The building's own copy of the wall box: repeat in the UVs, tint and window
      // light as vertex attributes (see SHARED FACADES).
      function facadeGeometry(face) {
        if (face.geometry) return face.geometry;
        const geo = blockWallsGeo.clone(),
          uv = geo.attributes.uv,
          count = uv.count,
          colors = new Float32Array(count * 3),
          lit = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
          uv.setXY(i, uv.getX(i) * face.repeatX, uv.getY(i) * face.repeatY);
          colors[i * 3] = face.tint.r;
          colors[i * 3 + 1] = face.tint.g;
          colors[i * 3 + 2] = face.tint.b;
          lit[i * 2] = face.strength;
          lit[i * 2 + 1] = face.phase;
        }
        geo.setAttribute('color', new Three.BufferAttribute(colors, 3));
        geo.setAttribute('cityLit', new Three.BufferAttribute(lit, 2));
        return (face.geometry = geo);
      }
      // One material per roof finish, shared by every roof that uses it (they batch).
      const roofMaterials = new Map();
      function roofMaterial(kind) {
        const name = cityPick(ROOF_FOR[kind] || ROOF_FOR.brick);
        if (!roofMaterials.has(name))
          roofMaterials.set(
            name,
            new Three.MeshStandardMaterial({
              map: ROOF_TEXTURES[name],
              roughness: name === 'metal' ? 0.45 : 0.92,
              metalness: name === 'metal' ? 0.5 : 0.02,
            }),
          );
        return { name, material: roofMaterials.get(name) };
      }
      /**
       * A building block as two meshes: its four walls in the building's own facade
       * material (its windows light up on their own schedule) and the roof cap in
       * the shared roof finish, which the batcher merges across the whole cell. The
       * underside is never seen. (A six-material box was three draws per building
       * that the batcher could not merge at all.)
       */
      const blockWallsGeo = boxGeo.clone(),
        blockRoofGeo = boxGeo.clone();
      {
        const index = boxGeo.index.array,
          sides = [],
          roof = [];
        for (const g of boxGeo.groups)
          for (let k = g.start; k < g.start + g.count; k++) {
            if (g.materialIndex === 2) roof.push(index[k]);
            else if (g.materialIndex !== 3) sides.push(index[k]);
          }
        blockWallsGeo.setIndex(sides);
        blockRoofGeo.setIndex(roof);
        blockWallsGeo.clearGroups();
        blockRoofGeo.clearGroups();
      }
      function blockBox(group, x, y, z, w, h, d, face, top) {
        mesh(facadeGeometry(face), face.material, group, x, y, z, w, h, d);
        mesh(blockRoofGeo, top, group, x, y, z, w, h, d);
      }
