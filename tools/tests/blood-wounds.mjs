// Blood (blood.js): one round leaves a spatter and drops, never a pool; a body on the
// ground bleeds a pool that starts small and spreads over tens of seconds, larger after
// several rounds; a blast pools at once and sprays round the body.
export const fresh = true;
const SPOTS = [
  [420, 4600],
  [420, 4900],
  [720, 4600],
  [720, 4900],
]; // the airport's open ground, nobody about
async function victim(t, [x, y], hits, damage, kind) {
  await t.call('teleport', x, y);
  const v = await t.call('bloodVictim', hits, damage, kind, 50);
  await t.wait(1.2); // the drops land
  return v;
}
const report = (t, v) => t.call('bloodReport', v.x, v.y, 70);
export default async function (t) {
  await t.call('god', true);
  await t.call('holdSimulation', true);
  try {
    // One round into a bystander who lives: spatter and drops, no pool.
    const one = await victim(t, SPOTS[0], 1, 20, 'ballistic');
    t.assert(!one.dead && one.hp > 0, `one round killed: ${JSON.stringify(one)}`);
    let r = await report(t, one);
    t.assert(r.near.pool === 0, `a pool from one round: ${JSON.stringify(r)}`);
    t.assert(r.near.spatter >= 1 && r.near.drop >= 1, `no spatter or drops from a round: ${JSON.stringify(r)}`);
    t.assert(r.largest < 4.5, `a round's blood too large: ${JSON.stringify(r)}`);

    // A body killed by one round: a small pool that spreads over tens of seconds.
    const dead = await victim(t, SPOTS[1], 1, 400, 'headshot');
    t.assert(dead.dead, `the headshot did not kill: ${JSON.stringify(dead)}`);
    r = await report(t, dead);
    t.assert(r.pools.length === 1, `one pool under the body: ${JSON.stringify(r.pools)}`);
    const early = r.pools[0].r;
    t.assert(early < 2.5, `the pool is full at once: ${JSON.stringify(r.pools)}`);
    await t.wait(10);
    const mid = (await report(t, dead)).pools[0].r;
    await t.wait(20);
    r = await report(t, dead);
    const late = r.pools[0].r;
    t.assert(early < mid && mid < late, `the pool does not spread: ${early} -> ${mid} -> ${late}`);
    t.assert(late > 3 && late <= r.pools[0].rMax + 0.01 && late < 7, `a one-round pool after 30 s: ${late}`);
    t.note(`one round: pool r ${early} -> ${mid} (10 s) -> ${late} (30 s), rMax ${r.pools[0].rMax}`);

    // Several rounds before death: a larger pool, filling faster.
    const many = await victim(t, SPOTS[2], 8, 20, 'ballistic');
    t.assert(many.dead, `eight rounds did not kill: ${JSON.stringify(many)}`);
    await t.wait(30);
    r = await report(t, many);
    t.assert(r.pools.length === 1 && r.pools[0].r > late + 0.5, `several rounds, no larger pool: ${JSON.stringify(r.pools)} vs ${late}`);
    t.note(`several rounds: pool r ${r.pools[0].r} (30 s), rMax ${r.pools[0].rMax}`);

    // A blast: a pool at once and a spray round the body.
    const blast = await victim(t, SPOTS[3], 1, 400, 'blast');
    t.assert(blast.dead, `the blast did not kill: ${JSON.stringify(blast)}`);
    r = await report(t, blast);
    t.assert(r.pools.length === 1 && r.pools[0].r >= 3, `no immediate pool from a blast: ${JSON.stringify(r)}`);
    t.assert(r.near.spatter >= 4, `no spray round a blast: ${JSON.stringify(r.near)}`);
    t.assert(r.total <= 240, `blood decals unbounded: ${r.total}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
