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
      // Hiccup hunt, stepped (frame-trace.js): runs `seconds` of whole frames at 1/60 s (input, update, HUD and, with a
      // renderer, the draw) holding the keys in `held`, in whatever mode the game is in, and reports the frame times
      // (p50 / p95 / p99 / max), the long frames (over twice the median) with the section that ran over and what
      // happened in them (`gc`, `program`, `texture-upload`, `geometry-upload`, `models`, `spawn`, `dom`, `storage`,
      // `audio-nodes`, `canvas`, `sync-read`), section averages and worst, and counters per second. The browser's own
      // style, layout and paint run between live frames only: frameTrace measures those. `keep` appends to the last
      // run's frames (one report for a stage of several steps); `draw` false skips the draw (stage a scene on a rendered
      // page quickly: the camera and everything else still step). Advances the game like simulate().
      hitchRun(seconds = 6, held = [], top = 10, keep = false, draw = true) {
        const frames = clamp(Math.round(Number(seconds) * 60) || 360, 1, 7200),
          heldBefore = simulationHeld,
          lastBefore = lastTime,
          previousBefore = profile.previousFrame,
          profileLastBefore = profile.last;
        // The stepped clock starts from 0 on every run (not from the page's own clock), so the frame steps are the
        // same numbers on every boot and a seeded run replays exactly (dev.mjs --seed, stateHash).
        let t = 1000 / 60;
        lastTime = 1000 / 60;
        frameTraceStart(true, Array.isArray(held) ? held : [], !!keep);
        simulationHeld = false;
        frameTrace.skipDraw = draw === false;
        try {
          for (let i = 0; i < frames; i++) {
            t += 1000 / 60;
            runFrame(t, false);
          }
        } finally {
          frameTrace.skipDraw = false;
          simulationHeld = heldBefore;
          lastTime = lastBefore;
          profile.previousFrame = previousBefore;
          profile.last = profileLastBefore;
        }
        return frameTraceStop(clamp(Number(top) || 10, 1, 40));
      },
      // GPU upload churn (rendered pages): steps `frames` whole frames like hitchRun and lists the buffer attributes and
      // textures whose data changed, so three.js uploaded them again: [owner attribute, KB uploaded in all (a whole
      // buffer per change), uploads, objects],
      // biggest first, and the KB per frame in all. Advances the game like simulate().
      uploadChurn(frames = 30, held = []) {
        if (!city3D || !city3D.attributeChurn) return null;
        const n = clamp(Math.round(Number(frames)) || 30, 1, 600),
          lastBefore = lastTime,
          previousBefore = profile.previousFrame,
          snapshot = city3D.attributeChurn();
        let t = 1000 / 60;
        lastTime = t;
        for (const code of held) keys[code] = true;
        try {
          for (let i = 0; i < n; i++) {
            t += 1000 / 60;
            runFrame(t, false);
          }
        } finally {
          for (const code of held) keys[code] = false;
          lastTime = lastBefore;
          profile.previousFrame = previousBefore;
        }
        const rows = city3D.attributeChurn(snapshot);
        return { frames: n, kbPerFrame: Math.round(rows.reduce((s, r) => s + r[1], 0) / n), top: rows.slice(0, 25) };
      },
      // Garbage per call of one hot simulation function, on the world as it is (it changes it: a dev page only):
      // 'trafficControl' (every city AI car), 'controlVehicle', 'settleVehicle' (every vehicle), 'vehicleBroadphase',
      // 'knockSceneProps', 'physicsStep' (once a round). Bytes from the JS heap's growth (exact with Chromium's
      // --enable-precise-memory-info, which tools/dev.mjs passes), rounds that a collection interrupted left out, and
      // microseconds per call.
      allocBench(name = 'trafficControl', rounds = 6) {
        const pc = player.car,
          dt = 1 / 120,
          heap = () => (performance.memory ? performance.memory.usedJSHeapSize : 0),
          runs = {
            trafficControl: [vehicles.filter((c) => c.ai && !c.isle && !c.countyRoute && c.hp > 0 && !c.cop), (c) => trafficControl(c, dt)],
            controlVehicle: [vehicles, (c) => controlVehicle(c, pc, dt, true)],
            settleVehicle: [vehicles, (c) => settleVehicle(c, pc, dt)],
            vehicleBroadphase: [[0], () => vehicleBroadphase(pc)],
            knockSceneProps: [[0], () => knockSceneProps(1 / 60)],
            physicsStep: [[0], () => physicsStep(dt, true)],
          },
          run = runs[name];
        if (!run) return { error: 'one of ' + Object.keys(runs).join(', ') };
        const [list, fn] = run;
        for (let i = 0; i < list.length; i++) fn(list[i]);
        let bytes = 0,
          calls = 0,
          ms = 0,
          dropped = 0;
        for (let r = 0; r < clamp(Number(rounds) || 6, 1, 200); r++) {
          const h0 = heap(),
            t0 = performance.now();
          for (let i = 0; i < list.length; i++) fn(list[i]);
          const t1 = performance.now(),
            h1 = heap();
          if (h1 < h0) {
            dropped++;
            continue;
          }
          bytes += h1 - h0;
          ms += t1 - t0;
          calls += list.length;
        }
        return { name, calls, bytesPerCall: calls ? Math.round(bytes / calls) : null, usPerCall: calls ? +((ms * 1000) / calls).toFixed(2) : null, roundsDropped: dropped };
      },
      // Object layouts of the vehicles (or 'people'): V8 gives objects whose properties were added in a different
      // order different hidden classes, and a property read across more than four of them is megamorphic: slower,
      // and a read of a number field then allocates a fresh boxed copy (the garbage of the physics loops). Reports
      // the distinct key orders, the base (first) layout's length and the keys added after it (by how many vehicles,
      // in what order of appearance), and keys some vehicles lack. Read-only.
      shapeReport(kind = 'vehicles') {
        const list = kind === 'people' ? pedestrians : vehicles,
          orders = new Map(),
          extra = new Map(),
          missing = new Map();
        let base = null;
        for (const o of list) {
          const keys = Object.keys(o),
            sig = keys.join(',');
          orders.set(sig, (orders.get(sig) || 0) + 1);
        }
        const ranked = [...orders].sort((a, b) => b[1] - a[1]);
        if (ranked.length) base = ranked[0][0].split(',');
        const baseSet = new Set(base || []);
        for (const o of list) {
          const keys = Object.keys(o);
          for (const k of keys) if (!baseSet.has(k)) extra.set(k, (extra.get(k) || 0) + 1);
          const own = new Set(keys);
          for (const k of base || []) if (!own.has(k)) missing.set(k, (missing.get(k) || 0) + 1);
        }
        // Where each of the next layouts first parts from the biggest one's key order.
        const parts = ranked.slice(1, 6).map(([sig, n]) => {
          const keys = sig.split(',');
          let i = 0;
          while (i < keys.length && base && keys[i] === base[i]) i++;
          return [n, i, keys.slice(i, i + 4).join(','), base ? base.slice(i, i + 4).join(',') : ''];
        });
        return {
          objects: list.length,
          layouts: orders.size,
          biggest: ranked.slice(0, 6).map(([sig, n]) => [n, sig.split(',').length]),
          // [objects, first differing position, their keys there, the biggest layout's keys there]
          parts,
          baseKeys: base ? base.length : 0,
          // The biggest layout's last keys (fields added after creation, in the order they arrive).
          lastKeys: base ? base.slice(-12) : [],
          extraKeys: [...extra].sort((a, b) => b[1] - a[1]).slice(0, 160),
          missingKeys: [...missing].sort((a, b) => b[1] - a[1]).slice(0, 20),
        };
      },
      // Hiccup hunt, live frames (frame-trace.js): 'start' records every frame the page draws from now on (holding the
      // keys in `held`), 'report' reads the record so far, 'stop' ends it and reports (the same report as hitchRun,
      // plus the requestAnimationFrame intervals in `gaps`).
      frameTrace(command = 'report', held = []) {
        if (command === 'start') {
          frameTraceStart(false, Array.isArray(held) ? held : []);
          return { on: true };
        }
        return command === 'stop' ? frameTraceStop(10) : frameTraceReport(10);
      },
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
