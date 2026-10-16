// Production input/pitch kernels: independent rider shifts, grip-limited brakes and stable pitch/roll across timesteps.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');

// Actual packed/procedural model animation must leave the rear axle at its starting height and position.
export function assertWheelieRearAxle(t, animate, c, model) {
  const rear = model.wheels.find(w => !w.front).wheel,
    oldRotation = model.body.rotation.clone(), oldPosition = model.body.position.clone(),
    oldSlopeRoll = c.slopeRoll, oldSlopePitch = c.slopePitch;
  for (const [bank, basePitch, slopeRoll, slopePitch] of [[0, 0, 0, 0], [.28, 0, 0, 0], [-.28, .18, 0, 0], [.13, -.22, 0, 0], [.15, .2, .12, -.18]]) {
    c.slopeRoll = slopeRoll; c.slopePitch = slopePitch;
    model.body.position.set(0, 0, 0);
    model.body.rotation.set(bank + slopeRoll, 0, basePitch + slopePitch);
    model.group.updateMatrixWorld(true);
    const center = rear.getWorldPosition(new Three.Vector3());
    for (const pitch of [.2, .6, 1.1, 0]) {
      model.body.rotation.set(bank, 0, basePitch);
      c.wheelie = pitch; animate(c, model, 0);
      // Match render3d-frame: terrain alignment follows bikeUpdate, then riders copy it.
      model.body.rotation.x += slopeRoll;
      model.body.rotation.z += slopePitch;
      model.group.updateMatrixWorld(true);
      const actual = rear.getWorldPosition(new Three.Vector3());
      t.assert(actual.distanceTo(center) < 1e-8, c.type + ': rear tyre axle sinks or slides during wheelie: ' + JSON.stringify({ pitch, bank, basePitch, slopeRoll, slopePitch, center: center.toArray(), actual: actual.toArray(), axle: rear.position.toArray(), rearAxleX: model.rearAxleX, rotation: model.body.rotation.toArray() }));
    }
  }
  c.wheelie = 0; c.slopeRoll = oldSlopeRoll; c.slopePitch = oldSlopePitch;
  model.body.rotation.copy(oldRotation); model.body.position.copy(oldPosition);
}

