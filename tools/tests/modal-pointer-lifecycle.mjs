// Actual modal entry/exit functions release held firing/aiming buttons together,
// while rejected entries leave the current play input and mission untouched.
import fs from 'node:fs';
import vm from 'node:vm';

function productionFunction(file, name) {
  const source = fs.readFileSync(new URL('../../src/' + file + '.js', import.meta.url), 'utf8');
  const begin = source.indexOf('    function ' + name + '(');
  const end = source.indexOf('\n    }', begin);
  if (begin < 0 || end < 0) throw Error('Missing production function ' + file + ':' + name);
  return source.slice(begin, end + 6);
}

export default async function (t) {
  const cases = [
    ['arsenal', 'openArsenal', 'play', 'arsenal', []],
    ['arsenal', 'closeArsenal', 'arsenal', 'play', []],
    ['campaign', 'showDemoComplete', 'play', 'demo', []],
    ['campaign', 'clearMissionOverlays', 'play', 'play', []],
    ['campaign', 'openMissionSelect', 'play', 'missions', []],
    ['story', 'showDialogue', 'play', 'dialogue', ['vinny', 'Call', 'Message', null]],
    ['story', 'travelRoof', 'play', 'elevator', [true]],
    ['settings', 'openSettings', 'pause', 'settings', ['controls']],
    ['citylife-places', 'openService', 'play', 'service', [{ kind: 'diner' }]],
    ['transit-network', 'openTransit', 'play', 'transit', [{ name: 'Central' }]],
    ['taxi', 'openTaxiOffer', 'play', 'taxi', [{ driverFemale: false }]],
    ['sportsbook-ui', 'openSportsbook', 'play', 'play', []],
    ['dealership-lot', 'openDealerMenu', 'play', 'dealer', [null, 'browse']],
  ];
  const noop = () => {};
  function fixture(mode) {
    const nodes = new Map();
    const node = () => ({ children: [], style: {}, classList: { add: noop, remove: noop, toggle: noop },
      focus: noop, setAttribute: noop, querySelector: () => null,
      appendChild(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; } });
    const getElement = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
    const context = vm.createContext({ Math, gameMode: mode, mouse: { down: true, alt: true },
      keys: { KeyW: true, KeyF: true }, player: { car: null, godMode: false, hp: 83, inv: 0 },
      mission: null, completed: 0, missionIndex: 0, cash: 1234, wantedStars: 0, gameTime: 0,
      getElement, document: { createElement: node, body: node() }, canvas: { focus: noop },
      updateUI: noop, clearTouchInput: noop, renderArsenal: noop, hidePoliceNotice: noop,
      DEMO_BUILD: true, DEMO_MISSIONS: 4, SIDE_JOB_FIRST: 11,
      campaignStats: { playSeconds: 120, cashEarned: 0, wantedPeak: 0 },
      playTimeText: () => '2m', clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
      mapOpen: false, toggleMap: noop, missions: Array.from({ length: 16 }, (_, i) => ({ title: 'Job' + i, reward: 1000, contact: 'vinny' })),
      missionUnlocked: i => i === 0, demoLocked: i => i >= 4, missionPickerTitle: () => 'Job', renderGodWorld: noop, showDemoBuyNote: noop,
      CHARACTERS: { vinny: { name: 'Vinny Moretti', role: 'Contact' } }, setContactPortrait: noop, menuKeySuffix: () => '',
      rooftopJob: () => null, tell: noop, needToLosePolice: noop, tone: noop,
      syncGodSettingsTab: noop, renderSettings: noop, focusSettingsTab: noop,
      renderService: noop, RAIL_STATIONS: [], keyName: () => 'E',
      beginTaxiPick: noop, closeTaxiOffer: noop, startCarjack: noop,
      sportsbook: { open: false, stake: 10 }, sportsbookUi: {}, renderSportsbook: noop,
      syncPanelCover: noop, initAudio: noop, sportsBookAllowed: () => true,
      dealer: {}, dealerBrowseList: () => [], cameraTarget: { x: 0, y: 0 }, worldZoom: 1,
      ensureDealerOverlay: node, frameDealerMenu: noop, renderDealerMenu: noop, dealershipSalesPitch: noop,
    });
    return context;
  }
  for (const [file, name, beforeMode, afterMode, args] of cases) {
    const context = fixture(beforeMode), source = productionFunction(file, name);
    vm.runInContext(source, context);
    context[name](...args);
    t.assert(context.gameMode === afterMode, name + ': fixture did not enter/leave the real modal');
    t.assert(!context.mouse.down && !context.mouse.alt, name + ': modal retained held fire/aim');
    t.assert(!context.keys.KeyW && !context.keys.KeyF, name + ': modal retained keyboard input');
    t.assert(context.player.hp === 83 && context.cash === 1234 && context.mission === null,
      name + ': input reset changed health, cash or mission');
  }
  for (const [file, name, mode] of [['arsenal', 'openArsenal', 'pause'], ['arsenal', 'closeArsenal', 'play'],
    ['campaign', 'openMissionSelect', 'dialogue'], ['settings', 'openSettings', 'play']]) {
    const context = fixture(mode); vm.runInContext(productionFunction(file, name), context); context[name]();
    t.assert(context.gameMode === mode && context.mouse.down && context.mouse.alt && context.keys.KeyW,
      name + ': rejected modal transition discarded active input');
  }
  t.note('13 production modal transitions release both buttons; rejected entries preserve input and campaign state');
}
