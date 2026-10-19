// Rendered smoke: boots, checks the default FPS counter, starts and moves on foot,
// drives a known vehicle with real keys, opens the map and switches both cameras.
// Saves six screenshots, console.log and smoke.json; fails if a claimed action did not happen.
//   node tools/smoke.mjs [dead-end-city.html] [outdir] [--size 960x600]
// Slow software GL: DEC_SMOKE_BOOT_TIMEOUT_MS / DEC_SMOKE_MOVE_TIMEOUT_MS allow more wall time with the same assertions.
import { launchBrowser } from '../../tools/browser.mjs';
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
  await page.screenshot({ path: path.join(out, filename), timeout: 600000 });
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


  // Targeted Fort Sentinel follow-up after every standard smoke assertion.
  // Staged admission only; keyboard movement, suspicion and recovery use production input/physics.
  checks.standardSmokeRecorderSha256 = 'eb48a91db5f74a484aff54647e8464fb06680131eba64019674ed3954370ee92';
  checks.fortSuspicion = {category:'staged cleared disguise followed by actual physical keys; not a mission win',inputs:[]};
  const fort = checks.fortSuspicion;
  const named = async (method,...args) => {
    fort.inputs.push([method,args]);
    return page.evaluate(([method,args])=>window.DeadEndCity[method](...args),[method,args]);
  };
  const keyDown = async key => {fort.inputs.push(['physical key down',[key]]);await page.keyboard.down(key);};
  const keyUp = async key => {fort.inputs.push(['physical key up',[key]]);await page.keyboard.up(key);};
  const tick = seconds => named('hitchRun',seconds,[],3,false,false);
  const readFort = () => page.evaluate(()=>({status:DeadEndCity.status(),cover:DeadEndCity.fortCover(),military:DeadEndCity.military(),quality:DeadEndCity.graphics(),camera:DeadEndCity.chaseCamera(),gpu:DeadEndCity.gpuContext(),faults:DeadEndCity.frameFaults(),hud:DeadEndCity.hudOverlaps(),dom:Object.fromEntries(['stealthStatus','stealthLabel','stealthHint','stealthFill'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return[id,{text:e.textContent,width:e.style.width,display:s.display,opacity:s.opacity,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}]}))}));
  for(const[method,args]of [['holdSimulation',[true]],['god',[true]],['storyProgress',[3,true]],['fortSkip',['changed']],['fortCoverTest',['inside']],['settings',[{sound:false,fps:false}]],['setClock',[14]],['sky',['clear']],['wetness',[0]],['viewMode',['street']],['hitchRun',[12,[],3,false,false]]])await named(method,...args);
  fort.beforeWalk=await readFort();
  await keyDown('KeyW');await tick(.5);fort.walk=await readFort();await keyUp('KeyW');
  assert(Math.hypot(fort.walk.status.x-fort.beforeWalk.status.x,fort.walk.status.y-fort.beforeWalk.status.y)>4 && fort.walk.cover.pace<9 && !fort.walk.cover.alarmed && fort.walk.cover.suspicion===0,'Physical W should walk safely under cover');
  await named('fortCoverTest','inside');await tick(.3);
  await keyDown('KeyD');await keyDown('ShiftLeft');await tick(1.6);
  fort.run=await readFort();
  assert(fort.run.cover.suspicion>10 && fort.run.cover.suspicion<50 && fort.run.cover.rate===20 && fort.run.cover.seenBy>0 && !fort.run.cover.alarmed && !fort.run.military.alert,'Brief physical run must fill suspicion without an alarm: '+JSON.stringify(fort.run.cover));
  await named('viewMode','chase');await named('chaseLook',0,0,0,6);await named('graphics','high');
  await named('hitchRun',1/60,[],3,false,true);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  fort.runningCapture=await readFort();
  assert(fort.runningCapture.quality.tier==='HIGH' && fort.runningCapture.status.renderer==='3d' && !fort.runningCapture.faults.count && !fort.runningCapture.gpu.losses,'High running HUD renderer unhealthy');
  assert(fort.runningCapture.dom.stealthLabel.text.includes('SUSPICION RISING') && /WALK WITHIN [1-5]s/.test(fort.runningCapture.dom.stealthHint.text),'Running countdown missing');
  assert(!fort.runningCapture.hud.overlaps.some(p=>p.includes('stealthStatus')),'Running meter overlaps HUD: '+JSON.stringify(fort.runningCapture.hud.overlaps));
  await shot('08-fort-running-suspicion-high');
  await keyUp('ShiftLeft');await named('viewMode','street');await tick(1);
  fort.recovery=await readFort();
  assert(fort.recovery.cover.seenBy>0 && fort.recovery.cover.suspicion<fort.runningCapture.cover.suspicion-10 && !fort.recovery.cover.alarmed && !fort.recovery.military.alert,'Visible walking must recover suspicion: '+JSON.stringify(fort.recovery.cover));
  await named('viewMode','chase');await named('chaseLook',0,0,0,6);await named('hitchRun',1/60,[],3,false,true);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  fort.recoveryCapture=await readFort();
  assert(fort.recoveryCapture.dom.stealthLabel.text.includes('FADING') && !fort.recoveryCapture.faults.count && !fort.recoveryCapture.gpu.losses,'Recovery HUD/renderer failed');
  assert(!fort.recoveryCapture.hud.overlaps.some(p=>p.includes('stealthStatus')),'Recovery meter overlaps HUD: '+JSON.stringify(fort.recoveryCapture.hud.overlaps));
  await shot('09-fort-running-recovery-high');
  await keyUp('KeyD');await tick(2);fort.calm=await readFort();
  assert(fort.calm.cover.suspicion===0 && !fort.calm.cover.alarmed,'Suspicion did not recover fully');
  // A sustained, observed run still exposes the disguise at the full bar. The lane
  // is clear east/west; alternating direction avoids the stand south of the fixture.
  await named('viewMode','street');await named('fortCoverTest','inside');await tick(.3);
  await keyDown('ShiftLeft');await keyDown('KeyD');await tick(1.6);await keyUp('KeyD');
  await keyDown('KeyA');await tick(1.6);await keyUp('KeyA');
  await keyDown('KeyD');await tick(1.6);await keyUp('KeyD');fort.beforeDeadline=await readFort();
  assert(!fort.beforeDeadline.cover.alarmed && fort.beforeDeadline.cover.suspicion<100,'Running grace ended before five seconds');
  await keyDown('KeyA');await tick(.5);await keyUp('KeyA');await keyUp('ShiftLeft');fort.afterDeadline=await readFort();
  assert(fort.afterDeadline.cover.alarmed && fort.afterDeadline.cover.blownBy==='running' && fort.afterDeadline.military.alert,'Sustained observed running never raised alarm: '+JSON.stringify(fort.afterDeadline.cover));
  console.log('PASS Fort physical W/Shift input, gradual buildup, visible recovery, native HUD and sustained-run deadline');

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
