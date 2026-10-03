// The wreck limit (livingcity-wrecks.js): wrecks and abandoned cars nobody can see are retired after a timeout, the hard
// caps take the longest-lived first, and nothing in view, near the player or belonging to a mission is touched. The retired
// vehicles leave no dangling references (integrity, settleAudit); the harness fails the test on any console error.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  const A = { x: 3000, y: 3000 },
    B = { x: -1400, y: 2100 };
  const ids = (r) => new Set(r.candidates.map((c) => c.id));
  // A parked sedan beside the player, blasted into a wreck; returns its id.
  const wreckAt = async (dx, dy) => {
    // A crowded spot has no clear bay: step along until one is found.
    for (let k = 0; k < 8; k++) {
      try {
        return await wreckOnce(dx + k * 90, dy + (k % 2 ? 1 : -1) * k * 40);
      } catch (e) {
        if (!/No clear vehicle spawn/.test(String(e))) throw e;
      }
    }
    throw Error('no clear bay near ' + dx + ',' + dy);
  };
  const wreckOnce = async (dx, dy) => {
    const id = await t.call('park', 'sedan', dx, dy, 0),
      v = await t.call('damageReport', id);
    await t.call('blast', v.x, v.y, 1);
    return id;
  };

  // ---- Timeouts: a wreck and an abandoned car, left far behind, go after their timeouts; a wreck in view stays.
  await t.call('teleport', A.x, A.y);
  const w1 = await wreckAt(140, 0),
    w2 = await wreckAt(-140, 140);
  // An abandoned car: drive one for a moment (the pass stamps it), then step out into another.
  await t.call('drive', 'sedan');
  await t.wait(2);
  await t.call('drive', 'sedan');
  const mid = await t.call('wreckReport');
  t.assert(mid.limits.wreckSeconds >= 45 && mid.limits.abandonedSeconds >= 170, 'timeouts out of range: ' + JSON.stringify(mid.limits));
  const abandoned = mid.candidates.filter((c) => c.kind === 'abandoned');
  t.assert(abandoned.length === 1, 'the car the player left is not counted as abandoned: ' + JSON.stringify(mid.candidates));
  const u1 = abandoned[0].id;
  // Vinny's truck, driven and left behind by the player, is protected whatever its age.
  await t.call('startMission', 0);
  await t.call('boardMissionVehicle');
  await t.wait(2);
  const truck = (await t.call('missionTargets')).car.id;
  await t.call('drive', 'sedan');
  const held = (await t.call('wreckReport')).candidates.find((c) => c.id === truck);
  t.assert(held && held.holds === 'protected', 'the mission truck is not protected: ' + JSON.stringify(held));
  t.assert((await t.call('wreckReport')).retired.total === 0, 'something retired while the player stood among them');
  await t.call('teleport', B.x, B.y);
  const near = await wreckAt(160, 0); // in view at the new place
  await t.wait(25);
  let r = await t.call('wreckReport');
  t.assert(ids(r).has(w1) && ids(r).has(w2) && ids(r).has(u1), 'retired before the timeout: ' + JSON.stringify(r.retired));
  await t.wait(35); // 60 s unseen: past the wreck timeout, far short of the abandoned one
  r = await t.call('wreckReport');
  t.assert(!ids(r).has(w1) && !ids(r).has(w2), 'the far wrecks stayed past their timeout: ' + JSON.stringify(r.candidates));
  t.assert(ids(r).has(u1), 'the abandoned car went with the wrecks');
  t.assert(ids(r).has(near), 'the wreck in view was retired');
  t.assert(r.retired.byTimeout >= 2, 'retired counts: ' + JSON.stringify(r.retired));
  await t.wait(120);
  await t.wait(8);
  r = await t.call('wreckReport');
  t.assert(!ids(r).has(u1), 'the abandoned car stayed past its timeout');
  t.assert(ids(r).has(near), 'the wreck in view was retired');
  t.assert(ids(r).has(truck), 'the mission truck was retired');
  const integ = await t.call('integrity');
  t.assert(integ.problems.length === 0, 'integrity: ' + JSON.stringify(integ.problems));
  const settle = await t.call('settleAudit');
  t.assert(settle.changed === 0, 'settle audit: ' + JSON.stringify(settle));

  t.note('timeouts ok');
  // ---- The cap: the longest-lived go first, whatever their timeout. Four batches a moment apart in view (nothing may go),
  // then the player leaves: at the next pass the world holds no more than the cap.
  await t.call('teleport', A.x, A.y + 1500);
  const batches = [];
  for (let b = 0; b < 4; b++) {
    const batch = [];
    for (let i = 0; i < 6; i++) batch.push(await wreckAt(-420 + i * 170, b % 2 ? 120 : -120));
    batches.push(batch);
    await t.wait(1.5);
  }
  const full = await t.call('wreckReport');
  t.assert(full.wrecks > full.limits.wreckCap, 'not over the cap: ' + full.wrecks);
  t.assert(batches.flat().every((id) => ids(full).has(id)), 'a wreck in view was retired before the player left: missing ' + JSON.stringify(batches.flat().filter((id) => !ids(full).has(id))) + ' of ' + full.candidates.length + ' ' + JSON.stringify(full.retired) + JSON.stringify(full.last.slice(-4)));
  await t.call('teleport', B.x, B.y);
  await t.wait(3);
  const capped = await t.call('wreckReport');
  t.assert(capped.wrecks <= capped.limits.wreckCap, `over the cap: ${capped.wrecks} wrecks`);
  t.assert(capped.retired.byCap >= 1, 'nothing went by the cap: ' + JSON.stringify(capped.retired));
  const kept = ids(capped),
    age = new Map(full.candidates.map((c) => [c.id, c.age]));
  let youngestGone = -Infinity,
    oldestKept = Infinity;
  for (const id of batches.flat()) {
    if (kept.has(id)) oldestKept = Math.min(oldestKept, age.get(id));
    else youngestGone = Math.max(youngestGone, age.get(id));
  }
  // The age is read before the player left, so an older wreck has the larger age: every one kept is younger than every one gone.
  t.assert(youngestGone >= oldestKept - 1e-6, `a younger wreck went before an older one: youngest gone ${youngestGone}, oldest kept ${oldestKept}`);
  t.assert(batches[0].every((id) => !kept.has(id)), 'the oldest batch was not retired first');
  t.assert(batches[3].every((id) => kept.has(id)), 'the newest batch was retired');

  t.note('wreck cap ok: ' + capped.wrecks);
  // ---- The same for abandoned cars (three past the cap, left one at a time).
  const cap = capped.limits.abandonedCap;
  for (let i = 0; i < cap + 3; i++) {
    await t.call('drive', 'sedan');
    await t.wait(1.2);
  }
  await t.call('teleport', B.x + 2500, B.y);
  await t.wait(3);
  const cars = await t.call('wreckReport');
  t.assert(cars.abandoned <= cap, `over the abandoned cap: ${cars.abandoned}`);
  t.assert(cars.retired.abandoned >= 4, 'abandoned cars were not retired by the cap: ' + JSON.stringify(cars.retired));
  t.assert(!cars.candidates.some((c) => c.kind === 'abandoned' && c.holds === 'near' && c.unseen > 3), 'a near car is not being refreshed');

  const soak = await t.call('soakReport');
  t.assert(soak.bad.count === 0, 'non-finite positions: ' + JSON.stringify(soak.bad));
  t.assert(soak.counts.wreckRetired === cars.retired.total, 'soakReport does not count the retirements');
  const after = await t.call('integrity');
  t.assert(after.problems.length === 0, 'integrity after the caps: ' + JSON.stringify(after.problems));
  t.assert((await t.call('settleAudit')).changed === 0, 'settle audit after the caps');
  t.note(`retired ${JSON.stringify(cars.retired)}; world ${cars.wrecks} wrecks, ${cars.abandoned} abandoned, ${cars.vehicles} vehicles; pass ${cars.lastPass.ms} ms`);
  await t.call('god', false);
}
