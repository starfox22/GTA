// Production scheduler against a deterministic clock; slow generators and several
// vehicles must share a render allowance even when wall time crosses 5 ms.
import fs from 'node:fs';
import vm from 'node:vm';

export function checkCarBloodBudget(t, source = fs.readFileSync(new URL('../../src/carblood3d-skin.js', import.meta.url), 'utf8')) {
  let now = 0;
  const c = vm.createContext({ Three: {Vector2: class {}}, performance:{now:()=>now},
    setTimeout(){}, console, clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    carBloodSkins:new Map([[1,{}]]), cbDeadline:0 });
  vm.runInContext(source + '\nglobalThis.testBudget={begin:typeof cbBeginFrame==="function"?cbBeginFrame:cbFrame,slice:cbSlice,probe:cbProbe,left:()=>cbFrameLeft};', c);
  const b=c.testBudget, output=[];
  const job=(name,count,cost=1)=>({ms:0,slices:0,gen:(function*(){
    for(let i=0;i<count;i++){now+=cost;output.push(name+':'+i);yield;}
  })()});
  b.begin();
  const a=job('a',8),d=job('d',3);
  b.slice(a);const first=output.length;
  t.assert(first===3,'first vehicle spends only the shared 3 ms allowance');
  now+=30; b.slice(d);
  t.assert(output.length===first,'a long render does not refill the allowance for another car');
  t.assert(b.probe.frameWork===3,'frame probe aggregates work across the actual render');
  b.begin(); b.slice(d);
  t.assert(output.includes('d:2'),'the next explicit render opens a fresh budget');
  t.assert(b.probe.workMax===3,'completed frame work is measured without timestamp splits');
  b.begin(); const slow=job('slow',2,7); b.slice(slow);
  const afterSlow=output.length; b.slice(a);now+=40;b.slice(d);
  t.assert(output.length===afterSlow,'one indivisible overrun blocks all later jobs in that frame');
  b.begin();const quick=job('quick',1,.1);b.slice(quick);const quickCount=output.length;
  now+=.2;b.begin();b.slice(a);
  t.assert(output.length>quickCount,'distinct fast renders get a new allowance even within 5 ms');
  const done=new Set();
  for(let frame=0;frame<30&&done.size<3;frame++){
    b.begin();
    for(const [name,j]of [['a',a],['d',d],['slow',slow]]) if(!done.has(name)&&b.slice(j))done.add(name);
  }
  t.assert(done.size===3,'all queued generators eventually complete');
  for(const [name,count]of [['a',8],['d',3],['slow',2],['quick',1]])
    t.assert(JSON.stringify(output.filter(x=>x.startsWith(name+':')))===JSON.stringify(Array.from({length:count},(_,i)=>name+':'+i)),name+' keeps exact output order without skipped or duplicate steps');
  return {outputs:output,workMax:b.probe.workMax,worstSlice:b.probe.worstSlice,slices:b.probe.slices};
}

export default async function(t){
  checkCarBloodBudget(t);
  const frame=fs.readFileSync(new URL('../../src/render3d-frame.js',import.meta.url),'utf8');
  t.assert((frame.match(/cbBeginFrame\(\)/g)||[]).length===1,'renderer opens the shared allowance exactly once');
  t.assert(frame.indexOf('cbBeginFrame()')<frame.indexOf("profileLap('r:vehicles'"),'allowance opens before the vehicle pass');
}
