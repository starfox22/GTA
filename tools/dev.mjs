// Persistent headless dev page + CLI: boot the game once, then send it console calls.
//
//   node tools/dev.mjs start [html] [--render] [--nodev] [--size 960x600] [--port N]
//   node tools/dev.mjs call <method> [jsonArg ...] [--max N | --full] [--cpu]
//   node tools/dev.mjs keys <Code[,Code...]> <seconds> [--real]
//   node tools/dev.mjs wait <seconds> [--real]
//   node tools/dev.mjs mouse <x> <y> [seconds] [--down] [--keys Code,Code]
//   node tools/dev.mjs shot <name> [--full] [--crop x,y,w,h] [--width N]
//   node tools/dev.mjs heap   (the page's JS heap in MB after a full collection)
//   node tools/dev.mjs cpucost <seconds>   (CPU ms per drawn frame of each browser process: the GPU process's share is software GL's pixel cost)
//   node tools/dev.mjs profile <seconds> [--allocations] [--top N]   (CPU profile of the live page for N seconds; --allocations: allocation sites instead)
//   node tools/dev.mjs errors | status | reload [--render|--norender] [--keep] [--shadercheck] [--prewarm] | stop
//
// `start` with no html builds dist/dev/game.html (and `reload` rebuilds it after code
// edits, reusing the browser). The page opens with `?dev&norender` (no WebGL renderer,
// no frame drawing: logic checks boot and tick fast); `--render` opens it with the real
// renderer for screenshots. The server runs in the background: state in dist/dev.json,
// its log in dist/dev.log. A second `start` reuses a running server. `reload --keep`
// keeps the browser profile (localStorage), so a save can be checked after a reload.
//
// `call` runs one NAMED window.DeadEndCity method with JSON arguments (bare words that
// are not JSON are passed as strings) and prints the result as one compact JSON line,
// truncated to --max characters (default 1500; --full for all; --cpu adds the page's main-thread
// CPU time of the call, which a busy machine does not inflate; --profile N lists the N heaviest
// functions of a V8 sampling profile of the call by self time; --alloc N the N biggest allocators
// by bytes, collected objects included, to find what feeds the garbage collector). NaN and Infinity come
// back as the strings "NaN" / "Infinity" so tests can see them. There is deliberately
// no way to run arbitrary page JS: the console has named methods only (CLAUDE.md).
//
// `keys` / `wait` advance game time with the console's simulate(seconds, keys) (no
// drawing, deterministic, fast); --real holds real key presses / waits wall-clock time.
// `mouse` moves the real pointer to viewport pixel (x, y) and holds it there for `seconds`
// of wall-clock time, with --down the left button held and --keys those keys held (they
// auto-repeat as a keyboard's do; tests can also pass `taps`, keys pressed afresh every
// 0.3 s); the console's screen-point methods give the pixels.
// `shot` saves dist/dev/shots/<name>.jpg (JPEG q70 of the 960x600 viewport; --width
// scales it down further, --crop clips in viewport pixels, --full saves a PNG).
// Every command prints "(N new console errors: node tools/dev.mjs errors)" when the page
// logged errors since the last `errors`.
//
// Sharing the machine (tools/browser.mjs): the server takes one of the machine-wide
// browser slots before it launches Chromium (it waits, saying so, when all are busy), and
// after DEC_IDLE_FREEZE seconds (default 20) without a command it freezes the page (no
// frames, no CPU) and gives its slot back; the next command takes a slot again and thaws
// it, so game state is kept. `status` shows `frozen` and the slot holders.
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireSlot, loadChromium, chromeExecutable, glArgs, slotHolders, slotCount } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'dist', 'dev.json');
const LOG = path.join(ROOT, 'dist', 'dev.log');
const DEFAULT_HTML = path.join(ROOT, 'dist', 'dev', 'game.html');
const SHOTS = path.join(ROOT, 'dist', 'dev', 'shots');
const BOOT_TIMEOUT_MS = 15 * 60 * 1000;
// Seconds without a command before the server freezes its page (0 = never).
const IDLE_ENV = process.env.DEC_IDLE_FREEZE;
const IDLE_FREEZE_MS = 1000 * (IDLE_ENV != null && IDLE_ENV !== '' && Number(IDLE_ENV) >= 0 ? Number(IDLE_ENV) : 20);

// A per-worktree default port, so parallel worktrees never share a server by accident.
function defaultPort() {
  let h = 0;
  for (const ch of ROOT) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 18000 + (h % 1000);
}

