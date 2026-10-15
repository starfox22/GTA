// Real Chromium Web Audio on a frozen build, deliberately unseeded and NO_RENDER.
// source /workspace/setup/GTA-env.sh; node tools/aircraft-audio-runtime-review.mjs HTML OUTDIR
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';

if (!process.argv[2] || !process.argv[3]) throw Error('Frozen HTML and output directory required');
const html = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]),
  hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(out, { recursive: true });
const report = {
  html, htmlSha256: hash(html), recorderSha256: hash(new URL(import.meta.url)),
  browserHelperSha256: hash(new URL('./browser.mjs', import.meta.url)),
  fixture: { query: '?dev&norender&hold', seeded: false, held: true, viewport: [960, 600],
    source: 'Frozen published HTML; no production override, private object access or eval hook.',
    reason: 'initAudio returns early for DEV_BOOT_SEED; an unseeded page is required to exercise real Web Audio.',
    scope: 'Actual Chromium AudioContext/production aircraft graphs, NO_RENDER (no WebGL context, images or hardware FPS claim).' },
  environment: { node: process.version, platform: process.platform, arch: process.arch,
    configuredNames: ['CHROME_PATH', 'PLAYWRIGHT_MODULE', 'NODE_OPTIONS', 'DEC_BROWSER_SLOTS', 'DEC_GPU'].filter(key => !!process.env[key]) },
  checks: 0, actions: [], profiles: [], errors: [], warnings: [], passed: false,
};
const names = new Set(['status', 'holdSimulation', 'god', 'settings', 'look', 'drive', 'placeVehicle', 'simulate',
  'interact', 'vehicleAt', 'flight', 'engineSound', 'audioMix', 'audioLevel', 'frameFaults']);
