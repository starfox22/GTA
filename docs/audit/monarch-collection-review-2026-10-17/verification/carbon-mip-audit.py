import json, pathlib, numpy as np
from PIL import Image

root=pathlib.Path('/workspace/GTA'); out=root/'work/monarch-review/carbon-audit'
rect=json.loads((out/'carbon-rect.json').read_text()); x,y,w,h=rect['pixels']; size=rect['atlas'][0]
phases=np.linspace(0,1,65); U,V=np.meshgrid(phases,phases)
def sample(im,u,v):
    size=len(im); xx=u*size-.5; yy=v*size-.5; ix=np.floor(xx).astype(int); iy=np.floor(yy).astype(int); fx=(xx-ix)[...,None];fy=(yy-iy)[...,None]
    def at(a,b):return im[np.clip(b,0,size-1),np.clip(a,0,size-1)]
    return at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy
def tri(chain,u,v,lod):
    lo=int(np.floor(lod));f=lod-lo;return sample(chain[lo],u,v)*(1-f)+sample(chain[min(lo+1,len(chain)-1)],u,v)*f
report={'nativeRect':rect,'method':'Independent linear box-mip chain + bilinear/trilinear sampling; not GPU measurement','channels':{}}
for channel in ['albedo','orm','normal']:
    im=np.asarray(Image.open(root/f'assets/monarch-tourbillon-{channel}.webp').convert('RGB'),dtype=np.float64)/255
    native=im[y:y+h,x:x+w].copy()
    if channel=='albedo':im=np.where(im<=.04045,im/12.92,((im+.055)/1.055)**2.4)
    chain=[im]
    while len(im)>1:
        im=im.reshape(len(im)//2,2,len(im)//2,2,3).mean((1,3));chain.append(im)
    rows=[]
    for footprint in [1,2,4,8,16,32,64]:
        old=tri(chain,(x+U*w)/size,(y+V*h)/size,np.log2(footprint));safe=min(footprint,w/8);coarse=2**np.ceil(np.log2(max(safe,1)));inset=min(w*.45,max(0,1.5*coarse-2))
        guarded=tri(chain,(x+np.clip(U*w,inset,w-inset))/size,(y+np.clip(V*h,inset,h-inset))/size,np.log2(safe))
        if channel=='albedo':
            old=np.where(old<=.0031308,old*12.92,1.055*old**(1/2.4)-.055);guarded=np.where(guarded<=.0031308,guarded*12.92,1.055*guarded**(1/2.4)-.055)
        row={'footprintPixels':footprint,'unprotectedMaxRGB255':(old.max((0,1))*255).tolist(),'guardedMaxRGB255':(guarded.max((0,1))*255).tolist()}
        if channel=='normal':
            expected=(native[0,0]*2-1);expected/=np.linalg.norm(expected)
            def angles(q):
                n=q*2-1;n/=np.linalg.norm(n,axis=2)[...,None];return float(np.degrees(np.arccos(np.clip((n*expected).sum(2),-1,1))).max())
            row.update(unprotectedMaxNormalAngleDegrees=angles(old),guardedMaxNormalAngleDegrees=angles(guarded))
        rows.append(row)
    report['channels'][channel]={'nativeRGB255Range':[(native.min((0,1))*255).tolist(),(native.max((0,1))*255).tolist()],'mips':rows}
(out/'mip-audit.json').write_text(json.dumps(report,indent=2)+'\n')
for ch,r in report['channels'].items():print(ch,json.dumps(r['mips'][4]))
