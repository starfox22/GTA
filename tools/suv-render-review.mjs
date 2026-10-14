// Native before/after SUV renders and actual cabin/material/preset checks through named developer methods.
// Usage: node tools/suv-render-review.mjs FROZEN_HTML OUT_DIR LABEL [--after] [--portraits-only] [--affected] [--refresh-civilians] [--repair-only]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

const html = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), label = process.argv[4], after = process.argv.includes('--after'), portraitsOnly = process.argv.includes('--portraits-only'), repairOnly = process.argv.includes('--repair-only'), affected = repairOnly || process.argv.includes('--affected'), refreshCivilians = !repairOnly && process.argv.includes('--refresh-civilians');
if (!label || !fs.existsSync(html)) throw Error('Frozen HTML, output directory and label required');
fs.mkdirSync(out, { recursive: true });
const report = { label, htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),
  fixture: { seed: 1, origin: [680, 4520], heading: 0, viewport: [1000, 700], inspect: [65, 18, 8], closeUp: 10,
    crop: [170, 90, 660, 460], noticesWallClock: 6500, boardingDrawFirst: true, portraitsOnly, affected, refreshCivilians, repairOnly }, cases: [], errors: [] },
  methods = new Set(['status', 'holdSimulation', 'god', 'graphics', 'sky', 'setClock', 'settings', 'inspectView', 'look',
    'closeUp', 'drive', 'placeVehicle', 'hitchRun', 'vehicleAt', 'vehicleById', 'carModels', 'carBadges', 'cabinHeadroom',
    'assetCars', 'vehicleHealth', 'burnVehicle', 'assetChar', 'damageReport', 'launch', 'drivingState', 'wanted', 'viewMode', 'cameraView',
    'drawProfile', 'frameFaults', 'gpuContext', 'approvedAssets', 'driveByAim', 'shootVehicle', 'policeLineup', 'interact']);
