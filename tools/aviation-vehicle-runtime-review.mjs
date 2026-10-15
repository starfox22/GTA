// Seeded frozen-candidate WebGL review; named public APIs only.
// Run aircraft-audio-runtime-review.mjs separately without a seed: seeded boots intentionally disable audio.
// node tools/aviation-vehicle-runtime-review.mjs FROZEN_HTML OUTPUT_DIRECTORY
// One native 960x600 browser; three screenshots; no context-loss drill or private/eval hooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';
import { pathToFileURL } from 'node:url';
import {runTrailContactReview} from './trail-contact-render-review.mjs';

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export async function runAviationVehicleRuntime({ html, out, page, trail = false }) {
  if (!html || !out) throw Error('Frozen HTML and output directory required');
  html = path.resolve(html); out = path.resolve(out);
  if (!fs.existsSync(html)) throw Error('Frozen HTML does not exist: ' + html);
  fs.mkdirSync(out, { recursive: true });
  const report = {
    html, htmlSha256: hash(html), recorderSha256: hash(new URL(import.meta.url)),
    fixture: { viewport: [960, 600], seed: 1, held: true, shadercheck: true, hotrod: [418, 7800],
      jetGround: [-2000, 9884], jetCruise: [-2000, 9884, 100], clock: 13,
      input: 'Start button initializes audio; existing named console actions/reports; real mapped keydown for flaps/gear followed by simulate() for finite actuator travel.' },
    limits: [
      'vehicleDoors().sourceGeometryRestored compares every source geometry attribute after repair. Per-layer attribute names are covered by the separate host rig test; this public runtime report does not expose their arrays.',
      'Aircraft source identity, shared kit, exact-id extents, projected visibility and aggregate vehicle draw geometry are checked. Public APIs do not expose individual live hinge transforms; screenshots retain the actual controlled model and flight HUD.',
      'This seeded visual runner does not assert WebAudio output. The separate unseeded audio runner verifies all four airframes, actual context/output, profiles, mute and exit fades; production-graph MP3s are in the audio audit.',
      'Software WebGL checks shader/runtime behavior, not hardware FPS or subjective appearance/sound approval.',
    ],
    checks: 0, errors: [], warnings: [], actions: [], captures: [], tiers: [], audio: [],
    audioVerification: { runner: 'tools/aircraft-audio-runtime-review.mjs',
      scope: 'Separate unseeded browser required; initAudio deliberately disables sound in seeded screenshot sessions.' },
  };
  // The single-file candidate contains its media. Also hash local media packs when
  // the frozen input is a split build, without attributing today's checkout to it.
  report.inputs = [{ file: html, sha256: report.htmlSha256 }];
  for (const match of fs.readFileSync(html, 'utf8').matchAll(/<script[^>]+src=["'](media\/[^"']+)["']/g)) {
    const file = path.resolve(path.dirname(html), match[1].split(/[?#]/)[0]);
    if (!file.startsWith(path.dirname(html) + path.sep) || !fs.existsSync(file)) throw Error('Missing/local-only candidate media pack: ' + match[1]);
    report.inputs.push({ file, sha256: hash(file) });
  }
  const allowed = new Set(['status', 'holdSimulation', 'god', 'graphics', 'settings', 'sky', 'setClock', 'wanted',
    'look', 'carLineup', 'hitchRun', 'approvedAssets', 'hotrodAssets', 'assetCars', 'vehicleDoors', 'assetChar',
    'burnVehicle', 'doorSwing', 'damageReport', 'frameFaults', 'drawProfile', 'viewMode', 'inspectView', 'closeUp',
    'gpuContext', 'interact', 'vehicleAt', 'vehicleById', 'carModels', 'cabinHeadroom', 'drive', 'placeVehicle',
    'flight', 'bindings', 'simulate', 'aircraftAssets', 'jetAssets', 'carBadges', 'scaleReport', 'cameraView',
    'chaseCamera', 'chaseLook', 'chaseProject', 'audioMix', 'audioLevel', 'engineSound']);
  const ownPage = !page;
  let browser = null;
  if (ownPage) {
    ({ browser } = await launchBrowser({ label: 'aviation-vehicle-runtime', args: ['--autoplay-policy=no-user-gesture-required'] }));
    page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  }
  report.fixture.reusedPage = !ownPage;
  await page.setViewportSize({ width: 960, height: 600 });
  page.setDefaultTimeout(540000);
  const onPageError = e => report.errors.push(e.stack || e.message);
  const onConsole = m => {
    if (m.type() === 'error' || /GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM|WebGL[^\n]*(?:error|invalid)|shader[^\n]*(?:failed|error)/i.test(m.text())) report.errors.push(m.text());
    else if (m.type() === 'warning') report.warnings.push(m.text());
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  function assert(ok, message) { report.checks++; if (!ok) throw Error(message); }
  function save() { fs.writeFileSync(path.join(out, 'aviation-vehicle-runtime.json'), JSON.stringify(report, null, 2) + '\n'); }
  async function batch(rows) {
    for (const [name] of rows) if (!allowed.has(name)) throw Error('Undeclared named API: ' + name);
    report.actions.push(...rows.map(([name, args]) => ({ name, args })));
    return page.evaluate(rows => rows.map(([name, args]) => {
      if (typeof window.DeadEndCity[name] !== 'function') throw Error('Missing named API: ' + name);
      return window.DeadEndCity[name](...args);
    }), rows);
  }
  const call = async (name, ...args) => (await batch([[name, args]]))[0];
  const draw = ['hitchRun', [1 / 60, [], 1, false, true]], age = ['hitchRun', [1.3, [], 1, false, false]];
  async function health() {
    const [status, faults, gpu] = await batch([['status', []], ['frameFaults', []], ['gpuContext', []]]);
    assert(status.renderer === '3d' && status.mode === 'play', '3D play state was lost');
    assert(!faults.count && !gpu.lost && !gpu.losses && !report.errors.length, 'Frame/GPU/console fault: ' + JSON.stringify({ faults, gpu, errors: report.errors }));
    return { status, faults, gpu };
  }
  async function hotrodSnapshot(id) {
    const [identity, approved, assets, doors, char, damage, models, headroom, camera] = await batch([
      ['vehicleById', [id]], ['approvedAssets', []], ['hotrodAssets', []], ['vehicleDoors', [id]], ['assetChar', []],
      ['damageReport', [id]], ['carModels', []], ['cabinHeadroom', []], ['cameraView', []],
    ]);
    return { ...await health(), identity, model: approved.models.find(m => m.id === id), assets,
      doors: doors.cars.find(c => c.id === id), char: char.models.find(m => m.id === id) || null,
      damage, cabin: models.find(m => m.id === id)?.cabin, headroom: headroom.cars.filter(c => c.type === 'hotrod'), camera };
  }
  async function tier(name) {
    await batch([['graphics', [name]], draw]);
    const quality = await call('graphics'), size = ['LOW', 'MEDIUM'].includes(quality.tier) ? 2048 : 4096;
    await page.waitForFunction(size => {
      const a = window.DeadEndCity.hotrodAssets();
      return a.loaded && a.atlasSizes.length === 2 && a.atlasSizes.every(([w, h]) => w === size && h === size);
    }, size, { timeout: 240000 });
    await batch([draw]);
    const assets = await call('hotrodAssets');
    assert(assets.atlasSizes.length === 2 && assets.atlasSizes.every(([w, h]) => w === size && h === size), name + ': hotrod textures did not load at the active tier');
    if (name === 'auto' && /swiftshader|llvmpipe|software/i.test(quality.gpu || '')) assert(quality.tier === 'LOW', 'Software AUTO did not select LOW');
    return quality;
  }
  async function capture(name, snapshot) {
    const file = name + '.png';
    await page.screenshot({ path: path.join(out, file), timeout: 540000 });
    report.captures.push({ file, sha256: hash(path.join(out, file)), viewport: [960, 600], snapshot });
    save(); console.log('Captured', name);
  }
  async function pressAction(action) {
    const bindings = await call('bindings'), code = bindings[action]?.[0];
    assert(typeof code === 'string' && code.length > 0, 'Missing mapped key for ' + action);
    report.actions.push({ keyboardAction: action, code });
    await page.keyboard.press(code);
  }
  async function aircraftSnapshot(id) {
    const [identity, flight, badges, assets, jets, extents, profile, camera, engine, audio] = await batch([
      ['vehicleById', [id]], ['flight', []], ['carBadges', []], ['aircraftAssets', []], ['jetAssets', []],
      ['scaleReport', [80]], ['drawProfile', [60]], ['chaseCamera', []], ['engineSound', []], ['audioMix', []],
    ]);
    return { ...await health(), identity, flight, asset: badges.find(c => c.id === id), assets, jets,
      extents: extents.models.find(c => c.id === id), profile, camera, engine, audio };
  }
  function aircraftVisible(row, label) {
    assert(row.identity?.type === 'plane' && row.extents?.l > 1 && row.extents?.w > 1, label + ': exact aircraft has no measured source geometry');
    assert(row.profile.byTriangles.some(([name, count]) => /vehicle/.test(name) && count > 1000), label + ': no vehicle geometry submitted in the actual camera pass');
  }
  let retired = 0;
  async function leavePlane() {
    if ((await call('status')).vehicle === 'plane') {
      // Return a flight fixture to a vacant airport runway spot before teleporting;
      // look() otherwise carries an airborne aircraft instead of exiting it.
      await call('placeVehicle', 1000 + retired++ * 400, 9884, 0, 0);
      await call('interact');
      assert(!(await call('status')).vehicle, 'Ground fixture did not release its aircraft');
    }
  }
  async function stagePlane(airframe, altitude = 0) {
    await leavePlane();
    await batch([['look', [-2060, 9884, 3]], ['inspectView', []], ['viewMode', ['street']], ['drive', ['plane', altitude, 0, airframe]], ['simulate', [0.1]], draw]);
    const status = await call('status'), id = (await call('vehicleAt', status.x, status.y))?.id;
    const row = await aircraftSnapshot(id);
    assert(row.identity?.id === id && row.status.vehicle === 'plane' && row.flight?.type === airframe, 'Wrong boarded aircraft: ' + airframe);
    return { id, row };
  }
  try {
    if (ownPage) {
      await page.goto('file://' + html + '?dev&seed=1&hold&shadercheck', { waitUntil: 'domcontentloaded', timeout: 540000 });
      await page.waitForFunction(() => window.DeadEndCity?.status().mode === 'menu');
      await page.click('#startBtn');
      await page.waitForFunction(() => ['play', 'dialogue'].includes(window.DeadEndCity.status().mode));
      if ((await call('status')).mode === 'dialogue') await page.click('#callDecline');
      await page.waitForFunction(() => window.DeadEndCity.status().mode === 'play');
    }
    await batch([['holdSimulation', [true]], ['god', [true]], ['sky', ['clear']], ['setClock', [13]], ['wanted', [0]],
      ['settings', [{ sound: true, masterVolume: 100, engineVolume: 75, radioVolume: 0, ambienceVolume: 0,
        voiceVolume: 0, sirenVolume: 0, soundVolume: 0, cameraView: 'street', flightHud: true, fps: true,
        gps: false, minimapFolded: true, keyHints: false, playerRing: false, motionBlur: false, lookAhead: 0 }]],
      ['graphics', ['high']], ['look', [418, 7880, 1.6]], ['inspectView', []]]);
    await page.mouse.move(958, 0);
    const [lineup] = await batch([['carLineup', [['hotrod'], 418, 7800, 0, 44, '#b72228', true]], draw, draw]);
    const id = report.hotrodId = lineup[0].id;
    await tier('high');
    const clean = report.hotrodClean = await hotrodSnapshot(id);
    assert(clean.identity?.id === id && clean.identity.type === 'hotrod' && clean.identity.x === 418 && clean.identity.y === 7800, 'Exact isolated hotrod identity/placement failed');
    assert(clean.assets.loaded && clean.assets.key === 'coupe33_zhab' && clean.assets.triangles === 20856 && clean.assets.farTriangles === 5202, 'Wrong loaded Coupe33 source budgets');
    assert(!clean.status.vehicle && !clean.doors.mask && !Object.keys(clean.doors.doors).length, 'Burn-before-first-door requires an unboarded pristine source with no built door');
    assert(clean.doors.cabin.authored && !clean.doors.cabin.fallbackVisible && Object.values(clean.doors.sourceGeometryRestored).every(Boolean), 'Native cabin or complete source attributes missing before clipping');
    for (const name of ['low', 'medium', 'high', 'ultra', 'auto']) {
      await batch([['look', [418, 7880, 1.6]]]);
      const quality = await tier(name), near = await hotrodSnapshot(id);
      assert(near.model?.visible && near.model.asset === 'coupe33_zhab' && !near.model.far && near.model.triangles === 20856, name + ': wrong actual near hotrod draw');
      await batch([['look', [418, 8100, 0.9]], draw]);
      const far = await hotrodSnapshot(id);
      assert(far.model?.visible && far.model.far && far.model.triangles === 5202, name + ': wrong actual far hotrod draw');
      report.tiers.push({ requested: name, quality, near, far }); save();
    }
    await batch([['look', [378, 7800, 4.5]]]); await tier('high');
    await batch([['burnVehicle', [id, 20]], draw]);
    report.hotrodBurnBeforeDoor = await hotrodSnapshot(id);
    assert(report.hotrodBurnBeforeDoor.char && report.hotrodBurnBeforeDoor.damage.burnt, 'Hotrod did not enter actual source char state');
    await batch([['doorSwing', [id, true, -1]], draw, draw]);
    report.hotrodBurntOpen = await hotrodSnapshot(id);
    assert((report.hotrodBurntOpen.doors.mask & 1) && !report.hotrodBurntOpen.doors.nativeDoors && !report.hotrodBurntOpen.doors.doors['-1'].apertureHasCentrePanel, 'First post-burn source-extracted hotrod door did not open its body aperture');
    await batch([['burnVehicle', [id, 0, true]], ['doorSwing', [id, false]], age, draw, draw]);
    report.hotrodRepaired = await hotrodSnapshot(id);
    assert(!report.hotrodRepaired.char && !report.hotrodRepaired.damage.burnt && report.hotrodRepaired.damage.hp === report.hotrodRepaired.damage.maxhp, 'Hotrod repair retained burnt state');
    assert(!report.hotrodRepaired.doors.mask && Object.values(report.hotrodRepaired.doors.sourceGeometryRestored).every(Boolean), 'Hotrod repair lost source positions/normals/UVs/ORM attributes');
    assert(JSON.stringify(report.hotrodRepaired.doors.materials) === JSON.stringify(clean.doors.materials), 'Hotrod repair changed original physical source materials/maps');
    // look() obeys the normal 4.5 zoom ceiling. Explicit inspection zoom brings
    // the camera inside the 37 m occupant range before testing the actual driver.
    await batch([['look', [418, 7787, 4.5]], ['interact', []], ['closeUp', [11]], draw, age, draw, ['inspectView', [115, 7, 5]], ['doorSwing', [id, true, -1]], draw]);
    await page.locator('#game').focus();
    const open = report.hotrodOpenCabin = await hotrodSnapshot(id), sourceMaterials = new Set(Object.values(clean.doors.materials).filter(Boolean).map(m => m.uuid)),
      sourceLayers = open.doors.doors['-1'].layers.filter(l => !l.window && !l.innerCard && l.triangles > 0);
    assert(open.status.vehicle === 'hotrod' && open.identity.id === id && open.cabin?.seated > 0, 'Cabin photo did not board/render the exact repaired hotrod driver');
    assert((open.doors.mask & 1) && !open.doors.doors['-1'].apertureHasCentrePanel && sourceLayers.length >= 2 && sourceLayers.every(l => l.visible && sourceMaterials.has(l.material.uuid)), 'Open repaired source layers retained char or hid the cabin aperture');
    assert(open.headroom.length > 0 && open.headroom.every(h => !h.through.length && Number.isFinite(h.seatGap) && h.seatGap <= 0.02), 'Actual hotrod driver headroom/seat contract failed');
    await capture('hotrod-open-source-cabin', open);
    await batch([['doorSwing', [id, false]], age, ['interact', []]]);

    const ground = await stagePlane('jet');
    await batch([['closeUp', [3]], ['inspectView', [65, 15, 8]], draw]);
    report.jetTiers = [];
    for (const name of ['low', 'medium', 'high', 'ultra', 'auto']) {
      await batch([['graphics', [name]], draw, draw]);
      const row = { requested: name, ...await aircraftSnapshot(ground.id) };
      assert(row.asset?.asset === 'jet' && row.jets.loaded, name + ': downloaded aircraft identity was lost');
      aircraftVisible(row, name + ' player jet');
      report.jetTiers.push(row); save();
    }
    await batch([['graphics', ['high']], draw, draw]);
    await pressAction('gear'); await call('simulate', 0.2);
    assert((await call('flight')).gearPos === 1, 'Ground weight-on-wheels gear interlock failed');
    await pressAction('flapsDown'); await call('simulate', 1.1); await batch([draw]);
    report.jetGround = await aircraftSnapshot(ground.id);
    assert(report.jetGround.flight.flaps === '1' && report.jetGround.flight.flapPos > 0.3 && report.jetGround.flight.gear === 'DOWN', 'Mapped ground flap/gear controls did not operate');
    assert(report.jetGround.asset?.asset === 'jet' && report.jetGround.jets.loaded && report.jetGround.jets.kits.includes('jet'), 'Actual aircraft did not use its downloaded jet source');
    aircraftVisible(report.jetGround, 'ground jet');
    await capture('jet-ground-flaps-source', report.jetGround);
    const cruise = await stagePlane('jet', 100);
    assert(Math.abs(cruise.row.flight.agl - 100) < 2 && cruise.row.flight.gear === 'UP', 'Cruise fixture is not the actual 100m jet with retracted gear');
    await pressAction('flapsDown'); await pressAction('gear'); await call('simulate', 4.8);
    await batch([['viewMode', ['chase']], draw, ['chaseLook', [0, 0, 45, 16]], draw]);
    report.jetCruise = await aircraftSnapshot(cruise.id);
    assert(report.jetCruise.flight.type === 'jet' && report.jetCruise.flight.agl > 40 && report.jetCruise.flight.gear === 'DOWN' && report.jetCruise.flight.flapPos > 0.3, 'Mapped in-flight flap/gear travel did not complete safely');
    aircraftVisible(report.jetCruise, 'cruise jet');
    report.jetCruise.projected = await call('chaseProject', report.jetCruise.identity.x, report.jetCruise.identity.y, report.jetCruise.identity.altitude);
    assert(report.jetCruise.projected?.sees && !report.jetCruise.projected.behind, 'Chase camera does not see the controlled aircraft');
    await capture('jet-cruise-gear-flaps-chase', report.jetCruise);
    await pressAction('flapsUp'); await call('simulate', 1.1);
    assert((await call('flight')).flaps === 'UP', 'Mapped flap retraction failed');

    report.final = { ...await health(), profile: await call('drawProfile', 5), audio: await call('audioMix') };
    if (trail) {
      const result = await runTrailContactReview({html, out:path.join(path.dirname(out),'after-trail'), label:'final-runtime', page});
      report.trail = {pass:result.pass,htmlSha256:result.htmlSha256,recorderSha256:result.recorderSha256};
      assert(result.pass, 'Rendered trail review failed: '+result.failure);
    }
    report.passed = true;
    console.log('PASS aviation/vehicle runtime:', report.checks, 'assertions,', report.captures.length, 'native captures');
    return report;
  } catch (e) { report.failure = e.stack || e.message; throw e; }
  finally {
    try { save(); } finally {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      if (ownPage) await browser.close();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runAviationVehicleRuntime({ html: process.argv[2], out: process.argv[3], trail:process.argv.includes('--trail') }); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
