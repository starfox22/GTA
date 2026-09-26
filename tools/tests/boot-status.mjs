// The game boots into free roam with the city populated, and stats()/status() report
// finite numbers (no NaN) after a few simulated seconds.
export default async function (t) {
  const s = await t.call('status');
  t.assert(s.mode === 'play', 'mode ' + s.mode);
  t.assert(s.vehicles > 50 && s.pedestrians > 100, `thin city: ${s.vehicles} vehicles, ${s.pedestrians} people`);
  await t.wait(3);
  const stats = await t.call('stats');
  t.finite(stats, 'stats');
  t.assert(stats.frames > 0, 'no frames ran');
  t.finite(await t.call('status'), 'status');
}
