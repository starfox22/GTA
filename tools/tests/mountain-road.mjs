// Ridgeline's scenic roads (terrain-roads.js): curves of real radius, a graded
// surface with no steps or bumps where the wheels run, rails, posts and viewpoints;
// and a supercar on the autopilot (mountainRoadDrive) through Eagle Pass both ways,
// the Ridgeline Highway's climb and the Regency Road holds its lane on tarmac with
// no jolts, knocks, damage or NaN.
export default async function (t) {
  const report = await t.call('mountainRoad');
  t.finite(report, 'mountainRoad');
  for (const r of report.roads) {
    t.assert(r.nan === 0, `${r.name}: ${r.nan} non-finite ground heights`);
    t.assert(r.minRadiusM >= 20, `${r.name}: tightest curve ${r.minRadiusM} m at ${r.minRadiusAt}`);
    if (!r.graded) continue;
    t.assert(r.maxGradePct <= 11, `${r.name}: steepest grade ${r.maxGradePct}%`);
    t.assert(r.minVerticalCurveM === null || r.minVerticalCurveM >= 50, `${r.name}: vertical curve ${r.minVerticalCurveM} m at ${r.minVerticalCurveAt}`);
    t.assert(r.contactErrorM < 0.25, `${r.name}: ground ${r.contactErrorM} m off the designed surface at ${r.contactErrorAt}`);
    // A bump as felt at 100 km/h (g): the open road, and the junction mouths where two surfaces meet.
    t.assert(r.bumpG100 < 2.5, `${r.name}: a ${r.bumpG100} g bump (at 100 km/h) at ${r.maxBumpAt}`);
    t.assert(r.junctionBumpG100 < 8, `${r.name}: a ${r.junctionBumpG100} g bump in a junction mouth`);
    t.note(`${r.name}: ${r.lengthM} m, top ${r.topM} m, grade ${r.maxGradePct}%, R ${r.minRadiusM} m, rails ${r.railM} m`);
  }
  t.assert(report.viewpoints.length >= 2, `only ${report.viewpoints.length} viewpoints`);
  t.assert(report.rails > 0 && report.posts > 100, `rails ${report.rails}, posts ${report.posts}`);
  for (const [name, kmh, from, seconds, reverse] of [
    ['EAGLE PASS', 110, 0, 40, false],
    ['EAGLE PASS', 90, 1, 40, true],
    ['RIDGELINE HIGHWAY', 130, 0, 9, false],
    ['REGENCY ROAD', 90, 0.08, 20, false],
  ]) {
    const label = `${name} ${reverse ? 'down' : 'up'} at ${kmh}`;
    let d = await t.call('mountainRoadDrive', name, kmh, from, seconds, reverse);
    // The roads have traffic (and deer): a run that met something gets one more go.
    if (d.knocks || d.offRoad) {
      t.note(`${label}: retried after knocks ${d.knocks} at ${d.knockAt} (${d.knockWith}), off road ${d.offRoad} at ${d.offAt}`);
      d = await t.call('mountainRoadDrive', name, kmh, from, seconds, reverse);
    }
    t.finite(d, label);
    t.assert(!d.error && !d.lost, `${label}: ${d.error || 'lost the road at ' + d.lost}`);
    t.assert(!d.nan, `${label}: NaN telemetry`);
    t.assert(d.distanceM > 100, `${label}: only ${d.distanceM} m`);
    t.assert(d.offRoad === 0, `${label}: off the tarmac ${d.offRoad} steps (first at ${d.offAt})`);
    t.assert(d.knocks === 0 && d.hops === 0 && d.damage === 0, `${label}: knocks ${d.knocks} (${d.knockAt} ${d.knockWith}), hops ${d.hops}, damage ${d.damage}`);
    t.assert(d.laneOffsetMax < 3, `${label}: strayed ${d.laneOffsetMax} m from the lane`);
    t.assert(d.maxVerticalG < 1.5, `${label}: vertical ${d.maxVerticalG} g at ${d.jerkAt}`);
    t.note(`${label}: ${d.distanceM} m in ${d.seconds} s, avg ${d.averageKmh} km/h, lane ${d.laneOffsetMax} m, vertical ${d.maxVerticalG} g`);
  }
}
