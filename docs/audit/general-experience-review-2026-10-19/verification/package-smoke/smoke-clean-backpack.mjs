// Rendered smoke: boots, checks the default FPS counter, starts and moves on foot,
// drives a known vehicle with real keys, opens the map and switches both cameras.
// Saves six screenshots, console.log and smoke.json; fails if a claimed action did not happen.
//   node tools/smoke.mjs [dead-end-city.html] [outdir] [--size 960x600]
// Slow software GL: DEC_SMOKE_BOOT_TIMEOUT_MS / DEC_SMOKE_MOVE_TIMEOUT_MS allow more wall time with the same assertions.
import { pathToFileURL } from 'node:url';
const { launchBrowser } = await import(pathToFileURL(process.cwd() + '/tools/browser.mjs'));
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

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
const bootTimeout = Number(process.env.DEC_SMOKE_BOOT_TIMEOUT_MS || 300000);
if (![moveTimeout, bootTimeout].every(value => Number.isFinite(value) && value >= 1000)) {
  await browser.close();
  throw new Error('Smoke timeout settings must be finite numbers of at least 1000');
}
page.setDefaultTimeout(bootTimeout);
const errors = [];
const warnings = [];
const logs = [];
const checks = { viewport: [+size[1], +size[2]], moveTimeout, bootTimeout };
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const htmlSha256 = sha256(file);
const captures = [];
page.on('console', (m) => { const t = m.type(); const s = `[${t}] ${m.text()}`; logs.push(s); if (t === 'error') errors.push(s); else if (t === 'warning') warnings.push(s); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
const state = () => page.evaluate(() => window.DeadEndCity.status());
const shot = async name => {
  const filename = name + '.png';
  await page.screenshot({ path: path.join(out, filename), timeout: 180000 });
  captures.push({ file: filename, sha256: sha256(path.join(out, filename)), viewport: checks.viewport });
};
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
  await page.goto('file://' + file, { timeout: bootTimeout, waitUntil: 'load' });
  await page.waitForFunction(() => !!window.DeadEndCity, null, { timeout: bootTimeout });
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

  if (process.argv.includes('--credits')) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.DeadEndCity.status().mode === 'pause');
    await page.click('#creditsBtn');
    await page.locator('.credits-sources summary').click();
    const text = await page.locator('#fullAssetCredits').innerText();
    checks.credits = {
      visible: await page.locator('#fullAssetCredits').isVisible(),
      hotrod: text.includes('cb5b519024c7472895ef10a8663fb533'),
      citation: text.includes('a78839624fe64900a8352cb23462350a'),
      transport: text.includes('73d0cd0c03594c5d9c53235d74b429bf'),
      svj: text.includes('784e4656aca649cca55d6b18740a19b2'),
      textCharacters: text.length,
    };
    assert(checks.credits.visible && checks.credits.hotrod && checks.credits.citation && checks.credits.transport && checks.credits.svj, 'Full downloaded-model attributions are not readable in Credits');
    if (process.argv.includes('--monarch')) {
      const sources = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tools/monarch_vehicle_sources.json'))).models;
      checks.credits.monarch = sources.map(model => ({ source: model.key, readable: text.includes(model.sourceUrl) }));
      assert(checks.credits.monarch.length === 10 && checks.credits.monarch.every(model => model.readable), 'Every Monarch source attribution must be readable in Credits');
    }
    await shot('07-credits');
    await page.click('#closeCredits');
    if ((await state()).mode !== 'play') await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  }

  // Additional staged visual fixture after every unchanged standard smoke assertion.
  // It proves the package on the final split artifact and lets dialogue expire before the beauty capture.
  checks.standardSmokeRecorderSha256 = 'eb48a91db5f74a484aff54647e8464fb06680131eba64019674ed3954370ee92';
  const visualInputs = [
    ['holdSimulation',[true]], ['god',[true]], ['teleport',[748,584]],
    ['storyProgress',[2,true]], ['startMission',[2]], ['summitSkip',['summit']],
    ['setClock',[14]], ['sky',['clear']], ['wetness',[0]],
    ['settings',[{sound:false,fps:false}]], ['graphics',['high']],
    ['hitchRun',[9,['KeyE'],3,false,false]], ['hitchRun',[12,[],3,false,false]],
    ['walk',[210*Math.PI/180,0]], ['viewMode',['street']],
    ['closeUp',[14]], ['inspectView',[60,18,8]], ['hitchRun',[1/60,[],3,false,true]],
  ];
  checks.backpackVisual = {category:'staged inspection fixture; not an ordinary mission win', inputs:visualInputs};
  await page.evaluate(rows => { for(const [method,args] of rows) window.DeadEndCity[method](...args); }, visualInputs);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  checks.backpackVisual.state = await page.evaluate(() => ({status:DeadEndCity.status(), quality:DeadEndCity.graphics(), job:DeadEndCity.summitJob(), card:DeadEndCity.missionCard(), gpu:DeadEndCity.gpuContext(), faults:DeadEndCity.frameFaults(), overlaps:DeadEndCity.hudOverlaps()}));
  const pack = checks.backpackVisual.state;
  assert(pack.job.carrier==='backpack' && pack.status.renderer==='3d', 'Final package backpack visual setup failed');
  assert(!pack.card.line && !pack.gpu.lost && !pack.gpu.losses && !pack.faults.count, 'Backpack capture must clear dialogue and retain healthy renderer');
  await shot('08-backpack-clean-high');

  const gateInputs = [
    ['storyProgress',[3,true]], ['fortSkip',['changed']], ['teleport',[9236,8182]],
    ['setClock',[14]], ['sky',['clear']], ['viewMode',['chase']],
    ['inspectView',[]], ['chaseLook',[0,0,0,6]], ['hitchRun',[.6,[],3,false,true]],
  ];
  checks.gateVisual = {category:'staged changed-uniform inspection fixture; not an ordinary mission win', inputs:gateInputs};
  await page.evaluate(rows => { for (const [method,args] of rows) window.DeadEndCity[method](...args); }, gateInputs);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  checks.gateVisual.state = await page.evaluate(() => ({status:DeadEndCity.status(), quality:DeadEndCity.graphics(), job:DeadEndCity.fortJob(), card:DeadEndCity.missionCard(), gpu:DeadEndCity.gpuContext(), faults:DeadEndCity.frameFaults(), overlaps:DeadEndCity.hudOverlaps(), prompt:DeadEndCity.promptState(), camera:DeadEndCity.chaseCamera(), dom:Object.fromEntries(['storyLine','quickKeys','minimapBox','hudLocation','navigation','interaction'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return [id,{text:e.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},opacity:getComputedStyle(e).opacity}];}))}));
  const gate = checks.gateVisual.state;
  assert(gate.status.renderer==='3d' && gate.camera.mode==='chase' && !gate.gpu.lost && !gate.gpu.losses && !gate.faults.count, 'Final chase checkpoint renderer unhealthy');
  assert(gate.dom.storyLine.text.includes('Sir, ID, please.') && !gate.dom.storyLine.text.includes('Evening'), 'Gate greeting should suit daytime');
  assert(!gate.overlaps.overlaps.some(p=>p.includes('storyLine') || (p.includes('hudLocation')&&p.includes('navigation'))), 'Final checkpoint HUD overlaps: '+JSON.stringify(gate.overlaps.overlaps));
  await shot('09-checkpoint-chase-high');

  checks.browser = await page.evaluate(() => ({
    ua: navigator.userAgent,
    badge: document.getElementById('renderBadge')?.textContent,
    district: document.getElementById('district')?.textContent,
  }));
} catch (e) {
  errors.push('[smoke] ' + e.message);
} finally {
  fs.writeFileSync(path.join(out, 'console.log'), logs.join('\n'));
  fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify({ file, htmlSha256,
    recorderSha256: sha256(new URL(import.meta.url)), captures, checks, errors, warnings }, null, 2) + '\n');
  console.log(JSON.stringify(checks, null, 2));
  console.log(`console lines: ${logs.length}, errors: ${errors.length}, warnings: ${warnings.length}`);
  for (const e of errors.slice(0, 40)) console.log(e);
  for (const w of warnings.slice(0, 10)) console.log(w);
  await browser.close();
}
process.exitCode = errors.length ? 1 : 0;