export function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch {
    return null;
  }
}

// POST one op to the running server; resolves with its JSON reply.
export function request(op, { port = readState()?.port, timeoutMs = BOOT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    if (!port) return reject(new Error('no dev server: node tools/dev.mjs start'));
    const body = JSON.stringify(op);
    const req = http.request(
      { host: '127.0.0.1', port, method: 'POST', path: '/', headers: { 'content-type': 'application/json' }, timeout: timeoutMs },
      (res) => {
        let text = '';
        res.on('data', (d) => (text += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error('bad reply: ' + text.slice(0, 300)));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
    req.end(body);
  });
}

async function alive(port) {
  try {
    return await request({ op: 'status' }, { port, timeoutMs: 5000 });
  } catch {
    return null;
  }
}

function build(html) {
  fs.mkdirSync(path.dirname(html), { recursive: true });
  const t0 = Date.now();
  execFileSync('python3', [path.join(ROOT, 'tools', 'build.py'), '--out', html], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  return (Date.now() - t0) / 1000;
}

// Start (or reuse) the server and wait until the game is in play. Returns its status.
export async function start({ html = null, render = false, nodev = false, shadercheck = false, prewarm = false, size = '960x600', port = null, quiet = false } = {}) {
  const say = quiet ? () => {} : (s) => console.log(s);
  // ?shadercheck makes three.js report shader compile errors (console errors).
  // ?prewarm runs the title-screen shader prewarm without KHR_parallel_shader_compile (which
  // software GL lacks), compile only, so the headless page exercises it.
  const flags = [nodev ? 'test' : 'dev', render ? null : 'norender', shadercheck ? 'shadercheck' : null, prewarm ? 'prewarm' : null].filter(Boolean).join('&');
  const running = readState();
  if (running) {
    const st = await alive(running.port);
    if (st) {
      if (st.flags !== flags) say(`note: running server has ?${st.flags} (wanted ?${flags}); use reload --render/--norender or stop`);
      if (st.state !== 'ready') return waitReady(running.port, say);
      say(`reusing dev server on port ${running.port} (?${st.flags}, ${path.relative(ROOT, st.html)})`);
      return st;
    }
    fs.rmSync(STATE, { force: true });
  }
  const file = html ? path.resolve(html) : DEFAULT_HTML;
  if (!html) say(`built ${path.relative(ROOT, file)} in ${build(file).toFixed(1)}s`);
  if (!fs.existsSync(file)) throw new Error('missing ' + file);
  port = port || defaultPort();
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const log = fs.openSync(LOG, 'w');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', file, String(port), flags, size, html ? '' : '1'], {
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  fs.writeFileSync(STATE, JSON.stringify({ port, pid: child.pid, html: file, flags }, null, 1));
  say(`dev server pid ${child.pid} on port ${port}, booting ?${flags} (log: dist/dev.log)`);
  return waitReady(port, say);
}

async function waitReady(port, say) {
  let t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < BOOT_TIMEOUT_MS) {
    const st = await alive(port);
    // Queueing for a browser slot is not booting: the boot clock starts after it.
    if (st?.phase === 'waiting for a browser slot') t0 = Date.now();
    if (st?.state === 'ready') {
      say(`ready: boot ${st.bootSeconds}s (${st.url})`);
      return st;
    }
    if (st?.state === 'failed') throw new Error('boot failed: ' + st.error + ' (see dist/dev.log)');
    if (st && st.phase !== last) {
      last = st.phase;
      say(`  ${st.phase}...`);
    }
    if (!st && Date.now() - t0 > 60000) throw new Error('server not answering; see dist/dev.log');
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('boot timed out');
}

// ---------------------------------------------------------------------------------
// Server side (the background process).
async function serve(file, port, flags, size, ownBuild) {
  const chromium = await loadChromium();
  const [width, height] = size.split('x').map(Number);
  const status = { state: 'booting', phase: 'waiting for a browser slot', html: file, flags, port, pid: process.pid, url: '', bootSeconds: null, frozen: false };
  let errors = [];
  let queue = Promise.resolve();
  const label = 'dev ' + path.basename(ROOT);
  let releaseSlot = null;
  let cdp = null;
  let lastOp = Date.now();

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      let op;
      try {
        op = JSON.parse(body || '{}');
      } catch (e) {
        res.end(JSON.stringify({ error: 'bad json' }));
        return;
      }
      const reply = (out) => {
        out.newErrors = errors.length;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(out));
      };
      if (op.op === 'status') return reply({ ...status, slots: `${slotHolders().length}/${slotCount()}` });
      lastOp = Date.now();
      queue = queue.then(() =>
        // Stopping or reading errors needs no running page (nor a slot).
        (op.op === 'stop' || op.op === 'errors' ? Promise.resolve() : thaw())
          .then(() => handle(op))
          .then(reply, (e) => reply({ error: String(e.message || e).split('\n')[0] }))
          .finally(() => (lastOp = Date.now())),
      );
    });
  });
  server.listen(port, '127.0.0.1');

  releaseSlot = await acquireSlot(label);
  status.phase = 'launching browser';
  const browser = await chromium.launch({
    executablePath: chromeExecutable(),
    // DEC_JS_FLAGS: V8 flags for the page, e.g. `--no-turbo-inlining` so a profile names the real function.
    args: [...glArgs(), '--autoplay-policy=no-user-gesture-required', ...(process.env.DEC_JS_FLAGS ? ['--js-flags=' + process.env.DEC_JS_FLAGS] : [])],
  });

  // Idle: freeze the page (no timers, no frames) and hand the slot to someone else.
  async function freeze() {
    if (status.frozen || status.state !== 'ready' || !cdp || Date.now() - lastOp < IDLE_FREEZE_MS) return;
    // CSS animations run on the compositor even with the main thread frozen (a
    // software GPU process keeps compositing the HUD's pulses): pause them too.
    await cdp.send('Animation.enable').catch(() => {});
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 }).catch(() => {});
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    status.frozen = true;
    releaseSlot?.();
    releaseSlot = null;
    console.log(`idle ${Math.round((Date.now() - lastOp) / 1000)}s: page frozen, browser slot released`);
  }
  async function thaw() {
    if (!status.frozen) return;
    status.phase = 'waiting for a browser slot';
    releaseSlot = await acquireSlot(label);
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 }).catch(() => {});
    status.frozen = false;
    status.phase = status.state === 'ready' ? 'ready' : status.phase;
    console.log('page thawed');
  }
  if (IDLE_FREEZE_MS > 0)
    setInterval(() => {
      if (!status.frozen && status.state === 'ready' && Date.now() - lastOp >= IDLE_FREEZE_MS) queue = queue.then(freeze).catch(() => {});
    }, 5000).unref();
  // Each boot gets a fresh browser context (empty localStorage: no saved progress or
  // settings carried from the last run), so tests start from the same state;
  // `reload --keep` reopens the page in the same context to check what a save restores.
  let context = null;
  let page = null;

  async function boot(keepStorage = false) {
    const t0 = Date.now();
    Object.assign(status, { state: 'booting', phase: 'loading page', url: 'file://' + file + '?' + status.flags, error: null });
    errors = [];
    if (keepStorage && context) await page?.close().catch(() => {});
    else {
      if (context) await context.close().catch(() => {});
      context = await browser.newContext({ viewport: { width, height } });
    }
    page = await context.newPage();
    cdp = await context.newCDPSession(page);
    status.frozen = false;
    page.setDefaultTimeout(BOOT_TIMEOUT_MS);
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 500));
    });
    page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n')));
    await page.goto(status.url, { timeout: BOOT_TIMEOUT_MS, waitUntil: 'commit' });
    status.phase = 'waiting for the title menu';
    await page.waitForFunction(() => window.DeadEndCity && document.getElementById('startBtn'), null, { timeout: BOOT_TIMEOUT_MS, polling: 500 });
    status.phase = 'starting a game';
    await page.click('#startBtn', { timeout: BOOT_TIMEOUT_MS });
    // The opening call arrives a moment after the start: decline it and make sure the
    // game is in free roam and not paused.
    let playSince = 0;
    for (let i = 0; i < 600; i++) {
      const s = await page.evaluate(() => ({
        call: !document.getElementById('callOverlay').classList.contains('hidden'),
        mode: window.DeadEndCity.status().mode,
      }));
      if (s.call) {
        await page.click('#callDecline', { timeout: BOOT_TIMEOUT_MS });
        playSince = 0;
      } else if (s.mode === 'pause') await page.keyboard.press('Escape');
      else if (s.mode === 'play') {
        playSince ||= Date.now();
        // A second in play (the welcome card, a pause or a call would show by then).
        if (Date.now() - playSince > 1000) break;
      }
      await page.waitForTimeout(250);
    }
    Object.assign(status, { state: 'ready', phase: 'ready', bootSeconds: +((Date.now() - t0) / 1000).toFixed(1) });
    lastOp = Date.now();
    console.log(`ready in ${status.bootSeconds}s`);
  }

  // The heaviest functions of a V8 CPU profile: [self ms, total ms, name, line].
  function summariseProfile(profile, top, who = '') {
    const byId = new Map(profile.nodes.map((n) => [n.id, n])),
      self = new Map(),
      parent = new Map();
    for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
    (profile.samples || []).forEach((id, i) => self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0)));
    // A built-in (fillText, push, hypot...) is listed under the function that called it.
    const key = (n) => {
        const f = n.callFrame.functionName || '(anon)';
        if (n.callFrame.url || f[0] === '(') return `${f}:${n.callFrame.lineNumber + 1}`;
        const up = byId.get(parent.get(n.id));
        return up ? `${up.callFrame.functionName || '(anon)'} > ${f}:0` : `${f}:0`;
      },
      selfBy = new Map(),
      totalBy = new Map();
    // Line-level ticks inside each function (the built page's line numbers), for the hot-loop hunt.
    const linesBy = new Map();
    for (const n of profile.nodes) {
      if (!n.positionTicks) continue;
      const k = key(n),
        m = linesBy.get(k) || new Map();
      for (const t of n.positionTicks) m.set(t.line, (m.get(t.line) || 0) + t.ticks);
      linesBy.set(k, m);
    }
    for (const [id, us] of self) {
      const k = key(byId.get(id));
      selfBy.set(k, (selfBy.get(k) || 0) + us);
      const seen = new Set();
      for (let at = id; at; at = parent.get(at)) {
        const kk = key(byId.get(at));
        if (seen.has(kk)) continue;
        seen.add(kk);
        totalBy.set(kk, (totalBy.get(kk) || 0) + us);
      }
    }
    // `who` = 'bursts': the longest single calls of each section of update() (the first function
    // below `update` that is not the `timed` wrapper), in CPU ms: gaps where the thread was
    // descheduled (a sample more than 3 ms after the last) are left out, so a busy machine does
    // not look like a hitch. Each row: [ms, 0, section, '', the hottest functions in that call].
    if (who === 'bursts') {
      const sectionOf = new Map();
      const section = (id) => {
        if (sectionOf.has(id)) return sectionOf.get(id);
        const chain = [];
        for (let at = id; at; at = parent.get(at)) chain.push(byId.get(at).callFrame.functionName || '(anon)');
        chain.reverse();
        const u = chain.lastIndexOf('update');
        let name = u < 0 ? '(outside update)' : '(update itself)';
        for (let i = u + 1; u >= 0 && i < chain.length; i++)
          if (chain[i] !== 'timed' && chain[i] !== '(anon)') {
            name = chain[i];
            break;
          }
        sectionOf.set(id, name);
        return name;
      };
      const runs = [];
      let run = null;
      (profile.samples || []).forEach((id, i) => {
        const s = section(id),
          d = profile.timeDeltas[i] || 0;
        if (!run || run.s !== s) runs.push((run = { s, us: 0, gaps: 0, fn: new Map() }));
        if (d <= 3000) run.us += d;
        else run.gaps++;
        const k = key(byId.get(id));
        run.fn.set(k, (run.fn.get(k) || 0) + Math.min(d, 3000));
      });
      return runs
        .sort((a, b) => b.us - a.us)
        .slice(0, top)
        .map((r) => [+(r.us / 1000).toFixed(1), 0, r.s, '', [...r.fn].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, us]) => `${k.split(/:(?=\d+$)/)[0]} ${(us / 1000).toFixed(1)}`).join(', ') + (r.gaps ? ` (+${r.gaps} gaps)` : '')]);
    }
    // `who`: the callers of that function (self ms of the calls it made), to see who feeds a hot helper.
    if (who) {
      const callers = new Map();
      for (const [id, us] of self) {
        const n = byId.get(id);
        if ((n.callFrame.functionName || '(anon)') !== who) continue;
        const k = key(byId.get(parent.get(id)) || n);
        callers.set(k, (callers.get(k) || 0) + us);
      }
      return [...callers].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, us]) => [+(us / 1000).toFixed(1), 0, ...k.split(/:(?=\d+$)/), '']);
    }
    return [...selfBy]
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([k, us]) => [
        +(us / 1000).toFixed(1),
        +((totalBy.get(k) || 0) / 1000).toFixed(1),
        ...k.split(/:(?=\d+$)/),
        [...(linesBy.get(k) || [])]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([line, ticks]) => `${line}:${ticks}`)
          .join(' '),
      ]);
  }

  // The biggest allocators of a V8 sampling heap profile: [KB allocated, name, line].
  function summariseAllocations(head, top) {
    const by = new Map();
    // A built-in (no script: next, push, hypot...) is charged to the function that called it.
    (function walk(n, caller) {
      const own = `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`,
        k = n.callFrame.url || !caller ? own : `${caller} > ${n.callFrame.functionName || '(anon)'}`;
      by.set(k, (by.get(k) || 0) + (n.selfSize || 0));
      for (const c of n.children || []) walk(c, n.callFrame.url ? own : caller);
    })(head, '');
    const total = [...by.values()].reduce((a, b) => a + b, 0);
    return [['(all)', total], ...[...by].sort((a, b) => b[1] - a[1]).slice(0, top)].map(([k, b]) => [Math.round(b / 1024), ...k.split(/:(?=\d+$)/)]);
  }

  // The page's main-thread CPU seconds so far (Performance.getMetrics ThreadTime).
  async function threadTime() {
    await cdp.send('Performance.enable').catch(() => {});
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((m) => m.name === 'ThreadTime')?.value ?? 0;
  }

  // Calls DeadEndCity[method](...args) in the page. The page function is fixed: only
  // the method name and JSON arguments travel. Results come back as JSON text so
  // NaN / Infinity / cycles survive as strings instead of vanishing.
  async function call(method, args) {
    const text = await page.evaluate(
      ([method, args]) => {
        const api = window.DeadEndCity;
        if (!api || !Object.prototype.hasOwnProperty.call(api, method)) throw new Error('no console method ' + method);
        const member = api[method];
        const value = typeof member === 'function' ? member.apply(api, args) : member;
        const seen = new WeakSet();
        const text = JSON.stringify(value === undefined ? null : value, (k, v) => {
          if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
          if (typeof v === 'function') return '[function]';
          if (v && typeof v === 'object') {
            if (seen.has(v)) return '[cycle]';
            seen.add(v);
          }
          return v;
        });
        return text;
      },
      [method, args],
    );
    return JSON.parse(text);
  }

  async function handle(op) {
    if (status.state !== 'ready' && op.op !== 'stop' && op.op !== 'errors') throw new Error('not ready: ' + status.phase);
    switch (op.op) {
      case 'call': {
        const t0 = Date.now();
        // `cpu`: also report the page's main-thread CPU time for the call (CDP ThreadTime),
        // which a busy machine does not inflate the way wall-clock milliseconds are.
        const cpu0 = op.cpu ? await threadTime() : 0,
          heap0 = op.cpu ? (await cdp.send('Runtime.getHeapUsage').catch((e) => (console.log('heap', e.message), null))) || { usedSize: 0 } : null;
        // `profile`: V8 sampling profile of the call, the `profile` heaviest functions by self time.
        if (op.profile) {
          await cdp.send('Profiler.enable');
          await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
          await cdp.send('Profiler.start');
        }
        // `alloc`: V8 sampling heap profile (every allocation, collected ones too): the `alloc` biggest allocators.
        if (op.alloc) {
          await cdp.send('HeapProfiler.enable');
          await cdp.send('HeapProfiler.startSampling', { samplingInterval: 2048, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
        }
        const result = await call(op.method, op.args || []);
        const out = { result, ms: Date.now() - t0 };
        if (op.alloc) out.alloc = summariseAllocations((await cdp.send('HeapProfiler.stopSampling')).profile.head, Number(op.alloc) || 30);
        if (op.profile) out.profile = summariseProfile((await cdp.send('Profiler.stop')).profile, Number(op.profile) || 30, op.who || '');
        if (op.cpu) {
          out.cpuMs = Math.round(((await threadTime()) - cpu0) * 1000);
          const heap = await cdp.send('Runtime.getHeapUsage').catch(() => null);
          if (heap) out.heapMB = [+(heap0.usedSize / 1048576).toFixed(1), +(heap.usedSize / 1048576).toFixed(1), +(heap.totalSize / 1048576).toFixed(1)];
        }
        return out;
      }
      case 'keys':
      case 'wait': {
        const t0 = Date.now();
        const codes = op.codes || [];
        if (op.real) {
          for (const c of codes) await page.keyboard.down(c);
          await page.waitForTimeout(op.seconds * 1000);
          for (const c of codes) await page.keyboard.up(c);
          return { result: await call('status', []), ms: Date.now() - t0 };
        }
        return { result: await call('simulate', [op.seconds, codes]), ms: Date.now() - t0 };
      }
      case 'mouse': {
        const t0 = Date.now();
        const codes = op.codes || [];
        await page.mouse.move(op.x, op.y);
        for (const c of codes) await page.keyboard.down(c);
        if (op.down) await page.mouse.down();
        const end = Date.now() + (op.seconds || 0) * 1000;
        let tapAt = Date.now() + 200;
        // Held keys repeat as a real keyboard's do (keydown events with repeat: true);
        // `taps` are pressed afresh and let go every 0.3 s (steering corrections).
        while (Date.now() < end) {
          await page.waitForTimeout(Math.max(1, Math.min(50, end - Date.now())));
          for (const c of codes) await page.keyboard.down(c);
          if (op.taps?.length && Date.now() >= tapAt) {
            tapAt += 300;
            for (const c of op.taps) await page.keyboard.press(c, { delay: 60 });
          }
        }
        if (op.down) await page.mouse.up();
        for (const c of codes) await page.keyboard.up(c);
        return { result: await call('status', []), ms: Date.now() - t0 };
      }
      case 'shot': {
        fs.mkdirSync(SHOTS, { recursive: true });
        const clip = op.crop ? (([x, y, w, h]) => ({ x, y, width: w, height: h }))(op.crop) : undefined;
        const ext = op.full ? 'png' : 'jpg';
        const out = path.join(SHOTS, op.name + '.' + ext);
        let buf = await page.screenshot({ type: op.full ? 'png' : 'jpeg', quality: op.full ? undefined : 70, clip, timeout: BOOT_TIMEOUT_MS });
        if (op.width && !op.full) {
          // Downscale in the page's own 2D canvas (a fixed function; only data passes).
          const b64 = await page.evaluate(
            async ([src, width]) => {
              const img = new Image();
              img.src = 'data:image/jpeg;base64,' + src;
              await img.decode();
              const c = document.createElement('canvas');
              c.width = width;
              c.height = Math.round((img.height * width) / img.width);
              c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
              return c.toDataURL('image/jpeg', 0.7).split(',')[1];
            },
            [buf.toString('base64'), op.width],
          );
          buf = Buffer.from(b64, 'base64');
        }
        fs.writeFileSync(out, buf);
        return { result: { path: path.relative(ROOT, out), bytes: buf.length } };
      }
      case 'heap': {
        // The page's JS heap after a full collection (what a new feature's tables and kits weigh).
        await cdp.send('HeapProfiler.enable');
        await cdp.send('HeapProfiler.collectGarbage');
        const usage = await cdp.send('Runtime.getHeapUsage');
        return { result: { usedMB: +(usage.usedSize / 1048576).toFixed(1), totalMB: +(usage.totalSize / 1048576).toFixed(1) } };
      }
      case 'cpucost': {
        // CPU seconds the browser's processes spend over `seconds` of wall-clock time, per drawn
        // frame (renderHiccups counts them): under software GL the GPU process's share is the
        // cost of the pixels, which wall-clock frame times on a shared machine cannot show.
        const session = await browser.newBrowserCDPSession();
        const read = async () => (await session.send('SystemInfo.getProcessInfo')).processInfo;
        await call('renderHiccups', [true]);
        const before = await read();
        await page.waitForTimeout(op.seconds * 1000);
        const after = await read();
        const frames = (await call('renderHiccups', [false])).frames;
        await session.detach().catch(() => {});
        const byType = {};
        const key = (p) => `${p.type}:${p.id}`;
        const was = new Map(before.map((p) => [key(p), p.cpuTime]));
        for (const p of after) byType[p.type] = (byType[p.type] || 0) + p.cpuTime - (was.get(key(p)) ?? 0);
        const out = { frames, seconds: op.seconds };
        for (const [type, cpu] of Object.entries(byType)) out[type + 'CpuMsPerFrame'] = frames ? +((cpu * 1000) / frames).toFixed(1) : null;
        return { result: out };
      }
      case 'profile': {
        // A CPU (or sampled allocation) profile of the live page for `seconds` of wall-clock
        // time, summarised as self time by function (the line is in the built page).
        await cdp.send('Profiler.enable');
        if (op.alloc) {
          await cdp.send('HeapProfiler.enable');
          await cdp.send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
          await page.waitForTimeout(op.seconds * 1000);
          const { profile } = await cdp.send('HeapProfiler.stopSampling');
          return { result: summarizeAllocation(profile, op.top || 25) };
        }
        await cdp.send('Profiler.setSamplingInterval', { interval: 400 });
        await cdp.send('Profiler.start');
        await page.waitForTimeout(op.seconds * 1000);
        const { profile } = await cdp.send('Profiler.stop');
        return { result: summarizeProfile(profile, op.top || 25) };
      }
      case 'errors': {
        const out = errors;
        errors = [];
        return { result: out };
      }
      case 'reload': {
        let buildSeconds = null;
        if (ownBuild) buildSeconds = +build(file).toFixed(1);
        if (op.flags) status.flags = op.flags;
        boot(!!op.keep).catch((e) => Object.assign(status, { state: 'failed', error: String(e.message || e) }));
        return { result: { buildSeconds, flags: status.flags, booting: true, keptStorage: !!op.keep } };
      }
      case 'stop':
        setTimeout(async () => {
          await browser.close().catch(() => {});
          try {
            if (readState()?.pid === process.pid) fs.rmSync(STATE, { force: true });
          } catch {}
          process.exit(0);
        }, 50);
        return { result: 'stopped' };
      default:
        throw new Error('unknown op ' + op.op);
    }
  }

  try {
    await boot();
  } catch (e) {
    Object.assign(status, { state: 'failed', error: String(e.message || e) });
    console.log('boot failed: ' + e.stack);
  }
}

// ---------------------------------------------------------------------------------
// Profile summaries (the `profile` op).
function summarizeProfile(profile, top) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = profile.timeDeltas[i] || 0;
    total += dt;
    self.set(profile.samples[i], (self.get(profile.samples[i]) || 0) + dt);
  }
  const byFunction = new Map();
  let idle = 0;
  for (const [id, t] of self) {
    const f = byId.get(id).callFrame;
    if (f.functionName === '(idle)') {
      idle += t;
      continue;
    }
    const key = (f.functionName || '(anonymous)') + (f.url ? ' @' + (f.lineNumber + 1) : '');
    byFunction.set(key, (byFunction.get(key) || 0) + t);
  }
  const busy = total - idle;
  const rows = [...byFunction].sort((a, b) => b[1] - a[1]).slice(0, top);
  return { seconds: +(total / 1e6).toFixed(2), busyMs: +(busy / 1000).toFixed(0), top: rows.map(([k, t]) => [k, +(t / 1000).toFixed(1), +((100 * t) / Math.max(1, busy)).toFixed(1)]) };
}
function summarizeAllocation(profile, top) {
  const byFunction = new Map();
  let total = 0;
  const walk = (node) => {
    const f = node.callFrame,
      own = node.selfSize || 0;
    total += own;
    if (own) {
      const key = (f.functionName || '(anonymous)') + (f.url ? ' @' + (f.lineNumber + 1) : '');
      byFunction.set(key, (byFunction.get(key) || 0) + own);
    }
    for (const c of node.children || []) walk(c);
  };
  walk(profile.head);
  return { totalKB: Math.round(total / 1024), top: [...byFunction].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => [k, Math.round(n / 1024)]) };
}

