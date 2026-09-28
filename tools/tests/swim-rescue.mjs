// A swimmer who swims out until their strength is spent is fished out by the harbor
// patrol ($100) instead of always drowning first (8 hp/s used to kill anyone without
// armor before the 14 s rescue).
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    await t.call('heal', 0);
    await t.call('setCash', 500);
    // Off Palm Keys beach, then straight out to sea (south) with the hard crawl.
    await t.call('teleport', -1986, 5950);
    await t.wait(0.5);
    let swim = await t.call('swim');
    t.assert(swim.swimming, 'not swimming off the beach: ' + JSON.stringify(swim));
    let rescued = null;
    for (let i = 0; i < 24 && !rescued; i++) {
      await t.keys('KeyS', 2);
      const s = await t.call('status');
      t.assert(s.mode === 'play', `drowned after ${2 * (i + 1)} s: ` + JSON.stringify(s));
      swim = await t.call('swim');
      if (!swim.swimming) rescued = s;
    }
    t.assert(rescued, 'still in the water after 48 s: ' + JSON.stringify(swim));
    t.assert(rescued.cash === 400, 'no $100 call-out: ' + rescued.cash);
    t.assert(rescued.hp > 0 && rescued.hp < 100, 'hp after the rescue ' + rescued.hp);
    t.note(`rescued with ${rescued.hp} hp at ${rescued.x},${rescued.y}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
