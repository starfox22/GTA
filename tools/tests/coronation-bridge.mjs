// The Coronation Bridge (coronation-bridge.js): Sunset Pier to Monarch Isle. The GPS routes over
// it, a car drives it end to end from Pier Island Drive to the Westgate corner without leaving the
// deck or touching the water, Monarch Isle's traffic graph runs over it, and it is a drawbridge.
export const fresh = true;
const A = [3898, -5900],
  B = [5600, -4544];
export default async function (t) {
  const r = await t.call('drawbridges');
  const d = r.drawbridges.find((o) => o.id === 'coronation');
  t.assert(d && d.link === 'SUNSET PIER - MONARCH ISLE', 'the Coronation Bridge is a drawbridge: ' + JSON.stringify(d));
  await t.call('drawbridge', 'close', 0, 'all');
  // The GPS from the drive on Sunset Pier to Westgate on Monarch Isle goes over it.
  await t.call('teleport', 3600, -5900);
  const route = await t.call('route', 5600, -4000);
  t.assert(route.status === 'YOUR DESTINATION', `a route to Monarch Isle: ${route.status}`);
  t.assert(route.bridges.includes('coronation') && !route.bridges.includes('sovereign'), `over the Coronation Bridge: ${route.bridges}`);
  t.note(`GPS ${Math.round(route.length / 8)} m over ${route.bridges.join(', ')}`);
  // Drive it: on to the bend of the drive, over the bridge, round into Westgate.
  await t.call('holdSimulation', true);
  try {
    await t.call('god', true);
    await t.call('drive', 'sedan', 0, 0);
    await t.call('placeVehicle', 3640, -5880, 0);
    const legs = [
      [A[0] - 30, A[1] + 10],
      [A[0] + (B[0] - A[0]) * 0.3, A[1] + (B[1] - A[1]) * 0.3],
      [A[0] + (B[0] - A[0]) * 0.7, A[1] + (B[1] - A[1]) * 0.7],
      [B[0] - 10, B[1] - 10],
      [B[0], B[1] + 300],
    ];
    let low = 0;
    for (const [x, y] of legs) {
      const s = await t.call('steerTo', x, y, 40, 40, true);
      const p = await t.call('pose');
      t.assert(s && s.reason !== 'time' && s.reason !== 'stuck', `reached (${Math.round(x)}, ${Math.round(y)}): ${JSON.stringify(s)}`);
      t.assert(!(p.sinking > 0), 'in the water: ' + JSON.stringify(p));
      low = Math.max(low, p.sinking || 0);
    }
    const st = await t.call('status');
    t.assert(Math.abs(st.x - B[0]) < 80 && st.y > B[1] + 150, `on Westgate at the end: ${st.x}, ${st.y}`);
    t.assert(st.district === undefined || !/SOUND|SEA/.test(st.district), `on land: ${st.district}`);
  } finally {
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
