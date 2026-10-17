// Matched native M4 wheel/base captures and rendered pristine/shot/under-fire CPU profiles.
// node tools/m4-utility-render-review.mjs HTML OUT before|after [--quality high|low]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

const [input, directory, label] = process.argv.slice(2), qualityAt = process.argv.indexOf('--quality'),
  quality = qualityAt < 0 ? 'high' : process.argv[qualityAt + 1];
if (!input || !directory || !['before', 'after'].includes(label) || !['low', 'medium', 'high', 'ultra'].includes(quality))
  throw Error('HTML, OUT, before|after and optional --quality low|medium|high|ultra required');
const html = path.resolve(input), out = path.resolve(directory), hash = b => crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out, { recursive: true });
const report = { label, htmlSha256: hash(fs.readFileSync(html)), recorderSha256: hash(fs.readFileSync(new URL(import.meta.url))),
  fixture: { viewport: [1000, 700], seed: 1, quality, clock: 13, weather: 'clear', held: true,
    outside: [1400, 900], baseStage: 'fortCoverTest(jeep)', shotSide: 'left', shotRounds: 12,
    measuredFrames: 2, warmFrames: 1, note: 'Thin rendered attribution; repeatable host mark-ray probes measure throughput.' },
  inputs: [], stages: [], captures: [], errors: [], warnings: [] },
  named = new Set(['status', 'holdSimulation', 'god', 'graphics', 'sky', 'setClock', 'wanted', 'settings', 'teleport', 'drive',
    'viewMode', 'closeUp', 'inspectView', 'hitchRun', 'vehicleAt', 'vehicleById', 'carModels', 'frameFaults', 'gpuContext',
    'cameraView', 'drawProfile', 'stats', 'fortCoverTest', 'interact', 'military', 'shootVehicle', 'vehicleDamageShape']);
const save = () => fs.writeFileSync(path.join(out, 'capture-' + label + '.json'), JSON.stringify(report, null, 2) + '\n');
const { browser } = await launchBrowser({ label: 'm4-utility-review-' + label, args: ['--autoplay-policy=no-user-gesture-required'] }),
  page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.setDefaultTimeout(480000);
