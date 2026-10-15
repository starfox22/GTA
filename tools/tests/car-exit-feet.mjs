// Actual exit targets/IK and shipped player-mesh skinning: shoes stay on the
// rendered ground while the hips duck, without changing other transition poses.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { load, poseFrames, skinner } from './player-body.mjs';

export default async function(t) {
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'), body = load(Three),
    read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    player = { x: 418, y: 5973, a: 0, hp: 100, altitude: 0 },
    look = { height: 1.8 / 1.75, width: 1.04, hipZ: body.RIG.hipZ[0] },
    context = vm.createContext({ Three, RIG: body.RIG, RIG_UNIT: 1, UNITS_PER_METRE: 8, player, worldResetSerial: 0,
      gameTime: 10, TAU: Math.PI * 2, selectedWeaponIndex: 0, FISTS_INDEX: 0, PLAYER_WEAPONS: [], HOLD_POSES: {},
      clamp: (v, a, b) => Math.min(b, Math.max(a, v)), hitFlinch: () => 0, personFallAmount: () => 0,
      entityElevation: p => p.altitude, terrainHeight: () => player.altitude, compiledLook: () => look,
      specialLook: () => ({}), personIncapacitated: () => false, playerAimFacing: () => null, rooftopJob: () => null,
      lootCrouching: () => false, summitDigging: () => false, playerJumpPose: () => null, chaseCameraLive: () => false,
    }),
    special = read('crowd3d-special'), draw = read('crowd3d-draw'),
    legStart = draw.indexOf('          if (spec?.legTargets) {'), legEnd = draw.indexOf('          crowdJoint(mHip[side]', legStart),
    easeStart = draw.indexOf('        const k = 1 - Math.exp(-dt *'), easeEnd = draw.indexOf('        if (p.hp <= 0 && !p.deathStyle?.slump)', easeStart);
  t.assert(legStart > 0 && legEnd > legStart && easeStart > 0 && easeEnd > easeStart, 'production leg IK/pose easing extraction anchors changed');
  const api = vm.runInContext(read('crowd3d-joints') + read('crowd3d-poses') + read('carjack3d') +
      special.slice(0, special.indexOf('      function playerSwimSpec(')) + `
      const legLocal = new Three.Vector3(), legInverse = new Three.Matrix4();
      function targetLeg(spec, side, R, w, mHips, hip, knee, spread) {
        const sign = side ? 1 : -1;
        ${draw.slice(legStart, legEnd)}
        return [hip, knee, spread];
      }
      function easeExit(J, T, spec, dt, fresh) { const p = player;
        ${draw.slice(easeStart, easeEnd)}
        return J;
      }
      ({ sample(kind, seconds) {
        carTransition.kind = kind; carTransition.at = gameTime - seconds;
        const spec = specialSpec(player), T = new Float32Array(J_COUNT);
        crowdPoseTargets(player, { seed: 0 }, T, gameTime, spec);
        return { spec, T };
      }, carExitFootTargets, targetLeg, easeExit })`, context);
  body.pbClock.until = Infinity;
  const build = body.pbAssetBuildSteps(); let step;
  while (!(step = build.next()).done) {}
  const data = step.value; data.unitsPerMetre = body.PB_UNITS;
  const A = data.attributes, H = look.height, rows = [];
  function pose(T) {
    return { drop: T[0], lean: T[1], twist: T[2], roll: T[3], headPitch: T[4], headYaw: T[5],
      arms: [[T[6], T[7], T[8]], [T[9], T[10], T[11]]], legs: [[T[12], T[13], T[17]], [T[14], T[15], T[17]]] };
  }
  function framesFor(pose) {
    const world = new Three.Matrix4().makeRotationY(-player.a);
    world.setPosition(player.x, player.altitude, player.y);
    return poseFrames(Three, body.RIG, H, pose, look.width).map(frame => frame.premultiply(world));
  }
  for (const floor of [0, 12]) for (const heading of [0, Math.PI / 4, Math.PI / 2, -Math.PI * .7]) for (const mode of ['target', 'eased']) {
    player.altitude = floor; player.a = heading;
    let eased;
    for (let phase = 0; phase < 30; phase++) {
      const sample = api.sample('exit', phase / 60), before = Array.from(sample.T), targets = sample.spec.legTargets;
      eased ||= new Float32Array(sample.T.length);
      api.easeExit(eased, sample.T, sample.spec, 1 / 60, phase === 0);
      const joints = pose(mode === 'eased' ? eased : sample.T), initial = framesFor(joints);
      t.assert(targets?.length === 2 && sample.spec.pose === 'exitCar', 'production specialSpec does not constrain feet during exit');
      t.assert(api.carExitFootTargets(player, sample.spec) === targets, 'exit feet allocate new targets instead of reusing renderer scratch');
      // Execute the extracted production leg-target branch with the actual posed
      // hip frame. Ground/mesh checks remain independent of its implementation.
      for (let side = 0; side < 2; side++) {
        joints.legs[side] = api.targetLeg(sample.spec, side, look, look.width, initial[0], ...joints.legs[side]);
      }
      const skin = skinner(Three, data, framesFor(joints)), minimum = [Infinity, Infinity], maximum = [-Infinity, -Infinity];
      let shoes = 0, below = 0;
      for (let v = 0; v < data.vertices; v++) if (Math.round(A.pbZone[v * 4]) === 4) {
        const point = skin(A.position[v * 3], A.position[v * 3 + 1], A.position[v * 3 + 2], A.pbSkin[v * 4], A.pbSkin[v * 4 + 1], A.pbSkin[v * 4 + 2]),
          side = Math.round(A.pbSkin[v * 4 + 3]) === 14 ? 1 : 0;
        minimum[side] = Math.min(minimum[side], point[1]); maximum[side] = Math.max(maximum[side], point[1]);
        below += point[1] < floor + .12 - 1e-5; shoes++;
      }
      t.assert(shoes === 395 && minimum.every(Number.isFinite), 'exit sweep missed the actual shipped player shoes');
      t.assert(below === 0, 'actual skinned shoes intersect runway/visual ground at exit phase ' + phase + ': ' + JSON.stringify({ minimum, floor, below }));
      t.assert(minimum.every(y => y - floor < .04 * 8), 'exit foot correction floats above the source ground');
      t.assert(before.every((value, i) => value === sample.T[i]), 'planted-foot correction changes original hip/lean/pose timing targets');
      if (phase === 13) rows.push({ floor, heading, mode, phase, minimumMetresAboveGround: minimum.map(y => (y - floor) / 8), shoeVertices: shoes, below });
    }
  }
  api.sample('exit', .22);
  for (const [kind, seconds] of [[null, 0], ['enter', .22], ['exit', .6]]) {
    const sample = api.sample(kind, seconds);
    t.assert(sample.spec.legTargets === undefined, 'exit foot override leaks into standing, entry or completed transition');
  }
  t.note(JSON.stringify({ exitFeet: { source: 'actual production targets/specialSpec/solveLeg; shipped mesh + existing body-test DQ skinning', phases: 30, headings: 4, elevations: 2, modes: ['target', 'eased'], actualShoeVertices: 395, rows } }));
}
