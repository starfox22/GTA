import hashlib,json,struct,sys
from pathlib import Path
root=Path.cwd();before=Path(sys.argv[1]);after=Path(sys.argv[2]);out=Path(sys.argv[3])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
b=json.loads((before/'capture-before.json').read_text());a=json.loads((after/'capture-after.json').read_text())
assert b['pass'] and a['pass'] and not b['errors'] and not a['errors']
assert b['types']==a['types'] and len(a['types'])==13 and b['fixture']==a['fixture']
if a.get('shards'):
 mutation={'holdSimulation','god','graphics','sky','setClock','settings','look','drive','placeVehicle','viewMode','closeUp','inspectView','hitchRun'}
 controls=[r for r in b['inputs'] if r[0] in mutation]
 looks=[i for i,r in enumerate(controls) if r==['look',[418,6000,3]]]
 starts=[i if n==0 else i-1 for n,i in enumerate(looks)]+[len(controls)]
 initial=controls[:starts[0]];covered=[]
 for shard in a['shards']:
  receipt=after/shard['receipt'];assert sha(receipt)==shard['sha256'];q=json.loads(receipt.read_text())
  assert q['pass'] and not q['errors'] and q['htmlSha256']==a['htmlSha256']
  assert q['recorderSha256']==a['recorderSha256'] and q['types']==a['types'] and q['fixture']==a['fixture']
  start,end=q['captureRange'];expected=json.loads(json.dumps(initial))
  for i in range(end):
   scene=json.loads(json.dumps(controls[starts[i]:starts[i+1]]))
   if i<start:
    for row in scene:
     if row[0]=='hitchRun':row[1][-1]=False
   expected.extend(scene)
  assert expected==[r for r in q['inputs'] if r[0] in mutation],'Shard named controls differ'
  covered.extend(range(start,end))
 assert sorted(covered)==list(range(13)),'Shards do not cover all13 exactly once'
else:
 assert b['inputs']==[r for r in a['inputs'] if r[0]!='monarchAssets'],'Named simulation/camera inputs differ'
raw=(root/'assets/monarch-vehicle-models.bin').read_bytes();header=json.loads(raw[12:12+struct.unpack_from('<I',raw,8)[0]])
mapping={t:m for m in header['models'].values() for t in m['gameTypes']}
rows=[];manifest=[]
for old,new in zip(b['captures'],a['captures']):
 assert old['type']==new['type'] and old['status']==new['status'] and old['camera']==new['camera'],new['type']
 for phase,directory,row in [('before',before,old),('after',after,new)]:
  p=directory/row['file'];blob=p.read_bytes();assert sha(p)==row['sha256']
  assert blob[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',blob[16:24])==(1000,700)
  assert row['faults']['count']==0 and not row['gpu']['lost']
  manifest.append(dict(file='screenshots/native/'+row['file'],sha256=sha(p),bytes=len(blob),phase=phase,viewport=[1000,700]))
 if new['type'] in mapping:
  model=mapping[new['type']];assert new['asset']['sourceKey']==model['type']
  assert new['model']['visible'] and not new['model']['far'] and new['model']['triangles']==model['triangles']
  assert new['monarch']['models'][model['type']]['texturesReady']
  assert new['monarch']['heroSource']==model['type'] and new['monarch']['highSourceLimit']==1
 rows.append(dict(type=new['type'],beforeName=old['vehicleName'],afterName=new['vehicleName'],source=new.get('asset',{}).get('sourceKey'),statusExact=True,cameraExact=True))
assert a['captures'][-2]['vehicleName'].casefold()=='Chrynser Sebing'.casefold()
assert a['captures'][-1]['vehicleName'].casefold()=='Chorley 72'.casefold()
assert "name: 'Chrynser Sebing'" in (root/'src/game-vehicles.js').read_text()
assert "name: 'Chorley 72'" in (root/'src/game-vehicles.js').read_text()
for old,new in zip(b['captures'][:-2],a['captures'][:-2]):assert old['vehicleName']==new['vehicleName']
report=dict(pass_=True,nativeImages=len(manifest),comparisons=rows,simulationAndCameraInputsExact=True,prefixDrawOnlySuppressed=bool(a.get('shards')),baselineSha256=b['htmlSha256'],releaseSha256=a['htmlSha256'],readOnlyDifference='After adds monarchAssets queries and a texture readiness wait.',files=manifest)
report['pass']=report.pop('pass_');out.write_text(json.dumps(report,indent=2)+'\n')
print('PASS13 exact camera/status/input comparisons and26 unmodified native PNG digests')
