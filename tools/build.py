#!/usr/bin/env python3
"""Assemble the self-contained Dead End City HTML from the modular source.

    python3 tools/build.py            -> dist/dead-end-city.html
    python3 tools/build.py --out X    -> custom output path

Everything stays human-readable: JavaScript is copied verbatim (no
minification), Three.js keeps its original source and license, and every
binary media file is embedded as a labeled Base64 block with its byte count
and SHA-256 so the assembled file can be audited without tooling.

Directives understood in src/shell.html:
  <!-- @include-game-source -->   src/main.js with nested `// @include` lines
  <!-- @include-three-source -->  vendor/three.r160.js
  <!-- @include-media -->         every entry of assets/manifest.json
  <!-- @include-asset-loader -->  src/asset-loader.js
  <!-- @include-credits -->       docs/THIRD_PARTY_CREDITS.txt
"""
import argparse
import base64
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE_RX = re.compile(r'^(\s*)// @include (src/[\w.-]+\.js)\s*$')


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read()


def expand_js(rel, seen=None):
    """Recursively expand `// @include` directives. Each included file is
    inserted verbatim, so line-level indentation of the directive is ignored
    (the source files already carry their own indentation)."""
    seen = seen or set()
    if rel in seen:
        raise SystemExit('include cycle at ' + rel)
    seen = seen | {rel}
    out = []
    for line in read(rel).rstrip('\n').split('\n'):
        m = INCLUDE_RX.match(line)
        if m:
            out.append(expand_js(m.group(2), seen))
        else:
            out.append(line)
    return '\n'.join(out)


def media_blocks():
    manifest = json.loads(read('assets/manifest.json'))
    parts = []
    for entry in manifest:
        with open(os.path.join(ROOT, entry['file']), 'rb') as fh:
            raw = fh.read()
        sha = hashlib.sha256(raw).hexdigest()
        b64 = base64.b64encode(raw).decode('ascii')
        wrapped = '\n'.join(b64[i:i + 100] for i in range(0, len(b64), 100))
        parts.append(
            f"<!-- BINARY MEDIA: {entry['original']} | {len(raw)} bytes | SHA-256 {sha} -->\n"
            f"<script type=\"application/octet-stream\" id=\"{entry['id']}\" data-mime=\"{entry['mime']}\">\n"
            f"{wrapped}\n</script>\n"
        )
    return '\n'.join(parts).rstrip('\n')


def build(out_path):
    shell = read('src/shell.html')
    replacements = {
        '<!-- @include-game-source -->': expand_js('src/main.js'),
        '<!-- @include-three-source -->': read('vendor/three.r160.js').rstrip('\n'),
        '<!-- @include-media -->': media_blocks(),
        '<!-- @include-asset-loader -->': read('src/asset-loader.js').rstrip('\n'),
        '<!-- @include-credits -->': read('docs/THIRD_PARTY_CREDITS.txt').rstrip('\n'),
    }
    for key, value in replacements.items():
        if key not in shell:
            raise SystemExit('shell is missing directive ' + key)
        shell = shell.replace(key, value, 1)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write(shell)
    size = os.path.getsize(out_path)
    print(f'wrote {out_path} ({size / 1e6:.1f} MB)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist', 'dead-end-city.html'))
    args = ap.parse_args()
    build(args.out)
