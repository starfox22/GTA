// Cabin headroom (cars3d-headroom.js CABIN HEADROOM): with every civilian, Prestige and police car lined up, no seated
// head (the tallest man and woman drawn in cars, the player) goes through a roof, a windscreen, a rear or a side glass,
// the seats stay over the floor and lie back no further than real seats do, and the drive-by pose in a low supercar
// reaches the very grip the bullet leaves from (the game's seat is the model's: driveby-seats.js). On the no-render
// page (the suite's) cabinHeadroom() is null and the test only checks that.
export default async function (t) {
  const first = await t.call('cabinHeadroom');
  if (first === null) return;
  await t.call('god', true);
  await t.call('setClock', 12);
  await t.call('teleport', 420, 4380);
  const types = ['sedan', 'taxi', 'coupe', 'muscle', 'sport', 'roadster', 'rally', 'hotrod', 'supercar', 'luxury', 'limousine', 'suv', 'van', 'pickup', 'chevette', 'brutini', 'cavalino'];
  const prestige = ['valkyrie', 'dbs', 'zr1x', 'chevetteSE', 'wayron', 'tourbillon', 'jasko', 'sirocco', 'novera', 'w1', 'lafera'];
  const all = [...types, ...prestige],
    third = Math.ceil(all.length / 3);
  for (let k = 0; k < 3; k++) await t.call('carLineup', all.slice(k * third, (k + 1) * third), 480 + k * 70, 4250, 0, 44);
  await t.call('policeLineup', 690, 4250, 0, false, 44);
  await t.call('look', 580, 4450, 1.1);
  await t.call('hitchRun', 0.8);
  const r = await t.call('cabinHeadroom');
  t.finite(r, 'cabinHeadroom');
  const seen = new Set(r.cars.map((c) => c.type + (c.body ? '/' + c.body : '')));
  for (const type of all.filter((x) => x !== 'roadster')) t.assert(seen.has(type), `${type}: its cabin is in the report`);
  for (const body of ['charger', 'utility', 'crownvic']) t.assert(seen.has('police/' + body), `police ${body}: its cabin is in the report`);
  t.assert(r.through === 0, `${r.through} cars with a head through the roof or glass: ${JSON.stringify(r.cars.filter((c) => c.through.length).map((c) => [c.type, c.body, c.through, c.clear]))}`);
  for (const c of r.cars) {
    const name = c.type + (c.body ? '/' + c.body : '');
    for (const who of ['man', 'woman', 'player']) t.assert(c.clear[who] >= 0, `${name}: the ${who}'s head clears the roof and glass (${c.clear[who]} m)`);
    t.assert(c.hip[1] >= 0.19 && c.hip[1] <= 1.2, `${name}: the hip over the floor (${c.hip[1]} m)`);
    t.assert(c.recline >= 0.29 && c.recline <= (['valkyrie', 'lafera'].includes(c.type) ? 0.89 : 0.69), `${name}: the seat back lies back like a real one (${c.recline} rad)`);
  }
  // The game's drive-by seat is the model's (driveby-seats.js DRIVEBY_SEATS): a drifted line is printed to paste.
  const drifted = r.cars.filter((c) => c.seatGap !== undefined && c.seatGap > 0.02);
  t.assert(!drifted.length, `DRIVEBY_SEATS lines to re-record:\n${drifted.map((c) => `      ${/^\w+$/.test(c.key) ? c.key : `'${c.key}'`}: [${c.seat.join(', ')}],`).join('\n')}`);
  // The drive-by in the Chevette Z06 (its seat low and laid back): the gun comes out of the window in the hand.
  await t.call('viewMode', 'chase');
  await t.call('drive', 'chevette', 0, 0);
  await t.call('driveByAim', -90, 'raise');
  await t.call('hitchRun', 1.2, [], 10, false, true);
  const arm = (await t.call('cabinHeadroom')).driveByArm;
  t.note(`drive-by arm in the chevette: ${JSON.stringify(arm)}`);
  t.assert(arm.type === 'chevette' && arm.window === 'left', `the drive-by pose was drawn: ${JSON.stringify(arm)}`);
  t.assert(arm.gap < 0.02, `the hand reaches the grip the bullet leaves from (${arm.gap} m short)`);
  await t.call('driveByAim', null);
  await t.call('viewMode', 'street');
}
