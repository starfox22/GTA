      // BEGIN SUBSYSTEM: src/signdesigns3d.js — Business sign designs: families, the style table, hotels, towers, billboards
      /**
       * Business sign designs
       * Source: src/signdesigns3d.js
       * Scope: createCityRenderer() closure (after signkit3d.js, before `sign()`).
       *
       * Every named business gets a sign designed for its trade, era (1997, the
       * South Coast) and street, built from SignKit parts. A design is a FAMILY
       * (how the sign is made: bent neon on a board, marquee bulbs, a backlit
       * lightbox, porcelain enamel, weathered planks, stencilled steel, Art Deco
       * letters...) plus PARAMETERS (colours, emblem, lettering, board shape). The
       * table `SIGN_DESIGNS` maps each business name to its design; names it does
       * not list fall back on `designFor` (by trade keywords such as MOTEL or
       * GARAGE, then a caller's style hint), so a new business picks a design by
       * adding one line. docs/SOURCE_GUIDE.md has the table of styles.
       *
       * A family paints the day face and the glow mask (what lights at night) into
       * a w x h box and returns how the sign is built:
       *   cutout    letters or a shaped board with the background cut away
       *   backing   'panel' (a box behind the board), 'raceway' (a thin bar that
       *             carries cut-out letters) or 'inset' (a smaller box hidden
       *             behind a shaped board)
       *   backColor the backing's paint
       *   lamps     floodlit: goose-neck lamps over the board (glows placed by
       *             signage3d.js) and a mask that fades from the top
       *   marquee   chasing bulbs round the board (signage3d.js)
       *   flicker   old neon that stutters now and then
       *   light     the colour thrown on the pavement
       * Glow masks are painted for one night strength (SIGN_NIGHT; neon boards use
       * the cooler NEON_NIGHT): neon cores run
       * at full white, lightboxes at about half, floodlit boards at a fifth, and
       * reflective road signs barely glow.
       */
      // Neon boards run cooler than the rest: big script tubes otherwise bloom into a blur.
      const SIGN_NIGHT = 3,
        NEON_NIGHT = 1.9;
      const SignArt = (() => {
        const K = SignKit,
          FULL_TURN = Math.PI * 2;
        const spec = (s) =>
          Object.assign({ cutout: false, backing: 'panel', backColor: '#1d2226', flicker: 0, lamps: false, marquee: false, light: '#ffe6c0', day: 0.14, night: SIGN_NIGHT }, s);
        const linesOf = (text, P) => P.lines || [text];
        // Rows of text stacked in a vertical band: returns each row's centre and cap height.
        function rows(count, top, bottom, ratio = null) {
          const out = [],
            h = bottom - top;
          if (count === 1) return [{ cy: top + h / 2, cap: h * 0.8 }];
          const weights = ratio || Array(count).fill(1),
            sum = weights.reduce((a, b) => a + b, 0);
          let y = top;
          for (const wgt of weights) {
            const band = (h * wgt) / sum;
            out.push({ cy: y + band / 2, cap: band * 0.74 });
            y += band;
          }
          return out;
        }
        // Emblems at the ends of a board: returns the text box left over.
        function emblems(dg, gg, w, h, P, pad, drawOne) {
          let x0 = pad,
            x1 = w - pad;
          const s = h * (P.iconSize || 0.62);
          if (P.icon) {
            drawOne(P.icon, x0 + s / 2, h / 2 + (P.iconDy || 0) * h, s);
            x0 += s + pad * 0.6;
          }
          const right = P.icon2 === true ? P.icon : P.icon2;
          if (right) {
            drawOne(right, x1 - s / 2, h / 2 + (P.iconDy || 0) * h, s);
            x1 -= s + pad * 0.6;
          } else if (P.icon && P.balance !== false) x1 -= (s + pad * 0.6) * 0.35;
          return { x0, x1, cx: (x0 + x1) / 2, span: x1 - x0 };
        }
        const paintedIcon = (dg, P) => (kind, x, y, s) => K.icon(dg, kind, x, y, s, P.iconColor || P.ink, P.iconColor2 || P.ground || P.board || '#111');
        // ---- Families ------------------------------------------------------------------
        const FAMILIES = {
          /**
           * Script neon: slanted lower-case tubes (the word the business is known by),
           * an optional line of block-capital tubes below, a swash, an emblem in tubes.
           * Without a board the letters are cut out and ride a raceway (rooftops,
           * clubs); with one it is an enamel board with a rim.
           */
          neonScript(dg, gg, w, h, text, P) {
            const u = h / 100,
              cut = !P.board;
            if (!cut) {
              K.boardPath(dg, P.shape || 'round', 3 * u, 3 * u, w - 6 * u, h - 6 * u);
              K.fillBoard(dg, P.boardKind || 'enamel', 0, 0, w, h, P.board, text);
              K.boardPath(dg, P.shape || 'round', 3 * u, 3 * u, w - 6 * u, h - 6 * u);
              dg.strokeStyle = P.rim || K.shade(P.board, 0.45);
              dg.lineWidth = 4 * u;
              dg.stroke();
              if (P.painted) {
                // A painted motif on the board (a sunset, stripes) under the tubes.
                K.icon(dg, P.painted, w * 0.14, h * 0.52, h * 0.78, P.paintedColor || '#ff9d3b', K.shade(P.board, 0.2));
              }
            }
            const box = emblems(dg, gg, w, h, P, 10 * u, (kind, x, y, s) => {
              if (P.iconFill) K.icon(dg, kind, x, y, s * 0.86, P.iconFill, P.board || '#222');
              K.tubeIcon(dg, gg, kind, x, y, s * 0.86, P.iconColor || P.tube, Math.max(2, 2.8 * u));
            });
            if (P.painted) box.x0 = Math.max(box.x0, w * 0.26);
            const cx = (box.x0 + box.x1) / 2,
              span = box.x1 - box.x0,
              block = P.block,
              sr = K.strokeText(P.script || text.toLowerCase(), {
                lower: true,
                slant: 0.24,
                cx,
                cy: block ? h * 0.37 : h * 0.47,
                maxW: span,
                maxH: block ? h * 0.46 : h * 0.62,
                track: 0.1,
              }),
              t = Math.max(2, sr.size * 0.105);
            if (cut || P.backer) {
              // The tubes ride on letter-shaped backers of painted sheet metal.
              dg.strokeStyle = P.backer || '#2a2d31';
              dg.lineWidth = t * 2.6;
              dg.lineJoin = dg.lineCap = 'round';
              K.tracePath(dg, sr.lines);
              dg.stroke();
            }
            K.tubes(dg, gg, sr.lines, t, P.tube);
            if (P.swash) {
              const y = sr.base + sr.size * 0.2,
                x0 = sr.left + sr.size * 0.1,
                x1 = sr.left + sr.width,
                pts = [];
              for (let k = 0; k <= 24; k++) {
                const f = k / 24;
                pts.push([x0 + (x1 - x0) * f, y + Math.sin(f * Math.PI) * sr.size * 0.06 - (f > 0.85 ? (f - 0.85) * sr.size * 1.4 : 0)]);
              }
              if (cut) {
                dg.strokeStyle = '#2a2d31';
                dg.lineWidth = t * 2.2;
                K.tracePath(dg, [pts]);
                dg.stroke();
              }
              K.tubes(dg, gg, [pts], t * 0.8, P.swash);
            }
            if (block) {
              const br = K.strokeText(block, { cx: cx + (P.blockShift || 0) * span, cy: h * 0.79, maxW: span * 0.8, maxH: h * 0.16, track: 0.38 });
              if (cut) {
                dg.strokeStyle = '#2a2d31';
                dg.lineWidth = br.size * 0.3;
                K.tracePath(dg, br.lines);
                dg.stroke();
              }
              K.tubes(dg, gg, br.lines, Math.max(1.5, br.size * 0.13), P.blockTube || P.tube);
            }
            if (P.stars)
              for (const [dx, sy, r] of [
                [0.1, 0.2, 0.07],
                [0.28, 0.4, 0.045],
                [0.02, 0.1, 0.04],
              ])
                K.tubeIcon(dg, gg, 'star', Math.min(w - 8 * u, sr.left + sr.width + dx * h), h * sy, h * r * 2, P.stars, Math.max(1.5, 1.8 * u));
            return spec({ cutout: cut, backing: cut ? 'raceway' : 'panel', backColor: cut ? '#2a2d31' : K.shade(P.board, 0.5), flicker: P.flicker ? 1 : 0, light: P.tube, night: NEON_NIGHT });
          },
          /** Block-capital neon on a lacquer board, single or double-line tubes, tube borders. */
          neonBlock(dg, gg, w, h, text, P) {
            const u = h / 100,
              board = P.board || '#0d0d10';
            K.boardPath(dg, P.shape || 'rect', 0, 0, w, h);
            K.fillBoard(dg, P.boardKind || 'glass', 0, 0, w, h, board, text);
            const cut = P.shape && P.shape !== 'rect' && P.shape !== 'round';
            if (P.border === 'zigzag') {
              for (const y of [9 * u, h - 9 * u]) {
                const pts = [];
                for (let x = 10 * u, k = 0; x <= w - 10 * u; x += 9 * u, k++) pts.push([x, y + (k % 2 ? -3.5 : 3.5) * u]);
                K.tubes(dg, gg, [pts], 2.4 * u, P.accent || P.tube, { electrodes: false });
              }
            } else if (P.border !== 'none') {
              const inset = P.shape === 'deco' ? 40 * u : 8 * u,
                r = [
                  [8 * u, inset],
                  [w - 8 * u, inset],
                  [w - 8 * u, h - 8 * u],
                  [8 * u, h - 8 * u],
                  [8 * u, inset],
                ];
              K.tubes(dg, gg, [r], 2.6 * u, P.accent || P.tube, { electrodes: false });
            }
            const top = P.shape === 'deco' ? 36 * u : 16 * u;
            if (P.crown) K.tubeIcon(dg, gg, P.crown, w / 2, 17 * u, 24 * u, P.crownColor || P.accent || P.tube, 2.4 * u);
            const box = emblems(dg, gg, w, h, P, 16 * u, (kind, x, y, s) => K.tubeIcon(dg, gg, kind, x, y, s * 0.8, P.iconColor || P.accent || P.tube, 2.6 * u)),
              ls = linesOf(text, P),
              rs = rows(ls.length, top, h - 16 * u, P.ratio);
            ls.forEach((line, i) => {
              const run = K.strokeText(line, { cx: box.cx, cy: rs[i].cy, maxW: box.span, maxH: rs[i].cap, track: P.track ?? 0.24, slant: P.slant || 0 });
              if (P.inline) K.doubleTubes(dg, gg, run.lines, Math.max(1.5, run.size * 0.055), i && P.tube2 ? P.tube2 : P.tube, board);
              else K.tubes(dg, gg, run.lines, Math.max(2, run.size * 0.1), i && P.tube2 ? P.tube2 : P.tube);
            });
            return spec({ cutout: cut, backing: cut ? 'inset' : 'panel', backColor: K.shade(board, 0.3), flicker: P.flicker ? 1 : 0, light: P.tube, night: NEON_NIGHT });
          },
          /**
           * Marquee bulbs: letters of bulbs on painted channels, a bulb-studded frame,
           * sunburst rays, dice or stars; casino, cinema and fairground boards.
           */
          bulbs(dg, gg, w, h, text, P) {
            const u = h / 100,
              shape = P.shape || 'rect',
              cut = shape !== 'rect';
            K.boardPath(dg, shape, 2 * u, 2 * u, w - 4 * u, h - 4 * u);
            K.fillBoard(dg, 'enamel', 0, 0, w, h, P.board, text);
            if (P.rays) {
              dg.save();
              K.boardPath(dg, shape, 2 * u, 2 * u, w - 4 * u, h - 4 * u);
              dg.clip();
              dg.fillStyle = P.rays;
              for (let k = 0; k < 18; k++) {
                const a0 = Math.PI + (k * Math.PI) / 18,
                  a1 = a0 + Math.PI / 36;
                dg.beginPath();
                dg.moveTo(w / 2, h * 1.05);
                dg.lineTo(w / 2 + Math.cos(a0) * w, h * 1.05 + Math.sin(a0) * w);
                dg.lineTo(w / 2 + Math.cos(a1) * w, h * 1.05 + Math.sin(a1) * w);
                dg.fill();
              }
              dg.restore();
            }
            K.boardPath(dg, shape, 2 * u, 2 * u, w - 4 * u, h - 4 * u);
            dg.lineWidth = 5 * u;
            dg.strokeStyle = P.rim || '#d8a948';
            dg.stroke();
            K.boardPath(dg, shape, 6 * u, 6 * u, w - 12 * u, h - 12 * u);
            dg.lineWidth = 1.2 * u;
            dg.strokeStyle = K.shade(P.rim || '#d8a948', 0.5);
            dg.stroke();
            // A frame of bulbs just inside the rim (straight runs; arches follow the curve).
            if (P.frame !== false) {
              const pts = [],
                step = 7 * u,
                inset = 9.5 * u;
              if (shape === 'arch') {
                for (let k = 0; k <= 40; k++) {
                  const f = k / 40,
                    x = inset + (w - 2 * inset) * f,
                    tt = f,
                    y = (1 - tt) * (1 - tt) * (h * 0.44) + 2 * (1 - tt) * tt * (-h * 0.3) + tt * tt * (h * 0.44);
                  pts.push([x, y + inset * 0.9]);
                }
                pts.push([w - inset, h - inset]);
                pts.push([inset, h - inset]);
                pts.push(pts[0]);
              } else {
                const top = shape === 'scallop' ? 22 * u : inset,
                  bottom = shape === 'scallop' ? h - 20 * u : h - inset;
                pts.push([inset, top], [w - inset, top], [w - inset, bottom], [inset, bottom], [inset, top]);
              }
              K.bulbDots(dg, gg, K.resample([pts], step), 1.9 * u, P.frameBulb || P.bulb || '#fff0c0');
            }
            const box = emblems(dg, gg, w, h, P, 16 * u, paintedIcon(dg, { ...P, ink: P.iconColor || P.rim || '#e8c060', ground: P.iconColor2 || P.board })),
              ls = linesOf(text, P),
              top = shape === 'arch' ? 26 * u : shape === 'scallop' ? 26 * u : 18 * u,
              rs = rows(ls.length, top, h - (shape === 'scallop' ? 22 : 16) * u, P.ratio);
            ls.forEach((line, i) => {
              const run = K.strokeText(line, {
                cx: box.cx,
                cy: rs[i].cy + (P.arc && i === 0 ? rs[i].cap * 0.1 : 0),
                maxW: box.span,
                maxH: rs[i].cap,
                track: 0.26,
                bounce: P.bounce || 0,
                arc: i === 0 && P.arc ? P.arc * h : 0,
              });
              K.bulbLetters(dg, gg, run.lines, run.size, { bodyColor: i && P.body2 ? P.body2 : P.body, bulb: P.bulb, body: 0.21, step: 0.15, r: 0.045 });
            });
            return spec({ cutout: cut, backing: cut ? 'inset' : 'panel', backColor: K.shade(P.board, 0.4), light: P.bulb || '#ffd48a', marquee: !!P.marquee });
          },
          /**
           * Backlit lightbox: a translucent panel in an aluminium frame; the vinyl
           * letters and emblem show dark or coloured against the lit plastic.
           */
          lightbox(dg, gg, w, h, text, P) {
            const u = h / 100,
              shape = P.shape || 'round',
              frame = 5 * u;
            K.boardPath(dg, shape, 0, 0, w, h);
            K.fillBoard(dg, 'brushed', 0, 0, w, h, P.frame || '#6d7378', text);
            K.boardPath(dg, shape, frame, frame, w - 2 * frame, h - 2 * frame);
            K.fillBoard(dg, 'matte', 0, 0, w, h, P.panel, text);
            dg.save();
            K.boardPath(dg, shape, frame, frame, w - 2 * frame, h - 2 * frame);
            dg.clip();
            if (P.stripes) {
              const n = P.stripes.length,
                sh = (h * 0.22) / n;
              P.stripes.forEach((c, k) => {
                dg.fillStyle = c;
                dg.fillRect(0, h - frame - sh * (n - k), w, sh);
                if (P.stripesTop) dg.fillRect(0, frame + sh * k, w, sh);
              });
            }
            if (P.band) {
              dg.fillStyle = P.band;
              if (P.bandSide === 'bottom') dg.fillRect(0, h * 0.8, w, h * 0.2);
              else if (P.bandSide === 'top') dg.fillRect(0, 0, w, h * 0.18);
              else dg.fillRect(0, 0, h * 1.05, h);
            }
            if (P.checker) {
              const c = h * 0.09;
              for (const y of [frame, h - frame - c])
                for (let x = 0, k = 0; x < w; x += c, k++) {
                  dg.fillStyle = k % 2 ? P.checker : '#ffffff';
                  dg.fillRect(x, y + (k % 2) * 0, c, c);
                }
            }
            dg.restore();
            const pad = 12 * u;
            let box;
            if (P.band && !P.bandSide) {
              const s = h * 0.62;
              if (P.iconBox) {
                dg.fillStyle = P.iconBox;
                dg.fillRect(h * 0.52 - s * 0.62, h / 2 - s * 0.62, s * 1.24, s * 1.24);
              }
              K.icon(dg, P.icon, h * 0.52, h / 2, s, P.iconColor || '#fff', P.band);
              box = { x0: h * 1.05 + pad, x1: w - pad };
              box.cx = (box.x0 + box.x1) / 2;
              box.span = box.x1 - box.x0;
            } else
              box = emblems(dg, gg, w, h, P, pad, (kind, x, y, s) => {
                if (P.iconBox) {
                  dg.fillStyle = P.iconBox;
                  dg.beginPath();
                  dg.roundRect(x - s * 0.62, y - s * 0.62, s * 1.24, s * 1.24, s * 0.12);
                  dg.fill();
                }
                K.icon(dg, kind, x, y, s * 0.9, P.iconColor || P.ink, P.iconColor2 || P.panel);
              });
            if (P.tab) {
              // A pill's rounded end would cut the tab's corners off: keep it inside the curve.
              const tw = Math.min(box.span * 0.36, h * 1.3),
                tx = box.x1 - tw - (P.shape === 'pill' ? Math.max(0, h * 0.42 - pad) : 0);
              dg.fillStyle = P.tabColor || P.ink;
              dg.beginPath();
              dg.roundRect(tx, h * 0.18, tw, h * 0.64, 6 * u);
              dg.fill();
              const tl = P.tab.split(' '),
                band = 0.56 / tl.length;
              tl.forEach((word, k) =>
                K.fxText(dg, word, tx + tw / 2, h * (0.22 + band * (k + 0.5)), { font: 'black', weight: '900', size: h * Math.min(0.32, band * 0.86), maxW: tw * 0.84, fill: P.tabInk || P.panel }),
              );
              box.x1 = tx - pad * 0.6;
              box.cx = (box.x0 + box.x1) / 2;
              box.span = box.x1 - box.x0;
            }
            const ls = linesOf(text, P),
              bottom = P.sub ? h * 0.7 : P.stripes ? h * 0.74 : h - pad,
              rs = rows(ls.length, pad, bottom, P.ratio);
            ls.forEach((line, i) =>
              K.fxText(dg, line, box.cx, rs[i].cy + rs[i].cap * 0.04, {
                font: P.font || 'sans',
                weight: P.weight || '800',
                size: rs[i].cap * 1.05,
                maxW: box.span,
                condense: P.condense || 1,
                skew: P.skew || 0,
                spacing: P.spacing || 0,
                fill: P.ink,
                outline: P.outline ? [2.2 * u, P.outline] : null,
                shadow: P.shadow ? [2 * u, 3 * u, P.shadow, 0] : null,
              }),
            );
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.81, { font: 'sans', weight: '700', size: h * 0.13, maxW: box.span * 0.9, spacing: 0.18, fill: P.subInk || P.ink });
            K.backlight(dg, gg, w, h, P.glow ?? 0.5);
            gg.save();
            gg.strokeStyle = '#000';
            gg.lineWidth = frame * 2;
            K.boardPath(gg, shape, 0, 0, w, h);
            gg.stroke();
            gg.restore();
            return spec({ cutout: shape !== 'round' && shape !== 'rect', backing: shape === 'oval' || shape === 'pill' ? 'inset' : 'panel', backColor: '#3a3f44', light: K.mix(P.panel, '#ffffff', 0.4), day: 0.2 });
          },
          /**
           * Porcelain enamel / painted metal: gloss ground, a rim (two-tone), serif or
           * slab lettering with a shadow, an inset pill, an emblem; floodlit at night
           * (or `backlit` for a lit cabinet).
           */
          enamel(dg, gg, w, h, text, P) {
            const u = h / 100,
              shape = P.shape || 'rect',
              inset = shape === 'oval' ? 6 * u : 4 * u;
            K.boardPath(dg, shape, 1 * u, 1 * u, w - 2 * u, h - 2 * u);
            K.fillBoard(dg, P.kind || 'enamel', 0, 0, w, h, P.ground, text);
            if (P.rim) {
              K.boardPath(dg, shape, inset, inset, w - 2 * inset, h - 2 * inset);
              dg.lineWidth = 3.5 * u;
              dg.strokeStyle = P.rim;
              dg.stroke();
              if (P.rim2 !== false) {
                K.boardPath(dg, shape, inset + 5 * u, inset + 5 * u, w - 2 * inset - 10 * u, h - 2 * inset - 10 * u);
                dg.lineWidth = 1.2 * u;
                dg.strokeStyle = P.rim2 || P.rim;
                dg.stroke();
              }
            }
            let pad = (shape === 'oval' ? 26 : 14) * u;
            if (P.inner) {
              dg.fillStyle = P.inner;
              dg.beginPath();
              dg.roundRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6, h * 0.3);
              dg.fill();
              dg.lineWidth = 2.5 * u;
              dg.strokeStyle = P.rim || P.ink;
              dg.stroke();
            }
            const drawn = emblems(dg, gg, w, h, P, pad, paintedIcon(dg, { ...P, ink: P.iconColor || P.rim || P.ink })),
              box = P.inner ? { x0: w * 0.24, x1: w * 0.76, cx: w / 2, span: w * 0.52 } : drawn,
              ls = linesOf(text, P),
              top = P.subAbove ? h * 0.34 : P.inner ? h * 0.24 : 14 * u,
              bottom = P.sub ? h * 0.7 : P.inner ? h * 0.76 : h - 14 * u,
              rs = rows(ls.length, top, bottom, P.ratio);
            if (P.subAbove) K.fxText(dg, P.subAbove, box.cx, h * 0.22, { font: P.subFont || 'sans', weight: '700', size: h * 0.12, maxW: box.span * 0.7, spacing: 0.25, fill: P.subInk || P.ink });
            ls.forEach((line, i) =>
              K.fxText(dg, line, box.cx, rs[i].cy, {
                font: P.font || 'serif',
                weight: P.weight || '700',
                size: rs[i].cap * 1.08,
                maxW: box.span,
                spacing: P.spacing ?? 0.06,
                condense: P.condense || 1,
                skew: P.skew || 0,
                fill: P.gilt ? K.gold : P.inner ? P.innerInk || P.ink : P.ink,
                outline: P.outline ? [1.6 * u, P.outline] : null,
                shadow: [1.5 * u, 2.5 * u, P.shadowColor || 'rgba(0,0,0,0.45)', 0],
              }),
            );
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.82, { font: P.subFont || 'sans', weight: '700', size: h * 0.12, maxW: box.span * 0.8, spacing: 0.25, fill: P.subInk || P.ink });
            if (P.backlit) K.backlight(dg, gg, w, h, 0.42);
            else K.backlight(dg, gg, w, h, 0.26, true);
            return spec({
              cutout: shape !== 'rect',
              backing: shape === 'oval' || shape === 'arch' || shape === 'deco' ? 'inset' : 'panel',
              backColor: K.shade(P.ground, 0.4),
              lamps: !P.backlit,
              light: P.backlit ? K.mix(P.ground, '#ffffff', 0.5) : '#ffe2b0',
              day: 0.1,
            });
          },
          /** Weathered planks: routed or painted letters, a rope border, emblems; floodlit. */
          wood(dg, gg, w, h, text, P) {
            const u = h / 100,
              shape = P.shape || 'rect';
            K.boardPath(dg, shape, 0, 0, w, h);
            K.fillBoard(dg, 'wood', 0, 0, w, h, P.plank, text);
            if (P.rope) K.rope(dg, (g) => K.boardPath(g, shape, 5 * u, 5 * u, w - 10 * u, h - 10 * u), 5 * u);
            else {
              K.boardPath(dg, shape, 2 * u, 2 * u, w - 4 * u, h - 4 * u);
              dg.lineWidth = 4 * u;
              dg.strokeStyle = K.shade(P.plank, 0.5);
              dg.stroke();
            }
            const box = emblems(dg, gg, w, h, P, 16 * u, paintedIcon(dg, { ...P, ink: P.iconColor || P.ink, ground: P.plank })),
              ls = linesOf(text, P),
              rs = rows(ls.length, 14 * u, P.sub ? h * 0.72 : h - 14 * u, P.ratio);
            ls.forEach((line, i) =>
              K.fxText(dg, line, box.cx, rs[i].cy, {
                font: P.font || 'serif',
                weight: P.weight || '700',
                size: rs[i].cap * 1.08,
                maxW: box.span,
                spacing: P.spacing ?? 0.08,
                fill: P.routed ? K.fade(K.shade(P.ink, 0.15), P.ink) : P.ink,
                // Routed letters: the cut shows a dark wall above, a lit edge below.
                shadow: P.routed ? [0, -2 * u, 'rgba(0,0,0,0.65)', 0] : [2 * u, 3 * u, 'rgba(0,0,0,0.5)', 1 * u],
                outline: P.outline ? [1.8 * u, P.outline] : null,
              }),
            );
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.83, { font: 'serif', weight: '700', size: h * 0.12, maxW: box.span * 0.7, spacing: 0.3, fill: P.ink });
            K.weather(dg, 0, 0, w, h, P.plank, 0.5, text);
            K.backlight(dg, gg, w, h, 0.24, true);
            return spec({ cutout: shape !== 'rect', backing: shape === 'rect' ? 'panel' : 'inset', backColor: K.shade(P.plank, 0.5), lamps: true, light: '#ffd9a0', day: 0.08 });
          },
          /**
           * Stencilled steel: bridged stencil capitals on painted or corrugated sheet,
           * rivets, hazard stripes, rust runs; industrial, military and warning signs.
           */
          stencil(dg, gg, w, h, text, P) {
            const u = h / 100;
            K.boardPath(dg, 'rect', 0, 0, w, h);
            K.fillBoard(dg, P.kind || 'matte', 0, 0, w, h, P.ground, text);
            let top = 12 * u,
              bottom = h - 12 * u;
            if (P.hazard === 'bottom') {
              K.hazard(dg, 0, h - 18 * u, w, 18 * u, P.hazardA, P.hazardB);
              bottom = h - 22 * u;
            } else if (P.hazard === 'border') {
              K.hazard(dg, 0, 0, w, 11 * u, P.hazardA, P.hazardB);
              K.hazard(dg, 0, h - 11 * u, w, 11 * u, P.hazardA, P.hazardB);
              top = 16 * u;
              bottom = h - 16 * u;
            }
            if (P.border) {
              dg.strokeStyle = P.border;
              dg.lineWidth = 4 * u;
              dg.strokeRect(5 * u, 5 * u, w - 10 * u, h - 10 * u);
            }
            if (P.rivets) K.rivets(dg, 0, 0, w, h, 2.4 * u, K.shade(P.ground, 0.1));
            const box = emblems(dg, gg, w, h, P, 16 * u, paintedIcon(dg, { ...P, ink: P.iconColor || P.ink, ground: P.iconColor2 || P.ground })),
              ls = linesOf(text, P),
              rs = rows(ls.length, top, P.sub ? h * 0.68 : bottom, P.ratio);
            ls.forEach((line, i) => {
              const run = K.strokeText(line, { cx: box.cx, cy: rs[i].cy, maxW: box.span, maxH: rs[i].cap, track: 0.34 }),
                t = run.size * (P.weight || 0.19);
              K.blockLetters(dg, P.stencil === false ? run.lines : K.stencilCut(run.lines, t * 0.55), t, { fill: P.ink, cap: 'butt', extrude: P.extrude ? [2 * u, 2.5 * u, P.extrude] : null });
            });
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.82, { font: 'mono', weight: '700', size: h * 0.13, maxW: box.span * 0.8, spacing: 0.2, fill: P.subInk || P.ink });
            if (P.rust) K.weather(dg, 0, 0, w, h, P.ground, P.rust, text);
            K.backlight(dg, gg, w, h, P.reflective ? 0.1 : 0.24, !P.reflective);
            return spec({ backColor: K.shade(P.ground, 0.4), lamps: !P.reflective, light: '#ffe2b0', day: 0.06 });
          },
          /**
           * Art Deco: contrast capitals (thick verticals, hairline horizontals), wide
           * tracking, gold rules and a sunburst fan; `mode` 'halo' backlights the
           * letters (a glow round each one), 'neon' runs a tube down every stroke.
           * Without a board the letters stand free on the roof.
           */
          deco(dg, gg, w, h, text, P) {
            const u = h / 100,
              cut = !P.board,
              shape = P.shape || 'rect';
            if (!cut) {
              K.boardPath(dg, shape, 0, 0, w, h);
              K.fillBoard(dg, 'glass', 0, 0, w, h, P.board, text);
              K.boardPath(dg, shape, 3 * u, 3 * u, w - 6 * u, h - 6 * u);
              dg.lineWidth = 2 * u;
              dg.strokeStyle = P.rimColor || K.mix(P.ink, P.board, 0.3);
              dg.stroke();
            }
            const top = shape === 'deco' ? 38 * u : P.rules ? 20 * u : 10 * u,
              bottom = P.rules ? h - 20 * u : h - 10 * u;
            if (P.fan) {
              const fx = w / 2,
                fy = bottom + 4 * u;
              dg.strokeStyle = P.fan;
              dg.lineWidth = 1.4 * u;
              for (let k = 0; k <= 16; k++) {
                const a = Math.PI + (k * Math.PI) / 16;
                dg.beginPath();
                dg.moveTo(fx + Math.cos(a) * h * 0.2, fy + Math.sin(a) * h * 0.2);
                dg.lineTo(fx + Math.cos(a) * h * 1.6, fy + Math.sin(a) * h * 0.9);
                dg.stroke();
              }
              if (cut) {
                // Free-standing: the fan is a lattice of rods behind the letters.
                dg.lineWidth = 2.2 * u;
                dg.beginPath();
                dg.ellipse(fx, fy, h * 1.6, h * 0.9, 0, Math.PI, FULL_TURN);
                dg.stroke();
              }
            }
            if (P.rules) {
              dg.fillStyle = P.ruleColor || P.ink;
              for (const y of [12 * u, 15 * u, h - 15 * u, h - 12 * u]) dg.fillRect(14 * u, y, w - 28 * u, 1.2 * u);
            }
            const box = emblems(dg, gg, w, h, P, 18 * u, (kind, x, y, s) => {
                K.icon(dg, kind, x, y, s * 0.8, P.ink, P.board || '#111');
                if (P.mode === 'neon') K.tubeIcon(dg, gg, kind, x, y, s * 0.8, P.glow, 2 * u);
              }),
              ls = linesOf(text, P),
              rs = rows(ls.length, top, bottom, P.ratio);
            ls.forEach((line, i) => {
              const run = K.strokeText(line, { cx: box.cx, cy: rs[i].cy, maxW: box.span, maxH: rs[i].cap, track: P.track ?? 0.42 }),
                thick = run.size * (P.thick || 0.17),
                thin = Math.max(1, run.size * 0.035),
                ink = (g) => {
                  const f = g.createLinearGradient(0, rs[i].cy - run.size / 2, 0, rs[i].cy + run.size / 2);
                  f.addColorStop(0, K.tint(P.ink, 0.45));
                  f.addColorStop(0.5, P.ink);
                  f.addColorStop(1, K.shade(P.ink, 0.25));
                  return f;
                };
              if (cut) {
                dg.save();
                dg.translate(1.5 * u, 2 * u);
                K.decoLetters(dg, run.lines, thin + 2 * u, thick + 2 * u, '#24272b');
                dg.restore();
              }
              K.decoLetters(dg, run.lines, thin, thick, ink(dg));
              if (P.mode === 'neon') K.tubes(dg, gg, run.lines, Math.max(1.5, run.size * 0.045), P.glow, { bare: true, electrodes: false, glass: K.tint(P.glow, 0.5) });
              else if (P.mode === 'halo') {
                gg.save();
                gg.shadowColor = P.glow;
                gg.shadowBlur = run.size * 0.35;
                K.decoLetters(gg, run.lines, thin + run.size * 0.06, thick + run.size * 0.06, K.rgba(P.glow, 0.9));
                gg.restore();
                K.decoLetters(gg, run.lines, thin, thick, '#000');
              } else K.decoLetters(gg, run.lines, thin, thick, K.rgba(K.tint(P.glow || P.ink, 0.3), 0.8));
            });
            if (P.sub) K.fxText(dg, P.sub, box.cx, h * 0.88, { font: 'futura', weight: '600', size: h * 0.08, maxW: box.span * 0.7, spacing: 0.5, fill: P.ink });
            return spec({ cutout: cut || shape !== 'rect', backing: cut ? 'raceway' : shape === 'rect' ? 'panel' : 'inset', backColor: cut ? '#24272b' : K.shade(P.board, 0.3), light: P.glow || P.ink });
          },
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
        };
        /**
         * THE STYLE TABLE: business -> [family, parameters]. docs/SOURCE_GUIDE.md
         * lists the styles; copy the nearest line for a new business.
         */
        const SIGN_DESIGNS = {
          // Nightlife
          AFTERHOURS: ['neonScript', { script: 'after hours', tube: '#ff4fb8', swash: '#3ff0ff', icon: 'moon', iconColor: '#3ff0ff', balance: false }],
          'NEON PALACE': ['neonBlock', { shape: 'deco', board: '#0c0714', tube: '#c77dff', accent: '#3ff0ff', inline: true, border: 'zigzag', crown: 'crown', crownColor: '#ffd23f' }],
          'THE BLUE HOUR': ['deco', { ink: '#dfe9f2', glow: '#5fd0ff', mode: 'neon', fan: '#8fb8c8', track: 0.5 }],
          'BLUE HOUR HOTEL': ['deco', { board: '#0d1a26', shape: 'deco', ink: '#e9d4a0', glow: '#9fdad8', mode: 'halo', rules: true, fan: '#6c7f86' }],
          COCKTAILS: ['neonScript', { script: 'cocktails', tube: '#ffc46b', icon: 'martini', iconColor: '#7df7ff', balance: false }],
          'PRIVATE LOUNGE': ['plaque', {}],
          ELEVATOR: ['plaque', { metal: '#a9b2b8' }],
          'P · RESERVED GLASS': ['plaque', { lines: ['RESERVED'] }],
          'GOLDEN TIDE': ['bulbs', { shape: 'arch', board: '#6b0f1a', body: '#e8b04a', bulb: '#fff0c0', rim: '#d8a948', rays: 'rgba(255,210,120,0.12)', icon: 'dice', icon2: true, iconColor: '#f4efe6', iconColor2: '#6b0f1a', iconSize: 0.46, iconDy: 0.12 }],
          'ROYAL CINEMA': ['cinema', { lines: ['ROYAL', 'CINEMA'] }],
          'BANDSHELL · LIVE TONIGHT': ['lightbox', { panel: '#fff6e0', ink: '#b3202a', font: 'black', lines: ['BANDSHELL'], sub: 'LIVE TONIGHT', icon: 'note', icon2: true, iconColor: '#b3202a', checker: '#b3202a' }],
          // Pubs, diners, grills
          'THE RUSTY ANCHOR': ['wood', { plank: '#6b4a2e', ink: '#f0e2c0', rope: true, icon: 'anchor', icon2: true, iconColor: '#d9c9a0', lines: ['The', 'RUSTY ANCHOR'], ratio: [0.55, 1], font: 'times', sub: null }],
          'BAYVIEW TAVERN': ['enamel', { shape: 'oval', ground: '#12402c', ink: '#e7c46a', rim: '#e7c46a', font: 'times', gilt: true, subAbove: 'EST. 1961', sub: 'ALES · SPIRITS · FOOD', lines: ['BAYVIEW TAVERN'] }],
          'THE BLUE PLATE DINER': ['diner', { panel: '#b3202a', script: 'Blue Plate', block: 'DINER', tube: '#8fd8ff', icon: 'cup' }],
          'ROSIE’S DINER': ['diner', { panel: '#1d6f8a', script: 'Rosie’s', block: 'DINER', tube: '#ff7ab8', icon: 'cup' }],
          'PALM GRILL · 24 HOURS': ['lightbox', { panel: '#ffd23a', ink: '#c8102e', font: 'black', skew: 0.18, outline: '#3a1a00', lines: ['PALM GRILL'], icon: 'palm', iconColor: '#1e7a3c', iconColor2: '#6b3a12', tab: 'OPEN 24 HRS', tabColor: '#c8102e', tabInk: '#fff4c0', shape: 'pill', balance: false }],
          // Health, learning, law
          'SAINT MARLOW HOSPITAL': ['lightbox', { panel: '#f4f6f5', ink: '#123a6b', band: '#123a6b', icon: 'cross', iconColor: '#d42a2a', iconBox: '#ffffff', font: 'sans', weight: '700', lines: ['SAINT MARLOW', 'HOSPITAL'], ratio: [1.25, 1] }],
          'RIVERSIDE MEDICAL': ['lightbox', { panel: '#f4f6f5', ink: '#0f4f4a', band: '#0f7a6e', icon: 'cross', iconColor: '#ffffff', font: 'sans', weight: '700', lines: ['RIVERSIDE', 'MEDICAL CENTER'], ratio: [1.25, 1] }],
          'EMERGENCY · 24H': ['lightbox', { panel: '#c8102e', ink: '#ffffff', font: 'black', weight: '900', icon: 'cross', iconColor: '#ffffff', lines: ['EMERGENCY'], tab: '24H', tabColor: '#ffffff', tabInk: '#c8102e' }],
          'SOUTH COAST COLLEGE': ['carved', { ground: '#5a1622', kind: 'enamel', icon: 'shield', icon2: true, iconColor: '#d9ae55', iconColor2: '#5a1622', font: 'times', spacing: 0.16, lines: ['SOUTH COAST', 'COLLEGE'], ratio: [0.8, 1.1], sub: 'EST. MCMXXIV' }],
          'RIVERSIDE HIGH SCHOOL': ['varsity', { ground: '#1d3f8f', fill: '#ffd23a', outline: '#ffffff', shadow: '#0a1a3a', icon: 'star', icon2: true, iconColor: '#ffd23a', lines: ['RIVERSIDE', 'HIGH SCHOOL'], ratio: [1.4, 0.9], arc: 6 }],
          'SOUTH COAST POLICE': ['enamel', { ground: '#0e2244', ink: '#ffffff', rim: '#d4af37', icon: 'badge', icon2: true, iconColor: '#d4af37', iconColor2: '#0e2244', font: 'times', spacing: 0.12, backlit: true, sub: 'DEPARTMENT · DISTRICT 1' }],
          // Guns and surplus
          'SOUTH COAST ARMORY': ['stencil', { ground: '#4b5320', kind: 'steel', ink: '#ece5c8', lines: ['SOUTH COAST', 'ARMORY'], ratio: [0.75, 1.25], icon: 'target', icon2: 'pistols', iconColor: '#ece5c8', iconColor2: '#b3202a', rivets: true, rust: 0.6, hazard: 'bottom' }],
          'PALM KEYS ARMORY': ['stencil', { ground: '#3d4a2a', ink: '#f2c21b', icon: 'pistols', icon2: 'target', iconColor: '#f2c21b', iconColor2: '#3d4a2a', rivets: true, rust: 0.4 }],
          'SENTINEL SURPLUS': ['stencil', { ground: '#6b6a4a', kind: 'steel', ink: '#1d1d1d', icon: 'star', icon2: true, iconColor: '#1d1d1d', rivets: true, rust: 0.5, sub: 'ARMY · NAVY · GEAR' }],
          'WEAPONS · AMMO · ARMOR': ['stencil', { ground: '#f2c21b', ink: '#141414', hazard: 'border', border: null, stencil: true }],
          // Garages and cars
          // The respray garages (garages.js): every billboard says MECHANICS.
          'EASTSIDE GARAGE': ['customs', { sub: 'MECHANICS · RESPRAY · REPAIR' }],
          'PALM KEYS AUTO': ['airbrush', { grad: ['#ff7ac0', '#ff9a5a', '#27c6c0'], icon: 'spray', iconColor: '#ffffff', iconColor2: '#1b2a4a', palms: false, lines: ['PALM KEYS AUTO'], sub: 'MECHANICS · RESPRAYS WHILE YOU WAIT', outline: '#2a1a4a' }],
          'SOUTH BANK MOTOR WORKS': ['enamel', { ground: '#1d3b7a', ink: '#d8261c', innerInk: '#d8261c', inner: '#f2efe6', rim: '#f2efe6', font: 'slab', weight: '900', lines: ['SOUTH BANK', 'MOTOR WORKS'], ratio: [0.7, 1], icon: 'piston', icon2: true, iconColor: '#f2efe6', iconColor2: '#1d3b7a', backlit: false, sub: 'MECHANICS · BODYWORK · PAINT', subInk: '#1d3b7a' }],
          'STONECREEK GARAGE': ['painted', { ground: '#7a2e22', ink: '#f0e6c8', icon: 'tyre', icon2: 'wrench', iconColor: '#f0e6c8', iconColor2: '#7a2e22', font: 'slab', sub: 'MECHANICS · TOWING · TYRES' }],
          // The lightbox over each garage's office door.
          MECHANICS: ['lightbox', { panel: '#1e2327', ink: '#ffd200', icon: 'wrench', icon2: true, iconColor: '#ffd200', font: 'sans', weight: '800', spacing: 0.22 }],
          // Rooms
          'SUNSET MOTEL': ['neonScript', { board: '#1f8a8c', shape: 'boomerang', rim: '#f4efe2', script: 'Sunset', block: 'MOTEL', tube: '#ff8a3d', blockTube: '#ff3b5c', painted: 'sunset', paintedColor: '#ffb347', flicker: true }],
          'CORAL PALMS MOTEL': ['neonScript', { board: '#f29c8f', shape: 'round', rim: '#fff4e6', script: 'Coral Palms', block: 'MOTEL', tube: '#19d3c5', blockTube: '#1a5fd0', icon: 'palm', iconColor: '#2fe07a', iconFill: '#1f7a52', flicker: true, balance: false }],
          'SAFEHOUSE · ROOMS': ['hand', { ground: '#d9d0b8', ink: '#6e1f1f', lines: ['ROOMS'] }],
          'CAUSEWAY INN': ['enamel', { ground: '#0f3550', ink: '#f4e7c5', rim: '#f4e7c5', icon: 'helm', icon2: true, iconColor: '#f4e7c5', font: 'times', shape: 'round', sub: 'ROOMS · BAR · BAIT' }],
          // Clothes
          'SOUTH COAST OUTFITTERS': ['enamel', { ground: '#cdbb8a', kind: 'matte', ink: '#1f4a2c', rim: '#1f4a2c', font: 'slab', weight: '900', icon: 'mountain', iconColor: '#1f4a2c', iconColor2: '#f2ecd8', sub: 'SUPPLY CO. · SINCE 1952' }],
          'OCEAN DRIVE MENSWEAR': ['deco', { board: '#0a0a0c', ink: '#d9b25a', glow: '#ffd98a', mode: 'halo', rules: true, ruleColor: '#8a6d34', lines: ['OCEAN DRIVE', 'MENSWEAR'], ratio: [1.25, 1], track: 0.55 }],
          // Civic, transport, industry
          MARINA: ['enamel', { ground: '#f4f1e8', ink: '#0e2c57', rim: '#0e2c57', icon: 'helm', icon2: 'anchor', iconColor: '#0e2c57', font: 'times', spacing: 0.3 }],
          HELIPAD: ['lightbox', { panel: '#1c1c1c', ink: '#ffd200', icon: 'plane', iconColor: '#ffd200', font: 'sans', spacing: 0.25 }],
          'SOUTHPORT INTERNATIONAL': ['lightbox', { panel: '#1e2327', ink: '#ffffff', band: '#ffd200', icon: 'plane', iconColor: '#1e2327', font: 'sans', weight: '700', lines: ['SOUTHPORT', 'INTERNATIONAL AIRPORT'], ratio: [1.3, 1] }],
          'OCEANVIEW INTERNATIONAL': ['lightbox', { panel: '#1e2327', ink: '#ffffff', band: '#ffd200', icon: 'plane', iconColor: '#1e2327', font: 'sans', weight: '700', lines: ['OCEANVIEW', 'INTERNATIONAL AIRPORT'], ratio: [1.3, 1] }],
          'DEPARTURES / ARRIVALS': ['lightbox', { panel: '#ffd200', ink: '#16181a', icon: 'plane', icon2: true, iconColor: '#16181a', font: 'sans', weight: '700', lines: ['DEPARTURES  ·  ARRIVALS'] }],
          'IRONWORKS CARGO': ['stencil', { ground: '#2f5d8a', kind: 'steel', ink: '#f2f2ea', rust: 1, icon: 'ship', iconColor: '#f2f2ea', iconColor2: '#c4121a', sub: 'CONTAINER · BULK · BONDED' }],
          'MORETTI FREIGHT': ['stencil', { ground: '#8a2f22', kind: 'steel', ink: '#f2e6c8', rust: 1.2, sub: 'EST. 1958 · BAYFRONT' }],
          'FREIGHT CO.': ['painted', { ground: '#39463a', ink: '#e8dfc2', lines: ['SOUTH COAST FREIGHT CO.'], sub: 'HAULAGE · STORAGE', age: 1.5 }],
          'RESTRICTED · KEEP CLEAR': ['stencil', { ground: '#f4f4ee', ink: '#b3202a', icon: 'warn', iconColor: '#f2c21b', iconColor2: '#141414', lines: ['RESTRICTED'], sub: 'KEEP CLEAR · NO ENTRY', subInk: '#141414', border: '#b3202a', stencil: false, weight: 0.16, reflective: true }],
          'SOUTH COAST STADIUM': ['varsity', { ground: '#10213f', fill: '#ff7a1a', outline: '#ffffff', icon: 'ball', icon2: true, iconColor: '#ffffff', iconColor2: '#10213f', slant: 0.12, backlit: true, stripe: '#ff7a1a' }],
          TICKETS: ['pixel', { ink: '#ffb020', accent: '#ff7a1a' }],
          '24 HOUR': ['lightbox', { panel: '#ffffff', ink: '#1f8a4c', font: 'black', weight: '900', stripes: ['#f47b20', '#1f8a4c', '#d7262e'], lines: ['24 HOUR STORE'], outline: null }],
          'EXCHANGE UNDERPASS': ['highway', { arrow: 'up' }],
          'ROAD UNDERPASS': ['highway', { arrow: 'up' }],
          'OCEANVIEW / AIRPORT': ['highway', { icon: 'plane', arrow: 'right' }],
          'EAGLE PASS · SCENIC ROUTE': ['highway', { ground: '#6b3f1f', icon: 'mountain' }],
          'CORAL COAST': ['enamel', { ground: '#f2ccae', ink: '#1f5f63', rim: '#1f5f63', font: 'times', subAbove: 'WELCOME TO THE', icon: 'palm', icon2: true, iconColor: '#1f5f63', shape: 'round' }],
          // The park
          'CENTRAL GARDEN': ['wood', { plank: '#4a3522', ink: '#efe0b8', routed: true, icon: 'leaf', icon2: true, iconColor: '#9fca7a', font: 'times', sub: 'CITY PARKS · OPEN DAWN TO DUSK' }],
          'OUTDOOR GYM': ['wood', { plank: '#4a3522', ink: '#efe0b8', routed: true, icon: 'dumbbell', iconColor: '#efe0b8', font: 'sans' }],
          'GARDEN LAKE · BOATHOUSE': ['wood', { plank: '#3f5a6a', ink: '#f4f1e8', icon: 'helm', iconColor: '#f4f1e8', font: 'times', lines: ['BOATHOUSE'], sub: 'GARDEN LAKE · ROWBOATS' }],
          // Sunset Pier
          'THE FALCON': ['varsity', { ground: '#1b1f5c', fill: '#ffcf3a', outline: '#ff4a3a', shadow: '#0a0a2a', icon: 'wing', iconColor: '#ffcf3a', slant: 0.25, backlit: true }],
          'SUNSET EYE': ['bulbs', { board: '#12324f', body: '#5fb8e8', bulb: '#e8fbff', rim: '#9fe6ff', icon: 'sun', icon2: true, iconColor: '#ffcf5a' }],
          'SUNSET PALACE': ['deco', { board: '#3b1f4a', shape: 'deco', ink: '#f3cf7a', glow: '#ff9fd8', mode: 'neon', fan: '#8a6aa0', rules: true }],
          'SUNSET PIER': ['bulbs', { shape: 'scallop', board: '#c8102e', body: '#ffd23a', bulb: '#fff6d0', rim: '#ffffff', rays: 'rgba(255,255,255,0.22)', bounce: 0.08, icon: 'star', icon2: true, iconColor: '#ffffff' }],
          'FREE FALL': ['neonBlock', { board: '#0a0a0a', tube: '#ff3b2e', accent: '#ffd23f', slant: 0.12, icon: 'bolt', icon2: true, iconColor: '#ffd23f' }],
          'WADI SPLASH': ['arabian', { board: '#0f6a86', glow: '#7df7ff' }],
          'ARABIAN NIGHTS': ['arabian', { board: '#3a1452', glow: '#ffd23f' }],
          DODGEMS: ['bulbs', { shape: 'scallop', board: '#161616', body: '#ff4fa0', body2: '#4ff0ff', bulb: '#fff0f8', rim: '#ffd23a', bounce: 0.1, icon: 'car', icon2: true, iconColor: '#4ff0ff', iconColor2: '#161616' }],
          // Monarch Isle (monarch3d.js): the island's houses, one design each.
          'MAISON VERAUD': ['deco', { board: '#0a0a0c', ink: '#eadfc6', glow: '#fff1d6', mode: 'halo', rules: true, ruleColor: '#8a7a5a', track: 0.62 }],
          'HALDEN & FROST': ['carved', { ground: '#0f3b36', kind: 'enamel', icon: 'star', icon2: true, iconColor: '#e2c67a', font: 'palatino', ink: '#e2c67a', spacing: 0.14, sub: 'FINE JEWELLERS · EST. 1899' }],
          VALMONT: ['deco', { board: '#10192b', ink: '#d8e2ee', glow: '#cfe4ff', mode: 'halo', rules: true, ruleColor: '#6b7a90', track: 0.8, lines: ['VALMONT'], ratio: [1] }],
          'SAVILLE & CROWN': ['carved', { ground: '#1b2230', icon: 'scissors', iconColor: '#e8dcc0', font: 'palatino', ink: '#e8dcc0', sub: 'BESPOKE TAILORS' }],
          'FLEUR DE LYS': ['neonScript', { board: '#eef3e6', boardKind: 'enamel', rim: '#355a3a', script: 'Fleur de Lys', tube: '#ff6fa8', icon: 'flower', iconColor: '#ffd23f', iconFill: '#ff8ac0', backer: '#c8d2bc' }],
          'CROWN PRIVATE BANK': ['carved', { ground: '#10202e', icon: 'crown', icon2: true, iconColor: '#d9ae55', font: 'times', ink: '#e7cf8e', spacing: 0.18, lines: ['CROWN', 'PRIVATE BANK'], ratio: [1.1, 0.8] }],
          'AURELIE PARIS': ['deco', { board: '#efe9dd', ink: '#1a1a1a', glow: '#fff4e0', mode: 'halo', rules: true, ruleColor: '#b39a6a', track: 0.55, lines: ['AURELIE', 'PARIS'], ratio: [1.3, 0.7] }],
          'ORO & PERLA': ['carved', { ground: '#3a1f28', kind: 'enamel', icon: 'heart', icon2: true, iconColor: '#e6c886', font: 'palatino', ink: '#f0dcae', sub: 'GIOIELLI' }],
          'THE PROVISIONER': ['enamel', { ground: '#1f3d2c', ink: '#efe2b8', rim: '#c7a45a', font: 'times', spacing: 0.12, icon: 'wheat', icon2: true, iconColor: '#e2c26a', subAbove: 'THE', lines: ['PROVISIONER'], sub: 'FINE FOODS · CHEESE · WINE' }],
          'CAFÉ ROYALE': ['neonScript', { board: '#2b1a12', boardKind: 'enamel', script: 'Café Royale', tube: '#ffd08a', icon: 'cup', iconColor: '#ffb070', backer: '#3d2a1e' }],
          'VINTAGE & VINE': ['wood', { plank: '#4a1420', ink: '#f2dca8', routed: true, icon: 'martini', icon2: true, iconColor: '#e6c886', font: 'times', sub: 'WINE BAR · CELLAR' }],
          'GALERIE MONARCH': ['lightbox', { panel: '#f6f4ee', ink: '#141414', font: 'futura', weight: '500', spacing: 0.35, band: null, lines: ['GALERIE MONARCH'] }],
          'THE HALCYON CLINIC': ['lightbox', { panel: '#f4f6f5', ink: '#0f4f4a', band: '#0f7a6e', icon: 'cross', iconColor: '#ffffff', font: 'sans', weight: '600', lines: ['THE HALCYON', 'PRIVATE CLINIC'], ratio: [1.2, 0.9] }],
          'AQUA SERENA SPA': ['neonScript', { board: '#e8f2f0', boardKind: 'enamel', rim: '#1f5f63', script: 'Aqua Serena', tube: '#3fd8d0', block: 'SPA', blockTube: '#1f7a8a', icon: 'leaf', iconColor: '#3fd8a0', iconFill: '#1f7a52', backer: '#c8d8d4' }],
          'L’ÉTOILE': ['deco', { board: '#0c0c10', ink: '#e8d6a8', glow: '#ffe8b8', mode: 'neon', fan: '#6b5a3a', rules: true, track: 0.5, lines: ['L’ÉTOILE'] }],
          'THE REGENT HOTEL': ['deco', { board: '#1b2638', shape: 'deco', ink: '#ecd9a6', glow: '#ffe2a8', mode: 'halo', rules: true, fan: '#6b7a8a', lines: ['THE REGENT', 'HOTEL'], ratio: [1.2, 0.7] }],
          'MONARCH AUTOMOBILI': ['lightbox', { panel: '#111316', ink: '#f2f2ee', font: 'futura', weight: '800', spacing: 0.3, band: '#c8102e', bandSide: 'bottom', icon: 'car', iconColor: '#c8102e', lines: ['MONARCH AUTOMOBILI'] }],
          SOLARIS: ['lightbox', { panel: '#0e2a3a', ink: '#ffffff', font: 'sans', weight: '800', icon: 'sun', iconColor: '#ffc22a', stripes: ['#ffc22a', '#1fa0d0'], lines: ['SOLARIS'], sub: 'PREMIUM FUEL · EV', subInk: '#ffc22a' }],
          'THE OYSTER ROOM': ['enamel', { ground: '#12324a', ink: '#f3ead2', rim: '#c9a45a', font: 'times', shape: 'oval', gilt: true, icon: 'fish', icon2: true, iconColor: '#f3ead2', subAbove: 'THE', lines: ['OYSTER ROOM'], sub: 'SEAFOOD · CHAMPAGNE' }],
          'GELATERIA DOLCE': ['neonScript', { board: '#f4d9e0', boardKind: 'enamel', rim: '#c47a8a', script: 'Dolce', block: 'GELATERIA', tube: '#ff6fa8', blockTube: '#4fb8ff', icon: 'heart', iconColor: '#ff6fa8', iconFill: '#ffc0d0', backer: '#e8c8d0' }],
          'OCEANIS YACHTS': ['enamel', { ground: '#0e2c57', ink: '#f4f1e8', rim: '#f4f1e8', font: 'sans', weight: '700', spacing: 0.3, icon: 'helm', icon2: true, iconColor: '#f4f1e8', sub: 'BROKERAGE · CHARTER' }],
          'MARINE CHANDLERY': ['wood', { plank: '#1d3f6e', ink: '#ffffff', rope: true, icon: 'anchor', icon2: true, iconColor: '#ffffff', font: 'slab', lines: ['MARINE', 'CHANDLERY'] }],
          'CHAMPAGNE BAR': ['neonScript', { board: '#101012', script: 'Champagne', block: 'BAR', tube: '#ffe08a', blockTube: '#ffffff', icon: 'martini', iconColor: '#ffe08a', balance: false }],
          'BOUTIQUE RIVA': ['deco', { board: '#f3efe6', ink: '#1d3f6e', glow: '#d8e8ff', mode: 'halo', rules: true, ruleColor: '#1d3f6e', track: 0.5, lines: ['BOUTIQUE RIVA'] }],
          'MONARCH ACADEMY': ['carved', { ground: '#1d3a2a', kind: 'enamel', icon: 'shield', icon2: true, iconColor: '#d9ae55', iconColor2: '#1d3a2a', font: 'times', spacing: 0.16, lines: ['MONARCH', 'ACADEMY'], ratio: [0.9, 1], sub: 'FOUNDED MDCCCLXXII' }],
          'POLICE · MONARCH ISLE': ['enamel', { ground: '#0e2244', ink: '#ffffff', rim: '#d4af37', icon: 'badge', icon2: true, iconColor: '#d4af37', iconColor2: '#0e2244', font: 'times', spacing: 0.12, backlit: true, lines: ['POLICE'], sub: 'MONARCH ISLE STATION' }],
          'MONARCH COUNTRY CLUB': ['carved', { ground: '#1f3d2c', kind: 'enamel', icon: 'crown', icon2: true, iconColor: '#e2c67a', font: 'times', ink: '#efe2b8', spacing: 0.14, lines: ['MONARCH', 'COUNTRY CLUB'], ratio: [1, 0.8], sub: 'MEMBERS ONLY' }],
          'MONARCH YACHT CLUB': ['enamel', { ground: '#f4f1e8', ink: '#0e2c57', rim: '#0e2c57', icon: 'helm', icon2: 'anchor', iconColor: '#0e2c57', font: 'times', spacing: 0.2, lines: ['MONARCH', 'YACHT CLUB'], ratio: [1, 0.8] }],
          'ST ALDRIC’S CHAPEL': ['carved', { ground: '#2a2530', kind: 'stone', icon: 'star', iconColor: '#e2c67a', font: 'times', ink: '#efe2b8', lines: ['ST ALDRIC’S'], sub: 'CHAPEL · EVENSONG 6 PM' }],
          'ROYAL BOTANIC GARDEN': ['wood', { plank: '#2f4a2a', ink: '#f1e6c2', routed: true, icon: 'leaf', icon2: true, iconColor: '#a8d07a', font: 'times', lines: ['ROYAL BOTANIC', 'GARDEN'], ratio: [0.9, 1], sub: 'THE PALM HOUSE · OPEN DAILY' }],
          'HARBOUR MASTER': ['enamel', { ground: '#12325a', ink: '#ffffff', rim: '#ffffff', icon: 'ship', iconColor: '#ffffff', font: 'sans', weight: '700', spacing: 0.2, lines: ['HARBOUR MASTER'] }],
          // Shops (the shopfront atlas)
          LAUNDROMAT: ['lightbox', { panel: '#dff3ff', ink: '#1b4f9c', font: 'futura', weight: '800', icon: 'bubbles', iconColor: '#1b8fd0', band: null, stripes: ['#1b4f9c'] }],
          'PAWN & LOAN': ['carved', { ground: '#141414', icon: 'balls', iconColor: '#d9ae55', iconColor2: '#8a6d34', font: 'times' }],
          'BODEGA 24H': ['lightbox', { panel: '#fff7e0', ink: '#d7262e', font: 'black', weight: '900', stripes: ['#ffd23a', '#1f8a4c'], lines: ['BODEGA'], tab: '24H', tabColor: '#1f8a4c' }],
          'VINYL VAULT': ['neonScript', { board: '#15151b', boardKind: 'glass', script: 'Vinyl Vault', tube: '#ffd23f', icon: 'record', iconColor: '#ff4fa0', iconFill: '#0a0a0a', backer: '#2a2a33' }],
          'INK & IRON TATTOO': ['tattoo', {}],
          'CUTS BARBER': ['neonScript', { board: '#f4efe6', boardKind: 'enamel', rim: '#1b3f8a', script: 'Cuts', block: 'BARBER', tube: '#e0283a', blockTube: '#1b5fd0', icon: 'pole', icon2: true, iconFill: '#f4f1ea', iconColor: '#e0283a', backer: '#c9c2b4' }],
          'GOLDEN NOODLE': ['lightbox', { panel: '#b3141d', ink: '#ffd24a', font: 'serif', weight: '900', outline: '#5a0a0e', icon: 'bowl', icon2: true, iconColor: '#ffd24a', iconColor2: '#ffffff', shadow: '#5a0a0e' }],
          LIQUOR: ['neonBlock', { board: '#101012', tube: '#ff3048', accent: '#4ff0ff', border: 'rect', track: 0.45, icon: 'martini', iconColor: '#4ff0ff' }],
          'SLICE PIZZA': ['lightbox', { panel: '#fff6e8', ink: '#b3202a', font: 'black', weight: '900', skew: 0.2, outline: '#ffffff', shadow: '#1f7a3c', icon: 'pizza', iconColor: '#f2b640', iconColor2: '#b3702a', stripes: ['#1f8a4c', '#ffffff', '#c8102e'], stripesTop: true, lines: ['SLICE'] }],
          'CORNER PHARMACY': ['lightbox', { panel: '#ffffff', ink: '#1f7a3c', font: 'sans', weight: '700', icon: 'cross', iconColor: '#1fa04c', lines: ['PHARMACY'], sub: 'CORNER · RX · 24H', subInk: '#1f7a3c' }],
          'BAIL BONDS': ['lightbox', { panel: '#ffd400', ink: '#111111', font: 'impact', weight: '900', condense: 0.85, sub: 'FAST · 24/7 · CALL NOW', lines: ['BAIL BONDS'] }],
          'VIDEO WORLD': ['airbrush', { grad: ['#2a0a5a', '#5a2ad0', '#0a0a2a'], chrome: true, outline: '#ff2ad0', icon: 'tape', iconColor: '#e0e0ff', iconColor2: '#2a0a5a', sun: false, grid: '#ff4ad0' }],
          'CAFÉ MARLOW': ['neonScript', { board: '#2b1a12', boardKind: 'enamel', script: 'Café Marlow', tube: '#ffcf8a', icon: 'cup', iconColor: '#ff9a5a', backer: '#3d2a1e' }],
          'DRY CLEANER': ['lightbox', { panel: '#1b4f9c', ink: '#ffffff', font: 'sans', weight: '800', icon: 'hanger', iconColor: '#ffffff', sub: 'SAME DAY · ALTERATIONS' }],
          HARDWARE: ['painted', { ground: '#b3202a', ink: '#ffffff', icon: 'wrench', iconColor: '#ffffff', font: 'slab', age: 0.6 }],
          'CHECK CASHING': ['lightbox', { panel: '#0f7a3c', ink: '#ffffff', font: 'impact', weight: '900', condense: 0.88, icon: 'star', iconColor: '#ffd23a', sub: 'PAYDAY · MONEY ORDERS', subInk: '#ffd23a' }],
          BAKERY: ['enamel', { ground: '#f6d9e0', ink: '#8a3a52', rim: '#8a3a52', font: 'serif', shape: 'round', icon: 'wheat', icon2: true, iconColor: '#c98a3a', sub: 'FRESH EVERY MORNING' }],
          DELI: ['enamel', { ground: '#f2e8d0', ink: '#1d4f2a', rim: '#b3202a', font: 'slab', weight: '900', spacing: 0.4, sub: 'SUBS · COLD CUTS · BEER' }],
          FLOWERS: ['neonScript', { board: '#e8f0dc', boardKind: 'enamel', rim: '#5a8a4a', script: 'flowers', tube: '#ff5aa5', icon: 'flower', iconColor: '#ffd23f', iconFill: '#ff8ac0', backer: '#c8d2bc' }],
          TAILOR: ['carved', { ground: '#1b2230', icon: 'scissors', iconColor: '#e8dcc0', font: 'palatino', ink: '#e8dcc0', sub: 'BESPOKE · ALTERATIONS' }],
          ARCADE: ['pixel', { ink: '#ff4fd8', accent: '#4ff0ff', icon: 'joystick' }],
          THRIFT: ['hand', { ground: '#f2e6c8', ink: '#2f6b5e' }],
          BOOKS: ['carved', { ground: '#233b2c', kind: 'enamel', icon: 'book', icon2: true, iconColor: '#d9ae55', font: 'palatino' }],
          BOTÁNICA: ['enamel', { ground: '#4a1f5c', ink: '#f2c84a', rim: '#f2c84a', font: 'serif', icon: 'leaf', icon2: 'star', iconColor: '#9fca7a', backlit: true }],
          'SEAFOOD MARKET': ['wood', { plank: '#2f5f7a', ink: '#ffffff', rope: true, icon: 'fish', icon2: true, iconColor: '#ffffff', font: 'slab', lines: ['SEAFOOD', 'MARKET'] }],
          CIGARS: ['carved', { ground: '#3b2415', kind: 'wood', icon: 'cigar', icon2: true, iconColor: '#e8c170', iconColor2: '#b3202a', font: 'palatino', sub: 'HAND ROLLED' }],
          'PAWN SHOP': ['neonBlock', { board: '#101010', tube: '#ffd23f', accent: '#ff3048', icon: 'balls', iconColor: '#ffd23f', lines: ['PAWN'], track: 0.5 }],
          FURNITURE: ['lightbox', { panel: '#f2f2ee', ink: '#333333', font: 'futura', weight: '500', spacing: 0.3, band: '#c99a2e', bandSide: 'bottom' }],
          GYM: ['varsity', { ground: '#111111', fill: '#e02d2d', outline: '#ffffff', icon: 'dumbbell', icon2: true, iconColor: '#ffffff', backlit: true, lines: ['IRON GYM'] }],
          'SHOE REPAIR': ['painted', { ground: '#2c3e50', ink: '#f0e0b0', font: 'serif', age: 0.8, sub: 'KEYS CUT · WHILE-U-WAIT' }],
          'PHOTO 1HR': ['lightbox', { panel: '#ffd200', ink: '#d7262e', font: 'black', weight: '900', icon: 'camera', iconColor: '#d7262e', iconColor2: '#ffffff', lines: ['PHOTO'], tab: '1 HOUR', tabColor: '#d7262e', tabInk: '#ffd200' }],
        };
        /**
         * The design for a name: the table, then trade keywords (a county lodge, an
         * outfitter, a motel...), then the caller's hint, then painted enamel in the
         * sign's own colour.
         */
        function designFor(text, color, hint) {
          if (SIGN_DESIGNS[text]) return SIGN_DESIGNS[text];
          const t = text.toUpperCase();
          if (hint === 'transit' || /^M · /.test(t)) return ['enamel', { ground: '#12325a', ink: '#ffffff', icon: 'm', iconColor: '#d7262e', iconColor2: '#ffffff', font: 'sans', weight: '700', spacing: 0.08, backlit: true, lines: [t.replace(/^M · /, '')] }];
          if (hint === 'kiosk') return ['hand', { ground: color, ink: '#1a3a5a', font: 'black', icon: 'sun', iconColor: '#ff7a1a' }];
          if (hint === 'truck') return ['hand', { ground: '#fff4d6', ink: '#b3202a', icon: t === 'TACOS' ? 'taco' : t === 'COFFEE' ? 'cup' : 'bowl', iconColor: '#b3202a' }];
          if (hint === 'trail' || /TRAIL$/.test(t)) return ['wood', { plank: '#5b3b1f', ink: '#f2e3b3', routed: true, icon: 'mountain', iconColor: '#f2e3b3', iconColor2: '#5b3b1f', font: 'times', sub: 'COUNTY PARKS' }];
          if (hint === 'town') return ['enamel', { ground: '#f4efe0', ink: '#1f4a3a', rim: '#1f4a3a', font: 'times', subAbove: 'WELCOME TO', sub: 'DRIVE CAREFULLY', icon: 'tree', icon2: true, iconColor: '#2f6b4a' }];
          if (hint === 'resort') return ['enamel', { ground: '#f6d6d0', ink: '#1f5f63', rim: '#1f5f63', font: 'times', subAbove: 'WELCOME TO', icon: 'palm', icon2: true, iconColor: '#1f5f63', shape: 'round' }];
          if (/LODGE$/.test(t)) return ['wood', { plank: '#5a3a22', ink: '#f3d9a4', routed: true, icon: 'tree', icon2: true, iconColor: '#9fca7a', iconColor2: '#3a2616', font: 'times', sub: 'ROOMS · CABINS' }];
          if (/OUTFITTERS$/.test(t)) return ['enamel', { ground: '#cdbb8a', kind: 'matte', ink: '#1f4a2c', rim: '#1f4a2c', font: 'slab', weight: '900', icon: 'mountain', iconColor: '#1f4a2c', iconColor2: '#f2ecd8' }];
          if (/ARMORY|GUNS|SURPLUS/.test(t)) return ['stencil', { ground: '#4b5320', ink: '#ece5c8', icon: 'target', iconColor: '#ece5c8', iconColor2: '#b3202a', rivets: true, rust: 0.5 }];
          if (/MOTEL/.test(t)) return ['neonScript', { board: '#1f6f8a', script: t.replace(/ ?MOTEL/, '').toLowerCase() || 'motel', block: 'MOTEL', tube: '#ff8a3d', blockTube: '#ff3b5c', flicker: true }];
          if (/INN$|HOTEL/.test(t)) return ['enamel', { ground: '#0f3550', ink: '#f4e7c5', rim: '#f4e7c5', font: 'times', shape: 'round', icon: 'star', iconColor: '#f4e7c5' }];
          if (/DINER|GRILL/.test(t)) return ['diner', { panel: '#b3202a', script: t.replace(/ ?(DINER|GRILL).*/, '').toLowerCase(), block: 'DINER', tube: '#8fd8ff' }];
          if (/GARAGE|MOTOR|AUTO|CUSTOMS|MECHANIC/.test(t)) return ['painted', { ground: color ? SignKit.shade(color, 0.55) : '#39463a', ink: '#f0e6c8', icon: 'wrench', iconColor: '#f0e6c8', font: 'slab' }];
          if (/HOSPITAL|MEDICAL|CLINIC/.test(t)) return ['lightbox', { panel: '#f4f6f5', ink: '#123a6b', band: '#123a6b', icon: 'cross', iconColor: '#d42a2a', iconBox: '#ffffff' }];
          if (/BANK|TRUST|CAPITAL|EXCHANGE/.test(t)) return ['carved', { ground: '#10202e', font: 'times' }];
          if (/CLUB|LOUNGE|BAR$/.test(t)) return ['neonScript', { script: t.toLowerCase(), tube: color || '#ff4fb8' }];
          if (/FREIGHT|CARGO|DEPOT|WAREHOUSE/.test(t)) return ['stencil', { ground: '#5a6a72', kind: 'steel', ink: '#f2f2ea', rust: 0.8 }];
          if (/STATION|TERMINAL|AIRPORT/.test(t)) return ['lightbox', { panel: '#1e2327', ink: '#ffffff', icon: 'plane', iconColor: '#ffd200' }];
          // Painted enamel in the caller's colour.
          const ground = SignKit.mix(color || '#bcd4cf', '#10181c', 0.82);
          return ['enamel', { ground, ink: color || '#f2e6c8', rim: SignKit.mix(color || '#f2e6c8', ground, 0.35), font: 'sans', weight: '700', spacing: 0.1, backlit: true }];
        }
        /**
         * Paints `text` into (dg, gg), a w x h box. `opaque` fills a fascia behind
         * shaped boards first (atlas cells cannot be cut out). Returns the spec.
         */
        function paint(dg, gg, w, h, text, color, hint, opaque = false) {
          const [family, P] = designFor(text, color, hint);
          if (opaque) {
            dg.fillStyle = '#23272b';
            dg.fillRect(0, 0, w, h);
          }
          for (const g of [dg, gg]) {
            g.textAlign = 'center';
            g.textBaseline = 'middle';
          }
          return Object.assign(FAMILIES[family](dg, gg, w, h, text, P), { family });
        }
        // ---- Rooftop hotel names (Ocean Drive and the Keys) ------------------------------
        // Cut-out letters on a roof frame, each hotel in its own manner.
        const HOTEL_DESIGNS = {
          'THE FLAMINGO': ['script', { script: 'Flamingo', tube: '#ff6fae', swash: '#6fefff' }],
          SEABREEZE: ['decoNeon', { glow: '#6fefff', ink: '#f2f2ea' }],
          'CASA MARINA': ['script', { script: 'Casa Marina', tube: '#ffe066' }],
          'THE CARLYLE': ['decoNeon', { glow: '#8fb8ff', ink: '#ffffff' }],
          'BEACON HOTEL': ['bulbs', { body: '#d64a3a', bulb: '#fff0c0' }],
          AVALON: ['double', { tube: '#a6ff8a' }],
          'TIDES INN': ['script', { script: 'Tides Inn', tube: '#4ff0e0', swash: '#ff9a5c' }],
          'LA PLAYA': ['script', { script: 'La Playa', tube: '#ff9a5c', swash: '#ffe066' }],
          STARLITE: ['script', { script: 'Starlite', tube: '#6fefff', stars: '#ffe066' }],
          'PALM COURT': ['decoNeon', { glow: '#ff6fae', ink: '#f6e6d6' }],
          'EL DORADO': ['bulbs', { body: '#c89a3a', bulb: '#fff4c8' }],
          BREAKWATER: ['double', { tube: '#58a6ff' }],
        };
        function paintHotel(dg, gg, w, h, name, color) {
          const [kind, P] = HOTEL_DESIGNS[name] || ['script', { script: name.toLowerCase(), tube: color }];
          if (kind === 'script') return FAMILIES.neonScript(dg, gg, w, h, name, { ...P, balance: false });
          const u = h / 100,
            run = K.strokeText(name, { cx: w / 2, cy: h / 2, maxW: w - 16 * u, maxH: h * 0.72, track: kind === 'decoNeon' ? 0.45 : 0.28 });
          dg.lineJoin = dg.lineCap = 'round';
          if (kind === 'decoNeon') {
            const thick = run.size * 0.18,
              thin = Math.max(1, run.size * 0.04);
            dg.save();
            dg.translate(1.5 * u, 2 * u);
            K.decoLetters(dg, run.lines, thin + 2.5 * u, thick + 2.5 * u, '#26292d');
            dg.restore();
            K.decoLetters(dg, run.lines, thin, thick, P.ink);
            K.tubes(dg, gg, run.lines, Math.max(1.5, run.size * 0.05), P.glow, { bare: true, electrodes: false, glass: K.tint(P.glow, 0.5) });
            return spec({ cutout: true, light: P.glow });
          }
          if (kind === 'bulbs') {
            K.bulbLetters(dg, gg, run.lines, run.size, { bodyColor: P.body, bulb: P.bulb, body: 0.26, step: 0.2, r: 0.06 });
            return spec({ cutout: true, light: P.bulb });
          }
          dg.strokeStyle = '#26292d';
          dg.lineWidth = run.size * 0.3;
          K.tracePath(dg, run.lines);
          dg.stroke();
          K.doubleTubes(dg, gg, run.lines, Math.max(1.5, run.size * 0.06), P.tube, '#26292d');
          return spec({ cutout: true, light: P.tube });
        }
        // ---- Tower names (the financial cluster) ------------------------------------------
        // Banks and exchanges in incised Roman capitals with a gilt halo; the Deco
        // towers in contrast capitals; the new glass towers in thin, wide LED letters.
        function paintTowerName(dg, gg, w, h, name) {
          const u = h / 100,
            bank = /CAPITAL|TRUST|CROWN|EXCHANGE|ROTUNDA/.test(name),
            deco = /FEDERATION|EMBANKMENT|IMPERIAL/.test(name);
          if (bank) {
            for (const g of [dg, gg]) g.letterSpacing = '0px';
            K.fxText(dg, name, w / 2, h / 2 + 2 * u, { font: 'times', weight: '700', size: h * 0.78, maxW: w - 16 * u, spacing: 0.22, fill: K.gold, shadow: [1.5 * u, 3 * u, 'rgba(0,0,0,0.75)', 0] });
            gg.save();
            gg.shadowColor = '#ffcf7a';
            gg.shadowBlur = h * 0.3;
            K.fxText(gg, name, w / 2, h / 2 + 2 * u, { font: 'times', weight: '700', size: h * 0.78, maxW: w - 16 * u, spacing: 0.22, fill: 'rgba(255,214,140,0.85)' });
            gg.restore();
            return;
          }
          const run = K.strokeText(name, { cx: w / 2, cy: h / 2, maxW: w - 16 * u, maxH: h * 0.66, track: deco ? 0.5 : 0.62 });
          if (deco) {
            K.decoLetters(dg, run.lines, Math.max(1, run.size * 0.05), run.size * 0.2, '#efe2c4');
            gg.save();
            gg.shadowColor = '#ffe2a8';
            gg.shadowBlur = h * 0.2;
            K.decoLetters(gg, run.lines, Math.max(1, run.size * 0.05), run.size * 0.2, '#ffe9c0');
            gg.restore();
          } else {
            K.blockLetters(dg, run.lines, Math.max(2, run.size * 0.12), { fill: '#e9f3ff', cap: 'round' });
            gg.save();
            gg.shadowColor = '#8fd0ff';
            gg.shadowBlur = h * 0.18;
            K.blockLetters(gg, run.lines, Math.max(2, run.size * 0.12), { fill: '#e8f6ff', cap: 'round' });
            gg.restore();
          }
        }
        // ---- Billboards ------------------------------------------------------------------
        /**
         * Each advertiser has its own layout and illustration: a soft-drink ribbon, a
         * radio dial, a casino's cards, a motel sunset, a punk-radio ransom note, an
         * airline's sky... [title, strap, painter]; the painter gets (g, w, h).
         */
        const T = (g, text, x, y, o) => K.fxText(g, text, x, y, o),
          sky = (g, w, h, stops) => {
            const f = g.createLinearGradient(0, 0, 0, h);
            stops.forEach((c, i) => f.addColorStop(i / (stops.length - 1), c));
            g.fillStyle = f;
            g.fillRect(0, 0, w, h);
          };
        const ADS = [
          [
            'DRINK KOLA',
            (g, w, h) => {
              sky(g, w, h, ['#e3342a', '#b71c1c']);
              g.fillStyle = '#ffffff';
              g.beginPath();
              g.moveTo(0, h * 0.78);
              g.bezierCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 1.05, w, h * 0.62);
              g.lineTo(w, h * 0.74);
              g.bezierCurveTo(w * 0.6, h * 1.15, w * 0.3, h * 0.56, 0, h * 0.9);
              g.fill();
              // The bottle: a contour silhouette with a label band.
              g.fillStyle = '#3a1208';
              g.beginPath();
              const bx = w * 0.83;
              g.moveTo(bx - 9, h * 0.08);
              g.lineTo(bx + 9, h * 0.08);
              g.bezierCurveTo(bx + 10, h * 0.3, bx + 26, h * 0.35, bx + 24, h * 0.55);
              g.bezierCurveTo(bx + 20, h * 0.7, bx + 28, h * 0.8, bx + 24, h * 0.95);
              g.lineTo(bx - 24, h * 0.95);
              g.bezierCurveTo(bx - 28, h * 0.8, bx - 20, h * 0.7, bx - 24, h * 0.55);
              g.bezierCurveTo(bx - 26, h * 0.35, bx - 10, h * 0.3, bx - 9, h * 0.08);
              g.fill();
              g.fillStyle = '#ffffff';
              g.fillRect(bx - 24, h * 0.56, 48, h * 0.14);
              const run = K.strokeText('Kola', { lower: true, slant: 0.3, cx: w * 0.4, cy: h * 0.36, maxW: w * 0.5, maxH: h * 0.62 });
              K.blockLetters(g, run.lines, run.size * 0.16, { fill: '#ffffff', cap: 'round', outline: [3, '#8a0f0f'] });
              T(g, 'ICE COLD · SINCE 1921', w * 0.36, h * 0.93, { font: 'sans', weight: '800', size: 16, maxW: w * 0.5, spacing: 0.2, fill: '#ffffff' });
            },
          ],
          [
            'NEON 88.7',
            (g, w, h) => {
              sky(g, w, h, ['#0f1d3c', '#1c2f5a']);
              g.strokeStyle = 'rgba(143,240,255,0.5)';
              g.lineWidth = 2;
              for (let x = 20; x < w - 20; x += 12) {
                g.beginPath();
                g.moveTo(x, h - 22);
                g.lineTo(x, h - (x % 60 === 20 ? 40 : 30));
                g.stroke();
              }
              g.fillStyle = '#ff3b5c';
              g.fillRect(w * 0.62, h - 50, 4, 36);
              const run = K.strokeText('88.7', { cx: w * 0.62, cy: h * 0.4, maxW: w * 0.5, maxH: h * 0.5 });
              K.tubes(g, g, run.lines, run.size * 0.1, '#8ff0ff', { electrodes: false });
              T(g, 'NEON', w * 0.16, h * 0.34, { font: 'futura', weight: '800', size: 44, maxW: w * 0.26, spacing: 0.1, fill: '#ff6fd0' });
              T(g, 'FM', w * 0.16, h * 0.62, { font: 'futura', weight: '800', size: 26, maxW: w * 0.2, spacing: 0.5, fill: '#8ff0ff' });
              T(g, 'THE SOUND OF THE COAST', w / 2, h - 10, { font: 'sans', weight: '700', size: 12, maxW: w * 0.8, spacing: 0.5, fill: '#c9f5ff' });
            },
          ],
          [
            'GOLDEN TIDE CASINO',
            (g, w, h) => {
              sky(g, w, h, ['#1a0e08', '#2c1d12']);
              for (const [x, r, card] of [
                [w * 0.12, -0.25, 'A'],
                [w * 0.17, 0.05, 'K'],
              ]) {
                g.save();
                g.translate(x, h * 0.52);
                g.rotate(r);
                g.fillStyle = '#f6efe0';
                g.beginPath();
                g.roundRect(-30, -44, 60, 88, 6);
                g.fill();
                T(g, card, -14, -26, { font: 'times', weight: '700', size: 22, fill: '#b3202a' });
                K.icon(g, 'heart', 0, 8, 34, '#b3202a');
                g.restore();
              }
              K.icon(g, 'dice', w * 0.9, h * 0.52, 70, '#f6efe0', '#1a0e08');
              T(g, 'GOLDEN TIDE', w * 0.54, h * 0.4, { font: 'times', weight: '700', size: 54, maxW: w * 0.58, spacing: 0.08, fill: K.gold, shadow: [2, 3, '#000', 0] });
              T(g, 'C A S I N O  ·  F O R T U N E   F A V O R S   T H E   B O L D', w * 0.54, h * 0.72, { font: 'times', weight: '700', size: 14, maxW: w * 0.6, fill: '#e8c070' });
              K.bulbDots(g, g, K.resample([[[6, 6], [w - 6, 6], [w - 6, h - 6], [6, h - 6], [6, 6]]], 16), 3.2, '#ffe9b0');
            },
          ],
          [
            'SUNSET MOTEL',
            (g, w, h) => {
              sky(g, w, h, ['#3a1a5a', '#ff5a7a', '#ffb347']);
              g.fillStyle = '#ffd86a';
              g.beginPath();
              g.arc(w * 0.72, h * 0.78, 60, Math.PI, 0);
              g.fill();
              g.fillStyle = '#1f5f63';
              g.fillRect(0, h * 0.78, w, h * 0.22);
              for (let k = 0; k < 4; k++) {
                g.fillStyle = '#ff9a6a';
                g.fillRect(w * 0.55, h * (0.82 + k * 0.045), w * 0.34, 2);
              }
              K.icon(g, 'palm', w * 0.93, h * 0.55, 110, '#1a1030', '#1a1030');
              const run = K.strokeText('Sunset Motel', { lower: true, slant: 0.24, cx: w * 0.38, cy: h * 0.38, maxW: w * 0.62, maxH: h * 0.44 });
              K.blockLetters(g, run.lines, run.size * 0.12, { fill: '#fff4e0', cap: 'round', outline: [3, '#8a1a4a'] });
              T(g, 'VACANCY · HBO · POOL', w * 0.34, h * 0.88, { font: 'futura', weight: '800', size: 17, maxW: w * 0.5, spacing: 0.25, fill: '#fff4e0' });
            },
          ],
          [
            'RIOT 104.5',
            (g, w, h) => {
              sky(g, w, h, ['#141417', '#141417']);
              const rnd = K.seeded('riot');
              // Torn-paper ransom lettering, a splatter and a zigzag.
              for (let k = 0; k < 14; k++) {
                g.fillStyle = rnd() < 0.5 ? 'rgba(255,111,78,0.25)' : 'rgba(255,230,60,0.2)';
                g.beginPath();
                g.arc(w * (0.6 + rnd() * 0.4), h * rnd(), 4 + rnd() * 16, 0, Math.PI * 2);
                g.fill();
              }
              let x = 26;
              for (const [ch, bg, fg, font] of [
                ['R', '#ff6f4e', '#141417', 'impact'],
                ['I', '#f2f2ea', '#141417', 'times'],
                ['O', '#ffe63c', '#141417', 'black'],
                ['T', '#ff6f4e', '#f2f2ea', 'mono'],
              ]) {
                const r = (rnd() - 0.5) * 0.3;
                g.save();
                g.translate(x + 30, h * 0.42);
                g.rotate(r);
                g.fillStyle = bg;
                g.fillRect(-28, -38, 56, 76);
                T(g, ch, 0, 2, { font, weight: '900', size: 64, fill: fg });
                g.restore();
                x += 66;
              }
              T(g, '104.5', w * 0.78, h * 0.4, { font: 'impact', weight: '900', size: 70, maxW: w * 0.36, skew: 0.15, fill: '#ffe63c', outline: [3, '#141417'] });
              T(g, 'LOUD. ALL NIGHT.', w * 0.3, h * 0.87, { font: 'mono', weight: '700', size: 22, maxW: w * 0.5, spacing: 0.2, fill: '#f2f2ea' });
            },
          ],
          [
            'SOUTHPORT AIR',
            (g, w, h) => {
              sky(g, w, h, ['#6fb8e8', '#dff0fa']);
              g.fillStyle = 'rgba(255,255,255,0.85)';
              for (const [x, y, s] of [
                [0.2, 0.75, 1],
                [0.7, 0.25, 0.7],
                [0.9, 0.8, 0.8],
              ]) {
                for (const [dx, dy, r] of [
                  [-24, 4, 18],
                  [0, -6, 24],
                  [26, 4, 17],
                ]) {
                  g.beginPath();
                  g.arc(w * x + dx * s, h * y + dy * s, r * s, 0, Math.PI * 2);
                  g.fill();
                }
              }
              K.icon(g, 'plane', w * 0.8, h * 0.48, 120, '#1f3c52');
              for (const [c, y] of [
                ['#c8102e', 0.9],
                ['#1f3c52', 0.95],
              ]) {
                g.fillStyle = c;
                g.fillRect(0, h * y, w, h * 0.05);
              }
              T(g, 'SOUTHPORT AIR', w * 0.34, h * 0.38, { font: 'futura', weight: '800', size: 48, maxW: w * 0.6, spacing: 0.06, skew: 0.12, fill: '#1f3c52' });
              T(g, 'FLY THE KEYS DAILY  ·  FROM $49', w * 0.34, h * 0.66, { font: 'sans', weight: '700', size: 18, maxW: w * 0.6, spacing: 0.1, fill: '#c8102e' });
            },
          ],
          [
            'PALM KEYS AUTO',
            (g, w, h) => {
              sky(g, w, h, ['#ff7ac0', '#ff9a5a', '#27c6c0']);
              g.strokeStyle = 'rgba(255,255,255,0.7)';
              g.lineWidth = 3;
              for (let k = 0; k < 5; k++) {
                g.beginPath();
                g.moveTo(w * 0.52, h * (0.52 + k * 0.06));
                g.lineTo(w * 0.62 - k * 10, h * (0.52 + k * 0.06));
                g.stroke();
              }
              K.icon(g, 'car', w * 0.8, h * 0.6, 150, '#1b2a4a', '#f6efe0');
              T(g, 'PALM KEYS AUTO', w * 0.3, h * 0.36, { font: 'black', weight: '900', size: 40, maxW: w * 0.54, skew: 0.25, fill: '#ffffff', outline: [2.5, '#2c1e2a'], extrude: [3, 4, '#2c1e2a'] });
              T(g, 'MECHANICS · RESPRAYS WHILE YOU WAIT', w * 0.3, h * 0.7, { font: 'sans', weight: '800', size: 17, maxW: w * 0.5, skew: 0.2, spacing: 0.1, fill: '#2c1e2a' });
            },
          ],
          [
            'MARLOW BAY FERRIES',
            (g, w, h) => {
              sky(g, w, h, ['#22415a', '#16283a']);
              g.fillStyle = '#e6e0c8';
              g.fillRect(12, 12, w - 24, 3);
              g.fillRect(12, h - 15, w - 24, 3);
              K.icon(g, 'ship', w * 0.8, h * 0.52, 130, '#e6e0c8', '#c8102e');
              g.strokeStyle = 'rgba(230,224,200,0.6)';
              g.lineWidth = 2;
              for (let k = 0; k < 3; k++) {
                g.beginPath();
                for (let x = w * 0.62; x < w - 16; x += 6) g.lineTo(x, h * (0.72 + k * 0.06) + Math.sin(x * 0.12 + k) * 3);
                g.stroke();
              }
              T(g, 'MARLOW BAY', w * 0.34, h * 0.36, { font: 'times', weight: '700', size: 44, maxW: w * 0.56, spacing: 0.12, fill: '#e6e0c8' });
              T(g, 'FERRIES  ·  NO LAST FERRY TONIGHT', w * 0.34, h * 0.66, { font: 'times', weight: '700', size: 16, maxW: w * 0.56, spacing: 0.2, fill: '#c9b98a' });
            },
          ],
          [
            'VOLTA MOBILE',
            (g, w, h) => {
              sky(g, w, h, ['#05080f', '#101a2c']);
              g.strokeStyle = 'rgba(125,247,201,0.18)';
              g.lineWidth = 1;
              for (let x = 0; x < w; x += 16) {
                g.beginPath();
                g.moveTo(x, 0);
                g.lineTo(x, h);
                g.stroke();
              }
              for (let y = 0; y < h; y += 16) {
                g.beginPath();
                g.moveTo(0, y);
                g.lineTo(w, y);
                g.stroke();
              }
              // A brick phone with its aerial and green LCD.
              g.fillStyle = '#2a2f36';
              g.beginPath();
              g.roundRect(w * 0.82, h * 0.2, 44, 116, 8);
              g.fill();
              g.fillRect(w * 0.82 + 30, h * 0.04, 6, 30);
              g.fillStyle = '#7df7c9';
              g.fillRect(w * 0.82 + 7, h * 0.28, 30, 22);
              g.fillStyle = '#6a7380';
              for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(w * 0.82 + 7 + c * 11, h * 0.52 + r * 10, 8, 6);
              T(g, 'VOLTA', w * 0.36, h * 0.38, { font: 'futura', weight: '300', size: 58, maxW: w * 0.6, spacing: 0.5, fill: '#7df7c9' });
              T(g, 'MOBILE · THE CITY IN YOUR POCKET', w * 0.36, h * 0.72, { font: 'sans', weight: '600', size: 15, maxW: w * 0.6, spacing: 0.25, fill: '#dff' });
            },
          ],
          [
            'NORTH POINT BANK',
            (g, w, h) => {
              sky(g, w, h, ['#f2ecdc', '#e6dcc4']);
              g.fillStyle = '#0f2238';
              g.fillRect(0, 0, w * 0.3, h);
              g.fillStyle = '#c9a24e';
              g.fillRect(w * 0.3, 0, 4, h);
              g.fillStyle = '#d8e6f5';
              g.beginPath();
              g.moveTo(w * 0.15 - 22, h * 0.9);
              g.lineTo(w * 0.15 - 16, h * 0.28);
              g.lineTo(w * 0.15, h * 0.1);
              g.lineTo(w * 0.15 + 16, h * 0.28);
              g.lineTo(w * 0.15 + 22, h * 0.9);
              g.fill();
              T(g, 'NORTH POINT', w * 0.65, h * 0.34, { font: 'times', weight: '700', size: 42, maxW: w * 0.6, spacing: 0.14, fill: '#0f2238' });
              T(g, 'B A N K', w * 0.65, h * 0.58, { font: 'times', weight: '400', size: 22, maxW: w * 0.4, fill: '#8a6d34' });
              T(g, 'YOUR MONEY. OUR TOWER.  ·  MEMBER FDIC', w * 0.65, h * 0.84, { font: 'sans', weight: '600', size: 11, maxW: w * 0.6, spacing: 0.2, fill: '#0f2238' });
            },
          ],
          [
            'CAFÉ MARLOW',
            (g, w, h) => {
              sky(g, w, h, ['#c49a6a', '#a57a4a']);
              K.icon(g, 'cup', w * 0.18, h * 0.55, 120, '#f6efe0', '#3b2417');
              const run = K.strokeText('Café Marlow', { lower: true, slant: 0.22, cx: w * 0.6, cy: h * 0.4, maxW: w * 0.6, maxH: h * 0.5 });
              K.blockLetters(g, run.lines, run.size * 0.1, { fill: '#3b2417', cap: 'round' });
              T(g, 'ESPRESSO · CUBANO · OPEN LATE', w * 0.6, h * 0.82, { font: 'mono', weight: '700', size: 15, maxW: w * 0.6, spacing: 0.1, fill: '#fff4e0' });
            },
          ],
          [
            'AFTERHOURS',
            (g, w, h) => {
              sky(g, w, h, ['#1d0f2e', '#07030c']);
              for (let k = 0; k < 40; k++) {
                g.fillStyle = 'rgba(255,255,255,' + (0.2 + (k % 5) * 0.12) + ')';
                g.fillRect((k * 97) % w, (k * 53) % (h * 0.6), 2, 2);
              }
              K.icon(g, 'moon', w * 0.88, h * 0.4, 70, '#3ff0ff');
              const run = K.strokeText('after hours', { lower: true, slant: 0.24, cx: w * 0.44, cy: h * 0.4, maxW: w * 0.7, maxH: h * 0.5 });
              K.tubes(g, g, run.lines, run.size * 0.1, '#ff4fb8', { electrodes: false });
              T(g, 'FRI · SAT · TILL DAWN  ·  DJ LAZLO', w * 0.44, h * 0.84, { font: 'futura', weight: '700', size: 15, maxW: w * 0.7, spacing: 0.3, fill: '#c9b0ff' });
            },
          ],
          [
            'THE BLUE PLATE DINER',
            (g, w, h) => {
              sky(g, w, h, ['#f4efe2', '#f4efe2']);
              for (let x = 0, k = 0; x < w; x += 16, k++) {
                g.fillStyle = k % 2 ? '#b3202a' : '#f4efe2';
                g.fillRect(x, h - 18, 16, 9);
                g.fillStyle = k % 2 ? '#f4efe2' : '#b3202a';
                g.fillRect(x, h - 9, 16, 9);
              }
              g.fillStyle = '#1d4f8a';
              g.beginPath();
              g.ellipse(w * 0.16, h * 0.46, 56, 56, 0, 0, Math.PI * 2);
              g.fill();
              g.fillStyle = '#f4efe2';
              g.beginPath();
              g.ellipse(w * 0.16, h * 0.46, 40, 40, 0, 0, Math.PI * 2);
              g.fill();
              K.icon(g, 'cup', w * 0.16, h * 0.46, 46, '#b3202a', '#b3202a');
              const run = K.strokeText('Blue Plate', { lower: true, slant: 0.24, cx: w * 0.6, cy: h * 0.32, maxW: w * 0.56, maxH: h * 0.4 });
              K.blockLetters(g, run.lines, run.size * 0.13, { fill: '#1d4f8a', cap: 'round' });
              T(g, 'PIE · COFFEE · OPEN 24/7', w * 0.6, h * 0.7, { font: 'black', weight: '900', size: 20, maxW: w * 0.56, spacing: 0.12, fill: '#b3202a' });
            },
          ],
          [
            'THE RUSTY ANCHOR',
            (g, w, h) => {
              g.beginPath();
              g.rect(0, 0, w, h);
              K.fillBoard(g, 'wood', 0, 0, w, h, '#6b4a2e', 'rusty-ad');
              K.icon(g, 'anchor', w * 0.12, h * 0.5, 110, '#f0e2c0');
              K.icon(g, 'mug', w * 0.88, h * 0.52, 90, '#e8b04a', '#ffffff');
              T(g, 'THE RUSTY ANCHOR', w * 0.5, h * 0.36, { font: 'times', weight: '700', size: 38, maxW: w * 0.64, spacing: 0.08, fill: '#f0e2c0', shadow: [2, 3, '#000', 0] });
              T(g, 'HAPPY HOUR 4–7  ·  LIVE DARTS', w * 0.5, h * 0.7, { font: 'times', weight: '700', size: 18, maxW: w * 0.6, spacing: 0.1, fill: '#e8b04a' });
            },
          ],
          [
            'ROYAL CINEMA',
            (g, w, h) => {
              sky(g, w, h, ['#101010', '#101010']);
              g.fillStyle = '#2a2a2a';
              for (const y of [4, h - 20]) for (let x = 6; x < w; x += 22) g.fillRect(x, y + 4, 12, 9);
              g.fillStyle = '#8e0f1f';
              g.fillRect(0, 24, w, h - 48);
              K.icon(g, 'reel', w * 0.12, h * 0.5, 80, '#d8a948', '#8e0f1f');
              T(g, 'NOW SHOWING', w * 0.56, h * 0.32, { font: 'sans', weight: '800', size: 14, maxW: w * 0.5, spacing: 0.6, fill: '#f7f3e6' });
              T(g, 'DEAD END', w * 0.56, h * 0.55, { font: 'impact', weight: '900', size: 48, maxW: w * 0.6, spacing: 0.08, fill: '#ffd24a', shadow: [3, 3, '#000', 0] });
              T(g, 'ROYAL CINEMA · 7PM & 9:30', w * 0.56, h * 0.76, { font: 'sans', weight: '700', size: 13, maxW: w * 0.6, spacing: 0.2, fill: '#f7f3e6' });
            },
          ],
          [
            'MARLINS',
            (g, w, h) => {
              sky(g, w, h, ['#10213f', '#0a1428']);
              g.fillStyle = '#ff7a1a';
              g.beginPath();
              g.moveTo(w * 0.62, 0);
              g.lineTo(w, 0);
              g.lineTo(w, h);
              g.lineTo(w * 0.5, h);
              g.fill();
              K.icon(g, 'fish', w * 0.82, h * 0.46, 120, '#10213f', '#ffffff');
              const run = K.strokeText('MARLINS', { cx: w * 0.3, cy: h * 0.38, maxW: w * 0.46, maxH: h * 0.36, slant: 0.18 });
              K.blockLetters(g, run.lines, run.size * 0.22, { fill: '#ffffff', outline: [2.5, '#ff7a1a'], extrude: [3, 4, '#000'], cap: 'square' });
              T(g, 'SEASON TICKETS ON SALE', w * 0.3, h * 0.78, { font: 'black', weight: '900', size: 16, maxW: w * 0.46, spacing: 0.1, fill: '#ff7a1a' });
            },
          ],
        ];
        return { paint, designFor, paintHotel, paintTowerName, ADS, SIGN_DESIGNS };
      })();
      // END SUBSYSTEM: src/signdesigns3d.js
