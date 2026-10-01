// Simulation-efficiency changes keep the same answers: the boat hull test (hullTouchesLand) agrees with
// land, the logic report (simProfile) is sane, the parked-vehicle settle shortcut changes nothing, and
// a drive across the city (minimap overlays culled to the window, vehicle broadphase on counted lists,
// crowd grid on counted cells) runs without errors.
export default async function (t) {
  await t.call('god', true);
  // A boat's hull never fits where the centre is on land; the open bay does fit one.
  let onLand = 0,
    fitsOnLand = 0,
    fitsAtSea = 0,
    sea = 0;
  for (let x = -3400; x < 11000; x += 500)
    for (let y = -4200; y < 10800; y += 500) {
      const p = await t.call('probe', x, y, 4);
      if (p.land) {
        onLand++;
        if (p.boatFits) fitsOnLand++;
      } else if (!p.ground) {
        sea++;
        if (p.boatFits) fitsAtSea++;
      }
    }
  t.assert(onLand > 50 && sea > 50, `the grid should cover land and sea (land ${onLand}, sea ${sea})`);
  t.assert(fitsOnLand === 0, `${fitsOnLand} land points claim a boat fits there`);
  t.assert(fitsAtSea > sea / 3, `a jet ski should fit most open water: ${fitsAtSea} of ${sea} sea points`);
  // The report itself.
  await t.call('teleport', 748, 584);
  const r = await t.call('simProfile', 2);
  t.finite(r, 'simProfile');
  t.assert(r.frames === 120 && r.avgMs > 0 && r.maxMs >= r.p99Ms && r.p99Ms >= r.p50Ms, 'simProfile: ' + JSON.stringify(r).slice(0, 300));
  t.assert(r.parts && r.parts.cars && r.parts.people, 'simProfile lists the cars and people sections');
  // The settle shortcut for parked vehicles changes nothing the whole settle would have changed.
  const audit = await t.call('settleAudit', 120);
  t.assert(audit.checked > 1000 && audit.changed === 0, 'settleAudit: ' + JSON.stringify(audit));
  // A drive: the minimap redraws about eleven times a second over stations, garages and helipads.
  await t.call('drive', 'sedan', 0, 0);
  await t.keys('KeyW', 12);
  const s = await t.call('status');
  t.assert(s.vehicle === 'sedan' && s.mode === 'play', 'still driving: ' + JSON.stringify(s));
  const traffic = await t.call('trafficReport');
  t.assert(traffic.vehicles > 100, 'traffic is still there: ' + traffic.vehicles);
}
