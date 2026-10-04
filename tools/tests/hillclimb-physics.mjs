// The Mount Ascent hill climb on the terrain suspension (terrain-suspension.js): a club crawler
// driven up the whole course by the trail pilot at 1/30 and 1/60 s frames, and down it, stays on
// its wheels (no flights, no more than a brief skip off a rock, no blow through the stops worth
// damage), reaches the summit with every checkpoint inside the challenge time, and a truck
// stopped on the climb stands still on its springs (weight on the rear wheels, no creeping pose).
export const fresh = true;

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('teleport', 7520, 1950);
    await t.call('drive', 'crawler');
    const runs = {};
    for (const frame of [1 / 30, 1 / 60]) {
      await t.call('hillClimb', 'gate', 0);
      const r = await t.call('trailDrive', 240, 45, 0, frame);
      const label = `climb at 1/${Math.round(1 / frame)}`;
      t.finite(r, label);
      runs[frame] = r;
      t.assert(!r.nan && r.ride.nan === 0, `${label}: NaN in the ride`);
      t.assert(r.reason === 'summit', `${label}: stopped (${r.reason}) at ${r.progress} of the course`);
      t.assert(r.last && r.last.clean, `${label}: not a clean run: ${JSON.stringify(r.last)}`);
      t.assert(r.cliffFlights === 0 && r.ride.flights === 0, `${label}: ${r.cliffFlights} flights (${JSON.stringify(r.ride.gapAt)})`);
      // A skip off a rock at speed is a few hundredths of a second and a few centimetres.
      t.assert(r.ride.airS < 0.5, `${label}: ${r.ride.airS} s with every wheel off the ground`);
      t.assert(r.ride.maxGapM < 0.3, `${label}: wheels ${r.ride.maxGapM} m off the ground at ${JSON.stringify(r.ride.gapAt)}`);
      // Climbing the slickrock (0.36) at 40 km/h is about 4 m/s up; a launch is far more.
      t.assert(r.ride.maxUpMs < 6, `${label}: the body rose at ${r.ride.maxUpMs} m/s`);
      t.assert(r.ride.maxBlowMs < 3, `${label}: a ${r.ride.maxBlowMs} m/s blow through the bump stops at ${JSON.stringify(r.ride.blowAt)}`);
      t.assert(!r.overturned && r.hp >= 200, `${label}: hp ${r.hp}, overturned ${r.overturned}`);
      t.assert(r.last.time < 75, `${label}: ${r.last.time} s is over the 1:15 challenge`);
      t.note(`${label}: summit in ${r.last.time} s (splits ${r.last.splits.join(', ')}), air ${r.ride.airS} s, gap ${r.ride.maxGapM} m, up ${r.ride.maxUpMs} m/s, stops ${r.ride.stops} (max ${r.ride.maxBlowMs} m/s)`);
    }
    // No frame-rate dependence worth the name: the same course, the same time within 10%.
    const a = runs[1 / 30].last.time,
      b = runs[1 / 60].last.time;
    t.assert(Math.abs(a - b) / a < 0.1, `climb time depends on the frame: ${a} s at 1/30, ${b} s at 1/60`);

    // Down from just below the summit to the trailhead.
    await t.call('hillClimb', 'top', 0);
    const d = await t.call('trailDrive', 240, 35, 0, 1 / 30, 'down');
    t.finite(d, 'descent');
    t.assert(d.reason === 'trailhead', `descent stopped (${d.reason}) at ${d.progress}`);
    t.assert(d.cliffFlights === 0 && d.ride.flights === 0 && d.ride.airS < 0.3, `descent: flights ${d.cliffFlights}, air ${d.ride.airS} s`);
    t.assert(d.ride.maxBlowMs < 3 && !d.overturned && d.hp >= 200, `descent: blow ${d.ride.maxBlowMs} m/s, hp ${d.hp}`);
    t.note(`descent: ${d.seconds} s, air ${d.ride.airS} s, gap ${d.ride.maxGapM} m, stops ${d.ride.stops}`);

    // Stopped on the climb (the checkpoint past the rock garden, on dry dirt): it stands on its
    // springs with the load shifted downhill, and the pose holds still.
    await t.call('hillClimb', 'cp2', 0);
    await t.wait(4);
    const s1 = await t.call('ride3d');
    await t.wait(1);
    const s2 = await t.call('ride3d');
    t.finite(s2, 'ride at rest');
    t.assert(s2.onTerrain && !s2.air, `at rest: on the terrain ${s2.onTerrain}, air ${s2.air}`);
    t.assert(Math.abs(s2.pitchDeg - s1.pitchDeg) < 0.05 && Math.abs(s2.rollDeg - s1.rollDeg) < 0.05, `the pose creeps: ${s1.pitchDeg}/${s1.rollDeg} then ${s2.pitchDeg}/${s2.rollDeg}`);
    t.assert(Math.abs(s2.loadG - 1) < 0.03, `standing load ${s2.loadG} g`);
    const front = s2.wheelLoadG[0] + s2.wheelLoadG[1],
      rear = s2.wheelLoadG[2] + s2.wheelLoadG[3];
    t.assert(Math.abs(s2.pitchDeg) < 3 || (s2.pitchDeg > 0) === rear > front, `load not shifted downhill: front ${front.toFixed(3)} rear ${rear.toFixed(3)} at pitch ${s2.pitchDeg}`);
    t.note(`at rest on the climb: pitch ${s2.pitchDeg} deg, front ${front.toFixed(2)} g, rear ${rear.toFixed(2)} g`);
  } finally {
    await t.call('holdSimulation', false);
  }
}
