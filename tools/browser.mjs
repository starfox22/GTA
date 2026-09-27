// Shared headless-browser launcher for every tool that boots the game (dev.mjs, smoke.mjs,
// tour.mjs, layout-audit.mjs, media-check.mjs): finds Playwright and Chromium on this
// machine, picks software (SwiftShader) or GPU WebGL, and shares a machine-wide limit on
// how many game browsers run at once ("browser slots"), so parallel agents queue for a
// slot instead of overloading the CPU (a software-rendered page wants a whole core).
//
//   DEC_BROWSER_SLOTS=N  browsers allowed at once on this machine (default: half the CPU
//                        cores, at least 1). Slots are lock files in the OS temp dir, so
//                        every worktree on the machine shares them; a dead holder's slot
//                        is reclaimed. An idle dev server gives its slot back (dev.mjs).
//   DEC_GPU=1            use the machine's GPU for WebGL instead of SwiftShader (a desktop
//                        run with a real graphics card: much faster renders, GPU-true shots)
//   CHROME_PATH=...      Chromium/Chrome to launch (default: the cloud image's
//                        /opt/pw-browsers build, else Playwright's own browser)
//   PLAYWRIGHT_MODULE=.. Playwright's entry file (default: the cloud image's global
//                        install, else `playwright` resolved from the repo or NODE_PATH)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLOUD_PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';
const CLOUD_BROWSERS = '/opt/pw-browsers';
const SLOT_DIR = path.join(os.tmpdir(), 'dead-end-city-browser-slots');

// ---------------------------------------------------------------------------------
// Finding Playwright and Chromium.
export async function loadChromium() {
  let entry = process.env.PLAYWRIGHT_MODULE || (fs.existsSync(CLOUD_PLAYWRIGHT) ? CLOUD_PLAYWRIGHT : null);
  if (!entry) {
    try {
      entry = createRequire(path.join(ROOT, 'tools', 'x.js')).resolve('playwright');
    } catch {
      throw new Error('Playwright not found: npm i -D playwright (or set PLAYWRIGHT_MODULE)');
    }
  }
  const mod = await import(pathToFileURL(entry).href);
  return mod.chromium || mod.default?.chromium;
}

export function chromeExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    const builds = fs
      .readdirSync(CLOUD_BROWSERS)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of builds) {
      const exe = path.join(CLOUD_BROWSERS, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  } catch {}
  return undefined; // Playwright's managed browser (npx playwright install chromium)
}

// WebGL flags: SwiftShader (deterministic, works on any machine) unless DEC_GPU=1.
export function glArgs() {
  if (process.env.DEC_GPU === '1') return ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
  return ['--disable-accelerated-2d-canvas', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
}

// ---------------------------------------------------------------------------------
// Browser slots: a counting semaphore made of lock files, shared machine-wide.
export function slotCount() {
  const n = Number(process.env.DEC_BROWSER_SLOTS);
  return n >= 1 ? Math.floor(n) : Math.max(1, Math.floor(os.cpus().length / 2));
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function readHolder(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// A slot whose holder died (or a lock file left empty for a while) is free again.
function stale(file) {
  const holder = readHolder(file);
  if (holder) return !pidAlive(holder.pid);
  try {
    return Date.now() - fs.statSync(file).mtimeMs > 5000;
  } catch {
    return false;
  }
}

function tryTake(label) {
  fs.mkdirSync(SLOT_DIR, { recursive: true });
  for (let i = 0; i < slotCount(); i++) {
    const file = path.join(SLOT_DIR, `slot-${i}.json`);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = fs.openSync(file, 'wx');
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, label, cwd: process.cwd(), since: new Date().toISOString() }));
        fs.closeSync(fd);
        return file;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        if (!stale(file)) break;
        // Atomic: of two processes reclaiming the same stale slot, one rename wins.
        try {
          fs.renameSync(file, `${file}.stale-${process.pid}`);
          fs.rmSync(`${file}.stale-${process.pid}`, { force: true });
        } catch {}
      }
    }
  }
  return null;
}

export function slotHolders() {
  try {
    return fs
      .readdirSync(SLOT_DIR)
      .filter((f) => /^slot-\d+\.json$/.test(f))
      .map((f) => ({ slot: f, ...readHolder(path.join(SLOT_DIR, f)) }));
  } catch {
    return [];
  }
}

const held = new Set();
let exitHooked = false;
function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  process.on('exit', () => {
    for (const file of held) if (readHolder(file)?.pid === process.pid) fs.rmSync(file, { force: true });
  });
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => process.exit(128));
}

// Waits for a free slot; resolves to a release function (safe to call twice).
export async function acquireSlot(label, say = (s) => console.log(s)) {
  hookExit();
  let file = tryTake(label);
  let told = 0;
  while (!file) {
    if (Date.now() - told > 60000) {
      const busy = slotHolders().map((h) => `${h.label || '?'} (pid ${h.pid})`);
      say(`waiting for a browser slot: ${busy.length}/${slotCount()} busy: ${busy.join(', ')} (DEC_BROWSER_SLOTS)`);
      told = Date.now();
    }
    await new Promise((r) => setTimeout(r, 2000));
    file = tryTake(label);
  }
  held.add(file);
  return () => {
    if (!held.delete(file)) return;
    if (readHolder(file)?.pid === process.pid) fs.rmSync(file, { force: true });
  };
}

// Takes a slot, then launches Chromium with the machine's GL flags plus `args`.
// Returns { browser, release }; closing the browser also releases the slot.
export async function launchBrowser({ label = path.basename(process.argv[1] || 'tool'), args = [], say } = {}) {
  const release = await acquireSlot(label, say);
  try {
    const chromium = await loadChromium();
    const browser = await chromium.launch({ executablePath: chromeExecutable(), args: [...glArgs(), ...args] });
    browser.on('disconnected', release);
    return { browser, release };
  } catch (e) {
    release();
    throw e;
  }
}
