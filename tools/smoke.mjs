// Rendered smoke: boots, checks the default FPS counter, starts and moves on foot,
// drives a known vehicle with real keys, opens the map and switches both cameras.
// Saves six screenshots, console.log and smoke.json; fails if a claimed action did not happen.
//   node tools/smoke.mjs [dead-end-city.html] [outdir] [--size 960x600]
// Slow software GL: DEC_SMOKE_MOVE_TIMEOUT_MS=240000 retains the same movement assertions with more wall time.
import { launchBrowser } from './browser.mjs';
import path from 'node:path';
import fs from 'node:fs';

const file = path.resolve(process.argv[2] || 'dead-end-city.html');
if (!fs.existsSync(file)) { console.error('missing ' + file + ': build it first (python3 tools/build.py)'); process.exit(1); }
const out = path.resolve(process.argv[3] || 'dist/smoke');
fs.mkdirSync(out, { recursive: true });

// A machine-wide browser slot first (tools/browser.mjs), then Chromium.
const { browser } = await launchBrowser({ label: 'smoke', args: ['--autoplay-policy=no-user-gesture-required'] });
const sizeAt = process.argv.indexOf('--size');
const size = /^(\d+)x(\d+)$/.exec(sizeAt < 0 ? '1280x800' : process.argv[sizeAt + 1] || '');
if (!size || +size[1] < 320 || +size[2] < 240) {
  await browser.close();
  throw new Error('--size needs WIDTHxHEIGHT (at least 320x240)');
}
const page = await browser.newPage({ viewport: { width: +size[1], height: +size[2] } });
const moveTimeout = Number(process.env.DEC_SMOKE_MOVE_TIMEOUT_MS || 60000);
if (!Number.isFinite(moveTimeout) || moveTimeout < 1000) {
  await browser.close();
  throw new Error('DEC_SMOKE_MOVE_TIMEOUT_MS must be a finite number of at least 1000');
}
page.setDefaultTimeout(300000);
const errors = [];
const warnings = [];
const logs = [];
const checks = { viewport: [+size[1], +size[2]], moveTimeout };
page.on('console', (m) => { const t = m.type(); const s = `[${t}] ${m.text()}`; logs.push(s); if (t === 'error') errors.push(s); else if (t === 'warning') warnings.push(s); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
const state = () => page.evaluate(() => window.DeadEndCity.status());
const shot = name => page.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
function assert(ok, message) { if (!ok) throw new Error(message); }
// Wait for observable movement, not a fixed number of wall-clock milliseconds:
// software GL may advance only a handful of simulation frames in that interval.
async function moveWithKey(key, distance, vehicle) {
  const before = await state();
  console.log('movement start', JSON.stringify({ key, distance, vehicle, before }));
  assert(before.mode === 'play' && before.vehicle === vehicle, 'wrong mode/vehicle before movement: ' + JSON.stringify(before));
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ x, y, distance, vehicle }) => {
      const s = window.DeadEndCity.status();
      return s.mode === 'play' && s.vehicle === vehicle && Math.hypot(s.x - x, s.y - y) >= distance;
    }, { x: before.x, y: before.y, distance, vehicle }, { timeout: moveTimeout, polling: 200 });
  } catch (e) {
    const diagnostic = await page.evaluate(() => ({ status: DeadEndCity.status(), stats: DeadEndCity.stats(), fps: document.getElementById('fpsCounter').textContent }));
    checks.movementFailure = { key, distance, vehicle, before, ...diagnostic };
    throw e;
  } finally {
    await page.keyboard.up(key);
  }
  const after = await state();
  return { before, after, distance: +Math.hypot(after.x - before.x, after.y - before.y).toFixed(2) };
}

try {
  await page.goto('file://' + file, { timeout: 300000, waitUntil: 'load' });
  await page.waitForFunction(() => !!window.DeadEndCity, null, { timeout: 300000 });
  checks.menu = await state();
  console.log('booted', JSON.stringify(checks.menu));
  assert(checks.menu.mode === 'menu', 'game did not boot to the title menu');
  assert(checks.menu.renderer === '3d', 'rendered smoke needs the 3D renderer to test both cameras');
  await page.waitForFunction(() => {
    const el = document.getElementById('fpsCounter');
    return window.DeadEndCity.settings().fps && el && !el.classList.contains('hidden') &&
      getComputedStyle(el).display !== 'none' && /^\d+ FPS/.test(el.textContent);
  }, null, { timeout: 60000 });
  checks.defaultFps = await page.locator('#fpsCounter').textContent();
  await shot('01-menu');
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  // If a build presents the opening call, dismiss it before testing movement.
  // The current build rings the payphone without forcing that overlay.
  if ((await state()).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  checks.started = await state();
  console.log('entered play');
  await shot('02-start');

  // Airport apron: clear space for both movement checks. Boarding is a named
  // console fixture, not a car theft test (nearby traffic and locks are random).
  await page.evaluate(() => window.DeadEndCity.teleport(420, 4400));
  checks.walk = await moveWithKey('KeyW', 16, null);
  await shot('03-walk');
  checks.boarded = await page.evaluate(() => {
    window.DeadEndCity.teleport(420, 4400);
    return window.DeadEndCity.drive('sedan', 0, Math.PI / 2);
  });
  assert(checks.boarded.vehicle === 'sedan', 'vehicle fixture failed to board the sedan');
  checks.drive = await moveWithKey('KeyW', 24, 'sedan');
  await shot('04-drive');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'map' &&
    !document.getElementById('mapOverlay').classList.contains('hidden'));
  checks.map = await state();
  await shot('05-map');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play' &&
    document.getElementById('mapOverlay').classList.contains('hidden'));
  assert(await page.evaluate(() => window.DeadEndCity.settings().cameraView === 'street'), 'fresh profile did not start in street view');
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => window.DeadEndCity.settings().cameraView === 'chase' && document.body.classList.contains('chase-view'));
  checks.chase = await page.evaluate(() => window.DeadEndCity.chaseCamera());
  await shot('06-chase');
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => window.DeadEndCity.settings().cameraView === 'street' && !document.body.classList.contains('chase-view'));
  checks.returnedToStreet = true;

  checks.browser = await page.evaluate(() => ({
    ua: navigator.userAgent,
    badge: document.getElementById('renderBadge')?.textContent,
    district: document.getElementById('district')?.textContent,
  }));
} catch (e) {
  errors.push('[smoke] ' + e.message);
} finally {
  fs.writeFileSync(path.join(out, 'console.log'), logs.join('\n'));
  fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify({ file, checks, errors, warnings }, null, 2) + '\n');
  console.log(JSON.stringify(checks, null, 2));
  console.log(`console lines: ${logs.length}, errors: ${errors.length}, warnings: ${warnings.length}`);
  for (const e of errors.slice(0, 40)) console.log(e);
  for (const w of warnings.slice(0, 10)) console.log(w);
  await browser.close();
}
process.exitCode = errors.length ? 1 : 0;