const { browser } = await launchBrowser({ label: 'unseeded-aircraft-audio', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60000);
report.environment.browserVersion = await browser.version();
page.on('pageerror', error => report.errors.push(error.stack || error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); else if (message.type() === 'warning') report.warnings.push(message.text()); });
function save() { fs.writeFileSync(path.join(out, 'aircraft-audio-runtime.json'), JSON.stringify(report, null, 2) + '\n'); }
function assert(ok, message) { report.checks++; if (!ok) throw Error(message); }
async function call(name, ...args) {
  if (!names.has(name)) throw Error('Undeclared named API: ' + name);
  report.actions.push({ name, args });
  return page.evaluate(([name, args]) => window.DeadEndCity[name](...args), [name, args]);
}
async function snapshot() {
  const [status, flight, engine, mix, meter, faults] = await Promise.all([
    call('status'), call('flight'), call('engineSound'), call('audioMix'), call('audioLevel'), call('frameFaults'),
  ]);
  return { status, flight, engine, mix, meter, faults };
}
async function settled(profile) {
  await page.waitForFunction(p => {
    const e = window.DeadEndCity.engineSound(), m = window.DeadEndCity.audioMix(), v = e.aircraft?.[0];
    return m.context === 'running' && e.ready && v?.airframe === p.airframe && v.kind === p.kind &&
      Math.abs(v.gain - p.gain) < 0.001 && Math.abs(v.hiss - p.hiss) <= 0.00005 && v.power === 0 &&
      v.rpm === p.rpm && Math.abs(v.bladeHz - p.bladeHz) < 0.01 && Math.abs(v.firingHz - p.firingHz) < 0.01 &&
      m.buses?.mix === 1 && Math.abs(m.buses.engines - 0.465) < 0.0001;
  }, profile, { timeout: 15000 });
}
try {
  await page.goto('file://' + html + report.fixture.query, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu');
  report.beforeStart = await call('audioMix');
  await page.click('#startBtn');
  await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
  if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
  await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
  await call('holdSimulation', true); await call('god', true);
  await call('settings', { sound: true, masterVolume: 100, engineVolume: 75, radioVolume: 0,
    ambienceVolume: 0, voiceVolume: 0, sirenVolume: 0, soundVolume: 0 });
  report.afterStart = { status: await call('status'), mix: await call('audioMix') };
  assert(report.afterStart.status.renderer === '2d', 'NO_RENDER fixture unexpectedly created a WebGL renderer');
  assert(report.afterStart.mix.context !== null, 'Real Start gesture did not create AudioContext');
  const profiles = [
    { airframe: 'skyhawk', kind: 'piston', engines: 1, gain: 0.306, hiss: 0, rpm: 700, bladeHz: 23.33, firingHz: 23.33 },
    { airframe: 'courier', kind: 'turboprop', engines: 1, gain: 0.85, hiss: 0.0042, rpm: 1050, bladeHz: 70, firingHz: 0 },
    { airframe: 'jet', kind: 'turbofan', engines: 2, gain: 1.19, hiss: 0.027, rpm: 0, bladeHz: 0, firingHz: 0 },
    { airframe: 'airliner', kind: 'turbofan', engines: 2, gain: 1.275, hiss: 0.027, rpm: 0, bladeHz: 0, firingHz: 0 },
  ];
  for (const [i, profile] of profiles.entries()) {
    await call('look', -2060, 9884);
    await call('drive', 'plane', 0, 0, profile.airframe);
    await call('simulate', 0.1);
    await settled(profile);
    // Connect the public output analyser, then let its real-time sample window fill.
    await call('audioLevel'); await page.waitForTimeout(120);
    const row = { expected: profile, live: await snapshot() }, voice = row.live.engine.aircraft[0];
    row.identity = await call('vehicleAt', row.live.status.x, row.live.status.y);
    assert(row.identity?.type === 'plane' && row.live.status.vehicle === 'plane' && row.live.flight.type === profile.airframe, profile.airframe + ': wrong actual aircraft');
    assert(voice.kind === profile.kind && voice.engines === profile.engines && row.live.engine.aircraft.length <= 4, profile.airframe + ': wrong bounded production graph');
    assert(Math.abs(voice.gain - profile.gain) < 0.001 && Math.abs(voice.hiss - profile.hiss) <= 0.00005 && voice.rpm === profile.rpm && Math.abs(voice.bladeHz - profile.bladeHz) < 0.01, profile.airframe + ': actual voice parameters did not settle');
    assert(row.live.mix.context === 'running' && row.live.mix.soundOn && row.live.mix.buses.mix === 1 && Math.abs(row.live.mix.buses.engines - 0.465) < 0.0001, profile.airframe + ': volume bus or running context mismatch');
    assert(Number.isFinite(row.live.meter.rms) && Number.isFinite(row.live.meter.peak) && row.live.meter.rms > 0, profile.airframe + ': real output analyser is silent/non-finite');
    await call('settings', { sound: false }); await call('simulate', 0.1);
    await page.waitForFunction(() => { const a = window.DeadEndCity; return a.audioMix().buses.mix === 0 && a.engineSound().aircraft.every(v => !v || v.gain < 0.00001); });
    row.muted = await snapshot();
    assert(!row.muted.mix.soundOn && row.muted.mix.buses.mix === 0 && row.muted.engine.aircraft.every(v => !v || v.gain < 0.00001), profile.airframe + ': Sound switch did not fade actual voices');
    assert(row.muted.meter.rms < 0.0001, profile.airframe + ': muted analyser remains audible');
    await call('settings', { sound: true }); await call('simulate', 0.1); await settled(profile);
    await call('placeVehicle', 1000 + i * 400, 9884, 0, 0);
    await call('interact'); await call('simulate', 0.1);
    await page.waitForFunction(() => !window.DeadEndCity.status().vehicle && window.DeadEndCity.engineSound().aircraft.every(v => !v || v.gain < 0.00001));
    row.exited = await snapshot();
    assert(!row.exited.status.vehicle && row.exited.engine.aircraft.every(v => !v || v.gain < 0.00001), profile.airframe + ': parked exit did not fade actual voices');
    assert(row.exited.engine.aircraft.length <= 4 && !row.exited.faults.count && !report.errors.length, profile.airframe + ': pool/frame/console fault');
    report.profiles.push(row); save(); console.log('PASS actual browser audio', profile.airframe, 'rms', row.live.meter.rms);
  }
  assert(new Set(report.profiles.map(row => row.live.engine.aircraft[0].airframe)).size === 4 && new Set(report.profiles.map(row => row.live.engine.aircraft[0].kind)).size === 3, 'Four airframes did not select three correct engine families');
  assert(report.profiles[3].live.engine.aircraft[0].gain > report.profiles[2].live.engine.aircraft[0].gain, 'Airliner/business jet selected the same output profile');
  report.final = await snapshot(); report.passed = true;
  console.log('PASS actual unseeded NO_RENDER WebAudio:', report.checks, 'assertions');
} catch (error) { report.failure = error.stack || error.message; console.error(report.failure); process.exitCode = 1; }
finally { save(); await browser.close(); }
