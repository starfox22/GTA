// Actual packed HMMWV wheels and production partition helper: exact triangle conservation,
// unchanged rest pose/normals/UVs, corrected axle circles and 48-phase orbit elimination.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

export default async function (t) {
  const Three = createRequire(import.meta.url)('../../vendor/three.r160.js'),
    read = name => fs.readFileSync(new URL('../../src/' + name, import.meta.url), 'utf8'),
    bytes = fs.readFileSync(new URL('../../assets/vehicle-models.bin', import.meta.url)),
    length = bytes.readUInt32LE(8), header = JSON.parse(bytes.subarray(12, 12 + length)), base = 12 + length,
    types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array }, arrays = {};
  for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
    const raw = bytes.subarray(base + offset, base + offset + count * types[type].BYTES_PER_ELEMENT);
    arrays[name] = new types[type](Uint8Array.from(raw).buffer);
  }
  const shared = new Set(), scope = vm.createContext({ Three, sharedGeometries: shared }),
    api = vm.runInContext(read('vehicle-assets3d.js') + read('military-asset-wheels3d.js') +
      String.fromCharCode(10) + '({ vaGeometry, militaryAssetWheelPartition })', scope),
    model = header.models.army_jeep, data = { header, arrays }, k = 8, rows = [];
  let restError = 0, sourceTriangles = 0, rollingTriangles = 0, fixedTriangles = 0;
  for (let i = 0; i < model.wheels.length; i++) {
    const wh = model.wheels[i], input = api.vaGeometry(model, data, `wheel${i}.tyre`, k),
      before = Array.from(input.attributes.position.array), normals = Array.from(input.attributes.normal.array),
      uv = Array.from(input.attributes.uv.array), oldIndex = Array.from(input.index.array),
      result = api.militaryAssetWheelPartition(input, wh, k, 'army_jeep');
    t.assert(result.calibrated && result.ringTriangles === 476 && result.rollingTriangles === 532,
      `wheel ${i}: genuine tyre/rim and coaxial hub pieces not identified: ${JSON.stringify(result)}`);
    t.assert(!shared.has(input) && shared.has(result.wheel) && shared.has(result.fixed), 'obsolete full input wheel retained or compact subsets omitted');
    t.assert(result.sourceTriangles === result.rollingTriangles + result.fixedTriangles, 'source triangle count changed');
    const seen = new Set();
    for (const [part, at] of [[result.wheel, result.at], [result.fixed, [0, 0, 0]]]) {
      t.assert(part && part.userData.sourceTriangles.length === part.index.count / 3, 'subset source provenance missing');
      for (let triangle = 0; triangle < part.index.count / 3; triangle++) {
        const sourceTriangle = part.userData.sourceTriangles[triangle];
        t.assert(!seen.has(sourceTriangle), 'source triangle duplicated between rolling and fixed parts'); seen.add(sourceTriangle);
        for (let corner = 0; corner < 3; corner++) {
          const old = oldIndex[sourceTriangle * 3 + corner], next = part.index.getX(triangle * 3 + corner);
          for (let axis = 0; axis < 3; axis++) {
            const position = part.attributes.position.array[next * 3 + axis] + at[axis],
              expected = before[old * 3 + axis] + [wh.x, wh.y, wh.z][axis] * k;
            restError = Math.max(restError, Math.abs(position - expected));
            t.assert(part.attributes.normal.array[next * 3 + axis] === normals[old * 3 + axis], 'source normal changed');
          }
          t.assert(part.attributes.uv.array[next * 2] === uv[old * 2] && part.attributes.uv.array[next * 2 + 1] === uv[old * 2 + 1], 'source atlas UV changed');
        }
      }
    }
    t.assert(seen.size === oldIndex.length / 3, 'source triangle deleted');
    const sourceCenter = new Three.Vector3(...result.sourceCenter), corrected = [], previous = [];
    const fixedBefore = Array.from(result.fixed.attributes.position.array);
    for (let phase = 0; phase < 48; phase++) {
      const angle = phase * Math.PI * 2 / 48,
        actual = new Three.Vector3().applyAxisAngle(new Three.Vector3(0, 0, 1), angle).add(new Three.Vector3(...result.at)),
        old = sourceCenter.clone().applyAxisAngle(new Three.Vector3(0, 0, 1), angle).add(new Three.Vector3(wh.x, wh.y, wh.z).multiplyScalar(k));
      corrected.push(actual.toArray()); previous.push(old.toArray());
      t.assert(JSON.stringify(Array.from(result.fixed.attributes.position.array)) === JSON.stringify(fixedBefore), 'fixed running gear moved with wheel phase');
    }
    const span = samples => Math.max(...[0, 1].map(axis => Math.max(...samples.map(p => p[axis])) - Math.min(...samples.map(p => p[axis])))),
      oldOrbit = span(previous) / k, newOrbit = span(corrected) / k;
    t.assert(newOrbit === 0, 'corrected source circle still orbits axle');
    t.assert(Math.abs(result.r / k - .43415) < .0002, 'true HMMWV wheel radius not recovered');
    if (i > 1) t.assert(oldOrbit > .7, 'rear-wheel 35 cm axle error not reproduced');
    if (i === 1) t.assert(oldOrbit > .22, 'front-left 11 cm axle error not reproduced');
    rows.push({ wheel: i, at: result.at.map(v => v / k), radius: result.r / k, sourceTriangles: result.sourceTriangles,
      rollingTriangles: result.rollingTriangles, fixedTriangles: result.fixedTriangles, sourceCenterM: result.sourceCenter.map(v => v / k),
      previousCircleOrbitM: oldOrbit, correctedCircleOrbitM: newOrbit });
    sourceTriangles += result.sourceTriangles; rollingTriangles += result.rollingTriangles; fixedTriangles += result.fixedTriangles;
  }
  t.assert(restError < .000002, 'rest geometry moved: ' + restError + ' units');
  t.assert(Math.abs(rows[0].at[0] - rows[1].at[0]) < .0001 && Math.abs(rows[2].at[0] - rows[3].at[0]) < .0001, 'source axle pairs remain misaligned');
  // Other types and uncertain new layouts must retain the authoritative original without touching the warm set.
  const fallback = api.vaGeometry(model, data, 'wheel0.tyre', k), original = Array.from(fallback.attributes.position.array),
    kept = api.militaryAssetWheelPartition(fallback, model.wheels[0], k, 'army_truck');
  t.assert(!kept.calibrated && kept.wheel === fallback && !kept.fixed && shared.has(fallback), 'other model fallback changed');
  const uncertain = new Three.BoxGeometry(1, 2, 1); shared.add(uncertain);
  const rejected = api.militaryAssetWheelPartition(uncertain, model.wheels[0], k, 'army_jeep');
  t.assert(!rejected.calibrated && rejected.wheel === uncertain && shared.has(uncertain), 'uncertain geometry did not fail open');
  t.assert(JSON.stringify(original) === JSON.stringify(Array.from(fallback.attributes.position.array)), 'fallback geometry mutated');
  t.note(`${sourceTriangles} source triangles = ${rollingTriangles} rolling + ${fixedTriangles} fixed; rest max error ${restError.toExponential(3)}u; all source normals/UVs exact; 48 spin phases per wheel; ${JSON.stringify(rows)}`);
}
