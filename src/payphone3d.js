      // The story payphone where mission 1 starts: a 1990s yellow pedestal payphone with its lit PHONE sign, handset,
      // keypad, directory and grime, the newspaper boxes beside it and the pavement dressing round it (litter, leaves, weeds).
      /**
       * THE YELLOW PAYPHONE
       * Scope: createCityRenderer() closure, after vinnytruck3d.js (its metre
       * helpers over the civilian car kit: vtBox, vtBar, vtBeam, vtCylinder).
       *
       * The first thing the player is sent to, so it is dressed for the street
       * camera looking north at it: a pedestal enclosure facing the street (south)
       * on a square post, painted yellow with rust and grime running down from the
       * canopy; a stainless phone (coin slot, LCD, twelve-key pad, coin return,
       * instruction card, hook and a handset on an armoured cord that trembles
       * while the story call waits), placards and stickers inside, a directory on
       * a chain under the shelf, and on the post a double-sided PHONE light box
       * (litSignMaterial: lit at night, dark in a blackout) whose glow spills on
       * the pavement (signLightPools). Two coin-op newspaper boxes flank it; the
       * pavement round it has a worn patch, gum, butts, a flyer, a cup, leaves in
       * the gutter, weeds at the lot edge and a storm drain in the kerb.
       *
       * Draws: the trim merge (post, phone, boxes, can), the yellow paint, the
       * placards, the sign faces, the handset, and the pavement decals (a cutout
       * and a soft pass): seven. The booth and the boxes are foot obstacles; the
       * decals are flat and walked over. Nothing here touches the phone's reach
       * (payphoneInReach, 68 units) or the pavement's walking line.
       */
      const PP = UNITS_PER_METRE;
      // Local metres (x east, y up, z south = the street) to the group at the phone.
      const payphoneGroup = new Three.Group();
      payphoneGroup.position.set(phone.x, 0, phone.y);
      scene.add(payphoneGroup);
      // ---- Canvas art ----
      function payphoneCanvas(width, height, paint) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        paint(canvas.getContext('2d'), width, height);
        const texture = new Three.CanvasTexture(canvas);
        texture.colorSpace = Three.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return texture;
      }
      // Seeded, so the grime and litter are the same every visit.
      let payphoneSeed = 1997;
      const ppRandom = () => ((payphoneSeed = (payphoneSeed * 16807) % 2147483647) - 1) / 2147483646;
      // Yellow enamel: chipped at the edges, rust and grime streaking down from the top, a scuffed kick zone.
      const payphoneGrime = payphoneCanvas(256, 256, (g, w, h) => {
        g.fillStyle = '#e3b21f';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
          g.fillStyle = `rgba(${ppRandom() < 0.5 ? '255,236,150' : '150,105,20'},${0.05 + ppRandom() * 0.08})`;
          g.fillRect(ppRandom() * w, ppRandom() * h, 1 + ppRandom() * 3, 1 + ppRandom() * 3);
        }
        // Streaks from the top edge.
        for (let i = 0; i < 38; i++) {
          const x = ppRandom() * w,
            len = 30 + ppRandom() * 150,
            grad = g.createLinearGradient(0, 0, 0, len);
          const rust = ppRandom() < 0.4;
          grad.addColorStop(0, rust ? 'rgba(122,62,22,0.55)' : 'rgba(60,52,40,0.42)');
          grad.addColorStop(1, 'rgba(60,52,40,0)');
          g.fillStyle = grad;
          g.fillRect(x, 0, 1 + ppRandom() * 3, len);
        }
        // Dirt rising from the bottom (splash and shoes).
        const low = g.createLinearGradient(0, h, 0, h * 0.65);
        low.addColorStop(0, 'rgba(58,48,36,0.55)');
        low.addColorStop(1, 'rgba(58,48,36,0)');
        g.fillStyle = low;
        g.fillRect(0, h * 0.65, w, h * 0.35);
        // Chips down to grey primer.
        for (let i = 0; i < 40; i++) {
          g.fillStyle = ppRandom() < 0.5 ? '#8d8a80' : '#5b4a33';
          g.beginPath();
          g.ellipse(ppRandom() * w, ppRandom() * h, 1 + ppRandom() * 3, 1 + ppRandom() * 2, ppRandom() * 3, 0, TAU);
          g.fill();
        }
      });
      payphoneGrime.wrapS = payphoneGrime.wrapT = Three.RepeatWrapping;
      // Inside the enclosure: rate card, 911 notice, a band flyer, stickers, a marker tag, the phone number plate.
      const payphonePlacards = payphoneCanvas(512, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const card = (x, y, cw, ch, bg, lines) => {
          g.fillStyle = bg;
          g.fillRect(x, y, cw, ch);
          g.strokeStyle = 'rgba(0,0,0,0.35)';
          g.lineWidth = 2;
          g.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
          g.textAlign = 'center';
          for (const [text, size, color, dy] of lines) {
            g.fillStyle = color;
            g.font = `bold ${size}px Arial, Helvetica, sans-serif`;
            g.fillText(text, x + cw / 2, y + dy, cw - 8);
          }
        };
        // Cell 0 (0..128 x 0..256): rate card.
        card(4, 4, 120, 150, '#f4f1e6', [['LOCAL CALLS', 15, '#1c1c1c', 26], ['35¢', 46, '#b3121b', 76], ['NICKELS DIMES', 11, '#1c1c1c', 100], ['QUARTERS', 11, '#1c1c1c', 114], ['LONG DISTANCE', 11, '#1c1c1c', 134], ['DIAL 0', 11, '#1c1c1c', 148]]);
        card(4, 160, 120, 92, '#b3121b', [['EMERGENCY', 15, '#ffffff', 26], ['911', 40, '#ffffff', 66], ['NO COINS NEEDED', 10, '#ffe7e7', 84]]);
        // Cell 1 (128..256): a band flyer, torn.
        g.save();
        g.translate(192, 128);
        g.rotate(-0.06);
        g.fillStyle = '#f0e9d2';
        g.fillRect(-58, -118, 116, 236);
        g.fillStyle = '#141414';
        g.font = 'bold 30px Impact, Arial Black, sans-serif';
        g.textAlign = 'center';
        g.fillText('RUST', 0, -70);
        g.fillText('BUCKET', 0, -40);
        g.fillStyle = '#b3121b';
        g.beginPath();
        g.arc(0, 18, 34, 0, TAU);
        g.fill();
        g.fillStyle = '#141414';
        g.font = 'bold 13px Arial, sans-serif';
        g.fillText('LIVE · FRI 9PM', 0, 78);
        g.fillText('THE PELICAN', 0, 96);
        // Tear-off tabs, a couple taken.
        for (let i = 0; i < 7; i++) if (i !== 2 && i !== 5) g.fillRect(-56 + i * 16, 104, 12, 14);
        g.restore();
        // Cell 2 (256..384): stickers on transparent.
        const stickers = [['#1d5fa8', 'SKATE'], ['#f2c21b', 'KXLA 97.1'], ['#2d8a4b', 'NO FEAR'], ['#e85a1c', 'CALL 1-800'], ['#111111', 'OBEY'], ['#c3272e', 'VOTE NO ON 211']];
        stickers.forEach(([color, text], i) => {
          const x = 262 + (i % 2) * 60,
            y = 12 + Math.floor(i / 2) * 78;
          g.save();
          g.translate(x + 28, y + 30);
          g.rotate((ppRandom() - 0.5) * 0.5);
          g.fillStyle = color;
          g.fillRect(-27, -18, 54, 36);
          g.fillStyle = color === '#f2c21b' ? '#111' : '#fff';
          g.font = 'bold 10px Arial, sans-serif';
          g.textAlign = 'center';
          g.fillText(text, 0, 4, 50);
          g.restore();
        });
        // Cell 3 (384..512): a black marker tag and scratched initials on transparent.
        g.strokeStyle = 'rgba(20,20,22,0.9)';
        g.lineWidth = 5;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(396, 80);
        g.bezierCurveTo(420, 20, 440, 120, 460, 40);
        g.bezierCurveTo(470, 20, 490, 90, 500, 60);
        g.moveTo(400, 100);
        g.lineTo(505, 92);
        g.stroke();
        g.strokeStyle = 'rgba(230,230,225,0.7)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(400, 160);
        g.lineTo(420, 200);
        g.lineTo(440, 160);
        g.moveTo(452, 200);
        g.lineTo(452, 160);
        g.lineTo(478, 180);
        g.lineTo(452, 180);
        g.stroke();
        // Number plate under the tag.
        g.fillStyle = '#f4f1e6';
        g.fillRect(392, 214, 112, 34);
        g.fillStyle = '#1c1c1c';
        g.font = 'bold 13px monospace';
        g.textAlign = 'center';
        g.fillText('(213) 555-0199', 448, 236);
      });
      // The light box: black PHONE and a handset on yellow; at night the letters and ground glow.
      const payphoneSignArt = [false, true].map((glow) =>
        payphoneCanvas(512, 160, (g, w, h) => {
          g.fillStyle = glow ? '#3a2a00' : '#f2c21b';
          g.fillRect(0, 0, w, h);
          if (!glow) {
            g.strokeStyle = '#1a1a1a';
            g.lineWidth = 8;
            g.strokeRect(6, 6, w - 12, h - 12);
          }
          // The handset pictogram: a curved grip, earpiece and mouthpiece.
          const ink = glow ? '#1a1300' : '#141414';
          g.save();
          g.translate(92, 96);
          g.strokeStyle = ink;
          g.fillStyle = ink;
          g.lineWidth = 16;
          g.lineCap = 'round';
          g.beginPath();
          g.arc(0, 0, 44, Math.PI * 1.18, Math.PI * 1.82);
          g.stroke();
          for (const side of [-1, 1]) {
            g.save();
            g.rotate(side * 0.9);
            g.beginPath();
            g.roundRect(-18, -52, 36, 24, 7);
            g.fill();
            g.restore();
          }
          g.restore();
          g.fillStyle = glow ? '#1a1300' : '#141414';
          g.font = 'bold 92px "Arial Black", Arial, Helvetica, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('PHONE', 318, 86, 330);
          if (glow) {
            // The yellow panel is what glows; the letters stay dark over it.
            g.globalCompositeOperation = 'destination-over';
            g.fillStyle = '#ffd24a';
            g.fillRect(12, 12, w - 24, h - 24);
          }
        }),
      );
      // Pavement decals: a 4 x 4 atlas of 128-pixel cells.
      const PP_DECAL = { leafOrange: 0, leafBrown: 1, leafYellow: 2, butts: 3, gum: 4, flyer: 5, cup: 6, paper: 7, weed: 8, grass: 9, stain: 10, worn: 11, cap: 12 };
      const payphoneDecals = payphoneCanvas(512, 512, (g) => {
        g.clearRect(0, 0, 512, 512);
        const cell = (i, draw) => {
          g.save();
          g.translate((i % 4) * 128 + 64, Math.floor(i / 4) * 128 + 64);
          draw();
          g.restore();
        };
        const leaf = (color, vein, lobes) => () => {
          g.fillStyle = color;
          g.beginPath();
          for (let k = 0; k <= lobes * 2; k++) {
            const a = (k / (lobes * 2)) * TAU,
              r = k % 2 ? 26 : 52;
            g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9);
          }
          g.closePath();
          g.fill();
          g.strokeStyle = vein;
          g.lineWidth = 3;
          g.beginPath();
          for (let k = 0; k < lobes; k++) {
            g.moveTo(0, 0);
            g.lineTo(Math.cos((k / lobes) * TAU) * 44, Math.sin((k / lobes) * TAU) * 40);
          }
          g.stroke();
          g.fillStyle = vein;
          g.fillRect(-2, 30, 4, 28);
        };
        cell(PP_DECAL.leafOrange, leaf('#c8641f', '#8b3e12', 5));
        cell(PP_DECAL.leafBrown, leaf('#7d5530', '#4d321b', 5));
        cell(PP_DECAL.leafYellow, () => {
          g.fillStyle = '#c9a534';
          g.beginPath();
          g.ellipse(0, 0, 22, 54, 0.4, 0, TAU);
          g.fill();
          g.strokeStyle = '#8a6d1d';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(-18, 44);
          g.lineTo(18, -44);
          g.stroke();
        });
        cell(PP_DECAL.butts, () => {
          for (let k = 0; k < 6; k++) {
            g.save();
            g.translate((ppRandom() - 0.5) * 80, (ppRandom() - 0.5) * 80);
            g.rotate(ppRandom() * 3);
            g.fillStyle = '#ece6d6';
            g.fillRect(-12, -3.5, 16, 7);
            g.fillStyle = '#c98b4a';
            g.fillRect(4, -3.5, 9, 7);
            g.restore();
          }
        });
        cell(PP_DECAL.gum, () => {
          for (let k = 0; k < 14; k++) {
            g.fillStyle = `rgba(${40 + ppRandom() * 30},${40 + ppRandom() * 30},${44 + ppRandom() * 30},0.85)`;
            g.beginPath();
            g.ellipse((ppRandom() - 0.5) * 110, (ppRandom() - 0.5) * 110, 4 + ppRandom() * 5, 4 + ppRandom() * 4, ppRandom() * 3, 0, TAU);
            g.fill();
          }
        });
        cell(PP_DECAL.flyer, () => {
          g.rotate(0.2);
          g.fillStyle = '#efeadb';
          g.beginPath();
          g.moveTo(-40, -54);
          g.lineTo(44, -50);
          g.lineTo(38, 56);
          g.lineTo(-44, 50);
          g.closePath();
          g.fill();
          g.fillStyle = '#b3121b';
          g.fillRect(-30, -40, 60, 16);
          g.fillStyle = '#555';
          for (let k = 0; k < 6; k++) g.fillRect(-30, -12 + k * 10, 40 + ppRandom() * 20, 4);
          g.strokeStyle = 'rgba(0,0,0,0.15)';
          g.beginPath();
          g.moveTo(-40, 0);
          g.lineTo(40, 6);
          g.stroke();
        });
        cell(PP_DECAL.cup, () => {
          g.fillStyle = '#f3f1ea';
          g.beginPath();
          g.moveTo(-30, -44);
          g.lineTo(30, -44);
          g.lineTo(20, 48);
          g.lineTo(-20, 48);
          g.closePath();
          g.fill();
          g.fillStyle = '#c3272e';
          g.fillRect(-26, -20, 50, 20);
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.ellipse(0, -46, 32, 8, 0, 0, TAU);
          g.fill();
        });
        cell(PP_DECAL.paper, () => {
          g.rotate(-0.3);
          g.fillStyle = '#d9d6cc';
          g.fillRect(-50, -40, 100, 80);
          g.fillStyle = '#8a877e';
          for (let k = 0; k < 9; k++) g.fillRect(-44, -32 + k * 8, 40, 3), g.fillRect(4, -32 + k * 8, 40, 3);
        });
        const blades = (colors, count, height) => () => {
          for (let k = 0; k < count; k++) {
            const x = (ppRandom() - 0.5) * 70,
              lean = (ppRandom() - 0.5) * 40;
            g.strokeStyle = colors[k % colors.length];
            g.lineWidth = 4 + ppRandom() * 3;
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(x, 60);
            g.quadraticCurveTo(x + lean * 0.3, 60 - height * 0.5, x + lean, 60 - height * (0.6 + ppRandom() * 0.4));
            g.stroke();
          }
        };
        cell(PP_DECAL.weed, blades(['#5f7f35', '#71923f', '#4b6a2a', '#8aa04a'], 16, 110));
        cell(PP_DECAL.grass, blades(['#7c8f45', '#9aa55a', '#6d7d3b'], 22, 80));
        const soft = (r, g0, b, alpha) => () => {
          const grad = g.createRadialGradient(0, 0, 4, 0, 0, 62);
          grad.addColorStop(0, `rgba(${r},${g0},${b},${alpha})`);
          grad.addColorStop(0.6, `rgba(${r},${g0},${b},${alpha * 0.55})`);
          grad.addColorStop(1, `rgba(${r},${g0},${b},0)`);
          g.fillStyle = grad;
          g.beginPath();
          g.arc(0, 0, 62, 0, TAU);
          g.fill();
        };
        cell(PP_DECAL.stain, soft(34, 30, 28, 0.55));
        cell(PP_DECAL.worn, soft(48, 44, 40, 0.45));
        cell(PP_DECAL.cap, () => {
          for (let k = 0; k < 4; k++) {
            g.fillStyle = ['#c3272e', '#d7d7d2', '#2c5aa0', '#b8b8b0'][k];
            g.beginPath();
            g.arc((ppRandom() - 0.5) * 70, (ppRandom() - 0.5) * 70, 7, 0, TAU);
            g.fill();
          }
        });
      });
      // ---- Materials ----
      const payphonePaint = new Three.MeshStandardMaterial({ color: '#ffffff', map: payphoneGrime, roughness: 0.5, metalness: 0.25 }),
        payphonePlacardMaterial = new Three.MeshStandardMaterial({ map: payphonePlacards, transparent: true, alphaTest: 0.05, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
        payphoneSignMaterial = litSignMaterial(payphoneSignArt[0], payphoneSignArt[1], { night: 3.4, day: 0.08, doubleSided: false }),
        payphoneDecalCut = new Three.MeshStandardMaterial({ map: payphoneDecals, alphaTest: 0.5, roughness: 0.85, side: Three.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
        payphoneDecalSoft = new Three.MeshStandardMaterial({ map: payphoneDecals, transparent: true, depthWrite: false, roughness: 0.9, side: Three.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      // A quad from four corners in metres ((u0, v0), (u1, v0), (u1, v1), (u0, v1) in order) with explicit UVs.
      function ppQuad(set, corners, [u0, v0, u1, v1]) {
        const base = set.count,
          [a, b, , d] = corners,
          e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
          e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]],
          n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]],
          len = Math.hypot(n[0], n[1], n[2]) || 1,
          uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        corners.forEach((p, i) => {
          set.position.push(p[0] * PP, p[1] * PP, p[2] * PP);
          set.normal.push(n[0] / len, n[1] / len, n[2] / len);
          set.uv.push(uvs[i][0], uvs[i][1]);
          set.color.push(1, 1, 1);
          set.finish.push(0.8, 0);
        });
        set.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
        set.count += 4;
      }
      let payphoneHandset = null;
      // ---- The booth ----
      (function buildPayphone() {
        const S = civShapeKit(),
          trim = civSet(),
          yellow = civSet(),
          placards = civSet(),
          sign = civSet(),
          handset = civSet(),
          steel = { color: '#c8ccce', finish: 'alloy' },
          bright = { color: '#dfe3e6', finish: 'chrome' },
          black = { color: '#161718', finish: 'satin' },
          post = { color: '#3a3e41', finish: 'satin' },
          // The paint's grime runs down each face: a planar projection by height.
          grime = { uvOf: (x, y, z) => [(x + z) / (0.9 * PP), y / (1.1 * PP) - 0.8], finish: 'satin' };
        // Footing: a cast pad with a worn edge.
        vtBox(trim, -0.48, 0.48, 0, 0.02, -0.26, 0.4, { color: '#86837b', finish: 'matte' });
        vtBox(trim, -0.45, 0.45, 0.02, 0.024, -0.23, 0.37, { color: '#7a776f', finish: 'matte' });
        // The square post, its base plate and bolts, a cap; it carries the enclosure and the sign.
        vtBox(trim, -0.05, 0.05, 0.04, 2.34, -0.23, -0.13, post);
        vtBox(trim, -0.12, 0.12, 0.035, 0.05, -0.3, -0.06, post);
        for (const [x, z] of [[-0.09, -0.27], [0.09, -0.27], [-0.09, -0.09], [0.09, -0.09]]) vtCylinder(trim, S.hex, x, 0.06, z, 0.012, 0.025, 'y', steel);
        // ENCLOSURE: back panel, side wings, canopy (yellow enamel), black edge trim.
        vtBox(yellow, -0.4, 0.4, 0.9, 1.98, -0.13, -0.1, grime);
        for (const s of [-1, 1]) {
          vtBox(yellow, s * 0.38, s * 0.4, 0.9, 1.98, -0.13, 0.3, grime);
          vtBox(trim, s * 0.378, s * 0.402, 0.9, 1.98, 0.3, 0.315, black);
          vtBox(trim, s * 0.378, s * 0.402, 0.885, 0.9, -0.13, 0.315, black);
        }
        vtBeam(yellow, S.box, [0, 2.0, -0.15], [0, 1.985, 0.33], 0.86, 0.035, grime, [1, 0, 0]);
        vtBar(trim, [-0.43, 1.985, 0.335], [0.43, 1.985, 0.335], 0.05, 0.03, 0.01, black);
        // PHONE: the stainless housing.
        vtBar(trim, [0, 1.06, -0.04], [0, 1.64, -0.04], 0.24, 0.12, 0.02, steel, [1, 0, 0]);
        // Top: coin slot plate and LCD.
        vtBox(trim, -0.06, 0.06, 1.57, 1.6, 0.018, 0.026, bright);
        vtBox(trim, -0.025, 0.025, 1.578, 1.592, 0.024, 0.028, black);
        vtBox(trim, -0.075, 0.075, 1.5, 1.545, 0.018, 0.024, { color: '#2a3a2c', finish: 'gloss' });
        vtBox(trim, -0.07, 0.07, 1.505, 1.54, 0.024, 0.026, { color: '#7e9a6e', finish: 'lens' });
        // Keypad bezel and twelve keys.
        vtBox(trim, -0.07, 0.07, 1.23, 1.46, 0.018, 0.024, { color: '#2b2d30', finish: 'satin' });
        for (let row = 0; row < 4; row++)
          for (let col = 0; col < 3; col++)
            vtBox(trim, -0.052 + col * 0.04 - 0.014, -0.052 + col * 0.04 + 0.014, 1.425 - row * 0.05 - 0.017, 1.425 - row * 0.05 + 0.017, 0.024, 0.034, bright);
        // Instruction card, coin return cup, the hook and its switch.
        vtBox(trim, -0.08, 0.08, 1.12, 1.21, 0.018, 0.022, { color: '#efece2', finish: 'plastic', cell: 'plate' });
        vtBox(trim, -0.035, 0.035, 1.07, 1.105, 0.01, 0.05, black);
        vtBox(trim, -0.16, -0.115, 1.5, 1.56, -0.03, 0.03, bright);
        vtBox(trim, -0.165, -0.13, 1.28, 1.3, -0.02, 0.02, bright);
        // The armoured cord from the housing's foot to the handset's tail: a stainless catenary.
        const cordFrom = [-0.1, 1.08, 0.02],
          cordTo = [-0.145, 1.27, 0.035];
        let previous = cordFrom;
        for (let k = 1; k <= 8; k++) {
          const t = k / 8,
            sag = Math.sin(t * Math.PI) * 0.09,
            p = [cordFrom[0] + (cordTo[0] - cordFrom[0]) * t - sag * 0.3, cordFrom[1] + (cordTo[1] - cordFrom[1]) * t - sag, cordFrom[2] + (cordTo[2] - cordFrom[2]) * t + sag * 0.4];
          vtBeam(trim, S.box, previous, p, 0.018, 0.018, bright);
          previous = p;
        }
        // HANDSET (its own mesh: it trembles while the call waits), on the hook, earpiece up.
        vtBar(handset, [0, -0.1, 0], [0, 0.1, 0], 0.045, 0.04, 0.015, black, [0, 0, 1]);
        for (const y of [-0.11, 0.11]) civAdd(handset, S.cylinder, 0, y * PP, 0.01 * PP, 0.038 * PP, 0.04 * PP, 0.038 * PP, black, Math.PI / 2, 0, 0);
        // DIRECTORY: a sloped shelf, the binder on its chain under it.
        vtBeam(trim, S.box, [0, 0.95, -0.1], [0, 0.99, 0.19], 0.56, 0.02, { color: '#5d6266', finish: 'satin' }, [1, 0, 0]);
        vtBox(trim, -0.28, 0.28, 0.93, 0.995, 0.185, 0.2, { color: '#4a4e52', finish: 'satin' });
        // The directory on the shelf, chained: black binder, yellow cover, dog-eared pages.
        vtBeam(trim, S.box, [0.02, 0.985, -0.04], [0.02, 1.015, 0.15], 0.24, 0.035, { color: '#161616', finish: 'plastic' }, [1, 0, 0]);
        vtBeam(trim, S.box, [0.02, 1.004, -0.035], [0.02, 1.034, 0.145], 0.22, 0.006, { color: '#e3b726', finish: 'plastic' }, [1, 0, 0]);
        vtBeam(trim, S.box, [0.13, 0.99, -0.03], [0.13, 1.02, 0.14], 0.012, 0.03, { color: '#ece6d2', finish: 'matte' }, [1, 0, 0]);
        vtBeam(trim, S.box, [-0.1, 1.0, -0.04], [-0.14, 1.12, -0.09], 0.01, 0.01, bright);
        // PLACARDS AND STICKERS on the back panel's face, round the phone, and the wings' insides.
        const card = (x0, x1, y0, y1, u0, u1, v0, v1, z = -0.098) =>
          vtBox(placards, x0, x1, y0, y1, z, z + 0.002, { uvOf: (x, y) => [u0 + ((x / PP - x0) / (x1 - x0)) * (u1 - u0), v0 + ((y / PP - y0) / (y1 - y0)) * (v1 - v0)] });
        card(0.15, 0.35, 1.3, 1.6, 0.0, 0.25, 0.4, 1.0);
        card(0.15, 0.35, 1.08, 1.27, 0.0, 0.25, 0.02, 0.36);
        card(-0.36, -0.17, 1.02, 1.4, 0.25, 0.5, 0.0, 1.0);
        card(-0.36, -0.2, 1.52, 1.84, 0.5, 0.75, 0.0, 1.0);
        card(0.16, 0.36, 1.66, 1.92, 0.75, 1.0, 0.0, 1.0);
        // THE SIGN: a light box on the post above the canopy, PHONE both ways; a yellow frame.
        vtBox(trim, -0.39, 0.39, 2.06, 2.42, -0.24, -0.12, { color: '#d9a91c', finish: 'gloss' });
        vtBox(trim, -0.4, 0.4, 2.42, 2.44, -0.25, -0.11, { color: '#2a2b2d', finish: 'satin' });
        ppQuad(sign, [[-0.37, 2.08, -0.118], [0.37, 2.08, -0.118], [0.37, 2.4, -0.118], [-0.37, 2.4, -0.118]], [0, 0, 1, 1]);
        ppQuad(sign, [[0.37, 2.08, -0.242], [-0.37, 2.08, -0.242], [-0.37, 2.4, -0.242], [0.37, 2.4, -0.242]], [0, 0, 1, 1]);
        const toMesh = (set, material, colors = true) => {
          const m = new Three.Mesh(civGeometry(set, { colors, finish: colors }), material);
          m.castShadow = m.receiveShadow = true;
          payphoneGroup.add(m);
          return m;
        };
        toMesh(trim, civSharedMaterials().trim);
        toMesh(yellow, payphonePaint, false);
        toMesh(placards, payphonePlacardMaterial, false).castShadow = false;
        toMesh(sign, payphoneSignMaterial, false).castShadow = false;
        const handsetMesh = toMesh(handset, civSharedMaterials().trim);
        handsetMesh.position.set(-0.14 * PP, 1.42 * PP, 0.035 * PP);
        handsetMesh.userData.dynamic = true;
        payphoneHandset = handsetMesh;
        // NEWSPAPER BOXES either side: coin-op, a paper behind the window, the masthead band.
        newspaperBox(-0.95, 'SOUTH COAST', 'TIMES', '#1d4f93');
        newspaperBox(0.95, 'THE WEEKLY', 'FREE', '#c33a2a');
        // The pavement round it.
        payphoneDressing();
        // People walk round the booth and the boxes, not through them.
        registerFootObstacle(phone.x, phone.y + 0.08 * PP, 0.44 * PP, 0.27 * PP);
        for (const s of [-1, 1]) registerFootObstacle(phone.x + s * 0.95 * PP, phone.y + 0.02 * PP, 0.27 * PP, 0.25 * PP);
        // The sign's glow on the pavement at night (lighting3d-sky.js night light map).
        signLightPools.push({ x: phone.x, y: phone.y + 0.9 * PP, r: 2.6 * PP, color: [1, 0.86, 0.5], strength: 0.16 });
      })();
      function newspaperBox(x, top, name, color) {
        const set = civSet(),
          art = civSet(),
          S = civShapeKit(),
          paint = { color, finish: 'gloss' },
          steel = { color: '#b9bdc0', finish: 'alloy' },
          dark = { color: '#1b1c1e', finish: 'satin' };
        // Pedestal legs on a base plate, the body, a domed lid, the window door and its coin mechanism.
        vtBox(set, x - 0.24, x + 0.24, 0, 0.02, -0.2, 0.2, dark);
        for (const s of [-1, 1]) vtBox(set, x + s * 0.17 - 0.02, x + s * 0.17 + 0.02, 0.02, 0.36, -0.02, 0.02, dark);
        vtBar(set, [x - 0.25, 0.7, 0], [x + 0.25, 0.7, 0], 0.68, 0.44, 0.03, paint);
        civAdd(set, S.lowDome, x * PP, 1.04 * PP, 0, 0.25 * PP, 0.05 * PP, 0.22 * PP, paint);
        // The window door: a steel frame round the front page (headline, photo, columns).
        for (const [x0, x1, y0, y1] of [[-0.21, 0.21, 0.58, 0.61], [-0.21, 0.21, 0.89, 0.92], [-0.21, -0.18, 0.58, 0.92], [0.18, 0.21, 0.58, 0.92]])
          vtBox(set, x + x0, x + x1, y0, y1, 0.218, 0.23, steel);
        vtBox(set, x - 0.18, x + 0.18, 0.61, 0.89, 0.22, 0.222, { color: '#b9b5a8', finish: 'matte' });
        vtBox(set, x - 0.15, x + 0.15, 0.845, 0.875, 0.222, 0.2235, { color: '#1c1c1c', finish: 'matte' });
        vtBox(set, x - 0.15, x - 0.01, 0.64, 0.83, 0.222, 0.2235, { color: '#6d6a64', finish: 'matte' });
        for (let k = 0; k < 6; k++) vtBox(set, x + 0.01, x + 0.15, 0.815 - k * 0.03, 0.825 - k * 0.03, 0.222, 0.2235, { color: '#77736b', finish: 'matte' });
        vtBox(set, x + 0.08, x + 0.2, 0.44, 0.6, 0.22, 0.24, steel);
        vtBox(set, x + 0.12, x + 0.16, 0.55, 0.58, 0.24, 0.244, dark);
        vtBox(set, x - 0.2, x + 0.02, 0.46, 0.52, 0.22, 0.224, { color: '#cfcbbf', finish: 'plastic', cell: 'plate' });
        const m = new Three.Mesh(civGeometry(set), civSharedMaterials().trim);
        m.castShadow = m.receiveShadow = true;
        payphoneGroup.add(m);
        // The masthead: lettering on a card across the top of the door.
        const tex = payphoneCanvas(256, 64, (g, w, h) => {
          g.fillStyle = color;
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#ffffff';
          g.textAlign = 'center';
          g.font = 'bold 18px Georgia, serif';
          g.fillText(top, w / 2, 24, w - 12);
          g.font = 'bold 26px Georgia, serif';
          g.fillText(name, w / 2, 54, w - 12);
        });
        const label = new Three.Mesh(new Three.PlaneGeometry(0.42 * PP, 0.1 * PP), new Three.MeshStandardMaterial({ map: tex, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        label.position.set(x * PP, 0.975 * PP, 0.2255 * PP);
        payphoneGroup.add(label);
      }
      // Litter, leaves and weeds round the booth (local metres; the kerb is 5.4 m south of the phone).
      function payphoneDressing() {
        const cut = civSet(),
          soft = civSet(),
          S = civShapeKit(),
          trim = civSet(),
          cellUv = (i) => [(i % 4) / 4, 1 - Math.floor(i / 4) / 4 - 0.25, (i % 4) / 4 + 0.25, 1 - Math.floor(i / 4) / 4],
          flat = (set, cellIndex, x, z, size, turn, lift = 0.004, stretch = 1) => {
            const c = Math.cos(turn),
              s = Math.sin(turn),
              hx = size / 2,
              hz = (size * stretch) / 2,
              at = (lx, lz) => [x + lx * c - lz * s, lift, z + lx * s + lz * c];
            // (u0, v0) at the south-west corner: the cell reads upright on screen.
            ppQuad(set, [at(-hx, hz), at(hx, hz), at(hx, -hz), at(-hx, -hz)], cellUv(cellIndex));
          },
          tuft = (cellIndex, x, z, size) => {
            for (const turn of [0.3, 1.87]) {
              const c = Math.cos(turn) * size * 0.5,
                s = Math.sin(turn) * size * 0.5;
              ppQuad(cut, [[x - c, 0, z - s], [x + c, 0, z + s], [x + c, size, z + s], [x - c, size, z - s]], cellUv(cellIndex));
            }
          };
        // Worn concrete where people stand to call, a grease stain by the pole.
        flat(soft, PP_DECAL.worn, 0, 0.5, 1.6, 0, 0.003, 0.55);
        flat(soft, PP_DECAL.stain, 0.6, 1.8, 0.8, 0.6, 0.003);
        flat(soft, PP_DECAL.stain, -2.4, 2.6, 1.1, 1.2, 0.003, 0.6);
        // Gum, butts, a crushed cup, a flyer, bottle caps.
        flat(cut, PP_DECAL.gum, 0.3, 1.9, 1.2, 0.3);
        flat(cut, PP_DECAL.gum, -1.6, 2.2, 1.0, 1.1);
        flat(cut, PP_DECAL.gum, 2.2, 3.0, 1.1, 2.2);
        flat(cut, PP_DECAL.butts, 0.45, 0.45, 0.45, 0.4);
        flat(cut, PP_DECAL.butts, -3.3, 3.9, 0.4, 2.0);
        flat(cut, PP_DECAL.flyer, -0.64, 0.66, 0.32, 0.5, 0.006);
        flat(cut, PP_DECAL.paper, 3.1, 1.4, 0.55, -0.4, 0.006);
        flat(cut, PP_DECAL.cup, 1.5, 4.9, 0.16, 1.2, 0.02, 1.6);
        flat(cut, PP_DECAL.cap, -1.1, 4.6, 0.35, 0.2);
        // Leaves: blown against the lot's edge and down the gutter along the kerb.
        for (let i = 0; i < 26; i++) {
          const kerb = i < 16,
            x = kerb ? -4 + ppRandom() * 8 : -3 + ppRandom() * 6,
            z = kerb ? 5.15 + ppRandom() * 0.5 : -0.3 + ppRandom() * 0.4,
            kind = [PP_DECAL.leafOrange, PP_DECAL.leafBrown, PP_DECAL.leafYellow][i % 3];
          // Those in the gutter lie on the road, a kerb's height lower (the road is at 0 too: flat).
          flat(cut, kind, x, z, 0.1 + ppRandom() * 0.06, ppRandom() * TAU, 0.005 + (i % 4) * 0.0015);
        }
        // Weeds in the joint between the pavement and the lot, and at the booth's foot.
        for (const [x, z, size] of [[-0.62, -0.3, 0.22], [0.58, -0.28, 0.18], [-2.6, -0.2, 0.26], [1.9, -0.22, 0.2], [3.4, -0.25, 0.3], [-3.8, -0.24, 0.2]])
          tuft(x < -2 || x > 3 ? PP_DECAL.grass : PP_DECAL.weed, x, z, size);
        // A crushed can and a bottle by the booth; the storm drain in the gutter.
        civAdd(trim, S.cylinderLow, 0.62 * PP, 0.03 * PP, 0.35 * PP, 0.033 * PP, 0.1 * PP, 0.033 * PP, { color: '#b3121b', finish: 'alloy' }, 0, 0.6, Math.PI / 2);
        civAdd(trim, S.cylinderLow, -3.0 * PP, 0.035 * PP, 4.3 * PP, 0.035 * PP, 0.22 * PP, 0.035 * PP, { color: '#3d5a2c', finish: 'lens' }, 0, 1.2, Math.PI / 2);
        vtBox(trim, 2.1, 3.1, 0.0, 0.012, 5.46, 5.84, { color: '#1c1d1e', finish: 'satin', cell: 'slats' });
        vtBox(trim, 2.05, 3.15, 0.0, 0.008, 5.42, 5.88, { color: '#5b5a55', finish: 'matte' });
        const add = (set, material, colors) => {
          const m = new Three.Mesh(civGeometry(set, { colors, finish: colors }), material);
          m.receiveShadow = true;
          m.castShadow = false;
          payphoneGroup.add(m);
        };
        add(soft, payphoneDecalSoft, false);
        add(cut, payphoneDecalCut, false);
        add(trim, civSharedMaterials().trim, true);
      }
      // Per frame: the handset trembles on its hook while the story call rings.
      function updatePayphoneVisuals() {
        if (!payphoneHandset) return;
        const ringing = !mission && storyCallWaiting() && gameTime % 3 < 1.6,
          buzz = ringing ? Math.sin(gameTime * 90) * 0.012 : 0;
        payphoneHandset.rotation.z = buzz;
        payphoneHandset.position.y = (1.42 + (ringing ? Math.abs(buzz) * 0.3 : 0)) * PP;
      }
