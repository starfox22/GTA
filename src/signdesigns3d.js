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
          // @include src/signdesigns3d-families-a.js
          // @include src/signdesigns3d-families-b.js
        };
        // @include src/signdesigns3d-styles.js
      })();
      // END SUBSYSTEM: src/signdesigns3d.js
