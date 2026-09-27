// Mission 1's truck waits on the carriageway at the north kerb of its street (y 640,
// 596..684), in the westbound lane facing west, clear of the junctions, on every start.
export default async function (t) {
  for (let run = 0; run < 3; run++) {
    await t.call('startMission', 0);
    const m = await t.call('missionTargets');
    const c = m?.car;
    t.assert(c && m.stage === 0 && m.target.x === c.x && m.target.y === c.y, 'marker not on the truck: ' + JSON.stringify(m?.target));
    t.near(c.y, 604, 614, 'truck y (north kerb lane)');
    t.near(c.x, 1780, 2080, 'truck x (inside the block)');
    const v = await t.call('vehicleAt', c.x, c.y);
    t.assert(v.id === c.id && Math.abs(Math.abs(v.a) - Math.PI) < 0.05, 'truck not facing west: ' + JSON.stringify(v));
    const here = await t.call('probe', c.x, c.y, 4);
    t.assert(here.road, 'truck off the carriageway: ' + JSON.stringify(here));
    await t.wait(2);
  }
}
