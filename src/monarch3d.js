      // BEGIN SUBSYSTEM: src/monarch3d.js — Monarch Isle in 3D
      /**
       * Monarch Isle in 3D
       * Source: src/monarch3d.js
       * Scope: createCityRenderer() closure, after marina3d.js (it borrows the
       * Harbor Point yacht builders) and before the vehicles.
       *
       * Everything on the island that monarch.js planned: the town blocks (their
       * own facades, mansard roofs, shopfronts with the island's signs), fourteen
       * villas in eight styles with their gardens, pools and courts, the two
       * towers, the marina (pontoons, thirty-one moored yachts, three
       * superyachts, the yacht club, the harbour master's tower, the lighthouse,
       * the mole), the roundabout fountains, the street lanterns, the beach
       * furniture and the payphones. The botanic garden is monarch-garden3d.js.
       *
       * DRAW CALLS. Everything is built in world coordinates into one root group
       * per 1024-unit map cell, painted with the boat kit's tint() (or one of a
       * few shared textured materials), and each root is collapsed by kitMerge()
       * into one vertex-coloured mesh per finish plus one per textured material:
       * about a dozen draws a cell, culled whole by the static cells. Lanterns are
       * instanced street props (knockable). Night light: kitLight() points per
       * root, the glow field (addGlow) and the island's own lamp light map
       * (lighting3d.js ISLE LIGHT MAP).
       */
      const isleRenderReport = {};
      const ISLE_CELL = 1024,
        isleRoots = new Map(),
        isleLights = kitLightList();
      function isleRoot(x, z) {
        const cx = Math.floor(x / ISLE_CELL),
          cz = Math.floor(z / ISLE_CELL),
          key = cx * 4096 + cz;
        let root = isleRoots.get(key);
        if (!root) {
          root = new Three.Group();
          root.name = 'monarch cell ' + cx + ',' + cz;
          root.userData.lightCloud = true;
          scene.add(root);
          isleRoots.set(key, root);
          statics.push({ x: (cx + 0.5) * ISLE_CELL, y: (cz + 0.5) * ISLE_CELL, group: root, radius: ISLE_CELL * 0.75 + 260 });
        }
        return root;
      }
      // A mesh at world coordinates in the cell under (x, z).
      function isleBox(x, y, z, w, h, d, material, root = isleRoot(x, z)) {
        return box(root, x, y, z, w, h, d, material);
      }
      function isleMesh(geo, material, x, y, z, sx = 1, sy = 1, sz = 1, root = isleRoot(x, z)) {
        return mesh(geo, material, root, x, y, z, sx, sy, sz);
      }
      let isleSeed = 4242;
      const isleRandom = () => {
          isleSeed = (isleSeed * 1664525 + 1013904223) >>> 0;
          return isleSeed / 4294967296;
        },
        islePick = (list) => list[Math.floor(isleRandom() * list.length)];
      const ISLE = {
        stone: tint('#e2d8c2', 'matte'),
        stoneWarm: tint('#d8c7a4', 'matte'),
        stoneDark: tint('#a99c86', 'matte'),
        white: tint('#f2f0ea', 'satin'),
        cream: tint('#ece2cc', 'matte'),
        zinc: tint('#66707a', 'satin'),
        slate: tint('#4c545c', 'matte'),
        terracotta: tint('#b85c3c', 'matte'),
        copper: tint('#6f9e8c', 'satin'),
        iron: tint('#23272b', 'satin'),
        brass: tint('#c9a24e', 'metal'),
        gold: tint('#d9b25a', 'metal'),
        chrome: tint('#cfd5d9', 'metal'),
        hedge: tint('#3f6536', 'matte'),
        hedgeDark: tint('#34552f', 'matte'),
        lawn: tint('#5f8a4a', 'matte'),
        teak: tint('#9c7650', 'satin'),
        glassRail: tint('#9fc3cc', 'gloss'),
        water: kitPoolWater,
        glass: kitGlass,
        canvas: tint('#efe9dc', 'matte'),
        asphalt: tint('#3a4144', 'matte'),
        brick: tint('#9b5a44', 'matte'),
        black: tint('#17191b', 'satin'),
        navy: tint('#1c2a44', 'satin'),
      };
      /* ---- Facades ------------------------------------------------------------------ */
      /**
       * A facade is one shared material per style: a painted wall tile of four
       * bays by four storeys (a bay is 3.8 m, a storey STOREY) and a matching lit
       * window mask for the night. Walls are UV-mapped in world units, so the
       * tile repeats at true size on any building.
       */
      const ISLE_BAY = 3.8 * UNITS_PER_METRE,
        ISLE_TILE_W = ISLE_BAY * 4,
        ISLE_TILE_H = STOREY * 4;
      const ISLE_FACADES = {
        // Haussmann limestone: cut stone, tall French windows, iron balconies.
        limestone: { wall: '#e4d8bf', joint: '#cbbd9f', win: [0.3, 0.4, 0.14, 0.7], frame: '#f1ead8', glass: ['#3b4a55', '#1e2a33'], balcony: 'iron', cornice: '#d2c4a4', shutters: null, lit: 0.45 },
        mansion: { wall: '#dccaa6', joint: '#c6b28c', win: [0.32, 0.36, 0.2, 0.6], frame: '#f0e6cf', glass: ['#40505a', '#222e36'], balcony: 'iron', cornice: '#c9b58f', shutters: null, lit: 0.42 },
        mansionLight: { wall: '#f1eee6', joint: '#dcd8cc', win: [0.18, 0.64, 0.12, 0.74], frame: '#4a5055', glass: ['#5e7888', '#2b3c48'], balcony: 'glass', cornice: '#e4e0d4', shutters: null, lit: 0.5 },
        townhouse: { wall: '#f3efe4', joint: '#e2dccd', win: [0.3, 0.4, 0.18, 0.62], frame: '#ffffff', glass: ['#2f3a42', '#161e24'], balcony: 'iron', cornice: '#e6e0d0', shutters: null, bars: true, lit: 0.5 },
        townhouseBrick: { wall: '#b8906a', joint: '#9b7656', win: [0.3, 0.4, 0.18, 0.62], frame: '#f4f1ea', glass: ['#2f3a42', '#161e24'], balcony: null, cornice: '#e8e2d2', shutters: null, bars: true, brick: true, lit: 0.5 },
        arcade: { wall: '#e0c9a2', joint: '#c9b087', win: [0.28, 0.44, 0.16, 0.66], frame: '#f2e8d2', glass: ['#3b4a55', '#1e2a33'], balcony: 'iron', cornice: '#cdb68d', arch: true, shutters: '#5d7a6a', lit: 0.45 },
        harbour: { wall: '#f4f2ec', joint: '#e2dfd6', win: [0.08, 0.84, 0.08, 0.8], frame: '#6c747a', glass: ['#6f8e9e', '#34505f'], balcony: 'glass', cornice: '#f4f2ec', shutters: null, lit: 0.55 },
        podium: { wall: '#e7dfcf', joint: '#d1c7b3', win: [0.16, 0.68, 0.1, 0.8], frame: '#8a7a5a', glass: ['#4d6474', '#22323e'], balcony: null, cornice: '#d8ccb2', shutters: null, lit: 0.6 },
        clinic: { wall: '#f5f6f4', joint: '#e0e4e2', win: [0.1, 0.8, 0.22, 0.56], frame: '#2f6f6a', glass: ['#79a6a6', '#3a6666'], balcony: null, cornice: '#f5f6f4', shutters: null, lit: 0.6 },
        hotel: { wall: '#e8dcc0', joint: '#d2c3a2', win: [0.3, 0.4, 0.16, 0.66], frame: '#f4ecd8', glass: ['#3b4a55', '#1e2a33'], balcony: 'iron', cornice: '#d6c6a2', arch: true, shutters: null, lit: 0.6 },
        academy: { wall: '#a8604a', joint: '#8e4e3c', win: [0.26, 0.48, 0.16, 0.66], frame: '#f0ebe0', glass: ['#2f3a42', '#161e24'], balcony: null, cornice: '#e4dccb', brick: true, bars: true, arch: true, lit: 0.35 },
        police: { wall: '#d9d4c8', joint: '#c4bdae', win: [0.24, 0.52, 0.2, 0.56], frame: '#1f2d44', glass: ['#3f4f5e', '#1e2833'], balcony: null, cornice: '#c9c2b2', lit: 0.6 },
        clubhouse: { wall: '#8f969a', joint: '#7d8488', win: [0.26, 0.48, 0.18, 0.6], frame: '#f7f6f2', glass: ['#34424c', '#18222a'], balcony: null, cornice: '#f7f6f2', shingle: true, shutters: '#2f4a5e', lit: 0.5 },
        restaurant: { wall: '#2a2a2e', joint: '#222226', win: [0.14, 0.72, 0.16, 0.7], frame: '#b8964e', glass: ['#554a3a', '#2a2218'], balcony: null, cornice: '#b8964e', lit: 0.8 },
        spa: { wall: '#ece6da', joint: '#ddd5c6', win: [0.12, 0.76, 0.16, 0.66], frame: '#8a7a64', glass: ['#6f9690', '#35584f'], balcony: null, cornice: '#e0d8c8', lit: 0.5 },
        showroom: { wall: '#1c1e21', joint: '#16181a', win: [0.02, 0.96, 0.04, 0.92], frame: '#3a3e42', glass: ['#8aa0ac', '#3c525e'], balcony: null, cornice: '#2a2d30', lit: 0.9 },
        fuel: { wall: '#f2f3f4', joint: '#e0e2e4', win: [0.06, 0.88, 0.12, 0.7], frame: '#0e2a3a', glass: ['#7fa2b4', '#3a5a6a'], balcony: null, cornice: '#0e2a3a', lit: 0.9 },
        bank: { wall: '#ddd3be', joint: '#c5b99f', win: [0.3, 0.4, 0.14, 0.72], frame: '#e9e0cc', glass: ['#34424c', '#18222a'], balcony: null, cornice: '#cfc2a4', arch: true, lit: 0.4 },
        chapel: { wall: '#cfc5b0', joint: '#b5aa92', win: [0.36, 0.28, 0.16, 0.7], frame: '#b5aa92', glass: ['#5a3e6e', '#2a3a6a'], balcony: null, cornice: '#b5aa92', arch: true, lit: 0.3 },
        // Villas.
        villaStucco: { wall: '#f1e7d4', joint: '#e2d6bf', win: [0.3, 0.4, 0.2, 0.6], frame: '#ffffff', glass: ['#34424c', '#18222a'], balcony: null, cornice: '#f1e7d4', shutters: '#6f8e7a', lit: 0.55 },
        villaTerracotta: { wall: '#e9c9a0', joint: '#d8b48a', win: [0.28, 0.44, 0.2, 0.62], frame: '#f4ecdc', glass: ['#34424c', '#18222a'], balcony: 'iron', cornice: '#e9c9a0', arch: true, shutters: '#3f6a8a', lit: 0.55 },
        villaWhite: { wall: '#f6f5f1', joint: '#e8e6e0', win: [0.3, 0.4, 0.18, 0.64], frame: '#ffffff', glass: ['#2f3a42', '#161e24'], balcony: null, cornice: '#f6f5f1', shutters: '#1f2a33', bars: true, lit: 0.55 },
        villaShingle: { wall: '#9aa0a2', joint: '#868c8e', win: [0.28, 0.44, 0.18, 0.62], frame: '#fbfaf7', glass: ['#2f3a42', '#161e24'], balcony: null, cornice: '#fbfaf7', shingle: true, bars: true, shutters: '#27374a', lit: 0.55 },
        villaTudor: { wall: '#efe6d2', joint: '#e2d8c2', win: [0.3, 0.4, 0.2, 0.56], frame: '#3a2a1e', glass: ['#2f3a42', '#161e24'], balcony: null, cornice: '#3a2a1e', timber: true, lit: 0.5 },
        villaChateau: { wall: '#e3d6bb', joint: '#cbbc9c', win: [0.32, 0.36, 0.14, 0.72], frame: '#f1e9d6', glass: ['#34424c', '#18222a'], balcony: 'iron', cornice: '#d2c29f', lit: 0.5 },
        villaDeco: { wall: '#f4efe4', joint: '#e6dfd0', win: [0.12, 0.76, 0.24, 0.5], frame: '#3d5a66', glass: ['#5a7a88', '#2a4450'], balcony: null, cornice: '#9fc4c8', bands: '#9fc4c8', lit: 0.55 },
        villaGlass: { wall: '#f5f5f2', joint: '#f5f5f2', win: [0.02, 0.96, 0.08, 0.86], frame: '#2a2d30', glass: ['#8fb0bf', '#3b5868'], balcony: null, cornice: '#f5f5f2', lit: 0.7 },
      };
      const isleFacadeMaterials = new Map(),
        isleWindowMaterials = [];
      function isleCanvasTexture(size, paint, colorSpace = true) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        paint(cv.getContext('2d'), size);
        const tx = new Three.CanvasTexture(cv);
        if (colorSpace) tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      // Paints one facade style's day tile and its night mask.
      function paintIsleFacade(style, lit) {
        const F = ISLE_FACADES[style];
        return isleCanvasTexture(512, (g, s) => {
          const bay = s / 4,
            floor = s / 4;
          if (lit) {
            g.fillStyle = '#000';
            g.fillRect(0, 0, s, s);
          } else {
            g.fillStyle = F.wall;
            g.fillRect(0, 0, s, s);
            // Masonry: ashlar courses, brick bond, shingles or plain render.
            g.strokeStyle = F.joint;
            g.lineWidth = 1;
            if (F.brick) {
              for (let y = 0; y < s; y += 6) {
                g.beginPath();
                g.moveTo(0, y);
                g.lineTo(s, y);
                g.stroke();
                for (let x = (y / 6) % 2 ? 0 : 7; x < s; x += 14) {
                  g.beginPath();
                  g.moveTo(x, y);
                  g.lineTo(x, y + 6);
                  g.stroke();
                }
              }
            } else if (F.shingle) {
              for (let y = 0; y < s; y += 8) {
                g.fillStyle = y % 16 ? F.wall : F.joint;
                g.globalAlpha = 0.35;
                g.fillRect(0, y, s, 2);
                g.globalAlpha = 1;
                for (let x = (y / 8) % 2 ? 0 : 5; x < s; x += 10) {
                  g.beginPath();
                  g.moveTo(x, y);
                  g.lineTo(x, y + 8);
                  g.stroke();
                }
              }
            } else if (F.joint !== F.wall) {
              for (let y = 0; y < s; y += 16) {
                g.beginPath();
                g.moveTo(0, y);
                g.lineTo(s, y);
                g.stroke();
              }
            }
            // Weathering: a faint grime gradient per storey.
            for (let r = 0; r < 4; r++) {
              const grad = g.createLinearGradient(0, r * floor, 0, (r + 1) * floor);
              grad.addColorStop(0, 'rgba(0,0,0,0)');
              grad.addColorStop(1, 'rgba(40,30,20,0.06)');
              g.fillStyle = grad;
              g.fillRect(0, r * floor, s, floor);
            }
            if (F.timber) {
              g.fillStyle = '#3a2a1e';
              for (let c = 0; c <= 4; c++) g.fillRect(c * bay - 3, 0, 6, s);
              for (let r = 0; r <= 4; r++) g.fillRect(0, r * floor - 3, s, 6);
              g.strokeStyle = '#3a2a1e';
              g.lineWidth = 5;
              for (let c = 0; c < 4; c++)
                for (let r = 0; r < 4; r++) {
                  if ((c + r) % 2) continue;
                  g.beginPath();
                  g.moveTo(c * bay, r * floor + floor);
                  g.lineTo(c * bay + bay * 0.22, r * floor + floor * 0.62);
                  g.moveTo(c * bay + bay, r * floor + floor);
                  g.lineTo(c * bay + bay * 0.78, r * floor + floor * 0.62);
                  g.stroke();
                }
            }
            if (F.bands) {
              g.fillStyle = F.bands;
              for (let r = 0; r < 4; r++) g.fillRect(0, r * floor + floor * 0.84, s, floor * 0.05);
            }
          }
          // Windows, one per bay per storey.
          const [wx, ww, wy, wh] = F.win;
          for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++) {
              const x = c * bay + bay * wx,
                w = bay * ww,
                y = r * floor + floor * wy,
                h = floor * wh;
              if (lit) {
                if (isleRandom() > F.lit) continue;
                const warm = isleRandom() < 0.8,
                  grad = g.createLinearGradient(x, y, x, y + h);
                grad.addColorStop(0, warm ? '#fff0c8' : '#dce8ff');
                grad.addColorStop(1, warm ? '#f0b870' : '#9fb8e0');
                g.fillStyle = grad;
                g.globalAlpha = 0.55 + isleRandom() * 0.45;
                g.fillRect(x + 2, y + 2, w - 4, h - 4);
                // Half-drawn blinds and curtains.
                if (isleRandom() < 0.4) {
                  g.fillStyle = '#000';
                  g.globalAlpha = 0.6;
                  g.fillRect(x + 2, y + 2, w - 4, h * (0.2 + isleRandom() * 0.4));
                }
                g.globalAlpha = 1;
                continue;
              }
              // Surround, then the glass with a sky gradient and a glint.
              g.fillStyle = F.frame;
              if (F.arch) {
                g.beginPath();
                g.moveTo(x - 3, y + h + 3);
                g.lineTo(x - 3, y + w / 2);
                g.arc(x + w / 2, y + w / 2, w / 2 + 3, Math.PI, 0);
                g.lineTo(x + w + 3, y + h + 3);
                g.fill();
              } else g.fillRect(x - 3, y - 3, w + 6, h + 6);
              const grad = g.createLinearGradient(x, y, x, y + h);
              grad.addColorStop(0, F.glass[0]);
              grad.addColorStop(1, F.glass[1]);
              g.fillStyle = grad;
              if (F.arch) {
                g.beginPath();
                g.moveTo(x, y + h);
                g.lineTo(x, y + w / 2);
                g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
                g.lineTo(x + w, y + h);
                g.fill();
              } else g.fillRect(x, y, w, h);
              g.fillStyle = 'rgba(255,255,255,0.12)';
              g.fillRect(x, y, w, h * 0.12);
              // Glazing bars: sash grids or a single mullion.
              g.fillStyle = F.frame;
              if (F.bars) {
                g.fillRect(x, y + h / 2 - 1, w, 2);
                g.fillRect(x + w / 2 - 1, y, 2, h);
                g.fillRect(x, y + h / 4, w, 1);
                g.fillRect(x, y + (h * 3) / 4, w, 1);
              } else if (ww < 0.6) g.fillRect(x + w / 2 - 1, y, 2, h);
              else for (let k = 1; k < 4; k++) g.fillRect(x + (w * k) / 4 - 1, y, 2, h);
              if (F.shutters) {
                g.fillStyle = F.shutters;
                g.fillRect(x - w * 0.42, y, w * 0.36, h);
                g.fillRect(x + w + w * 0.06, y, w * 0.36, h);
              }
              if (F.balcony === 'iron' && r % 2 === 0) {
                g.fillStyle = '#23272b';
                g.fillRect(x - 6, y + h - h * 0.28, w + 12, 2);
                g.fillRect(x - 6, y + h, w + 12, 3);
                for (let k = x - 5; k < x + w + 6; k += 4) g.fillRect(k, y + h - h * 0.28, 1, h * 0.28);
              } else if (F.balcony === 'glass') {
                g.fillStyle = 'rgba(190,220,228,0.45)';
                g.fillRect(x - 4, y + h - h * 0.3, w + 8, h * 0.3);
                g.fillStyle = F.frame;
                g.fillRect(x - 4, y + h - h * 0.3, w + 8, 2);
              }
            }
          if (!lit && F.cornice) {
            g.fillStyle = F.cornice;
            for (let r = 0; r < 4; r++) g.fillRect(0, r * floor, s, 4);
            g.fillStyle = 'rgba(0,0,0,0.12)';
            for (let r = 0; r < 4; r++) g.fillRect(0, r * floor + 4, s, 2);
          }
        });
      }
      function isleFacade(style) {
        if (isleFacadeMaterials.has(style)) return isleFacadeMaterials.get(style);
        const material = new Three.MeshStandardMaterial({
          map: paintIsleFacade(style, false),
          emissive: '#ffd9a6',
          emissiveMap: paintIsleFacade(style, true),
          emissiveIntensity: 0,
          roughness: style === 'harbour' || style === 'villaGlass' || style === 'showroom' ? 0.35 : 0.85,
          metalness: style === 'villaGlass' || style === 'showroom' ? 0.35 : 0.02,
        });
        material.onBeforeCompile = cityMaterialPatch;
        material.customProgramCacheKey = () => 'isle-facade';
        isleFacadeMaterials.set(style, material);
        isleWindowMaterials.push(material);
        return material;
      }
      /* Four walls of a box from y0 to y1, UV-mapped in world units (u along the
         perimeter, v up from `v0`), as one geometry at world coordinates. */
      function isleWallGeometry(x0, z0, x1, z1, y0, y1, v0 = 0, faces = [true, true, true, true]) {
        const positions = [],
          normals = [],
          uvs = [],
          corners = [
            [x0, z1, 0, 1],
            [x1, z1, 1, 0],
            [x1, z0, 0, -1],
            [x0, z0, -1, 0],
          ];
        let u = 0;
        for (let i = 0; i < 4; i++) {
          const [ax, az, nx, nz] = corners[i],
            [bx, bz] = corners[(i + 1) % 4],
            len = Math.hypot(bx - ax, bz - az);
          // South face (i 0) runs west to east; normals out of the box.
          const normal = i === 0 ? [0, 0, 1] : i === 1 ? [1, 0, 0] : i === 2 ? [0, 0, -1] : [-1, 0, 0];
          void nx;
          void nz;
          if (faces[i]) {
            const ua = u / ISLE_TILE_W,
              ub = (u + len) / ISLE_TILE_W,
              va = (y0 - v0) / ISLE_TILE_H,
              vb = (y1 - v0) / ISLE_TILE_H;
            const quad = [
              [ax, y0, az, ua, va],
              [bx, y0, bz, ub, va],
              [bx, y1, bz, ub, vb],
              [ax, y0, az, ua, va],
              [bx, y1, bz, ub, vb],
              [ax, y1, az, ua, vb],
            ];
            for (const [px, py, pz, pu, pv] of quad) {
              positions.push(px, py, pz);
              normals.push(...normal);
              uvs.push(pu, pv);
            }
          }
          u += len;
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new Three.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        return geo;
      }
      // Roof finishes (shared, textured).
      const isleRoofMaterials = {
        gravel: new Three.MeshStandardMaterial({ map: ROOF_TEXTURES.gravel, color: '#b8b4aa', roughness: 0.95 }),
        pavers: new Three.MeshStandardMaterial({ map: ROOF_TEXTURES.pavers || ROOF_TEXTURES.gravel, color: '#e2dccd', roughness: 0.9 }),
        green: new Three.MeshStandardMaterial({ map: ROOF_TEXTURES.green, roughness: 0.95 }),
      };
      function isleRoofCap(x0, z0, x1, z1, y, material) {
        const geo = new Three.PlaneGeometry(x1 - x0, z1 - z0),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (x1 - x0)) / 96, (uv.getY(i) * (z1 - z0)) / 96);
        const m = isleMesh(geo, material, (x0 + x1) / 2, y, (z0 + z1) / 2);
        m.rotation.x = -Math.PI / 2;
        return m;
      }
      /* A hipped roof over a rectangle: eaves at y, ridge `rise` above, overhang `eave`. */
      function isleHipRoof(x0, z0, x1, z1, y, rise, material, eave = 3) {
        x0 -= eave;
        z0 -= eave;
        x1 += eave;
        z1 += eave;
        const w = x1 - x0,
          d = z1 - z0,
          inset = Math.min(w, d) / 2,
          alongX = w >= d,
          cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2,
          bottom = [
            [x0, z0],
            [x1, z0],
            [x1, z1],
            [x0, z1],
          ],
          top = alongX
            ? [
                [x0 + inset, cz],
                [x1 - inset, cz],
                [x1 - inset, cz],
                [x0 + inset, cz],
              ]
            : [
                [cx, z0 + inset],
                [cx, z0 + inset],
                [cx, z1 - inset],
                [cx, z1 - inset],
              ];
        const m = isleMesh(prismGeometry(bottom, top, y, y + rise, false), material, 0, 0, 0, 1, 1, 1, isleRoot(cx, cz));
        // The soffit under the eaves.
        isleBox(cx, y - 0.4, cz, w, 0.8, d, ISLE.white);
        return m;
      }
      /* A gabled roof, ridge along x (or z), gable ends closed in wall colour. */
      function isleGableRoof(x0, z0, x1, z1, y, rise, material, wallMaterial, alongX = true, eave = 3) {
        const cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2;
        x0 -= eave;
        z0 -= eave;
        x1 += eave;
        z1 += eave;
        const bottom = [
            [x0, z0],
            [x1, z0],
            [x1, z1],
            [x0, z1],
          ],
          top = alongX
            ? [
                [x0, cz],
                [x1, cz],
                [x1, cz],
                [x0, cz],
              ]
            : [
                [cx, z0],
                [cx, z0],
                [cx, z1],
                [cx, z1],
              ];
        isleMesh(prismGeometry(bottom, top, y, y + rise, false), material, 0, 0, 0, 1, 1, 1, isleRoot(cx, cz));
        // Gable end triangles.
        const tri = (pts) => {
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.Float32BufferAttribute(pts.flat(), 3));
          geo.computeVertexNormals();
          return isleMesh(geo, wallMaterial, 0, 0, 0, 1, 1, 1, isleRoot(cx, cz));
        };
        if (alongX)
          for (const x of [x0 + eave, x1 - eave])
            tri([
              [x, y, z0 + eave],
              [x, y, z1 - eave],
              [x, y + rise * ((z1 - z0 - 2 * eave) / (z1 - z0)), cz],
            ]);
        else
          for (const z of [z0 + eave, z1 - eave])
            tri([
              [x0 + eave, y, z],
              [x1 - eave, y, z],
              [cx, y + rise * ((x1 - x0 - 2 * eave) / (x1 - x0)), z],
            ]);
      }
      /* A mansard storey: sloping zinc walls from the cornice to a flat top, dormers on the south face. */
      function isleMansard(x0, z0, x1, z1, y, height, material, dormers = true) {
        const inset = height * 0.42,
          bottom = [
            [x0 - 1, z0 - 1],
            [x1 + 1, z0 - 1],
            [x1 + 1, z1 + 1],
            [x0 - 1, z1 + 1],
          ],
          top = [
            [x0 + inset, z0 + inset],
            [x1 - inset, z0 + inset],
            [x1 - inset, z1 - inset],
            [x0 + inset, z1 - inset],
          ];
        isleMesh(prismGeometry(bottom, top, y, y + height, false), material, 0, 0, 0, 1, 1, 1, isleRoot((x0 + x1) / 2, (z0 + z1) / 2));
        isleRoofCap(x0 + inset, z0 + inset, x1 - inset, z1 - inset, y + height, isleRoofMaterials.gravel);
        if (!dormers) return;
        // Dormers every bay along the south face (the camera's side), and the north.
        for (const [z, dir] of [
          [z1, 1],
          [z0, -1],
        ])
          for (let x = x0 + ISLE_BAY * 0.7; x < x1 - ISLE_BAY * 0.4; x += ISLE_BAY) {
            const dz = z - dir * inset * 0.45;
            isleBox(x, y + height * 0.46, dz, 6.4, height * 0.62, 7, ISLE.cream);
            isleBox(x, y + height * 0.44, dz + dir * 3.6, 4.2, height * 0.42, 0.4, ISLE.glass);
            const cap = isleBox(x, y + height * 0.8, dz, 7.2, 1.2, 8, material);
            cap.rotation.x = dir * 0.2;
          }
      }
      /* ---- Town blocks ---------------------------------------------------------------- */
      const ISLE_ROOF_STYLE = {
        limestone: 'mansard',
        hotel: 'mansard',
        arcade: 'mansard',
        mansion: 'mansard',
        bank: 'balustrade',
        podium: 'terrace',
        townhouse: 'slate',
        townhouseBrick: 'slate',
        mansionLight: 'terrace',
        harbour: 'terrace',
        clinic: 'terrace',
        spa: 'garden',
        restaurant: 'terrace',
        police: 'flat',
        academy: 'slate',
        clubhouse: 'gable',
        chapel: 'chapel',
        showroom: 'flat',
        fuel: 'flat',
      };
      function buildIsleBuilding(b) {
        const style = b.facade || 'mansion',
          face = isleFacade(ISLE_FACADES[style] ? style : 'mansion'),
          x0 = b.x,
          z0 = b.y,
          x1 = b.x + b.w,
          z1 = b.y + b.h,
          cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2,
          roofStyle = ISLE_ROOF_STYLE[style] || 'flat',
          mansard = roofStyle === 'mansard' && b.height > 3 * STOREY,
          // A mansard is the top storey, drawn as its own roof.
          wallTop = mansard ? b.height - STOREY : b.height,
          shop = !!b.shop,
          ground = shop ? SHOP_FLOOR : 0,
          root = isleRoot(cx, cz);
        // Upper walls from the ground floor (or the pavement) up.
        isleMesh(isleWallGeometry(x0, z0, x1, z1, ground, wallTop, ground), face, 0, 0, 0, 1, 1, 1, root);
        // A stone base course and a projecting cornice.
        isleBox(cx, 1.2, cz, b.w + 1.6, 2.4, b.h + 1.6, ISLE_FACADES[style]?.brick ? ISLE.stoneDark : ISLE.stoneWarm, root);
        const corniceColor = tint(ISLE_FACADES[style]?.cornice || '#e2d8c2', 'matte');
        isleBox(cx, wallTop + 1.1, cz, b.w + 3.2, 2.2, b.h + 3.2, corniceColor, root);
        if (shop) buildIsleShopfront(b, root);
        else if (ground === 0 && style !== 'showroom') {
          // A plinth storey line and the front door on the south face.
          isleBox(cx, SHOP_FLOOR, cz, b.w + 1, 1, b.h + 1, corniceColor, root);
          isleDoorway(cx, z1, root, style);
        }
        switch (roofStyle) {
          case 'mansard':
            if (mansard) isleMansard(x0, z0, x1, z1, wallTop + 2.2, STOREY, ISLE.zinc);
            else isleRoofCap(x0, z0, x1, z1, wallTop + 2.25, isleRoofMaterials.gravel);
            // Chimney stacks along the ridge.
            for (let x = x0 + 30; x < x1 - 20; x += 64) isleBox(x, b.height + 6, cz, 7, 12, 5, ISLE.cream, root);
            break;
          case 'slate': {
            const along = b.w >= b.h;
            isleGableRoof(x0, z0, x1, z1, wallTop + 2.2, Math.min(b.w, b.h) * 0.36, ISLE.slate, corniceColor, along, 1.5);
            // Party-wall chimneys.
            for (let x = x0 + 4; x <= x1 - 4; x += Math.max(40, b.w)) isleBox(x, wallTop + Math.min(b.w, b.h) * 0.3, cz, 6, 16, 12, ISLE_FACADES[style]?.brick ? ISLE.brick : ISLE.cream, root);
            break;
          }
          case 'gable':
            isleGableRoof(x0, z0, x1, z1, wallTop + 2.2, Math.min(b.w, b.h) * 0.42, ISLE.slate, ISLE.white, b.w >= b.h, 4);
            break;
          case 'balustrade':
            isleRoofCap(x0, z0, x1, z1, wallTop + 2.25, isleRoofMaterials.pavers);
            isleBalustrade(x0, z0, x1, z1, wallTop + 2.2, root);
            break;
          case 'terrace':
          case 'garden':
            isleRoofCap(x0 + 2, z0 + 2, x1 - 2, z1 - 2, wallTop + 2.25, roofStyle === 'garden' ? isleRoofMaterials.green : isleRoofMaterials.pavers);
            isleRoofTerrace(b, wallTop + 2.2, root);
            break;
          case 'chapel':
            break;
          default:
            isleRoofCap(x0, z0, x1, z1, wallTop + 2.25, isleRoofMaterials.gravel);
            isleBox(cx, wallTop + 4, cz, Math.min(40, b.w * 0.3), 6, Math.min(30, b.h * 0.3), ISLE.stoneDark, root);
        }
      }
      // A stone balustrade round a roof edge (the bank, the club).
      function isleBalustrade(x0, z0, x1, z1, y, root) {
        for (const [ax, az, bx, bz] of [
          [x0, z1, x1, z1],
          [x0, z0, x1, z0],
          [x0, z0, x0, z1],
          [x1, z0, x1, z1],
        ]) {
          const len = Math.hypot(bx - ax, bz - az),
            along = ax !== bx;
          isleBox((ax + bx) / 2, y + 7.2, (az + bz) / 2, along ? len : 2.6, 1.2, along ? 2.6 : len, ISLE.stone, root);
          isleBox((ax + bx) / 2, y + 0.8, (az + bz) / 2, along ? len : 2.4, 1.6, along ? 2.4 : len, ISLE.stone, root);
          for (let d = 2; d < len; d += 4) {
            const t = d / len;
            isleBox(ax + (bx - ax) * t, y + 4, az + (bz - az) * t, 1.3, 5, 1.3, ISLE.stone, root);
          }
        }
      }
      // Roof terraces: glass balustrade, timber decking, planters, a pergola and loungers.
      function isleRoofTerrace(b, y, root) {
        const x0 = b.x + 3,
          z0 = b.y + 3,
          x1 = b.x + b.w - 3,
          z1 = b.y + b.h - 3;
        for (const [ax, az, bx, bz] of [
          [x0, z1, x1, z1],
          [x0, z0, x1, z0],
          [x0, z0, x0, z1],
          [x1, z0, x1, z1],
        ]) {
          const along = ax !== bx,
            len = along ? bx - ax : bz - az;
          isleBox((ax + bx) / 2, y + 4.5, (az + bz) / 2, along ? len : 0.5, 7, along ? 0.5 : len, ISLE.glassRail, root);
          isleBox((ax + bx) / 2, y + 8.2, (az + bz) / 2, along ? len : 1, 0.7, along ? 1 : len, ISLE.chrome, root);
        }
        const w = x1 - x0,
          d = z1 - z0;
        if (w < 60 || d < 50) return;
        // Deck and a pergola over it on the sunny side.
        isleBox(x0 + w * 0.3, y + 0.4, z1 - d * 0.28, w * 0.5, 0.8, d * 0.42, ISLE.teak, root);
        const px = x0 + w * 0.3,
          pz = z1 - d * 0.28,
          pw = w * 0.42,
          pd = d * 0.3;
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) isleBox(px + (dx * pw) / 2, y + 11, pz + (dz * pd) / 2, 1.4, 22, 1.4, ISLE.white, root);
        for (let k = -pw / 2; k <= pw / 2; k += 5) isleBox(px + k, y + 22, pz, 0.8, 1.2, pd + 4, ISLE.white, root);
        for (let k = 0; k < 3; k++) {
          const l = lounger(root, px - pw * 0.3 + k * 16, pz + pd * 0.1, y + 0.8, 16, 7, ISLE.canvas, ISLE.teak);
          l.rotation.y = Math.PI / 2;
        }
        // Planters with clipped olives along the parapet.
        for (let x = x0 + 14; x < x1 - 10; x += 28) {
          isleBox(x, y + 3, z1 - 5, 10, 6, 6, ISLE.stoneDark, root);
          isleMesh(sphereGeo, ISLE.hedge, x, y + 11, z1 - 5, 5, 5, 5, root);
        }
        // Rooftop plant, tucked at the back.
        isleBox(x1 - w * 0.2, y + 5, z0 + d * 0.2, Math.min(34, w * 0.25), 10, Math.min(26, d * 0.25), ISLE.stoneDark, root);
        roofKeepOutIsle(b, x1 - w * 0.2, z0 + d * 0.2, 38, 30);
        // A small plunge pool on the grander terraces.
        if (w > 150 && d > 110) pool(root, x0 + w * 0.72, z1 - d * 0.3, y + 0.2, 44, 16);
      }
      function roofKeepOutIsle(b, x, z, w, d) {
        (b.roofKeepOuts || (b.roofKeepOuts = [])).push({ x, y: z, hx: w / 2, hy: d / 2, a: 0 });
      }
      // A front door with a stone surround, a fanlight and two steps.
      function isleDoorway(x, zFace, root, style) {
        const dark = style === 'townhouse' || style === 'townhouseBrick' ? ISLE.black : ISLE.navy;
        isleBox(x, DOOR_HEIGHT / 2 + 1.6, zFace + 0.5, 9.4, DOOR_HEIGHT + 3.2, 1.2, ISLE.stone, root);
        isleBox(x, DOOR_HEIGHT / 2 + 1, zFace + 1.2, 7, DOOR_HEIGHT, 0.4, dark, root);
        isleBox(x, DOOR_HEIGHT + 2.4, zFace + 1.2, 7, 2, 0.3, ISLE.glass, root);
        isleBox(x + 2.4, DOOR_HEIGHT / 2 + 1, zFace + 1.5, 0.5, 0.5, 0.5, ISLE.brass, root);
        isleBox(x, 0.5, zFace + 3, 12, 1, 4, ISLE.stone, root);
        isleBox(x, 1.4, zFace + 1.8, 11, 1, 2.4, ISLE.stone, root);
        // Lanterns either side.
        for (const dx of [-6.2, 6.2]) {
          isleBox(x + dx, DOOR_HEIGHT + 0.8, zFace + 1.8, 1.4, 2.2, 1.4, ISLE.iron, root);
          kitLight(isleLights, root, x + dx, DOOR_HEIGHT + 0.8, zFace + 2.2, '#ffd9a0');
        }
      }
      /* The ground floor of a shop unit: stone piers, plate glass, a recessed door,
         the fascia with the business's sign, and an awning or canopy by trade. */
      const ISLE_AWNINGS = {
        cafe: ['#6b2a22', '#efe6d3'],
        gelato: ['#f2b6c6', '#ffffff'],
        florist: ['#355a3a', '#efe6d3'],
        grocer: ['#1f3d2c', '#e8dcc0'],
        wine: ['#4a1420', '#e8d6b0'],
        seafood: ['#12324a', '#ffffff'],
        fashion: ['#1c1c1e', '#1c1c1e'],
        restaurant: ['#0c0c10', '#0c0c10'],
        bar: ['#101012', '#c9a24e'],
        chandlery: ['#1d3f6e', '#ffffff'],
      };
      const isleAwningMaterials = new Map();
      function isleAwningMaterial(colors) {
        const key = colors.join('|');
        if (!isleAwningMaterials.has(key)) {
          const tx = isleCanvasTexture(64, (g, s) => {
            g.fillStyle = colors[0];
            g.fillRect(0, 0, s, s);
            g.fillStyle = colors[1];
            if (colors[1] !== colors[0]) for (let x = 0; x < s; x += 16) g.fillRect(x + 8, 0, 8, s);
          });
          isleAwningMaterials.set(key, new Three.MeshStandardMaterial({ map: tx, roughness: 0.9, side: Three.DoubleSide }));
        }
        return isleAwningMaterials.get(key);
      }
      function buildIsleShopfront(b, root) {
        const face = b.y + b.h,
          x0 = b.x,
          x1 = b.x + b.w,
          cx = (x0 + x1) / 2,
          bays = Math.max(2, Math.round(b.w / ISLE_BAY)),
          bayW = b.w / bays,
          trade = b.trade,
          dark = ISLE_FACADES[b.facade]?.brick ? ISLE.stoneDark : ISLE.stoneWarm;
        // The other three faces of the ground floor: rusticated stone.
        isleMesh(isleWallGeometry(x0, b.y, x1, face, 0, SHOP_FLOOR, 0, [false, true, true, true]), isleFacade('limestone'), 0, 0, 0, 1, 1, 1, root);
        // Back wall of the shop, set in, and the lit interior behind the glass.
        isleBox(cx, SHOP_FLOOR / 2, face - 3, b.w - 2, SHOP_FLOOR, 1, tint('#3a3128', 'matte'), root);
        const doorBay = Math.floor(bays / 2);
        for (let k = 0; k < bays; k++) {
          const x = x0 + bayW * (k + 0.5);
          // Piers between the bays.
          isleBox(x0 + bayW * k, SHOP_FLOOR / 2, face + 0.4, 3.2, SHOP_FLOOR, 2.4, dark, root);
          if (k === doorBay) {
            isleBox(x, DOOR_HEIGHT / 2 + 0.5, face - 1.4, bayW * 0.5, DOOR_HEIGHT, 0.4, shopGlassMaterial, root);
            isleBox(x, DOOR_HEIGHT + 0.8, face - 1.2, bayW * 0.56, 0.8, 0.8, ISLE.brass, root);
            isleBox(x, 0.3, face + 1.5, bayW * 0.6, 0.6, 4, ISLE.stone, root);
            continue;
          }
          const pane = isleBox(x, SHOP_FLOOR * 0.42 + 1.2, face - 0.2, bayW - 4, SHOP_FLOOR * 0.72, 0.5, shopGlassMaterial, root);
          pane.userData.isleShopPane = true;
          (b.shopPanes || (b.shopPanes = [])).push({ x0: x - (bayW - 4) / 2, x1: x + (bayW - 4) / 2, cx: x, width: bayW - 4, face: face + 0.1, state: 0, hits: 0 });
          // Stallriser and a brass rail.
          isleBox(x, 1.4, face + 0.2, bayW - 3, 2.8, 1, dark, root);
          isleBox(x, SHOP_FLOOR * 0.8, face + 0.1, bayW - 4, 0.5, 0.8, ISLE.brass, root);
          // Display inside: plinths, rails, mannequins or shelves by trade.
          isleShopDisplay(trade, x, face - 2.5, bayW - 6, root);
        }
        isleBox(x1 - 1.6, SHOP_FLOOR / 2, face + 0.4, 3.2, SHOP_FLOOR, 2.4, dark, root);
        // Fascia and the sign (the island's own designs, SIGN_DESIGNS).
        const signW = Math.min(b.w * 0.72, 46),
          signH = signW / 4,
          fasciaY = SHOP_FLOOR + signH / 2 + 1.4;
        isleBox(cx, fasciaY, face + 0.8, b.w, signH + 2.4, 1.6, tint(b.trade === 'restaurant' ? '#0c0c10' : '#23262a', 'satin'), root);
        atlasSign(root, shopSignCell(b.shop), cx, fasciaY, face + 1.7, signW, signH, neonBoard);
        signSpill(cx, face + 16, signW * 0.7, shopSignLight(b.shop), 0.35);
        // Awning, canopy or nothing, by trade.
        const colors = ISLE_AWNINGS[trade];
        if (colors) {
          const deep = trade === 'restaurant' || trade === 'fashion' || trade === 'bar' ? 10 : 12,
            awning = isleMesh(new Three.PlaneGeometry(b.w - 4, deep), isleAwningMaterial(colors), cx, SHOP_FLOOR - 1.5, face + deep / 2 - 0.5, 1, 1, 1, root);
          awning.rotation.x = -Math.PI / 2 + 0.38;
          // The valance.
          isleBox(cx, SHOP_FLOOR - 3.6 - deep * 0.35, face + deep - 1.2, b.w - 4, 2.2, 0.3, isleAwningMaterial([colors[0], colors[0]]), root);
          registerOverheadCover(cx, face + deep / 2, (b.w - 4) / 2, deep / 2, 0, SHOP_FLOOR - 6, SHOP_FLOOR, 'awning');
        }
        if (trade === 'hotel' || trade === 'bank' || trade === 'jewellery' || trade === 'watches') {
          // A bronze-and-glass canopy on tie rods over the door.
          const dx = x0 + bayW * (doorBay + 0.5);
          isleBox(dx, SHOP_FLOOR - 2, face + 7, bayW * 1.4, 1.2, 14, ISLE.brass, root);
          isleBox(dx, SHOP_FLOOR - 1.2, face + 7, bayW * 1.36, 0.3, 13.4, ISLE.glassRail, root);
          for (const s of [-1, 1]) rod(root, new Three.Vector3(dx + s * bayW * 0.6, SHOP_FLOOR + 6, face + 1), new Three.Vector3(dx + s * bayW * 0.6, SHOP_FLOOR - 2, face + 13), 0.3, ISLE.brass);
          registerOverheadCover(dx, face + 7, bayW * 0.7, 7, 0, SHOP_FLOOR - 3, SHOP_FLOOR, 'entrance canopy');
          // Box topiaries at the door.
          for (const s of [-1, 1]) {
            isleBox(dx + s * bayW * 0.55, 2.4, face + 3.5, 5, 4.8, 5, ISLE.stoneDark, root);
            isleMesh(new Three.ConeGeometry(3, 12, 10), ISLE.hedge, dx + s * bayW * 0.55, 11, face + 3.5, 1, 1, 1, root);
          }
        }
        // Lit windows at night.
        for (let k = 0; k < bays; k += 2) kitLight(isleLights, root, x0 + bayW * (k + 0.5), SHOP_FLOOR * 0.6, face + 1.5, '#ffe2b8');
      }
      function isleShopDisplay(trade, x, z, w, root) {
        const plinth = tint('#e9e2d4', 'satin');
        if (trade === 'fashion' || trade === 'tailor') {
          for (const dx of [-w * 0.25, w * 0.25]) {
            isleBox(x + dx, 1, z, 5, 2, 5, plinth, root);
            isleMesh(cylinderGeo, tint(islePick(['#1c1c1e', '#8a6d4a', '#e8e2d6', '#6b2f36']), 'matte'), x + dx, 8, z, 1.8, 10, 1.4, root);
            isleMesh(sphereGeo, tint('#e8e2d6', 'satin'), x + dx, 14.2, z, 1.1, 1.3, 1.1, root);
          }
        } else if (trade === 'jewellery' || trade === 'watches') {
          isleBox(x, 4, z, w * 0.7, 8, 4, tint('#1b1b1f', 'satin'), root);
          isleBox(x, 8.4, z, w * 0.66, 0.6, 3.6, ISLE.gold, root);
          kitLight(isleLights, root, x, 9, z + 1, '#fff4dc');
        } else if (trade === 'grocer' || trade === 'florist' || trade === 'gelato') {
          for (let k = -1; k <= 1; k++) isleBox(x + (k * w) / 3.2, 3 + Math.abs(k), z, w / 4, 2, 4, tint(trade === 'florist' ? islePick(['#d85a78', '#f2c84a', '#e8e2f0', '#b04a8a']) : islePick(['#d86a3a', '#e8c24a', '#6aa04a', '#c8403a']), 'matte'), root);
        } else if (trade === 'cars') {
          // Handled by the showroom.
        } else {
          isleBox(x, 5, z, w * 0.5, 0.6, 3, plinth, root);
        }
      }
      // END SUBSYSTEM: src/monarch3d.js
