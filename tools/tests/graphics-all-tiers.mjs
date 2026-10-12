// Exercise the actual renderer in both cameras on every user-selectable graphics setting.
// Counts are useful on software GL; its wall-clock FPS is not a laptop benchmark.
export default async function (t) {
  if ((await t.call('renderHiccups')) === null) t.skip('Requires WebGL: run with --render');
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    await t.call('settings', { touch: 'off' });
    await t.call('setClock', 12);
    await t.call('sky', 'clear');
    await t.call('teleport', 1152, 1160);
    for (const tier of ['low', 'medium', 'high', 'ultra', 'auto']) {
      await t.call('graphics', tier);
      for (const view of ['street', 'chase']) {
        await t.call('viewMode', view);
        await t.wait(0.2);
        if (view === 'chase') await t.call('chaseLook', 0, 0, 180, 4);
        await t.call('hitchRun', 0.05, [], 3, false, true);
        const quality = await t.call('graphics');
        const profile = await t.call('drawProfile', 3);
        t.assert(quality.setting === tier && (tier === 'auto' || quality.tier === tier.toUpperCase()), 'graphics setting did not apply: ' + JSON.stringify(quality));
        t.assert(profile.total > 0 && profile.triangles > 0, `${tier}/${view}: no visible geometry`);
        t.finite(profile, `${tier}/${view}`);
        t.note(JSON.stringify({ tier, view, activeTier: quality.tier, scale: quality.renderScale, draws: profile.total, triangles: profile.triangles }));
      }
    }
  } finally {
    await t.call('graphics', 'low');
    await t.call('viewMode', 'street');
    await t.call('settings', { touch: 'auto' });
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
