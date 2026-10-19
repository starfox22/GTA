// Native visual fixtures for the first four missions; NOT end-to-end win evidence.
// source /workspace/setup/GTA-env.sh
// node work/experience/graphics.mjs /workspace/GTA/work/general-review/integrated2.html OUTPUT
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from '../../tools/browser.mjs';
const [input,directory]=process.argv.slice(2);if(!input||!directory)throw Error('HTML and output required');
const html=path.resolve(input),out=path.resolve(directory),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={category:'staged native visual fixtures; ordinary mission wins are separate receipts',htmlSha256:hash(fs.readFileSync(html)),recorderSha256:hash(fs.readFileSync(new URL(import.meta.url))),viewport:[1000,700],seed:1,urlFlags:'?test&seed=1&hold&shadercheck',inputs:[],captures:[],renderChecks:[],errors:[],warnings:[]};
const save=()=>fs.writeFileSync(path.join(out,'graphics-review.json'),JSON.stringify(report,null,2)+'\n');
const {browser}=await launchBrowser({label:'general-experience-graphics',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(600000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
const named=new Set(['status','holdSimulation','god','graphics','sky','settings','hitchRun','simulate','missionState','missionCard','missionBrief','promptState','hudOverlaps','hudClearance','frameFaults','gpuContext','viewMode','chaseCamera','cameraView','chaseLook','inspectView','closeUp','setClock','wetness','rainView','wetGlints','stats','drawProfile','startMission','storyProgress','summitSkip','summitJob','drive','placeVehicle','teleport','walk','fortSkip','fortJob','fortCover','roofPlace','roofStealth']);
async function call(m,...a){if(!named.has(m))throw Error('Undeclared method '+m);report.inputs.push([m,a]);const r=await page.evaluate(([m,a])=>window.DeadEndCity[m](...a),[m,a]);save();return r;}
async function key(code){report.inputs.push(['real DOM key',[code]]);await page.keyboard.press(code);save();}
function assert(ok,message){if(!ok)throw Error(message);}
async function tick(seconds=0.25,held=[]){return call('hitchRun',seconds,held,3,false,false);}
async function draw(){await call('hitchRun',1/60,[],3,false,true);await page.waitForTimeout(500);}
async function snapshot(file,title,fixture){await draw();const state=await call('status'),quality=await call('graphics'),faults=await call('frameFaults'),gpu=await call('gpuContext');assert(state.renderer==='3d'&&!faults.count&&!gpu.lost&&!report.errors.length,'Native graphics error '+file);const data={file,title,fixture,state,quality,mission:await call('missionState'),card:await call('missionCard'),prompt:await call('promptState'),sumJob:await call('summitJob'),fortJob:await call('fortJob'),fortCover:await call('fortCover'),camera:await call('chaseCamera'),streetCamera:await call('cameraView'),hud:await call('hudOverlaps'),faults,gpu,draw:await call('drawProfile',5),stats:await call('stats')};data.subtitle=await page.locator('#storyLine').evaluate(e=>({text:e.textContent,classes:e.className,opacity:getComputedStyle(e).opacity,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}));await page.screenshot({path:path.join(out,file),timeout:600000});data.sha256=hash(fs.readFileSync(path.join(out,file)));report.captures.push(data);save();console.log('Captured',file,JSON.stringify({state,quality:quality.tier,prompt:data.prompt.text,overlaps:data.hud.overlaps}));}
async function renderCheck(label){await draw();const q=await call('graphics'),s=await call('status'),d=await call('drawProfile',3),g=await call('gpuContext'),f=await call('frameFaults');assert(d.total>0&&d.triangles>0&&!g.lost&&!f.count&&!report.errors.length,'Render check failed '+label);report.renderChecks.push({label,quality:q,state:s,draw:d,gpu:g,faults:f,rain:await call('rainView'),glints:await call('wetGlints')});save();console.log('Rendered',label,q.tier,d.total,d.triangles);}
try{
 console.log('Opening frozen visual review');
 await page.goto('file://'+html+report.urlFlags,{waitUntil:'domcontentloaded',timeout:600000});await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await page.mouse.move(998,0);await page.click('#startBtn');await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
 await call('holdSimulation',true);await call('graphics','high');await call('settings',{sound:false,fps:false});
 // Fresh public profile: accept the opening call with actual DOM E/Enter.
 await key('KeyE');await key('Enter');await tick(3.4);await call('hudClearance','read');
 await snapshot('01-opening-subtitle-high.png','Readable opening subtitle and mission card',{kind:'fresh public opening',actions:'actual E/Enter phone acceptance, held rendering clock',quality:'high'});
 const opening=report.captures.at(-1);assert(opening.card.line&&opening.subtitle.text.includes('Vinny')&&Number(opening.subtitle.opacity)>.5,'Opening subtitle is not visible');assert(!opening.hud.overlaps.some(p=>p.includes('storyLine')),'Opening subtitle overlaps HUD');
 await call('god',true); // Visual fixtures below are not ordinary win claims.
 await call('storyProgress',2,true);await call('startMission',2);await call('summitSkip','summit');await call('setClock',14);await call('sky','clear');await tick(2.2,['KeyE']);
 await call('viewMode','street');await call('closeUp',3.4);await call('inspectView');
 await snapshot('02-summit-dig-high.png','Mount Ascent summit and package excavation',{kind:'staged summit arrival',stage:1,quality:'high'});
 await tick(6,['KeyE']);assert((await call('summitJob')).carrier==='backpack','Package not in backpack');await call('walk',0,0);await call('closeUp',18);await call('inspectView',270,15,8);await tick(.3);
 await snapshot('03-fitted-backpack-high.png','Visible fitted package backpack',{kind:'staged summit arrival followed by ordinary held-E dig',camera:'inspection close view from behind',quality:'high'});
 // Load a travel vehicle at its rear, then expose the new recovery prompt.
 await call('startMission',2);await call('teleport',7738,1092);await call('drive','hilux',0,Math.PI);await call('placeVehicle',7738,1092,Math.PI);await tick(.3);await key('KeyE');await tick(.4);await call('teleport',7778,1084);await tick(8,['KeyE']);let m=await call('summitJob');assert(m.carrier==='hand'&&m.stage===2,'Cargo-load visual setup failed');await call('teleport',m.target.x,m.target.y);await key('KeyE');await tick(.4);m=await call('summitJob');assert(m.carrier==='car','Package not loaded');await call('closeUp',7);await call('inspectView',90,22,4);await tick(.4);
 await snapshot('04-rear-cargo-retrieval-high.png','Recover cargo from a stranded vehicle',{kind:'staged vehicle/summit arrival followed by ordinary dig and rear loading',quality:'high'});assert(report.captures.at(-1).prompt.text.includes('RETRIEVE THE PACKAGE'),'Recovery prompt missing');await key('KeyE');await tick(1);assert((await call('summitJob')).carrier==='backpack','Cargo retrieval did not return backpack');
 await call('inspectView');await call('viewMode','chase');await call('walk',220*Math.PI/180,0);await call('chaseLook',0,0,220,8);await tick(1);
 await snapshot('05-mountain-backpack-chase-high.png','Mountain route with recovered backpack',{kind:'visual fixture after actual rear recovery action',view:'chase',quality:'high'});
 await call('storyProgress',3,true);await call('fortSkip','changed');await call('teleport',9236,8182);await call('setClock',14);await call('sky','clear');await call('chaseLook',0,0,0,6);await tick(.6);
 await snapshot('06-uniform-gate-high.png','Borrowed uniform at Fort Sentinel checkpoint',{kind:'staged changed-uniform fixture',view:'chase',quality:'high'});
 await key('KeyE');await tick(18);assert((await call('fortJob')).stage===7,'Gate admission failed');const cover=await call('fortCover');await call('teleport',cover.recordsDoor.x,cover.recordsDoor.y+16);await call('setClock',22);await call('sky','rain');await call('wetness',1);await call('viewMode','street');await call('closeUp',3);await call('inspectView');await tick(5);
 await snapshot('07-records-rain-night-high.png','Records office in rain at night',{kind:'staged gate approach, actual ID presentation, then visual records-door placement',view:'street',quality:'high'});assert(report.captures.at(-1).prompt.text.includes('RECORDS'),'Records prompt missing');await renderCheck('high/street/rain/night');
 await key('KeyV');assert((await call('chaseCamera')).mode==='chase','V did not enter chase');await call('chaseLook',0,0,270,7);await tick(.4);await snapshot('08-records-rain-night-chase-high.png','Records office in chase view',{kind:'same visual records-door fixture, actual V camera key',view:'chase',quality:'high'});await renderCheck('high/chase/rain/night');
 await call('graphics','low');await tick(.3);await snapshot('09-records-rain-night-chase-low.png','Low preset retains the mission scene',{kind:'same visual records-door fixture',view:'chase',quality:'low'});await renderCheck('low/chase/rain/night');await key('KeyV');await tick(.3);await renderCheck('low/street/rain/night');
 // Render the remaining selectable presets on the same rainy night scene.
 for(const tier of ['medium','ultra','auto']){await call('graphics',tier);for(const view of ['street','chase']){await call('viewMode',view);if(view==='chase')await call('chaseLook',0,0,270,7);await tick(.2);await renderCheck(tier+'/'+view+'/rain/night');}}await call('viewMode','street');await call('graphics','low');await tick(.2);
 // The grounded door uses the real key even with aim held.
 report.inputs.push(['real DOM aim+interact',['MouseRight','KeyE']]);await page.mouse.down({button:'right'});await key('KeyE');await page.mouse.up({button:'right'});assert((await call('status')).mode==='elevator','Grounded aimed records interaction failed');await call('simulate',8);assert((await call('fortCover')).papers,'Records search did not yield papers');
 report.pass=true;save();console.log('PASS visual review',report.captures.length,'captures',report.renderChecks.length,'render combinations');
}catch(e){report.pass=false;report.failure=e.stack||String(e);save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();fs.copyFileSync(new URL(import.meta.url),path.join(out,'graphics.mjs'));save();}
