// Native comparisons and shader/damage QA via declared developer methods only.
// Usage: node tools/approved-motorcycle-render-review.mjs FROZEN_HTML OUTDIR before|after [--tiers]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

const html = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), label = process.argv[4], tiers = process.argv.includes('--tiers');
if (!fs.existsSync(html) || !['before', 'after'].includes(label)) throw Error('HTML, OUTDIR and before|after required');
fs.mkdirSync(out, { recursive: true });
const report = { label, htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),
  fixture: { seed: 1, origin: [680, 4520], heading: 0, clock: 13, tier: 'high', viewport: [1000, 700],
    street: { inspect: [18, 10, 6], closeUp: 10 }, chase: { requestedHeadingDeg: 72, requestedPitchDeg: 18,
      note: 'Initial camera readiness resets the first request; case reports preserve the actual normal chase hero pose.' },
    crop: [220, 110, 520, 520], heldSimulation: true }, cases: [], errors: [], warnings: [] };
const named = new Set(['status', 'holdSimulation', 'settings', 'graphics', 'sky', 'setClock', 'wanted', 'teleport', 'drive',
  'placeVehicle', 'hitchRun', 'inspectView', 'closeUp', 'chaseLook', 'chaseCamera', 'vehicleAt', 'vehicleById', 'launch',
  'seedRandom', 'shootVehicle', 'damageReport', 'burnVehicle', 'carModels', 'frameFaults', 'gpuContext', 'assetCars', 'assetChar', 'approvedAssets']);
