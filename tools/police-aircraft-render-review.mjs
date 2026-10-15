// Native police/aircraft/hotrod visual review against an immutable game HTML.
// Usage: node tools/police-aircraft-render-review.mjs HTML OUT LABEL
// Only named developer actions; images are original clipped viewport pixels.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchBrowser } from './browser.mjs';
import {runAircraftParkingReview} from './aircraft-parking-render-review.mjs';
import {runAviationVehicleRuntime} from './aviation-vehicle-runtime-review.mjs';
import {runTrailContactReview} from './trail-contact-render-review.mjs';
const extended=process.argv.includes('--extended');
const curated=process.argv.includes('--curated');
const [input, directory, label] = process.argv.slice(2), file = path.resolve(input), out = path.resolve(directory);
if (!label || !fs.existsSync(file)) throw Error('HTML, output directory and label required');
fs.mkdirSync(out, { recursive: true });
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex'),
  report = { label, htmlSha256: hash(fs.readFileSync(file)), recorderSha256: hash(fs.readFileSync(new URL(import.meta.url))),
    fixture: { seed: 1, time: 13, weather: 'clear', viewport: [1000,700], crop: [130,80,740,500], curated, policeOrigin: [418,6000], policeSpacing: 110,
      policeLooks: [['police','crownvic','bw'],['police','charger','modern'],['police','utility','sheriff']], policeSideAngles: [0,180], policePitch: 9,
      lookBeforeBoard: true, holdSimulation: true, graphics: ['high','low'] }, captures: [], errors: [], warnings: [] },
  allowed = new Set(['status','holdSimulation','god','graphics','sky','setClock','wanted','settings','look','drive','placeVehicle','interact','vehicleAt','vehiclesNear',
    'carModels','carLineup','policeLineup','viewMode','closeUp','inspectView','hitchRun','cameraView','airfields','flight','aircraftAssets','frameFaults','gpuContext','drawProfile','aircraftTaxi']);
const { browser } = await launchBrowser({ label: 'police-aircraft-'+label, args: ['--autoplay-policy=no-user-gesture-required'] }),
  page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
report.componentScripts=Object.fromEntries(['aircraft-parking-render-review.mjs','aviation-vehicle-runtime-review.mjs','trail-contact-render-review.mjs'].map(n=>[n,hash(fs.readFileSync(new URL(n,import.meta.url)))]));
page.setDefaultTimeout(480000);
page.on('pageerror', e => report.errors.push(e.stack || e.message));
page.on('console', m => { if (m.type() === 'error' || /GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM/i.test(m.text())) report.errors.push(m.text()); else if(m.type()==='warning') report.warnings.push(m.text()); });
async function batch(rows) {
  for (const [method] of rows) if (!allowed.has(method)) throw Error('Unknown review action '+method);
  return page.evaluate(rows => rows.map(([method,args]) => typeof window.DeadEndCity[method] === 'function' ? window.DeadEndCity[method](...args) : null), rows);
}
const call = async (method,...args) => (await batch([[method,args]]))[0],
  draw = () => ['hitchRun',[1/60,[],1,false,true]], age = seconds => ['hitchRun',[seconds,[],1,false,false]],
  save = () => fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2));
