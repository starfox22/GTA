// Production chase update/projection and real Three.js chute vertices. No WebGL:
// the isolated level-site fixture verifies framing, not pixels or hardware FPS.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
function framingHost(overrides = {}) {
  const read = name => overrides[name] ?? fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
  const held = new Set(), scene = new Three.Scene();
  const c = vm.createContext({
    Three, Math, Set, Map, Float32Array, scene, UNITS_PER_METRE: 8, PERSON_HEIGHT: 14, KMH: 8 / 3.6, GRAVITY: 9.81 * 8, TAU: Math.PI * 2,
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)), normalizeAngle: x => Math.atan2(Math.sin(x), Math.cos(x)), worldMeters: x => x / 8,
    player: { x: 1000, y: 1000, altitude: 8000, a: 0 }, gameTime: 0, gameMode: 'play', viewportWidth: 1000, viewportHeight: 700,
    worldResetSerial: 0, taxiRide: null, transitRide: null, settings: {}, mouse: {}, city3D: null, NO_RENDER: true,
    audio:null, master:null, soundOn:false, shake:0, tell:()=>{}, noise:()=>{}, tone:()=>{},pressKey:()=> 'PRESS J',keyName:()=> 'S',
    deckLandingStep:()=>false, deckSurfaceAt:()=>null, ROOFTOP:{x:-1e6,y:-1e6,w:10,h:10,height:10},
    localStorage: { getItem: () => null }, gamepad: {}, cameraFootMotion: { vx: 0, vy: 0 },
    actionHeld: action => held.has(action), currentWeapon: () => ({ melee: true }), motionComfortOn: () => false, slowFramingOn: () => true,
    isAircraft: c => c?.type === 'plane' || c?.type === 'helicopter', isBoat: () => false,
    vehicleSpec: c => c.spec, entityElevation: e => e.altitude || 0, terrainHeight: () => 0,
    buildingsNear: () => c.buildings, buildings: [], overheadCoverGrid: () => new Map(), OVERHEAD_CELL: 256,
    cloudRigAmount: 0, cloudRigLight: new Three.Color(1, 1, 1), boxGeo: new Three.BoxGeometry(1, 1, 1),
    mat: (color, roughness = 0.8) => new Three.MeshStandardMaterial({ color, roughness }),
  });
  vm.runInContext(read('chase-camera') + '\n' + read('parachute') + '\n' + `
    function box(parent,x,y,z,w,h,d,material) {
      const mesh = new Three.Mesh(boxGeo,material); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); parent.add(mesh); return mesh;
    }
  ` + ['parachute3d-canopy', 'parachute3d-pose', 'parachute3d-rigging', 'parachute3d-cutaway'].map(read).join('\n') + `
    const proxy = {group:new Three.Group(),torso:new Three.Object3D(),parts:{arm1:new Three.Object3D(),'arm-1':new Three.Object3D(),leg1:new Three.Object3D(),'leg-1':new Three.Object3D(),guns:[]}};
    globalThis.api = {
      cam:chaseCam, shape:c=>({...chaseShapeFor(c)}), update:updateChaseCamera, project:chaseProject, reset:resetChaseCamera,
      fresh(width,height,canopy='main') {
        viewportWidth=width; viewportHeight=height; player.car=null; player.swimming=false;player.x=player.y=1000;player.altitude=8000;
        player.parachute={stage:'canopy',phase:'open',phaseK:1,opening:1,canopy,elapsed:12,deploy:12,flown:8,brakesSet:false,heading:0,vx:69,vy:0,vz:-28,load:1};
        viewMode=VIEW_CHASE; resetChaseCamera();
      },
      render(dt) {poseParachutist(proxy,dt);updateParachute3D(dt);scene.updateMatrixWorld(true);},
      beginDeploy(reserve) {
        const p=player.parachute;
        p.stage='freefall';p.opening=0;p.mainUsed=reserve;p.reserveUsed=false;p.elapsed=0;p.vz=-54*8;p.vx=0;
        deployParachute();resetChaseCamera();
      },
      physics(dt) {updateParachute(dt);},
      points() {
        const points=[], at=new Three.Vector3();
        const visit=o=>{
          if(!o.visible)return;
          if(o.geometry?.attributes.position){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){at.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);points.push([at.x,at.z,at.y]);}}
          for(const child of o.children)visit(child);
        };
        visit(chuteRoot);
        // Conservative full jumper, including limbs; the real wing/lines/pilot
        // above are measured from their production meshes, not duplicated math.
        for(const x of [-6,6])for(const y of [-6,6])for(const z of [0,17])points.push([player.x+x,player.y+y,player.altitude+z]);
        return points;
      }
    };`, c);
  const tick = (seconds, hz = 60) => {
    for (let i = 0; i < Math.ceil(seconds * hz); i++) { c.gameTime += 1 / hz; c.api.update(1 / hz); c.api.render(1 / hz); }
  };
  return { c, api: c.api, held, tick };
}

