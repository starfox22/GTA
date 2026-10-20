// Reproduce exact-geometry and cooperative-slice evidence without a browser, renderer or GPU.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { carBloodFitAudit } from './tests/carblood-fit-slices.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let assertions = 0;
const result = carBloodFitAudit({ assert(ok, message) { assertions++; if (!ok) throw Error(message); } }),
  files = ['src/carblood3d-fit.js', 'src/vehicle-assets3d.js', 'src/approved-vehicle-assets3d.js', 'src/military-assets3d.js',
    'src/military-asset-wheels3d.js', 'src/military-mark-rays3d.js', 'src/damage-vehicles.js', 'src/damage3d-marks.js',
    'src/damage3d-decals.js', 'src/cars3d-materials.js', 'assets/vehicle-models.bin', 'vendor/three.r160.js',
    'tools/m4-marks-bench.mjs', 'tools/tests/carblood-fit-slices.mjs', 'tools/carblood-fit-host-check.mjs'],
  inputs = Object.fromEntries(files.map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')])),
  report = { passed: true, assertions, ...result, inputs,
    method: 'CPU-only production fitting and real Three/model builder; deterministic attribute-byte and operation-count assertions, no wall-time/FPS claim' },
  outAt = process.argv.indexOf('--out');
if (outAt >= 0) {
  const out = path.resolve(process.argv[outAt + 1]); fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: true, assertions, out }));
} else console.log(JSON.stringify(report, null, 2));
