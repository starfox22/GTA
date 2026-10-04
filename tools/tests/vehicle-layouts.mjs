// Every vehicle shares one object layout (makeCar declares every field any system sets: core-and-contracts.md
// Performance rules). With 25-41 layouts every read in the loops over all vehicles went megamorphic and allocated a boxed
// copy of each number read: a field set later outside makeCar shows up here by name in `extraKeys`. The hot vehicle
// functions stay well under the garbage they made before (allocBench, bytes a call, generous bounds).
export default async function (t) {
  await t.call('god', true);
  await t.call('teleport', 748, 584);
  await t.call('drive', 'sedan');
  await t.call('wanted', 3);
  await t.wait(4);
  await t.call('drive', 'helicopter', 60);
  await t.wait(2);
  await t.call('teleport', 3000, 4000);
  await t.call('drive', 'speedboat');
  await t.wait(2);
  await t.call('wanted', 0);
  await t.call('teleport', 748, 584);
  await t.wait(3);
  const shapes = await t.call('shapeReport');
  t.assert(shapes.layouts <= 3, `vehicle layouts: ${shapes.layouts} (declare these in makeCar: ${JSON.stringify(shapes.extraKeys)}; order: ${JSON.stringify(shapes.parts)})`);
  const traffic = await t.call('allocBench', 'trafficControl', 6);
  t.assert(traffic.bytesPerCall === null || traffic.bytesPerCall < 12000, `trafficControl garbage: ${traffic.bytesPerCall} bytes a call (24,000 before the layout work)`);
  const step = await t.call('allocBench', 'physicsStep', 10);
  t.assert(step.bytesPerCall === null || step.bytesPerCall < 400000, `physicsStep garbage: ${step.bytesPerCall} bytes a step (570,000 before)`);
}
