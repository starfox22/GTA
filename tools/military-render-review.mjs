// Reproducible real rendered M4 inspection, motion, burn/repair and preset checks.
// Usage: node tools/military-render-review.mjs FROZEN_HTML OUTDIR LABEL [--tiers]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

const html = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), label = process.argv[4];
if (!fs.existsSync(html) || !label) throw Error('Frozen HTML, output directory and label required');
fs.mkdirSync(out, { recursive: true });
const report = { htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),
  label, viewport: [960, 600], inspect: [65, 18, 8], closeUp: 12, errors: [], cases: [] };
const { browser } = await launchBrowser({ label: 'military-' + label, args: ['--autoplay-policy=no-user-gesture-required'] });
let context, page;
const named = new Set(['status', 'holdSimulation', 'god', 'graphics', 'sky', 'setClock', 'settings', 'look',
  'inspectView', 'carLineup', 'closeUp', 'hitchRun', 'storyProgress', 'drive', 'placeVehicle',
  'vehicleAt', 'launch', 'burnVehicle', 'vehicleHealth', 'damageReport', 'assetChar', 'frameFaults', 'gpuContext', 'viewMode', 'cameraView', 'drawProfile']);
async function call(method, ...args) {
  if (!named.has(method)) throw Error('Undeclared method ' + method);
  return page.evaluate(([method, args]) => window.DeadEndCity[method](...args), [method, args]);
}
async function setup(rows) {
  for (const [method] of rows) if (!named.has(method)) throw Error('Undeclared method ' + method);
  // Batch ordinary named setters to avoid a costly live software-GL frame between
  // each IPC round trip. Simulation remains held; explicit hitch frames still draw.
  return page.evaluate(rows => {
    for (const [method, args] of rows) window.DeadEndCity[method](...args);
  }, rows);
}
const draw = () => call('hitchRun', 1 / 60, [], 1, false, true);
async function boot() {
  console.log('boot', label);
  if (context) await context.close();
  context = await browser.newContext({ viewport: { width: 960, height: 600 } });
  page = await context.newPage(); page.setDefaultTimeout(300000);
  page.on('pageerror', error => report.errors.push(error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto('file://' + html + '?dev&seed=1&hold&shadercheck', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu');
  console.log('menu', label);
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  if ((await call('status')).renderer !== '3d') throw Error('WebGL renderer required');
  await setup([['holdSimulation', [true]], ['god', [true]], ['graphics', ['high']], ['sky', ['clear']], ['setClock', [13]],
    ['settings', [{ cameraView: 'street', sound: false, gps: false, keyHints: false, radioVolume: 0 }]], ['inspectView', [65, 18, 8]]]);
  console.log('ready', label);
}
async function shot(name, clip) {
  await page.mouse.move(8, 8);
  await page.screenshot({ path: path.join(out, label + '-' + name + '.png'), ...(clip ? { clip } : {}), timeout: 180000 });
  console.log('shot', label + '-' + name);
}
try {
  await boot();
  await setup([['look', [480, 4400, 3]], ['carLineup', [['jeep'], 480, 4400, 0, 40, '#596047', false]],
    ['closeUp', [12]], ['hitchRun', [.25, [], 3, false, false]]]);
  await call('hitchRun', .05, [], 3, false, true);
  await shot('materials');
  report.cases.push({ name: 'materials', status: await call('status'), camera: await call('cameraView') });
  await boot();
  await setup([['storyProgress', [4, true]], ['look', [680, 4520, 3]], ['drive', ['jeep', 0, 0]],
    ['placeVehicle', [680, 4520, 0]], ['closeUp', [12]], ['hitchRun', [.25, [], 3, false, false]]]); await draw();
  const car = await call('vehicleAt', 680, 4520);
  await call('launch', 6); await call('hitchRun', .1, [], 3, false, true);
  await shot('rolling', { x: 160, y: 85, width: 615, height: 445 });
  await call('hitchRun', .1, ['KeyD'], 3, false, true);
  await shot('steering', { x: 160, y: 85, width: 615, height: 445 });
  await call('placeVehicle', 680, 4520, 0); await call('burnVehicle', car.id, 20); await draw();
  const char = (await call('assetChar')).models.find(model => model.id === car.id);
  if (!char || char.state[2] !== 1) throw Error('Visible burnt M4 did not enter its char shader');
  if (process.argv.includes('--tiers') && !char.materials.includes('finish')) throw Error('New M4 wheel finish/char shader not assigned');
  report.cases.push({ name: 'burnt', char });
  await shot('burnt', { x: 160, y: 85, width: 615, height: 445 });
  await call('burnVehicle', car.id, 0, true); await draw();
  await call('hitchRun', 6, [], 1, false, false); await draw();
  await shot('repair', { x: 160, y: 85, width: 615, height: 445 });
  report.cases.push({ name: 'repair', damage: await call('damageReport', car.id), status: await call('status') });
  if (process.argv.includes('--tiers')) {
    // Burn hides the packed tyres; ordinary wear keeps them visible and actually
    // exercises the finish/soot program on the GPU rather than only assigning it.
    await call('vehicleHealth', 80); await draw();
    const worn = (await call('assetChar')).models.find(model => model.id === car.id);
    if (!worn?.materials.includes('finish') || !(worn.state[0] > 0) || worn.state[2] !== 0)
      throw Error('Visible worn wheels did not use the finish/soot program');
    report.cases.push({ name: 'worn-visible-wheels', char: worn });
    await call('burnVehicle', car.id, 0, true); await draw();
    for (const view of ['street', 'chase']) {
      await call('viewMode', view);
      for (const tier of ['low', 'medium', 'high', 'ultra', 'auto']) {
        await call('graphics', tier); await draw();
        const quality = await call('graphics'), profile = await call('drawProfile', 3);
        if (quality.setting !== tier || !(profile.total > 0 && profile.triangles > 0)) throw Error('Preset not applied or empty scene: ' + tier + '/' + view);
        report.cases.push({ name: 'preset', view, tier, quality, profile, faults: await call('frameFaults'), gpu: await call('gpuContext') });
      }
    }
    await call('graphics', 'high'); await draw(); await shot('chase');
    await call('setClock', 23); await draw(); await shot('night');
    report.cases.push({ name: 'driven-night', status: await call('status'), faults: await call('frameFaults') });
  }
  report.frameFaults = await call('frameFaults'); report.gpu = await call('gpuContext');
  if (report.errors.length || report.frameFaults.count) throw Error('Renderer errors/faults: ' + JSON.stringify(report.errors));
  console.log('PASS rendered military review', label);
} catch (error) {
  report.failure = error.stack || error.message; console.error(report.failure); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, label + '-military-review.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
