// Traffic at every drawbridge (drawbridge.js drawbridgeTrafficLimit / drawbridgeKeepsOff): cars
// driving at each approach while it opens stop at the stop lines, none is ever on the moving span
// while it is not seated (nor in the water), and once the Coronation Bridge is down again they go.
export const fresh = true;
const BRIDGES = ['keys-harbor', 'oceanview', 'ridgeline', 'coronation'];
export default async function (t) {
  // God mode keeps the watcher (in the water off each bridge) afloat; the clock is frozen so
  // no timetable opening starts in the middle.
  await t.call('god', true);
  await t.call('godFreeze', true);
  await t.call('holdSimulation', true);
  try {
    for (const id of BRIDGES) {
      await t.call('drawbridge', 'close', 0, 'all');
      await t.call('drawbridgeLook', 'north', 1, id);
      await t.wait(2);
      const placed = await t.call('drawbridgeTraffic', 3, id);
      t.assert(placed >= 3, `${id}: test traffic placed (${placed})`);
      await t.call('drawbridge', 'open', 0, id);
      let r,
        queued = 0,
        openFor = 0;
      for (let k = 0; k < 40 && openFor < 16; k++) {
        await t.wait(4);
        r = await t.call('drawbridge', 'status', 0, id);
        const [h0, h1] = r.hinges,
          on = r.traffic.filter((c) => c.ai && c.u > h0 + 4 && c.u < h1 - 4);
        if (r.spanClosed) t.assert(on.length === 0, `${id}: traffic on the span while it is ${r.phase} at ${r.angle} deg: ${JSON.stringify(on)}`);
        queued = Math.max(queued, r.queued);
        if (r.phase === 'open') openFor += 4;
      }
      t.assert(r.phase === 'open' && r.angle > 70, `${id}: raised (${r.phase} ${r.angle})`);
      t.assert(queued >= 2, `${id}: cars queued at the stop lines (${queued})`);
      t.assert(r.splashes === 0, `${id}: nothing went into the water (${r.splashes})`);
      t.note(`${id}: ${queued} queued, ${r.traffic.length} on the causeway, gap ${r.gap}`);
      if (id !== 'coronation') continue;
      // Down again: the queue moves off.
      const before = r.traffic.filter((c) => c.ai).map((c) => [c.id, c.u]);
      await t.call('drawbridge', 'close', 0, id);
      for (let k = 0; k < 30 && r.phase !== 'idle'; k++) {
        await t.wait(4);
        r = await t.call('drawbridge', 'status', 0, id);
        if (r.spanClosed) t.assert(!r.traffic.some((c) => c.ai && c.u > r.hinges[0] + 4 && c.u < r.hinges[1] - 4), `${id}: traffic on the span while ${r.phase}`);
      }
      t.assert(r.phase === 'idle', `${id}: down and open to traffic (${r.phase})`);
      await t.wait(12);
      r = await t.call('drawbridge', 'status', 0, id);
      const moved = before.filter(([cid, u]) => {
        const now = r.traffic.find((c) => c.id === cid);
        return !now || Math.abs(now.u - u) > 60;
      });
      t.assert(moved.length >= 2, `${id}: the queue moved off once the bridge was down (${moved.length} of ${before.length})`);
    }
  } finally {
    await t.call('drawbridge', 'close', 0, 'all');
    await t.call('holdSimulation', false);
    await t.call('godFreeze', false);
    await t.call('god', false);
  }
}
