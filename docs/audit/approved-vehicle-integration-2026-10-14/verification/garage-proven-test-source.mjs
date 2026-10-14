// Monarch villa garages (monarch-garages.js): every garage holds a real car, its roll-up door opens as the player
// comes up the drive, the car is entered (the real action key on the first) and driven out of the garage, down the
// drive and through the gate to the street, and the door rolls down behind it.
export const fresh = true;
export default async function (t) {
  await t.call('god', true);
  const garages = await t.call('villaGarages');
  t.assert(garages.length === 14, 'garages: ' + garages.length);
  for (const g of garages) {
    t.assert(g.door && g.drive, g.villa + ' has no door or drive: ' + JSON.stringify(g));
    t.assert(g.cars.length === 1, g.villa + ' should hold one car: ' + JSON.stringify(g.cars));
  }
  t.assert(garages.every((g) => g.door.open === 0), 'doors start shut: ' + JSON.stringify(garages.map((g) => g.door.open)));
  const lanes = await t.call('vehicleEntrances');
  for (const e of lanes) t.assert(!e.parked.length, e.name + ' is blocked: ' + JSON.stringify(e.parked));
  let first = true;
  for (const g of garages) {
    const n = g.door.side === 'west' ? [-1, 0] : g.door.side === 'south' ? [0, 1] : [0, -1],
      at = (d) => [g.door.x + n[0] * d, g.door.y + n[1] * d];
    // Walking up the drive opens the door.
    await t.call('teleport', ...at(40));
    await t.wait(2.2);
    let s = (await t.call('villaGarages')).find((o) => o.villa === g.villa);
    t.assert(s.door.open > 0.95, g.villa + ' door did not open: ' + JSON.stringify(s.door));
    // Into the garage, beside the car, and in.
    await t.call('teleport', ...at(-6));
    await t.wait(0.2);
    if (first) {
      await t.keys('KeyE', 0.2, { real: true });
      await t.realWait(2);
      await t.call('holdSimulation', true);
      first = false;
    } else await t.call('interact');
    await t.wait(1.5);
    const status = await t.call('status');
    t.assert(status.vehicle === g.cars[0].type, g.villa + ': not in the garage car: ' + JSON.stringify(status));
    // Out of the garage, down the drive, through the gate onto the street.
    let r = await t.call('steerTo', ...at(34), 12, 14);
    t.assert(r && r.reason === 'arrived', g.villa + ': stuck leaving the garage: ' + JSON.stringify(r));
    const gate = [g.gate.x + n[0] * 60, g.gate.y + n[1] * 60];
    r = await t.call('steerTo', gate[0], gate[1], 20, 22);
    t.assert(r && r.reason === 'arrived', g.villa + ': stuck on the way to the street: ' + JSON.stringify(r));
    const past = n[0] ? (g.gate.x - r.x) * -n[0] : (r.y - g.gate.y) * n[1];
    t.assert(past > 30, g.villa + ': not out through the gate: ' + JSON.stringify(r));
    await t.wait(3.5);
    s = (await t.call('villaGarages')).find((o) => o.villa === g.villa);
    t.assert(s.door.open < 0.1, g.villa + ' door stayed up behind the car: ' + JSON.stringify(s.door));
    await t.call('interact');
    await t.wait(1);
  }
  // A garage built just inside the gate stood across the drive: the forecourt's cars leave by the side gate.
  for (const g of garages.filter((o) => o.sideGate)) {
    const s = (await t.call('villaGarages')).find((o) => o.villa === g.villa),
      side = s.sideGate,
      car = s.forecourt.sort((a, b) => Math.abs(a.x - side.x) - Math.abs(b.x - side.x))[0];
    t.assert(car, g.villa + ': no car on the forecourt: ' + JSON.stringify(s));
    await t.call('teleport', car.x, car.y - 24);
    await t.wait(0.2);
    await t.call('interact');
    await t.wait(1.5);
    t.assert((await t.call('status')).vehicle === car.type, g.villa + ': not in the forecourt car');
    let r;
    // Miramar's north-facing forecourt SUV needs a short open-space alignment
    // before the straight-line pilot turns near its 48-unit frontage opening.
    if (g.villa === 'VILLA MIRAMAR') {
      r = await t.call('steerTo', side.x, car.y - 12, 15, 7);
      t.assert(r && r.reason === 'arrived', g.villa + ': could not align with the side gate: ' + JSON.stringify(r));
    }
    r = await t.call('steerTo', side.x, side.y - 34, 15, 14);
    t.assert(r && r.reason === 'arrived', g.villa + ': stuck on the way to the side gate: ' + JSON.stringify(r));
    r = await t.call('steerTo', side.x, side.y + 60, 15, 22);
    t.assert(r && r.reason === 'arrived' && r.y > side.y + 30, g.villa + ': not out through the side gate: ' + JSON.stringify(r));
    await t.call('interact');
    await t.wait(1);
  }
}
