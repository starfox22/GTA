// Wheelies (wheelie.js): throttle + climb lifts the front about the rear tyre, the throttle
// alone lets it settle, off the throttle it drops; held too long a sport bike loops out and
// the rider falls off the back; a cruiser barely lifts; the real keys: W + up lifts (on every motorbike that can),
// up alone (riding on the arrows) is only the throttle.
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
  await realHold(t, ['KeyW', 'ArrowUp'], 1.2);
  w = await t.call('wheelieState');
  t.assert(w.onBike && (w.log.lifts > lifts || w.deg > 3), `W + ↑ lifts the front without looping out: ${w.deg}°, lifts ${lifts} → ${w.log.lifts}`);
  const beforeLower = w.deg;
  await realHold(t, ['KeyW', 'ArrowDown'], .65);
  w = await t.call('wheelieState');
  t.assert(w.onBike && w.deg < Math.max(1, beforeLower - 8), `W + ↓ did not lower the front: ${beforeLower}° → ${w.deg}°`);
  await t.call('rideInto', 'bike', 25, 'none', 25, 0.05);
  await t.keys(['KeyW', 'KeyT'], 1.4);
  const beforeSpace = await t.call('wheelieState');
  t.assert(beforeSpace.deg > 12, 'rear-brake real-key fixture did not lift');
  await realHold(t, ['KeyW', 'Space'], .65);
  w = await t.call('wheelieState');
  t.assert(w.onBike && w.deg < Math.max(1, beforeSpace.deg - 8), `W + Space did not lower the front: ${beforeSpace.deg}° → ${w.deg}°`);
  // ... and ↑ alone is only the throttle.
  await t.call('rideInto', 'bike', 20, 'none', 25, 0.05);
  w = await t.call('wheelieState');
  const before = w.log.lifts,
    kmh = w.kmh;
  await realHold(t, ['ArrowUp'], 1.2);
  w = await t.call('wheelieState');
  t.assert(w.log.lifts === before && w.deg < 1, `↑ alone does not lift it: ${w.deg}°`);
  t.assert(w.kmh > kmh + 5, `↑ alone is the throttle: ${kmh} → ${w.kmh} km/h`);
  // Every other motorbike that can pull one (the wheelie hint's list) lifts on the real keys too.
  for (const type of ['dolcati', 'yamasaki', 'kr500']) {
    await t.call('rideInto', type, 20, 'none', 25, 0.05);
    w = await t.call('wheelieState');
    const from = w.log.lifts;
    t.assert(w.onBike && w.type === type, `on the ${type}: ${JSON.stringify({ onBike: w.onBike, type: w.type })}`);
    await realHold(t, ['KeyW', 'ArrowUp'], 1.2);
    w = await t.call('wheelieState');
    t.assert(w.log.lifts > from || w.deg > 3, `${type}: W + ↑ lifts the front: ${w.deg}°, lifts ${from} → ${w.log.lifts}`);
  }
}

/* Short real-key bursts stop against the observed game clock. A one-off wall-clock calibration can read zero
   frames on a loaded machine, then over-hold Up for ten seconds after it recovers and loop out the fixture. */
async function realHold(t, codes, gameSeconds) {
  const start = await t.call('wheelieState');
  let current = start, wall = 0;
  for (let i = 0; i < 80 && current.at - start.at < gameSeconds; i++) {
    const burst = Math.min(.2, Math.max(.04, gameSeconds - (current.at - start.at)));
    await t.keys(codes, burst, { real: true });
    wall += burst;
    current = await t.call('wheelieState');
  }
  t.assert(current.at - start.at >= gameSeconds - .03, 'the live frame loop did not advance during real input');
  if (wall > gameSeconds * 1.4) t.note(`slow page: real keys took ${wall.toFixed(1)} s for ${(current.at - start.at).toFixed(2)} game s`);
}
