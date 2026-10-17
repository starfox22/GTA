// Native matched Monarch collection and selected-name captures from a frozen game.
// node tools/monarch-review.mjs HTML OUTPUT before|after [comma-separated types]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from './browser.mjs';
const [input,directory,label='after',selection]=process.argv.slice(2);
if(!input||!directory||!['before','after'].includes(label))throw Error('HTML, output and before|after required');
const types=selection?.split(',')||['valkyrie','dbs','zr1x','chevetteSE','wayron','tourbillon','jasko','sirocco','novera','w1','lafera','roadster','cruiser'];
const html=path.resolve(input),out=path.resolve(directory),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={label,htmlSha256:hash(fs.readFileSync(html)),recorderSha256:hash(fs.readFileSync(new URL(import.meta.url))),
  fixture:{viewport:[1000,700],seed:1,position:[418,6000],heading:0,quality:'high',weather:'clear',clock:13,inspection:[65,12,4]},
  types,inputs:[],captures:[],errors:[],warnings:[]};
const named=new Set(['status','holdSimulation','god','graphics','sky','setClock','settings','look','drive','placeVehicle',
  'viewMode','closeUp','inspectView','hitchRun','cameraView','frameFaults','gpuContext','assetCars','approvedAssets','damageReport']);
const save=()=>fs.writeFileSync(path.join(out,'capture-'+label+'.json'),JSON.stringify(report,null,2)+'\n');
const{browser}=await launchBrowser({label:'monarch-review-'+label,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(480000);
page.on('pageerror',e=>report.errors.push(e.stack||e.message));
page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/.test(m.text()))report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
async function calls(rows){
  for(const[m,a]of rows){if(!named.has(m))throw Error('Undeclared method '+m);report.inputs.push([m,a]);}
  return page.evaluate(rows=>rows.map(([m,a])=>window.DeadEndCity[m](...a)),rows);
}
try{
  console.log('Opening frozen Monarch review',label);
  await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
  await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');
  await page.mouse.move(998,0);await page.click('#startBtn');
  await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));
  if((await calls([['status',[]]]))[0].mode==='dialogue')await page.click('#callDecline');
  await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
  await calls([['holdSimulation',[true]],['god',[true]],['graphics',['high']],['sky',['clear']],
    ['settings',[{sound:false,fps:false,gps:false,minimapFolded:true,keyHints:false,lookAhead:0,radioVolume:0}]]]);
  for(const[typeIndex,type]of types.entries()){
    if(typeIndex)await calls([['placeVehicle',[418,6600+typeIndex*100,0]]]);
    await calls([['look',[418,6000,3]],['drive',[type,0,0]],['placeVehicle',[418,6000,0]],['setClock',[13]],
      ['viewMode',['street']],['closeUp',[11]],['inspectView',[65,12,4]],
      ['hitchRun',[.25,[],1,false,false]],['hitchRun',[1/60,[],1,false,true]],['hitchRun',[1.3,[],1,false,false]]]);
    await page.mouse.move(998,0);await page.waitForTimeout(4500);
    await page.waitForFunction(()=>{const e=document.getElementById('carRadio');return e.classList.contains('hidden')||(!e.classList.contains('open')&&!e.matches(':hover,:focus-within')&&e.getBoundingClientRect().width<200&&e.getBoundingClientRect().height<60);});
    const[status,camera,faults,gpu,assets,models,damage]=await calls([['status',[]],['cameraView',[]],['frameFaults',[]],['gpuContext',[]],['assetCars',[]],['approvedAssets',[]],['damageReport',[]]]);
    const vehicleName=await page.locator('#vehicleName').innerText();
    if(status.renderer!=='3d'||status.vehicle!==type||faults.count||gpu.lost||report.errors.length)throw Error('Invalid capture '+type);
    const model=models.models.find(m=>m.id===damage.id),asset=assets.models[type]||null;
    const file='monarch-'+label+'-'+type+'.png';
    await page.screenshot({path:path.join(out,file),timeout:480000});
    report.captures.push({file,sha256:hash(fs.readFileSync(path.join(out,file))),type,vehicleName,status,camera,faults,gpu,asset,model,damage});
    save();console.log('Captured',file,vehicleName,asset?.sourceKey||'procedural');
  }
  report.pass=true;save();
}catch(e){report.pass=false;report.failure=e.stack||String(e);save();console.error(report.failure);process.exitCode=1;}
finally{await browser.close();}
