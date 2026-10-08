// Fort Sentinel cover (fort-cover*.js): free roam still alarms on stepping inside; in the borrowed uniform with the
// cover on, the gate asks for ID, the real action key shows the papers and he walks in without an alarm; a drawn
// weapon in a soldier's cone blows the cover, running fills the meter, a military jeep raises the alarm at once;
// the records office hands over the papers (or, entered under a heavy look, alarms on the way out) and walking out
// past the checkpoint sets leftWithPapers.
export const fresh = true;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  const cover = () => t.call('fortCover');
  const military = () => t.call('military');

  // Free roam is unchanged: no cover, own clothes, inside the fence = intruder.
  await t.call('fortCoverTest', 'end');
  await t.call('teleport', 9400, 8182);
  await t.wait(0.5);
  t.assert((await military()).alert, 'free roam: stepping inside the base did not raise the alarm');

  // The gate: HALT. ID, PLEASE. instead of the challenge.
  let c = await t.call('fortCoverTest', 'gate');
  t.assert(c.active && c.uniform === 'army' && !c.cleared, 'gate staging: ' + JSON.stringify(c));
  await t.call('walk', 0, 86);
  await t.wait(0.6);
  let m = await military();
  c = await cover();
  t.assert(!m.alert && m.challenge === 0, 'the gate challenged a uniformed man with a pass: ' + JSON.stringify({ alert: m.alert, challenge: m.challenge }));
  t.assert(c.ownsGate && c.gateCheck.distance < 42, 'not at the papers spot: ' + JSON.stringify(c.gateCheck));
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(0.5);
  c = await cover();
  t.assert(c.inspecting !== null || c.cleared, 'the action key did not start the inspection: ' + JSON.stringify(c));
  await t.wait(3.6);
  c = await cover();
  t.assert(c.cleared && !c.alarmed, 'not cleared after the inspection: ' + JSON.stringify(c));
  // In through the gate on foot, walking: no alarm.
  await t.call('walk', 0, 260);
  await t.wait(2);
  c = await cover();
  m = await military();
  t.assert(c.insideBase && c.entered && !c.alarmed && !m.alert, 'walking in cleared raised the alarm: ' + JSON.stringify({ c, alert: m.alert }));
  t.assert(c.walkDefault, 'under cover the walk is not the default pace');

  // Running in a soldier's cone fills the meter (the walk action runs under cover).
  c = await t.call('fortCoverTest', 'inside');
  await t.wait(0.3);
  await t.keys(['KeyS', 'Walk'], 1.6);
  c = await cover();
  t.assert(c.suspicion > 10 && !c.alarmed, 'running in view did not fill the meter: ' + JSON.stringify(c));

  // A weapon in hand in a soldier's cone: cover blown, the base alarmed.
  c = await t.call('fortCoverTest', 'inside');
  t.assert(!c.alarmed && c.shielded, 'inside staging: ' + JSON.stringify(c));
  await t.wait(0.5);
  t.assert(!(await military()).alert, 'standing cleared in view of the HQ sentries raised the alarm');
  await t.call('arm', 0);
  await t.wait(0.5);
  c = await cover();
  t.assert(c.alarmed && c.blownBy === 'weapon' && (await military()).alert, 'a drawn pistol in view did not blow the cover: ' + JSON.stringify(c));

  // Any military vehicle: the alarm at once.
  c = await t.call('fortCoverTest', 'jeep');
  t.assert(!c.alarmed, 'jeep staging: ' + JSON.stringify(c));
  await t.call('interact');
  const s = await t.call('status');
  c = await cover();
  t.assert(s.vehicle && c.alarmed && c.blownBy === 'vehicle' && (await military()).alert, 'boarding a jeep did not alarm: ' + JSON.stringify({ vehicle: s.vehicle, c }));

  // The records office: in through the side door, out with the papers.
  c = await t.call('fortCoverTest', 'records');
  t.assert(c.recordsDoor.distance < 24 && !c.papers, 'records staging: ' + JSON.stringify(c));
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(0.3);
  t.assert((await t.call('status')).mode === 'elevator', 'the records door did not open');
  await t.wait(8);
  c = await cover();
  t.assert(c.papers && !c.alarmed && c.records === null && (await t.call('status')).mode === 'play', 'no papers from the records office: ' + JSON.stringify(c));
  t.assert(c.recordsDoor.distance < 6, 'not back out at the door: ' + JSON.stringify(c.recordsDoor));

  // Under a heavy look a duty officer follows him in: the alarm on the way out.
  await t.call('fortCoverTest', 'records', 70);
  await t.keys('KeyE', 0.2, { real: true });
  await t.realWait(0.3);
  await t.wait(8);
  c = await cover();
  t.assert(c.papers && c.alarmed && c.blownBy === 'records', 'followed into the records office but no alarm: ' + JSON.stringify(c));

  // Out past the checkpoint with the papers, calm.
  c = await t.call('fortCoverTest', 'exit');
  t.assert(c.papers && c.cleared && !c.alarmed, 'exit staging: ' + JSON.stringify(c));
  await t.call('walk', Math.PI, 160);
  await t.wait(0.5);
  c = await cover();
  t.assert(c.leftWithPapers && !c.alarmed && !(await military()).alert, 'walking out with the papers: ' + JSON.stringify(c));

  await t.call('fortCoverTest', 'end');
  await t.call('holdSimulation', false);
}
