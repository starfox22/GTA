// Reproduce the licensed hotrod's CPU-only production builder/fit/door receipts. No browser or GPU.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assets from './tests/hotrod-vehicle-assets.mjs';
import rig from './tests/hotrod-vehicle-rig.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  evidence = [], t = {
    assert(ok, message) { assertions++; if (!ok) throw Error(message); },
    note(value) { try { evidence.push(JSON.parse(value)); } catch { evidence.push(value); } },
  };
let assertions = 0;
await assets(t);
await rig(t);
const inputs = Object.fromEntries([
  'src/game-vehicles.js', 'src/hotrod-vehicle-assets3d.js', 'src/vehicle-assets3d.js',
  'src/driveby-seats.js', 'src/damage-vehicles.js', 'src/cars3d-bodies-a.js',
  'src/cars3d-interior.js', 'src/cars3d-headroom.js', 'src/crowd3d-driveby.js', 'src/damage3d-crumple.js',
  'tools/hotrod-vehicle-host-check.mjs', 'tools/tests/hotrod-vehicle-assets.mjs',
  'tools/tests/hotrod-vehicle-rig.mjs', 'assets/hotrod-vehicle-models.bin',
].map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')])),
  report = { assertions, passed: true, evidence, inputs },
  glass = evidence.find(item => item?.gameplayGlassProof).gameplayGlassProof,
  outIndex = process.argv.indexOf('--out');
if (outIndex >= 0) {
  const out = path.resolve(process.argv[outIndex + 1]);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'host-proof.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'gameplay-glass-proof.json'), JSON.stringify({ ...glass, sourceSHA256: inputs['src/damage-vehicles.js'] }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, assertions, out }));
} else console.log(JSON.stringify(report, null, 2));
