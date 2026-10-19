import path from 'node:path';import{fileURLToPath}from'node:url';
import fs from'node:fs';import vm from'node:vm';import assert from'node:assert/strict';import{host}from'./host-base.mjs';
const gameRoot=process.env.DEC_GAME_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=n=>fs.readFileSync(path.join(gameRoot,'src',n+'.js'),'utf8');
const fn=(f,n)=>{const s=read(f),a=s.indexOf('    function '+n+'('),b=s.indexOf('\n    }',a);if(a<0)throw Error(n);return s.slice(a,b+6)};
const baseline=fs.readFileSync(new URL('./crowd-reactions-before.js',import.meta.url),'utf8');
let assertions=0;const close=(a,b,msg)=>{assert.ok(Math.abs(a-b)<1e-8,msg+': '+a+' vs '+b);assertions++};
function make(before=false){const c=host(),no=()=>false;Object.assign(c,{buildings:[],CITY_SIZE:10000,LINERS:[],groundAt:()=>true});for(const n of['sportsBlocked','railBlocked','parkPondBlocked','airportSceneryBlocked','garageBlocked','parkBlocked','monarchBlocked','northPointKeyBlocked','marinaBlocked','beachBlocked','promenadeRailBlocked','streetEndBlocked','beachClubBlocked','harborBlocked','depotBlocked','countyBlocked','militaryBlocked'])c[n]=no;
vm.runInContext('const BUILDING_CELL=256,buildingGrid=new Map(),noBuildings=[];\n'+['buildBuildingGrid','buildingsNear','solid'].map(n=>fn('game-collision',n)).join('\n'),c);
if(before){const a=baseline.indexOf('    function updateReaction('),b=baseline.indexOf('\n    }',a);vm.runInContext(baseline.slice(a,b+6),c);}
const api=vm.runInContext(`({updateReaction,startReaction,moveBody,pointInCar,sweptPersonContact,buildBuildingGrid,nearMisses,watchVehicle,carAct,vehicleSpec,
 create(extra={}){randomSeed=4242;const p={x:0,y:0,a:0,hp:30,flee:0,walk:0,state:'idle'};dressPerson(p,'casual');startReaction(p,'dodge',.5,{x:-100,y:0},null,{leap:0,then:'hurry',...extra});pedestrians.push(p);return p;},
 contact(p,c,from){touchVehicle=c;touchSpeed=Math.hypot(c.vx,c.vy);touchReach=vehicleSpec(c).l+100;touchContacts=new Set();c.personSweepStart=from;touchPerson(p);return!!p.carHit;}})`,c);return{c,api}}
const configurations=[['default',55,.42,.5],['back',46,.36,.5],['calm',30,.8,.95]];
const results=[];
for(const[name,V,T,dur]of configurations)for(const dt of[1/60,1/30,.133,.2,.6]){
 const expected=t=>{const q=Math.min(T,Math.max(0,t));return(V+10)*q-V*q*q/(2*T)};
 let pair={name,dt,expected:expected(T)};
 for(const before of[true,false]){const{c,api}=make(before),p=api.create({leap:1.1,leapV:V,leapFor:T,calm:name==='calm'});p.react.dur=dur;let elapsed=0,maxError=0,samples=[];
 while(elapsed<dur+dt){elapsed+=dt;c.gameTime=elapsed;if(p.react)api.updateReaction(p,dt);const along=p.x*Math.cos(1.1)+p.y*Math.sin(1.1),ideal=expected(elapsed);maxError=Math.max(maxError,Math.abs(along-ideal));if(!before){close(along,ideal,name+' trajectory at'+elapsed);close(p.x,-p.y/Math.tan(1.1)*-1,name+' direction');}samples.push({t:+elapsed.toFixed(6),distance:+along.toFixed(8),expected:+ideal.toFixed(8)});}
 pair[before?'before':'after']={distance:Math.hypot(p.x,p.y),maxError,samples};}
 results.push(pair);
}
const collisions=[];
for(const dt of[1/60,1/30,.133,.2,.6,2]){
 for(const kind of['thin-wall','vehicle','escape-vehicle']){const{c,api}=make();if(kind==='thin-wall'){c.buildings.push({x:10,y:-100,w:.25,h:200});api.buildBuildingGrid();}else c.vehicles.push({type:'sedan',x:26,y:0,a:0,hp:100,vx:0,vy:0});
 const p=api.create({leap:kind==='escape-vehicle'?Math.PI:0});if(kind==='escape-vehicle')p.x=3;
 let elapsed=0;while(elapsed<.7){elapsed+=dt;c.gameTime=elapsed;if(p.react)api.updateReaction(p,dt);}
 if(kind==='thin-wall'){assert.ok(p.x<=5,'crossed wall');assertions++;}else if(kind==='vehicle'){assert.ok(!api.pointInCar(p.x,p.y,c.vehicles[0],5),'entered blocker');assertions++;}else{assert.ok(p.x<0&&!api.pointInCar(p.x,p.y,c.vehicles[0],5),'failed escape');assertions++;}
 collisions.push({kind,dt,x:p.x,y:p.y});}
 // The ordinary swept contact must still register before a later coarse reaction moves the actor.
 const{c,api}=make(),p=api.create(),car={type:'sedan',x:40,y:0,a:0,hp:100,vx:80*8/3.6,vy:0};c.vehicles.push(car);const hit=api.contact(p,car,{x:-40,y:0,a:0});assert.ok(hit,'lost swept contact');assertions++;collisions.push({kind:'swept-contact-before-reaction',dt,hit});
}
const report={kind:'Production dodge movement integration and collision fixture; no population/decision/rate acceptance claim',assertions,configurations,results,collisions,notes:['Before and after run actual updateReaction, startReaction/endReaction, moveBody, solid/building grid, footStepVehicleBlocked/vehicle grid, pointInCar, touchPerson/knockPerson/sweptPersonContact.','No changes to watchVehicle/carAct/RNG/traits/outcome selection.','World site blockers other than fixture building are empty. Post-hit damage/flight/crime side effects remain bounded as described by the separate awareness diagnosis.','Off-camera person movement still occurs in coarse cadence after ordinary vehicle contacts; exact distance fixes under-integration but does not claim continuous simultaneous moving-person/vehicle time-of-impact or alter CCD/update order.']};
fs.writeFileSync(new URL('./dodge-integral-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({assertions,defaultDistances:results.filter(x=>x.name==='default').map(x=>({dt:x.dt,before:x.before.distance,after:x.after.distance})),collisionCases:collisions.length}));
