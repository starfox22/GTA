// Mission 4 (Borrowed Stripes, fortjob.js): the lockpick from Vinny, Kessler leaving Fort Sentinel through the
// gate once the player watches from the causeway's end, his road route to the Marea, the tail's heat when the
// player sits on his bumper, then his last approach: parked opposite the club, out and across to the door, in.
export const fresh = true;
async function until(t, label, test, seconds, step = 1) {
  let r = await t.call('fortJob');
  for (let s = 0; s < seconds && !test(r); s += step) {
    await t.wait(step);
    r = await t.call('fortJob');
  }
  t.assert(test(r), label + ': ' + JSON.stringify(r));
  return r;
}
export default async function (t) {
  let s = await t.call('startMission', 3);
  t.assert(s.mission === 'Borrowed Stripes', 'mission 4 is Borrowed Stripes: ' + JSON.stringify(s));
  let r = await t.call('fortJob');
  t.assert(r.stage === 0 && r.lockpick && /GATE/.test(r.instruction), 'stakeout stage with the lockpick: ' + JSON.stringify(r));
  // Watching from the causeway's end in a car: he comes out.
  await t.call('teleport', 7700, 8090);
  await t.call('drive', 'sedan', 0, 0);
  r = await until(t, 'Kessler leaves the fort', (q) => q.stage === 1 && q.car, 10);
  t.assert(r.car.route > 100 && r.car.occupied, 'a road route to the Marea: ' + JSON.stringify(r.car));
  r = await until(t, 'out through the gate', (q) => q.car.x < 9200 && q.car.kmh > 20, 25);
  // Right on his bumper while he drives: he notices.
  await t.call('holdSimulation', true);
  try {
    for (let i = 0; i < 4; i++) {
      r = await t.call('fortJob');
      const back = Math.atan2(r.car.behind.y - r.car.y, r.car.behind.x - r.car.x);
      await t.call('placeVehicle', r.car.x + Math.cos(back) * 55, r.car.y + Math.sin(back) * 55, r.car.a);
      await t.wait(0.5);
    }
    r = await t.call('fortJob');
    t.assert(r.tailHeat > 0.2 && r.stage === 1, 'no heat on his bumper: ' + JSON.stringify(r));
  } finally {
    await t.call('holdSimulation', false);
  }
  // His last approach: parked opposite the club, across the road and in.
  r = await t.call('fortSkip', 'arrive');
  r = await until(t, 'parked at the Marea', (q) => q.stage === 2 && !q.car.occupied && q.kessler?.walking, 25);
  t.assert(Math.abs(r.car.y - 5220) < 30 && r.car.x > -2900 && r.car.x < -2700, 'parked on the north kerb opposite the door: ' + JSON.stringify(r.car));
  r = await until(t, 'Kessler goes in', (q) => q.stage === 3 && q.inside && !q.kessler, 25);
  t.assert(/PICK KESSLER’S TRUNK/.test(r.instruction), 'trunk stage: ' + r.instruction);
}