const { browser } = await launchBrowser({ label: 'SUV-' + label, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.setDefaultTimeout(300000);
page.on('pageerror', error => report.errors.push(error.stack || error.message));
page.on('console', message => { const value = message.text(); if (message.type() === 'error' || /GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM|WebGL.*(?:error|invalid)/i.test(value)) report.errors.push(value); });
async function call(name, ...args) {
  if (!methods.has(name)) throw Error('Undeclared named method ' + name);
  return page.evaluate(([method, args]) => window.DeadEndCity[method](...args), [name, args]);
}
async function batch(rows) {
  for (const [name] of rows) if (!methods.has(name)) throw Error('Undeclared named method ' + name);
  return page.evaluate(rows => { for (const [name, args] of rows) window.DeadEndCity[name](...args); }, rows);
}
const draw = () => call('hitchRun', 1 / 60, [], 1, false, true);
async function shot(name) {
  await page.screenshot({ path: path.join(out, label + '-' + name + '.png'), clip: { x: 170, y: 90, width: 660, height: 460 }, timeout: 180000 });
  console.log('shot', label, name);
}
const modelAt = async id => (await call('carModels', true)).find(model => model.id === id);
const bodyAt = async id => (await call('carBadges')).find(model => model.id === id)?.body;
async function board(type) {
  await batch([['viewMode', ['street']], ['placeVehicle', [300 - report.cases.length * 80, 4520, 0]], ['look', [680, 4520, 3]],
    ['drive', [type, 0, 0]], ['placeVehicle', [680, 4520, 0]], ['closeUp', [10]], ['inspectView', [65, 18, 8]],
    // Rendering observes the car change and starts the door/entry clock; age it only after that first draw.
    ['hitchRun', [1 / 60, [], 1, false, true]],
    ['hitchRun', [1.2, [], 1, false, false]], ['settings', [{}]]]);
  await page.waitForTimeout(6500); // ordinary radio/HUD notice deadline; no UI alteration
  await batch([['settings', [{}]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
  return call('vehicleAt', 680, 4520);
}
async function boardExplicitSheriff() {
  await batch([['viewMode', ['street']], ['placeVehicle', [220, 4520, 0]], ['look', [680, 4510, 3]]]);
  const selection = (await call('policeLineup', 680, 4520, 0, false, 44, [['police', 'utility', 'sheriff']]))[0];
  await batch([['interact', []], ['placeVehicle', [680, 4520, 0]], ['closeUp', [10]], ['inspectView', [65, 18, 8]],
    ['wanted', [0]], ['hitchRun', [1 / 60, [], 1, false, true]], ['hitchRun', [1.2, [], 1, false, false]], ['settings', [{}]]]);
  await page.waitForTimeout(6500);
  await batch([['settings', [{}]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
  const vehicle = await call('vehicleAt', 680, 4520), badge = (await call('carBadges')).find(car => car.id === selection.id);
  if (vehicle.id !== selection.id || badge?.body !== 'utility' || badge?.livery !== 'sheriff' || badge?.paint !== '#ffffff' || (await call('status')).vehicle !== 'police')
    throw Error('Explicit Sheriff boarding/livery identity failed: ' + JSON.stringify({ selection, vehicle, badge, status: await call('status') }));
  report.explicitSheriff = selection;
  return vehicle;
}
async function checkCivilian(row) {
  const id = row.id;
  row.cabins = (await call('cabinHeadroom')).cars.filter(c => c.type === 'suv');
  if (row.cabins.some(c => c.through.length || c.seatGap > .02)) throw Error('SUV cabin fit failed: ' + JSON.stringify(row.cabins));
  await batch([['driveByAim', [-90, 'raise']], ['hitchRun', [1.2, [], 1, false, false]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
  row.driveBy = (await call('cabinHeadroom')).driveByArm;
  if (row.driveBy.type !== 'suv' || row.driveBy.window !== 'left' || !(row.driveBy.gap < .02)) throw Error('Actual approved SUV drive-by grip did not meet drawn hand: ' + JSON.stringify(row.driveBy));
  await call('driveByAim', null);
  row.glassHits = await call('shootVehicle', id, 'left', 12); await draw();
  row.damage = await call('damageReport', id); row.damagedModel = await modelAt(id);
  if (!Object.values(row.damage.glass).some(value => value > 0)) throw Error('Actual source panes did not receive side shots');
  await batch([['burnVehicle', [id, 0, true]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
  row.repaired = { damage: await call('damageReport', id), model: await modelAt(id) };
  if (row.key === 's1-jimny') {
    await call('vehicleHealth', 80); await draw();
    row.worn = { vehicle: await call('vehicleById', id), model: await modelAt(id) };
    await shot(row.key + '-worn-dirty');
    await batch([['burnVehicle', [id, 0, true]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
  }
}
async function checkFarPool() {
  let vehicle;
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = await board('suv');
    if ((candidate.id >>> 0) % 3 === 0) { vehicle = candidate; break; }
  }
  if (!vehicle) throw Error('Fresh Jimny pool fixture not found');
  const row = report.farPool = { id: vehicle.id, initial: await call('vehicleById', vehicle.id), model: await modelAt(vehicle.id) };
  if (affected) {
    row.optics = { day: await modelAt(vehicle.id) }; await shot('jimny-optics-day-front');
    await call('setClock', 22); await draw(); row.optics.night = await modelAt(vehicle.id);
    row.optics.nightProfile = await call('drawProfile', 3); await shot('jimny-optics-night-front');
    await call('setClock', 13); await draw();
  }
  // Use the known road, a pristine car and the ordinary overhead camera; portrait angles are no longer needed.
  await batch([['viewMode', ['street']], ['inspectView', []], ['look', [420, 4520, 1.1]],
    ['hitchRun', [.8, [], 1, false, false]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
  row.farFirst = { model: (await call('approvedAssets')).models.find(model => model.id === vehicle.id),
    status: await call('status'), camera: await call('cameraView'), vehicle: await call('vehicleById', vehicle.id) };
  if (!row.farFirst.model?.far) throw Error('Fresh GPU fixture did not enter far LOD: ' + JSON.stringify(row.farFirst));
  await batch([['look', [420, 4520, .3]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
  row.pooled = { model: (await call('approvedAssets')).models.find(model => model.id === vehicle.id),
    status: await call('status'), camera: await call('cameraView'), vehicle: await call('vehicleById', vehicle.id) };
  await page.screenshot({ path: path.join(out, label + '-far-pool-context.png'), timeout: 180000 });
  if (!row.pooled.model?.pool?.ready || !(row.pooled.model.pool.instances > 0)) throw Error('Fresh visible SUV did not render through instanced body pool: ' + JSON.stringify(row.pooled));
  console.log('PASS far-pool actual instances', row.pooled.model.pool.instances);
}
try {
  console.log('boot', label);
  await page.goto('file://' + html + '?dev&seed=1&hold&shadercheck', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu');
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  if ((await call('status')).renderer !== '3d') throw Error('Rendered review requires WebGL');
  await page.mouse.move(998, 0);
  await batch([['holdSimulation', [true]], ['god', [true]], ['graphics', ['high']], ['sky', ['clear']], ['setClock', [13]], ['wanted', [0]],
    ['settings', [{ cameraView: 'street', sound: false, gps: false, minimapFolded: true, keyHints: false, playerRing: false, motionBlur: false, lookAhead: 0, radioVolume: 0 }]],
    ['hitchRun', [6, [], 1, false, false]], ['look', [680, 4520, 3]]]);
  console.log('ready', label);
  const seen = new Set();
  const portraitStyles = refreshCivilians ? 2 : 3;
  for (let attempt = 0; (!affected || refreshCivilians) && attempt < 12 && seen.size < portraitStyles; attempt++) {
    const vehicle = await board('suv'), key = ['s1-jimny', 's2-suv', 's3-offroad'][(vehicle.id >>> 0) % 3];
    if (refreshCivilians && key === 's3-offroad') continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const model = await modelAt(vehicle.id);
    if (!model?.draws) throw Error('SUV missing rendered model');
    if (after && !['Suzuki Jimny 2023', 'Generic SUV', 'Generic Offroad'].includes(model.asset)) throw Error('Approved SUV did not replace old body: ' + JSON.stringify(model));
    const row = { key, id: vehicle.id, model, vehicle, camera: await call('cameraView') };
    if (!report.cases.length) await page.screenshot({ path: path.join(out, label + '-context.png'), timeout: 180000 });
    await shot(key + '-front');
    await call('inspectView', 245, 18, 8); await draw(); await shot(key + '-rear');
    row.cabins = (await call('cabinHeadroom')).cars.filter(c => c.key === key.replaceAll('-', '_') || c.type === 'suv');
    if (after && row.cabins.some(c => c.through.length || c.seatGap > .02)) throw Error('SUV cabin/drive-by fit failed: ' + JSON.stringify(row.cabins));
    report.cases.push(row);
    fs.writeFileSync(path.join(out, label + '-suv-review.json'), JSON.stringify(report, null, 2));
  }
  if ((!affected || refreshCivilians) && seen.size !== portraitStyles) throw Error('Did not expose requested stable SUV IDs');
  let sheriff = affected ? await boardExplicitSheriff() : null;
  for (let attempt = 0; !affected && attempt < 12; attempt++) {
    const vehicle = await board('police');
    if (await bodyAt(vehicle.id) === 'utility') { sheriff = vehicle; break; }
  }
  if (!sheriff) throw Error('County utility patrol fixture not found');
  const policeRow = { key: 'sheriff', id: sheriff.id, model: await modelAt(sheriff.id), vehicle: sheriff, camera: await call('cameraView'), badge: (await call('carBadges')).find(car => car.id === sheriff.id) };
  if (after && policeRow.model?.asset !== 'Generic SUV') throw Error('Sheriff patrol did not receive full-size approved body');
  if (!repairOnly) await shot('sheriff-front');
  await call('inspectView', 245, 18, 8); await draw(); await shot('sheriff-rear');
  report.cases.push(policeRow);
  if (after && !portraitsOnly) {
    // Capture every untouched body first, then test freshly boarded examples of the same source models.
    // This keeps particles from earlier pane shots out of later comparison portraits.
    report.civilianChecks = [];
    const checked = new Set();
    for (let attempt = 0; !affected && attempt < 12 && checked.size < 3; attempt++) {
      const vehicle = await board('suv'), key = ['s1-jimny', 's2-suv', 's3-offroad'][(vehicle.id >>> 0) % 3];
      if (checked.has(key)) continue;
      checked.add(key);
      const row = { key, id: vehicle.id, model: await modelAt(vehicle.id), vehicle };
      report.civilianChecks.push(row); await checkCivilian(row);
      fs.writeFileSync(path.join(out, label + '-suv-review.json'), JSON.stringify(report, null, 2));
    }
    if (!affected && checked.size !== 3) throw Error('Did not test all three stable SUV styles');
    if (!affected) {
      sheriff = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = await board('police');
        if (await bodyAt(candidate.id) === 'utility') { sheriff = candidate; break; }
      }
    }
    if (!sheriff) throw Error('Fresh county utility test fixture not found');
    policeRow.testId = sheriff.id; policeRow.testModel = await modelAt(sheriff.id);
    if (!repairOnly) {
      await call('launch', 6); await call('hitchRun', .125, ['KeyD'], 1, false, true);
      policeRow.moving = { vehicle: await call('vehicleById', sheriff.id), state: await call('drivingState') };
      await shot('sheriff-moving');
    }
    await batch([['placeVehicle', [680, 4520, 0]], ['burnVehicle', [sheriff.id, 20]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
    policeRow.burnt = (await call('assetChar')).models.find(model => model.id === sheriff.id);
    if (!policeRow.burnt?.materials.includes('approved')) throw Error('Approved sheriff paint/trim did not enter actual char program');
    await shot('sheriff-burnt');
    await batch([['burnVehicle', [sheriff.id, 0, true]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
    policeRow.repaired = { damage: await call('damageReport', sheriff.id), model: await modelAt(sheriff.id) };
    if (policeRow.repaired.damage.burnt || !(policeRow.repaired.model.draws > 0)) throw Error('Approved SUV failed repair');
    await shot('sheriff-repaired');
    if (!repairOnly) {
      report.presets = [];
      for (const view of ['street', 'chase']) {
      await call('viewMode', view);
      for (const tier of ['low', 'medium', 'high', 'ultra', 'auto']) {
        await call('graphics', tier); await draw();
        await page.waitForFunction(() => { const report = window.DeadEndCity.approvedAssets(), expected = report.reducedTextures ? 2048 : 4096; return report.atlasSizes.length === 2 && report.atlasSizes.every(([width, height]) => width === expected && height === expected); }, null, { timeout: 120000 });
        const assets = await call('approvedAssets'), quality = await call('graphics'), profile = await call('drawProfile', 3);
        if (quality.setting !== tier || !(profile.triangles > 0) || ['low', 'medium'].includes(tier) && !assets.reducedTextures || ['high', 'ultra'].includes(tier) && assets.reducedTextures) throw Error('Preset failed ' + tier + '/' + view);
        report.presets.push({ view, tier, quality, profile, assets });
        fs.writeFileSync(path.join(out, label + '-suv-review.json'), JSON.stringify(report, null, 2));
        console.log('PASS preset', view, tier);
      }
    }
      await call('graphics', 'high'); await draw(); await page.screenshot({ path: path.join(out, label + '-sheriff-chase-context.png'), timeout: 180000 });
      await checkFarPool();
    }
  }
  report.assetCars = await call('assetCars'); report.cabins = await call('cabinHeadroom');
  report.frameFaults = await call('frameFaults'); report.gpu = await call('gpuContext');
  if (report.errors.length || report.frameFaults.count || report.gpu.losses) throw Error('Renderer errors/faults/losses: ' + JSON.stringify(report.errors));
  console.log('PASS native SUV rendered review', label);
} catch (error) {
  report.failure = error.stack || error.message; console.error(report.failure); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, label + '-suv-review.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
