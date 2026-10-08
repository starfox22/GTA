// Mission 4 (Borrowed Stripes): shot at in his car, Kessler radios the fort (fortjob.js fortAlerted): five stars at
// once, the KESSLER ALERTED THE MILITARY headline and a red brief, Kessler out and running, the keys left in the car;
// the trunk then opens with them. Waiting at the Marea instead (fortClubWait): his car is put on its last approach
// out of sight and he parks opposite the door.
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
  await t.call('startMission', 3);
  let b = await t.call('missionBrief');
  t.assert(/steal a military uniform/.test(b.queued || b.text || ''), 'the opening brief: ' + JSON.stringify(b));
  await t.call('teleport', 7740, 8070);
  let r = await until(t, 'Kessler leaves the fort', (q) => q.stage === 1 && q.car?.occupied, 14);
  await t.wait(2);
  r = await t.call('fortJob');
  await t.call('arm', 0);
  await t.call('teleport', r.car.x - 150, r.car.y + 40);
  await t.call('fireShot', r.car.x, r.car.y);
  await t.wait(1);
  r = await t.call('fortJob');
  t.assert(r.alerted && r.keys && r.stage === 3 && /OPEN KESSLER’S TRUNK/.test(r.instruction), 'alerted, keys in the car: ' + JSON.stringify(r));
  t.assert(r.kessler && r.kessler.hp > 0 && !r.car.occupied, 'Kessler out of the car: ' + JSON.stringify(r));
  const s = await t.call('status');
  t.assert(s.wanted === 5, 'five stars at once: ' + JSON.stringify(s));
  b = await t.call('missionBrief');
  t.assert(/radioed the fort/.test(b.queued || b.text || '') && (b.tone === 'alert' || b.queued), 'the alert brief: ' + JSON.stringify(b));

  // Waiting at the club instead: he arrives and parks.
  await t.call('wanted', 0);
  await t.call('startMission', 3);
  await t.call('teleport', -2700, 5150);
  r = await until(t, 'he leaves the fort on his own', (q) => q.stage === 1 && q.car?.occupied, 45);
  r = await until(t, 'waiting at the Marea', (q) => q.waitClub, 5);
  t.assert(/WAIT FOR KESSLER/.test(r.instruction), 'the club wait objective: ' + r.instruction);
  r = await until(t, 'his car put on its last approach', (q) => q.jumped, 25);
  // (City traffic at the Marina Rd junction can hold him a while.)
  r = await until(t, 'parked at the Marea', (q) => q.stage >= 2, 100, 2);
  t.assert(Math.abs(r.car.y - 5220) < 40 && !r.car.occupied, 'parked opposite the door: ' + JSON.stringify(r.car));
}
