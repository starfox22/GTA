// Scripted screenshot tour for visual review and regression testing.
//
//   node tools/tour.mjs <steps.json> [outdir] [html]
//
// steps.json is an array of steps run in order after the game has started and
// the opening phone call has been dismissed:
//   { "name": "harbor", "js": "DeadEndCity.look(3000, 4000, 1)", "wait": 1500,
//     "keys": [["KeyW", 1200]], "shot": true }
// `js` runs in the page (it only sees window globals such as window.DeadEndCity,
// which is the game's developer console). `keys` holds [code, milliseconds]
// pairs pressed one after another. `hold` lists key codes kept down through the
// wait and the screenshot (e.g. a brake held while the shot is taken).
// A step screenshots unless "shot": false.
// The script prints each step's js result and every console error.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = path.resolve(process.argv[3] || 'dist/tour');
const file = path.resolve(process.argv[4] || 'dead-end-city.html');
if (!fs.existsSync(file)) { console.error('missing ' + file + ': build it first (python3 tools/build.py)'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--disable-accelerated-2d-canvas',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('[console] ' + m.text());
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));

await page.goto('file://' + file + '?dev', { timeout: 300000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn'), null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.click('#startBtn');
await page.waitForTimeout(2500);
// The opening call arrives a moment after the start: hang up so the tour
// starts from free roam, and make sure the game is not left paused.
for (let i = 0; i < 20; i++) {
  const state = await page.evaluate(() => ({
    call: !document.getElementById('callOverlay').classList.contains('hidden'),
    mode: window.DeadEndCity?.status().mode,
  }));
  if (state.call) {
    await page.click('#callDecline');
    await page.waitForTimeout(400);
    continue;
  }
  if (state.mode === 'pause') await page.keyboard.press('Escape');
  if (state.mode === 'play' && i > 4) break;
  await page.waitForTimeout(500);
}

let index = 0;
for (const step of steps) {
  index++;
  let result;
  if (step.js) {
    try {
      result = await page.evaluate(step.js);
    } catch (e) {
      result = 'ERROR ' + e.message;
    }
  }
  for (const [code, ms] of step.keys || []) {
    await page.keyboard.down(code);
    await page.waitForTimeout(ms);
    await page.keyboard.up(code);
  }
  for (const code of step.hold || []) await page.keyboard.down(code);
  await page.waitForTimeout(step.wait ?? 1200);
  if (step.after) {
    try {
      result = await page.evaluate(step.after);
    } catch (e) {
      result = 'ERROR ' + e.message;
    }
  }
  const name = String(index).padStart(2, '0') + '-' + (step.name || 'step');
  if (step.shot !== false) await page.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
  for (const code of step.hold || []) await page.keyboard.up(code);
  console.log(name, result === undefined ? '' : JSON.stringify(result).slice(0, 600));
}
console.log(`errors: ${errors.length}`);
for (const e of errors.slice(0, 30)) console.log(e);
await browser.close();
