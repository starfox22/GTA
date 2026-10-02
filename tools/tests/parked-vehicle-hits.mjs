// A parked car still behaves as a car after the settle shortcut for resting vehicles (physics-step.js settleIsTrivial): a driven
// car shoves it, a blast throws and wrecks it, rounds hurt it, it comes to rest again, and the shortcut changes nothing the
// whole settle would (settleAudit).
export const fresh = true;

export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 12);
  await t.call('teleport', 790, 640);
  await t.call('holdSimulation', true);
  try {
    // Nobody else on the street: no traffic, no police, no crowd within 1,600 units.
    await t.call('witnessStage', 0, false, 1600, false, false, true);
    const id = await t.call('park', 'sedan', 170, 0, Math.PI / 2);
    await t.wait(4); // long enough to be resting
    const rest = await t.call('damageReport', id);
    t.assert(rest && rest.speed === 0, 'the parked sedan is not at rest: ' + JSON.stringify(rest && { speed: rest.speed, spin: rest.spin }));
    let audit = await t.call('settleAudit', 30);
    t.assert(audit.changed === 0, 'settleAudit at rest: ' + JSON.stringify(audit));

    // Rounds hurt it.
    const before = await t.call('damageReport', id);
    for (let i = 0; i < 4; i++) {
      await t.call('shootAt', before.x, before.y, 0);
      await t.wait(0.2);
    }
    const shot = await t.call('damageReport', id);
    // (A round costs a few tenths of a hit point, under the rounding of the report: the bullet marks show it.)
    const marks = (r) => r.marks.bullet || 0;
    t.assert(shot.hp < before.hp || marks(shot) > marks(before), `four pistol rounds left no mark on the sedan: ${before.hp} -> ${shot.hp}, marks ${marks(before)} -> ${marks(shot)}`);

    // Driven into at about 55 km/h: it is shoved (and the hit is a crash for the sedan too).
    const rest2 = await t.call('damageReport', id);
    await t.call('drive', 'muscle', 0, 0);
    await t.call('launch', 15);
    await t.keys('KeyW', 2.5);
    const shoved = await t.call('damageReport', id);
    const moved = Math.hypot(shoved.x - rest2.x, shoved.y - rest2.y);
    t.assert(moved > 4 || Math.abs(shoved.a - rest2.a) > 0.1, `a muscle car at 55 km/h did not shove the parked sedan: moved ${moved.toFixed(1)}, turned ${(shoved.a - rest2.a).toFixed(2)}`);
    t.assert(shoved.hp < rest2.hp, `the shoved sedan took no damage: ${rest2.hp} -> ${shoved.hp}`);
    await t.keys([], 8);
    const settled = await t.call('damageReport', id);
    t.assert(settled.speed < 2 && Math.abs(settled.spin) < 0.05, `the sedan never came to rest: speed ${settled.speed}, spin ${settled.spin}`);
    t.finite(settled, 'sedan after the shove');

    // A rocket's blast beside it: thrown and hurt.
    const shotAt = await t.call('damageReport', id);
    await t.call('teleport', shotAt.x - 140, shotAt.y);
    await t.call('blast', shotAt.x, shotAt.y + 30, 1);
    await t.wait(1.5);
    const blasted = await t.call('damageReport', id);
    t.assert(shotAt.hp <= 0 || blasted.hp < shotAt.hp, `the blast did not hurt the sedan: ${shotAt.hp} -> ${blasted.hp}`);
    t.assert(Math.hypot(blasted.x - shotAt.x, blasted.y - shotAt.y) > 2 || Math.abs(blasted.a - shotAt.a) > 0.05, 'the blast did not move the sedan');
    await t.wait(6);

    // The shortcut skipped nothing real while all of that went on.
    await t.wait(5);
    audit = await t.call('settleAudit', 60);
    t.assert(audit.changed === 0, 'settleAudit after the hits: ' + JSON.stringify(audit));
    const rep = await t.call('integrity');
    t.assert(!rep.problems.length, rep.problems.join(' | '));
  } finally {
    await t.call('holdSimulation', false);
    await t.call('god', false);
  }
}
