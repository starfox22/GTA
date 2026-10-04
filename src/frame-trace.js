    // FRAME TRACE: every frame's CPU split (simulation sections, renderer laps) and what happened in it (collections,
    // DOM mutations, GL uploads and links, 2D canvas work, audio nodes, storage writes, models built, spawns), to find
    // hiccups. Off unless the console's hitchRun (stepped frames) or frameTrace (live frames) runs it (game-console-perf.js).
    /**
     * A hiccup is a frame much longer than its neighbours. runFrame (game-loop.js) calls frameTraceBegin and
     * frameTraceEnd only while a trace is on; the counters come from wrappers put on the browser's own prototypes for
     * the length of the trace (WebGL uploads and links, canvas 2D, Web Audio node creation, localStorage writes) and a
     * MutationObserver on the page, all removed when it stops, so play pays nothing. A collection is seen as the JS heap
     * dropping (precise only with Chromium's --enable-precise-memory-info, which tools/dev.mjs passes).
     */
    const FRAME_TRACE_COUNTERS = ['texUploads', 'texMB', 'bufUploads', 'bufMB', 'links', 'syncReads', 'canvasDraws', 'canvasText', 'audioNodes', 'storageWrites', 'storageKB'],
      frameTrace = {
        on: false,
        stepped: false,
        frames: [],
        saved: null,
        scratch: {},
        counts: {},
        last: {},
        restore: [],
        observer: null,
        heapBegin: 0,
        heapEnd: 0,
        lastT: 0,
        held: [],
        domTargets: new Map(),
        render: null,
        vehicles: 0,
        pedestrians: 0,
      };
    function frameTraceHeap() {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    }
    // Counts a call to proto[name] (fn sees the receiver and arguments) until the trace stops.
    function frameTraceWrap(proto, name, fn) {
      const original = proto && proto[name];
      if (typeof original !== 'function') return;
      proto[name] = function () {
        fn(this, arguments);
        return original.apply(this, arguments);
      };
      frameTrace.restore.push([proto, name, original]);
    }
    function frameTraceSourceBytes(source) {
      if (!source || typeof source !== 'object') return 0;
      const w = source.videoWidth || source.width || 0,
        h = source.videoHeight || source.height || 0;
      return w * h * 4 || source.byteLength || 0;
    }
    function frameTraceInstall() {
      const c = frameTrace.counts;
      for (const k of FRAME_TRACE_COUNTERS) c[k] = 0;
      const tex = (bytes) => {
          c.texUploads++;
          c.texMB += bytes / 1048576;
        },
        gl = [window.WebGL2RenderingContext && WebGL2RenderingContext.prototype, window.WebGLRenderingContext && WebGLRenderingContext.prototype];
      for (const proto of gl) {
        if (!proto) continue;
        // texImage2D(target, level, internal, w, h, border, format, type, pixels) or (target, level, internal, format, type, source).
        frameTraceWrap(proto, 'texImage2D', (_, a) => tex(a.length >= 8 ? a[3] * a[4] * 4 : frameTraceSourceBytes(a[5])));
        // texSubImage2D(target, level, x, y, w, h, format, type, pixels) or (target, level, x, y, format, type, source).
        frameTraceWrap(proto, 'texSubImage2D', (_, a) => tex(a.length >= 8 ? a[4] * a[5] * 4 : frameTraceSourceBytes(a[6])));
        frameTraceWrap(proto, 'texStorage2D', (_, a) => tex(a[3] * a[4] * 4));
        frameTraceWrap(proto, 'texImage3D', (_, a) => tex(a[3] * a[4] * a[5] * 4));
        frameTraceWrap(proto, 'compressedTexImage2D', (_, a) => tex(a[6] ? a[6].byteLength || 0 : 0));
        frameTraceWrap(proto, 'bufferData', (_, a) => {
          c.bufUploads++;
          c.bufMB += (typeof a[1] === 'number' ? a[1] : a[1] ? a[1].byteLength : 0) / 1048576;
        });
        // bufferSubData(target, offset, data[, srcOffset[, length]]): an update range sends `length` elements only.
        frameTraceWrap(proto, 'bufferSubData', (_, a) => {
          const data = a[2],
            per = data && data.BYTES_PER_ELEMENT ? data.BYTES_PER_ELEMENT : 1;
          c.bufUploads++;
          c.bufMB += (!data ? 0 : a[4] ? a[4] * per : a[3] ? data.byteLength - a[3] * per : data.byteLength) / 1048576;
        });
        frameTraceWrap(proto, 'linkProgram', () => c.links++);
        frameTraceWrap(proto, 'readPixels', () => c.syncReads++);
      }
      const c2d = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
      frameTraceWrap(c2d, 'drawImage', () => c.canvasDraws++);
      frameTraceWrap(c2d, 'putImageData', () => c.canvasDraws++);
      frameTraceWrap(c2d, 'getImageData', () => c.syncReads++);
      frameTraceWrap(c2d, 'fillText', () => c.canvasText++);
      frameTraceWrap(c2d, 'strokeText', () => c.canvasText++);
      const audio = window.BaseAudioContext ? BaseAudioContext.prototype : window.AudioContext && AudioContext.prototype;
      if (audio)
        for (const name of Object.getOwnPropertyNames(audio))
          if (/^create[A-Z]/.test(name) && name !== 'createPeriodicWave') frameTraceWrap(audio, name, () => c.audioNodes++);
      frameTraceWrap(window.Storage && Storage.prototype, 'setItem', (_, a) => {
        c.storageWrites++;
        c.storageKB += String(a[1]).length / 1024;
      });
      if (window.MutationObserver) {
        frameTrace.observer = new MutationObserver(() => {});
        frameTrace.observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      }
    }
    function frameTraceUninstall() {
      for (const [proto, name, original] of frameTrace.restore.reverse()) proto[name] = original;
      frameTrace.restore.length = 0;
      if (frameTrace.observer) frameTrace.observer.disconnect();
      frameTrace.observer = null;
    }
    // Starts a trace: `stepped` frames come from hitchRun, otherwise the live loop's; `held` keys stay down until it
    // stops. `keep` appends to the frames of the last trace (a stage made of several steps).
    function frameTraceStart(stepped, held, keep) {
      if (frameTrace.on) frameTraceStop();
      frameTrace.on = true;
      frameTrace.stepped = !!stepped;
      if (!keep) {
        frameTrace.frames = [];
        frameTrace.domTargets.clear();
      }
      frameTrace.held = held.slice();
      for (const code of held) keys[code] = true;
      frameTraceInstall();
      for (const k of FRAME_TRACE_COUNTERS) frameTrace.last[k] = 0;
      frameTrace.render = city3D && city3D.traceCounters ? city3D.traceCounters() : null;
      frameTrace.vehicles = vehicles.length;
      frameTrace.pedestrians = pedestrians.length;
      frameTrace.heapEnd = frameTraceHeap();
      frameTrace.lastT = 0;
    }
    function frameTraceBegin() {
      const tr = frameTrace,
        scratch = tr.scratch;
      for (const k in scratch) scratch[k] = 0;
      tr.saved = profile.parts;
      profile.parts = scratch;
      tr.heapBegin = frameTraceHeap();
    }
    // Where a DOM mutation landed: the nearest id, the element's own class when it has no id, and the attribute.
    function frameTraceTarget(m) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentNode;
      let id = '(no id)';
      for (let n = el; n; n = n.parentNode)
        if (n.id) {
          id = n.id;
          break;
        }
      const own = el && !el.id && el.className && typeof el.className === 'string' ? ' .' + el.className.split(' ')[0] : '';
      return id + own + (m.type === 'attributes' ? ' [' + m.attributeName + ']' : m.type === 'childList' ? ' (children)' : ' (text)');
    }
    function frameTraceEnd(t, frameStart, updateStart, drawStart, frameEnd) {
      const tr = frameTrace,
        parts = profile.parts,
        heap = frameTraceHeap(),
        record = {
          i: tr.frames.length,
          t: +gameTime.toFixed(2),
          ms: frameEnd - frameStart,
          gap: tr.lastT ? t - tr.lastT : 0,
          pre: updateStart - frameStart,
          update: drawStart - updateStart,
          draw: frameEnd - drawStart,
          parts: {},
          c: {},
        };
      profile.parts = tr.saved;
      for (const k in parts) {
        const v = parts[k];
        if (!v) continue;
        tr.saved[k] = (tr.saved[k] || 0) + v;
        if (v >= 0.2) record.parts[k] = +v.toFixed(2);
      }
      tr.lastT = t;
      const c = record.c,
        counts = tr.counts;
      for (const k of FRAME_TRACE_COUNTERS) {
        const d = counts[k] - tr.last[k];
        if (d > 0.0001) c[k] = k.endsWith('MB') || k.endsWith('KB') ? +d.toFixed(3) : d;
        tr.last[k] = counts[k];
      }
      // A drop of the heap inside the frame is a collection in it; one between frames happened outside the frame.
      if (heap < tr.heapBegin - 262144) c.gcMB = +((tr.heapBegin - heap) / 1048576).toFixed(1);
      else if (heap > tr.heapBegin) c.allocKB = Math.round((heap - tr.heapBegin) / 1024);
      if (tr.heapBegin < tr.heapEnd - 262144) c.gcBetweenMB = +((tr.heapEnd - tr.heapBegin) / 1048576).toFixed(1);
      tr.heapEnd = heap;
      if (tr.observer) {
        const records = tr.observer.takeRecords();
        if (records.length) {
          c.dom = records.length;
          for (const m of records) {
            const id = frameTraceTarget(m);
            tr.domTargets.set(id, (tr.domTargets.get(id) || 0) + 1);
          }
        }
      }
      if (vehicles.length !== tr.vehicles) c.vehicles = vehicles.length - tr.vehicles;
      if (pedestrians.length !== tr.pedestrians) c.people = pedestrians.length - tr.pedestrians;
      tr.vehicles = vehicles.length;
      tr.pedestrians = pedestrians.length;
      if (tr.render && city3D && city3D.traceCounters) {
        const now = city3D.traceCounters();
        for (const k in now) if (now[k] !== tr.render[k]) c[k] = now[k] - tr.render[k];
        tr.render = now;
      }
      if (tr.frames.length < 7200) tr.frames.push(record);
    }
    // Sections that sit side by side in a frame (nested ones, `phys:control` inside `cars`, are left out of the split).
    function frameTraceTopLevel(name) {
      return name.indexOf(':') < 0 || name.startsWith('r:') || name.startsWith('f:');
    }
    // The tags a frame's counters earn (what happened in it), for ranking the causes of long frames.
    function frameTraceTags(rec) {
      const c = rec.c,
        tags = [];
      if (c.gcMB) tags.push('gc');
      if (c.gcBetweenMB) tags.push('gc-between');
      if (c.programs > 0 || c.links) tags.push('program');
      if (c.textures > 0 || c.texMB > 0.25) tags.push('texture-upload');
      if (c.geometries > 0 || c.bufMB > 0.5) tags.push('geometry-upload');
      if (c.models > 0) tags.push('models');
      if (c.vehicles || c.people) tags.push('spawn');
      if (c.dom > 30) tags.push('dom');
      if (c.storageWrites) tags.push('storage');
      if (c.audioNodes > 20) tags.push('audio-nodes');
      if (c.canvasDraws > 20 || c.canvasText > 60) tags.push('canvas');
      if (c.syncReads) tags.push('sync-read');
      return tags;
    }
    function frameTraceReport(top = 10) {
      const frames = frameTrace.frames,
        n = frames.length,
        r2 = (v) => +v.toFixed(2);
      if (!n) return { frames: 0, wrappersLeft: frameTrace.on ? -1 : frameTrace.restore.length };
      const sorted = frames.map((f) => f.ms).sort((a, b) => a - b),
        at = (list, q) => list[Math.min(list.length - 1, Math.floor(q * list.length))],
        median = at(sorted, 0.5),
        sectionSum = {},
        sectionMax = {};
      for (const f of frames)
        for (const k in f.parts) {
          sectionSum[k] = (sectionSum[k] || 0) + f.parts[k];
          if (!(f.parts[k] < sectionMax[k])) sectionMax[k] = f.parts[k];
        }
      const sectionAvg = {};
      for (const k in sectionSum) sectionAvg[k] = sectionSum[k] / n;
      // A long frame: over twice the median and at least 4 ms over it. Its cause is the top-level section that ran
      // furthest over its own average, with the frame's tags (what was created, uploaded, collected or written).
      const longLimit = Math.max(median * 2, median + 4),
        causes = {},
        tagCounts = {},
        excessBySection = {},
        long = [];
      for (const f of frames) {
        if (f.ms <= longLimit) continue;
        let cause = '',
          causeExcess = -1;
        for (const k in f.parts) {
          if (!frameTraceTopLevel(k)) continue;
          const excess = f.parts[k] - (sectionAvg[k] || 0);
          excessBySection[k] = (excessBySection[k] || 0) + Math.max(0, excess);
          if (excess > causeExcess) {
            causeExcess = excess;
            cause = k;
          }
        }
        const tags = frameTraceTags(f);
        causes[cause || '(untimed)'] = (causes[cause || '(untimed)'] || 0) + 1;
        for (const tag of tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        long.push({ f, cause, causeExcess, tags });
      }
      long.sort((a, b) => b.f.ms - a.f.ms);
      const gaps = frames.slice(1).map((f) => f.gap).filter((g) => g > 0).sort((a, b) => a - b),
        gapMedian = gaps.length ? at(gaps, 0.5) : 0,
        totals = {};
      for (const f of frames) for (const k in f.c) if (typeof f.c[k] === 'number') totals[k] = (totals[k] || 0) + f.c[k];
      for (const k in totals) totals[k] = r2(totals[k]);
      const seconds = frameTrace.stepped ? n / 60 : Math.max(0.001, (frames[n - 1].gap ? frames.reduce((s, f) => s + f.gap, 0) : n * 16.7) / 1000);
      return {
        mode: frameTrace.stepped ? 'stepped' : 'live',
        frames: n,
        // Prototype wrappers still installed (0 once the trace has stopped).
        wrappersLeft: frameTrace.on ? -1 : frameTrace.restore.length,
        seconds: r2(seconds),
        avgMs: r2(sorted.reduce((a, b) => a + b, 0) / n),
        p50Ms: r2(median),
        p95Ms: r2(at(sorted, 0.95)),
        p99Ms: r2(at(sorted, 0.99)),
        maxMs: r2(sorted[n - 1]),
        longLimitMs: r2(longLimit),
        long: long.length,
        over16: sorted.filter((v) => v > 16.7).length,
        over33: sorted.filter((v) => v > 33.3).length,
        // Live frames: the requestAnimationFrame intervals (style, layout, paint and anything between frames add to them).
        gaps: gaps.length ? { p50: r2(gapMedian), p95: r2(at(gaps, 0.95)), max: r2(gaps[gaps.length - 1]), over2x: gaps.filter((g) => g > gapMedian * 2).length, over33: gaps.filter((g) => g > 33.3).length } : null,
        // What the long frames had in common: the section that ran over, and the tags.
        causes,
        tags: tagCounts,
        excessMs: Object.fromEntries(Object.entries(excessBySection).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, r2(v)])),
        // Average and worst ms per frame of the heaviest sections.
        sections: Object.fromEntries(
          Object.keys(sectionSum)
            .sort((a, b) => sectionSum[b] - sectionSum[a])
            .slice(0, 16)
            .map((k) => [k, [r2(sectionAvg[k]), r2(sectionMax[k])]]),
        ),
        // Counters over the whole trace (texture and buffer MB uploaded, links, DOM mutations, KB allocated...).
        totals,
        perSecond: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, r2(v / seconds)])),
        domTargets: [...frameTrace.domTargets].sort((a, b) => b[1] - a[1]).slice(0, 8),
        worst: long.slice(0, top).map(({ f, cause, causeExcess, tags }) => ({
          frame: f.i,
          t: f.t,
          ms: r2(f.ms),
          cause: cause ? cause + ' +' + r2(causeExcess) : '',
          tags,
          parts: Object.fromEntries(Object.entries(f.parts).filter(([k]) => frameTraceTopLevel(k)).sort((a, b) => b[1] - a[1]).slice(0, 4)),
          c: f.c,
        })),
      };
    }
    function frameTraceStop(top) {
      if (!frameTrace.on) return frameTraceReport(top);
      frameTrace.on = false;
      for (const code of frameTrace.held) keys[code] = false;
      frameTraceUninstall();
      return frameTraceReport(top);
    }
