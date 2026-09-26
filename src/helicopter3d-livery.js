      // ---- Livery ----------------------------------------------------------------------------
      const heliHex = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      // Coverage of a signed distance (negative inside) over about a texel.
      const heliCover = (d, aa = 0.1) => Math.min(1, Math.max(0, 0.5 - d / aa));
      function heliMix(out, rgb, k) {
        if (k <= 0) return;
        out[0] += (rgb[0] - out[0]) * k;
        out[1] += (rgb[1] - out[1]) * k;
        out[2] += (rgb[2] - out[2]) * k;
      }
      function heliShade(out, f) {
        out[0] *= f;
        out[1] *= f;
        out[2] *= f;
      }
      // A cheap value noise for weathering (0..1).
      function heliNoise(x, y) {
        const xi = Math.floor(x),
          yi = Math.floor(y),
          fx = x - xi,
          fy = y - yi,
          h = (i, j) => {
            const n = Math.sin((xi + i) * 127.1 + (yi + j) * 311.7) * 43758.5453;
            return n - Math.floor(n);
          },
          sx = fx * fx * (3 - 2 * fx),
          sy = fy * fy * (3 - 2 * fy);
        return (h(0, 0) * (1 - sx) + h(1, 0) * sx) * (1 - sy) + (h(0, 1) * (1 - sx) + h(1, 1) * sx) * sy;
      }
      /*
       * Paint schemes: `body(out, x, y, z, st)` writes the colour of the skin at a
       * point (the cowl too, from its own stations), `fin(out, x, y, side)` the
       * fin's, `swatches` the flat parts' (HELI_SWATCH order), `words` the lettering
       * and emblems painted into the livery (heliPaintWord), `decals(add)` glyph
       * quads (the Black Hawk's stencils).
       */
      function heliScheme(look) {
        const plan = heliPlans()[look.airframe],
          heliStationFor = (x) => heliStation(plan, x),
          WHITE = [239, 241, 242],
          DARK = [16, 17, 20],
          METAL = [150, 156, 162],
          // The small airframe's cheat line: along the lower doors, up the engine bay onto the boom.
          robinLine = () => heliMonotone([-46, -30, -16, -8, 0, 10, 20, 26, 29], [14.15, 14.0, 13.3, 11.4, 9.2, 8.1, 7.9, 8.3, 9.0]),
          // Stripes narrow with the section (thinner along the boom).
          band = (st) => Math.min(1, Math.max(0.35, st.w / 5.7));
        if (look.livery === 'police') {
          const INK = [11, 15, 26],
            BLUE = [22, 58, 160],
            GOLD = [222, 178, 80],
            BLACK = [7, 9, 14],
            // The blue band's top edge (the upper gold pinstripe) and its bottom edge.
            hi = heliMonotone([-46, -36, -24, -15, -6, 2, 8, 14, 18, 26, 31, 35, 39], [16.35, 16.4, 16.45, 16.8, 17.0, 16.4, 13.4, 9.7, 8.3, 8.25, 8.5, 9.5, 10.2]),
            lo = heliMonotone([-46, -36, -24, -15, -8, 0, 8, 14, 20, 28, 34, 39], [14.05, 14.2, 14.1, 13.2, 11.2, 10.2, 8.7, 7.4, 6.9, 7.0, 7.9, 9.6]),
            letters = { fill: '#f6f8fa', outline: '#1c52dc', outlineWidth: 0.11, edge: '#050d24', edgeWidth: 0.05 };
          return {
            body(out, x, y) {
              out[0] = INK[0];
              out[1] = INK[1];
              out[2] = INK[2];
              heliMix(out, BLUE, heliCover(Math.max(lo(x) - y, y - hi(x)), 0.08));
            },
            // The gold pinstripes just outside the band's edges.
            lines: [
              { y: (x) => hi(x) + 0.17, width: 0.15, color: '#deb250' },
              { y: (x) => lo(x) - 0.17, width: 0.15, color: '#deb250' },
            ],
            fin(out, x, y) {
              // Blue over the fenestron and the fin's root, gold line, black fin tip.
              const edge = 21.4 + (x + 41) * 0.28;
              out[0] = INK[0];
              out[1] = INK[1];
              out[2] = INK[2];
              heliMix(out, BLUE, heliCover(Math.max(y - edge, 10.9 - y), 0.05));
              heliMix(out, GOLD, heliCover(Math.abs(y - edge - 0.14) - 0.09, 0.04));
            },
            swatches: [INK, INK, BLUE, INK, INK, BLACK, DARK, METAL],
            words: [
              { text: 'POLICE', surface: 'side', x: -5.6, y: 14.15, height: 3.3, squeeze: 0.86, spacing: 0.07, ...letters },
              { text: 'SOUTH COAST', surface: 'side', x: -3.2, y: 18.15, height: 1.0, squeeze: 0.9, spacing: 0.14, fill: '#f6f8fa' },
              { image: () => heliSealImage(), surface: 'side', x: 6.3, y: 10.1, height: 3.2 },
              { text: 'N-7SC', surface: 'cowl', x: -2.4, y: 21.35, height: 1.6, spacing: 0.08, fill: '#f6f8fa', outline: '#050d24', outlineWidth: 0.08 },
              { text: 'AIR ONE', surface: 'fin', x: -42.9, y: 24.2, height: 1.0, squeeze: 0.85, spacing: 0.08, fill: '#f6f8fa' },
              // For the camera above: the unit across the cowl, POLICE along the boom.
              { text: 'AIR 1', surface: 'cowlTop', x: -3.6, z: 0, height: 3.9, squeeze: 0.92, spacing: 0.06, ...letters },
              { text: 'POLICE', surface: 'top', x: -24.2, z: 0, height: 3.1, squeeze: 0.78, spacing: 0.05, ...letters },
            ],
          };
        }
        if (look.livery === 'news') {
          const RED = [196, 30, 42],
            NAVY = [16, 32, 74],
            line = robinLine();
          return {
            body(out, x, y, z, st) {
              out[0] = WHITE[0];
              out[1] = WHITE[1];
              out[2] = WHITE[2];
              heliMix(out, [214, 218, 222], heliCover(y - line(x), 0.05) * 0.8);
            },
            lines: [
              { y: line, width: (x, st) => 1.9 * band(st), color: '#c41e2a' },
              { y: (x) => line(x) + 1.3 * band(heliStationFor(x)), width: (x, st) => 0.34 * band(st), color: '#10204a' },
            ],
            fin(out, x, y) {
              out[0] = RED[0];
              out[1] = RED[1];
              out[2] = RED[2];
              heliMix(out, WHITE, heliCover(Math.abs(y - 13.6 - (x + 46) * 0.6) - 0.3, 0.05));
            },
            swatches: [WHITE, RED, NAVY, WHITE, WHITE, RED, DARK, METAL],
            words: [
              { text: 'CH 7 NEWS', surface: 'side', x: 7.4, y: 8.05, height: 1.05, squeeze: 0.9, spacing: 0.1, fill: '#ffffff' },
              { image: () => heliRoundelImage('7', '#c41e2a', '#ffffff'), surface: 'side', x: -8.3, y: 12.7, height: 3.3 },
              { text: 'SKY 7', surface: 'side', x: -27, y: 14.85, height: 0.75, squeeze: 0.9, spacing: 0.1, fill: '#10204a' },
              { text: 'N7NW', surface: 'fin', x: -43.4, y: 18.8, height: 1.05, squeeze: 0.85, fill: '#ffffff' },
              { text: 'NEWS', surface: 'cowlTop', x: -2.3, z: 0, height: 2.5, squeeze: 0.9, spacing: 0.06, fill: '#c41e2a' },
              { text: 'CH 7', surface: 'top', x: -27, z: 0, height: 1.9, squeeze: 0.9, spacing: 0.08, fill: '#10204a' },
            ],
          };
        }
        if (look.livery === 'executive' || look.livery === 'civil') {
          const P = heliHex(look.paint),
            light = P[0] * 0.3 + P[1] * 0.59 + P[2] * 0.11 > 150,
            s = HELI_CIVIL_SCHEMES[look.scheme] || (look.livery === 'executive' ? { stripe: light ? '#96793e' : '#c9a44a', accent: light ? '#96793e' : '#c9a44a', width: 0.12, reg: 'N66EX' } : { stripe: light ? '#1d1e21' : '#e9e9e4', accent: light ? '#c8262d' : '#c9a44a', width: 0.7, reg: 'N44RP' }),
            STRIPE = heliHex(s.stripe),
            ACCENT = heliHex(s.accent),
            BELLY = P.map((v) => v * 0.86),
            line = robinLine(),
            ink = light ? '#17191c' : s.width < 0.3 ? s.stripe : '#f2f2ee';
          return {
            body(out, x, y, z, st) {
              out[0] = P[0];
              out[1] = P[1];
              out[2] = P[2];
              heliMix(out, BELLY, heliCover(y - (st.yb + (st.yw - st.yb) * 0.42), 0.5));
            },
            // The cheat line along the lower doors and up onto the boom, a pinstripe over it.
            lines: [
              { y: line, width: (x, st) => 1.24 * band(st) * s.width, color: s.stripe },
              { y: (x) => line(x) + (0.62 * s.width + 0.36) * band(heliStationFor(x)), width: (x, st) => 0.18 * band(st), color: s.accent },
            ],
            fin(out, x, y) {
              out[0] = P[0];
              out[1] = P[1];
              out[2] = P[2];
              heliMix(out, STRIPE, heliCover(Math.abs(y - 13.6 - (x + 46) * 0.6) - 0.5 * Math.max(0.25, s.width), 0.05));
            },
            swatches: [P, BELLY, STRIPE, P, P, P, DARK, METAL],
            words: [{ text: s.reg, surface: 'side', x: -8.6, y: 13.7, height: 1.25, squeeze: 0.9, spacing: 0.08, fill: ink }],
          };
        }
        // Military: flat olive drab with a faint mottle, black anti-glare, low-vis marks.
        const OD = heliHex(look.paint),
          BLACK = [26, 28, 24],
          OD_DARK = OD.map((v) => v * 0.8);
        return {
          body(out, x, y, z, st) {
            const mottle = 0.94 + 0.1 * heliNoise(x * 0.18, (y + z) * 0.18) + 0.03 * heliNoise(x * 1.3, (y - z) * 1.3);
            out[0] = OD[0] * mottle;
            out[1] = OD[1] * mottle;
            out[2] = OD[2] * mottle;
            // The anti-glare panel on top of the nose ahead of the windscreen.
            heliMix(out, BLACK, heliCover(Math.max(34.4 - x, st.yw + (st.yt - st.yw) * 0.45 - y, Math.abs(z) - st.w * 0.82), 0.12));
          },
          fin(out, x, y) {
            const mottle = 0.94 + 0.1 * heliNoise(x * 0.18, y * 0.18);
            out[0] = OD[0] * mottle;
            out[1] = OD[1] * mottle;
            out[2] = OD[2] * mottle;
          },
          swatches: [OD, OD_DARK, OD, OD, OD, OD, BLACK, [96, 98, 90]],
          words: [{ image: () => heliArmyStarImage(), surface: 'side', x: 6.8, y: 11.2, height: 4.6 }],
          decals(add) {
            for (const side of [-1, 1]) {
              add('U.S. ARMY', { surface: 'side', side, x: -27, y: 16.6, height: 1.6, color: '#1b1d19' });
              add('20-27115', { surface: 'fin', side, x: -46.6, y: 24.5, height: 1.2, color: '#1b1d19' });
            }
            add('ARMY', { surface: 'top', x: -27, z: 0, height: 2.8, color: '#23251f' });
          },
        };
      }
      // ---- Emblems (small canvases, warped onto the skin like the words) ----------------------
      function heliEmblemCanvas(size = 256) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const g = canvas.getContext('2d');
        g.translate(size / 2, size / 2);
        return { canvas, g };
      }
      function heliStarPath(g, r, points, inner) {
        g.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / points,
            k = i % 2 ? inner : r;
          g.lineTo(Math.cos(a) * k, Math.sin(a) * k);
        }
        g.closePath();
      }
      // The police department's seal: a gold-rimmed navy ring of stars round a gold star.
      function heliSealImage() {
        const { canvas, g } = heliEmblemCanvas();
        const disc = (r, color) => {
          g.fillStyle = color;
          g.beginPath();
          g.arc(0, 0, r, 0, TAU);
          g.fill();
        };
        disc(124, '#d8b25a');
        disc(114, '#0e2150');
        g.fillStyle = '#d8b25a';
        for (let i = 0; i < 20; i++) {
          const a = (i * TAU) / 20;
          g.save();
          g.translate(Math.cos(a) * 99, Math.sin(a) * 99);
          heliStarPath(g, 7, 5, 3);
          g.fill();
          g.restore();
        }
        disc(84, '#d8b25a');
        disc(78, '#f2f0e8');
        heliStarPath(g, 70, 7, 36);
        g.fillStyle = '#d8b25a';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#7a5c1c';
        g.stroke();
        disc(25, '#0e2150');
        heliStarPath(g, 17, 5, 7);
        g.fillStyle = '#f2f0e8';
        g.fill();
        return canvas;
      }
      function heliRoundelImage(text, fill, ring) {
        const { canvas, g } = heliEmblemCanvas();
        g.fillStyle = ring;
        g.beginPath();
        g.arc(0, 0, 124, 0, TAU);
        g.fill();
        g.fillStyle = fill;
        g.beginPath();
        g.arc(0, 0, 110, 0, TAU);
        g.fill();
        g.fillStyle = ring;
        g.font = `900 190px ${HELI_FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 0, 10);
        return canvas;
      }
      // The Army's low-visibility star in a ring (outlined, no fill).
      function heliArmyStarImage() {
        const { canvas, g } = heliEmblemCanvas();
        g.strokeStyle = 'rgba(24,26,22,0.85)';
        g.lineWidth = 12;
        g.lineJoin = 'miter';
        heliStarPath(g, 88, 5, 34);
        g.stroke();
        g.beginPath();
        g.arc(0, 0, 112, 0, TAU);
        g.stroke();
        return canvas;
      }
      // ---- Lettering: canvas text rasterised upright, then warped onto a surface ----------------
      function heliWordImage(w, pxPerUnit) {
        const canvas = document.createElement('canvas'),
          g = canvas.getContext('2d'),
          // Cap height in source pixels: about twice what the livery gives it.
          CAP = Math.round(clamp(w.height * pxPerUnit * 2.2, 40, 220)),
          weight = w.weight || '900',
          family = w.font || HELI_FONT,
          squeeze = w.squeeze ?? 1;
        g.font = `${weight} 200px ${family}`;
        const size = (200 * CAP) / (g.measureText('H').actualBoundingBoxAscent || 144),
          font = `${weight} ${size.toFixed(1)}px ${family}`;
        g.font = font;
        const chars = [...w.text],
          gap = (w.spacing ?? 0.05) * CAP,
          advances = chars.map((ch) => g.measureText(ch).width * squeeze),
          outline = w.outline ? (w.outlineWidth ?? 0.1) * CAP : 0,
          ring = outline + (w.edge ? (w.edgeWidth ?? 0.05) * CAP : 0),
          pad = Math.ceil(ring + 3);
        canvas.width = Math.ceil(advances.reduce((a, b) => a + b, 0) + gap * (chars.length - 1) + pad * 2);
        canvas.height = Math.ceil(CAP + pad * 2);
        g.font = font;
        g.lineJoin = 'round';
        const layers = [];
        if (w.edge) layers.push([w.edge, ring * 2]);
        if (w.outline) layers.push([w.outline, outline * 2]);
        layers.push([w.fill, 0]);
        for (const [color, width] of layers) {
          let cursor = pad;
          chars.forEach((ch, i) => {
            g.save();
            g.translate(cursor, pad + CAP);
            g.scale(squeeze, 1);
            if (width) {
              g.strokeStyle = color;
              g.lineWidth = width;
              g.strokeText(ch, 0, 0);
            } else {
              g.fillStyle = color;
              g.fillText(ch, 0, 0);
            }
            g.restore();
            cursor += advances[i] + gap;
          });
        }
        return { canvas, unit: w.height / CAP };
      }
      /*
       * Draws `img` onto the livery through `point(fu, fv)` (the source's 0..1
       * coordinates, fu along the reading direction, fv down the letters, to canvas
       * pixels): small cells each drawn with their own affine transform, so the
       * image follows the surface's curves; a pixel of overlap hides the joins.
       */
      function heliWarp(g, img, point) {
        const N = Math.max(8, Math.ceil(img.width / 6)),
          K = 6,
          sw = img.width / N,
          sh = img.height / K,
          grid = [];
        for (let i = 0; i <= N; i++) for (let k = 0; k <= K; k++) grid.push(point(i / N, k / K));
        for (let i = 0; i < N; i++)
          for (let k = 0; k < K; k++) {
            const p = grid[i * (K + 1) + k],
              px = grid[(i + 1) * (K + 1) + k],
              py = grid[i * (K + 1) + k + 1],
              w = Math.min(sw + 1, img.width - i * sw),
              h = Math.min(sh + 1, img.height - k * sh);
            g.setTransform((px[0] - p[0]) / sw, (px[1] - p[1]) / sw, (py[0] - p[0]) / sh, (py[1] - p[1]) / sh, p[0], p[1]);
            g.drawImage(img, i * sw, k * sh, w, h, 0, 0, w, h);
          }
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      // The top of a section at z (the upper surface's angle, inverse of heliSection).
      function heliTopTheta(st, z) {
        const c = clamp(z / st.w, -1, 1);
        return Math.acos(Math.sign(c) * Math.pow(Math.abs(c), st.nu / 2));
      }
      // Canvas pixels of surface points: the fuselage and cowl lofts (sides and tops), the fin.
      function heliSurfaces(plan, cowl, W, H) {
        const ringOf = (theta) => ((((theta + Math.PI / 2) / TAU) % 1) + 1) % 1,
          loft = (stationAt, u, v) => ({
            side: (x, y, side) => [u(x), v(ringOf(heliSideTheta(stationAt(x), y, side)))],
            top: (x, z) => [u(x), v(ringOf(heliTopTheta(stationAt(x), z)))],
          }),
          span = plan.x1 - plan.x0,
          [fx0, fx1, fy0, fy1] = plan.fin.art;
        return {
          body: loft(
            (x) => heliStation(plan, x),
            (x) => ((x - plan.x0) / span) * W,
            (r) => (1 - (HELI_BAND + (1 - HELI_BAND) * r)) * H,
          ),
          cowl:
            cowl &&
            loft(
              cowl.stationAt,
              (x) => (HELI_ART.cowl + ((HELI_ART.cowlEnd - HELI_ART.cowl) * (x - cowl.x0)) / (cowl.x1 - cowl.x0)) * W,
              (r) => (1 - HELI_BAND * r) * H,
            ),
          fin: (x, y, side) => {
            const f = (x - fx0) / (fx1 - fx0);
            return [(side > 0 ? HELI_ART.finS + 0.25 * f : HELI_ART.finP + 0.25 * (1 - f)) * W, (1 - (HELI_BAND * (y - fy0)) / (fy1 - fy0)) * H];
          },
        };
      }
      /*
       * One word or emblem: on the sides (both unless `side`), reading forwards on
       * each, upright; on a top ('top', 'cowlTop') reading towards the nose with the
       * letters standing towards port (so a machine heading east reads on screen).
       */
      function heliPaintWord(g, surfaces, w, pxPerUnit) {
        const source = w.image ? { canvas: w.image() } : heliWordImage(w, pxPerUnit),
          img = source.canvas,
          unit = source.unit || w.height / img.height,
          len = img.width * unit,
          tall = img.height * unit,
          loft = w.surface.startsWith('cowl') ? surfaces.cowl : surfaces.body;
        if (!loft) return;
        if (w.surface === 'top' || w.surface === 'cowlTop') {
          heliWarp(g, img, (fu, fv) => loft.top(w.x + (fu - 0.5) * len, (w.z || 0) - (0.5 - fv) * tall));
          return;
        }
        for (const side of w.side ? [w.side] : [-1, 1])
          heliWarp(g, img, (fu, fv) => {
            const x = w.x + side * (fu - 0.5) * len,
              y = w.y + (0.5 - fv) * tall;
            return w.surface === 'fin' ? surfaces.fin(x, y, side) : loft.side(x, y, side);
          });
      }
      /*
       * The livery canvas: the loft (top three quarters: u along x, v round the
       * ring from the keel) painted per pixel from the surface, then the fin's two
       * faces, the cowl's loft and the swatches in the bottom quarter, then the
       * pinstripes, words and emblems. The big liveries paint their pixels at half
       * size (`paintScale`) and are drawn up to full size before the fine work,
       * which is canvas paths and text at full size. It is a job that yields
       * between slices: heliLiveryTexture runs it to the end at once, the title
       * screen's prewarm (prewarmHelicopters) a few milliseconds at a time.
       */
      const heliLiveryTextures = new Map(),
        heliLiveryJobs = new Map();
      function heliLiveryTexture(look, kit) {
        const done = heliLiveryTextures.get(look.key);
        if (done) return done;
        let job = heliLiveryJobs.get(look.key);
        if (!job) heliLiveryJobs.set(look.key, (job = heliLiveryJob(look, kit)));
        let step;
        do step = job.next();
        while (!step.done);
        return step.value || heliLiveryTextures.get(look.key);
      }
      function* heliLiveryJob(look, kit) {
        let busy = 0,
          slice = performance.now();
        const pause = () => (busy += performance.now() - slice),
          resume = () => (slice = performance.now()),
          { plan, cowl } = kit,
          scheme = heliScheme(look),
          W = look.tex || 1024,
          H = W / 2,
          scale = look.paintScale || 1,
          w = Math.round(W * scale),
          h = Math.round(H * scale),
          LOFT = Math.round(h * (1 - HELI_BAND)),
          image = new ImageData(w, h),
          data = image.data,
          span = plan.x1 - plan.x0,
          out = [0, 0, 0],
          pt = { y: 0, z: 0 },
          SEAL = [15, 17, 20],
          sootScale = look.kind === 'military' ? 1.3 : 1,
          put = (px, py) => {
            const k = (py * w + px) * 4;
            data[k] = out[0];
            data[k + 1] = out[1];
            data[k + 2] = out[2];
            data[k + 3] = 255;
          };
        // Column by column, so the scheme's curves see one x at a time (heliMonotone's memo).
        for (let px = 0; px < w; px++) {
          const st = heliStation(plan, plan.x0 + ((px + 0.5) / w) * span),
            x = st.x;
          for (let py = 0; py < LOFT; py++) {
            const theta = ((1 - (py + 0.5) / h - HELI_BAND) / (1 - HELI_BAND)) * TAU - Math.PI / 2;
            heliSection(st, theta, pt);
            const y = pt.y,
              z = pt.z;
            scheme.body(out, x, y, z, st);
            // Belly grime and exhaust soot.
            const low = Math.min(1, Math.max(0, (st.yw - y) / Math.max(0.5, st.yw - st.yb)));
            heliShade(out, 1 - 0.1 * low * low - 0.3 * plan.soot(x, y, z, st) * sootScale);
            // Panel seams, then the black rubber seals round the glazing.
            heliShade(out, 1 - 0.32 * heliCover(plan.seams(x, y, z, st) - 0.05, 0.05));
            heliMix(out, SEAL, heliCover(plan.windows(x, y, z, st, look.roofGlass) - 0.9, 0.1));
            put(px, py);
          }
          if (px % 48 === 47) {
            pause();
            yield;
            resume();
          }
        }
        // Both faces of the fin, the port face mirrored so its words read forwards.
        const [fx0, fx1, fy0, fy1] = plan.fin.art,
          quarter = w / 4;
        for (const side of [1, -1]) {
          const c0 = Math.round((side > 0 ? HELI_ART.finS : HELI_ART.finP) * w);
          for (let i = 0; i < quarter; i++) {
            const f = (i + 0.5) / quarter,
              x = fx0 + (side > 0 ? f : 1 - f) * (fx1 - fx0);
            for (let py = LOFT; py < h; py++) {
              scheme.fin(out, x, fy0 + ((h - py - 0.5) / (h - LOFT)) * (fy1 - fy0), side);
              put(c0 + i, py);
            }
          }
        }
        // The cowl, lofted like the fuselage.
        if (cowl) {
          const c0 = Math.round(HELI_ART.cowl * w),
            c1 = Math.round(HELI_ART.cowlEnd * w);
          for (let px = c0; px < c1; px++) {
            const st = cowl.stationAt(cowl.x0 + ((px - c0 + 0.5) / (c1 - c0)) * (cowl.x1 - cowl.x0));
            for (let py = LOFT; py < h; py++) {
              heliSection(st, ((h - py - 0.5) / (h - LOFT)) * TAU - Math.PI / 2, pt);
              scheme.body(out, st.x, pt.y, pt.z, st);
              put(px, py);
            }
          }
        }
        pause();
        yield;
        resume();
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const g = canvas.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        if (scale === 1) g.putImageData(image, 0, 0);
        else {
          const small = document.createElement('canvas');
          small.width = w;
          small.height = h;
          small.getContext('2d').putImageData(image, 0, 0);
          g.drawImage(small, 0, 0, W, H);
        }
        scheme.swatches.forEach((rgb, i) => {
          g.fillStyle = `rgb(${rgb.map(Math.round).join(',')})`;
          g.fillRect(Math.round(HELI_ART.swatch * W + (i * W) / 40), Math.round(H * (1 - HELI_BAND)), Math.ceil(W / 40), Math.round(H * HELI_BAND));
        });
        const surfaces = heliSurfaces(plan, cowl, W, H);
        // Pinstripes: bands of constant width along a height curve on both sides,
        // broken where they would cross the glazing's seals.
        for (const line of scheme.lines || []) {
          g.fillStyle = line.color;
          const x0 = line.x0 ?? plan.x0 + 0.3,
            x1 = line.x1 ?? plan.x1 - 0.3,
            n = Math.ceil(((x1 - x0) / span) * (W / 3));
          for (const side of [-1, 1]) {
            let run = [];
            const flush = () => {
              if (run.length > 1) {
                g.beginPath();
                run.forEach(([x, y, width]) => g.lineTo(...surfaces.body.side(x, y + width / 2, side)));
                for (let i = run.length - 1; i >= 0; i--) g.lineTo(...surfaces.body.side(run[i][0], run[i][1] - run[i][2] / 2, side));
                g.closePath();
                g.fill();
              }
              run = [];
            };
            for (let i = 0; i <= n; i++) {
              const x = x0 + ((x1 - x0) * i) / n,
                y = line.y(x),
                st = heliStation(plan, x),
                width = typeof line.width === 'function' ? line.width(x, st) : line.width;
              if (plan.windows(x, y, heliSurfaceZ(st, y, side), st, look.roofGlass) < 0.95 + width / 2 || y > st.yt - 0.05 || y < st.yb + 0.05) flush();
              else run.push([x, y, width]);
            }
            flush();
          }
        }
        // Words, registrations and emblems, warped onto the surfaces.
        for (const word of scheme.words || []) {
          heliPaintWord(g, surfaces, word, W / span);
          pause();
          yield;
          resume();
        }
        const texture = policeCanvasTexture(canvas);
        pause();
        texture.userData.paintMs = Math.round(busy);
        heliLiveryTextures.set(look.key, texture);
        heliLiveryJobs.delete(look.key);
        return texture;
      }
      const heliSwatchUv = (name) => [HELI_ART.swatch + (HELI_SWATCH[name] + 0.5) / 40, HELI_BAND / 2];
      // The fin's faces into their halves of the fin art (the port face mirrored).
      function heliFinUv(geo, art) {
        const [fx0, fx1, fy0, fy1] = art,
          pos = geo.attributes.position,
          nor = geo.attributes.normal,
          uv = geo.attributes.uv;
        for (let k = 0; k < pos.count; k++) {
          const f = clamp((pos.getX(k) - fx0) / (fx1 - fx0), 0.004, 0.996),
            v = HELI_BAND * clamp((pos.getY(k) - fy0) / (fy1 - fy0), 0.01, 0.99);
          uv.setXY(k, nor.getZ(k) < -0.3 ? HELI_ART.finP + 0.25 * (1 - f) : HELI_ART.finS + 0.25 * f, v);
        }
      }
      // ---- Words and numbers on the skin (police glyph atlas) -------------------------------
      function heliText(set, plan, text, o) {
        const atlas = policeGlyphs(),
          h = o.height,
          gap = h * 0.06,
          chars = [...text],
          advance = (ch) => (ch === ' ' ? 0.34 : atlas.advance[ch] || 0) * h,
          quad = (GLYPH_CELL_W / GLYPH_CELL_H) * h,
          lift = 0.07;
        let total = -gap;
        for (const ch of chars) total += advance(ch) + gap;
        let cursor = -total / 2;
        heliColor.set(o.color);
        for (const ch of chars) {
          const i = POLICE_GLYPHS.indexOf(ch);
          if (i >= 0) {
            const u0 = ((i % GLYPHS_PER_ROW) * GLYPH_CELL_W) / 1024,
              u1 = u0 + GLYPH_CELL_W / 1024,
              v1 = 1 - (Math.floor(i / GLYPHS_PER_ROW) * GLYPH_CELL_H) / atlas.height,
              v0 = v1 - GLYPH_CELL_H / atlas.height,
              centre = cursor + advance(ch) / 2,
              base = set.count;
            for (const [a, b] of [
              [-0.5, -0.5],
              [0.5, -0.5],
              [0.5, 0.5],
              [-0.5, 0.5],
            ]) {
              const along = centre + a * quad,
                up = b * h;
              let x, y, z, nx, ny, nz;
              if (o.surface === 'top') {
                // Along the airframe, glyphs standing towards port: reads heading east.
                x = o.x + along;
                z = o.z - up;
                y = heliSurfaceTop(heliStation(plan, x), z) + lift;
                nx = 0;
                ny = 1;
                nz = 0;
              } else {
                x = o.x + o.side * along;
                y = o.y + up;
                z = o.surface === 'fin' ? o.side * (plan.fin.thick / 2 + 0.36) : heliSurfaceZ(heliStation(plan, x), y, o.side) + o.side * lift;
                nx = 0;
                ny = 0;
                nz = o.side;
              }
              heliPushVertex(set, x, y, z, nx, ny, nz, a < 0 ? u0 : u1, b < 0 ? v0 : v1, heliColor);
            }
            set.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
          cursor += advance(ch) + gap;
        }
      }
