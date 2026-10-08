// The respray arrow (garages.js RESPRAY BEACON): over the nearest garage's door only while the police want
// the player and he drives a car a shop would take; nothing out of a chase, on foot or far from a shop.
export const fresh = true;
export default async function (t) {
  const g = await t.call('garage');
  const shop = g.garages[0];
  await t.call('god', true);
  await t.call('teleport', shop.apron.x, shop.apron.y + 160);
  await t.call('drive', 'sedan');
  await t.call('wanted', 0);
  await t.wait(0.3);
  let r = await t.call('garage');
  t.assert(!r.beacon, 'a shop is marked with no chase: ' + JSON.stringify(r.beacon));
  await t.call('wanted', 2);
  await t.wait(0.3);
  r = await t.call('garage');
  t.note('beacon: ' + JSON.stringify(r.beacon));
  t.assert(r.beacon && r.beacon.shop === shop.name, 'no arrow over ' + shop.name + ' in a chase: ' + JSON.stringify(r.beacon));
  t.near(r.beacon.x, (shop.door.x0 + shop.door.x1) / 2, 2, 'arrow not over the door');
  const m = await t.call('markers');
  t.assert(m.respray, 'markers() does not list the respray arrow');
  // On foot: no arrow.
  await t.call('interact');
  await t.wait(1.5);
  const s = await t.call('status');
  if (!s.vehicle) {
    r = await t.call('garage');
    t.assert(!r.beacon, 'arrow on foot');
  }
  // Far from every shop: none.
  await t.call('teleport', 1152, 1300);
  await t.call('drive', 'sedan');
  await t.call('wanted', 2);
  await t.wait(0.3);
  const st = await t.call('status');
  const nearest = Math.min(...g.garages.map((s) => Math.hypot(s.apron.x - st.x, s.apron.y - 60 - st.y))) / 8;
  r = await t.call('garage');
  t.note(`nearest shop ${nearest.toFixed(0)} m: ` + JSON.stringify(r.beacon));
  if (nearest > 140) t.assert(!r.beacon, 'arrow with no shop within 140 m');
  await t.call('wanted', 0);
  await t.call('god', false);
}
