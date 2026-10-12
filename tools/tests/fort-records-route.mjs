// Fort Sentinel's records office (fort-cover-records.js FORT_RECORDS) sits well inside the base: its door is at least
// 75 m from the gate's papers window, and the walk there along Sentinel Avenue passes the HQ pad's helicopter and the
// ready line's M35 and LAV-8 (military-life.js populateMilitary). The route is walkable end to end and the door works.
export const fresh = true;
const MIN_METRES = 75;
export default async function (t) {
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    let c = await t.call('fortCoverTest', 'inside');
    const door = c.recordsDoor,
      gate = c.gateCheck,
      metres = Math.hypot(door.x - gate.x, door.y - gate.y) / 8;
    t.assert(metres >= MIN_METRES, 'the records door is only ' + metres.toFixed(1) + ' m from the gate');
    const m = await t.call('military');
    const near = (type, x, y, r) => m.vehicles.some((v) => v.type === type && Math.hypot(v.x - x, v.y - y) < r);
    // Between the gate and the door (x 9300 .. door), within 230 units of the avenue's centre line.
    const onRoute = (v) => v.x > 9300 && v.x < door.x && Math.abs(v.y - 8150) < 230;
    const route = m.vehicles.filter(onRoute);
    t.assert(route.some((v) => v.type === 'helicopter'), 'no helicopter on the walk to the records office: ' + JSON.stringify(route));
    t.assert(route.some((v) => v.type === 'armytruck') && route.some((v) => v.type === 'apc'), 'no M35 / LAV-8 on the walk: ' + JSON.stringify(route));
    t.assert(route.filter((v) => v.type === 'jeep').length >= 2, 'no HMMWVs on the walk: ' + JSON.stringify(route));
    t.assert(near('helicopter', 9492, 7936, 10), 'the HQ pad helicopter is not on its pad: ' + JSON.stringify(route));
    // The base's own layout check: nothing parked in a wall, a building or another vehicle; no post inside a solid.
    const audit = await t.call('militaryAudit');
    t.assert(audit.ok, 'Fort Sentinel layout: ' + JSON.stringify(audit));

    // The walk itself: in through the gate's inbound lane, east along the avenue, up to the door.
    c = await t.call('fortCoverTest', 'inside');
    await t.call('teleport', 9330, 8160);
    let p = await t.call('walk', 0, door.x - 9330);
    t.assert(Math.abs(p.x - door.x) < 4, 'blocked on the avenue: ' + JSON.stringify(p));
    p = await t.call('walk', -Math.PI / 2, 8160 - 8050);
    t.assert(Math.abs(p.y - 8050) < 4, 'blocked short of the door: ' + JSON.stringify(p));
    await t.wait(0.5);
    const prompt = await t.call('promptState');
    t.assert(/RECORDS/.test(prompt.text || ''), 'no records prompt at the new door: ' + JSON.stringify(prompt));
    await t.keys('KeyE', 0.2, { real: true });
    await t.realWait(0.3);
    t.assert((await t.call('status')).mode === 'elevator', 'the records door did not open');
    await t.wait(8);
    c = await t.call('fortCover');
    t.assert(c.papers && !c.alarmed && c.recordsDoor.distance < 6, 'no papers from the new door: ' + JSON.stringify(c));
  } finally {
    await t.call('fortCoverTest', 'end');
    await t.call('holdSimulation', false);
  }
}
