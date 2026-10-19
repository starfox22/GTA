import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root='/workspace/GTA', test=root+'/tools/tests/parachute-reserve.mjs';
const original=fs.readFileSync(test,'utf8');
// Expose the existing bounded production fixture without modifying test/source bytes.
const fixtureModule=original.replaceAll('import.meta.url',JSON.stringify('file://'+test))+'\nexport { chuteHost };';
const {chuteHost}=await import('data:text/javascript;base64,'+Buffer.from(fixtureModule).toString('base64'));
const input=fs.readFileSync(root+'/src/game-input.js','utf8');
const handlerSource=input.slice(input.indexOf("    window.addEventListener('keydown'"),input.indexOf('    /* weapon1..weapon6'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={kind:'Independent host execution of actual production keydown handler, controls and parachute solver. Empty dry site; no browser/native-render claim.',startedAt:new Date().toISOString(),gameInputSha256:hash(input),fixtureSha256:hash(original),sourceHashes:Object.fromEntries(['controls','falls-body','parachute'].map(f=>[f,hash(fs.readFileSync(root+'/src/'+f+'.js'))])),assertions:0,cases:[]};
const check=(ok,label)=>{report.assertions++;if(!ok)throw Error(label)};
for(const hz of [30,60,120])for(const key of ['KeyJ','KeyK']){
 const {c,api,step}=chuteHost();let keydown;
 Object.assign(c,{window:{addEventListener:(type,fn)=>{if(type==='keydown')keydown=fn}},document:{activeElement:null},sportsbook:{open:false},feedCheatBuffer:()=>false,rideSkipActive:()=>false});
 vm.runInContext(handlerSource,c);
 api.fresh(2200);c.player.parachute=null;c.player.car={type:'helicopter',x:1500,y:1500,a:.4,altitude:2200*8,vx:80,vy:30};
 if(key==='KeyK')api.bind('bail',0,key,true);
 const down=(repeat=false)=>keydown({code:key,key:key.slice(3).toLowerCase(),repeat,preventDefault(){}});
 const release=()=>api.up(key);
 down();step(1,hz);let p=c.player.parachute;
 check(p.stage==='freefall'&&!p.mainUsed,'actual bailout key must stay freefall while held');
 down(true);step(.5,hz);check(p.stage==='freefall'&&!p.mainUsed,'auto-repeat after bailout must not deploy');
 release();down();check(p.stage==='canopy'&&p.mainUsed&&!p.reserveUsed&&p.phase==='pilot','keyup then next keydown without a simulation tick pulls main');
 step(.9,hz);release();down();check(p.phase==='lines'&&!p.cutaway,'fresh opening-phase press must not cut main');
 step(6,hz);check(p.phase==='open'&&p.stage==='canopy'&&!p.cutaway,'opening-phase held press must not cut at eventual open');
 down(true);step(.1,hz);check(p.stage==='canopy','repeat on open main must remain canopy');
 release();down();check(p.stage==='freefall'&&p.mainUsed&&!p.reserveUsed&&!p.armed,'actual fresh keydown cuts open main once');
 const cutAltitude=c.player.altitude;step(2,hz);down(true);step(.1,hz);
 check(p.stage==='freefall'&&!p.reserveUsed&&c.player.altitude<cutAltitude,'held cutaway + repeat must not pull reserve');
 release();down();check(p.stage==='canopy'&&p.canopy==='reserve'&&p.reserveUsed&&p.phase==='pilot','fresh second edge pulls exactly one staged reserve');
 step(4,hz);check(p.phase==='open'&&p.canopy==='reserve','reserve must reach normal flying stage');
 for(let i=0;i<3;i++){release();down();step(.05,hz);down(true);}
 check(c.player.parachute===p&&p.stage==='canopy'&&p.canopy==='reserve'&&p.reserveUsed&&!p.armed,'further fresh/repeat presses must not cut/replenish reserve');
 report.cases.push({hz,key,pass:true,cutAltitudeM:cutAltitude/8,reserveAltitudeM:c.player.altitude/8,mainUsed:p.mainUsed,reserveUsed:p.reserveUsed});
}
report.finishedAt=new Date().toISOString();report.pass=true;fs.writeFileSync(root+'/work/aviation-review/qa/keyboard-edge-host.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,assertions:report.assertions,cases:report.cases.length}));
