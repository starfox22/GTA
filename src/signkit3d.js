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
        // @include src/signkit3d-letters.js
        // @include src/signkit3d-boards.js
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
            // @include src/signkit3d-emblems-a.js
            // @include src/signkit3d-emblems-b.js
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
