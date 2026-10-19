#!/usr/bin/env python3
"""Run only after the lead explicitly releases a sustained browser slot."""
import argparse, datetime, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--launch',action='store_true');args=parser.parse_args()
if not args.launch: parser.error('--launch is required; this runner otherwise starts no browser')
root=Path('/workspace/GTA'); cwd=root; folder=root/'work/general-review';receipt=folder/'browser-fresh-a.json';log=folder/'browser-fresh-a.log';r=json.loads(receipt.read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(r['html'])==r['htmlSha256'],'Frozen candidate bytes changed'
for spec in r['tests']: assert sha(cwd/'tools/tests'/spec['name'])==spec['sha256'],spec['name']+' changed'
r['status']='running';r['startedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt.write_text(json.dumps(r,indent=2)+'\n');began=time.monotonic();results=[]
with log.open('w',buffering=1) as f:
 f.write('Frozen candidate SHA256 '+r['htmlSha256']+'\n')
 f.write('Exact command '+json.dumps(r['command'])+'\n')
 f.write('Started '+r['startedAt']+'\n')
 p=subprocess.Popen(r['command'],cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,env=os.environ.copy())
 for line in p.stdout:
  f.write(line)
  m=re.match(r'^(PASS|FAIL|SKIP) ([^ ]+) \(([^)]*)\)(.*)$',line.rstrip())
  if m:
   results.append({'status':m[1],'name':m[2]+'.mjs','duration':m[3],'detail':m[4].lstrip(': ')})
   print(line.rstrip(),flush=True)
  elif re.match(r'^(started|reused|[0-9]+/[0-9]+ passed|FAIL could not boot)',line):print(line.rstrip(),flush=True)
 code=p.wait()
 r.update(status='complete' if len(results)==r['count'] else 'incomplete',finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),durationSeconds=round(time.monotonic()-began,2),exitCode=code,results=results,passed=sum(x['status']=='PASS' for x in results),failed=sum(x['status']=='FAIL' for x in results),skipped=sum(x['status']=='SKIP' for x in results),missing=[x['name'] for x in r['tests'] if x['name'] not in {z['name'] for z in results}])
 f.write('Receipt '+json.dumps({k:r[k] for k in ['status','durationSeconds','exitCode','passed','failed','skipped','missing']})+'\n')
r['logSha256']=sha(log);receipt.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:r[k] for k in ['status','durationSeconds','exitCode','passed','failed','skipped','missing']}),flush=True)
sys.exit(code or bool(r['missing']))
