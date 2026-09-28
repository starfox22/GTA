// Headlights at a junction (headlight-beam.js, the JS mirror of CAR LAMPS): one low beam
// lights a lane-wide pool that ends by ~40 m, and eight cars queued on the four arms of a
// crossing share one VEHICLE LIGHT BUDGET, so where their beams overlap the road is a
// little brighter than under one beam but never past the cap (they used to sum to white).

export default async function (t) {
  // One car at the origin heading east (+x), lamps at the origin; map units (8 per metre).
  const single = await t.call('headlightBudget', [[0, 0, 0]], [
    [80, 0], // 10 m ahead
    [200, 0], // 25 m ahead
    [360, 0], // 45 m ahead
    [-40, 0], // behind the lamps
    [80, -80], // 10 m ahead, 10 m to the oncoming side
    [160, 96], // 20 m ahead, 12 m to the kerb side
  ]);
  t.finite(single, 'headlightBudget (one car)');
  const [ten, twentyFive, far, behind, oncoming, kerb] = single.points.map((p) => p.total);
  t.note(`one beam: ${JSON.stringify(single.points.map((p) => p.total))}, cap ${single.cap}`);
  t.near(ten, 0.5, single.cap, 'one beam, 10 m ahead');
  t.near(twentyFive, 0.3, single.cap, 'one beam, 25 m ahead');
  t.near(far, 0, 0.02, 'one beam, 45 m ahead (past its reach)');
  t.near(behind, 0, 0, 'one beam, behind the lamps');
  t.near(oncoming, 0, 0.05, 'one beam, 10 m to the oncoming side');
  t.near(kerb, 0, 0.1, 'one beam, 12 m to the kerb side at 20 m');

  // Two cars queued on each arm of a crossing at the origin (lanes 22 units off the centre
  // line, right-hand traffic), all pointing into it.
  const Q = Math.PI / 2,
    lamps = [
      [-60, 22, 0],
      [-120, 22, 0],
      [60, -22, Math.PI],
      [120, -22, Math.PI],
      [-22, -60, Q],
      [-22, -120, Q],
      [22, 60, -Q],
      [22, 120, -Q],
    ],
    points = [
      [0, 0],
      [0, 22],
      [22, 0],
      [-22, 0],
      [0, -22],
      [30, 30],
      [-30, -30],
    ],
    junction = await t.call('headlightBudget', lamps, points);
  t.finite(junction, 'headlightBudget (junction)');
  let overlapped = 0;
  for (const p of junction.points) {
    t.assert(p.total <= junction.cap + 1e-6, `junction (${p.x}, ${p.y}): ${p.total} over the cap ${junction.cap}`);
    t.assert(p.total >= p.brightest - 1e-6, `junction (${p.x}, ${p.y}): ${p.total} under its brightest beam ${p.brightest}`);
    if (p.beams.filter((b) => b > 0.1).length >= 2) {
      overlapped++;
      // Overlapping beams add less than their sum (the old look: the sum, burned to white).
      t.assert(p.total < p.sum * 0.9, `junction (${p.x}, ${p.y}): ${p.total} of ${p.sum} summed`);
    }
  }
  t.note(`junction: ${JSON.stringify(junction.points.map((p) => [p.total, p.sum]))}`);
  t.assert(overlapped >= 3, `beams overlap at ${overlapped} junction points`);
}
