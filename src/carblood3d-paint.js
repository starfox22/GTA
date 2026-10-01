      // Car blood 3D, painting: primitives of the thickness field (drops, domes, the impact mass, spray, mist), drawn in time slices.
      // ---- Painting -----------------------------------------------------------------------
      /*
       * One canvas per car holds every stain as a FIELD: R is how thick the blood lies
       * (0 none .. 1 a bead), G when the airflow's streak reaches the pixel (0 at once, 1 when
       * the stain's `flow` is complete), B when a gravity run reaches it (0 none, else the
       * stain's `creep`), all combined with 'lighten' (the thicker wins), so drops and lobes
       * keep their own domes. The shader turns thickness into colour, cover, gloss and
       * normals, and the age into wet or dry, so nothing here is coloured: a thin film is
       * translucent and bright, a thick one dark, every rim has a meniscus. A paint context
       * `c`: g (the tile's 2D context, scaled so one unit is one metre; x right, y DOWN,
       * gravity on a face tile); (ix, iy) the impact, (dx, dy) the unit direction the blood
       * is carried; ga / ba the arrival values the next primitive writes into G and B.
       * Every stage is a generator: it yields (bare `yield`) when the frame's slice is spent.
       */
      let cbDeadline = 0;
      const cbOver = () => performance.now() >= cbDeadline,
        // Thickness v, with the arrival values times it (a soft edge then keeps the ratio the shader reads back).
        cbCol = (c, v) => {
          const r = clamp(v, 0, 1) * 255;
          return 'rgb(' + (r | 0) + ',' + ((c.ga * r) | 0) + ',' + ((c.ba * r) | 0) + ')';
        },
        CB_SPECK_BUCKETS = 5;
      // The unit-circle outline of a blob (a little irregular), for filling under a transform.
      function cbUnitBlob(rnd, jag, points = 12) {
        const path = new Path2D(),
          ph = rnd() * TAU,
          f = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < points; i++) {
          const a = (i / points) * TAU,
            r = 1 - jag + jag * (0.5 + 0.5 * Math.sin(a * f + ph)) * 1.4 + (rnd() - 0.5) * jag * 0.6;
          path[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
        }
        path.closePath();
        return path;
      }
      const cbCircle = (() => {
        const p = new Path2D();
        p.arc(0, 0, 1, 0, TAU);
        return p;
      })();
      // The dome sprites, one strip of six peak levels on one canvas made once (in the warm-up, else at the first drop):
      // the gradient a drop is drawn with, so a drop is one drawImage.
      let cbDomeAtlas = null;
      function cbMakeDomeAtlas() {
        const canvas = document.createElement('canvas');
        canvas.width = 64 * 6;
        canvas.height = 64;
        const g = canvas.getContext('2d'),
          rgb = (v) => 'rgb(' + ((Math.min(1, v) * 255) | 0) + ',0,0)';
        for (let level = 0; level < 6; level++) {
          const top = 0.5 + level * 0.1,
            x = level * 64 + 32,
            gr = g.createRadialGradient(x - 0.12 * 31, 32, 0, x, 32, 31);
          gr.addColorStop(0, rgb(top));
          gr.addColorStop(0.55, rgb(top * 0.86));
          gr.addColorStop(0.88, rgb(top * 0.5));
          gr.addColorStop(1, rgb(Math.min(0.2, top * 0.4)));
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, 32, 31, 0, TAU);
          g.fill();
        }
        cbDomeAtlas = canvas;
      }
      // A dome: peak at the middle, a steep meniscus at the rim. Plain ones (no arrival values, a smooth outline) are sprites.
      function cbDome(c, x, y, rx, ry, ang, peak, jag = 0.06) {
        const g = c.g;
        g.save();
        g.translate(x, y);
        g.rotate(ang);
        g.scale(rx, ry);
        if (jag <= 0.1 && c.ga === 0 && c.ba === 0) {
          if (!cbDomeAtlas) cbMakeDomeAtlas();
          g.drawImage(cbDomeAtlas, Math.max(0, Math.min(5, Math.round((peak - 0.5) * 10))) * 64, 0, 64, 64, -1, -1, 2, 2);
        }
        else {
          const gr = g.createRadialGradient(-0.12, 0, 0, 0, 0, 1);
          gr.addColorStop(0, cbCol(c, peak));
          gr.addColorStop(0.55, cbCol(c, peak * 0.86));
          gr.addColorStop(0.88, cbCol(c, peak * 0.5));
          gr.addColorStop(1, cbCol(c, Math.min(0.2, peak * 0.4)));
          g.fillStyle = gr;
          g.fill(jag > 0 ? cbUnitBlob(c.rnd, jag) : cbCircle);
        }
        g.restore();
      }
      // Specks too small to show a dome are drawn in batches by level (lighten is order-free): one fill for hundreds.
      function cbSpeck(c, x, y, rx, ry, v) {
        const list = c.specks[Math.min(CB_SPECK_BUCKETS - 1, (v * CB_SPECK_BUCKETS) | 0)];
        list.push(x, y, rx, ry);
      }
      function cbFlushSpecks(c) {
        const g = c.g,
          ga = c.ga,
          ba = c.ba;
        c.ga = c.ba = 0;
        for (let k = 0; k < CB_SPECK_BUCKETS; k++) {
          const list = c.specks[k];
          if (!list.length) continue;
          g.fillStyle = cbCol(c, (k + 0.5) / CB_SPECK_BUCKETS);
          g.beginPath();
          for (let i = 0; i < list.length; i += 4) g.rect(list[i] - list[i + 2], list[i + 1] - list[i + 3], list[i + 2] * 2, list[i + 3] * 2);
          g.fill();
          list.length = 0;
        }
        c.ga = ga;
        c.ba = ba;
      }
      // One drop along `ang`: a sub-pixel speck, a flat plate or a dome by its size on screen.
      function cbDrop(c, x, y, rx, ry, ang, strength = 1) {
        const px = Math.min(rx, ry) * c.pxs;
        if (px < 1.5) {
          if (px < 0.5) {
            rx *= 0.5 / px;
            ry *= 0.5 / px;
          }
          cbSpeck(c, x, y, rx, ry, (0.3 + 0.25 * px) * (px < 0.5 ? px / 0.5 : 1) * strength);
        } else cbDome(c, x, y, rx, ry, ang, (0.52 + Math.min(0.46, px * 0.06)) * strength, px > 3 ? 0.07 : 0.03);
      }
      // A teardrop flung along `ang`: a round head and a thin tail back toward the source.
      function cbTear(c, x, y, r, stretch, ang) {
        cbDrop(c, x, y, r * stretch, r, ang);
        if (r * c.pxs < 1.2 || stretch < 1.5) return;
        const g = c.g,
          ca = Math.cos(ang),
          sa = Math.sin(ang),
          back = r * stretch * (1.2 + c.rnd() * 1.8),
          o = r * stretch * 0.6;
        g.fillStyle = cbCol(c, 0.42);
        g.beginPath();
        g.moveTo(x - ca * o - sa * r * 0.4, y - sa * o + ca * r * 0.4);
        g.lineTo(x - ca * (o + back), y - sa * (o + back));
        g.lineTo(x - ca * o + sa * r * 0.4, y - sa * o - ca * r * 0.4);
        g.closePath();
        g.fill();
      }
      function cbGauss(rnd) {
        return (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
      }
      // Where a flung drop goes: half follow the carried direction (a fan), half scatter all round.
      function cbFlight(c, R, reach, directed, fan) {
        const rnd = c.rnd,
          base = Math.atan2(c.dy, c.dx),
          away = rnd() < directed,
          a = away ? base + cbGauss(rnd) * fan : rnd() * TAU,
          e = -Math.log(1 - rnd() * 0.999),
          d = R * (0.85 + e * reach * (away ? 1.45 : 0.8));
        return { x: c.ix + Math.cos(a) * d, y: c.iy + Math.sin(a) * d, a, e, away };
      }
      // The impact: a mass of pooled lobes with a thicker middle, pointed fingers thrown out of it, a crown of drops.
      function* cbCore(c, R, s, lobesScale = 1) {
        const { rnd, g } = c,
          base = Math.atan2(c.dy, c.dx),
          // Lobes lie along the carried direction when the body slid (a bonnet), any way on a face.
          lobe = (x, y, r, peak) => cbDome(c, x, y, r * c.squash, r, c.align ? base + (rnd() - 0.5) * 1.1 : rnd() * TAU, peak, 0.3);
        // Fingers: short, broad at the root, drawn to a point, sometimes a bulb.
        const arms = (c.align ? 5 : 7) + Math.round((c.align ? 7 : 12) * s);
        for (let i = 0; i < arms; i++) {
          if ((i & 3) === 3 && cbOver()) yield;
          const fly = cbFlight(c, R, 0.5, c.align ? 0.85 : 0.65, c.align ? 0.55 : 0.8),
            a = fly.a,
            len = R * (0.5 + Math.pow(rnd(), 1.5) * (0.6 + (c.align ? 0.6 : 1) * s)) * (fly.away ? 1.25 : 1),
            w0 = R * (0.15 + 0.24 * rnd()),
            curve = (rnd() - 0.5) * 0.7,
            bulb = rnd() < 0.3,
            steps = 8,
            ca = Math.cos(a),
            sa = Math.sin(a),
            px = -sa,
            py = ca,
            pts = [];
          for (let k = 0; k <= steps; k++) {
            const t = k / steps,
              bend = Math.sin(t * Math.PI * 0.9) * curve * len * 0.45,
              dd = R * 0.2 + t * len;
            pts.push([c.ix + ca * dd + px * bend, c.iy + sa * dd + py * bend, w0 * Math.pow(1 - t, 0.85) * (1 + (bulb && t > 0.6 && t < 0.92 ? 0.55 : 0)) + 0.0009]);
          }
          // Three passes, narrower and thicker each, make a rounded section.
          for (const [scale, level] of [
            [1, 0.3],
            [0.62, 0.5],
            [0.3, 0.68],
          ]) {
            const arm = new Path2D();
            for (let k = 0; k <= steps; k++) arm[k ? 'lineTo' : 'moveTo'](pts[k][0] + px * pts[k][2] * scale, pts[k][1] + py * pts[k][2] * scale);
            for (let k = steps; k >= 0; k--) arm.lineTo(pts[k][0] - px * pts[k][2] * scale, pts[k][1] - py * pts[k][2] * scale);
            arm.closePath();
            g.fillStyle = cbCol(c, level);
            g.fill(arm);
          }
          const tip = pts[steps];
          if (rnd() < 0.5) {
            const r = w0 * (0.3 + rnd() * 0.45);
            cbDrop(c, tip[0] + ca * (w0 * 1.1 + r), tip[1] + sa * (w0 * 1.1 + r), r * (1.2 + rnd()), r, a);
          }
        }
        // The mass: broad low lobes, then thicker ones inside, then the pool's heart.
        for (let i = 0, n = Math.round((14 + 12 * s) * lobesScale); i < n; i++) {
          const a = rnd() * TAU,
            d = R * 0.62 * Math.sqrt(rnd());
          lobe(c.ix + Math.cos(a) * d * c.squash, c.iy + Math.sin(a) * d, R * (0.32 + rnd() * 0.5), 0.5 + rnd() * 0.15);
        }
        if (cbOver()) yield;
        for (let i = 0; i < 6 + 5 * s; i++) {
          const a = rnd() * TAU,
            d = R * 0.45 * Math.sqrt(rnd());
          lobe(c.ix + Math.cos(a) * d * c.squash, c.iy + Math.sin(a) * d, R * (0.22 + rnd() * 0.32), 0.68 + rnd() * 0.14);
        }
        for (let i = 0; i < 2 + 3 * s; i++) {
          const a = rnd() * TAU,
            d = R * 0.25 * Math.sqrt(rnd());
          lobe(c.ix + Math.cos(a) * d * c.squash, c.iy + Math.sin(a) * d, R * (0.14 + rnd() * 0.2), 0.86 + rnd() * 0.12);
        }
        if (cbOver()) yield;
        // A crown of medium drops just outside, each drawn out along the way it flew.
        for (let i = 0; i < 10 + 12 * s; i++) {
          const f = cbFlight(c, R, 0.35, 0.55, 0.9),
            r = R * (0.08 + rnd() * 0.16);
          cbDrop(c, f.x, f.y, r * (1 + rnd() * 1.2), r, f.a);
        }
        // Fine drops packed close round the mass.
        for (let i = 0; i < 50 + 110 * s; i++) {
          const f = cbFlight(c, R, 0.25, 0.4, 1.1),
            r = R * (0.012 + rnd() * rnd() * 0.06);
          cbDrop(c, f.x, f.y, r, r * (0.8 + rnd() * 0.4), rnd() * TAU);
        }
        cbFlushSpecks(c);
      }
      // The thrown spray: round and drawn-out drops, near ones big, far ones fine.
      function* cbSpray(c, R, s, count, directed, fan, stretchAmount) {
        const rnd = c.rnd;
        for (let i = 0; i < count; i++) {
          if ((i & 63) === 63 && cbOver()) yield;
          const f = cbFlight(c, R, 1.4 + 2.2 * s, directed, fan),
            size = (0.0012 + Math.pow(rnd(), 3.2) * (0.013 + 0.013 * s)) / (1 + f.e * 0.42),
            stretch = f.away ? 1 + rnd() * stretchAmount * (0.5 + rnd()) : 1 + rnd() * 0.25;
          if (stretch > 1.5) cbTear(c, f.x, f.y, size, stretch, f.a + (rnd() - 0.5) * 0.25);
          else cbDrop(c, f.x, f.y, size, size * (0.85 + rnd() * 0.3), rnd() * TAU);
        }
        cbFlushSpecks(c);
      }
      // Fine mist: sub-millimetre specks, densest near the impact and downwind.
      function* cbMist(c, R, s, count, directed) {
        const rnd = c.rnd;
        for (let i = 0; i < count; i++) {
          if ((i & 255) === 255 && cbOver()) yield;
          const f = cbFlight(c, R, 2.6 + 3 * s, directed, 1.0),
            r = (0.45 + rnd() * 0.5) / c.pxs;
          cbSpeck(c, f.x + cbGauss(rnd) * R * 0.25, f.y + cbGauss(rnd) * R * 0.25, r, r, 0.1 + rnd() * 0.3);
        }
        cbFlushSpecks(c);
      }
      // Fades the tile's edge to nothing so no stain ends in a hard line.
      function cbFadeEdges(c) {
        const T = CB_TILE,
          m = T * 0.07,
          g = c.g;
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'multiply';
        const edge = (x0, y0, x1, y1, w, h) => {
          const gr = g.createLinearGradient(x0, y0, x1, y1);
          gr.addColorStop(0, 'rgb(0,0,0)');
          gr.addColorStop(1, 'rgb(255,255,255)');
          g.fillStyle = gr;
          g.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
        };
        edge(0, 0, m, 0, m, T);
        edge(T, 0, T - m, 0, m, T);
        edge(0, 0, 0, m, T, m);
        edge(0, T, 0, T - m, T, m);
        g.restore();
      }
