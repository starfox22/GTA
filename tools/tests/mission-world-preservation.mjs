// Production job setup/cleanup must keep ambient damage and owned cars; ambulance recovery never cuts in view.
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
export default async function (t) {
  const ambient = [
    { faction: 'harbor', hp: 0, x: 3140, y: 1500, home: { x: 3100, y: 1400 }, deadTime: 17, wound: 'torso' },
    { faction: 'harbor', hp: 21, x: 3230, y: 1470, home: { x: 3120, y: 1440 }, knockedFor: 3, lastShotAt: 14 },
    { faction: 'glass', hp: 19, x: 100, y: 100, home: { x: 100, y: 110 } },
  ];
  const before = JSON.stringify(ambient);
  const harbor = vm.createContext({
    gangMembers: ambient, HARBOR: { crates: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] },
    clearHarborPolice() {}, resetDepotDoors() {}, inHarbor: () => true,
    setStage() {}, wantedStars: 0, player: { car: null }, vehicles: [], officers: [], bullets: [],
  });
  vm.runInContext(read('harbor-cargo-job'), harbor);
  harbor.spawnVinnyTruck = () => ({ hp: 460, maxhp: 460 });
  const job = {};
  harbor.startHarborJob(job);
  t.assert(JSON.stringify(ambient) === before, 'taking the cargo job revived/moved/healed ambient Harbor Kings');
  t.assert(job.car.mission && job.car.hp === 620 && job.packages.length === 3, 'cargo job no longer creates its own truck/crates');
  harbor.startHarborJob({});
  t.assert(JSON.stringify(ambient) === before, 'retrying the cargo job changed ambient gang damage/position');
  const terminal = read('harbor-terminal'), holdAt = terminal.indexOf('    function harborPoliceHold(');
  vm.runInContext(terminal.slice(holdAt, terminal.indexOf('    function truckClearedHarborExit(', holdAt)), harbor);
  const existingCop = { type: 'police', hp: 40, x: 3150, y: 1500 },
    existingOfficer = { car: existingCop, x: 3152, y: 1500, hp: 23 },
    firedRound = { owner: existingOfficer };
  harbor.vehicles.push(existingCop);
  harbor.officers.push(existingOfficer);
  harbor.bullets.push(firedRound);
  const live = { index: 0 };
  harbor.wantedStars = 3;
  harbor.startHarborJob(live, true);
  harbor.mission = live;
  t.assert(harbor.vehicles.includes(existingCop) && harbor.officers.includes(existingOfficer), 'live payphone call removed existing harbor police');
  t.assert(harbor.bullets.includes(firedRound), 'live payphone call deleted an existing officer round');
  t.assert(live.harborLivePursuit && !harbor.harborPoliceHold(), 'incoming chase turned into a harbor safe zone');
  harbor.wantedStars = 0;
  const cleanCall = { index: 0 };
  harbor.startHarborJob(cleanCall, true);
  harbor.mission = cleanCall;
  t.assert(harbor.vehicles.includes(existingCop), 'a clean live call removed existing ambient police');
  t.assert(!cleanCall.harborLivePursuit && harbor.harborPoliceHold(), 'clean introductory job lost its dispatch hold');

  const ordinary = { id: 1, x: -1664, y: 4460, hp: 17, ai: false },
    owned = { id: 2, x: -1660, y: 4460, hp: 12, owned: 1, depotDelivered: true },
    delivered = { id: 3, x: -1664, y: 4450, depotDelivered: true },
    running = { id: 4, x: -1664, y: 4460, mission: true },
    driven = { id: 5, x: -1664, y: 4460, depotDelivered: true },
    aircraft = { id: 6, x: -1664, y: 4460, mission: true, type: 'helicopter' },
    outside = { id: 7, x: 2000, y: 2000, depotDelivered: true };
  const retainedCrew = { car: ordinary }, removedCrew = { car: delivered };
  const depot = vm.createContext({
    vehicles: [ordinary, owned, delivered, running, driven, aircraft, outside],
    officers: [retainedCrew, removedCrew], player: { car: driven },
    isAircraft: c => c.type === 'helicopter', insideDepot: (x, y) => x < 0 && y > 4300,
  });
  const chase = read('chase'), start = chase.indexOf('    function clearDepotFloor(');
  vm.runInContext(chase.slice(start, chase.indexOf('    function depotOverlap(', start)), depot);
  depot.clearDepotFloor();
  for (const c of [ordinary, owned, driven, aircraft, outside])
    t.assert(depot.vehicles.includes(c), `depot cleanup deleted retained vehicle ${c.id}`);
  t.assert(!depot.vehicles.includes(delivered) && !depot.vehicles.includes(running), 'depot cleanup kept its delivered/job-owned cars');
  t.assert(depot.officers.includes(retainedCrew) && !depot.officers.includes(removedCrew), 'depot cleanup removed ambient crew or retained deleted-car crew');
  t.assert(ordinary.hp === 17 && owned.hp === 12, 'depot cleanup healed retained vehicles');
  const gate = vm.createContext({
    wantedStars: 5, clears: 0,
    clearPolice() { gate.clears++; gate.wantedStars = 0; },
    announce() {}, tell() {}, radio() {},
  });
  const gateStart = chase.indexOf('    function notifyCargoPolice(');
  vm.runInContext(chase.slice(gateStart, chase.indexOf('    function dispatchCargoPolice(', gateStart)), gate);
  const inherited = { harborLivePursuit: true };
  gate.notifyCargoPolice(inherited);
  t.assert(gate.clears === 0 && gate.wantedStars === 5, 'gate camera erased an incoming five-star chase');
  t.assert(inherited.policeNotified && inherited.airDelay === 5, 'inherited chase skipped cargo dispatch');
  const callsBeforeRepeat = gate.clears;
  gate.notifyCargoPolice(inherited);
  t.assert(gate.clears === callsBeforeRepeat, 'repeated cargo notification dispatched again');
  gate.clears = 0;
  gate.wantedStars = 5;
  gate.notifyCargoPolice({ harborLivePursuit: false });
  t.assert(gate.clears === 1, 'clean cargo dispatch changed its police setup');

  // A cruiser just outside the closed front shutter can have an otherwise
  // clear door spot inside. Deployment must respect the room boundary too.
  const police = read('citylife-police'), deployAt = police.indexOf('    function deployOfficers('),
    deployment = police.slice(deployAt, police.indexOf('    function footStepTowards(', deployAt));
  for (const [sealed, inside, unit] of [[true, false, 'patrol'], [true, true, 'patrol'], [false, false, 'patrol'], [true, false, 'swat']]) {
    const cruiser = { x: -1664, y: inside ? 4360 : 4328, a: 0, hp: 100, lawUnit: unit, crewSize: 2 },
      officers = [];
    const deploymentContext = vm.createContext({
      Math, gameTime: 8, wantedStars: 3, depotSealed: sealed,
      VINNY_DEPOT: { x: -1804, y: 4340, w: 280, h: 240 },
      vehicles: [cruiser], officers, harborPoliceProtected: () => false,
      solid: () => false, pointInCar: () => false, entityElevation: () => 0, terrainHeight: () => 0,
      makeOfficer: (x, y, a, kind, opts) => ({ x, y, a, kind, ...opts }),
      swatDeploySpots: () => [{ x: -1664, y: 4355 }, { x: -1664, y: 4298 }],
      equipSwatOperator() {}, radio() {}, policeChallengeLine: () => 'test',
    });
    const roomAt = chase.indexOf('    function insideDepot('),
      blockedAt = chase.indexOf('    function depotPoliceBlocked(');
    vm.runInContext(chase.slice(roomAt, chase.indexOf('    function depotBlocked(', roomAt)), deploymentContext);
    vm.runInContext(chase.slice(blockedAt, chase.indexOf('    /* Whether the sealed', blockedAt)), deploymentContext);
    vm.runInContext(deployment, deploymentContext);
    deploymentContext.deployOfficers(cruiser);
    if (sealed) {
      t.assert(officers.length > 0, `sealed depot stopped all legitimate ${inside ? 'inside' : 'street'} crew deployment`);
      t.assert(officers.every(o => deploymentContext.insideDepot(o.x, o.y, -10) === inside), `sealed depot ${unit} crew appeared across the shutter`);
    } else {
      t.assert(officers.length === 2 && officers.some(o => deploymentContext.insideDepot(o.x, o.y)), 'open depot prevented ordinary doorway ingress');
    }
  }

  // The ambient hotel limos may be replenished only into a free bay. A new
  // rooftop job must not replace an ordinary or owned car the player left there.
  for (const [hidden, owned] of [[true, false], [true, true], [false, true]]) {
    const parked = { id: 8, type: 'sedan', x: -1704, y: 2644, ai: false, hp: 20, owned },
      cars = [parked];
    const entrance = vm.createContext({
      Math, ROOFTOP: { door: { x: -1664, y: 2622 }, y: 2250, h: 350 },
      vehicles: cars, player: { car: null }, crowdInView: () => false,
      isAircraft: () => false,
      canSpawnCar: (type, x, y) => !cars.some(c => Math.hypot(c.x - x, c.y - y) < 60),
      makeCar: (type, x, y, a, ai, color) => { const c = { type, x, y, a, ai, color }; cars.push(c); return c; },
    });
    vm.runInContext(read('roofmission-entrance'), entrance);
    entrance.parkBlueHourLimousines(hidden);
    t.assert(cars.includes(parked) && parked.hp === 20, `hotel bay replaced ${owned ? 'owned' : 'ordinary'} car during ${hidden ? 'job start' : 'initial dressing'}`);
    t.assert(!cars.some(c => c !== parked && Math.hypot(c.x - parked.x, c.y - parked.y) < 60), 'replacement limousine overlaps a retained car');
  }

  const terrace = vm.createContext({
    Math, ROOFTOP: { x: -1844, y: 2250, w: 360, h: 350, height: 240 },
    vehicles: [], enemies: [], storyActors: [], player: { car: null },
    actor: (name, x, y, color, altitude) => ({ name, x, y, color, altitude, hp: 100 }),
    headingBetween: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
    distanceBetween: (a, b) => Math.hypot(b.x - a.x, b.y - a.y),
    parkBlueHourLimousines() {}, setStage() {}, keyName: () => 'E',
  });
  vm.runInContext(read('roofmission-layout'), terrace);
  vm.runInContext(read('roofmission-scene'), terrace);
  terrace.startRooftopHit({});
  for (const guard of terrace.enemies.filter(e => e.guard))
    for (const [i, point] of guard.patrolRoute.entries()) {
      t.assert(terrace.roofPointFree(point.x, point.y, 8), `${guard.name} patrol goal ${i} overlaps rooftop cover`);
      const next = guard.patrolRoute[(i + 1) % guard.patrolRoute.length];
      t.assert(terrace.roofRoute(point, next).length > 0, `${guard.name} patrol leg ${i} cannot route around rooftop cover`);
    }

  const poison = read('roofmission-poison'), ambulanceStart = poison.indexOf('    function updateRoofAmbulance(');
  for (const [suspicion, expected] of [[60, 84], [89, 90], [95, 95]]) {
    const job = { boss: { hp: 84 }, suspicion, disguise: true, weaponDrawn: false, poisonUsed: false },
      observer = {};
    const context = vm.createContext({
      gameMode: 'play', player: { roof: true }, ROOF_HIT: { drink: {} },
      rooftopJob: () => job, distanceBetween: () => 0, roofSight: () => true,
      poisonWitness: () => observer, guardLine() {}, tell() {},
    });
    vm.runInContext(poison, context);
    context.poisonDrink();
    t.assert(job.suspicion === expected, `watched glass changed suspicion ${suspicion} to ${job.suspicion}, expected ${expected}`);
    t.assert(!job.poisonUsed && !job.poisoned, 'watched glass was poisoned despite the refusal');
  }
  const update = poison.slice(ambulanceStart, poison.indexOf('    /* The paramedics', ambulanceStart));
  for (const visibility of ['ambulance', 'stop', 'neither']) {
    const car = { id: 1, x: -1500, y: 2661, a: Math.PI, hp: 100, vx: 0, vy: 0, speed: 0, ai: true },
      med = { ambulance: car, ambulanceAt: 0, checkedAt: 0, stuckFor: 6, medics: [] };
    const context = vm.createContext({
      Math, gameTime: 8, vehicles: [car], sirenBus: {}, storyActors: [],
      ROOF_AMBULANCE: { stop: { x: -1618, y: 2661 } },
      crowdInView: x => visibility === 'ambulance' ? x === -1500 : visibility === 'stop' ? x === -1618 : false,
      canSpawnCar: () => true, playSample() {}, entityElevation: () => 0,
      actor: (name, x, y, color) => ({ name, x, y, color, hp: 100 }),
    });
    vm.runInContext(update, context);
    context.updateRoofAmbulance({ medical: med });
    if (visibility === 'neither') {
      t.assert(car.x === -1618 && med.parked === 8 && !car.ai, 'hidden ambulance recovery stopped working');
      t.assert(med.medics.length === 2, 'hidden ambulance recovery did not deploy medics');
    } else {
      t.assert(car.x === -1500 && !med.parked && car.ai, `stuck ambulance cut into view while ${visibility} was visible`);
      t.assert(med.medics.length === 0, 'visible stuck ambulance deployed crew before parking');
    }
  }
  t.note('ambient Harbor Kings/live pursuit persist, depot/hotel keep ordinary/owned vehicles, sealed deployment and rooftop patrol routes remain valid');
}
