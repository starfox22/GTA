// CPU-only production Apache source kit/rig/PBR/LOD and exact ray parity receipt.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import check from './tests/apache-assets.mjs';
let assertions = 0; const evidence = [];
await check({ assert(ok, message) { assertions++; if (!ok) throw Error(message); }, note(value) { evidence.push(JSON.parse(value)); } });
const inputs = Object.fromEntries(['src/apache-assets3d.js','src/apache3d.js','tools/apache_model.py','tools/tests/apache-assets.mjs','assets/apache-model.bin']
  .map(name => [name, createHash('sha256').update(fs.readFileSync(new URL('../' + name, import.meta.url))).digest('hex')])),
  record = { passed: true, assertions, evidence, inputs }, at = process.argv.indexOf('--out');
if (at >= 0) { const out = path.resolve(process.argv[at + 1]); fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out,'apache-assets-host-proof.json'), JSON.stringify(record,null,2)+'\n'); }
console.log(JSON.stringify(record, null, 2));
