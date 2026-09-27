// Parachute: it never opens by itself. The bail key held on from the jump does not
// open it (the jumper hits the ground at freefall speed and dies); let go and
// pressed again, it opens and lands safely; pulled far too low it cannot slow in time.
export const fresh = true;

// Over the Old Quarter heading east: land all the way (parachute.js lands on streets).
const X = 1500,
  Y = 1500,
  EAST = 0;

async function waitFor(t, done, step, limit) {
  let s = await t.call('parachuteState');
  for (let waited = 0; waited < limit && s && !done(s); waited += step) {
    await t.wait(step);
    s = await t.call('parachuteState');
  }
  return s;
}

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    // 1. The press that jumped, never let go: no canopy, a fatal impact.
    let s = await t.call('bailOut', 180, X, Y, EAST);
    t.assert(s.stage === 'freefall' && !s.armed, `bailed into freefall, not armed: ${JSON.stringify(s)}`);
    await t.keys('KeyJ', 2);
    s = await t.call('parachuteState');
    t.assert(s && s.stage === 'freefall', `holding the bail key from the jump opened it: ${JSON.stringify(s)}`);
    t.assert(s.cue && ['high', 'soon', 'danger'].includes(s.cue.state), `freefall cue shown: ${JSON.stringify(s.cue)}`);
    await t.keys('KeyJ', 14);
    let f = await t.call('fallState');
    t.assert(f.mode === 'dead', `no canopy: expected death on impact, got ${f.mode} hp ${f.hp}`);
    const splat = f.impacts[f.impacts.length - 1];
    t.assert(splat && splat.injury === 'lethal' && splat.speed > 30, `impact at freefall speed: ${JSON.stringify(splat)}`);
    t.assert(f.splat && !f.splat.water, `splat recorded on the ground: ${JSON.stringify(f.splat)}`);
    t.note(`no canopy: hit at ${splat.speed} m/s`);

    // 2. Let go, then pressed again: opens and lands safely.
    s = await t.call('bailOut', 110, X, Y, EAST);
    await t.wait(0.8);
    s = await t.call('parachuteState');
    t.assert(s.stage === 'freefall' && s.armed, `still packed after letting go: ${JSON.stringify(s)}`);
    await t.keys('KeyJ', 0.2);
    s = await t.call('parachuteState');
    t.assert(s.stage === 'canopy', `second press opened it: ${JSON.stringify(s)}`);
    t.note(`opened at ${s.openedAtM} m`);
    s = await waitFor(t, (p) => false, 4, 60);
    f = await t.call('fallState');
    t.assert(f.mode === 'play' && f.hp === 100 && !f.parachute, `safe landing: ${f.mode} hp ${f.hp}`);
    const landing = f.impacts[f.impacts.length - 1];
    t.assert(landing && landing.cause === 'canopy' && landing.outcome === 'safe', `canopy landing logged safe: ${JSON.stringify(landing)}`);

    // 3. Pulled with no room left (well under the cue's red line): lands too hard.
    s = await t.call('bailOut', 150, X, Y, EAST);
    s = await waitFor(t, (p) => p.aglM < 22, 0.25, 12);
    t.assert(s && s.stage === 'freefall' && s.cue.state === 'danger', `the cue is red this low: ${JSON.stringify(s)}`);
    await t.call('openParachute');
    await t.wait(6);
    f = await t.call('fallState');
    const late = f.impacts[f.impacts.length - 1];
    t.assert(late && late.cause === 'canopy' && late.outcome === 'dead', `opened at ${s.aglM} m: ${JSON.stringify(late)}`);
    t.note(`opened at ${s.aglM} m: hit at ${late.speed} m/s`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
