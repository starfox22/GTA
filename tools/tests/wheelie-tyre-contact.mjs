// Production tyre logic and both renderer consumers: a lifted front cannot leave rubber, spray, dust, mud or a joined airborne track.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
const section = (text, from, to) => {
  const start = text.indexOf(from), end = text.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'missing production section: ' + from);
  return text.slice(start, end);
};

export default async function wheelieTyreContactTest(t) {
  const KMH = 8 / 3.6, bikeSpec = { bike: true, l: 20, w: 5 }, carSpec = { l: 36, w: 15 },
    state = { ground: 'asphalt' }, puffs = [], drops = [], clumps = [], sprays = [], dust = [], tracks = [],
    tint = { copy() { return this; }, lerp() { return this; }, multiplyScalar() { return this; } },
    scope = vm.createContext({
      KMH, UNITS_PER_METRE: 8, GRAVITY: 9.81 * 8, CITY_SIZE: 4000, gameTime: 10, physicsClock: 10,
      player: { car: null }, weather: { wet: 0 }, skids: [],
      clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
      vehicleSpec: c => c.spec || (c.type === 'sedan' ? carSpec : bikeSpec),
      drivingCharacter: c => ({ drive: c.drive || 'rwd' }),
      isAircraft: () => false, isBoat: () => false, footSurfaceAt: () => state.ground,
      runwayUnder: () => false, landAt: () => false, onRoad: () => false, onCountyRoad: () => false,
      terrainHeight: () => 0, worldMeters: n => n / 8,
      tyreAxlePuffs: (c, spec, forward, count, kind) => puffs.push({ forward, count, kind }),
      entityElevation: () => 0, chaseSpriteHidden: () => false, mudRandom: () => .1,
      mudTierNow: { drops: 1, spray: 1, clods: 1 }, mudShade: tint, clumpColor: tint,
      MUD_DRY: tint, MUD_WET: tint, DUST: tint, FORD_SPRAY: tint, FORD_MIST: tint,
      tyreTracks: {}, OFFROAD_BODIES: {},
      mudDrop: (...args) => drops.push(args), spawnClump: (...args) => clumps.push(args),
      spawnSpray: (...args) => sprays.push(args), mudPuff: (...args) => dust.push(args),
      addGroundDecal: (...args) => tracks.push(args),
    }), smoke = read('tyresmoke3d'), mud = read('offroad3d-mud'),
    api = vm.runInContext(read('wheelie') + read('tyre-effects') +
      section(smoke, '      function vehicleTyreSmoke(', '      function updateTyreSmoke(') +
      section(mud, '      function contactWheels(', '      // Wading a ford') +
      section(mud, '      function fordSpray(', '      // Throw mud') +
      section(mud, '      function vehicleSpray(', '      function updateMudParticles(') + `
      ({ contact: wheelieFrontContact, marks: layTyreMarks, emission: tyreEmission,
         totals: tyreEffectsReport, step: tyreEffectsStep, city: vehicleTyreSmoke,
         ford: fordSpray, trail: vehicleSpray, wheels: contactWheels });`, scope),
    makeBike = (pitch = 0, extra = {}) => ({ type: 'bike', hp: 100, x: 1000, y: 1000, a: 0, vx: 60 * KMH, vy: 0, speed: 60 * KMH, wheelie: pitch, ...extra }),
    model = () => ({ wheels: [false, true].map(front => ({ wheel: {
      position: { x: 0, y: 0, z: 0 }, // The nested steering rig is deliberately not the body-space axle.
      userData: { bikeContact: { x: front ? 6 : -6, z: 0, front, r: 2, width: 1.4 } },
    } })) }),
    near = (value, expected, label) => t.assert(Math.abs(value - expected) < 1e-9, label + ': ' + value + ' != ' + expected),
    clearVisuals = () => { for (const list of [puffs, drops, clumps, sprays, dust, tracks]) list.length = 0; },
    emission = c => ({ ...api.emission(c) }); // Production uses a shared scratch result.

  near(api.contact(makeBike(-.04)), 1, 'fork compression remains grounded');
  near(api.contact(makeBike(0)), 1, 'ground contact');
  near(api.contact(makeBike(.0225)), .5, 'half-contact fade');
  near(api.contact(makeBike(.04)), 0, 'front clears ground');
  near(api.contact(makeBike(.8)), 0, 'high wheelie contact');
  let previous = 1;
  for (let angle = 0; angle < .041; angle += .001) {
    const contact = api.contact(makeBike(angle));
    t.assert(contact <= previous && previous - contact < .05, 'front contact snaps during takeoff/touchdown');
    previous = contact;
  }

  const marks = (c, locks, extra = {}) => {
    scope.skids.length = 0; scope.physicsClock += .1;
    api.marks(c, scope.vehicleSpec(c), { lock: locks, spin: 0 }, { along: c.vx, lateral: 0, brakeDecel: 1, ...extra });
    return [...scope.skids];
  };
  t.assert(marks(makeBike(.8), [1, 0]).length === 0, 'an airborne front-only lock laid ghost rubber at the rear');
  t.assert(marks(makeBike(.8, { skid: 1 }), [0, 0], { brakeDecel: 0 }).length === 0, 'airborne front scrub laid rubber');
  let rubber = marks(makeBike(.8), [0, 1]);
  t.assert(rubber.length === 1 && rubber[0].x < 1000, 'the grounded rear lock lost its rubber');
  near(rubber[0].dark, 1, 'rear-lock darkness');
  rubber = marks(makeBike(.0225), [1, 0]);
  t.assert(rubber.length === 1 && rubber[0].x > 1000, 'partial front contact was painted under the rear tyre');
  near(rubber[0].dark, .5, 'front rubber fades with contact');
  rubber = marks(makeBike(.039), [1, 0]);
  t.assert(rubber[0].dark < .01, 'nearly lifted rubber hit the old minimum darkness');
  rubber = marks(makeBike(0), [1, 0]);
  t.assert(rubber.length === 1 && rubber[0].x < 1000, 'ordinary grounded bike rubber changed');
  const car = makeBike(.8, { type: 'sedan' });
  rubber = marks(car, [1, 0]);
  t.assert(rubber.length === 2 && rubber.every(mark => mark.x > car.x), 'ordinary car mark count changed');
  t.assert(rubber.every(mark => mark.dark === 1), 'ordinary car rubber appearance changed');
  for (const state of ['rideAir', 'cliffAir', 'deckAir', 'overturned', 'fallen']) {
    const airborne = makeBike(.4, { [state]: true, skid: 1, wheelSpin: 1, fordDepth: 2 });
    t.assert(marks(airborne, [1, 1], { lateral: 100, handbrake: true }).length === 0,
      state + ': tyres without ground contact painted rubber');
    t.assert(emission(airborne).kind === null, state + ': tyres without ground contact emitted road effects');
  }

  // The authoritative output supplies the same smooth front weight for wet roads,
  // fords and offroad ground. Totals count one rear plus the weighted front on bikes.
  for (const kind of ['spray', 'ford', 'offroad']) {
    state.ground = kind === 'offroad' ? 'dirt' : 'asphalt';
    scope.weather.wet = kind === 'spray' ? 1 : 0;
    for (const [pitch, wheelCount] of [[0, 2], [.0225, 1.5], [.8, 1]]) {
      const c = makeBike(pitch, kind === 'ford' ? { fordDepth: 2 } : kind === 'offroad' ? { offroadState: { paved: false } } : {}),
        e = emission(c);
      t.assert(e.kind === kind && e.axle === 'all' && e.rate > 0, 'fixture did not reach ' + kind + ': ' + JSON.stringify(e));
      near(e.frontContact, wheelCount - 1, kind + ' front contact');
      scope.player.car = c; api.totals(true); api.step(c, 1);
      near(api.totals().totals[kind === 'spray' ? 'spray' : 'dust'], Math.round(e.rate * wheelCount * 10) / 10, kind + ' bike wheel count');
    }
    const c = makeBike(.8, { type: 'sedan', ...(kind === 'ford' ? { fordDepth: 2 } : kind === 'offroad' ? { offroadState: { paved: false } } : {}) }), e = emission(c);
    scope.player.car = c; api.totals(true); api.step(c, 1);
    near(e.frontContact, 1, kind + ' ignores pitch on cars');
    near(api.totals().totals[kind === 'spray' ? 'spray' : 'dust'], Math.round(e.rate * 4 * 10) / 10, kind + ' car wheel count');
  }
  // A bicycle's ford contacts follow the same two-wheel rule.
  const bicycle = makeBike(.8, { spec: { ...bikeSpec, bicycle: true }, fordDepth: 2 });
  near(emission(bicycle).frontContact, 0, 'bicycle lifted front');

  state.ground = 'asphalt'; scope.weather.wet = 1;
  const cityRun = (pitch, extra = {}) => {
    clearVisuals();
    const c = makeBike(pitch, extra), m = {}, before = JSON.stringify(c);
    for (let i = 0; i < 40; i++) api.city(c, m, .05, 420, 1);
    t.assert(JSON.stringify(c) === before, 'city tyre renderer changed game state');
    return { front: puffs.filter(p => p.forward > 0).reduce((n, p) => n + p.count, 0), rear: puffs.filter(p => p.forward < 0).reduce((n, p) => n + p.count, 0), m, c };
  };
  const grounded = cityRun(0), partial = cityRun(.0225), airborne = cityRun(.8);
  t.assert(grounded.front > 10 && grounded.front === grounded.rear, 'grounded city bike emission changed');
  t.assert(airborne.front === 0 && airborne.rear === grounded.rear, 'wet airborne front sprayed or rear spray stopped');
  t.assert(Math.abs(partial.front * 2 - grounded.front) <= 1 && partial.rear === grounded.rear, 'city front spray does not fade independently');
  const m = { tyreSmokeFrontDue: .99, tyreSmokeDue: 0 }, c = makeBike(.8);
  clearVisuals(); api.city(c, m, .001, 420, 1);
  near(m.tyreSmokeFrontDue, 0, 'airborne front emission debt clears');
  c.wheelie = 0; api.city(c, m, .001, 420, 1);
  t.assert(!puffs.some(p => p.forward > 0), 'city touchdown released a stored front spray burst');
  const carGround = cityRun(0, { type: 'sedan' }), carPitched = cityRun(.8, { type: 'sedan' });
  t.assert(carGround.front === carPitched.front && carGround.rear === carPitched.rear, 'car city emission changed');

  const fordRun = pitch => {
    clearVisuals();
    const c = makeBike(pitch, { fordDepth: 2 }), m = model(), before = JSON.stringify(c);
    for (let i = 0; i < 20; i++) api.ford(c, m, emission(c), .05);
    t.assert(JSON.stringify(c) === before, 'ford renderer changed game state');
    return { front: drops.filter(p => p[0] > c.x).length, rear: drops.filter(p => p[0] < c.x).length };
  };
  const fordGround = fordRun(0), fordPartial = fordRun(.0225), fordAir = fordRun(.8);
  t.assert(fordGround.front > 10 && fordGround.front === fordGround.rear, 'grounded ford fixture did not emit both contacts');
  t.assert(fordAir.front === 0 && fordAir.rear === fordGround.rear, 'ford front sprayed in the air or rear spray stopped');
  t.assert(Math.abs(fordPartial.front * 2 - fordGround.front) <= 1 && fordPartial.rear === fordGround.rear, 'ford front spray does not fade');

  scope.weather.wet = 0; state.ground = 'dirt';
  const trailRun = (pitch, mud) => {
    clearVisuals();
    const c = makeBike(pitch, { surfaceMud: mud, offroadState: { paved: false } }), m = model(), before = JSON.stringify(c);
    for (let i = 0; i < 20; i++) api.trail(c, m, .05);
    t.assert(JSON.stringify(c) === before, 'trail renderer changed game state');
    const thrown = mud > .1 ? clumps : dust;
    return { front: thrown.filter(p => p[0] > c.x).length, rear: thrown.filter(p => p[0] < c.x).length };
  };
  for (const mud of [0, .8]) {
    const full = trailRun(0, mud), half = trailRun(.0225, mud), air = trailRun(.8, mud);
    t.assert(full.front > 0 && full.rear > 0, 'grounded trail fixture emitted nothing');
    t.assert(air.front === 0 && air.rear === full.rear, (mud ? 'mud' : 'dust') + ' airborne front emitted or rear stopped');
    t.assert(Math.abs(half.front * 2 - full.front) <= 1 && half.rear === full.rear, (mud ? 'mud' : 'dust') + ' front emission does not fade');
  }

  // An actual cached contact list must forget both its emission debt and its last
  // ground print while lifted, then establish a fresh print at touchdown.
  clearVisuals();
  const trailBike = makeBike(0, { surfaceMud: .8, offroadState: { paved: false } }), trailModel = model(),
    wheels = api.wheels(trailBike, trailModel), front = wheels.find(w => w.front), rear = wheels.find(w => !w.front);
  api.trail(trailBike, trailModel, .01);
  trailBike.x += 14; api.trail(trailBike, trailModel, .01);
  t.assert(tracks.length === 2, 'grounded trail bike did not leave two contact tracks');
  front.emit = .99; trailBike.wheelie = .8; trailBike.x += 14;
  tracks.length = 0; api.trail(trailBike, trailModel, .01);
  t.assert(tracks.length === 1 && Number.isNaN(front.lastX) && Number.isNaN(front.lastY) && front.emit === 0 && Number.isFinite(rear.lastX), 'lifted track continued or kept its previous front anchor');
  trailBike.wheelie = .0225; trailBike.x += 14;
  tracks.length = 0; api.trail(trailBike, trailModel, .01);
  t.assert(tracks.length === 1 && front.lastX === trailBike.x + 6, 'landing bridged back to the old airborne front track');
  trailBike.x += 14; tracks.length = 0; api.trail(trailBike, trailModel, .01);
  t.assert(tracks.length === 2, 'front contact did not resume a new track after landing');
  near(tracks.find(track => track[1] > trailBike.x - 7)[5], 1.4 * .95 * .5, 'partial front track narrows smoothly');
  // The ford consumer must retire the same cached ground-print anchor as the mud consumer.
  trailBike.wheelie = .8; trailBike.fordDepth = 2; front.emit = .99;
  api.ford(trailBike, trailModel, emission(trailBike), .01);
  t.assert(front.emit === 0 && Number.isNaN(front.lastX) && Number.isNaN(front.lastY), 'ford retained an airborne front track or emission debt');
  t.note('production marks/contact/stats; wet/ford/dry dust/mud consumers; smooth front fade; grounded rear; car baseline; fresh touchdown track; renderer state read only');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let checks = 0;
  await wheelieTyreContactTest({ assert(value, message) { checks++; assert.ok(value, message); }, note: console.log });
  console.log('PASS wheelie-tyre-contact: ' + checks + ' host assertions');
}
