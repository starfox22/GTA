import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root='/workspace/GTA';
const out=path.join(root,'work/aviation-review/qa');
const files=['aircraft-geometry','aircraft-flight-model','aircraft-flight-dynamics','parachute-reserve','aerial-city-horizon'];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const production=fs.readdirSync(root+'/src').filter(f=>/^(aviation-flight|plane3d-|aircraft-assets3d|parachute|controls|game-player-actions|chase-view3d|aerial-haze3d|lighting3d-look|render3d-frame|render3d-statics)/.test(f)).map(f=>'src/'+f);
const before=Object.fromEntries(production.map(f=>[f,hash(root+'/'+f)]));
const report={kind:'Independent targeted production-host review; standard t.near(value,lo,hi,label) contract; no browser, build, rendering or FPS claim',startedAt:new Date().toISOString(),sourceHashes:before,tests:[]};
for(const name of files){
 const f=root+'/tools/tests/'+name+'.mjs', record={name,sha256:hash(f),assertions:0,notes:[],failures:[]};
 const check=(ok,msg)=>{record.assertions++;if(!ok)throw Error(msg)};
 const t={assert:check,near:(v,lo,hi,label)=>check(typeof v==='number'&&v>=lo&&v<=hi,`${label}: ${v} not in [${lo}, ${hi}]`),note:x=>record.notes.push(x),finite:(value,label)=>check(!JSON.stringify(value).match(/NaN|Infinity/),label+' nonfinite')};
 try{await (await import(pathToFileURL(f))).default(t);record.pass=true;}catch(e){record.pass=false;record.failures.push(e.stack||e.message);}
 report.tests.push(record);console.log(name,record.pass?'PASS':'FAIL',record.assertions,record.failures[0]||'');
}
report.finishedAt=new Date().toISOString();report.sourceChangedDuringRun=production.filter(f=>hash(root+'/'+f)!==before[f]);report.pass=report.tests.every(t=>t.pass)&&!report.sourceChangedDuringRun.length;report.assertions=report.tests.reduce((n,t)=>n+t.assertions,0);fs.writeFileSync(out+'/host-review.json',JSON.stringify(report,null,2)+'\n');
if(!report.pass)process.exitCode=1;
