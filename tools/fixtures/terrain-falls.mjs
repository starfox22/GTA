// CPU-only production terrain/driving/suspension/falls fixture. Generated scenery, other actors and static contacts
// are omitted; terrain polygons, grading, tyre/brake/steering forces and the 120 Hz vehicle step are production code.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function terrainFallsFixture({ sourceRoot = ROOT, terrainCache, sourceOverrides = {} } = {}) {
  const read = name => sourceOverrides[name] ?? fs.readFileSync(path.join(sourceRoot, 'src', name + '.js'), 'utf8');
  const scope = {
    Math, performance, UNITS_PER_METRE: 8, METERS_PER_UNIT: 1 / 8, KMH: 8 / 3.6, KNOTS: 8 * 0.514444,
    GRAVITY: 9.81 * 8, BLOCK_SIZE: 512, STREET: 112, STOREY: 25.6, SHOP_FLOOR: 36, TAU: Math.PI * 2,
    FLIGHT: { pickup: { x: 8570, y: 3462 } }, player: {}, weather: { wet: 0 },
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)), lerp: (a, b, t) => a + (b - a) * t,
    normalizeAngle: a => Math.atan2(Math.sin(a), Math.cos(a)),
    smoothStep: (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); },
    PAINT_EVERYDAY: [], PAINT_LUXURY: [], PAINT_SPORT: [], ENGINE_OF_TYPE: {},
    SETTING_ROWS: {}, CITY_SIZE: 5632, nextVehicleId: 0, vehicles: [], physicsClock: 0, gameTime: 0,
    shake: 0, fallSeq: 0, gameMode: 'play', keys: {}, repairJob: null,
    isAircraft: c => c.type === 'plane' || c.type === 'helicopter', isBoat: () => false,
    wetGrip: () => 1, onRoad: () => false, hypot2: Math.hypot,
    distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y), seededRandom: () => 0.4,
    randomBetween: (a, b) => (a + b) / 2, worldMeters: n => n / 8,
    addConsoleMethods: () => {}, actionCode: id => ({ forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' })[id],
    offroadSummit: () => {}, burnoutStep: () => false, layTyreMarks: () => {}, tyreEffectsStep: () => {},
    wheelieHeld: () => false,
    damageVehicle: (c, damage) => { c.hp -= damage; }, playerImpact: () => {}, playSample: () => {},
    kickCamera: () => {}, tell: () => {}, keyName: s => s,
  };
  scope.actionHeld = id => !!scope.keys[scope.actionCode(id)];
  scope.fallDropMetres = speed => speed * speed / (2 * scope.GRAVITY) / 8;
  const context = vm.createContext(scope);
  for (const name of ['game-vehicles', 'geography-regions', 'geography-land', 'county-map', 'transit-rails',
    'terrain-roads', 'terrain-grading', 'terrain-noise', 'terrain-field', 'terrain-suspension', 'terrain-scenery',
    'offroad-trails', 'falls-vehicles', 'driving', 'damage-vehicles', 'game-car-spawn', 'wheelie', 'physics-driving', 'falls-console'])
    vm.runInContext(read(name), context, { filename: name });
  scope.groundAt = (x, y) => context.landAt(x, y);
  vm.runInContext('buildScenicRoads();', context);
  if (terrainCache) {
    scope.terrainCache = terrainCache;
    vm.runInContext('Object.assign(TERRAIN_FIELDS[0],terrainCache.field); for(let i=0;i<MOUNTAIN_TRAILS.length;i++)Object.assign(MOUNTAIN_TRAILS[i],terrainCache.trails[i]);', context);
  } else vm.runInContext('terrainField(TERRAIN_FIELDS[0]);', context);
  let currentTrace;
  scope.update = seconds => {
    for (let i = 0; i < Math.round(seconds * 120); i++) {
      const c = scope.player.car;
      context.controlVehicle(c, c, 1 / 120, true);
      context.terrainVehiclePose(c, 1 / 120);
      context.cliffSettle(c, 1 / 120);
      scope.physicsClock += 1 / 120; scope.gameTime += 1 / 120;
      if (c.cliffAir && !currentTrace.firstFlight) currentTrace.firstFlight = {
        seconds: scope.gameTime, x: c.x, y: c.y, speedKmh: c.speed / scope.KMH,
        pitch: c.cliffAir.pitch, roll: c.cliffAir.roll, pitchRate: c.cliffAir.vp, rollRate: c.cliffAir.vr,
      };
      if (c.overturned && !currentTrace.firstOverturn) currentTrace.firstOverturn = { seconds: scope.gameTime, x: c.x, y: c.y, roll: c.overturned.roll };
    }
  };
  function reset(id = 0) {
    scope.nextVehicleId = id; scope.keys = {}; scope.gameTime = scope.physicsClock = 0;
    scope.gameMode = 'play'; currentTrace = {};
  }
  function drive({ id = 0, type = 'suv', maxKmh = 28, seconds = 30, road = false } = {}) {
    reset(id);
    scope.driveArgs = { type, maxKmh, seconds, road };
    const result = vm.runInContext(`(() => {
      const path = driveArgs.road ? steepestMountainRoad().path : MOUNTAIN_TRAILS[0].path.slice().reverse(), start = path[4], next = path[12];
      const c = makeCar(driveArgs.type,start[0],start[1],Math.atan2(next[1]-start[1],next[0]-start[0]),false); player.car = c;
      const spec=vehicleSpec(c), since=fallSeq, run=drivePath(path,driveArgs.seconds,driveArgs.maxKmh);
      return { id:c.id, type:c.type, dimensions:[spec.l,spec.w,spec.height], run, position:[c.x,c.y],
        hp:c.hp, maxhp:c.maxhp, overturned:!!c.overturned, landings:cliffLog.filter(l=>l.seq>since) };
    })()`, context);
    return { ...result, ...currentTrace };
  }
  function cliff({ type = 'sedan', heightM = 60 } = {}) {
    reset(); scope.cliffArgs = { type, heightM };
    const result = vm.runInContext(`(() => {
      const c=makeCar(cliffArgs.type,1000,1000,0,false);player.car=c;c.vx=35*KMH;c.vy=0;c.fallZ=cliffArgs.heightM*UNITS_PER_METRE;c.fallVz=0;
      startCliffFlight(c,0);let time=0;while(c.cliffAir&&time<8){update(1/120);time+=1/120;}
      return {hp:c.hp,maxhp:c.maxhp,overturned:!!c.overturned,airborne:!!c.cliffAir,position:[c.x,c.y]};
    })()`, context);
    return { ...result, ...currentTrace };
  }
  return { scope, context, drive, cliff, terrainCache: vm.runInContext('({field:TERRAIN_FIELDS[0],trails:MOUNTAIN_TRAILS})', context) };
}
