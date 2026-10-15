// Independent original-source body samples reject altered normals and missing hero creases.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
const samples = JSON.parse(fs.readFileSync(new URL('../../docs/audit/vehicle-fidelity-2026-10-15/source-normal-fixtures.json', import.meta.url))).samples;

export function verifySourceFidelity(t, pack) {
  const scope = vm.createContext({ Three, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array,
    Float32Array, DataView, TextDecoder, console, atob: value => Buffer.from(value, 'base64').toString('binary'),
    sharedGeometries: new Set(), ASSETS: { approvedVehicleModels: 'data:application/octet-stream;base64,' + pack.toString('base64') } });
  const api = vm.runInContext(read('vehicle-assets3d') + read('approved-vehicle-assets3d') +
    '\n({ approvedVehicleModel, approvedVehicleGeometry })', scope), cache = new Map();
  let maximumAngle = 0;
  for (const sample of samples) {
    const key = sample.model + '.' + sample.part;
    if (!cache.has(key)) cache.set(key, api.approvedVehicleGeometry(api.approvedVehicleModel(sample.model), sample.part, 8));
    const geometry = cache.get(key), positions = geometry.attributes.position, normals = geometry.attributes.normal,
      expected = new Three.Vector3(...sample.normal).normalize();
    let bestDot = -2, found = false;
    for (let i = 0; i < positions.count; i++) {
      if (Math.hypot(positions.getX(i) - sample.position[0] * 8, positions.getY(i) - sample.position[1] * 8,
        positions.getZ(i) - sample.position[2] * 8) > .0012) continue;
      found = true;
      bestDot = Math.max(bestDot, new Three.Vector3(normals.getX(i), normals.getY(i), normals.getZ(i)).normalize().dot(expected));
    }
    t.assert(found, key + ': authored body vertex missing at source ' + sample.sourceVertex);
    if (!found) continue;
    const angle = Math.acos(Math.max(-1, Math.min(1, bestDot))) * 180 / Math.PI;
    maximumAngle = Math.max(maximumAngle, angle);
    t.assert(angle < .05, key + ': authored shading changed by ' + angle.toFixed(4) + ' degrees at source ' + sample.sourceVertex);
  }
  t.note(JSON.stringify({ originalSourceSamples: samples.length, surfaces: cache.size, maximumNormalErrorDegrees: maximumAngle }));
}
export default function (t) {
  verifySourceFidelity(t, fs.readFileSync(new URL('../../assets/approved-vehicle-models.bin', import.meta.url)));
}
