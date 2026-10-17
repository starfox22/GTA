// Independent box-mip/bilinear oracle: dark source tiles must not borrow a white neighbour.
import fs from 'node:fs';

export default async function(t) {
  const code=fs.readFileSync(new URL('../../src/monarch-vehicle-assets3d.js',import.meta.url),'utf8');
  t.assert(code.includes('min( rect.z * atlasSize.x, rect.w * atlasSize.y ) / 8.0')&&code.includes('1.5 * mipPixels')&&code.includes('monarchGutter'),'production guard bounds both source mip footprint and filter support');
  const mips=(base,size)=>{const out=[{pixels:base,size}];while(size>1){const next=new Float64Array(size*size/4);for(let y=0;y<size/2;y++)for(let x=0;x<size/2;x++)next[y*size/2+x]=(base[y*2*size+x*2]+base[y*2*size+x*2+1]+base[(y*2+1)*size+x*2]+base[(y*2+1)*size+x*2+1])/4;base=next;size/=2;out.push({pixels:base,size});}return out;},
    bilinear=(m,u,v)=>{const x=u*m.size-.5,y=v*m.size-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,at=(a,b)=>m.pixels[Math.max(0,Math.min(m.size-1,b))*m.size+Math.max(0,Math.min(m.size-1,a))];return at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy;},
    trilinear=(chain,u,v,lod)=>{lod=Math.max(0,Math.min(chain.length-1,lod));const lo=Math.floor(lod),f=lod-lo;return bilinear(chain[lo],u,v)*(1-f)+bilinear(chain[Math.min(lo+1,chain.length-1)],u,v)*f;};
  let leaked=0,checked=0,maxOld=0,maxGuardError=0;
  for(const [size,x,y,width] of [[256,74,2,64],[512,146,2,128]]) {
    const dark=.04,base=new Float64Array(size*size).fill(1);
    for(let py=y-2;py<y+width+2;py++)for(let px=x-2;px<x+width+2;px++)if(px>=0&&py>=0&&px<size&&py<size)base[py*size+px]=dark;
    const chain=mips(base,size),rect=[x/size,y/size,width/size,width/size],phases=[0,.001,.02,.05,.1,.25,.49,.75,.95,.98,.999];
    for(const footprint of [1,1.5,2,4,8,16,32,64])for(const u of phases)for(const v of phases){
      const old=trilinear(chain,rect[0]+u*rect[2],rect[1]+v*rect[3],Math.log2(footprint));
      maxOld=Math.max(maxOld,old);if(old>dark+1e-8)leaked++;
      const safe=Math.min(footprint,Math.max(1,width/8)),coarse=2**Math.ceil(Math.log2(Math.max(safe,1))),
        inset=Math.min(rect[2]*.45,Math.max(0,1.5*coarse/size-2/size)),
        q=(phase,axis)=>rect[axis]+Math.max(inset,Math.min(rect[2]-inset,phase*rect[2])),
        guarded=trilinear(chain,q(u,0),q(v,1),Math.log2(safe));
      maxGuardError=Math.max(maxGuardError,Math.abs(guarded-dark));checked++;
      t.assert(Math.abs(guarded-dark)<1e-10,'dark tile remains dark at source phase '+u+','+v+' / footprint '+footprint+' / width '+width);
    }
  }
  t.assert(leaked>100&&maxOld>.25,'independent full-atlas mip chain reproduces conspicuous white-neighbour contamination');
  t.note?.(JSON.stringify({atlasFiltering:{checked,oldLeakedSamples:leaked,maxOldValue:maxOld,darkSourceValue:.04,maxGuardError,sourceMapsChanged:false,periodicMinifiedEdge:'conservative inset approximation'}}));
}
