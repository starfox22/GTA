// Mission 4 (Borrowed Stripes, fortjob.js): the lockpick from Vinny, Kessler pulling away from his house on Broadway the
// moment the job starts, in a pristine car that stays pristine on his way (a knock from the world is mended at once), his
// road route to the Marea, the tail's heat when the player sits on his bumper, no "lost him" message far behind him (the
// objective stays on his car), then his last approach: parked opposite the club, out and across to the door, in.
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
  t.assert(r.stage === 1 && r.lockpick && r.car?.occupied && /KESSLER/.test(r.instruction) && /MAREA/.test(r.instruction), 'Kessler on his way at once, with the lockpick: ' + JSON.stringify(r));
  t.assert(r.car.x > 700 && r.car.x < 1150 && Math.abs(r.car.y - 3160) < 30 && r.car.route > 30, 'his car at his kerb on Broadway with a road route to the Marea: ' + JSON.stringify(r.car));
  t.assert(r.target && Math.hypot(r.target.x - r.car.x, r.target.y - r.car.y) < 5, 'the objective is his car: ' + JSON.stringify(r));
  let b = await t.call('missionBrief');
  t.assert(/leaving his house on Broadway/.test(b.queued || b.text || ''), 'the opening brief names his house: ' + JSON.stringify(b));
  const pristine = (q) => q.car.condition.hp === 1 && q.car.condition.dents === 0 && q.car.condition.sprung.length === 0 && q.car.condition.stains === 0 && !q.car.condition.door && !q.car.condition.trunkOpen;
  t.assert(pristine(r), 'a pristine car as he leaves: ' + JSON.stringify(r.car.condition));
  // Pulling out: under way along the boulevard to the causeway, still pristine.
  r = await until(t, 'pulling away from his house', (q) => q.car.kmh > 20 && q.car.routeIndex >= 2, 15);
  t.assert(pristine(r), 'still pristine under way: ' + JSON.stringify(r.car.condition));
  // A knock from the world on his way leaves no mark (the player nowhere near).
  await t.call('dentVehicle', r.car.id, 'right', 45);
  await t.wait(0.3);
  r = await t.call('fortJob');
  t.assert(pristine(r), 'a knock on his way is mended: ' + JSON.stringify(r.car.condition));
  // Far behind him: nothing says he was lost, the objective stays on his car.
  await t.call('teleport', 2400, 600);
  await t.wait(20);
  r = await t.call('fortJob');
  b = await t.call('missionBrief');
  t.assert(r.stage === 1 && !/LOST/i.test(r.instruction) && !/lost/i.test(JSON.stringify(b)) && !r.waitClub, 'no lost message: ' + JSON.stringify(r) + ' ' + JSON.stringify(b));
  t.assert(r.target && Math.hypot(r.target.x - r.car.x, r.target.y - r.car.y) < 40, 'the objective still on his car: ' + JSON.stringify(r));
  t.assert(!/lost/i.test(r.line || ''), 'no lost line: ' + r.line);
  // Catch up behind him in a car.
  const ahead = r.car.behind;
  await t.call('teleport', ahead.x, ahead.y);
  await t.call('drive', 'sedan', 0, 0);
  r = await until(t, 'he is moving', (q) => q.car.kmh > 20, 25);
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
  t.assert(pristine(r), 'parked in pristine condition: ' + JSON.stringify(r.car.condition));
  r = await until(t, 'Kessler goes in', (q) => q.stage === 3 && q.inside && !q.kessler, 25);
  t.assert(/PICK KESSLER’S TRUNK/.test(r.instruction), 'trunk stage: ' + r.instruction);
}
