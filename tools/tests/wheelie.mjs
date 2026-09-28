// Wheelies (wheelie.js): throttle + climb lifts the front about the rear tyre, the throttle
// alone lets it settle, off the throttle it drops; held too long a sport bike loops out and
// the rider falls off the back; a cruiser barely lifts; the real keys: W + up lifts, up alone
// (riding on the arrows) is only the throttle.
export const fresh = true;

export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.call('rideInto', 'bike', 30, 'none', 25, 0.05);
    await t.keys(['KeyW', 'KeyT'], 1.2);
    let w = await t.call('wheelieState');
    t.assert(w.onBike && w.deg > 12 && w.deg < 45, `W + climb lifts the front: ${w.deg}°`);
    t.assert(w.steerShare < 0.6, `little steering with the front up: ${w.steerShare}`);
    const lifted = w.deg;
    await t.keys(['KeyW'], 0.6);
    w = await t.call('wheelieState');
    t.assert(w.deg > 0 && w.deg < lifted, `the throttle alone lets it settle: ${lifted}° → ${w.deg}°`);
    await t.keys([], 2);
    w = await t.call('wheelieState');
    t.assert(w.onBike && Math.abs(w.deg) < 0.5 && w.log.loops === 0, `off the throttle it comes down: ${w.deg}°`);

    // Held on from a low gear: past the balance point, over it goes (at speed
    // the engine no longer has the pull to lift it).
    await t.call('rideInto', 'bike', 25, 'none', 25, 0.05);
    await t.keys(['KeyW', 'KeyT'], 5);
    w = await t.call('wheelieState');
    const rider = await t.call('riderReport');
    t.assert(!w.onBike && w.log.loops === 1, `held too long it loops out: ${JSON.stringify(w.log)}`);
    t.assert(rider.throws.at(-1)?.cause === 'loopout', `off the back: ${JSON.stringify(rider.throws.at(-1))}`);
    t.note(`sport bike: ${lifted}° after 1.2 s, looped at ${w.log.lastLoop.kmh} km/h`);
    await t.wait(8);

    // A heavy cruiser barely lifts.
    await t.call('rideInto', 'cruiser', 30, 'none', 25, 0.05);
    await t.keys(['KeyW', 'KeyT'], 1.5);
    w = await t.call('wheelieState');
    t.assert(w.onBike && w.deg < 4, `the cruiser stays down: ${w.deg}°`);

    // A bicycle: a small one.
    await t.call('rideInto', 'bicycle', 12, 'none', 25, 0.05);
    await t.keys(['KeyW', 'KeyT'], 0.8);
    w = await t.call('wheelieState');
    t.assert(w.onBike && w.deg > 4 && w.deg < 30, `a bicycle lifts a little: ${w.deg}°`);
  } finally {
    await t.call('holdSimulation', false);
  }

  // The real keys through the frame loop (wheelieHeld): W with ↑ lifts it ...
  await t.call('rideInto', 'bike', 20, 'none', 25, 0.05);
  let w = await t.call('wheelieState');
  const lifts = w.log.lifts;
  await t.keys(['KeyW', 'ArrowUp'], 1.2, { real: true });
  w = await t.call('wheelieState');
  t.assert(w.log.lifts > lifts || w.deg > 3, `W + ↑ lifts the front: ${w.deg}°, lifts ${lifts} → ${w.log.lifts}`);
  // ... and ↑ alone is only the throttle.
  await t.call('rideInto', 'bike', 20, 'none', 25, 0.05);
  w = await t.call('wheelieState');
  const before = w.log.lifts,
    kmh = w.kmh;
  await t.keys(['ArrowUp'], 1.2, { real: true });
  w = await t.call('wheelieState');
  t.assert(w.log.lifts === before && w.deg < 1, `↑ alone does not lift it: ${w.deg}°`);
  t.assert(w.kmh > kmh + 5, `↑ alone is the throttle: ${kmh} → ${w.kmh} km/h`);
}
