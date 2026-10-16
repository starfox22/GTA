// Real swept bumper contacts launch players and pedestrians through the same
// bounded gravity-driven arc, including fatal hits; a survivor gets up and walks.
import fs from 'node:fs';
import vm from 'node:vm';

export const fresh = true;

export default async function (t) {
  // A settled corpse must not inherit idle head-look, sway or breathing from
  // the living rig when the clock advances. Run the actual pose target source.
  const read = (name) => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    scope = vm.createContext({ UNITS_PER_METRE: 8, gameTime: 0,
      hitFlinch: () => 0, personFallAmount: () => 1,
      clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)) }),
    pose = vm.runInContext(read('crowd3d-joints') + read('crowd3d-poses').split('      const ikS =')[0] + `
      (time) => {
        gameTime = time;
        const p = { hp: 0, ejected: { vehicleHit: true, phase: 'down', time: 4, pitch: Math.PI / 2, vz: 0, z: 0 } };
        const target = new Float32Array(J_COUNT);
        crowdPoseTargets(p, { seed: 0.37 }, target, time, null);
        return Array.from(target);
      }`, scope),
    rest = JSON.stringify(pose(0));
  for (const time of [0.2, 1, 2.7, 9, 40]) t.assert(JSON.stringify(pose(time)) === rest, 'settled corpse has idle motion at ' + time);
  await t.call('holdSimulation', true);
  await t.call('sky', 'clear');
  try {
    await t.call('god', true);
    await t.call('vehicleImpactScene', 'player', 'sedan', 70);
    await t.wait(0.15);
    let a = await t.call('vehicleImpactState');
    t.assert(a.active && a.phase === 'air' && a.vz > 0, 'player was not launched: ' + JSON.stringify(a));
    const start = a;
    await t.wait(0.3);
    a = await t.call('vehicleImpactState');
    t.assert(a.heightM > start.heightM && a.x > start.x + 12, 'no rising forward flight: ' + JSON.stringify(a));
    // True gravity: the vertical speed falls by 9.81 m/s each second, and the
    // launch keeps bounded forward momentum instead of teleporting the body.
    t.near(start.vz - a.vz, 2.7, 3.2, 'gravity over 0.3 s');
    t.assert(a.pitch !== start.pitch && a.heightM > 1.8, 'no airborne tumble/clearance: ' + JSON.stringify(a));
    t.finite(a, 'player in flight');
    await t.wait(1.8);
    a = await t.call('vehicleImpactState');
    t.assert(a.bounces > 0 && a.heightM < 0.3, 'no grounded landing: ' + JSON.stringify(a));
    let recovery = false;
    for (let i = 0; i < 100 && a.active; i++) {
      await t.wait(0.1);
      a = await t.call('vehicleImpactState');
      recovery ||= a.phase === 'recover' && a.recovery > 0;
    }
    t.assert(recovery && !a.active, 'survivor never recovered: ' + JSON.stringify(a));
    const x = a.x, y = a.y;
    await t.keys('KeyS', 0.6);
    a = await t.call('vehicleImpactState');
    t.assert(Math.hypot(a.x - x, a.y - y) > 12, 'walking not restored after recovery');

    // Frontal geometry matters: a tall truck pushes the torso ahead more than
    // the ramp of a sedan; a corner strike imparts bounded sideways momentum.
    await t.call('vehicleImpactScene', 'player', 'truck', 70);
    await t.wait(0.15);
    const truck = await t.call('vehicleImpactState');
    t.assert(truck.vz < start.vz - 1, 'tall front launched like a low bonnet: ' + JSON.stringify(truck));
    await t.call('vehicleImpactScene', 'player', 'sedan', 70, 0.9);
    await t.wait(0.15);
    const edge = await t.call('vehicleImpactState');
    t.assert(Math.abs(edge.vy) > 0.5 && Math.abs(edge.bank) > 0.05, 'edge strike has no deflection/twist: ' + JSON.stringify(edge));

    // Fatal initial NPC damage must not stop its physics or create a pool at
    // take-off. Keep the real death/witness path and settle the corpse on land.
    await t.call('vehicleImpactScene', 'pedestrian', 'sedan', 90, 0, 30);
    await t.wait(0.15);
    const deadStart = await t.call('vehicleImpactState');
    t.assert(deadStart.dead && deadStart.phase === 'air' && !deadStart.pool, 'fatal hit froze/pooled at bumper: ' + JSON.stringify(deadStart));
    await t.wait(0.5);
    let dead = await t.call('vehicleImpactState');
    t.assert(dead.dead && dead.x > deadStart.x + 20 && dead.heightM > 2, 'dead NPC stopped in air: ' + JSON.stringify(dead));
    await t.wait(6);
    dead = await t.call('vehicleImpactState');
    t.assert(dead.phase === 'down' && dead.pool && dead.overruns === 0, 'corpse did not settle once: ' + JSON.stringify(dead));
    t.finite(dead, 'settled corpse');

    // WASTED still carries the player's corpse to the road. The ordinary
    // simulator stops at death, so use the fixture's exact physics-step method.
    await t.call('god', false);
    await t.call('vehicleImpactScene', 'player', 'sedan', 110);
    let fatal = await t.call('vehicleImpactAdvance', 0.15);
    t.assert(fatal.dead && fatal.active && fatal.phase === 'air' && !fatal.pool, 'fatal player did not retain flight: ' + JSON.stringify(fatal));
    const fatalX = fatal.x;
    fatal = await t.call('vehicleImpactAdvance', 0.6);
    t.assert(fatal.dead && fatal.x > fatalX + 20 && fatal.heightM > 2, 'WASTED froze the airborne player: ' + JSON.stringify(fatal));
    fatal = await t.call('vehicleImpactAdvance', 5);
    t.assert(fatal.dead && fatal.phase === 'down' && fatal.pool, 'fatal player never landed/pooled: ' + JSON.stringify(fatal));
    await t.call('god', true);

    // A nonfatal NPC follows the same launch instead of the old instant lying
    // pose. Secondary landings must leave it recoverable and not double-runover.
    await t.call('vehicleImpactScene', 'pedestrian', 'sedan', 30, 0, 100);
    await t.wait(0.25);
    let npc = await t.call('vehicleImpactState');
    t.assert(!npc.dead && npc.phase === 'air' && npc.heightM > 0.95, 'living NPC not airborne: ' + JSON.stringify(npc));
    await t.wait(8);
    npc = await t.call('vehicleImpactState');
    t.assert(!npc.dead && !npc.active && npc.overruns === 0, 'NPC did not recover: ' + JSON.stringify(npc));
    const inv = await t.call('integrity');
    t.assert(inv.problems.length === 0, inv.problems.join(' | '));
  } finally {
    await t.call('god', true);
    await t.call('teleport', 420, 4600);
    await t.call('holdSimulation', false);
  }
}
