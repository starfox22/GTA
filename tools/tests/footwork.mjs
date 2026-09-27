// Footwork (footwork.js): facing the aim, a backpedal goes at 60 % of the run, a
// side-step at 80 %, forwards at the full pace; with no aim held the body faces the
// way it runs at the full pace.
// Fresh: it holds movement keys, after which sportsbook-bets (run on the shared page
// before the fresh tests) no longer settles its bet (seen on the lead branch too).
export const fresh = true;
export default async function (t) {
  const start = await t.call('status');
  await t.call('god', true);
  const home = { x: 1500, y: 1500 }; // open ground on every side
  // Distance covered in 0.6 s from the same spot, holding `key`, with the aim held
  // north (270 degrees) or let go (null).
  const moved = async (key, aim) => {
    await t.call('footwork', aim);
    await t.call('teleport', home.x, home.y);
    const a = await t.call('status');
    await t.keys(key, 0.6);
    const b = await t.call('status');
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  const share = async (key) => (await moved(key, 270)) / (await moved(key, null));
  const free = await t.call('footwork', null);
  t.assert(free.faces === 'travel' || free.heading === null, 'no aim: ' + JSON.stringify(free));
  t.near(await share('KeyS'), 0.52, 0.68, 'backpedal share (aim north, moving south)');
  t.near(await share('KeyD'), 0.72, 0.88, 'side-step share (aim north, moving east)');
  t.near(await share('KeyW'), 0.9, 1.1, 'forward share (aim north, moving north)');
  const report = await t.call('footwork', 270);
  t.assert(report.faces === 'aim', 'standing still with an aim held the body faces it');
  await t.call('footwork', null);
  // Leave the page as it was for the tests that follow on it.
  await t.call('teleport', start.x, start.y);
  await t.call('god', false);
}
