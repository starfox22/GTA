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
  // A downloaded model (vehicle-assets3d.js ASSET CARS) carries the badges its maker modelled, not the game's lettering.
  const assets = new Set(models.filter((r) => r.asset).map((r) => r.type));
  for (const type of all) {
    if (assets.has(type)) continue;
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
    if (assets.has(type)) continue;
    const r = models.find((m) => m.type === type && m.badge);
    t.assert(r && r.draws <= 14, `${type}: ${r?.draws} draws with its badge`);
  }
  // Everything else the player drives: police bodies (POLICE / SHERIFF and the model), motorbikes (tank sides), the
  // box truck, ambulance and bus (their tail panels), the army's stencils, the 4x4 club's makers.
  const others = ['bike', 'cruiser', 'dolcati', 'yamasaki', 'kr500', 'truck', 'ambulance', 'bus', 'jeep', 'apc', 'armytruck', 'series', 'crawler', 'bronco', 'expedition', 'hilux', 'sixbysix', 'trophy'];
  await t.call('carLineup', others.slice(0, 9), 760, 4250, 0, 60);
  await t.call('carLineup', others.slice(9), 860, 4250, 0, 60);
  await t.call('policeLineup', 960, 4250, 0, false, 44);
  await t.call('look', 860, 4450, 1.1);
  await t.call('hitchRun', 0.8);
  const badges = await t.call('carBadges'),
    of = (type, body) => badges.find((b) => b.type === type && (!body || b.body === body) && b.badge),
    // A downloaded model (a motorbike, the Crown Vic patrol body) carries its maker's badges, not the game's.
    asset = (type, body) => badges.some((b) => b.type === type && (!body || b.body === body) && b.asset);
  for (const type of others) {
    if (asset(type)) continue;
    const b = of(type);
    t.assert(b && b.badge.text, `${type}: a badge (${JSON.stringify(b?.badge)})`);
    if (b && b.badge.letters !== undefined) t.assert(b.badge.letters > 0, `${type}: its letters laid (${b.badge.letters})`);
  }
  for (const body of ['charger', 'utility', 'crownvic', 'tahoe']) {
    if (asset('police', body)) continue;
    const b = of('police', body) || of('suv', body);
    t.assert(b && b.badge.letters > 0 && b.badge.sub, `police ${body}: its model name on the tail (${JSON.stringify(b?.badge)})`);
  }
  t.assert(badges.some((b) => b.badge?.text === 'POLICE'), 'a marked patrol car reads POLICE');
}
