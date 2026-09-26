      // Mountain village 3D textures and materials: window, door and map atlases (MV_TEX, MV_MAT).
      const MVU = UNITS_PER_METRE;
      let mvSeed = 20260926;
      const mvRand = () => ((mvSeed = (mvSeed * 16807) % 2147483647) / 2147483647);
      function mvTexture(width, height, paint) {
        const cv = document.createElement('canvas');
        cv.width = width;
        cv.height = height;
        paint(cv.getContext('2d'), width, height);
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.wrapS = tx.wrapT = Three.RepeatWrapping;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      // Draws `fn(x, y)` at (x, y) and its wrapped copies, so a texture tiles without seams.
      function mvWrap(W, H, x, y, fn) {
        for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) fn(x + dx, y + dy);
      }
      /* ---- Textures (painted once; light and near-neutral where a tint rides in the vertex colour) ---- */
      const MV_TEX = {
        // Hewn logs, 30 cm, with pale chinking: 4 m x 2.4 m to the tile (eight courses).
        logs: mvTexture(512, 256, (g, W, H) => {
          g.fillStyle = '#e4dccc';
          g.fillRect(0, 0, W, H);
          for (let i = 0; i < 8; i++) {
            const y0 = i * 32 + 3,
              grad = g.createLinearGradient(0, y0, 0, y0 + 27);
            grad.addColorStop(0, '#f2e6cf');
            grad.addColorStop(0.35, '#dcc7a6');
            grad.addColorStop(0.8, '#a88e6c');
            grad.addColorStop(1, '#6e5a44');
            g.fillStyle = grad;
            g.fillRect(0, y0, W, 27);
            for (let k = 0; k < 40; k++) {
              g.fillStyle = `rgba(${60 + mvRand() * 40},${40 + mvRand() * 30},20,${0.08 + mvRand() * 0.12})`;
              g.fillRect(mvRand() * W, y0 + 3 + mvRand() * 21, 20 + mvRand() * 90, 1 + mvRand());
            }
            // Butt joints and knots.
            const joint = mvRand() * W;
            g.fillStyle = 'rgba(60,44,30,0.55)';
            g.fillRect(joint, y0, 2, 27);
            for (let k = 0; k < 3; k++) {
              g.fillStyle = 'rgba(80,58,36,0.45)';
              g.beginPath();
              g.ellipse(mvRand() * W, y0 + 8 + mvRand() * 12, 3 + mvRand() * 3, 2, 0, 0, TAU);
              g.fill();
            }
            g.fillStyle = 'rgba(40,30,22,0.5)';
            g.fillRect(0, y0 + 26, W, 2);
          }
        }),
        // Fieldstone in lime mortar: 2.5 m to the tile.
        stone: mvTexture(512, 512, (g, W, H) => {
          g.fillStyle = '#8a857a';
          g.fillRect(0, 0, W, H);
          for (let i = 0; i < 2600; i++) {
            g.fillStyle = mvRand() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
            g.fillRect(mvRand() * W, mvRand() * H, 2, 2);
          }
          const tones = ['#c9c1b3', '#b3ab9e', '#d6cfc2', '#a69f94', '#bfc2bd', '#c7b79d', '#b8ad99', '#9e978d'];
          for (let row = 0; row < 11; row++)
            for (let x = -30 + (row % 2) * 24; x < W; ) {
              const sw = 34 + mvRand() * 40,
                sh = 30 + mvRand() * 16,
                cx = x + sw / 2,
                cy = row * 47 + 24 + (mvRand() - 0.5) * 10,
                tone = tones[Math.floor(mvRand() * tones.length)],
                rot = (mvRand() - 0.5) * 0.4;
              mvWrap(W, H, cx, cy, (px, py) => {
                g.save();
                g.translate(px, py);
                g.rotate(rot);
                g.fillStyle = 'rgba(40,36,30,0.55)';
                g.beginPath();
                g.ellipse(1.5, 2.5, sw / 2, sh / 2, 0, 0, TAU);
                g.fill();
                const grad = g.createLinearGradient(0, -sh / 2, 0, sh / 2);
                grad.addColorStop(0, tone);
                grad.addColorStop(1, SignKit.shade(tone, 0.72));
                g.fillStyle = grad;
                g.beginPath();
                g.ellipse(0, 0, sw / 2 - 1.5, sh / 2 - 1.5, 0, 0, TAU);
                g.fill();
                g.fillStyle = 'rgba(255,255,255,0.18)';
                g.beginPath();
                g.ellipse(-sw * 0.12, -sh * 0.2, sw * 0.28, sh * 0.16, 0, 0, TAU);
                g.fill();
                g.restore();
              });
              x += sw + 3 + mvRand() * 4;
            }
        }),
        // Board and batten, 25 cm boards: 2 m to the tile.
        boards: mvTexture(256, 256, (g, W, H) => {
          for (let i = 0; i < 8; i++) {
            const v = 205 + mvRand() * 30;
            g.fillStyle = `rgb(${v},${v * 0.94},${v * 0.86})`;
            g.fillRect(i * 32, 0, 32, H);
            for (let k = 0; k < 24; k++) {
              g.fillStyle = `rgba(90,70,50,${0.06 + mvRand() * 0.1})`;
              g.fillRect(i * 32 + mvRand() * 30, mvRand() * H, 1, 20 + mvRand() * 80);
            }
            // The batten over the joint, lit on its left and shadowed on its right.
            g.fillStyle = 'rgba(255,248,235,0.5)';
            g.fillRect(i * 32 + 28, 0, 2, H);
            g.fillStyle = 'rgba(40,30,22,0.55)';
            g.fillRect(i * 32 + 30, 0, 3, H);
          }
        }),
        plaster: mvTexture(256, 256, (g, W, H) => {
          g.fillStyle = '#f3eee4';
          g.fillRect(0, 0, W, H);
          for (let i = 0; i < 3000; i++) {
            g.fillStyle = `rgba(${mvRand() < 0.5 ? '255,255,255' : '120,110,95'},${0.04 + mvRand() * 0.06})`;
            g.fillRect(mvRand() * W, mvRand() * H, 1 + mvRand() * 2, 1 + mvRand() * 2);
          }
          for (let i = 0; i < 10; i++) {
            g.fillStyle = 'rgba(150,135,110,0.05)';
            g.beginPath();
            g.ellipse(mvRand() * W, mvRand() * H, 20 + mvRand() * 40, 10 + mvRand() * 30, mvRand(), 0, TAU);
            g.fill();
          }
        }),
        // Cedar shakes, staggered courses: 2.4 m to the tile.
        shake: mvTexture(512, 512, (g, W, H) => {
          g.fillStyle = '#6b5a48';
          g.fillRect(0, 0, W, H);
          for (let row = 0; row < 16; row++) {
            const y0 = row * 32;
            for (let x = -(row * 17) % 40; x < W; ) {
              const sw = 16 + mvRand() * 30,
                v = 170 + mvRand() * 60;
              g.fillStyle = `rgb(${v},${v * 0.9},${v * 0.78})`;
              g.fillRect(x + 1, y0, sw - 2, 31);
              for (let k = 0; k < 4; k++) {
                g.fillStyle = `rgba(70,50,30,${0.1 + mvRand() * 0.15})`;
                g.fillRect(x + 2 + mvRand() * (sw - 4), y0 + 2, 1, 24 + mvRand() * 6);
              }
              x += sw;
            }
            const shadow = g.createLinearGradient(0, y0 + 22, 0, y0 + 32);
            shadow.addColorStop(0, 'rgba(0,0,0,0)');
            shadow.addColorStop(1, 'rgba(20,12,6,0.6)');
            g.fillStyle = shadow;
            g.fillRect(0, y0 + 22, W, 10);
          }
          for (let i = 0; i < 40; i++) {
            g.fillStyle = 'rgba(80,100,60,0.08)';
            g.beginPath();
            g.ellipse(mvRand() * W, mvRand() * H, 20 + mvRand() * 30, 8 + mvRand() * 12, 0, 0, TAU);
            g.fill();
          }
        }),
        // Slate, rectangular, staggered: 2.4 m to the tile.
        slate: mvTexture(512, 512, (g, W, H) => {
          g.fillStyle = '#3a3d42';
          g.fillRect(0, 0, W, H);
          for (let row = 0; row < 13; row++) {
            const y0 = row * 40;
            for (let x = row % 2 ? -26 : 0; x < W; x += 52) {
              const v = 175 + mvRand() * 45;
              g.fillStyle = `rgb(${v * 0.96},${v},${v * 1.04})`;
              g.fillRect(x + 1.5, y0 + 1, 49, 38);
              g.fillStyle = 'rgba(255,255,255,0.12)';
              g.fillRect(x + 1.5, y0 + 1, 49, 3);
              g.fillStyle = 'rgba(0,0,0,0.25)';
              g.fillRect(x + 1.5, y0 + 34, 49, 5);
            }
          }
        }),
        // Standing seam, 45 cm pans: 2.7 m to the tile.
        metal: mvTexture(256, 256, (g, W, H) => {
          g.fillStyle = '#d6d6d6';
          g.fillRect(0, 0, W, H);
          for (let i = 0; i < 6; i++) {
            const x = (i * W) / 6,
              grad = g.createLinearGradient(x, 0, x + W / 6, 0);
            grad.addColorStop(0, '#e6e6e6');
            grad.addColorStop(0.5, '#cfcfcf');
            grad.addColorStop(1, '#bdbdbd');
            g.fillStyle = grad;
            g.fillRect(x, 0, W / 6, H);
            g.fillStyle = '#f7f7f7';
            g.fillRect(x, 0, 2, H);
            g.fillStyle = '#8f8f8f';
            g.fillRect(x + 2, 0, 2, H);
          }
          for (let i = 0; i < 60; i++) {
            g.fillStyle = 'rgba(90,70,50,0.05)';
            g.fillRect(mvRand() * W, mvRand() * H, 2, 30 + mvRand() * 80);
          }
        }),
        // Timber: beams, posts, frames (grain along u): 2 m to the tile.
        timber: mvTexture(256, 256, (g, W, H) => {
          g.fillStyle = '#d2bfa2';
          g.fillRect(0, 0, W, H);
          for (let i = 0; i < 220; i++) {
            g.fillStyle = `rgba(90,62,36,${0.08 + mvRand() * 0.16})`;
            g.fillRect(mvRand() * W, mvRand() * H, 30 + mvRand() * 120, 1 + mvRand() * 1.5);
          }
        }),
        // Deck and boardwalk planks (running along u, 19 cm): 2 m to the tile.
        planks: mvTexture(256, 256, (g, W, H) => {
          for (let row = 0; row < 11; row++) {
            const y0 = Math.round((row * H) / 11);
            for (let x = -mvRand() * 128; x < W; x += 128) {
              const v = 190 + mvRand() * 45;
              g.fillStyle = `rgb(${v},${v * 0.9},${v * 0.78})`;
              g.fillRect(x, y0, 128, H / 11);
              g.fillStyle = 'rgba(40,28,18,0.55)';
              g.fillRect(x, y0, 1.5, H / 11);
            }
            for (let k = 0; k < 14; k++) {
              g.fillStyle = `rgba(90,62,36,${0.08 + mvRand() * 0.12})`;
              g.fillRect(mvRand() * W, y0 + 2 + mvRand() * (H / 11 - 4), 20 + mvRand() * 60, 1);
            }
            g.fillStyle = 'rgba(30,20,12,0.6)';
            g.fillRect(0, y0 + H / 11 - 2, W, 2);
          }
        }),
        // A stack of split log ends (firewood, woodpiles): 1 m to the tile.
        stack: mvTexture(256, 256, (g, W, H) => {
          g.fillStyle = '#3a2a1c';
          g.fillRect(0, 0, W, H);
          for (let row = 0; row < 9; row++)
            for (let x = (row % 2) * 14; x < W + 20; x += 28) {
              const cx = x + (mvRand() - 0.5) * 5,
                cy = row * 29 + 14 + (mvRand() - 0.5) * 4,
                r = 11 + mvRand() * 4;
              mvWrap(W, H, cx, cy, (px, py) => {
                g.fillStyle = '#6a4a30';
                g.beginPath();
                g.arc(px, py, r + 1.5, 0, TAU);
                g.fill();
                g.fillStyle = mvRand() < 0.5 ? '#d9b98c' : '#c9a476';
                g.beginPath();
                // Split logs: half and quarter rounds as well as whole ones.
                const k = Math.floor(mvRand() * 3);
                if (k === 0) g.arc(px, py, r, 0, TAU);
                else g.arc(px, py, r, k === 1 ? 0 : Math.PI / 2, k === 1 ? Math.PI : Math.PI * 2);
                g.fill();
                g.strokeStyle = 'rgba(120,80,40,0.45)';
                g.lineWidth = 1;
                for (let ring = 3; ring < r; ring += 3) {
                  g.beginPath();
                  g.arc(px, py, ring, 0, TAU);
                  g.stroke();
                }
              });
            }
        }),
        gravel: mvTexture(512, 512, (g, W, H) => {
          g.fillStyle = '#a39683';
          g.fillRect(0, 0, W, H);
          for (let i = 0; i < 14000; i++) {
            const v = 120 + mvRand() * 110;
            g.fillStyle = `rgba(${v},${v * 0.93},${v * 0.82},${0.4 + mvRand() * 0.5})`;
            g.fillRect(mvRand() * W, mvRand() * H, 1 + mvRand() * 3, 1 + mvRand() * 2.5);
          }
        }),
        dirt: mvTexture(512, 512, (g, W, H) => {
          g.fillStyle = '#8c7658';
          g.fillRect(0, 0, W, H);
          for (let i = 0; i < 60; i++) {
            g.fillStyle = `rgba(${mvRand() < 0.5 ? '60,45,30' : '170,150,115'},0.12)`;
            g.beginPath();
            g.ellipse(mvRand() * W, mvRand() * H, 20 + mvRand() * 60, 10 + mvRand() * 30, mvRand() * 3, 0, TAU);
            g.fill();
          }
          for (let i = 0; i < 6000; i++) {
            g.fillStyle = `rgba(${mvRand() < 0.5 ? '60,45,30' : '200,180,140'},0.25)`;
            g.fillRect(mvRand() * W, mvRand() * H, 1.5, 1.5);
          }
        }),
        // Cobbled setts in shallow arcs (the squares): 3 m to the tile.
        cobbles: mvTexture(512, 512, (g, W, H) => {
          g.fillStyle = '#6f6960';
          g.fillRect(0, 0, W, H);
          for (let row = 0; row < 22; row++)
            for (let x = (row % 2) * 12; x < W; x += 24) {
              const v = 150 + mvRand() * 60,
                y = row * 23.3 + Math.sin((x / W) * TAU * 2) * 4;
              g.fillStyle = `rgb(${v},${v * 0.96},${v * 0.9})`;
              g.beginPath();
              g.ellipse(x + 11, y + 11, 10.5, 10, 0, 0, TAU);
              g.fill();
              g.fillStyle = 'rgba(255,255,255,0.12)';
              g.beginPath();
              g.ellipse(x + 9, y + 8, 6, 4, 0, 0, TAU);
              g.fill();
            }
        }),
        // Carved balcony boards: tulip cut-outs between the rails (alpha): 2 m x 1 m.
        railing: mvTexture(256, 128, (g, W, H) => {
          g.clearRect(0, 0, W, H);
          g.fillStyle = '#e8d9bf';
          g.fillRect(0, 0, W, 14);
          g.fillRect(0, H - 12, W, 12);
          for (let i = 0; i < 8; i++) {
            const x0 = i * 32 + 3;
            g.fillStyle = '#e0cfb2';
            g.fillRect(x0, 14, 26, H - 26);
            g.fillStyle = 'rgba(120,90,60,0.4)';
            g.fillRect(x0 + 24, 14, 2, H - 26);
            // The cut-out: a tulip on the joint between boards (cleared, so it reads as a hole).
            g.save();
            g.globalCompositeOperation = 'destination-out';
            const cx = x0 + 29.5,
              cy = H / 2;
            g.beginPath();
            g.moveTo(cx, cy + 26);
            g.bezierCurveTo(cx - 12, cy + 10, cx - 11, cy - 16, cx, cy - 26);
            g.bezierCurveTo(cx + 11, cy - 16, cx + 12, cy + 10, cx, cy + 26);
            g.fill();
            g.restore();
          }
          g.fillStyle = 'rgba(60,40,24,0.5)';
          g.fillRect(0, 12, W, 2);
          g.fillRect(0, H - 12, W, 2);
        }),
        // Louvred shutter (one per quad).
        shutter: mvTexture(64, 128, (g, W, H) => {
          g.fillStyle = '#e6e2da';
          g.fillRect(0, 0, W, H);
          g.fillStyle = 'rgba(0,0,0,0.35)';
          for (let y = 8; y < H - 8; y += 6) g.fillRect(6, y, W - 12, 2);
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.lineWidth = 4;
          g.strokeRect(2, 2, W - 4, H - 4);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(W / 2 - 1, H / 2 - 20, 2, 40);
        }),
        // Striped canvas awning (bakery and café), painted in its colours.
        awning: mvTexture(256, 64, (g, W, H) => {
          for (let i = 0; i < 8; i++) {
            g.fillStyle = i % 2 ? '#f1e8d2' : '#2f5a3a';
            g.fillRect(i * 32, 0, 32, H);
          }
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(0, H - 10, W, 10);
        }),
      };
      /* Windows (a 2 x 2 atlas, day face and night glow): 0 four-pane casement,
         1 six-pane sash, 2 shop window with a transom, 3 pointed chapel light. */
      function mvWindowAtlas(glow) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 512;
        const g = cv.getContext('2d');
        mvSeed = glow ? 777 : 777;
        const cell = (i, paint) => {
          g.save();
          g.translate((i % 2) * 256, Math.floor(i / 2) * 256);
          g.beginPath();
          g.rect(0, 0, 256, 256);
          g.clip();
          paint();
          g.restore();
        };
        const frame = glow ? '#000' : '#efe8da',
          pane = (x, y, w, h) => {
            if (glow) {
              const v = 0.55 + mvRand() * 0.45,
                grad = g.createRadialGradient(x + w / 2, y + h * 0.6, 2, x + w / 2, y + h / 2, Math.max(w, h));
              grad.addColorStop(0, `rgba(255,${200 + v * 30},${130 + v * 40},${v})`);
              grad.addColorStop(1, `rgba(255,170,90,${v * 0.55})`);
              g.fillStyle = grad;
              g.fillRect(x, y, w, h);
            } else {
              const grad = g.createLinearGradient(x, y, x + w * 0.6, y + h);
              grad.addColorStop(0, '#7f97a8');
              grad.addColorStop(0.45, '#2c3c48');
              grad.addColorStop(1, '#1a232b');
              g.fillStyle = grad;
              g.fillRect(x, y, w, h);
              g.fillStyle = 'rgba(255,255,255,0.18)';
              g.beginPath();
              g.moveTo(x, y + h * 0.35);
              g.lineTo(x + w * 0.35, y);
              g.lineTo(x + w * 0.5, y);
              g.lineTo(x, y + h * 0.5);
              g.fill();
            }
          };
        const curtains = (x, y, w, h) => {
          // Curtains at the sides: warm fabric by day, a darker hem against the glow.
          g.fillStyle = glow ? 'rgba(90,40,10,0.55)' : 'rgba(170,60,50,0.55)';
          g.fillRect(x, y, w * 0.18, h);
          g.fillRect(x + w * 0.82, y, w * 0.18, h);
        };
        cell(0, () => {
          g.fillStyle = frame;
          g.fillRect(0, 0, 256, 256);
          for (const [x, y] of [[22, 22], [134, 22], [22, 134], [134, 134]]) pane(x, y, 100, 100);
          curtains(22, 22, 212, 212);
        });
        cell(1, () => {
          g.fillStyle = frame;
          g.fillRect(0, 0, 256, 256);
          for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) pane(24 + c * 108, 18 + r * 76, 100, 68);
          curtains(24, 18, 208, 220);
        });
        cell(2, () => {
          g.fillStyle = glow ? '#000' : '#3a2a1e';
          g.fillRect(0, 0, 256, 256);
          for (let c = 0; c < 4; c++) pane(14 + c * 58, 12, 54, 40);
          pane(14, 62, 228, 182);
          if (!glow) {
            g.fillStyle = 'rgba(230,220,200,0.25)';
            g.fillRect(14, 200, 228, 44);
          }
        });
        cell(3, () => {
          g.fillStyle = glow ? '#000' : '#e8e2d4';
          g.fillRect(0, 0, 256, 256);
          g.save();
          g.beginPath();
          g.moveTo(40, 246);
          g.lineTo(40, 110);
          g.quadraticCurveTo(40, 40, 128, 12);
          g.quadraticCurveTo(216, 40, 216, 110);
          g.lineTo(216, 246);
          g.closePath();
          g.clip();
          pane(40, 10, 176, 240);
          if (!glow)
            for (const [a, b] of [['#7a2a4a', '#2a4a7a'], ['#b08a2a', '#2a6a4a']]) {
              g.fillStyle = a + '55';
              g.fillRect(50, 60 + mvRand() * 100, 70, 40);
              g.fillStyle = b + '55';
              g.fillRect(130, 60 + mvRand() * 100, 70, 40);
            }
          g.strokeStyle = glow ? '#000' : '#2b2b2b';
          g.lineWidth = 3;
          for (let y = 40; y < 250; y += 30) {
            g.beginPath();
            g.moveTo(40, y);
            g.lineTo(216, y);
            g.stroke();
          }
          g.beginPath();
          g.moveTo(128, 0);
          g.lineTo(128, 256);
          g.stroke();
          g.restore();
        });
        const tx = new Three.CanvasTexture(cv);
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tx;
      }
      const mvWindowDay = mvWindowAtlas(false),
        mvWindowGlow = mvWindowAtlas(true);
      const MV_WINDOW_CELL = [
        [0, 0.5, 0.5, 1],
        [0.5, 0.5, 1, 1],
        [0, 0, 0.5, 0.5],
        [0.5, 0, 1, 0.5],
      ];
      /* Doors (1024 x 256): 0 plank door with strap hinges, 1 glazed door, 2 carved
         double door, 3 barn door with its X braces, 4 vertical-board bay door. */
      const mvDoorTexture = mvTexture(1024, 256, (g) => {
        const planks = (x, w, h, tone) => {
          for (let i = 0; i < w; i += 16) {
            const v = tone + mvRand() * 20;
            g.fillStyle = `rgb(${v},${v * 0.78},${v * 0.55})`;
            g.fillRect(x + i, 0, 15, h);
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.fillRect(x + i + 15, 0, 1, h);
          }
        };
        planks(0, 128, 256, 110);
        g.fillStyle = '#1b1b1b';
        for (const y of [40, 200]) g.fillRect(6, y, 100, 8);
        g.fillStyle = '#2c3a44';
        g.fillRect(40, 60, 48, 40);
        g.fillStyle = '#c9a44a';
        g.fillRect(104, 128, 8, 14);
        // Glazed door.
        planks(128, 128, 256, 120);
        g.fillStyle = '#233039';
        g.fillRect(146, 20, 92, 120);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(150, 24, 30, 112);
        g.fillStyle = '#c9a44a';
        g.fillRect(232, 150, 6, 16);
        // Carved double door with arched panels.
        planks(256, 256, 256, 95);
        g.strokeStyle = 'rgba(30,18,10,0.7)';
        g.lineWidth = 5;
        for (const x of [270, 398]) {
          g.beginPath();
          g.moveTo(x, 240);
          g.lineTo(x, 70);
          g.quadraticCurveTo(x + 50, 18, x + 100, 70);
          g.lineTo(x + 100, 240);
          g.stroke();
        }
        g.fillStyle = '#1b1b1b';
        g.fillRect(382, 10, 4, 240);
        g.fillStyle = '#c9a44a';
        g.fillRect(372, 130, 6, 18);
        g.fillRect(390, 130, 6, 18);
        // Barn door: boards, frame and an X brace.
        planks(512, 256, 256, 120);
        g.strokeStyle = '#f1e8d2';
        g.lineWidth = 14;
        g.strokeRect(519, 7, 242, 242);
        g.beginPath();
        g.moveTo(519, 7);
        g.lineTo(761, 249);
        g.moveTo(761, 7);
        g.lineTo(519, 249);
        g.stroke();
        // Bay door: vertical boards, a row of lights, a rail.
        planks(768, 256, 256, 105);
        g.fillStyle = '#2a3640';
        for (let k = 0; k < 4; k++) g.fillRect(784 + k * 60, 40, 44, 30);
        g.fillStyle = '#1b1b1b';
        g.fillRect(768, 0, 256, 8);
      });
      mvDoorTexture.wrapS = mvDoorTexture.wrapT = Three.ClampToEdgeWrapping;
      const MV_DOOR_CELL = [
        [0, 0.125],
        [0.125, 0.25],
        [0.25, 0.5],
        [0.5, 0.75],
        [0.75, 1],
      ];
      // A topo trail map (the club's walls, the trailhead board).
      const mvMapTexture = mvTexture(512, 256, (g, W, H) => {
        g.fillStyle = '#e9dfc4';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(130,100,60,0.5)';
        g.lineWidth = 1.2;
        for (let k = 0; k < 14; k++) {
          g.beginPath();
          for (let a = 0; a <= TAU + 0.01; a += 0.2) {
            const r = 20 + k * 11 + Math.sin(a * 3 + k) * 6;
            const x = 180 + Math.cos(a) * r * 1.3,
              y = 110 + Math.sin(a) * r * 0.8;
            if (a === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.stroke();
        }
        g.fillStyle = 'rgba(70,120,160,0.6)';
        g.beginPath();
        g.ellipse(380, 150, 50, 22, 0.3, 0, TAU);
        g.fill();
        g.strokeStyle = '#c0301f';
        g.lineWidth = 3;
        g.setLineDash([6, 4]);
        g.beginPath();
        g.moveTo(170, 240);
        for (let k = 0; k < 8; k++) g.lineTo(150 + (k % 2) * 60, 220 - k * 22);
        g.lineTo(180, 90);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = '#3b2a1a';
        g.font = 'bold 26px Georgia, serif';
        g.fillText('RIDGELINE TRAILS', 290, 44);
        g.strokeStyle = '#3b2a1a';
        g.lineWidth = 4;
        g.strokeRect(4, 4, W - 8, H - 8);
      });
      /* ---- Materials: one per finish, tinted per vertex ------------------------------------ */
      const mvStd = (options) => new Three.MeshStandardMaterial({ vertexColors: true, ...options });
      const MV_MAT = {
        logs: mvStd({ map: MV_TEX.logs, roughness: 0.92 }),
        stone: mvStd({ map: MV_TEX.stone, roughness: 0.95 }),
        boards: mvStd({ map: MV_TEX.boards, roughness: 0.9 }),
        plaster: mvStd({ map: MV_TEX.plaster, roughness: 0.96 }),
        shake: mvStd({ map: MV_TEX.shake, roughness: 0.94 }),
        slate: mvStd({ map: MV_TEX.slate, roughness: 0.6, metalness: 0.08 }),
        metal: mvStd({ map: MV_TEX.metal, roughness: 0.5, metalness: 0.2 }),
        timber: mvStd({ map: MV_TEX.timber, roughness: 0.88 }),
        planks: mvStd({ map: MV_TEX.planks, roughness: 0.9 }),
        stack: mvStd({ map: MV_TEX.stack, roughness: 0.95 }),
        paint: mvStd({ roughness: 0.75 }),
        iron: mvStd({ roughness: 0.55, metalness: 0.65 }),
        chrome: mvStd({ roughness: 0.2, metalness: 0.9 }),
        glass: mvStd({ roughness: 0.1, metalness: 0.6 }),
        snow: mvStd({ roughness: 0.7 }),
        railing: mvStd({ map: MV_TEX.railing, roughness: 0.9, alphaTest: 0.5, side: Three.DoubleSide }),
        shutter: mvStd({ map: MV_TEX.shutter, roughness: 0.8 }),
        awning: mvStd({ map: MV_TEX.awning, roughness: 0.9, side: Three.DoubleSide }),
        door: mvStd({ map: mvDoorTexture, roughness: 0.8 }),
        map: mvStd({ map: mvMapTexture, roughness: 0.85 }),
        gravel: mvStd({ map: MV_TEX.gravel, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
        dirt: mvStd({ map: MV_TEX.dirt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
        cobbles: mvStd({ map: MV_TEX.cobbles, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
        water: mvStd({ color: '#ffffff', roughness: 0.05, metalness: 0.35, emissive: '#10323c', emissiveIntensity: 0.1 }),
        // Windows: lit from inside at night (the lit set) or dark rooms.
        windowLit: mvStd({ map: mvWindowDay, emissiveMap: mvWindowGlow, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.3, metalness: 0.2 }),
        windowDark: mvStd({ map: mvWindowDay, emissiveMap: mvWindowGlow, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.3, metalness: 0.2 }),
        // Lamp glass, lantern panes, the fire: emissive at night.
        lamp: mvStd({ emissive: '#ffc977', emissiveIntensity: 0, roughness: 0.3 }),
        ember: mvStd({ emissive: '#ff6a1a', emissiveIntensity: 0.6, roughness: 0.9 }),
      };
      for (const m of Object.values(MV_MAT)) m.userData.mountainKit = true;
      // Metres per texture repeat [u, v] for world-anchored UVs.
      const MV_TILE = {
        logs: [4, 2.4], stone: [2.5, 2.5], boards: [2, 2], plaster: [3, 3], shake: [2.4, 2.4], slate: [2.4, 2.4], metal: [2.7, 2.7],
        timber: [2, 2], planks: [2, 2], stack: [1, 1], gravel: [4, 4], dirt: [5, 5], cobbles: [3, 3], railing: [2, 1], awning: [2, 0.5],
      };
