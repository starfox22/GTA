#!/usr/bin/env python3
"""Compare all authored source material texels against the final C8 atlas.

python3 tools/sports_vehicle_models_texels.py --source SOURCE/scene.gltf --assets OUTPUT --work WORK
"""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
from PIL import Image
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',type=Path,required=True);parser.add_argument('--assets',type=Path,required=True);parser.add_argument('--work',type=Path,required=True);args=parser.parse_args();src=args.source.parent;out=args.assets;work=args.work
g=json.loads((src/'scene.gltf').read_text());receipt=json.loads((work/'sports-conversion-receipt.json').read_text());images={c:Image.open(out/('sports-vehicle-'+c+'.webp'))for c in ['albedo','orm','emissive']};rows=[]
def texture(item):
 if item is None:return None
 return Image.open(src/g['images'][g['textures'][item['index']]['source']]['uri']).convert('RGBA')
for tile in receipt['atlasTiles'].values():
 x,y,w,h=tile['rect']
 for mi in tile['materials']:
  m=g['materials'][mi];p=m.get('pbrMetallicRoughness',{});factor=p.get('baseColorFactor',[1,1,1,1]).copy()
  if m.get('alphaMode')not in ['BLEND','MASK']:factor[3]=1
  if mi==0:factor[:3]=[1,1,1]
  for channel,item,fac in [('albedo',p.get('baseColorTexture'),factor),('orm',p.get('metallicRoughnessTexture'),None),('emissive',m.get('emissiveTexture'),m.get('emissiveFactor',[0,0,0])+[1])]:
   im=texture(item)or Image.new('RGBA',(w,h),(255,255,255,255));a=np.array(im).astype(float)/255
   if fac is not None:
    f=np.array(fac);rgb=a[:,:,:3];linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)*f[:3]
    a[:,:,:3]=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055);a[:,:,3]*=f[3]
   expected=Image.fromarray(np.clip(np.rint(a*255),0,255).astype('uint8'),'RGBA')
   if channel!='albedo':expected=expected.convert('RGB')
   expected=np.asarray(expected.resize((w,h),Image.Resampling.LANCZOS));actual=np.asarray(images[channel].crop((x,y,x+w,y+h)))
   if channel=='albedo':okay=np.array_equal(expected[:,:,3],actual[:,:,3])and np.array_equal(expected[:,:,:3][actual[:,:,3]>0],actual[:,:,:3][actual[:,:,3]>0])
   else:okay=np.array_equal(expected,actual)
   assert okay,(mi,channel,np.max(abs(expected.astype(int)-actual.astype(int))))
   rows.append({'material':mi,'name':m.get('name'),'channel':channel,'sourceTexture':g['images'][g['textures'][item['index']]['source']]['uri']if item else None,'nativeSize':list(im.size),'atlasSize':[w,h],'allVisibleTexelsExact':True})
result={'packSHA256':hashlib.sha256((out/'sports-vehicle-models.bin').read_bytes()).hexdigest(),'comparisons':len(rows),'allVisibleSourceTexelsExact':True,'intentionalModification':'Only material0 untextured body red pigment is neutral white for resprays; source finish preserved. Transparent RGB beneath zero alpha is invisible and may be cleared by lossless WebP.','comparisonsByMaterial':rows}
(work/'source-texel-proof.json').write_text(json.dumps(result,indent=2)+'\n');print(result['comparisons'],'material/channel texel comparisons PASS')
