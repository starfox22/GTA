      // BEGIN SUBSYSTEM: src/mountain-village3d.js — Mountain village meshes
      /**
       * Mountain village meshes
       * Source: src/mountain-village3d.js
       * Scope: createCityRenderer() closure (included after offroad3d.js).
       *
       * The Ridgeline island's own architecture (mountain-village.js has the
       * plan): a kit of painted materials (hewn logs with chinking, fieldstone,
       * board and batten, lime plaster, cedar shakes, slate, standing-seam metal,
       * planks, carved balcony boards, shutters, windows lit from inside at night)
       * and the pieces built from them: plinths, jettied upper storeys, gables,
       * steep roofs with deep overhangs, bargeboards and ridge caps, rafter tails,
       * dormers, cross gables, stone chimneys, carved balconies with flower boxes,
       * porches on posts over plank boardwalks, false fronts, log corner notches,
       * a steeple, a fire lookout, the gas station's timber canopy, the sawmill,
       * the fountain and the well, split-rail fences and firewood.
       *
       * PERFORMANCE. Nothing is a mesh per piece: every piece is written straight
       * into one vertex buffer per material per town (world-anchored UVs, the
       * tint in vertex colours), so a whole town is about twenty draw calls,
       * shadows included; the lantern lamps are instanced (and knockable, like the
       * city's); the signs share one atlas; the night light pools are one
       * additive mesh per town. mountainVillageInfo() reports the counts.
       *
       * THE CLUBHOUSE (offroad.js OFFROAD_CLUB): stone ground floor, log upper
       * storey, a big roof with a glazed front gable, the veranda and balcony,
       * the workshop bay, the yard with its fire pit and BBQ, the gravel lot, the
       * gate with the carved 4X4 CLUB sign. Inside: the bar with its taps and back
       * bar, two pool tables under wagon-wheel lamps, leather couches round the
       * stone fireplace, the big TV, trail maps, trophies and mounted parts; the
       * workshop's lift, bench, chests and tyres. While the player is inside, the
       * roof, the upper storey and the top of the front wall lift off (and the
       * cutaway hole opens round them, lighting3d.js).
       */
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
        metal: mvStd({ map: MV_TEX.metal, roughness: 0.42, metalness: 0.55 }),
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
        water: mvStd({ color: '#ffffff', roughness: 0.05, metalness: 0.35, emissive: '#1a5a70', emissiveIntensity: 0.15 }),
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
      /* ---- The kit: pieces written straight into per-material buffers ---------------------- */
      const mvColor = new Three.Color(),
        mvTmp = new Three.Color();
      function mvBatch(name) {
        return { name, parts: new Map() };
      }
      function mvBuf(batch, material) {
        let b = batch.parts.get(material);
        if (!b) batch.parts.set(material, (b = { pos: [], nor: [], uv: [], col: [], idx: [] }));
        return b;
      }
      const mvV3 = (x, y, z) => new Three.Vector3(x, y, z);
      // A quad p0..p3 counter-clockwise seen from its front; uvs explicit or world-projected.
      function mvQuad(batch, material, p, color, uvs = null, shade = true) {
        const b = mvBuf(batch, material),
          base = b.pos.length / 3,
          e1 = mvV3(p[1].x - p[0].x, p[1].y - p[0].y, p[1].z - p[0].z),
          e2 = mvV3(p[3].x - p[0].x, p[3].y - p[0].y, p[3].z - p[0].z),
          n = e1.clone().cross(e2).normalize(),
          tile = MV_TILE[material] || [2, 2];
        let U = null,
          Vv = null;
        if (!uvs) {
          if (Math.abs(n.y) > 0.85) {
            U = mvV3(1, 0, 0);
            Vv = mvV3(0, 0, -1);
          } else {
            // To the viewer's right (horizontal), and up the face (up the slope on a roof).
            U = mvV3(0, 1, 0).cross(n).normalize();
            Vv = n.clone().cross(U).normalize();
          }
        }
        mvColor.set(color);
        for (let k = 0; k < 4; k++) {
          const q = p[k];
          b.pos.push(q.x, q.y, q.z);
          b.nor.push(n.x, n.y, n.z);
          if (uvs) b.uv.push(uvs[k][0], uvs[k][1]);
          else b.uv.push((q.x * U.x + q.y * U.y + q.z * U.z) / (tile[0] * MVU), (q.x * Vv.x + q.y * Vv.y + q.z * Vv.z) / (tile[1] * MVU));
          // Walls darken towards the ground (splash and shade under the eaves' drip line).
          const s = shade && Math.abs(n.y) < 0.5 ? 0.8 + 0.2 * clamp(q.y / (1.6 * MVU), 0, 1) : 1;
          b.col.push(mvColor.r * s, mvColor.g * s, mvColor.b * s);
        }
        b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      function mvTri(batch, material, a, bb, c, color) {
        // A degenerate quad keeps one code path (the fourth corner on the third).
        mvQuad(batch, material, [a, bb, c, c], color);
      }
      // An oriented box: centre c, unit axes [X, Y, Z], half sizes [hx, hy, hz]; `skip` names faces to leave out.
      function mvOBox(batch, material, c, axes, half, color, skip = '') {
        const [X, Y, Z] = axes,
          faces = [
            ['px', X, Y, Z, half[0], half[1], half[2]],
            ['nx', X.clone().negate(), Y, Z, half[0], half[1], half[2]],
            ['py', Y, Z, X, half[1], half[2], half[0]],
            ['ny', Y.clone().negate(), Z, X, half[1], half[2], half[0]],
            ['pz', Z, X, Y, half[2], half[0], half[1]],
            ['nz', Z.clone().negate(), X, Y, half[2], half[0], half[1]],
          ];
        for (const [id, N, A0, B0, hn, ha, hb] of faces) {
          if (skip.includes(id)) continue;
          let A = A0,
            B = B0,
            a = ha,
            bh = hb;
          if (A.clone().cross(B).dot(N) < 0) {
            [A, B] = [B, A];
            [a, bh] = [bh, a];
          }
          const o = c.clone().addScaledVector(N, hn),
            corner = (sa, sb) => o.clone().addScaledVector(A, sa * a).addScaledVector(B, sb * bh);
          mvQuad(batch, material, [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], color);
        }
      }
      const mvAX = mvV3(1, 0, 0),
        mvAY = mvV3(0, 1, 0),
        mvAZ = mvV3(0, 0, 1);
      // An axis-aligned box (optionally turned `yaw` about the vertical).
      function mvBox(batch, material, cx, cy, cz, sx, sy, sz, color, yaw = 0, skip = '') {
        const axes = yaw ? [mvV3(Math.cos(yaw), 0, -Math.sin(yaw)), mvAY, mvV3(Math.sin(yaw), 0, Math.cos(yaw))] : [mvAX, mvAY, mvAZ];
        mvOBox(batch, material, mvV3(cx, cy, cz), axes, [sx / 2, sy / 2, sz / 2], color, skip);
      }
      // A box from its base (y0 at the bottom).
      function mvBlock(batch, material, x0, y0, z0, x1, y1, z1, color, skip = 'ny') {
        mvBox(batch, material, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, 0, skip);
      }
      // A prism (cylinder) from a to b, radius r, `sides`; `cap` material for the ends (or none).
      function mvCyl(batch, material, a, b, r, sides, color, cap = null, capColor = color) {
        const d = mvV3(b.x - a.x, b.y - a.y, b.z - a.z),
          length = d.length();
        d.normalize();
        const ref = Math.abs(d.y) < 0.9 ? mvAY : mvAX,
          e1 = ref.clone().cross(d).normalize(),
          e2 = d.clone().cross(e1).normalize(),
          tile = MV_TILE[material] || [2, 2],
          buf = mvBuf(batch, material);
        mvColor.set(color);
        const circumference = TAU * r;
        for (let k = 0; k < sides; k++) {
          const a0 = (k / sides) * TAU,
            a1 = ((k + 1) / sides) * TAU,
            n0 = e1.clone().multiplyScalar(Math.cos(a0)).addScaledVector(e2, Math.sin(a0)),
            n1 = e1.clone().multiplyScalar(Math.cos(a1)).addScaledVector(e2, Math.sin(a1)),
            base = buf.pos.length / 3,
            pts = [a.clone().addScaledVector(n0, r), a.clone().addScaledVector(n1, r), b.clone().addScaledVector(n1, r), b.clone().addScaledVector(n0, r)],
            norms = [n0, n1, n1, n0],
            us = [k / sides, (k + 1) / sides, (k + 1) / sides, k / sides].map((u) => (u * circumference) / (tile[0] * MVU)),
            vs = [0, 0, length, length].map((v) => v / (tile[1] * MVU));
          for (let i = 0; i < 4; i++) {
            buf.pos.push(pts[i].x, pts[i].y, pts[i].z);
            buf.nor.push(norms[i].x, norms[i].y, norms[i].z);
            buf.uv.push(vs[i], us[i]);
            buf.col.push(mvColor.r, mvColor.g, mvColor.b);
          }
          // Outward winding: (p1 - p0) x (p2 - p0) = L (e2 x d) = L e1 at the seam.
          buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        if (cap) {
          const cb = mvBuf(batch, cap);
          mvTmp.set(capColor);
          for (const [p, sign] of [
            [a, -1],
            [b, 1],
          ]) {
            const base = cb.pos.length / 3,
              n = d.clone().multiplyScalar(sign);
            cb.pos.push(p.x, p.y, p.z);
            cb.nor.push(n.x, n.y, n.z);
            cb.uv.push(0.5, 0.5);
            cb.col.push(mvTmp.r, mvTmp.g, mvTmp.b);
            for (let k = 0; k < sides; k++) {
              const ang = (k / sides) * TAU,
                q = p.clone().addScaledVector(e1, Math.cos(ang) * r).addScaledVector(e2, Math.sin(ang) * r);
              cb.pos.push(q.x, q.y, q.z);
              cb.nor.push(n.x, n.y, n.z);
              cb.uv.push(0.5 + Math.cos(ang) * 0.12, 0.5 + Math.sin(ang) * 0.12);
              cb.col.push(mvTmp.r, mvTmp.g, mvTmp.b);
            }
            for (let k = 0; k < sides; k++) {
              const i0 = base + 1 + k,
                i1 = base + 1 + ((k + 1) % sides);
              if (sign > 0) cb.idx.push(base, i0, i1);
              else cb.idx.push(base, i1, i0);
            }
          }
        }
      }
      // Any three.js geometry, placed by a matrix (flowers, rocks, chairs' curves, tyres).
      const mvMatrix = new Three.Matrix4(),
        mvNormalMatrix = new Three.Matrix3();
      function mvGeometry(batch, material, geo, x, y, z, sx, sy, sz, color, yaw = 0, pitch = 0) {
        mvMatrix.compose(mvV3(x, y, z), new Three.Quaternion().setFromEuler(new Three.Euler(pitch, yaw, 0, 'YXZ')), mvV3(sx, sy, sz));
        mvNormalMatrix.getNormalMatrix(mvMatrix);
        const buf = mvBuf(batch, material),
          base = buf.pos.length / 3,
          pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv,
          v = new Three.Vector3();
        mvColor.set(color);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mvMatrix);
          buf.pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(nor, i).applyMatrix3(mvNormalMatrix).normalize();
          buf.nor.push(v.x, v.y, v.z);
          buf.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          buf.col.push(mvColor.r, mvColor.g, mvColor.b);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) buf.idx.push(base + geo.index.getX(i));
        else for (let i = 0; i < pos.count; i++) buf.idx.push(base + i);
      }
      const MV_GEO = {
        blob: new Three.IcosahedronGeometry(1, 0),
        rock: new Three.DodecahedronGeometry(1, 0),
        torus: new Three.TorusGeometry(1, 0.42, 6, 14),
        ball: new Three.SphereGeometry(1, 6, 4),
        cone: new Three.ConeGeometry(1, 1, 10),
      };
      // A flat decal on the ground (gravel, dirt, cobbles, the helipad): y just above the county sheet.
      function mvGround(batch, material, x0, z0, x1, z1, color = '#ffffff', y = 0.12) {
        mvQuad(batch, material, [mvV3(x0, y, z1), mvV3(x1, y, z1), mvV3(x1, y, z0), mvV3(x0, y, z0)], color, null, false);
      }
      // Pieces with uvs from an atlas cell: [u0, v0, u1, v1].
      function mvCellQuad(batch, material, p, cell, color = '#ffffff') {
        const [u0, v0, u1, v1] = cell;
        mvQuad(batch, material, p, color, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], false);
      }
      // A vertical rectangle facing +z (south) at z, centred on x, from y0 to y1.
      function mvFacing(x, y0, y1, z, width, facing = 'south') {
        const h = width / 2;
        if (facing === 'south') return [mvV3(x - h, y0, z), mvV3(x + h, y0, z), mvV3(x + h, y1, z), mvV3(x - h, y1, z)];
        if (facing === 'north') return [mvV3(x + h, y0, z), mvV3(x - h, y0, z), mvV3(x - h, y1, z), mvV3(x + h, y1, z)];
        // East / west faces: `x` is the face's x and `z` the centre along it.
        if (facing === 'east') return [mvV3(x, y0, z + h), mvV3(x, y0, z - h), mvV3(x, y1, z - h), mvV3(x, y1, z + h)];
        return [mvV3(x, y0, z - h), mvV3(x, y0, z + h), mvV3(x, y1, z + h), mvV3(x, y1, z - h)];
      }
      const mvMix = (a, b, t) => '#' + new Three.Color(a).lerp(new Three.Color(b), t).getHexString();
      /* ---- Signs: every village board in one atlas (SignArt designs), one material ---------- */
      const MV_SIGN_W = 512,
        MV_SIGN_H = 128,
        MV_SIGN_COLS = 4;
      const mvSignTexts = [];
      for (const b of MOUNTAIN_VILLAGE.buildings) if (b.name) mvSignTexts.push(b.name);
      mvSignTexts.push('4X4 CLUB', 'RIDGELINE 4X4 CLUB', 'MOUNT ASCENT TRAILHEAD', 'VACANCY', 'MECHANICS', '4X4 CLUB · TV');
      const mvSignRows = Math.ceil(mvSignTexts.length / MV_SIGN_COLS),
        mvSignDay = document.createElement('canvas'),
        mvSignGlow = document.createElement('canvas');
      mvSignDay.width = mvSignGlow.width = MV_SIGN_W * MV_SIGN_COLS;
      mvSignDay.height = mvSignGlow.height = MV_SIGN_H * mvSignRows;
      const mvSignCells = new Map();
      {
        const dg = mvSignDay.getContext('2d'),
          gg = mvSignGlow.getContext('2d');
        gg.fillStyle = '#000';
        gg.fillRect(0, 0, mvSignGlow.width, mvSignGlow.height);
        mvSignTexts.forEach((text, i) => {
          const x = (i % MV_SIGN_COLS) * MV_SIGN_W,
            y = Math.floor(i / MV_SIGN_COLS) * MV_SIGN_H;
          for (const g of [dg, gg]) {
            g.save();
            g.translate(x, y);
            g.beginPath();
            g.rect(0, 0, MV_SIGN_W, MV_SIGN_H);
            g.clip();
          }
          if (text === '4X4 CLUB · TV') {
            // The clubhouse TV: a rally truck mid-jump over dunes at sunset.
            const sky = dg.createLinearGradient(0, 0, 0, MV_SIGN_H);
            sky.addColorStop(0, '#f08a3a');
            sky.addColorStop(1, '#f6d27a');
            dg.fillStyle = sky;
            dg.fillRect(0, 0, MV_SIGN_W, MV_SIGN_H);
            dg.fillStyle = '#b8742e';
            dg.beginPath();
            dg.moveTo(0, 100);
            dg.quadraticCurveTo(140, 60, 280, 96);
            dg.quadraticCurveTo(400, 118, 512, 84);
            dg.lineTo(512, 128);
            dg.lineTo(0, 128);
            dg.fill();
            dg.fillStyle = '#1c2a3a';
            dg.fillRect(220, 40, 80, 26);
            dg.fillRect(236, 26, 44, 16);
            dg.fillStyle = '#111';
            for (const wx of [236, 286]) {
              dg.beginPath();
              dg.arc(wx, 68, 10, 0, TAU);
              dg.fill();
            }
            dg.fillStyle = '#fff';
            dg.font = 'bold 18px Arial';
            dg.fillText('LIVE · BAJA 1000', 16, 24);
            gg.fillStyle = '#d0c0a0';
            gg.fillRect(0, 0, MV_SIGN_W, MV_SIGN_H);
          } else SignArt.paint(dg, gg, MV_SIGN_W, MV_SIGN_H, text, '#f2e3b3', /TRAILHEAD/.test(text) ? 'trail' : undefined);
          dg.restore();
          gg.restore();
          mvSignCells.set(text, [x / mvSignDay.width, 1 - (y + MV_SIGN_H) / mvSignDay.height, (x + MV_SIGN_W) / mvSignDay.width, 1 - y / mvSignDay.height]);
        });
      }
      const mvSignTexture = new Three.CanvasTexture(mvSignDay),
        mvSignGlowTexture = new Three.CanvasTexture(mvSignGlow);
      for (const t of [mvSignTexture, mvSignGlowTexture]) {
        t.colorSpace = Three.SRGBColorSpace;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      }
      // Floodlit boards: the lanterns wash them at night (signage3d.js drives the emissive).
      MV_MAT.sign = litSignMaterial(mvSignTexture, mvSignGlowTexture, { night: 1.3, day: 0.06, cutout: true, roughness: 0.7 });
      MV_MAT.sign.userData.mountainKit = true;
      // A sign board facing south, centred at (x, y, z), `width` wide (4:1), with two lanterns over it.
      function mvSign(batch, text, x, y, z, width, lanterns = true, facing = 'south') {
        const cell = mvSignCells.get(text);
        if (!cell) return;
        const h = width / 4;
        mvCellQuad(batch, 'sign', mvFacing(x, y - h / 2, y + h / 2, z, width, facing), cell);
        if (!lanterns || facing !== 'south') return;
        for (const side of [-1, 1]) {
          const lx = x + side * width * 0.36;
          // An iron goose-neck with a lantern hood over the board.
          mvBox(batch, 'iron', lx, y + h / 2 + 1.4, z + 1.4, 0.35, 0.35, 2.8, '#1e1e1e');
          mvBox(batch, 'iron', lx, y + h / 2 + 1.1, z + 2.8, 1.4, 0.9, 1.2, '#1e1e1e');
          mvBox(batch, 'lamp', lx, y + h / 2 + 0.4, z + 2.8, 0.9, 0.6, 0.8, '#fff0cc');
          addGlow(lx, y + h / 2, z + 3.2, 6, '#ffd89a', 1.1, { day: 0 });
        }
      }
      /* ---- Night: warm pools on the ground (one additive mesh per town) ------------------- */
      const mvPoolTexture = (() => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        const g = cv.getContext('2d'),
          grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        return new Three.CanvasTexture(cv);
      })();
      const mvPoolMaterial = new Three.MeshBasicMaterial({ map: mvPoolTexture, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: Three.AdditiveBlending, fog: true });
      // `y` is the surface it lies on (a boardwalk or deck is a couple of units up).
      function mvPool(batch, x, z, radius, color, strength = 1, y = 0.35) {
        mvColor.set(color).multiplyScalar(strength);
        const b = mvBuf(batch, 'pool'),
          base = b.pos.length / 3;
        for (const [dx, dz, u, v] of [[-1, 1, 0, 0], [1, 1, 1, 0], [1, -1, 1, 1], [-1, -1, 0, 1]]) {
          b.pos.push(x + dx * radius, y, z + dz * radius);
          b.nor.push(0, 1, 0);
          b.uv.push(u, v);
          b.col.push(mvColor.r, mvColor.g, mvColor.b);
        }
        b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      /* ---- Flush: a batch becomes one mesh per material under `group` ---------------------- */
      const mvStats = { meshes: 0, triangles: 0, vertices: 0, towns: {} };
      function mvFlush(batch, group, tag = batch.name) {
        const stat = mvStats.towns[tag] || (mvStats.towns[tag] = { meshes: 0, triangles: 0 });
        for (const [material, b] of batch.parts) {
          if (!b.idx.length) continue;
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.Float32BufferAttribute(b.pos, 3));
          geo.setAttribute('normal', new Three.Float32BufferAttribute(b.nor, 3));
          geo.setAttribute('uv', new Three.Float32BufferAttribute(b.uv, 2));
          geo.setAttribute('color', new Three.Float32BufferAttribute(b.col, 3));
          geo.setIndex(b.pos.length / 3 > 65535 ? new Three.Uint32BufferAttribute(b.idx, 1) : new Three.Uint16BufferAttribute(b.idx, 1));
          geo.computeBoundingSphere();
          const m = new Three.Mesh(geo, material === 'pool' ? mvPoolMaterial : MV_MAT[material]);
          m.name = 'village ' + tag + ' ' + material;
          m.castShadow = !['pool', 'gravel', 'dirt', 'cobbles', 'sign', 'windowLit', 'windowDark', 'map'].includes(material);
          m.receiveShadow = material !== 'pool';
          if (material === 'pool') m.renderOrder = 2;
          group.add(m);
          stat.meshes++;
          stat.triangles += b.idx.length / 3;
          mvStats.meshes++;
          mvStats.triangles += b.idx.length / 3;
          mvStats.vertices += b.pos.length / 3;
        }
        batch.parts.clear();
      }
      /* ---- Building pieces ------------------------------------------------------------------ */
      // The finish's material and tint for a wall band.
      function mvWallFinish(b, finish) {
        const F = b.finish;
        if (finish === 'stone') return ['stone', mvMix(F.stone, '#ffffff', 0.35)];
        if (finish === 'log') return ['logs', mvMix(F.stain, '#ffffff', 0.25)];
        if (finish === 'plaster') return ['plaster', F.plaster];
        return ['boards', F.boards];
      }
      function mvRoofFinish(b) {
        const F = b.finish;
        if (F.roof === 'metal') return ['metal', F.roofColor];
        if (F.roof === 'slate') return ['slate', mvMix(F.roofColor, '#ffffff', 0.25)];
        return ['shake', mvMix(F.roofColor, '#ffffff', 0.45)];
      }
      /*
       * A gable roof over x0..x1, z0..z1 with its ridge along `axis` ('x' or 'y'
       * = map y), eaves at `eaves`, rising `rise`, overhanging `ov` (eaves) and
       * `ovg` (gables). Writes the two slopes, the ridge cap, fascia and
       * bargeboards, rafter tails on the south eave and snow when `snow` > 0.
       */
      function mvGableRoof(batch, x0, z0, x1, z1, axis, eaves, rise, ov, ovg, roofFinish, trim, snow = 0, tails = false, faceSkip = '') {
        const [material, color] = roofFinish,
          t = 0.22 * MVU,
          cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2,
          half = axis === 'x' ? (z1 - z0) / 2 : (x1 - x0) / 2,
          along = axis === 'x' ? (x1 - x0) / 2 + ovg : (z1 - z0) / 2 + ovg,
          pitch = Math.atan2(rise, half),
          run = half + ov,
          L = run / Math.cos(pitch) + 0.12 * MVU,
          ridgeY = eaves + rise,
          R = axis === 'x' ? mvAX : mvAZ;
        for (const s of [1, -1]) {
          if (faceSkip.includes(s > 0 ? '+' : '-')) continue;
          const D = axis === 'x' ? mvV3(0, -Math.sin(pitch), s * Math.cos(pitch)) : mvV3(s * Math.cos(pitch), -Math.sin(pitch), 0),
            N = axis === 'x' ? mvV3(0, Math.cos(pitch), s * Math.sin(pitch)) : mvV3(s * Math.sin(pitch), Math.cos(pitch), 0),
            ridge = mvV3(cx, ridgeY, cz),
            centre = ridge.clone().addScaledVector(D, L / 2 - 0.12 * MVU).addScaledVector(N, t / 2);
          mvOBox(batch, material, centre, [R, N, D], [along, t / 2, L / 2], color);
          if (snow > 0) {
            const cover = L * (0.55 + 0.4 * snow);
            mvOBox(batch, 'snow', ridge.clone().addScaledVector(D, cover / 2).addScaledVector(N, t + 0.08 * MVU), [R, N, D], [along - 0.1 * MVU, 0.1 * MVU, cover / 2], '#f4f7fb');
          }
          // Fascia along the eave edge.
          const edge = ridge.clone().addScaledVector(D, L - 0.12 * MVU);
          mvOBox(batch, 'timber', edge.clone().addScaledVector(N, -0.05 * MVU), [R, N, D], [along + 0.05 * MVU, 0.2 * MVU, 0.06 * MVU], trim);
          // Rafter tails under the eave (the camera sees the south one).
          if (tails && s > 0 && axis === 'x') {
            for (let u = -along + 0.6 * MVU; u < along - 0.3 * MVU; u += 0.9 * MVU) {
              const p = ridge.clone().addScaledVector(D, L - 0.55 * MVU).addScaledVector(N, -0.16 * MVU).addScaledVector(R, u);
              mvOBox(batch, 'timber', p, [R, N, D], [0.07 * MVU, 0.1 * MVU, 0.5 * MVU], trim);
            }
          }
          // Bargeboards up the two gable edges.
          for (const e of [-1, 1]) {
            const p = ridge.clone().addScaledVector(D, L / 2 - 0.12 * MVU).addScaledVector(R, e * (along + 0.04 * MVU)).addScaledVector(N, -0.08 * MVU);
            mvOBox(batch, 'timber', p, [R, N, D], [0.06 * MVU, 0.24 * MVU, L / 2], trim);
          }
        }
        // Ridge cap.
        mvOBox(batch, material === 'metal' ? 'metal' : 'timber', mvV3(cx, ridgeY + t * 0.9, cz), [R, mvAY, axis === 'x' ? mvAZ : mvAX], [along + 0.06 * MVU, 0.12 * MVU, 0.22 * MVU], material === 'metal' ? color : mvMix(color, '#000000', 0.25));
        return ridgeY;
      }
      // The gable triangles of a roof over the given footprint.
      function mvGables(batch, x0, z0, x1, z1, axis, eaves, rise, finish, color, faces = 'both') {
        const top = eaves + rise;
        if (axis === 'y') {
          const cx = (x0 + x1) / 2;
          if (faces !== 'north') mvTri(batch, finish, mvV3(x0, eaves, z1), mvV3(x1, eaves, z1), mvV3(cx, top, z1), color);
          if (faces !== 'south') mvTri(batch, finish, mvV3(x1, eaves, z0), mvV3(x0, eaves, z0), mvV3(cx, top, z0), color);
        } else {
          const cz = (z0 + z1) / 2;
          mvTri(batch, finish, mvV3(x0, eaves, z0), mvV3(x0, eaves, z1), mvV3(x0, top, cz), color);
          mvTri(batch, finish, mvV3(x1, eaves, z1), mvV3(x1, eaves, z0), mvV3(x1, top, cz), color);
        }
      }
      // A window on a face: glass (lit or dark), sill, lintel, optional shutters and flower box.
      function mvWindow(batch, b, face, x, y0, z, width, height, options = {}) {
        const F = b.finish,
          cellIndex = options.cell ?? 0,
          lit = options.lit ?? mvRand() < 0.62,
          out = face === 'south' ? 1 : face === 'north' ? -1 : 0,
          sideOut = face === 'east' ? 1 : face === 'west' ? -1 : 0,
          push = 0.06 * MVU;
        const px = x + sideOut * push,
          pz = z + out * push;
        mvCellQuad(batch, lit ? 'windowLit' : 'windowDark', mvFacing(px, y0, y0 + height, pz, width, face), MV_WINDOW_CELL[cellIndex]);
        const along = face === 'south' || face === 'north';
        const put = (du, y, dn, su, sy, sn, material, color) => {
          if (along) mvBox(batch, material, x + du, y, z + out * dn, su, sy, sn, color);
          else mvBox(batch, material, x + sideOut * dn, y, z + du, sn, sy, su, color);
        };
        // Sill and head.
        put(0, y0 - 0.06 * MVU, 0.14 * MVU, width + 0.3 * MVU, 0.12 * MVU, 0.3 * MVU, 'timber', options.trim || F.trim);
        put(0, y0 + height + 0.1 * MVU, 0.08 * MVU, width + 0.4 * MVU, 0.2 * MVU, 0.18 * MVU, 'timber', mvMix(F.stain, '#000000', 0.2));
        if (options.shutters) {
          const sw = width * 0.5;
          for (const side of [-1, 1]) {
            const u = side * (width / 2 + sw / 2 + 0.05 * MVU);
            if (along) mvCellQuad(batch, 'shutter', mvFacing(x + u, y0, y0 + height, z + out * 0.1 * MVU, sw, face), [0, 0, 1, 1], F.shutter);
            else mvCellQuad(batch, 'shutter', mvFacing(x + sideOut * 0.1 * MVU, y0, y0 + height, z + u, sw, face), [0, 0, 1, 1], F.shutter);
          }
        }
        if (options.flowers) {
          put(0, y0 - 0.32 * MVU, 0.3 * MVU, width + 0.1 * MVU, 0.36 * MVU, 0.36 * MVU, 'timber', F.trim);
          const n = Math.max(3, Math.round(width / (0.3 * MVU)));
          for (let k = 0; k < n; k++) {
            const du = -width / 2 + ((k + 0.5) * width) / n,
              color = k % 3 === 1 ? '#3f6a32' : F.flower,
              r = (0.16 + mvRand() * 0.08) * MVU;
            if (along) mvGeometry(batch, 'paint', MV_GEO.blob, x + du, y0 - 0.02 * MVU, z + out * 0.34 * MVU, r, r * 0.9, r, color, mvRand() * 3);
            else mvGeometry(batch, 'paint', MV_GEO.blob, x + sideOut * 0.34 * MVU, y0 - 0.02 * MVU, z + du, r, r * 0.9, r, color, mvRand() * 3);
          }
          // Trailing geranium stems over the front of the box.
          if (along) mvBox(batch, 'paint', x, y0 - 0.46 * MVU, z + out * 0.5 * MVU, width * 0.8, 0.26 * MVU, 0.08 * MVU, '#3f6a32');
        }
      }
      // A door on the south face: its leaf, frame and step.
      function mvDoor(batch, b, x, z, cellIndex = 0, width = 1.1 * MVU, height = DOOR_HEIGHT) {
        const cell = MV_DOOR_CELL[cellIndex];
        mvCellQuad(batch, 'door', mvFacing(x, 0.15 * MVU, height, z + 0.05 * MVU, width), [cell[0], 0, cell[1], 1], mvMix(b.finish.stain, '#ffffff', 0.4));
        const trim = b.finish.trim;
        for (const side of [-1, 1]) mvBox(batch, 'timber', x + side * (width / 2 + 0.1 * MVU), height / 2, z + 0.1 * MVU, 0.2 * MVU, height + 0.1 * MVU, 0.22 * MVU, trim);
        mvBox(batch, 'timber', x, height + 0.12 * MVU, z + 0.12 * MVU, width + 0.5 * MVU, 0.24 * MVU, 0.26 * MVU, trim);
        mvBox(batch, 'stone', x, 0.08 * MVU, z + 0.45 * MVU, width + 0.6 * MVU, 0.16 * MVU, 0.9 * MVU, '#b8b2a6');
      }
      // Log corner notches: the crossing log ends that stand out at each corner of a log wall.
      function mvLogCorners(batch, b, x0, z0, x1, z1, y0, y1, color) {
        const r = 0.15 * MVU,
          stick = 0.28 * MVU;
        for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
          let k = 0;
          for (let y = y0 + r; y < y1 - r * 0.5; y += 0.3 * MVU, k++) {
            const sx = cx < (x0 + x1) / 2 ? -1 : 1,
              sz = cz < (z0 + z1) / 2 ? -1 : 1;
            if (k % 2) mvCyl(batch, 'logs', mvV3(cx - sx * 0.2 * MVU, y, cz), mvV3(cx + sx * stick, y, cz), r, 7, color, 'stack', '#caa678');
            else mvCyl(batch, 'logs', mvV3(cx, y, cz - sz * 0.2 * MVU), mvV3(cx, y, cz + sz * stick), r, 7, color, 'stack', '#caa678');
          }
        }
      }
      // A stone chimney through the roof, a cap and a pot; returns its top for the smoke.
      function mvChimney(batch, b, x, z, fromY, top) {
        const c = mvMix(b.finish.stone, '#ffffff', 0.3);
        mvBlock(batch, 'stone', x - 0.55 * MVU, fromY, z - 0.55 * MVU, x + 0.55 * MVU, top, z + 0.55 * MVU, c);
        mvBlock(batch, 'stone', x - 0.7 * MVU, top, z - 0.7 * MVU, x + 0.7 * MVU, top + 0.18 * MVU, z + 0.7 * MVU, '#9b968c', '');
        mvCyl(batch, 'paint', mvV3(x, top + 0.18 * MVU, z), mvV3(x, top + 0.7 * MVU, z), 0.16 * MVU, 8, '#8a4a32');
        return { x, y: top + 0.7 * MVU, z };
      }
      const mvChimneys = [];
      /*
       * A house of any kind: plinth, ground storey, jettied upper storeys,
       * floor band, gables, roof, chimney, windows, doors, and the kind's own
       * features. `batch` is the town's.
       */
      function mvHouse(batch, b) {
        const K = MOUNTAIN_KINDS[b.kind],
          F = b.finish,
          M = MVU,
          x0 = b.x,
          z0 = b.y,
          x1 = b.x + b.w,
          z1 = b.y + b.h,
          cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2,
          eaves = b.eaves,
          ground = K.ground * M,
          plinth = 0.6 * M,
          axis = b.ridge === 'y' ? 'y' : 'x',
          [baseMat, baseColor] = mvWallFinish(b, F.base),
          [wallMat, wallColor] = mvWallFinish(b, F.walls),
          roofFinish = mvRoofFinish(b),
          trim = F.trim,
          dark = mvMix(F.stain, '#1a120a', 0.45);
        mvSeed = (b.seed % 2147483646) + 1;
        if (K.tower) return mvLookout(batch, b);
        if (K.openSides) return mvOpenShed(batch, b);
        // Plinth, ground storey, upper storeys (jettied out a little on timber and logs).
        mvBlock(batch, 'stone', x0 - 0.1 * M, 0, z0 - 0.1 * M, x1 + 0.1 * M, plinth, z1 + 0.1 * M, mvMix(F.stone, '#ffffff', 0.2), 'ny');
        let jetty = 0;
        if (b.floors >= 2) {
          mvBlock(batch, baseMat, x0, plinth, z0, x1, ground, z1, baseColor, 'nypy');
          jetty = F.walls === 'stone' ? 0 : 0.14 * M;
          mvBlock(batch, wallMat, x0 - jetty, ground, z0 - jetty, x1 + jetty, eaves, z1 + jetty, wallColor, 'nypy');
          mvBlock(batch, 'timber', x0 - jetty - 0.06 * M, ground - 0.2 * M, z0 - jetty - 0.06 * M, x1 + jetty + 0.06 * M, ground + 0.06 * M, z1 + jetty + 0.06 * M, dark, 'ny');
          if (F.walls === 'plaster') mvHalfTimber(batch, x0 - jetty, z1 + jetty, x1 + jetty, ground, eaves, dark);
        } else mvBlock(batch, wallMat, x0, plinth, z0, x1, eaves, z1, wallColor, 'nypy');
        if (F.walls === 'log' || (b.floors < 2 && F.base === 'log') || (F.base === 'log' && b.floors >= 2)) {
          const from = b.floors >= 2 && F.base !== 'log' ? ground : plinth,
            to = b.floors >= 2 && F.walls !== 'log' ? ground : eaves;
          if (to > from) mvLogCorners(batch, b, x0 - jetty, z0 - jetty, x1 + jetty, z1 + jetty, from, to, wallColor);
        }
        const gx0 = x0 - jetty,
          gz0 = z0 - jetty,
          gx1 = x1 + jetty,
          gz1 = z1 + jetty;
        // The false front hides the south gable; everything else shows it.
        const gableFinish = F.walls === 'plaster' ? 'boards' : wallMat,
          gableColor = F.walls === 'plaster' ? mvMix(F.stain, '#ffffff', 0.35) : wallColor;
        mvGables(batch, gx0, gz0, gx1, gz1, axis, eaves, b.rise, gableFinish, gableColor, K.falseFront ? 'north' : 'both');
        const ov = K.overhang * M,
          ridgeY = mvGableRoof(batch, gx0, gz0, gx1, gz1, axis, eaves, b.rise, ov, ov * 0.85, roofFinish, dark, b.snow, ['chalet', 'lodge', 'house', 'tavern', 'station', 'bakery'].includes(b.kind));
        // Chimney: on the ridge, towards one end.
        if (!['barn', 'rescue', 'chapel', 'gas', 'store', 'shop'].includes(b.kind) || b.kind === 'shop') {
          const along = mvRand() < 0.5 ? 0.28 : 0.72,
            chX = axis === 'x' ? x0 + b.w * along : cx + b.w * 0.18,
            chZ = axis === 'x' ? cz - b.h * 0.08 : z0 + b.h * along;
          mvChimneys.push(mvChimney(batch, b, chX, chZ, eaves, ridgeY + 1.1 * M));
        }
        // Windows on the south, east and west faces, floor by floor.
        const storeys = [];
        if (b.floors >= 2) {
          storeys.push({ y: plinth + 0.5 * M, h: Math.min(1.35 * M, ground - plinth - 1.1 * M), face: z1, fx0: x0, fx1: x1, sx0: x0, sx1: x1 });
          for (let f = 1; f < b.floors; f++) {
            const y = ground + (f - 1) * K.upper * M + 0.8 * M;
            storeys.push({ y, h: 1.25 * M, face: z1 + jetty, fx0: x0 - jetty, fx1: x1 + jetty });
          }
        } else storeys.push({ y: plinth + 0.5 * M, h: Math.min(1.35 * M, eaves - plinth - 1.0 * M), face: z1, fx0: x0, fx1: x1 });
        const doorX = b.door.x,
          winW = 0.95 * M,
          cellIndex = b.kind === 'chapel' ? 3 : mvRand() < 0.5 ? 0 : 1;
        storeys.forEach((s, f) => {
          const width = s.fx1 - s.fx0,
            n = Math.max(1, Math.floor((width - 1.2 * M) / (2.5 * M)));
          // (Motels, barns and the rescue barn dress their own street faces; false fronts carry the upper windows.)
          const ownFront = K.motel || K.barnDoor || K.bayDoors || (K.falseFront && f > 0);
          for (let k = 0; k < n && !ownFront; k++) {
            const x = s.fx0 + ((k + 0.5) * width) / n;
            if (f === 0 && (K.shopWindow || Math.abs(x - doorX) < 1.4 * M)) continue;
            if (f === 1 && K.balcony && Math.abs(x - cx) < 0.9 * M) continue;
            if (K.crossGable && Math.abs(x - doorX) < Math.min(b.w * 0.18, 4 * M) + 0.6 * M) continue;
            mvWindow(batch, b, 'south', x, s.y, s.face, winW, s.h, { cell: cellIndex, shutters: K.shutters, flowers: K.flowers && mvRand() < 0.7 });
          }
          if (K.motel) return;
          // Side windows (seen at an angle).
          const depth = b.h,
            m = Math.max(1, Math.floor((depth - 2 * M) / (3.2 * M)));
          for (let k = 0; k < m; k++) {
            const z = z0 + ((k + 0.6) * depth) / (m + 0.2);
            const off = f > 0 ? jetty : 0;
            mvWindow(batch, b, 'east', x1 + off, s.y, z, winW * 0.9, s.h, { cell: cellIndex, shutters: K.shutters });
            mvWindow(batch, b, 'west', x0 - off, s.y, z, winW * 0.9, s.h, { cell: cellIndex, shutters: K.shutters });
          }
        });
        // Attic window in a street-facing gable.
        if (axis === 'y' && !K.falseFront && b.rise > 2.2 * M && b.kind !== 'chapel') mvWindow(batch, b, 'south', cx, eaves + 0.5 * M, gz1, 0.8 * M, 1.0 * M, { cell: 1, shutters: K.shutters });
        // Shop windows either side of the door, on a timber stall riser.
        if (K.shopWindow) {
          const shopW = Math.min(2.8 * M, b.w / 2 - 1.3 * M);
          if (shopW > 1.2 * M)
            for (const side of [-1, 1]) {
              const x = doorX + side * (0.9 * M + shopW / 2);
              if (x - shopW / 2 < x0 || x + shopW / 2 > x1) continue;
              mvBox(batch, 'timber', x, 0.35 * M, z1 + 0.12 * M, shopW + 0.2 * M, 0.7 * M, 0.26 * M, dark);
              mvWindow(batch, b, 'south', x, 0.75 * M, z1, shopW, 2.1 * M, { cell: 2, lit: true });
            }
        }
        // The door (carved double doors for the big public buildings).
        const bigDoor = ['lodge', 'tavern', 'chapel', 'station', 'store'].includes(b.kind);
        if (!K.motel && !K.barnDoor && !K.bayDoors) mvDoor(batch, b, doorX, z1, bigDoor ? 2 : K.shopWindow ? 1 : 0, bigDoor ? 2 * M : 1.1 * M);
        // Wall lanterns either side of the door.
        if (!K.motel)
          for (const side of [-1, 1]) {
            const lx = doorX + side * (bigDoor ? 1.6 : 1.0) * M;
            mvBox(batch, 'iron', lx, 2.6 * M, z1 + 0.25 * M, 0.3 * M, 0.5 * M, 0.3 * M, '#1d1d1d');
            mvBox(batch, 'lamp', lx, 2.3 * M, z1 + 0.35 * M, 0.26 * M, 0.34 * M, 0.26 * M, '#fff0cc');
            addGlow(lx, 2.3 * M, z1 + 0.6 * M, 5, '#ffd08a', 1, { day: 0 });
          }
        mvPool(batch, doorX, z1 + 2.2 * M, 4.5 * M, '#ffb866', 0.55, b.boardwalk ? 2.6 : 0.35);
        // Features. A porch roof over the boardwalk, unless an awning shades it;
        // a carved balcony where no porch roof or front gable is in its way.
        const porched = (K.porch || !!b.boardwalk) && !K.awning;
        if (K.balcony && b.floors >= 2 && !porched && !K.crossGable) mvBalcony(batch, b, cx, ground, gz1, axis === 'y' ? b.w * 0.82 : b.w * 0.62);
        if (K.falseFront) mvFalseFront(batch, b, ridgeY);
        if (porched) mvPorch(batch, b, ground);
        if (K.awning) mvAwning(batch, b);
        if (K.dormers && axis === 'x' && b.w > 7 * M) mvDormers(batch, b, gx0, gz1, gx1, eaves, roofFinish, wallMat, wallColor, dark);
        if (K.crossGable) mvCrossGable(batch, b, eaves, ridgeY, roofFinish, wallMat, wallColor, dark);
        if (K.steeple) mvSteeple(batch, b, ridgeY, roofFinish, dark);
        if (K.motel) mvMotelFront(batch, b, dark);
        if (K.barnDoor) mvBarnFront(batch, b, ridgeY, roofFinish);
        if (K.bayDoors) mvBayDoors(batch, b);
        if (b.kind === 'station') mvFlagpole(batch, b.x + b.w + 3 * M, b.y + b.h + 3 * M, 10 * M);
        if (b.kind === 'tavern' && b.options.deck) mvTavernDeck(batch, b);
        // The name board.
        if (b.name && !K.falseFront) {
          const width = Math.min(b.w * 0.72, 6.5 * M),
            y = porched ? Math.min(ground, 3.4 * M) + 1.3 * M : b.floors >= 2 ? ground + 0.1 * M : eaves - 0.2 * M;
          const z = porched && !K.crossGable ? z1 + (b.boardwalk ? b.boardwalk.h : 2 * M) + 0.1 * M : (K.crossGable ? z1 + 1.3 * M : gz1) + 0.12 * M;
          mvSign(batch, b.name, doorX, K.crossGable ? ground + 1.45 * M : y, z, K.crossGable ? Math.min(width, Math.min(b.w * 0.36, 8 * M) * 0.9) : width);
        }
      }
      // Dark timber framing on a plastered upper storey's street face.
      function mvHalfTimber(batch, x0, z, x1, y0, y1, color) {
        // Posts between the window bays (the same bays mvHouse spaces the windows in),
        // the wall plate and a mid rail at sill height.
        const w = x1 - x0,
          n = Math.max(1, Math.floor((w - 1.2 * MVU) / (2.5 * MVU)));
        for (let k = 0; k <= n; k++) mvBox(batch, 'timber', x0 + 0.1 * MVU + (k * (w - 0.2 * MVU)) / n, (y0 + y1) / 2, z + 0.05 * MVU, 0.2 * MVU, y1 - y0, 0.12 * MVU, color);
        mvBox(batch, 'timber', (x0 + x1) / 2, y1 - 0.1 * MVU, z + 0.05 * MVU, w, 0.2 * MVU, 0.12 * MVU, color);
        mvBox(batch, 'timber', (x0 + x1) / 2, y0 + 0.7 * MVU, z + 0.05 * MVU, w, 0.16 * MVU, 0.1 * MVU, color);
      }
      // A carved balcony across the street face at `y`, with flower boxes and brackets.
      function mvBalcony(batch, b, cx, y, face, width) {
        const F = b.finish,
          depth = 1.15 * MVU,
          stain = mvMix(F.stain, '#ffffff', 0.35),
          x0 = cx - width / 2,
          x1 = cx + width / 2;
        mvBlock(batch, 'planks', x0, y - 0.2 * MVU, face, x1, y, face + depth, stain, '');
        // Railing: the carved boards on three sides.
        const top = y + 1.0 * MVU;
        mvQuad(batch, 'railing', [mvV3(x0, y, face + depth), mvV3(x1, y, face + depth), mvV3(x1, top, face + depth), mvV3(x0, top, face + depth)], stain, [[0, 0], [width / (2 * MVU), 0], [width / (2 * MVU), 1], [0, 1]], false);
        for (const [x, s] of [[x0, -1], [x1, 1]]) {
          const q = s < 0 ? [mvV3(x, y, face), mvV3(x, y, face + depth), mvV3(x, top, face + depth), mvV3(x, top, face)] : [mvV3(x, y, face + depth), mvV3(x, y, face), mvV3(x, top, face), mvV3(x, top, face + depth)];
          mvQuad(batch, 'railing', q, stain, [[0, 0], [depth / (2 * MVU), 0], [depth / (2 * MVU), 1], [0, 1]], false);
        }
        mvBox(batch, 'timber', cx, top + 0.05 * MVU, face + depth, width + 0.1 * MVU, 0.12 * MVU, 0.16 * MVU, mvMix(F.stain, '#000000', 0.1));
        // Long flower box on the rail, geraniums spilling over.
        mvBox(batch, 'timber', cx, top + 0.25 * MVU, face + depth + 0.12 * MVU, width * 0.86, 0.3 * MVU, 0.3 * MVU, F.trim);
        const n = Math.round((width * 0.86) / (0.28 * MVU));
        for (let k = 0; k < n; k++) {
          const x = cx - width * 0.43 + ((k + 0.5) * width * 0.86) / n,
            r = (0.17 + mvRand() * 0.08) * MVU;
          mvGeometry(batch, 'paint', MV_GEO.blob, x, top + 0.45 * MVU, face + depth + 0.14 * MVU, r, r, r, k % 4 === 2 ? '#3f6a32' : F.flower, k);
        }
        mvBox(batch, 'paint', cx, top + 0.02 * MVU, face + depth + 0.3 * MVU, width * 0.8, 0.3 * MVU, 0.07 * MVU, '#3f6a32');
        // Brackets under it.
        const brackets = Math.max(2, Math.round(width / (2.5 * MVU)));
        for (let k = 0; k <= brackets; k++) {
          const x = x0 + 0.2 * MVU + (k * (width - 0.4 * MVU)) / brackets,
            c = mvV3(x, y - 0.6 * MVU, face + depth * 0.45),
            dir = mvV3(0, 0.62, 0.78).normalize();
          mvOBox(batch, 'timber', c, [mvAX, dir, mvAX.clone().cross(dir).normalize()], [0.08 * MVU, 0.62 * MVU, 0.08 * MVU], mvMix(F.stain, '#000000', 0.15));
        }
        // The door onto it.
        mvCellQuad(batch, 'door', mvFacing(cx, y, y + DOOR_HEIGHT, face + 0.04 * MVU, 1.1 * MVU), [MV_DOOR_CELL[1][0], 0, MV_DOOR_CELL[1][1], 1], mvMix(F.stain, '#ffffff', 0.4));
      }
      // A false front: the facade carried up square past the gable, a cornice and the name.
      function mvFalseFront(batch, b, ridgeY) {
        const F = b.finish,
          [material, color] = mvWallFinish(b, F.walls === 'log' ? 'boards' : F.walls),
          top = Math.max(ridgeY + 0.6 * MVU, b.eaves + 2.4 * MVU),
          z = b.y + b.h,
          x0 = b.x - 0.15 * MVU,
          x1 = b.x + b.w + 0.15 * MVU,
          painted = mvMix(F.boards, '#ffffff', 0.2);
        mvBlock(batch, material, x0, b.eaves - 0.2 * MVU, z - 0.1 * MVU, x1, top, z + 0.25 * MVU, material === 'logs' ? color : painted, 'ny');
        // Stepped parapet and cornice with brackets.
        mvBlock(batch, 'timber', x0 - 0.2 * MVU, top, z - 0.15 * MVU, x1 + 0.2 * MVU, top + 0.35 * MVU, z + 0.55 * MVU, F.trim, '');
        for (let k = 0; k <= 6; k++) mvBox(batch, 'timber', x0 + ((x1 - x0) * k) / 6, top - 0.25 * MVU, z + 0.4 * MVU, 0.18 * MVU, 0.5 * MVU, 0.3 * MVU, F.trim);
        mvBlock(batch, 'timber', (x0 + x1) / 2 - b.w * 0.2, top + 0.35 * MVU, z - 0.1 * MVU, (x0 + x1) / 2 + b.w * 0.2, top + 0.85 * MVU, z + 0.3 * MVU, F.trim, 'ny');
        // Pilasters at the corners.
        for (const x of [x0 + 0.15 * MVU, x1 - 0.15 * MVU]) mvBox(batch, 'timber', x, top / 2, z + 0.32 * MVU, 0.35 * MVU, top, 0.2 * MVU, F.trim);
        // Upper floor windows in the false front.
        if (b.floors >= 2)
          for (let k = 0; k < 3; k++) mvWindow(batch, b, 'south', b.x + ((k + 0.5) * b.w) / 3, b.eaves - 1.9 * MVU, z + 0.26 * MVU, 0.9 * MVU, 1.3 * MVU, { cell: 1 });
        if (b.name) mvSign(batch, b.name, (x0 + x1) / 2, (b.eaves + top) / 2 + 0.4 * MVU, z + 0.3 * MVU, Math.min(b.w * 0.86, 9 * MVU));
      }
      // A porch roof on posts over the boardwalk (or a house's front porch).
      function mvPorch(batch, b, ground) {
        const F = b.finish,
          z1 = b.y + b.h,
          depth = b.boardwalk ? b.boardwalk.h : 2 * MVU,
          width = b.boardwalk ? b.w + 0.6 * MVU : Math.min(b.w * 0.75, 7 * MVU),
          cx = b.x + b.w / 2,
          x0 = cx - width / 2,
          x1 = cx + width / 2,
          h = Math.min(ground, 3.4 * MVU),
          [roofMat, roofColor] = mvRoofFinish(b),
          post = mvMix(F.stain, '#000000', 0.1);
        if (!b.boardwalk) mvBlock(batch, 'planks', x0, 0, z1, x1, 0.3 * MVU, z1 + depth, mvMix(F.stain, '#ffffff', 0.35), 'ny');
        const posts = Math.max(2, Math.round(width / (2.6 * MVU)));
        for (let k = 0; k <= posts; k++) {
          const x = x0 + 0.15 * MVU + (k * (width - 0.3 * MVU)) / posts;
          mvBox(batch, 'timber', x, h / 2, z1 + depth - 0.2 * MVU, 0.24 * MVU, h, 0.24 * MVU, post);
          // Knee braces.
          for (const s of [-1, 1]) {
            if ((k === 0 && s < 0) || (k === posts && s > 0)) continue;
            mvOBox(batch, 'timber', mvV3(x + s * 0.3 * MVU, h - 0.35 * MVU, z1 + depth - 0.2 * MVU), [mvV3(s, 1, 0).normalize(), mvV3(-1, s, 0).normalize(), mvAZ], [0.42 * MVU, 0.06 * MVU, 0.06 * MVU], post);
          }
        }
        mvBox(batch, 'timber', cx, h + 0.1 * MVU, z1 + depth - 0.2 * MVU, width + 0.3 * MVU, 0.3 * MVU, 0.26 * MVU, post);
        // The shed roof, pitched down from the wall.
        const drop = 0.55 * MVU,
          run = depth + 0.35 * MVU,
          pitch = Math.atan2(drop, run),
          L = Math.hypot(run, drop),
          D = mvV3(0, -Math.sin(pitch), Math.cos(pitch)),
          N = mvV3(0, Math.cos(pitch), Math.sin(pitch)),
          c = mvV3(cx, h + 0.35 * MVU + drop / 2 + 0.1 * MVU, z1 + run / 2);
        mvOBox(batch, roofMat, c, [mvAX, N, D], [width / 2 + 0.25 * MVU, 0.1 * MVU, L / 2], roofColor);
        mvOBox(batch, 'timber', c.clone().addScaledVector(D, L / 2).addScaledVector(N, -0.05 * MVU), [mvAX, N, D], [width / 2 + 0.3 * MVU, 0.16 * MVU, 0.05 * MVU], F.trim);
        // House porches get a rail; shops a hitching rail at the walk's edge.
        if (!b.boardwalk)
          for (const [a, bb] of [[x0, cx - 0.8 * MVU], [cx + 0.8 * MVU, x1]]) mvBox(batch, 'timber', (a + bb) / 2, 0.95 * MVU, z1 + depth - 0.2 * MVU, bb - a, 0.12 * MVU, 0.12 * MVU, post);
        // A lantern hanging under the porch.
        addGlow(cx, h - 0.3 * MVU, z1 + depth * 0.5, 6, '#ffcf8a', 0.9, { day: 0 });
        mvBox(batch, 'lamp', cx, h - 0.35 * MVU, z1 + depth * 0.5, 0.3 * MVU, 0.4 * MVU, 0.3 * MVU, '#fff0cc');
        mvPool(batch, cx, z1 + depth * 0.6, 4 * MVU + width * 0.2, '#ffc27a', 0.5, 2.6);
      }
      // A striped awning over the shop windows (bakery, café).
      function mvAwning(batch, b) {
        const z1 = b.y + b.h,
          y = 3.1 * MVU,
          depth = 1.3 * MVU,
          x0 = b.x + 0.2 * MVU,
          x1 = b.x + b.w - 0.2 * MVU,
          w = x1 - x0;
        mvQuad(batch, 'awning', [mvV3(x0, y - 0.7 * MVU, z1 + depth), mvV3(x1, y - 0.7 * MVU, z1 + depth), mvV3(x1, y, z1), mvV3(x0, y, z1)], '#ffffff', [[0, 0], [w / (2 * MVU), 0], [w / (2 * MVU), 1], [0, 1]], false);
        mvQuad(batch, 'awning', [mvV3(x0, y - 1.0 * MVU, z1 + depth), mvV3(x1, y - 1.0 * MVU, z1 + depth), mvV3(x1, y - 0.7 * MVU, z1 + depth), mvV3(x0, y - 0.7 * MVU, z1 + depth)], '#ffffff', [[0, 0], [w / (2 * MVU), 0], [w / (2 * MVU), 0.4], [0, 0.4]], false);
        registerOverheadCover((x0 + x1) / 2, z1 + depth / 2, w / 2, depth / 2, 0, y - 0.8 * MVU, y, 'awning');
      }
      // Dormers on the south slope of a ridge-x roof.
      function mvDormers(batch, b, x0, face, x1, eaves, roofFinish, wallMat, wallColor, trim) {
        const n = b.w > 16 * MVU ? 3 : b.w > 10 * MVU ? 2 : 1,
          w = 1.8 * MVU,
          depth = 2.4 * MVU,
          h = 1.9 * MVU;
        for (let k = 0; k < n; k++) {
          const cx = x0 + ((k + 0.5) * (x1 - x0)) / n;
          if (b.kind === 'lodge' || b.kind === 'tavern') if (Math.abs(cx - (x0 + x1) / 2) < 3.5 * MVU) continue;
          const zf = face - 0.4 * MVU;
          mvBlock(batch, wallMat, cx - w / 2, eaves - 0.2 * MVU, zf - depth, cx + w / 2, eaves + h, zf, wallColor, 'ny');
          mvWindow(batch, b, 'south', cx, eaves + 0.25 * MVU, zf, 1.0 * MVU, 1.2 * MVU, { cell: 0 });
          mvGables(batch, cx - w / 2, zf - depth, cx + w / 2, zf, 'y', eaves + h, 0.9 * MVU, wallMat, wallColor, 'south');
          mvGableRoof(batch, cx - w / 2, zf - depth, cx + w / 2, zf, 'y', eaves + h, 0.9 * MVU, 0.35 * MVU, 0.35 * MVU, roofFinish, trim, b.snow);
        }
      }
      // A front gable on the street face of a long building (lodge, tavern).
      function mvCrossGable(batch, b, eaves, ridgeY, roofFinish, wallMat, wallColor, trim) {
        const w = Math.min(b.w * 0.36, 8 * MVU),
          cx = b.door.x,
          z1 = b.y + b.h,
          proj = 1.3 * MVU,
          rise = Math.min((w / 2) * Math.tan((48 * Math.PI) / 180), ridgeY - eaves - 0.3 * MVU),
          z0 = b.y + b.h * 0.35;
        mvBlock(batch, wallMat, cx - w / 2, 0.6 * MVU, z1 - 0.2 * MVU, cx + w / 2, eaves, z1 + proj, wallColor, 'ny');
        mvBlock(batch, 'stone', cx - w / 2 - 0.1 * MVU, 0, z1, cx + w / 2 + 0.1 * MVU, 0.6 * MVU, z1 + proj + 0.1 * MVU, mvMix(b.finish.stone, '#ffffff', 0.2));
        mvGables(batch, cx - w / 2, z0, cx + w / 2, z1 + proj, 'y', eaves, rise, 'boards', mvMix(b.finish.stain, '#ffffff', 0.3), 'south');
        // A big glazed gable (the lodge look): mullioned lights under the apex.
        mvWindow(batch, b, 'south', cx, eaves + 0.3 * MVU, z1 + proj, w * 0.42, Math.min(rise * 0.55, 2.6 * MVU), { cell: 1, lit: true });
        mvGableRoof(batch, cx - w / 2, z0, cx + w / 2, z1 + proj, 'y', eaves, rise, 0.9 * MVU, 0.9 * MVU, roofFinish, trim, b.snow);
        // King post and collar ties in the gable.
        mvBox(batch, 'timber', cx, eaves + rise * 0.55, z1 + proj + 0.15 * MVU, 0.24 * MVU, rise * 0.9, 0.2 * MVU, trim);
        mvBox(batch, 'timber', cx, eaves + rise * 0.28, z1 + proj + 0.15 * MVU, w * 0.62, 0.22 * MVU, 0.2 * MVU, trim);
        // Windows either side of the door on the projection.
        for (const side of [-1, 1]) mvWindow(batch, b, 'south', cx + side * w * 0.3, 1.2 * MVU, z1 + proj, 1.0 * MVU, 1.4 * MVU, { cell: 1 });
        // Upper windows over the name board (the first upper floor carries the board).
        for (let f = 2; f < b.floors; f++) mvWindow(batch, b, 'south', cx, (MOUNTAIN_KINDS[b.kind].ground + (f - 1) * MOUNTAIN_KINDS[b.kind].upper + 0.8) * MVU, z1 + proj, 1.1 * MVU, 1.25 * MVU, { cell: 1, flowers: true, shutters: true });
        // The door is on the projection's face.
        mvDoor(batch, b, cx, z1 + proj, 2, 2 * MVU);
      }
      // The chapel's steeple over the street gable: tower, belfry, spire and cross.
      function mvSteeple(batch, b, ridgeY, roofFinish, trim) {
        const cx = b.x + b.w / 2,
          zc = b.y + b.h - 2.2 * MVU,
          s = 3.2 * MVU,
          towerTop = ridgeY + 2.6 * MVU,
          white = mvMix(b.finish.boards, '#ffffff', 0.7);
        mvBlock(batch, 'boards', cx - s / 2, ridgeY - 3 * MVU, zc - s / 2, cx + s / 2, towerTop, zc + s / 2, white, 'ny');
        // Belfry: louvred openings and a bell.
        for (const face of ['south', 'east', 'west']) {
          const x = face === 'south' ? cx : face === 'east' ? cx + s / 2 : cx - s / 2,
            z = face === 'south' ? zc + s / 2 : zc;
          mvCellQuad(batch, 'shutter', mvFacing(x + (face === 'east' ? 0.05 * MVU : face === 'west' ? -0.05 * MVU : 0), towerTop - 2.2 * MVU, towerTop - 0.4 * MVU, z + (face === 'south' ? 0.05 * MVU : 0), 1.4 * MVU, face), [0, 0, 1, 1], '#5a4a3a');
        }
        mvBlock(batch, 'timber', cx - s / 2 - 0.2 * MVU, towerTop, zc - s / 2 - 0.2 * MVU, cx + s / 2 + 0.2 * MVU, towerTop + 0.3 * MVU, zc + s / 2 + 0.2 * MVU, trim, '');
        // Spire: a tall four-sided pyramid.
        const h = 7 * MVU,
          apex = mvV3(cx, towerTop + 0.3 * MVU + h, zc),
          [material, color] = roofFinish,
          e = s / 2 + 0.25 * MVU,
          y = towerTop + 0.3 * MVU,
          corners = [mvV3(cx - e, y, zc + e), mvV3(cx + e, y, zc + e), mvV3(cx + e, y, zc - e), mvV3(cx - e, y, zc - e)];
        for (let k = 0; k < 4; k++) mvTri(batch, material, corners[k], corners[(k + 1) % 4], apex, color);
        // The cross, and the round window in the gable below it.
        mvBox(batch, 'iron', cx, apex.y + 1.1 * MVU, zc, 0.16 * MVU, 2.2 * MVU, 0.16 * MVU, '#2a2a2a');
        mvBox(batch, 'iron', cx, apex.y + 1.5 * MVU, zc, 1.1 * MVU, 0.16 * MVU, 0.16 * MVU, '#2a2a2a');
        mvWindow(batch, b, 'south', cx, b.eaves + 0.6 * MVU, b.y + b.h, 1.6 * MVU, 1.8 * MVU, { cell: 3, lit: true });
        // Tall lancet windows down the side walls.
        for (let k = 0; k < 3; k++) {
          const z = b.y + ((k + 0.5) * b.h) / 3;
          mvWindow(batch, b, 'east', b.x + b.w, 1.2 * MVU, z, 1.1 * MVU, 3.2 * MVU, { cell: 3, lit: true });
          mvWindow(batch, b, 'west', b.x, 1.2 * MVU, z, 1.1 * MVU, 3.2 * MVU, { cell: 3, lit: true });
        }
      }
      // The motel's run of rooms: a door and a window per room along the porch, numbers, the office sign.
      function mvMotelFront(batch, b, dark) {
        const long = b.ridge !== 'y',
          F = b.finish,
          rooms = Math.floor((long ? b.w : b.h) / (3.6 * MVU));
        for (let k = 0; k < rooms; k++) {
          const t = (k + 0.5) / rooms;
          if (long) {
            const x = b.x + b.w * t;
            mvDoor(batch, b, x - 0.8 * MVU, b.y + b.h, 0);
            mvWindow(batch, b, 'south', x + 0.9 * MVU, 1.0 * MVU, b.y + b.h, 1.1 * MVU, 1.2 * MVU, { cell: 0, flowers: k % 2 === 0 });
          } else {
            const z = b.y + b.h * t;
            mvWindow(batch, b, 'east', b.x + b.w, 1.0 * MVU, z, 1.1 * MVU, 1.2 * MVU, { cell: 0 });
          }
        }
        // A porch along the whole run.
        const z1 = b.y + b.h,
          depth = 1.9 * MVU,
          h = 2.9 * MVU,
          [roofMat, roofColor] = mvRoofFinish(b);
        if (long) {
          mvBlock(batch, 'planks', b.x, 0, z1, b.x + b.w, 0.25 * MVU, z1 + depth, mvMix(F.stain, '#ffffff', 0.35), 'ny');
          for (let x = b.x + 0.2 * MVU; x <= b.x + b.w; x += 3.6 * MVU) mvBox(batch, 'timber', x, h / 2, z1 + depth - 0.2 * MVU, 0.22 * MVU, h, 0.22 * MVU, dark);
          const pitch = 0.16;
          mvOBox(batch, roofMat, mvV3(b.x + b.w / 2, h + 0.35 * MVU, z1 + depth / 2), [mvAX, mvV3(0, Math.cos(pitch), Math.sin(pitch)), mvV3(0, -Math.sin(pitch), Math.cos(pitch))], [b.w / 2 + 0.3 * MVU, 0.1 * MVU, depth / 2 + 0.3 * MVU], roofColor);
          for (let x = b.x + 1.8 * MVU; x < b.x + b.w; x += 7.2 * MVU) {
            addGlow(x, h - 0.3 * MVU, z1 + depth * 0.5, 5, '#ffd08a', 0.9, { day: 0 });
            mvPool(batch, x, z1 + depth, 3.5 * MVU, '#ffc27a', 0.4);
          }
          if (b.name) {
            mvSign(batch, b.name, b.x + b.w * 0.5, h + 1.7 * MVU, z1 + depth + 0.1 * MVU, 7.5 * MVU);
            mvSign(batch, 'VACANCY', b.x + b.w * 0.5 + 5.2 * MVU, h + 1.0 * MVU, z1 + depth + 0.15 * MVU, 2.6 * MVU, false);
          }
        }
      }
      // A barn front: the big X-braced door, the hay-loft door in the gable, a cupola.
      function mvBarnFront(batch, b, ridgeY, roofFinish) {
        const z1 = b.y + b.h,
          cx = b.x + b.w / 2,
          w = Math.min(4.2 * MVU, b.w * 0.4);
        mvCellQuad(batch, 'door', mvFacing(cx, 0.1 * MVU, 4 * MVU, z1 + 0.06 * MVU, w), [MV_DOOR_CELL[3][0], 0, MV_DOOR_CELL[3][1], 1], '#b04a3a');
        mvCellQuad(batch, 'door', mvFacing(cx, b.eaves + 0.3 * MVU, b.eaves + 2.1 * MVU, z1 + 0.06 * MVU, 1.8 * MVU), [MV_DOOR_CELL[3][0], 0, MV_DOOR_CELL[3][1], 1], '#b04a3a');
        mvBox(batch, 'iron', cx, 4.3 * MVU, z1 + 0.2 * MVU, w * 2.1, 0.2 * MVU, 0.2 * MVU, '#2a2a2a');
        const [material, color] = roofFinish;
        mvBlock(batch, 'boards', cx - 0.9 * MVU, ridgeY - 0.4 * MVU, b.y + b.h / 2 - 0.9 * MVU, cx + 0.9 * MVU, ridgeY + 1.3 * MVU, b.y + b.h / 2 + 0.9 * MVU, '#f1e8d2', 'ny');
        mvGableRoof(batch, cx - 0.9 * MVU, b.y + b.h / 2 - 0.9 * MVU, cx + 0.9 * MVU, b.y + b.h / 2 + 0.9 * MVU, 'y', ridgeY + 1.3 * MVU, 0.8 * MVU, 0.25 * MVU, 0.25 * MVU, [material, color], '#3a2a1e');
        if (b.name) mvSign(batch, b.name, cx, 5.4 * MVU, z1 + 0.12 * MVU, Math.min(b.w * 0.7, 8 * MVU));
      }
      // The rescue barn's two bay doors.
      function mvBayDoors(batch, b) {
        const z1 = b.y + b.h;
        for (const t of [0.3, 0.7]) {
          const x = b.x + b.w * t;
          mvCellQuad(batch, 'door', mvFacing(x, 0.1 * MVU, 4.2 * MVU, z1 + 0.06 * MVU, 4 * MVU), [MV_DOOR_CELL[4][0], 0, MV_DOOR_CELL[4][1], 1], '#c9c2b2');
          mvBox(batch, 'timber', x, 4.4 * MVU, z1 + 0.15 * MVU, 4.4 * MVU, 0.3 * MVU, 0.3 * MVU, b.finish.trim);
          addGlow(x, 4.8 * MVU, z1 + 0.5 * MVU, 7, '#ffe6b8', 1, { day: 0 });
          mvPool(batch, x, z1 + 3 * MVU, 5 * MVU, '#ffe0b0', 0.45);
        }
        if (b.name) mvSign(batch, b.name, b.x + b.w / 2, 5.0 * MVU, z1 + 0.14 * MVU, Math.min(b.w * 0.6, 7 * MVU));
      }
      function mvFlagpole(batch, x, z, h) {
        mvCyl(batch, 'chrome', mvV3(x, 0, z), mvV3(x, h, z), 0.09 * MVU, 8, '#dcdcdc');
        mvGeometry(batch, 'chrome', MV_GEO.ball, x, h + 0.15 * MVU, z, 0.2 * MVU, 0.2 * MVU, 0.2 * MVU, '#d9b44a');
        // A county flag, hanging still (the club's flag is the one that flies).
        mvBox(batch, 'paint', x + 0.9 * MVU, h - 0.8 * MVU, z, 1.8 * MVU, 1.1 * MVU, 0.04 * MVU, '#2f5a3a');
        mvBox(batch, 'paint', x + 0.9 * MVU, h - 0.8 * MVU, z + 0.03 * MVU, 0.9 * MVU, 0.5 * MVU, 0.02 * MVU, '#e8dcc0');
        mvBlock(batch, 'stone', x - 0.5 * MVU, 0, z - 0.5 * MVU, x + 0.5 * MVU, 0.4 * MVU, z + 0.5 * MVU, '#b8b2a6');
      }
      // The tavern's front deck: planks, rail, picnic tables, and the string lights over it.
      function mvTavernDeck(batch, b) {
        const D = b.options.deck,
          blockX = b.x - 70,
          blockY = b.y - 200,
          x0 = blockX + D.x,
          z0 = blockY + D.y,
          x1 = x0 + D.w,
          z1 = z0 + D.h,
          stain = mvMix(b.finish.stain, '#ffffff', 0.35);
        mvBlock(batch, 'planks', x0, 0, z0, x1, 0.35 * MVU, z1, stain, 'ny');
        for (const [a, bb] of [[x0, b.door.x - 1.4 * MVU], [b.door.x + 1.4 * MVU, x1]]) {
          mvBox(batch, 'timber', (a + bb) / 2, 1.0 * MVU, z1 - 0.15 * MVU, bb - a, 0.14 * MVU, 0.14 * MVU, mvMix(b.finish.stain, '#000000', 0.1));
          for (let x = a; x <= bb; x += 1.8 * MVU) mvBox(batch, 'timber', x, 0.55 * MVU, z1 - 0.15 * MVU, 0.14 * MVU, 1.0 * MVU, 0.14 * MVU, mvMix(b.finish.stain, '#000000', 0.1));
        }
        mvBox(batch, 'timber', x1 - 0.15 * MVU, 1.0 * MVU, (z0 + z1) / 2, 0.14 * MVU, 0.14 * MVU, z1 - z0, mvMix(b.finish.stain, '#000000', 0.1));
        // Picnic tables with benches, a keg umbrella-less look.
        const tables = Math.floor((x1 - x0) / (4.2 * MVU));
        for (let k = 0; k < tables; k++) {
          const x = x0 + (k + 0.5) * ((x1 - x0) / tables);
          if (Math.abs(x - b.door.x) < 2 * MVU) continue;
          const z = (z0 + z1) / 2 + 0.2 * MVU;
          mvBox(batch, 'timber', x, 0.35 * MVU + 0.75 * MVU, z, 1.9 * MVU, 0.08 * MVU, 0.8 * MVU, stain);
          for (const s of [-1, 1]) mvBox(batch, 'timber', x, 0.35 * MVU + 0.45 * MVU, z + s * 0.75 * MVU, 1.9 * MVU, 0.06 * MVU, 0.3 * MVU, stain);
          for (const s of [-1, 1]) mvBox(batch, 'timber', x + s * 0.7 * MVU, 0.35 * MVU + 0.4 * MVU, z, 0.1 * MVU, 0.8 * MVU, 1.8 * MVU, mvMix(b.finish.stain, '#000000', 0.1));
          mvGeometry(batch, 'glass', MV_GEO.ball, x - 0.3 * MVU, 0.35 * MVU + 0.9 * MVU, z, 0.09 * MVU, 0.14 * MVU, 0.09 * MVU, '#e8b04a');
        }
        // String lights on poles at the deck's corners, sagging towards the tavern.
        const poles = [[x0 + 0.3 * MVU, z1 - 0.3 * MVU], [x1 - 0.3 * MVU, z1 - 0.3 * MVU], [(x0 + x1) / 2, z1 - 0.3 * MVU]];
        for (const [px, pz] of poles) mvCyl(batch, 'timber', mvV3(px, 0, pz), mvV3(px, 4.2 * MVU, pz), 0.1 * MVU, 6, mvMix(b.finish.stain, '#000000', 0.2));
        const eave = b.eaves - 0.2 * MVU;
        mvStringLights(batch, [[poles[0][0], 4.1 * MVU, poles[0][1]], [b.x + 1 * MVU, eave, b.y + b.h + 0.4 * MVU]]);
        mvStringLights(batch, [[poles[2][0], 4.1 * MVU, poles[2][1]], [b.x + b.w / 2, eave, b.y + b.h + 0.4 * MVU]]);
        mvStringLights(batch, [[poles[1][0], 4.1 * MVU, poles[1][1]], [b.x + b.w - 1 * MVU, eave, b.y + b.h + 0.4 * MVU]]);
        mvStringLights(batch, [[poles[0][0], 4.1 * MVU, poles[0][1]], [poles[2][0], 4.1 * MVU, poles[2][1]], [poles[1][0], 4.1 * MVU, poles[1][1]]]);
        mvPool(batch, (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) * 0.55, '#ffcf8a', 0.55);
      }
      // Festoon lights along a polyline of [x, y, z] points: a sagging wire and a bulb every 1.4 m.
      function mvStringLights(batch, points) {
        for (let i = 1; i < points.length; i++) {
          const [ax, ay, az] = points[i - 1],
            [bx, by, bz] = points[i],
            length = Math.hypot(bx - ax, bz - az),
            n = Math.max(2, Math.round(length / (1.4 * MVU))),
            sag = length * 0.07;
          let prev = mvV3(ax, ay, az);
          for (let k = 1; k <= n; k++) {
            const t = k / n,
              p = mvV3(ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * sag, az + (bz - az) * t);
            mvCyl(batch, 'iron', prev, p, 0.03 * MVU, 3, '#1a1a1a');
            if (k < n) {
              mvGeometry(batch, 'lamp', MV_GEO.ball, p.x, p.y - 0.12 * MVU, p.z, 0.09 * MVU, 0.12 * MVU, 0.09 * MVU, k % 3 ? '#fff0c8' : '#ffd0a0');
              if (k % 2 === 0) addGlow(p.x, p.y - 0.15 * MVU, p.z, 3.2, k % 3 ? '#ffd9a0' : '#ffb27a', 1.2, { day: 0, mode: 'steady' });
            }
            prev = p;
          }
        }
      }
      // The fire lookout: four braced legs, a stair, the glazed cab with a catwalk and a hipped roof.
      function mvLookout(batch, b) {
        const cx = b.x + b.w / 2,
          cz = b.y + b.h / 2,
          top = b.eaves,
          leg = b.w / 2 - 0.3 * MVU,
          cabHalf = 2.2 * MVU,
          wood = mvMix(b.finish.stain, '#000000', 0.1);
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mvCyl(batch, 'timber', mvV3(cx + sx * leg, 0, cz + sz * leg), mvV3(cx + sx * cabHalf * 0.8, top, cz + sz * cabHalf * 0.8), 0.16 * MVU, 6, wood, 'timber', wood);
        for (let y = 2.5 * MVU; y < top; y += 2.8 * MVU) {
          const f = 1 - y / top,
            e = cabHalf * 0.8 + (leg - cabHalf * 0.8) * f;
          for (const [a, bb] of [[[-1, -1], [1, 1]], [[1, -1], [-1, 1]], [[-1, 1], [1, 1]], [[-1, -1], [1, -1]]]) {
            if (a[1] === bb[1]) mvCyl(batch, 'timber', mvV3(cx + a[0] * e, y, cz + a[1] * e), mvV3(cx + bb[0] * e, y, cz + bb[1] * e), 0.07 * MVU, 4, wood);
          }
          mvCyl(batch, 'timber', mvV3(cx - e, y, cz + e), mvV3(cx + e, y + 2.8 * MVU, cz + e), 0.06 * MVU, 4, wood);
        }
        // Cab, catwalk, roof.
        mvBlock(batch, 'planks', cx - cabHalf - 0.8 * MVU, top - 0.25 * MVU, cz - cabHalf - 0.8 * MVU, cx + cabHalf + 0.8 * MVU, top, cz + cabHalf + 0.8 * MVU, wood, '');
        mvBlock(batch, 'boards', cx - cabHalf, top, cz - cabHalf, cx + cabHalf, top + 1.0 * MVU, cz + cabHalf, b.finish.boards, 'ny');
        for (const face of ['south', 'east', 'west', 'north'])
          for (const t of [-0.5, 0.5]) {
            const off = face === 'south' ? [cx + t * cabHalf, cz + cabHalf] : face === 'north' ? [cx + t * cabHalf, cz - cabHalf] : face === 'east' ? [cx + cabHalf, cz + t * cabHalf] : [cx - cabHalf, cz + t * cabHalf];
            mvCellQuad(batch, 'windowDark', mvFacing(off[0], top + 1.0 * MVU, top + 2.4 * MVU, off[1], cabHalf * 0.95, face), MV_WINDOW_CELL[0]);
          }
        const roofY = top + 2.5 * MVU,
          e = cabHalf + 0.5 * MVU,
          apex = mvV3(cx, roofY + 1.4 * MVU, cz),
          corners = [mvV3(cx - e, roofY, cz + e), mvV3(cx + e, roofY, cz + e), mvV3(cx + e, roofY, cz - e), mvV3(cx - e, roofY, cz - e)];
        for (let k = 0; k < 4; k++) mvTri(batch, 'metal', corners[k], corners[(k + 1) % 4], apex, b.finish.roofColor);
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mvBox(batch, 'timber', cx + sx * cabHalf, top + 1.75 * MVU, cz + sz * cabHalf, 0.15 * MVU, 1.5 * MVU, 0.15 * MVU, wood);
        // Catwalk rail.
        const r = cabHalf + 0.75 * MVU;
        for (const [ax, az, bx2, bz2] of [[-r, r, r, r], [r, -r, r, r], [-r, -r, -r, r], [-r, -r, r, -r]]) mvCyl(batch, 'timber', mvV3(cx + ax, top + 1.0 * MVU, cz + az), mvV3(cx + bx2, top + 1.0 * MVU, cz + bz2), 0.05 * MVU, 4, wood);
        mvCyl(batch, 'iron', mvV3(cx, apex.y, cz), mvV3(cx, apex.y + 1.6 * MVU, cz), 0.04 * MVU, 4, '#333');
        addGlow(cx, apex.y + 1.6 * MVU, cz, 4, '#ff4a3a', 1.6, { day: 0, mode: 'flicker' });
      }
      // An open-sided shed on posts (the sawmill, a woodshed): roof, a back wall, what is inside.
      function mvOpenShed(batch, b) {
        const F = b.finish,
          x0 = b.x,
          z0 = b.y,
          x1 = b.x + b.w,
          z1 = b.y + b.h,
          eaves = b.eaves,
          wood = mvMix(F.stain, '#000000', 0.1),
          roofFinish = mvRoofFinish(b),
          axis = b.ridge === 'y' ? 'y' : 'x';
        // Posts round the edge.
        const nx = Math.max(2, Math.round(b.w / (4 * MVU))),
          nz = Math.max(1, Math.round(b.h / (4 * MVU)));
        for (let i = 0; i <= nx; i++)
          for (const z of [z0 + 0.2 * MVU, z1 - 0.2 * MVU]) mvBox(batch, 'timber', x0 + 0.2 * MVU + (i * (b.w - 0.4 * MVU)) / nx, eaves / 2, z, 0.3 * MVU, eaves, 0.3 * MVU, wood);
        for (let j = 1; j < nz; j++) for (const x of [x0 + 0.2 * MVU, x1 - 0.2 * MVU]) mvBox(batch, 'timber', x, eaves / 2, z0 + (j * b.h) / nz, 0.3 * MVU, eaves, 0.3 * MVU, wood);
        // Back (north) wall in boards, beams along the eaves.
        mvBlock(batch, 'boards', x0, 0, z0, x1, eaves, z0 + 0.25 * MVU, F.boards);
        for (const z of [z0 + 0.2 * MVU, z1 - 0.2 * MVU]) mvBox(batch, 'timber', (x0 + x1) / 2, eaves - 0.2 * MVU, z, b.w, 0.4 * MVU, 0.3 * MVU, wood);
        mvGables(batch, x0, z0, x1, z1, axis, eaves, b.rise, 'boards', F.boards);
        mvGableRoof(batch, x0, z0, x1, z1, axis, eaves, b.rise, MOUNTAIN_KINDS[b.kind].overhang * MVU, 0.8 * MVU, roofFinish, wood, b.snow);
        if (b.kind === 'woodshed') {
          mvBlock(batch, 'stack', x0 + 0.4 * MVU, 0, z0 + 0.4 * MVU, x1 - 0.4 * MVU, eaves * 0.75, z1 - 1.2 * MVU, '#ffffff', 'ny');
          return;
        }
        // The sawmill inside: the carriage track, a log on the carriage, the head saw, sawdust, lumber.
        const trackZ = (z0 + z1) / 2;
        mvBox(batch, 'iron', (x0 + x1) / 2, 0.4 * MVU, trackZ, b.w * 0.8, 0.8 * MVU, 1.4 * MVU, '#4a4a48');
        mvCyl(batch, 'logs', mvV3(x0 + b.w * 0.2, 1.4 * MVU, trackZ), mvV3(x0 + b.w * 0.55, 1.4 * MVU, trackZ), 0.4 * MVU, 9, mvMix(F.stain, '#ffffff', 0.2), 'stack', '#caa678');
        mvBox(batch, 'iron', x0 + b.w * 0.62, 2.2 * MVU, trackZ, 1.2 * MVU, 4.4 * MVU, 2.6 * MVU, '#6a6f73');
        mvCyl(batch, 'chrome', mvV3(x0 + b.w * 0.62, 2.2 * MVU, trackZ - 0.2 * MVU), mvV3(x0 + b.w * 0.62, 2.2 * MVU, trackZ + 0.2 * MVU), 1.5 * MVU, 16, '#c9cdd0');
        mvGeometry(batch, 'paint', MV_GEO.cone, x0 + b.w * 0.75, 0.9 * MVU, z1 - 3 * MVU, 2.2 * MVU, 1.8 * MVU, 2.2 * MVU, '#d9b88a');
        for (let k = 0; k < 3; k++) mvBlock(batch, 'planks', x0 + b.w * 0.78 + k * 0.1 * MVU, 0, z0 + 2 * MVU + k * 2.2 * MVU, x0 + b.w * 0.95, (0.8 + k * 0.3) * MVU, z0 + 3.6 * MVU + k * 2.2 * MVU, '#e2c89e');
        for (let x = x0 + 4 * MVU; x < x1 - 2 * MVU; x += 8 * MVU) {
          addGlow(x, eaves - 0.8 * MVU, trackZ, 8, '#fff0d8', 0.8, { day: 0 });
          mvPool(batch, x, trackZ, 5 * MVU, '#ffe8c8', 0.35);
        }
        if (b.name) mvSign(batch, b.name, (x0 + x1) / 2, eaves + b.rise * 0.45, z1 + MOUNTAIN_KINDS[b.kind].overhang * MVU * 0.5 + 0.3 * MVU, Math.min(b.w * 0.5, 10 * MVU));
      }
      /* ---- Street dressing ------------------------------------------------------------------ */
      function mvBoardwalk(batch, w) {
        const b = w.building,
          stain = mvMix(b.finish.stain, '#ffffff', 0.4);
        mvBlock(batch, 'planks', w.x, 0, w.y, w.x + w.w, 0.28 * MVU, w.y + w.h, stain, 'ny');
        // Edge beam and a step down at the front.
        mvBox(batch, 'timber', w.x + w.w / 2, 0.14 * MVU, w.y + w.h + 0.12 * MVU, w.w, 0.28 * MVU, 0.24 * MVU, mvMix(b.finish.stain, '#000000', 0.2));
      }
      function mvFence(batch, f) {
        const length = Math.hypot(f.x1 - f.x0, f.y1 - f.y0),
          n = Math.max(1, Math.round(length / (2.6 * MVU))),
          wood = '#8a7458';
        for (let k = 0; k <= n; k++) {
          const t = k / n,
            x = f.x0 + (f.x1 - f.x0) * t,
            z = f.y0 + (f.y1 - f.y0) * t;
          mvCyl(batch, 'timber', mvV3(x, 0, z), mvV3(x, 1.2 * MVU, z), 0.09 * MVU, 5, wood);
        }
        for (const y of [0.55 * MVU, 1.0 * MVU]) mvCyl(batch, 'timber', mvV3(f.x0, y, f.y0), mvV3(f.x1, y, f.y1), 0.06 * MVU, 5, '#9a8466');
      }
      function mvFirewood(batch, f) {
        mvBlock(batch, 'stack', f.x - f.w / 2, 0, f.y, f.x + f.w / 2, f.height, f.y + f.h, '#ffffff', 'ny');
        mvBox(batch, 'metal', f.x, f.height + 0.08 * MVU, f.y + f.h / 2, f.w + 0.3 * MVU, 0.08 * MVU, f.h + 0.3 * MVU, '#5a5a5a');
      }
      function mvPlanter(batch, p) {
        mvCyl(batch, 'timber', mvV3(p.x, 0, p.y), mvV3(p.x, 0.55 * MVU, p.y), 0.42 * MVU, 10, '#7a5a3c');
        for (const y of [0.12, 0.45]) mvCyl(batch, 'iron', mvV3(p.x, y * MVU, p.y), mvV3(p.x, y * MVU + 0.05 * MVU, p.y), 0.43 * MVU, 10, '#2a2a2a');
        mvGeometry(batch, 'paint', MV_GEO.blob, p.x, 0.65 * MVU, p.y, 0.38 * MVU, 0.3 * MVU, 0.38 * MVU, '#3f6a32');
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU;
          mvGeometry(batch, 'paint', MV_GEO.blob, p.x + Math.cos(a) * 0.22 * MVU, 0.82 * MVU, p.y + Math.sin(a) * 0.22 * MVU, 0.13 * MVU, 0.13 * MVU, 0.13 * MVU, p.color, k);
        }
      }
      function mvBench(batch, bench) {
        const c = Math.cos(bench.a),
          s = Math.sin(bench.a);
        // A split-log bench: seat and back on log legs.
        const at = (u, v) => [bench.x + c * u - s * v, bench.y + s * u + c * v];
        const [sx, sz] = at(0, 0),
          [bx, bz] = at(0, -0.35 * MVU);
        mvBox(batch, 'timber', sx, 0.46 * MVU, sz, 1.9 * MVU, 0.1 * MVU, 0.45 * MVU, '#8a6a48', -bench.a);
        mvBox(batch, 'timber', bx, 0.85 * MVU, bz, 1.9 * MVU, 0.4 * MVU, 0.08 * MVU, '#8a6a48', -bench.a);
        for (const u of [-0.75, 0.75]) {
          const [lx, lz] = at(u * MVU, -0.1 * MVU);
          mvCyl(batch, 'logs', mvV3(lx, 0, lz), mvV3(lx, 0.44 * MVU, lz), 0.12 * MVU, 6, '#7a5a3c');
        }
      }
      // The town square: cobbles, a kerb, and the fountain (Northridge) or the well (Stonecreek).
      function mvSquare(batch, s) {
        mvGround(batch, 'cobbles', s.x, s.y, s.x + s.w, s.y + s.h, '#ffffff', 0.18);
        for (const [x0, z0, x1, z1] of [[s.x, s.y, s.x + s.w, s.y + 0.3 * MVU], [s.x, s.y + s.h - 0.3 * MVU, s.x + s.w, s.y + s.h], [s.x, s.y, s.x + 0.3 * MVU, s.y + s.h], [s.x + s.w - 0.3 * MVU, s.y, s.x + s.w, s.y + s.h]])
          mvBlock(batch, 'stone', x0, 0, z0, x1, 0.15 * MVU, z1, '#b3ada2');
        const cx = s.cx,
          cz = s.cy;
        if (s.feature === 'fountain') {
          // An octagonal stone basin, the water, a column with a bowl, a carved bear on top.
          const r = 3.6 * MVU;
          mvCyl(batch, 'stone', mvV3(cx, 0, cz), mvV3(cx, 0.7 * MVU, cz), r, 8, '#c8c2b6', 'stone', '#c8c2b6');
          mvCyl(batch, 'water', mvV3(cx, 0.55 * MVU, cz), mvV3(cx, 0.72 * MVU, cz), r - 0.35 * MVU, 8, '#3f7f94', 'water', '#3f7f94');
          mvCyl(batch, 'stone', mvV3(cx, 0.7 * MVU, cz), mvV3(cx, 2.3 * MVU, cz), 0.45 * MVU, 8, '#b9b3a8');
          mvCyl(batch, 'stone', mvV3(cx, 2.3 * MVU, cz), mvV3(cx, 2.55 * MVU, cz), 1.3 * MVU, 10, '#c8c2b6', 'water', '#5a9fb4');
          mvGeometry(batch, 'stone', MV_GEO.blob, cx, 3.1 * MVU, cz, 0.55 * MVU, 0.6 * MVU, 0.85 * MVU, '#8a8276', 0.3);
          mvGeometry(batch, 'stone', MV_GEO.blob, cx, 3.55 * MVU, cz + 0.55 * MVU, 0.32 * MVU, 0.3 * MVU, 0.35 * MVU, '#8a8276');
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * TAU + 0.4;
            mvCyl(batch, 'water', mvV3(cx + Math.cos(a) * 1.2 * MVU, 2.45 * MVU, cz + Math.sin(a) * 1.2 * MVU), mvV3(cx + Math.cos(a) * 2.2 * MVU, 0.72 * MVU, cz + Math.sin(a) * 2.2 * MVU), 0.07 * MVU, 4, '#cfeef6');
          }
          mvPool(batch, cx, cz, 7 * MVU, '#9fd8ff', 0.18);
        } else {
          // A round stone well under a little shake roof with a windlass and bucket.
          const r = 1.3 * MVU;
          mvCyl(batch, 'stone', mvV3(cx, 0, cz), mvV3(cx, 0.9 * MVU, cz), r, 10, '#bdb6aa', 'stone', '#6b665f');
          mvCyl(batch, 'water', mvV3(cx, 0.5 * MVU, cz), mvV3(cx, 0.55 * MVU, cz), r - 0.25 * MVU, 10, '#22404a');
          for (const s2 of [-1, 1]) mvBox(batch, 'timber', cx + s2 * (r - 0.1 * MVU), 1.6 * MVU, cz, 0.2 * MVU, 3.2 * MVU, 0.2 * MVU, '#6e5540');
          mvCyl(batch, 'timber', mvV3(cx - r, 2.3 * MVU, cz), mvV3(cx + r, 2.3 * MVU, cz), 0.12 * MVU, 6, '#8a6a48');
          mvBox(batch, 'timber', cx + r + 0.25 * MVU, 2.1 * MVU, cz, 0.1 * MVU, 0.5 * MVU, 0.1 * MVU, '#5a4a3a');
          mvCyl(batch, 'timber', mvV3(cx, 1.3 * MVU, cz), mvV3(cx, 1.65 * MVU, cz), 0.22 * MVU, 8, '#6e5540');
          mvGableRoof(batch, cx - r - 0.2 * MVU, cz - 0.9 * MVU, cx + r + 0.2 * MVU, cz + 0.9 * MVU, 'x', 3.2 * MVU, 0.9 * MVU, 0.35 * MVU, 0.25 * MVU, ['shake', '#bfa98e'], '#4a3a2a');
        }
      }
      // The gas station's canopy: log posts, a timber-framed gable roof over two pump islands.
      function mvGasCanopy(batch) {
        const g = MOUNTAIN_VILLAGE.gas,
          h = 4.8 * MVU,
          wood = '#6e5238';
        for (const p of gasCanopyPosts()) {
          mvCyl(batch, 'logs', mvV3(p.x, 0, p.y), mvV3(p.x, h, p.y), 0.28 * MVU, 8, '#b8956a', 'stack', '#caa678');
          mvBlock(batch, 'stone', p.x - 0.5 * MVU, 0, p.y - 0.5 * MVU, p.x + 0.5 * MVU, 0.7 * MVU, p.y + 0.5 * MVU, '#b8b2a6');
        }
        for (const z of [g.y + 12, g.y + g.h - 12]) mvBox(batch, 'timber', g.x + g.w / 2, h + 0.2 * MVU, z, g.w - 10, 0.45 * MVU, 0.35 * MVU, wood);
        mvGables(batch, g.x - 4, g.y, g.x + g.w + 4, g.y + g.h, 'x', h + 0.45 * MVU, 1.8 * MVU, 'boards', '#9a7a58');
        mvGableRoof(batch, g.x - 4, g.y, g.x + g.w + 4, g.y + g.h, 'x', h + 0.45 * MVU, 1.8 * MVU, 0.6 * MVU, 0.6 * MVU, ['metal', '#6b2a24'], '#3a2a1e', 0, true);
        registerOverheadCover(g.x + g.w / 2, g.y + g.h / 2, g.w / 2, g.h / 2, 0, h, h + 2.4 * MVU, 'canopy');
        // Concrete apron, the islands and the pumps (glowing faces at night).
        mvGround(batch, 'gravel', g.x - 20, g.y - 30, g.x + g.w + 20, g.y + g.h + 50, '#c9c6bd', 0.16);
        for (const p of gasPumps()) {
          mvBlock(batch, 'stone', p.x - 1.4 * MVU, 0, p.y - 0.6 * MVU, p.x + 1.4 * MVU, 0.2 * MVU, p.y + 0.6 * MVU, '#d8d4ca');
          mvBox(batch, 'paint', p.x, 1.0 * MVU, p.y, 0.9 * MVU, 1.6 * MVU, 0.55 * MVU, '#b8322a');
          mvBox(batch, 'lamp', p.x, 1.35 * MVU, p.y + 0.29 * MVU, 0.6 * MVU, 0.35 * MVU, 0.02 * MVU, '#f6f0e0');
          mvBox(batch, 'paint', p.x, 1.95 * MVU, p.y, 1.0 * MVU, 0.3 * MVU, 0.6 * MVU, '#f1e8d2');
          mvCyl(batch, 'iron', mvV3(p.x + 0.5 * MVU, 1.2 * MVU, p.y), mvV3(p.x + 0.7 * MVU, 0.6 * MVU, p.y + 0.3 * MVU), 0.04 * MVU, 4, '#111');
        }
        for (let k = 0; k < 3; k++) {
          const x = g.x + (g.w * (k + 1)) / 4;
          addGlow(x, h - 0.2 * MVU, g.y + g.h / 2, 12, '#fff2dc', 0.9, { day: 0 });
        }
        mvPool(batch, g.x + g.w / 2, g.y + g.h / 2, g.w * 0.6, '#fff0d8', 0.6);
        // The price board on a post by the avenue.
        const px = g.x - 6,
          pz = g.y + g.h + 20;
        mvCyl(batch, 'logs', mvV3(px, 0, pz), mvV3(px, 4.4 * MVU, pz), 0.18 * MVU, 7, '#b8956a');
        mvSign(batch, 'GAS · GROCERIES', px, 3.6 * MVU, pz + 0.3 * MVU, 3.6 * MVU, false);
      }
      // The sawmill yard: log decks and lumber stacks.
      function mvMillYard(batch) {
        for (const pile of millLogPiles()) {
          const rows = 3,
            r = 0.36 * MVU;
          for (let k = 0; k < 9; k++)
            for (let j = 0; j < rows - (k % 3 === 2 ? 1 : 0); j++) {
              const z = pile.y + r + ((k * (pile.h - 2 * r)) / 8) * 1,
                y = r + j * r * 1.7;
              if (z > pile.y + pile.h) continue;
              mvCyl(batch, 'logs', mvV3(pile.x + 2, y, z), mvV3(pile.x + pile.w - 2 - (k % 2) * 6, y, z), r, 7, '#a8845c', 'stack', '#caa678');
            }
          mvBox(batch, 'timber', pile.x + pile.w / 2, 0.15 * MVU, pile.y + pile.h / 2, pile.w, 0.3 * MVU, pile.h, '#5a4430');
        }
        for (const s of millLumberStacks()) {
          for (let y = 0.2 * MVU; y < s.height; y += 0.42 * MVU) mvBlock(batch, 'planks', s.x, y, s.y, s.x + s.w, y + 0.34 * MVU, s.y + s.h, '#e0c69c', '');
          for (const x of [s.x + 2, s.x + s.w / 2, s.x + s.w - 2]) for (let y = 0.12 * MVU; y < s.height; y += 0.42 * MVU) mvBox(batch, 'timber', x, y, s.y + s.h / 2, 0.3 * MVU, 0.12 * MVU, s.h + 0.3 * MVU, '#6a5238');
        }
      }
      // The Mountain Rescue pad: concrete, the H and ring, edge lights, the windsock.
      function mvHelipad(batch, h) {
        const s = h.size / 2;
        mvBlock(batch, 'stone', h.x - s, 0, h.y - s, h.x + s, 0.15 * MVU, h.y + s, '#c9c5bc');
        const ring = 5 * MVU;
        for (let k = 0; k < 28; k++) {
          const a0 = (k / 28) * TAU,
            a1 = ((k + 1) / 28) * TAU;
          const p = (a, r) => mvV3(h.x + Math.cos(a) * r, 0.2 * MVU, h.y + Math.sin(a) * r);
          mvQuad(batch, 'paint', [p(a0, ring), p(a0, ring - 0.4 * MVU), p(a1, ring - 0.4 * MVU), p(a1, ring)], '#f2d35a', null, false);
        }
        for (const [x0, z0, x1, z1] of [[-1.6, -2, -1.0, 2], [1.0, -2, 1.6, 2], [-1.0, -0.3, 1.0, 0.3]])
          mvGround(batch, 'gravel', h.x + x0 * MVU, h.y + z0 * MVU, h.x + x1 * MVU, h.y + z1 * MVU, '#fbfbf7', 0.22);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU,
            x = h.x + Math.cos(a) * (s - 1),
            z = h.y + Math.sin(a) * (s - 1);
          mvCyl(batch, 'lamp', mvV3(x, 0.15 * MVU, z), mvV3(x, 0.4 * MVU, z), 0.15 * MVU, 6, '#e6f0ff');
          addGlow(x, 0.5 * MVU, z, 3, '#8fd06a', 1.4, { day: 0 });
        }
        // Windsock on its pole at the pad's corner.
        const wx = h.x - s - 22 + 1.5,
          wz = h.y - s - 2 + 1.5;
        mvCyl(batch, 'iron', mvV3(wx, 0, wz), mvV3(wx, 6 * MVU, wz), 0.07 * MVU, 6, '#d8d8d8');
        mvGeometry(batch, 'paint', MV_GEO.cone, wx + 1.0 * MVU, 5.8 * MVU, wz, 0.45 * MVU, 2.0 * MVU, 0.45 * MVU, '#ff7a1a', 0, Math.PI / 2);
      }
      // A lantern lamp standard: instanced, knockable, and lit (the city's 'lantern' prop kind).
      const MV_LAMP_CAPACITY = 220,
        mvLampPosts = new Three.InstancedMesh(new Three.CylinderGeometry(0.5, 0.9, 1, 8), new Three.MeshStandardMaterial({ color: '#1c1d1f', roughness: 0.5, metalness: 0.6 }), MV_LAMP_CAPACITY),
        mvLampArms = new Three.InstancedMesh(boxGeo, mvLampPosts.material, MV_LAMP_CAPACITY * 2),
        mvLampHeads = new Three.InstancedMesh(new Three.CylinderGeometry(0.75, 1.05, 1, 4), new Three.MeshStandardMaterial({ color: '#fff0cc', emissive: '#ffc977', emissiveIntensity: 0, roughness: 0.25 }), MV_LAMP_CAPACITY);
      for (const im of [mvLampPosts, mvLampArms, mvLampHeads]) {
        im.count = 0;
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.name = 'village lanterns';
        scene.add(im);
      }
      function mvLamp(batch, l) {
        const prop = registerStreetProp('lantern', l.x, l.y),
          height = 3.9 * MVU;
        placePropInstance(mvLampPosts, prop, l.x, height / 2, l.y, 1, height, 1);
        // A scroll bracket and the lantern hung from it.
        placePropInstance(mvLampArms, prop, l.x + 2.2, height - 1.2, l.y, 5, 0.6, 0.6);
        placePropInstance(mvLampArms, prop, l.x, height + 0.6, l.y, 1.6, 1.2, 1.6);
        placePropInstance(mvLampHeads, prop, l.x + 4.2, height - 3.4, l.y, 1.1, 2.6, 1.1, Math.PI / 4);
        prop.halo = glowHandle(addGlow(l.x + 4.2, height - 3.4, l.y, 12, '#ffcf8a', 0.85, { day: 0 }));
        mvPool(batch, l.x + 4, l.y + 2, 9 * MVU, '#ffc27a', 0.6);
      }
      /* ---- The towns ------------------------------------------------------------------------- */
      const mvTownGroups = new Map();
      function mvTownGroup(name, cx, cz) {
        let g = mvTownGroups.get(name);
        if (!g) {
          g = new Three.Group();
          g.name = 'village ' + name;
          scene.add(g);
          statics.push({ x: cx, y: cz, group: g, radius: 820 });
          mvTownGroups.set(name, g);
        }
        return g;
      }
      for (const town of COUNTY_TOWNS) {
        if (!isMountainTown(town)) continue;
        const batch = mvBatch(town.name),
          inTown = (x, y) => x > town.x - 100 && x < town.x + BLOCK_SIZE * 2 + 100 && y > town.y - 100 && y < town.y + BLOCK_SIZE * 2 + 100;
        for (const y of MOUNTAIN_VILLAGE.yards) if (inTown(y.x, y.y)) mvGround(batch, y.kind === 'dirt' ? 'dirt' : 'gravel', y.x, y.y, y.x + y.w, y.y + y.h);
        for (const b of MOUNTAIN_VILLAGE.buildings) if (b.town === town.name) mvHouse(batch, b);
        for (const w of MOUNTAIN_VILLAGE.boardwalks) if (w.building.town === town.name) mvBoardwalk(batch, w);
        for (const f of MOUNTAIN_VILLAGE.fences) if (inTown(f.x0, f.y0)) mvFence(batch, f);
        for (const f of MOUNTAIN_VILLAGE.firewood) if (inTown(f.x, f.y)) mvFirewood(batch, f);
        for (const p of MOUNTAIN_VILLAGE.planters) if (inTown(p.x, p.y)) mvPlanter(batch, p);
        for (const s of MOUNTAIN_VILLAGE.benches) if (inTown(s.x, s.y)) mvBench(batch, s);
        for (const s of MOUNTAIN_VILLAGE.squares) if (s.town === town.name) mvSquare(batch, s);
        for (const l of MOUNTAIN_VILLAGE.lamps) if (inTown(l.x, l.y)) mvLamp(batch, l);
        if (MOUNTAIN_VILLAGE.gas && inTown(MOUNTAIN_VILLAGE.gas.x, MOUNTAIN_VILLAGE.gas.y)) mvGasCanopy(batch);
        if (MOUNTAIN_VILLAGE.mill && inTown(MOUNTAIN_VILLAGE.mill.logs.x, MOUNTAIN_VILLAGE.mill.logs.y)) mvMillYard(batch);
        if (MOUNTAIN_VILLAGE.helipad && inTown(MOUNTAIN_VILLAGE.helipad.x, MOUNTAIN_VILLAGE.helipad.y)) mvHelipad(batch, MOUNTAIN_VILLAGE.helipad);
        const group = mvTownGroup(town.name, town.x + BLOCK_SIZE, town.y + BLOCK_SIZE);
        mvFlush(batch, group);
        // Every building counts as an occluder for the cutaway (the player behind a chalet stays visible).
        for (const b of MOUNTAIN_VILLAGE.buildings)
          if (b.town === town.name) allBuildings.push({ b, group, height: b.height, materials: [MV_MAT[mvWallFinish(b, b.finish.walls)[0]]], tint: new Three.Color(mvWallFinish(b, b.finish.walls)[1]) });
      }
      mvLampPosts.instanceMatrix.needsUpdate = mvLampArms.instanceMatrix.needsUpdate = mvLampHeads.instanceMatrix.needsUpdate = true;
      // @include src/mountain-club3d.js
      /* ---- Per frame -------------------------------------------------------------------------- */
      let mvSmokeClock = 0,
        mvLastTime = 0;
      function updateMountainVisuals() {
        const deltaSeconds = clamp(gameTime - mvLastTime, 0, 0.25),
          night = nightAmount,
          hour = (worldMinutes % 1440) / 60,
          late = hour > 1 && hour < 5 ? 0.35 : 1;
        mvLastTime = gameTime;
        MV_MAT.windowLit.emissiveIntensity = night * 1.25 * late;
        MV_MAT.windowDark.emissiveIntensity = night * 0.05;
        MV_MAT.lamp.emissiveIntensity = night * 2.2;
        mvLampHeads.material.emissiveIntensity = night * 2.4;
        mvPoolMaterial.opacity = clamp(night * 1.15, 0, 1);
        MV_MAT.water.emissiveIntensity = 0.1 + night * 0.25;
        // Wood smoke from a few chimneys, more on a cold night.
        mvSmokeClock -= deltaSeconds;
        if (mvSmokeClock <= 0 && mvChimneys.length) {
          mvSmokeClock = 0.35 + (1 - night) * 0.5;
          for (let k = 0; k < mvChimneys.length; k += 5) {
            const c = mvChimneys[(k + Math.floor(gameTime * 0.1)) % mvChimneys.length];
            if (Math.abs(c.x - viewCenter.x) < viewReach + 100 && Math.abs(c.z - viewCenter.y) < viewReach + 100) engineSmoke(c.x, c.y, c.z, night > 0.4 ? '#8d857c' : '#c9c5bf', 6, 14);
          }
        }
        updateClubVisuals(deltaSeconds);
      }
      function mountainVillageInfo() {
        const towns = {};
        for (const [name, g] of mvTownGroups) {
          let meshes = 0,
            triangles = 0;
          g.traverse((o) => {
            if (!o.isMesh) return;
            meshes++;
            triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
          });
          towns[name] = { meshes, triangles: Math.round(triangles) };
        }
        return { towns, lamps: mvLampPosts.count, signs: mvSignTexts.length, chimneys: mvChimneys.length, total: { meshes: mvStats.meshes, triangles: Math.round(mvStats.triangles), vertices: mvStats.vertices }, club: clubVisualInfo() };
      }
      // END SUBSYSTEM: src/mountain-village3d.js
