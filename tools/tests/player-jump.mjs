// The jump on foot (player-jump.js): a Monarch Isle villa's 1.35 m garden wall stops a walker and a walking-pace
// jump, a running jump vaults it; a 1.75 m street-end guardrail still stops the jump; the 1.49 m sea railing on a
// quay stops a walker and a running jump vaults it into the sea, swimming unhurt with a way out; holding the key
// jumps once, a real Space press jumps on foot (the grunt plays every time), and in a car Space is still the
// handbrake (no jump).
export const fresh = true;

export default async function (t) {
  await t.call('god', true);
  const base = await t.call('jumpReport');
  t.near(base.constants.heightM, 0.45, 0.55, 'jump height (m)');
  t.near(base.constants.airS, 0.55, 0.7, 'air time (s)');
  await t.call('holdSimulation', true);

  // A villa's 1.35 m garden wall on Monarch Isle: walking stops at it, so does a jump at a walk; a running jump
  // vaults it (a hand on the top).
  const found = await t.call('jumpObstacles', 7083, -3834, 80, 6);
  const wall = found.near.find((o) => o.kind === 'garden wall');
  t.assert(wall, 'no garden wall near (7083, -3834): ' + JSON.stringify(found.near));
  t.near(wall.heightM, 1.3, 1.4, 'villa garden wall (m)');
  t.assert(wall.vault, 'the garden wall is not a vault: ' + JSON.stringify(wall));
  const north = wall.y - wall.hy,
    south = wall.y + wall.hy;
  await t.call('teleport', wall.x, south + 40);
  await t.keys('KeyW', 2);
  let s = await t.call('status');
  t.assert(s.y > south, `walking went through the wall: y ${s.y}, wall ${north}..${south}`);
  await t.keys(['KeyW', 'Walk', 'Jump'], 0.2);
  await t.keys(['KeyW', 'Walk'], 1.2);
  s = await t.call('status');
  let r = await t.call('jumpReport');
  t.assert(s.y > south && !r.log.vaults, `a jump at a walk cleared the 1.35 m wall: y ${s.y}, ${JSON.stringify(r.log)}`);
  await t.keys(['KeyW', 'Jump'], 0.2);
  await t.keys('KeyW', 1.2);
  s = await t.call('status');
  t.assert(s.y < north, `the running jump did not vault the wall: y ${s.y}, wall ${north}..${south}`);
  r = await t.call('jumpReport');
  t.assert(r.log.landed >= 2 && r.log.vaults === 1 && r.log.last.vault && !r.state, 'not landed from a vault: ' + JSON.stringify(r));
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

  // The sea railing on a quay (Ironworks Docks, the bay to the east): walking stops at it; a running jump vaults it
  // and drops into the sea, where he swims (no harm), with a ladder or a beach to climb out at.
  const rails = (await t.call('jumpObstacles', 3417, 1152, 200, 40)).near.filter((o) => o.kind === 'sea railing' && o.hx > 15 && Math.abs(Math.sin(o.a)) > 0.99);
  t.assert(rails.length, 'no straight sea railing near (3417, 1152)');
  let quay = null;
  for (const rail of rails) {
    const [west, east] = [await t.call('probe', rail.x - 24, rail.y, 3), await t.call('probe', rail.x + 24, rail.y, 3)];
    if (west.land && !west.solid && !east.ground) quay = { rail, from: rail.x - 60, key: 'KeyD', sea: 1 };
    else if (east.land && !east.solid && !west.ground) quay = { rail, from: rail.x + 60, key: 'KeyA', sea: -1 };
    if (quay) break;
  }
  t.assert(quay, 'no sea railing with the quay on one side and the sea on the other: ' + JSON.stringify(rails.slice(0, 3)));
  const railX = quay.rail.x,
    railY = quay.rail.y,
    seaSide = (x) => (x - railX) * quay.sea > 0;
  await t.call('teleport', quay.from, railY);
  await t.keys(quay.key, 2.5);
  s = await t.call('status');
  t.assert(!seaSide(s.x) && !(await t.call('swim')).swimming, `walking went over the sea railing: x ${s.x}, rail ${railX}`);
  const intoWater = r.log.intoWater;
  await t.keys([quay.key, 'Jump'], 0.2);
  await t.keys(quay.key, 2);
  s = await t.call('status');
  const swim = await t.call('swim');
  r = await t.call('jumpReport');
  t.note(`sea railing at ${railX},${railY}: landed ${s.x},${s.y}; ${JSON.stringify(r.log.last)}`);
  t.assert(seaSide(s.x) && swim.swimming, `the running jump did not end in the sea: x ${s.x}, rail ${railX}, swim ${JSON.stringify(swim)}`);
  t.assert(r.log.intoWater === intoWater + 1 && r.log.last.vault, 'not a vault into the water: ' + JSON.stringify(r.log));
  t.assert(s.hp === 100, 'the jump into the sea hurt: ' + s.hp);
  t.assert(swim.nearestExit && swim.nearestExit.d < 600, 'no way out of the water near: ' + JSON.stringify(swim.nearestExit));

  // The real Space key on foot jumps (the keyboard path, not the console's virtual code).
  await t.call('holdSimulation', false);
  await t.call('teleport', 1000, 1000);
  await t.realWait(0.5);
  const before = (await t.call('jumpReport')).log.jumps;
  await t.keys('Space', 0.2, { real: true });
  await t.realWait(1.5);
  r = await t.call('jumpReport');
  t.assert(r.log.jumps === before + 1, `a real Space press made ${r.log.jumps - before} jumps`);
  // Every take-off asks for the effort ("huh", player-jump-audio.js); with sound on it plays, quietly.
  const e = r.effort;
  t.note(`effort: ${JSON.stringify(e)}`);
  t.assert(e.asked === r.log.jumps, `effort asked ${e.asked} times for ${r.log.jumps} jumps`);
  t.assert(e.loaded, 'the jump grunt sample is not loaded');
  if (e.sound) t.assert(e.played === e.asked && e.last && e.last.level <= 0.3 && e.last.rate > 0.85 && e.last.rate < 1.15, `effort: ${JSON.stringify(e)}`);

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
