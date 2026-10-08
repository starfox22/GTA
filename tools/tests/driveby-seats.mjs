// Drive-by seats (driveby-seats.js): the cars the renderer seats people in fire from the model's own seat
// (DRIVEBY_SEATS, police by body), every grip within the arm's reach of the shoulder on its side (so the drawn hand holds
// the gun the bullet leaves from) and the driver's-window grip still over the sill.
export default async function (t) {
  await t.call('god', true);
  await t.call('teleport', 1000, 1000);
  for (const type of ['sedan', 'chevette', 'suv', 'brutini', 'police', 'van']) {
    await t.call('drive', type, 0, 0);
    const r = await t.call('driveBySeatReport');
    t.note(`${type}: ${r.key} ${JSON.stringify(r.seat)}`);
    t.assert(r.fitted, `${type}: the model's seat is recorded (${r.key})`);
    for (const g of r.grips) {
      t.assert(g.reach <= 0.87, `${type} ${g.window} ${g.deg} deg: the grip within the arm's reach (${g.reach} of the arm)`);
      if (g.window === 'left') t.assert(g.overBelt > 0.02, `${type} left ${g.deg} deg: the grip over the sill (${g.overBelt} m)`);
    }
  }
}
