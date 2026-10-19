// Missions 3/4 require stable footing for physical work: a real jump cannot dig or present ID,
// knockdowns interrupt rather than complete an inspection, and swimming/sliding cannot change clothes.
import fs from 'node:fs';
import vm from 'node:vm';

export const fresh = true;
export function checkMission34Footing(t, overrides = {}) {
  const noop = () => {};
  const context = vm.createContext({
    player: { x: 7791, y: 1082, hp: 100, car: null },
    mission: null, gameTime: 10, gameMode: 'play', wantedStars: 0,
    pedestrians: [], storyActors: [], vehicles: [], transitRide: null, taxiRide: null,
    UNITS_PER_METRE: 8, KMH: 8 / 3.6, OFFROAD_TYPES: {}, VINNY_DEPOT: { door: {}, inside: {} },
    FISTS_INDEX: 7, selectedWeaponIndex: 7, militaryAlertUntil: 0,
    SENTINEL: { gate: { armX: 9260 } },
    vehicleSpec: c => ({ l: 34, bike: c.type === 'bike' }),
    isAircraft: c => c.type === 'helicopter', aircraftClearance: c => c.altitude || 0,
    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    headingBetween: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
    actionHeld: () => true, keyName: () => 'E', clearSight: () => true,
    inMilitary: () => false, playerOnRoof: () => false, entityElevation: p => p.altitude || 0,
    withinRange: (_id, d, reach) => d <= reach,
    militaryGuards: () => [{ x: 9236, y: 8160, hp: 100 }],
    militarySpeak: noop, speechMarkTalk: noop, speechReadSeconds: () => 2,
    missionLine: noop, missionBrief: noop, updateUI: noop, noise: noop, tone: noop, tell: noop,
    particle: noop, LOOT_CROUCH: 0.8,
    setStage: (stage, target, instruction) => Object.assign(context.mission, { stage, target, instruction }),
  });
  const read = name => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  vm.runInContext(['vehicle-trunk', 'summitjob', 'fortjob', 'fort-cover', 'fort-cover-records'].map(read).join('\n'), context);
  const api = vm.runInContext('({ updateSummitJob, summitArrived, summitDigging, summitJobInteract, fortChangeSpot, fortKeysOpenTrunk, fortJobInteract, fortCover, fortCoverGateReady, updateFortGate, fortRecordsReady })', context);
  const base = { x: 7791, y: 1082, hp: 100, car: null };
  const resetPlayer = () => { for (const key of Object.keys(context.player)) delete context.player[key]; Object.assign(context.player, base); };
  const summit = () => context.mission = {
    index: 2, stage: 1, cache: { x: 7791, y: 1082 }, dig: 0.3, digSound: 100,
    digKnock: true, beats: {}, instruction: 'DIG UP THE PACKAGE',
  };
  const interruptions = {
    jump: { phase: 'air' }, fall: {}, thrown: { vehicleHit: true }, tumble: {},
    swimming: true, wading: true, pool: {}, climbing: true, carjack: {},
    parachute: {}, coaster: {}, roof: true, buildingRoof: {}, sceneSeat: {},
  };
  for (const [kind, value] of Object.entries(interruptions)) {
    resetPlayer();
    const m = summit();
    context.player[kind] = value;
    context.player.digUntil = context.gameTime + 1;
    api.updateSummitJob(m, 0.5);
    t.assert(m.dig === 0.3 && !api.summitDigging() && context.player.digUntil === 0,
      kind + ' advanced the cache dig or kept the kneeling pose: ' + m.dig);
    t.assert(!api.summitArrived() && !api.summitJobInteract(), kind + ' counted as a grounded summit interaction');
    t.assert(!api.fortChangeSpot(), kind + ' allowed changing clothes');
    delete context.player[kind];
    api.updateSummitJob(m, 0.5);
    t.near(m.dig, 0.366, 0.367, kind + ': grounded dig resumes with its earlier progress');
  }
  resetPlayer();
  for (const flags of [{ cliffAir: {} }, { overturned: true }]) {
    context.player.car = { type: 'hilux', speed: 0, ...flags };
    t.assert(!api.summitArrived(), 'an airborne/overturned truck counted as a summit landing');
  }
  for (const velocity of [{ vx: 80, vy: 40 }, { vx: 0, vy: 5 }]) {
    context.player.car = { type: 'sedan', speed: 0, ...velocity };
    t.assert(!api.fortChangeSpot(), 'a sliding car allowed changing clothes: ' + JSON.stringify(velocity));
  }
  for (const flags of [{ cliffAir: {} }, { overturned: true }, { sinkFor: 0.2 }, { type: 'bike' }, { type: 'helicopter' }]) {
    context.player.car = { type: 'sedan', speed: 0, vx: 0, vy: 0, ...flags };
    t.assert(!api.fortChangeSpot(), 'an unsafe/non-cabin vehicle allowed changing clothes: ' + JSON.stringify(flags));
  }
  context.player.car = { type: 'sedan', speed: 0, vx: 0, vy: 0 };
  t.assert(api.fortChangeSpot(), 'a parked sedan no longer allows changing');

  // The keys and the bag require the same footing; this uses the production trunk point/open path.
  for (const kind of ['jump', 'fall', 'thrown', 'swimming']) {
    resetPlayer();
    context.player[kind] = interruptions[kind];
    const c = { x: base.x + 21.5, y: base.y, a: 0, hp: 100, trunkOpen: false };
    const m = context.mission = { index: 3, stage: 3, keys: true, kcar: c };
    t.assert(!api.fortKeysOpenTrunk() && !c.trunkOpen, kind + ' opened the trunk with keys');
    c.trunkOpen = true;
    m.stage = 4;
    t.assert(!api.fortJobInteract() && !m.bag, kind + ' recovered the uniform');
    delete context.player[kind];
    t.assert(api.fortJobInteract() && m.bag && m.stage === 5, 'grounded bag recovery failed after ' + kind);
  }

  resetPlayer();
  for (const state of [{ speed: 20 }, { vx: 20 }, { altitude: 20 }]) {
    const c = { x: base.x + 21.5, y: base.y, a: 0, hp: 100, trunkOpen: false, ...state };
    const m = context.mission = { index: 3, stage: 3, keys: true, kcar: c };
    t.assert(!api.fortKeysOpenTrunk() && !c.trunkOpen, 'moving/off-level trunk opened: ' + JSON.stringify(state));
    c.trunkOpen = true; m.stage = 4;
    t.assert(!api.fortJobInteract() && !m.bag, 'moving/off-level uniform recovered: ' + JSON.stringify(state));
  }

  // Stand at the papers window and interrupt a nearly complete inspection without moving away.
  context.mission = null;
  resetPlayer();
  Object.assign(context.player, { x: 9236, y: 8182, uniform: 'army' });
  Object.assign(api.fortCover, { active: true, cleared: false, inspect: null, alarmed: false });
  t.assert(api.fortCoverGateReady(), 'normal grounded ID exchange is unavailable');
  context.player.jump = { phase: 'air' };
  t.assert(!api.fortCoverGateReady(), 'ID exchange started during a jump');
  delete context.player.jump;
  api.fortCover.inspect = { t: 16.3 };
  context.player.thrown = { vehicleHit: true };
  api.updateFortGate(0.2);
  t.assert(api.fortCover.inspect === null && !api.fortCover.cleared, 'a knockdown completed the ID exchange');
  delete context.player.thrown;
  Object.assign(api.fortCover, { cleared: true, papers: false });
  Object.assign(context.player, { x: 9884, y: 8050 });
  t.assert(api.fortRecordsReady(), 'normal grounded records entry is unavailable');
  context.player.fall = {};
  t.assert(!api.fortRecordsReady(), 'records entry started while falling');
  t.note('production rules retain partial dig across 14 interruptions; reject unstable car changing, airborne loot/ID/records and knocked-down inspection completion');
}

