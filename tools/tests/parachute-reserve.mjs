// Production chute deployment, drag, cutaway, controls and impact scale in a
// bounded, level empty-site host. Rendering and the real keydown path are covered
// separately by the native review; no browser or synthetic chute solver here.
import fs from 'node:fs';
import vm from 'node:vm';

function chuteHost(overrides = {}) {
  const read = name => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  const noop = () => {}, elements = new Map(), notes = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', dataset: {}, style: { setProperty: noop }, classList: { add: noop, remove: noop } });
    return elements.get(id);
  };
  const c = vm.createContext({
    Math, Set, Map, UNITS_PER_METRE: 8, KMH: 8 / 3.6, GRAVITY: 9.81 * 8, TAU: 2 * Math.PI,
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)), normalizeAngle: a => Math.atan2(Math.sin(a), Math.cos(a)),
    worldMeters: x => x / 8, gameTime: 0, gameMode: 'play', keys: {},
    player: { x: 1500, y: 1500, a: 0, altitude: 0, hp: 100 }, vehicles: [], buildings: [],
    mouse: {}, mission: null, shake: 0, flash: 0, audio: null, master: null, soundOn: false, bloodOn: false,
    ROOFTOP: { x: -1e6, y: -1e6, w: 10, h: 10, height: 10 }, spawn: { x: 1500, y: 1500 },
    localStorage: { getItem: () => null, setItem: noop },
    isAircraft: v => v?.type === 'helicopter' || v?.type === 'plane',
    terrainHeight: () => 0, groundAt: () => true, solid: () => false,
    buildingsNear: () => [], deckSurfaceAt: () => null, deckLandingStep: () => false,
    pointInCar: () => false, clearTouchInput: noop, noise: noop, tone: noop,
    footLandSound: noop, particle: noop, failMission: noop, announce: noop, playSample: noop, bleed: noop,
    randomBetween: (a, b) => (a + b) / 2,
    hintDevice: () => 'keyboard', deviceKeyName: () => null, getElement: element,
    tell: text => notes.push(text),
    hurt: amount => { c.player.hp = Math.max(0, c.player.hp - amount); if (c.player.hp === 0) c.gameMode = 'dead'; },
  });
  vm.runInContext(read('controls') + '\n' + read('falls-body') + '\n' + read('parachute') + `
    function pressKey(id) { return 'PRESS ' + keyName(id); }
    globalThis.api = {
      bailOut, hand: openParachuteByHand, update: updateParachute,
      cue: parachuteCueState, ui: updateFreefallCue, forecast: parachuteForecast,
      bind: bindControl, resetBindings: resetControlBindings,
      down: code => holdActions(pressControlKey(code)), up: releaseControlKey,
      impacts: fallLog,
      fresh(metres = 2000) {
        releaseAllControlKeys(); keys = {}; gameMode = 'play';
        Object.assign(player, {x:1500,y:1500,a:0,altitude:metres*8,hp:100,godMode:false});
        player.car = {type:'helicopter',x:1500,y:1500,a:0.4,altitude:metres*8,vx:80,vy:30};
        return bailOut();
      }
    };
  `, c);
  const step = (seconds, hz = 60) => {
    const count = Math.ceil(seconds * hz), dt = seconds / count;
    for (let i = 0; i < count && c.player.parachute && c.gameMode === 'play'; i++) {
      c.gameTime += dt; c.api.update(dt);
    }
    return c.player.parachute;
  };
  return { c, api: c.api, step, element, notes };
}

