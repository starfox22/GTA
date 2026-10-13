// A nudge at walking pace (physics-knockdowns.js knockPerson): no harm and no crime, and the person goes down beside
// the car, out of its path, so driving on after a stop does not run them over (runover.js) and make the accident a
// crime. (Thrown 12 units ahead into the path, a respray's car rolling out onto the pavement did exactly that:
// tools/tests/respray-lose-police.mjs failed now and then with stars back at the shop door.)
export const fresh = true;
const SPOT = { x: 420, y: 4600 }; // the airport's open ground, nobody about
export default async function (t) {
  await t.call('god', true);
  await t.call('holdSimulation', true);
  try {
    await t.call('teleport', SPOT.x, SPOT.y);
    await t.call('drive', 'sedan', 0, 0);
    await t.call('repair');
    await t.call('wanted', 0);
    const crimes = (await t.call('policeReport')).crimes.length;
    // Right at the bumper, so there is no time to step aside; the car rolls in at 8 km/h.
    const v = await t.call('runOverVictim', 26, 0, 100, 0);
    await t.call('launch', 2.3);
    let s = null;
    for (let i = 0; i < 10 && !s?.hit; i++) {
      await t.wait(0.1);
      s = await t.call('runOverState');
    }
    t.assert(s.hit && s.down > 0 && s.hp === 100, `the nudge: ${JSON.stringify(s)}`);
    // The car faces east (heading 0): how far off its line they lie is the difference in y.
    const car = await t.call('status'),
      lateral = Math.abs(s.y - car.y);
    t.assert(lateral > 18, `down in the car's path: ${lateral.toFixed(0)} units off its line`);
    t.note(`down ${lateral.toFixed(0)} units off the car's line (victim placed at ${v.x},${v.y})`);
    // Stopped, then on again along the same line while they are still down.
    await t.keys('KeyS', 0.8);
    await t.wait(1.4);
    await t.keys('KeyW', 1.5);
    s = await t.call('runOverState');
    const p = await t.call('policeReport');
    t.assert(s.overruns === 0 && s.hp === 100, `driven over after a nudge: ${JSON.stringify(s)}`);
    t.assert(p.crimes.length === crimes && p.stars === 0, `a crime for a nudge: ${JSON.stringify(p.crimes)}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
