// Monarch Isle's cars on the Regency Road (regencyTraffic): they keep to the
// right-hand lane through its bends and turn round on their own road, clear of
// Eagle Pass's lanes at its end, with no damage and no long stand.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // Known conditions, and 40 s: on the shared page the scenic traffic built up by the tests before
    // it makes the car up from the bridge yield at the Eagle Pass junction (as it should), and 25 s
    // no longer reached its turn-round.
    await t.call('sky', 'clear');
    await t.call('wetness', 0);
    await t.call('setClock', 13);
    const r = await t.call('regencyTraffic', 40);
    t.assert(!r.error, r.error);
    t.finite(r, 'regencyTraffic');
    t.assert(r.seconds >= 40, `stopped after ${r.seconds} s`);
    for (const c of r.cars) {
      const label = `${c.type} (now at ${c.at})`;
      t.assert(!c.gone, `${label}: gone`);
      t.assert(c.wrongSideM !== null && c.wrongSideM < -1, `${label}: ${c.wrongSideM} m over the centre line at ${c.wrongAt}`);
      t.assert(c.eaglePassSteps === 0, `${label}: ${c.eaglePassSteps} steps in Eagle Pass's carriageway (${c.eaglePassGapM} m)`);
      t.assert(c.offRoad === 0 && c.damage === 0, `${label}: off the tarmac ${c.offRoad} steps, damage ${c.damage}`);
      t.assert(c.longestStopS < 10, `${label}: stood ${c.longestStopS} s`);
      t.note(`${c.type}: lane ${c.wrongSideM} m, pass gap ${c.eaglePassGapM} m, turns ${c.turns}`);
    }
    t.assert(r.cars.filter((c) => c.turns > 0).length === 2, `turned round: ${r.cars.map((c) => c.turns)}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
