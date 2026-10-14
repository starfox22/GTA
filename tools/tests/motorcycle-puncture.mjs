// Production bulletEntry/bulletHitVehicle: motorcycle tyres are independent of glass bands,
// low side hits identify one axle, and existing car/truck/glass behavior stays intact.
import fs from 'node:fs';
import vm from 'node:vm';

export default async function (t) {
  let scatter = -3.5, chance = .4;
  const fixtureMath = Object.create(Math); fixtureMath.random = () => chance;
  const scope = vm.createContext({ Math: fixtureMath, UNITS_PER_METRE: 8,
    vehicleSpec: c => c.spec, isAircraft: c => !!c.aircraft, isBoat: c => !!c.boat,
    entityElevation: c => c.altitude || 0, randomBetween: () => scatter,
    noteVehicleRoundZone: () => {}, clamp: (v, low, high) => Math.max(low, Math.min(high, v)) });
  const api = vm.runInContext(fs.readFileSync(new URL('../../src/damage-vehicles.js', import.meta.url), 'utf8') +
    String.fromCharCode(10) + '({ bulletEntry, bulletHitVehicle, freshDamage, vehicleWorldPoint, vehicleHandling })', scope);
  const make = (type = 'bike', heading = 0, altitude = 0, length = 17.6) => ({
    type, x: 100, y: 300, a: heading, altitude, hp: 100, maxhp: 100, damageVersion: 0,
    spec: { l: length, w: type === 'bike' ? 6.56 : 16, bike: type === 'bike', truck: type === 'truck' },
    damage: api.freshDamage(), dents: [],
  });
  const round = (c, longitudinal, side = 'right', altitude = c.altitude) => {
    const sign = side === 'left' || side === 'rear' ? -1 : 1;
    const from = api.vehicleWorldPoint(c, side === 'front' || side === 'rear' ? sign * (c.spec.l / 2 + 6) : longitudinal,
      side === 'front' || side === 'rear' ? 0 : sign * (c.spec.w / 2 + 6));
    const to = api.vehicleWorldPoint(c, side === 'front' || side === 'rear' ? sign * (c.spec.l / 2 - 1.5) : longitudinal,
      side === 'front' || side === 'rear' ? 0 : sign * (c.spec.w / 2 - 1.5));
    return { px: from.x, py: from.y, x: to.x, y: to.y, vx: (to.x - from.x) * 100,
      vy: (to.y - from.y) * 100, altitude, dmg: 28 };
  };
  const flats = c => Object.keys(c.damage.tires).filter(key => c.damage.tires[key]);
  for (const angle of [0, Math.PI / 2, -Math.PI / 3]) for (const elevation of [0, 80]) {
    for (const side of ['left', 'right']) for (const end of ['front', 'rear']) {
      const c = make('bike', angle, elevation), x = (end === 'front' ? .34 : -.34) * c.spec.l;
      const b = round(c, x, side), entry = api.bulletEntry(c, b);
      t.assert(entry.face === side && Math.abs(entry.x - x) < 1e-9, 'projectile side entry was not transformed into motorcycle space');
      t.assert(api.bulletHitVehicle(c, b) === 'metal', 'motorcycle impact changed surface kind');
      t.assert(JSON.stringify(flats(c)) === JSON.stringify([end + (side === 'left' ? 'Left' : 'Right')]),
        `low ${side} hit did not puncture only ${end}: angle ${angle}, elevation ${elevation}, ${JSON.stringify(flats(c))}`);
      t.assert(c.damageVersion === 1 && c.hp === 100 && c.damage.marks.length === 1,
        'puncture did not update the damage version, or independently changed engine HP');
    }
  }
  for (const xShare of [0, .1, -.1, .5, -.5]) {
    const c = make(); api.bulletHitVehicle(c, round(c, xShare * c.spec.l));
    t.assert(flats(c).length === 0, 'engine/body/extreme end hit incorrectly punctured a tyre at ' + xShare);
  }
  for (const side of ['front', 'rear']) {
    const c = make(); api.bulletHitVehicle(c, round(c, 0, side));
    t.assert(flats(c).length === 0, 'longitudinal body face hit incorrectly punctured a tyre');
  }
  scatter = 0;
  let c = make(); api.bulletHitVehicle(c, round(c, .34 * c.spec.l));
  t.assert(flats(c).length === 0, 'high side body hit punctured a tyre');
  scatter = -3.5; chance = .8;
  c = make(); api.bulletHitVehicle(c, round(c, .34 * c.spec.l));
  t.assert(flats(c).length === 0, 'existing puncture probability was ignored');
  chance = .4;
  for (const length of [12, 25, 40]) {
    const c = make('bike', 0, 0, length); api.bulletHitVehicle(c, round(c, .34 * c.spec.l));
    t.assert(flats(c).join(',') === 'frontRight', 'motorcycle collision window did not scale with length ' + length);
  }
  for (const type of ['sedan', 'truck']) for (const end of ['front', 'rear']) {
    const c = make(type, 0, 0, type === 'sedan' ? 40 : 80), x = (end === 'front' ? .3 : -.31) * c.spec.l;
    api.bulletHitVehicle(c, round(c, x));
    t.assert(flats(c).join(',') === end + 'Right', type + ': existing tyre rule changed');
  }
  scatter = 2;
  c = make('sedan', 0, 0, 40); const surface = api.bulletHitVehicle(c, round(c, 0));
  t.assert(surface === 'glass' && flats(c).length === 0 && c.damage.glassHits.right === 1, 'existing glass branch changed');
  const handling = (type, flags, pull = 0) => {
    const c = make(type); c.damage.pull = pull;
    for (const key of flags) c.damage.tires[key] = true;
    return api.vehicleHandling(c);
  };
  const intactBike = handling('bike', []), intactCar = handling('sedan', []);
  t.assert(JSON.stringify(intactBike) === JSON.stringify(intactCar), 'intact motorcycle handling changed');
  for (const end of ['front', 'rear']) {
    const left = handling('bike', [end + 'Left']), right = handling('bike', [end + 'Right']),
      both = handling('bike', [end + 'Left', end + 'Right']);
    t.assert(JSON.stringify(left) === JSON.stringify(right) && JSON.stringify(left) === JSON.stringify(both),
      'one motorcycle tyre is counted differently by the side struck: ' + end);
    t.assert(left.top === .89 && left.grip === .88 && left.pull === 0 && left.steer === .96 && left.brake === .88,
      'single motorcycle puncture did not retain the existing one-flat penalties');
  }
  const both = handling('bike', ['frontLeft', 'rearRight']), allFaces = handling('bike', ['frontLeft', 'frontRight', 'rearLeft', 'rearRight']);
  t.assert(JSON.stringify(both) === JSON.stringify(allFaces) && both.top === .78 && both.grip === .76 && both.brake === .76 && both.pull === 0,
    'two motorcycle tyres were counted as four');
  t.assert(handling('bike', ['frontRight'], .37).pull === .37, 'motorcycle puncture erased the existing crash pull');
  const carLeft = handling('sedan', ['frontLeft']), carRight = handling('sedan', ['frontRight']),
    carBoth = handling('sedan', ['frontLeft', 'frontRight']);
  t.assert(carLeft.pull === -.22 && carRight.pull === .22 && carBoth.top === .78 && carBoth.pull === 0,
    'four-wheel vehicle flat count or directional pull changed');
  t.note('actual side-entry rays: 3 headings × 2 elevations × 2 sides × 2 axles; engine/end/high/probability misses and car/truck/glass rules pass');
}
