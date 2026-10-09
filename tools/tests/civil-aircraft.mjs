// The downloaded civil aircraft (civil-helicopters.js, aviation-flight.js SKYLARK): the SKYRANGER 429s parked on two
// office-roof helipads and at Southport, kept (never doubled) by a world reset; the SKYLARK 172s on Southport's apron,
// flyable, whose fixed gear never retracts (L says FIXED GEAR).
export const fresh = true;
export default async function (t) {
  const helis = await t.call('civilHelicopters');
  t.note('civil helicopters: ' + JSON.stringify(helis));
  t.assert(helis.spec.name === 'SKYRANGER 429' && helis.spec.rotorRadius === 44, 'SKYRANGER spec: ' + JSON.stringify(helis.spec));
  t.assert(helis.list.length === 3, 'expected 3 SKYRANGER 429s, got ' + helis.list.length);
  t.assert(helis.list.filter((h) => h.roof && h.altitude > 50).length === 2, 'two should stand on roofs');
  // A reset (WASTED) puts the same ones back.
  await t.call('god', false);
  await t.call('teleport', 1152, 1300);
  await t.wait(3.2); // past the teleport's invulnerability
  const at = await t.call('status');
  await t.call('blast', at.x, at.y, 3);
  await t.wait(0.5);
  t.assert((await t.call('status')).mode === 'dead', 'not killed');
  await new Promise((r) => setTimeout(r, 4800)); // WASTED runs on the wall clock
  t.assert((await t.call('worldResetReport')).byReason.wasted === 1, 'no reset on WASTED');
  const after = await t.call('civilHelicopters');
  t.assert(after.list.length === 3, 'after a reset: ' + after.list.length + ' SKYRANGERs');
  const key = (h) => h.x + ',' + h.y;
  t.assert(after.list.map(key).sort().join() === helis.list.map(key).sort().join(), 'the reset moved them');
  // SKYLARK 172s at Southport (three apron spots).
  await t.call('teleport', 900, 4800);
  const near = (await t.call('vehiclesNear', 120)).filter((v) => v.type === 'plane');
  t.assert(near.length >= 3, 'expected the three SKYLARKs near Southport\'s apron: ' + JSON.stringify(near));
  // Fly one: the flight data names it and the gear stays down.
  await t.call('teleport', 418, 6200);
  await t.call('drive', 'plane', 0, -Math.PI / 2, 'skyhawk');
  const f = await t.call('flight');
  t.assert(f && f.type === 'skyhawk', 'not flying the skyhawk: ' + JSON.stringify(f));
  await t.call('drive', 'plane', 300, -Math.PI / 2, 'skyhawk');
  await t.keys('KeyL', 0.1, { real: true });
  await t.wait(3);
  const g = await t.call('flight');
  t.assert(g.gearPos > 0.95, 'fixed gear retracted: ' + g.gearPos);
  // The SKYRANGER flies too (the helicopter's own controls).
  await t.call('drive', 'helicopter', 0, 0, 'bell429');
  await t.keys('KeyT', 4);
  const h = await t.call('flight');
  t.assert(h.type === 'helicopter' && h.agl > 5, 'the SKYRANGER did not lift: ' + JSON.stringify(h));
}
