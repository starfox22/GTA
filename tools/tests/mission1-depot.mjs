// Mission 1 (Dockside Favor) drop through its console helpers: deliver the loaded
// truck into Vinny's warehouse, shutter down, exit the truck, out the back door: won.
export const fresh = true;
export default async function (t) {
  await t.call('god', true); // the harbor police would otherwise win the gunfight
  const s = await t.call('skipToDepotDelivery');
  t.assert(s.stage === 3 && s.vehicle === 'flatbed', 'setup: ' + JSON.stringify(s));
  await t.keys('KeyW', 3); // drive at the open shutter and coast in
  await t.wait(4);
  let m = await t.call('missionState');
  if (m.stage === 3) {
    // Officers or a cruiser in the way can leave the truck short or askew: park it
    // inside (the drop itself is what this test is about).
    t.note('truck parked inside by placeVehicle: ' + m.instruction);
    await t.call('neutraliseDepotPolice');
    await t.call('placeVehicle', -1664, 4470, Math.PI / 2);
  }
  await t.wait(8);
  m = await t.call('missionState');
  t.assert(m.depotSealed && m.stage >= 5, 'warehouse not sealed: ' + JSON.stringify(m));
  await t.call('neutraliseDepotPolice');
  await t.wait(2);
  await t.call('interact'); // E: out of the cab
  await t.wait(2);
  m = await t.call('missionState');
  t.assert(m.stage === 7 && m.depotBackDoor < 0.5, 'back door not open: ' + JSON.stringify(m));
  await t.call('teleport', -1666, 4540); // inside, by the back door
  await t.wait(1);
  await t.call('teleport', -1666, 4615); // out on the pavement
  await t.wait(7);
  m = await t.call('missionState');
  t.assert(m.last?.result === 'won' && m.completed === 1, 'mission not won: ' + JSON.stringify(m));
  await t.call('god', false);
}
