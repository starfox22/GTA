          /** Gold leaf on dark stone, lacquer or wood: engraved serif capitals; banks, pawnbrokers, the college. */
          carved(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, P.shape || 'rect', 0, 0, w, h);
            K.fillBoard(dg, P.kind || 'glass', 0, 0, w, h, P.ground, text);
            if (P.rules !== false) {
              dg.strokeStyle = P.ruleColor || '#c9a24e';
              dg.lineWidth = 2.4 * u;
              dg.strokeRect(6 * u, 6 * u, w - 12 * u, h - 12 * u);
              dg.lineWidth = 1 * u;
              dg.strokeRect(10 * u, 10 * u, w - 20 * u, h - 20 * u);
            }
            const box = emblems(dg, gg, w, h, P, 18 * u, paintedIcon(dg, { ...P, ink: P.iconColor || '#d9ae55', ground: P.iconColor2 || P.ground })),
              ls = linesOf(text, P),
              rs = rows(ls.length, 16 * u, P.sub ? h * 0.72 : h - 16 * u, P.ratio);
            ls.forEach((line, i) =>
              K.fxText(dg, line, box.cx, rs[i].cy, {
                font: P.font || 'times',
                weight: P.weight || '700',
                size: rs[i].cap * 1.1,
                maxW: box.span,
                spacing: P.spacing ?? 0.14,
                fill: P.ink ? P.ink : K.gold,
                shadow: [1.2 * u, 1.8 * u, 'rgba(0,0,0,0.7)', 0.6 * u],
              }),
            );
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.82, { font: P.font || 'times', weight: '700', size: h * 0.11, maxW: box.span * 0.6, spacing: 0.4, fill: P.ink || '#d9ae55' });
            K.backlight(dg, gg, w, h, 0.3, true);
            return spec({ backColor: K.shade(P.ground, 0.4), lamps: true, light: '#ffe2b0', day: 0.1 });
          },
          /** A brass plaque with engraved lettering and four screws. */
          plaque(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, 'round', 2 * u, 2 * u, w - 4 * u, h - 4 * u);
            K.fillBoard(dg, 'brushed', 0, 0, w, h, P.metal || '#b8914a', text);
            K.boardPath(dg, 'round', 2 * u, 2 * u, w - 4 * u, h - 4 * u);
            dg.lineWidth = 2 * u;
            dg.strokeStyle = K.shade(P.metal || '#b8914a', 0.45);
            dg.stroke();
            for (const [x, y] of [
              [9 * u, 12 * u],
              [w - 9 * u, 12 * u],
              [9 * u, h - 12 * u],
              [w - 9 * u, h - 12 * u],
            ]) {
              dg.fillStyle = K.shade(P.metal || '#b8914a', 0.4);
              dg.beginPath();
              dg.arc(x, y, 3 * u, 0, FULL_TURN);
              dg.fill();
            }
            const ls = linesOf(text, P),
              rs = rows(ls.length, 16 * u, h - 16 * u);
            ls.forEach((line, i) =>
              K.fxText(dg, line, w / 2, rs[i].cy, {
                font: P.font || 'times',
                weight: '700',
                size: rs[i].cap,
                maxW: w - 44 * u,
                spacing: 0.2,
                fill: P.ink || '#2a1d10',
                shadow: [0, 1.4 * u, 'rgba(255,240,200,0.7)', 0],
              }),
            );
            K.backlight(dg, gg, w, h, 0.3, true);
            return spec({ backColor: '#3a2f1f', lamps: true, light: '#ffe2b0', day: 0.08 });
          },
          /** Kustom-kulture garage board: flames, pinstripes and chrome 3D italic letters. */
          customs(dg, gg, w, h, text, P) {
            const u = h / 100,
              rnd = K.seeded(text);
            K.boardPath(dg, 'round', 0, 0, w, h);
            K.fillBoard(dg, 'glass', 0, 0, w, h, P.board || '#101012', text);
            // Flames licking up from the bottom edge.
            dg.save();
            K.boardPath(dg, 'round', 0, 0, w, h);
            dg.clip();
            for (let k = 0; k < 26; k++) {
              const x = (k / 25) * w + (rnd() - 0.5) * 20 * u,
                s = h * (0.35 + rnd() * 0.45),
                f = dg.createLinearGradient(0, h, 0, h - s * 1.2);
              f.addColorStop(0, '#ffe24a');
              f.addColorStop(0.45, '#ff7a1a');
              f.addColorStop(1, '#c4121a');
              for (const g of [dg, gg]) {
                g.save();
                g.translate(x, h - s * 0.2);
                g.scale(0.55, 1);
                K.icon(g, 'flame', 0, -s * 0.3, s, g === dg ? f : K.rgba('#ff6a1a', 0.55));
                g.restore();
              }
            }
            dg.restore();
            // Pinstripe scrolls in the corners.
            dg.strokeStyle = P.pinstripe || '#7fe3ff';
            dg.lineWidth = 1.3 * u;
            for (const side of [-1, 1]) {
              dg.save();
              dg.translate(side < 0 ? 26 * u : w - 26 * u, 22 * u);
              dg.scale(side, 1);
              dg.beginPath();
              dg.moveTo(0, 0);
              dg.bezierCurveTo(20 * u, -12 * u, 34 * u, 6 * u, 18 * u, 10 * u);
              dg.bezierCurveTo(8 * u, 12 * u, 8 * u, 2 * u, 16 * u, 2 * u);
              dg.moveTo(0, 0);
              dg.bezierCurveTo(-8 * u, 16 * u, 10 * u, 24 * u, 2 * u, 32 * u);
              dg.stroke();
              dg.restore();
            }
            const box = emblems(dg, gg, w, h, { icon: 'wrenches', icon2: true, iconSize: 0.55, iconDy: -0.08 }, 14 * u, (kind, x, y, s) =>
              K.icon(dg, kind, x, y, s, '#d9e1e8', '#000'),
            );
            const ls = linesOf(text, P);
            K.fxText(dg, ls[0], box.cx, h * 0.42, {
              font: 'impact',
              weight: '900',
              size: h * 0.56,
              maxW: box.span,
              skew: 0.22,
              condense: 0.92,
              fill: K.chrome,
              outline: [2.6 * u, P.outline || '#c4121a'],
              extrude: [3 * u, 5 * u, '#3b0606'],
            });
            if (P.sub)
              K.fxText(dg, P.sub, box.cx, h * 0.8, { font: 'impact', weight: '900', size: h * 0.14, maxW: box.span * 0.8, skew: 0.22, spacing: 0.3, fill: '#ffe24a', outline: [1 * u, '#000'] });
            // Night: a red neon outline round the board and the chrome lit by it.
            K.tubes(dg, gg, [[[6 * u, 6 * u], [w - 6 * u, 6 * u], [w - 6 * u, h - 6 * u], [6 * u, h - 6 * u], [6 * u, 6 * u]]], 2.4 * u, '#ff2a3a', { electrodes: false });
            K.backlight(dg, gg, w, h, 0.18);
            return spec({ backColor: '#1a0a0a', light: '#ff5a3a' });
          },
          /** Miami airbrush: a sunset gradient with sun stripes and palms, fat italic letters. */
          airbrush(dg, gg, w, h, text, P) {
            const u = h / 100,
              [c0, c1, c2] = P.grad;
            K.boardPath(dg, 'round', 0, 0, w, h);
            dg.save();
            dg.clip();
            const f = dg.createLinearGradient(0, 0, 0, h);
            f.addColorStop(0, c0);
            f.addColorStop(0.55, c1);
            f.addColorStop(1, c2);
            dg.fillStyle = f;
            dg.fillRect(0, 0, w, h);
            if (P.sun !== false) {
              dg.fillStyle = P.sunColor || '#ffcf5a';
              dg.beginPath();
              dg.arc(w * 0.78, h * 0.62, h * 0.42, 0, FULL_TURN);
              dg.fill();
              dg.fillStyle = c1;
              for (let k = 0; k < 5; k++) dg.fillRect(w * 0.6, h * (0.52 + k * 0.1), w * 0.4, h * (0.015 + k * 0.012));
            }
            if (P.palms)
              for (const [x, s] of [
                [0.06, 0.9],
                [0.95, 0.75],
              ])
                K.icon(dg, 'palm', w * x, h * 0.55, h * s, K.rgba('#1a1030', 0.75), K.rgba('#1a1030', 0.75));
            if (P.grid) {
              dg.strokeStyle = K.rgba(P.grid, 0.45);
              dg.lineWidth = 1 * u;
              for (let k = 0; k < 6; k++) {
                const y = h * 0.72 + k * k * h * 0.012;
                dg.beginPath();
                dg.moveTo(0, y);
                dg.lineTo(w, y);
                dg.stroke();
              }
              for (let k = -10; k <= 10; k++) {
                dg.beginPath();
                dg.moveTo(w / 2 + k * w * 0.02, h * 0.72);
                dg.lineTo(w / 2 + k * w * 0.12, h);
                dg.stroke();
              }
            }
            dg.restore();
            const box = emblems(dg, gg, w, h, P, 14 * u, paintedIcon(dg, { ...P, ink: P.iconColor || '#fff', ground: P.iconColor2 || c2 })),
              ls = linesOf(text, P),
              rs = rows(ls.length, 10 * u, P.sub ? h * 0.72 : h - 12 * u, P.ratio);
            ls.forEach((line, i) =>
              K.fxText(dg, line, box.cx, rs[i].cy, {
                font: P.font || 'black',
                weight: '900',
                size: rs[i].cap * 1.1,
                maxW: box.span,
                skew: 0.25,
                fill: P.chrome ? K.chrome : P.ink || '#ffffff',
                outline: [2.4 * u, P.outline || '#2a1a4a'],
                extrude: [3 * u, 4 * u, P.extrude || K.rgba('#1a1030', 0.7)],
              }),
            );
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.84, { font: 'sans', weight: '800', size: h * 0.12, maxW: box.span * 0.9, skew: 0.2, spacing: 0.2, fill: P.subInk || '#fff', outline: [1 * u, P.outline || '#2a1a4a'] });
            K.backlight(dg, gg, w, h, 0.42);
            return spec({ backColor: '#2a2f33', light: K.mix(c1, '#ffffff', 0.3), day: 0.2 });
          },
          /** Athletic block letters: outlined, drop-shadowed, optionally arched; schools, stadium, gym. */
          varsity(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, 'round', 0, 0, w, h);
            K.fillBoard(dg, 'enamel', 0, 0, w, h, P.ground, text);
            dg.strokeStyle = P.outline || '#fff';
            dg.lineWidth = 2 * u;
            dg.strokeRect(7 * u, 7 * u, w - 14 * u, h - 14 * u);
            if (P.stripe) {
              dg.fillStyle = P.stripe;
              dg.fillRect(7 * u, h - 22 * u, w - 14 * u, 6 * u);
            }
            const box = emblems(dg, gg, w, h, P, 16 * u, paintedIcon(dg, { ...P, ink: P.iconColor || P.fill, ground: P.iconColor2 || P.ground })),
              ls = linesOf(text, P),
              rs = rows(ls.length, (P.arc ? 18 : 14) * u, P.sub ? h * 0.7 : h - (P.stripe ? 26 : 14) * u, P.ratio);
            ls.forEach((line, i) => {
              const arched = P.arc && i === 0,
                run = K.strokeText(line, { cx: box.cx, cy: rs[i].cy - (arched && ls.length > 1 ? rs[i].cap * 0.18 : 0), maxW: box.span, maxH: rs[i].cap * 0.9, track: 0.3, slant: P.slant || 0, arc: arched ? P.arc * h : 0 }),
                t = run.size * 0.22;
              K.blockLetters(dg, run.lines, t, { fill: P.fill, outline: [2.2 * u, P.outline || '#fff'], extrude: [2.5 * u, 3.5 * u, P.shadow || '#000'], cap: 'square', inline: P.inline ? [1 * u, P.inline] : null });
            });
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.82, { font: 'black', weight: '900', size: h * 0.12, maxW: box.span * 0.7, spacing: 0.3, fill: P.outline || '#fff' });
            K.backlight(dg, gg, w, h, P.backlit ? 0.45 : 0.24, !P.backlit);
            return spec({ backColor: K.shade(P.ground, 0.4), lamps: !P.backlit, light: P.backlit ? K.mix(P.fill, '#fff', 0.4) : '#ffe2b0' });
          },
          /** Retroreflective road sign: highway green (or tourist brown), white border, condensed letters, arrows. */
          highway(dg, gg, w, h, text, P) {
            const u = h / 100,
              ground = P.ground || '#0b6b3a';
            K.boardPath(dg, 'round', 0, 0, w, h);
            K.fillBoard(dg, 'matte', 0, 0, w, h, ground, text);
            dg.strokeStyle = '#f2f4ef';
            dg.lineWidth = 3 * u;
            dg.beginPath();
            dg.roundRect(6 * u, 6 * u, w - 12 * u, h - 12 * u, 10 * u);
            dg.stroke();
            let x1 = w - 16 * u;
            if (P.arrow) {
              const ax = w - 34 * u,
                ay = h / 2;
              dg.fillStyle = '#f2f4ef';
              dg.save();
              dg.translate(ax, ay);
              dg.rotate(P.arrow === 'up' ? -Math.PI / 2 : P.arrow === 'left' ? Math.PI : 0);
              dg.beginPath();
              dg.moveTo(26 * u, 0);
              dg.lineTo(4 * u, -22 * u);
              dg.lineTo(4 * u, -9 * u);
              dg.lineTo(-24 * u, -9 * u);
              dg.lineTo(-24 * u, 9 * u);
              dg.lineTo(4 * u, 9 * u);
              dg.lineTo(4 * u, 22 * u);
              dg.closePath();
              dg.fill();
              dg.restore();
              x1 = w - 66 * u;
            }
            let x0 = 16 * u;
            if (P.icon) {
              K.icon(dg, P.icon, 44 * u, h / 2, h * 0.56, '#f2f4ef', ground);
              x0 = 80 * u;
            }
            const ls = linesOf(text, P),
              rs = rows(ls.length, 16 * u, h - 16 * u);
            ls.forEach((line, i) =>
              K.fxText(dg, line, (x0 + x1) / 2, rs[i].cy + rs[i].cap * 0.05, { font: 'sans', weight: '700', size: rs[i].cap * 1.05, maxW: x1 - x0, condense: 0.84, spacing: 0.04, fill: '#f2f4ef' }),
            );
            K.backlight(dg, gg, w, h, 0.09);
            return spec({ backColor: '#6d7275', light: '#dfe7e0', day: 0.05 });
          },
          /** LED dot matrix on a black board: arcades and ticket booths. */
          pixel(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, 'rect', 0, 0, w, h);
            K.fillBoard(dg, 'glass', 0, 0, w, h, P.board || '#07070b', text);
            let x0 = 8 * u,
              x1 = w - 8 * u;
            if (P.icon) {
              K.tubeIcon(dg, gg, P.icon, 8 * u + h * 0.34, h / 2, h * 0.56, P.accent || P.ink, 2.4 * u);
              x0 += h * 0.72;
            }
            K.pixelLetters(dg, gg, text, x0, 10 * u, x1 - x0, h - 20 * u, P.ink, Math.round(((x1 - x0) / (h - 20 * u)) * 11));
            K.tubes(dg, gg, [[[3 * u, 3 * u], [w - 3 * u, 3 * u], [w - 3 * u, h - 3 * u], [3 * u, h - 3 * u], [3 * u, 3 * u]]], 1.6 * u, P.accent || P.ink, { electrodes: false });
            return spec({ backColor: '#07070b', light: P.ink });
          },
          /** Tattoo flash: a black board, a ribbon banner with ink lettering, a heart, red neon rim. */
          tattoo(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, 'rect', 0, 0, w, h);
            K.fillBoard(dg, 'glass', 0, 0, w, h, '#0e0c0c', text);
            K.icon(dg, 'heart', 18 * u + h * 0.3, h / 2, h * 0.6, '#c8102e', '#000');
            K.icon(dg, 'stars', w - 18 * u - h * 0.3, h / 2, h * 0.5, '#e8c060', '#000');
            const bx = 16 * u + h * 0.62,
              bw = w - 2 * bx;
            K.boardPath(dg, 'banner', bx - 10 * u, h * 0.22, bw + 20 * u, h * 0.56);
            dg.fillStyle = '#efe3c2';
            dg.fill();
            dg.lineWidth = 2 * u;
            dg.strokeStyle = '#1a1414';
            dg.stroke();
            K.fxText(dg, text.replace(' TATTOO', ''), w / 2, h * 0.5, { font: 'times', weight: '900', size: h * 0.36, maxW: bw * 0.86, spacing: 0.05, fill: '#1a1414', shadow: [1.5 * u, 1.5 * u, '#c8102e', 0] });
            K.fxText(dg, 'TATTOO', w / 2, h * 0.88, { font: 'sans', weight: '800', size: h * 0.1, maxW: bw * 0.5, spacing: 0.6, fill: '#e8c060' });
            K.tubes(dg, gg, [[[4 * u, 4 * u], [w - 4 * u, 4 * u], [w - 4 * u, h - 4 * u], [4 * u, h - 4 * u], [4 * u, 4 * u]]], 2 * u, '#ff2a3a', { electrodes: false });
            K.tubeIcon(dg, gg, 'heart', 18 * u + h * 0.3, h / 2, h * 0.6, '#ff2a3a', 2.2 * u);
            return spec({ backColor: '#0e0c0c', light: '#ff4a5a', flicker: 1 });
          },
          /** A sign painted on the wall or on sheet: slab letters with a drop shade, faded by the sun; floodlit. */
          painted(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, 'rect', 0, 0, w, h);
            K.fillBoard(dg, P.kind || 'matte', 0, 0, w, h, P.ground, text);
            dg.strokeStyle = P.border || P.ink;
            dg.lineWidth = 2.5 * u;
            dg.strokeRect(7 * u, 7 * u, w - 14 * u, h - 14 * u);
            const box = emblems(dg, gg, w, h, P, 16 * u, paintedIcon(dg, { ...P, ink: P.iconColor || P.ink, ground: P.ground })),
              ls = linesOf(text, P),
              rs = rows(ls.length, 14 * u, P.sub ? h * 0.7 : h - 14 * u, P.ratio);
            ls.forEach((line, i) =>
              K.fxText(dg, line, box.cx, rs[i].cy, {
                font: P.font || 'slab',
                weight: '900',
                size: rs[i].cap * 1.12,
                maxW: box.span,
                condense: P.condense || 0.9,
                spacing: P.spacing ?? 0.04,
                fill: P.ink,
                extrude: [2.5 * u, 3 * u, P.shade || K.shade(P.ground, 0.55)],
              }),
            );
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.82, { font: 'sans', weight: '800', size: h * 0.12, maxW: box.span * 0.8, spacing: 0.25, fill: P.ink });
            K.weather(dg, 0, 0, w, h, P.ground, P.age ?? 1, text);
            K.backlight(dg, gg, w, h, 0.24, true);
            return spec({ backColor: K.shade(P.ground, 0.5), lamps: true, light: '#ffe2b0', day: 0.06 });
          },
          /** Hand-lettered plywood: every letter a little off, the way a brush leaves it. */
          hand(dg, gg, w, h, text, P) {
            const u = h / 100,
              rnd = K.seeded(text + 'hand');
            K.boardPath(dg, 'rect', 0, 0, w, h);
            K.fillBoard(dg, 'plywood', 0, 0, w, h, P.ground, text);
            const box = emblems(dg, gg, w, h, P, 14 * u, paintedIcon(dg, { ...P, ink: P.iconColor || P.ink, ground: P.ground })),
              ls = linesOf(text, P),
              rs = rows(ls.length, 12 * u, h - 12 * u, P.ratio);
            ls.forEach((line, i) => {
              const size = rs[i].cap * 1.1;
              dg.font = '900 ' + size + 'px ' + K.FONTS[P.font || 'black'];
              const total = dg.measureText(line).width * 1.05,
                scale = Math.min(1, box.span / total);
              let x = box.cx - (total * scale) / 2;
              for (const ch of line) {
                const cw = dg.measureText(ch).width * 1.05 * scale;
                dg.save();
                dg.translate(x + cw / 2, rs[i].cy + (rnd() - 0.5) * size * 0.08);
                dg.rotate((rnd() - 0.5) * 0.12);
                dg.scale(scale * (0.95 + rnd() * 0.1), 1);
                dg.textAlign = 'center';
                dg.textBaseline = 'middle';
                dg.fillStyle = P.ink;
                dg.fillText(ch, 0, 0);
                dg.restore();
                x += cw;
              }
            });
            K.weather(dg, 0, 0, w, h, P.ground, 0.6, text);
            K.backlight(dg, gg, w, h, 0.22, true);
            return spec({ backColor: K.shade(P.ground, 0.5), lamps: true, light: '#ffe2b0', day: 0.06 });
          },
          /** A picture-house front: the name in bulbs on red, a white changeable-letter strip below, film reels. */
          cinema(dg, gg, w, h, text, P) {
            const u = h / 100,
              [name, sub] = P.lines;
            K.boardPath(dg, 'rect', 0, 0, w, h);
            K.fillBoard(dg, 'enamel', 0, 0, w, h, '#8e0f1f', text);
            dg.fillStyle = '#f7f3e6';
            dg.fillRect(8 * u, h * 0.66, w - 16 * u, h * 0.26);
            dg.strokeStyle = '#d8a948';
            dg.lineWidth = 3 * u;
            dg.strokeRect(3 * u, 3 * u, w - 6 * u, h - 6 * u);
            for (const x of [18 * u + h * 0.26, w - 18 * u - h * 0.26]) K.icon(dg, 'reel', x, h * 0.34, h * 0.48, '#d8a948', '#8e0f1f');
            const run = K.strokeText(name, { cx: w / 2, cy: h * 0.34, maxW: w - 30 * u - h * 1.1, maxH: h * 0.4, track: 0.3 });
            K.bulbLetters(dg, gg, run.lines, run.size, { bodyColor: '#e2b04a', bulb: '#fff2c6', body: 0.22, step: 0.16, r: 0.05 });
            K.fxText(dg, sub, w / 2, h * 0.79, { font: 'sans', weight: '900', size: h * 0.2, maxW: w * 0.8, spacing: 0.5, fill: '#141414' });
            gg.fillStyle = K.rgba('#fff4dc', 0.6);
            gg.fillRect(8 * u, h * 0.66, w - 16 * u, h * 0.26);
            K.fxText(gg, sub, w / 2, h * 0.79, { font: 'sans', weight: '900', size: h * 0.2, maxW: w * 0.8, spacing: 0.5, fill: '#000' });
            return spec({ backColor: '#3a0a10', light: '#ffd48a', marquee: true });
          },
          /** A roadside diner: chrome-ribbed frame, a coloured enamel panel, script tubes and a block pill. */
          diner(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, 'pill', 0, 0, w, h);
            K.fillBoard(dg, 'brushed', 0, 0, w, h, '#c8d0d6', text);
            dg.save();
            K.boardPath(dg, 'pill', 0, 0, w, h);
            dg.clip();
            dg.strokeStyle = 'rgba(40,50,60,0.35)';
            dg.lineWidth = 1.2 * u;
            for (let y = 3 * u; y < h; y += 4 * u) {
              dg.beginPath();
              dg.moveTo(0, y);
              dg.lineTo(w, y);
              dg.stroke();
            }
            dg.restore();
            K.boardPath(dg, 'pill', 9 * u, 9 * u, w - 18 * u, h - 18 * u);
            K.fillBoard(dg, 'enamel', 0, 0, w, h, P.panel, text);
            const s = h * 0.5;
            K.icon(dg, P.icon || 'cup', 26 * u + s / 2, h / 2, s, '#f4efe2', P.panel);
            K.tubeIcon(dg, gg, P.icon || 'cup', 26 * u + s / 2, h / 2, s, P.blockTube || '#fff4dc', 2 * u);
            const x0 = 36 * u + s,
              x1 = w - 30 * u,
              sr = K.strokeText(P.script, { lower: true, slant: 0.24, cx: (x0 + x1) / 2, cy: h * 0.4, maxW: x1 - x0, maxH: h * 0.46 }),
              t = Math.max(2, sr.size * 0.11);
            dg.strokeStyle = K.shade(P.panel, 0.45);
            dg.lineWidth = t * 2.4;
            dg.lineCap = dg.lineJoin = 'round';
            K.tracePath(dg, sr.lines);
            dg.stroke();
            K.tubes(dg, gg, sr.lines, t, P.tube);
            const pw = (x1 - x0) * 0.46,
              px = (x0 + x1) / 2 - pw / 2;
            dg.fillStyle = '#f4efe2';
            dg.beginPath();
            dg.roundRect(px, h * 0.68, pw, h * 0.2, h * 0.1);
            dg.fill();
            K.fxText(dg, P.block, (x0 + x1) / 2, h * 0.785, { font: 'black', weight: '900', size: h * 0.15, maxW: pw * 0.8, spacing: 0.4, fill: P.panel });
            gg.fillStyle = K.rgba('#fff4dc', 0.55);
            gg.beginPath();
            gg.roundRect(px, h * 0.68, pw, h * 0.2, h * 0.1);
            gg.fill();
            K.fxText(gg, P.block, (x0 + x1) / 2, h * 0.785, { font: 'black', weight: '900', size: h * 0.15, maxW: pw * 0.8, spacing: 0.4, fill: '#000' });
            return spec({ cutout: true, backing: 'inset', backColor: '#5a6168', light: P.tube, night: NEON_NIGHT });
          },
          /** A Moorish onion arch: gold filigree rim, a crescent and stars in neon. */
          arabian(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, 'onion', 2 * u, 2 * u, w - 4 * u, h - 4 * u);
            K.fillBoard(dg, 'enamel', 0, 0, w, h, P.board, text);
            K.boardPath(dg, 'onion', 2 * u, 2 * u, w - 4 * u, h - 4 * u);
            dg.lineWidth = 4 * u;
            dg.strokeStyle = '#e2b04a';
            dg.stroke();
            dg.setLineDash([3 * u, 3 * u]);
            K.boardPath(dg, 'onion', 8 * u, 8 * u, w - 16 * u, h - 16 * u);
            dg.lineWidth = 1.5 * u;
            dg.stroke();
            dg.setLineDash([]);
            K.tubeIcon(dg, gg, 'moon', w / 2, h * 0.2, h * 0.24, P.glow, 2 * u);
            for (const side of [-1, 1]) K.tubeIcon(dg, gg, 'star', w / 2 + side * w * 0.36, h * 0.6, h * 0.24, P.glow, 1.8 * u);
            K.fxText(dg, text, w / 2, h * 0.64, { font: 'palatino', weight: '700', size: h * 0.36, maxW: w * 0.6, spacing: 0.12, fill: K.gold, shadow: [1.5 * u, 2 * u, 'rgba(0,0,0,0.6)', 0] });
            K.backlight(dg, gg, w, h, 0.3, true);
            return spec({ cutout: true, backing: 'inset', backColor: K.shade(P.board, 0.4), light: P.glow, lamps: true });
          },
