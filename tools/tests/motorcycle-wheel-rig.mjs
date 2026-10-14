// Actual packed tyres/rims and production motorcycle builders with real Three.js:
// source pose preservation, measured rolling axle, steering, lock/spin and flat-tyre rigs.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const source = name => fs.readFileSync(new URL('../../src/' + name, import.meta.url), 'utf8');

export default async function (t) {
  const bytes = fs.readFileSync(new URL('../../assets/vehicle-models.bin', import.meta.url));
  const length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length).toString());
  const base = 12 + length, types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array }, arrays = {};
  for (const [key, [type, offset, count]] of Object.entries(header.arrays)) {
    // Copy into an aligned buffer; Node's Buffer offset is not necessarily aligned.
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[key] = new types[type](Uint8Array.from(raw).buffer);
  }
  const materials = { trim: new Three.MeshStandardMaterial(), rubber: new Three.MeshStandardMaterial(),
    rim: new Three.MeshStandardMaterial(), wheel: new Three.MeshStandardMaterial(), headOff: new Three.MeshStandardMaterial(),
    tailOff: new Three.MeshStandardMaterial(), headOn: new Three.MeshStandardMaterial(), tailOn: new Three.MeshStandardMaterial(),
    brake: new Three.MeshStandardMaterial(), drlOn: new Three.MeshStandardMaterial(), drlOff: new Three.MeshStandardMaterial() };
  const player = { car: null }, keys = {}, fixture = { header, arrays }, M = 8;
  const scope = vm.createContext({ Three, CAR_M: M, KMH: M / 3.6, TAU: Math.PI * 2, player, keys, fixture, materials,
    sharedGeometries: new Set(),
    clamp: (v, low, high) => Math.max(low, Math.min(high, v)),
    actionHeld: id => !!keys[id], vehicleLampAmount: () => 0,
    isAircraft: () => false, isBoat: () => false,
    vehicleSpec: c => ({ l: (header.models[c.type]?.dims[0] || 2.2) * M }),
    civSharedMaterials: () => materials, civLampSet: () => materials,
    mesh(geo, material, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
      const mesh = new Three.Mesh(geo, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
    },
    halo(parent, x, y, z) { const group = new Three.Group(); group.position.set(x, y, z); parent.add(group); return group; },
    specialVehicle() {
      const group = new Three.Group(), body = new Three.Group(); group.add(body);
      return { group, body, wheels: [], lamps: [], special: true };
    } });
  const damage = source('damage3d-bodies.js');
  const squash = damage.slice(damage.indexOf('      const squashEuler'), damage.indexOf('      /* The front door'));
  const specialDamage = damage.slice(damage.indexOf('      function specialDamage('), damage.indexOf('      // Glass that bursts'));
  const mud = source('offroad3d-mud.js');
  const contacts = mud.slice(mud.indexOf('      function contactWheels('), mud.indexOf('      // Wading a ford'));
  const api = vm.runInContext(source('vehicle-assets3d.js') + source('motorbikes3d.js') + source('motorbike-assets3d.js') + squash + specialDamage + contacts + `
    vaData = () => fixture; vaMaterials = () => materials;
    motoRiderGeometry = () => new Three.BoxGeometry(.1, .1, .1);
    ({ makeAssetMotorbike, makeMotorbike, animateMotorbike, motoFrontAxle, vaGeometry, specialDamage, contactWheels, MOTO_BODIES })`, scope);
  let restError = 0, normalError = 0, oldAxialWobble = 0, correctedAxialWobble = 0;
  const point = new Three.Vector3(), normal = new Three.Vector3(), worldAxis = new Three.Vector3(), center = new Three.Vector3();
  const normalMatrix = new Three.Matrix3(), quaternion = new Three.Quaternion();
  const models = [];
  for (const type of ['bike', 'cruiser', 'kr500']) {
    const packed = header.models[type];
    t.assert(packed?.kind === 'moto', type + ': packed source model unavailable');
    if (type !== 'bike') t.assert(packed.wheels.every(w => Array.isArray(w.axle) && w.axle.length === 3), type + ': measured source axle metadata missing');
    const c = { type, color: '#d95121', hp: 100, speed: 0, av: 0, wheelie: 0 }, model = api.makeAssetMotorbike(c);
    models.push(model);
    model.group.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const w = packed.wheels[i], scale = M, wheel = model.wheels[i].wheel;
      const axis = new Three.Vector3(...(w.axle || [0, 0, 1])).normalize();
      for (let part = 0; part < wheel.children.length; part++) {
        const original = api.vaGeometry(packed, fixture, `wheel${i}.${part ? 'rim' : 'tyre'}`, scale);
        const drawn = wheel.children[part], p = original.attributes.position, n = original.attributes.normal;
        normalMatrix.getNormalMatrix(drawn.matrixWorld);
        for (let j = 0; j < p.count; j++) {
          const expected = new Three.Vector3().fromBufferAttribute(p, j).add(new Three.Vector3(w.x, w.y, w.z).multiplyScalar(scale));
          point.fromBufferAttribute(drawn.geometry.attributes.position, j).applyMatrix4(drawn.matrixWorld);
          restError = Math.max(restError, point.distanceTo(expected));
          normal.fromBufferAttribute(drawn.geometry.attributes.normal, j).applyMatrix3(normalMatrix).normalize();
          normalError = Math.max(normalError, normal.distanceTo(new Three.Vector3().fromBufferAttribute(n, j).normalize()));
        }
        original.dispose();
      }
      // A source rim vertex's coordinate along its fitted axle is constant throughout
      // rolling, independent of steering rake. The previous world-Z roll moved it sideways.
      const original = api.vaGeometry(packed, fixture, `wheel${i}.rim`, scale), p = original.attributes.position;
      let far = 0;
      for (let j = 1; j < p.count; j++) if (Math.hypot(p.getX(j), p.getY(j)) > Math.hypot(p.getX(far), p.getY(far))) far = j;
      const start = new Three.Vector3().fromBufferAttribute(p, far), samples = [], old = [];
      const drawn = wheel.children[1];
      for (let j = 0; j < 48; j++) {
        const phase = j / 48 * Math.PI * 2;
        wheel.rotation.z = phase;
        model.group.updateMatrixWorld(true);
        wheel.parent.getWorldQuaternion(quaternion);
        worldAxis.set(0, 0, 1).applyQuaternion(quaternion);
        wheel.getWorldPosition(center);
        point.fromBufferAttribute(drawn.geometry.attributes.position, far).applyMatrix4(drawn.matrixWorld).sub(center);
        samples.push(point.dot(worldAxis));
        old.push(start.clone().applyAxisAngle(new Three.Vector3(0, 0, 1), phase).dot(axis));
      }
      correctedAxialWobble = Math.max(correctedAxialWobble, Math.max(...samples) - Math.min(...samples));
      oldAxialWobble = Math.max(oldAxialWobble, Math.max(...old) - Math.min(...old));
      original.dispose(); wheel.rotation.z = 0;
    }
    // Production damage must identify the nested front wheel from metadata, leave the rear
    // intact, and lower the front in its upright frame rather than along the raked fork.
    const front = model.wheels[0].wheel, rear = model.wheels[1].wheel;
    model.group.updateMatrixWorld(true); const before = front.getWorldPosition(new Three.Vector3());
    api.specialDamage(c, model, { tires: { frontRight: true }, burnt: false });
    model.group.updateMatrixWorld(true); const after = front.getWorldPosition(new Three.Vector3());
    t.assert(front.scale.y === .82 && rear.scale.y === 1, type + ': flat front was misclassified as rear');
    t.assert(Math.abs(after.x - before.x) < .003 && Math.abs(after.y - before.y + .8) < .003,
      type + ': flat front still moves along fork rake: ' + JSON.stringify(after.sub(before).toArray()));
    api.specialDamage(c, model, { tires: {}, burnt: false });
    api.specialDamage(c, model, { tires: { frontLeft: true }, burnt: false });
    t.assert(front.scale.y === .82 && rear.scale.y === 1, type + ': a left-side puncture did not flatten the one front tyre');
    api.specialDamage(c, model, { tires: { rearLeft: true }, burnt: false });
    t.assert(front.scale.y === 1 && rear.scale.y === .82, type + ': a left-side puncture did not flatten the one rear tyre');
    api.specialDamage(c, model, { tires: {}, burnt: false });
    api.specialDamage(c, model, { tires: {}, burnt: true });
    t.assert(model.wheels.every(({ wheel }) => !wheel.children[0].visible && wheel.children[1].visible), type + ': burnt tyre did not leave its rim visible');
    api.specialDamage(c, model, { tires: {}, burnt: false });
    t.assert(model.wheels.every(({ wheel }) => wheel.children[0].visible && wheel.scale.y === 1 && wheel.position.y === wheel.userData.baseY),
      type + ': repaired burnt tyre remains invisible or dropped');
    // Body bank/wheelie and fork steering must compose without changing an axle's
    // local-Z roll: rotate a source vertex through tilted world frames too.
    model.body.rotation.x = .23; c.wheelie = .36; player.car = c; c.tyres = { steer: .7, lock: [0, 0], spin: 0 };
    api.animateMotorbike(c, model, .05);
    t.assert(model.steer.rotation.y < 0 && model.body.rotation.z > .3, type + ': steering/wheelie pose was lost');
    c.wheelie = 0; model.body.rotation.x = model.body.rotation.z = 0;
    api.animateMotorbike(c, model, .1);
    t.assert(model.body.position.length() === 0, type + ': wheelie carrier did not settle');
    const contacts = api.contactWheels(c, model);
    t.assert(!contacts[0].driven && contacts[1].driven && contacts[0].x > 0 && contacts[1].x < 0,
      type + ': front tyre spray/contact is still in fork space or marked driven');
    t.assert(Math.abs(contacts[0].r - packed.wheels[0].r * M) < 1e-9 && contacts[0].width < 2,
      type + ': motorcycle spray uses generic car tyre size');
  }
  t.assert(restError < .00001 && normalError < .00001, `source pose changed at rest: vertices ${restError}, normals ${normalError}`);
  t.assert(oldAxialWobble > .2 && correctedAxialWobble < .00001,
    `rolling-axis proof missing: previous ${oldAxialWobble}, corrected ${correctedAxialWobble}`);

  // The procedural builders use the same production carrier/damage/animation, while
  // their cached shape kit can be a small fixture: no downloaded geometry is involved.
  vm.runInContext(`motoKit = type => {
    const body = MOTO_BODIES[type], w = body.wheels,
      headstock = mp(w.xf - Math.tan(body.rake) * (1.02 - w.rf), 1.02),
      geo = () => new Three.BoxGeometry(.1, .1, .1);
    return { paint: geo(), trim: geo(), forkTrim: geo(), head: geo(), tail: geo(),
      headstock, forkLength: Math.hypot(headstock[0] - w.xf * CAR_M, headstock[1] - w.rf * CAR_M),
      tyres: [geo(), geo()], rims: [geo(), geo()], rider: geo() };
  }`, scope);
  for (const type of ['bike', 'cruiser', 'dolcati', 'yamasaki', 'kr500']) {
    const c = { type, color: '#d95121', hp: 100, speed: 0, av: 0, wheelie: 0 }, model = api.makeMotorbike(c), body = api.MOTO_BODIES[type];
    model.group.updateMatrixWorld(true);
    const front = model.wheels[0].wheel, rear = model.wheels[1].wheel,
      before = front.getWorldPosition(new Three.Vector3());
    t.assert(Math.abs(before.x - body.wheels.xf * M) < .002 && Math.abs(before.y - body.wheels.rf * M) < .002,
      type + ': procedural front left its fork axle');
    api.specialDamage(c, model, { tires: { frontRight: true }, burnt: false });
    model.group.updateMatrixWorld(true);
    const drop = front.getWorldPosition(new Three.Vector3()).sub(before);
    t.assert(Math.abs(drop.x) < 1e-9 && Math.abs(drop.y + .8) < 1e-9 && front.scale.y === .82 && rear.scale.y === 1,
      type + ': procedural flat moves along fork rake: ' + JSON.stringify(drop.toArray()));
    const contacts = api.contactWheels(c, model);
    t.assert(!contacts[0].driven && contacts[1].driven && contacts[0].width === body.wheels.wf * M,
      type + ': procedural bike contact/radius contract changed');
    api.specialDamage(c, model, { tires: {}, burnt: true });
    t.assert(model.wheels.every(({ wheel }) => !wheel.children[0].visible), type + ': procedural burnt tyres still visible');
    api.specialDamage(c, model, { tires: {}, burnt: false });
    t.assert(model.wheels.every(({ wheel }) => wheel.children[0].visible && wheel.scale.y === 1), type + ': procedural repair did not restore tyres');
  }

  const c = { type: 'bike', color: '#d95121', hp: 100, speed: 20, av: 0, wheelie: 0, tyres: { steer: .4, lock: [0, 0], spin: 0 } };
  const model = models[0]; player.car = c;
  for (const descriptor of model.wheels) descriptor.wheel.rotation.z = 0;
  api.animateMotorbike(c, model, .1);
  t.near(model.wheels[0].wheel.rotation.z, -20 * .1 / model.wheels[0].radius - 1e-9, -20 * .1 / model.wheels[0].radius + 1e-9, 'signed forward roll at real radius');
  c.speed = -20; api.animateMotorbike(c, model, .1);
  t.assert(model.wheels.every(d => Math.abs(d.wheel.rotation.z) < 1e-9), 'reversing did not unwind forward roll');
  c.speed = 20; c.tyres.lock = [1, .5]; api.animateMotorbike(c, model, .1);
  t.assert(model.wheels[0].wheel.rotation.z === 0 && Math.abs(model.wheels[1].wheel.rotation.z + 1 / model.wheels[1].radius) < 1e-9, 'locked/slipping tyres still roll at road speed');
  for (const d of model.wheels) d.wheel.rotation.z = 0;
  c.speed = 0; c.tyres.lock = [1, 1]; c.tyres.spin = 1; c.spinSpeed = 50;
  const state = JSON.stringify(c); api.animateMotorbike(c, model, .1);
  t.assert(model.wheels[0].wheel.rotation.z === 0 && model.wheels[1].wheel.rotation.z < -.1, 'rear wheelspin at a stop did not animate');
  t.assert(JSON.stringify(c) === state, 'renderer changed driving physics state');
  const frame = source('render3d-frame.js');
  const rollAt = frame.indexOf('for (const { wheel, radius } of m.wheels)'),
    start = frame.lastIndexOf('\n', rollAt) + 1,
    end = frame.indexOf('\n', rollAt);
  let genericRoll = frame.slice(start, end);
  // A preceding specialised-wheel hook may make the generic fallback an else-if.
  // Exercise that actual branch too instead of extracting an invalid isolated else.
  if (/^\s*else\b/.test(genericRoll)) {
    const specialAt = frame.lastIndexOf('if (m.militaryWheels)', start);
    if (specialAt < 0) throw Error('preceding special-wheel branch not found');
    genericRoll = frame.slice(frame.lastIndexOf('\n', specialAt) + 1, end);
  }
  t.assert(genericRoll, 'generic special-wheel integration loop not found');
  const runGeneric = new Function('m', 'c', 'deltaSeconds', genericRoll);
  const alreadyRolled = model.wheels.map(d => d.wheel.rotation.z);
  runGeneric(model, c, .1);
  t.assert(model.wheels.every((d, i) => d.wheel.rotation.z === alreadyRolled[i]), 'generic special-wheel loop rolled motorcycle wheels twice');
  const plain = { wheels: [{ wheel: new Three.Group(), radius: 2 }], modelScale: 1 };
  runGeneric(plain, { speed: 20 }, .1);
  t.assert(plain.wheels[0].wheel.rotation.z === -1, 'generic non-motorcycle special wheels stopped rolling');
  t.note(`actual packed tyres/rims: rest vertex error ${restError.toExponential(2)}u, normal error ${normalError.toExponential(2)}; worst previous axial rim wobble ${(oldAxialWobble / M * 100).toFixed(2)}cm -> ${(correctedAxialWobble / M * 100).toExponential(2)}cm; signed roll, brakes, spin, steering and flat damage pass`);
}
