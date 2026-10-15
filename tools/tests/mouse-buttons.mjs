// Execute the real input listeners: the two mouse buttons must release independently,
// and focus/menu transitions must discard held fire and aim even if mouseup was lost.
// A small DOM fixture makes the simultaneous-button and hidden-tab cases deterministic.
import fs from 'node:fs';
import vm from 'node:vm';

export default async function (t) {
  const events = {}, elements = new Map();
  const noop = () => {};
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set(['hidden']);
      elements.set(id, {
        classList: {
          contains: name => classes.has(name),
          add: name => classes.add(name),
          remove: name => classes.delete(name),
          toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
        },
        focus: noop, replaceChildren: noop, appendChild: noop,
        querySelector: () => ({ scrollTop: 0 }),
      });
    }
    return elements.get(id);
  }
  const register = scope => (name, handler) => { events[scope + ':' + name] = handler; };
  const context = vm.createContext({
    window: { addEventListener: register('window') },
    document: { addEventListener: register('document'), hidden: false, createElement: () => ({}) },
    canvas: { addEventListener: register('canvas'), focus: noop },
    getElement: element,
    performance: { now: () => 100 }, worldTouchUntil: 0,
    gameMode: 'play', keys: {}, mouse: { down: false, alt: false }, gpuContext: { lost: false, reloadPending: false },
    chaseCam: { locked: false }, chaseCameraLive: () => false,
    initAudio: noop, shoot: noop, syncCarRadio: noop,
    physicalHeld: true,
    releaseAllControlKeys() { context.physicalHeld = false; },
    mute: noop, applySoundLabels: noop, closeTaxiOffer: noop, retryMission: noop,
    closeSportsbook: noop, save: noop, restartableJob: () => null,
    mapOpen: false, DEMO_BUILD: true, DEMO_MISSIONS: 4, completed: 0, cash: 0,
    player: { godMode: false }, captureChasePointer: noop,
    renderControlsHelp: noop, clearMapGesture: noop, clearTouchInput: noop,
    rideSkipActive: () => false, cancelTaxiPick: noop, godMapToggled: noop,
    prepareCityMap: noop, drawMap: noop, cityMapContext: {}, taxiPicking: false,
  });
  for (const name of ['game-menus', 'game-input'])
    vm.runInContext(fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'), context);
  const emit = (scope, name, button) => events[scope + ':' + name]({ button, clientX: 20, clientY: 30 });
  function holdBoth() {
    context.gameMode = 'play';
    emit('canvas', 'mousedown', 2);
    emit('canvas', 'mousedown', 0);
    t.assert(context.mouse.down && context.mouse.alt, 'both mouse buttons did not engage');
  }
  holdBoth();
  emit('window', 'mouseup', 0);
  t.assert(!context.mouse.down && context.mouse.alt, 'releasing left fire cancelled held right aim');
  emit('canvas', 'mousedown', 0);
  emit('window', 'mouseup', 2);
  t.assert(context.mouse.down && !context.mouse.alt, 'releasing right aim cancelled held left fire');
  emit('canvas', 'mousedown', 2);
  emit('window', 'mouseup', 1);
  t.assert(context.mouse.down && context.mouse.alt, 'releasing middle mouse cancelled fire or aim');

  for (const mode of ['play', 'help']) {
    holdBoth();
    context.gameMode = mode;
    context.keys = { KeyW: true };
    context.physicalHeld = true;
    emit('window', 'blur');
    t.assert(!context.mouse.down && !context.mouse.alt, 'blur left a firing button held in ' + mode);
    t.assert(!context.keys.KeyW && !context.physicalHeld, 'blur left keyboard input held');
    t.assert(context.gameMode === (mode === 'play' ? 'pause' : mode), 'blur changed the wrong mode');

    holdBoth();
    context.gameMode = mode;
    context.keys = { KeyW: true };
    context.physicalHeld = true;
    context.document.hidden = true;
    emit('document', 'visibilitychange');
    t.assert(!context.mouse.down && !context.mouse.alt, 'hidden tab left a firing button held in ' + mode);
    t.assert(!context.keys.KeyW && !context.physicalHeld, 'hidden tab left keyboard input held');
    t.assert(context.gameMode === (mode === 'play' ? 'pause' : mode), 'hidden tab changed the wrong mode');
    context.document.hidden = false;
  }
  for (const menu of ['togglePause', 'openHelp', 'toggleMap']) {
    holdBoth();
    context[menu]();
    t.assert(!context.mouse.down && !context.mouse.alt, menu + ' retained a held firing button');
  }
  t.note('real input listeners: independent left/right/middle release; blur and hidden tab in play/help; pause/help/map clear both buttons');
}
