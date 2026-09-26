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
