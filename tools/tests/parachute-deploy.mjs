// Parachute deployment takes real time and height (parachute.js DEPLOYMENT): pulled at
// terminal speed the canopy runs pilot chute, lines, snivel and snap and is fully open
// 3-5 s and 120-250 m later; pulled at 80 m it cannot open in time; pulled when the
// freefall cue says OPEN SOON or OPEN NOW it lands safely; a low helicopter hop is a
// real risk. Steps with holdSimulation + parachuteFallTo (30 Hz, as simulate).
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
    // 1. At terminal speed from 600 m: the stages in order, open after 3-5 s and 120-250 m, a safe landing.
    await t.call('bailOut', 1100, X, Y, EAST);
    let s = await t.call('parachuteFallTo', 600);
    t.assert(s.stage === 'freefall' && s.descentMs > 47, `at terminal speed by 600 m: ${JSON.stringify(s)}`);
    t.near(s.cue.needM, 150, 210, 'cue: height a pull at terminal speed needs (m)');
    s = await t.call('openParachute');
    t.assert(s.stage === 'canopy' && s.phase === 'pilot' && s.deployS === 0, `pulled: ${JSON.stringify(s)}`);
    const pulledAt = s.aglM;
    const lines = await t.call('parachuteFallTo', 'lines');
    t.near(lines.deployS, 0.5, 1, 'pilot chute and extraction (s)');
    // A second press while it opens changes nothing (no double opening).
    s = await t.call('openParachute');
    t.assert(s.phase === 'lines' && s.deployS === lines.deployS, `second press ignored: ${JSON.stringify(s)}`);
    const snivel = await t.call('parachuteFallTo', 'snivel');
    t.near(snivel.deployS - lines.deployS, 0.8, 1.2, 'bag and line stretch (s)');
    t.assert(snivel.descentMs > 40, `still falling fast at line stretch: ${snivel.descentMs} m/s`);
    t.assert(snivel.cue && snivel.cue.state === 'opening', `cue follows the opening: ${JSON.stringify(snivel.cue)}`);
    const snap = await t.call('parachuteFallTo', 'snap');
    t.near(snap.deployS - snivel.deployS, 1.5, 3, 'snivel (s)');
    t.assert(snap.descentMs > 20 && snap.opening < 0.5, `the canopy's drag comes in gradually: ${JSON.stringify(snap)}`);
    const open = await t.call('parachuteFallTo', 'open');
    t.near(open.openTimeS, 3, 5, 'pull to fully open (s)');
    t.near(open.openLostM, 120, 250, 'height lost opening (m)');
    t.near(open.peakLoadG, 3, 4.5, 'opening shock (g)');
    t.assert(open.descentMs < 8 && !open.cue, `open: canopy descent, cue gone: ${JSON.stringify(open)}`);
    t.note(`terminal pull at ${pulledAt} m: open ${open.openTimeS} s and ${open.openLostM} m later, ${open.peakLoadG} g`);
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
