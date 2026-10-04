// The pristine merge (src/vehicle-merge3d.js): an untouched civilian or police car draws its static parts merged per
// material. On a rendered page: cars in view are merged, every merged mesh matches the hidden parts it replaces vertex
// by vertex in world space (vehicleMergeAudit), a car that is shot goes back to its own parts. On the no-render page
// (the suite's) there is no renderer and every report is null.
export default async function (t) {
  const report = await t.call('vehicleMerges');
  if (report === null) {
    t.assert((await t.call('vehicleMergeAudit')) === null, 'vehicleMergeAudit without a renderer');
    return;
  }
  await t.call('god', true);
  await t.call('setClock', 12);
  await t.call('teleport', 420, 4380);
  const lineup = await t.call('carLineup', ['sedan', 'taxi', 'coupe', 'suv', 'van', 'pickup'], 520, 4290, 0, 40, null, true);
  await t.call('look', 470, 4390, 2.6);
  await t.call('hitchRun', 0.2);
  const after = await t.call('vehicleMerges');
  t.assert(after.live >= 4 && after.failed === 0, `cars merged: ${JSON.stringify(after)}`);
  const audit = await t.call('vehicleMergeAudit');
  t.assert(audit.vertices > 1000 && audit.maxError < 0.01 && audit.maxNormalError < 0.01, `merged meshes against their parts: ${JSON.stringify(audit)}`);
  // A damaged car goes back to its own parts (the damage model works on them): a small blast at the first car.
  await t.call('blast', 520, 4290, 0.3);
  await t.call('hitchRun', 0.2);
  const hit = await t.call('vehicleMerges');
  t.assert(hit.split > after.split, `a damaged car splits: ${JSON.stringify(hit)} (lineup ${lineup.length})`);
  const again = await t.call('vehicleMergeAudit');
  t.assert(again.maxError < 0.01, `the cars still merged still match: ${JSON.stringify(again)}`);
}
