        const FULL = Math.PI * 2,
          RAD = Math.PI / 180;
        // ---- Colour -----------------------------------------------------------------
        function rgbOf(c) {
          let s = c.replace('#', '');
          if (s.length === 3) s = s.replace(/./g, (x) => x + x);
          const n = parseInt(s.slice(0, 6), 16);
          return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }
        function mix(a, b, t) {
          const A = rgbOf(a),
            B = rgbOf(b);
          return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
        }
        const shade = (c, t) => mix(c, '#000000', t),
          tint = (c, t) => mix(c, '#ffffff', t),
          rgba = (c, a) => 'rgba(' + rgbOf(c).join(',') + ',' + a + ')';
        // A small deterministic random stream, so a sign paints the same every load.
        function seeded(text) {
          let h = 2166136261;
          for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
          return () => {
            h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
            return (h >>> 8) / 16777216;
          };
        }
        // ---- Stroke font --------------------------------------------------------------
        // Glyph: [advance, strokes]; a stroke lists points [x, y] and arcs
        // arc(cx, cy, rx, ry, fromDegrees, toDegrees) (y up, anticlockwise positive).
        const arc = (cx, cy, rx, ry, a, b) => ({ arc: [cx, cy, rx, ry, a, b] }),
          ring = (cx, cy, rx, ry) => arc(cx, cy, rx, ry, 0, 360),
          dot = (x, y) => [
            [x, y],
            [x + 0.012, y],
          ];
        const GLYPHS = {
          A: [0.78, [[[0, 0], [0.39, 1], [0.78, 0]], [[0.15, 0.33], [0.63, 0.33]]]],
          B: [0.66, [[[0, 0.52], [0.4, 0.52], arc(0.4, 0.76, 0.22, 0.24, -90, 90), [0, 1], [0, 0], [0.42, 0], arc(0.42, 0.26, 0.24, 0.26, -90, 90), [0.4, 0.52]]]],
          C: [0.8, [[arc(0.47, 0.5, 0.47, 0.5, 42, 318)]]],
          D: [0.74, [[[0, 0], [0, 1], [0.28, 1], arc(0.28, 0.5, 0.46, 0.5, 90, -90), [0, 0]]]],
          E: [0.58, [[[0.58, 1], [0, 1], [0, 0], [0.58, 0]], [[0, 0.52], [0.46, 0.52]]]],
          F: [0.56, [[[0.56, 1], [0, 1], [0, 0]], [[0, 0.52], [0.44, 0.52]]]],
          G: [0.88, [[arc(0.46, 0.5, 0.46, 0.5, 40, 360), [0.52, 0.5]]]],
          H: [0.7, [[[0, 0], [0, 1]], [[0.7, 0], [0.7, 1]], [[0, 0.52], [0.7, 0.52]]]],
          I: [0, [[[0, 0], [0, 1]]]],
          J: [0.5, [[[0.5, 1], [0.5, 0.26], arc(0.25, 0.26, 0.25, 0.26, 0, -180)]]],
          K: [0.64, [[[0, 0], [0, 1]], [[0.62, 1], [0, 0.38]], [[0.2, 0.58], [0.66, 0]]]],
          L: [0.54, [[[0, 1], [0, 0], [0.54, 0]]]],
          M: [0.86, [[[0, 0], [0, 1], [0.43, 0.28], [0.86, 1], [0.86, 0]]]],
          N: [0.72, [[[0, 0], [0, 1], [0.72, 0], [0.72, 1]]]],
          O: [0.98, [[ring(0.49, 0.5, 0.49, 0.5)]]],
          P: [0.64, [[[0, 0], [0, 1], [0.38, 1], arc(0.38, 0.74, 0.26, 0.26, 90, -90), [0, 0.48]]]],
          Q: [0.98, [[ring(0.49, 0.5, 0.49, 0.5)], [[0.6, 0.24], [0.98, -0.06]]]],
          R: [0.66, [[[0, 0], [0, 1], [0.38, 1], arc(0.38, 0.74, 0.26, 0.26, 90, -90), [0, 0.48]], [[0.32, 0.48], [0.66, 0]]]],
          S: [0.64, [[arc(0.32, 0.75, 0.3, 0.25, 25, 270), arc(0.32, 0.25, 0.32, 0.25, 90, -155)]]],
          T: [0.7, [[[0, 1], [0.7, 1]], [[0.35, 1], [0.35, 0]]]],
          U: [0.7, [[[0, 1], [0, 0.32], arc(0.35, 0.32, 0.35, 0.32, 180, 360), [0.7, 1]]]],
          V: [0.76, [[[0, 1], [0.38, 0], [0.76, 1]]]],
          W: [1.04, [[[0, 1], [0.26, 0], [0.52, 0.72], [0.78, 0], [1.04, 1]]]],
          X: [0.7, [[[0, 0], [0.7, 1]], [[0, 1], [0.7, 0]]]],
          Y: [0.74, [[[0, 1], [0.37, 0.48], [0.74, 1]], [[0.37, 0.48], [0.37, 0]]]],
          Z: [0.68, [[[0, 1], [0.68, 1], [0, 0], [0.68, 0]]]],
          0: [0.62, [[ring(0.31, 0.5, 0.31, 0.5)]]],
          1: [0.34, [[[0.02, 0.78], [0.3, 1], [0.3, 0]]]],
          2: [0.62, [[arc(0.31, 0.7, 0.29, 0.3, 160, -35), [0, 0], [0.62, 0]]]],
          3: [0.62, [[arc(0.3, 0.76, 0.27, 0.24, 150, -90), arc(0.3, 0.26, 0.31, 0.26, 90, -150)]]],
          4: [0.68, [[[0.52, 0], [0.52, 1], [0, 0.3], [0.68, 0.3]]]],
          5: [0.62, [[[0.58, 1], [0.1, 1], [0.06, 0.56], arc(0.3, 0.33, 0.31, 0.33, 138, -150)]]],
          6: [0.62, [[[0.52, 1], [0.07, 0.42]], [ring(0.31, 0.31, 0.29, 0.31)]]],
          7: [0.62, [[[0, 1], [0.62, 1], [0.18, 0]]]],
          8: [0.62, [[ring(0.31, 0.76, 0.25, 0.24)], [ring(0.31, 0.26, 0.3, 0.26)]]],
          9: [0.62, [[ring(0.31, 0.69, 0.29, 0.31)], [[0.6, 0.62], [0.18, 0]]]],
          '&': [0.74, [[[0.74, 0], [0.16, 0.6], arc(0.31, 0.8, 0.16, 0.2, 225, -45), [0.08, 0.3], arc(0.3, 0.24, 0.23, 0.24, 165, 330), [0.7, 0.38]]]],
          "'": [0.06, [[[0.06, 1], [0, 0.76]]]],
          '-': [0.36, [[[0, 0.46], [0.36, 0.46]]]],
          '/': [0.46, [[[0, -0.02], [0.46, 1.02]]]],
          '.': [0.02, [dot(0, 0.02)]],
          ',': [0.06, [[[0.06, 0.06], [0, -0.14]]]],
          '!': [0.02, [[[0, 1], [0, 0.3]], dot(0, 0.02)]],
          ':': [0.02, [dot(0, 0.6), dot(0, 0.04)]],
          '·': [0.04, [dot(0, 0.5)]],
          '×': [0.4, [[[0, 0.2], [0.4, 0.6]], [[0, 0.6], [0.4, 0.2]]]],
          '+': [0.5, [[[0, 0.45], [0.5, 0.45]], [[0.25, 0.2], [0.25, 0.7]]]],
          '$': [0.62, [[arc(0.31, 0.72, 0.29, 0.2, 25, 270), arc(0.31, 0.28, 0.31, 0.24, 90, -155)], [[0.31, 1.08], [0.31, -0.08]]]],
          '%': [0.7, [[ring(0.14, 0.8, 0.14, 0.18)], [[0.64, 1], [0.06, 0]], [ring(0.56, 0.2, 0.14, 0.18)]]],
          a: [0.58, [[ring(0.29, 0.3, 0.29, 0.3)], [[0.58, 0.6], [0.58, 0]]]],
          b: [0.58, [[[0, 1], [0, 0]], [ring(0.29, 0.3, 0.29, 0.3)]]],
          c: [0.54, [[arc(0.3, 0.3, 0.3, 0.3, 45, 315)]]],
          d: [0.58, [[ring(0.29, 0.3, 0.29, 0.3)], [[0.58, 1], [0.58, 0]]]],
          e: [0.6, [[[0.02, 0.3], [0.6, 0.3], arc(0.3, 0.3, 0.3, 0.3, 0, 320)]]],
          f: [0.42, [[arc(0.36, 0.84, 0.16, 0.16, 20, 180), [0.2, 0]], [[0.02, 0.6], [0.4, 0.6]]]],
          g: [0.58, [[ring(0.29, 0.3, 0.29, 0.3)], [[0.58, 0.6], [0.58, -0.06], arc(0.3, -0.06, 0.28, 0.24, 0, -165)]]],
          h: [0.54, [[[0, 1], [0, 0]], [[0, 0.34], arc(0.27, 0.34, 0.27, 0.26, 180, 0), [0.54, 0]]]],
          i: [0.02, [[[0, 0.6], [0, 0]], dot(0, 0.84)]],
          j: [0.18, [[[0.18, 0.6], [0.18, -0.08], arc(0.02, -0.08, 0.16, 0.22, 0, -150)], dot(0.18, 0.84)]],
          k: [0.5, [[[0, 1], [0, 0]], [[0.46, 0.6], [0, 0.24]], [[0.14, 0.34], [0.5, 0]]]],
          l: [0.02, [[[0, 1], [0, 0]]]],
          m: [0.84, [[[0, 0], [0, 0.6]], [[0, 0.36], arc(0.21, 0.36, 0.21, 0.24, 180, 0), [0.42, 0]], [[0.42, 0.36], arc(0.63, 0.36, 0.21, 0.24, 180, 0), [0.84, 0]]]],
          n: [0.54, [[[0, 0], [0, 0.6]], [[0, 0.34], arc(0.27, 0.34, 0.27, 0.26, 180, 0), [0.54, 0]]]],
          o: [0.6, [[ring(0.3, 0.3, 0.3, 0.3)]]],
          p: [0.58, [[[0, 0.6], [0, -0.32]], [ring(0.29, 0.3, 0.29, 0.3)]]],
          q: [0.58, [[ring(0.29, 0.3, 0.29, 0.3)], [[0.58, 0.6], [0.58, -0.32]]]],
          r: [0.4, [[[0, 0], [0, 0.6]], [[0, 0.32], arc(0.26, 0.34, 0.26, 0.26, 180, 60)]]],
          s: [0.48, [[arc(0.24, 0.45, 0.22, 0.15, 15, 270), arc(0.24, 0.15, 0.24, 0.15, 90, -165)]]],
          t: [0.4, [[[0.14, 0.92], [0.14, 0.14], arc(0.32, 0.14, 0.18, 0.14, 180, 300)], [[0, 0.6], [0.36, 0.6]]]],
          u: [0.54, [[[0, 0.6], [0, 0.26], arc(0.27, 0.26, 0.27, 0.26, 180, 360), [0.54, 0.6]], [[0.54, 0.6], [0.54, 0]]]],
          v: [0.56, [[[0, 0.6], [0.28, 0], [0.56, 0.6]]]],
          w: [0.84, [[[0, 0.6], [0.21, 0], [0.42, 0.46], [0.63, 0], [0.84, 0.6]]]],
          x: [0.52, [[[0, 0], [0.52, 0.6]], [[0, 0.6], [0.52, 0]]]],
          y: [0.56, [[[0, 0.6], [0.28, 0.02]], [[0.56, 0.6], [0.18, -0.32]]]],
          z: [0.52, [[[0, 0.6], [0.52, 0.6], [0, 0], [0.52, 0]]]],
        };
        const glyphCache = new Map();
        function glyph(ch) {
          if (glyphCache.has(ch)) return glyphCache.get(ch);
          const def = GLYPHS[ch] || GLYPHS[ch.toUpperCase()];
          let g = null;
          if (def) {
            const strokes = def[1].map((stroke) => {
              const pts = [];
              for (const p of stroke) {
                if (!p.arc) {
                  pts.push(p);
                  continue;
                }
                const [cx, cy, rx, ry, a, b] = p.arc,
                  n = Math.max(4, Math.ceil(Math.abs(b - a) / 10));
                for (let i = 0; i <= n; i++) {
                  const d = (a + ((b - a) * i) / n) * RAD;
                  pts.push([cx + rx * Math.cos(d), cy + ry * Math.sin(d)]);
                }
              }
              return pts;
            });
            g = { w: def[0], strokes };
          }
          glyphCache.set(ch, g);
          return g;
        }
        // Lays a string out in em units: its strokes (tagged with the glyph index and
        // centre, for bouncing) and its width.
        function strokeRun(text, lower = false, track = null) {
          let t = text
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[’‘]/g, "'");
          if (!lower) t = t.toUpperCase();
          const tracking = track ?? (lower ? 0.12 : 0.2),
            lines = [];
          let x = 0,
            index = 0;
          for (const ch of t) {
            if (ch === ' ') {
              x += lower ? 0.32 : 0.44;
              continue;
            }
            const g = glyph(ch);
            if (!g) {
              x += 0.4;
              continue;
            }
            for (const s of g.strokes) {
              const l = s.map(([px, py]) => [px + x, py]);
              l.glyph = index;
              l.centre = x + g.w / 2;
              lines.push(l);
            }
            x += g.w + tracking;
            index++;
          }
          return { lines, width: Math.max(0.01, x - tracking) };
        }
        /**
         * Fits a string into a box and returns its strokes in canvas pixels.
         * o: cx, cy (centre of the cap height), maxW, maxH (cap height px), lower,
         * slant (italic lean, 0.2 = script), track, align ('center' | 'left' |
         * 'right' at cx), bounce (em, fairground letters), arc (radius in px:
         * letters set on a curve, positive arches up).
         */
        function strokeText(text, o) {
          const run = strokeRun(text, o.lower, o.track),
            slant = o.slant || 0,
            widthEm = run.width + slant * (o.lower ? 1 : 1),
            size = Math.min(o.maxH, o.maxW / widthEm),
            base = o.cy + size * (o.lower ? 0.36 : 0.5),
            total = widthEm * size,
            x0 = o.align === 'left' ? o.cx : o.align === 'right' ? o.cx - total : o.cx - total / 2,
            lines = run.lines.map((l) => {
              const bob = o.bounce ? Math.sin(l.glyph * 2.1 + 0.6) * o.bounce : 0,
                tilt = o.bounce ? Math.sin(l.glyph * 1.3 + 1.1) * 0.12 : 0,
                c = l.centre;
              const out = l.map(([ex, ey]) => {
                let x = ex,
                  y = ey + bob;
                if (tilt) {
                  const dx = x - c,
                    dy = y - 0.5;
                  x = c + dx * Math.cos(tilt) - dy * Math.sin(tilt);
                  y = 0.5 + dx * Math.sin(tilt) + dy * Math.cos(tilt);
                }
                let px = x0 + (x + slant * y) * size,
                  py = base - y * size;
                if (o.arc) {
                  const R = o.arc,
                    theta = (px - o.cx) / R,
                    rr = R + (base - py);
                  px = o.cx + rr * Math.sin(theta);
                  py = base + R - rr * Math.cos(theta);
                }
                return [px, py];
              });
              return out;
            });
          return { lines, size, width: total, left: x0, base };
        }
        function tracePath(g, lines) {
          g.beginPath();
          for (const l of lines) {
            g.moveTo(l[0][0], l[0][1]);
            for (let i = 1; i < l.length; i++) g.lineTo(l[i][0], l[i][1]);
          }
        }
        // Breaks every stroke once or twice, as the bridges of a cut stencil do.
        function stencilCut(lines, gap) {
          const out = [];
          for (const l of lines) {
            let total = 0;
            const acc = [0];
            for (let i = 1; i < l.length; i++) acc.push((total += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1])));
            if (total < gap * 3.5) {
              out.push(l);
              continue;
            }
            const cuts = total > gap * 14 ? [0.3, 0.72] : [0.5];
            let from = 0;
            const at = (d) => {
              let i = 1;
              while (i < acc.length - 1 && acc[i] < d) i++;
              const t = (d - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
              return { i, p: [l[i - 1][0] + (l[i][0] - l[i - 1][0]) * t, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * t] };
            };
            for (const c of [...cuts, null]) {
              const d0 = from,
                d1 = c === null ? total : c * total - gap / 2,
                a = at(d0),
                b = at(d1),
                piece = [a.p];
              for (let i = a.i; i < b.i; i++) piece.push(l[i]);
              piece.push(b.p);
              out.push(piece);
              if (c !== null) from = c * total + gap / 2;
            }
          }
          return out;
        }
        // Points every `step` px along the strokes (bulbs, LEDs).
        function resample(lines, step) {
          const pts = [];
          for (const l of lines) {
            let carry = 0;
            pts.push(l[0]);
            for (let i = 1; i < l.length; i++) {
              const [x0, y0] = l[i - 1],
                [x1, y1] = l[i],
                len = Math.hypot(x1 - x0, y1 - y0);
              let d = step - carry;
              while (d <= len) {
                pts.push([x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len]);
                d += step;
              }
              carry = len - (d - step);
            }
          }
          return pts;
        }
        // ---- Letter treatments ------------------------------------------------------------
        /**
         * Neon tubes along `lines`: by day a tinted glass tube (with its shadow on the
         * board and the dark electrode caps where it goes through the board); in the
         * glow mask a coloured spill and a near-white core. `o.day === false` skips
         * the day face (the tube is drawn elsewhere), `o.bare` leaves out the shadow.
         */
        function tubes(dg, gg, lines, t, color, o = {}) {
          for (const g of [dg, gg]) {
            g.lineJoin = 'round';
            g.lineCap = 'round';
          }
          if (o.day !== false) {
            if (!o.bare) {
              dg.save();
              dg.translate(t * 0.5, t * 0.8);
              dg.strokeStyle = 'rgba(0,0,0,0.42)';
              dg.lineWidth = t * 1.25;
              tracePath(dg, lines);
              dg.stroke();
              dg.restore();
            }
            dg.strokeStyle = o.glass || mix(color, '#ffffff', 0.32);
            dg.lineWidth = t;
            tracePath(dg, lines);
            dg.stroke();
            dg.save();
            dg.translate(-t * 0.14, -t * 0.2);
            dg.strokeStyle = 'rgba(255,255,255,0.6)';
            dg.lineWidth = t * 0.28;
            tracePath(dg, lines);
            dg.stroke();
            dg.restore();
            if (o.electrodes !== false) {
              dg.fillStyle = 'rgba(20,20,22,0.85)';
              for (const l of lines) {
                if (l.length < 3 && Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]) < t) continue;
                for (const p of [l[0], l[l.length - 1]]) {
                  dg.beginPath();
                  dg.arc(p[0], p[1], t * 0.52, 0, FULL);
                  dg.fill();
                }
              }
            }
          }
          const k = o.strength ?? 1;
          gg.save();
          gg.shadowColor = color;
          gg.shadowBlur = t * 3.2;
          gg.strokeStyle = rgba(color, 0.45 * k);
          gg.lineWidth = t * 2.3;
          tracePath(gg, lines);
          gg.stroke();
          gg.restore();
          // Kept below white: at the sign's HDR night strength a white core blooms
          // the letters into a blur, a tinted one still reads as the tube's colour.
          gg.strokeStyle = rgba(shade(color, 0.12), 0.85 * k);
          gg.lineWidth = t;
          tracePath(gg, lines);
          gg.stroke();
          gg.strokeStyle = rgba(mix(color, '#ffffff', 0.4), 0.9 * k);
          gg.lineWidth = t * 0.42;
          tracePath(gg, lines);
          gg.stroke();
        }
        // Double-line tubes: the classic outlined neon letter (two tubes per stroke).
        function doubleTubes(dg, gg, lines, t, color, board) {
          const wide = t * 3.1;
          tubes(dg, gg, lines, wide, color, { electrodes: false });
          for (const [g, fill] of [
            [dg, board],
            [gg, '#000000'],
          ]) {
            g.strokeStyle = fill;
            g.lineWidth = wide - t * 1.5;
            tracePath(g, lines);
            g.stroke();
          }
          gg.strokeStyle = rgba(mix(color, '#ffffff', 0.5), 0.35);
          gg.lineWidth = wide - t * 1.5;
          tracePath(gg, lines);
          gg.stroke();
          gg.strokeStyle = '#000';
          gg.lineWidth = wide - t * 2.3;
          tracePath(gg, lines);
          gg.stroke();
        }
        // Marquee bulbs along the strokes on a painted letter channel.
        function bulbLetters(dg, gg, lines, size, o) {
          const body = size * (o.body ?? 0.2);
          for (const g of [dg, gg]) {
            g.lineJoin = 'round';
            g.lineCap = 'round';
          }
          if (o.bodyColor) {
            dg.strokeStyle = shade(o.bodyColor, 0.55);
            dg.lineWidth = body + size * 0.06;
            dg.save();
            dg.translate(size * 0.03, size * 0.05);
            tracePath(dg, lines);
            dg.stroke();
            dg.restore();
            dg.strokeStyle = o.bodyColor;
            dg.lineWidth = body;
            tracePath(dg, lines);
            dg.stroke();
            dg.strokeStyle = tint(o.bodyColor, 0.35);
            dg.lineWidth = body * 0.18;
            dg.save();
            dg.translate(-body * 0.18, -body * 0.22);
            tracePath(dg, lines);
            dg.stroke();
            dg.restore();
            gg.strokeStyle = rgba(o.bodyColor, 0.22);
            gg.lineWidth = body;
            tracePath(gg, lines);
            gg.stroke();
          }
          bulbDots(dg, gg, resample(lines, size * (o.step ?? 0.14)), size * (o.r ?? 0.042), o.bulb || '#ffe9b0');
        }
        function bulbDots(dg, gg, pts, r, color) {
          for (const [x, y] of pts) {
            dg.fillStyle = 'rgba(25,20,15,0.8)';
            dg.beginPath();
            dg.arc(x, y, r * 1.3, 0, FULL);
            dg.fill();
            const lamp = dg.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
            lamp.addColorStop(0, '#ffffff');
            lamp.addColorStop(0.5, tint(color, 0.3));
            lamp.addColorStop(1, shade(color, 0.25));
            dg.fillStyle = lamp;
            dg.beginPath();
            dg.arc(x, y, r, 0, FULL);
            dg.fill();
            const halo = gg.createRadialGradient(x, y, 0, x, y, r * 2.8);
            halo.addColorStop(0, '#ffffff');
            halo.addColorStop(0.3, rgba(color, 0.9));
            halo.addColorStop(1, rgba(color, 0));
            gg.fillStyle = halo;
            gg.beginPath();
            gg.arc(x, y, r * 2.8, 0, FULL);
            gg.fill();
          }
        }
        /**
         * Fat square-ended letters from the strokes. o: fill, t (stroke width),
         * outline [width, colour], extrude [dx, dy, colour], inline [width, colour],
         * cap ('square' | 'round' | 'butt'), gradient (a function (g) returning a fill).
         */
        function blockLetters(g, lines, t, o) {
          g.lineJoin = o.cap === 'round' ? 'round' : 'miter';
          g.miterLimit = 3;
          g.lineCap = o.cap || 'square';
          if (o.extrude) {
            const [dx, dy, color] = o.extrude,
              steps = Math.max(2, Math.ceil(Math.hypot(dx, dy) / 1.5));
            g.strokeStyle = color;
            g.lineWidth = t + (o.outline ? o.outline[0] * 2 : 0);
            for (let k = steps; k >= 1; k--) {
              g.save();
              g.translate((dx * k) / steps, (dy * k) / steps);
              tracePath(g, lines);
              g.stroke();
              g.restore();
            }
          }
          if (o.outline) {
            g.strokeStyle = o.outline[1];
            g.lineWidth = t + o.outline[0] * 2;
            tracePath(g, lines);
            g.stroke();
          }
          g.strokeStyle = o.gradient ? o.gradient(g) : o.fill;
          g.lineWidth = t;
          tracePath(g, lines);
          g.stroke();
          if (o.inline) {
            g.strokeStyle = o.inline[1];
            g.lineWidth = o.inline[0];
            g.lineCap = 'round';
            tracePath(g, lines);
            g.stroke();
          }
        }
        // Art Deco / Didone contrast: vertical strokes thick, horizontals hairline.
        function decoLetters(g, lines, thin, thick, fill) {
          g.strokeStyle = fill;
          g.lineCap = 'round';
          for (const l of lines)
            for (let i = 1; i < l.length; i++) {
              const dx = l[i][0] - l[i - 1][0],
                dy = l[i][1] - l[i - 1][1],
                len = Math.hypot(dx, dy) || 1,
                v = Math.pow(Math.abs(dy) / len, 1.6);
              g.lineWidth = thin + (thick - thin) * v;
              g.beginPath();
              g.moveTo(l[i - 1][0], l[i - 1][1]);
              g.lineTo(l[i][0], l[i][1]);
              g.stroke();
            }
        }
        // LED dot matrix: the letters rasterised onto a grid of square lamps.
        function pixelLetters(dg, gg, text, x, y, w, h, color, cols) {
          const cell = w / cols,
            rows = Math.max(5, Math.round(h / cell)),
            c = document.createElement('canvas');
          c.width = cols;
          c.height = rows;
          const g = c.getContext('2d');
          const run = strokeText(text, { cx: cols / 2, cy: rows / 2, maxW: cols - 2, maxH: rows - 2 });
          g.strokeStyle = '#fff';
          g.lineWidth = Math.max(1, run.size * 0.2);
          g.lineCap = g.lineJoin = 'square';
          tracePath(g, run.lines);
          g.stroke();
          const data = g.getImageData(0, 0, cols, rows).data,
            y0 = y + (h - rows * cell) / 2;
          for (let j = 0; j < rows; j++)
            for (let i = 0; i < cols; i++) {
              const on = data[(j * cols + i) * 4 + 3] > 90,
                px = x + i * cell,
                py = y0 + j * cell;
              dg.fillStyle = on ? tint(color, 0.25) : 'rgba(255,255,255,0.05)';
              dg.fillRect(px + cell * 0.12, py + cell * 0.12, cell * 0.76, cell * 0.76);
              if (on) {
                gg.fillStyle = color;
                gg.fillRect(px, py, cell, cell);
                gg.fillStyle = tint(color, 0.6);
                gg.fillRect(px + cell * 0.2, py + cell * 0.2, cell * 0.6, cell * 0.6);
              }
            }
        }
