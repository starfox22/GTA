// Replay the successful ordinary mission 2 input trace on an already fresh, seeded/held dev page.
// From repository root: node PATH/m2-replay.mjs [PATH/m2-inputs.json]. DEC_EXPERIENCE_PORT optionally selects another dev server.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {request}=await import(pathToFileURL(path.join(process.env.DEC_GAME_ROOT||process.cwd(),'tools/dev.mjs'))),
 file=process.argv[2]||new URL('./m2-inputs.json',import.meta.url), data=fs.readFileSync(file),steps=JSON.parse(data),
 options=process.env.DEC_EXPERIENCE_PORT?{port:Number(process.env.DEC_EXPERIENCE_PORT)}:{};
for(let i=0;i<steps.length;i++){
 const q=steps[i];
 if(!['keys','wait'].includes(q.op)&&!(q.op==='call'&&['holdSimulation','god','storyProgress'].includes(q.method)))throw Error('Unexpected mutating step '+JSON.stringify(q));
 const r=await request(q,options);if(r.error||r.newErrors)throw Error(JSON.stringify({i,q,r}));
 if(i%100===0)console.log('input',i,'/',steps.length);
}
const outcome=(await request({op:'call',method:'missionState',args:[]},options)).result,
 status=(await request({op:'call',method:'status',args:[]},options)).result,
 faults=(await request({op:'call',method:'frameFaults',args:[]},options)).result,
 errors=(await request({op:'errors'},options)).result;
console.log(JSON.stringify({pass:outcome.last?.result==='won'&&outcome.last?.index===1&&status.hp===100&&status.wanted===0&&faults.count===0&&!errors?.length,
 inputSha256:crypto.createHash('sha256').update(data).digest('hex'),inputs:steps.length,outcome,status,faults,errors},null,2));
if(outcome.last?.result!=='won'||outcome.last?.index!==1||faults.count||errors?.length)process.exitCode=1;
