// Open-sea countdown (world-edge.js): nothing over land or near it; 10 s (game time) heading away from all land
// starts RETURN TO THE CITY with 10 s more; heading back winds it up and clears it; at zero a missile comes in
// and kills the player in whatever they are in (a plane, a boat, swimming); god mode is only warned; a pause
// holds it; a teleport and a respawn restart it.
export const fresh = true;
const WEST = Math.PI,
  EAST = 0;
async function edge(t) {
  return t.call('worldEdge');
}
// A plane (from the Southport apron) or a boat (from open water) set at (x, y), heading out.
async function setOut(t, type, x, y, heading, speed) {
  const air = type === 'plane' || type === 'helicopter';
  if (['speedboat', 'jetski'].includes(type)) await t.call('teleport', -1986, 5950);
  else await t.call('teleport', 418, 5000);
  await t.call('drive', type, air ? 300 : 0, heading);
  await t.call('placeVehicle', x, y, heading, air ? 300 : 0);
  if (speed) await t.call('launch', speed);
}
async function dead(t) {
  return (await t.call('status')).mode === 'dead';
}
async function respawned(t) {
  await new Promise((r) => setTimeout(r, 4800)); // WASTED runs on the wall clock
  await t.wait(0.3);
}
// Steps until `test(report)` holds (or `limit` game s, `key` held); returns [report, seconds waited].
async function until(t, test, limit, key, step = 0.5) {
  let r = await edge(t),
    waited = 0;
  for (; !test(r) && waited < limit; waited += step) {
    if (key) await t.keys(key, step);
    else await t.wait(step);
    r = await edge(t);
  }
  return [r, waited];
}
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    const report = await edge(t);
    t.assert(report.seconds === 10 && report.awaySeconds === 10 && !report.active && report.cue === null, 'starts idle: ' + JSON.stringify(report.cue));
    for (const side of ['left', 'top', 'right', 'bottom'])
      t.assert(report.landGap[side] > 0, `land reaches the line on the ${side}: ${JSON.stringify(report.landGap)}`);
    const RIGHT = report.line.right;

    // 0. Over land nothing shows, right up to the end of the map: a plane east over the county, 600 units short of
    //    its east coast (which ends 42 units short of the old edge line), flying on out to sea.
    await setOut(t, 'plane', RIGHT - 700, 9000, EAST, 45);
    let [e] = await until(t, (r) => r.landMetres > 0, 6);
    t.assert(e.cue === null && !e.active, 'warned over land: ' + JSON.stringify(e.cue));
    // Out over the sea, flying away: still nothing for the first 10 s past 150 m out.
    let waited;
    [e, waited] = await until(t, (r) => r.landMetres >= r.openSea, 20);
    t.assert(e.out < 0.6 && e.cue === null, 'counting before open sea: ' + JSON.stringify([e.out, e.landMetres]));
    await t.wait(8);
    e = await edge(t);
    t.assert(e.out > 7 && e.out < 9 && e.cue === null && !e.active, 'shown before 10 s away: ' + JSON.stringify([e.out, e.cue]));
    [e, waited] = await until(t, (r) => r.active, 4, null, 0.25);
    t.assert(e.active && waited <= 2.5, 'countdown after 10 s away: ' + JSON.stringify([e.out, waited]));
    await t.wait(0.3);
    e = await edge(t);
    t.assert(e.shown && e.cue.count === 10 && e.count === '10', 'card shows 10: ' + JSON.stringify(e.cue));
    t.assert(e.cue.way === 'WEST' && Math.abs(Math.abs(e.cue.turn) - 90) < 30, 'arrow points back to land: ' + JSON.stringify(e.cue));
    t.assert(!/EDGE/.test(e.note) && /LAND .* HEAD WEST/.test(e.note), 'no world edge in the words: ' + e.note);
    const t0 = e.left;
    await t.wait(3);
    e = await edge(t);
    t.near(t0 - e.left, 2.8, 3.2, 'three game seconds');
    t.assert(e.cue.count === Math.ceil(e.left) && e.count === String(e.cue.count), 'count follows the clock: ' + e.count + ' ' + e.left);

    // 1. Heading back for land winds it up (calm 'back' card), and far enough back it clears.
    await t.call('placeVehicle', (await t.call('status')).x, 9000, WEST, 300);
    await t.call('launch', 45);
    await t.wait(1.5);
    e = await edge(t);
    t.assert(e.active && e.back && e.cue.state === 'back' && /HEADING BACK/.test(e.note), 'heading back: ' + JSON.stringify([e.cue, e.awaySpeed]));
    const wound = e.left;
    await t.wait(1);
    e = await edge(t);
    t.assert(e.left > wound + 0.8, 'the seconds wind back up: ' + wound + ' -> ' + e.left);
    [e] = await until(t, (r) => !r.active, 12);
    t.assert(!e.active && e.cue && e.cue.state === 'clear', 'cleared on the way back: ' + JSON.stringify(e.cue));
    await t.wait(3);
    e = await edge(t);
    t.assert(e.cue === null && e.history.some((h) => h.kind === 'back'), 'all-clear gone: ' + JSON.stringify(e.cue));
    let s = await t.call('status');
    t.assert(s.mode === 'play' && s.vehicle === 'plane', 'still flying: ' + JSON.stringify(s));

    // 2. A helicopter hovering far out at sea is not flying away: nothing builds up.
    await setOut(t, 'helicopter', RIGHT + 2000, 9000, EAST);
    await t.wait(12);
    e = await edge(t);
    t.assert(e.landMetres > 150 && e.out < 1 && !e.active, 'hovering counted as flying away: ' + JSON.stringify([e.out, e.awaySpeed]));
    // Far past the map the countdown starts at once.
    await t.call('placeVehicle', RIGHT + 7600, 9000, EAST, 300);
    await t.wait(0.5);
    e = await edge(t);
    t.assert(e.active && e.left > 9, 'far past the map starts the countdown: ' + JSON.stringify([e.out, e.depth]));

    // 3. Not running while paused (simulation time only).
    const before = e.left;
    await t.call('pauseMenu', true);
    await t.wait(3);
    e = await edge(t);
    t.assert(Math.abs(e.left - before) < 0.05, `ran while paused: ${before} -> ${e.left}`);
    await t.call('pauseMenu', false);
    await t.wait(1);
    e = await edge(t);
    t.near(before - e.left, 0.85, 1.15, 'resumes after the pause');

    // 4. A teleport restarts it.
    await t.call('teleport', 418, 5000);
    e = await edge(t);
    t.assert(!e.active && e.out === 0 && e.cue === null, 'teleport cancels: ' + JSON.stringify(e.cue));

    // 5. God mode is warned, nothing is fired or destroyed.
    await setOut(t, 'helicopter', RIGHT + 7600, 9000, EAST);
    await t.call('god', true);
    await t.wait(11);
    e = await edge(t);
    t.assert(e.active && e.left === 0 && e.spared && !e.missile && e.shown && e.cue.god && /GOD MODE/.test(e.note), 'god mode warned: ' + JSON.stringify(e.cue));
    s = await t.call('status');
    t.assert(s.mode === 'play' && s.vehicle === 'helicopter', 'god mode survives: ' + JSON.stringify(s));
    await t.call('god', false);

    // 6. At zero the missile comes in from the coast and the pilot is WASTED; the respawn starts clean.
    await setOut(t, 'plane', RIGHT + 7600, 9000, EAST, 60);
    await t.wait(9.5);
    s = await t.call('status');
    e = await edge(t);
    t.assert(s.mode === 'play' && s.vehicle === 'plane' && !e.missile, 'alive at 0.5 s: ' + JSON.stringify(s));
    await t.wait(0.7);
    e = await edge(t);
    t.assert(e.fired && e.missile && e.cue.state === 'missile' && e.count === '!', 'missile fired at zero: ' + JSON.stringify([e.cue, e.missile]));
    t.assert(e.missile.x < (await t.call('status')).x, 'the missile comes from the coast side: ' + JSON.stringify(e.missile));
    let flight = 0;
    for (; flight < 6 && !(await dead(t)); flight += 0.25) await t.wait(0.25);
    t.assert(await dead(t), 'plane pilot not wasted by the missile: ' + JSON.stringify(await t.call('status')));
    t.note('missile reached a plane flying away in ' + flight + ' s');
    const integ = await t.call('integrity');
    t.assert(!integ.problems.some((p) => /off the map/.test(p)), 'integrity flags the WASTED pilot: ' + integ.problems.join(' | '));
    e = await edge(t);
    t.assert(e.history.some((h) => h.kind === 'fatal' && h.vehicle === 'plane'), 'fatal recorded: ' + JSON.stringify(e.history));
    await respawned(t);
    s = await t.call('status');
    e = await edge(t);
    t.assert(s.mode === 'play' && !e.active && !e.missile && e.out === 0 && e.cue === null, 'respawn is clean: ' + JSON.stringify({ s, e: e.cue }));

    // 7. A boat sailing out: the same rule and the same end.
    await t.wait(3.2);
    await setOut(t, 'speedboat', -4700, 3000, WEST);
    [e, waited] = await until(t, (r) => r.active, 25, 'KeyW');
    t.assert(e.active && e.landMetres > 150, 'boat countdown: ' + JSON.stringify([e.out, e.landMetres, e.v]));
    t.note('boat sailing west from Palm Keys: countdown after ' + waited + ' s, ' + e.landMetres + ' m out');
    [e] = await until(t, (r) => r.fired, 12, 'KeyW');
    for (flight = 0; flight < 6 && !(await dead(t)); flight += 0.25) await t.wait(0.25);
    t.assert(await dead(t), 'boater not wasted: ' + JSON.stringify(await t.call('status')));
    e = await edge(t);
    t.assert(e.history.some((h) => h.kind === 'fatal' && h.vehicle === 'speedboat'), 'boat fatal: ' + JSON.stringify(e.history));
    await respawned(t);

    // 8. Swimming far out: no vehicle, the missile still kills.
    await t.wait(3.2);
    await t.call('teleport', RIGHT + 7600, 9000);
    await t.wait(0.5);
    e = await edge(t);
    t.assert(e.active && e.canReach, 'swimmer countdown: ' + JSON.stringify([e.cue, e.canReach]));
    await t.wait(10);
    for (flight = 0; flight < 6 && !(await dead(t)); flight += 0.25) await t.wait(0.25);
    t.assert(await dead(t), 'swimmer not wasted: ' + JSON.stringify(await t.call('status')));
    e = await edge(t);
    t.assert(e.history.some((h) => h.kind === 'fatal' && h.vehicle === null), 'swimmer fatal: ' + JSON.stringify(e.history));
    await respawned(t);
    e = await edge(t);
    t.assert(!e.active && e.out === 0, 'clean after the swimmer: ' + JSON.stringify(e.cue));
  } finally {
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
