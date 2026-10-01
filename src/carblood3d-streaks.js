      // Car blood 3D, streaks: the strands the airflow drags back along the bonnet, the gravity runs, and the two tile compositions.
      // ---- Streaks and the tiles ----------------------------------------------------------
      /*
       * G and B hold arrival values times the thickness (so a soft edge keeps its ratio):
       * a pixel's `ga` is the share of the stain's `flow` that must pass before the airflow
       * has dragged blood to it (the strands grow at their own speeds, so they end ragged
       * wherever the car stopped), its `ba` the share of `creep` for a gravity run. A strand
       * is a tapered ribbon with ragged edges and a gradient along it; a few ropes are thick,
       * rounded in section and end in a bead; hairlines and faint veils feather the band.
       */
      const cbRGB = (r, g, b) => 'rgb(' + ((clamp(r, 0, 1) * 255) | 0) + ',' + ((clamp(g, 0, 1) * 255) | 0) + ',' + ((clamp(b, 0, 1) * 255) | 0) + ')';
      // One strand from (x, y) along `a` for `len` metres. o: w half-width at the start, level thickness there, tail
      // the share of it left at the end, taper how much it narrows, meander and wave (metres) how it wanders, g0 / g1
      // the arrival value at the start / end (and b0 / b1 for a gravity run), shoulder a wider thinner pass under the
      // core, head a bead of that many half-widths, patches wet thick beads along it.
      function cbStrand(c, o) {
        const { rnd, g } = c,
          steps = clamp(Math.round(o.len / 0.04), 3, 24),
          ca = Math.cos(o.a),
          sa = Math.sin(o.a),
          px = -sa,
          py = ca,
          xs = [],
          ys = [],
          hw = [],
          jag = o.jag || 0.22,
          lambda = 0.22 + rnd() * 0.4,
          phase = rnd() * TAU,
          wide = 2 + rnd() * 3,
          phase2 = rnd() * TAU;
        let lat = 0,
          vel = 0;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          vel = vel * 0.82 + (rnd() - 0.5) * o.meander;
          lat += vel;
          const bend = (o.wave || 0) * Math.sin((t * o.len * TAU) / lambda + phase);
          xs.push(o.x + ca * t * o.len + px * (lat + bend));
          ys.push(o.y + sa * t * o.len + py * (lat + bend));
          hw.push(o.w * (1 - o.taper * Math.pow(t, 1.2)) * (1 + 0.28 * Math.sin(t * wide * TAU + phase2)) * (0.88 + rnd() * 0.24) + 0.0003);
        }
        const rim = [],
          rimBack = [];
        for (let k = 0; k <= steps; k++) {
          rim.push(1 - jag + rnd() * jag * 2);
          rimBack.push(1 - jag + rnd() * jag * 2);
        }
        const r0 = o.level,
          r1 = o.level * o.tail,
          g0 = o.g0 || 0;
        for (const [wider, share] of o.shoulder
          ? [
              [1.9, 0.5],
              [1, 1],
            ]
          : [[1, 1]]) {
          const path = new Path2D();
          for (let k = 0; k <= steps; k++) path[k ? 'lineTo' : 'moveTo'](xs[k] + px * hw[k] * wider * rim[k], ys[k] + py * hw[k] * wider * rim[k]);
          for (let k = steps; k >= 0; k--) path.lineTo(xs[k] - px * hw[k] * wider * rimBack[k], ys[k] - py * hw[k] * wider * rimBack[k]);
          path.closePath();
          const gr = g.createLinearGradient(xs[0], ys[0], xs[steps], ys[steps]);
          gr.addColorStop(0, cbRGB(r0 * share, g0 * r0 * share, o.b0 * r0 * share));
          gr.addColorStop(1, cbRGB(r1 * share, o.g1 * r1 * share, o.b1 * r1 * share));
          g.fillStyle = gr;
          g.fill(path);
        }
        const saveG = c.ga,
          saveB = c.ba;
        // Wet beads along it: short thick domes lying along the strand.
        for (let i = 0; i < (o.patches || 0); i++) {
          const k = 1 + Math.floor(rnd() * (steps - 1)),
            t = k / steps,
            rb = hw[k] * (1.1 + rnd() * 0.7);
          c.ga = g0 + (o.g1 - g0) * t;
          c.ba = o.b0 + (o.b1 - o.b0) * t;
          cbDome(c, xs[k], ys[k], rb * (2.2 + rnd() * 3), rb, o.a, Math.min(0.95, r0 * (0.9 + rnd() * 0.4) + 0.2), 0.12);
        }
        if (o.head) {
          const rb = o.w * o.head;
          c.ga = o.g1;
          c.ba = o.b1;
          cbDome(c, xs[steps] + ca * rb * 0.5, ys[steps] + sa * rb * 0.5, rb * 1.35, rb, o.a, Math.min(0.92, r1 + 0.28), 0.08);
        }
        c.ga = saveG;
        c.ba = saveB;
      }
      // A thin hair of blood: a stroke with a gradient, slightly bowed.
      function cbHair(c, o) {
        const { rnd, g } = c,
          ca = Math.cos(o.a),
          sa = Math.sin(o.a),
          bow = (rnd() - 0.5) * o.len * 0.1,
          x1 = o.x + ca * o.len,
          y1 = o.y + sa * o.len,
          gr = g.createLinearGradient(o.x, o.y, x1, y1);
        gr.addColorStop(0, cbRGB(o.level, 0, 0));
        gr.addColorStop(1, cbRGB(o.level * 0.5, o.g1 * o.level * 0.5, 0));
        g.strokeStyle = gr;
        g.lineWidth = o.w * 2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(o.x, o.y);
        g.quadraticCurveTo((o.x + x1) / 2 - sa * bow, (o.y + y1) / 2 + ca * bow, x1, y1);
        g.stroke();
      }
      // The airflow's wipe: a band of strands dragged along the carried direction from the impact, in a few bundles
      // (channels), a few thick ropes among them, hairlines and veils at the edges. o: D metres the blood can reach,
      // base the flow's angle, len how much of D the long ones cover, band the spread across it, fan its outward
      // widening, half the tile's half-width.
      function* cbFlowStreaks(c, R, o) {
        const { rnd } = c,
          big = c.big,
          ca = Math.cos(o.base),
          sa = Math.sin(o.base),
          px = -sa,
          py = ca,
          D = o.D,
          band = o.band,
          channels = Array.from({ length: 4 + Math.round(5 * big) }, () => ({ y: cbGauss(rnd) * band * 0.75, w: 0.01 + rnd() * 0.05 * (0.4 + big) })),
          put = (s0, off, spread, extra) => {
            const desired = D * o.len * extra.reach,
              u = D * (0.72 + 0.5 * rnd()),
              len = Math.min(desired, u);
            if (len < 0.03) return;
            const x0 = c.ix + ca * s0 + px * off,
              y0 = c.iy + sa * s0 + py * off,
              strand = { x: x0, y: y0, a: o.base + spread, len, g1: len / u, b0: 0, b1: 0, ...extra.look };
            if (extra.hair) return cbHair(c, strand);
            // A long thin one is sometimes broken into pieces with small gaps, like a dry brush.
            if (len > 0.3 && !extra.look.shoulder && rnd() < 0.4) {
              const cut = 0.3 + rnd() * 0.4,
                gap = 0.015 + rnd() * 0.04,
                first = len * cut;
              cbStrand(c, { ...strand, len: first, g1: (first / u) * 0.98, tail: 0.8 });
              cbStrand(c, { ...strand, x: x0 + Math.cos(strand.a) * (first + gap), y: y0 + Math.sin(strand.a) * (first + gap), len: len - first - gap, g0: ((first + gap) / u) * 0.98, level: strand.level * 0.8 });
              return;
            }
            cbStrand(c, strand);
          },
          // Where a strand starts across the band: mostly on one of the channels, some anywhere.
          across = (spread) => {
            if (rnd() < 0.25) return cbGauss(rnd) * band * spread;
            const ch = channels[Math.floor(rnd() * channels.length)];
            return ch.y + (rnd() - 0.5) * ch.w * 2;
          };
        // Veils: broad, faint, long, so the band has soft edges.
        for (let i = 0, n = Math.round(2 + 6 * big); i < n; i++) {
          const off = cbGauss(rnd) * band * 0.8;
          put(-R * 0.1 + rnd() * R, off, (off / o.half) * o.fan * 0.8, {
            reach: 0.3 + 0.7 * rnd(),
            look: { w: 0.01 + rnd() * 0.022, level: 0.06 + rnd() * 0.04, tail: 0.2, taper: 0.8, meander: 0.004 },
          });
          if ((i & 3) === 3 && cbOver()) yield;
        }
        // Wipe fingers: broad, pointed smears with soft shoulders, where the body slid and the film was dragged.
        for (let i = 0, n = Math.round(3 + 14 * big); i < n; i++) {
          const off = across(0.8);
          put(-R * 0.1 + rnd() * R * 0.9, off, (off / o.half) * o.fan + (rnd() - 0.5) * 0.06, {
            reach: 0.25 + 0.75 * Math.pow(rnd(), 1.1),
            look: { w: 0.009 + rnd() * 0.026, level: 0.26 + rnd() * 0.2, tail: 0.35, taper: 0.9, meander: 0.014, wave: 0.004 + rnd() * 0.01, shoulder: true, jag: 0.35 },
          });
          if ((i & 3) === 3 && cbOver()) yield;
        }
        // The band: many strands of every width, dragged for different lengths, in bundles.
        for (let i = 0, n = Math.round(14 + 70 * big); i < n; i++) {
          const off = across(1),
            edge = Math.min(1, Math.abs(off) / (band * 1.6));
          put(-R * 0.1 + rnd() * R * 1.1, off, (off / o.half) * o.fan + (rnd() - 0.5) * 0.05, {
            reach: (0.1 + 0.9 * Math.pow(rnd(), 1.3)) * (1 - 0.45 * edge),
            look: {
              w: 0.0025 + Math.pow(rnd(), 1.8) * 0.01,
              level: 0.17 + rnd() * 0.25 + 0.08 * big,
              tail: 0.4,
              taper: 0.75,
              meander: 0.02,
              wave: 0.004 + rnd() * 0.012,
              head: rnd() < 0.3 ? 1.2 : 0,
            },
          });
          if ((i & 7) === 7 && cbOver()) yield;
        }
        // Ropes: a few thick, rounded runs that go nearly the whole way, beaded, ending in a wet bead.
        for (let i = 0, n = Math.round(1 + 6 * big); i < n; i++) {
          const off = across(0.5);
          put(-R * 0.05 + rnd() * R * 0.8, off, (off / o.half) * o.fan + (rnd() - 0.5) * 0.04, {
            reach: 0.5 + 0.5 * rnd(),
            look: { w: 0.0042 + rnd() * 0.005, level: 0.58 + rnd() * 0.2, tail: 0.7, taper: 0.4, meander: 0.03, wave: 0.006 + rnd() * 0.012, shoulder: true, head: 1.6, patches: 2 + Math.floor(rnd() * 4) },
          });
          if (cbOver()) yield;
        }
        // Hairlines: the fine feathering, a wider angle than the strands.
        for (let i = 0, n = Math.round(10 + 80 * big); i < n; i++) {
          const off = across(1.05);
          put(-R * 0.1 + rnd() * R * 1.4, off, (off / o.half) * o.fan + (rnd() - 0.5) * 0.35, {
            reach: 0.08 + 0.6 * Math.pow(rnd(), 1.2),
            hair: true,
            look: { w: 0.0007 + rnd() * 0.0009, level: 0.2 + rnd() * 0.2 },
          });
          if ((i & 15) === 15 && cbOver()) yield;
        }
      }
      // Gravity runs: slow drips that follow `a` (down a face, forward off a bonnet), each ending in a bead; B is when each pixel is reached.
      function* cbRuns(c, R, o) {
        const { rnd } = c;
        for (let i = 0; i < o.count; i++) {
          if ((i & 3) === 3 && cbOver()) yield;
          const a = o.a + (rnd() - 0.5) * o.spread,
            len = o.reach * (0.05 + Math.pow(rnd(), 2) * 0.75) * (1 - 0.4 * c.speed),
            from = R * (0.2 + rnd() * 0.9);
          if (len < 0.025) continue;
          cbStrand(c, {
            x: c.ix + Math.cos(a) * from + cbGauss(rnd) * R * 0.5,
            y: c.iy + Math.sin(a) * from + (rnd() - 0.3) * R * 0.3,
            a,
            len,
            w: 0.0016 + rnd() * 0.0028,
            level: 0.5 + rnd() * 0.2,
            tail: 0.9,
            taper: 0.3,
            meander: 0.012,
            g1: 0,
            b0: 0.03,
            b1: 1,
            shoulder: true,
            head: 1.7 + rnd() * 0.6,
          });
        }
      }
      // The end of a stage: pending specks drawn, the tile's edges faded.
      function cbStageEnd(c) {
        cbFlushSpecks(c);
        cbFadeEdges(c);
      }
      // Top tile: the bonnet. +x along the carried direction; the impact a hand's width in from the nose.
      function* cbPaintTop(c) {
        const s = c.sev,
          R = 0.06 + 0.17 * s,
          sp = clamp(c.speed, 0.35, 1.1);
        c.align = true;
        // The mass the body leaves, and the pad it was dragged over.
        {
          const len = R * (0.8 + 2.6 * c.big) * (0.5 + 0.5 * sp);
          for (let i = 0, n = Math.round(8 + 22 * c.big); i < n; i++) {
            const u = c.rnd();
            c.ga = u * 0.16;
            cbDome(c, c.ix + u * len - R * 0.2, c.iy + cbGauss(c.rnd) * R * 0.35 * (1 - 0.4 * u), R * (0.25 + c.rnd() * 0.4) * (1 - 0.45 * u) * 1.4, R * (0.25 + c.rnd() * 0.4) * (1 - 0.45 * u), (c.rnd() - 0.5) * 0.5, 0.42 + c.rnd() * 0.2, 0.35);
          }
          c.ga = 0;
        }
        yield* cbCore(c, R, s);
        cbStageEnd(c);
        yield 'stage';
        yield* cbFlowStreaks(c, R, {
          D: Math.max(0.25, c.Wm - c.ix - 0.05),
          base: 0,
          len: clamp(0.3 + 0.75 * sp, 0.3, 1) * (0.4 + 0.6 * c.big),
          band: 0.06 + 0.3 * c.big,
          fan: 0.14,
          half: c.Hm * 0.5,
        });
        cbStageEnd(c);
        yield 'stage';
        yield* cbSpray(c, R, s, Math.round(170 + 840 * s), 0.7, 0.45, 2.8 * (0.4 + c.speed));
        yield* cbMist(c, R, s, Math.round(500 + 2300 * s), 0.65);
        // Once the car stops, what is thick on the bonnet creeps toward the nose and the wings.
        yield* cbRuns(c, R, { count: Math.round(2 + 5 * c.big), a: Math.PI, spread: 2.4, reach: 0.4 });
        cbStageEnd(c);
      }
      // Face tile: bumper, grille or flank. The impact 36% up; drops thrown up and back, runs down.
      function* cbPaintFace(c) {
        const s = c.sev,
          R = 0.04 + 0.12 * s;
        c.squash = 1.35;
        c.align = false;
        yield* cbCore(c, R, s, 0.9);
        cbStageEnd(c);
        yield 'stage';
        // The airflow takes it up and round: to the tile's edge along the carried direction.
        const tx = c.dx > 0.01 ? (c.Wm - c.ix) / c.dx : c.dx < -0.01 ? c.ix / -c.dx : 9,
          ty = c.dy < -0.01 ? c.iy / -c.dy : c.dy > 0.01 ? (c.Hm - c.iy) / c.dy : 9;
        yield* cbFlowStreaks(c, R, {
          D: Math.max(0.2, Math.min(tx, ty) - 0.04),
          base: Math.atan2(c.dy, c.dx),
          len: clamp(0.25 + 0.6 * c.speed, 0.25, 0.8) * (0.35 + 0.65 * c.big),
          band: 0.04 + 0.16 * c.big,
          fan: 0.2,
          half: c.Wm * 0.5,
        });
        yield* cbRuns(c, R, { count: Math.round(5 + 14 * s), a: Math.PI / 2, spread: 0.3, reach: c.Hm * 0.62 });
        cbStageEnd(c);
        yield 'stage';
        yield* cbSpray(c, R, s, Math.round(110 + 520 * s), 0.55, 0.85, 2.0 * (0.4 + c.speed));
        yield* cbMist(c, R, s, Math.round(300 + 1300 * s), 0.55);
        cbStageEnd(c);
      }
      // The paint context of one tile of one stain, drawn on the scratch tile (metres, y down).
      function cbTileContext(panel, event) {
        const g = cbScratch.g,
          sx = CB_TILE / panel.Wm,
          sy = CB_TILE / panel.Hm;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#000';
        g.fillRect(0, 0, CB_TILE, CB_TILE);
        g.setTransform(sx, 0, 0, sy, 0, 0);
        g.globalCompositeOperation = 'lighten';
        return {
          g,
          rnd: cbRandom(event.stain.seed + panel.kindSeed),
          sev: event.stain.sev,
          big: cbSmooth(0.28, 0.85, event.stain.sev),
          speed: clamp(event.stain.kph / 90, 0, 1.2),
          Wm: panel.Wm,
          Hm: panel.Hm,
          pxs: Math.sqrt(sx * sy),
          ix: panel.fu * panel.Wm,
          iy: (1 - panel.fv) * panel.Hm,
          dx: panel.dirx,
          dy: panel.diry,
          squash: 1,
          align: false,
          ga: 0,
          ba: 0,
          specks: Array.from({ length: CB_SPECK_BUCKETS }, () => []),
        };
      }
      // Both tiles of one stain, one at a time on the shared scratch tile; the scheduler copies the tile to the skin whenever this yields.
      function* cbPaintJob(job) {
        const event = job.event;
        for (const panel of event.layout) {
          job.panel = panel;
          const c = cbTileContext(panel, event);
          yield* panel.kind === 'top' ? cbPaintTop(c) : cbPaintFace(c);
          job.tilesDone = (job.tilesDone || 0) + 1;
          job.tileEnd = true;
          yield 'stage';
        }
      }
