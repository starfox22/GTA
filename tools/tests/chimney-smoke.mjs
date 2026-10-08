// The mountain chimneys' wood smoke (chimney-smoke3d.js, console chimneySmoke): null without WebGL; with it, at the
// 4x4 club the club's chimney is listed and smokes, no more plumes than the tier's cap, a rate within its limits
// (puffs a fixed spacing apart in the wind), finite numbers, more fires at night, and the effect pool drops nothing.
export const fresh = true;
export default async function (t) {
  const first = await t.call('chimneySmoke');
  if (first === null) return; // the no-render page: no renderer
  await t.call('holdSimulation', true);
  try {
    await t.call('god', true);
    await t.call('graphics', 'high');
    await t.call('setClock', 9);
    // The Ridgeline 4x4 club's yard (offroad-trails.js OFFROAD_CLUB: the lot from 8464, 2654).
    await t.call('teleport', 8620, 2980);
    const pool = await t.call('effectParticles');
    await t.call('hitchRun', 0.3, [], 1, false, true);
    const day = await t.call('chimneySmoke');
    t.finite(day, 'chimneySmoke');
    t.assert(day.club, 'the club chimney is listed: ' + JSON.stringify(day));
    t.assert(day.chimneys > 1 && day.lit >= 1 && day.lit < day.chimneys, 'a share of the fires burn by day: ' + JSON.stringify(day));
    t.assert(day.emitting >= 1 && day.emitting <= day.cap, 'the nearest burning chimneys smoke, at most the cap: ' + JSON.stringify(day));
    t.near(day.rate, 1.6, 6, 'puffs a second per plume');
    t.assert(day.seeded > 0 && day.puffs.live > 0, 'plumes seeded whole and alive: ' + JSON.stringify(day));
    t.assert(day.puffs.highest > day.nearest.height + 24, 'a seeded plume reaches metres above its pot: ' + JSON.stringify(day.puffs));
    t.assert(day.sizeMetres[0] < 0.6 && day.sizeMetres[1] > 2.5, 'a thin thread at the pot, wide at the top: ' + JSON.stringify(day));
    const after = await t.call('effectParticles');
    t.assert(after.dropped === pool.dropped, 'the pool drops nothing: ' + JSON.stringify(after));
    // More fires at night.
    await t.call('setClock', 22);
    await t.call('hitchRun', 0.2, [], 1, false, true);
    const night = await t.call('chimneySmoke');
    t.assert(night.lit > day.lit, 'more fires at night: ' + JSON.stringify(night));
  } finally {
    await t.call('holdSimulation', false);
  }
}
