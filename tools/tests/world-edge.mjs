// World-edge countdown (world-edge.js): past the line just inside the world box the player has 10 s
// (game time) to return or the vehicle blows up and WASTED; back inside cancels it; god mode is only
// warned; on foot or swimming the player simply dies; a teleport and a respawn restart it; a pause holds it.
export const fresh = true;
const WEST = Math.PI;
async function edge(t) {
  return t.call('worldEdge');
}
// A plane (from the Southport apron) or a boat (from open water) set 40 units inside the west line, heading out.
async function setOut(t, type, x = -4888, y = 1500, heading = WEST) {
  const air = type === 'plane' || type === 'helicopter';
  if (['speedboat', 'jetski'].includes(type)) await t.call('teleport', -1986, 5950);
  else await t.call('teleport', 418, 5000);
  await t.call('drive', type, air ? 300 : 0, heading);
  await t.call('placeVehicle', x, y, heading, air ? 300 : 0);
  if (type === 'plane') await t.call('launch', 60);
  else if (type !== 'helicopter') await t.call('launch', 20);
}
async function dead(t) {
  const s = await t.call('status');
  return s.mode === 'dead';
}
async function respawned(t) {
  await new Promise((r) => setTimeout(r, 4800)); // WASTED runs on the wall clock
  await t.wait(0.3);
}
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    const report = await edge(t);
    t.assert(report.seconds === 10 && !report.active && report.cue === null, 'starts idle: ' + JSON.stringify(report));
    // The line is clear of every piece of land (cars and people never meet it) and inside the box.
    for (const side of ['left', 'top', 'right', 'bottom'])
      t.assert(report.landGap[side] > 0, `land reaches the line on the ${side}: ${JSON.stringify(report.landGap)}`);
    t.assert(report.line.left > report.box.left && report.line.bottom < report.box.bottom, 'line inside the box');

    // 1. A plane crosses the line: 10 at once, counting down in game seconds, with the card up.
    await setOut(t, 'plane');
    await t.wait(0.4);
    let e = await edge(t);
    t.assert(e.active && e.left > 9.4 && e.left <= 10 && e.cue.count === 10, 'countdown starts at 10: ' + JSON.stringify(e.cue));
    t.assert(e.shown && e.count === '10', 'card shows 10: ' + e.count);
    t.assert(e.cue.way === 'EAST' && Math.abs(e.cue.turn - 90) < 25, 'arrow points back east: ' + JSON.stringify(e.cue));
    const t0 = e.left;
    await t.wait(3);
    e = await edge(t);
    t.near(t0 - e.left, 2.8, 3.2, 'three game seconds');
    t.assert(e.cue.count === Math.ceil(e.left) && e.count === String(e.cue.count), 'count follows the clock: ' + e.count + ' ' + e.left);
    t.assert(e.cue.state === 'count' || e.cue.state === 'warn', 'state ' + e.cue.state);
    await t.wait(4);
    e = await edge(t);
    t.assert(e.cue.state === 'danger' || e.cue.state === 'warn', 'late state ' + e.cue.state);

    // 2. Turning back inside the line cancels it (the all-clear shows briefly, then clears).
    await t.call('placeVehicle', -4000, 1500, 0, 300);
    await t.wait(0.3);
    e = await edge(t);
    t.assert(!e.active && e.left === 10 && e.cue && e.cue.state === 'clear', 'back inside: ' + JSON.stringify(e));
    await t.wait(3);
    e = await edge(t);
    t.assert(e.cue === null && e.history.some((h) => h.kind === 'back'), 'all-clear gone: ' + JSON.stringify(e));
    let s = await t.call('status');
    t.assert(s.mode === 'play' && s.vehicle === 'plane', 'still flying: ' + JSON.stringify(s));

    // 3. Not running while paused (simulation time only).
    await t.call('placeVehicle', -4888, 1500, WEST, 300);
    await t.call('launch', 60);
    await t.wait(0.5);
    const before = (await edge(t)).left;
    await t.call('pauseMenu', true);
    await t.wait(3);
    e = await edge(t);
    t.assert(Math.abs(e.left - before) < 0.05, `ran while paused: ${before} -> ${e.left}`);
    await t.call('pauseMenu', false);
    await t.wait(1);
    e = await edge(t);
    t.near(before - e.left, 0.85, 1.15, 'resumes after the pause');

    // 4. A teleport restarts it: inside cancels, another spot outside starts again at 10.
    await t.call('teleport', 0, 0);
    e = await edge(t);
    t.assert(!e.active && e.left === 10 && e.cue === null, 'teleport inside cancels: ' + JSON.stringify(e));
    await setOut(t, 'plane');
    await t.wait(4);
    await t.call('teleport', -4950, 2000);
    await t.wait(0.2);
    e = await edge(t);
    t.assert(e.active && e.left > 9.6, 'a teleport out starts afresh: ' + e.left);
    await t.call('teleport', 418, 5000);

    // 5. God mode is warned, nothing is destroyed.
    await setOut(t, 'plane');
    await t.call('god', true);
    await t.wait(11);
    e = await edge(t);
    t.assert(e.active && e.left === 0 && e.spared && e.shown && e.cue.god, 'god mode warned: ' + JSON.stringify(e.cue));
    s = await t.call('status');
    t.assert(s.mode === 'play' && s.vehicle === 'plane', 'god mode survives: ' + JSON.stringify(s));
    await t.call('god', false);

    // 6. At zero the plane explodes and the pilot is WASTED; the respawn starts clean.
    await setOut(t, 'plane');
    await t.wait(9.5);
    s = await t.call('status');
    t.assert(s.mode === 'play' && s.vehicle === 'plane', 'alive at 0.5 s: ' + JSON.stringify(s));
    await t.wait(1.3);
    t.assert(await dead(t), 'plane pilot not wasted at zero: ' + JSON.stringify(await t.call('status')));
    e = await edge(t);
    t.assert(e.history.some((h) => h.kind === 'fatal' && h.vehicle === 'plane'), 'fatal recorded: ' + JSON.stringify(e.history));
    await respawned(t);
    s = await t.call('status');
    e = await edge(t);
    t.assert(s.mode === 'play' && !e.active && e.left === 10 && e.cue === null && !e.outside, 'respawn is clean: ' + JSON.stringify({ s, e: e.cue }));

    // 7. A boat: the same countdown and the same end.
    await t.wait(3.2);
    await setOut(t, 'speedboat', -4900, 3000);
    await t.wait(0.5);
    e = await edge(t);
    t.assert(e.active && e.left > 9 && e.shown, 'boat countdown: ' + JSON.stringify(e.cue));
    await t.wait(10);
    t.assert(await dead(t), 'boater not wasted: ' + JSON.stringify(await t.call('status')));
    e = await edge(t);
    t.assert(e.history.some((h) => h.kind === 'fatal' && h.vehicle === 'speedboat'), 'boat fatal: ' + JSON.stringify(e.history));
    await respawned(t);

    // 8. On foot in the water: no vehicle, the player simply dies at zero.
    await t.wait(3.2);
    await t.call('teleport', -4940, 3000);
    await t.wait(0.5);
    e = await edge(t);
    t.assert(e.active && e.cue.count === 10, 'swimmer countdown: ' + JSON.stringify(e.cue));
    await t.wait(10);
    t.assert(await dead(t), 'swimmer not wasted: ' + JSON.stringify(await t.call('status')));
    e = await edge(t);
    t.assert(e.history.some((h) => h.kind === 'fatal' && h.vehicle === null), 'swimmer fatal: ' + JSON.stringify(e.history));
    await respawned(t);
    e = await edge(t);
    t.assert(!e.active && e.left === 10, 'clean after the swimmer: ' + JSON.stringify(e));
  } finally {
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
