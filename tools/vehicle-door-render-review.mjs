// Native frozen-build door/cabin review. Named developer actions only; no mutable-object/eval hook.
// Usage: source /workspace/setup/GTA-env.sh; node tools/vehicle-door-render-review.mjs HTML OUT LABEL [--after]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

const html = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), label = process.argv[4], after = process.argv.includes('--after');
if (!label || !fs.existsSync(html)) throw Error('Frozen HTML, output directory and label required');
fs.mkdirSync(out, { recursive: true });
const report = { htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),
  recorderSha256: crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'), label, after,
  fixture: { seed: 1, origin: [418, 6000], staging: { x: 418, firstY: 6200, stepY: 80 }, heading: 0, clock: 13, graphics: 'high', viewport: [960, 600], crop: [150, 70, 660, 460],
    frontInspect: [65, 12, 4], doorInspect: [115, 7, 5], passengerInspect: [65, 7, 5], closeUp: 11, playerTransitionSeconds: .22,
    input: 'Named drive/place, carjack doorSwing, and actual interact boarding/exit; first rendered frame starts transition before aging.' }, captures: [], errors: [] },
  names = new Set(['status', 'holdSimulation', 'god', 'graphics', 'sky', 'setClock', 'wanted', 'settings', 'look', 'drive', 'placeVehicle', 'vehicleAt',
    'carModels', 'vehicleDoors', 'doorSwing', 'viewMode', 'inspectView', 'closeUp', 'chaseLook', 'cameraView', 'hitchRun', 'interact', 'drawProfile', 'frameFaults', 'gpuContext', 'sportsAssets', 'approvedAssets', 'cabinHeadroom', 'vehicleHealth', 'burnVehicle', 'damageReport', 'assetChar', 'vehicleById']);
