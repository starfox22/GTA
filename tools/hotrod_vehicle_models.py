#!/usr/bin/env python3
"""Source-faithful separate Coupe '33 pack. Never mutates existing vehicle packs.

python3 tools/hotrod_vehicle_models.py /tmp/GTA-hotrod-research/scene.gltf --out assets --work /tmp/hotrod-work
"""
import argparse, copy, hashlib, json, struct, subprocess
from pathlib import Path
import numpy as np
from PIL import Image
import vehicle_models as legacy
import sports_vehicle_models as sports

ROOT=Path(__file__).resolve().parent.parent
KEY='coupe33_zhab'
SOURCE_SHA='4da2215fa7b57af592a19bedc0f53969c9c86ce311e480224187502f22234981'
BIN_SHA='1373bedcb7bc4c83210e282c12cf18b2f644e506aeb2c259fdae5c7a8ca6c451'
SIZE=4096
sha=sports.sha

def source_model(path):
    if sha(path)!=SOURCE_SHA or sha(path.parent/'scene.bin')!=BIN_SHA: raise RuntimeError('Use the pinned source')
    g=legacy.Gltf(str(path));prims=legacy.load_primitives(g);legacy.to_game_frame(prims,'+x')
    whole=np.concatenate([p['P'] for p in prims]);scale=4.5/np.ptp(whole[:,0]);tyres=np.concatenate([p['P'] for p in prims if 'WheelBlades' in p['node']])
    shift=np.array([-(whole[:,0].min()+whole[:,0].max())/2,-tyres[:,1].min(),-(whole[:,2].min()+whole[:,2].max())/2])
    for p in prims:p['P']=(p['P']+shift)*scale
    matrices={}
    def walk(i,parent):
        n=g.js['nodes'][i];matrix=parent@legacy.node_matrix(n);matrices[n.get('name','')]=matrix
        for c in n.get('children',[]):walk(c,matrix)
    for i in g.js['scenes'][g.js.get('scene',0)]['nodes']:walk(i,np.eye(4))
    wheels=[];wheel_nodes=['FL','FR','RL','RR']
    for slot in wheel_nodes:
        name='HOTROD_33_WheelBlades_'+slot;mat=matrices[name];center=(mat[:3,3]+shift)*scale
        p=next(p for p in prims if name+'_' in p['node']);axle=mat[:3,1]/np.linalg.norm(mat[:3,1]);axle*=1 if axle[2]>0 else -1
        delta=p['P']-center;radial=np.linalg.norm(delta-np.outer(delta@axle,axle),axis=1)
        wheels.append(dict(x=float(center[0]),y=float(center[1]),z=float(center[2]),r=float(np.percentile(radial,99.8)),width=float(np.ptp(delta@axle)),side=-1 if slot.endswith('L') else 1,front=slot.startswith('F'),axle=axle.tolist(),sourceNode=name))
    parts={};panes={};owners=[]
    for pi,p in enumerate(prims):
        node=p['node'];P=p['P'][p['index']];cen=P.mean(1)
        wheel=next((i for i,s in enumerate(wheel_nodes) if 'WheelBlades_'+s+'_' in node),None)
        colors=None
        if wheel is not None:
            im=np.asarray(g.image(9)[1]);uv=np.mod(p['UV'][p['index']].mean(1),1);xy=np.floor(uv*np.array([im.shape[1],im.shape[0]])).astype(int);colors=im[xy[:,1],xy[:,0],2]
        for ti,center in enumerate(cen):
            pane=None
            if wheel is not None:name='wheel%d.%s'%(wheel,'rim' if colors[ti]>100 else 'tyre')
            elif any(s in node for s in ['Rear_window','Windshield','Glass_Passanger','Glass_Driver']):
                name='glass';pane=3 if 'Rear_window' in node else 1 if 'Windshield' in node else 2 if 'Passanger' in node else 0
            elif 'Headlights_Glass' in node:name='opticalGlass'
            elif 'Headlights_' in node:name='head'+('Left' if center[2]<0 else 'Right')
            elif 'Brakelights' in node:name='tail'+('Left' if center[2]<0 else 'Right')
            elif 'HoodStock' in node:name='hood'
            elif 'hoodStock_inner' in node:name='trim'
            elif 'interior_' in node or 'Steering_Wheel' in node:name='cabin'
            elif p['material']==1:name='panels' if center[1]>1.1*scale else 'shell'
            else:name='trim'
            parts.setdefault(name,[]).append((pi,ti));owners.append((pi,ti))
            if pane is not None:panes[(pi,ti)]=pane
    count=sum(len(p['index'])for p in prims)
    if len(owners)!=count or len(set(owners))!=count or count!=20856:raise RuntimeError(('Source ownership mismatch',count))
    role=dict(shell=['shell'],panels=['panels'],hood=['hood'],trim=['trim'],cabin=['cabin'],glass=['glass'],opticalGlass=['opticalGlass'])
    allp=np.concatenate([p['P'] for p in prims]);lo,hi=allp.min(0),allp.max(0)
    glassp=np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]]for pi,ti in parts['glass']]).reshape(-1,3)
    def pane_points(pane):return np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]]for pi,ti in parts['glass']if panes[pi,ti]==pane]).reshape(-1,3)
    def ends(pane):
        q=pane_points(pane);a,b=q[:,1].min(),q[:,1].max();return float(np.median(q[q[:,1]<a+.2*(b-a),0])),float(np.median(q[q[:,1]>b-.2*(b-a),0]))
    xf,rf=ends(1);xb,rb=ends(3);belt=float(glassp[:,1].min());roof=float(glassp[:,1].max())
    paint=np.concatenate([p['P']for p in prims if p['material']==1]);profile=[];sections=[]
    for x in np.linspace(lo[0],hi[0],41):
        q=paint[np.abs(paint[:,0]-x)<.12]
        if not len(q):q=paint[np.argsort(np.abs(paint[:,0]-x))[:20]]
        profile.append(float(q[:,1].max()));sections.append([float(q[:,1].min()),float(q[:,1].max()),float(np.abs(q[:,2]).max())])
    lamps={}
    for name in ['headLeft','headRight','tailLeft','tailRight']:
        q=np.concatenate([prims[pi]['P'][prims[pi]['index'][ti]]for pi,ti in parts[name]]).reshape(-1,3);c=q.mean(0);lamps[name]=dict(x=float(c[0]),y=float(c[1]),z=float(c[2]),size=float(max(np.ptp(q[:,1]),np.ptp(q[:,2]))*.4))
    meta=dict(type=KEY,kind='car',title="Coupe '33 Hot Rod #3 - Low Poly Model",author='Daniel Zhabotinsky',dims=(hi-lo).tolist(),x0=float(lo[0]),x1=float(hi[0]),wheels=wheels,lamps=lamps,glass=dict(base=belt,roof=roof,xf=xf,rf=rf,xb=xb,rb=rb,halfBase=.65*scale,halfTop=.55*scale,crown=max(0,float(hi[1])-roof)),hinge=[.604*scale,(1.115+shift[1])*scale],sill=(.335+shift[1])*scale,profile=profile,section=sections,hasInterior=True,roleParts=role,paintTexture=True,paintColor='#ffffff',normalScale=32767,sourceTriangles=count,sourceUniformScale=scale,sourceShift=shift.tolist(),hasEmissiveAtlas=False,lampVertexColorsBaked=False,source=g.js['asset']['extras']['source'],license='CC BY 4.0',nativeDoors=False,doorSpan=[(-.445+shift[0])*scale,(.373+shift[0])*scale],sourceNodePivots='Exact wheel parent transforms; stock hood and native cabin retained. Source has no separate door objects or calipers.')
    return dict(g=g,prims=prims,parts=parts,pane_ids=panes,meta=meta)

