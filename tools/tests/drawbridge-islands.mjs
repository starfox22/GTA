// The drawbridges (drawbridge.js): every island reached by more than one road bridge has a
// drawbridge among them (bridgeIslands), the four drawbridges are where they should be, and
// the staggered timetables keep at least one span up or moving for half the day or more
// (drawbridgeOpenShare, from each bridge's nominal opening), with no all-shut stretch over 3 h.
export const fresh = true;
const EXPECTED = ['keys-harbor', 'oceanview', 'ridgeline', 'coronation'];
export default async function (t) {
  const r = await t.call('drawbridges');
  const ids = r.drawbridges.map((d) => d.id);
  for (const id of EXPECTED) t.assert(ids.includes(id), `${id} is a drawbridge: ${ids}`);
  for (const island of r.islands) {
    t.note(`${island.name}: ${island.bridges.join(', ')} · drawbridges ${island.drawbridges.join(', ') || '-'}`);
    if (island.bridges.length > 1) t.assert(island.drawbridges.length > 0, `${island.name} has ${island.bridges.length} bridges and no drawbridge`);
  }
  const names = r.islands.map((i) => i.regions).flat();
  for (const region of ['palmkeys', 'northbank', 'sunsetisle', 'monarch', 'ridgeline', 'oceanview', 'coralcoast'])
    t.assert(names.includes(region), `${region} is in the island list`);
  const pier = r.islands.find((i) => i.regions.includes('sunsetisle')),
    monarch = r.islands.find((i) => i.regions.includes('monarch'));
  t.assert(pier.bridges.includes('coronation') && monarch.bridges.includes('coronation'), 'the Coronation Bridge joins Sunset Pier and Monarch Isle');
  // The Palm Sound timetable is the one players know.
  const palm = r.drawbridges.find((d) => d.id === 'keys-harbor');
  t.assert(palm.schedule.join() === '06:40,14:20,21:30', `Palm Sound timetable: ${palm.schedule}`);
  t.assert(palm.leafM === 44, `Palm Sound leaves 44 m: ${palm.leafM}`);
  for (const d of r.drawbridges) {
    t.near(d.nominal.closed, 120, 200, `${d.id} nominal opening (minutes the span is not seated)`);
    t.assert(d.schedule.length >= 2, `${d.id} opens at least twice a day: ${d.schedule}`);
  }
  t.assert(r.day.share >= 0.5, `a span is up or moving at least half the day: ${JSON.stringify(r.day)}`);
  t.assert(r.day.longestAllShutMinutes <= 180, `no all-shut stretch over three hours: ${r.day.longestAllShutMinutes} min`);
  t.note(`open share ${r.day.share} (${JSON.stringify(r.day.each)}), longest all-shut ${r.day.longestAllShutMinutes} min`);
  // A scheduled opening really starts: the clock just before the Coronation Bridge's slot.
  await t.call('holdSimulation', true);
  try {
    await t.call('drawbridge', 'close', 0, 'all');
    await t.wait(20);
    const slot = r.drawbridges.find((d) => d.id === 'coronation').schedule[1].split(':').map(Number);
    await t.call('setClock', slot[0] + (slot[1] - 1) / 60);
    await t.wait(4);
    let c = await t.call('drawbridge', 'status', 0, 'coronation');
    t.assert(c.phase !== 'idle', `the Coronation Bridge opens on its timetable: ${c.phase} at ${slot}`);
    for (let k = 0; k < 20 && c.phase !== 'open'; k++) {
      await t.wait(5);
      c = await t.call('drawbridge', 'status', 0, 'coronation');
    }
    t.assert(c.phase === 'open' && c.angle > 70, `raised: ${c.phase} ${c.angle}`);
    const live = await t.call('drawbridges');
    t.assert(live.anyOpen, 'drawbridges() reports a span up');
  } finally {
    await t.call('drawbridge', 'close', 0, 'all');
    await t.call('holdSimulation', false);
  }
}
