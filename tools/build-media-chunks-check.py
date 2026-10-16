#!/usr/bin/env python3
"""Prove exact classic-script reassembly, byte ceilings and ordinary pack cache compatibility."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit, parse_qs

source = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name('build.py')).resolve()
spec = importlib.util.spec_from_file_location('game_builder_under_test', source)
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
report = {'builder': str(source), 'builderSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'checks': 0}
# Frozen pre-chunking format: normal pack bytes must retain their SHA/cache URLs.
WRAPPER = ('// Dead End City media pack (tools/build.py --split-media): labelled Base64\n'
           '// registered as data: URLs for src/asset-loader.js. Not code to edit.\n'
           '(function (M) {\n')
CLOSE = '})((window.DEAD_END_CITY_MEDIA = window.DEAD_END_CITY_MEDIA || {}));\n'


def check(ok, message):
    report['checks'] += 1
    if not ok:
        raise AssertionError(message)


def record(entry, raw):
    return (f"// {entry['original']} | {len(raw)} bytes | SHA-256 {hashlib.sha256(raw).hexdigest()}\n"
            f"M[{json.dumps(entry['id'])}] = {json.dumps('data:' + entry['mime'] + ';base64,' + base64.b64encode(raw).decode('ascii'))};\n")


try:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        (root / 'assets').mkdir()
        build.ROOT = str(root)
        real_limit = build.PACK_LIMIT
        build.PACK_LIMIT = 1200

        def asset(name, raw, mime='application/octet-stream', identifier=None, stream=False):
            (root / 'assets' / name).write_bytes(raw)
            return dict(id=identifier or 'media-' + name, file='assets/' + name, original=name, mime=mime, stream=stream)

        before = asset('before.bin', b'neighbor before\x00\xff')
        image = asset('image.webp', b'unchanged image', 'image/webp')
        audio = asset('sound.ogg', b'unchanged audio', 'audio/ogg')
        after = asset('after.bin', b'neighbor after\x00\x80')
        music = asset('track.mp3', b'unchanged streamed music', 'audio/mpeg', stream=True)

        def generate(name, entries):
            (root / 'assets/manifest.json').write_text(json.dumps(entries))
            directory = root / name
            markup = build.media_blocks(str(directory))
            paths, identities = [], {}
            for url in re.findall(r'(?:src|data-src)="(media/[^\"]+)"', markup):
                parsed = urlsplit(url)
                data = (directory / parsed.path).read_bytes()
                sha = hashlib.sha256(data).hexdigest()
                check(parse_qs(parsed.query).get('sha') == [sha], 'Cache URL differs from exact pack bytes')
                identities[parsed.path] = sha
                if parsed.path.endswith('.js'):
                    check(len(data) <= build.PACK_LIMIT, 'Pack exceeds byte ceiling including wrapper: ' + parsed.path + ' ' + str(len(data)))
                    paths.append(str(directory / parsed.path))
            # Use the actual classic-script order, one persistent JS context, no
            # browser/module/fetch shortcuts; compare every reconstructed byte.
            fixture = directory / 'fixture.json'
            fixture.write_text(json.dumps(dict(paths=paths, expected=[dict(id=e['id'], file=str(root / e['file']), mime=e['mime']) for e in entries if not e.get('stream')])))
            result = subprocess.run(['node', '-e', r'''
const fs=require('node:fs'),vm=require('node:vm'),fixture=JSON.parse(fs.readFileSync(process.argv[1],'utf8')),
  context=vm.createContext({window:{}});
for(const file of fixture.paths) vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const media=context.window.DEAD_END_CITY_MEDIA;
if(Object.keys(media).length!==fixture.expected.length) throw Error('missing/extra asset registrations');
for(const entry of fixture.expected) {
  const value=media[entry.id],prefix='data:'+entry.mime+';base64,';
  if(typeof value!=='string'||!value.startsWith(prefix)) throw Error('invalid data URL '+entry.id);
  if(!Buffer.from(value.slice(prefix.length),'base64').equals(fs.readFileSync(entry.file))) throw Error('byte mismatch '+entry.id);
}
''', str(fixture)], capture_output=True, text=True)
            check(result.returncode == 0, 'Classic script reconstruction failed: ' + result.stderr[:500])
            return directory, identities

        normal = [before, image, audio, after, music]
        normal_dir, normal_ids = generate('normal', normal)
        for kind, entries in [('data', [before, after]), ('images', [image]), ('audio', [audio])]:
            expected = WRAPPER + ''.join(record(e, (root / e['file']).read_bytes()) for e in entries) + CLOSE
            actual = (normal_dir / 'media' / ('pack-' + kind + '.js')).read_bytes()
            check(actual == expected.encode('ascii'), 'Normal pack bytes changed from the frozen format: ' + kind)
        check(generate('normal-same', normal)[1] == normal_ids, 'Unchanged normal packs lost cache identities')

        payload = bytes(range(256)) * 17 + b'last fragment\x00\xff'
        large = asset('large.bin', payload, identifier='media-large-"\\-\u03bb')
        second = asset('second.bin', bytes(range(255, -1, -1)) * 12)
        entries = [before, image, large, after, audio, second, music]
        directory, identities = generate('chunked', entries)
        check(len(list((directory / 'media').glob('pack-data*.js'))) > 4, 'Oversized entries did not span script packs')
        for entry in [large, second]:
            raw = (root / entry['file']).read_bytes()
            label = f"// {entry['original']} | {len(raw)} bytes | SHA-256 {hashlib.sha256(raw).hexdigest()}"
            scripts = [(path, path.read_text()) for path in (directory / 'media').glob('pack-data*.js')]
            fragments = [text for path, text in scripts if label in text]
            check(len(fragments) > 1, 'Source SHA/count labels were lost on continuations')
            check(sum(('M[' + json.dumps(entry['id']) + '] = ') in text for text in fragments) == 1, 'Large record must start with exactly one assignment')
            check(sum(('M[' + json.dumps(entry['id']) + '] += ') in text for text in fragments) == len(fragments) - 1, 'Continuation scripts overwrite earlier data')
        check(generate('chunked-same', entries)[1] == identities, 'Unchanged chunked bytes lost cache identities')
        # A source edit changes its own complete SHA labels; the before/after
        # neighbors and other MIME kinds retain their exact independent bytes.
        (root / large['file']).write_bytes(b'X' + payload[1:])
        _, changed = generate('changed-large', entries)
        unchanged = [path for path in identities if b'large.bin |' not in (directory / path).read_bytes()]
        check(all(identities[path] == changed[path] for path in unchanged), 'Editing a large source invalidated unrelated packs/music')
        check(any(identities[path] != changed[path] for path in identities if path not in unchanged), 'Edited large source did not invalidate its cache')

        # Exercise the exact assignment/continuation boundary and empty assets.
        boundary = asset('boundary.bin', b'')
        capacity = build.PACK_LIMIT - len(WRAPPER) - len(CLOSE)
        threshold = next(n for n in range(2000) if len(record(boundary, bytes(n))) > capacity)
        for size in [0, threshold - 1, threshold, threshold + 1]:
            (root / boundary['file']).write_bytes(bytes(size))
            generate('boundary-' + str(size), [before, boundary, after])

        # Real production ceiling and a source the size of the authored Dolcati,
        # without committing a giant fixture. This would exceed 24 MB unsplit.
        build.PACK_LIMIT = real_limit
        real_size = 18_026_262
        real = asset('hero.bin', (bytes(range(256)) * ((real_size + 255) // 256))[:real_size])
        real_dir, _ = generate('production-size', [before, real, after, image, audio, music])
        report['largestPackBytes'] = max(p.stat().st_size for p in (real_dir / 'media').glob('*.js'))
        report['reconstructedHeroBytes'] = real_size
        # Inline media remains one ordinary embedded block, with no append API.
        (root / 'assets/manifest.json').write_text(json.dumps([before, music]))
        inline = build.media_blocks()
        check('M[' not in inline and 'BINARY MEDIA: before.bin' in inline and 'BINARY MEDIA: track.mp3' in inline, 'Inline/streamed inline contract changed')
    report['pass'] = True
except Exception as error:
    report['pass'] = False
    report['error'] = str(error)
print(json.dumps(report, indent=2))
if not report['pass']:
    sys.exit(1)