def atlas(r,out):
    tiles={};materials={}
    for mi,m in enumerate(r['g'].js['materials']):
        pbr=m.get('pbrMetallicRoughness',{});factor=list(pbr.get('baseColorFactor',[1,1,1,1]));factor[:3]=[1,1,1]if mi==1 else factor[:3]
        al=sports.material_image(r['g'],m,'baseColorTexture');orm=sports.material_image(r['g'],m,'metallicRoughnessTexture')
        spec=m.get('extensions',{}).get('KHR_materials_specular',{}).get('specularTexture');spec=r['g'].image(spec['index'])[1].convert('RGBA')if spec else None
        dims=[im.size for im in (al,orm,spec)if im];size=(max(x[0]for x in dims),max(x[1]for x in dims))if dims else(8,8)
        al=sports.multiplied(al or Image.new('RGBA',size,'white'),factor).resize(size,Image.Resampling.LANCZOS)
        orm=(orm or Image.new('RGB',size,'white')).convert('RGBA').resize(size,Image.Resampling.LANCZOS);orm.putalpha(spec.getchannel('A').resize(size,Image.Resampling.LANCZOS)if spec else Image.new('L',size,255))
        if 'occlusionTexture' not in m:
            channels=list(orm.split());channels[0]=Image.new('L',size,255);orm=Image.merge('RGBA',channels)
        key=hashlib.sha256(al.tobytes()+orm.tobytes()).hexdigest();tiles.setdefault(key,dict(albedo=al,orm=orm,users=[]))['users'].append(mi);materials[mi]=dict(hash=key,finish=[pbr.get('roughnessFactor',1),pbr.get('metallicFactor',1)])
    rects=legacy.shelf_pack({key:t['albedo'].size for key,t in tiles.items()},SIZE,SIZE)
    if rects is None:raise RuntimeError('Source tiles must fit at native size')
    for channel in ['albedo','orm']:
        image=Image.new('RGBA',(SIZE,SIZE),(255,255,255,255)if channel=='orm'else(0,0,0,0))
        for key,(x,y)in rects.items():
            tile=tiles[key][channel];w,h=tile.size;padded=tile.resize((w+4,h+4),Image.Resampling.NEAREST);padded.paste(tile,(2,2));image.paste(padded,(x-2,y-2));tiles[key]['rect']=[x,y,w,h]
        image.save(out/('hotrod-vehicle-'+channel+'.webp'),lossless=True,method=6);image.resize((2048,2048),Image.Resampling.LANCZOS).save(out/('hotrod-vehicle-'+channel+'-low.webp'),lossless=True,method=6)
    return tiles,materials

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source',type=Path);parser.add_argument('--out',type=Path,default=ROOT/'assets');parser.add_argument('--work',type=Path,default=ROOT/'dist/hotrod-converter');a=parser.parse_args();a.work.mkdir(parents=True,exist_ok=True);a.out.mkdir(parents=True,exist_ok=True)
    r=source_model(a.source);(a.work/'source-metadata.json').write_text(json.dumps(r['meta'],indent=2));(a.work/'source-partition.json').write_text(json.dumps({n:dict(triangles=len(f),sourceFaces=f)for n,f in r['parts'].items()}))
    tiles,materials=atlas(r,a.out);sports.KEY=KEY;sports.SIZE=SIZE
    lookup=sports.prepare_geometry(r,a.work);manifest=json.loads((a.work/'parts-manifest.json').read_text())
    for name,info in manifest.items():info['ratio']=.25 if 'Far' in name else 1.;info['preserveSourceNormals']=True
    (a.work/'parts-manifest.json').write_text(json.dumps(manifest,indent=2));helper=ROOT/'tools/approved_vehicle_models_prepare.py'
    subprocess.run(['blender','-b','--threads','1','-P',str(helper),'--','simplify',str(a.work/'parts-input.npz'),str(a.work/'parts-output.npz'),str(a.work/'parts-manifest.json')],check=True)
    # Existing pack writer preserves raw source UVs and signed 16-bit normals.
    patched=materials
    pack_stage=a.work/'pack-stage';pack_stage.mkdir(parents=True,exist_ok=True)
    header=sports.pack(r,a.work,pack_stage,tiles,patched,lookup)
    packpath=pack_stage/'sports-vehicle-models.bin';b=packpath.read_bytes();size=struct.unpack_from('<I',b,8)[0];payload=b[12+size:];header['models'][KEY]['paintUv']=[(tiles[materials[1]['hash']]['rect'][0]+4)/SIZE,(tiles[materials[1]['hash']]['rect'][1]+4)/SIZE]
    # GLTF body roughness texture has independent KHR_texture_transform scale20.
    extra=bytearray(payload)
    for name in header['models'][KEY]['parts']:
        base=KEY+'.'+name;kind,offset,count=header['arrays'][base+'.a'];uv=np.frombuffer(payload,dtype='<f4',count=count,offset=offset).copy();_,fo,fc=header['arrays'][base+'.f'];finish=np.frombuffer(payload,dtype='u1',count=fc,offset=fo).reshape(-1,2);uv=uv.reshape(-1,2);uv[finish[:,0]==round(.17690762518707168*255)]*=20
        while len(extra)%4:extra.append(0)
        header['arrays'][base+'.o']=['f4',len(extra),uv.size];extra.extend(uv.astype('<f4').tobytes())
    encoded=json.dumps(header,separators=(',',':')).encode();encoded+=b' '*(-(12+len(encoded))%4);(a.out/'hotrod-vehicle-models.bin').write_bytes(b'DECVM001'+struct.pack('<I',len(encoded))+encoded+extra);packpath.unlink()
    (a.work/'hotrod-models-header.json').write_text(json.dumps(header,indent=2))
    meta=header['models'][KEY];receipt=dict(source={n:sha(a.source.parent/n)for n in ['scene.gltf','scene.bin','license.txt']},sourceTriangles=meta['sourceTriangles'],allActiveSourceFacesOwnedExactlyOnce=True,nearNormals='Exact authored normals through ratio1 bypass, int16 quantization; no smoothing/welding',farNormals='Nearest source-face custom normal transfer after decimation',textureTransforms='Original .a UV retained; .o independent source ORM UV applies source body roughness20x transform. ORM alpha stores KHR_materials_specular source intensity.',output={p.name:dict(bytes=p.stat().st_size,sha256=sha(p))for p in a.out.glob('hotrod-vehicle-*')},models={KEY:meta},converterSHA256=sha(Path(__file__)),helperSHA256=sha(helper),sourcePixelsDownsampled=False)
    (a.work/'hotrod-conversion-receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps({k:meta[k]for k in ['triangles','farTriangles','dims']},indent=2))
if __name__=='__main__':main()
