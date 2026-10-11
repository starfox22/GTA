// Asset char (vehicle-char3d.js ASSET CHAR): a burnt downloaded sedan, police car, army utility and box truck draw char
// materials on their atlas and paint meshes (fully burnt, embers glowing at first), and a repair puts the shared
// materials back (none left in the report, the materials pooled). On the no-render page assetChar() is null: skipped.
export const fresh = true;

export default async function (t) {
  if ((await t.call('assetChar')) === null) return;
  await t.call('god', true);
  await t.call('setClock', 12);
  await t.call('teleport', 1700, 760);
  const ids = [];
  for (const r of await t.call('carLineup', ['sedan', 'jeep'], 1655, 640, 0, 52)) ids.push(r.id);
  for (const r of await t.call('policeLineup', 1745, 640, 0, false, 52, [['police', 'crownvic', 'bw']])) ids.push(r.id);
  for (const r of await t.call('carLineup', ['truck'], 1735, 692, 0, 52)) ids.push(r.id);
  await t.call('look', 1700, 690, 2.6);
  await t.call('hitchRun', 0.8);
  t.assert((await t.call('assetChar')).models.length === 0, 'intact models draw the shared materials');
  for (const id of ids) await t.call('burnVehicle', id, 1);
  await t.call('hitchRun', 0.8);
  let report = await t.call('assetChar');
  for (const id of ids) {
    const r = report.models.find((m) => m.id === id);
    t.assert(r, `vehicle ${id}: drawn with char materials when burnt`);
    if (!r) continue;
    t.assert(r.state[2] === 1 && r.swapped > 0, `${r.type}: fully burnt on ${r.swapped} meshes ${JSON.stringify(r.state)}`);
    t.assert(r.materials.includes('cut'), `${r.type}: the atlas trim is charred`);
    if (r.type !== 'jeep') t.assert(r.materials.includes('plain'), `${r.type}: the paint is charred`);
    t.assert(r.ember > 0, `${r.type}: embers glow on a fresh wreck (${r.ember})`);
  }
  for (const id of ids) await t.call('burnVehicle', id, 0, true);
  await t.call('hitchRun', 0.5);
  report = await t.call('assetChar');
  t.assert(report.models.length === 0, `repaired models draw the shared materials again (${report.models.length} left)`);
  t.assert(report.pooled.cut >= 4, `char materials pooled after the repair ${JSON.stringify(report.pooled)}`);
}
