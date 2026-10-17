#!/usr/bin/env python3
"""CPU-only frozen inline/split check; run from the repository root.

python3 work/monarch-review/verify-packaged-build.py --frozen work/monarch-review/final.html --expected-sha256 SHA256
"""
import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root', type=Path, default=Path.cwd())
parser.add_argument('--frozen', type=Path, required=True)
parser.add_argument('--expected-sha256', required=True)
parser.add_argument('--pages', type=Path)
args = parser.parse_args()
ROOT = args.root.resolve()
WORK = ROOT / 'work/monarch-review'
PAGES = args.pages or WORK / 'final-pages'
sha = lambda data: hashlib.sha256(data).hexdigest()
script = re.compile(rb'<script\b([^>]*)>(.*?)</script>', re.S)

def is_media(attrs):
    return b'application/octet-stream' in attrs or re.search(rb'\bsrc="media/pack-[^"]+"', attrs)

def code_records(raw):
    return [dict(attributes=attrs.decode(), bytes=len(body), sha256=sha(body))
            for attrs, body in script.findall(raw) if not is_media(attrs)]

def normalized_shell(raw):
    raw = script.sub(lambda match: b'' if is_media(match[1]) else b'<script></script>', raw)
    raw = re.sub(rb'<!-- (?:BINARY MEDIA|MEDIA PACKS|STREAMED MEDIA):.*?-->\s*', b'', raw, flags=re.S)
    return re.sub(rb'\s+', b' ', raw).strip()

guard = args.frozen.read_bytes()
inline = (WORK / 'final-inline-audit.html').read_bytes()
entry = (PAGES / 'index.html').read_bytes()
assert sha(guard) == sha(inline) == args.expected_sha256
guard_code, entry_code = code_records(guard), code_records(entry)
assert guard_code == entry_code, 'Packaged executable inline scripts differ from the frozen candidate'
assert normalized_shell(guard) == normalized_shell(entry), 'Packaged shell/credits differ beyond media placement/whitespace'
media = json.loads((WORK / 'final-packaged-media.json').read_text())
assert media['pass'] and media['entrySha256'] == sha(entry)
files = [path for path in PAGES.rglob('*') if path.is_file()]
expected_files = {'index.html'} | {pack['file'] for pack in media['packs']} | {'media/' + Path(asset['file']).name for asset in media['assets'] if asset['stream']}
assert {str(path.relative_to(PAGES)) for path in files} == expected_files, 'Unexpected or missing packaged files'
assert max(pack['bytes'] for pack in media['packs']) <= 12_000_000
geometry = next(asset for asset in media['assets'] if asset['file'] == 'assets/monarch-vehicle-models.bin')
assert geometry['sha256'] == '25473f93258f4c6ec167e2fb9953e8fc9d40d58844862cb8c4289b22826490ed'
with (ROOT / geometry['file']).open('rb') as source:
    prefix = source.read(12); header = json.loads(source.read(struct.unpack_from('<I', prefix, 8)[0]))
report = dict(pass_=True, frozenInlineSHA256=sha(guard), frozenInlineBytes=len(guard), entrySHA256=sha(entry), entryBytes=len(entry),
              inlineScripts=guard_code, executableScriptCount=sum('text/plain' not in record['attributes'] for record in guard_code),
              plainTextScriptCount=sum('text/plain' in record['attributes'] for record in guard_code), normalizedShellSHA256=sha(normalized_shell(entry)),
              fileCount=len(files), totalBytes=sum(path.stat().st_size for path in files), mediaPackCount=len(media['packs']),
              maxPackBytes=max(pack['bytes'] for pack in media['packs']), exactAssetCount=len(media['assets']), streamedAssets=sum(bool(asset['stream']) for asset in media['assets']),
              monarchPack=geometry, sourceCount=len(header['models']), gameTypes=sorted(game_type for model in header['models'].values() for game_type in model['gameTypes']),
              fullNearFaces=sum(model['triangles'] for model in header['models'].values()), arrayStorage=header.get('arrayStorage'),
              runtimeSHA256=sha((ROOT / 'src/monarch-vehicle-assets3d.js').read_bytes()), buildToolSHA256=sha((ROOT / 'tools/build.py').read_bytes()),
              verifierSHA256=sha((WORK / 'verify-packaged-media.mjs').read_bytes()), manifestSHA256=sha((ROOT / 'assets/manifest.json').read_bytes()))
report['pass'] = report.pop('pass_')
report['auditGeneratorSHA256'] = sha(Path(__file__).read_bytes())
(WORK / 'final-pages-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
