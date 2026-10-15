#!/usr/bin/env python3
"""Check unchanged cache identity and changed-asset invalidation using an isolated media fixture."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urlsplit, parse_qs

source = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name('build.py')).resolve()
spec = importlib.util.spec_from_file_location('game_builder_under_test', source)
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
report = {'builder': str(source), 'builderSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'checks': 0}


def check(ok, message):
    report['checks'] += 1
    if not ok:
        raise AssertionError(message)


try:
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        (root / 'assets').mkdir()
        entries = []
        for name, mime, streamed in [('image.webp', 'image/webp', False), ('model.bin', 'application/octet-stream', False), ('track.mp3', 'audio/mpeg', True)]:
            (root / 'assets' / name).write_bytes(('original ' + name).encode())
            entries.append(dict(id='media-' + name.split('.')[0], file='assets/' + name, original=name, mime=mime, stream=streamed))
        (root / 'assets/manifest.json').write_text(json.dumps(entries))
        build.ROOT = str(root)

        def generate(name):
            directory = root / name
            text = build.media_blocks(str(directory))
            result = {}
            for url in re.findall(r'(?:src|data-src)="(media/[^\"]+)"', text):
                parsed = urlsplit(url)
                data = (directory / parsed.path).read_bytes()
                identity = parse_qs(parsed.query).get('sha', [None])[0]
                check(identity == hashlib.sha256(data).hexdigest(), 'Media URL has no exact content identity: ' + parsed.path)
                result[parsed.path] = url
            check(len(result) == 3, 'All packed and streamed media must be referenced')
            return result

        first = generate('first')
        check(generate('same') == first, 'Unchanged content changed its browser cache identity')
        (root / 'assets/image.webp').write_bytes(b'replacement image bytes')
        changed = generate('changed')
        check(first.keys() == changed.keys(), 'Deployment should retain normal media paths')
        check(first['media/pack-images.js'] != changed['media/pack-images.js'], 'Replacing an asset did not invalidate its cached pack')
        check(first['media/pack-data.js'] == changed['media/pack-data.js'], 'An unrelated asset lost its cached identity')
        check(first['media/track.mp3'] == changed['media/track.mp3'], 'Unchanged music lost its cached identity')
        (root / 'assets/track.mp3').write_bytes(b'replacement track bytes')
        music = generate('changed-music')
        check(changed['media/track.mp3'] != music['media/track.mp3'], 'Replacing a track did not invalidate its cached URL')
        check(changed['media/pack-images.js'] == music['media/pack-images.js'], 'Changing music invalidated unchanged image data')
    report['pass'] = True
except Exception as error:
    report['pass'] = False
    report['error'] = str(error)
print(json.dumps(report, indent=2))
if not report['pass']:
    sys.exit(1)
