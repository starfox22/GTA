// Fort Sentinel's gate arm (military-base.js updateGatePieces, fort-cover.js fortCoverGatePass): a lowered arm stops a man
// on foot as well as a car; in Kessler's uniform the sergeant's "go on through" lifts the arm of his lane, he walks
// under it with the movement keys and it comes down behind him; free roam meets a shut, solid arm.
export const fresh = true;
const ARM_X = 9272;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    // Free roam: the arm is down and he walks into it, not through it.
    await t.call('fortCoverTest', 'end');
    await t.call('teleport', 9220, 8202);
    await t.wait(0.3);
    let p = await t.call('walk', 0, 150);
    let m = await t.call('military');
    t.assert(p.x < ARM_X - 8 && m.gate[1].arm < 0.1, 'walked through the lowered arm: ' + JSON.stringify({ p, gate: m.gate }));
    p = await t.call('promptState');
    t.assert(/FORCE THE GATE/.test(p.text || ''), 'the arm down on foot offers the forced controls: ' + JSON.stringify(p));
    await t.call('teleport', 9100, 8182);
    await t.wait(1);

    // In uniform: up to the window, the papers shown with the real key, the talk.
    let c = await t.call('fortCoverTest', 'gate');
    await t.call('walk', 0, 86);
    await t.wait(0.3);
    await t.keys('KeyE', 0.2, { real: true });
    await t.realWait(0.4);
    c = await t.call('fortCover');
    t.assert(c.inspecting !== null, 'the inspection did not start: ' + JSON.stringify(c));
    await t.wait(12);
    m = await t.call('military');
    t.assert(m.gate[1].arm < 0.1, 'the arm lifted before the sergeant waved him through: ' + JSON.stringify(m.gate));
    // "Go on through" (FORT_GATE_OPEN_AT 14.2 s): his lane's arm swings up; the other lane stays down.
    await t.wait(3.4);
    m = await t.call('military');
    t.assert(m.gate[1].arm > 0.6 && m.gate[0].arm < 0.1, 'waved through but the arm stayed down: ' + JSON.stringify(m.gate));
    await t.wait(1.5);
    c = await t.call('fortCover');
    t.assert(c.cleared && !c.alarmed, 'not cleared: ' + JSON.stringify(c));

    // He walks under it with the movement keys (walking is the default pace in uniform).
    await t.keys('KeyD', 9);
    let s = await t.call('status');
    t.assert(s.x > ARM_X + 40, 'did not walk through the open gate: ' + JSON.stringify(s));
    await t.keys('KeyD', 6);
    await t.wait(3);
    m = await t.call('military');
    s = await t.call('status');
    t.assert(m.gate[1].arm < 0.05 && !m.alert, 'the arm did not close behind him: ' + JSON.stringify({ gate: m.gate, x: s.x, alert: m.alert }));

    // On the way out it lifts for him again.
    await t.call('teleport', 9330, 8202);
    await t.wait(2.5);
    m = await t.call('military');
    t.assert(m.gate[1].arm > 0.6, 'the arm did not lift for him on the way out: ' + JSON.stringify(m.gate));
    p = await t.call('walk', Math.PI, 160);
    t.assert(p.x < ARM_X - 100, 'could not walk out under the open arm: ' + JSON.stringify(p));
  } finally {
    await t.call('fortCoverTest', 'end');
    await t.call('holdSimulation', false);
  }
}
