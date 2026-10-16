// Production rider release, solver, pose and root matrices: signed spills,
// protective limbs and a continuous supported recovery, without a browser.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');

export default async function (t) {
  const noop = () => {}, player = { x: 0, y: 0, a: 0, altitude: 0, hp: 100, car: null },
    scope = vm.createContext({ Three, player, UNITS_PER_METRE: 8, PERSON_HEIGHT: 14, GRAVITY: 9.81 * 8, KMH: 8 / 3.6, TAU: 2 * Math.PI,
      gameTime: 0, shake: 0, pedestrians: [], vehicles: [], DRIVER_COLORS: ['#777777'],
      clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), normalizeAngle: a => Math.atan2(Math.sin(a), Math.cos(a)),
      randomBetween: (lo, hi) => (lo + hi) / 2, randomChoice: list => list[0],
      entityElevation: p => p.altitude || 0, terrainHeight: () => 0, wetGrip: () => 1,
      vehicleSpec: () => ({ bike: true, l: 16.8, w: 5.6 }), solid: () => false, footObstacleBlocked: () => false,
      playSample: noop, tell: noop, noise: noop, scream: noop, crashInjury: () => 0,
      hitFlinch: () => 0, personFallAmount: () => 0, worldMeters: n => n / 8,
      crowdEuler: new Three.Euler(), mLocal: new Three.Matrix4(), mIdentity: new Three.Matrix4(),
      mRoot: new Three.Matrix4(), mHips: new Three.Matrix4(), mTorso: new Three.Matrix4(), mHead: new Three.Matrix4(), mFoot: new Three.Matrix4(),
      mShoulder: [new Three.Matrix4(), new Three.Matrix4()], mElbow: [new Three.Matrix4(), new Three.Matrix4()],
      mHand: [new Three.Matrix4(), new Three.Matrix4()], mHip: [new Three.Matrix4(), new Three.Matrix4()], mKnee: [new Three.Matrix4(), new Three.Matrix4()],
      crowdScale: new Three.Vector3(),
    }),
    rig = read('character-rig3d'), bodies = read('crowd3d-bodies'), draw = read('crowd3d-draw'),
    rootStart = draw.indexOf('        const thrown ='), rootEnd = draw.indexOf('        rigRimFlag =', rootStart),
    contactStart = draw.indexOf('      function riderPoseLowestPoint('), contactEnd = draw.indexOf('\n      /**', contactStart),
    api = vm.runInContext(read('falls-body') + read('riders') +
      rig.slice(rig.indexOf('      const RIG ='), rig.indexOf('      /* ---- Materials')) +
      bodies.slice(bodies.indexOf('      function crowdJoint('), bodies.indexOf('      function crowdEmit(')) +
      read('crowd3d-joints') + read('crowd3d-poses') + draw.slice(contactStart, contactEnd) + `
      function rootFor(p, state, R, J) {
        const spec = { thrown: state }, H = R.height * RIG_UNIT, elevation = entityElevation(p),
          hipY = RIG.hip + J[J_DROP], lean = J[J_LEAN], roll = J[J_ROLL],
          armSwing = J_SH.map(i => J[i]), elbows = J_EL.map(i => J[i]), abduct = J_AB.map(i => J[i]),
          legHip = J_HIP.map(i => J[i]), legKnee = J_KNEE.map(i => J[i]);
        ${draw.slice(rootStart, rootEnd)}
        return mRoot.clone();
      }
      ({ launch: throwRider, step: stepThrownBody, stepRiderEjection, crowdPoseTargets, rootFor, crowdJoint, RIG,
         J_COUNT, J_SH, J_AB, J_EL, J_HIP, J_KNEE, J_SPREAD, J_HEAD_YAW, J_HEAD_PITCH, J_FALL });`, scope);
  const renderLook = height => ({ height: height / 1.75, width: 1, shoulderZ: 1.56, hipZ: 0.7 }),
    seed = { seed: 2.3, umbrella: false }, observations = [];
  const pose = state => {
    const J = new Float32Array(api.J_COUNT);
    api.crowdPoseTargets(player, seed, J, 10, { pose: 'thrown', thrown: state });
    return J;
  };
  function release(cause, side = 1, speed = 45) {
    Object.assign(player, { x: 0, y: 0, a: 0, hp: 100, altitude: 0 });
    const c = { type: 'bike', x: 0, y: 0, a: 0, hp: 100, vx: speed * 8 / 3.6, vy: 0, av: side,
      bikeRoll: side * 0.28, wheelie: cause === 'loopout' ? 1.25 : 0 };
    player.car = c;
    const state = api.launch(c, c.vx, c.vy, cause);
    return { state, c };
  }
  // The rider and bike leave the same physical bank; a loopout retains the
  // raised chassis' backwards orientation before wheelie state is released.
  for (const cause of ['lowside', 'loopout', 'crash', 'landing']) for (const side of [-1, 1]) {
    const { state, c } = release(cause, side);
    t.assert(state.bank === side * 0.28 && c.fallen.roll === state.bank && c.fallen.side === side,
      cause + ': release changed sides or started the bike upright');
    t.assert(c.wheelie === 0 && player.car === null && state.riderFall, cause + ': rider carrier was not released');
    if (cause === 'loopout') t.assert(state.pitch === -1.25 && state.spin < 0, 'loopout lost the pre-release rearwards pitch');
    else t.assert(Math.abs(player.x) < 0.25 * 8, cause + ': rider teleported from the saddle to the bars');
    const J = pose(state);
    t.assert(J[api.J_EL[0]] > 1 && J[api.J_EL[1]] > 1, cause + ': unprotected straight arms in flight');
    t.assert(J[api.J_KNEE[0]] < -0.6 && J[api.J_KNEE[1]] < -0.6, cause + ': legs were not gathered');
  }
  let maxRecoveryStepM = 0, maxEndGapM = 0;
  for (const rate of [30, 60, 120]) for (const cause of ['lowside', 'loopout', 'crash', 'landing']) {
    const { state } = release(cause, cause === 'lowside' ? -1 : 1), dt = 1 / rate;
    let finished = false, downAt = null, oldDownTime = null, recovered = false, previousRoot = null;
    for (let frame = 0; frame < rate * 16; frame++) {
      finished = api.step(player, state, dt, amount => { player.hp -= amount; });
      if (state.phase === 'down' && downAt === null) { downAt = state.time; oldDownTime = state.downFor; }
      const J = pose(state);
      t.finite(J, cause + '/' + rate + ' joints');
      t.finite([state.z, state.pitch, state.bank, state.vx, state.vy], cause + '/' + rate + ' body');
      if (cause === 'lowside' && state.phase === 'slide') {
        t.assert(Math.abs(state.pitch) < 0.4 && state.bank < -1.1, 'lowside became a forward somersault');
      }
      if (state.phase === 'recover') {
        recovered = true;
        t.assert(player.hp > 0 && state.recovery >= 0 && state.recovery <= 1, 'invalid recovery state');
        for (const height of [1.6, 1.8, 1.9]) {
          const look = renderLook(height), root = api.rootFor(player, state, look, J), H = height * 8 / 14,
            hips = new Three.Matrix4();
          api.crowdJoint(hips, root, 0, api.RIG.hip, 0);
          // Independent lower-leg endpoints through production joint rotations:
          // a planted boot cannot fall beneath the road while the root rises.
          for (const side of [0, 1]) {
            const hip = new Three.Matrix4(), knee = new Three.Matrix4(), foot = new Three.Vector3();
            api.crowdJoint(hip, hips, 0, 0, (side ? 1 : -1) * look.hipZ, J[api.J_HIP[side]], -(side ? 1 : -1) * J[api.J_SPREAD]);
            api.crowdJoint(knee, hip, 0, -api.RIG.thigh, 0, J[api.J_KNEE[side]]);
            foot.set(0, -api.RIG.shin, 0).applyMatrix4(knee);
            t.assert(foot.y >= 0.55 * H - 0.001, cause + ': recovery boot passed through the road');
          }
          if (height === 1.8) {
            const hipPosition = new Three.Vector3().setFromMatrixPosition(hips);
            if (previousRoot) maxRecoveryStepM = Math.max(maxRecoveryStepM, hipPosition.distanceTo(previousRoot) / 8);
            previousRoot = hipPosition;
            if (finished) maxEndGapM = Math.max(maxEndGapM, Math.abs(hipPosition.y - api.RIG.hip * H) / 8);
          }
        }
      }
      if (finished) break;
    }
    t.assert(finished && recovered && player.hp > 0, cause + '/' + rate + ': fall did not finish through recovery');
    t.assert(state.time >= downAt + oldDownTime - dt && state.time <= downAt + oldDownTime + dt + 1e-8,
      cause + '/' + rate + ': recovery changed the existing injury/KO down-time budget');
    t.assert(Math.abs(state.pitch) < 0.001 && Math.abs(state.bank) < 0.001 && state.recovery === 1,
      cause + '/' + rate + ': discarded a still-rotated body on standing');
    if (rate === 120) observations.push({ cause, seconds: +state.time.toFixed(2), hp: +player.hp.toFixed(1), bank: state.bank });
  }
  t.assert(maxRecoveryStepM < 0.08, 'recovery moved the hips abruptly: ' + maxRecoveryStepM + ' m/frame at 30+ Hz');
  t.assert(maxEndGapM < 0.025, 'recovery ended away from the standing rig: ' + maxEndGapM + ' m');

  // KO waits the same long daze before a deliberate get-up. Pose freezes while
  // down: changing world idle time must not make an unconscious rider scan.
  const { state: ko } = release('lowside');
  ko.phase = 'down'; ko.z = 0; ko.pitch = ko.restPitch = 0.12; ko.bank = 1.42;
  ko.groundTime = 2; ko.downFor = 8; ko.recoverFor = 0.95; ko.knockedOut = true;
  api.step(player, ko, 6, noop);
  t.assert(ko.phase === 'down' && ko.downFor === 2, 'KO recovered before the existing wait');
  const still = pose(ko), later = new Float32Array(api.J_COUNT);
  api.crowdPoseTargets(player, seed, later, 83, { pose: 'thrown', thrown: ko });
  t.assert(still.every((value, i) => value === later[i]) && later[api.J_HEAD_YAW] === 0, 'resting rider retained idle scanning/sway');
  api.step(player, ko, 1.1, noop);
  t.assert(ko.phase === 'recover', 'KO did not enter recovery at the end of the daze');

  for (const cause of ['lowside', 'loopout', 'crash', 'landing']) {
    player.car = null;
    const c = { type: 'bike', x: 0, y: 0, a: 0, hp: 100, ai: true, occupied: true,
      vx: 45 * 8 / 3.6, vy: 0, av: -1, bikeRoll: -0.28, wheelie: cause === 'loopout' ? 1.25 : 0 },
      e = api.launch(c, c.vx, c.vy, cause), person = scope.pedestrians.at(-1);
    let recoverySeen = false;
    for (let i = 0; i < 120 * 16 && person.ejected; i++) {
      api.stepRiderEjection(person, e, 1 / 120);
      if (e.phase === 'recover') recoverySeen = true;
      if (person.ejected) t.assert(person.knockedFor > 0, cause + ': NPC became mobile before recovery');
    }
    t.assert(recoverySeen && person.hp > 0 && !person.ejected && person.flee === 6 && person.knockedFor === 0.01,
      cause + ': traffic rider did not finish the same recovery before fleeing');
  }

  const { state: slope } = release('lowside');
  scope.terrainHeight = x => x * 0.04;
  const worldHeight = player.altitude + slope.z, vz = slope.vz, dt = 0.01;
  api.step(player, slope, dt, noop);
  t.assert(Math.abs(player.altitude - scope.terrainHeight(player.x)) < 1e-8 &&
    Math.abs(player.altitude + slope.z - (worldHeight + (vz - 9.81 * 8 * dt) * dt)) < 1e-8,
    'sloped road moved the airborne rider instead of preserving world-height gravity');
  t.note(JSON.stringify({ observations, maxRecoveryStepM: +maxRecoveryStepM.toFixed(4), maxEndGapM: +maxEndGapM.toFixed(4) }));
}
