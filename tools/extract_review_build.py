#!/usr/bin/env python3
"""One-time extractor: splits a Dead End City single-file review build into
the modular repository layout that tools/build.py reassembles.

Usage: python3 tools/extract_review_build.py <review-build.html>

Kept for reference so a future maintainer can see exactly how the original
upload was decomposed. Normal development edits src/ and runs build.py.
"""
import base64
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main(path):
    text = open(path, encoding='utf-8').read()
    lines = text.split('\n')

    # ---- 1. Locate the top-level script blocks -----------------------------
    def find_line(pattern, start=0):
        rx = re.compile(pattern)
        for i in range(start, len(lines)):
            if rx.search(lines[i]):
                return i
        raise SystemExit('marker not found: ' + pattern)

    game_open = find_line(r'<script id="game-source">')
    game_close = find_line(r'^\s*</script>', game_open)
    three_open = find_line(r'<script id="three-source">', game_close)
    three_close = find_line(r'^\s*</script>', three_open)
    media_banner = find_line(r'EMBEDDED BINARY MEDIA', three_close)
    loader_open = find_line(r'<script id="asset-loader">', media_banner)
    loader_close = find_line(r'^\s*</script>', loader_open)
    credits_open = find_line(r'<script id="third-party-credits"', loader_close)
    credits_close = find_line(r'^\s*</script>', credits_open)

    # ---- 2. Game source: split nested subsystems into files ---------------
    game_body = lines[game_open + 1:game_close]
    os.makedirs(os.path.join(ROOT, 'src'), exist_ok=True)

    begin_rx = re.compile(r'^(\s*)// BEGIN SUBSYSTEM: (src/[\w.-]+\.js)(.*)$')
    end_rx = re.compile(r'^(\s*)// END SUBSYSTEM: (src/[\w.-]+\.js)\s*$')

    # Recursive descent over the marker structure. Each subsystem file keeps
    # its own BEGIN/END marker lines (they are useful landmarks when reading
    # the assembled build), and nested subsystems are replaced by an
    # `// @include` directive that build.py expands in place.
    files = {}

    def parse(i, out, owner):
        while i < len(game_body):
            line = game_body[i]
            m = begin_rx.match(line)
            if m:
                indent, name = m.group(1), m.group(2)
                sub = [line]
                i = parse(i + 1, sub, name)
                files[name] = sub
                out.append(f'{indent}// @include {name}')
                continue
            m = end_rx.match(line)
            if m:
                if m.group(2) != owner:
                    raise SystemExit(f'mismatched END {m.group(2)} inside {owner}')
                out.append(line)
                return i + 1
            out.append(line)
            i += 1
        return i

    top = []
    parse(0, top, None)
    # `top` is the wrapper: function startDeadEndCity(ASSETS) { @include src/game.js }
    files['src/main.js'] = top

    for name, body in files.items():
        with open(os.path.join(ROOT, name), 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(body).rstrip('\n') + '\n')

    # ---- 3. Three.js vendor source -----------------------------------------
    os.makedirs(os.path.join(ROOT, 'vendor'), exist_ok=True)
    with open(os.path.join(ROOT, 'vendor', 'three.r160.js'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines[three_open + 1:three_close]).rstrip('\n') + '\n')

    # ---- 4. Binary media -> real files + manifest --------------------------
    media_rx = re.compile(r'<!-- BINARY MEDIA: (\S+) \| (\d+) bytes \| SHA-256 ([0-9a-f]{64}) -->')
    tag_rx = re.compile(r'<script type="application/octet-stream" id="([\w-]+)" data-mime="([\w/+-]+)">')
    manifest = []
    i = media_banner + 1
    while i < loader_open:
        m = media_rx.search(lines[i])
        if not m:
            i += 1
            continue
        src_path, size, sha = m.group(1), int(m.group(2)), m.group(3)
        t = tag_rx.search(lines[i + 1])
        if not t:
            raise SystemExit('media tag missing after ' + src_path)
        ident, mime = t.group(1), t.group(2)
        j = i + 2
        payload = []
        while not lines[j].startswith('</script>'):
            payload.append(lines[j].strip())
            j += 1
        raw = base64.b64decode(''.join(payload))
        digest = hashlib.sha256(raw).hexdigest()
        if len(raw) != size or digest != sha:
            raise SystemExit(f'media integrity failure for {src_path}')
        rel = src_path.replace('src/assets/', 'assets/').replace('src/', 'assets/')
        abs_path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, 'wb') as fh:
            fh.write(raw)
        manifest.append({'id': ident, 'file': rel, 'mime': mime, 'original': src_path})
        i = j + 1
    with open(os.path.join(ROOT, 'assets', 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')

    # ---- 5. Asset loader + credits -----------------------------------------
    with open(os.path.join(ROOT, 'src', 'asset-loader.js'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines[loader_open + 1:loader_close]).rstrip('\n') + '\n')
    os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
    with open(os.path.join(ROOT, 'docs', 'THIRD_PARTY_CREDITS.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines[credits_open + 1:credits_close]).rstrip('\n') + '\n')

    # ---- 6. HTML shell with directives ------------------------------------
    shell = []
    shell += lines[:game_open + 1]
    shell.append('<!-- @include-game-source -->')
    shell += lines[game_close:three_open + 1]
    shell.append('<!-- @include-three-source -->')
    shell += lines[three_close:media_banner + 1]
    shell.append('<!-- @include-media -->')
    shell += lines[loader_open:loader_open + 1]
    shell.append('<!-- @include-asset-loader -->')
    shell += lines[loader_close:credits_open + 1]
    shell.append('<!-- @include-credits -->')
    shell += lines[credits_close:]
    with open(os.path.join(ROOT, 'src', 'shell.html'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(shell))

    print(f'extracted {len(files)} source files, {len(manifest)} media files')

if __name__ == '__main__':
    main(sys.argv[1])
