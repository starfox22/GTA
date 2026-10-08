// The world reset (world-reset.js): WASTED and a mission pick put the city back as it was at boot. Wreck cars (a blast,
// a crash, bonnet blood), then die: no wrecks, damage, stains, blood, bodies, fires or scorch, the parked coupe by the
// payphone back on its spot unhurt, the test's own cars gone. Then the same for a pick in the mission picker, its call
// taken without a second reset, and RESTART CURRENT JOB. (No-render page: the renderer's decals, panes and props are
// checked by hand with `dev.mjs start --render`.)
export const fresh = true;
const COUPE = { x: 782, y: 576 }; // game-populate.js: the first car populate() parks
const OPEN = { x: 420, y: 4600 }; // the airport's open ground
const CLEAN = ['wrecks', 'abandoned', 'burning', 'stainedCars', 'carStains', 'knockedProps', 'bloodPools', 'bleeders', 'severedParts', 'goreStumps', 'bodies', 'fires', 'scorch', 'wanted'];
function clean(t, now, what) {
  const dirty = CLEAN.filter((k) => now[k]);
  t.assert(!dirty.length, what + ': not reset: ' + dirty.map((k) => k + '=' + now[k]).join(', ') + ' ' + JSON.stringify(now));
}
async function wreckSome(t) {
  await t.call('teleport', OPEN.x, OPEN.y);
  await t.call('drive', 'sedan', 0, 0);
  await t.call('carBloodMark', 'front', 70, true);
  const crash = await t.call('crashTest', 'sedan', 'sedan', 'left', 25, 1.5);
  await t.call('teleport', OPEN.x, OPEN.y + 200);
  const parked = await t.call('park', 'sedan', 160, 0, 0),
    v = await t.call('damageReport', parked);
  await t.call('blast', v.x, v.y, 1);
  await t.wait(0.5);
  return [crash.car.id, crash.target.id, parked];
}
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('god', false);
    const coupe = await t.call('vehicleAt', COUPE.x, COUPE.y);
    t.assert(coupe && Math.hypot(coupe.x - COUPE.x, coupe.y - COUPE.y) < 3, 'no parked car at the payphone spot: ' + JSON.stringify(coupe));

    // ---- WASTED.
    const ours = await wreckSome(t);
    await t.call('blast', COUPE.x, COUPE.y, 1); // the coupe goes up too, far from the player
    await t.wait(0.5);
    const mid = (await t.call('worldResetReport')).now;
    t.assert(mid.wrecks >= 2 && mid.carStains > 0 && mid.damaged >= 1, 'the setup did not wreck enough: ' + JSON.stringify(mid));
    t.assert((await t.call('damageReport', coupe.id))?.hp <= 0, 'the coupe was not wrecked');
    await t.call('teleport', OPEN.x, OPEN.y + 600);
    await t.wait(3.2); // past the teleport's invulnerability
    const at = await t.call('status');
    await t.call('blast', at.x, at.y, 3);
    await t.wait(0.5);
    t.assert((await t.call('status')).mode === 'dead', 'not killed');
    await new Promise((r) => setTimeout(r, 4800)); // WASTED runs on the wall clock
    let r = await t.call('worldResetReport');
    t.assert(r.byReason.wasted === 1 && r.last.reason === 'wasted', 'no reset on WASTED: ' + JSON.stringify(r));
    clean(t, r.last.after, 'WASTED');
    t.assert(r.last.after.damaged === 0, 'damaged cars after WASTED: ' + r.last.after.damaged);
    const back = await t.call('vehicleAt', COUPE.x, COUPE.y),
      backDamage = await t.call('damageReport', back.id);
    t.assert(back.type === coupe.type && Math.hypot(back.x - COUPE.x, back.y - COUPE.y) < 3 && Math.abs(back.a - coupe.a) < 0.01, 'the coupe is not back on its spot: ' + JSON.stringify(back));
    t.assert(backDamage.hp === backDamage.maxhp && !backDamage.dents.length, 'the coupe came back hurt: ' + JSON.stringify(backDamage));
    for (const id of ours) t.assert((await t.call('damageReport', id)) === null, 'a test car outlived the reset: ' + id);
    const s = await t.call('status');
    t.assert(s.mode === 'play' && s.hp === 100, 'not back on his feet: ' + JSON.stringify(s));

    // ---- A pick in the mission picker, then its call taken (no second reset), then RESTART CURRENT JOB.
    await wreckSome(t);
    t.assert((await t.call('worldResetReport')).now.wrecks >= 1, 'no wreck before the pick');
    await t.call('teleport', OPEN.x, OPEN.y); // on foot
    const c = await t.call('chooseMission', 0);
    t.assert(c.chosen && c.mode === 'dialogue', 'the pick: ' + JSON.stringify(c));
    r = await t.call('worldResetReport');
    t.assert(r.byReason.mission === 1 && r.last.reason === 'mission', 'no reset on the pick: ' + JSON.stringify(r.byReason));
    clean(t, r.last.after, 'mission pick');
    await t.keys('Enter', 0.2, { real: true }); // take the call
    let m = await t.call('missionState');
    t.assert(m.index === 0, 'the call did not start the job: ' + JSON.stringify(m));
    r = await t.call('worldResetReport');
    t.assert(!r.byReason.job && r.count === 2, 'the call reset the world again: ' + JSON.stringify(r.byReason));
    await t.call('teleport', OPEN.x, OPEN.y);
    await t.call('park', 'sedan', 160, 0, 0);
    await t.call('blast', OPEN.x + 160, OPEN.y, 1);
    await t.wait(0.3);
    m = await t.call('retryMission');
    t.assert(m.index === 0 && m.stage === 0, 'RESTART: ' + JSON.stringify(m));
    r = await t.call('worldResetReport');
    t.assert(r.byReason.retry === 1, 'no reset on RESTART CURRENT JOB: ' + JSON.stringify(r.byReason));
    clean(t, r.now, 'restart');
    const g = await t.call('integrity');
    t.assert(!g.problems.length, 'integrity after the resets: ' + JSON.stringify(g.problems));
  } finally {
    await t.call('holdSimulation', false);
  }
}
