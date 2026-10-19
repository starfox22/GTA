// Production Three.js aircraft skins, engine enclosure and downloaded control pivots; no GPU needed.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = (name, overrides) => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');

function signedVolume(geometry) {
  const p = geometry.attributes.position, index = geometry.index,
    a = new Three.Vector3(), b = a.clone(), c = a.clone();
  let volume = 0;
  for (let k = 0; k < index.count; k += 3) {
    a.fromBufferAttribute(p, index.getX(k)); b.fromBufferAttribute(p, index.getX(k + 1)); c.fromBufferAttribute(p, index.getX(k + 2));
    volume += a.dot(b.cross(c)) / 6;
  }
  return volume;
}

export default function (t, overrides = {}) {
  const scope = vm.createContext({ Three, TAU: Math.PI * 2, UNITS_PER_METRE: 8,
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)) }),
    api = vm.runInContext(read('plane3d-shapes', overrides) + '\n' + read('plane3d-build', overrides) +
      '\n({aircraftPlans,fuselageShape,fuselageMesh,liftingSurface,aircraftBatch,turbofan})', scope),
    front = new Three.MeshStandardMaterial({ side: Three.FrontSide }),
    double = new Three.MeshStandardMaterial({ side: Three.DoubleSide }),
    ray = new Three.Raycaster(), records = { fuselages: {}, engines: {}, controls: {} };
  function entrance(geometry, origin, direction, label) {
    ray.set(origin, direction.normalize());
    const a = new Three.Mesh(geometry, front), b = new Three.Mesh(geometry, double);
    a.updateMatrixWorld(true); b.updateMatrixWorld(true);
    const outside = ray.intersectObject(a, false)[0], reference = ray.intersectObject(b, false)[0];
    t.assert(!!reference && !!outside && Math.abs(reference.distance - outside.distance) < 0.001,
      label + ': opaque exterior entrance is visible with FrontSide paint');
  }
  for (const [kind, plan] of Object.entries(api.aircraftPlans())) {
    const shape = api.fuselageShape(plan), geometry = api.fuselageMesh(shape), volume = signedVolume(geometry);
    t.assert(volume > 1000, kind + ': closed fuselage has outward winding');
    let rays = 0;
    // All quadrants along the whole loft, including belly and shallow nose/tail.
    for (const f of [0.025, 0.12, 0.3, 0.5, 0.7, 0.88, 0.975]) {
      const x = shape.front + (shape.tail - shape.front) * f, sec = shape.section(x), centre = new Three.Vector3(x, sec.mid, 0);
      for (let j = 0; j < 16; j++) {
        const angle = (j + 0.37) * Math.PI * 2 / 16,
          offset = new Three.Vector3(0, Math.cos(angle), Math.sin(angle)).multiplyScalar(100);
        entrance(geometry, centre.clone().add(offset), offset.clone().negate(), kind + ' section ' + f + ' angle ' + j); rays++;
      }
    }
    for (const [x, sign] of [[shape.front, 1], [shape.tail, -1]]) {
      const sec = shape.section(x);
      entrance(geometry, new Three.Vector3(x + sign * 50, sec.mid, 0), new Three.Vector3(-sign, 0, 0), kind + ' end cap'); rays++;
    }
    records.fuselages[kind] = { outwardVolume: volume, exteriorEntranceRays: rays };
  }
  for (const side of [-1, 1]) {
    const wing = api.liftingSurface({ rootLE: 10, tipLE: 8, rootChord: 20, tipChord: 8, thickness: .15,
      mirror: side < 0, place: (x, thick, f) => [x, thick + f, side * f * 50] });
    for (const [f0, f1, c0, c1] of [[0, 1, 0, 1], [.1, .6, .73, 1], [.62, .94, .73, 1]]) {
      const geometry = wing.part(f0, f1, c0, c1);
      t.assert(signedVolume(geometry) > 0, 'mirrored wing/control is outward and closed: ' + [side, f0, c0]);
    }
  }
  const fin = api.liftingSurface({ rootLE: -30, tipLE: -42, rootChord: 17, tipChord: 9,
    thickness: .11, mirror: true, place: (x, thick, f) => [x, 18 + f * 17, thick] });
  t.assert(signedVolume(fin.part(0, 1)) > 0, 'fin placement retains correct outward winding');

  for (const R of [5, 8]) {
    const body = new Three.Group(), batch = api.aircraftBatch(), fans = [], len = R * 4;
    api.turbofan(batch, body, { x: 0, y: 0, z: 0, r: R, len }, front, front, front, front, fans);
    batch.flush(body, 'engine enclosure'); body.updateMatrixWorld(true);
    const enclosure = body.children.find(o => o.name === 'engine enclosure'),
      p = enclosure.geometry.attributes.position, n = enclosure.geometry.attributes.normal;
    let outward = 0, inward = 0;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k), radial = Math.hypot(y, z);
      // Mid cowl stations exclude the lip and intentionally inward inlet liner.
      if (radial > R * .95 && x > -len * .25 && x < len * .2) {
        const dot = (y * n.getY(k) + z * n.getZ(k)) / radial;
        if (dot > .1) outward++; else if (dot < -.1) inward++;
      }
    }
    t.assert(outward > 20 && inward === 0, 'nacelle exterior normals face outward, radius ' + R);
    entrance(enclosure.geometry, new Three.Vector3(0, R * 3, 0), new Three.Vector3(0, -1, 0), 'nacelle top radius ' + R);
    // Across the fan annulus, every front and rear sightline meets an opaque
    // engine wall. No dependency on blade pose or double-sided exterior paint.
    let opaqueSightlines = 0;
    for (const side of [-1, 1]) for (let k = 0; k < 24; k++) {
      const angle = (k + .27) * Math.PI * 2 / 24,
        origin = new Three.Vector3(side * len, Math.cos(angle) * R * .7, Math.sin(angle) * R * .7);
      ray.set(origin, new Three.Vector3(-side, 0, 0));
      const hit = ray.intersectObject(body, true)[0];
      const opaque = !!hit && hit.distance < len * 1.1;
      if (opaque) opaqueSightlines++;
      t.assert(opaque, 'engine is opaque through annulus: ' + [R, side, k]);
    }
    t.assert(fans.length === 1 && fans[0].children.length === 1 && fans[0].children[0].isMesh,
      'all 28 swept blades and hub share one animated fan draw');
    t.assert(signedVolume(fans[0].children[0].geometry) > 0, 'swept fan geometry faces outward');
    records.engines[R] = { outwardCowlNormals: outward, inwardCowlNormals: inward, opaqueSightlines,
      fanDraws: fans[0].children.filter(o => o.isMesh).length };
  }

  const pack = fs.readFileSync(new URL('../../assets/aircraft-models.bin', import.meta.url)),
    vehicle = read('vehicle-assets3d', overrides), start = vehicle.indexOf('      function vaGeometry('),
    end = vehicle.indexOf('      function vaJoin(', start),
    assetScope = vm.createContext({ Three, console, DataView, TextDecoder, Uint8Array, Int8Array, Uint16Array, Int16Array, Float32Array,
      UNITS_PER_METRE: 8, sharedGeometries: new Set(), sharedMaterials: new Set(),
      atob: value => Buffer.from(value, 'base64').toString('binary'),
      ASSETS: { aircraftModels: 'data:application/octet-stream;base64,' + pack.toString('base64') } }),
    assets = vm.runInContext(vehicle.slice(start, end) + '\n' + read('aircraft-assets3d', overrides) +
      '\n({acPlaneKit,acData})', assetScope), kit = assets.acPlaneKit('skyhawk'), data = assets.acData();
  t.assert(kit.model.triangles === 9694, 'downloaded Skylark source triangle budget remains unchanged');
  for (const [name, hinge] of Object.entries(kit.hinges || kit.model.hinges)) {
    const axis = new Three.Vector3().fromArray(hinge.b).sub(new Three.Vector3().fromArray(hinge.a)), length = axis.length();
    axis.normalize();
    t.assert(length > (name === 'rudder' ? 1 : 1.5), name + ': hinge spans its source control surface');
    t.assert(name === 'rudder' ? axis.y > .85 : axis.z > .98, name + ': hinge follows real vertical/spanwise edge');
    const p = kit.parts[name].attributes.position, q = data.arrays['skyhawk.' + name + '.p'], quant = kit.model.quant;
    let maximumError = 0;
    for (let k = 0; k < p.count; k++) for (let c = 0; c < 3; c++) {
      const expected = ((q[k * 3 + c] + 32767) / 65534 * quant[c + 3] + quant[c]) * 8,
        actual = p.array[k * 3 + c] + hinge.a[c] * 8;
      maximumError = Math.max(maximumError, Math.abs(actual - expected));
    }
    t.assert(maximumError < .00002, name + ': corrected pivot preserves every neutral source position');
    records.controls[name] = { lengthMetres: length, axis: axis.toArray(), maximumNeutralErrorUnits: maximumError };
  }
  t.note(JSON.stringify(records));
}
