      // Car blood 3D, painting: the thickness field of a stain (drops, lobes, runs, smears, mist) drawn once per hit.
      // ---- Painting -----------------------------------------------------------------------
      /*
       * One canvas per car holds every stain as a THICKNESS FIELD: R is how thick the blood
       * lies (0 none .. 1 a bead), G when a run reaches the pixel, all combined with
       * 'lighten' (the thicker wins), so drops and lobes keep their own domes. The shader
       * turns thickness into colour, cover, gloss and normals, and the age into wet or dry,
       * so nothing here is coloured: a thin film is translucent and bright, a thick one
       * dark, every rim has a meniscus. A paint context `c`: g (the tile's 2D context,
       * translated and scaled so one unit is one metre; x right, y DOWN, gravity on a face
       * tile); (ix, iy) the impact, (dx, dy) the unit direction the blood is carried.
       */
      const cbV = (v, g = 0) => `rgb(${Math.round(clamp(v, 0, 1) * 255)},${g},0)`,
        cbVA = (v, a) => `rgba(${Math.round(clamp(v, 0, 1) * 255)},0,0,${a})`;
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
      // A dome: peak at the middle, a steep meniscus at the rim.
      function cbDome(c, x, y, rx, ry, ang, peak, jag = 0.06) {
        const g = c.g;
        g.save();
        g.translate(x, y);
        g.rotate(ang);
        g.scale(rx, ry);
        const gr = g.createRadialGradient(-0.12, 0, 0, 0, 0, 1);
        gr.addColorStop(0, cbV(peak));
        gr.addColorStop(0.55, cbV(peak * 0.86));
        gr.addColorStop(0.88, cbV(peak * 0.5));
        gr.addColorStop(1, cbV(Math.min(0.2, peak * 0.4)));
        g.fillStyle = gr;
        g.fill(jag > 0 ? cbUnitBlob(c.rnd, jag) : cbCircle);
        g.restore();
      }
      const cbCircle = (() => {
        const p = new Path2D();
        p.arc(0, 0, 1, 0, TAU);
        return p;
      })();
      // One drop along `ang`: a sub-pixel speck, a flat plate or a dome by its size on screen.
      function cbDrop(c, x, y, rx, ry, ang, strength = 1) {
        const px = Math.min(rx, ry) * c.pxs,
          g = c.g;
        if (px < 1.5) {
          const k = px < 0.5 ? px / 0.5 : 1;
          if (px < 0.5) {
            rx *= 0.5 / px;
            ry *= 0.5 / px;
          }
          g.fillStyle = cbV((0.3 + 0.25 * px) * k * strength);
          g.beginPath();
          g.ellipse(x, y, rx, ry, ang, 0, TAU);
          g.fill();
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
        g.fillStyle = cbV(0.42);
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
      function cbCore(c, R, s, lobesScale = 1) {
        const { rnd, g } = c,
          lobe = (x, y, r, peak) => cbDome(c, x, y, r * c.squash, r, rnd() * TAU, peak, 0.3);
        // Fingers: short, broad at the root, drawn to a point, sometimes a bulb.
        const arms = 7 + Math.round(13 * s);
        for (let i = 0; i < arms; i++) {
          const fly = cbFlight(c, R, 0.5, 0.6, 0.8),
            a = fly.a,
            len = R * (0.7 + Math.pow(rnd(), 1.5) * (0.9 + 1.2 * s)) * (fly.away ? 1.25 : 1),
            w0 = R * (0.12 + 0.2 * rnd()),
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
            g.fillStyle = cbV(level);
            g.fill(arm);
          }
          const tip = pts[steps];
          if (rnd() < 0.5) {
            const r = w0 * (0.3 + rnd() * 0.45);
            cbDrop(c, tip[0] + ca * (w0 * 1.1 + r), tip[1] + sa * (w0 * 1.1 + r), r * (1.2 + rnd()), r, a);
          }
        }
        // The mass: broad low lobes, then thicker ones inside, then the pool's heart.
        for (let i = 0, n = Math.round((12 + 10 * s) * lobesScale); i < n; i++) {
          const a = rnd() * TAU,
            d = R * 0.62 * Math.sqrt(rnd());
          lobe(c.ix + Math.cos(a) * d * c.squash, c.iy + Math.sin(a) * d, R * (0.32 + rnd() * 0.5), 0.5 + rnd() * 0.15);
        }
        for (let i = 0; i < 5 + 4 * s; i++) {
          const a = rnd() * TAU,
            d = R * 0.45 * Math.sqrt(rnd());
          lobe(c.ix + Math.cos(a) * d * c.squash, c.iy + Math.sin(a) * d, R * (0.22 + rnd() * 0.32), 0.68 + rnd() * 0.14);
        }
        for (let i = 0; i < 2 + 2 * s; i++) {
          const a = rnd() * TAU,
            d = R * 0.25 * Math.sqrt(rnd());
          lobe(c.ix + Math.cos(a) * d * c.squash, c.iy + Math.sin(a) * d, R * (0.14 + rnd() * 0.2), 0.86 + rnd() * 0.12);
        }
        // A crown of medium drops just outside, each drawn out along the way it flew.
        for (let i = 0; i < 8 + 10 * s; i++) {
          const f = cbFlight(c, R, 0.35, 0.55, 0.9),
            r = R * (0.08 + rnd() * 0.16);
          cbDrop(c, f.x, f.y, r * (1 + rnd() * 1.2), r, f.a);
        }
        // Fine drops packed close round the mass.
        for (let i = 0; i < 40 + 90 * s; i++) {
          const f = cbFlight(c, R, 0.25, 0.4, 1.1),
            r = R * (0.012 + rnd() * rnd() * 0.06);
          cbDrop(c, f.x, f.y, r, r * (0.8 + rnd() * 0.4), rnd() * TAU);
        }
      }
      // The thrown spray: round and drawn-out drops, near ones big, far ones fine.
      function cbSpray(c, R, s, count, directed, fan, stretchAmount) {
        const rnd = c.rnd;
        for (let i = 0; i < count; i++) {
          const f = cbFlight(c, R, 1.4 + 2.2 * s, directed, fan),
            size = (0.0012 + Math.pow(rnd(), 3.2) * (0.011 + 0.011 * s)) / (1 + f.e * 0.42),
            stretch = f.away ? 1 + rnd() * stretchAmount * (0.5 + rnd()) : 1 + rnd() * 0.25;
          if (stretch > 1.5) cbTear(c, f.x, f.y, size, stretch, f.a + (rnd() - 0.5) * 0.25);
          else cbDrop(c, f.x, f.y, size, size * (0.85 + rnd() * 0.3), rnd() * TAU);
        }
      }
      // Fine mist: sub-millimetre specks, densest near the impact and downwind.
      function cbMist(c, R, s, count, directed) {
        const { rnd, g } = c;
        for (let i = 0; i < count; i++) {
          const f = cbFlight(c, R, 2.6 + 3 * s, directed, 1.0),
            r = (0.45 + rnd() * 0.5) / c.pxs;
          g.fillStyle = cbV(0.1 + rnd() * 0.3);
          g.beginPath();
          g.arc(f.x + cbGauss(rnd) * R * 0.25, f.y + cbGauss(rnd) * R * 0.25, r, 0, TAU);
          g.fill();
        }
      }
      // The airflow's wipe: thin films dragged along the carried direction, broad faint veils.
      function cbSmear(c, R, s, length) {
        const { rnd, g } = c,
          ca = c.dx,
          sa = c.dy,
          px = -sa,
          py = ca;
        if (length < 0.05) return;
        const n = 14 + Math.round(40 * s);
        for (let i = 0; i < n; i++) {
          const off = cbGauss(rnd) * R * 0.85,
            start = -R * 0.3 + rnd() * R * 1.4,
            len = length * (0.25 + rnd() * 0.75),
            wide = false,
            w = 0.0025 + rnd() * rnd() * 0.016,
            level = 0.08 + rnd() * 0.1,
            x0 = c.ix + ca * start + px * off,
            y0 = c.iy + sa * start + py * off,
            wob = (rnd() - 0.5) * len * 0.12,
            x1 = x0 + ca * len + px * wob,
            y1 = y0 + sa * len + py * wob,
            gr = g.createLinearGradient(x0, y0, x1, y1);
          gr.addColorStop(0, cbVA(level, 1));
          gr.addColorStop(0.6, cbVA(level, 0.55));
          gr.addColorStop(1, cbVA(level, 0));
          g.strokeStyle = gr;
          g.lineWidth = w;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(x0, y0);
          g.quadraticCurveTo((x0 + x1) / 2 + px * wob * 0.6, (y0 + y1) / 2 + py * wob * 0.6, x1, y1);
          g.stroke();
        }
      }
      // Runs: slow drips that follow gravity, each ending in a bead; G is when each pixel is reached.
      function cbRuns(c, R, s, reach) {
        const { rnd, g } = c,
          count = Math.round((3 + 9 * s) * (1 - 0.5 * c.speed));
        for (let i = 0; i < count; i++) {
          const x0 = c.ix + cbGauss(rnd) * R * 1.1,
            y0 = c.iy + (rnd() - 0.3) * R,
            len = reach * (0.04 + Math.pow(rnd(), 2) * 0.75) * (1 - 0.4 * c.speed),
            w = 0.0022 + rnd() * 0.0042,
            steps = Math.max(3, Math.round(len / 0.02));
          if (len < 0.025) continue;
          let x = x0,
            y = y0,
            drift = 0;
          const pts = [[x, y, w * 1.6]];
          for (let k = 1; k <= steps; k++) {
            drift += (rnd() - 0.5) * 0.006;
            drift *= 0.8;
            x += drift + c.dx * 0.0025 * c.speed;
            y += (len / steps) * (0.7 + rnd() * 0.6);
            pts.push([x, y, w * (0.75 + 0.5 * rnd()) * (1 - 0.3 * (k / steps))]);
          }
          g.lineCap = 'round';
          g.lineJoin = 'round';
          // Section: wide and thin, narrower and thicker.
          for (const [scale, level] of [
            [2.2, 0.26],
            [1.4, 0.44],
            [0.7, 0.62],
          ]) {
            g.strokeStyle = cbV(level);
            for (let k = 1; k < pts.length; k++) {
              g.lineWidth = pts[k][2] * scale;
              g.beginPath();
              g.moveTo(pts[k - 1][0], pts[k - 1][1]);
              g.lineTo(pts[k][0], pts[k][1]);
              g.stroke();
            }
          }
          const last = pts[pts.length - 1],
            br = w * (1.25 + rnd() * 0.6),
            gr = g.createLinearGradient(0, y0, 0, last[1] + br);
          gr.addColorStop(0, 'rgb(0,4,0)');
          gr.addColorStop(1, 'rgb(0,250,0)');
          g.strokeStyle = gr;
          g.lineWidth = w * 2.6;
          g.beginPath();
          g.moveTo(pts[0][0], pts[0][1]);
          for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
          g.stroke();
          cbDome(c, last[0], last[1] + br * 0.5, br, br * 1.3, Math.PI / 2, 0.85, 0);
          g.fillStyle = 'rgb(0,250,0)';
          g.beginPath();
          g.ellipse(last[0], last[1] + br * 0.5, br * 1.1, br * 1.4, 0, 0, TAU);
          g.fill();
        }
      }
      // Fades the tile's edge to nothing so no stain ends in a hard line.
      function cbFadeEdges(c) {
        const T = CB_TILE,
          m = T * 0.07,
          g = c.g;
        g.save();
        g.setTransform(1, 0, 0, 1, c.ox, c.oy);
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
      // Top tile: the bonnet. +x along the carried direction, the impact 27% in.
      function cbPaintTop(c) {
        const s = c.sev,
          R = 0.05 + 0.14 * s,
          smear = (0.25 + 0.9 * c.speed) * (0.4 + 0.6 * s);
        cbSmear(c, R, s, smear * 1.3);
        cbCore(c, R, s);
        cbSpray(c, R, s, Math.round(120 + 640 * s), 0.6, 0.6, 2.6 * (0.4 + c.speed));
        cbMist(c, R, s, Math.round(350 + 1500 * s), 0.6);
        // Threads trailing the biggest beads (the air pulls them back).
        for (let i = 0; i < 6 + 20 * s; i++) {
          const f = cbFlight(c, R, 1.0, 0.7, 0.6),
            len = 0.04 + c.rnd() * 0.16 * (0.4 + c.speed);
          c.g.strokeStyle = cbV(0.2);
          c.g.lineWidth = 0.0018 + c.rnd() * 0.002;
          c.g.beginPath();
          c.g.moveTo(f.x, f.y);
          c.g.lineTo(f.x + c.dx * len, f.y + c.dy * len);
          c.g.stroke();
        }
      }
      // Face tile: bumper, grille or flank. The impact 36% up; drops thrown up and back, runs down.
      function cbPaintFace(c) {
        const s = c.sev,
          R = 0.035 + 0.1 * s;
        c.squash = 1.35;
        cbSmear(c, R, s, (0.12 + 0.6 * c.speed) * (0.4 + 0.6 * s));
        cbRuns(c, R, s, c.Hm * 0.62);
        cbCore(c, R, s, 0.9);
        cbSpray(c, R, s, Math.round(90 + 420 * s), 0.55, 0.85, 2.0 * (0.4 + c.speed));
        cbMist(c, R, s, Math.round(250 + 1000 * s), 0.55);
      }
      // Both tiles of one stain: `panels` from cbPanels, slots from the skin.
      function cbPaintEvent(skin, event) {
        const t0 = performance.now(),
          g = skin.g;
        for (const panel of event.panels) {
          const slot = panel.slot,
            ox = (slot % CB_COLS) * CB_TILE,
            oy = Math.floor(slot / CB_COLS) * CB_TILE,
            sx = CB_TILE / panel.Wm,
            sy = CB_TILE / panel.Hm;
          g.save();
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.beginPath();
          g.rect(ox, oy, CB_TILE, CB_TILE);
          g.clip();
          g.fillStyle = '#000';
          g.fillRect(ox, oy, CB_TILE, CB_TILE);
          g.setTransform(sx, 0, 0, sy, ox, oy);
          g.globalCompositeOperation = 'lighten';
          const c = {
            g,
            ox,
            oy,
            rnd: cbRandom(event.stain.seed + panel.kindSeed),
            sev: event.stain.sev,
            speed: clamp(event.stain.kph / 90, 0, 1.2),
            Wm: panel.Wm,
            Hm: panel.Hm,
            pxs: Math.sqrt(sx * sy),
            ix: panel.fu * panel.Wm,
            iy: (1 - panel.fv) * panel.Hm,
            dx: panel.dirx,
            dy: panel.diry,
            squash: 1,
          };
          if (panel.kind === 'top') cbPaintTop(c);
          else cbPaintFace(c);
          g.restore();
          cbFadeEdges(c);
        }
        skin.texture.needsUpdate = true;
        carBloodPaintMs = performance.now() - t0;
      }
