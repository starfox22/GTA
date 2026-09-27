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
                                         the same game with no media inside the page.
                                         Manifest entries marked "stream": true (the radio
                                         music) are copied to media/ and played by URL; every
                                         other entry goes into a media pack, media/pack-<kind>.js
                                         (images, audio, data; -2, -3... past PACK_LIMIT), a
                                         plain script that registers the same labelled Base64
                                         as a data: URL. Classic <script src> tags load them in
                                         order before the asset loader, so the game starts the
                                         same way, and they work from file:// (the zip) where
                                         fetch() and WebGL textures from files are blocked.
                                         This is the variant published as the claude.ai
                                         artifact, whose page (not its files) is capped at 16 MB.

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


# A media pack file stays well under the claude.ai artifact limit for one file (15 MB).
PACK_LIMIT = 12_000_000


def pack_kind(entry):
    mime = entry['mime']
    return 'images' if mime.startswith('image/') else 'audio' if mime.startswith('audio/') else 'data'


def write_media_packs(split_dir, entries):
    """The non-streamed entries as media/pack-<kind>[-n].js files; returns the
    <script src> tags (in manifest order of first use) that load them."""
    os.makedirs(os.path.join(split_dir, 'media'), exist_ok=True)
    packs = {}  # file name -> list of text chunks
    sizes = {}
    order = []
    counters = {}
    for entry in entries:
        with open(os.path.join(ROOT, entry['file']), 'rb') as fh:
            raw = fh.read()
        sha = hashlib.sha256(raw).hexdigest()
        url = 'data:' + entry['mime'] + ';base64,' + base64.b64encode(raw).decode('ascii')
        chunk = (
            f"// {entry['original']} | {len(raw)} bytes | SHA-256 {sha}\n"
            f"M[{json.dumps(entry['id'])}] = {json.dumps(url)};\n"
        )
        kind = pack_kind(entry)
        n = counters.setdefault(kind, 1)
        name = f'pack-{kind}.js' if n == 1 else f'pack-{kind}-{n}.js'
        if name in packs and sizes[name] + len(chunk) > PACK_LIMIT:
            counters[kind] = n = n + 1
            name = f'pack-{kind}-{n}.js'
        if name not in packs:
            packs[name] = [
                '// Dead End City media pack (tools/build.py --split-media): labelled Base64\n'
                '// registered as data: URLs for src/asset-loader.js. Not code to edit.\n'
                '(function (M) {\n'
            ]
            sizes[name] = 0
            order.append(name)
        packs[name].append(chunk)
        sizes[name] += len(chunk)
    for name in order:
        with open(os.path.join(split_dir, 'media', name), 'w', encoding='ascii') as fh:
            fh.write(''.join(packs[name]) + '})((window.DEAD_END_CITY_MEDIA = window.DEAD_END_CITY_MEDIA || {}));\n')
    return [f'<script src="media/{name}"></script>\n' for name in order]


def media_blocks(split_dir=None):
    """Every manifest entry as a labelled Base64 block. With split_dir, no media
    stays in the page: entries marked "stream" are copied to split_dir/media/ and
    their block is left empty with a data-src the media loader resolves relative
    to the page; every other entry goes into a media pack (write_media_packs)."""
    manifest = json.loads(read('assets/manifest.json'))
    parts = []
    if split_dir:
        packed = [e for e in manifest if not e.get('stream')]
        parts.append(
            f"<!-- MEDIA PACKS: {len(packed)} images, sounds and data files are served from media/pack-*.js -->\n"
            + ''.join(write_media_packs(split_dir, packed))
        )
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
        if split_dir:
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

Keep the media folder next to index.html: the graphics, the sound effects and
the car radio's music all load from there.

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
