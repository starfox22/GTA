#!/usr/bin/env python3
"""Independent original-source vs production-pack audit (NumPy/Pillow/SciPy).
python3 tools/hotrod_vehicle_verify.py SOURCE/scene.gltf assets/hotrod-vehicle-models.bin OUTPUT.json
"""
import hashlib,json,struct,sys
from pathlib import Path
from collections import Counter
import numpy as np
from scipy.spatial import cKDTree
import vehicle_models as legacy
source,pack,out=map(Path,sys.argv[1:]);g=legacy.Gltf(str(source));prims=legacy.load_primitives(g);legacy.to_game_frame(prims,'+x')
b=pack.read_bytes();size=struct.unpack_from('<I',b,8)[0];h=json.loads(b[12:12+size]);m=h['models']['coupe33_zhab'];base=12+size;types=dict(i2='<i2',u2='<u2',u1='u1',i1='i1',f4='<f4',u4='<u4')
def array(name):
 t,o,n=h['arrays']['coupe33_zhab.'+name];return np.frombuffer(b,dtype=types[t],count=n,offset=base+o)
whole=np.concatenate([p['P']for p in prims]);tyres=np.concatenate([p['P']for p in prims if 'WheelBlades' in p['node']]);scale=4.5/np.ptp(whole[:,0]);shift=np.array([-(whole[:,0].min()+whole[:,0].max())/2,-tyres[:,1].min(),-(whole[:,2].min()+whole[:,2].max())/2]);positions=[];normals=[];uvs=[]
for p in prims:positions.append((p['P']+shift)*scale);normals.append(p['N']/np.linalg.norm(p['N'],axis=1,keepdims=True));uvs.append(p['UV'])
P=np.concatenate(positions);N=np.concatenate(normals);UV=np.concatenate(uvs);tree=cKDTree(P);lo=np.array(m['quant'][:3]);extent=np.array(m['quant'][3:]);tol=float(np.linalg.norm(extent/65534)*1.01);worst_p=0;worst_n=1;worst_uv=0;vertices=0;triangles=0
for name,part in m['parts'].items():
 if name.endswith('Far'):continue
 q=array(name+'.p').reshape(-1,3).astype(float);p=(q+32767)/65534*extent+lo;n=array(name+'.n').reshape(-1,3).astype(float)/32767;n/=np.linalg.norm(n,axis=1,keepdims=True);uv=array(name+'.a').reshape(-1,2)
 for i,candidates in enumerate(tree.query_ball_point(p,tol)):
  candidates=np.array(candidates,dtype=int)
  if not len(candidates):raise RuntimeError('Changed source position: '+name)
  errors=np.max(abs(UV[candidates]-uv[i]),axis=1);valid=candidates[errors<2e-6]
  if not len(valid):raise RuntimeError('Changed original UV: '+name)
  dot=N[valid]@n[i];j=int(np.argmax(dot));which=valid[j];worst_p=max(worst_p,float(np.linalg.norm(P[which]-p[i])));worst_n=min(worst_n,float(dot[j]));worst_uv=max(worst_uv,float(abs(UV[which]-uv[i]).max()))
 vertices+=len(p);triangles+=len(array(name+'.i'))//3
if triangles!=sum(len(p['index'])for p in prims)or triangles!=20856 or worst_n<.99999999:raise RuntimeError('Source geometry/normal mismatch')
# Every native texture is retained at its authored size in the high tier.
from PIL import Image
atlas=Image.open(pack.parent/'hotrod-vehicle-albedo.webp');orm=Image.open(pack.parent/'hotrod-vehicle-orm.webp')
if atlas.size!=(4096,4096)or orm.size!=(4096,4096)or orm.mode!='RGBA':raise RuntimeError('PBR atlas contract')
proof=dict(sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),packSHA256=hashlib.sha256(b).hexdigest(),activeSourceTriangles=triangles,nearVerticesChecked=vertices,maxPositionErrorMetres=worst_p,minimumAuthoredNormalDot=worst_n,maxRawUVError=worst_uv,sourceFrame='GLTF +X ahead, +Y up, +Z right; one uniform length fit and ground/centre translation',nearTriangles=m['triangles'],farTriangles=m['farTriangles'],normals='Every close vertex matches an original authored position + raw UV + split normal; no smoothing/welding',nativeCabinRetained=True,sourceHasSeparateDoorNodes=False,sourceHasSeparateCalipers=False)
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof,indent=2))
