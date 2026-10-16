// A car that overlaps a walker must permit an outward step, while ordinary vehicle and building contact still blocks.
import fs from 'node:fs';
import vm from 'node:vm';

export const fresh = true;

export default async function (t) {
  const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    shapes = read('physics-shapes'), vehicles = [], buildings = [], player = { x: 0, y: 0 },
    scope = vm.createContext({ vehicles, buildings, player, gameTime: 1, CITY_SIZE: 20000,
      UNITS_PER_METRE: 8, GRAVITY: 9.81 * 8, KMH: 8 / 3.6, KNOTS: 8 * .514444, LINERS: [], groundAt: () => true,
      PAINT_SPORT: [], PAINT_LUXURY: [], PAINT_EVERYDAY: [],
      isAircraft: c => !!c.aircraft, aircraftClearance: c => c.clearance || 0,
      ...Object.fromEntries(['sportsBlocked', 'railBlocked', 'parkPondBlocked', 'airportSceneryBlocked',
        'garageBlocked', 'parkBlocked', 'monarchBlocked', 'northPointKeyBlocked', 'marinaBlocked',
        'beachBlocked', 'promenadeRailBlocked', 'streetEndBlocked', 'beachClubBlocked', 'harborBlocked',
        'depotBlocked', 'countyBlocked', 'militaryBlocked', 'shoreStepBlocked', 'footObstacleBlocked',
        'drawbridgeFootBlocked'].map(name => [name, () => false])) }),
    api = vm.runInContext(read('game-vehicles') + shapes.slice(shapes.indexOf('    function pointInCar('), shapes.indexOf('    function safeLanding(')) +
      read('game-collision') + '\n({ moveBody, pointInCar, spec: vehicleSpec });', scope),
    car = { type: 'sedan', x: 0, y: 0, a: 0 }, radius = 8,
    spec = api.spec(car), hx = spec.l / 2 + radius, hy = spec.w / 2 + radius;
  vehicles.push(car);
  const world = (x, y) => ({ x: Math.cos(car.a) * x - Math.sin(car.a) * y, y: Math.sin(car.a) * x + Math.cos(car.a) * y });
  let escapes = 0;
  // Exercise the production broadphase, rotated box test, axis-separated short steps and static collision.
  // Sub-frame steps matter: the old test could escape only when one step happened to clear the whole overlap.
  for (const body of [player, { x: 0, y: 0 }]) {
    for (let angle = 0; angle < 8; angle++) {
      car.a = angle * Math.PI / 4;
      for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        for (const depth of [0.25, 2, 6]) {
          Object.assign(body, world(nx * (hx - depth), ny * (hy - depth)));
          const start = { ...body }, step = world(nx * .15, ny * .15);
          t.assert(api.pointInCar(body.x, body.y, car, radius), 'fixture must start overlapping');
          for (let i = 0; i < 120; i++) api.moveBody(body, step.x, step.y, radius);
          t.assert(!api.pointInCar(body.x, body.y, car, radius), `cannot leave vehicle: ${JSON.stringify({ angle, nx, ny, depth, start, body })}`);
          t.assert(Math.hypot(body.x - start.x, body.y - start.y) > 10, 'outward movement stuck after contact');
          escapes++;
        }
      }
    }
  }
  car.a = 0;
  Object.assign(player, { x: 0, y: hy - 4 });
  api.moveBody(player, 0, -12, radius);
  t.near(player.y, hy - 4 - 1e-6, hy - 4 + 1e-6, 'existing contact cannot deepen into the vehicle');
  for (let i = 0; i < 300; i++) api.moveBody(player, .15, 0, radius);
  t.assert(player.x > hx && !api.pointInCar(player.x, player.y, car, radius), 'a walker cannot slide along the side and away from the car');
  for (let angle = 0; angle < 8; angle++) {
    car.a = angle * Math.PI / 4;
    Object.assign(player, world(0, hy + 1));
    const toward = world(0, -70);
    api.moveBody(player, toward.x, toward.y, radius);
    const localY = -player.x * Math.sin(car.a) + player.y * Math.cos(car.a);
    t.assert(localY >= hy - 1e-6, 'walking into a parked car crossed its padded body');
  }
  car.a = 0;
  Object.assign(player, { x: 0, y: hy - 4 });
  buildings.push({ x: -100, y: hy + 6, w: 200, h: 12 });
  api.moveBody(player, 0, 40, radius);
  t.assert(player.y <= hy - 2, 'escaping vehicle contact walked through a building');
  buildings.length = 0;
  const second = { type: 'sedan', x: 0, y: hy * 2 + 1, a: 0 };
  vehicles.push(second);
  Object.assign(player, { x: 0, y: hy - 4 });
  api.moveBody(player, 0, 60, radius);
  t.assert(player.y <= hy + 1, 'escaping one vehicle entered the adjacent vehicle');
  t.note(`${escapes} outward escapes across both actor types, 8 headings, 4 faces, 4 corners and 3 penetration depths; inward, tangential, static and second-car contact checked`);

  // Real simulation input from the same bad contact state, rather than a test-only movement implementation.
  await t.call('holdSimulation', true);
  await t.call('god', true);
  try {
    await t.call('footwork', null);
    await t.call('teleport', 790, 640);
    await t.call('witnessStage', 0, false, 1600, false, false, true);
    const id = await t.call('park', 'sedan', 170, 0, 0), parked = await t.call('damageReport', id);
    await t.call('teleport', parked.x, parked.y + hy - 6);
    const before = await t.call('status');
    await t.keys('KeyS', .6);
    const after = await t.call('status');
    t.assert(after.y - before.y > 18, `movement keys still stick beside the car: ${JSON.stringify({ before, after })}`);
    await t.call('teleport', parked.x, parked.y + hy + 2);
    await t.keys('KeyW', 1);
    const stopped = await t.call('status');
    t.assert(stopped.y >= parked.y + hy - 1, 'normal input walked through the parked sedan');
  } finally {
    await t.call('god', false);
    await t.call('holdSimulation', false);
  }
}
