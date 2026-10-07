// The effect particle pool (fx3d-particles.js, console effectParticles): null without WebGL; with it a blast fills the
// pool (flash, fireball, sparks now, the smoke column waiting on its delays), draws it in one call, drops nothing,
// and the atlas is baked.
export const fresh = true;
export default async function (t) {
  const before = await t.call('effectParticles');
  if (before === null) {
    // The no-render page: no renderer, no pool.
    return;
  }
  t.finite(before, 'effectParticles');
  await t.call('holdSimulation', true);
  try {
    const status = await t.call('status');
    // A rocket's worth, 30 m east of the player (god mode: the blast must not end the test).
    await t.call('god', true);
    await t.call('blast', status.x + 240, status.y, 1);
    // Two drawn frames: the pool steps and draws.
    await t.call('hitchRun', 2 / 60, [], 3, false, true);
    const after = await t.call('effectParticles');
    t.finite(after, 'effectParticles after a blast');
    t.assert(after.atlas.baked, 'the atlas is baked: ' + JSON.stringify(after.atlas));
    t.assert(after.live - before.live >= 30, 'a blast spawns its fireball, sparks and column: ' + JSON.stringify(after));
    t.assert(after.waiting > 0, 'the smoke column waits on its delays: ' + JSON.stringify(after));
    t.assert(after.drawn > 0 && after.drawCalls === 1, 'drawn in one call: ' + JSON.stringify(after));
    t.assert(after.dropped === before.dropped, 'nothing dropped: ' + JSON.stringify(after));
  } finally {
    await t.call('holdSimulation', false);
  }
}
