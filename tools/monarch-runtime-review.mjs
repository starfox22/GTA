// Native WebGL review of the downloaded Monarch collection and its material lifecycle.
// Named public console actions/reports only; screenshots preserve the normal game UI.
// node tools/monarch-runtime-review.mjs FROZEN_HTML OUTPUT [MONARCH_PACK] [--lifecycle-only|--showroom-only]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {launchBrowser} from './browser.mjs';

const args=process.argv.slice(2),flags=args.filter(arg=>arg.startsWith('--'));
if(flags.some(flag=>!['--lifecycle-only','--showroom-only'].includes(flag))||flags.length>1)throw Error('Choose one known review mode');
const mode=flags[0]?.slice(2,-5)||'full';
const [input,directory,packInput='assets/monarch-vehicle-models.bin']=args.filter(arg=>!arg.startsWith('--'));
if(!input||!directory)throw Error('Frozen HTML and output directory required');
const html=path.resolve(input),out=path.resolve(directory),pack=path.resolve(packInput);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bytes=fs.readFileSync(pack);
if(bytes.subarray(0,8).toString()!=='DECVM001')throw Error('Expected Monarch DECVM001 pack');
const source=JSON.parse(bytes.subarray(12,12+bytes.readUInt32LE(8)).toString()).models;
const mapping={valkyrie:'monarch_valkyrie',dbs:'monarch_db11',zr1x:'monarch_c8_hari',chevetteSE:'monarch_c8_hari',
 wayron:'monarch_wayron',tourbillon:'monarch_tourbillon',jasko:'monarch_ccx',sirocco:'monarch_huayra',
 novera:'monarch_roadster_ev',w1:'monarch_p1_gtr',lafera:'monarch_laferrari'};
fs.mkdirSync(out,{recursive:true});
const report={htmlSha256:sha(fs.readFileSync(html)),recorderSha256:sha(fs.readFileSync(new URL(import.meta.url))),
 packSha256:sha(bytes),fixture:{viewport:[1000,700],seed:1,weather:'clear',clock:13,position:[418,6000]},
 mode,status:'running',events:[],checks:0,inputs:[],sources:Object.fromEntries(Object.entries(source).map(([key,m])=>[key,{gameTypes:m.gameTypes,
  triangles:m.triangles,farTriangles:m.farTriangles,hasNormalMaps:m.hasNormalMaps,atlas:m.atlas,lowAtlas:m.lowAtlas}])),
 native:[],tiers:[],lifecycle:[],screenshots:[],errors:[],warnings:[]};
const allowed=new Set(['status','holdSimulation','god','graphics','settings','sky','setClock','wanted','look','drive','placeVehicle',
 'carLineup','hitchRun','approvedAssets','sportsAssets','svjAssets','monarchAssets','assetCars','vehicleDoors','assetChar',
 'burnVehicle','doorSwing','damageReport','frameFaults','drawProfile','viewMode','inspectView','closeUp','gpuContext',
 'dealership','dealershipVisit','carModels','cabinHeadroom']);
