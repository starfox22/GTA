// Tyre effects (tyre-effects.js): hard cornering, a power drift, a handbrake turn and a
// locked-wheel stop on tarmac lay skid marks but no smoke; a burnout (forward + handbrake at a
// standstill) smokes, lays rubber and holds the car, and letting go launches it; dry dirt
// throws dust (none once it is wet); a soaked road throws spray, not smoke.
export default async function (t) {
  // The Oceanview runway (tarmac, clear; 30 m wide round y 9884), where driftTest runs:
  // from its north edge, so a right-hand turn stays on it.
  const RUNWAY = { x: -2600, y: 9784 };
  const run = async (type, kmh, phases, options = {}) => {
    await t.call('tyreEffects', true);
    const drive = await t.call('driftTest', type, kmh, phases, { ...RUNWAY, ...options });
    const effects = await t.call('tyreEffects');
    return { drive, effects, totals: effects.totals };
  };
  await t.call('holdSimulation', true);
  await t.call('sky', 'clear');
  await t.call('wetness', 0);
  try {
    // Hard cornering past the grip (the understeer scrub): faint marks, no smoke.
    const corner = await run('sedan', 55, [['KeyD', 3]]);
    t.assert(corner.totals.smoke === 0, 'hard cornering smoked: ' + JSON.stringify(corner.totals));
    t.assert(corner.totals.marks > 0, 'hard cornering laid no marks: ' + JSON.stringify(corner.totals));
    // A power drift with the assists off, a handbrake turn, a locked-wheel stop: marks, no smoke.
    await t.call('settings', { tcs: false, esc: false, abs: false });
    for (const [type, kmh, phases, label] of [
      ['hotrod', 60, [['KeyW,KeyD', 2]], 'power drift'],
      ['sedan', 60, [['Space,KeyD', 1.4]], 'handbrake turn'],
      ['sedan', 90, [['KeyS', 2]], 'locked-wheel stop'],
    ]) {
      const r = await run(type, kmh, phases);
      t.assert(r.totals.smoke === 0, label + ' smoked: ' + JSON.stringify(r.totals));
      t.assert(r.totals.marks > 0, label + ' laid no marks: ' + JSON.stringify(r.totals));
    }
    await t.call('settings', { drivingReset: true });
    // Cruising and a tidy lane change: nothing at all.
    const lane = await run('sedan', 100, [['KeyW,KeyD', 0.4], ['KeyW,KeyA', 0.5], ['KeyW', 1]]);
    t.assert(lane.totals.smoke === 0 && lane.totals.marks === 0, 'a lane change left rubber: ' + JSON.stringify(lane.totals));
    // A burnout: held in place, the smoke thickening, a black patch; let go and it launches.
    for (const [type, axle] of [['sedan', 'front'], ['muscle', 'rear']]) {
      const burn = await run(type, 0, [['KeyW,Space', 1], ['KeyW,Space', 2.5]]);
      t.assert(burn.effects.ground === 'asphalt', 'the runway reads as ' + burn.effects.ground);
      t.assert(burn.effects.burnout.active, type + ' burnout did not light: ' + JSON.stringify(burn.effects));
      t.assert(burn.effects.burnout.axle === axle, type + ' burnout axle ' + burn.effects.burnout.axle);
      t.assert(burn.totals.smoke > 20, type + ' burnout gave too little smoke: ' + JSON.stringify(burn.totals));
      t.assert(burn.totals.marks > 0, type + ' burnout laid no rubber');
      t.near(burn.totals.metres, 0, 0.5, type + ' burnout crept (m)');
      t.assert(burn.drive.ends[1].kmh < 3, type + ' burnout moving at ' + burn.drive.ends[1].kmh);
      t.assert(burn.effects.emitting.kind === 'smoke' && burn.effects.burnout.heat > 0.9, type + ' burnout not smoking hot: ' + JSON.stringify(burn.effects));
    }
    // The smoke builds with the spin's duration.
    const early = await run('sedan', 0, [['KeyW,Space', 0.5]]);
    t.assert(early.effects.emitting.rate < 12, 'burnout smoke at 0.5 s already thick: ' + JSON.stringify(early.effects.emitting));
    // Release: the car launches on its spinning tyres.
    const launch = await run('sedan', 0, [['KeyW,Space', 1.5], ['KeyW', 2]]);
    t.assert(launch.drive.ends[1].kmh > 20, 'no launch after the burnout: ' + JSON.stringify(launch.drive.ends));
    // Soaked tarmac: spray, not smoke.
    const wet = await run('sedan', 90, [['KeyW', 2]], { wet: 1 });
    t.assert(wet.totals.spray > 0 && wet.totals.smoke === 0, 'wet road: ' + JSON.stringify(wet.totals));
    // Dry dirt (the foot of the second mountain trail, flat, no mud): dust, not smoke;
    // none once it is wet.
    const dirt = async (type) => {
      await t.call('drive', type);
      await t.wait(0.3);
      const at = await t.call('placeVehicle', 9519, 2752, -1.39);
      t.assert(at.vehicle === type && Math.abs(at.x - 9519) < 5, 'not placed on the trail: ' + JSON.stringify(at));
      await t.wait(0.3);
      await t.call('tyreEffects', true);
      await t.keys('KeyW', 2);
      return t.call('tyreEffects');
    };
    const dry = await dirt('jeep');
    t.assert(dry.ground === 'dirt' && dry.totals.dust > 5 && dry.totals.smoke === 0, 'dry dirt: ' + JSON.stringify(dry));
    await t.call('wetness', 1);
    const muddy = await dirt('jeep');
    t.assert(muddy.totals.dust < dry.totals.dust * 0.3, 'wet dirt still dusty: ' + JSON.stringify(muddy.totals));
  } finally {
    await t.call('settings', { drivingReset: true });
    await t.call('wetness', 0);
    await t.call('sky');
    await t.call('holdSimulation', false);
  }
}
