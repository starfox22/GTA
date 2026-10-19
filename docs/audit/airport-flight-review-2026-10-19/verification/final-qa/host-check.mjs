import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL}from'node:url';
const root='/workspace/GTA',out=root+'/work/aviation-review/final-qa';
const modules=process.argv.slice(2);const files=['src/geography-regions.js','src/airport-terminal3d.js','src/chase-camera.js','src/parachute.js','src/parachute3d-canopy.js','src/parachute3d-pose.js','src/parachute3d-rigging.js','src/parachute3d-cutaway.js'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const before=Object.fromEntries(files.map(p=>[p,sha(root+'/'+p)]));
const report={kind:'Independent focused production-host review; actual t.near(value,lo,hi) contract; no native rendering or hardware FPS claim',startedAt:new Date().toISOString(),sourceHashes:before,tests:[]};
for(const name of modules){const p=root+'/tools/tests/'+name+'.mjs',r={name,sha256:sha(p),assertions:0,notes:[]};const check=(ok,message)=>{r.assertions++;if(!ok)throw Error(message)};const t={assert:check,near:(v,lo,hi,label)=>check(typeof v==='number'&&v>=lo&&v<=hi,`${label}: ${v} not in [${lo},${hi}]`),note:v=>r.notes.push(v)};try{await(await import(pathToFileURL(p))).default(t);r.pass=true}catch(e){r.pass=false;r.failure=e.stack||e.message}report.tests.push(r);console.log(r.name,r.pass?'PASS':'FAIL',r.assertions,r.failure||'')}
report.finishedAt=new Date().toISOString();report.assertions=report.tests.reduce((n,t)=>n+t.assertions,0);report.sourceChangedDuringRun=files.filter(p=>sha(root+'/'+p)!==before[p]);report.pass=report.tests.every(t=>t.pass)&&!report.sourceChangedDuringRun.length;const name=modules.includes('parachute-camera')?'host-final':'host-airport';fs.writeFileSync(out+'/'+name+'.json',JSON.stringify(report,null,2)+'\n');if(!report.pass)process.exitCode=1;
