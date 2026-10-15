// Read-only production-consumer comparison on identical real Three.js camera poses; no browser/WebGL.
// node THIS_FILE IMMUTABLE_BASELINE_ROOT
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { cabinDistanceFixture, cabinGlassDistance } from '../../../../tools/tests/car-cabin-view-distance.mjs';
const Three = createRequire(import.meta.url)('../../../../vendor/three.r160.js'),
  baseline = path.resolve(process.argv[2]), current = path.resolve(new URL('../../../..', import.meta.url).pathname),
  read = (root, name) => fs.readFileSync(path.join(root, 'src', name), 'utf8'),
  queueSource = read(baseline, 'crowd3d-driveby.js'), glassSource = read(baseline, 'cars3d-interior.js'),
  oldGlass = new Function('Three', 'CAR_M', 'cityMaterialPatch',
    glassSource.slice(glassSource.indexOf('      const CAR_GLASS_CLEAR')) + '\nreturn carGlassMaterial;')(Three, 8, () => {}),
  hash = value => crypto.createHash('sha256').update(value).digest('hex'),
  tint = d => { const x = Math.min(1, Math.max(0, (d - 192) / 96)); return 0.35 + 0.57 * x * x * (3 - 2 * x); },
  report = { kind: 'actual archived occupant queue/glass patch versus changed consumers, same physical camera',
    qualification: 'CPU Three.js only. Both sides use the unchanged current physical street-camera placement; the old queue and glass patch are loaded verbatim from the immutable baseline. This does not compile GLSL or render occupants.',
    baselineSources: {}, currentSources: {}, cases: [] };
for (const name of ['crowd3d-driveby.js', 'cars3d-interior.js', 'flight-view3d.js', 'render3d-frame.js']) {
  report.baselineSources[name] = hash(read(baseline, name)); report.currentSources[name] = hash(read(current, name));
}
for (const [label, zoom, inspect] of [
  ['ordinary close street', 11, null],
  ['inspection yaw65 pitch12', 11, { yaw: 65 * Math.PI / 180, pitch: 12 * Math.PI / 180, lift: 4 }],
  ['street near cutoff', 3, null], ['distant street', 0.64, null],
]) {
  const point = new Three.Vector3(418, 32, 7300), before = cabinDistanceFixture({ zoom, inspect, queueSource }),
    after = cabinDistanceFixture({ zoom, inspect }), material = oldGlass('#8899aa', 0.35),
    oldShader = { uniforms: {}, fragmentShader: Three.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(oldShader); material.dispose();
  const entry = { label, zoom, inspect, physicalCamera: after.scope.camera.position.toArray(),
    virtualEye: after.api.carViewEye.toArray(), setbackM: after.api.carViewSetBack.value / 8, before: {}, after: {} };
  for (const [side, fixture, shader] of [['before', before, oldShader], ['after', after, after.compileGlass()]]) {
    fixture.queueAt(point);
    const distance = cabinGlassDistance(shader, fixture.scope.camera, point);
    entry[side] = { queuedCars: fixture.api.queued().length, glassDistanceM: distance / 8, tint: tint(distance) };
  }
  report.cases.push(entry);
}
console.log(JSON.stringify(report, null, 2));
