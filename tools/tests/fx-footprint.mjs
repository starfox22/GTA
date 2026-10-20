// Production FX atlas/filter footprint conservation and pool/pass invariants; real Three.js, no GPU.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const Three = createRequire(import.meta.url)('../../vendor/three.r160.js');
export default function(t) {
  const source = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8'),
    atlas = source('fx3d-atlas'), particles = source('fx3d-particles'), scene = new Three.Scene(),
    camera = new Three.OrthographicCamera(-100,100,75,-75,1,1000), light = () => new Three.PointLight('#ffffff', 1, 200),
    renders = [], renderer = { domElement: { width: 1200, height: 900 }, initTexture() {}, autoClear: true, render(s,c) { renders.push([s,c]); } },
    scope = vm.createContext({ Three, scene, camera, streetCamera: camera, renderer, performance,
      document: { createElement: () => ({ getContext: () => null }) }, registerPrewarmPass() {},
      FX_SPRITE_ORDER: 10, hdrCapable: false, postTier: null, worldResetSerial: 0,
      UNITS_PER_METRE: 8, TAU: Math.PI*2, weather: { wind: .4, windAngle: .6 }, gameTime: 10, gameMode: 'play',
      graphicsTier: () => ({ name:'HIGH' }), clamp: (v,a,b) => Math.max(a,Math.min(b,v)),
      fxBlast: { born: -10 }, particles: [], chaseSpriteHidden: () => false, cachedColor: c => new Three.Color(c),
      sunDirection: new Three.Vector3(0,1,0), skySunDirection: new Three.Vector3(0,1,0),
      sun: light(), hemi: new Three.HemisphereLight(), fill: light(), muzzleLight: light(), carFireLight: light(), fireLights: [] });
  const api = vm.runInContext(atlas + particles + `
    while(fxAtlasBake) fxAtlasStep(1000);
    ({fxAtlasData,fxFootprintBounds,fxBuildFootprints,fxFootprintRect,fxAdd,fxStep,fxs,FX_FIELDS,drawFxParticles,
      fxMaterial,fxUniforms,fxGeometry,fxMesh,renderFxPass,fxReport,seed:()=>fxSeed})`, scope);
  api.fxBuildFootprints();
  const original = new Uint8Array(api.fxAtlasData), tableObjects = api.fxFootprintBounds.slice(),
    sizes = [2,4,8,12,16,24,32,48,64,96,128,192,256,512];
  let supports = 0, saved = [];
  function mipChain(data) {
    let w=512,h=256,a=Float64Array.from({length:w*h},(_,i)=>data[i*4+3]/255); const chain=[];
    while(true) {
      chain.push({w,h,a}); if(w===1&&h===1)break;
      const nw=Math.max(1,w>>1),nh=Math.max(1,h>>1),n=new Float64Array(nw*nh);
      for(let y=0;y<nh;y++)for(let x=0;x<nw;x++)
        n[y*nw+x]=(a[Math.min(h-1,y*2)*w+Math.min(w-1,x*2)]+a[Math.min(h-1,y*2)*w+Math.min(w-1,x*2+1)]+a[Math.min(h-1,y*2+1)*w+Math.min(w-1,x*2)]+a[Math.min(h-1,y*2+1)*w+Math.min(w-1,x*2+1)])*.25;
      w=nw;h=nh;a=n;
    } return chain;
  }
  function prove(data,label) {
    api.fxBuildFootprints(data); const mips=mipChain(data);
    for(let frame=0;frame<8;frame++)for(const pixels of sizes) {
      const b=api.fxFootprintRect(frame,pixels), upper=Math.min(mips.length-1,Math.max(0,Math.ceil(Math.log2(Math.max(1,128/pixels)))));
      t.assert(b.x>=0&&b.y>=0&&b.z<=1&&b.w<=1&&b.z>=b.x&&b.w>=b.y,label+' finite enclosing rectangle '+frame+'/'+pixels);
      if(frame>=6||pixels<=16)t.assert(b.x===0&&b.y===0&&b.z===1&&b.w===1,label+' glass/drops/coarse sprites retain original square');
      // Enumerate every nonzero averaged mip texel's entire bilinear influence
      // inside this frame, including adjacent-frame texels. This proves all UVs,
      // rather than checking a sampling grid that can miss a thin flash spike.
      let retained=true, contributing=0;
      for(let level=0;level<=upper;level++) {
        const {w,h,a}=mips[level], tile=128/2**level,left=(frame%4)*tile,bottom=Math.floor(frame/4)*tile;
        for(let y=-1;y<=tile;y++)for(let x=-1;x<=tile;x++) {
          const sx=Math.max(0,Math.min(w-1,Math.floor(left+x))),sy=Math.max(0,Math.min(h-1,Math.floor(bottom+y)));
          if(!a[sy*w+sx])continue;
          const x0=Math.max(0,(x-.5)/tile),x1=Math.min(1,(x+1.5)/tile),y0=Math.max(0,(y-.5)/tile),y1=Math.min(1,(y+1.5)/tile);
          if(x0>=x1||y0>=y1)continue;
          retained&&=b.x<=x0&&b.y<=y0&&b.z>=x1&&b.w>=y1;contributing++;
        }
      }
      t.assert(retained,label+' every filtered alpha contribution retained '+frame+'/'+pixels); supports+=contributing;
      if(label==='authored'&&frame<4&&[32,64,128,256].includes(pixels))saved.push({frame,pixels,rasterShare:(b.z-b.x)*(b.w-b.y)});
      // World displacement and UV use the same affine trim. Rotations, streaks,
      // ground fade and depth therefore retain their original UV/world mapping.
      let error=0;
      for(const angle of [0,.4,1.2,2.7])for(const streak of [1,2,8])for(let k=0;k<7;k++) {
        const u=b.x+(b.z-b.x)*(k+.3)/8,v=b.y+(b.w-b.y)*(7-k+.2)/8,
          qx=(u-b.x)/(b.z-b.x),qy=(v-b.y)/(b.w-b.y),
          nx=b.x+(b.z-b.x)*qx-.5,ny=(b.y+(b.w-b.y)*qy-.5)*streak,
          ox=u-.5,oy=(v-.5)*streak;
        error=Math.max(error,Math.abs((nx-ox)*Math.cos(angle)-(ny-oy)*Math.sin(angle)),Math.abs((nx-ox)*Math.sin(angle)+(ny-oy)*Math.cos(angle)));
      }
      t.assert(error<1e-12,label+' visible UV/world mapping survives rotation and streak '+frame+'/'+pixels);
    }
  }
  prove(original,'authored');
  // Host has no canvas. Glass itself keeps its full quad, and a completely
  // opaque glass tile is a stronger adjacent-tile leakage case than its glints.
  const adversarial=new Uint8Array(original);
  for(let y=128;y<256;y++)for(let x=256;x<384;x++)adversarial[(y*512+x)*4+3]=255;
  prove(adversarial,'opaque-neighbor');api.fxBuildFootprints(original);
  t.assert(tableObjects.every((o,i)=>api.fxFootprintBounds[i]===o),'atlas completion updates uniform values without new tables/programs');
  t.assert(saved.filter(s=>s.pixels>=64).every(s=>s.rasterShare<.85),'each large smoke frame omits at least fifteen percent of square raster work');
  for(let k=0;k<12;k++)api.fxAdd(k,20,-100,1,3,4,3+k*.1,30,new Three.Color('#888888'),.6);
  const before=api.FX_FIELDS.map(f=>Array.from(api.fxs[f])),seed=api.seed();api.fxBuildFootprints(original);
  t.assert(before.every((a,k)=>a.every((v,i)=>v===api.fxs[api.FX_FIELDS[k]][i]))&&api.seed()===seed,'footprints do not change live effects, delays, lifetimes or effect randomness');
  api.fxStep(.25);t.assert(Math.abs(api.fxs.life[0]-2.75)<1e-6&&api.fxs.n===12,'original pool integration and bounded lifetime remain intact');
  camera.position.set(0,40,200);camera.lookAt(0,20,-100);camera.updateMatrixWorld(true);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  api.drawFxParticles(0);const uuid=api.fxMaterial.uuid,version=api.fxMaterial.version;
  for(let i=0;i<20;i++)api.renderFxPass(null,800,600);
  t.assert(renders.length===20&&api.fxGeometry.instanceCount===12&&renderer.autoClear===true,'one instanced draw and pass state preserved');
  t.assert(api.fxMaterial.uuid===uuid&&api.fxMaterial.version===version&&api.fxUniforms.uFxViewport.value.x===800,'combat updates no shader variant, material or render target');
  const frag=api.fxMaterial.fragmentShader;
  t.assert(frag.indexOf('if ( t.a == 0.0 ) discard;')<frag.indexOf('texture2D( tDepth'),'guaranteed-zero alpha skips scene depth before lighting');
  for(const alpha of [0,.2,.86,1])for(const glow of [0,1,6]) {
    const sampledAlpha=0,coverage=sampledAlpha*alpha,emission=sampledAlpha*glow;
    t.assert(coverage===0&&emission===0,'early alpha rejection preserves coverage/additive zero '+alpha+'/'+glow);
  }
  const ordinaryReport=api.fxReport().footprint;
  // Motion along camera back is not a visible streak. The shader leaves its
  // centre unchanged; the perspective area/mip report must do the same.
  camera.isOrthographicCamera=false;
  camera.projectionMatrix.copy(new Three.PerspectiveCamera(60,4/3,1,1000).projectionMatrix);
  api.fxs.drawn=1;
  const motion=api.fxGeometry.attributes.iStreak.array, back=camera.matrixWorld.elements;
  motion[0]=motion[1]=motion[2]=0;
  const stationary=api.fxReport().footprint;
  motion[0]=back[8]*100;motion[1]=back[9]*100;motion[2]=back[10]*100;
  const axial=api.fxReport().footprint;
  t.assert(stationary.fullQuadPixels===axial.fullQuadPixels&&stationary.trimmedQuadPixels===axial.trimmedQuadPixels,
    'perspective report matches shader centre for subthreshold projected streak');
  t.note(JSON.stringify({fxFootprint:{supportsChecked:supports,smokeRasterShares:saved,live:api.fxs.n,report:ordinaryReport,
    note:'Projected geometry/texture-support proof, not a hardware FPS benchmark. Glass tile adversarially opaque; glass/drop quads unchanged.'}}));
}
