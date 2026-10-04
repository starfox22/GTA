// Restarting a job from the pause menu (story.js retryMission) moves the player to the spawn through teleportPlayer, which
// lets go of everything that carries them: a fall in progress (it keeps its own height and would drop them from it at
// the spawn), a parachute, the superyacht's deck.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  const carriers = async () => (await t.call('integrity')).carriers;
  const spawn = { x: 748, y: 584 };
  const restart = async (what) => {
    const m = await t.call('retryMission');
    t.assert(m && m.index === 0 && !m.last, `${what}: the restart did not start the job: ` + JSON.stringify(m));
    const c = await carriers();
    t.assert(!c.fall && !c.parachute && !c.deck && !c.climbing && !c.pool, `${what}: still carried after the restart: ` + JSON.stringify(c));
    const s = await t.call('status');
    t.assert(Math.hypot(s.x - spawn.x, s.y - spawn.y) < 60, `${what}: not at the spawn: ${s.x},${s.y}`);
    await t.wait(4);
    const after = await t.call('status');
    t.assert(after.mode === 'play' && Math.hypot(after.x - spawn.x, after.y - spawn.y) < 120, `${what}: pulled away from the spawn: ${after.x},${after.y} (${after.mode})`);
    const rep = await t.call('integrity');
    t.assert(!rep.problems.length, `${what}: ` + rep.problems.join(' | '));
  };

  // A job to restart (RESTART CURRENT JOB restarts only a job running or failed).
  await t.call('startMission', 0);

  // A fall in progress: off the lethal cliff, caught a moment after the edge.
  let fell = false;
  for (const s of [1.1, 1.4, 1.8]) {
    await t.call('fallTest', 'walk-cliff', s);
    if ((await carriers()).fall) {
      fell = true;
      break;
    }
  }
  if (fell) await restart('a fall');
  else t.note('no fall to restart from (cliff not reached)');

  // A parachute jump.
  await t.call('bailOut', 250, 1200, 800);
  t.assert((await carriers()).parachute, 'no parachute after bailOut');
  await restart('a parachute');

  // The superyacht's deck.
  await t.call('boardYacht');
  t.assert((await carriers()).deck, 'not on the yacht deck after boardYacht');
  await restart('the yacht deck');

  // A train ride (the free-roam bug pass): teleportPlayer left transitRide set, so the train pulled the player
  // straight back aboard after a restart.
  await t.call('boardTrain', 0, 2);
  await t.wait(3);
  t.assert((await carriers()).transit, 'not riding after boardTrain');
  await restart('a train ride');
  t.assert(!(await carriers()).transit, 'still riding the train after the restart');

  // A cab ride, then the console's drive(): the ride held the player and the new car in place.
  await t.call('cab', 2650, 1250);
  await t.wait(3);
  t.assert((await carriers()).taxi, 'not riding after cab()');
  await t.call('drive', 'sport', 0, 0);
  const c = await carriers();
  t.assert(!c.taxi && !c.transit, 'drive() left a ride running: ' + JSON.stringify(c));
  const before = await t.call('status');
  await t.keys('KeyW', 1.6);
  const after = await t.call('status');
  t.assert(after.vehicle === 'sport' && Math.hypot(after.x - before.x, after.y - before.y) > 30, `the car did not move: ${before.x},${before.y} -> ${after.x},${after.y}`);
}