export function checkParachuteReserve(t, overrides = {}) {
  const facts = [];
  for (const hz of [30, 60, 120]) {
    const { c, api, step, element, notes } = chuteHost(overrides);
    const held = (seconds, key = 'KeyJ') => { api.down(key); return step(seconds, hz); };
    const release = (seconds = 0.04, key = 'KeyJ') => { api.up(key); return step(seconds, hz); };
    api.fresh();
    let p = held(1);
    t.assert(p.stage === 'freefall' && !p.mainUsed, `${hz} Hz: initial held bailout never opens itself`);
    release(); p = held(7);
    t.assert(p.stage === 'canopy' && p.phase === 'open' && p.canopy === 'main' && !p.reserveUsed, `${hz} Hz: held main pull cannot also cut away`);
    release();
    const before = [c.player.x, c.player.y, c.player.altitude, p.vx, p.vy, p.vz, p.heading];
    api.down('KeyJ');
    t.assert(api.hand(), `${hz} Hz: fresh press releases a fully open main`);
    t.assert(p.stage === 'freefall' && p.opening === 0 && p.mainUsed && !p.reserveUsed && !p.armed, `${hz} Hz: cutaway leaves exactly one unused reserve`);
    t.assert(before.every((value, i) => value === [c.player.x, c.player.y, c.player.altitude, p.vx, p.vy, p.vz, p.heading][i]), `${hz} Hz: cutaway preserves all position, velocity and heading components`);
    const cutRate = p.vz;
    p = held(2);
    t.assert(p.stage === 'freefall' && !p.reserveUsed && p.vz < cutRate - 50, `${hz} Hz: a held cutaway returns to accelerating freefall without automatically deploying reserve`);
    api.ui();
    t.assert(element('freefallCall').textContent.includes('OPEN RESERVE'), `${hz} Hz: freefall cue names the reserve`);
    const reserveForecast = api.cue();
    release(); p = held(0.04);
    t.assert(p.stage === 'canopy' && p.canopy === 'reserve' && p.reserveUsed && p.phase === 'pilot' && p.opening === 0, `${hz} Hz: next fresh press pulls reserve pilot, never instantly creates an inflated wing`);
    const pullAltitude = p.pullAltitude, pullRate = p.pullRate;
    const phases = new Set([p.phase]);
    for (let i = 0; i < hz * 5 && p.phase !== 'open'; i++) {
      step(1 / hz, hz); phases.add(p.phase);
    }
    t.assert(['pilot', 'lines', 'snivel', 'snap', 'open'].every(phase => phases.has(phase)), `${hz} Hz: reserve passes through every real deployment stage`);
    t.assert(p.phase === 'open' && p.openTime > 1.8 && p.openTime < 2.6 && p.peakLoad <= 3.8, `${hz} Hz: reserve opens progressively with bounded harness load`);
    step(1, hz);
    const predicted = api.forecast(pullRate, 0, pullRate, 3.5 * 8, true);
    t.assert(p.safeLost != null && Math.abs(p.safeLost - predicted.need / 8) < 5, `${hz} Hz: reserve forecast and actual safe descent agree`);
    t.assert(!api.cue(), `${hz} Hz: freefall cue hides once reserve flies`);
    const live = p;
    release(); held(0.05);
    t.assert(c.player.parachute === live && p.stage === 'canopy' && p.canopy === 'reserve' && !api.hand(), `${hz} Hz: reserve cannot be cut, duplicated or reset by another press`);
    t.assert(notes.some(note => note.includes('NO MORE CANOPIES')), `${hz} Hz: reserve consumption is explained`);
    c.player.altitude = 2 * 8;
    step(3, hz);
    t.assert(!c.player.parachute && c.player.hp === 100 && c.gameMode === 'play' && api.impacts.at(-1).outcome === 'safe', `${hz} Hz: reserve uses the normal safe-landing/rig cleanup path`);
    api.fresh();
    t.assert(c.player.parachute.canopy === 'main' && !c.player.parachute.mainUsed && !c.player.parachute.reserveUsed && !c.player.parachute.cutaway, `${hz} Hz: a later bailout has a fresh main and one reserve`);
    facts.push({ hz, reserveOpenSeconds: live.openTime, peakLoadG: live.peakLoad, safeLostM: live.safeLost, forecastM: predicted.need / 8, cutawayRateMs: -cutRate / 8, pullRateMs: pullRate / 8, priorReserveCueNeedM: reserveForecast.need / 8, pullAltitudeM: pullAltitude / 8 });
  }

  // A rebound press during main deployment must never cut the half-open wing.
  const { c, api, step, element } = chuteHost(overrides);
  api.fresh(); api.hand(); step(0.9);
  const p = c.player.parachute, deployment = p.deploy;
  t.assert(p.phase === 'lines' && !api.hand() && p.deploy === deployment && !p.cutaway, 'a second pull during deployment cannot cut, restart or skip it');
  step(6); api.hand();
  c.player.altitude = 25 * 8; p.vz = -54 * 8;
  api.hand(); step(3);
  t.assert(!c.player.parachute && c.player.hp === 0 && c.gameMode === 'dead' && api.impacts.at(-1).outcome === 'dead', 'reserve pulled far too low still uses the fatal impact scale');
  api.fresh(); api.bind('bail', 0, 'KeyK', true);
  api.down('KeyJ'); step(0.1);
  t.assert(!c.player.parachute.mainUsed, 'old J no longer deploys after remapping');
  api.up('KeyJ'); step(0.04); api.down('KeyK'); step(6);
  t.assert(c.player.parachute.phase === 'open', 'remapped key deploys main');
  api.up('KeyK'); step(0.04); api.down('KeyK'); step(0.04);
  t.assert(c.player.parachute.stage === 'freefall' && !c.player.parachute.reserveUsed, 'remapped key cuts the open main');
  api.ui();
  t.assert(element('freefallKey').textContent === 'K' && element('freefallCall').textContent.includes('RESERVE'), 'reserve hint follows remapped binding');
  api.up('KeyK'); step(0.04); api.down('KeyK'); step(0.04);
  t.assert(c.player.parachute.canopy === 'reserve' && c.player.parachute.reserveUsed, 'remapped key deploys the single reserve');
  const main = api.forecast(54 * 8), reserve = api.forecast(54 * 8, 0, 54 * 8, 3.5 * 8, true);
  t.assert(main.seconds > 4 && reserve.seconds > 1.5 && reserve.seconds < 3 && reserve.need < main.need, 'terminal-speed reserve is quicker than main, while still taking real time and altitude');
  return facts;
}

export default async function (t) {
  for (const fact of checkParachuteReserve(t)) t.note(JSON.stringify(fact));
}
