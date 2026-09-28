// Parachute deployment takes real time and height (parachute.js DEPLOYMENT): pulled at
// terminal speed (~54 m/s) the canopy runs pilot chute (~0.8 s), bag and lines to line
// stretch (~1.8 s and 50-60 m of lines), snivel (1.5-2.5 s), slider down, and flies
// 4-5 s and 150-250 m after the pull with a 3-4 g peak that builds, not a bang; the
// freefall cue's forecast matches the height actually lost; the canopy then sits on its
// deployment brakes and surges to trim once they are let go; pulled at 80 m it cannot
// open in time; pulled when the cue says OPEN SOON or OPEN NOW it lands safely; a low
// helicopter hop is a real risk. Steps with holdSimulation + parachuteFallTo (30 Hz).
export const fresh = true;

// Over the Old Quarter heading east: land all the way (parachute.js lands on streets).
const X = 1500,
  Y = 1500,
  EAST = 0;

// Step to the ground (parachuteFallTo stops after 120 s) and return the fall state.
async function land(t) {
  for (let i = 0; i < 4; i++) {
    const s = await t.call('parachuteFallTo', 0);
    if (s.landed) break;
  }
  return t.call('fallState');
}
const lastImpact = (f) => f.impacts[f.impacts.length - 1];

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // 1. At terminal speed from 600 m: the stages in order with real durations, open after 4-5 s and 150-250 m.
    await t.call('bailOut', 1100, X, Y, EAST);
    let s = await t.call('parachuteFallTo', 600);
    t.assert(s.stage === 'freefall' && s.descentMs > 52, `at terminal speed by 600 m: ${JSON.stringify(s)}`);
    t.near(s.cue.needM, 170, 230, 'cue: height a pull at terminal speed needs (m)');
    const forecast = s.cue.needM;
    s = await t.call('openParachute');
    t.assert(s.stage === 'canopy' && s.phase === 'pilot' && s.deployS === 0, `pulled: ${JSON.stringify(s)}`);
    const pulledAt = s.aglM;
    const lines = await t.call('parachuteFallTo', 'lines');
    t.near(lines.deployS, 0.6, 1.1, 'pilot chute: throw, inflation, pin and bag lift (s)');
    // A second press while it opens changes nothing (no double opening).
    s = await t.call('openParachute');
    t.assert(s.phase === 'lines' && s.deployS === lines.deployS, `second press ignored: ${JSON.stringify(s)}`);
    const snivel = await t.call('parachuteFallTo', 'snivel');
    t.near(snivel.deployS, 1.5, 2.1, 'pull to line stretch (s)');
    t.near(lines.aglM - snivel.aglM, 45, 65, 'fall while the lines pay out (m)');
    t.assert(snivel.descentMs > 45, `still falling fast at line stretch: ${snivel.descentMs} m/s`);
    t.assert(snivel.cue && snivel.cue.state === 'opening', `cue follows the opening: ${JSON.stringify(snivel.cue)}`);
    // Line stretch snatches (a little over 1 g), the snivel does not yet bite.
    t.near(snivel.loadG, 1.1, 2.2, 'line stretch snatch (g)');
    const snap = await t.call('parachuteFallTo', 'snap');
    t.near(snap.deployS - snivel.deployS, 1.5, 2.5, 'snivel (s)');
    t.assert(snap.descentMs > 20 && snap.opening < 0.5, `the canopy's drag comes in gradually: ${JSON.stringify(snap)}`);
    t.assert(snap.peakLoadG < 3, `no shock before the slider comes down: ${snap.peakLoadG} g`);
    // The shock builds through the slider's run: sample the load along the snap.
    const loads = [];
    for (let i = 0; i < 12; i++) {
      await t.wait(1 / 15);
      const q = await t.call('parachuteState');
      loads.push(q.loadG);
      if (q.phase === 'open') break;
    }
    const peakAt = loads.indexOf(Math.max(...loads));
    t.assert(peakAt >= 2, `the opening shock builds over the snap, not at once: ${loads.join(', ')}`);
    const open = await t.call('parachuteFallTo', 'open');
    t.near(open.openTimeS, 4, 5, 'pull to fully open (s)');
    t.near(open.openLostM, 150, 250, 'height lost opening (m)');
    t.near(open.peakLoadG, 3, 4, 'opening shock (g)');
    t.assert(open.descentMs < 8 && !open.cue, `open: canopy descent, cue gone: ${JSON.stringify(open)}`);
    // The cue's forecast at the pull is what the opening actually took (to 7 m/s).
    t.assert(open.safeLostM != null, `landable rate reached: ${JSON.stringify(open)}`);
    t.near(open.safeLostM - forecast, -6, 6, 'forecast minus actual height to a landable rate (m)');
    t.note(`terminal pull at ${pulledAt} m: line stretch ${snivel.deployS} s / ${+(s.aglM - snivel.aglM).toFixed(0)} m, open ${open.openTimeS} s and ${open.openLostM} m later, ${open.peakLoadG} g; forecast ${forecast} m, actual ${open.safeLostM} m`);
    // On the deployment brakes, then the surge to trim once they are let go.
    t.assert(open.brakesSet === true, `flies on its deployment brakes first: ${JSON.stringify(open)}`);
    await t.wait(2);
    s = await t.call('parachuteState');
    t.assert(s.brakesSet === false && s.flownS > 1.4, `brakes unstowed: ${JSON.stringify(s)}`);
    let f = await land(t);
    t.assert(f.mode === 'play' && f.hp === 100, `lands safely: ${f.mode} hp ${f.hp}`);
    t.assert(lastImpact(f).cause === 'canopy' && lastImpact(f).outcome === 'safe', `safe canopy landing: ${JSON.stringify(lastImpact(f))}`);

    // 2. Pulled at 80 m from terminal speed: the cue says too low; it cannot open in time.
    await t.call('bailOut', 700, X, Y, EAST);
    s = await t.call('parachuteFallTo', 80);
    t.assert(s.cue.state === 'danger', `cue red at 80 m: ${JSON.stringify(s.cue)}`);
    await t.call('openParachute');
    f = await land(t);
    const late = lastImpact(f);
    t.assert(
      f.mode === 'dead' || (typeof late.injury === 'number' && late.injury >= 40),
      `80 m pull: death or serious injury, got ${f.mode} ${JSON.stringify(late)}`,
    );
    t.note(`80 m pull: hit at ${late.speed} m/s (${f.mode})`);

    // 3. Pulled as the cue first says OPEN SOON, and as it says OPEN NOW: both land safely.
    for (const state of ['soon', 'now']) {
      await t.call('bailOut', 1000, X, Y, EAST);
      s = await t.call('parachuteFallTo', state);
      t.assert(s.stage === 'freefall' && s.cue.state === state, `cue ${state}: ${JSON.stringify(s.cue)}`);
      t.assert(s.aglM > s.cue.needM + 20, `${state} leaves room: ${s.aglM} m for ${s.cue.needM} m`);
      await t.call('openParachute');
      f = await land(t);
      t.assert(f.mode === 'play' && f.hp === 100, `pulled at ${state} (${s.aglM} m): ${f.mode} hp ${f.hp}`);
      t.note(`${state}: pulled at ${s.aglM} m (needs ${s.cue.needM} m)`);
    }

    // 4. A low helicopter hop (62 m, the lowest a jump is allowed): an instant pull just
    // makes it; a second and a half of freefall first does not.
    s = await t.call('bailOut', 62, X, Y, EAST);
    t.assert(['now', 'danger'].includes(s.cue.state), `low hop: cue says open now: ${JSON.stringify(s.cue)}`);
    await t.wait(0.3);
    await t.call('openParachute');
    f = await land(t);
    t.assert(f.mode === 'play', `instant pull at 62 m survives: ${JSON.stringify(lastImpact(f))}`);
    await t.call('bailOut', 62, X, Y, EAST);
    await t.wait(1.5);
    s = await t.call('openParachute');
    f = await land(t);
    t.assert(f.mode === 'dead' || lastImpact(f).outcome !== 'safe', `pulled at ${s.aglM} m after 1.5 s: ${JSON.stringify(lastImpact(f))}`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
