// No health boxes on the street: health is bought indoors. Standing where the old
// pickups lay heals nothing; a hospital's treatment, a diner's plate and a county
// lodge's hot meal (citylife-police.js serviceAction) do, for their price. Nothing is
// sold for nothing: at full health treatment and food, and full body armor, are
// refused with a line and no charge (the counter stays open); armor below full is sold.
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
// At the counter with nothing to sell: `key` keeps the counter open, takes no money and
// says `line`; Escape closes it.
async function refused(t, place, key, line) {
  await t.call('setCash', 1000);
  await t.call('teleport', place.door.x, place.door.y);
  await t.wait(0.3);
  await t.call('interact');
  let s = await t.call('status');
  t.assert(s.mode === 'service', `${place.name}: the action key did not open the counter: ${s.mode}`);
  await t.keys(key, 0.15, { real: true });
  await t.realWait(0.5);
  s = await t.call('status');
  t.assert(s.mode === 'service', `${place.name}: the counter closed after ${key} with nothing to sell: ${s.mode}`);
  t.assert(s.cash === 1000, `${place.name}: charged $${1000 - s.cash} for nothing`);
  const notes = await t.call('notices');
  t.assert(notes.some((n) => n.text === line), `${place.name}: no "${line}" line: ${JSON.stringify(notes.map((n) => n.text))}`);
  await t.keys('Escape', 0.15, { real: true });
  await t.realWait(0.3);
  s = await t.call('status');
  t.assert(s.mode === 'play', `${place.name}: Escape did not close the counter: ${s.mode}`);
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

    // Full health: treatment, a plate and a bar meal are refused, free of charge.
    await t.call('heal');
    const good = 'You’re already in good shape.';
    await refused(t, find((p) => p.name === 'SAINT MARLOW HOSPITAL', 'hospital'), 'Digit1', good);
    await refused(t, find((p) => p.name === 'THE BLUE PLATE DINER', 'diner'), 'Digit1', good);
    await refused(t, find((p) => p.name === 'THE RUSTY ANCHOR', 'bar'), 'Digit1', good);
    // Body armor: refused when full, sold (and filled) when not.
    const armory = find((p) => p.name === 'SOUTH COAST ARMORY', 'gun shop');
    await t.call('heal', 100);
    await refused(t, armory, 'Digit7', 'Your body armor is already full.');
    await t.call('heal', 40);
    await t.call('setCash', 1000);
    await t.call('teleport', armory.door.x, armory.door.y);
    await t.wait(0.3);
    await t.call('interact');
    await t.keys('Digit7', 0.15, { real: true });
    await t.realWait(0.5);
    const s = await t.call('status');
    const worn = await t.call('heal'); // (reads the armor; hp is already full)
    t.assert(s.cash === 1000 - 350 && worn.armor === 100, `armor at 40: paid $${1000 - s.cash}, armor ${worn.armor}`);
  } finally {
    await t.call('heal');
    await t.call('holdSimulation', false);
  }
}
