// Riders off a bike (riders.js, falls-body.js riderInjury): the injury follows the speed.
// A low-speed spill into a wall costs a few points, a moderate one hurts and the rider gets
// up, and neither leaves blood; a fast one into a wall kills and the body pools.
export const fresh = true;

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // A quiet block with a building face at the end of a clear run (physics-console rideIntoWall).
    let r = await t.call('rideIntoWall', 'bike', 25, 8, 20, 2500, 2500);
    t.assert(!r.error, 'a wall with a run-up: ' + JSON.stringify(r).slice(0, 160));
    let throw_ = r.throws.at(-1);
    t.assert(throw_?.cause === 'crash', `thrown at 25 km/h: ${JSON.stringify(throw_)}`);
    t.assert(!r.dead && r.hp >= 90, `a 25 km/h spill costs a few points: hp ${r.hp}`);
    t.assert(r.onFoot && !r.thrown, `back on their feet: ${JSON.stringify(r.thrown)}`);
    t.assert(r.bloodNear === 0, `no blood from a spill: ${r.bloodNear}`);
    const slow = r.hp;

    r = await t.call('rideIntoWall', 'bike', 45, 10, 20, 2500, 2500);
    throw_ = r.throws.at(-1);
    t.assert(!r.dead && r.hp > 60 && r.hp < 95, `45 km/h into a wall hurts, not badly: hp ${r.hp}`);
    t.assert(throw_.strikeKmh > 25 && !throw_.knockedOut, `struck the wall, not out cold: ${JSON.stringify(throw_)}`);
    t.assert(r.onFoot && !r.thrown, 'got up again');
    t.assert(r.bloodNear === 0, `a fall survived draws no blood: ${r.bloodNear}`);
    t.note(`25 km/h: hp ${slow}; 45 km/h: hp ${r.hp} (into the wall at ${throw_.strikeKmh} km/h)`);

    // Fast into the wall: the body into it is fatal (RIDER_STRIKE_LETHAL), and it pools.
    r = await t.call('rideIntoWall', 'bike', 110, 5, 20, 2500, 2500);
    throw_ = r.throws.at(-1);
    t.assert(r.dead, `110 km/h into a wall kills: hp ${r.hp} ${JSON.stringify(throw_)}`);
    t.assert(r.poolsNear >= 1, `the dead rider pools: ${r.poolsNear}`);

    // Traffic's rider (flat out) over a sedan: hurt, alive, no blood.
    r = await t.call('rideInto', 'bike', 45, 'sedan', 20, 8, true);
    throw_ = r.throws.at(-1);
    t.assert(throw_?.who === 'traffic', `traffic's rider thrown: ${JSON.stringify(throw_)}`);
    t.assert(throw_.personHp > 0 && throw_.personHp < 70, `traffic rider hurt, alive: ${throw_.personHp}`);
    t.assert(r.bloodNear === 0, `no blood from traffic's spill: ${r.bloodNear}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