export function checkChuteFraming(t, overrides = {}) {
  const { c, api, held, tick } = framingHost(overrides), facts = [];
  const bounds = () => {
    const b = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, behind: false };
    for (const point of api.points()) {
      const p = api.project(...point, {});
      b.left = Math.min(b.left, p.x); b.right = Math.max(b.right, p.x); b.top = Math.min(b.top, p.y); b.bottom = Math.max(b.bottom, p.y); b.behind ||= p.behind;
    }
    return b;
  };
  for (const [width, height] of [[1000,700],[960,600],[390,844],[360,800]]) for (const canopy of ['main','reserve']) {
    api.fresh(width,height,canopy); held.clear(); tick(2);
    const base = { ...api.cam }, ordinary = bounds();
    for (const turn of [null,'left','right']) {
      held.clear(); if(turn)held.add(turn); tick(1.5);
      const b = bounds();
      t.assert(!b.behind && b.left >= 8 && b.right <= width-8 && b.top >= 8 && b.bottom <= height-8,
        `${canopy} ${width}x${height} ${turn||'trim'}: whole jumper, wing, rigging and pilot must fit: ${JSON.stringify(b)}`);
      t.assert([api.cam.x,api.cam.y,api.cam.z,api.cam.dist].every(Number.isFinite), 'camera remains finite under canopy steering');
    }
    facts.push({ width, height, canopy, boomM: base.dist/8, pivotM:(base.pz-c.player.altitude)/8, bounds:ordinary });
  }
  for (const [width,height] of [[1000,700],[960,600],[390,844],[360,800]]) for (const reserve of [false,true]) for (const hz of [30,60]) {
    api.fresh(width,height);held.clear();api.beginDeploy(reserve);
    let fits=true,worst=null;
    for(let i=0;i<hz*6;i++){
      api.physics(1/hz);tick(1/hz,hz);
      if(i%5===0){
        const b=bounds();
        if(b.behind||b.left<0||b.right>width||b.top<0||b.bottom>height){fits=false;worst={phase:c.player.parachute.phase,opening:c.player.parachute.opening,boomM:api.cam.dist/8,bounds:b};break;}
      }
    }
    t.assert(fits,`${reserve?'reserve':'main'} ${width}x${height} ${hz}Hz: camera spring must keep the real growing rig in frame: ${JSON.stringify(worst)}`);
  }
  // Read the actual shape over deployment: line stretch changes continuously,
  // and the normal boom collision sweep is still allowed to take priority.
  api.fresh(1000,700); held.clear();
  const p = c.player.parachute;
  p.stage='freefall'; p.opening=0;
  const freefall=api.shape(null);
  t.assert(freefall.pivot===0.4&&freefall.dist===7.5&&freefall.fov===56,'ordinary freefall framing is unchanged');
  let previous=freefall;
  p.stage='canopy'; p.phase='lines';
  for(let i=0;i<=20;i++){
    p.phaseK=i/20;const s=api.shape(null);
    t.assert(s.pivot>=previous.pivot&&s.dist>=previous.dist&&s.pivot-previous.pivot<0.35&&s.dist-previous.dist<0.5,'line-stretch framing rises and widens continuously');
    previous=s;
  }
  p.phase='open';p.opening=1;tick(2);
  const open=api.shape(null);
  t.assert(open.pivot>3&&open.dist>=12,'open canopy targets the whole rig rather than the feet');
  p.stage='freefall';p.opening=0;p.cutaway={at:c.gameTime};
  t.assert(api.shape(null).pivot===open.pivot,'cutaway starts from the existing pivot without a camera snap');
  c.gameTime+=1;
  t.assert(api.shape(null).pivot===freefall.pivot&&api.shape(null).dist===freefall.dist,'cutaway camera settles back to ordinary freefall');
  delete p.cutaway;p.stage='canopy';p.opening=1;p.phase='open';api.reset();tick(0.1);
  c.buildings.push({x:900,y:900,w:70,h:200,height:9000});tick(0.1);
  t.assert(api.cam.dist<api.cam.wantDist&&api.cam.x>973,'a building still pulls the wider canopy boom clear of its wall');
  c.buildings.length=0;const short=api.cam.dist;tick(0.1);
  t.assert(api.cam.dist>short&&api.cam.dist-short<=0.1*4*8+1e-7,'boom returns with the existing wall-release spring');
  c.player.parachute=null;
  const foot=api.shape(null);
  t.assert(foot.pivot===1.58&&foot.dist===3.5&&foot.fov===52,'on-foot framing is unchanged');
  const aircraft={type:'plane',spec:{plane:true,l:80,w:96,height:24}};
  const plane=api.shape(aircraft);
  t.assert(plane.dist===21&&Math.abs(plane.pivot-2.1)<1e-10&&plane.fov===55,'aircraft framing is unchanged');
  return facts;
}
export default async function(t){for(const fact of checkChuteFraming(t))t.note(JSON.stringify(fact));}
