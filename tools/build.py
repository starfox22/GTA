#!/usr/bin/env python3
"""Assemble the self-contained Dead End City HTML from the modular source.

    python3 tools/build.py            -> dead-end-city.html (repo root; a local build,
                                         ignored by version control: never commit it)
    python3 tools/build.py --out X    -> custom output path

Everything stays human-readable: JavaScript is copied verbatim (no
minification), Three.js keeps its original source and license, and every
binary media file is embedded as a labeled Base64 block with its byte count
and SHA-256 so the assembled file can be audited without tooling.

    python3 tools/build.py --split-media dist/publish
                                      -> dist/publish/index.html plus dist/publish/media/*:
                                         the same game, but manifest entries marked
                                         "stream": true (the radio music) are left out of
                                         the page and loaded from media/ beside it. This is
                                         the variant published as the claude.ai artifact,
                                         whose page size is capped at 16 MB.

    python3 tools/build.py --zip dist/DeadEndCity.zip
                                      -> the downloadable game: DeadEndCity/index.html
                                         (the split build), DeadEndCity/media/*.mp3 and
                                         DeadEndCity/README.txt. Works from file://.

Include lines (each on a line of its own; the file is inserted verbatim in its
place, the line's own indentation is ignored, nesting is allowed, a missing file
stops the build):
  // @include src/x.js            in .js files
  /* @include src/ui/x.css */     in .css files and inside <style> in .html files
  <!-- @include src/ui/x.html --> in .html files (src/shell.html and src/ui/*.html)

Placeholders filled after the includes are expanded (src/shell.html):
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
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS_INCLUDE = re.compile(r'^\s*// @include (src/[\w./-]+\.js)\s*$')
CSS_INCLUDE = re.compile(r'^\s*/\* @include (src/[\w./-]+\.css) \*/\s*$')
HTML_INCLUDE = re.compile(r'^\s*<!-- @include (src/[\w./-]+\.html) -->\s*$')
# Which include lines each kind of file may contain.
INCLUDES_BY_EXT = {
    '.js': (JS_INCLUDE,),
    '.css': (CSS_INCLUDE,),
    '.html': (HTML_INCLUDE, CSS_INCLUDE),
}


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read()


def expand(rel, seen=()):
    """Recursively expand include lines. Each included file is inserted
    verbatim (minus trailing newlines), so the include line's own indentation
    is ignored: the source files already carry their own indentation."""
    if rel in seen:
        raise SystemExit('include cycle at ' + rel)
    seen = seen + (rel,)
    patterns = INCLUDES_BY_EXT[os.path.splitext(rel)[1]]
    out = []
    for line in read(rel).rstrip('\n').split('\n'):
        m = next((m for m in (rx.match(line) for rx in patterns) if m), None)
        if not m:
            out.append(line)
        elif not os.path.isfile(os.path.join(ROOT, m.group(1))):
            raise SystemExit(f'{rel}: included file not found: {m.group(1)}')
        else:
            out.append(expand(m.group(1), seen))
    return '\n'.join(out)


def media_blocks(split_dir=None):
    """Every manifest entry as a labelled Base64 block. With split_dir, entries
    marked "stream" are copied to split_dir/media/ instead and their block is
    left empty with a data-src the media loader resolves relative to the page."""
    manifest = json.loads(read('assets/manifest.json'))
    parts = []
    for entry in manifest:
        if split_dir and entry.get('stream'):
            name = os.path.basename(entry['file'])
            os.makedirs(os.path.join(split_dir, 'media'), exist_ok=True)
            with open(os.path.join(ROOT, entry['file']), 'rb') as src, \
                    open(os.path.join(split_dir, 'media', name), 'wb') as dst:
                dst.write(src.read())
            parts.append(
                f"<!-- STREAMED MEDIA: {entry['original']} is served from media/{name} -->\n"
                f"<script type=\"application/octet-stream\" id=\"{entry['id']}\" data-mime=\"{entry['mime']}\" "
                f"data-src=\"media/{name}\"></script>\n"
            )
            continue
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


def build(out_path, split_dir=None):
    shell = expand('src/shell.html') + '\n'
    replacements = {
        '<!-- @include-game-source -->': expand('src/main.js'),
        '<!-- @include-three-source -->': read('vendor/three.r160.js').rstrip('\n'),
        '<!-- @include-media -->': media_blocks(split_dir),
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


ZIP_README = '''DEAD END CITY
=============

Double-click index.html to play. It works in Chrome, Edge, Firefox and Safari,
straight from this folder: no install and no internet connection needed.

Keep the media folder next to index.html: the car radio streams its music
from there. Everything else (graphics, sound effects) is inside index.html.

The controls are in the game (HOW TO PLAY on the title screen). Third-party credits
are embedded in index.html (search it for "third-party-credits").
'''


def build_zip(zip_path, folder='DeadEndCity'):
    """The split build as a zip holding one folder a player unpacks and opens."""
    with tempfile.TemporaryDirectory() as tmp:
        stage = os.path.join(tmp, folder)
        build(os.path.join(stage, 'index.html'), stage)
        with open(os.path.join(stage, 'README.txt'), 'w', encoding='utf-8') as fh:
            fh.write(ZIP_README)
        os.makedirs(os.path.dirname(os.path.abspath(zip_path)), exist_ok=True)
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            for dirpath, dirs, names in os.walk(stage):
                dirs.sort()
                for name in sorted(names):
                    full = os.path.join(dirpath, name)
                    arc = os.path.relpath(full, tmp).replace(os.sep, '/')
                    # MP3s are already compressed: store them as they are.
                    kind = zipfile.ZIP_STORED if name.endswith('.mp3') else zipfile.ZIP_DEFLATED
                    zf.write(full, arc, compress_type=kind)
    print(f'wrote {zip_path} ({os.path.getsize(zip_path) / 1e6:.1f} MB)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'dead-end-city.html'))
    ap.add_argument('--js-out', help='also write the expanded game script (for `node --check`)')
    ap.add_argument('--split-media', metavar='DIR',
                    help='write DIR/index.html with streamed media as separate files in DIR/media')
    ap.add_argument('--zip', metavar='ZIP',
                    help='write ZIP holding DeadEndCity/index.html, media/*.mp3 and README.txt')
    args = ap.parse_args()
    if args.zip:
        build_zip(args.zip)
    elif args.split_media:
        build(os.path.join(args.split_media, 'index.html'), args.split_media)
    else:
        build(args.out)
    if args.js_out:
        with open(args.js_out, 'w', encoding='utf-8') as fh:
            fh.write(expand('src/main.js') + '\n')
        print('wrote', args.js_out)
