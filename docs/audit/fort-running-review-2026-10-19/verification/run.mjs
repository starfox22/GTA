import fs from 'node:fs';
import crypto from 'node:crypto';
import { checkFortRunningSuspicion } from '../../tools/tests/fort-running-suspicion.mjs';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const output = {fixture:'Production host test; empty dry lane, actual binding translation/gait/moveBody/sight+collision geometry and cover/watch/alarm/HUD logic. No native rendering or browser input claimed.',testSha256:hash(fs.readFileSync(new URL('../../tools/tests/fort-running-suspicion.mjs',import.meta.url))),results:[]};
for (const mode of ['baseline', 'candidate']) {
 const overrides=mode==='candidate'?Object.fromEntries(['fort-cover','fort-cover-watch'].map(name=>[name,fs.readFileSync('/workspace/GTA/src/'+name+'.js','utf8')])):{};
 const files=['game-state','controls','footwork','roofmission-stealth','hud-state','military-base','game-collision','citylife-police','vehicle-trunk','fortjob','fort-cover','fort-cover-watch','fort-cover-records'];
 let assertions=0,failures=[],notes=[];
 const t={assert(ok,message){assertions++;if(!ok)failures.push(message);},note:message=>notes.push(message)};
 try {checkFortRunningSuspicion(t,overrides);} catch(e) {failures.push('FIXTURE ERROR '+e.stack);}
 const result={mode,pass:failures.length===0,assertions,failures,notes,sourceSha256:Object.fromEntries(files.map(name=>[name,hash(overrides[name]??fs.readFileSync(new URL('../../src/'+name+'.js',import.meta.url),'utf8'))]))};
 output.results.push(result);
 console.log(JSON.stringify({mode,pass:result.pass,assertions,failed:failures.length}));
}
fs.writeFileSync(new URL('./host-ab.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
if(!output.results[1].pass)process.exitCode=1;
