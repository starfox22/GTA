import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';import path from 'node:path';import {fileURLToPath,pathToFileURL}from'node:url';
const gameRoot=process.env.DEC_GAME_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=f=>fs.readFileSync(path.join(gameRoot,'src',f+'.js'),'utf8');
const fn=(f,n)=>{const s=read(f),a=s.indexOf('    function '+n+'(');if(a<0)throw Error('missing '+n);const b=s.indexOf('\n    }',a);return s.slice(a,b+6);};
function host(){
 const noop=()=>{},ctx=vm.createContext({Math,Set,Map,UNITS_PER_METRE:8,KMH:8/3.6,GRAVITY:9.81*8,KNOTS:8*.514444,hypot2:Math.hypot,worldMeters:v=>v/8,gameTime:0,worldMinutes:1040,player:{x:420,y:4600},vehicles:[],pedestrians:[],weather:{rain:0},crowd:{timers:{near:0}},hudClockOffset:0,wantedStars:0,cash:0,voicesOn:false,screamAt:-100,bloodOn:false,RIDER_SEAT:0,
  isBoat:()=>false,isAircraft:()=>false,emergencyBeacons:()=>false,aircraftClearance:()=>0,actionHeld:()=>false,
  // This bounded open-ground scene supplies no buildings, shore, bridge or furniture. Production vehicle obstruction remains active.
  solid:()=>false,drawbridgeFootBlocked:()=>false,crowdSight:()=>true,sameFloor:()=>true,
  personOnGround:p=>(p.knockedFor||0)>0,vehicleImpactState:()=>({phase:'flight',vehicleHit:true}),
  strikePerson:(p,d)=>{p.hp-=d;},addCarStain:noop,crowdAlarm:noop,crime:noop,clearPolice:noop,playPersonScream:noop,
  crowdInView:()=>true,leaveScene:noop,rejoinScene:noop,
 });
 const math=read('game-state');vm.runInContext(math.slice(math.indexOf('    const clamp ='),math.indexOf('    let viewportWidth')),ctx);
 const paint=math.slice(math.indexOf('    const PAINT_EVERYDAY'),math.indexOf(';',math.indexOf('    const PAINT_EVERYDAY'))+1);vm.runInContext(paint,ctx);
 const defs=read('game-vehicles');vm.runInContext(defs.slice(defs.indexOf('    const VEHICLE_DEFINITIONS'),defs.indexOf('    // Conservative vertical envelope')),ctx);
 for(const f of ['crowd-looks','crowd-speech','crowd-chatter','crowd-perception','crowd-awareness','crowd-reactions','crowd-awareness-console'])vm.runInContext(read(f),ctx,{filename:f+'.js'});
 vm.runInContext(fn('crowd-walking','faceToward')+'\n'+fn('crowd-walking','snapAxis')+'\n'+fn('citylife-civic','scream')+'\n'+fn('physics-shapes','pointInCar'),ctx);
 const gc=read('game-collision');vm.runInContext(gc.slice(gc.indexOf('    const VEHICLE_CELL'),gc.indexOf('    /* solid() for a foot step.')),ctx);
 vm.runInContext(['footSolid','footStepBlocked','moveBody'].map(n=>fn('game-collision',n)).join('\n'),ctx);
 vm.runInContext('const sweepProbe={type:null,airframe:null,x:0,y:0,a:0};\n'+['personIncapacitated','vehicleImpactDamage','knockPerson','sweptPersonContact'].map(n=>fn('physics-knockdowns',n)).join('\n'),ctx);
 vm.runInContext('let touchVehicle=null,touchSpeed=0,touchReach=0,touchContacts=null;\n'+fn('physics-update','touchPerson'),ctx);
 vm.runInContext(`
 const productionDressPerson=dressPerson;
 dressPerson=(p,role)=>{gameTime=0;crowd.timers.near=0;ambientSaidAt=-100;screamAt=-100;return productionDressPerson(p,role);};
 crowdAlarm=()=>{};
 function forPeopleNear(x,y,r,call){for(const p of pedestrians)if(Math.hypot(p.x-x,p.y-y)<=r)call(p);}
 function update(dt){
   gameTime+=dt;const c=player.car,from={x:c.x,y:c.y,a:c.a};c.personSweepStart=from;c.x+=c.vx*dt;c.y+=c.vy*dt;
   touchVehicle=c;touchSpeed=Math.hypot(c.vx,c.vy);touchReach=vehicleSpec(c).l+100;touchContacts=new Set();
   for(const p of pedestrians)touchPerson(p);
   nearMisses(dt);
   for(const p of pedestrians)if(p.hp>0&&!personIncapacitated(p)&&p.react)updateReaction(p,dt);
 }
 function run(options){gameTime=0;crowd.timers.near=0;vehicles.length=0;pedestrians.length=0;const c={type:'sedan',x:420,y:4600,a:0,hp:100,vx:0,vy:0,speed:0};vehicles.push(c);player.car=c;player.x=420;player.y=4600;return awarenessConsole().carAwarenessTrials({samples:10,seed:4242,detail:true,...options});}
 globalThis.run=run;
 `,ctx);
 return ctx;
}
const cases=[['toward',{facing:'toward',kmh:40,gap:220}],['away',{facing:'away',kmh:40,gap:220}],['horn',{facing:'away',kmh:40,gap:220,horn:true}],['side',{facing:'side',kmh:40,gap:220}],['farFast',{facing:'toward',kmh:80,gap:330}],['close',{facing:'toward',kmh:40,gap:40}],['fast',{facing:'toward',kmh:80,gap:100}],['phone',{facing:'toward',kmh:40,gap:130,attention:'text'}],['alert',{facing:'toward',kmh:40,gap:130}]];
const results={};for(const[n,o]of cases){results[n]=host().run(o);console.log(n,JSON.stringify({noticed:results[n].noticed,tried:results[n].tried,cleared:results[n].cleared,hit:results[n].hit,silent:results[n].silent,outcomes:results[n].outcomes}));}
fs.writeFileSync(new URL('./prototype-results.json',import.meta.url),JSON.stringify({kind:'Exploratory open-ground production-function microhost, not shipping live-world integration acceptance',sourceCommit:'339ba035',stubs:['empty static ground/clear line of sight/no drawbridge; fixed same floor; damage/ballistics after contact; presentation/audio; no world population'],production:['dressPerson + production RNG','nearMisses/watchVehicle/carAct','crowdSay/pickLine/main RNG','startReaction/endReaction/updateReaction','moveBody/footStepBlocked/footStepVehicleBlocked/vehicle grid','sweptPersonContact/pointInCar/touchPerson/knockPerson'],rates:results},null,2)+'\n');

const checks=[];const t={call:async(m,...a)=>m==='carAwarenessTrials'?host().run(a[0]):null,assert:(ok,message)=>checks.push({pass:!!ok,message}),note:()=>{}};const original=await import(pathToFileURL(path.join(gameRoot,'tools/tests/pedestrian-awareness.mjs')));await original.default(t);fs.writeFileSync(new URL('./unchanged-assertions.json',import.meta.url),JSON.stringify({source:'tools/tests/pedestrian-awareness.mjs (unmodified)',checks,pass:checks.every(x=>x.pass)},null,2)+'\n');console.log('Unmodified assertions',checks.filter(x=>!x.pass));
