// Demo build: without ?dev in the URL the jobs past DEMO_MISSIONS are locked
// (startMission returns demoLocked), the open ones start, and god mode lifts the gate.
export const flags = 'test';
export default async function (t) {
  const demo = await t.call('demo');
  t.assert(demo.build === true, 'not a demo build (DEMO_BUILD false?)');
  const locked = demo.missions;
  t.assert(!demo.open.includes(locked), `job ${locked} should be locked: open ${demo.open}`);
  // The picker never names a locked job: FULL GAME jobs and the story ahead read ???.
  for (let i = locked; i < demo.picker.length; i++)
    t.assert(demo.picker[i] === '???', `locked job ${i} named in the picker: ${demo.picker[i]}`);
  t.assert(demo.picker[0] !== '???', 'job 1 should be named: ' + demo.picker[0]);
  const refused = await t.call('startMission', locked);
  t.assert(refused.demoLocked === true && !refused.mission, 'locked job started: ' + JSON.stringify(refused));
  const first = await t.call('startMission', 0);
  t.assert(!first.demoLocked && first.mission, 'job 0 did not start: ' + JSON.stringify(first));
  await t.call('god', true);
  const god = await t.call('startMission', locked);
  t.assert(!god.demoLocked && god.mission, 'god mode did not lift the gate');
  await t.call('god', false);
}
