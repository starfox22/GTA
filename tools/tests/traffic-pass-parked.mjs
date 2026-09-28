// Traffic pulls out round a parked van that fills its lane (physics-traffic.js), from well back
// and from close behind its bumper, and gets by without shoving it: caught nose to tail it once
// pushed the parked car along the kerb (Mission 2's parked ambulance moved 1 m in 15 s).
export const fresh = true;
// Eastbound on a narrow street, 150 units past a junction (the next one is planned 330
// units ahead, and traffic never pulls out round a car that close to a junction).
const VAN = { x: 790, y: 640 };
export default async function (t) {
  await t.call('god', true);
  await t.call('setClock', 14);
  await t.call('teleport', VAN.x, VAN.y + 90);
  await t.wait(1);
  await t.call('holdSimulation', true);
  try {
    for (const [gap, kmh] of [
      [120, 30],
      [52, 5],
    ]) {
      // Nobody else on the street: no traffic, no police, no crowd within 1,600 units.
      await t.call('witnessStage', 0, false, 1600, false, false, true);
      const start = await t.call('parkedPass', VAN.x, VAN.y, 0, gap, 0, 'van', kmh);
      t.assert(start && start.car && start.parked, 'no room to stage the pass');
      let s = start,
        widest = 0,
        passedAt = null;
      for (let i = 0; i < 40 && passedAt === null; i++) {
        await t.wait(0.5);
        s = await t.call('parkedPassState');
        widest = Math.max(widest, s.car.left);
        if (s.passed) passedAt = (i + 1) * 0.5;
      }
      t.note(`from ${gap} back at ${kmh} km/h: out to ${widest} left of the lane line, by after ${passedAt} s, the van shoved ${s.parked.moved} units`);
      t.assert(passedAt !== null, `the car never got by (from ${gap} back): ` + JSON.stringify(s));
      t.assert(s.parked.moved < 2, `the parked van was shoved ${s.parked.moved} units (from ${gap} back)`);
    }
  } finally {
    await t.call('holdSimulation', false);
    await t.call('god', false);
  }
}
