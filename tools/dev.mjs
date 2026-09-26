// Persistent headless dev page + CLI: boot the game once, then send it console calls.
//
//   node tools/dev.mjs start [html] [--render] [--nodev] [--size 960x600] [--port N]
//   node tools/dev.mjs call <method> [jsonArg ...] [--max N | --full]
//   node tools/dev.mjs keys <Code[,Code...]> <seconds> [--real]
//   node tools/dev.mjs wait <seconds> [--real]
//   node tools/dev.mjs shot <name> [--full] [--crop x,y,w,h] [--width N]
//   node tools/dev.mjs errors | status | reload [--render|--norender] | stop
//
// `start` with no html builds dist/dev/game.html (and `reload` rebuilds it after code
// edits, reusing the browser). The page opens with `?dev&norender` (no WebGL renderer,
// no frame drawing: logic checks boot and tick fast); `--render` opens it with the real
// renderer for screenshots. The server runs in the background: state in dist/dev.json,
// its log in dist/dev.log. A second `start` reuses a running server.
//
// `call` runs one NAMED window.DeadEndCity method with JSON arguments (bare words that
// are not JSON are passed as strings) and prints the result as one compact JSON line,
// truncated to --max characters (default 1500; --full for all). NaN and Infinity come
// back as the strings "NaN" / "Infinity" so tests can see them. There is deliberately
// no way to run arbitrary page JS: the console has named methods only (CLAUDE.md).
//
// `keys` / `wait` advance game time with the console's simulate(seconds, keys) (no
// drawing, deterministic, fast); --real holds real key presses / waits wall-clock time.
// `shot` saves dist/dev/shots/<name>.jpg (JPEG q70 of the 960x600 viewport; --width
// scales it down further, --crop clips in viewport pixels, --full saves a PNG).
// Every command prints "(N new console errors: node tools/dev.mjs errors)" when the page
// logged errors since the last `errors`.
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'dist', 'dev.json');
const LOG = path.join(ROOT, 'dist', 'dev.log');
const DEFAULT_HTML = path.join(ROOT, 'dist', 'dev', 'game.html');
const SHOTS = path.join(ROOT, 'dist', 'dev', 'shots');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';
const BOOT_TIMEOUT_MS = 15 * 60 * 1000;

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
export async function start({ html = null, render = false, nodev = false, size = '960x600', port = null, quiet = false } = {}) {
  const say = quiet ? () => {} : (s) => console.log(s);
  const flags = [nodev ? 'test' : 'dev', render ? null : 'norender'].filter(Boolean).join('&');
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
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < BOOT_TIMEOUT_MS) {
    const st = await alive(port);
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
  const { chromium } = await import(PLAYWRIGHT);
  const [width, height] = size.split('x').map(Number);
  const status = { state: 'booting', phase: 'launching browser', html: file, flags, port, pid: process.pid, url: '', bootSeconds: null };
  let errors = [];
  let queue = Promise.resolve();

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
      if (op.op === 'status') return reply({ ...status });
      queue = queue.then(() => handle(op).then(reply, (e) => reply({ error: String(e.message || e).split('\n')[0] })));
    });
  });
  server.listen(port, '127.0.0.1');

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--disable-accelerated-2d-canvas', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'],
  });
  // Each boot gets a fresh browser context (empty localStorage: no saved progress or
  // settings carried from the last run), so tests start from the same state.
  let context = null;
  let page = null;

  async function boot() {
    const t0 = Date.now();
    Object.assign(status, { state: 'booting', phase: 'loading page', url: 'file://' + file + '?' + status.flags, error: null });
    errors = [];
    if (context) await context.close().catch(() => {});
    context = await browser.newContext({ viewport: { width, height } });
    page = await context.newPage();
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
    console.log(`ready in ${status.bootSeconds}s`);
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
        const result = await call(op.method, op.args || []);
        return { result, ms: Date.now() - t0 };
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
      case 'errors': {
        const out = errors;
        errors = [];
        return { result: out };
      }
      case 'reload': {
        let buildSeconds = null;
        if (ownBuild) buildSeconds = +build(file).toFixed(1);
        if (op.flags) status.flags = op.flags;
        boot().catch((e) => Object.assign(status, { state: 'failed', error: String(e.message || e) }));
        return { result: { buildSeconds, flags: status.flags, booting: true } };
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
  }
  if (reply.newErrors) console.log(`(${reply.newErrors} new console errors: node tools/dev.mjs errors)`);
}

async function main(argv) {
  const opts = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--full' || a === '--real' || a === '--render' || a === '--norender' || a === '--nodev') opts[a.slice(2)] = true;
    else if (a === '--port' || a === '--max' || a === '--crop' || a === '--width' || a === '--size') opts[a.slice(2)] = argv[++i];
    else pos.push(a);
  }
  const [cmd, ...rest] = pos;
  const max = opts.full ? 0 : Number(opts.max || 1500);
  switch (cmd) {
    case 'serve':
      return serve(rest[0], Number(rest[1]), rest[2], rest[3], rest[4] === '1');
    case 'start':
      await start({ html: rest[0], render: !!opts.render, nodev: !!opts.nodev, size: opts.size, port: Number(opts.port) || null });
      return;
    case 'status': {
      const st = readState();
      const live = st && (await alive(st.port));
      console.log(live ? JSON.stringify(live) : 'no dev server running');
      return;
    }
    case 'call':
      if (!rest[0]) throw new Error('usage: call <method> [jsonArg ...]');
      return print(await request({ op: 'call', method: rest[0], args: rest.slice(1).map(parseArg) }), max);
    case 'keys':
      return print(await request({ op: 'keys', codes: String(rest[0]).split(','), seconds: Number(rest[1] || 1), real: !!opts.real }), max);
    case 'wait':
      return print(await request({ op: 'wait', seconds: Number(rest[0] || 1), real: !!opts.real }), max);
    case 'shot':
      return print(
        await request({ op: 'shot', name: rest[0] || 'shot', full: !!opts.full, crop: opts.crop ? opts.crop.split(',').map(Number) : null, width: Number(opts.width) || 0 }),
        0,
      );
    case 'errors': {
      const reply = await request({ op: 'errors' });
      if (reply.error) return print(reply, max);
      console.log(reply.result.length ? reply.result.join('\n') : 'no console errors');
      return;
    }
    case 'reload': {
      const st = readState();
      const flags = opts.render ? st.flags.replace(/&?norender/, '') : opts.norender && !/norender/.test(st.flags) ? st.flags + '&norender' : undefined;
      const reply = await request({ op: 'reload', flags });
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
      return print(await request({ op: 'stop' }), max);
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
