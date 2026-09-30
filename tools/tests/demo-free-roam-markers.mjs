// Public demo (demo gate live): after mission 2 and CONTINUE FREE ROAM no story pointer is left
// (objective, navigation pill, payphone), also after a replay is picked and hung up; an active
// replay still shows its pointer.
export const flags = 'test';
export const fresh = true;
export default async function (t) {
  const none = (p, label) => {
    t.assert(p.objective === null && !p.navigation && p.bearing === null && !p.payphoneRinging, `${label}: a pointer is left ${JSON.stringify(p)}`);
    t.assert(/FREE ROAM/.test(p.distanceLine), `${label}: distance line ${p.distanceLine}`);
  };
  // Mission 1 (god mode only for the harbor police; the gate is back before mission 2).
  await t.call('god', true);
  await t.call('skipToDepotDelivery');
  await t.call('neutraliseDepotPolice');
  await t.call('placeVehicle', -1664, 4470, Math.PI / 2);
  await t.wait(6);
  await t.call('interact');
  await t.wait(2);
  await t.call('teleport', -1666, 4540);
  await t.wait(1);
  await t.call('teleport', -1666, 4615);
  await t.wait(7);
  let m = await t.call('missionState');
  t.assert(m.last?.result === 'won' && m.completed === 1, 'mission 1 not won: ' + JSON.stringify(m));
  await t.call('god', false);
  let p = await t.call('pointers');
  t.assert(p.objective && p.payphoneRinging && p.navigation, 'mission 2 call should point at the payphone: ' + JSON.stringify(p));
  // Mission 2 to its end, then CONTINUE FREE ROAM with the real key.
  await t.call('startMission', 1);
  await t.call('skipToRooftopEscape');
  p = await t.call('pointers');
  t.assert(p.objective && p.navigation && !p.payphoneRinging, 'active job shows no pointer: ' + JSON.stringify(p));
  await t.call('teleport', -2183, 1990);
  await t.wait(5);
  let d = await t.call('demo');
  t.assert(d.cardShown && d.storyOver && d.completed && !d.callWaiting, 'demo card not up: ' + JSON.stringify(d));
  await t.keys('Enter', 0.3, { real: true });
  await t.wait(2);
  d = await t.call('demo');
  t.assert(!d.cardShown, 'card still up');
  none(await t.call('pointers'), 'free roam');
  // Replay mission 2 from the picker and hang up: still free roam, no ringing payphone.
  const c = await t.call('chooseMission', 1);
  t.assert(c.chosen && c.mode === 'dialogue', 'replay call not up: ' + JSON.stringify(c));
  await t.keys('Escape', 0.3, { real: true });
  await t.wait(1);
  m = await t.call('missionState');
  t.assert(!m.mission, 'hang up started the job');
  none(await t.call('pointers'), 'after HANG UP');
  d = await t.call('demo');
  t.assert(d.storyOver && !d.callWaiting, 'story not over after hang up: ' + JSON.stringify(d));
  // The same for mission 1; then accepting a replay does show its pointer.
  await t.call('chooseMission', 0);
  await t.keys('Escape', 0.3, { real: true });
  await t.wait(1);
  none(await t.call('pointers'), 'after HANG UP (job 1)');
  await t.call('chooseMission', 0);
  await t.keys('Enter', 0.3, { real: true });
  await t.wait(1);
  p = await t.call('pointers');
  t.assert(p.objective && p.navigation, 'an accepted replay lost its pointer: ' + JSON.stringify(p));
  // A replay won in the demo leaves free roam again.
  await t.call('teleport', -1666, 4615);
  await t.call('retryMission');
  await t.call('skipToDepotDelivery');
  await t.call('neutraliseDepotPolice');
  await t.call('placeVehicle', -1664, 4470, Math.PI / 2);
  await t.wait(6);
  await t.call('interact');
  await t.wait(2);
  await t.call('teleport', -1666, 4540);
  await t.wait(1);
  await t.call('teleport', -1666, 4615);
  await t.wait(7);
  m = await t.call('missionState');
  t.assert(m.last?.result === 'won' && m.last.index === 0, 'replay not won: ' + JSON.stringify(m));
  none(await t.call('pointers'), 'after a won replay');
}
