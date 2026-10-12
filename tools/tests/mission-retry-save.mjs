// A saved unfinished/failed job remains restartable after reopening the game.
// This restores only the job choice, never its stage, inventory snapshot or world.
import fs from 'node:fs';
import vm from 'node:vm';

export const fresh = true;
export function checkRetrySaves(t) {
  const store = new Map(), noop = () => {};
  const context = vm.createContext({
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    getElement: () => ({ classList: { add: noop, remove: noop } }),
    newGame: noop, player: { godMode: false, armor: 27, hp: 61 }, mouse: { down: false },
    missions: Array.from({ length: 16 }, (_, i) => ({ title: 'Job ' + i, reward: 1000 })),
    DEMO_BUILD: true, SIDE_JOB_FIRST: 11,
    mission: null, completed: 0, missionIndex: 0, cash: 1234, worldMinutes: 1020,
    weapons: Array.from({ length: 6 }, () => ({ owned: true, ammo: 4, clip: 12, reserve: 23 })),
    selectedWeaponIndex: 0, clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    lockpickOwned: () => false, sportsbookSaveData: () => ({}), loadSportsbook: noop,
    snapSunClock: noop, takeLockpick: noop, restoreWeaponSelection: noop,
    hidePoliceNotice: noop, fortCoverReset: noop,
    cleanupMissionExtras: noop, radio: noop, newCallNotice: noop,
    enemies: [], storyActors: [], vehicles: [], announce: noop, tell: noop, updateUI: noop,
  });
  const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  vm.runInContext(read('campaign'), context);
  const story = read('story'), winStart = story.indexOf('    function winMission()');
  vm.runInContext(story.slice(winStart, story.indexOf('    function objective()', winStart)), context);
  const api = vm.runInContext('({ save, load, resetCampaign, winMission, retry: () => retryJobIndex, setRetry: value => { retryJobIndex = value; } })', context);
  const saved = () => JSON.parse(store.get('dead-end-city-v1'));
  const restore = data => {
    store.set('dead-end-city-v1', JSON.stringify(data));
    context.mission = null;
    api.setRetry(null);
    api.load();
    return api.retry();
  };
  for (let index = 0; index < 4; index++) {
    context.completed = context.missionIndex = index;
    context.mission = { index, stage: 3 };
    api.save();
    const s = saved();
    t.assert(s.retryJobIndex === index && s.saveVersion === 12, 'active demo job not saved for restart: ' + index);
    t.assert(!('stage' in s) && !('mission' in s), 'transient mission state entered the save');
    t.assert(restore(s) === index, 'unfinished demo job lost after reload: ' + index);
    t.assert(context.player.hp === 61 && context.player.armor === 27 && context.cash === 1234 &&
      context.weapons[0].ammo === 4 && context.weapons[0].reserve === 23, 'retry save altered inventory, health or cash');
  }
  // A failed completed replay and a pending story job can both be retried; neither
  // lets a regular player reach a future/god-mode job or one beyond the public demo.
  const base = { saveVersion: 12, highestCompleted: 4, missionIndex: 4, cash: 1234 };
  t.assert(restore({ ...base, retryJobIndex: 1 }) === 1, 'completed replay lost its retry');
  context.mission = null;
  api.setRetry(2);
  api.save();
  t.assert(saved().retryJobIndex === 2 && restore(saved()) === 2, 'failed-job retry lost after saving');
  for (const value of [-1, 1.25, '1', null, {}, [], 4, 16, 999999])
    t.assert(restore({ ...base, retryJobIndex: value }) === null, 'invalid or demo-locked retry accepted: ' + JSON.stringify(value));
  t.assert(restore({ ...base, highestCompleted: 0, missionIndex: 0, retryJobIndex: 3 }) === null, 'future story job bypassed unlock gate');
  t.assert(restore({ ...base, saveVersion: 11 }) === null, 'legacy save invented a retry');
  t.assert(context.completed === 4 && context.cash === 1234, 'legacy progress compatibility lost');

  context.completed = context.missionIndex = 0;
  context.mission = { index: 0, stage: 5 };
  api.setRetry(0);
  const cashBefore = context.cash;
  api.winMission();
  t.assert(saved().retryJobIndex === null && restore(saved()) === null, 'completion left a saved retry');
  t.assert(context.cash === cashBefore + 1000, 'completion reward changed');
  api.setRetry(1);
  api.resetCampaign();
  api.save();
  t.assert(saved().retryJobIndex === null && restore(saved()) === null, 'new game left a saved retry');
  t.note('demo 1–4 and replay retry persistence; locked/invalid/legacy saves; completion/new-game clearing; inventory/reward unchanged');
}

export default async function (t) {
  checkRetrySaves(t);
  await t.call('holdSimulation', true);
  try {
    await t.call('startMission', 0);
    await t.call('skipToDepotDelivery');
    const progressed = await t.call('missionState');
    t.assert(progressed.stage >= 3, 'mission fixture did not advance past its beginning');
    await t.call('setAmmo', 0, 4, 23, true);
    await t.call('pauseMenu', true); // the player's normal save path
    await t.reload({ keep: true });
    await t.call('holdSimulation', true);
    t.assert((await t.call('status')).mission === null, 'reload incorrectly restored an active world/stage');
    const restoredSupply = (await t.call('ammoSupply')).weapons[0];
    t.assert(restoredSupply.ammo === 4 && restoredSupply.reserve === 23,
      'reload did not preserve saved ammunition: ' + JSON.stringify(restoredSupply));
    const menu = await t.call('pauseMenu', true);
    t.assert(!menu.restart.disabled, 'reopened game lost its unfinished-job restart');
    await t.call('pauseMenu', false);
    const retried = await t.call('retryMission');
    t.assert(retried.index === 0 && retried.stage === 0 && retried.mode === 'play', 'retry did not restart job 1 from its beginning: ' + JSON.stringify(retried));
    const supply = (await t.call('ammoSupply')).weapons[0];
    // resetMissionState has always restocked owned weapons at job start/retry:
    // the pistol gets its 12-round magazine and at least five spare magazines.
    t.assert(supply.ammo === 12 && supply.reserve === 60,
      'retry changed the existing job-start restock: ' + JSON.stringify(supply));
    t.note('reload kept pistol 4/23; restart began stage zero with the existing 12/60 job-start restock');
  } finally {
    await t.call('holdSimulation', false);
  }
}
