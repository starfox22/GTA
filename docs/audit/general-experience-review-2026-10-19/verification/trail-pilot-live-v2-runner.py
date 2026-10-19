#!/usr/bin/env python3
"""Prepare or run exactly hillclimb-physics + falls against an immutable HTML.
No browser starts without --launch AND the lead's explicit slot release.
"""
import argparse, datetime, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path
P = argparse.ArgumentParser()
P.add_argument('--html', type=Path, required=True)
P.add_argument('--expected-sha256')
P.add_argument('--source-commit')
P.add_argument('--launch', action='store_true')
P.add_argument('--output-prefix', type=Path, default=Path('/workspace/GTA/work/general-review/trail-pilot-live'))
a = P.parse_args()
ROOT = Path('/workspace/GTA')
CWD = Path('/workspace/work/general-trail-pilot')
html = a.html.resolve()
prefix = a.output_prefix.resolve()
prefix.parent.mkdir(parents=True, exist_ok=True)
receipt = prefix.with_suffix('.json')
log = prefix.with_suffix('.log')
def sha(p):
    h = hashlib.sha256()
    with Path(p).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()
def included(file, needle):
    tail = b''
    with file.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            buf = tail + chunk
            if needle in buf: return True
            tail = buf[-len(needle):]
    return False
def utc(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
assert html.is_file(), 'Frozen HTML does not exist'
html_sha = sha(html)
if a.expected_sha256: assert html_sha == a.expected_sha256, 'Frozen candidate hash differs'
tests = ['hillclimb-physics.mjs', 'falls.mjs']
test_specs = []
for name in tests:
    local, root = CWD / 'tools/tests' / name, ROOT / 'tools/tests' / name
    assert sha(local) == sha(root), name + ': root/worktree test differs'
    test_specs.append({'name': name, 'sha256': sha(local)})
for name in ['tools/test.mjs', 'tools/dev.mjs', 'tools/browser.mjs']:
    assert sha(CWD / name) == sha(ROOT / name), name + ': root/worktree runner differs'
source_files = ['src/offroad-club.js', 'src/offroad-trails.js', 'src/terrain-suspension.js',
                'src/physics-driving.js', 'src/driving.js', 'src/falls-vehicles.js', 'src/falls-console.js']
sources = {name: sha(ROOT / name) for name in source_files}
# The build splices these files verbatim; this guards against accidentally selecting
# the old immutable f707 build while pointing at a newer source checkout.
assert included(html, (ROOT / 'src/offroad-club.js').read_bytes()), 'Frozen HTML does not contain the exact current pilot source'
command = ['node', 'tools/test.mjs', *tests, '--exact', '--html', str(html), '--verbose']
r = {'kind': 'Complete-game production regression acceptance, exactly the unchanged hillclimb-physics and falls modules; separate from the CPU host pass',
     'status': 'prepared', 'preparedAt': utc(), 'count': 2, 'html': str(html), 'htmlSha256': html_sha,
     'frozenArtifactSourceCommit': a.source_commit or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
     'sourceEquivalence': 'Acceptance applies to the recorded immutable artifact and source commit. The seven physics/terrain/pilot files are hashed from the root checkout at launch, and its exact current pilot file is embedded verbatim in the artifact.',
     'sourceTreeCommitAtPreparation': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
     'runnerWorktreeCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=CWD, text=True).strip(),
     'tests': test_specs, 'sourceHashes': sources, 'pilotSourceIncludedVerbatim': True,
     'runnerHashes': {name: sha(CWD / name) for name in ['tools/test.mjs', 'tools/dev.mjs', 'tools/browser.mjs']},
     'command': command, 'cwd': str(CWD), 'log': str(log)}
receipt.write_text(json.dumps(r, indent=2) + '\n')
if not a.launch:
    print('PREPARED; no browser launched. Receipt ' + str(receipt))
    sys.exit(0)
assert sha(html) == html_sha, 'Frozen HTML changed before launch'
assert all(sha(CWD / 'tools/tests' / x['name']) == x['sha256'] for x in test_specs), 'Selected test changed before launch'
# Environment is the existing managed browser wrapper. Do not bypass its shared semaphore.
assert os.environ.get('DEC_BROWSER_SLOTS') == '2', 'Source /workspace/setup/GTA-env.sh first'
r.update(status='running', startedAt=utc())
receipt.write_text(json.dumps(r, indent=2) + '\n')
results = []
began = time.monotonic()
with log.open('w', buffering=1) as f:
    f.write('Frozen candidate SHA256 ' + html_sha + '\n')
    f.write('Exact command ' + json.dumps(command) + '\n')
    f.write('Started ' + r['startedAt'] + '\n')
    p = subprocess.Popen(command, cwd=CWD, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, bufsize=1, env=os.environ.copy())
    for line in p.stdout:
        f.write(line)
        m = re.match(r'^(PASS|FAIL|SKIP) ([^ ]+) \(([^)]*)\)(.*)$', line.rstrip())
        if m:
            item = {'status': m[1], 'name': m[2] + '.mjs', 'duration': m[3], 'detail': m[4].lstrip(': ')}
            results.append(item)
            print(line.rstrip(), flush=True)
        elif re.match(r'^(started|reused|[0-9]+/[0-9]+ passed|FAIL could not boot)', line):
            print(line.rstrip(), flush=True)
    code = p.wait()
    r.update(status='complete' if len(results) == 2 else 'incomplete', finishedAt=utc(),
             durationSeconds=round(time.monotonic() - began, 2), exitCode=code, results=results,
             passed=sum(x['status'] == 'PASS' for x in results), failed=sum(x['status'] == 'FAIL' for x in results),
             skipped=sum(x['status'] == 'SKIP' for x in results),
             missing=[x for x in tests if x not in {z['name'] for z in results}],
             htmlUnchangedAfterRun=sha(html) == html_sha,
             testsUnchangedAfterRun=all(sha(CWD / 'tools/tests' / x['name']) == x['sha256'] for x in test_specs))
    f.write('Receipt ' + json.dumps({k: r[k] for k in ['status', 'durationSeconds', 'exitCode', 'passed', 'failed', 'skipped', 'missing', 'htmlUnchangedAfterRun', 'testsUnchangedAfterRun']}) + '\n')
r['logSha256'] = sha(log)
receipt.write_text(json.dumps(r, indent=2) + '\n')
print(json.dumps({k: r[k] for k in ['status', 'durationSeconds', 'exitCode', 'passed', 'failed', 'skipped', 'missing']}), flush=True)
sys.exit(code or r['passed'] != 2 or bool(r['missing']) or not r['htmlUnchangedAfterRun'] or not r['testsUnchangedAfterRun'])
