// Production bindings, saved-default migration, settings/help rows and independent keyboard/pad/touch rider inputs.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
function productionFunction(file, name) {
  const source = read(file), start = source.indexOf('    function ' + name + '('), end = source.indexOf('\n    }', start);
  if (start < 0 || end < 0) throw Error('Missing production function ' + file + ':' + name);
  return source.slice(start, end + 6);
}
class Element {
  constructor(tag = 'div', text = '') {
    this.tagName = tag.toUpperCase(); this.textContent = text; this.children = []; this.dataset = {}; this.style = {};
    this.classList = { contains: () => false, toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}
function fixture(saved = null, blocked = false) {
  const stored = new Map(saved ? [['dead-end-city-controls', JSON.stringify(saved)]] : []), elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  let api;
  const scope = vm.createContext({
    keys: {}, player: { car: { type: 'bike' } }, gameMode: 'play', hudSeen: { keys: '' }, settingsClash: null, settingsListen: null,
    UNITS_PER_METRE: 8, navigator: {}, performance, mouse: {}, touchAim: null,
    localStorage: { getItem(k) { if (blocked) throw Error('blocked'); return stored.get(k) ?? null; }, setItem(k, v) { stored.set(k, v); } },
    window: { addEventListener() {}, dispatchEvent(e) { if (e.type === 'keydown') api.press(e.code); else api.release(e.code); } },
    KeyboardEvent: class { constructor(type, values) { this.type = type; Object.assign(this, values); } },
    document: { body: new Element('body'), createElement: tag => new Element(tag) },
    getElement, isAircraft: c => ['plane', 'helicopter'].includes(c?.type),
    vehicleSpec: c => ({ bike: ['bike', 'bicycle', 'dolcati'].includes(c?.type) }),
    chaseCameraLive: () => false, roofPartyPace: () => false, fortCoverPace: () => false,
    initAudio() {}, updateTouchUI() {}, renderSettings() {}, tell() {},
    settingsElement: (tag, cls, text = '') => new Element(tag, text),
  });
  const mobile = read('mobile'), touchPrefix = mobile.slice(0, mobile.indexOf('    for (const [id, aiming]'));
  api = vm.runInContext(read('controls') + read('input-hints') + read('gamepad') + touchPrefix +
    productionFunction('mobile', 'touchButtonLabel') + productionFunction('settings', 'renderKeyBindings') +
    productionFunction('settings', 'bindingSlot') + productionFunction('hud-state', 'renderControlsHelp') +
    productionFunction('hud-state', 'hintKey') + productionFunction('parachute', 'parachuteSinkRate') + `
      ({ bindings: () => JSON.parse(JSON.stringify(controlBindings)), actions: CONTROL_ACTION,
        held: actionHeld, lift: wheelieHeld, lower: wheelieLowerHeld, code: actionCode, keyName, hintKey,
        press: code => holdActions(pressControlKey(code)), release: releaseControlKey,
        clear: () => { keys = {}; releaseAllControlKeys(); }, bind: bindControl, reset: resetControlBindings,
        context: controlContext, sink: parachuteSinkRate, setDevice: setHintDevice,
        pad: (y, gas = false, brake = false) => { const down = Array(16).fill(false); down[7] = gas; down[6] = brake; padPlay(down, () => false, 0, y, 0, 0); },
        touch: y => { syncTouchInput(); touchSticks.set(1, { aim: false }); moveTouchStick({ pointerId: 1, clientX: 50, clientY: 50 + y, preventDefault() {} }); },
        touchGas: () => holdTouch({ pointerId: 2, preventDefault() {} }, [actionCode('forward')]),
        clearTouch: clearTouchInput, enableTouch: () => { touchMode = 'on'; }, renderBindings: renderKeyBindings, renderHelp: renderControlsHelp })`, scope);
  return { api, scope, stored, getElement };
}
export default async function wheelieBindings(t) {
  const same = (got, want, label) => t.assert(JSON.stringify(got) === JSON.stringify(want), label + ': ' + JSON.stringify(got));
  const { api, scope, stored, getElement } = fixture();
  same(api.bindings().forward, ['KeyW', null], 'fresh forward default');
  same(api.bindings().back, ['KeyS', null], 'fresh brake default');
  for (const [id, key] of [['wheelieUp', 'ArrowUp'], ['wheelieDown', 'ArrowDown']]) {
    same(api.bindings()[id], [key, null], id + ' default');
    t.assert(api.actions[id].group === 'vehicle' && api.actions[id].ctx.join() === 'drive', id + ' is not a vehicle action');
    t.assert(api.code(id) !== key, id + ' aliases a legacy movement code');
  }
  const old = fixture({ forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], horn: ['KeyU', null] }).api.bindings();
  same(old.forward, ['KeyW', null], 'saved default forward migration');
  same(old.back, ['KeyS', null], 'saved default brake migration');
  same(old.horn, ['KeyU', null], 'unrelated custom action');
  for (const [id, normal, arrow] of [['forward', 'KeyW', 'ArrowUp'], ['back', 'KeyS', 'ArrowDown']]) {
    for (const slots of [[normal, null], [normal, 'KeyI'], ['KeyI', arrow], [arrow, normal], [null, arrow], [arrow, null], [null, null]])
      same(fixture({ [id]: slots }).api.bindings()[id], slots, 'preserve custom ' + id);
  }
  same(fixture(null, true).api.bindings().forward, ['KeyW', null], 'blocked storage default');
  api.press('ArrowUp');
  t.assert(api.lift() && !api.held('forward') && !api.held('back'), 'Up operates a pedal');
  api.press('KeyW'); api.press('ArrowDown');
  t.assert(api.lower() && !api.lift() && api.held('forward') && !api.held('back') && !api.held('handbrake'), 'forward weight cuts throttle or applies a brake');
  api.release('ArrowDown');
  t.assert(api.lift() && api.held('forward'), 'releasing Down loses Up or throttle');
  api.clear(); api.press('KeyS'); api.press('Space');
  t.assert(api.held('back') && api.held('handbrake') && !api.lower(), 'brakes impersonate forward weight');
  api.clear(); api.press('KeyT'); api.press('KeyG');
  t.assert(!api.lift() && !api.lower(), 'aircraft controls still move rider weight');
  api.clear();
  t.assert(!api.bind('wheelieUp', 0, 'KeyW'), 'remapping silently steals the throttle key');
  same(api.bindings().forward, ['KeyW', null], 'refused binding preserves throttle');
  t.assert(api.bind('wheelieUp', 0, 'KeyW', true), 'explicit settings key swap failed');
  api.press('KeyW');
  t.assert(api.lift() && !api.held('forward'), 'swapped weight key still operates the throttle');
  api.press('ArrowUp');
  t.assert(api.held('forward'), 'swapped throttle key no longer works');
  api.reset();
  t.assert(api.bind('wheelieUp', 0, 'KeyU') && api.bind('wheelieDown', 0, 'KeyY'), 'weight controls are not independently remappable');
  api.press('KeyW'); api.press('KeyU');
  t.assert(api.lift() && api.held('forward'), 'remapped lift lost throttle');
  api.press('KeyY');
  t.assert(api.lower() && !api.lift() && api.held('forward') && !api.held('back'), 'remapped forward weight changed throttle');
  api.clear(); api.press('ArrowUp'); api.press('ArrowDown');
  t.assert(!api.lift() && !api.lower() && !api.held('forward') && !api.held('back'), 'unbound arrows fall through to old rider or movement codes');
  same(fixture(JSON.parse(stored.get('dead-end-city-controls'))).api.bindings().wheelieDown, ['KeyY', null], 'custom rider binding saved/reloaded');
  api.reset(); api.clear();
  scope.player.car = { type: 'plane' }; api.press('ArrowUp');
  t.assert(api.held('ascend') && !api.held('forward') && api.context() === 'air', 'aircraft arrow now operates throttle');
  api.clear(); api.press('KeyW'); api.press('ArrowDown');
  t.assert(api.held('forward') && api.held('descend') && !api.held('back'), 'aircraft nose-down cuts throttle');
  api.clear(); scope.player.car = null; scope.player.parachute = {};
  api.press('ArrowUp'); t.assert(api.sink() === 4.2 * 8, 'canopy glide arrow stopped working');
  api.clear(); api.press('ArrowDown'); t.assert(api.sink() === 2.1 * 8, 'canopy flare arrow stopped working');
  api.clear(); api.press('KeyW'); t.assert(api.sink() === 4.2 * 8, 'canopy W stopped working');
  api.clear(); api.press('KeyS'); t.assert(api.sink() === 2.1 * 8, 'canopy S stopped working');
  api.clear(); scope.player.parachute = null; scope.player.car = { type: 'bike' };
  api.setDevice('gamepad');
  t.assert(api.keyName('wheelieUp') === 'L-STICK ↑' && api.keyName('wheelieDown') === 'L-STICK ↓', 'pad hints name aircraft or brakes');
  api.pad(-1, true); t.assert(api.lift() && api.held('forward') && !api.held('back'), 'pad lift/throttle');
  api.pad(1, true); t.assert(api.lower() && api.held('forward') && !api.held('back'), 'pad forward weight operates brake');
  api.pad(0, false, true); t.assert(api.held('back') && !api.lower(), 'pad brake operates forward weight');
  api.pad(0); api.clear(); api.enableTouch(); api.setDevice('touch');
  t.assert(api.keyName('wheelieUp') === 'STEER ↑' && api.keyName('wheelieDown') === 'STEER ↓', 'touch hints name aircraft or brake');
  api.touch(-40); t.assert(api.lift() && !api.held('forward'), 'touch rider lean operates gas');
  api.touchGas(); api.touch(40);
  t.assert(api.lower() && api.held('forward') && !api.held('back') && !api.held('handbrake'), 'touch forward weight operates brake or cuts gas');
  api.clearTouch(); api.reset(); api.setDevice('keyboard');
  const body = new Element(); api.renderBindings(body);
  for (const id of ['wheelieUp', 'wheelieDown']) {
    const row = body.children.find(el => el.dataset?.row === id);
    t.assert(row && row.children[1].children.length === 2, id + ' missing from settings or lacks both remapping slots');
    row.children[1].children[0].onclick();
    t.assert(scope.settingsListen.id === id && scope.settingsListen.slot === 0, id + ' settings slot cannot listen');
  }
  api.renderHelp();
  const vehicleHelp = getElement('controlGrid').children.find(el => el.children[0].textContent === 'VEHICLES');
  t.assert(vehicleHelp.children.some(row => row.children?.[1]?.textContent.includes('shift your weight back')), 'help omits rearward weight');
  t.assert(vehicleHelp.children.some(row => row.children?.[1]?.textContent.includes('shift your weight forward')), 'help omits forward weight');
  t.assert(api.hintKey('wheelie') === 'W+↑' && api.hintKey('wheelieDown') === '↓', 'HUD keys still use climb/brake names');
  t.note('Saved defaults migrate without altering custom bindings; production keyboard/pad/touch and settings/help keep rider weight separate from throttle/brake.');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let checks = 0;
  await wheelieBindings({ assert(value, message) { checks++; assert.ok(value, message); }, note: console.log });
  console.log('PASS wheelie-bindings: ' + checks + ' host assertions');
}
