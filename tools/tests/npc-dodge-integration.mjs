// A dodge must cover the same fading-speed integral at visible and off-camera cadences.
// This host fixture executes production reaction movement and collision geometry; it is
// separate from the live-world pedestrian-awareness clearance-rate contract.
import fs from 'node:fs';
import vm from 'node:vm';

function dodgeHost(overrides) {
  const read = name => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  const fn = (file, name) => {
    const source = read(file), start = source.indexOf('    function ' + name + '(');
    if (start < 0) throw Error('Missing production function ' + name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
  };
  const noop = () => {}, empty = () => false;
  const context = vm.createContext({
    Math, Set, Map, UNITS_PER_METRE: 8, KMH: 8 / 3.6, KNOTS: 8 * 0.514444, GRAVITY: 8 * 9.81,
    hypot2: Math.hypot, worldMeters: value => value / 8, gameTime: 0, worldMinutes: 1040,
    player: { x: 0, y: 0 }, vehicles: [], pedestrians: [], buildings: [], CITY_SIZE: 10000, LINERS: [],
    // The fixture site is dry, level ground without site-specific obstacles. Walls below
    // use the actual solid/building-grid path; vehicle obstruction uses the production grid.
    groundAt: () => true, drawbridgeFootBlocked: empty,
    sportsBlocked: empty, railBlocked: empty, parkPondBlocked: empty, airportSceneryBlocked: empty,
    garageBlocked: empty, parkBlocked: empty, monarchBlocked: empty, northPointKeyBlocked: empty,
    marinaBlocked: empty, beachBlocked: empty, promenadeRailBlocked: empty, streetEndBlocked: empty,
    beachClubBlocked: empty, harborBlocked: empty, depotBlocked: empty, countyBlocked: empty,
    militaryBlocked: empty, isAircraft: empty, isBoat: empty, aircraftClearance: () => 0,
    sameFloor: () => true, personOnGround: p => (p.knockedFor || 0) > 0,
    // Post-contact effects are outside this movement/contact test. The actual knockPerson
    // still decides and records the hit; no stub decides clearance or moves the specimen.
    vehicleImpactState: () => ({ phase: 'flight', vehicleHit: true }),
    strikePerson: (p, damage) => { p.hp -= damage; },
    bloodOn: false, cash: 0, addCarStain: noop, crowdAlarm: noop, crime: noop,
    crowdSay: noop, scream: noop, leaveScene: noop, rejoinScene: noop,
  });
  const state = read('game-state');
  vm.runInContext(state.slice(state.indexOf('    const clamp ='), state.indexOf('    let viewportWidth')), context);
  const paint = state.indexOf('    const PAINT_EVERYDAY');
  vm.runInContext(state.slice(paint, state.indexOf(';', paint) + 1), context);
  const vehicles = read('game-vehicles');
  vm.runInContext(vehicles.slice(vehicles.indexOf('    const VEHICLE_DEFINITIONS'), vehicles.indexOf('    // Conservative vertical envelope')), context);
  vm.runInContext(['crowd-looks', 'crowd-perception', 'crowd-reactions'].map(read).join('\n'), context);
  // crowdAlarm is a director side effect, not part of collision acceptance; keep it bounded.
  vm.runInContext('crowdAlarm = () => {};', context);
  vm.runInContext(['faceToward', 'snapAxis'].map(name => fn('crowd-walking', name)).join('\n'), context);
  const collision = read('game-collision');
  vm.runInContext(collision.slice(collision.indexOf('    const VEHICLE_CELL'), collision.indexOf('    /* solid() for a foot step.')), context);
  vm.runInContext('const BUILDING_CELL = 256, buildingGrid = new Map(), noBuildings = [];\n' +
    ['buildBuildingGrid', 'buildingsNear', 'solid', 'footSolid', 'footStepBlocked', 'moveBody']
      .map(name => fn('game-collision', name)).join('\n'), context);
  vm.runInContext(fn('physics-shapes', 'pointInCar') + '\n' + fn('crowd-awareness', 'carNoticed') + '\n' +
    'const sweepProbe = {type:null,airframe:null,x:0,y:0,a:0};\n' +
    ['personIncapacitated', 'vehicleImpactDamage', 'knockPerson', 'sweptPersonContact']
      .map(name => fn('physics-knockdowns', name)).join('\n'), context);
  vm.runInContext('let touchVehicle = null, touchSpeed = 0, touchReach = 0, touchContacts = null;\n' +
    fn('physics-update', 'touchPerson'), context);
  const api = vm.runInContext(`({
    updateReaction, pointInCar, buildBuildingGrid,
    reset(extra = {}) {
      gameTime = 0; randomSeed = 4242;
      vehicles.splice(0); pedestrians.splice(0); buildings.splice(0); buildingGrid.clear();
      vehicleGridState.time = NaN; vehicleGridState.count = -1;
      const p = {x:0,y:0,a:0,hp:30,flee:0,walk:0,state:'idle'};
      dressPerson(p, 'casual');
      startReaction(p, 'dodge', .5, {x:-100,y:0}, null, {leap:0,then:'hurry',...extra});
      pedestrians.push(p);
      return p;
    },
    seed: () => randomSeed,
    contact(p, car, from) {
      touchVehicle = car; touchSpeed = Math.hypot(car.vx, car.vy);
      touchReach = vehicleSpec(car).l + 100; touchContacts = new Set();
      car.personSweepStart = from; touchPerson(p);
      return !!p.carHit;
    }
  })`, context);
  return { context, api };
}

export function checkNpcDodgeIntegration(t, overrides = {}) {
  const { context: c, api } = dodgeHost(overrides);
  const near = (actual, expected, message) => t.assert(Math.abs(actual - expected) < 1e-8,
    message + ': ' + actual + ' versus ' + expected);
  const configurations = [
    { name: 'default', speed: 55, duration: .42, reaction: .5 },
    { name: 'back', speed: 46, duration: .36, reaction: .5 },
    { name: 'calm', speed: 30, duration: .8, reaction: .95 },
  ];
  const steps = [1 / 60, 1 / 30, 4 / 30, .2, .6];
  for (const config of configurations) {
    let expectedSeed, expectedNerve;
    for (const dt of steps) {
      const angle = 1.1, p = api.reset({
        leap: angle, leapV: config.speed, leapFor: config.duration, calm: config.name === 'calm',
      });
      p.react.dur = config.reaction;
      let elapsed = 0;
      while (elapsed < config.reaction + dt) {
        elapsed += dt;
        c.gameTime = elapsed;
        if (p.react) api.updateReaction(p, dt);
        // Integral of v(t)=V+10−V*t/T, stopped at the existing leap duration.
        const time = Math.min(elapsed, config.duration),
          distance = (config.speed + 10) * time - config.speed * time * time / (2 * config.duration);
        near(p.x, Math.cos(angle) * distance, config.name + ' x at ' + elapsed);
        near(p.y, Math.sin(angle) * distance, config.name + ' y at ' + elapsed);
      }
      if (expectedSeed === undefined) {
        expectedSeed = api.seed(); expectedNerve = p.nerve;
      }
      t.assert(api.seed() === expectedSeed && p.nerve === expectedNerve,
        config.name + ': cadence changed the seeded traits or reaction RNG');
    }
  }

  let collisionCases = 0;
  for (const dt of [...steps, 2]) {
    for (const kind of ['thin-wall', 'vehicle', 'escape-vehicle']) {
      const p = api.reset({ leap: kind === 'escape-vehicle' ? Math.PI : 0 });
      if (kind === 'thin-wall') {
        c.buildings.push({ x: 10, y: -100, w: .25, h: 200 });
        api.buildBuildingGrid();
      } else c.vehicles.push({ type: 'sedan', x: 26, y: 0, a: 0, hp: 100, vx: 0, vy: 0 });
      if (kind === 'escape-vehicle') p.x = 3;
      let elapsed = 0;
      while (elapsed < .7) {
        elapsed += dt; c.gameTime = elapsed;
        if (p.react) api.updateReaction(p, dt);
      }
      if (kind === 'thin-wall') t.assert(p.x <= 5, 'dodge crossed a thin wall at dt=' + dt);
      else if (kind === 'vehicle') t.assert(!api.pointInCar(p.x, p.y, c.vehicles[0], 5), 'dodge entered a vehicle at dt=' + dt);
      else t.assert(p.x < 0 && !api.pointInCar(p.x, p.y, c.vehicles[0], 5), 'existing penetration trapped a dodge at dt=' + dt);
      collisionCases++;
    }
    // Ordinary car contact happens before that frame's later person movement.
    // A coarse dodge must not erase a hit already found by the production sweep.
    const p = api.reset(), car = { type: 'sedan', x: 40, y: 0, a: 0, hp: 100, vx: 80 * 8 / 3.6, vy: 0 };
    c.vehicles.push(car);
    t.assert(api.contact(p, car, { x: -40, y: 0, a: 0 }), 'lost swept vehicle contact at dt=' + dt);
    collisionCases++;
  }
  t.note('Default/back/calm fading-speed trajectories are cadence independent; ' + collisionCases +
    ' production wall/vehicle/escape/swept-contact controls. Coarse actor cadence and the original awareness-rate contract are separate.');
}

export default function (t) { checkNpcDodgeIntegration(t); }