const { browser } = await launchBrowser({ label: 'vehicle-doors-' + label, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.setDefaultTimeout(540000);
page.on('pageerror', error => report.errors.push(error.stack || error.message));
page.on('console', message => { if (message.type() === 'error' || /GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM|WebGL.*(?:invalid|error)/i.test(message.text())) report.errors.push(message.text()); });
async function call(method, ...args) {
  if (!names.has(method)) throw Error('Undeclared named action ' + method);
  return page.evaluate(([method, args]) => typeof window.DeadEndCity[method] === 'function' ? window.DeadEndCity[method](...args) : null, [method, args]);
}
async function batch(rows) {
  for (const [method] of rows) if (!names.has(method)) throw Error('Undeclared named action ' + method);
  return page.evaluate(rows => rows.map(([method, args]) => typeof window.DeadEndCity[method] === 'function' ? window.DeadEndCity[method](...args) : null), rows);
}
const drawAction = () => ['hitchRun', [1 / 60, [], 1, false, true]],
  ageAction = (seconds, render = false) => ['hitchRun', [seconds, [], 1, false, render]],
  closeActions = vehicle => [['doorSwing', [vehicle.id, false]], ageAction(1.3), drawAction()];
async function snapshot(id) {
  // Fixed named reports in one roundtrip; no renderer objects or private state.
  return page.evaluate(id => {
    const api = window.DeadEndCity;
    return { status: api.status(), camera: api.cameraView(), model: api.carModels(true).find(model => model.id === id),
      doors: api.vehicleDoors?.(id) || null, sportsAssets: api.sportsAssets?.() || null, headroom: api.cabinHeadroom(),
      vehicleIdentity: api.vehicleById(id), damage: api.damageReport(id), char: api.assetChar()?.models.find(model => model.id === id) || null };
  }, id);
}
async function capture(name, id) {
  const row = { name, id, ...await snapshot(id) };
  if (row.vehicleIdentity?.id !== id || row.vehicleIdentity.type !== row.model?.type || row.vehicleIdentity.x !== 418 || row.vehicleIdentity.y !== 6000 || Math.abs(row.vehicleIdentity.a) > .001)
    throw Error('Native photo vehicle identity/coordinates changed: ' + JSON.stringify({ name, id, vehicleIdentity: row.vehicleIdentity }));
  await page.screenshot({ path: path.join(out, label + '-' + name + '.png'), clip: { x: 150, y: 70, width: 660, height: 460 }, timeout: 540000 });
  report.captures.push(row); fs.writeFileSync(path.join(out, label + '-door-review.json'), JSON.stringify(report, null, 2));
  console.log('shot', name);
  return row;
}
let staged = 0;
async function board(type, jimny = false) {
  for (let attempt = 0; attempt < (jimny ? 6 : 1); attempt++) {
    // look() teleports the player and exits their car. Stage the camera first,
    // then board so the photographs show the actual seated driver.
    const result = await page.evaluate(([type, oldY]) => {
      const api = window.DeadEndCity, moved = !!api.status().vehicle;
      if (moved) api.placeVehicle(418, oldY, 0);
      api.look(418, 6000, 3); api.drive(type, 0, 0); api.placeVehicle(418, 6000, 0);
      return { moved, vehicle: api.vehicleAt(418, 6000), status: api.status() };
    }, [type, 6200 + staged * 80]);
    if (result.moved) staged++;
    const vehicle = result.vehicle;
    if (!vehicle || vehicle.type !== type || vehicle.x !== 418 || vehicle.y !== 6000 || result.status.vehicle !== type)
      throw Error('Open-runway fixture vehicle identity/placement failed: ' + JSON.stringify(result));
    if (jimny && (vehicle.id >>> 0) % 3 !== 0) continue; // no rendered spawn loops
    await batch([['viewMode', ['street']], ['closeUp', [11]], ['inspectView', [65, 12, 4]], drawAction(), ageAction(1.3), drawAction()]);
    if (await page.locator('#callDecline').isVisible()) await page.locator('#callDecline').click();
    // Let normal vehicle/call notifications finish through the real HUD clock.
    const settled = await batch([ageAction(8), drawAction(), ['status', []]]);
    if (settled.at(-1).vehicle !== type) throw Error('Fixture player did not stay aboard ' + type);
    return vehicle;
  }
  throw Error('Stable Jimny fixture not found');
}
async function openLeft(vehicle, prefix) {
  await batch([['viewMode', ['street']], ['closeUp', [11]], ['inspectView', [115, 7, 5]], ['doorSwing', [vehicle.id, true, -1]], drawAction(), drawAction()]);
  const row = await capture(prefix + '-door-left', vehicle.id), door = row.doors?.cars?.[0];
  if (after && (!door || !(door.mask & 1) || door.doors['-1']?.apertureHasCentrePanel)) throw Error(prefix + ': actual left aperture report invalid');
}
async function close(vehicle) { await batch(closeActions(vehicle)); }
try {
  console.log('boot', label);
  await page.goto('file://' + html + '?dev&seed=1&hold&shadercheck', { waitUntil: 'domcontentloaded', timeout: 540000 });
  await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu'); await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  if ((await call('status')).renderer !== '3d') throw Error('Actual WebGL renderer required');
  await batch([['holdSimulation', [true]], ['god', [true]], ['graphics', ['high']], ['sky', ['clear']], ['setClock', [13]], ['wanted', [0]],
    ['settings', [{ cameraView: 'street', sound: false, gps: false, minimapFolded: true, keyHints: false, playerRing: false, motionBlur: false, lookAhead: 0, radioVolume: 0 }]]]);
  await page.mouse.move(958, 0); console.log('ready', label);
  const car = await board('chevette');
  await capture('chevette-closed-front', car.id);
  await batch([['inspectView', []], ['viewMode', ['chase']], drawAction(), ['chaseLook', [0, 0, 70, 15]], drawAction()]);
  await capture('chevette-closed-chase', car.id);
  await openLeft(car, 'chevette'); await close(car);
  if (after) {
    await batch([['inspectView', [65, 7, 5]], ['doorSwing', [car.id, true, 1]], drawAction(), drawAction()]);
    const right = await capture('chevette-door-right', car.id), facts = right.doors?.cars?.[0];
    if (!(facts?.mask & 2) || !facts.doors['1']?.native) throw Error('C8 native passenger door did not open');
    await close(car);
  } else report.passengerBefore = 'Original named doorSwing has no side selector; no unsupported right-door before image is fabricated.';
  await batch([['inspectView', [115, 7, 5]], ['interact', []], drawAction(), ageAction(.22, true)]);
  const exit = await capture('chevette-player-exit', car.id);
  if (exit.status.vehicle) throw Error('Actual player exit did not leave the car');
  await batch([ageAction(1.3), drawAction(), ['interact', []], drawAction(), ageAction(.22, true)]);
  const enter = await capture('chevette-player-entry', car.id);
  if (enter.status.vehicle !== 'chevette') throw Error('Actual player entry did not board the car');
  await batch([ageAction(1.3), drawAction()]);
  if (after) {
    report.presets = [];
    const cleared = await page.evaluate(() => {
      const api = window.DeadEndCity, inspect = api.inspectView();
      api.closeUp(api.cameraView().defaultZoom); return inspect;
    });
    if (cleared !== null) throw Error('Inspection camera did not clear before preset checks');
    for (const view of ['street', 'chase']) {
      await call('viewMode', view);
      for (const tier of ['low', 'medium', 'high', 'ultra', 'auto']) {
        await batch([['graphics', [tier]], drawAction()]);
        await page.waitForFunction(() => {
          const sports = window.DeadEndCity.sportsAssets(), approved = window.DeadEndCity.approvedAssets();
          return [[sports, 3], [approved, 2]].every(([assets, length]) => assets.atlasSizes.length === length && assets.atlasSizes.every(([w, h]) => w === (assets.reducedTextures ? 2048 : 4096) && h === w));
        }, null, { timeout: 180000 });
        const row = { view, tier, ...await page.evaluate(() => {
          const api = window.DeadEndCity;
          return { status: api.status(), actualView: api.viewMode(), quality: api.graphics(), camera: api.cameraView(), sportsAssets: api.sportsAssets(),
            approvedAssets: api.approvedAssets(), headroom: api.cabinHeadroom(), profile: api.drawProfile(3) };
        }) };
        if (row.status.renderer !== '3d' || row.actualView.mode !== view || view === 'chase' && !row.actualView.ready || row.quality.setting !== tier || !(row.profile.triangles > 0) || ['low', 'medium'].includes(tier) && !row.sportsAssets.reducedTextures || ['high', 'ultra'].includes(tier) && row.sportsAssets.reducedTextures)
          throw Error('C8 quality/camera case failed ' + view + '/' + tier);
        const fitted = row.headroom?.cars?.filter(car => car.type === 'chevette') || [];
        if (!fitted.length || fitted.some(car => car.through?.length || car.seatGap > .02)) throw Error('Actual C8 occupant intersects the cabin or headroom coverage is missing in ' + view + '/' + tier);
        report.presets.push(row); fs.writeFileSync(path.join(out, label + '-door-review.json'), JSON.stringify(report, null, 2));
        console.log('PASS preset', view, tier);
      }
    }
    await batch([['graphics', ['high']], drawAction(), ['viewMode', ['street']], ['closeUp', [11]], ['inspectView', [115, 7, 5]]]);
    const lifecycle = report.lifecycle = { id: car.id, clean: await snapshot(car.id) };
    await batch([['setClock', [22]], ['doorSwing', [car.id, true, -1]], drawAction(), drawAction()]);
    lifecycle.night = await capture('chevette-night-cabin', car.id);
    const worn = await batch([...closeActions(car), ['setClock', [13]], ['vehicleHealth', [80]], drawAction()]);
    lifecycle.worn = { health: worn.at(-2), ...await snapshot(car.id) };
    if (!(lifecycle.worn.health?.percent < 100 && lifecycle.worn.health.hp > 0)) throw Error('Actual C8 wear path was not exercised');
    await batch([['doorSwing', [car.id, true, -1]], drawAction(), ['burnVehicle', [car.id, 20]], drawAction()]);
    const burnt = await capture('chevette-burnt-door', car.id);
    lifecycle.burnt = { damage: burnt.damage, char: burnt.char, capture: burnt };
    if (!lifecycle.burnt.damage.burnt || !lifecycle.burnt.char?.materials.includes('approved')) throw Error('C8 source PBR/char shader path not drawn');
    await batch([['burnVehicle', [car.id, 0, true]], ...closeActions(car), drawAction()]);
    const repaired = await capture('chevette-repaired-body', car.id);
    lifecycle.repaired = { damage: repaired.damage, char: repaired.char, capture: repaired };
    const restored = lifecycle.repaired.capture, clean = lifecycle.clean;
    if (lifecycle.repaired.damage.hp !== lifecycle.repaired.damage.maxhp || lifecycle.repaired.damage.burnt || lifecycle.repaired.char || restored.doors.cars[0].mask ||
        JSON.stringify(restored.model.panes) !== JSON.stringify(clean.model.panes)) throw Error('C8 repair failed to restore intact body/source panes');
    const initialMaterials = clean.doors.cars[0].materials, finalMaterials = restored.doors.cars[0].materials;
    if (!initialMaterials || JSON.stringify(initialMaterials) !== JSON.stringify(finalMaterials) || !restored.doors.cars[0].sourceGeometryRestored || Object.values(restored.doors.cars[0].sourceGeometryRestored).some(value => !value))
      throw Error('C8 repair failed to restore actual source material/map/geometry references');
    console.log('PASS actual C8 night/wear/burn/source repair');
  }
  const jimny = await board('suv', true); await openLeft(jimny, 'jimny'); await close(jimny);
  const sedan = await board('sedan'); await openLeft(sedan, 'sedan'); await close(sedan);
  Object.assign(report, await page.evaluate(() => ({ profile: window.DeadEndCity.drawProfile(3), frameFaults: window.DeadEndCity.frameFaults(), gpu: window.DeadEndCity.gpuContext() })));
  if (report.errors.length || report.frameFaults?.count || report.gpu?.losses) throw Error('Renderer fault: ' + JSON.stringify(report.errors));
  console.log('PASS native door review', label);
} catch (error) { report.failure = error.stack || error.message; console.error(report.failure); process.exitCode = 1; }
finally { fs.writeFileSync(path.join(out, label + '-door-review.json'), JSON.stringify(report, null, 2)); await browser.close(); }
