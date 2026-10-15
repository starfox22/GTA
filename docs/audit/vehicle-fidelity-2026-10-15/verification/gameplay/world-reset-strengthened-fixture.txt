// The world reset (world-reset.js): WASTED and BUSTED put the city back as it was at boot; taking a job never does.
// Wreck cars (a blast, a crash, bonnet blood), then die: no wrecks, damage, stains, blood, bodies, fires or scorch, the
// parked coupe by the payphone back on its spot unhurt, the test's own cars gone. Then a pick in the mission picker
// and its call taken with two stars: the wreck and the stars are still there, no reset. RESTART CURRENT JOB: no reset
// either. Then BUSTED during the job: the city clean again. (No-render page: the renderer's decals, panes and props are
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

    // A live deducted stake is progress across the city reset, not world damage.
    await t.call('matchDay', 1, 10);
    await t.wait(1 / 30);
    await t.call('setCash', 1000);
    await t.call('sportsbookFormat', 'american');
    const wager = await t.call('sportsbookBet', 'result', 'home', 100),
      bookBefore = await t.call('sportsbook');
    t.assert(!wager.error && wager.cash === 900, 'live progress bet setup: ' + JSON.stringify(wager));
    t.assert(bookBefore.open.some(b => b.id === wager.id), 'no deducted stake before WASTED');

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
    const deadStatus = await t.call('status');
    t.assert(deadStatus.mode === 'dead', 'not killed');
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
    await t.wait(1 / 30); // existing restore policy settles the rebuilt live match
    const bookAfter = await t.call('sportsbook'),
      returned = bookAfter.settled.find(b => b.id === wager.id);
    t.assert(returned?.status === 'void' && returned.payout === 100, 'WASTED lost deducted stake: ' + JSON.stringify(bookAfter));
    t.assert(bookAfter.cash === Math.max(0, deadStatus.cash - 250) + 100, 'WASTED refund did not reach wallet: ' + JSON.stringify(bookAfter));
    t.assert(bookAfter.stats.placed === bookBefore.stats.placed && bookAfter.stats.staked === bookBefore.stats.staked &&
      bookAfter.stats.void === bookBefore.stats.void + 1 && bookAfter.stats.returned === bookBefore.stats.returned + 100,
      'WASTED lost betting history/statistics: ' + JSON.stringify(bookAfter.stats));
    t.assert(bookAfter.format === 'american', 'WASTED lost odds format');
    await t.wait(1 / 30);
    const once = await t.call('sportsbook');
    t.assert(once.cash === bookAfter.cash && JSON.stringify(once.stats) === JSON.stringify(bookAfter.stats), 'WASTED stake refunded twice');

    // ---- A pick in the mission picker, then its call taken (the payphone's accept) with two stars: no reset at all.
    await wreckSome(t);
    const wrecksBefore = (await t.call('worldResetReport')).now.wrecks;
    t.assert(wrecksBefore >= 1, 'no wreck before the pick');
    await t.call('teleport', OPEN.x, OPEN.y); // on foot
    const c = await t.call('chooseMission', 0);
    t.assert(c.chosen && c.mode === 'dialogue', 'the pick: ' + JSON.stringify(c));
    r = await t.call('worldResetReport');
    t.assert(r.count === 1 && !r.byReason.mission, 'the pick reset the world: ' + JSON.stringify(r.byReason));
    t.assert(r.now.wrecks >= wrecksBefore, 'the pick took the wrecks: ' + r.now.wrecks + ' < ' + wrecksBefore);
    await t.call('wanted', 2);
    await t.keys('Enter', 0.2, { real: true }); // take the call
    let m = await t.call('missionState');
    t.assert(m.index === 0 && (await t.call('status')).mode === 'play', 'the call did not start the job: ' + JSON.stringify(m));
    t.assert(m.wanted >= 2, 'taking the call lost the police: ' + JSON.stringify(m));
    r = await t.call('worldResetReport');
    t.assert(r.count === 1 && !r.byReason.job, 'the call reset the world: ' + JSON.stringify(r.byReason));
    t.assert(r.now.wrecks >= wrecksBefore && r.now.wanted >= 2, 'the call did not keep the world: ' + JSON.stringify(r.now));
    await t.call('wanted', 0);

    // ---- RESTART CURRENT JOB: the job starts again, the world carries on (a fresh wreck stays).
    await t.call('teleport', OPEN.x, OPEN.y);
    await t.call('park', 'sedan', 160, 0, 0);
    await t.call('blast', OPEN.x + 160, OPEN.y, 1);
    await t.wait(0.3);
    const wrecksRestart = (await t.call('worldResetReport')).now.wrecks;
    m = await t.call('retryMission');
    t.assert(m.index === 0 && m.stage === 0, 'RESTART: ' + JSON.stringify(m));
    r = await t.call('worldResetReport');
    t.assert(r.count === 1 && !r.byReason.retry, 'RESTART CURRENT JOB reset the world: ' + JSON.stringify(r.byReason));
    t.assert(r.now.wrecks >= wrecksRestart && wrecksRestart >= 1, 'RESTART took the wrecks: ' + JSON.stringify(r.now));

    // ---- BUSTED during the job: the job fails and the city is put back.
    await t.call('teleport', OPEN.x, OPEN.y + 600);
    await t.wait(0.2);
    const busted = await t.call('arrest');
    t.assert(busted.mode === 'dead', 'not arrested: ' + JSON.stringify(busted));
    await new Promise((r) => setTimeout(r, 4800)); // BUSTED runs on the wall clock
    r = await t.call('worldResetReport');
    t.assert(r.byReason.busted === 1 && r.last.reason === 'busted' && r.count === 2, 'no reset on BUSTED: ' + JSON.stringify(r.byReason));
    clean(t, r.last.after, 'BUSTED');
    m = await t.call('missionState');
    t.assert((await t.call('status')).mode === 'play' && !m.mission && m.last?.result === 'failed', 'BUSTED did not fail the job: ' + JSON.stringify(m));
    const g = await t.call('integrity');
    t.assert(!g.problems.length, 'integrity after the resets: ' + JSON.stringify(g.problems));
    const kept = await t.call('sportsbook');
    t.assert(kept.settled.some(b => b.id === wager.id && b.status === 'void' && b.payout === 100), 'BUSTED discarded settled betting history');
    t.assert(kept.stats.placed === bookAfter.stats.placed && kept.stats.staked === bookAfter.stats.staked &&
      kept.stats.void === bookAfter.stats.void && kept.stats.returned === bookAfter.stats.returned,
      'BUSTED discarded betting statistics or refunded again: ' + JSON.stringify(kept.stats));
    t.note('live $100 stake survives WASTED as one void/refund; odds format/history/statistics remain after BUSTED');
  } finally {
    await t.call('holdSimulation', false);
  }
}
