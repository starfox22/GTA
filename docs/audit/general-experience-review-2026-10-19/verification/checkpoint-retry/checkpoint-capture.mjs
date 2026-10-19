// Targeted retry of the final staged checkpoint PNG after a software-GL readback timeout.
// Every standard packaged smoke/input/credits check already ran; do not relabel this as a replay.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {launchBrowser} from '../../tools/browser.mjs';
const [input,directory]=process.argv.slice(2);if(!input||!directory)throw Error('HTML and output required');
const html=path.resolve(input),out=path.resolve(directory),hash=b=>crypto.createHash('sha256').update(b).digest('hex');fs.mkdirSync(out,{recursive:true});
const recorder=fs.readFileSync(new URL(import.meta.url));const report={category:'staged checkpoint inspection, targeted PNG retry; not a mission win',started:new Date().toISOString(),htmlSha256:hash(fs.readFileSync(html)),recorderSha256:hash(recorder),viewport:[1000,700],urlFlags:'?test&seed=1&hold&shadercheck',inputs:[],captures:[],errors:[],warnings:[]};
const save=()=>fs.writeFileSync(path.join(out,'checkpoint.json'),JSON.stringify(report,null,2)+'\n');
const {browser}=await launchBrowser({label:'packaged-checkpoint-capture',args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(600000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
const assert=(ok,message)=>{if(!ok)throw Error(message)};
try{
 await page.goto('file://'+html+report.urlFlags,{waitUntil:'domcontentloaded',timeout:600000});await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');
 await page.click('#startBtn');await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
 const inputs=[['holdSimulation',[true]],['god',[true]],['settings',[{sound:false,fps:false}]],['storyProgress',[3,true]],['fortSkip',['changed']],['teleport',[9236,8182]],['setClock',[14]],['sky',['clear']],['wetness',[0]],['viewMode',['chase']],['inspectView',[]],['chaseLook',[0,0,0,6]],['graphics',['high']],['hitchRun',[.6,[],3,false,false]],['hitchRun',[1/60,[],3,false,true]]];
 report.inputs=inputs;save();await page.evaluate(rows=>{for(const[m,a]of rows)window.DeadEndCity[m](...a)},inputs);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 report.state=await page.evaluate(()=>({status:DeadEndCity.status(),quality:DeadEndCity.graphics(),job:DeadEndCity.fortJob(),card:DeadEndCity.missionCard(),gpu:DeadEndCity.gpuContext(),faults:DeadEndCity.frameFaults(),overlaps:DeadEndCity.hudOverlaps(),prompt:DeadEndCity.promptState(),camera:DeadEndCity.chaseCamera(),draw:DeadEndCity.drawProfile(3),dom:Object.fromEntries(['storyLine','quickKeys','minimapBox','hudLocation','navigation','interaction'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return[id,{text:e.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},opacity:getComputedStyle(e).opacity}]}))}));save();
 const s=report.state;assert(s.status.renderer==='3d'&&s.quality.tier==='HIGH'&&s.camera.mode==='chase'&&s.draw.total>0,'Final chase checkpoint fixture failed');
 assert(!s.gpu.lost&&!s.gpu.losses&&!s.faults.count&&!report.errors.length,'Final checkpoint renderer unhealthy');assert(s.dom.storyLine.text.includes('Sir, ID, please.')&&!s.dom.storyLine.text.includes('Evening'),'Neutral gate greeting missing');assert(!s.overlaps.overlaps.some(p=>p.includes('storyLine')||(p.includes('hudLocation')&&p.includes('navigation'))),'Final checkpoint HUD overlap '+JSON.stringify(s.overlaps.overlaps));
 const file='09-checkpoint-chase-high.png';console.log('Checkpoint state passed; saving native PNG with600second readback budget');await page.screenshot({path:path.join(out,file),timeout:600000});report.captures.push({file,sha256:hash(fs.readFileSync(path.join(out,file))),viewport:report.viewport});report.pass=true;console.log('PASS final checkpoint capture');
}catch(e){report.pass=false;report.failure=e.stack||String(e);console.error(report.failure);process.exitCode=1;}
finally{report.completed=new Date().toISOString();save();fs.writeFileSync(path.join(out,'checkpoint-capture.mjs'),recorder);await browser.close();}
