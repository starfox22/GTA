// The actual shutter controller must see a vehicle spanning its safety strip, including edge-only overlaps.
import fs from 'node:fs';
import vm from 'node:vm';

export default async function(t) {
  const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    shapes = read('physics-shapes'), chase = read('chase'), police = read('citylife-police'),
    vehicles = [], player = { x: 0, y: 0, car: null }, officers = [],
    scope = vm.createContext({
      Math, vehicles, player, officers, wantedStars: 0, UNITS_PER_METRE: 8, GRAVITY: 9.81 * 8, KMH: 8 / 3.6,
      KNOTS: 8 * .514444, LINERS: [], PAINT_SPORT: [], PAINT_LUXURY: [], PAINT_EVERYDAY: [],
      isAircraft: c => c.type === 'helicopter' || c.type === 'plane',
      clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    }),
    api = vm.runInContext(read('game-vehicles') + shapes.slice(0, shapes.indexOf('    function addStatic(')) +
      police.slice(police.indexOf('    function lawVehicle('), police.indexOf('    function recentGangThreat(')) +
      chase.slice(0, chase.indexOf("    // Vinny's crew")) +
      '\n({ inDepotDoorway, updateDepotDoors, setDepotDoors, resetDepotDoors, corners, vehicleShape, ' +
      'shutter: () => depotFrontShutter });', scope);

  // The safety strip is y4318..4350: the 9.5m truck spans it, but neither
  // bumper is in it. A corner-only test falsely said this doorway was clear.
  const truck = { type: 'flatbed', x: -1664, y: 4334, a: Math.PI / 2, vx: 0, vy: 0 };
  const points = api.corners(api.vehicleShape(truck));
  t.assert(points.every(p => p.y < 4316 || p.y > 4352), 'long-truck fixture has a corner in the safety strip');
  t.assert(api.inDepotDoorway(truck), 'shutter cannot see the middle of a straddling truck');
  vehicles.push(truck);
  api.setDepotDoors(1, 1);
  for (let i = 0; i < 240; i++) api.updateDepotDoors(1 / 60);
  t.assert(api.shutter() === 0, 'shutter descended through the truck body');

  // The same overlap may be ahead of a reversing vehicle. The existing 0.6s
  // prediction must retain it, and a nearby vehicle off the strip must not hold it.
  truck.y = 4400;
  truck.vy = -110;
  t.assert(api.inDepotDoorway(truck), 'reversing truck not detected before reaching the shutter');
  truck.vy = 0;
  t.assert(!api.inDepotDoorway(truck), 'clear truck inside the warehouse holds the shutter');
  for (let i = 0; i < 240; i++) api.updateDepotDoors(1 / 60);
  t.assert(api.shutter() === 1, 'shutter did not close after the truck cleared');

  // Independent polygon/rectangle overlap oracle, rather than another use of
  // boxContact: corners inside either polygon or crossing edges count as occupied.
  const left = -1724, right = -1604, top = 4316, bottom = 4352,
    cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
    segmentCross = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0,
    rect = [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  let comparisons = 0;
  for (const type of ['flatbed', 'bus', 'sedan', 'ambulance']) {
    for (let angle = 0; angle < 24; angle++) {
      for (const x of [-1750.3, -1720.3, -1690.3, -1664.3, -1635.3, -1605.3, -1575.3]) {
        for (const y of [4280.3, 4305.3, 4334.3, 4360.3, 4385.3]) {
          const car = { type, x, y, a: angle * Math.PI / 12, vx: 0, vy: 0 },
            shape = api.vehicleShape(car), raw = api.corners(shape), polygon = [raw[0], raw[1], raw[3], raw[2]],
            pointInVehicle = p => {
              const dx = p.x - car.x, dy = p.y - car.y, ca = Math.cos(car.a), sa = Math.sin(car.a);
              return Math.abs(dx * ca + dy * sa) < shape.hx && Math.abs(-dx * sa + dy * ca) < shape.hy;
            },
            expected = polygon.some(p => p.x > left && p.x < right && p.y > top && p.y < bottom) ||
              rect.some(pointInVehicle) || polygon.some((a, i) => rect.some((c, j) => segmentCross(a, polygon[(i + 1) % 4], c, rect[(j + 1) % 4])));
          t.assert(api.inDepotDoorway(car) === expected, `door footprint mismatch: ${JSON.stringify(car)}`);
          comparisons++;
        }
      }
    }
  }

  // An arriving police unit retains the existing push-back rule; the player
  // on foot still keeps the shutter up, and an aircraft does not block it.
  api.resetDepotDoors();
  Object.assign(truck, { x: -1664, y: 4334, vx: 20, vy: 10, missionPursuit: true });
  api.setDepotDoors(1, 1);
  api.updateDepotDoors(1 / 60);
  t.assert(api.shutter() > 0 && truck.vy <= -40 && truck.vx === 10, 'pursuing police no longer yield to the shutter');
  t.assert(!api.inDepotDoorway({ ...truck, type: 'helicopter' }), 'aircraft blocks the ground shutter');
  vehicles.length = 0;
  Object.assign(player, { x: -1664, y: 4334 });
  api.resetDepotDoors();
  api.setDepotDoors(1, 1);
  for (let i = 0; i < 120; i++) api.updateDepotDoors(1 / 60);
  t.assert(api.shutter() === 0, 'shutter descended on a player on foot');

  // Ordinary wanted dispatch and SWAT join the scripted four cargo patrols.
  // Previously only missionPursuit units yielded: a normal cruiser held the
  // shutter open indefinitely, so the delivered truck could never be sealed in.
  Object.assign(player, { x: 0, y: 0 });
  scope.wantedStars = 3;
  for (const [type, lawUnit] of [['police', undefined], ['van', 'swat']]) {
    const unit = { type, lawUnit, hp: 100, cop: true, x: -1664, y: 4334, a: Math.PI / 2, vx: 20, vy: 10 };
    vehicles.push(unit);
    api.resetDepotDoors();
    api.setDepotDoors(1, 1);
    for (let i = 0; i < 240; i++) api.updateDepotDoors(1 / 60);
    t.assert(api.shutter() === 1 && unit.vy <= -40, `ordinary ${lawUnit || type} pursuit stalled the depot drop`);
    vehicles.length = 0;
  }
  // Wrecks, crewless/stolen cruisers and an idle patrol remain physical
  // obstacles. A mission-tagged cruiser the player boards gets the same safety.
  for (const extra of [{ hp: 0 }, { crewLost: true }, { stolen: true }, { idle: true }, { driven: true, missionPursuit: true }]) {
    const unit = { type: 'police', hp: 100, cop: true, x: -1664, y: 4334, a: Math.PI / 2, vx: 0, vy: 0, ...extra };
    scope.wantedStars = unit.idle ? 0 : 3;
    player.car = unit.driven ? unit : null;
    vehicles.push(unit);
    api.resetDepotDoors();
    api.setDepotDoors(1, 1);
    for (let i = 0; i < 120; i++) api.updateDepotDoors(1 / 60);
    t.assert(api.shutter() === 0, 'shutter closed on an ordinary obstacle: ' + JSON.stringify(extra));
    vehicles.length = 0;
  }
  t.note(`${comparisons} independent vehicle/door polygon comparisons; long-body, prediction, clear, both dispatch paths, aircraft, pedestrian and inactive/player vehicle safety`);
}
