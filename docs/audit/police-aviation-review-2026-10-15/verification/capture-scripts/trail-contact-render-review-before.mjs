// Native outcome of the same 30-second compact-SUV descent, using actual production controls/physics.
// node tools/trail-contact-render-review.mjs FROZEN_HTML OUTPUT LABEL
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from './browser.mjs';
const [input,directory,label]=process.argv.slice(2), html=path.resolve(input),out=path.resolve(directory),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={label,htmlSha256:sha(fs.readFileSync(html)),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),
 fixture:{seed:1,time:13,weather:'clear',viewport:[1000,700],crop:[130,80,740,500],trailSeconds:30,compactSelection:'actual created SUV id modulo 3 equals zero; at most three ordinary fallTest spawns',tier:'high',held:true},captures:[],errors:[],warnings:[]};
const {browser}=await launchBrowser({label:'trail-review-'+label,args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage({viewport:{width:1000,height:700}});
page.setDefaultTimeout(480000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/i.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
const allowed=new Set(['status','holdSimulation','god','graphics','sky','setClock','wanted','settings','look','drive','placeVehicle','viewMode','closeUp','inspectView','hitchRun','airfields','cameraView','gpuContext','frameFaults','hotrodAssets','carModels','vehicleAt','vehiclesNear','fallTest']);
async function batch(rows){for(const[n]of rows)if(!allowed.has(n))throw Error('Undeclared action '+n);return page.evaluate(rows=>rows.map(([n,a])=>window.DeadEndCity[n](...a)),rows);}
const call=async(n,...a)=>(await batch([[n,a]]))[0], draw=['hitchRun',[1/60,[],1,false,true]], age=['hitchRun',[1.3,[],1,false,false]];
const save=()=>fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');
async function shot(name,fixture){
 const state=await page.evaluate(()=>{const a=window.DeadEndCity;return{status:a.status(),camera:a.cameraView(),gpu:a.gpuContext(),faults:a.frameFaults(),quality:a.graphics(),airfields:a.airfields(),hotrodAssets:a.hotrodAssets?.()??null,models:a.carModels(true)};});
 if(state.status.renderer!=='3d'||state.gpu.lost||state.gpu.losses||state.faults.count)throw Error('Invalid GPU state '+name);
 const target=path.join(out,name+'.png');await page.screenshot({path:target,clip:{x:130,y:80,width:740,height:500},timeout:480000});
 report.captures.push({name,fixture,...state,pngSha256:sha(fs.readFileSync(target))});save();console.log('shot',name);
}
try{
 console.log('boot',label);
 await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
 await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await page.click('#startBtn');
 await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));if((await call('status')).mode==='dialogue')await page.click('#callDecline');
 await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
 await batch([['holdSimulation',[true]],['god',[false]],['graphics',['high']],['sky',['clear']],['setClock',[13]],['wanted',[0]],['settings',[{cameraView:'street',sound:false,gps:false,minimapFolded:true,keyHints:false,playerRing:false,motionBlur:false,lookAhead:0,radioVolume:0}]]]);
 await page.mouse.move(998,0);
 for(let attempt=0;attempt<3;attempt++){
  const result=await call('fallTest','drive-trail',30),near=await call('vehiclesNear',1);
  const driven=near.find(v=>v.type==='suv'&&v.driven&&v.metres<.1);
  if(!driven)throw Error('Descent did not retain its actual player SUV: '+JSON.stringify({result,near}));
  report.attempts??=[];report.attempts.push({id:driven.id,result});save();
  if(driven.id%3!==0)continue;
  await batch([['viewMode',['street']],['closeUp',[7]],['inspectView',[65,20,4]],['setClock',[13]],draw,draw]);
  await shot('compact-suv-trail',{seconds:30,id:driven.id,result,camera:{zoom:7,yaw:65,pitch:20,lift:4}});
  break;
 }
 if(report.captures.length!==1)throw Error('No compact SUV selected within three real spawns');
 report.pass=report.errors.length===0;save();console.log('complete',report.captures.length,'images; errors',report.errors.length);
}catch(e){report.failure=e.stack||String(e);save();console.error(report.failure);process.exitCode=1;}finally{await browser.close();}
