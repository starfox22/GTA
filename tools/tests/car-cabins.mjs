// Car cabins (cars3d-interior.js): every civilian and prestige body's seat plan keeps a seated crown under its roof and
// the seat backs inside the rear glass, the cabin is merged into the trim (no draw call of its own), and the people in
// a car near the camera are drawn through the glass. On the no-render page (the suite's) every report is null.
export default async function (t) {
  if ((await t.call('carModels')) === null) return;
  await t.call('god', true);
  await t.call('setClock', 12);
  await t.call('teleport', 420, 4380);
  // Every civilian car type and the Prestige Collection, in three columns in view.
  const types = ['sedan', 'taxi', 'coupe', 'muscle', 'sport', 'roadster', 'rally', 'hotrod', 'supercar', 'luxury', 'limousine', 'suv', 'van', 'pickup', 'chevette', 'brutini', 'cavalino'];
  const prestige = ['valkyrie', 'dbs', 'zr1x', 'chevetteSE', 'wayron', 'tourbillon', 'jasko', 'sirocco', 'novera', 'w1', 'lafera'];
  const all = [...types, ...prestige],
    third = Math.ceil(all.length / 3);
  for (let k = 0; k < 3; k++) await t.call('carLineup', all.slice(k * third, (k + 1) * third), 480 + k * 70, 4250, 0, 44);
  await t.call('look', 550, 4450, 1.1);
  await t.call('hitchRun', 0.8);
  const models = await t.call('carModels'),
    seen = new Set();
  for (const r of models) {
    if (!r.cabin || seen.has(r.type)) continue;
    seen.add(r.type);
    const c = r.cabin;
    t.finite(c, `${r.type} cabin`);
    if (c.headroom !== undefined) {
      t.assert(c.headroom >= 0.02, `${r.type}: a seated crown clears the roof (${c.headroom} m)`);
      t.assert(c.behind >= 0.04, `${r.type}: the seat back and headrest stay inside the rear glass (${c.behind} m)`);
      t.assert(c.cabinTriangles > 500 && c.cabinTriangles < 4000, `${r.type}: the cabin is in the trim (${c.cabinTriangles} triangles)`);
    }
    t.assert(c.hip[1] > 0.15 && c.hip[1] < 1.2, `${r.type}: the hip is over the floor (${c.hip[1]} m)`);
  }
  t.assert(seen.size >= 20, `cabins reported for ${seen.size} car types`);
  for (const type of ['sedan', 'suv', 'luxury']) t.assert(models.some((r) => r.type === type && r.cabin?.rear), `${type} has a rear bench`);
  for (const type of ['supercar', 'chevette']) t.assert(models.some((r) => r.type === type && r.cabin && !r.cabin.rear), `${type} is a two-seater`);
  // The player at the wheel shows through the glass in the chase view.
  await t.call('viewMode', 'chase');
  await t.call('drive', 'sedan', 0, 0);
  // Past the 0.4 s stand-in walking to the door (crowd3d-frame.js carTransition).
  await t.call('hitchRun', 0.6);
  const own = (await t.call('carModels')).find((r) => r.type === 'sedan' && r.draws > 18 && r.cabin?.seated);
  t.assert(own && own.cabin.seated === 1, `the player is seated in their sedan: ${JSON.stringify(own?.cabin)}`);
  await t.call('viewMode', 'street');
}