const { browser } = await launchBrowser({ label: 'approved-moto-' + label, args: ['--autoplay-policy=no-user-gesture-required'] });
console.log('acquired', label);
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.setDefaultTimeout(300000);
page.on('console', m => {
  const value = m.text();
  if (m.type() === 'error') report.errors.push(value);
  else if (m.type() === 'warning') {
    report.warnings.push(value);
    if (/INVALID_OPERATION|GL_INVALID|WebGL[^\n]*(?:error|invalid)/i.test(value)) report.errors.push('GPU warning: ' + value);
  }
});
page.on('pageerror', e => report.errors.push(e.stack || e.message));
async function call(method, ...args) {
  if (!named.has(method)) throw Error('Undeclared method ' + method);
  return page.evaluate(([name, args]) => window.DeadEndCity[name](...args), [method, args]);
}
async function setup(rows) {
  for (const [method] of rows) if (!named.has(method)) throw Error('Undeclared method ' + method);
  return page.evaluate(rows => { for (const [name, args] of rows) window.DeadEndCity[name](...args); }, rows);
}
async function draw() { return call('hitchRun', 1 / 60, [], 1, false, true); }
function save() { fs.writeFileSync(path.join(out, label + '-approved-motorcycles.json'), JSON.stringify(report, null, 2)); }
async function waitApprovedImages(size) {
  await page.waitForFunction(size => {
    const report = window.DeadEndCity.approvedAssets();
    return report.atlasSizes.length === 2 && report.atlasSizes.every(v => v[0] === size && v[1] === size);
  }, size);
}
async function state(id) {
  const checked = await page.evaluate(id => ({ status: window.DeadEndCity.status(), vehicle: window.DeadEndCity.vehicleById(id),
    model: window.DeadEndCity.carModels().find(m => m.id === id), damage: window.DeadEndCity.damageReport(id),
    camera: window.DeadEndCity.chaseCamera(), faults: window.DeadEndCity.frameFaults(), gpu: window.DeadEndCity.gpuContext(),
    approved: typeof window.DeadEndCity.approvedAssets === 'function' ? window.DeadEndCity.approvedAssets() : null }), id);
  if (checked.status.renderer !== '3d' || checked.faults.count || checked.gpu.lost || checked.gpu.losses || report.errors.length)
    throw Error('GPU review state failed: ' + JSON.stringify({ id, renderer: checked.status.renderer, faults: checked.faults, gpu: checked.gpu, errors: report.errors }));
  return checked;
}
async function shot(type, stage) {
  const name = `${label}-${type}-${stage}`;
  // One full context per model retains the FPS/HUD proof; the native comparison
  // crops avoid paying for a second software-GPU composite at every damage stage.
  if (stage === 'street') await page.screenshot({ path: path.join(out, name + '-full.png'), timeout: 540000 });
  await page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 220, y: 110, width: 520, height: 520 }, timeout: 540000 });
  save();
  console.log('shot', name);
}
try {
  await page.goto('file://' + html + '?dev&seed=1&hold&shadercheck', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu');
  console.log('menu', label);
  if ((await call('status')).renderer !== '3d') throw Error('Rendered approved-moto review requires WebGL');
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  console.log('play', label);
  await page.mouse.move(998, 0);
  await setup([['holdSimulation', [true]], ['settings', [{ sound: false, radioVolume: 0, gps: false, minimapFolded: true,
    keyHints: false, playerRing: false, motionBlur: false, abs: false, esc: false, tcs: false, lookAhead: 0 }]],
    ['graphics', ['high']], ['sky', ['clear']], ['setClock', [13]], ['wanted', [0]], ['hitchRun', [6, [], 1, false, false]]]);
  for (const [index, type] of ['bike', 'kr500'].entries()) {
    await setup([...(index ? [['placeVehicle', [400, 4520, 0]]] : []), ['teleport', [680, 4520]], ['drive', [type, 0, 0]],
      ['placeVehicle', [680, 4520, 0]], ['settings', [{ cameraView: 'street' }]], ['graphics', ['high']],
      ['inspectView', [18, 10, 6]], ['closeUp', [10]], ['hitchRun', [6, [], 1, false, false]]]);
    await page.waitForTimeout(6500); await setup([['settings', [{}]], ['hitchRun', [.1, [], 1, false, false]]]); await draw();
    if (label === 'after') { await waitApprovedImages(4096); await draw(); }
    const vehicle = await call('vehicleAt', 680, 4520), row = { type, id: vehicle.id, presets: [] };
    report.cases.push(row);
    if (vehicle.type !== type) throw Error('Wrong staged motorcycle ' + JSON.stringify(vehicle));
    row.street = await state(row.id); if (!row.street.model?.draws) throw Error(type + ': motorcycle not drawn');
    if (label === 'after' && !row.street.approved?.models.some(m => m.id === row.id && m.asset === (type === 'bike' ? 'm2_sport' : 'm1_enduro') && !m.far))
      throw Error(type + ': wrong approved source or player LOD');
    await shot(type, 'street');
    await setup([['settings', [{ cameraView: 'chase' }]], ['chaseLook', [0, 0, 72, 18]], ['hitchRun', [.1, [], 1, false, false]]]); await draw();
    row.chase = await state(row.id); await shot(type, 'chase');
    if (tiers) {
      for (const view of ['street', 'chase']) {
        await call('settings', { cameraView: view });
        for (const tier of ['low', 'medium', 'high', 'ultra', 'auto']) {
          await call('graphics', tier); await draw();
          const quality = await call('graphics'), expectedSize = ['LOW', 'MEDIUM'].includes(quality.tier) ? 2048 : 4096;
          await waitApprovedImages(expectedSize);
          // The image load updates its GPU texture; draw once more with the proven
          // correct resolution before accepting this preset, including AUTO.
          await draw(); const checked = await state(row.id);
          if (checked.status.renderer !== '3d' || !checked.model?.draws || checked.faults.count || checked.gpu.lost || checked.gpu.losses)
            throw Error(type + ': preset/view failed ' + tier + '/' + view);
          row.presets.push({ view, tier, quality, model: checked.model, approved: checked.approved, gpu: checked.gpu, faults: checked.faults });
          save();
          console.log('preset', type, tier, view);
        }
      }
    }
    await setup([['graphics', ['high']], ['settings', [{ cameraView: 'chase' }]], ['chaseLook', [0, 0, 72, 18]],
      ['launch', [2]], ['hitchRun', [.1, ['KeyD'], 1, false, true]]]);
    if (label === 'after') { await waitApprovedImages(4096); await draw(); }
    row.rolling = await state(row.id);
    if (!(row.rolling.vehicle.kmh > 0)) throw Error(type + ': real rolling fixture did not move');
    await shot(type, 'rolling');
    row.shots = await page.evaluate(id => { window.DeadEndCity.seedRandom(1);
      return { hits: window.DeadEndCity.shootVehicle(id, 'right', 40), damage: window.DeadEndCity.damageReport(id) }; }, row.id);
    await draw(); row.puncture = await state(row.id);
    if (!row.puncture.damage.flatTires.length) throw Error(type + ': actual side shots did not exercise tyre damage');
    await shot(type, 'puncture');
    await setup([['burnVehicle', [row.id, 20]], ['hitchRun', [1 / 60, [], 1, false, true]]]); row.burnt = await state(row.id);
    row.char = (await call('assetChar')).models.find(m => m.id === row.id);
    if (row.char?.state[2] !== 1 || label === 'after' && !row.char.materials.includes('approved'))
      throw Error(type + ': burnt asset did not compile/use its own atlas char shader');
    await shot(type, 'burnt');
    await setup([['burnVehicle', [row.id, 0, true]], ['hitchRun', [1 / 60, [], 1, false, true]]]); row.repaired = await state(row.id);
    if (row.repaired.damage.burnt || row.repaired.damage.flatTires.length || !Number.isFinite(row.repaired.damage.hp) ||
      row.repaired.damage.hp !== row.repaired.damage.maxhp)
      throw Error(type + ': repair state not restored');
    await shot(type, 'repaired');
    save();
  }
  report.assets = await call('assetCars'); report.frameFaults = await call('frameFaults'); report.gpu = await call('gpuContext');
  if (report.errors.length || report.frameFaults.count || report.gpu.lost || report.gpu.losses) throw Error('GPU review errors: ' + JSON.stringify(report.errors));
  console.log('PASS approved motorcycle GPU', label, report.cases.length, 'models', report.cases.reduce((n, row) => n + row.presets.length, 0), 'preset/camera cases');
} catch (error) { report.failure = error.stack || error.message; console.error(report.failure); process.exitCode = 1; }
finally { fs.writeFileSync(path.join(out, label + '-approved-motorcycles.json'), JSON.stringify(report, null, 2)); await browser.close(); }