export default async function (t) {
  checkMission34Footing(t);
  await t.call('holdSimulation', true);
  await t.call('god', false);
  try {
    await t.call('summitSkip', 'summit');
    await t.keys(['Jump', 'KeyE'], 0.2);
    const jump = await t.call('jumpReport');
    let m = await t.call('summitJob');
    t.assert(jump.state?.phase === 'air' && m.dig === 0 && !m.digging,
      'jump plus held interact dug the cache: ' + JSON.stringify({ jump, m }));
    await t.wait(1);
    await t.keys('KeyE', 0.5);
    m = await t.call('summitJob');
    t.assert(m.dig > 0.04 && m.digging, 'landing did not restore the real held dig action');
    await t.wait(0.5);

    // Gate fixture only places the player in uniform; real jump and interact input must be rejected until landing.
    await t.call('fortSkip', 'changed');
    await t.call('teleport', 9236, 8182);
    await t.keys('Jump', 0.2);
    await t.keys('KeyE', 0.2, { real: true });
    let cover = await t.call('fortCover');
    t.assert(cover.inspecting === null && !cover.cleared, 'jumping at the window started the ID inspection');
    await t.wait(1);
    await t.keys('KeyE', 0.2, { real: true });
    cover = await t.call('fortCover');
    t.assert(cover.inspecting !== null, 'landing did not restore the real ID action');
    t.note('climb/drive bypassed with named fixtures; virtual jump action + held E cannot dig airborne, landed E resumes, actual E at window waits for jump landing');
  } finally {
    await t.call('holdSimulation', false);
  }
}