export default async function (t) {
  const keys = {}, player = { car: { type: 'bike' } }, spec = { bike: true, cornerG: 1.35 },
    surface = { wet: 1, tyre: 1 }, GRAVITY = 9.81 * 8,
    scope = vm.createContext({ keys, player, GRAVITY, UNITS_PER_METRE: 8, KMH: 8 / 3.6, gameTime: 10, physicsClock: 0,
      localStorage: { getItem: () => null }, SETTING_ROWS: {}, isAircraft: c => c?.type === 'plane', isBoat: () => false,
      clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), wetGrip: () => surface.wet,
      tyreSurfaceGrip: () => surface.tyre, riderAboard: () => false, vehicleSpec: () => spec }),
    driving = read('physics-driving'), inputAt = driving.indexOf('          const rearBrake ='),
    input = driving.slice(inputAt, driving.indexOf('          // A bicycle', inputAt)),
    api = vm.runInContext(read('controls') + read('wheelie') + read('driving') + `
      function driveInput(vehicleDefinition, c = player.car) { ${input} return { up: !!up, down: !!down }; }
      ({ step: wheelieStep, pressControlKey, holdActions, releaseControlKey, wheelieHeld, wheelieLowerHeld, driveInput,
        balance: motorcycleBalanceStep, frontContact: wheelieFrontContact, brakeStep, brakesOff, tyreState, drivingCharacter });`, scope),
    press = code => api.holdActions(api.pressControlKey(code)),
    release = () => { for (const code of ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'KeyG', 'Space']) api.releaseControlKey(code); };
  press('ArrowUp');
  t.assert(api.wheelieHeld() && !api.driveInput(spec).up, 'Up should shift rider weight without accelerating');
  press('KeyW');
  t.assert(api.wheelieHeld() && api.driveInput(spec).up, 'W + Up must drive while shifting back');
  press('ArrowDown');
  t.assert(api.wheelieLowerHeld() && !api.wheelieHeld(), 'opposed shifts should resolve forward');
  t.assert(api.driveInput(spec).up && !api.driveInput(spec).down, 'forward weight shift must not cut W or apply brakes');
  t.assert(api.driveInput({ bike: false }).up, 'rider shift changed car throttle');
  release();
  press('KeyS');
  const bike = () => ({ type: 'bike', hp: 100, wheelie: Math.PI / 6, wheelieRate: .4, wheelieLean: 1, av: 0, vx: 60, vy: 0 });
  const run = (rate, seconds, acceleration = -12 * 8, initial = bike()) => {
    player.car = initial;
    for (let i = 0; i < Math.round(rate * seconds); i++) {
      api.step(initial, spec, true, acceleration, 60, 1 / rate);
      scope.gameTime += 1 / rate;
    }
    return initial;
  };
  const lower = [30, 60, 120].map(rate => run(rate, .4));
  t.assert(lower.every(c => c.wheelie < 15 * Math.PI / 180 && c.wheelieRate < -1), 'rear brake did not lower an already rising front');
  t.assert(lower.every(c => Math.abs(c.wheelie - lower[0].wheelie) < 1e-9), 'pitch response changed between 30/60/120 Hz');
  const dry = api.step(bike(), spec, true, -12 * 8, 60, 1 / 120);
  surface.wet = .72;
  const wet = api.step(bike(), spec, true, -12 * 8, 60, 1 / 120);
  const banked = bike(); banked.av = .8;
  const corner = api.step(banked, spec, true, -12 * 8, 60, 1 / 120);
  t.assert(dry < wet && wet < corner && corner < 0, 'rear brake grip ignores rain or cornering demand');
  t.near(dry / 8, -.551 * 9.81, -.549 * 9.81, 'dry rear brake cap (m/s²)');
  t.assert(api.step(bike(), spec, true, 6 * 8, 60, 1 / 120) <= 0, 'real brake retained positive drive torque');
  release(); press('KeyW'); press('ArrowDown');
  t.assert(api.step(bike(), spec, true, 6 * 8, 60, 1 / 120) >= 0, 'weight shift unexpectedly applied the rear brake');
  surface.wet = 1;
  release();
  const saved = bike(); saved.wheelie = .95;
  player.car = saved;
  press('KeyW'); press('Space');
  t.assert(!api.driveInput(spec).up && api.driveInput(spec).down, 'W + Space retained drive torque with the front airborne');
  run(120, .6, -12 * 8, saved);
  t.assert(saved.wheelie < .7 && saved.wheelieRate < 0, 'rear brake cannot recover a wheelie above its balance point');
  player.car = { type: 'bike', wheelie: 0 };
  t.assert(api.driveInput(spec).up, 'grounded W + Space behavior changed');
  release();

  // Stationary/reverse inputs cannot manufacture pitch or a body shift.
  for (const along of [0, -20, 2 * 8 / 3.6]) {
    release(); press('ArrowUp');
    const c = bike(); c.wheelie = c.wheelieRate = c.wheelieLean = 0;
    for (let i = 0; i < 240; i++) api.step(c, spec, true, 0, along, 1 / 120);
    t.assert(c.wheelie === 0 && c.wheelieLean === 0, 'non-rolling rider inputs moved the motorcycle');
  }
  // An available engine can sustain a useful long wheelie; the rider assist
  // never exceeds the supplied force and cannot create power on a coast.
  release(); press('KeyW'); press('ArrowUp');
  const holds = [30, 60, 120].map(rate => {
    const c = bike(); c.wheelie = c.wheelieRate = c.wheelieLean = 0;
    let distance = 0;
    for (let i = 0; i < rate * 16; i++) {
      const delivered = api.step(c, spec, true, 9 * 8, 100, 1 / rate);
      t.assert(delivered <= 9 * 8 + 1e-9 && delivered >= 0, 'wheelie assist manufactured drive force');
      if (c.wheelie > .08) distance += 100 / 8 / rate;
    }
    t.assert(c.wheelie > .40 && c.wheelie < .55 && distance > 190, 'sustainable wheelie balance failed');
    return c;
  });
  t.assert(holds.every(c => Math.abs(c.wheelie - holds[0].wheelie) < 1e-9), 'held wheelie differs between timesteps');
  release();
  for (const rate of [30, 60, 120]) {
    const c = bike(); c.bikeRoll = c.bikeRollRate = 0;
    const first = api.balance(c, .45, 100, 1 / rate);
    t.assert(first > 0 && first < .15, 'motorcycle turned instantly before rolling');
    for (let i = 1; i < rate * 2; i++) api.balance(c, .45, 100, 1 / rate);
    t.near(c.bikeRoll, .50, .53, 'physical corner bank ' + rate);
    t.near(api.balance(c, .45, 100, 1 / rate), .44, .46, 'bank and yaw balance ' + rate);
    for (let i = 0; i < rate * 2; i++) api.balance(c, 0, 100, 1 / rate);
    t.assert(Math.abs(c.bikeRoll) < .001, 'motorcycle did not stand up after steering release');
    t.finite(c, 'corner balance ' + rate);
  }
  // Neither control can create chassis rotation/drive without a tyre contact.
  for (const shift of ['ArrowUp', 'ArrowDown']) {
    release(); press('KeyW'); press(shift);
    const c = bike(); c.wheelie = .25; c.wheelieRate = 0; c.rideAir = true;
    for (let i = 0; i < 120; i++) {
      t.assert(api.step(c, spec, true, 9 * 8, 100, 1 / 120) === 0, 'airborne throttle/brake generated contact force');
      api.balance(c, .45, 100, 1 / 120);
    }
    t.assert(c.wheelie === .25 && c.bikeRoll === 0, 'airborne rider input generated rotation');
  }
  const airborne = bike(); airborne.rideAir = true; airborne.bikeRoll = .2; airborne.bikeRollRate = .3;
  api.balance(airborne, -.45, 100, 1 / 120);
  t.assert(airborne.bikeRoll > .2 && airborne.bikeRollRate > .29, 'airborne roll momentum snapped or reversed with input');
  release();

  // Exercise actual load transfer, bias, slip and ABS: an airborne front has no force or lock telemetry.
  const brakes = (frontContact, grip = 1, lateralUse = 0, explicit = true) => {
    const c = bike(), tyres = api.tyreState(c), character = api.drivingCharacter(c);
    scope.physicsClock = 0;
    let decel = 0;
    for (let i = 0; i < 120; i++) {
      scope.physicsClock += 1 / 120;
      decel = explicit
        ? api.brakeStep(c, tyres, character, true, .8, 1.1 * grip, 1 - grip, lateralUse, 80, 1 / 120, frontContact, .55 * grip)
        : api.brakeStep(c, tyres, character, true, .8, 1.1 * grip, 1 - grip, lateralUse, 80, 1 / 120);
      if (frontContact === 0) t.assert(tyres.lock[0] === 0 && tyres.slip[0] === 0 && tyres.lateral[0] === 0, 'airborne front tyre still contributes brake/side force or lock');
    }
    return { decel, tyres: JSON.stringify(tyres) };
  };
  const rearDry = brakes(0), rearWet = brakes(0, .72), rearCorner = brakes(0, .72, .65);
  t.assert(rearDry.decel <= .55 * GRAVITY + 1e-7 && rearDry.decel > rearWet.decel && rearWet.decel > rearCorner.decel, 'actual rear brake load/bias exceeds contact grip');
  t.assert(JSON.stringify(brakes(1)) === JSON.stringify(brakes(1, 1, 0, false)), 'grounded braking differs with the new optional contact arguments');
  const released = api.tyreState(bike());
  api.brakesOff(released, 0);
  t.assert(released.lateral[0] === 0 && released.lateral[1] === 1, 'airborne front regained road grip after releasing its brake');
  t.assert(api.frontContact({ wheelie: 0 }) === 1 && api.frontContact({ wheelie: .04 }) === 0 && api.frontContact({ wheelie: .02 }) > 0 && api.frontContact({ wheelie: .02 }) < 1, 'front contact does not blend between grounded and lifted');
  for (const rate of [30, 60, 120]) {
    const c = bike(); c.wheelie = .5; c.wheelieRate = -2; c.wheelieLean = 0;
    run(rate, 2, 0, c);
    t.assert(Math.abs(c.wheelie) < .001 && Math.abs(c.wheelieRate) < .01, 'fork landing did not settle at ' + rate + ' Hz');
    t.finite(c, 'landing ' + rate);
  }
  // Both bicycle carriers use their real axle height, including the scaled bike-share frame.
  const cycle = read('cycles3d'),
    cycleScope = vm.createContext({ Three }),
    bicycleWheelie = vm.runInContext(cycle.slice(cycle.indexOf('      function bicycleWheelie('), cycle.indexOf('      /* The dock rack')) + '\nbicycleWheelie;', cycleScope);
  for (const shared of [false, true]) {
    const group = new Three.Group(), body = new Three.Group(), holder = shared ? new Three.Group() : body,
      wheel = new Three.Group();
    group.add(body);
    if (shared) { body.add(holder); holder.scale.setScalar(.4); holder.position.set(.5, .2, 0); }
    holder.add(wheel); wheel.position.set(-10, 5.5, 0);
    const model = { group, body, wheels: [{ wheel }] };
    assertWheelieRearAxle(t, bicycleWheelie, { type: shared ? 'share' : 'bicycle', hp: 100 }, model);
  }
  t.note(`rising 30° front lowered to ${(lower[0].wheelie * 180 / Math.PI).toFixed(2)}° in .4s at 30/60/120 Hz; dry/wet/corner rear brake ${(dry / 8).toFixed(2)}/${(wet / 8).toFixed(2)}/${(corner / 8).toFixed(2)} m/s²`);
}
