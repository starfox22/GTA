// Supplemental real side-shot tyre QA. Usage: node tools/motorcycle-puncture-render-review.mjs HTML OUTDIR before|after
// Same fixed named fixture on both inputs; no injected tyre state or snapshot hooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

const html = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), label = process.argv[4];
if (!fs.existsSync(html) || !['before', 'after'].includes(label)) throw Error('HTML, OUTDIR and before|after required');
fs.mkdirSync(out, { recursive: true });
const report = { label, htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),
  fixture: { type: 'bike', seed: 1, origin: [680, 4520], heading: 0, tier: 'high', clock: 13, rounds: 40, side: 'right',
    view: 'chase', orbitHeadingDeg: 72, orbitPitchDeg: 18, viewport: [1000, 700], crop: [180, 110, 600, 530] }, errors: [] };
const named = new Set(['status', 'holdSimulation', 'settings', 'graphics', 'sky', 'setClock', 'wanted', 'teleport',
  'drive', 'placeVehicle', 'hitchRun', 'chaseLook', 'chaseCamera', 'vehicleAt', 'seedRandom', 'shootVehicle',
  'damageReport', 'carModels', 'frameFaults', 'gpuContext']);
const { browser } = await launchBrowser({ label: 'motorcycle-puncture-' + label, args: ['--autoplay-policy=no-user-gesture-required'] });
console.log('acquired', label);
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.setDefaultTimeout(300000);
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
page.on('pageerror', error => report.errors.push(error.stack || error.message));
async function call(method, ...args) {
  if (!named.has(method)) throw Error('Undeclared developer method ' + method);
  return page.evaluate(([method, args]) => window.DeadEndCity[method](...args), [method, args]);
}
async function setup(rows) {
  for (const [method] of rows) if (!named.has(method)) throw Error('Undeclared developer method ' + method);
  return page.evaluate(rows => { for (const [method, args] of rows) window.DeadEndCity[method](...args); }, rows);
}
try {
  await page.goto('file://' + html + '?dev&seed=1&hold&shadercheck', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu');
  if ((await call('status')).renderer !== '3d') throw Error('Rendered tyre review needs WebGL');
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  await page.mouse.move(998, 0);
  await setup([['holdSimulation', [true]],
    ['settings', [{ cameraView: 'chase', sound: false, radioVolume: 0, gps: false, minimapFolded: true,
      keyHints: false, playerRing: false, motionBlur: false, abs: false, esc: false, tcs: false, lookAhead: 0 }]],
    ['graphics', ['high']], ['sky', ['clear']], ['setClock', [13]], ['wanted', [0]],
    ['hitchRun', [6, [], 1, false, false]], ['teleport', [680, 4520]], ['drive', ['bike', 0, 0]],
    ['placeVehicle', [680, 4520, 0]], ['hitchRun', [6, [], 1, false, false]]]);
  console.log('ready', label);
  await page.waitForTimeout(6500);
  await setup([['settings', [{}]], ['chaseLook', [0, 0, 72, 18]], ['hitchRun', [.05, [], 1, false, false]]]);
  const car = await call('vehicleAt', 680, 4520);
  if (car.type !== 'bike') throw Error('Wrong fixture vehicle');
  report.id = car.id;
  report.shots = await page.evaluate(id => {
    window.DeadEndCity.seedRandom(1);
    const hits = window.DeadEndCity.shootVehicle(id, 'right', 40);
    return { hits, damage: window.DeadEndCity.damageReport(id) };
  }, car.id);
  // Height scatter uses the game's separate seededRandom stream. Forty real
  // side entries exercise both axle windows without fabricating damage flags.
  await call('hitchRun', 1 / 60, [], 1, false, true);
  report.render = await page.evaluate(id => ({ camera: window.DeadEndCity.chaseCamera(),
    model: window.DeadEndCity.carModels().find(model => model.id === id),
    damage: window.DeadEndCity.damageReport(id), frameFaults: window.DeadEndCity.frameFaults(),
    gpu: window.DeadEndCity.gpuContext() }), car.id);
  if (!report.render.model?.draws) throw Error('Fixture motorcycle was not drawn');
  await page.screenshot({ path: path.join(out, label + '-motorcycle-puncture-full.png'), timeout: 180000 });
  await page.screenshot({ path: path.join(out, label + '-motorcycle-puncture.png'),
    clip: { x: 180, y: 110, width: 600, height: 530 }, timeout: 180000 });
  const flags = report.render.damage.flatTires;
  if (label === 'before' && flags.length) throw Error('Baseline unexpectedly punctured: ' + flags.join(','));
  if (label === 'after' && !flags.length) throw Error('Real side shots did not exercise a punctured tyre');
  if (report.errors.length || report.render.frameFaults.count || report.render.gpu.lost || report.render.gpu.losses)
    throw Error('Renderer fault or WebGL loss: ' + JSON.stringify(report.errors));
  console.log('PASS actual tyre puncture', label, JSON.stringify(flags));
} catch (error) {
  report.failure = error.stack || error.message; console.error(report.failure); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, label + '-motorcycle-puncture.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
