// Ordinary mission 2 objective flow: one initial story frontier fixture, then only movement/action inputs.
import fs from 'node:fs';
import vm from 'node:vm';
import {call,keys,wait,E,walkPath,log} from './driver.mjs';
const terrace={x:-1844,y:2250,w:360,h:350,height:240};
const scope=vm.createContext({ROOFTOP:terrace,player:{},Math,
  distanceBetween:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  headingBetween:(a,b)=>Math.atan2(b.y-a.y,b.x-a.x),
  normalizeAngle:a=>Math.atan2(Math.sin(a),Math.cos(a)),
  terrainHeight:()=>0,vehicleSpec:()=>null});
const plan=vm.runInContext(fs.readFileSync(new URL('../../src/roofmission-layout.js',import.meta.url),'utf8')+'\n({roofPointFree,roofGuardSees,roofSight,roofPathClear,ROOF_HIT});',scope);
const world=p=>({x:p.x+terrace.x,y:p.y+terrace.y,altitude:243});
const locals=[];for(let y=24;y<328;y+=8)for(let x=24;x<338;x+=8)if(plan.roofPointFree(x+terrace.x,y+terrace.y,8))locals.push({x,y});
const pointMap=new Map(locals.map((p,i)=>[`${p.x},${p.y}`,i]));
const edges=locals.map(p=>[[-8,0],[8,0],[0,-8],[0,8],[-8,-8],[8,-8],[-8,8],[8,8]].map(([x,y])=>pointMap.get(`${p.x+x},${p.y+y}`)).filter(i=>i!==undefined&&plan.roofPathClear(world(p),world(locals[i]))));
function planRoof(s,target='glass'){
  const guards=s.guards.filter(g=>g.hp>0).map(g=>({...world(g),a:g.view,hp:g.hp})),
    seen=p=>guards.reduce((sum,g)=>sum+([-.18,0,.18].some(turn=>plan.roofGuardSees({...g,a:g.a+turn},world(p)))?1:0),0),
    exposure=locals.map(seen),
    start=locals.reduce((best,p,i)=>Math.hypot(p.x-s.player.x,p.y-s.player.y)<Math.hypot(locals[best].x-s.player.x,locals[best].y-s.player.y)?i:best,0),
    goals=locals.map((p,i)=>({p,i})).filter(({p,i})=>typeof target==='object'?Math.hypot(p.x-target.x,p.y-target.y)<7:target==='lift'?Math.hypot(p.x-72,p.y-303)<10:target==='hide'?exposure[i]===0&&Math.hypot(p.x-s.player.x,p.y-s.player.y)<180&&Math.hypot(p.x-s.player.x,p.y-s.player.y)>24&&guards.every(g=>Math.hypot(g.x-world(p).x,g.y-world(p).y)>42):exposure[i]===0&&Math.hypot(p.x-278,p.y-131)<33&&plan.roofSight(world(p),plan.ROOF_HIT.drink)),
    goalSet=new Set(goals.map(g=>g.i));
  if(!goals.length&&target==='glass')return{path:[],seen:seen(s.player),goal:null,waiting:true};if(!goals.length)throw Error('No roof goals '+target);
  const heuristic=i=>Math.min(...goals.map(g=>Math.hypot(locals[i].x-g.p.x,locals[i].y-g.p.y)));
  const g=new Map([[start,0]]),prev=new Map(),open=[start],closed=new Set();
  while(open.length){let bi=0,bf=Infinity;for(let i=0;i<open.length;i++){const f=g.get(open[i])+heuristic(open[i]);if(f<bf){bf=f;bi=i;}}const n=open.splice(bi,1)[0];if(goalSet.has(n)){const path=[n];while(prev.has(path[0]))path.unshift(prev.get(path[0]));return {path:path.map(i=>locals[i]),seen:seen(s.player),goal:locals[n]};}closed.add(n);for(const q of edges[n]){if(closed.has(q))continue;const cost=g.get(n)+Math.hypot(locals[q].x-locals[n].x,locals[q].y-locals[n].y)*(1+exposure[q]*12);if(cost<(g.get(q)??Infinity)){g.set(q,cost);prev.set(q,n);if(!open.includes(q))open.push(q);}}}
  throw Error('No roof route');
}
async function roofStep(target){const s=await call('roofStealth');if(!s||!s.onRoof||s.alarm)throw Error('Roof failed '+JSON.stringify(s));const route=planRoof(s,target);if(route.waiting){await wait(.4);return{s,route,arrived:false};}const next=route.path[Math.min(route.path.length-1,2)],dx=next.x-s.player.x,dy=next.y-s.player.y,codes=[];if(Math.abs(dx)>1.5)codes.push(dx>0?'KeyD':'KeyA');if(Math.abs(dy)>1.5)codes.push(dy>0?'KeyS':'KeyW');if(!codes.length)return {s,route,arrived:true};const active=[Math.abs(dx),Math.abs(dy)].filter(x=>x>1.5),flee=typeof target==='object'&&target.flee;if(flee)codes.push('Walk');const duration=Math.min(.6,...active.map(x=>x/(flee?55:12)));await keys(codes,Math.max(1/30,duration));return {s,route,arrived:false};}
await call('holdSimulation',true);
if(!process.argv.includes('--roof')) {
await call('god',false);
await call('storyProgress',1,false);
await E();await keys('Enter',.1,true);
log('mission2Call',await call('missionState'));
// Reach the wardrobe, then cross the permanent Keys Bridge on foot.
for(const [x,y]of[[882,1964]])await walkPath(x,y,{radius:160,limit:900});
await E();log('guestAttire',await call('missionState'));
for(const [x,y]of[[200,1152],[-1420,1152],[-1410,2624],[-1664,2622]])await walkPath(x,y,{radius:150,limit:1000});
await E();await wait(2);
log('terraceArrival',await call('roofStealth'));
}
let spiked=false,cooling=false,hideGoal=null;
for(let i=0;i<400&&!spiked;i++){
 const s=await call('roofStealth');if(s.alarm)throw Error('Cover blown '+JSON.stringify(s));
 if(s.suspicion>35&&!cooling){cooling=true;hideGoal={...planRoof(s,'hide').goal,flee:true};}if(s.suspicion<10){cooling=false;hideGoal=null;}
 const atGlass=Math.hypot(s.player.x-278,s.player.y-131)<35;
 if(atGlass&&!s.guards.some(g=>g.hp>0&&g.sees)){
  await keys('KeyP',.1,true);const p=await call('roofPoison');spiked=p.used||p.phase==='approach'||p.phase==='reach';log('poisonAttempt',p);if(spiked)break;
 }
 const r=await roofStep(cooling?hideGoal:'glass');
 if(r.arrived){if(cooling&&r.s.guards.some(g=>g.hp>0&&g.sees))hideGoal={...planRoof(r.s,'hide').goal,flee:true};else await wait(.3);}
 if(i%10===0)log('stealthProgress',{i,state:s,target:r.route.goal,cooling});
}
if(!spiked)throw Error('Never found an unseen poisoning opening');
for(let i=0;i<250;i++){const r=await roofStep('lift');if(Math.hypot(r.s.player.x-36,r.s.player.y-306)<48)break;}
let p=await call('roofPoison');for(let i=0;i<100&&p.phase!=='dead';i++){await wait(.5);p=await call('roofPoison');}
if(p.phase!=='dead')throw Error('Poison never completed '+JSON.stringify(p));
log('poisonedAtLift',{poison:p,stealth:await call('roofStealth'),status:await call('status')});
await E();await wait(2);
log('streetEscape',await call('missionState'));
await walkPath(-1330,2624,{radius:100,limit:500});await wait(2);
const outcome=await call('missionState');log('mission2Outcome',{outcome,status:await call('status'),errors:await call('frameFaults')});
if(outcome.last?.result!=='won'||outcome.last.index!==1)throw Error('Mission 2 did not win');
