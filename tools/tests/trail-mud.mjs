// The 4x4 trail mud (offroad3d-mud.js TRAIL MUD): a pickup spinning up THE BOG throws clods, spray sprites, fine
// drops and mist into the effect pool and lays ruts and splats, all within the tier's caps, with the trail-mud
// sheet loaded; LOW keeps its smaller caps. Needs WebGL (run with --render): skipped otherwise.
export const fresh = true;

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('teleport', 7520, 1950);
    await t.call('drive', 'hilux');
    const first = await t.call('offroad');
    if (!first || first.effects === null) t.skip('Requires WebGL: run with --render');
    for (const tier of ['high', 'low']) {
      await t.call('graphics', tier);
      await t.call('hillClimb', 'at0.036', 0);
      await t.call('mud', 0.8, 1);
      // Two drawn frames: the view comes to the truck and its model is posed (the mud is thrown from drawn models).
      await t.call('hitchRun', 2 / 60, [], 3, false, true);
      const pool = await t.call('effectParticles');
      const e = await t.call('trailMud', 2.5, ['KeyW']);
      t.finite(e, `trailMud on ${tier}`);
      t.assert(e.textures, 'the trail-mud sheet is loaded');
      t.assert(e.clumps <= e.tier.clumps && e.clumps <= e.capacity.clumps, `${tier}: ${e.clumps} clods over the cap ${e.tier.clumps}`);
      t.assert(e.spray <= e.capacity.spray, `${tier}: ${e.spray} spray sprites over the pool`);
      t.assert(e.tracks > 0, `${tier}: no ruts laid: ${JSON.stringify(e)}`);
      t.assert(e.clumps + e.splats > 0 && e.drops > 0 && e.puffs > 0, `${tier}: the tyres threw nothing: ${JSON.stringify(e)}`);
      if (tier === 'high') t.assert(e.spray > 0, `high: no spray sprites: ${JSON.stringify(e)}`);
      const after = await t.call('effectParticles');
      t.finite(after, 'effectParticles');
      t.assert(after.live <= after.capacity, 'the effect pool overflowed');
      t.note(`${tier}: clods ${e.clumps}/${e.tier.clumps}, spray ${e.spray}, splats ${e.splats}, ruts ${e.tracks}, drops ${e.drops}, puffs ${e.puffs}; pool ${pool.live} -> ${after.live}, dropped ${after.dropped - pool.dropped}`);
    }
  } finally {
    await t.call('graphics', 'high');
    await t.call('holdSimulation', false);
  }
}
