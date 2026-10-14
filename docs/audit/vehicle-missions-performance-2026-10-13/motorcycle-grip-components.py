import json,struct,numpy as np
from pathlib import Path
b=Path('/workspace/GTA/assets/vehicle-models.bin').read_bytes();n=struct.unpack_from('<I',b,8)[0];h=json.loads(b[12:12+n]);base=12+n
dtypes={'f4':'<f4','i1':'i1','u1':'u1','i2':'<i2','u2':'<u2'}
def array(key):
 typ,off,count=h['arrays'][key];return np.frombuffer(b,dtype=dtypes[typ],count=count,offset=base+off)
allout={}
for typ in ['bike','cruiser','kr500']:
 m=h['models'][typ];q=array(typ+'.steer.trim.p').reshape(-1,3);p=(q.astype(float)+32767)/65534*np.array(m['quant'][3:])+np.array(m['quant'][:3]);tri=array(typ+'.steer.trim.i').reshape(-1,3)
 parent=np.arange(len(q));keys={}
 def root(i):
  while parent[i]!=i: parent[i]=parent[parent[i]];i=parent[i]
  return int(i)
 def union(a,c):parent[root(c)]=root(a)
 for i,x in enumerate(q):
  k=tuple(x)
  if k in keys:union(i,keys[k])
  else:keys[k]=i
 for a,c,d in tri:union(a,c);union(a,d)
 groups={}
 for a,c,d in tri:groups.setdefault(root(a),set()).update([int(a),int(c),int(d)])
 rows=[]
 for ids in groups.values():
  pts=p[sorted(ids)];lo=pts.min(0);hi=pts.max(0);c=(hi+lo)/2
  if hi[1]<.95 or max(abs(lo[2]),abs(hi[2]))<.22:continue
  rows.append({'indices':sorted(ids),'vertices':len(ids),'center':c.round(5).tolist(),'min':lo.round(5).tolist(),'max':hi.round(5).tolist(),'extent':(hi-lo).round(5).tolist(),'mean':pts.mean(0).round(5).tolist()})
 rows.sort(key=lambda v:(v['center'][1],v['center'][0],v['center'][2]));allout[typ]={'grip':m['grip'],'components':rows}
 print(typ,'packed grip',m['grip'],'wide high components',len(rows))
 for v in rows:print(v)
 np.savez('/tmp/GTA-'+typ+'-steer-geometry.npz',p=p,tri=tri)
Path('/tmp/GTA-rider-grip-components.json').write_text(json.dumps(allout,indent=2))
