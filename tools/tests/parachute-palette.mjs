// Real Three.js mesh buffers and production palette/rig updates. The fixture
// starts fully open, deliberately skipping every shaded deployment frame.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
const RESERVE = ['#e8f4e8','#29475a','#4bbfa8','#e8f4e8','#e8f4e8','#e8f4e8','#4bbfa8','#29475a','#e8f4e8'];
const MAIN = ['#1d2f5e','#e8e4da','#d2362a','#d2362a','#f0c23a','#d2362a','#d2362a','#e8e4da','#1d2f5e'];
function paletteHost(overrides) {
  const read = name => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  const c = vm.createContext({
    Three, Math, Set, Map, Float32Array, scene:new Three.Scene(), UNITS_PER_METRE:8, PERSON_HEIGHT:14, TAU:Math.PI*2,
    clamp:(x,a,b)=>Math.max(a,Math.min(b,x)), worldMeters:x=>x/8,
    player:{x:1000,y:1000,altitude:8000}, gameTime:10, worldResetSerial:0,
    entityElevation:e=>e.altitude||0, terrainHeight:()=>0, actionHeld:()=>false,
    cloudRigAmount:0, cloudRigLight:new Three.Color(1,1,1), boxGeo:new Three.BoxGeometry(1,1,1),
    mat:(color,roughness)=>new Three.MeshStandardMaterial({color,roughness}),
  });
  vm.runInContext(`function box(parent,x,y,z,w,h,d,material) {
    const mesh=new Three.Mesh(boxGeo,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
  }\n` + ['parachute3d-canopy','parachute3d-pose','parachute3d-rigging','parachute3d-cutaway'].map(read).join('\n') + `
    player.parachute={stage:'canopy',phase:'open',phaseK:1,opening:1,canopy:'main',deploy:12,flown:8,brakesSet:false,heading:0,vx:69,vy:0,vz:-28,load:1};
    chuteRig.harness.set(player.x,player.altitude+11.4,player.y);chuteRig.upright=1;
    globalThis.api={skin:chuteSkin,ribs:chuteRibs,info:chuteSkinInfo,perStrip:chutePerStrip,ribPoints:CHUTE_RIB_POINTS,
      render(){chuteShape.time=0;updateParachute3D(1/60);},
      palette:chuteSetReservePalette,
      wing(canopy){player.parachute.canopy=canopy;player.parachute.stage='canopy';player.parachute.phase='open';player.parachute.opening=1;},
      cut(){Object.assign(player.parachute,{stage:'freefall',opening:0,cutaway:{at:gameTime,x:player.x,y:player.y,vx:69,vy:0,heading:0}});},
      detached:()=>chuteCutaway.mesh, shaded:()=>chuteShaded,
    };`, c);
  return c.api;
}
const closeArray = (a,b) => a.length===b.length && a.every((value,i)=>Math.abs(value-b[i])<1e-6);
function expectedSkin(api,palette) {
  const a=new Float32Array(api.skin.geometry.attributes.color.array.length), tone=new Three.Color();
  for(let v=0;v<a.length/3;v++){
    const upper=api.info[v*4+3], cell=Math.floor(v/api.perStrip)%9,
      tape=upper&&api.info[v*4+1]<0.04?1.18:1;
    tone.set(palette[cell]).multiplyScalar((upper?1:0.62)*tape);a.set([tone.r,tone.g,tone.b],v*3);
  }
  return a;
}
function expectedRibs(api,palette) {
  const a=new Float32Array(api.ribs.geometry.attributes.color.array.length), tone=new Three.Color(), count=api.ribPoints*2+1;
  for(let rib=0;rib<10;rib++){
    tone.set(palette[Math.min(8,rib)]).multiplyScalar(rib===0||rib===9?0.8:0.45);
    for(let i=0;i<count;i++)a.set([tone.r,tone.g,tone.b],(rib*count+i)*3);
  }
  return a;
}
export function checkChutePalette(t,overrides={}) {
  const api=paletteHost(overrides), skin=api.skin.geometry.attributes.color, ribs=api.ribs.geometry.attributes.color;
  api.render();
  const geometry=api.skin.geometry, material=api.skin.material, ribMaterial=api.ribs.material,
    positions=geometry.attributes.position.array.slice(), ribPositions=api.ribs.geometry.attributes.position.array.slice(),
    main=skin.array.slice(), mainRibs=ribs.array.slice();
  t.assert(!api.shaded(),'fixture renders a fully open main without any shaded opening frames');
  t.assert(closeArray(main,expectedSkin(api,MAIN))&&closeArray(mainRibs,expectedRibs(api,MAIN)),'initial visible skin and every rib use the original main palette');
  api.cut();api.render();
  const detached=api.detached();
  t.assert(!!detached,'the drawn main is frozen when cut away');
  const frozen=detached?.children[0].geometry.attributes.color, frozenRibs=detached?.children[1].geometry.attributes.color,
    detachedColors=frozen?.array.slice(), detachedRibColors=frozenRibs?.array.slice();
  t.assert(frozen!==skin&&frozen?.array!==skin.array&&frozenRibs!==ribs,'released main owns independent live color attributes and arrays');
  t.assert(closeArray(detachedColors,main)&&closeArray(detachedRibColors,mainRibs),'released main starts with its own original skin and rib colors');
  const versions=[];
  for(const reserve of [true,false,true,false]){
    const beforeSkin=skin.version,beforeRibs=ribs.version;
    api.wing(reserve?'reserve':'main');api.render();
    const palette=reserve?RESERVE:MAIN;
    t.assert(!api.shaded(),'full-open palette transition does not rely on inflation shading');
    t.assert(closeArray(skin.array,expectedSkin(api,palette)),(reserve?'reserve':'main')+': all upper/lower skins, cell strips and reinforcement bands update in the actual mesh color buffer');
    t.assert(closeArray(ribs.array,expectedRibs(api,palette)),(reserve?'reserve':'main')+': every rib and tip uses the selected palette');
    t.assert(skin.version>beforeSkin&&ribs.version>beforeRibs,'palette changes mark both real BufferAttributes for GPU upload');
    t.assert(api.skin.geometry===geometry&&api.skin.material===material&&api.ribs.material===ribMaterial,'palette change preserves geometry and material identities');
    t.assert(closeArray(geometry.attributes.position.array,positions)&&closeArray(api.ribs.geometry.attributes.position.array,ribPositions),'palette change preserves every neutral skin and rib vertex position');
    t.assert(closeArray(frozen.array,detachedColors)&&closeArray(frozenRibs.array,detachedRibColors),'changing the live wing never recolors the frozen released main');
    const stableSkin=skin.version,stableRibs=ribs.version;api.render();
    t.assert(skin.version===stableSkin&&ribs.version===stableRibs,'unchanged full-open palette causes no redundant color uploads');
    versions.push({canopy:reserve?'reserve':'main',skin:skin.version,ribs:ribs.version});
  }
  return {vertices:skin.count,ribVertices:ribs.count,versions};
}
export default async function(t){t.note(JSON.stringify(checkChutePalette(t)));}
