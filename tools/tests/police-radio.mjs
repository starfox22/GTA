// Dispatch radio (pursuit-dispatch.js): with a unit watching, the player swapping cars is called
// in ("SUSPECT SWITCHED · NOW IN A ... PICKUP"), and getting out on foot too.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 13);
  await t.call('teleport', 1152, 1300);
  await t.call('holdSimulation', true);
  await t.call('witnessStage', 0, false, 1400, false, false, true);
  await t.call('drive', 'sedan', 0, -Math.PI / 2);
  await t.call('wanted', 1);
  // A crewed cruiser 200 units down the street, looking at the player.
  const unit = await t.call('respondingUnit', 1152, 1100, Math.PI / 2, 0);
  t.assert(unit, 'no room for the cruiser');
  await t.wait(2);
  let r = await t.call('policeReport');
  t.assert(r.units.some((u) => u.sees), 'the cruiser does not see the player: ' + JSON.stringify(r.units));
  // Six seconds after the last caption the swap is called in.
  await t.wait(5);
  await t.call('drive', 'pickup', 0, -Math.PI / 2);
  let said = null;
  for (let i = 0; i < 8 && !said; i++) {
    await t.wait(1);
    r = await t.call('policeReport');
    if (r.radio && /SWITCHED/.test(r.radio.text) && r.radio.ago < 2) said = r.radio.text;
  }
  t.note('radio: ' + said);
  t.assert(said && /PICKUP/.test(said), 'the car swap was not called in: ' + JSON.stringify(r.radio) + ' units ' + JSON.stringify(r.units.map((u) => [u.d, u.sees])));
  await t.call('wanted', 0);
  await t.call('holdSimulation', false);
  await t.call('god', false);
}