async function shot(name, facts={}) {
  const state = await page.evaluate(() => { const a=window.DeadEndCity;return {status:a.status(),camera:a.cameraView(),gpu:a.gpuContext(),faults:a.frameFaults(),quality:a.graphics(),flight:a.flight(),aircraftAssets:a.aircraftAssets(),models:a.carModels(true)}; });
  if(state.status.renderer!=='3d' || state.faults.count || state.gpu.lost || state.gpu.losses) throw Error('Invalid rendered state '+name);
  const target = path.join(out,name+'.png');
  await page.screenshot({path:target,clip:{x:130,y:80,width:740,height:500},timeout:480000});
  report.captures.push({name,...facts,...state,pngSha256:hash(fs.readFileSync(target))});save();console.log('shot',name);
}
try {
  console.log('boot',label);
  await page.goto('file://'+file+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
  await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');await page.click('#startBtn');
  await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));
  if((await call('status')).mode==='dialogue') await page.click('#callDecline');
  await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
  await batch([['holdSimulation',[true]],['god',[true]],['graphics',['high']],['sky',['clear']],['setClock',[13]],['wanted',[0]],
    ['settings',[{cameraView:'street',sound:false,gps:false,minimapFolded:true,keyHints:false,playerRing:false,motionBlur:false,lookAhead:0,radioVolume:0}]]]);
  await page.mouse.move(998,0);
  const lineup = await call('policeLineup',418,6000,0,false,110,report.fixture.policeLooks);report.policeLineup=lineup;save();
  for(let i=0;i<lineup.length;i++) {
    const target=lineup[i], y=6000+110*i;
    await batch([['look',[418,y-20,3]],['interact',[]],['placeVehicle',[418,y,0]],draw(),age(1.3),draw()]);
    const check=await batch([['status',[]],['vehicleAt',[418,y]],['vehiclesNear',[1]]]);
    if(check[0].vehicle!==target.type || check[1]?.id!==target.id || !check[2].some(v=>v.id===target.id&&v.driven)) throw Error('Police boarding identity mismatch '+JSON.stringify(check));
    for(const tier of ['high','low']) {
      await batch([['graphics',[tier]],['viewMode',['street']],['closeUp',[12]],['setClock',[13]]]);
      const angles=tier==='high'?[0,180]:[0];
      for(const yaw of angles) {
        await batch([['inspectView',[yaw,9,5]],draw(),draw()]);
        await shot('police-'+target.body+'-'+target.livery+'-'+tier+'-side'+yaw,{id:target.id,body:target.body,livery:target.livery,yaw});
      }
    }
  }
  if(!curated){
  await batch([['look',[418,6000,3]],['drive',['hotrod',0,0]],['placeVehicle',[418,6000,0]],['graphics',['high']],['viewMode',['street']],['closeUp',[11]],['setClock',[13]],draw(),age(1.3),draw()]);
  for(const [name,yaw,pitch] of [['front',65,12],['side',0,9]]) {
    await batch([['inspectView',[yaw,pitch,4]],draw(),draw()]);await shot('hotrod-'+name,{yaw,pitch});
  }
  }
  for(const type of curated?['jet']:['jet','airliner']) {
    await batch([['look',[418,6500,1]],['drive',['plane',0,0,type]],['placeVehicle',[418,6500,0]],['graphics',['high']],['viewMode',['street']],['closeUp',[type==='jet'?3:1.7]],['setClock',[13]],['inspectView',[55,17,12]],draw(),age(1.3),draw()]);
    await shot('plane-'+type+'-front',{airframe:type});
  }
  await batch([['look',[4460,9160,1.2]],['viewMode',['street']],['inspectView',[55,20,15]],['closeUp',[1.15]],['setClock',[13]],draw(),draw()]);
  await shot('airport-static-jet',{place:[4460,9160],yaw:55,pitch:20});
  report.airfields=await call('airfields');report.mainPass=report.errors.length===0;save();
  if(extended){
    report.extended={};
    for(const[key,runner,folder]of[['parking',runAircraftParkingReview,'after-parking'],['runtime',runAviationVehicleRuntime,'runtime'],['trail',runTrailContactReview,'after-trail']]){
      const result=await runner({html:file,out:path.join(path.dirname(out),folder),label,page});
      report.extended[key]={pass:result.pass??result.passed,htmlSha256:result.htmlSha256,recorderSha256:result.recorderSha256};save();
      if(!report.extended[key].pass)throw Error('Extended review failed: '+key+' '+(result.failure||''));
    }
  }
  report.pass=report.mainPass&&report.errors.length===0;save();
  console.log('complete',report.captures.length,'images; errors',report.errors.length);
} catch(e) {report.pass=false;report.failure=e.stack||String(e);save();console.error(report.failure);process.exitCode=1;}
finally {await browser.close();}
