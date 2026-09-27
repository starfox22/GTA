// Mission 2's ambulance when the job ends before it pulls up: it is parked at the stop
// (not left circling its county route), and the next run of the job clears it away.
export const fresh = true;
const STOP = { x: -1618, y: 2661 }; // ROOF_AMBULANCE.stop (roofmission-poison.js)
const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('roofPlace', 292, 152); // beside the VIP table, every guard looking away
    for (const [i, x, y, a] of [
      [0, 60, 130, Math.PI],
      [1, 330, 60, -Math.PI / 2],
      [2, 330, 300, 0],
      [3, 160, 60, -Math.PI / 2],
    ])
      await t.call('roofGuard', i, x, y, a);
    await t.call('roofSuspicion', 0);
    let p = await t.call('spikeGlass');
    t.assert(p.phase === 'approach', 'glass not spiked: ' + JSON.stringify(p));
    await t.call('roofPlace', 100, 260);
    for (let i = 0; i < 60 && p.phase !== 'dead'; i++) {
      await t.wait(0.5);
      p = await t.call('roofPoison');
    }
    t.assert(p.phase === 'dead', 'Vescari did not go down: ' + p.phase);
    await t.call('roofGuard', -1);
    // Down the lift at once, and wait at the doors for the ambulance to set off.
    await t.call('roofPlace', 60, 290);
    await t.call('interact');
    await t.wait(3);
    let m = await t.call('missionState');
    t.assert(m.stage === 4, 'not down on the street: ' + JSON.stringify(m));
    for (let i = 0; i < 40 && !p.medical?.ambulance; i++) {
      await t.wait(0.5);
      p = await t.call('roofPoison');
    }
    t.assert(p.medical?.ambulance && !p.medical.ambulance.parked, 'no ambulance on its way: ' + JSON.stringify(p.medical));
    // Walk away before it arrives: the job is won with the ambulance still driving.
    await t.call('teleport', -1330, 2624);
    await t.wait(0.5);
    m = await t.call('missionState');
    t.assert(m.last?.result === 'won' && m.last.index === 1, 'mission not won: ' + JSON.stringify(m));
    const parked = await t.call('vehicleAt', STOP.x, STOP.y);
    t.assert(parked?.type === 'ambulance' && near(parked, STOP, 12), 'the ambulance did not pull up: ' + JSON.stringify(parked));
    await t.wait(20);
    const later = await t.call('vehicleAt', STOP.x, STOP.y);
    t.assert(later?.id === parked.id && near(later, parked, 3), 'the ambulance drove off: ' + JSON.stringify(later));
    // The job again: last run's ambulance no longer holds the stop.
    await t.call('startMission', 1);
    const replay = await t.call('vehicleAt', STOP.x, STOP.y);
    t.assert(replay?.id !== parked.id, 'the last run’s ambulance is still at the stop: ' + JSON.stringify(replay));
  } finally {
    await t.call('holdSimulation', false);
  }
}
