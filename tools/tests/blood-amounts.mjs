// Blood by calibre, range and zone (blood.js HOW MUCH A ROUND LETS OUT, gore.js goreHit): the plan grows from a
// leg to the torso to the head, from a pistol to a rifle to a .50, and for a shotgun from 20 m to point blank;
// a real point-blank load leaves more on the ground than a pistol round; the spray marks a wall or a parked car
// only within its reach; and nothing lands toward the shooter.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  await t.call('holdSimulation', true);
  try {
    const p = await t.call('bloodPlanTable');
    t.note(`plan: ${Object.entries(p).map(([k, v]) => `${k} ${v.scale}/${v.drops}/${v.spatters}/${v.reach}m`).join(', ')}`);
    const grows = (names, field) => {
      for (let i = 1; i < names.length; i++)
        t.assert(p[names[i]][field] > p[names[i - 1]][field], `${field}: ${names[i]} (${p[names[i]][field]}) not above ${names[i - 1]} (${p[names[i - 1]][field]})`);
    };
    grows(['9mm 15 m leg', '9mm 15 m torso', '9mm 15 m head'], 'drops');
    grows(['9mm 15 m torso', 'rifle 15 m torso', '.50 30 m torso'], 'drops');
    grows(['9mm 15 m torso', 'rifle 15 m torso', '.50 30 m torso'], 'reach');
    grows(['shotgun 20 m leg', 'shotgun 6 m leg', 'shotgun 4 m leg', 'shotgun 1.5 m leg'], 'scale');
    grows(['shotgun 20 m leg', 'shotgun 6 m leg', 'shotgun 4 m leg'], 'drops');
    t.assert(p['rifle 3 m torso'].drops > p['rifle 15 m torso'].drops, 'a rifle round lets out no more at 3 m than at 15 m');
    t.assert(p['shotgun 1.5 m leg'].burst > 0.5 && p['shotgun 20 m leg'].burst === 0, 'the point-blank burst');
    // A pistol round at mid range keeps the old spray (3 + 4 x severity drops, two spatters).
    t.assert(p['9mm 15 m torso'].scale === 1 && p['9mm 15 m torso'].drops === 9 && p['9mm 15 m torso'].spatters === 2, `the 9mm baseline: ${JSON.stringify(p['9mm 15 m torso'])}`);

    // Live: a point-blank load against a pistol round, both into the torso, side by side.
    await t.call('goreSeed', 3);
    await t.call('teleport', 420, 4600);
    const pistol = await t.call('goreShot', 'civilian', 0, 15, 'torso');
    await t.call('teleport', 720, 4900);
    const shotgun = await t.call('goreShot', 'civilian', 2, 1.5, 'torso');
    await t.wait(1.5);
    const a = await t.call('bloodReport', pistol.x, pistol.y, 70),
      b = await t.call('bloodReport', shotgun.x, shotgun.y, 70),
      marks = (r) => r.near.spatter + r.near.drop;
    t.note(`ground marks: pistol ${marks(a)} ${JSON.stringify(a.near)}, point-blank shotgun ${marks(b)} ${JSON.stringify(b.near)}`);
    t.assert(marks(b) > marks(a) * 1.5, `a point-blank load left no more blood than a pistol round: ${marks(b)} vs ${marks(a)}`);
    // The exit spray and the burst land beyond the body, none toward the shooter (a stump's spurts aside).
    const sides = await t.call('bloodSides', shotgun.x, shotgun.y, shotgun.a, 70);
    t.note(`point-blank sides: ${JSON.stringify(sides)}`);
    if (!shotgun.lost.length) t.assert(sides.uprange === 0 && sides.downrange > 10, `point-blank spray toward the shooter: ${JSON.stringify(sides)}`);

    // A wall a metre behind takes the spray of a point-blank load; eight metres behind, a pistol's does not reach.
    await t.call('teleport', 1750, 1350);
    const near = await t.call('goreWallShot', 2, 1.5, 1, 'torso');
    t.assert(near.wall >= 1, `no blood on a wall a metre behind a point-blank load: ${JSON.stringify(near)}`);
    await t.call('teleport', 2400, 1900);
    const far = await t.call('goreWallShot', 0, 2, 8, 'torso');
    t.assert(far.wall === 0, `a pistol's spray reached a wall 8 m behind: ${JSON.stringify(far)}`);
    t.note(`walls: point blank ${near.wall}, pistol 8 m ${far.wall}`);

    // A parked car a metre behind takes a stain from a point-blank load; ten metres behind, none.
    await t.call('teleport', 420, 4900);
    const car = await t.call('goreCarShot', 2, 1.5, 1, 'torso');
    t.assert(car.stains >= 1, `no stain on a car a metre behind: ${JSON.stringify(car)}`);
    await t.call('teleport', 560, 4650);
    const carFar = await t.call('goreCarShot', 0, 3, 10, 'torso');
    t.assert(carFar.stains === 0, `a pistol's spray stained a car 10 m behind: ${JSON.stringify(carFar)}`);
    t.note(`cars: point blank ${car.stains} (${car.stainSev}), pistol 10 m ${carFar.stains}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
