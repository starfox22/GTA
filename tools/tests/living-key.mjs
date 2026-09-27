// North Point Key visitors: a car sent onto the Key avenue drives over the bridge, round the
// drop-off circle (this one pauses by the valet) and back into the city's traffic, unhurt.
export const fresh = true;

export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 20);
  await t.call('skylineVisit', 'forecourt');
  await t.wait(2);
  await t.call('holdSimulation', true);
  // The Key's own spawner may have sent a visitor during the settle wait: its car
  // sits on the start of the run for a moment, so let it roll on and try again.
  let start = await t.call('keyVisitorSpawn', true);
  for (let i = 0; i < 5 && !start.sent && start.lastFail.startsWith('car '); i++) {
    await t.wait(2);
    start = await t.call('keyVisitorSpawn', true);
  }
  t.assert(start.sent, 'no visitor could be sent: ' + JSON.stringify(start));
  const id = start.id,
    legs = new Set();
  let r = start,
    maxHp = null,
    minRing = Infinity;
  for (let clock = 0; clock < 150; clock += 2) {
    await t.wait(2);
    r = await t.call('keyVisitors');
    const c = r.cars.find((c) => c.id === id);
    if (!c) break;
    legs.add(c.leg);
    maxHp ??= c.hp;
    t.assert(c.hp >= maxHp, 'the visitor hit something: ' + JSON.stringify(c));
    if (c.leg === 'ring') minRing = Math.min(minRing, Math.hypot(c.x - 4100, c.y + 3456));
  }
  t.note('legs ' + [...legs].join(',') + ' ring distance min ' + Math.round(minRing) + ' ' + JSON.stringify({ spawned: r.spawned, handedBack: r.handedBack, dropOffs: r.dropOffs }));
  t.assert(legs.has('ring'), 'never reached the circle: ' + [...legs]);
  t.assert(r.dropOffs >= 1, 'no pause by the valet: ' + JSON.stringify(r));
  t.assert(minRing > 55, 'cut across the fountain island: ' + minRing);
  t.assert(!r.cars.some((c) => c.id === id), 'still on the Key after 150 s: ' + JSON.stringify(r.cars));
  t.assert(r.handedBack >= 1, 'not handed back to city traffic: ' + JSON.stringify(r));
  await t.call('holdSimulation', false);
}
