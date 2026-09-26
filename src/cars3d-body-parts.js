      // ---- BODIES ------------------------------------------------------------------------------
      // Lengths along the car are fractions of l; heights, radii and offsets in metres
      // (civBody() turns them into map units). See the header for the archetypes.
      const CV_LENS_DARK = '#4a5057',
        CV_LED = '#f4f7ff',
        CV_AMBER = '#ffa227',
        CV_TAIL_DARK = '#8e1016',
        CV_TAIL_BAR = '#ff3a2e',
        CV_REVERSE = '#e9e9e4',
        CV_CHROME = '#e3e7ea',
        CV_GLOSS = '#0b0c0e',
        CV_PLASTIC = '#1a1c1f';
      function civBody(name, spec) {
        const M = CAR_M,
          body = { ...spec, name };
        for (const key of ['yb', 'h', 'uvTop']) if (body[key] !== undefined) body[key] *= M;
        body.profile = spec.profile.map(([t, wf, top, bottom]) => (bottom === undefined ? [t, wf, top * M] : [t, wf, top * M, bottom * M]));
        if (spec.glass) {
          body.glass = { ...spec.glass };
          for (const key of ['base', 'roof', 'arch', 'bulge', 'aWidth']) if (body.glass[key] !== undefined) body.glass[key] *= M;
          if (body.glass.pillars) body.glass.pillars = body.glass.pillars.map(([s, width, kind]) => [s, width * M, kind]);
        }
        body.wheel = { ...spec.wheel };
        for (const key of ['r', 'rr', 'width', 'wr', 'proud']) if (body.wheel[key] !== undefined) body.wheel[key] *= M;
        return body;
      }
      /*
       * Helpers the bodies share. `lampPatch` puts a lens on the nose or tail in a
       * lamp's set, `ledLine` a lit strip in the DRL set, `projector` a round
       * projector with its chrome bezel.
       */
      function lampPatch(k, set, frame, z0, z1, span, color, options = {}) {
        k.patch(set, frame, z0, z1, 0, 0, { span, color, finish: 'lens', cols: 8, rows: 2, lift: 0.014 * k.M, ...options });
      }
      /*
       * A lamp on a corner: a lens across the nose or tail from `zIn` to `zOut`
       * (shares of the half width) whose height runs from `yIn` to `yOut`
       * ([bottom, top] in metres), wrapping `wrap` metres round onto the flank
       * (tapering to `wrapTip`). end 1 front, -1 rear. Returns the lamp's frame
       * and half width for the details that sit in it.
       */
      function cornerLamp(k, end, side, o) {
        const M = k.M,
          frame = end > 0 ? 'front' : 'rear',
          set = o.set || (end > 0 ? k.head(side) : k.tail(side)),
          yMid = ((o.yOut[0] + o.yOut[1]) / 2) * M,
          // The body's half width at the lamp's height near the end (below the top there).
          hw = Math.max(0.3 * M, k.at(end * 0.47 * k.l, Math.min(yMid, k.top(end * 0.47 * k.l) - 0.05 * M)).half),
          color = o.color || (end > 0 ? CV_LENS_DARK : CV_TAIL_DARK);
        lampPatch(k, set, frame, side * hw * o.zIn, side * hw * o.zOut, (z) => {
          const f = clamp((Math.abs(z) / hw - o.zIn) / Math.max(1e-6, o.zOut - o.zIn), 0, 1),
            curve = o.curve ? Math.sin(f * Math.PI) * o.curve : 0;
          return [lerpNumber(o.yIn[0], o.yOut[0], f) * M + curve * M, lerpNumber(o.yIn[1], o.yOut[1], f) * M + curve * M];
        }, color);
        if (o.wrap) {
          const edge = end > 0 ? k.frontX(hw * o.zOut, yMid) : k.rearX(hw * o.zOut, yMid),
            x0 = edge - end * o.wrap * M,
            tip = o.wrapTip ?? 0.4;
          k.patch(set, 'side', Math.min(x0, edge + end * 0.004 * M), Math.max(x0, edge + end * 0.004 * M), 0, 0, {
            side,
            color,
            finish: 'lens',
            cols: 5,
            rows: 1,
            lift: 0.012 * M,
            span: (x) => {
              const f = clamp((x - x0) / (edge - x0), 0, 1),
                h = lerpNumber(tip, 1, f),
                mid = (o.yOut[0] + o.yOut[1]) / 2,
                half = ((o.yOut[1] - o.yOut[0]) / 2) * h;
              return [(mid - half + (o.wrapRise || 0) * (1 - f)) * M, (mid + half + (o.wrapRise || 0) * (1 - f)) * M];
            },
          });
        }
        return { frame, hw, set };
      }
      function ledLine(k, set, frame, points, color = CV_LED, size = 0.018) {
        k.strip(set, frame, points, size * k.M, size * k.M, { color, finish: 'lens', lift: 0.02 * k.M });
      }
      function projector(k, set, frame, z, y, r, side = 1) {
        const S = k.S;
        k.round(set, S.cylinderLow, frame, z, y, r * k.M, 0.03 * k.M, { color: '#dfe4ea', finish: 'chrome', lift: 0.018 * k.M }, side);
        k.round(set, S.lowDome, frame, z, y, r * 0.7 * k.M, 0.05 * k.M, { color: '#ffffff', finish: 'lens', lift: 0.03 * k.M }, side);
      }
      // Cross-sections from the underside (0) to the top (1): [height share, half-width share].
      const SEC_SALOON = [[0, 0.84], [0.1, 0.95], [0.3, 1], [0.6, 1], [0.76, 0.98], [0.87, 0.93], [0.94, 0.85], [0.98, 0.7], [1, 0.4], [1, 0]],
        SEC_BOXY = [[0, 0.9], [0.08, 0.98], [0.25, 1], [0.75, 1], [0.88, 0.985], [0.95, 0.95], [0.985, 0.87], [1, 0.62], [1, 0.3], [1, 0]],
        SEC_SPORT = [[0, 0.82], [0.12, 0.94], [0.32, 1], [0.55, 0.995], [0.7, 0.97], [0.82, 0.92], [0.91, 0.82], [0.97, 0.64], [1, 0.36], [1, 0]],
        SEC_WEDGE = [[0, 0.86], [0.1, 0.97], [0.26, 1], [0.46, 0.99], [0.6, 0.95], [0.72, 0.89], [0.83, 0.8], [0.92, 0.66], [0.98, 0.42], [1, 0]],
        // Wings standing above the bonnet and engine deck (height shares past 1 at the shoulders).
        SEC_FENDER = [[0, 0.86], [0.12, 0.97], [0.32, 1], [0.55, 0.985], [0.76, 0.95], [0.93, 0.88], [1.07, 0.77], [1.13, 0.62], [1.06, 0.4], [1, 0]],
        SEC_FENDER_SOFT = [[0, 0.84], [0.12, 0.95], [0.32, 1], [0.56, 0.99], [0.74, 0.96], [0.88, 0.9], [0.99, 0.8], [1.05, 0.64], [1.03, 0.4], [1, 0]],
        SEC_BRUTINI = [[0, 0.88], [0.1, 0.98], [0.28, 1], [0.5, 0.985], [0.64, 0.94], [0.76, 0.86], [0.86, 0.74], [0.93, 0.58], [0.98, 0.36], [1, 0]],
        SEC_TALL = [[0, 0.9], [0.06, 0.98], [0.2, 1], [0.8, 1], [0.9, 0.985], [0.955, 0.95], [0.985, 0.88], [1, 0.66], [1, 0.33], [1, 0]];
      // Shared bits of detailing.
      function plateLight(k, y) {
        k.patch(k.sets.drl, 'rear', -0.08 * k.M, 0.08 * k.M, (y + 0.075) * k.M, (y + 0.085) * k.M, { color: '#fff6e6', cols: 2, rows: 1, lift: 0.02 * k.M });
      }
      function exhaustTips(k, zs, y, r, color = CV_CHROME, shape = 'round') {
        const { M, S } = k;
        for (const z of zs) {
          const geo = shape === 'hex' ? S.hex : S.cylinder24;
          k.round(k.sets.trim, geo, 'rear', z * M, y * M, r * M, 0.12 * M, { color, finish: 'chrome', lift: 0.02 * M });
          k.round(k.sets.trim, geo, 'rear', z * M, y * M, r * 0.78 * M, 0.13 * M, { color: '#070707', finish: 'matte', lift: 0.03 * M });
        }
      }
      function badge(k, frame, z, y, r = 0.05, color = CV_CHROME) {
        k.round(k.sets.trim, k.S.cylinder24, frame, z * k.M, y * k.M, r * k.M, 0.018 * k.M, { color, finish: 'chrome' });
      }
      function roofFin(k, t = 0.12) {
        const g = k.g,
          x = lerpNumber(g.rb, g.rf, t) * k.l;
        k.add(k.sets.trim, k.S.box, x, g.roof + g.arch + 0.05 * k.M, 0, 0.16 * k.M, 0.06 * k.M, 0.04 * k.M, { color: CV_GLOSS, finish: 'gloss' }, 0, 0, 0.3);
      }
      function sideMarker(k, x, y, side, color = CV_AMBER, set = k.sets.drl) {
        k.patch(set, 'side', x - 0.04 * k.M, x + 0.04 * k.M, (y - 0.015) * k.M, (y + 0.015) * k.M, { side, color, cols: 2, rows: 1, lift: 0.012 * k.M });
      }
      // A roof rail pair along the roof (SUVs, the rally hatch).
      function roofRails(k, color = CV_GLOSS, inset = 0.86) {
        const g = k.g;
        for (const side of [-1, 1]) {
          const z = side * g.wt * k.w * inset,
            y = g.roof + g.arch * (1 - inset * inset) + 0.06 * k.M,
            a = [g.rb * k.l + 0.08 * k.M, y, z],
            b = [g.rf * k.l - 0.15 * k.M, y, z];
          k.bar(k.sets.trim, a, b, 0.035 * k.M, 0.04 * k.M, 0.015 * k.M, { color, finish: color === CV_CHROME ? 'chrome' : 'gloss' });
          for (const t of [0.04, 0.96]) k.add(k.sets.trim, k.S.box, lerpNumber(a[0], b[0], t), y - 0.03 * k.M, z, 0.08 * k.M, 0.06 * k.M, 0.03 * k.M, { color: CV_GLOSS, finish: 'gloss' });
        }
      }
