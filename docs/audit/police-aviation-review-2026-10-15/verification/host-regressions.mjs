// Run actual production-function tests without booting a browser. From repository root:
// node docs/audit/police-aviation-review-2026-10-15/verification/host-regressions.mjs OUTPUT.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(new URL('../../../../',import.meta.url).pathname), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={runnerSha256:hash(fs.readFileSync(new URL(import.meta.url))),kind:'host production functions on real Three.js; no GPU/browser',node:process.versions.node,inputs:{},results:[],pass:true};
for(const dir of ['src','assets']) for(const name of fs.readdirSync(path.join(root,dir)).sort()) {
 const p=path.join(root,dir,name);if(fs.statSync(p).isFile())report.inputs[dir+'/'+name]=hash(fs.readFileSync(p));
}
const names=['police-livery-projection','approved-suv-rigs','vehicle-source-fidelity','approved-motorcycle-rigs','sports-vehicle-assets',
 'hotrod-vehicle-assets','hotrod-vehicle-rig','jet-assets-rig','jet-assets-lifecycle','aircraft-audio','aircraft-propeller-sync','aircraft-flight-model','terrain-rock-contact','car-cabin-view-distance'];
for(const name of names) {
 const test=path.join(root,'tools/tests',name+'.mjs'), row={name,testSha256:hash(fs.readFileSync(test)),assertions:0,notes:[]}, start=performance.now();
 const t={assert(ok,message){row.assertions++;if(!ok)throw Error(message);},note(m){row.notes.push(m);},
 near(v,lo,hi,label){this.assert(typeof v==='number'&&v>=lo&&v<=hi,`${label}: ${v} outside [${lo},${hi}]`);},
 finite(o,label){const walk=v=>typeof v==='number'?Number.isFinite(v):v&&typeof v==='object'?Object.values(v).every(walk):true;this.assert(walk(o),label);}};
 try {await (await import(pathToFileURL(test))).default(t);row.pass=true;}catch(e){row.pass=false;row.error=e.stack||String(e);report.pass=false;}
 row.ms=performance.now()-start;report.results.push(row);console.log(row.pass?'PASS':'FAIL',name,row.assertions,row.ms.toFixed(0)+'ms');
 fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
}
if(!report.pass)process.exitCode=1;
