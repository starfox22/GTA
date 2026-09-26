// Spawn a few vehicle kinds and drive them (throttle, steer, brake) for simulated
// seconds: they move, and no telemetry goes NaN.
export default async function (t) {
  for (const type of ['sedan', 'bike', 'truck']) {
    await t.call('teleport', 1600, 2700);
    const s = await t.call('drive', type);
    t.assert(s.vehicle === type, `${type}: boarded ${s.vehicle}`);
    const before = await t.call('status');
    const r1 = await t.keys('KeyW', 4);
    t.finite(r1, type);
    t.assert(Math.abs(r1.speed) > 20, `${type} barely moved: speed ${r1.speed}`);
    t.finite(await t.keys(['KeyW', 'KeyD'], 2), type + ' turning');
    t.finite(await t.keys('KeyS', 3), type + ' braking');
    const after = await t.call('status');
    t.finite(after, type + ' status');
    t.assert(Math.hypot(after.x - before.x, after.y - before.y) > 50, `${type} went nowhere`);
    t.note(`${type} ${Math.round(Math.hypot(after.x - before.x, after.y - before.y) / 8)} m`);
  }
}
