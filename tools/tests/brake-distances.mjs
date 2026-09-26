// brakeTest: 100-0 km/h stops land in sane bands (ABS works, wet is longer, a truck
// stops longer than a sedan) and the distance agrees with the reported mean g.
export default async function (t) {
  const dry = await t.call('brakeTest', 'sedan', 100);
  t.finite(dry, 'sedan dry');
  t.assert(dry.stopped, 'sedan did not stop');
  t.near(dry.distance, 32, 44, 'sedan dry m');
  t.assert(dry.absSeconds > 0.5, 'ABS never worked: ' + dry.absSeconds);
  t.near(Math.abs(dry.side), 0, 0.5, 'sedan drift m');
  // d = v^2 / (2 g a): the stop must match its own mean deceleration within 10%.
  const physics = (100 / 3.6) ** 2 / (2 * 9.81 * dry.meanG);
  t.near(+(dry.distance / physics).toFixed(3), 0.9, 1.1, 'distance / (v^2/2ga)');
  const wet = await t.call('brakeTest', 'sedan', 100, { wet: 1 });
  t.assert(wet.stopped, 'wet sedan did not stop');
  t.near(+(wet.distance / dry.distance).toFixed(3), 1.1, 1.8, 'wet / dry');
  const truck = await t.call('brakeTest', 'truck', 100);
  t.assert(truck.stopped && truck.distance > dry.distance, `truck ${truck.distance} m vs sedan ${dry.distance} m`);
  const slow = await t.call('brakeTest', 'sedan', 50);
  t.near(+(slow.distance / dry.distance).toFixed(3), 0.18, 0.35, '50 / 100 km/h distance');
}
