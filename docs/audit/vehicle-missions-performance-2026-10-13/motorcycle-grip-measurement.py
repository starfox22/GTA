import struct,json,numpy as np
from pathlib import Path
from PIL import Image
from scipy.optimize import least_squares
b=Path('/workspace/GTA/assets/vehicle-models.bin').read_bytes();n=struct.unpack_from('<I',b,8)[0];h=json.loads(b[12:12+n]);base=n+12;im=np.asarray(Image.open('/workspace/GTA/assets/vehicle-atlas.webp').convert('RGB'))
def data(t,part):
 m=h['models'][t]
 def a(k):
  tp,o,c=h['arrays'][t+'.'+part+'.'+k];return np.frombuffer(b,dtype={'i2':'<i2','u2':'<u2','i1':'i1'}[tp],offset=base+o,count=c)
 p=(a('p').reshape(-1,3).astype(float)+32767)/65534*np.array(m['quant'][3:])+np.array(m['quant'][:3]);u=a('uv').reshape(-1,2).astype(float)/65535
 rgb=im[(u[:,1]*(im.shape[0]-1)).astype(int),(u[:,0]*(im.shape[1]-1)).astype(int)];return p,rgb
result={}
for t in ['bike','cruiser','kr500']:
 pp=[data(t,a) for a in ['trim','steer.trim']];p=np.concatenate([a[0] for a in pp]);rgb=np.concatenate([a[1] for a in pp]);rows=[]
 for sign in [-1,1]:
  if t=='bike': mask=(p[:,0]>.235)&(p[:,0]<.326)&(p[:,1]>1.015)&(p[:,1]<1.080)&(p[:,2]*sign>.250)&(p[:,2]*sign<.402)
  elif t=='cruiser':mask=(p[:,0]>.10)&(p[:,0]<.235)&(p[:,1]>1.15)&(p[:,1]<1.28)&(p[:,2]*sign>(.328 if sign<0 else .223))&(p[:,2]*sign<(.458 if sign<0 else .350))
  else: mask=(p[:,0]>.07)&(p[:,0]<(.25 if sign<0 else .305))&(p[:,1]>(1.07 if sign<0 else 1.16))&(p[:,1]<(1.17 if sign<0 else 1.275))&(p[:,2]*sign>.26)&(p[:,2]*sign<.49)
  mask &= rgb.mean(1)<75
  q=np.unique(p[mask],axis=0);c=q.mean(0);_,_,vv=np.linalg.svd(q-c,full_matrices=False);axis=vv[0]
  if axis[2]<0:axis=-axis
  # Fit an infinite cylindrical surface. The centre along its axis is fixed at the sample centre.
  def unpack(x):
   ax=np.array([x[3],x[4],1]);ax/=np.linalg.norm(ax);cc=c+np.array([x[0],x[1],0]);return cc,ax,x[2]
  def residual(x):
   cc,ax,r=unpack(x);d=q-cc;rad=d-np.outer(d@ax,ax);return np.linalg.norm(rad,axis=1)-r
  x0=[0,0,.015,float(np.clip(axis[0]/axis[2],-.7,.7)),float(np.clip(axis[1]/axis[2],-.7,.7))]
  fit=least_squares(residual,x0,bounds=([-.05,-.05,.008,-.75,-.75],[.05,.05,.035,.75,.75]),loss='soft_l1',f_scale=.002,max_nfev=2000)
  cc,ax,r=unpack(fit.x);proj=(q-cc)@ax;cc=cc+ax*((np.quantile(proj,.05)+np.quantile(proj,.95))/2)
  record={'point':cc.round(5).tolist(),'axis':ax.round(5).tolist(),'radius':round(r,5),'points':len(q),'rms':round(float(np.sqrt(np.mean(residual(fit.x)**2))),5),'medianResidual':round(float(np.median(np.abs(residual(fit.x)))),5),'bbox':[q.min(0).round(5).tolist(),q.max(0).round(5).tolist()]};rows.append(record);print(t,sign,record)
 result[t]=rows
Path('/tmp/GTA-grip-cylinders-refined.json').write_text(json.dumps(result,indent=2))
