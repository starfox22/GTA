// The jump on foot (player-jump.js): a low garden wall that stops a walker is jumped, a 1.75 m street-end
// guardrail still stops the jump, holding the key jumps once, a real Space press jumps on foot, and in a car
// Space is still the handbrake (no jump).
export const fresh = true;

export default async function (t) {
  await t.call('god', true);
  const base = await t.call('jumpReport');
  t.near(base.constants.heightM, 0.45, 0.55, 'jump height (m)');
  t.near(base.constants.airS, 0.55, 0.7, 'air time (s)');
  await t.call('holdSimulation', true);

  // A 0.88 m garden wall on Monarch Isle: walking stops at it, a running jump clears it.
  const found = await t.call('jumpObstacles', 7083, -3834, 80, 6);
  const wall = found.near.find((o) => o.kind === 'garden wall');
  t.assert(wall, 'no garden wall near (7083, -3834): ' + JSON.stringify(found.near));
  const north = wall.y - wall.hy,
    south = wall.y + wall.hy;
  await t.call('teleport', wall.x, south + 40);
  await t.keys('KeyW', 2);
  let s = await t.call('status');
  t.assert(s.y > south, `walking went through the wall: y ${s.y}, wall ${north}..${south}`);
  await t.keys(['KeyW', 'Jump'], 0.2);
  await t.keys('KeyW', 1.2);
  s = await t.call('status');
  t.assert(s.y < north, `the jump did not clear the wall: y ${s.y}, wall ${north}..${south}`);
  let r = await t.call('jumpReport');
  t.assert(r.log.landed >= 1 && !r.state, 'not landed: ' + JSON.stringify(r));
  t.near(r.altitude - r.ground, -0.5, 0.5, 'feet back on the ground (units)');
  t.assert(s.hp === 100, 'the hop hurt: ' + s.hp);

  // Holding the key: one jump, no second one on landing.
  const held = r.log.jumps;
  await t.keys('Jump', 2);
  r = await t.call('jumpReport');
  t.assert(r.log.jumps === held + 1, `holding the jump key jumped ${r.log.jumps - held} times`);

  // A street-end guardrail (1.75 m) stops the jump: the player stays on his side.
  const { streetEnds } = await t.call('barriers');
  let picked = null;
  for (const b of streetEnds) {
    if (b.kind !== 'street end rail') continue;
    const cx = b.x + b.w / 2,
      cy = b.y + b.h / 2,
      alongX = b.w > b.h,
      sides = alongX
        ? [[cx, b.y + b.h + 30, 'KeyW'], [cx, b.y - 30, 'KeyS']]
        : [[b.x + b.w + 30, cy, 'KeyA'], [b.x - 30, cy, 'KeyD']];
    for (const [x, y, key] of sides) {
      const [blocked] = await t.call('solidAt', [[x, y]], 10, true);
      if (!blocked) {
        picked = { b, x, y, key, cx, cy, alongX };
        break;
      }
    }
    if (picked) break;
  }
  t.assert(picked, 'no free approach to a street-end rail');
  const side = (p) => Math.sign(picked.alongX ? p.y - picked.cy : p.x - picked.cx);
  await t.call('teleport', picked.x, picked.y);
  await t.keys(picked.key, 1.5);
  await t.keys([picked.key, 'Jump'], 0.2);
  await t.keys(picked.key, 1.5);
  s = await t.call('status');
  t.assert(side(s) === side(picked), `jumped a 1.75 m guardrail: from ${picked.x},${picked.y} to ${s.x},${s.y}`);

  // The real Space key on foot jumps (the keyboard path, not the console's virtual code).
  await t.call('holdSimulation', false);
  await t.call('teleport', 1000, 1000);
  await t.realWait(0.5);
  const before = (await t.call('jumpReport')).log.jumps;
  await t.keys('Space', 0.2, { real: true });
  await t.realWait(1.5);
  r = await t.call('jumpReport');
  t.assert(r.log.jumps === before + 1, `a real Space press made ${r.log.jumps - before} jumps`);

  // In a car Space is the handbrake: the car slows hard and nobody jumps.
  const id = await t.call('park', 'sedan', 26, 0, 0);
  t.assert(id != null, 'no parked sedan');
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(2);
  s = await t.call('status');
  t.assert(s.vehicle === 'sedan', `not in the car: ${JSON.stringify(s)}`);
  const jumpsInCar = (await t.call('jumpReport')).log.jumps;
  const fast = await t.keys('KeyW', 1.5);
  // The real Space key held 1.2 s of wall clock (coasting loses ~12 % there; the handbrake over half).
  await t.mouse(480, 300, { seconds: 1.2, keys: ['Space'] });
  const slowed = await t.wait(0.02);
  t.note(`speed ${fast.speed} -> ${slowed.speed}`);
  t.assert(fast.speed > 30 && Math.abs(slowed.speed) < fast.speed * 0.7, `Space did not brake the car: ${fast.speed} -> ${slowed.speed}`);
  r = await t.call('jumpReport');
  s = await t.call('status');
  t.assert(s.vehicle === 'sedan' && r.log.jumps === jumpsInCar && !r.state, 'Space in the car jumped or left it: ' + JSON.stringify(r.log));
}
