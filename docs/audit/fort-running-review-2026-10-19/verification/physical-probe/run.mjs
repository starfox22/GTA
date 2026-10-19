import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from '../../../tools/browser.mjs';
const file='/workspace/GTA/work/fort-running/candidate.html';
const out=path.dirname(new URL(import.meta.url).pathname);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const report={pass:false,fixture:'Staged Fort Sentinel cleared disguise, actual Playwright keyboard input with named hitchRun simulation stepping. No rendering claim.',htmlSha256:sha(fs.readFileSync(file)),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),flags:'test&norender&seed=1&hold',viewport:[1000,700],steps:[],errors:[]};
if(report.htmlSha256!=='0b5711f566da3db453928e54add1b68e05209ad358ad1ae60c0d316897f85673')throw Error('Frozen candidate SHA mismatch');
const {browser}=await launchBrowser({label:'fort-running-physical-probe'});
const page=await browser.newPage({viewport:{width:1000,height:700}});
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const capture=async label=>{
 const state=await page.evaluate(()=>({status:DeadEndCity.status(),cover:DeadEndCity.fortCover(),military:DeadEndCity.military(),mission:DeadEndCity.missionState(),faults:DeadEndCity.frameFaults(),label:document.getElementById('stealthLabel').textContent,hint:document.getElementById('stealthHint').textContent,fill:document.getElementById('stealthFill').style.width}));
 report.steps.push({label,...state});console.log(label,JSON.stringify({cover:state.cover,status:state.status,label:state.label,hint:state.hint}));return state;
};
const tick=seconds=>page.evaluate(s=>DeadEndCity.hitchRun(s,[],3,false,false),seconds);
const reset=()=>page.evaluate(()=>{DeadEndCity.fortCoverTest('inside');DeadEndCity.viewMode('street');return DeadEndCity.hitchRun(.3,[],3,false,false)});
try{
 await page.goto('file://'+file+'?'+report.flags,{waitUntil:'load',timeout:300000});
 await page.waitForFunction(()=>!!window.DeadEndCity,null,{timeout:300000});
 await page.click('#startBtn');
 await page.waitForFunction(()=>DeadEndCity.status().mode==='play');
 await page.evaluate(()=>{DeadEndCity.holdSimulation(true);DeadEndCity.god(true);DeadEndCity.storyProgress(3,true);DeadEndCity.fortSkip('changed');DeadEndCity.fortCoverTest('inside');DeadEndCity.viewMode('street');DeadEndCity.hitchRun(12,[],3,false,false)});
 const initial=await capture('initial');
 await page.keyboard.down('KeyW');await tick(.5);await page.keyboard.up('KeyW');
 const walk=await capture('physical-W-walk');
 assert(walk.cover.suspicion===0&&!walk.cover.alarmed&&Math.abs(walk.status.y-initial.status.y)>=4,'W failed safe walking');
 await reset();
 await page.keyboard.down('KeyD');await page.keyboard.down('ShiftLeft');await tick(1.6);
 const run=await capture('physical-D-Shift-run');
 assert(run.cover.suspicion>10&&run.cover.suspicion<50&&run.cover.seenBy>0&&run.cover.rate===20&&!run.cover.alarmed,'brief observed run mismatch');
 await page.keyboard.up('ShiftLeft');await tick(1);
 const recovery=await capture('physical-D-walk-recovery');
 assert(recovery.cover.suspicion<=run.cover.suspicion-10&&recovery.cover.seenBy>0&&!recovery.cover.alarmed,'visible walking failed recovery');
 await page.keyboard.up('KeyD');await tick(2);
 const idle=await capture('idle-recovered');assert(idle.cover.suspicion===0&&!idle.cover.alarmed,'standing did not finish recovery');
 await reset();await page.keyboard.down('ShiftLeft');
 for(const [key,opposite]of[['KeyD',null],['KeyA','KeyD'],['KeyD','KeyA']]){
  if(opposite)await page.keyboard.up(opposite);await page.keyboard.down(key);await tick(1.6);
 }
 const grace=await capture('physical-run-4.8s');assert(!grace.cover.alarmed&&grace.cover.suspicion>80&&grace.cover.suspicion<100,'4.8-second warning window mismatch');
 await page.keyboard.up('KeyD');await page.keyboard.down('KeyA');await tick(.5);
 const exposed=await capture('physical-run-5.3s');
 assert(exposed.cover.alarmed&&exposed.cover.blownBy==='running'&&exposed.military.alert,'sustained physical run failed exposure');
 assert(report.errors.length===0,'browser errors');
 report.pass=true;
}catch(e){report.failure=e.stack||e.message;console.error(report.failure);process.exitCode=1;}
finally{
 for(const key of ['KeyW','KeyD','KeyA','ShiftLeft'])await page.keyboard.up(key).catch(()=>{});
 await browser.close();
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pass:report.pass,steps:report.steps.length,errors:report.errors.length,failure:report.failure||null}));
}
