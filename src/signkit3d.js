      // BEGIN SUBSYSTEM: src/signkit3d.js — Sign lettering kit: stroke font, letter treatments, boards, emblems
      /**
       * Sign lettering kit
       * Source: src/signkit3d.js
       * Scope: createCityRenderer() closure (included by render3d.js before `sign()`;
       * signdesigns3d.js builds every business's sign from these parts).
       *
       * The game cannot count on web fonts (it runs offline) and a machine may have
       * nothing but a plain sans and serif, so the lettering that gives a sign its
       * character is drawn by hand here:
       *
       * STROKE FONT
       * A monoline alphabet (capitals, lower case, digits and the punctuation the
       * city's names use) defined as centre lines: polylines and elliptic arcs in
       * em units (baseline 0, cap height 1, x-height 0.6). Drawing the same centre
       * lines in different ways gives very different letters:
       *   tubes      bent glass neon (the tube on the board by day, its core and
       *              spill in the glow mask); slanted lower case reads as script
       *   bulbs      marquee bulbs stepped along each stroke on a painted letter
       *   block      a fat square-ended stroke with outline, inline and extrusion
       *              (athletic, slab and 3D shop letters); `stencil` breaks every
       *              stroke the way a cut stencil bridges it
       *   deco       thick verticals and hairline horizontals (Art Deco / Didone)
       *   pixels     the letters rasterised onto an LED dot matrix
       * Letters can be set on an arc and bounced letter by letter (fairground).
       *
       * CANVAS FONTS
       * `fxText` sets system fonts from long fallback stacks (Georgia, Impact,
       * Arial Black, Courier, Palatino, Futura...) and adds what a sign painter
       * would: condensing, italic skew, letter spacing, gradient fills (gold leaf,
       * chrome), outlines, drop shadows and extrusion. Even with only the plain
       * fallback fonts the treatments keep the styles apart.
       *
       * BOARDS AND EMBLEMS
       * `boardPath` shapes (rectangle, pill, oval, arch, stepped Deco crown,
       * scalloped fairground edge, ribbon banner, onion arch), `fillBoard`
       * materials (gloss enamel, weathered planks, corrugated or brushed metal,
       * black glass, plywood) and `icon` emblems drawn with paths (wrench, martini,
       * coffee cup, anchor, medical cross, dice, film reel, crown, palm, car,
       * crossed pistols, target, badge, crest...). Icons draw filled (painted) or
       * as neon tubes.
       *
       * Every painter works in a w x h box (4:1 for boards) and scales with h, so
       * the same design paints a 1024 x 256 landmark board or a 384 x 96 atlas cell.
       */
      const SignKit = (() => {
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
        // ---- Canvas fonts ---------------------------------------------------------------
        const FONTS = {
          sans: 'Helvetica, Arial, "Liberation Sans", "DejaVu Sans", sans-serif',
          black: '"Arial Black", "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
          impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", "Liberation Sans Narrow", "Liberation Sans", sans-serif',
          serif: 'Georgia, "Times New Roman", Times, "Liberation Serif", "DejaVu Serif", serif',
          times: '"Times New Roman", Times, "Liberation Serif", serif',
          palatino: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, "Liberation Serif", serif',
          slab: 'Rockwell, "Roboto Slab", "Courier New", Courier, "Liberation Mono", monospace',
          mono: '"Courier New", Courier, "Liberation Mono", monospace',
          trebuchet: '"Trebuchet MS", Verdana, "DejaVu Sans", sans-serif',
          verdana: 'Verdana, "DejaVu Sans", sans-serif',
          futura: 'Futura, "Century Gothic", "Avenir Next", "Trebuchet MS", "DejaVu Sans", sans-serif',
          copper: 'Copperplate, "Copperplate Gothic Bold", "Palatino Linotype", Georgia, "Liberation Serif", serif',
        };
        /**
         * Sets a line of text with a sign painter's effects. o: font (FONTS key),
         * weight, size (px), maxW, condense (horizontal scale), skew (italic lean),
         * spacing (em), align, fill (colour or function (g, px) => gradient),
         * outline [width, colour], shadow [dx, dy, colour, blur], extrude [dx, dy,
         * colour], hilite (a lighter top edge). Returns the size used.
         */
        function fxText(g, text, x, y, o) {
          const family = FONTS[o.font || 'sans'] || o.font,
            weight = o.weight || '700',
            condense = o.condense || 1,
            spacing = o.spacing || 0;
          let px = o.size;
          const setFont = () => {
            g.font = weight + ' ' + px + 'px ' + family;
            g.letterSpacing = (spacing * px).toFixed(1) + 'px';
          };
          setFont();
          const measured = g.measureText(text).width * condense;
          if (o.maxW && measured > o.maxW) {
            px = Math.max(6, Math.floor((px * o.maxW) / measured));
            setFont();
          }
          g.save();
          g.textAlign = o.align || 'center';
          g.textBaseline = 'middle';
          g.lineJoin = 'round';
          g.translate(x, y);
          g.transform(condense, 0, -(o.skew || 0), 1, 0, 0);
          if (o.extrude) {
            const [dx, dy, color] = o.extrude,
              steps = Math.max(2, Math.ceil(Math.hypot(dx, dy)));
            g.fillStyle = color;
            if (o.outline) {
              g.strokeStyle = color;
              g.lineWidth = o.outline[0] * 2;
            }
            for (let k = steps; k >= 1; k--) {
              if (o.outline) g.strokeText(text, (dx * k) / steps, (dy * k) / steps);
              g.fillText(text, (dx * k) / steps, (dy * k) / steps);
            }
          }
          if (o.shadow) {
            const [dx, dy, color, blur] = o.shadow;
            g.save();
            g.shadowColor = color;
            g.shadowBlur = blur || 0;
            g.shadowOffsetX = dx;
            g.shadowOffsetY = dy;
            g.fillStyle = color;
            g.fillText(text, 0, 0);
            g.restore();
          }
          if (o.outline) {
            g.strokeStyle = o.outline[1];
            g.lineWidth = o.outline[0] * 2;
            g.strokeText(text, 0, 0);
          }
          if (o.hilite) {
            g.fillStyle = o.hilite;
            g.fillText(text, -px * 0.02, -px * 0.03);
          }
          g.fillStyle = typeof o.fill === 'function' ? o.fill(g, px) : o.fill || '#fff';
          g.fillText(text, 0, 0);
          g.restore();
          g.letterSpacing = '0px';
          return px;
        }
        // Fill makers for fxText / blockLetters: gold leaf, chrome, a two-stop fade.
        const gold = (g, px) => {
            const f = g.createLinearGradient(0, -px / 2, 0, px / 2);
            f.addColorStop(0, '#fff3b8');
            f.addColorStop(0.45, '#e3b252');
            f.addColorStop(0.55, '#b07a22');
            f.addColorStop(1, '#f2cf72');
            return f;
          },
          chrome = (g, px) => {
            const f = g.createLinearGradient(0, -px / 2, 0, px / 2);
            f.addColorStop(0, '#ffffff');
            f.addColorStop(0.45, '#b9c6d2');
            f.addColorStop(0.5, '#4b5866');
            f.addColorStop(0.62, '#e9eef2');
            f.addColorStop(1, '#8793a0');
            return f;
          },
          fade = (a, b) => (g, px) => {
            const f = g.createLinearGradient(0, -px / 2, 0, px / 2);
            f.addColorStop(0, a);
            f.addColorStop(1, b);
            return f;
          };
        // ---- Boards ----------------------------------------------------------------------
        function boardPath(g, shape, x, y, w, h) {
          const r = Math.min(w, h);
          g.beginPath();
          if (shape === 'round') g.roundRect(x, y, w, h, r * 0.16);
          else if (shape === 'pill') g.roundRect(x, y, w, h, h / 2);
          else if (shape === 'oval') g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, FULL);
          else if (shape === 'arch') {
            g.moveTo(x, y + h);
            g.lineTo(x, y + h * 0.42);
            g.quadraticCurveTo(x + w / 2, y - h * 0.38, x + w, y + h * 0.42);
            g.lineTo(x + w, y + h);
          } else if (shape === 'deco') {
            // Stepped Art Deco crown: three setbacks rising to the centre.
            const s = [0, 0.1, 0.2, 0.3],
              rise = [0.36, 0.22, 0.1, 0];
            g.moveTo(x, y + h);
            for (let k = 0; k < 4; k++) {
              g.lineTo(x + w * s[k], y + h * rise[k]);
              g.lineTo(x + w * (s[k + 1] ?? 0.5), y + h * rise[k]);
            }
            for (let k = 3; k >= 0; k--) {
              g.lineTo(x + w * (1 - (s[k + 1] ?? 0.5)), y + h * rise[k]);
              g.lineTo(x + w * (1 - s[k]), y + h * rise[k]);
            }
            g.lineTo(x + w, y + h);
          } else if (shape === 'scallop') {
            const n = Math.max(6, Math.round(w / (h * 0.3))),
              bw = w / n,
              top = y + h * 0.12;
            g.moveTo(x, y + h);
            g.lineTo(x, top);
            for (let k = 0; k < n; k++) g.arc(x + bw * (k + 0.5), top, bw / 2, Math.PI, 0);
            g.lineTo(x + w, y + h);
            const bottom = y + h * 0.9;
            g.lineTo(x + w, bottom);
            for (let k = n - 1; k >= 0; k--) g.arc(x + bw * (k + 0.5), bottom, bw / 2, 0, Math.PI);
          } else if (shape === 'banner') {
            const notch = h * 0.35;
            g.moveTo(x, y);
            g.lineTo(x + w, y);
            g.lineTo(x + w - notch, y + h / 2);
            g.lineTo(x + w, y + h);
            g.lineTo(x, y + h);
            g.lineTo(x + notch, y + h / 2);
          } else if (shape === 'onion') {
            // A Moorish onion arch.
            g.moveTo(x, y + h);
            g.lineTo(x, y + h * 0.55);
            g.bezierCurveTo(x, y + h * 0.3, x + w * 0.4, y + h * 0.3, x + w * 0.46, y + h * 0.1);
            g.lineTo(x + w / 2, y - h * 0.02);
            g.lineTo(x + w * 0.54, y + h * 0.1);
            g.bezierCurveTo(x + w * 0.6, y + h * 0.3, x + w, y + h * 0.3, x + w, y + h * 0.55);
            g.lineTo(x + w, y + h);
          } else if (shape === 'boomerang') {
            // A Googie board: a slanted parallelogram with a rounded leading edge.
            const lean = h * 0.35;
            g.moveTo(x + lean, y);
            g.lineTo(x + w, y);
            g.lineTo(x + w - lean, y + h);
            g.lineTo(x + h * 0.2, y + h);
            g.quadraticCurveTo(x - h * 0.1, y + h * 0.5, x + lean, y);
          } else g.rect(x, y, w, h);
          g.closePath();
        }
        /**
         * Paints a board material inside the current path (callers set the path with
         * boardPath and this clips to it). kinds: enamel (gloss paint on steel),
         * matte, wood (weathered planks), steel (corrugated), brushed (chrome / brass,
         * `color` tints it), glass (black lacquer / glass), plywood, brick.
         */
        function fillBoard(g, kind, x, y, w, h, color, seed = 'board') {
          const rnd = seeded(seed + kind + color);
          g.save();
          g.clip();
          if (kind === 'wood' || kind === 'plywood') {
            const planks = kind === 'wood' ? Math.max(2, Math.round(h / (w * 0.07))) : 1;
            for (let k = 0; k < planks; k++) {
              const py = y + (h * k) / planks,
                ph = h / planks,
                tone = mix(color, rnd() < 0.5 ? '#000000' : '#ffffff', rnd() * 0.12);
              g.fillStyle = tone;
              g.fillRect(x, py, w, ph + 1);
              g.strokeStyle = rgba(shade(color, 0.5), 0.35);
              g.lineWidth = Math.max(1, h * 0.004);
              for (let j = 0; j < 7; j++) {
                const gy = py + ph * rnd();
                g.beginPath();
                g.moveTo(x, gy);
                for (let gx = 0; gx <= w; gx += w / 12) g.lineTo(x + gx, gy + Math.sin(gx * 0.01 + j) * ph * 0.08);
                g.stroke();
              }
              if (kind === 'wood') {
                g.fillStyle = 'rgba(0,0,0,0.45)';
                g.fillRect(x, py, w, Math.max(1.5, h * 0.012));
              }
            }
          } else if (kind === 'steel') {
            const ribs = Math.round(w / (h * 0.09));
            for (let k = 0; k < ribs; k++) {
              const rx = x + (w * k) / ribs,
                rw = w / ribs,
                f = g.createLinearGradient(rx, 0, rx + rw, 0);
              f.addColorStop(0, shade(color, 0.25));
              f.addColorStop(0.5, tint(color, 0.12));
              f.addColorStop(1, shade(color, 0.3));
              g.fillStyle = f;
              g.fillRect(rx, y, rw + 1, h);
            }
          } else if (kind === 'brushed') {
            const f = g.createLinearGradient(0, y, 0, y + h);
            f.addColorStop(0, tint(color, 0.55));
            f.addColorStop(0.45, color);
            f.addColorStop(0.55, shade(color, 0.25));
            f.addColorStop(1, tint(color, 0.25));
            g.fillStyle = f;
            g.fillRect(x, y, w, h);
            g.strokeStyle = 'rgba(255,255,255,0.08)';
            g.lineWidth = 1;
            for (let k = 0; k < h; k += 3) {
              g.beginPath();
              g.moveTo(x, y + k + rnd());
              g.lineTo(x + w, y + k + rnd());
              g.stroke();
            }
          } else if (kind === 'brick') {
            g.fillStyle = shade(color, 0.3);
            g.fillRect(x, y, w, h);
            const bh = h / 8,
              bw = bh * 2.6;
            for (let r = 0; r < 8; r++)
              for (let bx = r % 2 ? -bw / 2 : 0; bx < w; bx += bw) {
                g.fillStyle = mix(color, rnd() < 0.5 ? '#000000' : '#ffffff', rnd() * 0.15);
                g.fillRect(x + bx + 1, y + r * bh + 1, bw - 2, bh - 2);
              }
          } else if (kind === 'glass') {
            const f = g.createLinearGradient(0, y, 0, y + h);
            f.addColorStop(0, tint(color, 0.12));
            f.addColorStop(0.5, color);
            f.addColorStop(1, shade(color, 0.3));
            g.fillStyle = f;
            g.fillRect(x, y, w, h);
            g.fillStyle = 'rgba(255,255,255,0.07)';
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + w * 0.35, y);
            g.lineTo(x + w * 0.15, y + h);
            g.lineTo(x, y + h);
            g.fill();
          } else {
            const f = g.createLinearGradient(0, y, 0, y + h);
            f.addColorStop(0, tint(color, kind === 'matte' ? 0.04 : 0.14));
            f.addColorStop(1, shade(color, kind === 'matte' ? 0.08 : 0.18));
            g.fillStyle = f;
            g.fillRect(x, y, w, h);
            if (kind !== 'matte') {
              g.fillStyle = 'rgba(255,255,255,0.1)';
              g.fillRect(x, y + h * 0.06, w, h * 0.12);
            }
          }
          g.restore();
        }
        // Weathering: flecks and faded patches of the ground colour over the paint.
        function weather(g, x, y, w, h, color, amount, seed) {
          const rnd = seeded(seed + 'weather');
          g.save();
          for (let k = 0; k < 90 * amount; k++) {
            g.fillStyle = rgba(rnd() < 0.5 ? shade(color, 0.3) : tint(color, 0.2), 0.25 + rnd() * 0.35);
            const r = h * (0.004 + rnd() * 0.02);
            g.beginPath();
            g.ellipse(x + rnd() * w, y + rnd() * h, r * (1 + rnd() * 2), r, rnd() * 3, 0, FULL);
            g.fill();
          }
          for (let k = 0; k < 6 * amount; k++) {
            const sx = x + rnd() * w,
              f = g.createLinearGradient(0, y, 0, y + h);
            f.addColorStop(0, 'rgba(90,50,20,0)');
            f.addColorStop(0.4, 'rgba(110,60,25,0.22)');
            f.addColorStop(1, 'rgba(110,60,25,0)');
            g.fillStyle = f;
            g.fillRect(sx, y + h * rnd() * 0.3, h * 0.012, h * 0.7);
          }
          g.restore();
        }
        function rope(g, path, width) {
          g.save();
          g.lineWidth = width;
          g.strokeStyle = '#b89a62';
          g.lineCap = 'butt';
          path(g);
          g.stroke();
          g.setLineDash([width * 0.5, width * 0.5]);
          g.strokeStyle = '#6e5530';
          g.lineWidth = width * 0.7;
          path(g);
          g.stroke();
          g.restore();
        }
        function rivets(g, x, y, w, h, r, color = '#9aa19a') {
          for (const [px, py] of [
            [x + r * 2.4, y + r * 2.4],
            [x + w - r * 2.4, y + r * 2.4],
            [x + r * 2.4, y + h - r * 2.4],
            [x + w - r * 2.4, y + h - r * 2.4],
            [x + w / 2, y + r * 2.4],
            [x + w / 2, y + h - r * 2.4],
          ]) {
            const f = g.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
            f.addColorStop(0, tint(color, 0.6));
            f.addColorStop(1, shade(color, 0.5));
            g.fillStyle = f;
            g.beginPath();
            g.arc(px, py, r, 0, FULL);
            g.fill();
          }
        }
        function hazard(g, x, y, w, h, a = '#f2c21b', b = '#141414') {
          g.save();
          g.beginPath();
          g.rect(x, y, w, h);
          g.clip();
          g.fillStyle = a;
          g.fillRect(x, y, w, h);
          g.fillStyle = b;
          for (let k = -h; k < w + h; k += h * 1.4) {
            g.beginPath();
            g.moveTo(x + k, y + h);
            g.lineTo(x + k + h * 0.7, y + h);
            g.lineTo(x + k + h * 1.4, y);
            g.lineTo(x + k + h * 0.7, y);
            g.fill();
          }
          g.restore();
        }
        // Copies the day face into the glow mask at strength k: a lightbox shines
        // through its own colours, a floodlit board (lamps: true) fades from the
        // lamps at the top.
        function backlight(dg, gg, w, h, k, lamps = false) {
          const T = dg.getTransform();
          gg.save();
          gg.globalAlpha = k;
          gg.drawImage(dg.canvas, T.e, T.f, w, h, 0, 0, w, h);
          gg.restore();
          if (lamps) {
            gg.save();
            gg.globalCompositeOperation = 'multiply';
            const f = gg.createLinearGradient(0, 0, 0, h);
            f.addColorStop(0, '#ffffff');
            f.addColorStop(1, '#5a5048');
            gg.fillStyle = f;
            gg.fillRect(0, 0, w, h);
            gg.restore();
          }
        }
        // ---- Emblems ----------------------------------------------------------------------
        /**
         * Draws an emblem centred at (x, y) within about s pixels. mode 'fill' paints
         * it (c1 main, c2 detail); mode 'tube' traces the same outlines as neon
         * (both contexts: tubeIcon below).
         */
        function icon(g, kind, x, y, s, c1, c2 = c1, mode = 'fill') {
          const u = s / 2,
            tube = mode === 'tube';
          g.save();
          g.translate(x, y);
          g.lineJoin = g.lineCap = 'round';
          const F = (color) => {
              if (tube) g.stroke();
              else {
                g.fillStyle = color;
                g.fill();
              }
            },
            S = (color, width) => {
              if (!tube) {
                g.strokeStyle = color;
                g.lineWidth = width * u;
              }
              g.stroke();
            },
            circle = (cx, cy, r) => {
              g.beginPath();
              g.arc(cx * u, cy * u, r * u, 0, FULL);
            },
            poly = (pts) => {
              g.beginPath();
              pts.forEach(([px, py], i) => (i ? g.lineTo(px * u, py * u) : g.moveTo(px * u, py * u)));
              g.closePath();
            },
            line = (pts) => {
              g.beginPath();
              pts.forEach(([px, py], i) => (i ? g.lineTo(px * u, py * u) : g.moveTo(px * u, py * u)));
            },
            star = (cx, cy, r, points = 5, inner = 0.45) => {
              g.beginPath();
              for (let k = 0; k <= points * 2; k++) {
                const a = (k * Math.PI) / points - Math.PI / 2,
                  rr = k % 2 ? r * inner : r;
                g.lineTo((cx + Math.cos(a) * rr) * u, (cy + Math.sin(a) * rr) * u);
              }
              g.closePath();
            };
          switch (kind) {
            case 'wrench':
              g.rotate(-Math.PI / 4);
              line([
                [0, 0.62],
                [0, -0.3],
              ]);
              S(c1, 0.26);
              g.beginPath();
              g.arc(0, -0.52 * u, 0.3 * u, -Math.PI * 0.28, Math.PI * 1.28);
              S(c1, 0.2);
              circle(0, 0.7, 0.14);
              S(c1, 0.12);
              break;
            case 'wrenches':
              for (const r of [-1, 1]) {
                g.save();
                g.rotate((r * Math.PI) / 4);
                line([
                  [0, 0.7],
                  [0, -0.35],
                ]);
                S(c1, 0.2);
                g.beginPath();
                g.arc(0, -0.58 * u, 0.24 * u, -Math.PI * 0.28, Math.PI * 1.28);
                S(c1, 0.16);
                g.restore();
              }
              break;
            case 'martini':
              poly([
                [-0.7, -0.7],
                [0.7, -0.7],
                [0, 0.05],
              ]);
              F(c1);
              line([
                [0, 0.05],
                [0, 0.7],
              ]);
              S(c1, 0.1);
              line([
                [-0.35, 0.72],
                [0.35, 0.72],
              ]);
              S(c1, 0.12);
              circle(0.22, -0.45, 0.13);
              F(c2);
              line([
                [0.1, -0.2],
                [0.5, -0.9],
              ]);
              S(c2, 0.05);
              break;
            case 'cup':
              g.beginPath();
              g.moveTo(-0.6 * u, -0.25 * u);
              g.lineTo(0.4 * u, -0.25 * u);
              g.quadraticCurveTo(0.4 * u, 0.55 * u, -0.1 * u, 0.55 * u);
              g.quadraticCurveTo(-0.6 * u, 0.55 * u, -0.6 * u, -0.25 * u);
              g.closePath();
              F(c1);
              g.beginPath();
              g.arc(0.46 * u, 0.08 * u, 0.2 * u, -Math.PI / 2, Math.PI / 2);
              S(c1, 0.1);
              g.beginPath();
              g.ellipse(-0.1 * u, 0.66 * u, 0.75 * u, 0.12 * u, 0, 0, FULL);
              F(c1);
              for (const dx of [-0.35, -0.1, 0.15]) {
                line([
                  [dx, -0.4],
                  [dx + 0.1, -0.6],
                  [dx - 0.02, -0.8],
                ]);
                S(c2, 0.07);
              }
              break;
            case 'anchor':
              circle(0, -0.72, 0.16);
              S(c1, 0.1);
              line([
                [0, -0.56],
                [0, 0.8],
              ]);
              S(c1, 0.16);
              line([
                [-0.42, -0.36],
                [0.42, -0.36],
              ]);
              S(c1, 0.13);
              g.beginPath();
              g.arc(0, 0.2 * u, 0.62 * u, Math.PI * 0.1, Math.PI * 0.9);
              S(c1, 0.14);
              for (const side of [-1, 1]) {
                poly([
                  [side * 0.66, 0.2],
                  [side * 0.5, 0.42],
                  [side * 0.8, 0.44],
                ]);
                F(c1);
              }
              break;
            case 'cross':
              poly([
                [-0.24, -0.8],
                [0.24, -0.8],
                [0.24, -0.24],
                [0.8, -0.24],
                [0.8, 0.24],
                [0.24, 0.24],
                [0.24, 0.8],
                [-0.24, 0.8],
                [-0.24, 0.24],
                [-0.8, 0.24],
                [-0.8, -0.24],
                [-0.24, -0.24],
              ]);
              F(c1);
              break;
            case 'dice':
              for (const [dx, dy, r, pips] of [
                [-0.32, 0.12, -0.25, [[0, 0], [-0.2, -0.2], [0.2, 0.2]]],
                [0.36, -0.14, 0.3, [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, 0]]],
              ]) {
                g.save();
                g.translate(dx * u, dy * u);
                g.rotate(r);
                g.beginPath();
                g.roundRect(-0.36 * u, -0.36 * u, 0.72 * u, 0.72 * u, 0.12 * u);
                F(c1);
                if (!tube)
                  for (const [px, py] of pips) {
                    g.beginPath();
                    g.arc(px * u, py * u, 0.07 * u, 0, FULL);
                    g.fillStyle = c2;
                    g.fill();
                  }
                g.restore();
              }
              break;
            case 'reel':
              circle(0, 0, 0.82);
              F(c1);
              if (!tube) {
                for (let k = 0; k < 5; k++) {
                  const a = (k * FULL) / 5 - Math.PI / 2;
                  circle(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.19);
                  F(c2);
                }
                circle(0, 0, 0.1);
                F(c2);
              } else {
                circle(0, 0, 0.3);
                g.stroke();
              }
              break;
            case 'crown':
              poly([
                [-0.8, 0.45],
                [-0.8, -0.35],
                [-0.4, 0.05],
                [0, -0.6],
                [0.4, 0.05],
                [0.8, -0.35],
                [0.8, 0.45],
              ]);
              F(c1);
              for (const [px, py] of [
                [-0.8, -0.45],
                [0, -0.72],
                [0.8, -0.45],
              ]) {
                circle(px, py, 0.12);
                F(c2);
              }
              g.beginPath();
              g.rect(-0.8 * u, 0.5 * u, 1.6 * u, 0.2 * u);
              F(c1);
              break;
            case 'palm':
              g.beginPath();
              g.moveTo(-0.05 * u, 0.9 * u);
              g.quadraticCurveTo(0.1 * u, 0.2 * u, 0.02 * u, -0.45 * u);
              S(c2, 0.14);
              for (const [a, len] of [
                [-2.7, 0.8],
                [-2.1, 0.85],
                [-1.5, 0.6],
                [-0.9, 0.85],
                [-0.35, 0.8],
              ]) {
                const ex = Math.cos(a) * len,
                  ey = -0.45 + Math.sin(a) * len * 0.7 + 0.35;
                g.beginPath();
                g.moveTo(0.02 * u, -0.45 * u);
                g.quadraticCurveTo(((0.02 + ex) / 2) * u, (-0.45 - 0.35) * u, ex * u, ey * u);
                g.quadraticCurveTo(((0.02 + ex) / 2) * u, (-0.45 - 0.12) * u, 0.02 * u, -0.4 * u);
                F(c1);
              }
              break;
            case 'car':
              g.beginPath();
              g.moveTo(-0.95 * u, 0.25 * u);
              g.lineTo(-0.9 * u, -0.05 * u);
              g.lineTo(-0.45 * u, -0.12 * u);
              g.lineTo(-0.22 * u, -0.42 * u);
              g.lineTo(0.3 * u, -0.42 * u);
              g.lineTo(0.55 * u, -0.1 * u);
              g.lineTo(0.95 * u, -0.02 * u);
              g.lineTo(0.95 * u, 0.25 * u);
              g.closePath();
              F(c1);
              for (const dx of [-0.52, 0.55]) {
                circle(dx, 0.27, 0.18);
                F(c2);
              }
              break;
            case 'pistols':
              for (const side of [-1, 1]) {
                g.save();
                g.scale(side, 1);
                g.rotate(-0.6);
                poly([
                  [-0.75, -0.14],
                  [0.45, -0.14],
                  [0.45, 0.02],
                  [0.1, 0.02],
                  [0.02, 0.1],
                  [0.12, 0.48],
                  [-0.12, 0.5],
                  [-0.22, 0.04],
                  [-0.75, 0.02],
                ]);
                F(c1);
                g.restore();
              }
              break;
            case 'target':
              for (const [r, c] of [
                [0.82, c1],
                [0.6, c2],
                [0.4, c1],
                [0.2, c2],
              ]) {
                circle(0, 0, r);
                tube ? g.stroke() : F(c);
              }
              line([
                [-1, 0],
                [1, 0],
              ]);
              S(c1, 0.05);
              line([
                [0, -1],
                [0, 1],
              ]);
              S(c1, 0.05);
              break;
            case 'star':
              star(0, 0.05, 0.85);
              F(c1);
              break;
            case 'badge':
              star(0, 0, 0.85, 6, 0.55);
              F(c1);
              if (!tube) {
                circle(0, 0, 0.32);
                F(c2);
                for (let k = 0; k < 6; k++) {
                  const a = (k * Math.PI) / 3 - Math.PI / 2;
                  circle(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.09);
                  F(c1);
                }
              }
              break;
            case 'shield':
              g.beginPath();
              g.moveTo(-0.7 * u, -0.8 * u);
              g.lineTo(0.7 * u, -0.8 * u);
              g.lineTo(0.7 * u, 0);
              g.quadraticCurveTo(0.65 * u, 0.6 * u, 0, 0.9 * u);
              g.quadraticCurveTo(-0.65 * u, 0.6 * u, -0.7 * u, 0);
              g.closePath();
              F(c1);
              if (!tube) {
                line([
                  [-0.7, 0.25],
                  [0, -0.25],
                  [0.7, 0.25],
                ]);
                S(c2, 0.14);
                // An open book on the crest.
                poly([
                  [-0.4, -0.6],
                  [0, -0.5],
                  [0.4, -0.6],
                  [0.4, -0.3],
                  [0, -0.22],
                  [-0.4, -0.3],
                ]);
                F(c2);
                star(0, 0.42, 0.16);
                F(c2);
              }
              break;
            case 'sunset':
              g.beginPath();
              g.arc(0, 0.25 * u, 0.62 * u, Math.PI, 0);
              g.closePath();
              F(c1);
              for (let k = 0; k < 7; k++) {
                const a = Math.PI + (k + 0.5) * (Math.PI / 7);
                line([
                  [Math.cos(a) * 0.72, 0.25 + Math.sin(a) * 0.72],
                  [Math.cos(a) * 0.98, 0.25 + Math.sin(a) * 0.98],
                ]);
                S(c1, 0.08);
              }
              if (!tube)
                for (let k = 0; k < 3; k++) {
                  g.fillStyle = c2;
                  g.fillRect(-0.7 * u, (0.34 + k * 0.14) * u, 1.4 * u, 0.06 * u);
                }
              break;
            case 'sun':
              circle(0, 0, 0.42);
              F(c1);
              for (let k = 0; k < 12; k++) {
                const a = (k * FULL) / 12;
                line([
                  [Math.cos(a) * 0.55, Math.sin(a) * 0.55],
                  [Math.cos(a) * 0.85, Math.sin(a) * 0.85],
                ]);
                S(c1, 0.09);
              }
              break;
            case 'moon': {
              const R = 0.78 * u,
                d = 0.42 * u,
                q = 0.66 * u,
                ix = (R * R - q * q + d * d) / (2 * d),
                iy = Math.sqrt(Math.max(0, R * R - ix * ix)),
                A = Math.atan2(iy, ix),
                B = Math.atan2(iy, ix - d);
              g.beginPath();
              g.arc(0, 0, R, A, FULL - A, false);
              g.arc(d, 0, q, -B, B, true);
              g.closePath();
              F(c1);
              break;
            }
            case 'stars':
              for (const [sx, sy, r] of [
                [-0.5, -0.3, 0.3],
                [0.35, -0.55, 0.2],
                [0.45, 0.35, 0.26],
              ]) {
                star(sx, sy, r, 4, 0.3);
                F(c1);
              }
              break;
            case 'plane':
              g.rotate(-0.5);
              poly([
                [0.9, 0],
                [0.7, -0.08],
                [0.15, -0.08],
                [-0.2, -0.75],
                [-0.36, -0.75],
                [-0.18, -0.08],
                [-0.62, -0.08],
                [-0.78, -0.32],
                [-0.9, -0.32],
                [-0.8, 0],
                [-0.9, 0.32],
                [-0.78, 0.32],
                [-0.62, 0.08],
                [-0.18, 0.08],
                [-0.36, 0.75],
                [-0.2, 0.75],
                [0.15, 0.08],
                [0.7, 0.08],
              ]);
              F(c1);
              break;
            case 'fish':
              g.beginPath();
              g.ellipse(0.1 * u, 0, 0.6 * u, 0.32 * u, 0, 0, FULL);
              F(c1);
              poly([
                [-0.45, 0],
                [-0.9, -0.35],
                [-0.9, 0.35],
              ]);
              F(c1);
              if (!tube) {
                circle(0.45, -0.06, 0.06);
                F(c2);
              }
              break;
            case 'pizza':
              poly([
                [0, 0.85],
                [-0.62, -0.55],
                [0.62, -0.55],
              ]);
              F(c1);
              g.beginPath();
              g.moveTo(-0.66 * u, -0.55 * u);
              g.quadraticCurveTo(0, -0.95 * u, 0.66 * u, -0.55 * u);
              S(c2, 0.16);
              if (!tube)
                for (const [px, py] of [
                  [-0.2, -0.3],
                  [0.22, -0.25],
                  [0, 0.15],
                ]) {
                  circle(px, py, 0.12);
                  F('#b3202a');
                }
              break;
            case 'pole':
              g.beginPath();
              g.roundRect(-0.25 * u, -0.8 * u, 0.5 * u, 1.6 * u, 0.25 * u);
              F('#f4f1ea');
              if (!tube) {
                g.save();
                g.clip();
                for (let k = -4; k < 6; k++) {
                  poly([
                    [-0.3, k * 0.4 - 0.2],
                    [0.3, k * 0.4 - 0.5],
                    [0.3, k * 0.4 - 0.36],
                    [-0.3, k * 0.4 - 0.06],
                  ]);
                  F(k % 2 ? c1 : c2);
                }
                g.restore();
              }
              break;
            case 'balls':
              line([
                [-0.7, -0.8],
                [0.7, -0.8],
              ]);
              S(c2, 0.08);
              for (const [px, py] of [
                [-0.42, 0.05],
                [0.42, 0.05],
                [0, 0.55],
              ]) {
                line([
                  [px, -0.8],
                  [px, py],
                ]);
                S(c2, 0.05);
                circle(px, py, 0.3);
                F(c1);
              }
              break;
            case 'dumbbell':
              line([
                [-0.6, 0],
                [0.6, 0],
              ]);
              S(c1, 0.14);
              for (const side of [-1, 1]) {
                g.beginPath();
                g.roundRect((side > 0 ? 0.45 : -0.75) * u, -0.45 * u, 0.3 * u, 0.9 * u, 0.06 * u);
                F(c1);
                g.beginPath();
                g.roundRect((side > 0 ? 0.78 : -0.92) * u, -0.28 * u, 0.14 * u, 0.56 * u, 0.04 * u);
                F(c1);
              }
              break;
            case 'camera':
              g.beginPath();
              g.roundRect(-0.85 * u, -0.4 * u, 1.7 * u, 1.05 * u, 0.12 * u);
              F(c1);
              g.beginPath();
              g.rect(-0.3 * u, -0.62 * u, 0.6 * u, 0.24 * u);
              F(c1);
              circle(0, 0.12, 0.36);
              tube ? g.stroke() : F(c2);
              circle(0, 0.12, 0.18);
              tube ? g.stroke() : F(c1);
              break;
            case 'bolt':
              poly([
                [0.2, -0.9],
                [-0.5, 0.1],
                [-0.05, 0.1],
                [-0.25, 0.9],
                [0.5, -0.2],
                [0.05, -0.2],
              ]);
              F(c1);
              break;
            case 'helm':
              circle(0, 0, 0.55);
              S(c1, 0.14);
              circle(0, 0, 0.14);
              F(c1);
              for (let k = 0; k < 8; k++) {
                const a = (k * FULL) / 8;
                line([
                  [Math.cos(a) * 0.1, Math.sin(a) * 0.1],
                  [Math.cos(a) * 0.9, Math.sin(a) * 0.9],
                ]);
                S(c1, 0.1);
              }
              break;
            case 'mug':
              g.beginPath();
              g.roundRect(-0.55 * u, -0.45 * u, 0.8 * u, 1.2 * u, 0.08 * u);
              F(c1);
              g.beginPath();
              g.roundRect(0.2 * u, -0.2 * u, 0.4 * u, 0.6 * u, 0.2 * u);
              S(c1, 0.12);
              for (const [px, r] of [
                [-0.4, 0.22],
                [-0.12, 0.26],
                [0.14, 0.2],
              ]) {
                circle(px, -0.5, r);
                F(c2);
              }
              break;
            case 'spray':
              // A spray gun side on: paint cup on top, body, nozzle and trigger grip, a mist.
              g.beginPath();
              g.roundRect(-0.75 * u, -0.28 * u, 1.05 * u, 0.3 * u, 0.12 * u);
              F(c1);
              poly([
                [0.28, -0.24],
                [0.5, -0.18],
                [0.5, -0.06],
                [0.28, 0],
              ]);
              F(c1);
              g.beginPath();
              g.roundRect(-0.42 * u, -0.78 * u, 0.36 * u, 0.44 * u, 0.12 * u);
              F(c2);
              poly([
                [-0.55, 0],
                [-0.3, 0],
                [-0.42, 0.72],
                [-0.68, 0.72],
              ]);
              F(c1);
              for (let k = 0; k < 7; k++) {
                circle(0.62 + (k % 3) * 0.13, -0.12 + ((k * 5) % 7 - 3) * 0.06, 0.04 + (k % 2) * 0.02);
                F(c1);
              }
              break;
            case 'piston':
              g.beginPath();
              g.roundRect(-0.45 * u, -0.85 * u, 0.9 * u, 0.7 * u, 0.1 * u);
              F(c1);
              if (!tube)
                for (let k = 0; k < 3; k++) {
                  g.fillStyle = c2;
                  g.fillRect(-0.45 * u, (-0.75 + k * 0.16) * u, 0.9 * u, 0.05 * u);
                }
              line([
                [0, -0.2],
                [0, 0.55],
              ]);
              S(c1, 0.22);
              circle(0, 0.65, 0.2);
              S(c1, 0.1);
              break;
            case 'ball':
              circle(0, 0, 0.82);
              F(c1);
              if (!tube) {
                g.beginPath();
                for (let k = 0; k < 5; k++) {
                  const a = (k * FULL) / 5 - Math.PI / 2;
                  g.lineTo(Math.cos(a) * 0.3 * u, Math.sin(a) * 0.3 * u);
                }
                g.closePath();
                F(c2);
                for (let k = 0; k < 5; k++) {
                  const a = (k * FULL) / 5 - Math.PI / 2;
                  line([
                    [Math.cos(a) * 0.3, Math.sin(a) * 0.3],
                    [Math.cos(a) * 0.82, Math.sin(a) * 0.82],
                  ]);
                  S(c2, 0.06);
                }
              }
              break;
            case 'bowl':
              g.beginPath();
              g.moveTo(-0.85 * u, -0.05 * u);
              g.lineTo(0.85 * u, -0.05 * u);
              g.quadraticCurveTo(0.8 * u, 0.75 * u, 0, 0.75 * u);
              g.quadraticCurveTo(-0.8 * u, 0.75 * u, -0.85 * u, -0.05 * u);
              F(c1);
              for (const dx of [0.1, 0.35]) {
                line([
                  [dx, -0.1],
                  [dx + 0.45, -0.9],
                ]);
                S(c2, 0.07);
              }
              for (const dx of [-0.45, -0.2]) {
                line([
                  [dx, -0.15],
                  [dx + 0.05, -0.45],
                  [dx - 0.05, -0.65],
                ]);
                S(c2, 0.05);
              }
              break;
            case 'record':
              circle(0, 0, 0.85);
              F(c1);
              if (!tube) {
                g.strokeStyle = 'rgba(255,255,255,0.18)';
                g.lineWidth = Math.max(1, u * 0.02);
                for (const r of [0.72, 0.6, 0.5]) {
                  circle(0, 0, r);
                  g.stroke();
                }
              }
              circle(0, 0, 0.3);
              tube ? g.stroke() : F(c2);
              break;
            case 'heart':
              g.beginPath();
              g.moveTo(0, 0.8 * u);
              g.bezierCurveTo(-1.1 * u, 0, -0.7 * u, -0.95 * u, 0, -0.4 * u);
              g.bezierCurveTo(0.7 * u, -0.95 * u, 1.1 * u, 0, 0, 0.8 * u);
              F(c1);
              break;
            case 'flower':
              for (let k = 0; k < 5; k++) {
                const a = (k * FULL) / 5;
                g.beginPath();
                g.ellipse(Math.cos(a) * 0.42 * u, Math.sin(a) * 0.42 * u, 0.32 * u, 0.22 * u, a, 0, FULL);
                F(c1);
              }
              circle(0, 0, 0.22);
              F(c2);
              break;
            case 'book':
              poly([
                [-0.9, -0.5],
                [-0.1, -0.35],
                [0, -0.3],
                [0.1, -0.35],
                [0.9, -0.5],
                [0.9, 0.55],
                [0.05, 0.7],
                [-0.05, 0.7],
                [-0.9, 0.55],
              ]);
              F(c1);
              line([
                [0, -0.3],
                [0, 0.7],
              ]);
              S(c2, 0.06);
              break;
            case 'scissors':
              for (const side of [-1, 1]) {
                circle(side * 0.35, 0.55, 0.22);
                S(c1, 0.1);
                line([
                  [side * 0.25, 0.35],
                  [-side * 0.25, -0.85],
                ]);
                S(c1, 0.13);
              }
              break;
            case 'tyre':
              circle(0, 0, 0.62);
              S(c1, 0.3);
              circle(0, 0, 0.22);
              F(c2);
              break;
            case 'note':
              g.beginPath();
              g.ellipse(-0.3 * u, 0.55 * u, 0.26 * u, 0.2 * u, -0.4, 0, FULL);
              F(c1);
              g.beginPath();
              g.ellipse(0.5 * u, 0.4 * u, 0.26 * u, 0.2 * u, -0.4, 0, FULL);
              F(c1);
              line([
                [-0.08, 0.5],
                [-0.08, -0.7],
                [0.72, -0.85],
                [0.72, 0.35],
              ]);
              S(c1, 0.1);
              break;
            case 'wheat':
              line([
                [0, 0.9],
                [0, -0.8],
              ]);
              S(c1, 0.08);
              for (let k = 0; k < 4; k++)
                for (const side of [-1, 1]) {
                  g.beginPath();
                  g.ellipse(side * 0.16 * u, (-0.6 + k * 0.28) * u, 0.1 * u, 0.2 * u, side * 0.5, 0, FULL);
                  F(c1);
                }
              break;
            case 'tape':
              g.beginPath();
              g.roundRect(-0.9 * u, -0.55 * u, 1.8 * u, 1.1 * u, 0.08 * u);
              F(c1);
              for (const dx of [-0.4, 0.4]) {
                circle(dx, -0.05, 0.2);
                tube ? g.stroke() : F(c2);
              }
              g.beginPath();
              g.rect(-0.6 * u, 0.25 * u, 1.2 * u, 0.2 * u);
              tube ? g.stroke() : F(c2);
              break;
            case 'joystick':
              g.beginPath();
              g.roundRect(-0.7 * u, 0.35 * u, 1.4 * u, 0.45 * u, 0.1 * u);
              F(c1);
              line([
                [0, 0.4],
                [0.15, -0.35],
              ]);
              S(c1, 0.12);
              circle(0.17, -0.5, 0.24);
              F(c2);
              break;
            case 'bubbles':
              for (const [bx, by, r] of [
                [-0.4, 0.3, 0.38],
                [0.3, -0.1, 0.3],
                [0.1, 0.6, 0.18],
                [-0.2, -0.55, 0.22],
                [0.62, 0.45, 0.14],
              ]) {
                circle(bx, by, r);
                S(c1, 0.08);
              }
              break;
            case 'leaf':
              g.beginPath();
              g.moveTo(-0.7 * u, 0.7 * u);
              g.quadraticCurveTo(-0.6 * u, -0.7 * u, 0.8 * u, -0.8 * u);
              g.quadraticCurveTo(0.7 * u, 0.6 * u, -0.7 * u, 0.7 * u);
              F(c1);
              line([
                [-0.8, 0.8],
                [0.5, -0.5],
              ]);
              S(c2, 0.06);
              break;
            case 'tree':
              for (let k = 0; k < 3; k++) {
                poly([
                  [0, -0.95 + k * 0.4],
                  [-0.45 - k * 0.14, -0.3 + k * 0.4],
                  [0.45 + k * 0.14, -0.3 + k * 0.4],
                ]);
                F(c1);
              }
              g.beginPath();
              g.rect(-0.1 * u, 0.5 * u, 0.2 * u, 0.4 * u);
              F(c2);
              break;
            case 'mountain':
              poly([
                [-0.95, 0.6],
                [-0.3, -0.5],
                [0.05, 0.05],
                [0.35, -0.3],
                [0.95, 0.6],
              ]);
              F(c1);
              if (!tube) {
                poly([
                  [-0.3, -0.5],
                  [-0.12, -0.2],
                  [-0.3, -0.12],
                  [-0.46, -0.24],
                ]);
                F(c2);
              }
              break;
            case 'hanger':
              line([
                [0, -0.3],
                [0, -0.5],
              ]);
              S(c1, 0.08);
              g.beginPath();
              g.arc(0.12 * u, -0.6 * u, 0.13 * u, Math.PI, Math.PI * 2.2);
              S(c1, 0.08);
              poly([
                [0, -0.3],
                [0.85, 0.35],
                [-0.85, 0.35],
              ]);
              S(c1, 0.09);
              break;
            case 'flame':
              g.beginPath();
              g.moveTo(0, 0.85 * u);
              g.bezierCurveTo(-0.8 * u, 0.7 * u, -0.5 * u, -0.1 * u, -0.1 * u, -0.9 * u);
              g.bezierCurveTo(0, -0.3 * u, 0.5 * u, -0.4 * u, 0.3 * u, -0.7 * u);
              g.bezierCurveTo(0.9 * u, 0, 0.7 * u, 0.7 * u, 0, 0.85 * u);
              F(c1);
              break;
            case 'wing':
              for (let k = 0; k < 4; k++) {
                g.beginPath();
                g.moveTo(-0.8 * u, (0.1 + k * 0.12) * u);
                g.quadraticCurveTo(0, (-0.7 + k * 0.22) * u, (0.9 - k * 0.15) * u, (-0.6 + k * 0.28) * u);
                g.quadraticCurveTo(0, (-0.3 + k * 0.25) * u, -0.8 * u, (0.3 + k * 0.12) * u);
                F(c1);
              }
              break;
            case 'cigar':
              g.save();
              g.rotate(-0.35);
              g.beginPath();
              g.roundRect(-0.9 * u, -0.14 * u, 1.6 * u, 0.28 * u, 0.14 * u);
              F(c1);
              g.beginPath();
              g.rect(-0.35 * u, -0.15 * u, 0.2 * u, 0.3 * u);
              F(c2);
              g.restore();
              for (const dx of [0.75, 0.9]) {
                line([
                  [dx, -0.35],
                  [dx - 0.06, -0.6],
                  [dx + 0.04, -0.85],
                ]);
                S(c2, 0.05);
              }
              break;
            case 'taco':
              g.beginPath();
              g.arc(0, 0.35 * u, 0.8 * u, Math.PI, 0);
              g.closePath();
              F(c1);
              for (const [px, c] of [
                [-0.35, '#5fae3a'],
                [0.05, '#d8412f'],
                [0.4, '#5fae3a'],
              ]) {
                circle(px, -0.3, 0.2);
                F(tube ? c1 : c);
              }
              break;
            case 'ship':
              poly([
                [-0.9, 0.1],
                [0.9, 0.1],
                [0.65, 0.5],
                [-0.75, 0.5],
              ]);
              F(c1);
              g.beginPath();
              g.rect(-0.45 * u, -0.25 * u, 0.9 * u, 0.35 * u);
              F(c1);
              g.beginPath();
              g.rect(0.05 * u, -0.6 * u, 0.2 * u, 0.35 * u);
              F(c2);
              break;
            case 'm':
              circle(0, 0, 0.9);
              F(c1);
              if (!tube) {
                const run = strokeText('M', { cx: 0, cy: 0, maxW: u * 1.1, maxH: u * 0.95 });
                blockLetters(g, run.lines, u * 0.22, { fill: c2, cap: 'butt' });
              }
              break;
            case 'warn':
              poly([
                [0, -0.85],
                [0.9, 0.7],
                [-0.9, 0.7],
              ]);
              F(c1);
              if (!tube) {
                line([
                  [0, -0.35],
                  [0, 0.2],
                ]);
                S(c2, 0.16);
                circle(0, 0.45, 0.09);
                F(c2);
              }
              break;
            default:
              star(0, 0.05, 0.8);
              F(c1);
          }
          g.restore();
        }
        // The same emblem as bent neon: glass by day, glowing in the mask.
        function tubeIcon(dg, gg, kind, x, y, s, color, t) {
          dg.save();
          dg.strokeStyle = mix(color, '#ffffff', 0.32);
          dg.lineWidth = t;
          icon(dg, kind, x, y, s, color, color, 'tube');
          dg.restore();
          gg.save();
          gg.shadowColor = color;
          gg.shadowBlur = t * 3;
          gg.strokeStyle = rgba(color, 0.6);
          gg.lineWidth = t * 2.2;
          icon(gg, kind, x, y, s, color, color, 'tube');
          gg.restore();
          gg.save();
          gg.strokeStyle = mix(color, '#ffffff', 0.6);
          gg.lineWidth = t * 0.7;
          icon(gg, kind, x, y, s, color, color, 'tube');
          gg.restore();
        }
        return {
          mix,
          shade,
          tint,
          rgba,
          seeded,
          FONTS,
          strokeText,
          tracePath,
          stencilCut,
          resample,
          tubes,
          doubleTubes,
          bulbLetters,
          bulbDots,
          blockLetters,
          decoLetters,
          pixelLetters,
          fxText,
          gold,
          chrome,
          fade,
          boardPath,
          fillBoard,
          weather,
          rope,
          rivets,
          hazard,
          backlight,
          icon,
          tubeIcon,
        };
      })();
      // END SUBSYSTEM: src/signkit3d.js
