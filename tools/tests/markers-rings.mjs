// Markers: no ring or light pool at an objective (the floating arrow only), the ring under the
// player is a setting that is off by default, and on the Blue Hour nothing rings the glass or
// points at Vescari while the spiked glass works.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    let s = await t.call('settings');
    t.assert(s.playerRing === false, 'player ring should default to off: ' + s.playerRing);

    // A mission target: the arrow, never a ring.
    await t.call('startMission', 0);
    await t.wait(0.5);
    let k = await t.call('markers');
    t.assert(k.target, 'mission 1 has no target: ' + JSON.stringify(k));
    t.assert(k.objectiveArrow === true && k.objectiveRing === false, 'objective markers: ' + JSON.stringify(k));
    t.assert(k.playerRing === false, 'player ring on by default');

    // The setting, through the console.
    await t.call('settings', { playerRing: true });
    s = await t.call('settings');
    t.assert(s.playerRing === true, 'playerRing did not turn on');
    t.assert((await t.call('markers')).playerRing === true, 'report ignores the setting');
    await t.call('settings', { playerRing: false });
    t.assert((await t.call('markers')).playerRing === false, 'playerRing did not turn off');

    // Blue Hour: before the spike the arrow points at the glass (no ring); after it, nothing does.
    await t.call('startMission', 1);
    await t.call('roofPlace', 292, 152);
    for (const [i, x, y, a] of [
      [0, 60, 130, Math.PI],
      [1, 330, 60, -Math.PI / 2],
      [2, 330, 300, 0],
      [3, 160, 60, -Math.PI / 2],
    ])
      await t.call('roofGuard', i, x, y, a);
    await t.call('roofSuspicion', 0);
    await t.wait(0.5);
    k = await t.call('markers');
    t.assert(k.objectiveArrow === true && k.objectiveRing === false, 'before the spike: ' + JSON.stringify(k));
    const p = await t.call('spikeGlass');
    t.assert(p.phase === 'approach', 'glass not spiked: ' + JSON.stringify(p));
    await t.call('roofPlace', 100, 260);
    await t.wait(1);
    k = await t.call('markers');
    t.assert(k.objectiveArrow === false && k.objectiveRing === false, 'something still points at the spiked glass: ' + JSON.stringify(k));
  } finally {
    await t.call('settings', { playerRing: false });
    await t.call('holdSimulation', false);
  }
}
