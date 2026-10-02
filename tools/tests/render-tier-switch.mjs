// A graphics tier change that turns shadows on is staged (lighting3d-look.js LIT STATE): the new lit programs are
// compiled behind the running frames and the flags flip once they are ready, so the frames after the flip create
// no lit program. Runs only where the renderer stages (a real GPU, or a rendered page started with `--prewarm`);
// elsewhere (the no-render test page, software GL without ?prewarm) it checks the immediate switch still works.
export default async function (t) {
  const report = await t.call('renderHiccups');
  if (report === null) return; // no renderer on the no-render page
  t.assert(report.litStage && typeof report.litStage.switches === 'number', 'renderHiccups has litStage');
  await t.call('graphics', 'low');
  // Let any staged switch to LOW finish (immediate where staging is off).
  for (let i = 0; i < 60 && (await t.call('renderHiccups')).litStage.pending; i++) await t.realWait(2);
  t.assert((await t.call('graphics', 'low')).shadows === 'off', 'LOW has no shadows');
  t.assert((await t.call('renderHiccups')).litStage.pending === false, 'no switch pending at LOW');
  await t.realWait(3);
  await t.call('renderHiccups', true);
  const switched = await t.call('graphics', 'high');
  const staging = (await t.call('renderHiccups')).litStage.staging;
  if (!staging) {
    // Software GL without ?prewarm: the shadows come on at once.
    t.assert(switched.shadowMap > 0, 'without staging the shadow map is on at once: ' + switched.shadowMap);
    await t.call('graphics', 'low');
    return;
  }
  // Staged: the tier is HIGH, the shadow map still off, a switch pending.
  t.assert(switched.tier === 'HIGH' && switched.shadowMap === 0, 'tier is HIGH, shadow map not on yet: ' + JSON.stringify(switched));
  let state = await t.call('renderHiccups');
  t.assert(state.litStage.pending === true || state.litStage.switches > 0, 'a switch is pending or done: ' + JSON.stringify(state.litStage));
  for (let i = 0; i < 90 && (await t.call('renderHiccups')).litStage.pending; i++) await t.realWait(2);
  state = await t.call('renderHiccups');
  t.assert(state.litStage.pending === false && state.litStage.switches >= 1, 'the staged switch finished: ' + JSON.stringify(state.litStage));
  t.assert(state.litStage.error === '', 'no staging error: ' + state.litStage.error);
  t.assert(state.litStage.compiled > 0, 'the stage compiled programs');
  t.assert((await t.call('graphics', 'high')).shadowMap > 0, 'the shadow map is on after the flip');
  // Frames after the flip: the lit programs are ready, so (almost) nothing is created in them.
  await t.call('renderHiccups', true);
  await t.realWait(12);
  state = await t.call('renderHiccups');
  t.note('after the flip: ' + state.frames + ' frames, ' + state.programsLinked + ' programs created');
  t.assert(state.programsLinked <= 6, `${state.programsLinked} programs created in the frames after the staged flip`);
  await t.call('graphics', 'low');
}
