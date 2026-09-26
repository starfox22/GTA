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
