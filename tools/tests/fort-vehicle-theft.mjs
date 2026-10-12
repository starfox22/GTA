// Stealing at Fort Sentinel (fort-cover.js fortCoverBoarded, the one military-vehicle rule): boarding any of the base's
// vehicles in Kessler's cover blows it, and anywhere inside the fence it is five stars at once with the base alarmed;
// the ready line's M35 by the avenue, a motor pool jeep and the HQ pad's helicopter alike.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  const board = async (label, x, y, type) => {
    await t.call('teleport', x, y);
    await t.wait(0.2);
    await t.call('interact');
    await t.wait(0.3);
    const s = await t.call('status'),
      m = await t.call('military');
    t.assert(s.vehicle === type && s.wanted === 5 && m.alert, label + ': not five stars with the base alarmed: ' + JSON.stringify({ vehicle: s.vehicle, wanted: s.wanted, alert: m.alert }));
    return s;
  };
  const getOut = async () => {
    if ((await t.call('status')).vehicle) await t.call('interact');
    await t.wait(0.5);
  };
  try {
    // In cover, cleared, beside the motor pool jeep: cover blown, five stars.
    let c = await t.call('fortCoverTest', 'jeep');
    t.assert(!c.alarmed && (await t.call('status')).wanted === 0, 'jeep staging: ' + JSON.stringify(c));
    await board('cover, motor pool jeep', 9470, 8915, 'jeep');
    c = await t.call('fortCover');
    t.assert(c.alarmed && c.blownBy === 'vehicle', 'boarding did not blow the cover: ' + JSON.stringify(c));

    // In cover, the ready line's M35 on the walk to the records office.
    await getOut();
    await t.call('wanted', 0);
    await t.call('fortCoverTest', 'inside');
    await t.wait(0.3);
    t.assert((await t.call('status')).wanted === 0, 'inside staging not calm');
    await board('cover, ready line M35', 9445, 8236, 'armytruck');

    // Free roam, own clothes: the HQ pad's helicopter.
    await getOut();
    await t.call('wanted', 0);
    await t.call('fortCoverTest', 'end');
    await board('free roam, HQ pad helicopter', 9520, 7936, 'helicopter');
  } finally {
    await getOut();
    await t.call('wanted', 0);
    await t.call('fortCoverTest', 'end');
    await t.call('holdSimulation', false);
  }
}
