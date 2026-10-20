// CPU-only FX footprint/filter support and visual-pool invariants.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import check from './tests/fx-footprint.mjs';
let assertions=0;const evidence=[];
check({assert(ok,message){assertions++;if(!ok)throw Error(message);},note(value){evidence.push(JSON.parse(value));}});
const inputs=Object.fromEntries(['src/fx3d-atlas.js','src/fx3d-particles.js','tools/tests/fx-footprint.mjs'].map(name=>[name,createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex')])),
  record={passed:true,assertions,evidence,inputs},at=process.argv.indexOf('--out');
if(at>=0){const out=path.resolve(process.argv[at+1]);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'fx-footprint-host-proof.json'),JSON.stringify(record,null,2)+'\n');}
console.log(JSON.stringify(record,null,2));
