// Run the unchanged mounted-guns assertions in a private page, never the shared dev server.
// Usage: node tools/mounted-gun-followup.mjs FROZEN_HTML RECEIPT_JSON
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';
import originalTest from './tests/mounted-guns.mjs';

const html = path.resolve(process.argv[2]), output = path.resolve(process.argv[3]);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { htmlSha256: hash(html), originalTestSha256: hash(new URL('./tests/mounted-guns.mjs', import.meta.url)),
  recorderSha256: hash(new URL(import.meta.url)), mode: 'private NoRender page', checks: 0, calls: [], notes: [], errors: [] };
const named = new Set(['status', 'holdSimulation', 'god', 'teleport', 'driveArmed', 'mountedGunAim',
  'mountedGunTargets', 'mountedGuns', 'simulate', 'frameFaults']);
const { browser } = await launchBrowser({ label: 'mounted-gun-followup' });
let page;
async function call(method, ...args) {
  if (!named.has(method)) throw Error('Undeclared method ' + method);
  const result = await page.evaluate(([method, args]) => window.DeadEndCity[method](...args), [method, args]);
  report.calls.push({ phase: report.phase, method, args, result });
  return result;
}
const t = {
  call,
  wait: seconds => call('simulate', seconds, []),
  async keys(codes, seconds, { real = false } = {}) {
    const held = [].concat(codes);
    if (!real) return call('simulate', seconds, held);
    for (const key of held) await page.keyboard.down(key);
    await page.waitForTimeout(seconds * 1000);
    for (const key of held) await page.keyboard.up(key);
    return call('status');
  },
  assert(condition, message) { report.checks++; if (!condition) throw Error(message); },
  near(value, low, high, label) { this.assert(typeof value === 'number' && value >= low && value <= high, label + ': ' + value); },
  finite(value, label) {
    const walk = (v, at) => { if (typeof v === 'number') this.assert(Number.isFinite(v), at + ' not finite');
      else if (v && typeof v === 'object') for (const [key, next] of Object.entries(v)) walk(next, at + '.' + key); };
    walk(value, label);
  },
  note: note => report.notes.push(note),
};
async function freshPage() {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.setDefaultTimeout(120000);
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('pageerror', e => report.errors.push(e.stack || e.message));
  await page.goto('file://' + html + '?dev&norender', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu');
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  await page.waitForTimeout(1000);
}
try {
  report.phase = 'original unchanged assertions';
  await freshPage();
  await originalTest(t);
  report.originalAssertions = 'PASS';
  // An additional short burst proves the stationary initial target is hit before
  // a long trigger hold could make a fleeing target cross an incorrect offset ray.
  report.phase = 'fresh short stationary-target burst';
  await freshPage();
  await call('holdSimulation', true);
  await call('god', true);
  await call('teleport', 420, 6800);
  await call('driveArmed', 'heli', 0);
  const target = await call('mountedGunTargets', 220, 90);
  await call('mountedGunAim', target.person.x, target.person.y);
  await call('simulate', 2.5, []);
  const before = await call('mountedGuns');
  await call('simulate', .1, ['KeyF']);
  await call('simulate', .35, []);
  const after = await call('mountedGuns');
  t.assert(before.physicalLaidError <= 1, 'physical barrel was not laid before short burst');
  t.assert(after.targets.person.hp < before.targets.person.hp, 'short burst missed initial stationary bystander');
  t.assert(after.shots > before.shots && after.shots - before.shots <= 2, 'short burst did not preserve firing rate');
  report.shortBurst = { before, after, triggerSeconds: .1, followSeconds: .35 };
  report.frameFaults = await call('frameFaults');
  t.assert(!report.frameFaults.count && !report.errors.length, 'frame fault or page error during exact follow-up');
  report.status = 'PASS';
  console.log('PASS original mounted-guns + short stationary-target burst', report.checks, 'assertions');
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack || error.message; console.error(report.failure); process.exitCode = 1;
} finally {
  await browser.close(); report.browserClosed = true;
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2));
}
