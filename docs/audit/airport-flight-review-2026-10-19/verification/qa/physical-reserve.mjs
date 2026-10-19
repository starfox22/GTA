import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from '../../../tools/browser.mjs';
const root='/workspace/GTA',file=root+'/work/aviation-review/candidate-2/game.html',out=root+'/work/aviation-review/qa';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const expected='224b5de6a411c0badd759aff7b8eec25fb0291bff1216ea8adac426025c9be81';
const report={pass:false,kind:'Independent actual DOM keyboard reserve lifecycle on frozen candidate2. Initial named helicopter/position fixture, then real J edges and whole-world held simulation stepping; no rendering/mission-win claim.',htmlSha256:sha(fs.readFileSync(file)),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),flags:'test&norender&seed=1&hold',viewport:[1000,700],startedAt:new Date().toISOString(),inputs:[],states:[],assertions:0,errors:[]};
if(report.htmlSha256!==expected)throw Error('Frozen candidate SHA mismatch');
const {browser}=await launchBrowser({label:'independent-reserve-physical'});let page;
const check=(ok,message)=>{report.assertions++;if(!ok)throw Error(message)};
try{
 page=await browser.newPage({viewport:{width:1000,height:700}});
 page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await page.goto('file://'+file+'?'+report.flags,{waitUntil:'load',timeout:300000});await page.waitForFunction(()=>!!window.DeadEndCity,null,{timeout:300000});await page.click('#startBtn');await page.waitForFunction(()=>DeadEndCity.status().mode==='play');
 const call=async(method,...args)=>{report.inputs.push({kind:'call',method,args});return page.evaluate(({method,args})=>DeadEndCity[method](...args),{method,args});};
 const down=async key=>{report.inputs.push({kind:'DOM-keydown',key});await page.keyboard.down(key)};
 const up=async key=>{report.inputs.push({kind:'DOM-keyup',key});await page.keyboard.up(key)};
 const tick=seconds=>call('hitchRun',seconds,[],3,false,false);
 const capture=async label=>{const s=await page.evaluate(()=>({status:DeadEndCity.status(),parachute:DeadEndCity.parachuteState(),falls:DeadEndCity.fallState(),faults:DeadEndCity.frameFaults(),context:DeadEndCity.speedBox(),cue:{call:document.getElementById('freefallCall').textContent,note:document.getElementById('freefallNote').textContent},keys:document.getElementById('quickKeys').textContent}));report.states.push({label,...s});console.log(label,JSON.stringify({status:s.status,parachute:s.parachute,faults:s.faults}));return s};
 await call('holdSimulation',true);await call('god',false);await call('settings',{sound:false});await call('teleport',1500,1500);await call('drive','helicopter',450,0);
 const initial=await capture('staged-helicopter');check(initial.status.vehicle==='helicopter'&&!initial.parachute,'setup must be in aircraft before actual J bailout');
 await down('KeyJ');await tick(1);let s=await capture('actual-J-bail-held');check(s.parachute.stage==='freefall'&&!s.parachute.mainUsed,'held bailout must stay freefall');
 await down('KeyJ');await tick(.5);s=await capture('bail-repeat-safe');check(s.parachute.stage==='freefall'&&!s.parachute.mainUsed,'OS repeat must not deploy main');
 await up('KeyJ');await down('KeyJ');s=await capture('fresh-main-pull');check(s.parachute.stage==='canopy'&&s.parachute.canopy==='main'&&s.parachute.phase==='pilot','fresh edge must start main pilot, not inflate instantly');
 await tick(6);s=await capture('main-open-held-safe');check(s.parachute.stage==='canopy'&&s.parachute.phase==='open'&&!s.parachute.cutaway,'held main pull must not cut away when fully open');
 await down('KeyJ');await tick(.1);s=await capture('open-main-repeat-safe');check(s.parachute.stage==='canopy'&&!s.parachute.cutaway,'repeat must not cut open main');
 await up('KeyJ');await down('KeyJ');s=await capture('fresh-main-cutaway');check(s.parachute.stage==='freefall'&&s.parachute.cutaway&&!s.parachute.reserveUsed&&!s.parachute.armed,'fresh edge cuts main exactly once');
 const cutAltitude=s.parachute.altitudeM;await tick(2);await down('KeyJ');await tick(.5);s=await capture('cutaway-held-freefall');check(s.parachute.stage==='freefall'&&!s.parachute.reserveUsed&&s.parachute.altitudeM<cutAltitude&&s.cue.call.includes('RESERVE'),'held cutaway must stay accelerating freefall with reserve cue');
 await up('KeyJ');await down('KeyJ');s=await capture('fresh-reserve-pull');check(s.parachute.stage==='canopy'&&s.parachute.canopy==='reserve'&&s.parachute.reserveUsed&&!s.parachute.reserveAvailable&&s.parachute.phase==='pilot','fresh edge consumes one reserve through pilot stage');
 await tick(4);s=await capture('reserve-open');check(s.parachute.stage==='canopy'&&s.parachute.phase==='open'&&s.parachute.canopy==='reserve','reserve must progress to flying canopy');
 for(let i=0;i<3;i++){await up('KeyJ');await down('KeyJ');await tick(.05);await down('KeyJ');await tick(.05)}s=await capture('reserve-extra-edges-safe');check(s.parachute.stage==='canopy'&&s.parachute.canopy==='reserve'&&s.parachute.reserveUsed&&!s.parachute.reserveAvailable,'extra fresh/repeat edges must not cut or replenish reserve');
 await up('KeyJ');let landed=false,flare=false;
 for(let i=0;i<30;i++){const p=await call('parachuteState');if(!p){landed=true;break}if(p.aglM<40&&!flare){await down('KeyS');flare=true}await tick(p.aglM<40?2:10)}
 if(flare)await up('KeyS');s=await capture('normal-reserve-landing');check(landed&&!s.parachute&&s.status.mode==='play'&&s.status.hp===100,'reserve must finish normal safe landing alive without a debug placement/heal');check(s.falls.impacts.at(-1)?.outcome==='safe','normal impact record must classify reserve landing safe');
 report.firstLanding=s;
 // A new staged aircraft trip begins only after actual normal landing; verify rig inventory reset.
 await call('teleport',1500,1500);await call('drive','helicopter',450,0);await down('KeyJ');await tick(.1);s=await capture('later-bailout-fresh-rig');check(s.parachute.stage==='freefall'&&!s.parachute.mainUsed&&!s.parachute.reserveUsed&&s.parachute.reserveAvailable&&!s.parachute.cutaway,'later bailout must start a fresh main/reserve rig');await up('KeyJ');
 const beforeReset=await call('worldResetReport');report.inputs.push({kind:'DOM-keypress',key:'Escape'});await page.keyboard.press('Escape');await page.waitForFunction(()=>DeadEndCity.status().mode==='pause');report.inputs.push({kind:'DOM-click',selector:'#newGame'});await page.click('#newGame');await page.waitForFunction(()=>DeadEndCity.status().mode==='play');s=await capture('actual-new-game-cleans-active-rig');const afterReset=await call('worldResetReport');report.worldReset={before:beforeReset,after:afterReset};check(!s.parachute&&!s.status.vehicle&&s.status.hp===100&&afterReset.serial>beforeReset.serial&&(afterReset.byReason['new-game']||0)>(beforeReset.byReason['new-game']||0),'real pause NEW GAME must remove active rig and reset world serial');
 check(report.states.every(s=>s.faults.count===0),'frame fault occurred');check(report.errors.length===0,'browser game error occurred');report.pass=true;
}catch(e){report.failure=e.stack||e.message;console.error(report.failure);process.exitCode=1;}
finally{
 if(page)for(const key of['KeyJ','KeyS'])await page.keyboard.up(key).catch(()=>{});
 await browser.close();report.finishedAt=new Date().toISOString();report.htmlUnchanged=sha(fs.readFileSync(file))===expected;fs.writeFileSync(out+'/physical-reserve.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,assertions:report.assertions,states:report.states.length,errors:report.errors.length,failure:report.failure||null}));
}
