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
          floor: new Three.MeshStandardMaterial({ map: floorTex, color: '#d8d3c9', roughness: 0.12, metalness: 0.05, envMapIntensity: 1.3 }),
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
