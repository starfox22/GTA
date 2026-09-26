      // BEGIN SUBSYSTEM: src/dealership3d.js — MONARCH MOTORS in 3D
      /**
       * MONARCH MOTORS in 3D
       * Source: src/dealership3d.js
       * Scope: createCityRenderer() closure, after monarch-streets3d.js (it uses
       * the island's kit: tint, kitMerge, the glow field, the island's light map).
       *
       * Built from dealership.js's DEALER plan, in world coordinates:
       *   HALL      a polished travertine floor (large slabs, grey veins, a low
       *             roughness so the sky and the lights slide over it), stone side
       *             and back walls, the glass frontage (one instanced draw of 3 m
       *             panes with bronze mullions) with sliding doors and a rising
       *             vehicle door, the brand walls (backlit panels: WALTER MARTIN's
       *             green, CHEVETTE's black and gold, MUGATTI's blue) under the
       *             mezzanine gallery and its glass balustrade, the stair along the
       *             east wall, the VIP lounge (cream sofas, a rug, a black marble bar
       *             with a lit bottle wall, pendant lamps), the freestanding
       *             configurator wall (a live LED screen) and its kiosk, the curved
       *             reception desk, the DELIVERY SUITE (stage turntable, LED
       *             backdrop, velvet curtain on a track, service desk), the hero
       *             dais under the oculus, and a placard on a stand by every car.
       *   ROOF      a thin white canopy whose front edge waves out over the
       *             forecourt, with the oculus over the hero and two skylight
       *             strips: hidden while the player is inside (or the purchase card
       *             or the delivery is on), so the showroom reads from above.
       *   FORECOURT podiums with LED rings, planters with clipped box, six flags,
       *             the lit pylon, bay posts; the lane and bays are painted in the
       *             ground sheet (dealership.js).
       *   MOVING    turntable discs and their LED rims follow their cars (two
       *             instanced draws), light pools under the cars, light cones on the
       *             hero, the curtain's folds, the doors, the security shutters and
       *             the broken panes' shards, the screens.
       *   NIGHT     the glass box glows warm, pools of light in the island's light
       *             map under every car and along the frontage, rim LEDs, the signs.
       *
       * Draw calls: the static hall merges into about ten (kitMerge per finish,
       * plus the floor, the brand walls, the placards and the signs), the roof
       * three, the moving parts about fourteen.
       */
      const dealerVisual = { built: false, roofShown: true, screenAt: -1, screenIndex: 0, curtain: 1, doorPeople: 0, doorCars: 0, shutter: -1, broken: 0 };
      // ---- Canvases --------------------------------------------------------------------
      function dealerCanvas(w, h, paint) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        paint(c.getContext('2d'), w, h);
        return c;
      }
      function dealerTexture(canvas, repeat = false) {
        const t = new Three.CanvasTexture(canvas);
        t.colorSpace = Three.SRGBColorSpace;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        if (repeat) t.wrapS = t.wrapT = Three.RepeatWrapping;
        return t;
      }
      // Large-format travertine slabs with soft grey veins and hairline joints.
      function dealerFloorCanvas() {
        return dealerCanvas(1024, 1024, (g, w, h) => {
          let seed = 91;
          const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
          for (let j = 0; j < 4; j++)
            for (let i = 0; i < 4; i++) {
              const tone = 232 + Math.round(rnd() * 10);
              g.fillStyle = `rgb(${tone},${tone - 4},${tone - 12})`;
              g.fillRect(i * 256, j * 256, 256, 256);
              // Veins: a few long soft curves per slab.
              for (let v = 0; v < 4; v++) {
                g.strokeStyle = `rgba(${150 + rnd() * 40},${148 + rnd() * 36},${140 + rnd() * 30},${0.12 + rnd() * 0.2})`;
                g.lineWidth = 0.6 + rnd() * 2.2;
                g.beginPath();
                let x = i * 256 + rnd() * 256,
                  y = j * 256;
                g.moveTo(x, y);
                for (let s = 0; s < 6; s++) {
                  const nx = x + (rnd() - 0.5) * 90,
                    ny = y + 256 / 6;
                  g.quadraticCurveTo(x + (rnd() - 0.5) * 60, (y + ny) / 2, nx, ny);
                  x = nx;
                  y = ny;
                }
                g.stroke();
              }
              // Travertine pits.
              for (let k = 0; k < 60; k++) {
                g.fillStyle = `rgba(160,150,132,${0.08 + rnd() * 0.12})`;
                g.fillRect(i * 256 + rnd() * 256, j * 256 + rnd() * 256, 1 + rnd() * 5, 0.6 + rnd());
              }
            }
          g.strokeStyle = 'rgba(120,112,98,0.55)';
          g.lineWidth = 2;
          for (let k = 0; k <= 4; k++) {
            g.beginPath();
            g.moveTo(k * 256, 0);
            g.lineTo(k * 256, h);
            g.moveTo(0, k * 256);
            g.lineTo(w, k * 256);
            g.stroke();
          }
        });
      }
      // The three brand walls in one atlas (rows of 1024 x 256).
      function dealerBrandCanvas() {
        return dealerCanvas(1024, 768, (g) => {
          const row = (k, paint) => {
            g.save();
            g.translate(0, k * 256);
            paint(g);
            g.restore();
          };
          const wordmark = (text, x, y, size, color, spacing, weight = '300') => {
            g.font = `${weight} ${size}px 'Helvetica Neue', Arial, sans-serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
            g.fillStyle = color;
            g.fillText(text, x, y);
            if ('letterSpacing' in g) g.letterSpacing = '0px';
          };
          // WALTER MARTIN: racing green, silver wings, a lime rule.
          row(0, (c) => {
            const grad = c.createLinearGradient(0, 0, 0, 256);
            grad.addColorStop(0, '#0e5a45');
            grad.addColorStop(1, '#062a20');
            c.fillStyle = grad;
            c.fillRect(0, 0, 1024, 256);
            c.strokeStyle = '#d9dee2';
            c.lineWidth = 5;
            for (const s of [-1, 1]) {
              c.beginPath();
              c.moveTo(512 + s * 18, 92);
              c.quadraticCurveTo(512 + s * 90, 70, 512 + s * 170, 62);
              c.moveTo(512 + s * 18, 104);
              c.quadraticCurveTo(512 + s * 80, 90, 512 + s * 140, 86);
              c.stroke();
            }
            c.fillStyle = '#d9dee2';
            c.beginPath();
            c.arc(512, 96, 16, 0, TAU);
            c.fill();
            wordmark('WALTER MARTIN', 512, 168, 48, '#eef1f3', 14);
            c.fillStyle = '#b6f02c';
            c.fillRect(372, 212, 280, 3);
          });
          // CHEVETTE: black, crossed flags in gold, the wordmark.
          row(1, (c) => {
            c.fillStyle = '#101113';
            c.fillRect(0, 0, 1024, 256);
            for (const s of [-1, 1]) {
              c.save();
              c.translate(512, 88);
              c.rotate(s * 0.55);
              c.fillStyle = '#b8b9bb';
              c.fillRect(-2, -40, 4, 80);
              c.fillStyle = s < 0 ? '#e6e6e2' : '#c8102e';
              c.fillRect(s < 0 ? 2 : -34, -40, 32, 22);
              if (s < 0) {
                c.fillStyle = '#111';
                for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) c.fillRect(2 + x * 8, -40 + y * 7.3, 8, 7.3);
              }
              c.restore();
            }
            wordmark('CHEVETTE', 512, 170, 56, '#f2c21b', 22, '800');
            c.fillStyle = '#f2c21b';
            c.fillRect(0, 250, 1024, 6);
          });
          // MUGATTI: deep blue, the red oval, the wordmark in ivory.
          row(2, (c) => {
            const grad = c.createLinearGradient(0, 0, 1024, 0);
            grad.addColorStop(0, '#0a1f4c');
            grad.addColorStop(0.5, '#123a80');
            grad.addColorStop(1, '#0a1f4c');
            c.fillStyle = grad;
            c.fillRect(0, 0, 1024, 256);
            c.fillStyle = '#c8102e';
            c.beginPath();
            c.ellipse(512, 92, 64, 36, 0, 0, TAU);
            c.fill();
            c.strokeStyle = '#e8e4da';
            c.lineWidth = 4;
            c.stroke();
            c.fillStyle = '#e8e4da';
            c.font = "700 30px 'Helvetica Neue', Arial, sans-serif";
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText('M', 512, 94);
            wordmark('MUGATTI', 512, 176, 50, '#e8e4da', 20, '400');
          });
        });
      }
      // Signs: the fascia (row 0), the pylon's face (right), the delivery backdrop.
      function dealerSignCanvas() {
        return dealerCanvas(1024, 512, (g) => {
          const crown = (x, y, s, color) => {
            g.fillStyle = color;
            g.beginPath();
            g.moveTo(x - s, y + s * 0.5);
            g.lineTo(x - s, y - s * 0.3);
            g.lineTo(x - s * 0.5, y + s * 0.1);
            g.lineTo(x, y - s * 0.55);
            g.lineTo(x + s * 0.5, y + s * 0.1);
            g.lineTo(x + s, y - s * 0.3);
            g.lineTo(x + s, y + s * 0.5);
            g.closePath();
            g.fill();
          };
          const text = (t, x, y, size, color, spacing, weight = '300', align = 'center') => {
            g.font = `${weight} ${size}px 'Helvetica Neue', Arial, sans-serif`;
            g.textAlign = align;
            g.textBaseline = 'middle';
            if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
            g.fillStyle = color;
            g.fillText(t, x, y);
            if ('letterSpacing' in g) g.letterSpacing = '0px';
          };
          // Fascia: 1024 x 128, black glass, gold crown, white wordmark.
          g.fillStyle = '#0c0d0f';
          g.fillRect(0, 0, 1024, 128);
          crown(128, 62, 26, '#d4af62');
          text('MONARCH MOTORS', 560, 56, 64, '#f4f1ea', 26, '300');
          text('PRESTIGE COLLECTION', 560, 104, 18, '#d4af62', 12, '700');
          // Pylon face: 256 x 384 at (768, 128).
          g.fillStyle = '#0c0d0f';
          g.fillRect(768, 128, 256, 384);
          crown(896, 200, 40, '#d4af62');
          text('MONARCH', 896, 276, 40, '#f4f1ea', 8, '300');
          text('MOTORS', 896, 318, 40, '#f4f1ea', 8, '300');
          g.fillStyle = '#d4af62';
          g.fillRect(826, 348, 140, 2);
          text('WALTER MARTIN', 896, 384, 16, '#cfd4d8', 4, '600');
          text('CHEVETTE', 896, 414, 16, '#f2c21b', 4, '800');
          text('MUGATTI', 896, 444, 16, '#e8e4da', 4, '600');
          text('BY APPOINTMENT', 896, 486, 11, '#8f8a7e', 4, '700');
          // Delivery backdrop: 768 x 192 at (0, 128).
          const grad = g.createLinearGradient(0, 128, 768, 320);
          grad.addColorStop(0, '#0a0b0e');
          grad.addColorStop(0.5, '#1d1a14');
          grad.addColorStop(1, '#0a0b0e');
          g.fillStyle = grad;
          g.fillRect(0, 128, 768, 192);
          crown(384, 176, 20, '#d4af62');
          text('YOUR MOMENT', 384, 236, 44, '#f4f1ea', 16, '200');
          text('MONARCH MOTORS · DELIVERY SUITE', 384, 284, 14, '#d4af62', 8, '700');
          // Bay post plaque: 256 x 64 at (0, 320).
          g.fillStyle = '#101114';
          g.fillRect(0, 320, 256, 64);
          text('OWNERS ONLY', 128, 352, 22, '#d4af62', 6, '700');
          // A flag: 256 x 128 at (256, 320): black with the crown.
          g.fillStyle = '#0d0e10';
          g.fillRect(256, 320, 256, 128);
          crown(384, 372, 26, '#d4af62');
          text('MONARCH MOTORS', 384, 420, 16, '#f4f1ea', 5, '600');
          // Bottle wall behind the bar: 256 x 128 at (512, 320).
          for (let s = 0; s < 4; s++) {
            g.fillStyle = '#2a2016';
            g.fillRect(512, 320 + s * 32, 256, 4);
            for (let b = 0; b < 16; b++) {
              const hue = ['#6b3a1e', '#2f5a3a', '#c9a24e', '#8f1a1f', '#e8e2c8', '#3a2a5a'][(b * 7 + s * 3) % 6];
              g.fillStyle = hue;
              g.fillRect(516 + b * 15.5, 328 + s * 32, 9, 20);
              g.fillRect(519 + b * 15.5, 324 + s * 32, 3, 5);
            }
          }
        });
      }
      // The placards: a 4 x 4 atlas of cards (256 x 160), one per catalogue car.
      function dealerPlacardCanvas() {
        return dealerCanvas(1024, 640, (g) => {
          PRESTIGE_CATALOG.forEach((item, i) => {
            const x = (i % 4) * 256,
              y = Math.floor(i / 4) * 160,
              f = prestigeFigures(item);
            g.fillStyle = '#0c0d10';
            g.fillRect(x, y, 256, 160);
            g.strokeStyle = '#c9a24e';
            g.lineWidth = 2;
            g.strokeRect(x + 6, y + 6, 244, 148);
            g.textAlign = 'left';
            g.textBaseline = 'alphabetic';
            g.fillStyle = '#c9a24e';
            g.font = "800 13px 'Helvetica Neue', Arial, sans-serif";
            g.fillText(item.marque, x + 16, y + 30);
            g.fillStyle = '#f4f1ea';
            g.font = "300 24px 'Helvetica Neue', Arial, sans-serif";
            g.fillText(item.model, x + 16, y + 60, 224);
            g.fillStyle = '#bdb8ac';
            g.font = "600 12px 'Helvetica Neue', Arial, sans-serif";
            g.fillText(f.hp.toLocaleString('en-US') + ' HP  ·  ' + f.topKmh + ' KM/H  ·  ' + f.zeroTo100 + ' S', x + 16, y + 88);
            g.fillText(item.engine.split('·')[0].trim(), x + 16, y + 106, 224);
            g.fillStyle = '#ffffff';
            g.font = "300 26px 'Helvetica Neue', Arial, sans-serif";
            g.fillText(prestigePrice(item.price), x + 16, y + 142);
          });
        });
      }
      // Radial light for the pools under the cars.
      const dealerPoolTexture = dealerTexture(
        dealerCanvas(128, 128, (g) => {
          const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
          grad.addColorStop(0, 'rgba(255,244,222,1)');
          grad.addColorStop(0.45, 'rgba(255,238,210,0.45)');
          grad.addColorStop(1, 'rgba(255,230,200,0)');
          g.fillStyle = grad;
          g.fillRect(0, 0, 128, 128);
        }),
      );
      // Turntable: brushed dark disc with concentric rings and a logo mark.
      const dealerDiscTexture = dealerTexture(
        dealerCanvas(512, 512, (g) => {
          g.fillStyle = '#1b1c1f';
          g.beginPath();
          g.arc(256, 256, 256, 0, TAU);
          g.fill();
          for (let r = 16; r < 256; r += 6) {
            g.strokeStyle = `rgba(255,255,255,${0.02 + (r % 24 === 16 ? 0.05 : 0)})`;
            g.lineWidth = 1.5;
            g.beginPath();
            g.arc(256, 256, r, 0, TAU);
            g.stroke();
          }
          g.strokeStyle = 'rgba(212,175,98,0.7)';
          g.lineWidth = 4;
          g.beginPath();
          g.arc(256, 256, 238, 0, TAU);
          g.stroke();
          g.fillStyle = 'rgba(212,175,98,0.55)';
          for (let k = 0; k < 24; k++) {
            const a = (k / 24) * TAU;
            g.fillRect(256 + Math.cos(a) * 222 - 3, 256 + Math.sin(a) * 222 - 3, 6, 6);
          }
        }),
      );
      // Security shutter slats.
      const dealerShutterTexture = dealerTexture(
        dealerCanvas(64, 64, (g) => {
          g.fillStyle = '#9ba1a6';
          g.fillRect(0, 0, 64, 64);
          for (let y = 0; y < 64; y += 8) {
            const grad = g.createLinearGradient(0, y, 0, y + 8);
            grad.addColorStop(0, '#d2d6d9');
            grad.addColorStop(0.6, '#8d9397');
            grad.addColorStop(1, '#4d5256');
            g.fillStyle = grad;
            g.fillRect(0, y, 64, 8);
          }
        }),
        true,
      );
      // ---- Materials -------------------------------------------------------------------
      const dealerMaterials = (() => {
        const floorTex = dealerTexture(dealerFloorCanvas(), true),
          brandTex = dealerTexture(dealerBrandCanvas()),
          signTex = dealerTexture(dealerSignCanvas()),
          placardTex = dealerTexture(dealerPlacardCanvas());
        const m = {
          floor: new Three.MeshStandardMaterial({ map: floorTex, roughness: 0.1, metalness: 0.04, envMapIntensity: 1.35 }),
          brand: new Three.MeshStandardMaterial({ map: brandTex, emissiveMap: brandTex, emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.05 }),
          sign: new Three.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.1 }),
          placard: new Three.MeshStandardMaterial({ map: placardTex, emissiveMap: placardTex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.1 }),
          glass: useCityGlass(new Three.MeshStandardMaterial({ color: '#a9c3cf', roughness: 0.04, metalness: 0.85, transparent: true, opacity: 0.26, envMapIntensity: 1.5, emissive: '#ffd9a8', emissiveIntensity: 0, depthWrite: false })),
          roofGlass: useCityGlass(new Three.MeshStandardMaterial({ color: '#8fb0bf', roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.35, envMapIntensity: 1.4, depthWrite: false })),
          rail: new Three.MeshStandardMaterial({ color: '#cfe3ea', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.3, depthWrite: false }),
          disc: new Three.MeshStandardMaterial({ map: dealerDiscTexture, roughness: 0.18, metalness: 0.5, envMapIntensity: 1.2 }),
          ledRing: new Three.MeshBasicMaterial({ color: new Three.Color(1.6, 1.42, 1.1) }),
          pool: new Three.MeshBasicMaterial({ map: dealerPoolTexture, transparent: true, opacity: 0.2, blending: Three.AdditiveBlending, depthWrite: false, color: '#fff2dc' }),
          cone: new Three.MeshBasicMaterial({ color: '#fff1d8', transparent: true, opacity: 0.05, blending: Three.AdditiveBlending, depthWrite: false, side: Three.DoubleSide }),
          curtain: new Three.MeshStandardMaterial({ color: '#3a0c14', roughness: 0.92, metalness: 0, side: Three.DoubleSide }),
          shutter: new Three.MeshStandardMaterial({ map: dealerShutterTexture, roughness: 0.5, metalness: 0.6 }),
          shard: new Three.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.55, side: Three.DoubleSide, depthWrite: false }),
          screen: null,
          backdrop: null,
          lamp: new Three.MeshBasicMaterial({ color: new Three.Color(1.8, 1.6, 1.25) }),
          led: new Three.MeshBasicMaterial({ color: new Three.Color(1.4, 1.35, 1.25) }),
        };
        return m;
      })();
      // UVs of a plane onto a rectangle of an atlas (pixels of a w x h canvas).
      function dealerAtlasPlane(width, height, x, y, w, h, cw, ch) {
        const geo = new Three.PlaneGeometry(width, height),
          uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / cw, 1 - (y + (1 - uv.getY(i)) * h) / ch);
        return geo;
      }
      // ---- The build ---------------------------------------------------------------------
      const dealerGroups = { hall: null, roof: null, moving: null, root: null };
      function buildDealership() {
        if (!DEALER.planned || dealerVisual.built) return;
        dealerVisual.built = true;
        const H = DEALER.hall,
          U = UNITS_PER_METRE,
          top = DEALER.height,
          F = DEALER.furniture,
          root = new Three.Group(),
          hall = new Three.Group(),
          roof = new Three.Group(),
          moving = new Three.Group();
        root.name = 'monarch motors';
        hall.name = 'monarch motors hall';
        roof.name = 'monarch motors roof';
        moving.name = 'monarch motors moving';
        moving.userData.dynamic = true;
        root.add(hall, roof, moving);
        scene.add(root);
        Object.assign(dealerGroups, { hall, roof, moving, root });
        const T = {
          stone: tint('#e9e4d9', 'matte'),
          stoneDark: tint('#8e8a82', 'matte'),
          granite: tint('#2a2b2e', 'gloss'),
          white: tint('#f4f2ee', 'satin'),
          black: tint('#131417', 'gloss'),
          bronze: tint('#6b5a44', 'metal'),
          gold: tint('#c9a24e', 'metal'),
          chrome: tint('#d6dbdf', 'metal'),
          leather: tint('#e8dfcf', 'satin'),
          leatherDark: tint('#3a2a20', 'satin'),
          rug: tint('#5a5046', 'matte'),
          marble: tint('#1b1c1f', 'pearl'),
          wood: tint('#5b4030', 'satin'),
          steel: tint('#565b60', 'metal'),
          box: tint('#3d6534', 'matte'),
          planter: tint('#d9d4c8', 'matte'),
          velvet: tint('#3a0c14', 'matte'),
          screenFrame: tint('#0c0d0f', 'gloss'),
        };
        const bx = (x, y, z, w, h, d, m, parent = hall) => box(parent, x, y, z, w, h, d, m);
        // A raised stone ring round a turntable: the cars stand on the flush disc
        // inside it, so nothing buries their wheels.
        const ring = (x, z, inner, outer, h, m) => {
          const profile = [
            [inner, 0],
            [inner, h],
            [outer - 1, h],
            [outer, h * 0.4],
            [outer, 0],
          ].map(([r, y]) => new Three.Vector2(r, y));
          return mesh(new Three.LatheGeometry(profile, 72), m, hall, x, 0, z);
        };
        // ---- Floor ----
        const floor = new Three.Mesh(new Three.PlaneGeometry(H.w, H.h), dealerMaterials.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(H.x + H.w / 2, 0.12, H.y + H.h / 2);
        floor.receiveShadow = true;
        dealerMaterials.floor.map.repeat.set(H.w / (6 * U), H.h / (6 * U));
        hall.add(floor);
        // A dark stone skirting band round the inside of the walls.
        bx(H.x + H.w / 2, 0.6, H.y + 1.5, H.w, 1.2, 3, T.granite);
        // ---- Walls: stone outside, dark stone inside the back wall ----
        bx(H.x + H.w / 2, top / 2, H.y - 2, H.w + 8, top, 4, T.stone);
        for (const x of [H.x - 2, H.x1 + 2]) bx(x, top / 2, H.y + H.h / 2, 4, top, H.h + 4, T.stone);
        // Vertical fins on the side walls (read from the street).
        for (const x of [H.x - 4.5, H.x1 + 4.5]) for (let y = H.y + 20; y < H.y1; y += 32) bx(x, top / 2, y, 1.2, top - 2, 3, T.stoneDark);
        // A glass clerestory band high on the back wall's outside, lit at night.
        bx(H.x + H.w / 2, top - 10, H.y - 4.2, H.w - 40, 10, 0.6, kitGlass);
        // ---- The frontage: piers at the corners and doors, mullions between panes ----
        const frontY = H.y1;
        for (const x of [H.x, H.x1, DEALER.doorCars.x0, DEALER.doorCars.x1, DEALER.doorPeople.x0, DEALER.doorPeople.x1]) bx(x, top / 2, frontY, 3, top, 4, T.white);
        for (const pane of DEALER.panes) bx(pane.x0, top / 2, frontY, 0.9, top - 2, 2.4, T.bronze);
        // Transom over the doors and the sill.
        bx(H.x + H.w / 2, top - 4, frontY, H.w, 2, 3, T.bronze);
        bx(H.x + H.w / 2, 0.6, frontY, H.w, 1.2, 3.2, T.bronze);
        for (const d of [DEALER.doorPeople, DEALER.doorCars]) bx((d.x0 + d.x1) / 2, (d === DEALER.doorCars ? 46 : 26), frontY, d.x1 - d.x0, 2, 3.4, T.bronze);
        // Glass over the doors.
        bx((DEALER.doorPeople.x0 + DEALER.doorPeople.x1) / 2, (27 + top - 5) / 2, frontY, DEALER.doorPeople.x1 - DEALER.doorPeople.x0, top - 32, 0.4, dealerMaterials.glass, moving);
        bx((DEALER.doorCars.x0 + DEALER.doorCars.x1) / 2, (47 + top - 5) / 2, frontY, DEALER.doorCars.x1 - DEALER.doorCars.x0, top - 52, 0.4, dealerMaterials.glass, moving);
        // ---- Brand walls under the mezzanine ----
        const brandTop = F.mezzanine.height - 3;
        F.brandWalls.forEach((wall, k) => {
          const w = wall.x1 - wall.x0,
            panel = new Three.Mesh(dealerAtlasPlane(w - 4, brandTop - 6, 0, k * 256, 1024, 256, 1024, 768), dealerMaterials.brand);
          panel.position.set((wall.x0 + wall.x1) / 2, 3 + (brandTop - 6) / 2 + 1, H.y + 1.2);
          hall.add(panel);
          // A backlit gold (or lime) line under each.
          bx((wall.x0 + wall.x1) / 2, 2.6, H.y + 1.6, w - 8, 0.5, 0.5, dealerMaterials.led);
          // Dividing blades between the walls.
          bx(wall.x1 + 1, brandTop / 2, H.y + 2, 1.4, brandTop, 4, T.bronze);
        });
        // ---- Mezzanine gallery with its glass balustrade and the stair ----
        const Z = F.mezzanine;
        bx(Z.x + Z.w / 2, Z.height, Z.y + Z.h / 2, Z.w, 2.4, Z.h, T.white);
        bx(Z.x + Z.w / 2, Z.height - 1.4, Z.y + Z.h - 1, Z.w, 0.5, 0.6, dealerMaterials.led);
        bx(Z.x + Z.w / 2, Z.height + 5.2, Z.y + Z.h - 0.6, Z.w, 8, 0.4, dealerMaterials.rail, moving);
        bx(Z.x + Z.w / 2, Z.height + 9.3, Z.y + Z.h - 0.6, Z.w, 0.5, 1, T.chrome);
        // Gallery furniture: a few chairs and tables along it.
        for (let x = Z.x + 40; x < Z.x + Z.w - 20; x += 60) {
          bx(x, Z.height + 3, Z.y + 12, 8, 0.8, 8, T.black);
          bx(x, Z.height + 1.8, Z.y + 12, 1, 3, 1, T.chrome);
          for (const dx of [-7, 7]) bx(x + dx, Z.height + 2.4, Z.y + 12, 4, 3.2, 4, T.leather);
        }
        // The stair along the east wall.
        const stepCount = 18,
          stairX = H.x1 - 5;
        for (let i = 0; i < stepCount; i++) {
          const y = H.y + 170 - (i / stepCount) * (170 - Z.h - 2),
            h = ((i + 1) / stepCount) * Z.height;
          bx(stairX, h - 0.6, y, 8, 1.2, 7.6, T.white);
        }
        bx(stairX - 4.2, Z.height / 2 + 4, H.y + (170 + Z.h) / 2, 0.4, Z.height + 8, 170 - Z.h, dealerMaterials.rail, moving);
        // ---- The delivery suite ----
        const st = DEALER.stage;
        // Backdrop LED wall behind the stage and the stage's raised ring.
        const backdropMat = new Three.MeshBasicMaterial({ map: dealerMaterials.sign.map, color: new Three.Color(1.15, 1.1, 1.05) });
        dealerMaterials.backdrop = backdropMat;
        const backdrop = new Three.Mesh(dealerAtlasPlane(112, 30, 0, 128, 768, 192, 1024, 512), backdropMat);
        backdrop.position.set(st.x, 22, H.y + 2);
        moving.add(backdrop);
        bx(st.x, 22, H.y + 1.2, 116, 34, 1, T.screenFrame);
        ring(st.x, st.y, st.r + 0.8, st.r + 9, 1.4, T.granite);
        bx(F.stageWall.x + F.stageWall.w / 2, 12, F.stageWall.y + 1.5, F.stageWall.w, 24, 3, T.stoneDark);
        // The curtain track over the stage's front.
        const C = DEALER.curtain;
        bx((C.x0 + C.x1) / 2, 50, C.y, C.x1 - C.x0 + 6, 1.2, 1.6, T.chrome);
        // The partition: a dark stone wall with a gold edge.
        const P = F.partition;
        bx(P.x + P.w / 2, 13, P.y + P.h / 2, P.w, 26, P.h, T.stoneDark);
        bx(P.x + P.w / 2, 26.4, P.y + P.h / 2, P.w + 0.6, 0.6, P.h, T.gold);
        // Service desk.
        const S = F.service;
        bx(S.x + S.w / 2, 4.2, S.y + S.h / 2, S.w, 8.4, S.h, T.white);
        bx(S.x + S.w / 2, 8.7, S.y + S.h / 2, S.w + 2, 0.6, S.h + 2, T.marble);
        bx(S.x - 0.3, 5, S.y + S.h / 2, 0.4, 2, S.h - 6, dealerMaterials.led);
        // ---- Reception: a curved white desk with a marble top ----
        const R = F.reception;
        const desk = new Three.Mesh(new Three.CylinderGeometry(R.w * 0.62, R.w * 0.62, 8.6, 40, 1, false, Math.PI * 0.2, Math.PI * 0.6), T.white);
        desk.position.set(R.x + R.w / 2, 4.3, R.y + R.h / 2 - R.w * 0.62 + R.h);
        desk.rotation.y = Math.PI;
        hall.add(desk);
        bx(R.x + R.w / 2, 8.9, R.y + R.h / 2, R.w, 0.6, R.h, T.marble);
        bx(R.x + R.w / 2, 4.6, R.y + R.h + 0.4, R.w * 0.5, 2.6, 0.4, T.gold);
        // Orchids and a screen on the desk.
        bx(R.x + 8, 11, R.y + 6, 2.5, 4, 1.5, T.screenFrame);
        mesh(sphereGeo, tint('#f2e6f0', 'satin'), hall, R.x + R.w - 8, 11.5, R.y + 8, 2.4, 2, 2.4);
        // ---- VIP lounge ----
        const L = F.lounge;
        bx(L.x + L.w / 2, 0.25, L.y + L.h / 2 + 10, L.w - 24, 0.3, L.h - 60, T.rug);
        bx(L.x + L.w / 2, 0.3, L.y + L.h / 2 + 10, L.w - 30, 0.3, L.h - 66, tint('#6d6256', 'matte'));
        for (const key of ['sofaA', 'sofaB', 'sofaC']) {
          const r = F[key];
          bx(r.x + r.w / 2, 1.9, r.y + r.h / 2, r.w, 3.8, r.h, T.leather);
          // Back rest on the side away from the table.
          const alongX = r.w > r.h,
            back = key === 'sofaA' ? { x: r.x + r.w / 2, z: r.y + 1.5, w: r.w, d: 3 } : key === 'sofaB' ? { x: r.x + 1.5, z: r.y + r.h / 2, w: 3, d: r.h } : { x: r.x + r.w / 2, z: r.y + r.h - 1.5, w: r.w, d: 3 };
          bx(back.x, 5.2, back.z, back.w, 6.4, back.d, T.leather);
          const n = Math.max(1, Math.round((alongX ? r.w : r.h) / 12));
          for (let i = 0; i < n; i++) {
            const f = (i + 0.5) / n;
            bx(alongX ? r.x + r.w * f : r.x + r.w / 2 + 1, 4.1, alongX ? r.y + r.h / 2 + (key === 'sofaA' ? 1 : -1) : r.y + r.h * f, alongX ? r.w / n - 1.2 : r.w - 3, 1, alongX ? r.h - 3 : r.h / n - 1.2, tint('#efe7d8', 'satin'));
          }
        }
        const Tb = F.table;
        bx(Tb.x + Tb.w / 2, 3.2, Tb.y + Tb.h / 2, Tb.w, 0.5, Tb.h, T.black);
        bx(Tb.x + Tb.w / 2, 1.5, Tb.y + Tb.h / 2, Tb.w - 6, 3, Tb.h - 6, T.gold);
        // Car books and a model car on the table.
        bx(Tb.x + 6, 3.8, Tb.y + 5, 5, 0.6, 4, tint('#0b4d3b', 'satin'));
        bx(Tb.x + Tb.w - 7, 4.1, Tb.y + Tb.h - 5, 5.5, 1.2, 2.4, tint('#e8641b', 'gloss'));
        // The bar: black marble front, gold strip, the lit bottle wall behind, stools.
        const Bar = F.bar;
        bx(Bar.x + Bar.w / 2, 4.6, Bar.y + Bar.h / 2, Bar.w, 9.2, Bar.h, T.marble);
        bx(Bar.x + Bar.w / 2, 9.4, Bar.y + Bar.h / 2, Bar.w + 3, 0.6, Bar.h + 2, tint('#e8e2d6', 'pearl'));
        bx(Bar.x - 0.3, 2, Bar.y + Bar.h / 2, 0.4, 0.6, Bar.h - 4, dealerMaterials.led);
        const bottles = new Three.Mesh(dealerAtlasPlane(Bar.w - 10, 22, 512, 320, 256, 128, 1024, 512), dealerMaterials.sign);
        bottles.position.set(Bar.x + Bar.w / 2, 17, H.y + 0.8);
        hall.add(bottles);
        for (let i = 0; i < 5; i++) {
          const x = Bar.x + 10 + i * 17;
          mesh(cylinderGeo, T.chrome, hall, x, 3.2, Bar.y + Bar.h + 6, 0.5, 6.4, 0.5);
          mesh(cylinderGeo, T.leatherDark, hall, x, 6.6, Bar.y + Bar.h + 6, 2.4, 1, 2.4);
        }
        // Plants in tall planters in the corners.
        const plant = (x, z, s = 1) => {
          mesh(cylinderGeo, T.planter, hall, x, 4 * s, z, 4 * s, 8 * s, 4 * s);
          for (const [dx, dy, dz, r] of [[0, 13, 0, 5], [2, 17, 1, 3.5], [-2, 15, -1.5, 4], [1, 20, -1, 2.6]]) mesh(sphereGeo, stillLeafMat, hall, x + dx * s, dy * s, z + dz * s, r * s, r * s * 1.1, r * s);
        };
        plant(L.x + 10, L.y + 12);
        plant(H.x + 146, H.y1 - 14, 0.9);
        plant(H.x1 - 12, H.y1 - 14, 0.9);
        plant(DEALER.doorPeople.x0 - 16, H.y1 - 12, 0.8);
        plant(DEALER.doorPeople.x1 + 16, H.y1 - 12, 0.8);
        // The lounge's glass rail and the kiosk.
        const LR = F.loungeRail;
        bx(LR.x + LR.w / 2, 4.5, LR.y + 2, LR.w, 9, 0.4, dealerMaterials.rail, moving);
        bx(LR.x + LR.w / 2, 9.2, LR.y + 2, LR.w, 0.4, 1, T.chrome);
        const K = F.kiosk;
        bx(K.x + K.w / 2, 5, K.y + K.h / 2, K.w, 10, K.h, T.white);
        bx(K.x + K.w / 2, 10.4, K.y + K.h / 2 - 1, K.w - 1, 0.6, K.h - 4, T.screenFrame);
        // ---- The configurator wall: a freestanding LED screen facing the entrance ----
        const CW = F.config,
          screenCanvas = document.createElement('canvas');
        screenCanvas.width = 1024;
        screenCanvas.height = 320;
        const screenTex = dealerTexture(screenCanvas),
          screenMat = new Three.MeshBasicMaterial({ map: screenTex, color: new Three.Color(1.2, 1.2, 1.2) });
        dealerMaterials.screen = screenMat;
        dealerVisual.screenCanvas = screenCanvas;
        dealerVisual.screenTex = screenTex;
        const screen = new Three.Mesh(new Three.PlaneGeometry(CW.w - 4, 30), screenMat);
        screen.position.set(CW.x + CW.w / 2, 19, CW.y + CW.h + 0.3);
        moving.add(screen);
        bx(CW.x + CW.w / 2, 18, CW.y + CW.h / 2, CW.w, 36, CW.h, T.screenFrame);
        bx(CW.x + CW.w / 2, 1.2, CW.y + CW.h / 2, CW.w + 4, 2.4, CW.h + 8, T.granite);
        drawDealerScreen(0);
        // ---- The hero dais: a raised stepped ring round the hero turntable ----
        for (const s of DEALER.slots) {
          if (!s.hero) continue;
          ring(s.x, s.y, s.r + 5, s.r + 11, 1.2, T.granite);
          ring(s.x, s.y, s.r + 0.8, s.r + 5.2, 2.4, T.white);
        }
        // ---- Placards: a stand with the car's card beside every car on show ----
        for (const s of DEALER.slots) {
          const index = PRESTIGE_CATALOG.findIndex((i) => i.type === s.type);
          if (index < 0) continue;
          // On the aisle side of the plinth, facing the aisle.
          const toward = s.where === 'hall' ? (s.y < H.y + 150 ? 1 : s.y > H.y + 250 ? -1 : 1) : 1,
            px = s.x + s.r * 0.72,
            pz = s.y + toward * (s.r + 4);
          mesh(cylinderGeo, T.chrome, hall, px, 3.4, pz, 0.35, 6.8, 0.35);
          bx(px, 0.4, pz, 3, 0.8, 3, T.black);
          const card = new Three.Mesh(dealerAtlasPlane(5.6, 3.5, (index % 4) * 256, Math.floor(index / 4) * 160, 256, 160, 1024, 640), dealerMaterials.placard);
          card.position.set(px, 7.2, pz + toward * 0.2);
          card.rotation.set(-0.55 * toward, toward < 0 ? Math.PI : 0, 0);
          if (toward < 0) card.rotation.x = 0.55;
          hall.add(card);
          bx(px, 7.2, pz, 6, 4, 0.3, T.black);
        }
        // ---- Forecourt: podiums, planters, flags, the pylon, the bay posts ----
        for (const p of F.podiums) {
          ring(p.x, p.y, p.r - 9.2, p.r + 1, 1.8, T.white);
          ring(p.x, p.y, p.r - 1, p.r + 2.5, 1, T.granite);
        }
        for (const pl of F.planters) {
          bx(pl.x + pl.w / 2, 3.4, pl.y + pl.h / 2, pl.w, 6.8, pl.h, T.planter);
          for (let z = pl.y + 6; z < pl.y + pl.h - 4; z += 9) mesh(sphereGeo, stillLeafMat, hall, pl.x + pl.w / 2, 8.5, z, 5.5, 4.2, 5);
          // A clipped cone topiary at each end.
          for (const z of [pl.y + 5, pl.y + pl.h - 5]) {
            const cone = mesh(new Three.ConeGeometry(4, 14, 10), stillLeafMat, hall, pl.x + pl.w / 2, 13, z);
            cone.castShadow = true;
          }
        }
        const flagCanvasRect = [256, 320, 256, 128];
        for (const f of F.flags) {
          mesh(cylinderGeo, T.chrome, hall, f.x, 36, f.y, 0.5, 72, 0.5);
          const flag = new Three.Mesh(dealerAtlasPlane(14, 7, ...flagCanvasRect, 1024, 512), dealerMaterials.sign);
          flag.position.set(f.x + 7.2, 66, f.y);
          flag.material = dealerMaterials.sign;
          hall.add(flag);
        }
        const Py = F.pylon;
        bx(Py.x + Py.w / 2, Py.height / 2, Py.y + Py.h / 2, Py.w, Py.height, Py.h, T.black);
        const pylonFace = new Three.Mesh(dealerAtlasPlane(Py.w - 2, Py.height - 8, 768, 128, 256, 384, 1024, 512), dealerMaterials.sign);
        pylonFace.position.set(Py.x + Py.w / 2, Py.height / 2 + 2, Py.y + Py.h + 0.15);
        hall.add(pylonFace);
        for (const b of DEALER.bays) {
          mesh(cylinderGeo, T.black, hall, DEALER.lot.x + 8, 4, b.y - 12.5, 0.6, 8, 0.6);
        }
        const bayPlaque = new Three.Mesh(dealerAtlasPlane(10, 2.5, 0, 320, 256, 64, 1024, 512), dealerMaterials.sign);
        bayPlaque.position.set(DEALER.lot.x + 22, 7, DEALER.bays[0].y - 13.2);
        hall.add(bayPlaque);
        // ---- The roof: the canopy with a waved front edge, the oculus and skylights ----
        const hero = DEALER.slots.find((s) => s.hero),
          shape = new Three.Shape(),
          over = 5 * U,
          wave = (x) => H.y1 + over * (0.55 + 0.45 * Math.sin(((x - H.x) / H.w) * Math.PI * 2 - 0.6));
        shape.moveTo(H.x - 6, -(H.y - 6));
        shape.lineTo(H.x1 + 6, -(H.y - 6));
        for (let i = 0; i <= 40; i++) {
          const x = lerpNumber(H.x1 + 6, H.x - 6, i / 40);
          shape.lineTo(x, -wave(x));
        }
        shape.closePath();
        const oculus = new Three.Path();
        oculus.absellipse(hero.x, -hero.y, 7 * U, 5.5 * U, 0, TAU, true);
        shape.holes.push(oculus);
        const skylights = [
          { x0: H.x + 150, x1: H.x + 250, y0: H.y + 60, y1: H.y + 300 },
          { x0: H.x + 362, x1: H.x + 462, y0: H.y + 60, y1: H.y + 300 },
        ];
        for (const k of skylights) {
          const hole = new Three.Path();
          hole.moveTo(k.x0, -k.y0);
          hole.lineTo(k.x0, -k.y1);
          hole.lineTo(k.x1, -k.y1);
          hole.lineTo(k.x1, -k.y0);
          hole.closePath();
          shape.holes.push(hole);
        }
        const roofGeo = new Three.ExtrudeGeometry(shape, { depth: 3.2, bevelEnabled: false, curveSegments: 32 });
        roofGeo.rotateX(-Math.PI / 2);
        const roofMesh = new Three.Mesh(roofGeo, T.white);
        roofMesh.position.y = top - 1;
        roofMesh.castShadow = roofMesh.receiveShadow = true;
        roof.add(roofMesh);
        // Glass in the oculus and skylights, with fine mullions.
        const oculusGlass = new Three.Mesh(new Three.CircleGeometry(1, 48), dealerMaterials.roofGlass);
        oculusGlass.rotation.x = -Math.PI / 2;
        oculusGlass.scale.set(7 * U, 5.5 * U, 1);
        oculusGlass.position.set(hero.x, top + 1.4, hero.y);
        roof.add(oculusGlass);
        for (const k of skylights) {
          const sky = new Three.Mesh(new Three.PlaneGeometry(k.x1 - k.x0, k.y1 - k.y0), dealerMaterials.roofGlass);
          sky.rotation.x = -Math.PI / 2;
          sky.position.set((k.x0 + k.x1) / 2, top + 1.2, (k.y0 + k.y1) / 2);
          roof.add(sky);
          for (let z = k.y0 + 20; z < k.y1; z += 20) bx((k.x0 + k.x1) / 2, top + 1.6, z, k.x1 - k.x0, 0.8, 0.8, T.white, roof);
          bx((k.x0 + k.x1) / 2, top + 1.6, (k.y0 + k.y1) / 2, 0.8, 0.8, k.y1 - k.y0, T.white, roof);
        }
        // The fascia sign on the canopy's front, over the entrance, and one on the back.
        const fascia = new Three.Mesh(dealerAtlasPlane(90, 11.25, 0, 0, 1024, 128, 1024, 512), dealerMaterials.sign);
        const fx = (DEALER.doorPeople.x0 + DEALER.doorPeople.x1) / 2;
        fascia.position.set(fx, top + 7.5, wave(fx) - 3);
        fascia.rotation.x = -0.15;
        roof.add(fascia);
        bx(fx, top + 7.5, wave(fx) - 4, 94, 13, 1.2, T.black, roof);
        const back = new Three.Mesh(dealerAtlasPlane(120, 15, 0, 0, 1024, 128, 1024, 512), dealerMaterials.sign);
        back.position.set(H.x + H.w / 2, top - 16, H.y - 4.7);
        back.rotation.y = Math.PI;
        hall.add(back);
        // Pendant lamps and ceiling spots hang from the roof (hidden with it).
        for (let x = H.x + 60; x < H.x1; x += 64)
          for (let z = H.y + 60; z < H.y1 - 20; z += 70) mesh(cylinderGeo, T.black, roof, x, top - 6, z, 1.6, 2, 1.6);
        // ---- Moving parts: turntables, rims, pools, cones, curtain, doors, shutters ----
        const slots = DEALER.slots,
          discs = new Three.InstancedMesh(new Three.CylinderGeometry(1, 1, 0.5, 64), dealerMaterials.disc, slots.length + 1),
          rims = new Three.InstancedMesh(new Three.TorusGeometry(1, 0.012, 4, 96), dealerMaterials.ledRing, slots.length + 1),
          pools = new Three.InstancedMesh(new Three.PlaneGeometry(1, 1), dealerMaterials.pool, slots.length + 1);
        for (const im of [discs, rims, pools]) {
          im.frustumCulled = false;
          moving.add(im);
        }
        discs.receiveShadow = true;
        rims.castShadow = pools.castShadow = false;
        dealerVisual.discs = discs;
        dealerVisual.rims = rims;
        dealerVisual.pools = pools;
        // Light cones on the hero from four ceiling spots.
        const cones = new Three.Group();
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + 0.4,
            geo = new Three.CylinderGeometry(1.2, hero.r * 0.55, top - 8, 20, 1, true),
            cone = new Three.Mesh(geo, dealerMaterials.cone);
          cone.position.set(hero.x + Math.cos(a) * 12, (top - 8) / 2, hero.y + Math.sin(a) * 12);
          cone.lookAt(hero.x, 0, hero.y);
          cone.rotateX(Math.PI / 2);
          cone.position.set(hero.x + Math.cos(a) * hero.r * 0.6, (top - 8) / 2, hero.y + Math.sin(a) * hero.r * 0.6);
          cone.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
          cones.add(cone);
        }
        moving.add(cones);
        dealerVisual.cones = cones;
        // The curtain: two halves of folded velvet on the track.
        const half = (C.x1 - C.x0) / 2,
          curtainHeight = 48,
          makeHalf = (side) => {
            const geo = new Three.PlaneGeometry(half, curtainHeight, 40, 1),
              m = new Three.Mesh(geo, dealerMaterials.curtain);
            m.userData.base = geo.attributes.position.array.slice();
            m.userData.side = side;
            m.castShadow = true;
            moving.add(m);
            return m;
          };
        dealerVisual.curtains = [makeHalf(-1), makeHalf(1)];
        dealerVisual.curtainHalf = half;
        dealerVisual.curtainHeight = curtainHeight;
        // Sliding doors and the vehicle door.
        const dp = DEALER.doorPeople,
          dc = DEALER.doorCars,
          doorGeo = new Three.BoxGeometry(1, 1, 1);
        dealerVisual.slides = [-1, 1].map((side) => {
          const m = new Three.Mesh(doorGeo, dealerMaterials.glass);
          m.scale.set((dp.x1 - dp.x0) / 2 - 0.6, 25, 0.6);
          m.userData.closedX = (dp.x0 + dp.x1) / 2 + side * ((dp.x1 - dp.x0) / 4);
          m.userData.side = side;
          m.position.set(m.userData.closedX, 12.8, frontY + 1.2);
          moving.add(m);
          return m;
        });
        const carDoor = new Three.Group(),
          carDoorGlass = new Three.Mesh(doorGeo, dealerMaterials.glass);
        carDoorGlass.scale.set(dc.x1 - dc.x0 - 1, 44, 0.6);
        carDoor.add(carDoorGlass);
        for (let y = -22; y <= 22; y += 11) box(carDoor, 0, y, 0.4, dc.x1 - dc.x0 - 1, 0.7, 0.8, T.bronze);
        carDoor.position.set((dc.x0 + dc.x1) / 2, 22.5, frontY + 1.4);
        moving.add(carDoor);
        dealerVisual.carDoor = carDoor;
        // Glass panes, one instance each; shutters and shards per pane (and the doors' shutters).
        const panes = DEALER.panes,
          paneGlass = new Three.InstancedMesh(doorGeo, dealerMaterials.glass, panes.length),
          shutters = new Three.InstancedMesh(doorGeo, dealerMaterials.shutter, panes.length + 2),
          shards = new Three.InstancedMesh(dealerShardGeometry(), dealerMaterials.shard, panes.length);
        for (const im of [paneGlass, shutters, shards]) {
          im.frustumCulled = false;
          im.castShadow = false;
          moving.add(im);
        }
        dealerVisual.paneGlass = paneGlass;
        dealerVisual.shutters = shutters;
        dealerVisual.shards = shards;
        placeDealerPanes(true);
        placeDealerShutters(0);
        // ---- Merge the static hall and the roof ----
        root.updateMatrixWorld(true);
        const hallBatch = kitMerge(hall),
          roofBatch = kitMerge(roof);
        for (const m of hallBatch) m.name = 'monarch motors hall';
        for (const m of roofBatch) m.name = 'monarch motors roof';
        dealerVisual.draws = { hall: hallBatch.length + hall.children.filter((c) => c.isMesh && !hallBatch.includes(c)).length, roof: roof.children.length, moving: moving.children.length };
        // One culling entry for the whole dealership (the roof's own visibility is ours).
        statics.push({ x: H.x + H.w / 2, y: H.y + H.h / 2 + 60, group: root, radius: 520 });
        // ---- Night light: pools in the island's light map and glows ----
        for (const s of slots) isleLightPools.push({ x: s.x, y: s.y, r: s.where === 'hall' ? 52 : 44, color: [255, 238, 214], strength: s.where === 'hall' ? 0.55 : 0.45 });
        for (let x = H.x + 30; x < H.x1; x += 60) isleLightPools.push({ x, y: H.y1 + 24, r: 60, color: [255, 226, 186], strength: 0.4 });
        for (let x = H.x + 40; x < H.x1; x += 80) for (let z = H.y + 40; z < H.y1; z += 80) isleLightPools.push({ x, y: z, r: 64, color: [255, 240, 220], strength: 0.3 });
        isleLightPools.push({ x: Py.x + Py.w / 2, y: Py.y + 20, r: 40, color: [255, 214, 150], strength: 0.4 });
        dealerVisual.glows = [];
        for (let x = H.x + 60; x < H.x1; x += 64)
          for (let z = H.y + 60; z < H.y1 - 20; z += 70) dealerVisual.glows.push(glowHandle(addGlow(x, top - 7.5, z, 7, '#fff1d6', 0.9, { day: 0.25 })));
        // Uplights along the frontage and the canopy's LED edge.
        for (let x = H.x + 12; x < H.x1; x += 24) addGlow(x, 1.2, H.y1 + 3, 6, '#ffe2b8', 0.8, { day: 0 });
        for (let i = 0; i <= 30; i++) {
          const x = lerpNumber(H.x, H.x1, i / 30);
          addGlow(x, top - 1.5, wave(x), 5, '#fff3dc', 0.7, { day: 0 });
        }
        for (const p of F.podiums) for (let k = 0; k < 12; k++) addGlow(p.x + Math.cos((k / 12) * TAU) * (p.r - 1), 1.8, p.y + Math.sin((k / 12) * TAU) * (p.r - 1), 3, '#ffe8c0', 0.6, { day: 0 });
        // The canopy as overhead cover (the police helicopter loses you under it).
        registerOverheadCover(H.x + H.w / 2, H.y + H.h / 2, H.w / 2, H.h / 2, 0, top - 2, top + 3, 'roof');
        dealerVisual.wave = wave;
      }
      // Jagged glass left in a broken pane's frame: a few thin triangles top and bottom (unit pane).
      function dealerShardGeometry() {
        const position = [];
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (const edge of [0.5, -0.5]) {
          let x = -0.5;
          while (x < 0.5) {
            const w = 0.06 + rnd() * 0.14,
              depth = 0.05 + rnd() * 0.28,
              tip = x + w * (0.3 + rnd() * 0.4);
            position.push(x, edge, 0, Math.min(0.5, x + w), edge, 0, tip, edge - Math.sign(edge) * depth, (rnd() - 0.5) * 0.02);
            x += w;
          }
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(position, 3));
        geo.computeVertexNormals();
        return geo;
      }
      const dealerMatrix = new Three.Matrix4(),
        dealerQuaternion = new Three.Quaternion(),
        dealerEuler = new Three.Euler(),
        dealerPosition = new Three.Vector3(),
        dealerScale = new Three.Vector3();
      function dealerSet(im, i, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
        dealerMatrix.compose(dealerPosition.set(x, y, z), dealerQuaternion.setFromEuler(dealerEuler.set(rx, ry, rz)), dealerScale.set(sx, sy, sz));
        im.setMatrixAt(i, dealerMatrix);
      }
      function placeDealerPanes(force) {
        const broken = DEALER.panes.filter((p) => p.broken).length;
        if (!force && broken === dealerVisual.broken) return;
        dealerVisual.broken = broken;
        const top = DEALER.height,
          y = DEALER.hall.y1;
        DEALER.panes.forEach((p, i) => {
          const w = p.x1 - p.x0 - 1,
            h = top - 7;
          if (p.broken) dealerSet(dealerVisual.paneGlass, i, 0, -100, 0, 0.001, 0.001, 0.001);
          else dealerSet(dealerVisual.paneGlass, i, (p.x0 + p.x1) / 2, 1.2 + h / 2, y, w, h, 0.5);
          if (p.broken) dealerSet(dealerVisual.shards, i, (p.x0 + p.x1) / 2, 1.2 + h / 2, y, w, h, 1);
          else dealerSet(dealerVisual.shards, i, 0, -100, 0, 0.001, 0.001, 0.001);
        });
        dealerVisual.paneGlass.instanceMatrix.needsUpdate = true;
        dealerVisual.shards.instanceMatrix.needsUpdate = true;
      }
      function placeDealerShutters(f) {
        if (Math.abs(f - dealerVisual.shutter) < 0.002) return;
        dealerVisual.shutter = f;
        const top = DEALER.height - 4,
          y = DEALER.hall.y1 + 3.2,
          im = dealerVisual.shutters,
          h = Math.max(0.01, f * top);
        const place = (i, x0, x1) => (f < 0.005 ? dealerSet(im, i, 0, -100, 0, 0.001, 0.001, 0.001) : dealerSet(im, i, (x0 + x1) / 2, top - h / 2, y, x1 - x0, h, 0.6));
        DEALER.panes.forEach((p, i) => place(i, p.x0, p.x1));
        place(DEALER.panes.length, DEALER.doorPeople.x0, DEALER.doorPeople.x1);
        place(DEALER.panes.length + 1, DEALER.doorCars.x0, DEALER.doorCars.x1);
        dealerSetShutterRepeat(h);
        im.instanceMatrix.needsUpdate = true;
      }
      function dealerSetShutterRepeat(h) {
        dealerMaterials.shutter.map.repeat.set(1, Math.max(1, h / 3));
      }
      // The configurator: the car of the moment in a studio sweep, its figures and paints.
      function drawDealerScreen(index) {
        const canvasEl = dealerVisual.screenCanvas;
        if (!canvasEl) return;
        const g = canvasEl.getContext('2d'),
          items = PRESTIGE_CATALOG,
          item = items[index % items.length],
          f = prestigeFigures(item),
          paint = item.paints[Math.floor(index / items.length) % item.paints.length][1];
        const grad = g.createLinearGradient(0, 0, 0, 320);
        grad.addColorStop(0, '#15171b');
        grad.addColorStop(0.7, '#2a2d33');
        grad.addColorStop(1, '#0b0c0e');
        g.fillStyle = grad;
        g.fillRect(0, 0, 1024, 320);
        // Floor reflection band.
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(0, 238, 1024, 2);
        // A side view: a low hypercar silhouette in the paint.
        g.save();
        g.translate(560, 236);
        g.fillStyle = paint;
        g.beginPath();
        g.moveTo(-250, -20);
        g.bezierCurveTo(-240, -58, -150, -66, -70, -74);
        g.bezierCurveTo(-20, -108, 70, -110, 120, -80);
        g.bezierCurveTo(170, -62, 230, -52, 262, -34);
        g.lineTo(268, -6);
        g.lineTo(-256, -6);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(10,14,18,0.85)';
        g.beginPath();
        g.moveTo(-40, -78);
        g.bezierCurveTo(0, -102, 70, -102, 104, -80);
        g.lineTo(-40, -76);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(-230, -48, 470, 3);
        for (const x of [-160, 170]) {
          g.fillStyle = '#0c0c0e';
          g.beginPath();
          g.arc(x, -6, 40, 0, TAU);
          g.fill();
          g.fillStyle = '#9aa0a6';
          g.beginPath();
          g.arc(x, -6, 26, 0, TAU);
          g.fill();
          g.fillStyle = '#c8102e';
          g.fillRect(x - 20, -28, 10, 14);
        }
        g.restore();
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
        g.fillStyle = '#c9a24e';
        g.font = "800 20px 'Helvetica Neue', Arial, sans-serif";
        g.fillText(item.marque, 40, 56);
        g.fillStyle = '#f4f1ea';
        g.font = "200 50px 'Helvetica Neue', Arial, sans-serif";
        g.fillText(item.model, 40, 108, 460);
        g.fillStyle = '#bdb8ac';
        g.font = "600 18px 'Helvetica Neue', Arial, sans-serif";
        const lines = [f.hp.toLocaleString('en-US') + ' HP', f.topKmh + ' KM/H', '0-100 · ' + f.zeroTo100 + ' S', prestigePrice(item.price)];
        lines.forEach((t, i) => g.fillText(t, 40, 150 + i * 28));
        // The paint chips along the foot.
        item.paints.forEach((p, i) => {
          g.fillStyle = p[1];
          g.beginPath();
          g.arc(52 + i * 34, 292, 12, 0, TAU);
          g.fill();
          if (p[1] === paint) {
            g.strokeStyle = '#e2c897';
            g.lineWidth = 3;
            g.stroke();
          }
        });
        g.fillStyle = '#6f6b62';
        g.font = "700 12px 'Helvetica Neue', Arial, sans-serif";
        g.fillText('CONFIGURE YOURS · ASK A SALES EXECUTIVE', 700, 296);
        if (dealerVisual.screenTex) dealerVisual.screenTex.needsUpdate = true;
      }
      // The curtain: open is gathered at the sides, closed hangs across in folds.
      function placeDealerCurtain(open) {
        const C = DEALER.curtain,
          half = dealerVisual.curtainHalf,
          h = dealerVisual.curtainHeight;
        for (const m of dealerVisual.curtains) {
          const side = m.userData.side,
            base = m.userData.base,
            pos = m.geometry.attributes.position,
            width = half * lerpNumber(1, 0.14, open),
            folds = 9,
            amplitude = lerpNumber(0.9, 2.6, open);
          for (let i = 0; i < pos.count; i++) {
            const u = (base[i * 3] + half / 2) / half,
              // From the outer edge (u = 0 on the left half's outside) inwards.
              along = side < 0 ? u : 1 - u,
              x = side < 0 ? C.x0 + along * width : C.x1 - along * width;
            pos.setXYZ(i, x, base[i * 3 + 1], C.y + 1 + Math.sin(along * folds * Math.PI * 2) * amplitude);
          }
          pos.needsUpdate = true;
          m.geometry.computeVertexNormals();
          m.position.set(0, h / 2 + 1, 0);
        }
      }
      function updateDealershipVisuals(deltaSeconds) {
        if (!DEALER.planned) return;
        if (!dealerVisual.built) buildDealership();
        const H = DEALER.hall;
        if (!dealerGroups.root.visible || Math.abs(viewCenter.x - (H.x + H.w / 2)) > 1400 || Math.abs(viewCenter.y - (H.y + H.h / 2)) > 1400) return;
        const night = nightAmount;
        // The roof lifts off while the player (or the camera, for the card and the delivery) is inside.
        const inside = inDealerHall(player.x, player.y, -2) || !!dealer.menu || !!dealer.reveal;
        if (inside === dealerVisual.roofShown) {
          dealerVisual.roofShown = !inside;
          dealerGroups.roof.visible = !inside;
          for (const g of dealerVisual.glows) g.visible = !inside;
        }
        // Materials by the hour.
        dealerMaterials.glass.emissiveIntensity = night * 0.55;
        dealerMaterials.brand.emissiveIntensity = 0.28 + night * 0.9;
        dealerMaterials.sign.emissiveIntensity = 0.12 + night * 1.6;
        dealerMaterials.placard.emissiveIntensity = 0.3 + night * 0.7;
        dealerMaterials.pool.opacity = 0.1 + night * 0.35;
        dealerMaterials.cone.opacity = (inside ? 0.035 : 0) + night * (inside ? 0.05 : 0);
        dealerVisual.cones.visible = dealerMaterials.cone.opacity > 0.005;
        // Turntables and rims follow their cars; pools under each car.
        const discs = dealerVisual.discs,
          rims = dealerVisual.rims,
          pools = dealerVisual.pools;
        DEALER.slots.forEach((s, i) => {
          const c = s.car,
            a = c && c.dealerDisplay === s ? c.a : s.a;
          dealerSet(discs, i, s.x, 0.15, s.y, s.r, 0.4, s.r, 0, -a, 0);
          dealerSet(rims, i, s.x, 0.35, s.y, s.r + 0.4, s.r + 0.4, 1, Math.PI / 2, 0, 0);
          dealerSet(pools, i, s.x, 0.4, s.y, s.r * 3.2, s.r * 3.2, 1, -Math.PI / 2, 0, 0);
        });
        // The delivery stage: its own disc and rim, turning with the car on it.
        const st = DEALER.stage,
          reveal = dealer.reveal,
          last = DEALER.slots.length,
          stageA = reveal?.car ? reveal.car.a : (gameTime * 0.1) % TAU;
        dealerSet(discs, last, st.x, 0.15, st.y, st.r, 0.4, st.r, 0, -stageA, 0);
        dealerSet(rims, last, st.x, 0.35, st.y, st.r + 0.4, st.r + 0.4, 1, Math.PI / 2, 0, 0);
        dealerSet(pools, last, st.x, 0.4, st.y, st.r * 3, st.r * 3, 1, -Math.PI / 2, 0, 0);
        discs.instanceMatrix.needsUpdate = rims.instanceMatrix.needsUpdate = pools.instanceMatrix.needsUpdate = true;
        // The curtain: closed from the start of a delivery until it draws back.
        const open = reveal ? reveal.curtain : 1;
        if (Math.abs(open - dealerVisual.curtain) > 0.002 || !dealerVisual.curtainPlaced) {
          dealerVisual.curtain = open;
          dealerVisual.curtainPlaced = true;
          placeDealerCurtain(open);
        }
        // Doors: the sliders open for anyone near, the vehicle door for a car.
        const dp = DEALER.doorPeople,
          dc = DEALER.doorCars,
          dpx = (dp.x0 + dp.x1) / 2,
          dcx = (dc.x0 + dc.x1) / 2,
          nearDoor = (x, y, r) => Math.hypot(player.x - x, player.y - y) < r || pedestrians.some((p) => p.dealer && Math.abs(p.x - x) < r && Math.abs(p.y - y) < r),
          shut = dealer.shutter > 0.5;
        const peopleOpen = !shut && nearDoor(dpx, H.y1, 40) ? 1 : 0,
          carOpen = !shut && (vehicles.some((c) => c.hp > 0 && Math.hypot(c.x - dcx, c.y - H.y1) < 70 && Math.hypot(c.vx || 0, c.vy || 0) > 4) || (player.car && Math.hypot(player.car.x - dcx, player.car.y - H.y1) < 90) || (reveal && reveal.t > 7)) ? 1 : 0;
        dealerVisual.doorPeople += (peopleOpen - dealerVisual.doorPeople) * Math.min(1, deltaSeconds * 4);
        dealerVisual.doorCars += (carOpen - dealerVisual.doorCars) * Math.min(1, deltaSeconds * 1.5);
        for (const m of dealerVisual.slides) m.position.x = m.userData.closedX + m.userData.side * dealerVisual.doorPeople * ((dp.x1 - dp.x0) / 2 - 1);
        dealerVisual.carDoor.position.y = 22.5 + dealerVisual.doorCars * 40;
        // Shutters and broken panes.
        placeDealerShutters(dealer.shutter);
        placeDealerPanes(false);
        // The configurator changes car every six seconds.
        const index = Math.floor(gameTime / 6);
        if (index !== dealerVisual.screenIndex) {
          dealerVisual.screenIndex = index;
          drawDealerScreen(index);
        }
      }
      // Built with the island, before the night light map is painted (render3d.js
      // paintLampLight), so the showroom's pools are in it.
      buildDealership();
      // What DeadEndCity.dealership() adds from the renderer (draw calls built).
      function dealershipRenderReport() {
        return { built: dealerVisual.built, roofShown: dealerVisual.roofShown, draws: dealerVisual.draws || null };
      }
      // END SUBSYSTEM: src/dealership3d.js
