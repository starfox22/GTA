// Board existing nose-out airport planes with E; taxi and rotate through the ordinary mapped key actions.
export const fresh = true;
const angle = n => Math.atan2(Math.sin(n), Math.cos(n));
export function taxiKeys(p, target) {
  const error = angle(Math.atan2(target.y - p.y, target.x - p.x) - p.a), keys = [];
  const power = p.speedKmh < 8 ? 0.2 : 0.08;
  if (p.throttle < power - 0.02) keys.push('KeyW');
  else if (p.throttle > power + 0.02) keys.push('KeyS');
  if (error > 0.04) keys.push('KeyD');
  if (error < -0.04) keys.push('KeyA');
  return keys;
}
export function takeoffKeys(p, target) {
  const error = angle(Math.atan2(target.y - p.y, target.x - p.x) - p.a), keys = ['KeyW', 'KeyT'];
  if (p.aglM < 0.1) {
    if (error > 0.025) keys.push('KeyD');
    if (error < -0.025) keys.push('KeyA');
  }
  return keys;
}
export default async function (t) {
  for (const [frame, stand] of [['skyhawk', 'southport-1'], ['courier', 'oceanview-courier'], ['jet', 'oceanview-mid'], ['airliner', 'oceanview-east']]) {
    if (frame !== 'skyhawk') await t.reload();
    await t.call('holdSimulation', true);
    try {
      const planes = (await t.call('airfields')).aircraft;
      t.assert(planes.length === 7 && planes.every(p => p.clear && p.dry), 'all parked aircraft must start with dry, clear wingtip footprints: ' + JSON.stringify(planes));
      const parked = planes.find(p => p.stand === stand);
      t.assert(parked && parked.airframe === frame, 'missing parked ' + stand);
      // Stand outside the full wing collision box. A centre-only entry radius
      // used to make the larger planes unreachable without standing inside it.
      const plan = await t.call('aircraftTaxi', parked.id), side = plan.footprintM.span * 4 + 18;
      await t.call('teleport', parked.x - Math.sin(parked.a) * side, parked.y + Math.cos(parked.a) * side);
      await t.keys('KeyE', 0.1, { real: true });
      let p = await t.call('aircraftTaxi');
      t.assert(p?.id === parked.id, 'E must enter the existing parked aircraft, not create one: ' + JSON.stringify(p));
      if (frame === 'skyhawk') {
        await t.call('holdSimulation', false);
        await t.keys('ArrowUp', 0.3, { real: true });
        await t.call('holdSimulation', true);
        const arrow = await t.call('aircraftTaxi');
        const attitude = await t.call('flight');
        t.assert(attitude.pitch > 0 && arrow.throttle === 0 && arrow.power === 0, 'the pitch arrow must raise the nose without also opening the throttle');
      }
      const hp = p.hp;
      let elapsed = 0;
      for (const target of p.taxi) {
        while (Math.hypot(p.x - target.x, p.y - target.y) > 20 && elapsed < 180) {
          await t.keys(taxiKeys(p, target), 0.2);
          elapsed += 0.2;
          p = await t.call('aircraftTaxi');
          t.assert(p.hp === hp && p.clear && p.dry && p.aglM < 0.1, `${stand}: taxi hit a solid/aircraft or left dry ground: ${JSON.stringify(p)}`);
        }
      }
      t.assert(elapsed < 180 && p.runway, `${stand}: did not taxi onto the runway: ${JSON.stringify(p)}`);
      const runway = frame === 'skyhawk' ? { x: 418, y: 7800 } : { x: -3900, y: 9884 };
      const start = { x: p.x, y: p.y }, remaining = p.runway.remainingM;
      let flight = await t.call('flight'), rollTime = 0;
      while (flight.agl < 3 && rollTime < 50) {
        await t.keys(takeoffKeys(p, runway), 0.1);
        rollTime += 0.1;
        p = await t.call('aircraftTaxi'); flight = await t.call('flight');
        t.assert(p.hp === hp, `${stand}: damaged during take-off: ${JSON.stringify(p)}`);
      }
      t.assert(flight.agl >= 3 && rollTime < 50, `${stand}: failed to lift off: ${JSON.stringify(flight)}`);
      const rollM = Math.hypot(p.x - start.x, p.y - start.y) / 8;
      t.assert(rollM < remaining, `${stand}: ran past the runway before take-off (${rollM}/${remaining} m)`);
      await t.keys('KeyW', 2);
      flight = await t.call('flight');
      t.assert(flight.agl > 2 && !flight.stall, `${stand}: did not remain airborne after releasing the pitch input: ${JSON.stringify(flight)}`);
      t.note(`${stand}: existing #${parked.id}; ${elapsed.toFixed(1)} s taxi, ${rollM.toFixed(1)} m to 3 m AGL, ${remaining.toFixed(1)} m runway available`);
    } finally {
      await t.call('holdSimulation', false);
    }
  }
}
