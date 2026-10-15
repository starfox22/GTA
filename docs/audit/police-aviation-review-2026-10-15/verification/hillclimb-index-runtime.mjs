import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {start,request}from'/workspace/GTA/tools/dev.mjs';
import hill from '/workspace/GTA/tools/tests/hillclimb-physics.mjs';
import falls from '/workspace/GTA/tools/tests/falls.mjs';
const html='/workspace/GTA/dist/review16/hillclimb-index-candidate.html',out='/workspace/GTA/dist/review16/hillclimb-index-runtime.json',
 report={html,htmlSha256:crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),calls:[],notes:[],assertions:0};
const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2));
const op=async args=>{const r=await request(args,{timeoutMs:240000});if(r.error)throw Error(r.error);return r.result;};
const t={
 async call(method,...args){const r=await op({op:'call',method,args});report.calls.push({method,args,result:r});save();return r;},
 wait:seconds=>op({op:'wait',seconds}),
 assert(value,message){report.assertions++;assert.ok(value,message);},
 finite(obj,label){const walk=v=>{assert.ok(v!=='NaN'&&v!=='Infinity'&&v!=='-Infinity'&&(typeof v!=='number'||Number.isFinite(v)),label);if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);};walk(obj);},
 note(text){report.notes.push(text);console.log(text);save();},
};
try{
 await start({html,seed:1,quiet:true});
 await hill(t);report.hillPass=true;save();console.log('PASS unchanged hillclimb-physics');
 await op({op:'reload',keep:false});
 for(;;){const s=await op({op:'status'});if(s.state==='ready')break;if(s.state==='failed')throw Error(s.error);await new Promise(r=>setTimeout(r,500));}
 await falls(t);report.fallsPass=true;save();console.log('PASS unchanged falls');
}catch(e){report.failure=e.stack||String(e);process.exitCode=1;console.log(report.failure);}finally{save();await op({op:'stop'}).catch(()=>{});}
