// Police sight by day and by night (policeSightRange, citylife-police.js): a patrol 44 m down a
// clear street picks out a figure on foot by day but not after dark, sees them again from 30 m,
// and sees a car at 44 m by night (its lamps).
export const fresh = true;
async function sees(t, distance) {
  await t.call('wanted', 0);
  await t.call('witnessStage', 0, false, 1400, false, false, true);
  const unit = await t.call('respondingUnit', 1152, 1300 - distance, Math.PI / 2, 0);
  t.assert(unit, 'no room for the cruiser');
  await t.wait(0.4);
  const r = await t.call('policeReport');
  const u = r.units.find((v) => v.id === unit.id);
  t.assert(u, 'the cruiser is gone');
  return { sees: u.sees, range: r.sightRange };
}
export default async function (t) {
  await t.call('god', true);
  await t.call('holdSimulation', true);
  await t.call('teleport', 1152, 1300);
  await t.call('setClock', 13);
  const day = await sees(t, 350);
  await t.call('setClock', 23);
  const night = await sees(t, 350);
  const nightClose = await sees(t, 240);
  t.note(`day ${JSON.stringify(day)}, night at 350 ${JSON.stringify(night)}, night at 240 ${JSON.stringify(nightClose)}`);
  t.assert(day.range === 440 && day.sees, 'by day a patrol 350 units off should see the player: ' + JSON.stringify(day));
  t.assert(night.range < 350 && !night.sees, 'by night a figure on foot 350 units off should not be seen: ' + JSON.stringify(night));
  t.assert(nightClose.sees, 'by night a patrol 240 units off should see the player: ' + JSON.stringify(nightClose));
  // In a car at night the lamps give the player away further.
  await t.call('drive', 'sedan');
  const r = await t.call('policeReport');
  t.note(`night in a car: sight ${r.sightRange}`);
  t.assert(r.sightRange > night.range + 60, 'a car at night should be seen further than a figure on foot: ' + r.sightRange);
  await t.call('setClock', 13);
  await t.call('holdSimulation', false);
  await t.call('god', false);
}
