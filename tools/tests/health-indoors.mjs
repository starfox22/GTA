// No health boxes on the street: health is bought indoors. Standing where the old
// pickups lay heals nothing; a hospital's treatment, a diner's plate and a county
// lodge's hot meal (citylife-police.js serviceAction) do, for their price.
export const fresh = true;
const OLD_PICKUPS = [
  [790, 745], // Northbank
  [-1730, 1996], // RIVERSIDE MEDICAL
];
async function wound(t, x, y) {
  // A blast 4 m off wounds without killing ('world': no crime, no stars).
  await t.call('heal');
  await t.call('teleport', x + 90, y);
  await t.wait(3.2); // past any respawn invulnerability
  await t.call('blast', x + 120, y, 1);
  await t.wait(0.3);
  await t.call('wanted', 0);
  const s = await t.call('status');
  t.assert(s.mode === 'play' && s.hp < 100 && s.hp > 20, `the blast did not wound: ${JSON.stringify(s)}`);
  return s.hp;
}
async function buy(t, place, key, price, gain) {
  const hp = await wound(t, place.door.x, place.door.y);
  await t.call('setCash', 1000);
  await t.call('teleport', place.door.x, place.door.y);
  await t.wait(0.3);
  await t.call('interact');
  let s = await t.call('status');
  t.assert(s.mode === 'service', `${place.name}: the action key did not open the counter: ${s.mode}`);
  await t.keys(key, 0.15, { real: true });
  await t.realWait(0.5);
  s = await t.call('status');
  t.assert(s.mode === 'play', `${place.name}: still at the counter after ${key}: ${s.mode}`);
  t.assert(s.hp === Math.min(100, hp + gain), `${place.name}: hp ${hp} -> ${s.hp}, expected +${gain}`);
  t.assert(s.cash === 1000 - price, `${place.name}: paid $${1000 - s.cash}, not $${price}`);
  t.note(`${place.name}: hp ${hp} -> ${s.hp} for $${price}`);
}
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    for (const [x, y] of OLD_PICKUPS) {
      const hp = await wound(t, x, y);
      await t.call('teleport', x, y);
      await t.wait(1);
      const s = await t.call('status');
      t.assert(s.hp <= hp, `a health pickup still heals at ${x},${y}: ${hp} -> ${s.hp}`);
    }
    const places = await t.call('places');
    const find = (fn, what) => {
      const p = places.find(fn);
      t.assert(p && p.door, `no ${what}: ${JSON.stringify(places.map((q) => q.name))}`);
      return p;
    };
    await buy(t, find((p) => p.name === 'SAINT MARLOW HOSPITAL', 'hospital'), 'Digit1', 150, 100);
    await buy(t, find((p) => p.name === 'THE BLUE PLATE DINER', 'diner'), 'Digit1', 28, 45);
    await buy(t, find((p) => p.kind === 'sleep' && / LODGE$/.test(p.name), 'county lodge'), 'Digit3', 25, 35);
  } finally {
    await t.call('heal');
    await t.call('holdSimulation', false);
  }
}
