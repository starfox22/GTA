// Usage: node tools/motorcycle-render-review.mjs HTML OUTDIR LABEL [TYPE,...]
// Same named-method fixture on frozen main and final source; no game/snapshot instrumentation.
// Current after input: dist/review-2026-10-14-ready.html (hash recorded per run).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

const html = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const label = process.argv[4] || 'review';
const types = (process.argv[5] || 'bike,cruiser,kr500').split(',');
if (!fs.existsSync(html) || types.some(type => !['bike', 'cruiser', 'kr500'].includes(type))) throw Error('valid HTML and motorcycle type list required');
fs.mkdirSync(out, { recursive: true });
const report = { label, html, htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'), fixture: { seed: 1, origin: [680, 4520], heading: 0, tier: 'high', clock: 13,
  view: 'street inspection', inspect: [18, 10, 6], closeUp: 12, viewport: [1000, 700], crop: [280, 140, 400, 410],
  noticeWallClockSettleMs: 6500 }, cases: [], errors: [] };
const { browser } = await launchBrowser({ label: 'motorcycle-' + label, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.setDefaultTimeout(300000);
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
page.on('pageerror', error => report.errors.push(error.stack || error.message));
const namedMethods = new Set(['status', 'holdSimulation', 'sky', 'setClock', 'settings', 'graphics', 'wanted', 'teleport',
  'drive', 'placeVehicle', 'closeUp', 'inspectView', 'hitchRun', 'launch', 'vehicleAt', 'vehicleById', 'carModels',
  'drivingState', 'damageReport', 'burnVehicle', 'seedRandom', 'shootVehicle', 'frameFaults', 'gpuContext', 'cameraView', 'radio']);
async function call(method, ...args) {
  if (!namedMethods.has(method)) throw Error('undeclared developer method ' + method);
  return page.evaluate(([name, args]) => window.DeadEndCity[name](...args), [method, args]);
}
async function setup(rows) {
  for (const [method] of rows) if (!namedMethods.has(method)) throw Error('undeclared developer method ' + method);
  // Ordinary named setters share one IPC task. The held game clock and explicit
  // hitch frames remain unchanged; no generic game setter or evaluate hook is added.
  return page.evaluate(rows => {
    for (const [method, args] of rows) window.DeadEndCity[method](...args);
  }, rows);
}
async function drawOne() { return call('hitchRun', 1 / 60, [], 1, false, true); }
async function shot(name) {
  // A crop removes HUD boxes from these inspection images without modifying game UI.
  // Full screenshots remain available for QA context and preserve the default FPS overlay.
  const prefix = `${label}-${name}`;
  if (name === types[0] + '-rest')
    await page.screenshot({ path: path.join(out, prefix + '-full.png'), timeout: 180000 });
  await page.screenshot({ path: path.join(out, prefix + '.png'), clip: { x: 280, y: 140, width: 400, height: 410 }, timeout: 180000 });
  console.log('shot', prefix);
}
try {
  await page.goto('file://' + html + '?dev&seed=1&hold&shadercheck', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => !!window.DeadEndCity && window.DeadEndCity.status().mode === 'menu', null, { timeout: 300000 });
  if ((await call('status')).renderer !== '3d') throw Error('rendered motorcycle review needs 3D');
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  await page.mouse.move(998, 0);
  console.log('ready', label);
  await setup([
    ['holdSimulation', [true]],
    ['settings', [{ cameraView: 'street', sound: false, gps: false, minimapFolded: true, keyHints: false,
      playerRing: false, motionBlur: false, lookAhead: 0, radioVolume: 0, abs: false, esc: false, tcs: false }]],
    ['graphics', ['high']], ['sky', ['clear']], ['setClock', [13]], ['wanted', [0]], ['inspectView', [18, 10, 6]],
    // Age welcome/radio notices through the real HUD clock without expensive drawing.
    ['hitchRun', [6, [], 1, false, false]],
  ]);
  for (let index = 0; index < types.length; index++) {
    const type = types[index], row = { type, captures: [] };
    // Move the preceding review vehicle away from the common camera footprint.
    await setup([
      ...(index ? [['placeVehicle', [520 - index * 80, 4520, 0]]] : []),
      ['teleport', [680, 4520]], ['drive', [type, 0, 0]], ['placeVehicle', [680, 4520, 0]], ['closeUp', [12]],
      // Boarding posts a station/wheelie notice; age it without adding any overlays.
      ['hitchRun', [6, [], 1, false, false]],
    ]);
    // Radio popovers expire on performance.now(), independently of the held
    // simulation clock. Let the ordinary notice deadline pass, then update HUD.
    await page.waitForTimeout(6500);
    await setup([['settings', [{}]], ['hitchRun', [.15, [], 1, false, false]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
    const vehicle = await call('vehicleAt', 680, 4520);
    if (vehicle.type !== type) throw Error('wrong review vehicle ' + JSON.stringify(vehicle));
    row.id = vehicle.id;
    await page.waitForFunction(id => window.DeadEndCity.carModels()?.some(model => model.id === id && model.draws > 0), row.id);
    row.rest = await page.evaluate(id => ({ status: window.DeadEndCity.status(),
      model: window.DeadEndCity.carModels().find(model => model.id === id), camera: window.DeadEndCity.cameraView(),
      radio: window.DeadEndCity.radio() }), row.id);
    await shot(type + '-rest');
    // Whole rendered frames advance actual motion and wheel rotation together.
    await setup([['launch', [2]], ['hitchRun', [.1, [], 1, false, true]]]);
    row.rolling = await call('vehicleById', row.id);
    if (!(row.rolling.x > vehicle.x || row.rolling.kmh > 0)) throw Error(type + ': moving fixture did not move');
    await shot(type + '-rolling');
    await call('hitchRun', .1, ['KeyD'], 1, false, true);
    row.steering = await call('drivingState');
    await shot(type + '-steering');
    await setup([['placeVehicle', [680, 4520, 0]], ['hitchRun', [.1, [], 1, false, true]]]);
    // Two real right-side shots: seedRandom controls the damage chance, while
    // height scatter uses the map's separate seededRandom stream. Read actual
    // flatTires per model; body hits do not guarantee a puncture. Frozen main's
    // missing motorcycle tyre branch leaves all three types intact.
    row.puncture = await page.evaluate(id => {
      window.DeadEndCity.seedRandom(1);
      const hits = window.DeadEndCity.shootVehicle(id, 'right', 2);
      return { hits, damage: window.DeadEndCity.damageReport(id) };
    }, row.id);
    await drawOne();
    await shot(type + '-front-shot');
    await setup([['burnVehicle', [row.id, 20]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
    row.burnt = await call('damageReport', row.id);
    await shot(type + '-burnt');
    await setup([['burnVehicle', [row.id, 0, true]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
    const repaired = await page.evaluate(id => ({ damage: window.DeadEndCity.damageReport(id),
      model: window.DeadEndCity.carModels().find(model => model.id === id) }), row.id);
    row.repaired = repaired.damage; row.finalModel = repaired.model;
    await shot(type + '-repaired');
    report.cases.push(row);
    fs.writeFileSync(path.join(out, label + '-motorcycle-review.json'), JSON.stringify(report, null, 2));
  }
  const final = await page.evaluate(() => ({ frameFaults: window.DeadEndCity.frameFaults(), gpuContext: window.DeadEndCity.gpuContext() }));
  report.frameFaults = final.frameFaults; report.gpuContext = final.gpuContext;
  if (report.errors.length || report.frameFaults.count) throw Error('renderer errors/faults: ' + report.errors.slice(0, 3).join('; ') + ' ' + JSON.stringify(report.frameFaults));
  console.log('PASS motorcycle rendered fixture', label, types.join(','));
} catch (error) {
  report.failure = error.stack || error.message;
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, label + '-motorcycle-review.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
