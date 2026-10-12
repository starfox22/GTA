// Run the shipped panning/caller functions against recording Web Audio nodes. The
// renderer's own chaseFrame defines screen-right; no browser or audio device is needed.
import fs from 'node:fs';
import vm from 'node:vm';

const source = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
function productionFunction(file, name) {
  const match = source(file).match(new RegExp('^    function ' + name + '\\([^]*?^    \\}', 'm'));
  if (!match) throw new Error('missing production function ' + file + ':' + name);
  return match[0];
}

export default async function (t) {
  let chase = false;
  const pans = [], gains = [];
  const noop = () => {};
  const param = () => ({ value: 0, events: [],
    setValueAtTime(v) { this.value = v; this.events.push(v); },
    linearRampToValueAtTime(v) { this.value = v; this.events.push(v); },
    exponentialRampToValueAtTime(v) { this.value = v; },
    setTargetAtTime(v) { this.value = v; },
  });
  function node() {
    return { gain: param(), pan: param(), frequency: param(), Q: param(), playbackRate: param(),
      connect(other) { return other; }, disconnect: noop, start: noop, stop: noop };
  }
  const context = vm.createContext({
    Math, player: { x: 123, y: -47 }, chaseCam: { yaw: 1.23, viewYaw: 0, pitch: 0, fov: 70 },
    chaseBasis: {}, chaseCameraLive: () => chase,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y), entityElevation: () => 0,
    audio: { currentTime: 10, createBufferSource: node, createBiquadFilter: node,
      createGain() { const n = node(); gains.push(n.gain); return n; },
      createStereoPanner() { const n = node(); pans.push(n.pan); return n; } },
    soundOn: true, audioBuffers: { fixture: {}, tires: {} }, master: node(), ROOM_SAMPLES: new Set(),
    soundShade: () => ({ gain: 1, cutoff: 10000 }), setTimeout: noop,
    ambience: { bus: node() }, buildAmbience: () => true, gameMode: 'play',
    trafficHorn: (...args) => { context.heardHorn = args; },
    acoustics: { stats: { placed: 0, occluded: 0 } }, bulletPoint: {}, earBlocked: () => false, airCutoff: () => 10000,
    foleyBuffers: () => ({ white: {} }), vehicleSpec: () => ({}), KMH: 8 / 3.6,
    bullets: [], bulletAudio: { whizzed: new WeakSet() }, WHIZZ_REACH: 32,
    whizzCount: 0, bulletWhizz: (...args) => { context.heardWhizz = args; context.whizzCount++; },
    npcStride: new WeakMap(), npcSteps: { seen: 0, runners: 0, tokens: 100, dt: 0.1, wet: 0, heard: 0 },
    gameTime: 10, UNITS_PER_METRE: 8, strideCycle: () => 4, footSurfaceAt: () => 'asphalt',
    footstepSound: (...args) => { context.heardStep = args; },
    glideParam: (p, v) => { p.value = v; }, ENGINE_SETS: { fixture: {} }, ENGINE_OF_TYPE: {},
    SOUND_SPEED: 1756, TRAFFIC_REACH: 500, trafficRpm: () => 1000,
    stadiumAudibility: () => ({ distance: 0, level: 0.75 }), STADIUM_SOUND_CENTRE: { x: 0, y: 0 },
    syncCarRadio: noop, updateEngineAudio: noop, updateVehicleFoley: noop, updateAcoustics: noop,
    updateLoudDuck: noop, absBuzz: noop, updateWaterAudio: noop, updateSeaLifeAudio: noop, updateFootsteps: noop,
    wantedStars: 1, audioLoops: {}, vehicles: [],
  });
  const functions = {
    audio: ['soundRight', 'playSample', 'soundUpdate'],
    'chase-camera': ['chaseFrame'],
    ambience: ['spatial', 'hornSound'],
    'water-audio': ['waterPlacement'],
    'bullets-audio': ['bulletBus', 'updateBulletWhizz'],
    'vehicle-foley-audio': ['passByWhoosh', 'updateTrafficSkid'],
    'footsteps-audio': ['npcStepVisit'],
    'engine-audio': ['updateTrafficEngines'],
    'sports-audio': ['stadiumCheerMix'],
  };
  for (const [file, names] of Object.entries(functions))
    for (const name of names) vm.runInContext(productionFunction(file, name), context);
  const near = (got, want, label) => t.assert(Math.abs(got - want) < 1e-10, label + ': ' + got + ' != ' + want);

  // Top-down never consults camera state; even signed zero stays exactly as before.
  for (const dx of [0, -0, 0.3, -19, 450, -99999]) {
    const saved = context.chaseCam;
    context.chaseCam = null;
    t.assert(Object.is(context.soundRight(dx, 92), dx), 'top-down world-X mix changed');
    context.chaseCam = saved;
  }
  chase = true;
  for (let i = 0; i < 100; i++) {
    context.chaseCam.viewYaw = i * Math.PI / 31 - 5;
    context.chaseCam.viewPitch = (i % 5 - 2) * 0.6;
    const basis = context.chaseFrame();
    for (const [x, y] of [[0, 0], [50, 0], [0, 50], [-42, 311], [197, -733]])
      near(context.soundRight(x, y), x * basis.rx + y * basis.ry, 'audio disagrees with camera screen-right');
    near(context.soundRight(basis.fx * 100, basis.fy * 100), 0, 'straight-ahead sound is not centered');
  }
  context.chaseCam.viewYaw = undefined;
  near(context.soundRight(90, 10), 90 * context.chaseFrame().rx + 10 * context.chaseFrame().ry, 'yaw fallback');

  // A source 225 units south is centered from overhead, right facing east,
  // left facing west. Check actual callers and preserve gain across camera rotation.
  const at = { x: context.player.x, y: context.player.y + 225 };
  let sampleGain;
  for (const [live, yaw, expected] of [[false, 0, 0], [true, 0, 0.5], [true, Math.PI, -0.5], [true, Math.PI / 2, 0]]) {
    chase = live;
    context.chaseCam.viewYaw = yaw;
    context.playSample('fixture', 0.5, 1, at);
    near(pans.at(-1).value, expected, 'positioned sample');
    const gain = gains.at(-1).value;
    if (sampleGain === undefined) sampleGain = gain;
    near(gain, sampleGain, 'camera rotation changed sample attenuation');
    near(context.spatial(at).pan, expected, 'ambience placement');
    near(context.waterPlacement(at).pan, expected, 'water placement');
    context.hornSound(at);
    near(context.heardHorn[4], expected, 'traffic horn');
    context.bulletBus(at.x, at.y, 0, 1);
    near(pans.at(-1).value, expected, 'bullet impact');
    near(context.stadiumCheerMix(at, 1).pan, expected * 450 / 500, 'stadium');

    const cop = { ...at, cop: true, hp: 100, vx: 0, vy: 10 };
    context.vehicles = [cop];
    const siren = { gain: node(), filter: node(), pan: node(), source: node() };
    context.audioLoops = { siren };
    context.soundUpdate(0.1);
    near(siren.pan.pan.value, expected, 'police siren');
    const engine = { car: cop, kind: 'fixture', lastSpeed: 0, rpm: 1000, root: 1000, source: node(), gain: node(), filter: node(), pan: node() };
    context.updateTrafficEngines({ trafficClock: 1, traffic: [engine] }, true, 10, 0.1);
    near(engine.pan.pan.value, expected, 'traffic engine');
    context.vehicleFoley = { skid: { gain: node(), filter: node(), pan: node(), source: node() }, skidClock: 1, skidCar: cop, skidLevel: 1 };
    context.updateTrafficSkid(0.1, true, 10);
    near(context.vehicleFoley.skid.pan.pan.value, expected, 'traffic tyre skid');
    const runner = { x: context.player.x, y: context.player.y + 90, hp: 100 };
    context.npcStride.set(runner, { x: runner.x, y: runner.y - 3, at: 9.9, phase: 0.9 });
    context.npcStepVisit(runner);
    near(context.heardStep[4], expected * 0.6, 'NPC footstep');

    context.heardWhizz = null;
    context.bullets = [{ x: context.player.x + 10, y: context.player.y + 8, vx: 200, vy: 0, enemy: true, altitude: 0 }];
    context.updateBulletWhizz(0.1, true);
    near(context.heardWhizz[0], expected, 'near miss');
    const count = context.whizzCount;
    context.updateBulletWhizz(0.1, true); // already heard: WeakSet suppresses repeats
    t.assert(context.whizzCount === count, 'a near miss played twice');
    context.bullets = [];
  }
  // Pass-by animation uses view-relative travel direction as well as source position.
  chase = true;
  for (const yaw of [0, Math.PI]) {
    context.chaseCam.viewYaw = yaw;
    context.passByWhoosh({ x: context.player.x, y: context.player.y + 12, vx: 0, vy: 100 }, 100, 12);
    const sign = yaw === 0 ? 1 : -1;
    near(pans.at(-1).events[0], sign * 0.2, 'pass-by start');
    near(pans.at(-1).events[1], sign * 0.9, 'pass-by direction');
  }
  // These less frequent positioned callers must use the same projection. Random
  // ambience and the player's own left/right footsteps deliberately remain stereo beds.
  for (const file of ['crash-audio', 'sealife-audio', 'weather-audio', 'themepark-sound', 'drawbridge-motion', 'roofmission-poison']) {
    t.assert(source(file).includes('soundRight('), file + ' still bypasses listener orientation');
  }
  t.note('500 camera-basis cases; unchanged top-down offsets/gain; real sample, horn, water, impact, stadium, siren, engine, skid, footstep, whizz and pass-by callers');
}
