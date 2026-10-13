// Roof lifts (roof-lifts.js): every helipad roof and every roof a helicopter is parked on has a lift, and each one
// is ridden up from its street door and back down from its roof door with the real action key.
export const fresh = true;
export default async function (t) {
  const r = await t.call('roofLifts');
  t.assert(r.missing === 0, 'roofs without a lift: ' + JSON.stringify(r.roofs.filter((x) => !x.lift)));
  t.assert(r.roofs.length >= 7 && r.roofs.filter((x) => x.helipad).length >= 7, 'helipad roofs: ' + r.roofs.length);
  t.assert(r.roofs.filter((x) => x.helicopters > 0).length >= 3, 'roofs with a parked helicopter: ' + JSON.stringify(r.roofs.map((x) => [x.lift, x.helicopters])));
  t.assert(r.roofs.some((x) => x.name === 'MONARCH ONE'), 'Monarch One has a lift: ' + JSON.stringify(r.roofs.map((x) => x.name)));
  // From boot, not only after the first world reset (the pads are chosen before the first populateWorld).
  t.assert(r.roofs.some((x) => x.name === 'MONARCH ONE' && x.helicopters === 1), "Monarch One's helicopter at boot: " + JSON.stringify(r.roofs.map((x) => [x.name, x.helicopters])));
  const ride = async (what) => {
    await t.keys('KeyE', 0.2, { real: true });
    // The ride runs in the frame loop on wall time (2.6 s, capped per frame): wait it out.
    let s = await t.call('roofLifts');
    t.assert(s.riding, what + ': the action key did not start the lift: ' + JSON.stringify(s.player));
    for (let i = 0; i < 40 && s.riding; i++) {
      await t.realWait(0.5);
      s = await t.call('roofLifts');
    }
    t.assert(!s.riding && s.player.mode === 'play', what + ': the ride did not end: ' + JSON.stringify(s));
    return s.player;
  };
  for (const roof of r.roofs) {
    if (!roof.lift.startsWith('roof-')) continue;
    // Up from the street door.
    await t.call('roofLiftVisit', roof.lift, 'lobby');
    await t.wait(0.3);
    let prompt = await t.call('promptState');
    t.assert(/ELEVATOR TO THE HELIPAD/.test(prompt.offered || ''), roof.name + ' lobby prompt: ' + JSON.stringify(prompt));
    let p = await ride(roof.name + ' up');
    t.assert(p.roof === roof.lift && Math.abs(p.altitude - roof.roof.height) < 2, roof.name + ' not on its roof: ' + JSON.stringify(p));
    // The roof is walkable round the lift house, and the door takes you down again.
    await t.call('walk', Math.PI / 2, 24);
    await t.call('walk', -Math.PI / 2, 24);
    await t.wait(0.3);
    prompt = await t.call('promptState');
    t.assert(/ELEVATOR TO THE STREET/.test(prompt.offered || ''), roof.name + ' roof prompt: ' + JSON.stringify(prompt));
    p = await ride(roof.name + ' down');
    t.assert(!p.roof && p.altitude < 6 && Math.hypot(p.x - roof.lobby.x, p.y - roof.lobby.y) < 30, roof.name + ' not back at the street door: ' + JSON.stringify(p));
    t.note(roof.name + ': ' + roof.street.side + ' side, ' + roof.roof.height + ' up');
  }
  // On a roof with a helicopter, the lift and the helicopter are both reachable.
  const heli = r.roofs.find((x) => x.helicopters > 0 && x.lift.startsWith('roof-'));
  await t.call('roofLiftVisit', heli.lift, 'roof');
  const civil = await t.call('civilHelicopters');
  t.assert(civil.list.some((c) => c.roof), 'a civil helicopter on a roof: ' + JSON.stringify(civil));
}
