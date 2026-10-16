// Actual asset builders/rider queue and two-bone IK: authored contacts stay on the steering bars.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');

export async function runMotorcycleRiderFit(t, approvedPack = false, riderHeight = 1.8, exercise = null) {
  const dolcatiPack = approvedPack === 'dolcati',
    bikeTypes = dolcatiPack ? ['dolcati'] : approvedPack ? ['bike', 'kr500'] : ['bike', 'cruiser', 'kr500'];
  const bytes = fs.readFileSync(new URL('../../assets/' + (dolcatiPack ? 'dolcati-vehicle-models.bin' : approvedPack ? 'approved-vehicle-models.bin' : 'vehicle-models.bin'), import.meta.url));
  const length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length));
  const base = length + 12, types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {};
  for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  const mapping = dolcatiPack ? { dolcati: 'dolcati_roy' } : approvedPack ? { bike: 'm2_sport', kr500: 'm1_enduro' } : {},
    packedModel = type => header.models[mapping[type] || type], fixture = { header, arrays },
    materials = Object.fromEntries(['trim', 'rubber', 'rim', 'glass', 'headOff', 'tailOff', 'headOn', 'tailOn', 'brake', 'drlOn', 'drlOff']
    .map(name => [name, new Three.MeshStandardMaterial()]));
  const player = { car: null }, captures = [], look = { height: riderHeight / 1.75, width: 1, shoulderZ: 1.56 }, M = 8;
  const actualLengths = {};
  if (approvedPack) for (const type of bikeTypes) {
    const match = new RegExp('\\b' + type + ':\\s*\\{[\\s\\S]*?\\bl:\\s*([0-9.]+) \\* UNITS_PER_METRE').exec(read('game-vehicles'));
    if (!match) throw Error(type + ': production length missing');
    actualLengths[type] = Number(match[1]) * M;
  }
  const scope = vm.createContext({ Three, fixture, materials, player, captures, look,
    CAR_M: M, KMH: M / 3.6, TAU: 2 * Math.PI, PERSON_HEIGHT: 14, gameTime: 0, worldResetSerial: 0,
    sharedGeometries: new Set(), specialLooks: new WeakMap(),
    crowdQuat: new Three.Quaternion(), crowdEuler: new Three.Euler(), mLocal: new Three.Matrix4(),
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    isAircraft: () => false, isBoat: () => false, vehicleLampAmount: () => 0,
    hitFlinch: () => null, personFallAmount: () => 0,
    vehicleSpec: c => ({ l: approvedPack ? actualLengths[c.type] : packedModel(c.type).dims[0] * M }),
    approvedVehicleData: () => fixture,
    approvedVehicleModel: key => approvedPack ? header.models[key] : null,
    approvedVehicleGeometry: (model, part, k, uvAt) => api.vaGeometry(model, fixture, part, k, uvAt),
    approvedVehicleMaterials: () => materials,
    approvedVehiclePaint: c => new Three.MeshPhysicalMaterial({ color: c.color }),
    dolcatiVehicleModel: () => dolcatiPack ? header.models.dolcati_roy : null,
    dolcatiVehicleData: () => fixture,
    dolcatiVehicleMaterials: () => materials, dolcatiVehicleLamps: () => materials,
    dolcatiVehiclePaint: c => new Three.MeshPhysicalMaterial({ color: c.color }),
    civSharedMaterials: () => materials, civLampSet: () => materials,
    outfitLook: () => look, compiledLook: () => look,
    driveByRiderArm() {},
    mesh(geo, material, parent, x = 0, y = 0, z = 0) {
      const mesh = new Three.Mesh(geo, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    },
    halo(parent, x, y, z) { const g = new Three.Group(); g.position.set(x, y, z); parent.add(g); return g; },
    specialVehicle() {
      const group = new Three.Group(), body = new Three.Group(); group.add(body);
      return { group, body, wheels: [], lamps: [], special: true };
    },
    drawCrowdPerson(p, state, dt, detail, spec) {
      captures.push({ p, state, root: spec.rootOverride.clone(), hands: spec.handTargets.map(v => v.clone()),
        feet: spec.legTargets.map(v => v.clone()), lean: spec.riderLean, pose: spec.pose,
        roll: spec.torsoRoll, twist: spec.torsoTwist, headYaw: spec.headYaw, headPitch: spec.headPitch });
    },
  });
  const rig = read('character-rig3d'), bodies = read('crowd3d-bodies');
  const api = vm.runInContext(read('vehicle-assets3d') + read('motorbikes3d') + read('motorbike-assets3d') +
    rig.slice(rig.indexOf('      const RIG ='), rig.indexOf('      /* ---- Materials')) +
    bodies.slice(bodies.indexOf('      function crowdJoint('), bodies.indexOf('      function crowdEmit(')) +
    read('crowd3d-joints') + read('crowd3d-poses') + read('crowd3d-special') + `
      vaData = () => fixture; vaMaterials = () => materials;
      motoRiderGeometry = () => new Three.BoxGeometry(.1, .1, .1);
      // Other player activities are outside this renderer-only host. Keep the actual rider branch.
      specialSpec = () => { resetSpec(specScratch); specScratch.look = look; return specScratch; };
      ({ makeAssetMotorbike, vaGeometry, queueRider, drawQueuedRiders, crowdPoseTargets, crowdJoint, ikArm,
        RIG, RIG_UNIT, J_COUNT, J_LEAN, J_DROP, J_ROLL, J_TWIST, J_HEAD_PITCH, J_HEAD_YAW })`, scope);
  const pos = matrix => new Three.Vector3().setFromMatrixPosition(matrix);
  const capture = (c, model, own = false, deltaSeconds = 1 / 60) => {
    player.car = own ? c : null;
    api.queueRider(c, model); api.drawQueuedRiders(deltaSeconds, 2);
    return captures.at(-1);
  };
  // Additional production-rig exercises share this exact builder/queue/IK host.
  if (exercise) return exercise({ api, capture, packedModel, actualLengths, look, player });
  let maxTargetError = 0, maxWristError = 0, maxRestWristError = 0, maxBoneError = 0, formerSteeringGap = 0;
  const restReach = [];
  for (const type of bikeTypes) {
    const packed = packedModel(type), assetScale = approvedPack ? actualLengths[type] / packed.dims[0] : M,
      grips = packed.grips || [-1, 1].map(side => [packed.grip[0], packed.grip[1], side * packed.grip[2]]);
    t.assert(!approvedPack && type === 'kr500' || !!packed.grips, type + ': measured paired grips missing');
    t.assert(grips.length === 2 && grips.every(v => v.length === 3 && v.every(Number.isFinite)), type + ': authored grips missing');
    t.assert(grips[0][2] < grips[1][2], type + ': left/right grip order reversed');
    const c = { type, color: '#d95121', x: 0, y: 0, a: 0, hp: 100, wheelie: 0 }, model = api.makeAssetMotorbike(c);
    const fixedInverse = model.riderGripInverse.clone();
    if (packed.grips) t.assert(model.riderSeat.grips.every((point, side) => point.every((v, axis) => Math.abs(v - grips[side][axis] * assetScale) < 1e-10)),
      type + ': optional grips scaled twice or have a wrist offset');
    // A physical marker parented to each handlebar moves with the production raked fork.
    const markers = grips.map(point => {
      const marker = new Three.Object3D();
      marker.position.set(...point).multiplyScalar(assetScale).applyMatrix4(model.riderGripInverse);
      model.steer.add(marker); return marker;
    });
    for (const [steer, bank, pitch, yaw, wheelie] of [[0, 0, 0, 0, 0], [.46, .2, 0, 1.2, 0], [-.46, -.25, .35, -2.1, .35]]) {
      model.steer.rotation.y = steer;
      model.body.rotation.set(bank, 0, pitch); model.group.rotation.y = yaw;
      model.group.position.set(102, 13, -57); c.wheelie = wheelie;
      model.group.updateMatrixWorld(true);
      const own = steer >= 0, drawn = capture(c, model, own);
      t.assert(drawn.pose === 'riding' && drawn.lean === packed.lean - .6 * wheelie, type + ': riding/wheelie pose lost');
      const T = new Float32Array(api.J_COUNT);
      api.crowdPoseTargets(drawn.p, drawn.state, T, 0, { pose: 'riding', riderLean: drawn.lean });
      const H = look.height * api.RIG_UNIT, root = drawn.root.clone().scale(new Three.Vector3(H, H, H));
      const hips = new Three.Matrix4(), torso = new Three.Matrix4();
      api.crowdJoint(hips, root, 0, api.RIG.hip + T[api.J_DROP], 0);
      api.crowdJoint(torso, hips, 0, api.RIG.waist, 0, T[api.J_LEAN], T[api.J_ROLL], T[api.J_TWIST]);
      for (let side = 0; side < 2; side++) {
        const expected = markers[side].getWorldPosition(new Three.Vector3());
        const gap = drawn.hands[side].distanceTo(expected); maxTargetError = Math.max(maxTargetError, gap);
        t.assert(gap < 1e-8, `${type}: hand left actual steering contact by ${gap}`);
        const former = new Three.Vector3(...grips[side]).multiplyScalar(assetScale).applyMatrix4(model.body.matrixWorld);
        formerSteeringGap = Math.max(formerSteeringGap, former.distanceTo(expected));
        // Use the actual crowd shoulder transform and production IK, preserving arm lengths.
        const upper = new Three.Matrix4(), lower = new Three.Matrix4(), hand = new Three.Matrix4();
        api.crowdJoint(upper, torso, 0, api.RIG.shoulderY, (side ? 1 : -1) * look.shoulderZ * look.width);
        const shoulder = pos(upper), pole = new Three.Vector3(-.4, -1, (side ? 1 : -1) * .6).transformDirection(torso);
        api.ikArm(upper, lower, hand, shoulder, drawn.hands[side], pole, api.RIG.upperArm * H, api.RIG.forearm * H, H);
        const wristGap = pos(hand).distanceTo(expected), reach = (api.RIG.upperArm + api.RIG.forearm) * H * .998;
        maxWristError = Math.max(maxWristError, wristGap);
        if (steer === 0) {
          maxRestWristError = Math.max(maxRestWristError, wristGap);
          restReach.push({ type, side, lean: packed.lean, wristGap, shoulder: shoulder.toArray(), grip: expected.toArray() });
        }
        // Preserve anatomy: a full-lock grip may exceed the real arm's finite reach.
        // Require the exact existing physical clamp rather than extending the bones.
        t.assert(Math.abs(wristGap - Math.max(0, shoulder.distanceTo(expected) - reach)) < 1e-8,
          type + ': wrist does not follow its target or its finite arm reach');
        maxBoneError = Math.max(maxBoneError, Math.abs(pos(upper).distanceTo(pos(lower)) - api.RIG.upperArm * H),
          Math.abs(pos(lower).distanceTo(pos(hand)) - api.RIG.forearm * H));
      }
      // Steering cannot pull the hips or feet away from the fixed saddle and pegs.
      const saddle = new Three.Vector3(...model.riderSeat.seat).applyMatrix4(model.body.matrixWorld);
      const up = new Three.Vector3(0, 1, 0).transformDirection(model.body.matrixWorld);
      t.assert(pos(drawn.root).addScaledVector(up, (api.RIG.hip - .5) * H).distanceTo(saddle) < 1e-8,
        type + ': hand steering moved the seat');
      for (let side = 0; side < 2; side++) {
        const peg = model.riderSeat.peg;
        const ankle = new Three.Vector3(peg[0], peg[1], (side ? 1 : -1) * peg[2])
          .applyMatrix4(model.body.matrixWorld).addScaledVector(up, api.RIG.ankle * H);
        t.assert(drawn.feet[side].distanceTo(ankle) < 1e-8, type + ': hand steering moved a foot peg');
      }
    }
    t.assert(model.riderGripInverse.equals(fixedInverse), type + ': cached inverse was mutated');
  }
  t.assert(maxTargetError < 1e-8 && maxBoneError < 1e-8, 'rider contact/bone transform error');
  t.assert(maxRestWristError < .08, `straight bars beyond actual arm reach: ${maxRestWristError}; ${JSON.stringify(restReach)}`);
  t.assert(formerSteeringGap > .5, 'test did not exercise independent raked steering');
  // Procedural motorbikes, bicycles and jet skis keep the established compensated single-grip convention.
  const group = new Three.Group(), body = new Three.Group(), rider = new Three.Group(); group.add(body); body.add(rider);
  group.position.set(-20, 5, 13); body.rotation.set(.2, -.4, .1);
  const oldSeat = { seat: [-2, 8, 0], grip: [4, 10, 3], peg: [0, 4, 2], lean: -.3 };
  const legacy = capture({ type: 'legacy', hp: 1, x: 0, y: 0, a: 0 }, { group, rider, riderSeat: oldSeat });
  for (let side = 0; side < 2; side++) {
    const point = new Three.Vector3(3.6, 10.2, (side ? 1 : -1) * 3).applyMatrix4(body.matrixWorld);
    t.assert(point.distanceTo(legacy.hands[side]) < 1e-8, 'legacy wrist compensation changed');
  }
  // Execute the actual final frame span, with real matrices and renderer-free
  // update stubs. Crowd upload must capture the current hill pose, not the flat
  // chassis that existed before the terrain-alignment loop.
  const frame = read('render3d-frame');
  const span = frame.slice(frame.indexOf('          endVehicleImpostors();'), frame.indexOf('          updateDamageVisuals(deltaSeconds);'));
  t.assert(span.includes('finishCrowd3D') && span.includes('slopePitch'), 'terrain/crowd frame span missing');
  const carModels = new Map(), copied = new Map(), localContact = new Three.Vector3(.3, 1.1, -.4);
  for (const kind of ['motorbike', 'car', 'boat', 'aircraft', 'invisible']) {
    const c = { kind, slopeRoll: .27, slopePitch: -.19 }, group = new Three.Group(), body = new Three.Group();
    group.add(body); group.position.set(100, 20, -70); group.rotation.y = .8;
    body.rotation.set(.06, 0, .04); group.visible = kind !== 'invisible';
    carModels.set(c, { group, body });
  }
  const frameScope = vm.createContext({ carModels, deltaSeconds: 1 / 60, lap: 0,
    isAircraft: c => c.kind === 'aircraft', isBoat: c => c.kind === 'boat',
    endVehicleImpostors() {}, profileLap: () => 0,
    updateSeaLifeVisuals() {}, updateWakes() {}, updateOffroadVisuals() {}, updateTyreSmoke() {},
    finishCrowd3D() {
      for (const [c, m] of carModels) {
        m.group.updateMatrixWorld(true); copied.set(c, localContact.clone().applyMatrix4(m.body.matrixWorld));
      }
    },
  });
  vm.runInContext(span, frameScope);
  for (const [c, m] of carModels) {
    const tilted = c.kind === 'motorbike' || c.kind === 'car';
    t.assert(Math.abs(m.body.rotation.x - (.06 + (tilted ? c.slopeRoll : 0))) < 1e-12 &&
      Math.abs(m.body.rotation.z - (.04 + (tilted ? c.slopePitch : 0))) < 1e-12,
      c.kind + ': final terrain alignment or exclusions changed');
    m.group.updateMatrixWorld(true);
    const finalContact = localContact.clone().applyMatrix4(m.body.matrixWorld);
    t.assert(copied.get(c).distanceTo(finalContact) < 1e-9, c.kind + ': rider/occupant uploaded before current terrain tilt');
  }
  t.note(JSON.stringify({ riderHeight, maxTargetError, maxWristError, maxRestWristError, maxBoneError, formerSteeringGap }));
}

export default function (t) { return runMotorcycleRiderFit(t); }
