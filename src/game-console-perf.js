    // BEGIN SUBSYSTEM: src/game-console-perf.js — DeadEndCity console, simulation cost: simProfile (per-section ms, worst frames), simScenario (staged situations)
    // Read-only measurement of the logic side: steps update() at 1/60 s with no drawing and reports
    // where the milliseconds go. Registered in the 'graphics' group beside stats().
    function simProfileRun(seconds, held, top) {
      const frames = clamp(Math.round(Number(seconds) * 60) || 360, 1, 7200),
        dt = 1 / 60,
        saved = profile.parts,
        totals = new Float64Array(frames),
        sum = {},
        max = {},
        slow = {},
        worst = [],
        heap = performance.memory ? performance.memory : null,
        heap0 = heap ? heap.usedJSHeapSize : 0;
      let n = 0,
        gcDrops = 0,
        lastHeap = heap0;
      for (const code of held) keys[code] = true;
      for (let i = 0; i < frames; i++) {
        if (gameMode !== 'play') break;
        const parts = (profile.parts = {}),
          t0 = performance.now();
        update(dt);
        const total = performance.now() - t0;
        totals[n++] = total;
        let nested = 0,
          big = '',
          bigMs = 0;
        for (const k in parts) {
          const v = parts[k];
          sum[k] = (sum[k] || 0) + v;
          if (!(v < max[k])) max[k] = v;
          if (v > 3) slow[k] = (slow[k] || 0) + 1;
          if (k.indexOf(':') < 0) {
            nested += v;
            if (v > bigMs) {
              bigMs = v;
              big = k;
            }
          }
        }
        sum['(untimed)'] = (sum['(untimed)'] || 0) + Math.max(0, total - nested);
        if (!(total < max['(untimed)'])) max['(untimed)'] = Math.max(0, total - nested);
        worst.push([total, i, big, bigMs]);
        if (worst.length > 64) {
          worst.sort((a, b) => b[0] - a[0]);
          worst.length = 8;
        }
        if (heap) {
          const h = heap.usedJSHeapSize;
          if (h < lastHeap - 262144) gcDrops++;
          lastHeap = h;
        }
      }
      profile.parts = saved;
      for (const code of held) keys[code] = false;
      const sorted = Array.from(totals.subarray(0, n)).sort((a, b) => a - b),
        at = (q) => (n ? sorted[Math.min(n - 1, Math.floor(q * n))] : 0),
        r2 = (v) => +v.toFixed(2);
      worst.sort((a, b) => b[0] - a[0]);
      const names = Object.keys(sum).sort((a, b) => sum[b] - sum[a]).slice(0, top);
      return {
        frames: n,
        avgMs: r2(sorted.reduce((a, b) => a + b, 0) / Math.max(1, n)),
        p50Ms: r2(at(0.5)),
        p95Ms: r2(at(0.95)),
        p99Ms: r2(at(0.99)),
        maxMs: r2(n ? sorted[n - 1] : 0),
        // Averages per frame, and the worst single frame, of each timed section (`a:b` parts nest in their parent).
        parts: Object.fromEntries(names.map((k) => [k, [r2(sum[k] / Math.max(1, n)), r2(max[k] || 0)]])),
        // The five slowest frames: [ms, frame, its biggest top-level section, that section's ms].
        worst: worst.slice(0, 5).map(([ms, i, name, v]) => [r2(ms), i, name, r2(v)]),
        // Frames in which a section alone took over 3 ms: bursts show up here as a few counts in one section.
        slow,
        heapMB: heap ? +((heap.usedJSHeapSize - heap0) / 1048576).toFixed(1) : null,
        heapDrops: heap ? gcDrops : null,
        vehicles: vehicles.length,
        pedestrians: pedestrians.length,
      };
    }
    addConsoleMethods('graphics', {
      // Logic cost with no drawing: steps update() at 1/60 s for `seconds` (default 6) holding the keys in
      // `held`, and reports frames, avg / p50 / p95 / p99 / max ms, the `top` (14) timed sections as
      // [avg ms, worst ms] per frame (names with a colon nest in their parent; `(untimed)` is update()'s own
      // code), the five slowest frames with their biggest section, the JS heap growth in MB and the number of
      // collections seen. Read-only: it advances the simulation like simulate().
      simProfile: (seconds = 6, held = [], top = 14) => simProfileRun(seconds, Array.isArray(held) ? held : [], clamp(Number(top) || 14, 1, 60)),
      // The settle shortcut (physics-step.js settleIsTrivial): steps the physics `steps` times (1/120 s each, the
      // world moves on) and, after each, runs the whole settle on every vehicle the shortcut skips and counts any
      // field it changed besides `speed`. `changed` must be 0; `checked` is how many were looked at.
      settleAudit(steps = 120) {
        const pc = player.car,
          diffs = {};
        let checked = 0,
          changed = 0;
        for (let i = 0; i < clamp(Number(steps) || 120, 1, 2400); i++) {
          physicsStep(1 / 120, true);
          for (const c of vehicles) {
            if (!settleIsTrivial(c, pc)) continue;
            const before = Object.assign({}, c);
            settleVehicleFull(c, pc, 1 / 120);
            checked++;
            let any = false;
            for (const k of Object.keys(c)) {
              if (k === 'speed' || Object.is(before[k], c[k])) continue;
              diffs[k] = (diffs[k] || 0) + 1;
              any = true;
            }
            if (any) changed++;
          }
        }
        return { checked, changed, diffs };
      },
    });
    // END SUBSYSTEM: src/game-console-perf.js
