// Rear badges (cars3d-badges.js REAR BADGES): every civilian and Prestige car carries its model name on the tail, every
// letter of it laid (no glyph missing from the trim atlas), merged into the trim: a pristine car still draws in 13 calls.
// On the no-render page (the suite's) carModels() is null and the test only checks that.
export default async function (t) {
  if ((await t.call('carModels')) === null) return;
  await t.call('god', true);
  await t.call('setClock', 12);
  await t.call('teleport', 420, 4380);
  const types = ['sedan', 'taxi', 'coupe', 'muscle', 'sport', 'roadster', 'rally', 'hotrod', 'supercar', 'luxury', 'limousine', 'suv', 'van', 'pickup', 'chevette', 'brutini', 'cavalino'];
  const prestige = ['valkyrie', 'dbs', 'zr1x', 'chevetteSE', 'wayron', 'tourbillon', 'jasko', 'sirocco', 'novera', 'w1', 'lafera'];
  const all = [...types, ...prestige],
    third = Math.ceil(all.length / 3);
  for (let k = 0; k < 3; k++) await t.call('carLineup', all.slice(k * third, (k + 1) * third), 480 + k * 70, 4250, 0, 44);
  await t.call('look', 550, 4450, 1.1);
  await t.call('hitchRun', 0.8);
  const models = await t.call('carModels'),
    seen = new Map();
  for (const r of models) if (r.badge && !seen.has(r.type)) seen.set(r.type, r);
  for (const type of all) {
    const r = seen.get(type);
    t.assert(r, `${type}: a badge on the tail`);
    if (!r) continue;
    const b = r.badge,
      wanted = (b.text + (b.sub || '')).replace(/\s/g, '').length;
    t.assert(b.letters === wanted, `${type}: every letter of "${b.text}${b.sub ? ' ' + b.sub : ''}" is laid (${b.letters} of ${wanted})`);
  }
  const chevette = seen.get('chevette');
  t.assert(chevette && /CHEVETTE/.test(chevette.badge.text) && chevette.badge.sub === 'Z06', `the Chevette reads CHEVETTE Z06: ${JSON.stringify(chevette?.badge)}`);
  // No draw call of their own: a pristine civilian car is still 13 draws (the PRISTINE MERGE).
  for (const type of ['sedan', 'chevette', 'suv']) {
    const r = models.find((m) => m.type === type && m.badge);
    t.assert(r && r.draws <= 14, `${type}: ${r?.draws} draws with its badge`);
  }
}