const save=()=>fs.writeFileSync(path.join(out,'monarch-runtime-review.json'),JSON.stringify(report,null,2)+'\n');
function stage(name){report.stage=name;report.events.push({name,utc:new Date().toISOString()});save();console.log('STAGE',name);}
function assert(ok,message){report.checks++;if(!ok)throw Error(message);}
stage('launch browser');
const {browser}=await launchBrowser({label:'monarch-runtime-review',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1000,height:700}});page.setDefaultTimeout(480000);
page.on('pageerror',error=>{report.errors.push(error.stack||error.message);save();console.error('BROWSER ERROR',error.stack||error.message);});
page.on('console',message=>{
 const text=message.text();
 if(message.type()==='error'||/GL_INVALID|INVALID_OPERATION|INVALID_VALUE|INVALID_ENUM|VALIDATE_STATUS/i.test(text)){report.errors.push(text);save();console.error('WEBGL / CONSOLE ERROR',text);}
 else if(message.type()==='warning')report.warnings.push(text);
});
async function batch(rows){
 for(const [name,args] of rows){if(!allowed.has(name))throw Error('Undeclared named action '+name);report.inputs.push([name,args]);}
 report.lastNamedActions=rows.map(([name])=>name);save();
 return page.evaluate(rows=>rows.map(([name,args])=>window.DeadEndCity[name](...args)),rows);
}
const call=async(name,...args)=>(await batch([[name,args]]))[0];
const draw=['hitchRun',[1/60,[],1,false,true]],age=['hitchRun',[1.3,[],1,false,false]];
async function settle(){await page.waitForTimeout(1200);}
async function snapshot(id){
 const [status,models,doors,char,damage,faults,gpu]=await batch([['status',[]],['approvedAssets',[]],['vehicleDoors',[id]],
  ['assetChar',[]],['damageReport',[id]],['frameFaults',[]],['gpuContext',[]]]);
 return {status,model:models.models.find(model=>model.id===id)||null,doors:doors.cars[0]||null,
  char:char.models.find(model=>model.id===id)||null,damage,faults,gpu};
}
function healthy(row,label){
 assert(row.status.renderer==='3d'&&!row.faults.count&&!row.gpu.lost,label+': renderer/frame/GPU failure');
 assert(!report.errors.length,label+': browser or shader errors: '+JSON.stringify(report.errors));
}
async function screenshot(file,details={}){
 await page.mouse.move(998,0);
 await page.screenshot({path:path.join(out,file),timeout:480000});
 report.screenshots.push({file,sha256:sha(fs.readFileSync(path.join(out,file))),...details});save();
}
// Only a completed current-tier image counts: a texture object with a previous
// tier's nonzero dimensions cannot accidentally satisfy this wait.
async function textures(quality,focus){
 const expected=Object.fromEntries(Object.entries(source).map(([key,m])=>[key,(quality==='high'&&key===focus?m.atlas:m.lowAtlas)]));
 await page.waitForFunction(({expected,focus,quality})=>{
  const r=window.DeadEndCity.monarchAssets();
  return !r.error&&r.heroSource===focus&&Object.entries(r.models).every(([key,model])=>
   (!Object.keys(model.atlasSizes).length||model.texturesReady)&&
   model.targetTextures===(quality==='high'&&key===focus?'high':'low')&&
   Object.values(model.atlasSizes).every(([w,h])=>w===expected[key][0]&&h===expected[key][1]));
 },{expected,focus,quality},{timeout:240000});
 const row={quality,expectedFocus:focus,report:await call('monarchAssets')};
 assert(row.report.loaded&&!row.report.error,'Monarch collection failed to decode');
 assert(row.report.highSourceLimit===1,'Collection must budget one full-detail source family');
 assert(Object.values(row.report.models).filter(m=>m.targetTextures==='high').length<=(quality==='high'?1:0),'Too many full-detail source families');
 if(focus)assert(row.report.models[focus].texturesReady,focus+': current source textures not loaded');
 let maxBytes=0;
 for(const [key,m]of Object.entries(row.report.models)){
  const channels=source[key].hasNormalMaps?4:3;
  maxBytes+=expected[key][0]*expected[key][1]*channels*4*4/3;
  for(const [channel,size]of Object.entries(m.atlasSizes))
   assert(JSON.stringify(size)===JSON.stringify(expected[key]),key+' '+channel+': wrong completed texture tier');
 }
 assert(row.report.estimatedTextureMiB<=Math.ceil(maxBytes/1048576*10)/10,'Reported live texture allocation exceeds one-family budget');
 report.tiers.push(row);save();return row.report;
}
try{
 stage('load frozen game');
 await page.goto('file://'+html+'?dev&seed=1&hold&shadercheck',{waitUntil:'domcontentloaded',timeout:480000});
 stage('document loaded; wait for menu');
 await page.waitForFunction(()=>window.DeadEndCity?.status().mode==='menu');stage('menu ready; start game');await page.click('#startBtn');
 await page.waitForFunction(()=>['play','dialogue'].includes(window.DeadEndCity.status().mode));
 if((await call('status')).mode==='dialogue')await page.click('#callDecline');
 await page.waitForFunction(()=>window.DeadEndCity.status().mode==='play');
 stage('play ready; named setup');
 await batch([['holdSimulation',[true]],['god',[true]],['sky',['clear']],['setClock',[13]],['wanted',[0]],['graphics',['high']],
  ['settings',[{sound:false,radioVolume:0,fps:false,gps:false,minimapFolded:true,keyHints:false,lookAhead:0}]],['viewMode',['street']]]);
 stage('read source metadata');
 const assets=await call('assetCars');
 assert(Object.keys(source).length===10,'Expected ten downloaded source families');
 for(const [type,key]of Object.entries(mapping)){
  assert(assets.models[type]?.sourceKey===key,type+': wrong effective source identity');
  assert(source[key].gameTypes.includes(type),type+': source pack mapping missing');
 }
 assert(assets.models.chevette?.triangles===85031&&assets.models.chevette.sourceKey==='c8_hari','Ordinary C8 source changed');
 assert(assets.models.brutini?.triangles===508324&&assets.models.brutini.sourceKey==='svj_sdc','Retained Brutini source changed');
 if(mode!=='showroom'){
 // Fail early on the new char inheritance before the collection tour.
 // These repaired cars remain 25 m beyond the tour position. The close cabin
 // camera keeps the native render workload bounded during the lifecycle checks.
 // Use an unboarded, pristine source with native doors. CCX also compiles source
 // normal maps through the soot shader; the C8 verifies the shared-family adapter.
 for(const [index,type]of ['jasko','zr1x'].entries()){
  stage(type+' lifecycle: create clean source');
  const x=418+index*160,y=6200;
  await batch([['look',[x,y-30,3]],['closeUp',[11]],['inspectView',[165,10,4]],['graphics',['high']]]);
  const [lineup]=await batch([['carLineup',[[type],x,y,0,44,'#b72228',true]],draw,draw]);
  const id=lineup[0].id;await settle();await textures('high',mapping[type]);
  const clean=await snapshot(id);healthy(clean,type+' clean');
  assert(!clean.status.vehicle&&!clean.doors.mask&&!Object.keys(clean.doors.doors).length,type+': clean fixture had prebuilt doors');
  assert(clean.doors.nativeDoors,type+': source native door mapping missing');
  stage(type+' lifecycle: burn');
  await batch([['burnVehicle',[id,20]],draw,draw]);await settle();
  const burnt=await snapshot(id);healthy(burnt,type+' burnt');
  assert(burnt.char?.materials.includes('monarch')&&burnt.damage.burnt,type+': source soot materials missing');
  stage(type+' lifecycle: first native burnt door');
  await batch([['doorSwing',[id,true,-1]],draw,draw]);await settle();
  const burntOpen=await snapshot(id);healthy(burntOpen,type+' first burnt door');
  assert((burntOpen.doors.mask&1)&&burntOpen.doors.doors['-1']?.native,type+': first burnt native door failed');
  await screenshot(type+'-late-door-burnt.png',{type,id});
  stage(type+' lifecycle: repair');
  await batch([['burnVehicle',[id,0,true]],['doorSwing',[id,false]],age,draw,draw]);await settle();
  const repaired=await snapshot(id);healthy(repaired,type+' repaired');
  assert(!repaired.char&&!repaired.damage.burnt&&repaired.damage.hp===repaired.damage.maxhp,type+': char state survived repair');
  assert(!repaired.doors.mask&&Object.values(repaired.doors.sourceGeometryRestored).every(Boolean),type+': source geometry not restored');
  assert(JSON.stringify(repaired.doors.materials)===JSON.stringify(clean.doors.materials),type+': original materials/maps changed after repair');
  await batch([['doorSwing',[id,true,-1]],draw,draw]);await settle();
  const reopened=await snapshot(id);healthy(reopened,type+' reopened');
  stage(type+' lifecycle: reopen repaired source');
  const originals=new Set(Object.values(clean.doors.materials).filter(Boolean).map(m=>m.uuid));
  const layers=reopened.doors.doors['-1'].layers.filter(layer=>!layer.window);
  assert(layers.length>0&&layers.every(layer=>originals.has(layer.material.uuid)),type+': reopened source door retained char material');
  await batch([['look',[x,y-30,3]],['closeUp',[11]],['inspectView',[165,10,4]],draw,draw]);
  await screenshot(type+'-repaired-open-cabin.png',{type,id});
  report.lifecycle.push({type,id,clean,burnt,burntOpen,repaired,reopened});
  console.log('PASS source burn, first door, repair and reopen',type);save();
 }
 }
 if(mode==='full'){
 for(const [index,[type,key]]of Object.entries(mapping).entries()){
  stage(type+' native near source and high textures');
  if(index)await call('placeVehicle',418,7000+index*100,0);
  await batch([['look',[418,6000,3]],['drive',[type,0,0]],['placeVehicle',[418,6000,0]],['setClock',[13]],
   ['viewMode',['street']],['closeUp',[11]],['inspectView',[65,12,4]],age,draw]);
  await settle();await textures('high',key);
  const damage=await call('damageReport'),row=await snapshot(damage.id);
  healthy(row,type);assert(row.status.vehicle===type,type+': exact driven fixture missing');
  assert(row.model?.asset===key&&row.model.visible&&!row.model.far,type+': source model not actually drawn near');
  assert(row.model.triangles===source[key].triangles,type+': near source triangle count changed');
  report.native.push({type,source:key,...row});
  if(['w1','tourbillon'].includes(type))await screenshot(type+'-source-pbr.png',{type,id:damage.id});
  console.log('PASS native source',type,key,row.model.triangles,'normal maps',source[key].hasNormalMaps);save();
 }
 stage('all collection textures: low tier');
 await batch([['graphics',['low']],draw]);await settle();await textures('low',null);
 const low=await call('monarchAssets');
 assert(Object.values(low.models).every(m=>Object.values(m.atlasSizes).every(([w,h])=>w<=1024&&h<=1024)),'Low tier exceeded 1024px collection budget');
 // The last driven model remains the full-detail family after returning to HIGH.
 stage('collection textures: return high tier');
 await batch([['graphics',['high']],draw]);await settle();await textures('high',mapping.lafera);
 await screenshot('laferrari-high-tier.png',{type:'lafera'});
 }
 if(mode!=='lifecycle'){
 stage('actual Monarch Motors stock');
 // These are the real dealership's stocked entities, not a staged duplicate row.
 await batch([['inspectView',[]],['dealershipVisit',['hall',1.6]],['viewMode',['street']],['graphics',['high']],draw,draw]);
 await settle();
 const showroomFocus=(await call('monarchAssets')).heroSource;
 await textures('high',showroomFocus);
 report.showroom={status:await call('status'),dealership:await call('dealership'),
  monarch:await call('monarchAssets'),models:await call('approvedAssets'),profile:await call('drawProfile',5)};
 assert(report.showroom.dealership.name==='MONARCH MOTORS'&&report.showroom.dealership.slots.length===15,'Real showroom stock missing');
 for(const slot of report.showroom.dealership.slots){
  const model=report.showroom.models.models.find(model=>model.id===slot.car);
  assert(model?.asset===(mapping[slot.type]||'svj_sdc'),'Showroom '+slot.type+': wrong stocked source model');
 }
 assert(Object.values(report.showroom.monarch.models).every(model=>model.texturesReady),'Every stocked source must have loaded maps');
 for(const type of ['w1','tourbillon']){
  const slot=report.showroom.dealership.slots.find(slot=>slot.type===type),key=mapping[type];
  assert(report.showroom.monarch.models[key].hasNormalMaps&&source[key].hasNormalMaps,type+': normal-enabled source metadata missing');
  assert(report.showroom.models.models.some(model=>model.id===slot.car&&model.asset===key),type+': actual normal-enabled stocked model missing');
 }
 await screenshot('monarch-motors-stock.png',{place:'actual Monarch Motors hall'});
 stage('showroom all ten sources: low tier');
 await batch([['graphics',['low']],draw,draw]);await settle();const lowStock=await textures('low',null);
 assert(Object.values(lowStock.models).every(model=>model.texturesReady&&Object.values(model.atlasSizes).every(([w,h])=>w<=1024&&h<=1024)),'Stocked low-tier map budget exceeded');
 report.showroomLow={monarch:lowStock,profile:await call('drawProfile',5)};
 stage('showroom one full-detail source: high tier');
 await batch([['graphics',['high']],draw,draw]);await settle();
 const highFocus=(await call('monarchAssets')).heroSource;
 report.showroomHigh={monarch:await textures('high',highFocus),profile:await call('drawProfile',5)};
 assert(highFocus&&Object.values(report.showroomHigh.monarch.models).filter(model=>model.targetTextures==='high').length===1,'Showroom did not retain exactly one full-detail family');
 }
 report.final={faults:await call('frameFaults'),gpu:await call('gpuContext'),profile:await call('drawProfile',5),
  assets:await call('assetCars'),char:await call('assetChar'),headroom:await call('cabinHeadroom')};
 assert(!report.final.faults.count&&!report.final.gpu.lost&&!report.errors.length,'Final renderer/GPU errors');
 assert(!report.final.char.models.length,'Lingering char state after repaired fixtures');
 report.pass=true;report.status='passed';stage('complete');console.log('PASS Monarch native runtime review',report.checks);
}catch(error){report.pass=false;report.status='failed';report.failure=error.stack||String(error);console.error(report.failure);process.exitCode=1;}
finally{save();await browser.close();}
