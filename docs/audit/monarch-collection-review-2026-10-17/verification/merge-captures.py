import hashlib,json,shutil,sys
from pathlib import Path
base=Path(sys.argv[1]);out=base/'final-captures';out.mkdir(exist_ok=True)
parts=[('first','final-a'),('last','final-b')]
q=[];shards=[];captures=[]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for label,directory in parts:
 d=base/directory;p=d/'capture-after.json';a=json.loads(p.read_text())
 assert a['pass'] and not a['errors'] and a['recorderSha256']==sha(Path('tools/monarch-review.mjs'))
 receipt='capture-after-'+label+'.json';shutil.copy2(p,out/receipt);shards.append(dict(receipt=receipt,sha256=sha(p)))
 for c in a['captures']:
  assert sha(d/c['file'])==c['sha256'];shutil.copy2(d/c['file'],out/c['file']);captures.append(c)
 q.append(a)
assert all(a['htmlSha256']==q[0]['htmlSha256'] and a['fixture']==q[0]['fixture'] and a['types']==q[0]['types'] for a in q)
assert [c['type'] for c in captures]==q[0]['types'] and len(captures)==13
r={k:q[0][k] for k in ['label','htmlSha256','recorderSha256','fixture','types']}
r.update(pass_=True,shards=shards,captures=captures,errors=[],warnings=[w for a in q for w in a['warnings']]);r['pass']=r.pop('pass_')
(out/'capture-after.json').write_text(json.dumps(r,indent=2)+'\n')
print('Merged13 native captures from2 complete frozen-build shards')