// ---------------------------------------------------------------------------------
// CLI.
function parseArg(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function print(reply, max) {
  if (reply.error) {
    console.log('ERROR ' + reply.error);
    process.exitCode = 1;
  } else {
    const text = typeof reply.result === 'string' ? reply.result : JSON.stringify(reply.result);
    console.log(max && text.length > max ? text.slice(0, max) + `… [${text.length} chars; --max N or --full]` : text);
    if (reply.profile) for (const r of reply.profile) console.log(`  ${String(r[0]).padStart(8)} self ms ${String(r[1]).padStart(8)} total ms  ${r[2]} :${r[3]}  ${r[4] ? 'lines(ticks) ' + r[4] : ''}`);
    if (reply.alloc) for (const r of reply.alloc) console.log(`  ${String(r[0]).padStart(8)} KB allocated  ${r[1]} :${r[2]}`);
    if (reply.cpuMs !== undefined) console.log(`(page CPU ${reply.cpuMs} ms of ${reply.ms} ms wall${reply.heapMB ? `; JS heap ${reply.heapMB[0]} -> ${reply.heapMB[1]} MB used of ${reply.heapMB[2]} MB` : ''})`);
  }
  if (reply.newErrors) console.log(`(${reply.newErrors} new console errors: node tools/dev.mjs errors)`);
}

async function main(argv) {
  const opts = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--full' || a === '--real' || a === '--down' || a === '--render' || a === '--norender' || a === '--nodev' || a === '--keep' || a === '--shadercheck' || a === '--prewarm' || a === '--allocations' || a === '--cpu') opts[a.slice(2)] = true;
    else if (a === '--profile' || a === '--who' || a === '--alloc' || a === '--port' || a === '--keys' || a === '--max' || a === '--top' || a === '--crop' || a === '--width' || a === '--size') opts[a.slice(2)] = argv[++i];
    else pos.push(a);
  }
  const [cmd, ...rest] = pos;
  const max = opts.full ? 0 : Number(opts.max || 1500);
  switch (cmd) {
    case 'serve':
      return serve(rest[0], Number(rest[1]), rest[2], rest[3], rest[4] === '1');
    case 'start':
      await start({ html: rest[0], render: !!opts.render, nodev: !!opts.nodev, shadercheck: !!opts.shadercheck, prewarm: !!opts.prewarm, size: opts.size, port: Number(opts.port) || null });
      return;
    case 'status': {
      const st = readState();
      const live = st && (await alive(st.port));
      console.log(live ? JSON.stringify(live) : 'no dev server running');
      return;
    }
    case 'call':
      if (!rest[0]) throw new Error('usage: call <method> [jsonArg ...]');
      return print(await request({ op: 'call', method: rest[0], args: rest.slice(1).map(parseArg), cpu: !!opts.cpu, profile: opts.profile ? Number(opts.profile) : 0, alloc: opts.alloc ? Number(opts.alloc) : 0, who: opts.who || '' }), max);
    case 'keys':
      return print(await request({ op: 'keys', codes: String(rest[0]).split(','), seconds: Number(rest[1] || 1), real: !!opts.real }), max);
    case 'wait':
      return print(await request({ op: 'wait', seconds: Number(rest[0] || 1), real: !!opts.real }), max);
    case 'mouse':
      return print(
        await request({ op: 'mouse', x: Number(rest[0]), y: Number(rest[1]), seconds: Number(rest[2] || 0), down: !!opts.down, codes: opts.keys ? String(opts.keys).split(',') : [] }),
        max,
      );
    case 'shot':
      return print(
        await request({ op: 'shot', name: rest[0] || 'shot', full: !!opts.full, crop: opts.crop ? opts.crop.split(',').map(Number) : null, width: Number(opts.width) || 0 }),
        0,
      );
    case 'heap':
      return print(await request({ op: 'heap' }), max);
    case 'cpucost':
      return print(await request({ op: 'cpucost', seconds: Number(rest[0] || 20) }), max);
    case 'profile':
      return print(await request({ op: 'profile', seconds: Number(rest[0] || 10), alloc: !!opts.allocations, top: Number(opts.top) || 25 }), max);
    case 'errors': {
      const reply = await request({ op: 'errors' });
      if (reply.error) return print(reply, max);
      console.log(reply.result.length ? reply.result.join('\n') : 'no console errors');
      return;
    }
    case 'reload': {
      const st = readState();
      let flags = opts.render ? st.flags.replace(/&?norender/, '') : opts.norender && !/norender/.test(st.flags) ? st.flags + '&norender' : undefined;
      if (opts.shadercheck && !/shadercheck/.test(flags ?? st.flags)) flags = (flags ?? st.flags) + '&shadercheck';
      if (opts.prewarm && !/prewarm/.test(flags ?? st.flags)) flags = (flags ?? st.flags) + '&prewarm';
      const reply = await request({ op: 'reload', flags, keep: !!opts.keep });
      if (reply.error) return print(reply, max);
      if (reply.result.buildSeconds != null) console.log(`rebuilt in ${reply.result.buildSeconds}s`);
      await waitReady(st.port, (s) => console.log(s));
      return;
    }
    case 'stop': {
      const st = readState();
      if (!st || !(await alive(st.port))) {
        fs.rmSync(STATE, { force: true });
        console.log('no dev server running');
        return;
      }
      print(await request({ op: 'stop' }), max);
      // The server exits a moment after replying: wait, so a `start` right after
      // does not reuse a server that is going away.
      for (let i = 0; i < 40 && (await alive(st.port)); i++) await new Promise((r) => setTimeout(r, 250));
      return;
    }
    default:
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^\/\/ ?/gm, ''));
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch((e) => {
    console.error('ERROR ' + (e.message || e));
    process.exit(1);
  });
}
