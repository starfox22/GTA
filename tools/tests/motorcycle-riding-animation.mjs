// Actual rider queue and character IK through weight shift, tuck, corner hangoff and braking.
import { createRequire } from 'node:module';
import { runMotorcycleRiderFit } from './motorcycle-rider-fit.mjs';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');

export default async function (t) {
  let maxContactError = 0, maxWristGap = 0, maxBoneError = 0;
  let maxWristCase;
  const examples = [];
  for (const pack of [true, 'dolcati']) for (const height of [1.65, 1.8, 1.9])
    await runMotorcycleRiderFit(t, pack, height, async ({ api, capture, packedModel, actualLengths, look }) => {
      for (const type of pack === 'dolcati' ? ['dolcati'] : ['bike', 'kr500']) {
        const packed = packedModel(type), scale = actualLengths[type] / packed.dims[0],
          c = { type, color: '#c8141c', hp: 100, x: 0, y: 0, a: 0, speed: 0, av: 0, wheelie: 0, wheelieLean: 0, bikeRoll: 0 },
          model = api.makeAssetMotorbike(c), H = look.height * api.RIG_UNIT;
        const settle = settings => {
          Object.assign(c, { speed: 0, av: 0, wheelie: 0, wheelieLean: 0, bikeRoll: 0, bikeRollRate: 0, braking: false }, settings);
          model.body.rotation.set(c.bikeRoll, 0, c.wheelie); model.group.rotation.y = -.75;
          model.group.position.set(80, 18, -40); model.group.updateMatrixWorld(true);
          let drawn;
          for (let i = 0; i < 100; i++) drawn = capture(c, model, true);
          return drawn;
        };
        const points = drawn => {
          const T = new Float32Array(api.J_COUNT);
          api.crowdPoseTargets(drawn.p, drawn.state, T, 0, { pose: drawn.pose, riderLean: drawn.lean,
            torsoRoll: drawn.roll, torsoTwist: drawn.twist, headYaw: drawn.headYaw, headPitch: drawn.headPitch });
          const root = drawn.root.clone().scale(new Three.Vector3(H, H, H)), hips = new Three.Matrix4(), torso = new Three.Matrix4();
          api.crowdJoint(hips, root, 0, api.RIG.hip + T[api.J_DROP], 0, 0, T[api.J_ROLL] * .4);
          api.crowdJoint(torso, hips, 0, api.RIG.waist, 0, T[api.J_LEAN], T[api.J_ROLL], T[api.J_TWIST]);
          const pos = matrix => new Three.Vector3().setFromMatrixPosition(matrix);
          for (let side = 0; side < 2; side++) {
            const originalGrip = new Three.Vector3(...packed.grips[side]).multiplyScalar(scale)
              .applyMatrix4(model.riderGripInverse).applyMatrix4(model.steer.matrixWorld),
              originalPeg = new Three.Vector3(model.riderSeat.peg[0], model.riderSeat.peg[1], (side ? 1 : -1) * model.riderSeat.peg[2])
                .applyMatrix4(model.body.matrixWorld).addScaledVector(new Three.Vector3(0, 1, 0).transformDirection(model.body.matrixWorld), api.RIG.ankle * H);
            maxContactError = Math.max(maxContactError, drawn.hands[side].distanceTo(originalGrip), drawn.feet[side].distanceTo(originalPeg));
            const upper = new Three.Matrix4(), lower = new Three.Matrix4(), hand = new Three.Matrix4();
            api.crowdJoint(upper, torso, 0, api.RIG.shoulderY, (side ? 1 : -1) * look.shoulderZ * look.width);
            const pole = new Three.Vector3(-.4, -1, (side ? 1 : -1) * .6).transformDirection(torso);
            api.ikArm(upper, lower, hand, pos(upper), drawn.hands[side], pole, api.RIG.upperArm * H, api.RIG.forearm * H, H);
            const gap = pos(hand).distanceTo(originalGrip);
            if (gap > maxWristGap) { maxWristGap = gap; maxWristCase = { type, height, kmh: c.speed / (8 / 3.6), shift: c.wheelieLean, bank: c.bikeRoll, braking: c.braking }; }
            maxBoneError = Math.max(maxBoneError, Math.abs(pos(upper).distanceTo(pos(lower)) - api.RIG.upperArm * H),
              Math.abs(pos(lower).distanceTo(pos(hand)) - api.RIG.forearm * H));
          }
          return { T, root, torso, hip: pos(hips), headFacing: c.wheelie + .7 * drawn.lean - drawn.headPitch };
        };
        const idle = settle({}), idleRoot = idle.root.clone(), idleLean = idle.lean;
        for (const input of [-.65, 1]) {
          const parked = settle({ wheelieLean: input, bikeRollRate: .6, braking: true });
          t.assert(Math.abs(parked.lean - idleLean) < 1e-8 && parked.root.equals(idleRoot) && Math.abs(parked.roll) < 1e-8,
            type + ': parked inputs animated weight/steering shift');
        }
        const cruise = settle({ speed: 80 * 8 / 3.6 }), cruisePose = points(cruise),
          back = settle({ speed: 80 * 8 / 3.6, wheelieLean: 1 }), backPose = points(back),
          forward = settle({ speed: 80 * 8 / 3.6, wheelieLean: -.65 }), forwardPose = points(forward);
        t.assert(back.lean > cruise.lean + (height < 1.7 ? .035 : .12) && forward.lean < cruise.lean - .08,
          type + ': explicit rider weight shift is not visible ' + JSON.stringify({ height, back: back.lean, neutral: cruise.lean, forward: forward.lean }));
        const axis = new Three.Vector3(1, 0, 0).transformDirection(model.body.matrixWorld);
        t.assert(backPose.hip.clone().sub(cruisePose.hip).dot(axis) < (height < 1.7 ? -.04 : -.15) && forwardPose.hip.clone().sub(cruisePose.hip).dot(axis) > .1,
          type + ': hips did not shift fore/aft along the actual saddle');
        const fast = settle({ speed: 180 * 8 / 3.6 }), fastPose = points(fast),
          brake = settle({ speed: 100 * 8 / 3.6, braking: true }), brakePose = points(brake);
        if (type !== 'kr500') t.assert(fast.lean < cruise.lean - .08, type + ': high-speed sport tuck missing');
        t.assert(brake.lean > fast.lean + .15, type + ': braking did not brace/open the chest');
        const lower = settle({ speed: 80 * 8 / 3.6, braking: true, wheelieLean: -.65 }); points(lower);
        t.assert(lower.lean < cruise.lean - .07, type + ': Down braking reversed the explicit forward weight shift');
        const left = settle({ speed: 85 * 8 / 3.6, bikeRoll: -.5, av: -.35 }), leftPose = points(left),
          right = settle({ speed: 85 * 8 / 3.6, bikeRoll: .5, av: .35 }), rightPose = points(right);
        t.assert(left.roll < -.06 && right.roll > .06 && left.headYaw > .15 && right.headYaw < -.15,
          type + ': hangoff or looking through the bend is reversed');
        for (const pose of [cruisePose, fastPose, brakePose, leftPose, rightPose])
          t.assert(Math.abs(pose.headFacing) < .12, type + ': head follows torso into the tank instead of the road');
        const wheelie = settle({ speed: 45 * 8 / 3.6, wheelie: .55, wheelieLean: 1 }); points(wheelie);
        t.assert(Math.abs(.55 + .7 * wheelie.lean - wheelie.headPitch) < .22, type + ': wheelie gaze lost the road');
        // Render response is exponential rather than tied to a frame count.
        const start = settle({ speed: 70 * 8 / 3.6 });
        c.wheelieLean = 1;
        const first = capture(c, model, true);
        t.assert(first.lean > start.lean && first.lean < start.lean + .12, type + ': weight shift snapped in one frame');
        const after = (frames, dt) => {
          settle({ speed: 70 * 8 / 3.6 }); c.wheelieLean = 1;
          let pose;
          for (let i = 0; i < frames; i++) pose = capture(c, model, true, dt);
          return pose;
        }, at60 = after(30, 1 / 60), at120 = after(60, 1 / 120);
        t.assert(Math.abs(at60.lean - at120.lean) < 1e-6 && new Three.Vector3().setFromMatrixPosition(at60.root)
          .distanceTo(new Three.Vector3().setFromMatrixPosition(at120.root)) < 1e-6, type + ': body easing changes with rendering frequency');
        const aiming = new Float32Array(api.J_COUNT);
        api.crowdPoseTargets(c, first.state, aiming, 0, { pose: 'riding', riderLean: -.7,
          torsoTwist: .4, torsoRoll: -.2, headYaw: .7, headPitch: .35 });
        t.assert(Math.abs(aiming[api.J_TWIST] - .4) < 1e-7 && Math.abs(aiming[api.J_ROLL] + .2) < 1e-7 &&
          Math.abs(aiming[api.J_HEAD_YAW] - .7) < 1e-7 && Math.abs(aiming[api.J_HEAD_PITCH] - .35) < 1e-7,
          type + ': explicit drive-by aiming pose was overwritten');
        examples.push({ type, height, neutral: cruise.lean, back: back.lean, forward: forward.lean, fast: fast.lean, braking: brake.lean,
          cornerRoll: right.roll, cornerGaze: right.headYaw });
      }
    });
  t.assert(maxContactError < 1e-8, 'animation moved a grip/peg target off its physical source contact');
  t.assert(maxWristGap < .25, 'riding body motion exceeds the physical arm reach: ' + maxWristGap + ' ' + JSON.stringify(maxWristCase));
  t.assert(maxBoneError < 1e-8, 'animation stretched the character arm bones');
  t.note(JSON.stringify({ maxContactError, maxWristGap, maxBoneError, examples }));
}
