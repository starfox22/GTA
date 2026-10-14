// Actual approved packed meshes through production moto builders: rolling, contacts,
// fork/fairing separation, damage repair and geometry LODs in both camera regimes.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const source = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
const readPack = name => {
  const bytes = fs.readFileSync(new URL('../../assets/' + name, import.meta.url)), length = bytes.readUInt32LE(8),
    header = JSON.parse(bytes.subarray(12, 12 + length)), base = 12 + length,
    types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array }, arrays = {};
  for (const [key, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[key] = new types[type](Uint8Array.from(raw).buffer);
  }
  return { header, arrays };
};

export default async function (t) {
  const approved = readPack('approved-vehicle-models.bin'), old = readPack('vehicle-models.bin'), M = 8,
    materials = Object.fromEntries(['trim', 'rubber', 'rim', 'glass', 'headOff', 'tailOff', 'headOn', 'tailOn', 'brake', 'drlOn', 'drlOff']
      .map(key => [key, new Three.MeshStandardMaterial()])), player = { car: null }, camera = { zoom: 1 };
  const quality = source('quality'), productionTiers = vm.runInNewContext(quality.slice(quality.indexOf('    const GRAPHICS_TIERS ='),
    quality.indexOf('    const GRAPHICS_ORDER =')) + 'GRAPHICS_TIERS');
  const scope = vm.createContext({ Three, CAR_M: M, KMH: M / 3.6, TAU: Math.PI * 2, player, old, approved, materials,
    activeTier: { lodBias: 1 }, viewZoom: 2, chaseViewActive: false, camera,
    sharedGeometries: new Set(), clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    vehicleLampAmount: () => 1, actionHeld: () => false, chaseZoomAt: () => camera.zoom,
    isAircraft: () => false, isBoat: () => false,
    vehicleSpec: c => ({ l: (approved.header.models[c.type === 'bike' ? 'm2_sport' : 'm1_enduro']?.dims[0] || 2.2) * M }),
    civSharedMaterials: () => materials, civLampSet: () => materials,
    mesh(geo, material, parent) { const mesh = new Three.Mesh(geo, material); parent.add(mesh); return mesh; },
    halo(parent, x, y, z) { const o = new Three.Group(); o.position.set(x, y, z); parent.add(o); return o; },
    specialVehicle() { const group = new Three.Group(), body = new Three.Group(); group.add(body);
      return { group, body, wheels: [], lamps: [], special: true }; },
  });
  const damage = source('damage3d-bodies'), mud = source('offroad3d-mud'), api = vm.runInContext(
    source('vehicle-assets3d') + source('motorbikes3d') + source('motorbike-assets3d') +
    damage.slice(damage.indexOf('      const squashEuler'), damage.indexOf('      /* The front door')) +
    damage.slice(damage.indexOf('      function specialDamage('), damage.indexOf('      // Glass that bursts')) +
    mud.slice(mud.indexOf('      function contactWheels('), mud.indexOf('      // Wading a ford')) + `
      vaData = () => old; vaMaterials = () => materials;
      function approvedVehicleData() { return approved; }
      function approvedVehicleModel(key) { return approved.header.models[key]; }
      function approvedVehicleGeometry(model, name, k, uvAt) { return vaGeometry(model, approved, name, k, uvAt); }
      function approvedVehicleMaterials() { return materials; }
      function approvedVehiclePaint(vehicle) { return new Three.MeshPhysicalMaterial({color:vehicle.color}); }
      motoRiderGeometry = () => new Three.BoxGeometry(.1, .1, .1);
      ({ makeAssetMotorbike, motoAssetKit, motoAssetLod, animateMotorbike, vaGeometry, specialDamage, contactWheels })`, scope);
  let restError = 0, normalError = 0, rollingWobble = 0;
  const stats = [], point = new Three.Vector3(), normal = new Three.Vector3(), quaternion = new Three.Quaternion(),
    worldAxis = new Three.Vector3(), center = new Three.Vector3(), normals = new Three.Matrix3();
  for (const [type, key] of [['kr500', 'm1_enduro'], ['bike', 'm2_sport']]) {
    const packed = approved.header.models[key], c = { type, color: '#d84724', hp: 100, maxhp: 100, speed: 0, av: 0,
      wheelie: 0, x: 0, y: 0, damage: { marks: [] }, dents: [] }, model = api.makeAssetMotorbike(c),
      kit = api.motoAssetKit(type, packed.dims[0] * M);
    t.assert(model.approvedAsset === key && model.realSize && model.bike && !model.bicycle, type + ': approved asset not selected');
    t.assert(packed.grips?.length === 2 && packed.grips[0][2] < 0 && packed.grips[1][2] > 0, key + ': independently measured grips missing');
    t.assert(model.wheels.length === 2 && model.wheels.every(w => w.radius > 1), key + ': two real-size wheels missing');
    t.assert(model.motoLod.pairs.length >= 4, key + ': cached body/wheel LOD pairs missing');
    for (const pair of model.motoLod.pairs) for (const level of ['near', 'far'])
      t.assert(['finish', 'avSourceUv', 'avAtlasRect'].every(name => pair[level].attributes[name]?.count === pair[level].attributes.position.count),
        key + ': ' + level + ' source finish/repeat atlas attributes missing');
    const clone = api.makeAssetMotorbike({ ...c, id: 2 });
    t.assert(clone.wheels[0].wheel !== model.wheels[0].wheel && clone.steer !== model.steer && clone.paint !== model.paint,
      key + ': independent instances share dynamic state');
    t.assert(clone.wheels[0].wheel.children[0].geometry === model.wheels[0].wheel.children[0].geometry,
      key + ': repeated instances rebuilt tyre geometry');
    model.group.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const wheel = model.wheels[i].wheel, meta = packed.wheels.find(w => !!w.front === (i === 0)), index = packed.wheels.indexOf(meta);
      for (let part = 0; part < 2; part++) {
        const original = api.vaGeometry(packed, approved, `wheel${index}.${part ? 'rim' : 'tyre'}`, M), drawn = wheel.children[part];
        t.assert(!!original && !!drawn, key + ': complete tyre/rim pair missing');
        for (const name of ['avSourceUv', 'avAtlasRect'])
          t.assert(original.attributes[name].array.every((v, i) => v === drawn.geometry.attributes[name].array[i]),
            key + ': axle normalization changed source texture coordinates');
        normals.getNormalMatrix(drawn.matrixWorld);
        for (let j = 0; j < original.attributes.position.count; j++) {
          const expected = new Three.Vector3().fromBufferAttribute(original.attributes.position, j)
            .add(new Three.Vector3(meta.x, meta.y, meta.z).multiplyScalar(M));
          point.fromBufferAttribute(drawn.geometry.attributes.position, j).applyMatrix4(drawn.matrixWorld);
          restError = Math.max(restError, point.distanceTo(expected));
          normal.fromBufferAttribute(drawn.geometry.attributes.normal, j).applyMatrix3(normals).normalize();
          normalError = Math.max(normalError, normal.distanceTo(new Three.Vector3().fromBufferAttribute(original.attributes.normal, j).normalize()));
        }
        original.dispose();
      }
      const rim = wheel.children[1], samples = [];
      for (let phase = 0; phase < 48; phase++) {
        wheel.rotation.z = phase / 48 * Math.PI * 2; model.group.updateMatrixWorld(true);
        wheel.parent.getWorldQuaternion(quaternion); worldAxis.set(0, 0, 1).applyQuaternion(quaternion);
        wheel.getWorldPosition(center);
        point.fromBufferAttribute(rim.geometry.attributes.position, 0).applyMatrix4(rim.matrixWorld).sub(center);
        samples.push(point.dot(worldAxis));
      }
      rollingWobble = Math.max(rollingWobble, Math.max(...samples) - Math.min(...samples)); wheel.rotation.z = 0;
    }
    const front = model.wheels[0].wheel, rear = model.wheels[1].wheel;
    model.group.updateMatrixWorld(true); const frontAt = front.getWorldPosition(new Three.Vector3());
    api.specialDamage(c, model, { tires: { frontLeft: true }, burnt: false }); model.group.updateMatrixWorld(true);
    const drop = front.getWorldPosition(new Three.Vector3()).sub(frontAt);
    t.assert(front.scale.y === .82 && rear.scale.y === 1 && Math.abs(drop.x) < .003 && Math.abs(drop.y + .8) < .003,
      key + ': puncture/drop escaped the upright front axle frame');
    api.specialDamage(c, model, { tires: {}, burnt: true });
    t.assert(model.wheels.every(w => !w.wheel.children[0].visible && w.wheel.children[1].visible), key + ': burnt tyre/rim visibility wrong');
    api.specialDamage(c, model, { tires: {}, burnt: false });
    t.assert(model.wheels.every(w => w.wheel.children[0].visible && w.wheel.scale.y === 1), key + ': repair failed to restore tyres');
    const contacts = api.contactWheels(c, model);
    t.assert(!contacts[0].driven && contacts[1].driven && contacts[0].x > 0 && contacts[1].x < 0,
      key + ': contact/mud records escaped the source body frame');
    t.assert(model.riderSeat.grips.every((grip, side) => grip.every((v, j) => Math.abs(v - packed.grips[side][j] * M) < 1e-10)),
      key + ': paired contacts lost source measurement or scaled twice');
    const fixedInverse = model.riderGripInverse.clone();
    for (const turn of [-.35, 0, .35]) {
      model.steer.rotation.y = turn; model.group.updateMatrixWorld(true);
      for (const grip of model.riderSeat.grips) {
        const contact = new Three.Vector3(...grip).applyMatrix4(model.riderGripInverse).applyMatrix4(model.steer.matrixWorld);
        t.assert(contact.toArray().every(Number.isFinite), key + ': steering contact is invalid');
      }
    }
    t.assert(model.riderGripInverse.equals(fixedInverse), key + ': steering mutated the cached grip transform');
    const head = model.lamps.find(l => l.kind === 'head');
    if (head) t.assert(head.mesh.parent === (packed.headSteers === false ? model.body : model.steer), key + ': lamp does not follow its source mounting');
    c.damage.lights = { headLeft: false, tailLeft: false }; api.animateMotorbike(c, model, 0);
    t.assert(model.lampOut.every(v => !v), key + ': intact head/tail halos incorrectly masked');
    c.damage.lights = { headLeft: true, tailLeft: false }; api.animateMotorbike(c, model, 0);
    t.assert(model.lampOut[0] && !model.lampOut[1], key + ': broken headlight halo remains visible');
    c.damage.lights = { headLeft: false, tailLeft: true }; api.animateMotorbike(c, model, 0);
    t.assert(!model.lampOut[0] && model.lampOut[1], key + ': broken tail-light halo remains visible');
    c.damage.lights = { headLeft: false, tailLeft: false }; api.animateMotorbike(c, model, 0);
    t.assert(model.lampOut.every(v => !v), key + ': repaired halos remain masked');
    player.car = c; c.speed = 20; c.tyres = { steer: .5, lock: [0, 0], spin: 0 }; api.animateMotorbike(c, model, .1);
    t.assert(front.rotation.z < 0 && rear.rotation.z < 0 && model.steer.rotation.y < 0, key + ': signed rolling/steering failed');
    c.speed = -20; api.animateMotorbike(c, model, .1);
    t.assert(Math.abs(front.rotation.z) < 1e-9 && Math.abs(rear.rotation.z) < 1e-9, key + ': reverse did not unwind wheel roll');
    c.speed = 20; c.tyres.lock = [1, 1]; api.animateMotorbike(c, model, .1);
    t.assert(front.rotation.z === 0 && rear.rotation.z === 0, key + ': locked wheels rolled');
    c.speed = 0; c.spinSpeed = 50; api.animateMotorbike(c, model, .1);
    t.assert(front.rotation.z === 0 && rear.rotation.z < -.1, key + ': rear burnout animated the front wheel');
    for (const chase of [false, true]) {
      player.car = c;
      scope.activeTier = { lodBias: 1 };
      scope.chaseViewActive = chase; scope.viewZoom = camera.zoom = .2;
      api.motoAssetLod(c, model); t.assert(!model.motoLod.isFar, key + ': player switched to low-detail geometry');
      player.car = null; api.motoAssetLod(c, model);
      t.assert(model.motoLod.isFar && model.motoLod.pairs.every(p => p.mesh.geometry === p.far), key + ': far model not selected');
      scope.viewZoom = camera.zoom = 1.15; api.motoAssetLod(c, model);
      t.assert(model.motoLod.isFar, key + ': LOD lost threshold hysteresis');
      scope.viewZoom = camera.zoom = 2; api.motoAssetLod(c, model);
      t.assert(!model.motoLod.isFar && model.motoLod.pairs.every(p => p.mesh.geometry === p.near), key + ': near source geometry not restored');
      scope.viewZoom = camera.zoom = .2; c.damage.marks.push({}); api.motoAssetLod(c, model);
      t.assert(!model.motoLod.isFar, key + ': pinned marks switched triangle order'); c.damage.marks.length = 0;
      scope.activeTier = { lodBias: 1.35 }; scope.viewZoom = camera.zoom = 1.8; api.motoAssetLod(c, model);
      t.assert(model.motoLod.isFar, key + ': LOW preset did not reduce geometry sooner');
      scope.activeTier = { lodBias: .85 }; api.motoAssetLod(c, model);
      t.assert(!model.motoLod.isFar, key + ': ULTRA preset did not preserve close geometry');
    }
    // The ordinary overhead camera must not render the 50k sport model city-wide.
    // Use actual preset biases, independently sampled default zoom, and reset to
    // near through the player case before each NPC check (no inherited hysteresis).
    scope.chaseViewActive = false; scope.viewZoom = 1.15;
    for (const [name, tier] of Object.entries(productionTiers)) {
      scope.activeTier = tier; player.car = c; api.motoAssetLod(c, model);
      t.assert(!model.motoLod.isFar, key + ': ' + name + ' player lost detailed geometry');
      player.car = null; api.motoAssetLod(c, model);
      t.assert(model.motoLod.isFar && model.motoLod.pairs.every(p => p.mesh.geometry === p.far),
        key + ': ' + name + ' default overhead NPC still uses the full-detail mesh');
    }
    const triangles = level => model.motoLod.pairs.reduce((sum, p) => sum + p[level].index.count / 3, 0),
      near = triangles('near'), far = triangles('far');
    t.assert(far < near * .6 && near < 100000, key + ': unbounded or ineffective detail budget');
    stats.push({ type, key, nearLodTriangles: near, farLodTriangles: far, pairs: model.motoLod.pairs.length,
      sourceTriangles: packed.triangles, grips: packed.grips, cachedParts: kit.lodGeometries.size });
  }
  t.assert(restError < .00001 && normalError < .00001 && rollingWobble < .00001,
    'approved rolling rig changed source pose or wobbled: ' + JSON.stringify({ restError, normalError, rollingWobble }));
  t.note(JSON.stringify({ restError, normalError, rollingWobble, models: stats }));
}