page.on('console', m => {
  if (m.type() === 'error' || /GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(m.text())) report.errors.push(m.text());
  else if (m.type() === 'warning') report.warnings.push(m.text());
});
page.on('pageerror', e => report.errors.push(e.stack || e.message));
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable', { timeDomain: 'threadTicks' });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
async function calls(actions) {
  for (const [method, args] of actions) {
    if (!named.has(method)) throw Error('Undeclared method ' + method);
    report.inputs.push([method, args]);
  }
  return page.evaluate(actions => actions.map(([method, args]) => window.DeadEndCity[method](...args)), actions);
}
async function call(method, ...args) { return (await calls([[method, args]]))[0]; }
async function cpuTime() {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find(m => m.name === 'ThreadTime')?.value || 0;
}
function profileSummary(profile) {
  const sums = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  for (let i = 0; i < (profile.samples || []).length; i++) {
    const frame = byId.get(profile.samples[i]).callFrame, key = frame.functionName + ':' + (frame.lineNumber + 1);
    sums.set(key, (sums.get(key) || 0) + (profile.timeDeltas[i] || 0));
  }
  return [...sums].sort((a, b) => b[1] - a[1]).slice(0, 35).map(([name, us]) => [name, +(us / 1000).toFixed(3)]);
}
async function state(extra = []) {
  const actions = ['status', 'cameraView', 'frameFaults', 'gpuContext', 'stats', 'military'].map(m => [m, []]).concat(extra),
    values = await calls(actions);
  return Object.fromEntries(actions.map(([m], i) => [m, values[i]]));
}
async function sample(name, warm = true) {
  console.log('Sampling', name);
  await calls((warm ? [['hitchRun', [1 / 60, [], 1, false, true]]] : []).concat([['stats', []]]));
  const before = await cpuTime();
  await cdp.send('Profiler.start');
  const trace = await call('hitchRun', 2 / 60, [], 12, false, true),
    profile = (await cdp.send('Profiler.stop')).profile, cpuMs = ((await cpuTime()) - before) * 1000,
    details = await state([['drawProfile', [15]], ['carModels', [true]]]),
    file = 'm4-utility-' + label + '-' + name + '.cpuprofile';
  fs.writeFileSync(path.join(out, file), JSON.stringify(profile));
  const row = { name, cpuMs: +cpuMs.toFixed(3), trace, profile: profileSummary(profile), profileFile: file, ...details };
  report.stages.push(row); save();
  console.log(JSON.stringify({ name, cpuMs: row.cpuMs, sections: trace.sections,
    drawCalls: details.stats.drawCalls, triangles: details.stats.triangles, profile: row.profile.slice(0, 8) }));
}
async function shot(name, facts = {}) {
  await call('settings', {});
  await page.mouse.move(998, 0);
  await page.waitForTimeout(4500);
  const details = await state([['settings', [{}]], ...(facts.id ? [['vehicleById', [facts.id]]] : [])]);
  if (details.status.renderer !== '3d' || details.frameFaults.count || details.gpuContext.lost || report.errors.length)
    throw Error('Invalid rendered state ' + name);
  const file = 'm4-utility-' + label + '-' + name + '.png';
  await page.screenshot({ path: path.join(out, file), timeout: 480000 });
  report.captures.push({ file, sha256: hash(fs.readFileSync(path.join(out, file))), ...facts, ...details }); save();
  console.log('Captured', file);
}
try {
  console.log('Opening', label);
  await page.goto('file://' + html + '?dev&seed=1&hold&shadercheck', { waitUntil: 'domcontentloaded', timeout: 480000 });
  await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu');
  // At normal desktop size the title radio stays beside the menu. A parked pointer
  // also avoids opening the shared radio panel over the start/decline buttons.
  await page.mouse.move(998, 0);
  console.log('Menu ready');
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  console.log('Play ready');
  await calls([['holdSimulation', [true]], ['god', [true]], ['graphics', [quality]], ['sky', ['clear']], ['setClock', [13]],
    ['settings', [{ sound: false, fps: false, gps: false, minimapFolded: true, radioVolume: 0 }]], ['teleport', [1400, 900]]]);
  await sample('outside-foot');
  await call('drive', 'jeep', 0, 0); await sample('outside-pristine');
  let status = await call('status');
  const jeep = await call('vehicleAt', status.x, status.y);
  if (jeep?.type !== 'jeep') throw Error('Wrong outside vehicle ' + JSON.stringify(jeep));
  await calls([['viewMode', ['street']], ['closeUp', [11]], ['inspectView', [0, 8, 3]], ['hitchRun', [1.3, [], 1, false, false]], ['hitchRun', [1 / 60, [], 1, false, true]]]);
  await shot('wheel', { id: jeep.id, inspection: [0, 8, 3], closeUp: 11 });
  await calls([['inspectView', []], ['closeUp', [3]], ['shootVehicle', [jeep.id, 'left', 12]]]);
  await sample('outside-new-holes', false); await sample('outside-cached-holes');
  await calls([['fortCoverTest', ['jeep']], ['viewMode', ['street']], ['closeUp', [3]]]);
  await sample('base-foot');
  await calls([['interact', []], ['hitchRun', [1.3, [], 1, false, false]]]);
  status = await call('status');
  if (status.vehicle?.type !== 'jeep' && status.car?.type !== 'jeep' && status.vehicle !== 'jeep' && status.car !== 'jeep')
    console.log('Boarded status', JSON.stringify(status));
  await sample('base-board');
  await call('hitchRun', 4, [], 1, false, false); await sample('base-under-fire', false);
  await shot('base');
  report.pass = report.errors.length === 0; save(); console.log('Complete', label);
} catch (error) {
  report.pass = false; report.failure = error.stack || String(error); save(); console.error(report.failure); process.exitCode = 1;
} finally { await browser.close(); }
