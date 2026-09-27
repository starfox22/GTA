// The carjack struggle (carjack-struggle.js): walk to the driver's door (round the car
// from the kerb side), the door, the tug of war, the throw, the seat in 1-2.5 s; the
// victim is dressed as the car's driver, shouts, gets up and reports it; a passenger
// runs; a defiant driver lands a punch; a pleading one puts their hands up; E again
// cuts it short; walking off calls it off with the driver still at the wheel.
export const fresh = true;
let lastSeen = null;
async function untilInCar(t, limit = 3.5) {
  let waited = 0;
  while (waited < limit) {
    await t.wait(0.1);
    waited += 0.1;
    const s = await t.call('carjack');
    lastSeen = s;
    if (!s.running && s.inCar) return waited;
  }
  return null;
}
export default async function (t) {
  await t.call('god', true);
  // Each case from the same open ground, so no wall or parked car is in the way.
  const jack = async (...args) => {
    await t.call('teleport', 1000, 1000);
    return t.call('carjackTest', ...args);
  };
  // From the driver's side: straight to the door.
  let s = await jack('flee', 'driver', true, 1);
  t.assert(s.running && s.phase === 'approach' && s.waypoints === 1, 'start: ' + JSON.stringify(s));
  const took = await untilInCar(t);
  t.assert(took !== null, 'never got into the car');
  t.near(took, 0.9, 2.2, 'seconds from E to the seat (driver side)');
  s = await t.call('carjack');
  t.assert(s.victim && s.victim.female === true, 'victim not dressed as the car said: ' + JSON.stringify(s.victim));
  t.assert(s.passengers === 1, 'passenger count ' + s.passengers);
  const w = await t.call('witnesses');
  t.assert(w.incidents.some((i) => i.kind === 'carjack'), 'carjack not left to the driver to report: ' + JSON.stringify(w.incidents));
  // Up again and shouting; once the player has driven off, the theft is phoned in.
  await t.wait(2);
  let v = (await t.call('carjack')).victim;
  t.assert(!v.down, 'victim still down: ' + JSON.stringify(v));
  t.assert(v.d > 12, 'victim still at the car (' + v.d + ')');
  await t.keys('KeyW', 3);
  for (let i = 0; i < 30 && !v.reported; i++) {
    await t.wait(1);
    v = (await t.call('carjack')).victim;
    if (v.speech) t.note('victim: ' + v.speech);
  }
  t.assert(v.reported, 'the driver never called it in: ' + JSON.stringify(v));

  // From the kerb (passenger) side: round the car first; a defiant driver punches.
  await t.call('god', false);
  await t.call('heal');
  s = await jack('defiant', 'passenger', false, 0);
  t.assert(s.running && s.waypoints >= 2, 'no way round the car: ' + JSON.stringify(s));
  t.assert(s.approachFor > 0.3, 'walk round too short: ' + s.approachFor);
  t.assert((await untilInCar(t)) !== null, 'defiant: never got in: ' + JSON.stringify(lastSeen) + JSON.stringify(await t.call('status')));
  const hp = (await t.call('status')).hp;
  t.assert(hp < 100 && hp > 90, 'the punch did not land (hp ' + hp + ')');
  await t.call('god', true);

  // A pleading driver: hands up, not thrown.
  s = await jack('plead', 'driver', false, 0);
  await t.wait(0.75);
  s = await t.call('carjack');
  t.assert(s.victim && s.victim.pose === 'handsUp' && !s.victim.down, 'plead: ' + JSON.stringify(s.victim));

  // E again during the tug: straight to the throw.
  s = await jack('angry', 'driver', null, 0);
  let phase = s.phase;
  for (let i = 0; i < 16 && phase !== 'tug'; i++) {
    await t.wait(0.05);
    s = await t.call('carjack');
    phase = s.phase;
  }
  t.assert(phase === 'tug', 'never reached the tug: ' + JSON.stringify(s));
  await t.call('interact');
  s = await t.call('carjack');
  t.assert(!s.running || s.phase === 'throw', 'E did not cut the struggle short: ' + s.phase);

  // Walking off during the approach calls it off; the driver stays at the wheel.
  s = await jack('flee', 'passenger', null, 0);
  await t.keys('KeyS', 0.3);
  s = await t.call('carjack');
  t.assert(!s.running && !s.inCar, 'walking off did not cancel: ' + JSON.stringify(s));
}
